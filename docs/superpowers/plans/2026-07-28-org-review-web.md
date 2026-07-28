# Org Accounts — Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-28-org-delegated-review-design.md` (§4, §6)
**Requires:** `2026-07-28-org-review-api.md` complete and merged.

**Goal:** Give leaders a dashboard where they can work their org's review queue and
roster, give admins a screen to approve and suspend orgs and spot-check delegated
reviews, and put the org picker plus the terms gate into the submit flow.

**Architecture:** Server components fetching through `apiClient` and mutating through
server actions with `revalidatePath`, exactly as `app/admin/review/[id]/page.tsx`
already does. The one structural departure from `/admin`: `middleware.ts` cannot gate
`/org/*` by role, because leadership is per-org data rather than a role — so middleware
enforces only "logged in" and each org page checks membership server-side.

**Tech Stack:** Next.js 16 (App Router, server components + server actions), React 19,
Tailwind, Playwright.

## Global Constraints

- Server components fetch with `apiClient` (`lib/api-client.ts`); interactive client
  components use `browserApiClient`. Never import `apiClient` into a `'use client'` file.
- Mutations are server actions that call `apiClient` then `revalidatePath` for every
  affected route, matching `app/admin/review/[id]/page.tsx:7-27`.
- Reuse existing styling primitives: `card`, `card-link`, `btn`, `btn-accent`,
  `btn-danger`, `btn-soft`, `field`, `field-label`, `alert alert-danger`, `empty-badge`,
  `text-ink`, `text-muted`. Do not introduce new utility classes.
- Legal content files ship **empty with a TODO comment**. Generate no placeholder legal
  language — see Task 7 and spec §6.
- **One file per commit.** Every commit step below stages exactly one path — never a
  directory. Where a task produces several files, it produces several commits, ordered so
  each stands alone (a component before the page that imports it). Conventional commits
  (`feat(web):`, `fix(web):`, `test(web):`), and the message says what that specific file
  does, not what the task was.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/web/lib/org-access.ts` | **Create.** `requireOrgLeader(orgId)` — the single server-side source of truth for leader-ness. Separate from `lib/auth.ts` because that file answers "what role", and this answers "leader of which org", which is per-org data. |
| `packages/web/middleware.ts` | **Modify.** Add `/org` to the logged-in route list. |
| `packages/web/app/org/[orgId]/page.tsx` | **Create.** Leader dashboard: review queue, join requests, roster. |
| `packages/web/app/org/[orgId]/review/[tutorialId]/page.tsx` | **Create.** Approve/reject a member's tutorial. |
| `packages/web/components/org-roster.tsx` | **Create.** Roster table + invite form. Client component; split out because the dashboard page is otherwise a pure server component and mixing the two makes both harder to follow. |
| `packages/web/app/admin/organizations/page.tsx` | **Create.** Approve, suspend, demote orgs. |
| `packages/web/app/admin/spot-check/page.tsx` | **Create.** Random sample of org-reviewed tutorials + flag toggle. |
| `packages/web/app/admin/page.tsx` | **Modify.** Two more cards in the existing hub. |
| `packages/web/app/dashboard/page.tsx` | **Modify.** Org memberships and pending invites section. |
| `packages/web/components/terms-gate.tsx` | **Create.** Reusable accept-terms control, used by the submit flow (`contributor_terms`) and the leader dashboard (`org_leader_terms`). |
| `packages/web/app/upload/page.tsx` | **Modify.** Org picker on the review step + terms gate before submit. |
| `packages/web/app/organizations/page.tsx` | **Create.** Browse approved orgs and request to join. |
| `packages/web/app/legal/contributor-terms/page.tsx` | **Create, empty.** |
| `packages/web/app/legal/org-leader-terms/page.tsx` | **Create, empty.** |

---

## Task 1: Server-side org access check

**Files:**
- Create: `packages/web/lib/org-access.ts`
- Modify: `packages/web/middleware.ts`

**Interfaces:**
- Produces: `getOrgMembership(orgId): Promise<OrgMember | null>` and
  `requireOrgLeader(orgId): Promise<OrgMember>` (redirects on failure). Consumed by
  every page under `/org/`.

**Why a separate module:** `getUserRole()` in `lib/auth.ts` returns `null` for anything
that is not `admin` or `contributor` — a deliberate fail-closed guard. Leadership is not
a role and must never be routed through it. This file reads `org_members` so leader-ness
has exactly one source of truth.

- [ ] **Step 1: Write the module**

```typescript
/**
 * Server-side organisation access checks.
 *
 * Leadership is per-org data, not a role, so it cannot go through getUserRole()
 * in lib/auth.ts — that function returns null for anything other than
 * 'admin' | 'contributor', and a leader is simply a contributor with a row in
 * org_members. Every /org page calls requireOrgLeader() so there is exactly one
 * place that decides who may see an org's dashboard.
 *
 * This is a genuine server-side gate, not a UX nicety: RLS enforces the same
 * rules again at the database, so a bypass here leaks nothing, but it is what
 * turns "no data" into a redirect rather than a broken page.
 */
import { redirect } from 'next/navigation'
import { apiClient } from './api-client'
import type { OrgMember } from '@splat-connect/types'

export async function getOrgMembership(orgId: string): Promise<OrgMember | null> {
  try {
    const memberships = await apiClient.get<OrgMember[]>('/api/organizations/mine')
    return memberships.find((m) => m.org_id === orgId) ?? null
  } catch {
    return null
  }
}

export async function requireOrgLeader(orgId: string): Promise<OrgMember> {
  const membership = await getOrgMembership(orgId)
  if (!membership || membership.org_role !== 'leader' || membership.status !== 'approved') {
    redirect('/dashboard')
  }
  return membership
}
```

- [ ] **Step 2: Add `/org` and `/organizations` to middleware**

In `packages/web/middleware.ts:63`, extend the existing array:

```typescript
  const contributorRoutes = ['/upload', '/my-tutorials', '/dashboard', '/org', '/organizations']
```

`/org/*` is intentionally **not** added to `adminRoutes`: middleware can only check
role, and leadership is not a role. The per-page `requireOrgLeader()` call is the real gate.

- [ ] **Step 3: Verify the app still builds**

```bash
pnpm --filter @splat-connect/web build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/web/lib/org-access.ts
git commit -m "feat(web): add server-side org leadership check

Leadership is per-org data, not a role, so it cannot go through getUserRole()
— that returns null for anything other than admin or contributor. This gives
leader-ness exactly one source of truth."

git add packages/web/middleware.ts
git commit -m "feat(web): require a signed-in user for /org and /organizations"
```

---

## Task 2: Leader dashboard

**Files:**
- Create: `packages/web/app/org/[orgId]/page.tsx`
- Create: `packages/web/components/org-roster.tsx`

- [ ] **Step 1: Read the pattern you are following**

```bash
cat packages/web/app/admin/page.tsx packages/web/app/admin/review/page.tsx
```

Match the card/list structure and the empty-state treatment (`empty-badge` + a heading +
a one-line explanation) rather than inventing a new layout.

- [ ] **Step 2: Add the leader terms banner**

A leader is promoted by the admin rather than opting in (spec decision 12), so the
first time they arrive here they may not have accepted `org_leader_terms`. The
review grant in `007_organizations.sql` requires it, and it sits in the policy's
`using` clause — meaning an approve from an unaccepted leader matches **zero rows
and returns no error**. Without this banner the button appears to work and
silently does nothing.

Fetch `GET /api/agreements/me` in the server component. When there is no
`org_leader_terms` row:

- Render the queue as normal — the SELECT policy deliberately does not require the
  agreement, so a leader can see what they are being asked to take responsibility
  for before accepting.
- Disable every approve and reject control.
- Render `<TermsGate type="org_leader_terms" />` above the queue, with copy naming
  the two things the agreement covers: publishing on the platform's behalf, and
  the fact that leaders can read their members' unpublished drafts.

This mirrors the RLS grant rather than enforcing anything. The database refuses
the write either way; the banner exists so the UI does not offer a control that
quietly fails.

- [ ] **Step 3: Write the dashboard page**

```typescript
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { apiClient } from '@/lib/api-client'
import { requireOrgLeader } from '@/lib/org-access'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { OrgRoster } from '@/components/org-roster'
import type { Tutorial, OrgMember, Organization, Difficulty } from '@splat-connect/types'

async function approveRequest(memberId: string, orgId: string) {
  'use server'
  await apiClient.post(`/api/org-members/${memberId}/approve`, {})
  revalidatePath(`/org/${orgId}`)
}

async function declineRequest(memberId: string, orgId: string) {
  'use server'
  await apiClient.post(`/api/org-members/${memberId}/decline`, {})
  revalidatePath(`/org/${orgId}`)
}

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  await requireOrgLeader(orgId)

  const [roster, tutorials, memberships] = await Promise.all([
    apiClient.get<OrgMember[]>(`/api/org-members/${orgId}/roster`),
    apiClient.get<Tutorial[]>('/api/tutorials'),
    apiClient.get<(OrgMember & { organizations: Organization })[]>('/api/organizations/mine'),
  ])

  const org = memberships.find((m) => m.org_id === orgId)?.organizations

  // The leader SELECT policy already scopes /api/tutorials to this leader's own
  // orgs, so this filter is presentation (which org's queue am I looking at),
  // not access control.
  const queue = tutorials.filter((t) => t.org_id === orgId && t.status === 'pending')
  const joinRequests = roster.filter((m) => m.status === 'pending' && m.initiated_by === 'contributor')

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-ink">{org?.name ?? 'Organisation'}</h1>
        {org?.trust_level === 'probation' && (
          <span className="rounded-full bg-sunken px-3 py-1 text-xs font-semibold text-muted">
            Probation — review is paused
          </span>
        )}
      </div>
      {org?.status === 'suspended' && (
        <p role="alert" className="alert alert-danger mb-6">
          This organisation is suspended. You can still see your members&apos; work, but
          you cannot approve or reject tutorials.
        </p>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-bold text-ink">
          Tutorials awaiting your review ({queue.length})
        </h2>
        {queue.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span aria-hidden="true" className="empty-badge">☕</span>
            <p className="mt-4 font-bold text-ink">Nothing waiting.</p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
              Submissions from your members land here the moment they send one for review.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {queue.map((t) => (
              <Link
                key={t.id}
                href={`/org/${orgId}/review/${t.id}`}
                className="card card-link flex items-center justify-between gap-4 p-4"
              >
                <div className="flex items-center gap-3">
                  <DifficultyBadge difficulty={t.difficulty as Difficulty} />
                  <div>
                    <p className="text-sm font-bold text-ink">{t.title}</p>
                    <p className="text-xs text-muted">
                      Submitted {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-brand-dark">Review →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-bold text-ink">
          Requests to join ({joinRequests.length})
        </h2>
        {joinRequests.length === 0 ? (
          <p className="text-sm text-muted">No pending requests.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {joinRequests.map((m) => (
              <div key={m.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-bold text-ink">{m.profiles?.name || m.profiles?.email}</p>
                  <p className="text-xs text-muted">
                    Requested {new Date(m.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={approveRequest.bind(null, m.id, orgId)}>
                    <button type="submit" className="btn btn-accent">Approve</button>
                  </form>
                  <form action={declineRequest.bind(null, m.id, orgId)}>
                    <button type="submit" className="btn btn-soft">Decline</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <OrgRoster orgId={orgId} roster={roster} />
    </div>
  )
}
```

- [ ] **Step 4: Write the roster component**

Create `packages/web/components/org-roster.tsx` as a `'use client'` component taking
`{ orgId, roster }`. It renders approved members with a Remove button, pending
invitations (`initiated_by === 'org'`) as "awaiting their response", and an invite form
taking a contributor's user id. All calls go through `browserApiClient`; on success call
`router.refresh()`. Surface API errors in an `alert alert-danger` — the invite endpoint
returns 409 for an existing membership and 403 for a suspended org, and both are worth
showing verbatim rather than as "something went wrong".

- [ ] **Step 5: Verify manually**

```bash
pnpm dev:web
```

Sign in as a leader, visit `/org/<orgId>`. Expected: the queue, requests, and roster
render; visiting an org you do not lead redirects to `/dashboard`.

- [ ] **Step 6: Commit**

Component before the page that imports it, so neither commit references a missing file.

```bash
git add packages/web/components/org-roster.tsx
git commit -m "feat(web): add org roster component with invite and remove actions"

git add "packages/web/app/org/[orgId]/page.tsx"
git commit -m "feat(web): add org leader dashboard with review queue and join requests"
```

---

## Task 3: Leader review screen

**Files:**
- Create: `packages/web/app/org/[orgId]/review/[tutorialId]/page.tsx`

- [ ] **Step 1: Copy the admin review page as the starting point**

```bash
cp "packages/web/app/admin/review/[id]/page.tsx" "packages/web/app/org/[orgId]/review/[tutorialId]/page.tsx"
```

- [ ] **Step 2: Adapt it**

Four changes, everything else stays:

1. Add `await requireOrgLeader(orgId)` at the top of the component.
2. Point both server actions at `POST /api/tutorials/${id}/review` instead of
   `PATCH /api/admin/tutorials/${id}/status`.
3. **Make the rejection note required** — `required` on the `<textarea>` and a
   server-side guard, since the API returns 400 without it. The admin version treats it
   as optional; the org version cannot.
4. `revalidatePath` targets become `/org/${orgId}` and `/org/${orgId}/review/${id}`,
   plus `/library` on approve.

```typescript
async function approveTutorial(orgId: string, id: string) {
  'use server'
  await apiClient.post(`/api/tutorials/${id}/review`, { status: 'approved' })
  revalidatePath(`/org/${orgId}`)
  revalidatePath(`/org/${orgId}/review/${id}`)
  revalidatePath('/library')
}

async function rejectTutorial(orgId: string, formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const note = ((formData.get('note') as string) ?? '').trim()
  // The API refuses an empty note with a 400; catching it here gives the leader a
  // usable message instead of an unhandled server-action error.
  if (!note) throw new Error('A note is required when rejecting — the contributor sees it.')
  await apiClient.post(`/api/tutorials/${id}/review`, { status: 'rejected', rejection_note: note })
  revalidatePath(`/org/${orgId}`)
  revalidatePath(`/org/${orgId}/review/${id}`)
}
```

- [ ] **Step 3: Verify manually**

Approve one tutorial and reject another with a note. Expected: approved appears in
`/library`; rejected shows the note on the contributor's `/my-tutorials`. Submitting a
rejection with an empty note is refused.

- [ ] **Step 4: Commit**

```bash
git add "packages/web/app/org/[orgId]/review/[tutorialId]/page.tsx"
git commit -m "feat(web): add org leader tutorial review screen

Mirrors the admin review page, with one difference that matters: the rejection
note is required, because a rejection with no explanation is the most common
cause of a contributor re-submitting the same problem."
```

---

## Task 4: Admin org management and spot-check

**Files:**
- Create: `packages/web/app/admin/organizations/page.tsx`
- Create: `packages/web/app/admin/spot-check/page.tsx`
- Modify: `packages/web/app/admin/page.tsx`

- [ ] **Step 1: Write the organisations page**

This page is the only surface in the product that creates an organisation or
grants leadership (spec decisions 11 and 12). Everything else about orgs is
read-only or member-level.

Server component listing `GET /api/admin/organizations`. Above the list, a create
form posting `POST /api/admin/organizations`:

- **Name** and **description** text inputs.
- **First leader** — a picker over contributor-role profiles, posting
  `leader_user_id`. Required: an org with no leader cannot approve its own join
  requests, and the API returns 400 without it. Say so in the field's help text
  rather than letting the 400 be the explanation.
- Note in the submit copy that creating the org **grants review authority
  immediately** — status `approved` and trust level `trusted` are both set on
  create, so there is no second approve step and no pending queue.

Each org row shows name, status, trust level, member count, and server-action
buttons:

- **Suspend** → `PATCH /api/admin/organizations/:id { status: 'suspended' }`
- **Demote to probation** → `{ trust_level: 'probation' }`

Each row expands to a roster, with a per-member control posting
`PATCH /api/admin/organizations/:orgId/members/:userId { org_role }`:

- **Promote to leader** / **Demote to member**, disabled for any membership whose
  status is not `approved` — the endpoint returns 400 for those, and disabling
  matches the rule rather than discovering it.
- Nothing here is reachable by a leader: the whole page sits behind the `/admin`
  role gate in `middleware.ts`.

`revalidatePath('/admin/organizations')` and `revalidatePath('/admin')` after each.

- [ ] **Step 2: Write the spot-check page**

Server component over `GET /api/admin/spot-check`. Each row: tutorial title, org name,
reviewing leader, review date, a link to the tutorial, and a flag toggle posting to
`PATCH /api/admin/tutorials/:id/flag`. Explain the sampling in one line of copy so an
admin does not read an absent tutorial as an omission:

> A random sample of tutorials reviewed by organisation leaders. Refresh for a new sample.

- [ ] **Step 3: Add two cards to the admin hub**

In `packages/web/app/admin/page.tsx`, extend the `cards` array and the `Promise.all`:

```typescript
    {
      label: 'Organisations',
      count: pendingOrgs,
      href: '/admin/organizations' as const,
      icon: '🏢',
      hint: 'Approve, suspend, or demote organisations',
    },
    {
      label: 'Spot-check',
      count: orgReviewed,
      href: '/admin/spot-check' as const,
      icon: '🔍',
      hint: 'Audit tutorials that org leaders approved',
    },
```

The grid is already `sm:grid-cols-2`, so four cards need no layout change.

- [ ] **Step 4: Verify manually**

Create an org with a leader and confirm that leader can review immediately once they
have accepted the leader terms — creation sets `approved` + `trusted` in one action, so
there is no separate approval step. Promote a second member and confirm they gain the
same queue. Suspend the org and confirm both leaders' approve buttons now fail.

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/admin/organizations/page.tsx
git commit -m "feat(web): add admin organisation approval and suspension page

Approving is one click that sets both status and trust_level, so the button is
labelled to say what it actually grants: review authority over the org's own
members' tutorials."

git add packages/web/app/admin/spot-check/page.tsx
git commit -m "feat(web): add admin spot-check page for org-reviewed tutorials"

git add packages/web/app/admin/page.tsx
git commit -m "feat(web): link organisations and spot-check from the admin hub"
```

---

## Task 5: Terms gate and organisation browsing

**Files:**
- Create: `packages/web/components/terms-gate.tsx`
- Create: `packages/web/app/organizations/page.tsx`

No org creation page. Only the admin creates organisations (spec decision 11),
and that lives on `/admin/organizations` in Task 4. The `TermsGate` component
stays: the submit flow needs it for `contributor_terms`, and the leader dashboard
in Task 2 needs it for `org_leader_terms`.

- [ ] **Step 1: Write the terms gate component**

```typescript
'use client'
/**
 * Renders an explicit acceptance control for one agreement type, and calls
 * onAccepted once the acceptance is recorded. Used by both the submit flow and
 * the leader dashboard so the two cannot drift apart.
 *
 * The gate is a UX affordance only — the API refuses ungated actions server-side
 * regardless of what this component shows.
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not record acceptance')
      setBusy(false)
    }
  }

  return (
    <div className="card p-4">
      <p className="text-sm leading-relaxed text-muted">
        Before you continue, please read the{' '}
        <Link href={href} target="_blank" className="font-semibold text-brand-dark hover:underline">
          {title}
        </Link>
        .
      </p>
      {error && <p role="alert" className="alert alert-danger mt-3">{error}</p>}
      <button type="button" onClick={accept} disabled={busy} className="btn btn-accent mt-3">
        {busy ? 'Recording…' : `I accept the ${title}`}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Write the browse/join page**

Server component listing `GET /api/organizations` (approved only) with a client Join
button posting to `POST /api/org-members/request`. Handle 409 as "You already have a
membership record with this organisation" rather than an error toast.

- [ ] **Step 3: Verify manually**

Join an approved org from the browse page and confirm the request lands `pending`
with the leader, not approved. Confirm no page in the contributor-facing app
offers to create an organisation.

- [ ] **Step 4: Commit**

```bash
git add packages/web/components/terms-gate.tsx
git commit -m "feat(web): add reusable terms acceptance gate

Shared by the submit flow and the leader dashboard so the two cannot drift
apart. The gate is a UX affordance only — the database refuses ungated
actions regardless of what this renders."

git add packages/web/app/organizations/page.tsx
git commit -m "feat(web): add organisation browse and join-request page"
```

---

## Task 6: Submit flow — org picker and terms gate

**Files:**
- Modify: `packages/web/app/upload/page.tsx`
- Modify: `packages/web/app/dashboard/page.tsx`

- [ ] **Step 1: Read the current submit handler**

```bash
sed -n '176,190p' packages/web/app/upload/page.tsx
```

`handleSubmit` currently does one thing: `PATCH /api/tutorials/:id { status: 'pending' }`.

- [ ] **Step 2: Add the org picker to the review step**

Fetch `GET /api/organizations/mine` on mount and keep the approved memberships. Render a
`<select>` on step 6 (Review), above the submit button:

```tsx
{approvedOrgs.length > 0 && (
  <div className="mb-4">
    <label htmlFor="org-picker" className="field-label">Who should review this?</label>
    <select
      id="org-picker"
      className="field"
      value={orgId ?? ''}
      onChange={(e) => setOrgId(e.target.value || null)}
    >
      <option value="">No organisation — platform review</option>
      {approvedOrgs.map((m) => (
        <option key={m.org_id} value={m.org_id}>{m.organizations?.name}</option>
      ))}
    </select>
    <p className="mt-1.5 text-xs text-muted">
      An organisation&apos;s leaders can see and review your tutorial, including while
      it is still a draft.
    </p>
  </div>
)}
```

Preselect when there is exactly one approved membership; always keep "No organisation"
available. The control is hidden entirely at zero memberships — one `<select>` handles
the 0-, 1-, and multi-org cases with no hidden tiebreaker.

The helper text is not optional polish: it is the contributor-facing disclosure of the
leader read grant (spec §2), which is a real privacy expansion.

- [ ] **Step 3: Persist the chosen org before submitting**

`PATCH /api/tutorials/:id` refuses `org_id` outright (API plan, Task 4), and the wizard
creates the tutorial at step 1 — before the picker exists. `POST /api/tutorials/:id/org`
(API plan, Task 5 Step 3) is the endpoint for exactly this: draft-only, membership-checked.

In `handleSubmit`, set the org before the status transition:

```typescript
  async function handleSubmit() {
    if (!canSubmit(draft)) return
    setSubmitting(true)
    setError(null)
    try {
      // Order matters: org_id is draft-only, so it must be written before the
      // tutorial leaves draft. Doing it the other way round fails with a 403.
      await browserApiClient.post(`/api/tutorials/${tutorialId}/org`, { org_id: orgId })
      await browserApiClient.patch(`/api/tutorials/${tutorialId}`, { status: 'pending' })
      window.location.href = '/my-tutorials'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed')
      setSubmitting(false)
    }
  }
```

Call it unconditionally, including when `orgId` is `null` — that is the explicit
"platform review" choice, and sending it makes the null a decision rather than an
absence.

- [ ] **Step 4: Add the terms gate before submit**

Fetch `GET /api/agreements/me` on mount. If no `contributor_terms` row, render
`<TermsGate type="contributor_terms" onAccepted={...} />` on step 6 and keep the submit
button disabled until accepted. The API enforces this independently on both
`POST /api/tutorials` and the `draft → pending` transition; this only avoids a
confusing 403.

- [ ] **Step 5: Add the org section to the dashboard**

In `packages/web/app/dashboard/page.tsx`, fetch `GET /api/organizations/mine` and render:
- approved memberships, with a link to `/org/<id>` for leaders
- pending invitations (`initiated_by === 'org'`) with Accept / Decline server actions
- pending requests (`initiated_by === 'contributor'`) shown as "awaiting the organisation"
- a link to `/organizations` to browse and request to join. There is no create
  link: organisations are created by the admin (spec decision 11).

- [ ] **Step 6: Verify the whole loop manually**

Submit a tutorial to an org as a member, review it as that org's leader, confirm it
appears in `/library` and **not** in `/admin/review`.

- [ ] **Step 7: Commit**

```bash
git add packages/web/app/upload/page.tsx
git commit -m "feat(web): add org picker and terms gate to the submit flow

One select handles the zero-, one-, and multi-org cases with no hidden
tiebreaker. Its helper text is the contributor-facing disclosure that an org's
leaders can read their drafts — not optional polish."

git add packages/web/app/dashboard/page.tsx
git commit -m "feat(web): show org memberships and pending invites on the dashboard"
```

---

## Task 7: Legal content stubs

**Files:**
- Create: `packages/web/app/legal/contributor-terms/page.tsx`
- Create: `packages/web/app/legal/org-leader-terms/page.tsx`

**These ship empty. Generate no placeholder legal language.** The copy needs a lawyer:
it covers jurisdiction-specific liability and TGA/medical-device considerations for
assistive equipment used by disabled children. Invented text that reads plausibly is
worse than an obvious blank, because it can be mistaken for reviewed text.

- [ ] **Step 1: Write both stubs**

```typescript
/**
 * TODO: LEGAL CONTENT REQUIRED — DO NOT DRAFT THIS WITHOUT A LAWYER.
 *
 * This page must carry the actual contributor terms. It needs professional legal
 * review covering jurisdiction-specific liability and TGA / medical-device
 * considerations for assistive equipment used by disabled children.
 *
 * It must also disclose, in plain language, that joining an organisation lets
 * that organisation's leaders read the contributor's unpublished drafts — a real
 * privacy consequence of the leader SELECT policy in 007_organizations.sql.
 *
 * Until real text exists, acceptances are recorded against version 'v0-todo'
 * (AGREEMENT_VERSIONS in @splat-connect/types) and are VOID. Discard those rows
 * when real terms land.
 *
 * See docs/superpowers/specs/2026-07-28-org-delegated-review-design.md §6.
 */
export default function ContributorTermsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold text-ink">Contributor terms</h1>
      <p className="alert alert-danger" role="alert">
        These terms have not been written yet. Acceptances recorded before the final
        text is published are not binding.
      </p>
    </div>
  )
}
```

Mirror it for `org-leader-terms` with its own heading.

- [ ] **Step 2: Commit**

```bash
git add packages/web/app/legal/contributor-terms/page.tsx
git commit -m "feat(web): add empty contributor terms page pending legal review

Ships deliberately blank. The copy needs a lawyer — jurisdiction-specific
liability and TGA/medical-device considerations for assistive equipment used
by disabled children. Acceptances against v0-todo are void."

git add packages/web/app/legal/org-leader-terms/page.tsx
git commit -m "feat(web): add empty org leader terms page pending legal review"
```

---

## Task 8: E2E coverage

**Files:**
- Create: `packages/web/tests/e2e/org/delegated-review.spec.ts`

- [ ] **Step 1: Read the existing helpers**

```bash
sed -n '1,120p' packages/web/tests/e2e/helpers.ts
```

Reuse `createContributor`, `createAdmin`, `signIn`, `createTutorial`, `adminClient`.
Add `createOrgWithLeader()` there rather than inline in the spec.

- [ ] **Step 2: Write one end-to-end journey**

A single spec covering the loop that the whole feature exists for:

1. Admin approves a pending org.
2. Contributor requests to join; leader approves from `/org/<id>`.
3. Contributor submits a tutorial choosing that org.
4. Tutorial appears in the leader's queue and **not** in `/admin/review`.
5. Leader approves it; it appears in `/library`.

One journey rather than five specs: these steps are strictly sequential, and splitting
them would mean rebuilding the same fixture five times.

- [ ] **Step 3: Run it**

```bash
pnpm --filter @splat-connect/web test:e2e -- org/delegated-review.spec.ts
```

Expected: PASS. Per project memory, do not run Playwright with an Android emulator up —
qemu can grab the Supabase ports on `::1`.

- [ ] **Step 4: Commit**

```bash
git add packages/web/tests/e2e/helpers.ts
git commit -m "test(web): add createOrgWithLeader e2e fixture"

git add packages/web/tests/e2e/org/delegated-review.spec.ts
git commit -m "test(web): cover the delegated review journey end to end"
```

---

## Task 9: Full verification

- [ ] **Step 1: Typecheck, build, and test**

```bash
pnpm typecheck && pnpm --filter @splat-connect/web build && pnpm --filter @splat-connect/web test:unit
```

Expected: PASS. Use `test:unit` — `packages/web` has no bare `test` script, so
`pnpm --filter @splat-connect/web test` exits 0 without running anything.

- [ ] **Step 2: Refresh the graph and commit**

```bash
graphify update .
git add graphify-out && git commit -m "chore(graph): update after org web pages"
```

---

## Done when

- A leader can work their org's queue at `/org/<id>` and publish a member's tutorial.
- That tutorial does not appear in `/admin/review`.
- Visiting an org you do not lead redirects to `/dashboard`.
- Both legal pages exist and are empty, with the TODO comment intact.
- The E2E journey passes.
