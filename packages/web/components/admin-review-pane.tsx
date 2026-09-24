/**
 * The review queue's side pane — the board's #admin_review with a row
 * selected: enough of a pending guide to decide on without leaving the queue,
 * and the same Approve / Send back the full review page uses.
 *
 * Every mark is computed from the guide's own rows. The board also draws
 * "Prices checked in the last six months" and "A part is made by another
 * guide but nothing is marked Required first"; neither is answerable from
 * what a guide stores (no price-checked date, no part-to-guide link), so
 * neither is drawn. A check that cannot fail is not a check.
 */
import Link from 'next/link'
import type { Route } from 'next'
import { CheckCircle, WarningCircle, X, XCircle } from '@phosphor-icons/react/dist/ssr'
import { PhotoCarousel } from '@/components/photo-carousel'
import { approveTutorial, rejectTutorial } from '@/app/admin/review/actions'
import { plural, SAFETY_CHECKLIST, type TutorialWithDetails } from '@splat-connect/types'

type Mark = 'ok' | 'warn' | 'bad'
export type Check = { mark: Mark; label: string; detail: string }

type Reviewable = Pick<
  TutorialWithDetails,
  'kind' | 'photo_urls' | 'parts' | 'tutorial_pdf_url' | 'stl_files' | 'tutorial_collaborator_invites'
>

/** The COMPLETENESS list, from real data only. */
export function completeness(t: Reviewable): Check[] {
  const photos = t.photo_urls?.length ?? 0
  const checks: Check[] = [
    photos
      ? { mark: 'ok', label: 'At least one photo', detail: plural(photos, 'photo') }
      : { mark: 'bad', label: 'No photo', detail: 'A family decides from the photo first.' },
    t.parts.length
      ? { mark: 'ok', label: 'Parts listed', detail: plural(t.parts.length, 'part') }
      : { mark: 'bad', label: 'No parts listed', detail: 'Nobody can shop for this build.' },
    t.tutorial_pdf_url
      ? { mark: 'ok', label: 'Guide PDF attached', detail: 'The step-by-step file is there.' }
      : { mark: 'bad', label: 'No guide PDF', detail: 'The step-by-step file has not been uploaded.' },
  ]

  // Print settings only mean something for a printed design.
  if (t.kind === 'assistive_tech') {
    const files = t.stl_files ?? []
    const bare = files.filter((f) => f.print_minutes == null && f.filament_grams == null && f.material == null)
    checks.push(
      files.length === 0
        ? { mark: 'bad', label: 'No STL files', detail: 'A printed design with nothing to print.' }
        : bare.length
          ? {
              mark: 'warn',
              label: 'STL print settings',
              detail: `${bare.length} of ${plural(files.length, 'file')} ${bare.length === 1 ? 'has' : 'have'} no settings of its own.`,
            }
          : { mark: 'ok', label: 'STL print settings', detail: `Every file says how it was sliced.` },
    )
  }

  const waiting = (t.tutorial_collaborator_invites ?? []).filter((i) => i.status === 'pending').length
  checks.push(
    waiting
      ? {
          mark: 'warn',
          label: 'Co-authors not confirmed',
          detail: `${plural(waiting, 'invite')} not yet accepted.`,
        }
      : { mark: 'ok', label: 'Co-authors confirmed', detail: 'No invite is waiting on an answer.' },
  )
  return checks
}

const MARK = {
  ok: { Icon: CheckCircle, color: 'var(--ok)' },
  warn: { Icon: WarningCircle, color: 'var(--warn)' },
  bad: { Icon: XCircle, color: 'var(--bad)' },
} as const

function MarkRow({ mark, label, detail }: { mark: Mark; label: string; detail?: string }) {
  const { Icon, color } = MARK[mark]
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <Icon size={18} weight="fill" aria-hidden="true" className="mt-0.5 flex-none" style={{ color }} />
      <span className="min-w-0">
        <span className="font-bold text-ink">{label}</span>
        <span className="sr-only">{mark === 'ok' ? ' — fine' : mark === 'warn' ? ' — check' : ' — missing'}</span>
        {detail && <span className="block text-[13px] leading-[1.45] text-muted">{detail}</span>}
      </span>
    </li>
  )
}

export function AdminReviewPane({
  tutorial: t,
  contributor,
  submitted,
  closeHref,
}: {
  tutorial: TutorialWithDetails
  contributor: string
  /** "2 days", from the queue's own WAITING cell. */
  submitted: string
  closeHref: string
}) {
  const counts = [
    [t.parts.length, 'parts'],
    [t.tools.length, 'tools'],
    [t.stl_files.length, 'STL files'],
    [t.photo_urls?.length ?? 0, 'photos'],
  ] as const

  return (
    <aside aria-label={`Reviewing ${t.title}`} className="admin-panel flex flex-col gap-4 lg:sticky lg:top-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="admin-kicker !mb-1">Reviewing</p>
          <h2 className="m-0 font-display text-xl font-extrabold leading-tight text-ink">{t.title}</h2>
          <p className="mt-1 text-[13px] font-semibold text-muted">
            {contributor} · submitted {submitted} ago
          </p>
        </div>
        <Link
          href={closeHref as Route}
          scroll={false}
          aria-label="Close the review pane"
          className="grid h-9 w-9 flex-none place-items-center rounded-full border border-line bg-[var(--surface)] text-ink"
        >
          <X size={16} weight="bold" aria-hidden="true" />
        </Link>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-line">
        <PhotoCarousel urls={(t.photo_urls ?? []).slice(0, 1)} alt={t.title} className="aspect-[4/3]" />
      </div>

      <dl className="grid grid-cols-4 gap-2">
        {counts.map(([n, label]) => (
          <div key={label} className="flex flex-col-reverse rounded-[14px] bg-[var(--surface2)] px-1 py-2.5 text-center">
            <dt className="text-[11px] font-bold text-muted">{label}</dt>
            <dd className="m-0 font-display text-lg font-extrabold tabular-nums text-ink">{n}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h3 className="admin-kicker !mb-2">Safety checklist</h3>
        <p className="mb-2 text-[13px] text-muted">
          {t.safety_declared_at
            ? `Affirmed by the contributor on ${new Date(t.safety_declared_at).toLocaleDateString('en-AU')}. Check it holds.`
            : 'Never declared — check every point yourself.'}
        </p>
        <ul className="flex list-none flex-col gap-2 p-0">
          {SAFETY_CHECKLIST.map((item) => (
            <MarkRow key={item} mark={t.safety_declared_at ? 'ok' : 'warn'} label={item} />
          ))}
        </ul>
      </section>

      <section>
        <h3 className="admin-kicker !mb-2">Completeness</h3>
        <ul className="flex list-none flex-col gap-2 p-0">
          {completeness(t).map((c) => (
            <MarkRow key={c.label} {...c} />
          ))}
        </ul>
      </section>

      {/* One form, two verbs: Send back submits the note; Approve takes the
          same form through its own action and ignores it. */}
      <form action={rejectTutorial} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={t.id} />
        <label htmlFor="pane-note" className="block">
          <span className="mb-[7px] block text-sm font-extrabold text-ink">Note to contributor</span>
          <textarea
            id="pane-note"
            name="note"
            rows={3}
            placeholder="Be specific — what to change and why."
            className="field bg-canvas"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="submit" formAction={approveTutorial.bind(null, t.id)} className="btn btn-primary btn-ok">
            <CheckCircle weight="bold" aria-hidden="true" /> Approve
          </button>
          <button type="submit" className="btn btn-danger">
            <XCircle weight="bold" aria-hidden="true" /> Send back
          </button>
        </div>
      </form>

      <Link href={`/admin/review/${t.id}` as Route} className="text-center text-sm font-extrabold text-brand-dark">
        Open full preview →
      </Link>
    </aside>
  )
}
