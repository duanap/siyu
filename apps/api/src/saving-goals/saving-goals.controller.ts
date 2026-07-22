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
import {
  CreateSavingContributionDto,
  CreateSavingGoalDto,
  ListSavingGoalsDto,
  UpdateSavingContributionDto,
  UpdateSavingGoalDto,
} from './saving-goals.dto';
import { SavingGoalsService } from './saving-goals.service';

@Controller('api/v1/saving-goals')
@UseGuards(AccessGuard)
export class SavingGoalsController {
  constructor(
    @Inject(SavingGoalsService) private readonly savingGoals: SavingGoalsService,
    @Inject(AuthRateLimitService) private readonly rateLimit: AuthRateLimitService,
  ) {}

  private success(request: AuthenticatedRequest, data: unknown): object {
    return { success: true, data, requestId: request.requestId };
  }

  @Get()
  async list(
    @Query() query: ListSavingGoalsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(request, await this.savingGoals.list(request.auth.userId, query));
  }

  @Post()
  async create(
    @Body() body: CreateSavingGoalDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('saving-write', request.auth.userId, 60, 600);
    return this.success(request, await this.savingGoals.create(request.auth.userId, body));
  }

  @Get(':id')
  async get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(request, await this.savingGoals.get(request.auth.userId, id));
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateSavingGoalDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('saving-write', request.auth.userId, 60, 600);
    return this.success(request, await this.savingGoals.update(request.auth.userId, id, body));
  }

  @Delete(':id')
  async delete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('saving-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.savingGoals.delete(request.auth.userId, id, request.requestId),
    );
  }

  @Post(':id/contributions')
  async createContribution(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: CreateSavingContributionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('saving-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.savingGoals.createContribution(request.auth.userId, id, body),
    );
  }

  @Patch(':goalId/contributions/:id')
  async updateContribution(
    @Param('goalId', new ParseUUIDPipe({ version: '4' })) goalId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateSavingContributionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('saving-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.savingGoals.updateContribution(request.auth.userId, goalId, id, body),
    );
  }

  @Delete(':goalId/contributions/:id')
  async deleteContribution(
    @Param('goalId', new ParseUUIDPipe({ version: '4' })) goalId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('saving-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.savingGoals.deleteContribution(request.auth.userId, goalId, id, request.requestId),
    );
  }
}
