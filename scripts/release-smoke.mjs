import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { parseCliArguments } from './release-utils.mjs';

const securityHeaders = [
  'content-security-policy',
  'permissions-policy',
  'referrer-policy',
  'x-content-type-options',
  'x-frame-options',
];

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, redirect: 'manual', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function assertStatus(response, expected, label) {
  if (response.status !== expected) {
    throw new Error(`${label} 状态应为 ${expected}，实际为 ${response.status}`);
  }
}

function assertSecurityHeaders(response, label) {
  const missing = securityHeaders.filter((name) => !response.headers.has(name));
  if (missing.length > 0) throw new Error(`${label} 缺少安全响应头：${missing.join(', ')}`);
}

export async function runReleaseSmoke({ baseUrl, expectProduction = false, timeoutMs = 5000 }) {
  if (!URL.canParse(baseUrl)) throw new Error('base URL 无效');
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('base URL 必须为不含凭据的 HTTP(S) URL');
  }
  if (expectProduction && base.protocol !== 'https:') {
    throw new Error('正式环境冒烟必须使用 HTTPS');
  }
  const origin = base.origin;
  const checks = [];
  const request = async (path, expected, label, inspect) => {
    const response = await fetchWithTimeout(new URL(path, origin), {}, timeoutMs);
    assertStatus(response, expected, label);
    assertSecurityHeaders(response, label);
    if (inspect) await inspect(response);
    checks.push({ label, status: response.status });
  };

  await request('/health', 200, 'API 健康检查', async (response) => {
    const payload = await response.json();
    if (payload?.success !== true) throw new Error('健康检查响应缺少 success=true');
  });
  await request('/', 200, '手机端入口', async (response) => {
    const body = await response.text();
    if (!body.includes('四时有余')) throw new Error('手机端入口缺少正式品牌名称');
  });
  await request('/admin/', 200, '管理端入口', async (response) => {
    const body = await response.text();
    if (!body.includes('四时有余')) throw new Error('管理端入口缺少正式品牌名称');
  });
  await request('/api/v1/users/me', 401, '未认证保护');
  return { ok: true, origin, checks };
}

async function main() {
  const args = parseCliArguments(process.argv.slice(2), {
    'base-url': 'string',
    'expect-production': 'boolean',
    'timeout-ms': 'string',
    json: 'boolean',
  });
  const baseUrl = args['base-url'] ?? process.env.SIYU_RELEASE_BASE_URL;
  if (!baseUrl) throw new Error('缺少 --base-url 或 SIYU_RELEASE_BASE_URL');
  const timeoutMs = Number(args['timeout-ms'] ?? '5000');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000) {
    throw new Error('--timeout-ms 必须为 100 到 60000 的整数');
  }
  const report = await runReleaseSmoke({
    baseUrl,
    expectProduction: Boolean(args['expect-production']),
    timeoutMs,
  });
  if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    for (const check of report.checks) console.log(`PASS ${check.label}: HTTP ${check.status}`);
    console.log(`发布冒烟通过：${report.origin}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
