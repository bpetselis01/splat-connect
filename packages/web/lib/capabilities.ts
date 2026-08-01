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
import type { Profile, Organization } from '@splat-connect/types'

export type Capabilities = {
  profile: Profile
  isAdmin: boolean
  ledOrgs: Organization[]
  canAuthor: boolean
}

export const getCapabilities = cache(async (): Promise<Capabilities | null> => {
  let profile: Profile
  try {
    profile = await apiClient.get<Profile>('/api/contributors/me')
  } catch {
    // No profile means no user. Not degradable.
    return null
  }

  // Degrades to "capability absent" on failure so one flaky fetch hides one
  // nav group rather than blanking the dashboard.
  const ledOrgs = await apiClient
    .get<Organization[]>('/api/organizations/mine')
    .catch(() => [] as Organization[])

  return {
    profile,
    isAdmin: profile.role === 'admin',
    ledOrgs,
    canAuthor: true,
  }
})
