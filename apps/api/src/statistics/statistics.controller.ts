import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';

import { AccessGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { StatisticsQueryDto } from './statistics.dto';
import { StatisticsService } from './statistics.service';

@Controller('api/v1/statistics')
@UseGuards(AccessGuard)
export class StatisticsController {
  constructor(@Inject(StatisticsService) private readonly statistics: StatisticsService) {}

  private success(request: AuthenticatedRequest, data: unknown): object {
    return { success: true, data, requestId: request.requestId };
  }

  @Get('overview')
  async overview(
    @Query() query: StatisticsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(request, await this.statistics.overview(request.auth.userId, query));
  }

  @Get('trend')
  async trend(
    @Query() query: StatisticsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(request, await this.statistics.trend(request.auth.userId, query));
  }

  @Get('categories')
  async categories(
    @Query() query: StatisticsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(request, await this.statistics.categories(request.auth.userId, query));
  }

  @Get('members')
  async members(
    @Query() query: StatisticsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(request, await this.statistics.members(request.auth.userId, query));
  }
}
