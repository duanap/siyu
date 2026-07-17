# TASK-008 branch integration

## Status

Implementation and local validation complete; publication pending.

## Goal

Integrate the unique work from `task/TASK-008-entry-ui` into the current `main`
without regressing TASK-009 statistics, TASK-010 debt APIs, or native runtime support.

## Scope

- Preserve the current backend, database migrations, OpenAPI additions, statistics,
  debt implementation, and native deployment tooling.
- Adopt the richer TASK-008 typed request layer, money and ledger utilities,
  reusable mobile components, entry flows, accessibility behavior, and tests.
- Reconcile routes and navigation so entry, home, statistics, and account flows remain
  reachable together.
- Merge project-memory and design documentation forward instead of restoring stale
  task status.

## Risks

- TASK-008 and current `main` independently implemented the same entry pages.
- The older branch intentionally disabled home and statistics navigation before
  TASK-009 existed.
- Authentication recovery, route query state, and generated API types must remain
  consistent with the current API contract.

## Steps

- [x] Audit every remote branch and merged PR head.
- [x] Prove TASK-000 is an ancestor and TASK-004 through TASK-007 have no post-merge commits.
- [x] Identify TASK-008 files missing from current `main`.
- [x] Merge `task/TASK-008-entry-ui` into the integration branch.
- [x] Resolve code and documentation conflicts in favor of the newest complete behavior.
- [x] Run mobile and repository quality gates.
- [ ] Push, open a PR, pass CI, and merge into `main`.

## Validation

```bash
pnpm --filter @siyu/mobile-web test
pnpm lint
pnpm typecheck
pnpm test
pnpm prisma:validate
pnpm build
git diff --check
```

Database-backed E2E remains dependent on PostgreSQL and Redis; GitHub CI is the final
database integration gate for this branch.

## Result

- The complete TASK-008 request/session layer, reusable components, entry list,
  create/detail flows, accessibility behavior, and tests are integrated.
- TASK-009 home/statistics routes and TASK-010/native runtime code remain intact.
- All 20 mobile test files (61 tests) and all 94 repository tests pass.
- Lint, typecheck, Prisma validation, OpenAPI 74/74 coverage, build, manifest, and
  required-document checks pass. Redocly validates the contract but its Windows process
  exits with a libuv assertion after success; GitHub CI remains the authoritative Linux gate.
