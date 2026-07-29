/**
 * The single answer to "what may this user do".
 *
 * Capability is derived from data the schema already holds rather than read from
 * profiles.role, which is why one account can be both a parent and a contributor:
 * - admin      role = 'admin' (the only capability the column still carries)
 * - author     any signed-in account (009 widened is_approved_contributor)
 * - parent     has a child_profiles row
 * - leader     has an org_leaders row, via GET /api/organizations/mine
 *
 * Wrapped in React cache() so a layout and its page share one round of fetches.
 *
 * Related files:
 * - supabase/migrations/009_shared_account_capability.sql: the authoring widening
 * - lib/org-access.ts: the per-organisation check this generalises
 */
import { cache } from 'react'
import { apiClient } from '@/lib/api-client'
import type { Profile, Organization, ChildProfile } from '@splat-connect/types'

export type Capabilities = {
  profile: Profile
  isAdmin: boolean
  isParent: boolean
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

  // Each of these degrades to "capability absent" on failure so one flaky fetch
  // hides one tab rather than blanking the dashboard.
  const [childProfile, ledOrgs] = await Promise.all([
    apiClient.get<ChildProfile | null>('/api/child-profile').catch(() => null),
    apiClient.get<Organization[]>('/api/organizations/mine').catch(() => [] as Organization[]),
  ])

  return {
    profile,
    isAdmin: profile.role === 'admin',
    isParent: childProfile !== null,
    ledOrgs,
    canAuthor: true,
  }
})
