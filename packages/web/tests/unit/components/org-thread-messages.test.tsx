import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OrgThreadView } from '@/components/org-thread'
import { browserApiClient } from '@/lib/browser-api-client'
import type { OrgThread } from '@splat-connect/types'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))
const post = vi.mocked(browserApiClient.post)

const SEND = '/api/organizations/o1/conversations/mine/messages'
const thread = {
  id: 'c1',
  person_name: 'Priya Nair',
  messages: [
    { id: 'm1', sender_id: 'u1', sender_name: 'Priya', from_org: false, body: 'Do you run build days?', created_at: '2026-10-01T00:00:00Z' },
    { id: 'm2', sender_id: 'l1', sender_name: 'Rachel', from_org: true, body: 'Yes, monthly.', created_at: '2026-10-01T01:00:00Z' },
  ],
} as unknown as OrgThread

beforeEach(() => vi.clearAllMocks())

describe('OrgThreadView', () => {
  it('WN12 posts the message body to the conversation route and refreshes the page', async () => {
    post.mockResolvedValue({})
    render(<OrgThreadView thread={null} viewerId="u1" side="family" orgName="Northbank" sendPath={SEND} />)
    expect(screen.getByText(/Any of Northbank.s leaders can answer/)).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Write a message'), { target: { value: 'Hello, can we visit?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith(SEND, { body: 'Hello, can we visit?' }))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('WN12 shows the server sentence when the message is refused', async () => {
    post.mockRejectedValue(Object.assign(new Error('POST failed with status 400: {"error":"Say something first."}'), { status: 400 }))
    render(<OrgThreadView thread={null} viewerId="u1" side="family" orgName="Northbank" sendPath={SEND} />)
    fireEvent.change(screen.getByPlaceholderText('Write a message'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('WN12 shows the whole conversation and tells the family every leader reads it', () => {
    render(<OrgThreadView thread={thread} viewerId="u1" side="family" orgName="Northbank" sendPath={SEND} />)
    expect(screen.getByText('Every leader here reads this')).toBeInTheDocument()
    expect(screen.getByText('Do you run build days?')).toBeInTheDocument()
    expect(screen.getByText('Yes, monthly.')).toBeInTheDocument()
    expect(screen.queryByText(/Say who you are and what you are hoping for/)).toBeNull()
  })
})
