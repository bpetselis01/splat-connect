/**
 * One organisation conversation (077) by its id, for either side. The family
 * and every leader of the organisation can open it; anyone else gets the API's
 * 404, which is RLS's answer.
 */
import { notFound } from 'next/navigation'
import type { OrgThread } from '@splat-connect/types'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { BackLink } from '@/components/back-link'
import { OrgThreadView } from '@/components/org-thread'

export const metadata = { title: 'Conversation — SPLAT Connect' }

export default async function OrgConversationPage({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params
  const caps = await requireCapabilities()

  let thread: OrgThread
  try {
    thread = await apiClient.get<OrgThread>(`/api/organizations/conversations/${cid}`)
  } catch (err) {
    if (err instanceof Error && /status 404/.test(err.message)) notFound()
    throw err
  }
  const side = thread.conversation.profile_id === caps.profile.id ? 'family' : 'org'

  return (
    <div className="max-w-[760px]">
      {side === 'org' && <BackLink href="/dashboard/organisation/messages" label="Messages" />}
      <h1 className="title-hub mb-6">
        {side === 'family' ? thread.org_name : `${thread.person_name}, writing to ${thread.org_name}`}
      </h1>
      <OrgThreadView
        thread={thread}
        viewerId={caps.profile.id}
        side={side}
        orgName={thread.org_name}
        sendPath={`/api/organizations/conversations/${cid}/messages`}
      />
    </div>
  )
}
