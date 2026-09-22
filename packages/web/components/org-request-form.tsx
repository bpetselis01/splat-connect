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
import Link from 'next/link'
import { PaperPlaneTilt, ShieldCheck } from '@phosphor-icons/react/dist/ssr'
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
    <div className="mt-7 flex flex-col gap-6">
      {open ? (
        <div className="flex flex-col items-center gap-3.5 rounded-card border border-line bg-[var(--surface)] px-[34px] py-10 text-center shadow-[var(--e3),var(--hi)]">
          <span
            aria-hidden="true"
            className="grid h-16 w-16 place-items-center rounded-card bg-[var(--tok)] text-[var(--tink)]"
          >
            <PaperPlaneTilt weight="duotone" className="text-[32px]" />
          </span>
          <h2 className="font-display text-[clamp(26px,3vw,34px)] font-extrabold leading-[1.15] text-ink">
            Sent for verification
          </h2>
          <p className="max-w-[52ch] text-base leading-[1.6] text-muted">
            An administrator checks every request against what you told us before {open.org_name}{' '}
            is created and you are appointed its first leader. You will hear back here.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2.5">
            <Link href="/dashboard" className="btn btn-primary px-[22px] text-[15px]">
              Go to My SPLAT
            </Link>
            <Link
              href="/get-involved/organisations"
              className="btn min-h-[52px] border-line bg-[var(--surface)] text-ink"
            >
              Back to For organisations
            </Link>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-[22px] rounded-card border border-line bg-[var(--surface)] p-7 shadow-[var(--e2)]"
          onSubmit={submit}
        >
          <div className="flex flex-col gap-4">
            <h2 className="font-display text-lg font-extrabold text-muted">The organisation</h2>
            <label>
              <span className="mb-[7px] block text-sm font-extrabold">Organisation name</span>
              <input
                name="org_name"
                className="field w-full"
                maxLength={120}
                placeholder="e.g. Riverina Makerspace"
              />
            </label>
            <label>
              <span className="mb-[7px] block text-sm font-extrabold">What it does</span>
              <textarea
                name="what_they_do"
                rows={3}
                maxLength={2000}
                className="field w-full"
                placeholder="Who you work with, and what you would hold or print — e.g. a shelf of adapted toys for families we already see, and a 3D printer for switch mounts."
              />
            </label>
          </div>

          <div className="flex flex-col gap-4 border-t border-line pt-1.5">
            <h2 className="mt-4 font-display text-lg font-extrabold text-muted">You</h2>
            <label>
              <span className="mb-[7px] block text-sm font-extrabold">How we can check you work there</span>
              <textarea
                name="verification"
                rows={3}
                maxLength={1000}
                className="field w-full"
                placeholder="Your role, a work email on the organisation's domain, a staff page, a number we can ring."
              />
            </label>
          </div>

          <div className="flex items-start gap-3 rounded-[18px] border border-line bg-[var(--b50)] px-[18px] py-4">
            <ShieldCheck weight="duotone" aria-hidden="true" className="shrink-0 text-2xl text-[var(--b600)]" />
            <p className="text-sm leading-[1.55] text-muted">
              <strong className="text-ink">Why we check:</strong> a leader can back guides and
              issue recycling credit against real filament rates. Backing a guide means a competent
              person read it — that claim is the whole risk, so we confirm you are who you say
              before you can make it.
            </p>
          </div>

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

          <div className="flex flex-wrap items-center gap-3 pt-1.5">
            <button type="submit" className="btn btn-primary px-[26px]" disabled={pending}>
              {pending ? 'Sending…' : 'Send for verification'}
            </button>
            <p className="text-[13px] text-muted">
              No fee, no obligation. If we can&apos;t verify it, we will tell you why.
            </p>
          </div>
        </form>
      )}

      {existing.length > 0 && (
        <section>
          <h2 className="title-section mb-3">What you have asked for</h2>
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
    </div>
  )
}
