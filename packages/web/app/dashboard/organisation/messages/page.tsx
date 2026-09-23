/**
 * The organisation's inbox (077): every family that has written to it, latest
 * first. Shared by every leader — a family writes to the organisation, not to
 * whichever leader is on shift — so there is no "assigned to" here.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChatCircleText } from '@phosphor-icons/react/dist/ssr'
import type { OrgConversationSummary } from '@splat-connect/types'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { shortDate } from '@/lib/dates'
import { BackLink } from '@/components/back-link'

export const metadata = { title: 'Messages — SPLAT Connect' }

export default async function OrgMessagesPage() {
  const caps = await getCapabilities()
  // The rail hides this for a non-leader, but the rail is an affordance.
  if (!caps || caps.ledOrgs.length === 0) notFound()

  const lists = await Promise.all(
    caps.ledOrgs.map((org) =>
      apiClient
        .get<OrgConversationSummary[]>(`/api/organizations/${org.id}/conversations`)
        .then((rows) => rows.map((r) => ({ ...r, org_name: org.name })))
        .catch(() => [])
    )
  )
  const rows = lists.flat().sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
  const several = caps.ledOrgs.length > 1

  return (
    <div className="max-w-[860px]">
      <BackLink href="/dashboard/organisation" label="Organisation" />
      <h1 className="title-hub">Messages</h1>
      <p className="dash-head__lede mb-6 max-w-[60ch]">
        Families writing to {several ? 'your organisations' : caps.ledOrgs[0].name}. Every leader sees
        these, and any of you can answer.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-surface px-6 py-8 text-sm text-muted">
          Nobody has written yet. The Message button on your public page starts a conversation here.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/dashboard/messages/${r.id}`}
                className="flex items-center gap-3.5 rounded-[18px] border border-line bg-surface p-[18px] text-ink shadow-e1 hover:shadow-e2"
              >
                <span
                  aria-hidden="true"
                  className="grid h-[42px] w-[42px] flex-none place-items-center rounded-[14px] bg-[var(--tmint)] text-[22px] text-[var(--tink)]"
                >
                  <ChatCircleText weight="fill" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-extrabold">
                    {r.person_name}
                    {several && <span className="font-semibold text-muted"> · {r.org_name}</span>}
                  </span>
                  {r.last_message && (
                    <span className="mt-0.5 block truncate text-sm text-muted">
                      {r.last_message.sender_id === r.profile_id ? '' : 'You: '}
                      {r.last_message.body}
                    </span>
                  )}
                </span>
                <span className="flex-none text-xs font-semibold text-muted">{shortDate(r.updated_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
