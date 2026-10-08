// journeys: Z06 Z07 Z08 Z09
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

// Direct user-scoped client for exercising the SELECT RLS policy itself,
// below the API. The GET route already filters by parent_id, so a test that
// only goes through app.request would still pass if the SELECT policy were
// dropped entirely.
const userClient = (token: string) =>
  createClient(
    process.env.SUPABASE_URL ?? 'http://localhost:54321',
    process.env.SUPABASE_ANON_KEY ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  )

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

  it('exercises the SELECT RLS policy directly, below the API', async () => {
    // Bypasses the API's own parent_id filter by querying the table through
    // a user-scoped client. Two assertions, deliberately: a stranger reading
    // the owner's rows must come back empty (an overly-permissive policy
    // would fail this), AND the owner reading their own rows must come back
    // non-empty (dropping the SELECT policy entirely denies everyone under
    // RLS, which would fail this one instead). Either assertion alone lets a
    // broken policy slip through; together they pin down the exact behaviour.
    const { data: strangerView, error: strangerError } = await userClient(stranger.token)
      .from('child_profiles')
      .select('*')
      .eq('parent_id', parent.id)
    expect(strangerError).toBeNull()
    expect(strangerView).toEqual([])

    const { data: ownerView, error: ownerError } = await userClient(parent.token)
      .from('child_profiles')
      .select('*')
      .eq('parent_id', parent.id)
    expect(ownerError).toBeNull()
    expect(ownerView?.length).toBeGreaterThan(0)
  })

  it('404s on a malformed id rather than leaking a database error', async () => {
    const res = await app.request('/api/child-profiles/not-a-uuid', authed(parent.token, { method: 'DELETE' }))
    expect(res.status).toBe(404)
  })

  it('400s on a non-object body instead of reaching the database', async () => {
    const post = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify(['not', 'an', 'object']),
    }))
    expect(post.status).toBe(400)

    const created = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Body check' }),
    }))
    const { id } = (await created.json()) as { id: string }

    const patch = await app.request(`/api/child-profiles/${id}`, authed(parent.token, {
      method: 'PATCH',
      body: JSON.stringify(5),
    }))
    expect(patch.status).toBe(400)
  })

  it('round-trips the four child questions and de-duplicates the lists', async () => {
    const created = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Board', helps_with: ['seeing', 'calm', 'seeing'], access: ['touch', 'eyes'], one_hand: true,
        press_force: 'light', enjoys: ['light', 'pretend'], everyday_needs: ['quiet', 'wipeable', 'quiet'],
      }),
    }))
    expect(created.status).toBe(201)
    const row = (await created.json()) as Record<string, unknown> & { id: string }
    expect(row).toMatchObject({ helps_with: ['seeing', 'calm'], access: ['touch', 'eyes'], one_hand: true, press_force: 'light', enjoys: ['light', 'pretend'], everyday_needs: ['quiet', 'wipeable'] })

    // Clearing an answer is a null, and needs can be emptied.
    const patch = await app.request(`/api/child-profiles/${row.id}`, authed(parent.token, {
      method: 'PATCH',
      body: JSON.stringify({ press_force: null, access: [], everyday_needs: [] }),
    }))
    expect(patch.status).toBe(200)
    expect(await patch.json()).toMatchObject({ helps_with: ['seeing', 'calm'], press_force: null, access: [], everyday_needs: [] })
  })

  it('400s on a value outside a question\'s vocabulary', async () => {
    for (const body of [{ helps_with: ['walking'] }, { press_force: 3 }, { access: 'press' }, { one_hand: 'yes' }, { enjoys: ['fireworks'] }, { everyday_needs: ['loud'] }, { everyday_needs: 'quiet' }]) {
      const res = await app.request('/api/child-profiles', authed(parent.token, { method: 'POST', body: JSON.stringify(body) }))
      expect(res.status, JSON.stringify(body)).toBe(400)
    }
  })

  // palm_width_mm left this list in 120: the registry's 2026-09-30 decision
  // made Measurements an optional wizard step (play-measurements.test.ts).
  it('no longer accepts the retired ability and needs fields', async () => {
    const res = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Minimal', macs_level: 'II', challenges: ['Grasping'] }),
    }))
    expect(res.status).toBe(201)
    const row = (await res.json()) as { macs_level: string | null; challenges: string[] }
    expect(row.macs_level).toBeNull()
    expect(row.challenges).toEqual([])
  })
})
