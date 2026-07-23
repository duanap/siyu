import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';

type Tx = Prisma.TransactionClient;

const entryExportSelect = {
  id: true,
  type: true,
  amountCent: true,
  businessDate: true,
  note: true,
  paymentMethod: true,
  sourceType: true,
  createdAt: true,
  ledger: { select: { id: true, name: true, type: true, ownerUserId: true } },
  category: { select: { name: true } },
  creator: { select: { nickname: true } },
} satisfies Prisma.EntrySelect;

const salaryExportInclude = {
  profile: { select: { name: true, employerName: true } },
  items: { orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }] },
} satisfies Prisma.SalaryRecordInclude;

export type EntryExportRecord = Prisma.EntryGetPayload<{ select: typeof entryExportSelect }>;
export type SalaryExportRecord = Prisma.SalaryRecordGetPayload<{
  include: typeof salaryExportInclude;
}>;

@Injectable()
export class ExportsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  findActor(tx: Tx, userId: string) {
    return tx.user.findFirst({
      where: { id: userId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, timezone: true },
    });
  }

  findVisibleLedger(tx: Tx, userId: string, ledgerId: string) {
    return tx.ledger.findFirst({
      where: {
        id: ledgerId,
        status: 'ACTIVE',
        deletedAt: null,
        members: { some: { userId, status: 'ACTIVE' } },
      },
      select: {
        id: true,
        type: true,
        ownerUserId: true,
        members: { where: { userId, status: 'ACTIVE' }, select: { role: true } },
      },
    });
  }

  listEntries(
    tx: Tx,
    ledgerId: string,
    startDate: Date,
    endDate: Date,
    take: number,
  ): Promise<EntryExportRecord[]> {
    return tx.entry.findMany({
      where: {
        ledgerId,
        deletedAt: null,
        businessDate: { gte: startDate, lte: endDate },
      },
      select: entryExportSelect,
      orderBy: [{ businessDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take,
    });
  }

  listSalaryRecords(
    tx: Tx,
    userId: string,
    year: number,
    take: number,
  ): Promise<SalaryExportRecord[]> {
    return tx.salaryRecord.findMany({
      where: {
        userId,
        deletedAt: null,
        salaryMonth: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lt: new Date(Date.UTC(year + 1, 0, 1)),
        },
      },
      include: salaryExportInclude,
      orderBy: [{ salaryMonth: 'asc' }, { id: 'asc' }],
      take,
    });
  }

  audit(
    tx: Tx,
    input: {
      actorUserId: string;
      action: 'ENTRY_CSV_EXPORTED' | 'SALARY_CSV_EXPORTED';
      targetType: 'LEDGER' | 'USER';
      targetId: string;
      requestId: string;
      afterJson: Prisma.InputJsonValue;
    },
  ) {
    return tx.auditLog.create({ data: { actorType: 'USER', ...input } });
  }
}
