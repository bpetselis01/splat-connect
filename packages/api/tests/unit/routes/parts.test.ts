import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockDeleteParts = vi.fn()
const mockInsertParts = vi.fn()
const mockFrom = vi.fn((table: string) => {
  if (table === 'parts') return { delete: mockDeleteParts, insert: mockInsertParts }
  return {}
})

vi.mock('../../../src/supabase/user-client.js', () => ({ createUserClient: () => ({ from: mockFrom }) }))

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

  it('deletes parts and returns 204', async () => {
    const res = await makeApp().request('/tutorial-1/parts', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })

  it('returns 500 when delete fails', async () => {
    mockDeleteParts.mockReturnValue({ eq: vi.fn(() => ({ error: { message: 'delete error' } })) })
    const res = await makeApp().request('/tutorial-1/parts', { method: 'DELETE' })
    expect(res.status).toBe(500)
  })
})
