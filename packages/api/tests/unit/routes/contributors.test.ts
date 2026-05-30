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
