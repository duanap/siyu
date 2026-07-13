import { randomBytes } from 'node:crypto';

import {
  Injectable,
  Inject,
  ServiceUnavailableException,
  UnauthorizedException,
  type OnModuleDestroy,
} from '@nestjs/common';
import IORedis from 'ioredis';

import { initializeDefaultCategories } from '../categories/category-defaults';
import { readConfig } from '../config';
import { PrismaService } from '../database/prisma.service';
import { USER_ROLE_ID } from './auth.constants';

interface QqProfile {
  nickname?: string;
  figureurl_qq_2?: string;
  ret: number;
  msg?: string;
}

@Injectable()
export class OAuthService implements OnModuleDestroy {
  private readonly config = readConfig();
  private redis: IORedis | undefined;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redis && this.redis.status !== 'end') await this.redis.quit();
  }

  private client(): IORedis {
    this.redis ??= new IORedis(this.config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    return this.redis;
  }

  async createState(): Promise<string> {
    if (!this.config.qqClientId || !this.config.qqClientSecret || !this.config.qqCallbackUrl) {
      throw new ServiceUnavailableException('QQ 登录尚未配置');
    }
    const redis = this.client();
    if (redis.status === 'wait') await redis.connect();
    const state = randomBytes(32).toString('base64url');
    await redis.set(`oauth:qq:state:${state}`, '1', 'EX', 600, 'NX');
    return state;
  }

  async consumeCallback(code: string, state: string): Promise<string> {
    if (!this.config.qqClientId || !this.config.qqClientSecret || !this.config.qqCallbackUrl) {
      throw new ServiceUnavailableException('QQ 登录尚未配置');
    }
    const redis = this.client();
    if (redis.status === 'wait') await redis.connect();
    const consumed = await redis.getdel(`oauth:qq:state:${state}`);
    if (!consumed) throw new UnauthorizedException('QQ 登录状态无效或已过期');

    const tokenUrl = new URL('https://graph.qq.com/oauth2.0/token');
    tokenUrl.search = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.qqClientId,
      client_secret: this.config.qqClientSecret,
      code,
      redirect_uri: this.config.qqCallbackUrl,
      fmt: 'json',
    }).toString();
    const tokenResponse = await fetch(tokenUrl);
    if (!tokenResponse.ok) throw new UnauthorizedException('QQ 授权失败');
    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      error?: number;
    };
    if (!tokenData.access_token || tokenData.error) throw new UnauthorizedException('QQ 授权失败');

    const openIdUrl = new URL('https://graph.qq.com/oauth2.0/me');
    openIdUrl.search = new URLSearchParams({
      access_token: tokenData.access_token,
      fmt: 'json',
    }).toString();
    const openIdResponse = await fetch(openIdUrl);
    const openIdData = (await openIdResponse.json()) as { openid?: string; error?: number };
    if (!openIdResponse.ok || !openIdData.openid || openIdData.error)
      throw new UnauthorizedException('QQ OpenID 获取失败');
    const openId = openIdData.openid;

    const profileUrl = new URL('https://graph.qq.com/user/get_user_info');
    profileUrl.search = new URLSearchParams({
      access_token: tokenData.access_token,
      oauth_consumer_key: this.config.qqClientId,
      openid: openId,
    }).toString();
    const profileResponse = await fetch(profileUrl);
    const profile = (await profileResponse.json()) as QqProfile;
    if (!profileResponse.ok || profile.ret !== 0)
      throw new UnauthorizedException('QQ 用户资料获取失败');

    const existing = await this.prisma.user.findUnique({ where: { qqOpenId: openId } });
    if (existing) return existing.id;
    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          qqOpenId: openId,
          nickname: profile.nickname?.slice(0, 100) || '四时有余用户',
          avatarUrl: profile.figureurl_qq_2 ?? null,
          userRoles: { create: { roleId: USER_ROLE_ID } },
        },
      });
      const ledger = await tx.ledger.create({
        data: { type: 'PERSONAL', name: '四时有余', ownerUserId: user.id },
      });
      await tx.ledgerMember.create({
        data: { ledgerId: ledger.id, userId: user.id, role: 'OWNER' },
      });
      await initializeDefaultCategories(tx, ledger.id);
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          actorType: 'USER',
          action: 'AUTH_QQ_REGISTERED',
          targetType: 'USER',
          targetId: user.id,
        },
      });
      return user;
    });
    return created.id;
  }
}
