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
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getCapabilities, type Capabilities } from '@/lib/capabilities'
import { authUrl } from '@/lib/safe-next-path'

export async function isOrgLeader(orgId: string): Promise<boolean> {
  return (await getCapabilities())?.ledOrgs.some((o) => o.id === orgId) ?? false
}

/** The dashboard hub shows LEADERS_ONLY_NOTE when it is opened with this notice. */
export const LEADERS_ONLY_NOTICE = 'org-leaders-only'
export const LEADERS_ONLY_NOTE = 'That page is for organisation leaders.'

/**
 * The gate for every organisation dashboard page: signed out goes to sign in
 * and back to `path`; a signed-in member who leads nothing goes to the
 * dashboard with a note. Returns the capabilities so the page need not re-read them.
 */
export async function requireOrgLeader(path: string): Promise<Capabilities> {
  const caps = await getCapabilities()
  if (!caps) redirect(authUrl('login', path))
  if (caps.ledOrgs.length === 0) redirect(`/dashboard?notice=${LEADERS_ONLY_NOTICE}` as Route)
  return caps
}
