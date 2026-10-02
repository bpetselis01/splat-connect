import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WhatYouTake } from '@/app/dashboard/organisation/recycling/what-you-take'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { patch: vi.fn() } }))

const ORG = {
  id: 'o1', name: 'Northside', status: 'active', created_by: null, created_at: '', updated_at: '', description: null,
  recycling_materials: ['PLA'], recycling_note: 'Clean and dry.', recycling_machines: ['Extruder'], recycling_forms: [],
  recycling_min_kg: null, recycling_max_kg: 5, recycling_turnaround: null, recycling_gives: 'credit' as const,
  recycling_hours: null, recycling_door: null,
}

describe('WhatYouTake', () => {
  beforeEach(() => vi.clearAllMocks())

  it('publishes every field the board edits, in one PATCH', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue({})
    render(<WhatYouTake orgId="o1" org={ORG as never} />)
    expect(screen.getByText('The platform floor is 2 kg. You can ask for more, never less.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Shredder' }))
    fireEvent.click(screen.getByRole('button', { name: 'Offcuts' }))
    fireEvent.change(screen.getByLabelText('Maximum per drop'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Turnaround'), { target: { value: 'About 3 weeks' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Either, their choice' }))
    fireEvent.change(screen.getByLabelText('Drop-off hours'), { target: { value: 'Tue, 9am–4pm' } })
    fireEvent.change(screen.getByLabelText('Which door'), { target: { value: 'Back gate' } })
    fireEvent.click(screen.getByRole('button', { name: /Save what you take/ }))
    await waitFor(() =>
      expect(browserApiClient.patch).toHaveBeenCalledWith('/api/organizations/o1/profile', {
        recycling_materials: ['PLA'],
        recycling_note: 'Clean and dry.',
        recycling_machines: ['Extruder', 'Shredder'],
        recycling_forms: ['Offcuts'],
        recycling_min_kg: null,
        recycling_max_kg: 8,
        recycling_turnaround: 'About 3 weeks',
        recycling_gives: 'either',
        recycling_hours: 'Tue, 9am–4pm',
        recycling_door: 'Back gate',
      })
    )
  })

  it('will not send a weight it cannot read', async () => {
    render(<WhatYouTake orgId="o1" org={ORG as never} />)
    fireEvent.change(screen.getByLabelText('Minimum per drop'), { target: { value: 'two' } })
    fireEvent.click(screen.getByRole('button', { name: /Save what you take/ }))
    expect(await screen.findByText('Per drop is between 2 and 1000 kg, to one decimal place.')).toBeInTheDocument()
    expect(browserApiClient.patch).not.toHaveBeenCalled()
  })
})
