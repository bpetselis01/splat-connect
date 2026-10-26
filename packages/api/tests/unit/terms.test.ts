import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AGREEMENT_VERSIONS } from '@splat-connect/types'

let agreements: { data: unknown; error: { message: string } | null }

const chain = (result: () => unknown): unknown =>
  new Proxy(() => {}, {
    get: (_t, prop) => (prop === 'then' ? (ok: (v: unknown) => void) => ok(result()) : () => chain(result)),
    apply: () => chain(result),
  })

vi.mock('../../src/supabase/client.js', () => ({
  createAdminClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'member-1' } }, error: null }) },
    from: (table: string) => chain(() => (table === 'profiles' ? { data: { role: 'admin' }, error: null } : { data: null, error: null })),
  }),
  createUserClient: () => ({ from: (table: string) => chain(() => (table === 'user_agreements' ? agreements : { data: null, error: null })) }),
}))

const { default: app } = await import('../../src/app.js')
const { TERMS_GATED, requireContributorTerms } = await import('../../src/terms.js')

const ID = '00000000-0000-4000-8000-000000000000'
const concrete = (path: string) => path.replace(/:[A-Za-z_]+/g, ID)
const call = (method: string, path: string) =>
  app.request(concrete(path), { method, headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : '{}' })

beforeEach(() => {
  agreements = { data: [], error: null }
})

describe('TERMS_GATED', () => {
  it.each(TERMS_GATED.map((r) => [r.method, r.path]))('%s %s is a route the app serves', (method, path) => {
    expect(app.routes.some((r) => r.method === method && r.path === path && r.handler !== requireContributorTerms)).toBe(true)
  })

  it.each(TERMS_GATED.map((r) => [r.method, r.path]))('%s %s refuses an admin without the current terms', async (method, path) => {
    const res = await call(method, path)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'terms_required', version: AGREEMENT_VERSIONS.contributor_terms })
  })
})

describe('requireContributorTerms', () => {
  it('lets a member with the current terms through to the route', async () => {
    agreements = { data: [{ id: 'a1' }], error: null }
    const res = await call('POST', '/api/toy-transactions/:id/messages')
    expect(await res.json()).not.toEqual(expect.objectContaining({ error: 'terms_required' }))
  })

  it('fails closed and logs the route when the lookup errors', async () => {
    agreements = { data: null, error: { message: 'connection refused' } }
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await call('POST', '/api/organizations/:id/events')
    expect(res.status).toBe(403)
    expect(log).toHaveBeenCalledWith(`[terms] lookup failed route=POST /api/organizations/${ID}/events user=member-1:`, 'connection refused')
    log.mockRestore()
  })

  it.each([
    ['POST', '/api/agreements'],
    ['POST', '/api/organizations/:id/follow'],
    ['POST', '/api/organizations/:id/thanks'],
    ['GET', '/api/organizations/:id/events'],
    ['GET', '/api/toy-transactions/:id'],
  ])('never gates %s %s', async (method, path) => {
    expect(app.routes.some((r) => r.method === method && r.path === path)).toBe(true)
    const res = await call(method, path)
    expect(await res.json().catch(() => null)).not.toEqual(expect.objectContaining({ error: 'terms_required' }))
  })
})
