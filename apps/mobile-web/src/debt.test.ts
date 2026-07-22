import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebtApi, summarizeDebts, type Debt } from './debt';

function debt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: crypto.randomUUID(),
    direction: 'BORROWED',
    counterpartyName: '张三',
    principalCent: 10_000,
    processedCent: 2_000,
    remainingCent: 8_000,
    startDate: '2026-07-01',
    dueDate: '2026-07-25',
    status: 'ACTIVE',
    overdueDays: 0,
    note: null,
    reminderEnabled: false,
    canEdit: true,
    canDelete: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    transactions: [],
    ...overrides,
  };
}

describe('debt helpers', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('summarizes complete remaining, monthly and due-state facts', () => {
    const borrowed = debt({
      transactions: [
        {
          id: crypto.randomUUID(),
          debtId: 'debt-1',
          userId: 'user-1',
          amountCent: 2_000,
          businessDate: '2026-07-10',
          syncEntry: true,
          entryId: crypto.randomUUID(),
          note: null,
          createdAt: '2026-07-10T00:00:00.000Z',
        },
      ],
    });
    const lent = debt({
      direction: 'LENT',
      principalCent: 5_000,
      processedCent: 1_000,
      remainingCent: 4_000,
      dueDate: '2026-07-15',
      overdueDays: 3,
      status: 'OVERDUE',
      transactions: [
        {
          id: crypto.randomUUID(),
          debtId: 'debt-2',
          userId: 'user-1',
          amountCent: 1_000,
          businessDate: '2026-07-08',
          syncEntry: false,
          entryId: null,
          note: null,
          createdAt: '2026-07-08T00:00:00.000Z',
        },
      ],
    });
    expect(summarizeDebts([borrowed, lent], '2026-07', '2026-07-22')).toEqual({
      totalDebtCent: 8_000,
      totalReceivableCent: 4_000,
      paidThisMonthCent: 2_000,
      receivedThisMonthCent: 1_000,
      dueSoonCount: 1,
      overdueCount: 1,
    });

    expect(
      summarizeDebts([debt({ dueDate: '2026-07-29' })], '2026-07', '2026-07-22').dueSoonCount,
    ).toBe(0);
  });

  it('loads every page before returning list data', async () => {
    const fetchMock = vi.fn((url: string) => {
      const page = new URL(url, 'https://example.test').searchParams.get('page');
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              items: [debt({ counterpartyName: page === '1' ? '第一页' : '第二页' })],
              page: Number(page),
              pageSize: 100,
              total: 2,
              hasNext: page === '1',
            },
            requestId: 'request-1',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const api = createDebtApi({ accessToken: () => 'token', refresh: vi.fn(), expire: vi.fn() });

    const result = await api.listAll();

    expect(result.map((item) => item.counterpartyName)).toEqual(['第一页', '第二页']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
