/**
 * Contributor profile routes: GET/PATCH /api/contributors/me, and saying
 * thanks to a person (117).
 *
 * `name`, the pickup_* address fields, `public_showcase`, `bio`,
 * `featured_tutorial_id` and `occupation` are mutable
 * (see EDITABLE below).
 * `role` and `email` are frozen by the profiles_freeze_identity trigger
 * (009) — role was an escalation path, and email mirrors auth.users.
 */
import { singleRowStatus } from '../single-row.js'
import { Hono } from 'hono'
import { createUserClient, createAdminClient } from '../supabase/client.js'
import { pickEditable } from './pick-editable.js'
import { INVALID_TEXT_REPRESENTATION } from '../supabase/pg-errors.js'
import type { AuthVariables } from '../middleware/auth.js'

const contributors = new Hono<{ Variables: AuthVariables }>()

contributors.get('/me', async (c) => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', c.get('userId'))
    .single()
  if (error) return c.json({ error: error.message }, singleRowStatus(error))
  return c.json(data)
})

// Whitelist of client-editable columns. role and email are frozen by the
// profiles_freeze_identity trigger (009) and are ignored here rather than
// rejected, matching PUT /api/child-profile's handling of parent_id.
const EDITABLE = [
  'name', 'pickup_line1', 'pickup_suburb', 'pickup_state', 'pickup_postcode', 'public_showcase',
  // 072: the public profile's About paragraph and featured guide.
  'bio', 'featured_tutorial_id',
  // 124: the public profile's role line.
  'occupation',
] as const

contributors.patch('/me', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Body must be an object' }, 400)
  }

  // public_showcase is `boolean not null` — reject a bad type here rather
  // than let the update 500 at the database.
  if ('public_showcase' in body && typeof (body as Record<string, unknown>).public_showcase !== 'boolean') {
    return c.json({ error: 'public_showcase must be a boolean' }, 400)
  }

  const patch = pickEditable(body as Record<string, unknown>, EDITABLE)

  // 072. The bio bound mirrors the check constraint so a long paragraph is a
  // 400 with words rather than a 500. The featured guide has to be one the
  // caller is credited on AND approved: a draft or somebody else's guide on a
  // public profile would be a leak of the one and a lie about the other.
  // 099. Distance is measured from this; anything but four digits would 400 every list that asks.
  if (typeof patch.pickup_postcode === 'string') patch.pickup_postcode = patch.pickup_postcode.trim()
  if (
    'pickup_postcode' in patch &&
    patch.pickup_postcode !== null &&
    patch.pickup_postcode !== '' &&
    !(typeof patch.pickup_postcode === 'string' && /^\d{4}$/.test(patch.pickup_postcode))
  ) {
    return c.json({ error: 'A postcode is four digits.' }, 400)
  }
  if ('name' in patch && !(typeof patch.name === 'string' && patch.name.trim())) {
    return c.json({ error: 'Add your name.' }, 400)
  }
  if (typeof patch.bio === 'string' && patch.bio.length > 600) {
    return c.json({ error: 'bio must be 600 characters or fewer' }, 400)
  }
  if ('bio' in patch && patch.bio !== null && typeof patch.bio !== 'string') {
    return c.json({ error: 'bio must be a string' }, 400)
  }
  if (typeof patch.occupation === 'string') patch.occupation = patch.occupation.trim() || null
  if ('occupation' in patch && patch.occupation !== null && typeof patch.occupation !== 'string') {
    return c.json({ error: 'occupation must be a string' }, 400)
  }
  if (typeof patch.occupation === 'string' && patch.occupation.length > 60) {
    return c.json({ error: 'Keep what you do to 60 characters.' }, 400)
  }
  if (typeof patch.featured_tutorial_id === 'string') {
    const { data: own } = await createUserClient(c.get('token'))
      .from('tutorial_contributors')
      .select('tutorial_id, tutorials!inner(status)')
      .eq('profile_id', c.get('userId'))
      .eq('tutorial_id', patch.featured_tutorial_id)
      .eq('tutorials.status', 'approved')
      .maybeSingle()
    if (!own) return c.json({ error: 'featured_tutorial_id must be one of your published guides' }, 400)
  } else if ('featured_tutorial_id' in patch && patch.featured_tutorial_id !== null) {
    return c.json({ error: 'featured_tutorial_id must be a uuid or null' }, 400)
  }

  // Admin client: pickup_* columns are revoked from `authenticated` at the
  // grant level (028), so RETURNING those columns via a user-scoped client
  // would fail even though the UPDATE itself is RLS-permitted.
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', c.get('userId'))
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

contributors.post('/me/tutorials/:tutorialId', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { error } = await supabase
    .from('tutorial_contributors')
    .insert({ tutorial_id: c.req.param('tutorialId'), profile_id: c.get('userId') })
  // WHY: If the tutorial submit fails midway, the user retries and this endpoint
  //      is called again with the same tutorial, causing a duplicate link error.
  // HOW: A duplicate key error means the link already exists — return success so
  //      the rest of the submit can continue.
  if (error) {
    // 23505 = unique_violation: already linked (retry-safe)
    if (error.code === '23505') return c.body(null, 200)
    return c.json({ error: error.message }, 500)
  }
  return c.body(null, 201)
})

/* ------------------------------------------------------------ thanks --
 *
 * 117. Thanking a person: once per person per person. The note is optional and
 * public nowhere; the byline is what they typed, never a name off a profile.
 * Mirrors organizations.ts's thanks routes.
 */
const PERSON_THANKS_COLUMNS = 'profile_id, thanker_id, note, byline, show_note, hidden_at, transaction_id, created_at'

contributors.post('/:id/thanks', async (c) => {
  const profileId = c.req.param('id')
  const userId = c.get('userId')
  if (profileId === userId) return c.json({ error: "You can't thank yourself" }, 403)
  const body = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  const byline = typeof body.byline === 'string' ? body.byline.trim() : ''
  if (note.length > 200) return c.json({ error: 'Keep the note to 200 characters.' }, 400)
  if (byline.length > 60) return c.json({ error: 'Keep the name to 60 characters.' }, 400)
  const txId = typeof body.transaction_id === 'string' ? body.transaction_id : null

  const admin = createAdminClient()
  // A thanks may name the exchange it was for, but only one the two of them
  // were the two sides of. A leader of the organisation that held the toy
  // stands on the owner's side; the organisation itself is thanked through
  // organizations.ts, never here.
  if (txId) {
    const { data: tx, error } = await admin
      .from('toy_transactions')
      .select('requester_id, owner_id, owner_org_id')
      .eq('id', txId)
      .maybeSingle()
    if (error && error.code !== INVALID_TEXT_REPRESENTATION) return c.json({ error: error.message }, 500)
    const sides: (string | null)[] = tx ? [tx.requester_id, tx.owner_id] : []
    if (tx?.owner_org_id && !sides.includes(userId)) {
      const { data: lead } = await admin
        .from('org_leaders')
        .select('id')
        .eq('org_id', tx.owner_org_id)
        .eq('user_id', userId)
        .maybeSingle()
      if (lead) sides.push(userId)
    }
    if (!sides.includes(userId) || !sides.includes(profileId)) {
      return c.json({ error: 'That exchange is not between the two of you.' }, 400)
    }
  }

  const { error } = await createUserClient(c.get('token')).from('profile_thanks').insert({
    profile_id: profileId,
    thanker_id: userId,
    note: note || null,
    byline: byline || null,
    show_note: !!note && body.show_note === true,
  })
  if (error?.code === '23505') return c.json({ error: 'You already thanked them' }, 409)
  if (error?.code === '23503' || error?.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
  if (error) return c.json({ error: error.message }, 500)

  if (txId) {
    await admin.from('profile_thanks').update({ transaction_id: txId }).eq('profile_id', profileId).eq('thanker_id', userId)
  }
  // Logged, never thrown: the thanks has committed. The byline if they gave
  // one, else nobody — 066's and 077's reticence.
  const { error: notifyError } = await admin.from('notifications').insert({
    recipient_id: profileId,
    type: 'profile_thanked',
    ...(txId ? { toy_transaction_id: txId } : { profile_id: profileId }),
    actor_name: byline || 'A family',
  })
  if (notifyError) console.error('[contributors] thanks notify failed:', notifyError.message)

  const { data } = await admin.from('profiles').select('profile_thanks_count').eq('id', profileId).single()
  return c.json({ thanks_count: (data as { profile_thanks_count: number } | null)?.profile_thanks_count ?? 0 }, 201)
})

/** The thanks you have been given, to read and hide. */
// PENDING(profile-thanks-hide): nothing calls this route or the PATCH below; wire a screen or delete both.
contributors.get('/me/thanks', async (c) => {
  const { data, error } = await createUserClient(c.get('token'))
    .from('profile_thanks')
    .select(PERSON_THANKS_COLUMNS)
    .eq('profile_id', c.get('userId'))
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})

/** Hide or unhide a note you were given. hidden_at has no member grant — the
 *  service role writes it, scoped to the caller's own thanks. */
contributors.patch('/me/thanks/:thankerId', async (c) => {
  const body = ((await c.req.json().catch(() => null)) ?? {}) as { hidden?: unknown }
  if (typeof body.hidden !== 'boolean') return c.json({ error: 'hidden must be true or false' }, 400)
  const { data, error } = await createAdminClient()
    .from('profile_thanks')
    .update({ hidden_at: body.hidden ? new Date().toISOString() : null })
    .eq('profile_id', c.get('userId'))
    .eq('thanker_id', c.req.param('thankerId'))
    .select(PERSON_THANKS_COLUMNS)
    .maybeSingle()
  if (error && error.code !== INVALID_TEXT_REPRESENTATION) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

export default contributors
