import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { once } from 'node:events';

import { startNativeGateway } from './native-gateway.mjs';
import { nativeServiceTargets, validateNativeConfiguration } from './native-runtime.mjs';

test('native service targets parse PostgreSQL and secure Redis without exposing credentials', () => {
  const targets = nativeServiceTargets({
    DATABASE_URL: 'postgresql://user:secret@db.example.com:5433/siyu?schema=public',
    REDIS_URL: 'rediss://default:secret@redis.example.com:6380',
  });
  assert.deepEqual(
    targets.map(({ label, host, port }) => ({ label, host, port })),
    [
      { label: 'DATABASE_URL', host: 'db.example.com', port: 5433 },
      { label: 'REDIS_URL', host: 'redis.example.com', port: 6380 },
    ],
  );
  assert.equal(
    targets.some((target) => target.display.includes('secret')),
    false,
  );
});

test('production native configuration requires public URL and strong JWT secret', () => {
  assert.throws(
    () =>
      validateNativeConfiguration({
        NODE_ENV: 'production',
        JWT_SECRET: 'short',
        SIYU_PUBLIC_URL: 'https://siyu.example.com',
      }),
    /JWT_SECRET/,
  );
  assert.throws(
    () =>
      validateNativeConfiguration({
        NODE_ENV: 'production',
        JWT_SECRET: 'siyu-native-local-jwt-secret-change-me',
        SIYU_COOKIE_SECURE: 'true',
        SIYU_PUBLIC_URL: 'https://siyu.example.com',
      }),
    /JWT_SECRET/,
  );
  assert.throws(
    () =>
      validateNativeConfiguration({
        NODE_ENV: 'production',
        JWT_SECRET: 'production-secret-that-is-long-enough-to-use',
        SIYU_COOKIE_SECURE: 'false',
        SIYU_PUBLIC_URL: 'https://siyu.example.com',
      }),
    /SIYU_COOKIE_SECURE/,
  );
  assert.throws(
    () =>
      validateNativeConfiguration({
        NODE_ENV: 'production',
        JWT_SECRET: 'production-secret-that-is-long-enough-to-use',
        SIYU_COOKIE_SECURE: 'true',
        SIYU_PUBLIC_URL: 'https://siyu.example.com',
        SIYU_MAIL_PROVIDER: 'test',
      }),
    /SIYU_MAIL_PROVIDER/,
  );
});

test('production native personal profile accepts explicitly disabled external authentication', () => {
  assert.doesNotThrow(() =>
    validateNativeConfiguration({
      NODE_ENV: 'production',
      JWT_SECRET: 'a-production-secret-with-at-least-32-characters',
      SIYU_COOKIE_SECURE: 'true',
      SIYU_PUBLIC_URL: 'https://siyu.test',
      SIYU_DEPLOYMENT_PROFILE: 'personal',
      SIYU_REGISTRATION_ENABLED: 'false',
      SIYU_QQ_AUTH_ENABLED: 'false',
      SIYU_PASSWORD_RESET_ENABLED: 'false',
      DATABASE_URL: 'postgresql://siyu:secret@127.0.0.1:5432/siyu',
      REDIS_URL: 'redis://127.0.0.1:6379',
    }),
  );
});

const directory = mkdtempSync(join(tmpdir(), 'siyu-native-gateway-'));
const mobileRoot = join(directory, 'mobile');
const adminRoot = join(directory, 'admin');
mkdirSync(mobileRoot, { recursive: true });
mkdirSync(adminRoot, { recursive: true });
writeFileSync(join(mobileRoot, 'index.html'), '<h1>mobile</h1>', 'utf8');
writeFileSync(join(adminRoot, 'index.html'), '<h1>admin</h1>', 'utf8');

const api = http.createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ path: request.url }));
});
api.listen(0, '127.0.0.1');
await once(api, 'listening');
const apiAddress = api.address();
if (!apiAddress || typeof apiAddress === 'string') throw new Error('API test server did not bind');

let untrustedRequests = 0;
const untrusted = http.createServer((_request, response) => {
  untrustedRequests += 1;
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ source: 'untrusted' }));
});
untrusted.listen(0, '127.0.0.1');
await once(untrusted, 'listening');
const untrustedAddress = untrusted.address();
if (!untrustedAddress || typeof untrustedAddress === 'string') {
  throw new Error('Untrusted test server did not bind');
}

const reservation = http.createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const reservationAddress = reservation.address();
if (!reservationAddress || typeof reservationAddress === 'string')
  throw new Error('Port reservation failed');
const gatewayPort = reservationAddress.port;
await new Promise((resolveClose) => reservation.close(resolveClose));

const gateway = startNativeGateway(
  {
    SIYU_API_ORIGIN: `http://127.0.0.1:${apiAddress.port}`,
    SIYU_GATEWAY_HOST: '127.0.0.1',
    SIYU_GATEWAY_PORT: String(gatewayPort),
  },
  { mobileRoot, adminRoot },
);
await once(gateway, 'listening');

after(async () => {
  await Promise.all([
    new Promise((resolveClose) => gateway.close(resolveClose)),
    new Promise((resolveClose) => api.close(resolveClose)),
    new Promise((resolveClose) => untrusted.close(resolveClose)),
  ]);
  rmSync(directory, { recursive: true, force: true });
});

before(() => {
  assert.equal(gateway.listening, true);
});

test('native gateway serves both SPAs and proxies API paths', async () => {
  const origin = `http://127.0.0.1:${gatewayPort}`;
  const mobile = await fetch(`${origin}/entries/unknown`);
  const admin = await fetch(`${origin}/admin/users/unknown`);
  const health = await fetch(`${origin}/health`);
  assert.equal(mobile.status, 200);
  assert.equal(await mobile.text(), '<h1>mobile</h1>');
  assert.equal(admin.status, 200);
  assert.equal(await admin.text(), '<h1>admin</h1>');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { path: '/health' });
});

test('native gateway never lets an absolute request target override the configured API origin', async () => {
  const body = await new Promise((resolveBody, reject) => {
    const outgoing = http.request(
      {
        host: '127.0.0.1',
        port: gatewayPort,
        method: 'GET',
        path: `http://127.0.0.1:${untrustedAddress.port}/api/security-probe?value=1`,
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
      },
    );
    outgoing.once('error', reject);
    outgoing.end();
  });
  assert.deepEqual(JSON.parse(body), { path: '/api/security-probe?value=1' });
  assert.equal(untrustedRequests, 0);
});
