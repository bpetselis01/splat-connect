import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockAdminFrom = vi.fn()
const mockDeleteUser = vi.fn()

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

  it('deletes user and returns 204', async () => {
    mockDeleteUser.mockResolvedValue({ error: null })
    const res = await makeApp('admin').request('/contributors/c-1', { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect(mockDeleteUser).toHaveBeenCalledWith('c-1')
  })
})
