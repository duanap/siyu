import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from './auth';

const payload = {
  accessToken: 'access-token',
  expiresIn: 900,
  user: {
    id: 'user-id',
    nickname: '四时',
    avatarUrl: null,
    timezone: 'Asia/Shanghai',
    status: 'ACTIVE' as const,
    email: 'user@example.com',
    roles: ['USER'],
    permissions: ['profile:read'],
  },
};

describe('mobile authentication store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('restores authentication through the refresh cookie without persistent token storage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: payload, requestId: 'req_test' }), {
          status: 200,
        }),
      ),
    );
    const auth = useAuthStore();
    await auth.initialize();
    expect(auth.authenticated).toBe(true);
    expect(auth.user?.email).toBe('user@example.com');
    expect(localStorage.length).toBe(0);
  });

  it('clears local state when refresh fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ success: false, message: '失效' }), { status: 401 }),
        ),
    );
    const auth = useAuthStore();
    await auth.initialize();
    expect(auth.authenticated).toBe(false);
  });
});
