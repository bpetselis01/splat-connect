'use client'
/**
 * The child profile as the board draws it: one page, three cards, one save.
 *
 * Basics (age), the four child questions (128's CHILD_QUESTIONS — the
 * same answers guides are tagged with, so Recommended counts what they share),
 * the room's everyday needs, and the Measurements (120). Every field is
 * optional, and nothing else is asked — the older MACS, BFMF, grip, wrist and
 * forearm columns stay in the table but no form writes them (APP 3
 * minimisation). These are plain-language preferences for ranking
 * guides, never a clinical assessment; see docs/REGULATORY-CHANGES.md.
 *
 * Saving the first time creates the profile and the URL swaps from
 * /dashboard/child/new to /dashboard/child/{id}.
 *
 * Related files:
 * - components/child-wizard.tsx: the same questions, one at a time, for a first run
 */
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import {
  CHILD_MEASURES,
  CHILD_QUESTIONS,
  EVERYDAY_NEEDS,
  ONE_HAND_LABEL,
  readMeasure,
  type ChildAnswers,
  type ChildMeasureField,
  type ChildProfile,
  type EverydayNeed,
} from '@splat-connect/types'
import { DeleteEntityButton } from '@/components/delete-entity-button'
import { browserApiClient } from '@/lib/browser-api-client'
import { NotMedicalNote } from '@/components/not-medical-note'

/** What a form holds before it is sent: the answers, age still as typed. */
export function answersOf(child: ChildProfile | null): ChildAnswers {
  return {
    age: child?.age ?? null,
    helps_with: child?.helps_with ?? [],
    access: child?.access ?? [],
    one_hand: child?.one_hand ?? false,
    press_force: child?.press_force ?? null,
    enjoys: child?.enjoys ?? [],
    everyday_needs: child?.everyday_needs ?? [],
  }
}

/**
 * One of the four child questions: press force is one answer, the rest any
 * number; How they use it carries the One hand chip. The wizard and the
 * editor both draw it, so the two ask the same thing the same way.
 */
export function ChildQuestion({
  q,
  answers,
  set,
  legend,
  hideLegend = false,
}: {
  q: (typeof CHILD_QUESTIONS)[number]
  answers: ChildAnswers
  set: (patch: Partial<ChildAnswers>) => void
  legend: string
  hideLegend?: boolean
}) {
  if (q.child === 'press_force') {
    return <ChoiceChips legend={legend} hideLegend={hideLegend} options={q.options} value={answers.press_force} onChange={(v) => set({ press_force: v as ChildAnswers['press_force'] })} />
  }
  const options = [...q.options, ...(q.child === 'access' ? [{ value: 'one_hand', label: ONE_HAND_LABEL }] : [])] as { value: string; label: string }[]
  const value = [...(answers[q.child] as string[]), ...(q.child === 'access' && answers.one_hand ? ['one_hand'] : [])]
  // ManyChips is itself the named group; a fieldset around it would name it twice.
  return (
    <div>
      {!hideLegend && <p className="field-label" aria-hidden="true">{legend}</p>}
      <ManyChips
        label={legend}
        options={options}
        value={value}
        onChange={(v) =>
          set(q.child === 'access' ? { access: v.filter((x) => x !== 'one_hand') as ChildAnswers['access'], one_hand: v.includes('one_hand') } : { [q.child]: v })
        }
      />
    </div>
  )
}

/** One single-choice question as a row of chips. Pressing the chosen chip again clears it. */
export function ChoiceChips({
  legend,
  options,
  value,
  onChange,
  hideLegend = false,
}: {
  legend: string
  options: readonly { value: string; label: string }[]
  value: string | null
  onChange: (v: string | null) => void
  hideLegend?: boolean
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className={hideLegend ? 'sr-only' : 'field-label'}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(value === o.value ? null : o.value)}
            className="chip"
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** The everyday needs, any number of them. */
export function NeedsChips({
  value,
  onChange,
}: {
  value: EverydayNeed[]
  onChange: (v: EverydayNeed[]) => void
}) {
  return <ManyChips label="Good to know" options={EVERYDAY_NEEDS} value={value} onChange={onChange} />
}

/** Any number of a list's options — the room's needs, what a child enjoys. */
export function ManyChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T[]
  onChange: (v: T[]) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className="chip"
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Card({ id, title, lead, children }: { id: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`child-${id}`} className="rounded-card border border-line bg-surface p-5 shadow-e2">
      <h2 id={`child-${id}`} className="text-xl font-extrabold text-ink">
        {title}
      </h2>
      {lead && <p className="mt-1 text-sm leading-relaxed text-muted">{lead}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  )
}

export function ChildEditor({ child: initialChild, label }: { child: ChildProfile | null; label?: string }) {
  const router = useRouter()
  const [child, setChild] = useState<ChildProfile | null>(initialChild)
  const [form, setForm] = useState<ChildAnswers>(() => answersOf(initialChild))
  const [age, setAge] = useState(initialChild?.age?.toString() ?? '')
  // As typed, so "400" stays on screen with its range under it.
  const [measures, setMeasures] = useState<Record<ChildMeasureField, string>>(() => {
    const text = (n: number | null | undefined) => (n == null ? '' : String(n))
    return {
      palm_width_mm: text(initialChild?.palm_width_mm),
      reach_cm: text(initialChild?.reach_cm),
      tray_mm: text(initialChild?.tray_mm),
    }
  })
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Partial<ChildAnswers>) => {
    setSaved(false)
    setForm((f) => ({ ...f, ...patch }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    // The inputs' min/max stop the browser submitting an out-of-range number,
    // and the API refuses one with a sentence; JSON drops an undefined here.
    const read = CHILD_MEASURES.map((m) => [m.field, readMeasure(m, measures[m.field])] as const)
    const body = {
      ...form,
      age: age.trim() === '' ? null : Number(age),
      ...Object.fromEntries(read),
    }
    try {
      if (!child) {
        const created = await browserApiClient.post<ChildProfile>('/api/child-profiles', body)
        setChild(created)
        router.replace(`/dashboard/child/${created.id}` as Route<string>)
      } else {
        setChild(await browserApiClient.patch<ChildProfile>(`/api/child-profiles/${child.id}`, body))
      }
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not save. Try once more.')
    } finally {
      setBusy(false)
    }
  }

  const heading = label || 'Add a child'

  return (
    <section className="max-w-[760px]">
      <p className="eyebrow text-muted">Private to you</p>
      <h1 className="title-hub mt-2">{heading}</h1>
      <p className="mt-2.5 max-w-[56ch] text-base leading-relaxed text-muted">
        Every field is optional. We use this only to suggest guides that suit your
        child — it is never shown to another person, contributor or organisation.
      </p>
      <div className="mt-3 flex flex-col gap-1">
        <p className="text-xs leading-relaxed text-muted">
          See the <Link href="/privacy" className="underline">privacy policy</Link>.
        </p>
        <NotMedicalNote />
      </div>

      <form onSubmit={save} className="mt-[26px] flex flex-col gap-4">
        <Card id="basics" title="Basics">
          <div className="grid gap-4 sm:grid-cols-[200px]">
            <label className="flex flex-col">
              <span className="field-label">Age</span>
              <input
                type="number"
                min={0}
                max={21}
                value={age}
                onChange={(e) => {
                  setSaved(false)
                  setAge(e.target.value)
                }}
                className="field"
              />
            </label>
          </div>
        </Card>

        <Card id="questions" title="Who they are" lead="Guides tagged with the same answers come first under Recommended.">
          {CHILD_QUESTIONS.map((q) => (
            <ChildQuestion key={q.child} q={q} legend={q.label} answers={form} set={set} />
          ))}
        </Card>

        <Card id="everyday-needs" title="Good to know" lead="Notes for whoever makes or lends a toy.">
          <NeedsChips value={form.everyday_needs} onChange={(v) => set({ everyday_needs: v })} />
        </Card>

        <Card id="measurements" title="Measurements" lead="Optional. Only for printed grips and mounts.">
          <div className="grid gap-4 sm:grid-cols-3">
            {CHILD_MEASURES.map((m) => {
              const bad = readMeasure(m, measures[m.field]) === undefined
              return (
                <div key={m.field} className="flex flex-col">
                  <label htmlFor={`measure-${m.field}`} className="field-label">{m.label}</label>
                  <input
                    id={`measure-${m.field}`}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={m.min}
                    max={m.max}
                    placeholder={m.placeholder}
                    value={measures[m.field]}
                    aria-invalid={bad || undefined}
                    aria-describedby={bad ? `measure-${m.field}-range` : undefined}
                    onChange={(e) => {
                      setSaved(false)
                      setMeasures((t) => ({ ...t, [m.field]: e.target.value }))
                    }}
                    className="field"
                  />
                  {bad && (
                    <span id={`measure-${m.field}-range`} className="mt-1 text-xs text-muted">
                      Between {m.min} and {m.max}.
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        {error && (
          <p role="alert" className="alert alert-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? 'Saving…' : child ? 'Save changes' : 'Create profile'}
          </button>
          <Link href={'/dashboard/profile' as Route<string>} className="btn btn-quiet">
            Cancel
          </Link>
          {saved && <p className="m-0 text-sm font-semibold text-ink">Saved</p>}
        </div>
      </form>

      {child && (
        <div className="mt-6">
          <DeleteEntityButton
            endpoint={`/api/child-profiles/${child.id}`}
            redirectTo={'/dashboard/profile' as Route<string>}
            label={heading}
          />
        </div>
      )}
    </section>
  )
}
