# Review Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans` to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Spec:** `docs/superpowers/specs/2026-07-28-review-surfaces-design.md`

**Goal:** A leader and an admin can each read a project and act on it from one
place, with the action following the project's state.

**Architecture:** Both roles get one project page whose actions are computed from
`(backing state, tutorial state)` rather than from which route was opened. That
deletes the two holes: there stops being a "read" link pointing somewhere the
reader cannot go. The leader's two queue sections collapse into one ordered list.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Vitest 2 + Testing
Library, Playwright.

## Global Constraints

- Work on `development` in the main checkout at `/Users/byronpetselis/Documents/splat-connect`.
- **A dev server runs on port 3100 against the CLOUD project** (migration 008).
  Integration tests use `.env.test` → local `127.0.0.1:54321`. Do not confuse them.
- **After moving or adding a route, run `npm run build` before trusting `tsc`.**
  `tsconfig` includes two generated route registries and a stale one rejects valid
  routes with errors that look like type bugs. This cost real time once already.
- **E2E reuses running servers.** Kill 3104/3105 after changing web or API code or
  you will test a stale production build.
- Server components use `apiClient`; client components use `browserApiClient`.
  Writes are server actions with `'use server'` and `revalidatePath`.
- Use existing tokens: `--color-honey-*` (waiting), `--color-mint-*` (accepted),
  `--color-apricot-*` (declined/danger), `.card`, `.panel`, `.badge`, `.btn` and
  variants, `.alert`, `.alert-warning`, `.empty-badge`. **Do not invent colours.**
- Backing wording comes only from `components/backing-state.tsx`.
- British English. **One file per commit.**
- Commit messages end with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## File Structure

| File | Responsibility |
|---|---|
| `packages/api/src/routes/tutorials.ts` | **Modify.** Embed reviewer and backing-org names on `GET /:id`. |
| `packages/web/components/project-actions.tsx` | **Create.** The state→actions decision, shared by both roles. |
| `packages/web/app/organizations/[id]/projects/[tutorialId]/page.tsx` | **Move + rewrite** from `review/[tutorialId]/`. The leader's project page. |
| `packages/web/app/organizations/[id]/page.tsx` | **Modify.** Two sections → one queue. |
| `packages/web/app/admin/review/[id]/page.tsx` | **Modify.** Drop the status refusal; add Unpublish. |
| `packages/web/app/admin/spot-check/page.tsx` | **Modify.** Link to the admin project page. |
| `packages/web/app/admin/organizations/page.tsx` | **Modify.** Kill the N+1; create form behind a disclosure; filterable pickers. |
| `packages/web/tests/unit/**` | **Create/modify.** One file per surface. |
| `packages/web/tests/e2e/contributor/org-backing.spec.ts` | **Modify.** The click that used to 404, and the unpublish loop. |

---

## Task 1: Reviewer names on the tutorial detail endpoint

The one API change. Both project pages need to name who approved a tutorial and
for which organisation; the endpoint returns bare ids.

**Files:**
- Modify: `packages/api/src/routes/tutorials.ts` (the `GET /:id` handler)
- Test: `packages/api/tests/integration/orgs/review-endpoint.test.ts`

**Interfaces:**
- Produces: `GET /api/tutorials/:id` additionally returns
  `reviewer: { name: string } | null` and `reviewed_for: { name: string } | null`.
  Tasks 3 and 5 consume both.

- [ ] **Step 1: Write the failing test**

  Append to `review-endpoint.test.ts`:

  ```typescript
  describe('GET /api/tutorials/:id after review', () => {
    // Tests: the detail endpoint names the reviewer and their organisation
    // How:   leader approves via the endpoint, then fetches the tutorial
    // Chain: both project pages show "approved by X of Y" — with ids alone the
    //        admin would be overriding a decision without seeing whose it was
    it('names the reviewer and the organisation they acted for', async () => {
      const project = await createProject({ authorId: author.id })
      await requestBacking({ tutorialId: project, orgId: orgA, status: 'accepted' })
      await app.request(`/api/tutorials/${project}/review`, authed(leader.token, {
        method: 'POST',
        body: JSON.stringify({ status: 'approved' }),
      }))

      const res = await app.request(`/api/tutorials/${project}`, authed(leader.token))
      const body = (await res.json()) as {
        reviewer: { name: string } | null
        reviewed_for: { name: string } | null
      }
      expect(body.reviewer).not.toBeNull()
      expect(body.reviewed_for?.name).toBe('Riverside Therapy')

      await adminClient().from('tutorials').delete().eq('id', project)
    })
  })
  ```

- [ ] **Step 2: Run and verify it fails**

  ```bash
  cd packages/api && npx vitest run -c vitest.integration.config.ts \
    tests/integration/orgs/review-endpoint.test.ts -t 'names the reviewer'
  ```

  Expected: FAIL — `body.reviewer` is `undefined`.

- [ ] **Step 3: Add the embed**

  In `tutorials.get('/:id')`, extend the select. Same shape the public detail route
  already uses, so there is one way to ask this question:

  ```typescript
    .select(
      '*, parts(*), tools(*), stl_files(*), tutorial_contributors(*, profiles(*)), ' +
        'reviewer:reviewed_by(name), reviewed_for:reviewed_for_org_id(name)'
    )
  ```

- [ ] **Step 4: Run and verify**

  ```bash
  cd packages/api && npx vitest run -c vitest.integration.config.ts tests/integration/orgs/
  ```

  Expected: all pass.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/api/src/routes/tutorials.ts
  git commit -m "feat(api): name the reviewer and their org on the tutorial detail"

  git add packages/api/tests/integration/orgs/review-endpoint.test.ts
  git commit -m "test(api): assert the detail endpoint names who approved a tutorial"
  ```

---

## Task 2: The shared state→actions decision

Both roles compute "what can I do with this project right now" from the same two
inputs. Extracted so the two pages cannot drift, which is the failure mode that
produced these holes in the first place.

**Files:**
- Create: `packages/web/components/project-actions.tsx`
- Test: `packages/web/tests/unit/components/project-actions.test.tsx`

**Interfaces:**
- Produces: `leaderActions(backingStatus, tutorialStatus): LeaderAction[]` and
  `adminActions(tutorialStatus): AdminAction[]`, where
  `LeaderAction = 'back' | 'decline' | 'approve' | 'reject'` and
  `AdminAction = 'approve' | 'reject' | 'unpublish'`. Tasks 3 and 5 consume them.

- [ ] **Step 1: Write the failing test**

  ```tsx
  import { describe, it, expect } from 'vitest'
  import { leaderActions, adminActions } from '@/components/project-actions'

  describe('leaderActions', () => {
    // Tests: a pending request offers the backing decision, not the review one
    // Chain: this is the hole — the leader's page used to refuse anything not
    //        already accepted, so the act of deciding whether to back had no home
    it('offers back and decline while the request is pending', () => {
      expect(leaderActions('pending', 'pending')).toEqual(['back', 'decline'])
      expect(leaderActions('pending', 'draft')).toEqual(['back', 'decline'])
    })

    it('offers the review decision once backing is accepted', () => {
      expect(leaderActions('accepted', 'pending')).toEqual(['approve', 'reject'])
    })

    // Tests: nothing is actionable once published or declined
    // Chain: a leader cannot unpublish — only the admin can — and a declined
    //        request is finished; offering buttons the database refuses is how the
    //        contributor surfaces got their read-only rule
    it('offers nothing once the tutorial is published', () => {
      expect(leaderActions('accepted', 'approved')).toEqual([])
    })

    it('offers nothing once the request was declined', () => {
      expect(leaderActions('declined', 'pending')).toEqual([])
    })

    it('offers nothing when this organisation was never asked', () => {
      expect(leaderActions(null, 'pending')).toEqual([])
    })
  })

  describe('adminActions', () => {
    it('offers approve and reject while pending', () => {
      expect(adminActions('pending')).toEqual(['approve', 'reject'])
    })

    // Tests: the admin can take down published work
    // Chain: decision 14 removed the self-review block on the argument that the
    //        controls are reactive — this is the control, and it was unreachable
    it('offers unpublish once approved', () => {
      expect(adminActions('approved')).toEqual(['unpublish'])
    })

    it('offers nothing on a rejected tutorial', () => {
      expect(adminActions('rejected')).toEqual([])
    })
  })
  ```

- [ ] **Step 2: Run and verify it fails**

  ```bash
  cd packages/web && npm run test:unit -- project-actions
  ```

- [ ] **Step 3: Write it**

  ```tsx
  /**
   * What can this role do with this project, right now.
   *
   * Extracted because the leader's page and the admin's page answer the same
   * question with different authority, and when they each answered it inline they
   * drifted into two holes: the leader's page refused anything not already
   * accepted, so deciding whether to back had no home; the admin's refused
   * anything not pending, so taking down a bad approval had no home either.
   *
   * Actions are derived, never passed in. A page that could be told what to render
   * is a page that can be told wrong.
   *
   * Related files:
   * - docs/superpowers/specs/2026-07-28-review-surfaces-design.md §1, §2
   */
  import type { TutorialOrg, TutorialStatus } from '@splat-connect/types'

  export type LeaderAction = 'back' | 'decline' | 'approve' | 'reject'
  export type AdminAction = 'approve' | 'reject' | 'unpublish'

  export function leaderActions(
    backing: TutorialOrg['status'] | null,
    tutorial: TutorialStatus
  ): LeaderAction[] {
    if (backing === 'pending') return ['back', 'decline']
    // Only an accepted backing on unpublished work confers review authority — the
    // same three conditions the RLS grant checks, minus the ones the page cannot
    // see (org active, terms accepted). The database remains the decider; this
    // only decides what to draw.
    if (backing === 'accepted' && tutorial === 'pending') return ['approve', 'reject']
    return []
  }

  export function adminActions(tutorial: TutorialStatus): AdminAction[] {
    if (tutorial === 'pending') return ['approve', 'reject']
    if (tutorial === 'approved') return ['unpublish']
    return []
  }
  ```

- [ ] **Step 4: Run and commit**

  ```bash
  cd packages/web && npm run test:unit -- project-actions

  git add packages/web/components/project-actions.tsx
  git commit -m "feat(web): derive project actions from state, shared by both roles"

  git add packages/web/tests/unit/components/project-actions.test.tsx
  git commit -m "test(web): pin the action matrix that closes both holes"
  ```

---

## Task 3: The leader's project page

**Files:**
- Move: `app/organizations/[id]/review/[tutorialId]/page.tsx` →
  `app/organizations/[id]/projects/[tutorialId]/page.tsx`
- Test: `packages/web/tests/unit/pages/leader-project.test.tsx`

**Interfaces:**
- Consumes: `leaderActions` (Task 2), `isOrgLeader`, the reviewer embed (Task 1),
  `POST /api/tutorials/:id/orgs/:orgId/accept|decline`, `POST /:id/review`.

- [ ] **Step 1: Move the route**

  ```bash
  cd /Users/byronpetselis/Documents/splat-connect/packages/web
  mkdir -p "app/organizations/[id]/projects"
  git mv "app/organizations/[id]/review/[tutorialId]" \
         "app/organizations/[id]/projects/[tutorialId]"
  rmdir "app/organizations/[id]/review" 2>/dev/null || true
  ```

- [ ] **Step 2: Write the failing test**

  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest'
  import { render, screen } from '@testing-library/react'

  const get = vi.fn()
  vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a), post: vi.fn() } }))
  vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
  vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
    redirect: vi.fn(),
  }))
  vi.mock('next/image', () => ({ default: () => null }))
  vi.mock('next/link', () => ({
    default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  }))

  const theOrg = { id: 'o1', name: 'Riverside', description: null, status: 'active', created_by: null, created_at: '', updated_at: '' }

  const tutorial = (status: string) => ({
    id: 't1', title: 'Spoon holder', description: 'A spoon holder', difficulty: 'easy',
    status, tutorial_pdf_url: null, toy_photo_url: null, rejection_note: null,
    created_at: '', reviewed_at: null, reviewed_by: null, reviewed_for_org_id: null,
    reviewer: null, reviewed_for: null,
    tutorial_contributors: [], parts: [], tools: [], stl_files: [],
  })

  const route = (opts: { leads: boolean; tutorialStatus: string; backing: string | null }) => (path: string) =>
    Promise.resolve(
      path === '/api/organizations/mine' ? (opts.leads ? [theOrg] : [])
        : path === '/api/tutorials/t1/orgs'
          ? (opts.backing ? [{ id: 'b1', tutorial_id: 't1', org_id: 'o1', status: opts.backing, requested_at: '', responded_at: null, responded_by: null }] : [])
        : path === '/api/tutorials/t1' ? tutorial(opts.tutorialStatus)
        : theOrg
    )

  const params = Promise.resolve({ id: 'o1', tutorialId: 't1' })

  describe('leader project page', () => {
    beforeEach(() => vi.clearAllMocks())

    // Tests: a leader can READ a project they were asked to back
    // How:   pending backing, pending tutorial; checks the content and both actions
    // Chain: this is the hole — the queue linked here to the public page, which
    //        filters to approved, so the leader got a 404 on the one thing they
    //        needed to see before deciding
    it('renders the tutorial and the backing decision for a pending request', async () => {
      get.mockImplementation(route({ leads: true, tutorialStatus: 'pending', backing: 'pending' }))
      const { default: Page } = await import('@/app/organizations/[id]/projects/[tutorialId]/page')
      render(await Page({ params }))

      expect(screen.getByText('Spoon holder')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Back this project/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Decline/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument()
    })

    it('offers the review decision once backing is accepted', async () => {
      get.mockImplementation(route({ leads: true, tutorialStatus: 'pending', backing: 'accepted' }))
      const { default: Page } = await import('@/app/organizations/[id]/projects/[tutorialId]/page')
      render(await Page({ params }))

      expect(screen.getByRole('button', { name: /Approve and publish/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Back this project/i })).not.toBeInTheDocument()
    })

    it('is read-only once the tutorial is published', async () => {
      get.mockImplementation(route({ leads: true, tutorialStatus: 'approved', backing: 'accepted' }))
      const { default: Page } = await import('@/app/organizations/[id]/projects/[tutorialId]/page')
      render(await Page({ params }))

      expect(screen.queryByRole('button', { name: /Approve|Reject|Back|Decline/i })).not.toBeInTheDocument()
    })

    it('404s for someone who does not lead the organisation', async () => {
      get.mockImplementation(route({ leads: false, tutorialStatus: 'pending', backing: 'pending' }))
      const { default: Page } = await import('@/app/organizations/[id]/projects/[tutorialId]/page')
      await expect(Page({ params })).rejects.toThrow('NOT_FOUND')
    })
  })
  ```

- [ ] **Step 3: Rewrite the page**

  Keep the existing `approve` and `reject` server actions; their `redirect` and
  `revalidatePath` targets become `/organizations/${orgId}`. Add two more:

  ```tsx
  async function backProject(formData: FormData) {
    'use server'
    const orgId = formData.get('orgId') as string
    const tutorialId = formData.get('tutorialId') as string
    await apiClient.post(`/api/tutorials/${tutorialId}/orgs/${orgId}/accept`, {})
    revalidatePath(`/organizations/${orgId}`)
    revalidatePath(`/organizations/${orgId}/projects/${tutorialId}`)
  }

  async function declineProject(formData: FormData) {
    'use server'
    const orgId = formData.get('orgId') as string
    const tutorialId = formData.get('tutorialId') as string
    await apiClient.post(`/api/tutorials/${tutorialId}/orgs/${orgId}/decline`, {})
    revalidatePath(`/organizations/${orgId}`)
    redirect(`/organizations/${orgId}`)
  }
  ```

  Replace `if (tutorial.status !== 'pending') notFound()` — the line that made the
  page refuse anything not already accepted — with the derived actions:

  ```tsx
  const [tutorial, backingRows] = await Promise.all([
    apiClient.get<TutorialWithDetails & { reviewer?: { name: string } | null; reviewed_for?: { name: string } | null }>(`/api/tutorials/${tutorialId}`),
    apiClient.get<TutorialOrg[]>(`/api/tutorials/${tutorialId}/orgs`).catch(() => [] as TutorialOrg[]),
  ])
  const mine = backingRows.find((b) => b.org_id === orgId) ?? null
  const actions = leaderActions(mine?.status ?? null, tutorial.status)
  ```

  Render the tutorial first — title, difficulty, description, photo, PDF link —
  then the actions. **Backing decisions and review decisions get different weight:**
  `Back this project` is `btn btn-accent`, `Decline` is `btn btn-quiet`;
  `Approve and publish` is `btn btn-accent` with a line above it saying what it
  does — *"This publishes the tutorial under Riverside's name."* — and `Reject`
  keeps its required note in a `<textarea>`.

  When `actions` is empty, show why rather than a blank page:

  ```tsx
  {actions.length === 0 && (
    <p className="alert mt-6">
      {tutorial.status === 'approved'
        ? `Published${tutorial.reviewer ? ` — approved by ${tutorial.reviewer.name}` : ''}${tutorial.reviewed_for ? `, ${tutorial.reviewed_for.name}` : ''}. Only SPLAT can take it down.`
        : mine?.status === 'declined'
          ? 'Your organisation declined this project.'
          : 'Nothing to do here.'}
    </p>
  )}
  ```

- [ ] **Step 4: Rebuild, verify, commit**

  ```bash
  cd packages/web && npm run build && npx tsc --noEmit && npm run test:unit -- leader-project

  git add -A "packages/web/app/organizations"
  git commit -m "feat(web): give a leader one project page they can actually read"

  git add packages/web/tests/unit/pages/leader-project.test.tsx
  git commit -m "test(web): assert a leader can read a project before backing it"
  ```

---

## Task 4: The leader's queue

**Files:**
- Modify: `packages/web/app/organizations/[id]/page.tsx`
- Test: `packages/web/tests/unit/pages/organization-detail.test.tsx`

- [ ] **Step 1: Collapse the two sections into one queue**

  Replace the `requests` and `queue` arrays and their two `<section>`s with:

  ```tsx
  // One list, oldest first. A section holding one item is more chrome than
  // content, and the two acts are already distinguished on the project page,
  // which offers only the applicable action.
  const waiting = leads
    ? tutorials
        .filter((t) => {
          const row = rowFor(t)
          if (!row) return false
          if (row.status === 'pending') return true
          return row.status === 'accepted' && t.status === 'pending'
        })
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
    : []
  ```

  Each row links to `/organizations/${orgId}/projects/${t.id}` — never to
  `/tutorials/${t.id}`, which is the public page and 404s for unpublished work.
  That link is the hole; it must not survive anywhere on this page.

  Row content: `<BackingBadge status={rowFor(t)!.status} />`, the title, and the
  difficulty badge. Empty state:

  > Nothing waiting. Contributors ask by choosing your organisation when they
  > submit.

- [ ] **Step 2: Add the tests**

  Append to `organization-detail.test.tsx`:

  ```tsx
  // Tests: both kinds of waiting work appear in one list, oldest first
  // Chain: a leader arrives asking "what is oldest", not "what kind of thing is
  //        oldest" — two sections made them merge the answer themselves
  it('shows one queue of everything waiting, oldest first', async () => {
    get.mockImplementation(route([theOrg]))
    const { default: Page } = await import('@/app/organizations/[id]/page')
    render(await Page({ params: Promise.resolve({ id: 'o1' }) }))

    expect(screen.getByText('Asking project')).toBeInTheDocument()
    expect(screen.queryByText(/Projects asking for your backing/i)).not.toBeInTheDocument()
  })

  // Tests: no row links to the public tutorial page
  // Chain: that link is the hole — it 404s for unpublished work, which is every
  //        item in this queue
  it('links rows to the project page, never the public one', async () => {
    get.mockImplementation(route([theOrg]))
    const { default: Page } = await import('@/app/organizations/[id]/page')
    render(await Page({ params: Promise.resolve({ id: 'o1' }) }))

    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/organizations/o1/projects/t1')
    expect(hrefs.filter((h) => h === '/tutorials/t1')).toHaveLength(0)
  })
  ```

  The existing fixture's `t1` is pending with pending backing, and `t2` is approved
  and accepted — so `t2` stays out of the queue and remains in the public "backed"
  list, which the existing tests already assert.

- [ ] **Step 3: Verify and commit**

  ```bash
  cd packages/web && npm run test:unit && npx tsc --noEmit

  git add "packages/web/app/organizations/[id]/page.tsx"
  git commit -m "feat(web): collapse the leader's two sections into one queue"

  git add packages/web/tests/unit/pages/organization-detail.test.tsx
  git commit -m "test(web): assert no queue row links to the public tutorial page"
  ```

---

## Task 5: The admin's project page

**Files:**
- Modify: `packages/web/app/admin/review/[id]/page.tsx`
- Test: `packages/web/tests/unit/pages/admin-project.test.tsx`

**Interfaces:**
- Consumes: `adminActions` (Task 2), the reviewer embed (Task 1),
  `PATCH /api/admin/tutorials/:id/status`.

- [ ] **Step 1: Write the failing test**

  ```tsx
  // Tests: an approved tutorial can be taken down from this page
  // How:   status 'approved'; checks Unpublish renders instead of a 404
  // Chain: this is the hole — the page did `if (status !== 'pending') notFound()`,
  //        so an admin who found a bad approval in spot-check had nowhere to act.
  //        Decision 14's whole safety argument depends on this control existing
  it('offers unpublish for a tutorial a leader approved', async () => {
    get.mockResolvedValue({
      ...baseTutorial,
      status: 'approved',
      reviewer: { name: 'Sam' },
      reviewed_for: { name: 'Riverside Therapy' },
    })
    const { default: Page } = await import('@/app/admin/review/[id]/page')
    render(await Page({ params: Promise.resolve({ id: 't1' }) }))

    expect(screen.getByRole('button', { name: /Unpublish/i })).toBeInTheDocument()
    // The admin is overriding someone; the page says whose decision it was.
    expect(screen.getByText(/Sam/)).toBeInTheDocument()
    expect(screen.getByText(/Riverside Therapy/)).toBeInTheDocument()
  })

  it('still offers approve and reject while pending', async () => {
    get.mockResolvedValue({ ...baseTutorial, status: 'pending' })
    const { default: Page } = await import('@/app/admin/review/[id]/page')
    render(await Page({ params: Promise.resolve({ id: 't1' }) }))
    expect(screen.getByRole('button', { name: /Approve/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Unpublish/i })).not.toBeInTheDocument()
  })

  // Tests: unpublishing without a reason is refused
  // How:   submits a whitespace-only note; checks the action did not fire
  // Chain: this note is the only thing the contributor will ever see explaining
  //        why work that was live is not any more — an empty one leaves them with
  //        a tutorial that vanished and no way to find out why
  it('refuses to unpublish without a note', async () => {
    get.mockResolvedValue({ ...baseTutorial, status: 'approved' })
    const { default: Page } = await import('@/app/admin/review/[id]/page')
    render(await Page({ params: Promise.resolve({ id: 't1' }) }))

    const note = screen.getByLabelText(/Why are you taking it down/i)
    expect(note).toBeRequired()

    // And the server action guards it too, since `required` is only the browser's
    // opinion and a form can be submitted without one.
    const { unpublishForTest } = await import('@/app/admin/review/[id]/page')
    const form = new FormData()
    form.set('id', 't1')
    form.set('note', '   ')
    await unpublishForTest(form)
    expect(patch).not.toHaveBeenCalled()
  })

  it('is read-only on a rejected tutorial, showing the note', async () => {
    get.mockResolvedValue({ ...baseTutorial, status: 'rejected', rejection_note: 'Step 4 is unsafe' })
    const { default: Page } = await import('@/app/admin/review/[id]/page')
    render(await Page({ params: Promise.resolve({ id: 't1' }) }))
    expect(screen.getByText('Step 4 is unsafe')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approve|Unpublish/i })).not.toBeInTheDocument()
  })
  ```

- [ ] **Step 2: Rewrite the page**

  Delete `if (tutorial!.status !== 'pending') notFound()`. Derive actions with
  `adminActions(tutorial!.status)` and add the unpublish action:

  ```tsx
  export async function unpublishForTest(formData: FormData) {
    'use server'
    return unpublishTutorial(formData)
  }

  async function unpublishTutorial(formData: FormData) {
    'use server'
    const id = formData.get('id') as string
    const note = ((formData.get('note') as string) ?? '').trim()
    // Required, and checked here as well as by the form: this note is the only
    // thing the contributor will see explaining why work that was live is not any
    // more.
    if (!note) return
    await apiClient.patch(`/api/admin/tutorials/${id}/status`, {
      status: 'rejected',
      rejection_note: note,
    })
    revalidatePath('/admin')
    revalidatePath('/admin/review')
    revalidatePath('/admin/spot-check')
    revalidatePath('/library')
    revalidatePath(`/tutorials/${id}`)
    redirect('/admin/spot-check')
  }
  ```

  `unpublishForTest` exists so the note guard is testable without a browser. It is
  a one-line re-export of the same action, named so nobody mistakes it for part of
  the page's interface.

  The unpublish control is deliberately heavier than the others — it removes
  something a parent may already be using:

  ```tsx
  {actions.includes('unpublish') && (
    <form action={unpublishTutorial} className="mt-8">
      <input type="hidden" name="id" value={id} />
      <h2 className="text-lg font-bold text-ink">Unpublish this tutorial</h2>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
        It is live in the library now and a parent may be following it. Unpublishing
        removes it and shows this note to the contributor, who can edit and
        resubmit.
      </p>
      <label htmlFor="note" className="mt-3 block font-medium text-ink">
        Why are you taking it down?
      </label>
      <textarea id="note" name="note" required rows={4} className="mt-1 w-full" />
      <button type="submit" className="btn btn-danger mt-3">Unpublish</button>
    </form>
  )}
  ```

  When the tutorial was reviewed by a leader, name them above the actions:
  *"Approved by Sam, Riverside Therapy."*

- [ ] **Step 3: Verify and commit**

  ```bash
  cd packages/web && npm run test:unit -- admin-project && npx tsc --noEmit

  git add "packages/web/app/admin/review/[id]/page.tsx"
  git commit -m "feat(web): let an admin unpublish a tutorial a leader approved"

  git add packages/web/tests/unit/pages/admin-project.test.tsx
  git commit -m "test(web): assert the admin can act on a published tutorial"
  ```

---

## Task 6: Spot-check links somewhere useful

**Files:**
- Modify: `packages/web/app/admin/spot-check/page.tsx`
- Test: `packages/web/tests/unit/pages/spot-check.test.tsx`

- [ ] **Step 1: Write the failing test**

  ```tsx
  // Tests: a sampled tutorial links where the admin can act on it
  // Chain: linking to the public page made spot-check a dead end — you could see a
  //        bad approval and had nowhere to go
  it('links rows to the admin project page, not the public one', async () => {
    get.mockResolvedValue([{ ...baseTutorial, id: 't1', status: 'approved' }])
    const { default: Page } = await import('@/app/admin/spot-check/page')
    render(await Page())
    expect(screen.getByRole('link', { name: /Spoon holder/i })).toHaveAttribute(
      'href', '/admin/review/t1'
    )
  })
  ```

- [ ] **Step 2: Change the link and add a line of copy**

  `href={`/admin/review/${t.id}`}`, and extend the page's explanation so the route
  out is stated: *"Open one to read it, and unpublish it if it should not be
  there."*

- [ ] **Step 3: Verify and commit**

  ```bash
  cd packages/web && npm run test:unit -- spot-check

  git add packages/web/app/admin/spot-check/page.tsx
  git commit -m "feat(web): link spot-check rows where the admin can act"

  git add packages/web/tests/unit/pages/spot-check.test.tsx
  git commit -m "test(web): assert spot-check is not a dead end"
  ```

---

## Task 7: `/admin/organizations` — the N+1 and the form

**Files:**
- Modify: `packages/web/app/admin/organizations/page.tsx`
- Test: `packages/web/tests/unit/pages/admin-organizations.test.tsx`

- [ ] **Step 1: Write the failing test**

  ```tsx
  // Tests: the page does not issue a request per organisation
  // How:   three organisations; counts calls to /api/organizations/:id
  // Chain: fine at five, silly at fifty, and the fix is free — the list endpoint
  //        already returns everything the collapsed row shows
  it('fetches the list once, not once per organisation', async () => {
    get.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/api/organizations' ? [org('o1'), org('o2'), org('o3')]
          : path === '/api/admin/contributors' ? []
          : []
      )
    )
    const { default: Page } = await import('@/app/admin/organizations/page')
    render(await Page())

    const perOrg = get.mock.calls.filter(([p]: [string]) => /^\/api\/organizations\/o\d$/.test(p))
    expect(perOrg).toHaveLength(0)
  })
  ```

- [ ] **Step 2: Remove the N+1 and move the form**

  Delete the `detailed` fetch entirely. The collapsed row shows name, description
  and status — all of which `GET /api/organizations` already returns. Leaders load
  only for the row a user opens, via a `<details>` panel whose content is a small
  server component fetching that one organisation.

  Wrap the create form in `<details className="panel mb-6">` with
  `<summary className="panel-summary">Create an organisation</summary>`, so the
  list is what you land on.

  Both leader pickers become a text input backed by a `<datalist>`, so the field
  filters as you type instead of presenting every account on the platform:

  ```tsx
  <input
    id="leader_user_id"
    name="leader_user_id"
    list="contributor-options"
    required
    placeholder="Type a name or email…"
    className="mt-1 w-full"
  />
  <datalist id="contributor-options">
    {contributors.map((c) => (
      <option key={c.id} value={c.id}>
        {c.name || c.email}
      </option>
    ))}
  </datalist>
  ```

  The `value` stays the id, because that is what the API takes; the label is what
  the admin reads. One `<datalist>` serves both pickers — it is referenced by id,
  not nested.

- [ ] **Step 3: Verify and commit**

  ```bash
  cd packages/web && npm run test:unit -- admin-organizations && npx tsc --noEmit

  git add packages/web/app/admin/organizations/page.tsx
  git commit -m "feat(web): stop fetching one request per organisation"

  git add packages/web/tests/unit/pages/admin-organizations.test.tsx
  git commit -m "test(web): pin the organisations page to a single list fetch"
  ```

---

## Task 8: E2E — the click that 404'd, and the unpublish loop

**Files:**
- Modify: `packages/web/tests/e2e/contributor/org-backing.spec.ts`

- [ ] **Step 1: Make the first journey click through the queue**

  It currently navigates directly to the review URL — a workaround added when the
  click 404'd. Restore the real interaction, which is the whole point of Task 3:

  ```typescript
    // Open it from the queue. This click used to 404: the row linked to the public
    // tutorial page, which serves only approved work.
    await page.getByRole('link', { name: title }).click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await page.getByRole('button', { name: /Back this project/i }).click()
    await page.getByRole('button', { name: /Approve and publish/i }).click()
  ```

- [ ] **Step 2: Add the unpublish journey**

  ```typescript
  test('an admin unpublishes a tutorial a leader approved', async ({ page }) => {
    const author = await createContributor()
    await acceptTerms(author.id)
    const leader = await createContributor()
    await acceptTerms(leader.id, 'org_leader_terms')
    const admin = await createAdmin()
    const orgId = await createOrgWithLeader(leader.id, `Riverside ${Date.now()}`)
    const title = uniqueTitle('Published')
    const tutorialId = await createTutorial(author.id, { title, status: 'pending' })
    await seedBackingRequest(tutorialId, orgId)

    try {
      // The leader publishes it.
      await signIn(page, leader.email, leader.password)
      await page.waitForURL('**/dashboard')
      await page.goto(`/organizations/${orgId}/projects/${tutorialId}`)
      await page.getByRole('button', { name: /Back this project/i }).click()
      await page.getByRole('button', { name: /Approve and publish/i }).click()

      // The admin finds it in spot-check and takes it down — the loop that had no
      // route through the UI before this plan.
      await signIn(page, admin.email, admin.password)
      await page.waitForURL('**/admin')
      await page.goto('/admin/spot-check')
      await page.getByRole('link', { name: title }).click()
      await page.getByLabel(/Why are you taking it down/i).fill('Step 4 is unsafe as written')
      await page.getByRole('button', { name: /^Unpublish$/ }).click()

      // The contributor is told why, in the place they already look.
      await signIn(page, author.email, author.password)
      await page.waitForURL('**/dashboard')
      await page.goto('/my-tutorials')
      await expect(page.getByText('Step 4 is unsafe as written')).toBeVisible()
    } finally {
      await deleteOrg(orgId)
      await deleteUser(author.id)
      await deleteUser(leader.id)
      await deleteUser(admin.id)
    }
  })
  ```

- [ ] **Step 3: Run**

  ```bash
  cd packages/web
  PIDS=$(lsof -ti :3104; lsof -ti :3105); [ -n "$PIDS" ] && kill $PIDS; sleep 3
  npx playwright test contributor/org-backing --reporter=line
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add packages/web/tests/e2e
  git commit -m "test(web): cover the queue click and the unpublish loop"
  ```

---

## Task 9: Full verification

- [ ] **Step 1: Everything**

  ```bash
  cd /Users/byronpetselis/Documents/splat-connect
  npx supabase db reset
  cd packages/api && npx vitest run -c vitest.integration.config.ts && npx vitest run tests/unit && npx tsc --noEmit
  cd ../web && npm run test:unit && npm run build && npx tsc --noEmit
  PIDS=$(lsof -ti :3104; lsof -ti :3105); [ -n "$PIDS" ] && kill $PIDS; sleep 3
  npx playwright test --reporter=line
  ```

- [ ] **Step 2: Confirm no route into a dead end remains**

  ```bash
  cd /Users/byronpetselis/Documents/splat-connect/packages/web
  grep -rn 'href={`/tutorials/${' app/organizations app/admin || echo "no leader or admin surface links to the public tutorial page"
  ```

- [ ] **Step 3: Refresh the graph**

  ```bash
  cd /Users/byronpetselis/Documents/splat-connect && graphify update .
  ```

## Done when

- A leader opens a pending request from their queue, reads the tutorial, and backs
  or declines it — the click that used to 404.
- A leader's project page offers exactly the action their state allows, and says
  why when it allows none.
- An admin opens a leader-approved tutorial from spot-check and unpublishes it with
  a note; the contributor sees that note on their own page.
- No surface under `app/organizations` or `app/admin` links to the public tutorial
  page.
- `/admin/organizations` issues one request for the list.
- Both unit suites, both typechecks, the web build and the whole E2E suite pass.
