import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ToyTransactionThread } from '@/components/toy-transaction-thread'
import type { ToyTransactionDetail } from '@splat-connect/types'
import { detail } from '../fixtures/transactions'

const ADDRESS = { pickup_line1: '1 Test St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000' }

function mount(tx: ToyTransactionDetail, viewerId: string, board = true) {
  const h = {
    onSendMessage: vi.fn().mockResolvedValue(undefined),
    onAccept: vi.fn().mockResolvedValue(undefined),
    onReject: vi.fn().mockResolvedValue(undefined),
    onWithdraw: vi.fn().mockResolvedValue(undefined),
    onConfirm: vi.fn().mockResolvedValue(undefined),
  }
  render(<ToyTransactionThread transaction={tx} viewerId={viewerId} variant={board ? 'board' : undefined} {...h} />)
  return h
}

const build = (o: Partial<ToyTransactionDetail> = {}) => detail({ type: 'build', toy_id: null, ...o })
const print = (o: Partial<ToyTransactionDetail> = {}) =>
  detail({ type: 'print', toy_id: null, created_at: new Date().toISOString(), ...o })

async function send(h: ReturnType<typeof mount>, text: string) {
  fireEvent.change(screen.getByLabelText(/^Message /), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await vi.waitFor(() => expect(h.onSendMessage).toHaveBeenCalledWith(text))
}

describe('ToyTransactionThread actions on a gift or swap', () => {
  it('WX05 sends the typed message and nothing else', async () => {
    const h = mount(detail({ status: 'accepted' }), 'requester-1')
    await send(h, 'Thursday after three?')
    expect(h.onAccept).not.toHaveBeenCalled()
  })

  it('WX07 rejects with no reason, going straight from the button', async () => {
    const h = mount(detail(), 'owner-1', false)
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    await vi.waitFor(() => expect(h.onReject).toHaveBeenCalledOnce())
    expect(h.onReject).toHaveBeenCalledWith()
  })

  it('WX08 withdraws from the plain thread’s Withdraw and the board’s Withdraw the request', async () => {
    const plain = mount(detail(), 'requester-1', false)
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    await vi.waitFor(() => expect(plain.onWithdraw).toHaveBeenCalledOnce())
  })

  it('WX08 withdraws from the board’s Withdraw the request link', async () => {
    const h = mount(detail(), 'requester-1')
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw the request' }))
    await vi.waitFor(() => expect(h.onWithdraw).toHaveBeenCalledOnce())
  })

  it('WX09 closes a swap from either side with the other side’s code', async () => {
    const h = mount(detail({ type: 'exchange', status: 'accepted', requester_code: '222222', owner_code: '111111' }), 'requester-1')
    fireEvent.change(screen.getByLabelText(/Enter the other party/), { target: { value: '111111' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm handoff' }))
    await vi.waitFor(() => expect(h.onConfirm).toHaveBeenCalledWith('111111'))
  })
})

describe('ToyTransactionThread actions on a build', () => {
  it('WX15 sends the typed message', async () => {
    await send(mount(build({ status: 'accepted' }), 'requester-1'), 'Which switch?')
  })

  it('WX16 opens the pickup dialog for the maker and accepts with the typed address', async () => {
    const h = mount(build({ status: 'requested' }), 'owner-1')
    expect(screen.getByRole('heading', { name: 'Ash is asking for a build' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    for (const [label, value] of [['Street address', '1 Test St'], ['Suburb', 'Testville'], ['State', 'VIC'], ['Postcode', '3000']]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Accept request' }))
    await vi.waitFor(() => expect(h.onAccept).toHaveBeenCalledWith(ADDRESS))
  })

  it('WX17 rejects with no reason', async () => {
    const h = mount(build({ status: 'requested' }), 'owner-1')
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    await vi.waitFor(() => expect(h.onReject).toHaveBeenCalledWith())
  })

  it('WX18 withdraws the request', async () => {
    const h = mount(build({ status: 'requested' }), 'requester-1')
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw the request' }))
    await vi.waitFor(() => expect(h.onWithdraw).toHaveBeenCalledOnce())
  })

  it('WX19 offers no code or confirm box until the family has approved the working shot', async () => {
    const { unmount } = render(
      <ToyTransactionThread transaction={build({ status: 'accepted', requester_code: '222222', owner_code: '111111' })} viewerId="requester-1" variant="board"
        onSendMessage={vi.fn()} onAccept={vi.fn()} onReject={vi.fn()} onWithdraw={vi.fn()} onConfirm={vi.fn()} />
    )
    expect(screen.queryByLabelText(/Enter the other party/)).toBeNull()
    unmount()
    const h = mount(build({ status: 'accepted', work_approved_at: '2026-08-03T00:00:00Z', requester_code: '222222', owner_code: '111111' }), 'requester-1')
    fireEvent.change(screen.getByLabelText(/Enter the other party/), { target: { value: '111111' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm handoff' }))
    await vi.waitFor(() => expect(h.onConfirm).toHaveBeenCalledWith('111111'))
  })
})

describe('ToyTransactionThread actions on a print job', () => {
  it('WR12 sends the typed message', async () => {
    await send(mount(print({ status: 'accepted' }), 'requester-1'), 'Is PETG fine?')
  })

  it('WR13 asks the printer for a pickup address and accepts with it', async () => {
    const h = mount(print({ status: 'requested' }), 'owner-1')
    expect(screen.getByRole('heading', { name: 'Ash is asking for a print' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    for (const [label, value] of [['Street address', '1 Test St'], ['Suburb', 'Testville'], ['State', 'VIC'], ['Postcode', '3000']]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Accept request' }))
    await vi.waitFor(() => expect(h.onAccept).toHaveBeenCalledWith(ADDRESS))
  })

  it('WR14 declines only with a reason: the button opens the form, and the form sends the trimmed reason', async () => {
    const h = mount(print({ status: 'requested' }), 'owner-1')
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    expect(h.onReject).not.toHaveBeenCalled()
    const send = screen.getByRole('button', { name: 'Send the decline' })
    expect(send).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Why you cannot take it'), { target: { value: '  Bed is too small.  ' } })
    fireEvent.click(send)
    await vi.waitFor(() => expect(h.onReject).toHaveBeenCalledWith('Bed is too small.'))
  })

  it('WR14 Cancel closes the decline form without sending anything', () => {
    const h = mount(print({ status: 'requested' }), 'owner-1')
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Why you cannot take it')).toBeNull()
    expect(h.onReject).not.toHaveBeenCalled()
  })

  it('WR15 withdraws the request', async () => {
    const h = mount(print({ status: 'requested' }), 'requester-1')
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw the request' }))
    await vi.waitFor(() => expect(h.onWithdraw).toHaveBeenCalledOnce())
  })

  it('WR16 offers no confirm box until the parts are ready, then closes with the other code', async () => {
    const accepted = print({ status: 'accepted', requester_code: '222222', owner_code: '111111' })
    const { unmount } = render(
      <ToyTransactionThread transaction={accepted} viewerId="requester-1" variant="board"
        onSendMessage={vi.fn()} onAccept={vi.fn()} onReject={vi.fn()} onWithdraw={vi.fn()} onConfirm={vi.fn()} />
    )
    expect(screen.queryByLabelText(/Enter the other party/)).toBeNull()
    unmount()
    const h = mount({ ...accepted, ready_at: '2026-08-04T00:00:00Z' }, 'requester-1')
    const box = screen.getByLabelText(/Enter the other party/)
    fireEvent.change(box, { target: { value: '111111' } })
    fireEvent.click(within(box.closest('div')!.parentElement!).getByRole('button', { name: 'Confirm handoff' }))
    await vi.waitFor(() => expect(h.onConfirm).toHaveBeenCalledWith('111111'))
  })
})
