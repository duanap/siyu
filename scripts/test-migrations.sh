#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for migration verification." >&2
  exit 1
fi

cleanup() {
  rm -f /tmp/siyu-concurrency-a.log /tmp/siyu-concurrency-b.log /tmp/siyu-introspected.prisma
  docker compose --profile test rm -sf siyu-postgres-test >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose --profile test up -d --wait siyu-postgres-test

docker compose --profile test exec -T siyu-postgres-test \
  createdb -U siyu siyu_shadow

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

if [[ "$(grep -c '^model ' /tmp/siyu-introspected.prisma)" -ne 17 ]]; then
  echo "Expected 17 introspected application models." >&2
  exit 1
fi

docker compose --profile test exec -T siyu-postgres-test \
  psql -v ON_ERROR_STOP=1 -U siyu -d siyu_test < scripts/test-db-constraints.sql

set +e
docker compose --profile test exec -T siyu-postgres-test \
  psql -v ON_ERROR_STOP=1 -U siyu -d siyu_test -c \
  "INSERT INTO entries (id, ledger_id, creator_user_id, type, amount_cent, category_id, business_date, source_type, idempotency_key, updated_at) VALUES ('00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'EXPENSE', 100, '00000000-0000-0000-0000-000000000030', '2026-07-11', 'MANUAL', 'concurrent-key', CURRENT_TIMESTAMP);" \
  >/tmp/siyu-concurrency-a.log 2>&1 &
first_pid=$!
docker compose --profile test exec -T siyu-postgres-test \
  psql -v ON_ERROR_STOP=1 -U siyu -d siyu_test -c \
  "INSERT INTO entries (id, ledger_id, creator_user_id, type, amount_cent, category_id, business_date, source_type, idempotency_key, updated_at) VALUES ('00000000-0000-0000-0000-000000000035', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'EXPENSE', 100, '00000000-0000-0000-0000-000000000030', '2026-07-11', 'MANUAL', 'concurrent-key', CURRENT_TIMESTAMP);" \
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
