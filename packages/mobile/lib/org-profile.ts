// packages/mobile/lib/org-profile.ts
// Where an organisation's "How to work with them" door leads on the phone, and
// the byline a thanks starts with. Web's lib/org-profile.ts with its hrefs
// swapped for these routes.
import type { OrgDoorTarget } from '@splat-connect/types'

/**
 * A door's destination, or null where mobile has no screen for it yet (an
 * org's events) — the card still reads, it just is not a button.
 */
export function doorRoute(target: OrgDoorTarget, orgId: string): string | null {
  switch (target) {
    case 'toy_library':
      return '/toy-library'
    case 'events':
      return null
    case 'dropoff':
      return '/explore/recycling'
    case 'print':
      return '/printing'
    case 'build':
      return '/explore/makers-wanted/new'
    case 'message':
      return `/messages/org/${orgId}`
  }
}

/** "On SPLAT since 2024", from the row's own created_at. */
export function sinceYear(createdAt: string | null | undefined): number | null {
  const year = createdAt ? new Date(createdAt).getFullYear() : NaN
  return Number.isFinite(year) ? year : null
}
