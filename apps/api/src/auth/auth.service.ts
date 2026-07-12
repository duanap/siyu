import { createHash, randomBytes, randomUUID } from 'node:crypto';

import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash as argonHash, verify as argonVerify, argon2id } from 'argon2';
import { Queue } from 'bullmq';

import { readConfig } from '../config';
import { PrismaService } from '../database/prisma.service';
import {
  ACCESS_TOKEN_SECONDS,
  RESET_TOKEN_SECONDS,
  SESSION_SECONDS,
  USER_ROLE_ID,
} from './auth.constants';
import type { AuthPrincipal, AuthTokenData } from './auth.types';

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function opaqueToken(): string {
  return randomBytes(48).toString('base64url');
}

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly config = readConfig();
  private resetQueue: Queue | undefined;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.resetQueue?.close();
  }

  private queue(): Queue {
    this.resetQueue ??= new Queue('siyu-password-reset', {
      connection: { url: this.config.redisUrl },
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    });
    return this.resetQueue;
  }

  private async passwordHash(password: string): Promise<string> {
    return argonHash(password, { type: argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  }

  private async accessFor(userId: string, sessionId: string): Promise<AuthTokenData> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        credential: true,
        userRoles: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        },
      },
    });
    const roles = user.userRoles.map(({ role }) => role.code);
    const permissions = [
      ...new Set(
        user.userRoles.flatMap(({ role }) =>
          role.rolePermissions.map((item) => item.permission.code),
        ),
      ),
    ];
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: sessionId, roles, permissions },
      { secret: this.config.jwtSecret, expiresIn: ACCESS_TOKEN_SECONDS },
    );
    return {
      accessToken,
      expiresIn: ACCESS_TOKEN_SECONDS,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        timezone: user.timezone,
        status: user.status,
        email: user.credential?.emailNormalized ?? null,
        roles,
        permissions,
      },
    };
  }

  async createSession(userId: string): Promise<{ data: AuthTokenData; refreshToken: string }> {
    const refreshToken = opaqueToken();
    const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        expiresAt,
        refreshTokens: { create: { tokenHash: digest(refreshToken), expiresAt } },
      },
    });
    return { data: await this.accessFor(userId, session.id), refreshToken };
  }

  async register(input: {
    email: string;
    password: string;
    nickname: string;
  }): Promise<{ data: AuthTokenData; refreshToken: string }> {
    const email = normalizeEmail(input.email);
    const passwordHash = await this.passwordHash(input.password);
    let userId: string;
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            nickname: input.nickname.trim(),
            credential: { create: { emailNormalized: email, passwordHash } },
            userRoles: { create: { roleId: USER_ROLE_ID } },
          },
        });
        const ledger = await tx.ledger.create({
          data: { type: 'PERSONAL', name: '四时有余', ownerUserId: created.id },
        });
        await tx.ledgerMember.create({
          data: { ledgerId: ledger.id, userId: created.id, role: 'OWNER' },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: created.id,
            actorType: 'USER',
            action: 'AUTH_REGISTERED',
            targetType: 'USER',
            targetId: created.id,
          },
        });
        return created;
      });
      userId = user.id;
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('该邮箱已注册');
      }
      throw error;
    }
    return this.createSession(userId);
  }

  async login(
    emailInput: string,
    password: string,
  ): Promise<{ data: AuthTokenData; refreshToken: string }> {
    const credential = await this.prisma.userCredential.findUnique({
      where: { emailNormalized: normalizeEmail(emailInput) },
      include: { user: true },
    });
    const valid = credential ? await argonVerify(credential.passwordHash, password) : false;
    if (!credential || !valid || credential.user.status !== 'ACTIVE') {
      await this.prisma.auditLog.create({
        data: { actorType: 'ANONYMOUS', action: 'AUTH_LOGIN_FAILED', targetType: 'USER' },
      });
      throw new UnauthorizedException('邮箱或密码错误');
    }
    await this.prisma.auditLog.create({
      data: {
        actorUserId: credential.userId,
        actorType: 'USER',
        action: 'AUTH_LOGIN_SUCCEEDED',
        targetType: 'USER',
        targetId: credential.userId,
      },
    });
    return this.createSession(credential.userId);
  }

  async refresh(rawToken: string): Promise<{ data: AuthTokenData; refreshToken: string }> {
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: digest(rawToken) },
      include: { session: true },
    });
    if (!token) throw new UnauthorizedException('刷新令牌无效');
    if (token.usedAt || token.revokedAt) {
      await this.prisma.authSession.updateMany({
        where: { id: token.sessionId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: 'REFRESH_TOKEN_REPLAY' },
      });
      throw new UnauthorizedException('刷新令牌无效');
    }
    if (token.expiresAt <= new Date() || token.session.status !== 'ACTIVE') {
      throw new UnauthorizedException('刷新令牌已过期');
    }
    const replacement = opaqueToken();
    const replacementId = randomUUID();
    let updated = false;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.refreshToken.create({
          data: {
            id: replacementId,
            sessionId: token.sessionId,
            tokenHash: digest(replacement),
            expiresAt: token.expiresAt,
          },
        });
        const consumed = await tx.refreshToken.updateMany({
          where: { id: token.id, usedAt: null, revokedAt: null },
          data: { usedAt: new Date(), replacedById: replacementId },
        });
        if (consumed.count !== 1) throw new Error('REFRESH_CONFLICT');
        await tx.authSession.update({
          where: { id: token.sessionId },
          data: { lastUsedAt: new Date() },
        });
      });
      updated = true;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'REFRESH_CONFLICT') throw error;
    }
    if (!updated) {
      await this.prisma.authSession.updateMany({
        where: { id: token.sessionId, status: 'ACTIVE' },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokeReason: 'CONCURRENT_REFRESH_REPLAY',
        },
      });
      throw new UnauthorizedException('刷新令牌无效');
    }
    return {
      data: await this.accessFor(token.session.userId, token.sessionId),
      refreshToken: replacement,
    };
  }

  async logout(rawToken?: string): Promise<void> {
    if (!rawToken) return;
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: digest(rawToken) },
    });
    if (!token) return;
    await this.prisma.authSession.updateMany({
      where: { id: token.sessionId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: 'LOGOUT' },
    });
  }

  async changePassword(
    principal: AuthPrincipal,
    current: string,
    next: string,
  ): Promise<{ data: AuthTokenData; refreshToken: string }> {
    const credential = await this.prisma.userCredential.findUnique({
      where: { userId: principal.userId },
    });
    if (!credential || !(await argonVerify(credential.passwordHash, current))) {
      throw new UnauthorizedException('当前密码错误');
    }
    const passwordHash = await this.passwordHash(next);
    const refreshToken = opaqueToken();
    await this.prisma.$transaction(async (tx) => {
      const currentSession = await tx.authSession.findFirst({
        where: {
          id: principal.sessionId,
          userId: principal.userId,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
      });
      if (!currentSession) throw new UnauthorizedException('登录状态已失效');
      await tx.userCredential.update({
        where: { userId: principal.userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      });
      await tx.authSession.updateMany({
        where: { userId: principal.userId, id: { not: principal.sessionId }, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: 'PASSWORD_CHANGED' },
      });
      await tx.refreshToken.updateMany({
        where: { sessionId: principal.sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.refreshToken.create({
        data: {
          sessionId: principal.sessionId,
          tokenHash: digest(refreshToken),
          expiresAt: currentSession.expiresAt,
        },
      });
    });
    return {
      data: await this.accessFor(principal.userId, principal.sessionId),
      refreshToken,
    };
  }

  async requestReset(emailInput: string): Promise<void> {
    const credential = await this.prisma.userCredential.findUnique({
      where: { emailNormalized: normalizeEmail(emailInput) },
    });
    if (!credential) return;
    const token = opaqueToken();
    const record = await this.prisma.passwordResetToken.create({
      data: {
        userId: credential.userId,
        tokenHash: digest(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_SECONDS * 1000),
      },
    });
    await this.queue().add(
      'send',
      { resetId: record.id, email: credential.emailNormalized, token },
      { jobId: record.id },
    );
  }

  async resetPassword(tokenValue: string, password: string): Promise<void> {
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: digest(tokenValue) },
    });
    if (!token || token.usedAt || token.expiresAt <= new Date())
      throw new UnauthorizedException('重置链接无效或已过期');
    const passwordHash = await this.passwordHash(password);
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.passwordResetToken.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (updated.count !== 1) throw new UnauthorizedException('重置链接无效或已过期');
      await tx.userCredential.update({
        where: { userId: token.userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      });
      await tx.authSession.updateMany({
        where: { userId: token.userId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: 'PASSWORD_RESET' },
      });
    });
  }

  qqAuthorizeUrl(state: string): string {
    if (!this.config.qqClientId || !this.config.qqCallbackUrl)
      throw new ServiceUnavailableException('QQ 登录尚未配置');
    const url = new URL('https://graph.qq.com/oauth2.0/authorize');
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.qqClientId,
      redirect_uri: this.config.qqCallbackUrl,
      state,
      scope: 'get_user_info',
    }).toString();
    return url.toString();
  }
}
