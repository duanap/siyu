import { beforeEach, describe, expect, it, vi } from 'vitest';

import { coupleLedgerApi } from './couple-ledger';

describe('couple ledger API', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends an access token and a unique idempotency key when creating a ledger', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: 'ledger-id', type: 'COUPLE', name: '朝暮同笺', members: [] },
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'request-id' });

    await coupleLedgerApi.create('朝暮同笺', 'access-token');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/couple-ledgers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer access-token' }),
        body: JSON.stringify({ name: '朝暮同笺', idempotencyKey: 'ledger-request-id' }),
      }),
    );
  });

  it('preserves the server permission code for no-access states', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            code: 'LEDGER_PERMISSION_DENIED',
            message: '无权访问',
          }),
          { status: 403 },
        ),
      ),
    );

    await expect(coupleLedgerApi.list('access-token')).rejects.toEqual(
      expect.objectContaining({ status: 403, code: 'LEDGER_PERMISSION_DENIED' }),
    );
  });
});
