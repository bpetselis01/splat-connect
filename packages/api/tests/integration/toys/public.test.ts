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

async function createPublishedToy(token: string, name: string) {
  const create = await req('/', token, {
    method: 'POST',
    body: JSON.stringify({ name, condition: 7 }),
  })
  const toy = (await create.json()) as { id: string }
  await req(`/${toy.id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ cover_photo_url: 'https://example.com/cover.jpg' }),
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

  it('excludes an archived toy from the public list and its detail page', async () => {
    const archivedId = await createPublishedToy(owner.token, 'Archived unicycle')
    // Directly flip archived_at the way the confirm route would — this test
    // only needs to prove public.ts's filter, not re-run the whole handoff flow.
    const admin = (await import('../../../src/supabase/client.js')).createAdminClient()
    await admin.from('toys').update({ archived_at: new Date().toISOString() }).eq('id', archivedId)

    const list = await app.request('/api/public/toys')
    const ids = ((await list.json()) as Array<{ id: string }>).map((r) => r.id)
    expect(ids).not.toContain(archivedId)

    const detail = await app.request(`/api/public/toys/${archivedId}`)
    expect(detail.status).toBe(404)
  })
})
