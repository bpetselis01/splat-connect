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
import { Check, CheckCircle, Cube, XCircle } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
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
    return <div className="browse-empty p-9 text-muted">No part requests yet.</div>
  }

  // Open ones first — each has a family waiting on a yes or a no.
  const rows = [...open, ...settled]

  return (
    <div className="grid gap-2.5">
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      {rows.map((r) => (
        <div
          key={r.id}
          className="card-flat grid grid-cols-1 items-center gap-4 px-5 py-4 shadow-e1 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div className="min-w-0">
            <p className="font-extrabold text-ink">{r.requester_name ?? 'A family'}</p>
            <p className="mt-[3px] text-sm text-muted">
              <Cube weight="bold" className="mr-1 inline text-brand-dark" aria-hidden="true" />
              {r.tutorial_title ?? 'Printable parts'} · {r.part_sets} set
              {r.part_sets === 1 ? '' : 's'}
              {r.print_note && ` · “${r.print_note}”`}
              {r.decline_reason && ` — ${r.decline_reason}`}
            </p>
          </div>
          {r.status === 'requested' ? (
            <span className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => {
                  // A print decline carries a reason by API contract. Asking
                  // here rather than letting the request 400 is the difference
                  // between a prompt and an error.
                  const reason = prompt('Why can you not print these? The family sees this.')
                  if (reason && reason.trim()) act(r.id, 'reject', reason.trim())
                }}
                className="btn btn-quiet min-h-11 px-3.5 text-sm"
              >
                Can&rsquo;t print these
              </button>
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => act(r.id, 'accept')}
                className="btn btn-primary min-h-11 px-4 text-sm"
              >
                <Check weight="bold" className="h-4 w-4" aria-hidden="true" />
                We&rsquo;ll print these
              </button>
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 justify-self-start rounded-full px-3 py-1.5 text-[13px] font-extrabold text-ink ${
                r.status === 'accepted' || r.status === 'completed'
                  ? 'bg-success-soft'
                  : 'bg-sunken'
              }`}
            >
              {r.status === 'accepted' || r.status === 'completed' ? (
                <CheckCircle weight="fill" aria-hidden="true" />
              ) : (
                <XCircle weight="fill" aria-hidden="true" />
              )}
              {r.status === 'accepted'
                ? 'Printing'
                : r.status === 'completed'
                  ? 'Printed'
                  : r.status === 'withdrawn'
                    ? 'Withdrawn'
                    : 'Declined'}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
