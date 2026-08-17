import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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
    blocked_by_rival_accept: false,
    received_toy: null,
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

  /**
   * The donation/exchange asymmetry lives in two expressions in the component
   * (showMyCode, canConfirm) and is invisible from the outside: a donation is a
   * one-way handoff — only the requester holds a code, only the owner types one
   * in — while an exchange is mutual. These pin the whole matrix so a restyle
   * cannot quietly drop one arm of it.
   */
  describe('donation vs exchange', () => {
    function renderThread(overrides: Partial<ToyTransactionDetail>, viewerId: string) {
      render(
        <ToyTransactionThread
          transaction={tx(overrides)}
          viewerId={viewerId}
          onSendMessage={noop}
          onAccept={noop}
          onReject={noop}
          onWithdraw={noop}
          onConfirm={noop}
        />
      )
    }

    it('names the offered toy on an exchange', () => {
      renderThread({ type: 'exchange', offered_toy_name: 'Wooden blocks' }, 'owner-1')
      expect(screen.getByText(/wooden blocks/i)).toBeInTheDocument()
    })

    it('has no offered-toy row on a donation', () => {
      renderThread({ type: 'donation', offered_toy_name: null }, 'owner-1')
      expect(screen.queryByText(/offered/i)).not.toBeInTheDocument()
    })

    it('gives the requester a code on a donation but not the owner', () => {
      const accepted = {
        status: 'accepted' as const,
        owner_code: '111111',
        requester_code: '222222',
      }
      const { unmount } = render(
        <ToyTransactionThread
          transaction={tx(accepted)}
          viewerId="requester-1"
          onSendMessage={noop}
          onAccept={noop}
          onReject={noop}
          onWithdraw={noop}
          onConfirm={noop}
        />
      )
      expect(screen.getByText(/your handoff code/i)).toHaveTextContent('222222')
      unmount()

      renderThread(accepted, 'owner-1')
      expect(screen.queryByText(/your handoff code/i)).not.toBeInTheDocument()
    })
  })

  /**
   * Before this the confirming party saw the input vanish and nothing take its
   * place, which reads as a failed click rather than a handoff waiting on the
   * other person.
   */
  it('acknowledges your confirmation while the other party has not confirmed', () => {
    render(
      <ToyTransactionThread
        transaction={tx({
          type: 'exchange',
          status: 'accepted',
          owner_code: '111111',
          requester_code: '222222',
          owner_confirmed_at: '2026-08-02T00:00:00Z',
        })}
        viewerId="owner-1"
        onSendMessage={noop}
        onAccept={noop}
        onReject={noop}
        onWithdraw={noop}
        onConfirm={noop}
      />
    )
    expect(screen.getByText(/waiting on ash/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /confirm handoff/i })).not.toBeInTheDocument()
  })

  // Alignment and bubble colour carry the sender visually; a screen reader gets
  // neither, so the log role and the per-message attribution are the real ones.
  it('exposes the conversation as a live log with attributed messages', () => {
    render(
      <ToyTransactionThread
        transaction={tx({
          messages: [
            { id: 'm1', transaction_id: 'tx-1', sender_id: 'requester-1', kind: 'system', body: 'Requested this toy for donation.', created_at: '2026-08-01T00:00:00Z' },
            { id: 'm2', transaction_id: 'tx-1', sender_id: 'requester-1', kind: 'user', body: 'Is it still available?', created_at: '2026-08-01T01:00:00Z' },
            { id: 'm3', transaction_id: 'tx-1', sender_id: 'owner-1', kind: 'user', body: 'It is.', created_at: '2026-08-01T02:00:00Z' },
          ],
        })}
        viewerId="owner-1"
        onSendMessage={noop}
        onAccept={noop}
        onReject={noop}
        onWithdraw={noop}
        onConfirm={noop}
      />
    )
    const log = screen.getByRole('log')
    expect(log).toHaveAttribute('aria-live', 'polite')
    expect(within(log).getByText('Ash said')).toBeInTheDocument()
    expect(within(log).getByText('You said')).toBeInTheDocument()
  })

  it('shows a completed message and no actions once completed', () => {
    render(
      <ToyTransactionThread transaction={tx({ status: 'completed' })} viewerId="owner-1" onSendMessage={noop} onAccept={noop} onReject={noop} onWithdraw={noop} onConfirm={noop} />
    )
    expect(screen.getByText(/handoff complete/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /withdraw/i })).not.toBeInTheDocument()
  })

  // Tests: the receiver of a completed handoff is offered a way to list it
  // How:   a completed transaction carrying an unlisted received_toy
  // Chain: transferring the toy silently would leave it a draft the receiver
  //        never learns they own — the offer is the only thing connecting the
  //        handoff to the toy now sitting in their My Toys
  it('offers the receiver a way to list the toy they were handed', () => {
    render(
      <ToyTransactionThread
        transaction={tx({
          status: 'completed',
          received_toy: { id: 'toy-1', name: 'Fire truck', status: 'draft' },
        })}
        viewerId="requester-1"
        onSendMessage={noop}
        onAccept={noop}
        onReject={noop}
        onWithdraw={noop}
        onConfirm={noop}
      />
    )
    expect(screen.getByText(/fire truck is yours now/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add to toy library/i })).toHaveAttribute(
      'href',
      '/dashboard/toys/toy-1'
    )
  })

  // Tests: the offer is absent for someone who received nothing
  // How:   the same completed transaction with received_toy null, the shape the
  //        API returns to the giver on a donation
  // Chain: an offer to list shown to the person who just gave the toy away
  //        points at a toy they no longer own
  it('does not offer to list anything to the party who received nothing', () => {
    render(
      <ToyTransactionThread transaction={tx({ status: 'completed' })} viewerId="owner-1" onSendMessage={noop} onAccept={noop} onReject={noop} onWithdraw={noop} onConfirm={noop} />
    )
    expect(screen.getByText(/handoff complete/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /add to toy library/i })).not.toBeInTheDocument()
  })

  // Tests: the offer disappears once the toy is listed
  // How:   received_toy already at 'published'
  // Chain: without the status check the card would keep asking for something
  //        already done, every time the thread is opened
  it('stops offering once the received toy is published', () => {
    render(
      <ToyTransactionThread
        transaction={tx({
          status: 'completed',
          received_toy: { id: 'toy-1', name: 'Fire truck', status: 'published' },
        })}
        viewerId="requester-1"
        onSendMessage={noop}
        onAccept={noop}
        onReject={noop}
        onWithdraw={noop}
        onConfirm={noop}
      />
    )
    expect(screen.queryByRole('link', { name: /add to toy library/i })).not.toBeInTheDocument()
  })

  describe('accepting', () => {
    const ADDRESS = {
      pickup_line1: '1 Test St',
      pickup_suburb: 'Testville',
      pickup_state: 'VIC',
      pickup_postcode: '3000',
    }

    function renderOwner(props: Partial<Parameters<typeof ToyTransactionThread>[0]> = {}) {
      const onAccept = vi.fn().mockResolvedValue(undefined)
      render(
        <ToyTransactionThread
          transaction={tx()}
          viewerId="owner-1"
          onSendMessage={noop}
          onAccept={onAccept}
          onReject={noop}
          onWithdraw={noop}
          onConfirm={noop}
          {...props}
        />
      )
      return onAccept
    }

    it('does not accept on the first click — it asks where to collect', () => {
      const onAccept = renderOwner()
      fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
      expect(onAccept).not.toHaveBeenCalled()
      expect(screen.getByRole('heading', { name: /where should they collect it/i })).toBeInTheDocument()
    })

    it('sends the saved address when the owner keeps their default', async () => {
      const onAccept = renderOwner({ viewerDefaultAddress: ADDRESS })
      fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
      fireEvent.click(screen.getByRole('button', { name: /accept request/i }))
      await vi.waitFor(() => expect(onAccept).toHaveBeenCalledWith(ADDRESS))
    })

    it('sends a freshly typed address instead of the default when asked', async () => {
      const onAccept = renderOwner({ viewerDefaultAddress: ADDRESS })
      fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
      fireEvent.click(screen.getByLabelText(/enter a different address/i))
      fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: '9 Other Rd' } })
      fireEvent.change(screen.getByLabelText(/suburb/i), { target: { value: 'Elsewhere' } })
      fireEvent.change(screen.getByLabelText(/state/i), { target: { value: 'NSW' } })
      fireEvent.change(screen.getByLabelText(/postcode/i), { target: { value: '2000' } })
      fireEvent.click(screen.getByRole('button', { name: /accept request/i }))
      await vi.waitFor(() =>
        expect(onAccept).toHaveBeenCalledWith({
          pickup_line1: '9 Other Rd',
          pickup_suburb: 'Elsewhere',
          pickup_state: 'NSW',
          pickup_postcode: '2000',
        })
      )
    })

    it('cannot submit until every field is filled when there is no default', () => {
      renderOwner({ viewerDefaultAddress: null })
      fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
      expect(screen.queryByLabelText(/enter a different address/i)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /accept request/i })).toBeDisabled()

      fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: '9 Other Rd' } })
      expect(screen.getByRole('button', { name: /accept request/i })).toBeDisabled()
    })

    it('locks Accept but not Reject while a rival handoff is in flight', () => {
      renderOwner({ transaction: tx({ blocked_by_rival_accept: true }) })
      const accept = screen.getByRole('button', { name: 'Accept' })
      expect(accept).toBeDisabled()
      expect(accept).toHaveAttribute('title', expect.stringMatching(/complete the current transaction/i))
      expect(screen.getByRole('button', { name: 'Reject' })).toBeEnabled()
    })
  })
})
