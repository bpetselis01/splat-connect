# Pixel Redesign: Foundation Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Playroom's tilt/parallax visual language with Pixel's flat hard-shadow one at the
shared-component level (tokens, shell class, button depth, backdrop, entrance), and complete the
`playroom` → `pixel` internal rename — so every one of the 42 public pages inherits the new system
without a page-by-page rewrite.

**Architecture:** This is a token/component swap on Playroom's existing architecture, not a
re-architecture. `lib/tone.ts`'s hex values, `EditorialImage`/`slot.tsx`, and `lib/public-nav.ts`
are untouched. Work happens in `app/globals.css`, `app/layout.tsx`, and the handful of components
that import `Tilt` or `PlayroomBackdrop` directly.

**Tech Stack:** Next.js (App Router), Tailwind v4 `@theme` tokens, Vitest + Testing Library
(unit), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-08-26-pixel-redesign-design.md`

## Global Constraints

- No change to `AppShell`, `ShellFrame`, `lib/nav-model.ts`, or any authenticated route.
- No change to `lib/tone.ts` hex values — the palette is not moving, only how it's rendered.
- No change to `EditorialImage`/`components/slot.tsx` — the placeholder system carries over as-is.
- Tilt is removed entirely — no rotation anywhere, on load or on hover.
- `prefers-reduced-motion` stays a designed state for every animation touched, never a dead stop.
- `.btn-accent`/`.btn-primary` base classes are shared with the signed-in dashboard; all pixel
  depth changes stay scoped under `.pixel` (the renamed `.playroom` shell class), never on the
  base classes themselves.
- The existing unit suite must stay green after every task.

---

### Task 1: Remove `Tilt` — the component, its CSS, and both call sites

**Files:**
- Delete: `components/tilt.tsx`
- Modify: `components/hub-grid.tsx:72,140`, `components/launcher-grid.tsx:50,108`,
  `app/globals.css` (`.tilt-1`..`.tilt-4` rules, ~line 551 onward)
- Test: `tests/unit/components/hub-grid.test.tsx`, `tests/unit/components/launcher-grid.test.tsx`,
  `tests/unit/components/playroom.test.tsx` (remove the `Tilt` describe block)

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new — this is pure removal. Grid items go from `<Tilt index index={i}
  className={...}>` to a plain `<div key={...} className={...}>`, same children.

- [ ] **Step 1: Write the failing test — hub grid renders with no rotation class**

Add to `tests/unit/components/hub-grid.test.tsx`:

```tsx
it('renders every card upright — no tilt class on any grid item', () => {
  const { container } = render(
    <HubGrid items={[
      { href: '/a', label: 'A', blurb: 'a', state: 'live' },
      { href: '/b', label: 'B', blurb: 'b', state: 'live' },
    ]} />
  )
  const cards = container.querySelectorAll('a.card-playroom')
  expect(cards.length).toBeGreaterThan(0)
  for (const card of cards) {
    expect(card.parentElement?.className).not.toMatch(/tilt-\d/)
  }
})
```

Add the matching test to `tests/unit/components/launcher-grid.test.tsx`:

```tsx
it('renders every tile upright — no tilt class on any grid item', () => {
  const { container } = render(
    <LauncherGrid tiles={[
      { href: '/a', label: 'A', blurb: 'a', tone: 'brand', rank: 'pillar', count: 1 },
    ]} />
  )
  const tile = container.querySelector('a.card-playroom')
  expect(tile?.parentElement?.className).not.toMatch(/tilt-\d/)
})
```

(Match each test file's existing import style and fixture shape — read the file first, these
inline fixtures may need adjusting to the real prop types.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @splat-connect/web test -- hub-grid launcher-grid`
Expected: FAIL — grid items currently render with a `tilt-1`..`tilt-4` class from `Tilt`.

- [ ] **Step 3: Unwrap `Tilt` in both grid components**

In `components/hub-grid.tsx`, replace:

```tsx
          <Tilt
            key={item.href}
            index={i}
            className={spread ? 'sm:col-span-2' : undefined}
          >
            <BoundaryLink
```

with:

```tsx
          <div key={item.href} className={spread ? 'h-full sm:col-span-2' : 'h-full'}>
            <BoundaryLink
```

and its closing `</Tilt>` with `</div>`. Remove `import { Tilt } from '@/components/tilt'`.

In `components/launcher-grid.tsx`, replace:

```tsx
          <Tilt
            key={tile.href}
            index={i}
            className={pillar ? 'col-span-2 lg:col-span-4' : 'col-span-1 lg:col-span-3'}
          >
            <Link
```

with:

```tsx
          <div
            key={tile.href}
            className={pillar ? 'h-full col-span-2 lg:col-span-4' : 'h-full col-span-1 lg:col-span-3'}
          >
            <Link
```

and its closing `</Tilt>` with `</div>`. Remove `import { Tilt } from '@/components/tilt'`.

- [ ] **Step 4: Delete `components/tilt.tsx` and the tilt CSS**

Delete the file. In `app/globals.css`, remove the `.tilt-1`..`.tilt-4` rule block and the
`.tilt-1:hover, .tilt-2:hover, .tilt-3:hover, .tilt-4:hover` block that follows it (~lines
551–566), along with their two doc comments above (the "Decorative rotation..." and "A card that
is going to lie at an angle..." comments — both describe the mechanism being deleted).

- [ ] **Step 5: Remove the `Tilt` describe block from the shared test file**

In `tests/unit/components/playroom.test.tsx`, delete the `describe('Tilt', ...)` block (lines
7–37) and the `import { Tilt, tiltClass } from '@/components/tilt'` line.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @splat-connect/web test`
Expected: PASS, including the two new assertions.

- [ ] **Step 7: Commit**

```bash
git add packages/web/components/hub-grid.tsx packages/web/components/launcher-grid.tsx \
  packages/web/app/globals.css packages/web/tests/unit/components/playroom.test.tsx \
  packages/web/tests/unit/components/hub-grid.test.tsx \
  packages/web/tests/unit/components/launcher-grid.test.tsx
git rm packages/web/components/tilt.tsx
git commit -m "feat(web): remove Playroom's tilt entirely"
```

---

### Task 2: Rename `PlayroomBackdrop` → `PixelBackdrop`

**Files:**
- Rename: `components/playroom-backdrop.tsx` → `components/pixel-backdrop.tsx`
- Modify: `app/layout.tsx:11,`(usage)`, `components/prose-page.tsx:19,39`,
  `tests/unit/components/playroom.test.tsx`

**Interfaces:**
- Consumes: `toneClass` from `lib/tone.ts` (unchanged signature)
- Produces: `PixelBackdrop({ tone: Tone })` — same shape as `PlayroomBackdrop` had, renamed only.

- [ ] **Step 1: Write the failing test**

In `tests/unit/components/playroom.test.tsx`, change the `PlayroomBackdrop` describe block's
import and every reference:

```tsx
import { PixelBackdrop } from '@/components/pixel-backdrop'

describe('PixelBackdrop', () => {
  it('is decorative: hidden from assistive tech and never interactive', () => {
    const { container } = render(<PixelBackdrop tone="mint" />)
    // ...unchanged body, PlayroomBackdrop -> PixelBackdrop in each render() call
```

(Apply the same `PlayroomBackdrop` → `PixelBackdrop` substitution to all four tests in that
describe block — the assertions themselves don't change.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test -- playroom`
Expected: FAIL — `@/components/pixel-backdrop` doesn't exist yet.

- [ ] **Step 3: Rename the component file and its export**

`git mv components/playroom-backdrop.tsx components/pixel-backdrop.tsx`, then in that file rename
`export function PlayroomBackdrop` to `export function PixelBackdrop` (body unchanged).

- [ ] **Step 4: Update both call sites**

In `app/layout.tsx`, change `import { PlayroomBackdrop } from '@/components/playroom-backdrop'`
to `import { PixelBackdrop } from '@/components/pixel-backdrop'`, and update the JSX usage(s) from
`<PlayroomBackdrop tone={tone} />` to `<PixelBackdrop tone={tone} />`.

In `components/prose-page.tsx`, change `import { PlayroomBackdrop } from
'@/components/playroom-backdrop'` to `import { PixelBackdrop } from '@/components/pixel-backdrop'`,
and `{tone && <PlayroomBackdrop tone={tone} />}` to `{tone && <PixelBackdrop tone={tone} />}`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @splat-connect/web test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A packages/web/components/pixel-backdrop.tsx packages/web/app/layout.tsx \
  packages/web/components/prose-page.tsx packages/web/tests/unit/components/playroom.test.tsx
git commit -m "feat(web): rename PlayroomBackdrop to PixelBackdrop"
```

---

### Task 3: Rename the `.playroom` shell class to `.pixel`

**Files:**
- Modify: `app/layout.tsx` (both `<div className="playroom">` sites), `app/globals.css` (every
  `.playroom X` selector, plus `@keyframes playroom-rise` and the comment referencing it)

**Interfaces:**
- Consumes: nothing new
- Produces: the `.pixel` class becomes the scope every later task's pixel-specific CSS hangs off
  of. Task 4 depends on this being done first.

- [ ] **Step 1: Write the failing test**

`tests/unit/app/layout-chrome.test.tsx` tests `isBare`/`isAccountRoute` only — `RootLayout` is an
async server component reading `headers()`, so the existing convention is to test its exported
pure functions rather than render the tree. Follow that convention: add a standalone regression
test rather than rendering `RootLayout`.

```ts
// tests/unit/app/no-playroom-references.test.ts
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

describe('the playroom -> pixel rename', () => {
  it('app/layout.tsx no longer sets the retired .playroom class', () => {
    const src = readFileSync(new URL('../../../app/layout.tsx', import.meta.url), 'utf8')
    expect(src).not.toContain('"playroom"')
    expect(src).toContain('"pixel"')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test -- no-playroom-references`
Expected: FAIL — `app/layout.tsx` still contains `"playroom"`.

- [ ] **Step 3: Rename the class in `app/layout.tsx`**

Change both `<div className="playroom">` occurrences to `<div className="pixel">`. Update the
comment at line 86 (`still needs the .playroom ancestor`) to say `.pixel`.

- [ ] **Step 4: Rename every `.playroom` selector in `app/globals.css`**

Replace `.playroom .btn-accent`, `.playroom .btn-primary`, `.playroom .nav-pill`, `.playroom
.nav-quiet`, `.playroom .nav-quiet .nav-pill`, and every other `.playroom X` selector with `.pixel
X` (same specificity, same declarations — content unchanged in this task; Task 4 changes the
button block's declarations). Rename `@keyframes playroom-rise` to `@keyframes pixel-rise` and its
one consumer, `.rise { animation: playroom-rise ... }`, to `.rise { animation: pixel-rise ... }`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @splat-connect/web test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web/app/layout.tsx packages/web/app/globals.css \
  packages/web/tests/unit/app/no-playroom-references.test.ts
git commit -m "feat(web): rename the playroom shell class to pixel"
```

---

### Task 4: Add the pixel depth system and wire it into the buttons

**Files:**
- Modify: `app/globals.css` (`@theme` block for new tokens; the `.pixel .btn-accent`/`.btn-primary`
  block), `app/layout.tsx` (add `Jersey_10` font)
- Test: new `tests/unit/app/pixel-tokens.test.ts` and new `tests/unit/app/pixel-font.test.ts`

**Interfaces:**
- Consumes: `.pixel` scope from Task 3
- Produces: `--shadow-pixel-sm/md/lg`, `--border-pixel` custom properties in `app/globals.css`,
  available to every later (Phase 2) task that applies pixel chrome to a component.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/app/pixel-tokens.test.ts
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

describe('pixel depth tokens', () => {
  const css = readFileSync(new URL('../../../app/globals.css', import.meta.url), 'utf8')

  it('defines the hard-shadow depth scale', () => {
    expect(css).toMatch(/--shadow-pixel-sm:\s*2px 2px 0/)
    expect(css).toMatch(/--shadow-pixel-md:\s*4px 4px 0/)
    expect(css).toMatch(/--shadow-pixel-lg:\s*6px 6px 0/)
  })

  it('defines the pixel border width', () => {
    expect(css).toMatch(/--border-pixel:\s*2px/)
  })

  it('wires the buttons to the diagonal shadow, not the old vertical one', () => {
    expect(css).toMatch(/\.pixel \.btn-accent \{[^}]*box-shadow: var\(--shadow-pixel-md\)/)
  })

  it('drops the squash-on-press transform', () => {
    expect(css).not.toContain('scaleY(0.94)')
  })

  it('wires the Jersey 10 display font into the theme', () => {
    expect(css).toMatch(/--font-display:\s*var\(--font-jersey\)/)
  })
})

// A second file, not a second describe block in the one above: this one reads
// app/layout.tsx rather than app/globals.css, and pixel-tokens.test.ts already
// established the read-the-source-file pattern this follows.
// tests/unit/app/pixel-font.test.ts
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

describe('the Jersey 10 font', () => {
  it('is imported and wired into both html branches', () => {
    const src = readFileSync(new URL('../../../app/layout.tsx', import.meta.url), 'utf8')
    expect(src).toContain('Jersey_10')
    expect(src).toContain('jersey.variable')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test -- pixel-tokens`
Expected: FAIL — none of these tokens exist yet, and `scaleY(0.94)` is still present.

- [ ] **Step 3: Add the tokens to `@theme`**

In `app/globals.css`, inside the existing `@theme` block, after `--radius-field: 14px;`:

```css
  /* Pixel's one depth cue: a hard offset with zero blur, laid over --color-ink
     (or a tone's own -deep shade). Replaces both tilt+lift and the old
     vertical-only button shadow. The three sizes exist because Quiet-register
     pages use -sm, not because a component picks arbitrarily. */
  --shadow-pixel-sm: 2px 2px 0;
  --shadow-pixel-md: 4px 4px 0;
  --shadow-pixel-lg: 6px 6px 0;
  --border-pixel: 2px;
```

- [ ] **Step 4: Add the Jersey 10 display font**

In `app/layout.tsx`, change the font import line to:

```tsx
import { Nunito, IBM_Plex_Mono, Jersey_10 } from 'next/font/google'
```

and add, after the `plexMono` declaration:

```tsx
// The pixel system's one display face — headings only, never body text. Full
// Pixel pages use it; Quiet Pixel pages (see the spec's register table) fall
// back to Nunito instead, so this variable is opt-in per page class rather
// than global.
const jersey = Jersey_10({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-jersey',
  display: 'swap',
})
```

Add `jersey.variable` to both `<html className={...}>` template strings (the bare and non-bare
branches) alongside `nunito.variable` and `plexMono.variable`. Then, in `app/globals.css`'s
`@theme` block, add one new font entry alongside the existing `--font-sans`/`--font-mono`:

```css
--font-display: var(--font-jersey), var(--font-sans);
```

This makes `font-display` a usable Tailwind utility class for Phase 2 — this task only wires the
token through, it does not apply `font-display` to any heading yet.

- [ ] **Step 5: Rewrite the button depth rules**

Replace the whole block from `.pixel .btn-accent,\n  .pixel .btn-primary {` (renamed by Task 3)
through the closing `.pixel .btn-primary:active:not(:disabled) { ... }` rule with:

```css
  .pixel .btn-accent,
  .pixel .btn-primary {
    border: var(--border-pixel) solid var(--color-ink);
    transition: transform 0.16s var(--ease-out-quart), box-shadow 0.16s var(--ease-out-quart),
      background-color 0.16s linear;
  }

  .pixel .btn-accent { box-shadow: var(--shadow-pixel-md) var(--color-ink); }
  .pixel .btn-primary { box-shadow: var(--shadow-pixel-md) var(--color-ink); }

  /* Hover lifts the shadow one size up rather than lifting the button — there
     is no bounce left to telegraph, only more or less depth. */
  .pixel .btn-accent:hover:not(:disabled),
  .pixel .btn-primary:hover:not(:disabled) {
    box-shadow: var(--shadow-pixel-lg) var(--color-ink);
  }

  /* Pressed: the button travels exactly the shadow's own offset, so the edge
     visually disappears into the surface as it "sinks" — no squash, no spring. */
  .pixel .btn-accent:active:not(:disabled),
  .pixel .btn-primary:active:not(:disabled) {
    transform: translate(4px, 4px);
    box-shadow: 0 0 0 var(--color-ink);
  }

  @media (prefers-reduced-motion: reduce) {
    .pixel .btn-accent:active:not(:disabled),
    .pixel .btn-primary:active:not(:disabled) {
      transform: none;
      box-shadow: var(--shadow-pixel-sm) var(--color-ink);
    }
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @splat-connect/web test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/web/app/globals.css packages/web/app/layout.tsx \
  packages/web/tests/unit/app/pixel-tokens.test.ts packages/web/tests/unit/app/pixel-font.test.ts
git commit -m "feat(web): add the pixel depth system and Jersey 10, wire buttons to it"
```

---

### Task 5: Rename the remaining test files and add the completeness sweep

**Files:**
- Rename: `tests/unit/components/playroom.test.tsx` → `tests/unit/components/pixel.test.tsx`,
  `tests/e2e/public/playroom.spec.ts` → `tests/e2e/public/pixel.spec.ts`
- Modify: doc comments inside the renamed E2E file referencing "Playroom"

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new — this is the closing rename + regression guard for the whole plan.

- [ ] **Step 1: Write the failing sweep test**

Extend `tests/unit/app/no-playroom-references.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === 'coverage') continue
      walk(full, out)
    } else if (/\.(ts|tsx|css)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

it('leaves no "playroom" reference anywhere in app/ or components/', () => {
  const root = new URL('../../../', import.meta.url).pathname
  const offenders: string[] = []
  for (const dir of ['app', 'components']) {
    for (const file of walk(join(root, dir))) {
      if (readFileSync(file, 'utf8').toLowerCase().includes('playroom')) {
        offenders.push(file)
      }
    }
  }
  expect(offenders).toEqual([])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test -- no-playroom-references`
Expected: FAIL — several `card-playroom` class names (used as a CSS hook in `hub-grid.tsx`,
`launcher-grid.tsx`, and others) still contain the string. Read each offender the test reports and
rename `card-playroom` to `card-pixel` at every call site and in its `app/globals.css` definition
before proceeding — this is expected fallout the sweep is designed to catch, not a plan error.

- [ ] **Step 3: Rename the two test files**

```bash
git mv packages/web/tests/unit/components/playroom.test.tsx \
  packages/web/tests/unit/components/pixel.test.tsx
git mv packages/web/tests/e2e/public/playroom.spec.ts \
  packages/web/tests/e2e/public/pixel.spec.ts
```

In the renamed `pixel.spec.ts`, update the doc comment's two references from "The Playroom shell"
to "The public shell" and "the Playroom direction" wording as needed, and the comment at the
bottom pointing to `tests/unit/components/playroom.test.tsx` to point at `pixel.test.tsx`.

- [ ] **Step 4: Fix every remaining offender the sweep test reported**

Rename `card-playroom` (and any other surviving `playroom`-named class/identifier the test
reports) to its `pixel` equivalent in every file the sweep flags, including its definition in
`app/globals.css`.

- [ ] **Step 5: Run the full suite to verify everything passes**

Run: `pnpm --filter @splat-connect/web test`
Expected: PASS, 0 remaining `playroom` references in `app/` or `components/`.

- [ ] **Step 6: Commit**

```bash
git add -A packages/web/tests packages/web/app packages/web/components
git commit -m "feat(web): finish the playroom -> pixel rename"
```

---

## What this plan does not cover

Per the spec's sequencing, this plan is the shared foundation only. A follow-on plan covers the
page-template walk (nav pills, footer, hub-grid/launcher-grid card shape, prose-page register,
`tutorial-card`/`toy-library-card`/`impact-card` treatment, `border-radius` sweep from `9999px`/
`1rem` to the pixel scale) once this lands and is checked against the board.

Also deferred, since their targets aren't touched by this plan: card hover shadow grow/shrink
(cards keep `--shadow-rest`/`--shadow-lift` until the card-shape task above lands), and the
backdrop's drop-in entrance (`PixelBackdrop` is a straight rename in Task 2, no new animation —
today's version has no scroll parallax to remove either, so there's nothing to replace yet).

**Ruling (added after the final whole-branch review):** the Global Constraint "no rotation
anywhere" refers to the card-tilt system this plan targets (the `Tilt` component and its
`.tilt-1`..`.tilt-4` classes) — not a blanket ban on every `transform: rotate()` in
`globals.css`. Four decorative rotations survive this plan on purpose, three of them already
covered by the deferrals above: `.pixel .nav-pill:hover` (nav pills, named above),
`.stamp`/`.pullquote` on prose pages (prose-page register, named above), and `.lean` on the
homepage headline (`app/page.tsx:124` — a homepage-specific flourish outside every task's file
list, added to this deferred list now rather than left as a silent gap). None of the four are
touched by Tasks 1-5, and none are the card-grid tilt mechanism the constraint was written
against.
