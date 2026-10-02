import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { browserApiClient } from '@/lib/browser-api-client'
import { MakersWantedBoard, type OpenBuild } from '@/components/makers-wanted-board'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn(), get: vi.fn() } }))

export const build = (over: Partial<OpenBuild> = {}): OpenBuild => ({
  id: 'b1', tutorial_id: 'g1', build_brief: 'Leo lights up at bubbles.', travel_km: 10, urgency: 'No rush',
  child_label: 'Leo, 3', requester_suburb: 'Newtown', family_has_toy: false, created_at: '2026-09-28T00:00:00Z', mine: false,
  tutorial: { id: 'g1', title: 'Bubble machine', difficulty: 'easy', status: 'approved', build_minutes: 20, parts_total_cents: 2800 },
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('MakersWantedBoard', () => {
  it('shows each guide’s build time and rough parts cost', () => {
    render(<MakersWantedBoard builds={[build()]} />)
    expect(screen.getByText('20 min · ~$28.00')).toBeInTheDocument()
  })

  it('leaves the cost off when a part is unpriced', () => {
    render(<MakersWantedBoard builds={[build({ tutorial: { id: 'g1', title: 'Bubble machine', difficulty: 'easy', status: 'approved', build_minutes: 20, parts_total_cents: null } })]} />)
    expect(screen.getByText('20 min')).toBeInTheDocument()
    expect(screen.queryByText(/~\$/)).toBeNull()
  })
})

describe('MakersWantedBoard Live and Handed over', () => {
  it('fetches Live when its tab is picked and names who is building', async () => {
    vi.mocked(browserApiClient.get).mockResolvedValue([{ ...build({ id: 'l1' }), maker_name: 'Tom Beattie', party: false }])
    render(<MakersWantedBoard builds={[build()]} />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: /^Live/ }))
    expect(await screen.findByText('Tom Beattie is building it')).toBeInTheDocument()
    expect(browserApiClient.get).toHaveBeenCalledWith('/api/toy-transactions/builds-board?tab=live&page=0')
    expect(screen.getByRole('tab', { name: /^Handed over/ })).toBeInTheDocument()
  })

  it('offers the thread to a party and names the maker on a handed-over row', async () => {
    vi.mocked(browserApiClient.get).mockResolvedValueOnce([{ ...build({ id: 'l1', mine: true }), maker_name: 'Tom Beattie', party: true }])
    render(<MakersWantedBoard builds={[]} />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: /^Live/ }))
    expect(await screen.findByRole('link', { name: 'Open the thread' })).toHaveAttribute('href', '/dashboard/exchanges/build/l1')
    vi.mocked(browserApiClient.get).mockResolvedValueOnce([
      { ...build({ id: 'd1', build_brief: null, child_label: null, requester_suburb: null, travel_km: null, urgency: null }), maker_name: 'Rachel Kaur', party: false, updated_at: '2026-09-30T00:00:00Z' },
    ])
    fireEvent.mouseDown(screen.getByRole('tab', { name: /^Handed over/ }))
    expect(await screen.findByText('Built by Rachel Kaur')).toBeInTheDocument()
    expect(browserApiClient.get).toHaveBeenLastCalledWith('/api/toy-transactions/builds-board?tab=done&page=0')
    expect(screen.queryByText(/null/)).toBeNull()
  })
})
