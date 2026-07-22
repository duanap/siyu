import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, SalaryItemType } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';

type Tx = Prisma.TransactionClient;

const profileInclude = {
  items: { orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }] },
} satisfies Prisma.SalaryProfileInclude;
const recordInclude = {
  profile: { select: { id: true, name: true, employerName: true, payDay: true } },
  items: { orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }] },
} satisfies Prisma.SalaryRecordInclude;

export type SalaryProfileRecord = Prisma.SalaryProfileGetPayload<{
  include: typeof profileInclude;
}>;
export type SalaryRecordRecord = Prisma.SalaryRecordGetPayload<{ include: typeof recordInclude }>;
export type SalaryItemInput = {
  itemType: SalaryItemType;
  itemCode: string;
  itemName: string;
  amountCent: bigint;
  sortOrder: number;
};

@Injectable()
export class SalaryRepository {
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
      select: { id: true, status: true, timezone: true },
    });
  }

  listProfiles(tx: Tx, userId: string) {
    return tx.salaryProfile.findMany({
      where: { userId, deletedAt: null },
      include: profileInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  findProfile(tx: Tx, userId: string, id: string) {
    return tx.salaryProfile.findFirst({
      where: { id, userId, deletedAt: null },
      include: profileInclude,
    });
  }

  findActiveProfile(tx: Tx, userId: string) {
    return tx.salaryProfile.findFirst({
      where: { userId, status: 'ACTIVE', deletedAt: null },
      include: profileInclude,
    });
  }

  findProfileByIdempotency(tx: Tx, userId: string, idempotencyKey: string) {
    return tx.salaryProfile.findFirst({
      where: { userId, idempotencyKey },
      include: profileInclude,
    });
  }

  createProfile(
    tx: Tx,
    input: {
      userId: string;
      name: string;
      employerName: string | null;
      payDay: number;
      defaultSyncEntry: boolean;
      idempotencyKey: string;
      createRequestHash: string;
      items: SalaryItemInput[];
    },
  ) {
    const { items, ...data } = input;
    return tx.salaryProfile.create({
      data: { ...data, items: { create: items } },
      include: profileInclude,
    });
  }

  updateProfile(
    tx: Tx,
    id: string,
    data: {
      name?: string;
      employerName?: string | null;
      payDay?: number;
      defaultSyncEntry?: boolean;
      items?: SalaryItemInput[];
    },
  ) {
    const { items, ...profile } = data;
    return tx.salaryProfile.update({
      where: { id },
      data: {
        ...profile,
        ...(items ? { items: { deleteMany: {}, create: items } } : {}),
      },
      include: profileInclude,
    });
  }

  async listRecords(
    tx: Tx,
    userId: string,
    input: { page: number; pageSize: number; year?: number; profileId?: string },
  ): Promise<{ items: SalaryRecordRecord[]; total: number }> {
    const where: Prisma.SalaryRecordWhereInput = {
      userId,
      deletedAt: null,
      ...(input.profileId ? { profileId: input.profileId } : {}),
      ...(input.year
        ? {
            salaryMonth: {
              gte: new Date(`${input.year}-01-01T00:00:00.000Z`),
              lt: new Date(`${input.year + 1}-01-01T00:00:00.000Z`),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      tx.salaryRecord.findMany({
        where,
        include: recordInclude,
        orderBy: [{ salaryMonth: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      tx.salaryRecord.count({ where }),
    ]);
    return { items, total };
  }

  findRecord(tx: Tx, userId: string, id: string) {
    return tx.salaryRecord.findFirst({
      where: { id, userId, deletedAt: null },
      include: recordInclude,
    });
  }

  findRecordByIdempotency(tx: Tx, userId: string, idempotencyKey: string) {
    return tx.salaryRecord.findFirst({
      where: { userId, idempotencyKey },
      include: recordInclude,
    });
  }

  findRecordByMonth(tx: Tx, userId: string, profileId: string, salaryMonth: Date) {
    return tx.salaryRecord.findFirst({
      where: { userId, profileId, salaryMonth, deletedAt: null },
      include: recordInclude,
    });
  }

  findRecordByPaymentIdempotency(tx: Tx, userId: string, paymentIdempotencyKey: string) {
    return tx.salaryRecord.findFirst({
      where: { userId, paymentIdempotencyKey },
      include: recordInclude,
    });
  }

  listAnnualRecords(tx: Tx, userId: string, year: number) {
    return tx.salaryRecord.findMany({
      where: {
        userId,
        deletedAt: null,
        salaryMonth: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lt: new Date(Date.UTC(year + 1, 0, 1)),
        },
      },
      include: recordInclude,
      orderBy: [{ salaryMonth: 'asc' }, { id: 'asc' }],
    });
  }

  findCurrentPaidRecord(tx: Tx, userId: string, today: Date) {
    return tx.salaryRecord.findFirst({
      where: {
        userId,
        deletedAt: null,
        paymentStatus: 'PAID',
        paidDate: { lte: today },
      },
      include: recordInclude,
      orderBy: [{ paidDate: 'desc' }, { salaryMonth: 'desc' }, { id: 'desc' }],
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

  findSalaryCategory(tx: Tx, ledgerId: string) {
    return tx.category.findFirst({
      where: { ledgerId, type: 'INCOME', templateKey: 'income.salary', isEnabled: true },
      select: { id: true },
    });
  }

  salaryCycleExpenses(tx: Tx, ledgerId: string, startDate: Date, endDate: Date) {
    return tx.entry.groupBy({
      by: ['sourceType'],
      where: {
        ledgerId,
        type: 'EXPENSE',
        deletedAt: null,
        businessDate: { gte: startDate, lt: endDate },
      },
      _sum: { amountCent: true },
    });
  }

  createSalaryEntry(
    tx: Tx,
    input: {
      ledgerId: string;
      creatorUserId: string;
      amountCent: bigint;
      categoryId: string;
      businessDate: Date;
      sourceId: string;
      idempotencyKey: string;
      createRequestHash: string;
    },
  ) {
    return tx.entry.create({
      data: {
        ...input,
        type: 'INCOME',
        note: '工资到账',
        paymentMethod: null,
        sourceType: 'SALARY',
      },
      select: { id: true },
    });
  }

  createRecord(
    tx: Tx,
    input: {
      userId: string;
      profileId: string;
      salaryMonth: Date;
      grossCent: bigint;
      deductionCent: bigint;
      netCent: bigint;
      idempotencyKey: string;
      createRequestHash: string;
      items: SalaryItemInput[];
    },
  ) {
    const { items, ...data } = input;
    return tx.salaryRecord.create({
      data: { ...data, items: { create: items } },
      include: recordInclude,
    });
  }

  updateRecord(
    tx: Tx,
    id: string,
    input: {
      grossCent: bigint;
      deductionCent: bigint;
      netCent: bigint;
      items: SalaryItemInput[];
    },
  ) {
    const { items, ...totals } = input;
    return tx.salaryRecord.update({
      where: { id },
      data: { ...totals, items: { deleteMany: {}, create: items } },
      include: recordInclude,
    });
  }

  markRecordPaid(
    tx: Tx,
    id: string,
    input: {
      paidDate: Date;
      entryId: string | null;
      paymentIdempotencyKey: string;
      paymentRequestHash: string;
    },
  ) {
    return tx.salaryRecord.update({
      where: { id },
      data: { paymentStatus: 'PAID', ...input },
      include: recordInclude,
    });
  }

  audit(
    tx: Tx,
    input: {
      actorUserId: string;
      action: string;
      targetType: 'SALARY_PROFILE' | 'SALARY_RECORD';
      targetId: string;
      requestId: string;
      afterJson: Prisma.InputJsonValue;
    },
  ) {
    return tx.auditLog.create({ data: { actorType: 'USER', ...input } });
  }
}
