import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardPage from '@/app/dashboard/tutorials/page'
import type { Tutorial, Profile } from '@splat-connect/types'

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn() },
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  // components/boundary-link.tsx (rendered here and by
  // components/dashboard-tutorial-card.tsx) reads this; null is what the
  // real hook returns outside an App Router context too.
  usePathname: () => null,
}))
// Spreads the rest: the card carries data-testid on the Link itself, and a
// mock that forwarded only href/className would silently swallow it.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock('@/components/difficulty-badge', () => ({
  DifficultyBadge: () => null,
}))
vi.mock('@/components/mark-notifications-read', () => ({
  MarkNotificationsRead: () => null,
}))

import { apiClient } from '@/lib/api-client'
import { redirect } from 'next/navigation'

const mockProfile: Profile = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'contributor',
  created_at: '2026-01-01T00:00:00Z',
  public_showcase: true,
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
  updated_at: '2026-01-01T00:00:00Z',
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

  // Tests: the whole card is the link to the editor, with no separate Edit button
  // How:   passes one tutorial with id 'abc'; checks title text and the card's href
  // Chain: contributors identify tutorials by title and navigate to edit them by
  //        clicking anywhere on the card, as they already do on My toys
  it('renders the tutorial title and links the whole card to the editor', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce([{ ...baseTutorial, id: 'abc', title: 'Switch Tutorial' }])
    render(await DashboardPage())
    expect(screen.getByText('Switch Tutorial')).toBeInTheDocument()
    expect(screen.getByTestId('tutorial-row')).toHaveAttribute('href', '/tutorials/abc/edit')
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull()
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

  // Tests: the header offers a way into the public library alongside the
  //        primary "New tutorial" action
  // Chain: the My SPLAT card names "Browse the library" as behind this tile,
  //        and the tile itself is text — this button is the only route
  it('gives My tutorials a way into the public library', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce([])
    render(await DashboardPage())
    expect(screen.getByRole('link', { name: /browse the library/i })).toHaveAttribute(
      'href',
      '/library'
    )
  })

  // Tests: the primary action stays put once the browse link is added
  it('keeps the primary action on My tutorials', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce([])
    render(await DashboardPage())
    expect(screen.getByRole('link', { name: /new tutorial/i })).toHaveAttribute('href', '/upload')
  })

  // Tests: the Saved button now ships and leads somewhere real
  // How:   renders the page and checks the link's href
  // Chain: this assertion used to be its inverse — "ships no Saved button yet",
  //        because the saves subsystem had no table and no route, and a button
  //        leading nowhere is worse than an absent one. 044_saves.sql and
  //        /api/saves landed, so the condition it was waiting on is gone.
  //        It skips the saved hub deliberately: the label names a destination,
  //        so it goes to the destination.
  it('leads to the saved tutorials list', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce([])
    render(await DashboardPage())
    expect(screen.getByRole('link', { name: /saved tutorials/i })).toHaveAttribute(
      'href',
      '/dashboard/saved/tutorials'
    )
  })
})
