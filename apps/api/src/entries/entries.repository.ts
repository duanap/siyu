import { Inject, Injectable } from '@nestjs/common';
import type { EntryPaymentMethod, EntryType, Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';

type Tx = Prisma.TransactionClient;

const entryInclude = {
  creator: { select: { id: true, nickname: true, avatarUrl: true } },
  category: { select: { id: true, name: true, icon: true, color: true, isEnabled: true } },
  ledger: { include: { members: true } },
} satisfies Prisma.EntryInclude;

export type EntryRecord = Prisma.EntryGetPayload<{ include: typeof entryInclude }>;

@Injectable()
export class EntriesRepository {
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

  findMembership(tx: Tx, userId: string, ledgerId: string) {
    return tx.ledgerMember.findFirst({
      where: {
        userId,
        ledgerId,
        status: 'ACTIVE',
        ledger: { status: 'ACTIVE', deletedAt: null },
      },
      include: { ledger: true },
    });
  }

  findVisibleById(tx: Tx, userId: string, id: string, includeDeleted = false) {
    return tx.entry.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
        ledger: {
          status: 'ACTIVE',
          deletedAt: null,
          members: { some: { userId, status: 'ACTIVE' } },
        },
      },
      include: entryInclude,
    });
  }

  findByIdempotency(tx: Tx, creatorUserId: string, idempotencyKey: string) {
    return tx.entry.findFirst({
      where: { creatorUserId, idempotencyKey },
      include: entryInclude,
    });
  }

  findCategory(tx: Tx, id: string) {
    return tx.category.findUnique({
      where: { id },
      select: { id: true, ledgerId: true, type: true, isEnabled: true },
    });
  }

  async list(
    tx: Tx,
    input: {
      ledgerId: string;
      startDate: Date;
      endDate: Date;
      type?: EntryType;
      categoryId?: string;
      creatorUserId?: string;
      keyword?: string;
      page: number;
      pageSize: number;
    },
  ): Promise<{ items: EntryRecord[]; total: number }> {
    const where: Prisma.EntryWhereInput = {
      ledgerId: input.ledgerId,
      deletedAt: null,
      businessDate: { gte: input.startDate, lt: input.endDate },
      ...(input.type ? { type: input.type } : {}),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.creatorUserId ? { creatorUserId: input.creatorUserId } : {}),
      ...(input.keyword ? { note: { contains: input.keyword, mode: 'insensitive' as const } } : {}),
    };
    const items = await tx.entry.findMany({
      where,
      include: entryInclude,
      orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    });
    const total = await tx.entry.count({ where });
    return { items, total };
  }

  create(
    tx: Tx,
    input: {
      ledgerId: string;
      creatorUserId: string;
      type: EntryType;
      amountCent: bigint;
      categoryId: string;
      businessDate: Date;
      note: string | null;
      paymentMethod: EntryPaymentMethod | null;
      idempotencyKey: string;
      createRequestHash: string;
    },
  ) {
    return tx.entry.create({ data: input, include: entryInclude });
  }

  updateIfVersion(
    tx: Tx,
    id: string,
    expectedVersion: number,
    data: {
      type?: EntryType;
      amountCent?: bigint;
      categoryId?: string;
      businessDate?: Date;
      note?: string | null;
      paymentMethod?: EntryPaymentMethod | null;
    },
  ) {
    return tx.entry.updateMany({
      where: { id, version: expectedVersion, deletedAt: null },
      data: { ...data, version: { increment: 1 } },
    });
  }

  deleteIfVersion(tx: Tx, id: string, expectedVersion: number, deletedAt: Date) {
    return tx.entry.updateMany({
      where: { id, version: expectedVersion, deletedAt: null },
      data: { deletedAt, version: { increment: 1 } },
    });
  }

  audit(
    tx: Tx,
    input: {
      actorUserId: string;
      action: string;
      targetId: string;
      requestId?: string;
      beforeJson?: Prisma.InputJsonValue;
      afterJson?: Prisma.InputJsonValue;
    },
  ) {
    return tx.auditLog.create({
      data: { actorType: 'USER', targetType: 'ENTRY', ...input },
    });
  }
}
