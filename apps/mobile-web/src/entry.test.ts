import { beforeEach, describe, expect, it, vi } from 'vitest';

import { amountTextToCent, entryApi, formatCent } from './entry';

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: status < 400, data, requestId: 'req_test' }), {
    status,
  });
}

describe('entry helpers and API', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('converts decimal text to integer cents without floating-point accumulation', () => {
    expect(amountTextToCent('0.01')).toBe(1);
    expect(amountTextToCent('128.5')).toBe(12_850);
    expect(amountTextToCent('8500.00')).toBe(850_000);
    expect(amountTextToCent('1.234')).toBeNull();
    expect(amountTextToCent('0')).toBeNull();
    expect(formatCent(850_001)).toBe('¥ 8,500.01');
  });

  it('serializes all approved list filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ items: [], total: 0 }));
    vi.stubGlobal('fetch', fetchMock);

    await entryApi.list(
      {
        ledgerId: 'ledger-id',
        month: '2026-07',
        type: 'EXPENSE',
        categoryId: 'category-id',
        creatorUserId: 'user-id',
        keyword: ' 早餐 ',
        page: 2,
        pageSize: 20,
      },
      'access-token',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/entries?ledgerId=ledger-id&month=2026-07&type=EXPENSE&categoryId=category-id&creatorUserId=user-id&keyword=%E6%97%A9%E9%A4%90&page=2&pageSize=20',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer access-token' }),
      }),
    );
  });

  it('reuses the supplied idempotency key and sends optimistic versions', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(response({ id: 'entry-id' }, 201)));
    vi.stubGlobal('fetch', fetchMock);
    const draft = {
      ledgerId: 'ledger-id',
      type: 'EXPENSE' as const,
      amountCent: 2_850,
      categoryId: 'category-id',
      businessDate: '2026-07-15',
      note: '早餐',
      paymentMethod: 'WECHAT' as const,
    };

    await entryApi.create(draft, 'token', 'entry-fixed-request');
    await entryApi.update('entry-id', { ...draft, expectedVersion: 3 }, 'token');
    await entryApi.delete('entry-id', 4, 'token');

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      ...draft,
      idempotencyKey: 'entry-fixed-request',
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).not.toHaveProperty('ledgerId');
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual(
      expect.objectContaining({ expectedVersion: 3 }),
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/v1/entries/entry-id?expectedVersion=4');
  });
});
