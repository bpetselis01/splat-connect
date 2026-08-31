/**
 * Project Backing Routes (Protected)
 *
 * A tutorial is a project. Its author asks organisations to back it; a leader of
 * each asked organisation answers for that organisation alone. Neither party can
 * complete the association by themselves, which is what stops a contributor
 * attaching an organisation's name to work its leaders never agreed to back.
 *
 * Mounted at /api/tutorials, following parts.ts / tools.ts / stl-files.ts.
 *
 * Endpoints:
 * - GET    /api/tutorials/:id/orgs                  — backing rows for a project
 * - POST   /api/tutorials/:id/orgs                  — author asks { org_id }
 * - DELETE /api/tutorials/:id/orgs/:orgId           — either side withdraws
 * - POST   /api/tutorials/:id/orgs/:orgId/accept    — a leader of that org
 * - POST   /api/tutorials/:id/orgs/:orgId/decline   — a leader of that org
 * - POST   /api/tutorials/:id/review                — a backing org's leader
 *
 * accept and decline are separate routes rather than one PATCH { status },
 * because the URL then names the action instead of pushing that distinction into
 * a body where an RLS violation is the only thing catching a mistake.
 *
 * Security notes:
 * - Every write uses createUserClient. The insert policy pins status='pending'
 *   and checks authorship; the update policy checks is_org_leader on both the old
 *   and the new row; the delete policy refuses once the named organisation is the
 *   one that approved the tutorial.
 * - A blocked UPDATE or DELETE matches ZERO ROWS rather than erroring, so these
 *   handlers check the returned row count and return 403. A blocked INSERT does
 *   error, with 42501.
 *
 * Related files:
 * - supabase/migrations/007_organizations.sql: every policy behind this file
 * - routes/organizations.ts: the picker this feeds
 * - routes/admin.ts: who may lead an organisation at all
 */
import { Hono, type Context } from 'hono'
import { createUserClient } from '../supabase/client.js'
import { notifyBackingRequested } from '../review-notifications.js'
import type { AuthVariables } from '../middleware/auth.js'

const tutorialOrgs = new Hono<{ Variables: AuthVariables }>()

tutorialOrgs.get('/:id/orgs', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorial_orgs')
    .select('*, organizations(id, name, status)')
    .eq('tutorial_id', c.req.param('id'))
    .order('requested_at', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

tutorialOrgs.post('/:id/orgs', async (c) => {
  const body = await c.req.json<{ org_id?: string }>()
  if (!body.org_id) return c.json({ error: 'org_id is required' }, 400)

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorial_orgs')
    // status is not sent: the column defaults to 'pending' and the policy pins it
    // there anyway. Sending it would only invite someone to try 'accepted'.
    .insert({ tutorial_id: c.req.param('id'), org_id: body.org_id })
    .select()
    .single()
  if (error) {
    // 23505 = this organisation was already asked. Idempotent: the author's
    // intent is satisfied, and a duplicate request is not worth surfacing.
    if (error.code === '23505') return c.json({ ok: true }, 200)
    // 42501 = the insert policy refused: not the author, or already published.
    if (error.code === '42501') {
      return c.json({ error: 'only the author can ask, and only before publication' }, 403)
    }
    return c.json({ error: error.message }, 500)
  }
  // Only on the 201 path. The 23505 branch above returns before this on
  // purpose: nothing new happened there, and re-notifying would let an author
  // spam a leader by pressing the button twice.
  await notifyBackingRequested({
    tutorialId: c.req.param('id'),
    orgId: body.org_id,
    actorId: c.get('userId'),
  })
  return c.json(data, 201)
})

tutorialOrgs.delete('/:id/orgs/:orgId', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorial_orgs')
    .delete()
    .eq('tutorial_id', c.req.param('id'))
    .eq('org_id', c.req.param('orgId'))
    .select('id')
  if (error) return c.json({ error: error.message }, 500)
  if (!data.length) {
    // Zero rows is the RLS refusal, not a 404: either the caller is neither the
    // author nor a leader of that organisation, or this organisation is the one
    // that approved the published tutorial and the row is now the audit trail.
    return c.json({ error: 'cannot withdraw this backing' }, 403)
  }
  return c.body(null, 204)
})

async function answer(c: Context<{ Variables: AuthVariables }>, status: 'accepted' | 'declined') {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorial_orgs')
    .update({
      status,
      responded_by: c.get('userId'),
      responded_at: new Date().toISOString(),
    })
    .eq('tutorial_id', c.req.param('id'))
    .eq('org_id', c.req.param('orgId'))
    .select()
  if (error) return c.json({ error: error.message }, 500)
  if (!data.length) return c.json({ error: 'not a leader of that organisation' }, 403)
  return c.json(data[0])
}

tutorialOrgs.post('/:id/orgs/:orgId/accept', (c) => answer(c, 'accepted'))
tutorialOrgs.post('/:id/orgs/:orgId/decline', (c) => answer(c, 'declined'))

/**
 * POST /api/tutorials/:id/review
 *
 * The leader review action. Sets status, reviewed_by, reviewed_at and
 * reviewed_for_org_id together, so a published tutorial always carries who
 * approved it and whose authority they used.
 *
 * WHY org_id is derived rather than trusted from the body: the caller may lead
 * several organisations backing the same project, and the badge line "Approved by
 * Sam, Riverside Therapy" has to name the right one. The route resolves the
 * accepted backing organisations the caller actually leads; with exactly one there
 * is nothing to ask, and with more the body must say which. The database refuses a
 * mismatch regardless (008's provenance trigger), so this is about a clear 400
 * rather than about safety.
 */
tutorialOrgs.post('/:id/review', async (c) => {
  const tutorialId = c.req.param('id')
  const body = await c.req.json<{ status?: string; org_id?: string; rejection_note?: string }>()
  if (body.status !== 'approved' && body.status !== 'rejected') {
    return c.json({ error: "status must be 'approved' or 'rejected'" }, 400)
  }
  if (body.status === 'rejected' && !body.rejection_note?.trim()) {
    // A rejection with no reason gives the contributor nothing to act on, which is
    // the whole point of the field.
    return c.json({ error: 'rejection_note is required when rejecting' }, 400)
  }

  const supabase = createUserClient(c.get('token'))

  const { data: backing, error: backingError } = await supabase
    .from('tutorial_orgs')
    .select('org_id')
    .eq('tutorial_id', tutorialId)
    .eq('status', 'accepted')
  if (backingError) return c.json({ error: backingError.message }, 500)

  // These rows are visible to the author too, not only to leaders, so this list is
  // a convenience for picking — never the authority check. The write below is what
  // decides, and RLS refuses a non-leader with zero rows.
  const candidates = (backing ?? []).map((r) => r.org_id as string)
  let orgId: string
  if (body.org_id) {
    if (!candidates.includes(body.org_id)) {
      return c.json({ error: 'that organisation is not backing this project' }, 400)
    }
    orgId = body.org_id
  } else if (candidates.length === 1) {
    orgId = candidates[0]
  } else if (candidates.length > 1) {
    return c.json({ error: 'org_id is required when several organisations back this project' }, 400)
  } else {
    return c.json({ error: 'no organisation is backing this project' }, 403)
  }

  const { data, error } = await supabase
    .from('tutorials')
    .update({
      status: body.status,
      reviewed_by: c.get('userId'),
      reviewed_for_org_id: orgId,
      reviewed_at: new Date().toISOString(),
      rejection_note: body.status === 'rejected' ? body.rejection_note!.trim() : null,
    })
    .eq('id', tutorialId)
    .select()
  // An RLS refusal arrives in one of two shapes here, and both mean the same
  // thing. If only the leader policy could have matched, its USING clause excludes
  // the row and the update silently affects nothing. If the caller also authored
  // the tutorial, "Contributors can update own tutorials" matches too and its
  // WITH CHECK forbids 'approved' outright — a real 42501. Treating only one as a
  // refusal would 500 on the other.
  if (error?.code === '42501' || (!error && !data.length)) {
    return c.json({ error: 'you cannot review this project' }, 403)
  }
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data[0])
})

export default tutorialOrgs
