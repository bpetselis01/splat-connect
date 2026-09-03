import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const BASE = 'http://localhost'

function req(path: string, token: string, init: RequestInit = {}) {
  // Hono's sub-router only matches the collection root at the exact mount
  // path (no trailing slash), so '/' is normalized to '' here rather than in
  // every call site.
  const url = path === '/' ? `${BASE}/api/toys` : `${BASE}/api/toys${path}`
  return app.request(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

describe('toys CRUD', () => {
  let owner: TestUser
  let other: TestUser

  beforeAll(async () => {
    owner = await createTestUser('contributor')
    other = await createTestUser('contributor')
  })

  afterAll(async () => {
    await deleteTestUser(owner.id)
    await deleteTestUser(other.id)
  })

  it('starts with an empty list for a fresh user', async () => {
    const res = await req('/', owner.token)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('creates, lists newest first, ignores spoofed fields, and enforces the whitelist on PATCH', async () => {
    const create1 = await req('/', owner.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Fire truck', condition: 8, owner_id: other.id, status: 'published' }),
    })
    expect(create1.status).toBe(200)
    const toy1 = (await create1.json()) as { id: string; owner_id: string; status: string }
    expect(toy1.owner_id).toBe(owner.id)
    expect(toy1.status).toBe('draft')

    const create2 = await req('/', owner.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Blocks', condition: 5 }),
    })
    const toy2 = (await create2.json()) as { id: string }

    const list = await req('/', owner.token)
    const listed = (await list.json()) as { id: string }[]
    expect(listed.map((t) => t.id)).toEqual([toy2.id, toy1.id])

    const patch = await req(`/${toy1.id}`, owner.token, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Fire truck 2', owner_id: other.id, status: 'published' }),
    })
    expect(patch.status).toBe(200)
    const patched = (await patch.json()) as { name: string; owner_id: string; status: string }
    expect(patched.name).toBe('Fire truck 2')
    expect(patched.owner_id).toBe(owner.id)
    expect(patched.status).toBe('draft')
  })

  it('returns 404 (never 403) when another owner touches the toy, and 404 for a malformed id', async () => {
    const create = await req('/', owner.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Puzzle', condition: 6 }),
    })
    const toy = (await create.json()) as { id: string }

    const patchByOther = await req(`/${toy.id}`, other.token, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Stolen' }),
    })
    expect(patchByOther.status).toBe(404)

    const deleteByOther = await req(`/${toy.id}`, other.token, { method: 'DELETE' })
    expect(deleteByOther.status).toBe(404)

    const malformed = await req('/not-a-uuid', owner.token, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'x' }),
    })
    expect(malformed.status).toBe(404)
  })

  it('rejects publish until the cover photo is set, then publishes', async () => {
    const create = await req('/', owner.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Robot', condition: 9 }),
    })
    const toy = (await create.json()) as { id: string }

    const blocked = await req(`/${toy.id}/publish`, owner.token, { method: 'PATCH' })
    expect(blocked.status).toBe(400)
    const blockedBody = (await blocked.json()) as { missing: string[] }
    expect(blockedBody.missing).toContain('Cover photo')
    expect(blockedBody.missing).toContain('Offer type')

    await req(`/${toy.id}`, owner.token, {
      method: 'PATCH',
      body: JSON.stringify({ photo_urls: ['https://example.com/cover.jpg'], offer_type: 'donation' }),
    })

    const published = await req(`/${toy.id}/publish`, owner.token, { method: 'PATCH' })
    expect(published.status).toBe(200)
    expect(((await published.json()) as { status: string }).status).toBe('published')
  })

  it('deletes a toy', async () => {
    const create = await req('/', owner.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Kazoo', condition: 3 }),
    })
    const toy = (await create.json()) as { id: string }

    const del = await req(`/${toy.id}`, owner.token, { method: 'DELETE' })
    expect(del.status).toBe(200)

    const list = await req('/', owner.token)
    const listed = (await list.json()) as { id: string }[]
    expect(listed.find((t) => t.id === toy.id)).toBeUndefined()
  })
})
