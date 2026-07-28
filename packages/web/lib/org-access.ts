/**
 * Server-Side Org Leadership Check
 *
 * /org/* cannot be gated in middleware the way /admin is. Leadership is
 * per-organisation data, not a role on the profile, so there is nothing for
 * middleware to read without knowing which organisation the URL refers to.
 * Middleware therefore enforces only "logged in", and the org page calls this.
 *
 * This reads GET /api/organizations/mine, which is backed by org_leaders and is
 * the single source of truth for leadership. It deliberately does not infer
 * anything from the profile role: a leader is an ordinary contributor.
 *
 * It was requireOrgLeader, which redirected. It became a check when /org and
 * /organizations merged: one route now serves both the public view and the
 * leader's workspace, so a non-leader must get the page WITHOUT the workspace
 * rather than a bounce to '/'.
 *
 * An affordance, not a control. The database refuses a non-leader's writes
 * whatever this returns — see the tutorials leader UPDATE policy in 007.
 *
 * Related files:
 * - packages/api/src/routes/organizations.ts: the endpoint behind this
 * - supabase/migrations/007_organizations.sql: org_leaders and is_org_leader()
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
