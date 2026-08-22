import { Hono } from 'hono'
import { CONTACT_PREFS, type ContactPref } from '@splat-connect/types'
import { createUserClient } from '../supabase/user-client.js'
import { createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const toyIdeas = new Hono<{ Variables: AuthVariables }>()

const RLS_VIOLATION = '42501'

type Client = ReturnType<typeof createUserClient>

const NARRATIVE_FIELDS = [
  'title', 'summary', 'description', 'intended_use', 'primary_user',
] as const

/**
 * Every narrative field is required and must survive trimming. A half-filled
 * idea reaches a reviewer with nothing to judge, so this rejects rather than
 * storing blanks — the same reasoning as readPickupAddress in toy-transactions.
 */
export function readIdeaBody(body: unknown): Record<string, unknown> | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  const source = body as Record<string, unknown>
  const out: Record<string, unknown> = {}

  for (const field of NARRATIVE_FIELDS) {
    const value = source[field]
    if (typeof value !== 'string' || !value.trim()) return null
    out[field] = value.trim()
  }

  const prefs = source.contact_prefs ?? []
  if (!Array.isArray(prefs)) return null
  if (!prefs.every((p) => CONTACT_PREFS.includes(p as ContactPref))) return null
  out.contact_prefs = prefs

  return out
}

toyIdeas.post('/', async (c) => {
  const fields = readIdeaBody(await c.req.json().catch(() => null))
  if (!fields) return c.json({ error: 'All fields are required' }, 400)

  // author_id comes from the verified token, never the body.
  const { data, error } = await createUserClient(c.get('token'))
    .from('toy_ideas')
    .insert({ ...fields, author_id: c.get('userId'), status: 'pending' })
    .select('*')
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

toyIdeas.get('/mine', async (c) => {
  const { data, error } = await createUserClient(c.get('token'))
    .from('toy_ideas')
    .select('*')
    .eq('author_id', c.get('userId'))
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})

/**
 * Challenges the caller has joined as a participant, not authored. The
 * dashboard's "Challenges you joined" section needs this alongside /mine, and
 * there was previously nothing to serve it — the maker half of collaboration
 * had no way back to a thread they had already joined.
 *
 * Queried through toy_idea_participants rather than toy_ideas directly, so it
 * naturally returns only rows this profile actually joined. The user client
 * (not admin) means 037/038's own RLS decides what comes back — a participant
 * row only ever exists on a 'challenge' or 'graduated' idea (038's insert
 * policy), and both statuses are public reads, so no extra status filter is
 * needed here.
 */
toyIdeas.get('/joined', async (c) => {
  const { data, error } = await createUserClient(c.get('token'))
    .from('toy_idea_participants')
    // Explicit columns, never (*): review_note is the idea's author's private
    // rejection reasoning (037), not something every participant should read
    // off a challenge they merely joined. A participant is never the author,
    // so unlike GET /api/admin/ideas or the author's own /mine, there is no
    // reader here who is ever entitled to this column.
    .select(
      'toy_ideas!inner(id, author_id, title, summary, description, intended_use, primary_user, contact_prefs, status, tutorial_id, created_at, updated_at)'
    )
    .eq('profile_id', c.get('userId'))
    // A removed row must not keep showing the caller a challenge they were
    // excluded from -- 042's own select policy already hides it from them,
    // but this uses the user client, so belt-and-braces against the day this
    // route is ever read through an admin client instead.
    .is('removed_at', null)
    .order('created_at', { foreignTable: 'toy_ideas', ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json((data ?? []).map((row: any) => row.toy_ideas))
})

/**
 * Join, leave and removal each write one of these. It is what makes the
 * participant history readable in order alongside the conversation, instead of
 * living only in dismissible notifications.
 *
 * Written with the ADMIN client, not the caller's. A kind='system' row is
 * platform-authored — a record that an event happened — not user speech.
 *
 * This is also load-bearing for self-leave: 038's insert policy requires the
 * sender to be the author or a current participant, so once someone's
 * participant row is deleted they can no longer write "X left this challenge".
 * Writing it as the user silently produced no message — the error was never
 * checked — and the author lost exactly the record they need. Using the admin
 * client makes the ordering of delete-vs-message irrelevant.
 */
export async function systemMessage(ideaId: string, actorId: string, body: string) {
  const { error } = await createAdminClient()
    .from('toy_idea_messages')
    .insert({ idea_id: ideaId, sender_id: actorId, kind: 'system', body })
  if (error) console.error('system message failed', { ideaId, error: error.message })
}

async function loadIdea(client: Client, id: string) {
  return client.from('toy_ideas').select('author_id, title, status').eq('id', id).single()
}

async function actorName(userId: string): Promise<string> {
  const { data } = await createAdminClient()
    .from('profiles').select('name').eq('id', userId).single()
  return (data?.name as string) ?? 'Someone'
}

toyIdeas.post('/:id/join', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')
  const client = createUserClient(c.get('token'))

  const { data: idea, error: loadError } = await loadIdea(client, id)
  if (loadError || !idea) return c.json({ error: 'Challenge not found' }, 404)

  const { error } = await client
    .from('toy_idea_participants')
    .insert({ idea_id: id, profile_id: userId })
    .select('idea_id')
    .single()

  // The policy allows a join only onto a published challenge you did not author.
  if (error?.code === RLS_VIOLATION) return c.json({ error: 'You cannot join this challenge' }, 403)
  if (error) return c.json({ error: error.message }, 500)

  const name = await actorName(userId)
  await systemMessage(id, userId, `${name} joined this challenge`)
  await createAdminClient().from('notifications').insert({
    recipient_id: idea.author_id, type: 'challenge_joined', idea_id: id, actor_name: name,
  })

  return c.json({ joined: true }, 201)
})

toyIdeas.delete('/:id/participants/:profileId', async (c) => {
  const id = c.req.param('id')
  const target = c.req.param('profileId')
  const userId = c.get('userId')
  const client = createUserClient(c.get('token'))

  const { data: idea, error: loadError } = await loadIdea(client, id)
  if (loadError || !idea) return c.json({ error: 'Challenge not found' }, 404)

  const leaving = target === userId
  if (!leaving && idea.author_id !== userId && c.get('role') !== 'admin') {
    return c.json({ error: 'Only the author may remove a participant' }, 403)
  }

  // .select() so we learn whether a row actually went. A DELETE matching nothing
  // is a successful no-op in Postgres, and 038's delete policy has no row to
  // evaluate — so without this check any signed-in user could "leave" a challenge
  // they never joined, and an author could "remove" someone who was never a
  // participant. Both fabricate a departure: a system message in the thread and a
  // notification to a real person who did nothing.
  const { data: removedRows, error } = await client
    .from('toy_idea_participants')
    .delete()
    .eq('idea_id', id)
    .eq('profile_id', target)
    .select('profile_id')
  if (error) return c.json({ error: error.message }, 500)
  if (!removedRows || removedRows.length === 0) {
    return c.json({ error: 'That person is not part of this challenge' }, 404)
  }

  const name = leaving ? await actorName(userId) : await actorName(target)
  await systemMessage(id, userId, leaving ? `${name} left this challenge` : `${name} was removed from this challenge`)
  await createAdminClient().from('notifications').insert({
    recipient_id: leaving ? idea.author_id : target,
    type: leaving ? 'challenge_left' : 'challenge_removed',
    idea_id: id,
    actor_name: leaving ? name : await actorName(userId),
  })

  return c.json({ removed: true })
})

toyIdeas.get('/:id/messages', async (c) => {
  const { data, error } = await createUserClient(c.get('token'))
    .from('toy_idea_messages')
    .select('*')
    .eq('idea_id', c.req.param('id'))
    .order('created_at', { ascending: true })

  if (error) return c.json({ error: error.message }, 500)
  // RLS returns an empty set rather than an error to a non-participant, which
  // is the correct answer: they see a challenge with no readable thread.
  return c.json(data ?? [])
})

toyIdeas.post('/:id/messages', async (c) => {
  const parsed = await c.req.json().catch(() => null)
  const body = typeof parsed?.body === 'string' ? parsed.body.trim() : ''
  if (!body) return c.json({ error: 'A message cannot be empty' }, 400)

  // sender_id comes from the verified token, never the request body.
  const { data, error } = await createUserClient(c.get('token'))
    .from('toy_idea_messages')
    .insert({ idea_id: c.req.param('id'), sender_id: c.get('userId'), kind: 'user', body })
    .select('*')
    .single()

  if (error?.code === RLS_VIOLATION) return c.json({ error: 'You are not part of this challenge' }, 403)
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

/**
 * Files a report and, in the same request, carries out the removal it
 * triggers. Body: { reported_profile_id, reason }.
 *
 * `reason` is mandatory and must survive trimming — the owner's explicit
 * call: a report with no account of what happened gives an admin nothing to
 * act on (see 041's column comment).
 *
 * The insert's own RLS policy (041/042) is the permission check: the
 * reporter must be the idea's author or a *current* participant
 * (removed_at is null). No `.select()` follows the insert — 041 deliberately
 * gives toy_idea_reports no select policy for authenticated, so an
 * `INSERT ... RETURNING` would fail RLS even though the row itself was
 * written, and look like a failed insert.
 *
 * An author can't be evicted from their own idea, and someone uncomfortable
 * enough to report should not be left sitting in the thread — so reporting
 * the author removes the *reporter* instead of the author. Either way the
 * report's reason never appears in the system message or the notification
 * that follow; only that a removal happened.
 *
 * `reported_profile_id` is checked against this idea (author, or a current
 * participant) *before* anything is written. 041's insert policy validates
 * only the reporter's own relationship to the idea, never the target's — an
 * unchecked target would let anyone with a single legitimate relationship on
 * the platform file a report naming an arbitrary, unrelated profile, which
 * still writes a system message and a "you were removed" notification to a
 * real person who was never part of this challenge. Same failure class the
 * sibling DELETE route's row-count check already guards against.
 *
 * The removed person's notification names 'SPLAT', not the reporter, as the
 * actor. Unlike the author's own removal button (DELETE, non-anonymous by
 * design), a report is confidential — the whole point of routing through
 * SPLAT rather than a direct block is that the reporter never has to be
 * named to the person they reported.
 */
toyIdeas.post('/:id/reports', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')
  const client = createUserClient(c.get('token'))

  const parsed = await c.req.json().catch(() => null)
  const body = parsed as Record<string, unknown> | null
  const reportedProfileId = typeof body?.reported_profile_id === 'string' ? body.reported_profile_id.trim() : ''
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (!reportedProfileId || !reason) return c.json({ error: 'A reason is required' }, 400)

  const { data: idea, error: loadError } = await loadIdea(client, id)
  if (loadError || !idea) return c.json({ error: 'Challenge not found' }, 404)

  const targetIsAuthor = reportedProfileId === idea.author_id
  if (!targetIsAuthor) {
    const { data: participant } = await client
      .from('toy_idea_participants')
      .select('profile_id')
      .eq('idea_id', id)
      .eq('profile_id', reportedProfileId)
      .is('removed_at', null)
      .maybeSingle()
    if (!participant) return c.json({ error: 'That person is not part of this challenge' }, 404)
  }

  const { error } = await client
    .from('toy_idea_reports')
    .insert({ idea_id: id, reported_profile_id: reportedProfileId, reported_by: userId, reason })

  if (error?.code === RLS_VIOLATION) return c.json({ error: 'You cannot report on this challenge' }, 403)
  if (error) return c.json({ error: error.message }, 500)

  const removedId = targetIsAuthor ? userId : reportedProfileId

  const { error: removeError } = await createAdminClient()
    .from('toy_idea_participants')
    .update({ removed_at: new Date().toISOString(), removed_by: userId })
    .eq('idea_id', id)
    .eq('profile_id', removedId)
  if (removeError) console.error('report removal failed', { ideaId: id, error: removeError.message })

  const removedName = await actorName(removedId)
  await systemMessage(id, userId, `${removedName} was removed from this challenge`)
  await createAdminClient().from('notifications').insert({
    recipient_id: removedId, type: 'challenge_removed', idea_id: id, actor_name: 'SPLAT',
  })

  return c.json({ reported: true }, 201)
})

export default toyIdeas
