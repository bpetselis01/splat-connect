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
async function createPublishedToy(token: string, name: string) {
  const create = await toysReq('/', token, { method: 'POST', body: JSON.stringify({ name, condition: 8 }) })
  const toy = (await create.json()) as { id: string }
  await toysReq(`/${toy.id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ photo_urls: ['https://example.com/c.jpg'], offer_type: 'donation' }),
  })
  await toysReq(`/${toy.id}/publish`, token, { method: 'PATCH' })
  return toy.id
}
async function actionCount(token: string) {
  const res = await txReq('/action-count', token)
  expect(res.status).toBe(200)
  return ((await res.json()) as { count: number }).count
}

const ADDRESS = {
  pickup_line1: '1 Test St',
  pickup_suburb: 'Testville',
  pickup_state: 'VIC',
  pickup_postcode: '3000',
}

describe('GET /api/toy-transactions/action-count', () => {
  let owner: TestUser
  let requester: TestUser

  beforeAll(async () => {
    owner = await createTestUser('contributor')
    requester = await createTestUser('contributor')
  })

  afterAll(async () => {
    await deleteTestUser(owner.id)
    await deleteTestUser(requester.id)
  })

  it('is zero for an account with nothing waiting on it', async () => {
    expect(await actionCount(owner.token)).toBe(0)
  })

  // The route name must not be swallowed by GET /:id, which would try to load a
  // transaction called "action-count" and 404.
  it('is not shadowed by the :id route', async () => {
    const res = await txReq('/action-count', owner.token)
    expect(res.status).toBe(200)
  })

  it('counts an incoming request for the owner but not for the requester', async () => {
    const toyId = await createPublishedToy(owner.token, 'Fire truck')
    await txReq('/', requester.token, { method: 'POST', body: JSON.stringify({ toy_id: toyId, type: 'donation' }) })

    expect(await actionCount(owner.token)).toBe(1)
    expect(await actionCount(requester.token)).toBe(0)
  })

  it('still counts the owner once accepted, since the donation awaits their confirmation', async () => {
    const toyId = await createPublishedToy(owner.token, 'Scooter')
    const created = await txReq('/', requester.token, {
      method: 'POST',
      body: JSON.stringify({ toy_id: toyId, type: 'donation' }),
    })
    const txId = ((await created.json()) as { id: string }).id
    await txReq(`/${txId}/accept`, owner.token, { method: 'POST', body: JSON.stringify(ADDRESS) })

    // The Fire truck request from the previous test is still open, hence two.
    expect(await actionCount(owner.token)).toBe(2)
    expect(await actionCount(requester.token)).toBe(0)
  })

  it('drops the count once the owner declines', async () => {
    const toyId = await createPublishedToy(owner.token, 'Kite')
    const created = await txReq('/', requester.token, {
      method: 'POST',
      body: JSON.stringify({ toy_id: toyId, type: 'donation' }),
    })
    const txId = ((await created.json()) as { id: string }).id
    const before = await actionCount(owner.token)

    await txReq(`/${txId}/reject`, owner.token, { method: 'POST' })
    expect(await actionCount(owner.token)).toBe(before - 1)
  })
})
