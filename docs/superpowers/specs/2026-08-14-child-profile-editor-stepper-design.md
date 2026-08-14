# Child profile editor: pill-row stepper matching toy/tutorial

## Problem

`components/child-profile-form.tsx` is one 475-line form with three cards
side by side and a single shared Save button, used unchanged for both
create and edit (`new-child-form.tsx` / `edit-child-form.tsx` just supply
different `onSave` callbacks). Toy and tutorial editing instead use a
pill-row stepper (`ToyEditStepper` / `EditStepper`): one pill per section,
each an independently-saving panel with its own status dot.

## Why child profiles can't just copy the toy pattern verbatim

Toy/tutorial creation locks steps that genuinely can't function without an
id (photo upload needs a target to upload against). Every child-profile
field is a plain column with no such dependency, and the fields split
naturally into four groups that don't need to be filled in any particular
order. So instead of "one minimal create step, then unlock the rest,"
every pill is enabled from the very first visit, on both create and edit,
and whichever pill is saved first creates the profile.

## Steps and their fields

1. **Survey** — the MACS/BFMF quiz (`QUESTIONS`/`estimateAbility` from
   `@splat-connect/types`). Was a `<dialog>` launched from inside the
   Ability card; becomes its own panel now that it has its own pill, so the
   modal machinery goes away. One button, "Estimate & save," computes and
   saves in the same action — same one-primary-action shape as every other
   panel.
2. **Ability** — name, age, primary diagnosis, MACS level, BFMF score
   (manual selects, unchanged), hand involvement, assist hand.
3. **Everyday needs** — challenges, other challenges, grip type, where it's
   used.
4. **Customization** — palm width / wrist circumference / forearm length,
   hand dominance, needs-arm-attachment, sensory preferences.

Order: Survey, Ability, Everyday needs, Customization. Delete is `trailing`
on the stepper, not a pill — same slot `ToyEditor` uses for
`DeleteEntityButton`.

## Architecture

**`lib/child-steps.ts`** — `ChildStepId`, `ChildStepStatus = 'done' |
'attention' | 'neutral'`, `ChildStep` (no `disabled` field — nothing is
ever locked), and `computeChildStepStatuses(child: ChildProfile | null)`:

- `child === null` (nothing saved yet): every step is `'neutral'`. Nothing
  to flag on a blank slate.
- `child !== null`: each step is `'done'` if its own fields have any data,
  else `'attention'` (hazard mark, reusing the existing `!` glyph). Survey's
  check is specifically `macs_source === 'estimated' && bfmf_source ===
  'estimated'` — a manually-entered MACS/BFMF from the Ability pill doesn't
  count as the survey being done; it stays a hazard nudging "you haven't
  tried this."

**`components/child-edit-stepper.tsx`** — same shape as
`toy-edit-stepper.tsx` (pill row, `?step=` URL state), minus the
`disabled` handling `ToyEditStepper` needs and this one doesn't. A new file
rather than a shared generic, matching the existing precedent that
`toy-edit-stepper.tsx` and `edit-stepper.tsx` are already two separate
near-identical components.

**Four step-form components** — `child-survey-form.tsx`,
`child-ability-form.tsx`, `child-everyday-needs-form.tsx`,
`child-customization-form.tsx` — one per current card, each owning its own
local state seeded from a nullable `profile` prop, its own busy/error/saved
state, and calling a single shared `onSave`.

**`components/child-editor.tsx`** — the only client component that talks to
the API. Holds `child: ChildProfile | null` state and one upsert helper
reused by all four panels:

```
async function saveStep(fields: Partial<ChildProfile>) {
  if (!child) {
    const created = await browserApiClient.post<ChildProfile>('/api/child-profiles', fields)
    setChild(created)
    router.replace(`/dashboard/child/${created.id}` as Route<string>)
  } else {
    const updated = await browserApiClient.patch<ChildProfile>(`/api/child-profiles/${child.id}`, fields)
    setChild(updated)
  }
}
```

Whichever pill is saved first creates the profile with just its own
fields; the URL silently swaps from `/dashboard/child/new` to
`/dashboard/child/{id}` so a refresh or bookmark doesn't create a second
profile. Errors are left to propagate — each step form's own `try`/`catch`
around `onSave` (same pattern as `ToyDetailsForm`) shows the failure.

`ChildEditor` also owns the heading, since it now depends on client state
that can change without a page reload: `child?.name?.trim() || label ||
'Add child'`. `label` is an optional prop — `/dashboard/child/[id]/page.tsx`
still fetches the full sibling list and passes `childLabel(child, index)`
through unchanged, so an existing unnamed child keeps its numbered
"Child N" fallback exactly as today. `/dashboard/child/new/page.tsx` passes
no `label`, so a fresh profile just reads "Add child" until it's named.
`DeleteEntityButton` (the stepper's `trailing`) only renders once `child`
is non-null — nothing to delete before the first save.

## Pages

- `app/dashboard/child/new/page.tsx`: back link, the existing "Everything
  is optional…" paragraph, `<ChildEditor child={null} />`.
- `app/dashboard/child/[id]/page.tsx`: unchanged fetch-list-for-index logic,
  back link, `<ChildEditor child={child} label={childLabel(child, index)} />`.

## Removed

`child-profile-form.tsx`, `new-child-form.tsx`, `edit-child-form.tsx` —
superseded by the four step forms plus `ChildEditor`.

## Testing

New: `lib/child-steps.test.ts` (status computation, including the null-child
and survey-specific cases), `child-edit-stepper.test.tsx`, one test file per
step form (field edits, save payload, busy/error/saved — mirroring
`toy-details-form.test.tsx`), `child-editor.test.tsx` (create-from-any-pill
sets the id and replaces the URL, subsequent saves PATCH, trailing delete
is conditional on `child`, heading fallback logic).

Removed/rewritten: `child-profile-form.test.tsx`, `child-form-wrappers.test.tsx`.
Updated: `dashboard-child-edit.test.tsx` for the new page composition.

## Out of scope

- Any change to `/api/child-profiles` — the existing POST/PATCH endpoints
  already accept partial bodies; no server-side change is implied.
- Reordering or renumbering the "Child N" fallback used on the list page.
- A shared generic stepper component to de-duplicate `ToyEditStepper` /
  `EditStepper` / `ChildEditStepper` — out of scope for this change.
