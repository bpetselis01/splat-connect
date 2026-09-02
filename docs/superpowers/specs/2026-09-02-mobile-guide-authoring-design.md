# Mobile guide authoring: a checklist hub

**Date:** 2026-09-02
**Status:** Design, awaiting review. Not committed.
**Touches:** `components/my-tutorials/editor.tsx` (931 lines, split up),
six new routes under `app/(my)/tutorials/[id]/`, `components/ui/StepPills.tsx`
(retired from this flow), `app/(tabs)/guides/new.tsx`, `app/(my)/_layout.tsx`,
one API route (`DELETE /api/tutorials/:id`), the mobile unit suite and
`tests/e2e/guides-authoring.spec.ts`.

Mockups: <https://claude.ai/code/artifact/2ca539ff-9667-48db-8cdd-368a9ffc905c>

## Why

I provisioned a throwaway contributor on the development project, drove the
real app at iPhone 13 size with Playwright, and walked the whole flow: create,
then all six editor steps. `Add a guide` is fine and this design does not touch
its layout. The editor it hands you to is where the flow fails, and it fails in
ways that are not cosmetic.

**The submit button is off screen.** On the Review step the "Still needed:"
line is cut mid-sentence and `Submit for review` never appears. The only
control reachable on that screen is `Delete guide`. The one action the entire
flow exists to reach cannot be seen.

**Three save buttons and no autosave.** Details, Parts and Tools each own a
separate save. Parts and tools rows live in component state until their
replace-set POST fires, so tapping another pill without saving discards them
with no warning. A contributor who fills in six parts and moves on to Tools has
lost the parts.

**Delete is the most reachable control on every step**, pinned in the footer in
danger red, while the primary action of the step it sits under is below the
fold.

Two structural problems underneath those. The step rail is six equal pills that
scroll horizontally, so the fifth and sixth are off screen with nothing saying
they exist, and the rail communicates position but never progress — there is no
"how much is left". And `getMissingFields` already computes, for every gap, the
step that closes it; the Review screen then joins the labels into prose and
throws the step away, so the one screen that knows what is wrong cannot take
you to where it is fixed.

The rail also renders about 650px tall, because `StepPills` sets only
`minHeight: 40` on pills inside a horizontal `ScrollView` and react-native-web
stretches them to the full cross axis. **That specific defect is unconfirmed on
device** — Playwright drives the web build, and `react-native-web` does not
always lay out as Hermes does. It is why the shots look as extreme as they do.
Every other problem above is structural and reads the same on both runtimes.
The design below does not depend on which way that resolves, because it retires
the rail from this flow either way.

## Decisions taken

Byron's, 2026-09-02, against three directions offered.

1. **Direction A: a checklist hub with one screen per section.** The rail
   becomes a vertical checklist that is also the progress display; each row
   opens full screen and returns. Rejected: a linear wizard (the flow is
   genuinely non-linear — you can photograph the toy before you know its parts,
   and a contributor returning to fix one gap should not walk six steps), and a
   single long scroll with collapsible sections (fewer taps, but the parts and
   tools editors stay cramped and progress scrolls away).
2. **Autosave replaces all three Save buttons.**
3. **Delete moves into a `⋯` menu, is worded "Delete draft", and is rendered
   only while the status is draft** — absent, not disabled, otherwise.
4. **The API's delete route is fixed in this spec.** Web's missing delete is
   not; it has its own spec (`2026-09-02-web-draft-delete-design.md`).
5. **Safety becomes its own checklist row**, out of Details.
6. **Review stops being a step.** The hub is the review surface.

## What the hub replaces

`StepPills` stays in the codebase — the toy and child editors are its intended
future consumers — but this flow stops using it.

The hub's rows come from the same source as the pills did, so the rule about
what a draft needs stays in one place:

| Row | Status is `done` when | Gap label today |
|---|---|---|
| Details | title non-empty, difficulty valid | "A title", "A difficulty" |
| Safety | `safety_declared_at` set | "The safety declaration" |
| Parts | `parts.length > 0` | "A part" |
| Tools | `tools.length > 0` | "A tool" |
| Files | `tutorial_pdf_url` and `toy_photo_url` set | "The guide PDF", "A photo" |
| 3D print files | `stl_files.length > 0` | "A 3D-print file" |

Five rows for a `toy_adaptation`; the sixth appears only for `assistive_tech`,
exactly as the STL pill does today.

`getMissingFields` changes in one way: the safety gap moves from
`step: 'details'` to `step: 'safety'`. It keeps being the verbatim port of
web's `lib/validation.ts` in every other respect, and the comment saying so
stays — with the divergence named, so the next person to sync them knows this
one line is deliberate.

Each row shows what is missing in its own words ("None yet — at least one",
"Guide PDF and a photo") rather than a bare status dot, and tapping it opens
that section. That is the whole of what the Review step's prose was trying to
do.

## Routes

The editor becomes a nested stack, which is also how the 931-line `editor.tsx`
gets broken up:

```
app/(my)/tutorials/[id]/_layout.tsx    Stack, titles per screen
app/(my)/tutorials/[id]/index.tsx      the hub
app/(my)/tutorials/[id]/details.tsx
app/(my)/tutorials/[id]/safety.tsx
app/(my)/tutorials/[id]/parts.tsx
app/(my)/tutorials/[id]/tools.tsx
app/(my)/tutorials/[id]/files.tsx
app/(my)/tutorials/[id]/stl.tsx
```

with the components beside them in `components/my-tutorials/`: `hub.tsx`, and
one file per section. `ItemsStep` already generalises parts and tools and keeps
doing so — `parts.tsx` and `tools.tsx` are thin wrappers over it, as they are
today.

Each section screen owns its own slice of state and its own save. None of them
needs the whole `TutorialWithDetails`, which is what makes the split worth
doing: today one component holds twenty-seven `useState` calls covering six
unrelated concerns.

### Getting out

`app/(tabs)/guides/new.tsx` calls `router.replace('/tutorials/${id}')`. That
crosses from the `(tabs)` group into `(my)`, and `replace` discards the screen
it came from, so the stack has no entry behind the editor and
`(my)/tutorials/index` — My tutorials — was never on it. This is why the
captured screenshots show a header reading "Edit guide" with no back chevron:
there is genuinely nowhere to go back to.

The fix is an explicit destination rather than a repaired history. The hub
declares a `headerLeft` that navigates to `/tutorials`, because the editor is
reachable from the guides tab, from My tutorials, and from a notification, and
leaning on whatever happens to be on the stack is what broke here.

On the first landing after creation the hub shows a dismissible note — "Draft
saved. Finish it now, or come back any time — it's waiting in My tutorials." It
keys off a `justCreated` param set by `guides/new.tsx`, not off `status`, so it
appears once rather than on every visit to an untouched draft.

## Autosave

Three buttons go; the writes they performed do not.

- **Details and Safety.** Debounced PATCH, 800ms after the last keystroke, plus
  an immediate flush when the screen is left. Chips (kind, difficulty,
  maturity) flush immediately — they are discrete choices, not typing.
- **Parts and Tools.** The replace-set POST, debounced the same way. A row with
  a blank name is not sent; the section shows "Add a name to save this row"
  against it. This preserves today's `disabled={hasBlankRow}` rule without a
  button to hang it on.
- **Files and STL.** Already write on upload. Unchanged.

Two things the current code gets right and must keep. Every PATCH carries the
`updated_at` the screen last saw, and the response's `updated_at` is merged
back before the next write starts — with autosave the writes are closer
together, so they are serialised through a single in-flight promise per screen
rather than fired concurrently. And a save on an `approved` or `rejected`
tutorial re-queues it to `pending`, because RLS only admits contributor updates
in draft/pending/rejected. Both behaviours move into the section screens
unchanged.

The header carries a small "Saving…" / "Saved" chip, which is now the only
feedback that a write happened. A failed save shows the existing `ErrorRow`
inline in that section and leaves the edit in place to retry — never a silent
drop, which is the failure mode the buttons were protecting against.

## Submit, and delete

`Submit for review` docks at the bottom of the hub, disabled while any row is
incomplete, with the count beneath it ("4 things still needed"). It is the only
place the action appears.

The `⋯` menu holds, in order: **My tutorials**, **Preview as a reader**, and —
only while `status === 'draft'` — **Delete draft**. The confirmation
`Alert.alert` stays as it is; only its wording changes to name a draft.

### The API is lying about deletes

`packages/api/src/routes/tutorials.ts:260` issues the delete under the caller's
token and returns 204 whenever `error` is null. The RLS policy
(`001_schema.sql:183`) only admits a delete when `status = 'draft'`, and a
policy that matches zero rows is not an error — so deleting a pending or
approved tutorial returns 204 having deleted nothing. Mobile then calls
`router.back()` and the guide is still there.

Hiding the button (decision 3) removes the only way to reach this today, but it
leaves a route that reports success for work it did not do. So the route also
gains `.select()`, and answers `409` with
`{ error: 'Only draft guides can be deleted.' }` when nothing comes back.

This is the one part of this spec outside mobile. It is in because the mobile
UI would otherwise be trusting a response that cannot be trusted, and because
it is a silent-failure bug independent of any redesign.

## Testing

Unit, per new component, in `tests/unit/components/my-tutorials/`:

- **hub** — rows render from a tutorial fixture with the right status per row;
  a `toy_adaptation` shows five rows and no STL row; submit is disabled with a
  gap and enabled without; the `⋯` menu shows Delete draft on a draft and omits
  it on each of the other three statuses; the created note shows only with the
  param.
- **each section** — its own save fires debounced, carries `updated_at`, and
  re-queues an approved tutorial to pending; a failed save keeps the edit and
  shows the error.
- **`getMissingFields`** — the safety gap now reports `step: 'safety'`. This is
  the one place the hub's correctness is a pure function, so it is tested as one.

API integration, in `tests/integration/tutorials/`: a contributor deleting
their own draft gets 204 and the row is gone; the same contributor deleting
their own pending, approved and rejected tutorial gets 409 and the row remains.
There is no coverage of this route's status gate today at all.

E2E, `tests/e2e/guides-authoring.spec.ts`: the existing walk is rewritten
against the hub. It currently drives `getByRole('tab')` and three `Save`
buttons; it becomes tap a row, edit, wait the debounced PATCH out, go back,
assert the row turned complete — then submit from the hub. The waiting the spec
already does on each PATCH (see its comment about stale `updated_at`) matters
more with autosave, not less, so it stays.

Maestro is unaffected: no flow touches the authoring screens.

## Not in this spec

- Web's missing draft delete — `2026-09-02-web-draft-delete-design.md`.
- The three "edit on the web" dead ends on the old Review step (backing,
  collaborators, recommendations). They are read-only signposts today and stay
  read-only, moving to a "More" section below the checklist on the hub — not
  into the `⋯` menu, which holds actions rather than facts. Making any of them
  editable on mobile is its own piece of work and is not proposed here.
- `StepPills` itself. It stays for the toy and child editors; whether its
  `minHeight` bug is real on device should be settled before they adopt it.
- The `Add a guide` screen's duplicate kind/difficulty. Details re-asks for
  both, which is defensible now that Details is a section you visit rather than
  a pill you land on — but if it should be dropped from `guides/new.tsx`, that
  is a one-line change to make deliberately, not a side effect of this one.
