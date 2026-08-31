/**
 * Saves — the things a person kept to come back to.
 *
 * The list is two queries rather than a join, and that is forced rather than
 * chosen: entity_id has no foreign key (see 044_saves.sql), so PostgREST cannot
 * embed it. Fetch the save rows, then fetch those entities through the USER
 * client — RLS drops whatever the caller can no longer see, which is where "a
 * donated toy quietly leaves your saved list" comes from. It is the absence of
 * code, not a feature.
 *
 * Related files:
 * - supabase/migrations/044_saves.sql: the table, and why entity_id is loose
 * - packages/types/src/index.ts: SAVE_SLUGS, which decides what is live
 * - packages/web/app/dashboard/saved/[type]/page.tsx: the same slug validation
 */
import { Hono } from 'hono'
import { SAVE_SLUGS, type SaveSlug, type SavedIds } from '@splat-connect/types'
import { createUserClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const saves = new Hono<{ Variables: AuthVariables }>()

/**
 * A PostgREST filter builder, mid-chain, described structurally.
 *
 * The Supabase client here carries no generated Database types — the same as
 * every other route in this package — so inferring the builder's type from it
 * bottoms out in "type instantiation is excessively deep". Naming only the
 * three things SOURCE actually uses is shorter and more honest about what a
 * filter is allowed to do.
 */
type EntityQuery = {
  eq(column: string, value: string): EntityQuery
  is(column: string, value: null): EntityQuery
  then: PromiseLike<{ data: unknown; error: { message: string } | null }>['then']
}

/**
 * The one object that decides which entity types are live.
 *
 * The selects are copied from routes/public.ts on purpose: a saved list returns
 * the same shape the public list does, so TutorialCard and ToyLibraryCard
 * render it with no changes at all. 'organisation' and 'printable_part' are in
 * the enum and deliberately absent here, so their routes 404 until someone adds
 * a line — placeholder-ness lives in one place rather than five conditionals.
 */
const SOURCE = {
  tutorials: {
    table: 'tutorials',
    select: '*, tutorial_orgs(status, organizations(id, name))',
    filter: (q: EntityQuery) => q.eq('status', 'approved'),
  },
  toys: {
    table: 'toys',
    select: '*, profiles(name), organizations(name)',
    filter: (q: EntityQuery) => q.eq('status', 'published').is('archived_at', null),
  },
  challenges: {
    table: 'toy_ideas',
    select: '*',
    filter: (q: EntityQuery) => q.eq('status', 'challenge'),
  },
} satisfies Record<SaveSlug, { table: string; select: string; filter: (q: EntityQuery) => EntityQuery }>

const SLUGS = Object.keys(SAVE_SLUGS) as SaveSlug[]
const isSlug = (s: string): s is SaveSlug => Object.hasOwn(SAVE_SLUGS, s)

/**
 * Every saved id, grouped by slug. This is what a browse page calls — one
 * request per page load, so /library can render a hundred cards off an array
 * lookup instead of a hundred round trips.
 *
 * Deliberately unfiltered by visibility: a card on screen is visible by
 * definition, and filtering here would cost the join this endpoint exists to
 * avoid.
 */
saves.get('/ids', async (c) => {
  const { data, error } = await createUserClient(c.get('token'))
    .from('saves')
    .select('entity_type, entity_id')
    .eq('profile_id', c.get('userId'))

  if (error) return c.json({ error: error.message }, 500)

  const out = { tutorials: [], toys: [], challenges: [] } as SavedIds
  for (const slug of SLUGS) {
    out[slug] = (data ?? [])
      .filter((r) => r.entity_type === SAVE_SLUGS[slug])
      .map((r) => r.entity_id)
  }
  return c.json(out)
})

saves.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  if (!isSlug(slug)) return c.json({ error: 'Not found' }, 404)

  const sb = createUserClient(c.get('token'))
  const { data: rows, error } = await sb
    .from('saves')
    .select('entity_id, created_at')
    .eq('profile_id', c.get('userId'))
    .eq('entity_type', SAVE_SLUGS[slug])
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  if (!rows?.length) return c.json([])

  const source = SOURCE[slug]
  const ids = rows.map((r) => r.entity_id)
  // One cast, here rather than inside SOURCE: the builder is structurally what
  // EntityQuery describes, but its own type is generated per-table and does not
  // unify across the three.
  const query = sb
    .from(source.table)
    .select(source.select)
    .in('id', ids) as unknown as EntityQuery
  const { data: entities, error: entityError } = await source.filter(query)
  if (entityError) return c.json({ error: entityError.message }, 500)

  // Re-sorted into save order: the second query returns entity order, and RLS
  // has already removed anything the caller can no longer read.
  const byId = new Map(
    ((entities ?? []) as { id: string }[]).map((e) => [e.id, e])
  )
  return c.json(ids.map((id) => byId.get(id)).filter(Boolean))
})

saves.post('/', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    entity_type?: unknown
    entity_id?: unknown
  } | null

  const type = body?.entity_type
  const id = body?.entity_id
  if (typeof type !== 'string' || typeof id !== 'string' || !id.trim()) {
    return c.json({ error: 'entity_type and entity_id are required' }, 400)
  }
  if (!(Object.values(SAVE_SLUGS) as string[]).includes(type)) {
    return c.json({ error: 'Unknown entity_type' }, 400)
  }

  // No existence or visibility check, deliberately: saving a uuid you cannot
  // see succeeds and then never appears in your list. It is not an oracle —
  // success and failure are indistinguishable to the caller either way — and
  // the alternative is an extra select on every save to prevent a free row.
  //
  // profile_id comes from the verified token, never the body.
  const { error } = await createUserClient(c.get('token'))
    .from('saves')
    .upsert(
      { profile_id: c.get('userId'), entity_type: type, entity_id: id },
      { onConflict: 'profile_id,entity_type,entity_id', ignoreDuplicates: true }
    )

  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 201)
})

saves.delete('/:slug/:id', async (c) => {
  const slug = c.req.param('slug')
  if (!isSlug(slug)) return c.json({ error: 'Not found' }, 404)

  // RLS scopes this to the caller's own rows, so someone else's identical save
  // is untouched and a miss is simply nothing deleted — which is why this is
  // idempotent rather than a 404.
  const { error } = await createUserClient(c.get('token'))
    .from('saves')
    .delete()
    .eq('profile_id', c.get('userId'))
    .eq('entity_type', SAVE_SLUGS[slug])
    .eq('entity_id', c.req.param('id'))

  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

export default saves
