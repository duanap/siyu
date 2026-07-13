import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { readConfig } from '../config';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedRequest, AuthPrincipal } from './auth.types';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.header('authorization');
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('登录状态已失效');
    try {
      const payload = await this.jwt.verifyAsync<AuthPrincipal & { sub: string; sid: string }>(
        header.slice(7),
        { secret: readConfig().jwtSecret },
      );
      const session = await this.prisma.authSession.findFirst({
        where: {
          id: payload.sid,
          userId: payload.sub,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
      });
      if (!session) throw new UnauthorizedException('登录状态已失效');
      request.auth = {
        userId: payload.sub,
        sessionId: payload.sid,
        roles: payload.roles,
        permissions: payload.permissions,
      };
      return true;
    } catch {
      throw new UnauthorizedException('登录状态已失效');
    }
  }
}
