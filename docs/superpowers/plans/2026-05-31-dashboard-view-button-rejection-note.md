# Dashboard View Button & Rejection Note Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the broken View button from the contributor dashboard, add always-visible rejection callouts on dashboard, my-tutorials, and edit pages, and create comprehensive unit test suites for all three pages.

**Architecture:** All changes are in three Next.js App Router server components. Tests use Vitest + React Testing Library, mocking `@/lib/api-client` and `next/navigation`. Each page is rendered via `render(await PageFn(...))` — the async server component pattern already used in `upload-page.test.tsx`.

**Tech Stack:** Next.js App Router (server components), Vitest, React Testing Library, @testing-library/jest-dom

---

## File Map

| Action | File |
|---|---|
| Create | `packages/web/tests/unit/pages/dashboard.test.tsx` |
| Modify | `packages/web/app/dashboard/page.tsx` |
| Create | `packages/web/tests/unit/pages/my-tutorials.test.tsx` |
| Modify | `packages/web/app/my-tutorials/page.tsx` |
| Create | `packages/web/tests/unit/pages/edit-tutorial.test.tsx` |
| Modify | `packages/web/app/tutorials/[id]/edit/page.tsx` |

---

## Task 1: Dashboard — tests + implementation

**Files:**
- Create: `packages/web/tests/unit/pages/dashboard.test.tsx`
- Modify: `packages/web/app/dashboard/page.tsx`

- [ ] **Step 1: Write failing tests**

Create `packages/web/tests/unit/pages/dashboard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardPage from '@/app/dashboard/page'
import type { Tutorial, Profile } from '@splat-connect/types'

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn() },
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('@/components/difficulty-badge', () => ({
  DifficultyBadge: () => null,
}))

import { apiClient } from '@/lib/api-client'
import { redirect } from 'next/navigation'

const mockProfile: Profile = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'contributor',
  approved: true,
  created_at: '2026-01-01T00:00:00Z',
}

const baseTutorial: Tutorial = {
  id: '1',
  title: 'Test Tutorial',
  difficulty: 'easy',
  status: 'approved',
  description: null,
  tutorial_pdf_url: null,
  toy_photo_url: null,
  rejection_note: null,
  created_at: '2026-01-01T00:00:00Z',
  reviewed_at: null,
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // Tests: redirects to /login when the profile API call fails
  // How:   mocks apiClient.get to throw and redirect to throw NEXT_REDIRECT;
  //        asserts the component throws and redirect('/login') was called
  // Chain: unauthenticated users cannot access the dashboard → they are sent to /login
  it('redirects to /login when profile API throws', async () => {
    vi.mocked(redirect).mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Unauthorized'))
    await expect(DashboardPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  // Tests: redirects to / when the logged-in user's role is not contributor
  // How:   mocks apiClient.get to return a profile with role: 'admin';
  //        asserts redirect('/') was called
  // Chain: non-contributors (e.g. admins) should not land on the contributor dashboard
  it('redirects to / when profile role is not contributor', async () => {
    vi.mocked(redirect).mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    vi.mocked(apiClient.get).mockResolvedValueOnce({ ...mockProfile, role: 'admin' })
    await expect(DashboardPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/')
  })

  // Tests: stats section renders Pending, Approved, Rejected labels with correct counts
  // How:   passes 2 pending + 1 approved + 3 rejected tutorials; checks counts 2, 1, 3
  // Chain: contributors scan the summary to track how many tutorials are in each state
  it('renders pending, approved, rejected counts', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce([
        { ...baseTutorial, id: '1', status: 'pending' },
        { ...baseTutorial, id: '2', status: 'pending' },
        { ...baseTutorial, id: '3', status: 'approved' },
        { ...baseTutorial, id: '4', status: 'rejected' },
        { ...baseTutorial, id: '5', status: 'rejected' },
        { ...baseTutorial, id: '6', status: 'rejected' },
      ])
    render(await DashboardPage())
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  // Tests: tutorial title and Edit link render for each row
  // How:   passes one tutorial with id 'abc'; checks title text and Edit link href
  // Chain: contributors identify tutorials by title and navigate to edit them
  it('renders tutorial title and Edit link', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce([{ ...baseTutorial, id: 'abc', title: 'Switch Tutorial' }])
    render(await DashboardPage())
    expect(screen.getByText('Switch Tutorial')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/tutorials/abc/edit')
  })

  // Tests: no View link is rendered for any tutorial status
  // How:   passes one tutorial per status (draft/pending/approved/rejected);
  //        asserts no link with text 'View' exists in the document
  // Chain: draft/pending/rejected tutorials have no public page — removing View for all
  //        statuses prevents the 404 and keeps the UI consistent
  it('does not render a View link for any tutorial status', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce([
        { ...baseTutorial, id: '1', status: 'draft' },
        { ...baseTutorial, id: '2', status: 'pending' },
        { ...baseTutorial, id: '3', status: 'approved' },
        { ...baseTutorial, id: '4', status: 'rejected' },
      ])
    render(await DashboardPage())
    expect(screen.queryByRole('link', { name: 'View' })).toBeNull()
  })

  // Tests: "View all N tutorials" link appears when tutorial count exceeds 5
  // How:   passes 6 tutorials; checks the View all link is present
  // Chain: dashboard shows only the 5 most recent → the link lets contributors see the full list
  it('shows "View all" link when tutorial count exceeds 5', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(Array.from({ length: 6 }, (_, i) => ({ ...baseTutorial, id: String(i) })))
    render(await DashboardPage())
    expect(screen.getByText(/view all 6 tutorials/i)).toBeInTheDocument()
  })

  // Tests: "View all" link is absent with 5 or fewer tutorials
  // How:   passes exactly 5 tutorials; checks "View all" text is not present
  // Chain: when all tutorials fit on the dashboard, no overflow link is needed
  it('does not show "View all" link with 5 or fewer tutorials', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => ({ ...baseTutorial, id: String(i) })))
    render(await DashboardPage())
    expect(screen.queryByText(/view all/i)).toBeNull()
  })

  // Tests: empty state message appears when the contributor has no tutorials
  // How:   passes an empty tutorials array; checks for the empty-state copy
  // Chain: first-time contributors see a prompt to create their first tutorial
  it('shows empty state when no tutorials', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce([])
    render(await DashboardPage())
    expect(screen.getByText(/haven't submitted any tutorials/i)).toBeInTheDocument()
  })

  // Tests: rejection note text is shown when a rejected tutorial has a note
  // How:   passes a rejected tutorial with rejection_note: 'Needs more detail';
  //        checks the note text appears in the document
  // Chain: contributor reads the admin's specific feedback and knows what to fix
  it('shows rejection note for rejected tutorial with a note', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce([{ ...baseTutorial, status: 'rejected', rejection_note: 'Needs more detail' }])
    render(await DashboardPage())
    expect(screen.getByText('Needs more detail')).toBeInTheDocument()
  })

  // Tests: fallback text appears when a rejected tutorial has no note
  // How:   passes a rejected tutorial with rejection_note: null;
  //        checks 'No feedback was provided.' appears
  // Chain: contributor knows their tutorial was rejected even when the admin gave no reason
  it('shows fallback text for rejected tutorial with no note', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce([{ ...baseTutorial, status: 'rejected', rejection_note: null }])
    render(await DashboardPage())
    expect(screen.getByText('No feedback was provided.')).toBeInTheDocument()
  })

  // Tests: rejection callout does not appear for draft, pending, or approved tutorials
  // How:   passes three tutorials with non-rejected statuses;
  //        asserts fallback text is not in the document
  // Chain: the callout is rejection-specific — other statuses must not show it
  it('does not show rejection callout for draft, pending, or approved tutorials', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce([
        { ...baseTutorial, id: '1', status: 'draft' },
        { ...baseTutorial, id: '2', status: 'pending' },
        { ...baseTutorial, id: '3', status: 'approved' },
      ])
    render(await DashboardPage())
    expect(screen.queryByText('No feedback was provided.')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/web && npx vitest run tests/unit/pages/dashboard.test.tsx --reporter=verbose
```

Expected failures: "does not render a View link for any tutorial status", "shows rejection note for rejected tutorial with a note", "shows fallback text for rejected tutorial with no note", "does not show rejection callout for draft, pending, or approved tutorials". The rest should pass.

- [ ] **Step 3: Implement changes in dashboard/page.tsx**

In `packages/web/app/dashboard/page.tsx`:

**Change 1** — Replace the `{t.rejection_note && ...}` block (around line 119):

Old:
```tsx
{t.rejection_note && (
  <p className="text-xs text-red-600 mt-0.5">
    Feedback: {t.rejection_note}
  </p>
)}
```

New:
```tsx
{t.status === 'rejected' && (
  <p className="text-xs text-red-600 mt-0.5">
    {t.rejection_note ?? 'No feedback was provided.'}
  </p>
)}
```

**Change 2** — Remove the View link entirely (around line 133):

Remove:
```tsx
<Link
  href={`/tutorials/${t.id}`}
  className="text-xs font-semibold text-gray-500 hover:underline"
>
  View
</Link>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/web && npx vitest run tests/unit/pages/dashboard.test.tsx --reporter=verbose
```

Expected: all 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/web/tests/unit/pages/dashboard.test.tsx packages/web/app/dashboard/page.tsx
git commit -m "feat: remove View button and add rejection callout on dashboard"
```

---

## Task 2: My-tutorials — tests + implementation

**Files:**
- Create: `packages/web/tests/unit/pages/my-tutorials.test.tsx`
- Modify: `packages/web/app/my-tutorials/page.tsx`

- [ ] **Step 1: Write failing tests**

Create `packages/web/tests/unit/pages/my-tutorials.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MyTutorialsPage from '@/app/my-tutorials/page'
import type { Tutorial } from '@splat-connect/types'

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn() },
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('@/components/difficulty-badge', () => ({
  DifficultyBadge: () => null,
}))

import { apiClient } from '@/lib/api-client'

const baseTutorial: Tutorial = {
  id: '1',
  title: 'Test Tutorial',
  difficulty: 'easy',
  status: 'approved',
  description: null,
  tutorial_pdf_url: null,
  toy_photo_url: null,
  rejection_note: null,
  created_at: '2026-01-01T00:00:00Z',
  reviewed_at: null,
}

describe('MyTutorialsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // Tests: tutorial title, uppercase status badge, and Edit link render for each row
  // How:   passes one draft tutorial with id 'abc'; checks title text, 'DRAFT' badge,
  //        and Edit link href
  // Chain: contributors scan this list to find and navigate to specific tutorials by title
  it('renders tutorial title, status badge, and Edit link', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([
      { ...baseTutorial, id: 'abc', title: 'Switch Tutorial', status: 'draft' },
    ])
    render(await MyTutorialsPage())
    expect(screen.getByText('Switch Tutorial')).toBeInTheDocument()
    expect(screen.getByText('DRAFT')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/tutorials/abc/edit')
  })

  // Tests: empty state message appears when the contributor has no tutorials
  // How:   passes an empty array; checks for the empty-state copy
  // Chain: first-time contributors see a prompt to create their first tutorial
  it('shows empty state when no tutorials', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([])
    render(await MyTutorialsPage())
    expect(screen.getByText(/haven't submitted any tutorials/i)).toBeInTheDocument()
  })

  // Tests: rejection note text appears when a rejected tutorial has a note
  // How:   passes a rejected tutorial with rejection_note: 'Needs more detail';
  //        checks the note text is in the document
  // Chain: contributor reads the admin's specific feedback inline from the list
  it('shows rejection note for rejected tutorial with a note', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([
      { ...baseTutorial, status: 'rejected', rejection_note: 'Needs more detail' },
    ])
    render(await MyTutorialsPage())
    expect(screen.getByText('Needs more detail')).toBeInTheDocument()
  })

  // Tests: fallback text appears when a rejected tutorial has no note
  // How:   passes a rejected tutorial with rejection_note: null;
  //        checks 'No feedback was provided.' is in the document
  // Chain: contributor knows their tutorial was rejected even when the admin gave no reason
  it('shows fallback text for rejected tutorial with no note', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([
      { ...baseTutorial, status: 'rejected', rejection_note: null },
    ])
    render(await MyTutorialsPage())
    expect(screen.getByText('No feedback was provided.')).toBeInTheDocument()
  })

  // Tests: rejection callout does not appear for draft, pending, or approved tutorials
  // How:   passes three tutorials with non-rejected statuses; asserts fallback text is absent
  // Chain: the callout is rejection-specific — other statuses must not show it
  it('does not show rejection callout for draft, pending, or approved tutorials', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([
      { ...baseTutorial, id: '1', status: 'draft' },
      { ...baseTutorial, id: '2', status: 'pending' },
      { ...baseTutorial, id: '3', status: 'approved' },
    ])
    render(await MyTutorialsPage())
    expect(screen.queryByText('No feedback was provided.')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/web && npx vitest run tests/unit/pages/my-tutorials.test.tsx --reporter=verbose
```

Expected failures: "shows rejection note for rejected tutorial with a note", "shows fallback text for rejected tutorial with no note", "does not show rejection callout for draft, pending, or approved tutorials".

- [ ] **Step 3: Implement changes in my-tutorials/page.tsx**

In `packages/web/app/my-tutorials/page.tsx`, replace the rejection_note guard (around line 51):

Old:
```tsx
{t.rejection_note && (
  <p className="text-xs text-red-600 mt-0.5">
    Feedback: {t.rejection_note}
  </p>
)}
```

New:
```tsx
{t.status === 'rejected' && (
  <p className="text-xs text-red-600 mt-0.5">
    {t.rejection_note ?? 'No feedback was provided.'}
  </p>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/web && npx vitest run tests/unit/pages/my-tutorials.test.tsx --reporter=verbose
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/web/tests/unit/pages/my-tutorials.test.tsx packages/web/app/my-tutorials/page.tsx
git commit -m "feat: add rejection callout on my-tutorials page"
```

---

## Task 3: Edit tutorial page — tests + implementation

**Files:**
- Create: `packages/web/tests/unit/pages/edit-tutorial.test.tsx`
- Modify: `packages/web/app/tutorials/[id]/edit/page.tsx`

- [ ] **Step 1: Write failing tests**

Create `packages/web/tests/unit/pages/edit-tutorial.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EditTutorialPage from '@/app/tutorials/[id]/edit/page'
import type { Profile, TutorialWithDetails } from '@splat-connect/types'

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('@/components/edit-files-section', () => ({
  EditFilesSection: () => null,
}))
vi.mock('@/components/add-stl-form', () => ({
  AddStlForm: () => null,
}))
vi.mock('@/components/edit-parts-section', () => ({
  EditPartsSection: () => null,
}))
vi.mock('@/components/edit-tools-section', () => ({
  EditToolsSection: () => null,
}))
vi.mock('@/components/submit-for-review-button', () => ({
  SubmitForReviewButton: () => <button>Submit for review</button>,
}))

import { apiClient } from '@/lib/api-client'
import { redirect } from 'next/navigation'

const mockProfile: Profile = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'contributor',
  approved: true,
  created_at: '2026-01-01T00:00:00Z',
}

const baseTutorialWithDetails: TutorialWithDetails = {
  id: 'tutorial-1',
  title: 'Test Tutorial',
  difficulty: 'easy',
  status: 'draft',
  description: null,
  tutorial_pdf_url: null,
  toy_photo_url: null,
  rejection_note: null,
  created_at: '2026-01-01T00:00:00Z',
  reviewed_at: null,
  parts: [],
  tools: [],
  stl_files: [],
  tutorial_contributors: [{
    tutorial_id: 'tutorial-1',
    profile_id: 'user-1',
    role: 'primary',
    added_at: '2026-01-01T00:00:00Z',
    profiles: mockProfile,
  }],
}

const pageParams = { params: Promise.resolve({ id: 'tutorial-1' }) }

describe('EditTutorialPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // Tests: redirects to /login when the profile API call fails
  // How:   mocks apiClient.get to throw on the first call, redirect to throw NEXT_REDIRECT;
  //        asserts the component throws and redirect('/login') was called
  // Chain: unauthenticated users cannot access the edit page
  it('redirects to /login when profile fetch throws', async () => {
    vi.mocked(redirect).mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Unauthorized'))
    await expect(EditTutorialPage(pageParams)).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  // Tests: redirects to /dashboard when the tutorial API call fails
  // How:   first call returns profile, second call throws; asserts redirect('/dashboard')
  // Chain: a missing or inaccessible tutorial sends the contributor back to their dashboard
  it('redirects to /dashboard when tutorial fetch throws', async () => {
    vi.mocked(redirect).mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockRejectedValueOnce(new Error('Not Found'))
    await expect(EditTutorialPage(pageParams)).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  // Tests: redirects to /dashboard when the current user is not a contributor on the tutorial
  // How:   returns a tutorial whose tutorial_contributors list has profile_id: 'different-user';
  //        asserts redirect('/dashboard')
  // Chain: contributors cannot edit tutorials they are not listed on
  it('redirects to /dashboard when user is not a contributor on the tutorial', async () => {
    vi.mocked(redirect).mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce({
        ...baseTutorialWithDetails,
        tutorial_contributors: [{
          ...baseTutorialWithDetails.tutorial_contributors[0],
          profile_id: 'different-user',
        }],
      })
    await expect(EditTutorialPage(pageParams)).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  // Tests: the tutorial title renders in the page heading
  // How:   renders with baseTutorialWithDetails (draft status); checks h1 text
  // Chain: contributors confirm they are editing the right tutorial before making changes
  it('renders the tutorial title', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(baseTutorialWithDetails)
    render(await EditTutorialPage(pageParams))
    expect(screen.getByRole('heading', { name: /test tutorial/i })).toBeInTheDocument()
  })

  // Tests: the submit-for-review section is shown when tutorial status is draft
  // How:   renders with baseTutorialWithDetails (status: 'draft');
  //        checks the submit prompt copy is visible
  // Chain: draft tutorials need to be submitted before they enter the review queue
  it('shows submit-for-review section when status is draft', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(baseTutorialWithDetails)
    render(await EditTutorialPage(pageParams))
    expect(screen.getByText(/submit this tutorial for admin review/i)).toBeInTheDocument()
  })

  // Tests: the submit-for-review section is absent when tutorial status is pending
  // How:   renders with status: 'pending'; asserts the submit copy is not in the document
  // Chain: a pending tutorial is already in the review queue — no re-submission needed
  it('hides submit-for-review section when status is pending', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce({ ...baseTutorialWithDetails, status: 'pending' })
    render(await EditTutorialPage(pageParams))
    expect(screen.queryByText(/submit this tutorial for admin review/i)).toBeNull()
  })

  // Tests: rejection banner heading and note text appear when status is rejected with a note
  // How:   renders with status: 'rejected', rejection_note: 'Needs more parts';
  //        checks both heading and note text are present
  // Chain: contributor lands on the edit page and immediately sees why the tutorial was rejected
  it('shows rejection banner with note when status is rejected', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce({ ...baseTutorialWithDetails, status: 'rejected', rejection_note: 'Needs more parts' })
    render(await EditTutorialPage(pageParams))
    expect(screen.getByText('This tutorial was rejected')).toBeInTheDocument()
    expect(screen.getByText('Needs more parts')).toBeInTheDocument()
  })

  // Tests: rejection banner shows fallback text when rejected with no note
  // How:   renders with status: 'rejected', rejection_note: null;
  //        checks heading and 'No feedback was provided.'
  // Chain: contributor knows their tutorial was rejected even with no admin explanation
  it('shows rejection banner with fallback text when rejection_note is null', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce({ ...baseTutorialWithDetails, status: 'rejected', rejection_note: null })
    render(await EditTutorialPage(pageParams))
    expect(screen.getByText('This tutorial was rejected')).toBeInTheDocument()
    expect(screen.getByText('No feedback was provided.')).toBeInTheDocument()
  })

  // Tests: no rejection banner when tutorial status is draft
  // How:   renders with baseTutorialWithDetails (status: 'draft');
  //        asserts the banner heading is not present
  // Chain: draft tutorials have not been reviewed — no rejection banner should appear
  it('does not show rejection banner when status is draft', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(baseTutorialWithDetails)
    render(await EditTutorialPage(pageParams))
    expect(screen.queryByText('This tutorial was rejected')).toBeNull()
  })

  // Tests: no rejection banner when tutorial status is pending
  // How:   renders with status: 'pending'; asserts the banner heading is not present
  // Chain: pending tutorials are awaiting review, not yet rejected
  it('does not show rejection banner when status is pending', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce({ ...baseTutorialWithDetails, status: 'pending' })
    render(await EditTutorialPage(pageParams))
    expect(screen.queryByText('This tutorial was rejected')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/web && npx vitest run tests/unit/pages/edit-tutorial.test.tsx --reporter=verbose
```

Expected failures: "shows rejection banner with note when status is rejected", "shows rejection banner with fallback text when rejection_note is null", "does not show rejection banner when status is draft", "does not show rejection banner when status is pending". The redirect and render tests should pass.

- [ ] **Step 3: Add rejection banner to edit/page.tsx**

In `packages/web/app/tutorials/[id]/edit/page.tsx`, insert the banner block after the back-link header row and before the draft submit section. The insertion point is after the closing `</div>` of the header row (around line 114) and before `{/* Submit for review -- draft only */}`:

```tsx
      {tutorial!.status === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-3">
          <p className="text-sm font-semibold text-red-700 mb-1">This tutorial was rejected</p>
          <p className="text-sm text-red-600">
            {tutorial!.rejection_note ?? 'No feedback was provided.'}
          </p>
        </div>
      )}
```

For clarity, the surrounding context after the change looks like this:

```tsx
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
          &larr; Dashboard
        </Link>
        <h1 className="text-xl font-bold truncate">{tutorial!.title}</h1>
      </div>

      {tutorial!.status === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-3">
          <p className="text-sm font-semibold text-red-700 mb-1">This tutorial was rejected</p>
          <p className="text-sm text-red-600">
            {tutorial!.rejection_note ?? 'No feedback was provided.'}
          </p>
        </div>
      )}

      {/* Submit for review -- draft only */}
      {tutorial!.status === 'draft' && (
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/web && npx vitest run tests/unit/pages/edit-tutorial.test.tsx --reporter=verbose
```

Expected: all 10 tests pass.

- [ ] **Step 5: Run full web test suite to verify no regressions**

```bash
cd packages/web && npx vitest run --reporter=verbose
```

Expected: all tests pass (existing suite + 26 new tests across the three new files).

- [ ] **Step 6: Commit**

```bash
git add packages/web/tests/unit/pages/edit-tutorial.test.tsx "packages/web/app/tutorials/[id]/edit/page.tsx"
git commit -m "feat: add rejection banner on tutorial edit page"
```
