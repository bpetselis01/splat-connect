import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToyTransactionThread } from '@/components/toy-transaction-thread'
import type { ToyTransactionDetail } from '@splat-connect/types'

function tx(overrides: Partial<ToyTransactionDetail> = {}): ToyTransactionDetail {
  return {
    id: 'tx-1',
    toy_id: 'toy-1',
    offered_toy_id: null,
    type: 'donation',
    status: 'requested',
    requester_id: 'requester-1',
    owner_id: 'owner-1',
    owner_code: null,
    requester_code: null,
    owner_confirmed_at: null,
    requester_confirmed_at: null,
    pickup_line1: null,
    pickup_suburb: null,
    pickup_state: null,
    pickup_postcode: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    toy_name: 'Fire truck',
    offered_toy_name: null,
    owner_name: 'Sam',
    requester_name: 'Ash',
    messages: [{ id: 'm1', transaction_id: 'tx-1', sender_id: 'requester-1', kind: 'system', body: 'Requested this toy for donation.', created_at: '2026-08-01T00:00:00Z' }],
    ...overrides,
  }
}

const noop = vi.fn().mockResolvedValue(undefined)

describe('ToyTransactionThread', () => {
  it('shows Accept and Reject to the owner on a requested donation', () => {
    render(
      <ToyTransactionThread transaction={tx()} viewerId="owner-1" onSendMessage={noop} onAccept={noop} onReject={noop} onWithdraw={noop} onConfirm={noop} />
    )
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
  })

  it('does not show Accept/Reject to the requester', () => {
    render(
      <ToyTransactionThread transaction={tx()} viewerId="requester-1" onSendMessage={noop} onAccept={noop} onReject={noop} onWithdraw={noop} onConfirm={noop} />
    )
    expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument()
  })

  it('lets only the owner confirm a donation, using the requester code', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <ToyTransactionThread
        transaction={tx({ status: 'accepted', owner_code: '111111', requester_code: '222222' })}
        viewerId="owner-1"
        onSendMessage={noop}
        onAccept={noop}
        onReject={noop}
        onWithdraw={noop}
        onConfirm={onConfirm}
      />
    )
    const input = screen.getByLabelText(/other party's code/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: '222222' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm handoff/i }))
    // Wait for async callback
    await vi.waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('222222')
    })
  })

  it('does not let the requester confirm a donation', () => {
    render(
      <ToyTransactionThread
        transaction={tx({ status: 'accepted', owner_code: '111111', requester_code: '222222' })}
        viewerId="requester-1"
        onSendMessage={noop}
        onAccept={noop}
        onReject={noop}
        onWithdraw={noop}
        onConfirm={noop}
      />
    )
    expect(screen.queryByRole('button', { name: /confirm handoff/i })).not.toBeInTheDocument()
  })

  it('lets both parties confirm an exchange', () => {
    render(
      <ToyTransactionThread
        transaction={tx({ type: 'exchange', status: 'accepted', owner_code: '111111', requester_code: '222222' })}
        viewerId="requester-1"
        onSendMessage={noop}
        onAccept={noop}
        onReject={noop}
        onWithdraw={noop}
        onConfirm={noop}
      />
    )
    expect(screen.getByRole('button', { name: /confirm handoff/i })).toBeInTheDocument()
  })

  it('shows a completed message and no actions once completed', () => {
    render(
      <ToyTransactionThread transaction={tx({ status: 'completed' })} viewerId="owner-1" onSendMessage={noop} onAccept={noop} onReject={noop} onWithdraw={noop} onConfirm={noop} />
    )
    expect(screen.getByText(/handoff complete/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /withdraw/i })).not.toBeInTheDocument()
  })
})
