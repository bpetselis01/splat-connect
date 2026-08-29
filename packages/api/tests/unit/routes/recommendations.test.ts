import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

// Same shape as stl-files.test.ts: the user client is replaced by delete and
// insert fakes on the one table this route touches.
const mockDelete = vi.fn()
const mockInsert = vi.fn()
const mockFrom = vi.fn((table: string) => {
  if (table === 'tutorial_recommendations') return { delete: mockDelete, insert: mockInsert }
  return {}
})

vi.mock('../../../src/supabase/user-client.js', () => ({ createUserClient: () => ({ from: mockFrom }) }))

const { default: recommendations } = await import('../../../src/routes/recommendations.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', 'contributor')
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', recommendations)
  return app
}

function post(body: unknown) {
  return makeApp().request('/tutorial-1/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /:id/recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDelete.mockReturnValue({ eq: vi.fn(() => ({ error: null })) })
    mockInsert.mockReturnValue({ select: vi.fn(() => ({ data: [], error: null })) })
  })

  // Position is the order the editor sent, from 1: it is what the public page
  // sorts by and what 048's unique constraint counts to enforce the cap.
  it('replaces the list and numbers rows by position from 1', async () => {
    const res = await post({ recommendations: [{ recommended_id: 'a' }, { recommended_id: 'b' }] })
    expect(res.status).toBe(201)
    expect(mockDelete).toHaveBeenCalled()
    expect(mockInsert.mock.calls[0][0]).toEqual([
      { tutorial_id: 'tutorial-1', recommended_id: 'a', position: 1 },
      { tutorial_id: 'tutorial-1', recommended_id: 'b', position: 2 },
    ])
  })

  // A fourth row, a duplicate or a self-reference is the database's refusal,
  // surfaced as the sub-resource's plain 500 — the editor never offers them.
  it('returns 500 when the insert is refused', async () => {
    mockInsert.mockReturnValue({ select: vi.fn(() => ({ data: null, error: { message: 'violates check constraint' } })) })
    const res = await post({ recommendations: [{ recommended_id: 'tutorial-1' }] })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /:id/recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDelete.mockReturnValue({ eq: vi.fn(() => ({ error: null })) })
  })

  it('clears the list and returns 204', async () => {
    const res = await makeApp().request('/tutorial-1/recommendations', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })
})
