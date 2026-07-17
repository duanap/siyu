import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, sessionApiRequest, type ApiSession } from './api';

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status });
}

describe('authenticated API transport', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('single-flights refresh and replays concurrent requests once', async () => {
    let token = 'old';
    const refresh = vi.fn(async () => {
      token = 'new';
    });
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const authorization = (init?.headers as Record<string, string>)?.authorization;
      return authorization === 'Bearer new'
        ? response({ success: true, data: { ok: true }, requestId: 'req_ok' })
        : response(
            { success: false, code: 'AUTH_REQUIRED', message: 'expired', requestId: 'req_401' },
            401,
          );
    });
    vi.stubGlobal('fetch', fetchMock);
    const session: ApiSession = { accessToken: () => token, refresh, expire: vi.fn() };

    await Promise.all([
      sessionApiRequest('/entries?ledgerId=a', session),
      sessionApiRequest('/ledgers', session),
    ]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not recursively refresh authentication endpoints', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          response({ success: false, code: 'AUTH_REQUIRED', message: 'expired' }, 401),
        ),
    );
    const session: ApiSession = { accessToken: () => undefined, refresh: vi.fn(), expire: vi.fn() };
    await expect(
      sessionApiRequest('/auth/refresh', session, { method: 'POST' }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(session.refresh).not.toHaveBeenCalled();
  });

  it('replays at most once and expires after a second 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response({ success: false, code: 'AUTH_REQUIRED', message: 'expired' }, 401),
      );
    vi.stubGlobal('fetch', fetchMock);
    const session: ApiSession = {
      accessToken: () => 'expired',
      refresh: vi.fn().mockResolvedValue(undefined),
      expire: vi.fn(),
    };

    await expect(sessionApiRequest('/entries?ledgerId=a', session)).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(session.refresh).toHaveBeenCalledTimes(1);
    expect(session.expire).toHaveBeenCalledTimes(1);
  });

  it('expires without replay when refresh fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response({ success: false, code: 'AUTH_REQUIRED', message: 'expired' }, 401),
      );
    vi.stubGlobal('fetch', fetchMock);
    const refreshError = new Error('refresh failed');
    const session: ApiSession = {
      accessToken: () => 'expired',
      refresh: vi.fn().mockRejectedValue(refreshError),
      expire: vi.fn(),
    };

    await expect(sessionApiRequest('/entries?ledgerId=a', session)).rejects.toBe(refreshError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(session.expire).toHaveBeenCalledTimes(1);
  });

  it('respects AbortSignal before replay and does not expire the session', async () => {
    const controller = new AbortController();
    let release!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          response({ success: false, code: 'AUTH_REQUIRED', message: 'expired' }, 401),
        ),
    );
    const session: ApiSession = {
      accessToken: () => 'old',
      refresh: () => refreshGate,
      expire: vi.fn(),
    };
    const request = sessionApiRequest('/entries?ledgerId=a', session, {
      signal: controller.signal,
    });
    await Promise.resolve();
    controller.abort();
    release();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(session.expire).not.toHaveBeenCalled();
  });

  it('carries requestId on standard API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response(
          {
            success: false,
            code: 'ENTRY_VERSION_CONFLICT',
            message: 'conflict',
            requestId: 'req_conflict',
          },
          409,
        ),
      ),
    );
    const session: ApiSession = { accessToken: () => 'token', refresh: vi.fn(), expire: vi.fn() };
    await expect(sessionApiRequest('/entries/id', session)).rejects.toMatchObject({
      code: 'ENTRY_VERSION_CONFLICT',
      requestId: 'req_conflict',
    });
  });
});
