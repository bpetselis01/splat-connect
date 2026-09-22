/**
 * Records the parity users own, so dashboard detail screens have something to
 * be a detail OF.
 *
 * The public detail screens resolve by scraping a list page — there is plenty
 * of seeded data already and a scraped link is guaranteed reachable. The
 * dashboard ones cannot: a parity user is created fresh each run, so their
 * exchanges, print jobs and events are empty and the list page has no links to
 * scrape. Those get seeded here, against the user provisioned for that role.
 *
 * Everything is best-effort. A screen whose fixture fails is reported as
 * unmeasured, which is honest; throwing here would take the other 114 screens
 * down with it.
 */

/** A toy transaction the parent is part of — /dashboard/exchanges/[id]. */
async function seedExchange(db, parentId) {
  const { data: toy } = await db
    .from('toys')
    .select('id, owner_id')
    .eq('status', 'published')
    .neq('owner_id', parentId)
    .limit(1)
    .single()
  if (!toy) return null
  const { data, error } = await db
    .from('toy_transactions')
    .insert({
      toy_id: toy.id,
      owner_id: toy.owner_id,
      requester_id: parentId,
      type: 'donation',
      status: 'accepted',
    })
    .select('id')
    .single()
  return error ? null : data.id
}

/**
 * A print-type transaction the parent requested — /dashboard/print-requests/[id].
 *
 * toy_transactions is polymorphic across donation | exchange | build | print,
 * so the print-requests screen and the exchanges screen read the same table and
 * differ only by `type`. An arbitrary row 404s: the API scopes to the signed-in
 * user and the screen filters on the type.
 */
async function seedPrintRequest(db, parentId) {
  // toy_transactions_one_owner demands exactly one of owner_id/owner_org_id
  // (the sole exception being a build still at 'requested'), so the row has to
  // hang off a real printer rather than be left ownerless.
  const { data: printer } = await db
    .from('printers')
    .select('id, owner_id, owner_org_id')
    .not('owner_id', 'is', null)
    .limit(1)
    .maybeSingle()
  if (!printer) return null
  // toy_transactions_subject requires a print to name the guide its parts come
  // from — "parts come from the guide, never uploaded" enforced in the schema.
  const { data: tut } = await db
    .from('tutorials')
    .select('id')
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle()
  if (!tut) return null
  const { data, error } = await db
    .from('toy_transactions')
    .insert({
      requester_id: parentId,
      owner_id: printer.owner_id,
      printer_id: printer.id,
      tutorial_id: tut.id,
      type: 'print',
      status: 'requested',
    })
    .select('id')
    .single()
  return error ? null : data.id
}

/** A tutorial the contributor owns — /tutorials/[id]/edit. */
async function seedOwnedTutorial(db, contributorId) {
  const { data, error } = await db
    .from('tutorials')
    .insert({
      title: 'Parity fixture guide',
      description: 'Seeded so the editor screen has a guide to edit.',
      difficulty: 'easy',
      status: 'draft',
    })
    .select('id')
    .single()
  if (error) return null
  const { error: cErr } = await db
    .from('tutorial_contributors')
    .insert({ tutorial_id: data.id, profile_id: contributorId, role: 'primary' })
  return cErr ? null : data.id
}

/** An event on the leader's organisation — /dashboard/org/events/[id]. */
async function seedOrgEvent(db, leaderId, orgId) {
  if (!orgId) return null
  const starts = new Date(Date.now() + 14 * 86400000).toISOString()
  const { data, error } = await db
    .from('org_events')
    .insert({
      org_id: orgId,
      title: 'Parity fixture build day',
      summary: 'Seeded so the manage-event screen has an event to manage.',
      starts_at: starts,
      format: 'in_person',
      // A published in-person event is required by check constraint to carry
      // all three of these; without them the insert is rejected and the screen
      // goes unmeasured.
      location: 'Parity Hall, 1 Test Street',
      suburb: 'Newtown',
      state: 'NSW',
      status: 'published',
      created_by: leaderId,
    })
    .select('id')
    .single()
  return error ? null : data.id
}

/**
 * A toy the parent owns — /dashboard/toys/[id].
 *
 * Without one, /dashboard/toys links only to /dashboard/toys/new and the
 * harness compared the board's toy DETAIL screen against live's add-a-toy form.
 *
 * Not cover_photo_url: 053 made it generated from photo_urls, and an insert
 * naming a generated column is rejected outright.
 */
async function seedOwnedToy(db, parentId) {
  const { data, error } = await db
    .from('toys')
    .insert({
      owner_id: parentId,
      name: 'Parity fixture toy',
      condition: 8,
      photo_urls: [],
      status: 'published',
      offer_type: 'donation',
    })
    .select('id')
    .single()
  return error ? null : data.id
}

/** A child on the parent — /dashboard/child/[id]. */
async function seedChild(db, parentId) {
  const { data, error } = await db
    .from('child_profiles')
    .insert({ parent_id: parentId, age: 7 })
    .select('id')
    .single()
  return error ? null : data.id
}

/**
 * One of each saveable thing on the parent, plus an idea of their own and a
 * joined challenge — without them /dashboard/saved/* and /dashboard/challenges
 * render their empty states and the board's cards are never compared. Picks
 * existing public rows; nothing here is created except the parent's own rows,
 * which cascade away with the user.
 */
async function seedSavesAndIdeas(db, parentId) {
  const first = async (table, filter) => {
    const { data } = await filter(db.from(table).select('id')).limit(1)
    return data?.[0]?.id ?? null
  }
  const picks = {
    tutorial: await first('tutorials', (q) => q.eq('status', 'approved')),
    toy: await first('toys', (q) => q.eq('status', 'published').neq('owner_id', parentId)),
    challenge: await first('toy_ideas', (q) => q.eq('status', 'challenge')),
    organisation: await first('organizations', (q) => q.eq('status', 'active')),
  }
  const rows = Object.entries(picks)
    .filter(([, id]) => id)
    .map(([entity_type, entity_id]) => ({ profile_id: parentId, entity_type, entity_id }))
  if (rows.length) await db.from('saves').insert(rows).then(() => {}, () => {})
  if (picks.challenge) {
    await db
      .from('toy_idea_participants')
      .insert({ idea_id: picks.challenge, profile_id: parentId })
      .then(() => {}, () => {})
  }
  await db
    .from('toy_ideas')
    .insert({
      author_id: parentId,
      title: 'Parity fixture idea',
      summary: 'A light box with three brightness steps.',
      description: 'Fixture.',
      intended_use: 'Fixture.',
      primary_user: 'Fixture.',
    })
    .then(() => {}, () => {})
}

/**
 * Seed what the selected roles need. Returns { screenId: concreteRoute } for
 * screens the scraper cannot reach.
 */
async function seed(db, users) {
  const routes = {}
  const { parent, contributor, leader } = users

  if (parent) {
    const ex = await seedExchange(db, parent.id)
    if (ex) routes.thread = `/dashboard/exchanges/${ex}`
    const child = await seedChild(db, parent.id)
    if (child) routes.child = `/dashboard/child/${child}`
    const pj = await seedPrintRequest(db, parent.id)
    if (pj) routes.print_job = `/dashboard/print-requests/${pj}`
    const toy = await seedOwnedToy(db, parent.id)
    if (toy) routes.toy_detail = `/dashboard/toys/${toy}`
    await seedSavesAndIdeas(db, parent.id)
  }
  if (contributor) {
    const t = await seedOwnedTutorial(db, contributor.id)
    if (t) routes.editor = `/tutorials/${t}/edit`
  }
  if (leader) {
    const ev = await seedOrgEvent(db, leader.id, leader.orgId)
    if (ev) routes.org_event_manage = `/dashboard/org/events/${ev}`
  }
  return routes
}

/**
 * Last resort for a route nothing links to.
 *
 * /contributors/[id] is reachable by URL and orphaned in the UI — no page in
 * the app links to it — so there is no link to scrape and the screen would go
 * unmeasured forever. (That it is orphaned is worth knowing on its own.)
 */
const DB_SAMPLES = {
  // The endpoint 404s on zero public contributions, so a showcased profile is
  // not enough — it has to be one that actually has an approved guide.
  contributor: async (db) => {
    const { data } = await db
      .from('tutorial_contributors')
      .select('profile_id, tutorials!inner(status), profiles!inner(public_showcase)')
      .eq('tutorials.status', 'approved')
      .eq('profiles.public_showcase', true)
      .limit(1)
      .single()
    return data ? `/contributors/${data.profile_id}` : null
  },
}

async function dbSample(db, screenId) {
  const fn = DB_SAMPLES[screenId]
  if (!fn) return null
  try {
    return await fn(db)
  } catch {
    return null
  }
}

module.exports = { seed, dbSample }
