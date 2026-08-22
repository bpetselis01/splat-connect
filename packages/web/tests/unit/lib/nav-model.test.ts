import { describe, it, expect } from 'vitest'
import { buildNav } from '@/lib/nav-model'
import type { Capabilities } from '@/lib/capabilities'
import type { Profile, Organization } from '@splat-connect/types'

const profile: Profile = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'contributor',
  created_at: '2026-01-01T00:00:00Z',
  public_showcase: true,
}

const org: Organization = {
  id: 'org-1',
  name: 'Alpha',
  description: null,
  status: 'active',
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function caps(over: Partial<Capabilities> = {}): Capabilities {
  return {
    profile,
    isAdmin: false,
    ledOrgs: [],
    canAuthor: true,
    unreadNotifications: 0,
    exchangeActions: 0,
    ...over,
  }
}

const headings = (groups: ReturnType<typeof buildNav>) => groups.map((g) => g.heading)
const hrefs = (groups: ReturnType<typeof buildNav>) =>
  groups.flatMap((g) => g.rows.map((r) => r.href))

describe('buildNav', () => {
  // Chain: leadership is granted by an admin, so an empty Organisation group
  //        would offer a capability the visitor cannot obtain.
  it('adds the Organisation group only when the account leads an org', () => {
    expect(headings(buildNav(caps({ ledOrgs: [org] }), 0))).toEqual([
      'Yours',
      'Organisation',
      'Account',
    ])
    expect(hrefs(buildNav(caps({ ledOrgs: [org] }), 0))).toContain('/dashboard/organisation')
  })

  // Pins the href, not just the label: the hub's accessible-name test covers
  // the heading, but nothing else asserts this row still points at the moved
  // tutorial list rather than the old /dashboard.
  it('points the Yours group\'s first row at /dashboard/tutorials', () => {
    expect(buildNav(caps(), 0)[0].rows[0].href).toBe('/dashboard/tutorials')
  })

  it('adds Admin to the Account group only for admins', () => {
    expect(hrefs(buildNav(caps(), 0))).not.toContain('/admin')
    expect(hrefs(buildNav(caps({ isAdmin: true }), 0))).toContain('/admin')
  })

  it('includes an Exchanges row for every account', () => {
    expect(hrefs(buildNav(caps(), 0))).toContain('/dashboard/exchanges')
  })

  // Chain: gating Child profiles on parenthood would mean the only way to create
  //        a child profile is to already have one. Capabilities no longer even
  //        carries an isParent flag, precisely because nothing may branch on it.
  it('shows Child profiles to accounts that are not yet parents', () => {
    expect(hrefs(buildNav(caps(), 0))).toContain('/dashboard/child')
  })

  it('labels the row for more than one child', () => {
    const labels = buildNav(caps(), 0).flatMap((g) => g.rows).map((r) => r.label)
    expect(labels).toContain('Child profiles')
  })

  it('marks the two unbuilt rows as soon, and no others', () => {
    const soon = buildNav(caps({ ledOrgs: [org], isAdmin: true }), 0)
      .flatMap((g) => g.rows)
      .filter((r) => r.soon)
      .map((r) => r.href)
    // Toy inventory left this list when the organisation shelf was built.
    // /printing left when the Browse group was deleted.
    expect(soon).toEqual([
      '/dashboard/print-requests',
      '/dashboard/organisation/orders',
    ])
  })

  // The spec's fifteenth row is Sign out, which is an action the rail footer
  // renders rather than a nav row — hence twelve here (eight plus
  // Notifications, Exchanges and Design challenges, minus Browse's four).
  it('builds twelve linked rows for a leader-admin', () => {
    const rows = buildNav(caps({ ledOrgs: [org], isAdmin: true }), 0).flatMap((g) => g.rows)
    expect(rows).toHaveLength(12)
  })

  it('includes a Design challenges row for every account', () => {
    expect(hrefs(buildNav(caps(), 0))).toContain('/dashboard/challenges')
  })

  it('gives every row a unique href', () => {
    const all = hrefs(buildNav(caps({ ledOrgs: [org], isAdmin: true }), 0))
    expect(new Set(all).size).toBe(all.length)
  })

  it('includes a Notifications row with no count when there are no unread notifications', () => {
    const row = buildNav(caps(), 0)
      .flatMap((g) => g.rows)
      .find((r) => r.href === '/notifications')
    expect(row).toBeDefined()
    expect(row?.count).toBeUndefined()
  })

  it('carries the unread count when there are unread notifications', () => {
    const row = buildNav(caps(), 3)
      .flatMap((g) => g.rows)
      .find((r) => r.href === '/notifications')
    expect(row?.count).toBe(3)
  })

  const exchangesRow = (over: Partial<Capabilities> = {}) =>
    buildNav(caps(over), 0)
      .flatMap((g) => g.rows)
      .find((r) => r.href === '/dashboard/exchanges')

  it('leaves the Exchanges row uncounted when nothing is waiting on the user', () => {
    expect(exchangesRow()?.count).toBeUndefined()
  })

  it('badges the Exchanges row with the number of transactions awaiting action', () => {
    expect(exchangesRow({ exchangeActions: 2 })?.count).toBe(2)
  })

  // Tests: the rail no longer carries public browse destinations
  // How:   builds nav for a plain account and asserts no group is headed Browse
  //        and no row points at a public catalogue
  // Chain: the header renders those four sections on every page now, so keeping
  //        them in the rail would be two controls competing at one level
  it('drops the Browse group now the header carries it', () => {
    const groups = buildNav(caps(), 0)
    expect(groups.map((g) => g.heading)).toEqual(['Yours', 'Account'])
    const hrefs = groups.flatMap((g) => g.rows.map((r) => r.href))
    expect(hrefs).not.toContain('/library')
    expect(hrefs).not.toContain('/toy-library')
    expect(hrefs).not.toContain('/printing')
    expect(hrefs).not.toContain('/organizations')
  })

  // Tests: every remaining row is an account-owned destination
  // How:   asserts each row href sits under /dashboard, /admin or /notifications
  // Chain: the rail is now the account section's secondary nav; a row outside it
  //        would be navigating out of the section it belongs to
  it('keeps only account destinations', () => {
    const rows = buildNav(caps(), 0).flatMap((g) => g.rows)
    for (const row of rows) {
      expect(row.href).toMatch(/^\/(dashboard|admin|notifications)/)
    }
  })
})
