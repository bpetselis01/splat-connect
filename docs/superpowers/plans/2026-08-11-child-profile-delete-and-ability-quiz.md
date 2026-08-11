# Child profile: delete confirmation dialog + web ability quiz — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the web child-profile two-click delete with a typed-confirmation dialog, and give the web form the same MACS/BFMF estimator quiz mobile has, from one shared implementation.

**Architecture:** Three independent commits. First `estimate-ability.ts` moves from `packages/mobile/lib/` into `@splat-connect/types` (a zero-build package that exports `./src/index.ts` directly), so both platforms consume one copy. Then `DeleteChildButton` is rewritten around the native `<dialog>` pattern `ContributorTermsDialog` already established. Then `ChildProfileForm` grows a collapsible chip quiz that writes the shared estimator's result into the existing form state.

**Tech Stack:** Next.js 16 / React 19 (web, vitest + @testing-library/react + jsdom 24), Expo 57 / React Native (mobile, jest-expo), pnpm workspaces, Tailwind v4.

Source spec: `docs/superpowers/specs/2026-08-11-child-profile-delete-and-ability-quiz-design.md`

## Global Constraints

- Confirmation phrase is exactly `` `confirm_delete_${label.replace(/ /g, '_')}` `` — case-sensitive, compared with `!==`.
- Toggle copy is exactly: `Don't know MACS level? Fill out this quick survey.`
- `estimateAbility()` / `QUESTIONS` / `MacsLevel` / `BfmfLevel` / `AbilityQuestion` move **verbatim**, including the `ponytail:` placeholder-mapping caveat comment. No values change.
- Web chips use `className="chip"` + `aria-pressed`, the pattern already at `packages/web/app/upload/page.tsx:336-345`. No new component.
- The dialog uses native `<dialog>` + `showModal()`/`close()` from a `useEffect`, matching `packages/web/components/contributor-terms-dialog.tsx`. No dialog library, no new dialog abstraction.
- Closing and confirming must never both fire for one interaction — do not wire the native `close` event.
- Every task ends green on: `pnpm typecheck` (root, runs all packages), `pnpm --filter @splat-connect/web test:unit`, `pnpm --filter @splat-connect/mobile test:unit`.

## Deviations from the spec (deliberate, read before starting)

1. **The estimator's unit test stays in the mobile jest suite.** The spec says the test "moves with the file" into `packages/types`, but `packages/types/package.json` has no test runner — only `{"typecheck": "tsc --noEmit"}`. Adding vitest, a config, and a dev dependency to a package for one pure function is more machinery than the coverage is worth. `packages/mobile/tests/unit/lib/estimate-ability.test.ts` stays where it is with its import repointed at `@splat-connect/types`; identical assertions, identical coverage, zero new files. If `packages/types` ever gains a second piece of runtime logic, move the test then.
2. **Manual dropdown edits do NOT currently reset `_source`.** The spec's section 3 says "Editing either dropdown manually already resets its `_source` back to `'manual'` (existing code) — no new logic needed there." That is wrong: `child-profile-form.tsx:160` and `:175` set only `macs_level` / `bfmf_score`. Task 3 adds the reset, because without it estimating and then hand-correcting the dropdown persists `macs_source: 'estimated'` for a manually chosen value.

## File Structure

**Task 1 — shared estimator**
- Create: `packages/types/src/estimate-ability.ts` — `QUESTIONS`, `estimateAbility()`, the three exported types, the `ponytail:` caveat.
- Modify: `packages/types/src/index.ts` — one re-export line.
- Modify: `packages/mobile/components/profile/ability-screen.tsx:12` — import from `@splat-connect/types`.
- Modify: `packages/mobile/tests/unit/components/profile/ability-screen.test.tsx:3` — same.
- Modify: `packages/mobile/tests/unit/lib/estimate-ability.test.ts:1` — same.
- Delete: `packages/mobile/lib/estimate-ability.ts`.

**Task 2 — delete dialog**
- Modify: `packages/web/components/delete-child-button.tsx` — full rewrite.
- Modify: `packages/web/app/dashboard/child/[id]/page.tsx:29-32` — pass the label it already computes.
- Modify: `packages/web/app/globals.css:649-663` — rename `.terms-dialog` to `.dialog-panel` (one component uses it; both dialogs want it).
- Modify: `packages/web/components/contributor-terms-dialog.tsx:38` — updated class name.
- Modify: `packages/web/components/contributor-terms-dialog.tsx:5-6` — comment references the polyfill note, no change needed; skip if untouched.
- Modify: `packages/web/tests/unit/setup.ts:5` — comment names the components that need the polyfill; add the delete button.
- Test: `packages/web/tests/unit/components/delete-child-button.test.tsx` — full rewrite.

**Task 3 — web quiz**
- Modify: `packages/web/components/child-profile-form.tsx` — imports, quiz state, `runEstimate()`, `_source` reset on the two dropdowns, quiz markup, header docstring.
- Test: `packages/web/tests/unit/components/child-profile-form.test.tsx` — append a `describe` block.

---

### Task 1: Move the ability estimator into `@splat-connect/types`

**Files:**
- Create: `packages/types/src/estimate-ability.ts`
- Modify: `packages/types/src/index.ts` (append one line)
- Modify: `packages/mobile/components/profile/ability-screen.tsx:12`
- Modify: `packages/mobile/tests/unit/components/profile/ability-screen.test.tsx:3`
- Modify: `packages/mobile/tests/unit/lib/estimate-ability.test.ts:1`
- Delete: `packages/mobile/lib/estimate-ability.ts`

**Interfaces:**
- Consumes: nothing.
- Produces, all exported from `@splat-connect/types`:
  - `type MacsLevel = 'I' | 'II' | 'III' | 'IV' | 'V'`
  - `type BfmfLevel = '1' | '2' | '3' | '4' | '5'`
  - `type AbilityQuestion = { prompt: string; options: string[] }`
  - `const QUESTIONS: AbilityQuestion[]` — length 4, each with 4 options
  - `function estimateAbility(answers: number[]): { macs: MacsLevel; bfmf: BfmfLevel }` — throws if `answers.length !== 4`

- [ ] **Step 1: Repoint the existing estimator test at the new home (this is the failing test)**

Change line 1 of `packages/mobile/tests/unit/lib/estimate-ability.test.ts` and add a locator comment, leaving every assertion untouched:

```ts
// The module under test lives in @splat-connect/types (both platforms use it);
// that package has no test runner of its own, so its one runnable check lives
// here, in the suite that already existed when the file moved.
import { estimateAbility, QUESTIONS } from '@splat-connect/types'
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @splat-connect/mobile test:unit -- estimate-ability
```

Expected: FAIL — `@splat-connect/types` has no export named `estimateAbility`.

Note: the `-- <name>` filter is a no-op in this repo; the whole suite runs and this file is the one that fails. That is fine, read for `estimate-ability.test.ts` in the output.

- [ ] **Step 3: Create the shared module**

Create `packages/types/src/estimate-ability.ts` with the contents of `packages/mobile/lib/estimate-ability.ts`, unchanged:

```ts
// ponytail: PLACEHOLDER clinical mapping, NOT a validated instrument. The
// question set and the answer→MACS/BFMF lookup are a naive linear bucketing
// stand-in and MUST be revised by someone with real MACS/BFMF domain
// expertise before this is trusted for assistive-device decisions.
//
// Lives here rather than in packages/mobile/lib because both the mobile
// ability-screen.tsx and the web child-profile-form.tsx quiz run it, and a
// second copy would drift the moment the mapping above is revised. Pure
// logic, no React Native import — see the docstring in child-profile-form.tsx
// for why UI components are still re-implemented per platform.

export type MacsLevel = 'I' | 'II' | 'III' | 'IV' | 'V'
export type BfmfLevel = '1' | '2' | '3' | '4' | '5'

export type AbilityQuestion = { prompt: string; options: string[] }

// Each option index (0..3) contributes its own value to a 0..12 total.
export const QUESTIONS: AbilityQuestion[] = [
  {
    prompt: 'How does your child usually pick up small objects (a coin or bead)?',
    options: ['Easily, with either hand', 'With effort or only one hand', 'With difficulty, needs positioning help', 'Cannot pick up small objects'],
  },
  {
    prompt: 'How does your child handle larger objects (a cup or toy)?',
    options: ['Independently with both hands', 'Manages most, some are hard', 'Needs help with many objects', 'Needs help with most objects'],
  },
  {
    prompt: 'During two-handed play, how much does your child use their weaker hand?',
    options: ['Uses it well as a helper', 'Uses it a little to stabilise', 'Rarely uses it', 'Does not use it'],
  },
  {
    prompt: 'How much assistance does your child need for daily hand tasks (eating, dressing)?',
    options: ['None', 'A little', 'Moderate', 'A lot'],
  },
]

const MACS_BY_TOTAL: MacsLevel[] = ['I', 'I', 'II', 'II', 'II', 'III', 'III', 'III', 'IV', 'IV', 'IV', 'V', 'V']
const BFMF_BY_TOTAL: BfmfLevel[] = ['1', '1', '2', '2', '2', '3', '3', '3', '4', '4', '4', '5', '5']

export function estimateAbility(answers: number[]): { macs: MacsLevel; bfmf: BfmfLevel } {
  if (answers.length !== QUESTIONS.length) {
    throw new Error(`estimateAbility expects ${QUESTIONS.length} answers, got ${answers.length}`)
  }
  const total = answers.reduce((sum, a) => sum + a, 0) // 0..12
  return { macs: MACS_BY_TOTAL[total], bfmf: BFMF_BY_TOTAL[total] }
}
```

- [ ] **Step 4: Re-export it from the package barrel**

Append to the end of `packages/types/src/index.ts`:

```ts

// The MACS/BFMF estimator behind both mobile's ability-screen.tsx quiz and the
// web child-profile-form.tsx quiz. Runtime values, not just types — this
// package is consumed as raw TypeScript, so that is safe.
export * from './estimate-ability'
```

- [ ] **Step 5: Run the test again to confirm it passes**

```bash
pnpm --filter @splat-connect/mobile test:unit
```

Expected: `estimate-ability.test.ts` PASSes — 3 tests.

If it fails on module resolution rather than assertions, the cause is jest not transforming the workspace package. pnpm symlinks `node_modules/@splat-connect/types` to `packages/types`, and jest resolves that to a real path with no `node_modules` segment, so `transformIgnorePatterns` should not match it. If it does, add `@splat-connect/types` to the alternation in `packages/mobile/package.json`'s `jest.transformIgnorePatterns` and note it in the commit message.

- [ ] **Step 6: Repoint the mobile consumer and its test**

`packages/mobile/components/profile/ability-screen.tsx` — delete line 12 and fold the import into the existing `@splat-connect/types` import on line 10:

```ts
import { estimateAbility, QUESTIONS, type ChildProfile } from '@splat-connect/types'
```

`packages/mobile/tests/unit/components/profile/ability-screen.test.tsx` line 3:

```ts
import { QUESTIONS, estimateAbility } from '@splat-connect/types'
```

- [ ] **Step 7: Delete the old module**

```bash
rm packages/mobile/lib/estimate-ability.ts
```

- [ ] **Step 8: Verify the whole mobile suite and typecheck**

```bash
pnpm --filter @splat-connect/mobile test:unit && pnpm typecheck
```

Expected: all mobile tests pass, typecheck clean across every package. A `Cannot find module '../../lib/estimate-ability'` here means a consumer was missed — grep for it.

- [ ] **Step 9: Commit**

```bash
git add packages/types/src/estimate-ability.ts packages/types/src/index.ts \
  packages/mobile/components/profile/ability-screen.tsx \
  packages/mobile/tests/unit/components/profile/ability-screen.test.tsx \
  packages/mobile/tests/unit/lib/estimate-ability.test.ts \
  packages/mobile/lib/estimate-ability.ts
git commit -m "refactor(types): move estimate-ability into @splat-connect/types

Pure logic with no React Native dependency, and the web child profile form
is about to run the same estimator. One copy so a revision to the
placeholder MACS/BFMF mapping reaches both platforms.

The unit test stays in the mobile jest suite: packages/types has no test
runner, and adding one for a single pure function is more machinery than
the coverage is worth."
```

---

### Task 2: Typed-confirmation delete dialog

**Files:**
- Modify: `packages/web/components/delete-child-button.tsx` (rewrite)
- Modify: `packages/web/app/dashboard/child/[id]/page.tsx:29-32`
- Modify: `packages/web/app/globals.css:649-663`
- Modify: `packages/web/components/contributor-terms-dialog.tsx:38`
- Modify: `packages/web/tests/unit/setup.ts` (comment only)
- Test: `packages/web/tests/unit/components/delete-child-button.test.tsx` (rewrite)

**Interfaces:**
- Consumes: `childLabel(child, index)` from `@/lib/child-label` (already called on the page), `browserApiClient.delete` from `@/lib/browser-api-client`.
- Produces: `DeleteChildButton({ id, label }: { id: string; label: string })`. The `label` prop is required — the caller already has it.

- [ ] **Step 1: Write the failing tests**

Replace the whole of `packages/web/tests/unit/components/delete-child-button.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeleteChildButton } from '@/components/delete-child-button'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { delete: vi.fn() },
}))

import { browserApiClient } from '@/lib/browser-api-client'

// The dialog element stays in the DOM when closed, so "is it open" is read off
// the `open` attribute rather than off query failures — jsdom applies no UA
// stylesheet, so a closed dialog's contents are still queryable.
function openDialog(label = 'Child 1') {
  render(<DeleteChildButton id="c1" label={label} />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete child profile' }))
  return screen.getByRole('dialog')
}

describe('DeleteChildButton', () => {
  beforeEach(() => vi.clearAllMocks())

  // Chain: a child profile is a page of hand-entered data with no undo, so
  //        opening the dialog must never be the same gesture as deleting.
  it('opens the dialog without deleting', () => {
    const dialog = openDialog()
    expect(dialog).toHaveAttribute('open')
    expect(browserApiClient.delete).not.toHaveBeenCalled()
  })

  it('keeps Delete disabled until the exact phrase is typed', () => {
    openDialog()
    const confirm = screen.getByRole('button', { name: 'Delete' })
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: 'confirm_delete_child_1' } })
    expect(confirm).toBeDisabled() // case-sensitive

    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: 'confirm_delete_Child_1' } })
    expect(confirm).toBeEnabled()
  })

  // Chain: an unnamed child is identified by position (child-label.ts), so the
  //        phrase has to be built from whatever label the page is showing.
  it('builds the phrase from a name with spaces', () => {
    openDialog('Mary Jane')
    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: 'confirm_delete_Mary_Jane' } })
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
  })

  it('deletes and returns to the list once confirmed', async () => {
    vi.mocked(browserApiClient.delete).mockResolvedValue(null)
    openDialog()
    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: 'confirm_delete_Child_1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(browserApiClient.delete).toHaveBeenCalledWith('/api/child-profiles/c1'))
    expect(push).toHaveBeenCalledWith('/dashboard/child')
    expect(refresh).toHaveBeenCalled()
  })

  it('Cancel closes without deleting and clears the typed phrase', () => {
    const dialog = openDialog()
    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: 'confirm_delete_Child_1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(dialog).not.toHaveAttribute('open')
    expect(browserApiClient.delete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete child profile' }))
    expect(screen.getByLabelText(/to confirm/i)).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  // jsdom does not turn Escape into a `cancel` event, so dispatch it directly —
  // same approach as contributor-terms-dialog.test.tsx.
  it('Escape closes without deleting', () => {
    const dialog = openDialog()
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(dialog).not.toHaveAttribute('open')
    expect(browserApiClient.delete).not.toHaveBeenCalled()
  })

  it('a backdrop click closes without deleting', () => {
    const dialog = openDialog()
    fireEvent.click(dialog)
    expect(dialog).not.toHaveAttribute('open')
    expect(browserApiClient.delete).not.toHaveBeenCalled()
  })

  it('a click inside the dialog body does not close it', () => {
    const dialog = openDialog()
    fireEvent.click(screen.getByLabelText(/to confirm/i))
    expect(dialog).toHaveAttribute('open')
  })

  // Chain: a transient network failure must not make the user retype the
  //        phrase, and must never look like the delete succeeded.
  it('reports a failed delete, stays open, and does not navigate', async () => {
    vi.mocked(browserApiClient.delete).mockRejectedValue(new Error('network'))
    const dialog = openDialog()
    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: 'confirm_delete_Child_1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete')
    expect(push).not.toHaveBeenCalled()
    expect(dialog).toHaveAttribute('open')
    expect(screen.getByLabelText(/to confirm/i)).toHaveValue('confirm_delete_Child_1')
  })
})
```

- [ ] **Step 2: Run and confirm failure**

```bash
pnpm --filter @splat-connect/web test:unit
```

Expected: `delete-child-button.test.tsx` fails — no `label` prop, no dialog, `getByRole('dialog')` finds nothing.

- [ ] **Step 3: Rewrite the component**

Replace the whole of `packages/web/components/delete-child-button.tsx`:

```tsx
'use client'
/**
 * Delete for a child profile, behind a typed confirmation.
 *
 * Deliberately unlike edit-items-section.tsx and admin/contributors, which both
 * delete on first click: a child profile is a page of hand-entered data with no
 * undo, and a parts row is not. The phrase echoes the label the page is already
 * showing, so the user has to read which child they are about to destroy — a
 * two-click arm/timeout (what this replaces) could not tell them that.
 *
 * Dialog mechanics are contributor-terms-dialog.tsx's: a native <dialog> driven
 * by showModal()/close() from an effect, so the focus trap, Escape, and the
 * inert background come from the platform. As there, the native `close` event
 * is deliberately not wired to the cancel path — the component closes itself
 * after a successful delete too.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { browserApiClient } from '@/lib/browser-api-client'

export function DeleteChildButton({ id, label }: { id: string; label: string }) {
  const router = useRouter()
  const ref = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const phrase = `confirm_delete_${label.replace(/ /g, '_')}`

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function cancel() {
    setOpen(false)
    setTyped('')
    setError(null)
  }

  async function confirmDelete() {
    setBusy(true)
    setError(null)
    try {
      await browserApiClient.delete(`/api/child-profiles/${id}`)
      router.push('/dashboard/child')
      router.refresh()
    } catch {
      // The dialog stays open with the phrase intact: a dropped request is not
      // a reason to make the user type it again.
      setError('Could not delete this child profile. Please try again.')
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-danger btn-sm self-start"
      >
        Delete child profile
      </button>

      <dialog
        ref={ref}
        className="dialog-panel"
        onCancel={() => cancel()}
        onClick={(e) => {
          // A click that never reaches the inner div (stopped below) landed on
          // the dialog element itself, which for a modal <dialog> includes its
          // ::backdrop.
          if (e.target === ref.current) cancel()
        }}
      >
        <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-ink">Delete {label}?</h2>
          <p className="text-sm text-muted">
            This permanently deletes this child profile and everything recorded on it. It
            cannot be undone.
          </p>

          <div>
            <label htmlFor="confirm-delete-child" className="field-label">
              Type <code>{phrase}</code> to confirm
            </label>
            <input
              id="confirm-delete-child"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="field"
            />
          </div>

          {error && (
            <p role="alert" className="alert alert-danger">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={cancel} className="btn btn-soft">
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={typed !== phrase || busy}
              className="btn btn-danger"
            >
              {busy ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
```

- [ ] **Step 4: Generalise the dialog CSS class**

In `packages/web/app/globals.css`, rename both selectors at lines 649 and 661 — `.terms-dialog` → `.dialog-panel`, `.terms-dialog::backdrop` → `.dialog-panel::backdrop` — and update the section comment above them to say "modal dialog panel" rather than naming the terms dialog. Then update the single other usage, `packages/web/components/contributor-terms-dialog.tsx:38`:

```tsx
      className="dialog-panel"
```

- [ ] **Step 5: Pass the label the page already computes**

In `packages/web/app/dashboard/child/[id]/page.tsx`, hoist the label and hand it to the button:

```tsx
  const child = children[index]
  const label = childLabel(child, index)

  return (
    <div>
      <Link href="/dashboard/child" className="mb-4 inline-block text-sm text-muted">
        ← Child profiles
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-ink">{label}</h1>
      <EditChildForm child={child} />
      <div className="mt-8">
        <DeleteChildButton id={child.id} label={label} />
      </div>
    </div>
  )
```

- [ ] **Step 6: Extend the polyfill comment**

In `packages/web/tests/unit/setup.ts`, the comment on line 5 lists which components need the `showModal`/`close` polyfill. Add the new one so the next reader knows why it must stay:

```ts
// jsdom (24.x) reflects the <dialog> `open` attribute but implements neither
// showModal() nor close() — needed by shell-frame.tsx's mobile drawer,
// contributor-terms-dialog.tsx, and delete-child-button.tsx. Polyfilled here
// (not per-test) since these components call them unconditionally in an
// effect on mount.
```

- [ ] **Step 7: Run the web suite and typecheck**

```bash
pnpm --filter @splat-connect/web test:unit && pnpm typecheck
```

Expected: all web tests pass — the 10 rewritten delete tests, plus `dashboard-child-edit.test.tsx` and `contributor-terms-dialog.test.tsx` unaffected. Typecheck clean.

If `dashboard-child-edit.test.tsx` fails on a missing `label`, it is rendering the real button — pass a label in its fixture rather than loosening the prop type.

- [ ] **Step 8: Commit**

```bash
git add packages/web/components/delete-child-button.tsx \
  packages/web/components/contributor-terms-dialog.tsx \
  packages/web/app/dashboard/child/[id]/page.tsx \
  packages/web/app/globals.css \
  packages/web/tests/unit/setup.ts \
  packages/web/tests/unit/components/delete-child-button.test.tsx
git commit -m "feat(web): require a typed phrase to delete a child profile

Replaces the two-click arm/3s-timeout, which could not say which child was
about to go. Reuses contributor-terms-dialog.tsx's native <dialog> pattern;
.terms-dialog is renamed .dialog-panel now that two dialogs share it."
```

---

### Task 3: MACS/BFMF quiz on the web child profile form

**Files:**
- Modify: `packages/web/components/child-profile-form.tsx`
- Test: `packages/web/tests/unit/components/child-profile-form.test.tsx` (append)

**Interfaces:**
- Consumes: `QUESTIONS`, `estimateAbility` from `@splat-connect/types` (Task 1).
- Produces: no new exports. `ChildProfileForm`'s props are unchanged; `onSave` receives `macs_source` / `bfmf_source` of `'estimated'` after a completed quiz, `'manual'` after a dropdown edit.

- [ ] **Step 1: Write the failing tests**

Append to `packages/web/tests/unit/components/child-profile-form.test.tsx`:

```tsx
describe('ChildProfileForm — ability quiz', () => {
  const TOGGLE = "Don't know MACS level? Fill out this quick survey."
  // One option per question, all index 0 → total 0 → MACS I / BFMF 1.
  const ALL_ZERO = [
    'Easily, with either hand',
    'Independently with both hands',
    'Uses it well as a helper',
    'None',
  ]

  it('keeps the quiz collapsed until the toggle is clicked', () => {
    render(<ChildProfileForm profile={null} onSave={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Estimate' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: TOGGLE }))
    expect(screen.getByRole('button', { name: 'Estimate' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: TOGGLE }))
    expect(screen.queryByRole('button', { name: 'Estimate' })).not.toBeInTheDocument()
  })

  it('keeps Estimate disabled until every question is answered', () => {
    render(<ChildProfileForm profile={null} onSave={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: TOGGLE }))

    for (const option of ALL_ZERO.slice(0, 3)) {
      expect(screen.getByRole('button', { name: 'Estimate' })).toBeDisabled()
      fireEvent.click(screen.getByRole('button', { name: option }))
    }
    expect(screen.getByRole('button', { name: 'Estimate' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: ALL_ZERO[3] }))
    expect(screen.getByRole('button', { name: 'Estimate' })).toBeEnabled()
  })

  // Chain: the whole point of the quiz is that a parent who does not know the
  //        clinical terms still ends up with both scores recorded — and the
  //        record has to say they were estimated, not measured.
  it('fills both scores from the quiz and marks them estimated', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildProfileForm profile={null} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: TOGGLE }))

    for (const option of ALL_ZERO) fireEvent.click(screen.getByRole('button', { name: option }))
    fireEvent.click(screen.getByRole('button', { name: 'Estimate' }))

    expect(screen.getByLabelText('MACS level')).toHaveValue('I')
    expect(screen.getByLabelText('BFMF score')).toHaveValue('1')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        macs_level: 'I',
        bfmf_score: '1',
        macs_source: 'estimated',
        bfmf_source: 'estimated',
      })
    )
  })

  // Chain: an estimate the parent then overrides by hand is no longer an
  //        estimate, and storing it as one misreports how the value was got.
  it('reverts a source to manual when that dropdown is edited afterwards', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildProfileForm profile={null} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: TOGGLE }))

    for (const option of ALL_ZERO) fireEvent.click(screen.getByRole('button', { name: option }))
    fireEvent.click(screen.getByRole('button', { name: 'Estimate' }))
    fireEvent.change(screen.getByLabelText('MACS level'), { target: { value: 'IV' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        macs_level: 'IV',
        macs_source: 'manual',
        // Untouched, so still the estimate.
        bfmf_score: '1',
        bfmf_source: 'estimated',
      })
    )
  })

  it('marks a chosen option as pressed', () => {
    render(<ChildProfileForm profile={null} onSave={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: TOGGLE }))

    const option = screen.getByRole('button', { name: ALL_ZERO[0] })
    expect(option).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(option)
    expect(option).toHaveAttribute('aria-pressed', 'true')
  })
})
```

- [ ] **Step 2: Run and confirm failure**

```bash
pnpm --filter @splat-connect/web test:unit
```

Expected: the five new tests fail — no toggle button with that name.

- [ ] **Step 3: Import the shared estimator and add quiz state**

In `packages/web/components/child-profile-form.tsx`, change the import on line 29 and add state after line 71 (`const [saved, setSaved] = useState(false)`):

```tsx
import type { ChildProfile } from '@splat-connect/types'
import { QUESTIONS, estimateAbility } from '@splat-connect/types'
```

```tsx
  // Quiz answers stay local, same as mobile's ability-screen.tsx: only the
  // derived MACS/BFMF pair is worth persisting, and re-deriving it from stored
  // answers would mean versioning the question set.
  const [showQuiz, setShowQuiz] = useState(false)
  const [answers, setAnswers] = useState<(number | null)[]>(() => QUESTIONS.map(() => null))
```

- [ ] **Step 4: Add the estimate handler**

Add after the `setNumber` function (around line 93):

```tsx
  // Both scores and both sources land in one update — a half-applied estimate
  // (level set, source still 'manual') would misreport where the value came from.
  function runEstimate() {
    if (answers.some((a) => a == null)) return
    const { macs, bfmf } = estimateAbility(answers as number[])
    setForm((prev) => ({
      ...prev,
      macs_level: macs,
      bfmf_score: bfmf,
      macs_source: 'estimated',
      bfmf_source: 'estimated',
    }))
  }
```

- [ ] **Step 5: Reset `_source` to manual when a dropdown is edited**

This is the spec correction from the top of this plan — the existing `onChange` handlers set only the value. Replace the two handlers (lines 160 and 175):

```tsx
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, macs_level: e.target.value || null, macs_source: 'manual' }))
                }
```

```tsx
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, bfmf_score: e.target.value || null, bfmf_source: 'manual' }))
                }
```

- [ ] **Step 6: Render the quiz**

Insert directly after the closing `</div>` of the MACS/BFMF two-column grid (after line 184) and before the hand-involvement grid:

```tsx
          {/* Mobile's ability-screen.tsx estimator, over the same QUESTIONS from
              @splat-connect/types. Chips rather than a select per question: four
              short options each, and .chip + aria-pressed is already how the
              upload form does single-choice rows. */}
          <div>
            <button
              type="button"
              onClick={() => setShowQuiz((s) => !s)}
              aria-expanded={showQuiz}
              className="text-left text-sm font-bold text-ink underline"
            >
              Don&apos;t know MACS level? Fill out this quick survey.
            </button>

            {showQuiz && (
              <div className="mt-3 flex flex-col gap-4">
                {QUESTIONS.map((q, qi) => (
                  <fieldset key={qi}>
                    <legend className="field-label">{q.prompt}</legend>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((opt, oi) => (
                        <button
                          key={oi}
                          type="button"
                          aria-pressed={answers[qi] === oi}
                          onClick={() =>
                            setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))
                          }
                          className="chip"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <button
                  type="button"
                  onClick={runEstimate}
                  disabled={answers.some((a) => a == null)}
                  className="btn btn-soft self-start"
                >
                  Estimate
                </button>
              </div>
            )}
          </div>
```

- [ ] **Step 7: Update the component docstring**

Lines 16-18 of `child-profile-form.tsx` say the estimator is deliberately not ported. That is no longer true. Replace those three lines within the "Deliberately does NOT port" block, leaving the autosave bullet above them intact:

```
 * Mobile's estimator IS ported — estimateAbility/QUESTIONS moved into
 * @splat-connect/types so both platforms run one copy (pure logic, no React
 * Native import). The UI around it is still re-implemented, per the note above.
```

- [ ] **Step 8: Run the web suite and typecheck**

```bash
pnpm --filter @splat-connect/web test:unit && pnpm typecheck
```

Expected: every web test passes, including the pre-existing `saves the ability fields` test — it changes `MACS level` to `III` and asserts `macs_level: 'III'`, which the new handler still satisfies. Typecheck clean.

- [ ] **Step 9: Full verification across every package**

```bash
pnpm typecheck \
  && pnpm --filter @splat-connect/web test:unit \
  && pnpm --filter @splat-connect/mobile test:unit \
  && pnpm --filter @splat-connect/api test:unit
```

All four must be green before the commit. (Unit suites only — the E2E suites need Supabase up and are out of scope for this change.)

- [ ] **Step 10: Commit**

```bash
git add packages/web/components/child-profile-form.tsx \
  packages/web/tests/unit/components/child-profile-form.test.tsx
git commit -m "feat(web): add the MACS/BFMF estimator quiz to the child profile form

Runs the shared estimateAbility() from @splat-connect/types, so a parent who
does not know the clinical terms can still fill both scores. Also fixes the
dropdowns, which set macs_level/bfmf_score without resetting the matching
_source to 'manual' — an overridden estimate was being stored as an estimate."
```

- [ ] **Step 11: Refresh the knowledge graph**

```bash
graphify update .
```

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
|---|---|
| Dialog reuses ContributorTermsDialog's native `<dialog>` pattern | 2, step 3 |
| `label: string` prop, passed from the page's existing `childLabel()` | 2, steps 3 & 5 |
| Dialog replaces the 2-click arm/timeout entirely | 2, step 3 (`useEffect` timer gone) |
| Delete disabled until `confirm_delete_<label with _>` matches case-sensitively | 2, steps 1 & 3 |
| Same `browserApiClient.delete` → redirect → refresh flow | 2, step 3 |
| Cancel / Escape / backdrop close without deleting; close and confirm never both fire | 2, steps 1 & 3 |
| `packages/types/src/estimate-ability.ts` with all five exports + the `ponytail:` comment, verbatim | 1, step 3 |
| Re-exported from `packages/types/src/index.ts` | 1, step 4 |
| `ability-screen.tsx` and its test import from `@splat-connect/types` | 1, step 6 |
| `packages/mobile/lib/estimate-ability.ts` deleted | 1, step 7 |
| Estimator test kept | 1, step 1 — **deviation**: stays in the mobile suite, see the deviations section |
| Toggle with the exact copy, inside the Ability profile card, below the selects | 3, step 6 |
| 4 questions as `.chip` + `aria-pressed` rows | 3, step 6 |
| Estimate disabled until 4/4, sets both fields with `source: 'estimated'` | 3, steps 4 & 6 |
| Dropdown edit reverts `_source` to `'manual'` | 3, step 5 — **spec said this already existed; it did not** |
| Answers in local `useState<(number \| null)[]>` | 3, step 3 |
| All four listed test scenarios for `ChildProfileForm` | 3, step 1 |

**Placeholders:** none — every code step carries the literal content to write.

**Type consistency:** `estimateAbility(answers: number[]) => { macs: MacsLevel; bfmf: BfmfLevel }` is declared once in Task 1 and consumed with those exact names in Task 3. `DeleteChildButton({ id, label })` is declared in Task 2 and called with both props in the same task. `phrase` / `typed` / `answers` / `showQuiz` are local and used consistently within their files.
