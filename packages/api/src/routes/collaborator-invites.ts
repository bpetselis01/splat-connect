// packages/api/src/routes/collaborator-invites.ts
/**
 * The invitee's own view of collaborator invites (Protected), mounted at
 * /api/collaborators. Distinct from routes/collaborators.ts (tutorial-scoped
 * invite/remove) because these are addressed to a person, not a project.
 *
 * Endpoints:
 * - GET  /api/collaborators/me/invites            — my pending invites
 * - POST /api/collaborators/invites/:id/accept    — accept, then claim the seat
 * - POST /api/collaborators/invites/:id/decline   — decline
 */
import { Hono, type Context } from 'hono'
import { createUserClient, createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const collaboratorInvites = new Hono<{ Variables: AuthVariables }>()

collaboratorInvites.get('/me/invites', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorial_collaborator_invites')
    .select('*, tutorials(title)')
    .eq('invited_profile_id', c.get('userId'))
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

async function answer(c: Context<{ Variables: AuthVariables }>, status: 'accepted' | 'declined') {
  const inviteId = c.req.param('inviteId')
  const supabase = createUserClient(c.get('token'))

  const { data, error } = await supabase
    .from('tutorial_collaborator_invites')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', inviteId)
    .select('tutorial_id, invited_profile_id')
    .single()
  if (error) {
    if (error.code === 'PGRST116') return c.json({ error: 'not your invite to answer' }, 403)
    return c.json({ error: error.message }, 500)
  }

  const admin = createAdminClient()
  const { data: invitee } = await admin.from('profiles').select('name').eq('id', data.invited_profile_id).single()
  const { data: tutorial } = await admin.from('tutorials').select('title').eq('id', data.tutorial_id).single()

  if (status === 'accepted') {
    // Retry-safe: if the tutorial_contributors insert fails midway on a
    // client retry, a duplicate-key error here (23505) is already a seat,
    // matching the existing pattern in routes/contributors.ts.
    const { error: claimError } = await supabase
      .from('tutorial_contributors')
      .insert({ tutorial_id: data.tutorial_id, profile_id: data.invited_profile_id, role: 'collaborator' })
    if (claimError && claimError.code !== '23505') {
      return c.json({ error: claimError.message }, 500)
    }
  }

  // Who to notify. Read with the admin client on both paths: a decline never
  // adds a tutorial_contributors row, so on that path the invitee has no team
  // visibility to read this under their own JWT.
  const { data: primaryRow } = await admin
    .from('tutorial_contributors')
    .select('profile_id')
    .eq('tutorial_id', data.tutorial_id)
    .eq('role', 'primary')
    .single()

  if (primaryRow) {
    const { error: notifyError } = await admin.from('notifications').insert({
      recipient_id: primaryRow.profile_id,
      type: status === 'accepted' ? 'collaborator_accepted' : 'collaborator_declined',
      tutorial_id: data.tutorial_id,
      tutorial_title: tutorial?.title ?? 'a tutorial',
      actor_name: invitee?.name ?? 'A contributor',
    })
    if (notifyError) console.error('[collaborator-invites.answer] notification insert failed:', notifyError.message)
  }

  return c.json({ status })
}

collaboratorInvites.post('/invites/:inviteId/accept', (c) => answer(c, 'accepted'))
collaboratorInvites.post('/invites/:inviteId/decline', (c) => answer(c, 'declined'))

export default collaboratorInvites
