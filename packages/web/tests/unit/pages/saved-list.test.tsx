/**
 * /dashboard/saved/[type] — one route behind all three lists.
 *
 * The slug is validated against SAVE_SLUGS, the same object packages/api's
 * saves route validates against, so a type cannot half-exist: one missing key
 * gives both the API's 404 and this page's notFound().
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Capabilities } from '@/lib/capabilities'

const caps = vi.hoisted(() => ({ current: null as Capabilities | null }))
const listed = vi.hoisted(() => ({ current: [] as unknown[] }))

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

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: async () => listed.current },
}))

const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
}))
vi.mock('next/navigation', () => ({
  notFound,
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard/saved/tutorials',
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const SavedList = (await import('@/app/dashboard/saved/[type]/page')).default

const tutorial = {
  id: 't1',
  title: 'Switch-adapting a cash register',
  difficulty: 'easy',
  status: 'approved',
  description: 'A first adaptation.',
  toy_photo_url: 'https://example.com/p.jpg',
}

beforeEach(() => {
  caps.current = baseCaps
  listed.current = []
  vi.clearAllMocks()
})

describe('SavedList', () => {
  it('404s a slug that is not live', async () => {
    // organisations is in the save enum but has no source, exactly as the API
    // has none — one missing key, both behaviours.
    await expect(SavedList({ params: Promise.resolve({ type: 'organisations' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND'
    )
    expect(notFound).toHaveBeenCalled()
  })

  it('404s a slug that is not a save type at all', async () => {
    await expect(SavedList({ params: Promise.resolve({ type: 'bananas' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND'
    )
  })

  it('sends a signed-out visitor to sign in', async () => {
    caps.current = null
    await expect(SavedList({ params: Promise.resolve({ type: 'tutorials' }) })).rejects.toThrow(
      'NEXT_REDIRECT'
    )
  })

  it('titles itself after the type it is showing', async () => {
    render(await SavedList({ params: Promise.resolve({ type: 'toys' }) }))
    expect(screen.getByRole('heading', { name: 'Saved toys' })).toBeInTheDocument()
  })

  /*
   * The filled control IS the unsave affordance — there is no separate delete
   * UI, which is why this assertion matters more than it looks.
   */
  it('renders each saved item with its control already filled', async () => {
    listed.current = [tutorial]
    render(await SavedList({ params: Promise.resolve({ type: 'tutorials' }) }))
    expect(screen.getByText('Switch-adapting a cash register')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('says so when nothing is saved, and points at the right library', async () => {
    render(await SavedList({ params: Promise.resolve({ type: 'challenges' }) }))
    expect(screen.getByText(/Nothing saved yet/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Browse design challenges/ })).toHaveAttribute(
      'href',
      '/get-involved/design-challenges'
    )
  })
})
