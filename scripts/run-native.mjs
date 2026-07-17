import { spawn } from 'node:child_process';

import { checkNativeServices, loadNativeEnvironment, repositoryRoot } from './native-runtime.mjs';

const mode = process.argv[2];
if (!['development', 'production'].includes(mode)) {
  console.error('用法：node scripts/run-native.mjs development|production');
  process.exit(2);
}

loadNativeEnvironment();
process.env.NODE_ENV = mode;
try {
  await checkNativeServices();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const packageManagerScript = process.env.npm_execpath;
const children = [];
let stopping = false;

function spawnPnpm(label, args) {
  const command = packageManagerScript
    ? process.execPath
    : process.platform === 'win32'
      ? 'pnpm.cmd'
      : 'pnpm';
  const commandArgs = packageManagerScript ? [packageManagerScript, ...args] : args;
  const child = spawn(command, commandArgs, {
    cwd: repositoryRoot,
    env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' },
    stdio: 'inherit',
    windowsHide: true,
    shell: !packageManagerScript && process.platform === 'win32',
  });
  children.push({ label, child });
  return child;
}

function spawnNode(label, script) {
  const child = spawn(process.execPath, [script], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  children.push({ label, child });
  return child;
}

function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const { child } of children) {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(exitCode), 1500).unref();
}

function observe(label, child) {
  child.once('error', (error) => {
    console.error(`${label} 启动失败：${error.message}`);
    shutdown(1);
  });
  child.once('exit', (code, signal) => {
    if (stopping) return;
    console.error(
      `${label} 已退出（code=${String(code)}, signal=${String(signal)}），正在停止其他进程。`,
    );
    shutdown(code ?? 1);
  });
}

const definitions =
  mode === 'development'
    ? [
        ['API', spawnPnpm('API', ['--filter', '@siyu/api', 'dev'])],
        ['Worker', spawnPnpm('Worker', ['--filter', '@siyu/api', 'dev:worker'])],
        ['Mobile Web', spawnPnpm('Mobile Web', ['--filter', '@siyu/mobile-web', 'dev'])],
        ['Admin Web', spawnPnpm('Admin Web', ['--filter', '@siyu/admin-web', 'dev'])],
      ]
    : [
        ['API', spawnPnpm('API', ['--filter', '@siyu/api', 'start'])],
        ['Worker', spawnPnpm('Worker', ['--filter', '@siyu/api', 'start:worker'])],
        ['Gateway', spawnNode('Gateway', 'scripts/native-gateway.mjs')],
      ];

for (const [label, child] of definitions) observe(label, child);

console.log(
  mode === 'development'
    ? '原生开发模式已启动：手机端 http://localhost:5173，管理端 http://localhost:5174/admin/。'
    : `原生生产模式正在启动，网关端口 ${process.env.SIYU_GATEWAY_PORT ?? '8080'}。`,
);

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));
