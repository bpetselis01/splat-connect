import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/client.js'
import { createProject, cleanupOrg } from '../../helpers/orgs.js'
import { createInvite, addCollaborator } from '../../helpers/collaborators.js'

let primary: TestUser
let invitee: TestUser
let stranger: TestUser
let tutorialId: string

beforeAll(async () => {
  primary = await createTestUser('contributor')
  invitee = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  tutorialId = await createProject({ authorId: primary.id, status: 'draft' })
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(primary.id)
  await deleteTestUser(invitee.id)
  await deleteTestUser(stranger.id)
})

describe('inviting a collaborator', () => {
  it('the primary contributor can invite someone', async () => {
    const { data, error } = await createUserClient(primary.token)
      .from('tutorial_collaborator_invites')
      .insert({ tutorial_id: tutorialId, invited_profile_id: invitee.id, invited_by: primary.id })
      .select('status')
      .single()
    expect(error).toBeNull()
    expect(data?.status).toBe('pending')
    await adminClient().from('tutorial_collaborator_invites').delete().eq('tutorial_id', tutorialId)
  })

  it('a stranger cannot invite on behalf of someone else\'s project', async () => {
    const { error } = await createUserClient(stranger.token)
      .from('tutorial_collaborator_invites')
      .insert({ tutorial_id: tutorialId, invited_profile_id: invitee.id, invited_by: stranger.id })
    expect(error?.code).toBe('42501')
  })

  it('a collaborator cannot invite another collaborator', async () => {
    await addCollaborator(tutorialId, invitee.id)
    const { error } = await createUserClient(invitee.token)
      .from('tutorial_collaborator_invites')
      .insert({ tutorial_id: tutorialId, invited_profile_id: stranger.id, invited_by: invitee.id })
    expect(error?.code).toBe('42501')
    await adminClient().from('tutorial_contributors').delete().eq('tutorial_id', tutorialId).eq('profile_id', invitee.id)
  })
})

describe('accepting an invite', () => {
  it('the invitee can accept, and can then claim the tutorial_contributors seat', async () => {
    const inviteId = await createInvite({ tutorialId, invitedProfileId: invitee.id, invitedBy: primary.id })
    const { error: updateError } = await createUserClient(invitee.token)
      .from('tutorial_collaborator_invites')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', inviteId)
    expect(updateError).toBeNull()

    const { error: claimError } = await createUserClient(invitee.token)
      .from('tutorial_contributors')
      .insert({ tutorial_id: tutorialId, profile_id: invitee.id, role: 'collaborator' })
    expect(claimError).toBeNull()

    await adminClient().from('tutorial_contributors').delete().eq('tutorial_id', tutorialId).eq('profile_id', invitee.id)
    await adminClient().from('tutorial_collaborator_invites').delete().eq('id', inviteId)
  })

  it('a stranger with no invite still cannot self-claim a tutorial that already has a contributor', async () => {
    // The 008 regression case, re-asserted with the new policy arm in place.
    const { error } = await createUserClient(stranger.token)
      .from('tutorial_contributors')
      .insert({ tutorial_id: tutorialId, profile_id: stranger.id, role: 'collaborator' })
    expect(error?.code).toBe('42501')
  })

  it('the invitee cannot write a status other than accepted or declined', async () => {
    const inviteId = await createInvite({ tutorialId, invitedProfileId: invitee.id, invitedBy: primary.id })
    // The row is visible for update (015_invitee_answer_visibility.sql), so
    // an invalid status is a WITH CHECK violation — a 42501, not a silent
    // zero-row match.
    const { error } = await createUserClient(invitee.token)
      .from('tutorial_collaborator_invites')
      .update({ status: 'pending' })
      .eq('id', inviteId)
      .select('id')
    expect(error?.code).toBe('42501')
    await adminClient().from('tutorial_collaborator_invites').delete().eq('id', inviteId)
  })
})

describe('re-inviting after a decline', () => {
  it('the primary can reset a declined invite back to pending', async () => {
    const inviteId = await createInvite({ tutorialId, invitedProfileId: invitee.id, invitedBy: primary.id, status: 'declined' })
    const { data, error } = await createUserClient(primary.token)
      .from('tutorial_collaborator_invites')
      .update({ status: 'pending', responded_at: null })
      .eq('id', inviteId)
      .select('status')
    expect(error).toBeNull()
    expect(data?.[0]?.status).toBe('pending')
    await adminClient().from('tutorial_collaborator_invites').delete().eq('id', inviteId)
  })
})

describe('removing a collaborator', () => {
  it('the primary can remove a collaborator', async () => {
    await addCollaborator(tutorialId, invitee.id)
    const { data, error } = await createUserClient(primary.token)
      .from('tutorial_contributors')
      .delete()
      .eq('tutorial_id', tutorialId)
      .eq('profile_id', invitee.id)
      .select('profile_id')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('a collaborator can remove themself', async () => {
    await addCollaborator(tutorialId, invitee.id)
    const { data, error } = await createUserClient(invitee.token)
      .from('tutorial_contributors')
      .delete()
      .eq('tutorial_id', tutorialId)
      .eq('profile_id', invitee.id)
      .select('profile_id')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('a collaborator cannot remove the primary contributor', async () => {
    await addCollaborator(tutorialId, invitee.id)
    const { data, error } = await createUserClient(invitee.token)
      .from('tutorial_contributors')
      .delete()
      .eq('tutorial_id', tutorialId)
      .eq('profile_id', primary.id)
      .select('profile_id')
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
    await adminClient().from('tutorial_contributors').delete().eq('tutorial_id', tutorialId).eq('profile_id', invitee.id)
  })

  it('a removed collaborator cannot re-claim the seat with their now-declined invite', async () => {
    const inviteId = await createInvite({ tutorialId, invitedProfileId: invitee.id, invitedBy: primary.id, status: 'accepted' })
    await addCollaborator(tutorialId, invitee.id)

    const { error: removeError } = await createUserClient(primary.token)
      .from('tutorial_contributors')
      .delete()
      .eq('tutorial_id', tutorialId)
      .eq('profile_id', invitee.id)
    expect(removeError).toBeNull()

    const { data: inviteAfter } = await adminClient()
      .from('tutorial_collaborator_invites')
      .select('status')
      .eq('id', inviteId)
      .single()
    expect(inviteAfter?.status).toBe('declined')

    const { error: reclaimError } = await createUserClient(invitee.token)
      .from('tutorial_contributors')
      .insert({ tutorial_id: tutorialId, profile_id: invitee.id, role: 'collaborator' })
    expect(reclaimError?.code).toBe('42501')

    await adminClient().from('tutorial_collaborator_invites').delete().eq('id', inviteId)
  })
})

describe('teammate profile visibility', () => {
  it('a collaborator can read the primary contributor\'s profile', async () => {
    await addCollaborator(tutorialId, invitee.id)
    const { data, error } = await createUserClient(invitee.token)
      .from('profiles')
      .select('id')
      .eq('id', primary.id)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    await adminClient().from('tutorial_contributors').delete().eq('tutorial_id', tutorialId).eq('profile_id', invitee.id)
  })

  it('a stranger on a different tutorial cannot read the primary\'s profile', async () => {
    const { data, error } = await createUserClient(stranger.token)
      .from('profiles')
      .select('id')
      .eq('id', primary.id)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })
})

describe('invite identity is frozen after creation', () => {
  it('the invitee cannot repoint their own invite at a different tutorial', async () => {
    const otherTutorialId = await createProject({ authorId: primary.id, status: 'draft' })
    const inviteId = await createInvite({ tutorialId, invitedProfileId: invitee.id, invitedBy: primary.id })

    const { error } = await createUserClient(invitee.token)
      .from('tutorial_collaborator_invites')
      .update({ tutorial_id: otherTutorialId, status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', inviteId)
    expect(error?.code).toBe('42501')

    const { data: unchanged } = await adminClient()
      .from('tutorial_collaborator_invites')
      .select('tutorial_id, status')
      .eq('id', inviteId)
      .single()
    expect(unchanged?.tutorial_id).toBe(tutorialId)
    expect(unchanged?.status).toBe('pending')

    await adminClient().from('tutorials').delete().eq('id', otherTutorialId)
    await adminClient().from('tutorial_collaborator_invites').delete().eq('id', inviteId)
  })
})
