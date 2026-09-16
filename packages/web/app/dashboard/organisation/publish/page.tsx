/**
 * Events and stories — what the organisation has published, in two tabs.
 *
 * Publish and unpublish are one click each and take effect on the public
 * organisation page immediately. No review, so the leader terms are restated at
 * the foot of the component this renders.
 */
import { notFound } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { OrgPublishing } from '@/components/org-publishing'
import type { OrgEvent, OrgStory } from '@splat-connect/types'

export const metadata = { title: 'Events and stories — SPLAT Connect' }

export default async function OrgPublishPage() {
  const caps = await getCapabilities()
  if (!caps || caps.ledOrgs.length === 0) notFound()
  const org = caps.ledOrgs[0]

  const [events, stories] = await Promise.all([
    apiClient.get<OrgEvent[]>(`/api/organizations/${org.id}/events`).catch(() => [] as OrgEvent[]),
    apiClient.get<OrgStory[]>(`/api/organizations/${org.id}/stories`).catch(() => [] as OrgStory[]),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="title-hub">Events and stories</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          What {org.name} has published, and what is still a draft.
        </p>
      </div>

      <OrgPublishing orgId={org.id} events={events} stories={stories} />
    </div>
  )
}
