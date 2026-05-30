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
