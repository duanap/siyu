import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AccessGuard } from '../auth/auth.guard';
import { AuthRateLimitService } from '../auth/rate-limit.service';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  CreateCategoryDto,
  ListCategoriesDto,
  ReorderCategoriesDto,
  UpdateCategoryDto,
} from './categories.dto';
import { CategoriesService } from './categories.service';

@Controller('api/v1/categories')
@UseGuards(AccessGuard)
export class CategoriesController {
  constructor(
    @Inject(CategoriesService) private readonly categories: CategoriesService,
    @Inject(AuthRateLimitService) private readonly rateLimit: AuthRateLimitService,
  ) {}

  private success(request: AuthenticatedRequest, data: unknown): object {
    return { success: true, data, requestId: request.requestId };
  }

  @Get()
  async list(
    @Query() query: ListCategoriesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(
      request,
      await this.categories.list(
        request.auth.userId,
        query.ledgerId,
        query.type,
        query.includeDisabled,
      ),
    );
  }

  @Post()
  async create(
    @Body() body: CreateCategoryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('category-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.categories.create(request.auth.userId, body, request.requestId),
    );
  }

  @Put('reorder')
  @HttpCode(HttpStatus.OK)
  async reorder(
    @Body() body: ReorderCategoriesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('category-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.categories.reorder(
        request.auth.userId,
        body.ledgerId,
        body.type,
        body.categoryIds,
        request.requestId,
      ),
    );
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateCategoryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('category-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.categories.update(request.auth.userId, id, body, request.requestId),
    );
  }

  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  async enable(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('category-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.categories.setEnabled(request.auth.userId, id, true, request.requestId),
    );
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  async disable(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('category-write', request.auth.userId, 60, 600);
    return this.success(
      request,
      await this.categories.setEnabled(request.auth.userId, id, false, request.requestId),
    );
  }
}
