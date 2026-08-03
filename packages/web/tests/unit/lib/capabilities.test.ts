import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mock strategy ---
// api-client is mocked at the module level so getCapabilities never makes a real HTTP call.
// `route()` below maps each endpoint to a resolved value or a rejected Error,
// and throws on anything else — which is what keeps the removed /api/child-profile fetch
// removed: re-adding it fails every test in this file rather than silently costing a round
// trip on every signed-in page render (it runs in the root layout).
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
  // Tests: getCapabilities fetches nothing whose result it does not return
  // How:   resolves both endpoints, then checks the exact set of paths requested
  // Chain: this call sits in the root layout (components/app-shell.tsx), so every extra
  //        endpoint here costs every signed-in page one HTTP round trip and one GoTrue
  //        getUser() inside the API on every cold load. /api/child-profile was fetched to
  //        derive an isParent nobody branched on; app/dashboard/child fetches the row
  //        itself because it needs the body. Nothing may be added back without a reader.
  it('fetches only the profile, the led organisations, and the unread count', async () => {
    route({
      '/api/contributors/me': PROFILE,
      '/api/organizations/mine': [],
      '/api/notifications/me/unread-count': { count: 0 },
    })
    await subject()
    expect(get.mock.calls.map(([path]) => path).sort()).toEqual([
      '/api/contributors/me',
      '/api/notifications/me/unread-count',
      '/api/organizations/mine',
    ])
  })

  // Tests: ledOrgs surfaces the organisations returned by /api/organizations/mine
  // How:   the endpoint resolves to one organisation; checks ledOrgs has length 1
  // Chain: leadership is per-organisation data (middleware.ts:18-20), the same source
  //        lib/org-access.ts already reads — this generalises that check, it doesn't replace the data
  it('reports led organisations', async () => {
    route({
      '/api/contributors/me': PROFILE,
      '/api/organizations/mine': [{ id: 'o1', name: 'Splat', status: 'active' }],
      '/api/notifications/me/unread-count': { count: 0 },
    })
    expect((await subject())?.ledOrgs).toHaveLength(1)
  })

  // Tests: isAdmin is read from profiles.role, the one capability still held there
  // How:   profile has role 'admin'; checks isAdmin is true
  // Chain: admin is the sole capability the role column still carries after 009 — the
  //        admin-only pages gate on this flag instead of comparing role to 'admin' directly
  it('reports isAdmin from the role column', async () => {
    route({
      '/api/contributors/me': { ...PROFILE, role: 'admin' },
      '/api/organizations/mine': [],
      '/api/notifications/me/unread-count': { count: 0 },
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
      '/api/organizations/mine': new Error('boom'),
      '/api/notifications/me/unread-count': { count: 0 },
    })
    const caps = await subject()
    expect(caps?.ledOrgs).toEqual([])
  })

  // Tests: a failed profile fetch returns null instead of a capabilities object with defaults
  // How:   /api/contributors/me rejects; checks the whole result is null
  // Chain: no profile means no user — this is the one fetch that is not degradable, since
  //        every other field depends on there being a profile to attach it to
  it('returns null when the profile fetch fails', async () => {
    route({
      '/api/contributors/me': new Error('401'),
      '/api/organizations/mine': [],
    })
    expect(await subject()).toBeNull()
  })
})
