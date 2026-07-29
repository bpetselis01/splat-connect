import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let user: TestUser
let other: TestUser

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  },
})

beforeAll(async () => {
  user = await createTestUser('contributor')
  other = await createTestUser('contributor')
})

afterAll(async () => {
  await deleteTestUser(user.id)
  await deleteTestUser(other.id)
})

describe('PATCH /api/contributors/me', () => {
  it('updates the caller name', async () => {
    const res = await app.request(
      '/api/contributors/me',
      authed(user.token, { method: 'PATCH', body: JSON.stringify({ name: 'Ada Lovelace' }) })
    )

    expect(res.status).toBe(200)
    const saved = (await res.json()) as { name: string }
    expect(saved.name).toBe('Ada Lovelace')
  })

  // Tests: the column whitelist holds.
  // Chain: role is the escalation path closed in 009. The endpoint must not
  //        become a second route to it, and must not fail loudly either — the
  //        body value is ignored, exactly as PUT /api/child-profile ignores
  //        parent_id.
  it('ignores role and email in the body', async () => {
    const res = await app.request(
      '/api/contributors/me',
      authed(user.token, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Ada', role: 'admin', email: 'attacker@example.com' }),
      })
    )

    expect(res.status).toBe(200)

    const { data } = await adminClient()
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single()
    expect(data?.role).toBe('contributor')
    expect(data?.email).not.toBe('attacker@example.com')
  })

  it('cannot rename another account by supplying its id', async () => {
    const res = await app.request(
      '/api/contributors/me',
      authed(user.token, { method: 'PATCH', body: JSON.stringify({ id: other.id, name: 'Hijacked' }) })
    )
    expect(res.status).toBe(200)

    const { data: mine } = await adminClient().from('profiles').select('name').eq('id', user.id).single()
    expect(mine?.name).toBe('Hijacked') // server-derived identity wins, not the client-supplied id

    const { data: theirs } = await adminClient().from('profiles').select('name').eq('id', other.id).single()
    expect(theirs?.name).not.toBe('Hijacked')
  })

  it('rejects a non-object body', async () => {
    const res = await app.request(
      '/api/contributors/me',
      authed(user.token, { method: 'PATCH', body: JSON.stringify(['not', 'an', 'object']) })
    )
    expect(res.status).toBe(400)
  })
})
