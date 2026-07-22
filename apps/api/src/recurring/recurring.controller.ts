import {
  Body,
  Controller,
  Delete,
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
  ConfirmRecurringRunDto,
  CreateRecurringRuleDto,
  ListRecurringRulesDto,
  ListRecurringRunsDto,
  UpdateRecurringRuleDto,
} from './recurring.dto';
import { RecurringService } from './recurring.service';

@Controller('api/v1')
@UseGuards(AccessGuard)
export class RecurringController {
  constructor(
    @Inject(RecurringService) private readonly recurring: RecurringService,
    @Inject(AuthRateLimitService) private readonly rateLimit: AuthRateLimitService,
  ) {}

  private success(request: AuthenticatedRequest, data: unknown): object {
    return { success: true, data, requestId: request.requestId };
  }

  @Get('recurring-rules')
  async listRules(
    @Query() query: ListRecurringRulesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(request, await this.recurring.listRules(request.auth.userId, query));
  }

  @Post('recurring-rules')
  async createRule(
    @Body() body: CreateRecurringRuleDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('recurring-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.recurring.createRule(request.auth.userId, body, request.requestId),
    );
  }

  @Get('recurring-rules/:id')
  async getRule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(request, await this.recurring.getRule(request.auth.userId, id));
  }

  @Patch('recurring-rules/:id')
  async updateRule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateRecurringRuleDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('recurring-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.recurring.updateRule(request.auth.userId, id, body, request.requestId),
    );
  }

  @Post('recurring-rules/:id/pause')
  @HttpCode(200)
  async pauseRule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('recurring-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.recurring.pauseRule(request.auth.userId, id, request.requestId),
    );
  }

  @Post('recurring-rules/:id/resume')
  @HttpCode(200)
  async resumeRule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('recurring-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.recurring.resumeRule(request.auth.userId, id, request.requestId),
    );
  }

  @Delete('recurring-rules/:id')
  async deleteRule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('recurring-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.recurring.deleteRule(request.auth.userId, id, request.requestId),
    );
  }

  @Get('recurring-runs')
  async listRuns(
    @Query() query: ListRecurringRunsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(request, await this.recurring.listRuns(request.auth.userId, query));
  }

  @Post('recurring-runs/:id/confirm')
  @HttpCode(200)
  async confirmRun(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: ConfirmRecurringRunDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('recurring-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.recurring.confirmRun(request.auth.userId, id, body, request.requestId),
    );
  }

  @Post('recurring-runs/:id/skip')
  @HttpCode(200)
  async skipRun(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('recurring-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.recurring.skipRun(request.auth.userId, id, request.requestId),
    );
  }
}
