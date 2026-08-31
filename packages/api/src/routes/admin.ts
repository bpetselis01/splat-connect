/**
 * Admin-only routes: tutorial review (approve/reject with rejection_note and
 * reviewed_at) and organisation management (creation, suspension, leader
 * appointment).
 */
import { Hono } from 'hono'
import { createUserClient, createAdminClient } from '../supabase/client.js'
import { ORG_COLUMNS } from './organizations.js'
import { systemMessage } from './toy-ideas.js'
import type { AuthVariables } from '../middleware/auth.js'
import type { TutorialStatus } from '@splat-connect/types'

const admin = new Hono<{ Variables: AuthVariables }>()

admin.use('*', async (c, next) => {
  if (c.get('role') !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
})

admin.get('/tutorials', async (c) => {
  const supabase = createAdminClient()
  const status = (c.req.query('status') ?? 'pending') as TutorialStatus
  const { data, error } = await supabase
    .from('tutorials')
    // Decision 23: the admin sees every pending tutorial, including ones an
    // organisation has accepted. Delegation removes the obligation to act, not the
    // visibility — so the row carries its backing state and the UI can say
    // "Riverside Therapy accepted, awaiting their review".
    .select('*, tutorial_contributors(profile_id), tutorial_orgs(status, organizations(id, name))')
    .eq('status', status)
    .order('created_at', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

admin.patch('/tutorials/:id/status', async (c) => {
  const body = await c.req.json<{ status: TutorialStatus; rejection_note?: string }>()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tutorials')
    .update({
      status: body.status,
      // reviewed_for_org_id is deliberately left alone: the admin acts for the
      // platform, not for an organisation, and a null there is what distinguishes
      // the two in the spot-check query below.
      reviewed_by: c.get('userId'),
      reviewed_at: new Date().toISOString(),
      ...(body.rejection_note !== undefined ? { rejection_note: body.rejection_note || null } : {}),
    })
    .eq('id', c.req.param('id'))
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)

  // Every contributor on the tutorial, not just the primary — a collaborator
  // did the same work and needs the same approve/reject signal.
  const { data: contributorRows } = await supabase
    .from('tutorial_contributors')
    .select('profile_id')
    .eq('tutorial_id', c.req.param('id'))
  if (contributorRows?.length) {
    const { error: notifyError } = await supabase
      .from('notifications')
      .insert(
        contributorRows.map((row) => ({
          recipient_id: row.profile_id,
          type: body.status === 'approved' ? 'tutorial_approved' : 'tutorial_rejected',
          tutorial_id: c.req.param('id'),
          tutorial_title: data.title,
          actor_name: 'SPLAT',
        }))
      )
    if (notifyError) console.error('[admin.status] notification insert failed:', notifyError.message)
  }

  return c.json(data)
})

// Every non-admin account, not only role='contributor'. Since 009 the role
// column records where an account signed up rather than what it may do, so
// filtering on 'contributor' would hide mobile-registered accounts from the
// screen an admin uses to manage them. The path keeps its name: three call
// sites and an E2E spec reference it.
//
// WHY: with no limit, PostgREST's max_rows (1000, supabase/config.toml) silently
//      truncated this list, and ascending order meant the NEWEST accounts were the
//      ones dropped — so a new signup was invisible to the admin managing accounts,
//      the Accounts count on /admin capped at 1000, and a recent account could not
//      be appointed an org leader.
// HOW:  newest first, an explicit cap so truncation is a decision rather than a
//       platform default, and an exact total so callers stop inferring it from
//       array length.
const ACCOUNT_LIMIT = 1000

admin.get('/contributors', async (c) => {
  const supabase = createAdminClient()
  const { data, error, count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .neq('role', 'admin')
    .order('created_at', { ascending: false })
    .limit(ACCOUNT_LIMIT)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ accounts: data ?? [], total: count ?? 0 })
})

admin.delete('/contributors/:id', async (c) => {
  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.deleteUser(c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

/**
 * Organisation authority. All four run under the ADMIN'S OWN JWT via
 * createUserClient, not createAdminClient like the tutorial review handlers
 * above.
 *
 * WHY: so the "Admin can write organizations" and "Admin can write org leaders"
 * policies are the enforcement layer in production, not just in tests. That is
 * decision 9 applied consistently, and it costs nothing here — "Anyone can read
 * organizations" and "Admin can view all profiles" (001_schema.sql:127) cover
 * every read these handlers make.
 *
 * It also avoids a trap that bit the superseded design and was caught only by
 * asserting on the database rather than the status code: triggers run for
 * service_role even though RLS does not, and any guard calling is_admin() reads
 * auth.uid(), which service_role lacks. Such a write raises 42501 while the route
 * reports success having changed nothing. No table here carries such a trigger
 * today — but one added later must not silently break these routes.
 */
async function isContributor(supabase: ReturnType<typeof createUserClient>, userId: string) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return data?.role === 'contributor'
}

admin.post('/organizations', async (c) => {
  const body = await c.req.json<{ name?: string; description?: string; leader_user_id?: string }>()
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)
  // Required, not optional: an organisation with no leader can answer no request,
  // so a leaderless one is inert and the admin has to come back to fix it. One
  // call creates a working organisation.
  if (!body.leader_user_id) return c.json({ error: 'leader_user_id is required' }, 400)

  const supabase = createUserClient(c.get('token'))
  if (!(await isContributor(supabase, body.leader_user_id))) {
    // Legacy role gate. Since 009, role records where an account signed up rather
    // than what it may do, so this refuses a mobile-registered account that would
    // otherwise be a valid leader. Kept for now: lifting it changes organisation
    // semantics and the test that pins them, both outside this sub-project.
    // Revisit alongside lib/org-access.ts.
    return c.json({ error: 'an org leader must have the contributor role' }, 400)
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .insert({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      created_by: c.get('userId'),
    })
    // Named columns, not select(): 033 revoked the table-level SELECT grant, so
    // the user client cannot read the pickup columns and `select()` fails whole.
    .select(ORG_COLUMNS)
    .single()
  if (error) return c.json({ error: error.message }, 500)

  const { error: leaderError } = await supabase
    .from('org_leaders')
    .insert({ org_id: org.id, user_id: body.leader_user_id })
  if (leaderError) {
    // Roll back rather than leave a leaderless organisation behind: it would be
    // listed in the picker and able to answer nothing.
    await supabase.from('organizations').delete().eq('id', org.id)
    return c.json({ error: leaderError.message }, 500)
  }

  return c.json(org, 201)
})

admin.patch('/organizations/:id', async (c) => {
  const body = await c.req.json<{ status?: string; name?: string; description?: string }>()
  if (body.status !== undefined && body.status !== 'active' && body.status !== 'suspended') {
    return c.json({ error: "status must be 'active' or 'suspended'" }, 400)
  }

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('organizations')
    .update({
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', c.req.param('id'))
    .select(ORG_COLUMNS)
  if (error) return c.json({ error: error.message }, 500)
  if (!data.length) return c.json({ error: 'organisation not found' }, 404)
  return c.json(data[0])
})

admin.post('/organizations/:orgId/leaders', async (c) => {
  const body = await c.req.json<{ user_id?: string }>()
  if (!body.user_id) return c.json({ error: 'user_id is required' }, 400)

  const supabase = createUserClient(c.get('token'))
  if (!(await isContributor(supabase, body.user_id))) {
    return c.json({ error: 'an org leader must have the contributor role' }, 400)
  }

  const { data, error } = await supabase
    .from('org_leaders')
    .insert({ org_id: c.req.param('orgId'), user_id: body.user_id })
    .select()
    .single()
  if (error) {
    // 23505 = already a leader. Idempotent rather than an error: the admin's
    // intent is satisfied either way.
    if (error.code === '23505') return c.json({ ok: true }, 200)
    return c.json({ error: error.message }, 500)
  }
  return c.json(data, 201)
})

admin.delete('/organizations/:orgId/leaders/:userId', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('org_leaders')
    .delete()
    .eq('org_id', c.req.param('orgId'))
    .eq('user_id', c.req.param('userId'))
    .select('id')
  if (error) return c.json({ error: error.message }, 500)
  if (!data.length) return c.json({ error: 'not a leader of that organisation' }, 404)
  return c.body(null, 204)
})

/**
 * Design challenge review queue. Every idea, any status, newest first — an
 * admin needs to see what's pending as well as what they've already decided.
 */
admin.get('/ideas', async (c) => {
  const { data, error } = await createAdminClient()
    .from('toy_ideas')
    // Explicit columns, never select('*'): review_note is an admin's private
    // rejection reasoning, fine for this audience, but naming it keeps a
    // future private column from leaking here by default the way it did on
    // the public detail endpoint.
    .select(
      'id, author_id, title, summary, description, intended_use, primary_user, contact_prefs, status, review_note, tutorial_id, created_at, updated_at, profiles!toy_ideas_author_id_fkey(name)'
    )
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})

// Only the review transition lives here. Graduation is its own endpoint because
// it writes a tutorial and contributor rows, not just a status.
const REVIEW_OUTCOMES = ['challenge', 'rejected'] as const

admin.patch('/ideas/:id/status', async (c) => {
  const body = await c.req.json().catch(() => null)
  const status = body?.status
  if (!REVIEW_OUTCOMES.includes(status)) {
    return c.json({ error: 'Status must be challenge or rejected' }, 400)
  }
  // Publishing forces review_note to null structurally: 040's reasoning for
  // leaving `authenticated`'s wide toy_ideas grant unrestricted rests on a
  // published row never carrying a note. A caller sending one alongside
  // status: 'challenge' must not be able to make that false.
  const reviewNote = status === 'challenge'
    ? null
    : typeof body?.review_note === 'string' ? body.review_note.trim() : null

  const client = createAdminClient()
  // Compare-and-swap, not read-then-act: the allowed source statuses depend
  // on the target, conditioned on the same UPDATE statement. Publishing (->
  // challenge) may claim only a 'pending' row — if it claimed 'challenge' too,
  // two concurrent publishes would both match (the first commits pending ->
  // challenge, and 'challenge' is still in the allowed set the second call's
  // WHERE re-evaluates against once it gets the row lock), so the second
  // fires a duplicate idea_approved notification instead of 404ing. Rejecting
  // (-> rejected) still accepts either source: a straight pending -> rejected
  // refusal, or the challenge -> rejected unpublish this route was widened
  // for (no DELETE route or grant exists on purpose; this flip is the only
  // way a published idea stops being public). A graduated idea matches
  // neither set and 404s, same as a second identical review.
  const fromStatuses = status === 'challenge' ? ['pending'] : ['pending', 'challenge']
  const { data, error } = await client
    .from('toy_ideas')
    .update({ status, review_note: reviewNote, updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .in('status', fromStatuses)
    .select('id, author_id')
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'No pending or published idea with that id' }, 404)

  const { error: notifyError } = await client.from('notifications').insert({
    recipient_id: data.author_id,
    type: status === 'challenge' ? 'idea_approved' : 'idea_rejected',
    idea_id: data.id,
    actor_name: 'SPLAT',
  })
  if (notifyError) console.error('[admin.ideas.status] notification insert failed:', notifyError.message)

  return c.json({ id: data.id, status })
})

/**
 * POST /api/admin/ideas/:id/graduate
 *
 * Turns a challenge into a draft tutorial: one atomic status claim, one
 * tutorial insert, one tutorial_id link, one contributor copy, one
 * notification insert, one system message. No transaction spans these —
 * Supabase's JS client cannot open one across calls — so a failure partway
 * leaves a partial result behind. Every write below that can fail is checked
 * and reported as a 500 rather than swallowed, so a partial result is at
 * least a visible one.
 *
 * The status claim runs first and is a compare-and-swap
 * (`.eq('status', 'challenge')` on the update itself), not a read-then-act
 * check. Two concurrent POSTs — an admin double-clicking Graduate is a
 * mundane trigger — would otherwise both read 'challenge', both insert a
 * tutorial, and both attach a full contributor set: an orphan that IS
 * reachable through the normal pending → approved review path, which is
 * exactly the silent-duplicate outcome this endpoint exists to prevent.
 * With the claim as the first write, Postgres's own row-level locking makes
 * it exclusive: exactly one caller moves the row out of 'challenge', the
 * loser's update matches zero rows and gets 409 with no side effects at all.
 *
 * Everything after the claim is still sequential, unprotected writes — a
 * failure there is now an *incomplete* graduation, never a *duplicate* one.
 * The worst reachable state is idea 'graduated' with tutorial_id null (claim
 * succeeded, tutorial insert or the link-back failed) or graduated with a
 * tutorial that has no contributors (contributor insert failed). Both are
 * inert — tutorial_contributors gates who can even see or submit the draft,
 * so nothing here reaches the public library unattended — detectable by
 * query, and repairable by inserting the missing rows. A retry always 409s
 * rather than duplicating anything, because the claim already moved the row.
 *
 * ponytail: the claim is atomic (Postgres enforces it); the three writes
 * after it are not, since the Supabase JS client cannot open a transaction
 * across calls. That residual risk is bounded to "incomplete," not
 * "duplicated." If graduation ever needs full atomicity, move the whole
 * sequence into a plpgsql function and call it via .rpc().
 */
admin.post('/ideas/:id/graduate', async (c) => {
  const client = createAdminClient()
  const id = c.req.param('id')

  const { data: exists, error: existsError } = await client
    .from('toy_ideas').select('id').eq('id', id).maybeSingle()
  if (existsError) return c.json({ error: existsError.message }, 500)
  if (!exists) return c.json({ error: 'Not found' }, 404)

  // Claim the graduation atomically. A read-then-act guard lets two concurrent
  // calls both pass, both mint a tutorial, and both attach contributors — an
  // orphan that IS reachable through pending->approved review. This conditional
  // update is the compare-and-swap: exactly one caller can move the row out of
  // 'challenge', and the loser claims no row.
  const { data: claimed, error: claimError } = await client
    .from('toy_ideas')
    .update({ status: 'graduated', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'challenge')
    .select('id, author_id, title, summary')
    .maybeSingle()
  if (claimError) return c.json({ error: claimError.message }, 500)
  // A challenge graduates once. A second call is a mistake, not an update —
  // and here it also lost the compare-and-swap, so it changed nothing.
  if (!claimed) return c.json({ error: 'Already graduated' }, 409)

  const { data: tutorial, error: tutorialError } = await client
    .from('tutorials')
    // difficulty is NOT NULL on tutorials with a check constraint; an idea carries
    // no difficulty, so a draft starts at 'medium' and its contributor corrects it
    // before submitting. Do not relax the column to serve this one caller.
    .insert({ title: claimed.title, description: claimed.summary, status: 'draft', difficulty: 'medium' })
    .select('id')
    .single()
  if (tutorialError) return c.json({ error: tutorialError.message }, 500)

  const { error: linkError } = await client
    .from('toy_ideas').update({ tutorial_id: tutorial.id }).eq('id', id)
  if (linkError) return c.json({ error: linkError.message }, 500)

  // removed_at is null: someone excluded after a report must not be credited
  // on the resulting guide, and tutorial_contributors is also the access
  // gate for the draft — crediting them would hand back exactly the access
  // their removal took away.
  const { data: participants, error: participantsError } = await client
    .from('toy_idea_participants').select('profile_id').eq('idea_id', id).is('removed_at', null)
  if (participantsError) return c.json({ error: participantsError.message }, 500)

  // The shape tutorial_contributors already stores, so this copy is free.
  const { error: contributorsError } = await client.from('tutorial_contributors').insert([
    { tutorial_id: tutorial.id, profile_id: claimed.author_id, role: 'primary' },
    ...(participants ?? []).map((p: { profile_id: string }) => ({
      tutorial_id: tutorial.id, profile_id: p.profile_id, role: 'collaborator',
    })),
  ])
  if (contributorsError) return c.json({ error: contributorsError.message }, 500)

  // Tell the author and every current participant a draft now exists —
  // graduation was otherwise silent to everyone it happened to. Checked like
  // every other write above, not swallowed: a failed notification insert is
  // reported as a 500 rather than logged and ignored.
  const { error: notifyError } = await client.from('notifications').insert([
    { recipient_id: claimed.author_id, type: 'idea_graduated', idea_id: id, actor_name: 'SPLAT' },
    ...(participants ?? []).map((p: { profile_id: string }) => ({
      recipient_id: p.profile_id, type: 'idea_graduated', idea_id: id, actor_name: 'SPLAT',
    })),
  ])
  if (notifyError) return c.json({ error: notifyError.message }, 500)

  // Fire-and-forget, same as every other system message in this feature: the
  // graduation has already succeeded by this point, so a failed thread post
  // logs rather than fails the request.
  await systemMessage(id, claimed.author_id, 'This challenge became a draft guide.')

  return c.json({ tutorial_id: tutorial.id }, 201)
})

/**
 * GET /api/admin/spot-check
 *
 * A random sample of tutorials someone other than the admin approved. With no
 * self-review block (decision 14) a leader may publish their own work, so
 * sampling is how a bad approval gets noticed at all — this endpoint is the
 * detection half of a control whose other half is reactive.
 */
admin.get('/spot-check', async (c) => {
  const limit = Number(c.req.query('limit') ?? 10)
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tutorials')
    .select('*, tutorial_contributors(profile_id), tutorial_orgs(status, organizations(id, name))')
    .eq('status', 'approved')
    .not('reviewed_by', 'is', null)
    .neq('reviewed_by', c.get('userId'))
    .limit(limit)
  if (error) return c.json({ error: error.message }, 500)
  // PostgREST has no random ordering, and the sample is small enough that
  // shuffling here costs nothing. Without it an admin only ever re-checks the
  // same newest rows.
  // ponytail: in-memory shuffle of at most `limit` rows; move to a tablesample
  // query if the approved set ever gets large.
  return c.json((data ?? []).sort(() => Math.random() - 0.5))
})

/**
 * GET /api/admin/reports
 *
 * The report queue (041/spec §API). Unresolved rows first so an admin lands
 * on what still needs deciding; resolved ones stay listed underneath rather
 * than vanishing, so a repeat pattern against the same person is still
 * visible. `reason` is included on purpose — admins are the one audience
 * this table's RLS ever lets read it (041's comment), so this is the only
 * response in the codebase where that column may appear.
 */
admin.get('/reports', async (c) => {
  const { data, error } = await createAdminClient()
    .from('toy_idea_reports')
    .select(
      'id, idea_id, reported_profile_id, reported_by, reason, created_at, resolved_at, resolved_by, resolution_note, ' +
        'toy_ideas(title), ' +
        'reported_profile:profiles!toy_idea_reports_reported_profile_id_fkey(name), ' +
        'reporter:profiles!toy_idea_reports_reported_by_fkey(name)'
    )
    .order('resolved_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})

/**
 * PATCH /api/admin/reports/:id
 *
 * Resolves a report with a note. `.is('resolved_at', null)` on the update
 * itself is the same compare-and-swap as graduate's status claim above: a
 * double-click resolves once, and the loser's update matches no row rather
 * than overwriting the first admin's resolved_by/resolution_note.
 */
admin.patch('/reports/:id', async (c) => {
  const body = await c.req.json<{ resolution_note?: string }>().catch(() => null)
  if (body?.resolution_note !== undefined && typeof body.resolution_note !== 'string') {
    return c.json({ error: 'resolution_note must be a string' }, 400)
  }
  const resolutionNote = body?.resolution_note?.trim() || null

  const { data, error } = await createAdminClient()
    .from('toy_idea_reports')
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: c.get('userId'),
      resolution_note: resolutionNote,
    })
    .eq('id', c.req.param('id'))
    .is('resolved_at', null)
    .select('id, idea_id, resolved_at, resolved_by, resolution_note')
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'No unresolved report with that id' }, 404)
  return c.json(data)
})

/**
 * DELETE /api/admin/ideas/:id/participants/:profileId/removal
 *
 * Reinstatement: the owner's stated escape hatch, "not allowed back in no
 * matter what, unless an admin adds them back in." Clears removed_at/by
 * rather than deleting the row, so joined_at (and the thread-history bound
 * it drives, 042) stays intact for their return.
 *
 * `.not('removed_at', 'is', null)` scopes the update to an actual removal —
 * it matches nothing for a participant row that was never removed, and
 * nothing for a profileId that never joined at all, so both collapse to the
 * same 404 the brief asks for.
 */
admin.delete('/ideas/:id/participants/:profileId/removal', async (c) => {
  const { data, error } = await createAdminClient()
    .from('toy_idea_participants')
    .update({ removed_at: null, removed_by: null })
    .eq('idea_id', c.req.param('id'))
    .eq('profile_id', c.req.param('profileId'))
    .not('removed_at', 'is', null)
    .select('profile_id')
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'That person carries no removal to reinstate' }, 404)
  return c.body(null, 204)
})

export default admin
