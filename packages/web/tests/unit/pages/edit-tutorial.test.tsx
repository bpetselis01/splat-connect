import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EditTutorialPage from '@/app/tutorials/[id]/edit/page'
import type { Profile, TutorialWithDetails } from '@splat-connect/types'
import type { EditStep } from '@/lib/edit-steps'

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  // components/boundary-link.tsx reads this; null is what the real hook
  // returns outside an App Router context too.
  usePathname: () => null,
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('@/components/edit-files-section', () => ({ EditFilesSection: () => null }))
vi.mock('@/components/add-stl-form', () => ({ AddStlForm: () => null }))
vi.mock('@/components/edit-items-section', () => ({ EditItemsSection: () => null }))
vi.mock('@/components/edit-details-section', () => ({ EditDetailsSection: () => null }))
vi.mock('@/components/edit-backing-section', () => ({ EditBackingSection: () => null }))
vi.mock('@/components/edit-collaborators-section', () => ({ EditCollaboratorsSection: () => null }))
// Status and the missing-field list now reach the Review step's panel rather
// than the stepper, so that is where these are asserted.
vi.mock('@/components/tutorial-review-panel', () => ({
  TutorialReviewPanel: ({ status, missingFields }: { status: string; missingFields: string[] }) => (
    <div data-testid="review-panel" data-status={status} data-missing={missingFields.join('|')} />
  ),
}))
vi.mock('@/components/edit-stepper', () => ({
  // Renders each step's content, which is how the review panel above is
  // reached. Every section component is mocked to null, so this stays cheap.
  EditStepper: ({ steps }: { steps: EditStep[] }) => (
    <div data-testid="edit-stepper">
      {steps.map((s) => (
        <span key={s.id} data-step={s.id} data-step-status={s.status}>
          {s.content}
        </span>
      ))}
    </div>
  ),
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
  updated_at: '2026-01-01T00:00:00Z',
  reviewed_at: null,
  reviewed_by: null,
  reviewed_for_org_id: null,
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
    // The page makes two further reads after the ones each test sets up with
    // mockResolvedValueOnce — the backing rows and the organisation list for the
    // EditStepper's Backing step. Without a fallback those return undefined and
    // every test dies on it. Empty is the ordinary case: most projects have
    // asked nobody.
    vi.mocked(apiClient.get).mockResolvedValue([])
  })

  it('redirects to /login when profile fetch throws', async () => {
    vi.mocked(redirect).mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Unauthorized'))
    await expect(EditTutorialPage(pageParams)).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('redirects to /dashboard when tutorial fetch throws', async () => {
    vi.mocked(redirect).mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockRejectedValueOnce(new Error('Not Found'))
    await expect(EditTutorialPage(pageParams)).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

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

  it('renders the tutorial title', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(baseTutorialWithDetails)
    render(await EditTutorialPage(pageParams))
    expect(screen.getByRole('heading', { name: /test tutorial/i })).toBeInTheDocument()
  })

  it('shows the rejection banner with note when status is rejected', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce({ ...baseTutorialWithDetails, status: 'rejected', rejection_note: 'Needs more parts' })
    render(await EditTutorialPage(pageParams))
    expect(screen.getByText('This tutorial was rejected')).toBeInTheDocument()
    expect(screen.getByText('Needs more parts')).toBeInTheDocument()
  })

  it('shows the rejection banner with fallback text when rejection_note is null', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce({ ...baseTutorialWithDetails, status: 'rejected', rejection_note: null })
    render(await EditTutorialPage(pageParams))
    expect(screen.getByText('No feedback was provided.')).toBeInTheDocument()
  })

  it('does not show the rejection banner when status is draft', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(baseTutorialWithDetails)
    render(await EditTutorialPage(pageParams))
    expect(screen.queryByText('This tutorial was rejected')).toBeNull()
  })

  it('passes the tutorial status through to the Review panel', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce({ ...baseTutorialWithDetails, status: 'pending' })
    render(await EditTutorialPage(pageParams))
    expect(screen.getByTestId('review-panel')).toHaveAttribute('data-status', 'pending')
  })

  it('wires computeStepStatuses and getMissingFields into the step manifest', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(baseTutorialWithDetails)
    render(await EditTutorialPage(pageParams))
    const stepper = screen.getByTestId('edit-stepper')
    expect(screen.getByTestId('review-panel')).toHaveAttribute(
      'data-missing',
      'Tutorial PDF|Toy photo|At least one part|At least one tool'
    )
    expect(stepper.querySelector('[data-step="details"]')).toHaveAttribute('data-step-status', 'done')
    expect(stepper.querySelector('[data-step="files"]')).toHaveAttribute('data-step-status', 'attention')
    expect(stepper.querySelector('[data-step="parts"]')).toHaveAttribute('data-step-status', 'attention')
    expect(stepper.querySelector('[data-step="tools"]')).toHaveAttribute('data-step-status', 'attention')
    expect(stepper.querySelector('[data-step="stl"]')).toHaveAttribute('data-step-status', 'neutral')
    expect(stepper.querySelector('[data-step="backing"]')).toHaveAttribute('data-step-status', 'neutral')
    expect(stepper.querySelector('[data-step="collaborators"]')).toHaveAttribute('data-step-status', 'neutral')
  })

  it('adds a Review step, neutral while the tutorial is still a draft', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(baseTutorialWithDetails)
    render(await EditTutorialPage(pageParams))
    expect(
      screen.getByTestId('edit-stepper').querySelector('[data-step="review"]')
    ).toHaveAttribute('data-step-status', 'neutral')
  })

  it('marks the Review step done once the tutorial has been handed over', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce({ ...baseTutorialWithDetails, status: 'pending' })
    render(await EditTutorialPage(pageParams))
    expect(
      screen.getByTestId('edit-stepper').querySelector('[data-step="review"]')
    ).toHaveAttribute('data-step-status', 'done')
  })
})
