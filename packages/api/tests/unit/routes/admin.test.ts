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

  // Tests: GET /contributors returns { accounts, total } with every non-admin account
  // How:   mockAdminFrom returns a select/neq/order/limit chain with a contributor row and
  //        an exact count; checks status 200 and body shape
  // Chain: the endpoint excludes only admins, so every other account must show up on the
  //        screen an admin uses to manage accounts
  it('returns non-admin accounts for admin', async () => {
    mockAdminFrom.mockReturnValue({
      select: () => ({
        neq: () => ({ order: () => ({ limit: () => ({ data: [{ id: 'c-1', role: 'contributor' }], count: 1, error: null }) }) }),
      }),
    })
    const res = await makeApp('admin').request('/contributors')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.accounts).toHaveLength(1)
    expect(body.accounts[0].role).toBe('contributor')
    expect(body.total).toBe(1)
  })

  // Tests: GET /contributors returns 500 when the database query fails
  // How:   mockAdminFrom returns { data: null, error } through the select chain; checks status 500
  // Chain: the admin page receives an error response → the UI can display an error state
  //        rather than silently showing an empty account list
  it('returns 500 on DB error', async () => {
    mockAdminFrom.mockReturnValue({
      select: () => ({
        neq: () => ({ order: () => ({ limit: () => ({ data: null, count: null, error: { message: 'DB error' } }) }) }),
      }),
    })
    const res = await makeApp('admin').request('/contributors')
    expect(res.status).toBe(500)
  })
})

describe('DELETE /contributors/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: DELETE /contributors/:id is a general admin moderation tool that removes any
  //        contributor account, calling Supabase Auth's deleteUser and returning 204
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
