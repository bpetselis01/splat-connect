/**
 * Organization routes (read-only). Both org tables are world-readable by
 * policy — an organisation is a public trust badge and its leaders public
 * trust figures. Suspended organisations are returned flagged, not hidden,
 * so a contributor can see why one isn't selectable. There is deliberately
 * no POST here: only an admin may create an organisation (routes/admin.ts);
 * the RLS insert policy is is_admin(), so a create handler here could never
 * succeed. /mine drives the dashboard link into /org/[orgId] — leadership is
 * per-organisation data, not a profile role.
 */
import { Hono, type Context } from 'hono'
import { createUserClient, createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const organizations = new Hono<{ Variables: AuthVariables }>()

/**
 * The columns anon and authenticated may read. 033 revoked the table-level
 * SELECT grant and granted these back, so `select('*')` on the user client now
 * fails outright — the pickup columns are deliberately outside it, since
 * pickup_instructions is where a leader writes "side gate, code 4417". Every
 * user-client read of this table must name its columns.
 *
 * A future migration adding an organizations column must extend both this list
 * and the grant in 033.
 */
// One literal, not a concatenation: the Supabase client infers a row type from
// the select string, and a `+` makes it `string` — which turns every field
// access on the result into an error about GenericStringError.
//
// 059's public profile fields are in here and in that migration's grant. The
// two have to move together, which is what the note above is about.
export const ORG_COLUMNS =
  'id, name, description, status, created_by, created_at, updated_at, about, suburb, state, capabilities, contact_email, contact_phone, website_url, rate_note, recycling_materials, recycling_note'

organizations.get('/', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('organizations')
    // Leaders ride along. The admin page shows them per row, and fetching them
    // separately meant one request per organisation. A <details> cannot defer it
    // either — a server component renders whether or not the panel is open.
    .select(`${ORG_COLUMNS}, org_leaders(user_id, created_at)`)
    .order('name', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// Declared before '/:id' so 'mine' is not swallowed as an id.
organizations.get('/mine', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('org_leaders')
    .select(`organizations(${ORG_COLUMNS})`)
    .eq('user_id', c.get('userId'))
  if (error) return c.json({ error: error.message }, 500)
  return c.json((data ?? []).map((r) => r.organizations))
})

/**
 * The fixed pickup point, readable and writable by a leader of that org only.
 *
 * These four routes use the SERVICE-ROLE client, unlike every other handler in
 * this file, and check leadership themselves. That is not a shortcut around RLS
 * — it is the consequence of 033's column grants: the user client has no SELECT
 * on the pickup columns at all, so a policy could not admit it even if one
 * existed. Authority moves into the handler because the grant, not the policy,
 * is what closed the door.
 */
async function leadsOrg(c: Context<{ Variables: AuthVariables }>, orgId: string) {
  const { data } = await createAdminClient()
    .from('org_leaders')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', c.get('userId'))
    .maybeSingle()
  return Boolean(data)
}

const PICKUP_COLUMNS =
  'pickup_line1, pickup_suburb, pickup_state, pickup_postcode, pickup_instructions'

organizations.get('/:id/pickup', async (c) => {
  const orgId = c.req.param('id')
  // 404 rather than 403 for a non-leader, matching routes/toys.ts: a 403 would
  // confirm the row exists to someone with no claim on it.
  if (!(await leadsOrg(c, orgId))) return c.json({ error: 'Not found' }, 404)
  const { data, error } = await createAdminClient()
    .from('organizations')
    .select(PICKUP_COLUMNS)
    .eq('id', orgId)
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

organizations.patch('/:id/pickup', async (c) => {
  const orgId = c.req.param('id')
  if (!(await leadsOrg(c, orgId))) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json().catch(() => null)
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Body must be an object' }, 400)
  }
  const address = readOrgPickup(body)
  if (!address) return c.json({ error: 'A complete pickup address is required' }, 400)

  const { data, error } = await createAdminClient()
    .from('organizations')
    .update({ ...address, updated_at: new Date().toISOString() })
    .eq('id', orgId)
    .select(PICKUP_COLUMNS)
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

// All four address fields or none: a half-filled address is not a place to
// meet, and accept_toy_transaction() refuses to hand anything over on one.
// Instructions are optional — plenty of orgs are just "reception, ground floor".
function readOrgPickup(body: Record<string, unknown>): Record<string, string | null> | null {
  const address: Record<string, string | null> = {}
  for (const field of ['pickup_line1', 'pickup_suburb', 'pickup_state', 'pickup_postcode']) {
    const value = body[field]
    if (typeof value !== 'string' || !value.trim()) return null
    address[field] = value.trim()
  }
  const instructions = body.pickup_instructions
  address.pickup_instructions =
    typeof instructions === 'string' && instructions.trim() ? instructions.trim() : null
  return address
}


/**
 * PATCH /api/organizations/:id/profile
 *
 * The profile editor's write. Everything on it is public by design, which is
 * the reason it is a different route from `/pickup`: that one carries the
 * street address and runs on the service-role client because 033 revoked the
 * grant, and mixing the two would put a private column one typo away from a
 * public response.
 *
 * No review — it publishes on save, so the editor restates the leader terms at
 * its foot. That is a product decision from the artboard, recorded here because
 * the absence of a review step is the kind of thing a later reader assumes is
 * an oversight.
 */
organizations.patch('/:id/profile', async (c) => {
  const orgId = c.req.param('id')
  if (!(await leadsOrg(c, orgId))) return c.json({ error: 'Not found' }, 404)

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Body must be an object' }, 400)
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  const text = (field: string, max: number) => {
    if (!Object.hasOwn(body, field)) return null
    const value = body[field]
    if (value !== null && typeof value !== 'string') return `${field} must be text`
    const trimmed = typeof value === 'string' ? value.trim() : ''
    if (trimmed.length > max) return `${field} is longer than ${max} characters`
    patch[field] = trimmed || null
    return null
  }

  for (const [field, max] of [
    ['description', 500],
    ['about', 4000],
    ['suburb', 80],
    ['state', 20],
    ['contact_email', 200],
    ['contact_phone', 40],
    ['website_url', 300],
    ['rate_note', 500],
    ['recycling_note', 500],
  ] as const) {
    const problem = text(field, max)
    if (problem) return c.json({ error: problem }, 400)
  }

  // A name change is a real change of identity for a badge that appears on
  // other people's guides, so it is bounded but allowed — a leader correcting a
  // typo should not have to ask an admin.
  if (Object.hasOwn(body, 'name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 1 || name.length > 120) {
      return c.json({ error: 'Give the organisation a name, 120 characters or fewer.' }, 400)
    }
    patch.name = name
  }

  for (const field of ['capabilities', 'recycling_materials'] as const) {
    if (!Object.hasOwn(body, field)) continue
    const value = body[field]
    if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !v.trim())) {
      return c.json({ error: `${field} must be a list of words` }, 400)
    }
    patch[field] = (value as string[]).map((v) => v.trim()).slice(0, 20)
  }

  const { data, error } = await createAdminClient()
    .from('organizations')
    .update(patch)
    .eq('id', orgId)
    .select(ORG_COLUMNS)
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

/* ------------------------------------------------------ events and stories --
 *
 * Both run on the USER client, so 059's policies decide: published rows are
 * readable by anyone, drafts only by the organisation's leaders, and only a
 * leader may write. Two select policies rather than one `or`, on the table,
 * for the reason 059 records — a draft is not public and the two audiences must
 * not drift into one policy body that admits both.
 */

const EVENT_COLUMNS =
  'id, org_id, title, summary, starts_at, ends_at, format, location, online_url, audience, status, created_by, created_at, updated_at'
const STORY_COLUMNS =
  'id, org_id, kind, title, summary, body, byline, consent_confirmed, status, created_by, created_at, updated_at'

organizations.get('/:id/events', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('org_events')
    .select(EVENT_COLUMNS)
    .eq('org_id', c.req.param('id'))
    .order('starts_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})

organizations.post('/:id/events', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const orgId = c.req.param('id')
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return c.json({ error: 'Body must be an object' }, 400)

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title || title.length > 160) return c.json({ error: 'Give the event a name.' }, 400)

  const startsAt = typeof body.starts_at === 'string' ? body.starts_at : ''
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) {
    return c.json({ error: 'Say when it starts.' }, 400)
  }

  const format = body.format === 'online' ? 'online' : 'in_person'
  const location = typeof body.location === 'string' ? body.location.trim() : ''
  const onlineUrl = typeof body.online_url === 'string' ? body.online_url.trim() : ''
  // "Where" is one of the four things the artboard says a family decides on, so
  // it is required in whichever form the event takes. 059's constraint says the
  // same thing; this says it in a sentence.
  if (format === 'in_person' && !location) return c.json({ error: 'Say where it is.' }, 400)
  if (format === 'online' && !onlineUrl) return c.json({ error: 'Give the joining link.' }, 400)

  const { data, error } = await supabase
    .from('org_events')
    .insert({
      org_id: orgId,
      title,
      summary: typeof body.summary === 'string' && body.summary.trim() ? body.summary.trim() : null,
      starts_at: startsAt,
      ends_at: typeof body.ends_at === 'string' && body.ends_at ? body.ends_at : null,
      format,
      location: format === 'in_person' ? location : null,
      online_url: format === 'online' ? onlineUrl : null,
      audience:
        typeof body.audience === 'string' && body.audience.trim() ? body.audience.trim() : null,
      status: body.status === 'published' ? 'published' : 'draft',
      created_by: c.get('userId'),
    })
    .select(EVENT_COLUMNS)
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  // RLS returns no row rather than refusing, so an absent row IS the refusal.
  if (!data) return c.json({ error: 'That organisation is not yours to publish for.' }, 403)
  return c.json(data, 201)
})

/** Publish or unpublish. One click each, and it takes effect immediately. */
organizations.patch('/:orgId/events/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const body = (await c.req.json().catch(() => ({}))) as { status?: unknown }
  const status = body.status === 'published' ? 'published' : 'draft'

  const { data, error } = await supabase
    .from('org_events')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .eq('org_id', c.req.param('orgId'))
    .select(EVENT_COLUMNS)
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'No such event of yours.' }, 404)
  return c.json(data)
})

organizations.delete('/:orgId/events/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('org_events')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('org_id', c.req.param('orgId'))
    .select('id')
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'No such event of yours.' }, 404)
  return c.json({ id: (data as { id: string }).id })
})

organizations.get('/:id/stories', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('org_stories')
    .select(STORY_COLUMNS)
    .eq('org_id', c.req.param('id'))
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})

organizations.post('/:id/stories', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return c.json({ error: 'Body must be an object' }, 400)

  const read = (field: string, max: number) => {
    const value = typeof body[field] === 'string' ? (body[field] as string).trim() : ''
    return value && value.length <= max ? value : null
  }
  const title = read('title', 160)
  const summary = read('summary', 300)
  const storyBody = read('body', 20000)
  const byline = read('byline', 120)
  if (!title || !summary || !storyBody || !byline) {
    return c.json({ error: 'A story needs a title, a one-sentence summary, a body and a byline.' }, 400)
  }

  const consent = body.consent_confirmed === true
  const status = body.status === 'published' ? 'published' : 'draft'
  // 059 refuses this with a check constraint; saying it here makes the refusal
  // a sentence rather than a constraint violation.
  if (status === 'published' && !consent) {
    return c.json(
      { error: 'Confirm consent for everyone named or pictured before publishing.' },
      400
    )
  }

  const { data, error } = await supabase
    .from('org_stories')
    .insert({
      org_id: c.req.param('id'),
      kind: typeof body.kind === 'string' ? body.kind : 'other',
      title,
      summary,
      body: storyBody,
      byline,
      consent_confirmed: consent,
      status,
      created_by: c.get('userId'),
    })
    .select(STORY_COLUMNS)
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'That organisation is not yours to publish for.' }, 403)
  return c.json(data, 201)
})

organizations.patch('/:orgId/stories/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const body = (await c.req.json().catch(() => ({}))) as { status?: unknown }
  const status = body.status === 'published' ? 'published' : 'draft'

  const { data, error } = await supabase
    .from('org_stories')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .eq('org_id', c.req.param('orgId'))
    .select(STORY_COLUMNS)
    .maybeSingle()
  if (error) {
    // The one constraint a publish can trip: consent was never confirmed.
    return c.json(
      { error: 'Confirm consent for everyone named or pictured before publishing.' },
      400
    )
  }
  if (!data) return c.json({ error: 'No such story of yours.' }, 404)
  return c.json(data)
})

organizations.delete('/:orgId/stories/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('org_stories')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('org_id', c.req.param('orgId'))
    .select('id')
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'No such story of yours.' }, 404)
  return c.json({ id: (data as { id: string }).id })
})

/* ----------------------------------------------------------- the recycling --
 *
 * Credit is minted by the organisation weighing it, never by the contributor.
 * That is one product rule and two policies: a contributor may insert their own
 * booking and delete it while it is still booked; only a leader may update one,
 * which is the verb that writes `weighed_grams` and `credit_grams`.
 */

const DROPOFF_COLUMNS =
  'id, org_id, contributor_id, material, estimated_grams, condition_declared, note, status, weighed_grams, credit_grams, decided_by, created_at, updated_at'

organizations.get('/:id/recycling', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('recycling_dropoffs')
    .select(DROPOFF_COLUMNS)
    .eq('org_id', c.req.param('id'))
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})

organizations.post('/:id/recycling', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return c.json({ error: 'Body must be an object' }, 400)

  const material = typeof body.material === 'string' ? body.material.trim() : ''
  if (!material || material.length > 40) return c.json({ error: 'Say what you are bringing.' }, 400)

  const grams = body.estimated_grams
  if (typeof grams !== 'number' || !Number.isInteger(grams) || grams < 1 || grams > 1000000) {
    return c.json({ error: 'Say roughly how much, in whole grams.' }, 400)
  }
  // Two kilos so a machine run is worth firing up — the artboard's minimum, and
  // the one number here that is a policy rather than a bound.
  if (grams < 2000) return c.json({ error: 'Drop-offs start at two kilos.' }, 400)

  if (body.condition_declared !== true) {
    return c.json({ error: 'Tick every line of the condition declaration first.' }, 400)
  }

  const { data, error } = await supabase
    .from('recycling_dropoffs')
    .insert({
      org_id: c.req.param('id'),
      contributor_id: c.get('userId'),
      material,
      estimated_grams: grams,
      condition_declared: true,
      note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
    })
    .select(DROPOFF_COLUMNS)
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'That booking could not be made.' }, 403)
  return c.json(data, 201)
})

/**
 * PATCH /api/organizations/:orgId/recycling/:id
 *
 * Weighing it in. `weighed_grams` is what came through the door and
 * `credit_grams` is what it is worth as filament — both the leader's, and the
 * yield between them is theirs to apply rather than a constant here. About
 * three quarters is typical, and "typical" is not a number to put in a ledger.
 */
organizations.patch('/:orgId/recycling/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return c.json({ error: 'Body must be an object' }, 400)

  const status = body.status
  if (status !== 'received' && status !== 'declined') {
    return c.json({ error: 'A drop-off is either received or declined.' }, 400)
  }

  const patch: Record<string, unknown> = {
    status,
    decided_by: c.get('userId'),
    updated_at: new Date().toISOString(),
  }

  if (status === 'received') {
    const weighed = body.weighed_grams
    const credit = body.credit_grams
    for (const value of [weighed, credit]) {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 1000000) {
        return c.json({ error: 'Weighed and credited grams are whole numbers.' }, 400)
      }
    }
    // No yield turns two kilos of milk bottles into three kilos of filament.
    if ((credit as number) > (weighed as number)) {
      return c.json({ error: 'Credit cannot be more than what was weighed.' }, 400)
    }
    patch.weighed_grams = weighed
    patch.credit_grams = credit
  }

  const { data, error } = await supabase
    .from('recycling_dropoffs')
    .update(patch)
    .eq('id', c.req.param('id'))
    .eq('org_id', c.req.param('orgId'))
    .select(DROPOFF_COLUMNS)
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'No such drop-off at your organisation.' }, 404)
  return c.json(data)
})


/* ------------------------------------------------- asking for one to exist --
 *
 * Feature 12. Signed-in only, "since we need to know who to verify" — and
 * because the requester becomes the organisation's first leader on approval,
 * so the row is not just a byline.
 *
 * Declared before '/:id' so 'requests' is not swallowed as an id.
 */

const ORG_REQUEST_COLUMNS =
  'id, requester_id, org_name, what_they_do, verification, status, review_note, reviewed_by, reviewed_at, organization_id, created_at, updated_at'

organizations.get('/requests', async (c) => {
  const supabase = createUserClient(c.get('token'))
  // RLS is the gate: 060 admits your own rows and an admin's view of all of
  // them, so this is not filtered here.
  const { data, error } = await supabase
    .from('organization_requests')
    .select(ORG_REQUEST_COLUMNS)
    .eq('requester_id', c.get('userId'))
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})

organizations.post('/requests', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return c.json({ error: 'Body must be an object' }, 400)

  const read = (field: string, max: number) => {
    const value = typeof body[field] === 'string' ? (body[field] as string).trim() : ''
    return value && value.length <= max ? value : null
  }
  const orgName = read('org_name', 120)
  const whatTheyDo = read('what_they_do', 2000)
  const verification = read('verification', 1000)
  if (!orgName || !whatTheyDo || !verification) {
    return c.json(
      {
        error:
          'We need the organisation’s name, what it does, and how we can check you work there.',
      },
      400
    )
  }

  const { data, error } = await supabase
    .from('organization_requests')
    .insert({
      requester_id: c.get('userId'),
      org_name: orgName,
      what_they_do: whatTheyDo,
      verification,
    })
    .select(ORG_REQUEST_COLUMNS)
    .maybeSingle()

  if (error) {
    // 060's partial unique index: one open ask per person per name. A refresh
    // on the form must not file the same request twice for an admin to review
    // twice.
    if (error.code === '23505') {
      return c.json({ error: 'You already have an open request for that organisation.' }, 409)
    }
    return c.json({ error: error.message }, 500)
  }
  if (!data) return c.json({ error: 'That request could not be filed.' }, 403)
  return c.json(data, 201)
})

organizations.get('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('organizations')
    .select(`${ORG_COLUMNS}, org_leaders(user_id, created_at)`)
    .eq('id', c.req.param('id'))
    .single()
  if (error) return c.json({ error: error.message }, 404)
  return c.json(data)
})

export default organizations
