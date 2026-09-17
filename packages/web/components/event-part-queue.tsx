'use client'
/**
 * The part-print requests waiting on a host, with the two answers.
 *
 * "We'll print these" and "Can't print these" are an ordinary accept and reject
 * on an ordinary print job — 061 made an event a valid destination for one, so
 * nothing here needed a new endpoint or a new status. That is also what makes
 * the decline honest: it is the same record moving to `rejected` with a reason
 * on it, which is what /dashboard/events reads to tell the family to find a
 * printer nearby instead.
 *
 * Declining asks for the reason before it sends, because the API requires one
 * on a print job and a 400 after the click is a worse way to learn that.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Package } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import { Badge } from '@/components/badge'
import type { ToyTransactionSummary } from '@splat-connect/types'

export function EventPartQueue({ requests }: { requests: ToyTransactionSummary[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const open = requests.filter((r) => r.status === 'requested')
  const settled = requests.filter((r) => r.status !== 'requested')

  async function act(id: string, action: 'accept' | 'reject', reason?: string) {
    setError(null)
    setBusy(id)
    try {
      await browserApiClient.post(`/api/toy-transactions/${id}/${action}`, reason ? { reason } : {})
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Try once more.')
    } finally {
      setBusy(null)
    }
  }

  if (requests.length === 0) {
    return (
      <p className="card p-5 text-sm text-muted">
        No part requests yet. They arrive when a family asks for help with a printable guide and
        picks this event.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      {open.map((r) => (
        <div key={r.id} className="card flex flex-wrap items-center gap-4 p-4">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{r.requester_name ?? 'A family'}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
              <Package className="h-4 w-4 shrink-0" aria-hidden="true" />
              {r.tutorial_title ?? 'Printable parts'} · {r.part_sets} set
              {r.part_sets === 1 ? '' : 's'}
              {r.print_note && ` · “${r.print_note}”`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => {
                // A print decline carries a reason by API contract. Asking here
                // rather than letting the request 400 is the difference between
                // a prompt and an error.
                const reason = prompt('Why can you not print these? The family sees this.')
                if (reason && reason.trim()) act(r.id, 'reject', reason.trim())
              }}
              className="btn btn-danger btn-sm"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Can&apos;t print these
            </button>
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => act(r.id, 'accept')}
              className="btn btn-primary btn-sm"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              We&apos;ll print these
            </button>
          </div>
        </div>
      ))}

      {settled.map((r) => (
        <div key={r.id} className="card flex flex-wrap items-center gap-3 p-4 opacity-80">
          <Badge status={r.status} />
          <p className="min-w-0 flex-1 text-sm text-muted">
            {r.requester_name ?? 'A family'} · {r.tutorial_title ?? 'Printable parts'} ·{' '}
            {r.part_sets} set{r.part_sets === 1 ? '' : 's'}
            {r.decline_reason && ` — ${r.decline_reason}`}
          </p>
        </div>
      ))}
    </div>
  )
}
