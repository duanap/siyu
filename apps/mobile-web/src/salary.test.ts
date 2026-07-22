import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ApiSession } from './api';
import {
  createSalaryApi,
  editableSalaryItems,
  formatSalaryCent,
  parseSalaryAmount,
  parseSalaryRoute,
  salaryItemsInput,
  salaryMonthDate,
} from './salary';

function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data, requestId: 'request-1' }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const session: ApiSession = {
  accessToken: () => 'token',
  refresh: vi.fn(),
  expire: vi.fn(),
};

describe('salary client', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads every salary record page and removes duplicate records', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        calls.push(url);
        const item = { id: 'record-1' };
        return Promise.resolve(
          ok(
            url.includes('page=1')
              ? { items: [item], page: 1, pageSize: 100, total: 2, hasNext: true }
              : {
                  items: [item, { id: 'record-2' }],
                  page: 2,
                  pageSize: 100,
                  total: 2,
                  hasNext: false,
                },
          ),
        );
      }),
    );

    const result = await createSalaryApi(session).listAllRecords({
      year: 2026,
      profileId: 'profile-1',
    });

    expect(result.map((item) => item.id)).toEqual(['record-1', 'record-2']);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('year=2026');
    expect(calls[1]).toContain('page=2');
  });

  it('keeps mark-paid facts and the idempotency key in the request body', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ id: 'record-1' })));
    vi.stubGlobal('fetch', fetchMock);

    await createSalaryApi(session).markPaid('record/1', {
      paidDate: '2026-07-10',
      syncEntry: true,
      idempotencyKey: 'salary-paid-request',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/salary/records/record%2F1/mark-paid',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          paidDate: '2026-07-10',
          syncEntry: true,
          idempotencyKey: 'salary-paid-request',
        }),
      }),
    );
  });
});

describe('salary form helpers', () => {
  it('converts yuan precisely and rejects malformed or unsafe amounts', () => {
    expect(parseSalaryAmount('1234.56', false)).toEqual({ ok: true, amountCent: 123_456 });
    expect(parseSalaryAmount('0', false)).toEqual({ ok: false, message: '金额必须大于 0' });
    expect(parseSalaryAmount('1.234', true).ok).toBe(false);
    expect(formatSalaryCent(-123_456)).toBe('-¥ 1,234.56');
  });

  it('omits zero monthly rows while retaining zero-value template rows', () => {
    const editable = editableSalaryItems([
      {
        itemType: 'EARNING',
        itemCode: 'base_salary',
        itemName: '基本工资',
        amountCent: 500_000,
        sortOrder: 0,
      },
      {
        itemType: 'DEDUCTION',
        itemCode: 'income_tax',
        itemName: '个人所得税',
        amountCent: 0,
        sortOrder: 1,
      },
    ]);

    const monthly = salaryItemsInput(editable, false);
    const template = salaryItemsInput(editable, true);

    expect(monthly.ok && monthly.items).toHaveLength(1);
    expect(template.ok && template.items).toHaveLength(2);
  });

  it('validates route years and zero-padded months', () => {
    expect(parseSalaryRoute('2026', '07')).toEqual({ year: 2026, month: 7 });
    expect(parseSalaryRoute('2026', '7')).toBeNull();
    expect(parseSalaryRoute('1999')).toBeNull();
    expect(salaryMonthDate(2026, 7)).toBe('2026-07-01');
  });
});
