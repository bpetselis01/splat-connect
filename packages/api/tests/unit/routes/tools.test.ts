import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

// --- Mock strategy ---
// Replaces the Supabase user client with controlled delete and insert fakes. Mocks are
// declared without a fixed return shape so individual tests can override them in beforeEach —
// a fixed shape defined at module level would prevent error-path tests from overriding it
// (the fixed shape always wins over a per-test override in Vitest).
const mockDeleteTools = vi.fn()
const mockInsertTools = vi.fn()
const mockFrom = vi.fn((table: string) => {
  if (table === 'tools') return { delete: mockDeleteTools, insert: mockInsertTools }
  return {}
})

vi.mock('../../../src/supabase/client.js', () => ({ createUserClient: () => ({ from: mockFrom }) }))

const { default: tools } = await import('../../../src/routes/tools.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', 'contributor')
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', tools)
  return app
}

describe('POST /:id/tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteTools.mockReturnValue({ eq: vi.fn(() => ({ error: null })) })
    mockInsertTools.mockReturnValue({ select: vi.fn(() => ({ data: [], error: null })) })
  })

  // Tests: POST /:id/tools deletes the existing tools list then inserts the new one, returning 201
  // How:   mockDeleteTools and mockInsertTools are verified to have been called; checks status 201
  // Chain: the upload wizard calls this on Step 4 Next → the tools list in the DB is fully
  //        replaced, so back-and-forward navigation always results in the latest list
  it('replaces tools and returns 201', async () => {
    const newTools = [{ name: 'Screwdriver', is_optional: false, buy_links: [] }]
    const res = await makeApp().request('/tutorial-1/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tools: newTools }),
    })
    expect(res.status).toBe(201)
    expect(mockDeleteTools).toHaveBeenCalled()
    expect(mockInsertTools).toHaveBeenCalled()
  })

  // Tests: POST /:id/tools returns 500 when the insert step fails
  // How:   mockInsertTools is overridden to return { data: null, error }; checks status 500
  // Chain: the upload wizard receives 500 → the UI keeps the user on Step 4 and displays
  //        an error rather than advancing with unsaved tools data
  it('returns 500 when insert fails', async () => {
    mockInsertTools.mockReturnValue({ select: vi.fn(() => ({ data: null, error: { message: 'insert error' } })) })
    const newTools = [{ name: 'Screwdriver', is_optional: false, buy_links: [] }]
    const res = await makeApp().request('/tutorial-1/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tools: newTools }),
    })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /:id/tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteTools.mockReturnValue({ eq: vi.fn(() => ({ error: null })) })
    mockInsertTools.mockReturnValue({ select: vi.fn(() => ({ data: [], error: null })) })
  })

  // Tests: DELETE /:id/tools removes all tools for a tutorial and returns 204 No Content
  // How:   mockDeleteTools is pre-configured to succeed; checks status 204
  // Chain: the edit page calls this when a user clears all tools → the DB is cleared and
  //        the tutorial detail page no longer lists any tools
  it('deletes tools and returns 204', async () => {
    const res = await makeApp().request('/tutorial-1/tools', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })

  // Tests: DELETE /:id/tools returns 500 when the database delete fails
  // How:   mockDeleteTools is overridden to return { error: { message: 'delete error' } }; checks status 500
  // Chain: the edit page receives 500 → the UI displays a failure message and the existing
  //        tools remain in the DB unchanged
  it('returns 500 when delete fails', async () => {
    mockDeleteTools.mockReturnValue({ eq: vi.fn(() => ({ error: { message: 'delete error' } })) })
    const res = await makeApp().request('/tutorial-1/tools', { method: 'DELETE' })
    expect(res.status).toBe(500)
  })
})
