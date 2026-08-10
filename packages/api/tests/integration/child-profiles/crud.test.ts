import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

let parent: TestUser
let stranger: TestUser

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => {
  parent = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
})

afterAll(async () => {
  await deleteTestUser(parent.id)
  await deleteTestUser(stranger.id)
})

describe('child profiles collection', () => {
  it('returns an empty array for an account with no children', async () => {
    const res = await app.request('/api/child-profiles', authed(parent.token))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('creates children and returns them in created_at order', async () => {
    const first = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Emma', age: 7 }),
    }))
    expect(first.status).toBe(201)
    const emma = (await first.json()) as { id: string; name: string; parent_id: string }
    expect(emma.name).toBe('Emma')
    // parent_id is server-set from the token, never read from the body.
    expect(emma.parent_id).toBe(parent.id)

    const second = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({ age: 4 }),
    }))
    expect(second.status).toBe(201)

    const list = await app.request('/api/child-profiles', authed(parent.token))
    const rows = (await list.json()) as { id: string; name: string | null }[]
    expect(rows).toHaveLength(2)
    expect(rows[0].name).toBe('Emma')
    // A child may be created with no name at all — the UI labels it by position.
    expect(rows[1].name).toBeNull()
  })

  it('ignores a parent_id in the body instead of trusting it', async () => {
    const res = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Spoofed', parent_id: stranger.id }),
    }))
    expect(res.status).toBe(201)
    expect(((await res.json()) as { parent_id: string }).parent_id).toBe(parent.id)
  })

  it('patches only whitelisted columns', async () => {
    const created = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Patch me' }),
    }))
    const { id } = (await created.json()) as { id: string }

    const res = await app.request(`/api/child-profiles/${id}`, authed(parent.token, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Patched', age: 9, nonsense: true }),
    }))
    expect(res.status).toBe(200)
    const row = (await res.json()) as { name: string; age: number }
    expect(row.name).toBe('Patched')
    expect(row.age).toBe(9)
    expect(row).not.toHaveProperty('nonsense')
  })

  it('deletes a child', async () => {
    const created = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Delete me' }),
    }))
    const { id } = (await created.json()) as { id: string }

    const res = await app.request(`/api/child-profiles/${id}`, authed(parent.token, { method: 'DELETE' }))
    expect(res.status).toBe(204)

    const list = await app.request('/api/child-profiles', authed(parent.token))
    const rows = (await list.json()) as { id: string }[]
    expect(rows.map((r) => r.id)).not.toContain(id)
  })

  it('hides one parent\'s children from another parent', async () => {
    const created = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Private' }),
    }))
    const { id } = (await created.json()) as { id: string }

    // RLS makes the row invisible rather than forbidden, so the honest answer
    // is 404 — a 403 would confirm the row exists.
    const patch = await app.request(`/api/child-profiles/${id}`, authed(stranger.token, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Hijacked' }),
    }))
    expect(patch.status).toBe(404)

    const del = await app.request(`/api/child-profiles/${id}`, authed(stranger.token, { method: 'DELETE' }))
    expect(del.status).toBe(404)

    const strangerList = await app.request('/api/child-profiles', authed(stranger.token))
    expect((await strangerList.json()) as unknown[]).toEqual([])

    // And the row survived both attempts.
    const ownerList = await app.request('/api/child-profiles', authed(parent.token))
    const rows = (await ownerList.json()) as { id: string; name: string }[]
    expect(rows.find((r) => r.id === id)?.name).toBe('Private')
  })

  it('404s on a malformed id rather than leaking a database error', async () => {
    const res = await app.request('/api/child-profiles/not-a-uuid', authed(parent.token, { method: 'DELETE' }))
    expect(res.status).toBe(404)
  })
})
