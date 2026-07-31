import { render, screen, within } from '@testing-library/react'
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
  reviewed_by: null,
  reviewed_for_org_id: null,
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

  // Tests: a non-contributor profile (parent) renders the dashboard instead of redirecting
  // How:   mocks apiClient.get to return a profile with role: 'parent'; asserts the
  //        page renders normally and redirect is never called
  // Chain: parent and contributor are the same kind of account now, so the dashboard
  //        is not contributor-only — there is nowhere left for a parent to bounce to
  it('renders the dashboard for a non-contributor profile', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ ...mockProfile, role: 'parent' })
      .mockResolvedValueOnce([])
    render(await DashboardPage())
    expect(redirect).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'My tutorials' })).toBeInTheDocument()
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
    const pendingCard = screen.getByText('Pending').closest('div')!
    const approvedCard = screen.getByText('Approved').closest('div')!
    const rejectedCard = screen.getByText('Rejected').closest('div')!
    expect(within(pendingCard).getByText('2')).toBeInTheDocument()
    expect(within(approvedCard).getByText('1')).toBeInTheDocument()
    expect(within(rejectedCard).getByText('3')).toBeInTheDocument()
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

  // Tests: the merged page lists every tutorial, not the five most recent
  // Chain: /my-tutorials was the full list; merging it in means no truncation
  //        and no link out to a page that no longer exists
  it('lists every tutorial with no view-all link', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(
        Array.from({ length: 6 }, (_, i) => ({ ...baseTutorial, id: String(i), title: `T${i}` }))
      )
    render(await DashboardPage())
    expect(screen.getAllByTestId('tutorial-row')).toHaveLength(6)
    expect(screen.queryByRole('link', { name: /view all/i })).not.toBeInTheDocument()
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

  // Tests: the dashboard row states its backing, same wording as my-tutorials
  // How:   the second mockResolvedValueOnce is the tutorials list; one accepted row
  // Chain: both pages render through one component, so a contributor never sees the
  //        same state described two ways depending which page they landed on
  it('shows backing state on the recent tutorials rows', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce([
        {
          ...baseTutorial,
          id: 't1',
          title: 'Spoon holder',
          tutorial_orgs: [
            {
              id: 'b1', tutorial_id: 't1', org_id: 'o1', status: 'pending',
              requested_at: '', responded_at: null, responded_by: null,
              organizations: {
                id: 'o1', name: 'Riverside Therapy', description: null,
                status: 'active', created_by: null, created_at: '', updated_at: '',
              },
            },
          ],
        },
      ])
    render(await DashboardPage())
    expect(screen.getByText('Riverside Therapy is deciding')).toBeInTheDocument()
  })
})
