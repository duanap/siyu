import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiSession } from './api';
import {
  createRecurringApi,
  generationModeLabel,
  recurringFrequencyLabel,
  recurringProgressLabel,
  recurringRunStatusLabel,
  recurringStatusLabel,
  type RecurringRule,
} from './recurring';

const session: ApiSession = {
  accessToken: () => 'token',
  refresh: vi.fn(),
  expire: vi.fn(),
};

function response(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, requestId: 'request-1' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const rule = {
  id: '11111111-1111-4111-8111-111111111111',
  ledgerId: '22222222-2222-4222-8222-222222222222',
  completedOccurrences: 4,
  totalOccurrences: 12,
} as RecurringRule;

describe('recurring api and labels', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('loads every rule page with a ledger boundary and de-duplicates items', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ items: [rule], page: 1, pageSize: 100, total: 2, hasNext: true }),
      )
      .mockResolvedValueOnce(
        response({
          items: [rule, { ...rule, id: '33333333-3333-4333-8333-333333333333' }],
          page: 2,
          pageSize: 100,
          total: 2,
          hasNext: false,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const items = await createRecurringApi(session).listAllRules(rule.ledgerId);

    expect(items.map((item) => item.id)).toEqual([rule.id, '33333333-3333-4333-8333-333333333333']);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(`ledgerId=${rule.ledgerId}`);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('page=2');
  });

  it('sends confirmation amount and idempotency key to the encoded run path', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response({ id: 'run-1', status: 'CONFIRMED' })));
    vi.stubGlobal('fetch', fetchMock);

    await createRecurringApi(session).confirmRun('run/id', {
      amountCent: 8800,
      idempotencyKey: 'recurring-confirm-test',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/recurring-runs/run%2Fid/confirm',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ amountCent: 8800, idempotencyKey: 'recurring-confirm-test' }),
      }),
    );
  });

  it('formats rule and run facts without deriving permissions', () => {
    expect(recurringStatusLabel('PAUSED')).toBe('已暂停');
    expect(recurringRunStatusLabel('FAILED')).toBe('生成失败');
    expect(recurringFrequencyLabel('MONTHLY', 1)).toBe('每月');
    expect(recurringFrequencyLabel('YEARLY', 2)).toBe('每 2 年');
    expect(generationModeLabel('CONFIRM')).toBe('到期确认');
    expect(recurringProgressLabel(rule)).toBe('第 5/12 期 · 已执行 4 期');
  });
});
