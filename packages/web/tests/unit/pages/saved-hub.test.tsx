/**
 * /dashboard/saved — the menu the rail's Saved row opens.
 *
 * Two labelled groups rather than one flat five, unlike My SPLAT's deliberately
 * flat eight: five at 4-up strands one card, and the split here says something
 * true — three types work, two are drawn so the shape is visible.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Capabilities } from '@/lib/capabilities'

const caps = vi.hoisted(() => ({ current: null as Capabilities | null }))

const baseCaps = {
  profile: { id: 'p1', name: 'Test', role: 'contributor' },
  isAdmin: false,
  ledOrgs: [],
  canAuthor: true,
  unreadNotifications: 0,
  unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 0 },
  exchangeActions: 0,
} as unknown as Capabilities

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => caps.current,
}))

// Real redirect() throws rather than returning; the page's signed-out branch
// relies on that to stop rendering, so the mock must throw too.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
  usePathname: () => '/dashboard/saved',
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

const SavedHub = (await import('@/app/dashboard/saved/page')).default

beforeEach(() => {
  caps.current = baseCaps
  vi.clearAllMocks()
})

describe('SavedHub', () => {
  it('sends a signed-out visitor to sign in rather than rendering an empty menu', async () => {
    caps.current = null
    await expect(SavedHub()).rejects.toThrow('NEXT_REDIRECT')
  })

  it('splits the five types into what works and what is planned', async () => {
    render(await SavedHub())
    expect(screen.getByRole('heading', { name: 'Ready now' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Coming soon' })).toBeInTheDocument()
  })

  it('leads each live type to its own list', async () => {
    render(await SavedHub())
    expect(screen.getByRole('link', { name: /Tutorials/ })).toHaveAttribute(
      'href',
      '/dashboard/saved/tutorials'
    )
    expect(screen.getByRole('link', { name: /^Toys/ })).toHaveAttribute(
      'href',
      '/dashboard/saved/toys'
    )
    expect(screen.getByRole('link', { name: /Design challenges/ })).toHaveAttribute(
      'href',
      '/dashboard/saved/challenges'
    )
  })

  /*
   * The two placeholders are the whole reason this page is a hub rather than a
   * filtered list: they need somewhere to sit and say "planned" without leading
   * anywhere empty.
   */
  it('marks the two placeholders soon, and gives each its own route', async () => {
    render(await SavedHub())
    expect(screen.getAllByText('SOON')).toHaveLength(2)
    // Distinct hrefs, and real placeholder routes: a card pointing back at the
    // page you are on reads as broken, and two cards sharing an href collide
    // on HubGrid's key.
    expect(screen.getByRole('link', { name: /Organisations/ })).toHaveAttribute(
      'href',
      '/dashboard/saved/organisations'
    )
    expect(screen.getByRole('link', { name: /Printable parts/ })).toHaveAttribute(
      'href',
      '/dashboard/saved/parts'
    )
  })

  it('renders five cards in total', async () => {
    const { container } = render(await SavedHub())
    expect(container.querySelectorAll('a.card-pixel')).toHaveLength(5)
  })
})
