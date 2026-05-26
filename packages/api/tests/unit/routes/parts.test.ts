import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockDeleteParts = vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) }))
const mockInsertParts = vi.fn(() => ({ select: vi.fn(() => ({ data: [], error: null })) }))
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
  beforeEach(() => vi.clearAllMocks())

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
})

describe('DELETE /:id/parts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes parts and returns 204', async () => {
    const res = await makeApp().request('/tutorial-1/parts', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })
})
