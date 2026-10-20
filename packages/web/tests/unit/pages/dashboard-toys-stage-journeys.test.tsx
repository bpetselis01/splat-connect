import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import ToyListPage from '@/app/dashboard/toys/page'
import type { Toy } from '@splat-connect/types'
import { summary } from '../fixtures/transactions'

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'owner-1', name: 'Sam', email: 'sam@example.com', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [],
  }),
}))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), usePathname: () => null }))
import { apiClient } from '@/lib/api-client'

const toy = (overrides: Partial<Toy>): Toy =>
  ({ id: 't', owner_id: 'owner-1', owner_org_id: null, quantity: 1, name: 'Toy', description: null, condition: 8,
    switch_adapted: false, photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'draft',
    created_at: '', updated_at: '', offer_type: 'donation', ...overrides }) as Toy

function serve(toys: Toy[], transactions = [] as ReturnType<typeof summary>[]) {
  vi.mocked(apiClient.get).mockImplementation(async (path: string) => (path === '/api/toys' ? toys : transactions) as never)
}
const page = async (stage?: string) =>
  render(await ToyListPage({ searchParams: Promise.resolve({ stage }) }))

describe('/dashboard/toys', () => {
  beforeEach(() => vi.clearAllMocks())

  const toys = [
    toy({ id: 'live-1', name: 'Fire truck', status: 'published' }),
    toy({ id: 'asked-1', name: 'Robot', status: 'published' }),
    toy({ id: 'draft-1', name: 'Kite', status: 'draft' }),
  ]
  const asked = [summary({ id: 'tx-asked', toy_id: 'asked-1', status: 'requested' })]

  it('WY12 counts each stage on its chip and links each chip to ?stage=', async () => {
    serve(toys, asked)
    await page()
    const group = screen.getByRole('group', { name: 'Filter toys by status' })
    const chip = (name: RegExp) => within(group).getByRole('link', { name })
    expect(chip(/^All/)).toHaveAttribute('href', '/dashboard/toys')
    expect(chip(/^All/)).toHaveTextContent('All3')
    expect(chip(/^Needs you/)).toHaveAttribute('href', '/dashboard/toys?stage=needsyou')
    expect(chip(/^Needs you/)).toHaveTextContent('Needs you1')
    expect(chip(/^Live/)).toHaveTextContent('Live1')
    expect(chip(/^Hidden/)).toHaveAttribute('href', '/dashboard/toys?stage=hidden')
    expect(chip(/^Hidden/)).toHaveTextContent('Hidden1')
  })

  it('WY12 shows only the toys at the chosen stage', async () => {
    serve(toys, asked)
    await page('needsyou')
    const cards = screen.getAllByRole('link', { name: /Robot|Fire truck|Kite/ })
    expect(cards.map((a) => a.textContent)).toEqual([expect.stringContaining('Robot')])
    expect(screen.getByRole('link', { name: /^Needs you/ })).toHaveAttribute('aria-current', 'true')
  })

  it('WY13 offers Add a toy in the header, and Add your first toy on an empty shelf', async () => {
    serve(toys)
    const { unmount } = await page()
    expect(screen.getByRole('link', { name: 'Add a toy' })).toHaveAttribute('href', '/dashboard/toys/new')
    unmount()

    serve([])
    await page()
    expect(screen.getByText("You haven't added any toys yet.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add your first toy' })).toHaveAttribute('href', '/dashboard/toys/new')
  })

  it('WY14 links each toy card to its editor', async () => {
    serve(toys)
    await page()
    expect(screen.getByRole('link', { name: /Fire truck/ })).toHaveAttribute('href', '/dashboard/toys/live-1')
    expect(screen.getByRole('link', { name: /Kite/ })).toHaveAttribute('href', '/dashboard/toys/draft-1')
  })

  it('WY15 shows a donated toy under Given away, linking back to its handoff thread', async () => {
    serve([], [summary({ id: 'tx-done', toy_id: 'gone-1', toy_name: 'Drum', status: 'completed', other_party_name: 'Ash' })])
    await page()
    expect(screen.getByRole('heading', { name: 'Given away' })).toBeInTheDocument()
    const card = screen.getByRole('link', { name: /Drum/ })
    expect(card).toHaveAttribute('href', '/dashboard/exchanges/tx-done')
    expect(card).toHaveTextContent('Donated to Ash')
  })
})
