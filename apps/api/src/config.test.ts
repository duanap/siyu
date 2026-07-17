import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadEnvironmentFile, readConfig } from './config';

describe('readConfig', () => {
  it('uses safe local defaults without requiring secrets', () => {
    expect(readConfig({})).toEqual({
      port: 3000,
      corsOrigins: ['http://localhost:5173', 'http://localhost:5174'],
      redisUrl: 'redis://localhost:6379',
      databaseUrl: 'postgresql://siyu:siyu_local_only@localhost:5432/siyu?schema=public',
      jwtSecret: 'siyu-test-only-jwt-secret-change-me',
      publicUrl: 'http://localhost:5173',
      adminUrl: 'http://localhost:5174/admin/',
      isProduction: false,
      cookieSecure: false,
      qqClientId: undefined,
      qqClientSecret: undefined,
      qqCallbackUrl: undefined,
    });
  });

  it('requires a strong JWT secret in production', () => {
    expect(() => readConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
  });

  it('rejects invalid ports and origins', () => {
    expect(() => readConfig({ SIYU_API_PORT: '70000' })).toThrow();
    expect(() => readConfig({ SIYU_CORS_ORIGINS: 'not-a-url' })).toThrow();
  });

  it('loads an explicit native environment file without overriding existing values', () => {
    const directory = mkdtempSync(join(tmpdir(), 'siyu-env-'));
    const file = join(directory, '.env.native');
    const previous = process.env.SIYU_NATIVE_TEST_VALUE;
    try {
      delete process.env.SIYU_NATIVE_TEST_VALUE;
      writeFileSync(file, 'SIYU_NATIVE_TEST_VALUE=loaded\n', 'utf8');
      expect(loadEnvironmentFile(file)).toBe(file);
      expect(process.env.SIYU_NATIVE_TEST_VALUE).toBe('loaded');
    } finally {
      if (previous === undefined) delete process.env.SIYU_NATIVE_TEST_VALUE;
      else process.env.SIYU_NATIVE_TEST_VALUE = previous;
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
