'use client'
/**
 * Site content → Learn course (site-content-learn-legal-editing).
 *
 * The board's two sections: the course (title, "Shown as", what a reader can
 * do by the end) and its units (rename, reorder, open a unit to edit its
 * lessons' titles, lengths and kinds). Lessons are pages in code, so nothing
 * here adds a unit or a lesson — the board's "Add a unit" is left out.
 * One Save writes the whole outline; the API checks it (readLearnCourse) and
 * answers a refusal with the sentence shown here.
 *
 * Several admins may edit it (Byron, 2026-10-02): the editor shows who saved
 * last, and each save sends the version it loaded. If someone else saved
 * since, the API refuses (409) and the editor offers a reload rather than
 * laying this admin's outline over theirs.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CaretUp, Check, ListNumbers } from '@phosphor-icons/react/dist/ssr'
import {
  apiMessage,
  isApiError,
  longDate,
  LEARN_SHOWN_AS,
  LESSON_KIND_LABEL,
  type LearnCourse,
  type LearnShownAs,
  type LessonKind,
} from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

const SECTION = 'flex flex-col gap-3.5 rounded-card border-[length:var(--bw)] border-line bg-surface p-[22px] shadow-[var(--shadow-e2),var(--shadow-hi)]'
const SECTION_H = 'm-0 font-display text-[22px] font-extrabold text-ink'
const LABEL = 'mb-[7px] block text-sm font-extrabold text-ink'
const INPUT = 'field h-[50px] bg-canvas'

type EditLesson = { slug: string; title: string; minutes: number; kind: LessonKind }
type EditUnit = { id: string; title: string; blurb: string; lessons: EditLesson[] }

/** The saved row's version and who saved it, or null when nothing is saved yet. */
export type LearnCourseVersion = { updated_at: string; updated_by_name: string | null } | null

export function LearnCourseEditor({ course, version }: { course: LearnCourse; version: LearnCourseVersion }) {
  const router = useRouter()
  // What this form was loaded at; a save over anything newer is refused.
  const [expected, setExpected] = useState<string | null>(version?.updated_at ?? null)
  const [stale, setStale] = useState(false)
  const [title, setTitle] = useState(course.title ?? '')
  const [shownAs, setShownAs] = useState<LearnShownAs>(course.shown_as)
  const [outcome, setOutcome] = useState(course.outcome ?? '')
  const [units, setUnits] = useState<EditUnit[]>(() =>
    course.units.map((u) => ({
      id: u.id,
      title: u.title,
      blurb: u.blurb,
      lessons: u.lessons.map(({ slug, title, minutes, kind }) => ({ slug, title, minutes, kind })),
    }))
  )
  const [open, setOpen] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const setUnit = (i: number, patch: Partial<EditUnit>) =>
    setUnits(units.map((u, j) => (j === i ? { ...u, ...patch } : u)))
  const setLesson = (i: number, k: number, patch: Partial<EditLesson>) =>
    setUnit(i, { lessons: units[i].lessons.map((l, j) => (j === k ? { ...l, ...patch } : l)) })
  const moveUp = (i: number) =>
    setUnits([...units.slice(0, i - 1), units[i], units[i - 1], ...units.slice(i + 1)])

  async function save() {
    setError(null)
    setStale(false)
    setSaved(false)
    setSaving(true)
    try {
      // A blank title or outcome is left out, so the page keeps its own words.
      const row = await browserApiClient.put<{ updated_at: string }>('/api/admin/content/learn-course', {
        value: {
          ...(title.trim() ? { title } : {}),
          ...(outcome.trim() ? { outcome } : {}),
          shown_as: shownAs,
          units,
        },
        expected_updated_at: expected,
      })
      setExpected(row?.updated_at ?? expected)
      setSaved(true)
      startTransition(() => router.refresh())
    } catch (e) {
      setStale(isApiError(e) && e.status === 409)
      setError(apiMessage(e, 'That did not save. Try once more.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
          <span>{error}</span>
          {stale && (
            // A full reload: the form's state is seeded from props once, so a
            // refresh alone would keep showing this admin's unsaved outline.
            <button type="button" onClick={() => window.location.reload()} className="btn btn-quiet btn-md">
              Reload
            </button>
          )}
        </div>
      )}
      {version && (
        <p className="text-sm text-muted">
          Last edited{version.updated_by_name ? ` by ${version.updated_by_name}` : ''} on {longDate(version.updated_at)}
        </p>
      )}

      <section className={SECTION}>
        <h2 className={SECTION_H}>The course</h2>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
          <label className="block">
            <span className={LABEL}>Course title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={INPUT} />
          </label>
          <label className="block">
            <span className={LABEL}>Shown as</span>
            <select value={shownAs} onChange={(e) => setShownAs(e.target.value as LearnShownAs)} className={INPUT}>
              {LEARN_SHOWN_AS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className={LABEL}>What a reader can do by the end</span>
          <textarea
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            rows={3}
            maxLength={400}
            className="field bg-canvas leading-[1.55]"
          />
        </label>
      </section>

      <section className={SECTION}>
        <div>
          <h2 className={SECTION_H}>Units</h2>
          <p className="mt-1.5 max-w-[62ch] text-sm leading-normal text-muted">
            Reorder or rename here; open a unit to edit its lessons, their length and whether each one is a read, a
            build or a checkpoint.
          </p>
        </div>
        <ul className="flex list-none flex-col gap-2.5">
          {units.map((u, i) => {
            const n = i + 1
            const mins = u.lessons.reduce((m, l) => m + l.minutes, 0)
            return (
              <li key={u.id} className="rounded-[18px] border-[length:var(--bw)] border-line bg-canvas p-3.5">
                <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-3 max-sm:grid-cols-[32px_minmax(0,1fr)]">
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 place-items-center rounded-[14px] bg-[var(--b100)] font-display text-sm font-extrabold text-[var(--b700)]"
                  >
                    {n}
                  </span>
                  <span className="flex min-w-0 flex-col gap-2">
                    <input
                      aria-label={`Unit ${n} title`}
                      value={u.title}
                      onChange={(e) => setUnit(i, { title: e.target.value })}
                      maxLength={80}
                      className="field h-[42px] bg-surface text-sm font-extrabold"
                    />
                    <input
                      aria-label={`Unit ${n} blurb`}
                      value={u.blurb}
                      onChange={(e) => setUnit(i, { blurb: e.target.value })}
                      maxLength={300}
                      className="field h-10 bg-surface text-sm font-semibold"
                    />
                  </span>
                  <span className="flex flex-col items-end gap-1.5 max-sm:col-span-2 max-sm:flex-row max-sm:justify-between">
                    <span className="whitespace-nowrap text-xs font-extrabold text-muted">
                      {u.lessons.length} lessons · {mins} min
                    </span>
                    <span className="flex gap-1.5">
                      <button
                        type="button"
                        aria-label={`Edit lessons in unit ${n}`}
                        aria-expanded={open === u.id}
                        onClick={() => setOpen(open === u.id ? null : u.id)}
                        className="btn btn-quiet btn-md text-[13px] shadow-none"
                      >
                        <ListNumbers size={16} weight="bold" aria-hidden="true" /> Lessons
                      </button>
                      <button
                        type="button"
                        aria-label={`Move unit ${n} up`}
                        disabled={i === 0}
                        onClick={() => moveUp(i)}
                        className="btn btn-quiet btn-md w-9 px-0 shadow-none"
                      >
                        <CaretUp size={16} aria-hidden="true" />
                      </button>
                    </span>
                  </span>
                </div>
                {open === u.id && (
                  <ul className="mt-3 flex list-none flex-col gap-2 border-t border-line pt-3">
                    {u.lessons.map((l, k) => (
                      <li key={l.slug}>
                        <fieldset
                          aria-label={`Lesson ${k + 1}`}
                          className="grid grid-cols-[minmax(0,1fr)_96px_140px] gap-2 max-sm:grid-cols-2"
                        >
                          <label className="block max-sm:col-span-2">
                            <span className={LABEL}>Lesson</span>
                            <input
                              value={l.title}
                              onChange={(e) => setLesson(i, k, { title: e.target.value })}
                              maxLength={80}
                              className="field h-10 bg-surface text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className={LABEL}>Minutes</span>
                            <input
                              type="number"
                              min={1}
                              max={240}
                              value={l.minutes}
                              onChange={(e) => setLesson(i, k, { minutes: Number(e.target.value) })}
                              className="field h-10 bg-surface text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className={LABEL}>Kind</span>
                            <select
                              value={l.kind}
                              onChange={(e) => setLesson(i, k, { kind: e.target.value as LessonKind })}
                              className="field h-10 bg-surface text-sm"
                            >
                              {(Object.keys(LESSON_KIND_LABEL) as LessonKind[]).map((kind) => (
                                <option key={kind} value={kind}>
                                  {LESSON_KIND_LABEL[kind]}
                                </option>
                              ))}
                            </select>
                          </label>
                        </fieldset>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-[18px] border-[length:var(--bw)] border-line bg-[var(--b50)] px-5 py-[18px]">
        <button type="button" onClick={save} disabled={saving} className="btn btn-primary px-[26px]">
          <Check size={18} weight="bold" aria-hidden="true" />
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <strong className="text-ink">Saved.</strong>}
      </div>
    </div>
  )
}
