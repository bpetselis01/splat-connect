import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockUserFrom = vi.fn()

// Every handler now asks which organisations the caller leads before scoping a
// query, so org_leaders is answered here rather than in each test's mock: these
// cases are about a person's own toys, where the answer is always "none".
// Tests that need a leader override it via mockLedOrgs.
let ledOrgs: Array<{ org_id: string }> = []
const mockLedOrgs = (orgIds: string[]) => {
  ledOrgs = orgIds.map((org_id) => ({ org_id }))
}

vi.mock('../../../src/supabase/user-client.js', () => ({
  createUserClient: () => ({
    from: (table: string) =>
      table === 'org_leaders'
        ? { select: () => ({ eq: () => Promise.resolve({ data: ledOrgs, error: null }) }) }
        : mockUserFrom(table),
  }),
}))

const { default: toys } = await import('../../../src/routes/toys.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('token', 'tok')
    await next()
  })
  app.route('/', toys)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  mockLedOrgs([])
})

describe('GET /', () => {
  it('returns 500 on a database error', async () => {
    mockUserFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
        }),
      }),
    })
    const res = await makeApp().request('/')
    expect(res.status).toBe(500)
  })

  it('returns the caller\'s toys newest first', async () => {
    const rows = [{ id: 't1', owner_id: 'user-1' }]
    mockUserFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: rows, error: null }),
        }),
      }),
    })
    const res = await makeApp().request('/')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(rows)
  })
})

describe('POST /', () => {
  it('returns 500 on a database error', async () => {
    mockUserFrom.mockReturnValue({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
        }),
      }),
    })
    const res = await makeApp().request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Fire truck', condition: 8 }),
    })
    expect(res.status).toBe(500)
  })

  it('creates a draft toy owned by the caller, ignoring a spoofed owner_id', async () => {
    let insertedWith: unknown
    mockUserFrom.mockReturnValue({
      insert: (row: unknown) => {
        insertedWith = row
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: 't1', ...(row as object) }, error: null }),
          }),
        }
      },
    })
    const res = await makeApp().request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Fire truck', condition: 8, owner_id: 'someone-else' }),
    })
    expect(res.status).toBe(200)
    expect(insertedWith).toMatchObject({ name: 'Fire truck', condition: 8, owner_id: 'user-1', status: 'draft' })
  })
})

// PATCH reads the row before updating it, to learn whether quantity is an
// editable field here — it is only ever an organisation's stock. This stubs
// that read; `null` stands for a row the caller has no claim on.
const patchRead = (data: unknown) => ({
  select: () => ({
    eq: () => ({ or: () => ({ maybeSingle: () => Promise.resolve({ data, error: null }) }) }),
  }),
})

describe('PATCH /:id', () => {
  it('returns 500 on a database error', async () => {
    mockUserFrom.mockReturnValue({
      ...patchRead({ owner_org_id: null }),
      update: () => ({
        eq: () => ({
          or: () => ({
            is: () => ({
              select: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
              }),
            }),
          }),
        }),
      }),
    })
    const res = await makeApp().request('/t1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New name' }),
    })
    expect(res.status).toBe(500)
  })

  it('maps a malformed id to 404', async () => {
    mockUserFrom.mockReturnValue({
      ...patchRead({ owner_org_id: null }),
      update: () => ({
        eq: () => ({
          or: () => ({
            is: () => ({
              select: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: { code: '22P02' } }),
              }),
            }),
          }),
        }),
      }),
    })
    const res = await makeApp().request('/not-a-uuid', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New name' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 for another owner\'s toy', async () => {
    // The read finds nothing, so the update never runs — a leader of a
    // different org gets exactly this, not a 403 that would confirm the row.
    mockUserFrom.mockReturnValue({
      ...patchRead(null),
      update: () => ({
        eq: () => ({
          or: () => ({
            is: () => ({
              select: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    })
    const res = await makeApp().request('/t1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New name' }),
    })
    expect(res.status).toBe(404)
  })

  it('filters out an archived toy, yielding 404', async () => {
    const isSpy = vi.fn(() => ({
      select: () => ({
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }),
    }))
    mockUserFrom.mockReturnValue({
      ...patchRead({ owner_org_id: null }),
      update: () => ({
        eq: () => ({
          or: () => ({
            is: isSpy,
          }),
        }),
      }),
    })
    const res = await makeApp().request('/t1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New name' }),
    })
    expect(res.status).toBe(404)
    expect(isSpy).toHaveBeenCalledWith('archived_at', null)
  })
})

describe('PATCH /:id/publish', () => {
  it('returns 500 when the fetch of the existing row fails', async () => {
    mockUserFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          or: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
          }),
        }),
      }),
    })
    const res = await makeApp().request('/t1/publish', { method: 'PATCH' })
    expect(res.status).toBe(500)
  })

  it('returns 404 for another owner\'s toy', async () => {
    mockUserFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          or: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    })
    const res = await makeApp().request('/t1/publish', { method: 'PATCH' })
    expect(res.status).toBe(404)
  })

  it('returns 400 with missing fields when cover photo is not set', async () => {
    mockUserFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          or: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: { cover_photo_url: null, switch_adapted: false, switch_photo_urls: [] },
                error: null,
              }),
          }),
        }),
      }),
    })
    const res = await makeApp().request('/t1/publish', { method: 'PATCH' })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.missing).toContain('Cover photo')
  })

  it('returns 400 with missing fields when switch-adapted but no switch photos', async () => {
    mockUserFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          or: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: { cover_photo_url: 'https://x/cover.jpg', switch_adapted: true, switch_photo_urls: [] },
                error: null,
              }),
          }),
        }),
      }),
    })
    const res = await makeApp().request('/t1/publish', { method: 'PATCH' })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.missing).toContain('Switch photo')
  })

  it('returns 400 with missing fields when offer type is not set', async () => {
    mockUserFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          or: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  cover_photo_url: 'https://x/cover.jpg',
                  switch_adapted: false,
                  switch_photo_urls: [],
                  offer_type: null,
                },
                error: null,
              }),
          }),
        }),
      }),
    })
    const res = await makeApp().request('/t1/publish', { method: 'PATCH' })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.missing).toContain('Offer type')
  })

  it('publishes when every precondition is met', async () => {
    mockUserFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          or: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  cover_photo_url: 'https://x/cover.jpg',
                  switch_adapted: false,
                  switch_photo_urls: [],
                  offer_type: 'donation',
                },
                error: null,
              }),
          }),
        }),
      }),
    })
    mockUserFrom.mockReturnValueOnce({
      update: () => ({
        eq: () => ({
          or: () => ({
            select: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: { id: 't1', status: 'published' }, error: null }),
            }),
          }),
        }),
      }),
    })
    const res = await makeApp().request('/t1/publish', { method: 'PATCH' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 't1', status: 'published' })
  })
})

describe('DELETE /:id', () => {
  it('returns 500 on a database error', async () => {
    mockUserFrom.mockReturnValue({
      delete: () => ({
        eq: () => ({
          or: () => ({
            is: () => ({
              select: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
              }),
            }),
          }),
        }),
      }),
    })
    const res = await makeApp().request('/t1', { method: 'DELETE' })
    expect(res.status).toBe(500)
  })

  it('deletes and returns the deleted row', async () => {
    mockUserFrom.mockReturnValue({
      delete: () => ({
        eq: () => ({
          or: () => ({
            is: () => ({
              select: () => ({
                maybeSingle: () => Promise.resolve({ data: { id: 't1' }, error: null }),
              }),
            }),
          }),
        }),
      }),
    })
    const res = await makeApp().request('/t1', { method: 'DELETE' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 't1' })
  })

  it('filters out an archived toy, yielding 404', async () => {
    const isSpy = vi.fn(() => ({
      select: () => ({
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }),
    }))
    mockUserFrom.mockReturnValue({
      delete: () => ({
        eq: () => ({
          or: () => ({
            is: isSpy,
          }),
        }),
      }),
    })
    const res = await makeApp().request('/t1', { method: 'DELETE' })
    expect(res.status).toBe(404)
    expect(isSpy).toHaveBeenCalledWith('archived_at', null)
  })
})
