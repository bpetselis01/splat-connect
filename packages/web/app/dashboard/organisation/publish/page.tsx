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
import Link from 'next/link'
import { PencilSimpleLine, Plus } from '@phosphor-icons/react/dist/ssr'
import { OrgPublishing } from '@/components/org-publishing'
import type {
  OrgEvent,
  OrgEventRegistration,
  OrgStory,
  ToyTransactionSummary,
} from '@splat-connect/types'

export const metadata = { title: 'Events and stories — SPLAT Connect' }

export default async function OrgPublishPage() {
  const caps = await getCapabilities()
  if (!caps || caps.ledOrgs.length === 0) notFound()
  const org = caps.ledOrgs[0]

  const [events, stories, inbox] = await Promise.all([
    apiClient.get<OrgEvent[]>(`/api/organizations/${org.id}/events`).catch(() => [] as OrgEvent[]),
    apiClient.get<OrgStory[]>(`/api/organizations/${org.id}/stories`).catch(() => [] as OrgStory[]),
    apiClient
      .get<ToyTransactionSummary[]>('/api/toy-transactions?role=owner')
      .catch(() => [] as ToyTransactionSummary[]),
  ])

  // One request per event: the list endpoint carries no counts. An
  // organisation has a handful of events, so this stays small.
  // ponytail: N+1 fetch; add going_count to GET /:id/events if lists grow.
  const going: Record<string, number> = Object.fromEntries(
    await Promise.all(
      events.map(async (e) => [
        e.id,
        await apiClient
          .get<OrgEventRegistration[]>(`/api/organizations/${org.id}/events/${e.id}/registrations`)
          .then((r) => r.filter((x) => !x.cancelled_at).length)
          .catch(() => 0),
      ]),
    ),
  )
  // Part-print requests still waiting on a yes or no, the Manage button's badge.
  const toAnswer: Record<string, number> = {}
  for (const t of inbox) {
    if (t.event_id && t.status === 'requested') toAnswer[t.event_id] = (toAnswer[t.event_id] ?? 0) + 1
  }

  return (
    <div>
      <div className="dash-head mb-6">
        <div>
          <h1 className="title-hub">Events and stories</h1>
          <p className="dash-head__lede">Published items are live on the public pages right now.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/dashboard/organisation/stories/new" className="btn btn-quiet min-h-12 px-[18px]">
            <PencilSimpleLine weight="bold" aria-hidden="true" />
            New story
          </Link>
          <Link href="/dashboard/organisation/events/new" className="btn btn-coral">
            <Plus weight="bold" aria-hidden="true" />
            New event
          </Link>
        </div>
      </div>

      <OrgPublishing
        orgId={org.id}
        events={events}
        stories={stories}
        going={going}
        toAnswer={toAnswer}
      />
    </div>
  )
}
