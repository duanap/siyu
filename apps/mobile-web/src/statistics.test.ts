import { beforeEach, describe, expect, it, vi } from 'vitest';

import { statisticsApi } from './statistics';

function response(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, requestId: 'req_test' }));
}

describe('TASK-009 statistics API', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends the same ledger and month to every statistics endpoint', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response({ items: [] })));
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([
      statisticsApi.overview('ledger id', '2026-07', 'token'),
      statisticsApi.trend('ledger id', '2026-07', 'token'),
      statisticsApi.categories('ledger id', '2026-07', 'token'),
      statisticsApi.members('ledger id', '2026-07', 'token'),
    ]);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/statistics/overview?ledgerId=ledger+id&month=2026-07',
      '/api/v1/statistics/trend?ledgerId=ledger+id&month=2026-07',
      '/api/v1/statistics/categories?ledgerId=ledger+id&month=2026-07',
      '/api/v1/statistics/members?ledgerId=ledger+id&month=2026-07',
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer token' }),
      }),
    );
  });
});
