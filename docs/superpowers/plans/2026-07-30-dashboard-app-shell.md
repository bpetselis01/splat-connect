# Dashboard App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the web app's top bar + dashboard tab strip with one collapsible navigation rail for signed-in accounts, and merge `/my-tutorials` into `/dashboard`.

**Architecture:** A pure function (`buildNav`) turns a `Capabilities` object into grouped nav rows. A server component (`AppShell`) reads the collapse cookie and renders a client frame holding the rail and `<main>`. The root layout branches: signed-out visitors keep today's `<Nav>`, signed-in accounts get the shell. Middleware publishes the pathname as a request header so the shell can exclude auth and onboarding routes.

**Tech Stack:** Next.js 16.2.6 (App Router, Turbopack), React 19.2.4, Tailwind CSS v4, TypeScript, Vitest + Testing Library (unit), Playwright (e2e), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-07-30-dashboard-app-shell-design.md` (commit `76f2a24`)

## Global Constraints

- **All work is in `packages/web`.** `packages/mobile` is not modified. Run commands from `packages/web` unless a path says otherwise.
- **No new dependencies.** Icons are hand-drawn SVG paths on the existing `<Icon>` primitive in `components/icons.tsx`. That file's header states the no-dependency intent.
- **`typedRoutes: true`** is set in `next.config.ts`. Every `href` is type-checked against routes that exist. A placeholder route must have a real `page.tsx` before anything links to it. `buildNav` returns plain `string` hrefs, so the rail casts at the `<Link>` boundary with `as never` — the same escape hatch `components/dashboard-tabs.tsx:36` uses today.
- **Active state is an exact pathname match, never `startsWith`.** `/dashboard` is a prefix of every other dashboard route.
- **Palette tokens only** — use the `@theme` names from `app/globals.css` (`brand-deep`, `brand-soft`, `brand-tint`, `canvas`, `surface`, `line`, `ink`, `muted`, `apricot-soft`, `apricot-deep`). No raw hex in components.
- **Rail surface:** background `brand-deep` (`#0a4f70`), labels `brand-soft` (`#bfe4f5`). Measured 6.5:1.
- **Group headings, in order:** `Browse`, `Yours`, `Organisation`, `Account`. The `Organisation` group renders only when `caps.ledOrgs.length > 0`.
- **Test commands:** `pnpm test:unit` (vitest), `pnpm test:e2e` (playwright), `pnpm typecheck`, `pnpm lint`. Per project memory, `pnpm test:e2e -- <name>` does **not** filter — it runs the whole suite. Use `pnpm exec playwright test <path>` to run one spec.
- **Commit granularity:** one commit per task minimum; split further where a task has separable deliverables. Descriptive messages, not one big commit.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `lib/nav-model.ts` | `buildNav(caps) → NavGroup[]`. Pure, no React, no Next imports. |
| `components/rail.tsx` | Presentational rail. Receives groups, pathname, collapsed state. |
| `components/shell-frame.tsx` | `'use client'`. Owns collapse state, cookie write, mobile drawer. |
| `components/app-shell.tsx` | Server. Reads cookie, calls `buildNav`, renders `ShellFrame`. |
| `components/coming-soon.tsx` | Web placeholder body, ported from mobile. |
| `app/toy-library/page.tsx` | Public placeholder. |
| `app/printing/page.tsx` | Public placeholder. |
| `app/dashboard/toys/page.tsx` | Placeholder. |
| `app/dashboard/print-requests/page.tsx` | Placeholder. |
| `app/dashboard/organisation/toys/page.tsx` | Placeholder. |
| `app/dashboard/organisation/orders/page.tsx` | Placeholder. |

**Modified**

| File | Change |
|---|---|
| `app/layout.tsx` | Branch on capabilities; shell or `<Nav>`. |
| `middleware.ts` | Publish `x-pathname`; drop `/my-tutorials` from both route arrays. |
| `next.config.ts` | Permanent redirect `/my-tutorials` → `/dashboard`. |
| `app/globals.css` | Rail width custom property and rail component classes. |
| `components/icons.tsx` | Fifteen new icons — eleven nav, plus the two collapse chevrons, the drawer trigger and sign out. |
| `app/dashboard/page.tsx` | Absorbs `/my-tutorials`: full list, `data-testid`, no "View all" link. |
| `app/upload/page.tsx:257` | Post-submit redirect → `/dashboard`. |
| `app/tutorials/[id]/edit/page.tsx:55,63` | `revalidatePath('/dashboard')`. |

**Deleted**

| File | Reason |
|---|---|
| `app/my-tutorials/page.tsx` | Merged into `/dashboard`. |
| `app/dashboard/layout.tsx` | Built the tab array; redirect duplicated middleware. |
| `components/dashboard-tabs.tsx` | Replaced by `rail.tsx`. |
| `components/dashboard-nav.tsx` | Only supplied `usePathname()`. |
| `tests/unit/pages/my-tutorials.test.tsx` | Page no longer exists. |
| `tests/unit/components/dashboard-tabs.test.tsx` | Replaced by rail + nav-model tests. |

---

## Scope Note: `/my-tutorials` blast radius

The spec treated the merge as a two-file change. It is not — twelve files reference `/my-tutorials`. The redirect absorbs most of them (an e2e `page.goto('/my-tutorials')` still lands on the merged list), but three are real code changes and are handled in Task 5:

- `app/upload/page.tsx:257` — `window.location.href = '/my-tutorials'` after submit
- `app/tutorials/[id]/edit/page.tsx:55,63` — `revalidatePath('/my-tutorials')`
- `tests/unit/components/upload-page.test.tsx:348` — asserts the redirect target

---

### Task 1: The nav model

Pure function, no React. This is where "who sees which row" lives — the direct
descendant of the tab array at `app/dashboard/layout.tsx:30-42`.

**Files:**
- Create: `packages/web/lib/nav-model.ts`
- Test: `packages/web/tests/unit/lib/nav-model.test.ts`

**Interfaces:**
- Consumes: `Capabilities` from `@/lib/capabilities` (`{ profile, isAdmin, isParent, ledOrgs, canAuthor }`)
- Produces:
  - `type IconName = 'book' | 'toy' | 'printer' | 'building' | 'file' | 'box' | 'clipboard' | 'child' | 'inbox' | 'shelf' | 'orders' | 'user' | 'shield'`
  - `type NavRow = { href: string; label: string; icon: IconName; soon?: boolean }`
  - `type NavGroup = { heading: string; rows: NavRow[] }`
  - `function buildNav(caps: Capabilities): NavGroup[]`

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/unit/lib/nav-model.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildNav } from '@/lib/nav-model'
import type { Capabilities } from '@/lib/capabilities'
import type { Profile, Organization } from '@splat-connect/types'

const profile: Profile = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'contributor',
  created_at: '2026-01-01T00:00:00Z',
}

const org: Organization = {
  id: 'org-1',
  name: 'Alpha',
  description: null,
  status: 'active',
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function caps(over: Partial<Capabilities> = {}): Capabilities {
  return {
    profile,
    isAdmin: false,
    isParent: false,
    ledOrgs: [],
    canAuthor: true,
    ...over,
  }
}

const headings = (groups: ReturnType<typeof buildNav>) => groups.map((g) => g.heading)
const hrefs = (groups: ReturnType<typeof buildNav>) =>
  groups.flatMap((g) => g.rows.map((r) => r.href))

describe('buildNav', () => {
  it('gives a plain contributor three groups, without Organisation', () => {
    expect(headings(buildNav(caps()))).toEqual(['Browse', 'Yours', 'Account'])
  })

  // Chain: leadership is granted by an admin, so an empty Organisation group
  //        would offer a capability the visitor cannot obtain.
  it('adds the Organisation group only when the account leads an org', () => {
    expect(headings(buildNav(caps({ ledOrgs: [org] })))).toEqual([
      'Browse',
      'Yours',
      'Organisation',
      'Account',
    ])
    expect(hrefs(buildNav(caps({ ledOrgs: [org] })))).toContain('/dashboard/organisation')
  })

  it('adds Admin to the Account group only for admins', () => {
    expect(hrefs(buildNav(caps()))).not.toContain('/admin')
    expect(hrefs(buildNav(caps({ isAdmin: true })))).toContain('/admin')
  })

  // Chain: gating Child profile on isParent would mean the only way to create
  //        a child profile is to already have one.
  it('shows Child profile to accounts that are not yet parents', () => {
    expect(hrefs(buildNav(caps({ isParent: false })))).toContain('/dashboard/child')
  })

  it('marks the six unbuilt rows as soon, and no others', () => {
    const soon = buildNav(caps({ ledOrgs: [org], isAdmin: true }))
      .flatMap((g) => g.rows)
      .filter((r) => r.soon)
      .map((r) => r.href)
    expect(soon).toEqual([
      '/toy-library',
      '/printing',
      '/dashboard/toys',
      '/dashboard/print-requests',
      '/dashboard/organisation/toys',
      '/dashboard/organisation/orders',
    ])
  })

  // The spec's fourteenth row is Sign out, which is an action the rail footer
  // renders rather than a nav row — hence thirteen here.
  it('builds thirteen linked rows for a leader-admin', () => {
    const rows = buildNav(caps({ ledOrgs: [org], isAdmin: true })).flatMap((g) => g.rows)
    expect(rows).toHaveLength(13)
  })

  it('gives every row a unique href', () => {
    const all = hrefs(buildNav(caps({ ledOrgs: [org], isAdmin: true })))
    expect(new Set(all).size).toBe(all.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm exec vitest run tests/unit/lib/nav-model.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/nav-model"`

- [ ] **Step 3: Write the implementation**

Create `packages/web/lib/nav-model.ts`:

```ts
/**
 * Which navigation rows an account sees.
 *
 * The successor to the tab array that lived in app/dashboard/layout.tsx: the
 * same "what may this user reach" question, one level richer. Kept pure — no
 * React, no Next imports — so it is tested by calling it, not by rendering.
 *
 * Rows are named for what they hold, not for who holds them. There is no
 * "Contributor" group: capability is derived from data, not read from a role
 * column (see lib/capabilities.ts), and one account is routinely both a parent
 * and an author.
 *
 * An affordance, not a control. Every page re-checks its own access — see
 * lib/org-access.ts for the same rule stated about organisations.
 *
 * Related files:
 * - lib/capabilities.ts: where the input comes from
 * - components/rail.tsx: the only consumer
 */
import type { Capabilities } from '@/lib/capabilities'

export type IconName =
  | 'book'
  | 'toy'
  | 'printer'
  | 'building'
  | 'file'
  | 'box'
  | 'clipboard'
  | 'child'
  | 'inbox'
  | 'shelf'
  | 'orders'
  | 'user'
  | 'shield'

/** `soon` marks a route that exists but has no feature behind it yet. */
export type NavRow = { href: string; label: string; icon: IconName; soon?: boolean }

export type NavGroup = { heading: string; rows: NavRow[] }

export function buildNav(caps: Capabilities): NavGroup[] {
  const groups: NavGroup[] = [
    {
      heading: 'Browse',
      rows: [
        // "Library" alone stops being unambiguous once a toy library exists.
        { href: '/library', label: 'Tutorial library', icon: 'book' },
        { href: '/toy-library', label: 'Toy library', icon: 'toy', soon: true },
        { href: '/printing', label: '3D printing', icon: 'printer', soon: true },
        { href: '/organizations', label: 'Organisations', icon: 'building' },
      ],
    },
    {
      heading: 'Yours',
      rows: [
        // Route stays /dashboard: it is the post-login landing every redirect
        // and e2e waitForURL depends on. Only the label changed.
        { href: '/dashboard', label: 'My tutorials', icon: 'file' },
        { href: '/dashboard/toys', label: 'My toys', icon: 'box', soon: true },
        {
          href: '/dashboard/print-requests',
          label: 'My print requests',
          icon: 'clipboard',
          soon: true,
        },
        // Shown to non-parents too: filling it in is what makes them a parent.
        { href: '/dashboard/child', label: 'Child profile', icon: 'child' },
      ],
    },
  ]

  // Leadership cannot be self-started — an admin grants it — so an empty group
  // here would advertise something the visitor has no way to obtain.
  if (caps.ledOrgs.length > 0) {
    groups.push({
      heading: 'Organisation',
      rows: [
        // "Review queue", not "Manage team": no page anywhere lets a leader
        // add a member or create an org. The label names what exists.
        { href: '/dashboard/organisation', label: 'Review queue', icon: 'inbox' },
        {
          href: '/dashboard/organisation/toys',
          label: 'Toy inventory',
          icon: 'shelf',
          soon: true,
        },
        {
          href: '/dashboard/organisation/orders',
          label: 'Print orders',
          icon: 'orders',
          soon: true,
        },
      ],
    })
  }

  groups.push({
    heading: 'Account',
    rows: [
      { href: '/dashboard/profile', label: 'Profile', icon: 'user' },
      ...(caps.isAdmin
        ? [{ href: '/admin', label: 'Admin', icon: 'shield' as const }]
        : []),
    ],
  })

  return groups
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/web && pnpm exec vitest run tests/unit/lib/nav-model.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/nav-model.ts packages/web/tests/unit/lib/nav-model.test.ts
git commit -m "feat(web): derive navigation rows from capabilities

buildNav is the successor to the dashboard tab array — same question,
one level richer, and pure so it is tested by calling it rather than by
rendering. No group is named for a role.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Placeholder pages

These must exist before anything links to them — `typedRoutes: true` rejects an
`href` to a route with no `page.tsx`.

**Files:**
- Create: `packages/web/components/coming-soon.tsx`
- Create: `packages/web/app/toy-library/page.tsx`
- Create: `packages/web/app/printing/page.tsx`
- Create: `packages/web/app/dashboard/toys/page.tsx`
- Create: `packages/web/app/dashboard/print-requests/page.tsx`
- Create: `packages/web/app/dashboard/organisation/toys/page.tsx`
- Create: `packages/web/app/dashboard/organisation/orders/page.tsx`
- Test: `packages/web/tests/unit/components/coming-soon.test.tsx`

**Interfaces:**
- Consumes: `BookOpen` from `@/components/icons` (already exported)
- Produces: `ComingSoon({ label, description, steps }: { label: string; description: string; steps: string[] })`

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/unit/components/coming-soon.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComingSoon } from '@/components/coming-soon'

describe('ComingSoon', () => {
  it('names the feature and lists how it will work', () => {
    render(
      <ComingSoon
        label="Toy Library"
        description="Associations near you with adapted and accessible toys."
        steps={['Find associations near you', 'Browse the adapted toys they hold']}
      />
    )
    expect(screen.getByRole('heading', { name: 'Toy Library' })).toBeInTheDocument()
    expect(screen.getByText('Toy Library is coming soon.')).toBeInTheDocument()
    expect(screen.getByText('Find associations near you')).toBeInTheDocument()
    expect(screen.getByText('Browse the adapted toys they hold')).toBeInTheDocument()
  })

  // Chain: a placeholder that dead-ends is most of what a new parent sees. It
  //        must route to the part of the app that already works.
  it('offers a way onward', () => {
    render(<ComingSoon label="3D Printing" description="Request a printed part." steps={[]} />)
    expect(screen.getByRole('link', { name: 'Browse tutorials' })).toHaveAttribute(
      'href',
      '/library'
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm exec vitest run tests/unit/components/coming-soon.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/coming-soon"`

- [ ] **Step 3: Write the component**

Create `packages/web/components/coming-soon.tsx`:

```tsx
/**
 * Placeholder for a route whose feature has not shipped.
 *
 * Ported from packages/mobile/components/coming-soon.tsx, which states the bar
 * this has to clear: a bare "coming soon" sentence was most of what a new
 * parent saw, so it now explains what the feature will do and routes to the
 * part of the app that already works rather than dead-ending.
 *
 * Copy for /toy-library and /printing is reused verbatim from the mobile tabs
 * so a parent reads the same sentence on both surfaces.
 */
import Link from 'next/link'
import { BookOpen } from '@/components/icons'

export function ComingSoon({
  label,
  description,
  steps,
}: {
  label: string
  description: string
  steps: string[]
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-ink">{label}</h1>

      <div className="card flex flex-col items-center px-6 py-10 text-center">
        <span aria-hidden="true" className="empty-badge text-brand-dark">
          <BookOpen className="h-8 w-8" />
        </span>
        {/* Wording is pinned by the unit test — keep the sentence intact. */}
        <p className="mt-4 text-lg font-bold text-ink">{label} is coming soon.</p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{description}</p>
      </div>

      {steps.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-ink">How it will work</h2>
          <ol className="flex flex-col gap-4">
            {steps.map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-tint text-sm font-bold text-brand-deep"
                >
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-10 text-center">
        <p className="mb-3 text-sm text-muted">
          In the meantime, the tutorial library is ready to use.
        </p>
        <Link href="/library" className="btn btn-accent">
          Browse tutorials
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/web && pnpm exec vitest run tests/unit/components/coming-soon.test.tsx`
Expected: PASS — 2 tests

- [ ] **Step 5: Create the two public placeholder routes**

Copy is verbatim from `packages/mobile/app/(tabs)/toy-library.tsx` and `print.tsx`.

Create `packages/web/app/toy-library/page.tsx`:

```tsx
import { ComingSoon } from '@/components/coming-soon'

export default function ToyLibraryPage() {
  return (
    <ComingSoon
      label="Toy Library"
      description="Associations near you with adapted and accessible toys to borrow, donate or exchange."
      steps={[
        'Find associations near you',
        'Browse the adapted toys they hold',
        'Donate a toy, or exchange one for one',
      ]}
    />
  )
}
```

Create `packages/web/app/printing/page.tsx`:

```tsx
import { ComingSoon } from '@/components/coming-soon'

export default function PrintingPage() {
  return (
    <ComingSoon
      label="3D Print Requests"
      description="Request a printed part at a public association, sized to your child's measurements."
      steps={[
        'Pick an association with printers free',
        'Describe the part and how many you need',
        "They'll be in touch about pickup",
      ]}
    />
  )
}
```

- [ ] **Step 6: Create the four audience-specific placeholder routes**

The same feature makes a different promise to a parent than to a leader, so
these get their own copy rather than reusing the browse text.

Create `packages/web/app/dashboard/toys/page.tsx`:

```tsx
import { ComingSoon } from '@/components/coming-soon'

export default function MyToysPage() {
  return (
    <ComingSoon
      label="My Toys"
      description="The adapted toys you hold, ready to offer for exchange with an association."
      steps={[
        'Add a toy, with photos and what it was adapted for',
        'Offer it for exchange or keep it listed as yours',
        'Agree a swap with an association near you',
      ]}
    />
  )
}
```

Create `packages/web/app/dashboard/print-requests/page.tsx`:

```tsx
import { ComingSoon } from '@/components/coming-soon'

export default function MyPrintRequestsPage() {
  return (
    <ComingSoon
      label="My Print Requests"
      description="The parts you have asked an association to print, and where each one has got to."
      steps={[
        'Request a part from an association with printers free',
        'Follow it from accepted through printed',
        'Arrange pickup when it is ready',
      ]}
    />
  )
}
```

Create `packages/web/app/dashboard/organisation/toys/page.tsx`:

```tsx
import { ComingSoon } from '@/components/coming-soon'

export default function OrgToyInventoryPage() {
  return (
    <ComingSoon
      label="Toy Inventory"
      description="The adapted toys your organisation holds. This list is public, so parents can find and request them."
      steps={[
        'Add the toys your organisation holds',
        'Mark each one available, lent out or reserved',
        'Accept exchange requests from parents',
      ]}
    />
  )
}
```

Create `packages/web/app/dashboard/organisation/orders/page.tsx`:

```tsx
import { ComingSoon } from '@/components/coming-soon'

export default function OrgPrintOrdersPage() {
  return (
    <ComingSoon
      label="Print Orders"
      description="Print requests parents have sent your organisation, from first ask to pickup."
      steps={[
        'Review incoming requests and what each part needs',
        'Accept the ones your printers can take',
        'Mark them printed and ready for pickup',
      ]}
    />
  )
}
```

- [ ] **Step 7: Verify the routes typecheck and build**

Run: `cd packages/web && pnpm typecheck`
Expected: PASS — no errors

- [ ] **Step 8: Commit**

```bash
git add packages/web/components/coming-soon.tsx \
        packages/web/tests/unit/components/coming-soon.test.tsx \
        packages/web/app/toy-library packages/web/app/printing \
        packages/web/app/dashboard/toys packages/web/app/dashboard/print-requests \
        packages/web/app/dashboard/organisation/toys \
        packages/web/app/dashboard/organisation/orders
git commit -m "feat(web): placeholder routes for toy library and 3D printing

Six routes with no feature behind them yet, so the rail can link to
every future destination and never restructure as they land. Browse copy
is verbatim from the mobile tabs; the four audience-specific pages get
their own, because the same feature promises a parent and a leader
different things.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Icons and the rail

**Files:**
- Modify: `packages/web/components/icons.tsx` (append after line 89)
- Create: `packages/web/components/rail.tsx`
- Test: `packages/web/tests/unit/components/rail.test.tsx`

**Interfaces:**
- Consumes: `NavGroup`, `IconName` from `@/lib/nav-model`; `Icon` primitive pattern in `@/components/icons`
- Produces:
  - `components/icons.tsx` gains: `Toy, Printer, Building, Box, Clipboard, Child, Inbox, Shelf, Orders, User, Shield` — each `(props: SVGProps<SVGSVGElement>) => JSX.Element`
  - `Rail({ groups, pathname, collapsed, onToggle, onNavigate }: RailProps)` where
    `RailProps = { groups: NavGroup[]; pathname: string; collapsed: boolean; onToggle: () => void; onNavigate?: () => void }`

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/unit/components/rail.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
// fireEvent, not user-event: @testing-library/user-event is not a dependency
// of this package and the no-new-dependencies constraint applies to tests too.
import { render, screen, fireEvent } from '@testing-library/react'
import { Rail } from '@/components/rail'
import type { NavGroup } from '@/lib/nav-model'

const GROUPS: NavGroup[] = [
  {
    heading: 'Browse',
    rows: [
      { href: '/library', label: 'Tutorial library', icon: 'book' },
      { href: '/toy-library', label: 'Toy library', icon: 'toy', soon: true },
    ],
  },
  {
    heading: 'Yours',
    rows: [
      { href: '/dashboard', label: 'My tutorials', icon: 'file' },
      { href: '/dashboard/child', label: 'Child profile', icon: 'child' },
    ],
  },
]

const noop = () => {}

describe('Rail', () => {
  it('renders every group heading and row', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard" collapsed={false} onToggle={noop} />)
    expect(screen.getByText('Browse')).toBeInTheDocument()
    expect(screen.getByText('Yours')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tutorial library' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Child profile' })).toBeInTheDocument()
  })

  it('marks the current row', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard/child" collapsed={false} onToggle={noop} />)
    expect(screen.getByRole('link', { name: 'Child profile' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  // Chain: /dashboard prefixes every other dashboard route, so a startsWith
  //        match would light My tutorials on every page in the group.
  it('does not mark My tutorials current on a sibling route', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard/child" collapsed={false} onToggle={noop} />)
    expect(screen.getByRole('link', { name: 'My tutorials' })).not.toHaveAttribute('aria-current')
  })

  // Chain: collapsed to icons, the label is the only thing a screen reader has.
  it('keeps an accessible name for every row when collapsed', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard" collapsed onToggle={noop} />)
    expect(screen.getByRole('link', { name: 'Tutorial library' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My tutorials' })).toBeInTheDocument()
  })

  it('marks unbuilt rows so they are not mistaken for working ones', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard" collapsed={false} onToggle={noop} />)
    const soon = screen.getByRole('link', { name: /Toy library/ })
    expect(soon).toHaveTextContent('Soon')
  })

  it('calls onToggle when the collapse control is used', () => {
    const onToggle = vi.fn()
    render(<Rail groups={GROUPS} pathname="/dashboard" collapsed={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: /collapse|expand/i }))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('offers a sign out control', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard" collapsed={false} onToggle={noop} />)
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm exec vitest run tests/unit/components/rail.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/rail"`

- [ ] **Step 3: Add the icons**

Append to `packages/web/components/icons.tsx` (after the existing `X` at line 89):

```tsx
export function Toy(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21v-3a7 7 0 0 1 14 0v3" />
      <line x1="9" y1="8" x2="9.01" y2="8" />
      <line x1="15" y1="8" x2="15.01" y2="8" />
    </Icon>
  )
}

export function Printer(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </Icon>
  )
}

export function Building(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="9" y1="8" x2="9.01" y2="8" />
      <line x1="15" y1="8" x2="15.01" y2="8" />
      <line x1="9" y1="12" x2="9.01" y2="12" />
      <line x1="15" y1="12" x2="15.01" y2="12" />
      <path d="M10 21v-4h4v4" />
    </Icon>
  )
}

export function Box(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
      <path d="M3 8l9 5 9-5" />
      <line x1="12" y1="13" x2="12" y2="21" />
    </Icon>
  )
}

export function Clipboard(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
    </Icon>
  )
}

export function Child(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="6" r="3" />
      <path d="M12 9v6" />
      <path d="M8 12h8" />
      <path d="M9 21l3-6 3 6" />
    </Icon>
  )
}

export function Inbox(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 13h5l1 3h6l1-3h5" />
      <path d="M5 4h14l3 9v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5z" />
    </Icon>
  )
}

export function Shelf(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="8" y1="4" x2="8" y2="12" />
      <line x1="15" y1="12" x2="15" y2="20" />
    </Icon>
  )
}

export function Orders(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 4h2l2 12h10l2-8H7" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </Icon>
  )
}

export function User(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </Icon>
  )
}

export function Shield(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    </Icon>
  )
}

/** Rail collapse control. Chevrons point the way the rail will move. */
export function ChevronsLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M11 17l-5-5 5-5" />
      <path d="M18 17l-5-5 5-5" />
    </Icon>
  )
}

export function ChevronsRight(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M13 17l5-5-5-5" />
      <path d="M6 17l5-5-5-5" />
    </Icon>
  )
}

/** Mobile drawer trigger. */
export function Menu(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </Icon>
  )
}

export function LogOut(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Icon>
  )
}
```

- [ ] **Step 4: Write the rail**

Create `packages/web/components/rail.tsx`:

```tsx
/**
 * The signed-in navigation rail — every destination on one axis.
 *
 * Presentational: it receives the groups it should show rather than deriving
 * them, so it is tested without mocking any capability fetch. The decision
 * about who sees which row lives in lib/nav-model.ts.
 *
 * `pathname` is an injectable prop rather than read via usePathname() here, so
 * this component stays free of Next runtime mocking in its unit test — the same
 * arrangement the tab strip it replaces used. components/shell-frame.tsx
 * supplies the real value.
 *
 * An affordance, not a control. Every page re-checks its own access.
 */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { IconName, NavGroup } from '@/lib/nav-model'
import {
  BookOpen,
  FileText,
  Toy,
  Printer,
  Building,
  Box,
  Clipboard,
  Child,
  Inbox,
  Shelf,
  Orders,
  User,
  Shield,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from '@/components/icons'

// `typeof BookOpen` rather than a hand-written signature: every icon shares the
// same (props: SVGProps<SVGSVGElement>) shape, so borrowing one keeps the
// registry honest if that primitive ever changes.
const ICONS: Record<IconName, typeof BookOpen> = {
  book: BookOpen,
  toy: Toy,
  printer: Printer,
  building: Building,
  file: FileText,
  box: Box,
  clipboard: Clipboard,
  child: Child,
  inbox: Inbox,
  shelf: Shelf,
  orders: Orders,
  user: User,
  shield: Shield,
}

export type RailProps = {
  groups: NavGroup[]
  pathname: string
  collapsed: boolean
  onToggle: () => void
  /** Closes the mobile drawer after a row is chosen. */
  onNavigate?: () => void
}

export function Rail({ groups, pathname, collapsed, onToggle, onNavigate }: RailProps) {
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    // Hard reload, not router.push: a client navigation can leave the server
    // layout still rendering the signed-in shell until a full refresh.
    window.location.href = '/'
  }

  return (
    <div className="flex h-full flex-col bg-brand-deep text-brand-soft">
      <div className="flex items-center gap-2 px-3 py-4">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 rounded-field px-1 py-1 font-bold text-white"
        >
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10"
          >
            <BookOpen className="h-5 w-5" />
          </span>
          {!collapsed && <span className="truncate">SPLAT Connect</span>}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="ml-auto hidden shrink-0 rounded-field p-2 text-brand-soft transition-colors hover:bg-white/10 lg:block"
        >
          {collapsed ? (
            <ChevronsRight className="h-5 w-5" />
          ) : (
            <ChevronsLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Only this band scrolls, so the footer below stays pinned once the
          fourteen rows exceed a short viewport. margin-top:auto would not:
          past the fold there is no slack left to distribute. */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {groups.map((group) => (
          <div key={group.heading} className="mb-1">
            {collapsed ? (
              <div aria-hidden="true" className="mx-3 my-2 border-t border-white/15" />
            ) : (
              <p className="px-3 pb-1 pt-4 text-xs font-bold uppercase tracking-wider text-brand-soft/60">
                {group.heading}
              </p>
            )}
            <ul>
              {group.rows.map((row) => {
                // Exact match, not startsWith: /dashboard prefixes every other
                // row in its group.
                const active = pathname === row.href
                const IconComponent = ICONS[row.icon]
                return (
                  <li key={row.href}>
                    <Link
                      href={row.href as never}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? row.label : undefined}
                      className={`flex items-center gap-3 rounded-field px-3 py-2 text-sm font-semibold transition-colors ${
                        active
                          ? 'bg-white/15 text-white'
                          : 'text-brand-soft hover:bg-white/10 hover:text-white'
                      } ${row.soon ? 'opacity-60' : ''}`}
                    >
                      <IconComponent className="h-5 w-5 shrink-0" />
                      {!collapsed && <span className="truncate">{row.label}</span>}
                      {!collapsed && row.soon && (
                        <span className="ml-auto shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-soft/80">
                          Soon
                        </span>
                      )}
                      {/* Collapsed, the chip is gone but the row is still
                          unbuilt — keep that in the accessible name. */}
                      {collapsed && row.soon && <span className="sr-only">Soon</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/15 p-2">
        <button
          type="button"
          onClick={signOut}
          title={collapsed ? 'Sign out' : undefined}
          className="flex w-full items-center gap-3 rounded-field px-3 py-2 text-sm font-semibold text-brand-soft transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {collapsed ? <span className="sr-only">Sign out</span> : <span>Sign out</span>}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/web && pnpm exec vitest run tests/unit/components/rail.test.tsx`
Expected: PASS — 7 tests

If `createClient` fails under jsdom, add this mock at the top of the test file
(above the `Rail` import), matching how `tests/unit/components/nav.test.tsx`
handles the same dependency:

```tsx
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}))
```

- [ ] **Step 6: Commit**

```bash
git add packages/web/components/icons.tsx packages/web/components/rail.tsx \
        packages/web/tests/unit/components/rail.test.tsx
git commit -m "feat(web): navigation rail component

Presentational, with pathname injected rather than read from the Next
runtime, so the unit test needs no router mocking. Only the nav band
scrolls — margin-top:auto would unpin sign out once fourteen rows pass
the fold. Icons are new paths on the existing no-dependency primitive.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The shell, wired into the layout

The task that makes the rail real. It cannot be split: a half-wired shell
leaves the app with two navigations or none.

**Files:**
- Create: `packages/web/components/shell-frame.tsx`
- Create: `packages/web/components/app-shell.tsx`
- Modify: `packages/web/app/layout.tsx`
- Modify: `packages/web/middleware.ts`
- Modify: `packages/web/app/globals.css`
- Delete: `packages/web/app/dashboard/layout.tsx`
- Delete: `packages/web/components/dashboard-tabs.tsx`
- Delete: `packages/web/components/dashboard-nav.tsx`
- Delete: `packages/web/tests/unit/components/dashboard-tabs.test.tsx`

**Interfaces:**
- Consumes: `Rail` and `RailProps` from `@/components/rail`; `buildNav` from `@/lib/nav-model`; `getCapabilities` from `@/lib/capabilities`
- Produces:
  - `ShellFrame({ groups, collapsed, children }: { groups: NavGroup[]; collapsed: boolean; children: React.ReactNode })` — `'use client'`
  - `AppShell({ children }: { children: React.ReactNode })` — async server component; returns `null` when there are no capabilities

- [ ] **Step 1: Add the shell CSS**

Append to `packages/web/app/globals.css`:

```css
/*
  Rail width as a custom property rather than a swapped utility class: <main>
  reacts through margin-inline-start: var(--rail-w) without either element
  knowing the other's state, so collapsing animates one value.
*/
@layer components {
  .shell {
    --rail-w: 15rem;
  }

  .shell[data-collapsed='true'] {
    --rail-w: 4.5rem;
  }

  .shell-rail {
    position: fixed;
    inset-block: 0;
    inset-inline-start: 0;
    z-index: 40;
    width: var(--rail-w);
    transition: width 200ms var(--ease-out-quart);
  }

  .shell-main {
    min-height: 100vh;
    transition: margin-inline-start 200ms var(--ease-out-quart);
  }

  @media (min-width: 1024px) {
    .shell-main {
      margin-inline-start: var(--rail-w);
    }
  }

  /* The drawer is a native <dialog>: showModal() supplies the focus trap,
     Escape-to-close and inert background rather than hand-building them. */
  .shell-drawer {
    margin: 0;
    margin-inline-end: auto;
    height: 100dvh;
    max-height: 100dvh;
    width: 15rem;
    max-width: 85vw;
    border: 0;
    padding: 0;
    background: transparent;
  }

  .shell-drawer::backdrop {
    background: rgb(10 53 80 / 0.5);
  }
}
```

- [ ] **Step 2: Write the client frame**

Create `packages/web/components/shell-frame.tsx`:

```tsx
/**
 * Owns the two pieces of shell state the server cannot: whether the desktop
 * rail is collapsed, and whether the mobile drawer is open.
 *
 * The collapsed flag arrives as a prop read from a cookie on the server, so the
 * first paint is already correct. Reading it from localStorage in an effect
 * would render expanded and then snap — the class of bug fixed on mobile in
 * 11d1bb1 ("stop the contributor-terms gate flashing").
 */
'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Rail } from '@/components/rail'
import { Menu } from '@/components/icons'
import type { NavGroup } from '@/lib/nav-model'

export const RAIL_COOKIE = 'rail-collapsed'

export function ShellFrame({
  groups,
  collapsed: initialCollapsed,
  children,
}: {
  groups: NavGroup[]
  collapsed: boolean
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef<HTMLDialogElement>(null)
  // Null outside an App Router context (the unit tests render this directly).
  const pathname = usePathname() ?? ''

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    // One year. Written here rather than on the server so the rail moves on
    // click instead of waiting for a round trip.
    document.cookie = `${RAIL_COOKIE}=${next ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`
  }

  useEffect(() => {
    const dialog = drawerRef.current
    if (!dialog) return
    if (drawerOpen && !dialog.open) dialog.showModal()
    if (!drawerOpen && dialog.open) dialog.close()
  }, [drawerOpen])

  return (
    <div className="shell" data-collapsed={collapsed ? 'true' : 'false'}>
      {/* Desktop rail. Hidden below lg, where the drawer takes over. */}
      <div className="shell-rail hidden lg:block">
        <Rail groups={groups} pathname={pathname} collapsed={collapsed} onToggle={toggle} />
      </div>

      <dialog
        ref={drawerRef}
        className="shell-drawer lg:hidden"
        aria-label="Navigation"
        onClose={() => setDrawerOpen(false)}
        // The backdrop is part of the dialog's box, so a click lands here when
        // it misses the rail.
        onClick={(e) => {
          if (e.target === drawerRef.current) setDrawerOpen(false)
        }}
      >
        <div className="h-full">
          <Rail
            groups={groups}
            pathname={pathname}
            collapsed={false}
            onToggle={() => setDrawerOpen(false)}
            onNavigate={() => setDrawerOpen(false)}
          />
        </div>
      </dialog>

      <div className="shell-main">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="rounded-field p-2 text-ink transition-colors hover:bg-sunken"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-bold text-ink">SPLAT Connect</span>
        </header>

        {/* Fluid, not max-w-6xl mx-auto: centring a fixed width inside the
            space left after the rail pushes content visibly off-centre.
            Width caps belong on the surfaces that benefit (forms, prose). */}
        <main className="w-full px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write the server shell**

Create `packages/web/components/app-shell.tsx`:

```tsx
/**
 * The signed-in app shell. Renders nothing for a signed-out visitor, who keeps
 * the top bar (components/nav.tsx) instead.
 *
 * getCapabilities() is wrapped in React cache(), so calling it here and again
 * inside a page costs one round of fetches.
 *
 * ponytail: every signed-in page now pays for /api/child-profile and
 * /api/organizations/mine, and the rail reads neither isParent nor the org
 * bodies — only ledOrgs.length. If it measures, add a narrower
 * getNavCapabilities() that fetches just what the rail branches on.
 */
import { cookies } from 'next/headers'
import { getCapabilities } from '@/lib/capabilities'
import { buildNav } from '@/lib/nav-model'
import { ShellFrame, RAIL_COOKIE } from '@/components/shell-frame'

export async function AppShell({ children }: { children: React.ReactNode }) {
  const caps = await getCapabilities()
  if (!caps) return null

  const store = await cookies()
  const collapsed = store.get(RAIL_COOKIE)?.value === '1'

  return (
    <ShellFrame groups={buildNav(caps)} collapsed={collapsed}>
      {children}
    </ShellFrame>
  )
}
```

- [ ] **Step 4: Publish the pathname from middleware**

The shell must not render on `/login`, `/signup`, `/auth/*` or `/onboarding/*`.
A server layout cannot read the pathname, so middleware sets it as a request
header. Only `/onboarding/*` is truly reachable while signed in — on the others
`getCapabilities()` already returns `null` — but listing all four keeps the rule
in one readable place.

In `packages/web/middleware.ts`, replace the two route arrays at lines 67 and 94
(dropping `/my-tutorials`, which Task 5 turns into a redirect resolved before
middleware runs):

```ts
  const signedInRoutes = ['/upload', '/dashboard', '/organizations']
  const adminRoutes = ['/admin']
```

```ts
  const termsGatedPrefixes = ['/dashboard', '/upload', '/organizations']
```

Then replace the final `return supabaseResponse` (line 120) with:

```ts
  // The root layout decides whether to render the app shell, and a server
  // layout cannot read the pathname. Publishing it as a request header is the
  // smallest way to give it one — no route-group reshuffle of every page.
  supabaseResponse.headers.set('x-pathname', pathname)
  return supabaseResponse
```

Also update the header comment block: line 15 (`- /my-tutorials: signed in`)
should be deleted, and line 21 should read:

```
 * - Contributor terms: /dashboard, /upload, /organizations and
```

- [ ] **Step 5: Branch the root layout**

Replace the body of `packages/web/app/layout.tsx` (lines 24-41) with:

```tsx
/** Routes that must never show the shell. A rail on the contributor-terms
    gate is an escape hatch out of a gate — every link bounces straight back. */
const BARE_PREFIXES = ['/login', '/signup', '/auth', '/onboarding']

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headerList = await headers()
  const pathname = headerList.get('x-pathname') ?? ''
  const bare = BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  const shell = bare ? null : await AppShell({ children })

  return (
    <html lang="en" className={nunito.variable}>
      <body className="min-h-screen font-sans antialiased">
        {shell ?? (
          <>
            <Nav role={await getUserRole()} />
            <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
              {children}
            </main>
          </>
        )}
      </body>
    </html>
  )
}
```

And add to the imports at the top of the file:

```tsx
import { headers } from 'next/headers'
import { AppShell } from '@/components/app-shell'
```

- [ ] **Step 6: Delete the tab strip**

```bash
cd /Users/byronpetselis/Documents/splat-connect
git rm packages/web/app/dashboard/layout.tsx \
       packages/web/components/dashboard-tabs.tsx \
       packages/web/components/dashboard-nav.tsx \
       packages/web/tests/unit/components/dashboard-tabs.test.tsx
```

- [ ] **Step 7: Run typecheck and the unit suite**

Run: `cd packages/web && pnpm typecheck && pnpm test:unit`
Expected: typecheck PASS. Unit suite PASS except `tests/unit/components/nav.test.tsx`
if it asserts on tabs — if it fails, read the failure and update the assertion to
match the signed-out nav, which is the only thing `<Nav>` now serves.

- [ ] **Step 8: Verify the shell renders in a browser**

Run: `pnpm dev:web` (from the repo root), sign in, and confirm:
- the rail is present on `/dashboard` and the old tab strip is gone
- collapsing it and reloading leaves it collapsed with no expand-then-snap flash
- `/onboarding/contributor-terms` renders with no rail
- signed out, `/library` still shows the top bar

- [ ] **Step 9: Commit**

```bash
git add -A packages/web
git commit -m "feat(web): replace the top bar and tab strip with an app shell

Signed-in accounts get one collapsible rail; signed-out visitors keep the
top bar. Collapse state is a cookie read on the server so the first paint
is already correct rather than snapping after an effect.

Middleware publishes x-pathname because a server layout cannot read the
pathname, and the shell must stay off the onboarding gate — a rail there
is an escape hatch out of a gate.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Merge `/my-tutorials` into `/dashboard`

Mostly deletion: `/my-tutorials` is a strict subset of `/dashboard` with about
sixty lines of hand-copied markup between them.

**Files:**
- Modify: `packages/web/app/dashboard/page.tsx`
- Modify: `packages/web/next.config.ts`
- Modify: `packages/web/app/upload/page.tsx:257`
- Modify: `packages/web/app/tutorials/[id]/edit/page.tsx:55,63`
- Modify: `packages/web/tests/unit/pages/dashboard.test.tsx`
- Modify: `packages/web/tests/unit/components/upload-page.test.tsx:348`
- Delete: `packages/web/app/my-tutorials/page.tsx`
- Delete: `packages/web/tests/unit/pages/my-tutorials.test.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: `/dashboard` renders every tutorial (not `.slice(0, 5)`), each row carrying `data-testid="tutorial-row"`

- [ ] **Step 1: Update the dashboard test first**

In `packages/web/tests/unit/pages/dashboard.test.tsx`, delete the two tests that
assert the "View all N tutorials" link (around lines 138 and 151) and add:

```tsx
  // Tests: the merged page lists every tutorial, not the five most recent
  // Chain: /my-tutorials was the full list; merging it in means no truncation
  //        and no link out to a page that no longer exists
  it('lists every tutorial with no view-all link', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(
        Array.from({ length: 6 }, (_, i) => ({ ...baseTutorial, id: String(i), title: `T${i}` }))
      )
    render(await DashboardPage())
    expect(screen.getAllByTestId('tutorial-row')).toHaveLength(6)
    expect(screen.queryByRole('link', { name: /view all/i })).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/web && pnpm exec vitest run tests/unit/pages/dashboard.test.tsx`
Expected: FAIL — `getAllByTestId('tutorial-row')` finds 0 elements (the dashboard
rows carry no test id) and only 5 rows render.

- [ ] **Step 3: Merge the page**

In `packages/web/app/dashboard/page.tsx`:

Delete line 64:
```tsx
  const recentTutorials = tutorials.slice(0, 5)
```

Replace both `recentTutorials` references (lines 98 and 116) with `tutorials`.

Change the heading on line 75 from `Dashboard` to `My tutorials`:
```tsx
        <h1 className="text-2xl font-bold text-ink">My tutorials</h1>
```

Change the section heading on line 96 from `Recent tutorials` to:
```tsx
      <h2 className="mb-3 text-lg font-bold text-ink">Your tutorials</h2>
```

Add the test id to the row `<div>` at line 117-120:
```tsx
            <div
              key={t.id}
              data-testid="tutorial-row"
              className="card flex flex-wrap items-center justify-between gap-4 p-4"
            >
```

Delete the "View all" block entirely (lines 144-154, the comment and the
conditional `<Link>`).

**Leave the `+ New tutorial` button at line 76-78 exactly as it is.** Upload is
an action, not a location, so it stays on the page rather than moving to the
rail — `canAuthor` is true for parents who will never use it, and a rail CTA
would follow them onto Child profile. Zero diff on that line is intentional.

Update the file's header comment: replace the `- app/my-tutorials: Full list of
tutorials` line in the Related files block with a note that this page absorbed it:

```
 * This page absorbed /my-tutorials in the app-shell work: that route was a
 * strict subset of this one, so it is now a permanent redirect here
 * (next.config.ts) rather than sixty lines of duplicated markup.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/web && pnpm exec vitest run tests/unit/pages/dashboard.test.tsx`
Expected: PASS

- [ ] **Step 5: Add the redirect and delete the old route**

In `packages/web/next.config.ts`, add to the `nextConfig` object (after `typedRoutes`):

```ts
  // Runs before middleware, so /my-tutorials never reaches the route table.
  // Permanent: the page merged into /dashboard, it did not move temporarily.
  async redirects() {
    return [{ source: '/my-tutorials', destination: '/dashboard', permanent: true }]
  },
```

Then:

```bash
cd /Users/byronpetselis/Documents/splat-connect
git rm packages/web/app/my-tutorials/page.tsx \
       packages/web/tests/unit/pages/my-tutorials.test.tsx
```

- [ ] **Step 6: Repoint the three code references**

`packages/web/app/upload/page.tsx` line 257:
```tsx
      window.location.href = '/dashboard'
```
and update the header comment on line 21 to say `redirect to /dashboard`.

`packages/web/app/tutorials/[id]/edit/page.tsx` lines 55 and 63 — both become:
```tsx
    revalidatePath('/dashboard')
```

`packages/web/tests/unit/components/upload-page.test.tsx` line 348:
```tsx
      expect(window.location.href).toBe('/dashboard')
```
and its comment on line 333.

- [ ] **Step 7: Delete the e2e test for the feature being removed**

`packages/web/tests/e2e/contributor/dashboard.spec.ts` contains
`test('the View all link appears past five tutorials', ...)`, which asserts a
link to `/my-tutorials` that this task deletes. The behaviour is gone, not
moved, so the test goes with it — delete the whole `test(...)` block (it seeds
six tutorials, signs in, and asserts the link's `href`).

The two stat assertions above it (`stat-pending`, `stat-approved`,
`stat-rejected`) stay: the stat strip survives the merge unchanged.

- [ ] **Step 8: Run typecheck and the full unit suite**

Run: `cd packages/web && pnpm typecheck && pnpm test:unit`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add -A packages/web
git commit -m "refactor(web): merge /my-tutorials into /dashboard

/my-tutorials was a strict subset — same fetch, same type, byte-identical
row markup and empty state. The merge drops the slice(0,5) and the view-all
link and deletes the route, leaving a permanent redirect. Rows keep the
tutorial-row test id so existing e2e assertions survive.

Upload's post-submit redirect and the edit page's revalidatePath calls
follow the route.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: End-to-end coverage

**Files:**
- Delete: `packages/web/tests/e2e/dashboard/tabs.spec.ts`
- Create: `packages/web/tests/e2e/dashboard/shell.spec.ts`

**Interfaces:**
- Consumes: helpers from `../helpers` — `signIn, createContributor, createParent, createTutorial, createOrgWithLeader, seedBackingRequest, acceptTerms, deleteOrg, deleteUser, uniqueTitle`

- [ ] **Step 1: Port the existing spec**

```bash
cd /Users/byronpetselis/Documents/splat-connect
git mv packages/web/tests/e2e/dashboard/tabs.spec.ts \
       packages/web/tests/e2e/dashboard/shell.spec.ts
```

In the new file, apply these label and assertion changes:

- Test 1 title → `'a contributor sees no Organisation group'`. Replace the four
  tab assertions with:
  ```ts
    await expect(page.getByRole('link', { name: 'My tutorials', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Child profile', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible()
    await expect(page.getByText('Organisation', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Review queue', exact: true })).toHaveCount(0)
  ```
- Test 2 title → `'a leader sees the Organisation group, and the queue merges across two organisations with no picker'`.
  Replace the four tab assertions with a check for the group and its row, and
  change the click target:
  ```ts
    await expect(page.getByRole('link', { name: 'My tutorials', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Review queue', exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Review queue', exact: true }).click()
    await expect(page).toHaveURL('/dashboard/organisation')
  ```
  **Keep the two `titleA` / `titleB` assertions and the `combobox` count assertion
  exactly as they are.** They are what pins the merged-queue decision; a
  single-organisation test would pass either way.
- Test 3: change the click target from `'Organisation'` to `'Review queue'`.
- Test 6: change `await page.waitForURL('**/my-tutorials')` to
  `await page.waitForURL('**/dashboard')`.
- Update the file's doc comment at lines 19-23 to describe the shell rather than
  the tabs.

- [ ] **Step 2: Add the shell-specific tests**

Append to `packages/web/tests/e2e/dashboard/shell.spec.ts`:

```ts
test('the collapsed rail survives a reload without flashing open', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    const shell = page.locator('.shell')
    await expect(shell).toHaveAttribute('data-collapsed', 'false')

    await page.getByRole('button', { name: 'Collapse navigation' }).click()
    await expect(shell).toHaveAttribute('data-collapsed', 'true')

    // Chain: the cookie is read on the server, so the very first paint after a
    //        reload is already collapsed. A localStorage read in an effect
    //        would render expanded and snap.
    await page.reload()
    await expect(shell).toHaveAttribute('data-collapsed', 'true')

    // Survives a navigation too.
    await page.getByRole('link', { name: 'Profile', exact: true }).click()
    await expect(page).toHaveURL('/dashboard/profile')
    await expect(shell).toHaveAttribute('data-collapsed', 'true')
  } finally {
    await deleteUser(contributor.id)
  }
})

test('the rail opens as a drawer on a narrow viewport', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    const drawer = page.locator('dialog.shell-drawer')
    await expect(drawer).toBeHidden()

    await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(drawer).toBeVisible()

    await drawer.getByRole('link', { name: 'Child profile', exact: true }).click()
    await expect(page).toHaveURL('/dashboard/child')
    await expect(drawer).toBeHidden()
  } finally {
    await deleteUser(contributor.id)
  }
})

test('/my-tutorials redirects to the merged list', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const title = uniqueTitle('Merged List')
  await createTutorial(contributor.id, { title, status: 'pending' })

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.goto('/my-tutorials')
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByTestId('tutorial-row').filter({ hasText: title })).toBeVisible()
  } finally {
    await deleteUser(contributor.id)
  }
})

test('a placeholder route explains the feature instead of 404ing', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    await page.getByRole('link', { name: /Toy library/ }).click()
    await expect(page).toHaveURL('/toy-library')
    await expect(page.getByText('Toy Library is coming soon.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Browse tutorials' })).toBeVisible()
  } finally {
    await deleteUser(contributor.id)
  }
})

// Chain: a rail on the terms gate offers links middleware bounces straight
//        back, which is an escape hatch out of a gate.
test('the onboarding gate renders without the rail', async ({ page }) => {
  const contributor = await createContributor()

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/onboarding\/contributor-terms/)
    await expect(page.locator('.shell-rail')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Review queue' })).toHaveCount(0)
  } finally {
    await deleteUser(contributor.id)
  }
})
```

- [ ] **Step 3: Run the spec**

Start the E2E stack, then:

Run: `cd packages/web && pnpm exec playwright test tests/e2e/dashboard/shell.spec.ts`
Expected: PASS — 11 tests

If the suite fails wholesale with gateway errors rather than assertion failures,
check Kong: a `supabase db reset` leaves the auth container healthy but the
gateway returning 502s, and restarting Kong fixes it.

- [ ] **Step 4: Run the routes that reference the old path**

These specs navigate to `/my-tutorials` and should pass unchanged through the
redirect — this step is what proves the redirect actually covers them.

Run:
```bash
cd packages/web && pnpm exec playwright test \
  tests/e2e/contributor/my-tutorials.spec.ts \
  tests/e2e/contributor/upload-flow.spec.ts \
  tests/e2e/contributor/org-backing.spec.ts \
  tests/e2e/contributor/dashboard.spec.ts \
  tests/e2e/auth/route-protection.spec.ts
```
Two known failures to fix, both already identified — do not treat either as a
surprise regression:

- `upload-flow.spec.ts:45` waits for `**/my-tutorials` after submit. Upload now
  redirects to `/dashboard`; change the line to
  `await page.waitForURL('**/dashboard')`.
- `dashboard.spec.ts` — its "View all link" test should already be deleted by
  Task 5 Step 7. If it is still present, delete it now.

The remaining three specs navigate with `page.goto('/my-tutorials')` and pass
unchanged through the redirect. `route-protection.spec.ts` also passes: signed
out, `/my-tutorials` → `/dashboard` → middleware → `/login`, and it asserts the
final URL.

- [ ] **Step 5: Run the full suite**

Run: `cd packages/web && pnpm test:e2e`
Expected: PASS. Note that the `-- <name>` filter argument does not work on this
script; it always runs everything.

- [ ] **Step 6: Commit**

```bash
git add -A packages/web/tests
git commit -m "test(web): cover the app shell end to end

Ports the tab spec to the rail and adds the five assertions the shell
introduces: collapse survives a reload without flashing, the drawer opens
on a narrow viewport, /my-tutorials redirects, a placeholder renders, and
the onboarding gate has no rail.

Keeps the two-organisation merged-queue assertion untouched — it is what
pins that decision, and a single-org test would pass either way.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Refresh the knowledge graph

**Files:** `graphify-out/` (generated)

- [ ] **Step 1: Update the graph**

Run: `cd /Users/byronpetselis/Documents/splat-connect && graphify update .`
Expected: completes with no API cost (AST-only)

- [ ] **Step 2: Commit**

```bash
git add graphify-out
git commit -m "chore: refresh knowledge graph after the app shell work

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Verification Checklist

Run after all tasks:

- [ ] `cd packages/web && pnpm typecheck` — clean
- [ ] `cd packages/web && pnpm lint` — clean
- [ ] `cd packages/web && pnpm test:unit` — all pass
- [ ] `cd packages/web && pnpm test:e2e` — all pass
- [ ] `grep -rn "my-tutorials" packages/web/app packages/web/components packages/web/lib` returns only the `next.config.ts` redirect
- [ ] `grep -rn "dashboard-tabs\|dashboard-nav" packages/web` returns nothing
- [ ] Signed out, `/library` shows the top bar and no rail
- [ ] Signed in, every page shows the rail and no top bar
- [ ] A leader sees the Organisation group; a plain contributor does not
- [ ] `/onboarding/contributor-terms` has no rail
