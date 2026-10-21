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
    onReject: vi.fn().mockResolvedValue({ ok: true }),
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

  it('WX07 declines a gift only with a reason: the button opens the form, which sends the trimmed reason', async () => {
    const h = mount(detail(), 'owner-1', false)
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    expect(h.onReject).not.toHaveBeenCalled()
    const send = screen.getByRole('button', { name: 'Send the decline' })
    expect(send).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Why you cannot take it'), { target: { value: '  Already given away  ' } })
    fireEvent.click(send)
    await vi.waitFor(() => expect(h.onReject).toHaveBeenCalledWith('Already given away'))
  })

  it('WX07 keeps the typed reason and shows the API sentence when the decline is refused', async () => {
    const h = mount(detail(), 'owner-1', false)
    h.onReject.mockResolvedValue({ ok: false, error: 'This request is no longer open' })
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    fireEvent.change(screen.getByLabelText('Why you cannot take it'), { target: { value: 'Already given away' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send the decline' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This request is no longer open')
    expect(screen.getByLabelText('Why you cannot take it')).toHaveValue('Already given away')
  })

  it('WX07 closes the form once the decline goes through', async () => {
    const h = mount(detail(), 'owner-1', false)
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    fireEvent.change(screen.getByLabelText('Why you cannot take it'), { target: { value: 'Already given away' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send the decline' }))
    await vi.waitFor(() => expect(h.onReject).toHaveBeenCalledWith('Already given away'))
    await vi.waitFor(() => expect(screen.queryByLabelText('Why you cannot take it')).toBeNull())
  })

  it('WX07 keeps Send the decline disabled for a whitespace-only reason', () => {
    const h = mount(detail(), 'owner-1', false)
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    fireEvent.change(screen.getByLabelText('Why you cannot take it'), { target: { value: '    ' } })
    expect(screen.getByRole('button', { name: 'Send the decline' })).toBeDisabled()
    expect(h.onReject).not.toHaveBeenCalled()
  })

  it('WX26 shows the requester the reason on a declined request', () => {
    mount(detail({ status: 'rejected', decline_reason: 'Already given away' }), 'requester-1')
    expect(screen.getByText('This request was declined.')).toBeInTheDocument()
    expect(screen.getByText('Already given away').tagName).toBe('BLOCKQUOTE')
  })

  it('WX26 shows a plain declined line, with no quote block, when the old request has no reason', () => {
    mount(detail({ status: 'rejected', decline_reason: null }), 'requester-1')
    expect(screen.getByText('This request was declined.')).toBeInTheDocument()
    expect(document.querySelector('blockquote')).toBeNull()
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

  it('WX17 declines a build with a reason from the same form', async () => {
    const h = mount(build({ status: 'requested' }), 'owner-1')
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    fireEvent.change(screen.getByLabelText('Why you cannot take it'), { target: { value: 'No time this month' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send the decline' }))
    await vi.waitFor(() => expect(h.onReject).toHaveBeenCalledWith('No time this month'))
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

describe('ToyTransactionThread for an admin who is not a party', () => {
  it('WM38 offers no Withdraw, Decline or Confirm, but still lets the admin write', () => {
    mount(detail({ status: 'accepted' }), 'admin-1')
    expect(screen.queryByRole('button', { name: /Withdraw/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Confirm handoff' })).toBeNull()
    expect(screen.getByLabelText(/^Message /)).toBeInTheDocument()
  })
})

describe('ToyTransactionThread shows the API sentence when an action is refused', () => {
  const REFUSED = { ok: false, error: 'This request is no longer open.' }

  it('accept', async () => {
    const h = mount(build({ status: 'requested' }), 'owner-1')
    h.onAccept.mockResolvedValue(REFUSED)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    for (const [label, value] of [['Street address', '1 Test St'], ['Suburb', 'Testville'], ['State', 'VIC'], ['Postcode', '3000']]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Accept request' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This request is no longer open.')
  })

  it('withdraw', async () => {
    const h = mount(detail(), 'requester-1')
    h.onWithdraw.mockResolvedValue(REFUSED)
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw the request' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This request is no longer open.')
  })
})
