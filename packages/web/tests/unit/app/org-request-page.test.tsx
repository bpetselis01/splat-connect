import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import RequestAnOrganisationPage from '@/app/get-involved/organisations/request/page'

const { mockGetCapabilities } = vi.hoisted(() => ({ mockGetCapabilities: vi.fn() }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: mockGetCapabilities }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn().mockResolvedValue([]) } }))
vi.mock('@/components/org-request-form', () => ({ OrgRequestForm: () => <p>REQUEST FORM</p> }))

beforeEach(() => vi.clearAllMocks())

describe('request an organisation page', () => {
  it('WI09 shows a signed-out visitor the lock card, with sign-in returning to the request', async () => {
    mockGetCapabilities.mockResolvedValue(null)
    render(await RequestAnOrganisationPage())
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in to request your organisation' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in or create an account' })).toHaveAttribute(
      'href',
      '/login?next=%2Fget-involved%2Forganisations%2Frequest'
    )
    expect(screen.queryByText('REQUEST FORM')).toBeNull()
  })

  it('WI09 shows a signed-in member the form instead of the lock card', async () => {
    mockGetCapabilities.mockResolvedValue({ profile: { id: 'u1' } })
    render(await RequestAnOrganisationPage())
    expect(screen.getByText('REQUEST FORM')).toBeInTheDocument()
    expect(screen.queryByText('Sign in to request your organisation')).toBeNull()
  })
})
