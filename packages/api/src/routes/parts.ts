/**
 * Parts Routes (Protected)
 * 
 * Handles adding and removing materials (parts) needed for a tutorial.
 * 
 * Endpoints:
 * - POST /api/tutorials/:id/parts
 *   - Add a new material to a tutorial
 *   - Body: { name, quantity, is_optional, buy_links }
 *   - Auth: Requires JWT + user must own tutorial
 *   - Returns: Part object
 * 
 * - DELETE /api/tutorials/:id/parts/:partId
 *   - Remove a material from a tutorial
 *   - Auth: Requires JWT + user must own tutorial
 *   - Returns: 204 No Content
 * 
 * Part structure:
 * - name: Material name (e.g., 'Plastic tubing')
 * - quantity: How many needed
 * - is_optional: Can the tutorial work without this?
 * - buy_links: Array of purchase links (label + URL)
 * 
 * Data flow:
 * 1. User adds material in upload form step 3
 * 2. User fills in name, quantity, optional flag, purchase links
 * 3. On 'Add' click, web calls POST /api/tutorials/:id/parts
 * 4. API validates user owns tutorial
 * 5. Supabase inserts Part record with tutorial_id
 * 6. Part appears in form and in database
 * 7. When tutorial submitted, all parts automatically included
 * 
 * Related files:
 * - routes/tutorials.ts: Tutorial CRUD (parts are sub-resources)
 * - routes/tools.ts: Similar pattern for tools
 * - routes/stl-files.ts: Similar pattern for 3D files
 * - types/index.ts: Part type definition
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
