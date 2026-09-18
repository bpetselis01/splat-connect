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
import type { Organization } from '@splat-connect/types'

export const metadata = { title: 'Organisation profile — SPLAT Connect' }

export default async function OrgProfilePage() {
  const caps = await getCapabilities()
  // The tab strip hides this for a non-leader, but the strip is an affordance —
  // the page is its own control (lib/org-access.ts states the same rule).
  if (!caps || caps.ledOrgs.length === 0) notFound()

  const org = await apiClient.get<Organization>(`/api/organizations/${caps.ledOrgs[0].id}`)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="title-hub">Organisation profile</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          What a family reads before they decide whether to ask you for anything.
        </p>
      </div>

      <OrgProfileForm org={org} />
    </div>
  )
}
