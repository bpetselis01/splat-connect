# Project–Organisation Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans` to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Spec:** `docs/superpowers/specs/2026-07-28-project-org-collaboration-design.md` (§4)

**Prerequisites:** `2026-07-28-project-org-schema-rls.md` and
`2026-07-28-project-org-api.md`, both executed. Every endpoint this plan calls
exists and is tested.

**Goal:** Give each role the screens for the flow the API already supports — an
author asks organisations to back a project, a leader accepts and reviews, the
admin creates organisations and spot-checks what leaders published, and a parent
sees who backed a tutorial and who approved it.

**Architecture:** Server components calling `apiClient` with server actions for
writes, following `app/admin/review/[id]/page.tsx`. Client components only where
there is real interaction — the terms gate and the backing picker. `/org/*` cannot
be role-gated in middleware, so each org page checks leadership server-side.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Vitest 2 +
Testing Library, Playwright for E2E.

## Global Constraints

- Work on `feat/org-accounts-schema-rls` in `.worktrees/org-accounts-schema-rls`.
- Server components use `apiClient` (`lib/api-client.ts`, cookie-authed). Client
  components use `browserApiClient`. Never call Supabase directly from a page.
- Writes are **server actions** with `'use server'` and `revalidatePath`, matching
  `app/admin/review/[id]/page.tsx:8-27`.
- **Every gate in this plan is a UX affordance, not a security control.** The
  database refuses the same writes regardless. Where a control is disabled, it is
  disabled because the database would refuse it — never instead of the database
  refusing it.
- Follow the existing card/list structure and empty-state treatment
  (`empty-badge` + heading + one-line explanation) rather than inventing a layout.
- New copy is British English, matching the existing pages.
- **One file per commit**, ordered so each commit stands alone.
- Commit messages end with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## File Structure

| File | Responsibility |
|---|---|
| `packages/web/lib/org-access.ts` | **Create.** Server-side leadership check for `/org/*`. |
| `packages/web/middleware.ts` | **Modify.** Add `/org` and `/organizations` to the logged-in list. |
| `packages/web/app/legal/contributor-terms/page.tsx` | **Create.** Empty, with a TODO. Spec §6. |
| `packages/web/app/legal/org-leader-terms/page.tsx` | **Create.** Empty, with a TODO. |
| `packages/web/components/terms-gate.tsx` | **Create.** Reusable acceptance control. |
| `packages/web/components/org-badges.tsx` | **Create.** The backing badge row, used on the public page and the card. |
| `packages/web/app/org/[orgId]/page.tsx` | **Create.** Leader dashboard: incoming requests + review queue. |
| `packages/web/app/org/[orgId]/review/[tutorialId]/page.tsx` | **Create.** Approve / reject. |
| `packages/web/app/admin/organizations/page.tsx` | **Create.** Create, suspend, manage leaders. |
| `packages/web/app/admin/spot-check/page.tsx` | **Create.** Sample of leader-approved work. |
| `packages/web/app/admin/review/page.tsx` | **Modify.** Backing state per row + a hide toggle. |
| `packages/web/app/admin/page.tsx` | **Modify.** Two more cards. |
| `packages/web/app/upload/page.tsx` | **Modify.** Backing step + contributor terms before submit. |
| `packages/web/app/dashboard/page.tsx` | **Modify.** Orgs I lead; projects and their backing. |
| `packages/web/app/tutorials/[id]/page.tsx` | **Modify.** Badges + approver line. |
| `packages/web/tests/unit/**` | **Create/modify.** Component and page tests. |
| `packages/web/tests/e2e/contributor/org-backing.spec.ts` | **Create.** One end-to-end journey. |
| `packages/web/tests/e2e/helpers.ts` | **Modify.** `createOrgWithLeader` fixture. |

---

## Task 1: Org access, routing, and the legal stubs

**Files:**
- Create: `packages/web/lib/org-access.ts`
- Modify: `packages/web/middleware.ts:61`
- Create: `packages/web/app/legal/contributor-terms/page.tsx`,
  `packages/web/app/legal/org-leader-terms/page.tsx`

**Interfaces:**
- Produces: `requireOrgLeader(orgId): Promise<Organization>` — redirects to `/` if
  the caller does not lead that organisation. Tasks 3 and 4 call it.

- [ ] **Step 1: Write the access helper**

  ```typescript
  /**
   * Server-Side Org Leadership Check
   *
   * /org/* cannot be gated in middleware the way /admin is. Leadership is
   * per-organisation data, not a role on the profile, so there is nothing for
   * middleware to read without knowing which organisation the URL refers to.
   * Middleware therefore enforces only "logged in", and every org page calls this.
   *
   * This reads GET /api/organizations/mine, which is backed by org_leaders and is
   * the single source of truth for leadership. It deliberately does not infer
   * anything from the profile role: a leader is an ordinary contributor.
   *
   * This is a redirect for UX. The database refuses a non-leader's writes
   * regardless — see the tutorials leader UPDATE policy in 007.
   *
   * Related files:
   * - packages/api/src/routes/organizations.ts: the endpoint behind this
   * - supabase/migrations/007_organizations.sql: org_leaders and is_org_leader()
   */
  import { redirect } from 'next/navigation'
  import { apiClient } from '@/lib/api-client'
  import type { Organization } from '@splat-connect/types'

  export async function requireOrgLeader(orgId: string): Promise<Organization> {
    let mine: Organization[]
    try {
      mine = await apiClient.get<Organization[]>('/api/organizations/mine')
    } catch {
      redirect('/login')
    }
    const org = mine.find((o) => o.id === orgId)
    if (!org) redirect('/')
    return org
  }
  ```

- [ ] **Step 2: Add the routes to middleware**

  In `middleware.ts:61`, extend the contributor list. `/org` and `/organizations`
  need a login, not a role:

  ```typescript
  const contributorRoutes = ['/upload', '/my-tutorials', '/dashboard', '/org', '/organizations']
  ```

  Add a line to the block comment's protected-routes list:

  ```
   * - /org: Signed in only — leadership is per-organisation data, so the page
   *   itself checks it via lib/org-access.ts
  ```

- [ ] **Step 3: Write the legal stubs**

  **No placeholder legal language is to be generated.** Spec §6: the copy needs a
  lawyer, covering jurisdiction-specific liability and TGA / medical-device
  considerations for assistive equipment used by disabled children. Both files:

  ```tsx
  /**
   * Contributor Terms — CONTENT PENDING
   *
   * TODO: real terms, written by a lawyer. Must cover jurisdiction-specific
   * liability and TGA / medical-device considerations for assistive equipment
   * used by disabled children.
   *
   * Two disclosures belong here specifically (spec §6):
   *  1. Offering a project to an organisation lets that organisation's leaders
   *     read the unpublished draft, including if they then decline it.
   *  2. An organisation's leader may approve their own work.
   *
   * Acceptances recorded against version 'v0-todo' are void and should be
   * discarded when real terms land.
   */
  export default function ContributorTermsPage() {
    return (
      <main className="container">
        <h1>Contributor terms</h1>
        <p className="alert alert-warning">
          These terms have not been written yet. Anything you accept here is not
          binding, and will be replaced.
        </p>
      </main>
    )
  }
  ```

  The `org-leader-terms` file is the same shape, with its own TODO naming what a
  leader takes on: publishing on the platform's behalf, and being able to read
  members' unpublished drafts.

- [ ] **Step 4: Verify the app still builds**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/web
  npx tsc --noEmit
  npm run build
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add packages/web/lib/org-access.ts
  git commit -m "feat(web): add the server-side org leadership check"

  git add packages/web/middleware.ts
  git commit -m "feat(web): require a login for the org and organisations routes"

  git add packages/web/app/legal
  git commit -m "feat(web): add empty legal stubs pending real terms"
  ```

---

## Task 2: The terms gate

**Files:**
- Create: `packages/web/components/terms-gate.tsx`
- Modify: `packages/web/app/upload/page.tsx`
- Create: `packages/web/tests/unit/components/terms-gate.test.tsx`

**Interfaces:**
- Produces: `<TermsGate type={AgreementType} onAccepted={() => void} />`. Tasks 3
  and 8 both render it.

- [ ] **Step 1: Write the component**

  ```tsx
  'use client'
  /**
   * Renders an explicit acceptance control for one agreement type and calls
   * onAccepted once the acceptance is recorded. Shared by the submit flow
   * (contributor_terms) and the leader dashboard (org_leader_terms) so the two
   * cannot drift apart.
   *
   * The gate is a UX affordance only. The API refuses an ungated submission and
   * the database refuses an ungated review, whatever this component shows.
   */
  import { useState } from 'react'
  import Link from 'next/link'
  import { browserApiClient } from '@/lib/browser-api-client'
  import type { AgreementType } from '@splat-connect/types'

  const LABELS: Record<AgreementType, { title: string; href: string }> = {
    contributor_terms: { title: 'contributor terms', href: '/legal/contributor-terms' },
    org_leader_terms: { title: 'organisation leader terms', href: '/legal/org-leader-terms' },
  }

  export function TermsGate({
    type,
    onAccepted,
  }: {
    type: AgreementType
    onAccepted: () => void
  }) {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { title, href } = LABELS[type]

    async function accept() {
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
        <p>
          Please read the <Link href={href}>{title}</Link> before continuing.
        </p>
        {error && <p role="alert" className="alert alert-danger mt-3">{error}</p>}
        <button type="button" onClick={accept} disabled={busy} className="btn btn-accent mt-3">
          {busy ? 'Recording…' : `I accept the ${title}`}
        </button>
      </div>
    )
  }
  ```

- [ ] **Step 2: Gate the wizard's submit**

  `app/upload/page.tsx:182` currently patches straight to `pending`. The API now
  returns 403 there without an acceptance, so the wizard must ask first or the user
  sees a bare failure at the end of six steps.

  In the review step, fetch `GET /api/agreements/me` on mount and hold
  `hasContributorTerms` in state. When false, render
  `<TermsGate type="contributor_terms" onAccepted={() => setHasContributorTerms(true)} />`
  above the submit button and disable the button. Extend the existing
  `disabled={!canSubmit(draft) || submitting}` to
  `disabled={!canSubmit(draft) || submitting || !hasContributorTerms}`.

- [ ] **Step 3: Write the component test**

  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest'
  import { render, screen, waitFor } from '@testing-library/react'
  import userEvent from '@testing-library/user-event'
  import { TermsGate } from '@/components/terms-gate'

  const post = vi.fn()
  vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: (...a: unknown[]) => post(...a) } }))

  describe('TermsGate', () => {
    beforeEach(() => vi.clearAllMocks())

    it('records the acceptance and reports it upward', async () => {
      post.mockResolvedValue({})
      const onAccepted = vi.fn()
      render(<TermsGate type="contributor_terms" onAccepted={onAccepted} />)

      await userEvent.click(screen.getByRole('button', { name: /I accept/i }))

      expect(post).toHaveBeenCalledWith('/api/agreements', { agreement_type: 'contributor_terms' })
      await waitFor(() => expect(onAccepted).toHaveBeenCalled())
    })

    it('does not report acceptance when the call fails', async () => {
      // The gate must not let the UI believe an acceptance was recorded when the
      // server never recorded one — the API would then 403 the actual submit and
      // the user would have no idea why.
      post.mockRejectedValue(new Error('nope'))
      const onAccepted = vi.fn()
      render(<TermsGate type="org_leader_terms" onAccepted={onAccepted} />)

      await userEvent.click(screen.getByRole('button', { name: /I accept/i }))

      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
      expect(onAccepted).not.toHaveBeenCalled()
    })

    it('links to the right document per type', () => {
      render(<TermsGate type="org_leader_terms" onAccepted={vi.fn()} />)
      expect(screen.getByRole('link')).toHaveAttribute('href', '/legal/org-leader-terms')
    })
  })
  ```

- [ ] **Step 4: Run and verify**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/web
  npm run test:unit -- terms-gate
  ```

  Expected: 3 passed.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/web/components/terms-gate.tsx
  git commit -m "feat(web): add the reusable terms acceptance gate"

  git add packages/web/tests/unit/components/terms-gate.test.tsx
  git commit -m "test(web): assert the gate reports nothing when recording fails"

  git add packages/web/app/upload/page.tsx
  git commit -m "feat(web): ask for the contributor terms before submit"
  ```

---

## Task 3: The leader dashboard

**Files:**
- Create: `packages/web/app/org/[orgId]/page.tsx`
- Create: `packages/web/components/org-review-banner.tsx`

**Interfaces:**
- Consumes: `requireOrgLeader` (Task 1), `TermsGate` (Task 2),
  `GET /api/organizations/mine`, `GET /api/agreements/me`, and `GET /api/tutorials`
  — the leader's queue needs no special endpoint, because the RLS read grant
  already limits that list to projects offered to an organisation they lead.
- Produces: `<OrgReviewBanner />`, used only here.

- [ ] **Step 1: Write the banner**

  ```tsx
  'use client'
  /**
   * A leader is appointed by the admin rather than opting in, so the first time
   * they arrive here they may not have accepted org_leader_terms. The review grant
   * in 007 requires it, and the check sits in the policy's USING clause — meaning
   * an approve from an unaccepted leader matches zero rows and the API returns 403.
   * Without this banner the buttons look live and fail for no visible reason.
   *
   * This mirrors the grant; it does not enforce it.
   */
  import { useState } from 'react'
  import { useRouter } from 'next/navigation'
  import { TermsGate } from '@/components/terms-gate'

  export function OrgReviewBanner() {
    const [accepted, setAccepted] = useState(false)
    const router = useRouter()
    if (accepted) return null
    return (
      <div className="alert alert-warning">
        <h2>Accept the leader terms to review</h2>
        <p>
          You can see everything offered to your organisation, but you cannot
          approve or reject anything until you accept the leader terms. They cover
          publishing on the platform&apos;s behalf, and the fact that you can read
          members&apos; unpublished drafts.
        </p>
        <TermsGate
          type="org_leader_terms"
          onAccepted={() => {
            setAccepted(true)
            router.refresh()
          }}
        />
      </div>
    )
  }
  ```

- [ ] **Step 2: Write the dashboard**

  Server component. Two lists, both derived from data the leader can already read:

  ```tsx
  import Link from 'next/link'
  import { revalidatePath } from 'next/cache'
  import { apiClient } from '@/lib/api-client'
  import { requireOrgLeader } from '@/lib/org-access'
  import { OrgReviewBanner } from '@/components/org-review-banner'
  import { DifficultyBadge } from '@/components/difficulty-badge'
  import type { Tutorial, TutorialOrg, UserAgreement } from '@splat-connect/types'

  async function acceptBacking(formData: FormData) {
    'use server'
    const tutorialId = formData.get('tutorialId') as string
    const orgId = formData.get('orgId') as string
    await apiClient.post(`/api/tutorials/${tutorialId}/orgs/${orgId}/accept`, {})
    revalidatePath(`/org/${orgId}`)
  }

  async function declineBacking(formData: FormData) {
    'use server'
    const tutorialId = formData.get('tutorialId') as string
    const orgId = formData.get('orgId') as string
    await apiClient.post(`/api/tutorials/${tutorialId}/orgs/${orgId}/decline`, {})
    revalidatePath(`/org/${orgId}`)
  }

  type Backed = Tutorial & { tutorial_orgs?: TutorialOrg[] }

  export default async function OrgDashboard({ params }: { params: Promise<{ orgId: string }> }) {
    const { orgId } = await params
    const org = await requireOrgLeader(orgId)

    // The leader read grant already limits GET /api/tutorials to projects offered
    // to an organisation they lead, so this needs no server-side filter for
    // safety — only for splitting the two lists.
    const [tutorials, agreements] = await Promise.all([
      apiClient.get<Backed[]>('/api/tutorials'),
      apiClient.get<UserAgreement[]>('/api/agreements/me'),
    ])
    const hasTerms = agreements.some((a) => a.agreement_type === 'org_leader_terms')

    const rowFor = (t: Backed) => t.tutorial_orgs?.find((b) => b.org_id === orgId)
    const requests = tutorials.filter((t) => rowFor(t)?.status === 'pending')
    const queue = tutorials.filter(
      (t) => rowFor(t)?.status === 'accepted' && t.status === 'pending',
    )

    return (
      <main className="container">
        <h1>{org.name}</h1>
        {org.status === 'suspended' && (
          <p className="alert alert-danger">
            This organisation is suspended. You can still see its work, but you
            cannot approve or reject anything.
          </p>
        )}
        {!hasTerms && <OrgReviewBanner />}

        <section>
          <h2>Projects asking for your backing ({requests.length})</h2>
          {requests.length === 0 ? (
            <p className="empty-badge">Nothing waiting. Contributors ask by choosing your organisation when they submit.</p>
          ) : (
            <ul>
              {requests.map((t) => (
                <li key={t.id} className="card">
                  <Link href={`/tutorials/${t.id}`}>{t.title}</Link>
                  <DifficultyBadge difficulty={t.difficulty} />
                  <p>{t.description}</p>
                  <form action={acceptBacking}>
                    <input type="hidden" name="tutorialId" value={t.id} />
                    <input type="hidden" name="orgId" value={orgId} />
                    <button type="submit" className="btn btn-accent">Back this project</button>
                  </form>
                  <form action={declineBacking}>
                    <input type="hidden" name="tutorialId" value={t.id} />
                    <input type="hidden" name="orgId" value={orgId} />
                    <button type="submit" className="btn">Decline</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>Waiting for your review ({queue.length})</h2>
          {queue.length === 0 ? (
            <p className="empty-badge">Nothing to review.</p>
          ) : (
            <ul>
              {queue.map((t) => (
                <li key={t.id} className="card">
                  {hasTerms && org.status === 'active' ? (
                    <Link href={`/org/${orgId}/review/${t.id}`}>{t.title}</Link>
                  ) : (
                    <span>{t.title}</span>
                  )}
                  <DifficultyBadge difficulty={t.difficulty} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    )
  }
  ```

  Backing a project and reviewing it are deliberately separate: accepting is a
  commitment to look, not a verdict.

- [ ] **Step 3: Verify manually**

  Appoint yourself a leader through `/admin/organizations` (Task 5), have a
  contributor ask your organisation, and confirm the request appears. Accept it and
  confirm it moves to the review list. Before accepting the leader terms, confirm
  the review link is not a link.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/web/components/org-review-banner.tsx
  git commit -m "feat(web): add the leader terms banner"

  git add packages/web/app/org/[orgId]/page.tsx
  git commit -m "feat(web): add the leader dashboard"
  ```

---

## Task 4: The leader review screen

**Files:**
- Create: `packages/web/app/org/[orgId]/review/[tutorialId]/page.tsx`

- [ ] **Step 1: Read the page you are following**

  ```bash
  cat packages/web/app/admin/review/\[id\]/page.tsx
  ```

  Match its structure: two server actions at the top, `notFound()` on a bad fetch,
  the same detail layout. The differences are the endpoint (`POST
  /api/tutorials/:id/review` rather than the admin status endpoint), the required
  note, and the `org_id` in the body.

- [ ] **Step 2: Write the page**

  ```tsx
  import { notFound, redirect } from 'next/navigation'
  import { revalidatePath } from 'next/cache'
  import { apiClient } from '@/lib/api-client'
  import { requireOrgLeader } from '@/lib/org-access'
  import { DifficultyBadge } from '@/components/difficulty-badge'
  import type { TutorialWithDetails } from '@splat-connect/types'

  async function approve(formData: FormData) {
    'use server'
    const tutorialId = formData.get('tutorialId') as string
    const orgId = formData.get('orgId') as string
    // org_id is always sent, even when the leader backs the project through only
    // one organisation: the API requires it when several of theirs back the same
    // project, and the URL already knows which queue this is.
    await apiClient.post(`/api/tutorials/${tutorialId}/review`, { status: 'approved', org_id: orgId })
    revalidatePath(`/org/${orgId}`)
    revalidatePath('/library')
    redirect(`/org/${orgId}`)
  }

  async function reject(formData: FormData) {
    'use server'
    const tutorialId = formData.get('tutorialId') as string
    const orgId = formData.get('orgId') as string
    const note = ((formData.get('note') as string) ?? '').trim()
    // Mirrors the API, which 400s on an empty note. A rejection with no reason
    // gives the contributor nothing to act on.
    if (!note) return
    await apiClient.post(`/api/tutorials/${tutorialId}/review`, {
      status: 'rejected',
      org_id: orgId,
      rejection_note: note,
    })
    revalidatePath(`/org/${orgId}`)
    redirect(`/org/${orgId}`)
  }

  export default async function OrgReviewPage({
    params,
  }: {
    params: Promise<{ orgId: string; tutorialId: string }>
  }) {
    const { orgId, tutorialId } = await params
    await requireOrgLeader(orgId)

    let tutorial: TutorialWithDetails
    try {
      tutorial = await apiClient.get<TutorialWithDetails>(`/api/tutorials/${tutorialId}`)
    } catch {
      notFound()
    }
    if (tutorial!.status !== 'pending') notFound()

    return (
      <main className="container">
        <h1>{tutorial!.title}</h1>
        <DifficultyBadge difficulty={tutorial!.difficulty} />
        <p>{tutorial!.description}</p>
        {tutorial!.tutorial_pdf_url && (
          <p><a href={tutorial!.tutorial_pdf_url} target="_blank" rel="noreferrer">Open the tutorial PDF</a></p>
        )}

        <form action={approve}>
          <input type="hidden" name="tutorialId" value={tutorialId} />
          <input type="hidden" name="orgId" value={orgId} />
          <button type="submit" className="btn btn-accent">Approve and publish</button>
        </form>

        <form action={reject}>
          <input type="hidden" name="tutorialId" value={tutorialId} />
          <input type="hidden" name="orgId" value={orgId} />
          <label htmlFor="note">Why are you rejecting this?</label>
          <textarea id="note" name="note" required rows={4} />
          <p className="hint">The contributor sees this. It is required.</p>
          <button type="submit" className="btn">Reject</button>
        </form>
      </main>
    )
  }
  ```

- [ ] **Step 3: Verify manually**

  Approve a project and confirm it appears in `/library` with your organisation's
  badge. Reject one and confirm the note reaches the contributor's dashboard.

- [ ] **Step 4: Commit**

  ```bash
  git add "packages/web/app/org/[orgId]/review/[tutorialId]/page.tsx"
  git commit -m "feat(web): add the leader review screen"
  ```

---

## Task 5: Admin organisations page

The only surface in the product that creates an organisation or grants leadership.

**Files:**
- Create: `packages/web/app/admin/organizations/page.tsx`

- [ ] **Step 1: Write the page**

  Server component listing `GET /api/organizations`, with four server actions.

  ```tsx
  async function createOrg(formData: FormData) {
    'use server'
    await apiClient.post('/api/admin/organizations', {
      name: formData.get('name'),
      description: formData.get('description') || null,
      leader_user_id: formData.get('leader_user_id'),
    })
    revalidatePath('/admin/organizations')
    revalidatePath('/admin')
  }

  async function setStatus(formData: FormData) {
    'use server'
    const id = formData.get('id') as string
    await apiClient.patch(`/api/admin/organizations/${id}`, { status: formData.get('status') })
    revalidatePath('/admin/organizations')
  }

  async function addLeader(formData: FormData) {
    'use server'
    const id = formData.get('orgId') as string
    await apiClient.post(`/api/admin/organizations/${id}/leaders`, { user_id: formData.get('user_id') })
    revalidatePath('/admin/organizations')
  }

  async function removeLeader(formData: FormData) {
    'use server'
    const id = formData.get('orgId') as string
    await apiClient.delete(`/api/admin/organizations/${id}/leaders/${formData.get('user_id')}`)
    revalidatePath('/admin/organizations')
  }
  ```

  The page body:

  - A **create form**: name, description, and a leader `<select>` populated from
    `GET /api/admin/contributors`. The leader field is required — the API 400s
    without it, and an organisation with no leader can answer nothing. Say so in
    the field's hint rather than letting the 400 be the explanation.
  - Submit copy states plainly that **creating the organisation grants review
    authority immediately** — status `active` is set on create, there is no second
    approve step.
  - Each organisation row: name, status, leader count, a suspend/reactivate button,
    and its leaders with a remove button plus an add-leader `<select>`.
  - Only contributors appear in both pickers: the API 400s on a `parent`-role
    leader, because a parent-role leader is treated as logged out by every org page
    via `getUserRole()`.

- [ ] **Step 2: Verify manually**

  Create an organisation with a leader, confirm that leader can immediately reach
  `/org/[orgId]`. Remove them and confirm the page redirects to `/`.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/web/app/admin/organizations/page.tsx
  git commit -m "feat(web): add admin organisation and leadership management"
  ```

---

## Task 6: Spot-check and the admin hub

**Files:**
- Create: `packages/web/app/admin/spot-check/page.tsx`
- Modify: `packages/web/app/admin/page.tsx:52-70`

- [ ] **Step 1: Write the spot-check page**

  Server component over `GET /api/admin/spot-check`. Each row: title, the backing
  organisations, who approved it, the review date, and a link to the tutorial.
  Explain the sampling in one line so an absent tutorial does not read as an
  omission:

  > A random sample of tutorials approved by organisation leaders rather than by
  > you. Refresh for a different sample.

  State why the page exists, because it is not obvious from the rows: with no
  self-review block a leader may publish their own work, so sampling is the only
  way a bad approval surfaces before someone reports it.

- [ ] **Step 2: Add two cards to the hub**

  Extend the `cards` array in `app/admin/page.tsx` and the `Promise.all` above it:

  ```typescript
      {
        label: 'Organisations',
        count: organizations.length,
        href: '/admin/organizations' as const,
        icon: '🏢',
        hint: 'Create organisations, appoint leaders, suspend',
      },
      {
        label: 'Spot-check',
        count: spotCheck.length,
        href: '/admin/spot-check' as const,
        icon: '🔍',
        hint: 'Audit tutorials that org leaders approved',
      },
  ```

  ```typescript
  const [tutorials, contributors, organizations, spotCheck] = await Promise.all([
    apiClient.get<Tutorial[]>('/api/admin/tutorials?status=pending'),
    apiClient.get<Profile[]>('/api/admin/contributors'),
    apiClient.get<Organization[]>('/api/organizations'),
    apiClient.get<Tutorial[]>('/api/admin/spot-check'),
  ])
  ```

  The grid is already `sm:grid-cols-2`, so four cards need no layout change.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/web/app/admin/spot-check/page.tsx
  git commit -m "feat(web): add the admin spot-check page"

  git add packages/web/app/admin/page.tsx
  git commit -m "feat(web): link organisations and spot-check from the admin hub"
  ```

---

## Task 7: Backing state in the admin queue

**Files:**
- Modify: `packages/web/app/admin/review/page.tsx`
- Create: `packages/web/tests/unit/pages/admin-review.test.tsx`

- [ ] **Step 1: Show who is handling each row**

  `GET /api/admin/tutorials` now embeds `tutorial_orgs`. Each row gains a line:

  ```tsx
  {accepted.length > 0 && (
    <p className="hint">
      {accepted.map((b) => b.organizations?.name).join(', ')} accepted — awaiting their review
    </p>
  )}
  ```

  where `accepted = tutorial.tutorial_orgs?.filter((b) => b.status === 'accepted') ?? []`.

  Add a "Hide ones an organisation is handling" checkbox, **defaulting to off**, as
  a `searchParams`-driven filter (`?mine=1`) so it needs no client component:

  ```tsx
  const rows = searchParams.mine === '1'
    ? tutorials.filter((t) => !(t.tutorial_orgs ?? []).some((b) => b.status === 'accepted'))
    : tutorials
  ```

  Decision 23: the default shows everything. Delegation removes the obligation to
  act, not the visibility — but a queue that never shrinks does not feel like the
  bottleneck went away, so the filter is one click.

- [ ] **Step 2: Write the test**

  ```tsx
  import { describe, it, expect, vi } from 'vitest'
  import { render, screen } from '@testing-library/react'

  const get = vi.fn()
  vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }))

  const backed = {
    id: 't1', title: 'Backed project', difficulty: 'easy', status: 'pending',
    tutorial_orgs: [{ org_id: 'o1', status: 'accepted', organizations: { id: 'o1', name: 'Riverside Therapy' } }],
  }
  const unbacked = {
    id: 't2', title: 'Platform project', difficulty: 'easy', status: 'pending', tutorial_orgs: [],
  }

  describe('admin review queue', () => {
    it('shows org-handled work by default, and says who has it', async () => {
      get.mockResolvedValue([backed, unbacked])
      const { default: Page } = await import('@/app/admin/review/page')
      render(await Page({ searchParams: Promise.resolve({}) }))

      expect(screen.getByText('Backed project')).toBeInTheDocument()
      expect(screen.getByText('Platform project')).toBeInTheDocument()
      expect(screen.getByText(/Riverside Therapy accepted/)).toBeInTheDocument()
    })

    it('hides org-handled work when the filter is on', async () => {
      get.mockResolvedValue([backed, unbacked])
      const { default: Page } = await import('@/app/admin/review/page')
      render(await Page({ searchParams: Promise.resolve({ mine: '1' }) }))

      expect(screen.queryByText('Backed project')).not.toBeInTheDocument()
      expect(screen.getByText('Platform project')).toBeInTheDocument()
    })
  })
  ```

- [ ] **Step 3: Run and commit**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/web
  npm run test:unit -- admin-review

  git add packages/web/app/admin/review/page.tsx
  git commit -m "feat(web): show backing state in the admin queue"

  git add packages/web/tests/unit/pages/admin-review.test.tsx
  git commit -m "test(web): assert org-handled work stays visible by default"
  ```

---

## Task 8: The backing picker in the submit flow

**Files:**
- Modify: `packages/web/app/upload/page.tsx`

- [ ] **Step 1: Add the step**

  On the review step, above the terms gate from Task 2:

  - Fetch `GET /api/organizations` on mount. List only `status === 'active'` ones
    as selectable; render suspended ones greyed with "currently suspended", so a
    contributor is not left wondering where an organisation went.
  - Multi-select via checkboxes. Default: none selected.
  - Copy above the list, which is doing real work — it is the only place the draft
    exposure is explained at the moment it happens:

    > Ask an organisation to back this project. Their leaders will be able to read
    > it while they decide, including if they say no. Choose the one or two who
    > know your work — you can ask others later.

  - On submit, before the `status: 'pending'` patch at line 182:

    ```typescript
    for (const orgId of selectedOrgIds) {
      await browserApiClient.post(`/api/tutorials/${tutorialId}/orgs`, { org_id: orgId })
    }
    ```

    Sequential rather than `Promise.all`: the endpoint is idempotent on a repeat,
    so a partial failure is safe to retry, and a serial loop keeps the failing
    organisation identifiable.

  - Selecting nothing is valid and must not be treated as an error. That is the
    platform queue, and it is what every existing contributor gets.

- [ ] **Step 2: Verify manually**

  Submit with two organisations selected and confirm both appear as pending on the
  contributor's dashboard and in both leaders' request lists. Submit with none and
  confirm it lands in the admin queue.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/web/app/upload/page.tsx
  git commit -m "feat(web): let contributors ask organisations to back a project"
  ```

---

## Task 9: Dashboard and public badges

**Files:**
- Create: `packages/web/components/org-badges.tsx`
- Modify: `packages/web/app/dashboard/page.tsx`,
  `packages/web/app/tutorials/[id]/page.tsx`
- Create: `packages/web/tests/unit/components/org-badges.test.tsx`

- [ ] **Step 1: Write the badge component**

  ```tsx
  /**
   * The backing badges on a published tutorial.
   *
   * Renders only accepted organisations. A pending or declined request must never
   * appear anywhere public — an organisation's mark belongs only where one of its
   * leaders put it. The API already filters this way, so this is belt and braces
   * rather than the only guard.
   */
  import type { TutorialOrg } from '@splat-connect/types'

  export function OrgBadges({
    backing,
    approvedByName,
    approvedForOrgName,
  }: {
    backing: TutorialOrg[]
    approvedByName?: string | null
    approvedForOrgName?: string | null
  }) {
    const accepted = backing.filter((b) => b.status === 'accepted')
    if (accepted.length === 0 && !approvedByName) return null

    return (
      <div className="org-badges">
        {accepted.length > 0 && (
          <p>
            Backed by{' '}
            {accepted.map((b) => b.organizations?.name).filter(Boolean).join(', ')}
          </p>
        )}
        {approvedByName && (
          <p className="hint">
            Approved by {approvedByName}
            {approvedForOrgName ? `, ${approvedForOrgName}` : ''}
          </p>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 2: Write the test**

  ```tsx
  import { describe, it, expect } from 'vitest'
  import { render, screen } from '@testing-library/react'
  import { OrgBadges } from '@/components/org-badges'

  const row = (name: string, status: 'pending' | 'accepted' | 'declined') => ({
    id: name, tutorial_id: 't', org_id: name, status,
    requested_at: '', responded_at: null, responded_by: null,
    organizations: { id: name, name, description: null, status: 'active' as const, created_by: null, created_at: '', updated_at: '' },
  })

  describe('OrgBadges', () => {
    it('shows accepted orgs and hides pending and declined ones', () => {
      render(<OrgBadges backing={[row('Riverside', 'accepted'), row('Northside', 'pending'), row('Declining', 'declined')]} />)
      expect(screen.getByText(/Riverside/)).toBeInTheDocument()
      expect(screen.queryByText(/Northside/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Declining/)).not.toBeInTheDocument()
    })

    it('names the approver and the org whose authority they used', () => {
      render(<OrgBadges backing={[row('Riverside', 'accepted')]} approvedByName="Sam" approvedForOrgName="Riverside" />)
      expect(screen.getByText('Approved by Sam, Riverside')).toBeInTheDocument()
    })

    it('renders nothing when there is nothing to say', () => {
      const { container } = render(<OrgBadges backing={[row('Northside', 'pending')]} />)
      expect(container).toBeEmptyDOMElement()
    })
  })
  ```

- [ ] **Step 3: Use it on the public tutorial page**

  In `app/tutorials/[id]/page.tsx`, fetch `GET /api/tutorials/:id/orgs` alongside
  the tutorial and render `<OrgBadges />` under the title.

- [ ] **Step 4: Extend the dashboard**

  Add two sections to `app/dashboard/page.tsx`:

  - **Organisations you lead** — from `GET /api/organizations/mine`, each linking
    to `/org/[orgId]`. Render nothing at all when the list is empty; most
    contributors lead nothing and an empty section is noise.
  - **Your projects** — for each, its backing state: "Riverside Therapy is
    deciding", "Backed by Riverside Therapy", "Riverside Therapy declined", with a
    withdraw button on anything not yet approved, posting
    `DELETE /api/tutorials/:id/orgs/:orgId`.

- [ ] **Step 5: Run and commit**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/web
  npm run test:unit

  git add packages/web/components/org-badges.tsx
  git commit -m "feat(web): add the backing badge component"

  git add packages/web/tests/unit/components/org-badges.test.tsx
  git commit -m "test(web): assert only accepted backing renders publicly"

  git add "packages/web/app/tutorials/[id]/page.tsx"
  git commit -m "feat(web): show backing and approver on a published tutorial"

  git add packages/web/app/dashboard/page.tsx
  git commit -m "feat(web): show backing state and led organisations on the dashboard"
  ```

---

## Task 10: One end-to-end journey

**Files:**
- Create: `packages/web/tests/e2e/org-backing.spec.ts`

- [ ] **Step 1: Reuse the existing helpers**

  `tests/e2e/helpers.ts` already exports everything this needs — do not write new
  ones:

  - `createContributor()`, `createAdmin()`, `deleteUser(id)`
  - `createTutorial(contributorId, overrides)` — takes `status`, `withPdf`,
    `withStl`, `toyPhotoUrl`
  - `signIn(page, email, password)`, `uniqueTitle(prefix)`, `adminClient()`

  There is no org helper yet. Add `createOrgWithLeader(leaderId, name)` to
  `helpers.ts` using `adminClient()`, mirroring `createTutorial`'s shape — insert
  the `organizations` row and the `org_leaders` row, and return the org id.

  Specs live in subdirectories by actor (`admin/`, `contributor/`, `public/`), so
  this one goes in `tests/e2e/contributor/` — it starts and ends with a
  contributor's work even though it passes through the other two roles.

  The E2E stack owns ports 3102–3105 and must not be run with an Android emulator
  up: qemu can bind `::1:54321` and shadow Supabase.

- [ ] **Step 2: Write the journey**

  One spec, covering the whole loop rather than each screen. Assert on visible
  text at each step, not on API calls — the API is already covered by 110
  integration tests, and what this proves is that the screens are wired to them.

  ```typescript
  import { test, expect } from '@playwright/test'
  import {
    createContributor, createAdmin, deleteUser, createTutorial,
    signIn, uniqueTitle, createOrgWithLeader, adminClient,
  } from '../helpers'

  test('a project is backed by an organisation and published by its leader', async ({ page }) => {
    const author = await createContributor()
    const leader = await createContributor()
    const admin = await createAdmin()
    const orgId = await createOrgWithLeader(leader.id, 'Riverside Therapy')
    const title = uniqueTitle('Backed')
    const tutorialId = await createTutorial(author.id, { title, status: 'draft' })

    // 1. The author asks the organisation to back it.
    await signIn(page, author.email, author.password)
    await page.goto(`/dashboard`)
    await page.goto(`/upload?id=${tutorialId}`)
    await page.getByRole('button', { name: /I accept the contributor terms/i }).click()
    await page.getByLabel('Riverside Therapy').check()
    await page.getByRole('button', { name: /Submit for review/i }).click()
    await expect(page.getByText(/Riverside Therapy is deciding/i)).toBeVisible()

    // 2. The leader accepts the terms, then backs it.
    await signIn(page, leader.email, leader.password)
    await page.goto(`/org/${orgId}`)
    await expect(page.getByRole('heading', { name: /Accept the leader terms/i })).toBeVisible()
    await page.getByRole('button', { name: /I accept the organisation leader terms/i }).click()
    await page.getByRole('button', { name: /Back this project/i }).click()

    // 3. And approves it.
    await page.getByRole('link', { name: title }).click()
    await page.getByRole('button', { name: /Approve and publish/i }).click()

    // 4. It is public, with the badge and the approver.
    await page.goto(`/tutorials/${tutorialId}`)
    await expect(page.getByText(/Backed by Riverside Therapy/i)).toBeVisible()
    await expect(page.getByText(/Approved by .*Riverside Therapy/i)).toBeVisible()

    // 5. And it reaches the admin's spot-check, because the admin did not approve it.
    await signIn(page, admin.email, admin.password)
    await page.goto('/admin/spot-check')
    await expect(page.getByText(title)).toBeVisible()

    await adminClient().from('organizations').delete().eq('id', orgId)
    await deleteUser(author.id)
    await deleteUser(leader.id)
    await deleteUser(admin.id)
  })
  ```

  The selectors above assume the copy this plan specifies. Where a Task changed
  wording, update the selector rather than the page — the copy is the deliverable,
  the selector follows it.

- [ ] **Step 3: Run and commit**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/web
  npm run test:e2e -- org-backing

  git add packages/web/tests/e2e/helpers.ts
  git commit -m "test(web): add an org fixture builder for E2E"

  git add packages/web/tests/e2e/contributor/org-backing.spec.ts
  git commit -m "test(web): cover the backing and review journey end to end"
  ```

---

## Task 11: Full verification

- [ ] **Step 1: Everything**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  npx supabase db reset
  cd packages/api && npx vitest run -c vitest.integration.config.ts && npx vitest run tests/unit && npx tsc --noEmit
  cd ../web && npm run test:unit && npx tsc --noEmit && npm run build
  ```

- [ ] **Step 2: Refresh the graph and confirm a clean tree**

  ```bash
  cd ../..
  graphify update .
  git status --short
  git log --oneline development..HEAD | head -30
  ```

## Done when

- A contributor can ask organisations to back a project at submit, see each one's
  answer on their dashboard, and withdraw a request.
- A leader can reach `/org/[orgId]` only for organisations they lead, sees requests
  and a review queue, and cannot act until they accept the leader terms.
- The admin can create an organisation with its first leader, appoint and remove
  leaders, suspend, see every pending tutorial with its backing state, and
  spot-check what leaders approved.
- A published tutorial shows the organisations that backed it and who approved it,
  and never shows a pending or declined request.
- Both unit suites, both typechecks, the web build and the E2E journey pass.
