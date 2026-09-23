/**
 * "Message" on an organisation's public page: the one conversation this person
 * has with the organisation (077), or an empty composer before the first
 * message. Once it exists it also lives at /dashboard/messages/<id>, which is
 * where a notification about it opens — the notification knows only the
 * conversation, not the organisation.
 */
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CaretRight } from '@phosphor-icons/react/dist/ssr'
import type { OrgPublicProfile, OrgRelationship, OrgThread } from '@splat-connect/types'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { OrgThreadView } from '@/components/org-thread'

export const metadata = { title: 'Message an organisation — SPLAT Connect' }

export default async function MessageOrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caps = await getCapabilities()
  if (!caps) redirect(`/login?next=${encodeURIComponent(`/organizations/${id}/message`)}`)

  const res = await fetch(`${process.env.API_URL}/api/public/organizations/${id}`, { cache: 'no-store' })
  if (!res.ok) notFound()
  const org = (await res.json()) as OrgPublicProfile

  const [me, thread] = await Promise.all([
    apiClient.get<OrgRelationship>(`/api/organizations/${id}/me`),
    apiClient.get<OrgThread | null>(`/api/organizations/${id}/conversations/mine`),
  ])
  // A leader's side of these conversations is the organisation's inbox.
  if (me.leads) redirect('/dashboard/organisation/messages')

  return (
    <div className="mx-auto max-w-[760px]">
      <nav aria-label="Breadcrumb" className="mb-[18px] flex items-center gap-2 text-sm font-bold text-muted">
        <Link href={`/organizations/${id}/public`} className="text-[var(--b700)]">
          {org.name}
        </Link>
        <CaretRight size={12} weight="bold" aria-hidden="true" />
        <span className="text-ink">Message</span>
      </nav>
      <h1 className="title-hub mb-2">Message {org.name}</h1>
      <p className="dash-head__lede mb-6 max-w-[60ch]">
        This goes to the organisation, not to one person: every leader there reads it, and any of
        them can answer.
      </p>
      <OrgThreadView
        thread={thread}
        viewerId={caps.profile.id}
        side="family"
        orgName={org.name}
        sendPath={`/api/organizations/${id}/conversations/mine/messages`}
      />
    </div>
  )
}
