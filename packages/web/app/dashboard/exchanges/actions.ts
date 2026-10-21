'use server'
import { revalidatePath } from 'next/cache'
import { apiClient } from '@/lib/api-client'
import { apiMessage, type PickupAddress } from '@splat-connect/types'

// All three thread pages are views of one toy_transactions row (ADR 0001); only
// the page path differs.
type ThreadKind = 'exchange' | 'build' | 'print'

const THREAD_PATH: Record<ThreadKind, string> = {
  exchange: '/dashboard/exchanges',
  build: '/dashboard/exchanges/build',
  print: '/dashboard/print-requests',
}

async function post(id: string, kind: ThreadKind, action: string, body: object) {
  await apiClient.post(`/api/toy-transactions/${id}/${action}`, body)
  revalidatePath(`${THREAD_PATH[kind]}/${id}`)
}

export async function sendMessage(id: string, kind: ThreadKind, body: string) {
  await post(id, kind, 'messages', { body })
}

// An empty body for an organisation: the handler reads the fixed address from
// the org record and ignores whatever arrives here.
export async function accept(id: string, kind: ThreadKind, address?: PickupAddress | null) {
  await post(id, kind, 'accept', address ?? {})
}

export type ActionResult = { ok: true } | { ok: false; error: string }

// Returned rather than thrown: Next replaces a thrown server-action error with
// a generic one in production, which would hide the API's sentence ("This
// request is no longer open") and leave the decline form unable to show it.
export async function reject(id: string, kind: ThreadKind, reason?: string): Promise<ActionResult> {
  try {
    await post(id, kind, 'reject', { reason })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: apiMessage(e, 'Could not send the decline. Please try again.') }
  }
}

// Withdrawing one job of a grouped print request withdraws the whole request
// (the API sweeps the other printers' jobs, 074).
export async function withdraw(id: string, kind: ThreadKind) {
  await post(id, kind, 'withdraw', {})
}

export async function confirm(id: string, kind: ThreadKind, code: string) {
  await post(id, kind, 'confirm', { code })
}
