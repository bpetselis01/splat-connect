/**
 * Server-side org leadership check. /org/* cannot be gated in middleware the
 * way /admin is: leadership is per-organisation data, not a profile role, so
 * middleware enforces only "logged in" and the page calls this instead.
 *
 * Reads GET /api/organizations/mine (backed by org_leaders, the single
 * source of truth). It was requireOrgLeader and redirected; it became a
 * check when /org and /organizations merged — a non-leader gets the page
 * WITHOUT the workspace rather than a bounce.
 *
 * An affordance, not a control: the database refuses a non-leader's writes
 * whatever this returns (tutorials leader UPDATE policy in 007).
 */
import { apiClient } from '@/lib/api-client'
import type { Organization } from '@splat-connect/types'

export async function isOrgLeader(orgId: string): Promise<boolean> {
  try {
    const mine = await apiClient.get<Organization[]>('/api/organizations/mine')
    return mine.some((o) => o.id === orgId)
  } catch {
    return false
  }
}
