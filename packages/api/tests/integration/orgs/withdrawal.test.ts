import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createOrg, addLeader, acceptTerms, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

let author: TestUser
let leader: TestUser
let stranger: TestUser
let orgId: string
let otherOrgId: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  leader = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  await acceptTerms(leader.id, 'org_leader_terms')
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  otherOrgId = await createOrg({ createdBy: leader.id })
})

afterAll(async () => {
  await cleanupOrg(orgId)
  await cleanupOrg(otherOrgId)
  await deleteTestUser(author.id)
  await deleteTestUser(leader.id)
  await deleteTestUser(stranger.id)
})

/** Fresh project per test: withdrawal is destructive and the freeze depends on
 *  the tutorial's own status, so sharing a fixture would couple the tests. */
async function project(status: 'draft' | 'pending' | 'approved' = 'pending') {
  return createProject({ authorId: author.id, status })
}

describe('withdrawing backing', () => {
  it('the author can withdraw a pending request', async () => {
    const t = await project('draft')
    const rowId = await requestBacking({ tutorialId: t, orgId })
    const { error, data } = await createUserClient(author.token)
      .from('tutorial_orgs').delete().eq('id', rowId).select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    await adminClient().from('tutorials').delete().eq('id', t)
  })

  it('a leader can withdraw their own org after accepting', async () => {
    const t = await project()
    const rowId = await requestBacking({ tutorialId: t, orgId, status: 'accepted' })
    const { error, data } = await createUserClient(leader.token)
      .from('tutorial_orgs').delete().eq('id', rowId).select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    await adminClient().from('tutorials').delete().eq('id', t)
  })

  it('a stranger can withdraw nothing', async () => {
    const t = await project()
    const rowId = await requestBacking({ tutorialId: t, orgId, status: 'accepted' })
    const { error, data } = await createUserClient(stranger.token)
      .from('tutorial_orgs').delete().eq('id', rowId).select('id')
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
    await adminClient().from('tutorials').delete().eq('id', t)
  })

  it('nobody can withdraw the org that approved the published project', async () => {
    // The freeze (decision 22). Without it reviewed_for_org_id would point at an
    // organisation no longer listed, so a published tutorial would show an
    // approver whose organisation appears nowhere.
    const t = await project()
    const rowId = await requestBacking({ tutorialId: t, orgId, status: 'accepted' })
    await adminClient().from('tutorials').update({
      status: 'approved', reviewed_by: leader.id, reviewed_for_org_id: orgId,
    }).eq('id', t)

    for (const who of [author, leader]) {
      const { error, data } = await createUserClient(who.token)
        .from('tutorial_orgs').delete().eq('id', rowId).select('id')
      expect(error).toBeNull()
      expect(data ?? []).toHaveLength(0)
    }

    const { data: survives } = await adminClient()
      .from('tutorial_orgs').select('id').eq('id', rowId).single()
    expect(survives?.id).toBe(rowId)
    await adminClient().from('tutorials').delete().eq('id', t)
  })

  it('a collaborator that did not approve can still withdraw after publication', async () => {
    // Only the organisation that actually reviewed is bound. One that lent its
    // name may take it back — that is what decision 22 says.
    const t = await project()
    const approverRow = await requestBacking({ tutorialId: t, orgId, status: 'accepted' })
    const collaboratorRow = await requestBacking({ tutorialId: t, orgId: otherOrgId, status: 'accepted' })
    await addLeader(otherOrgId, leader.id)
    await adminClient().from('tutorials').update({
      status: 'approved', reviewed_by: leader.id, reviewed_for_org_id: orgId,
    }).eq('id', t)

    const { error, data } = await createUserClient(leader.token)
      .from('tutorial_orgs').delete().eq('id', collaboratorRow).select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)

    const { data: bound } = await adminClient()
      .from('tutorial_orgs').select('id').eq('id', approverRow).single()
    expect(bound?.id).toBe(approverRow)
    await adminClient().from('tutorials').delete().eq('id', t)
  })
})
