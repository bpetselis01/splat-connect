/**
 * Publish an event.
 *
 * A thin page: the leader check, and the form. Everything else is in
 * components/event-form.tsx, which is a client component because the
 * registration-form editor is genuinely interactive — reordering, adding and
 * removing questions is not a thing a server round trip should be in the middle
 * of.
 */
import { notFound } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import Link from 'next/link'
import { CaretRight } from '@phosphor-icons/react/dist/ssr'
import { EventForm } from '@/components/event-form'

export const metadata = { title: 'Publish an event — SPLAT Connect' }

export default async function PublishEventPage() {
  const caps = await getCapabilities()
  if (!caps || caps.ledOrgs.length === 0) notFound()
  const org = caps.ledOrgs[0]

  return (
    <div className="max-w-[760px]">
      <nav aria-label="Back to the list" className="form-trail">
        <Link href="/dashboard/organisation/publish">Events and stories</Link>
        <CaretRight weight="bold" aria-hidden="true" className="text-xs" />
        <span>New event</span>
      </nav>
      <h1 className="title-hub">Publish an event</h1>
      <p className="dash-head__lede dash-head__lede--lg">
        Families decide from four things: what it is, when, where, and whether it is for them.
        Fill those and it is enough to publish.
      </p>
      <EventForm orgId={org.id} orgName={org.name} />
    </div>
  )
}
