import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, open, readFile } from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  isLoopbackHost,
  parseCliArguments,
  parseDatabaseUrl,
  postgresEnvironment,
  runCommand,
} from './release-utils.mjs';

const restoreName = /^siyu_restore_[a-z0-9_]+$/;

export function validateRestoreTarget(databaseUrl, allowRemote = false) {
  const parsed = parseDatabaseUrl(databaseUrl, 'SIYU_RESTORE_DATABASE_URL');
  if (!restoreName.test(parsed.database)) {
    throw new Error('恢复验证数据库名必须匹配 siyu_restore_[a-z0-9_]+');
  }
  if (!allowRemote && !isLoopbackHost(parsed.url.hostname)) {
    throw new Error('恢复验证默认只允许本机目标；远程隔离环境需显式 --allow-remote');
  }
  return parsed;
}

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function verifyBackupChecksum(backup) {
  const metadataFile = `${backup}.json`;
  await access(metadataFile);
  const metadata = JSON.parse(await readFile(metadataFile, 'utf8'));
  if (metadata.format !== 'siyu-postgresql-custom-v1') {
    throw new Error('不支持的备份元数据格式');
  }
  const actual = await sha256(backup);
  if (actual !== metadata.sha256) throw new Error('备份 SHA-256 与元数据不一致');
  return metadata;
}

function containerCommand(container, args, options) {
  return runCommand('docker', ['exec', '-i', container, ...args], options);
}

async function restoreWithContainer({ container, username, database, backup }) {
  await containerCommand(container, [
    'dropdb',
    '--username',
    username,
    '--if-exists',
    '--force',
    database,
  ]);
  await containerCommand(container, [
    'createdb',
    '--username',
    username,
    '--template',
    'template0',
    database,
  ]);
  const input = await open(backup, 'r');
  try {
    await containerCommand(
      container,
      [
        'pg_restore',
        '--username',
        username,
        '--dbname',
        database,
        '--exit-on-error',
        '--no-owner',
        '--no-acl',
      ],
      { stdin: input.fd },
    );
  } finally {
    await input.close();
  }
}

async function queryContainer({ container, username, database, query }) {
  return containerCommand(container, [
    'psql',
    '--username',
    username,
    '--dbname',
    database,
    '--tuples-only',
    '--no-align',
    '--set',
    'ON_ERROR_STOP=1',
    '--command',
    query,
  ]);
}

async function cleanupContainer({ container, username, database }) {
  await containerCommand(container, [
    'dropdb',
    '--username',
    username,
    '--if-exists',
    '--force',
    database,
  ]);
}

async function restoreWithHost({ url, database, backup }) {
  const environment = postgresEnvironment(url);
  await runCommand('dropdb', ['--if-exists', '--force', database], { env: environment });
  await runCommand('createdb', ['--template', 'template0', database], { env: environment });
  await runCommand(
    'pg_restore',
    ['--dbname', database, '--exit-on-error', '--no-owner', '--no-acl', backup],
    { env: environment },
  );
}

async function queryHost({ url, database, query }) {
  return runCommand(
    'psql',
    [
      '--dbname',
      database,
      '--tuples-only',
      '--no-align',
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      query,
    ],
    { env: postgresEnvironment(url) },
  );
}

async function cleanupHost({ url, database }) {
  await runCommand('dropdb', ['--if-exists', '--force', database], {
    env: postgresEnvironment(url),
  });
}

export async function verifyDatabaseRestore({
  backup,
  targetUrl,
  postgresContainer,
  allowRemote = false,
  cleanup = false,
}) {
  const metadata = await verifyBackupChecksum(backup);
  const { url, database } = validateRestoreTarget(targetUrl, allowRemote);
  if (metadata.database?.name === database) throw new Error('恢复目标不得与备份源数据库同名');
  const username = decodeURIComponent(url.username || 'siyu');
  const adapter = postgresContainer
    ? {
        restore: () =>
          restoreWithContainer({ container: postgresContainer, username, database, backup }),
        query: (query) =>
          queryContainer({ container: postgresContainer, username, database, query }),
        cleanup: () => cleanupContainer({ container: postgresContainer, username, database }),
      }
    : {
        restore: () => restoreWithHost({ url, database, backup }),
        query: (query) => queryHost({ url, database, query }),
        cleanup: () => cleanupHost({ url, database }),
      };

  try {
    await adapter.restore();
    const migrationResult = await adapter.query(
      'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;',
    );
    const tableResult = await adapter.query(
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';",
    );
    const migrations = Number(migrationResult.stdout.toString('utf8').trim());
    const tables = Number(tableResult.stdout.toString('utf8').trim());
    if (!Number.isInteger(migrations) || migrations < 1)
      throw new Error('恢复库没有有效 Prisma 迁移记录');
    if (!Number.isInteger(tables) || tables < 1) throw new Error('恢复库没有业务表');
    return { database, migrations, tables, checksum: metadata.sha256 };
  } finally {
    if (cleanup) await adapter.cleanup();
  }
}

async function main() {
  const args = parseCliArguments(process.argv.slice(2), {
    backup: 'string',
    'target-url': 'string',
    'postgres-container': 'string',
    'allow-remote': 'boolean',
    cleanup: 'boolean',
  });
  const backup = args.backup ?? process.env.SIYU_BACKUP_FILE;
  const targetUrl = args['target-url'] ?? process.env.SIYU_RESTORE_DATABASE_URL;
  if (!backup) throw new Error('缺少 --backup 或 SIYU_BACKUP_FILE');
  if (!targetUrl) throw new Error('缺少 --target-url 或 SIYU_RESTORE_DATABASE_URL');
  const result = await verifyDatabaseRestore({
    backup,
    targetUrl,
    postgresContainer: args['postgres-container'],
    allowRemote: Boolean(args['allow-remote']),
    cleanup: Boolean(args.cleanup),
  });
  console.log(`恢复验证通过：${result.database}`);
  console.log(`有效迁移：${result.migrations}`);
  console.log(`业务表：${result.tables}`);
  console.log(`SHA-256：${result.checksum}`);
  if (args.cleanup) console.log('隔离恢复数据库已清理。');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
