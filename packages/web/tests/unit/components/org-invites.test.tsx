import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrgInvites } from '@/components/org-invites'

const get = vi.fn()
const del = vi.fn()
const post = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), delete: (...a: unknown[]) => del(...a) },
}))

beforeEach(() => vi.clearAllMocks())

describe('OrgInvites', () => {
  it('WD09 shows an invitation and declines it', async () => {
    get.mockResolvedValueOnce([{ id: 'i1', org_id: 'o1', org_name: 'Northbank' }]).mockResolvedValue([])
    del.mockResolvedValue(undefined)
    render(<OrgInvites />)
    expect(await screen.findByText('Northbank')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/organizations/invites/i1'))
  })

  it('WD08 accepts an invitation with the invitation id, then reloads so the organisation group appears', async () => {
    get.mockResolvedValue([{ id: 'i1', org_id: 'o1', org_name: 'Northbank' }])
    post.mockResolvedValue(undefined)
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    render(<OrgInvites />)
    await screen.findByText('Northbank')
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/organizations/invites/i1/accept', {}))
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
    vi.unstubAllGlobals()
  })
})
