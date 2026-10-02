'use client'
/**
 * The child profile as the board draws it: one page, three cards, one save.
 *
 * Basics (name, age), the four switch questions, the everyday needs of the
 * room, and Play and Measurements (120, mobile's wizard steps). Every field is
 * optional, and nothing else is asked — the older MACS, BFMF, grip, wrist and
 * forearm columns stay in the table but no form writes them (APP 3
 * minimisation). What a child enjoys is kept for a future recommender; nothing
 * sorts or matches on it yet. These are plain-language preferences for ranking
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
  ENJOYS,
  EVERYDAY_NEEDS,
  readMeasure,
  type ChildAnswers,
  type ChildMeasureField,
  type ChildProfile,
  type Enjoy,
  type EverydayNeed,
} from '@splat-connect/types'
import { DeleteEntityButton } from '@/components/delete-entity-button'
import { browserApiClient } from '@/lib/browser-api-client'
import { NotMedicalNote } from '@/components/not-medical-note'

/** What a form holds before it is sent: the answers, age still as typed. */
export function answersOf(child: ChildProfile | null): ChildAnswers {
  return {
    name: child?.name ?? null,
    age: child?.age ?? null,
    working_hand: child?.working_hand ?? null,
    press_force: child?.press_force ?? null,
    aim: child?.aim ?? null,
    hold: child?.hold ?? null,
    everyday_needs: child?.everyday_needs ?? [],
  }
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
  return <ManyChips label="Everyday needs" options={EVERYDAY_NEEDS} value={value} onChange={onChange} />
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
  const [enjoys, setEnjoys] = useState<Enjoy[]>(initialChild?.enjoys ?? [])
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
      name: form.name?.trim() || null,
      age: age.trim() === '' ? null : Number(age),
      enjoys,
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

  const heading = child?.name?.trim() || label || 'Add a child'

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
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <label className="flex flex-col">
              <span className="field-label">Name or nickname</span>
              <input
                value={form.name ?? ''}
                onChange={(e) => set({ name: e.target.value })}
                maxLength={60}
                className="field"
              />
            </label>
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

        <Card
          id="ability"
          title="Ability profile"
          lead="Used to rank guides by whether the switch they call for is one your child can operate."
        >
          {CHILD_QUESTIONS.map((q) => (
            <ChoiceChips
              key={q.field}
              legend={q.prompt}
              options={q.options}
              value={form[q.field]}
              onChange={(v) => set({ [q.field]: v } as Partial<ChildAnswers>)}
            />
          ))}
        </Card>

        <Card id="everyday-needs" title="Everyday needs" lead="What matters in the room, rather than in the hand.">
          <NeedsChips value={form.everyday_needs} onChange={(v) => set({ everyday_needs: v })} />
        </Card>

        <Card id="play" title="Play" lead="What does your child enjoy?">
          <ManyChips
            label="What does your child enjoy?"
            options={ENJOYS}
            value={enjoys}
            onChange={(v) => {
              setSaved(false)
              setEnjoys(v)
            }}
          />
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
