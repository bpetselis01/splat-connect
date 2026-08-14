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
    body: JSON.stringify({ cover_photo_url: 'https://example.com/cover.jpg', offer_type: offerType }),
  })
  await toysReq(`/${toy.id}/publish`, token, { method: 'PATCH' })
  return toy.id
}

describe('POST /api/toy-transactions', () => {
  let owner: TestUser
  let requester: TestUser
  let toyId: string

  beforeAll(async () => {
    owner = await createTestUser('contributor')
    requester = await createTestUser('contributor')
    toyId = await createPublishedToy(owner.token, 'Fire truck', 'donation')
  })

  afterAll(async () => {
    await deleteTestUser(owner.id)
    await deleteTestUser(requester.id)
  })

  it('creates a donation request and a system message', async () => {
    const res = await txReq('/', requester.token, {
      method: 'POST',
      body: JSON.stringify({ toy_id: toyId, type: 'donation' }),
    })
    expect(res.status).toBe(201)
    const tx = (await res.json()) as { id: string; status: string }
    expect(tx.status).toBe('requested')

    const detail = await txReq(`/${tx.id}`, owner.token)
    const body = (await detail.json()) as { messages: Array<{ kind: string }> }
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0].kind).toBe('system')
  })

  it('404s requesting a toy that does not exist, and never 403', async () => {
    const res = await txReq('/', requester.token, {
      method: 'POST',
      body: JSON.stringify({ toy_id: '00000000-0000-0000-0000-000000000000', type: 'donation' }),
    })
    expect(res.status).toBe(404)
  })

  it('rejects requesting your own toy', async () => {
    const res = await txReq('/', owner.token, {
      method: 'POST',
      body: JSON.stringify({ toy_id: toyId, type: 'donation' }),
    })
    expect(res.status).toBe(400)
  })
})
