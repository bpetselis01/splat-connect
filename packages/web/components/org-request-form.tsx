'use client'

/**
 * Asking for an organisation to exist.
 *
 * Three questions and no more: who they are, what the organisation does, and
 * how an admin can check the requester actually works there. Nothing about
 * capabilities or printers — those belong to the profile editor, and asking for
 * them before anybody has been verified would be collecting detail about an
 * organisation that may never exist.
 *
 * Leadership is granted by an admin and never self-started. That is the trust
 * model, and this form's job is to say so plainly rather than imply a form is
 * all it takes.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Buildings } from '@phosphor-icons/react/dist/ssr'
import type { OrganizationRequest } from '@splat-connect/types'
import { Badge } from '@/components/badge'
import { browserApiClient } from '@/lib/browser-api-client'

export function OrgRequestForm({ existing }: { existing: OrganizationRequest[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const open = existing.find((r) => r.status === 'pending')

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const el = e.currentTarget
    setError(null)
    startTransition(async () => {
      try {
        await browserApiClient.post('/api/organizations/requests', {
          org_name: String(form.get('org_name') ?? ''),
          what_they_do: String(form.get('what_they_do') ?? ''),
          verification: String(form.get('verification') ?? ''),
        })
        el.reset()
        setSent(true)
        router.refresh()
      } catch (err) {
        const detail = err instanceof Error ? /\{"error":"(.+?)"\}/.exec(err.message)?.[1] : null
        setError(detail ?? 'That did not send. Check your connection and try again.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {existing.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-ink">What you have asked for</h2>
          <ul className="flex list-none flex-col gap-3">
            {existing.map((request) => (
              <li key={request.id} className="card flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1 font-bold text-ink">{request.org_name}</span>
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
                {/* The reason, where there is one. A refusal with no reason is
                    what stops somebody asking again when they should. */}
                {request.review_note && (
                  <p className="text-sm leading-relaxed text-muted">{request.review_note}</p>
                )}
                {request.organization_id && (
                  <a
                    href={`/dashboard/organisation/profile`}
                    className="btn btn-quiet self-start no-underline"
                  >
                    Set up your profile
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {open ? (
        <p className="text-sm leading-relaxed text-muted">
          An admin is looking at your request for {open.org_name}. You will hear back here.
        </p>
      ) : (
        <form className="card flex flex-col gap-5 p-6" onSubmit={submit}>
          <label>
            <span className="field-label">The organisation&apos;s name</span>
            <input name="org_name" className="field mt-1 w-full" maxLength={120} />
          </label>

          <label>
            <span className="field-label">What it does</span>
            <textarea
              name="what_they_do"
              rows={5}
              maxLength={2000}
              className="field mt-1 w-full"
              placeholder="Who you work with, and what you would use SPLAT for."
            />
          </label>

          <label>
            <span className="field-label">How we can check you work there</span>
            <textarea
              name="verification"
              rows={4}
              maxLength={1000}
              className="field mt-1 w-full"
              placeholder="A work email on the organisation's domain, a staff page, a number we can ring."
            />
          </label>

          {error && (
            <p role="alert" className="alert alert-danger">
              {error}
            </p>
          )}
          {sent && (
            <p role="status" className="alert bg-mint-soft text-ink">
              Sent. An admin reviews every request before an organisation is created.
            </p>
          )}

          <button type="submit" className="btn btn-primary self-start" disabled={pending}>
            <Buildings size={18} weight="bold" aria-hidden="true" />
            Send the request
          </button>
        </form>
      )}
    </div>
  )
}
