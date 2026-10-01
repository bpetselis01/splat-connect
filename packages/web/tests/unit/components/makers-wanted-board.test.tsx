import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
