import { adminClient } from './auth.js'

/** An invite row in whatever state the test needs, bypassing the handshake. */
export async function createInvite(opts: {
  tutorialId: string
  invitedProfileId: string
  invitedBy: string
  status?: 'pending' | 'accepted' | 'declined'
}): Promise<string> {
  const { data, error } = await adminClient()
    .from('tutorial_collaborator_invites')
    .insert({
      tutorial_id: opts.tutorialId,
      invited_profile_id: opts.invitedProfileId,
      invited_by: opts.invitedBy,
      status: opts.status ?? 'pending',
      responded_at: opts.status && opts.status !== 'pending' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`createInvite failed: ${error.message}`)
  return data.id as string
}

export async function addCollaborator(tutorialId: string, profileId: string): Promise<void> {
  const { error } = await adminClient()
    .from('tutorial_contributors')
    .insert({ tutorial_id: tutorialId, profile_id: profileId, role: 'collaborator' })
  if (error) throw new Error(`addCollaborator failed: ${error.message}`)
}
