# Auth Entry Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everyone signs in through the same door, that door says what it is, and everyone lands somewhere that works for them.

**Architecture:** No new routes, no new components, no API change. `/login` and `/signup` keep their paths and their forms; what changes is where the entry point points, where login sends people afterwards, and copy that still describes an approval flow removed on Jul 23.

**Tech Stack:** Next.js 16 App Router + React 19, Supabase auth (browser client), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-29-auth-entry-flow-design.md`

**Depends on:** `2026-07-29-shared-account-foundation.md` must be complete and merged. Task 1 below sends parents to `/dashboard`, which only works once `lib/auth.ts` stops treating them as logged out.

## Global Constraints

- No API change, no migration, no new route in this sub-project.
- Preserve the full-page navigation at `login/page.tsx:60-64`. Its comment records why: `router.refresh()` is not awaitable, so `router.push()` fired before the layout re-rendered and the nav showed the logged-out state. Collapsing the branches must not turn this back into a client navigation.
- The signup form keeps submitting `{ data: { name } }` exactly as it does now. The role written at signup is provenance; do not add a role field.
- These exact strings must not appear on any surface when this sub-project is done: `Request contributor access`, `Request access`, `Request received`, `Already have access`, `Want to contribute?`.
- The `/login` submit button keeps its accessible name `Sign in`. The E2E helper `signIn()` in `packages/web/tests/e2e/helpers.ts:275` targets `getByRole('button', { name: 'Sign in' })`. The new nav control is a *link* with the same name, so `getByRole('button', …)` still disambiguates — do not make the nav control a `<button>`.
- Use `127.0.0.1`, not `localhost`, for Supabase URLs locally. Do not run Playwright with an Android emulator running.
- Every commit message ends with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## Commands

| Purpose | Command |
|---|---|
| Web unit tests | `cd packages/web && pnpm test:unit` |
| Web E2E | `cd packages/web && pnpm test:e2e` |
| Typecheck | `pnpm typecheck` |

## File Structure

| File | Responsibility |
|---|---|
| `packages/web/tests/e2e/helpers.ts` (modify) | Add a `createParent()` fixture |
| `packages/web/app/login/page.tsx` (modify) | Post-login routing; cross-link copy |
| `packages/web/app/dashboard/page.tsx` (modify) | Remove the contributor-only redirect |
| `packages/web/components/nav.tsx` (modify) | Entry point label and destination; link gating |
| `packages/web/app/signup/page.tsx` (modify) | Copy only |
| `packages/web/app/page.tsx` (modify) | Header comment documents the old flow |
| `packages/web/tests/e2e/auth/entry-flow.spec.ts` (create) | The journeys |
| `packages/web/tests/unit/components/nav.test.tsx` (modify/create) | Entry point rendering |

---

### Task 1: Everyone lands on a dashboard that will have them

**Files:**
- Modify: `packages/web/tests/e2e/helpers.ts`
- Modify: `packages/web/app/login/page.tsx:59-65`
- Modify: `packages/web/app/dashboard/page.tsx:54`
- Test: `packages/web/tests/e2e/auth/entry-flow.spec.ts` (create)

**Interfaces:**
- Produces: `createParent()` in `tests/e2e/helpers.ts`, returning `{ id, email, password, name }` — the same shape as `createContributor()`. Task 2 and the unified-dashboard plan both use it.

**Context for the implementer:** two changes ship together here and neither works alone. `login/page.tsx:63-64` sends anyone who is not a contributor or admin to `/`, and `dashboard/page.tsx:54` (`if (profile!.role !== 'contributor') redirect('/')`) would bounce a parent straight back out even if login sent them. Removing one without the other leaves a redirect loop or a dead end.

- [ ] **Step 1: Add the parent fixture**

In `packages/web/tests/e2e/helpers.ts`, after `createContributor()`, add:

```ts
const PARENT_NAME = 'E2E Parent'

/** Provision a confirmed parent-role account, as the mobile app creates them. */
export async function createParent() {
  const admin = adminClient()
  const email = uniqueEmail('parent')
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: PARENT_NAME },
  })
  if (error || !data.user) throw new Error(`Failed to create parent: ${error?.message}`)

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: data.user.id, role: 'parent', name: PARENT_NAME })
  if (profileError) throw new Error(`Failed to set parent profile: ${profileError.message}`)

  return { id: data.user.id, email, password: PASSWORD, name: PARENT_NAME }
}
```

- [ ] **Step 2: Write the failing test**

Create `packages/web/tests/e2e/auth/entry-flow.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { createContributor, createParent, createAdmin, signIn, adminClient } from '../helpers'

test.describe('post-login destination', () => {
  // Tests: a parent lands on the dashboard rather than the home page.
  // Chain: login sent any non-contributor to '/', and the dashboard bounced any
  //        non-contributor back to '/'. A parent signing in on web had nowhere
  //        to arrive — the case that makes "everyone signs in the same way" true.
  test('a parent lands on the dashboard', async ({ page }) => {
    const parent = await createParent()
    await signIn(page, parent.email, parent.password)

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

    await adminClient().auth.admin.deleteUser(parent.id)
  })

  test('a contributor lands on the dashboard', async ({ page }) => {
    const contributor = await createContributor()
    await signIn(page, contributor.email, contributor.password)

    await expect(page).toHaveURL(/\/dashboard$/)

    await adminClient().auth.admin.deleteUser(contributor.id)
  })

  test('an admin lands on the admin area', async ({ page }) => {
    const admin = await createAdmin()
    await signIn(page, admin.email, admin.password)

    await expect(page).toHaveURL(/\/admin$/)

    await adminClient().auth.admin.deleteUser(admin.id)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd packages/web && pnpm test:e2e -- entry-flow
```

Expected: FAIL on "a parent lands on the dashboard" — the URL is `/`.

- [ ] **Step 4: Collapse the login routing**

In `packages/web/app/login/page.tsx`, replace lines 59-65 with:

```ts
      // Everyone shares one dashboard; only the admin area is separate. The
      // role column no longer decides what a user may do, so it no longer
      // decides where they land.
      window.location.href = profile?.role === 'admin' ? '/admin' : '/dashboard'
```

Keep the `WHY`/`HOW` comment above it untouched — it explains the full reload, which is unchanged.

- [ ] **Step 5: Remove the contributor-only guard on the dashboard**

In `packages/web/app/dashboard/page.tsx`, delete line 54:

```ts
  if (profile!.role !== 'contributor') redirect('/')
```

Check whether `redirect` is still used elsewhere in the file (it is — in the `catch` around the profile fetch), and leave the import alone if so.

Update the file header, which says *"Only accessible to signed-in contributors (role='contributor')"* and *"Requires authenticated user (role='contributor')"*. Both become:

```
 * Accessible to any signed-in account. Capability is derived rather than read
 * from the role column — see lib/capabilities.ts.
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd packages/web && pnpm test:e2e -- entry-flow
```

Expected: PASS, all three.

- [ ] **Step 7: Commit**

```bash
git add packages/web/app/login/page.tsx \
        packages/web/app/dashboard/page.tsx \
        packages/web/tests/e2e/helpers.ts \
        packages/web/tests/e2e/auth/entry-flow.spec.ts
git commit -m "feat(web): land every account on the dashboard

Login sent non-contributors to '/' and the dashboard bounced them back.
A parent signing in on web had nowhere to arrive.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The entry point becomes a sign-in door

**Files:**
- Modify: `packages/web/components/nav.tsx:64-69` and `:113-121`
- Test: `packages/web/tests/unit/components/nav.test.tsx`
- Test: `packages/web/tests/e2e/auth/entry-flow.spec.ts` (append)

**Context for the implementer:** two edits in `nav.tsx`.

The logged-out control at lines 113-121 is a `Link` labelled `Contribute` pointing at `/signup`. It becomes `Sign in` pointing at `/login`. Keep it a `Link` — see the constraint about the E2E selector.

The link gating at lines 67-69 shows Dashboard / Upload / My Tutorials only when `role === 'contributor'`. Once sub-project 1 widened `lib/auth.ts`, a parent gets `'parent'` and would see none of them despite being able to author. Widen to any signed-in user. Sub-project 3 supersedes this by moving these into dashboard tabs; it is deliberately a small interim change, not a redesign.

- [ ] **Step 1: Write the failing unit test**

In `packages/web/tests/unit/components/nav.test.tsx` (create it if absent, following the mocking style of the other files in `tests/unit/components/`):

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Nav } from '@/components/nav'

describe('Nav entry point', () => {
  // Chain: "Contribute" named one of three audiences and pointed at signup.
  //        With one account type behind it, it was wrong for the other two and
  //        wrong about the destination.
  it('offers a sign-in link when logged out', () => {
    render(<Nav role={null} />)
    const link = screen.getByRole('link', { name: 'Sign in' })
    expect(link).toHaveAttribute('href', '/login')
    expect(screen.queryByText('Contribute')).not.toBeInTheDocument()
  })

  it('shows the contributor links to a parent', () => {
    render(<Nav role="parent" />)
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Upload' })).toBeInTheDocument()
  })

  it('shows the admin link only to an admin', () => {
    render(<Nav role="contributor" />)
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })
})
```

Two things to check before writing this:

1. **`nav.tsx`'s export name and props.** Its header documents `role: User role ('admin' | 'contributor' | null for logged-out)`. Match the real signature.
2. **`usePathname()` must be mocked.** `nav.tsx` is a client component that calls `usePathname()` to mark the active link. Without a mock the render throws. Add at the top of the test file:

```tsx
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
```

Check whether `nav.tsx` also calls `useRouter` — its `signOut` handler uses `window.location.href`, so it may not. Include only what it actually imports.

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/web && pnpm test:unit -- nav
```

Expected: FAIL — no link named "Sign in"; "Contribute" is present.

- [ ] **Step 3: Change the entry point**

In `packages/web/components/nav.tsx`, replace the logged-out branch (lines 113-121):

```tsx
          <Link
            href="/login"
            className="btn btn-accent btn-sm order-2 ml-auto shrink-0 sm:order-3 sm:ml-0"
          >
            Sign in
          </Link>
```

- [ ] **Step 4: Widen the link gating**

Replace lines 67-69:

```tsx
    // Any signed-in account, not only role='contributor': since 009 every
    // account may author. Sub-project 3 moves these into dashboard tabs.
    { href: '/dashboard', label: 'Dashboard', show: role !== null },
    { href: '/upload', label: 'Upload', show: role !== null },
    { href: '/my-tutorials', label: 'My Tutorials', show: role !== null },
```

Update the header comment at line 8, which reads `role: User role ('admin' | 'contributor' | null for logged-out)`, to include `'parent'`.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd packages/web && pnpm test:unit -- nav
```

Expected: PASS, all three.

- [ ] **Step 6: Add the E2E journey**

Append to `packages/web/tests/e2e/auth/entry-flow.spec.ts`:

```ts
test.describe('the entry point', () => {
  test('a logged-out visitor is offered sign in, which reaches the login page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('the login page links onward to signup', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: 'Create an account' }).click()
    await expect(page).toHaveURL(/\/signup$/)
  })
})
```

The second test will fail until Task 3 rewrites that link. That is expected — run it after Task 3.

- [ ] **Step 7: Commit**

```bash
git add packages/web/components/nav.tsx \
        packages/web/tests/unit/components/nav.test.tsx \
        packages/web/tests/e2e/auth/entry-flow.spec.ts
git commit -m "feat(web): make the entry point a sign-in door, not a Contribute button

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Retire the approval-flow copy

**Files:**
- Modify: `packages/web/app/signup/page.tsx:42-49`, `:58-61`, `:110`, `:114-119`
- Modify: `packages/web/app/login/page.tsx:110-115`
- Modify: `packages/web/app/page.tsx:1-22` (header comment)
- Test: `packages/web/tests/unit/pages/signup.test.tsx` (create if absent)

**Context for the implementer:** `2026-07-23-remove-account-approval-design.md` removed the approval gate and left the words. The success screen is the clearest case — the heading reads *"Request received"* directly above *"Your account has been created. You can log in and start uploading tutorials right away."*

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/unit/pages/signup.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SignupPage from '@/app/signup/page'

describe('signup copy', () => {
  // Chain: the approval gate was removed on Jul 23 and the words stayed. This
  //        copy already survived one cleanup it should not have, so it is
  //        asserted directly rather than left to review.
  it('does not describe the account as a request for access', () => {
    render(<SignupPage />)

    expect(screen.queryByText(/Request contributor access/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Request access/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Already have access/i)).not.toBeInTheDocument()
  })

  it('offers to create an account', () => {
    render(<SignupPage />)
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/web && pnpm test:unit -- signup
```

Expected: FAIL — the heading is "Request contributor access".

- [ ] **Step 3: Rewrite the signup copy**

In `packages/web/app/signup/page.tsx`, make exactly these replacements:

| Line | From | To |
|---|---|---|
| 42 | `Request received` | `You're all set` |
| 44-45 | `Your account has been created. You can log in and start uploading tutorials right away.` | `Your account has been created. Sign in to get started.` |
| 58 | `Request contributor access` | `Create your account` |
| 60 | `Create your contributor account to start uploading tutorials.` | `One account for everything — browse, contribute, and manage your child's profile.` |
| 110 | `'Submitting…' : 'Request access'` | `'Creating…' : 'Create account'` |
| 115 | `Already have access?` | `Already have an account?` |

- [ ] **Step 4: Rewrite the login cross-link**

In `packages/web/app/login/page.tsx`, replace lines 110-115:

```tsx
      <p className="mt-4 text-center text-sm text-muted">
        New here?{' '}
        <Link href="/signup" className="font-semibold text-brand-dark hover:underline">
          Create an account
        </Link>
      </p>
```

- [ ] **Step 5: Fix the stale home page header**

`packages/web/app/page.tsx` lines 1-22 document the old flow — *"Logged-out users: Click 'Sign Up' → /signup"* and *"Links to library and signup"*. Update those lines to describe the current flow: the hero links to the library, and the account entry point lives in the nav and goes to `/login`.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd packages/web && pnpm test:unit -- signup
cd packages/web && pnpm test:e2e -- entry-flow
```

Expected: PASS, including the "links onward to signup" case deferred from Task 2.

- [ ] **Step 7: Commit**

```bash
git add packages/web/app/signup/page.tsx \
        packages/web/app/login/page.tsx \
        packages/web/app/page.tsx \
        packages/web/tests/unit/pages/signup.test.tsx
git commit -m "fix(web): drop the request-for-access copy the approval removal left

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Full verification

**Files:** none modified.

- [ ] **Step 1: Prove the retired strings are gone**

```bash
cd packages/web && grep -rn "Request access\|Request received\|Request contributor access\|Already have access\|Want to contribute" app components || echo "clean"
```

Expected: `clean`. A hit is a miss from Task 3 — fix it before continuing.

- [ ] **Step 2: Run every web suite**

```bash
cd packages/web && pnpm test:unit && pnpm test:e2e
cd ../.. && pnpm typecheck
```

Expected: all PASS. Existing E2E specs sign in through `signIn()` and then expect to be on `/dashboard`; a contributor still lands there, so they should be unaffected. If a spec asserted a landing on `/`, update it to the new destination.

- [ ] **Step 3: Update the knowledge graph**

```bash
graphify update .
```

- [ ] **Step 4: Commit any test updates**

```bash
git add -A
git commit -m "test(web): update journeys that assumed the old landing page

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Skip if the tree is clean.
