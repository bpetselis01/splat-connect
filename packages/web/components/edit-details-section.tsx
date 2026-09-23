'use client'
import { PanelActions, useSaveOnLeave } from '@/components/panel-actions'
/**
 * The tutorial's core fields (title/description/difficulty), extracted from
 * a plain server-action form into a client component so a save conflict —
 * caught as a rejected onSave — can be shown instead of crashing to an error
 * boundary. Every call carries the updated_at loaded at page render, not a
 * freshly re-fetched one: that's the whole point of the check.
 */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUILD_TIME_OPTIONS, SWITCH_TARGET_LABEL, SWITCH_FORCE_LABEL, SWITCH_HOLD_LABEL, type PressForce, type Hold, KIND_LABEL, MATURITY_LABEL, SAFETY_CHECKLIST, formatBuildTime, type Tutorial, type Difficulty, type TutorialKind, type TutorialMaturity } from '@splat-connect/types'
import { useToast } from '@/components/toast'

type SwitchTarget = 'large' | 'small'
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** 080's three tags, in the board's order, labelled in the fit line's own words. */
const SWITCH_ROWS = [
  { name: 'switch_target', legend: 'Target', labels: SWITCH_TARGET_LABEL },
  { name: 'switch_force', legend: 'Press', labels: SWITCH_FORCE_LABEL },
  { name: 'switch_hold', legend: 'Hold', labels: SWITCH_HOLD_LABEL },
] as const
type SwitchName = (typeof SWITCH_ROWS)[number]['name']

export function EditDetailsSection({
  tutorial,
  onSave,
}: {
  tutorial: Tutorial
  onSave: (patch: { title: string; description: string | null; difficulty: Difficulty; build_minutes: number | null; age_min: number | null; age_max: number | null; kind: TutorialKind; maturity: TutorialMaturity; switch_target: SwitchTarget | null; switch_force: PressForce | null; switch_hold: Hold | null; safety_declared?: true; updated_at: string }) => Promise<void>
}) {
  const router = useRouter()
  const showToast = useToast()
  const [pending, setPending] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [dirty, setDirty] = useState(false)
  // Chips are buttons, which fire no form change, so the tags are state and
  // ride into the FormData on hidden inputs. Tapping the chosen one clears it.
  const [tags, setTags] = useState<Record<SwitchName, string>>({
    switch_target: tutorial.switch_target ?? '',
    switch_force: tutorial.switch_force ?? '',
    switch_hold: tutorial.switch_hold ?? '',
  })

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setConflict(false)
    try {
      await onSave({
        title: formData.get('title') as string,
        description: (formData.get('description') as string) || null,
        difficulty: formData.get('difficulty') as Difficulty,
        build_minutes: Number(formData.get('build_minutes')) || null,
        // Not `|| null`: 0 is a real youngest age ("Age 0–3").
        age_min: formData.get('age_min') === '' ? null : Number(formData.get('age_min')),
        age_max: formData.get('age_max') === '' ? null : Number(formData.get('age_max')),
        kind: formData.get('kind') as TutorialKind,
        maturity: formData.get('maturity') as TutorialMaturity,
        switch_target: (formData.get('switch_target') as SwitchTarget) || null,
        switch_force: (formData.get('switch_force') as PressForce) || null,
        switch_hold: (formData.get('switch_hold') as Hold) || null,
        // Once declared, always declared — the timestamp on the row is the
        // record; the checkbox only exists until then.
        ...(formData.get('safety_declared') === 'on' ? { safety_declared: true as const } : {}),
        updated_at: tutorial.updated_at,
      })
      setDirty(false)
      showToast('Details saved')
      router.refresh()
      return true
    } catch {
      setConflict(true)
      return false
    } finally {
      setPending(false)
    }
  }

  /* Leaving the step saves it, so that walking on with Next costs nothing.
     The form is uncontrolled — the fields are the state — so the values come
     back out of the DOM the same way the submit handler gets them. Held to the
     same `dirty` guard as the Save button: an untouched form has nothing to
     write, and a conflicting write is the one thing this page has always been
     careful not to make by accident. */
  const formRef = useRef<HTMLFormElement>(null)
  useSaveOnLeave(
    dirty && !pending
      ? () => handleSubmit(new FormData(formRef.current!))
      : null
  )

  return (
    // Wrapped because handleSubmit reports whether it saved, which `action`
    // has no use for. Safe to wrap here where the same thing on the page's
    // server actions would not be: this is a client function already.
    <form
      ref={formRef}
      action={(formData) => void handleSubmit(formData)}
      onChange={() => setDirty(true)}
      className="flex flex-col gap-3 px-5 pb-5"
    >
      {conflict && (
        <p role="alert" className="alert alert-danger">
          This was updated while you were editing — reload to see the latest version before
          saving your changes.
        </p>
      )}
      <div>
        <label htmlFor="edit-title" className="field-label">Title</label>
        <input id="edit-title" name="title" defaultValue={tutorial.title} required className="field" />
      </div>
      <div>
        <label htmlFor="edit-description" className="field-label">Description</label>
        <textarea id="edit-description" name="description" defaultValue={tutorial.description ?? ''} rows={4} className="field" />
      </div>
      <div>
        <label htmlFor="edit-difficulty" className="field-label">Difficulty</label>
        <select id="edit-difficulty" key={tutorial.difficulty} name="difficulty" defaultValue={tutorial.difficulty} className="field">
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>
      <div>
        {/* Beside Difficulty because both answer "what am I getting into?".
            The board's editor counts printing in; Byron ruled it out, so the
            hint says so — a parent filtering "Under 30 min" reads hands-on
            time, and "Needs printing" is its own chip. */}
        <label htmlFor="edit-build-minutes" className="field-label">About how long does it take?</label>
        <select
          id="edit-build-minutes"
          key={tutorial.build_minutes ?? ''}
          name="build_minutes"
          defaultValue={tutorial.build_minutes ?? ''}
          className="field"
        >
          <option value="" disabled>Choose a time</option>
          {/* A value from before the list existed stays selectable rather than
              silently becoming "Choose a time" on the next save. */}
          {[...new Set([...BUILD_TIME_OPTIONS, ...(tutorial.build_minutes ? [tutorial.build_minutes] : [])])]
            .sort((a, b) => a - b)
            .map((m) => (
              <option key={m} value={m}>{m === 240 ? '4 h or more' : formatBuildTime(m)}</option>
            ))}
        </select>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Hands-on time only — printing time isn&apos;t included. Printed parts can take
          hours and are listed separately.
        </p>
      </div>
      <fieldset>
        {/* The board's review line reads "Easy · Age 3–7 · 20 minutes": the
            author's word on which children the adaptation suits. Two plain
            number fields; the range (0–18, max ≥ min) is 071's constraint. */}
        <legend className="field-label">Age range</legend>
        <div className="flex items-center gap-2">
          <label htmlFor="edit-age-min" className="sr-only">Youngest age</label>
          <input id="edit-age-min" name="age_min" type="number" inputMode="numeric" min={0} max={18} defaultValue={tutorial.age_min ?? ''} placeholder="From" className="field" />
          <span className="text-muted" aria-hidden="true">–</span>
          <label htmlFor="edit-age-max" className="sr-only">Oldest age</label>
          <input id="edit-age-max" name="age_max" type="number" inputMode="numeric" min={0} max={18} defaultValue={tutorial.age_max ?? ''} placeholder="To" className="field" />
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          In years. Leave both blank if it suits any age.
        </p>
      </fieldset>
      <div>
        {/* Editable, not just shown: picking the wrong card on /upload should
            cost a select change, not a new tutorial. Changing it redraws the
            pill row — the STL step appears or goes — on the refresh that
            follows the save. */}
        <label htmlFor="edit-kind" className="field-label">Kind</label>
        <select id="edit-kind" key={tutorial.kind} name="kind" defaultValue={tutorial.kind} className="field">
          {(Object.keys(KIND_LABEL) as TutorialKind[]).map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="edit-maturity" className="field-label">How far along is it?</label>
        <select id="edit-maturity" key={tutorial.maturity} name="maturity" defaultValue={tutorial.maturity} className="field">
          {(Object.keys(MATURITY_LABEL) as TutorialMaturity[]).map((m) => (
            <option key={m} value={m}>{MATURITY_LABEL[m]}</option>
          ))}
        </select>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Only complete guides appear in the public library listing. Anything earlier
          wears its stage as a badge.
        </p>
      </div>
      <fieldset>
        {/* The board's "Suits Ollie — big button, light press, short hold":
            what this guide's switch asks of a child, in the child profile's
            own words so the two compare directly. All optional — an untagged
            guide simply never claims to suit anyone. */}
        <legend className="field-label">What the switch asks</legend>
        <div className="flex flex-col gap-2.5">
          {SWITCH_ROWS.map((row) => (
            <div key={row.name} role="group" aria-label={row.legend} className="flex flex-wrap items-center gap-2">
              <span className="w-14 text-sm font-bold text-muted">{row.legend}</span>
              <input type="hidden" name={row.name} value={tags[row.name]} />
              {Object.entries(row.labels).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={tags[row.name] === value}
                  onClick={() => {
                    setTags((t) => ({ ...t, [row.name]: t[row.name] === value ? '' : value }))
                    setDirty(true)
                  }}
                  className="chip"
                >
                  {cap(label)}
                </button>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          A parent whose child can manage all of these sees &ldquo;Suits &lt;their child&gt;&rdquo;.
        </p>
      </fieldset>
      <fieldset>
        <legend className="field-label">Safety declaration</legend>
        {tutorial.safety_declared_at ? (
          <p className="text-sm leading-relaxed text-muted">
            Declared on {new Date(tutorial.safety_declared_at).toLocaleDateString('en-AU')}.
          </p>
        ) : (
          <>
            <ul className="list-disc pl-5 text-sm leading-relaxed text-muted">
              {SAFETY_CHECKLIST.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {/* Defaults to unchecked on purpose — a declaration is made, never assumed. */}
            <label className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-ink">
              <input type="checkbox" name="safety_declared" className="mt-1" />
              <span>
                I have checked this design against every point above. A guide cannot be
                submitted for review without this.
              </span>
            </label>
          </>
        )}
      </fieldset>
      <PanelActions>
        <button type="submit" disabled={!dirty || pending} className="btn btn-primary btn-sm">
          {pending ? 'Saving…' : 'Save details'}
        </button>
      </PanelActions>
    </form>
  )
}
