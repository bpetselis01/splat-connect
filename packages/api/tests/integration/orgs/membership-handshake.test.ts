import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createOrg, addMember, acceptTerms, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let joiner: TestUser
let admin: TestUser
let orgId: string
let otherOrgId: string
// Created inline inside individual tests. Hoisted so afterAll can clean them up
// even if an assertion throws before the test body reaches its own cleanup —
// the suite runs serially against one shared database, so a leaked org can
// corrupt later tests.
let adminOrg: string | undefined

beforeAll(async () => {
  leader = await createTestUser('contributor')
  joiner = await createTestUser('contributor')
  admin = await createTestUser('admin')
  // Kept deliberately: it is what makes the refusal in the first test
  // attributable to is_admin() rather than to a missing agreement.
  await acceptTerms(leader.id, 'org_leader_terms')

  orgId = await createOrg({ createdBy: leader.id, status: 'approved' })
  await addMember({ orgId, userId: leader.id, orgRole: 'leader', status: 'approved' })
  otherOrgId = await createOrg({ createdBy: leader.id, status: 'approved' })
})

afterAll(async () => {
  await cleanupOrg(orgId)
  await cleanupOrg(otherOrgId)
  if (adminOrg) await cleanupOrg(adminOrg)
  await deleteTestUser(leader.id)
  await deleteTestUser(joiner.id)
  await deleteTestUser(admin.id)
})

describe('membership handshake', () => {
  // Every other org in this suite is built with the service role, which bypasses
  // RLS outright — so this is the only place the organizations INSERT policy runs
  // at all. Without this test, decision 11 would be enforced by nothing any test
  // can see.
  it('only an admin can create an organization', async () => {
    const attempt = (u: TestUser) =>
      createUserClient(u.token)
        .from('organizations')
        .insert({
          name: `Admin Gate ${crypto.randomUUID().slice(0, 8)}`,
          created_by: u.id,
          status: 'approved',
          trust_level: 'trusted',
        })
        .select('id')
        .single()

    // A contributor who HAS accepted org_leader_terms — precisely the account the
    // superseded policy would have admitted. The agreement is no longer a key.
    const { error: refused } = await attempt(leader)
    expect(refused?.code).toBe('42501')

    // Same statement, admin JWT, opposite outcome — so the block above is
    // attributable to is_admin() and not to some other conjunct.
    const { data, error: allowed } = await attempt(admin)
    expect(allowed).toBeNull()
    adminOrg = data!.id as string
  })

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
})
