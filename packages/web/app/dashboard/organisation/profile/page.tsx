/**
 * The organisation profile editor.
 *
 * Every field on the public organisation page has an input on the form this
 * renders. There is no review — it publishes on save — which is why the form
 * restates the leader terms at its foot.
 */
import { notFound } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { OrgProfileForm } from '@/components/org-profile-form'
import { OrgThanksNotes } from '@/components/org-thanks-notes'
import type { Organization, OrgThanks } from '@splat-connect/types'

export const metadata = { title: 'Organisation profile — SPLAT Connect' }

export default async function OrgProfilePage() {
  const caps = await getCapabilities()
  // The tab strip hides this for a non-leader, but the strip is an affordance —
  // the page is its own control (lib/org-access.ts states the same rule).
  if (!caps || caps.ledOrgs.length === 0) notFound()

  const orgId = caps.ledOrgs[0].id
  const [org, thanks] = await Promise.all([
    apiClient.get<Organization>(`/api/organizations/${orgId}`),
    apiClient.get<OrgThanks[]>(`/api/organizations/${orgId}/thanks`).catch(() => [] as OrgThanks[]),
  ])

  return (
    <div className="max-w-[860px]">
      <h1 className="title-hub">Organisation profile</h1>
      <p className="dash-head__lede dash-head__lede--lg max-w-[62ch]">
        This is the page a family lands on before they ask you for anything. Everything on it is
        set here, and it publishes the moment you save.
      </p>

      <OrgProfileForm org={org} />
      <div className="mt-5">
        <OrgThanksNotes orgId={org.id} thanks={thanks} />
      </div>
    </div>
  )
}
