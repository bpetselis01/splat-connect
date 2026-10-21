import { describe, it, expect, vi, beforeEach } from 'vitest'

// Separate file from dashboard-organisation.test.tsx because vi.mock is
// hoisted per-module: that file already hard-codes a leader (ledOrgs with two
// orgs) at module level, so a non-leader case needs its own mock.
const caps = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => caps.current,
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn() },
}))

const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`)
  }),
)
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
  redirect,
}))

const pages = {
  tab: (await import('@/app/dashboard/organisation/page')).default,
  publish: (await import('@/app/dashboard/organisation/publish/page')).default,
  newStory: (await import('@/app/dashboard/organisation/stories/new/page')).default,
}

beforeEach(() => {
  redirect.mockClear()
  caps.current = {
    profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [],
  }
})

describe('Organisation pages — access control', () => {
  // Chain: the tab strip only HIDES the tab for a non-leader — an affordance,
  // not a control. The page is the real control, and the E2E only checks the
  // tab is hidden.
  it('WB37 sends a signed-in caller who leads no organisation to the dashboard with a note', async () => {
    await expect(pages.tab()).rejects.toThrow('REDIRECT /dashboard?notice=org-leaders-only')
  })

  it('WB37 does the same for every organisation page, not only the tab', async () => {
    await expect(pages.publish()).rejects.toThrow('REDIRECT /dashboard?notice=org-leaders-only')
    await expect(pages.newStory()).rejects.toThrow('REDIRECT /dashboard?notice=org-leaders-only')
  })

  it('WB37 sends a signed-out visitor to sign in and back to the page they asked for', async () => {
    caps.current = null
    await expect(pages.publish()).rejects.toThrow('REDIRECT /login?next=%2Fdashboard%2Forganisation%2Fpublish')
  })
})
