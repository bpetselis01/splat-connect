# Guide screens redesign (mobile): the combined layout

Date: 2026-10-06
Mockup: https://claude.ai/artifact/WdsP8zR1HCdjhdMCFs516n, row "Combined: first layout, trimmed words"
(boards MixMain, MixGuideMore, MixGuideNeed, MixBuildStart, MixBuildStep, MixBuildDone, plus BuildSteps for the jump list).

## Why

Byron reviewed the guide page and build mode and found them hard to follow: the
first screen of a guide is crowded, what you need is hidden in a tab, a step
without a photo leaves half the screen blank, and there is a lot of text.
Research (iFixit guide details, W3C COGA, WCAG 2.2 mobile, Apple HIG, cook-mode
apps, LEGO Builder) points the same way: prerequisites before step 1, one
action at a time, visible progress, large targets, no screen timeout.

He chose the first-round layout (wordier) over the stripped "less text" one,
with the less-text round's trims applied where they do not change the layout.

## Rules

- **Author content is never rewritten.** Titles, step bodies, tips, safety
  notes, done note, description: shown word for word. The app only trims its
  own words (labels, hints, helper sentences).
- **No feature is removed.** Everything reachable today stays reachable:
  save, photos and captions, provenance links, fit line, thanks, report,
  pinned revisions, steps, safety notes and the author's checklist, who it's
  for, about, the toy, picks, ask a maker, parts/tools ticks and buy links,
  files, print settings, ask to print, PDF, notes, build logging.
- Text sizes are `theme.type` steps only (guard test). Colours are theme roles.

## Guide page (`components/home/detail-screen.tsx`)

First screen, top to bottom:
1. Hero photo carousel at full bleed (unchanged component), with the counter
   pill `1/2 · <caption>`. The thumbnail strip is removed.
2. One eyebrow line: device types, kind, age range, joined by ` · ` (replaces
   the badge row). A non-complete maturity keeps its badge.
3. Title with the save heart beside it; the lead sentence under it.
4. A one-line byline: `By <names> · Backed by <org>` (or `Reviewed by SPLAT`).
   Names open the contributor, the org opens the organisation.
5. Three fact tiles: `<n> min` / build (only when `build_minutes`), difficulty
   / level, `<n>` / steps (only when there are steps).
6. The fit line (`Suits Arlo`) when `fitLine` returns one.
7. A "What you'll need" card: `<n> parts · about $x` and `<n> tools`, each
   with its device tick count `got / n`. Tapping opens the You'll need tab.
8. A bottom bar pinned outside the scroll view with the primary action:
   `Start building`, `Pick up at step N`, `Build it again`, or `Download PDF`
   when the guide has no steps.

Below that, the tab bar sticks to the top while scrolling. Tabs: `Overview`,
`You'll need`, `Files`, `Notes <n>`.

**Overview tab:**
- Pinned revisions card (when any): `<n> fixes from builders`, the first pinned
  note as `Step k: <body>`, and `Read both fixes` / `Read the fix` opening Notes.
- `The steps` with `done/total`. One row per step: done steps ticked and struck
  through, the resume step highlighted with `You're here · <m> min`, others
  `<m> min`. A row opens build mode at that step. Community extra steps keep
  their line.
- `Stay safe`: each safety note (icon, title, detail), then a disclosure row
  `6 safety checks passed` that expands the author's checklist (only when
  `safety_declared_at`).
- `Who it's for`: a label and chips per answered question; chips the parent's
  first child shares are tinted with a tick.
- `About this guide` (rest of the description), then the toy / good-to-know
  section as today.
- A made-by card: the provenance line, `Say thanks` (or `Thanked`, disabled;
  hidden on your own guide), and `Report a problem`.
- Picks row, then `Can't build it? Ask a maker nearby` (hint text dropped).

**You'll need tab:** one combined bar `<n> things left to gather` / `Everything's
here.` with `got / total`, then Parts and Tools. The parts hint, the tools hint
and the long Learn callout shrink to `Not in the parts total` plus a `Tools and
materials` link. Tick targets grow to 44pt. Ticks lift into the page so the
bar, the card on the first screen and the lists agree live.

Files and Notes tabs: unchanged.

## Build mode (`components/guides/build-mode.tsx`)

Shared chrome: ✕ on the left, the screen label in the middle, and an
all-steps button on the right (replaces the empty grey spacer). Under it, a
progress bar with one segment per step: done green, current blue, rest grey.
The screen stays awake while build mode is open (`expo-keep-awake`; already
linked natively through `expo`).

- **Get ready** (was Before you start): title, `<m> min` and `<n> steps`
  chips, a `Parts and tools` row with `got/n parts · got/n tools` that opens a
  sheet with the same two checklists, the safety notes card, the checklist
  disclosure, and a small `Screen stays on` line. Footer: `Start step 1` only
  (no disabled Back).
- **A step:** a numbered badge and `<m> min` chip, the title, then the body.
  A body of two or more sentences shows as a lettered list (a, b, …) at 19pt,
  split on sentence ends only; one sentence shows as plain text. Then `Tip`
  (author tip), each pinned note as `Fix · pinned by <name>`, and
  `<n> notes on this step` when any note is on this step (opens the guide's
  Notes tab). Footer: a round back button and `Next` (`Done` on the last).
- **All steps sheet:** `Get ready`, then every step with its state; tapping
  one goes there. `Start over and clear ticks` resets the step ticks and goes
  to Get ready.
- **Done:** the cover photo in a circle with a tick badge, `You built it!`,
  `All <n> steps done`, the done note under `Try it out`, then
  `Add to My SPLAT` (logs the build; `Added to My SPLAT` after), `Leave a
  note`, `Back to the guide`. No second footer.
- Opening at a step: the route takes `?step=N`; the guide page's step rows
  pass it. Without it, build mode resumes at the first unticked step as today.

## Round 2: PDF preview and Learn (built 2026-10-06)

From the first-round boards Preview, LearnHub and Article, with the device
review's rules applied: one face for values (Nunito; the numeral face only for
prices), 20pt card padding, one section gap, no fixed line height in cards.

- **PDF preview** (`components/home/preview-screen.tsx`): titled "Guide PDF";
  the PDF on a sunken ground with a loading spinner; a bottom bar with
  `Open in browser` (sentence case), which is where printing and sharing
  happen. Print and Share buttons were drawn but need native modules
  (expo-print, a share of a 60-second signed URL), so they are not built.
- **Learn hub** (`components/explore/learn-hub.tsx`): course title, an intro
  that counts the reads and minutes; an Up next card (tinted, so it holds in
  dark mode) with one progress segment per article and `Keep reading`; Start
  here as a path, each node joined by a line, read nodes ticked, the next one
  highlighted; Going deeper as three tiles; a `Ready to build something?` card
  into Guides. The all-read and hidden-course states stay.
- **Article** (`components/explore/article-screen.tsx`): a reading bar that
  fills as you scroll; `Learn · n of 6 · m min`; title and intro; an
  `In this article` list that scrolls to each heading; the callout labelled
  `Worth remembering`; a pinned Next bar (`Next · m min` and the title) that
  marks the article read, or `Back to Learn` on the last one. The hero slot
  stays To be completed (pending registry).

## Out of scope

The guide library; the guide editor's long-step prompt; pinch-zoom on Android.

## Testing

- Unit: update `detail-screen.test.tsx`, `build-mode.test.tsx`,
  `guide-parts/tools` tests to the new copy; add tests for the sentence split,
  opening at `?step`, the all-steps sheet jump and reset, the steps-row jump,
  the combined gathered bar, and that the strip is gone.
- Guards: the type-scale and raw-colour tests stay green.
- E2E (mobile web): update `guides-detail.spec.ts` and
  `guides-reader-journeys.spec.ts` to the new labels.
