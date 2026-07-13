import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';

import { AccessGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';

@Controller('api/v1/admin/auth')
@UseGuards(AccessGuard)
export class AdminAuthController {
  @Get('check')
  check(@Req() request: AuthenticatedRequest): object {
    if (!request.auth.permissions.includes('admin:access'))
      throw new ForbiddenException('没有管理端访问权限');
    return { success: true, data: { status: 'ok' }, requestId: request.requestId };
  }
}
