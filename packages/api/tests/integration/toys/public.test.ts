import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const BASE = 'http://localhost'

function req(path: string, token: string, init: RequestInit = {}) {
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
  const create = await req('/', token, {
    method: 'POST',
    body: JSON.stringify({ name, condition: 7 }),
  })
  const toy = (await create.json()) as { id: string }
  await req(`/${toy.id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ cover_photo_url: 'https://example.com/cover.jpg', offer_type: 'donation' }),
  })
  await req(`/${toy.id}/publish`, token, { method: 'PATCH' })
  return toy.id
}

describe('GET /api/public/toys', () => {
  let owner: TestUser
  let published1: string
  let published2: string
  let draftId: string

  beforeAll(async () => {
    owner = await createTestUser('contributor')
    published1 = await createPublishedToy(owner.token, 'Fire truck')

    const draft = await req('/', owner.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Blocks', condition: 5 }),
    })
    draftId = ((await draft.json()) as { id: string }).id

    published2 = await createPublishedToy(owner.token, 'Robot')
  })

  afterAll(async () => {
    await deleteTestUser(owner.id)
  })

  it('lists only published toys, newest first', async () => {
    const res = await app.request('/api/public/toys')
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ id: string }>
    const ids = rows.map((r) => r.id)
    expect(ids).not.toContain(draftId)
    expect(ids.indexOf(published2)).toBeLessThan(ids.indexOf(published1))
  })

  it('404s on a draft toy and on a missing id, and never 403', async () => {
    const draftRes = await app.request(`/api/public/toys/${draftId}`)
    expect(draftRes.status).toBe(404)

    const missingRes = await app.request('/api/public/toys/00000000-0000-0000-0000-000000000000')
    expect(missingRes.status).toBe(404)
  })

  it('serves a published toy with its owner name embedded', async () => {
    const res = await app.request(`/api/public/toys/${published1}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { name: string; profiles: { name: string } | null }
    expect(body.name).toBe('Fire truck')
    expect(body.profiles).not.toBeNull()
  })

  // The archived_at exclusion test retired with migration 050: a completed
  // handoff now transfers the toy and flips it to draft, and draft exclusion
  // is already proven above.

  it('excludes a mid-handoff toy (accepted toy_transaction) from the public list and its detail page', async () => {
    const requester = await createTestUser('contributor')
    try {
      const createToy = await req('/', owner.token, {
        method: 'POST',
        body: JSON.stringify({ name: 'Handoff scooter', condition: 7 }),
      })
      const handoffId = ((await createToy.json()) as { id: string }).id
      await req(`/${handoffId}`, owner.token, {
        method: 'PATCH',
        body: JSON.stringify({ cover_photo_url: 'https://example.com/cover.jpg', offer_type: 'donation' }),
      })
      await req(`/${handoffId}/publish`, owner.token, { method: 'PATCH' })

      const create = await txReq('/', requester.token, {
        method: 'POST',
        body: JSON.stringify({ toy_id: handoffId, type: 'donation' }),
      })
      const tx = (await create.json()) as { id: string }
      const accept = await txReq(`/${tx.id}/accept`, owner.token, {
        method: 'POST',
        body: JSON.stringify({
          pickup_line1: '1 Test St',
          pickup_suburb: 'Testville',
          pickup_state: 'VIC',
          pickup_postcode: '3000',
        }),
      })
      expect(accept.status).toBe(200)

      const list = await app.request('/api/public/toys')
      const ids = ((await list.json()) as Array<{ id: string }>).map((r) => r.id)
      expect(ids).not.toContain(handoffId)

      const detail = await app.request(`/api/public/toys/${handoffId}`)
      expect(detail.status).toBe(404)
    } finally {
      await deleteTestUser(requester.id)
    }
  })
})
