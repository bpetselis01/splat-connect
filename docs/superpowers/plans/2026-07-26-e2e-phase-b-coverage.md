# E2E Phase B — Coverage Implementation Plan

> **Status: partially complete (2026-07-26). 44 of 74 new tests landed.**
>
> | Suite | Before | Now | Target |
> | --- | ---: | ---: | ---: |
> | web | 18 | **54** | 72 |
> | mobile | 17 | **25** | 38 |
>
> Both suites green at `workers: 4`. Done: Tasks 1-8, 11, 12, 13, and the error/empty
> half of 14.
>
> **Still outstanding:**
> - Task 9 — upload wizard, 9 tests
> - Task 10 — edit page, 8 tests (includes the submit-for-review blocking alert,
>   flagged in the spec as one of the three highest-value additions)
> - Task 14 remainder — mobile library skeleton, detail parts/tools rendering, preview content
> - Task 15 — mobile auth errors (6), profile reverse transitions (3), intro video (1)
> - Task 16 — the phase gate, which cannot be declared met until the above land
>
> **Three cases proved untestable as specified; all three belong in the spec's
> negative space:**
> 1. The public pages' `fetch`-failure path is server-side, so `page.route` cannot
>    intercept it. The fix in Task 2 was verified manually against a dead API
>    (both pages returned 200 with the library falling through to its empty state)
>    but has no E2E test.
> 2. The admin review queue's empty state is unreachable under parallel workers,
>    since neighbouring specs are creating pending tutorials throughout the run.
> 3. `detail-screen.tsx`'s `"Tutorial not found."` branch is unreachable via an
>    unknown id — the API answers 404, `apiClient` raises, and the `error` branch
>    wins. The branch may be dead code.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring both suites to the agreed coverage bar — happy path plus every user-reachable error and edge state — taking web from 18 to 72 tests and mobile from 17 to 38.

**Architecture:** Phase A left every spec self-provisioning and both suites running on parallel workers. This phase only adds tests, with three exceptions: a CI-aware worker count, one production fix to unhandled `fetch` rejections, and a second Playwright project for responsive assertions.

**Tech Stack:** Playwright, `@supabase/supabase-js` service-role fixtures, local Supabase.

**Source spec:** `docs/superpowers/specs/2026-07-26-e2e-coverage-audit-design.md`
**Depends on:** `docs/superpowers/plans/2026-07-26-e2e-phase-a-fixture-normalisation.md` (complete; gate met)

## Global Constraints

- **A spec may only assert on rows it created.** No assertions about total list contents.
- **No spec may reference a seeded row.**
- Every fixture title comes from `uniqueTitle(prefix)`; every fixture account from `createContributor` / `createAdmin` / `createParent`.
- Error states are reached by **request interception** (`page.route(..., r => r.abort())`), never by stopping a server.
- New tests must be **seen to fail before they pass**. A test that passes against unmodified code asserts nothing.
- Web E2E owns ports 3104/3105; mobile owns 3102/3103.
- Existing test names are load-bearing for nothing, but existing *behaviour* assertions must not be weakened when a file is extended.

## File Structure

| File | Action | Tests |
| --- | --- | ---: |
| `packages/web/playwright.config.ts` | Modify — CI-aware workers, responsive project | – |
| `packages/web/app/page.tsx`, `app/library/page.tsx` | Modify — catch `fetch` rejection | – |
| `packages/web/tests/e2e/public/home.spec.ts` | Create | 3 |
| `packages/web/tests/e2e/public/library.spec.ts` | Extend | +2 |
| `packages/web/tests/e2e/public/tutorial-detail.spec.ts` | Extend | +3 |
| `packages/web/tests/e2e/auth/signup.spec.ts` | Extend | +2 |
| `packages/web/tests/e2e/auth/login.spec.ts` | Extend | +1 |
| `packages/web/tests/e2e/auth/session.spec.ts` | Create | 2 |
| `packages/web/tests/e2e/auth/route-protection.spec.ts` | Create | 5 |
| `packages/web/tests/e2e/contributor/dashboard.spec.ts` | Extend | +2 |
| `packages/web/tests/e2e/contributor/my-tutorials.spec.ts` | Create | 3 |
| `packages/web/tests/e2e/contributor/upload-flow.spec.ts` | Extend | +9 |
| `packages/web/tests/e2e/contributor/edit-tutorial.spec.ts` | Extend | +8 |
| `packages/web/tests/e2e/admin/dashboard.spec.ts` | Create | 1 |
| `packages/web/tests/e2e/admin/review-flow.spec.ts` | Extend | +5 |
| `packages/web/tests/e2e/admin/contributors.spec.ts` | Extend | +2 |
| `packages/web/tests/e2e/responsive/reflow.spec.ts` | Create | 6 |
| `packages/mobile/tests/e2e/navigation.spec.ts` | Create | 4 |
| `packages/mobile/tests/e2e/home-library.spec.ts` | Extend | +3 |
| `packages/mobile/tests/e2e/home-detail.spec.ts` | Extend | +4 |
| `packages/mobile/tests/e2e/auth.spec.ts` | Extend | +6 |
| `packages/mobile/tests/e2e/ability-profile.spec.ts` | Extend | +1 |
| `packages/mobile/tests/e2e/everyday-needs.spec.ts` | Extend | +1 |
| `packages/mobile/tests/e2e/customization.spec.ts` | Extend | +1 |
| `packages/mobile/tests/e2e/intro-video.spec.ts` | Create | 1 |

---

### Task 1: Make the worker count CI-aware

`workers: 4` was tuned on a 10-core laptop. GitHub's free `ubuntu-latest` runners are 2-core; four Chromium instances on two cores contend and turn timeouts into flake.

**Files:**
- Modify: `packages/web/playwright.config.ts`
- Modify: `packages/mobile/playwright.config.ts`

- [ ] **Step 1: Change both configs**

```ts
  // 4 locally; 2 on CI, where the free ubuntu-latest runner has 2 cores and
  // oversubscribing turns timeouts into flake.
  workers: process.env.CI ? 2 : 4,
```

- [ ] **Step 2: Verify both suites still pass**

Run: `pnpm --filter @splat-connect/web test:e2e && pnpm --filter @splat-connect/mobile test:e2e`
Expected: 18 passed, 17 passed.

- [ ] **Step 3: Commit**

```bash
git add packages/web/playwright.config.ts packages/mobile/playwright.config.ts
git commit -m "test: halve E2E workers on CI"
```

---

### Task 2: Handle connection failures on the public pages

**Files:**
- Modify: `packages/web/app/page.tsx`
- Modify: `packages/web/app/library/page.tsx`
- Test: `packages/web/tests/e2e/public/home.spec.ts` (created in Task 3)

**Interfaces:**
- Produces: both pages degrade to an empty list instead of throwing, which Task 3's third test and Task 4 rely on.

- [ ] **Step 1: Observe the current failure**

Run, with no API running: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3105/`
Expected: `500`. The `fetch` rejects and nothing catches it.

- [ ] **Step 2: Add a helper in each page and use it**

In `app/page.tsx`, replace the fetch line:

```ts
  // `res.ok ? … : []` handles an HTTP error but not a connection failure —
  // fetch rejects, and an unhandled rejection turns the page into a 500.
  let all: Tutorial[] = []
  try {
    const res = await fetch(`${process.env.API_URL}/api/public/tutorials`, { cache: 'no-store' })
    if (res.ok) all = await res.json()
  } catch {
    all = []
  }
  const featured = all.slice(0, 3)
```

In `app/library/page.tsx`:

```ts
  let tutorials: Tutorial[] = []
  try {
    const res = await fetch(`${process.env.API_URL}/api/public/tutorials`, { cache: 'no-store' })
    if (res.ok) tutorials = await res.json()
  } catch {
    tutorials = []
  }

  return <LibraryClient tutorials={tutorials} />
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @splat-connect/web typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/web/app/page.tsx packages/web/app/library/page.tsx
git commit -m "fix(web): degrade to an empty list when the API is unreachable"
```

---

### Task 3: `public/home.spec.ts`

**Files:**
- Create: `packages/web/tests/e2e/public/home.spec.ts`

- [ ] **Step 1: Write the file**

```ts
import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, uniqueTitle } from '../helpers'

test('the home page renders the hero, a featured card and the three steps', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Home Featured')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Every child deserves to play.' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Browse the library/ })).toBeVisible()

  await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Browse$/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Buy the parts/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Adapt & play/ })).toBeVisible()
})

test('the hero and the recent-tutorials link both reach the library', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /Browse the library/ }).click()
  await expect(page).toHaveURL(/\/library$/)
})

test('an unreachable API degrades to an empty featured list rather than a 500', async ({ page }) => {
  await page.route('**/api/public/tutorials', (route) => route.abort())

  const response = await page.goto('/')

  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Every child deserves to play.' })).toBeVisible()
})
```

Note: the abort intercepts the *browser's* requests. The featured list is fetched server-side, so if this test does not exercise the catch added in Task 2, assert instead that the page renders with no featured cards by pointing `API_URL` at a dead port — record whichever variant you land on in the test's comment.

- [ ] **Step 2: Run and confirm the third test fails against unpatched code**

Temporarily `git stash` Task 2's change, run the spec, confirm the third test fails with a 500, then restore.

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/public/home.spec.ts`
Expected after restoring: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/e2e/public/home.spec.ts
git commit -m "test(web): cover the home page"
```

---

### Task 4: Extend `public/library.spec.ts`

**Files:**
- Modify: `packages/web/tests/e2e/public/library.spec.ts`

- [ ] **Step 1: Append two tests**

```ts
test('search combined with a difficulty filter narrows to the intersection', async ({ page }) => {
  const contributor = await createContributor()
  const easy = uniqueTitle('E2E Combo Easy')
  const hard = uniqueTitle('E2E Combo Hard')
  await createTutorial(contributor.id, { title: easy, status: 'approved', difficulty: 'easy' })
  await createTutorial(contributor.id, { title: hard, status: 'approved', difficulty: 'hard' })

  await page.goto('/library')

  await page.getByPlaceholder('Search by toy name…').fill('E2E Combo')
  await page.getByRole('button', { name: 'easy', exact: true }).click()

  await expect(page.getByText(easy)).toBeVisible()
  await expect(page.getByText(hard)).toHaveCount(0)
})

test('a search with no matches shows the empty state', async ({ page }) => {
  await page.goto('/library')

  await page.getByPlaceholder('Search by toy name…').fill('zzz-no-such-toy-zzz')

  await expect(page.getByText('No tutorials found.')).toBeVisible()
  await expect(page.getByText('Try a shorter search, or set the difficulty filter back to All.')).toBeVisible()
})
```

- [ ] **Step 2: Run**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/public/library.spec.ts`
Expected: 5 passed.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/e2e/public/library.spec.ts
git commit -m "test(web): cover combined library filtering and the empty state"
```

---

### Task 5: Extend `public/tutorial-detail.spec.ts`

**Files:**
- Modify: `packages/web/tests/e2e/public/tutorial-detail.spec.ts`
- Modify: `packages/web/tests/e2e/helpers.ts` — `createTutorial` gains a `withOptionalExtras` flag

**Interfaces:**
- Produces: `createTutorial(contributorId, { …, withOptionalExtras: true })` additionally inserts an optional part and an optional tool.

- [ ] **Step 1: Extend the helper**

In `packages/web/tests/e2e/helpers.ts`, add to the overrides type and after the existing inserts:

```ts
  if (overrides.withOptionalExtras) {
    await admin.from('parts').insert({
      tutorial_id: id,
      name: 'E2E optional part',
      quantity: 1,
      is_optional: true,
      buy_links: [],
    })
    await admin.from('tools').insert({
      tutorial_id: id,
      name: 'E2E optional tool',
      is_optional: true,
      buy_links: [],
    })
  }
```

- [ ] **Step 2: Append three tests**

```ts
test('a tutorial with no photo shows the placeholder', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Detail No Photo')
  const id = await createTutorial(contributor.id, { title, status: 'approved', toyPhotoUrl: null })

  await page.goto(`/tutorials/${id}`)

  await expect(page.getByText('🧸')).toBeVisible()
})

test('optional parts and tools are badged and buy links are labelled', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Detail Optional')
  const id = await createTutorial(contributor.id, { title, status: 'approved', withOptionalExtras: true })

  await page.goto(`/tutorials/${id}`)

  await expect(page.getByText('Optional')).toHaveCount(2)
  await expect(page.getByRole('link', { name: 'Buy E2E part from Jaycar' })).toHaveAttribute(
    'target',
    '_blank'
  )
})

test('a tutorial with no STL files omits the 3D-print section', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Detail No STL')
  const id = await createTutorial(contributor.id, { title, status: 'approved', withStl: false })

  await page.goto(`/tutorials/${id}`)

  await expect(page.getByRole('heading', { name: /Files for 3D printing/ })).toHaveCount(0)
})
```

`createTutorial` also gains `toyPhotoUrl?: string | null` (defaulting to the placeholder) and `withStl?: boolean` (defaulting to `true`).

- [ ] **Step 3: Run**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/public/tutorial-detail.spec.ts`
Expected: 5 passed.

- [ ] **Step 4: Commit**

```bash
git add packages/web/tests/e2e/helpers.ts packages/web/tests/e2e/public/tutorial-detail.spec.ts
git commit -m "test(web): cover tutorial detail edge states"
```

---

### Task 6: Extend `auth/signup.spec.ts` and `auth/login.spec.ts`

**Files:**
- Modify: `packages/web/tests/e2e/auth/signup.spec.ts`
- Modify: `packages/web/tests/e2e/auth/login.spec.ts`

- [ ] **Step 1: Append to `signup.spec.ts`**

```ts
test('an already-registered email shows the error', async ({ page }) => {
  const existing = await createContributor()

  await page.goto('/signup')
  await page.locator('#name').fill('Duplicate Person')
  await page.locator('#email').fill(existing.email)
  await page.locator('#password').fill('Test1234!')
  await page.getByRole('button', { name: 'Request access' }).click()

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Request received' })).toHaveCount(0)
})

test('a password under six characters is rejected', async ({ page }) => {
  await page.goto('/signup')
  await page.locator('#name').fill('Short Password')
  await page.locator('#email').fill(`short-${Date.now()}@web-e2e.local`)
  await page.locator('#password').fill('12345')
  await page.getByRole('button', { name: 'Request access' }).click()

  // minLength blocks submission client-side, so the confirmation never renders.
  await expect(page.getByRole('heading', { name: 'Request received' })).toHaveCount(0)
})
```

- [ ] **Step 2: Append to `login.spec.ts`**

```ts
test('a parent-role account lands on the home page', async ({ page }) => {
  const parent = await createParent()
  await signIn(page, parent.email, parent.password)

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Every child deserves to play.' })).toBeVisible()
})
```

This requires `createParent` in the web helpers, mirroring the mobile one added in Phase A: create the user, upsert `{ role: 'parent', name: 'E2E Parent' }`, return `{ id, email, password }`.

- [ ] **Step 3: Run both**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/auth/`
Expected: 8 passed.

- [ ] **Step 4: Commit**

```bash
git add packages/web/tests/e2e/helpers.ts packages/web/tests/e2e/auth/
git commit -m "test(web): cover signup validation and parent-role login"
```

---

### Task 7: `auth/session.spec.ts` and `auth/route-protection.spec.ts`

The five redirects come straight from `middleware.ts`: `contributorRoutes = ['/upload', '/my-tutorials', '/dashboard']`, `adminRoutes = ['/admin']`.

**Files:**
- Create: `packages/web/tests/e2e/auth/session.spec.ts`
- Create: `packages/web/tests/e2e/auth/route-protection.spec.ts`

- [ ] **Step 1: Write `session.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { signIn, createContributor } from '../helpers'

test('signing out returns to the home page and restores the Contribute link', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL(/\/$/)

  await expect(page.getByRole('link', { name: 'Contribute' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0)
})

test('the email-confirmed page renders its confirmation', async ({ page }) => {
  await page.goto('/auth/confirmed')
  await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible()
})
```

- [ ] **Step 2: Write `route-protection.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { signIn, createContributor, createAdmin, createParent } from '../helpers'

test('an unauthenticated visitor is redirected from /dashboard to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})

test('an unauthenticated visitor is redirected from /upload to /login', async ({ page }) => {
  await page.goto('/upload')
  await expect(page).toHaveURL(/\/login$/)
})

test('an unauthenticated visitor is redirected from /admin to /login', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login$/)
})

test('a contributor is redirected away from /admin', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  await page.goto('/admin')
  await expect(page).toHaveURL(/\/$/)
})

test('an admin is redirected away from the contributor dashboard', async ({ page }) => {
  const admin = await createAdmin()
  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/$/)
})
```

- [ ] **Step 3: Run**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/auth/`
Expected: 15 passed.

- [ ] **Step 4: Commit**

```bash
git add packages/web/tests/e2e/auth/session.spec.ts packages/web/tests/e2e/auth/route-protection.spec.ts
git commit -m "test(web): cover sign-out and every middleware redirect"
```

---

### Task 8: `contributor/dashboard.spec.ts` and `contributor/my-tutorials.spec.ts`

**Files:**
- Modify: `packages/web/tests/e2e/contributor/dashboard.spec.ts`
- Create: `packages/web/tests/e2e/contributor/my-tutorials.spec.ts`

- [ ] **Step 1: Append to `dashboard.spec.ts`**

```ts
test('the status counts match the fixture set', async ({ page }) => {
  const contributor = await createContributor()
  await createTutorial(contributor.id, { title: uniqueTitle('E2E Count P1'), status: 'pending' })
  await createTutorial(contributor.id, { title: uniqueTitle('E2E Count P2'), status: 'pending' })
  await createTutorial(contributor.id, { title: uniqueTitle('E2E Count A1'), status: 'approved' })

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  const pending = page.getByText('Pending', { exact: true }).locator('..')
  const approved = page.getByText('Approved', { exact: true }).locator('..')
  await expect(pending.getByText('2')).toBeVisible()
  await expect(approved.getByText('1')).toBeVisible()
})

test('the View all link appears past five tutorials', async ({ page }) => {
  const contributor = await createContributor()
  for (let i = 0; i < 6; i++) {
    await createTutorial(contributor.id, { title: uniqueTitle(`E2E Overflow ${i}`), status: 'approved' })
  }

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  await expect(page.getByRole('link', { name: /View all 6 tutorials/ })).toHaveAttribute(
    'href',
    '/my-tutorials'
  )
})
```

- [ ] **Step 2: Write `my-tutorials.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { signIn, createContributor, createTutorial, uniqueTitle } from '../helpers'

test('every status renders with its badge and an edit link', async ({ page }) => {
  const contributor = await createContributor()
  const draft = uniqueTitle('E2E Mine Draft')
  const approved = uniqueTitle('E2E Mine Approved')
  const draftId = await createTutorial(contributor.id, { title: draft, status: 'draft' })
  await createTutorial(contributor.id, { title: approved, status: 'approved' })

  await signIn(page, contributor.email, contributor.password)
  await page.goto('/my-tutorials')

  await expect(page.getByText(draft)).toBeVisible()
  await expect(page.getByText('DRAFT', { exact: true })).toBeVisible()
  await expect(page.getByText('APPROVED', { exact: true })).toBeVisible()

  const row = page.locator('div.card', { hasText: draft })
  await expect(row.getByRole('link', { name: 'Edit' })).toHaveAttribute(
    'href',
    `/tutorials/${draftId}/edit`
  )
})

test('a contributor with no tutorials sees the upload prompt', async ({ page }) => {
  const contributor = await createContributor()

  await signIn(page, contributor.email, contributor.password)
  await page.goto('/my-tutorials')

  await expect(page.getByText("You haven't submitted any tutorials yet.")).toBeVisible()
  await expect(page.getByRole('link', { name: 'Upload your first tutorial' })).toHaveAttribute(
    'href',
    '/upload'
  )
})

test('a rejected tutorial shows its rejection note', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Mine Rejected')
  await createTutorial(contributor.id, {
    title,
    status: 'rejected',
    rejection_note: 'The wiring diagram is missing.',
  })

  await signIn(page, contributor.email, contributor.password)
  await page.goto('/my-tutorials')

  await expect(page.getByText('The wiring diagram is missing.')).toBeVisible()
  await expect(page.getByText('REJECTED', { exact: true })).toBeVisible()
})
```

- [ ] **Step 3: Run**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/contributor/dashboard.spec.ts tests/e2e/contributor/my-tutorials.spec.ts`
Expected: 7 passed.

- [ ] **Step 4: Commit**

```bash
git add packages/web/tests/e2e/contributor/dashboard.spec.ts packages/web/tests/e2e/contributor/my-tutorials.spec.ts
git commit -m "test(web): cover dashboard counts and the My Tutorials page"
```

---

### Task 9: Extend `contributor/upload-flow.spec.ts`

Nine tests. Each provisions its own contributor and walks only as far into the wizard as it needs.

**Files:**
- Modify: `packages/web/tests/e2e/contributor/upload-flow.spec.ts`

- [ ] **Step 1: Append the nine tests**

```ts
test('Next stays disabled until the required step-1 fields are filled', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  await page.goto('/upload')

  await expect(page.getByRole('button', { name: 'Next →' })).toBeDisabled()

  await page.getByPlaceholder('e.g. Fisher-Price Piano').fill(uniqueTitle('E2E Gate'))
  await expect(page.getByRole('button', { name: 'Next →' })).toBeDisabled()

  await page.getByRole('button', { name: 'easy', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Next →' })).toBeEnabled()
})

test('Back preserves data already entered', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Back')
  await signIn(page, contributor.email, contributor.password)
  await page.goto('/upload')

  await page.getByPlaceholder('e.g. Fisher-Price Piano').fill(title)
  await page.getByRole('button', { name: 'easy', exact: true }).click()
  await page.getByRole('button', { name: 'Next →' }).click()
  await expect(page.getByText('Step 2 of 6')).toBeVisible()

  await page.getByRole('button', { name: '← Back' }).click()
  await expect(page.getByPlaceholder('e.g. Fisher-Price Piano')).toHaveValue(title)
})

test('a part can be added and removed', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  await page.goto('/upload')

  await page.getByPlaceholder('e.g. Fisher-Price Piano').fill(uniqueTitle('E2E Part CRUD'))
  await page.getByRole('button', { name: 'easy', exact: true }).click()
  await page.getByRole('button', { name: 'Next →' }).click()
  await page.getByRole('button', { name: 'Next →' }).click()

  await page.getByRole('button', { name: '+ Add part' }).click()
  await page.getByPlaceholder('Part name *').fill('Removable part')
  await expect(page.getByPlaceholder('Part name *')).toHaveCount(1)

  await page.getByRole('button', { name: 'Remove part' }).click()
  await expect(page.getByPlaceholder('Part name *')).toHaveCount(0)
})
```

The remaining six follow the same shape and are written during implementation against the live markup: buy-link add/remove, the optional checkbox and quantity persisting, tool add/remove, STL upload and removal, skipping step 5, and the review step reflecting every value. Each must provision its own contributor and use `uniqueTitle`.

- [ ] **Step 2: Run**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/contributor/upload-flow.spec.ts`
Expected: 10 passed.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/e2e/contributor/upload-flow.spec.ts
git commit -m "test(web): cover the upload wizard's gating, navigation and item CRUD"
```

---

### Task 10: Extend `contributor/edit-tutorial.spec.ts`

Eight tests covering details save, the difficulty select refresh, file replacement, parts CRUD, tools CRUD, STL add, the submit-for-review blocking alert, and the rejection callout.

**Files:**
- Modify: `packages/web/tests/e2e/contributor/edit-tutorial.spec.ts`

- [ ] **Step 1: Write the blocking-alert test first — it is the highest-value one**

`getMissingFields` is unit-tested, but nothing checks that the alert actually prevents submission.

```ts
test('submit-for-review is blocked when required fields are missing', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Submit Blocked')
  const id = await createTutorial(contributor.id, { title, status: 'draft', withStl: false })

  await signIn(page, contributor.email, contributor.password)
  await page.goto(`/tutorials/${id}/edit`)

  let alertText = ''
  page.on('dialog', async (dialog) => {
    alertText = dialog.message()
    await dialog.dismiss()
  })

  await page.getByRole('button', { name: 'Submit for review' }).click()
  await expect.poll(() => alertText).toContain('Cannot submit for review')

  await page.reload()
  await expect(page.getByRole('button', { name: 'Submit for review' })).toBeVisible()
})
```

For this to have missing fields, `createTutorial` needs a `withoutPdf` override that leaves `tutorial_pdf_url` null.

- [ ] **Step 2: Write the remaining seven against the live markup**

Details save, difficulty select refresh, photo/PDF replacement, part add-edit-delete, tool add-edit-delete, STL record add, and the rejection callout. Each provisions its own contributor and tutorial.

- [ ] **Step 3: Run**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/contributor/edit-tutorial.spec.ts`
Expected: 10 passed.

- [ ] **Step 4: Commit**

```bash
git add packages/web/tests/e2e/helpers.ts packages/web/tests/e2e/contributor/edit-tutorial.spec.ts
git commit -m "test(web): cover the edit page's CRUD and submission gate"
```

---

### Task 11: Admin coverage

**Files:**
- Create: `packages/web/tests/e2e/admin/dashboard.spec.ts`
- Modify: `packages/web/tests/e2e/admin/review-flow.spec.ts`
- Modify: `packages/web/tests/e2e/admin/contributors.spec.ts`

- [ ] **Step 1: Write `admin/dashboard.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { signIn, createAdmin } from '../helpers'

test('the admin dashboard links to both management pages', async ({ page }) => {
  const admin = await createAdmin()
  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')

  await expect(page.getByRole('link', { name: /Contributors/ })).toHaveAttribute(
    'href',
    '/admin/contributors'
  )
  await expect(page.getByRole('link', { name: /Tutorials awaiting review/ })).toHaveAttribute(
    'href',
    '/admin/review'
  )
})
```

- [ ] **Step 2: Append five to `review-flow.spec.ts`**

Queue listing with submitted dates; the queue empty state; the detail page rendering parts, tools, STL files and the PDF link; rejecting with no note producing the `No feedback was provided.` fallback on the contributor's side; a non-pending id returning 404.

```ts
test('a non-pending tutorial id 404s on the review detail page', async ({ page }) => {
  const contributor = await createContributor()
  const admin = await createAdmin()
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Already Approved'),
    status: 'approved',
  })

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')

  const response = await page.goto(`/admin/review/${id}`)
  expect(response?.status()).toBe(404)
})

test('rejecting without a note shows the contributor the fallback text', async ({ page }) => {
  const contributor = await createContributor()
  const admin = await createAdmin()
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Reject No Note'),
    status: 'pending',
  })

  await signIn(page, admin.email, admin.password)
  await page.goto(`/admin/review/${id}`)
  await page.getByRole('button', { name: '✕ Reject' }).click()
  await page.waitForLoadState('networkidle')

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await expect(page.getByText('No feedback was provided.')).toBeVisible()
})
```

The queue-empty test needs an admin whose queue is genuinely empty, which is impossible under parallel workers creating pending tutorials. Assert instead on the *contributors* empty state, which is per-fixture-controllable, and record the queue-empty case in the spec's negative space.

- [ ] **Step 3: Append two to `contributors.spec.ts`**

The list rendering name, email and joined date for a provisioned contributor.

- [ ] **Step 4: Run**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/admin/`
Expected: 11 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/web/tests/e2e/admin/
git commit -m "test(web): cover the admin dashboard, queue and rejection fallback"
```

---

### Task 12: Responsive project and `responsive/reflow.spec.ts`

**Files:**
- Modify: `packages/web/playwright.config.ts`
- Create: `packages/web/tests/e2e/responsive/reflow.spec.ts`

- [ ] **Step 1: Add a second project**

```ts
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /@responsive/,
    },
    {
      // The app reflows below `sm`: the nav drops its links to a second row, the
      // library grid steps down to two columns, dashboard rows wrap. No other
      // test would notice a nav that clips its own links.
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      grep: /@responsive/,
    },
  ],
```

- [ ] **Step 2: Write the six tagged tests**

```ts
import { test, expect } from '@playwright/test'
import { signIn, createContributor, createTutorial, uniqueTitle } from '../helpers'

test('@responsive the nav keeps every link reachable at phone width', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  for (const name of ['Library', 'Dashboard', 'Upload', 'My Tutorials']) {
    const link = page.getByRole('link', { name, exact: true })
    await expect(link).toBeVisible()
    const box = await link.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  }
})

test('@responsive the hero heading does not overflow', async ({ page }) => {
  await page.goto('/')
  const heading = page.getByRole('heading', { name: 'Every child deserves to play.' })
  const box = await heading.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
})
```

The remaining four — library grid column count, dashboard row wrapping, upload wizard fitting the viewport, detail page stacking to one column — follow the same bounding-box pattern and are written against the live layout.

- [ ] **Step 3: Run both projects**

Run: `pnpm --filter @splat-connect/web test:e2e`
Expected: 72 total across the two projects.

- [ ] **Step 4: Commit**

```bash
git add packages/web/playwright.config.ts packages/web/tests/e2e/responsive/
git commit -m "test(web): assert responsive reflow at phone width"
```

---

### Task 13: Mobile — `navigation.spec.ts`

**Files:**
- Create: `packages/mobile/tests/e2e/navigation.spec.ts`

- [ ] **Step 1: Write the four tests**

```ts
import { test, expect } from '@playwright/test'
import { signUpParent, uniqueParentEmail } from './helpers'

test('a signed-out visitor lands on the profile auth screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Sign In', { exact: true })).toBeVisible()
})

test('a signed-in parent lands on the child-profile home', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())
  await page.goto('/')
  await expect(page.getByText('Customization Metrics')).toBeVisible()
})

test('the tab bar reaches every tab', async ({ page }) => {
  await page.goto('/home')
  for (const tab of ['Profile', 'Scanner', 'Home', 'Toy Library', '3D Print']) {
    await page.getByText(tab, { exact: true }).first().click()
    await expect(page).toHaveURL(/./)
  }
})

test('the three placeholder tabs render their coming-soon content', async ({ page }) => {
  for (const path of ['/scanner', '/toy-library', '/print']) {
    await page.goto(path)
    await expect(page.getByText(/Coming soon/i)).toBeVisible()
  }
})
```

The exact placeholder copy comes from `packages/mobile/components/coming-soon.tsx` and the three screens that use it — read them and match.

- [ ] **Step 2: Run**

Run: `pnpm --filter @splat-connect/mobile test:e2e tests/e2e/navigation.spec.ts`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/tests/e2e/navigation.spec.ts
git commit -m "test(mobile): cover app entry, tab navigation and the placeholder tabs"
```

---

### Task 14: Mobile — error and empty states

**Files:**
- Modify: `packages/mobile/tests/e2e/home-library.spec.ts` (+3)
- Modify: `packages/mobile/tests/e2e/home-detail.spec.ts` (+4)

- [ ] **Step 1: Append the interception tests**

```ts
test('an aborted tutorials request shows the retry message', async ({ page }) => {
  await page.route('**/api/public/tutorials*', (route) => route.abort())

  await page.goto('/home')

  await expect(page.getByText("Couldn't load tutorials. Pull to retry.")).toBeVisible()
})
```

and, for detail:

```ts
test('an aborted detail request shows the retry message', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Mobile Detail Error')
  const id = await createTutorial(contributor.id, { title, status: 'approved' })

  await page.route(`**/api/public/tutorials/${id}`, (route) => route.abort())
  await page.goto(`/home/${id}`)

  await expect(page.getByText("Couldn't load tutorial. Please try again.")).toBeVisible()
})

test('an unknown tutorial id shows the not-found state', async ({ page }) => {
  await page.goto('/home/00000000-0000-0000-0000-000000000000')
  await expect(page.getByText('Tutorial not found.')).toBeVisible()
})
```

Plus the library no-match empty state, the loading skeleton (via a `page.route` delay), the detail page's parts/tools/optional rendering, and the preview screen's content.

**Skeleton disposition, decided in advance:** if the skeleton test proves flaky, delete it rather than retry it. A skeleton regression is cosmetic; a flaky test gating `main` costs more than the bug it catches.

- [ ] **Step 2: Run**

Run: `pnpm --filter @splat-connect/mobile test:e2e tests/e2e/home-library.spec.ts tests/e2e/home-detail.spec.ts`
Expected: 12 passed.

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/tests/e2e/home-library.spec.ts packages/mobile/tests/e2e/home-detail.spec.ts
git commit -m "test(mobile): cover the home error, empty and detail states"
```

---

### Task 15: Mobile — auth errors and profile sub-screen reverse transitions

**Files:**
- Modify: `packages/mobile/tests/e2e/auth.spec.ts` (+6)
- Modify: `packages/mobile/tests/e2e/ability-profile.spec.ts` (+1)
- Modify: `packages/mobile/tests/e2e/everyday-needs.spec.ts` (+1)
- Modify: `packages/mobile/tests/e2e/customization.spec.ts` (+1)
- Create: `packages/mobile/tests/e2e/intro-video.spec.ts` (1)

- [ ] **Step 1: Append the auth error tests**

```ts
test('mismatched passwords are rejected', async ({ page }) => {
  await page.goto('/profile')
  await page.getByText('Create an account').click()
  await page.getByPlaceholder('Name').fill('E2E Mismatch')
  await page.getByPlaceholder('Email').fill(uniqueParentEmail())
  await page.getByPlaceholder('Password', { exact: true }).fill('Test1234!')
  await page.getByPlaceholder('Confirm Password').fill('Different1234!')
  await page.getByText('Sign Up').click()

  await expect(page.getByText('Passwords do not match.')).toBeVisible()
})

test('invalid credentials show an error', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, 'wrong-password')
  await expect(page.getByText(/Invalid login credentials/i)).toBeVisible()
})
```

Plus the duplicate-email case, the unconfirmed-email message, the contributor account view (Open Web Dashboard + Sign Out), and the parent account view.

- [ ] **Step 2: Append the three reverse transitions**

Clearing an ability selection persists; dropping back under the three-challenge cap re-enables the disabled chips; turning the arm-attachment toggle off hides the forearm-length field. Each follows the existing pattern in its file — sign up a parent, open the sub-screen via `openSubScreen`, act, reload, assert.

- [ ] **Step 3: Write `intro-video.spec.ts`**

Assert the video element mounts on the screen that hosts `IntroVideo`.

- [ ] **Step 4: Run**

Run: `pnpm --filter @splat-connect/mobile test:e2e`
Expected: 38 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/tests/e2e/
git commit -m "test(mobile): cover auth errors, reverse transitions and the intro video"
```

---

### Task 16: Phase gate

- [ ] **Step 1: Reset and run everything twice**

```bash
supabase db reset && \
pnpm --filter @splat-connect/web test:e2e && \
pnpm --filter @splat-connect/web test:e2e && \
pnpm --filter @splat-connect/mobile test:e2e && \
pnpm --filter @splat-connect/mobile test:e2e
```

Expected: 72, 72, 38, 38.

- [ ] **Step 2: Record wall-clock for the Phase C plan**

- [ ] **Step 3: Update the spec's negative space**

Add any case that turned out untestable under parallel execution — the admin queue-empty state is already known — to the spec's out-of-scope section, with the reason.
