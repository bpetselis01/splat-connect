# Guide editor overhaul (mobile) — design

Date: 2026-10-09. Scope: the mobile guide editor (`packages/mobile/components/my-tutorials`, `app/(my)/tutorials/[id]`), plus the web editor, API and database where item 7 and item 5 require it.

Mockups the decisions come from: `.superpowers/brainstorm/17262-1791502667/content/` (save-indicator, info-hint, page-checklist, steps-or-pdf, feedback-pdf-only).

## Intent

Byron wants the guide editor to feel lighter and to guide the contributor, and wants one rule simplified: a guide needs **steps or a PDF**, not both. Success: a contributor can finish a guide by either route with the editor telling them, on every page, what is left.

## Decisions (what Byron chose)

| # | Change | Decision |
|---|---|---|
| 1 | Save indicator | Keep the autosave logic. Replace the "Saving… / Saved" text with an animated **cloud → green tick** icon (mockup B). Errors keep the existing red `ErrorRow`. |
| 2 | Field hint blurbs | Replace each grey paragraph under a field with an **ⓘ icon** beside the label. Tap opens a **centred card** (dimmed screen, title, text, "Got it") (mockup A). |
| 3 | Build time | Replace the chip row with a **slider**. |
| 4 | Collaborators, Recommendations | Build both as mobile sections. Remove the Backing button from Details. |
| 5 | "How far along is it?" | **Delete maturity everywhere** (option C), column included. |
| 6 | Per-page "what's left" | A **progress bar strip** at the top of each section page (mockup B). |
| 7 | Steps or PDF | A guide needs ≥1 step **or** a PDF. Steps screen shows a **redirect card** when a PDF exists and there are no steps (mockup A). Feedback on a PDF-only guide has **no step picker** (mockup B). |

## 1. Save indicator

`save-chip.tsx` keeps reading `useDraft().saveState` and keeps its `idle | saving | saved | error` mapping. Rendering changes from `<Text>` to an icon pair (cloud-upload, check-circle) animated with the app's existing animation approach (check `lib/` and `components/ui` for the Animated/Reanimated convention before choosing). Saving: cloud bobs. Saved: tick scales in, holds for the existing "Saved" duration (`use-tutorial-draft.tsx:60`), fades. Error and idle render nothing. The header slot in `app/(my)/tutorials/[id]/_layout.tsx` stays. Needs `accessibilityLabel` ("Saving", "Saved") and a reduce-motion path (static icons).

Only the guide editor has a header chip. `child-editor-home.tsx` has its own "Saved" line. Reusing the new component there is a follow-up, not in this spec.

## 2. Info hints

New `components/ui/InfoHint.tsx`: props `title`, `children` (text). Renders an ⓘ pressable (44pt hit area) and a transparent `Modal` card. Mounted inside the screen tree, never the root, because iOS formSheets cannot be presented over (same constraint as `PhotoPreviewHost`); the plan should check whether the editor sections are formSheets and follow the `Screen`-hosted pattern if so. Add a stable `testID` per hint.

Every `styles.hint` paragraph in the section files moves behind an `InfoHint` on its label. Short copy that is an instruction rather than an explanation (for example a character limit) stays inline. The plan lists each hint and where it lands.

## 3. Build-time slider

Slider over `BUILD_TIME_OPTIONS` (10, 15, 20, 30, 45, 60, 90, 120, 180, 240), which are uneven, so the slider steps over **indices**, not minutes. Label shows `formatBuildTime`, with "4 h or more" at the top stop. Unset state shows "Not set" and the build-time gap stays open until touched; the value is saved on release (not on every drag tick), through the existing `save({ build_minutes })`. Library choice: use an already-installed slider if there is one, otherwise `@react-native-community/slider` (an Expo-compatible dependency; confirm SDK 57 support in the plan, and note that a native module forces an iOS prebuild per the stale-prebuild gotcha).

## 4. Collaborators and Recommendations sections

Two new sections, added to `SectionId`, `SECTION_LABEL`, `sectionsFor`, the hub's **More** list (replacing the "edit on the web" text) and the hub icon map. Both are optional: they never appear in `getMissingFields` and are excluded from `sectionProgress`, like `suits` and `picks`.

- **Collaborators**: lists contributors and pending invites (already returned by `GET /api/tutorials/:id`: `tutorial_contributors`, `tutorial_collaborator_invites`). Invite by name/email via `POST /api/tutorials/:id/collaborators/invite`; remove via `DELETE /api/tutorials/:id/collaborators/:profileId`. Port behaviour and copy from web `edit-collaborators-section.tsx`.
- **Recommendations**: up to three other approved guides, each with a "required" toggle, replace-all write through the recommendations route (`api/src/routes/recommendations.ts`). Picker lists approved guides from `/api/public/tutorials`. Port from web `edit-recommendations-section.tsx`, including the tag on rows that are no longer approved.
- **Backing** stays its own section; the Backing button leaves `details-section.tsx` and the lead line ("…and who is backing the guide") is reworded.

Both write immediately (no draft autosave), like the web versions; they do not go through `useDraft().save`, so they show their own pending/error state.

## 5. Delete maturity

Remove: the Details field (mobile `details-section.tsx:179`, web `edit-details-section.tsx:201`, web `edit/page.tsx`), `maturity` from `EDITABLE` (`tutorials.ts:186`) and the recommendations select strings (`tutorials.ts:97`, `public.ts:110`), the `.eq('maturity','complete')` filters (`public.ts:49,84`), `TutorialMaturity`/`MATURITY_LABEL` in `packages/types`, the badge renders (`tutorial-card.tsx`, `tutorial-view.tsx:454`, `detail-screen.tsx:408`, `Badge.tsx`), and the column.

Migration: **`supabase` migration NNN drops `tutorials.maturity`** (next free number; the plan checks, and records it in the hosted-migration step; hosted is applied separately by Byron's usual path). Before dropping, existing non-`complete` rows lose the hidden-from-library effect and become visible. **Decision recorded for review**: this publishes any approved guide that was marked concept/prototype/in-progress. The migration must first list how many such rows exist on the hosted DB; if any are `approved`, stop and ask Byron before applying. This does not block writing the code.

Guard tests that mention the column (`photo-arrays-generated-columns` style checks, type tests) are found by `grep maturity` in the plan.

## 6. Per-page progress strip

New `components/my-tutorials/section-progress.tsx`: bar + "N of M done" + "Still needed: …" line, green at 100%, "Nothing left here" when done. Mounted at the top of each section screen that can have gaps (Details, Steps, Parts, Tools, Safety, Files, 3D files); not on Who it's for, Worth a look, Collaborators, Recommendations, Backing.

Data: derive from `getMissingFields(tutorial)` filtered to that section, so the strip and the hub cannot disagree. A section's `M` is the number of its required checks. Rather than hard-coding totals, add `sectionChecks(tutorial, section): { label: string; done: boolean }[]` next to `getMissingFields` in `tutorial-sections.ts`, and make `getMissingFields` the projection of that same list (one source of truth). Tapping the strip does nothing; it is information.

## 7. Steps or PDF

### Rule
A guide is submittable when `steps.length >= 1` **or** `tutorial_pdf_url` is non-empty. "Bare" (title-less) steps still count; the review checklist keeps its own bare-step flag.

- `getMissingFields` (web `lib/validation.ts` and mobile `lib/tutorial-sections.ts`, hand-synced): remove the "The guide PDF" gap; add one gap `{ section: 'steps', label: 'Steps or a guide PDF' }` when both are absent. The 'steps' section can now be incomplete, so `sectionProgress` and `nextIncompleteSection` start counting it. Update the header comments that say steps never gap (`tutorial-sections.ts:14`, `edit-steps.ts:15`, `steps-section.tsx:8`).
- `sectionSummary('files')` stops asking for the PDF ("A photo" only when steps exist or a PDF is present).

### Screens
- **Hub rows**: Steps and Files rows follow the three states in the mockup ("Steps or PDF needed" / "Using your PDF" / "6 steps ✓" and "PDF optional").
- **Neither**: Steps screen shows two choice cards, "Write the steps here" and "Or upload a PDF guide" (the latter navigates to Files).
- **PDF, no steps**: Steps screen is replaced by the redirect card: "Your guide is the PDF" with **View PDF** and **Add steps as well**.
- **Steps, no PDF**: Files screen labels the PDF upload optional.
- Remove the "Optional — the PDF still carries the guide" copy (mobile `steps-section.tsx:96`, web `edit-steps-section.tsx:105`, web `edit/page.tsx:288`).

### Feedback on a PDF-only guide
Feedback notes are stored with `step_position` null = "Missing step"; no schema or API change. When `steps.length === 0`:
- `feedback-sheet.tsx` and `step-picker.tsx` hide the step picker, initialise the form with `at = null` so Post only needs a note, and show "Your note goes on the whole guide." in the sub-line.
- Labels read "Whole guide" instead of "Missing step" in `community-notes.tsx:161,164,244`, `feedback-sheet.tsx:102`, `guide-notes.ts` (`stepLabel`) and the web `tutorial-view.tsx:542,557`.
- The "Missing" filter chip is hidden. The overview banner label at `detail-screen.tsx:484` follows `stepLabel`.
- When steps later exist, labels return to "Missing step" (same stored value).

### Review surfaces (flag valid guides today; must change)
- Mobile `lib/review-checklist.ts`: replace the separate Steps/Files PDF checks with one **Guide content** check: ok if steps or PDF; keep the bare-step note.
- Web `admin-review-pane.tsx:24,37-39` and `admin/review/[id]/page.tsx:135-146`, `tutorial-review-panel.tsx:74`: same combined check; add a Steps section to the admin review page so a reviewer of a steps-only guide can read the steps.

### Server
Add an API check: `POST` submit (`tutorials.ts` near line 346) returns 400 when there are neither steps nor a PDF. Also reject, on a `pending` or `approved` guide, a `PUT /:id/steps []` or a `PATCH tutorial_pdf_url: null` that would leave both empty. Draft guides are unrestricted. (Other submit rules stay client-only; this is the one rule that can strand a live guide.)

### Copy to update
`web/tutorial-view.tsx:647` ("PDF… comes with an account" when no PDF), mobile `preview-screen.tsx` hint, `detail-screen.tsx:668` ("Nothing to download…"), `dashboard/tutorials/page.tsx:72`, `edit/page.tsx:300,488,491`, and the two older specs (`2026-09-02-mobile-guide-authoring-design.md:86`, `2026-05-25-splat-connect-library-design.md:67`).

### Unchanged on purpose
"Start from a PDF" import (its output already satisfies the rule), build mode (already shows an empty state with zero steps), seeds, gated downloads, search, notifications.

## Tests

- Update the ~25 tests that pin the old rule (web: `validation.test.ts`, `admin-review-pane.test.ts`, `admin-review.test.tsx`, `edit-tutorial.test.tsx`, `edit-steps.test.ts`, `stepper.test.tsx`, e2e `edit-tutorial.spec.ts`; mobile: `tutorial-sections.test.ts`, `guide-draft-rules.test.ts`, `review-checklist.test.ts`, hub/section-footer/list-screen tests, e2e `guides-authoring*.spec.ts`).
- Add: `sectionChecks` unit tests (including neither / PDF only / steps only / both); feedback sheet with zero steps (no picker, Post enabled with a note, "Whole guide" label); server submit and emptying-a-live-guide rejections; migration drop of `maturity` with no remaining references (`grep` guard); `InfoHint` open/close; slider index mapping and save-on-release; Collaborators and Recommendations section tests; e2e fixtures gain `withSteps` alongside `withPdf`.
- Per project rules: run the **whole** `npx jest` in `packages/mobile` before reporting done; run web unit and API tests for the packages touched; verify the animation, ⓘ card, slider and new sections on the phone (`iphone-qa`), light and dark mode.

## Build order (for the plan)

1. Maturity removal (isolated, shrinks later diffs).
2. `sectionChecks` + progress strip (item 6), then the steps-or-PDF rule on top (item 7), then feedback and review-surface changes, then server checks.
3. `InfoHint` and the hint migration (item 2).
4. Slider (item 3), save indicator (item 1).
5. Collaborators and Recommendations sections (item 4).

One commit per fix, per Byron's commit-style preference.

## Open items

- Maturity migration: row-count check on hosted before applying (see §5).
- Slider dependency and the iOS prebuild it may require (see §3).
- Whether to reuse the save indicator on the child editor (follow-up).
