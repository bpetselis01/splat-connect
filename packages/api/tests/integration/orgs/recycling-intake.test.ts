/**
 * The intake rule's server half: nothing under the two-kilo floor is credited,
 * whatever the client sends. The credit is the leader's number, not a yield.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { DECLARATION_VERSION } from '@splat-connect/types'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader } from '../../helpers/orgs.js'

let leader: TestUser
let family: TestUser
let orgId: string
let dropId: string

const json = (token: string, method: string, body: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

beforeAll(async () => {
  ;[leader, family] = await Promise.all([createTestUser('contributor'), createTestUser('contributor')])
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  const { data } = await adminClient()
    .from('recycling_dropoffs')
    .insert({ org_id: orgId, contributor_id: family.id, material: 'PLA', estimated_grams: 2500, condition_declared: true, declaration_version: DECLARATION_VERSION })
    .select('id')
    .single()
  dropId = data!.id
})

afterAll(async () => {
  await adminClient().from('recycling_dropoffs').delete().eq('org_id', orgId)
  await adminClient().from('organizations').delete().eq('id', orgId)
  await Promise.all([deleteTestUser(leader.id), deleteTestUser(family.id)])
})

describe('weighing in', () => {
  it('refuses to credit anything under two kilos', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/recycling/${dropId}`,
      json(leader.token, 'PATCH', { status: 'received', weighed_grams: 1500, credit_grams: 1100 })
    )
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe('Under the 2 kg minimum — log it as a donation or hand it back.')
  })

  it('stores the credit the leader entered, not three quarters', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/recycling/${dropId}`,
      json(leader.token, 'PATCH', { status: 'received', weighed_grams: 2600, credit_grams: 2100 })
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { credit_grams: number }).credit_grams).toBe(2100)
  })
})
