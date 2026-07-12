import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisValues = new Map<string, string>();

vi.mock('ioredis', () => ({
  default: class FakeRedis {
    status = 'wait';

    async connect(): Promise<void> {
      this.status = 'ready';
    }

    async set(key: string, value: string): Promise<'OK'> {
      redisValues.set(key, value);
      return 'OK';
    }

    async getdel(key: string): Promise<string | null> {
      const value = redisValues.get(key) ?? null;
      redisValues.delete(key);
      return value;
    }

    async quit(): Promise<'OK'> {
      this.status = 'end';
      return 'OK';
    }
  },
}));

import { UnauthorizedException } from '@nestjs/common';

import type { PrismaService } from '../database/prisma.service';
import { OAuthService } from './oauth.service';

describe('OAuthService', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    redisValues.clear();
    process.env.SIYU_QQ_CLIENT_ID = 'qq-test-client';
    process.env.SIYU_QQ_CLIENT_SECRET = 'qq-test-secret';
    process.env.SIYU_QQ_CALLBACK_URL = 'http://localhost:8080/api/v1/auth/qq/callback';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.SIYU_QQ_CLIENT_ID;
    delete process.env.SIYU_QQ_CLIENT_SECRET;
    delete process.env.SIYU_QQ_CALLBACK_URL;
    vi.restoreAllMocks();
  });

  it('consumes state once and follows token, OpenID, profile order without leaking tokens', async () => {
    const requests: URL[] = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      requests.push(url);
      if (url.pathname.endsWith('/token'))
        return Response.json({ access_token: 'qq-access-token' });
      if (url.pathname.endsWith('/me')) return Response.json({ openid: 'qq-open-id' });
      return Response.json({ ret: 0, nickname: 'QQ 用户' });
    });
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'existing-user' }) },
    } as unknown as PrismaService;
    const service = new OAuthService(prisma);

    const state = await service.createState();
    await expect(service.consumeCallback('authorization-code', state)).resolves.toBe(
      'existing-user',
    );
    expect(requests.map((url) => url.pathname)).toEqual([
      '/oauth2.0/token',
      '/oauth2.0/me',
      '/user/get_user_info',
    ]);
    const [tokenRequest, openIdRequest, profileRequest] = requests;
    expect(tokenRequest).toBeDefined();
    expect(openIdRequest).toBeDefined();
    expect(profileRequest).toBeDefined();
    if (!tokenRequest || !openIdRequest || !profileRequest) throw new Error('QQ 请求链不完整');
    expect(tokenRequest.searchParams.get('redirect_uri')).toBe(
      'http://localhost:8080/api/v1/auth/qq/callback',
    );
    expect(tokenRequest.searchParams.has('need_openid')).toBe(false);
    expect(openIdRequest.searchParams.get('access_token')).toBe('qq-access-token');
    expect(profileRequest.searchParams.get('openid')).toBe('qq-open-id');
    await expect(service.consumeCallback('authorization-code', state)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await service.onModuleDestroy();
  });
});
