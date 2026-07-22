import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AccessGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { ListNotificationsDto, MarkNotificationsReadDto } from './notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('api/v1/notifications')
@UseGuards(AccessGuard)
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  private success(request: AuthenticatedRequest, data: unknown): object {
    return { success: true, data, requestId: request.requestId };
  }

  @Get()
  async list(
    @Query() query: ListNotificationsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(request, await this.notifications.list(request.auth.userId, query));
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @Body() body: MarkNotificationsReadDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(request, await this.notifications.markRead(request.auth.userId, body));
  }
}
