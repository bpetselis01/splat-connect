import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'
import type { Role } from '@splat-connect/types'

const mockUserFrom = vi.fn()

// child-profile writes go through the user client so RLS enforces parent_id scoping.
vi.mock('../../../src/supabase/user-client.js', () => ({ createUserClient: () => ({ from: mockUserFrom }) }))

const { default: childProfile } = await import('../../../src/routes/child-profile.js')

function makeApp(role: Role = 'parent') {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', role)
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', childProfile)
  return app
}

describe('GET /', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the parent\'s child profile', async () => {
    mockUserFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => ({ data: { id: 'cp-1', parent_id: 'user-1', age: 5 }, error: null }) }) }),
    })
    const res = await makeApp().request('/')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.parent_id).toBe('user-1')
  })

  it('returns null when no profile exists yet', async () => {
    mockUserFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => ({ data: null, error: null }) }) }),
    })
    const res = await makeApp().request('/')
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('returns 500 on DB error', async () => {
    mockUserFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => ({ data: null, error: { message: 'boom' } }) }) }),
    })
    const res = await makeApp().request('/')
    expect(res.status).toBe(500)
  })

  it('returns 403 for a non-parent role', async () => {
    const res = await makeApp('contributor').request('/')
    expect(res.status).toBe(403)
  })
})

describe('PUT /', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts editable fields and returns the row', async () => {
    let captured: any
    mockUserFrom.mockReturnValue({
      upsert: (row: any) => { captured = row; return { select: () => ({ single: () => ({ data: { id: 'cp-1', ...row }, error: null }) }) } },
    })
    const res = await makeApp().request('/', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ age: 5, macs_level: 'II' }),
    })
    expect(res.status).toBe(200)
    expect(captured.parent_id).toBe('user-1')
    expect(captured.age).toBe(5)
    expect(captured.macs_level).toBe('II')
  })

  it('ignores non-whitelisted / injected fields', async () => {
    let captured: any
    mockUserFrom.mockReturnValue({
      upsert: (row: any) => { captured = row; return { select: () => ({ single: () => ({ data: row, error: null }) }) } },
    })
    await makeApp().request('/', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ age: 5, id: 'evil', parent_id: 'other-user', role: 'admin' }),
    })
    expect(captured.parent_id).toBe('user-1') // forced, not client-controlled
    expect(captured.id).toBeUndefined()
    expect(captured.role).toBeUndefined()
  })

  it('returns 403 for a non-parent role', async () => {
    const res = await makeApp('admin').request('/', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ age: 5 }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 400 for a non-object body', async () => {
    const res = await makeApp().request('/', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(5),
    })
    expect(res.status).toBe(400)
  })

  it('returns 500 on DB error', async () => {
    mockUserFrom.mockReturnValue({
      upsert: () => ({ select: () => ({ single: () => ({ data: null, error: { message: 'boom' } }) }) }),
    })
    const res = await makeApp().request('/', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ age: 5 }),
    })
    expect(res.status).toBe(500)
  })
})
