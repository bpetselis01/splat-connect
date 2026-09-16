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
import { ChatCircle, Printer as PrinterIcon } from '@phosphor-icons/react/dist/ssr'
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

  const ACTIVE: ToyTransactionStatus[] = ['requested', 'accepted']
  const active = mine.filter((tx) => ACTIVE.includes(tx.status))
  const history = mine.filter((tx) => !ACTIVE.includes(tx.status))

  function Row({ tx }: { tx: ToyTransactionSummary }) {
    const isOwner = isOwnerSide(tx, viewerId, ledOrgIds)
    return (
      <li>
        <RecordCard
          icon={<PrinterIcon size={22} weight="duotone" />}
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
              className="btn btn-primary no-underline"
            >
              <ChatCircle size={18} weight="fill" aria-hidden="true" />
              Thread
            </Link>
          }
          stageAction={
            needsAction(tx, viewerId, ledOrgIds) ? (
              <Link
                href={`/dashboard/print-requests/${tx.id}`}
                className="btn btn-quiet no-underline"
              >
                {actionLabel(tx, isOwner)}
              </Link>
            ) : undefined
          }
        />
      </li>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="title-hub">My print requests</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Parts you have asked somebody&apos;s printer for, and where each one has got to.
        </p>
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
          <BoundaryLink href="/printing/requests" className="btn btn-primary mt-6">
            Request a print
          </BoundaryLink>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-ink">Active</h2>
              <ul className="flex flex-col gap-3">
                {active.map((tx) => (
                  <Row key={tx.id} tx={tx} />
                ))}
              </ul>
            </section>
          )}

          {history.length > 0 && (
            <section className={active.length > 0 ? 'mt-10' : undefined}>
              <h2 className="mb-3 text-lg font-bold text-ink">History</h2>
              <ul className="flex flex-col gap-3">
                {history.map((tx) => (
                  <Row key={tx.id} tx={tx} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
