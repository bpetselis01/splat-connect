/**
 * Tutorial CRUD. Every handler builds an RLS-respecting client from the
 * caller's JWT; row access is enforced by Supabase policies, not handler
 * checks. Exception: POST uses the admin client to create the tutorial and
 * its tutorial_contributors row (JWT-context issues with the insert), so it
 * must set ownership itself.
 */
import { Hono } from 'hono'
import { createUserClient, createAdminClient } from '../supabase/client.js'
import { pickEditable } from './pick-editable.js'
import { notifyTutorialSubmitted } from '../review-notifications.js'
import { removeDroppedPhotos } from '../photo-storage.js'
import type { AuthVariables } from '../middleware/auth.js'

const tutorials = new Hono<{ Variables: AuthVariables }>()

// tutorial_orgs is embedded for the leader dashboard, which splits its two
// lists by each row's backing status. The embed is itself RLS-filtered, so a
// caller only ever sees backing rows for a project they authored or an
// organisation they lead — the same list serves both without a second call.
//
// `id` is listed first and is not decoration: the review queue flattens these
// rows across tutorials and keys each one by row.id, since org_id repeats as
// soon as two tutorials ask the same organisation. Leaving it out handed the
// page a TutorialOrg whose declared, non-optional id was undefined — invisible
// to TypeScript, and visible in the browser only as React's missing-key
// warning pointing at a <li> that plainly had a key.
const LIST_SELECT =
  '*, tutorial_contributors!inner(profile_id), tutorial_orgs(id, status, org_id, organizations(id, name))'

// Every tutorial the caller may see, and the same list narrowed to the ones
// they contribute to. RLS does the visibility work in both; /mine only adds
// the authorship filter on top.
tutorials.get('/', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    .select(LIST_SELECT)
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

tutorials.get('/mine', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    .select(LIST_SELECT)
    .eq('tutorial_contributors.profile_id', c.get('userId'))
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

tutorials.get('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    // reviewer/reviewed_for name who approved it and whose authority they used.
    // Same shape the public detail route uses, so there is one way to ask this.
    // profiles.email is withheld here — this route is shared with the public
    // contributor edit page, not just admin review — and merged back in below
    // only for admins.
    // The invites embed is what makes an invite visible before it is answered:
    // inviting writes only to tutorial_collaborator_invites, and no
    // tutorial_contributors row exists until the invitee accepts. RLS scopes
    // the embed on its own — 012's "Participants can read an invite" admits the
    // primary contributor and the invitee, nobody else — so no filter here.
    // The alias names the FK column because the table points at profiles twice.
    // Recommendations come with their target's status, unfiltered: the editor
    // badges the ones a parent cannot see yet, and this route is the only one
    // that tells it which those are. The public route strips them instead.
    .select(
      '*, parts(*), tools(*), stl_files(*), tutorial_contributors(*, profiles(id, name, role, created_at)), \
tutorial_collaborator_invites(*, profiles:invited_profile_id(id, name, role, created_at)), \
tutorial_recommendations!tutorial_id(position, recommended_id, tutorials!recommended_id(id, title, kind, difficulty, toy_photo_url, status, maturity)), \
reviewer:reviewed_by(name), reviewed_for:reviewed_for_org_id(name)'
    )
    .eq('id', c.req.param('id'))
    .order('position', { referencedTable: 'tutorial_recommendations', ascending: true })
    .single()
  if (error) return c.json({ error: error.message }, 404)

  // A target the caller cannot read arrives as `tutorials: null`: RLS hides
  // other people's unapproved rows, and the picker only ever offered approved
  // ones, so a null here is a target that went back into review after it was
  // chosen. That is the one case the "Not yet approved" badge exists for, and
  // the editor and both review pages read r.tutorials.id unguarded — so the
  // target is filled in with the admin client. The caller already saw this
  // tutorial when it was approved; the card fields are all it gets back.
  const recs = (data.tutorial_recommendations ?? []) as { recommended_id: string; tutorials: unknown }[]
  const hiddenIds = recs.filter((r) => r.tutorials === null).map((r) => r.recommended_id)
  if (hiddenIds.length) {
    const { data: targets } = await createAdminClient()
      .from('tutorials')
      .select('id, title, kind, difficulty, toy_photo_url, status')
      .in('id', hiddenIds)
    const byId = new Map((targets ?? []).map((t) => [t.id, t]))
    for (const r of recs) if (r.tutorials === null) r.tutorials = byId.get(r.recommended_id) ?? null
  }

  if (c.get('role') === 'admin' && data.tutorial_contributors?.length) {
    const admin = createAdminClient()
    const { data: emails } = await admin
      .from('profiles')
      .select('id, email')
      .in(
        'id',
        data.tutorial_contributors.map((tc: { profile_id: string }) => tc.profile_id)
      )
    const emailById = new Map((emails ?? []).map((p) => [p.id, p.email]))
    for (const tc of data.tutorial_contributors) {
      if (tc.profiles) tc.profiles.email = emailById.get(tc.profile_id) ?? null
    }
  }

  return c.json(data)
})

tutorials.post('/', async (c) => {
  const body = await c.req.json()
  if (!(await hasAcceptedContributorTerms(c.get('token'), c.get('userId')))) {
    return c.json({ error: 'You must accept the contributor terms before contributing' }, 403)
  }
  // WHY: Uses the admin client (bypasses RLS) because RLS policies rely on
  //      auth.uid() from a JWT context that inserts through this route don't have.
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tutorials')
    .insert({
      id: body.id,
      title: body.title,
      difficulty: body.difficulty,
      // The card the contributor picked on /upload. Defaulted here as well as
      // in 048 so a caller that predates kind gets what every row before it got.
      kind: body.kind ?? 'toy_adaptation',
      description: body.description ?? null,
      status: 'draft',
      tutorial_pdf_url: body.tutorial_pdf_url ?? null,
      photo_urls: body.photo_urls ?? [],
    })
    .select()
    .single()
  // WHY: If the submit fails and the user retries, the same tutorial ID is sent
  //      again, hitting a duplicate key error on the second insert.
  // HOW: A duplicate key error means the tutorial was already created — return
  //      success so the caller can continue with the remaining submit steps.
  if (error) {
    // 23505 = unique_violation: tutorial already exists (retry-safe)
    if (error.code === '23505') return c.json({ id: body.id }, 200)
    console.error('[POST /api/tutorials] Supabase error:', error.code, error.message)
    return c.json({ error: error.message }, 500)
  }
  return c.json(data, 201)
})

/** Only these may be set through the generic edit endpoint. Unknown keys are
 *  dropped silently; the protected ones return 403 so a caller learns rather than
 *  wonders. */
const EDITABLE = ['title', 'description', 'difficulty', 'kind', 'maturity', 'tutorial_pdf_url', 'photo_urls', 'status'] as const
const PROTECTED = ['reviewed_by', 'reviewed_for_org_id', 'reviewed_at', 'rejection_note']

async function hasAcceptedContributorTerms(token: string, userId: string) {
  const { data } = await createUserClient(token)
    .from('user_agreements')
    .select('id')
    .eq('user_id', userId)
    .eq('agreement_type', 'contributor_terms')
    .limit(1)
  return (data ?? []).length > 0
}

tutorials.patch('/:id', async (c) => {
  const body = await c.req.json<Record<string, unknown>>()

  const attempted = PROTECTED.filter((k) => k in body)
  if (attempted.length) {
    return c.json({ error: `${attempted.join(', ')} cannot be set here` }, 403)
  }

  // WHY status is restricted to draft and pending: a leader holds an UPDATE grant
  // on tutorials, so without this they could publish through this generic
  // endpoint. RLS would permit it, but reviewed_by and reviewed_for_org_id would
  // stay null — a published tutorial with no audit trail, invisible to the admin
  // spot-check. Approving and rejecting must go through POST /:id/review or the
  // admin status endpoint.
  if ('status' in body && body.status !== 'draft' && body.status !== 'pending') {
    return c.json({ error: 'use POST /:id/review to approve or reject' }, 403)
  }

  // The contributor_terms gate. Checked here as well as on create, because gating
  // creation alone would let drafts that predate the terms sail through while
  // blocking their authors from touching them. draft -> pending is the moment work
  // is actually offered to the platform.
  if (body.status === 'pending' && !(await hasAcceptedContributorTerms(c.get('token'), c.get('userId')))) {
    return c.json({ error: 'You must accept the contributor terms before submitting' }, 403)
  }

  if (typeof body.updated_at !== 'string') {
    return c.json({ error: 'updated_at is required' }, 400)
  }

  const update = pickEditable(body, EDITABLE)
  // Not in EDITABLE because the client never chooses the timestamp: it affirms
  // the checklist (safety_declared: true) and the server stamps when.
  if (body.safety_declared === true) update.safety_declared_at = new Date().toISOString()
  if (!Object.keys(update).length) return c.json({ error: 'nothing to update' }, 400)

  const supabase = createUserClient(c.get('token'))

  // Read the status BEFORE the write, and only on the submit path. draft ->
  // pending is one event; a later save that happens to resend status 'pending'
  // (the editor sends the whole form) is not, and notifying on it would have
  // meant a leader's badge climbing every time an author fixed a typo.
  // Read before the write, and only when photos are part of this save: the
  // sweep below needs to know which URLs the row held a moment ago.
  const photosBefore = Array.isArray(body.photo_urls)
    ? (
        await supabase
          .from('tutorials')
          .select('photo_urls')
          .eq('id', c.req.param('id'))
          .maybeSingle()
      ).data?.photo_urls
    : null

  const submitting = body.status === 'pending'
  const current = submitting
    ? (
        await supabase
          .from('tutorials')
          .select('status, safety_declared_at')
          .eq('id', c.req.param('id'))
          .maybeSingle()
      ).data
    : null
  const wasDraft = current?.status === 'draft'

  // The safety gate: a draft is not offered for review until its author has
  // affirmed the checklist (SAFETY_CHECKLIST in @splat-connect/types). Checked
  // server-side because the UI gate is only the browser's opinion.
  if (submitting && !current?.safety_declared_at && !update.safety_declared_at) {
    return c.json({ error: 'The safety declaration is required before submitting' }, 400)
  }

  const { data, error } = await supabase
    .from('tutorials')
    .update(update)
    .eq('id', c.req.param('id'))
    .eq('updated_at', body.updated_at)
    .select()
  if (error) return c.json({ error: error.message }, 500)
  if (!data.length) {
    // Zero rows: either RLS refused (not a contributor / trying to set a
    // forbidden status), or someone else saved first. The generic message
    // in EDITABLE-adjacent 403 handling above already covers the RLS case
    // for status; here it is specifically the conflict, since an RLS
    // refusal on a normal field patch is not otherwise expected for a
    // tutorial's own contributor.
    return c.json({ error: 'This was updated by someone else while you were editing.' }, 409)
  }
  // After the write, not before: a photo's object outlives a save that failed.
  if (photosBefore) await removeDroppedPhotos('toy-photos', photosBefore, data[0].photo_urls)

  // After the update commits, so a failed notify cannot lose a submission.
  if (wasDraft) {
    await notifyTutorialSubmitted({
      tutorialId: c.req.param('id'),
      tutorialTitle: data[0].title,
      actorId: c.get('userId'),
    })
  }
  return c.json(data[0])
})

tutorials.delete('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  // .select() is load-bearing, not decoration. RLS (001_schema.sql
  // "Contributors can delete own draft tutorials") only admits a delete while
  // status = 'draft', and a policy that matches zero rows is not an error — so
  // without the returned rows this route answered 204 for a delete it had not
  // performed, and every client believed it. Mobile's editor showed a Delete
  // button on an approved guide, navigated away on the 204, and left the guide
  // exactly where it was.
  const { data, error } = await supabase
    .from('tutorials')
    .delete()
    .eq('id', c.req.param('id'))
    .select('id')
  if (error) return c.json({ error: error.message }, 500)
  if (!data || data.length === 0)
    return c.json({ error: 'Only draft guides can be deleted.' }, 409)
  return c.body(null, 204)
})

export default tutorials