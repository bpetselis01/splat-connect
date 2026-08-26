# Pixel Page-Template Walk — Phase 1: Shared Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the display font to numerals-only, extend the token scale to
everything the board draws, and bring the shared card/chip/badge/art-slot layer
onto the board — so all seven hub pages render as drawn.

**Architecture:** Pure styling. There is **no structural change** in this phase:
no new components, no nav-model change, no new routes. Every hub page already
splits its children into the board's groups under the board's own headings, so
the work is confined to `globals.css`, three components (`slot.tsx`,
`hub-grid.tsx`, `breadcrumb.tsx`), and the two call sites that pass a prop being
deleted.

**Tech Stack:** Next.js App Router, React 19, Tailwind v4 (`@layer components` in
`app/globals.css`), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-27-pixel-page-templates-design.md`
**Artboard (the source of truth):** `docs/superpowers/specs/2026-08-27-pixel-home-artboard.dc.html`

## Global Constraints

- **The artboard wins over the 2026-08-26 spec, always.** Where they disagree,
  implement the artboard. Re-read the artboard when implementing each task; do
  not reconstruct values from prose.
- **The palette does not change.** Every hex in the board already exists as a
  custom property in `app/globals.css`. Add no colour except
  `--color-placeholder: #8aa7b8`.
- **Jersey 10 is a numeral face.** It appears exactly 3 times in the whole board,
  all of them the homepage hero stat-chip numerals at 22px/700. Every heading on
  every screen is Nunito. Never put `--font-display` on a heading.
- **The board's depth ladder is `6px` / `5px` / `4px` / `3px`, always
  `Npx Npx 0`.** No element rests at 2px — that is the pressed state only.
- **The board's radii are `10` / `8` / `6` / `20` / `4` / `2`.** Filter chips keep
  `20px` and are explicitly excluded from the `9999px` sweep.
- **Border weights: `3px` structural, `2px` chip/input, `1px` SOON badge**, plus
  `2px`/`3px` dashed for art slots.
- **No decorative rotation.** `transform: rotate(180deg)` at
  `app/globals.css:882` is the `<details>` disclosure chevron and is
  **functional — keep it.** The decorative rotations are `.lean` (`:348`) and
  `.pixel .nav-pill:hover` (`:546`); both are removed in Phase 3, not here.
- **Accessibility is non-negotiable:** every tone pair ≥4.5:1 for body text and
  ≥3:1 for large text, asserted in-test; `prefers-reduced-motion` honoured with
  a designed fallback, never a dead stop; art slots stay `aria-hidden` and
  `pointer-events-none`; focus rings preserved.
- **`NEXT_PUBLIC_SLOTS=off` must keep hiding every unfilled slot.** Do not break
  the `SLOTS_VISIBLE` guard.
- The existing unit suite stays green throughout. Run
  `pnpm --filter @splat-connect/web test:unit` before every commit.

---

### Task 1: Correct Jersey 10 to a numeral face

The foundation put the display font on two headings. The board puts it on three
numerals and nothing else. This is the single largest reason the site reads as a
different design.

**Files:**
- Modify: `packages/web/app/globals.css:310-316` (`.title-hero`), `:535-541` (`.pixel .step-pixel`)
- Modify: `packages/web/app/page.tsx` (the three hero stat values)
- Test: `packages/web/tests/unit/app/pixel-tokens.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: a `.numeral` component class —
  `font-family: var(--font-display); font-weight: 700; line-height: 1;` — the
  only sanctioned use of `--font-display` anywhere in the codebase. Later tasks
  and phases must use `.numeral` and never `--font-display` directly.

- [ ] **Step 1: Write the failing test**

Add to `packages/web/tests/unit/app/pixel-tokens.test.ts`, inside the existing
`describe('pixel depth tokens', ...)` block:

```ts
  /*
   * Jersey 10 is a numeral face, not a display face. Across all twelve screens
   * of the artboard it appears exactly three times — the homepage hero stat
   * chips, at 22px/700 — and every h1, h2 and h3 on every screen is Nunito.
   * The foundation pass read the 2026-08-26 spec ("display font, headings
   * only") rather than the board, and put it on the hero headline and the step
   * badges. See 2026-08-27-pixel-page-templates-design.md, Corrections §1.
   */
  it('keeps the display face off the headings', () => {
    const hero = css.match(/\.title-hero \{[^}]*\}/)?.[0] ?? ''
    expect(hero).not.toContain('--font-display')

    const step = css.match(/\.pixel \.step-pixel \{[^}]*\}/)?.[0] ?? ''
    expect(step).not.toContain('--font-display')
  })

  it('gives the display face exactly one home: the numeral class', () => {
    const numeral = css.match(/\.numeral \{[^}]*\}/)?.[0] ?? ''
    expect(numeral).toMatch(/font-family:\s*var\(--font-display\)/)

    // Exactly one consumer. The token's own definition reads
    // `--font-display: var(--font-jersey), ...` and so does not match this
    // pattern — .numeral is the only hit there should ever be.
    const uses = css.match(/var\(--font-display\)/g) ?? []
    expect(uses).toHaveLength(1)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @splat-connect/web exec vitest run tests/unit/app/pixel-tokens.test.ts
```

Expected: FAIL. `keeps the display face off the headings` fails because
`.title-hero` still contains `--font-display`; `gives the display face exactly
one home` fails because `.numeral` does not exist yet.

- [ ] **Step 3: Remove the display face from both headings**

In `packages/web/app/globals.css`, `.title-hero` becomes:

```css
  .title-hero {
    font-size: clamp(2.4rem, 6vw, 3.9rem);
    font-weight: 900;
    line-height: 1.03;
    letter-spacing: -0.03em;
  }
```

And `.pixel .step-pixel` — replace the whole rule *and its docstring's last
sentence*, which currently justifies the display face:

```css
  /*
   * The numbered steps in "SPLAT in 30 seconds".
   *
   * Rounded squares, not discs. Every other round thing on the page is a
   * sticker or a photo slot — art — so drawing the step numbers as circles put
   * them in the wrong family, reading as three more decorations rather than as
   * an ordered list.
   *
   * Set in Nunito 900, as the board draws them. An earlier pass set them in the
   * display face on the theory that "a number that is doing work gets the face
   * that makes numbers look like numbers" — but the board reserves that face
   * for the three hero stat chips alone, and a step badge is an ordinal, not a
   * quantity.
   */
  .pixel .step-pixel {
    border-radius: var(--radius-pixel-sm);
    border: var(--border-pixel-thin) solid var(--color-brand-dark);
    background-color: var(--color-brand-tint);
    color: var(--color-brand-dark);
    font-weight: 900;
  }
```

- [ ] **Step 4: Add the `.numeral` class**

In `packages/web/app/globals.css`, directly after the `.pixel .stat-pixel` rule
(around `:494-498`):

```css
  /*
   * The only place Jersey 10 appears on the site.
   *
   * Three uses, all of them the homepage hero's stat-chip numerals — guides,
   * toys delivered, contributors. The board sets them at 22px/700 and sets
   * literally everything else, headings included, in Nunito. A bitmap face
   * reads as a quantity rendered by a machine, which is what these three are;
   * a headline set the same way just reads as a different website.
   */
  .numeral {
    font-family: var(--font-display);
    font-weight: 700;
    line-height: 1;
  }
```

- [ ] **Step 5: Apply `.numeral` to the three hero stat values**

In `packages/web/app/page.tsx`, in the stat chip `<li>`, replace the value span:

```tsx
                    <span className="numeral text-[22px]">{stat.value}</span>
```

(It currently reads `className="text-lg font-black leading-none"`. `.numeral`
supplies the weight and line-height; `text-[22px]` is the board's size.)

- [ ] **Step 6: Run the tests to verify they pass**

```bash
pnpm --filter @splat-connect/web exec vitest run tests/unit/app/pixel-tokens.test.ts
pnpm --filter @splat-connect/web test:unit
```

Expected: PASS, and the full suite green.

- [ ] **Step 7: Commit**

```bash
git add packages/web/app/globals.css packages/web/app/page.tsx \
        packages/web/tests/unit/app/pixel-tokens.test.ts
git commit -m "fix(web): Jersey 10 is a numeral face, not a display face

The board uses it 3 times across 12 screens, all of them the homepage hero
stat chips. Every heading it draws is Nunito. The foundation pass followed the
2026-08-26 spec's 'headings only' instead of the board and put it on
.title-hero and .step-pixel."
```

---

### Task 2: Extend the token scale to what the board actually draws

The foundation shipped two radii. The board draws six, two border weights where
it draws three, and one untokenised colour.

**Files:**
- Modify: `packages/web/app/globals.css:59-86` (the token block)
- Test: `packages/web/tests/unit/app/pixel-tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `--radius-pixel-chip: 20px`, `--radius-pixel-slot: 6px`,
  `--radius-pixel-xs: 4px`, `--radius-pixel-hair: 2px`,
  `--border-pixel-hair: 1px`, `--color-placeholder: #8aa7b8`. Tasks 3–6 and
  Phases 2–3 consume these by name.

- [ ] **Step 1: Write the failing test**

Replace the existing `defines both pixel radii` test in
`packages/web/tests/unit/app/pixel-tokens.test.ts` with:

```ts
  /*
   * Six radii, because the artboard draws six. Counted from the artboard:
   * 10px ×28 (cards, empty states), 8px ×21 (buttons, avatars, step badges),
   * 6px ×15 (art slots, inputs), 20px ×9 (filter chips), 4px ×7 (SOON badge),
   * 2px ×4 (the smallest ticks).
   */
  it('defines the full pixel radius scale', () => {
    expect(css).toMatch(/--radius-pixel:\s*10px/)
    expect(css).toMatch(/--radius-pixel-sm:\s*8px/)
    expect(css).toMatch(/--radius-pixel-slot:\s*6px/)
    expect(css).toMatch(/--radius-pixel-chip:\s*20px/)
    expect(css).toMatch(/--radius-pixel-xs:\s*4px/)
    expect(css).toMatch(/--radius-pixel-hair:\s*2px/)
  })

  it('defines all three pixel border weights', () => {
    expect(css).toMatch(/--border-pixel:\s*3px/)
    expect(css).toMatch(/--border-pixel-thin:\s*2px/)
    expect(css).toMatch(/--border-pixel-hair:\s*1px/)
  })

  /*
   * The one value in the artboard with no existing token. Every other hex it
   * uses — including #dcedf6, #bfe4f5 and #c6e0ed, which look unusual — is
   * already --color-sunken / --color-brand-soft / --color-line.
   */
  it('tokenises the input placeholder colour', () => {
    expect(css).toMatch(/--color-placeholder:\s*#8aa7b8/)
    expect(css).toMatch(/::placeholder\s*\{[^}]*var\(--color-placeholder\)/)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @splat-connect/web exec vitest run tests/unit/app/pixel-tokens.test.ts
```

Expected: FAIL — `--radius-pixel-slot`, `--radius-pixel-chip`,
`--radius-pixel-xs`, `--radius-pixel-hair`, `--border-pixel-hair` and
`--color-placeholder` are all undefined.

- [ ] **Step 3: Add the tokens**

In `packages/web/app/globals.css`, replace the radius comment and pair with:

```css
  /* Six radii, because the board draws six — this is not a scale invented for
     tidiness. Cards and empty states sit at 10px; buttons, avatars and step
     badges at 8px; art slots and inputs at 6px; the SOON badge at 4px; the
     smallest ticks at 2px. And filter chips stay at 20px: they are the one
     place the pill survives the sweep away from 9999px, because the board
     draws them that way. */
  --radius-pixel: 10px;
  --radius-pixel-sm: 8px;
  --radius-pixel-slot: 6px;
  --radius-pixel-chip: 20px;
  --radius-pixel-xs: 4px;
  --radius-pixel-hair: 2px;
```

And extend the border weights — the existing comment stays, add one line and
amend its first sentence to say three:

```css
  /* Three weights, because the board draws three. 3px is the structural line —
     what a card, a control or the nav shelf is built from. 2px is the chip
     register: stat chips, avatars, step badges, art slots. 1px is the SOON
     badge alone, which is small enough that 2px closes up its interior. */
  --border-pixel: 3px;
  --border-pixel-thin: 2px;
  --border-pixel-hair: 1px;
```

Add the colour beside the other colour tokens (after `--color-danger` /
`--color-success`, around `:57`):

```css
  /* The one hex in the board with no existing token. Input placeholders only. */
  --color-placeholder: #8aa7b8;
```

- [ ] **Step 4: Wire the placeholder colour**

In `packages/web/app/globals.css`, inside `@layer base`, after the `body` rule:

```css
  input::placeholder,
  textarea::placeholder {
    color: var(--color-placeholder);
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --filter @splat-connect/web exec vitest run tests/unit/app/pixel-tokens.test.ts
pnpm --filter @splat-connect/web test:unit
```

Expected: PASS, full suite green.

- [ ] **Step 6: Commit**

```bash
git add packages/web/app/globals.css packages/web/tests/unit/app/pixel-tokens.test.ts
git commit -m "feat(web): extend the pixel token scale to the board's six radii

Counted off the artboard: 10/8/6/20/4/2 radii, 3/2/1 border weights, and
#8aa7b8 for input placeholders — the only hex in the board with no token."
```

---

### Task 3: Chips and badges onto the board

`.chip` is still a `9999px` pill with a 1px hairline; `.badge` is still a
`9999px` pill. The board draws both quite differently, and the chip is the one
element that keeps a pill radius.

**Files:**
- Modify: `packages/web/app/globals.css:780-818` (`.chip` family), `:820-829` (`.badge`)
- Modify: `packages/web/components/nav.tsx` (the unread-count badge's size)
- Test: `packages/web/tests/unit/app/pixel-tokens.test.ts`

**Interfaces:**
- Consumes: `--radius-pixel-chip`, `--radius-pixel-xs`, `--border-pixel-thin`,
  `--border-pixel-hair`, `--shadow-pixel-xs` from Task 2.
- Produces: `.chip` and `.badge` in their board form. Callers are unchanged —
  every existing `className="chip"` / `"badge"` call site keeps working, and
  `.badge`'s tone colours still come from the caller
  (e.g. `badge bg-honey-soft text-honey-deep`).

- [ ] **Step 1: Write the failing test**

Add to `packages/web/tests/unit/app/pixel-tokens.test.ts`:

```ts
  /*
   * The filter chip is the one element that keeps a pill radius — the board
   * draws it at 20px while everything else came down to the 10/8/6/4 scale.
   * Its two states are drawn as a contrast, not a tint shift: inactive is
   * white and stands off the page on a 3px shadow, active is an ink fill lying
   * flat with no shadow at all.
   */
  it('draws the filter chip as the board does', () => {
    const chip = css.match(/\.chip \{[^}]*\}/)?.[0] ?? ''
    expect(chip).toMatch(/border-radius:\s*var\(--radius-pixel-chip\)/)
    expect(chip).toMatch(/border:\s*var\(--border-pixel-thin\) solid var\(--color-ink\)/)
    expect(chip).toMatch(/box-shadow:\s*var\(--shadow-pixel-xs\) var\(--color-ink\)/)
    expect(chip).not.toContain('9999px')

    const active = css.match(/\.chip\[aria-pressed='true'\] \{[^}]*\}/)?.[0] ?? ''
    expect(active).toMatch(/background-color:\s*var\(--color-ink\)/)
    expect(active).toMatch(/box-shadow:\s*none/)
  })

  it('draws the badge as the board draws SOON', () => {
    const badge = css.match(/\.badge \{[^}]*\}/)?.[0] ?? ''
    expect(badge).toMatch(/border-radius:\s*var\(--radius-pixel-xs\)/)
    expect(badge).toMatch(/border:\s*var\(--border-pixel-hair\) solid currentColor/)
    expect(badge).not.toContain('9999px')
  })

  /* The board has no scale transform anywhere; a chip presses the same way a
     button does — it travels its own shadow offset and the edge disappears. */
  it('presses the chip by collapsing its shadow, not by scaling it', () => {
    const active = css.match(/\.chip:active \{[^}]*\}/)?.[0] ?? ''
    expect(active).not.toContain('scale(')
    expect(active).toMatch(/translate\(3px, 3px\)/)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @splat-connect/web exec vitest run tests/unit/app/pixel-tokens.test.ts
```

Expected: FAIL — `.chip` still has `border-radius: 9999px` and a
`1px solid var(--color-line)` border; `.chip:active` still has
`transform: scale(0.97)`; `.badge` still has `border-radius: 9999px`.

- [ ] **Step 3: Rewrite the chip family**

In `packages/web/app/globals.css`, replace the `.chip` block through
`.chip[aria-pressed='true']:hover`:

```css
  /* --- Chips (filter toggles) -------------------------------------------
   *
   * The one element that keeps a pill radius. Everything else on the public
   * site came down from 9999px to the 10/8/6/4 scale; the board draws these at
   * 20px and it is right to — a filter is a soft, repeatable, low-stakes
   * control, and squaring it off made a row of them read as a row of buttons.
   *
   * The two states are drawn as a contrast rather than a tint shift: off is
   * white and stands off the page on a 3px shadow, on is a flat ink fill with
   * no shadow at all. A chip that is "on" has been pushed in.
   */
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    padding: 0.5rem 0.875rem;
    background-color: var(--color-surface);
    color: var(--color-ink);
    border: var(--border-pixel-thin) solid var(--color-ink);
    border-radius: var(--radius-pixel-chip);
    box-shadow: var(--shadow-pixel-xs) var(--color-ink);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    transition:
      background-color 140ms var(--ease-out-quart),
      color 140ms var(--ease-out-quart),
      box-shadow 140ms var(--ease-out-quart),
      transform 140ms var(--ease-out-quart);
  }

  .chip:hover {
    background-color: var(--color-sunken);
  }

  /* Travels its own shadow offset, so the edge sinks into the surface — the
     same press the buttons and cards use. No scale: the board has none. */
  .chip:active {
    transform: translate(3px, 3px);
    box-shadow: 0 0 0 var(--color-ink);
  }

  .chip[aria-pressed='true'] {
    background-color: var(--color-ink);
    border-color: var(--color-ink);
    color: #ffffff;
    box-shadow: none;
  }

  .chip[aria-pressed='true']:hover {
    background-color: var(--color-brand-deep);
    border-color: var(--color-brand-deep);
  }

  @media (prefers-reduced-motion: reduce) {
    .chip:active {
      transform: none;
      box-shadow: var(--shadow-pixel-sm) var(--color-ink);
    }
  }
```

- [ ] **Step 4: Rewrite the badge**

```css
  /* --- Badges -----------------------------------------------------------
   *
   * The board draws exactly one: SOON. A 1px edge in the caller's own text
   * colour, a 4px radius, and mono at 9px — small enough that 2px would close
   * up its interior, which is why this is the only 1px border on the site.
   * Tone colours stay with the caller (`badge bg-honey-soft text-honey-deep`),
   * so `currentColor` picks the edge up for free.
   */
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 7px;
    border: var(--border-pixel-hair) solid currentColor;
    border-radius: var(--radius-pixel-xs);
    font-family: var(--font-mono);
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
  }
```

- [ ] **Step 5: Keep the nav's unread count legible**

`.badge` now ships at 9px, which is right for the board's SOON chip on a card
but too small for the notification count in the top bar — that is not a board
element (the board's nav has no unread badge) and 9px numerals in chrome sit
below this site's own floor. Give that one call site its own size.

In `packages/web/components/nav.tsx`, the unread-count badge becomes:

```tsx
                  <span aria-hidden="true" className="badge bg-apricot text-apricot-deep text-[11px]">
                    {caps.unreadNotifications}
                  </span>
```

Leave `difficulty-badge.tsx` alone — it renders on cards, which is the density
the board's 9px was measured at.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
pnpm --filter @splat-connect/web exec vitest run tests/unit/app/pixel-tokens.test.ts
pnpm --filter @splat-connect/web test:unit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/web/app/globals.css packages/web/components/nav.tsx \
        packages/web/tests/unit/app/pixel-tokens.test.ts
git commit -m "feat(web): chips and badges onto the board's treatment

Chips keep a pill radius (20px) as the one survivor of the 9999px sweep, and
draw their two states as white-on-shadow vs flat ink fill. Badges take the
board's SOON shape: 1px currentColor edge, 4px radius, mono at 9px."
```

---

### Task 4: A rectangular, tone-coloured art slot

Every child card in the board carries a rectangular dashed art slot in its
section's deep colour. `Slot` currently renders a fixed brand-blue dashed box,
and `Sticker` renders a brand-blue disc.

**Files:**
- Modify: `packages/web/components/slot.tsx`
- Test: `packages/web/tests/unit/components/pixel.test.tsx`

**Interfaces:**
- Consumes: `--radius-pixel-slot` (Task 2), and `toneClass` from
  `packages/web/lib/tone.ts` (existing).
- Produces: `Slot` gains an optional `tone?: Tone` prop. When given, the slot's
  dashed border and label take the tone's deep ink via `border-current`; when
  omitted, the existing brand-blue treatment is unchanged. Task 5 consumes this.

- [ ] **Step 1: Write the failing test**

Add to `packages/web/tests/unit/components/pixel.test.tsx`:

```tsx
import { Slot } from '@/components/slot'

describe('Slot tone', () => {
  /*
   * The board draws a child card's art slot in that section's deep colour —
   * honey on Learn, apricot on 3D Printing — not in a single brand blue. It
   * derives the dash from the label colour via border-current rather than
   * adding a `deepEdge` to ToneSpec, because the two are always the same value
   * and a second token would be a second thing to keep in step.
   */
  it('takes the section colour when given a tone', () => {
    const { container } = render(<Slot kind="art" tone="honey" note="x" />)
    const slot = container.firstElementChild!
    expect(slot.className).toContain('text-honey-deep')
    expect(slot.className).toContain('border-current')
    expect(slot.className).not.toContain('border-brand')
  })

  it('stays brand blue when given no tone', () => {
    const { container } = render(<Slot kind="art" note="x" />)
    expect(container.firstElementChild!.className).toContain('border-brand')
  })

  /* Placeholders never reach a screen reader or swallow a click. */
  it('is decorative in every tone', () => {
    const { container } = render(<Slot kind="art" tone="mint" note="x" />)
    const slot = container.firstElementChild!
    expect(slot).toHaveAttribute('aria-hidden', 'true')
    expect(slot.className).toContain('pointer-events-none')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @splat-connect/web exec vitest run tests/unit/components/pixel.test.tsx
```

Expected: FAIL — `Slot` has no `tone` prop, so `text-honey-deep` is absent and
TypeScript rejects the prop.

- [ ] **Step 3: Add the tone prop to `Slot`**

In `packages/web/components/slot.tsx`, add the import:

```tsx
import { toneClass, type Tone } from '@/lib/tone'
```

and replace the `Slot` function:

```tsx
export function Slot({
  kind,
  tone,
  note,
  className = '',
}: {
  kind: Exclude<SlotKind, 'sticker'>
  /**
   * The section this slot sits in. The board draws a child card's art slot in
   * that section's deep colour — honey on Learn, apricot on 3D Printing — so a
   * slot inside a tinted card belongs to the card rather than floating on it.
   * Omit on the canvas, where the brand-blue placeholder treatment is right.
   */
  tone?: Tone
  /** The brief: what belongs here, in a few words. */
  note: string
  className?: string
}) {
  if (!SLOTS_VISIBLE) return null

  // border-current rather than a `deepEdge` entry on ToneSpec: the dash and the
  // label are always the same colour on the board, and a second token would be
  // a second thing to keep in step with the first.
  const edge = tone
    ? `${toneClass(tone).ink} border-current`
    : 'border-brand text-brand-deep'

  return (
    <span
      aria-hidden="true"
      // Translucent white rather than the brand tint: these sit inside tinted
      // cards as well as on the canvas, and a blue fill laid over an apricot
      // pillar read as a stain rather than as a held space. White at 50% — the
      // board's own value — lightens whatever is under it without arguing with
      // its hue.
      className={`pointer-events-none flex flex-col items-center justify-center gap-1 rounded-[var(--radius-pixel-slot)] border-2 border-dashed bg-surface/50 p-3 text-center ${edge} ${className}`.trim()}
    >
      <span className="meta">{KIND_LABEL[kind]}</span>
      <span className="max-w-[22ch] text-[11px] leading-tight opacity-85">{note}</span>
    </span>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter @splat-connect/web exec vitest run tests/unit/components/pixel.test.tsx
pnpm --filter @splat-connect/web test:unit
```

Expected: PASS. `launcher-grid.test.tsx` also renders `Slot`; it passes no
`tone`, so it keeps the brand-blue branch and stays green.

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/slot.tsx packages/web/tests/unit/components/pixel.test.tsx
git commit -m "feat(web): Slot takes the section's colour

The board draws each child card's art slot in that section's deep colour, not
in one brand blue. Derived from the label colour via border-current so there is
no second token to keep in step."
```

---

### Task 5: `HubGrid` onto the board

Every card takes the section tint, each carries a rectangular art slot, and the
lead-card and arrow mechanics are deleted. The board has neither.

**Files:**
- Modify: `packages/web/components/hub-grid.tsx`
- Modify: `packages/web/app/learn/page.tsx` (drops `leadFirst={false}`)
- Modify: `packages/web/app/get-involved/page.tsx` (drops `leadFirst={false}`)
- Modify: `packages/web/app/impact/page.tsx`, `packages/web/app/about/page.tsx` (add `columns={4}`)
- Test: `packages/web/tests/unit/components/hub-grid.test.tsx`

**Interfaces:**
- Consumes: `Slot` with `tone` (Task 4); `--radius-pixel-slot` (Task 2).
- Produces: `HubGrid({ items, tone, columns })`. The `art` and `leadFirst` props
  are **removed**. `columns?: 3 | 4` defaults to `3`. At 3 columns the art slot
  is `7.5rem` (120px), the title `15px`, the blurb `13px`; at 4 columns,
  `6.25rem` (100px), `14px`, `12px` — the board's two sizes.

- [ ] **Step 1: Write the failing test**

Replace `packages/web/tests/unit/components/hub-grid.test.tsx`'s tilt test and
add the board assertions:

```tsx
  /*
   * The board tints every child card, not just the first. HubGrid used to tint
   * only a "lead" card and leave its siblings white, on the reasoning that a
   * six-card hub all in one hue reads as "a wall of one hue". That was sound
   * about a flat six-card grid and does not apply here: every hub page already
   * splits its children into labelled groups, so no grid on the site renders
   * more than four cards. See the spec, "Grouped hub children — already done".
   */
  it('tints every card, not just the first', () => {
    const { container } = render(<HubGrid items={items} tone="honey" />)
    const cards = container.querySelectorAll('a.card-pixel')
    expect(cards).toHaveLength(2)
    for (const card of cards) {
      expect(card.className).toContain('bg-honey-soft')
    }
  })

  it('gives every card a tone-coloured art slot', () => {
    const { container } = render(<HubGrid items={items} tone="honey" />)
    const slots = container.querySelectorAll('[aria-hidden="true"].border-dashed')
    expect(slots).toHaveLength(2)
    for (const slot of slots) {
      expect(slot.className).toContain('text-honey-deep')
    }
  })

  /* The board draws no arrow on a hub child card, and no card is wider than
     any other — both were this component's own inventions. */
  it('draws no arrow and no wide lead card', () => {
    const { container } = render(<HubGrid items={items} tone="honey" />)
    expect(container.textContent).not.toContain('→')
    for (const cell of container.querySelectorAll('a.card-pixel')) {
      expect(cell.parentElement?.className).not.toContain('col-span-2')
    }
  })

  /* Two column counts, because the board draws two — 3-up for the primary
     groups, 4-up for the "more in this section" tails. */
  it('lays out four columns when asked', () => {
    const { container } = render(<HubGrid items={items} tone="honey" columns={4} />)
    expect(container.firstElementChild!.className).toContain('lg:grid-cols-4')
  })

  it('lays out three columns by default', () => {
    const { container } = render(<HubGrid items={items} tone="honey" />)
    expect(container.firstElementChild!.className).toContain('lg:grid-cols-3')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @splat-connect/web exec vitest run tests/unit/components/hub-grid.test.tsx
```

Expected: FAIL — only the first card carries `bg-honey-soft`, the slots are
`Sticker` discs without a tone class, an arrow is present, and `columns` is not
a prop.

- [ ] **Step 3: Rewrite `HubGrid`**

Replace `packages/web/components/hub-grid.tsx` entirely:

```tsx
/**
 * The card grid every hub page uses.
 *
 * This is the component that replaces a dropdown menu: the breadth a menu would
 * have hidden is rendered as a page instead, with room for a sentence per
 * destination that a menu never had.
 *
 * Every card carries its section's colour and a rectangular art slot in that
 * section's deep shade, exactly as the board draws them. An earlier pass tinted
 * only the first card and gave the rest white, arguing that a six-card hub all
 * in one hue reads as monotony rather than identity. That was a fair objection
 * to a flat six-card grid and it does not apply: every hub page already splits
 * its children into labelled groups ("Start here" / "Going deeper"), so no grid
 * on this site renders more than four cards. The condition the objection
 * depended on is not there.
 *
 * There is no lead card and no arrow. Both were this component's own additions;
 * the board draws neither, and the group heading above the grid already does
 * the "read this one first" job the wide card was invented for.
 *
 * The grid carries no transform — cards lay out upright, in source order.
 */
import type { NavItem } from '@/lib/public-nav'
import { toneClass, type Tone } from '@/lib/tone'
import { Slot } from '@/components/slot'
import { BoundaryLink } from '@/components/boundary-link'

export function HubGrid({
  items,
  tone,
  columns = 3,
}: {
  items: NavItem[]
  /** Omit on mixed lists that do not belong to one section. */
  tone?: Tone
  /**
   * The board draws two widths: 3-up for a section's primary groups, 4-up for
   * the "more in this section" tail. The card's art slot, title and blurb all
   * step down a size at 4-up, which is why this is one prop rather than three.
   */
  columns?: 3 | 4
}) {
  if (items.length === 0) return null

  const spec = tone ? toneClass(tone) : undefined
  const wide = columns === 3

  return (
    <div
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
        wide ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
      }`}
    >
      {items.map((item) => (
        <BoundaryLink
          key={item.href}
          href={item.href}
          className={`card-pixel card-link flex h-full flex-col gap-1.5 ${
            wide ? 'p-[18px]' : 'p-4'
          } ${spec ? `${spec.surface} ${spec.ink}` : ''}`}
        >
          <Slot
            kind="art"
            tone={tone}
            note={`${item.label} — one object, no background`}
            className={`mb-1 w-full ${wide ? 'h-[7.5rem]' : 'h-[6.25rem]'}`}
          />

          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`font-extrabold ${wide ? 'text-[15px]' : 'text-[14px]'}`}>
              {item.label}
            </h3>
            {item.state === 'soon' && (
              <span className="badge bg-honey-soft text-honey-deep">SOON</span>
            )}
          </div>

          {/* Always muted, never the tone's own ink: the board keeps the blurb
              at #4d6a7d on every section so the title is the only coloured
              thing in the card and reads first. */}
          <p
            className={`leading-relaxed text-muted ${
              wide ? 'text-[13px]' : 'text-[12px]'
            }`}
          >
            {item.blurb}
          </p>
        </BoundaryLink>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Update the four call sites**

In `packages/web/app/learn/page.tsx`, both `HubGrid` calls lose `art` and
`leadFirst`:

```tsx
      <HubGrid items={startHere} tone={learn.tone} />
```
```tsx
      <HubGrid items={deeper} tone={learn.tone} />
```

In `packages/web/app/get-involved/page.tsx`:

```tsx
      <HubGrid items={tracks} tone={section.tone} />
```
```tsx
      <HubGrid items={actions} tone={section.tone} columns={4} />
```

In `packages/web/app/printing/page.tsx`:

```tsx
      <HubGrid items={printing.children} tone={printing.tone} />
```

In `packages/web/app/impact/page.tsx`:

```tsx
        <HubGrid items={impactSection.children} tone={impactSection.tone} columns={4} />
```

In `packages/web/app/about/page.tsx`:

```tsx
      <HubGrid items={about.children} tone={about.tone} columns={4} />
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --filter @splat-connect/web exec vitest run tests/unit/components/hub-grid.test.tsx
pnpm --filter @splat-connect/web test:unit
```

Expected: PASS. `learn-hub.test.tsx`, `get-involved.test.tsx`,
`impact-hub.test.tsx` and `about.test.tsx` all render these pages — if any
asserts on the arrow or the lead card, update that assertion; those behaviours
are deliberately gone.

- [ ] **Step 6: Verify the section illustrations are genuinely unused**

`HubGrid` no longer takes `art`. Confirm nothing else broke:

```bash
grep -rn "art={" packages/web/app/ packages/web/components/
pnpm --filter @splat-connect/web build
```

Expected: remaining `art=` uses are `LauncherGrid`/`EditorialImage` only, and
the build succeeds. `NavSection.art` stays — the launcher still reads it.

- [ ] **Step 7: Commit**

```bash
git add packages/web/components/hub-grid.tsx packages/web/app/learn/page.tsx \
        packages/web/app/get-involved/page.tsx packages/web/app/printing/page.tsx \
        packages/web/app/impact/page.tsx packages/web/app/about/page.tsx \
        packages/web/tests/unit/components/hub-grid.test.tsx
git commit -m "feat(web): HubGrid onto the board

Every card takes its section tint and a rectangular tone-coloured art slot. The
lead-card and arrow mechanics are deleted — the board draws neither, and the
group heading above each grid already does the job the wide card was invented
for. Adds the board's 4-up variant."
```

---

### Task 6: Hub headings and the way back up

The board sets every hub `h1` at a flat 32px and puts a `← Home` backlink above
it. `Breadcrumb` already exists and is wired globally, but deliberately renders
nothing on a hub.

**Files:**
- Modify: `packages/web/components/breadcrumb.tsx`
- Modify: `packages/web/app/globals.css:318-323` (`.title-hub`)
- Test: `packages/web/tests/unit/components/breadcrumb.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `Breadcrumb` renders `← Home` on a section hub, and its existing
  `← <Section>` on a page inside a section. It still renders nothing on `/`.

- [ ] **Step 1: Write the failing test**

Add to `packages/web/tests/unit/components/breadcrumb.test.tsx` (follow the
file's existing `usePathname` mocking pattern):

```tsx
  /*
   * The board puts "← Home" above the h1 on every hub. This component used to
   * render nothing there, on the reasoning that "you are already at the top of
   * the tree". True of the tree, but the board draws the link anyway and the
   * board wins — a hub is a destination people land on from search, not only
   * from the nav above it.
   */
  it('points home from a section hub', () => {
    mockPathname('/learn')
    render(<Breadcrumb />)
    const link = screen.getByRole('link', { name: /home/i })
    expect(link).toHaveAttribute('href', '/')
  })

  it('still renders nothing on the homepage', () => {
    mockPathname('/')
    const { container } = render(<Breadcrumb />)
    expect(container).toBeEmptyDOMElement()
  })

  it('still points at the section from a page inside it', () => {
    mockPathname('/learn/switch-types')
    render(<Breadcrumb />)
    expect(screen.getByRole('link', { name: /learn/i })).toHaveAttribute('href', '/learn')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @splat-connect/web exec vitest run tests/unit/components/breadcrumb.test.tsx
```

Expected: FAIL on `points home from a section hub` — the component returns
`null` when `pathname === section.href`.

- [ ] **Step 3: Let the hub case render**

In `packages/web/components/breadcrumb.tsx`, amend the docstring paragraph that
reads "Renders nothing on the homepage or on a section hub…" to:

```
 * Renders nothing on the homepage — a link pointing at the page you are on is
 * noise. On a section hub it points Home, as the board draws it: a hub is a
 * page people land on from search as often as from the nav above it, and the
 * board puts "← Home" over every one of them.
```

and replace the guard and the target:

```tsx
export function Breadcrumb() {
  const pathname = usePathname() ?? ''
  if (pathname === '/') return null

  const section = sectionFor(pathname)
  if (!section) return null

  // On the hub itself the way up is Home; inside a section it is the hub.
  const onHub = pathname === section.href
  const href = onHub ? '/' : section.href
  const label = onHub ? 'Home' : section.label
  const tone = toneClass(section.tone)

  return (
    <nav aria-label="Breadcrumb" className="mb-5">
      <BoundaryLink
        href={href}
        className="eyebrow inline-flex items-center gap-2 text-brand-dark transition-colors hover:text-brand-deep"
      >
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${tone.dot}`} />
        <span aria-hidden="true">←</span>
        {label}
```

(The remainder of the JSX is unchanged.)

- [ ] **Step 4: Flatten the hub title to the board's size**

In `packages/web/app/globals.css`:

```css
  /* Flat 32px, not a clamp. The board sets every hub h1 at the same size on
     every screen it draws — the hierarchy between a hub and the homepage is
     carried by the hero band, not by the headline growing. */
  .title-hub {
    font-size: 2rem;
    font-weight: 900;
    line-height: 1.04;
    letter-spacing: -0.02em;
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --filter @splat-connect/web exec vitest run tests/unit/components/breadcrumb.test.tsx
pnpm --filter @splat-connect/web test:unit
```

Expected: PASS, full suite green.

- [ ] **Step 6: Check the seven hubs render**

```bash
pnpm --filter @splat-connect/web build
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add packages/web/components/breadcrumb.tsx packages/web/app/globals.css \
        packages/web/tests/unit/components/breadcrumb.test.tsx
git commit -m "feat(web): hub pages get the board's back-link and flat 32px h1

Breadcrumb points Home from a section hub rather than rendering nothing —
the board draws that link on every hub. Reuses the component already wired
into the layout rather than adding a backlink to seven pages."
```

---

### Task 7: Make the muted blurb legible on every tinted card

`HubGrid` now puts `--color-muted` on a tinted card in all seven sections, which
the old white-card layout never did. On one of them it fails WCAG AA. This task
closes the gap and adds the assertion that stops it reopening.

**The measurements** (computed, not eyeballed — reproduce with the helper in
`tests/unit/lib/tone.test.ts`):

| Section | Card fill | Blurb `#4d6a7d` | Board's title colour |
|---|---|---|---|
| Guides | `#d8ecf7` | 4.70 ✓ | `#0a4f70` — 7.30 ✓ |
| Toy Library | `#d4f2ea` | 4.82 ✓ | `#0f5c4d` — 6.65 ✓ |
| 3D Printing | `#ffe3d5` | 4.68 ✓ | `#8c3312` — 6.62 ✓ |
| Learn | `#fdeecb` | 4.97 ✓ | `#7a4e05` — 6.26 ✓ |
| **Get Involved** | `#bfe4f5` | **4.26 ✗** | **`#0f6f9c` — 4.14 ✗** |
| Impact | `#dcedf6` | 4.76 ✓ | `#0a4f70` — 7.39 ✓ |
| About | `#ffffff` | 5.72 ✓ | `#12283a` — 15.10 ✓ |

Two deviations from the board, both on Get Involved, both forced by the spec's
non-negotiable ≥4.5:1 rule:

1. **The title stays `--color-brand-deep`.** `TONES.sky.ink` is already
   `text-brand-deep` (#0a4f70, 6.61) — this is a **no-op**, recorded so nobody
   later "fixes" it toward the board's `#0f6f9c` and reintroduces a 4.14.
2. **`--color-muted` darkens `#4d6a7d` → `#476376`.** One token, site-wide.
   It clears 4.72 on the worst background and every other surface improves. The
   2026-08-26 spec says the palette is not changing; this is an accessibility
   exception to that, not a design change — the shift is roughly 3% luminance
   and is not perceptible side by side.

**Files:**
- Modify: `packages/web/app/globals.css:37` (`--color-muted`)
- Test: `packages/web/tests/unit/lib/tone.test.ts`

**Interfaces:**
- Consumes: `HubGrid`'s `text-muted` blurb (Task 5).
- Produces: no new API. `--color-muted` changes value only.

- [ ] **Step 1: Write the failing test**

Add to `packages/web/tests/unit/lib/tone.test.ts`, inside `describe('tone', ...)`:

```ts
  /*
   * Pixel puts the muted blurb on a *tinted* card in every section — the old
   * layout only ever set it on white or on the canvas, so this pairing is new
   * and was never covered. Get Involved's #bfe4f5 is the tightest of the seven
   * and is what forced --color-muted one step darker; see Task 7 of
   * docs/superpowers/plans/2026-08-27-pixel-shared-layer.md for the full table.
   */
  const MUTED = '#476376'

  it('keeps the card blurb legible on every tone surface', () => {
    for (const [name, spec] of Object.entries(TONES)) {
      expect(
        ratio(spec.hex.bg, MUTED),
        `${name}: muted blurb on surface`
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps the muted blurb legible on the page canvas', () => {
    expect(ratio('#eaf4fa', MUTED)).toBeGreaterThanOrEqual(4.5)
  })

  /* The constant above has to be what the stylesheet actually ships. */
  it('matches the --color-muted token in globals.css', () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../app/globals.css'),
      'utf8'
    )
    expect(css).toMatch(new RegExp(`--color-muted:\\s*${MUTED}`))
  })
```

and add the imports this needs at the top of the file:

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/tone.test.ts
```

Expected: FAIL twice — `sky: muted blurb on surface` reports 4.26, and
`matches the --color-muted token` fails because the token is still `#4d6a7d`.

- [ ] **Step 3: Darken the token**

In `packages/web/app/globals.css:37`:

```css
  /* One step darker than the #4d6a7d this started at. Pixel sets the muted
     blurb on a tinted card in every section, which the old white-card layout
     never did, and against Get Involved's #bfe4f5 the original reached only
     4.26:1. This clears 4.72 there and improves every other surface. The
     2026-08-26 spec froze the palette; this is an accessibility exception to
     that freeze, not a change of direction. */
  --color-muted: #476376;
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/tone.test.ts
pnpm --filter @splat-connect/web test:unit
```

Expected: PASS, full suite green.

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/globals.css packages/web/tests/unit/lib/tone.test.ts
git commit -m "fix(web): darken --color-muted so the card blurb clears AA

Pixel puts the muted blurb on a tinted card in every section, which the old
white-card layout never did. On Get Involved's #bfe4f5 the original #4d6a7d
reached 4.26:1. #476376 clears 4.72 there and improves every other surface."
```

---

## Phase 1 exit check

Run before handing off:

```bash
pnpm --filter @splat-connect/web test:unit
pnpm --filter @splat-connect/web build
pnpm --filter @splat-connect/web test:e2e   # see the caveat below
```

Then look at `/learn`, `/get-involved`, `/printing`, `/impact` and `/about`
against the artboard at 375, 768 and 1280.

**E2E caveat:** the suite has never been run against this branch — no local
Supabase was available in the sessions that built the foundation. A failure here
may be environmental rather than a regression. Establish a baseline on
`development` before treating a red run as this plan's fault.

## What this plan does not cover

Two further phases, each producing working software on its own:

**Phase 2 — the page walk.** The homepage (hero two-column layout, the three
launcher pillars at `6px 6px 0` with 170px art slots and 46px Nunito numerals,
the four secondary cards, the "SPLAT in 30 seconds" strip with its dashed
connector); the filter row and empty state on `/library` and `/toy-library`; the
Impact 5-up stat tiles; the alternating narrative rows on `/printing` and
`/about`.

**Phase 3 — newly in-scope and derived surfaces.** `/dashboard` front door;
`/login` and `/signup` including the segmented toggle (**the one interaction
change in the whole walk**); the derived footer, the four trust pages, the six
detail routes; and the rotation sweep — `.lean` (`globals.css:348`) and
`.pixel .nav-pill:hover` (`:546`) only, **not** the functional `<details>`
chevron at `:882`.

Phase 2 depends on Task 2's tokens. Phase 3 depends on Tasks 3 and 4.
