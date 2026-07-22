import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Notification } from '@prisma/client';

import type { ListNotificationsDto, MarkNotificationsReadDto } from './notifications.dto';
import { NotificationsRepository } from './notifications.repository';

function forbidden(): ForbiddenException {
  return new ForbiddenException({
    code: 'NOTIFICATION_PERMISSION_DENIED',
    message: '当前账号不能访问通知',
  });
}

function notificationView(notification: Notification): object {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    content: notification.content,
    relatedType: notification.relatedType,
    relatedId: notification.relatedId,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NotificationsRepository) private readonly repository: NotificationsRepository,
  ) {}

  async list(userId: string, input: ListNotificationsDto): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.repository.findActor(tx, userId);
      if (!actor || actor.status !== 'ACTIVE') throw forbidden();
      const result = await this.repository.list(tx, userId, input);
      return {
        items: result.items.map(notificationView),
        page: input.page,
        pageSize: input.pageSize,
        total: result.total,
        hasNext: input.page * input.pageSize < result.total,
        unreadCount: result.unreadCount,
      };
    });
  }

  async markRead(userId: string, input: MarkNotificationsReadDto): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.repository.findActor(tx, userId);
      if (!actor || actor.status !== 'ACTIVE') throw forbidden();
      const updated = await this.repository.markRead(tx, userId, input.ids, new Date());
      return {
        markedCount: updated.count,
        unreadCount: await this.repository.unreadCount(tx, userId),
      };
    });
  }
}
