import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import BookDropoffPage from '@/app/get-involved/recycling/drop-off/page'

const { mockGetCapabilities, mockGet } = vi.hoisted(() => ({ mockGetCapabilities: vi.fn(), mockGet: vi.fn() }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: mockGetCapabilities }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: mockGet } }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock('@/components/dropoff-form', () => ({
  DropoffForm: ({ orgs, initialOrgId }: { orgs: { id: string }[]; initialOrgId?: string }) => (
    <p>FORM {orgs.map((o) => o.id).join(',')} preselect={initialOrgId ?? 'none'}</p>
  ),
}))

beforeEach(() => vi.clearAllMocks())

describe('Book a drop-off page', () => {
  it('WI38 sends a signed-out visitor to sign in and keeps the ?org= choice on the way back', async () => {
    mockGetCapabilities.mockResolvedValue(null)
    await expect(BookDropoffPage({ searchParams: Promise.resolve({ org: 'north' }) })).rejects.toThrow(
      'REDIRECT:/login?next=%2Fget-involved%2Frecycling%2Fdrop-off%3Forg%3Dnorth'
    )
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('WI38 sends a signed-out visitor with no ?org= back to the bare path', async () => {
    mockGetCapabilities.mockResolvedValue(null)
    await expect(BookDropoffPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/login?next=%2Fget-involved%2Frecycling%2Fdrop-off'
    )
  })

  it('WI37 offers a signed-in member only the organisations that take plastic, preselecting ?org=', async () => {
    mockGetCapabilities.mockResolvedValue({ profile: { id: 'u1' } })
    mockGet.mockResolvedValue([
      { id: 'north', recycling_materials: ['PLA'] },
      { id: 'south', recycling_materials: [] },
    ])
    render(await BookDropoffPage({ searchParams: Promise.resolve({ org: 'north' }) }))
    expect(screen.getByText('FORM north preselect=north')).toBeInTheDocument()
  })
})
