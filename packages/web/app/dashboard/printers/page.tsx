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
import { BookOpen, ChatCircle, Cube, Key, Package, Play, Plus } from '@phosphor-icons/react/dist/ssr'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { Badge } from '@/components/badge'
import { RecordCard } from '@/components/record-card'
import { PrinterRow } from '@/components/printer-row'
import { IncomingPrintCard } from '@/components/incoming-print-card'
import { SplatMascot } from '@/components/splat-mascot'
import { ProfileTabs } from '@/components/profile-tabs'
import { printStages } from '@/lib/print-stages'
import { collapsePrintGroups, needsAction, subjectName } from '@splat-connect/types'
import type {
  PrinterWithOwner,
  ToyTransactionSummary,
} from '@splat-connect/types'

export const metadata = { title: 'Print for others — SPLAT Connect' }

/**
 * One job on one of the viewer's machines.
 *
 * Module scope rather than inside the screen: a component declared during a
 * render is a new type on every pass, which remounts its whole subtree — and
 * react-hooks/static-components refuses it outright.
 */
function JobRow({
  tx,
  viewerId,
  ledOrgIds,
}: {
  tx: ToyTransactionSummary
  viewerId: string
  ledOrgIds: string[]
}) {
  // Both of the printer's own moves happen on the job page — marking it ready
  // needs a photo — so the stage action is a way there, named for the move.
  const move =
    tx.status === 'accepted' && needsAction(tx, viewerId, ledOrgIds)
      ? tx.printing_started_at
        ? { label: 'Mark ready', Icon: Package }
        : { label: 'Start printing', Icon: Play }
      : null
  return (
    <li>
      <RecordCard
        icon={<Cube size={26} weight="duotone" />}
        tint="var(--tviolet)"
        title={subjectName(tx)}
        meta={`for ${tx.other_party_name}`}
        pill={<Badge status={tx.status} />}
        stages={printStages(tx)}
        note={
          // The code is the printer's half of the handover, and only exists to
          // be read out once there is something to collect.
          tx.ready_at && tx.owner_code ? (
            <span className="flex flex-wrap items-center gap-3 rounded-[18px] bg-[var(--tmint)] px-4 py-3 text-sm font-bold text-[var(--tink)]">
              <Key size={24} weight="duotone" aria-hidden="true" />
              Read them this code at handoff
              <span className="font-mono text-[22px] font-extrabold tracking-[0.12em]">
                {tx.owner_code}
              </span>
            </span>
          ) : undefined
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
            <Link
              href={`/tutorials/${tx.tutorial_id}`}
              className="btn btn-quiet min-h-12 px-4 shadow-none no-underline"
            >
              <BookOpen size={18} weight="bold" aria-hidden="true" />
              Guide
            </Link>
          ) : undefined
        }
        stageAction={
          move ? (
            <Link
              href={`/dashboard/print-requests/${tx.id}`}
              className="btn min-h-12 border-brand-dark bg-[var(--b50)] text-[15px] text-brand-deep no-underline hover:bg-[var(--b100)]"
            >
              <move.Icon size={18} weight="bold" aria-hidden="true" />
              {move.label}
            </Link>
          ) : undefined
        }
      />
    </li>
  )
}

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
  // One card per request: an organisation asked on two of its machines (074)
  // answers once, choosing the bench on accept.
  const waitingRows = collapsePrintGroups(jobs.filter((tx) => tx.status === 'requested'))
  const waiting = waitingRows
  const onTheBed = jobs.filter((tx) => tx.status === 'accepted')
  const done = jobs.filter((tx) => !['requested', 'accepted'].includes(tx.status))

  const { pickup_line1, pickup_suburb, pickup_state, pickup_postcode } = caps.profile
  const defaultAddress =
    pickup_line1 && pickup_suburb && pickup_state && pickup_postcode
      ? { pickup_line1, pickup_suburb, pickup_state, pickup_postcode }
      : null

  const dashedEmpty =
    'rounded-[24px] border border-dashed border-line bg-surface p-[22px] text-center text-[15px] text-muted'

  return (
    <div className="max-w-[1040px]">
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <h1 className="title-hub">{title}</h1>
          <p className="mt-2 max-w-[60ch] text-base text-muted">{lead}</p>
        </div>
        <Link
          href="/dashboard/printers/new"
          className="btn btn-quiet min-h-12 shadow-none no-underline"
        >
          <Plus size={16} weight="bold" aria-hidden="true" />
          Add a printer
        </Link>
      </div>

      <ProfileTabs
        variant="segmented"
        label={`${title} sections`}
        defaultKey="requests"
        tabs={[
          {
            key: 'printers',
            label: 'My printers',
            count: printers.length,
            content:
              printers.length === 0 ? (
                <p className={dashedEmpty}>
                  No printers listed yet. Bed size and materials decide which requests you are
                  offered.
                </p>
              ) : (
                <ul className="flex list-none flex-col gap-4">
                  {printers.map((printer) => (
                    <PrinterRow key={printer.id} printer={printer} />
                  ))}
                </ul>
              ),
          },
          {
            key: 'requests',
            label: 'Requests',
            count: waiting.length,
            content:
              waiting.length === 0 ? (
                <div className="grid place-items-center rounded-[24px] border border-dashed border-line bg-surface p-12 text-center">
                  <SplatMascot pose="think" width={96} />
                  <h3 className="mb-1 mt-3 font-display text-2xl font-extrabold text-ink">
                    Nothing waiting on you
                  </h3>
                  <p className="max-w-[40ch] text-muted">
                    Requests that fit your bed and materials land here. Stay open and they will
                    come.
                  </p>
                </div>
              ) : (
                <ul className="flex list-none flex-col gap-4">
                  {waiting.map((tx) => (
                    <IncomingPrintCard
                      key={tx.id}
                      tx={tx}
                      defaultAddress={defaultAddress}
                      machines={orgId ? printers : undefined}
                    />
                  ))}
                </ul>
              ),
          },
          {
            key: 'jobs',
            label: 'Jobs',
            count: onTheBed.length,
            content: (
              <div className="flex flex-col gap-4">
                {onTheBed.length === 0 ? (
                  <p className={dashedEmpty}>
                    Nothing on the bed. Accept a request and it appears here.
                  </p>
                ) : (
                  <ul className="flex list-none flex-col gap-4">
                    {onTheBed.map((tx) => (
                      <JobRow key={tx.id} tx={tx} viewerId={viewerId} ledOrgIds={ledOrgIds} />
                    ))}
                  </ul>
                )}
                {done.length > 0 && (
                  <div>
                    <h2 className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.1em] text-muted">
                      History
                    </h2>
                    {/* 1px gaps over a --line background: the rows share their
                        dividers rather than each drawing a border. */}
                    <ul className="flex list-none flex-col gap-px overflow-hidden rounded-[18px] border border-line bg-[var(--line)]">
                      {done.map((tx) => (
                        <li key={tx.id} className="bg-surface">
                          <Link
                            href={`/dashboard/print-requests/${tx.id}`}
                            className="flex items-center gap-3 px-4 py-[13px] text-ink no-underline hover:bg-[var(--surface2)]"
                          >
                            <span className="min-w-0 flex-1 truncate text-sm font-bold">
                              {subjectName(tx)}
                            </span>
                            <span className="text-[13px] text-muted">
                              {tx.other_party_name} ·{' '}
                              {new Date(tx.updated_at).toLocaleDateString('en-AU', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                            <Badge status={tx.status} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
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
