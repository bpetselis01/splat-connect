// packages/api/src/routes/collaborators.ts
/**
 * Collaborator invite and removal (Protected), mounted at /api/tutorials.
 *
 * Endpoints:
 * - POST   /api/tutorials/:id/collaborators/invite       — primary contributor, { email }
 * - DELETE /api/tutorials/:id/collaborators/:profileId   — primary removes, or a
 *                                                           collaborator removes themself
 *
 * The invitee's own view — listing and answering invites — lives in
 * routes/collaborator-invites.ts, mounted at /api/collaborators, because
 * those endpoints are addressed to a person, not scoped to a tutorial.
 *
 * Related files:
 * - supabase/migrations/012_tutorial_collaborators.sql: every policy behind this file
 * - routes/tutorial-orgs.ts: the pattern this follows
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import { createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const collaborators = new Hono<{ Variables: AuthVariables }>()

collaborators.post('/:id/collaborators/invite', async (c) => {
  const body = await c.req.json<{ email?: string }>()
  const email = body.email?.trim()
  if (!email) return c.json({ error: 'email is required' }, 400)

  // Authorize before the admin-client email lookup below, not after: that
  // lookup bypasses RLS by design (it has to, to resolve an arbitrary
  // email), so it's an email-enumeration side channel for anyone who can
  // reach this route at all unless a non-primary is refused first.
  const supabase = createUserClient(c.get('token'))
  const { data: isPrimary } = await supabase
    .from('tutorial_contributors')
    .select('profile_id')
    .eq('tutorial_id', c.req.param('id'))
    .eq('profile_id', c.get('userId'))
    .eq('role', 'primary')
    .maybeSingle()
  if (!isPrimary) return c.json({ error: 'only the primary contributor can invite collaborators' }, 403)

  const admin = createAdminClient()
  const { data: invitee } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  if (!invitee) return c.json({ error: 'No account found with that email' }, 404)
  if (invitee.id === c.get('userId')) return c.json({ error: 'You cannot invite yourself' }, 400)

  const { data, error } = await supabase
    .from('tutorial_collaborator_invites')
    .upsert(
      {
        tutorial_id: c.req.param('id'),
        invited_profile_id: invitee.id,
        invited_by: c.get('userId'),
        status: 'pending',
        responded_at: null,
      },
      { onConflict: 'tutorial_id,invited_profile_id' }
    )
    .select()
    .single()
  if (error) {
    if (error.code === '42501') {
      return c.json({ error: 'only the primary contributor can invite collaborators' }, 403)
    }
    return c.json({ error: error.message }, 500)
  }

  const { data: inviter } = await admin.from('profiles').select('name').eq('id', c.get('userId')).single()
  // Denormalized like actor_name: the invitee isn't a contributor yet, so
  // they have no RLS read access to join the tutorial's title live.
  const { data: tutorial } = await admin.from('tutorials').select('title').eq('id', c.req.param('id')).single()
  const { error: notifyError } = await admin.from('notifications').insert({
    recipient_id: invitee.id,
    type: 'collaborator_invited',
    tutorial_id: c.req.param('id'),
    tutorial_title: tutorial?.title ?? 'a tutorial',
    actor_name: inviter?.name ?? 'A contributor',
  })
  // A failed notification shouldn't fail the invite itself, but a silent
  // failure here is invisible without a log line.
  if (notifyError) console.error('[collaborators.invite] notification insert failed:', notifyError.message)

  return c.json(data, 201)
})

collaborators.delete('/:id/collaborators/:profileId', async (c) => {
  const tutorialId = c.req.param('id')
  const targetId = c.req.param('profileId')
  const actingId = c.get('userId')
  const selfLeave = targetId === actingId

  const supabase = createUserClient(c.get('token'))

  // Look up who to notify via the caller's own JWT before the delete below
  // runs — once a self-leaving collaborator's row is gone, RLS's "view your
  // team" policy no longer admits them, so this read has to happen first.
  let primaryId: string | null = null
  if (selfLeave) {
    const { data: primaryRow } = await supabase
      .from('tutorial_contributors')
      .select('profile_id')
      .eq('tutorial_id', tutorialId)
      .eq('role', 'primary')
      .single()
    primaryId = primaryRow?.profile_id ?? null
  }

  const { data, error } = await supabase
    .from('tutorial_contributors')
    .delete()
    .eq('tutorial_id', tutorialId)
    .eq('profile_id', targetId)
    .select('profile_id')
  if (error) return c.json({ error: error.message }, 500)
  if (!data.length) return c.json({ error: 'cannot remove this collaborator' }, 403)

  const admin = createAdminClient()
  const { data: actor } = await admin.from('profiles').select('name').eq('id', actingId).single()
  // A just-removed (or just-left) collaborator loses their tutorial_contributors
  // row in the same request, so they'd have no RLS read access to the
  // tutorial by the time this notification is read — denormalize the title.
  const { data: tutorial } = await admin.from('tutorials').select('title').eq('id', tutorialId).single()

  if (selfLeave) {
    // Notify the primary contributor that someone left.
    if (primaryId) {
      const { error: notifyError } = await admin.from('notifications').insert({
        recipient_id: primaryId,
        type: 'collaborator_left',
        tutorial_id: tutorialId,
        tutorial_title: tutorial?.title ?? 'a tutorial',
        actor_name: actor?.name ?? 'A collaborator',
      })
      if (notifyError) console.error('[collaborators.leave] notification insert failed:', notifyError.message)
    }
  } else {
    // Notify the removed collaborator.
    const { error: notifyError } = await admin.from('notifications').insert({
      recipient_id: targetId,
      type: 'collaborator_removed',
      tutorial_id: tutorialId,
      tutorial_title: tutorial?.title ?? 'a tutorial',
      actor_name: actor?.name ?? 'The primary contributor',
    })
    if (notifyError) console.error('[collaborators.remove] notification insert failed:', notifyError.message)
  }

  return c.body(null, 204)
})

export default collaborators
