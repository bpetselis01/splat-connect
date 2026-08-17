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
async function createPublishedToy(token: string, name: string, offerType: 'donation' | 'exchange' | 'both') {
  const create = await toysReq('/', token, { method: 'POST', body: JSON.stringify({ name, condition: 7 }) })
  const toy = (await create.json()) as { id: string }
  await toysReq(`/${toy.id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ cover_photo_url: 'https://example.com/c.jpg', offer_type: offerType }),
  })
  await toysReq(`/${toy.id}/publish`, token, { method: 'PATCH' })
  return toy.id
}
// There is no GET /api/toys/:id route, so archived state is read off the owner's list.
async function getToy(token: string, toyId: string) {
  const res = await toysReq('/', token)
  const toys = (await res.json()) as Array<{ id: string; archived_at: string | null }>
  return toys.find((t) => t.id === toyId)
}

const ADDRESS = {
  pickup_line1: '1 Test St',
  pickup_suburb: 'Testville',
  pickup_state: 'VIC',
  pickup_postcode: '3000',
}

describe('POST /api/toy-transactions/:id/confirm', () => {
  let owner: TestUser
  let requester: TestUser
  let rival: TestUser

  afterAll(async () => {
    await deleteTestUser(owner.id)
    await deleteTestUser(requester.id)
    await deleteTestUser(rival.id)
  })

  beforeAll(async () => {
    owner = await createTestUser('contributor')
    requester = await createTestUser('contributor')
    rival = await createTestUser('contributor')
  })

  it('completes a donation on the owner confirming the requester code alone', async () => {
    const toyId = await createPublishedToy(owner.token, 'Scooter', 'donation')
    const created = await txReq('/', requester.token, { method: 'POST', body: JSON.stringify({ toy_id: toyId, type: 'donation' }) })
    const txId = ((await created.json()) as { id: string }).id
    await txReq(`/${txId}/accept`, owner.token, { method: 'POST', body: JSON.stringify(ADDRESS) })
    const detail = await txReq(`/${txId}`, requester.token)
    const tx = (await detail.json()) as { requester_code: string }

    const res = await txReq(`/${txId}/confirm`, owner.token, {
      method: 'POST',
      body: JSON.stringify({ code: tx.requester_code }),
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { status: string }).status).toBe('completed')

    const toyAfter = await getToy(owner.token, toyId)
    expect(toyAfter?.archived_at ?? null).not.toBeNull()
  })

  it('400s an incorrect code', async () => {
    const toyId = await createPublishedToy(owner.token, 'Wagon', 'donation')
    const created = await txReq('/', requester.token, { method: 'POST', body: JSON.stringify({ toy_id: toyId, type: 'donation' }) })
    const txId = ((await created.json()) as { id: string }).id
    await txReq(`/${txId}/accept`, owner.token, { method: 'POST', body: JSON.stringify(ADDRESS) })

    const res = await txReq(`/${txId}/confirm`, owner.token, { method: 'POST', body: JSON.stringify({ code: '000000' }) })
    expect(res.status).toBe(400)
  })

  it('completes an exchange only once both parties confirm, archiving both toys', async () => {
    const ownerToyId = await createPublishedToy(owner.token, 'Train set', 'exchange')
    const requesterToyId = await createPublishedToy(requester.token, 'Doll house', 'exchange')
    const created = await txReq('/', requester.token, {
      method: 'POST',
      body: JSON.stringify({ toy_id: ownerToyId, type: 'exchange', offered_toy_id: requesterToyId }),
    })
    const txId = ((await created.json()) as { id: string }).id
    await txReq(`/${txId}/accept`, owner.token, { method: 'POST', body: JSON.stringify(ADDRESS) })
    const ownerDetail = await txReq(`/${txId}`, owner.token)
    const ownerTx = (await ownerDetail.json()) as { owner_code: string }
    const requesterDetail = await txReq(`/${txId}`, requester.token)
    const requesterTx = (await requesterDetail.json()) as { requester_code: string }

    const ownerConfirm = await txReq(`/${txId}/confirm`, owner.token, {
      method: 'POST',
      body: JSON.stringify({ code: requesterTx.requester_code }),
    })
    expect(((await ownerConfirm.json()) as { status: string }).status).toBe('accepted')

    const requesterConfirm = await txReq(`/${txId}/confirm`, requester.token, {
      method: 'POST',
      body: JSON.stringify({ code: ownerTx.owner_code }),
    })
    expect(((await requesterConfirm.json()) as { status: string }).status).toBe('completed')

    const ownerToyAfter = await getToy(owner.token, ownerToyId)
    const requesterToyAfter = await getToy(requester.token, requesterToyId)
    expect(ownerToyAfter?.archived_at ?? null).not.toBeNull()
    expect(requesterToyAfter?.archived_at ?? null).not.toBeNull()
  })

  it('rejects the rival request only once the handoff completes', async () => {
    const toyId = await createPublishedToy(owner.token, 'Rocking horse', 'donation')
    const wanted = JSON.stringify({ toy_id: toyId, type: 'donation' })
    const created = await txReq('/', requester.token, { method: 'POST', body: wanted })
    const txId = ((await created.json()) as { id: string }).id
    const rivalCreated = await txReq('/', rival.token, { method: 'POST', body: wanted })
    const rivalTxId = ((await rivalCreated.json()) as { id: string }).id

    await txReq(`/${txId}/accept`, owner.token, { method: 'POST', body: JSON.stringify(ADDRESS) })
    const midHandoff = await txReq(`/${rivalTxId}`, rival.token)
    expect(((await midHandoff.json()) as { status: string }).status).toBe('requested')

    const detail = await txReq(`/${txId}`, requester.token)
    const tx = (await detail.json()) as { requester_code: string }
    await txReq(`/${txId}/confirm`, owner.token, { method: 'POST', body: JSON.stringify({ code: tx.requester_code }) })

    const after = await txReq(`/${rivalTxId}`, rival.token)
    expect(((await after.json()) as { status: string }).status).toBe('rejected')
  })

  it('403s the requester trying to confirm a donation (owner-only)', async () => {
    const toyId = await createPublishedToy(owner.token, 'Tricycle', 'donation')
    const created = await txReq('/', requester.token, { method: 'POST', body: JSON.stringify({ toy_id: toyId, type: 'donation' }) })
    const txId = ((await created.json()) as { id: string }).id
    await txReq(`/${txId}/accept`, owner.token, { method: 'POST', body: JSON.stringify(ADDRESS) })

    const res = await txReq(`/${txId}/confirm`, requester.token, { method: 'POST', body: JSON.stringify({ code: '123456' }) })
    expect(res.status).toBe(403)
  })
})
