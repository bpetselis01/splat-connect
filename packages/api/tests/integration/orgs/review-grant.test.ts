import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createOrg, addLeader, acceptTerms, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

let author: TestUser
let leader: TestUser
let untermed: TestUser
let orgId: string
let suspendedOrgId: string
let untermedOrgId: string
let accepted: string
let pendingOnly: string
let unbacked: string
let suspendedBacked: string
let untermedBacked: string

/** An RLS-blocked UPDATE matches zero rows rather than erroring. The error
 *  assertion keeps a trigger-raised 42501 from masquerading as an RLS block —
 *  PostgREST nulls `data` whenever `error` is set. */
async function tryApprove(token: string, tutorialId: string): Promise<number> {
  const { data, error } = await createUserClient(token)
    .from('tutorials')
    .update({ status: 'approved' })
    .eq('id', tutorialId)
    .select('id')
  expect(error).toBeNull()
  return (data ?? []).length
}

beforeAll(async () => {
  author = await createTestUser('contributor')
  leader = await createTestUser('contributor')
  untermed = await createTestUser('contributor')
  await acceptTerms(leader.id, 'org_leader_terms')

  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  suspendedOrgId = await createOrg({ createdBy: leader.id, status: 'suspended' })
  await addLeader(suspendedOrgId, leader.id)
  untermedOrgId = await createOrg({ createdBy: untermed.id })
  await addLeader(untermedOrgId, untermed.id)

  accepted = await createProject({ authorId: author.id })
  await requestBacking({ tutorialId: accepted, orgId, status: 'accepted', respondedBy: leader.id })

  pendingOnly = await createProject({ authorId: author.id })
  await requestBacking({ tutorialId: pendingOnly, orgId })

  unbacked = await createProject({ authorId: author.id })

  suspendedBacked = await createProject({ authorId: author.id })
  await requestBacking({ tutorialId: suspendedBacked, orgId: suspendedOrgId, status: 'accepted' })

  untermedBacked = await createProject({ authorId: author.id })
  await requestBacking({ tutorialId: untermedBacked, orgId: untermedOrgId, status: 'accepted' })
})

afterAll(async () => {
  await cleanupOrg(orgId, [accepted, pendingOnly, unbacked])
  await cleanupOrg(suspendedOrgId, [suspendedBacked])
  await cleanupOrg(untermedOrgId, [untermedBacked])
  await deleteTestUser(author.id)
  await deleteTestUser(leader.id)
  await deleteTestUser(untermed.id)
})

describe('the leader review grant', () => {
  it('approves a project their org accepted', async () => {
    expect(await tryApprove(leader.token, accepted)).toBe(1)
    await adminClient().from('tutorials').update({ status: 'pending' }).eq('id', accepted)
  })

  it('cannot approve a project their org has only been asked about', async () => {
    // Accepting is what confers authority — being asked is not.
    expect(await tryApprove(leader.token, pendingOnly)).toBe(0)
  })

  it('cannot approve a project with no backing at all', async () => {
    expect(await tryApprove(leader.token, unbacked)).toBe(0)
  })

  it('cannot approve while their org is suspended', async () => {
    expect(await tryApprove(leader.token, suspendedBacked)).toBe(0)
  })

  it('cannot approve without accepted leader terms', async () => {
    // has_accepted sits in the policy's USING clause, so the block is a silent
    // zero-row match. Accepting is the only thing that changes between the two
    // attempts, so the first is attributable to has_accepted and nothing else —
    // and it only asserts anything because the gate lives in the policy.
    expect(await tryApprove(untermed.token, untermedBacked)).toBe(0)
    await acceptTerms(untermed.id, 'org_leader_terms')
    expect(await tryApprove(untermed.token, untermedBacked)).toBe(1)
    await adminClient().from('tutorials').update({ status: 'pending' }).eq('id', untermedBacked)
  })

  it('a leader of an unrelated org cannot approve it', async () => {
    // `untermed` accepted the terms in the previous test, so this isolates org
    // scoping rather than passing for the wrong reason.
    expect(await tryApprove(untermed.token, accepted)).toBe(0)
  })

  it('a plain contributor cannot approve their own project', async () => {
    // Different failure shape: "Contributors can update own tutorials" matches
    // this row and its WITH CHECK forbids 'approved', so this is a real 42501
    // rather than a silent exclusion.
    const { error } = await createUserClient(author.token)
      .from('tutorials')
      .update({ status: 'approved' })
      .eq('id', accepted)
      .select('id')
    expect(error?.code).toBe('42501')
  })

  it('a leader can approve their own project when their org backs it', async () => {
    // Decision 14: no self-review block. Leadership is granted by the admin to
    // someone already trusted, and a single-leader org could otherwise never
    // publish its leader's own work.
    const own = await createProject({ authorId: leader.id })
    await requestBacking({ tutorialId: own, orgId, status: 'accepted', respondedBy: leader.id })
    expect(await tryApprove(leader.token, own)).toBe(1)
    await adminClient().from('tutorials').delete().eq('id', own)
  })
})
