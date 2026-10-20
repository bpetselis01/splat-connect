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
async function publishToy(token: string, name: string, offer_type: 'donation' | 'exchange') {
  const create = await toysReq('/', token, { method: 'POST', body: JSON.stringify({ name, condition: 6 }) })
  const toy = (await create.json()) as { id: string }
  await toysReq(`/${toy.id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ photo_urls: ['https://example.com/c.jpg'], offer_type }),
  })
  await toysReq(`/${toy.id}/publish`, token, { method: 'PATCH' })
  return toy.id
}
async function requestDonation(ownerToken: string, requesterToken: string, name: string) {
  const toyId = await publishToy(ownerToken, name, 'donation')
  const created = await txReq('/', requesterToken, { method: 'POST', body: JSON.stringify({ toy_id: toyId, type: 'donation' }) })
  return ((await created.json()) as { id: string }).id
}
async function requestSwap(ownerToken: string, requesterToken: string, name: string) {
  const toyId = await publishToy(ownerToken, name, 'exchange')
  const offeredId = await publishToy(requesterToken, `${name} offered`, 'exchange')
  const created = await txReq('/', requesterToken, {
    method: 'POST',
    body: JSON.stringify({ toy_id: toyId, type: 'exchange', offered_toy_id: offeredId }),
  })
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

  const reject = (txId: string, token: string, body: unknown) =>
    txReq(`/${txId}/reject`, token, { method: 'POST', body: JSON.stringify(body) })

  it('X05 WX07 lets the owner reject an open request with a reason, which the requester reads', async () => {
    const txId = await requestDonation(owner.token, requester.token, 'Ball')
    const res = await reject(txId, owner.token, { reason: '  Already given away  ' })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'rejected', decline_reason: 'Already given away' })
    const detail = (await (await txReq(`/${txId}`, requester.token)).json()) as {
      decline_reason: string
      messages: { kind: string; body: string }[]
    }
    expect(detail.decline_reason).toBe('Already given away')
    expect(detail.messages.at(-1)).toMatchObject({ kind: 'system', body: 'Request declined — Already given away' })
  })

  it.each([
    ['gift', requestDonation],
    ['swap', requestSwap],
  ])('refuses a %s decline without a reason and leaves the request open', async (_kind, request) => {
    const txId = await request(owner.token, requester.token, 'Lamp')
    for (const body of [{}, { reason: '   ' }, { reason: 7 }]) {
      const res = await reject(txId, owner.token, body)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'reason_required' })
    }
    expect(((await (await txReq(`/${txId}`, owner.token)).json()) as { status: string }).status).toBe('requested')
  })

  it('refuses a reason over 500 characters and accepts exactly 500', async () => {
    const txId = await requestDonation(owner.token, requester.token, 'Tent')
    const tooLong = await reject(txId, owner.token, { reason: 'x'.repeat(501) })
    expect(tooLong.status).toBe(400)
    expect(await tooLong.json()).toEqual({ error: 'reason_too_long', max: 500 })
    expect((await reject(txId, owner.token, { reason: 'x'.repeat(500) })).status).toBe(200)
  })

  it('answers a second decline with 409 no longer open', async () => {
    const txId = await requestDonation(owner.token, requester.token, 'Rattle')
    await reject(txId, owner.token, { reason: 'Gone' })
    const again = await reject(txId, owner.token, { reason: 'Gone' })
    expect(again.status).toBe(409)
    expect(await again.json()).toEqual({ error: 'This request is no longer open' })
  })

  it('403s a non-owner trying to reject', async () => {
    const txId = await requestDonation(owner.token, requester.token, 'Kite')
    const res = await reject(txId, requester.token, { reason: 'Nope' })
    expect(res.status).toBe(403)
  })

  it('404s a stranger acting on a transaction, never 403', async () => {
    const txId = await requestDonation(owner.token, requester.token, 'Drum')
    const res = await reject(txId, stranger.token, { reason: 'Nope' })
    expect(res.status).toBe(404)
  })

  it('X06 WX08 lets either party withdraw an open request', async () => {
    const txId = await requestDonation(owner.token, requester.token, 'Puzzle')
    const res = await txReq(`/${txId}/withdraw`, requester.token, { method: 'POST' })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { status: string }).status).toBe('withdrawn')
  })
})
