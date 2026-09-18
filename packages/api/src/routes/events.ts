/**
 * Events: the family's side. Who is going, and what they answered.
 *
 * The organisation's side lives in routes/organizations.ts beside the rest of
 * what a leader publishes — this file is only what a registrant does with an
 * event somebody else runs.
 *
 * Every read and write here goes through the USER client, so 061's policies
 * decide rather than a filter written in this file. Those policies are narrow
 * on purpose: a registration carries a name, an email and free-text answers
 * about a child's access and sensory needs, and the artboard is explicit that
 * "Answers are shown to leaders only". There are exactly two ways to read one —
 * you wrote it, or you lead the organisation running the event — and
 * scripts/check-schema-guards.sh asserts both against the live database.
 *
 * Related files:
 * - supabase/migrations/061_events.sql: the tables and their policies
 * - src/routes/public.ts: the unauthenticated list and detail
 * - src/routes/organizations.ts: publishing, the question form, the attendee list
 */
import { Hono } from 'hono'
import { createUserClient, createAdminClient } from '../supabase/client.js'
import { INVALID_TEXT_REPRESENTATION } from '../supabase/pg-errors.js'
import type { AuthVariables } from '../middleware/auth.js'
import type { OrgEventQuestion } from '@splat-connect/types'

const events = new Hono<{ Variables: AuthVariables }>()

const REGISTRATION_COLUMNS = 'id, event_id, user_id, name, email, answers, created_at, cancelled_at'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type QuestionRow = Pick<OrgEventQuestion, 'id' | 'prompt' | 'answer_type' | 'required' | 'options'>

/**
 * Checks a submitted answer set against the organiser's questions.
 *
 * Returns the answers to store, or a sentence to show. Validating here rather
 * than in the form alone is the difference between a required question and a
 * suggestion: the register page is public, and its confirm button is not the
 * only way to reach this route.
 *
 * Unknown keys are dropped rather than rejected. A leader may delete a question
 * while somebody has the form open, and failing their submission for answering
 * a question that existed when they loaded the page helps nobody.
 */
function checkAnswers(
  questions: QuestionRow[],
  submitted: Record<string, unknown>,
): { answers: Record<string, string | number | boolean> } | { error: string } {
  const answers: Record<string, string | number | boolean> = {}

  for (const q of questions) {
    const raw = submitted[q.id]
    const blank = raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim())

    if (blank) {
      if (q.required) return { error: `Answer "${q.prompt}" to confirm your spot.` }
      continue
    }

    switch (q.answer_type) {
      case 'number': {
        const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
        if (!Number.isFinite(n)) return { error: `"${q.prompt}" takes a number.` }
        answers[q.id] = n
        break
      }
      case 'boolean':
        answers[q.id] = raw === true || raw === 'true' || raw === 'yes'
        break
      case 'choice': {
        const v = String(raw).trim()
        // The options are the whole point of a 'choose one'. Accepting a value
        // outside them would let the route write something the leader's own
        // summary cannot group by.
        if (!q.options.includes(v)) return { error: `Pick one of the options for "${q.prompt}".` }
        answers[q.id] = v
        break
      }
      default: {
        const v = String(raw).trim()
        if (v.length > 2000) return { error: `"${q.prompt}" is longer than we can store.` }
        answers[q.id] = v
      }
    }
  }

  return { answers }
}

/**
 * The events this person said they are going to, with the part-print request
 * on each — which is what /dashboard/events is: "What you said you are going
 * to, and where any part-print request with the host is up to."
 */
events.get('/mine', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const userId = c.get('userId')

  const { data: registrations, error } = await supabase
    .from('org_event_registrations')
    .select(REGISTRATION_COLUMNS)
    .eq('user_id', userId)
    .is('cancelled_at', null)
  if (error) return c.json({ error: error.message }, 500)

  const rows = registrations ?? []
  if (rows.length === 0) return c.json([])

  const eventIds = rows.map((r) => r.event_id as string)

  // The admin client for the events and their organisations, deliberately.
  // Embedding organizations off a user-client query returns nothing at all
  // under 033/045's column grants — the parent query comes back empty with no
  // error, which is the silent failure documented on src/routes/public.ts.
  const admin = createAdminClient()
  const [{ data: eventRows }, { data: prints }] = await Promise.all([
    admin
      .from('org_events')
      .select(
        'id, org_id, kind, title, starts_at, ends_at, format, location, suburb, state, status, cancelled_at, prints_parts',
      )
      .in('id', eventIds),
    // The family's own part-print requests against these events. Scoped to
    // their own rows: this is the requester's view of the queue the leader
    // works through on /dashboard/org/events/[id].
    supabase
      .from('toy_transactions')
      .select('id, event_id, status, part_sets, tutorial_id, decline_reason, created_at')
      .in('event_id', eventIds)
      .eq('requester_id', userId),
  ])

  const orgIds = [...new Set((eventRows ?? []).map((e) => e.org_id as string))]
  const { data: orgs } = await admin.from('organizations').select('id, name').in('id', orgIds)
  const orgName = new Map((orgs ?? []).map((o) => [o.id as string, o.name as string]))
  const byEvent = new Map((eventRows ?? []).map((e) => [e.id as string, e]))
  const printByEvent = new Map((prints ?? []).map((p) => [p.event_id as string, p]))

  const out = rows
    .map((r) => {
      const event = byEvent.get(r.event_id as string)
      if (!event) return null
      return {
        registration_id: r.id,
        registered_at: r.created_at,
        event: { ...event, org_name: orgName.get(event.org_id as string) ?? '' },
        part_request: printByEvent.get(event.id as string) ?? null,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    // Soonest first: this is a list of things you have to turn up to, so the
    // one that needs a decision first belongs at the top. The public list
    // orders the same way.
    .sort((a, b) => String(a.event.starts_at).localeCompare(String(b.event.starts_at)))

  return c.json(out)
})

/** Say you are coming. */
events.post('/:id/registrations', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const eventId = c.req.param('id')
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return c.json({ error: 'Body must be an object' }, 400)

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 120) return c.json({ error: 'Who is the booking under?' }, 400)

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!EMAIL_RE.test(email)) return c.json({ error: 'That email address does not look right.' }, 400)

  // The event has to be open before anything is written. Three separate
  // refusals rather than one, because "you cannot register" with no reason is
  // the thing that makes somebody email the host.
  const admin = createAdminClient()
  const { data: event, error: eventError } = await admin
    .from('org_events')
    .select('id, status, cancelled_at, registrations_closed_at, capacity, starts_at')
    .eq('id', eventId)
    .maybeSingle()
  if (eventError) {
    if (eventError.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'No such event.' }, 404)
    return c.json({ error: eventError.message }, 500)
  }
  if (!event || event.status !== 'published') return c.json({ error: 'No such event.' }, 404)
  if (event.cancelled_at) return c.json({ error: 'This event has been cancelled.' }, 409)
  if (event.registrations_closed_at) {
    return c.json({ error: 'The host has closed registrations for this one.' }, 409)
  }

  const { data: questions } = await admin
    .from('org_event_questions')
    .select('id, prompt, answer_type, required, options')
    .eq('event_id', eventId)
    .order('position')

  const checked = checkAnswers(
    (questions ?? []) as QuestionRow[],
    (body.answers ?? {}) as Record<string, unknown>,
  )
  if ('error' in checked) return c.json({ error: checked.error }, 400)

  // Counted at the moment of writing rather than read off the list the page
  // rendered with, which can be minutes old on a popular build day.
  if (event.capacity !== null) {
    const { count } = await admin
      .from('org_event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('cancelled_at', null)
    if ((count ?? 0) >= (event.capacity as number)) {
      return c.json({ error: 'This one is full. The host may open more seats.' }, 409)
    }
  }

  const { data, error } = await supabase
    .from('org_event_registrations')
    // Upsert, not insert: the unique key is (event_id, user_id), so somebody
    // who cancelled and changed their mind is the same row coming back rather
    // than a duplicate-key error they cannot act on.
    .upsert(
      {
        event_id: eventId,
        user_id: c.get('userId'),
        name,
        email,
        answers: checked.answers,
        cancelled_at: null,
      },
      { onConflict: 'event_id,user_id' },
    )
    .select(REGISTRATION_COLUMNS)
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  // RLS returns no row rather than refusing, so an absent row IS the refusal.
  if (!data) return c.json({ error: 'That registration is not yours to make.' }, 403)
  return c.json(data, 201)
})

/**
 * Cancel. A timestamp rather than a delete, so the host keeps the count they
 * planned the day around and the seat goes back on the list.
 */
events.delete('/:id/registrations', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('org_event_registrations')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('event_id', c.req.param('id'))
    .eq('user_id', c.get('userId'))
    .is('cancelled_at', null)
    .select('id')
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'No such event.' }, 404)
    return c.json({ error: error.message }, 500)
  }
  if (!data) return c.json({ error: 'You are not registered for that one.' }, 404)
  return c.json({ id: (data as { id: string }).id })
})

export default events
