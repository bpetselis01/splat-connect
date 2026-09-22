/**
 * My print requests — the jobs this account has sent to other people's
 * printers.
 *
 * Status is the sort, which is the artboard's whole note on this screen:
 * anything waiting on you rises to the top. "Waiting on you" here means the
 * pickup, because every other step of a print job is the printer's.
 *
 * Was a ComingSoon placeholder until 058.
 */
import Link from 'next/link'
import {
  BookOpen,
  ChatCircle,
  Cube,
  HandPointing,
  Plus,
  Printer as PrinterIcon,
} from '@phosphor-icons/react/dist/ssr'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { Badge } from '@/components/badge'
import { RecordCard } from '@/components/record-card'
import { BoundaryLink } from '@/components/boundary-link'
import { printStages } from '@/lib/print-stages'
import { needsAction, actionLabel, isOwnerSide, subjectName } from '@splat-connect/types'
import type { ToyTransactionSummary, ToyTransactionStatus } from '@splat-connect/types'

export const metadata = { title: 'My print requests — SPLAT Connect' }

export default async function MyPrintRequestsPage() {
  const caps = await requireCapabilities()
  const viewerId = caps.profile.id
  const ledOrgIds = caps.ledOrgs.map((org) => org.id)

  const all = await apiClient
    .get<ToyTransactionSummary[]>('/api/toy-transactions')
    .catch(() => [] as ToyTransactionSummary[])

  // Jobs this account ASKED for. The other side — jobs on machines they own —
  // is /dashboard/printers, which is a different screen with different
  // controls; merging them would put "start the print" next to "collect it".
  const mine = all.filter((tx) => tx.type === 'print' && tx.requester_id === viewerId)

  // One list, not Active and History: the board sorts rather than splits. What
  // is waiting on you comes first, then anything still moving, then the closed
  // ones, newest first within each.
  const ACTIVE: ToyTransactionStatus[] = ['requested', 'accepted']
  const rank = (tx: ToyTransactionSummary) =>
    needsAction(tx, viewerId, ledOrgIds) ? 0 : ACTIVE.includes(tx.status) ? 1 : 2
  const sorted = [...mine].sort(
    (a, b) => rank(a) - rank(b) || b.created_at.localeCompare(a.created_at)
  )

  function Row({ tx }: { tx: ToyTransactionSummary }) {
    const isOwner = isOwnerSide(tx, viewerId, ledOrgIds)
    return (
      <li>
        <RecordCard
          icon={<Cube size={26} weight="duotone" />}
          tint="var(--tviolet)"
          title={subjectName(tx)}
          meta={`${tx.other_party_name} · ${new Date(tx.created_at).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
          })}`}
          pill={<Badge status={tx.status} />}
          stages={printStages(tx)}
          note={
            tx.last_message
              ? `${
                  tx.last_message.sender_id === viewerId && tx.last_message.kind === 'user'
                    ? 'You: '
                    : ''
                }${tx.last_message.body}`
              : undefined
          }
          primary={
            <Link
              href={`/dashboard/print-requests/${tx.id}`}
              className="btn btn-primary min-h-12 text-[15px] no-underline"
            >
              <ChatCircle size={18} weight="fill" aria-hidden="true" />
              Thread
            </Link>
          }
          secondary={
            tx.tutorial_id ? (
              <BoundaryLink
                href={`/tutorials/${tx.tutorial_id}`}
                className="btn btn-quiet min-h-12 px-4 no-underline shadow-none"
              >
                <BookOpen size={18} weight="bold" aria-hidden="true" />
                Guide
              </BoundaryLink>
            ) : undefined
          }
          // A marker, not a control: Thread beside it already goes where the
          // action is taken, and the board draws this as a pill.
          stageAction={
            needsAction(tx, viewerId, ledOrgIds) ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--tcoral)] px-3 py-[5px] text-[13px] font-extrabold text-[var(--tink)]">
                <HandPointing size={16} weight="fill" aria-hidden="true" />
                {actionLabel(tx, isOwner)}
              </span>
            ) : undefined
          }
        />
      </li>
    )
  }

  return (
    <div className="max-w-[960px]">
      <div className="mb-[26px] flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="title-hub">My print requests</h1>
          <p className="mt-2 max-w-[56ch] text-base text-muted">
            Parts you have asked someone to print. Anything waiting on you sits at the top.
          </p>
        </div>
        <BoundaryLink href="/printing" className="btn btn-primary px-6 no-underline">
          <Plus size={16} weight="bold" aria-hidden="true" />
          New request
        </BoundaryLink>
      </div>

      {mine.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-dark">
            <PrinterIcon size={32} weight="duotone" />
          </span>
          <p className="mt-4 font-bold text-ink">No print requests yet.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Find a printer with the material you need and ask for the parts from a guide.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((tx) => (
            <Row key={tx.id} tx={tx} />
          ))}
        </ul>
      )}
    </div>
  )
}
