/**
 * Server-Side Org Leadership Check
 *
 * /org/* cannot be gated in middleware the way /admin is. Leadership is
 * per-organisation data, not a role on the profile, so there is nothing for
 * middleware to read without knowing which organisation the URL refers to.
 * Middleware therefore enforces only "logged in", and every org page calls this.
 *
 * This reads GET /api/organizations/mine, which is backed by org_leaders and is
 * the single source of truth for leadership. It deliberately does not infer
 * anything from the profile role: a leader is an ordinary contributor.
 *
 * This is a redirect for UX. The database refuses a non-leader's writes
 * regardless — see the tutorials leader UPDATE policy in 007.
 *
 * Related files:
 * - packages/api/src/routes/organizations.ts: the endpoint behind this
 * - supabase/migrations/007_organizations.sql: org_leaders and is_org_leader()
 */
import { redirect } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import type { Organization } from '@splat-connect/types'

export async function requireOrgLeader(orgId: string): Promise<Organization> {
  let mine: Organization[]
  try {
    mine = await apiClient.get<Organization[]>('/api/organizations/mine')
  } catch {
    redirect('/login')
  }
  const org = mine.find((o) => o.id === orgId)
  if (!org) redirect('/')
  return org
}
