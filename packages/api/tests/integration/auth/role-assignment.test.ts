import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

let contributor: TestUser
let adminUser: TestUser

beforeAll(async () => {
  contributor = await createTestUser('contributor')
  adminUser = await createTestUser('admin')
})

afterAll(async () => {
  await deleteTestUser(contributor.id)
  await deleteTestUser(adminUser.id)
})

describe('role assignment', () => {
  it('contributor profile has role=contributor', async () => {
    const res = await app.request('/api/contributors/me', {
      headers: { Authorization: `Bearer ${contributor.token}` },
    })
    expect(res.status).toBe(200)
    const profile = (await res.json()) as { role: string }
    expect(profile.role).toBe('contributor')
  })

  it('admin profile has role=admin', async () => {
    const res = await app.request('/api/contributors/me', {
      headers: { Authorization: `Bearer ${adminUser.token}` },
    })
    expect(res.status).toBe(200)
    const profile = (await res.json()) as { role: string }
    expect(profile.role).toBe('admin')
  })

  it('a newly signed-up contributor can create a tutorial once they accept the terms', async () => {
    // This used to assert 201 immediately. Contribution is now gated on
    // contributor_terms, so "immediately" is no longer true. The accurate
    // statement is that nothing *else* stands in the way — role assignment on
    // signup still grants everything it used to.
    const attempt = () => app.request('/api/tutorials', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${contributor.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: crypto.randomUUID(), title: 'Allowed', difficulty: 'easy' }),
    })

    expect((await attempt()).status).toBe(403)

    await app.request('/api/agreements', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${contributor.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agreement_type: 'contributor_terms' }),
    })

    expect((await attempt()).status).toBe(201)
  })

  it('a newly signed-up contributor is not blocked by RLS inserting a tutorial directly', async () => {
    const supabase = createUserClient(contributor.token)
    const { error } = await supabase
      .from('tutorials')
      .insert({ id: crypto.randomUUID(), title: 'RLS allowed', difficulty: 'easy' })
    expect(error).toBeNull()
  })
})
