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
    const body = await res.json() as any
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

describe('POST /me/tutorials/:tutorialId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('links tutorial to current user and returns 201', async () => {
    mockUserFrom.mockReturnValue({
      insert: () => ({ error: null }),
    })
    const res = await makeApp().request('/me/tutorials/tut-1', { method: 'POST' })
    expect(res.status).toBe(201)
  })

  it('returns 200 on duplicate key (idempotent retry)', async () => {
    mockUserFrom.mockReturnValue({
      insert: () => ({ error: { code: '23505', message: 'duplicate' } }),
    })
    const res = await makeApp().request('/me/tutorials/tut-1', { method: 'POST' })
    expect(res.status).toBe(200)
  })

  it('returns 500 on unexpected DB error', async () => {
    mockUserFrom.mockReturnValue({
      insert: () => ({ error: { code: '42501', message: 'permission denied' } }),
    })
    const res = await makeApp().request('/me/tutorials/tut-1', { method: 'POST' })
    expect(res.status).toBe(500)
  })
})
