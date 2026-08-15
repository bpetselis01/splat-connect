import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { ToyTransactionThread } from '@/components/toy-transaction-thread'
import type { ToyTransactionDetail } from '@splat-connect/types'

export default async function ExchangeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  let tx: ToyTransactionDetail
  try {
    tx = await apiClient.get<ToyTransactionDetail>(`/api/toy-transactions/${id}`)
  } catch {
    notFound()
  }

  async function sendMessage(body: string) {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/messages`, { body })
    revalidatePath(`/dashboard/exchanges/${id}`)
  }
  async function accept() {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/accept`, {})
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

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">{tx.toy_name}</h1>
      <ToyTransactionThread
        transaction={tx}
        viewerId={caps.profile.id}
        onSendMessage={sendMessage}
        onAccept={accept}
        onReject={reject}
        onWithdraw={withdraw}
        onConfirm={confirm}
      />
    </div>
  )
}
