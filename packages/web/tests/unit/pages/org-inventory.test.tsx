import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Toy } from '@splat-connect/types'

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})
let ledOrgs: Array<{ id: string; name: string }> = []

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor' },
    isAdmin: false,
    ledOrgs,
    exchangeActions: 0,
  }),
}))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('next/navigation', () => ({ notFound: () => notFound(), useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))
// A client component with its own state; this page only has to hand it the org.
vi.mock('@/components/org-pickup-form', () => ({
  OrgPickupForm: ({ orgId }: { orgId: string }) => <form data-testid={`pickup-${orgId}`} />,
}))

import { apiClient } from '@/lib/api-client'
import OrgInventoryPage from '@/app/dashboard/organisation/toys/page'

const ORG = { id: 'org-1', name: 'Cerebral Palsy Alliance' }
const PICKUP = {
  pickup_line1: '5 Association Way',
  pickup_suburb: 'Northbridge',
  pickup_state: 'NSW',
  pickup_postcode: '2063',
  pickup_instructions: null,
}

function toy(
  overrides: Partial<Toy & { has_history: boolean }> = {}
): Toy & { organizations: { name: string } | null; has_history?: boolean } {
  return {
    id: 't1',
    owner_id: null,
    owner_org_id: ORG.id,
    quantity: 5,
    name: 'Sensory bear',
    description: null,
    condition: 8,
    switch_adapted: false,
    photo_urls: [],
    cover_photo_url: null,
    switch_photo_url: null,
    status: 'published',
    offer_type: 'donation',
    created_at: '',
    updated_at: '',
    organizations: { name: ORG.name },
    ...overrides,
  }
}

// The page fetches inventory first, then one pickup per led org.
function mockFetches(toys: unknown[], pickup: unknown = PICKUP) {
  vi.mocked(apiClient.get).mockImplementation(async (path: string) =>
    path === '/api/toys/inventory'
      ? toys
      : path.startsWith('/api/toy-transactions')
        ? []
        : pickup
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  ledOrgs = [ORG]
})

describe('the organisation toy inventory page', () => {
  it('shows stock counts, because that is the thing this page exists to say', async () => {
    mockFetches([toy(), toy({ id: 't2', name: 'Light-up ball', quantity: 1 })])
    render(await OrgInventoryPage())

    expect(screen.getByText('5 in stock')).toBeInTheDocument()
    expect(screen.getByText('1 in stock')).toBeInTheDocument()
    expect(screen.getAllByText(ORG.name).length).toBeGreaterThan(0)
  })

  it('says out of stock rather than "0 in stock"', async () => {
    mockFetches([toy({ quantity: 0 })])
    render(await OrgInventoryPage())
    expect(screen.getByText('Out of stock')).toBeInTheDocument()
  })

  it('marks a retired toy with its reason, off the shelf count and the public listing', async () => {
    mockFetches([toy({ retired_at: '2026-09-30T00:00:00Z', retired_note: 'Cracked casing', has_history: true }), toy({ id: 't2', quantity: 2 })])
    render(await OrgInventoryPage())

    expect(screen.getByText('Retired')).toBeInTheDocument()
    expect(screen.getByText('Cracked casing')).toBeInTheDocument()
    expect(screen.getAllByText('Listing')).toHaveLength(1)
    expect(screen.getByText('2', { selector: '.count-chip__value' })).toBeInTheDocument()
    // A handover names it, so removing it would erase that record.
    expect(screen.queryByRole('button', { name: /Delete toy/ })).not.toBeInTheDocument()
  })

  it('WB12 offers removal only on a retired toy no handover names', async () => {
    mockFetches([toy({ retired_at: '2026-09-30T00:00:00Z', has_history: false }), toy({ id: 't2', has_history: false })])
    render(await OrgInventoryPage())
    expect(screen.getAllByRole('button', { name: /Delete toy/ })).toHaveLength(1)
  })

  it('warns when an org has no pickup address, since it can then accept nothing', async () => {
    mockFetches([toy()], null)
    render(await OrgInventoryPage())

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(ORG.name)
    expect(alert).toHaveTextContent(/cannot be accepted/i)
  })

  it('stays quiet once the address is set', async () => {
    mockFetches([toy()])
    render(await OrgInventoryPage())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('offers a pickup form per organisation the leader runs', async () => {
    ledOrgs = [ORG, { id: 'org-2', name: 'Second Org' }]
    mockFetches([])
    render(await OrgInventoryPage())

    expect(screen.getByTestId('pickup-org-1')).toBeInTheDocument()
    expect(screen.getByTestId('pickup-org-2')).toBeInTheDocument()
  })

  it('WB10 points "Add to inventory" and the empty-state "Add stock" at the organisation toy form', async () => {
    mockFetches([toy()])
    const { unmount } = render(await OrgInventoryPage())
    expect(screen.getByRole('link', { name: 'Add to inventory' })).toHaveAttribute('href', '/dashboard/toys/new?for=org')
    unmount()
    mockFetches([])
    render(await OrgInventoryPage())
    expect(screen.getByRole('link', { name: 'Add stock' })).toHaveAttribute('href', '/dashboard/toys/new?for=org')
  })

  it('WB11 links each card to its editor and public listing, and counts the shelf and what was delivered', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (path: string) =>
      path === '/api/toys/inventory'
        ? [toy({ quantity: 3 }), toy({ id: 't2', name: 'Draft ball', status: 'draft', quantity: 4 })]
        : path.startsWith('/api/toy-transactions')
          ? [
              { id: 'x1', owner_org_id: ORG.id, toy_id: 't1', status: 'completed' },
              { id: 'x2', owner_org_id: ORG.id, toy_id: 't1', status: 'requested' },
              { id: 'x3', owner_org_id: 'someone-else', toy_id: 't1', status: 'completed' },
            ]
          : PICKUP,
    )
    render(await OrgInventoryPage())
    expect(screen.getAllByRole('link', { name: 'Edit' }).map((a) => a.getAttribute('href'))).toEqual([
      '/dashboard/toys/t1',
      '/dashboard/toys/t2',
    ])
    expect(screen.getAllByRole('link', { name: 'Listing' }).map((a) => a.getAttribute('href'))).toEqual(['/toy-library/t1'])
    const chips = Array.from(document.querySelectorAll('.count-chip')).map((c) => c.textContent)
    expect(chips).toEqual(['3On the shelf', '1Delivered all time'])
  })

  it('is not reachable by someone who leads nothing', async () => {
    ledOrgs = []
    mockFetches([])
    await expect(OrgInventoryPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })
})
