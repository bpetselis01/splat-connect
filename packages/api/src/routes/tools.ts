import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'

const tools = new Hono<{ Variables: AuthVariables }>()

tools.post('/:id/tools', async (c) => {
  const body = await c.req.json<{ tools: { name: string; is_optional: boolean; buy_links: unknown[] }[] }>()
  const supabase = createUserClient(c.get('token'))

  await supabase.from('tools').delete().eq('tutorial_id', c.req.param('id'))

  const rows = body.tools.map((t) => ({
    tutorial_id: c.req.param('id'),
    name: t.name,
    is_optional: t.is_optional,
    buy_links: t.buy_links,
  }))

  const { data, error } = await supabase.from('tools').insert(rows).select()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

tools.delete('/:id/tools', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { error } = await supabase.from('tools').delete().eq('tutorial_id', c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

export default tools
