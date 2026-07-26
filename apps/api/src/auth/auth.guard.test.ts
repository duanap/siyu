import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../database/prisma.service';
import { AccessGuard } from './auth.guard';

function context(request: { header: (name: string) => string | undefined }) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe('AccessGuard', () => {
  it('uses current database roles instead of stale JWT claims', async () => {
    const request = { header: vi.fn().mockReturnValue('Bearer token') };
    const jwt = {
      verifyAsync: vi.fn().mockResolvedValue({
        sub: 'user-id',
        sid: 'session-id',
        roles: ['ADMIN'],
        permissions: ['admin:access'],
      }),
    };
    const prisma = {
      authSession: {
        findFirst: vi.fn().mockResolvedValue({
          user: {
            userRoles: [
              {
                role: {
                  code: 'USER',
                  rolePermissions: [{ permission: { code: 'entry:read' } }],
                },
              },
            ],
          },
        }),
      },
    } as unknown as PrismaService;
    const guard = new AccessGuard(jwt as never, prisma);

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request).toHaveProperty('auth', {
      userId: 'user-id',
      sessionId: 'session-id',
      roles: ['USER'],
      permissions: ['entry:read'],
    });
    expect(prisma.authSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ user: { status: 'ACTIVE', deletedAt: null } }),
      }),
    );
  });

  it('fails closed when the session or active user is absent', async () => {
    const request = { header: vi.fn().mockReturnValue('Bearer token') };
    const jwt = { verifyAsync: vi.fn().mockResolvedValue({ sub: 'user-id', sid: 'session-id' }) };
    const prisma = {
      authSession: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const guard = new AccessGuard(jwt as never, prisma);

    await expect(guard.canActivate(context(request))).rejects.toMatchObject({ status: 401 });
  });
});
