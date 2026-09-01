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
vi.mock('next/navigation', () => ({ notFound: () => notFound() }))
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

function toy(overrides: Partial<Toy> = {}): Toy & { organizations: { name: string } | null } {
  return {
    id: 't1',
    owner_id: null,
    owner_org_id: ORG.id,
    quantity: 5,
    name: 'Sensory bear',
    description: null,
    condition: 8,
    switch_adapted: false,
    cover_photo_url: null,
    switch_photo_urls: [],
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
    path === '/api/toys/inventory' ? toys : pickup
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

  it('is not reachable by someone who leads nothing', async () => {
    ledOrgs = []
    mockFetches([])
    await expect(OrgInventoryPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })
})
