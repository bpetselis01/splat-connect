# Signed-in Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the seven public sections reachable from every signed-in page by rendering one persistent header everywhere and demoting the rail to the account section's secondary navigation.

**Architecture:** `app/layout.tsx` today renders *either* the signed-in shell *or* the public chrome, never both, which hides ~25 pages from anyone logged in. That either/or becomes a nesting: header and footer render on every non-bare route, and the rail nests inside them only within the account section. A new `ACCOUNT_NAV` constant makes `/dashboard` and `/admin` a section that `sectionFor()` recognises, so the breadcrumb, the backdrop and the header's active state all work on account pages with no new machinery.

**Tech Stack:** Next.js 16 App Router (React 19, server components), Tailwind v4 via `@theme` in `app/globals.css`, vitest + `@testing-library/react` for unit tests, Playwright for e2e, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-08-21-signed-in-navigation-design.md` — read it first. Its mockup board (`2026-08-21-signed-in-navigation-board.html`, same directory) draws every layout claim; open it in a browser before starting Task 5.

## Global Constraints

- **Run every command from `packages/web`** unless a step says otherwise.
- Unit tests: `pnpm --filter @splat-connect/web test:unit`. Single file: `pnpm --filter @splat-connect/web exec vitest run tests/unit/path/to.test.tsx`.
- Typecheck: `pnpm --filter @splat-connect/web typecheck`. Must pass before every commit.
- **Never remove a label to make a nav item smaller.** Icon-only nav rows are forbidden by the spec (`nav-label-icon`); so is hover-revealed navigation. Collapse responds to viewport width only, never to auth state.
- The seven public section pills render **identically** signed in and signed out. Only the far-right control changes.
- New colour tokens go in the `@theme` block of `app/globals.css`, not as raw hex in components.
- Existing test files carry a `// Tests: / How: / Chain:` comment block above each `it()`. Match that convention in every test you add.
- Commit after each task. Do not squash tasks together.

---

### Task 1: Teach the nav model about the account section

**Files:**
- Modify: `lib/public-nav.ts`
- Test: `tests/unit/lib/public-nav.test.ts`

**Interfaces:**
- Produces: `ACCOUNT_NAV` (`{ href: '/dashboard', label: 'My SPLAT', tone: 'brand' }`), the exported type `NavTarget`, and `sectionFor(pathname): NavTarget | undefined` which now also matches `/dashboard*` and `/admin*`.
- Consumed by: Tasks 4, 5, 6.

`ACCOUNT_NAV` is deliberately **not** a `NavSection`. `NavSection` requires `art: IllustrationKey` and `rank`, and its docstring reserves the seven illustrations as the complete set. More importantly `components/public-footer.tsx` and the homepage launcher both map `PUBLIC_NAV`, so an eighth entry there would advertise the account area to signed-out visitors.

- [ ] **Step 1: Write failing tests**

Add to `tests/unit/lib/public-nav.test.ts`. Extend the existing import line to pull in `ACCOUNT_NAV`.

```ts
describe('the account section', () => {
  // Tests: sectionFor resolves account routes onto ACCOUNT_NAV
  // How:   calls sectionFor with the section root and a child route
  // Chain: the breadcrumb, the backdrop tone and the header's active pill all
  //        read sectionFor, so this one match is what makes all three work on
  //        dashboard pages without any of them learning about accounts
  it('resolves dashboard routes to the account section', () => {
    expect(sectionFor('/dashboard')).toBe(ACCOUNT_NAV)
    expect(sectionFor('/dashboard/toys')).toBe(ACCOUNT_NAV)
    expect(sectionFor('/dashboard/challenges')).toBe(ACCOUNT_NAV)
  })

  // Tests: admin lives inside the account section, not beside it
  // How:   calls sectionFor with the admin root and a nested admin route
  // Chain: admin is reached through a rail row under Account, so admin pages are
  //        inside the account section by construction; this keeps the quiet
  //        header rule a single rule with no special case
  it('resolves admin routes to the account section', () => {
    expect(sectionFor('/admin')).toBe(ACCOUNT_NAV)
    expect(sectionFor('/admin/review')).toBe(ACCOUNT_NAV)
  })

  // Tests: the public tree still wins, including its one explicit-child case
  // How:   checks a public section root and /organizations, which sits under
  //        Impact and shares no prefix with /impact
  // Chain: adding an account match must not disturb the existing child-first
  //        matching order that /organizations depends on
  it('leaves public routes resolving to their public section', () => {
    expect(sectionFor('/learn/switch-types')?.href).toBe('/learn')
    expect(sectionFor('/organizations')?.href).toBe('/impact')
  })

  // Tests: ACCOUNT_NAV stays out of the public tree
  // How:   asserts no PUBLIC_NAV entry carries the account href
  // Chain: public-footer.tsx and the homepage launcher map PUBLIC_NAV, so an
  //        entry here would show the account area to signed-out visitors
  it('is not a public section', () => {
    expect(PUBLIC_NAV.map((s) => s.href)).not.toContain(ACCOUNT_NAV.href)
    expect(PUBLIC_NAV).toHaveLength(7)
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/public-nav.test.ts`

Expected: FAIL — `ACCOUNT_NAV is not defined` / no export named `ACCOUNT_NAV`.

- [ ] **Step 3: Implement**

In `lib/public-nav.ts`, add after the `PUBLIC_NAV` array declaration:

```ts
/**
 * The signed-in account area, as a navigation target.
 *
 * Deliberately NOT a NavSection and NOT a member of PUBLIC_NAV. NavSection
 * requires `art` and `rank`, and the seven illustrations in public/illustrations
 * are the whole set; more to the point, components/public-footer.tsx and the
 * homepage launcher both map PUBLIC_NAV, so an eighth entry there would
 * advertise the account area to people who cannot reach it.
 *
 * It carries exactly the three fields every sectionFor() consumer reads, so the
 * breadcrumb, the backdrop and the top bar treat it as a section for free.
 */
export const ACCOUNT_NAV = {
  href: '/dashboard',
  label: 'My SPLAT',
  tone: 'brand',
} as const satisfies NavTarget

/** The account prefixes that belong to ACCOUNT_NAV. Admin is reached through a
    rail row under Account, so it is inside the account section, not beside it. */
const ACCOUNT_PREFIXES = ['/dashboard', '/admin']
```

Add the `NavTarget` type beside the `NavSection` interface:

```ts
/**
 * The subset of a section that navigation chrome actually reads. Declared so
 * ACCOUNT_NAV can be a sectionFor() result without being a full NavSection.
 */
export type NavTarget = Pick<NavSection, 'href' | 'label' | 'tone'>
```

Then replace `sectionFor` with:

```ts
export function sectionFor(pathname: string): NavTarget | undefined {
  const inside = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  if (ACCOUNT_PREFIXES.some(inside)) return ACCOUNT_NAV
  return (
    PUBLIC_NAV.find((s) => s.children.some((c) => inside(c.href))) ??
    PUBLIC_NAV.find((s) => inside(s.href))
  )
}
```

The account check runs first because `/dashboard` and `/admin` appear nowhere in `PUBLIC_NAV`, so no public match can be shadowed by it.

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/public-nav.test.ts && pnpm --filter @splat-connect/web typecheck`

Expected: PASS, and typecheck clean. If typecheck complains at a `sectionFor` call site reading `.art` or `.children`, that call site should use `PUBLIC_NAV.find()` instead — report it rather than widening `NavTarget`.

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/public-nav.ts packages/web/tests/unit/lib/public-nav.test.ts
git commit -m "feat(web): make the account area a section sectionFor can resolve"
```

---

### Task 2: Delete the rail's Browse group

**Files:**
- Modify: `lib/nav-model.ts`
- Test: `tests/unit/lib/nav-model.test.ts`

**Interfaces:**
- Consumes: `Capabilities` from `@/lib/capabilities` (unchanged).
- Produces: `buildNav(caps, unreadNotifications)` returning groups `Yours`, optionally `Organisation`, then `Account` — no `Browse`.

Those four rows (`/library`, `/toy-library`, `/printing`, `/organizations`) are the header's job once the header is always present. Row count drops 12 → 8, or 9 for an admin, 11 for an org leader.

- [ ] **Step 1: Write failing tests**

Add to `tests/unit/lib/nav-model.test.ts`:

```ts
// Tests: the rail no longer carries public browse destinations
// How:   builds nav for a plain account and asserts no group is headed Browse
//        and no row points at a public catalogue
// Chain: the header renders those four sections on every page now, so keeping
//        them in the rail would be two controls competing at one level
it('drops the Browse group now the header carries it', () => {
  const groups = buildNav(baseCaps, 0)
  expect(groups.map((g) => g.heading)).toEqual(['Yours', 'Account'])
  const hrefs = groups.flatMap((g) => g.rows.map((r) => r.href))
  expect(hrefs).not.toContain('/library')
  expect(hrefs).not.toContain('/toy-library')
  expect(hrefs).not.toContain('/printing')
  expect(hrefs).not.toContain('/organizations')
})

// Tests: every remaining row is an account-owned destination
// How:   asserts each row href sits under /dashboard, /admin or /notifications
// Chain: the rail is now the account section's secondary nav; a row outside it
//        would be navigating out of the section it belongs to
it('keeps only account destinations', () => {
  const rows = buildNav(baseCaps, 0).flatMap((g) => g.rows)
  for (const row of rows) {
    expect(row.href).toMatch(/^\/(dashboard|admin|notifications)/)
  }
})
```

Reuse the existing fixture the file already builds for `Capabilities`; if it is named differently from `baseCaps`, use that name.

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/nav-model.test.ts`

Expected: FAIL — headings come back as `['Browse', 'Yours', 'Account']`.

- [ ] **Step 3: Implement**

In `lib/nav-model.ts`, delete the entire `Browse` group object from the `groups` array literal, leaving `Yours` as the first entry. Update the file docstring, replacing the sentence describing browse rows with:

```
 * Browse rows are gone as of 2026-08-21: the public top bar renders on every
 * page now, signed in or out, so the seven sections are always one click away
 * and duplicating four of them here put two navs at one level.
```

Any existing test asserting a Browse row must be deleted, not adjusted — the group is gone.

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/nav-model.test.ts && pnpm --filter @splat-connect/web typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/nav-model.ts packages/web/tests/unit/lib/nav-model.test.ts
git commit -m "feat(web): drop the rail's Browse group, the header owns those now"
```

---

### Task 3: Strip the rail's second brand lockup and skip link

**Files:**
- Modify: `components/rail.tsx`
- Test: `tests/unit/components/rail.test.tsx`

**Interfaces:**
- Consumes: `NavGroup[]` from Task 2.
- Produces: `Rail` with the same props (`groups`, `pathname`, `collapsed`, `onToggle`, `onNavigate`) and no wordmark.

The header above the rail carries the wordmark. Two lockups on one screen is the "double header" failure properly understood — the pattern is *one* global identity plus a scoped second tier, not two headers.

- [ ] **Step 1: Write failing test**

Add to `tests/unit/components/rail.test.tsx`:

```tsx
// Tests: the rail renders no wordmark of its own
// How:   renders the rail and asserts no element carries the product name
// Chain: the persistent header sits directly above the rail and already shows
//        the lockup; repeating it is what makes two tiers read as two headers
it('shows no brand lockup, the header above it owns that', () => {
  render(<Rail groups={groups} pathname="/dashboard" collapsed={false} onToggle={() => {}} />)
  expect(screen.queryByText(/SPLAT/i)).not.toBeInTheDocument()
})
```

Reuse the `groups` fixture the file already defines.

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/rail.test.tsx`

Expected: FAIL — the lockup `<div>` still renders "SPLAT".

- [ ] **Step 3: Implement**

In `components/rail.tsx`, delete the brand lockup block at the top of the returned tree (the element containing the logo disc and the "SPLAT" text) and the now-unused `Logo` import. Keep the collapse toggle exactly as it is — it is user-initiated and persisted, and the spec keeps it.

- [ ] **Step 4: Run test and verify it passes**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/rail.test.tsx && pnpm --filter @splat-connect/web typecheck`

Expected: PASS. Typecheck catches the unused import if you missed it.

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/rail.tsx packages/web/tests/unit/components/rail.test.tsx
git commit -m "feat(web): remove the rail's wordmark, the header carries it"
```

---

### Task 4: Nest the shell inside the public chrome

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/shell-frame.tsx`
- Test: `tests/unit/app/layout-chrome.test.tsx`

**Interfaces:**
- Produces: `isBare(pathname)` unchanged; a new exported `isAccountRoute(pathname): boolean` from `app/layout.tsx` for the same reason `isBare` is exported — the layout is async and reads `headers()`, so its rules are tested by calling them.

This is the task that fixes the reported bug. Everything before it was preparation; everything after is refinement.

- [ ] **Step 1: Write failing tests**

Add to `tests/unit/app/layout-chrome.test.tsx`:

```ts
// Tests: account routes are chromed like any other page, not bare
// How:   calls isBare with dashboard and admin paths
// Chain: the whole defect was the layout treating signed-in routes as a
//        separate world; they are ordinary chromed routes that additionally
//        nest a rail
it('treats account routes as chromed', () => {
  expect(isBare('/dashboard')).toBe(false)
  expect(isBare('/dashboard/challenges')).toBe(false)
  expect(isBare('/admin/review')).toBe(false)
})

// Tests: the layout can tell an account route from a public one
// How:   calls the exported rule directly
// Chain: this is what decides whether the rail nests and whether the header
//        takes its quiet variant, so it is asserted rather than inferred
it('identifies which routes nest the rail', () => {
  expect(isAccountRoute('/dashboard')).toBe(true)
  expect(isAccountRoute('/dashboard/toys')).toBe(true)
  expect(isAccountRoute('/admin')).toBe(true)
  expect(isAccountRoute('/library')).toBe(false)
  expect(isAccountRoute('/get-involved/submit-an-idea')).toBe(false)
  expect(isAccountRoute('/login')).toBe(false)
})
```

Extend the file's existing import to `import { isBare, isAccountRoute } from '@/app/layout'`.

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/app/layout-chrome.test.tsx`

Expected: FAIL — no export named `isAccountRoute`.

- [ ] **Step 3: Implement**

In `app/layout.tsx`, add beside `isBare`:

```ts
/** Exported for tests, exactly as isBare is: whether this route nests the rail
    and takes the header's quiet variant. */
export function isAccountRoute(pathname: string): boolean {
  return !isBare(pathname) && sectionFor(pathname) === ACCOUNT_NAV
}
```

Import `ACCOUNT_NAV` alongside the existing `sectionFor` import.

Replace the body of `RootLayout` so the chrome nests instead of branching. `AppShell` no longer wraps the page — it wraps only the region below the header:

```tsx
const headerList = await headers()
const pathname = headerList.get('x-pathname') ?? ''
const bare = isBare(pathname)
const account = isAccountRoute(pathname)
const tone = sectionFor(pathname)?.tone ?? 'brand'

if (bare) {
  return (
    <html lang="en" className={`${nunito.variable} ${plexMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  )
}

// The page region: inside the account section the rail wraps it; everywhere
// else it is the backdrop plus main. AppShell returns null for a signed-out
// visitor, so an account URL reached without a session still renders
// (the page itself redirects to /login).
const shell = account ? await AppShell({ children }) : null

return (
  <html lang="en" className={`${nunito.variable} ${plexMono.variable}`}>
    <body className="min-h-screen font-sans antialiased">
      <div className="playroom">
        {/* WCAG 2.4.1 — one skip link for the whole app, since there is now
            exactly one path to <main>. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-field focus:bg-surface focus:px-4 focus:py-2 focus:font-bold focus:text-ink focus:outline focus:outline-2 focus:outline-brand"
        >
          Skip to main content
        </a>
        <Nav role={await getUserRole()} quiet={account} />
        {shell ?? (
          <div className="relative overflow-hidden">
            <PlayroomBackdrop tone={tone} />
            <main id="main" tabIndex={-1} className="public-shell relative py-8 sm:py-10">
              <Breadcrumb pathname={pathname} />
              {children}
            </main>
          </div>
        )}
        <PublicFooter />
      </div>
    </body>
  </html>
)
```

`Nav` gains a `quiet` prop here; add it to `NavProps` as `quiet?: boolean` and leave it unused until Task 6, so this task typechecks on its own.

In `components/shell-frame.tsx`:
- Delete the skip-link anchor — the layout now provides the only one, and two anchors both targeting `#main` is a duplicate tab stop.
- Delete the mobile `<header>` containing the menu button and the "SPLAT Connect" text; the persistent header sits above the shell now and Task 7 puts the drawer trigger there. Keep the `<dialog>` drawer, `drawerRef` and the `useEffect` that syncs them — Task 7 moves the state behind that effect into a context.
- Until Task 7 the drawer has no trigger on mobile. Note this in the commit body; it is closed two tasks later and the rail is still fully reachable on desktop meanwhile.
- Keep `<main id="main" tabIndex={-1}>` inside `.shell-main` — inside the account section this is the single `<main>`.
- Add `<Breadcrumb pathname={pathname} />` as the first child of that `<main>`, since account pages no longer pass through the public branch that rendered it.

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm --filter @splat-connect/web test:unit && pnpm --filter @splat-connect/web typecheck`

Expected: PASS. Run the whole unit suite here, not one file — this task moves chrome that several page tests render through.

- [ ] **Step 5: Verify the actual defect is gone**

```bash
pnpm --filter @splat-connect/web dev
```

Sign in, land on `/dashboard`, and confirm the seven section pills are visible in the header. Click **Get Involved**, then **Submit an idea**, and confirm the form renders while still signed in. This is the bug the whole plan exists to fix; do not proceed until you have seen it work.

- [ ] **Step 6: Commit**

```bash
git add packages/web/app/layout.tsx packages/web/components/shell-frame.tsx packages/web/tests/unit/app/layout-chrome.test.tsx
git commit -m "fix(web): stop signing in from deleting the public navigation

The layout rendered either the shell or the public chrome, never both, so
every page under /learn, /get-involved, /impact and /about had no link
anywhere while logged in. Submitting a toy idea required signing out.

The shell now nests inside the header and footer rather than replacing
them. The mobile drawer has no trigger until the header gains one two
tasks from here."
```

---

### Task 5: Replace the role links with a My SPLAT pill and avatar

**Files:**
- Modify: `components/nav.tsx`
- Modify: `app/layout.tsx:` (the `<Nav />` call site)
- Test: `tests/unit/components/nav.test.tsx`

**Interfaces:**
- Consumes: `ACCOUNT_NAV` (Task 1), `Capabilities` from `@/lib/capabilities`.
- Produces: `Nav` with props `{ caps: Capabilities | null; quiet?: boolean }`. The `role` prop is gone.

`Nav` needs `unreadNotifications` for the badge, and `caps` being non-null already answers "signed in?". `getCapabilities()` is wrapped in React `cache()`, so the layout and `AppShell` both calling it costs one round of fetches. `getUserRole()` keeps its other callers and is not deleted.

- [ ] **Step 1: Write failing tests**

In `tests/unit/components/nav.test.tsx`, add a fixture and tests. Every existing `render(<Nav role={...} />)` in the file becomes `render(<Nav caps={...} />)` — signed-out is `caps={null}`, signed-in is `caps={signedIn}`.

```tsx
const signedIn = {
  profile: { id: 'u1', name: 'Byron Petselis', email: 'b@example.com', role: 'contributor', public_showcase: true, created_at: '' },
  isAdmin: false,
  ledOrgs: [],
  canAuthor: true,
  unreadNotifications: 3,
  exchangeActions: 0,
} as unknown as Capabilities

// Tests: a signed-in visitor still sees all seven public sections
// How:   renders with caps and checks every section label is a link
// Chain: this is the regression the whole change exists to prevent — the
//        sections must not depend on auth state in any way
it('shows every public section to a signed-in visitor', () => {
  render(<Nav caps={signedIn} />)
  for (const label of ['Guides', 'Toy Library', '3D Printing', 'Learn', 'Get Involved', 'Impact', 'About']) {
    expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument()
  }
})

// Tests: the account area has exactly one door, labelled My SPLAT
// How:   renders signed in and checks the link and its href
// Chain: replaces the old Admin and Dashboard role links; the rail behind it
//        carries admin, so a second top-level admin link would be redundant
it('offers one account entry point', () => {
  render(<Nav caps={signedIn} />)
  const account = screen.getByRole('link', { name: /My SPLAT/ })
  expect(account).toHaveAttribute('href', '/dashboard')
  expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
})

// Tests: the unread badge carries the count the rail used to surface
// How:   renders with unreadNotifications: 3 and reads the accessible name
// Chain: the rail is absent on public routes now, so if the badge did not move
//        to the header an unread notification would be invisible site-wide
it('badges the account pill with unread notifications', () => {
  render(<Nav caps={signedIn} />)
  expect(screen.getByRole('link', { name: /My SPLAT/ })).toHaveAccessibleName(/3 unread/)
})

// Tests: a zero count renders no badge
// How:   renders with unreadNotifications: 0
// Chain: a badge showing 0 is noise, and trains people to ignore the badge
it('shows no badge at zero unread', () => {
  render(<Nav caps={{ ...signedIn, unreadNotifications: 0 }} />)
  expect(screen.getByRole('link', { name: /My SPLAT/ })).not.toHaveAccessibleName(/unread/)
})

// Tests: signed-out still gets a sign-in call to action and no account pill
// How:   renders with caps={null}
// Chain: the header is one component across both states, so the signed-out
//        path has to be asserted from the same component
it('offers sign in and no account pill when signed out', () => {
  render(<Nav caps={null} />)
  expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /My SPLAT/ })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/nav.test.tsx`

Expected: FAIL — `Nav` has no `caps` prop; no My SPLAT link.

- [ ] **Step 3: Implement**

In `components/nav.tsx`:

Change the props:

```tsx
import { ACCOUNT_NAV } from '@/lib/public-nav'
import type { Capabilities } from '@/lib/capabilities'

interface NavProps {
  /** Null when signed out. Non-null is the whole signed-in test. */
  caps: Capabilities | null
  /** Inside the account section the bar keeps every label and drops its weight.
      Wired in Task 6; accepted here so the layout compiles. */
  quiet?: boolean
}

export function Nav({ caps, quiet = false }: NavProps) {
```

Delete the `roleLinks` array and the `.map()` that renders it.

Add a helper above the component:

```tsx
/** Two letters from a display name, for the avatar. Falls back to one. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}
```

Replace the sign-out button / sign-in link block at the end of the bar with:

```tsx
{caps ? (
  <>
    <Link
      href={ACCOUNT_NAV.href}
      aria-current={activeSection?.href === ACCOUNT_NAV.href ? 'page' : undefined}
      className={`nav-pill flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-extrabold ${
        activeSection?.href === ACCOUNT_NAV.href ? 'bg-brand-tint text-brand-deep' : ''
      }`}
    >
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-brand" />
      {ACCOUNT_NAV.label}
      {caps.unreadNotifications > 0 && (
        <>
          <span aria-hidden="true" className="badge bg-apricot text-apricot-deep">
            {caps.unreadNotifications}
          </span>
          {/* The number alone is not self-describing to a screen reader. */}
          <span className="sr-only">{caps.unreadNotifications} unread</span>
        </>
      )}
    </Link>
    <button
      onClick={signOut}
      className="btn btn-quiet btn-sm order-2 ml-auto shrink-0 sm:order-3 sm:ml-0"
    >
      Sign out
    </button>
    <span
      aria-hidden="true"
      title={caps.profile.name}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint text-sm font-black text-mint-deep"
    >
      {initials(caps.profile.name)}
    </span>
  </>
) : (
  <Link href="/login" className="btn btn-accent btn-sm order-2 ml-auto shrink-0 sm:order-3 sm:ml-0">
    Sign in
  </Link>
)}
```

The avatar is `aria-hidden` with a `title`: it is decorative next to a named account link, and announcing initials adds nothing a screen reader user can act on.

In `app/layout.tsx`, change the call site to `<Nav caps={await getCapabilities()} quiet={account} />`, import `getCapabilities` from `@/lib/capabilities`, and drop the `getUserRole` import if nothing else in the file uses it.

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm --filter @splat-connect/web test:unit && pnpm --filter @splat-connect/web typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/nav.tsx packages/web/app/layout.tsx packages/web/tests/unit/components/nav.test.tsx
git commit -m "feat(web): one account door in the header, badged with unread"
```

---

### Task 6: The quiet header treatment

**Files:**
- Modify: `app/globals.css`
- Modify: `components/nav.tsx`
- Test: `tests/unit/components/nav.test.tsx`

**Interfaces:**
- Consumes: `quiet` prop declared in Task 5.
- Produces: no new exports.

Inside the account section the header keeps every label and drops its weight, so the rail below wins on contrast without the header having to disappear. This is the alternative to icon-collapsing, which the spec rejects.

- [ ] **Step 1: Write failing tests**

```tsx
// Tests: the quiet variant keeps every section label readable
// How:   renders with quiet and asserts all seven links are still present
// Chain: the spec rejects icon-only and hover-revealed nav; "quieter" must
//        never become "fewer" or "unlabelled"
it('keeps every label in the quiet variant', () => {
  render(<Nav caps={signedIn} quiet />)
  for (const label of ['Guides', 'Toy Library', '3D Printing', 'Learn', 'Get Involved', 'Impact', 'About']) {
    expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument()
  }
})

// Tests: quiet is a presentation change the bar carries, not a per-link one
// How:   asserts the banner element takes the nav-quiet class
// Chain: keeping it on one container is what stops the two variants drifting
//        into two different sets of markup
it('marks the bar quiet rather than restyling each link', () => {
  const { container } = render(<Nav caps={signedIn} quiet />)
  expect(container.querySelector('header')).toHaveClass('nav-quiet')
})

// Tests: public routes keep the loud bar
// How:   renders without quiet
// Chain: the treatment is scoped to the account section; applying it site-wide
//        would flatten the tone system the public site is built on
it('leaves the public bar at full weight', () => {
  const { container } = render(<Nav caps={signedIn} />)
  expect(container.querySelector('header')).not.toHaveClass('nav-quiet')
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/nav.test.tsx`

Expected: FAIL — no `nav-quiet` class on the header.

- [ ] **Step 3: Implement**

In `app/globals.css`, add to the `@theme` block beside the other surfaces:

```css
  /* The account section's header sits between the white bar and the blue canvas
     so it separates from both the page below it and the white cards on it.
     A receding bar still has to be a surface, not a hole. */
  --color-surface-quiet: #f6fbfd;
```

Then in the same layer as the other `.playroom .nav-pill` rules:

```css
  /* The quiet bar. Everything here is weight, nothing is presence: no label is
     removed, resized past legibility, or hidden behind a hover. The rail below
     is brand-deep at full saturation and wins the contrast comparison on its
     own once the bar stops competing. */
  .playroom .nav-quiet {
    background-color: var(--color-surface-quiet);
  }

  .playroom .nav-quiet .nav-pill {
    background-color: transparent;
    box-shadow: none;
    color: var(--color-muted);
  }

  /* Hover restores full contrast, so a receding control never reads as
     disabled. */
  .playroom .nav-quiet .nav-pill:hover {
    background-color: var(--color-sunken);
    color: var(--color-brand-deep);
    /* No rotate: a bar that is deliberately receding should not also be the
       most playful thing on the page. */
    transform: none;
  }
```

In `components/nav.tsx`, apply the class and the reduced height:

```tsx
<header className={`sticky top-0 z-30 border-b border-line bg-surface ${quiet ? 'nav-quiet' : ''}`}>
  <nav className={`public-shell flex flex-wrap items-center gap-x-3 gap-y-2 ${quiet ? 'py-1.5' : 'py-3'}`}>
```

Inside the section `.map()`, neutralise the tone dot when quiet — the dot only, never the label:

```tsx
<span
  aria-hidden="true"
  className={`h-2 w-2 shrink-0 rounded-full ${quiet ? 'bg-line' : tone.dot} ${
    active && !quiet ? '' : 'opacity-60'
  }`}
/>
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/nav.test.tsx && pnpm --filter @splat-connect/web typecheck`

Expected: PASS.

- [ ] **Step 5: Check it against the board**

Open `docs/superpowers/specs/2026-08-21-signed-in-navigation-board.html`, panel 05. The right-hand frame is the target. Run `pnpm --filter @splat-connect/web dev`, visit `/dashboard`, and compare. The header should recede without any label becoming hard to read.

- [ ] **Step 6: Commit**

```bash
git add packages/web/app/globals.css packages/web/components/nav.tsx packages/web/tests/unit/components/nav.test.tsx
git commit -m "feat(web): quiet the header inside the account section"
```

---

### Task 7: Collapse the header by viewport, and give the drawer its trigger back

**Files:**
- Create: `components/drawer-context.tsx`
- Modify: `components/nav.tsx`
- Modify: `components/shell-frame.tsx`
- Modify: `app/layout.tsx`
- Test: `tests/unit/components/nav.test.tsx`

**Interfaces:**
- Produces: `DrawerProvider` and `useDrawer(): { isOpen: boolean; open: () => void; close: () => void }` from `@/components/drawer-context`.
- `Nav` and `ShellFrame` both consume `useDrawer()`. Neither gains a callback prop.

Collapse responds to **viewport width only**, never to auth state, and it collapses to a **click-driven menu**, never to bare icons or a hover target. Task 4 left the mobile drawer without a trigger; this closes that.

**Why a context and not a prop:** the trigger lives in the header and the drawer lives in the shell, with an async server component between them. The layout builds the shell by calling `await AppShell({ children })` on the server, so it cannot hand a client callback down that path. A client provider wrapping both works, because `Nav` and `ShellFrame` are already `'use client'` and consume the context after hydration — the layout only has to render the provider around them.

- [ ] **Step 1: Write failing tests**

In `tests/unit/components/nav.test.tsx`:

```tsx
// Tests: the menu button is a real button, operated by click
// How:   renders inside a provider, clicks, and asserts the drawer opened
// Chain: hover-revealed navigation does not exist on touch and fails WCAG
//        1.4.13; the control has to be pressable
it('opens the section menu on click', () => {
  function Probe() {
    const { isOpen } = useDrawer()
    return <span data-testid="drawer">{isOpen ? 'open' : 'closed'}</span>
  }
  render(
    <DrawerProvider>
      <Nav caps={signedIn} showMenu />
      <Probe />
    </DrawerProvider>
  )
  expect(screen.getByTestId('drawer')).toHaveTextContent('closed')
  fireEvent.click(screen.getByRole('button', { name: /open navigation/i }))
  expect(screen.getByTestId('drawer')).toHaveTextContent('open')
})

// Tests: collapsing is a viewport decision, not an auth decision
// How:   asserts the seven sections render with and without a session, and
//        that the menu button's visibility is governed by a width class
// Chain: a header that collapses when you sign in is the original defect in
//        miniature — nav must not change by page type or by auth state
it('collapses by viewport, identically signed in and out', () => {
  const out = render(<DrawerProvider><Nav caps={null} showMenu /></DrawerProvider>)
  expect(out.getByRole('button', { name: /open navigation/i })).toHaveClass('lg:hidden')
  out.unmount()
  render(<DrawerProvider><Nav caps={signedIn} showMenu /></DrawerProvider>)
  expect(screen.getByRole('button', { name: /open navigation/i })).toHaveClass('lg:hidden')
})

// Tests: public routes get no menu button, because there is no drawer there
// How:   renders without showMenu
// Chain: a trigger that opens nothing is worse than no trigger; the rail exists
//        only inside the account section
it('shows no menu button outside the account section', () => {
  render(<DrawerProvider><Nav caps={signedIn} /></DrawerProvider>)
  expect(screen.queryByRole('button', { name: /open navigation/i })).not.toBeInTheDocument()
})
```

Import `DrawerProvider` and `useDrawer` from `@/components/drawer-context` at the top of the test file.

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/nav.test.tsx`

Expected: FAIL — cannot resolve `@/components/drawer-context`.

- [ ] **Step 3: Implement the context**

Create `components/drawer-context.tsx`:

```tsx
/**
 * Whether the mobile navigation drawer is open.
 *
 * A context rather than a prop because the trigger and the drawer sit on
 * opposite sides of an async server component: app/layout.tsx builds the shell
 * by calling `await AppShell({ children })` on the server, and a server render
 * cannot be handed a client callback. Both consumers are already 'use client',
 * so a provider wrapped around them is the one channel that reaches both.
 *
 * Defaults to a closed, inert drawer so a component rendered outside the
 * provider — a unit test, or the header on a public route — does not throw.
 */
'use client'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type Drawer = { isOpen: boolean; open: () => void; close: () => void }

const noop = () => {}
const DrawerContext = createContext<Drawer>({ isOpen: false, open: noop, close: noop })

export function useDrawer(): Drawer {
  return useContext(DrawerContext)
}

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close])
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>
}
```

- [ ] **Step 4: Implement the trigger**

In `components/nav.tsx`, add `showMenu?: boolean` to `NavProps` and render the trigger as the first child of the `<nav>`, before the wordmark:

```tsx
const drawer = useDrawer()
```

```tsx
{showMenu && (
  <button
    type="button"
    onClick={drawer.open}
    aria-label="Open navigation"
    className="rounded-field p-2 text-ink transition-colors hover:bg-sunken lg:hidden"
  >
    <Menu className="h-6 w-6" />
  </button>
)}
```

Import `Menu` from `@/components/icons` and `useDrawer` from `@/components/drawer-context`. `lg:hidden` is the entire collapse rule: a width query and nothing else. The section pills already wrap to their own row below `sm` via the existing `order-3 w-full` classes — leave that alone.

- [ ] **Step 5: Implement the drawer side**

In `components/shell-frame.tsx`, delete the local `const [drawerOpen, setDrawerOpen] = useState(false)` and read the context instead:

```tsx
const { isOpen: drawerOpen, close: closeDrawer } = useDrawer()
```

Replace every `setDrawerOpen(false)` with `closeDrawer()`. The existing `useEffect` that calls `showModal()` / `close()` in response to `drawerOpen` stays exactly as it is — it is what keeps the native `<dialog>` in step with React state, and it now reacts to the context instead of local state.

- [ ] **Step 6: Wire the provider into the layout**

In `app/layout.tsx`, wrap the header and the page region together. Only account routes need it, but wrapping unconditionally is one branch fewer and the provider costs nothing when no consumer opens it:

```tsx
<div className="playroom">
  <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-field focus:bg-surface focus:px-4 focus:py-2 focus:font-bold focus:text-ink focus:outline focus:outline-2 focus:outline-brand">
    Skip to main content
  </a>
  <DrawerProvider>
    <Nav caps={caps} quiet={account} showMenu={account} />
    {shell ?? (
      <div className="relative overflow-hidden">
        <PlayroomBackdrop tone={tone} />
        <main id="main" tabIndex={-1} className="public-shell relative py-8 sm:py-10">
          <Breadcrumb pathname={pathname} />
          {children}
        </main>
      </div>
    )}
  </DrawerProvider>
  <PublicFooter />
</div>
```

`caps` is already in scope from Task 5. Import `DrawerProvider` from `@/components/drawer-context`.

- [ ] **Step 7: Run tests and verify they pass**

Run: `pnpm --filter @splat-connect/web test:unit && pnpm --filter @splat-connect/web typecheck`

Expected: PASS.

- [ ] **Step 8: Verify on a narrow viewport**

Run the dev server, open dev tools at 390px wide, signed in, on `/dashboard`. The menu button opens the rail drawer; choosing a row closes it. On `/library` the button is **absent** — there is no rail there, and a trigger that opens nothing is worse than no trigger.

- [ ] **Step 9: Commit**

```bash
git add packages/web/components/drawer-context.tsx packages/web/components/nav.tsx packages/web/components/shell-frame.tsx packages/web/app/layout.tsx packages/web/tests/unit/components/nav.test.tsx
git commit -m "feat(web): restore the mobile drawer trigger, collapsing by width only"
```

---

### Task 8: Move the tutorial list to /dashboard/tutorials

**Files:**
- Create: `app/dashboard/tutorials/page.tsx`
- Delete: `app/dashboard/page.tsx` (recreated in Task 9)
- Modify: `lib/nav-model.ts`
- Rename: `tests/unit/pages/dashboard.test.tsx` → `tests/unit/pages/dashboard-tutorials.test.tsx`

**Interfaces:**
- Produces: the tutorial list at `/dashboard/tutorials`; the `Yours` group's first row now points there.

`/dashboard` is the post-login landing that redirects and Playwright `waitForURL` calls depend on. They still land somewhere valid — Task 9's hub — so no redirect breaks. Do Tasks 8 and 9 back to back; between them `/dashboard` 404s.

- [ ] **Step 1: Move the page and its test**

```bash
cd packages/web
mkdir -p app/dashboard/tutorials
git mv app/dashboard/page.tsx app/dashboard/tutorials/page.tsx
git mv tests/unit/pages/dashboard.test.tsx tests/unit/pages/dashboard-tutorials.test.tsx
```

- [ ] **Step 2: Update the references**

In `tests/unit/pages/dashboard-tutorials.test.tsx`, change the import path from `@/app/dashboard/page` to `@/app/dashboard/tutorials/page`.

In `lib/nav-model.ts`, change the first `Yours` row:

```ts
        { href: '/dashboard/tutorials', label: 'My tutorials', icon: 'file' },
```

and delete the comment above it about the route staying `/dashboard` — it no longer does. Replace with:

```ts
        // Moved off /dashboard on 2026-08-21: that URL is the account section's
        // hub now, the way /learn and /get-involved are hubs for theirs.
```

- [ ] **Step 3: Run tests and verify they pass**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/pages/dashboard-tutorials.test.tsx tests/unit/lib/nav-model.test.ts && pnpm --filter @splat-connect/web typecheck`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A packages/web/app/dashboard packages/web/lib/nav-model.ts packages/web/tests/unit/pages
git commit -m "refactor(web): move the tutorial list to /dashboard/tutorials

/dashboard becomes the account section's hub in the next commit; between
these two commits it 404s."
```

---

### Task 9: Build the account hub at /dashboard

**Files:**
- Create: `app/dashboard/page.tsx`
- Test: `tests/unit/pages/dashboard-hub.test.tsx`

**Interfaces:**
- Consumes: `getCapabilities()`, `buildNav()` (Task 2), `HubGrid` from `@/components/hub-grid`.
- Produces: the account hub. Nothing depends on it.

`HubGrid` takes `NavItem[]` (`href`, `label`, `state`, `blurb`). `blurb` is an ordinary string, so the summary line can be computed per tile — this is why the hub needs no new grid component.

- [ ] **Step 1: Write failing tests**

Create `tests/unit/pages/dashboard-hub.test.tsx`, mirroring the mocking preamble in `tests/unit/pages/dashboard-challenges.test.tsx`.

```tsx
// Tests: the hub offers a tile for every rail destination
// How:   renders the page with a plain account and checks each label appears
// Chain: the hub is the account section's landing page the way /get-involved is
//        its section's; a destination missing here is reachable only from the
//        rail, which is absent on public routes
it('renders a tile per account destination', async () => {
  const ui = await DashboardHub()
  render(ui)
  for (const label of ['My tutorials', 'My toys', 'Exchanges', 'Design challenges', 'Child profiles', 'Notifications', 'Profile']) {
    expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument()
  }
})

// Tests: submitting an idea is reachable from inside the account area
// How:   asserts a link to the public form is on the hub
// Chain: this is the reported defect in its narrowest form — the idea form was
//        unreachable without signing out, and the hub is where a signed-in
//        author looks first
it('links to the idea form', async () => {
  const ui = await DashboardHub()
  render(ui)
  expect(screen.getByRole('link', { name: /Submit an idea/ })).toHaveAttribute(
    'href',
    '/get-involved/submit-an-idea'
  )
})

// Tests: tiles carry live counts, not static prose
// How:   stubs capabilities with two exchange actions and reads the blurb
// Chain: a hub of seven identical "go here" cards is a worse table of contents
//        than the rail it duplicates; the counts are what make it worth a page
it('summarises what is waiting on you', async () => {
  caps.current = { ...baseCaps, exchangeActions: 2 }
  const ui = await DashboardHub()
  render(ui)
  expect(screen.getByText(/2 waiting on you/)).toBeInTheDocument()
})

// Tests: a signed-out visitor is sent to login rather than shown an empty hub
// How:   stubs getCapabilities to null and asserts redirect was called
// Chain: every page re-checks its own access; the nav is an affordance, not a
//        control
it('redirects a signed-out visitor', async () => {
  caps.current = null
  await expect(DashboardHub()).rejects.toThrow('NEXT_REDIRECT')
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/pages/dashboard-hub.test.tsx`

Expected: FAIL — `app/dashboard/page.tsx` does not exist.

- [ ] **Step 3: Implement**

Create `app/dashboard/page.tsx`:

```tsx
/**
 * The account section's hub — the same shape as app/get-involved/page.tsx and
 * app/learn/page.tsx, for the same reason: a section's landing page lists what
 * is inside it, with a sentence per destination that a menu never had room for.
 *
 * It is not a duplicate of the rail. The rail says where you can go; this says
 * what is waiting for you there, which is why every blurb is computed rather
 * than written.
 *
 * Related files:
 * - lib/nav-model.ts: the destination list, shared with the rail
 * - components/hub-grid.tsx: the grid, shared with every public hub
 */
import { redirect } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { buildNav } from '@/lib/nav-model'
import { HubGrid } from '@/components/hub-grid'
import { ACCOUNT_NAV } from '@/lib/public-nav'
import type { NavItem } from '@/lib/public-nav'

export const metadata = {
  title: 'My SPLAT — SPLAT Connect',
}

export default async function DashboardHub() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  const counts: Record<string, string> = {
    '/dashboard/exchanges': caps.exchangeActions
      ? `${caps.exchangeActions} waiting on you`
      : 'Toys you have lent, borrowed and handed over.',
    '/notifications': caps.unreadNotifications
      ? `${caps.unreadNotifications} unread`
      : 'Everything SPLAT has told you.',
  }

  const blurbs: Record<string, string> = {
    '/dashboard/tutorials': 'Your adaptation guides, and where each one is in review.',
    '/dashboard/toys': 'Toys you have listed for other families.',
    '/dashboard/challenges': 'Ideas you have submitted, and challenges you have joined.',
    '/dashboard/child': 'What each child can reach, hold and hear.',
    '/dashboard/print-requests': 'Parts you have asked someone to print.',
    '/dashboard/organisation': 'Projects waiting for your organisation to review.',
    '/dashboard/organisation/toys': 'What your organisation has on its shelves.',
    '/dashboard/organisation/orders': 'Print jobs your organisation has taken on.',
    '/dashboard/profile': 'Your name, email and the terms you have accepted.',
    '/admin': 'The review queues and the report inbox.',
  }

  // Built from the same model the rail reads, so a destination cannot exist in
  // one and not the other.
  const items: NavItem[] = buildNav(caps, caps.unreadNotifications)
    .flatMap((g) => g.rows)
    .map((row) => ({
      href: row.href,
      label: row.label,
      state: row.soon ? 'soon' : 'live',
      blurb: counts[row.href] ?? blurbs[row.href] ?? '',
    }))

  // Appended rather than modelled: submitting an idea is a public page, so it is
  // not a rail row, but it is the action a signed-in author most often arrives
  // here to take.
  items.push({
    href: '/get-involved/submit-an-idea',
    label: 'Submit an idea',
    state: 'live',
    blurb: 'Suggest a toy worth adapting, even if you cannot build it yourself.',
  })

  return (
    <div>
      <h1 className="title-hub">{ACCOUNT_NAV.label}</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        Everything that belongs to you — what you have written, what you have lent, and what
        you have asked for.
      </p>
      <div className="mt-10">
        <HubGrid items={items} tone={ACCOUNT_NAV.tone} leadFirst={false} />
      </div>
    </div>
  )
}
```

`leadFirst={false}` because these destinations are peers — no single one is "read this first", and the wide lead card is reserved for hubs that have an argued reading order.

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm --filter @splat-connect/web test:unit && pnpm --filter @splat-connect/web typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/dashboard/page.tsx packages/web/tests/unit/pages/dashboard-hub.test.tsx
git commit -m "feat(web): give the account section a hub, with the idea form on it"
```

---

### Task 10: Prove the defect cannot come back

**Files:**
- Create: `tests/e2e/dashboard/navigation.spec.ts`
- Test: itself

**Interfaces:**
- Consumes: the sign-in helper in `tests/e2e/helpers.ts`. Read it before writing; reuse whatever the `tests/e2e/dashboard` specs already use rather than writing a new login flow.

The unit tests assert each piece. This asserts the property that actually broke: a signed-in person can reach the idea form without signing out.

- [ ] **Step 1: Write the failing-by-construction test**

```ts
import { test, expect } from '@playwright/test'

test.describe('signed-in navigation', () => {
  // The reported defect: reaching /get-involved/submit-an-idea required signing
  // out, navigating, and signing back in. Every step here is a click, and the
  // session must survive all of them.
  test('reaches the idea form from the dashboard without signing out', async ({ page }) => {
    await signIn(page)
    await page.goto('/dashboard')

    await page.getByRole('link', { name: /Get Involved/ }).click()
    await expect(page).toHaveURL(/\/get-involved$/)

    await page.getByRole('link', { name: /Submit an idea/ }).click()
    await expect(page).toHaveURL(/\/get-involved\/submit-an-idea$/)

    // Signed in, so the form renders rather than the sign-in call to action.
    await expect(page.getByRole('button', { name: /submit/i })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0)
  })

  test('keeps every public section reachable on every signed-in page', async ({ page }) => {
    await signIn(page)
    for (const path of ['/dashboard', '/dashboard/challenges', '/library', '/admin']) {
      await page.goto(path)
      for (const label of ['Guides', 'Toy Library', '3D Printing', 'Learn', 'Get Involved', 'Impact', 'About']) {
        await expect(page.getByRole('link', { name: new RegExp(label) }).first()).toBeVisible()
      }
    }
  })

  test('shows the rail only inside the account section', async ({ page }) => {
    await signIn(page)
    await page.goto('/dashboard/toys')
    await expect(page.getByRole('link', { name: 'Design challenges' }).first()).toBeVisible()
    await page.goto('/library')
    await expect(page.locator('.shell-rail')).toHaveCount(0)
  })
})
```

Replace `signIn(page)` with the helper the existing dashboard specs use. The `/admin` case in the second test needs an admin fixture — if the suite has no admin login helper, drop `/admin` from that array and note it in the commit body rather than inventing one.

- [ ] **Step 2: Run and verify**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/dashboard/navigation.spec.ts`

Expected: PASS on the finished implementation. If it fails, the failure is real — do not adjust the test to match the behaviour.

- [ ] **Step 3: Run the whole suite**

Run: `pnpm --filter @splat-connect/web typecheck && pnpm --filter @splat-connect/web lint && pnpm --filter @splat-connect/web test:unit && pnpm --filter @splat-connect/web test:e2e`

Expected: all PASS. Report any failure with its output rather than working around it.

- [ ] **Step 4: Commit**

```bash
git add packages/web/tests/e2e/dashboard/navigation.spec.ts
git commit -m "test(web): assert signing in never hides the public sections"
```

---

### Task 11: Refresh the knowledge graph

**Files:**
- Modify: `graphify-out/` (generated)

- [ ] **Step 1: Update the graph**

Run from the repo root: `graphify update .`

Per `CLAUDE.md` this is AST-only and costs nothing. It keeps `graphify query` accurate for the next session, which matters here because this change moved a page and deleted a nav group.

- [ ] **Step 2: Commit**

```bash
git add graphify-out
git commit -m "chore: refresh the knowledge graph after the navigation change"
```

---

## Notes for the executor

- **Tasks 8 and 9 are a pair.** Between them `/dashboard` 404s. Do not stop for the day in the middle.
- **Task 4 is the one that matters.** Its Step 5 is a manual check, and it is not optional — it is the only step that confirms the reported bug is actually gone before four more tasks build on top.
- **Do not add icons for public sections.** If a task seems to want one, re-read the spec's Decisions table; icon-only nav is rejected there with reasons.
- **`getUserRole()` stays.** Task 5 stops the layout using it; other callers keep it.
