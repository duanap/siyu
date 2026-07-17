import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';

type Tx = Prisma.TransactionClient;

const ledgerContextInclude = {
  members: {
    orderBy: [{ joinedAt: 'asc' as const }, { id: 'asc' as const }],
    select: {
      userId: true,
      role: true,
      status: true,
      user: { select: { nickname: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.LedgerInclude;

export type StatisticsLedgerContext = Prisma.LedgerGetPayload<{
  include: typeof ledgerContextInclude;
}>;

function entryWhere(ledgerId: string, startDate: Date, endDate: Date): Prisma.EntryWhereInput {
  return {
    ledgerId,
    deletedAt: null,
    businessDate: { gte: startDate, lt: endDate },
  };
}

@Injectable()
export class StatisticsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  findActor(tx: Tx, userId: string) {
    return tx.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, timezone: true },
    });
  }

  findLedgerContext(tx: Tx, userId: string, ledgerId: string) {
    return tx.ledger.findFirst({
      where: {
        id: ledgerId,
        status: 'ACTIVE',
        deletedAt: null,
        members: { some: { userId, status: 'ACTIVE' } },
      },
      include: ledgerContextInclude,
    });
  }

  overview(tx: Tx, ledgerId: string, startDate: Date, endDate: Date) {
    return tx.entry.groupBy({
      by: ['type'],
      where: entryWhere(ledgerId, startDate, endDate),
      _sum: { amountCent: true },
      _max: { amountCent: true },
      _count: { _all: true },
    });
  }

  trend(tx: Tx, ledgerId: string, startDate: Date, endDate: Date) {
    return tx.entry.groupBy({
      by: ['businessDate', 'type'],
      where: entryWhere(ledgerId, startDate, endDate),
      _sum: { amountCent: true },
      _count: { _all: true },
      orderBy: [{ businessDate: 'asc' }, { type: 'asc' }],
    });
  }

  async categories(tx: Tx, ledgerId: string, startDate: Date, endDate: Date) {
    const rows = await tx.entry.groupBy({
      by: ['categoryId'],
      where: {
        ...entryWhere(ledgerId, startDate, endDate),
        type: 'EXPENSE',
      },
      _sum: { amountCent: true },
      _count: { _all: true },
      orderBy: [{ _sum: { amountCent: 'desc' } }, { categoryId: 'asc' }],
    });
    const categories = await tx.category.findMany({
      where: { id: { in: rows.map((row) => row.categoryId) }, ledgerId },
      select: { id: true, name: true, icon: true, color: true, isEnabled: true },
    });
    return { rows, categories };
  }

  members(tx: Tx, ledgerId: string, startDate: Date, endDate: Date) {
    return tx.entry.groupBy({
      by: ['creatorUserId'],
      where: {
        ...entryWhere(ledgerId, startDate, endDate),
        type: 'EXPENSE',
      },
      _sum: { amountCent: true },
      _count: { _all: true },
      orderBy: [{ _sum: { amountCent: 'desc' } }, { creatorUserId: 'asc' }],
    });
  }
}
