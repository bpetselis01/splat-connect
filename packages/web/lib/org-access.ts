/**
 * Server-side org leadership check. /org/* cannot be gated in middleware the
 * way /admin is: leadership is per-organisation data, not a profile role, so
 * middleware enforces only "logged in" and the page calls this instead.
 *
 * Reads getCapabilities().ledOrgs — GET /api/organizations/mine (backed by
 * org_leaders, the single source of truth), already fetched and React-cached
 * by the root layout. Callers decide what a "no" means for their own page:
 * /organizations/[id]/page.tsx redirects a non-leader to the public
 * profile, /organizations/[id]/projects/[tutorialId]/page.tsx 404s.
 *
 * An affordance, not a control: the database refuses a non-leader's writes
 * whatever this returns (tutorials leader UPDATE policy in 007).
 */
import { getCapabilities } from '@/lib/capabilities'

export async function isOrgLeader(orgId: string): Promise<boolean> {
  return (await getCapabilities())?.ledOrgs.some((o) => o.id === orgId) ?? false
}
