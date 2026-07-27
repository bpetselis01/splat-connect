import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createOrg, addMember, acceptTerms, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let joiner: TestUser
let orgId: string
let otherOrgId: string
// Created inline inside individual tests. Hoisted so afterAll can clean them up
// even if an assertion throws before the test body reaches its own cleanup —
// the suite runs serially against one shared database, so a leaked org can
// corrupt later tests.
let freshOrg: string | undefined
let foreignOrg: string | undefined

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
  if (freshOrg) await cleanupOrg(freshOrg)
  if (foreignOrg) await cleanupOrg(foreignOrg)
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

  it('a contributor cannot rewrite initiated_by to self-approve and self-promote', async () => {
    const rowId = await addMember({
      orgId, userId: joiner.id, orgRole: 'member', status: 'pending', initiatedBy: 'contributor',
    })

    // ONLY org_members_freeze_provenance blocks this. The contributor policy's
    // WITH CHECK sees the NEW row, where initiated_by has already been rewritten
    // to 'org' and org_role is unconstrained — so the policy would permit it.
    // Drop the trigger and this test must fail; that is the point of it.
    const { error } = await createUserClient(joiner.token)
      .from('org_members')
      .update({ initiated_by: 'org', status: 'approved', org_role: 'leader' })
      .eq('id', rowId)
      .select('id')
    expect(error?.code).toBe('42501')

    // Ground truth via the service role: a 42501 alone does not prove the row survived intact.
    const { data } = await adminClient()
      .from('org_members').select('org_role, status, initiated_by').eq('id', rowId).single()
    expect(data).toMatchObject({ org_role: 'member', status: 'pending', initiated_by: 'contributor' })

    await adminClient().from('org_members').delete().eq('id', rowId)
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
    freshOrg = await createOrg({ createdBy: leader.id, status: 'pending' })
    const leaderDb = createUserClient(leader.token)

    const { error: ok } = await leaderDb.from('org_members').insert({
      org_id: freshOrg, user_id: leader.id, org_role: 'leader', status: 'approved', initiated_by: 'org',
    })
    expect(ok).toBeNull()

    // A second claim on the same org is refused: it already has a leader.
    // Note: this alone doesn't isolate created_by — org_has_approved_leader(org_id)
    // is also false-turned-true here, so this assertion passes even if created_by
    // were dropped from the policy entirely. See the next test, which isolates it.
    const { error: second } = await createUserClient(joiner.token).from('org_members').insert({
      org_id: freshOrg, user_id: joiner.id, org_role: 'leader', status: 'approved', initiated_by: 'org',
    })
    expect(second).not.toBeNull()
    expect(second?.code).toBe('42501')

    await cleanupOrg(freshOrg)
  })

  it('the founder-bootstrap policy also refuses a non-creator, independent of leader state', async () => {
    // Isolates the created_by scope: this org has no approved leader, so
    // `not org_has_approved_leader` is satisfied and only created_by can refuse.
    foreignOrg = await createOrg({ createdBy: joiner.id, status: 'pending' })
    const { error: notMine } = await createUserClient(leader.token).from('org_members').insert({
      org_id: foreignOrg, user_id: leader.id, org_role: 'leader', status: 'approved', initiated_by: 'org',
    })
    expect(notMine?.code).toBe('42501')
    await cleanupOrg(foreignOrg)
  })
})
