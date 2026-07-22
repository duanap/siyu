import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ApiSession } from './api';
import {
  createSavingGoalsApi,
  formatSavingCent,
  formatSavingProgress,
  parseSavingAmount,
} from './saving-goals';

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

describe('saving goals client', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads every goal page, keeps ledger scope and removes duplicates', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        calls.push(url);
        return Promise.resolve(
          ok(
            url.includes('page=1')
              ? {
                  items: [{ id: 'goal-1' }],
                  page: 1,
                  pageSize: 100,
                  total: 2,
                  hasNext: true,
                }
              : {
                  items: [{ id: 'goal-1' }, { id: 'goal-2' }],
                  page: 2,
                  pageSize: 100,
                  total: 2,
                  hasNext: false,
                },
          ),
        );
      }),
    );

    const result = await createSavingGoalsApi(session).listAll('ledger/1');

    expect(result.map((item) => item.id)).toEqual(['goal-1', 'goal-2']);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('ledgerId=ledger%2F1');
    expect(calls[1]).toContain('page=2');
  });

  it('encodes nested contribution paths and preserves the request body', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({ id: 'contribution-1' }, 201)));
    vi.stubGlobal('fetch', fetchMock);

    await createSavingGoalsApi(session).addContribution('goal/1', {
      amountCent: 12_345,
      businessDate: '2026-07-22',
      note: '本月结余',
      idempotencyKey: 'saving-contribution-request',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/saving-goals/goal%2F1/contributions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          amountCent: 12_345,
          businessDate: '2026-07-22',
          note: '本月结余',
          idempotencyKey: 'saving-contribution-request',
        }),
      }),
    );
  });
});

describe('saving goal amount and progress helpers', () => {
  it('converts yuan without floats and accepts zero only for initial savings', () => {
    expect(parseSavingAmount('1234.56')).toEqual({
      ok: true,
      amountCent: 123_456,
      normalized: '1234.56',
    });
    expect(parseSavingAmount('0')).toEqual({ ok: false, message: '金额必须大于 0' });
    expect(parseSavingAmount('0', true)).toEqual({ ok: true, amountCent: 0, normalized: '0' });
    expect(parseSavingAmount('1.234').ok).toBe(false);
    expect(parseSavingAmount('9,999').ok).toBe(false);
  });

  it('formats integer cents and basis points without inventing client progress', () => {
    expect(formatSavingCent(123_456)).toBe('¥ 1,234.56');
    expect(formatSavingCent(-123_456n)).toBe('-¥ 1,234.56');
    expect(formatSavingProgress(6_833)).toBe('68.33%');
    expect(formatSavingProgress(10_000)).toBe('100%');
  });
});
