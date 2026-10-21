/** What the organisation's request queue reads: GET /api/toy-transactions gives a leader the records their organisation owns, with the family named. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { nameUser } from '../../helpers/notifications.js'
import { addLeader, cleanupOrg, createOrg, createOrgToy } from '../../helpers/orgs.js'

let leader: TestUser
let rival: TestUser
let family: TestUser
let orgId: string
let rivalOrgId: string
let txId: string

const list = async (u: TestUser) =>
  (await (await app.request('/api/toy-transactions?role=owner', { headers: { Authorization: `Bearer ${u.token}` } })).json()) as Array<Record<string, unknown>>

beforeAll(async () => {
  leader = await createTestUser('contributor')
  rival = await createTestUser('contributor')
  family = await createTestUser('contributor')
  await nameUser(family.id, 'Ada Family')
  orgId = await createOrg({ createdBy: leader.id, name: 'Queue Org' })
  rivalOrgId = await createOrg({ createdBy: rival.id, name: 'Other Queue Org' })
  await addLeader(orgId, leader.id)
  await addLeader(rivalOrgId, rival.id)
  const toyId = await createOrgToy({ orgId, name: 'Queue bear' })
  const { data, error } = await adminClient()
    .from('toy_transactions')
    .insert({ type: 'donation', status: 'requested', requester_id: family.id, owner_id: null, owner_org_id: orgId, toy_id: toyId })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed failed: ${error?.message}`)
  txId = data.id
})

afterAll(async () => {
  await adminClient().from('toy_transactions').delete().eq('id', txId)
  await cleanupOrg(orgId)
  await cleanupOrg(rivalOrgId)
  for (const u of [leader, rival, family]) await deleteTestUser(u.id)
})

describe('the organisation request queue', () => {
  it('WB08 gives a leader the record their organisation owns, naming the family and the organisation', async () => {
    const mine = (await list(leader)).find((t) => t.id === txId)
    expect(mine).toMatchObject({
      status: 'requested',
      type: 'donation',
      owner_org_id: orgId,
      toy_name: 'Queue bear',
      requester_name: 'Ada Family',
      other_party_name: 'Ada Family',
      acting_for_org_name: 'Queue Org',
    })
  })

  it('WB08 keeps another organisation’s leader out of it', async () => {
    expect((await list(rival)).find((t) => t.id === txId)).toBeUndefined()
  })
})
