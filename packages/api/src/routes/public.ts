/**
 * Unauthenticated routes — mounted before authMiddleware. They use the anon
 * client, so RLS enforces status='approved'/'published' as a second, database-level
 * backstop behind each query's own explicit filter.
 */
import { Hono } from 'hono'
import { createAnonClient, createAdminClient } from '../supabase/client.js'
import type {
  ImpactSummary,
  ImpactEntity,
  ImpactOrgEntity,
  ImpactRecent,
  ContributorProfile,
  OrgPublicProfile,
} from '@splat-connect/types'

/**
 * Toys with nothing left to promise, and so nothing to show a browsing parent.
 *
 * This used to be "any toy with an accepted handoff", which was the same set
 * only while one row meant one object. An organisation holding five bears with
 * one handoff running still has four: hiding the card would empty the library
 * on the first request. So a toy is hidden when its accepted handoffs reach its
 * quantity — which also covers out of stock, since quantity 0 is at capacity by
 * definition.
 *
 * An offered exchange toy is hidden outright, unconditionally. It is one
 * person's single object, promised to someone, and quantity has no bearing.
 */
async function unavailableToyIds(): Promise<string[] | null> {
  const admin = createAdminClient()
  const [{ data: accepted, error }, { data: toys, error: toysError }] = await Promise.all([
    admin.from('toy_transactions').select('toy_id, offered_toy_id').eq('status', 'accepted'),
    admin.from('toys').select('id, quantity').eq('status', 'published').is('archived_at', null),
  ])
  if (error || toysError) return null

  const takenPerToy = new Map<string, number>()
  const hidden = new Set<string>()
  for (const row of accepted ?? []) {
    takenPerToy.set(row.toy_id, (takenPerToy.get(row.toy_id) ?? 0) + 1)
    if (row.offered_toy_id) hidden.add(row.offered_toy_id)
  }
  for (const toy of (toys ?? []) as Array<{ id: string; quantity: number }>) {
    if ((takenPerToy.get(toy.id) ?? 0) >= toy.quantity) hidden.add(toy.id)
  }
  return [...hidden]
}

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
    .select(
      '*, parts(*), tools(*), stl_files(*), tutorial_contributors(role, profiles(name)), ' +
        'tutorial_orgs(status, organizations(id, name)), ' +
        'reviewer:reviewed_by(name), reviewed_for:reviewed_for_org_id(name)'
    )
    .eq('id', c.req.param('id'))
    .eq('status', 'approved')
    .single()
  if (error) return c.json({ error: error.message }, 404)
  // Filter the embed here rather than in the select: PostgREST cannot constrain an
  // embedded relation's rows from the parent query, and an organisation's mark must
  // never appear on a request it did not accept. This route uses the admin client,
  // so the public RLS badge policy is not doing it for us.
  const tutorial = data as unknown as Record<string, unknown> & {
    tutorial_orgs?: Array<{ status: string }>
  }
  return c.json({
    ...tutorial,
    tutorial_orgs: (tutorial.tutorial_orgs ?? []).filter((b) => b.status === 'accepted'),
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
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  const unavailable = await unavailableToyIds()
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
    .is('archived_at', null)
    .single()
  // 404 for both "no such row" and "draft row" — an unpublished toy must not
  // be distinguishable from a nonexistent one to an unauthenticated caller,
  // same reasoning as the tutorial detail route above.
  if (error) return c.json({ error: error.message }, 404)
  const unavailable = await unavailableToyIds()
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
      .eq('status', 'published')
      .is('archived_at', null),
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

  // toysShared: published, non-archived toys, grouped by owner.
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
    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, name, public_showcase')
      .in('id', personIds)
    if (profilesError) return c.json({ error: 'Failed to load impact data' }, 500)
    people = profiles ?? []
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
    sb.from('toys').select('*').eq('owner_id', id).eq('status', 'published').is('archived_at', null),
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
    const { data, error } = await admin.from('toys').select('*').in('id', deliveredToyIds)
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
 * 404 for an unknown org or zero contributions across all four collections —
 * indistinguishable from a nonexistent org, same reasoning as the other
 * detail routes.
 */
publicRoutes.get('/organizations/:id', async (c) => {
  const sb = createAnonClient()
  const admin = createAdminClient()
  const id = c.req.param('id')

  const { data: org } = await sb
    .from('organizations')
    .select('id, name, status')
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
      .eq('status', 'published')
      .is('archived_at', null),
    admin
      .from('toy_transactions')
      .select('toy_id, owner_org_id, updated_at')
      .eq('owner_org_id', id)
      .eq('status', 'completed'),
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
    const { data, error } = await admin.from('toys').select('*').in('id', deliveredToyIds)
    if (error) return c.json({ error: 'Failed to load organisation profile' }, 500)
    toysDelivered = data ?? []
  }

  if (
    tutorialsBacked.length === 0 &&
    (tutorialsApproved ?? []).length === 0 &&
    (toysShared ?? []).length === 0 &&
    toysDelivered.length === 0
  ) {
    return c.json({ error: 'Not found' }, 404)
  }

  const result: OrgPublicProfile = {
    id: org.id,
    name: org.name,
    status: org.status,
    tutorialsBacked: tutorialsBacked as OrgPublicProfile['tutorialsBacked'],
    tutorialsApproved: (tutorialsApproved ?? []) as OrgPublicProfile['tutorialsApproved'],
    toysShared: (toysShared ?? []) as OrgPublicProfile['toysShared'],
    toysDelivered: toysDelivered as OrgPublicProfile['toysDelivered'],
  }
  return c.json(result)
})

export default publicRoutes
