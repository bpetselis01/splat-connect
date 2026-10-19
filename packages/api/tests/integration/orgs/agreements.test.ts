import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/client.js'
import { AGREEMENT_VERSIONS, type AgreementType } from '@splat-connect/types'

let user: TestUser
let other: TestUser

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => {
  user = await createTestUser('contributor')
  other = await createTestUser('contributor')
})

afterAll(async () => {
  await adminClient().from('user_agreements').delete().in('user_id', [user.id, other.id])
  await deleteTestUser(user.id)
  await deleteTestUser(other.id)
})

describe('POST /api/agreements', () => {
  it('N05 records an acceptance at the server-chosen version', async () => {
    const res = await app.request('/api/agreements', authed(user.token, {
      method: 'POST',
      body: JSON.stringify({ agreement_type: 'contributor_terms', version: 'v99-forged' }),
    }))
    expect(res.status).toBe(201)
    const row = (await res.json()) as { user_id: string; version: string }
    // The forged version in the body is ignored — the server picks it, so a
    // client cannot claim acceptance of terms that were never published.
    expect(row.version).toBe('v0-todo')
    expect(row.user_id).toBe(user.id)
  })

  it('refuses an unknown agreement type', async () => {
    const res = await app.request('/api/agreements', authed(user.token, {
      method: 'POST',
      body: JSON.stringify({ agreement_type: 'something_else' }),
    }))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/agreements/me', () => {
  it("A14 returns only the caller's acceptances", async () => {
    const mine = await app.request('/api/agreements/me', authed(user.token))
    expect(((await mine.json()) as unknown[]).length).toBe(1)

    const theirs = await app.request('/api/agreements/me', authed(other.token))
    expect(((await theirs.json()) as unknown[]).length).toBe(0)
  })
})

describe('version-aware acceptance (139)', () => {
  it('SQL names the same current version as AGREEMENT_VERSIONS', async () => {
    // The API writes AGREEMENT_VERSIONS; the RLS policies read
    // current_agreement_version. Bump one without the other and every
    // fresh acceptance stops counting.
    for (const type of Object.keys(AGREEMENT_VERSIONS) as AgreementType[]) {
      const { data, error } = await adminClient().rpc('current_agreement_version', { p_agreement_type: type })
      expect(error).toBeNull()
      expect(data, type).toBe(AGREEMENT_VERSIONS[type])
    }
  })

  it('has_accepted ignores an acceptance of an older version', async () => {
    await adminClient().from('user_agreements').insert({ user_id: other.id, agreement_type: 'org_leader_terms', version: 'v-older' })
    const asOther = createUserClient(other.token)
    expect((await asOther.rpc('has_accepted', { p_agreement_type: 'org_leader_terms' })).data).toBe(false)

    await adminClient().from('user_agreements').insert({ user_id: other.id, agreement_type: 'org_leader_terms', version: AGREEMENT_VERSIONS.org_leader_terms })
    expect((await asOther.rpc('has_accepted', { p_agreement_type: 'org_leader_terms' })).data).toBe(true)
  })
})
