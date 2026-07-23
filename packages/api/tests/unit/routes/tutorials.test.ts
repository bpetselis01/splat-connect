import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockUserClient = { from: vi.fn() }
const mockAdminClient = { from: vi.fn() }

// --- Mock strategy ---
// Replaces both Supabase clients (user and admin) with minimal fake objects so tests run
// without a real database. makeApp() bypasses real auth by injecting fake userId, role,
// and token directly into the Hono context, isolating the route logic under test.
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
