'use client'

/**
 * The admin's queue of people asking for an organisation.
 *
 * Approving runs 060's function, which creates the organisation and appoints
 * the requester in one transaction. That matters here rather than only in the
 * migration: an admin pressing this button is doing three things, and if they
 * came apart the result would be an approved request with nothing behind it and
 * a person told they lead something that does not exist.
 *
 * Declining requires a note. A refusal with no reason is what stops somebody
 * asking again when they should, which is the same rule 037 set for a rejected
 * idea.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import Link from 'next/link'
import { Buildings } from '@phosphor-icons/react/dist/ssr'
import type { OrganizationRequest } from '@splat-connect/types'
import { Badge } from '@/components/badge'
import { browserApiClient } from '@/lib/browser-api-client'

export type QueuedRequest = OrganizationRequest & {
  requester?: { name: string; email: string } | null
}

export function OrgRequestQueue({ requests }: { requests: QueuedRequest[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [declining, setDeclining] = useState<string | null>(null)
  const [note, setNote] = useState('')

  function run(work: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try {
        await work()
        router.refresh()
      } catch (err) {
        const detail = err instanceof Error ? /\{"error":"(.+?)"\}/.exec(err.message)?.[1] : null
        setError(detail ?? 'That did not save. Check your connection and try again.')
      }
    })
  }

  const open = requests.filter((r) => r.status === 'pending')
  const decided = requests.filter((r) => r.status !== 'pending')

  function Row({ request }: { request: QueuedRequest }) {
    return (
      <li className="card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start gap-3">
          <span aria-hidden="true" className="empty-badge text-brand-deep">
            <Buildings size={22} weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{request.org_name}</p>
            <p className="text-sm text-muted">
              {request.requester?.name ?? 'A contributor'}
              {request.requester?.email && ` · ${request.requester.email}`} ·{' '}
              {new Date(request.created_at).toLocaleDateString('en-AU')}
            </p>
          </div>
          <Badge
            status={
              request.status === 'approved'
                ? 'approved'
                : request.status === 'declined'
                  ? 'rejected'
                  : 'pending'
            }
          />
        </div>

        <div>
          <p className="text-[13px] font-bold uppercase tracking-wide text-muted">What it does</p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
            {request.what_they_do}
          </p>
        </div>

        <div>
          <p className="text-[13px] font-bold uppercase tracking-wide text-muted">
            How to check they work there
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
            {request.verification}
          </p>
        </div>

        {request.review_note && (
          <p className="text-sm leading-relaxed text-muted">Note: {request.review_note}</p>
        )}

        {request.organization_id && (
          <Link
            href={`/organizations/${request.organization_id}/public` as Route}
            className="btn btn-quiet self-start no-underline"
          >
            Open the organisation
          </Link>
        )}

        {request.status === 'pending' && (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    await browserApiClient.post(
                      `/api/admin/organization-requests/${request.id}/approve`,
                      {}
                    )
                  })
                }
              >
                Approve and create it
              </button>
              <button
                type="button"
                className="btn btn-quiet"
                disabled={pending}
                onClick={() => {
                  setDeclining(declining === request.id ? null : request.id)
                  setNote('')
                }}
              >
                Decline
              </button>
            </div>

            {declining === request.id && (
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const reason = note.trim()
                  if (!reason) return
                  setDeclining(null)
                  run(async () => {
                    await browserApiClient.post(
                      `/api/admin/organization-requests/${request.id}/decline`,
                      { note: reason }
                    )
                  })
                }}
              >
                <label htmlFor={`decline-${request.id}`} className="field-label">
                  Why, in a way they can act on
                </label>
                <textarea
                  id={`decline-${request.id}`}
                  className="field"
                  rows={3}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-quiet self-start"
                  disabled={pending || !note.trim()}
                >
                  Send the decline
                </button>
              </form>
            )}
          </>
        )}
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Waiting ({open.length})</h2>
        {open.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted">Nothing waiting.</p>
        ) : (
          <ul className="flex list-none flex-col gap-3">
            {open.map((request) => (
              <Row key={request.id} request={request} />
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-ink">Decided</h2>
          <ul className="flex list-none flex-col gap-3">
            {decided.map((request) => (
              <Row key={request.id} request={request} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
