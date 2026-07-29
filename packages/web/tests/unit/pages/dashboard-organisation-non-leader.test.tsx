import { describe, it, expect, vi } from 'vitest'

// Separate file from dashboard-organisation.test.tsx because vi.mock is
// hoisted per-module: that file already hard-codes a leader (ledOrgs with two
// orgs) at module level, so a non-leader case needs its own mock.
vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor' },
    isAdmin: false,
    isParent: false,
    ledOrgs: [],
    canAuthor: true,
  }),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn() },
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))

const Page = (await import('@/app/dashboard/organisation/page')).default

describe('Organisation tab — access control', () => {
  // Chain: the tab strip only HIDES this tab for a non-leader — an
  // affordance, not a control. notFound() in the page is the real control,
  // and nothing asserted it at any level before this (the E2E only checks
  // the tab is hidden).
  it('404s for a caller who leads no organisation', async () => {
    await expect(Page()).rejects.toThrow('NOT_FOUND')
  })
})
