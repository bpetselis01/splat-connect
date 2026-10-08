# Contributor customization fields — implementation plan

Spec: docs/superpowers/specs/2026-10-09-contributor-customization-fields-design.md
Execution: inline, test-first per task, one commit per task.

Spec note: a field's `key` is derived from its label (`fieldKey`) at save time,
not fixed. Requests snapshot labels, so a rename costs nothing.

1. **types** (`packages/types/src/printing.ts`, `index.ts`): `CustomizationField`,
   `fieldKey`, `customizationFieldsProblem`, `customizationNotes(fields, answers)`
   (answers → `[{label,value}]` or a sentence), new `fitNotesLines`; delete
   `PRINT_FIT_QUESTIONS`/`fitNotesProblem`; `Tutorial.customization_fields`.
   Tests: `packages/web/tests/unit/lib/printing.test.ts`.
2. **migration 134**: `tutorials.customization_fields`, `print_fit_notes` → array.
3. **API**: tutorials PATCH accepts/validates `customization_fields`; POST `/print`
   validates `fit_notes` against the guide's fields, stores the array.
4. **mobile**: `CustomizationFieldsEditor` in the STL section; request screen
   renders the guide's fields or the empty sentence.
5. **web**: same editor in the STL step (server action), request form + page.
6. **verify**: API vitest, web vitest, mobile full jest, tsc ×4, `graphify update .`,
   PENDING regenerated.
