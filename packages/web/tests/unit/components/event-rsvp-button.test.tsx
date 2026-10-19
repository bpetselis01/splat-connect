import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EventRsvpButton } from '@/components/event-rsvp-button'
import { browserApiClient } from '@/lib/browser-api-client'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn(), delete: vi.fn() } }))
const post = vi.mocked(browserApiClient.post)
const del = vi.mocked(browserApiClient.delete)

const base = { eventId: 'ev-1', going: false, signedIn: true, needsForm: false, name: 'Hana Kelly', email: 'hana@example.com' }

beforeEach(() => vi.clearAllMocks())

describe('EventRsvpButton', () => {
  it('WI31 books the seat with the account name and email and no answers, then reads You\'re going', async () => {
    post.mockResolvedValue({})
    render(<EventRsvpButton {...base} />)
    fireEvent.click(screen.getByRole('button', { name: "I'm going" }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/events/ev-1/registrations', { name: 'Hana Kelly', email: 'hana@example.com', answers: {} })
    )
    expect(screen.getByRole('button', { name: "You're going" })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('WI31 puts the button back and shows the server sentence when the event is full', async () => {
    post.mockRejectedValue(new Error('This one is full. The host may open more seats.'))
    render(<EventRsvpButton {...base} />)
    fireEvent.click(screen.getByRole('button', { name: "I'm going" }))
    expect(await screen.findByText('This one is full. The host may open more seats.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "I'm going" })).toHaveAttribute('aria-pressed', 'false')
  })

  it('WI32 cancels with DELETE on the registration and reads I\'m going again', async () => {
    del.mockResolvedValue(undefined)
    render(<EventRsvpButton {...base} going />)
    fireEvent.click(screen.getByRole('button', { name: "You're going" }))
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/events/ev-1/registrations'))
    expect(screen.getByRole('button', { name: "I'm going" })).toHaveAttribute('aria-pressed', 'false')
    expect(post).not.toHaveBeenCalled()
  })

  it('WI33 sends a signed-out visitor to sign in, returning to the event', () => {
    render(<EventRsvpButton {...base} signedIn={false} />)
    expect(screen.getByRole('link', { name: /I'm going/ })).toHaveAttribute('href', '/login?next=%2Fget-involved%2Fevents%2Fev-1')
    expect(post).not.toHaveBeenCalled()
  })

  it('WI33 sends a member to the register form when the event asks questions or a cost', () => {
    render(<EventRsvpButton {...base} needsForm />)
    expect(screen.getByRole('link', { name: /I'm going/ })).toHaveAttribute('href', '/get-involved/events/ev-1/register')
    expect(screen.queryByRole('button')).toBeNull()
  })
})
