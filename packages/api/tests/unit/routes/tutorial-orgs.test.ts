import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

/*
 * POST /:id/orgs is idempotent: asking the same organisation twice returns 200
 * from the 23505 branch without inserting anything. The notification has to sit
 * on the 201 path only, or that idempotence becomes a way for an author to
 * spam a leader's inbox by pressing the button repeatedly. Nothing else asserts
 * that split.
 */
const mockUserClient = { from: vi.fn() }
vi.mock('../../../src/supabase/user-client.js', () => ({ createUserClient: () => mockUserClient }))

const mockNotifyBacking = vi.fn().mockResolvedValue(undefined)
vi.mock('../../../src/review-notifications.js', () => ({
  notifyBackingRequested: (...args: unknown[]) => mockNotifyBacking(...args),
}))

const { default: tutorialOrgs } = await import('../../../src/routes/tutorial-orgs.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'author-1')
    c.set('role', 'contributor')
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', tutorialOrgs)
  return app
}

function ask() {
  return makeApp().request('/t1/orgs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ org_id: 'org-a' }),
  })
}

describe('POST /:id/orgs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('notifies the organisation on a new request', async () => {
    mockUserClient.from.mockReturnValue({
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'b1' }, error: null }) }) }),
    })
    const res = await ask()
    expect(res.status).toBe(201)
    expect(mockNotifyBacking).toHaveBeenCalledWith({
      tutorialId: 't1',
      orgId: 'org-a',
      actorId: 'author-1',
    })
  })

  it('notifies nobody when the same organisation is asked twice', async () => {
    mockUserClient.from.mockReturnValue({
      insert: () => ({
        select: () => ({ single: async () => ({ data: null, error: { code: '23505' } }) }),
      }),
    })
    const res = await ask()
    expect(res.status).toBe(200)
    expect(mockNotifyBacking).not.toHaveBeenCalled()
  })

  it('notifies nobody when the insert is refused', async () => {
    mockUserClient.from.mockReturnValue({
      insert: () => ({
        select: () => ({ single: async () => ({ data: null, error: { code: '42501' } }) }),
      }),
    })
    const res = await ask()
    expect(res.status).toBe(403)
    expect(mockNotifyBacking).not.toHaveBeenCalled()
  })
})
