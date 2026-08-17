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
import { Hono, type Context } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import { createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const organizations = new Hono<{ Variables: AuthVariables }>()

/**
 * The columns anon and authenticated may read. 033 revoked the table-level
 * SELECT grant and granted these back, so `select('*')` on the user client now
 * fails outright — the pickup columns are deliberately outside it, since
 * pickup_instructions is where a leader writes "side gate, code 4417". Every
 * user-client read of this table must name its columns.
 *
 * A future migration adding an organizations column must extend both this list
 * and the grant in 033.
 */
export const ORG_COLUMNS = 'id, name, description, status, created_by, created_at, updated_at'

organizations.get('/', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('organizations')
    // Leaders ride along. The admin page shows them per row, and fetching them
    // separately meant one request per organisation. A <details> cannot defer it
    // either — a server component renders whether or not the panel is open.
    .select(`${ORG_COLUMNS}, org_leaders(user_id, created_at)`)
    .order('name', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// Declared before '/:id' so 'mine' is not swallowed as an id.
organizations.get('/mine', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('org_leaders')
    .select(`organizations(${ORG_COLUMNS})`)
    .eq('user_id', c.get('userId'))
  if (error) return c.json({ error: error.message }, 500)
  return c.json((data ?? []).map((r) => r.organizations))
})

/**
 * The fixed pickup point, readable and writable by a leader of that org only.
 *
 * These four routes use the SERVICE-ROLE client, unlike every other handler in
 * this file, and check leadership themselves. That is not a shortcut around RLS
 * — it is the consequence of 033's column grants: the user client has no SELECT
 * on the pickup columns at all, so a policy could not admit it even if one
 * existed. Authority moves into the handler because the grant, not the policy,
 * is what closed the door.
 */
async function leadsOrg(c: Context<{ Variables: AuthVariables }>, orgId: string) {
  const { data } = await createAdminClient()
    .from('org_leaders')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', c.get('userId'))
    .maybeSingle()
  return Boolean(data)
}

const PICKUP_COLUMNS =
  'pickup_line1, pickup_suburb, pickup_state, pickup_postcode, pickup_instructions'

organizations.get('/:id/pickup', async (c) => {
  const orgId = c.req.param('id')
  // 404 rather than 403 for a non-leader, matching routes/toys.ts: a 403 would
  // confirm the row exists to someone with no claim on it.
  if (!(await leadsOrg(c, orgId))) return c.json({ error: 'Not found' }, 404)
  const { data, error } = await createAdminClient()
    .from('organizations')
    .select(PICKUP_COLUMNS)
    .eq('id', orgId)
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

organizations.patch('/:id/pickup', async (c) => {
  const orgId = c.req.param('id')
  if (!(await leadsOrg(c, orgId))) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json().catch(() => null)
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Body must be an object' }, 400)
  }
  const address = readOrgPickup(body)
  if (!address) return c.json({ error: 'A complete pickup address is required' }, 400)

  const { data, error } = await createAdminClient()
    .from('organizations')
    .update({ ...address, updated_at: new Date().toISOString() })
    .eq('id', orgId)
    .select(PICKUP_COLUMNS)
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

// All four address fields or none: a half-filled address is not a place to
// meet, and accept_toy_transaction() refuses to hand anything over on one.
// Instructions are optional — plenty of orgs are just "reception, ground floor".
function readOrgPickup(body: Record<string, unknown>): Record<string, string | null> | null {
  const address: Record<string, string | null> = {}
  for (const field of ['pickup_line1', 'pickup_suburb', 'pickup_state', 'pickup_postcode']) {
    const value = body[field]
    if (typeof value !== 'string' || !value.trim()) return null
    address[field] = value.trim()
  }
  const instructions = body.pickup_instructions
  address.pickup_instructions =
    typeof instructions === 'string' && instructions.trim() ? instructions.trim() : null
  return address
}

organizations.get('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('organizations')
    .select(`${ORG_COLUMNS}, org_leaders(user_id, created_at)`)
    .eq('id', c.req.param('id'))
    .single()
  if (error) return c.json({ error: error.message }, 404)
  return c.json(data)
})

export default organizations
