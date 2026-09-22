import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import GetInvolvedPage from '@/app/get-involved/page'
import FamiliesPage from '@/app/get-involved/families/page'
import ContributorsPage from '@/app/get-involved/contributors/page'
import OrganisationsPage from '@/app/get-involved/organisations/page'

const { mockGetCapabilities } = vi.hoisted(() => ({ mockGetCapabilities: vi.fn() }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: mockGetCapabilities }))

beforeEach(() => mockGetCapabilities.mockResolvedValue(null))

describe('Get Involved hub', () => {
  it('leads with the three audience tracks, as the board draws them', async () => {
    render(await GetInvolvedPage())
    for (const kicker of ['For families', 'For makers', 'For organisations']) {
      expect(screen.getByText(kicker)).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: /start with a child profile/i })).toHaveAttribute(
      'href',
      '/onboarding/child'
    )
  })

  it('sends a signed-out maker to sign up and a signed-in one to the editor', async () => {
    render(await GetInvolvedPage())
    expect(screen.getByRole('link', { name: /create an account to start writing/i })).toHaveAttribute(
      'href',
      '/signup'
    )
    mockGetCapabilities.mockResolvedValue({ profile: { id: 'u1' } })
    render(await GetInvolvedPage())
    expect(screen.getByRole('link', { name: /write your first guide/i })).toHaveAttribute('href', '/upload')
  })

  it('groups the specific things by need and offer', async () => {
    render(await GetInvolvedPage())
    expect(screen.getByRole('heading', { name: /if you need something/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /if you have something to offer/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /submit an idea/i })).toHaveAttribute(
      'href',
      '/get-involved/submit-an-idea'
    )
    expect(screen.getByRole('link', { name: /book a drop-off/i })).toHaveAttribute(
      'href',
      '/get-involved/recycling/drop-off'
    )
  })
})

describe('audience tracks', () => {
  it.each([
    ['For families', FamiliesPage],
    ['For contributors', ContributorsPage],
    ['For organisations', OrganisationsPage],
  ] as const)('%s is a numbered walkthrough', async (title, Page) => {
    const { container } = render(await Page())
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(container.querySelectorAll('ol li').length).toBeGreaterThanOrEqual(3)
  })

  it('sends a family to the Guides library', async () => {
    render(await FamiliesPage())
    expect(screen.getByRole('link', { name: /browse guides/i })).toHaveAttribute('href', '/library')
  })

  it('sends a would-be contributor to sign up', async () => {
    render(await ContributorsPage())
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/signup')
  })

  /*
   * Onboarding is still manual — an admin reviews every request and creates
   * the organisation — and the request is the page's one door. Signed out, it
   * goes through sign-in first and comes back.
   */
  it('sends an organisation to the request an admin reviews', async () => {
    render(await OrganisationsPage())
    expect(screen.getByRole('link', { name: /sign in to continue/i })).toHaveAttribute(
      'href',
      '/login?next=%2Fget-involved%2Forganisations%2Frequest'
    )
    mockGetCapabilities.mockResolvedValue({ profile: { id: 'u1' } })
    render(await OrganisationsPage())
    expect(screen.getByRole('link', { name: /start the request/i })).toHaveAttribute(
      'href',
      '/get-involved/organisations/request'
    )
  })
})
