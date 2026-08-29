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

  it('falls back to the empty state in both sections with nothing submitted or joined', async () => {
    mockLists({})
    render(await DashboardChallengesPage())
    expect(screen.getByText(/haven.t submitted an idea yet/i)).toBeInTheDocument()
    expect(screen.getByText(/haven.t joined a challenge yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /browse design challenges/i })).toHaveAttribute(
      'href',
      '/get-involved/design-challenges'
    )
  })

  it('shows an honest error on "Your ideas" without touching the joined section', async () => {
    mockLists({ mine: new Error('API GET /api/ideas/mine failed with status 500') })
    render(await DashboardChallengesPage())
    expect(screen.getByText(/could not load your ideas/i)).toBeInTheDocument()
    expect(screen.queryByText(/haven.t submitted an idea yet/i)).not.toBeInTheDocument()
    expect(screen.getByText(/haven.t joined a challenge yet/i)).toBeInTheDocument()
  })

  it('shows an honest error on "Challenges you joined" without touching the ideas section', async () => {
    mockLists({ joined: new Error('API GET /api/ideas/joined failed with status 500') })
    render(await DashboardChallengesPage())
    expect(screen.getByText(/could not load your joined challenges/i)).toBeInTheDocument()
    expect(screen.queryByText(/haven.t joined a challenge yet/i)).not.toBeInTheDocument()
    expect(screen.getByText(/haven.t submitted an idea yet/i)).toBeInTheDocument()
  })

  it('shows the review note on a rejected idea of your own', async () => {
    mockLists({ mine: [idea({ status: 'rejected', review_note: 'Too similar to an existing guide.' })] })
    render(await DashboardChallengesPage())
    expect(screen.getByText('Too similar to an existing guide.')).toBeInTheDocument()
    expect(screen.getByText('Not taken forward')).toBeInTheDocument()
  })

  it('says nothing extra when a rejected idea carries no review note', async () => {
    mockLists({ mine: [idea({ status: 'rejected', review_note: null })] })
    const { container } = render(await DashboardChallengesPage())
    expect(container.querySelector('.border-t')).not.toBeInTheDocument()
  })

  it('does not link your own pending idea out to its public page', async () => {
    mockLists({ mine: [idea({ status: 'pending' })] })
    render(await DashboardChallengesPage())
    expect(screen.queryByRole('link', { name: /big-button remote/i })).not.toBeInTheDocument()
    expect(screen.getByText('Pending review')).toBeInTheDocument()
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
    expect(screen.getByText('Looking for makers')).toBeInTheDocument()
  })

  it('links your own graduated idea out to its public page, badged as being written up rather than published', async () => {
    mockLists({ mine: [idea({ status: 'graduated' })] })
    render(await DashboardChallengesPage())
    const link = screen.getByRole('link', { name: /big-button remote/i })
    expect(link).toHaveAttribute('href', '/get-involved/design-challenges/idea-1')
    expect(screen.getByText('Being written up')).toBeInTheDocument()
  })

  it('lists a joined challenge, always linked to its public page', async () => {
    mockLists({ joined: [idea({ id: 'idea-2', title: 'One-handed jar opener', status: 'challenge' })] })
    render(await DashboardChallengesPage())
    const link = screen.getByRole('link', { name: /one-handed jar opener/i })
    expect(link).toHaveAttribute('href', '/get-involved/design-challenges/idea-2')
    expect(screen.getByText('Looking for makers')).toBeInTheDocument()
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
    expect(screen.getByRole('link', { name: /submit an idea/i })).toHaveAttribute(
      'href',
      '/get-involved/submit-an-idea'
    )
  })
})
