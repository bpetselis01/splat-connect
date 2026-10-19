/** DELETE /api/organizations/invites/:inviteId lets the invited person turn down an invitation to lead; nobody else's. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { addLeader, createOrg } from '../../helpers/orgs.js'

let leader: TestUser
let invitee: TestUser
let bystander: TestUser
let orgId: string
let inviteId: string

const decline = (id: string, token: string) =>
  app.request(`/api/organizations/invites/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
const invites = async () => (await adminClient().from('org_leader_invites').select('id').eq('org_id', orgId)).data!.map((r) => r.id)
const leaders = async () => (await adminClient().from('org_leaders').select('user_id').eq('org_id', orgId)).data!.map((r) => r.user_id)

beforeAll(async () => {
  ;[leader, invitee, bystander] = await Promise.all([createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor')])
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  const { data, error } = await adminClient().from('org_leader_invites').insert({ org_id: orgId, invited_profile_id: invitee.id, invited_by: leader.id }).select('id').single()
  if (error) throw new Error(error.message)
  inviteId = data.id
})
afterAll(async () => {
  await adminClient().from('organizations').delete().eq('id', orgId)
  for (const u of [leader, invitee, bystander]) await deleteTestUser(u.id)
})

describe('declining an invitation to lead', () => {
  it('L31 answers anyone but the invitee, and an unknown id, with a 404 and keeps the invitation', async () => {
    for (const [id, token] of [[inviteId, bystander.token], [inviteId, leader.token], [crypto.randomUUID(), invitee.token]]) {
      const res = await decline(id, token)
      expect(res.status, id).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
    }
    expect(await invites()).toEqual([inviteId])
  })

  it('L31 WD09 removes the invitation without making the invitee a leader', async () => {
    const res = await decline(inviteId, invitee.token)
    expect(res.status).toBe(204)
    expect(await invites()).toEqual([])
    expect(await leaders()).toEqual([leader.id])
  })
})
