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
    ...over,
  }
}

const headings = (groups: ReturnType<typeof buildNav>) => groups.map((g) => g.heading)
const hrefs = (groups: ReturnType<typeof buildNav>) =>
  groups.flatMap((g) => g.rows.map((r) => r.href))

describe('buildNav', () => {
  it('gives a plain contributor three groups, without Organisation', () => {
    expect(headings(buildNav(caps(), 0))).toEqual(['Browse', 'Yours', 'Account'])
  })

  // Chain: leadership is granted by an admin, so an empty Organisation group
  //        would offer a capability the visitor cannot obtain.
  it('adds the Organisation group only when the account leads an org', () => {
    expect(headings(buildNav(caps({ ledOrgs: [org] }), 0))).toEqual([
      'Browse',
      'Yours',
      'Organisation',
      'Account',
    ])
    expect(hrefs(buildNav(caps({ ledOrgs: [org] }), 0))).toContain('/dashboard/organisation')
  })

  it('adds Admin to the Account group only for admins', () => {
    expect(hrefs(buildNav(caps(), 0))).not.toContain('/admin')
    expect(hrefs(buildNav(caps({ isAdmin: true }), 0))).toContain('/admin')
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

  it('marks the four unbuilt rows as soon, and no others', () => {
    const soon = buildNav(caps({ ledOrgs: [org], isAdmin: true }), 0)
      .flatMap((g) => g.rows)
      .filter((r) => r.soon)
      .map((r) => r.href)
    expect(soon).toEqual([
      '/printing',
      '/dashboard/print-requests',
      '/dashboard/organisation/toys',
      '/dashboard/organisation/orders',
    ])
  })

  // The spec's fifteenth row is Sign out, which is an action the rail footer
  // renders rather than a nav row — hence fourteen here (thirteen plus
  // Notifications).
  it('builds fourteen linked rows for a leader-admin', () => {
    const rows = buildNav(caps({ ledOrgs: [org], isAdmin: true }), 0).flatMap((g) => g.rows)
    expect(rows).toHaveLength(14)
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
})
