/**
 * Which navigation rows an account sees.
 *
 * The successor to the tab array that lived in app/dashboard/layout.tsx: the
 * same "what may this user reach" question, one level richer. Kept pure — no
 * React, no Next imports — so it is tested by calling it, not by rendering.
 *
 * Rows are named for what they hold, not for who holds them. There is no
 * "Contributor" group: capability is derived from data, not read from a role
 * column (see lib/capabilities.ts), and one account is routinely both a parent
 * and an author.
 *
 * Browse rows are gone as of 2026-08-21: the public top bar renders on every
 * page now, signed in or out, so the seven sections are always one click away
 * and duplicating four of them here put two navs at one level.
 *
 * An affordance, not a control. Every page re-checks its own access — see
 * lib/org-access.ts for the same rule stated about organisations.
 *
 * Related files:
 * - lib/capabilities.ts: where the input comes from
 * - components/rail.tsx: the only consumer
 */
import type { Capabilities } from '@/lib/capabilities'

export type IconName =
  | 'book'
  | 'toy'
  | 'printer'
  | 'building'
  | 'file'
  | 'box'
  | 'clipboard'
  | 'child'
  | 'inbox'
  | 'shelf'
  | 'orders'
  | 'user'
  | 'shield'
  | 'bell'
  | 'handshake'

/** `soon` marks a route that exists but has no feature behind it yet. */
export type NavRow = {
  href: string
  label: string
  icon: IconName
  soon?: boolean
  count?: number
}

export type NavGroup = { heading: string; rows: NavRow[] }

export function buildNav(caps: Capabilities, unreadNotifications: number): NavGroup[] {
  const groups: NavGroup[] = [
    {
      heading: 'Yours',
      rows: [
        // Moved off /dashboard on 2026-08-21: that URL is the account section's
        // hub now, the way /learn and /get-involved are hubs for theirs.
        { href: '/dashboard/tutorials', label: 'My tutorials', icon: 'file' },
        { href: '/dashboard/toys', label: 'My toys', icon: 'box' },
        {
          href: '/dashboard/exchanges',
          label: 'Exchanges',
          icon: 'handshake',
          // Requests to answer and handoffs to confirm — the same rows the list
          // marks "waiting on you". See needsAction in @splat-connect/types.
          count: caps.exchangeActions || undefined,
        },
        // 'clipboard' rather than 'file' (My tutorials, above): this row lists
        // ideas submitted for review, not the guides someone authored.
        { href: '/dashboard/challenges', label: 'Design challenges', icon: 'clipboard' },
        {
          href: '/dashboard/print-requests',
          label: 'My print requests',
          icon: 'clipboard',
          soon: true,
        },
        // Shown to non-parents too: filling it in is what makes them a parent.
        { href: '/dashboard/child', label: 'Child profiles', icon: 'child' },
      ],
    },
  ]

  // Leadership cannot be self-started — an admin grants it — so an empty group
  // here would advertise something the visitor has no way to obtain.
  if (caps.ledOrgs.length > 0) {
    groups.push({
      heading: 'Organisation',
      rows: [
        // "Review queue", not "Manage team": no page anywhere lets a leader
        // add a member or create an org. The label names what exists.
        { href: '/dashboard/organisation', label: 'Review queue', icon: 'inbox' },
        { href: '/dashboard/organisation/toys', label: 'Toy inventory', icon: 'shelf' },
        {
          href: '/dashboard/organisation/orders',
          label: 'Print orders',
          icon: 'orders',
          soon: true,
        },
      ],
    })
  }

  groups.push({
    heading: 'Account',
    rows: [
      {
        href: '/notifications',
        label: 'Notifications',
        icon: 'bell',
        count: unreadNotifications || undefined,
      },
      { href: '/dashboard/profile', label: 'Profile', icon: 'user' },
      ...(caps.isAdmin
        ? [{ href: '/admin', label: 'Admin', icon: 'shield' as const }]
        : []),
    ],
  })

  return groups
}
