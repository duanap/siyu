import { Body, Controller, Get, Inject, Patch, Req, UseGuards } from '@nestjs/common';

import { AccessGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { UpdateUserDto } from './users.dto';

@Controller('api/v1/users')
@UseGuards(AccessGuard)
export class UsersController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async view(userId: string): Promise<object> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        credential: true,
        userRoles: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        },
      },
    });
    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      timezone: user.timezone,
      status: user.status,
      email: user.credential?.emailNormalized ?? null,
      roles: user.userRoles.map(({ role }) => role.code),
      permissions: [
        ...new Set(
          user.userRoles.flatMap(({ role }) =>
            role.rolePermissions.map(({ permission }) => permission.code),
          ),
        ),
      ],
    };
  }

  @Get('me')
  async me(@Req() request: AuthenticatedRequest): Promise<object> {
    return {
      success: true,
      data: await this.view(request.auth.userId),
      requestId: request.requestId,
    };
  }

  @Patch('me')
  async update(@Body() body: UpdateUserDto, @Req() request: AuthenticatedRequest): Promise<object> {
    await this.prisma.user.update({ where: { id: request.auth.userId }, data: body });
    return {
      success: true,
      data: await this.view(request.auth.userId),
      requestId: request.requestId,
    };
  }
}
