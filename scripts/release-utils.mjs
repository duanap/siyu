import { readFile, realpath } from 'node:fs/promises';
import { isIP } from 'node:net';
import { dirname, relative, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function parseCliArguments(argv, definitions) {
  const argumentsToParse = argv[0] === '--' ? argv.slice(1) : argv;
  const result = {};
  for (let index = 0; index < argumentsToParse.length; index += 1) {
    const argument = argumentsToParse[index];
    if (!argument.startsWith('--')) throw new Error(`未知参数：${argument}`);
    const name = argument.slice(2);
    const definition = definitions[name];
    if (!definition) throw new Error(`未知参数：${argument}`);
    if (definition === 'boolean') {
      result[name] = true;
      continue;
    }
    const value = argumentsToParse[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${argument} 缺少值`);
    result[name] = value;
    index += 1;
  }
  return result;
}

export async function readEnvironmentFile(file) {
  const absolute = resolve(file);
  return { path: absolute, values: parseEnv(await readFile(absolute, 'utf8')) };
}

export function parseDatabaseUrl(value, label = 'DATABASE_URL') {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} 不是有效 URL`);
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(`${label} 必须使用 PostgreSQL 协议`);
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!url.hostname || !database) throw new Error(`${label} 缺少主机或数据库名`);
  return { url, database };
}

export function postgresEnvironment(url, environment = process.env) {
  const result = { ...environment };
  if (url.username) result.PGUSER = decodeURIComponent(url.username);
  if (url.password) result.PGPASSWORD = decodeURIComponent(url.password);
  result.PGHOST = url.hostname;
  result.PGPORT = url.port || '5432';
  const connectionOptions = new Map([
    ['sslmode', 'PGSSLMODE'],
    ['sslrootcert', 'PGSSLROOTCERT'],
    ['sslcert', 'PGSSLCERT'],
    ['sslkey', 'PGSSLKEY'],
    ['sslcrl', 'PGSSLCRL'],
    ['connect_timeout', 'PGCONNECT_TIMEOUT'],
  ]);
  for (const [parameter, variable] of connectionOptions) {
    const value = url.searchParams.get(parameter);
    if (value) result[variable] = value;
  }
  return result;
}

export function isLoopbackHost(hostname) {
  if (hostname === 'localhost') return true;
  const ipVersion = isIP(hostname);
  return (
    (ipVersion === 4 && hostname.startsWith('127.')) ||
    (ipVersion === 6 && ['::1', '0:0:0:0:0:0:0:1'].includes(hostname))
  );
}

export function safeUrlSummary(value) {
  const url = new URL(value);
  const defaultPorts = new Map([
    ['http:', '80'],
    ['https:', '443'],
    ['postgres:', '5432'],
    ['postgresql:', '5432'],
    ['redis:', '6379'],
    ['rediss:', '6379'],
  ]);
  return `${url.protocol}//${url.hostname}:${url.port || defaultPorts.get(url.protocol) || ''}${url.pathname}`;
}

export async function canonicalPathOutsideRepository(path, label) {
  return assertPathOutsideRepository(await realpath(path), label);
}

export function assertPathOutsideRepository(path, label) {
  const absolute = resolve(path);
  const pathFromRepository = relative(repositoryRoot, absolute);
  if (
    pathFromRepository === '' ||
    (!pathFromRepository.startsWith(`..${sep}`) && pathFromRepository !== '..')
  ) {
    throw new Error(`${label}必须位于仓库之外`);
  }
  return absolute;
}

export function runCommand(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      env: options.env,
      stdio: [options.stdin ?? 'ignore', options.stdout ?? 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    if (child.stdout) child.stdout.on('data', (chunk) => stdout.push(chunk));
    if (child.stderr) child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('error', reject);
    child.once('close', (code, signal) => {
      const result = {
        code,
        signal,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr).toString('utf8').trim(),
      };
      if (code === 0) resolveRun(result);
      else
        reject(
          new Error(
            `${command} 执行失败（${signal ? `signal ${signal}` : `exit ${code}`}）${
              result.stderr ? `：${result.stderr}` : ''
            }`,
          ),
        );
    });
  });
}
