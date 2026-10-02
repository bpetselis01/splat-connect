import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

/*
 * Two leaders saving min and max at the same moment both pass the route's
 * read-then-compare, and 113's CHECK refuses the second write. That refusal
 * must read as the same sentence the route gives, not a 500 with Postgres's
 * wording. A real race cannot be staged deterministically, so the admin
 * client answers the update as the database would.
 */
const builder = (table: string) => {
  let updating = false
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in']) b[m] = () => b
  b.update = () => ((updating = true), b)
  b.maybeSingle = async () =>
    table === 'org_leaders'
      ? { data: { id: 'l1' }, error: null }
      : updating
        ? {
            data: null,
            error: { code: '23514', message: 'new row for relation "organizations" violates check constraint "organizations_recycling_max_over_min"' },
          }
        : { data: { recycling_min_kg: null, recycling_max_kg: null }, error: null }
  return b
}
vi.mock('../../../src/supabase/client.js', () => ({
  createAdminClient: () => ({ from: builder }),
  createUserClient: () => ({ from: builder }),
}))

const { default: organizations } = await import('../../../src/routes/organizations.js')

describe('PATCH /:id/profile, min and max saved at once', () => {
  it('answers the CHECK with the same 400 sentence', async () => {
    const app = new Hono<{ Variables: AuthVariables }>()
    app.use('*', async (c, next) => {
      c.set('userId', 'leader-1')
      c.set('role', 'contributor')
      c.set('token', 't')
      await next()
    })
    app.route('/', organizations)
    const res = await app.request('/org-1/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recycling_max_kg: 3 }),
    })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe('The maximum per drop cannot be under the minimum.')
  })
})
