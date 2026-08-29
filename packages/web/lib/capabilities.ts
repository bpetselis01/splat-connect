/**
 * The single answer to "what may this user do".
 *
 * Capability is derived from data the schema already holds rather than read from
 * profiles.role — every signed-in account is a contributor account:
 * - admin      role = 'admin' (the only capability the column still carries)
 * - author     any signed-in account (009 widened is_approved_contributor)
 * - leader     has an org_leaders row, via GET /api/organizations/mine
 *
 * There is deliberately no `isParent`. It used to be derived from a
 * /api/child-profile fetch here, but nothing ever branched on it: "Child
 * profile" is an unconditional nav row (gating it would mean the only way to
 * create a child profile is to already have one — lib/nav-model.ts), and
 * app/dashboard/child fetches the row itself because it needs the body, not a
 * boolean. Since this call now runs in the root layout on every cold page
 * load, that unread fetch cost every signed-in page one HTTP round trip and
 * one GoTrue getUser() inside the API. Re-derive it here only when something
 * actually branches on it.
 *
 * Wrapped in React cache() so a layout and its page share one round of fetches.
 *
 * Related files:
 * - supabase/migrations/009_shared_account_capability.sql: the authoring widening
 * - lib/org-access.ts: the per-organisation check this generalises
 */
import { cache } from 'react'
import { apiClient } from '@/lib/api-client'
import type { Profile, Organization, UnreadCounts } from '@splat-connect/types'

export type Capabilities = {
  profile: Profile
  isAdmin: boolean
  ledOrgs: Organization[]
  /** The same unread total, split by which My SPLAT card owns it. */
  unread: UnreadCounts
  /** Transactions waiting on this user, for the My exchanges badge in the rail. */
  exchangeActions: number
}

export const getCapabilities = cache(async (): Promise<Capabilities | null> => {
  let profile: Profile
  try {
    profile = await apiClient.get<Profile>('/api/contributors/me')
  } catch {
    // No profile means no user. Not degradable.
    return null
  }

  // In parallel, since none of the three depends on the others and this runs in
  // the root layout on every cold page load — sequential awaits made each new
  // capability cost another round trip on every signed-in page.
  //
  // Each degrades to "capability absent" on failure so one flaky fetch hides one
  // nav group or badge rather than blanking the dashboard.
  const [ledOrgs, unread, exchangeActions] = await Promise.all([
    apiClient.get<Organization[]>('/api/organizations/mine').catch(() => [] as Organization[]),
    apiClient
      .get<UnreadCounts>('/api/notifications/me/unread-counts')
      .catch(() => ({ tutorials: 0, exchanges: 0, challenges: 0, total: 0 }) as UnreadCounts),
    apiClient
      .get<{ count: number }>('/api/toy-transactions/action-count')
      .then((r) => r.count)
      .catch(() => 0),
  ])

  return {
    profile,
    isAdmin: profile.role === 'admin',
    ledOrgs,
    unread,
    exchangeActions,
  }
})
