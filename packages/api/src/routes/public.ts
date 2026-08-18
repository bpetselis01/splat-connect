/**
 * Unauthenticated routes — mounted before authMiddleware. They use the anon
 * client, so RLS enforces status='approved'/'published' as a second, database-level
 * backstop behind each query's own explicit filter.
 */
import { Hono } from 'hono'
import { createAnonClient, createAdminClient } from '../supabase/client.js'

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

export default publicRoutes
