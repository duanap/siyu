import { describe, expect, it, vi } from 'vitest';

import { StatisticsRepository } from './statistics.repository';
import { statisticsPeriod, StatisticsService } from './statistics.service';

const userId = '00000000-0000-4000-8000-000000000001';
const partnerId = '00000000-0000-4000-8000-000000000002';
const ledgerId = '00000000-0000-4000-8000-000000000010';

function repositoryMock() {
  return {
    transaction: vi.fn(async (work: (tx: object) => Promise<unknown>) => work({})),
    findActor: vi.fn(async () => ({ id: userId, timezone: 'Asia/Shanghai' })),
    findLedgerContext: vi.fn(async () => ({
      id: ledgerId,
      type: 'COUPLE',
      ownerUserId: userId,
      name: '很长的共同账本名称',
      idempotencyKey: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      members: [
        {
          userId,
          role: 'OWNER',
          status: 'ACTIVE',
          user: { nickname: '朝暮', avatarUrl: null },
        },
        {
          userId: partnerId,
          role: 'MEMBER',
          status: 'ACTIVE',
          user: { nickname: '四时', avatarUrl: null },
        },
      ],
    })),
    overview: vi.fn(async () => [
      {
        type: 'INCOME',
        _sum: { amountCent: 800_000n },
        _max: { amountCent: 800_000n },
        _count: { _all: 1 },
      },
      {
        type: 'EXPENSE',
        _sum: { amountCent: 473_200n },
        _max: { amountCent: 220_000n },
        _count: { _all: 4 },
      },
    ]),
    trend: vi.fn(async () => [
      {
        businessDate: new Date('2024-02-02T00:00:00.000Z'),
        type: 'EXPENSE',
        _sum: { amountCent: 3_250n },
        _count: { _all: 1 },
      },
    ]),
    categories: vi.fn(async () => ({
      rows: [
        {
          categoryId: '00000000-0000-4000-8000-000000000020',
          _sum: { amountCent: 3_000n },
          _count: { _all: 2 },
        },
        {
          categoryId: '00000000-0000-4000-8000-000000000021',
          _sum: { amountCent: 1_000n },
          _count: { _all: 1 },
        },
      ],
      categories: [
        {
          id: '00000000-0000-4000-8000-000000000020',
          name: '住房',
          icon: 'home',
          color: '#5B7CFA',
          isEnabled: true,
        },
        {
          id: '00000000-0000-4000-8000-000000000021',
          name: '餐饮',
          icon: 'food',
          color: '#E85D5D',
          isEnabled: true,
        },
      ],
    })),
    members: vi.fn(async () => [
      {
        creatorUserId: userId,
        _sum: { amountCent: 2_500n },
        _count: { _all: 2 },
      },
      {
        creatorUserId: partnerId,
        _sum: { amountCent: 1_500n },
        _count: { _all: 1 },
      },
    ]),
  };
}

describe('TASK-009 statistics', () => {
  it('uses the user timezone for the current month and calendar-day average bounds', () => {
    const current = statisticsPeriod(undefined, 'Asia/Shanghai', new Date('2026-07-14T16:30:00Z'));
    expect(current.month).toBe('2026-07');
    expect(current.averageDayCount).toBe(15);
    expect(
      statisticsPeriod('2024-02', 'Asia/Shanghai', new Date('2026-07-15T00:00:00Z')),
    ).toMatchObject({ daysInMonth: 29, averageDayCount: 29 });
    expect(
      statisticsPeriod('2027-01', 'Asia/Shanghai', new Date('2026-07-15T00:00:00Z'))
        .averageDayCount,
    ).toBe(0);
  });

  it('returns exact integer overview values and excludes no rows in the service layer', async () => {
    const repository = repositoryMock();
    const service = new StatisticsService(repository as unknown as StatisticsRepository);
    await expect(service.overview(userId, { ledgerId, month: '2024-02' })).resolves.toEqual({
      ledgerId,
      ledgerType: 'COUPLE',
      month: '2024-02',
      incomeCent: 800_000,
      expenseCent: 473_200,
      balanceCent: 326_800,
      averageDailyExpenseCent: 16_317,
      largestExpenseCent: 220_000,
      entryCount: 5,
    });
  });

  it('fills the complete month trend with zero days', async () => {
    const repository = repositoryMock();
    const service = new StatisticsService(repository as unknown as StatisticsRepository);
    const result = (await service.trend(userId, { ledgerId, month: '2024-02' })) as {
      items: Array<{ date: string; incomeCent: number; expenseCent: number }>;
    };
    expect(result.items).toHaveLength(29);
    expect(result.items[0]).toEqual({ date: '2024-02-01', incomeCent: 0, expenseCent: 0 });
    expect(result.items[1]).toEqual({ date: '2024-02-02', incomeCent: 0, expenseCent: 3250 });
  });

  it('returns integer category and member basis points', async () => {
    const repository = repositoryMock();
    const service = new StatisticsService(repository as unknown as StatisticsRepository);
    await expect(service.categories(userId, { ledgerId, month: '2024-02' })).resolves.toEqual(
      expect.objectContaining({
        totalCent: 4000,
        items: [
          expect.objectContaining({ name: '住房', amountCent: 3000, basisPoints: 7500 }),
          expect.objectContaining({ name: '餐饮', amountCent: 1000, basisPoints: 2500 }),
        ],
      }),
    );
    await expect(service.members(userId, { ledgerId, month: '2024-02' })).resolves.toEqual(
      expect.objectContaining({
        totalCent: 4000,
        items: [
          expect.objectContaining({ userId, amountCent: 2500, basisPoints: 6250 }),
          expect.objectContaining({ userId: partnerId, amountCent: 1500, basisPoints: 3750 }),
        ],
      }),
    );
  });
});
