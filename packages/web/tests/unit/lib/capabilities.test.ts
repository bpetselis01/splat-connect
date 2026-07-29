import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mock strategy ---
// api-client is mocked at the module level so getCapabilities never makes a real HTTP call.
// `route()` below maps each of the three endpoints to a resolved value or a rejected Error,
// matching the shape lib/org-access.ts already relies on (catch -> degrade). Each test calls
// vi.resetModules() + a fresh dynamic import so getCapabilities' react cache() (which does not
// memoize outside a request scope — see the module's own comment) starts clean per case.
const get = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (path: string) => get(path) } }))

const PROFILE = { id: 'u1', name: 'Ada', email: 'ada@example.com', role: 'contributor' }

function route(overrides: Record<string, unknown>) {
  get.mockImplementation((path: string) => {
    if (path in overrides) {
      const v = overrides[path]
      return v instanceof Error ? Promise.reject(v) : Promise.resolve(v)
    }
    throw new Error(`unexpected path ${path}`)
  })
}

beforeEach(() => {
  get.mockReset()
  vi.resetModules()
})

async function subject() {
  const { getCapabilities } = await import('@/lib/capabilities')
  return getCapabilities()
}

describe('getCapabilities', () => {
  // Tests: isParent is derived from the presence of a child-profile row, not from profiles.role
  // How:   /api/child-profile resolves to a row; checks isParent is true
  // Chain: this is what lets one account be both a parent and a contributor at once —
  //        the dashboard shows the parent tab based on data, not on a role that can only hold one value
  it('reports isParent from a child profile row, not from the role', async () => {
    route({
      '/api/contributors/me': PROFILE,
      '/api/child-profile': { parent_id: 'u1', age: 7 },
      '/api/organizations/mine': [],
    })
    const caps = await subject()
    expect(caps?.isParent).toBe(true)
  })

  // Tests: isParent is false when the child-profile endpoint has nothing for this account
  // How:   /api/child-profile resolves to null; checks isParent is false
  // Chain: matches the Task 4 contract — GET /api/child-profile returns 200/null for a
  //        non-parent rather than 403, so this must not read the null as an error
  it('reports isParent false when there is no child profile row', async () => {
    route({
      '/api/contributors/me': PROFILE,
      '/api/child-profile': null,
      '/api/organizations/mine': [],
    })
    expect((await subject())?.isParent).toBe(false)
  })

  // Tests: ledOrgs surfaces the organisations returned by /api/organizations/mine
  // How:   the endpoint resolves to one organisation; checks ledOrgs has length 1
  // Chain: leadership is per-organisation data (middleware.ts:18-20), the same source
  //        lib/org-access.ts already reads — this generalises that check, it doesn't replace the data
  it('reports led organisations', async () => {
    route({
      '/api/contributors/me': PROFILE,
      '/api/child-profile': null,
      '/api/organizations/mine': [{ id: 'o1', name: 'Splat', status: 'active' }],
    })
    expect((await subject())?.ledOrgs).toHaveLength(1)
  })

  // Tests: canAuthor is true for every signed-in account regardless of role
  // How:   profile has role 'parent'; checks canAuthor is true
  // Chain: migration 009 widened is_approved_contributor to every account, so authoring is
  //        no longer role-gated — canAuthor reflects that rather than checking role === 'contributor'
  it('reports canAuthor for every signed-in account', async () => {
    route({
      '/api/contributors/me': { ...PROFILE, role: 'parent' },
      '/api/child-profile': null,
      '/api/organizations/mine': [],
    })
    expect((await subject())?.canAuthor).toBe(true)
  })

  // Tests: isAdmin is read from profiles.role, the one capability still held there
  // How:   profile has role 'admin'; checks isAdmin is true
  // Chain: admin is the sole capability the role column still carries after 009 — the
  //        admin-only pages gate on this flag instead of comparing role to 'admin' directly
  it('reports isAdmin from the role column', async () => {
    route({
      '/api/contributors/me': { ...PROFILE, role: 'admin' },
      '/api/child-profile': null,
      '/api/organizations/mine': [],
    })
    expect((await subject())?.isAdmin).toBe(true)
  })

  // Tests: a failed led-orgs fetch degrades to an empty list instead of failing the whole call
  // How:   /api/organizations/mine rejects; checks ledOrgs is []
  // Chain: one flaky sub-fetch must hide one capability (no org workspace shown), never
  //        blank the whole dashboard by throwing past getCapabilities
  it('degrades a failed led-orgs fetch to an empty list', async () => {
    route({
      '/api/contributors/me': PROFILE,
      '/api/child-profile': null,
      '/api/organizations/mine': new Error('boom'),
    })
    const caps = await subject()
    expect(caps?.ledOrgs).toEqual([])
  })

  // Tests: a failed child-profile fetch degrades to isParent: false instead of failing the whole call
  // How:   /api/child-profile rejects; checks isParent is false
  // Chain: same degrade-one-capability rule as ledOrgs — a flaky child-profile fetch hides
  //        the parent tab, it does not take down contributor or admin capabilities with it
  it('degrades a failed child-profile fetch to not-a-parent', async () => {
    route({
      '/api/contributors/me': PROFILE,
      '/api/child-profile': new Error('boom'),
      '/api/organizations/mine': [],
    })
    expect((await subject())?.isParent).toBe(false)
  })

  // Tests: a failed profile fetch returns null instead of a capabilities object with defaults
  // How:   /api/contributors/me rejects; checks the whole result is null
  // Chain: no profile means no user — this is the one fetch that is not degradable, since
  //        every other field depends on there being a profile to attach it to
  it('returns null when the profile fetch fails', async () => {
    route({
      '/api/contributors/me': new Error('401'),
      '/api/child-profile': null,
      '/api/organizations/mine': [],
    })
    expect(await subject()).toBeNull()
  })
})
