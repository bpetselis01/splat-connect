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
 * - components/badge.tsx: the status → copy/colour map, reused here
 */
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import type { Route } from 'next'
import { apiClient } from '@/lib/api-client'
import { isApiError } from '@/lib/api-core'
import { CheckCircle, Clock, Megaphone, XCircle, PencilLine } from '@phosphor-icons/react/dist/ssr'
import { X } from '@/components/icons'
import { shortDate } from '@/lib/dates'
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

  const pill =
    idea.status === 'pending'
      ? { tint: 'var(--tamber)', icon: Clock, text: 'Pending' }
      : idea.status === 'challenge'
        ? { tint: 'var(--tok)', icon: CheckCircle, text: 'Published as a challenge' }
        : idea.status === 'graduated'
          ? { tint: 'var(--b100)', icon: PencilLine, text: 'Being written up' }
          : { tint: 'var(--tbad)', icon: XCircle, text: 'Rejected' }
  const by = idea.profiles?.name ?? 'Someone'

  return (
    <div className="grid max-w-[1140px] grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-[5px] text-[13px] font-extrabold text-ink"
          style={{ background: pill.tint }}
        >
          <pill.icon size={16} weight="fill" aria-hidden="true" />
          {pill.text} · submitted by {by}
          {idea.created_at && ` on ${shortDate(idea.created_at)}`}
        </span>
        <h1 className="title-hub mt-3">{idea.title}</h1>
        <p className="mt-3 max-w-[58ch] text-lg text-muted">{idea.summary}</p>

        <h2 className="mt-7 mb-2 font-display text-[22px] font-extrabold text-ink">Why it matters</h2>
        <p className="max-w-[62ch] text-ink">{idea.description}</p>

        <h2 className="mt-7 mb-3 font-display text-[22px] font-extrabold text-ink">Details given</h2>
        <dl className="grid max-w-[520px] grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-[15px]">
          <dt className="font-semibold text-muted">Intended use</dt>
          <dd className="font-extrabold text-ink">{idea.intended_use}</dd>
          <dt className="font-semibold text-muted">Who it&apos;s for</dt>
          <dd className="font-extrabold text-ink">{idea.primary_user}</dd>
          {idea.contact_prefs.length > 0 && (
            <>
              <dt className="font-semibold text-muted">Happy to be contacted for</dt>
              <dd className="flex flex-wrap gap-x-3 font-extrabold text-ink">
                {idea.contact_prefs.map((pref) => (
                  <span key={pref}>{CONTACT_PREF_LABELS[pref]}</span>
                ))}
              </dd>
            </>
          )}
        </dl>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
        <div className="admin-panel">
          <p className="admin-kicker">Decision</p>

          {idea.status === 'graduated' && idea.tutorial_id && (
            <p className="alert">
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
            <p className="alert alert-danger">
              Graduation did not complete — this challenge is marked graduated, but no draft
              guide was created. It needs manual repair.
            </p>
          )}

          {idea.status === 'rejected' && (
            <p className="alert alert-danger">
              Rejected{idea.review_note ? `: ${idea.review_note}` : '.'}
            </p>
          )}

          {idea.status === 'pending' && (
            <div className="flex flex-col gap-3">
              <form action={publishAsChallenge.bind(null, idea.id)}>
                <button type="submit" className="btn btn-primary btn-ok btn-block">
                  <Megaphone size={18} weight="bold" aria-hidden="true" /> Publish as a challenge
                </button>
              </form>

              <form action={rejectIdea} className="mt-1 flex flex-col gap-3">
                <input type="hidden" name="id" value={idea.id} />
                <label htmlFor="reject-note" className="block">
                  <span className="mb-[7px] block text-sm font-extrabold text-ink">
                    Reason for rejecting
                  </span>
                  <textarea
                    id="reject-note"
                    name="note"
                    rows={4}
                    required
                    placeholder="Only the author sees this."
                    className="field bg-canvas"
                  />
                </label>
                <button type="submit" className="btn btn-danger btn-block">
                  <X /> Reject
                </button>
              </form>
            </div>
          )}

          {idea.status === 'challenge' && (
            <div className="flex flex-col gap-3">
              <form action={graduateIdea.bind(null, idea.id)}>
                <p className="mb-3 text-sm leading-relaxed text-muted">
                  Graduating starts a draft guide from this brief and copies every participant
                  across as a contributor. It only happens once.
                </p>
                <button type="submit" className="btn btn-primary btn-ok btn-block">
                  Graduate to draft guide
                </button>
              </form>

              <form action={rejectIdea} className="mt-1 flex flex-col gap-3">
                <input type="hidden" name="id" value={idea.id} />
                <label htmlFor="unpublish-note" className="block">
                  <span className="mb-[7px] block text-sm font-extrabold text-ink">
                    Why is this being withdrawn?
                  </span>
                  <textarea
                    id="unpublish-note"
                    name="note"
                    rows={3}
                    required
                    placeholder="Only the author sees this."
                    className="field bg-canvas"
                  />
                </label>
                <button type="submit" className="btn btn-danger btn-block">
                  <X /> Unpublish
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="rounded-[18px] border-[length:var(--bw)] border-line bg-[var(--b50)] px-[22px] py-5">
          <p className="text-sm leading-[1.55] text-muted">
            A published challenge gets a public brief and a thread. A rejected idea stays visible
            to its author, with your reason, and nowhere else.
          </p>
        </div>
      </aside>
    </div>
  )
}
