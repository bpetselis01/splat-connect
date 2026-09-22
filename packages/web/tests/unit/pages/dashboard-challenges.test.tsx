import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardChallengesPage from '@/app/dashboard/challenges/page'
import type { ToyIdea } from '@splat-connect/types'

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'author-1', name: 'Sam', email: 'sam@example.com', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [],
    exchangeActions: 0,
  }),
}))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
// usePathname: components/boundary-link.tsx reads this; null is what the
// real hook returns outside an App Router context too.
vi.mock('next/navigation', () => ({ redirect: vi.fn(), usePathname: () => null }))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))
vi.mock('@/components/mark-notifications-read', () => ({
  MarkNotificationsRead: () => null,
}))

import { apiClient } from '@/lib/api-client'

function idea(overrides: Partial<ToyIdea> = {}): ToyIdea {
  return {
    id: 'idea-1',
    author_id: 'author-1',
    title: 'Big-button remote',
    summary: 'A remote a shaky hand can still use.',
    description: 'Full description',
    intended_use: 'Living room',
    primary_user: 'A child with limited grip',
    contact_prefs: [],
    status: 'pending',
    review_note: null,
    tutorial_id: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

// GET /api/ideas/mine and GET /api/ideas/joined share one apiClient.get mock,
// so each test routes on the path argument rather than call order.
function mockLists({ mine = [], joined = [] }: { mine?: ToyIdea[] | Error; joined?: ToyIdea[] | Error }) {
  vi.mocked(apiClient.get).mockImplementation(((path: string) => {
    const value = path === '/api/ideas/mine' ? mine : joined
    return value instanceof Error ? Promise.reject(value) : Promise.resolve(value)
  }) as typeof apiClient.get)
}

describe('DashboardChallengesPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the board\'s one empty state with both ways in when nothing is submitted or joined', async () => {
    mockLists({})
    render(await DashboardChallengesPage())
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /browse design challenges/i })[0]).toHaveAttribute(
      'href',
      '/get-involved/design-challenges'
    )
    expect(screen.queryByRole('group', { name: /filter challenges/i })).not.toBeInTheDocument()
  })

  it('shows an honest error for your ideas and still lists what you joined', async () => {
    mockLists({
      mine: new Error('API GET /api/ideas/mine failed with status 500'),
      joined: [idea({ id: 'idea-2', title: 'One-handed jar opener', status: 'challenge' })],
    })
    render(await DashboardChallengesPage())
    expect(screen.getByText(/could not load your ideas/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /one-handed jar opener/i })).toBeInTheDocument()
    // A failed list is not an empty one: no "Nothing here yet."
    expect(screen.queryByText('Nothing here yet.')).not.toBeInTheDocument()
  })

  it('shows an honest error for joined challenges and still lists your ideas', async () => {
    mockLists({ joined: new Error('API GET /api/ideas/joined failed with status 500'), mine: [idea()] })
    render(await DashboardChallengesPage())
    expect(screen.getByText(/could not load your joined challenges/i)).toBeInTheDocument()
    expect(screen.getByText('Big-button remote')).toBeInTheDocument()
  })

  it('shows one error when both lists fail', async () => {
    mockLists({ mine: new Error('500'), joined: new Error('500') })
    render(await DashboardChallengesPage())
    expect(screen.getByText(/could not load your challenges/i)).toBeInTheDocument()
    expect(screen.queryByText('Nothing here yet.')).not.toBeInTheDocument()
  })

  it('shows the review note on a rejected idea of your own', async () => {
    mockLists({ mine: [idea({ status: 'rejected', review_note: 'Too similar to an existing guide.' })] })
    render(await DashboardChallengesPage())
    expect(screen.getByText('Too similar to an existing guide.')).toBeInTheDocument()
    expect(screen.getAllByText('Declined').length).toBeGreaterThan(0)
  })

  it('says nothing extra when a rejected idea carries no review note', async () => {
    mockLists({ mine: [idea({ status: 'rejected', review_note: null })] })
    render(await DashboardChallengesPage())
    expect(screen.queryByText(/why it was not taken forward/i)).not.toBeInTheDocument()
  })

  it('does not link your own pending idea out to its public page', async () => {
    mockLists({ mine: [idea({ status: 'pending' })] })
    render(await DashboardChallengesPage())
    expect(screen.queryByRole('link', { name: /big-button remote/i })).not.toBeInTheDocument()
    expect(screen.getByText(/an admin reads every idea/i)).toBeInTheDocument()
  })

  it('does not link your own rejected idea out to its public page', async () => {
    mockLists({ mine: [idea({ status: 'rejected' })] })
    render(await DashboardChallengesPage())
    expect(screen.queryByRole('link', { name: /big-button remote/i })).not.toBeInTheDocument()
  })

  it('links your own open challenge out to its public page', async () => {
    mockLists({ mine: [idea({ status: 'challenge' })] })
    render(await DashboardChallengesPage())
    const link = screen.getByRole('link', { name: /big-button remote/i })
    expect(link).toHaveAttribute('href', '/get-involved/design-challenges/idea-1')
    expect(link).toHaveTextContent('View the brief')
  })

  it('links your own graduated idea out to its public page', async () => {
    mockLists({ mine: [idea({ status: 'graduated' })] })
    render(await DashboardChallengesPage())
    const link = screen.getByRole('link', { name: /big-button remote/i })
    expect(link).toHaveAttribute('href', '/get-involved/design-challenges/idea-1')
  })

  it('lists a joined challenge, always linked to its public page', async () => {
    mockLists({ joined: [idea({ id: 'idea-2', title: 'One-handed jar opener', status: 'challenge' })] })
    render(await DashboardChallengesPage())
    const link = screen.getByRole('link', { name: /one-handed jar opener/i })
    expect(link).toHaveAttribute('href', '/get-involved/design-challenges/idea-2')
    expect(link).toHaveTextContent('Open the thread')
  })

  it('filters by ?stage and counts each option', async () => {
    mockLists({
      mine: [idea({ id: 'a', status: 'pending' }), idea({ id: 'b', title: 'Kazoo', status: 'rejected' })],
      joined: [idea({ id: 'c', title: 'Jar opener', status: 'challenge' })],
    })
    const { unmount } = render(await DashboardChallengesPage())
    expect(screen.getByRole('link', { name: /mine 2/i })).toHaveAttribute('href', '/dashboard/challenges?stage=mine')
    unmount()
    render(await DashboardChallengesPage({ searchParams: Promise.resolve({ stage: 'declined' }) }))
    expect(screen.getByText('Kazoo')).toBeInTheDocument()
    expect(screen.queryByText('Jar opener')).not.toBeInTheDocument()
  })

  /*
   * The hub's Design challenges card names "Submit an idea" as one of the
   * things behind it, and that tag is text, not a link. This button is the
   * only route to the idea form from inside the account area — and it has to
   * survive having ideas already, which the empty-state button does not.
   */
  it('offers the idea form even when ideas already exist', async () => {
    mockLists({ mine: [idea({ status: 'pending' })] })
    render(await DashboardChallengesPage())
    expect(screen.getAllByRole('link', { name: /submit an idea/i })[0]).toHaveAttribute(
      'href',
      '/get-involved/submit-an-idea'
    )
  })
})
