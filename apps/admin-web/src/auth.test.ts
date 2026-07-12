import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from './auth';

describe('admin authentication store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('rejects a valid ordinary user from the administration application', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                accessToken: 'token',
                expiresIn: 900,
                user: {
                  id: 'id',
                  nickname: '用户',
                  email: 'u@example.com',
                  permissions: ['profile:read'],
                },
              },
            }),
            { status: 200 },
          ),
        ),
      ),
    );
    const auth = useAuthStore();
    await expect(auth.login('u@example.com', 'safe-password-1234')).rejects.toThrow(
      '没有管理端访问权限',
    );
    expect(auth.authenticated).toBe(false);
  });
});
