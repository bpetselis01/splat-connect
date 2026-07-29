# Unified Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One dashboard for every non-admin account, with tabs that appear according to what the user can actually do — author tutorials, vet an organisation's queue, edit a child's profile, edit their own profile.

**Architecture:** Route-based tabs under `/dashboard` sharing a `layout.tsx` that renders the tab strip from `getCapabilities()`. The strip is an affordance; each page re-derives its own access and 404s independently. Three of the four tabs reuse machinery that already exists — only the tab shell, the child-profile web form, and one PATCH endpoint are new.

**Tech Stack:** Next.js 16 App Router + React 19 (server components), Hono (API), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-29-unified-dashboard-design.md`

**Depends on:** `2026-07-29-shared-account-foundation.md` and `2026-07-29-auth-entry-flow.md`, both complete and merged. Every task here reads `getCapabilities()` from sub-project 1, and Task 4 relies on the `profiles_freeze_identity` trigger existing before a profile-editing UI does.

## Global Constraints

- **Leader authority is unchanged.** Decisions 11 and 12 of `007_organizations.sql` stand: only an admin renames, suspends, or deletes an organisation, and only an admin grants leadership. This sub-project surfaces a vetting queue. Do not add an org write endpoint or an org write policy.
- `/organizations/[id]` and `/organizations/[id]/projects/[tutorialId]` keep their paths and behaviour. They remain the per-organisation deep link and the review screen.
- The tab strip hides tabs; each page independently checks and calls `notFound()`. Never rely on the strip as the control — `lib/org-access.ts` states the rule: *"An affordance, not a control: the database refuses a non-leader's writes whatever this returns."*
- The Profile tab edits `name` only. `email` is displayed read-only and `role` is not editable — both are frozen by the `profiles_freeze_identity` trigger from sub-project 1.
- The child-profile web form saves explicitly. Do NOT port mobile's autosave.
- Do NOT port mobile's MACS/BFMF estimator. Web enters values directly and `macs_source` / `bfmf_source` stay `'manual'`.
- `child_profiles.parent_id` remains unique — one child profile per account. No multi-child UI.
- No mobile changes in this sub-project.
- Use `127.0.0.1`, not `localhost`, for Supabase URLs locally. Do not run Playwright with an Android emulator running.
- Every commit message ends with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## Commands

| Purpose | Command |
|---|---|
| API integration tests | `cd packages/api && pnpm test:integration` |
| Web unit tests | `cd packages/web && pnpm test:unit` |
| Web E2E | `cd packages/web && pnpm test:e2e` |
| Typecheck | `pnpm typecheck` |

## File Structure

| File | Responsibility |
|---|---|
| `packages/api/src/routes/contributors.ts` (modify) | Add `PATCH /me`; fix a header that already claims it exists |
| `packages/web/app/dashboard/layout.tsx` (create) | Tab strip from capabilities |
| `packages/web/components/dashboard-tabs.tsx` (create) | The strip itself, presentational |
| `packages/web/app/dashboard/page.tsx` (modify) | Tutorials tab — existing body, minus the led-orgs block |
| `packages/web/app/dashboard/profile/page.tsx` (create) | Profile tab |
| `packages/web/components/profile-form.tsx` (create) | Name field + save |
| `packages/web/app/dashboard/organisation/page.tsx` (create) | Merged leader queue |
| `packages/web/app/dashboard/child/page.tsx` (create) | Child profile tab |
| `packages/web/components/child-profile-form.tsx` (create) | The three-section form |
| `packages/web/components/nav.tsx` (modify) | Collapse the link list |

---

### Task 1: A user can change their own name

**Files:**
- Modify: `packages/api/src/routes/contributors.ts`
- Test: `packages/api/tests/integration/contributors/patch-me.test.ts` (create)

**Interfaces:**
- Produces: `PATCH /api/contributors/me`, body `{ name?: string }`, returns the updated `Profile` as JSON. Task 4 consumes it.

**Context for the implementer:** the file header already reads *"Contributor profile routes: GET/PATCH /api/contributors/me. Only name and email are mutable."* — but there is no PATCH handler, and after sub-project 1 email is frozen. The comment describes an endpoint that never existed and a rule that is now wrong. Fix both.

Follow the whitelist idiom `child-profile.ts:27` already establishes: an `EDITABLE` array, everything else in the body ignored. Write through `createUserClient` so the `"User can update own profile"` policy and the freeze trigger are the boundary, matching every other write route here.

- [ ] **Step 1: Write the failing test**

Create `packages/api/tests/integration/contributors/patch-me.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let user: TestUser
let other: TestUser

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  },
})

beforeAll(async () => {
  user = await createTestUser('contributor')
  other = await createTestUser('contributor')
})

afterAll(async () => {
  await deleteTestUser(user.id)
  await deleteTestUser(other.id)
})

describe('PATCH /api/contributors/me', () => {
  it('updates the caller name', async () => {
    const res = await app.request(
      '/api/contributors/me',
      authed(user.token, { method: 'PATCH', body: JSON.stringify({ name: 'Ada Lovelace' }) })
    )

    expect(res.status).toBe(200)
    const saved = (await res.json()) as { name: string }
    expect(saved.name).toBe('Ada Lovelace')
  })

  // Tests: the column whitelist holds.
  // Chain: role is the escalation path closed in 009. The endpoint must not
  //        become a second route to it, and must not fail loudly either — the
  //        body value is ignored, exactly as PUT /api/child-profile ignores
  //        parent_id.
  it('ignores role and email in the body', async () => {
    const res = await app.request(
      '/api/contributors/me',
      authed(user.token, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Ada', role: 'admin', email: 'attacker@example.com' }),
      })
    )

    expect(res.status).toBe(200)

    const { data } = await adminClient()
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single()
    expect(data?.role).toBe('contributor')
    expect(data?.email).not.toBe('attacker@example.com')
  })

  it('cannot rename another account', async () => {
    await app.request(
      '/api/contributors/me',
      authed(user.token, { method: 'PATCH', body: JSON.stringify({ name: 'Hijacked' }) })
    )

    const { data } = await adminClient().from('profiles').select('name').eq('id', other.id).single()
    expect(data?.name).not.toBe('Hijacked')
  })

  it('rejects a non-object body', async () => {
    const res = await app.request(
      '/api/contributors/me',
      authed(user.token, { method: 'PATCH', body: JSON.stringify(['not', 'an', 'object']) })
    )
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/api && pnpm test:integration -- patch-me
```

Expected: FAIL with `404` — no PATCH handler is registered.

- [ ] **Step 3: Add the handler**

In `packages/api/src/routes/contributors.ts`, add after the `get('/me')` handler:

```ts
// Whitelist of client-editable columns. role and email are frozen by the
// profiles_freeze_identity trigger (009) and are ignored here rather than
// rejected, matching PUT /api/child-profile's handling of parent_id.
const EDITABLE = ['name'] as const

contributors.patch('/me', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Body must be an object' }, 400)
  }

  const patch: Record<string, unknown> = {}
  for (const key of EDITABLE) {
    if (key in body) patch[key] = (body as Record<string, unknown>)[key]
  }

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', c.get('userId'))
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})
```

- [ ] **Step 4: Fix the stale header**

Replace the file's opening comment with:

```ts
/**
 * Contributor profile routes: GET/PATCH /api/contributors/me.
 *
 * Only `name` is mutable. `role` and `email` are frozen by the
 * profiles_freeze_identity trigger (009) — role was an escalation path, and
 * email mirrors auth.users.
 */
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd packages/api && pnpm test:integration -- patch-me
```

Expected: PASS, all four cases.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/contributors.ts \
        packages/api/tests/integration/contributors/patch-me.test.ts
git commit -m "feat(api): let an account edit its own name

The route header already documented a PATCH that was never written.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The tab shell

**Files:**
- Create: `packages/web/components/dashboard-tabs.tsx`
- Create: `packages/web/app/dashboard/layout.tsx`
- Test: `packages/web/tests/unit/components/dashboard-tabs.test.tsx`

**Interfaces:**
- Produces:

```tsx
export type DashboardTab = { href: string; label: string }
export function DashboardTabs({ tabs, pathname }: { tabs: DashboardTab[]; pathname: string })
```

Tasks 3-6 add their routes underneath this layout and rely on it rendering nothing role-specific of its own.

**Context for the implementer:** the strip is presentational and takes the tab list as a prop so it can be unit-tested without mocking fetches. The layout computes the list from `getCapabilities()`.

Tab visibility rules, from the spec:
- **Tutorials** (`/dashboard`) — always. Every signed-in account can author since 009.
- **Organisation** (`/dashboard/organisation`) — only when `ledOrgs.length > 0`. Leadership cannot be self-started; an admin grants it, so an empty state would offer something the visitor cannot obtain.
- **Child profile** (`/dashboard/child`) — always, *including* for non-parents. Gating on `isParent` would mean the only way to create a child profile is to already have one.
- **Profile** (`/dashboard/profile`) — always.

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/unit/components/dashboard-tabs.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardTabs } from '@/components/dashboard-tabs'

const TABS = [
  { href: '/dashboard', label: 'Tutorials' },
  { href: '/dashboard/child', label: 'Child profile' },
  { href: '/dashboard/profile', label: 'Profile' },
]

describe('DashboardTabs', () => {
  it('renders every tab it is given', () => {
    render(<DashboardTabs tabs={TABS} pathname="/dashboard" />)
    expect(screen.getByRole('link', { name: 'Tutorials' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Child profile' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument()
  })

  it('marks the current tab', () => {
    render(<DashboardTabs tabs={TABS} pathname="/dashboard/profile" />)
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Tutorials' })).not.toHaveAttribute('aria-current')
  })

  // Chain: /dashboard is a prefix of every other tab href, so a startsWith match
  //        would mark Tutorials current on every page.
  it('does not mark the index tab current on a sub-tab', () => {
    render(<DashboardTabs tabs={TABS} pathname="/dashboard/child" />)
    expect(screen.getByRole('link', { name: 'Tutorials' })).not.toHaveAttribute('aria-current')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/web && pnpm test:unit -- dashboard-tabs
```

Expected: FAIL — `Cannot find module '@/components/dashboard-tabs'`.

- [ ] **Step 3: Write the strip**

Create `packages/web/components/dashboard-tabs.tsx`:

```tsx
/**
 * The dashboard tab strip. Presentational: it receives the tabs it should show
 * rather than deriving them, so it can be tested without mocking capability
 * fetches, and so the decision about who sees what lives in one place
 * (app/dashboard/layout.tsx).
 *
 * An affordance, not a control. Each tab page re-checks its own access and
 * 404s — see lib/org-access.ts for the same rule stated about organisations.
 */
import Link from 'next/link'

export type DashboardTab = { href: string; label: string }

export function DashboardTabs({
  tabs,
  pathname,
}: {
  tabs: DashboardTab[]
  pathname: string
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-line">
      {tabs.map((tab) => {
        // Exact match, not startsWith: /dashboard is a prefix of every other
        // href and would otherwise read as current everywhere.
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href as never}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              active
                ? 'border-brand-dark text-brand-deep'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd packages/web && pnpm test:unit -- dashboard-tabs
```

Expected: PASS, all three.

- [ ] **Step 5: Write the layout**

Create `packages/web/app/dashboard/layout.tsx`:

```tsx
/**
 * Shared shell for every dashboard tab. One dashboard serves every non-admin
 * account; which tabs appear is derived from what the user can do rather than
 * from a role — see lib/capabilities.ts.
 *
 * Related files:
 * - components/dashboard-tabs.tsx: the strip
 * - app/dashboard/organisation: the only tab that is conditionally shown
 */
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getCapabilities } from '@/lib/capabilities'
import { DashboardTabs, type DashboardTab } from '@/components/dashboard-tabs'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  const tabs: DashboardTab[] = [
    { href: '/dashboard', label: 'Tutorials' },
    // Leadership cannot be self-started — an admin grants it — so an empty
    // state here would offer something the visitor cannot obtain.
    ...(caps.ledOrgs.length > 0
      ? [{ href: '/dashboard/organisation', label: 'Organisation' }]
      : []),
    // Shown even to non-parents: gating on isParent would mean the only way to
    // create a child profile is to already have one.
    { href: '/dashboard/child', label: 'Child profile' },
    { href: '/dashboard/profile', label: 'Profile' },
  ]

  const pathname = (await headers()).get('x-pathname') ?? '/dashboard'

  return (
    <div>
      <DashboardTabs tabs={tabs} pathname={pathname} />
      {children}
    </div>
  )
}
```

**Note on `pathname`:** server layouts do not receive the pathname. Confirm how this codebase already solves that before settling on `x-pathname` — `middleware.ts` runs on every non-static request and can set the header. If it does not already, add it there:

```ts
supabaseResponse.headers.set('x-pathname', pathname)
```

If that proves awkward, make `DashboardTabs` a client component using `usePathname()` — `nav.tsx` already uses `usePathname()` this way, so that is the established pattern and is the safer choice. Pick one, and keep the unit test passing by leaving `pathname` an injectable prop.

- [ ] **Step 6: Verify the shell renders**

```bash
cd packages/web && pnpm test:unit && pnpm typecheck
```

Expected: PASS. `/dashboard` now renders the strip above the existing dashboard body.

- [ ] **Step 7: Commit**

```bash
git add packages/web/components/dashboard-tabs.tsx \
        packages/web/app/dashboard/layout.tsx \
        packages/web/tests/unit/components/dashboard-tabs.test.tsx
git commit -m "feat(web): add the dashboard tab shell

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Tutorials becomes a tab

**Files:**
- Modify: `packages/web/app/dashboard/page.tsx:161-177`

**Context for the implementer:** the page body stays as it is — stats strip, recent tutorials, empty state. Only the "Organisations you lead" block at lines 161-177 is removed, because Task 5 replaces it with a tab that shows the queue itself rather than a link to it.

Do not delete the `ledOrgs` fetch yet if the page still uses it elsewhere; check, and remove the fetch too if the block was its only consumer.

- [ ] **Step 1: Remove the led-orgs block**

Delete lines 161-177 of `packages/web/app/dashboard/page.tsx` — the whole `{ledOrgs.length > 0 && (…)}` expression.

Then remove the now-unused fetch and its comment:

```ts
  const ledOrgs = await apiClient
    .get<Organization[]>('/api/organizations/mine')
    .catch(() => [] as Organization[])
```

Remove `Organization` from the type import if nothing else in the file uses it. Run `pnpm typecheck` to confirm.

- [ ] **Step 2: Update the header**

The file header describes the page as the contributor dashboard. Amend it to say it is the Tutorials tab of the shared dashboard, and point at the organisation tab for the leader queue that used to live here.

- [ ] **Step 3: Verify**

```bash
cd packages/web && pnpm test:unit && pnpm typecheck
```

Expected: PASS. If a unit test asserts on "Organisations you lead", move that assertion to Task 5's test rather than deleting it.

- [ ] **Step 4: Commit**

```bash
git add packages/web/app/dashboard/page.tsx
git commit -m "refactor(web): make the dashboard body the Tutorials tab

The led-organisations link block is superseded by the Organisation tab,
which shows the queue instead of pointing at it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The Profile tab

**Files:**
- Create: `packages/web/components/profile-form.tsx`
- Create: `packages/web/app/dashboard/profile/page.tsx`
- Test: `packages/web/tests/unit/components/profile-form.test.tsx`

**Interfaces:**
- Consumes: `PATCH /api/contributors/me` from Task 1; `getCapabilities()` from sub-project 1; `browserApiClient` from `@/lib/browser-api-client` (the same client `TermsGate` uses for client-side writes).
- Produces: `/dashboard/profile`.

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/unit/components/profile-form.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileForm } from '@/components/profile-form'

const patch = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { patch: (...args: unknown[]) => patch(...args) },
}))

const PROFILE = { id: 'u1', name: 'Ada', email: 'ada@example.com', role: 'contributor' as const }

beforeEach(() => patch.mockReset())

describe('ProfileForm', () => {
  it('saves a changed name', async () => {
    patch.mockResolvedValue({ ...PROFILE, name: 'Ada Lovelace' })
    render(<ProfileForm profile={PROFILE} />)

    const field = screen.getByLabelText('Full name')
    await userEvent.clear(field)
    await userEvent.type(field, 'Ada Lovelace')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/api/contributors/me', { name: 'Ada Lovelace' })
    )
  })

  // Chain: email mirrors auth.users and is frozen by the 009 trigger. Offering
  //        an editable field would promise something the database refuses.
  it('shows email as read-only', () => {
    render(<ProfileForm profile={PROFILE} />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly')
  })

  it('reports a failed save instead of claiming success', async () => {
    patch.mockRejectedValue(new Error('boom'))
    render(<ProfileForm profile={PROFILE} />)

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/web && pnpm test:unit -- profile-form
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the form**

Create `packages/web/components/profile-form.tsx`:

```tsx
'use client'
/**
 * Account settings. Only `name` is editable: `role` and `email` are frozen by
 * the profiles_freeze_identity trigger (009), so offering fields for them would
 * promise something the database refuses.
 *
 * Related files:
 * - packages/api/src/routes/contributors.ts: PATCH /api/contributors/me
 */
import { useState } from 'react'
import { browserApiClient } from '@/lib/browser-api-client'
import type { Profile } from '@splat-connect/types'

export function ProfileForm({ profile }: { profile: Profile }) {
  const [name, setName] = useState(profile.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await browserApiClient.patch('/api/contributors/me', { name })
      setSaved(true)
    } catch {
      // Deliberately does not set saved: telling the user their name was
      // recorded when the server never recorded it leaves them confused later.
      setError('Could not save your changes. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="card flex max-w-sm flex-col gap-4 p-6">
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
        <input id="email" type="email" readOnly value={profile.email} className="field" />
        <p className="mt-1.5 text-xs text-muted">
          Your email is tied to your sign-in and cannot be changed here.
        </p>
      </div>
      {error && <p role="alert" className="alert alert-danger">{error}</p>}
      {saved && <p className="text-sm font-semibold text-mint-deep">Saved</p>}
      <button type="submit" disabled={busy} className="btn btn-accent mt-2">
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
```

Check that `browserApiClient` exposes `patch`. If it does not, add it alongside its existing `post`, following that file's shape.

- [ ] **Step 4: Write the page**

Create `packages/web/app/dashboard/profile/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { ProfileForm } from '@/components/profile-form'

export default async function ProfileTabPage() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Profile</h1>
      <ProfileForm profile={caps.profile} />
    </div>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd packages/web && pnpm test:unit -- profile-form
pnpm typecheck
```

Expected: PASS, all three.

- [ ] **Step 6: Commit**

```bash
git add packages/web/components/profile-form.tsx \
        packages/web/app/dashboard/profile/page.tsx \
        packages/web/tests/unit/components/profile-form.test.tsx
git commit -m "feat(web): add the profile tab

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: The Organisation tab

**Files:**
- Create: `packages/web/app/dashboard/organisation/page.tsx`
- Test: `packages/web/tests/unit/pages/dashboard-organisation.test.tsx`

**Interfaces:**
- Consumes: `getCapabilities()`; `GET /api/tutorials` (unfiltered); `GET /api/agreements/me`.

**Context for the implementer:** this generalises `app/organizations/[id]/page.tsx` from one organisation to every organisation the caller leads. That page's own header explains why no organisation id is needed:

> Both come from `GET /api/tutorials` with no filter for safety: the leader read grant in 007 already limits that list to projects offered to an organisation the caller leads. The filtering here only splits the two lists.

So the endpoint is already scoped correctly. The per-organisation page narrows the result back down to `orgId`; the tab drops that narrowing and adds an organisation badge per row instead. It is less code than the page it generalises.

Reproduce the existing queue rule exactly (`organizations/[id]/page.tsx:86-97`): a row is waiting when its `tutorial_orgs` status is `pending` (a backing request), or when it is `accepted` and the tutorial status is `pending` (a review request). Oldest first.

Rows link to the existing review screen at `/organizations/{org_id}/projects/{tutorial_id}` — do not build a second one.

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/unit/pages/dashboard-organisation.test.tsx`. Mock `@/lib/capabilities` and `@/lib/api-client` following the style of `tests/unit/pages/admin-organizations.test.tsx`, then assert:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const ORG_A = { id: 'oA', name: 'Splat North', status: 'active' }
const ORG_B = { id: 'oB', name: 'Splat South', status: 'active' }

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor' },
    isAdmin: false,
    isParent: false,
    ledOrgs: [ORG_A, ORG_B],
    canAuthor: true,
  }),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: async (path: string) => {
      if (path === '/api/tutorials') {
        return [
          {
            id: 't1',
            title: 'Older request',
            status: 'draft',
            created_at: '2026-01-01T00:00:00Z',
            tutorial_orgs: [{ id: 'r1', tutorial_id: 't1', org_id: 'oA', status: 'pending' }],
          },
          {
            id: 't2',
            title: 'Newer review',
            status: 'pending',
            created_at: '2026-02-01T00:00:00Z',
            tutorial_orgs: [{ id: 'r2', tutorial_id: 't2', org_id: 'oB', status: 'accepted' }],
          },
          {
            id: 't3',
            title: 'Not mine',
            status: 'pending',
            created_at: '2026-01-15T00:00:00Z',
            tutorial_orgs: [{ id: 'r3', tutorial_id: 't3', org_id: 'oZ', status: 'pending' }],
          },
        ]
      }
      if (path === '/api/agreements/me') return [{ agreement_type: 'org_leader_terms' }]
      throw new Error(`unexpected ${path}`)
    },
  },
}))

const Page = (await import('@/app/dashboard/organisation/page')).default

describe('Organisation tab', () => {
  // Chain: this is the assertion that pins the no-picker decision. A
  //        single-organisation fixture would pass whether or not the queue
  //        merges, so two are used deliberately.
  it('merges the queue across every organisation the user leads', async () => {
    render(await Page())
    expect(screen.getByText('Older request')).toBeInTheDocument()
    expect(screen.getByText('Newer review')).toBeInTheDocument()
  })

  it('names the organisation each row belongs to', async () => {
    render(await Page())
    expect(screen.getByText('Splat North')).toBeInTheDocument()
    expect(screen.getByText('Splat South')).toBeInTheDocument()
  })

  it('excludes work offered to an organisation the user does not lead', async () => {
    render(await Page())
    expect(screen.queryByText('Not mine')).not.toBeInTheDocument()
  })

  it('links a row to the existing review screen', async () => {
    render(await Page())
    expect(screen.getByRole('link', { name: /Older request/ })).toHaveAttribute(
      'href',
      '/organizations/oA/projects/t1'
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/web && pnpm test:unit -- dashboard-organisation
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the page**

Create `packages/web/app/dashboard/organisation/page.tsx`:

```tsx
/**
 * The leader's queue, merged across every organisation they lead.
 *
 * No organisation id and no picker: GET /api/tutorials is already scoped by the
 * leader read grant in 007, so the list arrives correct. app/organizations/[id]
 * narrows that same list back down to one organisation, which is the only reason
 * it needs an id in the URL — this drops the narrowing and badges each row with
 * its organisation instead.
 *
 * Rows link to the existing review screen; the acts of backing and reviewing stay
 * distinguished there, which is where the applicable action is decided.
 *
 * Related files:
 * - app/organizations/[id]/projects/[tutorialId]: the review screen
 * - app/organizations/[id]: the per-organisation deep link, unchanged
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { OrgReviewBanner } from '@/components/org-review-banner'
import { DifficultyBadge } from '@/components/difficulty-badge'
import type { Tutorial, TutorialOrg, UserAgreement } from '@splat-connect/types'

type Backed = Tutorial & { tutorial_orgs?: TutorialOrg[] }

export default async function OrganisationTabPage() {
  const caps = await getCapabilities()
  // The tab strip hides this for a non-leader, but the strip is an affordance —
  // the page is its own control.
  if (!caps || caps.ledOrgs.length === 0) notFound()

  const [tutorials, agreements] = await Promise.all([
    apiClient.get<Backed[]>('/api/tutorials').catch(() => [] as Backed[]),
    apiClient.get<UserAgreement[]>('/api/agreements/me').catch(() => [] as UserAgreement[]),
  ])
  const hasTerms = agreements.some((a) => a.agreement_type === 'org_leader_terms')
  const byId = new Map(caps.ledOrgs.map((o) => [o.id, o]))

  // Same rule as the per-organisation page: a pending row is a request to back;
  // an accepted row on a pending tutorial is a request to review. Oldest first —
  // a leader arrives asking what is oldest, not what kind of thing is oldest.
  const waiting = tutorials
    .flatMap((t) =>
      (t.tutorial_orgs ?? [])
        .filter((row) => byId.has(row.org_id))
        .filter(
          (row) => row.status === 'pending' || (row.status === 'accepted' && t.status === 'pending')
        )
        .map((row) => ({ tutorial: t, row, org: byId.get(row.org_id)! }))
    )
    .sort((a, b) => a.tutorial.created_at.localeCompare(b.tutorial.created_at))

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Organisation</h1>

      {!hasTerms && <OrgReviewBanner />}

      {waiting.length === 0 ? (
        <p className="empty-badge">Nothing waiting on you right now.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {waiting.map(({ tutorial, row, org }) => (
            <li key={row.id}>
              <Link
                href={`/organizations/${org.id}/projects/${tutorial.id}` as never}
                className="card card-link flex flex-wrap items-center gap-3 p-4"
              >
                <span className="font-bold text-ink">{tutorial.title}</span>
                <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-deep">
                  {org.name}
                </span>
                <span className="text-xs font-semibold text-muted">
                  {row.status === 'pending' ? 'Asked you to back it' : 'Waiting on review'}
                </span>
                <DifficultyBadge difficulty={tutorial.difficulty} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

Check `OrgReviewBanner`'s required props before wiring it — it may need the organisation or an `onAccepted` callback. Match its real signature.

If a suspended organisation appears in `ledOrgs`, keep the wording already used at the old `dashboard/page.tsx:169-171` — *"Suspended — you can look, but not approve"* — on those rows.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd packages/web && pnpm test:unit -- dashboard-organisation
pnpm typecheck
```

Expected: PASS, all four.

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/dashboard/organisation/page.tsx \
        packages/web/tests/unit/pages/dashboard-organisation.test.tsx
git commit -m "feat(web): add the organisation tab as one merged leader queue

GET /api/tutorials is already scoped by the leader read grant, so the queue
needs no organisation id and no picker.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The child profile form — shell, save, and Ability

**Files:**
- Create: `packages/web/components/child-profile-form.tsx`
- Create: `packages/web/app/dashboard/child/page.tsx`
- Test: `packages/web/tests/unit/components/child-profile-form.test.tsx`

**Interfaces:**
- Consumes: `GET`/`PUT /api/child-profile`; `ChildProfile` from `@splat-connect/types`.
- Produces: `/dashboard/child`.

**Context for the implementer:** mobile implements this as three screens plus a hub —
`packages/mobile/components/profile/{ability,everyday-needs,customization}-screen.tsx`
and `child-profile-home.tsx`. React Native components cannot be reused, so this is a
re-implementation against the same `PUT` contract and the same `ChildProfile` type.

The three groupings are the column groupings in `003_ability_profile.sql:30-55` and in
the `ChildProfile` interface — Ability Profile, Everyday Needs, Customization Metrics.
Keep them as the section boundaries so both clients stay legible against one schema.

This task builds the shell, the save path, and the **Ability Profile** section only.
Task 7 adds the other two.

Do NOT port mobile's autosave (a browser form has no backgrounding problem) and do NOT
port the MACS/BFMF estimator behind *"Answer a few simple questions instead"*
(`ability-screen.tsx:117`). `macs_source` and `bfmf_source` stay `'manual'`.

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/unit/components/child-profile-form.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChildProfileForm } from '@/components/child-profile-form'

const put = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { put: (...args: unknown[]) => put(...args) },
}))

beforeEach(() => put.mockReset())

describe('ChildProfileForm', () => {
  // Chain: gating the tab on isParent would mean the only way to create a child
  //        profile is to already have one. This is the create path.
  it('lets an account with no child profile create one', async () => {
    put.mockResolvedValue({ parent_id: 'u1', age: 7 })
    render(<ChildProfileForm profile={null} />)

    await userEvent.type(screen.getByLabelText('Age'), '7')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/api/child-profile', expect.objectContaining({ age: 7 }))
    )
  })

  it('pre-fills an existing profile', () => {
    render(
      <ChildProfileForm
        profile={{ age: 9, primary_diagnosis: 'Cerebral palsy', macs_level: 'II' } as never}
      />
    )
    expect(screen.getByLabelText('Age')).toHaveValue(9)
    expect(screen.getByLabelText('Primary diagnosis')).toHaveValue('Cerebral palsy')
  })

  it('saves the ability fields', async () => {
    put.mockResolvedValue({})
    render(<ChildProfileForm profile={null} />)

    await userEvent.selectOptions(screen.getByLabelText('MACS level'), 'III')
    await userEvent.selectOptions(screen.getByLabelText('Hand involvement'), 'unilateral')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        '/api/child-profile',
        expect.objectContaining({ macs_level: 'III', hand_involvement: 'unilateral' })
      )
    )
  })

  it('reports a failed save instead of claiming success', async () => {
    put.mockRejectedValue(new Error('boom'))
    render(<ChildProfileForm profile={null} />)

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/web && pnpm test:unit -- child-profile-form
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the form shell with the Ability section**

Create `packages/web/components/child-profile-form.tsx`. Structure it as one client
component holding a `Partial<ChildProfile>` in state, with a `set(key, value)` helper and
a single `save()` posting the whole object to `PUT /api/child-profile` (already an upsert,
so create and update are the same call).

Sections follow the schema groupings. This task implements **Ability Profile**:

| Field | Control | Options |
|---|---|---|
| `age` | number input | — |
| `primary_diagnosis` | text input | — |
| `macs_level` | select | `I`, `II`, `III`, `IV`, `V` |
| `bfmf_score` | select | `1`, `2`, `3`, `4`, `5` |
| `hand_involvement` | select | `bilateral`, `unilateral` |
| `assist_hand` | select | `left`, `right` |

Every control gets a `<label htmlFor>` matching the accessible names the test uses:
`Age`, `Primary diagnosis`, `MACS level`, `BFMF score`, `Hand involvement`, `Assist hand`.

Reuse the existing `field` / `field-label` / `card` / `btn btn-accent` classes — the same
ones `signup/page.tsx` and `profile-form.tsx` use. Do not introduce new styling primitives.

Error handling matches `TermsGate` and `ProfileForm`: on failure show a `role="alert"`
message and do NOT show the saved indicator.

Include a header comment naming the mobile counterparts and stating that the estimator
is deliberately absent.

- [ ] **Step 4: Write the page**

Create `packages/web/app/dashboard/child/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { ChildProfileForm } from '@/components/child-profile-form'
import type { ChildProfile } from '@splat-connect/types'

export default async function ChildTabPage() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  // Null for an account that has not created one. Shown to non-parents on
  // purpose: this form is how someone becomes a parent.
  const profile = await apiClient
    .get<ChildProfile | null>('/api/child-profile')
    .catch(() => null)

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-ink">Child profile</h1>
      <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
        This helps us suggest tutorials that suit your child. Everything is optional
        and only you can see it.
      </p>
      <ChildProfileForm profile={profile} />
    </div>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd packages/web && pnpm test:unit -- child-profile-form
pnpm typecheck
```

Expected: PASS, all four.

- [ ] **Step 6: Commit**

```bash
git add packages/web/components/child-profile-form.tsx \
        packages/web/app/dashboard/child/page.tsx \
        packages/web/tests/unit/components/child-profile-form.test.tsx
git commit -m "feat(web): add the child profile tab with the ability section

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The child profile form — Everyday Needs and Customization

**Files:**
- Modify: `packages/web/components/child-profile-form.tsx`
- Modify: `packages/web/tests/unit/components/child-profile-form.test.tsx`

**Context for the implementer:** the remaining two schema groupings. `challenges` and
`sensory_preferences` are `text[]` with a `not null default '{}'` — they must always be
sent as arrays, never `null`, or the write violates the column constraint.

`needs_arm_attachment` is `boolean not null default false` — send `false`, not `null`.

- [ ] **Step 1: Write the failing test**

Append to `packages/web/tests/unit/components/child-profile-form.test.tsx`:

```tsx
describe('ChildProfileForm — remaining sections', () => {
  it('saves everyday needs', async () => {
    put.mockResolvedValue({})
    render(<ChildProfileForm profile={null} />)

    await userEvent.type(screen.getByLabelText('Other challenges'), 'Tires quickly')
    await userEvent.type(screen.getByLabelText('Grip type'), 'Palmar')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        '/api/child-profile',
        expect.objectContaining({ challenge_other: 'Tires quickly', grip_type: 'Palmar' })
      )
    )
  })

  it('saves customization metrics', async () => {
    put.mockResolvedValue({})
    render(<ChildProfileForm profile={null} />)

    await userEvent.type(screen.getByLabelText('Palm width (mm)'), '52')
    await userEvent.click(screen.getByLabelText('Needs an arm attachment'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        '/api/child-profile',
        expect.objectContaining({ palm_width_mm: 52, needs_arm_attachment: true })
      )
    )
  })

  // Chain: challenges and sensory_preferences are text[] NOT NULL DEFAULT '{}'.
  //        Sending null violates the column.
  it('always sends the array columns as arrays', async () => {
    put.mockResolvedValue({})
    render(<ChildProfileForm profile={null} />)

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      const body = put.mock.calls[0][1] as Record<string, unknown>
      expect(Array.isArray(body.challenges)).toBe(true)
      expect(Array.isArray(body.sensory_preferences)).toBe(true)
      expect(body.needs_arm_attachment).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/web && pnpm test:unit -- child-profile-form
```

Expected: FAIL — the new labels do not exist.

- [ ] **Step 3: Add the two sections**

Extend `child-profile-form.tsx` with:

**Everyday Needs** — `challenges` (multi-select or checkbox group, always an array),
`challenge_other` (text, label `Other challenges`), `grip_type` (text, label `Grip type`),
`env_context` (text, label `Where it is used`).

**Customization Metrics** — `palm_width_mm` (number, label `Palm width (mm)`),
`wrist_circ_mm` (number, label `Wrist circumference (mm)`), `needs_arm_attachment`
(checkbox, label `Needs an arm attachment`), `forearm_length_mm` (number, label
`Forearm length (mm)`), `hand_dominance` (text, label `Hand dominance`),
`sensory_preferences` (checkbox group, always an array).

Initialise state so the three non-nullable columns always have valid values:

```ts
const [form, setForm] = useState<Partial<ChildProfile>>({
  challenges: [],
  sensory_preferences: [],
  needs_arm_attachment: false,
  ...(profile ?? {}),
})
```

Number inputs must send numbers, not strings — coerce on change or on save.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd packages/web && pnpm test:unit -- child-profile-form
pnpm typecheck
```

Expected: PASS, all seven cases across both describe blocks.

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/child-profile-form.tsx \
        packages/web/tests/unit/components/child-profile-form.test.tsx
git commit -m "feat(web): complete the child profile form

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Collapse the nav

**Files:**
- Modify: `packages/web/components/nav.tsx:64-69`
- Modify: `packages/web/tests/unit/components/nav.test.tsx`

**Context for the implementer:** Upload and My Tutorials are now reachable from the
Tutorials tab, so keeping them as nav links duplicates the same destinations. This
supersedes the interim widening made in sub-project 2, Task 2.

Signed-in nav becomes: Library, Dashboard, Organisations (the public directory), and
Admin for admins. `/upload` and `/my-tutorials` keep their routes — only the nav links go.

- [ ] **Step 1: Update the test**

In `packages/web/tests/unit/components/nav.test.tsx`, replace the "shows the contributor
links to a parent" case with:

```tsx
  it('does not duplicate the dashboard tabs in the nav', () => {
    render(<Nav role="contributor" />)
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Upload' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'My Tutorials' })).not.toBeInTheDocument()
  })

  it('keeps the public organisations directory for any signed-in account', () => {
    render(<Nav role="parent" />)
    expect(screen.getByRole('link', { name: 'Organisations' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/web && pnpm test:unit -- nav
```

Expected: FAIL — Upload and My Tutorials are still rendered.

- [ ] **Step 3: Collapse the link list**

In `packages/web/components/nav.tsx`, remove the `/upload` and `/my-tutorials` entries.
The list becomes:

```tsx
  const links = ([
    { href: '/library', label: 'Library', show: true },
    { href: '/organizations', label: 'Organisations', show: role !== null },
    { href: '/admin', label: 'Admin', show: role === 'admin' },
    { href: '/dashboard', label: 'Dashboard', show: role !== null },
  ] as const).filter((l) => l.show)
```

Update the header comment to say the dashboard's own tabs cover upload and my-tutorials.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd packages/web && pnpm test:unit -- nav
```

Expected: PASS.

- [ ] **Step 5: Check the E2E suite for nav-based navigation**

```bash
cd packages/web && grep -rn "name: 'Upload'\|name: 'My Tutorials'" tests/e2e || echo "none"
```

Any hit navigates via a link that no longer exists. Repoint those steps at
`/dashboard` and the Tutorials tab, or at the routes directly.

- [ ] **Step 6: Commit**

```bash
git add packages/web/components/nav.tsx packages/web/tests/unit/components/nav.test.tsx
git commit -m "refactor(web): stop duplicating dashboard tabs in the nav

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: The journeys, end to end

**Files:**
- Create: `packages/web/tests/e2e/dashboard/tabs.spec.ts`

**Context for the implementer:** these are the assertions that prove the three
sub-projects together did what they set out to do. The last one is the whole redesign
in a single journey and currently fails at the RLS layer, not the UI.

Fixtures: `createContributor()`, `createParent()`, `createAdmin()`, `createOrg()`,
`addLeader()` — check `tests/e2e/helpers.ts` for the org helpers' exact names and
signatures before writing.

- [ ] **Step 1: Write the journeys**

Create `packages/web/tests/e2e/dashboard/tabs.spec.ts` covering:

1. **A contributor sees three tabs, not four.** Sign in as a contributor; assert
   Tutorials, Child profile and Profile are present and Organisation is absent.
2. **A leader sees all four, across two organisations.** Create two orgs, add the user
   as leader of both, request backing on a tutorial from each; assert both appear in one
   queue with no picker. This pins the no-picker decision — a one-org fixture would pass
   either way.
3. **A leader reaches the existing review screen from the tab** and approves a tutorial.
4. **A contributor with no child profile creates one** from the Child profile tab, reloads,
   and sees the values persisted. This is the path Task 6's visibility decision keeps open.
5. **A user renames themselves on the Profile tab** and the nav reflects the new name.
6. **A mobile-registered parent signs in on web and uploads a tutorial.** The end-to-end
   proof of all three sub-projects.

- [ ] **Step 2: Run them**

```bash
cd packages/web && pnpm test:e2e -- dashboard/tabs
```

Expected: PASS. Confirm no Android emulator is running first.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/e2e/dashboard/tabs.spec.ts
git commit -m "test(web): assert the unified dashboard across every account type

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Full verification

**Files:** none modified.

- [ ] **Step 1: Reset and run everything**

```bash
supabase db reset
cd packages/api && pnpm test:unit && pnpm test:integration
cd ../web && pnpm test:unit && pnpm test:e2e
cd ../.. && pnpm typecheck && pnpm build
```

Expected: all PASS. Report any failure with its output rather than working around it.

- [ ] **Step 2: Confirm the constraints held**

```bash
cd packages/api && grep -rn "organizations" src/routes/organizations.ts | grep -E "\.(post|patch|put|delete)\(" || echo "no org write endpoint — correct"
grep -rn "org_leaders\|organizations" ../../supabase/migrations/009_*.sql || echo "009 does not touch org policies — correct"
```

Both should report the "correct" line. A hit means leader authority was widened, which
this sub-project explicitly does not do.

- [ ] **Step 3: Update the knowledge graph**

```bash
graphify update .
```

- [ ] **Step 4: Commit any remaining updates**

```bash
git add -A
git commit -m "chore: update the knowledge graph after the dashboard work

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Skip if the tree is clean.
