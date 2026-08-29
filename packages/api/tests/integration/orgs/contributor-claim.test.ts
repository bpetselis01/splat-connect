import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/client.js'
import { createOrg, addLeader, cleanupOrg } from '../../helpers/orgs.js'

let victim: TestUser
let attacker: TestUser
let leader: TestUser
let orgId: string
/** The victim's private, unsubmitted draft. Created and cleaned up here rather
 *  than through the org fixture helper because the whole point is that it belongs
 *  to nobody's org. */
const victimDraft = crypto.randomUUID()
const unclaimed = crypto.randomUUID()

beforeAll(async () => {
  victim = await createTestUser('contributor')
  attacker = await createTestUser('contributor')
  leader = await createTestUser('contributor')

  // A real, active org the attacker can ask to back things. The leader is NOT the
  // attacker, so if the attacker ever got a claim through, a second party would
  // publish it for them.
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)

  const admin = adminClient()
  await admin.from('tutorials').insert({
    id: victimDraft, title: "Victim's private draft", difficulty: 'easy', status: 'draft',
  })
  await admin.from('tutorial_contributors').insert({ tutorial_id: victimDraft, profile_id: victim.id })
})

afterAll(async () => {
  await cleanupOrg(orgId, [victimDraft, unclaimed])
  await deleteTestUser(victim.id)
  await deleteTestUser(attacker.id)
  await deleteTestUser(leader.id)
})

describe('contributor claim scope', () => {
  it("a stranger's draft cannot be self-attached, repinned, and published", async () => {
    const attackerDb = createUserClient(attacker.token)

    // Step 1 — the whole chain hangs off this. Before 008 the INSERT policy
    // constrained only profile_id, so this succeeded and made the attacker a
    // "contributor" on a draft they had never seen.
    const { error: claim } = await attackerDb
      .from('tutorial_contributors')
      .insert({ tutorial_id: victimDraft, profile_id: attacker.id })
    expect(claim?.code).toBe('42501')

    // Steps 2 and 3 are walked anyway: a block at step 1 is only worth having if
    // the rest of the chain really is dead. Step 2 is a WITH CHECK violation —
    // is_tutorial_contributor is false, so no INSERT policy on tutorial_orgs
    // admits the attacker. Step 3 is a silent zero-row match: the leader's org was
    // never asked, so can_review_tutorial is false.
    const { error: repin } = await attackerDb
      .from('tutorial_orgs')
      .insert({ tutorial_id: victimDraft, org_id: orgId })
    expect(repin?.code).toBe('42501')

    const publish = await createUserClient(leader.token)
      .from('tutorials')
      .update({ status: 'approved' })
      .eq('id', victimDraft)
      .select('id')
    expect(publish.error).toBeNull()
    expect(publish.data ?? []).toHaveLength(0)

    // Ground truth: the draft is untouched and still nobody's org's business.
    const { data: final } = await adminClient()
      .from('tutorials').select('status').eq('id', victimDraft).single()
    expect(final?.status).toBe('draft')

    const { data: backing } = await adminClient()
      .from('tutorial_orgs').select('id').eq('tutorial_id', victimDraft)
    expect(backing ?? []).toHaveLength(0)
  })

  it('the legitimate author path still works, and re-linking is still retry-safe', async () => {
    // Mirrors production: POST /api/tutorials inserts the row through the admin
    // client with no contributor link, then the author links themselves under
    // their own JWT.
    const { error: created } = await adminClient()
      .from('tutorials')
      .insert({ id: unclaimed, title: 'Freshly authored', difficulty: 'easy', status: 'draft' })
    expect(created).toBeNull()

    const authorDb = createUserClient(victim.token)
    const { error: link } = await authorDb
      .from('tutorial_contributors')
      .insert({ tutorial_id: unclaimed, profile_id: victim.id })
    expect(link).toBeNull()

    // A resubmit re-calls the same endpoint. It must still fail as a duplicate
    // key (23505), which routes/contributors.ts swallows — NOT as an RLS
    // violation (42501), which it would surface as a 500.
    const { error: again } = await authorDb
      .from('tutorial_contributors')
      .insert({ tutorial_id: unclaimed, profile_id: victim.id })
    expect(again?.code).toBe('23505')

    // And the tutorial now has an owner, so nobody else can join it.
    const { error: poach } = await createUserClient(attacker.token)
      .from('tutorial_contributors')
      .insert({ tutorial_id: unclaimed, profile_id: attacker.id })
    expect(poach?.code).toBe('42501')
  })

  it('an author cannot rewrite their own review provenance', async () => {
    const authorDb = createUserClient(victim.token)

    const forged = await authorDb
      .from('tutorials')
      .update({ reviewed_by: victim.id, reviewed_for_org_id: orgId })
      .eq('id', unclaimed)
      .select('id')
    expect(forged.error?.code).toBe('42501')

    // An ordinary edit to the same row is untouched: the trigger gates on change,
    // not on every write.
    const ordinary = await authorDb
      .from('tutorials')
      .update({ title: 'Freshly authored, renamed' })
      .eq('id', unclaimed)
      .select('id')
    expect(ordinary.error).toBeNull()
    expect(ordinary.data).toHaveLength(1)
  })
})
