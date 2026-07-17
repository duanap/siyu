import { Inject, Injectable } from '@nestjs/common';
import type { DebtDirection, DebtStatus, EntryType, Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';

type Tx = Prisma.TransactionClient;

const debtInclude = {
  transactions: {
    where: { deletedAt: null },
    include: { entry: { select: { id: true, type: true, amountCent: true, businessDate: true } } },
    orderBy: [
      { businessDate: 'desc' as const },
      { createdAt: 'desc' as const },
      { id: 'desc' as const },
    ],
  },
} satisfies Prisma.DebtInclude;

export type DebtRecord = Prisma.DebtGetPayload<{ include: typeof debtInclude }>;

@Injectable()
export class DebtsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  async lock(tx: Tx, keys: string[]): Promise<void> {
    for (const key of [...new Set(keys)].sort()) {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    }
  }

  findActor(tx: Tx, userId: string) {
    return tx.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, status: true, timezone: true },
    });
  }

  markOverdue(tx: Tx, userId: string, today: Date) {
    return tx.debt.updateMany({
      where: {
        userId,
        deletedAt: null,
        remainingCent: { gt: 0 },
        dueDate: { lt: today },
        status: 'ACTIVE',
      },
      data: { status: 'OVERDUE' },
    });
  }

  async list(
    tx: Tx,
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: DebtRecord[]; total: number }> {
    const where: Prisma.DebtWhereInput = { userId, deletedAt: null };
    const items = await tx.debt.findMany({
      where,
      include: debtInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const total = await tx.debt.count({ where });
    return { items, total };
  }

  findOwnedById(tx: Tx, userId: string, id: string, includeDeleted = false) {
    return tx.debt.findFirst({
      where: { id, userId, ...(includeDeleted ? {} : { deletedAt: null }) },
      include: debtInclude,
    });
  }

  findByIdempotency(tx: Tx, userId: string, idempotencyKey: string) {
    return tx.debt.findFirst({ where: { userId, idempotencyKey }, include: debtInclude });
  }

  create(
    tx: Tx,
    input: {
      userId: string;
      direction: DebtDirection;
      counterpartyName: string;
      principalCent: bigint;
      remainingCent: bigint;
      startDate: Date;
      dueDate: Date | null;
      status: DebtStatus;
      note: string | null;
      reminderEnabled: boolean;
      idempotencyKey: string;
      createRequestHash: string;
    },
  ) {
    return tx.debt.create({ data: input, include: debtInclude });
  }

  update(
    tx: Tx,
    id: string,
    data: {
      counterpartyName?: string;
      dueDate?: Date | null;
      note?: string | null;
      reminderEnabled?: boolean;
      processedCent?: bigint;
      remainingCent?: bigint;
      status?: DebtStatus;
      deletedAt?: Date;
    },
  ) {
    return tx.debt.update({ where: { id }, data, include: debtInclude });
  }

  softDeleteTransactions(tx: Tx, debtId: string, deletedAt: Date) {
    return tx.debtTransaction.updateMany({
      where: { debtId, deletedAt: null, syncEntry: false },
      data: { deletedAt },
    });
  }

  findTransactionByIdempotency(tx: Tx, userId: string, idempotencyKey: string) {
    return tx.debtTransaction.findFirst({
      where: { userId, idempotencyKey },
      include: { entry: true },
    });
  }

  findPersonalLedger(tx: Tx, userId: string) {
    return tx.ledger.findFirst({
      where: {
        ownerUserId: userId,
        type: 'PERSONAL',
        status: 'ACTIVE',
        deletedAt: null,
        members: { some: { userId, role: 'OWNER', status: 'ACTIVE' } },
      },
      select: { id: true },
    });
  }

  findDefaultCategory(tx: Tx, ledgerId: string, type: EntryType) {
    return tx.category.findFirst({
      where: {
        ledgerId,
        type,
        templateKey: type === 'EXPENSE' ? 'expense.other' : 'income.other',
        isEnabled: true,
      },
      select: { id: true },
    });
  }

  createSourceEntry(
    tx: Tx,
    input: {
      ledgerId: string;
      creatorUserId: string;
      type: EntryType;
      amountCent: bigint;
      categoryId: string;
      businessDate: Date;
      note: string | null;
      sourceId: string;
      idempotencyKey: string;
      createRequestHash: string;
    },
  ) {
    return tx.entry.create({
      data: { ...input, sourceType: 'DEBT_TRANSACTION', paymentMethod: null },
    });
  }

  createTransaction(
    tx: Tx,
    input: {
      id: string;
      debtId: string;
      userId: string;
      amountCent: bigint;
      businessDate: Date;
      syncEntry: boolean;
      entryId: string | null;
      idempotencyKey: string;
      requestHash: string;
      note: string | null;
    },
  ) {
    return tx.debtTransaction.create({ data: input, include: { entry: true } });
  }

  audit(
    tx: Tx,
    input: {
      actorUserId: string;
      action: string;
      targetType: 'DEBT' | 'DEBT_TRANSACTION';
      targetId: string;
      requestId?: string;
      beforeJson?: Prisma.InputJsonValue;
      afterJson?: Prisma.InputJsonValue;
    },
  ) {
    return tx.auditLog.create({ data: { actorType: 'USER', ...input } });
  }
}
