import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockFrom = vi.fn()

// --- Mock strategy ---
// notifications.ts builds a per-request client from the caller's JWT via
// createUserClient, so RLS does the ownership check. Replacing that with one
// controlled fake lets each test drive the query chain's return value directly.
vi.mock('../../../src/supabase/user-client.js', () => ({
  createUserClient: () => ({ from: mockFrom }),
}))

const { default: notifications } = await import('../../../src/routes/notifications.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', 'contributor')
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', notifications)
  return app
}

describe('GET /me/unread-counts', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: unread rows are tallied into the three hub buckets plus a total
  // How:   the select/eq/is chain returns five unread rows across all three buckets
  // Chain: My SPLAT reads this to badge its cards → a user sees which card has news
  it('tallies unread rows into buckets', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          is: () => ({
            data: [
              { type: 'tutorial_approved' },
              { type: 'collaborator_invited' },
              { type: 'toy_message' },
              { type: 'toy_request' },
              { type: 'idea_graduated' },
            ],
            error: null,
          }),
        }),
      }),
    })

    const res = await makeApp().request('/me/unread-counts')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      tutorials: 2,
      exchanges: 2,
      challenges: 1,
      total: 5,
    })
  })

  it('returns all zeroes when nothing is unread', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ is: () => ({ data: [], error: null }) }) }),
    })

    const res = await makeApp().request('/me/unread-counts')
    expect(await res.json()).toEqual({ tutorials: 0, exchanges: 0, challenges: 0, total: 0 })
  })

  it('500s rather than reporting a falsely empty inbox', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ is: () => ({ data: null, error: { message: 'boom' } }) }) }),
    })

    const res = await makeApp().request('/me/unread-counts')
    expect(res.status).toBe(500)
  })
})

describe('POST /me/read', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: marking one bucket read only touches that bucket's types
  // How:   captures the .in() argument from the update chain
  // Chain: opening /dashboard/tutorials clears the tutorials badge → and only it
  it('marks only the named bucket read', async () => {
    const inSpy = vi.fn().mockReturnValue({ error: null })
    mockFrom.mockReturnValue({
      update: () => ({ eq: () => ({ is: () => ({ in: inSpy }) }) }),
    })

    const res = await makeApp().request('/me/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bucket: 'tutorials' }),
    })

    expect(res.status).toBe(204)
    const [column, types] = inSpy.mock.calls[0]
    expect(column).toBe('type')
    expect(types).toContain('tutorial_approved')
    expect(types).toContain('collaborator_left')
    expect(types).not.toContain('toy_message')
  })

  it('rejects an unknown bucket rather than marking everything read', async () => {
    const res = await makeApp().request('/me/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bucket: 'everything' }),
    })

    expect(res.status).toBe(400)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
