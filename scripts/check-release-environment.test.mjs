import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectReleaseEnvironment } from './check-release-environment.mjs';
import { parseCliArguments, safeUrlSummary } from './release-utils.mjs';

function productionEnvironment() {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://siyu:secret@db.internal:5432/siyu?sslmode=require',
    REDIS_URL: 'rediss://cache.internal:6380',
    JWT_SECRET: 'a-secure-random-secret-with-more-than-32-characters',
    SIYU_COOKIE_SECURE: 'true',
    SIYU_PUBLIC_URL: 'https://siyu.test',
    SIYU_ADMIN_URL: 'https://siyu.test/admin/',
    SIYU_CORS_ORIGINS: 'https://siyu.test',
    SIYU_QQ_CLIENT_ID: 'real-client-id',
    SIYU_QQ_CLIENT_SECRET: 'real-client-secret',
    SIYU_QQ_CALLBACK_URL: 'https://siyu.test/api/v1/auth/qq/callback',
    SIYU_MAIL_PROVIDER: 'smtp',
    SIYU_API_HOST: '127.0.0.1',
    SIYU_GATEWAY_HOST: '127.0.0.1',
  };
}

test('release preflight redacts URLs and blocks the unimplemented production mail adapter', () => {
  const report = inspectReleaseEnvironment(productionEnvironment(), 'native');
  assert.equal(report.ok, false);
  assert.deepEqual(
    report.checks.filter((check) => !check.ok).map((check) => check.code),
    ['MAIL_PROVIDER'],
  );
  assert.equal(report.summary.database, 'postgresql://db.internal:5432/siyu');
  assert.equal(JSON.stringify(report).includes('secret@'), false);
  assert.equal(JSON.stringify(report).includes('real-client-secret'), false);
  assert.equal(
    safeUrlSummary('postgresql://siyu:secret@db.internal/siyu'),
    'postgresql://db.internal:5432/siyu',
  );
  assert.equal(
    safeUrlSummary('rediss://:secret@cache.internal/0'),
    'rediss://cache.internal:6379/0',
  );
  assert.deepEqual(
    parseCliArguments(['--', '--env-file', '/secure/siyu.env', '--mode', 'native'], {
      'env-file': 'value',
      mode: 'value',
    }),
    { 'env-file': '/secure/siyu.env', mode: 'native' },
  );
});

test('release preflight rejects unsafe origins, defaults, incomplete QQ and public listeners', () => {
  const environment = productionEnvironment();
  Object.assign(environment, {
    JWT_SECRET: 'siyu-native-local-jwt-secret-change-me',
    SIYU_COOKIE_SECURE: 'false',
    SIYU_PUBLIC_URL: 'http://siyu.example.com/path',
    SIYU_ADMIN_URL: 'https://admin.example.com/',
    SIYU_CORS_ORIGINS: '*',
    SIYU_QQ_CLIENT_SECRET: '',
    SIYU_QQ_CALLBACK_URL: 'https://evil.example.com/callback',
    SIYU_MAIL_PROVIDER: 'test',
    SIYU_API_HOST: '0.0.0.0',
  });
  const failedCodes = inspectReleaseEnvironment(environment, 'native')
    .checks.filter((check) => !check.ok)
    .map((check) => check.code);
  assert.deepEqual(failedCodes, [
    'JWT_SECRET',
    'COOKIE_SECURE',
    'PUBLIC_URL',
    'ADMIN_URL',
    'CORS_ORIGINS',
    'QQ_CREDENTIALS',
    'QQ_CALLBACK',
    'MAIL_PROVIDER',
    'NATIVE_API_HOST',
  ]);
});
