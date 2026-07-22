#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for migration verification." >&2
  exit 1
fi

cleanup() {
  rm -f /tmp/siyu-concurrency-a.log /tmp/siyu-concurrency-b.log /tmp/siyu-invalid-entry.log /tmp/siyu-introspected.prisma
  docker compose --profile test rm -sf siyu-postgres-test >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose --profile test up -d --wait siyu-postgres-test

docker compose --profile test exec -T siyu-postgres-test \
  createdb -U siyu siyu_shadow
docker compose --profile test exec -T siyu-postgres-test \
  createdb -U siyu siyu_legacy
docker compose --profile test exec -T siyu-postgres-test \
  createdb -U siyu siyu_invalid

for migration in \
  apps/api/prisma/migrations/20260711000000_init/migration.sql \
  apps/api/prisma/migrations/20260712000000_authentication_foundation/migration.sql \
  apps/api/prisma/migrations/20260714000000_couple_ledger_permissions/migration.sql; do
  docker compose --profile test exec -T siyu-postgres-test \
    psql -v ON_ERROR_STOP=1 -U siyu -d siyu_legacy < "$migration"
done

docker compose --profile test exec -T siyu-postgres-test \
  psql -v ON_ERROR_STOP=1 -U siyu -d siyu_legacy <<'SQL'
INSERT INTO users (id, nickname, updated_at) VALUES
  ('10000000-0000-4000-8000-000000000001', '迁移用户一', CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000002', '迁移用户二', CURRENT_TIMESTAMP);
INSERT INTO ledgers (id, type, name, owner_user_id, updated_at) VALUES
  ('20000000-0000-4000-8000-000000000001', 'PERSONAL', '个人一', '10000000-0000-4000-8000-000000000001', CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000002', 'COUPLE', '情侣', '10000000-0000-4000-8000-000000000001', CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000003', 'PERSONAL', '个人二', '10000000-0000-4000-8000-000000000002', CURRENT_TIMESTAMP);
INSERT INTO ledger_members (id, ledger_id, user_id, role) VALUES
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'OWNER'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'MEMBER');
INSERT INTO categories (id, owner_user_id, type, name, icon, is_system, updated_at) VALUES
  ('40000000-0000-4000-8000-000000000001', NULL, 'EXPENSE', '餐饮', 'legacy-food', true, CURRENT_TIMESTAMP),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'EXPENSE', '餐饮', NULL, false, CURRENT_TIMESTAMP),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'INCOME', '旧兼职', NULL, false, CURRENT_TIMESTAMP);
INSERT INTO entries (
  id, ledger_id, creator_user_id, type, amount_cent, category_id,
  business_date, idempotency_key, updated_at
) VALUES (
  '50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', 'EXPENSE', 100,
  '40000000-0000-4000-8000-000000000001', '2026-07-14', 'legacy-entry', CURRENT_TIMESTAMP
);
INSERT INTO recurring_rules (
  id, owner_user_id, ledger_id, name, entry_type, amount_cent, category_id,
  frequency, start_date, generation_mode, updated_at
) VALUES (
  '60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002', '旧周期', 'EXPENSE', 100,
  '40000000-0000-4000-8000-000000000001', 'MONTHLY', '2026-07-14', 'AUTO', CURRENT_TIMESTAMP
);
SQL

docker compose --profile test exec -T siyu-postgres-test \
  psql --single-transaction -v ON_ERROR_STOP=1 -U siyu -d siyu_legacy \
  < apps/api/prisma/migrations/20260714020000_category_module/migration.sql

docker compose --profile test exec -T siyu-postgres-test \
  psql -v ON_ERROR_STOP=1 -U siyu -d siyu_legacy <<'SQL'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM ledgers ledger
    WHERE ledger.status = 'ACTIVE' AND ledger.deleted_at IS NULL
      AND (SELECT count(*) FROM categories category
           WHERE category.ledger_id = ledger.id AND category.is_system) <> 16
  ) THEN
    RAISE EXCEPTION 'Legacy migration did not initialize 16 system categories per active ledger';
  END IF;
  IF EXISTS (
    SELECT 1 FROM categories
    WHERE substring(id::text from 15 for 1) <> '4'
       OR substring(id::text from 20 for 1) <> '8'
  ) THEN
    RAISE EXCEPTION 'Migrated deterministic category IDs are not valid version 4 UUIDs';
  END IF;
  IF EXISTS (
    SELECT 1 FROM entries entry JOIN categories category ON category.id = entry.category_id
    WHERE entry.ledger_id <> category.ledger_id OR entry.type <> category.type
  ) THEN
    RAISE EXCEPTION 'Legacy entry category was not rebound to its ledger and type';
  END IF;
  IF EXISTS (
    SELECT 1 FROM recurring_rules rule JOIN categories category ON category.id = rule.category_id
    WHERE rule.ledger_id <> category.ledger_id OR rule.entry_type <> category.type
  ) THEN
    RAISE EXCEPTION 'Legacy recurring category was not rebound to its ledger and type';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM categories
    WHERE ledger_id = '20000000-0000-4000-8000-000000000001'
      AND name = '餐饮' AND NOT is_system AND is_enabled
  ) OR NOT EXISTS (
    SELECT 1 FROM categories
    WHERE ledger_id = '20000000-0000-4000-8000-000000000001'
      AND template_key = 'expense.food' AND is_system AND NOT is_enabled
  ) THEN
    RAISE EXCEPTION 'Legacy custom/default name conflict policy was not preserved';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM categories
    WHERE ledger_id = '20000000-0000-4000-8000-000000000003'
      AND name = '旧兼职' AND creator_user_id = '10000000-0000-4000-8000-000000000002'
  ) THEN
    RAISE EXCEPTION 'Unreferenced legacy custom category was not assigned to the personal ledger';
  END IF;
END $$;
SQL

docker compose --profile test exec -T siyu-postgres-test \
  psql --single-transaction -v ON_ERROR_STOP=1 -U siyu -d siyu_legacy \
  < apps/api/prisma/migrations/20260714040000_entry_api/migration.sql

docker compose --profile test exec -T siyu-postgres-test \
  psql -v ON_ERROR_STOP=1 -U siyu -d siyu_legacy <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ledger_members
    WHERE ledger_id = '20000000-0000-4000-8000-000000000001'
      AND user_id = '10000000-0000-4000-8000-000000000001'
      AND role = 'OWNER' AND status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'TASK-007 migration did not repair the valid legacy OWNER membership';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM entries
    WHERE id = '50000000-0000-4000-8000-000000000001'
      AND create_request_hash = 'legacy:50000000-0000-4000-8000-000000000001'
      AND version = 1
  ) THEN
    RAISE EXCEPTION 'TASK-007 migration did not preserve the legacy Entry with a reserved hash';
  END IF;
END $$;
SQL

for migration in \
  apps/api/prisma/migrations/20260711000000_init/migration.sql \
  apps/api/prisma/migrations/20260712000000_authentication_foundation/migration.sql \
  apps/api/prisma/migrations/20260714000000_couple_ledger_permissions/migration.sql; do
  docker compose --profile test exec -T siyu-postgres-test \
    psql -v ON_ERROR_STOP=1 -U siyu -d siyu_invalid < "$migration"
done

docker compose --profile test exec -T siyu-postgres-test \
  psql -v ON_ERROR_STOP=1 -U siyu -d siyu_invalid <<'SQL'
INSERT INTO users (id, nickname, updated_at) VALUES
  ('70000000-0000-4000-8000-000000000001', '异常账本所有者', CURRENT_TIMESTAMP),
  ('70000000-0000-4000-8000-000000000002', '异常账目创建人', CURRENT_TIMESTAMP);
INSERT INTO ledgers (id, type, name, owner_user_id, updated_at)
VALUES ('71000000-0000-4000-8000-000000000001', 'PERSONAL', '异常归属账本',
        '70000000-0000-4000-8000-000000000001', CURRENT_TIMESTAMP);
SQL

docker compose --profile test exec -T siyu-postgres-test \
  psql --single-transaction -v ON_ERROR_STOP=1 -U siyu -d siyu_invalid \
  < apps/api/prisma/migrations/20260714020000_category_module/migration.sql

docker compose --profile test exec -T siyu-postgres-test \
  psql -v ON_ERROR_STOP=1 -U siyu -d siyu_invalid <<'SQL'
INSERT INTO ledger_members (id, ledger_id, user_id, role)
VALUES ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001',
        '70000000-0000-4000-8000-000000000001', 'OWNER');
INSERT INTO entries (
  id, ledger_id, creator_user_id, type, amount_cent, category_id,
  business_date, idempotency_key, updated_at
)
SELECT '73000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001',
       '70000000-0000-4000-8000-000000000002', 'EXPENSE', 100, id,
       '2026-07-14', 'invalid-owner-entry', CURRENT_TIMESTAMP
FROM categories
WHERE ledger_id = '71000000-0000-4000-8000-000000000001'
  AND template_key = 'expense.food';
SQL

set +e
docker compose --profile test exec -T siyu-postgres-test \
  psql --single-transaction -v ON_ERROR_STOP=1 -U siyu -d siyu_invalid \
  < apps/api/prisma/migrations/20260714040000_entry_api/migration.sql \
  >/tmp/siyu-invalid-entry.log 2>&1
invalid_status=$?
set -e
if [[ $invalid_status -eq 0 ]] || ! grep -Fq 'is not a repairable OWNER' /tmp/siyu-invalid-entry.log; then
  echo "Expected TASK-007 migration to reject an abnormal historical Entry membership." >&2
  cat /tmp/siyu-invalid-entry.log >&2
  exit 1
fi
rm -f /tmp/siyu-invalid-entry.log

DATABASE_URL='postgresql://siyu:siyu_test_only@localhost:55432/siyu_test?schema=public' \
  pnpm --filter @siyu/api prisma:migrate:deploy

DATABASE_URL='postgresql://siyu:siyu_test_only@localhost:55432/siyu_test?schema=public' \
  pnpm --filter @siyu/api exec prisma migrate status --config prisma.config.ts

DATABASE_URL='postgresql://siyu:siyu_test_only@localhost:55432/siyu_test?schema=public' \
  SHADOW_DATABASE_URL='postgresql://siyu:siyu_test_only@localhost:55432/siyu_shadow?schema=public' \
  pnpm --filter @siyu/api exec prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-config-datasource \
  --exit-code \
  --config prisma.config.ts

DATABASE_URL='postgresql://siyu:siyu_test_only@localhost:55432/siyu_test?schema=public' \
  pnpm --filter @siyu/api exec prisma db pull --print --config prisma.config.ts \
  > /tmp/siyu-introspected.prisma

if [[ "$(grep -c '^model ' /tmp/siyu-introspected.prisma)" -ne 26 ]]; then
  echo "Expected 26 introspected application models." >&2
  exit 1
fi

docker compose --profile test exec -T siyu-postgres-test \
  psql -v ON_ERROR_STOP=1 -U siyu -d siyu_test < scripts/test-db-constraints.sql

set +e
docker compose --profile test exec -T siyu-postgres-test \
  psql -v ON_ERROR_STOP=1 -U siyu -d siyu_test -c \
  "INSERT INTO entries (id, ledger_id, creator_user_id, type, amount_cent, category_id, business_date, source_type, idempotency_key, create_request_hash, updated_at) VALUES ('40000000-0000-4000-8000-000000000034', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'EXPENSE', 100, '00000000-0000-0000-0000-000000000031', '2026-07-11', 'MANUAL', 'concurrent-key', repeat('8', 64), CURRENT_TIMESTAMP);" \
  >/tmp/siyu-concurrency-a.log 2>&1 &
first_pid=$!
docker compose --profile test exec -T siyu-postgres-test \
  psql -v ON_ERROR_STOP=1 -U siyu -d siyu_test -c \
  "INSERT INTO entries (id, ledger_id, creator_user_id, type, amount_cent, category_id, business_date, source_type, idempotency_key, create_request_hash, updated_at) VALUES ('40000000-0000-4000-8000-000000000035', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'EXPENSE', 100, '00000000-0000-0000-0000-000000000031', '2026-07-11', 'MANUAL', 'concurrent-key', repeat('8', 64), CURRENT_TIMESTAMP);" \
  >/tmp/siyu-concurrency-b.log 2>&1 &
second_pid=$!
wait "$first_pid"
first_status=$?
wait "$second_pid"
second_status=$?
set -e

if [[ $((first_status + second_status)) -eq 0 ]] || [[ $first_status -ne 0 && $second_status -ne 0 ]]; then
  echo "Expected exactly one concurrent idempotency insert to fail." >&2
  cat /tmp/siyu-concurrency-a.log /tmp/siyu-concurrency-b.log >&2
  exit 1
fi

failed_log=/tmp/siyu-concurrency-b.log
if [[ $first_status -ne 0 ]]; then
  failed_log=/tmp/siyu-concurrency-a.log
fi
if ! grep -Fq 'entries_creator_user_id_idempotency_key_key' "$failed_log"; then
  echo "Expected the concurrent loser to fail on the entry idempotency constraint." >&2
  cat /tmp/siyu-concurrency-a.log /tmp/siyu-concurrency-b.log >&2
  exit 1
fi

concurrent_rows="$(docker compose --profile test exec -T siyu-postgres-test \
  psql -At -U siyu -d siyu_test -c \
  "SELECT count(*) FROM entries WHERE creator_user_id = '00000000-0000-0000-0000-000000000001' AND idempotency_key = 'concurrent-key';")"
if [[ "$concurrent_rows" -ne 1 ]]; then
  echo "Expected exactly one committed concurrent idempotency row." >&2
  exit 1
fi
rm -f /tmp/siyu-concurrency-a.log /tmp/siyu-concurrency-b.log

echo "Migration and database constraint verification passed."
