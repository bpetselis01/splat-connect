import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const userClient = { from: vi.fn() }
const adminClient = { from: vi.fn() }

vi.mock('../../../src/supabase/user-client.js', () => ({
  createUserClient: () => userClient,
}))
vi.mock('../../../src/supabase/client.js', () => ({
  createAdminClient: () => adminClient,
}))

function table(methods: Record<string, unknown>) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    ...methods,
  }
}

describe('POST /api/toy-transactions', () => {
  let app: Hono<{ Variables: AuthVariables }>
  let toyTransactions: typeof import('../../../src/routes/toy-transactions.js').default

  beforeEach(async () => {
    vi.resetModules()
    userClient.from.mockReset()
    adminClient.from.mockReset()
    const mod = await import('../../../src/routes/toy-transactions.js')
    toyTransactions = mod.default
    app = new Hono<{ Variables: AuthVariables }>()
    app.use('*', async (c, next) => {
      c.set('userId', 'requester-1')
      c.set('token', 'tok')
      await next()
    })
    app.route('/', toyTransactions)
  })

  it('404s when the toy does not exist', async () => {
    const toys = table({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })
    adminClient.from.mockImplementation((name: string) => (name === 'toys' ? toys : table({})))

    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ toy_id: 'toy-1', type: 'donation' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(404)
  })

  it('400s when requesting your own toy', async () => {
    const toys = table({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'toy-1', owner_id: 'requester-1', offer_type: 'donation', status: 'published', archived_at: null },
        error: null,
      }),
    })
    adminClient.from.mockImplementation((name: string) => (name === 'toys' ? toys : table({})))

    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ toy_id: 'toy-1', type: 'donation' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })

  it('400s when the toy is not offered for the requested type', async () => {
    const toys = table({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'toy-1', owner_id: 'owner-1', offer_type: 'exchange', status: 'published', archived_at: null },
        error: null,
      }),
    })
    adminClient.from.mockImplementation((name: string) => (name === 'toys' ? toys : table({})))

    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ toy_id: 'toy-1', type: 'donation' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toMatch(/not offered/)
  })
})
