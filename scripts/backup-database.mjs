import { createHash } from 'node:crypto';
import { access, chmod, mkdir, open, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  assertPathOutsideRepository,
  canonicalPathOutsideRepository,
  parseCliArguments,
  parseDatabaseUrl,
  postgresEnvironment,
  runCommand,
} from './release-utils.mjs';

function compactTimestamp(date) {
  return date.toISOString().replaceAll(/[-:.]/g, '');
}

export function assertExternalBackupDirectory(directory) {
  return assertPathOutsideRepository(directory, '备份目录');
}

async function sha256(file) {
  const handle = await open(file, 'r');
  const hash = createHash('sha256');
  try {
    for await (const chunk of handle.createReadStream()) hash.update(chunk);
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}

async function dumpWithContainer({ container, username, database, destination }) {
  const output = await open(destination, 'wx', 0o600);
  try {
    await runCommand(
      'docker',
      [
        'exec',
        container,
        'pg_dump',
        '--username',
        username,
        '--dbname',
        database,
        '--format=custom',
        '--compress=6',
        '--no-owner',
        '--no-acl',
      ],
      { stdout: output.fd },
    );
  } finally {
    await output.close();
  }
}

async function dumpWithHost({ url, database, destination }) {
  await runCommand(
    'pg_dump',
    [
      '--dbname',
      database,
      '--format=custom',
      '--compress=6',
      '--no-owner',
      '--no-acl',
      '--file',
      destination,
    ],
    { env: postgresEnvironment(url) },
  );
}

export async function createDatabaseBackup({
  databaseUrl,
  outputDirectory,
  postgresContainer,
  now = new Date(),
}) {
  const { url, database } = parseDatabaseUrl(databaseUrl);
  let directory = assertExternalBackupDirectory(outputDirectory);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  directory = await canonicalPathOutsideRepository(directory, '备份目录');
  await chmod(directory, 0o700);

  const basename = `siyu-${compactTimestamp(now)}.dump`;
  const destination = resolve(directory, basename);
  const temporary = `${destination}.partial`;
  await access(destination).then(
    () => {
      throw new Error(`备份文件已存在：${destination}`);
    },
    () => undefined,
  );
  await unlink(temporary).catch((error) => {
    if (error?.code !== 'ENOENT') throw error;
  });
  try {
    if (postgresContainer) {
      await dumpWithContainer({
        container: postgresContainer,
        username: decodeURIComponent(url.username || 'siyu'),
        database,
        destination: temporary,
      });
    } else {
      const placeholder = await open(temporary, 'wx', 0o600);
      await placeholder.close();
      await dumpWithHost({ url, database, destination: temporary });
    }
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }

  const info = await stat(temporary);
  if (info.size === 0) throw new Error('pg_dump 生成了空备份');
  await chmod(temporary, 0o600);
  await rename(temporary, destination);
  const checksum = await sha256(destination);
  const metadata = {
    format: 'siyu-postgresql-custom-v1',
    createdAt: now.toISOString(),
    backupFile: basename,
    sha256: checksum,
    bytes: info.size,
    database: {
      host: url.hostname,
      port: Number(url.port || 5432),
      name: database,
    },
  };
  await writeFile(`${destination}.json`, `${JSON.stringify(metadata, null, 2)}\n`, {
    mode: 0o600,
  });
  return { destination, metadata };
}

async function main() {
  const args = parseCliArguments(process.argv.slice(2), {
    'database-url': 'string',
    'output-dir': 'string',
    'postgres-container': 'string',
  });
  const databaseUrl = args['database-url'] ?? process.env.DATABASE_URL;
  const outputDirectory = args['output-dir'] ?? process.env.SIYU_BACKUP_DIR;
  if (!databaseUrl) throw new Error('缺少 --database-url 或 DATABASE_URL');
  if (!outputDirectory) throw new Error('缺少 --output-dir 或 SIYU_BACKUP_DIR');
  const result = await createDatabaseBackup({
    databaseUrl,
    outputDirectory,
    postgresContainer: args['postgres-container'],
  });
  console.log(`备份文件：${result.destination}`);
  console.log(`SHA-256：${result.metadata.sha256}`);
  console.log(`字节数：${result.metadata.bytes}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
