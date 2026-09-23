/**
 * A print job, on the canonical detail layout.
 *
 * Third route on the same shape as `/dashboard/exchanges/[id]` and the build
 * thread: header, cost panel, joined rail and facts, thread with a sticky
 * sidebar. A print job IS a toy transaction (058), so all of that is the code
 * that was already there; what differs is `lib/print-stages.ts`, the next-step
 * card, and the parts list behind the disclosure.
 *
 * Related files:
 * - lib/print-stages.ts: the rail and the facts under it
 * - components/print-next-step.tsx: start, and mark ready with a photo
 * - supabase/migrations/058_printers_and_print_jobs.sql
 */
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import {
  BookOpen,
  CheckCircle,
  HourglassMedium,
  Lightning,
  List,
  Printer as PrinterIcon,
  XCircle,
} from '@phosphor-icons/react/dist/ssr'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { isOwnerSide } from '@splat-connect/types'
import type {
  PickupAddress,
  Profile,
  ToyTransactionDetail,
  ToyTransactionSummary,
} from '@splat-connect/types'
import { Badge } from '@/components/badge'
import { Disclosure } from '@/components/disclosure'
import { CostPanel, type CostLine, type Settlement } from '@/components/cost-panel'
import { StageRailCard } from '@/components/stage-rail-card'
import { PrintNextStep } from '@/components/print-next-step'
import { LiveTransaction } from '@/components/live-transaction'
import { ToyTransactionThread } from '@/components/toy-transaction-thread'
import { ChatHead } from '@/components/exchange-chat'
import { printStages, printStageFacts } from '@/lib/print-stages'
import { printFilesLine } from '@/lib/print-settings'
import { askedPrintersLabel, othersAskedLabel } from '@/lib/print-groups'

function defaultAddress(profile: Profile): PickupAddress | null {
  const { pickup_line1, pickup_suburb, pickup_state, pickup_postcode } = profile
  if (!pickup_line1 || !pickup_suburb || !pickup_state || !pickup_postcode) return null
  return { pickup_line1, pickup_suburb, pickup_state, pickup_postcode }
}

export default async function PrintJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caps = await requireCapabilities()

  let tx: ToyTransactionDetail
  try {
    tx = await apiClient.get<ToyTransactionDetail>(`/api/toy-transactions/${id}`)
  } catch (err) {
    if (err instanceof Error && /status 404/.test(err.message)) notFound()
    throw err
  }

  // Anything else opened at this URL belongs on its own page, and sending it
  // there beats rendering print vocabulary over a toy.
  if (tx.type !== 'print') {
    redirect(
      tx.type === 'build' ? `/dashboard/exchanges/build/${id}` : `/dashboard/exchanges/${id}`
    )
  }

  async function sendMessage(body: string) {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/messages`, { body })
    revalidatePath(`/dashboard/print-requests/${id}`)
  }
  async function accept(address: PickupAddress | null) {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/accept`, address ?? {})
    revalidatePath(`/dashboard/print-requests/${id}`)
  }
  async function reject(reason?: string) {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/reject`, { reason })
    revalidatePath(`/dashboard/print-requests/${id}`)
  }
  // Withdrawing one job of a grouped request withdraws the whole request (the
  // API sweeps the other printers' jobs, 074).
  async function withdraw() {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/withdraw`, {})
    revalidatePath(`/dashboard/print-requests/${id}`)
  }
  async function confirm(code: string) {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/confirm`, { code })
    revalidatePath(`/dashboard/print-requests/${id}`)
  }

  const ledOrgIds = caps.ledOrgs.map((org) => org.id)
  // The giving side of a print job is whoever owns the machine.
  const viewerIsPrinter = isOwnerSide(tx, caps.profile.id, ledOrgIds)
  const otherPartyName = viewerIsPrinter ? tx.requester_name : tx.owner_name

  let costs: { lines: CostLine[]; settlement: Settlement | null } | null = null
  try {
    costs = await apiClient.get(`/api/exchange-costs/${id}`)
  } catch {
    costs = null
  }

  const canEditCosts =
    tx.owner_id !== null &&
    (tx.owner_id === caps.profile.id || tx.requester_id === caps.profile.id) &&
    tx.status !== 'rejected' &&
    tx.status !== 'withdrawn'

  const stages = printStages(tx)
  const facts = printStageFacts(tx, viewerIsPrinter)

  const partCount = tx.print_files.reduce((n, file) => n + file.quantity, 0)
  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('')
  // Where this job stands with the one printer it went to — the board's
  // "Printers asked" card, which a job with a single machine has one row of.
  const printerAnswer =
    tx.status === 'requested'
      ? { label: 'Waiting', tint: 'var(--tamber)', Icon: HourglassMedium }
      : tx.status === 'rejected'
        ? { label: 'Declined', tint: 'var(--surface2)', Icon: XCircle }
        : tx.status === 'withdrawn'
          ? { label: 'Withdrawn', tint: 'var(--surface2)', Icon: XCircle }
          : { label: 'Said yes', tint: 'var(--tok)', Icon: CheckCircle }
  const waitingOnGroup = tx.status === 'requested' && (tx.print_group_size ?? 1) > 1
  const deliveryLabel =
    tx.print_delivery === 'post' ? 'Posted' : tx.print_delivery === 'collect' ? 'Collect' : null

  return (
    <div className="max-w-[1180px]">
      <LiveTransaction transactionId={id} />

      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={tx.status} />
            {/* The way to the guide: the board draws it as a pill beside the
                status, so the header button is free for the way back. */}
            {tx.tutorial_id && tx.tutorial_title && (
              <Link
                href={`/tutorials/${tx.tutorial_id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface2)] px-3 py-1 text-xs font-extrabold uppercase tracking-[0.04em] text-ink no-underline hover:underline"
              >
                <BookOpen size={14} weight="fill" aria-hidden="true" />
                From {tx.tutorial_title}
              </Link>
            )}
          </div>
          <h1 className="title-hub mt-2">
            {tx.tutorial_title ?? 'A print job'}
            {partCount > 0 && ` · ${partCount} part${partCount === 1 ? '' : 's'}`}
          </h1>
          <p className="mt-1.5 text-[15px] font-semibold text-muted">
            {tx.print_files.length > 0 && (
              <>{printFilesLine(tx.print_files)} · </>
            )}
            with <strong className="text-ink">{otherPartyName}</strong>
          </p>
          {tx.printer && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--surface2)] px-2.5 py-1 text-xs font-extrabold text-ink">
              <PrinterIcon size={14} weight="bold" aria-hidden="true" className="text-brand-dark" />
              On {tx.printer.name}
            </p>
          )}
        </div>
        <Link
          href={viewerIsPrinter ? '/dashboard/printers' : '/dashboard/print-requests'}
          className="btn btn-quiet min-h-12 px-[18px] no-underline shadow-none"
        >
          <List size={18} aria-hidden="true" />
          {viewerIsPrinter ? 'Print for others' : 'All print requests'}
        </Link>
      </div>

      {costs && (
        <div className="mt-[22px]">
          <CostPanel
            lines={costs.lines}
            settlement={costs.settlement}
            noteByName={otherPartyName}
            viewerName={caps.profile.name}
            // Filament is the printer's outlay, so the requester is the payer.
            viewerOwes={!viewerIsPrinter}
            transactionId={id}
            viewerId={caps.profile.id}
            canEdit={canEditCosts}
            heading="What this print costs you"
            intro={`${otherPartyName} gives the time and the machine free. These are their standard rates, in their own words.`}
          />
        </div>
      )}

      <div className="mb-[22px] mt-[22px]">
        <StageRailCard stages={stages} facts={facts} />
      </div>

      <ToyTransactionThread
        transaction={tx}
        viewerId={caps.profile.id}
        ledOrgIds={ledOrgIds}
        viewerDefaultAddress={defaultAddress(caps.profile)}
        onSendMessage={sendMessage}
        onAccept={accept}
        onReject={reject}
        onWithdraw={withdraw}
        onConfirm={confirm}
        variant="board"
        chatHead={
          <ChatHead
            name={otherPartyName}
            sub={viewerIsPrinter ? 'Only you and the family can read this' : 'Only you and the printer can read this'}
          />
        }
        asideTop={
          <>
            <PrintNextStep tx={tx} viewerIsPrinter={viewerIsPrinter} />

            {waitingOnGroup && (
              <p className="flex items-start gap-2.5 rounded-[18px] bg-[var(--tamber)] px-4 py-3.5 text-sm font-bold leading-[1.5] text-[var(--tink)]">
                <Lightning size={20} weight="fill" aria-hidden="true" className="mt-px flex-none" />
                {viewerIsPrinter
                  ? `${othersAskedLabel(tx.print_group_size)}.`
                  : `${askedPrintersLabel(tx.print_group_size)}. The first to accept takes it; you will get a notification.`}
              </p>
            )}

            {tx.ready_photo_url && (
              <a
                href={`/files/print-shots/${tx.ready_photo_url}`}
                className="card flex items-center gap-3 p-4 no-underline"
              >
                <span aria-hidden="true" className="empty-badge text-brand-deep">
                  <PrinterIcon size={22} weight="duotone" />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-ink">The finished parts</span>
                  <span className="block text-sm text-muted">Open the photo</span>
                </span>
              </a>
            )}

            {!viewerIsPrinter && (
              <div className="flex flex-col gap-3 rounded-[24px] border border-line bg-surface p-[22px] shadow-[var(--shadow-e2),var(--shadow-hi)]">
                <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted">
                  Printer asked
                </p>
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[var(--b100)] text-[13px] font-extrabold text-[var(--tink)]"
                  >
                    {initials(otherPartyName ?? '')}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="text-sm font-extrabold text-ink">{otherPartyName}</span>
                    <span
                      className="inline-flex items-center gap-1 self-start rounded-full px-[9px] py-[3px] text-xs font-extrabold text-[var(--tink)]"
                      style={{ background: printerAnswer.tint }}
                    >
                      <printerAnswer.Icon size={13} weight="fill" aria-hidden="true" />
                      {printerAnswer.label}
                    </span>
                  </span>
                </div>
              </div>
            )}

            <div className="card p-0">
              <Disclosure summary="Job details">
                <dl className="flex flex-col text-sm">
                  <div className="flex justify-between gap-3 border-b border-line py-1.5">
                    <dt className="font-bold text-muted">Printer</dt>
                    <dd className="text-right font-bold text-ink">
                      {tx.printer?.name ?? 'Not recorded'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-line py-1.5">
                    <dt className="font-bold text-muted">Material</dt>
                    <dd className="text-right font-bold text-ink">
                      {tx.printer?.materials.join(', ') || 'Not recorded'}
                    </dd>
                  </div>
                  {tx.print_colour && (
                    <div className="flex justify-between gap-3 border-b border-line py-1.5">
                      <dt className="font-bold text-muted">Colour</dt>
                      <dd className="text-right font-bold text-ink">{tx.print_colour}</dd>
                    </div>
                  )}
                  {deliveryLabel && (
                    <div className="flex justify-between gap-3 border-b border-line py-1.5">
                      <dt className="font-bold text-muted">Delivery</dt>
                      <dd className="text-right font-bold text-ink">{deliveryLabel}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 py-1.5">
                    <dt className="font-bold text-muted">Where</dt>
                    <dd className="text-right font-bold text-ink">
                      {[tx.printer?.suburb, tx.printer?.state].filter(Boolean).join(', ') ||
                        'Not recorded'}
                    </dd>
                  </div>
                </dl>

                <p className="mt-3 text-[13px] font-bold uppercase tracking-wide text-muted">
                  Parts asked for
                </p>
                <ul className="mt-1 flex list-none flex-col gap-1 text-sm text-ink">
                  {tx.print_files.map((file) => (
                    <li key={file.id}>
                      {file.filename}
                      {file.quantity > 1 && ` × ${file.quantity}`}
                    </li>
                  ))}
                </ul>

                {tx.print_note && (
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">
                    {tx.print_note}
                  </p>
                )}
              </Disclosure>
            </div>
          </>
        }
      />
    </div>
  )
}
