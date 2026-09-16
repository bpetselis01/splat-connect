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
import { BookOpen, Printer as PrinterIcon } from '@phosphor-icons/react/dist/ssr'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { isOwnerSide } from '@splat-connect/types'
import type { PickupAddress, Profile, ToyTransactionDetail } from '@splat-connect/types'
import { BackLink } from '@/components/back-link'
import { Badge } from '@/components/badge'
import { Disclosure } from '@/components/disclosure'
import { CostPanel, type CostLine, type Settlement } from '@/components/cost-panel'
import { StageRailCard } from '@/components/stage-rail-card'
import { PrintNextStep } from '@/components/print-next-step'
import { LiveTransaction } from '@/components/live-transaction'
import { ToyTransactionThread } from '@/components/toy-transaction-thread'
import { printStages, printStageFacts } from '@/lib/print-stages'

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
    redirect(tx.type === 'build' ? `/dashboard/exchanges/build/${id}` : `/dashboard/exchanges/${id}`)
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

  return (
    <div>
      <LiveTransaction transactionId={id} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <BackLink href="/dashboard/print-requests" label="My print requests" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge status={tx.status} />
            <Badge status="toy_adaptation" label="Print" />
            <span className="text-sm text-muted">
              Sent {new Date(tx.created_at).toLocaleDateString('en-AU')}
            </span>
          </div>
          <h1 className="mt-1 title-detail">
            {tx.tutorial_title ? `${tx.tutorial_title} — parts` : 'A print job'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {viewerIsPrinter
              ? `${otherPartyName} asked your ${tx.printer?.name ?? 'printer'}`
              : `Printing on ${otherPartyName}’s ${tx.printer?.name ?? 'printer'}`}
          </p>
        </div>
        {tx.tutorial_id && (
          <Link href={`/tutorials/${tx.tutorial_id}`} className="btn btn-quiet no-underline">
            <BookOpen size={18} weight="bold" aria-hidden="true" />
            Open the guide
          </Link>
        )}
      </div>

      {costs && (
        <div className="mb-6">
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
          />
        </div>
      )}

      <div className="mb-6">
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
        asideTop={
          <>
            <PrintNextStep tx={tx} viewerIsPrinter={viewerIsPrinter} />

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
