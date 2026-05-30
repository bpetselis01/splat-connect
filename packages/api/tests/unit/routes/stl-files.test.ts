import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

// --- Mock strategy ---
// Replaces the Supabase user client with controlled delete and insert fakes. Mocks are
// declared without a fixed return shape so individual tests can override them in beforeEach —
// a fixed shape defined at module level would prevent error-path tests from overriding it
// (the fixed shape always wins over a per-test override in Vitest).
const mockDeleteStl = vi.fn()
const mockInsertStl = vi.fn()
const mockFrom = vi.fn((table: string) => {
  if (table === 'stl_files') return { delete: mockDeleteStl, insert: mockInsertStl }
  return {}
})

vi.mock('../../../src/supabase/user-client.js', () => ({ createUserClient: () => ({ from: mockFrom }) }))

const { default: stlFiles } = await import('../../../src/routes/stl-files.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', 'contributor')
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', stlFiles)
  return app
}

describe('POST /:id/stl-files', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteStl.mockReturnValue({ eq: vi.fn(() => ({ error: null })) })
    mockInsertStl.mockReturnValue({ select: vi.fn(() => ({ data: [], error: null })) })
  })

  // Tests: POST /:id/stl-files deletes existing STL file records then inserts the new list, returning 201
  // How:   mockDeleteStl and mockInsertStl are verified to have been called; checks status 201
  // Chain: the upload wizard calls this on Step 5 Next (only when files were added) → the
  //        stl_files table is fully replaced so the tutorial always reflects the latest file list
  it('replaces STL files and returns 201', async () => {
    const files = [{ filename: 'bracket.stl', file_url: 'https://example.com/bracket.stl' }]
    const res = await makeApp().request('/tutorial-1/stl-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stl_files: files }),
    })
    expect(res.status).toBe(201)
    expect(mockDeleteStl).toHaveBeenCalled()
    expect(mockInsertStl).toHaveBeenCalled()
  })

  // Tests: POST /:id/stl-files returns 500 when the insert step fails
  // How:   mockInsertStl is overridden to return { data: null, error }; checks status 500
  // Chain: the upload wizard receives 500 → the UI displays an error and keeps the user on
  //        Step 5, preventing a tutorial from advancing with missing STL download links
  it('returns 500 when insert fails', async () => {
    mockInsertStl.mockReturnValue({ select: vi.fn(() => ({ data: null, error: { message: 'insert error' } })) })
    const files = [{ filename: 'bracket.stl', file_url: 'https://example.com/bracket.stl' }]
    const res = await makeApp().request('/tutorial-1/stl-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stl_files: files }),
    })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /:id/stl-files', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteStl.mockReturnValue({ eq: vi.fn(() => ({ error: null })) })
    mockInsertStl.mockReturnValue({ select: vi.fn(() => ({ data: [], error: null })) })
  })

  // Tests: DELETE /:id/stl-files removes all STL file records for a tutorial and returns 204
  // How:   mockDeleteStl is pre-configured to succeed; checks status 204
  // Chain: the edit page calls this when a user removes all STL files → the DB records are
  //        cleared and the tutorial detail page no longer shows any download links
  it('deletes STL files and returns 204', async () => {
    const res = await makeApp().request('/tutorial-1/stl-files', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })

  // Tests: DELETE /:id/stl-files returns 500 when the database delete fails
  // How:   mockDeleteStl is overridden to return { error: { message: 'delete error' } }; checks status 500
  // Chain: the edit page receives 500 → the UI displays a failure message and the existing
  //        STL file records remain in the DB unchanged
  it('returns 500 when delete fails', async () => {
    mockDeleteStl.mockReturnValue({ eq: vi.fn(() => ({ error: { message: 'delete error' } })) })
    const res = await makeApp().request('/tutorial-1/stl-files', { method: 'DELETE' })
    expect(res.status).toBe(500)
  })
})
