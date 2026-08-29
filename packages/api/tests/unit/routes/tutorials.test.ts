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
// PATCH's draft -> pending branch calls the notifier after the write commits.
// Mocked so the route's gating can be asserted without a database.
const mockNotifySubmitted = vi.fn().mockResolvedValue(undefined)
vi.mock('../../../src/review-notifications.js', () => ({
  notifyTutorialSubmitted: (...args: unknown[]) => mockNotifySubmitted(...args),
}))

const { default: tutorials } = await import('../../../src/routes/tutorials.js')

/** The tutorial routes now read user_agreements to check the contributor_terms
 *  gate before touching tutorials, so a mock answering every table the same way
 *  no longer works. This dispatches on the table name: the terms chain for
 *  user_agreements, whatever the test needs for everything else. */
function withTerms(accepted: boolean, otherTables: unknown = {}) {
  mockUserClient.from.mockImplementation((table: string) =>
    table === 'user_agreements'
      ? {
          select: () => ({
            eq: () => ({
              eq: () => ({ limit: () => ({ data: accepted ? [{ id: 'a' }] : [], error: null }) }),
            }),
          }),
        }
      : otherTables,
  )
}

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

  // Tests: the backing rows this endpoint embeds carry their own id
  // How:   captures the select string both list routes are built from
  // Chain: /dashboard/organisation flattens tutorial_orgs into one queue and keys
  //        each row by row.id, because org_id repeats once two tutorials ask the
  //        same organisation. The embed used to request only status and org_id,
  //        so every key was undefined and React rendered the queue unkeyed —
  //        "Each child in a list should have a unique key prop", pointing at a
  //        <li> that visibly had one
  it('embeds the backing row id the review queue keys on', async () => {
    const selects: string[] = []
    mockUserClient.from.mockReturnValue({
      select: (arg: string) => {
        selects.push(arg)
        return { order: () => ({ data: [], error: null }) }
      },
    })

    const res = await makeApp().request('/')
    expect(res.status).toBe(200)
    expect(selects).toHaveLength(1)
    expect(selects[0]).toContain('tutorial_orgs(id,')
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
      // order() sorts the recommendations embed by position; the chain has one
      // more link than it used to.
      select: () => ({ eq: () => ({ order: () => ({ single: () => ({ data: { id: '1', title: 'T1' }, error: null }) }) }) }),
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
      select: () => ({ eq: () => ({ order: () => ({ single: () => ({ data: null, error: { message: 'not found' } }) }) }) }),
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
    withTerms(true)
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

  // Tests: POST / writes kind, and a body that does not name one gets a toy
  //        adaptation — the default every pre-048 row already carries.
  // Chain: /upload sends the card the contributor picked; kind is what decides
  //        whether the STL step exists for this tutorial at all
  it('inserts kind, defaulting to toy_adaptation', async () => {
    const insert = vi.fn((_row: Record<string, unknown>) => ({ select: () => ({ single: () => ({ data: { id: 'x' }, error: null }) }) }))
    withTerms(true)
    mockAdminClient.from.mockReturnValue({ insert })
    await makeApp().request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'x', title: 'T', difficulty: 'easy' }),
    })
    expect(insert.mock.calls[0][0]).toMatchObject({ kind: 'toy_adaptation' })
    await makeApp().request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'y', title: 'T', difficulty: 'easy', kind: 'assistive_tech' }),
    })
    expect(insert.mock.calls[1][0]).toMatchObject({ kind: 'assistive_tech' })
  })

  // Tests: POST / returns 200 with the existing ID when the same tutorial ID is submitted twice
  // How:   mockAdminClient.from returns Postgres error code '23505' (unique violation); checks status 200 and body.id
  // Chain: the upload wizard can safely retry Step 1 Next after a network failure without
  //        creating duplicate draft records — idempotent behaviour keeps data clean
  it('returns 200 with id on duplicate key (idempotent retry)', async () => {
    withTerms(true)
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
  /** The tutorials table now answers two shapes on a submit: the pre-read of the
   *  current status (select -> eq -> maybeSingle) and the update itself. `was` is
   *  the status the pre-read reports. */
  function patchable(updated: unknown, was: string | null) {
    return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: was ? { status: was } : null, error: null }) }) }),
      update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ data: [updated], error: null }) }) }) }),
    }
  }

  it('updates tutorial', async () => {
    const updated = { id: '1', status: 'pending' }
    withTerms(true, patchable(updated, 'draft'))
    const res = await makeApp().request('/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending', updated_at: '2026-01-01T00:00:00Z' }),
    })
    expect(res.status).toBe(200)
  })

  // Tests: draft -> pending notifies the review queue exactly once, with the title
  // How:   the pre-read reports 'draft'; asserts the notifier's argument
  // Chain: this is the moment work is offered to someone else, and nothing told
  //        them before this — see src/review-notifications.ts
  it('notifies the review queue when a draft is submitted', async () => {
    withTerms(true, patchable({ id: '1', title: 'Spoon Holder', status: 'pending' }, 'draft'))
    await makeApp().request('/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending', updated_at: '2026-01-01T00:00:00Z' }),
    })
    expect(mockNotifySubmitted).toHaveBeenCalledTimes(1)
    expect(mockNotifySubmitted).toHaveBeenCalledWith({
      tutorialId: '1',
      tutorialTitle: 'Spoon Holder',
      actorId: 'user-1',
    })
  })

  // Tests: re-saving an already-pending tutorial notifies nobody
  // How:   the pre-read reports 'pending' while the body still carries it
  // Chain: the editor sends the whole form on every save, so without the
  //        pre-read a leader's badge climbed each time an author fixed a typo
  it('does not re-notify when the tutorial was already pending', async () => {
    withTerms(true, patchable({ id: '1', title: 'Spoon Holder', status: 'pending' }, 'pending'))
    const res = await makeApp().request('/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending', updated_at: '2026-01-01T00:00:00Z' }),
    })
    expect(res.status).toBe(200)
    expect(mockNotifySubmitted).not.toHaveBeenCalled()
  })

  // Tests: an ordinary field edit never touches the notifier, and never pays for
  //        the pre-read either
  it('does not notify on an edit that is not a submission', async () => {
    withTerms(true, patchable({ id: '1', title: 'Spoon Holder', status: 'draft' }, 'draft'))
    await makeApp().request('/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Spoon Holder', updated_at: '2026-01-01T00:00:00Z' }),
    })
    expect(mockNotifySubmitted).not.toHaveBeenCalled()
  })

  // Tests: PATCH /:id returns 500 when the database update fails
  // How:   mockUserClient.from returns { data: null, error } through the update chain; checks status 500
  // Chain: the upload wizard receives 500 → the UI can show an error and keep the user on
  //        the current step rather than advancing with unsaved data
  it('returns 500 on DB error', async () => {
    withTerms(true, {
      update: () => ({
        eq: () => ({
          eq: () => ({ select: () => ({ data: null, error: { message: 'DB error' } }) }),
        }),
      }),
    })
    const res = await makeApp().request('/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending', updated_at: '2026-01-01T00:00:00Z' }),
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

describe('PATCH /:id guards', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: PATCH /:id refuses draft -> pending when contributor_terms is unaccepted
  // How:   withTerms(false) makes the user_agreements read return no rows; checks 403
  // Chain: the submit step surfaces the 403 as "accept the terms first" rather than
  //        letting work reach the review queue from someone who agreed to nothing
  it('returns 403 on submit without accepted contributor terms', async () => {
    withTerms(false, {})
    const res = await makeApp().request('/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    })
    expect(res.status).toBe(403)
  })

  // Tests: PATCH /:id refuses to publish, whatever the caller's RLS grant allows
  // How:   sends status 'approved'; checks 403 before any database call is made
  // Chain: a leader must go through POST /:id/review instead, so reviewed_by and
  //        reviewed_for_org_id are always written and no publish escapes the audit trail
  it('returns 403 when asked to approve', async () => {
    withTerms(true, {})
    const res = await makeApp().request('/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    expect(res.status).toBe(403)
  })

  // Tests: PATCH /:id refuses the protected audit columns
  // How:   sends reviewed_by; checks 403 before any database call is made
  // Chain: the audit trail can only be written by the review endpoints, so a
  //        contributor cannot forge who approved their own work
  it('returns 403 on a protected audit field', async () => {
    withTerms(true, {})
    const res = await makeApp().request('/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewed_by: 'user-1' }),
    })
    expect(res.status).toBe(403)
  })
})
