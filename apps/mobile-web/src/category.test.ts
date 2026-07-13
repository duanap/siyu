import { beforeEach, describe, expect, it, vi } from 'vitest';

import { categoryApi } from './category';

function response(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), { status: 200 });
}

describe('category API', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lists by ledger and type including disabled categories', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ items: [], permissions: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await categoryApi.list('ledger-id', 'EXPENSE', true, 'access-token');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/categories?ledgerId=ledger-id&type=EXPENSE&includeDisabled=true',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer access-token' }),
      }),
    );
  });

  it('creates with a client idempotency key and fixed visual values', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ id: 'category-id' }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'request-id' });

    await categoryApi.create(
      {
        ledgerId: 'ledger-id',
        type: 'EXPENSE',
        name: '旅行',
        icon: 'transport',
        color: '#3B82F6',
      },
      'access-token',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/categories',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          ledgerId: 'ledger-id',
          type: 'EXPENSE',
          name: '旅行',
          icon: 'transport',
          color: '#3B82F6',
          idempotencyKey: 'category-request-id',
        }),
      }),
    );
  });

  it('sends the complete order and explicit enable action', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(response({ items: [], permissions: {} })));
    vi.stubGlobal('fetch', fetchMock);

    await categoryApi.reorder('ledger-id', 'INCOME', ['a', 'b'], 'token');
    await categoryApi.setEnabled('category-id', true, 'token');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/categories/reorder',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ ledgerId: 'ledger-id', type: 'INCOME', categoryIds: ['a', 'b'] }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/categories/category-id/enable',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
