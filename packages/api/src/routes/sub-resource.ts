import { Hono } from 'hono'
import { createUserClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'
import { sendApprovedGuideBackToReview } from '../re-review.js'

/**
 * A part's or tool's shop links: each a short label and a web address. Both
 * clients render the url as a link (web as an href), so anything but http(s)
 * — javascript:, data:, another app's scheme — is refused here.
 */
export function buyLinksError(links: unknown, what: string): string | null {
  if (links == null) return null
  if (!Array.isArray(links)) return `${what}'s buy links must be a list`
  for (const l of links as { label?: unknown; url?: unknown }[]) {
    if (!l || typeof l.label !== 'string' || !l.label.trim() || l.label.length > 80) return `${what}: each buy link needs a shop name of up to 80 characters`
    if (typeof l.url !== 'string' || l.url.length > 500 || !/^https?:\/\/[^\s]+$/i.test(l.url.trim())) return `${what}: a buy link must be a web address starting https://`
  }
  return null
}

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
  /** Checked before the old list is deleted, so a refused list changes nothing.
   *  Returns the 400's sentence, or null. */
  validate?: (items: Item[]) => string | null
  /** 23503 on the insert means no such guide, unless a row's own foreign key
   *  (a recommended guide) could be the one that failed. */
  unknownGuideIs404?: boolean
  /** Recommendations are the one list whose edit leaves an approved guide approved. */
  keepsApproval?: boolean
}) {
  const router = new Hono<{ Variables: AuthVariables }>()

  router.post(`/:id/${opts.path}`, async (c) => {
    const body = await c.req.json<Record<string, Item[]>>()
    const items = body[opts.bodyKey]
    if (!Array.isArray(items)) return c.json({ error: `${opts.bodyKey} must be a list` }, 400)
    const invalid = opts.validate?.(items)
    if (invalid) return c.json({ error: invalid }, 400)
    const supabase = createUserClient(c.get('token'))
    const tutorialId = c.req.param('id')

    await supabase.from(opts.table).delete().eq('tutorial_id', tutorialId)

    const rows = items.map((item, i) => opts.mapRow(item, tutorialId, i))

    const { data, error } = await supabase.from(opts.table).insert(rows).select()
    // 23514: a CHECK refused a value. 42501: RLS refused — not this guide's contributor.
    if (error?.code === '23503' && opts.unknownGuideIs404) return c.json({ error: 'Not found' }, 404)
    if (error) return c.json({ error: error.message }, error.code === '23514' ? 400 : error.code === '42501' ? 403 : 500)
    if (!opts.keepsApproval) {
      const moveError = await sendApprovedGuideBackToReview(c.var, tutorialId)
      if (moveError) return c.json({ error: moveError }, 500)
    }
    return c.json(data, 201)
  })

  router.delete(`/:id/${opts.path}`, async (c) => {
    const supabase = createUserClient(c.get('token'))
    const { error } = await supabase.from(opts.table).delete().eq('tutorial_id', c.req.param('id'))
    if (error) return c.json({ error: error.message }, 500)
    if (!opts.keepsApproval) {
      const moveError = await sendApprovedGuideBackToReview(c.var, c.req.param('id'))
      if (moveError) return c.json({ error: moveError }, 500)
    }
    return c.body(null, 204)
  })

  return router
}
