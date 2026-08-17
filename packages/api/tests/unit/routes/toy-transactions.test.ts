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
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    ...methods,
  }
}

const ADDRESS = {
  pickup_line1: '1 Test St',
  pickup_suburb: 'Testville',
  pickup_state: 'VIC',
  pickup_postcode: '3000',
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

describe('POST /api/toy-transactions/:id/accept', () => {
  let app: Hono<{ Variables: AuthVariables }>

  const OPEN_TX = {
    id: 'tx-1',
    toy_id: 'toy-1',
    owner_id: 'owner-1',
    requester_id: 'requester-1',
    status: 'requested',
  }

  // Both the rival-lock check and the accept write go through
  // admin.from('toy_transactions'), so one table stands in for both: maybeSingle
  // answers the lock check, single answers the update.
  function setup({ rivalAccepted = null }: { rivalAccepted?: { id: string } | null } = {}) {
    const txTable = table({
      maybeSingle: vi.fn().mockResolvedValue({ data: rivalAccepted, error: null }),
      single: vi.fn().mockResolvedValue({ data: { ...OPEN_TX, status: 'accepted' }, error: null }),
    })
    userClient.from.mockImplementation(() =>
      table({ maybeSingle: vi.fn().mockResolvedValue({ data: OPEN_TX, error: null }) })
    )
    adminClient.from.mockImplementation((name: string) => (name === 'toy_transactions' ? txTable : table({})))
    return txTable
  }

  function accept(body: unknown) {
    return app.request('/tx-1/accept', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  beforeEach(async () => {
    vi.resetModules()
    userClient.from.mockReset()
    adminClient.from.mockReset()
    const mod = await import('../../../src/routes/toy-transactions.js')
    app = new Hono<{ Variables: AuthVariables }>()
    app.use('*', async (c, next) => {
      c.set('userId', 'owner-1')
      c.set('token', 'tok')
      await next()
    })
    app.route('/', mod.default)
  })

  it('400s without a pickup address', async () => {
    setup()
    const res = await accept({})
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toMatch(/pickup address is required/i)
  })

  it('400s when a pickup field is blank', async () => {
    setup()
    const res = await accept({ ...ADDRESS, pickup_suburb: '   ' })
    expect(res.status).toBe(400)
  })

  it('409s when another request for the same toy is already accepted', async () => {
    setup({ rivalAccepted: { id: 'tx-2' } })
    const res = await accept(ADDRESS)
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toMatch(/already accepted/i)
  })

  it('writes the supplied address rather than the owner profile default', async () => {
    const txTable = setup()
    const res = await accept(ADDRESS)
    expect(res.status).toBe(200)
    expect(txTable.update).toHaveBeenCalledWith(expect.objectContaining(ADDRESS))
  })

  it('leaves rival requests open — they are only closed out on confirm', async () => {
    const txTable = setup()
    await accept(ADDRESS)
    for (const call of txTable.update.mock.calls) {
      expect(call[0]).not.toMatchObject({ status: 'rejected' })
    }
  })
})
