import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'

// Shared by parts.ts, tools.ts, stl-files.ts: each sub-resource is fully
// replaced on POST (delete all, then insert the new list) and cleared with
// DELETE. Only the table, URL segment, body key, and per-row mapping differ.
export function subResourceRoutes<Item>(opts: {
  path: string
  table: string
  bodyKey: string
  /** `index` is the item's place in the posted list — recommendations turn it
   *  into `position`; parts, tools and STL files ignore it. */
  mapRow: (item: Item, tutorialId: string, index: number) => Record<string, unknown>
}) {
  const router = new Hono<{ Variables: AuthVariables }>()

  router.post(`/:id/${opts.path}`, async (c) => {
    const body = await c.req.json<Record<string, Item[]>>()
    const supabase = createUserClient(c.get('token'))
    const tutorialId = c.req.param('id')

    await supabase.from(opts.table).delete().eq('tutorial_id', tutorialId)

    const rows = body[opts.bodyKey].map((item, i) => opts.mapRow(item, tutorialId, i))

    const { data, error } = await supabase.from(opts.table).insert(rows).select()
    if (error) return c.json({ error: error.message }, 500)
    return c.json(data, 201)
  })

  router.delete(`/:id/${opts.path}`, async (c) => {
    const supabase = createUserClient(c.get('token'))
    const { error } = await supabase.from(opts.table).delete().eq('tutorial_id', c.req.param('id'))
    if (error) return c.json({ error: error.message }, 500)
    return c.body(null, 204)
  })

  return router
}
