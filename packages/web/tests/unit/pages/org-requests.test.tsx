import { describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [{ id: 'oA', name: 'Splat North', status: 'active' }],
  }),
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))

const tx = (over: Record<string, unknown>) => ({
  id: 'x', type: 'donation', status: 'requested', owner_org_id: 'oA', requester_name: 'Ada', toy_name: 'Bear',
  tutorial_title: null, created_at: new Date().toISOString(), last_message: null, ...over,
})
const rows = [
  tx({ id: 'd1', type: 'donation', toy_name: 'Sensory bear' }),
  tx({ id: 'd2', type: 'exchange', status: 'accepted', toy_name: 'Drum', requester_name: 'Ben' }),
  tx({ id: 'p1', type: 'print', tutorial_title: 'Cradle', requester_name: 'Cy' }),
  tx({ id: 'b1', type: 'build', status: 'accepted', tutorial_title: 'Switch mount', requester_name: 'Di' }),
  tx({ id: 'z1', type: 'donation', toy_name: 'Elsewhere', owner_org_id: 'oOther' }),
  tx({ id: 'z2', type: 'donation', toy_name: 'Finished', status: 'completed' }),
]
vi.mock('@/lib/api-client', () => ({ apiClient: { get: async () => rows } }))

const Page = (await import('@/app/dashboard/organisation/requests/page')).default
const open = async (tab?: string) => {
  cleanup()
  render(await Page({ searchParams: Promise.resolve({ tab }) }))
}

describe('Requests to your organisation', () => {
  it('WB08 shows a tab per request kind with its pending count, and opens on the first with something waiting', async () => {
    await open()
    expect(screen.getByRole('heading', { name: 'Requests to Splat North' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Kind of request' })
    expect(within(nav).getByRole('link', { name: /Lend a toy/ })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: /Lend a toy/ })).toHaveTextContent('Lend a toy1')
    expect(within(nav).getByRole('link', { name: /Print parts/ })).toHaveTextContent('Print parts1')
    expect(within(nav).getByRole('link', { name: /Build a guide/ })).toHaveTextContent('Build a guide')
    expect(within(nav).getByRole('link', { name: /Build a guide/ })).not.toHaveTextContent(/\d/)
    expect(within(nav).getByRole('link', { name: /Print parts/ })).toHaveAttribute('href', '?tab=parts')
    expect(screen.getByText('Sensory bear')).toBeInTheDocument()
    expect(screen.queryByText('Elsewhere')).not.toBeInTheDocument()
    expect(screen.queryByText('Finished')).not.toBeInTheDocument()
  })

  it('WB08 lists the waiting request before the one under way, and says so when a tab is empty', async () => {
    await open('toys')
    const names = screen.getAllByText(/Sensory bear|Drum/).map((el) => el.textContent)
    expect(names[0]).toContain('Sensory bear')
    expect(names[1]).toContain('Drum')
    await open('builds')
    expect(screen.getByText('Switch mount')).toBeInTheDocument()
  })

  it('WB09 sends a toy request to its exchange thread, a print to its print request and a build to its build thread', async () => {
    await open('toys')
    expect(screen.getByRole('link', { name: 'Open the request' })).toHaveAttribute('href', '/dashboard/exchanges/d1')
    expect(screen.getByRole('link', { name: 'Open the thread' })).toHaveAttribute('href', '/dashboard/exchanges/d2')
    await open('parts')
    expect(screen.getAllByRole('link', { name: 'Open the request' }).at(-1)).toHaveAttribute('href', '/dashboard/print-requests/p1')
    await open('builds')
    expect(screen.getAllByRole('link', { name: 'Open the thread' }).at(-1)).toHaveAttribute('href', '/dashboard/exchanges/build/b1')
  })
})
