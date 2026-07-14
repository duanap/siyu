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
import { CreateEntryDto, DeleteEntryDto, ListEntriesDto, UpdateEntryDto } from './entries.dto';
import { EntriesService } from './entries.service';

@Controller('api/v1/entries')
@UseGuards(AccessGuard)
export class EntriesController {
  constructor(
    @Inject(EntriesService) private readonly entries: EntriesService,
    @Inject(AuthRateLimitService) private readonly rateLimit: AuthRateLimitService,
  ) {}

  private success(request: AuthenticatedRequest, data: unknown): object {
    return { success: true, data, requestId: request.requestId };
  }

  @Get()
  async list(
    @Query() query: ListEntriesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(request, await this.entries.list(request.auth.userId, query));
  }

  @Post()
  async create(
    @Body() body: CreateEntryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('entry-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.entries.create(request.auth.userId, body, request.requestId),
    );
  }

  @Get(':id')
  async get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(request, await this.entries.get(request.auth.userId, id));
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateEntryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('entry-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.entries.update(request.auth.userId, id, body, request.requestId),
    );
  }

  @Delete(':id')
  async delete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: DeleteEntryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('entry-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.entries.delete(request.auth.userId, id, query.expectedVersion, request.requestId),
    );
  }
}
