/**
 * Request an organisation.
 *
 * Signed-in only, "since we need to know who to verify" — and because the
 * requester becomes the first leader when an admin approves it, so who is
 * asking is load-bearing rather than a byline.
 *
 * This is the missing half of the trust model the explainer page already
 * describes: leadership is granted by an admin and never self-started, and
 * until 060 there was no way for the people who run an organisation to start
 * that conversation at all.
 */
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { BackLink } from '@/components/back-link'
import { OrgRequestForm } from '@/components/org-request-form'
import type { OrganizationRequest } from '@splat-connect/types'

export const metadata = { title: 'Request an organisation — SPLAT Connect' }

export default async function RequestAnOrganisationPage() {
  await requireCapabilities()

  const existing = await apiClient
    .get<OrganizationRequest[]>('/api/organizations/requests')
    .catch(() => [] as OrganizationRequest[])

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/get-involved/organisations" label="For organisations" />
      <h1 className="mt-2 title-detail">Request an organisation</h1>
      <p className="mb-6 mt-2 text-sm leading-relaxed text-muted">
        An admin reviews every request before an organisation or a leader is created.
      </p>

      <OrgRequestForm existing={existing} />
    </div>
  )
}
