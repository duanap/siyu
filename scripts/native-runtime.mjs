import { existsSync } from 'node:fs';
import net from 'node:net';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function loadNativeEnvironment() {
  const explicit = process.env.SIYU_ENV_FILE;
  const candidates = explicit
    ? [isAbsolute(explicit) ? explicit : resolve(process.cwd(), explicit)]
    : [resolve(repositoryRoot, '.env')];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) {
    if (explicit) throw new Error(`SIYU_ENV_FILE 指向的文件不存在：${candidates[0]}`);
    return undefined;
  }
  process.loadEnvFile(file);
  return file;
}

function parseEndpoint(label, value, protocols, defaultPort) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} 不是有效 URL。`);
  }
  if (!protocols.includes(url.protocol)) {
    throw new Error(`${label} 只支持 ${protocols.join('、')} 协议。`);
  }
  const port = Number(url.port || defaultPort);
  if (!url.hostname || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${label} 缺少有效主机或端口。`);
  }
  return {
    label,
    host: url.hostname,
    port,
    display: `${url.protocol}//${url.hostname}:${port}${url.pathname === '/' ? '' : url.pathname}`,
  };
}

export function nativeServiceTargets(environment = process.env) {
  return [
    parseEndpoint(
      'DATABASE_URL',
      environment.DATABASE_URL ??
        'postgresql://siyu:siyu_local_only@localhost:5432/siyu?schema=public',
      ['postgres:', 'postgresql:'],
      5432,
    ),
    parseEndpoint(
      'REDIS_URL',
      environment.REDIS_URL ?? 'redis://localhost:6379',
      ['redis:', 'rediss:'],
      6379,
    ),
  ];
}

export function validateNativeConfiguration(environment = process.env) {
  const major = Number(process.versions.node.split('.')[0]);
  if (!Number.isInteger(major) || major < 24) {
    throw new Error(`原生运行需要 Node.js 24 或更高版本，当前为 ${process.versions.node}。`);
  }
  const targets = nativeServiceTargets(environment);
  if (environment.NODE_ENV === 'production') {
    if ((environment.JWT_SECRET ?? '').length < 32) {
      throw new Error('生产原生运行要求 JWT_SECRET 至少 32 个字符。');
    }
    if (!environment.SIYU_PUBLIC_URL || !URL.canParse(environment.SIYU_PUBLIC_URL)) {
      throw new Error('生产原生运行要求 SIYU_PUBLIC_URL 为有效公开 URL。');
    }
  }
  return targets;
}

function probe(target, timeoutMs) {
  return new Promise((resolveProbe, reject) => {
    const socket = net.createConnection({ host: target.host, port: target.port });
    const finish = (error) => {
      socket.destroy();
      if (error) reject(error);
      else resolveProbe();
    };
    socket.setTimeout(timeoutMs, () => finish(new Error('连接超时')));
    socket.once('connect', () => finish());
    socket.once('error', finish);
  });
}

function errorReason(error) {
  if (error instanceof AggregateError) {
    const reasons = error.errors.map((item) => errorReason(item)).filter(Boolean);
    if (reasons.length > 0) return [...new Set(reasons)].join(' / ');
  }
  if (error && typeof error === 'object' && 'code' in error && error.code) {
    return String(error.code);
  }
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

export async function checkNativeServices({ connect = true, timeoutMs = 3000 } = {}) {
  const loadedFile = loadNativeEnvironment();
  const targets = validateNativeConfiguration();
  if (loadedFile) console.log(`已加载环境文件：${loadedFile}`);
  else console.log('未找到 .env，使用开发默认值和当前进程环境变量。');
  console.log(`Node.js ${process.versions.node} 配置有效。`);
  if (!connect) {
    for (const target of targets) console.log(`${target.label}：${target.display}`);
    return targets;
  }
  for (const target of targets) {
    try {
      await probe(target, timeoutMs);
      console.log(`${target.label} 可连接：${target.display}`);
    } catch (error) {
      const reason = errorReason(error);
      throw new Error(`${target.label} 无法连接（${target.display}）：${reason}`);
    }
  }
  return targets;
}
