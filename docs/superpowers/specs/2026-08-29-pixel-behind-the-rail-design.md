# Pixel behind the rail

**Date:** 2026-08-29
**Status:** Design, awaiting review
**Follows:** `2026-08-26-pixel-redesign-design.md` (the system),
`2026-08-27-pixel-page-templates-design.md` (the public page walk)
**Mockup:** https://claude.ai/code/artifact/8aaa052c-99c2-4b41-815a-a5a1763e4b31

## Why this exists

Byron, 2026-08-29:

> there are quite a few design elements between the logged out public side of
> the website vs the logged in side that are not consistent, I want to bring
> the design of the logged out side into the logged in side […] without
> changing the rail or header, everything else is within this spec.

The diagnosis is narrower than "the dashboard was never redesigned", and the
narrower version is what makes this cheap.

`.pixel` is not on the public shell. It is on the body wrapper in
`app/layout.tsx` for **every** route — both the bare branch (`:104`) and the
main one (`:145`). So every `.pixel …` rule in `globals.css` already reaches
the dashboard, and the signed-in side silently inherited half the system when
the foundation shipped: `.btn` at an 8px radius with a 3px ink border and a
4px hard shadow, `.field` at 2px ink, `.chip`, `.badge`, `.pixel-avatar`, and
the entire press-motion block.

The comment at `globals.css:229` still says the opposite —

> Scoped to `.pixel`, which only the public shell sets. The dashboard shares
> `.btn-accent` and `.btn-primary` and is deliberately out of scope for this
> redesign

— and it has been wrong since the foundation landed. **Delete it as part of
this work**; a stale comment claiming a boundary that does not exist is what
lets the next person re-derive the wrong scope.

What never came across is everything defined *without* a `.pixel` prefix:
`.card`, `.card-flat`, `.panel`, `.alert`, the chat thread, the editor
stepper, the dropzone, `.empty-badge`, the sticky save bar, the toast, the
dock and every dialog. Those are still the pre-Pixel register — 16px corners,
blurred halos, hairline-or-no edges, and nine surviving `9999px` shapes.

The result is not "an old page". It is a Pixel button sitting on a soft card,
inside a Pixel input's own form, which is why the two sides read as different
products even though most of the atoms already match.

## Scope

**In:** every element inside the content column, on both sides of the login.

**Out, by instruction:** `components/rail.tsx` and `components/nav.tsx`, and
the `.shell*` / `.pixel header` / `.nav-pill` rules that dress them. Not a
line of either changes.

**Also out:** the palette (frozen since 2026-08-26), the shell width
(`min(80%, 110rem)` — asked and answered on 2026-08-27, do not "fix" it to
the board's `min(90%, 1400px)`), and `PixelBackdrop`, which renders only on
the non-shell branch. Putting section shapes behind a rail page is a
different decision and is not proposed here.

### Public pages are in scope too

Asked and answered, 2026-08-29. `.card`, `.card-flat` and `.alert` are shared
classes, and ten `.card` call sites, fourteen `.card-flat` call sites and six
`.alert` call sites are on public routes — Contact, About / Team, Impact, the
contributor and organisation profiles, the public tutorial page. Those are
the "derived surfaces" the 2026-08-26 spec knowingly deferred because the
board never drew them.

Byron's ruling: expand rather than scope. Changing the class *definitions*
fixes the rail side and those stragglers in one move. The alternative —
parallel `-pixel` classes swapped in per route — roughly doubles the work and
ends with `/contact` looking older than the dashboard.

**This is the reason the diff is small.** Almost nothing here is a call-site
edit. 43 `.card` call sites, 40 `.alert` call sites and 28 `.empty-badge`
call sites keep their class names untouched; only the definitions move.

## Source of truth

The board's measured vocabulary, already tokenised in `globals.css` and
already guarded by `tests/unit/app/pixel-tokens.test.ts`:

| | Values |
|---|---|
| Borders | `--border-pixel` 3px · `--border-pixel-thin` 2px · `--border-pixel-hair` 1px |
| Radii | `--radius-pixel` 10px · `-sm` 8px · `-slot` 6px · `-chip` 20px · `-xs` 4px · `-hair` 2px |
| Depths | `--shadow-pixel-lg` 6px · `-card` 5px · `-md` 4px · `-xs` 3px · `-sm` 2px, all over `--color-ink` |

**No new tokens. No new colours. No new values of any kind.** Every number
below is one of the eighteen above. Where an element has no board coverage —
the board draws no chat thread, no stepper, no dropzone — it is derived by
matching the register of the nearest thing the board *does* draw, and each
derivation names its precedent.

## The change, family by family

Twenty-five selectors in `globals.css` carry a soft-register value. Four of
them are already dead — overridden by a `.pixel …` rule that now reaches
every route — and are cleaned up rather than restyled.

### 1. `.card` — the card

Currently `border-radius: 1rem` on `--shadow-rest`, no border. Becomes the
board's card: `--radius-pixel`, `--border-pixel` ink, `--shadow-pixel-card`
ink.

This is not a derivation. It is the definition `.card-pixel` already carries
at `globals.css:742`, which the public library card, hub grid, launcher grid,
impact card and auth card have used since the foundation. `.card` and
`.card-pixel` have been the same object under two names, and the drift this
whole spec is about is what two names for one object produces.

Its press depth moves with it: `.pixel .card:not(.card-pixel) { --pop-rest: 2px }`
becomes 5px, matching `.card-pixel`.

`.card-tint` has **zero call sites**. Delete it.

### 2. `.card-flat` — flat rows and stat tiles

`1px solid var(--color-line)` at 16px becomes `--border-pixel-thin` ink at
`--radius-pixel-slot`. Precedent: `.field`, which took exactly this pair on
2026-08-27, and whose own token comment already reads *"art slots and inputs
at 6px"*.

Reaches the notifications list, the editor's file rows, the parts / tools /
files reference blocks on a tutorial, and every three-up stat tile on the
contributor, organisation and impact pages.

### 3. `.panel` — the editor sections

**Corrected 2026-08-29, before implementation.** An earlier draft of this
section called `.panel` "the editor accordions" and set it a rung shallower
than a card on the strength of the `--pop-rest: 2px` that
`.pixel .panel:has(> .panel-summary)` declares. Byron flagged it: the
tutorial editor has not been an accordion since `EditStepper` landed.

What is actually there: `EditStepper` renders a `.step-pill-row` and **one**
section at a time, and every section is a plain `<div className="panel pt-5">`
— seven in the tutorial editor, plus the toy and child editors, which share
the shape. There is no `<details>` in any editor. The single surviving
accordion in the whole app is one call site,
`app/admin/organizations/page.tsx:83` ("Create an organisation"), and it is
the only thing `.panel-summary` and that `:has()` press rule have ever
matched.

So 20 of the 21 `.panel` call sites are static content boxes. A static white
box with `overflow: hidden` is a card — `.panel`'s definition is `.card`'s
plus that one declaration, and has been all along. **`.panel` takes the card
treatment:** `--radius-pixel` + `--border-pixel` ink + `--shadow-pixel-card`
ink.

One press-motion consequence, and it is the only edit to that block beyond
the four `--pop-rest` values: `.pixel .panel:has(> .panel-summary)` moves
`--pop-rest: 2px` → `5px`. It has to. The block's whole invariant is that a
press travels by the element's *own* resting offset, so a panel resting at
5px that presses 2px lands short of the page instead of flush against it.
The rule keeps its own separate block — grouping a `:has()` selector with the
base family list is the specificity trap this file already documents twice.

`.panel-summary` and its `::after` disclosure triangle are untouched: one
call site, still an accordion, still correct.

### 4. `.alert`

16px, no border, becomes `--radius-pixel-slot` + `--border-pixel-thin solid
currentColor`. `currentColor` is deliberate and is the same trick `.badge`
uses at `:1035` — `.alert-danger`, `.alert-warning` and the ad-hoc
`alert bg-brand-tint text-ink` call sites each supply their own ink, so the
edge follows for free with no per-variant rule.

Side effect worth having: a bare `.alert` (one call site,
`app/admin/review/[id]/page.tsx:230`) currently has neither background nor
border and is invisible as an object. It gets an edge.

### 5. `.step-pill-row` / `.step-pill` / `.step-pill-dot` — the editor stepper

The last fully-round row on the site outside the filter chips.

- `.step-pill-row`: 16px on `--shadow-rest` → `--radius-pixel` +
  `--border-pixel` ink + `--shadow-pixel-card` ink. It is a card; it gets a
  card's treatment.
- `.step-pill`: `9999px`, `border: none` → `--radius-pixel-chip` (20px),
  `--border-pixel-thin` ink, `--shadow-pixel-xs` ink, white ground. Straight
  off `.chip` at `:973`, including keeping the pill radius — the board draws
  filter chips at 20px and `.chip`'s own comment argues the case: *"a filter
  is a soft, repeatable, low-stakes control, and squaring it off made a row
  of them read as a row of buttons"*. A stepper is the same kind of control.
- `.step-pill[data-active]`: flat ink fill, `box-shadow: none` — the chip's
  contrast pair, not a tint shift. An active step has been pushed in.
- `.step-pill-dot`: `9999px` → `--radius-pixel-hair` (2px).

Press depths: `--pop-rest: 3px` unselected, `0px` active. Both numbers are
`.chip`'s, and the reasoning for the selected-state zero is recorded at
`globals.css` in the press-motion block — a shape resting flat has nowhere to
travel, and 3px slides it past its own resting position.

`.step-pill` already sits inside the press-motion family list, so it needs no
new selector. **Its `:not()` rules stay in their own blocks** — the file
already documents this as a repeat offender.

### 6. `.chat-*` — the exchange thread

The one screen behind the rail a family spends real time on, and currently
four different shapes, none of them Pixel's.

- `.chat-panel` rides on `.card` and follows it for free.
- `.chat-bubble`: 16px + `--shadow-rest` → `--radius-pixel` +
  `--border-pixel-thin` ink + `--shadow-pixel-sm` ink. The tail corners
  (`0.35rem` = 5.6px) move to `--radius-pixel-xs` (4px). Keep the tails —
  they are what makes a bubble a bubble.
- `.chat-bubble-theirs`: `1px var(--color-line)` → the ink edge above.
- `.chat-bubble-mine` keeps its `--color-brand-deep` fill. Its ink shadow
  falls on the light log ground, so unlike `.chip[aria-pressed='true']` this
  is not an ink-on-ink problem and needs no `--pop-color` exception.
- `.chat-avatar`: `9999px` → `--radius-pixel-sm` + `--border-pixel-thin` ink.
  This is precisely `.pixel-avatar` (`:521`), which the header already uses
  for the initials disc. Same object, same shape.
- `.chat-daymark` / `.chat-system`: `9999px` → `--radius-pixel-xs`.
- `.chat-composer .field`: the `1.25rem` override → `--radius-pixel-slot`,
  i.e. stop overriding `.field` at all. Delete the declaration rather than
  restate it.

### 7. `.dropzone`

`2px dashed var(--color-line)` at 16px → `--border-pixel` dashed ink at
`--radius-pixel`. Dashed is already in the board's vocabulary (2px and 3px
dashed both appear); only the weight and the corner move. Its
`--pop-color: --color-brand-soft` exception stays — an ink shadow under a
dashed tinted box still reads as a mistake.

### 8. `.empty-badge`

The last circle. `9999px` at 72×72 → `--radius-pixel-sm` +
`--border-pixel-thin` ink. Same shape as `.chat-avatar` and `.pixel-avatar`
above; 28 call sites, none of which change.

### 9. `.sticky-submit-bar` and `.edit-toast`

Both ride on `--shadow-lift`, the blurred halo the foundation replaced
outright.

- `.sticky-submit-bar`: 16px + `--shadow-lift` → `--radius-pixel` +
  `--border-pixel` ink + `--shadow-pixel-card` ink. Its
  `border-top: 1px solid var(--color-line)` goes; the full border replaces it.
- `.edit-toast`: `9999px` + `--shadow-lift` → `--radius-pixel-sm` +
  `--border-pixel-thin` ink + `--shadow-pixel-xs` ink.

### 10. `.dock-my-splat`

The floating back-to-My-SPLAT dock. `9999px` + `--shadow-lift` →
`--radius-pixel-sm` + `--border-pixel` ink + `--shadow-pixel-md` ink, and its
press depth moves 2px → 4px to match (it is a control, and 4px is the board's
control depth). `.dock-my-splat-dot`: `9999px` → `--radius-pixel-hair`.

Included because it is signed-in chrome that renders over public pages, so
leaving it round would put the one remaining soft pill on top of every page
this spec touches. It is *not* the rail or the header.

### 11. `.dialog-panel`

`0.75rem` + `--shadow-lift` → `--radius-pixel` + `--border-pixel` ink +
`--shadow-pixel-lg` ink. 6px, one rung deeper than an ordinary card, for the
reason `auth-shell.tsx:62` already records for the auth card: it is the only
object on the screen. `.dialog-panel code`: `0.375rem` → `--radius-pixel-xs`.

Backdrop, centering, `@starting-style` transitions and the reduced-motion
branch are untouched.

### 12. Dead code from the `.pixel`-is-everywhere discovery

Four declarations that no longer reach anything, because a `.pixel …` rule
overrides each on every route:

- `.btn { border-radius: 9999px }` — beaten by `.pixel .btn` at 8px.
- `.btn-primary { box-shadow: var(--shadow-rest) }` — beaten by
  `.pixel .btn-primary` at `--shadow-pixel-md`.
- `.btn-accent { box-shadow: var(--shadow-rest) }` — same.
- `.card-link:hover { box-shadow: var(--shadow-lift) }` and its
  `transform` — beaten by the press-motion block.

Collapse each into the single live definition. This is the change most likely
to be done carelessly, so see *The failure mode this file keeps setting*
below.

### 13. The heading register

The one part of this that is a call-site edit rather than a definition
change, and the only part that needs judgement per page.

32 `<h1>` call sites across 28 pages set their heading as raw
`text-2xl font-bold text-ink` (24/700) — four of those pages carry two, a
loading state and a loaded one, which must both move or the heading will
resize as the page settles. 23 call sites already use the `title-*` register.

The register is not new and needs no invention — the mapping the public side
already follows is:

| Register | Size / weight | Used for | Existing precedent |
|---|---|---|---|
| `.title-hub` | 32 / 900 | a section landing that lists its children | `/dashboard`, `/dashboard/saved`, `/library`, `/learn` |
| `.title-article` | 24.8 / 900 | a single-purpose page or form | `/contact`, `/get-involved/submit-an-idea` |
| `.title-detail` | 20 / 800 | a named entity's own page | `/contributors/[id]`, `/organizations/[id]/public` |

The rule, not a list, because a list of 32 is a list someone will
mis-transcribe: **if the heading is an interpolated name, it is
`.title-detail`. If the page is a form or a single statement, it is
`.title-article`. Otherwise it is `.title-hub`.** That resolves every
straggler without a judgement call:

- **`.title-detail`** — every `{entity.name}` heading: `{toy.name}`,
  `{tutorial.title}` on both the public page and the editor, `{tx.toy_name}`,
  `{org.name}` on both organisation pages, `{idea.title}`.
- **`.title-article`** — Add a toy, New tutorial, One thing before you
  continue, Email confirmed, We couldn't find that page.
- **`.title-hub`** — everything else: My tutorials, My toys, My exchanges,
  Design challenges, Toy inventory, Organisation, Account, Notifications,
  Organisations, Admin dashboard, Accounts, Tutorial review queue, Design
  challenge queue, Spot-check.

Two notes. `/dashboard/saved` shipped with `.title-hub` during the saves work
and is the precedent, not an exception. And the mono `.eyebrow` above a hub
h1 that the mockup shows is **not** proposed — the public hubs get theirs
from `Breadcrumb`, which rail pages do not render, and inventing a per-page
eyebrow string is a content decision, not a styling one.

## What this does not change

- Every class name at every call site, with one exception (below). The
  definitions move; the markup does not.
- The rail, the header, the shell, the backdrop, the palette, the fonts.
- The press-motion block's structure. Five `--pop-rest` values change
  (`.card`, `.panel:has(> .panel-summary)`, `.step-pill`,
  `.step-pill[data-active]`, `.dock-my-splat`); no selector is added, removed
  or regrouped.
- Any behaviour, route, query or component boundary. This is a stylesheet
  change plus 32 heading classes.

## The one rename, and why it is separate

Once `.card` carries the pixel definition, `.card-pixel` is a second name for
an identical object — the exact condition that produced this whole spec.

**Phase 4 collapses it:** `.card-pixel` is deleted and its six call sites
(`tutorial-card`, `toy-library-card`, `hub-grid`, `launcher-grid`,
`impact-card`, `auth-shell`) move to `.card`; `.card-pixel-lead` becomes
`.card-lead`. Six test files reference the old names and follow. The
`:not(.card-pixel)` special case in the press-motion block disappears with
it.

It is a separate phase because it is the only mechanical rename in the work
and the only part that touches tests for a non-behavioural reason. **If it
looks like scope creep at review time, drop it** — everything in phases 1–3
stands without it. It is proposed because leaving two names is leaving the
trap armed.

## Testing

Three existing suites read `globals.css` as text, because jsdom does not
resolve stylesheets and this is the only place these failures are catchable
at all:

- `tests/unit/app/pixel-tokens.test.ts` — token scale, and `.chip`'s
  treatment. **Extend it**, one assertion per family above, so the next
  person cannot quietly revert a card to 16px. Assert against the token
  names, never against resolved values.
- `tests/unit/lib/press-motion.test.ts` — asserts `--pop-rest` per family by
  reading the block as text. Two of its assertions change value: `:71`
  (`.panel:has(> .panel-summary)`, 2 → 5) and, in phase 4, `:63`'s
  `.card-pixel` anchor. The other three `--pop-rest` changes are on families
  the test does not yet cover; add them.
- `tests/unit/lib/tone.test.ts` — reads `--color-muted` out of `globals.css`
  at test time so a contrast assertion cannot rot into a hardcoded hex. Not
  affected, and **must stay that way**.

New coverage, one test:

- Every value written by this spec is one of the eighteen tokens. A test that
  greps the component layer for a bare `9999px`, a bare `1rem` border-radius
  or a `--shadow-rest` / `--shadow-lift` outside the two places they are
  still legitimately declared (`@theme`, and nothing else after this work)
  fails if a soft-register value comes back. That is the guard this spec
  actually needs: not "does the card look right" but "did the old register
  reappear".

Existing component tests assert class *names* (`toHaveClass('card-pixel')`,
`querySelectorAll('a.card-pixel')`), so phases 1–3 should leave the suite
green untouched. If they do not, that is information — it means a test was
asserting a resolved style, and it should be read before it is fixed.

The E2E suite runs (`supabase start`, ports 3104/3105). Take a baseline
before blaming this branch: integration has one known flake,
`tests/integration/orgs/admin-endpoints.test.ts:166`, a sampling test that
passes on rerun.

## Visual check

Phase 1 of the page-template walk shipped with no visual check against the
artboard, and the memory of this project records that as a gap. This work
should not repeat it.

Check at 375 / 768 / 1280, signed in, on: `/dashboard/tutorials` (cards +
stat strip), `/tutorials/[id]/edit` (panels + stepper + sticky bar + toast),
`/dashboard/exchanges/[id]` (the whole chat register), `/notifications`
(flat rows), `/upload` (dropzone), and any page in an empty state. Then
`/contact` and `/impact` signed out, for the public stragglers.

The specific thing to look at is **density**. Forty-three cards gaining a 3px
edge and a 5px shadow is the largest single change here, and the exchanges
list and notifications list are the densest surfaces it lands on. The public
library already ships a grid of `.card-pixel` and reads fine, which is the
reason to expect this to work — but it is the thing to check first, and it is
reversible at one declaration if a list wants `.card-flat`'s lighter register
instead.

## The failure mode this file keeps setting

Recorded from three separate incidents on the Pixel branch, and this work is
almost entirely CSS-block replacement, so it is the highest risk here:

> An implementer replaces a CSS block and silently swallows an adjacent
> still-referenced declaration. The suite stays green. The worst instance
> deleted `--radius-field` while `.field` still consumed it — every form
> input site-wide would have lost its radius.

**Before accepting any task in this spec, diff the *set* of custom properties
and the *set* of selectors in `globals.css` before and after. Additions are
fine. Losses are the bug.** `--radius-field` in particular must survive:
eight `rounded-field` call sites still consume it, including the rail — which
this spec does not touch.

Second, from the same branch:

> A Tailwind utility on the element beats `@layer components` regardless of
> specificity.

If a rule below looks correct in the file and wrong in the browser, check the
element's utilities before editing the CSS.

## Phases

1. **The card families** — `.card`, `.card-flat`, `.card-tint` (delete),
   `.panel`, `.alert`, and the four dead declarations. The largest visual
   change, and the one to look at before continuing.
2. **The composite surfaces** — stepper, chat thread, dropzone,
   `.empty-badge`, sticky bar, toast, dock, dialog.
3. **The heading register** — 32 `<h1>` classes.
4. **`.card-pixel` collapse** — optional, see above.

Phases 1 and 2 are independent of 3 and can land in either order. Phase 4
must come last.
