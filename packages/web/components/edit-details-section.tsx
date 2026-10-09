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
import { BUILD_TIME_OPTIONS, KIND_LABEL, SAFETY_CHECKLIST, formatBuildTime, type Tutorial, type Difficulty, type TutorialKind } from '@splat-connect/types'
import { useToast } from '@/components/toast'

export function EditDetailsSection({
  tutorial,
  onSave,
}: {
  tutorial: Tutorial
  onSave: (patch: { title: string; description: string | null; difficulty: Difficulty; build_minutes: number | null; age_min: number | null; age_max: number | null; kind: TutorialKind; safety_declared?: true; toy_name: string | null; toy_brand: string | null; works_with: string | null; no_build_note: string | null; done_note: string | null; layer_height_mm?: number | null; infill_percent?: number | null; material?: string | null; print_minutes?: number | null; updated_at: string }) => Promise<void>
}) {
  const router = useRouter()
  const showToast = useToast()
  const [pending, setPending] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [dirty, setDirty] = useState(false)

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
        // Once declared, always declared — the timestamp on the row is the
        // record; the checkbox only exists until then.
        ...(formData.get('safety_declared') === 'on' ? { safety_declared: true as const } : {}),
        toy_name: ((formData.get('toy_name') as string) ?? '').trim() || null,
        toy_brand: ((formData.get('toy_brand') as string) ?? '').trim() || null,
        works_with: ((formData.get('works_with') as string) ?? '').trim() || null,
        no_build_note: ((formData.get('no_build_note') as string) ?? '').trim() || null,
        done_note: ((formData.get('done_note') as string) ?? '').trim() || null,
        ...(tutorial.kind === 'assistive_tech'
          ? {
              layer_height_mm: formData.get('layer_height_mm') === '' ? null : Number(formData.get('layer_height_mm')),
              infill_percent: formData.get('infill_percent') === '' ? null : Number(formData.get('infill_percent')),
              material: ((formData.get('material') as string) ?? '').trim() || null,
              print_minutes: formData.get('print_minutes') === '' ? null : Number(formData.get('print_minutes')),
            }
          : {}),
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
      <fieldset>
        <legend className="field-label">The toy you start with</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-toy-name" className="text-sm">Toy</label>
            <input id="edit-toy-name" name="toy_name" maxLength={80} defaultValue={tutorial.toy_name ?? ''} className="field" />
          </div>
          <div>
            <label htmlFor="edit-toy-brand" className="text-sm">Made by (optional)</label>
            <input id="edit-toy-brand" name="toy_brand" maxLength={80} defaultValue={tutorial.toy_brand ?? ''} placeholder="e.g. ZURU" className="field" />
          </div>
        </div>
      </fieldset>
      <div>
        <label htmlFor="edit-works-with" className="field-label">Works with</label>
        <input id="edit-works-with" name="works_with" maxLength={300} defaultValue={tutorial.works_with ?? ''} placeholder="Any 3.5mm switch — Jelly Bean, Big Red, or a printed lever switch." className="field" />
        <p className="mt-1 text-xs leading-relaxed text-muted">The switches this build accepts. Shown as its own card in the guide sidebar — a parent checks it before they start.</p>
      </div>
      <div>
        <label htmlFor="edit-no-build" className="field-label">If someone would rather not build it (optional)</label>
        <input id="edit-no-build" name="no_build_note" maxLength={300} defaultValue={tutorial.no_build_note ?? ''} placeholder="e.g. Organisation 2 keeps printed mounts on the shelf if you would rather not print one." className="field" />
        <p className="mt-1 text-xs leading-relaxed text-muted">Sits next to &ldquo;Get help with this build&rdquo; in the sidebar, before the link to the toy library. Leave blank and we just show the link.</p>
      </div>
      <div>
        <label htmlFor="edit-done-note" className="field-label">Your closing line (optional)</label>
        <textarea id="edit-done-note" name="done_note" rows={2} maxLength={300} defaultValue={tutorial.done_note ?? ''} placeholder="e.g. That's it. Test it with the lid off before you close it up." className="field" />
        <p className="mt-1 text-xs leading-relaxed text-muted">Shown after the last step, as a word from you.</p>
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
      {tutorial.kind === 'assistive_tech' && (
        <fieldset>
          <legend className="field-label">Print settings</legend>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">Layer height (mm)<input name="layer_height_mm" type="number" step="0.01" min={0.05} max={1} defaultValue={tutorial.layer_height_mm ?? ''} className="field" /></label>
            <label className="text-sm">Infill (%)<input name="infill_percent" type="number" min={0} max={100} defaultValue={tutorial.infill_percent ?? ''} className="field" /></label>
            <label className="text-sm">Material<input name="material" maxLength={40} defaultValue={tutorial.material ?? ''} placeholder="PETG" className="field" /></label>
            <label className="text-sm">Print time (minutes)<input name="print_minutes" type="number" min={1} max={6000} defaultValue={tutorial.print_minutes ?? ''} className="field" /></label>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">What you sliced it at. A printer copies these; they never set their own.</p>
        </fieldset>
      )}
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
