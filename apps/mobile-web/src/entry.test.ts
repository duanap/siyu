import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiSession } from './api';
import { createEntryApi } from './entry';

function response(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, requestId: 'req_test' }), {
    status: 200,
  });
}

describe('entry API client', () => {
  beforeEach(() => vi.restoreAllMocks());
  const session: ApiSession = { accessToken: () => 'token', refresh: vi.fn(), expire: vi.fn() };

  it('serializes list filters and cancellation signal', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ items: [], page: 1, pageSize: 20, total: 0, hasNext: false }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    await createEntryApi(session).list(
      { ledgerId: 'ledger', month: '2026-07', type: 'EXPENSE', keyword: '早餐', page: 2 },
      controller.signal,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/entries?ledgerId=ledger&month=2026-07&type=EXPENSE&keyword=%E6%97%A9%E9%A4%90&page=2',
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('keeps client fields constrained for create, update and delete', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response({ id: 'entry' })));
    vi.stubGlobal('fetch', fetchMock);
    const api = createEntryApi(session);
    await api.create({
      ledgerId: 'ledger',
      type: 'EXPENSE',
      amountCent: 123,
      categoryId: 'category',
      businessDate: '2026-07-14',
      note: null,
      paymentMethod: null,
      idempotencyKey: 'entry-request',
    });
    await api.update('entry', { expectedVersion: 2, note: 'updated' });
    await api.delete('entry', 3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/entries',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/entries/entry',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ expectedVersion: 2, note: 'updated' }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/entries/entry?expectedVersion=3',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
