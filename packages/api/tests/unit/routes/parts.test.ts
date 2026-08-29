import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

// --- Mock strategy ---
// Replaces the Supabase user client with controlled delete and insert fakes. Mocks are
// declared without a fixed return shape so individual tests can override them in beforeEach —
// a fixed shape defined at module level would prevent error-path tests from overriding it
// (the fixed shape always wins over a per-test override in Vitest).
const mockDeleteParts = vi.fn()
const mockInsertParts = vi.fn()
const mockFrom = vi.fn((table: string) => {
  if (table === 'parts') return { delete: mockDeleteParts, insert: mockInsertParts }
  return {}
})

vi.mock('../../../src/supabase/client.js', () => ({ createUserClient: () => ({ from: mockFrom }) }))

const { default: parts } = await import('../../../src/routes/parts.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', 'contributor')
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', parts)
  return app
}

describe('POST /:id/parts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteParts.mockReturnValue({ eq: vi.fn(() => ({ error: null })) })
    mockInsertParts.mockReturnValue({ select: vi.fn(() => ({ data: [], error: null })) })
  })

  // Tests: POST /:id/parts deletes the existing parts list then inserts the new one, returning 201
  // How:   mockDeleteParts and mockInsertParts are verified to have been called; checks status 201
  // Chain: the upload wizard calls this on Step 3 Next → the parts list in the DB is fully
  //        replaced each time, so back-and-forward navigation always results in the latest list
  it('replaces parts and returns 201', async () => {
    const newParts = [{ name: 'Screw', quantity: 4, is_optional: false, buy_links: [] }]
    const res = await makeApp().request('/tutorial-1/parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: newParts }),
    })
    expect(res.status).toBe(201)
    expect(mockDeleteParts).toHaveBeenCalled()
    expect(mockInsertParts).toHaveBeenCalled()
  })

  // Tests: POST /:id/parts returns 500 when the insert step fails
  // How:   mockInsertParts is overridden to return { data: null, error }; checks status 500
  // Chain: the upload wizard receives 500 → the UI can display an error and keep the user
  //        on Step 3 rather than advancing with unsaved parts data
  it('returns 500 when insert fails', async () => {
    mockInsertParts.mockReturnValue({ select: vi.fn(() => ({ data: null, error: { message: 'insert error' } })) })
    const newParts = [{ name: 'Screw', quantity: 4, is_optional: false, buy_links: [] }]
    const res = await makeApp().request('/tutorial-1/parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: newParts }),
    })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /:id/parts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteParts.mockReturnValue({ eq: vi.fn(() => ({ error: null })) })
    mockInsertParts.mockReturnValue({ select: vi.fn(() => ({ data: [], error: null })) })
  })

  // Tests: DELETE /:id/parts removes all parts for a tutorial and returns 204 No Content
  // How:   mockDeleteParts is pre-configured to succeed; checks status 204
  // Chain: the edit page calls this when a user clears all parts → the DB is cleared and
  //        the tutorial detail page no longer lists any parts
  it('deletes parts and returns 204', async () => {
    const res = await makeApp().request('/tutorial-1/parts', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })

  // Tests: DELETE /:id/parts returns 500 when the database delete fails
  // How:   mockDeleteParts is overridden to return { error: { message: 'delete error' } }; checks status 500
  // Chain: the edit page receives 500 → the UI can display a failure message and the existing
  //        parts remain in the DB unchanged
  it('returns 500 when delete fails', async () => {
    mockDeleteParts.mockReturnValue({ eq: vi.fn(() => ({ error: { message: 'delete error' } })) })
    const res = await makeApp().request('/tutorial-1/parts', { method: 'DELETE' })
    expect(res.status).toBe(500)
  })
})
