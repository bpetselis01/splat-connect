import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockUserClient = { from: vi.fn() }
const mockAdminClient = { from: vi.fn() }

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

  it('returns tutorial list', async () => {
    mockUserClient.from.mockReturnValue({
      select: () => ({ order: () => ({ data: [{ id: '1', title: 'T1' }], error: null }) }),
    })
    const res = await makeApp().request('/')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].title).toBe('T1')
  })

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

  it('returns single tutorial', async () => {
    mockUserClient.from.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { id: '1', title: 'T1' }, error: null }) }) }),
    })
    const res = await makeApp().request('/1')
    expect(res.status).toBe(200)
  })

  it('returns 404 when tutorial not found', async () => {
    mockUserClient.from.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: null, error: { message: 'not found' } }) }) }),
    })
    const res = await makeApp().request('/nonexistent')
    expect(res.status).toBe(404)
  })
})

describe('POST /', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts tutorial and returns 201', async () => {
    const created = { id: 'new-id', title: 'New Tutorial', status: 'draft' }
    mockUserClient.from.mockReturnValue({
      upsert: () => ({ select: () => ({ single: () => ({ data: created, error: null }) }) }),
    })
    const res = await makeApp().request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'new-id', title: 'New Tutorial', difficulty: 'easy' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.status).toBe('draft')
  })
})

describe('PATCH /:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates tutorial', async () => {
    const updated = { id: '1', status: 'pending' }
    mockUserClient.from.mockReturnValue({
      update: () => ({
        eq: () => ({ select: () => ({ single: () => ({ data: updated, error: null }) }) }),
      }),
    })
    const res = await makeApp().request('/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes tutorial and returns 204', async () => {
    mockUserClient.from.mockReturnValue({
      delete: () => ({ eq: () => ({ error: null }) }),
    })
    const res = await makeApp().request('/1', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })
})
