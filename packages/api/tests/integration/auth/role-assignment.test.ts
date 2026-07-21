import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

let contributor: TestUser
let adminUser: TestUser
let unapproved: TestUser

beforeAll(async () => {
  contributor = await createTestUser('contributor')
  adminUser = await createTestUser('admin')
  unapproved = await createTestUser('contributor', false)
})

afterAll(async () => {
  await deleteTestUser(contributor.id)
  await deleteTestUser(adminUser.id)
  await deleteTestUser(unapproved.id)
})

describe('role assignment and approval gating', () => {
  it('approved contributor profile has role=contributor and approved=true', async () => {
    const res = await app.request('/api/contributors/me', {
      headers: { Authorization: `Bearer ${contributor.token}` },
    })
    expect(res.status).toBe(200)
    const profile = await res.json()
    expect(profile.role).toBe('contributor')
    expect(profile.approved).toBe(true)
  })

  it('admin profile has role=admin', async () => {
    const res = await app.request('/api/contributors/me', {
      headers: { Authorization: `Bearer ${adminUser.token}` },
    })
    expect(res.status).toBe(200)
    const profile = await res.json()
    expect(profile.role).toBe('admin')
  })

  it('unapproved contributor gets 403 creating a tutorial through the API', async () => {
    const res = await app.request('/api/tutorials', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${unapproved.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: crypto.randomUUID(), title: 'Blocked', difficulty: 'easy' }),
    })
    expect(res.status).toBe(403)
  })

  it('unapproved contributor is blocked by RLS inserting a tutorial directly', async () => {
    const supabase = createUserClient(unapproved.token)
    const { error } = await supabase
      .from('tutorials')
      .insert({ title: 'RLS blocked', difficulty: 'easy' })
    expect(error).not.toBeNull()
  })
})
