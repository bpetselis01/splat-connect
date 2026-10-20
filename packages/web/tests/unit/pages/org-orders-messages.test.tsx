import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const leads = vi.hoisted(() => ({ orgs: [] as Array<{ id: string; name: string; status: string }> }))
const get = vi.hoisted(() => vi.fn())

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({ profile: { id: 'u1' }, isAdmin: false, ledOrgs: leads.orgs }),
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
  usePathname: () => '/dashboard/organisation/messages',
}))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }))
// The screen is shared with Print for others and has its own tests; this page only has to hand it the organisation.
vi.mock('@/app/dashboard/printers/page', () => ({
  PrintOfferScreen: (p: { orgId: string; title: string; lead: string }) => <p data-testid="offer">{`${p.orgId}|${p.title}|${p.lead}`}</p>,
}))

const Orders = (await import('@/app/dashboard/organisation/orders/page')).default
const Messages = (await import('@/app/dashboard/organisation/messages/page')).default

const NORTH = { id: 'oA', name: 'Splat North', status: 'active' }
const SOUTH = { id: 'oB', name: 'Splat South', status: 'active' }

beforeEach(() => {
  vi.clearAllMocks()
  leads.orgs = [NORTH]
})

describe('print orders', () => {
  it('WB14 hands the print-offer screen the acting organisation with the orders title and lead', async () => {
    render(await Orders())
    expect(screen.getByTestId('offer')).toHaveTextContent(
      'oA|Print orders|Every leader sees this queue. Pickup is always the organisation’s address.',
    )
  })

  it('WB14 is not reachable by someone who leads nothing', async () => {
    leads.orgs = []
    await expect(Orders()).rejects.toThrow('NEXT_NOT_FOUND')
  })
})

describe('organisation messages', () => {
  const conv = (id: string, person: string, updated: string, body: string, from: string) => ({
    id, person_name: person, profile_id: 'fam', updated_at: updated, last_message: { body, sender_id: from },
  })

  it('WB36 lists every led organisation’s conversations newest first, each linking to its thread', async () => {
    leads.orgs = [NORTH, SOUTH]
    get.mockImplementation(async (path: string) =>
      path === '/api/organizations/oA/conversations'
        ? [conv('c1', 'Ada', '2026-10-01T00:00:00Z', 'Is the bear free?', 'fam')]
        : [conv('c2', 'Ben', '2026-10-05T00:00:00Z', 'Yes, bring it.', 'leader')],
    )
    render(await Messages())
    const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/dashboard/messages/'))
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/dashboard/messages/c2', '/dashboard/messages/c1'])
    expect(links[0]).toHaveTextContent('Ben · Splat South')
    expect(links[0]).toHaveTextContent('You: Yes, bring it.')
    expect(links[1]).toHaveTextContent('Ada · Splat North')
    expect(links[1]).toHaveTextContent('Is the bear free?')
    expect(links[1]).not.toHaveTextContent('You:')
  })

  it('WB36 says nobody has written yet when there are no conversations', async () => {
    get.mockResolvedValue([])
    render(await Messages())
    expect(screen.getByText(/Nobody has written yet/)).toBeInTheDocument()
  })
})
