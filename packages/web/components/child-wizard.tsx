'use client'
/**
 * The child profile as five questions, all skippable.
 *
 * Different from the editor at /dashboard/child/[id], and deliberately so. The
 * editor is four tabs you can move between in any order, which is right for
 * coming back to a profile you already have. This is the first run: one
 * question at a time, a progress rail, and Skip beside Continue on every step —
 * because the thing that stops a parent finishing is a form that looks like an
 * assessment, and the fastest way to make it not look like one is to make every
 * answer optional and say so.
 *
 * Each step saves as it advances rather than at the end. A parent who stops
 * after two questions keeps two answers, and the page says "Saved automatically
 * · nothing is shared" from the first screen rather than after the last.
 *
 * Reuses the editor's own form sections for four of the five steps. Two sets of
 * fields for one table would drift, and the sections already know their own
 * validation. Step one is the exception and is owned here: the artboard asks
 * only for a first name and an age, and the editor's Ability section carries
 * those alongside the clinical scores — which is the one thing a first screen
 * must not open with.
 *
 * Related files:
 * - components/child-editor.tsx: the same data, for somebody coming back to it
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle, Minus, Plus } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import { ChildAbilityForm } from '@/components/child-ability-form'
import { ChildEverydayNeedsForm } from '@/components/child-everyday-needs-form'
import { ChildCustomizationForm } from '@/components/child-customization-form'
import { ChildSurveyForm } from '@/components/child-survey-form'
import { SplatMascot, type MascotPose } from '@/components/splat-mascot'
import type { ChildProfile } from '@splat-connect/types'

/**
 * Step one, owned here rather than borrowed.
 *
 * A name and an age, and nothing else. The editor's Ability section has these
 * two fields alongside MACS and BFMF, and opening a parent's first screen with
 * a clinical scale is the thing the whole wizard is shaped to avoid.
 */
function AboutStep({
  profile,
  onChange,
}: {
  profile: ChildProfile | null
  onChange: (fields: { name: string | null; age: number | null }) => void
}) {
  const [name, setName] = useState(profile?.name ?? '')
  const [age, setAge] = useState(profile?.age?.toString() ?? '')

  function push(nextName: string, nextAge: string) {
    onChange({
      name: nextName.trim() || null,
      age: nextAge.trim() === '' ? null : Number(nextAge),
    })
  }

  // The board's −/+ stepper: an age is a small whole number, and two big
  // targets beat a spinner arrow for a parent on a phone.
  function stepAge(delta: number) {
    const next = Math.min(21, Math.max(0, (age === '' ? 0 : Number(age)) + delta)).toString()
    setAge(next)
    push(name, next)
  }
  const stepBtn =
    'grid h-[52px] w-[52px] flex-none place-items-center rounded-[14px] border border-line bg-surface text-ink active:scale-[.94]'

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
        <span>
          First name <span className="block font-semibold text-muted">(optional)</span>
        </span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            push(e.target.value, age)
          }}
          maxLength={60}
          placeholder="e.g. Sam"
          className="field"
        />
      </label>
      <div className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
        <span id="wizard-age">Age</span>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Younger" onClick={() => stepAge(-1)} className={stepBtn}>
            <Minus size={20} weight="bold" aria-hidden="true" />
          </button>
          <input
            type="number"
            min={0}
            max={21}
            value={age}
            onChange={(e) => {
              setAge(e.target.value)
              push(name, e.target.value)
            }}
            aria-label="Age in years"
            className="field min-w-0 flex-1 text-center font-display text-xl font-extrabold tabular-nums"
          />
          <button type="button" aria-label="Older" onClick={() => stepAge(1)} className={stepBtn}>
            <Plus size={20} weight="bold" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

const STEPS = [
  {
    id: 'about',
    label: 'About',
    heading: 'Who are we finding toys for?',
    help: 'A name helps us talk about them naturally. It is never shared.',
  },
  { id: 'hands', label: 'Hands', heading: 'How do they use their hands?' },
  { id: 'movement', label: 'Movement', heading: 'Do you have their MACS or BFMF?' },
  { id: 'play', label: 'Play', heading: 'What gets in the way of playing?' },
  { id: 'measurements', label: 'Measurements', heading: 'Anything you have measured?' },
] as const

/** The mascot's pose per step, as the board poses it. */
const POSE: MascotPose[] = ['wave', 'think', 'hold', 'party', 'think']

/** What the mascot says on each step. Short, and never about the child. */
const MASCOT = [
  'Hi! Five quick questions. Skip any you like.',
  'However they hold things is the right answer.',
  'Only if a clinician has given you one. The last step guessed otherwise.',
  'What is annoying is more useful than what is wrong.',
  'Only if you have a tape measure handy.',
] as const

export function ChildWizard({ child: initial }: { child: ChildProfile | null }) {
  const router = useRouter()
  const [child, setChild] = useState<ChildProfile | null>(initial)
  const [step, setStep] = useState(0)
  const [about, setAbout] = useState<{ name: string | null; age: number | null }>({
    name: initial?.name ?? null,
    age: initial?.age ?? null,
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  /**
   * Saves and advances. Whichever step is filled first creates the profile, the
   * same rule the editor follows — there is no step that must come before
   * another, because every field is a plain column.
   */
  async function save(fields: Partial<ChildProfile>) {
    setError(null)
    setSaving(true)
    try {
      const saved = child
        ? await browserApiClient.patch<ChildProfile>(`/api/child-profiles/${child.id}`, fields)
        : await browserApiClient.post<ChildProfile>('/api/child-profiles', fields)
      setChild(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Try once more.')
      throw e
    } finally {
      setSaving(false)
    }
  }

  async function advance() {
    // Only step one saves on Continue. The four borrowed sections have Save
    // buttons of their own and have already written by the time somebody moves
    // on — pressing Continue is not a second save, it is a page turn.
    if (step === 0 && (about.name !== null || about.age !== null)) {
      try {
        await save(about)
      } catch {
        return
      }
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1)
      return
    }
    // Finished. To the guides rather than to the profile: the point of the
    // wizard is what it unlocks, and a parent who has just answered five
    // questions about their child wants to see what changed.
    router.push('/library')
  }

  const current = STEPS[step]

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/library"
          className="inline-flex min-h-11 items-center gap-1.5 font-bold text-muted no-underline hover:text-ink"
        >
          <ArrowLeft size={16} weight="bold" aria-hidden="true" />
          Back to guides
        </Link>
        <p className="m-0 text-sm font-bold text-muted">Saved automatically · nothing is shared</p>
      </div>

      {/* The board's segmented rail: a bar per step, green once passed, brand
          on the current one, with its label underneath. */}
      <ol aria-label="Progress" className="m-0 mb-7 grid list-none grid-cols-5 gap-2 p-0">
        {STEPS.map((s, i) => (
          <li key={s.id} aria-current={i === step ? 'step' : undefined} className="flex flex-col gap-2">
            <span
              aria-hidden="true"
              className="h-2 rounded-pill transition-colors duration-300"
              style={{
                background: i < step ? 'var(--ok)' : i === step ? 'var(--b600)' : 'var(--line)',
              }}
            />
            <span
              className={`flex items-center gap-1.5 text-[13px] font-extrabold ${
                i <= step ? 'text-ink' : 'text-muted'
              }`}
            >
              {i < step && (
                <CheckCircle size={16} weight="fill" style={{ color: 'var(--ok)' }} aria-hidden="true" />
              )}
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_200px]">
        <div className="min-w-0 rounded-card border border-line bg-surface p-8 shadow-[var(--shadow-e3),var(--shadow-hi)]">
          <p className="m-0 text-[13px] font-extrabold uppercase tracking-[0.1em]" style={{ color: 'var(--b700)' }}>
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="m-0 mb-1.5 mt-2 font-display text-[34px] font-extrabold leading-[1.15] text-ink">
            {current.heading}
          </h1>
          {'help' in current && (
            <p className="m-0 text-[17px] leading-[1.5] text-muted">{current.help}</p>
          )}

          <div className="mt-6">
            {/* The editor's own sections, so one table has one set of fields.
                Each takes the child it has so far and hands back what changed. */}
            {step === 0 && <AboutStep profile={child} onChange={setAbout} />}
            {/* Hands: the quiz that ESTIMATES a hand score from what a parent
                sees, rather than asking for one they may not have. */}
            {step === 1 && <ChildSurveyForm profile={child} onSave={save} />}
            {/* Movement: the same two scales, entered directly, for a parent
                who has them from a clinician. */}
            {step === 2 && <ChildAbilityForm profile={child} onSave={save} />}
            {step === 3 && <ChildEverydayNeedsForm profile={child} onSave={save} />}
            {step === 4 && <ChildCustomizationForm profile={child} onSave={save} />}
          </div>

          {error && (
            <p role="alert" className="alert alert-danger mt-4">
              {error}
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              disabled={step === 0 || saving}
              className="btn btn-quiet"
            >
              <ArrowLeft size={16} weight="bold" aria-hidden="true" />
              Back
            </button>
            <div className="flex gap-2.5">
              {/* Skip does not save, and that is the difference. A parent who
                  skips has not answered, which is not the same as answering
                  blank — and the guides that come back should not pretend it
                  is. */}
              <button
                type="button"
                onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : router.push('/library'))}
                disabled={saving}
                className="btn border-transparent bg-transparent text-muted shadow-none hover:bg-sunken"
              >
                Skip
              </button>
              <button type="button" onClick={advance} disabled={saving} className="btn btn-primary">
                {step === STEPS.length - 1 ? 'Finish' : 'Continue'}
                <ArrowRight size={16} weight="bold" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <aside className="hidden flex-col items-center gap-3 text-center lg:flex">
          <SplatMascot width={150} pose={POSE[step]} />
          <p className="m-0 rounded-[18px] border border-line bg-surface px-3.5 py-3 text-sm font-semibold leading-[1.45] text-ink shadow-[var(--shadow-e2)]">
            {MASCOT[step]}
          </p>
        </aside>
      </div>
    </div>
  )
}
