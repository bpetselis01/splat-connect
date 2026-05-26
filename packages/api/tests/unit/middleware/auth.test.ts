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
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: null, error: { message: 'not found' } }) }) }),
    })
    const app = makeApp()
    const res = await app.request('/test', { headers: { Authorization: 'Bearer valid-token' } })
    expect(res.status).toBe(403)
  })

  it('attaches userId and role to context on valid token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { role: 'contributor' }, error: null }) }) }),
    })
    const app = makeApp()
    const res = await app.request('/test', { headers: { Authorization: 'Bearer valid-token' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.userId).toBe('uid-1')
    expect(body.role).toBe('contributor')
  })
})
