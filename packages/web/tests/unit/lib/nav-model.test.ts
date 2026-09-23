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
    unread: { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 },
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
    expect(headings(buildNav(caps({ ledOrgs: [org] })))).toEqual([
      'Add a tutorial',
      'Exchange a toy',
      'Give us a challenge',
      'Print requests',
      'Out in the world',
      'Organisation',
      'Account',
    ])
    expect(hrefs(buildNav(caps({ ledOrgs: [org] })))).toContain('/dashboard/organisation')
  })

  // Pins the href, not just the label: the hub's accessible-name test covers
  // the heading, but nothing else asserts this row still points at the moved
  // tutorial list rather than the old /dashboard.
  it('points the Add a tutorial group\'s first row at /dashboard/tutorials', () => {
    expect(buildNav(caps())[0].rows[0].href).toBe('/dashboard/tutorials')
  })

  it('adds Admin to the Account group only for admins', () => {
    expect(hrefs(buildNav(caps()))).not.toContain('/admin')
    expect(hrefs(buildNav(caps({ isAdmin: true })))).toContain('/admin')
  })

  it('includes a My exchanges row for every account', () => {
    expect(hrefs(buildNav(caps()))).toContain('/dashboard/exchanges')
  })

  it('includes a Submit an idea row that points outside the account section', () => {
    expect(hrefs(buildNav(caps()))).toContain('/get-involved/submit-an-idea')
  })

  it('marks no row as soon, because every destination is now built', () => {
    const soon = buildNav(caps({ ledOrgs: [org], isAdmin: true }))
      .flatMap((g) => g.rows)
      .filter((r) => r.soon)
      .map((r) => r.href)
    // Toy inventory left this list when the organisation shelf was built.
    // /printing left when the Browse group was deleted. The last two — my print
    // requests and the org's print orders — left with 058.
    //
    // The assertion stays rather than being deleted with the last `soon`: the
    // field is what stops a rail advertising a door that does not open, and a
    // row added with it set should have to say so here.
    expect(soon).toEqual([])
  })

  // Same total as before Child profiles moved to the Account page: it left
  // and Submit an idea arrived in its place.
  it('builds twenty-one linked rows for a leader-admin', () => {
    const rows = buildNav(caps({ ledOrgs: [org], isAdmin: true })).flatMap((g) => g.rows)
    // Fourteen after 058 added Print for others; seventeen after 059 added the
    // organisation's own three — events and stories, recycling intake, and the
    // profile editor; twenty-one after 077 added the organisation's messages.
    expect(rows).toHaveLength(21)
  })

  it('includes a Design challenges row for every account', () => {
    expect(hrefs(buildNav(caps()))).toContain('/dashboard/challenges')
  })

  it('gives every row a unique href', () => {
    const all = hrefs(buildNav(caps({ ledOrgs: [org], isAdmin: true })))
    expect(new Set(all).size).toBe(all.length)
  })

  it('includes a Notifications row with no count when there are no unread notifications', () => {
    const row = buildNav(caps())
      .flatMap((g) => g.rows)
      .find((r) => r.href === '/notifications')
    expect(row).toBeDefined()
    expect(row?.count).toBeUndefined()
  })

  it('carries the unread count when there are unread notifications', () => {
    const row = buildNav(caps({ unread: { tutorials: 1, exchanges: 1, challenges: 1, organisations: 0, total: 3 } }))
      .flatMap((g) => g.rows)
      .find((r) => r.href === '/notifications')
    expect(row?.count).toBe(3)
  })

  const exchangesRow = (over: Partial<Capabilities> = {}) =>
    buildNav(caps(over))
      .flatMap((g) => g.rows)
      .find((r) => r.href === '/dashboard/exchanges')

  it('leaves the My exchanges row uncounted when nothing is waiting on the user', () => {
    expect(exchangesRow()?.count).toBeUndefined()
  })

  it('badges the My exchanges row with the number of transactions awaiting action', () => {
    expect(exchangesRow({ exchangeActions: 2 })?.count).toBe(2)
  })

  // Tests: the rail no longer carries public browse destinations
  // How:   builds nav for a plain account and asserts no group is headed Browse
  //        and no row points at a public catalogue
  // Chain: the header renders those four sections on every page now, so keeping
  //        them in the rail would be two controls competing at one level
  it('drops the Browse group now the header carries it', () => {
    const groups = buildNav(caps())
    expect(groups.map((g) => g.heading)).toEqual([
      'Add a tutorial',
      'Exchange a toy',
      'Give us a challenge',
      'Print requests',
      'Out in the world',
      'Account',
    ])
    const hrefs = groups.flatMap((g) => g.rows.map((r) => r.href))
    expect(hrefs).not.toContain('/library')
    expect(hrefs).not.toContain('/toy-library')
    expect(hrefs).not.toContain('/printing')
    expect(hrefs).not.toContain('/organizations')
  })

  // Tests: every row is an account-owned destination, aside from the two that
  //        deliberately cross out to a public page
  // How:   asserts each other row href sits under /dashboard, /admin or /notifications
  // Chain: this model is the hub's door list; a row outside the account section
  //        is navigating out of it, which needs a reason each time. Submit an
  //        idea has one (the idea form is public), and so does Recycle plastic
  //        — recycling has no "mine" screen at all, because a drop-off is a
  //        booking with one organisation
  it('keeps only account destinations, aside from two named public ones', () => {
    const outward = ['/get-involved/submit-an-idea', '/get-involved/recycling']
    const rows = buildNav(caps()).flatMap((g) => g.rows)
    for (const row of rows) {
      if (outward.includes(row.href)) continue
      expect(row.href).toMatch(/^\/(dashboard|admin|notifications)/)
    }
  })

  /**
   * One row, two surfaces. The rail shows it and so does My SPLAT, because the
   * hub is built from this model — which is why adding it here was the whole of
   * decision 8 rather than two separate changes.
   */
  it('puts Saved first in the Account group, ahead of Notifications', () => {
    const account = buildNav(caps()).find((g) => g.heading === 'Account')!
    expect(account.rows.map((r) => r.label)).toEqual(['Saved', 'Notifications', 'Account'])
    expect(account.rows[0].href).toBe('/dashboard/saved')
  })
})
