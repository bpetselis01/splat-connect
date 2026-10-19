/**
 * Edit an event already saved, draft or published, in the form it was written in.
 */
import { notFound } from 'next/navigation'
import { actingOrg } from '@/lib/acting-org'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { EventForm } from '@/components/event-form'
import type { OrgEvent, OrgEventQuestion } from '@splat-connect/types'

export const metadata = { title: 'Edit an event — SPLAT Connect' }

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caps = await getCapabilities()
  if (!caps || caps.ledOrgs.length === 0) notFound()
  const org = await actingOrg(caps)

  const [events, questions] = await Promise.all([
    apiClient.get<OrgEvent[]>(`/api/organizations/${org.id}/events`).catch(() => [] as OrgEvent[]),
    apiClient
      .get<OrgEventQuestion[]>(`/api/organizations/${org.id}/events/${id}/questions`)
      .catch(() => [] as OrgEventQuestion[]),
  ])
  const event = events.find((e) => e.id === id)
  if (!event) notFound()

  return (
    <div className="max-w-[760px]">
      <h1 className="title-hub">Edit an event</h1>
      <p className="dash-head__lede dash-head__lede--lg">
        Registrations stay as they are, and answers stay with every question you keep.
      </p>
      <EventForm orgId={org.id} orgName={org.name} event={event} questions={questions} />
    </div>
  )
}
