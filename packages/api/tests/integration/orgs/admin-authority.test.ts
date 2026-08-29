import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/client.js'
import { createOrg, addLeader, acceptTerms, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

let admin: TestUser
let leader: TestUser
let author: TestUser
let orgId: string
let createdByAdmin: string | undefined
let project: string

beforeAll(async () => {
  admin = await createTestUser('admin')
  leader = await createTestUser('contributor')
  author = await createTestUser('contributor')
  await acceptTerms(leader.id, 'org_leader_terms')
  orgId = await createOrg({ createdBy: admin.id })
  await addLeader(orgId, leader.id)
  project = await createProject({ authorId: author.id })
  await requestBacking({ tutorialId: project, orgId, status: 'accepted', respondedBy: leader.id })
})

afterAll(async () => {
  await cleanupOrg(orgId, [project])
  if (createdByAdmin) await cleanupOrg(createdByAdmin)
  await deleteTestUser(admin.id)
  await deleteTestUser(leader.id)
  await deleteTestUser(author.id)
})

describe('organisation authority', () => {
  it('only an admin can create an organisation', async () => {
    const attempt = (u: TestUser) =>
      createUserClient(u.token)
        .from('organizations')
        .insert({ name: `Gate ${crypto.randomUUID().slice(0, 8)}`, created_by: u.id })
        .select('id')
        .single()

    const refused = await attempt(leader)
    expect(refused.error?.code).toBe('42501')

    const allowed = await attempt(admin)
    expect(allowed.error).toBeNull()
    createdByAdmin = allowed.data!.id as string
  })

  it('only an admin can appoint a leader', async () => {
    const { error } = await createUserClient(leader.token)
      .from('org_leaders')
      .insert({ org_id: orgId, user_id: author.id })
    expect(error?.code).toBe('42501')
  })

  it('a leader cannot suspend or rename their own org', async () => {
    const { data, error } = await createUserClient(leader.token)
      .from('organizations')
      .update({ status: 'suspended', name: 'Renamed' })
      .eq('id', orgId)
      .select('id')
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it('removing a leader revokes review instantly, and the removal persists', async () => {
    // Assert against the database, not the row count alone: the superseded design
    // shipped a revocation path that reported success and changed nothing, and
    // only a database assertion caught it.
    const before = await createUserClient(leader.token)
      .from('tutorials').update({ status: 'approved' }).eq('id', project).select('id')
    expect(before.data).toHaveLength(1)
    await adminClient().from('tutorials').update({ status: 'pending' }).eq('id', project)

    const removal = await createUserClient(admin.token)
      .from('org_leaders').delete().eq('org_id', orgId).eq('user_id', leader.id).select('id')
    expect(removal.error).toBeNull()
    expect(removal.data).toHaveLength(1)

    const { data: gone } = await adminClient()
      .from('org_leaders').select('id').eq('org_id', orgId).eq('user_id', leader.id)
    expect(gone ?? []).toHaveLength(0)

    const after = await createUserClient(leader.token)
      .from('tutorials').update({ status: 'approved' }).eq('id', project).select('id')
    expect(after.error).toBeNull()
    expect(after.data ?? []).toHaveLength(0)
  })
})
