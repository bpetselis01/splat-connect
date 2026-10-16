# Contributor-defined customization fields — design

Date: 2026-10-09. Scope: sub-project 1 of 2. Sub-project 2 (generated STLs) is
specced here only as a forward constraint and tracked as
`PENDING(generated-stl-sizes)` in `packages/types/src/pending.ts`.

## Intent

Today every print request asks the same four questions (reach from seated,
switch size, mount, tray thickness) from `PRINT_FIT_QUESTIONS`. Each piece of
assistive tech needs different measurements, so the contributor of a guide
should decide what is asked. A guide with no fields shows "The contributor
hasn't set any customization fields." The longer aim is for a family's answers
to produce the right STL without a maker editing the design by hand; this
spec is the data foundation for that and changes nothing about who prints.

Assumptions (correct me): a print request is for parts of one guide; fields
belong to the guide, not to a single STL part; both mobile and web editors and
request forms change together (parity).

## Data

- `tutorials.customization_fields jsonb not null default '[]'` (migration 134).
  An array of at most 6 fields:
  `{ key, label, kind: 'choice' | 'number', options?: string[], unit?, min?, max?, param? }`
  - `key`: slug of the label, unique in the guide, fixed once created.
  - `choice`: 2–8 options, each ≤ 40 chars. `number`: `unit`, `min`, `max`
    required, min < max.
  - `param`: optional OpenSCAD parameter name. Stored, unused until
    sub-project 2.
  - Shape checked by one `customizationFieldsProblem()` in
    `packages/types/src/printing.ts`, used by the API; the DB constraint only
    checks "array, ≤ 6 entries".
- `toy_transactions.print_fit_notes` changes from `{reach, switch_size, mount,
  tray}` to a self-describing array `[{ label, value }]`. Snapshotting the label
  means a request still reads correctly after the contributor edits or removes a
  field. Migration 134 drops the 096 key constraint, converts existing rows
  (labels from today's four questions) and adds an "array of ≤ 6" check.

## API

- Guide create/patch accept `customization_fields`, validated, editable only by
  contributors (existing route rules). Returned on the guide GET.
- `POST /print` takes `fit_notes: { [fieldKey]: string | number }`. The API
  loads the guide's fields, rejects unknown keys, a choice not in `options`, or a
  number outside `min`–`max`, and stores `[{label, value}]` (number as
  `"310 mm"`). A guide with no fields accepts none.
- `fitNotesLines()` reads the new array shape; legacy rows are converted by the
  migration, so there is one shape.
- `PRINT_FIT_QUESTIONS`, `PrintFitKey`, `fitNotesProblem` are deleted.

## Screens

- **Editors (mobile `my-tutorials/sections/`, web `edit-*-section.tsx`):** a
  "Customization fields" section in the guide editor: add/remove/reorder, label,
  type, options or unit+min+max. Plain copy, with an example ("Tray thickness,
  choose one: 10 mm, 15 mm, 20 mm").
- **Request forms (mobile `request-screen.tsx`, web `request-print-form.tsx`):**
  render the guide's fields (chips for choices, a number field with its unit and
  range for numbers); all optional, as today. Empty → the sentence above.
- **Printer views (mobile offer/job screens, web incoming card and job page):**
  unchanged beyond reading the new shape.
- Number fields appear only when a contributor opts in; the default authoring
  path suggests choices (e.g. Small/Medium/Large with the size in each label).

## Errors and edge cases

- Contributor deletes or renames a field after requests exist: old requests keep
  their snapshot labels.
- Invalid answer: 400 with a sentence naming the field.
- Draft guides can be edited freely; fields on an approved guide follow the
  same edit rules as other guide content.

## Testing

Unit: `customizationFieldsProblem`, API validation (each rejection), shape
conversion, `fitNotesLines`. Component: editor section, request form with
zero/choice/number fields, the empty sentence, printer views. Migration test
asserting the converted rows and the new check (assert objects, per the
migration-drift lesson). Full `npx jest` for mobile; web unit and the parity
harness since a shared form changes.

## Forward constraint: sub-project 2 (not built here)

A guide may later carry a `.scad` file; each field's `param` maps to an
OpenSCAD parameter; S/M/L are parameter-set presets. On request the API renders
the STL in a sandbox (time limit, memory limit, no network), checks the
bounding box against the printer bed (`bedFits`), and shows the printer a
preview. No schema change to fields or answers is needed.
