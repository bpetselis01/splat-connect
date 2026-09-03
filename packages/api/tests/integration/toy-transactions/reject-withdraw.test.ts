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
async function requestDonation(ownerToken: string, requesterToken: string, name: string) {
  const create = await toysReq('/', ownerToken, { method: 'POST', body: JSON.stringify({ name, condition: 6 }) })
  const toy = (await create.json()) as { id: string }
  await toysReq(`/${toy.id}`, ownerToken, {
    method: 'PATCH',
    body: JSON.stringify({ photo_urls: ['https://example.com/c.jpg'], offer_type: 'donation' }),
  })
  await toysReq(`/${toy.id}/publish`, ownerToken, { method: 'PATCH' })
  const created = await txReq('/', requesterToken, { method: 'POST', body: JSON.stringify({ toy_id: toy.id, type: 'donation' }) })
  return ((await created.json()) as { id: string }).id
}

describe('POST /api/toy-transactions/:id/reject and /withdraw', () => {
  let owner: TestUser
  let requester: TestUser
  let stranger: TestUser

  beforeAll(async () => {
    owner = await createTestUser('contributor')
    requester = await createTestUser('contributor')
    stranger = await createTestUser('contributor')
  })

  afterAll(async () => {
    await deleteTestUser(owner.id)
    await deleteTestUser(requester.id)
    await deleteTestUser(stranger.id)
  })

  it('lets the owner reject an open request', async () => {
    const txId = await requestDonation(owner.token, requester.token, 'Ball')
    const res = await txReq(`/${txId}/reject`, owner.token, { method: 'POST' })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { status: string }).status).toBe('rejected')
  })

  it('403s a non-owner trying to reject', async () => {
    const txId = await requestDonation(owner.token, requester.token, 'Kite')
    const res = await txReq(`/${txId}/reject`, requester.token, { method: 'POST' })
    expect(res.status).toBe(403)
  })

  it('404s a stranger acting on a transaction, never 403', async () => {
    const txId = await requestDonation(owner.token, requester.token, 'Drum')
    const res = await txReq(`/${txId}/reject`, stranger.token, { method: 'POST' })
    expect(res.status).toBe(404)
  })

  it('lets either party withdraw an open request', async () => {
    const txId = await requestDonation(owner.token, requester.token, 'Puzzle')
    const res = await txReq(`/${txId}/withdraw`, requester.token, { method: 'POST' })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { status: string }).status).toBe('withdrawn')
  })
})
