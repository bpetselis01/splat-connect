/**
 * /dashboard/saved — one card per saveable type, with how many are kept.
 * The board's single group of four: organisations went live, so the old
 * "Coming soon" group had nothing the board draws left in it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Capabilities } from '@/lib/capabilities'

const caps = vi.hoisted(() => ({ current: null as Capabilities | null }))

const baseCaps = {
  profile: { id: 'p1', name: 'Test', role: 'contributor' },
  isAdmin: false,
  ledOrgs: [],
  unread: { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 },
  exchangeActions: 0,
} as unknown as Capabilities

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => caps.current,
}))
// lib/saves imports api-client, which is server-only under vitest.
vi.mock('@/lib/saves', () => ({
  getSavedIds: async () => ({ tutorials: ['a', 'b'], toys: [], challenges: ['c'], organisations: [] }),
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

  it('leads each type to its own list', async () => {
    render(await SavedHub())
    for (const [name, slug] of [
      [/Tutorials/, 'tutorials'],
      [/^\d*\s*Toys/, 'toys'],
      [/Design challenges/, 'challenges'],
      [/Organisations/, 'organisations'],
    ] as const) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', `/dashboard/saved/${slug}`)
    }
  })

  it('counts what is kept of each type', async () => {
    render(await SavedHub())
    expect(screen.getByRole('link', { name: /Tutorials/ })).toHaveTextContent('2')
    expect(screen.getByRole('link', { name: /Design challenges/ })).toHaveTextContent('1')
  })

  it('renders four cards and no soon placeholders', async () => {
    const { container } = render(await SavedHub())
    expect(container.querySelectorAll('a.card')).toHaveLength(4)
    expect(screen.queryByText('SOON')).not.toBeInTheDocument()
  })
})
