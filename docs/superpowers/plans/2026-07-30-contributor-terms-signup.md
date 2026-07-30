# Contributor Terms at Signup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every account accepts the contributor terms once at signup, and accounts
created before this shipped are asked once on a screen they cannot navigate past.

**Architecture:** Acceptance is a row in `user_agreements`. Signup writes it; a
middleware gate (web) and a profile-tab guard (mobile) catch accounts that lack it.
The API gate at `packages/api/src/routes/tutorials.ts:132` is not touched — this work
adds ways to satisfy it, never to bypass it.

**Tech Stack:** Next.js 16 (App Router, middleware), React 19, Supabase SSR,
Expo/React Native, Vitest + Playwright (web), Jest + `@testing-library/react-native`
(mobile), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-07-30-contributor-terms-signup-design.md`

## Global Constraints

- **No placeholder legal text.** `app/legal/contributor-terms/page.tsx` states
  *"No placeholder legal language is to be generated here."* Reuse the existing page;
  never invent terms wording.
- **Agreement version is `'v0-todo'`**, read from
  `AGREEMENT_VERSIONS.contributor_terms` in `@splat-connect/types`. The API sets it
  server-side (`agreements.ts:38`); clients never send a version.
- **The only acceptance endpoint is `POST /api/agreements`** with body
  `{ agreement_type: 'contributor_terms' }`. The only read is `GET /api/agreements/me`
  returning `UserAgreement[]`.
- **Never report a false acceptance.** Precedent: `components/terms-gate.tsx:8-12`.
  If the POST fails, the UI must not behave as though it succeeded.
- **API and RLS are unchanged.** No files under `packages/api/src` or
  `supabase/migrations` are modified by this plan.
- **Before writing any mobile code**, read the versioned Expo docs at
  <https://docs.expo.dev/versions/v57.0.0/> — required by
  `packages/mobile/AGENTS.md`.
- **Commands:**
  - web unit: `pnpm --filter @splat-connect/web test:unit`
  - web e2e: `pnpm --filter @splat-connect/web test:e2e`
  - mobile unit: `pnpm --filter @splat-connect/mobile test:unit`
  - typecheck all: `pnpm -r typecheck`
- **Ports:** dev web `3100`, dev API `3101`. E2E owns `3102-3105` and must not be run
  with an Android emulator up (it can shadow Supabase ports).

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `packages/web/components/terms-gate.tsx` (modify) | Gains optional `requireCheckbox` so one component serves both the inline gate and the interstitial | 1 |
| `packages/web/app/onboarding/contributor-terms/page.tsx` (create) | The blocking screen; owns the safe `next` redirect | 2 |
| `packages/web/middleware.ts` (modify) | Decides which paths require an acceptance | 3 |
| `packages/web/app/signup/page.tsx` (modify) | Captures consent and records it at account creation | 4 |
| `packages/web/tests/e2e/contributor/contributor-terms.spec.ts` (create) | End-to-end proof, including the un-seeded edit case | 5 |
| `packages/mobile/lib/auth-context.tsx` (modify) | Single source of `hasContributorTerms` + accept action | 6 |
| `packages/mobile/components/profile-screen.tsx` (modify) | Signup checkbox; blocking screen when unaccepted | 7, 8 |

---

### Task 1: TermsGate gains an optional checkbox

`terms-gate.tsx:5` says the component is shared "so the two cannot drift apart". The
interstitial needs a tick-box before the accept button; adding a prop keeps one
component rather than forking a second copy of the POST logic.

**Files:**
- Modify: `packages/web/components/terms-gate.tsx`
- Test: `packages/web/tests/unit/components/terms-gate.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `<TermsGate type={AgreementType} onAccepted={() => void} requireCheckbox?: boolean />`.
  When `requireCheckbox` is true the accept button is disabled until the box is
  ticked. Default `false` preserves every existing call site
  (`app/upload/page.tsx:657`, `components/org-review-banner.tsx:35`).

- [ ] **Step 1: Write failing tests**

Append to `packages/web/tests/unit/components/terms-gate.test.tsx`:

```tsx
  it('disables accept until the box is ticked when requireCheckbox is set', () => {
    render(<TermsGate type="contributor_terms" onAccepted={vi.fn()} requireCheckbox />)

    const button = screen.getByRole('button', { name: /I accept/i })
    expect(button).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox'))
    expect(button).toBeEnabled()
  })

  it('has no checkbox and an enabled button by default', () => {
    render(<TermsGate type="contributor_terms" onAccepted={vi.fn()} />)

    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByRole('button', { name: /I accept/i })).toBeEnabled()
  })
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm --filter @splat-connect/web test:unit -- terms-gate`
Expected: FAIL — the first test errors because no `checkbox` role is in the tree.

- [ ] **Step 3: Implement the prop**

In `packages/web/components/terms-gate.tsx`, extend the signature and body:

```tsx
export function TermsGate({
  type,
  onAccepted,
  requireCheckbox = false,
}: {
  type: AgreementType
  onAccepted: () => void
  requireCheckbox?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticked, setTicked] = useState(false)
  const { title, href } = LABELS[type]
```

Insert the checkbox above the existing button, and gate the button's `disabled`:

```tsx
      {requireCheckbox && (
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ticked}
            onChange={(e) => setTicked(e.target.checked)}
          />
          I have read and accept the {title}
        </label>
      )}
      <button
        type="button"
        onClick={accept}
        disabled={busy || (requireCheckbox && !ticked)}
        className="btn btn-accent mt-3"
      >
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm --filter @splat-connect/web test:unit -- terms-gate`
Expected: PASS, including the two pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/terms-gate.tsx packages/web/tests/unit/components/terms-gate.test.tsx
git commit -m "feat(web): let TermsGate require a checkbox before accepting"
```

---

### Task 2: The blocking screen

**Files:**
- Create: `packages/web/app/onboarding/contributor-terms/page.tsx`
- Test: `packages/web/tests/unit/app/onboarding-contributor-terms.test.tsx`

**Interfaces:**
- Consumes: `<TermsGate requireCheckbox />` from Task 1.
- Produces: route `/onboarding/contributor-terms`, accepting an optional `?next=`
  query param. Task 3's middleware sets that param.

`next` is attacker-controllable, so it is validated before use: only a path starting
with a single `/` is honoured, everything else falls back to `/dashboard`. Without
that check `?next=https://evil.example` would turn this screen into an open redirect.

- [ ] **Step 1: Write failing tests**

Create `packages/web/tests/unit/app/onboarding-contributor-terms.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ContributorTermsOnboarding from '@/app/onboarding/contributor-terms/page'

const post = vi.fn()
const replace = vi.fn()
let search = ''

vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { post: (...a: unknown[]) => post(...a) },
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}))

describe('contributor terms onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    search = ''
    post.mockResolvedValue({})
  })

  it('returns the user to the path they were blocked from', async () => {
    search = 'next=%2Fmy-tutorials'
    render(<ContributorTermsOnboarding />)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /I accept/i }))

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/my-tutorials'))
  })

  it('ignores an absolute next and falls back to the dashboard', async () => {
    search = 'next=https%3A%2F%2Fevil.example'
    render(<ContributorTermsOnboarding />)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /I accept/i }))

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'))
  })

  it('ignores a protocol-relative next', async () => {
    search = 'next=%2F%2Fevil.example'
    render(<ContributorTermsOnboarding />)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /I accept/i }))

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'))
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm --filter @splat-connect/web test:unit -- onboarding-contributor-terms`
Expected: FAIL — cannot resolve `@/app/onboarding/contributor-terms/page`.

- [ ] **Step 3: Create the page**

Create `packages/web/app/onboarding/contributor-terms/page.tsx`:

```tsx
'use client'
/**
 * The catch-up gate for accounts created before contributor terms were part of
 * signup. Reached only by redirect from middleware.ts, which passes the path the
 * user was blocked from as ?next=.
 *
 * Related files:
 * - middleware.ts: decides who lands here
 * - components/terms-gate.tsx: the acceptance control itself
 * - app/legal/contributor-terms: the (unwritten) terms this links to
 */
import { useRouter, useSearchParams } from 'next/navigation'
import { TermsGate } from '@/components/terms-gate'

/**
 * `next` arrives from the query string, so it is attacker-controllable. Only a
 * same-origin path is honoured: it must start with exactly one '/', which rules
 * out both absolute URLs and protocol-relative '//host' redirects.
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'
  return raw
}

export default function ContributorTermsOnboarding() {
  const router = useRouter()
  const next = safeNext(useSearchParams().get('next'))

  return (
    <div className="mx-auto mt-8 max-w-lg sm:mt-16">
      <h1 className="text-2xl font-bold text-ink">One thing before you continue</h1>
      <p className="mt-2 mb-6 text-sm leading-relaxed text-muted">
        Your account was created before we asked contributors to accept terms.
        Please review and accept them to carry on.
      </p>
      <TermsGate
        type="contributor_terms"
        requireCheckbox
        onAccepted={() => router.replace(next)}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm --filter @splat-connect/web test:unit -- onboarding-contributor-terms`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/onboarding/contributor-terms/page.tsx packages/web/tests/unit/app/onboarding-contributor-terms.test.tsx
git commit -m "feat(web): add contributor terms catch-up screen"
```

---

### Task 3: Middleware gate

**Files:**
- Modify: `packages/web/middleware.ts`

**Interfaces:**
- Consumes: the route from Task 2.
- Produces: signed-in users without a `contributor_terms` row are redirected from the
  gated paths to `/onboarding/contributor-terms?next=<pathname>`.

Two details that are easy to get wrong:

**`/tutorials` must be matched by pattern, not prefix.** `app/tutorials/[id]/page.tsx`
is the public tutorial detail page and every library result links into it. Gating the
prefix would put public browsing behind an agreement.

**The query errs open.** If the `user_agreements` read fails, the user is allowed
through rather than trapped. Middleware is UX-only (see the file's own header,
lines 22-26) and the API still refuses an ungated submission, so a database blip must
not lock people out of their dashboard.

- [ ] **Step 1: Add the gate**

In `packages/web/middleware.ts`, after the existing admin block (which ends at the
closing brace on line 86) and before `return supabaseResponse`:

```ts
  // Contributor terms gate. Only the account area — public browsing, /legal and the
  // auth pages stay reachable, and /admin is excluded because these terms govern
  // submitting work, not reviewing it.
  const termsGatedPrefixes = ['/dashboard', '/upload', '/my-tutorials', '/organizations']
  const needsTerms =
    user &&
    (termsGatedPrefixes.some((r) => pathname.startsWith(r)) ||
      // Pattern, not prefix: /tutorials/[id] is the public detail page.
      /^\/tutorials\/[^/]+\/edit(\/|$)/.test(pathname))

  if (needsTerms) {
    const { data: agreements, error } = await supabase
      .from('user_agreements')
      .select('id')
      .eq('user_id', user.id)
      .eq('agreement_type', 'contributor_terms')
      .limit(1)

    // Err open on failure. This gate is UX; packages/api/src/routes/tutorials.ts:132
    // is the real enforcement, so a transient read error must not strand anyone.
    if (error) {
      console.error('[middleware] contributor_terms lookup failed:', error.message)
    } else if (!agreements?.length) {
      const url = new URL('/onboarding/contributor-terms', request.url)
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }
```

- [ ] **Step 2: Update the file header**

The header at `middleware.ts:13-21` lists protected routes. Add beneath the
`/organizations` entry:

```
 * - Contributor terms: /dashboard, /upload, /my-tutorials, /organizations and
 *   /tutorials/<id>/edit redirect to /onboarding/contributor-terms until the account
 *   has accepted. /admin is excluded — the terms govern submitting, not reviewing.
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @splat-connect/web typecheck`
Expected: PASS, no errors.

- [ ] **Step 4: Verify by hand against the running dev server**

With `pnpm dev:web` and `pnpm dev:api` up, signed in as an account with no
acceptance row, visit `http://localhost:3100/dashboard`.
Expected: redirect to `/onboarding/contributor-terms?next=%2Fdashboard`.
Then visit `http://localhost:3100/library`.
Expected: loads normally, no redirect.

- [ ] **Step 5: Commit**

```bash
git add packages/web/middleware.ts
git commit -m "feat(web): gate the account area on contributor terms"
```

---

### Task 4: Signup records the acceptance

**Files:**
- Modify: `packages/web/app/signup/page.tsx`
- Test: `packages/web/tests/unit/app/signup-page.test.tsx` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: no exported API change. `/signup` refuses to submit until the box is
  ticked, and POSTs `/api/agreements` once `signUp()` resolves.

A failed POST must **not** fail signup: the account exists and the session is live, so
throwing away that state would be worse than an unrecorded acceptance. Task 3's gate
catches the user on their next navigation.

- [ ] **Step 1: Write failing tests**

Create `packages/web/tests/unit/app/signup-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SignupPage from '@/app/signup/page'

const signUp = vi.fn()
const post = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signUp: (...a: unknown[]) => signUp(...a) } }),
}))
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { post: (...a: unknown[]) => post(...a) },
}))

function fillForm() {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Ada' } })
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.co' } })
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret1' } })
}

describe('signup page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signUp.mockResolvedValue({ error: null })
    post.mockResolvedValue({})
  })

  it('keeps submit disabled until the terms box is ticked', () => {
    render(<SignupPage />)
    fillForm()

    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled()
  })

  it('records the acceptance after the account is created', async () => {
    render(<SignupPage />)
    fillForm()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/agreements', {
        agreement_type: 'contributor_terms',
      })
    )
  })

  it('still creates the account when recording the acceptance fails', async () => {
    post.mockRejectedValue(new Error('network'))
    render(<SignupPage />)
    fillForm()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    // The success screen is what proves signup was not rolled back or blocked.
    await waitFor(() => expect(screen.getByText(/you're all set/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm --filter @splat-connect/web test:unit -- signup-page`
Expected: FAIL — no checkbox is rendered, so `getByRole('checkbox')` throws.

- [ ] **Step 3: Implement**

In `packages/web/app/signup/page.tsx`, add the import and state:

```tsx
import { browserApiClient } from '@/lib/browser-api-client'
```

```tsx
  const [acceptedTerms, setAcceptedTerms] = useState(false)
```

Replace the body of `handleSubmit` after the error branch (currently line 32,
`setSubmitted(true)`) with:

```tsx
    // enable_confirmations = false (supabase/config.toml:232), so signUp() has
    // already returned a live session and this call is authenticated.
    try {
      await browserApiClient.post('/api/agreements', {
        agreement_type: 'contributor_terms',
      })
    } catch {
      // Deliberately non-fatal. The account exists and the user is signed in;
      // rolling that back would be worse than a missing acceptance row. The
      // middleware gate sends them to /onboarding/contributor-terms next request.
    }

    setSubmitted(true)
```

Add the checkbox immediately before the error paragraph (line 111):

```tsx
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1"
            />
            <span>
              I have read and accept the{' '}
              <Link href="/legal/contributor-terms" className="font-semibold text-brand-dark hover:underline">
                contributor terms
              </Link>
              .
            </span>
          </label>
```

Gate the submit button:

```tsx
          <button
            type="submit"
            disabled={loading || !acceptedTerms}
            className="btn btn-accent btn-block mt-2"
          >
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm --filter @splat-connect/web test:unit -- signup-page`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/signup/page.tsx packages/web/tests/unit/app/signup-page.test.tsx
git commit -m "feat(web): accept contributor terms during signup"
```

---

### Task 5: End-to-end proof, without the fixture that hid the bug

Every test in `tests/e2e/contributor/edit-tutorial.spec.ts` calls `acceptTerms()` in
setup — which is why the original 403 never surfaced in CI. `helpers.ts` already warns
that folding it into `createContributor` "would make it untestable"; the missing piece
is a test that omits it on purpose.

**Files:**
- Create: `packages/web/tests/e2e/contributor/contributor-terms.spec.ts`

**Interfaces:**
- Consumes: Tasks 2, 3 and 4.
- Produces: nothing consumed later.

Existing helpers used here, all from `packages/web/tests/e2e/helpers.ts`:
`createContributor()`, `signIn(page, email, password)`, `createTutorial(profileId, {...})`,
`uniqueTitle()`. Note **no** `acceptTerms` import — that is the point of this file.

- [ ] **Step 1: Write the spec**

Create `packages/web/tests/e2e/contributor/contributor-terms.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { signIn, createContributor, createTutorial, uniqueTitle } from '../helpers'

// No acceptTerms() anywhere in this file, deliberately. Seeding acceptance in setup
// is what kept the contributor-terms 403 invisible to the suite.

test('an account without accepted terms is sent to the catch-up screen', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/onboarding\/contributor-terms/)
})

test('browsing stays open without accepted terms', async ({ page }) => {
  const contributor = await createContributor()
  const tutorialId = await createTutorial(contributor.id, {
    title: uniqueTitle(),
    status: 'approved',
  })
  await signIn(page, contributor.email, contributor.password)

  await page.goto('/library')
  await expect(page).toHaveURL(/\/library/)

  // The public detail page must not be caught by the /tutorials gate.
  await page.goto(`/tutorials/${tutorialId}`)
  await expect(page).toHaveURL(new RegExp(`/tutorials/${tutorialId}$`))
})

test('accepting returns the user to where they were blocked and unblocks editing', async ({ page }) => {
  const contributor = await createContributor()
  const tutorialId = await createTutorial(contributor.id, {
    title: uniqueTitle(),
    status: 'approved',
  })
  await signIn(page, contributor.email, contributor.password)

  await page.goto(`/tutorials/${tutorialId}/edit`)
  await expect(page).toHaveURL(/\/onboarding\/contributor-terms/)

  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /I accept/i }).click()

  await expect(page).toHaveURL(new RegExp(`/tutorials/${tutorialId}/edit`))

  // The original bug: saving an approved tutorial sets status -> pending, which the
  // API refuses without an acceptance row, and the Server Action threw a 500. This is
  // the assertion that would have caught it.
  //
  // #edit-title / "Save details" are the ids the Details panel actually uses; the
  // panel is <details open> so no expansion is needed first.
  await page.locator('#edit-title').fill('Edited after accepting terms')
  await page.getByRole('button', { name: 'Save details' }).click()

  // The <h1> renders tutorial.title, so it changing proves the PATCH was accepted and
  // the page revalidated — a 403 would have produced an error page instead.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Edited after accepting terms'
  )
})

test('a new signup never sees the catch-up screen', async ({ page }) => {
  const email = `terms-${Date.now()}@example.com`

  await page.goto('/signup')
  await page.getByLabel(/full name/i).fill('New Contributor')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill('secret123')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /create account/i }).click()

  await page.getByRole('link', { name: /go to your dashboard/i }).click()
  await expect(page).toHaveURL(/\/dashboard/)
})
```

- [ ] **Step 2: Run the spec and verify it passes**

Run: `pnpm --filter @splat-connect/web test:e2e -- contributor-terms`
Expected: 4 passed.

If the whole suite is run and Kong returns 502s on every request, restart the Kong
container rather than debugging the code — a `supabase db reset` breaks the gateway
while leaving auth healthy.

- [ ] **Step 3: Run the existing contributor suite for regressions**

Run: `pnpm --filter @splat-connect/web test:e2e -- contributor`
Expected: all pre-existing specs still pass. They seed `acceptTerms()`, so the new
gate is satisfied and their behaviour is unchanged.

- [ ] **Step 4: Commit**

```bash
git add packages/web/tests/e2e/contributor/contributor-terms.spec.ts
git commit -m "test(web): cover the contributor terms gate without seeding acceptance"
```

---

### Task 6: Mobile auth context exposes acceptance

Read <https://docs.expo.dev/versions/v57.0.0/> before starting, per
`packages/mobile/AGENTS.md`.

**Files:**
- Modify: `packages/mobile/lib/auth-context.tsx`
- Test: `packages/mobile/tests/unit/lib/auth-context.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `useAuth()` gains
  - `hasContributorTerms: boolean`
  - `acceptContributorTerms: () => Promise<{ error: string | null }>`

  Tasks 7 and 8 consume both. The agreements fetch joins the existing profile effect
  at lines 36-47 — a second effect would give two loading states that can disagree
  and make the guard flicker.

- [ ] **Step 1: Write failing test**

Append to `packages/mobile/tests/unit/lib/auth-context.test.tsx`, following the mocking
style already used in that file:

```tsx
  it('reports contributor terms from the agreements endpoint', async () => {
    mockGet.mockImplementation((path: string) =>
      path === '/api/agreements/me'
        ? Promise.resolve([{ agreement_type: 'contributor_terms' }])
        : Promise.resolve({ id: 'u1', name: 'Ada', role: 'contributor' })
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.hasContributorTerms).toBe(true))
  })

  it('reports no contributor terms when the row is absent', async () => {
    mockGet.mockImplementation((path: string) =>
      path === '/api/agreements/me'
        ? Promise.resolve([])
        : Promise.resolve({ id: 'u1', name: 'Ada', role: 'contributor' })
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.profile).not.toBeNull())
    expect(result.current.hasContributorTerms).toBe(false)
  })
```

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm --filter @splat-connect/mobile test:unit -- auth-context`
Expected: FAIL — `result.current.hasContributorTerms` is `undefined`.

- [ ] **Step 3: Implement**

In `packages/mobile/lib/auth-context.tsx`, add to the imports:

```tsx
import type { Profile, UserAgreement } from '@splat-connect/types'
```

Extend `AuthContextValue`:

```tsx
  hasContributorTerms: boolean
  acceptContributorTerms: () => Promise<{ error: string | null }>
```

Add state beside `profile`:

```tsx
  const [hasContributorTerms, setHasContributorTerms] = useState(false)
```

Replace the profile effect (lines 36-47) with one that fetches both:

```tsx
  // Session carries no role; the profile (with role) and the agreement rows both come
  // from the API. One effect, not two: separate fetches would give two loading states
  // that can disagree, and the terms guard would flicker between them.
  useEffect(() => {
    if (!session) {
      setProfile(null)
      setHasContributorTerms(false)
      return
    }
    let ignore = false
    Promise.all([
      apiClient.get<Profile>('/api/contributors/me').catch(() => null),
      apiClient.get<UserAgreement[]>('/api/agreements/me').catch(() => [] as UserAgreement[]),
    ]).then(([p, rows]) => {
      if (ignore) return
      setProfile(p)
      setHasContributorTerms(rows.some((r) => r.agreement_type === 'contributor_terms'))
    })
    return () => { ignore = true }
  }, [session?.user?.id])
```

Add the accept action beside `signOut`:

```tsx
  // Only flips the flag when the server confirms. Reporting an acceptance the server
  // never recorded would leave the user facing a 403 they cannot explain — the same
  // rule the web TermsGate follows.
  async function acceptContributorTerms() {
    try {
      await apiClient.post('/api/agreements', { agreement_type: 'contributor_terms' })
      setHasContributorTerms(true)
      return { error: null }
    } catch {
      return { error: 'Could not record your acceptance. Please try again.' }
    }
  }
```

Add both to the provider value:

```tsx
    <AuthContext.Provider
      value={{ session, profile, loading, hasContributorTerms, signIn, signUp, signOut, acceptContributorTerms }}
    >
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm --filter @splat-connect/mobile test:unit -- auth-context`
Expected: PASS, including the file's pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/lib/auth-context.tsx packages/mobile/tests/unit/lib/auth-context.test.tsx
git commit -m "feat(mobile): expose contributor terms state from auth context"
```

---

### Task 7: Mobile signup checkbox

**Files:**
- Modify: `packages/mobile/components/profile-screen.tsx`
- Test: `packages/mobile/tests/unit/components/profile-screen.test.tsx`

**Interfaces:**
- Consumes: `acceptContributorTerms` from Task 6.
- Produces: nothing consumed later.

`profile-screen.tsx` is the only signup entry point on mobile (`mode` state at line 19).
The checkbox belongs to `mode === 'signup'` only — it must not appear on the sign-in
form.

Per spec decision 3, the acceptance POST is attempted only if a session exists after
`signUp()`. `profile-screen.tsx:49` switches to `check-email`, implying no session,
while `supabase/config.toml:232` says confirmations are off. Rather than depend on
which is true in a given environment, attempt the record and let Task 8's guard ask
again if it did not happen.

- [ ] **Step 1: Write failing test**

Append inside the `describe('ProfileScreen', ...)` block in
`packages/mobile/tests/unit/components/profile-screen.test.tsx`. The file mocks the
context with `jest.mock('../../../lib/auth-context', () => ({ useAuth: jest.fn() }))`
and sets values per test via `(useAuth as jest.Mock).mockReturnValue(...)` — follow
that, there is no shared helper:

```tsx
  it('blocks signup until the terms box is ticked', async () => {
    const signUp = jest.fn().mockResolvedValue({ error: null })
    const acceptContributorTerms = jest.fn().mockResolvedValue({ error: null })
    ;(useAuth as jest.Mock).mockReturnValue({
      session: null,
      signIn: jest.fn(),
      signUp,
      signOut: jest.fn(),
      hasContributorTerms: false,
      acceptContributorTerms,
    })
    render(<ProfileScreen />)

    fireEvent.press(screen.getByText('Create an account'))
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Ada')
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'a@b.com')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret1')
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'secret1')

    fireEvent.press(screen.getByText('Sign Up'))
    await waitFor(() =>
      expect(screen.getByText('Please accept the contributor terms to create an account.')).toBeTruthy()
    )
    expect(signUp).not.toHaveBeenCalled()

    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    fireEvent.press(screen.getByText('Sign Up'))

    await waitFor(() => expect(signUp).toHaveBeenCalledWith('a@b.com', 'secret1', 'Ada'))
    await waitFor(() => expect(acceptContributorTerms).toHaveBeenCalled())
  })
```

`getByPlaceholderText('Password')` also matches `Confirm Password` in some matcher
configurations. If that test throws an "multiple elements" error, switch the first two
password queries to the existing testIDs `password-input` and the email one to
`email-input`, both already present on those `TextField`s.

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm --filter @splat-connect/mobile test:unit -- profile-screen`
Expected: FAIL — no element with testID `accept-contributor-terms`.

- [ ] **Step 3: Implement**

`Ionicons`, `theme`, `Pressable` and `Text` are already imported by this file
(lines 3-6); no new imports are needed.

Add state alongside the existing form state (after line 25):

```tsx
  const [acceptedTerms, setAcceptedTerms] = useState(false)
```

Pull the accept action from the context (line 18):

```tsx
  const { session, profile, signIn, signUp, signOut, acceptContributorTerms } = useAuth()
```

Guard the signup branch of `handleSubmit`. The existing `mode === 'signup'` password
check is at line 29 — add immediately after it:

```tsx
    if (mode === 'signup' && !acceptedTerms) {
      setError('Please accept the contributor terms to create an account.')
      return
    }
```

After the `res.error` early-return that follows the `signUp` call (line 44-48) and
before `setMode('check-email')`, record the acceptance:

```tsx
      // Only records when signUp left a live session. Where email confirmation is
      // enabled there is none, and the profile-tab guard asks again after sign-in.
      await acceptContributorTerms()
```

Render the control inside the `<Card>`, between the Confirm Password field and the
error row (i.e. after the block closing at line 154, before the `{error ? (` block):

```tsx
          {mode === 'signup' ? (
            <Pressable
              testID="accept-contributor-terms"
              onPress={() => setAcceptedTerms((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedTerms }}
              style={styles.termsRow}
            >
              <Ionicons
                name={acceptedTerms ? 'checkbox' : 'square-outline'}
                size={22}
                color={theme.colors.primary}
              />
              <Text style={styles.termsText}>
                I have read and accept the contributor terms.
              </Text>
            </Pressable>
          ) : null}
```

Add two entries to the `StyleSheet.create` block at line 183, matching the file's
existing `theme.spacing()` idiom:

```tsx
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  termsText: { flex: 1, color: theme.colors.muted, fontFamily: theme.fonts.regular },
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm --filter @splat-connect/mobile test:unit -- profile-screen`
Expected: PASS, including the file's pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/components/profile-screen.tsx packages/mobile/tests/unit/components/profile-screen.test.tsx
git commit -m "feat(mobile): accept contributor terms during signup"
```

---

### Task 8: Mobile profile-tab guard

**Files:**
- Modify: `packages/mobile/components/profile-screen.tsx`
- Test: `packages/mobile/tests/unit/components/profile-screen.test.tsx`

**Interfaces:**
- Consumes: `hasContributorTerms` and `acceptContributorTerms` from Task 6.
- Produces: nothing consumed later.

The guard lives in the profile screen, **not** in `app/_layout.tsx`. Mobile is
read-only — there is no caller of `apiClient.post` or `apiClient.patch` in `app/`,
`components/` or `lib/` — so blocking the tab navigator would take `home` and
`toy-library` with it, gating browsing to protect a submission path that does not
exist on this platform.

- [ ] **Step 1: Write failing test**

Append inside the same `describe('ProfileScreen', ...)` block:

```tsx
  it('blocks the profile view when contributor terms are unaccepted', () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      session: { user: { email: 'parent@example.com' } },
      profile: { id: '2', name: 'Cory', email: 'parent@example.com', role: 'contributor', created_at: '' },
      signIn: jest.fn(),
      signOut: jest.fn(),
      hasContributorTerms: false,
      acceptContributorTerms: jest.fn().mockResolvedValue({ error: null }),
    })
    render(<ProfileScreen />)

    expect(screen.getByText('Before you continue')).toBeTruthy()
    expect(screen.queryByText('Sign Out')).toBeNull()
  })

  it('shows the profile once terms are accepted', () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      session: { user: { email: 'parent@example.com' } },
      profile: { id: '2', name: 'Cory', email: 'parent@example.com', role: 'contributor', created_at: '' },
      signIn: jest.fn(),
      signOut: jest.fn(),
      hasContributorTerms: true,
      acceptContributorTerms: jest.fn(),
    })
    render(<ProfileScreen />)

    expect(screen.queryByText('Before you continue')).toBeNull()
    expect(screen.getByText('Signed in as parent@example.com')).toBeTruthy()
  })
```

**The three pre-existing signed-in tests must be updated in this same step.** They
call `mockReturnValue` without `hasContributorTerms`, which reads as `undefined` —
falsy — so the new gate would hide the profile and break them. Add
`hasContributorTerms: true` to the signed-in cases at lines 16-24 and 27-35 of that
file. The signed-out case at lines 9-14 needs no change, because the gate is behind
`session &&`.

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm --filter @splat-connect/mobile test:unit -- profile-screen`
Expected: FAIL on `getByText('Before you continue')` — the copy is not rendered yet.

- [ ] **Step 3: Implement**

Destructure the flag (extending the line changed in Task 7):

```tsx
  const { session, profile, signIn, signUp, signOut, hasContributorTerms, acceptContributorTerms } = useAuth()
```

Add local state for the gate's own checkbox and error, beside `acceptedTerms`:

```tsx
  const [gateTicked, setGateTicked] = useState(false)
  const [gateError, setGateError] = useState<string | null>(null)
```

Insert this branch immediately **before** the `if (session)` signed-in return (line 79),
and after the `mode === 'check-email'` branch, so it takes precedence over the profile
view but never over the signed-out form:

```tsx
  // Catch-up gate for accounts created before terms were part of signup. Only the
  // profile tab is blocked: the browsing tabs stay open, matching the web gate, which
  // leaves /library and public tutorial pages reachable.
  if (session && !hasContributorTerms) {
    return (
      <Screen>
        <ScreenHeader title="Profile" showLogo />
        <Card>
          <Text style={styles.heading}>Before you continue</Text>
          <Text style={styles.checkEmailText}>
            Your account was created before we asked contributors to accept terms.
            These terms have not been written yet, and anything you accept now is not
            binding.
          </Text>
          <Pressable
            testID="gate-accept-checkbox"
            onPress={() => setGateTicked((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: gateTicked }}
            style={styles.termsRow}
          >
            <Ionicons
              name={gateTicked ? 'checkbox' : 'square-outline'}
              size={22}
              color={theme.colors.primary}
            />
            <Text style={styles.termsText}>
              I have read and accept the contributor terms.
            </Text>
          </Pressable>
          {gateError ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
              <Text style={styles.error}>{gateError}</Text>
            </View>
          ) : null}
          <Button
            label="Accept and continue"
            disabled={!gateTicked}
            onPress={async () => {
              const res = await acceptContributorTerms()
              setGateError(res.error)
            }}
          />
        </Card>
      </Screen>
    )
  }
```

`Button` takes `label`, not `title`, and already accepts `disabled?: boolean`
(`components/ui/Button.tsx:28-40`). `styles.heading`, `styles.checkEmailText`,
`styles.errorRow` and `styles.error` all already exist in this file; `termsRow` and
`termsText` were added in Task 7.

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm --filter @splat-connect/mobile test:unit -- profile-screen`
Expected: PASS.

- [ ] **Step 5: Typecheck the workspace**

Run: `pnpm -r typecheck`
Expected: PASS across api, web, mobile and types.

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/components/profile-screen.tsx packages/mobile/tests/unit/components/profile-screen.test.tsx
git commit -m "feat(mobile): gate the profile tab on contributor terms"
```

---

### Task 9: Full verification

**Files:** none modified.

- [ ] **Step 1: Run every unit suite**

Run: `pnpm --filter @splat-connect/web test:unit && pnpm --filter @splat-connect/mobile test:unit`
Expected: all pass.

- [ ] **Step 2: Run the web e2e suite**

Run: `pnpm --filter @splat-connect/web test:e2e`
Expected: all pass, including the four new specs from Task 5.

Do not run this with an Android emulator running — qemu can bind Supabase's ports on
`::1` and the failures will look like broken Docker.

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm -r typecheck && pnpm --filter @splat-connect/web lint`
Expected: clean.

- [ ] **Step 4: Confirm the original bug is fixed against real data**

With both dev servers up, sign in as the account that reported the bug, accept at
`/onboarding/contributor-terms`, then edit tutorial
`ae3b69c7-39e7-4bce-a7b3-f0721d5d9b25` ("Light Up Melody Bear") and save.
Expected: the save succeeds and the status moves to `pending`.

This is the acceptance test for the whole plan — it is the exact action that produced
the original 403.

- [ ] **Step 5: Update the graph**

Run: `graphify update .`
Expected: completes without error (AST-only, no API cost).

- [ ] **Step 6: Commit any remaining changes**

```bash
git status --short
git add -A && git commit -m "chore: refresh knowledge graph after contributor terms work"
```
