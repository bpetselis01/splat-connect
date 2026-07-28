/**
 * Organization routes (read-only). Both org tables are world-readable by
 * policy — an organisation is a public trust badge and its leaders public
 * trust figures. Suspended organisations are returned flagged, not hidden,
 * so a contributor can see why one isn't selectable. There is deliberately
 * no POST here: only an admin may create an organisation (routes/admin.ts);
 * the RLS insert policy is is_admin(), so a create handler here could never
 * succeed. /mine drives the dashboard link into /org/[orgId] — leadership is
 * per-organisation data, not a profile role.
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'

const organizations = new Hono<{ Variables: AuthVariables }>()

organizations.get('/', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('organizations')
    // Leaders ride along. The admin page shows them per row, and fetching them
    // separately meant one request per organisation. A <details> cannot defer it
    // either — a server component renders whether or not the panel is open.
    .select('*, org_leaders(user_id, created_at)')
    .order('name', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// Declared before '/:id' so 'mine' is not swallowed as an id.
organizations.get('/mine', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('org_leaders')
    .select('organizations(*)')
    .eq('user_id', c.get('userId'))
  if (error) return c.json({ error: error.message }, 500)
  return c.json((data ?? []).map((r) => r.organizations))
})

organizations.get('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('organizations')
    .select('*, org_leaders(user_id, created_at)')
    .eq('id', c.req.param('id'))
    .single()
  if (error) return c.json({ error: error.message }, 404)
  return c.json(data)
})

export default organizations
