import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockUserFrom = vi.fn()

// child-profiles writes/reads go through the user client so Postgres RLS
// (parent_id = auth.uid()) is the authorization boundary — see the mocking
// strategy in contributors.test.ts.
vi.mock('../../../src/supabase/user-client.js', () => ({ createUserClient: () => ({ from: mockUserFrom }) }))

const { default: childProfiles } = await import('../../../src/routes/child-profiles.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', 'contributor')
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', childProfiles)
  return app
}

describe('GET / — 500 on DB error', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 500 when the select fails', async () => {
    mockUserFrom.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => ({ data: null, error: { message: 'boom' } }) }) }),
    })
    const res = await makeApp().request('/')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'boom' })
  })
})

describe('POST / — 500 on DB error', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 500 when the insert fails', async () => {
    mockUserFrom.mockReturnValue({
      insert: () => ({ select: () => ({ single: () => ({ data: null, error: { message: 'boom' } }) }) }),
    })
    const res = await makeApp().request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Emma' }),
    })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'boom' })
  })
})

describe('PATCH /:id — 500 on DB error', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 500 when the update fails for a reason other than a malformed id', async () => {
    mockUserFrom.mockReturnValue({
      update: () => ({ eq: () => ({ select: () => ({ maybeSingle: () => ({ data: null, error: { message: 'boom' } }) }) }) }),
    })
    const res = await makeApp().request('/cp-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Patched' }),
    })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'boom' })
  })
})

describe('DELETE /:id — 500 on DB error', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 500 when the delete fails for a reason other than a malformed id', async () => {
    mockUserFrom.mockReturnValue({
      delete: () => ({ eq: () => ({ select: () => ({ maybeSingle: () => ({ data: null, error: { message: 'boom' } }) }) }) }),
    })
    const res = await makeApp().request('/cp-1', { method: 'DELETE' })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'boom' })
  })
})
