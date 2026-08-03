# Edit Tutorial Page Redesign

**Date:** 2026-08-03
**Status:** Approved design, ready for implementation planning

## Goal

Replace the edit-tutorial page's stack of seven native `<details>` accordions with a free-jump step navigator: a horizontal pill row showing every section's status at a glance, one section's content visible at a time, a persistent sticky bar for submitting the tutorial for review, and clear feedback when a save succeeds — none of which the current page has.

## Context

`packages/web/app/tutorials/[id]/edit/page.tsx` renders seven sections (Submit banner, Details, Files, Parts, Tools, STL Files, Backing, Collaborators) as stacked `<details>`/`<summary>` accordions, all collapsed except Details. The page is a Server Component: it fetches the tutorial, parts, tools, STL files, backing rows, and organisations, and defines every `'use server'` action (`saveDetails`, `patchFileUrls`, `saveParts`, `saveTools`, `addStlFileRecord`, `askOrg`, `withdrawOrg`, `inviteCollaborator`, `removeCollaborator`, `submitForReview`). Each section is already its own component (`EditDetailsSection`, `EditFilesSection`, `EditPartsSection`, `EditToolsSection`, `EditBackingSection`, `EditCollaboratorsSection`, plus the inline STL list/form), most already client components with their own save/error handling.

The problem is purely navigational and about feedback, not about what each section does: getting to "Parts" today means scrolling past however many panels are open above it and clicking to expand it, every section looks equally important regardless of how often it's actually touched, and saving a section gives no visible confirmation that anything happened.

This redesign changes navigation, layout, and save feedback only. It does not change data fetching, any server action's behavior, or any section's internal editing logic (validation, the conflict-detection UI `EditDetailsSection` already has, etc.).

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **A horizontal pill stepper, not a second sidebar** | The app already has its own primary left rail. A settings-panel-style secondary sidebar for the edit page would stack two vertical navs side by side; a top pill row avoids that entirely. |
| 2 | **Free-jump, not linear** | Unlike the create-tutorial wizard (which has a natural start/finish), editing an existing tutorial is usually "fix one thing and leave" — forcing users through every step in order to reach the one they want would reintroduce the friction this redesign is meant to remove. |
| 3 | **Every step carries a status signal** | ✓ done, ● current, ! needs attention, or a neutral marker for sections that are optional and empty. Gives the "what still needs my attention" answer the flat accordion never did, without a separate progress page. |
| 4 | **Submit for review lives in a sticky bottom bar** | Stays reachable regardless of which step is open or how far the page is scrolled, closest to today's placement (a banner) but persistent instead of only visible when Details happens to be the open panel. |
| 5 | **Sticky bar carries Submit only, not a general Save** | Each section keeps its own inline save action exactly as today (e.g. "Save details"). A second, page-level "Save" button would need to know which section's edits it's saving and duplicate logic those sections already own; Submit is a genuinely page-level action (it doesn't belong to any one section), so it's the only thing that belongs in a page-level bar. |
| 6 | **The rejection-note banner stays a separate top alert** | It's explanatory prose, not a short status line — folding it into the sticky bar (built for a single CTA + one line of context) would cramp it. Unchanged from today. |
| 7 | **Active step persists in the URL (`?step=`)** | Survives a refresh and is shareable/bookmarkable, for the cost of one query param. |
| 8 | **Save confirmation: a toast plus a persistent "Last saved" line** | The toast gives the immediate "it worked" moment; the persistent line gives ongoing confidence after the toast fades, e.g. if you look away right when a save completes. Both are one shared implementation (a `useSaveStatus` hook or small `<SaveStatus>` component), reused by every section rather than duplicated five-plus times. |

## Layout

```
┌─────────────────────────────────────────────┐
│ ← Dashboard          Spoon Holder            │  header (unchanged)
├─────────────────────────────────────────────┤
│ [rejection banner, if status === 'rejected'] │  unchanged, separate
├─────────────────────────────────────────────┤
│ ✓Details ●Files !Parts !Tools ·STL ·Backing  │  pill stepper (new)
├─────────────────────────────────────────────┤
│                                               │
│         [ active step's content ]            │  one section visible (new)
│                                               │
├─────────────────────────────────────────────┤
│ Add at least one part to submit  [Submit ▸]  │  sticky bar (new, draft only)
└─────────────────────────────────────────────┘
```

On narrow viewports the pill row becomes horizontally scrollable (no wrap, no dropdown) so every step stays one tap away.

## Component architecture

`page.tsx` keeps every fetch and every `'use server'` action unchanged. It gains one piece of server-side logic — computing each step's status from data it already has — and renders one new client component in place of the `<details>` stack:

```ts
type EditStep = {
  id: string                 // 'details' | 'files' | 'parts' | 'tools' | 'stl' | 'backing' | 'collaborators'
  label: string
  status: 'done' | 'attention' | 'neutral'
  attentionNote?: string     // shown in the sticky bar when this step is why Submit is blocked
  content: ReactNode         // the existing section component, unmodified
}
```

`EditStepper` (new client component) owns: which step is active (initialized from `?step=`, written back on change), rendering the pill row from the full step manifest, showing only the active step's `content`, and rendering the sticky bar (it needs the full manifest, not just the active step, to report attention reasons regardless of which step is currently open).

**Status rules** — mirrors `getMissingFields()` in `lib/validation.ts`, the existing source of truth for what's actually required to submit (description is notably not in that list, despite being part of the Details form):
- **Details** — attention if title or difficulty is missing; done otherwise. Description is optional and doesn't affect status.
- **Files** — attention if either the toy photo or the tutorial PDF is missing; done once both exist.
- **Parts** — attention if there are zero parts; done once there's at least one.
- **Tools** — attention if there are zero tools; done once there's at least one.
- **STL Files, Backing, Collaborators** — genuinely optional, not part of `getMissingFields()`; neutral when empty, done once something exists.

## Sticky bar behavior

- **Draft:** "Submit for review" — disabled with an explanatory line naming whichever required section(s) still need attention (Details' title/difficulty, Files' photo/PDF, Parts, Tools), reusing `getMissingFields()` rather than a new, second copy of the same rule.
- **Pending / Approved / Rejected:** nothing to submit. The bar shows a quieter "last saved" indicator instead of disappearing outright, so the layout doesn't reflow, and updates live as sections are saved (editing an approved tutorial still reverts it to `pending`, unchanged from today).

## Save confirmation

Two pieces, both new, both shared rather than duplicated per section:

1. **Toast** — one page-level toast component. Any section's successful save triggers it (e.g. "Details saved"), and it fades on its own.
2. **Persistent line** — each section shows "Last saved just now" / "Last saved 2m ago" near its own save button, updating live.

## What doesn't change

- Every data fetch and every `'use server'` action in `page.tsx`.
- Each section component's internal editing logic: form fields, validation, `EditDetailsSection`'s existing conflict-detection UI (the 409 "updated by someone else" message).
- The rejection-note banner.

## Testing note

`packages/web/tests/unit/pages/edit-tutorial.test.tsx` renders the current accordion structure and will need substantial rework, not incremental patching, once the stepper replaces it. New unit coverage is needed for `EditStepper` (pill rendering, active-step switching, URL sync, status computation) and the shared save-status piece. Out of scope for this design; belongs in the implementation plan.
