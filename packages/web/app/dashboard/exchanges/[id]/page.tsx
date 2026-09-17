import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { LiveTransaction } from '@/components/live-transaction'
import { ToyTransactionThread } from '@/components/toy-transaction-thread'
import Link from 'next/link'
import { Tag } from '@phosphor-icons/react/dist/ssr'
import { isOwnerSide } from '@splat-connect/types'
import { Badge } from '@/components/badge'
import { CostPanel, type CostLine, type Settlement } from '@/components/cost-panel'
import { StageRailCard } from '@/components/stage-rail-card'
import { exchangeStages, stageFacts } from '@/lib/exchange-stages'
import type { PickupAddress, Profile, ToyTransactionDetail } from '@splat-connect/types'

// A partly-filled profile address is no use as a default — the accept dialog
// would offer "use my saved address" and then refuse to submit it.
function defaultAddress(profile: Profile): PickupAddress | null {
  const { pickup_line1, pickup_suburb, pickup_state, pickup_postcode } = profile
  if (!pickup_line1 || !pickup_suburb || !pickup_state || !pickup_postcode) return null
  return { pickup_line1, pickup_suburb, pickup_state, pickup_postcode }
}

export default async function ExchangeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caps = await requireCapabilities()

  let tx: ToyTransactionDetail
  try {
    tx = await apiClient.get<ToyTransactionDetail>(`/api/toy-transactions/${id}`)
  } catch (err) {
    // Only a genuine 404 renders "not found" — any other failure (401, 500,
    // network) should hit the error boundary instead of a misleading page.
    if (err instanceof Error && /status 404/.test(err.message)) notFound()
    throw err
  }

  async function sendMessage(body: string) {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/messages`, { body })
    revalidatePath(`/dashboard/exchanges/${id}`)
  }
  async function accept(address: PickupAddress | null) {
    'use server'
    // An empty body for an organisation: the handler reads the fixed address
    // from the org record and ignores whatever arrives here.
    await apiClient.post(`/api/toy-transactions/${id}/accept`, address ?? {})
    revalidatePath(`/dashboard/exchanges/${id}`)
  }
  async function reject() {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/reject`, {})
    revalidatePath(`/dashboard/exchanges/${id}`)
  }
  async function withdraw() {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/withdraw`, {})
    revalidatePath(`/dashboard/exchanges/${id}`)
  }
  async function confirm(code: string) {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/confirm`, { code })
    revalidatePath(`/dashboard/exchanges/${id}`)
  }

  const ledOrgIds = caps.ledOrgs.map((org) => org.id)
  const ownerSide = isOwnerSide(tx, caps.profile.id, ledOrgIds)
  const otherPartyName = ownerSide ? tx.requester_name : tx.owner_name

  /*
   * Costs degrade to absent rather than taking the thread down. Somebody who
   * came here from a notification to read a message does not care that a money
   * panel is unavailable, and the panel renders nothing when there are no lines
   * anyway.
   */
  let costs: { lines: CostLine[]; settlement: Settlement | null } | null = null
  try {
    costs = await apiClient.get(`/api/exchange-costs/${id}`)
  } catch {
    costs = null
  }

  /*
   * Editing is offered only where the write would actually land. A cost line
   * names two profiles and 055's trigger insists both are parties, so an
   * organisation-held exchange — `owner_id` null since 033 — has nobody to put
   * on the other side of the line and the API refuses it. Offering the form
   * there would be a dead control; it is filed in SUPABASE.md instead.
   *
   * A rejected or withdrawn exchange is over. Money agreed on one that
   * completed is not: somebody still owes the postage, so `completed` keeps the
   * panel editable.
   */
  const canEditCosts =
    tx.owner_id !== null &&
    (tx.owner_id === caps.profile.id || tx.requester_id === caps.profile.id) &&
    tx.status !== 'rejected' &&
    tx.status !== 'withdrawn'

  // Computed here, after tx is assigned and after the viewer's side is known —
  // the brief's warning about facts quoting values assigned later is about
  // exactly this block, and the code in it is the viewer's own.
  const stages = exchangeStages(tx)
  const facts = stageFacts(tx, ownerSide)

  return (
    <div>
      <LiveTransaction transactionId={id} />
      {/* The thread is reachable from a notification as well as the list, so it
          needs a way back that does not assume browser history. */}
      {/* The full-width header: pills, title, one meta line, and the secondary
          action right-aligned away from everything that acts on the record. */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge status={tx.status} />
            <Badge
              status={tx.type === 'donation' ? 'toy_adaptation' : 'assistive_tech'}
              label={tx.type === 'donation' ? 'Donation' : 'Exchange'}
            />
            <span className="text-sm text-muted">
              Requested {new Date(tx.created_at).toLocaleDateString('en-AU')}
            </span>
          </div>
          <h1 className="mt-1 title-detail">{tx.toy_name}</h1>
          <p className="mt-1 text-sm text-muted">
            {ownerSide ? 'You are giving this to' : 'You are receiving this from'} {otherPartyName}
          </p>
        </div>
        <Link href={`/toy-library/${tx.toy_id}`} className="btn btn-quiet no-underline">
          <Tag size={18} weight="bold" aria-hidden="true" />
          View the listing
        </Link>
      </div>

      {costs && (
        <div className="mb-6">
          <CostPanel
            lines={costs.lines}
            settlement={costs.settlement}
            noteByName={otherPartyName}
            viewerName={caps.profile.name}
            viewerOwes={!ownerSide}
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
      />
    </div>
  )
}
