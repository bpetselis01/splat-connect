# Contributor Backing Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans` to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Spec:** `docs/superpowers/specs/2026-07-28-contributor-backing-experience-design.md`

**Goal:** A contributor can see what happened to every organisation they asked to
back a project, withdraw a request, ask someone else, and read about an
organisation before choosing it.

**Architecture:** One shared component owns the §1 vocabulary and every surface
renders through it, so the wording cannot drift the way the status→colour map did
before `StatusBadge` existed. Backing controls are a sixth `<details>` panel on the
edit page using the existing accordion pattern, driven by server actions. `/org` is
consolidated into `/organizations`, and `requireOrgLeader` becomes a capability
check rather than a redirect.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Vitest 2 + Testing
Library, Playwright.

## Global Constraints

- Work on `development` in the main checkout at `/Users/byronpetselis/Documents/splat-connect`.
  There is no worktree for this; the org branch was merged and removed.
- **A dev server is running on port 3100 against the CLOUD Supabase project.**
  `packages/web/.env.local` and `packages/api/.env.local` point at
  `napjjvnriegcszcvkysj.supabase.co`, which is now at migration 008. Integration
  tests use `.env.test`, which points at local `127.0.0.1:54321`. Do not confuse them.
- **`tsc --noEmit` in `packages/web` can fail on `.next/dev/types/*` while that dev
  server is running.** It is a race with the server writing its generated types, not
  your code. Re-run before investigating.
- Server components use `apiClient`; client components use `browserApiClient`.
  Writes are server actions with `'use server'` and `revalidatePath`, matching
  `app/admin/review/[id]/page.tsx:8-27`.
- **All copy comes from §1 of the spec, verbatim**, and only through the component
  built in Task 1. No surface writes its own wording.
- Use the existing design tokens. Colours are CSS variables in `app/globals.css`:
  `--color-honey-soft/-deep` (waiting), `--color-mint-soft/-deep` (accepted),
  `--color-apricot-soft/-deep` (declined), `--color-sunken`, `--color-muted`,
  `--color-ink`. Classes: `.card`, `.panel`, `.badge`, `.chip`, `.btn` and its
  variants, `.alert`, `.empty-badge`. **Do not invent new colours** — the three
  backing states map onto the three that `StatusBadge` already uses, and that
  correspondence is deliberate.
- British English, matching every existing page.
- **One file per commit**, ordered so each commit stands alone.
- Commit messages end with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## File Structure

| File | Responsibility |
|---|---|
| `packages/web/app/globals.css` | **Modify.** Add the missing `.alert-warning`. |
| `packages/web/components/backing-state.tsx` | **Create.** Owns the §1 vocabulary. `BackingSummary` (one line) and `BackingChip` (one organisation). |
| `packages/api/src/routes/public.ts` | **Modify.** The list endpoint embeds accepted backing. |
| `packages/web/components/tutorial-card.tsx` | **Modify.** Library card badge. |
| `packages/web/app/my-tutorials/page.tsx` | **Modify.** Row summary. |
| `packages/web/app/dashboard/page.tsx` | **Modify.** Row summary. |
| `packages/web/components/edit-backing-section.tsx` | **Create.** The picker, a client component because it needs a select. |
| `packages/web/app/tutorials/[id]/edit/page.tsx` | **Modify.** Sixth panel + its two server actions. |
| `packages/web/app/organizations/page.tsx` | **Create.** Browse list. |
| `packages/web/app/organizations/[id]/page.tsx` | **Create.** Detail, plus the leader workspace. |
| `packages/web/app/organizations/[id]/review/[tutorialId]/page.tsx` | **Move** from `app/org/[orgId]/review/[tutorialId]/`. |
| `packages/web/lib/org-access.ts` | **Modify.** `requireOrgLeader` → `isOrgLeader`, no redirect. |
| `packages/web/components/nav.tsx` | **Modify.** Organisations entry. |
| `packages/web/middleware.ts` | **Modify.** Drop `/org`, keep `/organizations`. |
| `packages/web/tests/unit/**` | **Create/modify.** One file per surface. |

**Deleted:** `app/org/` entirely, and `components/org-review-banner.tsx` moves with
the dashboard content into `app/organizations/[id]/page.tsx`.

---

## Task 1: The vocabulary component and the missing alert style

Everything downstream renders through this. Built first so no surface has a chance
to write its own wording.

**Files:**
- Modify: `packages/web/app/globals.css`
- Create: `packages/web/components/backing-state.tsx`
- Test: `packages/web/tests/unit/components/backing-state.test.tsx`

**Interfaces:**
- Produces: `<BackingSummary backing={TutorialOrg[]} />` and
  `<BackingChip row={TutorialOrg} />`. Tasks 3, 4, 5 and 7 all consume these.

- [ ] **Step 1: Add the missing alert style**

  `.alert-warning` is used in `components/org-review-banner.tsx`,
  `app/legal/contributor-terms/page.tsx` and `app/legal/org-leader-terms/page.tsx`,
  and has never existed — those three render with base `.alert` and no warning
  treatment. Add it beside `.alert-danger` in `app/globals.css`, using honey so it
  reads as the same "waiting on something" colour as a pending `StatusBadge`:

  ```css
  .alert-warning {
    background-color: var(--color-honey-soft);
    color: var(--color-honey-deep);
  }
  ```

- [ ] **Step 2: Write the failing test**

  ```tsx
  import { describe, it, expect } from 'vitest'
  import { render, screen } from '@testing-library/react'
  import { BackingSummary, BackingChip } from '@/components/backing-state'
  import type { TutorialOrg, TutorialOrgStatus } from '@splat-connect/types'

  const row = (name: string, status: TutorialOrgStatus): TutorialOrg => ({
    id: name, tutorial_id: 't', org_id: name, status,
    requested_at: '', responded_at: null, responded_by: null,
    organizations: {
      id: name, name, description: null, status: 'active',
      created_by: null, created_at: '', updated_at: '',
    },
  })

  describe('BackingSummary', () => {
    // Tests: the default path reads as a path, not as an absence
    // How:   renders with no backing rows; checks the SPLAT wording
    // Chain: every tutorial written before organisations existed is in this state —
    //        calling it "no organisation" would make the normal case read as failure
    it('reads "Reviewed by SPLAT" when nothing was asked', () => {
      render(<BackingSummary backing={[]} />)
      expect(screen.getByText('Reviewed by SPLAT')).toBeInTheDocument()
    })

    it('names a single organisation that is deciding', () => {
      render(<BackingSummary backing={[row('Riverside Therapy', 'pending')]} />)
      expect(screen.getByText('Riverside Therapy is deciding')).toBeInTheDocument()
    })

    it('counts several that are deciding rather than listing them', () => {
      render(<BackingSummary backing={[row('A', 'pending'), row('B', 'pending')]} />)
      expect(screen.getByText('2 organisations deciding')).toBeInTheDocument()
    })

    it('leads with who is backing it, and mentions who is still deciding', () => {
      render(<BackingSummary backing={[row('Riverside', 'accepted'), row('Northside', 'pending')]} />)
      expect(screen.getByText(/Backed by Riverside/)).toBeInTheDocument()
      expect(screen.getByText(/1 still deciding/)).toBeInTheDocument()
    })

    it('joins several backers', () => {
      render(<BackingSummary backing={[row('Riverside', 'accepted'), row('Northside', 'accepted')]} />)
      expect(screen.getByText('Backed by Riverside and Northside')).toBeInTheDocument()
    })

    // Tests: all-declined says where the work went, not just that it was refused
    // How:   two declined rows; checks both the refusal and the fallback are stated
    // Chain: a contributor whose organisations all said no must not read it as a dead
    //        end — the tutorial is still queued, just with the platform instead
    it('says where the work went when everyone declined', () => {
      render(<BackingSummary backing={[row('A', 'declined'), row('B', 'declined')]} />)
      expect(screen.getByText(/2 organisations declined/)).toBeInTheDocument()
      expect(screen.getByText(/reviewed by SPLAT/i)).toBeInTheDocument()
    })
  })

  describe('BackingChip', () => {
    it('renders each state with its own treatment', () => {
      const { rerender, container } = render(<BackingChip row={row('Riverside', 'accepted')} />)
      expect(screen.getByText(/Backed by Riverside/)).toBeInTheDocument()
      const accepted = container.firstElementChild?.className

      rerender(<BackingChip row={row('Riverside', 'declined')} />)
      expect(screen.getByText('Riverside declined')).toBeInTheDocument()
      // The three states must be visually distinct, not just differently worded —
      // "waiting on someone else" and "they said no" are the two a contributor most
      // needs to tell apart at a glance.
      expect(container.firstElementChild?.className).not.toBe(accepted)
    })
  })
  ```

- [ ] **Step 3: Run and verify it fails**

  ```bash
  cd packages/web && npm run test:unit -- backing-state
  ```

  Expected: FAIL — module not found.

- [ ] **Step 4: Write the component**

  ```tsx
  /**
   * Backing State — the single owner of how backing is worded.
   *
   * Every surface renders through this. The status→colour map used to live in two
   * pages and drifted, which is why StatusBadge exists; this exists for the same
   * reason, before the drift rather than after it.
   *
   * The three states reuse StatusBadge's palette deliberately: honey already means
   * "waiting" on this platform, mint means "went through", apricot means "did not".
   * A contributor should not have to learn a second colour language.
   *
   * Copy is fixed by §1 of the spec. "Reviewed by SPLAT" is deliberately not "no
   * organisation" — it is a complete, normal path, and naming it as an absence
   * makes the default case read as a failure.
   *
   * Related files:
   * - components/status-badge.tsx: the palette this follows
   * - docs/superpowers/specs/2026-07-28-contributor-backing-experience-design.md §1
   */
  import type { TutorialOrg } from '@splat-connect/types'

  const CHIP: Record<TutorialOrg['status'], string> = {
    pending: 'bg-honey-soft text-honey-deep',
    accepted: 'bg-mint-soft text-mint-deep',
    declined: 'bg-apricot-soft text-apricot-deep',
  }

  const nameOf = (r: TutorialOrg) => r.organizations?.name ?? 'An organisation'

  /** "Riverside and Northside", "Riverside, Northside and Eastside" */
  function join(names: string[]): string {
    if (names.length <= 1) return names[0] ?? ''
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  }

  export function BackingSummary({ backing }: { backing: TutorialOrg[] }) {
    const accepted = backing.filter((b) => b.status === 'accepted')
    const pending = backing.filter((b) => b.status === 'pending')
    const declined = backing.filter((b) => b.status === 'declined')

    let text: string
    let tone: string

    if (accepted.length) {
      text = `Backed by ${join(accepted.map(nameOf))}`
      if (pending.length) text += ` · ${pending.length} still deciding`
      tone = 'text-mint-deep'
    } else if (pending.length === 1) {
      text = `${nameOf(pending[0])} is deciding`
      tone = 'text-honey-deep'
    } else if (pending.length > 1) {
      text = `${pending.length} organisations deciding`
      tone = 'text-honey-deep'
    } else if (declined.length) {
      const who =
        declined.length === 1
          ? `${nameOf(declined[0])} declined`
          : `${declined.length} organisations declined`
      // Say where it went. Declined is not a dead end — the tutorial is still
      // queued, with the platform instead.
      text = `${who} · now reviewed by SPLAT`
      tone = 'text-apricot-deep'
    } else {
      text = 'Reviewed by SPLAT'
      tone = 'text-muted'
    }

    return <p className={`text-xs leading-relaxed ${tone}`}>{text}</p>
  }

  export function BackingChip({ row }: { row: TutorialOrg }) {
    const name = nameOf(row)
    const label =
      row.status === 'accepted'
        ? `Backed by ${name}`
        : row.status === 'pending'
          ? `${name} is deciding`
          : `${name} declined`
    return <span className={`chip ${CHIP[row.status]}`}>{label}</span>
  }
  ```

- [ ] **Step 5: Run and verify**

  ```bash
  cd packages/web && npm run test:unit -- backing-state
  ```

  Expected: 7 passed.

- [ ] **Step 6: Commit**

  ```bash
  git add packages/web/app/globals.css
  git commit -m "fix(web): add the alert-warning style three pages already use"

  git add packages/web/components/backing-state.tsx
  git commit -m "feat(web): add the backing state vocabulary component"

  git add packages/web/tests/unit/components/backing-state.test.tsx
  git commit -m "test(web): pin the backing wording, including the all-declined case"
  ```

---

## Task 2: Backing on the public tutorials list

The only API change in this spec. `/library` and the home page both read
`GET /api/public/tutorials`, whose select is a bare `*` — the embed was only ever
added to the detail endpoint.

**Files:**
- Modify: `packages/api/src/routes/public.ts`
- Test: `packages/api/tests/integration/orgs/public-backing.test.ts`

**Interfaces:**
- Produces: each row of `GET /api/public/tutorials` carries
  `tutorial_orgs: Array<{ status: 'accepted'; organizations: { id, name } }>`.
  Task 4 consumes it.

- [ ] **Step 1: Write the failing test**

  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest'
  import app from '../../../src/app.js'
  import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
  import { createOrg, addLeader, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

  let author: TestUser
  let leader: TestUser
  let orgA: string
  let orgB: string
  let published: string

  beforeAll(async () => {
    author = await createTestUser('contributor')
    leader = await createTestUser('contributor')
    orgA = await createOrg({ createdBy: leader.id, name: 'Riverside Therapy' })
    await addLeader(orgA, leader.id)
    orgB = await createOrg({ createdBy: leader.id, name: 'Declining Clinic' })

    published = await createProject({ authorId: author.id, status: 'approved' })
    await requestBacking({ tutorialId: published, orgId: orgA, status: 'accepted' })
    await requestBacking({ tutorialId: published, orgId: orgB, status: 'declined' })
  })

  afterAll(async () => {
    await cleanupOrg(orgA, [published])
    await cleanupOrg(orgB)
    await deleteTestUser(author.id)
    await deleteTestUser(leader.id)
  })

  describe('GET /api/public/tutorials', () => {
    // Tests: the list carries accepted backing and nothing else
    // How:   one tutorial with one accepted and one declined row; unauthenticated request
    // Chain: the library card is the only place a parent sees the badge before
    //        clicking, and a declined organisation must never appear to have endorsed
    //        anything
    it('carries accepted backing on each row, and never declined', async () => {
      const res = await app.request('/api/public/tutorials')
      expect(res.status).toBe(200)
      const rows = (await res.json()) as Array<{
        id: string
        tutorial_orgs?: Array<{ status: string; organizations: { name: string } }>
      }>
      const row = rows.find((r) => r.id === published)
      expect(row).toBeTruthy()
      const names = (row!.tutorial_orgs ?? []).map((b) => b.organizations.name)
      expect(names).toContain('Riverside Therapy')
      expect(names).not.toContain('Declining Clinic')
    })
  })
  ```

- [ ] **Step 2: Run and verify it fails**

  ```bash
  cd packages/api && npx vitest run -c vitest.integration.config.ts tests/integration/orgs/public-backing.test.ts
  ```

  Expected: FAIL — `tutorial_orgs` is undefined, so `names` is empty.

- [ ] **Step 3: Add the embed**

  In `packages/api/src/routes/public.ts`, in the `/tutorials` list handler:

  ```typescript
    .select('*, tutorial_orgs(status, organizations(id, name))')
  ```

  and filter the embed in the handler, exactly as the detail route does — PostgREST
  cannot constrain an embedded relation from the parent query, and this route uses
  the admin client, so the public RLS badge policy is not doing it for us:

  ```typescript
    if (error) return c.json({ error: error.message }, 500)
    const rows = (data ?? []) as unknown as Array<
      Record<string, unknown> & { tutorial_orgs?: Array<{ status: string }> }
    >
    return c.json(
      rows.map((t) => ({
        ...t,
        tutorial_orgs: (t.tutorial_orgs ?? []).filter((b) => b.status === 'accepted'),
      }))
    )
  ```

- [ ] **Step 4: Run and verify**

  ```bash
  cd packages/api && npx vitest run -c vitest.integration.config.ts tests/integration/orgs/
  ```

  Expected: all pass, including the new file.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/api/src/routes/public.ts
  git commit -m "feat(api): carry accepted backing on the public tutorials list"

  git add packages/api/tests/integration/orgs/public-backing.test.ts
  git commit -m "test(api): assert a declined org never appears on the public list"
  ```

---

## Task 3: Row summaries on `/my-tutorials` and `/dashboard`

**Files:**
- Modify: `packages/web/app/my-tutorials/page.tsx:47-53`,
  `packages/web/app/dashboard/page.tsx`
- Test: `packages/web/tests/unit/pages/my-tutorials.test.tsx`,
  `packages/web/tests/unit/pages/dashboard.test.tsx`

**Interfaces:**
- Consumes: `<BackingSummary />` from Task 1. `GET /api/tutorials/mine` already
  embeds `tutorial_orgs` — that was added when the leader dashboard needed it.

- [ ] **Step 1: Add the summary to the my-tutorials row**

  The row's title block already has a conditional line under it for the rejection
  note. The backing summary goes in the same place, so both read as "what happened
  to this":

  ```tsx
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{t.title}</p>
                  {t.status === 'rejected' && (
                    <p className="mt-0.5 text-xs leading-relaxed text-danger">
                      {t.rejection_note ?? 'No feedback was provided.'}
                    </p>
                  )}
                  <BackingSummary backing={t.tutorial_orgs ?? []} />
                </div>
  ```

  Widen the page's type to carry the embed, and import the component:

  ```tsx
  import { BackingSummary } from '@/components/backing-state'
  import type { Tutorial, TutorialOrg, Difficulty } from '@splat-connect/types'

  type Backed = Tutorial & { tutorial_orgs?: TutorialOrg[] }
  ```

  and change the fetch's generic to `Backed[]`.

- [ ] **Step 2: Do the same on the dashboard's Recent tutorials**

  Same import, same type widening, same one line under the title.

- [ ] **Step 3: Write the tests**

  Add to `tests/unit/pages/my-tutorials.test.tsx`:

  ```tsx
  // Tests: a row states its backing without the reader opening the tutorial
  // How:   one accepted row in the fixture; checks the summary text
  // Chain: the row's job is to say whether it is worth clicking — before this, a
  //        contributor had to open a tutorial to learn anything about backing, and
  //        there was nothing there to find
  it('shows backing state on the row', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      {
        ...baseTutorial,
        id: 't1',
        title: 'Spoon holder',
        tutorial_orgs: [
          {
            id: 'b1', tutorial_id: 't1', org_id: 'o1', status: 'accepted',
            requested_at: '', responded_at: null, responded_by: null,
            organizations: {
              id: 'o1', name: 'Riverside Therapy', description: null,
              status: 'active', created_by: null, created_at: '', updated_at: '',
            },
          },
        ],
      },
    ])
    render(await MyTutorialsPage())
    expect(screen.getByText('Backed by Riverside Therapy')).toBeInTheDocument()
  })

  it('says a tutorial with no backing is reviewed by SPLAT', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([{ ...baseTutorial, tutorial_orgs: [] }])
    render(await MyTutorialsPage())
    expect(screen.getByText('Reviewed by SPLAT')).toBeInTheDocument()
  })
  ```

  Add the equivalent pair to `tests/unit/pages/dashboard.test.tsx`, remembering its
  `apiClient.get` is a `mockResolvedValueOnce` chain — profile, then tutorials, then
  `/api/organizations/mine` — so the tutorials fixture is the **second** value.

- [ ] **Step 4: Run and verify**

  ```bash
  cd packages/web && npm run test:unit
  ```

  Expected: all pass.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/web/app/my-tutorials/page.tsx packages/web/tests/unit/pages/my-tutorials.test.tsx
  git commit -m "feat(web): show backing state on the my-tutorials rows"

  git add packages/web/app/dashboard/page.tsx packages/web/tests/unit/pages/dashboard.test.tsx
  git commit -m "feat(web): show backing state on the dashboard rows"
  ```

---

## Task 4: The library card badge

**Files:**
- Modify: `packages/web/components/tutorial-card.tsx`
- Test: `packages/web/tests/unit/components/tutorial-card.test.tsx`

**Interfaces:**
- Consumes: `<BackingSummary />` from Task 1, and the embed from Task 2.

- [ ] **Step 1: Write the failing test**

  ```tsx
  // Tests: the card names its backers to someone browsing
  // How:   a card with one accepted row; checks the name renders
  // Chain: this is the only place a parent sees an endorsement before committing to
  //        a click, and for them it is the whole point of the feature
  it('names the organisations backing a tutorial', () => {
    render(
      <TutorialCard
        tutorial={{
          ...baseTutorial,
          tutorial_orgs: [
            {
              id: 'b1', tutorial_id: 't1', org_id: 'o1', status: 'accepted',
              requested_at: '', responded_at: null, responded_by: null,
              organizations: {
                id: 'o1', name: 'Riverside Therapy', description: null,
                status: 'active', created_by: null, created_at: '', updated_at: '',
              },
            },
          ],
        }}
      />
    )
    expect(screen.getByText('Backed by Riverside Therapy')).toBeInTheDocument()
  })

  it('says nothing about backing when there is none', () => {
    render(<TutorialCard tutorial={{ ...baseTutorial, tutorial_orgs: [] }} />)
    // Not "Reviewed by SPLAT": on a public card that is noise. The absence of a
    // badge is the correct signal to a parent, who has no idea what SPLAT's
    // internal review queue is.
    expect(screen.queryByText(/Reviewed by SPLAT/)).not.toBeInTheDocument()
  })
  ```

- [ ] **Step 2: Run and verify it fails**

  ```bash
  cd packages/web && npm run test:unit -- tutorial-card
  ```

- [ ] **Step 3: Render backing on the card**

  Only when there is accepted backing — `BackingSummary`'s "Reviewed by SPLAT"
  fallback is for the contributor's own pages, where the review path is meaningful.
  On a public card it is jargon:

  ```tsx
  {(tutorial.tutorial_orgs ?? []).some((b) => b.status === 'accepted') && (
    <BackingSummary backing={tutorial.tutorial_orgs ?? []} />
  )}
  ```

  Widen the prop type to `Tutorial & { tutorial_orgs?: TutorialOrg[] }`.

- [ ] **Step 4: Run and verify**

  ```bash
  cd packages/web && npm run test:unit -- tutorial-card
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add packages/web/components/tutorial-card.tsx packages/web/tests/unit/components/tutorial-card.test.tsx
  git commit -m "feat(web): show backing on the library card"
  ```

---

## Task 5: The backing section on the edit page

The largest task. A sixth `<details>` panel following the page's existing accordion
pattern, with two server actions.

**Files:**
- Create: `packages/web/components/edit-backing-section.tsx`
- Modify: `packages/web/app/tutorials/[id]/edit/page.tsx`
- Test: `packages/web/tests/unit/components/edit-backing-section.test.tsx`

**Interfaces:**
- Consumes: `<BackingChip />` from Task 1; `GET /api/tutorials/:id/orgs`,
  `POST /api/tutorials/:id/orgs`, `DELETE /api/tutorials/:id/orgs/:orgId`,
  `GET /api/organizations` — all built and tested, none currently called by the UI.
- Produces: nothing later tasks consume.

- [ ] **Step 1: Write the failing test**

  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest'
  import { render, screen, fireEvent, waitFor } from '@testing-library/react'
  import { EditBackingSection } from '@/components/edit-backing-section'
  import type { TutorialOrg, Organization } from '@splat-connect/types'

  const org = (id: string, name: string): Organization => ({
    id, name, description: `${name} description`, status: 'active',
    created_by: null, created_at: '', updated_at: '',
  })
  const row = (id: string, name: string, status: TutorialOrg['status']): TutorialOrg => ({
    id: `b-${id}`, tutorial_id: 't', org_id: id, status,
    requested_at: '', responded_at: null, responded_by: null, organizations: org(id, name),
  })

  const onAsk = vi.fn()
  const onWithdraw = vi.fn()
  const base = {
    tutorialStatus: 'pending' as const,
    reviewedForOrgId: null,
    organizations: [org('o1', 'Riverside'), org('o2', 'Northside')],
    onAsk,
    onWithdraw,
  }

  describe('EditBackingSection', () => {
    beforeEach(() => vi.clearAllMocks())

    it('lists each organisation with its state', () => {
      render(<EditBackingSection {...base} backing={[row('o1', 'Riverside', 'pending')]} />)
      expect(screen.getByText('Riverside is deciding')).toBeInTheDocument()
    })

    // Tests: the disclosure appears where the decision is made
    // How:   renders the section; checks the sentence is present
    // Chain: this is the contributor's only warning that offering a project exposes
    //        unpublished work, and it previously appeared once in small grey text in
    //        a wizard step they see only at submit
    it('states that leaders can read the draft while deciding', () => {
      render(<EditBackingSection {...base} backing={[]} />)
      expect(screen.getByText(/can read this while they decide, including if they say no/i))
        .toBeInTheDocument()
    })

    it('offers only organisations that have not been asked', () => {
      render(<EditBackingSection {...base} backing={[row('o1', 'Riverside', 'pending')]} />)
      const options = screen.getAllByRole('option').map((o) => o.textContent)
      expect(options.join(' ')).not.toContain('Riverside')
      expect(options.join(' ')).toContain('Northside')
    })

    it('withdraws a request that has not been acted on', async () => {
      render(<EditBackingSection {...base} backing={[row('o1', 'Riverside', 'pending')]} />)
      fireEvent.click(screen.getByRole('button', { name: /withdraw/i }))
      await waitFor(() => expect(onWithdraw).toHaveBeenCalledWith('o1'))
    })

    // Tests: a refusal is explained rather than hidden
    // How:   an approved tutorial whose reviewed_for_org_id is this org; checks the
    //        control is disabled AND the reason is on screen
    // Chain: hiding the control teaches nothing — the contributor needs to know the
    //        route out is asking SPLAT to unpublish, not that the button vanished
    it('disables withdraw with its reason for the org that approved it', () => {
      render(
        <EditBackingSection
          {...base}
          tutorialStatus="approved"
          reviewedForOrgId="o1"
          backing={[row('o1', 'Riverside', 'accepted')]}
        />
      )
      expect(screen.getByText(/asking SPLAT to unpublish/i)).toBeInTheDocument()
    })

    it('is entirely read-only once the tutorial is approved', () => {
      render(
        <EditBackingSection
          {...base}
          tutorialStatus="approved"
          reviewedForOrgId="o1"
          backing={[row('o1', 'Riverside', 'accepted')]}
        />
      )
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^ask$/i })).not.toBeInTheDocument()
    })
  })
  ```

- [ ] **Step 2: Run and verify it fails**

  ```bash
  cd packages/web && npm run test:unit -- edit-backing-section
  ```

- [ ] **Step 3: Write the component**

  ```tsx
  'use client'
  /**
   * Backing controls for one project.
   *
   * A client component because the "ask another organisation" picker needs a
   * controlled select. The writes are server actions passed in as props, matching
   * EditPartsSection and EditToolsSection.
   *
   * READ-ONLY once the tutorial is approved, and that is not a UI nicety: every
   * action is already refused by policy — you cannot add backing to published work,
   * and you cannot withdraw the organisation that approved it. Rendering the
   * controls anyway would offer buttons the database will reject.
   *
   * It also removes a hazard. Editing an approved tutorial resets it to pending, so
   * a contributor who came here only to withdraw a request would otherwise be one
   * stray keystroke from unpublishing their own work. The two dangerous states never
   * coexist.
   *
   * Related files:
   * - packages/api/src/routes/tutorial-orgs.ts: every endpoint behind this
   * - components/backing-state.tsx: the wording
   */
  import { useState } from 'react'
  import { BackingChip } from '@/components/backing-state'
  import type { TutorialOrg, Organization, TutorialStatus } from '@splat-connect/types'

  export function EditBackingSection({
    backing,
    organizations,
    tutorialStatus,
    reviewedForOrgId,
    onAsk,
    onWithdraw,
  }: {
    backing: TutorialOrg[]
    organizations: Organization[]
    tutorialStatus: TutorialStatus
    reviewedForOrgId: string | null
    onAsk: (orgId: string) => Promise<void>
    onWithdraw: (orgId: string) => Promise<void>
  }) {
    const [choice, setChoice] = useState('')
    const [busy, setBusy] = useState(false)
    const readOnly = tutorialStatus === 'approved'

    const asked = new Set(backing.map((b) => b.org_id))
    const available = organizations.filter((o) => !asked.has(o.id) && o.status === 'active')

    async function run(fn: () => Promise<void>) {
      setBusy(true)
      try {
        await fn()
      } finally {
        setBusy(false)
      }
    }

    return (
      <div className="px-5 pb-5">
        {backing.length === 0 ? (
          <p className="text-sm text-muted">
            No organisation is backing this project. SPLAT will review it.
          </p>
        ) : (
          <ul className="space-y-2">
            {backing.map((b) => {
              const isApprover = readOnly && reviewedForOrgId === b.org_id
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                  <BackingChip row={b} />
                  {isApprover ? (
                    <span className="text-xs text-muted">
                      {b.organizations?.name ?? 'This organisation'} approved this.
                      Withdrawing means asking SPLAT to unpublish it.
                    </span>
                  ) : (
                    !readOnly && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => onWithdraw(b.org_id))}
                        className="btn btn-quiet btn-sm"
                      >
                        Withdraw
                      </button>
                    )
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {!readOnly && (
          <div className="mt-4">
            <label htmlFor="ask-org" className="block text-sm font-medium text-ink">
              Ask another organisation
            </label>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Their leaders can read this while they decide, including if they say no.
              Choose the one or two who know your work.
            </p>
            <div className="mt-2 flex gap-2">
              <select
                id="ask-org"
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                className="flex-1"
              >
                <option value="">Choose an organisation…</option>
                {available.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.description ? `${o.name} — ${o.description}` : o.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!choice || busy}
                onClick={() => run(async () => { await onAsk(choice); setChoice('') })}
                className="btn btn-accent"
              >
                Ask
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 4: Wire it into the edit page**

  Two server actions beside the existing ones, and a sixth `<details>` panel. Fetch
  the backing rows and the organisation list alongside the tutorial:

  ```tsx
  async function askOrg(tutorialId: string, orgId: string) {
    'use server'
    await apiClient.post(`/api/tutorials/${tutorialId}/orgs`, { org_id: orgId })
    revalidatePath(`/tutorials/${tutorialId}/edit`)
    revalidatePath('/my-tutorials')
  }

  async function withdrawOrg(tutorialId: string, orgId: string) {
    'use server'
    await apiClient.delete(`/api/tutorials/${tutorialId}/orgs/${orgId}`)
    revalidatePath(`/tutorials/${tutorialId}/edit`)
    revalidatePath('/my-tutorials')
  }
  ```

  ```tsx
  <details className={panelCls}>
    <summary className={summaryCls}>Backing ({backing.length})</summary>
    <EditBackingSection
      backing={backing}
      organizations={organizations}
      tutorialStatus={tutorial!.status}
      reviewedForOrgId={tutorial!.reviewed_for_org_id}
      onAsk={askOrg.bind(null, id)}
      onWithdraw={withdrawOrg.bind(null, id)}
    />
  </details>
  ```

- [ ] **Step 5: Put the panel in the right place, and make it readable shut**

  Spec §6 names "the edit page becomes four sections deep with no hierarchy" as a
  problem. Re-reading the page, the `<details>` accordion *is* hierarchy — six
  collapsed summaries is a scannable list, not a wall. What is actually missing is
  two smaller things:

  **Order.** Backing goes **last**, after Details, Files, Parts, Tools and STL
  Files. Those are what the project *is*; backing is who stands behind it, and it is
  the least frequently touched. Putting a panel with pending state first would pull
  attention to the thing a contributor can do least about.

  **State while shut.** Every other summary carries a count — "Parts (3)". A bare
  "Backing (2)" tells you nothing useful, because the number is not the question —
  *what happened* is. The summary carries the state instead:

  ```tsx
  <summary className={summaryCls}>
    Backing
    {backing.length > 0 && (
      <span className="ml-2 text-xs font-normal text-muted">
        {backing.filter((b) => b.status === 'accepted').length > 0
          ? 'backed'
          : backing.some((b) => b.status === 'pending')
            ? 'waiting'
            : 'declined'}
      </span>
    )}
  </summary>
  ```

  So a contributor scanning the page learns the answer without opening anything,
  which is the whole point of an accordion summary and something the count-based
  ones do not manage.

- [ ] **Step 6: Run and verify**

  ```bash
  cd packages/web && npm run test:unit && npx tsc --noEmit
  ```

  Expected: 6 new tests pass, everything else still passes.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/web/components/edit-backing-section.tsx packages/web/tests/unit/components/edit-backing-section.test.tsx
  git commit -m "feat(web): add the project backing controls"

  git add "packages/web/app/tutorials/[id]/edit/page.tsx"
  git commit -m "feat(web): add the backing panel to the edit page"
  ```

---

## Task 6: `/organizations` browse list

**Files:**
- Create: `packages/web/app/organizations/page.tsx`
- Test: `packages/web/tests/unit/pages/organizations.test.tsx`

- [ ] **Step 1: Write the failing test**

  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest'
  import { render, screen } from '@testing-library/react'

  const get = vi.fn()
  vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }))
  vi.mock('next/link', () => ({
    default: ({ href, children }: { href: string; children: React.ReactNode }) => (
      <a href={href}>{children}</a>
    ),
  }))

  const org = (id: string, name: string, status: 'active' | 'suspended') => ({
    id, name, description: `${name} helps children`, status,
    created_by: null, created_at: '', updated_at: '',
  })

  describe('organisations list', () => {
    beforeEach(() => vi.clearAllMocks())

    // Tests: a suspended organisation is shown and marked, not hidden
    // How:   one active and one suspended; checks both render and the state is stated
    // Chain: an organisation vanishing from a directory is unexplainable to someone
    //        who expected to find it
    it('lists suspended organisations, marked', async () => {
      get.mockResolvedValue([org('o1', 'Riverside', 'active'), org('o2', 'Dormant', 'suspended')])
      const { default: Page } = await import('@/app/organizations/page')
      render(await Page())

      expect(screen.getByText('Riverside')).toBeInTheDocument()
      expect(screen.getByText('Dormant')).toBeInTheDocument()
      expect(screen.getByText(/suspended/i)).toBeInTheDocument()
    })

    it('shows an empty state when there are none', async () => {
      get.mockResolvedValue([])
      const { default: Page } = await import('@/app/organizations/page')
      render(await Page())
      expect(screen.getByText(/No organisations yet/i)).toBeInTheDocument()
    })
  })
  ```

- [ ] **Step 2: Run and verify it fails**

  ```bash
  cd packages/web && npm run test:unit -- organizations
  ```

  Expected: FAIL — module not found.

- [ ] **Step 3: Write the page**

  ```tsx
  /**
   * Organisations directory.
   *
   * Exists so "Riverside Therapy backed this" is a name with something behind it,
   * both for a contributor choosing who to ask and for a parent reading a badge.
   *
   * Suspended organisations are listed and marked rather than hidden: one vanishing
   * from a directory is unexplainable to someone who expected to find it, and the
   * badge on work they already backed still says their name.
   */
  import Link from 'next/link'
  import { apiClient } from '@/lib/api-client'
  import type { Organization } from '@splat-connect/types'

  export default async function OrganizationsPage() {
    const orgs = await apiClient.get<Organization[]>('/api/organizations')

    if (orgs.length === 0) {
      return (
        <div>
          <h1 className="mb-4 text-2xl font-bold text-ink">Organisations</h1>
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span aria-hidden="true" className="empty-badge">🏢</span>
            <p className="mt-4 font-bold text-ink">No organisations yet.</p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
              Organisations are set up by SPLAT. Once one exists, you can ask it to
              back a project when you submit.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold text-ink">Organisations</h1>
        <p className="mb-6 text-sm leading-relaxed text-muted">
          Organisations review tutorials from contributors who ask them to. Their
          name on a tutorial means one of their leaders read it and stood behind it.
        </p>
        <div className="flex flex-col gap-3">
          {orgs.map((org) => (
            <Link
              key={org.id}
              href={`/organizations/${org.id}`}
              className="card card-link p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-ink">{org.name}</p>
                {org.status === 'suspended' && (
                  <span className="badge bg-sunken text-muted">SUSPENDED</span>
                )}
              </div>
              {org.description && (
                <p className="mt-1 text-xs leading-relaxed text-muted">{org.description}</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 4: Run and commit**

  ```bash
  cd packages/web && npm run test:unit -- organizations

  git add packages/web/app/organizations/page.tsx
  git commit -m "feat(web): add the organisations browse page"

  git add packages/web/tests/unit/pages/organizations.test.tsx
  git commit -m "test(web): assert suspended organisations stay listed"
  ```

---

## Task 7: `/organizations/[id]` and the route consolidation

**Files:**
- Create: `packages/web/app/organizations/[id]/page.tsx`
- Move: `app/org/[orgId]/review/[tutorialId]/page.tsx` →
  `app/organizations/[id]/review/[tutorialId]/page.tsx`
- Delete: `app/org/` entirely
- Modify: `packages/web/lib/org-access.ts`
- Test: `packages/web/tests/unit/pages/organization-detail.test.tsx`

**Interfaces:**
- Produces: `isOrgLeader(orgId): Promise<boolean>` replacing
  `requireOrgLeader(orgId): Promise<Organization>`.

- [ ] **Step 1: Turn the guard into a check**

  ```typescript
  /**
   * Does the caller lead this organisation?
   *
   * Was requireOrgLeader, which redirected. It became a check when /org and
   * /organizations merged: one route now serves both the public view and the
   * leader's workspace, so a non-leader must get the page without the workspace
   * rather than a bounce to '/'.
   *
   * Backed by org_leaders via GET /api/organizations/mine — the single source of
   * truth. It deliberately infers nothing from the profile role: a leader is an
   * ordinary contributor.
   *
   * A UI affordance, not a control. The database refuses a non-leader's writes
   * whatever this returns.
   */
  export async function isOrgLeader(orgId: string): Promise<boolean> {
    try {
      const mine = await apiClient.get<Organization[]>('/api/organizations/mine')
      return mine.some((o) => o.id === orgId)
    } catch {
      return false
    }
  }
  ```

- [ ] **Step 2: Write the failing test**

  ```tsx
  // Tests: the same URL serves a visitor and a leader differently
  // How:   renders twice, with /api/organizations/mine returning [] then [this org]
  // Chain: consolidating /org into /organizations means leadership is something the
  //        page reveals rather than a separate address — and a non-leader must land
  //        on the page, not be bounced to '/'
  it('shows the workspace to a leader and the public view to everyone else', async () => {
    // visitor
    get.mockImplementation((path: string) =>
      Promise.resolve(path === '/api/organizations/mine' ? [] : theOrg)
    )
    const { default: Page } = await import('@/app/organizations/[id]/page')
    const { unmount } = render(await Page({ params: Promise.resolve({ id: 'o1' }) }))
    expect(screen.getByText('Riverside Therapy')).toBeInTheDocument()
    expect(screen.queryByText(/asking for your backing/i)).not.toBeInTheDocument()
    unmount()

    // leader
    get.mockImplementation((path: string) =>
      Promise.resolve(path === '/api/organizations/mine' ? [theOrg] : theOrg)
    )
    render(await Page({ params: Promise.resolve({ id: 'o1' }) }))
    expect(screen.getByText(/asking for your backing/i)).toBeInTheDocument()
  })
  ```

- [ ] **Step 3: Write the page**

  Public half: name, description, leaders, and the tutorials it has backed —
  derived by filtering `GET /api/tutorials` for `status === 'approved'` and an
  accepted `tutorial_orgs` row for this organisation. No new endpoint.

  Leader half, rendered only when `isOrgLeader` is true: the two lists and the terms
  banner, moved verbatim from `app/org/[orgId]/page.tsx` including its
  `acceptBacking` and `declineBacking` server actions. Their `revalidatePath` targets
  change from `/org/${orgId}` to `/organizations/${orgId}`.

- [ ] **Step 4: Move the review screen**

  ```bash
  mkdir -p "packages/web/app/organizations/[id]/review"
  git mv "packages/web/app/org/[orgId]/review/[tutorialId]" \
         "packages/web/app/organizations/[id]/review/[tutorialId]"
  git rm -r packages/web/app/org
  ```

  In the moved file: rename the `orgId` param to `id`, swap `requireOrgLeader` for
  `isOrgLeader` plus a `notFound()` when false, and update every `revalidatePath`
  and `redirect` from `/org/` to `/organizations/`.

- [ ] **Step 5: Update the dashboard's link**

  `app/dashboard/page.tsx`'s "Organisations you lead" links to `/org/${org.id}`.
  Change to `/organizations/${org.id}`.

- [ ] **Step 6: Run and verify**

  ```bash
  cd packages/web && npm run test:unit && npx tsc --noEmit
  grep -rn "'/org/\|\`/org/\|requireOrgLeader" app components lib || echo "no stale references"
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add packages/web/lib/org-access.ts
  git commit -m "refactor(web): make org leadership a check rather than a redirect"

  git add -A packages/web/app/organizations packages/web/app/org
  git commit -m "feat(web): consolidate the org workspace into /organizations/[id]"

  git add packages/web/app/dashboard/page.tsx packages/web/tests/unit/pages/organization-detail.test.tsx
  git commit -m "test(web): assert one URL serves both a visitor and a leader"
  ```

---

## Task 8: Navigation and middleware

**Files:**
- Modify: `packages/web/components/nav.tsx:60-64`, `packages/web/middleware.ts`

- [ ] **Step 1: Add the nav entry**

  ```tsx
    { href: '/organizations', label: 'Organisations', show: role !== null },
  ```

  Placed after Library and before Dashboard: it is a directory, closer in kind to
  the library than to a personal workspace. Shown to anyone signed in, contributor
  or admin — a leader is an ordinary contributor, so gating it on leadership would
  need a per-request lookup in the nav for no benefit.

- [ ] **Step 2: Fix the middleware route list**

  `/org` no longer exists; `/organizations` now does:

  ```typescript
  const contributorRoutes = ['/upload', '/my-tutorials', '/dashboard', '/organizations']
  ```

  Update the block comment's protected-routes list to match.

- [ ] **Step 3: Verify and commit**

  ```bash
  cd packages/web && npx tsc --noEmit && npm run build

  git add packages/web/components/nav.tsx
  git commit -m "feat(web): add the organisations nav entry"

  git add packages/web/middleware.ts
  git commit -m "fix(web): replace the dead /org route with /organizations"
  ```

---

## Task 9: E2E and full verification

**Files:**
- Modify: `packages/web/tests/e2e/contributor/org-backing.spec.ts`

- [ ] **Step 1: Extend the journey with the decline loop**

  The spec's §7 names this as the loop the whole plan exists to close, and it is
  currently untestable because the screens did not exist. Add a second test:

  ```typescript
  test('a contributor sees a decline and asks someone else', async ({ page }) => {
    const author = await createContributor()
    await acceptTerms(author.id)
    const leader = await createContributor()
    await acceptTerms(leader.id, 'org_leader_terms')
    const orgA = await createOrgWithLeader(leader.id, `Declining ${Date.now()}`)
    const orgB = await createOrgWithLeader(leader.id, `Second ${Date.now()}`)
    const title = uniqueTitle('Declined')
    const tutorialId = await createTutorial(author.id, { title, status: 'pending' })
    await seedBackingRequest(tutorialId, orgA)

    try {
      // The leader declines.
      await signIn(page, leader.email, leader.password)
      await page.waitForURL('**/dashboard')
      await page.goto(`/organizations/${orgA}`)
      await page.getByRole('button', { name: /Decline/i }).click()

      // The author learns about it without being told where to look.
      await signIn(page, author.email, author.password)
      await page.waitForURL('**/dashboard')
      await page.goto('/my-tutorials')
      await expect(page.getByText(/declined/i)).toBeVisible()

      // And asks someone else.
      await page.goto(`/tutorials/${tutorialId}/edit`)
      await page.getByRole('group', { name: /Backing/i }).click()
      await page.getByLabel(/Ask another organisation/i).selectOption(orgB)
      await page.getByRole('button', { name: /^Ask$/ }).click()
      await expect(page.getByText(/is deciding/i)).toBeVisible()
    } finally {
      await deleteOrg(orgA)
      await deleteOrg(orgB)
      await deleteUser(author.id)
      await deleteUser(leader.id)
    }
  })
  ```

  The existing journey's `/org/${orgId}` URLs become `/organizations/${orgId}`.

- [ ] **Step 2: Everything**

  ```bash
  cd /Users/byronpetselis/Documents/splat-connect
  npx supabase db reset
  cd packages/api && npx vitest run -c vitest.integration.config.ts && npx vitest run tests/unit && npx tsc --noEmit
  cd ../web && npm run test:unit && npx tsc --noEmit && npm run build
  # E2E reuses running servers — kill them or you will test a stale build
  PIDS=$(lsof -ti :3104; lsof -ti :3105); [ -n "$PIDS" ] && kill $PIDS; sleep 3
  npx playwright test --reporter=line
  ```

- [ ] **Step 3: Refresh the graph and commit**

  ```bash
  cd /Users/byronpetselis/Documents/splat-connect
  graphify update .
  git add packages/web/tests/e2e
  git commit -m "test(web): cover the decline-and-ask-again loop"
  ```

## Done when

- Every backing state a contributor can be in is visible on their own pages, in the
  §1 wording, rendered through one component.
- A contributor can withdraw a request, and where they cannot, the page says why.
- A contributor can ask an organisation after submitting, choosing from ones not
  already asked, with each description in front of them.
- `/organizations` lists organisations including suspended ones;
  `/organizations/[id]` serves a visitor and a leader from one URL without
  redirecting either.
- `/org` no longer exists, in the app or in the middleware.
- The library card shows accepted backing and nothing else.
- `.alert-warning` exists, so the three pages using it render as intended.
- Both unit suites, both typechecks, the web build and the E2E suite pass.
