import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExchangeChat } from '@/components/exchange-chat'
import type { ThreadMessage } from '@splat-connect/types'

const at = (n: number) => `2026-08-01T00:0${n}:00Z`
const msg = (id: string, sender_id: string, kind: ThreadMessage['kind'], body: string, n: number): ThreadMessage => ({
  id, sender_id, kind, body, created_at: at(n),
})

function mount(messages: ThreadMessage[], viewerId: string, board = false) {
  render(
    <ExchangeChat
      messages={messages}
      viewerId={viewerId}
      otherPartyName="Ash"
      nameFor={(id) => (id === 'owner-1' ? 'Ash' : 'Jamie')}
      canSend={false}
      busy={false}
      onSend={vi.fn()}
      variant={board ? 'board' : undefined}
    />
  )
}

describe('ExchangeChat admin messages', () => {
  it.each([false, true])('WM37 labels an admin bubble SPLAT admin for a member, board=%s', (board) => {
    mount([msg('a', 'admin-1', 'admin', 'Checking in on this one', 1)], 'requester-1', board)
    expect(screen.getByText('Checking in on this one')).toHaveClass('chat-bubble-admin')
    expect(screen.getByText('SPLAT admin said')).toBeInTheDocument()
  })

  it('WM37 shows an admin their own message as SPLAT admin, not "You"', () => {
    mount([msg('a', 'admin-1', 'admin', 'Checking in', 1)], 'admin-1', true)
    expect(screen.getByText('Checking in')).not.toHaveClass('chat-bubble-mine')
    expect(screen.queryByText('You said')).toBeNull()
  })

  it('does not merge an admin message into the member turn before it, and keeps system lines plain', () => {
    mount(
      [
        msg('u', 'owner-1', 'user', 'Still free?', 1),
        msg('a', 'admin-1', 'admin', 'Admin here', 2),
        msg('s', 'owner-1', 'system', 'Request declined — Gone', 3),
      ],
      'requester-1'
    )
    expect(screen.getByText('Still free?')).not.toHaveClass('chat-bubble-admin')
    expect(screen.getByText('Admin here')).toHaveClass('chat-bubble-admin')
    expect(screen.getByText('Request declined — Gone')).toHaveClass('chat-system')
    expect(screen.getAllByText(/ said$/).map((e) => e.textContent)).toEqual(['Ash said', 'SPLAT admin said'])
  })
})
