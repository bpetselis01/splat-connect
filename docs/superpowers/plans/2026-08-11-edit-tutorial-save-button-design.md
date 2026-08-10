# Edit Tutorial: Save Button Behavior & Toast Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Details/Files save-button layout jump, add real dirty-tracking to the Details save button, and make the shared save-confirmation toast visible.

**Architecture:** Three independent, small changes to existing client components and one CSS token addition. No new components, no new state management library, no API changes.

**Tech Stack:** Next.js client components (React `useState`), Vitest + React Testing Library for unit tests, plain CSS custom properties in `globals.css`.

## Global Constraints

- Scope is limited to `edit-details-section.tsx`, `edit-files-section.tsx`, and `globals.css`. Do not touch Parts, Tools, Backing, Collaborators, or `toast.tsx`.
- The sticky bottom bar's (`edit-stepper.tsx`) existing "last saved" behavior for non-draft tutorials is unchanged — do not modify `edit-stepper.tsx`.
- Draft-status tutorials keep relying on the toast alone for save confirmation — no persistent "last saved" text is added for that state.
- `SaveStatusLine` (`components/save-status-line.tsx`) itself is not modified or deleted — it's still used by `edit-stepper.tsx` and `edit-items-section.tsx`.

---

## File Structure

- `packages/web/app/globals.css` — add `--color-success` token to `:root`; repoint `.edit-toast`'s `background-color` at it.
- `packages/web/components/edit-files-section.tsx` — drop the local `SaveStatusLine`/`savedAt` display; button row goes from `justify-between` to `justify-end`. No new dirty-tracking needed — `hasChanges` already gates the button.
- `packages/web/tests/unit/components/edit-files-section.test.tsx` — remove the now-obsolete "shows a 'Last saved' line" test.
- `packages/web/components/edit-details-section.tsx` — add `dirty` state via form-level `onChange` bubbling; drop the local `SaveStatusLine`/`savedAt` display; button `disabled` becomes `!dirty || pending`.
- `packages/web/tests/unit/components/edit-details-section.test.tsx` — remove the obsolete "Last saved" test, fix three existing tests that clicked Save without first dirtying the form (now a no-op on a disabled button), add three new tests for the dirty/disabled lifecycle.

---

### Task 1: Toast success color

**Files:**
- Modify: `packages/web/app/globals.css:48` (add token to `:root`), `packages/web/app/globals.css:493` (`.edit-toast` background)

**Interfaces:**
- Produces: `--color-success` CSS custom property, consumed only by `.edit-toast`.

- [ ] **Step 1: Add the `--color-success` token**

In `packages/web/app/globals.css`, find this line inside the `:root` block:

```css
  --color-danger: #a3301a;
```

Add a new line directly after it:

```css
  --color-danger: #a3301a;
  --color-success: #0f5c4d;
```

`#0f5c4d` is the same deep-green value already used by `--color-mint-deep` elsewhere in this file — it's a proven readable-on-white/readable-with-white-text tone already in the palette, just given its own semantic name so the toast's color isn't coupled to the "Files" reference-card color if that one changes later.

- [ ] **Step 2: Point `.edit-toast` at the new token**

Find this line in the `.edit-toast` rule:

```css
    background-color: var(--color-brand-deep);
```

Replace it with:

```css
    background-color: var(--color-success);
```

- [ ] **Step 3: Manual visual check**

Run: `cd packages/web && npm run dev`

Navigate to `/tutorials/<any-tutorial-id>/edit`, click into the Details section, change the title, click "Save details". Confirm the toast at the bottom of the screen now renders in a dark green rather than dark blue, and text stays legible (white text on the new background).

- [ ] **Step 4: Commit**

```bash
git add packages/web/app/globals.css
git commit -m "style(web): add success color token and use it for the edit-tutorial toast"
```

---

### Task 2: Files section layout fix

**Files:**
- Modify: `packages/web/components/edit-files-section.tsx`
- Test: `packages/web/tests/unit/components/edit-files-section.test.tsx`

**Interfaces:**
- Consumes: nothing new — `hasChanges` (`photoFile !== null || pdfFile !== null`) already exists at `edit-files-section.tsx:30` and already gates the Save button's `disabled` prop.
- Produces: no new exports; `EditFilesSection` props unchanged.

- [ ] **Step 1: Remove the obsolete "Last saved" test**

In `packages/web/tests/unit/components/edit-files-section.test.tsx`, delete this test (it asserts behavior the design explicitly removes):

```tsx
  it('shows a "Last saved" line after a successful save', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-photo.png' })
    const { photoInput } = setup()
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save files' }))
    await waitFor(() => expect(screen.getByText(/last saved just now/i)).toBeInTheDocument())
  })

```

Delete the whole block, including the blank line after it, so the file reads directly from `it('Save button is disabled again after a successful save', ...)` into `it('fires the shared toast with "Files saved"...)`.

- [ ] **Step 2: Run the suite to confirm the deleted test is gone and nothing else broke**

Run: `cd packages/web && npx vitest run tests/unit/components/edit-files-section.test.tsx`
Expected: PASS, one fewer test than before (10 tests, was 11).

- [ ] **Step 3: Remove the local save-status display from the component**

In `packages/web/components/edit-files-section.tsx`, remove the import:

```tsx
import { SaveStatusLine } from '@/components/save-status-line'
```

Remove the `savedAt` state:

```tsx
  const [savedAt, setSavedAt] = useState<string | null>(null)
```

In `handleSave`, remove the line that sets it:

```tsx
      setSavedAt(new Date().toISOString())
```

(The line directly below it, `showToast('Files saved')`, stays.)

- [ ] **Step 4: Fix the button row layout**

Replace:

```tsx
      <div className="flex items-center justify-between gap-3">
        <SaveStatusLine savedAt={savedAt} />
        <button
          type="button"
          disabled={!hasChanges || saving}
          onClick={handleSave}
          className={btnCls}
        >
          Save files
        </button>
      </div>
```

With:

```tsx
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!hasChanges || saving}
          onClick={handleSave}
          className={btnCls}
        >
          Save files
        </button>
      </div>
```

- [ ] **Step 5: Run the full test file again**

Run: `cd packages/web && npx vitest run tests/unit/components/edit-files-section.test.tsx`
Expected: PASS, all 10 tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/web/components/edit-files-section.tsx packages/web/tests/unit/components/edit-files-section.test.tsx
git commit -m "fix(web): remove redundant save-status line from edit-files section"
```

---

### Task 3: Details section dirty-tracking + layout fix

**Files:**
- Modify: `packages/web/components/edit-details-section.tsx`
- Test: `packages/web/tests/unit/components/edit-details-section.test.tsx`

**Interfaces:**
- Consumes: nothing new. `EditDetailsSection` props (`tutorial: Tutorial`, `onSave: (patch) => Promise<void>`) are unchanged.
- Produces: no new exports; internal `dirty` boolean state, not exposed to callers.

- [ ] **Step 1: Fix the three existing tests that click Save without dirtying the form first**

These tests currently click "Save details" immediately after render. Once the button starts disabled, that click becomes a no-op (browsers/jsdom do not fire click handlers on disabled buttons), so each needs a `fireEvent.change` first to make the button clickable.

In `packages/web/tests/unit/components/edit-details-section.test.tsx`, replace:

```tsx
  it('shows the conflict message when onSave signals a conflict', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('conflict'))
    render(<EditDetailsSection tutorial={tutorial} onSave={onSave} />)
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() =>
      expect(screen.getByText(/updated while you were editing/i)).toBeInTheDocument()
    )
  })
```

With:

```tsx
  it('shows the conflict message when onSave signals a conflict', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('conflict'))
    render(<EditDetailsSection tutorial={tutorial} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Title' } })
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() =>
      expect(screen.getByText(/updated while you were editing/i)).toBeInTheDocument()
    )
  })
```

Replace the "shows a 'Last saved' line" test entirely (it tests behavior the design removes):

```tsx
  it('shows a "Last saved" line after a successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditDetailsSection tutorial={tutorial} onSave={onSave} />)
    expect(screen.queryByText(/last saved/i)).toBeNull()
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() => expect(screen.getByText(/last saved just now/i)).toBeInTheDocument())
  })

```

Delete this block entirely (including the trailing blank line), replacing it with nothing — the three new tests added in Step 2 below cover the button's dirty/disabled lifecycle instead.

Replace:

```tsx
  it('fires the shared toast with "Details saved" after a successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <ToastProvider>
        <EditDetailsSection tutorial={tutorial} onSave={onSave} />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Details saved'))
  })

  it('does not show a toast or save-status line when the save fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('conflict'))
    render(
      <ToastProvider>
        <EditDetailsSection tutorial={tutorial} onSave={onSave} />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() =>
      expect(screen.getByText(/updated while you were editing/i)).toBeInTheDocument()
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText(/last saved/i)).not.toBeInTheDocument()
  })
```

With:

```tsx
  it('fires the shared toast with "Details saved" after a successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <ToastProvider>
        <EditDetailsSection tutorial={tutorial} onSave={onSave} />
      </ToastProvider>
    )
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Title' } })
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Details saved'))
  })

  it('does not show a toast when the save fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('conflict'))
    render(
      <ToastProvider>
        <EditDetailsSection tutorial={tutorial} onSave={onSave} />
      </ToastProvider>
    )
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Title' } })
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() =>
      expect(screen.getByText(/updated while you were editing/i)).toBeInTheDocument()
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Add the three new dirty/disabled lifecycle tests**

Add these three tests to `packages/web/tests/unit/components/edit-details-section.test.tsx`, inside the existing `describe('EditDetailsSection', ...)` block (anywhere after the other tests is fine):

```tsx
  it('Save button starts disabled', () => {
    render(<EditDetailsSection tutorial={tutorial} onSave={vi.fn()} />)
    expect(screen.getByText('Save details')).toBeDisabled()
  })

  it('Save button becomes enabled after a field change', () => {
    render(<EditDetailsSection tutorial={tutorial} onSave={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Title' } })
    expect(screen.getByText('Save details')).not.toBeDisabled()
  })

  it('Save button becomes disabled again after a successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditDetailsSection tutorial={tutorial} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Title' } })
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() => expect(screen.getByText('Save details')).toBeDisabled())
  })
```

- [ ] **Step 3: Run the test file to confirm it fails**

Run: `cd packages/web && npx vitest run tests/unit/components/edit-details-section.test.tsx`
Expected: FAIL — the "starts disabled" and "disabled again after save" tests fail because the button's `disabled` prop is still just `pending`, not `!dirty || pending`. The "becomes enabled after a field change" test fails for the same reason (button starts enabled today, so `not.toBeDisabled()` is trivially true before the fix — but the "starts disabled" test catches that this isn't real dirty-tracking).

- [ ] **Step 4: Implement dirty-tracking in the component**

In `packages/web/components/edit-details-section.tsx`, remove the import:

```tsx
import { SaveStatusLine } from '@/components/save-status-line'
```

Replace the `savedAt` state:

```tsx
  const [savedAt, setSavedAt] = useState<string | null>(null)
```

With:

```tsx
  const [dirty, setDirty] = useState(false)
```

In `handleSubmit`, replace:

```tsx
      setSavedAt(new Date().toISOString())
```

With:

```tsx
      setDirty(false)
```

Add an `onChange` handler to the `<form>` element — change events on inputs/selects/textareas bubble up to the form, so this one listener catches every field without converting them to controlled inputs. Replace:

```tsx
    <form action={handleSubmit} className="flex flex-col gap-3 px-5 pb-5">
```

With:

```tsx
    <form action={handleSubmit} onChange={() => setDirty(true)} className="flex flex-col gap-3 px-5 pb-5">
```

Replace the button row:

```tsx
      <div className="flex items-center justify-between gap-3">
        <SaveStatusLine savedAt={savedAt} />
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm self-end">
          {pending ? 'Saving…' : 'Save details'}
        </button>
      </div>
```

With:

```tsx
      <div className="flex justify-end">
        <button type="submit" disabled={!dirty || pending} className="btn btn-primary btn-sm self-end">
          {pending ? 'Saving…' : 'Save details'}
        </button>
      </div>
```

- [ ] **Step 5: Run the test file to confirm it passes**

Run: `cd packages/web && npx vitest run tests/unit/components/edit-details-section.test.tsx`
Expected: PASS, all 7 tests green (5 original minus the deleted "Last saved" test, plus 3 new = 7).

- [ ] **Step 6: Manual visual check**

Run: `cd packages/web && npm run dev` (skip if already running from Task 1)

Navigate to `/tutorials/<any-tutorial-id>/edit`, open the Details section. Confirm the "Save details" button renders disabled with no gap or shift where a "last saved" line used to sit. Change the title — confirm the button becomes clickable immediately, with no layout shift. Click it — confirm the button returns to disabled and no local "last saved" text appears (the sticky bottom bar's own "last saved" line, if the tutorial isn't a draft, is unaffected).

- [ ] **Step 7: Run the full unit suite to confirm no regressions elsewhere**

Run: `cd packages/web && npm run test:unit`
Expected: PASS, all suites green (per project convention, always run the full suite, not just the touched files).

- [ ] **Step 8: Commit**

```bash
git add packages/web/components/edit-details-section.tsx packages/web/tests/unit/components/edit-details-section.test.tsx
git commit -m "feat(web): add dirty-tracking to the edit-details save button"
```

---

## Self-Review

**Spec coverage:**
- Details dirty-tracking (form `onChange` bubbling, `!dirty || pending`, reset on success) → Task 3.
- Details: remove `SaveStatusLine`/`savedAt`, row becomes single-child `justify-end` → Task 3.
- Files: remove `SaveStatusLine`/`savedAt` only, row becomes `justify-end`, `hasChanges` untouched → Task 2.
- Toast: `--color-success` token, `.edit-toast` repointed → Task 1.
- Testing: Details button disabled/enabled/disabled-again lifecycle test → Task 3, Step 2. Manual visual check for no layout shift + toast color → Task 1 Step 3, Task 3 Step 6.
- Out-of-scope items (Parts/Tools/Backing/Collaborators, `edit-stepper.tsx`, `toast.tsx`) are not touched by any task.

**Placeholder scan:** No TBD/TODO markers; every step has concrete before/after code.

**Type consistency:** `dirty: boolean` state introduced once in Task 3 and used only there. No new exported types or function signatures — `EditDetailsSection`/`EditFilesSection` props are unchanged from their current signatures throughout.
