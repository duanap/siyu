import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { extname, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { loadNativeEnvironment, repositoryRoot } from './native-runtime.mjs';

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function gatewayPort(value) {
  const port = Number(value ?? '8080');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('SIYU_GATEWAY_PORT 必须是 1 到 65535 之间的整数。');
  }
  return port;
}

function inside(root, target) {
  return target === root || target.startsWith(`${root}${sep}`);
}

async function staticTarget(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  const relative = decoded.replace(/^\/+/, '');
  let target = resolve(root, relative);
  if (!inside(root, target)) return undefined;
  try {
    const details = await stat(target);
    if (details.isDirectory()) target = resolve(target, 'index.html');
    else if (!details.isFile()) return undefined;
    if (!inside(root, target)) return undefined;
    return target;
  } catch {
    if (extname(relative)) return undefined;
    return resolve(root, 'index.html');
  }
}

function proxyRequest(request, response, apiOrigin) {
  const target = new URL(request.url ?? '/', apiOrigin);
  const client = target.protocol === 'https:' ? https : http;
  const requestId = String(request.headers['x-request-id'] ?? `req_${randomUUID()}`);
  const forwardedFor = [request.headers['x-forwarded-for'], request.socket.remoteAddress]
    .filter(Boolean)
    .join(', ');
  const upstream = client.request(
    target,
    {
      method: request.method,
      headers: {
        ...request.headers,
        host: target.host,
        'x-forwarded-for': forwardedFor,
        'x-forwarded-host': request.headers.host ?? '',
        'x-forwarded-proto': String(request.headers['x-forwarded-proto'] ?? 'http'),
        'x-request-id': requestId,
      },
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstream.setTimeout(30_000, () => upstream.destroy(new Error('API proxy timeout')));
  upstream.once('error', (error) => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    response.end(
      JSON.stringify({
        success: false,
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'API 服务暂不可用',
        details: {},
        requestId,
      }),
    );
  });
  request.pipe(upstream);
}

async function serveStatic(request, response, root, pathname) {
  const target = await staticTarget(root, pathname);
  if (!target) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
    return;
  }
  const details = await stat(target);
  const extension = extname(target).toLowerCase();
  response.writeHead(200, {
    'content-type': contentTypes.get(extension) ?? 'application/octet-stream',
    'content-length': details.size,
    'cache-control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
  });
  if (request.method === 'HEAD') response.end();
  else createReadStream(target).pipe(response);
}

export function startNativeGateway(environment = process.env, roots = {}) {
  loadNativeEnvironment();
  const mobileRoot = roots.mobileRoot ?? resolve(repositoryRoot, 'apps/mobile-web/dist');
  const adminRoot = roots.adminRoot ?? resolve(repositoryRoot, 'apps/admin-web/dist');
  for (const root of [mobileRoot, adminRoot]) {
    if (!existsSync(resolve(root, 'index.html'))) {
      throw new Error(`缺少前端构建产物：${root}，请先运行 pnpm build。`);
    }
  }
  const apiOrigin = new URL(environment.SIYU_API_ORIGIN ?? 'http://127.0.0.1:3000');
  if (!['http:', 'https:'].includes(apiOrigin.protocol)) {
    throw new Error('SIYU_API_ORIGIN 必须是 HTTP(S) URL。');
  }
  const host = environment.SIYU_GATEWAY_HOST ?? '127.0.0.1';
  const port = gatewayPort(environment.SIYU_GATEWAY_PORT);
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      if (url.pathname === '/health' || url.pathname.startsWith('/api/')) {
        proxyRequest(request, response, apiOrigin);
        return;
      }
      if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) {
        response.writeHead(405, { allow: 'GET, HEAD' });
        response.end();
        return;
      }
      if (url.pathname === '/admin') {
        response.writeHead(308, { location: '/admin/' });
        response.end();
        return;
      }
      if (url.pathname.startsWith('/admin/')) {
        await serveStatic(request, response, adminRoot, url.pathname.slice('/admin/'.length));
        return;
      }
      await serveStatic(request, response, mobileRoot, url.pathname);
    } catch {
      if (!response.headersSent) {
        response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Internal Server Error');
      } else response.destroy();
    }
  });
  server.listen(port, host, () => {
    console.log(`SIYU 原生网关已启动：http://${host}:${port}`);
    console.log(`API 上游：${apiOrigin.origin}`);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startNativeGateway();
}
