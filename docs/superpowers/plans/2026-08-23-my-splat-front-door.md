# My SPLAT Front Door Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope the account-section header to `/dashboard` ("My SPLAT") only, scope the rail to every other account page, and add a floating "Back to My SPLAT" dock so there's always a way home from a page that has neither.

**Architecture:** One routing predicate (`nestsRail`) decides whether a given account path gets the rail or the header — never both. `app/layout.tsx` uses it to decide whether `AppShell` (the rail) renders; `/dashboard` falls through to the same "no shell" branch a signed-out visitor already takes, so no new layout branch is needed. `lib/public-nav.ts`'s existing `crossesAccountBoundary` (used by every internal link via `components/boundary-link.tsx`) is extended to treat the `/dashboard` ↔ rail-page boundary as a crossing too, alongside the existing public ↔ account one — otherwise the hub grid's own cards and the new dock would go stale on click, the exact bug class this mechanism exists to prevent.

**Tech Stack:** Next.js App Router (React Server Components), Vitest + Testing Library for unit tests, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-08-23-my-splat-front-door-design.md`

## Global Constraints

- No restyling of the header (`components/nav.tsx`) or the rail (`components/rail.tsx`) — only where each renders changes.
- The mobile drawer trigger is explicitly left broken this pass (per the design doc's "Out of scope"). Do not attempt to relocate it. Tests that depend on it are skipped, not fixed, with a comment pointing at the design doc.
- Every internal link that can end up crossing the new `/dashboard` ↔ rail-page boundary must go through `components/boundary-link.tsx` (or an equivalent forced full navigation) — never a plain `next/link` `<Link>`.

---

## Task 1: Extend the account-boundary model with `nestsRail`

**Files:**
- Modify: `packages/web/lib/public-nav.ts:365-367` (add `nestsRail`, rewrite `crossesAccountBoundary`)
- Test: `packages/web/tests/unit/lib/public-nav.test.ts`

**Interfaces:**
- Produces: `nestsRail(pathname: string): boolean`, exported from `@/lib/public-nav`. True for every account-section path except `ACCOUNT_NAV.href` (`/dashboard`) itself.
- `crossesAccountBoundary(pathname: string, href: string): boolean` — signature unchanged, behavior extended (see below).

- [ ] **Step 1: Write the failing tests**

In `packages/web/tests/unit/lib/public-nav.test.ts`, change the import line at the top from:

```ts
import {
  PUBLIC_NAV,
  FOOTER_LEGAL,
  sectionFor,
  SCAFFOLD_KEYS,
  ACCOUNT_NAV,
  crossesAccountBoundary,
} from '@/lib/public-nav'
```

to:

```ts
import {
  PUBLIC_NAV,
  FOOTER_LEGAL,
  sectionFor,
  SCAFFOLD_KEYS,
  ACCOUNT_NAV,
  crossesAccountBoundary,
  nestsRail,
} from '@/lib/public-nav'
```

Then replace the existing `it('is false within the public site and within the account section', ...)` test (inside `describe('crossesAccountBoundary', ...)`) with:

```ts
  it('is false within the public site and between two rail pages', () => {
    expect(crossesAccountBoundary('/learn/switch-types', '/learn/safety-and-cleaning')).toBe(
      false
    )
    expect(crossesAccountBoundary('/learn', '/impact')).toBe(false)
    expect(crossesAccountBoundary('/dashboard/tutorials', '/dashboard/challenges')).toBe(false)
  })

  // Tests: /dashboard itself renders the header, not the rail — every other
  //        account page renders the rail, not the header. Crossing between
  //        them needs a full page load in both directions, or the stale-chrome
  //        bug the account/public boundary was fixed for reopens one level in.
  // How:   both directions between /dashboard and a rail page
  // Chain: components/hub-grid.tsx (My SPLAT's own cards) and the
  //        back-to-My-SPLAT dock both rely on this
  it('is true between /dashboard and any other account page', () => {
    expect(crossesAccountBoundary('/dashboard', '/dashboard/tutorials')).toBe(true)
    expect(crossesAccountBoundary('/dashboard/challenges', '/dashboard')).toBe(true)
    expect(crossesAccountBoundary('/dashboard', '/admin')).toBe(true)
  })
```

(This removes the now-incorrect assertion `crossesAccountBoundary('/dashboard', '/dashboard/tutorials')` → `false`.)

Then add a new describe block at the end of the file:

```ts
describe('nestsRail', () => {
  it('is false for /dashboard itself', () => {
    expect(nestsRail('/dashboard')).toBe(false)
  })

  it('is true for every other account page', () => {
    expect(nestsRail('/dashboard/toys')).toBe(true)
    expect(nestsRail('/admin')).toBe(true)
    expect(nestsRail('/notifications')).toBe(true)
  })

  it('is false outside the account section', () => {
    expect(nestsRail('/library')).toBe(false)
    expect(nestsRail('/login')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

From `packages/web`, run:

```bash
npx vitest run tests/unit/lib/public-nav.test.ts
```

Expected: FAIL — `nestsRail` is not exported, and the two rewritten `crossesAccountBoundary` cases don't match current behavior.

- [ ] **Step 3: Implement `nestsRail` and update `crossesAccountBoundary`**

In `packages/web/lib/public-nav.ts`, replace the existing `crossesAccountBoundary` function (currently the last function in the file) with:

```ts
/**
 * Whether this path renders the rail (components/rail.tsx) rather than the
 * header (components/nav.tsx).
 *
 * True for every account page except the account root itself: `/dashboard`
 * ("My SPLAT") is the one page that keeps the header instead — see
 * docs/superpowers/specs/2026-08-23-my-splat-front-door-design.md. Exported
 * for crossesAccountBoundary below and for app/layout.tsx's shell decision,
 * so the two never drift apart.
 */
export function nestsRail(pathname: string): boolean {
  return sectionFor(pathname) === ACCOUNT_NAV && pathname !== ACCOUNT_NAV.href
}

/**
 * Whether navigating from `pathname` to `href` crosses a boundary the root
 * layout renders differently across, and therefore needs a full page load
 * rather than a soft <Link> transition (see components/boundary-link.tsx and
 * components/nav.tsx's NavLink for why).
 *
 * Two boundaries, not one: crossing between the public site and the account
 * section (as before), or crossing between `/dashboard` and every other
 * account page — since 2026-08-23 those render different chrome (header vs.
 * rail) despite both being "the account section". A link from the My SPLAT
 * hub grid to any of its own cards, or the floating back-to-My-SPLAT dock in
 * the other direction, would otherwise go stale exactly like the original
 * account/public bug.
 *
 * `sectionFor` returns undefined for a pathname/href it cannot resolve to any
 * known section (e.g. /upload, /tutorials/[id]/edit — real pages, just not
 * modelled in either nav). Those are treated as "not the account section"
 * here, the same as any other public/unclassified page.
 */
export function crossesAccountBoundary(pathname: string, href: string): boolean {
  const fromAccount = sectionFor(pathname) === ACCOUNT_NAV
  const toAccount = sectionFor(href) === ACCOUNT_NAV
  if (fromAccount !== toAccount) return true
  if (!fromAccount) return false
  return nestsRail(pathname) !== nestsRail(href)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run tests/unit/lib/public-nav.test.ts
```

Expected: PASS, all tests including the new `nestsRail` describe block.

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/public-nav.ts packages/web/tests/unit/lib/public-nav.test.ts
git commit -m "feat: add nestsRail and extend crossesAccountBoundary for the dashboard/rail split"
```

---

## Task 2: Scope the header and the rail in the root layout

**Files:**
- Modify: `packages/web/app/layout.tsx`
- Test: `packages/web/tests/unit/app/layout-chrome.test.tsx`

**Interfaces:**
- Consumes: `nestsRail(pathname: string): boolean` from Task 1.
- Produces: `app/layout.tsx` gains a local `const caps = await getCapabilities()`, used by both `<Nav>` and (in Task 3) the new dock. `isAccountRoute` keeps its existing name and signature but its docstring is corrected — it decides account-section membership (quiet header, breadcrumb suppression), not rail-nesting.

- [ ] **Step 1: Update the test that mis-describes `isAccountRoute`**

In `packages/web/tests/unit/app/layout-chrome.test.tsx`, replace the existing test:

```ts
  // Tests: the layout can tell an account route from a public one
  // How:   calls the exported rule directly
  // Chain: this is what decides whether the rail nests and whether the header
  //        takes its quiet variant, so it is asserted rather than inferred
  it('identifies which routes nest the rail', () => {
    expect(isAccountRoute('/dashboard')).toBe(true)
    expect(isAccountRoute('/dashboard/toys')).toBe(true)
    expect(isAccountRoute('/admin')).toBe(true)
    expect(isAccountRoute('/notifications')).toBe(true)
    expect(isAccountRoute('/library')).toBe(false)
    expect(isAccountRoute('/get-involved/submit-an-idea')).toBe(false)
    expect(isAccountRoute('/login')).toBe(false)
  })
```

with:

```ts
  // Tests: isAccountRoute marks account-section membership — quiet header,
  //        breadcrumb suppression — not whether the rail renders. My SPLAT
  //        (/dashboard) is in the account section but does not nest the rail;
  //        see tests/unit/lib/public-nav.test.ts's nestsRail suite for that.
  // How:   calls the exported rule directly
  it('identifies account-section routes, including /dashboard itself', () => {
    expect(isAccountRoute('/dashboard')).toBe(true)
    expect(isAccountRoute('/dashboard/toys')).toBe(true)
    expect(isAccountRoute('/admin')).toBe(true)
    expect(isAccountRoute('/notifications')).toBe(true)
    expect(isAccountRoute('/library')).toBe(false)
    expect(isAccountRoute('/get-involved/submit-an-idea')).toBe(false)
    expect(isAccountRoute('/login')).toBe(false)
  })
```

- [ ] **Step 2: Run the test to verify it still passes**

```bash
npx vitest run tests/unit/app/layout-chrome.test.tsx
```

Expected: PASS. `isAccountRoute`'s behavior isn't changing in this task, only its description — this step is a checkpoint before touching `layout.tsx` itself.

- [ ] **Step 3: Update the import and `isAccountRoute` docstring in `layout.tsx`**

In `packages/web/app/layout.tsx`, change the import line:

```ts
import { sectionFor, ACCOUNT_NAV } from '@/lib/public-nav'
```

to:

```ts
import { sectionFor, ACCOUNT_NAV, nestsRail } from '@/lib/public-nav'
```

Replace:

```ts
/** Exported for tests, exactly as isBare is: whether this route nests the rail
    and takes the header's quiet variant. */
export function isAccountRoute(pathname: string): boolean {
  return !isBare(pathname) && sectionFor(pathname) === ACCOUNT_NAV
}
```

with:

```ts
/** Exported for tests, exactly as isBare is: whether this route is inside the
    account section, and therefore takes the header's quiet variant. Does NOT
    mean the rail renders — /dashboard is in the account section but keeps the
    header instead of the rail; see lib/public-nav.ts's nestsRail for that. */
export function isAccountRoute(pathname: string): boolean {
  return !isBare(pathname) && sectionFor(pathname) === ACCOUNT_NAV
}
```

- [ ] **Step 4: Split the shell decision from the header's quiet styling**

In `packages/web/app/layout.tsx`, inside `RootLayout`, leave the routing block
(`headerList`, `pathname`, `bare`, `account`, `tone`) and the whole `if (bare)`
branch untouched — `caps` must NOT be fetched on a bare route (`/login`,
`/signup`, ...), which never uses it and should stay cheap.

After the `bare` early return, replace:

```ts
  const shell = account ? await AppShell({ children, footer: <PublicFooter /> }) : null
```

with:

```ts
  const caps = await getCapabilities()
  // /dashboard ("My SPLAT") is the one account page that keeps the header
  // instead of the rail — see nestsRail's docstring in lib/public-nav.ts.
  const shell = nestsRail(pathname) ? await AppShell({ children, footer: <PublicFooter /> }) : null
```

(`AppShell` calls `getCapabilities()` again internally when `shell` renders —
that's fine and already the existing pattern: `getCapabilities()` is wrapped
in React's `cache()`, so the second call in the same request is deduped, per
`components/app-shell.tsx`'s own docstring.)

Then replace the `<Nav .../>` line:

```ts
            <Nav caps={await getCapabilities()} quiet={shell !== null} showMenu={shell !== null} />
```

with:

```ts
            {/* quiet tracks account-section membership, not shell presence: the
                header renders quiet on /dashboard too, even though /dashboard
                has no shell. showMenu still tracks shell presence — there is
                never a drawer to open on a page with no rail. */}
            <Nav caps={caps} quiet={account} showMenu={shell !== null} />
```

- [ ] **Step 5: Run the full unit suite to verify nothing broke**

```bash
npx vitest run tests/unit
```

Expected: PASS. `nav.test.tsx` is unaffected (`Nav` itself didn't change, only how the layout calls it — the layout can't be rendered in jsdom, so this is verified by inspection plus the e2e specs in Task 4).

- [ ] **Step 6: Commit**

```bash
git add packages/web/app/layout.tsx packages/web/tests/unit/app/layout-chrome.test.tsx
git commit -m "feat: scope the rail shell to nestsRail so /dashboard keeps only the header"
```

---

## Task 3: Build and wire the "Back to My SPLAT" dock

**Files:**
- Create: `packages/web/components/back-to-my-splat-dock.tsx`
- Test: `packages/web/tests/unit/components/back-to-my-splat-dock.test.tsx`
- Modify: `packages/web/app/globals.css` (new `.dock-my-splat` rules)
- Modify: `packages/web/app/layout.tsx` (render the dock)

**Interfaces:**
- Consumes: `caps` (local var from Task 2), `ACCOUNT_NAV` from `@/lib/public-nav`, `BoundaryLink` from `@/components/boundary-link` (existing, unmodified).
- Produces: `BackToMySplatDock({ signedIn: boolean })`, a component with no other props.

- [ ] **Step 1: Write the failing component test**

Create `packages/web/tests/unit/components/back-to-my-splat-dock.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BackToMySplatDock } from '@/components/back-to-my-splat-dock'

const pathname = vi.hoisted(() => ({ current: '/library' }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

describe('BackToMySplatDock', () => {
  beforeEach(() => {
    pathname.current = '/library'
  })

  // Tests: the dock is the way back to My SPLAT from a page with no header
  //        pointing there
  // How:   renders signed in on a public page
  // Chain: docs/superpowers/specs/2026-08-23-my-splat-front-door-design.md
  it('renders a link to /dashboard for a signed-in visitor on a public page', () => {
    render(<BackToMySplatDock signedIn />)
    const link = screen.getByRole('link', { name: /Back to My SPLAT/ })
    expect(link).toHaveAttribute('href', '/dashboard')
  })

  // Tests: the dock also covers rail-only account pages, not just public ones
  // How:   renders signed in on a deep account page
  it('renders on a rail-only account page', () => {
    pathname.current = '/dashboard/toys'
    render(<BackToMySplatDock signedIn />)
    expect(screen.getByRole('link', { name: /Back to My SPLAT/ })).toBeInTheDocument()
  })

  // Tests: My SPLAT itself already has the header, so the dock would be
  //        redundant there
  // How:   renders signed in on /dashboard
  it('renders nothing on /dashboard itself', () => {
    pathname.current = '/dashboard'
    render(<BackToMySplatDock signedIn />)
    expect(screen.queryByRole('link', { name: /Back to My SPLAT/ })).not.toBeInTheDocument()
  })

  // Tests: a signed-out visitor never sees a way "back" to an account they
  //        don't have
  // How:   renders with signedIn={false}
  it('renders nothing for a signed-out visitor', () => {
    render(<BackToMySplatDock signedIn={false} />)
    expect(screen.queryByRole('link', { name: /Back to My SPLAT/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/components/back-to-my-splat-dock.test.tsx
```

Expected: FAIL — `@/components/back-to-my-splat-dock` does not exist.

- [ ] **Step 3: Create the component**

Create `packages/web/components/back-to-my-splat-dock.tsx`:

```tsx
'use client'
/**
 * The way back to My SPLAT from anywhere that has no header pointing there:
 * every public page for a signed-in visitor, and every account page except
 * /dashboard itself (which keeps the header instead of the rail — see
 * docs/superpowers/specs/2026-08-23-my-splat-front-door-design.md).
 *
 * Always a boundary-crossing destination from wherever this renders (it only
 * renders where there is no header, and /dashboard always has one), so
 * BoundaryLink always resolves to a full page load here — see its own
 * docstring for why that matters.
 */
import { usePathname } from 'next/navigation'
import { BoundaryLink } from '@/components/boundary-link'
import { ACCOUNT_NAV } from '@/lib/public-nav'

export function BackToMySplatDock({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() ?? ''
  if (!signedIn || pathname === ACCOUNT_NAV.href) return null

  return (
    <BoundaryLink href={ACCOUNT_NAV.href} className="dock-my-splat">
      <span aria-hidden="true" className="dock-my-splat-dot" />
      Back to {ACCOUNT_NAV.label}
    </BoundaryLink>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/components/back-to-my-splat-dock.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Add the dock's CSS**

In `packages/web/app/globals.css`, immediately after the `.edit-toast` block (ends with the closing `}` before the `/* --- File drop zone --------------------------------------------------- */` comment), insert:

```css
  /* --- Back-to-My-SPLAT dock (components/back-to-my-splat-dock.tsx) ------ */
  .dock-my-splat {
    position: fixed;
    bottom: 1.5rem;
    inset-inline-end: 1.5rem;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.125rem;
    border-radius: 9999px;
    background-color: var(--color-brand-deep);
    color: #ffffff;
    font-size: 0.8125rem;
    font-weight: 800;
    box-shadow: var(--shadow-lift);
    transition: transform 180ms var(--ease-out-quart);
  }

  .dock-my-splat:hover {
    transform: translateY(-2px);
  }

  .dock-my-splat-dot {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 9999px;
    background-color: var(--color-mint);
  }
```

- [ ] **Step 6: Wire the dock into the root layout**

In `packages/web/app/layout.tsx`, add the import alongside the other component imports (near `import { PlayroomBackdrop } from '@/components/playroom-backdrop'`):

```ts
import { BackToMySplatDock } from '@/components/back-to-my-splat-dock'
```

Then, near the end of the returned tree, replace:

```tsx
          {!shell && <PublicFooter />}
        </div>
      </body>
    </html>
  )
}
```

with:

```tsx
          {!shell && <PublicFooter />}
          <BackToMySplatDock signedIn={!!caps} />
        </div>
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Run the full unit suite**

```bash
npx vitest run tests/unit
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/web/components/back-to-my-splat-dock.tsx packages/web/tests/unit/components/back-to-my-splat-dock.test.tsx packages/web/app/globals.css packages/web/app/layout.tsx
git commit -m "feat: add the floating Back to My SPLAT dock"
```

---

## Task 4: Fix e2e specs for the new header/rail scope

**Files:**
- Modify: `packages/web/tests/e2e/dashboard/navigation.spec.ts`
- Modify: `packages/web/tests/e2e/dashboard/shell.spec.ts`
- Modify: `packages/web/tests/e2e/auth/session.spec.ts`
- Modify: `packages/web/tests/e2e/contributor/contributor-terms.spec.ts`
- Modify: `packages/web/tests/e2e/responsive/reflow.spec.ts`

These specs assert the pre-existing rule ("header and rail together on every account page") that Tasks 1-3 intentionally change. Each fix below either retargets a test at a page that still has the property it's checking, or — for the mobile drawer, whose trigger has nowhere left to render — skips it with a comment pointing at the design doc, per this plan's Global Constraints.

**Interfaces:**
- Consumes: the dock's accessible name `Back to My SPLAT` (Task 3) and `.shell-rail` (existing, unmodified selector from `components/rail.tsx`'s CSS).

- [ ] **Step 1: Fix `navigation.spec.ts`'s reachability test**

In `packages/web/tests/e2e/dashboard/navigation.spec.ts`, replace:

```ts
  test('keeps every public section reachable on every signed-in page', async ({ page }) => {
    const admin = await createAdmin()
    await acceptTerms(admin.id)
    await signIn(page, admin.email, admin.password)
    await page.waitForURL('**/admin')

    for (const path of ['/dashboard', '/dashboard/challenges', '/library', '/admin']) {
      await page.goto(path)
      for (const label of PUBLIC_LABELS) {
        await expect(page.getByRole('link', { name: new RegExp(label) }).first()).toBeVisible()
      }
    }
  })
```

with:

```ts
  test('keeps every public section reachable from every signed-in page', async ({ page }) => {
    const admin = await createAdmin()
    await acceptTerms(admin.id)
    await signIn(page, admin.email, admin.password)
    await page.waitForURL('**/admin')

    // /dashboard keeps the header, so every public section is a direct pill
    // click away.
    await page.goto('/dashboard')
    for (const label of PUBLIC_LABELS) {
      await expect(page.getByRole('link', { name: new RegExp(label) }).first()).toBeVisible()
    }

    // Every other account page has no header — the dock is the way back to
    // My SPLAT, and from there every public section is reachable again.
    for (const path of ['/dashboard/challenges', '/admin']) {
      await page.goto(path)
      await expect(page.getByRole('link', { name: /Back to My SPLAT/ })).toBeVisible()
      await page.getByRole('link', { name: /Back to My SPLAT/ }).click()
      await expect(page).toHaveURL(/\/dashboard$/)
      for (const label of PUBLIC_LABELS) {
        await expect(page.getByRole('link', { name: new RegExp(label) }).first()).toBeVisible()
      }
    }

    await page.goto('/library')
    for (const label of PUBLIC_LABELS) {
      await expect(page.getByRole('link', { name: new RegExp(label) }).first()).toBeVisible()
    }
  })
```

- [ ] **Step 2: Fix `navigation.spec.ts`'s footer-crossing test**

In the same file, replace:

```ts
  test('crossing via a footer link swaps the account chrome for public chrome', async ({ page }) => {
    const contributor = await createContributor()
    await acceptTerms(contributor.id)
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')
    await expect(page.locator('.shell-rail')).toHaveCount(1)

    // Scoped to <footer>: "Guides" also appears as a nav pill and (via
    // hub-grid.tsx) a hub tile, and the whole point here is the footer's own
    // link (components/public-footer.tsx), the site's largest unguarded
    // surface before this fix.
    await page.locator('footer').getByRole('link', { name: 'Guides' }).click()
    await expect(page).toHaveURL(/\/library$/)
    await expect(page.locator('.shell-rail')).toHaveCount(0)
    // The destination's own content, not just the URL — app/library's h1.
    await expect(page.getByRole('heading', { name: 'Toy Adaptation Library', level: 1 })).toBeVisible()
  })
```

with:

```ts
  test('crossing via a footer link swaps the account chrome for public chrome', async ({ page }) => {
    const contributor = await createContributor()
    await acceptTerms(contributor.id)
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')
    // /dashboard itself has no rail (it keeps the header instead) — the
    // property under test needs a page that actually has one.
    await page.goto('/dashboard/toys')
    await expect(page.locator('.shell-rail')).toHaveCount(1)

    // Scoped to <footer>: "Guides" also appears as a nav pill and (via
    // hub-grid.tsx) a hub tile, and the whole point here is the footer's own
    // link (components/public-footer.tsx), the site's largest unguarded
    // surface before this fix.
    await page.locator('footer').getByRole('link', { name: 'Guides' }).click()
    await expect(page).toHaveURL(/\/library$/)
    await expect(page.locator('.shell-rail')).toHaveCount(0)
    // The destination's own content, not just the URL — app/library's h1.
    await expect(page.getByRole('heading', { name: 'Toy Adaptation Library', level: 1 })).toBeVisible()
  })
```

- [ ] **Step 3: Run `navigation.spec.ts`**

From `packages/web`:

```bash
npx playwright test tests/e2e/dashboard/navigation.spec.ts
```

Expected: PASS (requires the local Supabase/API test stack this repo's e2e suite already assumes).

- [ ] **Step 4: Fix `shell.spec.ts`'s rail-collapse test**

In `packages/web/tests/e2e/dashboard/shell.spec.ts`, replace:

```ts
test('the collapsed rail survives a reload without flashing open', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    const shell = page.locator('.shell')
```

with:

```ts
test('the collapsed rail survives a reload without flashing open', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')
    // /dashboard itself has no rail (it keeps the header instead) — this
    // test is about the rail specifically, so it needs a page that has one.
    await page.goto('/dashboard/toys')

    const shell = page.locator('.shell')
```

(The rest of that test is unchanged — leave it as-is.)

- [ ] **Step 5: Fix `shell.spec.ts`'s ultrawide-width test**

In the same file, replace:

```ts
test('the main content column stays capped on an ultrawide viewport', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    await page.setViewportSize({ width: 2560, height: 1200 })
```

with:

```ts
test('the main content column stays capped on an ultrawide viewport', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')
    // The cap under test is .shell-main's — /dashboard itself has no shell
    // now, so this needs a page that does.
    await page.goto('/dashboard/toys')

    await page.setViewportSize({ width: 2560, height: 1200 })
```

(The rest of that test is unchanged.)

- [ ] **Step 6: Skip `shell.spec.ts`'s three drawer tests**

In the same file, immediately above `test('the rail opens as a drawer on a narrow viewport', ...)`, insert:

```ts
// Mobile navigation is explicitly out of scope for the My SPLAT front-door
// change (docs/superpowers/specs/2026-08-23-my-splat-front-door-design.md):
// the drawer's trigger lived in the header (components/nav.tsx), which no
// longer renders on any page that has a rail. There is currently no way to
// open the drawer on a narrow viewport — a signed-in user still reaches
// every destination via My SPLAT's hub grid, just not via this drawer. These
// three tests are skipped until mobile nav is redesigned; do not delete them,
// they document exactly what needs to come back.
```

Then change each of the three test declarations from `test(` to `test.skip(`:

```ts
test.skip('the rail opens as a drawer on a narrow viewport', async ({ page }) => {
```

```ts
test.skip('the drawer closes on Escape', async ({ page }) => {
```

```ts
test.skip('the drawer closes on a backdrop click', async ({ page }) => {
```

Leave every test body unchanged.

- [ ] **Step 7: Run `shell.spec.ts`**

```bash
npx playwright test tests/e2e/dashboard/shell.spec.ts
```

Expected: PASS, with the three drawer tests reported as skipped, not failed.

- [ ] **Step 8: Fix the stale comment in `session.spec.ts`**

In `packages/web/tests/e2e/auth/session.spec.ts`, replace:

```ts
  // The account section now shows the header AND the rail together (that's
  // the whole point of this plan), and both carry a Sign out control — scope
  // to the header's, which exists on every signed-in page.
```

with:

```ts
  // /dashboard keeps the header (components/nav.tsx), which carries its own
  // Sign out control distinct from the rail's — scope to the header's
  // (role=banner), the one guaranteed present here.
```

(The test body is unchanged — this test already passes under the new behavior, since `/dashboard` keeps the header.)

- [ ] **Step 9: Fix `contributor-terms.spec.ts`'s post-acceptance test**

In `packages/web/tests/e2e/contributor/contributor-terms.spec.ts`, replace:

```ts
test('accepting on first login lands on the dashboard with the sidebar shell, not the bare layout', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL(/\/onboarding\/contributor-terms/)

  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /I accept/i }).click()

  await page.waitForURL('**/dashboard')
  await expect(page.locator('.shell-rail')).toBeVisible()
  await expect(page.getByRole('link', { name: 'My tutorials', exact: true })).toBeVisible()
})
```

with:

```ts
test('accepting on first login lands on the dashboard with its real header, not the bare layout', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL(/\/onboarding\/contributor-terms/)

  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /I accept/i }).click()

  await page.waitForURL('**/dashboard')
  // /dashboard has no rail (it keeps the header instead) — the bare
  // onboarding layout has neither, so the header's presence is what proves
  // this landed on the real layout.
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'My SPLAT', level: 1 })).toBeVisible()
})
```

- [ ] **Step 10: Run `contributor-terms.spec.ts`**

```bash
npx playwright test tests/e2e/contributor/contributor-terms.spec.ts
```

Expected: PASS.

- [ ] **Step 11: Skip `reflow.spec.ts`'s drawer test**

In `packages/web/tests/e2e/responsive/reflow.spec.ts`, replace:

```ts
// The old always-visible top bar (components/nav.tsx) is gone for signed-in
// users, replaced by a header button that opens the rail as a drawer — see
// components/shell-frame.tsx. This asserts the drawer's own links, not the
// removed top bar.
test('@responsive every rail link stays inside the viewport for a contributor', async ({ page }) => {
```

with:

```ts
// Mobile navigation is explicitly out of scope for the My SPLAT front-door
// change (docs/superpowers/specs/2026-08-23-my-splat-front-door-design.md):
// the drawer's trigger lived in the header (components/nav.tsx), which no
// longer renders on any page that has a rail, so "Open navigation" has
// nothing left to render it. Skipped until mobile nav is redesigned.
test.skip('@responsive every rail link stays inside the viewport for a contributor', async ({ page }) => {
```

(The test body is unchanged.)

- [ ] **Step 12: Run the full e2e suite**

```bash
npx playwright test
```

Expected: PASS, with the four skipped drawer tests reported as skipped, not failed. This is the real end-to-end confirmation that the header/rail split, the dock, and the boundary-crossing fix all work together.

- [ ] **Step 13: Commit**

```bash
git add packages/web/tests/e2e/dashboard/navigation.spec.ts packages/web/tests/e2e/dashboard/shell.spec.ts packages/web/tests/e2e/auth/session.spec.ts packages/web/tests/e2e/contributor/contributor-terms.spec.ts packages/web/tests/e2e/responsive/reflow.spec.ts
git commit -m "test: fix e2e specs for the dashboard header/rail split, skip mobile-drawer coverage"
```
