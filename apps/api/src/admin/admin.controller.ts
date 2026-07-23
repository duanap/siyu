import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AccessGuard } from '../auth/auth.guard';
import { AuthRateLimitService } from '../auth/rate-limit.service';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  AdminAuditQueryDto,
  AdminLedgersQueryDto,
  AdminRetryDto,
  AdminRunsQueryDto,
  AdminUsersQueryDto,
  AdminUserStatusDto,
} from './admin.dto';
import { AdminService } from './admin.service';

@Controller('api/v1/admin')
@UseGuards(AccessGuard)
export class AdminController {
  constructor(
    @Inject(AdminService) private readonly admin: AdminService,
    @Inject(AuthRateLimitService) private readonly rateLimit: AuthRateLimitService,
  ) {}

  private require(request: AuthenticatedRequest, permission: string): void {
    if (
      !request.auth.permissions.includes('admin:access') ||
      !request.auth.permissions.includes(permission)
    ) {
      throw new ForbiddenException({ code: 'ADMIN_PERMISSION_DENIED', message: '没有此管理权限' });
    }
  }

  private success(request: AuthenticatedRequest, data: unknown): object {
    return { success: true, data, requestId: request.requestId };
  }

  @Get('overview')
  async overview(@Req() request: AuthenticatedRequest): Promise<object> {
    this.require(request, 'admin:overview:read');
    return this.success(request, await this.admin.overview());
  }

  @Get('users')
  async users(
    @Query() query: AdminUsersQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    this.require(request, 'admin:users:read');
    return this.success(request, await this.admin.listUsers(query));
  }

  @Patch('users/:id/status')
  async setUserStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: AdminUserStatusDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    this.require(request, 'admin:users:write');
    await this.rateLimit.consume('admin-write', request.auth.userId, 30, 600);
    return this.success(
      request,
      await this.admin.setUserStatus(request.auth.userId, id, body, request.requestId),
    );
  }

  @Get('ledgers')
  async ledgers(
    @Query() query: AdminLedgersQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    this.require(request, 'admin:ledgers:read');
    return this.success(request, await this.admin.listLedgers(query));
  }

  @Get('recurring-runs')
  async runs(
    @Query() query: AdminRunsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    this.require(request, 'admin:tasks:read');
    return this.success(request, await this.admin.listRuns(query));
  }

  @Post('recurring-runs/:id/retry')
  @HttpCode(200)
  async retry(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: AdminRetryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    this.require(request, 'admin:tasks:retry');
    await this.rateLimit.consume('admin-write', request.auth.userId, 30, 600);
    return this.success(
      request,
      await this.admin.retryRun(request.auth.userId, id, body.reason, request.requestId),
    );
  }

  @Get('audit-logs')
  async audit(
    @Query() query: AdminAuditQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    this.require(request, 'admin:audit:read');
    return this.success(
      request,
      await this.admin.listAudit(request.auth.userId, query, request.requestId),
    );
  }
}
