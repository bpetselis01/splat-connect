/**
 * The three actions on a published toy's page: Save, Thank the holder, Report.
 * A person's toy is thanked through /api/contributors, an organisation's
 * through /api/organizations.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader } from '../../helpers/orgs.js'

const call = (u: TestUser, path: string, method = 'POST', body: unknown = {}) =>
  app.request(`http://localhost${path}`, {
    method,
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

let owner: TestUser
let leader: TestUser
let family: TestUser
let personToy: string
let orgToy: string
let orgId: string

const toy = async (row: Record<string, unknown>) =>
  (await adminClient().from('toys').insert({ status: 'published', condition: 7, offer_type: 'donation', photo_urls: ['https://example.com/c.jpg'], ...row }).select('id').single()).data!.id as string

beforeAll(async () => {
  ;[owner, leader, family] = await Promise.all([1, 2, 3].map(() => createTestUser('contributor')))
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  personToy = await toy({ name: 'Person toy', owner_id: owner.id })
  orgToy = await toy({ name: 'Org toy', owner_org_id: orgId })
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toys').delete().in('id', [personToy, orgToy])
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([owner, leader, family].map((u) => deleteTestUser(u.id)))
})

describe('toy page actions', () => {
  it('Y07 saves the toy', async () => {
    expect((await call(family, '/api/saves', 'POST', { entity_type: 'toy', entity_id: personToy })).status).toBe(201)
    const { data } = await adminClient().from('saves').select('entity_type, entity_id').eq('profile_id', family.id)
    expect(data).toEqual([{ entity_type: 'toy', entity_id: personToy }])
  })

  it('Y07 thanks a person holder once, stores profile_thanks and tells them', async () => {
    const res = await call(family, `/api/contributors/${owner.id}/thanks`)
    expect(res.status).toBe(201)
    expect(((await res.json()) as { thanks_count: number }).thanks_count).toBe(1)
    const { data } = await adminClient().from('profile_thanks').select('profile_id, thanker_id').eq('profile_id', owner.id)
    expect(data).toEqual([{ profile_id: owner.id, thanker_id: family.id }])
    const notices = (await adminClient().from('notifications').select('type, actor_name').eq('recipient_id', owner.id).eq('type', 'profile_thanked')).data!
    expect(notices).toEqual([{ type: 'profile_thanked', actor_name: 'A family' }])
    expect((await call(family, `/api/contributors/${owner.id}/thanks`)).status).toBe(409)
  })

  it('Y07 thanks an organisation holder once, stores org_thanks and tells its leaders', async () => {
    const res = await call(family, `/api/organizations/${orgId}/thanks`)
    expect(res.status).toBe(201)
    expect(((await res.json()) as { thanks_count: number }).thanks_count).toBe(1)
    const { data } = await adminClient().from('org_thanks').select('org_id, profile_id').eq('org_id', orgId)
    expect(data).toEqual([{ org_id: orgId, profile_id: family.id }])
    const notices = (await adminClient().from('notifications').select('type, actor_name').eq('recipient_id', leader.id).eq('type', 'org_thanked')).data!
    expect(notices).toEqual([{ type: 'org_thanked', actor_name: 'A family' }])
    expect((await call(family, `/api/organizations/${orgId}/thanks`)).status).toBe(409)
  })

  it('Y07 reports the toy, stored for admins under the caller and the toy', async () => {
    const res = await call(family, '/api/reports', 'POST', { subject_kind: 'toy', subject_id: personToy, subject_label: 'Person toy', category: 'wrong_info', body: 'The photo is not this toy.' })
    expect(res.status).toBe(201)
    const { data } = await adminClient().from('member_reports').select('reporter_id, subject_kind, subject_id, subject_label, category, body').eq('subject_id', personToy)
    expect(data).toEqual([{ reporter_id: family.id, subject_kind: 'toy', subject_id: personToy, subject_label: 'Person toy', category: 'wrong_info', body: 'The photo is not this toy.' }])
    await adminClient().from('member_reports').delete().eq('subject_id', personToy)
  })
})
