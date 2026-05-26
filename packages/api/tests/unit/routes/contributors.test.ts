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
      select: () => ({
        eq: () => ({ single: () => ({ data: { id: 'user-1', role: 'contributor' }, error: null }) }),
      }),
    })
    const res = await makeApp().request('/me')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('user-1')
  })

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
