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

/**
 * Rows that outlive the fixture users. A printer's and an event's print jobs
 * RESTRICT their parent's delete, a given-away toy belongs to its new holder,
 * a queued guide is not the leader's, and a recommendation hangs off a public
 * guide — none of them cascade with the accounts. Each seed that makes one
 * registers how to take it back, and run.js calls unseed() before cleanup().
 */
const undo = []
async function unseed(db) {
  for (const fn of undo.splice(0).reverse()) await fn(db).then(() => {}, () => {})
}

const firstId = async (db, table, filter = (q) => q) => {
  const { data } = await filter(db.from(table).select('id')).limit(1)
  return data?.[0]?.id ?? null
}
/** Any profile that is not this one — the counterparty a fixture needs. */
const someoneElse = (db, notId) =>
  firstId(db, 'profiles', (q) => q.neq('id', notId).not('name', 'is', null))
const approvedGuide = (db) => firstId(db, 'tutorials', (q) => q.eq('status', 'approved'))
const swallow = (q) => q.then(() => {}, () => {})

/** A toy transaction the parent is part of — /dashboard/exchanges/[id]. */
async function seedExchange(db, parentId) {
  const { data: toy } = await db
    .from('toys')
    .select('id, owner_id')
    .eq('status', 'published')
    .neq('owner_id', parentId)
    .not('owner_id', 'is', null)
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
      // Accepting sets the place; the agreed time is what the board's next-step
      // card leads with. Without it the card reads "Handover in Newcastle".
      pickup_line1: '12 Clinic Street',
      pickup_suburb: 'Newcastle',
      pickup_state: 'NSW',
      pickup_postcode: '2300',
      pickup_instructions: 'Thursday after three, Newcastle clinic',
    })
    .select('id')
    .single()
  return error ? null : { id: data.id, ownerId: toy.owner_id }
}

/** Postage the parent agreed to and has not settled — the hub's money panel. */
async function seedOutstandingCost(db, parentId, ex) {
  if (!ex) return
  await swallow(
    db.from('exchange_costs').insert({
      transaction_id: ex.id,
      description: 'Postage',
      amount_cents: 1250,
      payer_id: parentId,
      payee_id: ex.ownerId,
      created_by: ex.ownerId,
    })
  )
}

/** Seven cards, the board's count — /notifications. Cascade with the recipient. */
async function seedNotifications(db, parentId, txId) {
  const tutorial_id = await approvedGuide(db)
  // Every key on every row: a batched insert fills a key one row lacks with
  // null, past the column default, and tutorial_title is NOT NULL.
  const base = {
    recipient_id: parentId,
    actor_name: 'Parity counterpart',
    tutorial_id: null,
    tutorial_title: '',
    toy_transaction_id: null,
    toy_name: null,
  }
  const onToy = { toy_transaction_id: txId, toy_name: 'Parity fixture toy' }
  const onGuide = { tutorial_id, tutorial_title: 'Parity fixture guide' }
  const rows = [
    ...(txId ? ['toy_accepted', 'toy_message', 'toy_request'] : []).map((type) => ({ ...base, type, ...onToy })),
    ...(tutorial_id ? ['tutorial_approved', 'tutorial_thanked', 'collaborator_invited', 'backing_requested'] : []).map(
      (type) => ({ ...base, type, ...onGuide })
    ),
  ]
  // The board draws three unread and four read; all seven unread made the
  // modal card colour the unread tint and reported it against the board's white.
  const readAt = new Date(Date.now() - 3 * 86400000).toISOString()
  rows.slice(3).forEach((r) => (r.read_at = readAt))
  if (rows.length) await swallow(db.from('notifications').insert(rows))
}

/**
 * A handover the parent gave, both sides confirmed — /dashboard/toys "Given
 * away" and /dashboard/exchanges "History". Completion hands the toy to the
 * requester (routes/toy-transactions.ts transferToy), so it is inserted already
 * theirs and undone rather than left to cascade.
 */
async function seedGivenAway(db, parentId) {
  const taker = await someoneElse(db, parentId)
  if (!taker) return
  const { data: toy } = await db
    .from('toys')
    .insert({
      owner_id: taker,
      name: 'Parity fixture toy (given away)',
      condition: 7,
      photo_urls: [],
      status: 'draft',
      offer_type: 'donation',
    })
    .select('id')
    .single()
  if (!toy) return
  undo.push((d) => d.from('toys').delete().eq('id', toy.id))
  const at = new Date(Date.now() - 20 * 86400000).toISOString()
  await swallow(
    db.from('toy_transactions').insert({
      toy_id: toy.id,
      owner_id: parentId,
      requester_id: taker,
      type: 'donation',
      status: 'completed',
      owner_confirmed_at: at,
      requester_confirmed_at: at,
      updated_at: at,
    })
  )
}

/** A build a maker has claimed, with the parts they bought — /dashboard/exchanges/build/[id]. */
async function seedBuild(db, parentId) {
  const [maker, tutorial_id] = await Promise.all([someoneElse(db, parentId), approvedGuide(db)])
  if (!maker || !tutorial_id) return null
  const { data, error } = await db
    .from('toy_transactions')
    .insert({
      type: 'build',
      status: 'accepted',
      requester_id: parentId,
      owner_id: maker,
      tutorial_id,
      build_brief: 'A 100 mm button, standard 3.5 mm. Whenever suits.',
      child_label: 'Leo, 3',
      requester_suburb: 'Glebe',
    })
    .select('id')
    .single()
  if (error) return null
  await swallow(
    db.from('exchange_costs').insert({
      transaction_id: data.id,
      description: 'Parts they bought',
      amount_cents: 1800,
      payer_id: parentId,
      payee_id: maker,
      created_by: maker,
    })
  )
  return data.id
}

/**
 * Two guides waiting on the leader's organisation — /dashboard/organisation.
 * One asks it to back the guide, one is backed and submitted for review: the
 * two rows the queue merges. The leader is the contributor so RLS admits the
 * row through /api/tutorials' inner join; the guides are not theirs to
 * cascade, so they are undone.
 */
async function seedOrgQueue(db, leaderId, orgId) {
  if (!orgId) return
  const guides = [
    { title: 'Parity guide asking to be backed', status: 'draft', backing: 'pending' },
    { title: 'Parity guide submitted for review', status: 'pending', backing: 'accepted' },
  ]
  for (const g of guides) {
    const { data: t } = await db
      .from('tutorials')
      .insert({ title: g.title, description: 'Fixture.', difficulty: 'easy', status: g.status })
      .select('id')
      .single()
    if (!t) continue
    undo.push((d) => d.from('tutorials').delete().eq('id', t.id))
    await swallow(
      db.from('tutorial_contributors').insert({ tutorial_id: t.id, profile_id: leaderId, role: 'primary' })
    )
    await swallow(db.from('tutorial_orgs').insert({ tutorial_id: t.id, org_id: orgId, status: g.backing }))
  }
}

/**
 * A family asking the organisation for a toy off its shelf and for a build —
 * /dashboard/organisation/requests. Both cascade with the organisation.
 */
async function seedOrgRequests(db, familyId, orgId) {
  if (!orgId || !familyId) return
  const { data: toy } = await db
    .from('toys')
    .insert({
      owner_org_id: orgId,
      name: 'Parity org shelf toy',
      condition: 8,
      photo_urls: [],
      status: 'published',
      offer_type: 'donation',
      quantity: 3,
    })
    .select('id')
    .single()
  if (toy)
    await swallow(
      db.from('toy_transactions').insert({
        toy_id: toy.id,
        owner_org_id: orgId,
        requester_id: familyId,
        type: 'donation',
        status: 'requested',
        requester_suburb: 'Newtown',
      })
    )
  const tutorial_id = await approvedGuide(db)
  if (tutorial_id)
    await swallow(
      db.from('toy_transactions').insert({
        type: 'build',
        status: 'requested',
        requester_id: familyId,
        owner_org_id: orgId,
        tutorial_id,
        build_brief: 'Two families on our street would come.',
        requester_suburb: 'Lane Cove',
      })
    )
}

/**
 * A printer with a request waiting and a job on the bed — /dashboard/printers
 * for the parent's own machine, /dashboard/organisation/orders for the org's.
 * `owner` is { owner_id } or { owner_org_id }; it goes on the printer and on
 * each job. printer_id RESTRICTs, so jobs and printer are undone in that order.
 */
async function seedPrinterWithJobs(db, owner, requesterId) {
  const tutorial_id = await approvedGuide(db)
  if (!tutorial_id || !requesterId) return
  const { data: printer } = await db
    .from('printers')
    .insert({
      ...owner,
      name: 'Parity fixture printer',
      materials: ['PLA', 'PETG'],
      bed_x: 220,
      bed_y: 220,
      bed_z: 250,
      suburb: 'Newtown',
      state: 'NSW',
    })
    .select('id')
    .single()
  if (!printer) return
  undo.push(async (d) => {
    await d.from('toy_transactions').delete().eq('printer_id', printer.id)
    await d.from('printers').delete().eq('id', printer.id)
  })
  const job = (status, print_note) => ({
    ...owner,
    printer_id: printer.id,
    tutorial_id,
    requester_id: requesterId,
    type: 'print',
    status,
    print_note,
    requester_suburb: 'Ashfield',
    ...(status === 'accepted' ? { printing_started_at: new Date().toISOString() } : {}),
  })
  await swallow(
    // Three waiting, the board's count, and one on the bed.
    db.from('toy_transactions').insert([
      job('requested', 'For a cot rail — the round one, about 25 mm across.'),
      job('requested', 'Our old one snapped at the hinge. Same size is fine.'),
      job('requested', 'For a client trial on Thursday. Two sizes if you can manage it.'),
      job('accepted', null),
    ])
  )
}

/**
 * Families who chose "the host prints them" — the manage-event screen's "Parts
 * to print before the day". event_id RESTRICTs the event's (and so the org's)
 * delete, hence undone first.
 */
async function seedEventParts(db, eventId, orgId, requesterId) {
  const tutorial_id = await approvedGuide(db)
  if (!tutorial_id || !requesterId) return
  undo.push((d) => d.from('toy_transactions').delete().eq('event_id', eventId))
  const req = (part_sets, child_label, requester_suburb, print_note) => ({
    type: 'print',
    status: 'requested',
    requester_id: requesterId,
    owner_org_id: orgId,
    tutorial_id,
    event_id: eventId,
    part_sets,
    child_label,
    requester_suburb,
    print_note,
  })
  await swallow(
    db.from('toy_transactions').insert([
      req(3, 'Leo, 3', 'Newtown', 'Cot-rail version if you have it.'),
      req(2, 'Mia, 5', 'Crows Nest', null),
    ])
  )
}

/** Two boxes booked in — /dashboard/organisation/recycling "Booked in (2)". Cascade with the org. */
async function seedDropoffs(db, orgId, contributorId) {
  if (!orgId || !contributorId) return
  await swallow(
    db.from('recycling_dropoffs').insert([
      { org_id: orgId, contributor_id: contributorId, material: 'PLA', estimated_grams: 800, note: 'Failed prints, sorted by colour.' },
      { org_id: orgId, contributor_id: contributorId, material: 'PETG', estimated_grams: 350 },
    ])
  )
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
      // The host prints parts, so the manage screen draws "Parts to print
      // before the day" — the board's second section. The cap is required by
      // check constraint alongside the flag.
      prints_parts: true,
      part_sets_max: 10,
    })
    .select('id')
    .single()
  if (error) return null
  // And one already over. Without it every seeded event is in the future, so
  // /get-involved/events never draws the board's "Past events (n)" disclosure
  // or a second month heading, and both were reported missing on a page that
  // has the code for them.
  await db.from('org_events').insert({
    org_id: orgId,
    title: 'Parity fixture build day (past)',
    summary: 'Seeded so the events list has something to fold into Past events.',
    starts_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    format: 'in_person',
    location: 'Parity Hall, 1 Test Street',
    suburb: 'Newtown',
    state: 'NSW',
    status: 'published',
    created_by: leaderId,
  })
  return data.id
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
      // 'both' so /toy-library/[id]/request draws its swap picker, the state
      // the board shows; a donation-only toy hides half the page by design.
      offer_type: 'both',
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
/**
 * One open report, so /admin/reports has a card to draw. member_reports was
 * empty on the parity database and the queue's honest empty state was being
 * reported as "board has cards, live has none" — twice. No unique key on the
 * table, so guard by label rather than let every run add another.
 */
async function seedReport(db, parentId) {
  const { data } = await db
    .from('member_reports')
    .select('id')
    .eq('subject_label', 'Parity fixture guide')
    .limit(1)
  if (data?.length) return
  await db
    .from('member_reports')
    .insert({
      reporter_id: parentId,
      subject_kind: 'guide',
      subject_label: 'Parity fixture guide',
      category: 'wrong_info',
      body: 'Seeded so the reports queue has one card to measure.',
      ok_to_contact: true,
    })
    .then(() => {}, () => {})
}

async function seed(db, users) {
  const routes = {}
  const { parent, contributor, leader } = users
  // A leader-only run has no parent; the family on the other side of the
  // organisation's fixtures is then any existing profile.
  const family = parent?.id || (leader ? await someoneElse(db, leader.id) : null)

  if (parent) {
    const ex = await seedExchange(db, parent.id)
    if (ex) routes.thread = `/dashboard/exchanges/${ex.id}`
    await seedOutstandingCost(db, parent.id, ex)
    await seedNotifications(db, parent.id, ex?.id)
    await seedGivenAway(db, parent.id)
    const build = await seedBuild(db, parent.id)
    if (build) routes.build_thread = `/dashboard/exchanges/build/${build}`
    const child = await seedChild(db, parent.id)
    if (child) routes.child = `/dashboard/child/${child}`
    const pj = await seedPrintRequest(db, parent.id)
    if (pj) routes.print_job = `/dashboard/print-requests/${pj}`
    const toy = await seedOwnedToy(db, parent.id)
    if (toy) routes.toy_detail = `/dashboard/toys/${toy}`
    await seedSavesAndIdeas(db, parent.id)
    await seedReport(db, parent.id)
    await seedPrinterWithJobs(db, { owner_id: parent.id }, await someoneElse(db, parent.id))
  }
  if (contributor) {
    const t = await seedOwnedTutorial(db, contributor.id)
    if (t) routes.editor = `/tutorials/${t}/edit`
  }
  if (leader) {
    const ev = await seedOrgEvent(db, leader.id, leader.orgId)
    if (ev) {
      routes.org_event_manage = `/dashboard/org/events/${ev}`
      await seedEventParts(db, ev, leader.orgId, family)
    }
    await seedOrgQueue(db, leader.id, leader.orgId)
    await seedOrgRequests(db, family, leader.orgId)
    await seedPrinterWithJobs(db, { owner_org_id: leader.orgId }, family)
    await seedDropoffs(db, leader.orgId, family)
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
  // The form only renders for a guide with STL files; sampling the first
  // /library link gave it a toy-adaptation guide with none and measured the
  // "every request starts from a guide" banner instead.
  print_request_new: async (db) => {
    const { data } = await db
      .from('stl_files')
      .select('tutorial_id, tutorials!inner(status)')
      .eq('tutorials.status', 'approved')
      .limit(1)
      .single()
    return data ? `/printing/requests?guide=${data.tutorial_id}` : null
  },
  // The first link on /organizations is the emptiest fixture org, so five of
  // the profile's sections are data-gated away; pick one with a rate note.
  org_public: async (db) => {
    const { data } = await db
      .from('organizations')
      .select('id')
      .eq('status', 'active')
      .not('rate_note', 'is', null)
      .limit(1)
      .single()
    return data ? `/organizations/${data.id}/public` : null
  },
  // The board's "Also worth a look" is the author's recommendations, and the
  // first /library link had none. Prefer a public guide that has some; else
  // lend the first approved guide two of the others and take them back after.
  tutorial: async (db) => {
    const { data: has } = await db
      .from('tutorial_recommendations')
      // Both ends approved: the public route hides a target that is not, and a
      // host whose only recommendation is hidden draws no section at all.
      .select(
        'tutorial_id, host:tutorials!tutorial_recommendations_tutorial_id_fkey!inner(status), rec:tutorials!tutorial_recommendations_recommended_id_fkey!inner(status)'
      )
      .eq('host.status', 'approved')
      .eq('rec.status', 'approved')
      .limit(1)
    if (has?.[0]) return `/tutorials/${has[0].tutorial_id}`
    const { data: guides } = await db.from('tutorials').select('id').eq('status', 'approved').limit(3)
    if (!guides || guides.length < 2) return null
    const [host, ...recs] = guides
    const { error } = await db
      .from('tutorial_recommendations')
      .insert(recs.map((r, i) => ({ tutorial_id: host.id, recommended_id: r.id, position: i + 1 })))
    if (error) return null
    undo.push((d) => d.from('tutorial_recommendations').delete().eq('tutorial_id', host.id))
    return `/tutorials/${host.id}`
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

module.exports = { seed, dbSample, unseed }
