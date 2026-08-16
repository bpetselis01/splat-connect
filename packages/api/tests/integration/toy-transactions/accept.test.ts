import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const BASE = 'http://localhost'
function toysReq(path: string, token: string, init: RequestInit = {}) {
  const url = path === '/' ? `${BASE}/api/toys` : `${BASE}/api/toys${path}`
  return app.request(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}
function txReq(path: string, token: string, init: RequestInit = {}) {
  const url = path === '/' ? `${BASE}/api/toy-transactions` : `${BASE}/api/toy-transactions${path}`
  return app.request(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

const ADDRESS = {
  pickup_line1: '1 Test St',
  pickup_suburb: 'Testville',
  pickup_state: 'VIC',
  pickup_postcode: '3000',
}

describe('POST /api/toy-transactions/:id/accept', () => {
  let owner: TestUser
  let requester1: TestUser
  let requester2: TestUser
  let toyId: string
  let tx1Id: string
  let tx2Id: string

  beforeAll(async () => {
    owner = await createTestUser('contributor')
    requester1 = await createTestUser('contributor')
    requester2 = await createTestUser('contributor')

    const create = await toysReq('/', owner.token, { method: 'POST', body: JSON.stringify({ name: 'Robot', condition: 9 }) })
    const toy = (await create.json()) as { id: string }
    toyId = toy.id
    await toysReq(`/${toyId}`, owner.token, {
      method: 'PATCH',
      body: JSON.stringify({
        cover_photo_url: 'https://example.com/c.jpg',
        offer_type: 'donation',
      }),
    })
    await toysReq(`/${toyId}/publish`, owner.token, { method: 'PATCH' })

    const c1 = await txReq('/', requester1.token, { method: 'POST', body: JSON.stringify({ toy_id: toyId, type: 'donation' }) })
    tx1Id = ((await c1.json()) as { id: string }).id
    const c2 = await txReq('/', requester2.token, { method: 'POST', body: JSON.stringify({ toy_id: toyId, type: 'donation' }) })
    tx2Id = ((await c2.json()) as { id: string }).id
  })

  afterAll(async () => {
    await deleteTestUser(owner.id)
    await deleteTestUser(requester1.id)
    await deleteTestUser(requester2.id)
  })

  it('403s a non-owner trying to accept', async () => {
    const res = await txReq(`/${tx1Id}/accept`, requester1.token, { method: 'POST', body: JSON.stringify(ADDRESS) })
    expect(res.status).toBe(403)
  })

  it('400s without a pickup address', async () => {
    const res = await txReq(`/${tx1Id}/accept`, owner.token, { method: 'POST', body: JSON.stringify({}) })
    expect(res.status).toBe(400)
  })

  it('accepts, generates a code for the owner only, and stores the supplied address', async () => {
    const res = await txReq(`/${tx1Id}/accept`, owner.token, { method: 'POST', body: JSON.stringify(ADDRESS) })
    expect(res.status).toBe(200)
    const tx = (await res.json()) as {
      status: string
      owner_code: string
      requester_code: string | null
      pickup_line1: string
      pickup_postcode: string
    }
    expect(tx.status).toBe('accepted')
    expect(tx.owner_code).toMatch(/^\d{6}$/)
    expect(tx.requester_code).toBeNull()
    expect(tx.pickup_line1).toBe(ADDRESS.pickup_line1)
    expect(tx.pickup_postcode).toBe(ADDRESS.pickup_postcode)

    const requesterView = await txReq(`/${tx1Id}`, requester1.token)
    const requesterTx = (await requesterView.json()) as { owner_code: string | null; requester_code: string }
    expect(requesterTx.requester_code).toMatch(/^\d{6}$/)
    expect(requesterTx.owner_code).toBeNull()
  })

  it('leaves the rival request open, flagged as blocked', async () => {
    const rival = await txReq(`/${tx2Id}`, requester2.token)
    const rivalBody = (await rival.json()) as { status: string; blocked_by_rival_accept: boolean }
    expect(rivalBody.status).toBe('requested')
    expect(rivalBody.blocked_by_rival_accept).toBe(true)
  })

  it('409s accepting the rival while the first handoff is in flight', async () => {
    const res = await txReq(`/${tx2Id}/accept`, owner.token, { method: 'POST', body: JSON.stringify(ADDRESS) })
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toMatch(/already accepted/i)
  })

  it('409s accepting an already-accepted request', async () => {
    const res = await txReq(`/${tx1Id}/accept`, owner.token, { method: 'POST', body: JSON.stringify(ADDRESS) })
    expect(res.status).toBe(409)
  })
})
