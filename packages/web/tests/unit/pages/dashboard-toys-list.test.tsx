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
vi.mock('@/components/boundary-link', () => ({
  BoundaryLink: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

import { apiClient } from '@/lib/api-client'

function toy(overrides: Partial<Toy> = {}): Toy {
  return {
    id: 't1',
    owner_id: 'u1',
    owner_org_id: null,
    quantity: 1,
    name: 'Fire truck',
    description: null,
    condition: 8,
    switch_adapted: false,
    cover_photo_url: null,
    switch_photo_urls: [],
    status: 'draft',
    created_at: '',
    updated_at: '',
    offer_type: null,
    archived_at: null,
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

  it('badges both statuses, not just draft', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      toy({ id: 't1', name: 'Fire truck', status: 'draft' }),
      toy({ id: 't2', name: 'Blocks', status: 'published' }),
    ])
    render(await ToyListPage())
    expect(screen.getByRole('link', { name: /Fire truck/ })).toHaveTextContent('DRAFT')
    // Published used to render no badge at all, so the card said nothing about
    // where the toy had got to.
    expect(screen.getByRole('link', { name: /Blocks/ })).toHaveTextContent('PUBLISHED')
  })

  it('colour-codes the status the way tutorials do', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      toy({ id: 't1', name: 'Fire truck', status: 'draft' }),
      toy({ id: 't2', name: 'Blocks', status: 'published' }),
    ])
    render(await ToyListPage())
    // Draft is byte-identical to a tutorial draft; published takes the mint
    // that approved uses.
    expect(screen.getByText('DRAFT')).toHaveClass('badge', 'bg-sunken', 'text-brand-deep')
    expect(screen.getByText('PUBLISHED')).toHaveClass('badge', 'bg-mint-soft', 'text-mint-deep')
  })

  it('throws rather than rendering an empty list when the fetch fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('network'))
    await expect(ToyListPage()).rejects.toThrow('network')
  })

  it('splits toys into Active and Archived sections', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      toy({ id: '1', name: 'Active toy', archived_at: null }),
      toy({ id: '2', name: 'Archived toy', archived_at: '2026-08-01T00:00:00Z' }),
    ])
    render(await ToyListPage())
    expect(screen.getByText('Active toy')).toBeInTheDocument()
    expect(screen.getByText('Archived toy')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /archived/i })).toBeInTheDocument()
  })

  it('shows the empty state when there are no active toys, even if archived toys exist', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([toy({ id: '1', archived_at: '2026-08-01T00:00:00Z' })])
    render(await ToyListPage())
    expect(screen.getByText(/haven't added any toys yet/i)).toBeInTheDocument()
  })

  it('omits the Archived heading when nothing is archived', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([toy({ id: '1', archived_at: null })])
    render(await ToyListPage())
    expect(screen.queryByRole('heading', { name: /archived/i })).not.toBeInTheDocument()
  })

  // Tests: the header offers a way into the public toy library
  // Chain: the My SPLAT card names "Browse toy library" as behind this tile,
  //        and the tile itself is text — this button is the only route
  it('gives My toys a way into the toy library', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    render(await ToyListPage())
    expect(screen.getByRole('link', { name: /browse toy library/i })).toHaveAttribute(
      'href',
      '/toy-library'
    )
  })
})
