import { Inject, Injectable } from '@nestjs/common';
import type { EntryType, Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CategoriesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  async lock(tx: Tx, keys: string[]): Promise<void> {
    for (const key of [...new Set(keys)].sort()) {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    }
  }

  findMembership(tx: Tx, userId: string, ledgerId: string) {
    return tx.ledgerMember.findFirst({
      where: {
        ledgerId,
        userId,
        status: 'ACTIVE',
        ledger: { status: 'ACTIVE', deletedAt: null },
      },
      include: { ledger: true },
    });
  }

  list(tx: Tx, ledgerId: string, type?: EntryType, includeDisabled = false) {
    return tx.category.findMany({
      where: {
        ledgerId,
        ...(type ? { type } : {}),
        ...(includeDisabled ? {} : { isEnabled: true }),
      },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  findById(tx: Tx, id: string) {
    return tx.category.findUnique({ where: { id } });
  }

  findByIdempotency(tx: Tx, creatorUserId: string, idempotencyKey: string) {
    return tx.category.findFirst({ where: { creatorUserId, idempotencyKey } });
  }

  findActiveName(tx: Tx, ledgerId: string, type: EntryType, name: string, exceptId?: string) {
    return tx.category.findFirst({
      where: {
        ledgerId,
        type,
        isEnabled: true,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
  }

  async nextSortOrder(tx: Tx, ledgerId: string, type: EntryType): Promise<number> {
    const result = await tx.category.aggregate({
      where: { ledgerId, type },
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? 0) + 100;
  }

  create(
    tx: Tx,
    input: {
      ledgerId: string;
      creatorUserId: string;
      type: EntryType;
      name: string;
      icon: string;
      color: string;
      sortOrder: number;
      idempotencyKey: string;
    },
  ) {
    return tx.category.create({ data: input });
  }

  update(tx: Tx, id: string, data: { name?: string; icon?: string; color?: string }) {
    return tx.category.update({ where: { id }, data });
  }

  setEnabled(tx: Tx, id: string, isEnabled: boolean) {
    return tx.category.update({ where: { id }, data: { isEnabled } });
  }

  async reorder(tx: Tx, categoryIds: string[]): Promise<void> {
    for (const [index, id] of categoryIds.entries()) {
      await tx.category.update({ where: { id }, data: { sortOrder: (index + 1) * 100 } });
    }
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
      data: { actorType: 'USER', targetType: 'CATEGORY', ...input },
    });
  }
}
