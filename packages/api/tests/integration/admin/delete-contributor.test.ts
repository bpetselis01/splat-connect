// journeys: (none — route coverage; no journey row names this route yet)
/**
 * DELETE /api/admin/contributors/:id runs the same 083 deletion a person runs
 * on themselves: it is admin-only, and it refuses to orphan an organisation by
 * deleting its sole leader.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { addLeader, createOrg } from '../../helpers/orgs.js'

let admin: TestUser
let member: TestUser
let leader: TestUser
let coLeader: TestUser
let target: TestUser
let orgId: string

const del = (id: string, token: string) => app.request(`/api/admin/contributors/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
const profile = async (id: string) => (await adminClient().from('profiles').select('id').eq('id', id).maybeSingle()).data
const authUser = async (id: string) => (await adminClient().auth.admin.getUserById(id)).data.user

beforeAll(async () => {
  ;[admin, member, leader, coLeader, target] = await Promise.all([
    createTestUser('admin'), createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor'),
  ])
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
})
afterAll(async () => {
  await adminClient().from('organizations').delete().eq('id', orgId)
  for (const u of [admin, member, leader, coLeader, target]) await deleteTestUser(u.id)
})

describe('admin deletes a contributor', () => {
  it('refuses a member and leaves the account alone', async () => {
    expect((await del(target.id, member.token)).status).toBe(403)
    expect(await profile(target.id)).not.toBeNull()
  })

  it('refuses to delete the sole leader of an organisation, and changes nothing', async () => {
    const res = await del(leader.id, admin.token)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Hand over their organisation first.' })
    expect(await profile(leader.id)).not.toBeNull()
    expect((await adminClient().from('org_leaders').select('user_id').eq('org_id', orgId)).data).toEqual([{ user_id: leader.id }])
  })

  it('deletes the sign-in and the profile once the organisation has another leader', async () => {
    await addLeader(orgId, coLeader.id)
    expect((await del(leader.id, admin.token)).status).toBe(204)
    expect(await profile(leader.id)).toBeNull()
    expect(await authUser(leader.id)).toBeNull()
    expect((await adminClient().from('org_leaders').select('user_id').eq('org_id', orgId)).data).toEqual([{ user_id: coLeader.id }])
  })

  it('deletes an ordinary contributor', async () => {
    expect((await del(target.id, admin.token)).status).toBe(204)
    expect(await profile(target.id)).toBeNull()
    expect(await authUser(target.id)).toBeNull()
  })
})
