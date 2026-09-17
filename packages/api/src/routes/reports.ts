/**
 * Reports a member files about something on the platform.
 *
 * One rule shapes the whole file, and 065's policies say it too: the person
 * reported is never told who filed it. There is no route here that reads a
 * report by its subject, and there is no column that could carry a note to
 * them — the note goes back to the REPORTER, who is the one waiting to hear.
 *
 * A report cannot be edited after it is filed. One that can be rewritten is not
 * evidence of anything, and the reporter's own read exists so they can see the
 * answer rather than change the question.
 *
 * Distinct from 041's toy_idea_reports, which is the narrower queue of reports
 * against a participant inside one design challenge. Two tables, two screens,
 * deliberately not merged.
 *
 * Related files:
 * - supabase/migrations/065_admin_queues.sql: the table and its four policies
 * - src/routes/admin.ts: GET/PATCH /admin/member-reports, the queue
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const reports = new Hono<{ Variables: AuthVariables }>()

const COLUMNS =
  'id, reporter_id, subject_kind, subject_label, subject_id, category, body, ok_to_contact, status, note_to_reporter, created_at'

const SUBJECT_KINDS = new Set(['guide', 'toy', 'person', 'organisation', 'print_job', 'other'])
const CATEGORIES = new Set(['safety', 'no_show', 'arrived_broken', 'wrong_info', 'conduct', 'other'])

/** What the reporter has filed, with any note that came back. */
reports.get('/', async (c) => {
  const { data, error } = await createUserClient(c.get('token'))
    .from('member_reports')
    .select(COLUMNS)
    .eq('reporter_id', c.get('userId'))
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})

reports.post('/', async (c) => {
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return c.json({ error: 'Body must be an object' }, 400)

  const kind = typeof body.subject_kind === 'string' ? body.subject_kind : ''
  if (!SUBJECT_KINDS.has(kind)) return c.json({ error: 'Say what this is about.' }, 400)

  const category = typeof body.category === 'string' ? body.category : ''
  if (!CATEGORIES.has(category)) return c.json({ error: 'Pick what went wrong.' }, 400)

  // Captured at report time, not looked up on read. A guide renamed or
  // withdrawn afterwards must not change what somebody said they were
  // reporting.
  const label = typeof body.subject_label === 'string' ? body.subject_label.trim() : ''
  if (!label || label.length > 200) return c.json({ error: 'Name what you are reporting.' }, 400)

  const text = typeof body.body === 'string' ? body.body.trim() : ''
  if (!text || text.length > 4000) {
    return c.json({ error: 'Say what happened, in 4000 characters or fewer.' }, 400)
  }

  const { data, error } = await createUserClient(c.get('token'))
    .from('member_reports')
    .insert({
      // Always the caller. A client-supplied reporter would let one account
      // file in another's name, which on a table nobody but an admin can read
      // would be undetectable.
      reporter_id: c.get('userId'),
      subject_kind: kind,
      subject_label: label,
      subject_id: typeof body.subject_id === 'string' ? body.subject_id : null,
      category,
      body: text,
      ok_to_contact: body.ok_to_contact === true,
    })
    .select(COLUMNS)
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'That report could not be filed.' }, 403)
  return c.json(data, 201)
})

export default reports
