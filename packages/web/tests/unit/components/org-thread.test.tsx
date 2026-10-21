import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrgThreadView } from '@/components/org-thread'
import type { OrgThread } from '@splat-connect/types'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
const post = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: (...a: unknown[]) => post(...a) } }))

const thread = {
  conversation: { id: 'c1', org_id: 'o1', profile_id: 'fam', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' },
  org_name: 'Northbank',
  person_name: 'Priya',
  messages: [
    { id: 'm1', conversation_id: 'c1', sender_id: 'fam', body: 'Can we come on Thursday?', created_at: '2026-10-01T00:00:00Z', sender_name: 'Priya', from_org: false },
    { id: 'm2', conversation_id: 'c1', sender_id: 'lead', body: 'Yes, bring the switch.', created_at: '2026-10-01T01:00:00Z', sender_name: 'Jo', from_org: true },
  ],
} as unknown as OrgThread

beforeEach(() => vi.clearAllMocks())

const sendPath = '/api/organizations/conversations/c1/messages'

describe('OrgThreadView', () => {
  it('WD35 posts the typed message to the conversation, clears the box and refreshes the thread', async () => {
    post.mockResolvedValue({})
    render(<OrgThreadView thread={thread} viewerId="fam" side="family" orgName="Northbank" sendPath={sendPath} />)
    fireEvent.change(screen.getByPlaceholderText('Write a message'), { target: { value: 'See you then' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith(sendPath, { body: 'See you then' }))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(screen.getByPlaceholderText('Write a message')).toHaveProperty('value', '')
  })

  it('WD35 sends nothing for a blank message', () => {
    render(<OrgThreadView thread={thread} viewerId="fam" side="family" orgName="Northbank" sendPath={sendPath} />)
    fireEvent.change(screen.getByPlaceholderText('Write a message'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Send' })).toHaveProperty('disabled', true)
    expect(post).not.toHaveBeenCalled()
  })

  it('WD35 says it did not send, and does not refresh, when the API refuses', async () => {
    post.mockRejectedValue(new Error('boom'))
    render(<OrgThreadView thread={thread} viewerId="fam" side="family" orgName="Northbank" sendPath={sendPath} />)
    fireEvent.change(screen.getByPlaceholderText('Write a message'), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect((await screen.findByRole('alert')).textContent).toBe('That did not send. Try again.')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('WD35 shows the family a leader’s message under the organisation name, and the leader the family’s name', () => {
    const { unmount } = render(<OrgThreadView thread={thread} viewerId="fam" side="family" orgName="Northbank" sendPath={sendPath} />)
    expect(screen.getByText('Yes, bring the switch.')).toBeInTheDocument()
    expect(screen.getAllByText(/Jo · Northbank/).length).toBeGreaterThan(0)
    expect(screen.getByText('Every leader here reads this')).toBeInTheDocument()
    unmount()

    render(<OrgThreadView thread={thread} viewerId="lead" side="org" orgName="Northbank" sendPath={sendPath} />)
    expect(screen.getByText('Writing to Northbank')).toBeInTheDocument()
    expect(screen.getAllByText('Priya').length).toBeGreaterThan(0)
  })

  it('WD35 invites the family to introduce themselves when the thread is empty', () => {
    render(<OrgThreadView thread={{ ...thread, messages: [] }} viewerId="fam" side="family" orgName="Northbank" sendPath={sendPath} />)
    expect(screen.getByText(/Say who you are and what you are hoping for\. Any of Northbank’s leaders can answer\./)).toBeInTheDocument()
  })
})
