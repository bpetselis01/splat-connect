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
import { ArrowLeft, ArrowRight, Check } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import { ChildAbilityForm } from '@/components/child-ability-form'
import { ChildEverydayNeedsForm } from '@/components/child-everyday-needs-form'
import { ChildCustomizationForm } from '@/components/child-customization-form'
import { ChildSurveyForm } from '@/components/child-survey-form'
import { SwitchAdaptedBear } from '@/components/switch-adapted-bear'
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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-muted">
        A name helps us talk about them naturally. It is never shared.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">
            First name <span className="font-semibold text-muted">(optional)</span>
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
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">Age</span>
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
            className="field w-28 font-mono tabular-nums"
          />
        </label>
      </div>
    </div>
  )
}

const STEPS = [
  { id: 'about', label: 'About', heading: 'Who are we finding toys for?' },
  { id: 'hands', label: 'Hands', heading: 'How do they use their hands?' },
  { id: 'movement', label: 'Movement', heading: 'Do you have their MACS or BFMF?' },
  { id: 'play', label: 'Play', heading: 'What gets in the way of playing?' },
  { id: 'measurements', label: 'Measurements', heading: 'Anything you have measured?' },
] as const

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
    <div className="grid gap-8 lg:grid-cols-[1fr_16rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/library" className="btn btn-quiet btn-sm">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to guides
          </Link>
          <p className="text-xs text-muted">Saved automatically · nothing is shared</p>
        </div>

        <ol aria-label="Progress" className="mt-4 flex list-none flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <span
                aria-current={i === step ? 'step' : undefined}
                className={`chip ${i === step ? '' : 'opacity-70'}`}
                data-on={i === step ? 'true' : undefined}
              >
                {i < step && <Check className="h-3 w-3" aria-hidden="true" />}
                {s.label}
              </span>
            </li>
          ))}
        </ol>

        <div className="card mt-5 p-6">
          <p className="eyebrow text-muted">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="mt-1 title-article">{current.heading}</h1>

          <div className="mt-5">
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

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              disabled={step === 0 || saving}
              className="btn btn-quiet btn-sm"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
            <div className="flex gap-2">
              {/* Skip does not save, and that is the difference. A parent who
                  skips has not answered, which is not the same as answering
                  blank — and the guides that come back should not pretend it
                  is. */}
              <button
                type="button"
                onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : router.push('/library'))}
                disabled={saving}
                className="btn btn-quiet btn-sm"
              >
                Skip
              </button>
              <button type="button" onClick={advance} disabled={saving} className="btn btn-primary btn-sm">
                {step === STEPS.length - 1 ? 'Finish' : 'Continue'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="card flex flex-col items-center gap-3 p-5 text-center">
          <SwitchAdaptedBear className="h-28 w-28" />
          <p className="text-sm leading-relaxed text-muted">{MASCOT[step]}</p>
        </div>
      </aside>
    </div>
  )
}
