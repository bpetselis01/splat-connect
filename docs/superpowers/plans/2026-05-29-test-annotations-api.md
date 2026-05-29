# Test Annotations — API Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add plain-English inline comments to all 8 unit test files in `packages/api` so a reader can understand what each test checks, how it works, and how the tested code connects to the rest of the app.

**Architecture:** Each task annotates one file. Comments follow a strict 3-line format (`// Tests:` / `// How:` / `// Chain:`) above every `it()` block, plus a `// --- Mock strategy ---` block before the `vi.mock()` calls. No production code is touched. One commit per file.

**Tech Stack:** Vitest, Hono, Supabase (mocked), TypeScript

---

### Task 1: Annotate `auth.test.ts` (middleware)

**Files:**
- Modify: `packages/api/tests/unit/middleware/auth.test.ts`

- [ ] **Step 1: Write the annotated file**

Replace the entire file with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../../../src/middleware/auth.js'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

// --- Mock strategy ---
// Replaces the Supabase admin client with two controlled fakes so tests run without a real
// database or network. mockGetUser stands in for Supabase's JWT validation endpoint;
// mockFrom stands in for the profile table lookup that determines the user's role.
vi.mock('../../../src/supabase/client.js', () => ({
  createAdminClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', authMiddleware)
  app.get('/test', (c) => c.json({ userId: c.get('userId'), role: c.get('role') }))
  return app
}

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Tests: requests with no Authorization header are rejected before any route logic runs
  // How:   sends a bare request to /test with no headers; checks status 401 and error body mentions "missing"
  // Chain: the middleware short-circuits the request before route handlers execute → every protected
  //        API endpoint relies on this to prevent unauthenticated access to data
  it('returns 401 when Authorization header is missing', async () => {
    const app = makeApp()
    const res = await app.request('/test')
    expect(res.status).toBe(401)
    const body = await res.json() as any
    expect(body.error).toMatch(/missing/i)
  })

  // Tests: only Bearer tokens are accepted — other schemes like Basic are rejected
  // How:   sends "Authorization: Basic abc"; expects 401 with no DB calls made
  // Chain: enforces that only Supabase JWTs reach the route layer → prevents credential-stuffing
  //        with non-JWT tokens from reaching any downstream data access
  it('returns 401 when Authorization header is not Bearer', async () => {
    const app = makeApp()
    const res = await app.request('/test', { headers: { Authorization: 'Basic abc' } })
    expect(res.status).toBe(401)
  })

  // Tests: a syntactically valid Bearer header containing an invalid or expired JWT is rejected
  // How:   mockGetUser returns { data: { user: null }, error }; expects 401
  // Chain: only cryptographically valid Supabase JWTs proceed → route handlers always receive
  //        a trusted, verified user ID and can trust c.get('userId') is real
  it('returns 401 when JWT is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } })
    const app = makeApp()
    const res = await app.request('/test', { headers: { Authorization: 'Bearer bad-token' } })
    expect(res.status).toBe(401)
  })

  // Tests: a valid JWT whose user has no profile row in the DB returns 403
  // How:   mockGetUser returns a real user; mockFrom returns no profile data; expects 403
  // Chain: blocks users authenticated with Supabase who were never given a profile row →
  //        role-based access in every downstream route depends on the profile existing
  it('returns 403 when profile does not exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: null, error: { message: 'not found' } }) }) }),
    })
    const app = makeApp()
    const res = await app.request('/test', { headers: { Authorization: 'Bearer valid-token' } })
    expect(res.status).toBe(403)
  })

  // Tests: a fully valid request gets userId and role attached to the Hono request context
  // How:   mockGetUser returns a user; mockFrom returns { role: 'contributor' }; /test echoes context values
  // Chain: all route handlers read c.get('userId') and c.get('role') to filter data and check
  //        permissions — this is the foundation of all role-based access in the API
  it('attaches userId and role to context on valid token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { role: 'contributor' }, error: null }) }) }),
    })
    const app = makeApp()
    const res = await app.request('/test', { headers: { Authorization: 'Bearer valid-token' } })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.userId).toBe('uid-1')
    expect(body.role).toBe('contributor')
  })
})
```

- [ ] **Step 2: Run the test to confirm nothing broke**

```
cd packages/api && pnpm test -- tests/unit/middleware/auth.test.ts
```
Expected: 5 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/api/tests/unit/middleware/auth.test.ts
git commit -m "docs(tests): annotate auth.test.ts"
```

---

### Task 2: Annotate `tutorials.test.ts`

**Files:**
- Modify: `packages/api/tests/unit/routes/tutorials.test.ts`

- [ ] **Step 1: Write the annotated file**

Replace the entire file with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockUserClient = { from: vi.fn() }
const mockAdminClient = { from: vi.fn() }

// --- Mock strategy ---
// Replaces both Supabase clients (user and admin) with minimal fake objects so tests run
// without a real database. makeApp() bypasses real auth by injecting fake userId, role,
// approved, and token directly into the Hono context, isolating the route logic under test.
vi.mock('../../../src/supabase/user-client.js', () => ({ createUserClient: () => mockUserClient }))
vi.mock('../../../src/supabase/client.js', () => ({ createAdminClient: () => mockAdminClient }))

const { default: tutorials } = await import('../../../src/routes/tutorials.js')

function makeApp(role: 'contributor' | 'admin' = 'contributor', approved = true) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', role)
    c.set('approved', approved)
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', tutorials)
  return app
}

describe('GET /', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: GET / returns the full list of tutorials as JSON
  // How:   mockUserClient.from returns a fake select/order chain with one tutorial; checks status 200 and body
  // Chain: the web layer calls GET /api/tutorials to populate the library page → users see the
  //        tutorial grid with all available approved tutorials
  it('returns tutorial list', async () => {
    mockUserClient.from.mockReturnValue({
      select: () => ({ order: () => ({ data: [{ id: '1', title: 'T1' }], error: null }) }),
    })
    const res = await makeApp().request('/')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body).toHaveLength(1)
    expect(body[0].title).toBe('T1')
  })

  // Tests: GET / returns 500 when the database query fails
  // How:   mockUserClient.from returns { data: null, error: { message: 'DB error' } }; checks status 500
  // Chain: the web layer receives an error response → the library page can display an error
  //        state instead of silently rendering an empty list
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

  // Tests: GET /:id returns a single tutorial by ID as JSON
  // How:   mockUserClient.from returns a select/eq/single chain with one tutorial; checks status 200
  // Chain: the web layer calls this to populate the tutorial detail page → users can read the
  //        full tutorial content including PDF link, parts, and tools
  it('returns single tutorial', async () => {
    mockUserClient.from.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { id: '1', title: 'T1' }, error: null }) }) }),
    })
    const res = await makeApp().request('/1')
    expect(res.status).toBe(200)
  })

  // Tests: GET /:id returns 404 when no tutorial exists with that ID
  // How:   mockUserClient.from returns { data: null, error: { message: 'not found' } }; checks status 404
  // Chain: the web layer receives a 404 → the detail page shows a "not found" message instead
  //        of crashing with a null data error when the component tries to render
  it('returns 404 when tutorial not found', async () => {
    mockUserClient.from.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: null, error: { message: 'not found' } }) }) }),
    })
    const res = await makeApp().request('/nonexistent')
    expect(res.status).toBe(404)
  })
})

describe('GET /mine', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: GET /mine returns only tutorials belonging to the currently authenticated user
  // How:   mockUserClient.from returns a chain with .eq() filtering by user; checks status 200 and body
  // Chain: the web layer calls this to populate the contributor's "My Tutorials" dashboard →
  //        contributors see only their own drafts and submissions, not other users' work
  it('returns tutorials for current user', async () => {
    mockUserClient.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({ data: [{ id: '1', title: 'Mine' }], error: null }),
        }),
      }),
    })
    const res = await makeApp().request('/mine')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body).toHaveLength(1)
    expect(body[0].title).toBe('Mine')
  })

  // Tests: GET /mine returns 500 when the database query fails
  // How:   mockUserClient.from returns { data: null, error } through the eq/order chain; checks status 500
  // Chain: the web layer receives an error response → the dashboard page can show an error
  //        state rather than silently rendering an empty list
  it('returns 500 on DB error', async () => {
    mockUserClient.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    })
    const res = await makeApp().request('/mine')
    expect(res.status).toBe(500)
  })
})

describe('POST /', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: POST / creates a new tutorial draft and returns 201 with the created record
  // How:   mockAdminClient.from returns an insert/select/single chain; checks status 201 and body.status
  // Chain: the upload wizard calls this on Step 1 Next → the tutorial ID is stored in client
  //        state so all subsequent steps PATCH the same record
  it('inserts tutorial and returns 201', async () => {
    const created = { id: 'new-id', title: 'New Tutorial', status: 'draft' }
    mockAdminClient.from.mockReturnValue({
      insert: () => ({ select: () => ({ single: () => ({ data: created, error: null }) }) }),
    })
    const res = await makeApp().request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'new-id', title: 'New Tutorial', difficulty: 'easy' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.status).toBe('draft')
  })

  // Tests: POST / returns 403 when the contributor is not yet approved by an admin
  // How:   makeApp('contributor', false) sets approved=false in context; checks status 403 with no DB call
  // Chain: unapproved contributors cannot create tutorials → admins control who can submit
  //        content, preventing untrusted users from cluttering the pending review queue
  it('returns 403 when user is not approved', async () => {
    const res = await makeApp('contributor', false).request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'new-id', title: 'New Tutorial', difficulty: 'easy' }),
    })
    expect(res.status).toBe(403)
  })

  // Tests: POST / returns 200 with the existing ID when the same tutorial ID is submitted twice
  // How:   mockAdminClient.from returns Postgres error code '23505' (unique violation); checks status 200 and body.id
  // Chain: the upload wizard can safely retry Step 1 Next after a network failure without
  //        creating duplicate draft records — idempotent behaviour keeps data clean
  it('returns 200 with id on duplicate key (idempotent retry)', async () => {
    mockAdminClient.from.mockReturnValue({
      insert: () => ({
        select: () => ({
          single: () => ({ data: null, error: { code: '23505', message: 'duplicate' } }),
        }),
      }),
    })
    const res = await makeApp().request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'existing-id', title: 'Existing', difficulty: 'hard' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.id).toBe('existing-id')
  })
})

describe('PATCH /:id', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: PATCH /:id updates the tutorial record and returns 200 with the updated data
  // How:   mockUserClient.from returns an update/eq/select/single chain; checks status 200
  // Chain: the upload wizard calls this on each step after Step 1 to save progress →
  //        the tutorial record in the DB is kept in sync with the wizard state step by step
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

  // Tests: PATCH /:id returns 500 when the database update fails
  // How:   mockUserClient.from returns { data: null, error } through the update chain; checks status 500
  // Chain: the upload wizard receives 500 → the UI can show an error and keep the user on
  //        the current step rather than advancing with unsaved data
  it('returns 500 on DB error', async () => {
    mockUserClient.from.mockReturnValue({
      update: () => ({
        eq: () => ({
          select: () => ({ single: () => ({ data: null, error: { message: 'DB error' } }) }),
        }),
      }),
    })
    const res = await makeApp().request('/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /:id', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: DELETE /:id removes the tutorial record and returns 204 No Content
  // How:   mockUserClient.from returns a delete/eq chain with { error: null }; checks status 204
  // Chain: the dashboard delete action calls this → the tutorial is removed from the DB and
  //        disappears from the contributor's "My Tutorials" list on next load
  it('deletes tutorial and returns 204', async () => {
    mockUserClient.from.mockReturnValue({
      delete: () => ({ eq: () => ({ error: null }) }),
    })
    const res = await makeApp().request('/1', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/api && pnpm test -- tests/unit/routes/tutorials.test.ts
```
Expected: 12 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/api/tests/unit/routes/tutorials.test.ts
git commit -m "docs(tests): annotate tutorials.test.ts"
```

---

### Task 3: Annotate `parts.test.ts`

**Files:**
- Modify: `packages/api/tests/unit/routes/parts.test.ts`

- [ ] **Step 1: Write the annotated file**

Replace the entire file with (the existing WHY/HOW comments are absorbed into the mock-strategy block):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

// --- Mock strategy ---
// Replaces the Supabase user client with controlled delete and insert fakes. Mocks are
// declared without a fixed return shape so individual tests can override them in beforeEach —
// a fixed shape defined at module level would prevent error-path tests from overriding it
// (the fixed shape always wins over a per-test override in Vitest).
const mockDeleteParts = vi.fn()
const mockInsertParts = vi.fn()
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
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteParts.mockReturnValue({ eq: vi.fn(() => ({ error: null })) })
    mockInsertParts.mockReturnValue({ select: vi.fn(() => ({ data: [], error: null })) })
  })

  // Tests: POST /:id/parts deletes the existing parts list then inserts the new one, returning 201
  // How:   mockDeleteParts and mockInsertParts are verified to have been called; checks status 201
  // Chain: the upload wizard calls this on Step 3 Next → the parts list in the DB is fully
  //        replaced each time, so back-and-forward navigation always results in the latest list
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

  // Tests: POST /:id/parts returns 500 when the insert step fails
  // How:   mockInsertParts is overridden to return { data: null, error }; checks status 500
  // Chain: the upload wizard receives 500 → the UI can display an error and keep the user
  //        on Step 3 rather than advancing with unsaved parts data
  it('returns 500 when insert fails', async () => {
    mockInsertParts.mockReturnValue({ select: vi.fn(() => ({ data: null, error: { message: 'insert error' } })) })
    const newParts = [{ name: 'Screw', quantity: 4, is_optional: false, buy_links: [] }]
    const res = await makeApp().request('/tutorial-1/parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: newParts }),
    })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /:id/parts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteParts.mockReturnValue({ eq: vi.fn(() => ({ error: null })) })
    mockInsertParts.mockReturnValue({ select: vi.fn(() => ({ data: [], error: null })) })
  })

  // Tests: DELETE /:id/parts removes all parts for a tutorial and returns 204 No Content
  // How:   mockDeleteParts is pre-configured to succeed; checks status 204
  // Chain: the edit page calls this when a user clears all parts → the DB is cleared and
  //        the tutorial detail page no longer lists any parts
  it('deletes parts and returns 204', async () => {
    const res = await makeApp().request('/tutorial-1/parts', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })

  // Tests: DELETE /:id/parts returns 500 when the database delete fails
  // How:   mockDeleteParts is overridden to return { error: { message: 'delete error' } }; checks status 500
  // Chain: the edit page receives 500 → the UI can display a failure message and the existing
  //        parts remain in the DB unchanged
  it('returns 500 when delete fails', async () => {
    mockDeleteParts.mockReturnValue({ eq: vi.fn(() => ({ error: { message: 'delete error' } })) })
    const res = await makeApp().request('/tutorial-1/parts', { method: 'DELETE' })
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/api && pnpm test -- tests/unit/routes/parts.test.ts
```
Expected: 4 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/api/tests/unit/routes/parts.test.ts
git commit -m "docs(tests): annotate parts.test.ts"
```

---

### Task 4: Annotate `tools.test.ts`

**Files:**
- Modify: `packages/api/tests/unit/routes/tools.test.ts`

- [ ] **Step 1: Write the annotated file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

// --- Mock strategy ---
// Replaces the Supabase user client with controlled delete and insert fakes. Mocks are
// declared without a fixed return shape so individual tests can override them in beforeEach —
// a fixed shape defined at module level would prevent error-path tests from overriding it
// (the fixed shape always wins over a per-test override in Vitest).
const mockDeleteTools = vi.fn()
const mockInsertTools = vi.fn()
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
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteTools.mockReturnValue({ eq: vi.fn(() => ({ error: null })) })
    mockInsertTools.mockReturnValue({ select: vi.fn(() => ({ data: [], error: null })) })
  })

  // Tests: POST /:id/tools deletes the existing tools list then inserts the new one, returning 201
  // How:   mockDeleteTools and mockInsertTools are verified to have been called; checks status 201
  // Chain: the upload wizard calls this on Step 4 Next → the tools list in the DB is fully
  //        replaced, so back-and-forward navigation always results in the latest list
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

  // Tests: POST /:id/tools returns 500 when the insert step fails
  // How:   mockInsertTools is overridden to return { data: null, error }; checks status 500
  // Chain: the upload wizard receives 500 → the UI keeps the user on Step 4 and displays
  //        an error rather than advancing with unsaved tools data
  it('returns 500 when insert fails', async () => {
    mockInsertTools.mockReturnValue({ select: vi.fn(() => ({ data: null, error: { message: 'insert error' } })) })
    const newTools = [{ name: 'Screwdriver', is_optional: false, buy_links: [] }]
    const res = await makeApp().request('/tutorial-1/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tools: newTools }),
    })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /:id/tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteTools.mockReturnValue({ eq: vi.fn(() => ({ error: null })) })
    mockInsertTools.mockReturnValue({ select: vi.fn(() => ({ data: [], error: null })) })
  })

  // Tests: DELETE /:id/tools removes all tools for a tutorial and returns 204 No Content
  // How:   mockDeleteTools is pre-configured to succeed; checks status 204
  // Chain: the edit page calls this when a user clears all tools → the DB is cleared and
  //        the tutorial detail page no longer lists any tools
  it('deletes tools and returns 204', async () => {
    const res = await makeApp().request('/tutorial-1/tools', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })

  // Tests: DELETE /:id/tools returns 500 when the database delete fails
  // How:   mockDeleteTools is overridden to return { error: { message: 'delete error' } }; checks status 500
  // Chain: the edit page receives 500 → the UI displays a failure message and the existing
  //        tools remain in the DB unchanged
  it('returns 500 when delete fails', async () => {
    mockDeleteTools.mockReturnValue({ eq: vi.fn(() => ({ error: { message: 'delete error' } })) })
    const res = await makeApp().request('/tutorial-1/tools', { method: 'DELETE' })
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/api && pnpm test -- tests/unit/routes/tools.test.ts
```
Expected: 4 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/api/tests/unit/routes/tools.test.ts
git commit -m "docs(tests): annotate tools.test.ts"
```

---

### Task 5: Annotate `stl-files.test.ts`

**Files:**
- Modify: `packages/api/tests/unit/routes/stl-files.test.ts`

- [ ] **Step 1: Write the annotated file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

// --- Mock strategy ---
// Replaces the Supabase user client with controlled delete and insert fakes. Mocks are
// declared without a fixed return shape so individual tests can override them in beforeEach —
// a fixed shape defined at module level would prevent error-path tests from overriding it
// (the fixed shape always wins over a per-test override in Vitest).
const mockDeleteStl = vi.fn()
const mockInsertStl = vi.fn()
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
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteStl.mockReturnValue({ eq: vi.fn(() => ({ error: null })) })
    mockInsertStl.mockReturnValue({ select: vi.fn(() => ({ data: [], error: null })) })
  })

  // Tests: POST /:id/stl-files deletes existing STL file records then inserts the new list, returning 201
  // How:   mockDeleteStl and mockInsertStl are verified to have been called; checks status 201
  // Chain: the upload wizard calls this on Step 5 Next (only when files were added) → the
  //        stl_files table is fully replaced so the tutorial always reflects the latest file list
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

  // Tests: POST /:id/stl-files returns 500 when the insert step fails
  // How:   mockInsertStl is overridden to return { data: null, error }; checks status 500
  // Chain: the upload wizard receives 500 → the UI displays an error and keeps the user on
  //        Step 5, preventing a tutorial from advancing with missing STL download links
  it('returns 500 when insert fails', async () => {
    mockInsertStl.mockReturnValue({ select: vi.fn(() => ({ data: null, error: { message: 'insert error' } })) })
    const files = [{ filename: 'bracket.stl', file_url: 'https://example.com/bracket.stl' }]
    const res = await makeApp().request('/tutorial-1/stl-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stl_files: files }),
    })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /:id/stl-files', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteStl.mockReturnValue({ eq: vi.fn(() => ({ error: null })) })
    mockInsertStl.mockReturnValue({ select: vi.fn(() => ({ data: [], error: null })) })
  })

  // Tests: DELETE /:id/stl-files removes all STL file records for a tutorial and returns 204
  // How:   mockDeleteStl is pre-configured to succeed; checks status 204
  // Chain: the edit page calls this when a user removes all STL files → the DB records are
  //        cleared and the tutorial detail page no longer shows any download links
  it('deletes STL files and returns 204', async () => {
    const res = await makeApp().request('/tutorial-1/stl-files', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })

  // Tests: DELETE /:id/stl-files returns 500 when the database delete fails
  // How:   mockDeleteStl is overridden to return { error: { message: 'delete error' } }; checks status 500
  // Chain: the edit page receives 500 → the UI displays a failure message and the existing
  //        STL file records remain in the DB unchanged
  it('returns 500 when delete fails', async () => {
    mockDeleteStl.mockReturnValue({ eq: vi.fn(() => ({ error: { message: 'delete error' } })) })
    const res = await makeApp().request('/tutorial-1/stl-files', { method: 'DELETE' })
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/api && pnpm test -- tests/unit/routes/stl-files.test.ts
```
Expected: 4 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/api/tests/unit/routes/stl-files.test.ts
git commit -m "docs(tests): annotate stl-files.test.ts"
```

---

### Task 6: Annotate `upload.test.ts`

**Files:**
- Modify: `packages/api/tests/unit/routes/upload.test.ts`

- [ ] **Step 1: Write the annotated file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockAdminList = vi.fn()
const mockAdminRemove = vi.fn()
const mockAdminStorageBucket = { list: mockAdminList, remove: mockAdminRemove }
const mockAdminStorage = { from: vi.fn(() => mockAdminStorageBucket) }

const mockUpload = vi.fn()
const mockGetPublicUrl = vi.fn()
const mockUserStorageBucket = { upload: mockUpload, getPublicUrl: mockGetPublicUrl }
const mockUserStorage = { from: vi.fn(() => mockUserStorageBucket) }

// --- Mock strategy ---
// Two Supabase storage clients are mocked: the admin client (mockAdminList, mockAdminRemove)
// is used by the photo route to list and delete existing photos before uploading a replacement;
// the user client (mockUpload, mockGetPublicUrl) is used by all three upload routes to upload
// files and retrieve their public CDN URLs. No real files are sent to Supabase in any test.
vi.mock('../../../src/supabase/client.js', () => ({
  createAdminClient: () => ({ storage: mockAdminStorage }),
}))

vi.mock('../../../src/supabase/user-client.js', () => ({
  createUserClient: () => ({ storage: mockUserStorage }),
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
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue({ data: { path: 'tid-1/tutorial.pdf' }, error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/tid-1/tutorial.pdf' } })
  })

  // Tests: POST /pdf returns 400 when no file is included in the form data
  // How:   sends FormData with only tutorialId; checks status 400
  // Chain: the upload wizard receives 400 → the UI keeps the user on Step 2 and prompts
  //        them to select a file before allowing Next
  it('returns 400 when file is missing', async () => {
    const form = new FormData()
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/pdf', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  // Tests: POST /pdf returns 400 when the tutorialId field is missing from the form data
  // How:   sends FormData with only the file; checks status 400
  // Chain: prevents orphaned PDF files from being stored in Supabase storage with no
  //        tutorial record to link them to
  it('returns 400 when tutorialId is missing', async () => {
    const form = new FormData()
    form.append('file', new Blob(['pdf'], { type: 'application/pdf' }), 'file.pdf')
    const res = await makeApp().request('/pdf', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  // Tests: POST /pdf uploads the file to Supabase storage and returns the public URL
  // How:   mockUpload and mockGetPublicUrl resolve successfully; checks status 200 and body.url
  // Chain: the returned URL is PATCHed onto the tutorial record via the next API call →
  //        the tutorial's PDF is accessible to users via the public CDN URL
  it('uploads file and returns public URL', async () => {
    const form = new FormData()
    form.append('file', new Blob(['pdf'], { type: 'application/pdf' }), 'file.pdf')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/pdf', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.url).toBe('https://example.com/tid-1/tutorial.pdf')
  })
})

describe('POST /photo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminList.mockResolvedValue({ data: [], error: null })
    mockAdminRemove.mockResolvedValue({ error: null })
    mockUpload.mockResolvedValue({ data: { path: 'tid-1/photo.png' }, error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/tid-1/photo.png' } })
  })

  // Tests: POST /photo returns 400 when no photo file is in the form data
  // How:   sends FormData with only tutorialId; checks status 400
  // Chain: the upload wizard keeps the user on Step 2 until a photo is provided →
  //        every published tutorial has a visible cover image
  it('returns 400 when file is missing', async () => {
    const form = new FormData()
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  // Tests: POST /photo returns 400 when tutorialId is missing from the form data
  // How:   sends FormData with only the file; checks status 400
  // Chain: prevents photos from being stored in Supabase storage with no tutorial to attach to
  it('returns 400 when tutorialId is missing', async () => {
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  // Tests: POST /photo lists and deletes any existing photos before uploading the new one
  // How:   mockAdminList returns one existing file; verifies mockAdminRemove was called with the correct path
  // Chain: ensures each tutorial has exactly one cover photo at a time → prevents orphaned
  //        old images from accumulating in Supabase storage
  it('calls remove with correct paths when existing files are present', async () => {
    mockAdminList.mockResolvedValue({ data: [{ name: 'photo.jpg' }], error: null })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    expect(mockAdminList).toHaveBeenCalledWith('tid-1')
    expect(mockAdminRemove).toHaveBeenCalledWith(['tid-1/photo.jpg'])
  })

  // Tests: POST /photo skips the delete step when there are no existing photos for the tutorial
  // How:   mockAdminList returns an empty array; verifies mockAdminRemove was not called
  // Chain: avoids an unnecessary storage API call on the first upload → the route handles
  //        both first-time uploads and replacements without branching logic in the caller
  it('does not call remove when no existing files', async () => {
    mockAdminList.mockResolvedValue({ data: [], error: null })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    expect(mockAdminRemove).not.toHaveBeenCalled()
  })

  // Tests: POST /photo returns 500 when the Supabase storage upload fails
  // How:   mockUpload resolves with { data: null, error: { message: 'Storage error' } }; checks status 500
  // Chain: the upload wizard receives 500 → the UI displays the error message and keeps the
  //        user on Step 2 so they can retry the photo upload
  it('returns 500 when upload fails', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'Storage error' } })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
    expect(res.status).toBe(500)
  })

  // Tests: POST /photo uploads with the correct storage path pattern and returns 200 with url
  // How:   verifies mockUpload was called with 'tid-1/photo.png' and upsert:false; checks body.url
  // Chain: the URL is stored on the tutorial record and served as the cover image → users see
  //        the tutorial photo in the library card and on the tutorial detail page
  it('returns 200 with url on success', async () => {
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.url).toBe('https://example.com/tid-1/photo.png')
    expect(mockUpload).toHaveBeenCalledWith(
      'tid-1/photo.png',
      expect.any(Blob),
      { upsert: false }
    )
  })
})

describe('POST /stl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue({ data: { path: 'tid-1/bracket.stl' }, error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/tid-1/bracket.stl' } })
  })

  // Tests: POST /stl returns 400 when no STL file is in the form data
  // How:   sends FormData with only tutorialId; checks status 400
  // Chain: the upload wizard skips this endpoint when no STL files were added (it checks
  //        the array length) — this 400 is a safety net for direct API misuse
  it('returns 400 when file is missing', async () => {
    const form = new FormData()
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/stl', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  // Tests: POST /stl returns 400 when tutorialId is missing
  // How:   sends FormData with only the file; checks status 400
  // Chain: prevents STL files from being orphaned in storage with no tutorial to link them to
  it('returns 400 when tutorialId is missing', async () => {
    const form = new FormData()
    form.append('file', new Blob(['stl'], { type: 'model/stl' }), 'bracket.stl')
    const res = await makeApp().request('/stl', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  // Tests: POST /stl returns 500 when the Supabase storage upload fails
  // How:   mockUpload resolves with { data: null, error }; checks status 500
  // Chain: the upload wizard receives 500 → the STL URL is not stored, preventing a broken
  //        download link from appearing on the tutorial detail page
  it('returns 500 when upload fails', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'Storage error' } })
    const form = new FormData()
    form.append('file', new Blob(['stl'], { type: 'model/stl' }), 'bracket.stl')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/stl', { method: 'POST', body: form })
    expect(res.status).toBe(500)
  })

  // Tests: POST /stl uploads the file and returns 200 with both the public URL and original filename
  // How:   mockUpload and mockGetPublicUrl resolve successfully; checks body.url and body.filename
  // Chain: both values are stored in the stl_files table → the tutorial detail page displays
  //        the original filename as the download link label and the URL as the href
  it('returns 200 with url and filename on success', async () => {
    const form = new FormData()
    form.append('file', new Blob(['stl'], { type: 'model/stl' }), 'bracket.stl')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/stl', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.url).toBe('https://example.com/tid-1/bracket.stl')
    expect(body.filename).toBe('bracket.stl')
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/api && pnpm test -- tests/unit/routes/upload.test.ts
```
Expected: 13 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/api/tests/unit/routes/upload.test.ts
git commit -m "docs(tests): annotate upload.test.ts"
```

---

### Task 7: Annotate `admin.test.ts`

**Files:**
- Modify: `packages/api/tests/unit/routes/admin.test.ts`

- [ ] **Step 1: Write the annotated file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockAdminFrom = vi.fn()
const mockDeleteUser = vi.fn()

// --- Mock strategy ---
// Replaces the Supabase admin client with two controlled fakes: mockAdminFrom for all
// database table operations (tutorials, profiles), and mockDeleteUser for Supabase Auth's
// admin.deleteUser call. makeApp() injects role directly so tests can switch between
// 'contributor' and 'admin' without running real authentication.
vi.mock('../../../src/supabase/client.js', () => ({
  createAdminClient: () => ({
    from: mockAdminFrom,
    auth: { admin: { deleteUser: mockDeleteUser } },
  }),
}))

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
  // Tests: all admin routes return 403 when the requester has the 'contributor' role
  // How:   makeApp('contributor') sets role='contributor' in context; requests /tutorials; checks status 403
  // Chain: non-admins are blocked at the route level before any DB calls are made → the admin
  //        UI never receives data it shouldn't show to a contributor
  it('returns 403 for contributors', async () => {
    const res = await makeApp('contributor').request('/tutorials')
    expect(res.status).toBe(403)
  })
})

describe('GET /tutorials', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: GET /tutorials returns the list of tutorials awaiting admin review
  // How:   mockAdminFrom returns a select/eq/order chain with one tutorial; checks status 200 and body length
  // Chain: the admin dashboard calls this to populate the review queue → admins see which
  //        tutorials need approval or rejection before they appear in the public library
  it('returns pending tutorials for admin', async () => {
    mockAdminFrom.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => ({ data: [{ id: '1' }], error: null }) }) }),
    })
    const res = await makeApp('admin').request('/tutorials')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body).toHaveLength(1)
  })
})

describe('PATCH /tutorials/:id/status', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: PATCH /tutorials/:id/status updates the tutorial's status field and returns 200
  // How:   mockAdminFrom returns an update/eq/select/single chain; checks status 200 and body.status
  // Chain: the admin review action calls this to approve or reject a tutorial → the status
  //        change controls whether the tutorial appears in the public library
  it('updates status', async () => {
    mockAdminFrom.mockReturnValue({
      update: () => ({
        eq: () => ({
          select: () => ({ single: () => ({ data: { id: '1', status: 'approved' }, error: null }) }),
        }),
      }),
    })
    const res = await makeApp('admin').request('/tutorials/1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.status).toBe('approved')
  })

  // Tests: a rejection_note in the request body is included in the DB update payload
  // How:   captures the payload passed to mockAdminFrom.update(); checks it contains rejection_note
  // Chain: the rejection note is stored on the tutorial record → the contributor can read it
  //        on their dashboard to understand why their submission was rejected
  it('includes rejection_note in update payload when provided', async () => {
    let capturedPayload: any = null
    mockAdminFrom.mockReturnValue({
      update: (payload: any) => {
        capturedPayload = payload
        return {
          eq: () => ({
            select: () => ({
              single: () => ({
                data: { id: '1', status: 'rejected', rejection_note: 'Needs more detail' },
                error: null,
              }),
            }),
          }),
        }
      },
    })
    await makeApp('admin').request('/tutorials/1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', rejection_note: 'Needs more detail' }),
    })
    expect(capturedPayload).toMatchObject({ rejection_note: 'Needs more detail' })
  })
})

describe('GET /contributors', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: GET /contributors returns the list of contributors for admin review
  // How:   mockAdminFrom returns a select/eq/order chain with one contributor; checks status 200 and body
  // Chain: the admin contributors page calls this to show who is registered → admins can
  //        approve or remove contributors through the adjacent endpoints
  it('returns contributor list for admin', async () => {
    mockAdminFrom.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => ({ data: [{ id: 'c-1', role: 'contributor' }], error: null }) }) }),
    })
    const res = await makeApp('admin').request('/contributors')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body).toHaveLength(1)
    expect(body[0].role).toBe('contributor')
  })

  // Tests: GET /contributors returns 500 when the database query fails
  // How:   mockAdminFrom returns { data: null, error } through the select chain; checks status 500
  // Chain: the admin page receives an error response → the UI can display an error state
  //        rather than silently showing an empty contributors list
  it('returns 500 on DB error', async () => {
    mockAdminFrom.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => ({ data: null, error: { message: 'DB error' } }) }) }),
    })
    const res = await makeApp('admin').request('/contributors')
    expect(res.status).toBe(500)
  })
})

describe('PATCH /contributors/:id/approve', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: PATCH /contributors/:id/approve sets approved=true and returns the updated profile
  // How:   mockAdminFrom returns an update/eq/select/single chain; checks status 200 and body.approved
  // Chain: the approval status is checked by authMiddleware on every request → once approved,
  //        the contributor's POST /tutorials requests are no longer blocked with a 403
  it('sets approved=true and returns updated profile', async () => {
    mockAdminFrom.mockReturnValue({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => ({ data: { id: 'c-1', approved: true }, error: null }),
          }),
        }),
      }),
    })
    const res = await makeApp('admin').request('/contributors/c-1/approve', { method: 'PATCH' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.approved).toBe(true)
  })
})

describe('DELETE /contributors/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: DELETE /contributors/:id calls Supabase Auth's deleteUser and returns 204
  // How:   mockDeleteUser resolves with { error: null }; verifies it was called with the correct user ID
  // Chain: the user is removed from Supabase Auth entirely → they can no longer log in or make
  //        authenticated API requests, effectively revoking all access to the platform
  it('deletes user and returns 204', async () => {
    mockDeleteUser.mockResolvedValue({ error: null })
    const res = await makeApp('admin').request('/contributors/c-1', { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect(mockDeleteUser).toHaveBeenCalledWith('c-1')
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/api && pnpm test -- tests/unit/routes/admin.test.ts
```
Expected: 7 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/api/tests/unit/routes/admin.test.ts
git commit -m "docs(tests): annotate admin.test.ts"
```

---

### Task 8: Annotate `contributors.test.ts`

**Files:**
- Modify: `packages/api/tests/unit/routes/contributors.test.ts`

- [ ] **Step 1: Write the annotated file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockAdminFrom = vi.fn()
const mockUserFrom = vi.fn()

// --- Mock strategy ---
// Replaces both Supabase clients: mockAdminFrom is used by GET /me (the profile lookup uses
// the admin client for elevated read access across all profiles); mockUserFrom is used by
// POST /me/tutorials/:id (the contributor_tutorials join table is written using the user's
// own session to enforce row-level security).
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

  // Tests: GET /me returns the current user's profile as JSON
  // How:   mockAdminFrom returns a select/eq/single chain with a profile object; checks status 200 and body.id
  // Chain: the nav bar and layout call this to determine what links to show → the returned role
  //        controls whether the user sees contributor dashboard or admin panel links
  it('returns current user profile', async () => {
    mockAdminFrom.mockReturnValue({
      select: () => ({
        eq: () => ({ single: () => ({ data: { id: 'user-1', role: 'contributor' }, error: null }) }),
      }),
    })
    const res = await makeApp().request('/me')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.id).toBe('user-1')
  })

  // Tests: GET /me returns 404 when no profile exists for the authenticated user ID
  // How:   mockAdminFrom returns { data: null, error: { message: 'not found' } }; checks status 404
  // Chain: the app can redirect the user to onboarding or display a "profile not found" error
  //        instead of crashing when the layout tries to read the role from a null response
  it('returns 404 when profile not found', async () => {
    mockAdminFrom.mockReturnValue({
      select: () => ({
        eq: () => ({ single: () => ({ data: null, error: { message: 'not found' } }) }),
      }),
    })
    const res = await makeApp().request('/me')
    expect(res.status).toBe(404)
  })
})

describe('POST /me/tutorials/:tutorialId', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: POST /me/tutorials/:id inserts a contributor_tutorials row and returns 201
  // How:   mockUserFrom returns { insert: () => ({ error: null }) }; checks status 201
  // Chain: the upload wizard calls this right after creating a draft → the tutorial is linked
  //        to the contributor and appears in their "My Tutorials" dashboard
  it('links tutorial to current user and returns 201', async () => {
    mockUserFrom.mockReturnValue({
      insert: () => ({ error: null }),
    })
    const res = await makeApp().request('/me/tutorials/tut-1', { method: 'POST' })
    expect(res.status).toBe(201)
  })

  // Tests: POST /me/tutorials/:id returns 200 (not 409) when the link already exists
  // How:   mockUserFrom returns Postgres error code '23505' (unique violation); checks status 200
  // Chain: the upload wizard can safely retry after a network failure without creating duplicate
  //        contributor_tutorials rows or surfacing a false error to the user
  it('returns 200 on duplicate key (idempotent retry)', async () => {
    mockUserFrom.mockReturnValue({
      insert: () => ({ error: { code: '23505', message: 'duplicate' } }),
    })
    const res = await makeApp().request('/me/tutorials/tut-1', { method: 'POST' })
    expect(res.status).toBe(200)
  })

  // Tests: POST /me/tutorials/:id returns 500 on any DB error that is not a duplicate key
  // How:   mockUserFrom returns error code '42501' (permissions error); checks status 500
  // Chain: the upload wizard receives 500 → the UI displays a failure message and the tutorial
  //        is not linked, preventing orphaned drafts from appearing in the contributor's dashboard
  it('returns 500 on unexpected DB error', async () => {
    mockUserFrom.mockReturnValue({
      insert: () => ({ error: { code: '42501', message: 'permission denied' } }),
    })
    const res = await makeApp().request('/me/tutorials/tut-1', { method: 'POST' })
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/api && pnpm test -- tests/unit/routes/contributors.test.ts
```
Expected: 5 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/api/tests/unit/routes/contributors.test.ts
git commit -m "docs(tests): annotate contributors.test.ts"
```

---

### Final verification

- [ ] **Run the full API test suite to confirm all 55 tests still pass**

```
cd packages/api && pnpm test
```
Expected: 55 tests pass, 0 fail.
