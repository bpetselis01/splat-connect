# Comprehensive Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full test coverage (unit + integration + E2E) across `packages/api` and `packages/web` after the monorepo refactor from `2026-05-26-monorepo-refactor.md` is complete.

**Architecture:** Three test layers — Vitest unit tests (no network/DB, mocked Supabase) for API route logic and web components; Vitest integration tests against local Supabase (real DB, real RLS) for database correctness; Playwright E2E tests through the full running stack for user-journey coverage.

**Tech Stack:** Vitest 2, `@vitest/coverage-v8`, React Testing Library 16, `@testing-library/jest-dom`, jsdom, `@playwright/test` 1.44, local Supabase via Docker CLI

**Prerequisite:** `docs/superpowers/plans/2026-05-26-monorepo-refactor.md` must be complete and the app must be running locally.

**Spec:** `docs/superpowers/specs/2026-05-26-monorepo-architecture-testing-design.md`

---

## File Map

### Created — `packages/api`
- `packages/api/vitest.config.ts`
- `packages/api/tests/helpers/db.ts`
- `packages/api/tests/helpers/auth.ts`
- `packages/api/scripts/cleanup-test-users.ts`
- `packages/api/tests/unit/middleware/auth.test.ts`
- `packages/api/tests/unit/routes/tutorials.test.ts`
- `packages/api/tests/unit/routes/upload.test.ts`
- `packages/api/tests/unit/routes/parts.test.ts`
- `packages/api/tests/unit/routes/tools.test.ts`
- `packages/api/tests/unit/routes/stl-files.test.ts`
- `packages/api/tests/unit/routes/admin.test.ts`
- `packages/api/tests/unit/routes/contributors.test.ts`
- `packages/api/tests/integration/auth/signup.test.ts`
- `packages/api/tests/integration/auth/role-assignment.test.ts`
- `packages/api/tests/integration/tutorials/rls.test.ts`
- `packages/api/tests/integration/tutorials/status-flow.test.ts`
- `packages/api/tests/integration/tutorials/upsert-idempotency.test.ts`
- `packages/api/tests/integration/parts-tools/rls.test.ts`
- `packages/api/tests/integration/parts-tools/cascade.test.ts`
- `packages/api/tests/integration/storage/upload.test.ts`

### Created — `packages/web`
- `packages/web/vitest.config.ts`
- `packages/web/tests/unit/lib/validation.test.ts`
- `packages/web/tests/unit/lib/api-client.test.ts`
- `packages/web/tests/unit/components/nav.test.tsx`
- `packages/web/tests/unit/components/tutorial-card.test.tsx`
- `packages/web/tests/unit/components/difficulty-badge.test.tsx`
- `packages/web/tests/unit/components/file-drop-zone.test.tsx`
- `packages/web/tests/unit/components/buy-links-input.test.tsx`
- `packages/web/playwright.config.ts`
- `packages/web/tests/e2e/helpers/auth.ts`
- `packages/web/tests/e2e/auth/login.spec.ts`
- `packages/web/tests/e2e/auth/signup.spec.ts`
- `packages/web/tests/e2e/contributor/upload-flow.spec.ts`
- `packages/web/tests/e2e/contributor/dashboard.spec.ts`
- `packages/web/tests/e2e/contributor/edit-tutorial.spec.ts`
- `packages/web/tests/e2e/admin/admin-dashboard.spec.ts`
- `packages/web/tests/e2e/admin/review-flow.spec.ts`
- `packages/web/tests/e2e/admin/contributors.spec.ts`
- `packages/web/tests/e2e/public/library.spec.ts`
- `packages/web/tests/e2e/public/tutorial-detail.spec.ts`

### Created — root
- `supabase/seed.sql`
- `.github/workflows/ci.yml`

### Modified
- `packages/api/package.json` — add test scripts and vitest dep
- `packages/web/package.json` — add test scripts, vitest, RTL, playwright deps

---

## Task 9: Install test dependencies and configure Vitest for `packages/api`

**Files:**
- Modify: `packages/api/package.json`
- Create: `packages/api/vitest.config.ts`
- Create: `packages/api/tests/helpers/db.ts`
- Create: `packages/api/tests/helpers/auth.ts`
- Create: `packages/api/scripts/cleanup-test-users.ts`

- [ ] **Step 1: Add test dependencies to `packages/api/package.json`**

Add to `devDependencies` and add test scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "test:unit": "vitest run tests/unit --coverage",
    "test:integration": "vitest run tests/integration",
    "test": "vitest run --coverage"
  },
  "devDependencies": {
    "tsx": "^4",
    "typescript": "^5",
    "@types/node": "^20",
    "vitest": "^2",
    "@vitest/coverage-v8": "^2",
    "pg": "^8",
    "@types/pg": "^8"
  }
}
```

Run: `pnpm install`

- [ ] **Step 2: Create `packages/api/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
})
```

- [ ] **Step 3: Create `packages/api/tests/helpers/db.ts`**

Transaction-rollback helper for integration tests. Gives each test a clean database state without deleting rows — the transaction simply never commits.

```ts
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:54322/postgres',
})

export async function withRollback(fn: (client: pg.PoolClient) => Promise<void>): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await fn(client)
  } finally {
    await client.query('ROLLBACK')
    client.release()
  }
}

export async function closePool(): Promise<void> {
  await pool.end()
}
```

`DATABASE_URL` for local Supabase is `postgresql://postgres:postgres@localhost:54322/postgres` (port 54322 is the local Supabase Postgres port).

- [ ] **Step 4: Create `packages/api/tests/helpers/auth.ts`**

Test-user helper for RLS tests. Creates a real Supabase auth user and cleans up after the suite. Uses email domain `@splat-test.local` so the cleanup script can find and purge all test accounts.

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? 'http://localhost:54321'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export interface TestUser {
  id: string
  email: string
  token: string
}

export async function createTestUser(role: 'contributor' | 'admin' = 'contributor'): Promise<TestUser> {
  const admin = createClient(supabaseUrl, serviceKey)
  const email = `test-${crypto.randomUUID()}@splat-test.local`
  const password = 'Test1234!'

  const { data: signUpData, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (signUpError || !signUpData.user) throw new Error(`Failed to create test user: ${signUpError?.message}`)

  await admin.from('profiles').upsert({
    id: signUpData.user.id,
    role,
    is_approved: true,
  })

  const anonClient = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY ?? '')
  const { data: sessionData, error: sessionError } = await anonClient.auth.signInWithPassword({ email, password })
  if (sessionError || !sessionData.session) throw new Error(`Failed to sign in test user: ${sessionError?.message}`)

  return {
    id: signUpData.user.id,
    email,
    token: sessionData.session.access_token,
  }
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = createClient(supabaseUrl, serviceKey)
  await admin.auth.admin.deleteUser(userId)
}
```

- [ ] **Step 5: Create `packages/api/scripts/cleanup-test-users.ts`**

Run manually with `pnpm test:cleanup` to purge all `@splat-test.local` accounts left by crashed test runs.

```ts
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.SUPABASE_URL ?? 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
)

const { data, error } = await admin.auth.admin.listUsers()
if (error) { console.error(error); process.exit(1) }

const testUsers = data.users.filter((u) => u.email?.endsWith('@splat-test.local'))
console.log(`Found ${testUsers.length} test users to delete`)

for (const user of testUsers) {
  await admin.auth.admin.deleteUser(user.id)
  console.log(`Deleted ${user.email}`)
}
```

Add to `packages/api/package.json` scripts:

```json
"test:cleanup": "tsx scripts/cleanup-test-users.ts"
```

- [ ] **Step 6: Commit**

```bash
git add packages/api/vitest.config.ts packages/api/tests/helpers packages/api/scripts packages/api/package.json
git commit -m "test(api): add Vitest config and test helpers"
```

---

## Task 10: Unit tests — `packages/api` auth middleware

**Files:**
- Create: `packages/api/tests/unit/middleware/auth.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { authMiddleware } from '../../../src/middleware/auth.js'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../../src/supabase/client.js', () => ({
  createAdminClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

function makeApp() {
  const app = new Hono()
  app.use('*', authMiddleware)
  app.get('/test', (c) => c.json({ userId: c.get('userId'), role: c.get('role') }))
  return app
}

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when Authorization header is missing', async () => {
    const app = makeApp()
    const res = await app.request('/test')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/missing/i)
  })

  it('returns 401 when Authorization header is not Bearer', async () => {
    const app = makeApp()
    const res = await app.request('/test', { headers: { Authorization: 'Basic abc' } })
    expect(res.status).toBe(401)
  })

  it('returns 401 when JWT is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } })
    const app = makeApp()
    const res = await app.request('/test', { headers: { Authorization: 'Bearer bad-token' } })
    expect(res.status).toBe(401)
  })

  it('returns 403 when profile does not exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })
    mockFrom.mockReturnValue({ select: () => ({ eq: () => ({ single: () => ({ data: null, error: { message: 'not found' } }) }) }) })
    const app = makeApp()
    const res = await app.request('/test', { headers: { Authorization: 'Bearer valid-token' } })
    expect(res.status).toBe(403)
  })

  it('attaches userId and role to context on valid token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })
    mockFrom.mockReturnValue({ select: () => ({ eq: () => ({ single: () => ({ data: { role: 'contributor' }, error: null }) }) }) })
    const app = makeApp()
    const res = await app.request('/test', { headers: { Authorization: 'Bearer valid-token' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.userId).toBe('uid-1')
    expect(body.role).toBe('contributor')
  })
})
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
pnpm --filter @splat-connect/api test:unit 2>&1 | head -30
```

Expected: test file runs, all 5 tests fail (function not yet hooked up correctly via vi.mock).

- [ ] **Step 3: Run tests and verify they pass**

```bash
pnpm --filter @splat-connect/api test:unit
```

Expected: 5 tests pass. If mocking doesn't resolve correctly, check that `vi.mock` path matches the exact import path used in `auth.ts`.

- [ ] **Step 4: Commit**

```bash
git add packages/api/tests/unit/middleware
git commit -m "test(api): unit tests for auth middleware"
```

---

## Task 11: Unit tests — `packages/api` route handlers

**Files:**
- Create: `packages/api/tests/unit/routes/tutorials.test.ts`
- Create: `packages/api/tests/unit/routes/upload.test.ts`
- Create: `packages/api/tests/unit/routes/parts.test.ts`
- Create: `packages/api/tests/unit/routes/tools.test.ts`
- Create: `packages/api/tests/unit/routes/stl-files.test.ts`
- Create: `packages/api/tests/unit/routes/admin.test.ts`
- Create: `packages/api/tests/unit/routes/contributors.test.ts`

Each test file: creates a Hono app, sets the auth context variables on the middleware (bypassing real JWT auth), mounts the route, and calls it with `app.request()`.

- [ ] **Step 1: Write `packages/api/tests/unit/routes/tutorials.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockUserClient = { from: vi.fn() }
const mockAdminClient = { from: vi.fn() }

vi.mock('../../../src/supabase/user-client.js', () => ({ createUserClient: () => mockUserClient }))
vi.mock('../../../src/supabase/client.js', () => ({ createAdminClient: () => mockAdminClient }))

const { default: tutorials } = await import('../../../src/routes/tutorials.js')

function makeApp(role: 'contributor' | 'admin' = 'contributor') {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', role)
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', tutorials)
  return app
}

describe('GET /', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns tutorial list', async () => {
    mockUserClient.from.mockReturnValue({
      select: () => ({ order: () => ({ data: [{ id: '1', title: 'T1' }], error: null }) }),
    })
    const res = await makeApp().request('/')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].title).toBe('T1')
  })

  it('returns 500 on DB error', async () => {
    mockUserClient.from.mockReturnValue({
      select: () => ({ order: () => ({ data: null, error: { message: 'DB error' } }) }),
    })
    const res = await makeApp().request('/')
    expect(res.status).toBe(500)
  })
})

describe('GET /:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns single tutorial', async () => {
    mockUserClient.from.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { id: '1', title: 'T1' }, error: null }) }) }),
    })
    const res = await makeApp().request('/1')
    expect(res.status).toBe(200)
  })

  it('returns 404 when tutorial not found', async () => {
    mockUserClient.from.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: null, error: { message: 'not found' } }) }) }),
    })
    const res = await makeApp().request('/nonexistent')
    expect(res.status).toBe(404)
  })
})

describe('POST /', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts tutorial and returns 201', async () => {
    const created = { id: 'new-id', title: 'New Tutorial', status: 'draft' }
    mockUserClient.from.mockReturnValue({
      upsert: () => ({ select: () => ({ single: () => ({ data: created, error: null }) }) }),
    })
    const res = await makeApp().request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'new-id', title: 'New Tutorial', difficulty: 'easy' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.status).toBe('draft')
  })
})

describe('PATCH /:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates tutorial', async () => {
    const updated = { id: '1', status: 'pending' }
    mockUserClient.from.mockReturnValue({
      update: () => ({ eq: () => ({ select: () => ({ single: () => ({ data: updated, error: null }) }) }) }),
    })
    const res = await makeApp().request('/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes tutorial and returns 204', async () => {
    mockUserClient.from.mockReturnValue({
      delete: () => ({ eq: () => ({ error: null }) }),
    })
    const res = await makeApp().request('/1', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })
})
```

- [ ] **Step 2: Write `packages/api/tests/unit/routes/upload.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockStorage = {
  from: vi.fn(() => ({
    upload: vi.fn(() => ({ data: { path: 'test/tutorial.pdf' }, error: null })),
    getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/test/tutorial.pdf' } })),
  })),
}

vi.mock('../../../src/supabase/user-client.js', () => ({
  createUserClient: () => ({ storage: mockStorage }),
}))

const { default: upload } = await import('../../../src/routes/upload.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', 'contributor')
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', upload)
  return app
}

describe('POST /pdf', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when file is missing', async () => {
    const form = new FormData()
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/pdf', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  it('returns 400 when tutorialId is missing', async () => {
    const form = new FormData()
    form.append('file', new Blob(['pdf'], { type: 'application/pdf' }), 'file.pdf')
    const res = await makeApp().request('/pdf', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  it('uploads file and returns public URL', async () => {
    const form = new FormData()
    form.append('file', new Blob(['pdf'], { type: 'application/pdf' }), 'file.pdf')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/pdf', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('https://example.com/test/tutorial.pdf')
  })
})
```

- [ ] **Step 3: Write `packages/api/tests/unit/routes/parts.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockDeleteParts = vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) }))
const mockInsertParts = vi.fn(() => ({ select: vi.fn(() => ({ data: [], error: null })) }))
const mockFrom = vi.fn((table: string) => {
  if (table === 'parts') return { delete: mockDeleteParts, insert: mockInsertParts }
  return {}
})

vi.mock('../../../src/supabase/user-client.js', () => ({ createUserClient: () => ({ from: mockFrom }) }))

const { default: parts } = await import('../../../src/routes/parts.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', 'contributor')
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', parts)
  return app
}

describe('POST /:id/parts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('replaces parts and returns 201', async () => {
    const newParts = [{ name: 'Screw', quantity: 4, is_optional: false, buy_links: [] }]
    const res = await makeApp().request('/tutorial-1/parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: newParts }),
    })
    expect(res.status).toBe(201)
    expect(mockDeleteParts).toHaveBeenCalled()
    expect(mockInsertParts).toHaveBeenCalled()
  })
})

describe('DELETE /:id/parts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes parts and returns 204', async () => {
    const res = await makeApp().request('/tutorial-1/parts', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })
})
```

- [ ] **Step 4: Write `packages/api/tests/unit/routes/tools.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockDeleteTools = vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) }))
const mockInsertTools = vi.fn(() => ({ select: vi.fn(() => ({ data: [], error: null })) }))
const mockFrom = vi.fn((table: string) => {
  if (table === 'tools') return { delete: mockDeleteTools, insert: mockInsertTools }
  return {}
})

vi.mock('../../../src/supabase/user-client.js', () => ({ createUserClient: () => ({ from: mockFrom }) }))

const { default: tools } = await import('../../../src/routes/tools.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', 'contributor')
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', tools)
  return app
}

describe('POST /:id/tools', () => {
  beforeEach(() => vi.clearAllMocks())

  it('replaces tools and returns 201', async () => {
    const newTools = [{ name: 'Screwdriver', is_optional: false, buy_links: [] }]
    const res = await makeApp().request('/tutorial-1/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tools: newTools }),
    })
    expect(res.status).toBe(201)
    expect(mockDeleteTools).toHaveBeenCalled()
    expect(mockInsertTools).toHaveBeenCalled()
  })
})

describe('DELETE /:id/tools', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes tools and returns 204', async () => {
    const res = await makeApp().request('/tutorial-1/tools', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })
})
```

- [ ] **Step 5: Write `packages/api/tests/unit/routes/stl-files.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockDeleteStl = vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) }))
const mockInsertStl = vi.fn(() => ({ select: vi.fn(() => ({ data: [], error: null })) }))
const mockFrom = vi.fn((table: string) => {
  if (table === 'stl_files') return { delete: mockDeleteStl, insert: mockInsertStl }
  return {}
})

vi.mock('../../../src/supabase/user-client.js', () => ({ createUserClient: () => ({ from: mockFrom }) }))

const { default: stlFiles } = await import('../../../src/routes/stl-files.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', 'contributor')
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', stlFiles)
  return app
}

describe('POST /:id/stl-files', () => {
  beforeEach(() => vi.clearAllMocks())

  it('replaces STL files and returns 201', async () => {
    const files = [{ filename: 'bracket.stl', file_url: 'https://example.com/bracket.stl' }]
    const res = await makeApp().request('/tutorial-1/stl-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stl_files: files }),
    })
    expect(res.status).toBe(201)
    expect(mockDeleteStl).toHaveBeenCalled()
    expect(mockInsertStl).toHaveBeenCalled()
  })
})

describe('DELETE /:id/stl-files', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes STL files and returns 204', async () => {
    const res = await makeApp().request('/tutorial-1/stl-files', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })
})
```

- [ ] **Step 6: Write `packages/api/tests/unit/routes/admin.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockAdminFrom = vi.fn()
vi.mock('../../../src/supabase/client.js', () => ({ createAdminClient: () => ({ from: mockAdminFrom }) }))

const { default: admin } = await import('../../../src/routes/admin.js')

function makeApp(role: 'contributor' | 'admin') {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', role)
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', admin)
  return app
}

describe('admin role guard', () => {
  it('returns 403 for contributors', async () => {
    const res = await makeApp('contributor').request('/tutorials')
    expect(res.status).toBe(403)
  })
})

describe('GET /tutorials', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns pending tutorials for admin', async () => {
    mockAdminFrom.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => ({ data: [{ id: '1' }], error: null }) }) }),
    })
    const res = await makeApp('admin').request('/tutorials')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })
})

describe('PATCH /tutorials/:id/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates status', async () => {
    mockAdminFrom.mockReturnValue({
      update: () => ({ eq: () => ({ select: () => ({ single: () => ({ data: { id: '1', status: 'approved' }, error: null }) }) }) }),
    })
    const res = await makeApp('admin').request('/tutorials/1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('approved')
  })
})
```

- [ ] **Step 7: Write `packages/api/tests/unit/routes/contributors.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockAdminFrom = vi.fn()
const mockUserFrom = vi.fn()

vi.mock('../../../src/supabase/client.js', () => ({ createAdminClient: () => ({ from: mockAdminFrom }) }))
vi.mock('../../../src/supabase/user-client.js', () => ({ createUserClient: () => ({ from: mockUserFrom }) }))

const { default: contributors } = await import('../../../src/routes/contributors.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', 'contributor')
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', contributors)
  return app
}

describe('GET /me', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns current user profile', async () => {
    mockAdminFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { id: 'user-1', role: 'contributor' }, error: null }) }) }),
    })
    const res = await makeApp().request('/me')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('user-1')
  })

  it('returns 404 when profile not found', async () => {
    mockAdminFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: null, error: { message: 'not found' } }) }) }),
    })
    const res = await makeApp().request('/me')
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 8: Run all unit tests**

```bash
pnpm --filter @splat-connect/api test:unit
```

Expected: all tests pass. Coverage report generated — routes and middleware should be at 100%.

- [ ] **Step 9: Commit**

```bash
git add packages/api/tests/unit
git commit -m "test(api): unit tests for all route handlers"
```

---

## Task 12: Set up local Supabase and seed data

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Ensure Supabase CLI is installed**

```bash
supabase --version
```

Expected: `1.x.x` or higher. If not installed, follow https://supabase.com/docs/guides/cli/getting-started

- [ ] **Step 2: Start local Supabase**

From the repo root:

```bash
supabase start
```

Expected output includes:
```
API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
anon key: eyJ...
service_role key: eyJ...
```

Save these values — the integration tests need them in `packages/api/.env.test`.

- [ ] **Step 3: Create `packages/api/.env.test`**

```
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<anon key from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start output>
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

- [ ] **Step 4: Verify migrations applied**

```bash
supabase db status
```

Expected: all 4 migrations show as applied.

- [ ] **Step 5: Create `supabase/seed.sql`**

```sql
-- Seed data for local development and E2E tests.
-- Applied by `supabase db reset`.

-- Admin user (password: Admin1234!)
INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@splat-test.local',
  now(), now(), now()
) ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, role, name, is_approved)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin', 'Test Admin', true)
ON CONFLICT DO NOTHING;

-- Contributor user (password: Contributor1234!)
INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'contributor@splat-test.local',
  now(), now(), now()
) ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, role, name, is_approved)
VALUES ('00000000-0000-0000-0000-000000000002', 'contributor', 'Test Contributor', true)
ON CONFLICT DO NOTHING;

-- Approved tutorial for library browsing tests
INSERT INTO public.tutorials (id, title, difficulty, status, tutorial_pdf_url, toy_photo_url, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'Test: Switch Adaptation for Car Toy',
  'easy',
  'approved',
  'https://example.com/tutorial.pdf',
  'https://example.com/photo.jpg',
  now()
) ON CONFLICT DO NOTHING;

INSERT INTO public.tutorial_contributors (tutorial_id, profile_id)
VALUES ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO public.parts (tutorial_id, name, quantity, is_optional, buy_links)
VALUES ('00000000-0000-0000-0000-000000000010', 'Toggle Switch', 1, false, '[]')
ON CONFLICT DO NOTHING;

INSERT INTO public.tools (tutorial_id, name, is_optional, buy_links)
VALUES ('00000000-0000-0000-0000-000000000010', 'Soldering Iron', false, '[]')
ON CONFLICT DO NOTHING;
```

- [ ] **Step 6: Reset and verify seed applies**

```bash
supabase db reset
```

Expected: migrations re-applied, seed data inserted, no errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/seed.sql packages/api/.env.test
git commit -m "test: add local Supabase seed data and integration test env"
```

---

## Task 13: Integration tests — auth flows

**Files:**
- Create: `packages/api/tests/integration/auth/signup.test.ts`
- Create: `packages/api/tests/integration/auth/role-assignment.test.ts`

Update `packages/api/vitest.config.ts` to load `.env.test` for integration tests:

```ts
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  test: {
    globals: true,
    environment: 'node',
    env: loadEnv(mode, process.cwd(), ''),
    coverage: { /* ... same as before */ },
  },
}))
```

Run integration tests with: `vitest run tests/integration --mode test`

Add to `package.json` scripts: `"test:integration": "vitest run tests/integration --mode test"`

- [ ] **Step 1: Write `packages/api/tests/integration/auth/signup.test.ts`**

```ts
import { describe, it, expect, afterAll } from 'vitest'
import { createTestUser, deleteTestUser } from '../../helpers/auth.js'

const createdUserIds: string[] = []

afterAll(async () => {
  for (const id of createdUserIds) await deleteTestUser(id)
})

describe('signup and profile creation', () => {
  it('creates a user and profile row with contributor role', async () => {
    const user = await createTestUser('contributor')
    createdUserIds.push(user.id)

    expect(user.id).toBeTruthy()
    expect(user.token).toBeTruthy()
    expect(user.email).toMatch(/@splat-test\.local$/)
  })

  it('new user token is accepted by the auth middleware', async () => {
    const user = await createTestUser('contributor')
    createdUserIds.push(user.id)

    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${user.token}`,
      },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].role).toBe('contributor')
  })
})
```

- [ ] **Step 2: Write `packages/api/tests/integration/auth/role-assignment.test.ts`**

```ts
import { describe, it, expect, afterAll } from 'vitest'
import { createTestUser, deleteTestUser } from '../../helpers/auth.js'
import { createClient } from '@supabase/supabase-js'

const createdUserIds: string[] = []
afterAll(async () => { for (const id of createdUserIds) await deleteTestUser(id) })

describe('role-based access', () => {
  it('contributor cannot access admin endpoint', async () => {
    const contributor = await createTestUser('contributor')
    createdUserIds.push(contributor.id)

    const res = await fetch(`http://localhost:3001/api/admin/tutorials`, {
      headers: { Authorization: `Bearer ${contributor.token}` },
    })
    expect(res.status).toBe(403)
  })

  it('admin can access admin endpoint', async () => {
    const admin = await createTestUser('admin')
    createdUserIds.push(admin.id)

    const res = await fetch(`http://localhost:3001/api/admin/tutorials`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 3: Start the API server and run integration tests**

Terminal 1: `pnpm --filter @splat-connect/api dev`

Terminal 2:
```bash
pnpm --filter @splat-connect/api test:integration
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/api/tests/integration/auth packages/api/vitest.config.ts packages/api/package.json
git commit -m "test(api): integration tests for auth and role assignment"
```

---

## Task 14: Integration tests — tutorial RLS, status flow, and upsert idempotency

**Files:**
- Create: `packages/api/tests/integration/tutorials/rls.test.ts`
- Create: `packages/api/tests/integration/tutorials/status-flow.test.ts`
- Create: `packages/api/tests/integration/tutorials/upsert-idempotency.test.ts`

- [ ] **Step 1: Write `packages/api/tests/integration/tutorials/rls.test.ts`**

```ts
import { describe, it, expect, afterAll } from 'vitest'
import { createTestUser, deleteTestUser } from '../../helpers/auth.js'
import { createClient } from '@supabase/supabase-js'

const createdUserIds: string[] = []
afterAll(async () => { for (const id of createdUserIds) await deleteTestUser(id) })

describe('tutorial RLS policies', () => {
  it('contributor cannot read another contributor draft tutorial', async () => {
    const owner = await createTestUser('contributor')
    const other = await createTestUser('contributor')
    createdUserIds.push(owner.id, other.id)

    // Create a draft tutorial as owner
    const createRes = await fetch('http://localhost:3001/api/tutorials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({ id: crypto.randomUUID(), title: 'Owner Draft', difficulty: 'easy' }),
    })
    expect(createRes.status).toBe(201)
    const tutorial = await createRes.json()

    // Register owner as contributor
    await fetch(`http://localhost:3001/api/contributors/me/tutorials/${tutorial.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner.token}` },
    })

    // Other contributor tries to read it
    const readRes = await fetch(`http://localhost:3001/api/tutorials/${tutorial.id}`, {
      headers: { Authorization: `Bearer ${other.token}` },
    })
    expect(readRes.status).toBe(404)
  })

  it('contributor can read their own draft tutorial', async () => {
    const contributor = await createTestUser('contributor')
    createdUserIds.push(contributor.id)

    const id = crypto.randomUUID()
    const createRes = await fetch('http://localhost:3001/api/tutorials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${contributor.token}` },
      body: JSON.stringify({ id, title: 'My Draft', difficulty: 'easy' }),
    })
    expect(createRes.status).toBe(201)

    await fetch(`http://localhost:3001/api/contributors/me/tutorials/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${contributor.token}` },
    })

    const readRes = await fetch(`http://localhost:3001/api/tutorials/${id}`, {
      headers: { Authorization: `Bearer ${contributor.token}` },
    })
    expect(readRes.status).toBe(200)
  })
})
```

- [ ] **Step 2: Write `packages/api/tests/integration/tutorials/status-flow.test.ts`**

```ts
import { describe, it, expect, afterAll } from 'vitest'
import { createTestUser, deleteTestUser } from '../../helpers/auth.js'

const createdUserIds: string[] = []
afterAll(async () => { for (const id of createdUserIds) await deleteTestUser(id) })

describe('tutorial status transitions', () => {
  it('contributor can promote draft to pending', async () => {
    const contributor = await createTestUser('contributor')
    createdUserIds.push(contributor.id)

    const id = crypto.randomUUID()
    await fetch('http://localhost:3001/api/tutorials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${contributor.token}` },
      body: JSON.stringify({ id, title: 'Draft Tutorial', difficulty: 'easy' }),
    })

    await fetch(`http://localhost:3001/api/contributors/me/tutorials/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${contributor.token}` },
    })

    const patchRes = await fetch(`http://localhost:3001/api/tutorials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${contributor.token}` },
      body: JSON.stringify({ status: 'pending' }),
    })
    expect(patchRes.status).toBe(200)
    const body = await patchRes.json()
    expect(body.status).toBe('pending')
  })

  it('contributor cannot set status to approved directly', async () => {
    const contributor = await createTestUser('contributor')
    createdUserIds.push(contributor.id)

    const id = crypto.randomUUID()
    await fetch('http://localhost:3001/api/tutorials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${contributor.token}` },
      body: JSON.stringify({ id, title: 'Sneaky Tutorial', difficulty: 'easy' }),
    })

    await fetch(`http://localhost:3001/api/contributors/me/tutorials/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${contributor.token}` },
    })

    const patchRes = await fetch(`http://localhost:3001/api/tutorials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${contributor.token}` },
      body: JSON.stringify({ status: 'approved' }),
    })
    expect(patchRes.status).not.toBe(200)
  })

  it('admin can approve a pending tutorial', async () => {
    const contributor = await createTestUser('contributor')
    const admin = await createTestUser('admin')
    createdUserIds.push(contributor.id, admin.id)

    const id = crypto.randomUUID()
    await fetch('http://localhost:3001/api/tutorials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${contributor.token}` },
      body: JSON.stringify({ id, title: 'Review Me', difficulty: 'easy' }),
    })

    await fetch(`http://localhost:3001/api/contributors/me/tutorials/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${contributor.token}` },
    })

    await fetch(`http://localhost:3001/api/tutorials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${contributor.token}` },
      body: JSON.stringify({ status: 'pending' }),
    })

    const approveRes = await fetch(`http://localhost:3001/api/admin/tutorials/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
      body: JSON.stringify({ status: 'approved' }),
    })
    expect(approveRes.status).toBe(200)
    const body = await approveRes.json()
    expect(body.status).toBe('approved')
  })
})
```

- [ ] **Step 3: Write `packages/api/tests/integration/tutorials/upsert-idempotency.test.ts`**

```ts
import { describe, it, expect, afterAll } from 'vitest'
import { createTestUser, deleteTestUser } from '../../helpers/auth.js'

const createdUserIds: string[] = []
afterAll(async () => { for (const id of createdUserIds) await deleteTestUser(id) })

describe('upsert idempotency', () => {
  it('creating the same tutorial twice does not produce a duplicate key error', async () => {
    const contributor = await createTestUser('contributor')
    createdUserIds.push(contributor.id)

    const id = crypto.randomUUID()
    const payload = { id, title: 'My Tutorial', difficulty: 'easy' }

    const first = await fetch('http://localhost:3001/api/tutorials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${contributor.token}` },
      body: JSON.stringify(payload),
    })
    expect(first.status).toBe(201)

    const second = await fetch('http://localhost:3001/api/tutorials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${contributor.token}` },
      body: JSON.stringify(payload),
    })
    expect(second.status).toBe(201)
  })
})
```

- [ ] **Step 4: Run integration tests**

With API server still running:

```bash
pnpm --filter @splat-connect/api test:integration
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/api/tests/integration/tutorials
git commit -m "test(api): integration tests for tutorial RLS, status flow, and upsert"
```

---

## Task 15: Integration tests — parts-tools RLS, cascade, and storage

**Files:**
- Create: `packages/api/tests/integration/parts-tools/rls.test.ts`
- Create: `packages/api/tests/integration/parts-tools/cascade.test.ts`
- Create: `packages/api/tests/integration/storage/upload.test.ts`

- [ ] **Step 1: Write `packages/api/tests/integration/parts-tools/rls.test.ts`**

```ts
import { describe, it, expect, afterAll } from 'vitest'
import { createTestUser, deleteTestUser } from '../../helpers/auth.js'

const createdUserIds: string[] = []
afterAll(async () => { for (const id of createdUserIds) await deleteTestUser(id) })

describe('parts RLS', () => {
  it('contributor can insert parts into their own draft tutorial', async () => {
    const contributor = await createTestUser('contributor')
    createdUserIds.push(contributor.id)

    const id = crypto.randomUUID()
    await fetch('http://localhost:3001/api/tutorials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${contributor.token}` },
      body: JSON.stringify({ id, title: 'My Tutorial', difficulty: 'easy' }),
    })

    await fetch(`http://localhost:3001/api/contributors/me/tutorials/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${contributor.token}` },
    })

    const partsRes = await fetch(`http://localhost:3001/api/tutorials/${id}/parts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${contributor.token}` },
      body: JSON.stringify({ parts: [{ name: 'Screw', quantity: 2, is_optional: false, buy_links: [] }] }),
    })
    expect(partsRes.status).toBe(201)
  })

  it('contributor cannot insert parts into another contributor draft tutorial', async () => {
    const owner = await createTestUser('contributor')
    const attacker = await createTestUser('contributor')
    createdUserIds.push(owner.id, attacker.id)

    const id = crypto.randomUUID()
    await fetch('http://localhost:3001/api/tutorials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({ id, title: 'Owner Tutorial', difficulty: 'easy' }),
    })

    await fetch(`http://localhost:3001/api/contributors/me/tutorials/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner.token}` },
    })

    const partsRes = await fetch(`http://localhost:3001/api/tutorials/${id}/parts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${attacker.token}` },
      body: JSON.stringify({ parts: [{ name: 'Screw', quantity: 2, is_optional: false, buy_links: [] }] }),
    })
    expect(partsRes.status).not.toBe(201)
  })
})
```

- [ ] **Step 2: Write `packages/api/tests/integration/parts-tools/cascade.test.ts`**

```ts
import { describe, it, expect, afterAll } from 'vitest'
import { createTestUser, deleteTestUser } from '../../helpers/auth.js'
import { createClient } from '@supabase/supabase-js'

const createdUserIds: string[] = []
afterAll(async () => { for (const id of createdUserIds) await deleteTestUser(id) })

describe('cascade delete', () => {
  it('deleting a tutorial removes its parts and tools', async () => {
    const contributor = await createTestUser('contributor')
    createdUserIds.push(contributor.id)

    const id = crypto.randomUUID()
    await fetch('http://localhost:3001/api/tutorials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${contributor.token}` },
      body: JSON.stringify({ id, title: 'To Delete', difficulty: 'easy' }),
    })

    await fetch(`http://localhost:3001/api/contributors/me/tutorials/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${contributor.token}` },
    })

    await fetch(`http://localhost:3001/api/tutorials/${id}/parts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${contributor.token}` },
      body: JSON.stringify({ parts: [{ name: 'Widget', quantity: 1, is_optional: false, buy_links: [] }] }),
    })

    const deleteRes = await fetch(`http://localhost:3001/api/tutorials/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${contributor.token}` },
    })
    expect(deleteRes.status).toBe(204)

    // Verify parts are gone via service-role Supabase client
    const admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await admin.from('parts').select('*').eq('tutorial_id', id)
    expect(data).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Write `packages/api/tests/integration/storage/upload.test.ts`**

```ts
import { describe, it, expect, afterAll } from 'vitest'
import { createTestUser, deleteTestUser } from '../../helpers/auth.js'

const createdUserIds: string[] = []
afterAll(async () => { for (const id of createdUserIds) await deleteTestUser(id) })

describe('file upload', () => {
  it('uploads a PDF and returns a public URL', async () => {
    const contributor = await createTestUser('contributor')
    createdUserIds.push(contributor.id)

    const form = new FormData()
    form.append('file', new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'tutorial.pdf')
    form.append('tutorialId', crypto.randomUUID())

    const res = await fetch('http://localhost:3001/api/upload/pdf', {
      method: 'POST',
      headers: { Authorization: `Bearer ${contributor.token}` },
      body: form,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toMatch(/^http/)
  })

  it('uploads a photo and returns a public URL', async () => {
    const contributor = await createTestUser('contributor')
    createdUserIds.push(contributor.id)

    const form = new FormData()
    form.append('file', new Blob(['fake-image'], { type: 'image/jpeg' }), 'photo.jpg')
    form.append('tutorialId', crypto.randomUUID())

    const res = await fetch('http://localhost:3001/api/upload/photo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${contributor.token}` },
      body: form,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toMatch(/^http/)
  })
})
```

- [ ] **Step 4: Run all integration tests**

```bash
pnpm --filter @splat-connect/api test:integration
```

Expected: all integration tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/api/tests/integration/parts-tools packages/api/tests/integration/storage
git commit -m "test(api): integration tests for parts-tools RLS, cascade, and storage"
```

---

## Task 16: Configure Vitest for `packages/web` and write lib unit tests

**Files:**
- Modify: `packages/web/package.json`
- Create: `packages/web/vitest.config.ts`
- Create: `packages/web/tests/unit/lib/validation.test.ts`
- Create: `packages/web/tests/unit/lib/api-client.test.ts`

- [ ] **Step 1: Add test dependencies to `packages/web/package.json`**

```json
{
  "scripts": {
    "test:unit": "vitest run tests/unit --coverage",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "vitest": "^2",
    "@vitest/coverage-v8": "^2",
    "@vitejs/plugin-react": "^4",
    "@testing-library/react": "^16",
    "@testing-library/jest-dom": "^6",
    "jsdom": "^24",
    "@playwright/test": "^1.44"
  }
}
```

Run: `pnpm install`

- [ ] **Step 2: Create `packages/web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'lib/**/*.tsx', 'components/**/*.tsx'],
      exclude: ['lib/supabase/**'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 3: Create `packages/web/tests/unit/setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Write `packages/web/tests/unit/lib/validation.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { canAdvanceFromStep, canSubmit } from '@/lib/validation'
import type { UploadDraft } from '@splat-connect/types'

const baseDraft: UploadDraft = {
  title: 'Test Tutorial',
  difficulty: 'easy',
  tutorial_pdf_url: 'https://example.com/tutorial.pdf',
  toy_photo_url: 'https://example.com/photo.jpg',
  parts: [{ name: 'Screw', quantity: 2, is_optional: false, buy_links: [] }],
  tools: [{ name: 'Screwdriver', is_optional: false, buy_links: [] }],
  stl_files: [],
}

describe('canAdvanceFromStep', () => {
  describe('step 1', () => {
    it('returns true with valid title and difficulty', () => {
      expect(canAdvanceFromStep(1, baseDraft)).toBe(true)
    })

    it('returns false with empty title', () => {
      expect(canAdvanceFromStep(1, { ...baseDraft, title: '' })).toBe(false)
    })

    it('returns false with whitespace-only title', () => {
      expect(canAdvanceFromStep(1, { ...baseDraft, title: '   ' })).toBe(false)
    })

    it('returns false with invalid difficulty', () => {
      expect(canAdvanceFromStep(1, { ...baseDraft, difficulty: 'extreme' })).toBe(false)
    })

    it('returns true for each valid difficulty', () => {
      expect(canAdvanceFromStep(1, { ...baseDraft, difficulty: 'easy' })).toBe(true)
      expect(canAdvanceFromStep(1, { ...baseDraft, difficulty: 'medium' })).toBe(true)
      expect(canAdvanceFromStep(1, { ...baseDraft, difficulty: 'hard' })).toBe(true)
    })
  })

  describe('step 2', () => {
    it('returns true with both URLs present', () => {
      expect(canAdvanceFromStep(2, baseDraft)).toBe(true)
    })

    it('returns false with missing pdf URL', () => {
      expect(canAdvanceFromStep(2, { ...baseDraft, tutorial_pdf_url: '' })).toBe(false)
    })

    it('returns false with missing photo URL', () => {
      expect(canAdvanceFromStep(2, { ...baseDraft, toy_photo_url: '' })).toBe(false)
    })
  })

  describe('step 3', () => {
    it('returns true with at least one valid part', () => {
      expect(canAdvanceFromStep(3, baseDraft)).toBe(true)
    })

    it('returns false with empty parts array', () => {
      expect(canAdvanceFromStep(3, { ...baseDraft, parts: [] })).toBe(false)
    })

    it('returns false when part name is empty', () => {
      expect(canAdvanceFromStep(3, { ...baseDraft, parts: [{ name: '', quantity: 1, is_optional: false, buy_links: [] }] })).toBe(false)
    })

    it('returns false when quantity is zero', () => {
      expect(canAdvanceFromStep(3, { ...baseDraft, parts: [{ name: 'Screw', quantity: 0, is_optional: false, buy_links: [] }] })).toBe(false)
    })

    it('returns false when quantity is non-integer', () => {
      expect(canAdvanceFromStep(3, { ...baseDraft, parts: [{ name: 'Screw', quantity: 1.5, is_optional: false, buy_links: [] }] })).toBe(false)
    })
  })

  describe('step 4', () => {
    it('returns true with at least one valid tool', () => {
      expect(canAdvanceFromStep(4, baseDraft)).toBe(true)
    })

    it('returns false with empty tools array', () => {
      expect(canAdvanceFromStep(4, { ...baseDraft, tools: [] })).toBe(false)
    })

    it('returns false when tool name is empty', () => {
      expect(canAdvanceFromStep(4, { ...baseDraft, tools: [{ name: '', is_optional: false, buy_links: [] }] })).toBe(false)
    })
  })

  describe('step 5', () => {
    it('always returns true (STL files are optional)', () => {
      expect(canAdvanceFromStep(5, { ...baseDraft, stl_files: [] })).toBe(true)
    })
  })

  describe('step 6', () => {
    it('returns true when all required steps pass', () => {
      expect(canAdvanceFromStep(6, baseDraft)).toBe(true)
    })
  })

  describe('unknown step', () => {
    it('returns false for unknown step numbers', () => {
      expect(canAdvanceFromStep(99, baseDraft)).toBe(false)
    })
  })
})

describe('canSubmit', () => {
  it('returns true when all required fields are valid', () => {
    expect(canSubmit(baseDraft)).toBe(true)
  })

  it('returns false when title is missing', () => {
    expect(canSubmit({ ...baseDraft, title: '' })).toBe(false)
  })

  it('returns false when parts are empty', () => {
    expect(canSubmit({ ...baseDraft, parts: [] })).toBe(false)
  })
})
```

- [ ] **Step 5: Write `packages/web/tests/unit/lib/api-client.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/headers and @supabase/ssr before importing api-client
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ getAll: () => [] })),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() => ({
        data: { session: { access_token: 'mock-token' } },
      })),
    },
  })),
}))

// Mock server-only so it doesn't throw in test env
vi.mock('server-only', () => ({}))

const fetchMock = vi.fn()
global.fetch = fetchMock

const { apiClient } = await import('@/lib/api-client')

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.API_URL = 'http://localhost:3001'
  })

  it('GET attaches Authorization header and returns parsed JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: '1' }]),
    })

    const result = await apiClient.get('/api/tutorials')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/tutorials',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer mock-token' }),
      })
    )
    expect(result).toEqual([{ id: '1' }])
  })

  it('throws on non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 })
    await expect(apiClient.get('/api/admin/tutorials')).rejects.toThrow('403')
  })

  it('POST sends JSON body', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'new' }) })
    await apiClient.post('/api/tutorials', { title: 'Test' })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ title: 'Test' }) })
    )
  })
})
```

- [ ] **Step 6: Run unit tests**

```bash
pnpm --filter @splat-connect/web test:unit
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/web/vitest.config.ts packages/web/tests/unit/lib packages/web/tests/unit/setup.ts packages/web/package.json
git commit -m "test(web): Vitest config and unit tests for validation and api-client"
```

---

## Task 17: Unit tests — `packages/web` components

**Files:**
- Create: `packages/web/tests/unit/components/nav.test.tsx`
- Create: `packages/web/tests/unit/components/tutorial-card.test.tsx`
- Create: `packages/web/tests/unit/components/difficulty-badge.test.tsx`
- Create: `packages/web/tests/unit/components/file-drop-zone.test.tsx`
- Create: `packages/web/tests/unit/components/buy-links-input.test.tsx`

- [ ] **Step 1: Write `packages/web/tests/unit/components/difficulty-badge.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DifficultyBadge } from '@/components/difficulty-badge'

describe('DifficultyBadge', () => {
  it('renders easy badge', () => {
    render(<DifficultyBadge difficulty="easy" />)
    expect(screen.getByText('easy')).toBeInTheDocument()
  })

  it('renders medium badge', () => {
    render(<DifficultyBadge difficulty="medium" />)
    expect(screen.getByText('medium')).toBeInTheDocument()
  })

  it('renders hard badge', () => {
    render(<DifficultyBadge difficulty="hard" />)
    expect(screen.getByText('hard')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Write `packages/web/tests/unit/components/nav.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Nav } from '@/components/nav'

describe('Nav', () => {
  it('renders library link for unauthenticated users', () => {
    render(<Nav role={null} />)
    expect(screen.getByRole('link', { name: /library/i })).toBeInTheDocument()
  })

  it('renders dashboard link for contributors', () => {
    render(<Nav role="contributor" />)
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
  })

  it('renders admin link for admin users', () => {
    render(<Nav role="admin" />)
    expect(screen.getByRole('link', { name: /admin/i })).toBeInTheDocument()
  })

  it('does not render dashboard link for admin users', () => {
    render(<Nav role="admin" />)
    expect(screen.queryByRole('link', { name: /dashboard/i })).toBeNull()
  })

  it('does not render admin link for contributors', () => {
    render(<Nav role="contributor" />)
    expect(screen.queryByRole('link', { name: /admin/i })).toBeNull()
  })
})
```

- [ ] **Step 3: Write `packages/web/tests/unit/components/tutorial-card.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TutorialCard } from '@/components/tutorial-card'
import type { Tutorial } from '@splat-connect/types'

const mockTutorial: Tutorial = {
  id: '1',
  title: 'Switch Adaptation Tutorial',
  difficulty: 'easy',
  status: 'approved',
  description: 'A helpful tutorial',
  tutorial_pdf_url: 'https://example.com/tutorial.pdf',
  toy_photo_url: 'https://example.com/photo.jpg',
  created_at: '2026-01-01T00:00:00Z',
}

describe('TutorialCard', () => {
  it('renders tutorial title', () => {
    render(<TutorialCard tutorial={mockTutorial} />)
    expect(screen.getByText('Switch Adaptation Tutorial')).toBeInTheDocument()
  })

  it('renders difficulty badge', () => {
    render(<TutorialCard tutorial={mockTutorial} />)
    expect(screen.getByText('easy')).toBeInTheDocument()
  })

  it('renders a link to the tutorial', () => {
    render(<TutorialCard tutorial={mockTutorial} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', expect.stringContaining('/tutorials/1'))
  })
})
```

- [ ] **Step 4: Write `packages/web/tests/unit/components/file-drop-zone.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FileDropZone } from '@/components/file-drop-zone'

describe('FileDropZone', () => {
  it('renders label text', () => {
    render(<FileDropZone label="Upload PDF" accept=".pdf" onChange={() => {}} />)
    expect(screen.getByText('Upload PDF')).toBeInTheDocument()
  })

  it('calls onChange when file is selected', () => {
    const handleChange = vi.fn()
    render(<FileDropZone label="Upload PDF" accept=".pdf" onChange={handleChange} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'tutorial.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(handleChange).toHaveBeenCalled()
  })

  it('shows selected filename after selection', () => {
    render(<FileDropZone label="Upload PDF" accept=".pdf" onChange={() => {}} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'tutorial.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(screen.getByText('tutorial.pdf')).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Write `packages/web/tests/unit/components/buy-links-input.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BuyLinksInput } from '@/components/buy-links-input'

describe('BuyLinksInput', () => {
  it('renders add button', () => {
    render(<BuyLinksInput value={[]} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument()
  })

  it('calls onChange when a buy link is added', () => {
    const handleChange = vi.fn()
    render(<BuyLinksInput value={[]} onChange={handleChange} />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ label: '', url: '' })])
    )
  })

  it('renders existing buy links', () => {
    render(
      <BuyLinksInput
        value={[{ label: 'Amazon', url: 'https://amazon.com/product' }]}
        onChange={() => {}}
      />
    )
    expect(screen.getByDisplayValue('Amazon')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://amazon.com/product')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run all web unit tests**

```bash
pnpm --filter @splat-connect/web test:unit
```

Expected: all tests pass. Coverage should be at 100% for `lib/` and `components/`.

- [ ] **Step 7: Commit**

```bash
git add packages/web/tests/unit/components
git commit -m "test(web): unit tests for all components"
```

---

## Task 18: Configure Playwright and write E2E auth tests

**Files:**
- Create: `packages/web/playwright.config.ts`
- Create: `packages/web/tests/e2e/helpers/auth.ts`
- Create: `packages/web/tests/e2e/auth/login.spec.ts`
- Create: `packages/web/tests/e2e/auth/signup.spec.ts`

- [ ] **Step 1: Install Playwright browsers**

```bash
pnpm --filter @splat-connect/web exec playwright install --with-deps chromium
```

- [ ] **Step 2: Create `packages/web/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
```

- [ ] **Step 3: Create `packages/web/tests/e2e/helpers/auth.ts`**

Reusable login helper for E2E tests. Seeds are from `supabase/seed.sql`.

```ts
import type { Page } from '@playwright/test'

export const TEST_CONTRIBUTOR = {
  email: 'contributor@splat-test.local',
  password: 'Contributor1234!',
}

export const TEST_ADMIN = {
  email: 'admin@splat-test.local',
  password: 'Admin1234!',
}

export async function loginAs(page: Page, user: { email: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(user.email)
  await page.getByLabel(/password/i).fill(user.password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'))
}

export async function logout(page: Page) {
  const logoutBtn = page.getByRole('button', { name: /sign out|logout/i })
  if (await logoutBtn.isVisible()) await logoutBtn.click()
}
```

**Note:** The seed passwords in `supabase/seed.sql` use `INSERT INTO auth.users` without the hashed password field. Update the seed to include a known bcrypt-hashed password, or use `supabase.auth.admin.createUser` in a seed script instead. The seed SQL in Task 12 needs an `encrypted_password` column to work with direct sign-in. Add to `supabase/seed.sql`:

```sql
-- Passwords for test users (bcrypt hash of 'Admin1234!' and 'Contributor1234!')
-- Generate with: node -e "const b = require('bcryptjs'); console.log(b.hashSync('Admin1234!', 10))"
-- Or use supabase auth.admin API in a setup script instead of SQL inserts
```

The simplest approach for local E2E: use a `global-setup.ts` Playwright file to create seed users via the API before tests run:

Create `packages/web/tests/e2e/global-setup.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

export default async function globalSetup() {
  const admin = createClient(
    process.env.SUPABASE_URL ?? 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )

  for (const user of [
    { email: 'admin@splat-test.local', password: 'Admin1234!', role: 'admin' },
    { email: 'contributor@splat-test.local', password: 'Contributor1234!', role: 'contributor' },
  ]) {
    const existing = await admin.auth.admin.listUsers()
    const found = existing.data.users.find((u) => u.email === user.email)
    if (!found) {
      const { data } = await admin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      })
      if (data.user) {
        await admin.from('profiles').upsert({ id: data.user.id, role: user.role, is_approved: true })
      }
    }
  }
}
```

Update `playwright.config.ts` to use it:

```ts
globalSetup: './tests/e2e/global-setup.ts',
```

Add to `packages/web/.env.test` (create if needed):

```
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

- [ ] **Step 4: Write `packages/web/tests/e2e/auth/login.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { loginAs, TEST_CONTRIBUTOR, TEST_ADMIN } from '../helpers/auth'

test.describe('login', () => {
  test('contributor is redirected to dashboard after login', async ({ page }) => {
    await loginAs(page, TEST_CONTRIBUTOR)
    await expect(page).toHaveURL(/dashboard|my-tutorials/)
  })

  test('admin is redirected to admin page after login', async ({ page }) => {
    await loginAs(page, TEST_ADMIN)
    await expect(page).toHaveURL(/admin/)
  })

  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('nobody@example.com')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible()
  })

  test('unauthenticated access to /dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/login/)
  })
})
```

- [ ] **Step 5: Write `packages/web/tests/e2e/auth/signup.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test.describe('signup', () => {
  test('new user signup redirects to pending page', async ({ page }) => {
    const email = `e2e-${Date.now()}@splat-test.local`
    await page.goto('/signup')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill('NewUser1234!')
    await page.getByRole('button', { name: /sign up|create/i }).click()
    await expect(page).toHaveURL(/pending/)
  })
})
```

- [ ] **Step 6: Start both servers and run E2E auth tests**

Terminal 1: `pnpm --filter @splat-connect/api dev`
Terminal 2: `pnpm --filter @splat-connect/web dev`

Terminal 3:
```bash
pnpm --filter @splat-connect/web test:e2e --grep "login|signup"
```

Expected: all auth tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/web/playwright.config.ts packages/web/tests/e2e/auth packages/web/tests/e2e/helpers packages/web/tests/e2e/global-setup.ts
git commit -m "test(web): Playwright config and E2E auth tests"
```

---

## Task 19: E2E tests — contributor and admin flows

**Files:**
- Create: `packages/web/tests/e2e/contributor/upload-flow.spec.ts`
- Create: `packages/web/tests/e2e/contributor/dashboard.spec.ts`
- Create: `packages/web/tests/e2e/contributor/edit-tutorial.spec.ts`
- Create: `packages/web/tests/e2e/admin/admin-dashboard.spec.ts`
- Create: `packages/web/tests/e2e/admin/review-flow.spec.ts`
- Create: `packages/web/tests/e2e/admin/contributors.spec.ts`

- [ ] **Step 1: Write `packages/web/tests/e2e/contributor/dashboard.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { loginAs, TEST_CONTRIBUTOR } from '../helpers/auth'

test.describe('contributor dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_CONTRIBUTOR)
    await page.goto('/dashboard')
  })

  test('shows stat cards', async ({ page }) => {
    await expect(page.getByText(/draft|pending|approved|rejected/i).first()).toBeVisible()
  })

  test('shows link to upload page', async ({ page }) => {
    await expect(page.getByRole('link', { name: /upload/i })).toBeVisible()
  })
})
```

- [ ] **Step 2: Write `packages/web/tests/e2e/contributor/upload-flow.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { loginAs, TEST_CONTRIBUTOR } from '../helpers/auth'
import path from 'path'

test.describe('upload flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_CONTRIBUTOR)
    await page.goto('/upload')
  })

  test('step 1: fills title and difficulty and advances', async ({ page }) => {
    await page.getByLabel(/title/i).fill('E2E Test Tutorial')
    await page.getByLabel(/difficulty/i).selectOption('easy')
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText(/step 2|pdf|photo/i)).toBeVisible()
  })

  test('next button is disabled without required fields on step 1', async ({ page }) => {
    const nextBtn = page.getByRole('button', { name: /next/i })
    await expect(nextBtn).toBeDisabled()
  })
})
```

- [ ] **Step 3: Write `packages/web/tests/e2e/contributor/edit-tutorial.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { loginAs, TEST_CONTRIBUTOR } from '../helpers/auth'

test.describe('edit tutorial', () => {
  test('my-tutorials page shows a list of tutorials', async ({ page }) => {
    await loginAs(page, TEST_CONTRIBUTOR)
    await page.goto('/my-tutorials')
    await expect(page.getByRole('table')).toBeVisible()
  })
})
```

- [ ] **Step 4: Write `packages/web/tests/e2e/admin/admin-dashboard.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { loginAs, TEST_ADMIN } from '../helpers/auth'

test.describe('admin dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_ADMIN)
    await page.goto('/admin')
  })

  test('shows pending count stat', async ({ page }) => {
    await expect(page.getByText(/pending/i)).toBeVisible()
  })

  test('shows link to review queue', async ({ page }) => {
    await expect(page.getByRole('link', { name: /review/i })).toBeVisible()
  })
})
```

- [ ] **Step 5: Write `packages/web/tests/e2e/admin/review-flow.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { loginAs, TEST_ADMIN } from '../helpers/auth'

test.describe('review queue', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_ADMIN)
    await page.goto('/admin/review')
  })

  test('shows the review queue page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /review/i })).toBeVisible()
  })
})
```

- [ ] **Step 6: Write `packages/web/tests/e2e/admin/contributors.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { loginAs, TEST_ADMIN } from '../helpers/auth'

test.describe('contributors page', () => {
  test('admin can view contributors list', async ({ page }) => {
    await loginAs(page, TEST_ADMIN)
    await page.goto('/admin/contributors')
    await expect(page.getByRole('table')).toBeVisible()
  })
})
```

- [ ] **Step 7: Run contributor and admin E2E tests**

```bash
pnpm --filter @splat-connect/web test:e2e
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/web/tests/e2e/contributor packages/web/tests/e2e/admin
git commit -m "test(web): E2E tests for contributor and admin flows"
```

---

## Task 20: E2E tests — public flows and CI/CD

**Files:**
- Create: `packages/web/tests/e2e/public/library.spec.ts`
- Create: `packages/web/tests/e2e/public/tutorial-detail.spec.ts`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write `packages/web/tests/e2e/public/library.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test.describe('library (public)', () => {
  test('anonymous visitor can view the library', async ({ page }) => {
    await page.goto('/library')
    await expect(page.getByRole('heading', { name: /library/i })).toBeVisible()
  })

  test('approved tutorial card appears in library', async ({ page }) => {
    await page.goto('/library')
    await expect(page.getByText('Switch Adaptation for Car Toy')).toBeVisible()
  })

  test('library is accessible without login', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /library/i }).click()
    await expect(page).toHaveURL(/library/)
    await expect(page.getByRole('heading')).toBeVisible()
  })
})
```

- [ ] **Step 2: Write `packages/web/tests/e2e/public/tutorial-detail.spec.ts`**

The seed tutorial ID is `00000000-0000-0000-0000-000000000010`.

```ts
import { test, expect } from '@playwright/test'

const SEED_TUTORIAL_ID = '00000000-0000-0000-0000-000000000010'

test.describe('tutorial detail (public)', () => {
  test('shows tutorial title, parts, and tools', async ({ page }) => {
    await page.goto(`/tutorials/${SEED_TUTORIAL_ID}`)
    await expect(page.getByText('Switch Adaptation for Car Toy')).toBeVisible()
    await expect(page.getByText('Toggle Switch')).toBeVisible()
    await expect(page.getByText('Soldering Iron')).toBeVisible()
  })

  test('shows parts section', async ({ page }) => {
    await page.goto(`/tutorials/${SEED_TUTORIAL_ID}`)
    await expect(page.getByRole('heading', { name: /parts/i })).toBeVisible()
  })

  test('shows tools section', async ({ page }) => {
    await page.goto(`/tutorials/${SEED_TUTORIAL_ID}`)
    await expect(page.getByRole('heading', { name: /tools/i })).toBeVisible()
  })
})
```

- [ ] **Step 3: Run full E2E suite**

```bash
pnpm --filter @splat-connect/web test:e2e
```

Expected: all E2E tests pass.

- [ ] **Step 4: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  unit:
    name: Unit tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm --filter @splat-connect/api test:unit
      - run: pnpm --filter @splat-connect/web test:unit

  integration:
    name: Integration tests
    runs-on: ubuntu-latest
    needs: unit
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase start
      - run: pnpm --filter @splat-connect/api dev &
        env:
          SUPABASE_URL: http://localhost:54321
          SUPABASE_ANON_KEY: ${{ env.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ env.SUPABASE_SERVICE_ROLE_KEY }}
      - run: sleep 3
      - run: pnpm --filter @splat-connect/api test:integration
        env:
          SUPABASE_URL: http://localhost:54321
          SUPABASE_ANON_KEY: ${{ env.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ env.SUPABASE_SERVICE_ROLE_KEY }}
          DATABASE_URL: postgresql://postgres:postgres@localhost:54322/postgres

  e2e:
    name: E2E tests
    runs-on: ubuntu-latest
    needs: unit
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase start
      - run: supabase db reset
      - run: pnpm --filter @splat-connect/api dev &
        env:
          SUPABASE_URL: http://localhost:54321
          SUPABASE_ANON_KEY: ${{ env.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ env.SUPABASE_SERVICE_ROLE_KEY }}
      - run: pnpm --filter @splat-connect/web dev &
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ env.SUPABASE_ANON_KEY }}
          API_URL: http://localhost:3001
          NEXT_PUBLIC_API_URL: http://localhost:3001
      - run: sleep 10
      - run: pnpm --filter @splat-connect/web exec playwright install --with-deps chromium
      - run: pnpm --filter @splat-connect/web test:e2e
        env:
          SUPABASE_URL: http://localhost:54321
          SUPABASE_SERVICE_ROLE_KEY: ${{ env.SUPABASE_SERVICE_ROLE_KEY }}
```

**Note:** The `${{ env.SUPABASE_ANON_KEY }}` and `${{ env.SUPABASE_SERVICE_ROLE_KEY }}` values are output by `supabase start`. In CI, capture them with:

```yaml
- run: |
    supabase start
    echo "SUPABASE_ANON_KEY=$(supabase status --output env | grep ANON_KEY | cut -d= -f2)" >> $GITHUB_ENV
    echo "SUPABASE_SERVICE_ROLE_KEY=$(supabase status --output env | grep SERVICE_ROLE_KEY | cut -d= -f2)" >> $GITHUB_ENV
```

Replace the `supabase start` and env steps with this single step.

- [ ] **Step 5: Final typecheck across all packages**

```bash
pnpm -r typecheck
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add packages/web/tests/e2e/public .github
git commit -m "test(web): public E2E tests and CI/CD pipeline"
```

---

## Phase 2 Complete

All three test layers are in place:

| Layer | Command | What it covers |
|-------|---------|---------------|
| Unit (API) | `pnpm --filter @splat-connect/api test:unit` | Route handlers, auth middleware |
| Integration | `pnpm --filter @splat-connect/api test:integration` | RLS, status flow, upsert, storage |
| Unit (Web) | `pnpm --filter @splat-connect/web test:unit` | Components, validation, api-client |
| E2E | `pnpm --filter @splat-connect/web test:e2e` | Full user journeys |
| CI | Runs all on PR/push to main | |

Coverage for `packages/api` routes and middleware is enforced at 100% by Vitest thresholds. Any new file in `packages/api/src/` or `packages/web/lib/` or `packages/web/components/` must have a corresponding row added to `docs/superpowers/specs/2026-05-26-monorepo-architecture-testing-design.md` Section 5 before merging.
