import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

/*
 * Registering reads the event's questions to check the required answers. If
 * that read fails, the route must refuse: treating it as "no questions" lets a
 * registration through without the answers the host asked for.
 */
const event = {
  id: 'e1',
  org_id: 'o1',
  title: 'Build day',
  status: 'published',
  cancelled_at: null,
  registrations_closed_at: null,
  capacity: null,
  starts_at: '2030-01-01T00:00:00Z',
  cost_cents: 0,
  format: 'in_person',
  online_url: null,
}
const chain = (result: unknown) => {
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order']) q[m] = () => q
  q.maybeSingle = async () => result
  q.then = (resolve: (r: unknown) => unknown) => resolve(result)
  return q
}
const mockAdmin = {
  from: vi.fn((table: string) =>
    table === 'org_events'
      ? chain({ data: event, error: null })
      : chain({ data: null, error: { message: 'connection reset' } }),
  ),
}
const mockUser = { from: vi.fn() }
vi.mock('../../../src/supabase/client.js', () => ({
  createAdminClient: () => mockAdmin,
  createUserClient: () => mockUser,
}))

const { default: events } = await import('../../../src/routes/events.js')

describe('POST /:id/registrations when the questions cannot be read', () => {
  it('answers 500 and writes no registration', async () => {
    const app = new Hono<{ Variables: AuthVariables }>()
    app.use('*', async (c, next) => {
      c.set('userId', 'u1')
      c.set('role', 'contributor')
      c.set('token', 'test-token')
      await next()
    })
    app.route('/', events)
    const res = await app.request('/e1/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'A member', email: 'member@example.com' }),
    })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "We couldn't load this event's questions. Try again." })
    expect(mockUser.from).not.toHaveBeenCalled()
  })
})
