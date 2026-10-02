import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import RecyclingPage from '@/app/get-involved/recycling/page'

const { mockGetCapabilities, mockGet } = vi.hoisted(() => ({ mockGetCapabilities: vi.fn(), mockGet: vi.fn() }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: mockGetCapabilities }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: mockGet } }))

beforeEach(() => {
  mockGetCapabilities.mockResolvedValue({ profile: { id: 'u1' } })
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/organizations/recycling/credit'
        ? [{ org_id: 'north', org_name: 'Northside Therapy', grams: 1900, weighed_grams: 3200 }]
        : []
    )
  )
})

describe('Recycling, signed in', () => {
  it('lists unspent print credit per organisation', async () => {
    render(await RecyclingPage())
    expect(screen.getByText('Print credit, unspent')).toBeInTheDocument()
    expect(screen.getByText('Northside Therapy')).toBeInTheDocument()
    expect(screen.getByText('1900 g')).toBeInTheDocument()
    expect(
      screen.getByText('Spendable on filament at that organisation only. It comes off the cost panel when they take your print job.')
    ).toBeInTheDocument()
  })

  it('draws nothing when there is no credit', async () => {
    mockGet.mockResolvedValue([])
    render(await RecyclingPage())
    expect(screen.queryByText('Print credit, unspent')).toBeNull()
  })
})
