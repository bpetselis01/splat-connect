import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrgInvites } from '@/components/org-invites'

const get = vi.fn()
const del = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { get: (...a: unknown[]) => get(...a), post: vi.fn(), delete: (...a: unknown[]) => del(...a) },
}))

beforeEach(() => vi.clearAllMocks())

describe('OrgInvites', () => {
  it('shows an invitation and declines it', async () => {
    get.mockResolvedValueOnce([{ id: 'i1', org_id: 'o1', org_name: 'Northbank' }]).mockResolvedValue([])
    del.mockResolvedValue(undefined)
    render(<OrgInvites />)
    expect(await screen.findByText('Northbank')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/organizations/invites/i1'))
  })
})
