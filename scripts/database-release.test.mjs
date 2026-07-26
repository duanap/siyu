import assert from 'node:assert/strict';
import { mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { assertExternalBackupDirectory } from './backup-database.mjs';
import { canonicalPathOutsideRepository } from './release-utils.mjs';
import { validateRestoreTarget, verifyBackupChecksum } from './verify-database-restore.mjs';

test('database backup refuses repository paths', () => {
  assert.throws(() => assertExternalBackupDirectory('backups'), /仓库之外/);
  assert.match(assertExternalBackupDirectory(join(tmpdir(), 'siyu-backups')), /siyu-backups$/);
});

test('canonical outside check rejects a symlink back into the repository', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'siyu-release-link-test-'));
  const link = join(directory, 'repository-link');
  await symlink(process.cwd(), link, 'dir');
  await assert.rejects(canonicalPathOutsideRepository(link, '测试目录'), /仓库之外/);
});

test('restore verification requires an isolated local database by default', () => {
  const parsed = validateRestoreTarget(
    'postgresql://siyu:secret@127.0.0.1:55432/siyu_restore_task025',
  );
  assert.equal(parsed.database, 'siyu_restore_task025');
  assert.throws(
    () => validateRestoreTarget('postgresql://siyu:secret@127.0.0.1:55432/siyu_test'),
    /数据库名必须匹配/,
  );
  assert.throws(
    () => validateRestoreTarget('postgresql://siyu:secret@db.internal:5432/siyu_restore_task025'),
    /默认只允许本机/,
  );
});

test('restore verification rejects a modified backup', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'siyu-release-test-'));
  const backup = join(directory, 'backup.dump');
  await writeFile(backup, 'original');
  await writeFile(
    `${backup}.json`,
    `${JSON.stringify({
      format: 'siyu-postgresql-custom-v1',
      sha256: '0'.repeat(64),
    })}\n`,
  );
  await assert.rejects(verifyBackupChecksum(backup), /SHA-256/);
});
