import { render, screen } from '@testing-library/react-native'
import { MessageBubble } from '../../../../components/ui/MessageBubble'

const message = (kind: 'system' | 'user' | 'admin', body: string) => ({
  id: 'm1',
  sender_id: 'u1',
  kind,
  body,
  created_at: '2026-08-30T01:00:00.000Z',
})

describe('MessageBubble', () => {
  it('X16 labels an admin message SPLAT admin, even when the viewer sent it', () => {
    render(<MessageBubble message={message('admin', 'Checking in')} mine senderName="Ash" />)
    expect(screen.getByLabelText('SPLAT admin said: Checking in')).toBeTruthy()
    expect(screen.getByText('SPLAT admin')).toBeTruthy()
    expect(screen.queryByText('Ash')).toBeNull()
  })

  it('names a member message by its sender, and says You for your own', () => {
    const { rerender } = render(<MessageBubble message={message('user', 'Hello')} mine={false} senderName="Ash" />)
    expect(screen.getByLabelText('Ash said: Hello')).toBeTruthy()
    rerender(<MessageBubble message={message('user', 'Hello')} mine senderName="Ash" />)
    expect(screen.getByLabelText('You said: Hello')).toBeTruthy()
  })

  it('renders a system line as plain text with no author', () => {
    render(<MessageBubble message={message('system', 'Request declined — Gone')} mine={false} senderName="Ash" />)
    expect(screen.getByText('Request declined — Gone')).toBeTruthy()
    expect(screen.queryByText('Ash')).toBeNull()
  })
})
