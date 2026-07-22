# Mobile Home-Tab E2E Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Playwright E2E coverage for the mobile app's home tab (tutorial library → detail → PDF preview), per `docs/superpowers/specs/2026-07-23-mobile-home-e2e-design.md`.

**Architecture:** Two new spec files in the existing `packages/mobile/tests/e2e/` directory, run by the existing `packages/mobile/playwright.config.ts` harness (already starts the API on `:3101` and serves an `expo export -p web` build on `:8081`, both pointed at local Supabase). No config or CI changes — `.github/workflows/ci.yml`'s `mobile-e2e` job already runs `pnpm --filter @splat-connect/mobile test:e2e`, which picks up new spec files automatically.

**Tech Stack:** Playwright (`@playwright/test`), local Supabase CLI (Docker), existing `supabase/seed.sql` fixtures.

## Global Constraints

- Read `packages/mobile/AGENTS.md` before touching any Expo/React Native source — this plan does not modify any, only adds Playwright spec files, but the instruction is repo-wide.
- Local Supabase must be running (`npx supabase start` from the repo root) before running any `test:e2e` command. Run `npx supabase db reset` first for a clean, deterministic seed baseline (matches the CI `e2e`/`mobile-e2e` job order).
- Both spec files must be independently runnable — each starts fresh from `page.goto('/home')`, no shared ordering or setup between files (matches the existing suite's spec-independence convention in `packages/mobile/tests/e2e/*.spec.ts`).
- No new test helpers — `packages/mobile/tests/e2e/helpers.ts` holds auth/profile helpers that don't apply to the home tab; both new files are self-contained.
- The seeded approved tutorial (from `supabase/seed.sql`) is: title `Seeded Switch-Adapted Bubble Machine`, difficulty `easy`, description `A seeded, approved tutorial used by E2E tests.`, one part `Micro switch` (qty 2, not optional → renders as `Micro switch × 2`), one tool `Soldering iron` (not optional → renders as `Soldering iron`, no suffix).
- The difficulty badge (`packages/mobile/components/difficulty-badge.tsx`) renders the difficulty **upper-cased** (e.g. `EASY`), which is a different string than the filter chip label (`Easy`) — they never collide in a text-selector assertion.
- The home tab has no auth gate — tests navigate directly via `page.goto('/home')`, no sign-in step.
- `react-native-webview` has no web-export implementation (confirmed by reading `packages/mobile/node_modules/react-native-webview/src/WebView.tsx` — it's a hardcoded "does not support this platform" placeholder on web). The preview-screen test must assert navigation + the "Open in Browser" fallback button only — never assert anything about WebView/PDF content.

---

### Task 1: `home-library.spec.ts`

**Files:**
- Create: `packages/mobile/tests/e2e/home-library.spec.ts`

**Interfaces:**
- Consumes: none (no shared helpers needed — self-contained, uses only `@playwright/test`'s `test`/`expect`).
- Produces: nothing consumed by Task 2 (both files are independent).

- [ ] **Step 1: Write the spec file**

```typescript
import { test, expect } from '@playwright/test'

const TITLE = 'Seeded Switch-Adapted Bubble Machine'

test('the library lists the seeded tutorial with its difficulty badge', async ({ page }) => {
  await page.goto('/home')

  await expect(page.getByText(TITLE)).toBeVisible()
  await expect(page.getByText('EASY')).toBeVisible()
})

test('search narrows the list and clearing it restores the tutorial', async ({ page }) => {
  await page.goto('/home')

  await page.getByPlaceholder('Search tutorials').fill('no such toy')
  await expect(page.getByText(TITLE)).toHaveCount(0)

  await page.getByPlaceholder('Search tutorials').fill('')
  await expect(page.getByText(TITLE)).toBeVisible()
})

test('the difficulty filter narrows results', async ({ page }) => {
  await page.goto('/home')

  await page.getByText('Medium', { exact: true }).click()
  await expect(page.getByText(TITLE)).toHaveCount(0)

  await page.getByText('Easy', { exact: true }).click()
  await expect(page.getByText(TITLE)).toBeVisible()
})
```

- [ ] **Step 2: Ensure a clean seed baseline**

Run from the repo root (not the `packages/mobile` directory):

```bash
npx supabase db reset
```

Expected: output ends with migrations applied and `Seeding data supabase/seed.sql...` with no errors.

- [ ] **Step 3: Run the new spec**

```bash
pnpm --filter @splat-connect/mobile exec playwright test home-library.spec.ts
```

Expected: `3 passed`. First run will be slow (~1-2 min) while the `webServer` entries build the API and run `expo export -p web`; subsequent runs reuse the server (`reuseExistingServer: !process.env.CI`) unless it was torn down.

- [ ] **Step 4: Commit**

```bash
git add packages/mobile/tests/e2e/home-library.spec.ts
git commit -m "test(mobile): add home-library E2E spec"
```

---

### Task 2: `home-detail.spec.ts`

**Files:**
- Create: `packages/mobile/tests/e2e/home-detail.spec.ts`

**Interfaces:**
- Consumes: none (same as Task 1 — self-contained).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Write the spec file**

```typescript
import { test, expect } from '@playwright/test'

const TITLE = 'Seeded Switch-Adapted Bubble Machine'

test('tapping a tutorial navigates to its detail screen', async ({ page }) => {
  await page.goto('/home')
  await page.getByText(TITLE).click()

  await expect(page.getByText(TITLE)).toBeVisible()
  await expect(page.getByText('A seeded, approved tutorial used by E2E tests.')).toBeVisible()
  await expect(page.getByText('EASY')).toBeVisible()
  await expect(page.getByText('Micro switch × 2')).toBeVisible()
  await expect(page.getByText('Soldering iron')).toBeVisible()
})

test('tapping Preview Tutorial navigates to the preview screen', async ({ page }) => {
  await page.goto('/home')
  await page.getByText(TITLE).click()
  await page.getByText('Preview Tutorial').click()

  await expect(page.getByText('Open in Browser')).toBeVisible()
})
```

- [ ] **Step 2: Ensure a clean seed baseline**

Local Supabase must already be running from Task 1 (`npx supabase status` to check). If it was stopped, run `npx supabase db reset` again from the repo root.

- [ ] **Step 3: Run the new spec**

```bash
pnpm --filter @splat-connect/mobile exec playwright test home-detail.spec.ts
```

Expected: `2 passed`.

- [ ] **Step 4: Run the full mobile E2E suite to confirm no regressions**

```bash
pnpm --filter @splat-connect/mobile test:e2e
```

Expected: all specs pass (existing Profile-tab specs + the two new home-tab specs).

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/tests/e2e/home-detail.spec.ts
git commit -m "test(mobile): add home-detail E2E spec"
```
