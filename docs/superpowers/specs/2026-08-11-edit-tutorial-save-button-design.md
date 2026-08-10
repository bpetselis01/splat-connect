# Edit Tutorial: Save Button Behavior & Toast Visibility

## Problem

On the tutorial edit page, the Details and Files sections each render a local
"last saved" line next to their Save button, inside a `justify-between` flex
row. `SaveStatusLine` renders `null` until a save happens, so on first save
the row visually "jumps" — the button shifts to the opposite side as the
"last saved" text appears next to it. This is redundant: the page's sticky
bottom bar (`EditStepper`) already shows a persistent "last saved" line for
non-draft tutorials.

Separately, the Details section's Save button has no dirty-tracking at all —
it's enabled any time it isn't mid-request, regardless of whether the user
has changed anything.

Finally, the global save-confirmation toast (`.edit-toast`, shared by every
edit-tutorial pane) uses `--color-brand-deep`, the same color as the primary
button's hover state, making it easy to miss against the rest of the page.

## Scope

- `edit-details-section.tsx` — add dirty-tracking, remove local save-status line.
- `edit-files-section.tsx` — remove local save-status line only (dirty-tracking already exists as `hasChanges`).
- `globals.css` / toast styling — add a dedicated success color.

Parts, Tools, Backing, and Collaborators are out of scope: they save each
action immediately (add/edit/delete), so there's no "batched changes, then
Save" button to gate on dirty state.

## Design

### 1. Details section button behavior

Add a `dirty` boolean state, defaulting to `false`. Attach `onChange` to the
`<form>` element itself rather than each individual field — change events on
inputs/selects/textareas bubble up to the form, so one listener catches every
field without converting them to controlled inputs. `onChange` sets
`dirty(true)`. On a successful save, reset `dirty(false)`.

The Save button's `disabled` prop becomes `!dirty || pending` (was just
`pending`).

Remove `SaveStatusLine` and its `savedAt` state from this component — nothing
else reads `savedAt` locally, so it's dead weight once the display is gone.
The row's `flex items-center justify-between` becomes a single-child row
(`justify-end`), since there's no longer a sibling to space against.

### 2. Files section layout fix

`hasChanges` (`photoFile !== null || pdfFile !== null`) already gates the
Save button correctly — no new state needed. Apply the same layout fix as
Details: delete `SaveStatusLine` and its `savedAt` state, change the button
row from `justify-between` to `justify-end`.

### 3. Toast success color

Add a `--color-success` custom property to `globals.css`'s `:root` block,
alongside the existing `--color-brand-deep` / `--color-danger` tokens.
Change `.edit-toast`'s `background-color` from `var(--color-brand-deep)` to
`var(--color-success)`.

This is the only change needed for the toast — `toast.tsx` and every caller
of `useToast()` are unaffected, so the new color applies automatically to
every save confirmation across all edit-tutorial panes (Details, Files,
Parts, Tools, Backing, Collaborators), not just the two sections in scope
above.

## Out of scope / explicitly not changing

- The sticky bottom bar's existing "last saved" behavior for non-draft
  tutorials stays as-is.
- Draft-status tutorials continue to rely on the toast alone for save
  confirmation — no persistent "last saved" text is added for that state.
- No changes to Parts, Tools, Backing, or Collaborators sections.

## Testing

- Unit/component test for `edit-details-section.tsx`: button starts
  disabled, becomes enabled after a field change, becomes disabled again
  after a successful save.
- Visual check (manual, both sections): confirm no layout shift on save,
  confirm toast renders in the new success color.
