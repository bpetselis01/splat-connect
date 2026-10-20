import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrgPickupForm } from '@/components/org-pickup-form'
import { browserApiClient } from '@/lib/browser-api-client'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { patch: vi.fn() } }))

const EMPTY = { pickup_line1: null, pickup_suburb: null, pickup_state: null, pickup_postcode: null, pickup_instructions: null }

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('OrgPickupForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('WB13 saves the address the leader typed to this organisation and says so', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue({})
    render(<OrgPickupForm orgId="o1" pickup={EMPTY} />)
    fill('Street address', '9 Dock Rd')
    fill('Suburb', 'Balmain')
    fill('State', 'NSW')
    fill('Postcode', '2041')
    fireEvent.click(screen.getByRole('button', { name: 'Save pickup details' }))
    await waitFor(() =>
      expect(browserApiClient.patch).toHaveBeenCalledWith('/api/organizations/o1/pickup', {
        pickup_line1: '9 Dock Rd',
        pickup_suburb: 'Balmain',
        pickup_state: 'NSW',
        pickup_postcode: '2041',
        pickup_instructions: null,
      }),
    )
    expect(await screen.findByText('Pickup details saved.')).toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it('WB13 sends the instructions when given, starts from the saved address, and reports a refusal', async () => {
    vi.mocked(browserApiClient.patch).mockRejectedValue(new Error('nope'))
    render(
      <OrgPickupForm
        orgId="o2"
        pickup={{ pickup_line1: '1 Pier St', pickup_suburb: 'Ultimo', pickup_state: 'NSW', pickup_postcode: '2007', pickup_instructions: null }}
      />,
    )
    expect(screen.getByLabelText('Street address')).toHaveValue('1 Pier St')
    fill('Pickup instructions (optional)', 'Ring twice')
    fireEvent.click(screen.getByRole('button', { name: 'Save pickup details' }))
    await waitFor(() =>
      expect(browserApiClient.patch).toHaveBeenCalledWith('/api/organizations/o2/pickup', expect.objectContaining({ pickup_instructions: 'Ring twice' })),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the pickup details. Please try again.')
    expect(screen.queryByText('Pickup details saved.')).not.toBeInTheDocument()
  })
})
