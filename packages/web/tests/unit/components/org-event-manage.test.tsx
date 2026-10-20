import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EventWithdrawActions } from '@/components/event-withdraw-actions'
import { EventCostEditor } from '@/components/event-cost-editor'
import { EventPartQueue } from '@/components/event-part-queue'
import { browserApiClient } from '@/lib/browser-api-client'
import type { ToyTransactionSummary } from '@splat-connect/types'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { patch: vi.fn(), post: vi.fn() } }))
const patch = vi.mocked(browserApiClient.patch)
const post = vi.mocked(browserApiClient.post)

beforeEach(() => {
  vi.clearAllMocks()
  patch.mockResolvedValue({} as never)
  post.mockResolvedValue({} as never)
})
afterEach(() => vi.unstubAllGlobals())

describe('EventWithdrawActions', () => {
  const EVENT = '/api/organizations/o1/events/e1'

  it('WB21 cancelling needs a second press, then sends cancelled true', async () => {
    render(<EventWithdrawActions orgId="o1" eventId="e1" registrationsClosed={false} cancelled={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel this event' }))
    expect(patch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel this event' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith(EVENT, { cancelled: true }))
    expect(refresh).toHaveBeenCalled()
  })

  it('WB21 closes registrations, and a closed event offers to reopen them', async () => {
    const { unmount } = render(<EventWithdrawActions orgId="o1" eventId="e1" registrationsClosed={false} cancelled={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close registrations' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith(EVENT, { registrations_closed: true }))
    unmount()
    render(<EventWithdrawActions orgId="o1" eventId="e1" registrationsClosed cancelled={false} />)
    expect(screen.getByText(/Registrations are closed\./)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reopen registrations' }))
    await waitFor(() => expect(patch).toHaveBeenLastCalledWith(EVENT, { registrations_closed: false }))
  })

  it('WB21 a cancelled event says so and Restore sends cancelled false', async () => {
    render(<EventWithdrawActions orgId="o1" eventId="e1" registrationsClosed={false} cancelled />)
    expect(screen.getByText('Cancelled. The public page says so.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith(EVENT, { cancelled: false }))
  })
})

describe('EventCostEditor', () => {
  it('WB22 saves dollars as cents with the breakdown, after the leader changes them', async () => {
    render(<EventCostEditor orgId="o1" eventId="e1" costCents={null} costNote={null} />)
    const save = screen.getByRole('button', { name: 'Save cost' })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Amount, in dollars'), { target: { value: '12.50' } })
    fireEvent.change(screen.getByLabelText('Breakdown, in your words'), { target: { value: '  Kits at cost  ' } })
    expect(screen.getByText('Shown on the public page as $12.50 towards materials.')).toBeInTheDocument()
    fireEvent.click(save)
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/organizations/o1/events/e1', { cost_cents: 1250, cost_note: 'Kits at cost' }))
  })

  it('WB22 refuses an amount that is not dollars and sends nothing', async () => {
    render(<EventCostEditor orgId="o1" eventId="e1" costCents={1250} costNote="Kits" />)
    fireEvent.change(screen.getByLabelText('Amount, in dollars'), { target: { value: 'twelve' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save cost' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Write the amount as dollars, like 12 or 12.50.')
    expect(patch).not.toHaveBeenCalled()
  })
})

describe('EventPartQueue', () => {
  const req = (over: Partial<ToyTransactionSummary>) =>
    ({ id: 'r1', status: 'requested', requester_name: 'Ada', tutorial_title: 'Cradle', part_sets: 2, print_note: null, decline_reason: null, ...over }) as ToyTransactionSummary

  it('WB23 "We’ll print these" accepts the request', async () => {
    render(<EventPartQueue requests={[req({})]} />)
    fireEvent.click(screen.getByRole('button', { name: /We.ll print these/ }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/toy-transactions/r1/accept', {}))
    expect(refresh).toHaveBeenCalled()
  })

  it('WB23 "Can’t print these" rejects with the reason the leader types, and sends nothing without one', async () => {
    const prompt = vi.fn().mockReturnValueOnce('').mockReturnValueOnce('  Bed is booked.  ')
    vi.stubGlobal('prompt', prompt)
    render(<EventPartQueue requests={[req({})]} />)
    fireEvent.click(screen.getByRole('button', { name: /Can.t print these/ }))
    expect(post).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Can.t print these/ }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/toy-transactions/r1/reject', { reason: 'Bed is booked.' }))
  })

  it('WB23 lists what is waiting before what is settled, with the outcome of each', () => {
    render(
      <EventPartQueue
        requests={[
          req({ id: 'a', status: 'accepted', requester_name: 'Ben' }),
          req({ id: 'b', status: 'rejected', requester_name: 'Cy', decline_reason: 'Out of PLA' }),
          req({ id: 'c', requester_name: 'Di' }),
        ]}
      />,
    )
    const names = screen.getAllByText(/^(Ada|Ben|Cy|Di)$/).map((n) => n.textContent)
    expect(names).toEqual(['Di', 'Ben', 'Cy'])
    expect(screen.getByText('Printing')).toBeInTheDocument()
    expect(screen.getByText('Declined')).toBeInTheDocument()
    expect(screen.getByText(/Out of PLA/)).toBeInTheDocument()
  })
})
