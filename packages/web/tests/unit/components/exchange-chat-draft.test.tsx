import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExchangeChat } from '@/components/exchange-chat'

const props = (onSend: (b: string) => Promise<void>) => ({
  messages: [],
  viewerId: 'u1',
  otherPartyName: 'Priya',
  nameFor: () => 'Priya',
  canSend: true,
  busy: false,
  onSend,
  draftKey: 'tx1',
})

beforeEach(() => sessionStorage.clear())

describe('the thread composer draft', () => {
  it('WA30 keeps an unsent message when the send navigates away, and restores it on return', async () => {
    const neverReturns = vi.fn(() => new Promise<void>(() => {}))
    const first = render(<ExchangeChat {...props(neverReturns)} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Is it still free?' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => expect(neverReturns).toHaveBeenCalledWith('Is it still free?'))
    expect(sessionStorage.getItem('draft:tx1')).toBe('Is it still free?')
    first.unmount()

    render(<ExchangeChat {...props(vi.fn())} />)
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('Is it still free?'))
    expect(sessionStorage.getItem('draft:tx1')).toBeNull()
  })

  it('drops the saved copy once the message arrives in the thread', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const view = render(<ExchangeChat {...props(send)} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => expect(sessionStorage.getItem('draft:tx1')).toBe('Hello'))
    view.rerender(
      <ExchangeChat
        {...props(send)}
        messages={[{ id: 'm1', sender_id: 'u1', kind: 'user', body: 'Hello', created_at: '2026-10-20T00:00:00Z' }]}
      />
    )
    expect(sessionStorage.getItem('draft:tx1')).toBeNull()
  })

  it('still sends when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const send = vi.fn().mockResolvedValue(undefined)
    render(<ExchangeChat {...props(send)} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hi' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => expect(send).toHaveBeenCalledWith('Hi'))
    vi.restoreAllMocks()
  })
})
