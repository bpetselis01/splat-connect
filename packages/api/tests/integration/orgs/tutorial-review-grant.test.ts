import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createOrg, addMember, createOrgTutorial, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let member: TestUser
let outsider: TestUser
let trustedOrg: string
let probationOrg: string
let memberTutorial: string
let leaderOwnTutorial: string
let outsiderTutorial: string
let probationTutorial: string

beforeAll(async () => {
  leader = await createTestUser('contributor')
  member = await createTestUser('contributor')
  outsider = await createTestUser('contributor')

  trustedOrg = await createOrg({ createdBy: leader.id, status: 'approved', trustLevel: 'trusted' })
  await addMember({ orgId: trustedOrg, userId: leader.id, orgRole: 'leader', status: 'approved' })
  await addMember({ orgId: trustedOrg, userId: member.id, orgRole: 'member', status: 'approved' })

  probationOrg = await createOrg({ createdBy: leader.id, status: 'approved', trustLevel: 'probation' })
  await addMember({ orgId: probationOrg, userId: leader.id, orgRole: 'leader', status: 'approved' })
  // Needed so `member`'s own JWT can pin the fixture tutorial to this org — the
  // tutorials_org_must_be_own trigger requires the caller be an approved member.
  await addMember({ orgId: probationOrg, userId: member.id, orgRole: 'member', status: 'approved' })

  memberTutorial = await createOrgTutorial({ orgId: trustedOrg, authorId: member.id, authorToken: member.token })
  // The leader is a tutorial_contributor on this one — the self-review case.
  leaderOwnTutorial = await createOrgTutorial({ orgId: trustedOrg, authorId: leader.id, authorToken: leader.token })
  // Carries no org_id: the platform queue, nobody's org to review.
  outsiderTutorial = await createOrgTutorial({ orgId: null, authorId: outsider.id, authorToken: outsider.token })
  probationTutorial = await createOrgTutorial({ orgId: probationOrg, authorId: member.id, authorToken: member.token })
})

afterAll(async () => {
  await cleanupOrg(trustedOrg, [memberTutorial, leaderOwnTutorial, outsiderTutorial])
  await cleanupOrg(probationOrg, [probationTutorial])
  await deleteTestUser(leader.id)
  await deleteTestUser(member.id)
  await deleteTestUser(outsider.id)
})

/** An RLS-blocked UPDATE matches zero rows rather than erroring, so every
 *  assertion here is on the affected row count. */
async function tryApprove(token: string, tutorialId: string): Promise<number> {
  const { data } = await createUserClient(token)
    .from('tutorials')
    .update({ status: 'approved' })
    .eq('id', tutorialId)
    .select('id')
  return (data ?? []).length
}

describe('leader review grant', () => {
  it("approves a member's tutorial in a trusted, approved org", async () => {
    expect(await tryApprove(leader.token, memberTutorial)).toBe(1)
  })

  it('cannot approve a tutorial from outside the org', async () => {
    expect(await tryApprove(leader.token, outsiderTutorial)).toBe(0)
  })

  it('cannot approve its own tutorial, even as a linked collaborator', async () => {
    expect(await tryApprove(leader.token, leaderOwnTutorial)).toBe(0)
  })

  it('cannot approve anything while the org is on probation', async () => {
    expect(await tryApprove(leader.token, probationTutorial)).toBe(0)
  })

  it('a plain member has no review grant over their own org', async () => {
    expect(await tryApprove(member.token, memberTutorial)).toBe(0)
  })
})
