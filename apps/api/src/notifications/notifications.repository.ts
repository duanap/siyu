import { Inject, Injectable } from '@nestjs/common';
import type { Notification, Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  findActor(tx: Tx, userId: string) {
    return tx.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, status: true },
    });
  }

  async list(
    tx: Tx,
    userId: string,
    input: { page: number; pageSize: number },
  ): Promise<{ items: Notification[]; total: number; unreadCount: number }> {
    const where = { userId } satisfies Prisma.NotificationWhereInput;
    const [items, total, unreadCount] = await Promise.all([
      tx.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      tx.notification.count({ where }),
      tx.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, total, unreadCount };
  }

  markRead(tx: Tx, userId: string, ids: string[], readAt: Date) {
    return tx.notification.updateMany({
      where: { userId, id: { in: ids }, readAt: null },
      data: { readAt },
    });
  }

  unreadCount(tx: Tx, userId: string): Promise<number> {
    return tx.notification.count({ where: { userId, readAt: null } });
  }
}
