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
    const body = await res.json() as any
    expect(body).toHaveLength(1)
  })
})

describe('PATCH /tutorials/:id/status', () => {
  beforeEach(() => vi.clearAllMocks())

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
})
