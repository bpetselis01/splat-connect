# Web E2E Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Playwright E2E suite for `packages/web` covering the public library/detail pages, auth, the contributor upload/dashboard/edit flows, and the admin approval flows, running against local Supabase — closing Phase 2 of `docs/superpowers/specs/2026-07-21-integration-e2e-test-layers-design.md`.

**Architecture:** Mirror `packages/mobile/playwright.config.ts` exactly in structure: a `webServer` array boots the API (`:3101`) and a production Next.js build (`:3100`), both with local Supabase env values injected directly so they can never reach the cloud project. Specs are grouped by area (`public/`, `auth/`, `contributor/`, `admin/`) exactly like the mobile suite, reuse `supabase/seed.sql` fixtures where no spec mutates them, and otherwise provision their own throwaway rows via a service-role Supabase client — no spec relies on `beforeAll`/`afterAll` cleanup.

**Tech Stack:** `@playwright/test` ^1.61.1, `@supabase/supabase-js`, Next.js 16.2.6 (`next build && next start`), pnpm workspace filters.

## Global Constraints

- **NEVER point E2E servers at the cloud Supabase project.** Every `webServer` entry's `env` must inject the local dev values below directly — this overrides whatever `packages/web/.env.local` / `packages/api/.env.test` otherwise point at, because neither Next's env loading nor the API's `dotenv/config` override pre-existing `process.env` values.
- Local Supabase dev keys (well-known, non-secret, identical to `packages/api/.env.test` and `packages/mobile/playwright.config.ts`):
  - `SUPABASE_URL` = `http://localhost:54321`
  - `SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`
  - `SUPABASE_SERVICE_ROLE_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU`
- Ports: API `3101`, web `3100`.
- No explicit per-test cleanup/teardown anywhere in this suite — rely on `supabase db reset` before the whole run plus unique, per-run throwaway fixtures (emails, tutorial ids). This matches the existing `packages/mobile/tests/e2e/*.spec.ts` convention.
- All seeded/throwaway test accounts use password `Test1234!`.
- Seeded fixtures available from `supabase/seed.sql` (already shipped in Phase 1 — do not re-create):
  - `contributor@splat-test.local` — id `11111111-1111-1111-1111-111111111111`, approved contributor, name "Seed Contributor".
  - `admin@splat-test.local` — id `22222222-2222-2222-2222-222222222222`, admin.
  - `pending@splat-test.local` — id `33333333-3333-3333-3333-333333333333`, unapproved contributor. **Mutated by Task 8** (approved there) — no other task may depend on it staying unapproved.
  - Approved tutorial `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`, title "Seeded Switch-Adapted Bubble Machine", difficulty `easy`, 1 part ("Micro switch" × 2, buy link "Jaycar"), 1 tool ("Soldering iron"), 1 STL file (`mount.stl`).
  - Pending tutorial `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`, title "Seeded Pending Plush Toy", difficulty `medium`.
- `POST /api/upload/pdf|photo|stl` (`packages/api/src/routes/upload.ts`) perform real Supabase Storage uploads with **no content/mimetype validation** — fixture files just need the right extension, any byte content works.
- Local Supabase must be running before any of these tasks are exercised: `supabase start` (from repo root).
- Playwright config shape (all tasks after Task 1 assume this exists): `fullyParallel: false`, `workers: 1`, single `chromium` project, `reporter: 'line'`, `retries: process.env.CI ? 1 : 0`.

---

### Task 1: Playwright harness + first public spec

**Files:**
- Modify: `packages/web/package.json`
- Create: `packages/web/playwright.config.ts`
- Create: `packages/web/tests/e2e/public/library.spec.ts`

**Interfaces:**
- Produces: the `packages/web/tests/e2e/` directory as `testDir`, and the running convention `pnpm --filter @splat-connect/web test:e2e` used by every later task.

- [ ] **Step 1: Add the Playwright dependency and scripts**

Edit `packages/web/package.json`:

```json
{
  "name": "@splat-connect/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "dotenv -e ../../.env.local -e .env.local -- next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "eslint",
    "test:unit": "vitest run tests/unit --coverage",
    "test:e2e": "playwright test",
    "test:e2e:install": "playwright install chromium"
  },
  "dependencies": {
    "@splat-connect/types": "workspace:*",
    "@supabase/ssr": "^0.10.3",
    "@supabase/supabase-js": "^2.106.1",
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "server-only": "^0.0.1"
  },
  "devDependencies": {
    "@playwright/test": "^1.61.1",
    "@tailwindcss/postcss": "^4",
    "@testing-library/jest-dom": "^6",
    "@testing-library/react": "^16",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^4",
    "@vitest/coverage-v8": "^2",
    "dotenv-cli": "^11.0.0",
    "eslint": "^9",
    "eslint-config-next": "16.2.6",
    "jsdom": "^24",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^2"
  }
}
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: `@playwright/test` resolved into `packages/web/node_modules` (or the workspace root's hoisted store).

- [ ] **Step 3: Write the Playwright config**

Create `packages/web/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

// Local Supabase — well-known, non-secret dev keys (same values as
// packages/api/.env.test and packages/mobile/playwright.config.ts). The E2E
// servers MUST point here, never the cloud project. Injected into each
// webServer's env below; because both Next's built-in env loading and the
// API's `import 'dotenv/config'` do not override existing process.env, these
// win over whatever the packages' own .env.local files hold — that is the
// safety boundary.
const SUPABASE_URL = 'http://localhost:54321'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const API_PORT = '3101'
const WEB_PORT = '3100'
const WEB_URL = `http://localhost:${WEB_PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'line',
  use: { baseURL: WEB_URL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @splat-connect/api dev',
      url: `http://localhost:${API_PORT}/api/public/tutorials`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        SUPABASE_URL,
        SUPABASE_ANON_KEY: ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
        API_PORT,
        PORT: API_PORT,
        CORS_ORIGIN: WEB_URL,
      },
    },
    {
      // Build + serve a production bundle rather than `next dev`: the dev
      // server's HMR overlay intercepts clicks and causes flaky E2E (same
      // reasoning as packages/mobile/playwright.config.ts, adapted for Next).
      // NEXT_PUBLIC_* vars are inlined at build time, so they must be present
      // for both halves of this command.
      command:
        'pnpm --filter @splat-connect/web build && pnpm --filter @splat-connect/web start',
      url: WEB_URL,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
        API_URL: `http://localhost:${API_PORT}`,
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
        PORT: WEB_PORT,
      },
    },
  ],
})
```

- [ ] **Step 4: Write the first spec (doubles as the harness smoke test)**

Create `packages/web/tests/e2e/public/library.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('the library lists the seeded approved tutorial and hides the seeded pending one', async ({ page }) => {
  await page.goto('/library')

  await expect(page.getByRole('heading', { name: 'Toy Adaptation Library' })).toBeVisible()
  await expect(page.getByText('Seeded Switch-Adapted Bubble Machine')).toBeVisible()
  await expect(page.getByText('Seeded Pending Plush Toy')).toHaveCount(0)
})

test('the search box filters the grid by title', async ({ page }) => {
  await page.goto('/library')

  await page.getByPlaceholder('Search by toy name…').fill('Bubble Machine')
  await expect(page.getByText('Seeded Switch-Adapted Bubble Machine')).toBeVisible()

  await page.getByPlaceholder('Search by toy name…').fill('Nonexistent Toy Name')
  await expect(page.getByText('No tutorials found.')).toBeVisible()
})

test('the difficulty filter narrows the grid to the selected difficulty', async ({ page }) => {
  await page.goto('/library')

  await page.getByRole('button', { name: 'hard', exact: true }).click()
  await expect(page.getByText('Seeded Switch-Adapted Bubble Machine')).toHaveCount(0)

  await page.getByRole('button', { name: 'easy', exact: true }).click()
  await expect(page.getByText('Seeded Switch-Adapted Bubble Machine')).toBeVisible()
})
```

- [ ] **Step 5: Install the Playwright browser binary**

Run: `pnpm --filter @splat-connect/web test:e2e:install`
Expected: chromium downloaded successfully.

- [ ] **Step 6: Make sure local Supabase is running**

Run: `supabase status`
Expected: shows running services. If not running, run `supabase start` first.

- [ ] **Step 7: Run the suite**

Run: `pnpm --filter @splat-connect/web test:e2e`
Expected: 3 passed (the api and web webServers boot automatically).

- [ ] **Step 8: Commit**

```bash
git add packages/web/package.json packages/web/playwright.config.ts packages/web/tests/e2e/public/library.spec.ts
git commit -m "test(web): add Playwright E2E harness + library spec"
```

---

### Task 2: Public tutorial detail spec

**Files:**
- Create: `packages/web/tests/e2e/public/tutorial-detail.spec.ts`

**Interfaces:**
- Consumes: nothing beyond the harness from Task 1.

- [ ] **Step 1: Write the spec**

Create `packages/web/tests/e2e/public/tutorial-detail.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const APPROVED_TUTORIAL_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

test('the detail page renders the seeded tutorial in full', async ({ page }) => {
  await page.goto(`/tutorials/${APPROVED_TUTORIAL_ID}`)

  await expect(page.getByRole('heading', { name: 'Seeded Switch-Adapted Bubble Machine' })).toBeVisible()
  await expect(page.getByText('A seeded, approved tutorial used by E2E tests.')).toBeVisible()
  await expect(page.getByText(/By\s+Seed Contributor/)).toBeVisible()

  await expect(page.getByRole('link', { name: '📄 Download Tutorial PDF' })).toHaveAttribute(
    'href',
    'https://placeholder.invalid/tutorial.pdf'
  )
  await expect(page.getByRole('link', { name: '↓ mount.stl' })).toBeVisible()

  await expect(page.getByRole('heading', { name: '🔩 Parts needed' })).toBeVisible()
  await expect(page.getByText(/Micro switch\s*×\s*2/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Buy Micro switch from Jaycar' })).toBeVisible()

  await expect(page.getByRole('heading', { name: '🔧 Tools needed' })).toBeVisible()
  await expect(page.getByText('Soldering iron')).toBeVisible()
})

test('an unknown tutorial id renders a 404', async ({ page }) => {
  const response = await page.goto('/tutorials/00000000-0000-0000-0000-000000000000')
  expect(response?.status()).toBe(404)
})
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/public/tutorial-detail.spec.ts`
Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/e2e/public/tutorial-detail.spec.ts
git commit -m "test(web): add public tutorial detail E2E spec"
```

---

### Task 3: E2E helpers + signup spec

**Files:**
- Create: `packages/web/tests/e2e/helpers.ts`
- Create: `packages/web/tests/e2e/auth/signup.spec.ts`

**Interfaces:**
- Produces:
  - `adminClient(): SupabaseClient` — service-role client for fixture setup.
  - `uniqueContributorEmail(): string`
  - `createContributor(approved = true): Promise<{ id: string; email: string; password: string }>`
  - `signIn(page: Page, email: string, password: string): Promise<void>` — navigates to `/login`, submits the form. Does **not** wait for the post-login redirect; callers use `page.waitForURL(...)`.

- [ ] **Step 1: Write the helpers module**

Create `packages/web/tests/e2e/helpers.ts`:

```ts
import { type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Local Supabase — well-known, non-secret dev keys (same as playwright.config.ts).
const SUPABASE_URL = 'http://localhost:54321'
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const PASSWORD = 'Test1234!'

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@web-e2e.local`
}

/** Unique contributor email per invocation so runs don't collide (CI does `supabase db reset`). */
export function uniqueContributorEmail() {
  return uniqueEmail('contrib')
}

/** Service-role client for E2E fixture setup. */
export function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

/**
 * Provision a confirmed contributor directly via the service role. Returns
 * credentials for signing in through the UI. `approved` controls whether the
 * profile can pass the middleware's contributor gate.
 */
export async function createContributor(approved = true) {
  const admin = adminClient()
  const email = uniqueEmail('contrib')
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Failed to create contributor: ${error?.message}`)

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: data.user.id, role: 'contributor', approved })
  if (profileError) throw new Error(`Failed to set contributor profile: ${profileError.message}`)

  return { id: data.user.id, email, password: PASSWORD }
}

/** Sign in through the /login form. Caller awaits the resulting redirect. */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}
```

- [ ] **Step 2: Write the signup spec**

Create `packages/web/tests/e2e/auth/signup.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { uniqueContributorEmail } from '../helpers'

test('a new contributor signs up and sees the pending-approval confirmation', async ({ page }) => {
  const email = uniqueContributorEmail()
  await page.goto('/signup')
  await page.locator('#name').fill('E2E Contributor')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill('Test1234!')
  await page.getByRole('button', { name: 'Request access' }).click()

  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible()
})

test('a newly signed-up (unapproved) contributor hitting a protected route is redirected to /pending', async ({ page }) => {
  const email = uniqueContributorEmail()
  await page.goto('/signup')
  await page.locator('#name').fill('E2E Contributor')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill('Test1234!')
  await page.getByRole('button', { name: 'Request access' }).click()
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible()

  // Local Supabase has email confirmations disabled (supabase/config.toml
  // auth.email.enable_confirmations = false), so signUp() already left a
  // session cookie in this browser context — no separate sign-in needed.
  await page.goto('/upload')
  await page.waitForURL('**/pending')
  await expect(page.getByRole('heading', { name: 'Application pending' })).toBeVisible()
})
```

- [ ] **Step 3: Run it**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/auth/signup.spec.ts`
Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add packages/web/tests/e2e/helpers.ts packages/web/tests/e2e/auth/signup.spec.ts
git commit -m "test(web): add E2E helpers + signup spec"
```

---

### Task 4: Login spec

**Files:**
- Create: `packages/web/tests/e2e/auth/login.spec.ts`

**Interfaces:**
- Consumes: `signIn`, `createContributor` from `../helpers` (Task 3).

- [ ] **Step 1: Write the spec**

Create `packages/web/tests/e2e/auth/login.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { signIn, createContributor } from '../helpers'

test('an approved contributor signs in and lands on the dashboard', async ({ page }) => {
  await signIn(page, 'contributor@splat-test.local', 'Test1234!')
  await page.waitForURL('**/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('an admin signs in and lands on the admin dashboard', async ({ page }) => {
  await signIn(page, 'admin@splat-test.local', 'Test1234!')
  await page.waitForURL('**/admin')
})

test('an unapproved contributor signs in and is redirected to /pending', async ({ page }) => {
  // Throwaway account, not the seeded pending@splat-test.local: Task 8
  // (admin/contributors.spec.ts, which runs first alphabetically) approves
  // that seeded row, so a test asserting "still unapproved" can't rely on it.
  const { email, password } = await createContributor(false)
  await signIn(page, email, password)
  await page.waitForURL('**/pending')
  await expect(page.getByRole('heading', { name: 'Application pending' })).toBeVisible()
})

test('an invalid password shows an error and stays on /login', async ({ page }) => {
  await signIn(page, 'contributor@splat-test.local', 'wrong-password')
  await expect(page.getByText('Invalid login credentials')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/auth/login.spec.ts`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/e2e/auth/login.spec.ts
git commit -m "test(web): add login E2E spec"
```

---

### Task 5: Upload-flow fixtures + spec

**Files:**
- Create: `packages/web/tests/e2e/fixtures/test.pdf`
- Create: `packages/web/tests/e2e/fixtures/test.jpg`
- Create: `packages/web/tests/e2e/contributor/upload-flow.spec.ts`

**Interfaces:**
- Consumes: `signIn` from `../helpers` (Task 3). Signs in as the seeded `contributor@splat-test.local` — safe to reuse directly, since no other spec changes that account's credentials or approval.

- [ ] **Step 1: Add tiny real fixture files**

`packages/api/src/routes/upload.ts` performs a real Supabase Storage upload with no content or mimetype validation (only `file` and `tutorialId` are required in the form data), so these just need plausible extensions.

Create `packages/web/tests/e2e/fixtures/test.pdf`:

```
%PDF-1.4
%%EOF
```

Create `packages/web/tests/e2e/fixtures/test.jpg`:

```
not-a-real-jpeg-but-storage-has-no-mimetype-validation
```

- [ ] **Step 2: Write the upload-flow spec**

Create `packages/web/tests/e2e/contributor/upload-flow.spec.ts`:

```ts
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers'

const PDF_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.pdf')
const PHOTO_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.jpg')

test('a contributor completes the 6-step upload wizard and the tutorial appears as pending', async ({ page }) => {
  await signIn(page, 'contributor@splat-test.local', 'Test1234!')
  await page.waitForURL('**/dashboard')

  const title = `E2E Upload Flow ${Date.now()}`
  await page.goto('/upload')

  // Step 1: Details
  await page.getByPlaceholder('e.g. Fisher-Price Piano').fill(title)
  await page.getByRole('button', { name: 'easy', exact: true }).click()
  await page.getByRole('button', { name: 'Next →' }).click()

  // Step 2: Files
  await page.locator('input[name="tutorial_pdf"]').setInputFiles(PDF_FIXTURE)
  await page.locator('input[name="toy_photo"]').setInputFiles(PHOTO_FIXTURE)
  await expect(page.getByRole('button', { name: 'Next →' })).toBeEnabled({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Next →' }).click()

  // Step 3: Parts
  await page.getByRole('button', { name: '+ Add part' }).click()
  await page.getByPlaceholder('Part name *').fill('E2E test part')
  await page.getByRole('button', { name: 'Next →' }).click()

  // Step 4: Tools
  await page.getByRole('button', { name: '+ Add tool' }).click()
  await page.getByPlaceholder('Tool name *').fill('E2E test tool')
  await page.getByRole('button', { name: 'Next →' }).click()

  // Step 5: STL files (optional — skip)
  await page.getByRole('button', { name: 'Next →' }).click()

  // Step 6: Review & submit
  await expect(page.getByText(title)).toBeVisible()
  await page.getByRole('button', { name: 'Submit for review' }).click()

  await page.waitForURL('**/my-tutorials')
  await expect(page.getByText(title)).toBeVisible()
  await expect(page.getByText('PENDING', { exact: true })).toBeVisible()
})
```

- [ ] **Step 3: Run it**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/contributor/upload-flow.spec.ts`
Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add packages/web/tests/e2e/fixtures packages/web/tests/e2e/contributor/upload-flow.spec.ts
git commit -m "test(web): add upload wizard E2E spec + fixture files"
```

---

### Task 6: Dashboard spec

**Files:**
- Modify: `packages/web/tests/e2e/helpers.ts`
- Create: `packages/web/tests/e2e/contributor/dashboard.spec.ts`

**Interfaces:**
- Produces (added to helpers.ts): `createTutorial(contributorId: string, overrides?: Partial<{ title: string; status: 'draft' | 'pending' | 'approved' | 'rejected'; difficulty: 'easy' | 'medium' | 'hard'; rejection_note: string | null }>): Promise<string>` — inserts a tutorial row (with placeholder file URLs, one part, one tool) linked to `contributorId` as `primary`, returns its id.
- Consumes: `signIn`, `createContributor` (Task 3).

- [ ] **Step 1: Extend helpers.ts with createTutorial**

Add to `packages/web/tests/e2e/helpers.ts` (after `createContributor`):

```ts
/**
 * Provision a throwaway tutorial (with one part and one tool, so it's a
 * complete record) linked to the given contributor as the primary owner.
 * Returns the new tutorial's id.
 */
export async function createTutorial(
  contributorId: string,
  overrides: Partial<{
    title: string
    status: 'draft' | 'pending' | 'approved' | 'rejected'
    difficulty: 'easy' | 'medium' | 'hard'
    rejection_note: string | null
  }> = {}
) {
  const admin = adminClient()
  const id = crypto.randomUUID()

  const { error } = await admin.from('tutorials').insert({
    id,
    title: overrides.title ?? `E2E Tutorial ${id.slice(0, 8)}`,
    description: 'Created by a Playwright E2E test.',
    difficulty: overrides.difficulty ?? 'easy',
    status: overrides.status ?? 'pending',
    tutorial_pdf_url: 'https://placeholder.invalid/tutorial.pdf',
    toy_photo_url: 'https://placeholder.invalid/photo.jpg',
    rejection_note: overrides.rejection_note ?? null,
  })
  if (error) throw new Error(`Failed to create tutorial: ${error.message}`)

  const { error: linkError } = await admin
    .from('tutorial_contributors')
    .insert({ tutorial_id: id, profile_id: contributorId, role: 'primary' })
  if (linkError) throw new Error(`Failed to link tutorial contributor: ${linkError.message}`)

  await admin.from('parts').insert({ tutorial_id: id, name: 'E2E part', quantity: 1, is_optional: false, buy_links: [] })
  await admin.from('tools').insert({ tutorial_id: id, name: 'E2E tool', is_optional: false, buy_links: [] })

  return id
}
```

- [ ] **Step 2: Write the dashboard spec**

Create `packages/web/tests/e2e/contributor/dashboard.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { signIn, createContributor, createTutorial } from '../helpers'

test('a contributor sees their own tutorials and status badges on the dashboard', async ({ page }) => {
  const contributor = await createContributor()
  await createTutorial(contributor.id, { title: 'E2E Pending One', status: 'pending' })
  await createTutorial(contributor.id, { title: 'E2E Approved One', status: 'approved' })
  await createTutorial(contributor.id, {
    title: 'E2E Rejected One',
    status: 'rejected',
    rejection_note: 'Please add more detail.',
  })

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('E2E Pending One')).toBeVisible()
  await expect(page.getByText('E2E Approved One')).toBeVisible()
  await expect(page.getByText('E2E Rejected One')).toBeVisible()
  await expect(page.getByText('Please add more detail.')).toBeVisible()
  await expect(page.getByText('PENDING', { exact: true })).toBeVisible()
  await expect(page.getByText('APPROVED', { exact: true })).toBeVisible()
  await expect(page.getByText('REJECTED', { exact: true })).toBeVisible()
})

test('a contributor with no tutorials sees the empty-state prompt', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  await expect(page.getByText("You haven't submitted any tutorials yet.")).toBeVisible()
  await expect(page.getByRole('link', { name: 'Upload your first tutorial' })).toBeVisible()
})
```

- [ ] **Step 3: Run it**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/contributor/dashboard.spec.ts`
Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add packages/web/tests/e2e/helpers.ts packages/web/tests/e2e/contributor/dashboard.spec.ts
git commit -m "test(web): add dashboard E2E spec + createTutorial helper"
```

---

### Task 7: Edit-tutorial spec

**Files:**
- Create: `packages/web/tests/e2e/contributor/edit-tutorial.spec.ts`

**Interfaces:**
- Consumes: `signIn`, `createContributor`, `createTutorial` (Tasks 3, 6).

- [ ] **Step 1: Write the spec**

Create `packages/web/tests/e2e/contributor/edit-tutorial.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { signIn, createContributor, createTutorial } from '../helpers'

test('editing an approved tutorial resets its status to pending', async ({ page }) => {
  const contributor = await createContributor()
  const tutorialId = await createTutorial(contributor.id, {
    title: 'E2E Approved Edit Target',
    status: 'approved',
  })

  await signIn(page, contributor.email, contributor.password)
  await page.goto(`/tutorials/${tutorialId}/edit`)
  await expect(page.locator('input[name="title"]')).toHaveValue('E2E Approved Edit Target')

  await page.locator('input[name="title"]').fill('E2E Approved Edit Target (updated)')
  await page.getByRole('button', { name: 'Save details' }).click()
  await page.waitForLoadState('networkidle')

  // The edit page's own field can lag a save (a known re-render quirk for
  // everything except the difficulty <select>) — re-check on the dashboard,
  // which is server-rendered fresh from the database on every request.
  await page.goto('/dashboard')
  await expect(page.getByText('E2E Approved Edit Target (updated)')).toBeVisible()
  await expect(page.getByText('PENDING', { exact: true })).toBeVisible()
})

test('a contributor cannot edit another contributor\'s tutorial', async ({ page }) => {
  const owner = await createContributor()
  const outsider = await createContributor()
  const tutorialId = await createTutorial(owner.id, { title: 'E2E Not Yours', status: 'draft' })

  await signIn(page, outsider.email, outsider.password)
  await page.goto(`/tutorials/${tutorialId}/edit`)

  await page.waitForURL('**/dashboard')
})
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/contributor/edit-tutorial.spec.ts`
Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/e2e/contributor/edit-tutorial.spec.ts
git commit -m "test(web): add edit-tutorial E2E spec"
```

---

### Task 8: Admin contributor-approval spec

**Files:**
- Create: `packages/web/tests/e2e/admin/contributors.spec.ts`

**Interfaces:**
- Consumes: `signIn` (Task 3). Uses the seeded `pending@splat-test.local` row directly — no other spec depends on it staying unapproved (Task 4's unapproved-login test uses its own throwaway `createContributor(false)` for exactly this reason).

- [ ] **Step 1: Write the spec**

Create `packages/web/tests/e2e/admin/contributors.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers'

test('an admin approves the seeded pending contributor request', async ({ page }) => {
  // WHY reusing the seeded pending@splat-test.local row instead of a
  // throwaway: this is the only spec that mutates it, and it runs first
  // (admin/ sorts before auth/, contributor/, public/ alphabetically).
  await signIn(page, 'admin@splat-test.local', 'Test1234!')
  await page.waitForURL('**/admin')

  await page.goto('/admin/contributors')
  await expect(page.getByText('pending@splat-test.local')).toBeVisible()

  await page.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('No pending requests.')).toBeVisible()
})
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/admin/contributors.spec.ts`
Expected: 1 passed.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/e2e/admin/contributors.spec.ts
git commit -m "test(web): add admin contributor-approval E2E spec"
```

---

### Task 9: Admin tutorial review-flow spec

**Files:**
- Create: `packages/web/tests/e2e/admin/review-flow.spec.ts`

**Interfaces:**
- Consumes: `signIn`, `createContributor`, `createTutorial` (Tasks 3, 6).

- [ ] **Step 1: Write the spec**

Create `packages/web/tests/e2e/admin/review-flow.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { signIn, createContributor, createTutorial } from '../helpers'

test('an admin approves a pending tutorial and it appears in the public library', async ({ page }) => {
  const contributor = await createContributor()
  const title = `E2E Review Target Approve ${Date.now()}`
  const tutorialId = await createTutorial(contributor.id, { title, status: 'pending' })

  await signIn(page, 'admin@splat-test.local', 'Test1234!')
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
  const title = `E2E Review Target Reject ${Date.now()}`
  const tutorialId = await createTutorial(contributor.id, { title, status: 'pending' })

  await signIn(page, 'admin@splat-test.local', 'Test1234!')
  await page.goto(`/admin/review/${tutorialId}`)

  await page.locator('textarea[name="note"]').fill('Needs clearer photos.')
  await page.getByRole('button', { name: '✕ Reject' }).click()
  await page.waitForLoadState('networkidle')

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await expect(page.getByText('Needs clearer photos.')).toBeVisible()
  await expect(page.getByText('REJECTED', { exact: true })).toBeVisible()
})
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter @splat-connect/web test:e2e tests/e2e/admin/review-flow.spec.ts`
Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/e2e/admin/review-flow.spec.ts
git commit -m "test(web): add admin tutorial review-flow E2E spec"
```

---

### Task 10: CI job

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `pnpm --filter @splat-connect/web test:e2e:install` and `test:e2e` scripts (Task 1).

- [ ] **Step 1: Add the web-e2e job**

Edit `.github/workflows/ci.yml`, adding a new job after `mobile-e2e` (named `web-e2e` for consistency with the existing `mobile-e2e` job):

```yaml
  web-e2e:
    name: Web E2E Tests
    needs: test
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 11

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - uses: supabase/setup-cli@v1
        with:
          version: 2.109.1

      - name: Start local Supabase
        run: supabase start

      # The API + Next.js production build are started by Playwright's
      # webServer (see packages/web/playwright.config.ts) and pointed at
      # local Supabase.
      - name: Install Playwright browser
        run: pnpm --filter @splat-connect/web exec playwright install --with-deps chromium

      - name: Run web E2E tests
        run: pnpm --filter @splat-connect/web test:e2e

      - name: Stop local Supabase
        if: always()
        run: supabase stop --no-backup
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
Expected: no output (parses cleanly).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(web): add web-e2e job running the Playwright suite"
```
