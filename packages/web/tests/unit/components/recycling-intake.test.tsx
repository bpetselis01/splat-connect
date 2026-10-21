import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RecyclingIntake } from '@/components/recycling-intake'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { patch: vi.fn() } }))

const DROP = {
  id: 'd1', org_id: 'org1', contributor_id: 'tom', material: 'PLA', estimated_grams: 2600,
  condition_declared: true, declaration_version: 'v1-2026-09', photo_url: null, note: null,
  status: 'booked' as const, weighed_grams: null, credit_grams: null, decided_by: null,
  created_at: '2026-09-20T00:00:00Z', updated_at: '2026-09-20T00:00:00Z',
}

describe('RecyclingIntake', () => {
  beforeEach(() => vi.clearAllMocks())

  it('WB27 prefills the credit at three quarters, sends what the box holds, and says so', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue({})
    render(<RecyclingIntake orgId="org1" dropoffs={[DROP]} names={{ tom: 'Tom Beattie' }} />)
    expect(screen.getByText('Weigh it to see the credit')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Actual, in kilograms'), { target: { value: '2.6' } })
    expect(screen.getByLabelText('Credit, in grams')).toHaveValue('1950')
    expect(screen.getByText('1950 g credit')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Weigh and credit/ }))
    await waitFor(() =>
      expect(browserApiClient.patch).toHaveBeenCalledWith('/api/organizations/org1/recycling/d1', {
        status: 'received',
        weighed_grams: 2600,
        credit_grams: 1950,
      })
    )
    expect(await screen.findByText('Weighed at 2.6 kg — 1950 g credit issued to Tom Beattie')).toBeInTheDocument()
  })

  it('WB27 rounds 2.14 kg to 2.1 kg and sends the credit taken from the rounded weight', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue({})
    render(<RecyclingIntake orgId="org1" dropoffs={[DROP]} names={{ tom: 'Tom Beattie' }} />)
    fireEvent.change(screen.getByLabelText('Actual, in kilograms'), { target: { value: '2.14' } })
    expect(screen.getByLabelText('Credit, in grams')).toHaveValue('1575')
    fireEvent.click(screen.getByRole('button', { name: /Weigh and credit/ }))
    await waitFor(() =>
      expect(browserApiClient.patch).toHaveBeenCalledWith('/api/organizations/org1/recycling/d1', {
        status: 'received',
        weighed_grams: 2100,
        credit_grams: 1575,
      })
    )
    expect(await screen.findByText('Weighed at 2.1 kg — 1575 g credit issued to Tom Beattie')).toBeInTheDocument()
  })

  it('holds the button under two kilos, in the board’s words', () => {
    render(<RecyclingIntake orgId="org1" dropoffs={[DROP]} names={{ tom: 'Tom Beattie' }} />)
    fireEvent.change(screen.getByLabelText('Actual, in kilograms'), { target: { value: '1.5' } })
    expect(screen.getByText('Under the 2 kg minimum — log it as a donation or hand it back')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Weigh and credit/ })).toBeDisabled()
  })
  it('WB28 "Contaminated" declines the drop-off without sending any weight, and says nothing was credited', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue({})
    render(<RecyclingIntake orgId="org1" dropoffs={[DROP]} names={{ tom: 'Tom Beattie' }} />)
    fireEvent.change(screen.getByLabelText('Actual, in kilograms'), { target: { value: '2.6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Contaminated' }))
    await waitFor(() =>
      expect(browserApiClient.patch).toHaveBeenCalledWith('/api/organizations/org1/recycling/d1', { status: 'declined' })
    )
    expect(screen.queryByText(/credit issued/)).not.toBeInTheDocument()
  })

  it('WB28 shows the refusal in words when the decline does not save', async () => {
    vi.mocked(browserApiClient.patch).mockRejectedValue(new Error('409 {"error":"Already decided"}'))
    render(<RecyclingIntake orgId="org1" dropoffs={[DROP]} names={{ tom: 'Tom Beattie' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Contaminated' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Already decided')
  })
})
