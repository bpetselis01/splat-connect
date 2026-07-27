import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createOrg, addMember, acceptTerms, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let joiner: TestUser
let orgId: string
let otherOrgId: string

beforeAll(async () => {
  leader = await createTestUser('contributor')
  joiner = await createTestUser('contributor')
  await acceptTerms(leader.id, 'org_leader_terms')

  orgId = await createOrg({ createdBy: leader.id, status: 'approved' })
  await addMember({ orgId, userId: leader.id, orgRole: 'leader', status: 'approved' })
  otherOrgId = await createOrg({ createdBy: leader.id, status: 'approved' })
})

afterAll(async () => {
  await cleanupOrg(orgId)
  await cleanupOrg(otherOrgId)
  await deleteTestUser(leader.id)
  await deleteTestUser(joiner.id)
})

describe('membership handshake', () => {
  it('a contributor cannot approve their own join request', async () => {
    const joinerDb = createUserClient(joiner.token)
    const { data: inserted, error } = await joinerDb
      .from('org_members')
      .insert({ org_id: orgId, user_id: joiner.id, initiated_by: 'contributor', status: 'pending', org_role: 'member' })
      .select('id')
      .single()
    expect(error).toBeNull()

    // The joiner's own row is visible to them (USING user_id = auth.uid()), so this
    // is not a silent USING exclusion. The contributor UPDATE policy's WITH CHECK
    // requires initiated_by = 'org', and this row is 'contributor' — the row is
    // selected but the new row fails every applicable WITH CHECK, which Postgres
    // reports as an RLS violation, not a zero-row match.
    const { data: escalated, error: escalatedError } = await joinerDb
      .from('org_members')
      .update({ status: 'approved' })
      .eq('id', inserted!.id)
      .select('id')
    expect(escalatedError?.code).toBe('42501')
    expect(escalated).toBeNull()

    // The leader can resolve it, because the contributor initiated it.
    const { data: approved, error: approvedError } = await createUserClient(leader.token)
      .from('org_members')
      .update({ status: 'approved' })
      .eq('id', inserted!.id)
      .select('id')
    expect(approvedError).toBeNull()
    expect(approved).toHaveLength(1)

    await adminClient().from('org_members').delete().eq('id', inserted!.id)
  })

  it('a contributor cannot request to join as a leader', async () => {
    const { error } = await createUserClient(joiner.token)
      .from('org_members')
      .insert({ org_id: otherOrgId, user_id: joiner.id, initiated_by: 'contributor', status: 'pending', org_role: 'leader' })
    // No INSERT policy matches org_role = 'leader' from this path.
    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501')
  })

  it("a leader cannot accept an invitation on the invitee's behalf", async () => {
    const memberRowId = await addMember({
      orgId, userId: joiner.id, orgRole: 'member', status: 'pending', initiatedBy: 'org',
    })

    // The leader can see this row (USING is_org_leader(org_id) is true — it's their
    // org's roster), so this is again a WITH CHECK failure, not a USING exclusion:
    // the leader policy's check only allows resolving contributor-initiated rows,
    // and this one is org-initiated.
    const { data: forced, error: forcedError } = await createUserClient(leader.token)
      .from('org_members')
      .update({ status: 'approved' })
      .eq('id', memberRowId)
      .select('id')
    expect(forcedError?.code).toBe('42501')
    expect(forced).toBeNull()

    // The invited contributor themselves can accept it.
    const { data: accepted, error: acceptedError } = await createUserClient(joiner.token)
      .from('org_members')
      .update({ status: 'approved' })
      .eq('id', memberRowId)
      .select('id')
    expect(acceptedError).toBeNull()
    expect(accepted).toHaveLength(1)

    await adminClient().from('org_members').delete().eq('id', memberRowId)
  })

  it('a declined membership can be revived to pending by the leader', async () => {
    const rowId = await addMember({
      orgId, userId: joiner.id, status: 'declined', initiatedBy: 'org',
    })
    const { data, error } = await createUserClient(leader.token)
      .from('org_members')
      .update({ status: 'pending' })
      .eq('id', rowId)
      .select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    await adminClient().from('org_members').delete().eq('id', rowId)
  })

  it('the org creator can claim first leadership, but only of their own org', async () => {
    const freshOrg = await createOrg({ createdBy: leader.id, status: 'pending' })
    const leaderDb = createUserClient(leader.token)

    const { error: ok } = await leaderDb.from('org_members').insert({
      org_id: freshOrg, user_id: leader.id, org_role: 'leader', status: 'approved', initiated_by: 'org',
    })
    expect(ok).toBeNull()

    // A second claim on the same org is refused: it already has a leader.
    const { error: second } = await createUserClient(joiner.token).from('org_members').insert({
      org_id: freshOrg, user_id: joiner.id, org_role: 'leader', status: 'approved', initiated_by: 'org',
    })
    expect(second).not.toBeNull()
    expect(second?.code).toBe('42501')

    await cleanupOrg(freshOrg)
  })
})
