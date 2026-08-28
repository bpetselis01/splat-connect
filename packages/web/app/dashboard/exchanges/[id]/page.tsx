import { BackLink } from '@/components/back-link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { LiveTransaction } from '@/components/live-transaction'
import { ToyTransactionThread } from '@/components/toy-transaction-thread'
import { isOwnerSide } from '@splat-connect/types'
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
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

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
  const otherPartyName = isOwnerSide(tx, caps.profile.id, ledOrgIds)
    ? tx.requester_name
    : tx.owner_name

  return (
    <div>
      <LiveTransaction transactionId={id} />
      {/* The thread is reachable from a notification as well as the list, so it
          needs a way back that does not assume browser history. */}
      <div className="mb-6">
        <BackLink href="/dashboard/exchanges" label="My exchanges" />
        <h1 className="mt-1 title-detail">{tx.toy_name}</h1>
        <p className="mt-1 text-sm text-muted">
          {tx.type === 'donation' ? 'Donation' : 'Exchange'} with {otherPartyName}
        </p>
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
