/**
 * Parts sub-resource: add/remove materials on a tutorial the caller owns.
 * Same pattern as tools.ts and stl-files.ts.
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'

const parts = new Hono<{ Variables: AuthVariables }>()

parts.post('/:id/parts', async (c) => {
  const body = await c.req.json<{ parts: { name: string; quantity: number; is_optional: boolean; buy_links: unknown[] }[] }>()
  const supabase = createUserClient(c.get('token'))

  await supabase.from('parts').delete().eq('tutorial_id', c.req.param('id'))

  const rows = body.parts.map((p) => ({
    tutorial_id: c.req.param('id'),
    name: p.name,
    quantity: p.quantity,
    is_optional: p.is_optional,
    buy_links: p.buy_links,
  }))

  const { data, error } = await supabase.from('parts').insert(rows).select()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

parts.delete('/:id/parts', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { error } = await supabase.from('parts').delete().eq('tutorial_id', c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

export default parts
