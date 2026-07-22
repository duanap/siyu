import {
  Body,
  Controller,
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
  CreateSalaryProfileDto,
  CreateSalaryRecordDto,
  ListSalaryRecordsDto,
  MarkSalaryPaidDto,
  UpdateSalaryProfileDto,
  UpdateSalaryRecordDto,
} from './salary.dto';
import { SalaryService } from './salary.service';

@Controller('api/v1/salary')
@UseGuards(AccessGuard)
export class SalaryController {
  constructor(
    @Inject(SalaryService) private readonly salary: SalaryService,
    @Inject(AuthRateLimitService) private readonly rateLimit: AuthRateLimitService,
  ) {}

  private success(request: AuthenticatedRequest, data: unknown): object {
    return { success: true, data, requestId: request.requestId };
  }

  @Get('profiles')
  async listProfiles(@Req() request: AuthenticatedRequest): Promise<object> {
    return this.success(request, await this.salary.listProfiles(request.auth.userId));
  }

  @Post('profiles')
  async createProfile(
    @Body() body: CreateSalaryProfileDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('salary-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.salary.createProfile(request.auth.userId, body, request.requestId),
    );
  }

  @Patch('profiles/:id')
  async updateProfile(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateSalaryProfileDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('salary-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.salary.updateProfile(request.auth.userId, id, body, request.requestId),
    );
  }

  @Get('records')
  async listRecords(
    @Query() query: ListSalaryRecordsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(request, await this.salary.listRecords(request.auth.userId, query));
  }

  @Post('records')
  async createRecord(
    @Body() body: CreateSalaryRecordDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('salary-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.salary.createRecord(request.auth.userId, body, request.requestId),
    );
  }

  @Get('records/:id')
  async getRecord(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(request, await this.salary.getRecord(request.auth.userId, id));
  }

  @Patch('records/:id')
  async updateRecord(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateSalaryRecordDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('salary-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.salary.updateRecord(request.auth.userId, id, body, request.requestId),
    );
  }

  @Post('records/:id/mark-paid')
  @HttpCode(200)
  async markPaid(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: MarkSalaryPaidDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('salary-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.salary.markPaid(request.auth.userId, id, body, request.requestId),
    );
  }
}
