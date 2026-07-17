import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { EntryType } from '@prisma/client';

import type { StatisticsQueryDto } from './statistics.dto';
import { StatisticsRepository, type StatisticsLedgerContext } from './statistics.repository';

type AggregateRow = {
  type: EntryType;
  _sum: { amountCent: bigint | null };
  _max: { amountCent: bigint | null };
  _count: { _all: number };
};

function invisible(): NotFoundException {
  return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: '账本不存在' });
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function zonedDateParts(timezone: string, now: Date): { year: number; month: number; day: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const value = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((part) => part.type === type)?.value);
    const result = { year: value('year'), month: value('month'), day: value('day') };
    if (Object.values(result).every(Number.isInteger)) return result;
  } catch {
    // Invalid legacy timezones fall back to the current documented default.
  }
  return zonedDateParts('Asia/Shanghai', now);
}

export function statisticsPeriod(
  requestedMonth: string | undefined,
  timezone: string,
  now = new Date(),
): {
  month: string;
  startDate: Date;
  endDate: Date;
  daysInMonth: number;
  averageDayCount: number;
} {
  const current = zonedDateParts(timezone, now);
  const currentMonth = `${current.year}-${String(current.month).padStart(2, '0')}`;
  const month = requestedMonth ?? currentMonth;
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const startDate = new Date(Date.UTC(year, monthNumber - 1, 1));
  const endDate = new Date(Date.UTC(year, monthNumber, 1));
  const daysInMonth = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
  const averageDayCount =
    month < currentMonth ? daysInMonth : month === currentMonth ? current.day : 0;
  return { month, startDate, endDate, daysInMonth, averageDayCount };
}

function toSafeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new InternalServerErrorException({
      code: 'STATISTICS_AMOUNT_OVERFLOW',
      message: '统计金额超出安全返回范围',
    });
  }
  return Number(value);
}

function validAccess(userId: string, ledger: StatisticsLedgerContext): boolean {
  const membership = ledger.members.find(
    (member) => member.userId === userId && member.status === 'ACTIVE',
  );
  if (!membership) return false;
  return ledger.type === 'COUPLE' || (membership.role === 'OWNER' && ledger.ownerUserId === userId);
}

function basisPoints(amountCent: bigint, totalCent: bigint): number {
  return totalCent === 0n ? 0 : Number((amountCent * 10_000n) / totalCent);
}

@Injectable()
export class StatisticsService {
  constructor(@Inject(StatisticsRepository) private readonly repository: StatisticsRepository) {}

  async overview(userId: string, query: StatisticsQueryDto): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.repository.findActor(tx, userId);
      const ledger = await this.repository.findLedgerContext(tx, userId, query.ledgerId);
      if (!actor || !ledger || !validAccess(userId, ledger)) throw invisible();
      const period = statisticsPeriod(query.month, actor.timezone);
      const rows = (await this.repository.overview(
        tx,
        ledger.id,
        period.startDate,
        period.endDate,
      )) as AggregateRow[];
      const income = rows.find((row) => row.type === 'INCOME');
      const expense = rows.find((row) => row.type === 'EXPENSE');
      const incomeCent = income?._sum.amountCent ?? 0n;
      const expenseCent = expense?._sum.amountCent ?? 0n;
      const averageDailyExpenseCent =
        period.averageDayCount === 0 ? 0n : expenseCent / BigInt(period.averageDayCount);
      return {
        ledgerId: ledger.id,
        ledgerType: ledger.type,
        month: period.month,
        incomeCent: toSafeNumber(incomeCent),
        expenseCent: toSafeNumber(expenseCent),
        balanceCent: toSafeNumber(incomeCent - expenseCent),
        averageDailyExpenseCent: toSafeNumber(averageDailyExpenseCent),
        largestExpenseCent: toSafeNumber(expense?._max.amountCent ?? 0n),
        entryCount: rows.reduce((total, row) => total + row._count._all, 0),
      };
    });
  }

  async trend(userId: string, query: StatisticsQueryDto): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.repository.findActor(tx, userId);
      const ledger = await this.repository.findLedgerContext(tx, userId, query.ledgerId);
      if (!actor || !ledger || !validAccess(userId, ledger)) throw invisible();
      const period = statisticsPeriod(query.month, actor.timezone);
      const rows = await this.repository.trend(tx, ledger.id, period.startDate, period.endDate);
      const byDate = new Map<string, { incomeCent: bigint; expenseCent: bigint }>();
      for (const row of rows) {
        const date = dateOnly(row.businessDate);
        const item = byDate.get(date) ?? { incomeCent: 0n, expenseCent: 0n };
        item[row.type === 'INCOME' ? 'incomeCent' : 'expenseCent'] = row._sum.amountCent ?? 0n;
        byDate.set(date, item);
      }
      const items = Array.from({ length: period.daysInMonth }, (_, index) => {
        const date = dateOnly(
          new Date(
            Date.UTC(period.startDate.getUTCFullYear(), period.startDate.getUTCMonth(), index + 1),
          ),
        );
        const item = byDate.get(date) ?? { incomeCent: 0n, expenseCent: 0n };
        return {
          date,
          incomeCent: toSafeNumber(item.incomeCent),
          expenseCent: toSafeNumber(item.expenseCent),
        };
      });
      return { ledgerId: ledger.id, ledgerType: ledger.type, month: period.month, items };
    });
  }

  async categories(userId: string, query: StatisticsQueryDto): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.repository.findActor(tx, userId);
      const ledger = await this.repository.findLedgerContext(tx, userId, query.ledgerId);
      if (!actor || !ledger || !validAccess(userId, ledger)) throw invisible();
      const period = statisticsPeriod(query.month, actor.timezone);
      const result = await this.repository.categories(
        tx,
        ledger.id,
        period.startDate,
        period.endDate,
      );
      const categoryById = new Map(result.categories.map((category) => [category.id, category]));
      const totalCent = result.rows.reduce((total, row) => total + (row._sum.amountCent ?? 0n), 0n);
      const items = result.rows.map((row) => {
        const category = categoryById.get(row.categoryId);
        if (!category) throw new InternalServerErrorException('统计分类不存在');
        const amountCent = row._sum.amountCent ?? 0n;
        return {
          categoryId: category.id,
          name: category.name,
          icon: category.icon,
          color: category.color,
          isEnabled: category.isEnabled,
          amountCent: toSafeNumber(amountCent),
          basisPoints: basisPoints(amountCent, totalCent),
          entryCount: row._count._all,
        };
      });
      return {
        ledgerId: ledger.id,
        ledgerType: ledger.type,
        month: period.month,
        type: 'EXPENSE',
        totalCent: toSafeNumber(totalCent),
        items,
      };
    });
  }

  async members(userId: string, query: StatisticsQueryDto): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.repository.findActor(tx, userId);
      const ledger = await this.repository.findLedgerContext(tx, userId, query.ledgerId);
      if (!actor || !ledger || !validAccess(userId, ledger)) throw invisible();
      const period = statisticsPeriod(query.month, actor.timezone);
      const rows = await this.repository.members(tx, ledger.id, period.startDate, period.endDate);
      const byUser = new Map(rows.map((row) => [row.creatorUserId, row]));
      const visibleMembers =
        ledger.type === 'PERSONAL'
          ? ledger.members.filter((member) => member.userId === userId)
          : ledger.members.filter(
              (member) => member.status === 'ACTIVE' || byUser.has(member.userId),
            );
      const totalCent = rows.reduce((total, row) => total + (row._sum.amountCent ?? 0n), 0n);
      const items = visibleMembers
        .map((member) => {
          const row = byUser.get(member.userId);
          const amountCent = row?._sum.amountCent ?? 0n;
          return {
            userId: member.userId,
            nickname: member.user.nickname,
            avatarUrl: member.user.avatarUrl,
            memberStatus: member.status,
            isCurrentUser: member.userId === userId,
            amountCent: toSafeNumber(amountCent),
            basisPoints: basisPoints(amountCent, totalCent),
            entryCount: row?._count._all ?? 0,
          };
        })
        .sort(
          (left, right) =>
            right.amountCent - left.amountCent || left.userId.localeCompare(right.userId),
        );
      return {
        ledgerId: ledger.id,
        ledgerType: ledger.type,
        month: period.month,
        totalCent: toSafeNumber(totalCent),
        items,
      };
    });
  }
}
