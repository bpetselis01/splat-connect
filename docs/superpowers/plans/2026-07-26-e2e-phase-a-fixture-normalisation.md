# E2E Phase A — Fixture Normalisation Implementation Plan

> **Status: complete (2026-07-26).** Gate met — from a fresh `supabase db reset`,
> both suites passed twice consecutively at `workers: 4` with no reset in between:
> web 18/18 then 18/18, mobile 17/17 then 17/17.
>
> Wall-clock for the Phase B plan to size against: web 33.7s serial → 19.2s
> parallel; mobile 2.9m serial → 53.9s parallel. The web gain is small because
> 18 tests over 9 files leave workers idle — it should scale with Phase B's 54
> additional tests.
>
> One deviation from the plan as written: Task 12 Step 1's audit found all six
> remaining mobile specs already self-provisioning via `uniqueParentEmail` or
> `createContributor`, so no extra conversions were needed. Task 6's library
> filter locators kept the existing `exact: true`, which the plan had dropped.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every E2E spec provision its own fixtures so both suites can run with `fullyParallel: true, workers: 4` and pass repeatedly without a `supabase db reset` in between.

**Architecture:** Both packages already have a `tests/e2e/helpers.ts` exposing service-role fixture factories, and seven of the fifteen specs already use them correctly — they are the reference implementation. This phase extends those helpers, converts the eight specs that still read or mutate seeded rows, then flips parallel execution on.

**Tech Stack:** Playwright, `@supabase/supabase-js` service-role client, local Supabase on `localhost:54321`.

**Source spec:** `docs/superpowers/specs/2026-07-26-e2e-coverage-audit-design.md`

## Global Constraints

- **A spec may only assert on rows it created.** Assertions about total list contents are forbidden — they are false the moment a neighbouring worker's fixture lands.
- **No spec may reference a seeded row.** Not an account, not a tutorial, not an id.
- **Teardown is best-effort.** CI boots a fresh Supabase per job. `deleteUser` exists so repeated local runs do not accumulate accounts. **No assertion may depend on teardown having run.**
- **Every generated fixture name must be unique per invocation**, including within the same millisecond — four parallel workers make `Date.now()` alone a collision.
- Local Supabase keys are the well-known non-secret dev values already in both `playwright.config.ts` files. Do not introduce new ones.
- Web E2E owns ports 3104/3105; mobile E2E owns 3102/3103. Do not change them.
- **Phase gate:** both suites pass **twice consecutively** from a fresh `supabase db reset` at `workers: 4`. Passing once proves nothing — a spec that consumes global state passes its first run.

## File Structure

| File | Action |
| --- | --- |
| `packages/web/tests/e2e/helpers.ts` | Modify — add `createAdmin`, `deleteUser`, `uniqueTitle`; enrich `createContributor` and `createTutorial` |
| `packages/web/tests/e2e/auth/login.spec.ts` | Modify — self-provision |
| `packages/web/tests/e2e/admin/contributors.spec.ts` | Modify — self-provision |
| `packages/web/tests/e2e/admin/review-flow.spec.ts` | Modify — self-provision the admin |
| `packages/web/tests/e2e/contributor/upload-flow.spec.ts` | Modify — self-provision the contributor |
| `packages/web/tests/e2e/public/library.spec.ts` | Modify — self-provision both tutorials |
| `packages/web/tests/e2e/public/tutorial-detail.spec.ts` | Modify — self-provision the tutorial |
| `packages/web/playwright.config.ts` | Modify — enable parallelism |
| `packages/mobile/tests/e2e/helpers.ts` | Modify — add `createTutorial`, `createParent`, `deleteUser`, `uniqueTitle`; return `id` from `createContributor` |
| `packages/mobile/tests/e2e/home-library.spec.ts` | Modify — self-provision |
| `packages/mobile/tests/e2e/home-detail.spec.ts` | Modify — self-provision |
| `packages/mobile/playwright.config.ts` | Modify — enable parallelism |
| `supabase/seed.sql` | Modify — remove the pending contributor |

---

### Task 1: Extend the web fixture helpers

**Files:**
- Modify: `packages/web/tests/e2e/helpers.ts`

**Interfaces:**
- Consumes: the existing `adminClient()`, `uniqueEmail()`, `PASSWORD` constants in that file.
- Produces, for every later web task:
  - `uniqueTitle(prefix: string): string`
  - `createContributor(): Promise<{ id: string; email: string; password: string; name: string }>` — now also sets a profile name
  - `createAdmin(): Promise<{ id: string; email: string; password: string }>`
  - `createTutorial(contributorId: string, overrides?): Promise<string>` — now also inserts a buy link on its part and one STL file row
  - `deleteUser(id: string): Promise<void>`

- [ ] **Step 1: Add `uniqueTitle`**

Four workers make `Date.now()` alone collide. Mirror the existing `uniqueEmail` shape.

```ts
/** Unique per invocation even within the same millisecond — four parallel workers collide on Date.now() alone. */
export function uniqueTitle(prefix: string) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}
```

- [ ] **Step 2: Give contributors a profile name**

`public/tutorial-detail.spec.ts` asserts on the contributor byline, so the fixture needs a deterministic name. Change the `createUser` call and the profile upsert inside `createContributor`:

```ts
const CONTRIBUTOR_NAME = 'E2E Contributor'

export async function createContributor() {
  const admin = adminClient()
  const email = uniqueEmail('contrib')
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: CONTRIBUTOR_NAME },
  })
  if (error || !data.user) throw new Error(`Failed to create contributor: ${error?.message}`)

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: data.user.id, role: 'contributor', name: CONTRIBUTOR_NAME })
  if (profileError) throw new Error(`Failed to set contributor profile: ${profileError.message}`)

  return { id: data.user.id, email, password: PASSWORD, name: CONTRIBUTOR_NAME }
}
```

- [ ] **Step 3: Add `createAdmin`**

```ts
/** Provision a confirmed admin via the service role. The signup trigger defaults to contributor, so the role is set explicitly. */
export async function createAdmin() {
  const admin = adminClient()
  const email = uniqueEmail('admin')
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'E2E Admin' },
  })
  if (error || !data.user) throw new Error(`Failed to create admin: ${error?.message}`)

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: data.user.id, role: 'admin', name: 'E2E Admin' })
  if (profileError) throw new Error(`Failed to set admin profile: ${profileError.message}`)

  return { id: data.user.id, email, password: PASSWORD }
}
```

- [ ] **Step 4: Enrich `createTutorial` with a buy link and an STL row**

`public/tutorial-detail.spec.ts` asserts on a buy-link aria-label and an STL download. Additive to existing callers — no current spec asserts on part counts or STL counts.

In `createTutorial`, replace the single `parts` insert and add an `stl_files` insert:

```ts
  await admin.from('parts').insert({
    tutorial_id: id,
    name: 'E2E part',
    quantity: 2,
    is_optional: false,
    buy_links: [{ label: 'Jaycar', url: 'https://example.com/part' }],
  })
  await admin.from('tools').insert({ tutorial_id: id, name: 'E2E tool', is_optional: false, buy_links: [] })
  await admin.from('stl_files').insert({
    tutorial_id: id,
    filename: 'e2e-mount.stl',
    file_url: 'https://placeholder.invalid/e2e-mount.stl',
  })
```

- [ ] **Step 5: Add `deleteUser`**

```ts
/**
 * Best-effort teardown. CI boots a fresh Supabase per job, so leaked fixtures cost
 * nothing there; this keeps repeated local runs from accumulating accounts.
 * No assertion may depend on this having run.
 */
export async function deleteUser(id: string) {
  await adminClient().auth.admin.deleteUser(id)
}
```

- [ ] **Step 6: Verify the suite is still green**

Run: `pnpm --filter @splat-connect/web test:e2e`
Expected: 18 passed. The helper changes are additive; nothing should regress.

- [ ] **Step 7: Commit**

```bash
git add packages/web/tests/e2e/helpers.ts
git commit -m "test(web): extend the E2E fixture helpers for self-provisioning"
```

---

### Task 2: Convert `auth/login.spec.ts`

**Files:**
- Modify: `packages/web/tests/e2e/auth/login.spec.ts`

**Interfaces:**
- Consumes: `signIn`, `createContributor`, `createAdmin` from `../helpers`.

- [ ] **Step 1: Replace the whole file**

```ts
import { test, expect } from '@playwright/test'
import { signIn, createContributor, createAdmin } from '../helpers'

test('a contributor signs in and lands on the dashboard', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('an admin signs in and lands on the admin dashboard', async ({ page }) => {
  const admin = await createAdmin()
  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')
})

test('an invalid password shows an error and stays on /login', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, 'wrong-password')
  await expect(page.getByText('Invalid login credentials')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})
```

- [ ] **Step 2: Run it twice consecutively without resetting the database**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/auth/login.spec.ts && pnpm --filter @splat-connect/web test:e2e tests/e2e/auth/login.spec.ts`
Expected: 3 passed, both times. This is the gate that proves the spec no longer depends on global state.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/e2e/auth/login.spec.ts
git commit -m "test(web): self-provision accounts in the login spec"
```

---

### Task 3: Convert `admin/contributors.spec.ts`

This is the spec that destroys `pending@splat-test.local` and therefore passes exactly once per database reset.

**Files:**
- Modify: `packages/web/tests/e2e/admin/contributors.spec.ts`

**Interfaces:**
- Consumes: `signIn`, `createAdmin`, `createContributor` from `../helpers`.

- [ ] **Step 1: Demonstrate the current failure**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/admin/contributors.spec.ts` twice in a row.
Expected: passes the first time, **fails the second** with `waiting for getByText('pending@splat-test.local')`. This is the bug being fixed.

- [ ] **Step 2: Replace the whole file**

```ts
import { test, expect } from '@playwright/test'
import { signIn, createAdmin, createContributor } from '../helpers'

test('an admin deletes a contributor account', async ({ page }) => {
  const admin = await createAdmin()
  const victim = await createContributor()

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')

  await page.goto('/admin/contributors')
  await expect(page.getByText(victim.email)).toBeVisible()

  const row = page.locator('div.card', { hasText: victim.email })
  await row.getByRole('button', { name: 'Delete' }).click()
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(victim.email)).toHaveCount(0)
})
```

- [ ] **Step 3: Run it twice consecutively**

Run: the same command as Step 1, twice.
Expected: 1 passed, **both times**.

- [ ] **Step 4: Commit**

```bash
git add packages/web/tests/e2e/admin/contributors.spec.ts
git commit -m "test(web): stop the contributors spec consuming a seeded account"
```

---

### Task 4: Convert `admin/review-flow.spec.ts`

**Files:**
- Modify: `packages/web/tests/e2e/admin/review-flow.spec.ts`

**Interfaces:**
- Consumes: `signIn`, `createContributor`, `createAdmin`, `createTutorial`, `uniqueTitle` from `../helpers`.

- [ ] **Step 1: Replace the two seeded admin sign-ins and the two title literals**

In both tests, replace `Date.now()`-suffixed titles with `uniqueTitle`, and the seeded admin with a provisioned one:

```ts
import { test, expect } from '@playwright/test'
import { signIn, createContributor, createAdmin, createTutorial, uniqueTitle } from '../helpers'

test('an admin approves a pending tutorial and it appears in the public library', async ({ page }) => {
  const contributor = await createContributor()
  const admin = await createAdmin()
  const title = uniqueTitle('E2E Review Target Approve')
  const tutorialId = await createTutorial(contributor.id, { title, status: 'pending' })

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')

  await page.goto('/admin/review')
  await page.getByRole('link', { name: new RegExp(title) }).click()
  await page.waitForURL(`**/admin/review/${tutorialId}`)

  await page.getByRole('button', { name: '✓ Approve — publish to library' }).click()
  await page.waitForLoadState('networkidle')

  await page.goto('/library')
  await expect(page.getByText(title)).toBeVisible()
})

test('an admin rejects a pending tutorial with a note visible to the contributor', async ({ page }) => {
  const contributor = await createContributor()
  const admin = await createAdmin()
  const title = uniqueTitle('E2E Review Target Reject')
  const tutorialId = await createTutorial(contributor.id, { title, status: 'pending' })

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')
  await page.goto(`/admin/review/${tutorialId}`)
  await page.waitForLoadState('networkidle')

  await page.locator('textarea[name="note"]').fill('Needs clearer photos.')
  await page.getByRole('button', { name: '✕ Reject' }).click()
  await page.waitForLoadState('networkidle')

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await expect(page.getByText('Needs clearer photos.')).toBeVisible()
  await expect(page.getByText('REJECTED', { exact: true })).toBeVisible()
})
```

Note the rejection assertion is already scoped to this contributor's own dashboard, so it stays valid under parallelism.

- [ ] **Step 2: Run it twice consecutively**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/admin/review-flow.spec.ts` twice.
Expected: 2 passed, both times.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/e2e/admin/review-flow.spec.ts
git commit -m "test(web): self-provision the admin in the review-flow spec"
```

---

### Task 5: Convert `contributor/upload-flow.spec.ts`

**Files:**
- Modify: `packages/web/tests/e2e/contributor/upload-flow.spec.ts`

**Interfaces:**
- Consumes: `signIn`, `createContributor`, `uniqueTitle` from `../helpers`.

- [ ] **Step 1: Read the file and replace only the sign-in and the title**

Do not restructure the wizard walk-through. Two changes:

```ts
// at the top of the test body, replacing the seeded sign-in
const contributor = await createContributor()
const title = uniqueTitle('E2E Upload')
await signIn(page, contributor.email, contributor.password)
```

Every later step in that test already refers to `title`; leave the wizard steps untouched. The `div.card` row locator at the end already matches the current markup.

- [ ] **Step 2: Run it twice consecutively**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/contributor/upload-flow.spec.ts` twice.
Expected: 1 passed, both times.

Previously this test wrote tutorials into the shared seeded contributor account, so its rows accumulated in every other spec's dashboard.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/e2e/contributor/upload-flow.spec.ts
git commit -m "test(web): self-provision the contributor in the upload-flow spec"
```

---

### Task 6: Convert `public/library.spec.ts`

The current file asserts on total list contents, which is the assertion most hostile to parallelism.

**Files:**
- Modify: `packages/web/tests/e2e/public/library.spec.ts`

**Interfaces:**
- Consumes: `createContributor`, `createTutorial`, `uniqueTitle` from `../helpers`.

- [ ] **Step 1: Replace the whole file**

```ts
import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, uniqueTitle } from '../helpers'

test('the library lists an approved tutorial and hides a pending one', async ({ page }) => {
  const contributor = await createContributor()
  const approved = uniqueTitle('E2E Library Approved')
  const pending = uniqueTitle('E2E Library Pending')
  await createTutorial(contributor.id, { title: approved, status: 'approved' })
  await createTutorial(contributor.id, { title: pending, status: 'pending' })

  await page.goto('/library')

  await expect(page.getByRole('heading', { name: 'Toy Adaptation Library' })).toBeVisible()
  await expect(page.getByText(approved)).toBeVisible()
  await expect(page.getByText(pending)).toHaveCount(0)
})

test('the search box filters the grid by title', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Library Search')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/library')

  await page.getByPlaceholder('Search by toy name…').fill(title)
  await expect(page.getByText(title)).toBeVisible()

  await page.getByPlaceholder('Search by toy name…').fill('Nonexistent Toy Name')
  await expect(page.getByText(title)).toHaveCount(0)
  await expect(page.getByText('No tutorials found.')).toBeVisible()
})

test('the difficulty filter narrows the grid to the selected difficulty', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Library Easy')
  await createTutorial(contributor.id, { title, status: 'approved', difficulty: 'easy' })

  await page.goto('/library')

  await page.getByRole('button', { name: 'hard' }).click()
  await expect(page.getByText(title)).toHaveCount(0)

  await page.getByRole('button', { name: 'easy' }).click()
  await expect(page.getByText(title)).toBeVisible()
})
```

The filter buttons are `.chip` elements whose text is lowercase in the DOM (`capitalize` is a CSS transform), so `getByRole('button', { name: 'hard' })` matches.

- [ ] **Step 2: Run it twice consecutively**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/public/library.spec.ts` twice.
Expected: 3 passed, both times.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/e2e/public/library.spec.ts
git commit -m "test(web): scope library assertions to their own fixtures"
```

---

### Task 7: Convert `public/tutorial-detail.spec.ts`

**Files:**
- Modify: `packages/web/tests/e2e/public/tutorial-detail.spec.ts`

**Interfaces:**
- Consumes: `createContributor`, `createTutorial`, `uniqueTitle` from `../helpers`.

- [ ] **Step 1: Replace the whole file**

The hardcoded `aaaaaaaa-…` id and the `Seed Contributor` byline both go. Assertions now match what the enriched `createTutorial` inserts.

```ts
import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, uniqueTitle } from '../helpers'

test('the detail page renders a tutorial in full', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Detail')
  const tutorialId = await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto(`/tutorials/${tutorialId}`)

  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText('Created by a Playwright E2E test.')).toBeVisible()
  await expect(page.getByText(new RegExp(`By\\s+${contributor.name}`))).toBeVisible()

  await expect(page.getByRole('link', { name: '📄 Download Tutorial PDF' })).toHaveAttribute(
    'href',
    'https://placeholder.invalid/tutorial.pdf'
  )
  await expect(page.getByRole('link', { name: '↓ e2e-mount.stl' })).toBeVisible()

  await expect(page.getByRole('heading', { name: '🔩 Parts needed' })).toBeVisible()
  await expect(page.getByText(/E2E part\s*×\s*2/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Buy E2E part from Jaycar' })).toBeVisible()

  await expect(page.getByRole('heading', { name: '🔧 Tools needed' })).toBeVisible()
  await expect(page.getByText('E2E tool')).toBeVisible()
})

test('an unknown tutorial id renders a 404', async ({ page }) => {
  const response = await page.goto('/tutorials/00000000-0000-0000-0000-000000000000')
  expect(response?.status()).toBe(404)
})
```

- [ ] **Step 2: Run it twice consecutively**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/public/tutorial-detail.spec.ts` twice.
Expected: 2 passed, both times.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/e2e/public/tutorial-detail.spec.ts
git commit -m "test(web): self-provision the tutorial in the detail spec"
```

---

### Task 8: Enable parallel execution for the web suite

**Files:**
- Modify: `packages/web/playwright.config.ts`

- [ ] **Step 1: Confirm the whole suite is green serially first**

Run: `pnpm --filter @splat-connect/web test:e2e`
Expected: 18 passed. Do not proceed if anything fails — a failure here is a conversion bug, not a parallelism bug, and diagnosing the two together is much harder.

- [ ] **Step 2: Flip the flags**

Replace the two lines, keeping the comment that explains why the value is now safe:

```ts
  // Safe since every spec provisions its own fixtures and asserts only on rows
  // it created (see docs/superpowers/specs/2026-07-26-e2e-coverage-audit-design.md).
  // A single spec reading a shared account would corrupt other workers mid-run.
  fullyParallel: true,
  workers: 4,
```

- [ ] **Step 3: Run the suite twice consecutively**

Run: `pnpm --filter @splat-connect/web test:e2e && pnpm --filter @splat-connect/web test:e2e`
Expected: 18 passed both times, and wall-clock materially below the serial baseline.

- [ ] **Step 4: Commit**

```bash
git add packages/web/playwright.config.ts
git commit -m "test(web): run the E2E suite on four parallel workers"
```

---

### Task 9: Extend the mobile fixture helpers

**Files:**
- Modify: `packages/mobile/tests/e2e/helpers.ts`

**Interfaces:**
- Consumes: the existing `SUPABASE_URL`, `SERVICE_ROLE_KEY`, `PASSWORD`, `uniqueEmail` in that file.
- Produces, for Tasks 10 and 11:
  - `uniqueTitle(prefix: string): string`
  - `createContributor(): Promise<{ id: string; email: string; password: string }>` — now returns `id`
  - `createParent(): Promise<{ id: string; email: string; password: string }>`
  - `createTutorial(contributorId: string, overrides?: { title?: string; status?: 'draft' | 'pending' | 'approved' | 'rejected'; difficulty?: 'easy' | 'medium' | 'hard' }): Promise<string>`
  - `deleteUser(id: string): Promise<void>`

- [ ] **Step 1: Add a shared service-role client and `uniqueTitle`**

The file currently constructs a client inline inside `createContributor`. Hoist it so the new helpers share one.

```ts
function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

/** Unique per invocation even within the same millisecond — parallel workers collide on Date.now() alone. */
export function uniqueTitle(prefix: string) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}
```

- [ ] **Step 2: Return the id from `createContributor`**

`createTutorial` needs the profile id to link the contributor.

```ts
export async function createContributor() {
  const admin = adminClient()
  const email = uniqueEmail('contrib')
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'E2E Contributor' },
  })
  if (error || !data.user) throw new Error(`Failed to create contributor: ${error?.message}`)
  return { id: data.user.id, email, password: PASSWORD }
}
```

- [ ] **Step 3: Add `createParent`**

```ts
/** Provision a confirmed parent via the service role, for specs that do not need the signup UI. */
export async function createParent() {
  const admin = adminClient()
  const email = uniqueEmail('parent')
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'E2E Parent', role: 'parent' },
  })
  if (error || !data.user) throw new Error(`Failed to create parent: ${error?.message}`)

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: data.user.id, role: 'parent', name: 'E2E Parent' })
  if (profileError) throw new Error(`Failed to set parent profile: ${profileError.message}`)

  return { id: data.user.id, email, password: PASSWORD }
}
```

- [ ] **Step 4: Add `createTutorial`, mirroring the web helper**

```ts
/**
 * Provision an approved tutorial with one part and one tool, linked to the given
 * contributor as primary. Mirrors packages/web/tests/e2e/helpers.ts.
 */
export async function createTutorial(
  contributorId: string,
  overrides: Partial<{
    title: string
    status: 'draft' | 'pending' | 'approved' | 'rejected'
    difficulty: 'easy' | 'medium' | 'hard'
  }> = {}
) {
  const admin = adminClient()
  const id = crypto.randomUUID()

  const { error } = await admin.from('tutorials').insert({
    id,
    title: overrides.title ?? uniqueTitle('E2E Tutorial'),
    description: 'Created by a Playwright E2E test.',
    difficulty: overrides.difficulty ?? 'easy',
    status: overrides.status ?? 'approved',
    tutorial_pdf_url: 'https://placeholder.invalid/tutorial.pdf',
    toy_photo_url: 'https://placeholder.invalid/photo.jpg',
  })
  if (error) throw new Error(`Failed to create tutorial: ${error.message}`)

  const { error: linkError } = await admin
    .from('tutorial_contributors')
    .insert({ tutorial_id: id, profile_id: contributorId, role: 'primary' })
  if (linkError) throw new Error(`Failed to link tutorial contributor: ${linkError.message}`)

  await admin.from('parts').insert({ tutorial_id: id, name: 'E2E part', quantity: 2, is_optional: false, buy_links: [] })
  await admin.from('tools').insert({ tutorial_id: id, name: 'E2E tool', is_optional: false, buy_links: [] })

  return id
}
```

- [ ] **Step 5: Add `deleteUser`**

```ts
/** Best-effort teardown. No assertion may depend on this having run. */
export async function deleteUser(id: string) {
  await adminClient().auth.admin.deleteUser(id)
}
```

- [ ] **Step 6: Verify the mobile suite is still green**

Run: `pnpm --filter @splat-connect/mobile test:e2e`
Expected: 17 passed.

- [ ] **Step 7: Commit**

```bash
git add packages/mobile/tests/e2e/helpers.ts
git commit -m "test(mobile): extend the E2E fixture helpers for self-provisioning"
```

---

### Task 10: Convert `home-library.spec.ts`

**Files:**
- Modify: `packages/mobile/tests/e2e/home-library.spec.ts`

**Interfaces:**
- Consumes: `createContributor`, `createTutorial`, `uniqueTitle` from `./helpers`.

- [ ] **Step 1: Replace the whole file**

The module-level `TITLE` constant pointing at the seeded tutorial becomes a per-test fixture.

```ts
import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, uniqueTitle } from './helpers'

test('the library lists a tutorial with its difficulty badge', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Mobile Library')
  await createTutorial(contributor.id, { title, status: 'approved', difficulty: 'easy' })

  await page.goto('/home')

  await expect(page.getByText(title)).toBeVisible()
  // The badge is uppercased in CSS, not in the string, so the text node stays
  // "Easy". .last() because the "Easy" difficulty filter chip renders above the list.
  await expect(page.getByText('Easy', { exact: true }).last()).toBeVisible()
})

test('search narrows the list and clearing it restores the tutorial', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Mobile Search')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/home')

  await page.getByPlaceholder('Search tutorials').fill('no such toy')
  await expect(page.getByText(title)).toHaveCount(0)

  await page.getByPlaceholder('Search tutorials').fill('')
  await expect(page.getByText(title)).toBeVisible()
})

test('the difficulty filter narrows results', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Mobile Filter')
  await createTutorial(contributor.id, { title, status: 'approved', difficulty: 'easy' })

  await page.goto('/home')

  await page.getByText('Medium', { exact: true }).click()
  await expect(page.getByText(title)).toHaveCount(0)

  await page.getByText('Easy', { exact: true }).click()
  await expect(page.getByText(title)).toBeVisible()
})
```

- [ ] **Step 2: Run it twice consecutively**

Run: `pnpm --filter @splat-connect/mobile test:e2e tests/e2e/home-library.spec.ts` twice.
Expected: 3 passed, both times.

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/tests/e2e/home-library.spec.ts
git commit -m "test(mobile): self-provision the tutorial in the home-library spec"
```

---

### Task 11: Convert `home-detail.spec.ts`

**Files:**
- Modify: `packages/mobile/tests/e2e/home-detail.spec.ts`

**Interfaces:**
- Consumes: `createContributor`, `createTutorial`, `uniqueTitle` from `./helpers`.

- [ ] **Step 1: Replace the whole file**

```ts
import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, uniqueTitle } from './helpers'

test('tapping a tutorial navigates to its detail screen', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Mobile Detail')
  await createTutorial(contributor.id, { title, status: 'approved', difficulty: 'easy' })

  await page.goto('/home')
  await page.getByText(title).click()

  // .last() throughout: the library screen stays mounted behind the detail
  // screen, so the title, description and badge each match twice.
  await expect(page.getByText(title).last()).toBeVisible()
  await expect(page.getByText('Created by a Playwright E2E test.').last()).toBeVisible()
  await expect(page.getByText('Easy', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('E2E part × 2')).toBeVisible()
  await expect(page.getByText('E2E tool')).toBeVisible()
})

test('tapping Preview Tutorial navigates to the preview screen', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Mobile Preview')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/home')
  await page.getByText(title).click()
  await page.getByText('Preview Tutorial').click()

  await expect(page.getByText('Open in Browser')).toBeVisible()
})
```

- [ ] **Step 2: Run it twice consecutively**

Run: `pnpm --filter @splat-connect/mobile test:e2e tests/e2e/home-detail.spec.ts` twice.
Expected: 2 passed, both times.

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/tests/e2e/home-detail.spec.ts
git commit -m "test(mobile): self-provision the tutorial in the home-detail spec"
```

---

### Task 12: Enable parallel execution for the mobile suite

**Files:**
- Modify: `packages/mobile/playwright.config.ts`

- [ ] **Step 1: Audit the remaining six specs for shared state**

Read `ability-profile.spec.ts`, `auth.spec.ts`, `child-profile-home.spec.ts`, `customization.spec.ts`, `everyday-needs.spec.ts` and `parent-signup.spec.ts`. Each must call `signUpParent` with a `uniqueParentEmail()` or `createParent()`, and must not assert on any seeded row.

If any of them shares an account across tests within the file, convert it before proceeding — parallelism is all-or-nothing.

- [ ] **Step 2: Confirm the whole suite is green serially**

Run: `pnpm --filter @splat-connect/mobile test:e2e`
Expected: 17 passed.

- [ ] **Step 3: Flip the flags**

```ts
  // Safe since every spec provisions its own fixtures and asserts only on rows
  // it created (see docs/superpowers/specs/2026-07-26-e2e-coverage-audit-design.md).
  fullyParallel: true,
  workers: 4,
```

- [ ] **Step 4: Run the suite twice consecutively**

Run: `pnpm --filter @splat-connect/mobile test:e2e && pnpm --filter @splat-connect/mobile test:e2e`
Expected: 17 passed both times.

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/playwright.config.ts
git commit -m "test(mobile): run the E2E suite on four parallel workers"
```

---

### Task 13: Remove the pending contributor from `seed.sql`

Nothing references it once Task 3 lands. Leaving it invites the next spec to reach for it.

**Files:**
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Confirm nothing references it**

Run: `grep -rn "pending@splat-test.local\|33333333-3333" packages/ supabase/`
Expected: matches only inside `supabase/seed.sql`. If any spec still matches, that spec was missed — convert it first.

- [ ] **Step 2: Delete the three blocks referencing `33333333-3333-3333-3333-333333333333`**

Remove its `auth.users` row, its `auth.identities` row, and the `update public.profiles … where id = '33333333-…'` statement. Leave the contributor, admin and parent accounts — they are useful for exploring the app locally and no spec depends on them.

Add a comment above the remaining accounts recording the rule:

```sql
-- These accounts exist for local exploration only. No E2E spec may reference a
-- seeded row: every spec provisions its own fixtures via the service role.
-- See docs/superpowers/specs/2026-07-26-e2e-coverage-audit-design.md.
```

- [ ] **Step 3: Reset and verify both suites**

Run: `supabase db reset && pnpm --filter @splat-connect/web test:e2e && pnpm --filter @splat-connect/mobile test:e2e`
Expected: 18 passed and 17 passed.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql
git commit -m "test: drop the seeded pending contributor"
```

---

### Task 14: Verify the phase gate

**Files:** none — verification only.

- [ ] **Step 1: Reset the database**

Run: `supabase db reset`

- [ ] **Step 2: Run both suites twice consecutively, without resetting in between**

```bash
pnpm --filter @splat-connect/web test:e2e && \
pnpm --filter @splat-connect/web test:e2e && \
pnpm --filter @splat-connect/mobile test:e2e && \
pnpm --filter @splat-connect/mobile test:e2e
```

Expected: 18, 18, 17, 17 — all passing, at `workers: 4`.

This is the gate the spec sets on Phase B. Do not begin Phase B until it is met.

- [ ] **Step 3: Record the wall-clock improvement**

Note the serial baseline (web ≈ 35s, mobile ≈ 50s before this phase) against the parallel figures, so the Phase B plan can size its own runtime against real numbers rather than estimates.
