/**
 * Unauthenticated routes — mounted before authMiddleware. They use the anon
 * client, so RLS enforces status='approved'/'published' as a second, database-level
 * backstop behind each query's own explicit filter.
 */
import { Hono } from 'hono'
import { chunk } from '../chunk.js'
import { createAnonClient, createAdminClient } from '../supabase/client.js'
import { atCapacityToyIds } from '../toy-access.js'
import { INVALID_TEXT_REPRESENTATION } from '../supabase/pg-errors.js'
import { readMinutes } from '@splat-connect/types'
import type {
  ImpactSummary,
  ImpactEntity,
  ImpactOrgEntity,
  ImpactRecent,
  ContributorProfile,
  OrgPublicProfile,
} from '@splat-connect/types'

const publicRoutes = new Hono()

publicRoutes.get('/tutorials', async (c) => {
  const supabase = createAnonClient()
  const difficulty = c.req.query('difficulty')
  let query = supabase
    .from('tutorials')
    // Backing rides along with the list so a library card can name its backers.
    // The alternative is a request per card on the busiest page on the site.
    .select('*, tutorial_orgs(status, organizations(id, name))')
    .eq('status', 'approved')
    // The default public listing carries only finished designs; anything less
    // mature stays reachable by direct link, wearing its maturity badge.
    .eq('maturity', 'complete')
    .order('created_at', { ascending: false })
  if (difficulty) query = query.eq('difficulty', difficulty)
  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)
  // Filtered here rather than in the select, for the same reason the detail route
  // does it: PostgREST cannot constrain an embedded relation from the parent query,
  // and this route uses the admin client, so the public RLS badge policy is not
  // doing it for us. A declined organisation must never look like it endorsed
  // anything.
  const rows = (data ?? []) as unknown as Array<
    Record<string, unknown> & { tutorial_orgs?: Array<{ status: string }> }
  >
  return c.json(
    rows.map((t) => ({
      ...t,
      tutorial_orgs: (t.tutorial_orgs ?? []).filter((b) => b.status === 'accepted'),
    }))
  )
})

publicRoutes.get('/tutorials/:id', async (c) => {
  const supabase = createAnonClient()
  const { data, error } = await supabase
    .from('tutorials')
    // Backing and the approver are part of what a parent is deciding on, so they
    // come down with the tutorial rather than needing a second, authenticated call
    // — this endpoint serves logged-out visitors.
    // The two !hints on the recommendations embed are load-bearing: the table
    // points at tutorials twice, and PostgREST refuses an ambiguous embed
    // outright rather than guessing. See the same select in tutorials.ts.
    .select(
      '*, parts(*), tools(*), stl_files(*), tutorial_contributors(profile_id, role, profiles(name)), ' +
        'tutorial_orgs(status, organizations(id, name)), ' +
        'tutorial_recommendations!tutorial_id(position, tutorials!recommended_id(id, title, kind, difficulty, toy_photo_url, status, maturity)), ' +
        'reviewer:reviewed_by(name), reviewed_for:reviewed_for_org_id(name)'
    )
    .eq('id', c.req.param('id'))
    .eq('status', 'approved')
    .order('position', { referencedTable: 'tutorial_recommendations', ascending: true })
    .single()
  if (error) return c.json({ error: error.message }, 404)
  // Filter the embed here rather than in the select: PostgREST cannot constrain an
  // embedded relation's rows from the parent query, and an organisation's mark must
  // never appear on a request it did not accept. This route uses the admin client,
  // so the public RLS badge policy is not doing it for us.
  //
  // Recommendations get the same treatment for the same reason, with one more:
  // a creator may point at a tutorial that is still in review, or that has since
  // gone back into review, and the public page must not show a door a parent
  // cannot open. Dropping the row is the whole design — there is no "not yet
  // approved" page to send them to.
  const tutorial = data as unknown as Record<string, unknown> & {
    tutorial_orgs?: Array<{ status: string }>
    tutorial_recommendations?: Array<{ tutorials: { status: string } | null }>
  }
  return c.json({
    ...tutorial,
    tutorial_orgs: (tutorial.tutorial_orgs ?? []).filter((b) => b.status === 'accepted'),
    tutorial_recommendations: (tutorial.tutorial_recommendations ?? []).filter(
      (r) => r.tutorials?.status === 'approved'
    ),
  })
})

publicRoutes.get('/toys', async (c) => {
  const supabase = createAnonClient()
  const { data, error } = await supabase
    .from('toys')
    // profiles(name) is a many-to-one embed via owner_id, so PostgREST
    // returns a single object per row, not an array. organizations(name) is the
    // same shape via owner_org_id, and exactly one of the two is ever present.
    .select('*, profiles(name), organizations(name)')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  const unavailable = await atCapacityToyIds(createAdminClient(), null, true)
  if (unavailable === null) return c.json({ error: 'Failed to load toys' }, 500)
  const hidden = new Set(unavailable)
  return c.json((data ?? []).filter((t) => !hidden.has(t.id)))
})

publicRoutes.get('/toys/:id', async (c) => {
  const supabase = createAnonClient()
  const { data, error } = await supabase
    .from('toys')
    .select('*, profiles(name), organizations(name)')
    .eq('id', c.req.param('id'))
    .eq('status', 'published')
    .single()
  // 404 for both "no such row" and "draft row" — an unpublished toy must not
  // be distinguishable from a nonexistent one to an unauthenticated caller,
  // same reasoning as the tutorial detail route above.
  if (error) return c.json({ error: error.message }, 404)
  const unavailable = await atCapacityToyIds(createAdminClient(), null, true)
  if (unavailable === null) return c.json({ error: 'Failed to load toys' }, 500)
  const hidden = new Set(unavailable)
  if (hidden.has(data.id)) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

/**
 * Public impact aggregate for the contribution showcase.
 *
 * Ruling B: toy_transactions has no anon SELECT policy, so "delivered" handoffs
 * (status='completed') are read via the admin client, and only the columns
 * needed to attribute a count to a giver — never requester/messages/pickup.
 *
 * Ruling D: opt-out is application-layer, not RLS. profiles are resolved (name
 * + public_showcase) via the admin client, keyed off the ids this aggregate
 * already touched, and only public_showcase === true people survive into the
 * response. There is no profiles RLS policy doing this for us on purpose (see
 * migration 034) — the same anon-read grant that lets a contributor's name
 * ride along on an approved tutorial must keep working for opted-out people
 * too, so the gate has to live here instead.
 */
publicRoutes.get('/impact', async (c) => {
  const sb = createAnonClient()
  const admin = createAdminClient()

  const [
    { data: tutorials, error: tutorialsError },
    { data: contribs, error: contribsError },
    { data: toys, error: toysError },
    { data: delivered, error: deliveredError },
    { data: backing, error: backingError },
    { data: orgs, error: orgsError },
  ] = await Promise.all([
    sb
      .from('tutorials')
      .select('id, created_at, reviewed_at, reviewed_for_org_id')
      .eq('status', 'approved'),
    sb
      .from('tutorial_contributors')
      .select('tutorial_id, profile_id, added_at, tutorials!inner(status)')
      .eq('tutorials.status', 'approved'),
    sb
      .from('toys')
      .select('id, owner_id, owner_org_id, created_at')
      .eq('status', 'published'),
    // Ruling B: admin client, restricted columns only — counts a completed
    // handoff toward its giver, never the counterparty or any message/pickup detail.
    admin
      .from('toy_transactions')
      .select('toy_id, owner_id, owner_org_id, updated_at')
      .eq('status', 'completed'),
    sb
      .from('tutorial_orgs')
      .select('tutorial_id, org_id, responded_at, requested_at')
      .eq('status', 'accepted'),
    sb.from('organizations').select('id, name, status'),
  ])
  if (
    tutorialsError ||
    contribsError ||
    toysError ||
    deliveredError ||
    backingError ||
    orgsError
  ) {
    return c.json({ error: 'Failed to load impact data' }, 500)
  }

  type Counts = { tutorials: number; toysShared: number; toysDelivered: number }
  const personCounts = new Map<string, Counts>()
  const orgCounts = new Map<string, Counts & { projectsBacked: number }>()
  const person = (id: string): Counts => {
    let e = personCounts.get(id)
    if (!e) {
      e = { tutorials: 0, toysShared: 0, toysDelivered: 0 }
      personCounts.set(id, e)
    }
    return e
  }
  const org = (id: string): Counts & { projectsBacked: number } => {
    let e = orgCounts.get(id)
    if (!e) {
      e = { tutorials: 0, toysShared: 0, toysDelivered: 0, projectsBacked: 0 }
      orgCounts.set(id, e)
    }
    return e
  }

  // Recency events, one per contribution row: [kind, id, at].
  const events: Array<{ kind: 'person' | 'org'; id: string; at: string }> = []

  // Person tutorial credit: any tutorial_contributors row (any role) on an
  // approved tutorial. Distinct per (profile, tutorial) by construction — the
  // table's primary key is (tutorial_id, profile_id).
  for (const row of (contribs ?? []) as Array<{
    tutorial_id: string
    profile_id: string
    added_at: string
  }>) {
    person(row.profile_id).tutorials += 1
    events.push({ kind: 'person', id: row.profile_id, at: row.added_at })
  }

  // Org tutorial credit: the organisation the approving leader acted for.
  for (const t of (tutorials ?? []) as Array<{
    id: string
    created_at: string
    reviewed_at: string | null
    reviewed_for_org_id: string | null
  }>) {
    if (t.reviewed_for_org_id) {
      org(t.reviewed_for_org_id).tutorials += 1
      events.push({ kind: 'org', id: t.reviewed_for_org_id, at: t.reviewed_at ?? t.created_at })
    }
  }

  // toysShared: published toys, grouped by owner.
  for (const toy of (toys ?? []) as Array<{
    id: string
    owner_id: string | null
    owner_org_id: string | null
    created_at: string
  }>) {
    if (toy.owner_id) {
      person(toy.owner_id).toysShared += 1
      events.push({ kind: 'person', id: toy.owner_id, at: toy.created_at })
    } else if (toy.owner_org_id) {
      org(toy.owner_org_id).toysShared += 1
      events.push({ kind: 'org', id: toy.owner_org_id, at: toy.created_at })
    }
  }

  // toysDelivered: completed handoffs, grouped by giver (owner_id/owner_org_id).
  for (const tx of (delivered ?? []) as Array<{
    toy_id: string
    owner_id: string | null
    owner_org_id: string | null
    updated_at: string
  }>) {
    if (tx.owner_id) {
      person(tx.owner_id).toysDelivered += 1
      events.push({ kind: 'person', id: tx.owner_id, at: tx.updated_at })
    } else if (tx.owner_org_id) {
      org(tx.owner_org_id).toysDelivered += 1
      events.push({ kind: 'org', id: tx.owner_org_id, at: tx.updated_at })
    }
  }

  // projectsBacked: accepted tutorial_orgs on approved tutorials (the RLS
  // policy backing this query already restricts to accepted + approved).
  for (const b of (backing ?? []) as Array<{
    tutorial_id: string
    org_id: string
    responded_at: string | null
    requested_at: string
  }>) {
    org(b.org_id).projectsBacked += 1
    events.push({ kind: 'org', id: b.org_id, at: b.responded_at ?? b.requested_at })
  }

  // Ruling D: resolve names AND opt-out via the admin client, then filter —
  // profiles never get a general anon-read policy, and this is the one place
  // that enforces public_showcase.
  const personIds = [...personCounts.keys()]
  let people: Array<{ id: string; name: string; public_showcase: boolean }> = []
  if (personIds.length > 0) {
    // Chunked: every approved contributor lands in this list, and .in() dies
    // with "URI too long" a few hundred uuids in. See src/chunk.ts.
    const results = await Promise.all(
      chunk(personIds).map((ids) =>
        admin.from('profiles').select('id, name, public_showcase').in('id', ids)
      )
    )
    if (results.some((r) => r.error)) return c.json({ error: 'Failed to load impact data' }, 500)
    people = results.flatMap((r) => r.data ?? [])
  }
  const showcased = new Map(
    people.filter((p) => p.public_showcase === true).map((p) => [p.id, p.name])
  )

  const orgNames = new Map(
    ((orgs ?? []) as Array<{ id: string; name: string; status: string }>).map((o) => [
      o.id,
      o.name,
    ])
  )

  const contributors: ImpactEntity[] = [...personCounts.entries()]
    .filter(([id, counts]) => showcased.has(id) && counts.tutorials + counts.toysShared + counts.toysDelivered > 0)
    .map(([id, counts]) => ({ id, name: showcased.get(id)!, ...counts }))

  const organisations: ImpactOrgEntity[] = [...orgCounts.entries()]
    .filter(
      ([, counts]) =>
        counts.tutorials + counts.toysShared + counts.toysDelivered + counts.projectsBacked > 0
    )
    .map(([id, counts]) => ({ id, name: orgNames.get(id) ?? '', ...counts }))

  const includedPeople = new Set(contributors.map((p) => p.id))
  const includedOrgs = new Set(organisations.map((o) => o.id))
  const nameOf = (kind: 'person' | 'org', id: string) =>
    kind === 'person' ? showcased.get(id) : orgNames.get(id)

  const seen = new Set<string>()
  const recent: ImpactRecent[] = events
    .filter((e) => (e.kind === 'person' ? includedPeople.has(e.id) : includedOrgs.has(e.id)))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .filter((e) => {
      const key = `${e.kind}:${e.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 8)
    .map((e) => ({ kind: e.kind, id: e.id, name: nameOf(e.kind, e.id) ?? '', at: e.at }))

  const summary: ImpactSummary = {
    totals: {
      tutorials: (tutorials ?? []).length,
      toysShared: (toys ?? []).length,
      toysDelivered: (delivered ?? []).length,
      contributors: contributors.length,
      organisations: organisations.length,
    },
    recent,
    contributors,
    organisations,
  }
  return c.json(summary)
})

/**
 * The organisations directory, for logged-out visitors.
 *
 * Separate from GET /api/organizations rather than an auth-state branch inside
 * it: that handler returns org_leaders (user ids), and one handler emitting both
 * public and privileged output is where object-level authorisation bugs hide.
 * The select below is hand-written so it cannot inherit a column added later.
 *
 * Suspended organisations stay listed and marked, not hidden: see the doc
 * comment on packages/web/app/organizations/page.tsx.
 */
publicRoutes.get('/organizations', async (c) => {
  const supabase = createAnonClient()
  const { data, error } = await supabase
    .from('organizations')
    // The recycling columns join the list because /get-involved/recycling and
    // its booking form both filter on "who can take what" — the alternative was
    // a fetch per organisation to answer a question the directory already knows.
    // All four are public by design and granted in 059; the street address is
    // not among them and stays on the pickup columns.
    .select('id, name, description, status, suburb, state, recycling_materials, recycling_note')
    .order('name')

  if (error) {
    console.error('[public/organizations] read failed:', error.message)
    return c.json([], 200)
  }
  return c.json(data ?? [])
})

/**
 * A single contributor's public profile for the showcase.
 *
 * Ruling D: opt-out is application-layer. The profile is read via the admin
 * client (name + public_showcase); 404 for no such profile or public_showcase
 * === false, same as the impact endpoint's gate but per-person instead of a
 * batch filter.
 *
 * Ruling B: "toys delivered" is completed handoffs, which have no anon SELECT
 * policy on toy_transactions — read via the admin client, restricted columns
 * only (never requester/messages/pickup). A delivered toy also stops being
 * 'published' once ownership transfers (see routes/toy-transactions.ts), so
 * the anon toys RLS policy can no longer see it either — its row is fetched
 * via the admin client too. Tutorials credited and toys currently shared are
 * still public via the anon client, same as the list/detail routes above.
 *
 * 404 for zero public contributions, indistinguishable from a nonexistent or
 * opted-out person — same reasoning as the toy/tutorial detail routes.
 */
publicRoutes.get('/contributors/:id', async (c) => {
  const sb = createAnonClient()
  const admin = createAdminClient()
  const id = c.req.param('id')

  const { data: profile } = await admin
    .from('profiles')
    .select('id, name, public_showcase')
    .eq('id', id)
    .maybeSingle()
  if (!profile || !profile.public_showcase) return c.json({ error: 'Not found' }, 404)

  const [
    { data: contribRows, error: tutorialsError },
    { data: toysShared, error: toysError },
    { data: deliveredTx, error: deliveredError },
  ] = await Promise.all([
    sb
      .from('tutorial_contributors')
      .select('tutorials!inner(*)')
      .eq('profile_id', id)
      .eq('tutorials.status', 'approved'),
    sb.from('toys').select('*').eq('owner_id', id).eq('status', 'published'),
    admin
      .from('toy_transactions')
      .select('toy_id, owner_id, updated_at')
      .eq('owner_id', id)
      .eq('status', 'completed'),
  ])
  if (tutorialsError || toysError || deliveredError) {
    return c.json({ error: 'Failed to load contributor profile' }, 500)
  }

  const tutorials = ((contribRows ?? []) as Array<{ tutorials: unknown }>).map((r) => r.tutorials)

  const deliveredToyIds = [...new Set((deliveredTx ?? []).map((tx) => tx.toy_id))]
  let toysDelivered: unknown[] = []
  if (deliveredToyIds.length > 0) {
    const results = await Promise.all(
      chunk(deliveredToyIds).map((ids) => admin.from('toys').select('*').in('id', ids))
    )
    const data = results.flatMap((r) => r.data ?? [])
    const error = results.find((r) => r.error)?.error
    if (error) return c.json({ error: 'Failed to load contributor profile' }, 500)
    toysDelivered = data ?? []
  }

  if (tutorials.length === 0 && (toysShared ?? []).length === 0 && toysDelivered.length === 0) {
    return c.json({ error: 'Not found' }, 404)
  }

  const result: ContributorProfile = {
    id: profile.id,
    name: profile.name,
    tutorials: tutorials as ContributorProfile['tutorials'],
    toysShared: (toysShared ?? []) as ContributorProfile['toysShared'],
    toysDelivered: toysDelivered as ContributorProfile['toysDelivered'],
  }
  return c.json(result)
})

/**
 * An organisation's public profile for the showcase.
 *
 * Dedicated public projection: organizations is hand-selected to `id, name,
 * status` only — never select('*'), which is how org_leaders/agreements/email/
 * pickup_* would leak. Unlike a person's opt-out, a SUSPENDED org that has
 * contributed still shows, marked — suspension is not an opt-out.
 *
 * Ruling B: "toys delivered" is completed handoffs given by this org, which
 * have no anon SELECT policy on toy_transactions — read via the admin client,
 * restricted columns only. A delivered toy also stops being 'published' once
 * ownership transfers, so its row is fetched via the admin client too.
 * Tutorials backed/approved and toys currently shared are still public via
 * the anon client, same as the other public routes above.
 *
 * 404 for an unknown org only. Zero contributions across all four collections
 * used to 404 as well, so that such an org read as nonexistent — but GET
 * /api/public/organizations lists every org by id and name, so that hid
 * nothing a caller could not already read, while making each one a dead link
 * from the Organisations page that links to this route. An org with nothing
 * yet now returns its empty collections, which is what the page's own "No
 * tutorials yet." and "No toys yet." states were written for.
 */
/**
 * A maker who can be asked for a build: their name, and nothing else.
 *
 * Deliberately not `/contributors/:id`, which 404s on zero public
 * contributions — right for a showcase profile, wrong here, because somebody
 * who has never published a guide can still be asked to build one. The gate is
 * the same one 057's build endpoint applies: `public_showcase`, which 034 made
 * opt-OUT, so this is "has not asked to be left alone".
 *
 * 404 covers both no such account and opted out, for the same reason the
 * contributor route gives: distinguishing them would make this an
 * account-existence oracle.
 */
publicRoutes.get('/makers/:id', async (c) => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('id, name, public_showcase')
    .eq('id', c.req.param('id'))
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: error.message }, 500)
  }
  const row = data as { id: string; name: string; public_showcase: boolean } | null
  if (!row || !row.public_showcase) return c.json({ error: 'Not found' }, 404)
  return c.json({ id: row.id, name: row.name })
})

publicRoutes.get('/organizations/:id', async (c) => {
  const sb = createAnonClient()
  const admin = createAdminClient()
  const id = c.req.param('id')

  const { data: org } = await sb
    .from('organizations')
    // 059's profile fields. Public by design and granted in that migration —
    // the street address is NOT among them and stays on the pickup columns.
    .select(
      'id, name, status, description, about, suburb, state, capabilities, contact_email, contact_phone, website_url, rate_note, recycling_materials, recycling_note'
    )
    .eq('id', id)
    .maybeSingle()
  if (!org) return c.json({ error: 'Not found' }, 404)

  const [
    { data: backedRows, error: backedError },
    { data: tutorialsApproved, error: approvedError },
    { data: toysShared, error: toysError },
    { data: deliveredTx, error: deliveredError },
  ] = await Promise.all([
    sb
      .from('tutorial_orgs')
      .select('tutorials!inner(*)')
      .eq('org_id', id)
      .eq('status', 'accepted')
      .eq('tutorials.status', 'approved'),
    sb.from('tutorials').select('*').eq('reviewed_for_org_id', id).eq('status', 'approved'),
    sb
      .from('toys')
      .select('*')
      .eq('owner_org_id', id)
      .eq('status', 'published'),
    admin
      .from('toy_transactions')
      .select('toy_id, owner_org_id, updated_at')
      .eq('owner_org_id', id)
      .eq('status', 'completed'),
  ])

  /*
   * What the organisation has published (059). The anon client reads these, so
   * the "published rows are public" policy is what admits them and a draft is
   * never returned here — the leader's own view of their drafts comes through
   * the authenticated route instead.
   *
   * An online event's joining link is stripped: "online links are never
   * public" is the artboard's rule, and returning it here would publish it to
   * anyone who opens the profile.
   */
  const [{ data: events }, { data: stories }] = await Promise.all([
    sb
      .from('org_events')
      .select('id, org_id, title, summary, starts_at, ends_at, format, location, audience, status')
      .eq('org_id', id)
      .eq('status', 'published')
      .order('starts_at', { ascending: false }),
    sb
      .from('org_stories')
      .select('id, org_id, kind, title, summary, byline, status, created_at')
      .eq('org_id', id)
      .eq('status', 'published')
      .order('created_at', { ascending: false }),
  ])
  if (backedError || approvedError || toysError || deliveredError) {
    return c.json({ error: 'Failed to load organisation profile' }, 500)
  }

  const tutorialsBacked = ((backedRows ?? []) as Array<{ tutorials: unknown }>).map(
    (r) => r.tutorials
  )

  const deliveredToyIds = [...new Set((deliveredTx ?? []).map((tx) => tx.toy_id))]
  let toysDelivered: unknown[] = []
  if (deliveredToyIds.length > 0) {
    const results = await Promise.all(
      chunk(deliveredToyIds).map((ids) => admin.from('toys').select('*').in('id', ids))
    )
    const data = results.flatMap((r) => r.data ?? [])
    const error = results.find((r) => r.error)?.error
    if (error) return c.json({ error: 'Failed to load organisation profile' }, 500)
    toysDelivered = data ?? []
  }

  const result: OrgPublicProfile = {
    ...org,
    id: org.id,
    name: org.name,
    status: org.status,
    events: (events ?? []) as OrgPublicProfile['events'],
    stories: (stories ?? []) as OrgPublicProfile['stories'],
    tutorialsBacked: tutorialsBacked as OrgPublicProfile['tutorialsBacked'],
    tutorialsApproved: (tutorialsApproved ?? []) as OrgPublicProfile['tutorialsApproved'],
    toysShared: (toysShared ?? []) as OrgPublicProfile['toysShared'],
    toysDelivered: toysDelivered as OrgPublicProfile['toysDelivered'],
  }
  return c.json(result)
})

/**
 * Published design challenges for the anonymous listing page.
 *
 * Anon has no token to build a client from, so this reads via the admin
 * client — authorisation is the explicit status filter below, not RLS. A
 * pending or rejected idea must never appear: these rows can hold a parent's
 * free-text description of a specific disabled child's needs, unreviewed.
 */
publicRoutes.get('/challenges', async (c) => {
  const { data, error } = await createAdminClient()
    .from('toy_ideas')
    .select('id, title, summary, contact_prefs, status, created_at')
    .in('status', ['challenge', 'graduated'])
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})

/**
 * A single challenge's public brief. Participants are joined with their
 * name so the web UI can render senders without a wider profiles RLS grant.
 *
 * Never returns `messages` — the brief recruits; the conversation stays
 * private even on a public challenge. A pending/rejected idea 404s rather
 * than 403ing: indistinguishable from one that never existed.
 */
publicRoutes.get('/challenges/:id', async (c) => {
  const admin = createAdminClient()
  // Explicit columns, never select('*'). review_note holds an admin's private
  // rejection reasoning — 037 says of it "Never shown publicly" — and a '*'
  // select plus `...rest` spread puts it straight on the wire for anonymous
  // callers. An explicit list is fail-closed: a future private column has to be
  // deliberately added here to be exposed, rather than leaking the day it lands.
  const { data: idea, error } = await admin
    .from('toy_ideas')
    .select(
      'id, author_id, title, summary, description, intended_use, primary_user, contact_prefs, status, tutorial_id, created_at, updated_at, profiles!toy_ideas_author_id_fkey(name)'
    )
    .eq('id', c.req.param('id'))
    .in('status', ['challenge', 'graduated'])
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  // A pending or rejected idea is indistinguishable from one that never existed.
  if (!idea) return c.json({ error: 'Not found' }, 404)

  const { data: participants, error: participantsError } = await admin
    .from('toy_idea_participants')
    // The FK is named explicitly because 042 added removed_by, a SECOND
    // reference from this table to profiles. A bare profiles(name) has been
    // ambiguous ever since — PostgREST answers "more than one relationship was
    // found" with a 500, which this route hands to web's challenge detail page
    // as a notFound(). Every public challenge brief was unreachable.
    .select('idea_id, profile_id, joined_at, profiles!toy_idea_participants_profile_id_fkey(name)')
    .eq('idea_id', idea.id)
    // Reads via the admin client, so RLS is not what keeps a removed person
    // off this public list -- this filter is. Without it a removed person
    // stays listed on the very challenge that excluded them.
    .is('removed_at', null)
  if (participantsError) return c.json({ error: participantsError.message }, 500)

  const { profiles, ...rest } = idea as Record<string, any>
  // Messages are deliberately absent: the brief recruits, the conversation is private.
  return c.json({
    ...rest,
    author_name: profiles?.name ?? null,
    participants: (participants ?? []).map((p: any) => ({
      idea_id: p.idea_id, profile_id: p.profile_id, joined_at: p.joined_at,
      name: p.profiles?.name ?? null,
    })),
  })
})

/**
 * Interest registration from the nine remaining scaffold pages.
 *
 * The allowlist is the security boundary: without it feature_key is an open write
 * target for arbitrary strings. Keys mirror lib/public-nav.ts SCAFFOLD_KEYS — if
 * one is added there, add it here. That list is *derived* from the nav data
 * (every 'soon' child's featureKey); this Set is hand-written because this
 * package cannot import from packages/web. Nothing enforces the two staying in
 * step — a flip on one side and a forgotten edit here is silent, caught only by
 * reading both files. (design-challenges was exactly this: it flipped 'live' in
 * Task 13 and this Set still allowlisted the key until removed by hand.)
 */
const NOTIFY_FEATURE_KEYS = new Set([
  'ask-an-expert',
  'requests',
  'printing',
  'printing-parts',
  'news',
  'events',
  'map',
  'partners',
  'support',
])

/** Shape only. Deliverability is not our problem until we send something. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

publicRoutes.post('/notify', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Expected a JSON body' }, 400)
  }

  const { email, featureKey } = (body ?? {}) as { email?: unknown; featureKey?: unknown }

  // 254 is the RFC 5321 maximum. Without it EMAIL_RE matches a string of any
  // length, and there is no select policy on notify_signups to notice.
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email.trim())) {
    return c.json({ error: 'A valid email address is required' }, 400)
  }
  if (typeof featureKey !== 'string' || !NOTIFY_FEATURE_KEYS.has(featureKey)) {
    return c.json({ error: 'Unknown feature' }, 400)
  }

  const supabase = createAnonClient()
  const { error } = await supabase
    .from('notify_signups')
    .insert({ email: email.trim().toLowerCase(), feature_key: featureKey })

  // 23505 is unique_violation: already registered, which is a success from the
  // visitor's point of view. Distinguishing it would leak list membership.
  if (error && error.code !== '23505') {
    console.error('[public/notify] insert failed:', error.message)
    return c.json({ error: 'Could not register interest' }, 500)
  }

  return c.json({ ok: true })
})

/* ---------------------------------------------------------------- events --
 *
 * The public list and one event's detail. Both read through the ANON client,
 * so 059's "published rows are public" policy is the backstop behind each
 * query's own status filter.
 *
 * Two things never cross this boundary, and both are the artboard's own rules:
 * an online event's joining link ("online links are never public"), and
 * anything a registrant answered ("Answers are shown to leaders only"). What
 * IS public is the shape of the crowd — a count, and the initials on the
 * detail page's "Who is going" row.
 */

// One literal, not a concatenation: supabase-js infers the row type from the
// select string, and a `+` anywhere in it collapses every column to
// GenericStringError.
const EVENT_PUBLIC_COLUMNS =
  'id, org_id, kind, title, summary, starts_at, ends_at, format, location, suburb, state, audience, description, what_to_bring, tools, capacity, prints_parts, part_sets_max, accessibility_note, photo_urls, status, registrations_closed_at, cancelled_at, created_by, created_at, updated_at'

/** Live registrations per event, and whether the viewer is among them. */
async function goingCounts(eventIds: string[], viewerId: string | null) {
  if (eventIds.length === 0) return { counts: new Map<string, number>(), mine: new Set<string>() }
  // The admin client, because org_event_registrations is readable only by its
  // own author or the organisation's leaders — by design. A count is not a
  // disclosure, so it is computed here rather than made readable to everyone.
  const admin = createAdminClient()
  const { data } = await admin
    .from('org_event_registrations')
    .select('event_id, user_id')
    .in('event_id', eventIds)
    .is('cancelled_at', null)

  const counts = new Map<string, number>()
  const mine = new Set<string>()
  for (const r of data ?? []) {
    const id = r.event_id as string
    counts.set(id, (counts.get(id) ?? 0) + 1)
    if (viewerId && r.user_id === viewerId) mine.add(id)
  }
  return { counts, mine }
}

publicRoutes.get('/events', async (c) => {
  const sb = createAnonClient()
  const admin = createAdminClient()

  // `viewer` is a plain query parameter, not a session: these routes are
  // mounted before authMiddleware. It only ever decides whether a card reads
  // "I'm going" or "You're going", so a forged one reveals nothing — the
  // answers and the joining link are not in this response at any value of it.
  const viewer = c.req.query('viewer') ?? null

  let query = sb
    .from('org_events')
    .select(EVENT_PUBLIC_COLUMNS)
    .eq('status', 'published')
    .is('cancelled_at', null)
    .order('starts_at', { ascending: true })

  const format = c.req.query('format')
  if (format === 'in_person' || format === 'online') query = query.eq('format', format)

  // An online event shows under every state filter, which is the artboard's
  // rule and the reason this is an `or` rather than an equality.
  const state = c.req.query('state')
  if (state) query = query.or(`state.eq.${state},format.eq.online`)

  const { data: rows, error } = await query
  if (error) return c.json({ error: error.message }, 500)

  const events = rows ?? []
  const eventIds = events.map((e) => e.id as string)
  const orgIds = [...new Set(events.map((e) => e.org_id as string))]
  const [{ data: orgs }, { counts, mine }, { data: questionRows }] = await Promise.all([
    // Resolved through the admin client rather than an embed: embedding
    // organizations kills the whole query under 033/045's column grants, and
    // returns empty with no error.
    admin.from('organizations').select('id, name').in('id', orgIds),
    goingCounts(eventIds, viewer),
    // Which events ask something beyond name and email. The card needs this to
    // decide whether "I'm going" can be one tap or has to open the form — a
    // tap that silently skipped three required questions would put a family on
    // a list the host cannot use. Ids only; the questions themselves belong to
    // the detail route.
    sb.from('org_event_questions').select('event_id').in('event_id', eventIds),
  ])
  const orgName = new Map((orgs ?? []).map((o) => [o.id as string, o.name as string]))
  const asks = new Set((questionRows ?? []).map((q) => q.event_id as string))

  return c.json(
    events.map((e) => {
      const id = e.id as string
      const going = counts.get(id) ?? 0
      const capacity = e.capacity as number | null
      const { online_url: _dropped, ...rest } = e as Record<string, unknown>
      return {
        ...rest,
        org_name: orgName.get(e.org_id as string) ?? '',
        going_count: going,
        seats_left: capacity === null ? null : Math.max(0, capacity - going),
        viewer_going: mine.has(id),
        has_questions: asks.has(id),
      }
    }),
  )
})

publicRoutes.get('/events/:id', async (c) => {
  const sb = createAnonClient()
  const admin = createAdminClient()
  const id = c.req.param('id')
  const viewer = c.req.query('viewer') ?? null

  const { data: event, error } = await sb
    .from('org_events')
    .select(EVENT_PUBLIC_COLUMNS)
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle()
  if (error && error.code !== INVALID_TEXT_REPRESENTATION) {
    return c.json({ error: error.message }, 500)
  }
  if (!event) return c.json({ error: 'Not found' }, 404)

  const [{ data: org }, { data: questions }, { counts, mine }] = await Promise.all([
    admin
      .from('organizations')
      .select('id, name, description, suburb, state')
      .eq('id', event.org_id as string)
      .maybeSingle(),
    sb
      .from('org_event_questions')
      .select('id, event_id, position, prompt, answer_type, required, options')
      .eq('event_id', id)
      .order('position'),
    goingCounts([id], viewer),
  ])

  // Initials only. The artboard draws two avatars and a count on "Who is
  // going" — a name would tell anyone who opened the page which families
  // attend which therapy service.
  const { data: attendees } = await admin
    .from('org_event_registrations')
    .select('name')
    .eq('event_id', id)
    .is('cancelled_at', null)
    .order('created_at')
    .limit(8)

  const going = counts.get(id) ?? 0
  const capacity = event.capacity as number | null
  return c.json({
    ...event,
    // Never public, whatever the format. A registrant is given it after they
    // confirm, through the authenticated route.
    online_url: null,
    org: org ?? null,
    questions: questions ?? [],
    going_count: going,
    seats_left: capacity === null ? null : Math.max(0, capacity - going),
    viewer_going: mine.has(id),
    attendee_initials: (attendees ?? []).map((a) =>
      String(a.name)
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join(''),
    ),
  })
})

/* --------------------------------------------------------------- stories --
 *
 * The public reading surface. The anon client reads these, so 059's "published
 * rows are public" policy is the backstop behind each query's own status
 * filter, and a draft is never returned here.
 *
 * Read time is computed rather than stored: it is a property of the text, and a
 * stored copy is one more thing that can drift from the words it describes.
 */

const STORY_PUBLIC_COLUMNS =
  'id, org_id, kind, title, summary, body, byline, photo_urls, featured, pull_quote, pull_quote_by, link_tutorial_id, status, published_at, created_at, updated_at'

publicRoutes.get('/stories', async (c) => {
  const sb = createAnonClient()
  const admin = createAdminClient()

  const { data: rows, error } = await sb
    .from('org_stories')
    .select(STORY_PUBLIC_COLUMNS)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)

  const stories = rows ?? []
  // Through the admin client rather than an embed: embedding organizations
  // kills the whole query under 033/045's column grants and returns empty with
  // no error.
  const orgIds = [...new Set(stories.map((s) => s.org_id).filter((id): id is string => !!id))]
  const { data: orgs } = await admin.from('organizations').select('id, name').in('id', orgIds)
  const orgName = new Map((orgs ?? []).map((o) => [o.id as string, o.name as string]))

  return c.json(
    stories.map((s) => ({
      ...s,
      org_name: s.org_id ? (orgName.get(s.org_id as string) ?? null) : null,
      read_minutes: readMinutes(String(s.body ?? '')),
    })),
  )
})

publicRoutes.get('/stories/:id', async (c) => {
  const sb = createAnonClient()
  const admin = createAdminClient()
  const id = c.req.param('id')

  const { data: story, error } = await sb
    .from('org_stories')
    .select(STORY_PUBLIC_COLUMNS)
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle()
  if (error && error.code !== INVALID_TEXT_REPRESENTATION) {
    return c.json({ error: error.message }, 500)
  }
  if (!story) return c.json({ error: 'Not found' }, 404)

  const [{ data: org }, { data: tutorial }, { data: more }] = await Promise.all([
    story.org_id
      ? admin.from('organizations').select('id, name').eq('id', story.org_id as string).maybeSingle()
      : Promise.resolve({ data: null }),
    story.link_tutorial_id
      ? // The guide has to still be approved. A story linking to a withdrawn
        // guide would send a reader to a 404 from a page that reads as current.
        sb
          .from('tutorials')
          .select('id, title, status')
          .eq('id', story.link_tutorial_id as string)
          .eq('status', 'approved')
          .maybeSingle()
      : Promise.resolve({ data: null }),
    sb
      .from('org_stories')
      .select('id, kind, title, byline, published_at')
      .eq('status', 'published')
      .neq('id', id)
      .order('published_at', { ascending: false })
      .limit(3),
  ])

  return c.json({
    ...story,
    org: org ?? null,
    link_tutorial: tutorial ? { id: tutorial.id, title: tutorial.title } : null,
    org_name: (org as { name?: string } | null)?.name ?? null,
    read_minutes: readMinutes(String(story.body ?? '')),
    more: more ?? [],
  })
})

export default publicRoutes
