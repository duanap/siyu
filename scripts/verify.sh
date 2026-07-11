#!/usr/bin/env bash
set -euo pipefail

bash scripts/check-docs.sh
pnpm manifest:check
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm prisma:validate
pnpm openapi:lint
pnpm compose:check
pnpm test:e2e
pnpm build
if command -v docker >/dev/null 2>&1; then
  docker compose config --quiet
else
  echo "Docker CLI unavailable; skipped daemon-backed Compose validation." >&2
fi
git diff --check

echo "Verification completed."
