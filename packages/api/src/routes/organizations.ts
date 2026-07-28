/**
 * Organization Routes (Protected, read-only)
 *
 * Endpoints:
 * - GET /api/organizations
 *   - Every organisation, for the "who should back this?" picker. Suspended ones
 *     are included and flagged, rather than hidden: a contributor should see why
 *     an organisation they expected is not selectable.
 *
 * - GET /api/organizations/mine
 *   - The organisations the caller leads. Drives the dashboard's link into
 *     /org/[orgId] — leadership is per-organisation data, not a role, so there is
 *     nothing on the profile to read it from.
 *
 * - GET /api/organizations/:id
 *   - One organisation with its leaders.
 *
 * Security notes:
 * - Reads go through createUserClient, but both org tables are world-readable by
 *   policy — an organisation is a public trust badge and its leaders are public
 *   trust figures.
 * - There is deliberately no POST here. Only an admin may create an organisation
 *   (routes/admin.ts), and the RLS insert policy is is_admin(), so a create
 *   handler on this router could never succeed.
 *
 * Related files:
 * - supabase/migrations/007_organizations.sql: the policies behind all of this
 * - routes/tutorial-orgs.ts: asking an organisation to back a project
 * - routes/admin.ts: creation, suspension, leader appointment
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
