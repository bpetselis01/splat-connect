import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createOrg, addMember, acceptTerms, createOrgTutorial, cleanupOrg } from '../../helpers/orgs.js'

/**
 * Decision 14 removed the self-review block: a trusted org leader may approve a
 * tutorial they authored. That trades a preventive control for reactive ones, so
 * the reactive ones stop being a convenience and become the whole safety story.
 * This file pins the two the admin actually reaches for — take the leadership
 * away, or take the tutorial down — because nothing else now stands between a
 * leader and publishing their own work.
 *
 * Org suspension, the third, is covered in suspension.test.ts.
 */

let admin: TestUser
let leader: TestUser
let demotable: TestUser
let member: TestUser
let orgId: string
let ownTutorial: string
let demotableTutorial: string
let memberTutorial: string

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => {
  admin = await createTestUser('admin')
  leader = await createTestUser('contributor')
  demotable = await createTestUser('contributor')
  member = await createTestUser('contributor')
  await acceptTerms(leader.id, 'org_leader_terms')
  await acceptTerms(demotable.id, 'org_leader_terms')

  orgId = await createOrg({ createdBy: admin.id, status: 'approved', trustLevel: 'trusted' })
  await addMember({ orgId, userId: leader.id, orgRole: 'leader', status: 'approved' })
  await addMember({ orgId, userId: demotable.id, orgRole: 'leader', status: 'approved' })
  await addMember({ orgId, userId: member.id, orgRole: 'member', status: 'approved' })

  ownTutorial = await createOrgTutorial({ orgId, authorId: leader.id, authorToken: leader.token })
  demotableTutorial = await createOrgTutorial({
    orgId, authorId: demotable.id, authorToken: demotable.token,
  })
  memberTutorial = await createOrgTutorial({ orgId, authorId: member.id, authorToken: member.token })
})

afterAll(async () => {
  await cleanupOrg(orgId, [ownTutorial, demotableTutorial, memberTutorial])
  await deleteTestUser(admin.id)
  await deleteTestUser(leader.id)
  await deleteTestUser(demotable.id)
  await deleteTestUser(member.id)
})

describe('revoking a leader', () => {
  it('demoting to member instantly revokes the review grant', async () => {
    const db = createUserClient(demotable.token)

    // Deliberately a MEMBER's tutorial, not the leader's own. On their own
    // tutorial the "Contributors can update own tutorials" policy also matches, so
    // a post-demotion refusal would arrive as a 42501 from that policy's WITH
    // CHECK and would prove nothing about whether the leader grant closed. On
    // someone else's, no other policy matches and the block is a clean zero-row
    // exclusion — attributable to is_org_leader() and nothing else. The self-owned
    // case is asserted separately at the end.
    const before = await db
      .from('tutorials')
      .update({ status: 'approved' })
      .eq('id', memberTutorial)
      .select('id')
    expect(before.error).toBeNull()
    expect(before.data).toHaveLength(1)

    // Reset so the second attempt is byte-identical to the first.
    await adminClient().from('tutorials').update({ status: 'pending' }).eq('id', memberTutorial)

    // Demote. is_org_leader() bakes in org_role = 'leader', so this alone should
    // close the grant — no session to invalidate, no cache to clear.
    //
    // Under the ADMIN'S OWN JWT, not the service role. org_members_freeze_provenance
    // permits an org_role change only when is_admin(), and is_admin() reads
    // auth.uid() — which the service role does not have, so a service-role demote
    // raises 42501 and silently does nothing. Triggers run for service_role even
    // though RLS does not; this is the same trap the spec already documents for
    // tutorials.org_id. Asserted rather than assumed, because a demote that fails
    // quietly is the worst possible failure for this control.
    const demote = await createUserClient(admin.token)
      .from('org_members')
      .update({ org_role: 'member' })
      .eq('org_id', orgId)
      .eq('user_id', demotable.id)
      .select('id')
    expect(demote.error).toBeNull()
    expect(demote.data).toHaveLength(1)

    const after = await db
      .from('tutorials')
      .update({ status: 'approved' })
      .eq('id', memberTutorial)
      .select('id')
    // Both assertions are needed. The leader policy's USING now excludes the row,
    // which is a silent zero-row match rather than an error — and PostgREST nulls
    // `data` whenever `error` is set, so a length check alone would also pass if
    // the write had failed for an unrelated reason.
    expect(after.error).toBeNull()
    expect(after.data ?? []).toHaveLength(0)

    const { data: check } = await adminClient()
      .from('tutorials').select('status').eq('id', memberTutorial).single()
    expect(check?.status).toBe('pending')

    // And the self-approval decision 14 granted is gone with the role. Different
    // failure shape — 42501 from the contributor policy's WITH CHECK, since that
    // policy still matches the row and is now the only one that does.
    const ownAfter = await db
      .from('tutorials')
      .update({ status: 'approved' })
      .eq('id', demotableTutorial)
      .select('id')
    expect(ownAfter.error?.code).toBe('42501')
  })
})

describe('rejecting a published tutorial', () => {
  it('an admin can reject a tutorial its own author approved as leader', async () => {
    // 1. The leader self-approves — the capability decision 14 granted.
    const selfApprove = await createUserClient(leader.token)
      .from('tutorials')
      .update({ status: 'approved' })
      .eq('id', ownTutorial)
      .select('id')
    expect(selfApprove.error).toBeNull()
    expect(selfApprove.data).toHaveLength(1)

    // 2. Feedback arrives. The admin pulls it back down through the real endpoint,
    //    not a direct table write — the point is that the route permits
    //    approved → rejected, since nothing in it constrains the transition.
    const res = await app.request(
      `/api/admin/tutorials/${ownTutorial}/status`,
      authed(admin.token, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'rejected', rejection_note: 'Step 4 is unsafe as written' }),
      }),
    )
    expect(res.status).toBe(200)

    const { data } = await adminClient()
      .from('tutorials')
      .select('status, rejection_note')
      .eq('id', ownTutorial)
      .single()
    expect(data?.status).toBe('rejected')
    expect(data?.rejection_note).toBe('Step 4 is unsafe as written')
  })

  it('a leader cannot reject through the admin endpoint', async () => {
    const res = await app.request(
      `/api/admin/tutorials/${ownTutorial}/status`,
      authed(leader.token, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
      }),
    )
    expect(res.status).toBe(403)
  })
})
