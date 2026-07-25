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
