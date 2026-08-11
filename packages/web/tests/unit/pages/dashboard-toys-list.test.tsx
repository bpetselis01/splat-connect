import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ToyListPage from '@/app/dashboard/toys/page'
import type { Toy } from '@splat-connect/types'

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [],
    canAuthor: true,
    unreadNotifications: 0,
  }),
}))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

import { apiClient } from '@/lib/api-client'

function toy(overrides: Partial<Toy> = {}): Toy {
  return {
    id: 't1',
    owner_id: 'u1',
    name: 'Fire truck',
    description: null,
    condition: 8,
    switch_adapted: false,
    cover_photo_url: null,
    switch_photo_urls: [],
    status: 'draft',
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('ToyListPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('explains the page and offers Add a toy when there are none', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    render(await ToyListPage())
    expect(screen.getByText(/ready to offer for exchange/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add a toy/i })).toHaveAttribute('href', '/dashboard/toys/new')
  })

  it('renders one card per toy, each linking to its edit page', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      toy({ id: 't1', name: 'Fire truck' }),
      toy({ id: 't2', name: 'Blocks', status: 'published' }),
    ])
    render(await ToyListPage())
    expect(screen.getByRole('link', { name: /Fire truck/ })).toHaveAttribute('href', '/dashboard/toys/t1')
    expect(screen.getByRole('link', { name: /Blocks/ })).toHaveAttribute('href', '/dashboard/toys/t2')
  })

  it('shows a Draft badge only on draft toys', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      toy({ id: 't1', name: 'Fire truck', status: 'draft' }),
      toy({ id: 't2', name: 'Blocks', status: 'published' }),
    ])
    render(await ToyListPage())
    const fireTruckCard = screen.getByRole('link', { name: /Fire truck/ })
    const blocksCard = screen.getByRole('link', { name: /Blocks/ })
    expect(fireTruckCard).toHaveTextContent('Draft')
    expect(blocksCard).not.toHaveTextContent('Draft')
  })

  it('throws rather than rendering an empty list when the fetch fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('network'))
    await expect(ToyListPage()).rejects.toThrow('network')
  })
})
