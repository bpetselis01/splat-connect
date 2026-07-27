import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createOrg, addMember, createOrgTutorial, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let member: TestUser
let orgId: string
let tutorialId: string

beforeAll(async () => {
  leader = await createTestUser('contributor')
  member = await createTestUser('contributor')
  orgId = await createOrg({ createdBy: leader.id, status: 'approved', trustLevel: 'trusted' })
  await addMember({ orgId, userId: leader.id, orgRole: 'leader', status: 'approved' })
  await addMember({ orgId, userId: member.id, orgRole: 'member', status: 'approved' })
  tutorialId = await createOrgTutorial({ orgId, authorId: member.id, authorToken: member.token, status: 'pending' })
})

afterAll(async () => {
  await cleanupOrg(orgId, [tutorialId])
  await deleteTestUser(leader.id)
  await deleteTestUser(member.id)
})

describe('suspending an org revokes leader review authority', () => {
  it('revokes the approve capability the moment the org is suspended', async () => {
    const leaderDb = createUserClient(leader.token)

    // 1. Baseline: the grant works while the org is approved + trusted.
    const before = await leaderDb
      .from('tutorials')
      .update({ status: 'approved', reviewed_by: leader.id, review_level: 'org' })
      .eq('id', tutorialId)
      .select('id')
    expect(before.error).toBeNull()
    expect(before.data).toHaveLength(1)

    // Reset so the second attempt is identical to the first.
    await adminClient().from('tutorials').update({ status: 'pending' }).eq('id', tutorialId)

    // 2. Suspend the org out from under the leader.
    await adminClient().from('organizations').update({ status: 'suspended' }).eq('id', orgId)

    // 3. The identical update must now affect zero rows. An RLS USING clause that
    //    excludes the row is not an error — it silently matches nothing. Asserting
    //    on the row count is what makes this test real.
    const after = await leaderDb
      .from('tutorials')
      .update({ status: 'approved' })
      .eq('id', tutorialId)
      .select('id')
    // Both assertions are needed: PostgREST nulls `data` whenever `error` is set,
    // so checking the row count alone would also pass if the write had errored for
    // an unrelated reason. An RLS USING clause that excludes the row is not an
    // error — it silently matches nothing, and that is what must be proven here.
    expect(after.error).toBeNull()
    expect(after.data ?? []).toHaveLength(0)

    const { data: check } = await adminClient()
      .from('tutorials')
      .select('status')
      .eq('id', tutorialId)
      .single()
    expect(check?.status).toBe('pending')
  })
})
