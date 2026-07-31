# Email Confirmation at Signup, and a Real Terms Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn on real email confirmation at signup, fix the terms-acceptance UX so it no longer discards form input or asks twice for no visible reason, add a confirm-password field, and redesign the two ugliest screens in the flow.

**Architecture:** `enable_confirmations = true` moves terms-acceptance recording from signup time to first sign-in, reusing the existing `/onboarding/contributor-terms` gate rather than building a second mechanism — mirroring the pattern `packages/mobile` already shipped. One shared `TermsGate` component (extended, not replaced) renders inside two different shells: a native `<dialog>` on the signup page, and a full-width card on the onboarding page. One shared `ContributorTermsContent` component supplies the (placeholder) terms text everywhere it's needed, so it exists in exactly one place.

**Tech Stack:** Next.js 16.2.6 (App Router), React 19, TypeScript, Vitest + Testing Library (`fireEvent`, not `user-event` — not installed), Playwright, Tailwind v4 tokens from `app/globals.css`.

**Spec:** `docs/superpowers/specs/2026-07-31-email-confirmation-signup-design.md`

## Global Constraints

- `packages/web` only. Do not modify `packages/mobile` or `packages/api`.
- No new dependencies, including test dependencies. `@testing-library/user-event` is not installed — use `fireEvent`.
- Only `supabase/config.toml:232` (under `[auth.email]`) changes. The `enable_confirmations = false` at line 267 is under `[auth.sms]` and is unrelated — do not touch it.
- Tailwind v4: tokens live in the `@theme` block in `app/globals.css`; there is no `tailwind.config.ts`. Real brand tokens already exist — `--color-brand-dark`, `--color-brand-deep`, `--color-brand-soft`, `--color-brand-tint`, `--color-ink`, `--color-muted`, `--color-surface`, `--color-danger` — use them, never raw hex.
- `typedRoutes: true` — every `href` is type-checked against real filesystem routes.
- `TermsGate`'s existing behaviour (default `mode: 'record'`, no `content` prop) must stay byte-for-byte compatible — the org-leader-terms call site (leader dashboard gate, not touched by this plan) depends on it unchanged.
- Terms content stays governed by `2026-07-30-contributor-terms-signup-design.md` decision 8: no placeholder legal language is to be generated. The existing warning paragraph is moved, not rewritten.
- `supabase stop && supabase start` is required after the config change for it to take effect locally — this is a manual step for whoever runs Task 1, not something a test can verify.

---

### Task 1: Shared terms content, config flip, and the legal page

**Files:**
- Modify: `supabase/config.toml:232`
- Create: `packages/web/components/contributor-terms-content.tsx`
- Modify: `packages/web/app/legal/contributor-terms/page.tsx`
- Test: `packages/web/tests/unit/components/contributor-terms-content.test.tsx`

**Interfaces:**
- Produces: `ContributorTermsContent` — a component with no props, rendering the current placeholder warning text. Consumed by Task 2 (via `TermsGate`'s new `content` prop, wired in Tasks 4 and 5) and by this task's own legal page.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/components/contributor-terms-content.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContributorTermsContent } from '@/components/contributor-terms-content'

describe('ContributorTermsContent', () => {
  it('states the terms are not yet binding', () => {
    render(<ContributorTermsContent />)
    expect(screen.getByText(/have not been written yet/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test:unit contributor-terms-content -- --run`
Expected: FAIL — `Cannot find module '@/components/contributor-terms-content'`

- [ ] **Step 3: Create the component**

```tsx
// packages/web/components/contributor-terms-content.tsx
/**
 * The actual (placeholder) contributor-terms text. One copy, three places it
 * renders: the standalone /legal/contributor-terms page, the signup dialog
 * (components/contributor-terms-dialog.tsx), and the onboarding catch-up gate
 * (app/onboarding/contributor-terms/page.tsx) — the latter two via
 * TermsGate's `content` prop.
 *
 * CONTENT PENDING — see app/legal/contributor-terms/page.tsx for the
 * constraints on what belongs here once real terms are written. No
 * placeholder legal language is to be generated here.
 */
export function ContributorTermsContent() {
  return (
    <p className="alert alert-warning">
      These terms have not been written yet. Anything you accept here is not
      binding, and will be replaced.
    </p>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test:unit contributor-terms-content -- --run`
Expected: PASS

- [ ] **Step 5: Wire it into the legal page**

Replace the hardcoded paragraph in `packages/web/app/legal/contributor-terms/page.tsx`:

```tsx
/**
 * Contributor Terms — CONTENT PENDING
 *
 * TODO: real terms, written by a lawyer. Must cover jurisdiction-specific
 * liability and TGA / medical-device considerations for assistive equipment used
 * by disabled children.
 *
 * Two disclosures belong here specifically (spec §6):
 *  1. Offering a project to an organisation lets that organisation's leaders read
 *     the unpublished draft, including if they then decline it.
 *  2. An organisation's leader may approve their own work.
 *
 * Acceptances recorded against version 'v0-todo' are void and should be discarded
 * when real terms land. No placeholder legal language is to be generated here.
 */
import { ContributorTermsContent } from '@/components/contributor-terms-content'

export default function ContributorTermsPage() {
  return (
    <main className="container">
      <h1>Contributor terms</h1>
      <ContributorTermsContent />
    </main>
  )
}
```

- [ ] **Step 6: Flip the config**

In `supabase/config.toml`, under the `[auth.email]` section (line 232 today), change:

```toml
enable_confirmations = false
```

to:

```toml
enable_confirmations = true
```

Do **not** change the `enable_confirmations = false` under `[auth.sms]` further down the file (line 267 today) — different key, unrelated feature.

- [ ] **Step 7: Restart local Supabase and verify manually**

Run: `supabase stop && supabase start`

Verify the config took effect without any web UI changes yet (those come in later tasks) by calling the Auth API directly:

```bash
curl -s -X POST 'http://127.0.0.1:54321/auth/v1/signup' \
  -H "apikey: $(grep anon_key <(supabase status) | awk '{print $NF}')" \
  -H 'Content-Type: application/json' \
  -d '{"email":"confirm-check@example.com","password":"Test1234!"}' | jq '.session'
```

Expected: `null`. Before the config change this returned a populated session object.

- [ ] **Step 8: Run the full unit suite and commit**

Run: `pnpm --filter web test:unit`
Expected: all passing, no regressions (this task touches nothing else yet).

```bash
git add supabase/config.toml packages/web/components/contributor-terms-content.tsx \
  packages/web/app/legal/contributor-terms/page.tsx \
  packages/web/tests/unit/components/contributor-terms-content.test.tsx
git commit -m "feat(web): shared terms content component, enable email confirmations"
```

---

### Task 2: Extend TermsGate with `mode` and `content`

**Files:**
- Modify: `packages/web/components/terms-gate.tsx`
- Test: `packages/web/tests/unit/components/terms-gate.test.tsx`

**Interfaces:**
- Consumes: `ContributorTermsContent` (Task 1), for use only in later tasks' tests/usages — this task itself just accepts a generic `ReactNode`.
- Produces: `TermsGate`'s extended props — `mode?: 'record' | 'local'` (default `'record'`, unchanged behaviour) and `content?: ReactNode` (default `undefined`, unchanged behaviour). Consumed by Task 3 (`mode: 'local'`, `content` set) and Task 5 (`mode` left default, `content` set).

- [ ] **Step 1: Write the failing tests**

Add to the existing `packages/web/tests/unit/components/terms-gate.test.tsx` (do not remove any existing test):

```tsx
  it('mode="local" reports acceptance without calling the API', async () => {
    const onAccepted = vi.fn()
    render(<TermsGate type="contributor_terms" onAccepted={onAccepted} mode="local" />)

    fireEvent.click(screen.getByRole('button', { name: /I accept/i }))

    expect(post).not.toHaveBeenCalled()
    expect(onAccepted).toHaveBeenCalled()
  })

  it('renders a supplied content node instead of the default link line', () => {
    render(
      <TermsGate
        type="contributor_terms"
        onAccepted={vi.fn()}
        content={<p>Custom terms body</p>}
      />
    )

    expect(screen.getByText('Custom terms body')).toBeInTheDocument()
    expect(screen.queryByText(/please read the/i)).not.toBeInTheDocument()
  })

  it('keeps the default link line when no content is supplied', () => {
    render(<TermsGate type="contributor_terms" onAccepted={vi.fn()} />)
    expect(screen.getByText(/please read the/i)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm --filter web test:unit terms-gate -- --run`
Expected: the 3 new tests FAIL (`mode` and `content` are not recognised props yet — TypeScript will also flag this); all existing tests still PASS.

- [ ] **Step 3: Extend the component**

Replace `packages/web/components/terms-gate.tsx` in full:

```tsx
'use client'
/**
 * Renders an explicit acceptance control for one agreement type and calls
 * onAccepted once the acceptance is recorded. Shared by the submit flow
 * (contributor_terms), the leader dashboard (org_leader_terms), the signup
 * terms dialog, and the onboarding catch-up gate — so none of them can drift
 * apart.
 *
 * The gate is a UX affordance only. The API refuses an ungated submission and the
 * database refuses an ungated review, whatever this component shows. It
 * deliberately does NOT call onAccepted when the request fails: telling the UI an
 * acceptance was recorded when the server never recorded one leaves the user
 * facing a 403 they cannot explain.
 *
 * `mode: 'local'` skips the API call entirely and calls onAccepted directly —
 * used only by the signup dialog, where no account exists yet to attach an
 * acceptance to. The real recording happens later, at first sign-in, via the
 * default 'record' mode on the onboarding gate.
 *
 * `content` replaces the default "please read the X" link line with an inline
 * node — used to show the actual terms text in a scrollable box rather than
 * sending the user to a separate page.
 *
 * Related files:
 * - packages/api/src/routes/agreements.ts: the endpoint, which picks the version
 * - components/contributor-terms-content.tsx: the content passed in by the
 *   contributor_terms call sites
 * - app/legal: the documents this links to (empty, pending a lawyer)
 */
import { useState } from 'react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { browserApiClient } from '@/lib/browser-api-client'
import type { AgreementType } from '@splat-connect/types'

// `as const` rather than a Record annotation: Next's typed routes need href to be
// a literal, and a Record<..., { href: string }> widens it away.
const LABELS = {
  contributor_terms: { title: 'contributor terms', href: '/legal/contributor-terms' },
  org_leader_terms: { title: 'organisation leader terms', href: '/legal/org-leader-terms' },
} as const satisfies Record<AgreementType, { title: string; href: string }>

export function TermsGate({
  type,
  onAccepted,
  requireCheckbox = false,
  mode = 'record',
  content,
}: {
  type: AgreementType
  onAccepted: () => void
  requireCheckbox?: boolean
  mode?: 'record' | 'local'
  content?: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticked, setTicked] = useState(false)
  const { title, href } = LABELS[type]

  async function accept() {
    if (mode === 'local') {
      onAccepted()
      return
    }
    setBusy(true)
    setError(null)
    try {
      await browserApiClient.post('/api/agreements', { agreement_type: type })
      onAccepted()
    } catch {
      setError('Could not record your acceptance. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      {content ?? (
        <p>
          Please read the <Link href={href}>{title}</Link> before continuing.
        </p>
      )}
      {error && <p role="alert" className="alert alert-danger mt-3">{error}</p>}
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
      <button type="button" onClick={accept} disabled={busy || (requireCheckbox && !ticked)} className="btn btn-accent mt-3">
        {busy ? 'Recording…' : `I accept the ${title}`}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test:unit terms-gate -- --run`
Expected: all PASS, including the 5 pre-existing tests unchanged.

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm --filter web typecheck`
Expected: clean.

```bash
git add packages/web/components/terms-gate.tsx packages/web/tests/unit/components/terms-gate.test.tsx
git commit -m "feat(web): TermsGate gains local-only mode and inline content"
```

---

### Task 3: The signup terms dialog

**Files:**
- Create: `packages/web/components/contributor-terms-dialog.tsx`
- Modify: `packages/web/app/globals.css`
- Test: `packages/web/tests/unit/components/contributor-terms-dialog.test.tsx`

**Interfaces:**
- Consumes: `TermsGate` (Task 2, `mode="local"`), `ContributorTermsContent` (Task 1).
- Produces: `ContributorTermsDialog` — `{ open: boolean; onClose: () => void; onAccepted: () => void }`. `onClose` fires on Reject, Escape, and a backdrop click — never together with `onAccepted`. Consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/tests/unit/components/contributor-terms-dialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContributorTermsDialog } from '@/components/contributor-terms-dialog'

describe('ContributorTermsDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepting ticks the box, clicks Accept, and calls onAccepted only', () => {
    const onAccepted = vi.fn()
    const onClose = vi.fn()
    render(<ContributorTermsDialog open onClose={onClose} onAccepted={onAccepted} />)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /^I accept/i }))

    expect(onAccepted).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('clicking Reject calls onClose only', () => {
    const onAccepted = vi.fn()
    const onClose = vi.fn()
    render(<ContributorTermsDialog open onClose={onClose} onAccepted={onAccepted} />)

    fireEvent.click(screen.getByRole('button', { name: /reject/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onAccepted).not.toHaveBeenCalled()
  })

  it('a click that lands on the dialog element itself (the backdrop) calls onClose only', () => {
    const onAccepted = vi.fn()
    const onClose = vi.fn()
    render(<ContributorTermsDialog open onClose={onClose} onAccepted={onAccepted} />)

    fireEvent.click(screen.getByRole('dialog'))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onAccepted).not.toHaveBeenCalled()
  })

  it('a click inside the content does not call onClose', () => {
    const onAccepted = vi.fn()
    const onClose = vi.fn()
    render(<ContributorTermsDialog open onClose={onClose} onAccepted={onAccepted} />)

    fireEvent.click(screen.getByRole('checkbox'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('the native cancel event (Escape) calls onClose only', () => {
    const onAccepted = vi.fn()
    const onClose = vi.fn()
    render(<ContributorTermsDialog open onClose={onClose} onAccepted={onAccepted} />)

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onAccepted).not.toHaveBeenCalled()
  })

  it('renders the shared terms content', () => {
    render(<ContributorTermsDialog open onClose={vi.fn()} onAccepted={vi.fn()} />)
    expect(screen.getByText(/have not been written yet/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test:unit contributor-terms-dialog -- --run`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Add the dialog CSS**

In `packages/web/app/globals.css`, in the same `@layer` block as `.shell-drawer` (immediately after the existing `.shell-drawer::backdrop` rule, before that block's closing `}`):

```css
  /* Centered, unlike .shell-drawer's edge anchor — a confirmation dialog, not
     a nav panel. Same backdrop tone for visual consistency between the two
     native <dialog> usages in this app. */
  .terms-dialog {
    margin: auto;
    max-width: 32rem;
    width: calc(100vw - 2rem);
    max-height: calc(100dvh - 4rem);
    overflow-y: auto;
    border: 0;
    border-radius: 0.75rem;
    padding: 1.5rem;
    background: var(--color-surface);
  }

  .terms-dialog::backdrop {
    background: rgb(10 53 80 / 0.5);
  }
```

- [ ] **Step 4: Create the component**

```tsx
// packages/web/components/contributor-terms-dialog.tsx
'use client'
/**
 * The signup-time terms dialog. A native <dialog> (showModal()) wrapping
 * TermsGate in mode="local" — the same pattern already used for the mobile
 * nav drawer in shell-frame.tsx: focus trap, Escape and an inert background
 * come from the platform, not hand-built code.
 *
 * Closing without accepting (Reject, Escape, or a backdrop click) only ever
 * calls onClose. Accepting only ever calls onAccepted. The two must never
 * both fire for the same interaction — see the click handler comment below
 * for why onClose is not also wired to the dialog's native `close` event.
 */
import { useEffect, useRef } from 'react'
import { TermsGate } from './terms-gate'
import { ContributorTermsContent } from './contributor-terms-content'

export function ContributorTermsDialog({
  open,
  onClose,
  onAccepted,
}: {
  open: boolean
  onClose: () => void
  onAccepted: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="terms-dialog"
      onCancel={() => onClose()}
      onClick={(e) => {
        // A click that never reaches the inner div (stopped below) landed on
        // the dialog element itself — for a modal <dialog> that includes
        // clicks on its ::backdrop, which the platform attributes to this
        // element. Deliberately not wired to the native `close` event: this
        // component also closes itself (via the effect above) after Accept,
        // and `close` fires for that too — wiring onClose there would call
        // both onClose and onAccepted for the same accept action.
        if (e.target === ref.current) onClose()
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <TermsGate
          type="contributor_terms"
          requireCheckbox
          mode="local"
          content={<ContributorTermsContent />}
          onAccepted={onAccepted}
        />
        <button type="button" className="btn btn-soft btn-block mt-3" onClick={() => onClose()}>
          Reject
        </button>
      </div>
    </dialog>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter web test:unit contributor-terms-dialog -- --run`
Expected: all 6 PASS.

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm --filter web typecheck`

```bash
git add packages/web/components/contributor-terms-dialog.tsx packages/web/app/globals.css \
  packages/web/tests/unit/components/contributor-terms-dialog.test.tsx
git commit -m "feat(web): signup terms dialog"
```

---

### Task 4: The signup page — confirm password, terms dialog, check-your-email

**Files:**
- Modify: `packages/web/app/signup/page.tsx`
- Modify: `packages/web/tests/unit/app/signup-page.test.tsx`
- Test unaffected, verify only: `packages/web/tests/unit/pages/signup.test.tsx`

**Interfaces:**
- Consumes: `ContributorTermsDialog` (Task 3).

- [ ] **Step 1: Write the failing tests**

Replace `packages/web/tests/unit/app/signup-page.test.tsx` in full:

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

function fillForm({ confirm = 'secret1' }: { confirm?: string } = {}) {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Ada' } })
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.co' } })
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'secret1' } })
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: confirm } })
}

function acceptTermsViaDialog() {
  fireEvent.click(screen.getByRole('button', { name: /read and accept/i }))
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: /^I accept/i }))
}

describe('signup page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signUp.mockResolvedValue({ error: null })
    // Expected under enable_confirmations = true: no session exists yet, so
    // this call fails every time. Signup must not be blocked by that.
    post.mockRejectedValue(new Error('no session'))
  })

  it('keeps submit disabled until the terms dialog is accepted', () => {
    render(<SignupPage />)
    fillForm()

    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled()

    acceptTermsViaDialog()
    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled()
  })

  it('rejecting the terms dialog leaves submit disabled and the row unfilled', () => {
    render(<SignupPage />)
    fillForm()

    fireEvent.click(screen.getByRole('button', { name: /read and accept/i }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))

    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /read and accept/i })).toBeInTheDocument()
  })

  it('typed fields survive opening and closing the terms dialog', () => {
    render(<SignupPage />)
    fillForm()
    acceptTermsViaDialog()

    expect(screen.getByLabelText(/full name/i)).toHaveValue('Ada')
    expect(screen.getByLabelText(/email/i)).toHaveValue('a@b.co')
  })

  it('blocks submission when the passwords do not match', () => {
    render(<SignupPage />)
    fillForm({ confirm: 'different' })
    acceptTermsViaDialog()

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/passwords do not match/i)
    expect(signUp).not.toHaveBeenCalled()
  })

  it('shows check-your-email after a successful signup, with no dashboard link', async () => {
    render(<SignupPage />)
    fillForm()
    acceptTermsViaDialog()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
    )
    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument()
  })

  it('still shows check-your-email when recording the acceptance fails', async () => {
    render(<SignupPage />)
    fillForm()
    acceptTermsViaDialog()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test:unit signup-page -- --run`
Expected: FAIL — no confirm-password field, no "read and accept" button, "you're all set" instead of "check your email".

- [ ] **Step 3: Replace the signup page**

```tsx
// packages/web/app/signup/page.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { browserApiClient } from '@/lib/browser-api-client'
import { ContributorTermsDialog } from '@/components/contributor-terms-dialog'
import { Check } from '@/components/icons'

export default function SignupPage() {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [termsDialogOpen, setTermsDialogOpen] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // enable_confirmations = true (supabase/config.toml:232), so signUp() left
    // no session — this call only records anything if that ever changes for
    // some environment. Deliberately non-fatal either way: the account exists
    // regardless of what happens here, and /onboarding/contributor-terms
    // catches an unrecorded acceptance at first sign-in.
    try {
      await browserApiClient.post('/api/agreements', {
        agreement_type: 'contributor_terms',
      })
    } catch {
      // See comment above — expected to fail every time under this config.
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="mx-auto mt-8 max-w-sm sm:mt-16">
        <div className="card flex flex-col items-center p-6 text-center sm:p-8">
          <span aria-hidden="true" className="empty-badge">
            ✅
          </span>
          <h1 className="mt-4 text-2xl font-bold text-ink">Check your email</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            We&apos;ve sent a confirmation link to <strong>{email}</strong>. Confirm
            your email, then sign in.
          </p>
          <Link href="/login" className="btn btn-soft mt-6">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-8 max-w-sm sm:mt-16">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-ink">Create your account</h1>
        <p className="mt-2 mb-6 text-sm leading-relaxed text-muted">
          One account for everything — browse, contribute, and manage your child&apos;s profile.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="name" className="field-label">Full name</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="email" className="field-label">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="password" className="field-label">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              aria-describedby="password-hint"
            />
            <p id="password-hint" className="mt-1.5 text-xs text-muted">
              At least 6 characters.
            </p>
          </div>
          <div>
            <label htmlFor="confirm-password" className="field-label">Confirm password</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="field"
            />
          </div>
          <button
            type="button"
            onClick={() => setTermsDialogOpen(true)}
            className="flex items-start gap-2 text-left text-sm"
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                acceptedTerms
                  ? 'bg-brand-dark text-white'
                  : 'border border-brand-soft text-transparent'
              }`}
            >
              <Check className="h-3 w-3" />
            </span>
            <span>
              {acceptedTerms ? (
                'Contributor terms accepted'
              ) : (
                <>
                  Read and accept the{' '}
                  <span className="font-semibold text-brand-dark">contributor terms</span>
                </>
              )}
            </span>
          </button>
          {error && (
            <p role="alert" className="alert alert-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !acceptedTerms}
            className="btn btn-accent btn-block mt-2"
          >
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand-dark hover:underline">
          Sign in
        </Link>
      </p>
      <ContributorTermsDialog
        open={termsDialogOpen}
        onClose={() => setTermsDialogOpen(false)}
        onAccepted={() => {
          setAcceptedTerms(true)
          setTermsDialogOpen(false)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test:unit signup-page -- --run`
Expected: all PASS.

- [ ] **Step 5: Verify the unaffected test file stays green**

Run: `pnpm --filter web test:unit -- --run packages/web/tests/unit/pages/signup.test.tsx`
Expected: PASS unchanged — it only checks the heading and button text, both unchanged, and the absence of stale copy this page never had.

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm --filter web typecheck`

```bash
git add packages/web/app/signup/page.tsx packages/web/tests/unit/app/signup-page.test.tsx
git commit -m "feat(web): confirm-password field, terms dialog, check-your-email screen"
```

---

### Task 5: The onboarding page redesign

**Files:**
- Modify: `packages/web/app/onboarding/contributor-terms/page.tsx`
- Modify: `packages/web/tests/unit/app/onboarding-contributor-terms.test.tsx`

**Interfaces:**
- Consumes: `TermsGate` (Task 2, default `mode`, `content` set), `ContributorTermsContent` (Task 1).

- [ ] **Step 1: Write the failing tests**

Add to the top of `packages/web/tests/unit/app/onboarding-contributor-terms.test.tsx`, alongside the existing `post` and `useRouter`/`useSearchParams` mocks (do not remove the 5 existing `safeNext` tests — they still apply unchanged, since `TermsGate` still renders the same checkbox and Accept-button roles):

```tsx
const signOut = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: (...a: unknown[]) => signOut(...a) } }),
}))
```

Add these tests inside the existing `describe` block, and reset `signOut` in the existing `beforeEach` alongside the other mocks:

```tsx
  it('renders the terms content inline, not just a link', () => {
    render(<ContributorTermsOnboarding />)
    expect(screen.getByText(/have not been written yet/i)).toBeInTheDocument()
  })

  it('does not claim the account predates the terms', () => {
    render(<ContributorTermsOnboarding />)
    expect(screen.queryByText(/created before/i)).not.toBeInTheDocument()
  })

  it('offers a sign-out escape hatch', () => {
    render(<ContributorTermsOnboarding />)
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(signOut).toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm --filter web test:unit onboarding-contributor-terms -- --run`
Expected: the 3 new tests FAIL; the 5 existing tests still PASS.

- [ ] **Step 3: Replace the onboarding page**

```tsx
// packages/web/app/onboarding/contributor-terms/page.tsx
'use client'
/**
 * The catch-up gate for any account without a recorded contributor_terms
 * acceptance — both accounts that predate the terms, and every new signup on
 * its first sign-in after confirming email (enable_confirmations = true means
 * no session existed at signup to record one with; see
 * app/signup/page.tsx). Reached only by redirect from middleware.ts, which
 * passes the path the user was blocked from as ?next=.
 *
 * Related files:
 * - middleware.ts: decides who lands here
 * - components/terms-gate.tsx: the acceptance control itself
 * - components/contributor-terms-content.tsx: the terms text shown inline
 * - app/legal/contributor-terms: the same text, as a standalone page
 */
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Route } from 'next'
import { TermsGate } from '@/components/terms-gate'
import { ContributorTermsContent } from '@/components/contributor-terms-content'
import { createClient } from '@/lib/supabase/client'
import { FileText } from '@/components/icons'

/**
 * `next` arrives from the query string, so it is attacker-controllable. Only a
 * same-origin path is honoured: it must start with exactly one '/', which rules
 * out both absolute URLs and protocol-relative '//host' redirects.
 *
 * Backslashes are normalized to forward slashes before the check: browsers treat
 * /\ as an authority separator in special URL schemes, turning /\evil.example
 * into a cross-origin redirect. Normalizing collapses all backslash variants
 * into cases the protocol-relative check already rejects.
 */
function safeNext(raw: string | null): Route<string> {
  if (!raw) return '/dashboard' as Route<string>
  const normalized = raw.replace(/\\/g, '/')
  if (!normalized.startsWith('/') || normalized.startsWith('//')) return '/dashboard' as Route<string>
  return normalized as Route<string>
}

function ContributorTermsForm() {
  const router = useRouter()
  const supabase = createClient()
  const next = safeNext(useSearchParams().get('next'))

  async function signOut() {
    await supabase.auth.signOut()
    // Hard reload, not router.push: a client navigation can leave the server
    // layout still rendering the signed-in shell until a full refresh — same
    // reasoning as the rail's own sign-out (components/rail.tsx).
    window.location.href = '/'
  }

  return (
    <>
      <div className="mt-6 w-full text-left">
        <TermsGate
          type="contributor_terms"
          requireCheckbox
          content={<ContributorTermsContent />}
          onAccepted={() => router.replace(next)}
        />
      </div>
      <button type="button" onClick={signOut} className="mt-4 text-sm text-muted underline">
        Sign out
      </button>
    </>
  )
}

// useSearchParams() requires a Suspense boundary, or `next build` fails to
// prerender this page (it can't statically render something that reads the
// query string). The icon, heading and lead paragraph stay outside the
// boundary so they render immediately rather than waiting on it.
export default function ContributorTermsOnboarding() {
  return (
    <div className="mx-auto mt-8 max-w-lg sm:mt-16">
      <div className="card flex flex-col items-center p-6 text-center sm:p-8">
        <span aria-hidden="true" className="empty-badge text-brand-deep">
          <FileText className="h-8 w-8" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-ink">One thing before you continue</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          Please review and accept the contributor terms to carry on.
        </p>
        <Suspense>
          <ContributorTermsForm />
        </Suspense>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test:unit onboarding-contributor-terms -- --run`
Expected: all 8 PASS (5 existing + 3 new).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm --filter web typecheck`

```bash
git add packages/web/app/onboarding/contributor-terms/page.tsx \
  packages/web/tests/unit/app/onboarding-contributor-terms.test.tsx
git commit -m "feat(web): redesign the onboarding contributor-terms gate"
```

---

### Task 6: The `/auth/confirmed` page

**Files:**
- Modify: `packages/web/app/auth/confirmed/page.tsx` (server component → client component)
- Test: `packages/web/tests/unit/app/auth-confirmed.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/tests/unit/app/auth-confirmed.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import EmailConfirmedPage from '@/app/auth/confirmed/page'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}))

describe('email confirmed page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('tells the user they are being redirected, not just to close the tab', () => {
    render(<EmailConfirmedPage />)
    expect(screen.getByText(/redirecting you to sign in/i)).toBeInTheDocument()
  })

  it('offers an immediate manual sign-in link as a fallback', () => {
    render(<EmailConfirmedPage />)
    expect(screen.getByRole('link', { name: /sign in now/i })).toHaveAttribute('href', '/login')
  })

  it('redirects to /login once the countdown finishes', () => {
    render(<EmailConfirmedPage />)
    expect(replace).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(replace).toHaveBeenCalledWith('/login')
  })

  it('does not redirect before the countdown finishes', () => {
    render(<EmailConfirmedPage />)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(replace).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test:unit auth-confirmed -- --run`
Expected: FAIL — module has no timer/redirect behaviour yet.

- [ ] **Step 3: Replace the page**

```tsx
// packages/web/app/auth/confirmed/page.tsx
'use client'
/**
 * Landing page for the link in Supabase's signup confirmation email
 * (see EXPO_PUBLIC_WEB_URL/auth/confirmed passed as emailRedirectTo in
 * packages/mobile/lib/auth-context.tsx, and app/signup/page.tsx's signUp()
 * call for the web equivalent). Supabase already verifies the token before
 * redirecting here.
 *
 * Shared between platforms — a mobile-app signup also lands here, since
 * deep-linking straight back into a mobile app from an email client isn't
 * reliable. The auto-redirect below sends them into a web sign-in flow they
 * may not want; the manual "Sign in now" link exists for web users who don't
 * want to wait, and doubles as an escape hatch for anyone who'd rather just
 * close the tab.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const REDIRECT_SECONDS = 3

export default function EmailConfirmedPage() {
  const router = useRouter()
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS)

  useEffect(() => {
    if (secondsLeft <= 0) {
      router.replace('/login')
      return
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft, router])

  return (
    <div className="mx-auto mt-8 max-w-sm sm:mt-16">
      <div className="card flex flex-col items-center p-6 text-center sm:p-8">
        <span aria-hidden="true" className="empty-badge">
          ✅
        </span>
        <h1 className="mt-4 text-2xl font-bold text-ink">Email confirmed</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your email has been confirmed. Sign in to your account to continue.
        </p>
        <p className="mt-4 text-xs text-muted" role="status">
          Redirecting you to sign in in {secondsLeft}…
        </p>
        <Link href="/login" className="btn btn-soft mt-4">
          Sign in now
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test:unit auth-confirmed -- --run`
Expected: all 4 PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm --filter web typecheck`

```bash
git add packages/web/app/auth/confirmed/page.tsx packages/web/tests/unit/app/auth-confirmed.test.tsx
git commit -m "feat(web): auth/confirmed tells the user they are being redirected"
```

---

### Task 7: E2E coverage

**Files:**
- Modify: `packages/web/tests/e2e/auth/signup.spec.ts` (full rewrite)
- Modify: `packages/web/tests/e2e/contributor/contributor-terms.spec.ts` (remove one stale test, keep the other three unchanged)

**Interfaces:**
- Consumes: everything from Tasks 1–6, running against the real dev server with `enable_confirmations = true`.

- [ ] **Step 1: Verify no other e2e spec touches `/signup`**

Run: `grep -rl "goto('/signup')" packages/web/tests/e2e`
Expected: only `tests/e2e/auth/signup.spec.ts` and `tests/e2e/contributor/contributor-terms.spec.ts` — already accounted for below. If this turns up a third file, read it and update its form-fill and assertions the same way this task updates the two known files, before continuing.

- [ ] **Step 2: Rewrite `tests/e2e/auth/signup.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { uniqueContributorEmail, createContributor } from '../helpers'

async function acceptTermsViaDialog(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /read and accept/i }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /^I accept/i }).click()
}

test('a new contributor signs up and is told to check their email', async ({ page }) => {
  const email = uniqueContributorEmail()
  await page.goto('/signup')
  await page.locator('#name').fill('E2E Contributor')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill('Test1234!')
  await page.locator('#confirm-password').fill('Test1234!')
  await acceptTermsViaDialog(page)
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()
})

test('a mismatched confirm-password blocks submission', async ({ page }) => {
  await page.goto('/signup')
  await page.locator('#name').fill('E2E Contributor')
  await page.locator('#email').fill(uniqueContributorEmail())
  await page.locator('#password').fill('Test1234!')
  await page.locator('#confirm-password').fill('Different1!')
  await acceptTermsViaDialog(page)
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByRole('alert')).toHaveText(/passwords do not match/i)
  await expect(page.getByRole('heading', { name: 'Check your email' })).toHaveCount(0)
})

test('the terms dialog preserves already-typed fields on close', async ({ page }) => {
  await page.goto('/signup')
  await page.locator('#name').fill('Keeps Typing')
  await page.locator('#email').fill('keeps-typing@example.com')

  await page.getByRole('button', { name: /read and accept/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: /reject/i }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await expect(page.locator('#name')).toHaveValue('Keeps Typing')
  await expect(page.locator('#email')).toHaveValue('keeps-typing@example.com')
  await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled()
})

test('the terms dialog: a backdrop click closes it without accepting', async ({ page }) => {
  await page.goto('/signup')
  await page.getByRole('button', { name: /read and accept/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  // A click on a modal <dialog>'s ::backdrop is attributed to the <dialog>
  // element itself — an absolute corner coordinate lands outside the
  // centered card, on the backdrop.
  await page.mouse.click(5, 5)

  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('button', { name: /read and accept/i })).toBeVisible()
})

test('the terms dialog: Escape closes it without accepting', async ({ page }) => {
  await page.goto('/signup')
  await page.getByRole('button', { name: /read and accept/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('button', { name: /read and accept/i })).toBeVisible()
})

test('an already-registered email shows the error', async ({ page }) => {
  const existing = await createContributor()

  await page.goto('/signup')
  await page.locator('#name').fill('Duplicate Person')
  await page.locator('#email').fill(existing.email)
  await page.locator('#password').fill('Test1234!')
  await page.locator('#confirm-password').fill('Test1234!')
  await acceptTermsViaDialog(page)
  await page.getByRole('button', { name: 'Create account' }).click()

  // Filtered to alerts with content — Next's empty route announcer is also role=alert.
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toHaveCount(0)
})

test('a password under six characters is not accepted', async ({ page }) => {
  await page.goto('/signup')
  await page.locator('#name').fill('Short Password')
  await page.locator('#email').fill(uniqueContributorEmail())
  await page.locator('#password').fill('12345')
  await page.locator('#confirm-password').fill('12345')
  await acceptTermsViaDialog(page)
  await page.getByRole('button', { name: 'Create account' }).click()

  // minLength blocks submission client-side, so the confirmation never renders.
  await expect(page.getByRole('heading', { name: 'Check your email' })).toHaveCount(0)
})
```

- [ ] **Step 3: Remove the stale "instant session" tests from `tests/e2e/contributor/contributor-terms.spec.ts`**

Delete the file's fourth test, `'a new signup never sees the catch-up screen'` — its premise (a fresh public signup gets a session immediately and never sees the gate) is now false by design; every fresh signup sees the gate once, on first sign-in after confirming, which the file's own first three tests already cover via `createContributor()` (a confirmed, terms-unaccepted account). Do not modify the file's other three tests — they provision accounts directly via the service role, never through public `/signup`, so nothing about this plan changes them.

- [ ] **Step 4: Run the full unit suite one more time**

Run: `pnpm --filter web test:unit`
Expected: all passing.

- [ ] **Step 5: Run the affected e2e specs**

Requires the dev server running (`pnpm dev:web` / `pnpm dev:api`) against local Supabase with the Task 1 config change already applied and Supabase restarted.

Run: `pnpm --filter web exec playwright test tests/e2e/auth/signup.spec.ts tests/e2e/contributor/contributor-terms.spec.ts --workers=2`
Expected: all passing.

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm --filter web typecheck`

```bash
git add packages/web/tests/e2e/auth/signup.spec.ts packages/web/tests/e2e/contributor/contributor-terms.spec.ts
git commit -m "test(web e2e): cover the new signup flow, retire the instant-session test"
```
