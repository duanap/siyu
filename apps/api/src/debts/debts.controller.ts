import {
  Body,
  Controller,
  Delete,
  Get,
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
import { CreateDebtDto, CreateDebtTransactionDto, ListDebtsDto, UpdateDebtDto } from './debts.dto';
import { DebtsService } from './debts.service';

@Controller('api/v1/debts')
@UseGuards(AccessGuard)
export class DebtsController {
  constructor(
    @Inject(DebtsService) private readonly debts: DebtsService,
    @Inject(AuthRateLimitService) private readonly rateLimit: AuthRateLimitService,
  ) {}

  private success(request: AuthenticatedRequest, data: unknown): object {
    return { success: true, data, requestId: request.requestId };
  }

  @Get()
  async list(@Query() query: ListDebtsDto, @Req() request: AuthenticatedRequest): Promise<object> {
    return this.success(request, await this.debts.list(request.auth.userId, query));
  }

  @Post()
  async create(@Body() body: CreateDebtDto, @Req() request: AuthenticatedRequest): Promise<object> {
    await this.rateLimit.consume('debt-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.debts.create(request.auth.userId, body, request.requestId),
    );
  }

  @Get(':id')
  async get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(request, await this.debts.get(request.auth.userId, id));
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateDebtDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('debt-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.debts.update(request.auth.userId, id, body, request.requestId),
    );
  }

  @Delete(':id')
  async delete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('debt-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.debts.delete(request.auth.userId, id, request.requestId),
    );
  }

  @Post(':id/transactions')
  async createTransaction(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: CreateDebtTransactionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('debt-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.debts.createTransaction(request.auth.userId, id, body, request.requestId),
    );
  }
}
