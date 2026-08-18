# Public Site Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the public side of SPLAT Connect from 10 routes and 4 nav links to a complete 43-route site with a dropdown-free navigation model, real written content on 20 pages, and 9 designed placeholders that capture interest instead of apologising.

**Architecture:** One nav-model module (`lib/public-nav.ts`) is the single source of truth for the six sections, their children, and each child's live/soon state. The top bar, the section subnav, the fat footer, the homepage launcher grid, every hub page's card grid, and the scaffold registry all read from it — nothing about the site's shape is declared twice. Pages are plain server components. Only two things touch the backend: a public organisations endpoint and an email-capture endpoint.

**Tech Stack:** Next.js 16.2.6 (App Router, typed routes), React 19.2.4, Tailwind CSS v4, Hono API, Supabase (Postgres + RLS), Vitest + @testing-library/react for units, Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-08-19-public-site-scaffold-design.md`

## Global Constraints

- **Terminology is fixed.** The tutorial catalogue at `/library` is called **"Guides"** in all UI copy. The Learn section's contents are called **"articles"**, never guides. Do not mix these.
- **Spelling is British/Australian**, matching the existing codebase: "organisation" in all prose and UI copy. The *route* is `/organizations` and the database table is `organizations` (US spelling) — do not rename either.
- **No dropdown, hover, or disclosure menus anywhere.** No `aria-expanded` widgets in navigation. If you find yourself writing focus-trap or arrow-key handling for nav, you have taken a wrong turn.
- **No new npm dependencies.** Not for MDX, not for icons, not for images, not for carousels.
- **Every server-side `fetch` degrades, never throws.** Wrap in `try/catch` falling back to the same empty value the non-ok branch returns, following `app/page.tsx` and `app/impact/page.tsx`.
- **Public API endpoints use `createAnonClient()`** and are mounted before `authMiddleware`, with a hand-written `select` listing exact columns. Never `select('*')` on a public route, and never return `org_leaders`.
- **Decorative images take `alt=""`.** Every image slot has a heading beside it; naming the subject twice is a duplicate screen-reader announcement. Follow `components/card-photo.tsx`.
- **Design tokens only.** Colours come from `globals.css`: `ink`, `muted`, `line`, `surface`, `sunken`, `canvas`, `brand`, `brand-dark`, `brand-deep`, `brand-soft`, `brand-tint`, `mint-soft`, `mint-deep`, `apricot`, `honey-soft`, `honey-deep`. Component classes: `.card`, `.card-flat`, `.card-tint`, `.card-link`, `.btn`, `.btn-primary`, `.btn-accent`, `.btn-soft`, `.btn-quiet`, `.btn-sm`, `.badge`, `.empty-badge`. No raw hex values.
- **Typed routes are on.** Route literals need `as const` or a `Route` type annotation to satisfy `next`'s typed routes, as `components/nav.tsx` already does.
- **Migration numbering continues from 034.** The next migration is `035_notify_signups.sql`.
- **Commit after every task.** Follow the repo's existing message style (`feat(web):`, `test(web):`, `feat(api):`, `docs:`).

---

## File Structure

**New — web chrome and model**

| File | Responsibility |
|------|----------------|
| `packages/web/lib/public-nav.ts` | The six sections, their children, live/soon state, footer legal links. The single source of truth. |
| `packages/web/components/section-nav.tsx` | The subnav row. Renders nothing when a section has no children. |
| `packages/web/components/public-footer.tsx` | Fat footer: six columns from `PUBLIC_NAV`, legal row from `FOOTER_LEGAL`. |
| `packages/web/components/editorial-image.tsx` | Image slot: real photo when `src` is set, illustration otherwise. |
| `packages/web/components/notify-form.tsx` | Client component. Email capture on scaffold pages. |
| `packages/web/components/hub-grid.tsx` | The card grid every hub page uses, driven by `NavItem[]`. |
| `packages/web/public/illustrations/*.svg` | Seven flat brand-palette illustrations. |

**New — pages**

| Path | Count |
|------|-------|
| `app/learn/page.tsx` + `app/learn/<slug>/page.tsx` × 6 | 7 |
| `app/get-involved/page.tsx` + 3 tracks + 2 explainers | 6 |
| `app/about/page.tsx`, `app/about/team/page.tsx`, `app/contact/page.tsx` | 3 |
| `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/safety/page.tsx`, `app/code-of-conduct/page.tsx` | 4 |
| 9 scaffold pages | 9 |

**Modified**

| File | Change |
|------|--------|
| `packages/web/components/nav.tsx` | Six public links; active-section matching that handles `/organizations` under Impact. |
| `packages/web/app/layout.tsx` | Render `PublicFooter` on public routes. |
| `packages/web/app/page.tsx` | Full rebuild: hero, launcher grid, 30-second model, doors, previews. |
| `packages/web/app/impact/page.tsx` | Becomes the Impact section hub. |
| `packages/web/app/organizations/page.tsx` | Reads the public endpoint; no session required. |
| `packages/web/components/coming-soon.tsx` | Optional `featureKey` prop; new heading copy. |
| `packages/web/middleware.ts` | Drop `/organizations` from `signedInRoutes`. |
| `packages/api/src/routes/public.ts` | Add `GET /organizations` and `POST /notify`. |

**New — API and database**

| File | Responsibility |
|------|----------------|
| `supabase/migrations/035_notify_signups.sql` | `notify_signups` table, RLS insert-only. |
| `packages/api/tests/integration/public/organizations.test.ts` | Field-shape and no-auth assertions. |
| `packages/api/tests/integration/public/notify.test.ts` | Allowlist, validation, duplicate handling. |

---

## Task 1: The nav model

**Files:**
- Create: `packages/web/lib/public-nav.ts`
- Test: `packages/web/tests/unit/lib/public-nav.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `NavState`, `NavItem`, `NavSection`, `PUBLIC_NAV: NavSection[]`, `FOOTER_LEGAL: NavItem[]`, `sectionFor(pathname: string): NavSection | undefined`, `SCAFFOLD_KEYS: readonly string[]`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/tests/unit/lib/public-nav.test.ts
import { describe, it, expect } from 'vitest'
import { PUBLIC_NAV, FOOTER_LEGAL, sectionFor, SCAFFOLD_KEYS } from '@/lib/public-nav'

describe('public nav model', () => {
  it('has exactly the six sections, in order', () => {
    expect(PUBLIC_NAV.map((s) => s.label)).toEqual([
      'Guides',
      'Toy Library',
      'Learn',
      'Get Involved',
      'Impact',
      'About',
    ])
  })

  it('leaves the two flat catalogues without children so no subnav renders', () => {
    const flat = PUBLIC_NAV.filter((s) => s.children.length === 0)
    expect(flat.map((s) => s.href)).toEqual(['/library', '/toy-library'])
  })

  it('gives every other section children', () => {
    for (const section of PUBLIC_NAV) {
      if (section.href === '/library' || section.href === '/toy-library') continue
      expect(section.children.length).toBeGreaterThan(0)
    }
  })

  it('never repeats an href anywhere in the tree', () => {
    const all = [
      ...PUBLIC_NAV.map((s) => s.href),
      ...PUBLIC_NAV.flatMap((s) => s.children.map((c) => c.href)),
      ...FOOTER_LEGAL.map((l) => l.href),
    ]
    expect(new Set(all).size).toBe(all.length)
  })

  it('gives every item a label and a blurb, because hub cards and the footer both need them', () => {
    const items = [...PUBLIC_NAV.flatMap((s) => s.children), ...FOOTER_LEGAL]
    for (const item of items) {
      expect(item.label.length).toBeGreaterThan(0)
      expect(item.blurb.length).toBeGreaterThan(0)
    }
  })

  it('maps a nested path to its section', () => {
    expect(sectionFor('/learn/switch-types')?.label).toBe('Learn')
    expect(sectionFor('/get-involved/families')?.label).toBe('Get Involved')
  })

  // The one case a plain path-prefix test gets wrong: /organizations is a child
  // of Impact but shares no prefix with /impact.
  it('maps /organizations to Impact', () => {
    expect(sectionFor('/organizations')?.label).toBe('Impact')
    expect(sectionFor('/organizations/abc/public')?.label).toBe('Impact')
  })

  it('returns undefined for a path outside the public tree', () => {
    expect(sectionFor('/dashboard')).toBeUndefined()
  })

  it('lists a scaffold key for every soon child, and nothing else', () => {
    const soon = PUBLIC_NAV.flatMap((s) => s.children).filter((c) => c.state === 'soon')
    expect(SCAFFOLD_KEYS.length).toBe(soon.length)
    expect(new Set(SCAFFOLD_KEYS).size).toBe(SCAFFOLD_KEYS.length)
  })

  it('has six footer legal links', () => {
    expect(FOOTER_LEGAL).toHaveLength(6)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run tests/unit/lib/public-nav.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/public-nav"`

- [ ] **Step 3: Write the implementation**

```ts
// packages/web/lib/public-nav.ts
/**
 * The whole public site's shape, declared once.
 *
 * The top bar, the section subnav, the fat footer, the homepage launcher grid,
 * every hub page's card grid and the scaffold registry all read from here. This
 * pass took the public surface from 10 routes to 43; declaring any of that twice
 * guarantees drift.
 *
 * Deliberately a sibling of lib/nav-model.ts (the signed-in rail) rather than an
 * extension of it: the two navigations serve different people, share no items,
 * and merging them would mean one module branching on auth state.
 */
import type { Route } from 'next'

export type NavState = 'live' | 'soon'

export interface NavItem {
  href: Route
  label: string
  state: NavState
  /** One line. Used on hub cards, in the footer's title attribute, and as the
      scaffold page's promise. */
  blurb: string
  /** Set on 'soon' items only — the allowlisted key POST /api/public/notify accepts. */
  featureKey?: string
}

export interface NavSection {
  href: Route
  label: string
  blurb: string
  /** Empty for flat catalogues. SectionNav renders nothing for these. */
  children: NavItem[]
}

export const PUBLIC_NAV: NavSection[] = [
  {
    href: '/library',
    label: 'Guides',
    blurb: 'Step-by-step instructions for adapting a specific toy.',
    children: [],
  },
  {
    href: '/toy-library',
    label: 'Toy Library',
    blurb: 'Adapted toys that families and organisations are giving away.',
    children: [],
  },
  {
    href: '/learn',
    label: 'Learn',
    blurb: 'How switch adaptation works, from first switch to safe finish.',
    children: [
      {
        href: '/learn/toy-adaptation-101',
        label: 'Toy adaptation 101',
        state: 'live',
        blurb: 'What a battery interrupter is, and why it is the whole trick.',
      },
      {
        href: '/learn/switch-types',
        label: 'Switch types explained',
        state: 'live',
        blurb: 'Buttons, levers, proximity and grasp — which suits which child.',
      },
      {
        href: '/learn/choosing-a-toy',
        label: 'Choosing a toy to adapt',
        state: 'live',
        blurb: 'What makes a toy easy to adapt, and what makes it impossible.',
      },
      {
        href: '/learn/tools-and-materials',
        label: 'Tools and materials',
        state: 'live',
        blurb: 'The shopping list, and what you can borrow instead of buying.',
      },
      {
        href: '/learn/safety-and-cleaning',
        label: 'Safety and cleaning',
        state: 'live',
        blurb: 'Batteries, small parts, and getting a toy ready to hand over.',
      },
      {
        href: '/learn/3d-printing-basics',
        label: '3D printing basics',
        state: 'live',
        blurb: 'Filament, settings and finishing for printed switch parts.',
      },
      {
        href: '/learn/ask-an-expert',
        label: 'Ask an expert',
        state: 'soon',
        featureKey: 'ask-an-expert',
        blurb: 'Put a question to an occupational therapist or a maker.',
      },
    ],
  },
  {
    href: '/get-involved',
    label: 'Get Involved',
    blurb: 'Three ways in: make something, give something, or back someone.',
    children: [
      {
        href: '/get-involved/families',
        label: 'For families',
        state: 'live',
        blurb: 'Find a guide, gather the parts, adapt the toy you already own.',
      },
      {
        href: '/get-involved/contributors',
        label: 'For contributors',
        state: 'live',
        blurb: 'Adapt a toy, write it up, and get an organisation behind it.',
      },
      {
        href: '/get-involved/organisations',
        label: 'For organisations',
        state: 'live',
        blurb: 'Back contributors, hold toys for local families, host a build day.',
      },
      {
        href: '/get-involved/submit-an-idea',
        label: 'Submit an idea',
        state: 'live',
        blurb: 'Suggest a toy worth adapting, even if you cannot build it.',
      },
      {
        href: '/get-involved/submit-a-tutorial',
        label: 'Submit a guide',
        state: 'live',
        blurb: 'What writing up an adaptation involves, start to finish.',
      },
      {
        href: '/get-involved/requests',
        label: 'Adaptation requests',
        state: 'soon',
        featureKey: 'requests',
        blurb: 'Ask for a toy to be adapted, and let a maker nearby claim it.',
      },
      {
        href: '/get-involved/design-challenges',
        label: 'Design challenges',
        state: 'soon',
        featureKey: 'design-challenges',
        blurb: 'Problems nobody has solved yet, open to anyone.',
      },
      {
        href: '/printing',
        label: '3D print requests',
        state: 'soon',
        featureKey: 'printing',
        blurb: 'Volunteer your printer, or ask for a part to be printed.',
      },
    ],
  },
  {
    href: '/impact',
    label: 'Impact',
    blurb: 'What this community has made, given and delivered.',
    children: [
      {
        href: '/organizations',
        label: 'Organisations',
        state: 'live',
        blurb: 'The therapy centres, schools and services standing behind the work.',
      },
      {
        href: '/impact/news',
        label: 'News and stories',
        state: 'soon',
        featureKey: 'news',
        blurb: 'What families and makers have done with SPLAT.',
      },
      {
        href: '/impact/events',
        label: 'Events',
        state: 'soon',
        featureKey: 'events',
        blurb: 'Build days, workshops and where to find us in person.',
      },
      {
        href: '/impact/map',
        label: 'Deliveries map',
        state: 'soon',
        featureKey: 'map',
        blurb: 'Where adapted toys have actually landed.',
      },
    ],
  },
  {
    href: '/about',
    label: 'About',
    blurb: 'Who runs SPLAT, and how to reach us.',
    children: [
      {
        href: '/about/team',
        label: 'Our team',
        state: 'live',
        blurb: 'The people behind the platform.',
      },
      {
        href: '/contact',
        label: 'Contact',
        state: 'live',
        blurb: 'Get in touch about a guide, a toy or a partnership.',
      },
      {
        href: '/about/partners',
        label: 'Partners and supporters',
        state: 'soon',
        featureKey: 'partners',
        blurb: 'The organisations and funders making this possible.',
      },
      {
        href: '/about/support',
        label: 'Support SPLAT',
        state: 'soon',
        featureKey: 'support',
        blurb: 'Ways to help beyond building a toy.',
      },
    ],
  },
]

/** Footer-only. Never in the top bar, never a section. */
export const FOOTER_LEGAL: NavItem[] = [
  { href: '/privacy', label: 'Privacy policy', state: 'live', blurb: 'What we collect and why.' },
  { href: '/terms', label: 'Terms of use', state: 'live', blurb: 'The rules for using the site.' },
  { href: '/safety', label: 'Safety', state: 'live', blurb: 'Batteries, small parts and supervision.' },
  { href: '/code-of-conduct', label: 'Code of conduct', state: 'live', blurb: 'How we expect people to treat each other.' },
  { href: '/legal/contributor-terms', label: 'Contributor terms', state: 'live', blurb: 'For anyone submitting a guide.' },
  { href: '/legal/org-leader-terms', label: 'Organisation leader terms', state: 'live', blurb: 'For anyone leading an organisation.' },
]

/** Every allowlisted notify key, derived so the list cannot drift from the nav. */
export const SCAFFOLD_KEYS: readonly string[] = PUBLIC_NAV.flatMap((s) =>
  s.children.filter((c) => c.state === 'soon').map((c) => c.featureKey!)
)

/**
 * Which section a path belongs to.
 *
 * Prefix matching alone is wrong for one child: /organizations sits under Impact
 * and shares no prefix with /impact. So children are matched explicitly before
 * falling back to the section's own prefix.
 */
export function sectionFor(pathname: string): NavSection | undefined {
  const inside = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  return (
    PUBLIC_NAV.find((s) => s.children.some((c) => inside(c.href))) ??
    PUBLIC_NAV.find((s) => inside(s.href))
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run tests/unit/lib/public-nav.test.ts`
Expected: PASS, 10 tests

- [ ] **Step 5: Typecheck**

Run: `cd packages/web && pnpm typecheck`
Expected: no errors. If typed routes reject an href, the route does not exist yet — that is expected until later tasks create the pages. Add `// @ts-expect-error typed route lands in Task N` only if the build blocks; prefer running this check again at the end of Task 12.

- [ ] **Step 6: Commit**

```bash
git add packages/web/lib/public-nav.ts packages/web/tests/unit/lib/public-nav.test.ts
git commit -m "feat(web): public nav model as the single source of site shape"
```

---

## Task 2: Section subnav

**Files:**
- Create: `packages/web/components/section-nav.tsx`
- Test: `packages/web/tests/unit/components/section-nav.test.tsx`

**Interfaces:**
- Consumes: `PUBLIC_NAV`, `sectionFor`, `NavSection` from Task 1.
- Produces: `<SectionNav pathname={string} />`. Server component, no props beyond pathname.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/components/section-nav.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionNav } from '@/components/section-nav'

describe('SectionNav', () => {
  it('renders nothing for a flat catalogue', () => {
    const { container } = render(<SectionNav pathname="/library" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing outside the public tree', () => {
    const { container } = render(<SectionNav pathname="/dashboard" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('opens with an Overview link back to the section hub', () => {
    render(<SectionNav pathname="/learn/switch-types" />)
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/learn')
  })

  it('lists every sibling in the section', () => {
    render(<SectionNav pathname="/learn" />)
    expect(screen.getByRole('link', { name: /toy adaptation 101/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /3d printing basics/i })).toBeInTheDocument()
  })

  it('marks the active child for assistive tech', () => {
    render(<SectionNav pathname="/learn/switch-types" />)
    expect(screen.getByRole('link', { name: /switch types/i })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('marks Overview active on the hub itself, not a child', () => {
    render(<SectionNav pathname="/learn" />)
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
  })

  it('flags a not-yet-built child so the expectation is set before the click', () => {
    render(<SectionNav pathname="/learn" />)
    const soon = screen.getByRole('link', { name: /ask an expert/i })
    expect(soon).toHaveTextContent(/soon/i)
  })

  it('does not flag a live child', () => {
    render(<SectionNav pathname="/learn" />)
    expect(screen.getByRole('link', { name: /switch types/i })).not.toHaveTextContent(/soon/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run tests/unit/components/section-nav.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/section-nav"`

- [ ] **Step 3: Write the implementation**

```tsx
// packages/web/components/section-nav.tsx
/**
 * The second navigation row: siblings within the active section.
 *
 * This is what makes a dropdown unnecessary. The top bar gets you into a
 * section; this gets you anywhere inside it in one click, with plain links —
 * no hover, no focus trap, no aria-expanded, nothing to get wrong for a
 * keyboard or screen-reader user.
 *
 * Renders nothing for /library and /toy-library, which are flat catalogues with
 * no children. Overview is synthesised from the section rather than duplicated
 * into PUBLIC_NAV, so a hub can never be missing from its own subnav.
 */
import Link from 'next/link'
import { sectionFor } from '@/lib/public-nav'

export function SectionNav({ pathname }: { pathname: string }) {
  const section = sectionFor(pathname)
  if (!section || section.children.length === 0) return null

  const items = [
    { href: section.href, label: 'Overview', state: 'live' as const },
    ...section.children,
  ]

  return (
    <nav
      aria-label={`${section.label} pages`}
      className="border-b border-line bg-canvas"
    >
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== section.href && pathname.startsWith(`${item.href}/`))
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? 'border-brand text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {item.label}
              {item.state === 'soon' && (
                <span className="badge bg-honey-soft text-honey-deep">SOON</span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run tests/unit/components/section-nav.test.tsx`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/section-nav.tsx packages/web/tests/unit/components/section-nav.test.tsx
git commit -m "feat(web): section subnav row, the replacement for dropdowns"
```

---

## Task 3: Fat footer

**Files:**
- Create: `packages/web/components/public-footer.tsx`
- Test: `packages/web/tests/unit/components/public-footer.test.tsx`

**Interfaces:**
- Consumes: `PUBLIC_NAV`, `FOOTER_LEGAL` from Task 1.
- Produces: `<PublicFooter />`. No props.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/components/public-footer.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicFooter } from '@/components/public-footer'
import { PUBLIC_NAV, FOOTER_LEGAL } from '@/lib/public-nav'

describe('PublicFooter', () => {
  it('gives every section a column heading', () => {
    render(<PublicFooter />)
    for (const section of PUBLIC_NAV) {
      expect(screen.getByRole('link', { name: section.label })).toHaveAttribute(
        'href',
        section.href
      )
    }
  })

  // The whole reason the footer exists: one click to anywhere, from anywhere.
  it('links every child of every section exactly once', () => {
    render(<PublicFooter />)
    for (const child of PUBLIC_NAV.flatMap((s) => s.children)) {
      expect(screen.getAllByRole('link', { name: new RegExp(child.label, 'i') })).toHaveLength(1)
    }
  })

  it('links every legal page', () => {
    render(<PublicFooter />)
    for (const legal of FOOTER_LEGAL) {
      expect(screen.getByRole('link', { name: legal.label })).toHaveAttribute('href', legal.href)
    }
  })

  it('marks not-yet-built destinations so the footer is not a set of traps', () => {
    render(<PublicFooter />)
    expect(screen.getByRole('link', { name: /design challenges/i })).toHaveTextContent(/soon/i)
  })

  it('contains no button or expandable control — it is plain links only', () => {
    render(<PublicFooter />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(document.querySelector('[aria-expanded]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run tests/unit/components/public-footer.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/public-footer"`

- [ ] **Step 3: Write the implementation**

```tsx
// packages/web/components/public-footer.tsx
/**
 * The fat footer: the entire public sitemap, on every public page.
 *
 * This closes the one real gap in a dropdown-free nav — the section subnav only
 * helps once you are already inside a section, so crossing from deep in Learn to
 * deep in Get Involved would otherwise cost two clicks. The footer makes every
 * destination one click from every page, which is exactly what a dropdown does,
 * using plain links instead of a hover-and-focus widget. On a platform serving
 * people with disabilities that difference is the whole argument.
 *
 * Generated from PUBLIC_NAV, so a route cannot exist without appearing here —
 * and tests/e2e/public/footer.spec.ts walks every link, which makes this the
 * broadest guard in the suite against a route declared but never built.
 */
import Link from 'next/link'
import { PUBLIC_NAV, FOOTER_LEGAL } from '@/lib/public-nav'

export function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {PUBLIC_NAV.map((section) => (
            <div key={section.href}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                <Link href={section.href} className="hover:text-ink">
                  {section.label}
                </Link>
              </h2>
              <ul className="flex flex-col gap-1.5">
                {section.children.length === 0 ? (
                  <li>
                    <Link
                      href={section.href}
                      className="text-sm text-muted hover:text-ink hover:underline"
                    >
                      Browse all
                    </Link>
                  </li>
                ) : (
                  section.children.map((child) => (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        className="inline-flex items-baseline gap-1.5 text-sm text-muted hover:text-ink hover:underline"
                      >
                        {child.label}
                        {child.state === 'soon' && (
                          <span className="badge bg-honey-soft text-honey-deep">SOON</span>
                        )}
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-6 text-xs text-muted">
          <span className="font-semibold text-ink">
            SPLAT Connect — Supporting Play by Adapting Toys
          </span>
          {FOOTER_LEGAL.map((legal) => (
            <Link key={legal.href} href={legal.href} className="hover:text-ink hover:underline">
              {legal.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run tests/unit/components/public-footer.test.tsx`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/public-footer.tsx packages/web/tests/unit/components/public-footer.test.tsx
git commit -m "feat(web): fat footer carrying the whole sitemap on every page"
```

---

## Task 4: Top bar rework

**Files:**
- Modify: `packages/web/components/nav.tsx`
- Test: `packages/web/tests/unit/components/nav.test.tsx`

**Interfaces:**
- Consumes: `PUBLIC_NAV`, `sectionFor` from Task 1.
- Produces: unchanged `<Nav role={Role | null} />` signature. Do not change the prop — `app/layout.tsx` already passes `role`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/components/nav.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Nav } from '@/components/nav'

const pathname = vi.hoisted(() => ({ current: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut: vi.fn() } }) }))

describe('Nav', () => {
  it('shows all six public sections to a signed-out visitor', () => {
    pathname.current = '/'
    render(<Nav role={null} />)
    for (const label of ['Guides', 'Toy Library', 'Learn', 'Get Involved', 'Impact', 'About']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  it('no longer labels the tutorial catalogue "Library"', () => {
    pathname.current = '/'
    render(<Nav role={null} />)
    expect(screen.getByRole('link', { name: 'Guides' })).toHaveAttribute('href', '/library')
    expect(screen.queryByRole('link', { name: 'Library' })).toBeNull()
  })

  it('marks the section active from a nested path', () => {
    pathname.current = '/learn/switch-types'
    render(<Nav role={null} />)
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute('aria-current', 'page')
  })

  // Prefix matching alone fails here — /organizations is an Impact child.
  it('marks Impact active on the organisations directory', () => {
    pathname.current = '/organizations'
    render(<Nav role={null} />)
    expect(screen.getByRole('link', { name: 'Impact' })).toHaveAttribute('aria-current', 'page')
  })

  it('offers sign-in to a visitor and sign-out to a member', () => {
    pathname.current = '/'
    render(<Nav role={null} />)
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login')
  })

  it('never renders an expandable menu control', () => {
    pathname.current = '/'
    render(<Nav role={null} />)
    expect(document.querySelector('[aria-expanded]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run tests/unit/components/nav.test.tsx`
Expected: FAIL — no link named "Guides"; the component still renders "Library", "Toy library", "Impact".

- [ ] **Step 3: Rewrite the links block**

Replace the `links` array and the `.map()` that renders it. Keep the component's `'use client'` directive, the `signOut` handler, the logo block and the sign-in/sign-out control exactly as they are.

```tsx
  // Public sections come from the nav model so the top bar, the subnav and the
  // footer cannot disagree about what the site contains. Role-gated links stay
  // local — they are not part of the public tree.
  const sections = PUBLIC_NAV
  const roleLinks = ([
    { href: '/admin', label: 'Admin', show: role === 'admin' },
    { href: '/dashboard', label: 'Dashboard', show: role !== null },
  ] as const).filter((l) => l.show)

  const activeSection = sectionFor(pathname)
```

```tsx
        <div className="order-3 flex w-full flex-wrap items-center gap-1 sm:order-2 sm:ml-auto sm:w-auto">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              aria-current={activeSection?.href === s.href ? 'page' : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                activeSection?.href === s.href
                  ? 'bg-brand-tint text-brand-deep'
                  : 'text-muted hover:bg-sunken hover:text-ink'
              }`}
            >
              {s.label}
            </Link>
          ))}
          {roleLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname.startsWith(l.href) ? 'page' : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                pathname.startsWith(l.href)
                  ? 'bg-brand-tint text-brand-deep'
                  : 'text-muted hover:bg-sunken hover:text-ink'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
```

Add the import at the top of the file:

```tsx
import { PUBLIC_NAV, sectionFor } from '@/lib/public-nav'
```

The old `/organizations` entry is deleted from this component — it now lives in the nav model as an Impact child and is public.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run tests/unit/components/nav.test.tsx`
Expected: PASS, 6 tests

- [ ] **Step 5: Run the whole unit suite for regressions**

Run: `cd packages/web && pnpm test:unit`
Expected: PASS. Any existing test asserting a "Library" or "Toy library" nav label must be updated to the new names — that is an intended copy change, not a break.

- [ ] **Step 6: Commit**

```bash
git add packages/web/components/nav.tsx packages/web/tests/unit/components/nav.test.tsx
git commit -m "feat(web): six-section public top bar driven by the nav model"
```

---

## Task 5: Wire subnav and footer into the layout

**Files:**
- Modify: `packages/web/app/layout.tsx`
- Modify: `packages/web/middleware.ts`
- Test: `packages/web/tests/unit/app/layout-chrome.test.tsx`

**Interfaces:**
- Consumes: `<SectionNav />` (Task 2), `<PublicFooter />` (Task 3).
- Produces: nothing new. The layout already reads `x-pathname` from request headers via middleware — reuse it, do not add a second mechanism.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/app/layout-chrome.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionNav } from '@/components/section-nav'
import { PublicFooter } from '@/components/public-footer'

/**
 * The layout itself is an async server component that reads headers() and awaits
 * AppShell, which jsdom cannot render. So the contract under test is the pairing
 * rule the layout implements: bare routes get neither chrome, public routes get
 * both. isBare() is exported from the layout for exactly this reason.
 */
import { isBare } from '@/app/layout'

describe('layout chrome rules', () => {
  it('treats auth and onboarding routes as bare', () => {
    expect(isBare('/login')).toBe(true)
    expect(isBare('/signup')).toBe(true)
    expect(isBare('/auth/confirmed')).toBe(true)
    expect(isBare('/onboarding/contributor-terms')).toBe(true)
  })

  it('treats public routes as chromed', () => {
    expect(isBare('/')).toBe(false)
    expect(isBare('/learn/switch-types')).toBe(false)
    expect(isBare('/about')).toBe(false)
  })

  it('does not treat a route merely containing "login" as bare', () => {
    expect(isBare('/learn/logins')).toBe(false)
  })

  it('renders a subnav for a section with children and none for a catalogue', () => {
    const { container: withKids } = render(<SectionNav pathname="/about/team" />)
    expect(withKids).not.toBeEmptyDOMElement()
    const { container: flat } = render(<SectionNav pathname="/toy-library" />)
    expect(flat).toBeEmptyDOMElement()
  })

  it('renders the sitemap footer', () => {
    render(<PublicFooter />)
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run tests/unit/app/layout-chrome.test.tsx`
Expected: FAIL — `isBare` is not exported from `@/app/layout`

- [ ] **Step 3: Modify the layout**

Extract the bare-route predicate so it is testable, and render both new pieces of chrome in the non-shell branch.

```tsx
/** Routes that must never show the shell. A rail on the contributor-terms
    gate is an escape hatch out of a gate — every link bounces straight back. */
const BARE_PREFIXES = ['/login', '/signup', '/auth', '/onboarding']

/** Exported for tests: the layout is async and reads headers(), so the rule is
    verified here rather than by rendering the whole tree. */
export function isBare(pathname: string): boolean {
  return BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
```

Then in the component, replace the `bare` assignment and the fallback branch:

```tsx
  const bare = isBare(pathname)

  const shell = bare ? null : await AppShell({ children })

  return (
    <html lang="en" className={nunito.variable}>
      <body className="min-h-screen font-sans antialiased">
        {shell ?? (
          <>
            <Nav role={await getUserRole()} />
            {!bare && <SectionNav pathname={pathname} />}
            <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
              {children}
            </main>
            {!bare && <PublicFooter />}
          </>
        )}
      </body>
    </html>
  )
```

Add imports:

```tsx
import { SectionNav } from '@/components/section-nav'
import { PublicFooter } from '@/components/public-footer'
```

Note the footer is deliberately inside the non-shell branch only: a signed-in user gets `AppShell`, whose rail already lists everything they need, and duplicating a 40-link sitemap under a dashboard is noise.

- [ ] **Step 4: Open `/organizations` to the public**

In `packages/web/middleware.ts`, remove `'/organizations'` from `signedInRoutes`:

```ts
  const signedInRoutes = ['/upload', '/dashboard']
```

Leave `termsGatedPrefixes` untouched — it still contains `/organizations`, which is correct: *reading* the directory is public, but a leader acting inside an organisation still needs to have accepted contributor terms. Task 12 handles the page's data source.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run tests/unit/app/layout-chrome.test.tsx`
Expected: PASS, 5 tests

- [ ] **Step 6: Commit**

```bash
git add packages/web/app/layout.tsx packages/web/middleware.ts packages/web/tests/unit/app/layout-chrome.test.tsx
git commit -m "feat(web): render subnav and sitemap footer on public routes"
```

---

## Task 6: Illustrations and the editorial image component

**Files:**
- Create: `packages/web/public/illustrations/adapted-toy.svg`, `switch.svg`, `printer.svg`, `family.svg`, `maker.svg`, `organisation.svg`, `bear-on-shelf.svg`
- Create: `packages/web/components/editorial-image.tsx`
- Test: `packages/web/tests/unit/components/editorial-image.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `IllustrationKey` union type and `<EditorialImage src? illustration ratio caption? />`.

**Context for the implementer:** these illustrations are placeholders with a known replacement — the team will supply its own workshop photographs. That is why the component is built around a `src` prop and a credit `caption` from day one rather than hard-coding the SVGs into pages. Do not use stock photography: rights aside, a disability platform whose warmth comes from purchased images of children who are not its users is trading on something it has not earned.

Register for the SVGs: flat, single hue from the brand palette, no gradients, no photographic detail, and **faceless**. Faceless avoids depicting a particular child and means one illustration serves every family reading the page.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/components/editorial-image.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditorialImage } from '@/components/editorial-image'

describe('EditorialImage', () => {
  it('falls back to the illustration when there is no photo', () => {
    const { container } = render(<EditorialImage illustration="switch" ratio="3/2" />)
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toContain('/illustrations/switch.svg')
  })

  it('prefers a real photo when one exists', () => {
    const { container } = render(
      <EditorialImage src="/photos/workshop.jpg" illustration="switch" ratio="3/2" />
    )
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toContain('workshop.jpg')
  })

  // Decorative in both states: every slot has a heading beside it, so naming the
  // subject here would be a duplicate announcement. Same rule as CardPhoto.
  it('keeps alt empty whether it renders a photo or an illustration', () => {
    const { container: a } = render(<EditorialImage illustration="printer" ratio="2/1" />)
    expect(a.querySelector('img')).toHaveAttribute('alt', '')
    const { container: b } = render(
      <EditorialImage src="/photos/p.jpg" illustration="printer" ratio="2/1" />
    )
    expect(b.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('credits a real photo when a caption is given', () => {
    render(
      <EditorialImage src="/photos/p.jpg" illustration="family" ratio="3/2" caption="Photo: SPLAT workshop" />
    )
    expect(screen.getByText('Photo: SPLAT workshop')).toBeInTheDocument()
  })

  it('never credits an illustration, even if a caption is passed', () => {
    render(<EditorialImage illustration="family" ratio="3/2" caption="Photo: SPLAT workshop" />)
    expect(screen.queryByText('Photo: SPLAT workshop')).toBeNull()
  })

  it('applies the fixed ratio so a later photo cannot reflow the page', () => {
    const { container } = render(<EditorialImage illustration="maker" ratio="1/1" />)
    expect(container.querySelector('[data-ratio="1/1"]')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run tests/unit/components/editorial-image.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/editorial-image"`

- [ ] **Step 3: Write the component**

```tsx
// packages/web/components/editorial-image.tsx
/**
 * The image slot for editorial pages — homepage, Learn, Get Involved, About.
 *
 * Guides and toys carry photos their makers uploaded, with consent inside the
 * upload flow (components/card-photo.tsx handles those). Editorial pages have no
 * such source, so a flat brand illustration holds each slot until the team's own
 * workshop photographs exist. Filling in `src` is then the entire change: the
 * ratio is already fixed, so a real photo cannot reflow the page around it.
 *
 * Decorative in both states, like CardPhoto: every slot sits beside a heading
 * that already names the subject.
 */
import Image from 'next/image'

export type IllustrationKey =
  | 'adapted-toy'
  | 'switch'
  | 'printer'
  | 'family'
  | 'maker'
  | 'organisation'
  | 'bear-on-shelf'

export type ImageRatio = '3/2' | '2/1' | '1/1'

const RATIO_CLASS: Record<ImageRatio, string> = {
  '3/2': 'aspect-3/2',
  '2/1': 'aspect-2/1',
  '1/1': 'aspect-square',
}

export function EditorialImage({
  src,
  illustration,
  ratio,
  caption,
}: {
  /** A real, consented photograph once one exists. */
  src?: string | null
  illustration: IllustrationKey
  ratio: ImageRatio
  /** Credit line. Rendered only alongside a real photo. */
  caption?: string
}) {
  const isPhoto = Boolean(src)

  return (
    <figure className="m-0">
      <div
        data-ratio={ratio}
        className={`relative w-full overflow-hidden rounded-[14px] ${RATIO_CLASS[ratio]} ${
          isPhoto ? 'bg-sunken' : 'bg-brand-tint'
        }`}
      >
        <Image
          src={src || `/illustrations/${illustration}.svg`}
          alt=""
          fill
          className={isPhoto ? 'object-cover' : 'object-contain p-4'}
        />
      </div>
      {isPhoto && caption && (
        <figcaption className="mt-2 text-xs text-muted">{caption}</figcaption>
      )}
    </figure>
  )
}
```

Add the two non-default aspect utilities to `app/globals.css` inside the existing `@theme` block if Tailwind v4 does not resolve `aspect-3/2` and `aspect-2/1` natively:

```css
  --aspect-3\/2: 3 / 2;
  --aspect-2\/1: 2 / 1;
```

- [ ] **Step 4: Draw the seven illustrations**

Each is a standalone `.svg` at `viewBox="0 0 300 200"` (or `0 0 200 200` for `organisation`, used at `1/1`), no `<style>` blocks, no external references, colours drawn from `#d8ecf7` (brand-tint) as ground with `#1998d5` / `#0f6f9c` shapes. Faceless. Under 3 KB each.

`switch.svg` — a large round switch with a hand shape approaching it and a cable leaving frame:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200" aria-hidden="true">
  <rect width="300" height="200" fill="#d8ecf7"/>
  <ellipse cx="150" cy="168" rx="86" ry="12" fill="#1998d5" opacity=".16"/>
  <rect x="98" y="122" width="104" height="30" rx="9" fill="#1998d5" opacity=".3"/>
  <circle cx="150" cy="112" r="42" fill="#1998d5"/>
  <circle cx="136" cy="98" r="12" fill="#ffffff" opacity=".35"/>
  <path d="M150 60q6-26 26-30 8-2 8 6 0 10-10 18 14-6 24-2 8 4 2 11-8 9-22 11" fill="none" stroke="#0f6f9c" stroke-width="7" stroke-linecap="round"/>
  <path d="M196 128q40 0 46 34" fill="none" stroke="#0f6f9c" stroke-width="6" stroke-linecap="round" opacity=".7"/>
</svg>
```

`adapted-toy.svg` — a soft toy with a cable running to a switch jack:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200" aria-hidden="true">
  <rect width="300" height="200" fill="#d8ecf7"/>
  <ellipse cx="150" cy="170" rx="80" ry="11" fill="#1998d5" opacity=".16"/>
  <circle cx="118" cy="70" r="19" fill="#1998d5" opacity=".75"/>
  <circle cx="182" cy="70" r="19" fill="#1998d5" opacity=".75"/>
  <circle cx="150" cy="104" r="46" fill="#1998d5"/>
  <circle cx="134" cy="96" r="6" fill="#ffffff"/>
  <circle cx="166" cy="96" r="6" fill="#ffffff"/>
  <path d="M138 118q12 10 24 0" stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M192 128q46 8 34 48" stroke="#0f6f9c" stroke-width="6" fill="none" stroke-linecap="round"/>
  <rect x="214" y="168" width="26" height="15" rx="4" fill="#0f6f9c"/>
</svg>
```

`printer.svg` — a printer frame with a part built in visible layers:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200" aria-hidden="true">
  <rect width="300" height="200" fill="#d8ecf7"/>
  <rect x="66" y="40" width="168" height="120" rx="10" fill="none" stroke="#0f6f9c" stroke-width="6"/>
  <rect x="86" y="140" width="128" height="9" rx="4" fill="#0f6f9c" opacity=".6"/>
  <rect x="120" y="112" width="60" height="28" fill="#1998d5"/>
  <rect x="126" y="100" width="48" height="12" fill="#1998d5" opacity=".7"/>
  <rect x="132" y="90" width="36" height="10" fill="#1998d5" opacity=".4"/>
  <rect x="138" y="58" width="24" height="26" rx="5" fill="#0f6f9c"/>
  <path d="M150 84v6" stroke="#1998d5" stroke-width="5" stroke-linecap="round"/>
</svg>
```

`family.svg`, `maker.svg`, `organisation.svg`, `bear-on-shelf.svg` — same register:
- `family` — two tall faceless figures and one short one, shoulders overlapping, a toy shape at the small figure's feet.
- `maker` — a faceless figure at a bench, a soldering-iron silhouette and a spool of wire, one hand raised.
- `organisation` — a simple building front with three windows and a door, a small tree beside it. Square `viewBox="0 0 200 200"`.
- `bear-on-shelf` — a bear silhouette on a shelf bracket with two smaller boxes beside it, suggesting stock held for handover.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run tests/unit/components/editorial-image.test.tsx`
Expected: PASS, 6 tests

- [ ] **Step 6: Verify the SVGs render**

Run: `cd packages/web && pnpm dev`, then open `http://localhost:3000/illustrations/switch.svg` and each of the other six. Expected: each renders, no console errors, no missing-glyph or external-reference warnings.

- [ ] **Step 7: Commit**

```bash
git add packages/web/public/illustrations packages/web/components/editorial-image.tsx packages/web/tests/unit/components/editorial-image.test.tsx packages/web/app/globals.css
git commit -m "feat(web): brand illustrations and the editorial image slot"
```

---

## Task 7: Hub grid component

**Files:**
- Create: `packages/web/components/hub-grid.tsx`
- Test: `packages/web/tests/unit/components/hub-grid.test.tsx`

**Interfaces:**
- Consumes: `NavItem` from Task 1.
- Produces: `<HubGrid items={NavItem[]} />`. Used by all four hub pages, so the card treatment is defined once.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/components/hub-grid.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HubGrid } from '@/components/hub-grid'
import type { NavItem } from '@/lib/public-nav'

const items: NavItem[] = [
  { href: '/learn/switch-types' as NavItem['href'], label: 'Switch types', state: 'live', blurb: 'Which switch suits which child.' },
  { href: '/learn/ask-an-expert' as NavItem['href'], label: 'Ask an expert', state: 'soon', featureKey: 'ask-an-expert', blurb: 'Put a question to an OT.' },
]

describe('HubGrid', () => {
  it('links each item and shows its blurb', () => {
    render(<HubGrid items={items} />)
    expect(screen.getByRole('link', { name: /switch types/i })).toHaveAttribute(
      'href',
      '/learn/switch-types'
    )
    expect(screen.getByText('Which switch suits which child.')).toBeInTheDocument()
  })

  it('marks a not-yet-built item', () => {
    render(<HubGrid items={items} />)
    expect(screen.getByRole('link', { name: /ask an expert/i })).toHaveTextContent(/soon/i)
  })

  it('does not mark a live item', () => {
    render(<HubGrid items={items} />)
    expect(screen.getByRole('link', { name: /switch types/i })).not.toHaveTextContent(/soon/i)
  })

  it('renders nothing for an empty list rather than an empty grid', () => {
    const { container } = render(<HubGrid items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run tests/unit/components/hub-grid.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/hub-grid"`

- [ ] **Step 3: Write the implementation**

```tsx
// packages/web/components/hub-grid.tsx
/**
 * The card grid every hub page uses.
 *
 * This is the component that replaces a dropdown menu: the breadth a menu would
 * have hidden is rendered as a page instead, with room for a sentence per
 * destination that a menu never had.
 */
import Link from 'next/link'
import type { NavItem } from '@/lib/public-nav'

export function HubGrid({ items }: { items: NavItem[] }) {
  if (items.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="card card-link p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-ink">{item.label}</h3>
            {item.state === 'soon' && (
              <span className="badge bg-honey-soft text-honey-deep">SOON</span>
            )}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.blurb}</p>
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run tests/unit/components/hub-grid.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/hub-grid.tsx packages/web/tests/unit/components/hub-grid.test.tsx
git commit -m "feat(web): shared hub card grid"
```

---

## Task 8: Trust and legal pages

**Files:**
- Create: `packages/web/app/privacy/page.tsx`, `app/terms/page.tsx`, `app/safety/page.tsx`, `app/code-of-conduct/page.tsx`
- Create: `packages/web/components/prose-page.tsx`
- Test: `packages/web/tests/unit/app/trust-pages.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `<ProsePage title lastUpdated>{children}</ProsePage>`, reused by all four pages and by the Learn articles in Task 13.

**Why these come before the email capture:** Task 9 collects email addresses. A site that collects contact details without a published privacy policy is not shippable, and the platform *already* holds children's ability data (`child_profiles`) and families' structured pickup addresses snapshotted onto toy transactions. This task closes a gap that predates the email capture.

**Flag for the user:** the copy below is a substantive first draft written to be accurate about what this codebase actually does. It is not legal advice and needs review by someone qualified before the pages go live. Do not water it down to placeholders — a vague privacy policy is worse than a specific one.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/app/trust-pages.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrivacyPage from '@/app/privacy/page'
import TermsPage from '@/app/terms/page'
import SafetyPage from '@/app/safety/page'
import CodeOfConductPage from '@/app/code-of-conduct/page'

describe('trust pages', () => {
  it('gives the privacy policy a heading and a last-updated date', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeInTheDocument()
    expect(screen.getByText(/last updated/i)).toBeInTheDocument()
  })

  // The three things this platform holds that a generic policy would miss.
  it('names the sensitive data the platform actually holds', () => {
    render(<PrivacyPage />)
    expect(screen.getByText(/child profile/i)).toBeInTheDocument()
    expect(screen.getByText(/pickup address/i)).toBeInTheDocument()
    expect(screen.getByText(/email address/i)).toBeInTheDocument()
  })

  it('tells people how to get their data deleted', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact')
  })

  it('renders the terms of use', () => {
    render(<TermsPage />)
    expect(screen.getByRole('heading', { level: 1, name: /terms of use/i })).toBeInTheDocument()
  })

  it('warns about the specific hazards of adapting toys', () => {
    render(<SafetyPage />)
    expect(screen.getByRole('heading', { level: 1, name: /safety/i })).toBeInTheDocument()
    expect(screen.getByText(/small parts/i)).toBeInTheDocument()
    expect(screen.getByText(/button cell|coin cell/i)).toBeInTheDocument()
  })

  it('renders the code of conduct with a reporting route', () => {
    render(<CodeOfConductPage />)
    expect(screen.getByRole('heading', { level: 1, name: /code of conduct/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run tests/unit/app/trust-pages.test.tsx`
Expected: FAIL — `Failed to resolve import "@/app/privacy/page"`

- [ ] **Step 3: Write the shared prose wrapper**

```tsx
// packages/web/components/prose-page.tsx
/**
 * The long-form page frame: trust pages and Learn articles.
 *
 * Measure is capped at ~68 characters via max-w-prose because these are the only
 * pages on the site people actually read top to bottom, and the 6xl layout
 * container is far too wide for that.
 */
export function ProsePage({
  title,
  lastUpdated,
  intro,
  children,
}: {
  title: string
  /** Trust pages only. Learn articles omit it. */
  lastUpdated?: string
  intro?: string
  children: React.ReactNode
}) {
  return (
    <article className="mx-auto max-w-prose">
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
      {lastUpdated && (
        <p className="mt-2 text-sm text-muted">Last updated {lastUpdated}</p>
      )}
      {intro && (
        <p className="mt-4 text-base leading-relaxed text-ink">{intro}</p>
      )}
      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-muted [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_h3]:font-bold [&_h3]:text-ink [&_li]:mt-1.5 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </article>
  )
}
```

- [ ] **Step 4: Write `app/privacy/page.tsx`**

```tsx
import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'

export const metadata = { title: 'Privacy policy — SPLAT Connect' }

export default function PrivacyPage() {
  return (
    <ProsePage
      title="Privacy policy"
      lastUpdated="19 August 2026"
      intro="SPLAT Connect is used by families describing their children's needs. We collect as little as the platform can function on, and we say plainly what happens to it."
    >
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Your account.</strong> An email address and a display name. The
            email address identifies your account and is where we send confirmations
            and notifications. Your display name appears publicly next to guides you
            are credited on.
          </li>
          <li>
            <strong>Child profile information.</strong> If you create a child profile,
            we store the name or nickname you enter, and the abilities and preferences
            you record so guides can be matched to them. This is the most sensitive
            data on the platform. It is visible only to your account. It is never
            published, never shown on a public page, and never shared with
            contributors or organisations.
          </li>
          <li>
            <strong>Toys and guides you publish.</strong> Titles, descriptions, parts
            lists, photographs and files you upload. These are public by design.
          </li>
          <li>
            <strong>Pickup addresses.</strong> When you accept a toy exchange or
            donation, the address you provide is recorded on that transaction so the
            other party can collect or deliver. It is visible to the other party in
            that single transaction and to nobody else.
          </li>
          <li>
            <strong>Interest registrations.</strong> If you ask to be told when a
            feature launches, we store your email address against that feature and
            nothing else.
          </li>
        </ul>
      </section>

      <section>
        <h2>What we do not do</h2>
        <ul>
          <li>We do not sell or rent personal information.</li>
          <li>We do not run advertising, and we do not share data with advertisers.</li>
          <li>
            We do not publish child profile data, in any aggregated or anonymised
            form, on any public page.
          </li>
        </ul>
      </section>

      <section>
        <h2>Public by design</h2>
        <p>
          Some information is public because the platform would not work otherwise:
          your display name on guides you are credited on, guides and toys you
          publish, and your contributor profile. You can remove your contributor
          profile and your name from the public impact pages at any time from your
          dashboard — this does not remove per-guide credit, which stays attached to
          the work.
        </p>
      </section>

      <section>
        <h2>Where it is stored</h2>
        <p>
          Data is held in Supabase (PostgreSQL and object storage). Access is
          restricted at the database level by row-level security, so one account
          cannot read another account&apos;s private records even if application code
          were to ask for them.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          Accounts are for adults. Child profiles are created and managed by a parent
          or carer from their own account; children do not have accounts of their own.
          We ask for the minimum needed to match a guide to a child, and we recommend
          using a first name or nickname rather than a full legal name.
        </p>
      </section>

      <section>
        <h2>Getting your data, or getting it deleted</h2>
        <p>
          You can delete a child profile, a toy, or a draft guide yourself at any time
          from your dashboard. To request a copy of everything associated with your
          account, or deletion of the account entirely, <Link href="/contact">contact
          us</Link>. Deleting an account removes your child profiles, your unpublished
          work and your pickup addresses. Published guides that other people have
          contributed to remain, with your name removed unless you ask otherwise.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          When this policy changes materially we will update the date above and notify
          account holders by email rather than changing it quietly.
        </p>
      </section>
    </ProsePage>
  )
}
```

- [ ] **Step 5: Write `app/terms/page.tsx`**

```tsx
import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'

export const metadata = { title: 'Terms of use — SPLAT Connect' }

export default function TermsPage() {
  return (
    <ProsePage
      title="Terms of use"
      lastUpdated="19 August 2026"
      intro="These terms cover using this site. If you publish guides there are additional contributor terms, and if you lead an organisation there are organisation leader terms."
    >
      <section>
        <h2>What SPLAT Connect is</h2>
        <p>
          A free library of instructions for adapting commercially available toys so
          that children with disabilities can operate them, plus a way for people and
          organisations to pass on toys they have adapted. We publish and moderate the
          library. We do not manufacture, sell, or supply toys, parts or devices.
        </p>
      </section>

      <section>
        <h2>Guides are instructions, not products</h2>
        <p>
          Every guide is written by a volunteer and reviewed before publication.
          Review means someone competent read it and stood behind it; it is not
          certification, and it is not a substitute for your own judgement. You are
          responsible for the work you do and for deciding whether the result is safe
          for the child who will use it. Please read the <Link href="/safety">safety
          page</Link> before you start.
        </p>
      </section>

      <section>
        <h2>Adapting a toy voids its warranty</h2>
        <p>
          Opening a toy to fit a switch will void the manufacturer&apos;s warranty and
          may breach its terms of sale. That is a decision for you to make about
          property you own.
        </p>
      </section>

      <section>
        <h2>Toy exchanges and donations happen between people</h2>
        <p>
          When you arrange to give or receive a toy through this site, the arrangement
          is between you and the other party. SPLAT provides the introduction, the
          messaging thread and the handover confirmation. We do not inspect toys, hold
          payment, or guarantee that anyone turns up. Meet somewhere sensible, and use
          the platform&apos;s confirmation codes rather than agreeing offline.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>Give accurate information, and keep your sign-in details to yourself.</li>
          <li>One account per person.</li>
          <li>
            Do not upload anything you do not have the right to share, and do not
            upload photographs of other people&apos;s children.
          </li>
          <li>
            We may suspend an account that puts children at risk, misrepresents an
            organisation, or repeatedly breaches the <Link href="/code-of-conduct">code
            of conduct</Link>.
          </li>
        </ul>
      </section>

      <section>
        <h2>Content you publish</h2>
        <p>
          You keep ownership of what you write and upload. By publishing it here you
          give SPLAT permission to host it, display it, and let others use it to adapt
          toys. Licensing specifics for guides and design files are set out in the
          <Link href="/legal/contributor-terms"> contributor terms</Link>.
        </p>
      </section>

      <section>
        <h2>Availability</h2>
        <p>
          This is a free service run by a small team. We do not promise uptime, and
          features may change or be withdrawn. Keep your own copy of anything you
          would be sorry to lose.
        </p>
      </section>

      <section>
        <h2>Questions</h2>
        <p>
          <Link href="/contact">Contact us</Link> if anything here is unclear.
        </p>
      </section>
    </ProsePage>
  )
}
```

- [ ] **Step 6: Write `app/safety/page.tsx`**

```tsx
import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'

export const metadata = { title: 'Safety — SPLAT Connect' }

export default function SafetyPage() {
  return (
    <ProsePage
      title="Safety"
      lastUpdated="19 August 2026"
      intro="Adapting a toy means opening it, working near batteries, and handing the result to a child who may explore it with their mouth. None of that is dangerous if you know what to watch for."
    >
      <section>
        <h2>Batteries</h2>
        <ul>
          <li>
            <strong>Button cell and coin cell batteries are the most serious hazard on
            this page.</strong> Swallowed, they can cause severe internal burns within
            hours. If a toy uses one, the compartment must close with a screw, and you
            must check that screw is present and tight before handover. If you cannot
            secure it, do not adapt that toy.
          </li>
          <li>
            Never adapt a toy that runs on mains power or has a mains adapter. Stick to
            AA, AAA, C and D cells, or a screw-secured button cell.
          </li>
          <li>
            Do not mix old and new cells, or different chemistries, in the same toy.
          </li>
          <li>
            A battery interrupter goes between one battery and its contact. It does not
            change the toy&apos;s voltage and must never be used to connect a toy to
            anything other than a switch.
          </li>
        </ul>
      </section>

      <section>
        <h2>Small parts</h2>
        <ul>
          <li>
            Screws, springs, cable ties, offcuts of wire and 3D-printed fragments are
            all choking hazards. Work over a tray, and count screws back in.
          </li>
          <li>
            If the child will mouth the toy, avoid adaptations that add anything
            smaller than a 35 mm cylinder — the standard small-parts test size — that
            can come loose.
          </li>
          <li>
            Trim cable ties flush. A cut tie end is sharp.
          </li>
        </ul>
      </section>

      <section>
        <h2>Wiring and soldering</h2>
        <ul>
          <li>
            Solder in a ventilated space, away from children and pets, and let the iron
            cool in its stand before you move it.
          </li>
          <li>
            Insulate every joint with heat-shrink or tape. Bare copper inside a toy
            that gets shaken will eventually short.
          </li>
          <li>
            Strain-relieve the cable where it leaves the toy body, so pulling on the
            switch lead cannot tear the joint out.
          </li>
          <li>
            Use 3.5 mm mono sockets, the standard across assistive switches, so the toy
            works with switches the family may already own.
          </li>
        </ul>
      </section>

      <section>
        <h2>3D-printed parts</h2>
        <ul>
          <li>
            Sand or file every printed edge that a hand will touch. Layer lines are
            sharper than they look.
          </li>
          <li>
            Printed parts are not food safe and should not go in a dishwasher — heat
            will deform PLA. Wipe with warm soapy water instead.
          </li>
          <li>
            Print at a high enough infill that a part cannot snap into shards. Guides
            state their recommended settings; follow them.
          </li>
        </ul>
      </section>

      <section>
        <h2>Before you hand a toy over</h2>
        <ul>
          <li>Shake it hard. Listen for anything loose inside.</li>
          <li>Check every screw, especially the battery compartment.</li>
          <li>Pull firmly on the switch lead. It should not move at the toy end.</li>
          <li>Wipe the outside down, and tell the family how to clean it.</li>
          <li>
            Say what you changed. A parent needs to know there is a modified battery
            compartment in there.
          </li>
        </ul>
      </section>

      <section>
        <h2>Supervision</h2>
        <p>
          An adapted toy is still a toy, with the manufacturer&apos;s age rating and
          the same supervision needs as before — plus the changes you made. Nothing on
          this site replaces a clinician&apos;s advice about what is appropriate for a
          particular child.
        </p>
      </section>

      <section>
        <h2>If something goes wrong</h2>
        <p>
          Tell us. If a published guide has a safety problem,
          <Link href="/contact"> contact us</Link> and we will take it down while we
          check. We would much rather pull a guide than leave a hazard up.
        </p>
      </section>
    </ProsePage>
  )
}
```

- [ ] **Step 7: Write `app/code-of-conduct/page.tsx`**

```tsx
import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'

export const metadata = { title: 'Code of conduct — SPLAT Connect' }

export default function CodeOfConductPage() {
  return (
    <ProsePage
      title="Code of conduct"
      lastUpdated="19 August 2026"
      intro="This platform exists because people give their time to children they will mostly never meet. That deserves a space where everyone involved is treated well."
    >
      <section>
        <h2>What we expect</h2>
        <ul>
          <li>
            <strong>Assume good faith.</strong> A guide with a mistake in it was
            written by a volunteer at their kitchen table. Say what is wrong, kindly.
          </li>
          <li>
            <strong>Respect how people describe themselves and their children.</strong>
            Follow the language a family uses about their own child, not the language
            you would choose.
          </li>
          <li>
            <strong>Keep private things private.</strong> Addresses, photographs and
            details about a child that you learn through an exchange stay between you
            and that family.
          </li>
          <li>
            <strong>Be straight about what you can do.</strong> If you claim a build
            and cannot finish it, say so early. Nobody minds. Silence is what hurts.
          </li>
        </ul>
      </section>

      <section>
        <h2>What is not acceptable</h2>
        <ul>
          <li>
            Harassment, or demeaning language about disability, race, gender,
            sexuality, religion or age.
          </li>
          <li>
            Contacting a family outside the platform without their agreement, or
            pressuring anyone into an exchange.
          </li>
          <li>
            Publishing photographs of a child who is not yours, or identifying details
            about a child.
          </li>
          <li>
            Using the platform to sell, advertise, or solicit donations for yourself.
          </li>
          <li>
            Claiming an organisation&apos;s backing, or a qualification, that you do
            not have.
          </li>
          <li>
            Knowingly publishing an adaptation you believe to be unsafe.
          </li>
        </ul>
      </section>

      <section>
        <h2>Reporting</h2>
        <p>
          <Link href="/contact">Contact us</Link> with what happened and where. Reports
          go to the SPLAT team, not to the person you are reporting. We will tell you
          what we decided.
        </p>
      </section>

      <section>
        <h2>What we do about it</h2>
        <p>
          Depending on what happened: a private word, removal of content, suspension of
          an account, or removal of an organisation&apos;s ability to back work.
          Anything involving risk to a child is acted on immediately and, where
          appropriate, referred to the relevant authorities.
        </p>
      </section>
    </ProsePage>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run tests/unit/app/trust-pages.test.tsx`
Expected: PASS, 6 tests

- [ ] **Step 9: Commit**

```bash
git add packages/web/components/prose-page.tsx packages/web/app/privacy packages/web/app/terms packages/web/app/safety packages/web/app/code-of-conduct packages/web/tests/unit/app/trust-pages.test.tsx
git commit -m "feat(web): privacy, terms, safety and code of conduct pages"
```

---

## Task 9: Notify signups — schema and endpoint

**Files:**
- Create: `supabase/migrations/035_notify_signups.sql`
- Modify: `packages/api/src/routes/public.ts`
- Test: `packages/api/tests/integration/public/notify.test.ts`

**Interfaces:**
- Consumes: `createAnonClient()` from `packages/api/src/supabase/client.js`.
- Produces: `POST /api/public/notify` accepting `{ email: string, featureKey: string }`, returning `200 { ok: true }` or `400 { error: string }`.

**Why an allowlist:** without one, `feature_key` is an open write target for arbitrary strings from the internet. The nine valid keys are `ask-an-expert`, `requests`, `design-challenges`, `printing`, `news`, `events`, `map`, `partners`, `support`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/035_notify_signups.sql
--
-- Interest registrations from the nine scaffold pages.
--
-- Insert-only by design: there is no select policy for anon or authenticated, so
-- the list is readable through the service role alone (i.e. the Supabase console).
-- An admin UI for a table checked a handful of times would be the wrong instinct;
-- if a single feature's list passes a few hundred, revisit.

create table public.notify_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  feature_key text not null,
  created_at timestamptz not null default now(),
  -- Registering twice for the same feature is not an error worth surfacing, so the
  -- endpoint swallows the violation this constraint raises.
  unique (email, feature_key)
);

alter table public.notify_signups enable row level security;

create policy "anyone may register interest"
  on public.notify_signups for insert to anon, authenticated
  with check (true);

grant insert on public.notify_signups to anon, authenticated;
```

- [ ] **Step 2: Apply the migration**

Run: `cd /Users/byronpetselis/Documents/splat-connect && npx supabase db push`
Expected: `035_notify_signups.sql` applied. Verify with `npx supabase db diff` reporting no drift.

- [ ] **Step 3: Write the failing test**

```ts
// packages/api/tests/integration/public/notify.test.ts
import { describe, it, expect } from 'vitest'
import app from '../../../src/app.js'

const post = (body: unknown) =>
  app.request('/api/public/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/public/notify', () => {
  it('accepts a registration with no Authorization header', async () => {
    const res = await post({ email: `notify-${Date.now()}@example.com`, featureKey: 'requests' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('rejects a feature key that is not on the allowlist', async () => {
    const res = await post({ email: 'x@example.com', featureKey: 'not-a-feature' })
    expect(res.status).toBe(400)
  })

  it('rejects a malformed email', async () => {
    const res = await post({ email: 'nope', featureKey: 'requests' })
    expect(res.status).toBe(400)
  })

  it('rejects a missing body field', async () => {
    const res = await post({ featureKey: 'requests' })
    expect(res.status).toBe(400)
  })

  // Two responses would leak whether an address is already on a list, and a
  // duplicate is not something the visitor needs to hear about.
  it('treats a duplicate registration as success', async () => {
    const email = `dupe-${Date.now()}@example.com`
    const first = await post({ email, featureKey: 'events' })
    const second = await post({ email, featureKey: 'events' })
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
  })

  it('lets the same address register for two different features', async () => {
    const email = `multi-${Date.now()}@example.com`
    expect((await post({ email, featureKey: 'news' })).status).toBe(200)
    expect((await post({ email, featureKey: 'map' })).status).toBe(200)
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd packages/api && pnpm vitest run tests/integration/public/notify.test.ts`
Expected: FAIL — 404, the route does not exist.

- [ ] **Step 5: Add the endpoint to `packages/api/src/routes/public.ts`**

```ts
/**
 * Interest registration from the nine scaffold pages.
 *
 * The allowlist is the security boundary: without it feature_key is an open write
 * target for arbitrary strings. Keys mirror lib/public-nav.ts SCAFFOLD_KEYS — if
 * one is added there, add it here.
 */
const NOTIFY_FEATURE_KEYS = new Set([
  'ask-an-expert',
  'requests',
  'design-challenges',
  'printing',
  'news',
  'events',
  'map',
  'partners',
  'support',
])

/** Shape only. Deliverability is not our problem until we send something. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

publicRoutes.post('/notify', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Expected a JSON body' }, 400)
  }

  const { email, featureKey } = (body ?? {}) as { email?: unknown; featureKey?: unknown }

  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return c.json({ error: 'A valid email address is required' }, 400)
  }
  if (typeof featureKey !== 'string' || !NOTIFY_FEATURE_KEYS.has(featureKey)) {
    return c.json({ error: 'Unknown feature' }, 400)
  }

  const supabase = createAnonClient()
  const { error } = await supabase
    .from('notify_signups')
    .insert({ email: email.trim().toLowerCase(), feature_key: featureKey })

  // 23505 is unique_violation: already registered, which is a success from the
  // visitor's point of view. Distinguishing it would leak list membership.
  if (error && error.code !== '23505') {
    console.error('[public/notify] insert failed:', error.message)
    return c.json({ error: 'Could not register interest' }, 500)
  }

  return c.json({ ok: true })
})
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/api && pnpm vitest run tests/integration/public/notify.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/035_notify_signups.sql packages/api/src/routes/public.ts packages/api/tests/integration/public/notify.test.ts
git commit -m "feat(api): notify signups table and public registration endpoint"
```

---

## Task 10: Notify form and the extended ComingSoon

**Files:**
- Create: `packages/web/components/notify-form.tsx`
- Modify: `packages/web/components/coming-soon.tsx`
- Test: `packages/web/tests/unit/components/notify-form.test.tsx`
- Test: `packages/web/tests/unit/components/coming-soon.test.tsx` (existing — update)

**Interfaces:**
- Consumes: `POST /api/public/notify` from Task 9.
- Produces: `<NotifyForm featureKey={string} />` and an extended `<ComingSoon label description steps featureKey? />`.

**Deliberate copy break:** the existing heading *"{label} is coming soon."* is pinned by a unit test and shared verbatim with `packages/mobile/components/coming-soon.tsx`. The web heading becomes the feature name with "Not built yet — here's the plan." as the promise line. Update the web test; **leave the mobile component alone**. The two surfaces diverge here because the web page now does something the mobile one does not.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/components/notify-form.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotifyForm } from '@/components/notify-form'

describe('NotifyForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('posts the email and the feature key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<NotifyForm featureKey="requests" />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@example.com')
    await userEvent.click(screen.getByRole('button', { name: /tell me/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ email: 'a@example.com', featureKey: 'requests' })
  })

  it('confirms once it succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }))
    render(<NotifyForm featureKey="events" />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@example.com')
    await userEvent.click(screen.getByRole('button', { name: /tell me/i }))
    expect(await screen.findByText(/we'll email you/i)).toBeInTheDocument()
  })

  // A failed submit must not eat what the visitor typed.
  it('keeps the typed address when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<NotifyForm featureKey="news" />)
    const input = screen.getByLabelText(/email/i)
    await userEvent.type(input, 'keep@example.com')
    await userEvent.click(screen.getByRole('button', { name: /tell me/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(input).toHaveValue('keep@example.com')
  })
})
```

```tsx
// packages/web/tests/unit/components/coming-soon.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComingSoon } from '@/components/coming-soon'

const props = {
  label: 'Adaptation requests',
  description: 'Ask for a toy to be adapted for your child.',
  steps: ['Describe the toy', 'A maker claims it', 'They build and hand it over'],
}

describe('ComingSoon', () => {
  it('leads with the feature name and says plainly that it is not built', () => {
    render(<ComingSoon {...props} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Adaptation requests' })).toBeInTheDocument()
    expect(screen.getByText(/not built yet/i)).toBeInTheDocument()
  })

  it('explains how it will work', () => {
    render(<ComingSoon {...props} />)
    expect(screen.getByText('A maker claims it')).toBeInTheDocument()
  })

  // Never a dead end.
  it('always routes onward to something that works', () => {
    render(<ComingSoon {...props} />)
    expect(screen.getByRole('link', { name: /guides/i })).toHaveAttribute('href', '/library')
  })

  it('offers the notify form when a feature key is given', () => {
    render(<ComingSoon {...props} featureKey="requests" />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('omits the notify form when no feature key is given', () => {
    render(<ComingSoon {...props} />)
    expect(screen.queryByLabelText(/email/i)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/web && pnpm vitest run tests/unit/components/notify-form.test.tsx tests/unit/components/coming-soon.test.tsx`
Expected: FAIL — `NotifyForm` unresolved; `ComingSoon` still renders "is coming soon" and has no `featureKey`.

- [ ] **Step 3: Check whether `@testing-library/user-event` is installed**

Run: `cd packages/web && node -e "require.resolve('@testing-library/user-event')"`
If it errors, rewrite the two interaction tests using `fireEvent.change` and `fireEvent.click` from `@testing-library/react` instead — **do not add a dependency**, per the global constraints.

- [ ] **Step 4: Write `components/notify-form.tsx`**

```tsx
'use client'
/**
 * Email capture on a scaffold page.
 *
 * This is what makes a placeholder earn its route: nine "coming soon" pages that
 * only apologise spend goodwill, whereas nine that measure demand turn build
 * order from a guess into a ranked list.
 */
import { useState } from 'react'

type State = 'idle' | 'sending' | 'done' | 'error'

export function NotifyForm({ featureKey }: { featureKey: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>('idle')

  if (state === 'done') {
    return (
      <p className="mt-6 text-sm font-semibold text-mint-deep">
        Thanks — we&apos;ll email you when it&apos;s ready.
      </p>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('sending')
    try {
      const res = await fetch('/api/public/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, featureKey }),
      })
      // The typed address survives a failure — retyping it is the one thing that
      // would make someone give up.
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <form onSubmit={submit} className="mt-6">
      <label htmlFor={`notify-${featureKey}`} className="block text-sm font-semibold text-ink">
        Email address
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id={`notify-${featureKey}`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-field border border-line bg-surface px-3 py-2 text-sm text-ink"
        />
        <button type="submit" className="btn btn-accent shrink-0" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : "Tell me when it's ready"}
        </button>
      </div>
      {state === 'error' && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
          That didn&apos;t send. Try again in a moment.
        </p>
      )}
    </form>
  )
}
```

- [ ] **Step 5: Extend `components/coming-soon.tsx`**

Keep the file's existing doc comment, adding a note about the divergence from mobile. Change the signature and the heading block; leave the numbered steps and the closing CTA exactly as they are.

```tsx
export function ComingSoon({
  label,
  description,
  steps,
  featureKey,
}: {
  label: string
  description: string
  steps: string[]
  /** When set, the page offers to notify. Omit for a plain placeholder. */
  featureKey?: string
}) {
```

Replace the heading block inside the card:

```tsx
        <h1 className="mt-4 text-2xl font-bold text-ink">{label}</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          <strong className="text-ink">Not built yet</strong> — here&apos;s the plan.
        </p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{description}</p>
        {featureKey && (
          <div className="w-full max-w-md">
            <NotifyForm featureKey={featureKey} />
          </div>
        )}
```

Add the import:

```tsx
import { NotifyForm } from '@/components/notify-form'
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/web && pnpm vitest run tests/unit/components/notify-form.test.tsx tests/unit/components/coming-soon.test.tsx`
Expected: PASS, 9 tests

- [ ] **Step 7: Confirm mobile is untouched**

Run: `cd /Users/byronpetselis/Documents/splat-connect && git status --short packages/mobile`
Expected: empty. If `packages/mobile/components/coming-soon.tsx` was modified, revert it.

- [ ] **Step 8: Commit**

```bash
git add packages/web/components/notify-form.tsx packages/web/components/coming-soon.tsx packages/web/tests/unit/components/notify-form.test.tsx packages/web/tests/unit/components/coming-soon.test.tsx
git commit -m "feat(web): scaffold pages capture interest instead of only apologising"
```

---

## Task 11: The nine scaffold pages

**Files:**
- Create: `app/learn/ask-an-expert/page.tsx`, `app/get-involved/requests/page.tsx`, `app/get-involved/design-challenges/page.tsx`, `app/impact/news/page.tsx`, `app/impact/events/page.tsx`, `app/impact/map/page.tsx`, `app/about/partners/page.tsx`, `app/about/support/page.tsx`
- Modify: `packages/web/app/printing/page.tsx`
- Test: `packages/web/tests/unit/app/scaffold-pages.test.tsx`

**Interfaces:**
- Consumes: `<ComingSoon>` with `featureKey` (Task 10), `SCAFFOLD_KEYS` (Task 1).
- Produces: nine routes. No exports.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/app/scaffold-pages.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SCAFFOLD_KEYS } from '@/lib/public-nav'
import RequestsPage from '@/app/get-involved/requests/page'
import DesignChallengesPage from '@/app/get-involved/design-challenges/page'
import AskAnExpertPage from '@/app/learn/ask-an-expert/page'
import NewsPage from '@/app/impact/news/page'
import EventsPage from '@/app/impact/events/page'
import MapPage from '@/app/impact/map/page'
import PartnersPage from '@/app/about/partners/page'
import SupportPage from '@/app/about/support/page'
import PrintingPage from '@/app/printing/page'

const pages = [
  RequestsPage, DesignChallengesPage, AskAnExpertPage, NewsPage,
  EventsPage, MapPage, PartnersPage, SupportPage, PrintingPage,
]

describe('scaffold pages', () => {
  it('covers every scaffold key declared in the nav model', () => {
    expect(pages).toHaveLength(SCAFFOLD_KEYS.length)
  })

  it.each(pages.map((P, i) => [i, P] as const))(
    'page %i explains the plan and offers to notify',
    (_i, Page) => {
      render(<Page />)
      expect(screen.getByText(/not built yet/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: /how it will work/i })).toBeInTheDocument()
    }
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run tests/unit/app/scaffold-pages.test.tsx`
Expected: FAIL — unresolved imports for the eight new pages.

- [ ] **Step 3: Write the eight new pages**

Each is the same four-line shape. `label`, `description` and the three steps must match the `blurb` in `public-nav.ts` in substance so the hub card and the page agree.

```tsx
// app/get-involved/requests/page.tsx
import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'Adaptation requests — SPLAT Connect' }

export default function RequestsPage() {
  return (
    <ComingSoon
      featureKey="requests"
      label="Adaptation requests"
      description="Ask for a toy to be adapted for your child, and let a contributor or organisation near you pick it up."
      steps={[
        'Describe the toy and what your child needs it to do',
        'A contributor or organisation nearby claims the request',
        'They build it, then arrange handover through the platform',
      ]}
    />
  )
}
```

```tsx
// app/get-involved/design-challenges/page.tsx
import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'Design challenges — SPLAT Connect' }

export default function DesignChallengesPage() {
  return (
    <ComingSoon
      featureKey="design-challenges"
      label="Design challenges"
      description="Problems nobody has solved yet — a toy that resists adaptation, or a need no existing guide covers."
      steps={[
        'A family or therapist posts a problem with no known solution',
        'Anyone can work on it, alone or together, and share attempts',
        'A working answer becomes a guide in the library',
      ]}
    />
  )
}
```

```tsx
// app/learn/ask-an-expert/page.tsx
import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'Ask an expert — SPLAT Connect' }

export default function AskAnExpertPage() {
  return (
    <ComingSoon
      featureKey="ask-an-expert"
      label="Ask an expert"
      description="Put a question to an occupational therapist or an experienced maker, and read the answers to everyone else's."
      steps={[
        'Send a question about a switch, a toy or a child’s access needs',
        'An occupational therapist or experienced maker answers it',
        'The answer joins a searchable archive here in Learn',
      ]}
    />
  )
}
```

```tsx
// app/impact/news/page.tsx
import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'News and stories — SPLAT Connect' }

export default function NewsPage() {
  return (
    <ComingSoon
      featureKey="news"
      label="News and stories"
      description="What families and makers have actually done with SPLAT, in their own words."
      steps={[
        'A family or contributor shares what they made and what changed',
        'We write it up with their permission and their photographs',
        'It appears here and on the homepage',
      ]}
    />
  )
}
```

```tsx
// app/impact/events/page.tsx
import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'Events — SPLAT Connect' }

export default function EventsPage() {
  return (
    <ComingSoon
      featureKey="events"
      label="Events"
      description="Build days, workshops and wherever else you can find us in person."
      steps={[
        'Browse upcoming build days and workshops near you',
        'Register for one, or ask us to run one at your school or centre',
        'Toys built on the day go to local families',
      ]}
    />
  )
}
```

```tsx
// app/impact/map/page.tsx
import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'Deliveries map — SPLAT Connect' }

export default function MapPage() {
  return (
    <ComingSoon
      featureKey="map"
      label="Deliveries map"
      description="Where adapted toys have actually landed — a picture of the reach, without identifying anyone."
      steps={[
        'Every completed handover adds a point, by area rather than address',
        'Filter by state, or by the kind of toy',
        'See where there are makers, and where there are none yet',
      ]}
    />
  )
}
```

```tsx
// app/about/partners/page.tsx
import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'Partners and supporters — SPLAT Connect' }

export default function PartnersPage() {
  return (
    <ComingSoon
      featureKey="partners"
      label="Partners and supporters"
      description="The organisations, funders and suppliers who make the work possible."
      steps={[
        'Therapy services, schools and disability organisations we work with',
        'Funders and grant programs supporting the platform',
        'Suppliers donating parts, filament and printer time',
      ]}
    />
  )
}
```

```tsx
// app/about/support/page.tsx
import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'Support SPLAT — SPLAT Connect' }

export default function SupportPage() {
  return (
    <ComingSoon
      featureKey="support"
      label="Support SPLAT"
      description="Ways to help that don’t involve a soldering iron."
      steps={[
        'Donate parts, filament or printer time',
        'Fund a build day at a school or therapy centre',
        'Sponsor the platform so it stays free to use',
      ]}
    />
  )
}
```

- [ ] **Step 4: Rewrite `app/printing/page.tsx`**

The existing copy is reused verbatim from the mobile tab, and the mobile page keeps it. The web page gains the notify form and a heading matching the nav label.

```tsx
import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: '3D print requests — SPLAT Connect' }

export default function PrintingPage() {
  return (
    <ComingSoon
      featureKey="printing"
      label="3D print requests"
      description="Request a printed part at a public association, sized to your child’s measurements — or volunteer your own printer."
      steps={[
        'Pick an association with printers free',
        'Describe the part and how many you need',
        "They'll be in touch about pickup",
      ]}
    />
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run tests/unit/app/scaffold-pages.test.tsx`
Expected: PASS, 10 tests (1 coverage check + 9 parameterised)

- [ ] **Step 6: Commit**

```bash
git add packages/web/app/learn/ask-an-expert packages/web/app/get-involved packages/web/app/impact/news packages/web/app/impact/events packages/web/app/impact/map packages/web/app/about packages/web/app/printing packages/web/tests/unit/app/scaffold-pages.test.tsx
git commit -m "feat(web): nine scaffold pages behind the soon pills"
```

---

## Task 12: Public organisations directory

**Files:**
- Modify: `packages/api/src/routes/public.ts`
- Modify: `packages/web/app/organizations/page.tsx`
- Test: `packages/api/tests/integration/public/organizations.test.ts`

**Interfaces:**
- Consumes: `createAnonClient()`.
- Produces: `GET /api/public/organizations` returning `Array<{ id, name, description, status }>`.

**The hazard this task exists to avoid:** `GET /api/organizations` returns `org_leaders`, which carries user ids. A public endpoint must never inherit that, which is why this is a separate handler with a hand-written `select` rather than an auth-state branch inside the existing one.

- [ ] **Step 1: Write the failing test**

```ts
// packages/api/tests/integration/public/organizations.test.ts
import { describe, it, expect, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createOrg, cleanupOrg } from '../../helpers/orgs.js'

describe('GET /api/public/organizations', () => {
  const orgIds: string[] = []
  afterAll(async () => {
    for (const id of orgIds) await cleanupOrg(id)
  })

  it('is reachable with no Authorization header', async () => {
    const res = await app.request('/api/public/organizations')
    expect(res.status).toBe(200)
    expect(Array.isArray(await res.json())).toBe(true)
  })

  it('returns an organisation with only its public fields', async () => {
    const org = await createOrg({ name: `Public Org ${Date.now()}` })
    orgIds.push(org.id)

    const res = await app.request('/api/public/organizations')
    const rows = (await res.json()) as Array<Record<string, unknown>>
    const found = rows.find((r) => r.id === org.id)

    expect(found).toBeDefined()
    expect(Object.keys(found!).sort()).toEqual(['description', 'id', 'name', 'status'])
  })

  // The field-drift hazard: org_leaders carries user ids.
  it('never exposes org_leaders', async () => {
    const res = await app.request('/api/public/organizations')
    const body = await res.text()
    expect(body).not.toContain('org_leaders')
  })

  // Suspended orgs stay listed and marked: one vanishing from a directory is
  // unexplainable to someone who expected to find it, and their name is still on
  // work they already backed.
  it('includes a suspended organisation so its badge stays explainable', async () => {
    const org = await createOrg({ name: `Suspended Org ${Date.now()}`, status: 'suspended' })
    orgIds.push(org.id)

    const res = await app.request('/api/public/organizations')
    const rows = (await res.json()) as Array<{ id: string; status: string }>
    expect(rows.find((r) => r.id === org.id)?.status).toBe('suspended')
  })
})
```

Check `packages/api/tests/helpers/orgs.ts` for `createOrg`'s actual signature before writing this — if it does not accept a `status` option, create the org and then update its status with `adminClient()` from `tests/helpers/auth.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api && pnpm vitest run tests/integration/public/organizations.test.ts`
Expected: FAIL — 404.

- [ ] **Step 3: Add the endpoint**

```ts
/**
 * The organisations directory, for logged-out visitors.
 *
 * Separate from GET /api/organizations rather than an auth-state branch inside
 * it: that handler returns org_leaders (user ids), and one handler emitting both
 * public and privileged output is where object-level authorisation bugs hide.
 * The select below is hand-written so it cannot inherit a column added later.
 */
publicRoutes.get('/organizations', async (c) => {
  const supabase = createAnonClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, description, status')
    .order('name')

  if (error) {
    console.error('[public/organizations] read failed:', error.message)
    return c.json([], 200)
  }
  return c.json(data ?? [])
})
```

- [ ] **Step 4: Point the page at it**

In `packages/web/app/organizations/page.tsx`, replace the `apiClient` call — which requires a session — with the same degrading fetch the other public pages use. Keep the doc comment, the empty state and the card markup; update the comment's "Related files" line to name the new endpoint.

```tsx
import type { Organization } from '@splat-connect/types'

export default async function OrganizationsPage() {
  let orgs: Organization[] = []
  try {
    const res = await fetch(`${process.env.API_URL}/api/public/organizations`, {
      cache: 'no-store',
    })
    if (res.ok) orgs = await res.json()
  } catch {
    orgs = []
  }
  // …existing empty state and card list unchanged
```

Delete the now-unused `apiClient` import.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/api && pnpm vitest run tests/integration/public/organizations.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 6: Verify it works signed out**

Run: `cd packages/web && pnpm dev`, then open `http://localhost:3000/organizations` in a private window.
Expected: the directory renders, no redirect to `/login`, Impact highlighted in the top bar, and the Impact subnav row present with Organisations active.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/routes/public.ts packages/api/tests/integration/public/organizations.test.ts packages/web/app/organizations/page.tsx
git commit -m "feat(api): public organisations directory endpoint"
```

---

## Task 13: Learn hub

**Files:**
- Create: `packages/web/app/learn/page.tsx`
- Test: `packages/web/tests/unit/app/learn-hub.test.tsx`

**Interfaces:**
- Consumes: `PUBLIC_NAV` (Task 1), `<HubGrid>` (Task 7), `<EditorialImage>` (Task 6).
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/app/learn-hub.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LearnPage from '@/app/learn/page'
import { PUBLIC_NAV } from '@/lib/public-nav'

const learn = PUBLIC_NAV.find((s) => s.href === '/learn')!

describe('Learn hub', () => {
  it('links every article in the section exactly once', () => {
    render(<LearnPage />)
    for (const child of learn.children) {
      expect(screen.getAllByRole('link', { name: new RegExp(child.label, 'i') })).toHaveLength(1)
    }
  })

  it('groups the articles so a newcomer knows where to start', () => {
    render(<LearnPage />)
    expect(screen.getByRole('heading', { name: /start here/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /going deeper/i })).toBeInTheDocument()
  })

  it('sends someone who wants a specific toy to the Guides catalogue instead', () => {
    render(<LearnPage />)
    expect(screen.getByRole('link', { name: /guides/i })).toHaveAttribute('href', '/library')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run tests/unit/app/learn-hub.test.tsx`
Expected: FAIL — `Failed to resolve import "@/app/learn/page"`

- [ ] **Step 3: Write the implementation**

```tsx
// packages/web/app/learn/page.tsx
/**
 * The Learn section hub.
 *
 * Learn holds *articles* — general knowledge about switch adaptation. The Guides
 * catalogue at /library holds instructions for one specific toy. Keep the two
 * words apart in all copy.
 */
import Link from 'next/link'
import { PUBLIC_NAV } from '@/lib/public-nav'
import { HubGrid } from '@/components/hub-grid'

export const metadata = {
  title: 'Learn — SPLAT Connect',
  description:
    'How switch adaptation works: battery interrupters, switch types, tools, safety and 3D printing.',
}

const START_HERE = ['/learn/toy-adaptation-101', '/learn/switch-types', '/learn/choosing-a-toy']

export default function LearnPage() {
  const learn = PUBLIC_NAV.find((s) => s.href === '/learn')!
  const startHere = learn.children.filter((c) => START_HERE.includes(c.href))
  const deeper = learn.children.filter((c) => !START_HERE.includes(c.href))

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">Learn</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        Adapting a toy is a small piece of electronics and a lot of judgement. These
        articles cover the judgement — what a switch does, which toys take to it, and
        how to hand the result over safely. For instructions on one particular toy,
        head to the <Link href="/library" className="font-semibold text-brand-dark hover:underline">Guides</Link>.
      </p>

      <h2 className="mt-10 text-lg font-bold text-ink">Start here</h2>
      <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
        Read these three in order and you will know enough to adapt your first toy.
      </p>
      <HubGrid items={startHere} />

      <h2 className="mt-10 text-lg font-bold text-ink">Going deeper</h2>
      <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
        Reference material for when you are past the first one.
      </p>
      <HubGrid items={deeper} />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run tests/unit/app/learn-hub.test.tsx`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/learn/page.tsx packages/web/tests/unit/app/learn-hub.test.tsx
git commit -m "feat(web): Learn section hub"
```

---

## Task 14: The six Learn articles

**Files:**
- Create: `app/learn/toy-adaptation-101/page.tsx`, `app/learn/switch-types/page.tsx`, `app/learn/choosing-a-toy/page.tsx`, `app/learn/tools-and-materials/page.tsx`, `app/learn/safety-and-cleaning/page.tsx`, `app/learn/3d-printing-basics/page.tsx`
- Test: `packages/web/tests/unit/app/learn-articles.test.tsx`

**Interfaces:**
- Consumes: `<ProsePage>` (Task 8), `<EditorialImage>` (Task 6).
- Produces: nothing.

**Note for the implementer:** the copy below is complete and shippable. It is written to be technically accurate about switch adaptation — battery interrupters, 3.5 mm mono jacks, momentary versus latching activation. Have someone who has actually adapted a toy read it before launch, and cross-check the safety claims against `/safety`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/app/learn-articles.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Adaptation101 from '@/app/learn/toy-adaptation-101/page'
import SwitchTypes from '@/app/learn/switch-types/page'
import ChoosingAToy from '@/app/learn/choosing-a-toy/page'
import ToolsAndMaterials from '@/app/learn/tools-and-materials/page'
import SafetyAndCleaning from '@/app/learn/safety-and-cleaning/page'
import PrintingBasics from '@/app/learn/3d-printing-basics/page'

const articles: Array<[string, () => React.ReactElement]> = [
  ['Toy adaptation 101', Adaptation101],
  ['Switch types explained', SwitchTypes],
  ['Choosing a toy to adapt', ChoosingAToy],
  ['Tools and materials', ToolsAndMaterials],
  ['Safety and cleaning', SafetyAndCleaning],
  ['3D printing basics', PrintingBasics],
]

describe('Learn articles', () => {
  it.each(articles)('%s has a matching h1', (title, Page) => {
    render(<Page />)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })

  it.each(articles)('%s has at least two sections', (_t, Page) => {
    const { container } = render(<Page />)
    expect(container.querySelectorAll('h2').length).toBeGreaterThanOrEqual(2)
  })

  it('explains the battery interrupter, which is the core idea of the whole site', () => {
    render(<Adaptation101 />)
    expect(screen.getByText(/battery interrupter/i)).toBeInTheDocument()
    expect(screen.getByText(/3\.5\s?mm/i)).toBeInTheDocument()
  })

  it('names the four switch families', () => {
    render(<SwitchTypes />)
    for (const kind of [/button/i, /lever/i, /proximity/i, /grasp/i]) {
      expect(screen.getByText(kind)).toBeInTheDocument()
    }
  })

  it('warns against mains-powered toys where the choice is being made', () => {
    render(<ChoosingAToy />)
    expect(screen.getByText(/mains/i)).toBeInTheDocument()
  })

  it('points back to the safety page from the safety article', () => {
    render(<SafetyAndCleaning />)
    expect(screen.getByRole('link', { name: /safety/i })).toHaveAttribute('href', '/safety')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run tests/unit/app/learn-articles.test.tsx`
Expected: FAIL — six unresolved imports.

- [ ] **Step 3: Write `app/learn/toy-adaptation-101/page.tsx`**

```tsx
import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'
import { EditorialImage } from '@/components/editorial-image'

export const metadata = {
  title: 'Toy adaptation 101 — SPLAT Connect',
  description: 'What a battery interrupter is, and why it is the whole trick.',
}

export default function Adaptation101() {
  return (
    <ProsePage
      title="Toy adaptation 101"
      intro="Almost every adapted toy on this site works the same way, and the trick is smaller than you would expect. Once you have seen it once, you will see it everywhere."
    >
      <EditorialImage illustration="switch" ratio="2/1" />

      <section>
        <h2>The problem</h2>
        <p>
          Most toys are switched on by a small stiff button, a slide, or by squeezing a
          particular spot. A child with limited hand strength, limited fine motor
          control, or involuntary movement may not be able to operate any of them — not
          because the toy is too complicated, but because the button is too small and in
          the wrong place.
        </p>
        <p>
          Adapting a toy does not change what it does. It moves the act of turning it on
          to a switch the child <em>can</em> operate: a big one, a light one, one mounted
          on a wheelchair tray, one worked with a cheek or a foot.
        </p>
      </section>

      <section>
        <h2>The battery interrupter</h2>
        <p>
          Here is the whole idea. A battery-powered toy is a circuit, and that circuit
          runs through the battery compartment. If you break the circuit at one battery
          contact and route those two ends out to a switch, the toy only runs while the
          switch is held.
        </p>
        <p>
          A <strong>battery interrupter</strong> is a thin disc of insulating material
          with a metal contact on one face and a wire from each side. It slips between a
          battery and the spring contact in the compartment. No soldering inside the
          toy, no opening the case, and completely reversible — pull it out and the toy
          is exactly as it was.
        </p>
        <p>
          The two wires end in a <strong>3.5 mm mono socket</strong>, which is the
          standard connector across assistive switches. Use it, and the toy will work
          with switches a family may already own.
        </p>
      </section>

      <section>
        <h2>When an interrupter is not enough</h2>
        <p>
          Some toys will not cooperate. If the toy latches — one press starts it, another
          stops it — then cutting power mid-cycle may leave it stuck, or restart it from
          the beginning every time. If the toy has a microcontroller that needs to boot,
          it may not respond fast enough to a momentary switch.
        </p>
        <p>
          In those cases the adaptation moves inside: you open the toy and wire the
          switch in parallel with the toy&apos;s own button, so pressing either one does
          the same thing. That means soldering, and it means the guide for that toy will
          tell you exactly which two pads to bridge. This is where the library earns its
          keep — somebody has already worked it out.
        </p>
      </section>

      <section>
        <h2>Momentary or latching</h2>
        <p>
          <strong>Momentary</strong> means the toy runs while the switch is held and stops
          when it is released. It is the simplest to build and, for many children, the
          most rewarding: cause and effect are immediate and unambiguous.
        </p>
        <p>
          <strong>Latching</strong> means one press starts it and the next stops it. It
          suits a child who cannot sustain a press, and it needs a latching switch
          interface between the switch and the toy rather than any change to the toy.
        </p>
      </section>

      <section>
        <h2>What to read next</h2>
        <p>
          <Link href="/learn/switch-types">Switch types explained</Link> covers which
          switch suits which child, and <Link href="/learn/choosing-a-toy">choosing a toy
          to adapt</Link> covers which toys take to this well. When you are ready to
          build, the <Link href="/library">Guides</Link> have the step-by-step for
          specific toys.
        </p>
      </section>
    </ProsePage>
  )
}
```

- [ ] **Step 4: Write `app/learn/switch-types/page.tsx`**

```tsx
import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'

export const metadata = {
  title: 'Switch types explained — SPLAT Connect',
  description: 'Buttons, levers, proximity and grasp — which suits which child.',
}

export default function SwitchTypes() {
  return (
    <ProsePage
      title="Switch types explained"
      intro="A switch is the part the child actually touches, so it matters more than the toy does. Choosing it well is mostly about matching the movement a child already makes reliably."
    >
      <section>
        <h2>Start from the movement, not the switch</h2>
        <p>
          The question is never &ldquo;which switch is best&rdquo;. It is: what movement
          can this child make consistently, with little effort, without having to look at
          what they are doing? A press with the side of a fist counts. So does a head
          turn. Build around that movement, and the switch choice usually follows.
        </p>
        <p>
          If a child has an occupational therapist or a speech pathologist, ask them
          first. They have probably already assessed this.
        </p>
      </section>

      <section>
        <h2>Button switches</h2>
        <p>
          A large flat disc, typically 65&ndash;125 mm across, that clicks when pressed
          anywhere on its surface. This is the default for good reason: a big target
          tolerates imprecise aim, the click gives feedback, and it can be mounted flat
          on a tray or angled on a stand.
        </p>
        <p>
          Watch the activation force. A stiff button that needs a deliberate shove will
          exhaust a child with low tone within minutes.
        </p>
      </section>

      <section>
        <h2>Lever switches</h2>
        <p>
          A paddle or wobble arm that moves sideways rather than being pressed down.
          Useful where a child sweeps or bats rather than pressing, and where a downward
          press is difficult — for instance from a reclined position. Because the arm
          moves through an arc, it can be caught anywhere along its length.
        </p>
      </section>

      <section>
        <h2>Proximity switches</h2>
        <p>
          No contact and no force at all: the switch triggers when a hand, cheek or head
          comes within a few centimetres. The right answer for a child whose movement is
          too weak or too painful for any mechanical switch. The trade-off is feedback —
          there is no click, so the toy&apos;s own response has to be immediate and
          obvious, and accidental triggers are easy.
        </p>
      </section>

      <section>
        <h2>Grasp and squeeze switches</h2>
        <p>
          A soft bulb or pad activated by closing a hand around it. Suits a child with a
          reliable grasp reflex but poor reach, and it can be held rather than mounted,
          which sidesteps the mounting problem entirely.
        </p>
      </section>

      <section>
        <h2>Mounting is half the job</h2>
        <p>
          A well-chosen switch in the wrong place is a switch the child cannot use. It
          needs to be exactly where their movement naturally lands, stay there when
          knocked, and be repeatable tomorrow. Gooseneck mounts, hook-and-loop on a tray,
          and a non-slip base all beat holding it in place by hand.
        </p>
      </section>

      <section>
        <h2>Where to get them</h2>
        <p>
          Commercial assistive switches cost anywhere from $40 to several hundred. Many
          designs can be printed and built for a fraction of that — see
          <Link href="/learn/3d-printing-basics"> 3D printing basics</Link> and the
          <Link href="/library"> Guides</Link>. Whatever you use, standardise on a
          3.5 mm mono plug so switches and toys stay interchangeable.
        </p>
      </section>
    </ProsePage>
  )
}
```

- [ ] **Step 5: Write `app/learn/choosing-a-toy/page.tsx`**

```tsx
import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'

export const metadata = {
  title: 'Choosing a toy to adapt — SPLAT Connect',
  description: 'What makes a toy easy to adapt, and what makes it impossible.',
}

export default function ChoosingAToy() {
  return (
    <ProsePage
      title="Choosing a toy to adapt"
      intro="The best toy to adapt is one the child already wants. Everything below is about whether that toy will cooperate — and if it won't, what to look for instead."
    >
      <section>
        <h2>Signs a toy will be easy</h2>
        <ul>
          <li>
            <strong>It runs on AA, AAA, C or D cells.</strong> A removable cylindrical
            battery is what a battery interrupter needs.
          </li>
          <li>
            <strong>It does one thing.</strong> Press and it lights up, spins, sings.
            Single-function toys give unambiguous cause and effect, which is the whole
            point for a child learning that their action changes the world.
          </li>
          <li>
            <strong>Activation is momentary.</strong> Hold the button and it runs; let go
            and it stops. This maps directly onto a switch with no extra electronics.
          </li>
          <li>
            <strong>The battery compartment is roomy.</strong> An interrupter plus its
            wires need somewhere to sit and somewhere to leave the case.
          </li>
        </ul>
      </section>

      <section>
        <h2>Signs a toy will fight you</h2>
        <ul>
          <li>
            <strong>Mains power, or a plug-in adapter.</strong> Do not adapt these, at
            all. See the <Link href="/safety">safety page</Link>.
          </li>
          <li>
            <strong>A sealed or soldered-in battery,</strong> including rechargeable
            toys with a USB port. Nothing to interrupt.
          </li>
          <li>
            <strong>A button cell held in by a clip rather than a screw.</strong> Serious
            hazard, and not worth the risk. If the compartment does not screw shut, pick
            a different toy.
          </li>
          <li>
            <strong>Menus, modes, or a startup sequence.</strong> A toy that needs three
            presses to get going will frustrate a child using one switch.
          </li>
          <li>
            <strong>Latching behaviour</strong> — one press on, one press off. Adaptable,
            but it needs a latching interface rather than a plain switch.
          </li>
        </ul>
      </section>

      <section>
        <h2>Match the toy to the child, not to your skills</h2>
        <p>
          A toy that is easy to adapt but boring to the child is wasted effort. Ask what
          they already reach for. Consider what they get from it: is it the light, the
          sound, the vibration, the movement? A child with low vision may want the toy
          that rattles, not the one that flashes. A child who is sound-sensitive will
          hate the one that sings.
        </p>
      </section>

      <section>
        <h2>Check the library first</h2>
        <p>
          Before you open anything, search the <Link href="/library">Guides</Link>.
          Somebody may have adapted that exact toy and written down which wire goes
          where — including the traps. If they have not, and you work it out, please
          <Link href="/get-involved/submit-a-tutorial"> write it up</Link>: the next
          parent gets to skip the hard part.
        </p>
      </section>
    </ProsePage>
  )
}
```

- [ ] **Step 6: Write `app/learn/tools-and-materials/page.tsx`**

```tsx
import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'

export const metadata = {
  title: 'Tools and materials — SPLAT Connect',
  description: 'The shopping list, and what you can borrow instead of buying.',
}

export default function ToolsAndMaterials() {
  return (
    <ProsePage
      title="Tools and materials"
      intro="A first adaptation needs surprisingly little. Here is what actually gets used, separated from what a hobby electronics shop will try to sell you."
    >
      <section>
        <h2>The minimum</h2>
        <ul>
          <li>
            <strong>A small Phillips screwdriver set.</strong> Toy screws are tiny, and
            often recessed down a narrow shaft. This is the tool you will reach for on
            every single build.
          </li>
          <li>
            <strong>Wire strippers,</strong> or a sharp pair of side cutters and
            patience.
          </li>
          <li>
            <strong>Stranded hook-up wire, 22&ndash;24 AWG.</strong> Stranded, not solid:
            solid core work-hardens and snaps where it flexes.
          </li>
          <li>
            <strong>3.5 mm mono sockets.</strong> Buy ten; they cost very little and you
            will use them all.
          </li>
          <li>
            <strong>Heat-shrink tubing</strong> in two or three diameters. Insulating
            tape works but comes unstuck inside a toy that gets shaken.
          </li>
        </ul>
      </section>

      <section>
        <h2>Soldering, when you get to it</h2>
        <p>
          A temperature-controlled iron around 30&ndash;60 W, 60/40 or lead-free rosin-core
          solder, a brass-wool tip cleaner, and a stand. A cheap fixed-temperature iron
          will do a first build, but it will also lift pads and melt plastic, so it is a
          false economy if you plan more than one.
        </p>
        <p>
          Helping hands or a small vice are not optional in practice — two hands are
          already committed to the iron and the solder.
        </p>
      </section>

      <section>
        <h2>Nice to have</h2>
        <ul>
          <li>
            <strong>A multimeter.</strong> Continuity mode alone will save you an hour
            per build. It answers &ldquo;is this joint actually connected&rdquo; without
            guessing.
          </li>
          <li>
            <strong>A plastic spudger or guitar pick,</strong> for opening clipped cases
            without gouging them.
          </li>
          <li>
            <strong>A parts tray with compartments.</strong> Toy screws are different
            lengths and go back in specific holes.
          </li>
          <li>
            <strong>Cable ties</strong> for strain relief, trimmed flush.
          </li>
        </ul>
      </section>

      <section>
        <h2>Battery interrupters</h2>
        <p>
          Buy them, or print them. Commercial ones cost a few dollars each and work
          immediately. Printed ones need a thin conductive contact — copper tape or a
          trimmed brass shim — and are worth it if you are doing many builds. Sizes are
          per battery type, so a AA interrupter will not fit a AAA compartment.
        </p>
      </section>

      <section>
        <h2>What to borrow rather than buy</h2>
        <p>
          A 3D printer is the big one. Libraries, makerspaces, men&apos;s sheds, schools
          and universities often have one and are usually delighted to be asked. Some
          SPLAT <Link href="/organizations">organisations</Link> hold printers for
          exactly this. You do not need to own a printer to build a printed switch — see
          <Link href="/learn/3d-printing-basics"> 3D printing basics</Link>.
        </p>
      </section>

      <section>
        <h2>Per-guide parts lists</h2>
        <p>
          Every guide in the <Link href="/library">Guides</Link> library lists its own
          parts with links to buy them, so you do not have to work out quantities. Read
          the list before you start, not halfway through.
        </p>
      </section>
    </ProsePage>
  )
}
```

- [ ] **Step 7: Write `app/learn/safety-and-cleaning/page.tsx`**

```tsx
import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'

export const metadata = {
  title: 'Safety and cleaning — SPLAT Connect',
  description: 'Batteries, small parts, and getting a toy ready to hand over.',
}

export default function SafetyAndCleaning() {
  return (
    <ProsePage
      title="Safety and cleaning"
      intro="This article is the practical companion to the site's formal safety page. Read both before your first handover."
    >
      <section>
        <h2>The three that actually hurt children</h2>
        <ul>
          <li>
            <strong>Button and coin cells.</strong> Swallowed, they burn through tissue
            within hours. The compartment must close with a screw, and that screw must be
            in and tight. If it does not screw shut, do not adapt the toy.
          </li>
          <li>
            <strong>Loose small parts.</strong> Screws, springs, trimmed wire ends and
            printed fragments. Work over a tray, count screws out and back in, and shake
            the finished toy hard next to your ear.
          </li>
          <li>
            <strong>Mains power.</strong> Never. Battery toys only.
          </li>
        </ul>
      </section>

      <section>
        <h2>Making a joint that survives a child</h2>
        <p>
          The failure mode is always the same: someone pulls the switch lead and the wire
          tears out of the toy, leaving bare copper inside a rattling plastic shell. Two
          habits prevent it. Insulate every joint with heat-shrink rather than tape, and
          strain-relieve the cable where it exits the case — a cable tie or a knot inside
          the shell, so a pull is taken by the case and not by the solder.
        </p>
      </section>

      <section>
        <h2>Cleaning an adapted toy</h2>
        <p>
          Assume the toy will go in a mouth. Wipe hard surfaces with warm soapy water or
          an alcohol wipe, and let them dry fully before the batteries go back. Never
          submerge an adapted toy, and never put printed parts in a dishwasher — PLA
          deforms well below dishwasher temperature.
        </p>
        <p>
          Fabric toys are harder. If the electronics are in a removable pod, wash the
          fabric and keep the pod out. If they are sewn in, tell the family it is
          surface-clean only, because they will otherwise find out the expensive way.
        </p>
      </section>

      <section>
        <h2>Printed parts specifically</h2>
        <p>
          Sand or file every edge a hand will touch — layer lines are sharper than they
          look. Print at an infill high enough that a part cannot snap into shards; the
          guide will state a figure. Printed plastic is porous and not food safe, so
          anything a child mouths regularly should be a smooth commercial part rather
          than a printed one.
        </p>
      </section>

      <section>
        <h2>The handover checklist</h2>
        <ul>
          <li>Shake it. Listen for anything loose.</li>
          <li>Check every screw, battery compartment first.</li>
          <li>Pull the switch lead firmly. Nothing should move at the toy end.</li>
          <li>Test it with the actual switch the child will use.</li>
          <li>Wipe it down.</li>
          <li>
            Say what you changed, and how to clean it. A parent needs to know there is a
            modified battery compartment in there.
          </li>
        </ul>
        <p>
          The full formal guidance, including what to do if you find a problem with a
          published guide, is on the <Link href="/safety">safety page</Link>.
        </p>
      </section>
    </ProsePage>
  )
}
```

- [ ] **Step 8: Write `app/learn/3d-printing-basics/page.tsx`**

```tsx
import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'
import { EditorialImage } from '@/components/editorial-image'

export const metadata = {
  title: '3D printing basics — SPLAT Connect',
  description: 'Filament, settings and finishing for printed switch parts.',
}

export default function PrintingBasics() {
  return (
    <ProsePage
      title="3D printing basics"
      intro="Many switches, mounts and battery interrupters on this site are printed. You do not need to own a printer, and you do not need to understand slicing deeply — just enough to get a part that holds up."
    >
      <EditorialImage illustration="printer" ratio="2/1" />

      <section>
        <h2>If you don&apos;t have a printer</h2>
        <p>
          Ask a library, a makerspace, a men&apos;s shed, a school or a university. Many
          have printers sitting idle and staff who would rather they were used for this
          than for another keyring. Some SPLAT <Link href="/organizations">organisations
          </Link> hold printers specifically for assistive parts. Hand over the STL file
          from the guide and the settings below; that is all a printer operator needs.
        </p>
      </section>

      <section>
        <h2>Which filament</h2>
        <ul>
          <li>
            <strong>PLA</strong> for most parts. Easy, cheap, dimensionally accurate,
            stiff enough for switch housings. Its weakness is heat — a PLA part left on a
            car dashboard will sag.
          </li>
          <li>
            <strong>PETG</strong> where a part flexes or takes repeated impact, such as a
            lever arm or a clamp. Tougher than PLA, slightly fussier to print, and it
            tolerates warmth.
          </li>
          <li>
            <strong>Avoid ABS</strong> unless you have an enclosed printer and good
            ventilation. The fumes are unpleasant and it warps badly.
          </li>
          <li>
            <strong>Avoid flexible filament</strong> for a first print. It needs a
            direct-drive extruder and a lot of patience.
          </li>
        </ul>
      </section>

      <section>
        <h2>Settings that matter</h2>
        <ul>
          <li>
            <strong>Layer height 0.2 mm.</strong> The default, and fine for everything
            here. Go finer only for a part with fine detail.
          </li>
          <li>
            <strong>Infill 30&ndash;40% for structural parts</strong>, and three or more
            perimeters. Strength in printed parts comes more from perimeters than from
            infill.
          </li>
          <li>
            <strong>Print orientation decides strength.</strong> Layers separate under
            load more readily than they break. Lay a lever flat so the stress runs along
            the layers, not across them.
          </li>
          <li>
            <strong>Supports</strong> only where the guide says. Every support leaves a
            surface you then have to clean up.
          </li>
        </ul>
      </section>

      <section>
        <h2>Finishing</h2>
        <p>
          File or sand every edge a child will touch. Remove supports fully, then check
          the part against the guide&apos;s photographs — a stray blob in a switch housing
          will stop it clicking. Test-fit before you glue or screw anything, because a
          part that is 0.2 mm out is easier to reprint than to force.
        </p>
      </section>

      <section>
        <h2>Cleaning and safety</h2>
        <p>
          Printed parts are porous and not food safe. Wipe with warm soapy water; never a
          dishwasher. If a part will be mouthed regularly, use a commercial smooth part
          instead. More in <Link href="/learn/safety-and-cleaning">safety and cleaning
          </Link>.
        </p>
      </section>
    </ProsePage>
  )
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run tests/unit/app/learn-articles.test.tsx`
Expected: PASS, 16 tests (12 parameterised + 4 specific)

- [ ] **Step 10: Read them on screen**

Run: `cd packages/web && pnpm dev`, then walk `/learn` and all six articles. Check the subnav highlights the right article, the measure is comfortable, and the two illustrations sit correctly at `2/1`.

- [ ] **Step 11: Commit**

```bash
git add packages/web/app/learn packages/web/tests/unit/app/learn-articles.test.tsx
git commit -m "feat(web): six Learn articles on switch adaptation"
```

---

## Task 15: Get Involved hub and the three audience tracks

**Files:**
- Create: `packages/web/components/step-list.tsx`
- Create: `app/get-involved/page.tsx`, `app/get-involved/families/page.tsx`, `app/get-involved/contributors/page.tsx`, `app/get-involved/organisations/page.tsx`
- Test: `packages/web/tests/unit/app/get-involved.test.tsx`

**Interfaces:**
- Consumes: `PUBLIC_NAV` (Task 1), `<HubGrid>` (Task 7), `<EditorialImage>` (Task 6).
- Produces: `<StepList steps={{ title: string; body: string }[]} />`, reused by Task 16.

**Note:** there is no `/how-it-works` route. This hub *is* that page — the spec dropped the separate route to avoid a label/URL mismatch. The homepage's "How it works" affordance links here.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/app/get-involved.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import GetInvolvedPage from '@/app/get-involved/page'
import FamiliesPage from '@/app/get-involved/families/page'
import ContributorsPage from '@/app/get-involved/contributors/page'
import OrganisationsPage from '@/app/get-involved/organisations/page'
import { PUBLIC_NAV } from '@/lib/public-nav'

const section = PUBLIC_NAV.find((s) => s.href === '/get-involved')!

describe('Get Involved hub', () => {
  it('leads with the three audience tracks', () => {
    render(<GetInvolvedPage />)
    expect(screen.getByRole('heading', { name: /which one are you/i })).toBeInTheDocument()
    for (const label of ['For families', 'For contributors', 'For organisations']) {
      expect(screen.getByRole('link', { name: new RegExp(label, 'i') })).toBeInTheDocument()
    }
  })

  it('links every child of the section', () => {
    render(<GetInvolvedPage />)
    for (const child of section.children) {
      expect(screen.getAllByRole('link', { name: new RegExp(child.label, 'i') })).toHaveLength(1)
    }
  })
})

describe('audience tracks', () => {
  it.each([
    ['For families', FamiliesPage],
    ['For contributors', ContributorsPage],
    ['For organisations', OrganisationsPage],
  ] as const)('%s is a numbered walkthrough', (title, Page) => {
    const { container } = render(<Page />)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(container.querySelectorAll('ol li').length).toBeGreaterThanOrEqual(3)
  })

  it('sends a family to the Guides library', () => {
    render(<FamiliesPage />)
    expect(screen.getByRole('link', { name: /browse the guides/i })).toHaveAttribute('href', '/library')
  })

  it('sends a would-be contributor to sign up', () => {
    render(<ContributorsPage />)
    expect(screen.getByRole('link', { name: /create an account|sign up/i })).toHaveAttribute('href', '/signup')
  })

  it('sends an organisation to contact, because onboarding is manual', () => {
    render(<OrganisationsPage />)
    expect(screen.getByRole('link', { name: /get in touch|contact/i })).toHaveAttribute('href', '/contact')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run tests/unit/app/get-involved.test.tsx`
Expected: FAIL — four unresolved imports.

- [ ] **Step 3: Write `components/step-list.tsx`**

```tsx
// packages/web/components/step-list.tsx
/**
 * The numbered walkthrough used by every audience track and both submit
 * explainers. An ordered list, so the steps are connected rather than dropped
 * into interchangeable cards — same reasoning as the homepage's how-it-works
 * strip.
 */
export function StepList({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="mt-6 flex flex-col gap-5">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-4">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-tint text-sm font-bold text-brand-deep"
          >
            {i + 1}
          </span>
          <div>
            <h3 className="font-bold text-ink">{step.title}</h3>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
```

- [ ] **Step 4: Write `app/get-involved/page.tsx`**

```tsx
import { PUBLIC_NAV } from '@/lib/public-nav'
import { HubGrid } from '@/components/hub-grid'

export const metadata = {
  title: 'Get involved — SPLAT Connect',
  description:
    'Three ways in: adapt a toy for your own child, make toys for other people, or bring your organisation in behind the work.',
}

const TRACKS = [
  '/get-involved/families',
  '/get-involved/contributors',
  '/get-involved/organisations',
]

export default function GetInvolvedPage() {
  const section = PUBLIC_NAV.find((s) => s.href === '/get-involved')!
  const tracks = section.children.filter((c) => TRACKS.includes(c.href))
  const actions = section.children.filter((c) => !TRACKS.includes(c.href))

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">Get involved</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        SPLAT runs on unpaid work. Contributors adapt toys and write down how, people
        and organisations pass on toys they no longer need, and organisations put their
        name behind work so a parent knows someone competent read it. Any of those is a
        way in.
      </p>

      <h2 className="mt-10 text-lg font-bold text-ink">Which one are you?</h2>
      <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
        Each of these walks through the whole path, start to finish.
      </p>
      <HubGrid items={tracks} />

      <h2 className="mt-10 text-lg font-bold text-ink">Specific things you can do</h2>
      <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
        Smaller, more concrete. Some are not built yet — those say so.
      </p>
      <HubGrid items={actions} />
    </div>
  )
}
```

- [ ] **Step 5: Write `app/get-involved/families/page.tsx`**

```tsx
import Link from 'next/link'
import { EditorialImage } from '@/components/editorial-image'
import { StepList } from '@/components/step-list'

export const metadata = {
  title: 'For families — SPLAT Connect',
  description: 'Find a guide, gather the parts, adapt the toy you already own.',
}

export default function FamiliesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <EditorialImage illustration="family" ratio="2/1" />
      <h1 className="mt-6 text-2xl font-bold text-ink sm:text-3xl">For families</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        You do not need to be technical, and you do not need to buy much. Most first
        adaptations take an evening and about thirty dollars of parts.
      </p>

      <StepList
        steps={[
          {
            title: 'Find a guide for a toy your child already likes',
            body: 'Search the Guides library by toy or by difficulty. If the exact toy is not there, a guide for a similar one usually transfers — the technique is the same across most battery toys.',
          },
          {
            title: 'Read the parts list before you buy anything',
            body: 'Every guide lists exactly what it needs, with links. Most builds need a battery interrupter, a 3.5 mm mono socket, some wire and a switch. Read the whole guide once through before ordering.',
          },
          {
            title: 'Borrow what you can',
            body: 'Libraries, makerspaces and men’s sheds often lend tools or run a printer for you. Some organisations on SPLAT hold printers for exactly this. You do not need to own a 3D printer to build a printed switch.',
          },
          {
            title: 'Build it, then check it over',
            body: 'Follow the guide’s steps. Before your child touches it: shake it, check every screw, and pull firmly on the switch lead. The safety page has the full checklist.',
          },
          {
            title: 'Or skip the build entirely',
            body: 'The Toy Library lists toys other families and organisations have already adapted and are giving away. If one suits, ask for it — you only cover pickup.',
          },
        ]}
      />

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/library" className="btn btn-primary">
          Browse the Guides
        </Link>
        <Link href="/toy-library" className="btn btn-soft">
          See toys being given away
        </Link>
      </div>

      <p className="mt-6 text-sm text-muted">
        New to all of this? Start with{' '}
        <Link href="/learn/toy-adaptation-101" className="font-semibold text-brand-dark hover:underline">
          toy adaptation 101
        </Link>{' '}
        — it explains the one trick everything else is built on.
      </p>
    </div>
  )
}
```

- [ ] **Step 6: Write `app/get-involved/contributors/page.tsx`**

```tsx
import Link from 'next/link'
import { EditorialImage } from '@/components/editorial-image'
import { StepList } from '@/components/step-list'

export const metadata = {
  title: 'For contributors — SPLAT Connect',
  description: 'Adapt a toy, write it up, and get an organisation behind it.',
}

export default function ContributorsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <EditorialImage illustration="maker" ratio="2/1" />
      <h1 className="mt-6 text-2xl font-bold text-ink sm:text-3xl">For contributors</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        A guide you write once gets built many times, by families who would never have
        worked it out alone. That is the whole leverage of this platform.
      </p>

      <StepList
        steps={[
          {
            title: 'Create an account',
            body: 'Free, and takes a minute. You will be asked to accept the contributor terms, which cover licensing and the standard your work is held to.',
          },
          {
            title: 'Adapt a toy',
            body: 'Pick something with a removable AA, AAA, C or D cell and a single momentary action. Check the Guides library first — if it is already covered, pick something else, or improve the existing guide as a collaborator.',
          },
          {
            title: 'Write it up as you go',
            body: 'Photograph each step while your hands are dirty, not afterwards from memory. A guide needs a parts list with buy links, the steps in order, and any trap you hit. If you printed something, attach the STL.',
          },
          {
            title: 'Ask an organisation to back it',
            body: 'Before submitting, you can ask an organisation — a therapy service, a school, a disability service — to review it. Their name on your guide tells a parent that someone competent read it. Browse the directory to find one.',
          },
          {
            title: 'Submit for review',
            body: 'A SPLAT admin checks it, mostly for safety and completeness. Expect questions. Once approved it is public, credited to you, and it appears on your contributor profile.',
          },
          {
            title: 'Keep going',
            body: 'Offer a toy you have adapted through the Toy Library, collaborate on someone else’s guide, or volunteer your 3D printer when print requests open.',
          },
        ]}
      />

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/signup" className="btn btn-primary">
          Create an account
        </Link>
        <Link href="/get-involved/submit-a-tutorial" className="btn btn-soft">
          What writing a guide involves
        </Link>
      </div>

      <p className="mt-6 text-sm text-muted">
        Not sure you have the skills? You almost certainly do —{' '}
        <Link href="/learn" className="font-semibold text-brand-dark hover:underline">
          Learn
        </Link>{' '}
        covers everything from which switch to use to how to solder a joint that lasts.
      </p>
    </div>
  )
}
```

- [ ] **Step 7: Write `app/get-involved/organisations/page.tsx`**

```tsx
import Link from 'next/link'
import { EditorialImage } from '@/components/editorial-image'
import { StepList } from '@/components/step-list'

export const metadata = {
  title: 'For organisations — SPLAT Connect',
  description: 'Back contributors, hold toys for local families, host a build day.',
}

export default function OrganisationsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <EditorialImage illustration="organisation" ratio="2/1" />
      <h1 className="mt-6 text-2xl font-bold text-ink sm:text-3xl">For organisations</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        Therapy services, schools, disability organisations and community groups. What
        you bring is the thing a volunteer platform cannot generate on its own:
        professional judgement, and a physical place families can get to.
      </p>

      <StepList
        steps={[
          {
            title: 'Get in touch',
            body: 'Organisations are set up by the SPLAT team rather than self-registered, so that a name on a guide means something. Tell us who you are and what you would like to do.',
          },
          {
            title: 'Back contributors’ work',
            body: 'Contributors can ask your organisation to review a guide before it is published. One of your leaders reads it and stands behind it, and your name appears on it. This is the strongest signal of quality the library has.',
          },
          {
            title: 'Hold toys for local families',
            body: 'If you hold stock — five identical sensory toys, say — you can list them from your organisation with a fixed pickup address, rather than a staff member using a personal account and their home address.',
          },
          {
            title: 'Run a build day',
            body: 'A group of staff, students or volunteers can build a batch of switches and adapted toys in an afternoon, and the output goes to families you already work with.',
          },
          {
            title: 'Be findable',
            body: 'Your organisation gets a public profile listing what you have backed and what you hold, so a parent reading a badge on a guide can see who is behind it.',
          },
        ]}
      />

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/contact" className="btn btn-primary">
          Get in touch
        </Link>
        <Link href="/organizations" className="btn btn-soft">
          See who is already involved
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run tests/unit/app/get-involved.test.tsx`
Expected: PASS, 8 tests

- [ ] **Step 9: Commit**

```bash
git add packages/web/components/step-list.tsx packages/web/app/get-involved packages/web/tests/unit/app/get-involved.test.tsx
git commit -m "feat(web): Get Involved hub and three audience tracks"
```

---

## Task 16: The two submit explainers

**Files:**
- Create: `app/get-involved/submit-an-idea/page.tsx`, `app/get-involved/submit-a-tutorial/page.tsx`
- Test: `packages/web/tests/unit/app/submit-explainers.test.tsx`

**Interfaces:**
- Consumes: `<StepList>` (Task 15).
- Produces: nothing.

**These are explainer pages, not forms.** Each ends in one CTA: `/upload` for the guide path, `/contact` for the idea path (there is no idea-submission feature yet — the honest CTA is email, not a form that goes nowhere).

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/app/submit-explainers.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SubmitAnIdea from '@/app/get-involved/submit-an-idea/page'
import SubmitATutorial from '@/app/get-involved/submit-a-tutorial/page'

describe('submit explainers', () => {
  it('explains submitting an idea and routes to contact, since there is no form yet', () => {
    render(<SubmitAnIdea />)
    expect(screen.getByRole('heading', { level: 1, name: /submit an idea/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /send us the idea|get in touch/i })).toHaveAttribute(
      'href',
      '/contact'
    )
  })

  it('explains submitting a guide and routes to the upload flow', () => {
    render(<SubmitATutorial />)
    expect(screen.getByRole('heading', { level: 1, name: /submit a guide/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /start a guide/i })).toHaveAttribute('href', '/upload')
  })

  it('tells a signed-out visitor they will need an account', () => {
    render(<SubmitATutorial />)
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/signup')
  })

  it('neither page contains a form', () => {
    const { container: a } = render(<SubmitAnIdea />)
    const { container: b } = render(<SubmitATutorial />)
    expect(a.querySelector('form')).toBeNull()
    expect(b.querySelector('form')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run tests/unit/app/submit-explainers.test.tsx`
Expected: FAIL — two unresolved imports.

- [ ] **Step 3: Write `app/get-involved/submit-an-idea/page.tsx`**

```tsx
import Link from 'next/link'
import { StepList } from '@/components/step-list'

export const metadata = {
  title: 'Submit an idea — SPLAT Connect',
  description: 'Suggest a toy worth adapting, even if you cannot build it yourself.',
}

export default function SubmitAnIdea() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">Submit an idea</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        You do not have to be able to build something to be the person who thought of it.
        Parents and therapists spot the need long before a maker does.
      </p>

      <StepList
        steps={[
          {
            title: 'Tell us the toy, and what needs to change',
            body: 'Which toy, what your child cannot do with it as it stands, and what you wish it did. A photograph helps more than a paragraph.',
          },
          {
            title: 'We check whether it already exists',
            body: 'Often it does, under a name you would not have searched for. If so, we send you the guide and you are done.',
          },
          {
            title: 'If it does not, it goes to the makers',
            body: 'We put it in front of contributors looking for something to work on. Simple adaptations get picked up quickly; awkward ones become design challenges.',
          },
          {
            title: 'It becomes a guide',
            body: 'Whoever solves it writes it up, and it joins the library for everyone else. You get credited as the person who raised it, if you want to be.',
          },
        ]}
      />

      <div className="mt-10">
        <Link href="/contact" className="btn btn-primary">
          Send us the idea
        </Link>
      </div>

      <p className="mt-6 text-sm text-muted">
        A form for this is coming. For now email reaches a person faster, which is why
        this page sends you there rather than to something automated. Ideas that no one
        has cracked yet will eventually be listed publicly on{' '}
        <Link href="/get-involved/design-challenges" className="font-semibold text-brand-dark hover:underline">
          design challenges
        </Link>
        .
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Write `app/get-involved/submit-a-tutorial/page.tsx`**

```tsx
import Link from 'next/link'
import { StepList } from '@/components/step-list'

export const metadata = {
  title: 'Submit a guide — SPLAT Connect',
  description: 'What writing up an adaptation involves, start to finish.',
}

export default function SubmitATutorial() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">Submit a guide</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        Here is exactly what is involved, so you can decide before you start rather than
        halfway through.
      </p>

      <StepList
        steps={[
          {
            title: 'What a guide has to contain',
            body: 'A title naming the actual toy, a difficulty, a parts list with links to buy each item, the steps in order with a photograph each, and any design files if something is printed or cut.',
          },
          {
            title: 'Photograph as you go',
            body: 'This is the part people regret skipping. Take a photograph at every step while the toy is open, even the boring ones. Reconstructing them later never works.',
          },
          {
            title: 'Write for someone who has never done this',
            body: 'Name the tool. Say which wire. Mention the screw that is hidden under the label. If you hit a trap, write the trap down — that is the most valuable sentence in any guide.',
          },
          {
            title: 'Optionally, get an organisation behind it',
            body: 'You can ask an organisation to review the guide before it goes for approval. Their name appears on it, which is what tells a parent someone competent read it.',
          },
          {
            title: 'Submit, and expect questions',
            body: 'A SPLAT admin reviews for safety and completeness. Most guides come back with a question or two. Once approved it is public and credited to you.',
          },
          {
            title: 'You can work on it with other people',
            body: 'Guides support collaborators, so you can invite someone to co-write or to check your electronics before it goes out.',
          },
        ]}
      />

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/upload" className="btn btn-primary">
          Start a guide
        </Link>
        <Link href="/signup" className="btn btn-soft">
          Create an account first
        </Link>
      </div>

      <p className="mt-6 text-sm text-muted">
        You will need an account and to have accepted the{' '}
        <Link href="/legal/contributor-terms" className="font-semibold text-brand-dark hover:underline">
          contributor terms
        </Link>
        . Signing in takes you straight to the guide editor.
      </p>
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run tests/unit/app/submit-explainers.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 6: Commit**

```bash
git add packages/web/app/get-involved/submit-an-idea packages/web/app/get-involved/submit-a-tutorial packages/web/tests/unit/app/submit-explainers.test.tsx
git commit -m "feat(web): submit-an-idea and submit-a-guide explainers"
```

---

## Task 17: About, team and contact

**Files:**
- Create: `app/about/page.tsx`, `app/about/team/page.tsx`, `app/contact/page.tsx`
- Test: `packages/web/tests/unit/app/about.test.tsx`

**Interfaces:**
- Consumes: `<EditorialImage>` (Task 6), `<HubGrid>` (Task 7).
- Produces: nothing.

**Flag for the user — this task needs facts only you have.** The copy below carries clearly-marked spots that need real details: the organisation's legal name, where it is based, when it started, who is on the team, and the contact address. Placeholders are marked with `TEAM_MEMBERS` and `ORG_FACTS` constants at the top of each file so they are impossible to miss and trivial to fill. **Do not ship this task until those constants hold real values** — an About page with invented facts is worse than no About page.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/app/about.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AboutPage from '@/app/about/page'
import TeamPage from '@/app/about/team/page'
import ContactPage from '@/app/contact/page'
import { ORG_FACTS } from '@/app/about/page'
import { TEAM_MEMBERS } from '@/app/about/team/page'

describe('About', () => {
  it('explains what SPLAT is and why it exists', () => {
    render(<AboutPage />)
    expect(screen.getByRole('heading', { level: 1, name: /about splat/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /why this exists/i })).toBeInTheDocument()
  })

  it('routes on to the team and to contact', () => {
    render(<AboutPage />)
    expect(screen.getByRole('link', { name: /our team/i })).toHaveAttribute('href', '/about/team')
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact')
  })

  // Guard against shipping the scaffold copy. These must be replaced before launch.
  it('has had its organisation facts filled in', () => {
    expect(ORG_FACTS.legalName).not.toMatch(/^TODO/)
    expect(ORG_FACTS.basedIn).not.toMatch(/^TODO/)
  })

  it('lists at least one real team member', () => {
    expect(TEAM_MEMBERS.length).toBeGreaterThan(0)
    expect(TEAM_MEMBERS[0].name).not.toMatch(/^TODO/)
  })

  it('renders a card per team member', () => {
    render(<TeamPage />)
    for (const member of TEAM_MEMBERS) {
      expect(screen.getByText(member.name)).toBeInTheDocument()
    }
  })

  it('gives contact routes for the three things people actually write in about', () => {
    render(<ContactPage />)
    expect(screen.getByRole('heading', { level: 1, name: /contact/i })).toBeInTheDocument()
    expect(screen.getByText(/safety/i)).toBeInTheDocument()
    expect(screen.getByText(/organisation/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run tests/unit/app/about.test.tsx`
Expected: FAIL — three unresolved imports.

- [ ] **Step 3: Write `app/about/page.tsx`**

```tsx
import Link from 'next/link'
import { EditorialImage } from '@/components/editorial-image'

export const metadata = {
  title: 'About SPLAT Connect',
  description:
    'Why toy adaptation matters, and who runs the platform that makes the knowledge shareable.',
}

/**
 * REPLACE BEFORE LAUNCH. tests/unit/app/about.test.tsx fails while any value
 * still starts with "TODO", so this cannot ship half-filled by accident.
 */
export const ORG_FACTS = {
  legalName: 'TODO: registered name of the organisation',
  basedIn: 'TODO: city, state',
  founded: 'TODO: year',
  contactEmail: 'TODO: hello@example.org',
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <EditorialImage illustration="organisation" ratio="3/2" />
      <h1 className="mt-6 text-2xl font-bold text-ink sm:text-3xl">About SPLAT Connect</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        SPLAT stands for <strong className="text-ink">Supporting Play by Adapting
        Toys</strong>. We publish free instructions for modifying ordinary toys so that
        children with disabilities can operate them, and we connect the people who build
        them to the families who need them.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-ink">Why this exists</h2>
        <p className="mt-2 leading-relaxed text-muted">
          Play is how children learn that their actions change the world. A child who
          cannot press a small stiff button is shut out of that, not because the toy is
          too complex, but because the button is in the wrong place.
        </p>
        <p className="mt-3 leading-relaxed text-muted">
          Purpose-built switch-adapted toys exist. They cost several times what the same
          toy costs off a shelf, the range is narrow, and a child rarely gets to choose
          the one they actually like. Meanwhile the modification itself is often a
          two-dollar part and twenty minutes — if you know which two wires to touch.
        </p>
        <p className="mt-3 leading-relaxed text-muted">
          That knowledge is the bottleneck, and it is the thing this platform exists to
          remove.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-ink">How the platform works</h2>
        <p className="mt-2 leading-relaxed text-muted">
          Contributors adapt a toy and write down how, in enough detail that a parent
          with no electronics experience can follow it. Organisations — therapy services,
          schools, disability services — review that work and put their name on it, so a
          badge on a guide means a professional read it. Families follow the guides, or
          receive a toy someone has already adapted through the Toy Library. Everything
          published here is free to read and free to build from.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-ink">Who runs it</h2>
        <p className="mt-2 leading-relaxed text-muted">
          SPLAT Connect is run by {ORG_FACTS.legalName}, based in {ORG_FACTS.basedIn} and
          working since {ORG_FACTS.founded}. The platform is free to use and carries no
          advertising.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/about/team" className="btn btn-primary">
            Our team
          </Link>
          <Link href="/contact" className="btn btn-soft">
            Contact us
          </Link>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-ink">What we are working on next</h2>
        <p className="mt-2 leading-relaxed text-muted">
          Some of what you can see on this site is not built yet, and those pages say so
          plainly rather than pretending. The largest missing piece is a way for a family
          to <em>ask</em> for an adaptation and have a maker nearby pick it up. If that
          would be useful to you, say so on the{' '}
          <Link href="/get-involved/requests" className="font-semibold text-brand-dark hover:underline">
            requests page
          </Link>{' '}
          — we build in the order people ask.
        </p>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Write `app/about/team/page.tsx`**

```tsx
import { EditorialImage } from '@/components/editorial-image'

export const metadata = { title: 'Our team — SPLAT Connect' }

/**
 * REPLACE BEFORE LAUNCH. `photo` stays null until real headshots exist — the
 * initials block below covers that case, so a missing photo is not a broken card.
 */
export const TEAM_MEMBERS: Array<{
  name: string
  role: string
  bio: string
  photo: string | null
}> = [
  {
    name: 'TODO: full name',
    role: 'TODO: role',
    bio: 'TODO: one or two sentences — what they do here, and what they did before.',
    photo: null,
  },
]

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function TeamPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">Our team</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        A small group of people, plus every contributor and organisation whose name
        appears on a guide.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TEAM_MEMBERS.map((member) => (
          <div key={member.name} className="card p-5">
            {member.photo ? (
              <EditorialImage src={member.photo} illustration="maker" ratio="1/1" />
            ) : (
              <div
                aria-hidden="true"
                className="grid aspect-square w-full place-items-center rounded-[14px] bg-brand-tint text-3xl font-bold text-brand-deep"
              >
                {initials(member.name)}
              </div>
            )}
            <p className="mt-4 font-bold text-ink">{member.name}</p>
            <p className="text-sm font-semibold text-brand-dark">{member.role}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{member.bio}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write `app/contact/page.tsx`**

```tsx
import Link from 'next/link'
import { ORG_FACTS } from '@/app/about/page'

export const metadata = { title: 'Contact — SPLAT Connect' }

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">Contact</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        Email reaches a person. There is no ticketing system and no chatbot.
      </p>

      <p className="mt-6">
        <a href={`mailto:${ORG_FACTS.contactEmail}`} className="btn btn-primary">
          {ORG_FACTS.contactEmail}
        </a>
      </p>

      <div className="mt-10 flex flex-col gap-5">
        <div className="card-flat p-5">
          <h2 className="font-bold text-ink">A safety problem with a guide</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Tell us immediately and we will take the guide down while we check it. Include
            the guide title and what you found. We would much rather pull a guide than
            leave a hazard published. See the{' '}
            <Link href="/safety" className="font-semibold text-brand-dark hover:underline">
              safety page
            </Link>
            .
          </p>
        </div>

        <div className="card-flat p-5">
          <h2 className="font-bold text-ink">Bringing an organisation on board</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Organisations are set up by us rather than self-registered, so a name on a
            guide means something. Tell us who you are and what you would like to do —{' '}
            <Link
              href="/get-involved/organisations"
              className="font-semibold text-brand-dark hover:underline"
            >
              what that involves
            </Link>
            .
          </p>
        </div>

        <div className="card-flat p-5">
          <h2 className="font-bold text-ink">Your account or your data</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            To request a copy of everything held against your account, or to have it
            deleted, email us from the address on the account. What we hold is set out in
            the{' '}
            <Link href="/privacy" className="font-semibold text-brand-dark hover:underline">
              privacy policy
            </Link>
            .
          </p>
        </div>

        <div className="card-flat p-5">
          <h2 className="font-bold text-ink">Reporting someone&apos;s behaviour</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Reports go to the SPLAT team, not to the person being reported, and we tell
            you what we decided. See the{' '}
            <Link href="/code-of-conduct" className="font-semibold text-brand-dark hover:underline">
              code of conduct
            </Link>
            .
          </p>
        </div>
      </div>

      <p className="mt-8 text-sm text-muted">
        {ORG_FACTS.legalName} · {ORG_FACTS.basedIn}
      </p>
    </div>
  )
}
```

- [ ] **Step 6: Fill in the real facts**

Replace every `TODO:` value in `ORG_FACTS` and `TEAM_MEMBERS`. The tests in step 1 fail until you do, which is deliberate.

- [ ] **Step 7: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run tests/unit/app/about.test.tsx`
Expected: PASS, 6 tests. If the two guard tests still fail, the facts are not filled in yet.

- [ ] **Step 8: Commit**

```bash
git add packages/web/app/about packages/web/app/contact packages/web/tests/unit/app/about.test.tsx
git commit -m "feat(web): about, team and contact pages"
```

---

## Task 18: Impact becomes a section hub

**Files:**
- Modify: `packages/web/app/impact/page.tsx`
- Test: `packages/web/tests/unit/app/impact-hub.test.tsx`

**Interfaces:**
- Consumes: `GET /api/public/impact` (existing, returns `ImpactSummary`), `PUBLIC_NAV` (Task 1), `<HubGrid>` (Task 7).
- Produces: nothing.

**What changes and what does not:** the totals band, the recently-active strip and the contributor/organisation grid all stay exactly as they are — that content was designed in `2026-08-18-public-contribution-showcase-design.md` and is not being revisited. What is added is a hub grid for the section's children, so News, Events, the deliveries map and the organisations directory are reachable from the page rather than only from the subnav.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/app/impact-hub.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HubGrid } from '@/components/hub-grid'
import { PUBLIC_NAV } from '@/lib/public-nav'

/**
 * The page itself is an async server component that fetches, which jsdom cannot
 * render. The E2E spec in Task 20 covers the fetched content. What is verified
 * here is the piece this task adds: the section's children rendered as a grid.
 */
const impact = PUBLIC_NAV.find((s) => s.href === '/impact')!

describe('Impact hub grid', () => {
  it('surfaces every Impact child', () => {
    render(<HubGrid items={impact.children} />)
    for (const child of impact.children) {
      expect(screen.getByRole('link', { name: new RegExp(child.label, 'i') })).toBeInTheDocument()
    }
  })

  it('links the organisations directory, which used to be signed-in only', () => {
    render(<HubGrid items={impact.children} />)
    expect(screen.getByRole('link', { name: /organisations/i })).toHaveAttribute(
      'href',
      '/organizations'
    )
  })

  it('marks news, events and the map as not yet built', () => {
    render(<HubGrid items={impact.children} />)
    for (const label of [/news/i, /events/i, /map/i]) {
      expect(screen.getByRole('link', { name: label })).toHaveTextContent(/soon/i)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run tests/unit/app/impact-hub.test.tsx`
Expected: FAIL — the Impact section has no children in the nav model yet if Task 1 was skipped; otherwise this passes immediately and the real work is step 3. Run it to confirm which.

- [ ] **Step 3: Add the hub grid to the page**

In `packages/web/app/impact/page.tsx`, keep everything from the `EMPTY_IMPACT` constant through the existing contributor and organisation grid untouched. Add the section-children grid at the end of the returned tree, and update the page's intro to say it is a hub.

```tsx
import { PUBLIC_NAV } from '@/lib/public-nav'
import { HubGrid } from '@/components/hub-grid'
```

Replace the intro paragraph:

```tsx
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        Tutorials written, toys shared, and deliveries made by the people and organisations
        behind SPLAT. Guides here are counted once they are approved and public.
      </p>
```

And append, just before the closing `</div>` of the page:

```tsx
      {/* The rest of the section. Organisations moved into the nav here because a
          directory of who stands behind the work is a proof surface, and it had
          nowhere in the top bar once the two catalogues were split. */}
      <div className="mt-12">
        <h2 className="text-lg font-bold text-ink">More in Impact</h2>
        <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
          Some of this is not built yet. Those pages say so, and will take your email if
          you want to know when they are.
        </p>
        <HubGrid items={PUBLIC_NAV.find((s) => s.href === '/impact')!.children} />
      </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run tests/unit/app/impact-hub.test.tsx`
Expected: PASS, 3 tests

- [ ] **Step 5: Check the existing E2E spec still holds**

Run: `cd packages/web && pnpm test:e2e tests/e2e/impact.spec.ts`
Expected: PASS. If a selector now matches twice — likely for an organisation name appearing in both the existing grid and the new hub grid — tighten that assertion with a scoped locator rather than removing it.

- [ ] **Step 6: Commit**

```bash
git add packages/web/app/impact/page.tsx packages/web/tests/unit/app/impact-hub.test.tsx
git commit -m "feat(web): impact page becomes its section hub"
```

---

## Task 19: Homepage rebuild

**Files:**
- Modify: `packages/web/app/page.tsx`
- Create: `packages/web/components/launcher-grid.tsx`
- Test: `packages/web/tests/unit/components/launcher-grid.test.tsx`

**Interfaces:**
- Consumes: `GET /api/public/impact`, `GET /api/public/tutorials`, `PUBLIC_NAV` (Task 1), `<EditorialImage>` (Task 6), `<TutorialCard>` (existing).
- Produces: `<LauncherGrid tiles={LauncherTile[]} />` where `LauncherTile = { href: Route; label: string; blurb: string; count?: number }`.

**Section order, top to bottom:** hero with inline stats → launcher grid → SPLAT in 30 seconds → where you fit → two previews → new from SPLAT. The hero and the launcher are the above-the-fold pair: a returning visitor leaves from the launcher without scrolling, a stranger scrolls once and learns the model.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/components/launcher-grid.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LauncherGrid, type LauncherTile } from '@/components/launcher-grid'

const tiles: LauncherTile[] = [
  { href: '/library' as LauncherTile['href'], label: 'Guides', blurb: 'Adaptation tutorials', count: 42 },
  { href: '/about' as LauncherTile['href'], label: 'About', blurb: 'Who we are' },
]

describe('LauncherGrid', () => {
  it('links every tile', () => {
    render(<LauncherGrid tiles={tiles} />)
    expect(screen.getByRole('link', { name: /guides/i })).toHaveAttribute('href', '/library')
    expect(screen.getByRole('link', { name: /about/i })).toHaveAttribute('href', '/about')
  })

  it('shows a count where there is one', () => {
    render(<LauncherGrid tiles={tiles} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders a tile without a count rather than showing a zero', () => {
    render(<LauncherGrid tiles={tiles} />)
    expect(screen.getByRole('link', { name: /about/i })).not.toHaveTextContent('0')
  })

  // An API failure degrades the whole page to zeros; the launcher must still be
  // navigable, since it is the fastest route out of a broken homepage.
  it('still links everything when every count is zero', () => {
    render(<LauncherGrid tiles={tiles.map((t) => ({ ...t, count: 0 }))} />)
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run tests/unit/components/launcher-grid.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/launcher-grid"`

- [ ] **Step 3: Write `components/launcher-grid.tsx`**

```tsx
// packages/web/components/launcher-grid.tsx
/**
 * The homepage's six-tile section launcher.
 *
 * This is the fast path, and the reason the site needs no dropdown menus: a
 * visitor who knows where they are going leaves from here without scrolling, and
 * a stranger reads the whole site's shape and scale in one glance. Icons are
 * deliberately absent — the grid is for scanning, not looking.
 */
import Link from 'next/link'
import type { Route } from 'next'

export interface LauncherTile {
  href: Route
  label: string
  blurb: string
  /** Omitted where a number would be meaningless, e.g. About. */
  count?: number
}

export function LauncherGrid({ tiles }: { tiles: LauncherTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => (
        <Link key={tile.href} href={tile.href} className="card card-link px-4 py-4 text-center">
          {tile.count !== undefined && (
            <p className="text-2xl font-bold leading-none text-brand-deep">{tile.count}</p>
          )}
          <p className="mt-1.5 text-sm font-bold text-ink">{tile.label}</p>
          <p className="mt-1 text-xs leading-snug text-muted">{tile.blurb}</p>
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run the component test**

Run: `cd packages/web && pnpm vitest run tests/unit/components/launcher-grid.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 5: Rewrite `app/page.tsx`**

```tsx
import Link from 'next/link'
import { TutorialCard } from '@/components/tutorial-card'
import { LauncherGrid, type LauncherTile } from '@/components/launcher-grid'
import { EditorialImage } from '@/components/editorial-image'
import { HubGrid } from '@/components/hub-grid'
import { PUBLIC_NAV } from '@/lib/public-nav'
import type { Tutorial, ImpactSummary } from '@splat-connect/types'

const EMPTY_TOTALS: ImpactSummary['totals'] = {
  tutorials: 0,
  toysShared: 0,
  toysDelivered: 0,
  contributors: 0,
  organisations: 0,
}

/** Same connection-failure guard as before: an unreachable API degrades to zeros
    and an empty row, never a 500. */
async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${process.env.API_URL}${path}`, { cache: 'no-store' })
    return res.ok ? ((await res.json()) as T) : fallback
  } catch {
    return fallback
  }
}

const HOW_IT_WORKS = [
  {
    title: 'A guide gets written',
    body: 'A contributor adapts a toy and documents every step, with a parts list anyone can buy from.',
  },
  {
    title: 'An organisation stands behind it',
    body: 'A therapy service or school reviews the work and puts their name on it, so a parent knows someone competent read it.',
  },
  {
    title: 'A family builds it — or receives one',
    body: 'Follow the guide with about thirty dollars of parts, or claim a toy someone has already adapted.',
  },
]

export default async function HomePage() {
  const [tutorials, impact] = await Promise.all([
    getJson<Tutorial[]>('/api/public/tutorials', []),
    getJson<ImpactSummary>('/api/public/impact', {
      totals: EMPTY_TOTALS,
      recent: [],
      contributors: [],
      organisations: [],
    }),
  ])

  const featured = tutorials.slice(0, 3)
  const { totals } = impact

  const learn = PUBLIC_NAV.find((s) => s.href === '/learn')!
  const getInvolved = PUBLIC_NAV.find((s) => s.href === '/get-involved')!
  const liveArticles = learn.children.filter((c) => c.state === 'live')

  const tiles: LauncherTile[] = [
    { href: '/library', label: 'Guides', blurb: 'Adaptation tutorials', count: totals.tutorials },
    { href: '/toy-library', label: 'Toy Library', blurb: 'Toys being given away', count: totals.toysShared },
    { href: '/learn', label: 'Learn', blurb: 'Switches, tools, safety', count: liveArticles.length },
    { href: '/get-involved', label: 'Get Involved', blurb: 'Make, give, or back' },
    { href: '/impact', label: 'Impact', blurb: 'Toys delivered', count: totals.toysDelivered },
    { href: '/about', label: 'About', blurb: 'Who runs SPLAT' },
  ]

  const tracks = getInvolved.children.slice(0, 3)

  return (
    <div>
      {/* Hero — the one surface on the site that carries brand colour as fill.
          Stats sit inside it so the proof arrives with the promise rather than in
          a band underneath. */}
      <div className="card-tint px-6 py-12 sm:px-12 sm:py-14">
        <div className="mx-auto grid max-w-4xl items-center gap-8 sm:grid-cols-2">
          <div>
            <h1 className="text-3xl font-bold text-ink sm:text-4xl">
              Every child deserves to play.
            </h1>
            <p className="mt-4 max-w-prose text-base leading-relaxed text-brand-deep sm:text-lg">
              A thirty-dollar switch turns a toy a child can&apos;t use into one they can.
              We publish the guides, and connect the people who build them.
            </p>
            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
              {[
                { label: 'Guides', value: totals.tutorials },
                { label: 'Toys delivered', value: totals.toysDelivered },
                { label: 'Contributors', value: totals.contributors },
              ].map((stat) => (
                <div key={stat.label}>
                  <dd className="text-2xl font-bold leading-none text-brand-deep">{stat.value}</dd>
                  <dt className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    {stat.label}
                  </dt>
                </div>
              ))}
            </dl>
            <Link href="/library" className="btn btn-primary mt-7 px-8">
              Browse the Guides →
            </Link>
          </div>
          <EditorialImage illustration="adapted-toy" ratio="3/2" />
        </div>
      </div>

      {/* Launcher — the whole site, above the fold. */}
      <div className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Jump straight in
        </h2>
        <LauncherGrid tiles={tiles} />
      </div>

      {/* An ordered flow, so the steps are numbered and connected rather than
          dropped into three interchangeable cards. */}
      <div className="mt-16">
        <h2 className="text-xl font-bold text-ink">SPLAT in 30 seconds</h2>
        <ol className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => (
            <li key={step.title} className="relative flex gap-4 sm:block">
              {i < HOW_IT_WORKS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-6 top-14 hidden h-[calc(100%-2rem)] w-px bg-line sm:left-14 sm:top-6 sm:block sm:h-px sm:w-[calc(100%-2.5rem)]"
                />
              )}
              <span className="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-tint text-lg font-bold text-brand-deep sm:mb-4">
                {i + 1}
              </span>
              <div>
                <h3 className="font-bold text-ink">{step.title}</h3>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-16">
        <h2 className="text-xl font-bold text-ink">Where you fit</h2>
        <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
          Each of these walks the whole path, start to finish.
        </p>
        <HubGrid items={tracks} />
      </div>

      <div className="mt-16 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-ink">Recent guides</h2>
            <Link
              href="/library"
              className="shrink-0 text-sm font-semibold text-brand-dark hover:underline"
            >
              View all →
            </Link>
          </div>
          {featured.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {featured.map((t) => (
                <TutorialCard key={t.id} tutorial={t} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No guides published yet.</p>
          )}
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-ink">Learn the basics</h2>
            <Link
              href="/learn"
              className="shrink-0 text-sm font-semibold text-brand-dark hover:underline"
            >
              View all →
            </Link>
          </div>
          <HubGrid items={liveArticles.slice(0, 3)} />
        </div>
      </div>
    </div>
  )
}
```

Note the "New from SPLAT" strip from the spec is deliberately not rendered: both News and Events are scaffolded, and the spec states the section is hidden entirely while that is true. Add it in the task that builds news and events.

- [ ] **Step 6: Run the whole unit suite**

Run: `cd packages/web && pnpm test:unit`
Expected: PASS. Any existing homepage test asserting the old "Browse / Buy the parts / Adapt & play" strip needs updating to the new three steps — an intended copy change.

- [ ] **Step 7: Look at it**

Run: `cd packages/web && pnpm dev` and open `http://localhost:3000` at 375 px, 768 px and 1440 px wide.
Check: the hero image sits beside the headline on wide screens and above it on narrow; the launcher is six-up on desktop, three-up on tablet, two-up on phone; the hero and launcher together fit one screenful at 1440 px.

- [ ] **Step 8: Commit**

```bash
git add packages/web/app/page.tsx packages/web/components/launcher-grid.tsx packages/web/tests/unit/components/launcher-grid.test.tsx
git commit -m "feat(web): homepage with launcher grid and the model explained"
```

---

## Task 20: End-to-end guards

**Files:**
- Create: `packages/web/tests/e2e/public/navigation.spec.ts`
- Create: `packages/web/tests/e2e/public/footer.spec.ts`
- Test: both of the above

**Interfaces:**
- Consumes: everything. This task is the net that catches a route declared in the nav model but never built.
- Produces: nothing.

**These two specs are the enforcement of the two rules the spec cares most about:** no top-level link lands on a placeholder, and every declared destination actually resolves.

- [ ] **Step 1: Check how the existing specs reach the app**

Read `packages/web/tests/e2e/helpers.ts` and `playwright.config.ts` to find the `baseURL` and whether a web server is started automatically. Match that setup — do not introduce a second mechanism.

- [ ] **Step 2: Write `tests/e2e/public/navigation.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

/**
 * The scaffold rule, enforced rather than remembered.
 *
 * Eleven placeholder pages linked from a top nav teaches a visitor the site is
 * mostly empty — the exact failure the design session set out to avoid. So every
 * top-level link must land on real content, and placeholders live one level down
 * behind a "soon" pill.
 */
const TOP_LEVEL = [
  { href: '/library', label: 'Guides' },
  { href: '/toy-library', label: 'Toy Library' },
  { href: '/learn', label: 'Learn' },
  { href: '/get-involved', label: 'Get Involved' },
  { href: '/impact', label: 'Impact' },
  { href: '/about', label: 'About' },
]

test.describe('public navigation', () => {
  test('every top-level link resolves and none is a placeholder', async ({ page }) => {
    for (const section of TOP_LEVEL) {
      const res = await page.goto(section.href)
      expect(res?.status(), `${section.href} should not error`).toBeLessThan(400)
      await expect(
        page.getByText(/not built yet/i),
        `${section.href} must not be a scaffold`
      ).toHaveCount(0)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
  })

  test('the top bar carries all six sections and no expandable menu', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header')
    for (const section of TOP_LEVEL) {
      await expect(header.getByRole('link', { name: section.label, exact: true })).toBeVisible()
    }
    await expect(page.locator('[aria-expanded]')).toHaveCount(0)
  })

  test('the subnav appears inside a section and not on a flat catalogue', async ({ page }) => {
    await page.goto('/learn')
    await expect(page.getByRole('navigation', { name: /learn pages/i })).toBeVisible()

    await page.goto('/toy-library')
    await expect(page.getByRole('navigation', { name: /pages$/i })).toHaveCount(0)
  })

  test('the subnav marks where you are', async ({ page }) => {
    await page.goto('/learn/switch-types')
    const subnav = page.getByRole('navigation', { name: /learn pages/i })
    await expect(subnav.locator('[aria-current="page"]')).toHaveText(/switch types/i)
  })

  test('the organisations directory is reachable with no session', async ({ page }) => {
    const res = await page.goto('/organizations')
    expect(res?.status()).toBeLessThan(400)
    expect(page.url()).not.toContain('/login')
  })

  test('a scaffold page explains itself and offers to notify', async ({ page }) => {
    await page.goto('/get-involved/requests')
    await expect(page.getByText(/not built yet/i)).toBeVisible()
    await expect(page.getByLabel(/email address/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /guides/i }).first()).toBeVisible()
  })

  test('the homepage launcher reaches all six sections', async ({ page }) => {
    await page.goto('/')
    for (const section of TOP_LEVEL) {
      await expect(page.locator(`a[href="${section.href}"]`).first()).toBeVisible()
    }
  })
})
```

- [ ] **Step 3: Write `tests/e2e/public/footer.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { PUBLIC_NAV, FOOTER_LEGAL } from '../../../lib/public-nav'

/**
 * The broadest guard in the suite.
 *
 * The footer is generated from PUBLIC_NAV, so walking every one of its links
 * catches a route that was added to the nav model but never built — which is the
 * most likely way this 43-route site rots.
 */
const ALL_HREFS = [
  ...PUBLIC_NAV.map((s) => s.href),
  ...PUBLIC_NAV.flatMap((s) => s.children.map((c) => c.href)),
  ...FOOTER_LEGAL.map((l) => l.href),
] as string[]

test.describe('fat footer', () => {
  test('renders on a public page with every destination', async ({ page }) => {
    await page.goto('/')
    const footer = page.locator('footer')
    await expect(footer).toBeVisible()
    for (const href of ALL_HREFS) {
      await expect(footer.locator(`a[href="${href}"]`).first()).toBeAttached()
    }
  })

  test('every destination it lists actually resolves', async ({ page }) => {
    for (const href of ALL_HREFS) {
      const res = await page.goto(href)
      expect(res?.status(), `${href} should resolve`).toBeLessThan(400)
      await expect(page.getByRole('heading', { level: 1 }), `${href} needs an h1`).toBeVisible()
    }
  })

  test('is present on a scaffold page too, so a placeholder is never a dead end', async ({ page }) => {
    await page.goto('/impact/news')
    await expect(page.locator('footer').getByRole('link', { name: 'Privacy policy' })).toBeVisible()
  })

  test('is absent on the auth pages, which are deliberately bare', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('footer')).toHaveCount(0)
  })
})
```

If importing from `lib/public-nav` inside a Playwright spec fails on the `next` type import, replace the `import type { Route } from 'next'` usage by widening `NavItem['href']` to `string` in the model — the typed-route benefit is in the components, not the data.

- [ ] **Step 4: Run the new specs**

Run: `cd packages/web && pnpm test:e2e tests/e2e/public/navigation.spec.ts tests/e2e/public/footer.spec.ts`
Expected: PASS. A failure in "every destination it lists actually resolves" names the exact unbuilt route — fix by building it, never by removing it from the nav model.

- [ ] **Step 5: Run the whole suite**

Run: `cd packages/web && pnpm test:unit && pnpm test:e2e && pnpm typecheck && pnpm lint`
Then: `cd ../api && pnpm vitest run tests/integration/public`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/web/tests/e2e/public
git commit -m "test(web): enforce the scaffold rule and walk every footer link"
```

---

## Self-Review Notes

Recorded so the next reader knows what was checked rather than assumed.

**Spec coverage.** Every section of the spec maps to a task: IA and nav model → 1, 2, 3, 4, 5; visual assets → 6; hub pattern → 7, 13, 15, 18; trust pages → 8; notify schema and endpoint → 9; ComingSoon extension → 10; nine scaffolds → 11; public organisations endpoint → 12; Learn content → 13, 14; Get Involved content → 15, 16; About content → 17; Impact hub → 18; homepage → 19; testing → distributed, plus 20 for E2E.

**One deliberate deviation from "no placeholders".** Task 17 ships `ORG_FACTS` and `TEAM_MEMBERS` containing `TODO:` strings. This is not an unfinished plan step — it is a data gap only the project owner can close (legal name, location, founding year, team members, contact address), and the task's own unit tests fail while any value still starts with `TODO`. The instruction to the implementer is complete; the facts are not mine to invent, and an About page with fabricated details would be worse than none.

**Type consistency checked.** `NavItem` / `NavSection` / `NavState` are defined in Task 1 and consumed unchanged in Tasks 2, 3, 4, 5, 7, 13, 15, 18, 19, 20. `IllustrationKey` and `ImageRatio` are defined in Task 6 and consumed in 13, 14, 15, 17, 19. `LauncherTile` is defined and consumed within Task 19. `SCAFFOLD_KEYS` (Task 1) is asserted against the page count in Task 11 and mirrors `NOTIFY_FEATURE_KEYS` in Task 9 — these are two lists in two packages that must agree, which is why Task 11's first test counts them against each other.

**Two things the implementer must verify rather than trust.** `createOrg`'s signature in `packages/api/tests/helpers/orgs.ts` (Task 12, step 1) and whether `@testing-library/user-event` is installed (Task 10, step 3). Both have a stated fallback.

**Known ordering constraint.** Task 8 (trust pages) must precede Task 9 and 10 (email capture). Tasks 1–7 must precede everything else. Tasks 13–19 are independent of each other and can be parallelised.

---

## Deferred to a later plan

Named here so nothing looks dropped:

- The **"New from SPLAT"** homepage strip, which the spec defines but which stays hidden while News and Events are scaffolded (Task 19, step 5).
- Every scaffolded feature itself: adaptation requests, design challenges, 3D print jobs, news, events, the deliveries map, partners, support. Each needs its own spec.
- Replacing the seven illustrations with the team's workshop photographs. `EditorialImage` is built for it; the change is a `src` and a `caption` per slot, with no layout consequences because the ratios are fixed.
