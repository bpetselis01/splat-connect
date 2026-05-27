import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockDeleteTools = vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) }))
const mockInsertTools = vi.fn(() => ({ select: vi.fn(() => ({ data: [], error: null })) }))
const mockFrom = vi.fn((table: string) => {
  if (table === 'tools') return { delete: mockDeleteTools, insert: mockInsertTools }
  return {}
})

vi.mock('../../../src/supabase/user-client.js', () => ({ createUserClient: () => ({ from: mockFrom }) }))

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
  beforeEach(() => vi.clearAllMocks())

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
  beforeEach(() => vi.clearAllMocks())

  it('deletes tools and returns 204', async () => {
    const res = await makeApp().request('/tutorial-1/tools', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })

  it('returns 500 when delete fails', async () => {
    mockDeleteTools.mockReturnValue({ eq: vi.fn(() => ({ error: { message: 'delete error' } })) })
    const res = await makeApp().request('/tutorial-1/tools', { method: 'DELETE' })
    expect(res.status).toBe(500)
  })
})
