import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EventJoiningLink } from '@/components/event-joining-link'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { get: vi.fn() } }))
const get = vi.mocked(browserApiClient.get)

beforeEach(() => vi.clearAllMocks())

describe('EventJoiningLink', () => {
  it('WI39 shows a Join online link to the address the API returns', async () => {
    get.mockResolvedValue({ online_url: 'https://meet.example/room-4417' })
    render(<EventJoiningLink eventId="ev-1" />)
    const link = await screen.findByRole('link', { name: 'Join online' })
    expect(get).toHaveBeenCalledWith('/api/events/ev-1/joining-link')
    expect(link).toHaveAttribute('href', 'https://meet.example/room-4417')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('WI39 draws nothing when the API refuses the link', async () => {
    get.mockRejectedValue(new Error('API GET failed with status 403'))
    const { container } = render(<EventJoiningLink eventId="ev-1" />)
    await vi.waitFor(() => expect(get).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('WI39 never links to an address that is not http or https', async () => {
    get.mockResolvedValue({ online_url: 'javascript:alert(1)' })
    const { container } = render(<EventJoiningLink eventId="ev-1" />)
    await vi.waitFor(() => expect(get).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
