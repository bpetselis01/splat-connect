import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrgLeaders } from '@/components/org-leaders'

const get = vi.fn()
const post = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), delete: vi.fn() },
}))

const me = { user_id: 'u1', name: 'Sam', email: 'sam@example.com', you: true }

beforeEach(() => vi.clearAllMocks())

describe('OrgLeaders', () => {
  it('lists leaders, hides Step down for a sole leader, and invites by email', async () => {
    get.mockResolvedValue({ leaders: [me], invites: [] })
    post.mockResolvedValue({ ok: true })
    render(<OrgLeaders orgId="o1" />)
    expect(await screen.findByText('Sam (you)')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Step down as leader' })).toBeNull()
    fireEvent.change(screen.getByLabelText('Invite a leader'), { target: { value: 'priya@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/organizations/o1/leaders', { email: 'priya@example.com' }))
    expect(await screen.findByText('Invited. They become a leader once they accept on their Account page.')).toBeTruthy()
  })
})
