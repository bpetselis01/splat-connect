/**
 * Admin Tutorial Review Queue
 *
 * Shows EVERY pending tutorial, including ones an organisation has already
 * accepted and is about to handle. Delegation removes the obligation to act, not
 * the visibility — so each row says who has it rather than disappearing.
 *
 * The hide link exists because a queue that never shrinks does not feel like the
 * bottleneck went away, which was the point of the whole feature. It defaults to
 * off: seeing everything is the safe default, and hiding is a deliberate act.
 *
 * Selecting a row opens the side pane (?selected=<id>) on the same page; the
 * row is still a link to the full review page, so nothing depends on it.
 *
 * Related files:
 * - packages/api/src/routes/admin.ts: GET /api/admin/tutorials, which embeds tutorial_orgs
 * - app/organizations/[id]: where a leader handles the ones marked accepted here
 */
import {
  BookOpenText,
  CheckCircle,
  Queue,
  SealCheck,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { tintFor } from '@/components/card-photo'
import { ReviewTabs } from '@/components/admin-review-tabs'
import { AdminReviewPane } from '@/components/admin-review-pane'
import { ReviewRowLink } from '@/components/admin-review-row-link'
import type {
  Tutorial,
  TutorialOrg,
  TutorialWithDetails,
  AdminAccountsResponse,
  ToyIdea,
} from '@splat-connect/types'

type Queued = Tutorial & {
  tutorial_orgs?: TutorialOrg[]
  tutorial_contributors?: Array<{ profile_id: string }>
}

/** `3 hours`, `1 day`, `9 days` — the board's WAITING cell. */
// Module scope: reading the clock inside the component is impure render.
function waiting(iso: string, now: number = Date.now()): { text: string; days: number } {
  const hours = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 36e5))
  if (hours < 24) return { text: `${hours} hour${hours === 1 ? '' : 's'}`, days: 0 }
  const days = Math.floor(hours / 24)
  return { text: `${days} day${days === 1 ? '' : 's'}`, days }
}

export default async function ReviewListPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string; selected?: string }>
}) {
  const { mine, selected } = await searchParams
  const [all, accounts, ideas] = await Promise.all([
    apiClient.get<Queued[]>('/api/admin/tutorials?status=pending'),
    // Names for the CONTRIBUTOR column. Resolved here rather than embedded:
    // embedding profiles kills the whole query under the 033/045 grants.
    apiClient
      .get<AdminAccountsResponse>('/api/admin/contributors')
      .catch(() => null),
    apiClient.get<ToyIdea[]>('/api/admin/ideas').catch(() => [] as ToyIdea[]),
  ])
  const nameOf = new Map((accounts?.accounts ?? []).map((a) => [a.id, a.name || a.email]))
  const pendingIdeas = Array.isArray(ideas) ? ideas.filter((i) => i.status === 'pending').length : 0

  const acceptedFor = (t: Queued) =>
    (t.tutorial_orgs ?? []).filter((b) => b.status === 'accepted')
  const hidingHandled = mine === '1'
  const unhandled = all.filter((t) => acceptedFor(t).length === 0)
  const tutorials = hidingHandled ? unhandled : all
  const handledCount = all.length - unhandled.length

  // The pane, only for a row that is on screen: once a guide is approved or
  // sent back it leaves the pending list and the pane closes with it.
  const base = hidingHandled ? '/admin/review?mine=1' : '/admin/review'
  const paneHref = (id: string) => `${base}${hidingHandled ? '&' : '?'}selected=${id}`
  const picked = tutorials.find((t) => t.id === selected) ?? null
  const detail = picked
    ? await apiClient.get<TutorialWithDetails>(`/api/tutorials/${picked.id}`).catch(() => null)
    : null
  const namesOf = (t: Queued) =>
    (t.tutorial_contributors ?? []).map((c) => nameOf.get(c.profile_id)).filter(Boolean)

  const header = (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <span className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">
          Admin
        </span>
        <h1 className="mt-1 font-display text-4xl font-extrabold leading-[1.1] text-ink">
          Review queue
        </h1>
      </div>
      <ReviewTabs current="guides" guides={all.length} ideas={pendingIdeas} />
    </div>
  )

  if (tutorials.length === 0) {
    return (
      <div>
        {header}
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-deep">
            <CheckCircle className="h-8 w-8" />
          </span>
          <p className="mt-4 font-bold text-ink">
            {hidingHandled && handledCount > 0
              ? 'Nothing left for you.'
              : 'No tutorials pending review.'}
          </p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            {hidingHandled && handledCount > 0 ? (
              <>
                {handledCount} {handledCount === 1 ? 'tutorial is' : 'tutorials are'} with an
                organisation. <Link href="/admin/review">Show everything</Link>.
              </>
            ) : (
              'Submissions land here the moment a contributor sends one for review.'
            )}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}
      <div className={detail ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]' : ''}>
      {/*
        GUIDE | CONTRIBUTOR | BACKING | WAITING | SAFETY, as the board draws
        it. SAFETY reads the contributor's declaration — the one safety fact a
        tutorial row carries.
      */}
      <div className="admin-table-card">
        <div className="overflow-x-auto">
          <table className="admin-table admin-table--caps">
            <thead>
              <tr>
                <th scope="col">Guide</th>
                <th scope="col">Contributor</th>
                <th scope="col">Backing</th>
                <th scope="col">Waiting</th>
                <th scope="col">Safety</th>
              </tr>
            </thead>
            <tbody>
              {tutorials.map((t) => {
                const accepted = acceptedFor(t)
                const who = namesOf(t)
                const wait = waiting(t.created_at)
                const on = t.id === picked?.id
                return (
                  <tr
                    key={t.id}
                    className="transition-colors hover:bg-[var(--surface2)]"
                    style={on ? { background: 'var(--b50)' } : undefined}
                  >
                    <td>
                      <ReviewRowLink
                        href={`/admin/review/${t.id}`}
                        paneHref={paneHref(t.id)}
                        className="flex items-center gap-3 font-extrabold text-ink no-underline"
                      >
                        <span
                          aria-hidden="true"
                          className="grid h-10 w-10 flex-none place-items-center rounded-[14px] text-ink"
                          style={{ background: tintFor(t.id) }}
                        >
                          <BookOpenText size={22} weight="duotone" />
                        </span>
                        {t.title}
                      </ReviewRowLink>
                    </td>
                    <td className="font-semibold">{who.length ? who.join(', ') : '—'}</td>
                    <td>
                      <span
                        className="admin-tag gap-1 px-2.5 py-[3px]"
                        style={{ background: accepted.length ? 'var(--tok)' : 'var(--surface2)' }}
                      >
                        {accepted.length ? (
                          <SealCheck size={14} weight="fill" aria-hidden="true" />
                        ) : (
                          <Queue size={14} weight="fill" aria-hidden="true" />
                        )}
                        {accepted.length
                          ? accepted.map((b) => b.organizations?.name).filter(Boolean).join(', ')
                          : 'SPLAT queue'}
                      </span>
                    </td>
                    <td
                      className="whitespace-nowrap font-bold"
                      style={{
                        color: wait.days >= 7 ? 'var(--bad)' : wait.days >= 5 ? 'var(--warn)' : 'var(--ink)',
                      }}
                    >
                      {wait.text}
                    </td>
                    <td>
                      <span
                        className="inline-flex items-center gap-1 text-sm font-bold"
                        style={{ color: t.safety_declared_at ? 'var(--ok)' : 'var(--warn)' }}
                      >
                        {t.safety_declared_at ? (
                          <CheckCircle size={16} weight="fill" aria-hidden="true" />
                        ) : (
                          <WarningCircle size={16} weight="fill" aria-hidden="true" />
                        )}
                        {t.safety_declared_at ? 'Affirmed' : 'Not declared'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--surface2)] px-[18px] py-3 text-sm font-bold text-muted">
          <span>
            {tutorials.length} of {all.length} pending
          </span>
          {/* Delegation removes the obligation to act, not the visibility —
              hiding the org-handled rows is a deliberate act, off by default. */}
          {handledCount > 0 &&
            (hidingHandled ? (
              <Link href="/admin/review">Show the {handledCount} an organisation is handling</Link>
            ) : (
              <Link href="/admin/review?mine=1">
                Hide the {handledCount} an organisation is handling
              </Link>
            ))}
        </div>
      </div>
      {detail && picked && (
        <AdminReviewPane
          tutorial={detail}
          contributor={namesOf(picked).join(', ') || 'Unknown contributor'}
          submitted={waiting(picked.created_at).text}
          closeHref={base}
        />
      )}
      </div>
    </div>
  )
}
