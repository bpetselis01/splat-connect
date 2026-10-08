/**
 * The intake rule's server half: nothing under the two-kilo floor is credited,
 * whatever the client sends. The credit is the leader's number, not a yield.
 */
// journeys: L12 L13 L14
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createUserClient } from '../../../src/supabase/client.js'
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

/*
 * 115: credit is minted by a leader weighing it in. A member writing straight
 * to PostgREST must not be able to book a row that arrives already received.
 */
describe('booking by direct insert', () => {
  const booking = () => ({
    org_id: orgId, contributor_id: family.id, material: 'PLA', estimated_grams: 2500,
    condition_declared: true, declaration_version: DECLARATION_VERSION,
  })

  it('refuses a row carrying any column the leader sets', async () => {
    const db = createUserClient(family.token)
    for (const extra of [
      { status: 'received', weighed_grams: 1000000, credit_grams: 1000000 },
      { weighed_grams: 2500 },
      { credit_grams: 2000 },
      { decided_by: family.id },
      { status: 'declined' },
    ]) {
      const { error } = await db.from('recycling_dropoffs').insert({ ...booking(), ...extra })
      expect(error?.code, JSON.stringify(extra)).toBe('42501')
    }
  })

  it('still takes a plain booking', async () => {
    const { error } = await createUserClient(family.token).from('recycling_dropoffs').insert(booking())
    expect(error).toBeNull()
  })
})

/*
 * 115: a decided drop-off is final. Credit may already be spent against it, so
 * re-weighing it down would drive the balance negative.
 */
describe('after it is decided', () => {
  it('refuses to change a received drop-off, through the API', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/recycling/${dropId}`,
      json(leader.token, 'PATCH', { status: 'received', weighed_grams: 2000, credit_grams: 0 })
    )
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toBe('This drop-off has already been decided and cannot be changed.')
    const declining = await app.request(`/api/organizations/${orgId}/recycling/${dropId}`, json(leader.token, 'PATCH', { status: 'declined' }))
    expect(declining.status).toBe(409)
  })

  it('refuses the same on a direct update by the leader (the policy)', async () => {
    const { data } = await createUserClient(leader.token)
      .from('recycling_dropoffs')
      .update({ credit_grams: 0 })
      .eq('id', dropId)
      .select('id')
    expect(data).toEqual([])
    const { data: row } = await adminClient().from('recycling_dropoffs').select('credit_grams').eq('id', dropId).single()
    expect(row!.credit_grams).toBe(2100)
  })

  it('still answers 404 for a drop-off that is not there', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/recycling/${crypto.randomUUID()}`,
      json(leader.token, 'PATCH', { status: 'declined' })
    )
    expect(res.status).toBe(404)
  })
})
