import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrgLeaders } from '@/components/org-leaders'

const get = vi.fn()
const post = vi.fn()
const del = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), delete: (...a: unknown[]) => del(...a) },
}))

const me = { user_id: 'u1', name: 'Sam', email: 'sam@example.com', you: true }

beforeEach(() => vi.clearAllMocks())

describe('OrgLeaders', () => {
  it('WB33 lists leaders, hides Step down for a sole leader, and invites by email', async () => {
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
  it('WB34 "Cancel invitation" deletes that invitation and reloads the list', async () => {
    get.mockResolvedValueOnce({ leaders: [me], invites: [{ id: 'inv1', name: 'Priya', email: 'priya@example.com' }] })
    get.mockResolvedValueOnce({ leaders: [me], invites: [] })
    del.mockResolvedValue({ ok: true })
    render(<OrgLeaders orgId="o1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel invitation' }))
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/organizations/o1/leaders/invites/inv1'))
    await waitFor(() => expect(screen.queryByText('Priya')).toBeNull())
  })

  it('WB35 "Step down as leader" appears with a second leader, deletes the seat and goes to /dashboard', async () => {
    const other = { user_id: 'u2', name: 'Priya', email: 'priya@example.com', you: false }
    get.mockResolvedValue({ leaders: [me, other], invites: [] })
    del.mockResolvedValue({ ok: true })
    const location = { href: '/dashboard/organisation/profile' }
    vi.stubGlobal('location', location)
    render(<OrgLeaders orgId="o1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Step down as leader' }))
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/organizations/o1/leaders/me'))
    await waitFor(() => expect(location.href).toBe('/dashboard'))
    vi.unstubAllGlobals()
  })

  it('WB35 keeps the leader on the page and says why when stepping down is refused', async () => {
    get.mockResolvedValue({ leaders: [me, { user_id: 'u2', name: 'Priya', email: 'priya@example.com', you: false }], invites: [] })
    del.mockRejectedValue(new Error('API DELETE /api/organizations/o1/leaders/me failed with status 409: You are the last leader'))
    render(<OrgLeaders orgId="o1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Step down as leader' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You are the last leader')
  })
})
