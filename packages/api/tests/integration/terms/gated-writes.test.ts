import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { AGREEMENT_VERSIONS } from '@splat-connect/types'
import app from '../../../src/app.js'
import { TERMS_GATED } from '../../../src/terms.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let member: TestUser
let admin: TestUser
let accepted: TestUser
let older: TestUser

const ID = '00000000-0000-4000-8000-000000000000'
const concrete = (path: string) => path.replace(/:[A-Za-z_]+/g, ID)
const send = (user: TestUser, method: string, path: string) =>
  app.request(concrete(path), {
    method,
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : '{}',
  })
const refusal = async (res: Response) => ((await res.json().catch(() => null)) as { error?: string } | null)?.error

beforeAll(async () => {
  ;[member, admin, accepted, older] = await Promise.all([
    createTestUser('contributor', { terms: false }), createTestUser('admin', { terms: false }), createTestUser('contributor'), createTestUser('contributor', { terms: false }),
  ])
  const { error } = await adminClient().from('user_agreements').insert({ user_id: older.id, agreement_type: 'contributor_terms', version: 'v-older' })
  if (error) throw new Error(error.message)
})
afterAll(async () => {
  await Promise.all([member, admin, accepted, older].map((u) => deleteTestUser(u.id)))
})

describe('writes that need the current contributor terms', () => {
  it.each(TERMS_GATED.map((r) => [r.method, r.path]))('%s %s answers 403 terms_required without them', async (method, path) => {
    const res = await send(member, method, path)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'terms_required', version: AGREEMENT_VERSIONS.contributor_terms })
  })

  it.each(TERMS_GATED.map((r) => [r.method, r.path]))('%s %s refuses an admin without them too', async (method, path) => {
    expect(await refusal(await send(admin, method, path))).toBe('terms_required')
  })

  it('refuses a member who accepted an older version', async () => {
    expect(await refusal(await send(older, 'POST', '/api/toy-transactions/:id/messages'))).toBe('terms_required')
  })

  it.each(TERMS_GATED.map((r) => [r.method, r.path]))('%s %s reaches the route once they are accepted', async (method, path) => {
    expect(await refusal(await send(accepted, method, path))).not.toBe('terms_required')
  })
})

describe('what the gate leaves open', () => {
  it('a member without terms can follow and thank an organisation, and read', async () => {
    for (const [method, path] of [
      ['POST', '/api/organizations/:id/follow'],
      ['POST', '/api/organizations/:id/thanks'],
      ['GET', '/api/organizations/:id/events'],
      ['GET', '/api/toy-transactions'],
    ]) expect(await refusal(await send(member, method, path))).not.toBe('terms_required')
  })

  it('A15 WA30 a member without terms can accept them, and then make a gated write', async () => {
    const agree = await app.request('/api/agreements', {
      method: 'POST',
      headers: { Authorization: `Bearer ${member.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ agreement_type: 'contributor_terms' }),
    })
    expect(agree.status).toBe(201)
    expect(await refusal(await send(member, 'POST', '/api/toy-transactions/:id/messages'))).not.toBe('terms_required')
  })
})
