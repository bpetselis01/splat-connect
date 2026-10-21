import { Hono } from 'hono'
import { CONTACT_PREFS, notificationBody, type ContactPref, type ToyIdeaKind } from '@splat-connect/types'
import { createUserClient, createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'
import { profileName } from '../profile-name.js'
import { notify } from '../notify.js'
import { toyPhotoUrl } from '../photo-storage.js'
import { INVALID_TEXT_REPRESENTATION } from '../supabase/pg-errors.js'
import { challengeCounts } from '../challenge-counts.js'

const toyIdeas = new Hono<{ Variables: AuthVariables }>()

const RLS_VIOLATION = '42501'

type Client = ReturnType<typeof createUserClient>

const IDEA_KINDS: ToyIdeaKind[] = ['challenge', 'question']

// 108: every column authenticated may still read — all but author_id. A
// user-client read of '*' is refused outright since that revoke.
const READABLE =
  'id, title, summary, description, intended_use, primary_user, contact_prefs, status, review_note, tutorial_id, kind, answer_message_id, answered_at, photo_path, anonymous, created_at, updated_at'

const REQUIRED_FIELDS = ['title', 'summary'] as const
// 103: "Why it matters" is optional; intended use and primary user are only
// ever sent by an old client. Absent, null or blank all store as null.
const OPTIONAL_FIELDS = ['description', 'intended_use', 'primary_user'] as const

/** 106: every read sends the URL a client renders beside the stored path. */
export const withPhotoUrl = <T extends { photo_path?: string | null }>(row: T) => ({
  ...row,
  photo_url: toyPhotoUrl(row.photo_path),
})

// A photo /upload/idea-photo wrote for this author: toy_ideas_photo_path_check's rule.
const ownIdeaPhoto = (path: string, userId: string) =>
  path.startsWith(`ideas/${userId}/`) &&
  /^[0-9a-f-]{36}\.(jpg|png|webp|avif|heic|heif)$/.test(path.slice(`ideas/${userId}/`.length))

/**
 * A title and a summary are required and must survive trimming — the two
 * things an admin cannot judge an idea without. Everything else is optional.
 * Returns the fields, null for a missing title or summary or a malformed
 * field, or a sentence to send back as the 400.
 */
function readIdeaBody(body: unknown, userId: string): Record<string, unknown> | string | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  const source = body as Record<string, unknown>
  const out: Record<string, unknown> = {}

  for (const field of REQUIRED_FIELDS) {
    const value = source[field]
    if (typeof value !== 'string' || !value.trim()) return null
    out[field] = value.trim()
  }
  for (const field of OPTIONAL_FIELDS) {
    const value = source[field]
    if (value === undefined || value === null) {
      out[field] = null
      continue
    }
    if (typeof value !== 'string') return null
    out[field] = value.trim() || null
  }

  const prefs = source.contact_prefs ?? []
  if (!Array.isArray(prefs)) return null
  if (!prefs.every((p) => CONTACT_PREFS.includes(p as ContactPref))) return null
  out.contact_prefs = prefs

  // A build challenge unless the author says it is a question (078). Anything
  // else is refused rather than defaulted: a typo must not file a question as
  // something an admin can graduate.
  const kind = source.kind ?? 'challenge'
  if (!IDEA_KINDS.includes(kind as ToyIdeaKind)) return null
  out.kind = kind

  // 106: one optional photo, and only one this author uploaded.
  const photo = source.photo_path ?? null
  if (photo !== null && (typeof photo !== 'string' || !ownIdeaPhoto(photo, userId))) {
    return 'That photo was not uploaded from this account.'
  }
  out.photo_path = photo

  // 108: true or false, nothing else — a typo must not publish a name.
  const anonymous = source.anonymous ?? false
  if (typeof anonymous !== 'boolean') return 'Post anonymously must be on or off.'
  out.anonymous = anonymous

  return out
}

toyIdeas.post('/', async (c) => {
  const fields = readIdeaBody(await c.req.json().catch(() => null), c.get('userId'))
  if (typeof fields === 'string') return c.json({ error: fields }, 400)
  if (!fields) return c.json({ error: 'A title and a summary are required.' }, 400)

  // author_id comes from the verified token, never the body. 108 lets the
  // caller write it but not read it back, so the response adds it.
  const author_id = c.get('userId')
  const { data, error } = await createUserClient(c.get('token'))
    .from('toy_ideas')
    .insert({ ...fields, author_id, status: 'pending' })
    .select(READABLE)
    .single()

  if (error) return c.json({ error: error.message }, 500)
  await notify(
    [{ recipient_id: author_id, type: 'idea_received', idea_id: data.id, actor_name: 'SPLAT', body: notificationBody(data.title) }],
    'idea_received'
  )
  return c.json(withPhotoUrl({ ...data, author_id }), 201)
})

// Admin client filtered on the token's user, like /mine/:id below (108).
toyIdeas.get('/mine', async (c) => {
  const { data, error } = await createAdminClient()
    .from('toy_ideas')
    .select('*')
    .eq('author_id', c.get('userId'))
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  const ideas = data ?? []
  const counts = await challengeCounts(ideas)
  return c.json(ideas.map((i) => ({ ...withPhotoUrl(i), ...counts.get(i.id)! })))
})

/**
 * The caller's own idea at any status, review_note included — the mobile
 * detail's fallback when the public read 404s a pending or rejected one, and
 * the source a revised idea starts from. Admin client filtered on the token's
 * user (F1: author_id stays out of user-client reads, so 108 can revoke it).
 */
toyIdeas.get('/mine/:id', async (c) => {
  const { data, error } = await createAdminClient()
    .from('toy_ideas')
    .select('*')
    .eq('id', c.req.param('id'))
    .eq('author_id', c.get('userId'))
    .maybeSingle()
  if (error && error.code !== INVALID_TEXT_REPRESENTATION) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(withPhotoUrl(data))
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
      // No author_id (108): a participant is never the author, and an
      // anonymous author stays anonymous to the makers who joined.
      'joined_at, toy_ideas!inner(id, title, summary, description, intended_use, primary_user, contact_prefs, status, tutorial_id, kind, answer_message_id, answered_at, photo_path, created_at, updated_at)'
    )
    .eq('profile_id', c.get('userId'))
    // A removed row must not keep showing the caller a challenge they were
    // excluded from -- 042's own select policy already hides it from them,
    // but this uses the user client, so belt-and-braces against the day this
    // route is ever read through an admin client instead.
    .is('removed_at', null)
    .order('created_at', { foreignTable: 'toy_ideas', ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  const rows = (data ?? []) as unknown as Array<{ joined_at: string; toy_ideas: { id: string; photo_path: string | null } }>
  // author_id is read here, through the admin client, only so the author's own
  // replies are not counted as posts; it never reaches the response (108).
  const ids = rows.map((r) => r.toy_ideas.id)
  const { data: authors, error: authorsError } = ids.length
    ? await createAdminClient().from('toy_ideas').select('id, author_id').in('id', ids)
    : { data: [], error: null }
  if (authorsError) return c.json({ error: authorsError.message }, 500)
  const counts = await challengeCounts((authors ?? []) as { id: string; author_id: string }[])
  return c.json(
    rows.map((r) => ({
      ...withPhotoUrl(r.toy_ideas),
      joined_at: r.joined_at,
      ...(counts.get(r.toy_ideas.id) ?? { maker_count: 0, answer_count: 0 }),
    }))
  )
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

/**
 * Removes a participant: stamps removed_at/removed_by, posts the system
 * message and sends the challenge_removed notification, naming 'SPLAT' so a
 * report's filer is never revealed. Admin client throughout. Returns false,
 * writing nothing else, when the person holds no current participant row --
 * an update matching nothing is a silent no-op, and the message and
 * notification would announce a removal that never happened.
 */
export async function removeParticipant(ideaId: string, profileId: string, removedBy: string) {
  const { data, error } = await createAdminClient()
    .from('toy_idea_participants')
    .update({ removed_at: new Date().toISOString(), removed_by: removedBy })
    .eq('idea_id', ideaId)
    .eq('profile_id', profileId)
    .is('removed_at', null)
    .select('profile_id')
  if (error) {
    console.error('report removal failed', { ideaId, error: error.message })
    return false
  }
  if (!data?.length) return false
  await systemMessage(ideaId, removedBy, `${await actorName(profileId)} was removed from this challenge`)
  await notify([{
    recipient_id: profileId, type: 'challenge_removed', idea_id: ideaId, actor_name: 'SPLAT',
  }], 'toy-ideas.reportRemoval')
  return true
}

/**
 * The idea as the caller may see it (RLS on the user client decides), plus
 * its author_id from the admin client — 108 took that column away from
 * every signed-in reader, and join/leave/report need it to notify and check.
 */
async function loadIdea(client: Client, id: string) {
  const { data, error } = await client.from('toy_ideas').select('id').eq('id', id).single()
  if (error || !data) return { data: null, error }
  const { data: idea, error: authorError } = await createAdminClient()
    .from('toy_ideas').select('author_id').eq('id', id).single()
  if (authorError || !idea) return { data: null, error: authorError }
  return { data: { author_id: idea.author_id as string }, error: null }
}

const actorName = (userId: string) => profileName(createAdminClient(), userId, 'Someone')

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
  await notify([{
    recipient_id: idea.author_id, type: 'challenge_joined', idea_id: id, actor_name: name,
  }], 'toy-ideas.join')

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
  await notify([{
    recipient_id: leaving ? idea.author_id : target,
    type: leaving ? 'challenge_left' : 'challenge_removed',
    idea_id: id,
    actor_name: leaving ? name : await actorName(userId),
  }], 'toy-ideas.leave')

  return c.json({ removed: true })
})

toyIdeas.get('/:id/messages', async (c) => {
  const id = c.req.param('id')
  // A report hides its target from the reporter until an admin resolves it.
  // toy_idea_reports has no select policy for authenticated (041), so the admin client reads it, scoped to the viewer's own reports.
  const { data: reports, error: reportsError } = await createAdminClient()
    .from('toy_idea_reports')
    .select('reported_profile_id')
    .eq('idea_id', id)
    .eq('reported_by', c.get('userId'))
    .is('resolved_at', null)
  if (reportsError) return c.json({ error: reportsError.message }, 500)
  const hidden = new Set((reports ?? []).map((r) => r.reported_profile_id as string))

  const { data: rows, error } = await createUserClient(c.get('token'))
    .from('toy_idea_messages')
    .select('*')
    .eq('idea_id', id)
    .order('created_at', { ascending: true })

  if (error) return c.json({ error: error.message }, 500)
  const data = (rows ?? []).filter((m) => !hidden.has(m.sender_id as string))
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
 * Add a named constraint (110). The insert policy is the permission check —
 * the idea's author or a maker on it who was not removed — so a refusal is a
 * 42501. An unknown idea fails that policy before its FK, so it is a 403 too.
 * Limits checked here and by the table.
 */
toyIdeas.post('/:id/constraints', async (c) => {
  const parsed = await c.req.json().catch(() => null)
  const label = typeof parsed?.label === 'string' ? parsed.label.trim() : ''
  const note = typeof parsed?.note === 'string' ? parsed.note.trim() : ''
  if (label.length < 1 || label.length > 80) {
    return c.json({ error: 'A constraint needs a name of up to 80 characters.' }, 400)
  }
  if (note.length > 300) return c.json({ error: 'Keep the note to 300 characters.' }, 400)

  const { data, error } = await createUserClient(c.get('token'))
    .from('toy_idea_constraints')
    .insert({ idea_id: c.req.param('id'), label, note: note || null, added_by: c.get('userId') })
    .select('id, label, note')
    .single()
  if (error?.code === RLS_VIOLATION) {
    return c.json({ error: 'Only the author or a maker on this challenge can add a constraint.' }, 403)
  }
  if (error?.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

/**
 * The author of a question marks one reply as its answer, or clears it with
 * `{ message_id: null }`. Body: { message_id: string | null }.
 *
 * Author-only and question-only, checked here rather than by RLS: 037 lets an
 * author update their idea only while it is pending, and a question is
 * answered after it opens — so the write goes through the admin client once
 * this route has decided the caller may make it. The reply must be a user
 * message on this idea from someone other than the author; an asker cannot
 * answer their own question.
 */
toyIdeas.post('/:id/answer', async (c) => {
  const id = c.req.param('id')
  const parsed = await c.req.json().catch(() => null)
  const messageId = parsed?.message_id
  if (messageId !== null && typeof messageId !== 'string') {
    return c.json({ error: 'message_id must be a reply id or null' }, 400)
  }

  const client = createUserClient(c.get('token'))
  const { data: idea } = await client.from('toy_ideas').select('kind, status').eq('id', id).maybeSingle()
  if (!idea) return c.json({ error: 'Question not found' }, 404)
  // 108: the caller cannot read author_id, only ask whether it is them.
  const { data: asker } = await client.rpc('is_idea_author', { idea: id })
  if (asker !== true) {
    return c.json({ error: 'Only the person who asked can mark the answer' }, 403)
  }
  if (idea.kind !== 'question') return c.json({ error: 'Only a question has an answer' }, 409)
  if (idea.status !== 'challenge') return c.json({ error: 'This question is not open' }, 409)

  const admin = createAdminClient()
  if (messageId !== null) {
    const { data: reply } = await admin
      .from('toy_idea_messages')
      .select('id')
      .eq('id', messageId)
      .eq('idea_id', id)
      .eq('kind', 'user')
      .neq('sender_id', c.get('userId'))
      .maybeSingle()
    if (!reply) return c.json({ error: 'That reply is not on this question' }, 404)
  }

  const { data, error } = await admin
    .from('toy_ideas')
    .update({
      answer_message_id: messageId,
      answered_at: messageId === null ? null : new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, answer_message_id, answered_at')
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

/**
 * Files a report. Body: { reported_profile_id, reason }. Nothing is removed
 * here: the reported person is hidden from the reporter's thread until an
 * admin resolves the report (PATCH /api/admin/reports/:id, action 'remove'
 * or 'dismiss'), and the reporter can leave separately.
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
 * `reported_profile_id` is checked against this idea (author, or a current
 * participant) *before* anything is written. 041's insert policy validates
 * only the reporter's own relationship to the idea, never the target's — an
 * unchecked target would let anyone with a single legitimate relationship on
 * the platform file a report naming an arbitrary, unrelated profile, which
 * still hides an arbitrary, unrelated profile from the reporter's reads. Same
 * failure class the sibling DELETE route's row-count check already guards
 * against.
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

  return c.json({ reported: true }, 201)
})

/**
 * Withdraw a pending idea (107). Author and status are conditions of the
 * DELETE itself, so a review that lands mid-tap wins. A miss is told apart
 * afterwards: the caller's own idea that moved on is a 409 with a reason;
 * anything else is not theirs to know about. Admin client for the same reason
 * as /mine/:id; 107's policy holds the same line for direct PostgREST calls.
 */
toyIdeas.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('toy_ideas')
    .delete()
    .eq('id', id)
    .eq('author_id', userId)
    .eq('status', 'pending')
    .select('id')
  if (error?.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
  if (error) return c.json({ error: error.message }, 500)
  if (data.length) return c.body(null, 204)
  const { data: own } = await admin.from('toy_ideas').select('id').eq('id', id).eq('author_id', userId).maybeSingle()
  return own
    ? c.json({ error: 'Only an idea still waiting for review can be withdrawn.' }, 409)
    : c.json({ error: 'Not found' }, 404)
})

export default toyIdeas
