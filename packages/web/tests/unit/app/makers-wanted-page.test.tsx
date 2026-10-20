import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import MakersWantedPage from '@/app/get-involved/makers-wanted/page'

const { mockGetCapabilities, mockGet } = vi.hoisted(() => ({ mockGetCapabilities: vi.fn(), mockGet: vi.fn() }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: mockGetCapabilities }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: mockGet } }))
vi.mock('@/components/makers-wanted-board', () => ({ MakersWantedBoard: ({ builds }: { builds: unknown[] }) => <p>BOARD {builds.length}</p> }))

beforeEach(() => vi.clearAllMocks())

describe('Makers wanted page', () => {
  it('WI23 shows a signed-out visitor the explainer, and sign-in returns to the board', async () => {
    mockGetCapabilities.mockResolvedValue(null)
    render(await MakersWantedPage())
    expect(screen.getByRole('heading', { level: 1, name: 'Makers wanted' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in to see requests' })).toHaveAttribute(
      'href',
      '/login?next=%2Fget-involved%2Fmakers-wanted'
    )
    expect(screen.getByRole('link', { name: 'Browse the guides first' })).toHaveAttribute('href', '/library')
    expect(screen.queryByText(/BOARD/)).toBeNull()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('WI23 loads the open board for a signed-in member and offers Ask for a build', async () => {
    mockGetCapabilities.mockResolvedValue({ profile: { id: 'u1' } })
    mockGet.mockResolvedValue([{ id: 'b1', tutorial: { id: 'g1', title: 'Bubble machine' } }])
    render(await MakersWantedPage())
    expect(mockGet).toHaveBeenCalledWith('/api/toy-transactions/open-builds')
    expect(screen.getByText('BOARD 1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ask for a build/i })).toHaveAttribute('href', '/get-involved/makers-wanted/new')
    expect(screen.getByText('Bubble machine')).toBeInTheDocument()
  })
})
