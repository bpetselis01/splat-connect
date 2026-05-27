import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockUserClient = { from: vi.fn() }
const mockAdminClient = { from: vi.fn() }

vi.mock('../../../src/supabase/user-client.js', () => ({ createUserClient: () => mockUserClient }))
vi.mock('../../../src/supabase/client.js', () => ({ createAdminClient: () => mockAdminClient }))

const { default: tutorials } = await import('../../../src/routes/tutorials.js')

function makeApp(role: 'contributor' | 'admin' = 'contributor', approved = true) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', role)
    c.set('approved', approved)
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
    const body = await res.json() as any
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

describe('GET /mine', () => {
  beforeEach(() => vi.clearAllMocks())

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
})

describe('POST /', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts tutorial and returns 201', async () => {
    const created = { id: 'new-id', title: 'New Tutorial', status: 'draft' }
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

  it('returns 403 when user is not approved', async () => {
    const res = await makeApp('contributor', false).request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'new-id', title: 'New Tutorial', difficulty: 'easy' }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 200 with id on duplicate key (idempotent retry)', async () => {
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

  it('updates tutorial', async () => {
    const updated = { id: '1', status: 'pending' }
    mockUserClient.from.mockReturnValue({
      update: () => ({ eq: () => ({ select: () => ({ single: () => ({ data: updated, error: null }) }) }) }),
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
