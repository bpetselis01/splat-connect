# Pixel behind the rail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Bring the Pixel design system to every surface the public site
already uses it on, so the logged-in side stops reading as a different
product — without touching the rail or the header.

**Architecture:** Almost none of this is a call-site edit. `.pixel` is already
on the body wrapper for every route, so the classes that never got the Pixel
treatment are exactly the ones defined *without* a `.pixel` prefix. Changing
those definitions in `packages/web/app/globals.css` changes every one of their
115+ call sites at once. The only markup edits are 32 `<h1>` class strings and,
in the last phase, six `.card-pixel` call sites.

**Tech Stack:** Next.js 15 (App Router), Tailwind v4 (`@theme` + `@layer
components` in `globals.css`), Vitest + Testing Library, Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-08-29-pixel-behind-the-rail-design.md`

## Global Constraints

- **No new tokens, no new colours, no new values.** Every number is one of the
  eighteen already in `globals.css`: borders `--border-pixel` 3px /
  `--border-pixel-thin` 2px / `--border-pixel-hair` 1px; radii
  `--radius-pixel` 10px / `-sm` 8px / `-slot` 6px / `-chip` 20px / `-xs` 4px /
  `-hair` 2px; depths `--shadow-pixel-lg` 6px / `-card` 5px / `-md` 4px /
  `-xs` 3px / `-sm` 2px, all over `var(--color-ink)`.
- **Never touch** `components/rail.tsx`, `components/nav.tsx`, or the
  `.shell*`, `.pixel header`, `.nav-pill` and `.pixel-avatar` rules.
- **Never touch** the `@theme` block, the palette, or `--radius-field` — eight
  `rounded-field` call sites still consume it, the rail among them.
- **Never touch** the `@media (prefers-reduced-motion: reduce)` group at
  `globals.css:1530`. Its own comment records that Lightning CSS once merged
  an adjacent twin and silently dropped six selectors. Leaving a now-inert
  selector listed there is free; editing it is not.
- **Keep `:has()` and `:not()` selectors in their own rules.** Tailwind
  compiles a comma group into a single `:is()`, and `:is()` takes the
  specificity of its most specific argument. This has broken the press-motion
  block once already and is documented twice in the file.
- **Run the set-diff after every CSS task** (see below). Additions are fine.
  Losses are the bug.
- **Do not commit.** Byron commits one file per commit, ordered, and only when
  he asks. Leave the tree dirty and tell him what is in it.

### The set-diff safety check

Run after every task that edits `globals.css`. A previous pass on this branch
deleted `--radius-field` while `.field` still consumed it; the suite stayed
green and every input site-wide would have lost its radius.

```bash
cd packages/web
props() { grep -oE '\-\-[a-z-]+:' "$1" | sort -u; }
sels() { grep -oE '^[[:space:]]*[.:&#a-zA-Z][^{};]*\{' "$1" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//' | sort -u; }
git show HEAD:packages/web/app/globals.css > /tmp/g-head.css
diff <(props /tmp/g-head.css) <(props app/globals.css)
diff <(sels /tmp/g-head.css) <(sels app/globals.css)
```

Baseline at the start of this plan: **50 custom properties, 176 selectors.**
Expected total change across all tasks: 0 properties removed;
`.card-tint` removed, `.pixel .card` added, `.pixel .card:not(.card-pixel)`
removed, `.pixel .btn` removed, `.card-link:hover` removed,
`.pixel .step-pill` + `.pixel .step-pill[data-active]` added. Anything else is
a mistake.

### Running tests

```bash
cd packages/web
npx vitest run tests/unit/app/pixel-tokens.test.ts      # the guard suite
npx vitest run tests/unit                                # everything (bare `vitest run` collects the e2e specs)
npx tsc --noEmit && npx eslint .                         # before declaring done
```

---

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `packages/web/app/globals.css` | Every definition change. One file, thirteen edits. | 1–11, 16 |
| `packages/web/tests/unit/app/pixel-tokens.test.ts` | Per-family guards, extended in the same style as its existing `.chip` and `.badge` tests. | 1–11 |
| `packages/web/tests/unit/lib/press-motion.test.ts` | `--pop-rest` guards. Two existing assertions change value; three new families gain one. | 3, 6, 10, 16 |
| `packages/web/tests/unit/app/soft-register.test.ts` | **New.** The permanent guard: no soft-register value may reappear anywhere in the component layer. | 12 |
| 28 page files under `packages/web/app/` | 32 `<h1>` class strings. | 13–15 |
| 6 component files + 6 test files | `.card-pixel` → `.card` rename. | 16 |

---

## Phase 1 — Surfaces

### Task 1: `.card` becomes the board's card

**Files:**
- Modify: `packages/web/app/globals.css:156-171` (`.card`, `.card-tint`)
- Modify: `packages/web/app/globals.css:1821-1824` (the `--pop-rest` rule)
- Test: `packages/web/tests/unit/app/pixel-tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `.card` now carries `--radius-pixel` + `--border-pixel` ink +
  `--shadow-pixel-card` ink, and rests at `--pop-rest: 5px`. Tasks 3 and 16
  rely on that definition. `.card-tint` no longer exists.

- [x] **Step 1: Write the failing test**

Append inside the existing `describe('pixel depth tokens', ...)` block in
`tests/unit/app/pixel-tokens.test.ts`, after the `.chip` test:

```ts
  /*
   * The card. `.card-pixel` has carried the board's card since the foundation
   * while `.card` kept the pre-Pixel 16px corner on a blurred --shadow-rest,
   * and the two have been the same object under two names — which is how the
   * signed-in side drifted while the public side did not.
   */
  it('draws the card as the board does', () => {
    const card = css.match(/\.card \{[^}]*\}/)?.[0] ?? ''
    expect(card).toMatch(/border-radius:\s*var\(--radius-pixel\)/)
    expect(card).toMatch(/border:\s*var\(--border-pixel\) solid var\(--color-ink\)/)
    expect(card).toMatch(/box-shadow:\s*var\(--shadow-pixel-card\) var\(--color-ink\)/)
    expect(card).not.toContain('--shadow-rest')
  })

  // .card-tint had zero call sites when this ran. A tinted 16px box with no
  // edge is the one shape the sweep has no Pixel answer for, and it does not
  // need one.
  it('has dropped .card-tint entirely', () => {
    expect(css).not.toContain('.card-tint')
  })
```

- [x] **Step 2: Run it to make sure it fails**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts`
Expected: FAIL — two failures. The card test fails on the first `toMatch`
(the block still reads `border-radius: 1rem`); the tint test fails because
`.card-tint` is still in the file.

- [x] **Step 3: Replace the `.card` and `.card-tint` blocks**

In `app/globals.css`, replace lines 156–171 — from `.card {` through the
closing brace of `.card-tint` — with:

```css
  /*
   * The card, and after 2026-08-29 there is one of them rather than two.
   *
   * This was a 16px corner on a blurred --shadow-rest: the register the whole
   * site had before Pixel. `.card-pixel` (below) has carried the board's card
   * since the foundation shipped, so the site has had two names for one object
   * and only one of them was ever updated — which is precisely how the
   * signed-in side drifted while the public side did not.
   *
   * `.card-tint` was removed at the same time: zero call sites, and a tinted
   * box with no edge is the one shape the pixel vocabulary has no answer for.
   */
  .card {
    background-color: var(--color-surface);
    border-radius: var(--radius-pixel);
    border: var(--border-pixel) solid var(--color-ink);
    box-shadow: var(--shadow-pixel-card) var(--color-ink);
  }

  .card-flat {
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: 1rem;
  }
```

(`.card-flat` is reproduced unchanged because it sits between the two blocks
being edited — Task 2 rewrites it.)

- [x] **Step 4: Update the press-motion resting depth**

In the press-motion block at the end of the file, replace this comment and
rule (currently around `:1806-1824`):

```css
  /* Cards. -card is the ordinary card, -lg the three launcher pillars, which
     is why a pillar pops to 8px and its neighbours to 7px: the hierarchy that
     holds at rest has to hold under the pointer too. A plain soft .card keeps
     its blurred resting shadow and takes a shallow 2px press — enough to
     register as pressed without pretending it is a bordered pixel card. */
  .pixel .card-pixel {
    --pop-rest: 5px;
  }

  .pixel .card-pixel-lead {
    --pop-rest: 6px;
  }

  .pixel .card:not(.card-pixel) {
    --pop-rest: 2px;
  }
```

with:

```css
  /* Cards. -card is the ordinary card, -lg the three launcher pillars, which
     is why a pillar pops to 8px and its neighbours to 7px: the hierarchy that
     holds at rest has to hold under the pointer too.

     .card and .card-pixel are the same object and rest at the same depth. The
     `:not(.card-pixel)` that used to hold a shallower 2px press for a soft
     .card went with the soft .card, and with it a (0,3,0) selector sitting in
     a block where everything else scores (0,2,0). Two rules rather than a
     comma group, deliberately: see the :is() warning at the top of this
     block. */
  .pixel .card {
    --pop-rest: 5px;
  }

  .pixel .card-pixel {
    --pop-rest: 5px;
  }

  .pixel .card-pixel-lead {
    --pop-rest: 6px;
  }
```

- [x] **Step 5: Run the tests to make sure they pass**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts tests/unit/lib/press-motion.test.ts`
Expected: PASS. `press-motion.test.ts:63` still finds
`.pixel .card-pixel {` at 5, unchanged.

- [x] **Step 6: Run the set-diff**

Run the block under *The set-diff safety check*.
Expected: no property lines differ. Selector diff shows exactly
`< .card-tint {`, `< .pixel .card:not(.card-pixel) {` and
`> .pixel .card {`. Anything else means a block was swallowed — revert and
redo the edit.

- [x] **Step 7: Run the full unit suite**

Run: `cd packages/web && npx vitest run`
Expected: PASS. Component tests assert class *names*, not resolved styles, so
nothing here should move. A failure is information — read it before fixing it.

---

### Task 2: `.card-flat` takes the input register

**Files:**
- Modify: `packages/web/app/globals.css` (`.card-flat`, immediately after `.card`)
- Test: `packages/web/tests/unit/app/pixel-tokens.test.ts`

**Interfaces:**
- Consumes: Task 1's `.card` block position.
- Produces: `.card-flat` at `--border-pixel-thin` ink + `--radius-pixel-slot`.

- [x] **Step 1: Write the failing test**

Append after Task 1's tests:

```ts
  /*
   * The flat register: notification rows, the editor's file rows, the
   * parts/tools/files reference blocks, and every three-up stat tile. The
   * precedent is .field, which took exactly this pair on 2026-08-27 — and
   * whose own token comment already reads "art slots and inputs at 6px".
   */
  it('draws the flat card in the same register as an input', () => {
    const flat = css.match(/\.card-flat \{[^}]*\}/)?.[0] ?? ''
    expect(flat).toMatch(/border:\s*var\(--border-pixel-thin\) solid var\(--color-ink\)/)
    expect(flat).toMatch(/border-radius:\s*var\(--radius-pixel-slot\)/)
    expect(flat).not.toContain('--color-line')
  })
```

- [x] **Step 2: Run it to make sure it fails**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts -t 'flat card'`
Expected: FAIL — the block still reads `border: 1px solid var(--color-line)`.

- [x] **Step 3: Replace the `.card-flat` block**

```css
  /*
   * The flat register — a bordered box with no depth, for things that sit
   * inside another surface rather than on the canvas: notification rows, the
   * editor's file rows, a tutorial's parts/tools/files blocks, and the
   * three-up stat tiles on the contributor, organisation and impact pages.
   *
   * 2px ink at 6px is .field's pair, not a new one. --radius-pixel-slot's own
   * comment reads "art slots and inputs at 6px"; a flat row is the same
   * register, and the 1px --color-line hairline it had was the last of the
   * pre-Pixel edges.
   */
  .card-flat {
    background-color: var(--color-surface);
    border: var(--border-pixel-thin) solid var(--color-ink);
    border-radius: var(--radius-pixel-slot);
  }
```

- [x] **Step 4: Run the test to make sure it passes**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts`
Expected: PASS.

- [x] **Step 5: Run the set-diff**

Expected: no selector or property changes at all (this task only edits
declarations inside an existing rule).

---

### Task 3: `.panel` takes the card treatment

**Files:**
- Modify: `packages/web/app/globals.css` (`.panel`, and its section comment)
- Modify: `packages/web/app/globals.css` (press-motion, the `:has()` rule)
- Test: `packages/web/tests/unit/app/pixel-tokens.test.ts`
- Test: `packages/web/tests/unit/lib/press-motion.test.ts:71`

**Interfaces:**
- Consumes: Task 1's card values.
- Produces: `.panel` identical to `.card` plus `overflow: hidden`, resting at
  5px both in its own shadow and in the `:has()` press rule.

**Context the implementer needs:** `.panel` is *not* an accordion, despite the
section comment calling it one. `EditStepper` renders a `.step-pill-row` and
one section at a time, each a plain `<div className="panel pt-5">`; the toy
and child editors share the shape. The only `<details>/<summary>` left in the
app is one call site, `app/admin/organizations/page.tsx:83`, and it is the
only thing `.panel-summary` and the `:has()` press rule have ever matched. So
20 of 21 `.panel` call sites are static content boxes — a card with
`overflow: hidden`.

- [x] **Step 1: Write the failing tests**

In `tests/unit/app/pixel-tokens.test.ts`:

```ts
  /*
   * .panel is a card with overflow:hidden and always was. 20 of its 21 call
   * sites are the static section boxes EditStepper swaps in; the 21st is the
   * one surviving accordion, on /admin/organizations. The section comment
   * calling this "accordion panels" predates the stepper.
   */
  it('draws the panel exactly as it draws the card', () => {
    const panel = css.match(/\.panel \{[^}]*\}/)?.[0] ?? ''
    expect(panel).toMatch(/border-radius:\s*var\(--radius-pixel\)/)
    expect(panel).toMatch(/border:\s*var\(--border-pixel\) solid var\(--color-ink\)/)
    expect(panel).toMatch(/box-shadow:\s*var\(--shadow-pixel-card\) var\(--color-ink\)/)
    expect(panel).toContain('overflow: hidden')
    expect(panel).not.toContain('--shadow-rest')
  })
```

In `tests/unit/lib/press-motion.test.ts`, change the existing assertion at
line 71 from `2` to `5`:

```ts
    expect(restFor('.pixel .panel:has(> .panel-summary) {')).toBe(5)
```

- [x] **Step 2: Run them to make sure they fail**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts tests/unit/lib/press-motion.test.ts`
Expected: FAIL — two failures. The panel test fails on `border-radius`; the
press test reports `expected 2 to be 5`.

- [x] **Step 3: Replace the `.panel` block and its section comment**

```css
  /* --- Editor section panels -------------------------------------------- */
  /*
   * A card with overflow: hidden, and it always was — the two definitions were
   * byte-identical apart from that one declaration.
   *
   * The section header used to read "Accordion panels (edit page)", which
   * stopped being true when EditStepper landed: the tutorial, toy and child
   * editors render a .step-pill-row and one `<div class="panel pt-5">` at a
   * time. 20 of the 21 call sites are those static boxes. The 21st, and the
   * only <details> left in the app, is app/admin/organizations/page.tsx:83 —
   * which is the only thing .panel-summary below has ever matched.
   */
  .panel {
    background-color: var(--color-surface);
    border-radius: var(--radius-pixel);
    border: var(--border-pixel) solid var(--color-ink);
    box-shadow: var(--shadow-pixel-card) var(--color-ink);
    overflow: hidden;
  }
```

- [x] **Step 4: Update the `:has()` resting depth**

In the press-motion block, the rule beginning
`.pixel .panel:has(> .panel-summary) {` — change `--pop-rest: 2px;` to
`--pop-rest: 5px;` and extend the comment above it:

```css
  /*
   * The panel pops, not its summary.
   *
   * .panel-summary is a full-width row inside a .panel that sets
   * overflow: hidden for its rounded corners — lifting the row alone would
   * clip its top-left and open a gap at its bottom-right, and it would read as
   * a strip peeling out of its own card. The summary is the handle; the panel
   * is the object being clicked, so the panel is what moves.
   *
   * 5px because .panel now rests on a 5px hard shadow like the card it is.
   * The invariant this whole block runs on is that a press travels by the
   * element's OWN resting offset, so leaving this at the 2px it had while
   * .panel rested on a blurred halo would land the press short of the page
   * instead of flush against it.
   */
  .pixel .panel:has(> .panel-summary) {
    --pop-rest: 5px;
```

- [x] **Step 5: Run the tests to make sure they pass**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts tests/unit/lib/press-motion.test.ts`
Expected: PASS.

- [x] **Step 6: Run the set-diff**

Expected: no selector or property changes.

---

### Task 4: `.alert` gets an edge in its own ink

**Files:**
- Modify: `packages/web/app/globals.css` (`.alert`)
- Test: `packages/web/tests/unit/app/pixel-tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `.alert` at `--radius-pixel-slot` with a `currentColor` edge.
  `.alert-danger` and `.alert-warning` are unchanged and inherit the edge.

- [x] **Step 1: Write the failing test**

```ts
  /*
   * The alert's edge is currentColor, the same trick .badge uses: the three
   * variants (.alert-danger, .alert-warning, and the ad-hoc
   * `alert bg-brand-tint text-ink` call sites) each set their own ink, so one
   * declaration covers all of them with no per-variant rule.
   */
  it('gives the alert an edge in its own ink', () => {
    const alert = css.match(/\.alert \{[^}]*\}/)?.[0] ?? ''
    expect(alert).toMatch(/border:\s*var\(--border-pixel-thin\) solid currentColor/)
    expect(alert).toMatch(/border-radius:\s*var\(--radius-pixel-slot\)/)

    // The variants must keep supplying only colour — an edge declared on one
    // of them would be an edge the other two silently lack.
    const danger = css.match(/\.alert-danger \{[^}]*\}/)?.[0] ?? ''
    expect(danger).not.toContain('border')
  })
```

- [x] **Step 2: Run it to make sure it fails**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts -t 'alert'`
Expected: FAIL — the block has no `border` declaration at all.

- [x] **Step 3: Replace the `.alert` block**

```css
  /* --- Alerts -----------------------------------------------------------
   *
   * currentColor, so the edge follows whatever ink the caller set: .alert-danger
   * and .alert-warning below, and the handful of `alert bg-brand-tint text-ink`
   * call sites. Same trick .badge uses, and the reason neither variant needs a
   * border rule of its own.
   *
   * A side effect worth having: a bare .alert (app/admin/review/[id]/page.tsx:230)
   * has neither background nor border and has never been visible as an object.
   * It has an edge now.
   */
  .alert {
    border: var(--border-pixel-thin) solid currentColor;
    border-radius: var(--radius-pixel-slot);
    padding: 0.875rem 1.25rem;
    font-size: 0.875rem;
  }
```

- [x] **Step 4: Run the test to make sure it passes**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts`
Expected: PASS.

- [x] **Step 5: Run the set-diff**

Expected: no selector or property changes.

---

### Task 5: Collapse the dead pre-Pixel declarations

**Files:**
- Modify: `packages/web/app/globals.css` (`.btn`, `.btn-primary`, `.btn-accent`,
  `.card-link`, `.pixel .btn`, and the stale comment above `.pixel .btn`)
- Test: `packages/web/tests/unit/app/pixel-tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `.btn` carries `--radius-pixel-sm` directly; `.pixel .btn` no
  longer exists; `.card-link` keeps only `display: block`.

**Context the implementer needs:** `.pixel` is set on the body wrapper in
`app/layout.tsx:104` and `:145` — for *every* route, not just the public
shell. So `.pixel .btn`, `.pixel .btn-accent` and the press-motion block have
always reached the dashboard, and four base declarations they override have
never rendered anywhere. The comment above `.pixel .btn` asserts the opposite
and is the reason this scope was misread; it goes with them.

Do **not** touch `.pixel .btn-accent`, `.pixel .btn-primary` or
`.pixel .btn-quiet` — `pixel-tokens.test.ts:52` guards the first of those.

- [x] **Step 1: Write the failing test**

```ts
  /*
   * .pixel is on the body wrapper for every route (app/layout.tsx:104, :145),
   * so every `.pixel …` rule reaches the dashboard too. Four base declarations
   * these rules override have therefore never rendered anywhere, and the
   * comment claiming the dashboard was "deliberately out of scope" has been
   * wrong since the foundation shipped. It was also the reason the scope of
   * the 2026-08-29 sweep was misread on the first pass.
   */
  it('has no pre-Pixel declaration left for a .pixel rule to override', () => {
    const btn = css.match(/\.btn \{[^}]*\}/)?.[0] ?? ''
    expect(btn).toMatch(/border-radius:\s*var\(--radius-pixel-sm\)/)
    expect(btn).not.toContain('9999px')

    expect(css).not.toMatch(/\.pixel \.btn \{/)
    expect(css).not.toMatch(/\.card-link:hover \{/)

    for (const sel of ['.btn-primary', '.btn-accent']) {
      const rule = css.match(new RegExp(`\\${sel} \\{[^}]*\\}`))?.[0] ?? ''
      expect(rule, `${sel} still carries the soft shadow`).not.toContain('--shadow-rest')
    }

    expect(css).not.toContain('deliberately out of scope for this redesign')
  })
```

- [x] **Step 2: Run it to make sure it fails**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts -t 'pre-Pixel declaration'`
Expected: FAIL on the first assertion — `.btn` still reads
`border-radius: 9999px`.

- [x] **Step 3: Move the radius onto `.btn` and delete `.pixel .btn`**

In `.btn`, change `border-radius: 9999px;` to
`border-radius: var(--radius-pixel-sm);`.

Then delete this comment and rule entirely (currently `:225-238`, sitting
between `.btn-primary:hover` and `.pixel .btn-accent`):

```css
  /*
   * Scoped to .pixel, which only the public shell sets. The dashboard shares
   * .btn-accent and .btn-primary and is deliberately out of scope for this
   * redesign — a signed-in user should not find their controls have grown a
   * bounce because the marketing site did.
   */
  .pixel .btn {
    border-radius: var(--radius-pixel-sm);
  }
```

replacing it with:

```css
  /*
   * The rules below are scoped to .pixel, which app/layout.tsx sets on the body
   * wrapper for EVERY route — the bare branch at :104 and the main one at :145.
   * A comment here used to claim it was the public shell only and that the
   * dashboard was out of scope; it had been wrong since the foundation shipped,
   * and it is why the 2026-08-29 sweep's scope was misread on the first pass.
   * The scoping is kept because these three controls are the only ones that
   * take a border, not because it draws a public/private line.
   */
```

- [x] **Step 4: Delete the two dead button shadows**

In `.btn-primary`, delete `box-shadow: var(--shadow-rest);` — leaving
`background-color` and `color`. Do the same in `.btn-accent`. Both are
overridden by `.pixel .btn-primary` / `.pixel .btn-accent` at
`--shadow-pixel-md`.

- [x] **Step 5: Trim `.card-link`**

Replace the three `.card-link` rules with:

```css
  /* Applied alongside .card on anything clickable. Hover, press and the
     transition that carries them all come from the shared press-motion block
     at the end of this file, which outranks anything declared here — the
     translateY(-2px)/--shadow-lift pair this used to carry stopped rendering
     the day that block landed. */
  .card-link {
    display: block;
  }
```

Leave the `@media (prefers-reduced-motion: reduce)` group untouched. It still
lists `.card-link:hover`, which now matches nothing — harmless, and its own
comment records that editing that group once caused Lightning CSS to merge an
adjacent twin and silently drop six selectors.

- [x] **Step 6: Run the tests to make sure they pass**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts tests/unit/lib/press-motion.test.ts`
Expected: PASS. `pixel-tokens.test.ts:52`'s `.pixel .btn-accent` assertion
still holds — that rule was not touched.

- [x] **Step 7: Run the set-diff and the full suite**

Run the set-diff, then `npx vitest run tests/unit`.
Expected: selector diff shows `< .pixel .btn {` and `< .card-link:hover {` and
nothing else new. Full suite PASS.

- [x] **Step 8: Checkpoint — look at it**

Start the dev server and look at `/dashboard/tutorials`, `/dashboard/exchanges`
and `/contact` at 1280. Phase 1 is the largest visual change in the plan
(43 cards, 21 panels, 40 alerts). The thing to judge is **density**: whether a
list of bordered cards reads as structure or as noise. The public library
already ships a grid of `.card-pixel`, which is the reason to expect this to
work — but check it before continuing, and say so if it looks wrong.

---

## Phase 2 — Composite surfaces

### Task 6: The editor stepper takes the chip register

**Files:**
- Modify: `packages/web/app/globals.css` (`.step-pill-row`, `.step-pill`,
  `.step-pill:hover`, `.step-pill[data-active]`, `.step-pill-dot`)
- Modify: `packages/web/app/globals.css` (press-motion — two new rules)
- Test: `packages/web/tests/unit/app/pixel-tokens.test.ts`
- Test: `packages/web/tests/unit/lib/press-motion.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `.step-pill` resting at `--pop-rest: 3px`,
  `.step-pill[data-active]` at `0px`.

**Context the implementer needs:** the stepper is the last fully-round row on
the site outside the filter chips, and `.chip` has already settled every
question it raises. Keep the 20px pill radius — `.chip`'s own comment argues
it, and a stepper is the same kind of control. Draw the states as a contrast,
not a tint shift: white on a 3px hard shadow when off, flat ink fill with no
shadow when on.

The four `.step-pill` state rules all score (0,2,0) and are settled by source
order — `:hover`, then `[data-active]`, then `:disabled`, then
`.step-pill-danger`. **Do not reorder them and do not qualify any with
`:not()`;** the existing comment explains that `:not()` would raise a rule to
(0,3,0) and silently outrank the rest.

- [x] **Step 1: Write the failing tests**

In `tests/unit/app/pixel-tokens.test.ts`:

```ts
  /*
   * The editor stepper, on all three editors. Everything here is .chip's
   * answer reused: the 20px pill radius survives because a step selector is
   * the same kind of low-stakes repeatable control a filter is, and the states
   * are a contrast rather than a tint shift — white standing off the page when
   * off, an ink fill lying flat when on.
   */
  it('draws the stepper in the chip register', () => {
    const row = css.match(/\.step-pill-row \{[^}]*\}/)?.[0] ?? ''
    expect(row).toMatch(/border-radius:\s*var\(--radius-pixel\)/)
    expect(row).toMatch(/box-shadow:\s*var\(--shadow-pixel-card\) var\(--color-ink\)/)
    expect(row).not.toContain('--shadow-rest')

    const pill = css.match(/\.step-pill \{[^}]*\}/)?.[0] ?? ''
    expect(pill).toMatch(/border-radius:\s*var\(--radius-pixel-chip\)/)
    expect(pill).toMatch(/border:\s*var\(--border-pixel-thin\) solid var\(--color-ink\)/)
    expect(pill).toMatch(/box-shadow:\s*var\(--shadow-pixel-xs\) var\(--color-ink\)/)
    expect(pill).not.toContain('9999px')

    const active = css.match(/\.step-pill\[data-active\] \{[^}]*\}/)?.[0] ?? ''
    expect(active).toMatch(/background-color:\s*var\(--color-ink\)/)
    expect(active).toMatch(/box-shadow:\s*none/)

    const dot = css.match(/\.step-pill-dot \{[^}]*\}/)?.[0] ?? ''
    expect(dot).toMatch(/border-radius:\s*var\(--radius-pixel-hair\)/)
  })
```

In `tests/unit/lib/press-motion.test.ts`, add to the existing
`it('gives every family with a resting shadow its own depth', ...)`:

```ts
    // The stepper joined the chip register on 2026-08-29. Same two depths and
    // the same reason: a selected pill rests flat, so it has nowhere to travel
    // and 3px would slide it past its own resting position.
    expect(restFor('.pixel .step-pill {')).toBe(3)
    expect(restFor('.pixel .step-pill[data-active]')).toBe(0)
```

- [x] **Step 2: Run them to make sure they fail**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts tests/unit/lib/press-motion.test.ts`
Expected: FAIL — the stepper test on `.step-pill-row`'s radius; the press test
with `expected null to be 3` (no rule declares it yet).

- [x] **Step 3: Replace the row, the pill, its hover and its active state**

```css
  .step-pill-row {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
    margin-bottom: 1.5rem;
    overflow-x: auto;
    background-color: var(--color-surface);
    border-radius: var(--radius-pixel);
    border: var(--border-pixel) solid var(--color-ink);
    box-shadow: var(--shadow-pixel-card) var(--color-ink);
  }

  /*
   * The step selector, and it is a chip in everything but name — which is why
   * every value below is .chip's.
   *
   * The 20px pill radius survives the squaring-off for the reason .chip
   * records: a repeatable low-stakes selector reads as a row of buttons once
   * you square it. The states are a contrast rather than the tint shift this
   * had (brand-tint -> brand-soft -> brand-dark): white standing off the page
   * on a 3px shadow when off, a flat ink fill when on. A selected step has
   * been pushed in.
   */
  .step-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
    padding: 0.5rem 0.9rem;
    background-color: var(--color-surface);
    color: var(--color-ink);
    border: var(--border-pixel-thin) solid var(--color-ink);
    border-radius: var(--radius-pixel-chip);
    box-shadow: var(--shadow-pixel-xs) var(--color-ink);
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      background-color 140ms var(--ease-out-quart),
      color 140ms var(--ease-out-quart);
  }

  .step-pill:hover {
    background-color: var(--color-sunken);
  }

  .step-pill[data-active] {
    background-color: var(--color-ink);
    color: #ffffff;
    box-shadow: none;
  }
```

Leave `.step-pill:disabled` and `.step-pill-danger` exactly where they are,
in that order.

- [x] **Step 4: Square the status dot**

In `.step-pill-dot`, change `border-radius: 9999px;` to
`border-radius: var(--radius-pixel-hair);`.

- [x] **Step 5: Add the two resting depths**

In the press-motion block, immediately after the `.pixel .chip[aria-pressed='true']`
rule, add:

```css
  /* The stepper, which is the chip register under another name — same two
     depths, and the selected one rests flat for the same reason: it is
     already "pressed in", so 3px would send it travelling down-right past its
     own resting position with no shadow to sink into.

     Its own rules rather than a comma group with .chip: the [data-active]
     selector scores (0,3,0) and grouping it would drag the pair up with it,
     which is the trap the top of this block documents. */
  .pixel .step-pill {
    --pop-rest: 3px;
  }

  .pixel .step-pill[data-active] {
    --pop-rest: 0px;
  }
```

- [x] **Step 6: Run the tests to make sure they pass**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts tests/unit/lib/press-motion.test.ts`
Expected: PASS.

- [x] **Step 7: Run the set-diff**

Expected: selector diff shows exactly `> .pixel .step-pill {` and
`> .pixel .step-pill[data-active] {`.

---

### Task 7: The exchange thread

**Files:**
- Modify: `packages/web/app/globals.css` (`.chat-daymark`/`.chat-system` shared
  rule, `.chat-avatar`, `.chat-bubble`, `.chat-bubble-theirs`,
  `.chat-bubble-mine`, `.chat-composer .field`)
- Test: `packages/web/tests/unit/app/pixel-tokens.test.ts`

**Interfaces:**
- Consumes: nothing. `.chat-panel` rides on `.card` and follows Task 1 for
  free — do not give it a border of its own.
- Produces: nothing later tasks depend on.

**Context the implementer needs:** the avatar's target shape is not invented.
`.pixel .pixel-avatar` (`globals.css:521`) is the initials disc in the header,
and it is already `--radius-pixel-sm` + `--border-pixel-thin` ink. The chat
avatar is the same object in a different place.

`.chat-bubble-mine` keeps its `--color-brand-deep` fill. Its ink shadow falls
on the light `.chat-log` ground, so unlike `.chip[aria-pressed='true']` this
is not an ink-on-ink problem and needs no `--pop-color` exception.

- [x] **Step 1: Write the failing test**

```ts
  /*
   * The exchange thread — the one screen behind the rail a family spends real
   * time on, and four different shapes before this: round avatars, 16px
   * blurred bubbles, round daymarks and a 20px composer field.
   *
   * The avatar's target is not a derivation: .pixel .pixel-avatar is the
   * header's initials disc and already draws exactly this pair.
   */
  it('draws the chat thread in the pixel register', () => {
    const bubble = css.match(/\.chat-bubble \{[^}]*\}/)?.[0] ?? ''
    expect(bubble).toMatch(/border-radius:\s*var\(--radius-pixel\)/)
    expect(bubble).toMatch(/border:\s*var\(--border-pixel-thin\) solid var\(--color-ink\)/)
    expect(bubble).toMatch(/box-shadow:\s*var\(--shadow-pixel-sm\) var\(--color-ink\)/)
    expect(bubble).not.toContain('--shadow-rest')

    const avatar = css.match(/\.chat-avatar \{[^}]*\}/)?.[0] ?? ''
    expect(avatar).toMatch(/border-radius:\s*var\(--radius-pixel-sm\)/)
    expect(avatar).toMatch(/border:\s*var\(--border-pixel-thin\) solid var\(--color-ink\)/)

    // The daymark and the system line share one rule.
    const marks = css.match(/\.chat-daymark,\s*\n\s*\.chat-system \{[^}]*\}/)?.[0] ?? ''
    expect(marks).toMatch(/border-radius:\s*var\(--radius-pixel-xs\)/)

    // The composer stops overriding .field's radius rather than restating it.
    expect(css).not.toMatch(/\.chat-composer \.field \{/)
  })
```

- [x] **Step 2: Run it to make sure it fails**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts -t 'chat thread'`
Expected: FAIL — `.chat-bubble` still reads `border-radius: 1rem`.

- [x] **Step 3: Square the daymark and the system line**

In the shared `.chat-daymark, .chat-system` rule, change
`border-radius: 9999px;` to `border-radius: var(--radius-pixel-xs);`.

- [x] **Step 4: Give the avatar the header's shape**

In `.chat-avatar`, change `border-radius: 9999px;` to:

```css
    border-radius: var(--radius-pixel-sm);
    border: var(--border-pixel-thin) solid var(--color-ink);
```

- [x] **Step 5: Replace the bubbles**

```css
  /*
   * The bubbles keep their tails — a tail is what makes a bubble a bubble —
   * but at --radius-pixel-xs rather than the 0.35rem (5.6px) they had, which
   * was in none of the board's six radii.
   */
  .chat-bubble {
    padding: 0.55rem 0.85rem;
    border-radius: var(--radius-pixel);
    border: var(--border-pixel-thin) solid var(--color-ink);
    font-size: 0.875rem;
    line-height: 1.45;
    overflow-wrap: anywhere;
    box-shadow: var(--shadow-pixel-sm) var(--color-ink);
  }

  .chat-bubble-theirs {
    background-color: var(--color-surface);
    border-bottom-left-radius: var(--radius-pixel-xs);
    color: var(--color-ink);
  }

  /* brand-deep, not brand: white on #1998d5 is 3.2:1 and this is body text.
     The ink edge and shadow above stay — the shadow falls on the light
     .chat-log ground, not on the bubble, so unlike a selected .chip this is
     not ink on ink and needs no --pop-color exception. */
  .chat-bubble-mine {
    background-color: var(--color-brand-deep);
    border-bottom-right-radius: var(--radius-pixel-xs);
    color: #ffffff;
  }
```

- [x] **Step 6: Delete the composer's radius override**

Delete this rule entirely:

```css
  .chat-composer .field {
    border-radius: 1.25rem;
  }
```

`.field` is already `--radius-pixel-slot`. Deleting the override is the
change; restating it would leave a rule that says nothing.

- [x] **Step 7: Run the test to make sure it passes**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts`
Expected: PASS.

- [x] **Step 8: Run the set-diff**

Expected: selector diff shows exactly `< .chat-composer .field {`.

---

### Task 8: The dropzone and the last circle

**Files:**
- Modify: `packages/web/app/globals.css` (`.dropzone`, `.empty-badge`)
- Test: `packages/web/tests/unit/app/pixel-tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. `.dropzone` keeps `--pop-rest` at its family default of
  0 — it is flat at rest and gains a shadow on hover. Do not add one.

- [x] **Step 1: Write the failing test**

```ts
  /*
   * The dropzone's dashed edge is already board vocabulary (it draws both 2px
   * and 3px dashed); only the weight and the corner move. .empty-badge is the
   * last 9999px shape on the site, and it becomes the same bordered square the
   * header avatar and the chat avatar already are.
   */
  it('draws the dropzone and the empty badge in the pixel register', () => {
    const drop = css.match(/\.dropzone \{[^}]*\}/)?.[0] ?? ''
    expect(drop).toMatch(/border:\s*var\(--border-pixel\) dashed var\(--color-ink\)/)
    expect(drop).toMatch(/border-radius:\s*var\(--radius-pixel\)/)

    const badge = css.match(/\.empty-badge \{[^}]*\}/)?.[0] ?? ''
    expect(badge).toMatch(/border-radius:\s*var\(--radius-pixel-sm\)/)
    expect(badge).toMatch(/border:\s*var\(--border-pixel-thin\) solid var\(--color-ink\)/)
    expect(badge).not.toContain('9999px')
  })
```

- [x] **Step 2: Run it to make sure it fails**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts -t 'dropzone'`
Expected: FAIL — `.dropzone` still reads `border: 2px dashed var(--color-line)`.

- [x] **Step 3: Restyle both**

In `.dropzone`, replace:

```css
    border: 2px dashed var(--color-line);
    border-radius: 1rem;
```

with:

```css
    border: var(--border-pixel) dashed var(--color-ink);
    border-radius: var(--radius-pixel);
```

In `.empty-badge`, replace `border-radius: 9999px;` with:

```css
    border-radius: var(--radius-pixel-sm);
    border: var(--border-pixel-thin) solid var(--color-ink);
```

Leave `.dropzone:hover`, `.dropzone-active` and the
`.pixel .dropzone { --pop-color: var(--color-brand-soft) }` exception alone —
an ink shadow under a dashed tinted box still reads as a mistake.

- [x] **Step 4: Run the test to make sure it passes**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts`
Expected: PASS.

- [x] **Step 5: Run the set-diff**

Expected: no selector or property changes.

---

### Task 9: The save bar and the toast

**Files:**
- Modify: `packages/web/app/globals.css` (`.sticky-submit-bar`, `.edit-toast`)
- Test: `packages/web/tests/unit/app/pixel-tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [x] **Step 1: Write the failing test**

```ts
  /*
   * Both rode on --shadow-lift, the blurred halo the foundation replaced
   * outright. The bar is a card and takes a card's depth; the toast is a small
   * floating label and takes the chip register's.
   */
  it('lands the save bar and the toast on hard shadows', () => {
    const bar = css.match(/\.sticky-submit-bar \{[^}]*\}/)?.[0] ?? ''
    expect(bar).toMatch(/border:\s*var\(--border-pixel\) solid var\(--color-ink\)/)
    expect(bar).toMatch(/border-radius:\s*var\(--radius-pixel\)/)
    expect(bar).toMatch(/box-shadow:\s*var\(--shadow-pixel-card\) var\(--color-ink\)/)
    expect(bar).not.toContain('--shadow-lift')
    expect(bar).not.toContain('border-top')

    const toast = css.match(/\.edit-toast \{[^}]*\}/)?.[0] ?? ''
    expect(toast).toMatch(/border-radius:\s*var\(--radius-pixel-sm\)/)
    expect(toast).toMatch(/box-shadow:\s*var\(--shadow-pixel-xs\) var\(--color-ink\)/)
    expect(toast).not.toContain('9999px')
  })
```

- [x] **Step 2: Run it to make sure it fails**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts -t 'save bar'`
Expected: FAIL — the bar has no `border` declaration.

- [x] **Step 3: Replace both blocks**

In `.sticky-submit-bar`, replace the last three declarations —
`border-top: 1px solid var(--color-line);`, `border-radius: 1rem;` and
`box-shadow: var(--shadow-lift);` — with:

```css
    border: var(--border-pixel) solid var(--color-ink);
    border-radius: var(--radius-pixel);
    box-shadow: var(--shadow-pixel-card) var(--color-ink);
```

The `border-top` hairline goes because the full border replaces it; leaving
both would draw the top edge twice at two weights.

In `.edit-toast`, replace `border-radius: 9999px;` with:

```css
    border: var(--border-pixel-thin) solid var(--color-ink);
    border-radius: var(--radius-pixel-sm);
```

and `box-shadow: var(--shadow-lift);` with:

```css
    box-shadow: var(--shadow-pixel-xs) var(--color-ink);
```

- [x] **Step 4: Run the test to make sure it passes**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts`
Expected: PASS.

- [x] **Step 5: Run the set-diff**

Expected: no selector or property changes.

---

### Task 10: The floating dock

**Files:**
- Modify: `packages/web/app/globals.css` (`.dock-my-splat`, `.dock-my-splat-dot`)
- Modify: `packages/web/app/globals.css` (press-motion, the dock's rest)
- Test: `packages/web/tests/unit/app/pixel-tokens.test.ts`
- Test: `packages/web/tests/unit/lib/press-motion.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `.dock-my-splat` resting at `--pop-rest: 4px`.

**Context the implementer needs:** the dock is signed-in chrome that renders
over *public* pages (`app/layout.tsx:161`, `BackToMySplatDock`). It is the
last soft pill anywhere, so leaving it round would put a 9999px blurred halo
on top of every page this plan touches. It is not the rail and not the header.

4px is the board's control depth — the same rest `.btn-accent`,
`.btn-primary` and `.btn-quiet` take.

- [x] **Step 1: Write the failing tests**

In `tests/unit/app/pixel-tokens.test.ts`:

```ts
  /*
   * The dock is the last soft pill on the site, and it floats over public
   * pages as well as the dashboard — so leaving it round would put a blurred
   * 9999px halo on top of every surface this sweep just squared off.
   */
  it('draws the dock as a control, not a pill', () => {
    const dock = css.match(/\.dock-my-splat \{[^}]*\}/)?.[0] ?? ''
    expect(dock).toMatch(/border-radius:\s*var\(--radius-pixel-sm\)/)
    expect(dock).toMatch(/border:\s*var\(--border-pixel\) solid var\(--color-ink\)/)
    expect(dock).toMatch(/box-shadow:\s*var\(--shadow-pixel-md\) var\(--color-ink\)/)
    expect(dock).not.toContain('--shadow-lift')

    const dot = css.match(/\.dock-my-splat-dot \{[^}]*\}/)?.[0] ?? ''
    expect(dot).toMatch(/border-radius:\s*var\(--radius-pixel-hair\)/)
  })
```

In `tests/unit/lib/press-motion.test.ts`, add to the same
`it('gives every family with a resting shadow its own depth', ...)`:

```ts
    // The dock took a control's 4px when it stopped resting on a blurred halo.
    expect(restFor('.pixel .dock-my-splat {')).toBe(4)
```

- [x] **Step 2: Run them to make sure they fail**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts tests/unit/lib/press-motion.test.ts`
Expected: FAIL — the dock test on `border-radius`; the press test with
`expected 2 to be 4`.

- [x] **Step 3: Restyle the dock and its dot**

In `.dock-my-splat`, replace `border-radius: 9999px;` with:

```css
    border-radius: var(--radius-pixel-sm);
    border: var(--border-pixel) solid var(--color-ink);
```

and `box-shadow: var(--shadow-lift);` with:

```css
    box-shadow: var(--shadow-pixel-md) var(--color-ink);
```

In `.dock-my-splat-dot`, change `border-radius: 9999px;` to
`border-radius: var(--radius-pixel-hair);`.

- [x] **Step 4: Update its resting depth**

Replace the dock's rule in the press-motion block:

```css
  /* The dock rests on a soft blurred shadow rather than a hard edge, so it
     takes the same shallow press as a soft card. */
  .pixel .dock-my-splat {
    --pop-rest: 2px;
  }
```

with:

```css
  /* The dock is a control and rests at a control's depth. It was 2px while it
     rode on a blurred --shadow-lift; it carries the board's 4px hard offset
     now, and the press has to travel by the offset it actually has. */
  .pixel .dock-my-splat {
    --pop-rest: 4px;
  }
```

- [x] **Step 5: Run the tests to make sure they pass**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts tests/unit/lib/press-motion.test.ts`
Expected: PASS.

- [x] **Step 6: Run the set-diff**

Expected: no selector or property changes.

---

### Task 11: Dialogs

**Files:**
- Modify: `packages/web/app/globals.css` (`.dialog-panel`, `.dialog-panel code`)
- Test: `packages/web/tests/unit/app/pixel-tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**Context the implementer needs:** 6px, a rung deeper than an ordinary card,
for the reason `components/auth-shell.tsx:62` already records for the auth
card — a modal is the only object on the screen. Leave the `::backdrop`, the
centering, the `@starting-style` transitions and the reduced-motion branch
alone; only the box changes.

- [x] **Step 1: Write the failing test**

```ts
  /*
   * A modal sits one rung deeper than an ordinary card because it is the only
   * object on the screen — the same reasoning auth-shell.tsx:62 records for
   * the sign-in card, which is the other object that has the screen to itself.
   */
  it('draws the dialog a rung deeper than a card', () => {
    const dialog = css.match(/\.dialog-panel \{[^}]*\}/)?.[0] ?? ''
    expect(dialog).toMatch(/border:\s*var\(--border-pixel\) solid var\(--color-ink\)/)
    expect(dialog).toMatch(/border-radius:\s*var\(--radius-pixel\)/)
    expect(dialog).toMatch(/box-shadow:\s*var\(--shadow-pixel-lg\) var\(--color-ink\)/)
    expect(dialog).not.toContain('--shadow-lift')

    const code = css.match(/\.dialog-panel code \{[^}]*\}/)?.[0] ?? ''
    expect(code).toMatch(/border-radius:\s*var\(--radius-pixel-xs\)/)
  })
```

- [x] **Step 2: Run it to make sure it fails**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts -t 'dialog'`
Expected: FAIL — the block still reads `border: 0` and
`border-radius: 0.75rem`.

- [x] **Step 3: Restyle the dialog**

In `.dialog-panel`, replace:

```css
    border: 0;
    border-radius: 0.75rem;
```

with:

```css
    border: var(--border-pixel) solid var(--color-ink);
    border-radius: var(--radius-pixel);
```

and `box-shadow: var(--shadow-lift);` with:

```css
    box-shadow: var(--shadow-pixel-lg) var(--color-ink);
```

In `.dialog-panel code`, change `border-radius: 0.375rem;` to
`border-radius: var(--radius-pixel-xs);`.

- [x] **Step 4: Run the test to make sure it passes**

Run: `cd packages/web && npx vitest run tests/unit/app/pixel-tokens.test.ts`
Expected: PASS.

- [x] **Step 5: Run the set-diff and the full suite**

Run the set-diff, then `npx vitest run tests/unit`.
Expected: no selector or property changes; full suite PASS.

---

## Phase 3 — The permanent guard, and the headings

### Task 12: One test that stops the soft register coming back

**Files:**
- Create: `packages/web/tests/unit/app/soft-register.test.ts`

**Interfaces:**
- Consumes: every CSS change from Tasks 1–11.
- Produces: nothing.

**Why this task exists:** the per-family tests above assert that each block
says the right thing *today*. None of them notices a *new* block written in
the old register — which is exactly how this drift happened the first time.
This is the guard the spec actually asks for: not "does the card look right"
but "did the pre-Pixel register reappear anywhere".

- [x] **Step 1: Tokenise the one literal that is already correct**

`.mark` (the honey highlighter behind headline words) sets
`border-radius: 0.5rem`. That is 8px — `--radius-pixel-sm` exactly. It is not
a soft-register survivor, it is the right value written the wrong way, and it
is the only such case in the file.

In `app/globals.css`, in the `.mark` block, change:

```css
    border-radius: 0.5rem;
```

to:

```css
    border-radius: var(--radius-pixel-sm);
```

This renders identically. Confirm that before moving on:
`0.5rem` at the default 16px root is 8px, and `--radius-pixel-sm: 8px`.

- [x] **Step 2: Write the test**

Create `packages/web/tests/unit/app/soft-register.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * The pre-Pixel register must not come back.
 *
 * Every other guard in this directory asserts that one block says the right
 * thing today. None of them notices a *new* block written in the old
 * register — and that is exactly how the signed-in side drifted: the
 * foundation pass updated the classes it touched, and every class it did not
 * touch kept 16px corners and blurred halos for three months while nothing
 * failed.
 *
 * jsdom does not resolve stylesheets, so reading the file as text is the only
 * place this is catchable at all.
 */
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../app/globals.css'),
  'utf8',
)

const LINES = css.split('\n')

/**
 * Where the component layer starts. Everything above it is @theme, which
 * legitimately DEFINES --shadow-rest and --shadow-lift; this guard is about
 * what consumes them.
 */
const FIRST = LINES.findIndex((l) => l.includes('@layer components')) + 1

/** A comment line, which may say "9999px" while declaring nothing. */
const isProse = (l: string) => /^\s*(\/\*|\*|\/\/)/.test(l)

/**
 * Every offending declaration, as `line: text`. Returning the location rather
 * than a boolean is deliberate — a failure here should tell you which rule
 * regressed, not merely that one did.
 */
function declarationsMatching(pattern: RegExp): string[] {
  return LINES.slice(FIRST)
    .map((line, i) => ({ n: FIRST + i + 1, line }))
    .filter(({ line }) => !isProse(line) && pattern.test(line))
    .map(({ n, line }) => `${n}: ${line.trim()}`)
}

describe('the soft register does not come back', () => {
  // Tests: no fully-round shape survives outside the two that earned it
  // How:   greps the component layer for 9999px
  // Chain: the pill radius was the loudest single tell that a page had not
  //        been through the Pixel pass. .chip and .step-pill keep a 20px pill
  //        via --radius-pixel-chip, which is a token, not a literal.
  it('has no 9999px left in the component layer', () => {
    expect(declarationsMatching(/9999px/)).toEqual([])
  })

  // Tests: no blurred depth cue survives
  // How:   greps for --shadow-rest / --shadow-lift outside @theme
  // Chain: a blurred halo under a bordered box is the "ghost card" look the
  //        foundation replaced. Both tokens still exist and are still defined;
  //        nothing in the component layer may consume them.
  it('consumes neither blurred shadow token', () => {
    expect(declarationsMatching(/var\(--shadow-(rest|lift)\)/)).toEqual([])
  })

  // Tests: no literal corner radius survives
  // How:   greps for border-radius with a rem/px literal, allowing the tokens
  // Chain: the board draws six radii and they are all tokenised. A literal is
  //        by definition outside the vocabulary, which is how 14px, 12px,
  //        1.25rem and 0.35rem all ended up in a file that had a scale.
  it('sets every corner from the radius scale, never a literal', () => {
    const literals = declarationsMatching(/border[a-z-]*radius:\s*(?!var\()/)
      // 0 and none are not literals from the scale; they are the absence of one.
      .filter((l) => !/:\s*(0|none);/.test(l))
    expect(literals).toEqual([])
  })

  // Tests: no hairline border in --color-line survives on a surface
  // How:   greps for the 1px --color-line pair
  // Chain: --color-line is still right for a divider (divide-line, border-top
  //        on the composer). It is not right for the edge of a box, which is
  //        what .card-flat and .chat-bubble-theirs used it for.
  it('draws no box edge as a --color-line hairline', () => {
    expect(declarationsMatching(/border:\s*1(\.5)?px solid var\(--color-line\)/)).toEqual([])
  })
})
```

- [x] **Step 3: Run it**

Run: `cd packages/web && npx vitest run tests/unit/app/soft-register.test.ts`
Expected: PASS, if Tasks 1–11 are complete.

**If it fails, read the output rather than relaxing the assertion.** Each
failure prints the exact `line: declaration` that survived. Every one is
either a family this plan missed — fix the CSS — or a deliberate exception
that needs a named carve-out and a comment saying why. Do not add a blanket
`.filter()` to make it green.

- [x] **Step 4: Verify the test can actually fail**

Temporarily change any one `border-radius: var(--radius-pixel)` back to
`border-radius: 1rem`, re-run, confirm the third test reports that exact line,
then revert. A guard nobody has seen fail is a guard nobody knows works.

- [x] **Step 5: Run the full suite plus types and lint**

Run: `cd packages/web && npx vitest run tests/unit && npx tsc --noEmit && npx eslint .`
Expected: all PASS.

---

### Task 13: Entity headings take `.title-detail`

**Files:**
- Modify: `packages/web/app/dashboard/toys/[id]/page.tsx:24`
- Modify: `packages/web/app/dashboard/exchanges/[id]/page.tsx:74`
- Modify: `packages/web/app/tutorials/[id]/page.tsx:60`
- Modify: `packages/web/app/tutorials/[id]/edit/page.tsx:297`
- Modify: `packages/web/app/organizations/[id]/page.tsx:90`
- Modify: `packages/web/app/organizations/[id]/projects/[tutorialId]/page.tsx:115`
- Modify: `packages/web/app/admin/review/[id]/page.tsx:89`
- Modify: `packages/web/app/admin/ideas/[id]/page.tsx:112`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**The rule, so no judgement is needed:** if the heading renders an
interpolated name, it is `.title-detail`. That is what
`/contributors/[id]` and `/organizations/[id]/public` already do.

- [x] **Step 1: Find every one of them**

Run:

```bash
cd packages/web
grep -rn '<h1[^>]*className="[^"]*text-2xl font-bold text-ink"' --include="*.tsx" app | grep '{'
```

Expected: the eight lines listed above, each interpolating a name.

- [x] **Step 2: Swap the class, keeping every layout utility**

In each, replace `text-2xl font-bold text-ink` with `title-detail`, leaving
any `mb-*`, `mt-*` or `truncate` in place. For example, in
`app/tutorials/[id]/edit/page.tsx:297`:

```tsx
        <h1 className="truncate title-detail">{tutorial!.title}</h1>
```

and in `app/dashboard/toys/[id]/page.tsx:24`:

```tsx
      <h1 className="mb-6 title-detail">{toy.name}</h1>
```

`.title-detail` sets its own `color: var(--color-ink)`, so `text-ink` is
dropped rather than kept.

- [x] **Step 3: Verify none were missed**

Run the grep from Step 1 again.
Expected: no output.

- [x] **Step 4: Run the suite**

Run: `cd packages/web && npx vitest run`
Expected: PASS. If a test asserts on a heading it does so by text content, not
by class.

---

### Task 14: Single-purpose pages take `.title-article`

**Files:**
- Modify: `packages/web/app/dashboard/toys/new/page.tsx:14`
- Modify: `packages/web/app/upload/page.tsx:63`
- Modify: `packages/web/app/onboarding/contributor-terms/page.tsx:92`
- Modify: `packages/web/app/auth/confirmed/page.tsx:49`
- Modify: `packages/web/app/not-found.tsx:25`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**The rule:** a form, or a single statement, is an article — matching
`/get-involved/submit-an-idea` and `/contact`, which already do this.

- [x] **Step 1: Swap the class in all five**

Replace `text-2xl font-bold text-ink` with `title-article`, keeping layout
utilities. For example, `app/upload/page.tsx:63`:

```tsx
      <h1 className="mb-2 title-article">New tutorial</h1>
```

- [x] **Step 2: Run the suite**

Run: `cd packages/web && npx vitest run`
Expected: PASS.

---

### Task 15: Every remaining rail heading takes `.title-hub`

**Files:** the 19 remaining `<h1>` call sites across 14 pages —

- `app/dashboard/tutorials/page.tsx:37`
- `app/dashboard/toys/page.tsx:27`
- `app/dashboard/exchanges/page.tsx:106`
- `app/dashboard/challenges/page.tsx:102`
- `app/dashboard/organisation/page.tsx:60`
- `app/dashboard/organisation/toys/page.tsx:55`
- `app/dashboard/profile/page.tsx:36`
- `app/notifications/page.tsx:39` *(note: `text-xl`, not `text-2xl`)*
- `app/organizations/page.tsx:33` and `:50`
- `app/admin/page.tsx:58`
- `app/admin/organizations/page.tsx:79`
- `app/admin/contributors/page.tsx:18` and `:34`
- `app/admin/spot-check/page.tsx:41`
- `app/admin/review/page.tsx:41` and `:68`
- `app/admin/ideas/page.tsx:37` and `:53`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**Watch for the pairs.** Five of these pages carry *two* `<h1>`s — a loading
state and a loaded one (`organizations`, `admin/contributors`, `admin/review`,
`admin/ideas`). Both must move, or the heading resizes as the page settles.

- [x] **Step 1: Swap the class in all nineteen**

Replace `text-2xl font-bold text-ink` (and, on `/notifications`,
`text-xl font-bold text-ink`) with `title-hub`, keeping layout utilities:

```tsx
          <h1 className="title-hub">My tutorials</h1>
```

- [x] **Step 2: Verify nothing is left in the old register**

Run:

```bash
cd packages/web
grep -rn '<h1[^>]*className="[^"]*text-\(xl\|2xl\|3xl\)' --include="*.tsx" app
```

Expected: no output.

- [x] **Step 3: Run the full suite, types and lint**

Run: `cd packages/web && npx vitest run tests/unit && npx tsc --noEmit && npx eslint .`
Expected: all PASS.

- [x] **Step 4: Checkpoint — the visual pass**

The spec asks for this explicitly, because Phase 1 of the page-template walk
shipped without one and the project's memory records that as a gap.

At 375 / 768 / 1280, signed in: `/dashboard/tutorials` (cards, stat strip,
heading), `/tutorials/[id]/edit` (panels, stepper, sticky bar, toast),
`/dashboard/exchanges/[id]` (the whole chat register), `/notifications` (flat
rows), `/upload` (dropzone), and any page in an empty state. Then `/contact`
and `/impact` signed out, for the public stragglers.

Report what you see. Density on the list surfaces is the thing most likely to
need a second look.

---

## Phase 4 — Optional

### Task 16: Collapse `.card-pixel` into `.card`

**Files:**
- Modify: `packages/web/app/globals.css` (`.card-pixel`, `.card-pixel-lead`,
  and their two press-motion rules)
- Modify: `packages/web/components/tutorial-card.tsx:20`
- Modify: `packages/web/components/toy-library-card.tsx:15`
- Modify: `packages/web/components/hub-grid.tsx:58`
- Modify: `packages/web/components/launcher-grid.tsx:58-59`
- Modify: `packages/web/components/impact-card.tsx:24`
- Modify: `packages/web/components/auth-shell.tsx:66`
- Modify: `packages/web/tests/unit/components/launcher-grid.test.tsx:56`
- Modify: `packages/web/tests/unit/components/auth-shell.test.tsx:79`
- Modify: `packages/web/tests/unit/components/hub-grid.test.tsx:46,67`
- Modify: `packages/web/tests/unit/pages/saved-hub.test.tsx:103`
- Modify: `packages/web/tests/unit/pages/dashboard-hub.test.tsx:169`
- Modify: `packages/web/tests/unit/lib/press-motion.test.ts:63-64`

**Interfaces:**
- Consumes: Task 1's `.card`.
- Produces: `.card-lead` replaces `.card-pixel-lead`. `.card-pixel` no longer
  exists.

**Ask Byron before starting this task.** It is the only mechanical rename in
the plan and the only part that touches tests for a non-behavioural reason.
Everything above stands without it. It is worth doing because two names for
one object is the condition that produced this whole spec — but it is his
call, and the spec says so.

- [x] **Step 1: Confirm `.card` and `.card-pixel` are byte-identical**

Run:

```bash
cd packages/web
grep -A 6 '^  \.card {' app/globals.css
grep -A 6 '^  \.card-pixel {' app/globals.css
```

Expected: the same four declarations in both. **If they differ, stop** — Task 1
did not land as specified, and renaming on top of a divergence would silently
change six call sites.

- [x] **Step 2: Rename the call sites**

Run:

```bash
cd packages/web
grep -rl 'card-pixel' --include="*.tsx" --include="*.ts" app components tests \
  | xargs sed -i '' -e 's/card-pixel-lead/card-lead/g' -e 's/card-pixel/card/g'
```

Then read every changed line. `sed` will also have rewritten the prose in
`components/auth-shell.tsx:62` and the comments in
`tests/unit/components/auth-shell.test.tsx:72-75`, which now say "an ordinary
.card rests at" — that reads correctly, but check it rather than assume.

- [x] **Step 3: Delete the duplicate definition**

In `globals.css`, delete the whole `.card-pixel` block (its comment now lives
on `.card`), and rename `.card-pixel-lead` to `.card-lead`.

- [x] **Step 4: Collapse the press-motion rules**

Replace:

```css
  .pixel .card {
    --pop-rest: 5px;
  }

  .pixel .card-pixel {
    --pop-rest: 5px;
  }

  .pixel .card-pixel-lead {
    --pop-rest: 6px;
  }
```

with:

```css
  .pixel .card {
    --pop-rest: 5px;
  }

  /* After .card, and both score (0,2,0), so source order is what puts the
     pillar a rung deeper. Do not move it above .card. */
  .pixel .card-lead {
    --pop-rest: 6px;
  }
```

- [x] **Step 5: Update the press-motion assertions**

In `tests/unit/lib/press-motion.test.ts`:

```ts
    expect(restFor('.pixel .card {')).toBe(5)
    expect(restFor('.pixel .card-lead')).toBe(6)
```

- [x] **Step 6: Verify nothing references the old names**

Run: `cd packages/web && grep -rn 'card-pixel' app components tests`
Expected: no output.

- [x] **Step 7: Run everything**

Run: `cd packages/web && npx vitest run tests/unit && npx tsc --noEmit && npx eslint .`
Expected: all PASS.

- [x] **Step 8: Run the set-diff**

Expected: `< .card-pixel {`, `< .card-pixel-lead {`,
`< .pixel .card-pixel {`, `< .pixel .card-pixel-lead {`, `> .card-lead {`,
`> .pixel .card-lead {`. Nothing else.

---

## Done criteria

- `npx vitest run tests/unit` green, `npx tsc --noEmit` clean, `npx eslint .` clean.
- `tests/unit/app/soft-register.test.ts` passes, and has been seen to fail.
- The set-diff shows only the selector changes this plan predicts, and **zero**
  removed custom properties.
- `git diff --stat` touches no file under `components/rail.tsx`,
  `components/nav.tsx`, or the `.shell*` / `.pixel header` / `.nav-pill` rules.
- The visual pass in Task 15 Step 4 has been done and reported.
- Nothing is committed. Tell Byron what is in the working tree and let him
  decide — one file per commit, ordered, when he asks.

---

## Execution notes, 2026-08-29

All sixteen tasks landed. `vitest run tests/unit` 908 passing across 125 files,
`tsc --noEmit` clean, `eslint` clean, and the set-diff shows **zero** custom
properties removed.

Five things the plan got wrong, corrected while running it:

1. **The test command.** The plan said `npx vitest run`, which collects the
   Playwright specs under `tests/e2e` and reports 29 failing files. The
   project's own command is `test:unit` — `vitest run tests/unit`. Fixed
   throughout.
2. **`.card-tint` and the stale-comment assertions both self-tripped.** Each
   grepped for a literal string that the replacement comment then quoted while
   explaining the removal. Both now assert the *rule* or the original claim
   rather than a phrase a note might legitimately repeat. Worth remembering:
   a text-grep guard on a file that documents its own history will match its
   own footnotes.
3. **The soft-register regex was wrong and passed nothing.**
   `border[a-z-]*radius:\s*(?!var\()` backtracks `\s*` to zero width and tests
   the lookahead against the space, so all 34 correctly tokenised declarations
   were reported as literals. The lookahead has to sit against the colon:
   `border[a-z-]*radius:(?!\s*var\()`. Mutation-checked afterwards — it names
   the exact line and reverts clean.
4. **`.mark` needed tokenising, which the spec had not noticed.** Its
   `border-radius: 0.5rem` was already 8px, i.e. `--radius-pixel-sm` written as
   a literal. No visual change; the sweep guard cannot pass without it.
5. **The mockup was wrong about the chat bubbles, and the implementation is
   right.** The mockup's `.proposed` override set `border-radius:
   var(--radius-pixel)` as a shorthand, which silently flattened the tail
   corners. The shipped CSS sets the tails separately at `--radius-pixel-xs`,
   as the spec specifies, so the bubbles keep their tails. Verified by
   compiling the shipped stylesheet and diffing computed styles against the
   approved mockup: 23 of 26 elements identical, the two bubble differences
   being this, and the third being `.dialog-static`, a mockup-only class whose
   real counterpart `.dialog-panel` was confirmed correct directly.

Nothing is committed, per Byron's convention.
