import { Inject, Injectable } from '@nestjs/common';
import type {
  EntryType,
  GenerationMode,
  Prisma,
  RecurringFrequency,
  RecurringRuleStatus,
  RecurringRunStatus,
} from '@prisma/client';

import { PrismaService } from '../database/prisma.service';

type Tx = Prisma.TransactionClient;

const ruleInclude = {
  category: { select: { id: true, name: true, icon: true, color: true, isEnabled: true } },
  ledger: { include: { members: { where: { status: 'ACTIVE' as const } } } },
} satisfies Prisma.RecurringRuleInclude;

const runInclude = {
  rule: { include: ruleInclude },
} satisfies Prisma.RecurringRunInclude;

export type RecurringRuleRecord = Prisma.RecurringRuleGetPayload<{ include: typeof ruleInclude }>;
export type RecurringRunRecord = Prisma.RecurringRunGetPayload<{ include: typeof runInclude }>;

@Injectable()
export class RecurringRepository {
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

  findCategory(tx: Tx, categoryId: string) {
    return tx.category.findUnique({
      where: { id: categoryId },
      select: { id: true, ledgerId: true, type: true, isEnabled: true },
    });
  }

  async listRules(
    tx: Tx,
    userId: string,
    input: { ledgerId?: string; page: number; pageSize: number },
  ): Promise<{ items: RecurringRuleRecord[]; total: number }> {
    const where: Prisma.RecurringRuleWhereInput = {
      deletedAt: null,
      ...(input.ledgerId ? { ledgerId: input.ledgerId } : {}),
      ledger: {
        status: 'ACTIVE',
        deletedAt: null,
        members: { some: { userId, status: 'ACTIVE' } },
      },
    };
    const items = await tx.recurringRule.findMany({
      where,
      include: ruleInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    });
    return { items, total: await tx.recurringRule.count({ where }) };
  }

  findVisibleRule(tx: Tx, userId: string, id: string, includeDeleted = false) {
    return tx.recurringRule.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
        ledger: {
          status: 'ACTIVE',
          deletedAt: null,
          members: { some: { userId, status: 'ACTIVE' } },
        },
      },
      include: ruleInclude,
    });
  }

  findRuleByIdempotency(tx: Tx, ownerUserId: string, idempotencyKey: string) {
    return tx.recurringRule.findFirst({
      where: { ownerUserId, idempotencyKey },
      include: ruleInclude,
    });
  }

  async hasRuns(tx: Tx, ruleId: string): Promise<boolean> {
    return (await tx.recurringRun.count({ where: { ruleId }, take: 1 })) > 0;
  }

  findExecutableRule(tx: Tx, id: string) {
    return tx.recurringRule.findFirst({
      where: {
        id,
        status: 'ACTIVE',
        deletedAt: null,
        owner: { status: 'ACTIVE', deletedAt: null },
        ledger: {
          status: 'ACTIVE',
          deletedAt: null,
          members: { some: { status: 'ACTIVE' } },
        },
      },
      include: ruleInclude,
    });
  }

  createRule(
    tx: Tx,
    input: {
      ownerUserId: string;
      ledgerId: string;
      name: string;
      entryType: EntryType;
      amountCent: bigint;
      categoryId: string;
      frequency: RecurringFrequency;
      intervalValue: number;
      startDate: Date;
      endDate: Date | null;
      totalOccurrences: number | null;
      nextRunDate: Date;
      generationMode: GenerationMode;
      reminderDaysBefore: number;
      idempotencyKey: string;
      createRequestHash: string;
    },
  ) {
    return tx.recurringRule.create({ data: input, include: ruleInclude });
  }

  updateRule(
    tx: Tx,
    id: string,
    data: {
      name?: string;
      entryType?: EntryType;
      amountCent?: bigint;
      categoryId?: string;
      frequency?: RecurringFrequency;
      intervalValue?: number;
      startDate?: Date;
      endDate?: Date | null;
      totalOccurrences?: number | null;
      completedOccurrences?: number;
      nextRunDate?: Date | null;
      generationMode?: GenerationMode;
      status?: RecurringRuleStatus;
      reminderDaysBefore?: number;
      deletedAt?: Date;
    },
  ) {
    return tx.recurringRule.update({ where: { id }, data, include: ruleInclude });
  }

  async listRuns(
    tx: Tx,
    userId: string,
    input: { status?: RecurringRunStatus; page: number; pageSize: number },
  ): Promise<{ items: RecurringRunRecord[]; total: number }> {
    const where: Prisma.RecurringRunWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      rule: {
        deletedAt: null,
        ledger: {
          status: 'ACTIVE',
          deletedAt: null,
          members: { some: { userId, status: 'ACTIVE' } },
        },
      },
    };
    const items = await tx.recurringRun.findMany({
      where,
      include: runInclude,
      orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    });
    return { items, total: await tx.recurringRun.count({ where }) };
  }

  findVisibleRun(tx: Tx, userId: string, id: string) {
    return tx.recurringRun.findFirst({
      where: {
        id,
        rule: {
          deletedAt: null,
          ledger: {
            status: 'ACTIVE',
            deletedAt: null,
            members: { some: { userId, status: 'ACTIVE' } },
          },
        },
      },
      include: runInclude,
    });
  }

  findRunByRuleDate(tx: Tx, ruleId: string, scheduledDate: Date) {
    return tx.recurringRun.findUnique({
      where: { ruleId_scheduledDate: { ruleId, scheduledDate } },
      include: runInclude,
    });
  }

  findRunByConfirmationKey(tx: Tx, userId: string, idempotencyKey: string) {
    return tx.recurringRun.findFirst({
      where: { confirmationUserId: userId, confirmationIdempotencyKey: idempotencyKey },
      include: runInclude,
    });
  }

  createRun(
    tx: Tx,
    input: {
      id: string;
      ruleId: string;
      scheduledDate: Date;
      amountCent: bigint;
      status: RecurringRunStatus;
      entryId?: string | null;
      attempts: number;
      lastError?: string | null;
      lastAttemptAt: Date;
    },
  ) {
    return tx.recurringRun.create({ data: input, include: runInclude });
  }

  updateRun(
    tx: Tx,
    id: string,
    data: {
      amountCent?: bigint;
      status?: RecurringRunStatus;
      entryId?: string | null;
      attempts?: number;
      lastError?: string | null;
      lastAttemptAt?: Date;
      confirmedAt?: Date;
      confirmationUserId?: string;
      confirmationIdempotencyKey?: string;
      confirmationRequestHash?: string;
    },
  ) {
    return tx.recurringRun.update({ where: { id }, data, include: runInclude });
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
      note: string;
      sourceId: string;
      idempotencyKey: string;
      createRequestHash: string;
    },
  ) {
    return tx.entry.create({
      data: { ...input, sourceType: 'RECURRING_RUN', paymentMethod: null },
    });
  }

  audit(
    tx: Tx,
    input: {
      actorUserId?: string;
      actorType?: 'USER' | 'SYSTEM';
      action: string;
      targetType: 'RECURRING_RULE' | 'RECURRING_RUN';
      targetId: string;
      requestId?: string;
      beforeJson?: Prisma.InputJsonValue;
      afterJson?: Prisma.InputJsonValue;
    },
  ) {
    const { actorUserId, actorType = actorUserId ? 'USER' : 'SYSTEM', ...rest } = input;
    return tx.auditLog.create({
      data: { ...(actorUserId ? { actorUserId } : {}), actorType, ...rest },
    });
  }
}
