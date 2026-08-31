import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/client.js'
import { createOrg, addLeader, acceptTerms, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

let author: TestUser
let leaderA: TestUser
let leaderB: TestUser
let stranger: TestUser
let orgA: string
let orgB: string
let orgC: string
let project: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  leaderA = await createTestUser('contributor')
  leaderB = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  await acceptTerms(leaderA.id, 'org_leader_terms')
  await acceptTerms(leaderB.id, 'org_leader_terms')

  orgA = await createOrg({ createdBy: leaderA.id, name: 'Riverside Therapy' })
  await addLeader(orgA, leaderA.id)
  orgB = await createOrg({ createdBy: leaderB.id, name: 'Northside Clinic' })
  await addLeader(orgB, leaderB.id)
  orgC = await createOrg({ createdBy: leaderA.id, name: 'Declining Clinic' })

  project = await createProject({ authorId: author.id })
  await requestBacking({ tutorialId: project, orgId: orgA, status: 'accepted', respondedBy: leaderA.id })
  await requestBacking({ tutorialId: project, orgId: orgB, status: 'accepted', respondedBy: leaderB.id })
  await requestBacking({ tutorialId: project, orgId: orgC, status: 'declined' })
})

afterAll(async () => {
  await cleanupOrg(orgA, [project])
  await cleanupOrg(orgB)
  await cleanupOrg(orgC)
  await deleteTestUser(author.id)
  await deleteTestUser(leaderA.id)
  await deleteTestUser(leaderB.id)
  await deleteTestUser(stranger.id)
})

describe('two organisations backing one project', () => {
  it('either leader can approve it, and first to act wins', async () => {
    const { data, error } = await createUserClient(leaderB.token)
      .from('tutorials')
      .update({
        status: 'approved',
        reviewed_by: leaderB.id,
        reviewed_for_org_id: orgB,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', project)
      .select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)

    const { data: row } = await adminClient()
      .from('tutorials').select('status, reviewed_by, reviewed_for_org_id').eq('id', project).single()
    expect(row).toMatchObject({
      status: 'approved', reviewed_by: leaderB.id, reviewed_for_org_id: orgB,
    })
  })

  it('shows only accepted orgs as public badges on a published project', async () => {
    // `stranger` has no relationship to the project or any of the three orgs.
    const { data, error } = await createUserClient(stranger.token)
      .from('tutorial_orgs')
      .select('org_id, status')
      .eq('tutorial_id', project)
    expect(error).toBeNull()
    const ids = (data ?? []).map((r) => r.org_id)
    expect(ids).toContain(orgA)
    expect(ids).toContain(orgB)
    expect(ids).not.toContain(orgC)
  })

  it('hides backing rows on a project that is not published', async () => {
    const draft = await createProject({ authorId: author.id, status: 'draft' })
    await requestBacking({ tutorialId: draft, orgId: orgA, status: 'accepted' })

    const { data } = await createUserClient(stranger.token)
      .from('tutorial_orgs')
      .select('id')
      .eq('tutorial_id', draft)
    expect(data ?? []).toHaveLength(0)

    await adminClient().from('tutorials').delete().eq('id', draft)
  })

  it('a leader cannot credit the approval to an org they do not lead', async () => {
    // Both orgs back this project, and leaderA leads only orgA. can_review_tutorial
    // is true for them either way, so nothing in the policy layer distinguishes
    // these two writes — without the trigger check, leaderA can put Northside's
    // name on their own approval.
    await adminClient().from('tutorials').update({
      status: 'pending', reviewed_by: null, reviewed_for_org_id: null,
    }).eq('id', project)

    const { error } = await createUserClient(leaderA.token)
      .from('tutorials')
      .update({ status: 'approved', reviewed_by: leaderA.id, reviewed_for_org_id: orgB })
      .eq('id', project)
      .select('id')
    expect(error?.code).toBe('42501')

    const { data: honest } = await createUserClient(leaderA.token)
      .from('tutorials')
      .update({ status: 'approved', reviewed_by: leaderA.id, reviewed_for_org_id: orgA })
      .eq('id', project)
      .select('id')
    expect(honest).toHaveLength(1)
  })

  it('a leader whose org withdrew loses the review grant, the other keeps it', async () => {
    await adminClient().from('tutorials').update({
      status: 'pending', reviewed_by: null, reviewed_for_org_id: null,
    }).eq('id', project)
    await adminClient().from('tutorial_orgs')
      .update({ status: 'declined' }).eq('tutorial_id', project).eq('org_id', orgB)

    const gone = await createUserClient(leaderB.token)
      .from('tutorials').update({ status: 'approved' }).eq('id', project).select('id')
    expect(gone.error).toBeNull()
    expect(gone.data ?? []).toHaveLength(0)

    const still = await createUserClient(leaderA.token)
      .from('tutorials').update({ status: 'approved' }).eq('id', project).select('id')
    expect(still.error).toBeNull()
    expect(still.data).toHaveLength(1)
  })
})
