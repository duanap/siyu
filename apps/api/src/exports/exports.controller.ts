import { Controller, Get, Inject, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import { AccessGuard } from '../auth/auth.guard';
import { AuthRateLimitService } from '../auth/rate-limit.service';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { ExportEntriesDto, ExportSalaryDto } from './exports.dto';
import { ExportsService } from './exports.service';

@Controller('api/v1/exports')
@UseGuards(AccessGuard)
export class ExportsController {
  constructor(
    @Inject(ExportsService) private readonly exportsService: ExportsService,
    @Inject(AuthRateLimitService) private readonly rateLimit: AuthRateLimitService,
  ) {}

  private headers(response: Response, filename: string): void {
    response.setHeader('content-type', 'text/csv; charset=utf-8');
    response.setHeader('content-disposition', `attachment; filename="${filename}"`);
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-content-type-options', 'nosniff');
  }

  @Get('entries.csv')
  async entries(
    @Query() query: ExportEntriesDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    await this.rateLimit.consume('export-entries', request.auth.userId, 10, 600);
    const result = await this.exportsService.entries(request.auth.userId, query, request.requestId);
    this.headers(response, result.filename);
    return result.body;
  }

  @Get('salary.csv')
  async salary(
    @Query() query: ExportSalaryDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    await this.rateLimit.consume('export-salary', request.auth.userId, 10, 600);
    const result = await this.exportsService.salary(request.auth.userId, query, request.requestId);
    this.headers(response, result.filename);
    return result.body;
  }
}
