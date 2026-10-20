import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AdaptationRequestsPage from '@/app/get-involved/requests/page'

const { mockGetCapabilities, mockGet } = vi.hoisted(() => ({ mockGetCapabilities: vi.fn(), mockGet: vi.fn() }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: mockGetCapabilities }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: mockGet } }))

beforeEach(() => vi.clearAllMocks())

describe('Adaptation requests page', () => {
  it('WI27 sends a signed-out visitor to sign up and never reads the exchanges', async () => {
    mockGetCapabilities.mockResolvedValue(null)
    render(await AdaptationRequestsPage())
    expect(screen.getByRole('link', { name: 'Create an account to ask' })).toHaveAttribute('href', '/signup')
    expect(screen.getByRole('link', { name: 'The open board' })).toHaveAttribute('href', '/get-involved/makers-wanted')
    expect(screen.getByRole('link', { name: 'Browse the guides' })).toHaveAttribute('href', '/library')
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('WI27 offers a signed-in member Ask for a build, and lists only their build requests with a thread link', async () => {
    mockGetCapabilities.mockResolvedValue({ profile: { id: 'u1' } })
    mockGet.mockResolvedValue([
      { id: 'tx-1', type: 'build', status: 'requested', tutorial: { title: 'Bubble machine' }, other_party_name: 'Max Maker', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', owner_confirmed_at: null, requester_confirmed_at: null, working_photo_url: null, work_approved_at: null },
      { id: 'tx-2', type: 'donation', status: 'requested', toy: { name: 'Plush bear' }, other_party_name: 'Someone', created_at: '2026-10-01T00:00:00Z' },
    ])
    render(await AdaptationRequestsPage())
    expect(screen.getByRole('link', { name: 'Ask for a build' })).toHaveAttribute('href', '/get-involved/requests/new')
    expect(mockGet).toHaveBeenCalledWith('/api/toy-transactions')
    expect(screen.getByRole('link', { name: 'Thread' })).toHaveAttribute('href', '/dashboard/exchanges/build/tx-1')
    expect(screen.getAllByRole('link', { name: 'Thread' })).toHaveLength(1)
  })
})
