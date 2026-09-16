/**
 * Print for others — the machines you offer, the requests waiting on you, and
 * what is on the bed.
 *
 * Three tabs, per the artboard, and each row opens its own record rather than
 * acting from here: taking a job on or declining it is a decision you make with
 * the parts and the note in front of you, which is the print job's own page.
 *
 * Deliberately the same screen scoped two ways: `/dashboard/organisation/orders`
 * renders this with `org` set, because the artboard says the org's print orders
 * are "the same three tabs as Print for others, scoped to the organisation's
 * machines". Two copies of three tabs would drift within a round.
 */
import Link from 'next/link'
import { ChatCircle, Plus, Printer as PrinterIcon } from '@phosphor-icons/react/dist/ssr'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { Badge } from '@/components/badge'
import { RecordCard } from '@/components/record-card'
import { PrinterRow } from '@/components/printer-row'
import { ProfileTabs } from '@/components/profile-tabs'
import { printStages } from '@/lib/print-stages'
import { needsAction, actionLabel, subjectName } from '@splat-connect/types'
import type { PrinterWithOwner, ToyTransactionSummary } from '@splat-connect/types'

export const metadata = { title: 'Print for others — SPLAT Connect' }

/**
 * The screen itself, so the organisation's print orders can render it scoped to
 * one organisation's machines without copying three tabs.
 */
export async function PrintOfferScreen({
  orgId,
  title,
  lead,
}: {
  /** Null for the caller's own machines; an org id for that org's. */
  orgId?: string
  title: string
  lead: string
}) {
  const caps = await requireCapabilities()
  const viewerId = caps.profile.id
  const ledOrgIds = caps.ledOrgs.map((org) => org.id)

  const [allPrinters, allJobs] = await Promise.all([
    apiClient.get<PrinterWithOwner[]>('/api/printers/mine').catch(() => [] as PrinterWithOwner[]),
    apiClient
      .get<ToyTransactionSummary[]>('/api/toy-transactions')
      .catch(() => [] as ToyTransactionSummary[]),
  ])

  const printers = orgId
    ? allPrinters.filter((p) => p.owner_org_id === orgId)
    : allPrinters.filter((p) => p.owner_id === viewerId)
  const printerIds = new Set(printers.map((p) => p.id))

  // Jobs ON these machines — never jobs this account asked for, which live on
  // /dashboard/print-requests with different controls entirely.
  const jobs = allJobs.filter(
    (tx) => tx.type === 'print' && tx.printer_id !== null && printerIds.has(tx.printer_id)
  )
  const waiting = jobs.filter((tx) => tx.status === 'requested')
  const onTheBed = jobs.filter((tx) => tx.status === 'accepted')
  const done = jobs.filter((tx) => !['requested', 'accepted'].includes(tx.status))

  function JobRow({ tx }: { tx: ToyTransactionSummary }) {
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
          note={tx.last_message ? tx.last_message.body : undefined}
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
                {/* isOwner is true on every row here by construction: these are
                    jobs on the viewer's own machines. */}
                {actionLabel(tx, true)}
              </Link>
            ) : undefined
          }
        />
      </li>
    )
  }

  function JobList({ rows, empty }: { rows: ToyTransactionSummary[]; empty: string }) {
    if (rows.length === 0) {
      return <p className="py-6 text-sm leading-relaxed text-muted">{empty}</p>
    }
    return (
      <ul className="flex list-none flex-col gap-3">
        {rows.map((tx) => (
          <JobRow key={tx.id} tx={tx} />
        ))}
      </ul>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="title-hub">{title}</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">{lead}</p>
        </div>
        <Link href="/dashboard/printers/new" className="btn btn-primary no-underline">
          <Plus size={18} weight="bold" aria-hidden="true" />
          Add a printer
        </Link>
      </div>

      <ProfileTabs
        tabs={[
          {
            key: 'printers',
            label: `Printers (${printers.length})`,
            content:
              printers.length === 0 ? (
                <p className="py-6 text-sm leading-relaxed text-muted">
                  No printers listed yet. Bed size and materials decide which requests you are
                  offered.
                </p>
              ) : (
                <ul className="flex list-none flex-col gap-3">
                  {printers.map((printer) => (
                    <PrinterRow key={printer.id} printer={printer} />
                  ))}
                </ul>
              ),
          },
          {
            key: 'requests',
            label: `Requests (${waiting.length})`,
            content: (
              <JobList rows={waiting} empty="Nothing is waiting on you right now." />
            ),
          },
          {
            key: 'jobs',
            label: `Jobs (${onTheBed.length})`,
            content: (
              <>
                <JobList rows={onTheBed} empty="Nothing is on the bed." />
                {done.length > 0 && (
                  <section className="mt-10">
                    <h2 className="mb-3 text-lg font-bold text-ink">Finished</h2>
                    <JobList rows={done} empty="" />
                  </section>
                )}
              </>
            ),
          },
        ]}
      />
    </div>
  )
}

export default async function PrintersPage() {
  return (
    <PrintOfferScreen
      title="Print for others"
      lead="Your printers, requests waiting on you, and what is on the bed."
    />
  )
}
