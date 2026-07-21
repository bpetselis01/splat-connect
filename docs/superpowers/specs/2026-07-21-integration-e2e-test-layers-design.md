# Integration + E2E Test Layers — Design Spec

**Date:** 2026-07-21
**Status:** Approved for implementation
**Scope:** Close the unimplemented Layer 2 (integration) and Layer 3 (E2E) testing gaps from the 2026-05-26 Monorepo Architecture + Comprehensive Testing spec.

---

## Context

The 2026-05-26 monorepo/testing spec defined three testing layers. The architecture refactor and Layer 1 (unit tests) shipped. Layers 2 and 3 never did, even though supporting scaffolding was built:

- `packages/api/tests/helpers/db.ts` — `withRollback` (pg pool → local Supabase `:54322`)
- `packages/api/tests/helpers/auth.ts` — `createTestUser` / `deleteTestUser` (service-role)
- `packages/api/scripts/cleanup-test-users.ts` — purges `@splat-test.local` users
- `test:integration` (api) and `test:e2e` (web) npm scripts

The tests those scripts point at do not exist, and the local Supabase environment they assume was never initialized: there is **no `supabase/config.toml`** and **no `supabase/seed.sql`** — only `migrations/`. There is also no `playwright.config.ts`.

Unit tests mock Supabase entirely, so they structurally cannot catch the class of bug that motivated the original spec: RLS policy errors, storage misconfiguration, and status-transition permission gaps. The schema in `001_schema.sql` / `002_storage_update_policies.sql` carries rich RLS (approved-contributors-only inserts; contributors edit their own tutorials at any status but cannot self-approve; public reads only `approved` rows; admin full access). Integration tests are the only layer that exercises it.

### Database strategy

Local Supabase via the CLI (Docker). The existing `SUPABASE_URL` in `packages/api/.env.local` points at the **cloud production project** (`napjjvnriegcszcvkysj.supabase.co`) — it must never be used for these tests. The integration suite runs against `localhost:54321`, and the E2E suite's `supabase db reset` (which wipes the database) runs only against the local Docker container. Local Supabase uses fixed, well-known, non-secret dev keys, so nothing needs to be copied from the cloud project.

### Scope decision

Full integration coverage (7 suites) — this is where bugs actually hide. Comprehensive E2E coverage (9 specs across all real user journeys). This matches the intent of the 2026-05-26 spec, plus the foundation and the `helpers/auth.ts` fix that were never done.

---

## Phase 0 — Foundation

Prerequisite for both test layers. Small.

| Task | Detail |
|---|---|
| `supabase init` | Generates and commits `supabase/config.toml`. `supabase start` boots Postgres (`:54322`), API/Auth/Storage gateway (`:54321`), Storage. Migrations in `supabase/migrations/` apply automatically on `start` and `db reset`. |
| Fix `helpers/auth.ts` | Change the profile upsert from `is_approved: true` to `approved: true`. The real `profiles` column is `approved` (per `001_schema.sql`); `is_approved` does not exist, so test users are currently created **unapproved**, which would make RLS-insert tests fail for the wrong reason. |
| `packages/api/.env.test` | Committed (local keys are non-secret well-known dev keys). Sets `SUPABASE_URL=http://localhost:54321`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres`. Loaded by an integration setup file. |
| `supabase/seed.sql` | Deterministic fixtures (see Phase 2 for the full fixture list). Applied automatically by `supabase db reset`. |
| Sanity check | `supabase start` → migrations apply cleanly → `createTestUser` connects and returns a valid JWT. |

---

## Phase 1 — Integration suite

**Location:** `packages/api/tests/integration/`
**Runner:** Vitest (`pnpm --filter @splat-connect/api test:integration`) against a running local Supabase.

### Approach

Tests go **through the Hono API** — `app.request()` with a real `Authorization: Bearer <token>` from `createTestUser` — so each test exercises the full auth-middleware → route-handler → RLS path that production uses. RLS-denial cases that have no corresponding API route assert via the Supabase user-client directly.

### Data cleanup

Through-the-API tests cannot use pg transaction rollback: PostgREST opens its own connections, outside any pg-client transaction. So (matching the 2026-05-26 spec) they use **explicit cleanup**:

- Each suite creates unique `test-{uuid}@splat-test.local` users via `createTestUser`.
- All data is scoped to those users.
- `afterAll` deletes the suite's tutorials explicitly via the admin client (tutorials have **no FK to profiles** — deleting the user only cascades the `tutorial_contributors` link, orphaning the tutorial row), then calls `deleteTestUser`. Deleting a tutorial FK-cascades its parts / tools / stl_files.
- `withRollback` (from `helpers/db.ts`) remains available for any pure-pg-client test that does not go through the API.
- `pnpm --filter @splat-connect/api test:cleanup` is the crash safety net for orphaned `@splat-test.local` accounts.

### Suites

| File | Asserts |
|---|---|
| `auth/role-assignment.test.ts` | Contributor vs admin roles resolve correctly with `approved` gating; an **unapproved** contributor is blocked (RLS) from inserting a tutorial. |
| `tutorials/rls.test.ts` | A contributor cannot read another contributor's `draft` tutorial. |
| `tutorials/status-flow.test.ts` | Owner can move `draft → pending`; a contributor **cannot** self-set `approved` (RLS blocks the update); an admin can approve. |
| `tutorials/upsert-idempotency.test.ts` | A retried `POST` that hits Postgres unique-violation `23505` returns 200 with the same id — no duplicate row. |
| `parts-tools/rls.test.ts` | Parts/tools inserts are permitted only on the caller's own tutorial; another contributor is blocked. |
| `parts-tools/cascade.test.ts` | Deleting a tutorial removes its `parts`, `tools`, and `stl_files`. |
| `storage/upload.test.ts` | Upload lands in the correct bucket and returns a URL; re-upload deletes the previous file (the delete-before-upload behaviour). |

---

## Phase 2 — E2E suite

**Location:** `packages/web/tests/e2e/`
**Runner:** Playwright (`pnpm --filter @splat-connect/web test:e2e`).

### Harness

`packages/web/playwright.config.ts` uses Playwright's `webServer` to start **api (`:3101`) and web (`:3100`) both pointed at local Supabase**. The config sets `SUPABASE_URL` / keys to the local values in the servers' environment — this is the safety boundary: the E2E servers must not inherit the cloud project's env. `supabase db reset` (wipe + re-apply migrations + `seed.sql`) runs before the suite to give a clean baseline.

### Spec independence

- **Read-only specs** (library, tutorial-detail) rely on stable seed fixtures.
- **Mutating specs** (review-approve, contributor-approve, edit→reset) provision their own throwaway fixtures via the API / service key in a per-spec setup, so they never clobber shared seed and carry no ordering constraints. `db reset` guarantees a clean starting point per run.

### Specs

**Public**

| File | Journey |
|---|---|
| `public/library.spec.ts` | Browse the grid, filter by difficulty, search by toy name. |
| `public/tutorial-detail.spec.ts` | Detail page renders photo, PDF link, parts + buy-links, tools, STL list, contributors. |

**Contributor**

| File | Journey |
|---|---|
| `auth/signup.spec.ts` | Signup → "pending approval" page; an unapproved contributor hitting `/upload` is redirected to `/pending` (middleware gate). |
| `auth/login.spec.ts` | Contributor login → `/dashboard`; admin login → `/admin` (both roles, one spec). |
| `contributor/upload-flow.spec.ts` | Full 6-step upload wizard → submit → tutorial shows `pending`. |
| `contributor/dashboard.spec.ts` | Stat cards (pending / approved / rejected counts); recent list shows **Edit** and no **View**; my-tutorials list shows status badges and the rejection note on a rejected tutorial. |
| `contributor/edit-tutorial.spec.ts` | Editing an **approved** tutorial resets its status to `pending`; a **rejected** tutorial shows the rejection banner. |

**Admin**

| File | Journey |
|---|---|
| `admin/contributors.spec.ts` | Admin approves a pending signup → that contributor becomes `approved`. |
| `admin/review-flow.spec.ts` | Admin approves a pending tutorial → it appears on `/library` (setup also asserts the admin-dashboard pending stat card); admin rejects one with a note → the contributor sees the note. |

The admin-dashboard stat-card assertion is folded into `admin/review-flow.spec.ts` rather than a standalone spec.

### `seed.sql` fixtures

Deterministic, applied by `supabase db reset`:

- Two `auth.users` with known passwords and confirmed email: `contributor@splat-test.local`, `admin@splat-test.local`.
- Their `profiles`: an `approved` contributor and an admin.
- One **approved** tutorial with parts, tools, and a `tutorial_contributors` link (library / detail).
- One **unapproved pending signup** profile (contributors-approval flow).
- One **pending** tutorial (review flow).

**Accepted limitation:** seed points file URLs (`tutorial_pdf_url`, `toy_photo_url`, STL `file_url`) at placeholder values. Smoke assertions cover page rendering, not real file download — seeding actual objects into Storage buckets via SQL is not worth the complexity here.

---

## CI

Two jobs added to `.github/workflows/ci.yml`, both `needs: test` (the existing unit-test job gates them), running on `ubuntu-latest` (Docker available) with `supabase/setup-cli`:

```yaml
integration:
  needs: test
  # checkout, pnpm, node 22, install
  - supabase start
  - pnpm --filter @splat-connect/api test:integration
  - supabase stop

e2e:
  needs: test
  # checkout, pnpm, node 22, install
  - supabase start
  - supabase db reset
  - pnpm exec playwright install --with-deps chromium
  - pnpm --filter @splat-connect/web test:e2e   # webServer starts api + web
  - supabase stop
```

---

## Verification (definition of done)

- `supabase start && pnpm --filter @splat-connect/api test:integration` → all suites green.
- `supabase db reset && pnpm --filter @splat-connect/web test:e2e` → all specs green.
- CI green on push — all four jobs (`check`, `test`, `integration`, `e2e`).

---

## Out of scope

- Root-level test-orchestration scripts — the per-package `test:integration` / `test:e2e` scripts are sufficient.
- Seeding real files into Storage buckets for download assertions.
- Coverage thresholds for integration/E2E (server-rendered pages and DB-backed flows don't yield meaningful line coverage; coverage is by journey, not percentage).
- Any change to production source code beyond the `helpers/auth.ts` column fix.
```
