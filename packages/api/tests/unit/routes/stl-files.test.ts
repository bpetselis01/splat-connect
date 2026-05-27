import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockDeleteStl = vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) }))
const mockInsertStl = vi.fn(() => ({ select: vi.fn(() => ({ data: [], error: null })) }))
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
  beforeEach(() => vi.clearAllMocks())

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
  beforeEach(() => vi.clearAllMocks())

  it('deletes STL files and returns 204', async () => {
    const res = await makeApp().request('/tutorial-1/stl-files', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })

  it('returns 500 when delete fails', async () => {
    mockDeleteStl.mockReturnValue({ eq: vi.fn(() => ({ error: { message: 'delete error' } })) })
    const res = await makeApp().request('/tutorial-1/stl-files', { method: 'DELETE' })
    expect(res.status).toBe(500)
  })
})
