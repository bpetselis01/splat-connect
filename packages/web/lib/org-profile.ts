/**
 * The small rules the organisation profile and its editor share: where a
 * "How to work with them" door leads, and what a rate breakdown adds up to.
 */
import type { OrgDoorTarget, OrgRateLine } from '@splat-connect/types'

/**
 * Where each door's link goes, and its label. The editor's "where it takes
 * them" select writes the target; this is the one place it becomes a URL.
 * The toy library door stays on the page — the shelf is further down it.
 */
export function doorLink(target: OrgDoorTarget, orgId: string): { href: string; label: string } {
  switch (target) {
    case 'toy_library':
      return { href: '#org-toys', label: 'See the shelf' }
    case 'events':
      return { href: '/get-involved/events', label: 'See their events' }
    case 'dropoff':
      return { href: `/get-involved/recycling/drop-off?org=${orgId}`, label: 'Book a drop-off' }
    case 'print':
      return { href: '/printing', label: 'Find a guide' }
    case 'build':
      return { href: '/get-involved/requests/new', label: 'Ask for a build' }
    case 'message':
      return { href: `/organizations/${orgId}/message`, label: 'Message them' }
  }
}

/** "Asking back": the lines a family pays back. Covered lines are the org's. */
export function askingBackCents(lines: Pick<OrgRateLine, 'amount_cents' | 'claiming'>[]): number {
  return lines.filter((l) => l.claiming).reduce((sum, l) => sum + l.amount_cents, 0)
}

/** The byline a thanks is prefilled with: a first name, never a full one. */
export function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}
