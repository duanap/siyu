import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, SavingGoalStatus } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';

type Tx = Prisma.TransactionClient;

const userSummarySelect = {
  id: true,
  nickname: true,
} satisfies Prisma.UserSelect;

const contributionInclude = {
  user: { select: userSummarySelect },
} satisfies Prisma.SavingContributionInclude;

const goalInclude = {
  creator: { select: userSummarySelect },
  ledger: {
    select: {
      id: true,
      name: true,
      type: true,
      ownerUserId: true,
      members: {
        where: { status: 'ACTIVE' as const },
        select: {
          userId: true,
          role: true,
          user: { select: userSummarySelect },
        },
        orderBy: [{ joinedAt: 'asc' as const }, { id: 'asc' as const }],
      },
    },
  },
  contributions: {
    where: { deletedAt: null },
    include: contributionInclude,
    orderBy: [
      { businessDate: 'desc' as const },
      { createdAt: 'desc' as const },
      { id: 'desc' as const },
    ],
  },
} satisfies Prisma.SavingGoalInclude;

export type SavingGoalRecord = Prisma.SavingGoalGetPayload<{ include: typeof goalInclude }>;
export type SavingContributionRecord = Prisma.SavingContributionGetPayload<{
  include: typeof contributionInclude;
}>;

@Injectable()
export class SavingGoalsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  async lock(tx: Tx, keys: string[]): Promise<void> {
    for (const key of [...new Set(keys)].sort()) {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    }
  }

  findActor(tx: Tx, userId: string) {
    return tx.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, status: true },
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
      },
    });
  }

  async list(
    tx: Tx,
    userId: string,
    input: { ledgerId?: string; page: number; pageSize: number },
  ): Promise<{ items: SavingGoalRecord[]; total: number }> {
    const where: Prisma.SavingGoalWhereInput = {
      deletedAt: null,
      ...(input.ledgerId ? { ledgerId: input.ledgerId } : {}),
      ledger: {
        status: 'ACTIVE',
        deletedAt: null,
        members: { some: { userId, status: 'ACTIVE' } },
      },
    };
    const [items, total] = await Promise.all([
      tx.savingGoal.findMany({
        where,
        include: goalInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      tx.savingGoal.count({ where }),
    ]);
    return { items, total };
  }

  findVisibleGoal(tx: Tx, userId: string, id: string) {
    return tx.savingGoal.findFirst({
      where: {
        id,
        deletedAt: null,
        ledger: {
          status: 'ACTIVE',
          deletedAt: null,
          members: { some: { userId, status: 'ACTIVE' } },
        },
      },
      include: goalInclude,
    });
  }

  findGoalByIdempotency(tx: Tx, creatorUserId: string, idempotencyKey: string) {
    return tx.savingGoal.findFirst({
      where: { creatorUserId, idempotencyKey },
      include: goalInclude,
    });
  }

  createGoal(
    tx: Tx,
    input: {
      ledgerId: string;
      creatorUserId: string;
      name: string;
      targetCent: bigint;
      initialCent: bigint;
      savedCent: bigint;
      targetDate: Date | null;
      status: SavingGoalStatus;
      coverUrl: string | null;
      note: string | null;
      idempotencyKey: string;
      createRequestHash: string;
    },
  ) {
    return tx.savingGoal.create({ data: input, include: goalInclude });
  }

  updateGoal(
    tx: Tx,
    id: string,
    data: {
      name?: string;
      targetCent?: bigint;
      targetDate?: Date | null;
      status?: SavingGoalStatus;
      coverUrl?: string | null;
      note?: string | null;
      savedCent?: bigint;
      deletedAt?: Date;
    },
  ) {
    return tx.savingGoal.update({ where: { id }, data, include: goalInclude });
  }

  findContributionByIdempotency(tx: Tx, userId: string, idempotencyKey: string) {
    return tx.savingContribution.findFirst({
      where: { userId, idempotencyKey },
      include: contributionInclude,
    });
  }

  findOwnedContribution(
    tx: Tx,
    goalId: string,
    contributionId: string,
    userId: string,
    includeDeleted = false,
  ) {
    return tx.savingContribution.findFirst({
      where: {
        id: contributionId,
        goalId,
        userId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      include: contributionInclude,
    });
  }

  createContribution(
    tx: Tx,
    input: {
      goalId: string;
      userId: string;
      amountCent: bigint;
      businessDate: Date;
      note: string | null;
      idempotencyKey: string;
      createRequestHash: string;
    },
  ) {
    return tx.savingContribution.create({ data: input, include: contributionInclude });
  }

  updateContribution(
    tx: Tx,
    id: string,
    data: {
      amountCent?: bigint;
      businessDate?: Date;
      note?: string | null;
      deletedAt?: Date;
    },
  ) {
    return tx.savingContribution.update({
      where: { id },
      data,
      include: contributionInclude,
    });
  }

  async sumActiveContributions(tx: Tx, goalId: string): Promise<bigint> {
    const result = await tx.savingContribution.aggregate({
      where: { goalId, deletedAt: null },
      _sum: { amountCent: true },
    });
    return result._sum.amountCent ?? 0n;
  }

  audit(
    tx: Tx,
    input: {
      actorUserId: string;
      action: 'SAVING_GOAL_DELETE' | 'SAVING_CONTRIBUTION_DELETE';
      targetType: 'SAVING_GOAL' | 'SAVING_CONTRIBUTION';
      targetId: string;
      requestId: string;
      beforeJson: Prisma.InputJsonValue;
      afterJson: Prisma.InputJsonValue;
    },
  ) {
    return tx.auditLog.create({ data: { actorType: 'USER', ...input } });
  }
}
