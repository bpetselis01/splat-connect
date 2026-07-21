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

  // Tests: "View all N tutorials" link appears when tutorial count exceeds 5
  // How:   passes 6 tutorials; checks the View all link is present
  // Chain: dashboard shows only the 5 most recent → the link lets contributors see the full list
  it('shows "View all" link when tutorial count exceeds 5', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(Array.from({ length: 6 }, (_, i) => ({ ...baseTutorial, id: String(i) })))
    render(await DashboardPage())
    expect(screen.getByRole('link', { name: /view all 6 tutorials/i })).toHaveAttribute('href', '/my-tutorials')
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
