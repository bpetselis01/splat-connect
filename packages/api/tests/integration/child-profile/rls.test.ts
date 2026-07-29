import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let parentA: TestUser
let parentB: TestUser
let contributor: TestUser

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  },
})

// Direct user-scoped client for the RLS-denial case that has no API route
// (the GET route always filters by the caller's own id, so cross-parent reads
// can only be attempted below the API).
const userClient = (token: string) =>
  createClient(
    process.env.SUPABASE_URL ?? 'http://localhost:54321',
    process.env.SUPABASE_ANON_KEY ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  )

beforeAll(async () => {
  parentA = await createTestUser('parent')
  parentB = await createTestUser('parent')
  contributor = await createTestUser('contributor')
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('child_profiles').delete().in('parent_id', [parentA.id, parentB.id, contributor.id])
  await deleteTestUser(parentA.id)
  await deleteTestUser(parentB.id)
  await deleteTestUser(contributor.id)
})

describe('child-profile is open to any account', () => {
  // Tests: a contributor-role account reads its own (absent) child profile.
  // Chain: the role guard was the only thing stopping a web-registered account
  //        from becoming a parent, which is the point of the shared account.
  it('returns null rather than 403 for an account with no child profile', async () => {
    const res = await app.request('/api/child-profile', authed(contributor.token))
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  // Tests: a contributor-role account can create one.
  it('lets a contributor-role account create a child profile', async () => {
    const res = await app.request(
      '/api/child-profile',
      authed(contributor.token, { method: 'PUT', body: JSON.stringify({ age: 5 }) })
    )
    expect(res.status).toBe(200)
    const saved = (await res.json()) as Record<string, unknown>
    expect(saved.parent_id).toBe(contributor.id)
    expect(saved.age).toBe(5)
  })
})

describe('child-profile upsert + read', () => {
  it('returns null before the parent has created a profile', async () => {
    const res = await app.request('/api/child-profile', authed(parentB.token))
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('upserts editable fields and reads them back', async () => {
    const put = await app.request(
      '/api/child-profile',
      authed(parentA.token, {
        method: 'PUT',
        body: JSON.stringify({ age: 7, macs_level: 'II', macs_source: 'estimated', challenges: ['Grasping'] }),
      })
    )
    expect(put.status).toBe(200)
    const saved = (await put.json()) as Record<string, unknown>
    expect(saved).toMatchObject({
      parent_id: parentA.id,
      age: 7,
      macs_level: 'II',
      macs_source: 'estimated',
      challenges: ['Grasping'],
    })

    const get = await app.request('/api/child-profile', authed(parentA.token))
    const read = (await get.json()) as Record<string, unknown>
    expect(read).toMatchObject({ age: 7, macs_level: 'II', challenges: ['Grasping'] })
  })

  it('ignores non-editable keys and cannot spoof parent_id', async () => {
    const res = await app.request(
      '/api/child-profile',
      authed(parentA.token, {
        method: 'PUT',
        body: JSON.stringify({ age: 8, parent_id: parentB.id, id: 'spoofed', role: 'admin' }),
      })
    )
    expect(res.status).toBe(200)
    const saved = (await res.json()) as Record<string, unknown>
    expect(saved.parent_id).toBe(parentA.id) // server-set; body value ignored
    expect(saved.age).toBe(8)
  })

  it('rejects a non-object body', async () => {
    const res = await app.request(
      '/api/child-profile',
      authed(parentA.token, { method: 'PUT', body: JSON.stringify(['not', 'an', 'object']) })
    )
    expect(res.status).toBe(400)
  })
})

describe('child-profile RLS isolation', () => {
  it("a parent cannot read another parent's row directly", async () => {
    // parentA has a row (from the upsert tests above); parentB queries it directly.
    const { data, error } = await userClient(parentB.token)
      .from('child_profiles')
      .select('*')
      .eq('parent_id', parentA.id)
    expect(error).toBeNull()
    expect(data).toEqual([]) // RLS hides rows the caller doesn't own
  })
})
