/** The two leader writes on the recycling and profile screens that had no api proof: turning a drop-off away, and taking a picture down. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { DECLARATION_VERSION } from '@splat-connect/types'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { addLeader, cleanupOrg, createOrg } from '../../helpers/orgs.js'

let leader: TestUser
let family: TestUser
let stranger: TestUser
let orgId: string
let dropId: string

const json = (token: string, method: string, body: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

beforeAll(async () => {
  ;[leader, family, stranger] = await Promise.all([1, 2, 3].map(() => createTestUser('contributor')))
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  await adminClient().from('organizations').update({ logo_url: 'https://example.com/logo.png', cover_url: 'https://example.com/cover.png' }).eq('id', orgId)
  const { data } = await adminClient()
    .from('recycling_dropoffs')
    .insert({ org_id: orgId, contributor_id: family.id, material: 'PLA', estimated_grams: 2500, condition_declared: true, declaration_version: DECLARATION_VERSION })
    .select('id')
    .single()
  dropId = data!.id
})

afterAll(async () => {
  await adminClient().from('recycling_dropoffs').delete().eq('org_id', orgId)
  await cleanupOrg(orgId)
  await Promise.all([leader, family, stranger].map((u) => deleteTestUser(u.id)))
})

describe('turning a drop-off away', () => {
  it('WB28 declines it for the leader, with no weight or credit, and records who decided', async () => {
    const refused = await app.request(`/api/organizations/${orgId}/recycling/${dropId}`, json(stranger.token, 'PATCH', { status: 'declined' }))
    expect(refused.status).toBe(404)
    const res = await app.request(`/api/organizations/${orgId}/recycling/${dropId}`, json(leader.token, 'PATCH', { status: 'declined' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'declined', weighed_grams: null, credit_grams: null, decided_by: leader.id })
    const { data } = await adminClient().from('recycling_dropoffs').select('status, weighed_grams, credit_grams').eq('id', dropId).single()
    expect(data).toEqual({ status: 'declined', weighed_grams: null, credit_grams: null })
  })
})

describe('taking a picture down', () => {
  it('WB31 clears only the logo when the profile save sends logo_url null', async () => {
    const res = await app.request(`/api/organizations/${orgId}/profile`, json(leader.token, 'PATCH', { logo_url: null }))
    expect(res.status).toBe(200)
    const { data } = await adminClient().from('organizations').select('logo_url, cover_url').eq('id', orgId).single()
    expect(data).toEqual({ logo_url: null, cover_url: 'https://example.com/cover.png' })
  })
})
