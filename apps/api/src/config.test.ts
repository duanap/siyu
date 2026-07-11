import { describe, expect, it } from 'vitest';

import { readConfig } from './config';

describe('readConfig', () => {
  it('uses safe local defaults without requiring secrets', () => {
    expect(readConfig({})).toEqual({
      port: 3000,
      corsOrigins: ['http://localhost:5173', 'http://localhost:5174'],
      redisUrl: 'redis://localhost:6379',
    });
  });

  it('rejects invalid ports and origins', () => {
    expect(() => readConfig({ SIYU_API_PORT: '70000' })).toThrow();
    expect(() => readConfig({ SIYU_CORS_ORIGINS: 'not-a-url' })).toThrow();
  });
});
