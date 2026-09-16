/**
 * The organisation request queue.
 *
 * The other half of feature 12: somebody asks at
 * `/get-involved/organisations/request`, and an admin decides here. Approving
 * creates the organisation and appoints the requester in one transaction —
 * 060's function, not three writes from a browser.
 */
import { apiClient } from '@/lib/api-client'
import { OrgRequestQueue, type QueuedRequest } from '@/components/org-request-queue'

export const metadata = { title: 'Organisation requests — SPLAT Connect' }

export default async function AdminOrgRequestsPage() {
  const requests = await apiClient
    .get<QueuedRequest[]>('/api/admin/organization-requests')
    .catch(() => [] as QueuedRequest[])

  return (
    <div>
      <div className="mb-6">
        <h1 className="title-hub">Organisation requests</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Leadership is granted here and never self-started — approving one creates the
          organisation and appoints whoever asked.
        </p>
      </div>

      <OrgRequestQueue requests={requests} />
    </div>
  )
}
