import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EditTutorialPage from '@/app/tutorials/[id]/edit/page'
import type { Profile, TutorialWithDetails } from '@splat-connect/types'
import type { EditStep } from '@/lib/edit-steps'

const { mockGetCapabilities } = vi.hoisted(() => ({ mockGetCapabilities: vi.fn() }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: mockGetCapabilities }))
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  // components/boundary-link.tsx reads this; null is what the real hook
  // returns outside an App Router context too.
  usePathname: () => null,
  // delete-entity-button.tsx pushes to redirectTo after a successful delete.
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
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
vi.mock('@/components/edit-recommendations-section', () => ({ EditRecommendationsSection: () => null }))
// The Review step is a summary and nothing else since 2026-08-29 — what is
// missing, and whether the tutorial has been handed over, reach the stepper's
// finish bar instead, so that is where both are asserted.
vi.mock('@/components/tutorial-review-panel', () => ({
  TutorialReviewPanel: ({ title }: { title: string }) => (
    <div data-testid="review-panel" data-title={title} />
  ),
}))
// Reads ?created= through hooks this test does not mock, and announces the
// redirect out of /upload rather than anything the page computes.
vi.mock('@/components/created-toast', () => ({ CreatedToast: () => null }))
vi.mock('@/components/stepper', () => ({
  // Renders each step's content, which is how the review panel above is
  // reached. Every section component is mocked to null, so this stays cheap.
  Stepper: ({ steps, finish }: { steps: EditStep[]; finish?: { missing: { step: string; label: string }[]; done?: unknown } }) => (
    <div
      data-testid="edit-stepper"
      data-missing={(finish?.missing ?? []).map((m) => `${m.step}:${m.label}`).join('|')}
      data-handed-over={finish?.done ? 'yes' : 'no'}
    >
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
  kind: 'toy_adaptation',
  status: 'draft',
  maturity: 'complete',
  safety_declared_at: '2026-08-01T00:00:00Z',
  description: null,
  tutorial_pdf_url: null,
  photo_urls: [],
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
  tutorial_recommendations: [],
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
    // the Team step's Backing panel. Without a fallback those return undefined and
    // every test dies on it. Empty is the ordinary case: most projects have
    // asked nobody.
    vi.mocked(apiClient.get).mockResolvedValue([])
    mockGetCapabilities.mockResolvedValue({
      profile: mockProfile,
      isAdmin: false,
      ledOrgs: [],
      unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 0 },
      exchangeActions: 0,
    })
  })

  it('redirects to /login when there is no signed-in account', async () => {
    vi.mocked(redirect).mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    mockGetCapabilities.mockResolvedValue(null)
    await expect(EditTutorialPage(pageParams)).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('redirects to /dashboard when tutorial fetch throws', async () => {
    vi.mocked(redirect).mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce(new Error('Not Found'))
    await expect(EditTutorialPage(pageParams)).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  it('redirects to /dashboard when user is not a contributor on the tutorial', async () => {
    vi.mocked(redirect).mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    vi.mocked(apiClient.get)
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
      .mockResolvedValueOnce(baseTutorialWithDetails)
    render(await EditTutorialPage(pageParams))
    expect(screen.getByRole('heading', { name: /test tutorial/i })).toBeInTheDocument()
  })

  it('shows the rejection banner with note when status is rejected', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ ...baseTutorialWithDetails, status: 'rejected', rejection_note: 'Needs more parts' })
    render(await EditTutorialPage(pageParams))
    expect(screen.getByText('This tutorial was rejected')).toBeInTheDocument()
    expect(screen.getByText('Needs more parts')).toBeInTheDocument()
  })

  it('shows the rejection banner with fallback text when rejection_note is null', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ ...baseTutorialWithDetails, status: 'rejected', rejection_note: null })
    render(await EditTutorialPage(pageParams))
    expect(screen.getByText('No feedback was provided.')).toBeInTheDocument()
  })

  it('does not show the rejection banner when status is draft', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(baseTutorialWithDetails)
    render(await EditTutorialPage(pageParams))
    expect(screen.queryByText('This tutorial was rejected')).toBeNull()
  })

  describe('deleting a draft', () => {
    it('offers delete on a draft', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(baseTutorialWithDetails)
      render(await EditTutorialPage(pageParams))
      expect(screen.getByRole('button', { name: /delete draft/i })).toBeInTheDocument()
    })

    // Absent, not disabled: RLS refuses the delete off a draft, so a control
    // here would be one that cannot work.
    it.each(['pending', 'approved', 'rejected'] as const)(
      'offers no delete on a %s guide',
      async (status) => {
        vi.mocked(apiClient.get).mockResolvedValueOnce({ ...baseTutorialWithDetails, status })
        render(await EditTutorialPage(pageParams))
        expect(screen.queryByRole('button', { name: /delete draft/i })).not.toBeInTheDocument()
      }
    )
  })

  // Chain: a tutorial that has been handed over has nothing left to finish, so the
  //        bar shows when it was last saved instead of a control that would submit
  //        the same work twice
  it('tells the finish bar the tutorial has been handed over', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ ...baseTutorialWithDetails, status: 'pending' })
    render(await EditTutorialPage(pageParams))
    expect(screen.getByTestId('edit-stepper')).toHaveAttribute('data-handed-over', 'yes')
  })

  it('leaves the finish bar open while the tutorial is still a draft', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(baseTutorialWithDetails)
    render(await EditTutorialPage(pageParams))
    expect(screen.getByTestId('edit-stepper')).toHaveAttribute('data-handed-over', 'no')
  })

  // The one step that depends on kind. Its absence for a toy is the whole
  // reason kind exists — nobody should be asked for a file they do not have.
  it('shows the STL step only for an assistive-tech tutorial', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(baseTutorialWithDetails)
    const { unmount } = render(await EditTutorialPage(pageParams))
    expect(document.querySelector('[data-step="stl"]')).toBeNull()
    expect(document.querySelector('[data-step="recommended"]')).not.toBeNull()
    unmount()

    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ ...baseTutorialWithDetails, kind: 'assistive_tech' })
    render(await EditTutorialPage(pageParams))
    expect(document.querySelector('[data-step="stl"]')).toHaveAttribute('data-step-status', 'attention')
  })

  it('wires computeStepStatuses and getMissingFields into the step manifest', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(baseTutorialWithDetails)
    render(await EditTutorialPage(pageParams))
    const stepper = screen.getByTestId('edit-stepper')
    // Each gap paired with the step that closes it, which is what lets the bar
    // hand over the fix rather than only name the problem.
    expect(stepper).toHaveAttribute(
      'data-missing',
      'files:The guide PDF|files:A photo|parts:A part|tools:A tool'
    )
    expect(stepper.querySelector('[data-step="details"]')).toHaveAttribute('data-step-status', 'done')
    expect(stepper.querySelector('[data-step="files"]')).toHaveAttribute('data-step-status', 'attention')
    expect(stepper.querySelector('[data-step="parts"]')).toHaveAttribute('data-step-status', 'attention')
    expect(stepper.querySelector('[data-step="tools"]')).toHaveAttribute('data-step-status', 'attention')
    // No STL pill on a toy adaptation; see the kind test above.
    expect(stepper.querySelector('[data-step="stl"]')).toBeNull()
    expect(stepper.querySelector('[data-step="recommended"]')).toHaveAttribute('data-step-status', 'neutral')
    expect(stepper.querySelector('[data-step="team"]')).toHaveAttribute('data-step-status', 'neutral')
  })

  it('adds a Review step, neutral while the tutorial is still a draft', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(baseTutorialWithDetails)
    render(await EditTutorialPage(pageParams))
    expect(
      screen.getByTestId('edit-stepper').querySelector('[data-step="review"]')
    ).toHaveAttribute('data-step-status', 'neutral')
  })

  it('marks the Review step done once the tutorial has been handed over', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ ...baseTutorialWithDetails, status: 'pending' })
    render(await EditTutorialPage(pageParams))
    expect(
      screen.getByTestId('edit-stepper').querySelector('[data-step="review"]')
    ).toHaveAttribute('data-step-status', 'done')
  })
})
