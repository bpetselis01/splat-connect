# Monorepo Architecture + Comprehensive Testing Design

**Date:** 2026-05-26
**Status:** Approved

## Overview

Two tightly linked goals:

1. Refactor the existing Next.js + Supabase app into a monorepo with a proper frontend/backend separation, so the codebase can scale like a SaaS.
2. Add comprehensive test coverage across all three layers (unit, integration, E2E) so that the class of Supabase RLS/policy bugs we've already hit can be caught before they reach production.

---

## Section 1 — Monorepo structure

Managed with **pnpm workspaces**. Three packages plus the shared Supabase directory at root.

```
splat-connect/
  package.json                  ← workspace root, shared dev deps (Vitest, Playwright, TypeScript)
  pnpm-workspace.yaml
  supabase/                     ← stays at root, shared schema for all environments
    migrations/
    seed.sql                    ← deterministic seed data for local dev + E2E
  packages/
    types/                      ← @splat-connect/types
      src/index.ts              ← all interfaces from lib/types.ts, single source of truth
    api/                        ← @splat-connect/api (Hono HTTP server)
      src/
        index.ts
        middleware/
        routes/
        supabase/
      tests/
        unit/
        integration/
    web/                        ← @splat-connect/web (Next.js, UI only)
      app/
      components/
      lib/
      tests/
        unit/
        e2e/
  docs/
```

`packages/types` is the shared contract. Both `api` and `web` import from `@splat-connect/types`. DB schema changes propagate through types, not through duplicated interfaces.

---

## Section 2 — `packages/api` design

A standalone **Hono** HTTP server. Owns every Supabase data operation. `packages/web` never calls Supabase for data — only this server does.

### File structure

```
packages/api/src/
  index.ts                      ← Hono app entry, mounts all routers
  middleware/
    auth.ts                     ← validates Supabase JWT, attaches { userId, role } to context
  routes/
    tutorials.ts                ← GET /tutorials, GET /tutorials/:id, POST, PATCH, DELETE
    upload.ts                   ← POST /upload (file → Supabase Storage, returns public URL)
    parts.ts                    ← POST /tutorials/:id/parts, DELETE
    tools.ts                    ← POST /tutorials/:id/tools, DELETE
    stl-files.ts                ← POST /tutorials/:id/stl-files, DELETE
    admin.ts                    ← GET /admin/tutorials (pending), PATCH /admin/tutorials/:id/status
    contributors.ts             ← GET /contributors/me, PATCH (profile update)
  supabase/
    client.ts                   ← service-role client for admin operations
    user-client.ts              ← builds an RLS-respecting client from a validated JWT
```

### Auth middleware contract

Every protected route goes through `middleware/auth.ts`:

```
request → validate Supabase JWT → attach { userId, role } to Hono context → route handler
```

Route handlers always read `userId` from the validated context, never from the request body. This prevents any contributor from acting as another user.

### Request flow example

```
GET /tutorials
  ← Authorization: Bearer <supabase_jwt>
  → auth middleware validates JWT
  → route handler calls supabase.from('tutorials').select(...)
  → returns JSON
```

---

## Section 3 — `packages/web` changes

The Next.js app becomes a pure UI layer. Page and component structure is unchanged; only the data source changes.

### What stays in `web`

- All pages, components, layouts
- `@supabase/ssr` for auth session management (login, logout, token refresh) — the only remaining Supabase dependency
- `lib/validation.ts` — pure logic, no Supabase dependency
- `@splat-connect/types` for shared interfaces

### What is removed from `web`

- `lib/supabase/server.ts` — deleted
- `lib/supabase/admin.ts` — deleted
- `lib/supabase/client.ts` — kept only for reading the auth session, not for data fetching

### New in `web`

```
packages/web/lib/
  api-client.ts   ← typed fetch wrapper; reads session cookie, attaches JWT, handles errors
```

Pages use `apiClient` instead of calling Supabase directly:

```ts
// BEFORE
const supabase = await createClient()
const { data } = await supabase.from('tutorials').select('*')

// AFTER
const data = await apiClient.get('/tutorials')
```

The `api-client.ts` wrapper handles `Authorization` header construction so pages never deal with tokens manually.

---

## Section 4 — Testing layers

### Layer 1 — Unit tests (Vitest + React Testing Library)

Fast, no network, no DB. Tests pure logic and components in isolation.

Hono's built-in test client lets route handlers be called directly without an HTTP server.

```
packages/api/tests/unit/
  middleware/auth.test.ts
  routes/tutorials.test.ts
  routes/upload.test.ts
  routes/parts.test.ts
  routes/tools.test.ts
  routes/stl-files.test.ts
  routes/admin.test.ts
  routes/contributors.test.ts

packages/web/tests/unit/
  lib/validation.test.ts
  lib/api-client.test.ts
  components/nav.test.tsx
  components/tutorial-card.test.tsx
  components/difficulty-badge.test.tsx
  components/file-drop-zone.test.tsx
  components/buy-links-input.test.tsx
```

### Layer 2 — Integration tests (Vitest + local Supabase)

Tests that real DB behaviour works — RLS policies, status transitions, storage, upsert idempotency. These are the tests that would have caught every Supabase bug hit so far.

```
packages/api/tests/integration/
  auth/
    signup.test.ts              ← user created, profile row inserted, role assigned
    role-assignment.test.ts     ← contributor vs admin access control
  tutorials/
    rls.test.ts                 ← contributor cannot read another contributor's draft
    status-flow.test.ts         ← draft → pending → approved/rejected transitions
    upsert-idempotency.test.ts  ← retry on failure does not create duplicate rows
  parts-tools/
    rls.test.ts                 ← inserts only permitted on own draft tutorials
    cascade.test.ts             ← deleting tutorial removes parts, tools, stl_files
  storage/
    upload.test.ts              ← PDF, photo, STL upload to correct buckets
```

### Layer 3 — E2E tests (Playwright)

Full browser tests through the running UI. Covers page-level behaviour that unit tests cannot reach.

```
packages/web/tests/e2e/
  auth/
    login.spec.ts               ← login → correct redirect by role
    signup.spec.ts              ← signup → pending approval page
  contributor/
    upload-flow.spec.ts         ← full 6-step upload form, file upload, submit for review
    dashboard.spec.ts           ← tutorial list, status display
    edit-tutorial.spec.ts       ← edit existing tutorial, re-submit
  admin/
    admin-dashboard.spec.ts     ← admin home stat cards
    review-flow.spec.ts         ← approve and reject pending tutorials
    contributors.spec.ts        ← contributor management page
  public/
    library.spec.ts             ← browse tutorials without auth
    tutorial-detail.spec.ts     ← view tutorial, parts list, STL download
```

---

## Section 5 — Coverage map

All paths reflect the post-refactor monorepo structure.

### `packages/api/src/` — line-level coverage enforced by Vitest (`@vitest/coverage-v8`, threshold: 100% for routes and middleware)

| File | Unit | Integration |
|------|------|-------------|
| `middleware/auth.ts` | ✓ | ✓ |
| `routes/tutorials.ts` | ✓ | ✓ |
| `routes/upload.ts` | ✓ | ✓ |
| `routes/parts.ts` | ✓ | ✓ |
| `routes/tools.ts` | ✓ | ✓ |
| `routes/stl-files.ts` | ✓ | ✓ |
| `routes/admin.ts` | ✓ | ✓ |
| `routes/contributors.ts` | ✓ | ✓ |
| `supabase/client.ts` | — | ✓ (used by every integration test) |
| `supabase/user-client.ts` | — | ✓ |
| `index.ts` | — | E2E (server boot) |

### `packages/web/` — components and lib via Vitest; pages via Playwright

| File | Unit | E2E |
|------|------|-----|
| `lib/validation.ts` | ✓ | — |
| `lib/api-client.ts` | ✓ | — |
| `components/nav.tsx` | ✓ | — |
| `components/tutorial-card.tsx` | ✓ | — |
| `components/difficulty-badge.tsx` | ✓ | — |
| `components/file-drop-zone.tsx` | ✓ | — |
| `components/buy-links-input.tsx` | ✓ | — |
| `app/page.tsx` | — | ✓ public landing |
| `app/layout.tsx` | — | ✓ every spec |
| `app/library/page.tsx` | — | ✓ `library.spec.ts` |
| `app/library/library-client.tsx` | ✓ | ✓ |
| `app/login/page.tsx` | — | ✓ `login.spec.ts` |
| `app/signup/page.tsx` | — | ✓ `signup.spec.ts` |
| `app/pending/page.tsx` | — | ✓ `signup.spec.ts` |
| `app/dashboard/page.tsx` | — | ✓ `dashboard.spec.ts` |
| `app/my-tutorials/page.tsx` | — | ✓ `dashboard.spec.ts` |
| `app/upload/page.tsx` | — | ✓ `upload-flow.spec.ts` |
| `app/tutorials/[id]/page.tsx` | — | ✓ `tutorial-detail.spec.ts` |
| `app/tutorials/[id]/edit/page.tsx` | — | ✓ `edit-tutorial.spec.ts` |
| `app/admin/page.tsx` | — | ✓ `admin-dashboard.spec.ts` |
| `app/admin/contributors/page.tsx` | — | ✓ `contributors.spec.ts` |
| `app/admin/review/page.tsx` | — | ✓ `review-flow.spec.ts` |
| `app/admin/review/[id]/page.tsx` | — | ✓ `review-flow.spec.ts` |
| `middleware.ts` | — | ✓ `login.spec.ts`, `signup.spec.ts` |

**Coverage note:** Next.js Server Component pages execute server-side; Playwright cannot produce line-level coverage for them. Coverage for pages is guaranteed by each E2E spec exercising all meaningful code paths (success, error, empty state, redirect), not by a percentage threshold.

**`packages/types/src/index.ts`** — pure TypeScript interfaces, no runtime coverage needed.

**Coverage rule:** Any new file added to `packages/api/src/` or `packages/web/lib/` or `packages/web/components/` must have a row in this table before it can be merged.

---

## Section 6 — Data cleanup strategy

### Integration tests — transaction rollback

Each test wraps its DB operations in a Postgres transaction that rolls back unconditionally in `afterEach`. No rows ever persist.

```ts
beforeEach(async () => { await db.query('BEGIN') })
afterEach(async () => { await db.query('ROLLBACK') })
```

### RLS integration tests — explicit cleanup

RLS tests require a real Supabase `authenticated` session, so transactions cannot be used (auth context is session-scoped). Each suite creates a test user with a unique email (`test-{uuid}@splat-test.local`) and deletes the user plus all their data in `afterAll`.

A manual cleanup script (`pnpm test:cleanup`) purges any remaining `@splat-test.local` accounts in case a test crashes before `afterAll` runs.

### E2E tests — seed + reset

`supabase db reset` runs before each full E2E suite, wiping local state and re-applying all migrations plus `supabase/seed.sql`. Each spec seeds only what it needs via the API. No per-test cleanup required.

---

## Section 7 — Deployment

| Package | Platform | Notes |
|---------|----------|-------|
| `packages/web` | Vercel | Zero-config Next.js deploy |
| `packages/api` | Railway | Node/Hono server, push-to-deploy |
| Database | Supabase cloud | Existing project, unchanged |

Local development uses local Supabase (`supabase start`) for both `api` and `web`.

```
Production:   web (Vercel) → api (Railway) → Supabase cloud
Development:  web (:3000)  → api (:3001)  → Supabase local (:54321)
```

---

## Section 8 — CI/CD pipeline

```yaml
jobs:
  unit:
    - pnpm install
    - pnpm --filter @splat-connect/api test:unit
    - pnpm --filter @splat-connect/web test:unit

  integration:
    needs: unit
    - supabase start
    - pnpm --filter @splat-connect/api test:integration
    - supabase stop

  e2e:
    needs: unit
    - supabase start
    - supabase db reset
    - pnpm --filter @splat-connect/api dev &
    - pnpm --filter @splat-connect/web dev &
    - pnpm --filter @splat-connect/web test:e2e
    - supabase stop
```

Unit tests run first. Integration and E2E only run if unit tests pass.
