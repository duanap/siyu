import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import { runReleaseSmoke } from './release-smoke.mjs';

const headers = {
  'content-security-policy': "default-src 'self'",
  'permissions-policy': 'camera=()',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

async function serve(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('测试服务器未启动');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('release smoke checks health, both entry points, authentication and headers', async () => {
  const runtime = await serve((request, response) => {
    for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
    if (request.url === '/health') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ success: true }));
      return;
    }
    if (request.url === '/api/v1/users/me') {
      response.statusCode = 401;
      response.end('unauthorized');
      return;
    }
    response.end('<title>朝暮同笺 · 四时有余</title>');
  });
  try {
    const report = await runReleaseSmoke({ baseUrl: runtime.origin });
    assert.equal(report.ok, true);
    assert.deepEqual(
      report.checks.map((check) => check.status),
      [200, 200, 200, 401],
    );
  } finally {
    await runtime.close();
  }
});

test('release smoke rejects missing security headers and non-HTTPS production origins', async () => {
  await assert.rejects(
    runReleaseSmoke({ baseUrl: 'http://127.0.0.1:3000', expectProduction: true }),
    /HTTPS/,
  );
  const runtime = await serve((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ success: true }));
  });
  try {
    await assert.rejects(runReleaseSmoke({ baseUrl: runtime.origin }), /缺少安全响应头/);
  } finally {
    await runtime.close();
  }
});
