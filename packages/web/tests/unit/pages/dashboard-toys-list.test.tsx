import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ToyListPage from '@/app/dashboard/toys/page'
import type { Toy, ToyTransactionSummary } from '@splat-connect/types'

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [],
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
    photo_urls: [],
    cover_photo_url: null,
    switch_photo_url: null,
    status: 'draft',
    created_at: '',
    updated_at: '',
    offer_type: null,
    ...overrides,
  }
}

/** A completed handoff, as GET /api/toy-transactions returns it. */
function handoff(overrides: Partial<ToyTransactionSummary> = {}): ToyTransactionSummary {
  return {
    id: 'tx-1',
    toy_id: 'gone-1',
    offered_toy_id: null,
    type: 'donation',
    status: 'completed',
    requester_id: 'them',
    owner_id: 'u1',
    owner_org_id: null,
    owner_code: null,
    requester_code: null,
    owner_confirmed_at: null,
    requester_confirmed_at: null,
    pickup_line1: null,
    pickup_suburb: null,
    pickup_state: null,
    pickup_postcode: null,
    pickup_instructions: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-12T00:00:00Z',
    toy_name: 'Fire truck',
    toy_cover_photo_url: null,
    offered_toy_name: null,
    offered_toy_cover_photo_url: null,
    other_party_name: 'Priya',
    acting_for_org_name: null,
    blocked_by_rival_accept: false,
    last_message: null,
    ...overrides,
  } as ToyTransactionSummary
}

/** The page makes two calls now; answer them by path rather than by order. */
function respond(toys: unknown[], transactions: unknown[] = []) {
  vi.mocked(apiClient.get).mockImplementation((path: string) =>
    Promise.resolve(path === '/api/toys' ? toys : transactions) as never
  )
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

  it('lists a donated toy under Given away, naming who got it', async () => {
    respond([toy({ id: '1', name: 'Active toy' })], [handoff()])
    render(await ToyListPage())

    expect(screen.getByText('Active toy')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /given away/i })).toBeInTheDocument()
    expect(screen.getByText('Fire truck')).toBeInTheDocument()
    expect(screen.getByText('Donated to Priya')).toBeInTheDocument()
  })

  it('names what a swap was traded for', async () => {
    respond(
      [],
      [handoff({ type: 'exchange', offered_toy_id: 'toy-2', offered_toy_name: 'Spinning top' })]
    )
    render(await ToyListPage())
    expect(screen.getByText('Swapped with Priya for Spinning top')).toBeInTheDocument()
  })

  it('sends a given-away card to the handoff it came from', async () => {
    respond([], [handoff({ id: 'tx-9' })])
    render(await ToyListPage())
    expect(screen.getByRole('link', { name: /Fire truck/ })).toHaveAttribute(
      'href',
      '/dashboard/exchanges/tx-9'
    )
  })

  it('omits the Given away heading when nothing has been handed over', async () => {
    respond([toy({ id: '1' })], [])
    render(await ToyListPage())
    expect(screen.queryByRole('heading', { name: /given away/i })).not.toBeInTheDocument()
  })

  it('keeps the toys on screen when the handoff fetch fails', async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) =>
      path === '/api/toys'
        ? (Promise.resolve([toy({ id: '1', name: 'Still here' })]) as never)
        : (Promise.reject(new Error('down')) as never)
    )
    render(await ToyListPage())
    // The section is a nice-to-have; losing it must not lose the page.
    expect(screen.getByText('Still here')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /given away/i })).not.toBeInTheDocument()
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
