import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createOrg, addLeader, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

let author: TestUser
let leader: TestUser
let otherLeader: TestUser
let orgId: string
let otherOrgId: string
let draftId: string
let publishedId: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  leader = await createTestUser('contributor')
  otherLeader = await createTestUser('contributor')

  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  otherOrgId = await createOrg({ createdBy: otherLeader.id })
  await addLeader(otherOrgId, otherLeader.id)

  draftId = await createProject({ authorId: author.id, status: 'draft' })
  publishedId = await createProject({ authorId: author.id, status: 'approved' })
})

afterAll(async () => {
  await cleanupOrg(orgId, [draftId, publishedId])
  await cleanupOrg(otherOrgId)
  await deleteTestUser(author.id)
  await deleteTestUser(leader.id)
  await deleteTestUser(otherLeader.id)
})

describe('requesting backing', () => {
  it('an author can ask an org to back their draft', async () => {
    const { data, error } = await createUserClient(author.token)
      .from('tutorial_orgs')
      .insert({ tutorial_id: draftId, org_id: orgId })
      .select('id, status')
      .single()
    expect(error).toBeNull()
    expect(data?.status).toBe('pending')
    await adminClient().from('tutorial_orgs').delete().eq('id', data!.id)
  })

  it("a stranger cannot ask on behalf of someone else's project", async () => {
    const { error } = await createUserClient(otherLeader.token)
      .from('tutorial_orgs')
      .insert({ tutorial_id: draftId, org_id: otherOrgId })
    expect(error?.code).toBe('42501')
  })

  it('an author cannot add backing to a published tutorial', async () => {
    const { error } = await createUserClient(author.token)
      .from('tutorial_orgs')
      .insert({ tutorial_id: publishedId, org_id: orgId })
    expect(error?.code).toBe('42501')
  })

  it('an author cannot insert a request already accepted', async () => {
    // THE test. If this passes, an author can hand any organisation's leaders
    // authority over work those leaders never agreed to take — which is the one
    // thing the whole handshake exists to prevent.
    const { error } = await createUserClient(author.token)
      .from('tutorial_orgs')
      .insert({ tutorial_id: draftId, org_id: orgId, status: 'accepted' })
    expect(error?.code).toBe('42501')
  })
})

describe('answering a request', () => {
  it('a leader of the asked org can accept it', async () => {
    const rowId = await requestBacking({ tutorialId: draftId, orgId })
    const { data, error } = await createUserClient(leader.token)
      .from('tutorial_orgs')
      .update({ status: 'accepted', responded_by: leader.id, responded_at: new Date().toISOString() })
      .eq('id', rowId)
      .select('status')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].status).toBe('accepted')
    await adminClient().from('tutorial_orgs').delete().eq('id', rowId)
  })

  it('a leader of a different org cannot answer it', async () => {
    const rowId = await requestBacking({ tutorialId: draftId, orgId })
    const { data, error } = await createUserClient(otherLeader.token)
      .from('tutorial_orgs')
      .update({ status: 'accepted' })
      .eq('id', rowId)
      .select('id')
    // USING excludes the row entirely, so this is a silent zero-row match.
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
    await adminClient().from('tutorial_orgs').delete().eq('id', rowId)
  })

  it('the author cannot answer their own request', async () => {
    // No UPDATE policy admits a contributor at all — the author's only powers
    // over this row are creating it and deleting it.
    const rowId = await requestBacking({ tutorialId: draftId, orgId })
    const { data, error } = await createUserClient(author.token)
      .from('tutorial_orgs')
      .update({ status: 'accepted' })
      .eq('id', rowId)
      .select('id')
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)

    const { data: check } = await adminClient()
      .from('tutorial_orgs').select('status').eq('id', rowId).single()
    expect(check?.status).toBe('pending')
    await adminClient().from('tutorial_orgs').delete().eq('id', rowId)
  })

  it('a leader cannot set a status outside accepted or declined', async () => {
    const rowId = await requestBacking({ tutorialId: draftId, orgId, status: 'accepted' })
    const { error } = await createUserClient(leader.token)
      .from('tutorial_orgs')
      .update({ status: 'pending' })
      .eq('id', rowId)
      .select('id')
    expect(error?.code).toBe('42501')
    await adminClient().from('tutorial_orgs').delete().eq('id', rowId)
  })
})
