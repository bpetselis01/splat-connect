# Playroom Public Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the 42 public-facing pages a cheerful, motion-aware "Playroom"
identity built entirely from existing design tokens, and promote 3D Printing to a
top-level product pillar.

**Architecture:** Section colour ("tone") is added to `lib/public-nav.ts`, the
existing single source of truth for the public surface, and consumed everywhere via
one `toneClass()` helper. Playfulness comes from CSS — depth on buttons, decorative
rotation over an upright grid, soft background shapes — so it renders server-side
without hydration. Motion for React is added only for entrance stagger, hover and
scroll, loaded lazily.

**Tech Stack:** Next 16.2.6 (App Router, Turbopack), React 19.2.4, Tailwind v4,
Motion for React, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-20-playroom-public-site-design.md`

## Global Constraints

- **Public surface only.** Never touch `AppShell`, `ShellFrame`, `lib/nav-model.ts`,
  `/upload`, `/notifications`, `/tutorials/[id]/edit`, `/legal/*`, `/dashboard`,
  `/admin`, `/login`, `/signup`, `/auth`, `/onboarding`.
- **No new brand colours.** Every colour must already exist in `app/globals.css`.
- **No new typeface.** Nunito only — mobile-app parity.
- **One new dependency:** `motion`. No GSAP, no Three.js, no shadcn, no Radix.
- **Letter-spacing floor:** `-0.03em`. Nothing tighter.
- **Tilt is decorative.** Rotation on cards only, never on grids, never a layout
  offset. Removing every transform must leave a correct layout.
- **No dropdowns.** `[aria-expanded]` count must stay 0 — existing e2e rule.
- **One `<header>`** per public page — invariant established 2026-08-19.
- **Contrast:** body text ≥4.5:1, large text ≥3:1, verified by test not by eye.
- **Reduced motion** is a designed state for every animation, never a dead stop.
- Working directory for all commands: `packages/web`.

---

### Task 1: Tone model

**Files:**
- Create: `packages/web/lib/tone.ts`
- Test: `packages/web/tests/unit/lib/tone.test.ts`

**Interfaces:**
- Produces: `Tone` type (`'brand'|'mint'|'apricot'|'honey'|'sky'|'sunken'|'plain'`),
  `TONES: Record<Tone, ToneSpec>`, `toneClass(tone): ToneSpec`.
  `ToneSpec = { surface: string; ink: string; dot: string; hex: { bg: string; fg: string } }`
  where `surface`/`ink`/`dot` are Tailwind class strings and `hex` holds the raw
  values so tests can compute contrast.

- [ ] **Step 1: Write failing test** — `tests/unit/lib/tone.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { TONES, toneClass, type Tone } from '@/lib/tone'

/** WCAG relative luminance, sRGB. */
function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('tone', () => {
  it('every tone clears 4.5:1 for body text', () => {
    for (const [name, spec] of Object.entries(TONES)) {
      expect(ratio(spec.hex.bg, spec.hex.fg), `${name} ink on surface`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('every tone stays legible on the page canvas', () => {
    for (const [name, spec] of Object.entries(TONES)) {
      expect(ratio('#eaf4fa', spec.hex.fg), `${name} ink on canvas`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('toneClass returns the spec for a tone', () => {
    expect(toneClass('mint')).toBe(TONES.mint)
  })

  it('covers exactly the seven tones', () => {
    const expected: Tone[] = ['brand', 'mint', 'apricot', 'honey', 'sky', 'sunken', 'plain']
    expect(Object.keys(TONES).sort()).toEqual([...expected].sort())
  })
})
```

- [ ] **Step 2: Run test, verify it fails**
  Run: `npx vitest run tests/unit/lib/tone.test.ts`
  Expected: FAIL — cannot resolve `@/lib/tone`

- [ ] **Step 3: Write `lib/tone.ts`**

```ts
/**
 * Section colour, in one place.
 *
 * The three product pillars (Guides, Toy Library, 3D Printing) carry the three
 * distinct accent families; the four supporting sections stay in the blue family.
 * A visitor can tell a pillar from a supporting section without reading a word.
 *
 * `hex` duplicates what the Tailwind classes resolve to, so the contrast test can
 * compute ratios without a browser. Keep the two in step.
 */
export type Tone = 'brand' | 'mint' | 'apricot' | 'honey' | 'sky' | 'sunken' | 'plain'

export interface ToneSpec {
  /** Card / panel background. */
  surface: string
  /** Text on that surface. */
  ink: string
  /** The nav dot and small markers. */
  dot: string
  hex: { bg: string; fg: string }
}

export const TONES: Record<Tone, ToneSpec> = {
  brand:   { surface: 'bg-brand-tint',   ink: 'text-brand-deep',   dot: 'bg-brand',   hex: { bg: '#d8ecf7', fg: '#0a4f70' } },
  mint:    { surface: 'bg-mint-soft',    ink: 'text-mint-deep',    dot: 'bg-mint',    hex: { bg: '#d4f2ea', fg: '#0f5c4d' } },
  apricot: { surface: 'bg-apricot-soft', ink: 'text-apricot-deep', dot: 'bg-apricot', hex: { bg: '#ffe3d5', fg: '#8c3312' } },
  honey:   { surface: 'bg-honey-soft',   ink: 'text-honey-deep',   dot: 'bg-honey-deep', hex: { bg: '#fdeecb', fg: '#7a4e05' } },
  sky:     { surface: 'bg-brand-soft',   ink: 'text-brand-deep',   dot: 'bg-brand-dark', hex: { bg: '#bfe4f5', fg: '#0a4f70' } },
  sunken:  { surface: 'bg-sunken',       ink: 'text-ink',          dot: 'bg-brand-deep', hex: { bg: '#dcedf6', fg: '#12283a' } },
  plain:   { surface: 'bg-surface',      ink: 'text-ink',          dot: 'bg-muted',   hex: { bg: '#ffffff', fg: '#12283a' } },
}

export function toneClass(tone: Tone): ToneSpec {
  return TONES[tone]
}
```

- [ ] **Step 4: Run test, verify it passes**
  Run: `npx vitest run tests/unit/lib/tone.test.ts` → PASS

- [ ] **Step 5: Commit** — `feat(web): add the public site's section tone model`

---

### Task 2: Three-pillar IA in the nav model

**Files:**
- Modify: `packages/web/lib/public-nav.ts`
- Test: `packages/web/tests/unit/lib/public-nav.test.ts`

**Interfaces:**
- Consumes: `Tone` from Task 1.
- Produces: `NavSection` gains `tone: Tone` and `rank: 'pillar' | 'supporting'`.
  `PUBLIC_NAV` grows to 7 sections; `/printing` becomes a section with children
  `/printing/basics` (live), `/printing/requests` (soon), `/printing/parts` (soon).
  `/learn/3d-printing-basics` and Get Involved's `/printing` child are removed.

- [ ] **Step 1: Write failing test** — append to the existing public-nav test

```ts
describe('three-pillar IA', () => {
  it('carries seven sections', () => {
    expect(PUBLIC_NAV).toHaveLength(7)
  })

  it('marks exactly three pillars', () => {
    const pillars = PUBLIC_NAV.filter((s) => s.rank === 'pillar').map((s) => s.href)
    expect(pillars).toEqual(['/library', '/toy-library', '/printing'])
  })

  it('gives every section a tone, and pillars the distinct accents', () => {
    for (const s of PUBLIC_NAV) expect(s.tone).toBeTruthy()
    const byHref = Object.fromEntries(PUBLIC_NAV.map((s) => [s.href, s.tone]))
    expect(byHref['/library']).toBe('brand')
    expect(byHref['/toy-library']).toBe('mint')
    expect(byHref['/printing']).toBe('apricot')
  })

  it('moves 3D printing out of Learn and Get Involved', () => {
    const all = PUBLIC_NAV.flatMap((s) => s.children.map((c) => c.href))
    expect(all).not.toContain('/learn/3d-printing-basics')
    expect(PUBLIC_NAV.find((s) => s.href === '/get-involved')!.children.map((c) => c.href))
      .not.toContain('/printing')
  })

  it('gives the printing pillar a live child so its hub is never empty', () => {
    const printing = PUBLIC_NAV.find((s) => s.href === '/printing')!
    expect(printing.children.map((c) => c.href)).toEqual([
      '/printing/basics', '/printing/requests', '/printing/parts',
    ])
    expect(printing.children.find((c) => c.href === '/printing/basics')!.state).toBe('live')
  })

  it('resolves the new printing routes to their section', () => {
    expect(sectionFor('/printing/basics')?.href).toBe('/printing')
  })
})
```

- [ ] **Step 2: Run, verify fail**
  Run: `npx vitest run tests/unit/lib/public-nav.test.ts` → FAIL

- [ ] **Step 3: Edit `lib/public-nav.ts`**
  - Import `Tone` from `./tone`.
  - Add `tone: Tone` and `rank: 'pillar' | 'supporting'` to `NavSection`.
  - Tag: `/library` brand/pillar, `/toy-library` mint/pillar, `/printing`
    apricot/pillar, `/learn` honey/supporting, `/get-involved` sky/supporting,
    `/impact` sunken/supporting, `/about` plain/supporting.
  - Remove the `/printing` entry from Get Involved's `children`.
  - Remove `/learn/3d-printing-basics` from Learn's `children`.
  - Insert the new section after `/toy-library`:

```ts
  {
    href: '/printing',
    label: '3D Printing',
    tone: 'apricot',
    rank: 'pillar',
    blurb: 'Printed switch mounts, cases and interrupters — and somewhere to ask for one.',
    children: [
      {
        href: '/printing/basics',
        label: 'Printing basics',
        state: 'live',
        blurb: 'Filament, settings and finishing for printed switch parts.',
      },
      {
        href: '/printing/requests',
        label: 'Request a print',
        state: 'soon',
        featureKey: 'printing',
        blurb: 'Ask an association with a free printer to make a part for you.',
      },
      {
        href: '/printing/parts',
        label: 'Printable parts',
        state: 'soon',
        featureKey: 'printing-parts',
        blurb: 'A catalogue of STL files, sized and tested for adaptation work.',
      },
    ],
  },
```

- [ ] **Step 4: Run, verify pass**
  Run: `npx vitest run tests/unit/lib/public-nav.test.ts` → PASS

- [ ] **Step 5: Commit** — `feat(web): promote 3D printing to a product pillar`

---

### Task 3: Move the basics article, add the redirect

**Files:**
- Move: `packages/web/app/learn/3d-printing-basics/page.tsx` → `packages/web/app/printing/basics/page.tsx`
- Modify: `packages/web/next.config.ts`
- Modify: `packages/web/app/learn/page.tsx` (drop it from START_HERE/deeper grouping if referenced)

- [ ] **Step 1: Move the file**

```bash
mkdir -p app/printing/basics
git mv app/learn/3d-printing-basics/page.tsx app/printing/basics/page.tsx
rmdir app/learn/3d-printing-basics
```

- [ ] **Step 2: Add the redirect to `next.config.ts`**

```ts
  async redirects() {
    return [
      // 3D printing became a product pillar on 2026-08-20; this article was its
      // only real content and moved with it. Permanent so inbound links and
      // search results follow.
      { source: '/learn/3d-printing-basics', destination: '/printing/basics', permanent: true },
    ]
  },
```

- [ ] **Step 3: Verify the redirect**
  Run: `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3100/learn/3d-printing-basics`
  Expected: `308 http://localhost:3100/printing/basics`

- [ ] **Step 4: Commit** — `refactor(web): move 3D printing basics under the printing pillar`

---

### Task 4: The printing pillar's pages

**Files:**
- Create: `packages/web/app/printing/page.tsx` (real hub — replaces the ComingSoon)
- Create: `packages/web/app/printing/requests/page.tsx` (ComingSoon)
- Create: `packages/web/app/printing/parts/page.tsx` (ComingSoon)
- Test: extend `packages/web/tests/e2e/public/navigation.spec.ts` (Task 12)

The hub must be real content — a top-level link may not render `Not built yet`.
Copy covers: what SPLAT's printing offer is, why printed parts matter for
adaptation, and how to get one today without owning a printer (the existing
"ask a library, makerspace, men's shed" route from the basics article).

- [ ] **Step 1: Write the hub page** using `HubGrid`, `EditorialImage`
      (`illustration="printer"`, `ratio="2/1"`) and the section's children.
- [ ] **Step 2: Write the two ComingSoon children**, reusing the existing
      `featureKey` allowlist pattern. `requests` reuses `featureKey="printing"`.
- [ ] **Step 3: Register `printing-parts`** in the API's notify allowlist so the
      new scaffold's form works. Check `packages/api/src/routes/public.ts` for the
      allowlist and add the key.
- [ ] **Step 4: Verify all four routes render**
  Run: `for p in /printing /printing/basics /printing/requests /printing/parts; do curl -s -o /dev/null -w "$p %{http_code}\n" http://localhost:3100$p; done`
  Expected: all 200
- [ ] **Step 5: Commit** — `feat(web): build the 3D printing pillar's hub and scaffolds`

---

### Task 5: Playroom CSS foundations

**Files:**
- Modify: `packages/web/app/globals.css`

Adds, inside the existing `@layer components` / `@layer base`:

- [ ] **Step 1: Button depth on `.btn-accent` and `.btn-primary`**

```css
  /* Playroom: buttons have a physical bottom edge and squash when pressed —
     the site is about switches, so its controls should feel like one. */
  .btn-accent, .btn-primary {
    box-shadow: 0 4px 0 var(--color-apricot-deep);
    transition: transform .16s var(--ease-spring), box-shadow .16s var(--ease-spring),
                background-color .16s linear;
  }
  .btn-primary { box-shadow: 0 4px 0 var(--color-brand-deep); }
  .btn-accent:active, .btn-primary:active {
    transform: translateY(4px) scaleY(0.96);
    box-shadow: 0 0 0 var(--color-apricot-deep);
  }
```

- [ ] **Step 2: Tilt utilities** — a fixed, deterministic set

```css
  /* Decorative only. Applied to cards, never to the grid that positions them:
     strip every transform here and the layout underneath is still correct. */
  .tilt-1 { transform: rotate(-1.6deg); }
  .tilt-2 { transform: rotate(0.9deg); }
  .tilt-3 { transform: rotate(-0.7deg); }
  .tilt-4 { transform: rotate(1.4deg); }
  .tilt-1:hover, .tilt-2:hover, .tilt-3:hover, .tilt-4:hover {
    transform: rotate(0deg) translateY(-5px);
  }
```

- [ ] **Step 3: Add `--ease-spring` to `@theme`**
  `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);`

- [ ] **Step 4: Global reduced-motion block in `@layer base`**

```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
    /* The tilt is personality, not information — remove it entirely rather than
       animating to it. The upright grid underneath is the real layout. */
    .tilt-1, .tilt-2, .tilt-3, .tilt-4,
    .tilt-1:hover, .tilt-2:hover, .tilt-3:hover, .tilt-4:hover { transform: none; }
    .btn-accent:active, .btn-primary:active { transform: none; }
  }
```

- [ ] **Step 5: Verify build** — `npm run build` succeeds
- [ ] **Step 6: Commit** — `feat(web): add Playroom's depth, tilt and reduced-motion foundations`

---

### Task 6: Motion provider

**Files:**
- Modify: `packages/web/package.json`
- Create: `packages/web/components/motion-provider.tsx`
- Modify: `packages/web/app/layout.tsx`

**Interfaces:**
- Produces: `<MotionProvider>` — a client component wrapping children in
  `LazyMotion` with `domAnimation` and `strict`, so only `m` components are used
  and the initial bundle stays ~4.6 kB.

- [ ] **Step 1: Install** — `pnpm --filter @splat-connect/web add motion`
- [ ] **Step 2: Write `components/motion-provider.tsx`**

```tsx
'use client'
import { LazyMotion, domAnimation } from 'motion/react'

/**
 * `strict` throws if a full `motion.*` component is used anywhere — that would
 * silently pull the 34kB bundle back in and undo the point of this wrapper.
 * Use `m.*` from 'motion/react-m' instead.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={domAnimation} strict>{children}</LazyMotion>
}
```

- [ ] **Step 3: Wrap only the public branch** of `app/layout.tsx` — inside the
      `shell ?? (...)` fallback, not around `shell`. The signed-in shell is out of scope.
- [ ] **Step 4: Verify** — `npm run build`, then confirm a public page still renders
- [ ] **Step 5: Commit** — `feat(web): add a lazily-loaded Motion provider to the public shell`

---

### Task 7: Tilt and Backdrop components

**Files:**
- Create: `packages/web/components/tilt.tsx`
- Create: `packages/web/components/playroom-backdrop.tsx`
- Test: `packages/web/tests/unit/components/playroom.test.tsx`

**Interfaces:**
- Produces: `<Tilt index={n}>` — applies `tilt-{1..4}` cycled by `index % 4`,
  plus a Motion entrance with 60ms stagger. `<PlayroomBackdrop tone={t} />` —
  `aria-hidden`, `pointer-events-none`, absolutely positioned soft circles.

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Tilt } from '@/components/tilt'
import { PlayroomBackdrop } from '@/components/playroom-backdrop'

describe('Tilt', () => {
  it('cycles through the four fixed rotations by index', () => {
    const { container } = render(<><Tilt index={0}><i /></Tilt><Tilt index={5}><i /></Tilt></>)
    const [a, b] = Array.from(container.children) as HTMLElement[]
    expect(a.className).toContain('tilt-1')
    expect(b.className).toContain('tilt-2')
  })

  it('is deterministic — same index, same class', () => {
    const one = render(<Tilt index={3}><i /></Tilt>).container.firstElementChild!.className
    const two = render(<Tilt index={3}><i /></Tilt>).container.firstElementChild!.className
    expect(one).toBe(two)
  })
})

describe('PlayroomBackdrop', () => {
  it('is decorative and never interactive', () => {
    const { container } = render(<PlayroomBackdrop tone="mint" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.className).toContain('pointer-events-none')
  })
})
```

- [ ] **Step 2: Run, verify fail** → FAIL
- [ ] **Step 3: Implement both components**
- [ ] **Step 4: Run, verify pass** → PASS
- [ ] **Step 5: Commit** — `feat(web): add Playroom's tilt and backdrop primitives`

---

### Task 8: Nav — seven sections with tone dots

**Files:**
- Modify: `packages/web/components/nav.tsx`
- Test: `packages/web/tests/unit/components/nav.test.tsx`

- [ ] **Step 1: Write failing test** — asserts 7 section links render, each with a
      tone dot, and the active one still carries `aria-current="page"`; and that
      `[aria-expanded]` count stays 0.
- [ ] **Step 2: Run, verify fail**
- [ ] **Step 3: Implement** — render `<span aria-hidden className={`${toneClass(s.tone).dot} ...`} />`
      before each label. Keep `flex-wrap`; no dropdown.
- [ ] **Step 4: Run, verify pass**
- [ ] **Step 5: Commit** — `feat(web): give the top bar seven sections and tone markers`

---

### Task 9: LauncherGrid — pillars large, supporting small

**Files:**
- Modify: `packages/web/components/launcher-grid.tsx`
- Modify: `packages/web/app/page.tsx`
- Test: `packages/web/tests/unit/components/launcher-grid.test.tsx`

The hardcoded `lg:grid-cols-6` goes. Pillars span 2 columns and carry their tone
surface, a blurb and a count; supporting tiles span 1 and stay quiet. This is the
change that makes the homepage state what SPLAT actually does.

- [ ] **Step 1: Write failing test** — pillar tiles get `col-span-2` and a tone
      surface class; supporting tiles do not.
- [ ] **Step 2: Run, verify fail**
- [ ] **Step 3: Implement** — grid becomes `grid-cols-2 lg:grid-cols-6`; pillars
      `lg:col-span-2`, supporting `lg:col-span-1`, wrapped in `<Tilt index>`.
- [ ] **Step 4: Run, verify pass**
- [ ] **Step 5: Commit** — `feat(web): make the homepage state its three pillars`

---

### Task 10: HubGrid and ProsePage

**Files:**
- Modify: `packages/web/components/hub-grid.tsx`
- Modify: `packages/web/components/prose-page.tsx`
- Create: `packages/web/components/pull-quote.tsx`
- Test: extend `packages/web/tests/unit/components/` for each

- [ ] **Step 1: Write failing tests** — `HubGrid` accepts `tone` and applies the
      surface to cards, varies span by index, and wraps each in `<Tilt>`;
      `ProsePage` renders a breadcrumb resolved via `sectionFor`, a tilted
      `lastUpdated` stamp, and one `PlayroomBackdrop`.
- [ ] **Step 2: Run, verify fail**
- [ ] **Step 3: Implement.** `ProsePage` is Quiet Playroom: one backdrop shape, one
      accent element, upright body content, no tilt on prose.
- [ ] **Step 4: Run, verify pass**
- [ ] **Step 5: Commit** — one commit per file, in order: pull-quote, hub-grid, prose-page

---

### Task 11: Cards, footer, ComingSoon

**Files:**
- Modify: `packages/web/components/tutorial-card.tsx`
- Modify: `packages/web/components/toy-library-card.tsx`
- Modify: `packages/web/components/impact-card.tsx`
- Modify: `packages/web/components/coming-soon.tsx`
- Modify: `packages/web/components/public-footer.tsx`

- [ ] **Step 1: Apply tone + tilt** to each card; `ComingSoon` gets the pillar-aware
      treatment so a scaffold looks deliberate rather than unfinished.
- [ ] **Step 2: Footer** picks up the seven-section structure and pillar emphasis.
- [ ] **Step 3: Run the full unit suite** — `npm run test:unit`, all green
- [ ] **Step 4: Commit** — one commit per file

---

### Task 12: Typography registers

**Files:**
- Modify: the 15 page files sharing `text-2xl font-bold text-ink sm:text-3xl`

- [ ] **Step 1: Add register classes to `globals.css`** — `.h-hero`, `.h-hub`,
      `.h-article`, `.h-detail` with the clamp scales from the spec.
- [ ] **Step 2: Replace the duplicated class string** page by page with the right register.
- [ ] **Step 3: Verify** — `grep -rc 'text-2xl font-bold text-ink sm:text-3xl' app` returns 0
- [ ] **Step 4: Commit** — `feat(web): give public pages a typographic register`

---

### Task 13: E2E suite

**Files:**
- Modify: `packages/web/tests/e2e/public/navigation.spec.ts`

- [ ] **Step 1: Grow `TOP_LEVEL` to seven**, adding `{ href: '/printing', label: '3D Printing' }`.
      The existing "none is a placeholder" assertion then covers the new hub.
- [ ] **Step 2: Add a redirect test**

```ts
test('the moved printing article redirects permanently', async ({ page }) => {
  const res = await page.goto('/learn/3d-printing-basics')
  expect(page.url()).toContain('/printing/basics')
  expect(res?.status()).toBeLessThan(400)
})
```

- [ ] **Step 3: Add a reduced-motion test**

```ts
test('reduced motion removes every tilt', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const transforms = await page.locator('[class*="tilt-"]').evaluateAll((els) =>
    els.map((e) => getComputedStyle(e).transform)
  )
  for (const t of transforms) expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(t)
})
```

- [ ] **Step 4: Commit** — `test(web): cover the printing pillar and reduced motion`

---

### Task 14: Verification

- [ ] **Step 1:** `npm run typecheck` → exit 0
- [ ] **Step 2:** `npm run test:unit` → all green, ≥622 tests
- [ ] **Step 3:** `npm run lint` → no NEW errors (one pre-existing error in
      `components/profile-form.tsx:94` is out of scope)
- [ ] **Step 4:** `npm run build` → succeeds
- [ ] **Step 5:** Walk all 42 public routes with curl, assert <400 and one `<header>`
- [ ] **Step 6:** Screenshot homepage, a pillar hub, a Learn article and `/privacy`
      at 375 / 768 / 1280, in both motion preferences
- [ ] **Step 7:** `graphify update .`

---

## Self-Review

**Spec coverage:** Every spec section maps to a task — Information architecture →
2,3,4; Section colour → 1,2; Shape and tilt → 5,7; Typography → 12; Register by
page class → 10,11; Motion → 5,6,7; Components → 7–11; Accessibility → 1,5,13;
Testing → 13,14.

**Known gaps, deliberately deferred:** the spec's backdrop parallax-on-scroll is
implemented as static in Task 7 and only becomes scroll-linked if Task 14's
screenshots show it earns the extra client JS. Page-transition cross-fade is
likewise deferred — it needs App Router template plumbing and is the lowest-value
item in the motion table.

**Type consistency:** `Tone` is defined once in Task 1 and imported by Task 2;
`toneClass()` is the only accessor used in Tasks 8–11; `Tilt` takes `index` in
every consumer.
