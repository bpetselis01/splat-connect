/**
 * Tools Routes (Protected)
 * 
 * Handles adding and removing tools needed for a tutorial.
 * 
 * Endpoints:
 * - POST /api/tutorials/:id/tools
 *   - Add a new tool to a tutorial
 *   - Body: { name, is_optional, buy_links }
 *   - Auth: Requires JWT + user must own tutorial
 *   - Returns: Tool object
 * 
 * - DELETE /api/tutorials/:id/tools/:toolId
 *   - Remove a tool from a tutorial
 *   - Auth: Requires JWT + user must own tutorial
 *   - Returns: 204 No Content
 * 
 * Tool structure:
 * - name: Tool name (e.g., 'Soldering iron')
 * - is_optional: Can the tutorial be done without this tool?
 * - buy_links: Array of purchase links (label + URL)
 * 
 * Note: Tools are different from Parts in that they're not consumable,
 * and users might already have them. That's why we track optional flag.
 * 
 * Data flow:
 * 1. User adds tool in upload form step 4
 * 2. User fills in name, optional flag, purchase links
 * 3. On 'Add' click, web calls POST /api/tutorials/:id/tools
 * 4. API validates user owns tutorial
 * 5. Supabase inserts Tool record with tutorial_id
 * 6. Tool appears in form and in database
 * 7. When tutorial submitted, all tools automatically included
 * 
 * Related files:
 * - routes/tutorials.ts: Tutorial CRUD (tools are sub-resources)
 * - routes/parts.ts: Similar pattern for materials
 * - routes/stl-files.ts: Similar pattern for 3D files
 * - types/index.ts: Tool type definition
 */
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
