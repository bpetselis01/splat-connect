/**
 * Admin design-challenge detail: the full brief, then the verbs that move it
 * through review and, once it is a challenge, into a draft guide.
 *
 * Mirrors app/admin/review/[id]/page.tsx's shape (server actions, form per
 * verb, revalidatePath after each), but there is no GET
 * /api/admin/ideas/:id — only the queue endpoint exists (task-16 brief) — so
 * this loads the whole queue and finds the row, same as the queue page, and
 * 404s the way that page's tutorial counterpart 404s a failed fetch.
 *
 * Publish/Reject write PATCH /api/admin/ideas/:id/status, scoped server-side
 * to pending-or-challenge rows — a second review of an already-decided idea
 * 404s rather than re-firing a notification, so a stale page (two admins,
 * one tab each) fails safely rather than silently.
 *
 * Unpublish reuses rejectIdea verbatim: challenge -> rejected is the same
 * PATCH, with the same required-note guard, as pending -> rejected. The API
 * scopes both starting statuses to the one handler (CRITICAL 2 of the
 * whole-branch review — a published idea could otherwise never be taken
 * down, and it always writes review_note in the same call that sets
 * 'rejected', so no stale-note hazard exists the way a rejected -> pending
 * re-open would create).
 *
 * Graduate is deliberately a separate verb from review: it writes a tutorial
 * and contributor rows, not just a status, and only ever appears once the
 * idea is already a published challenge. POST .../graduate is scoped
 * server-side to challenge-status rows via a compare-and-swap, so a second
 * click loses the race and 409s — that means "already done", not a crash, so
 * it is swallowed here and the page's normal revalidated render shows the
 * true (already-graduated, tutorial linked) state instead.
 *
 * Related files:
 * - packages/api/src/routes/admin.ts: GET /ideas, PATCH /ideas/:id/status, POST /ideas/:id/graduate
 * - components/idea-status-badge.tsx: the status → copy/colour map, reused here
 */
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import type { Route } from 'next'
import { apiClient } from '@/lib/api-client'
import { isApiError } from '@/lib/api-core'
import { IdeaStatusBadge } from '@/components/idea-status-badge'
import { Check, X } from '@/components/icons'
import type { ToyIdea, ContactPref } from '@splat-connect/types'

type Admin = ToyIdea & { profiles: { name: string } | null }

const CONTACT_PREF_LABELS: Record<ContactPref, string> = {
  clarification: 'Clarification',
  co_design: 'Co-design',
  user_testing: 'User testing',
}

async function publishAsChallenge(id: string) {
  'use server'
  await apiClient.patch(`/api/admin/ideas/${id}/status`, { status: 'challenge' })
  revalidatePath('/admin/ideas')
  revalidatePath(`/admin/ideas/${id}`)
}

// Pure so it is testable without driving a 'use server' action (nothing in
// this codebase does that). Whitespace-only counts as absent — `required` on
// the textarea is only the browser's opinion, this is the real guard.
export function rejectNoteFrom(value: FormDataEntryValue | null): string | null {
  const note = typeof value === 'string' ? value.trim() : ''
  return note || null
}

async function rejectIdea(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  // review_note is the whole point of this path: it is the only thing the
  // author sees explaining why their idea did not go forward, and what
  // stops a resubmission with the same problem.
  const note = rejectNoteFrom(formData.get('note'))
  if (!note) return
  await apiClient.patch(`/api/admin/ideas/${id}/status`, { status: 'rejected', review_note: note })
  revalidatePath('/admin/ideas')
  revalidatePath(`/admin/ideas/${id}`)
}

async function graduateIdea(id: string) {
  'use server'
  try {
    await apiClient.post(`/api/admin/ideas/${id}/graduate`, {})
  } catch (err) {
    // 409 means another click already won the race and graduated this idea —
    // "already done", not a failure. Anything else is a real error and
    // should still surface.
    if (!isApiError(err) || err.status !== 409) throw err
  }
  revalidatePath('/admin/ideas')
  revalidatePath(`/admin/ideas/${id}`)
}

export default async function AdminIdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let all: Admin[]
  try {
    all = await apiClient.get<Admin[]>('/api/admin/ideas')
  } catch {
    notFound()
  }

  const idea = all!.find((i) => i.id === id)
  if (!idea) notFound()

  return (
    <div className="max-w-2xl">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-ink">{idea.title}</h1>
        <IdeaStatusBadge status={idea.status} />
      </div>
      <p className="mb-6 text-sm text-muted">
        Submitted by <strong className="text-ink">{idea.profiles?.name ?? 'Someone'}</strong> on{' '}
        {new Date(idea.created_at).toLocaleDateString()}
      </p>

      <p className="mb-6 text-base font-semibold leading-relaxed text-ink">{idea.summary}</p>

      <dl className="mb-6 flex flex-col gap-4 text-sm">
        <div>
          <dt className="font-semibold text-ink">Description</dt>
          <dd className="mt-1 leading-relaxed text-muted">{idea.description}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Intended use</dt>
          <dd className="mt-1 leading-relaxed text-muted">{idea.intended_use}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Who it&apos;s for</dt>
          <dd className="mt-1 leading-relaxed text-muted">{idea.primary_user}</dd>
        </div>
      </dl>

      {idea.contact_prefs.length > 0 && (
        <div className="mb-6">
          <p className="field-label">Happy to be contacted for</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {idea.contact_prefs.map((pref) => (
              <span key={pref} className="chip">
                {CONTACT_PREF_LABELS[pref]}
              </span>
            ))}
          </div>
        </div>
      )}

      {idea.status === 'graduated' && idea.tutorial_id && (
        <p className="alert mb-6">
          Graduated —{' '}
          <Link
            href={`/admin/review/${idea.tutorial_id}` as Route<string>}
            className="font-semibold underline"
          >
            view the draft guide
          </Link>
          .
        </p>
      )}

      {/* IMPORTANT 6 — the documented worst case: the status claim in
          POST .../graduate succeeded but the tutorial insert or link-back
          failed partway. Detection only, no repair action here; see the
          route's own doc comment for how this state is fixed by hand. */}
      {idea.status === 'graduated' && !idea.tutorial_id && (
        <p className="alert alert-danger mb-6">
          Graduation did not complete — this challenge is marked graduated,
          but no draft guide was created. It needs manual repair.
        </p>
      )}

      {idea.status === 'rejected' && (
        <p className="alert alert-danger mb-6">
          Rejected{idea.review_note ? `: ${idea.review_note}` : '.'}
        </p>
      )}

      <div className="flex flex-col gap-4 border-t border-line pt-6">
        {idea.status === 'pending' && (
          <>
            <form action={publishAsChallenge.bind(null, idea.id)}>
              <button
                type="submit"
                className="btn btn-block bg-mint-deep text-white shadow-rest hover:brightness-90"
              >
                <Check /> Publish as challenge
              </button>
            </form>

            <form action={rejectIdea} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={idea.id} />
              <label htmlFor="reject-note" className="field-label">
                Why isn&apos;t this going forward?
              </label>
              <textarea id="reject-note" name="note" rows={3} required className="field" />
              <button type="submit" className="btn btn-danger btn-block">
                <X /> Reject
              </button>
            </form>
          </>
        )}

        {idea.status === 'challenge' && (
          <>
            <form action={graduateIdea.bind(null, idea.id)}>
              <p className="mb-2 max-w-prose text-sm leading-relaxed text-muted">
                Graduating starts a draft guide from this brief and copies every
                participant across as a contributor. It only happens once.
              </p>
              <button
                type="submit"
                className="btn btn-block bg-mint-deep text-white shadow-rest hover:brightness-90"
              >
                Graduate to draft guide
              </button>
            </form>

            <form action={rejectIdea} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={idea.id} />
              <label htmlFor="unpublish-note" className="field-label">
                Why is this being withdrawn?
              </label>
              <textarea id="unpublish-note" name="note" rows={3} required className="field" />
              <button type="submit" className="btn btn-danger btn-block">
                <X /> Unpublish
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
