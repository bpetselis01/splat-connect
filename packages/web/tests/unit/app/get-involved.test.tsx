import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import GetInvolvedPage from '@/app/get-involved/page'
import FamiliesPage from '@/app/get-involved/families/page'
import ContributorsPage from '@/app/get-involved/contributors/page'
import OrganisationsPage from '@/app/get-involved/organisations/page'
import { PUBLIC_NAV } from '@/lib/public-nav'

const section = PUBLIC_NAV.find((s) => s.href === '/get-involved')!

describe('Get Involved hub', () => {
  it('leads with the three audience tracks', () => {
    render(<GetInvolvedPage />)
    expect(screen.getByRole('heading', { name: /which one are you/i })).toBeInTheDocument()
    for (const label of ['For families', 'For contributors', 'For organisations']) {
      expect(screen.getByRole('link', { name: new RegExp(label, 'i') })).toBeInTheDocument()
    }
  })

  it('links every child of the section', () => {
    render(<GetInvolvedPage />)
    for (const child of section.children) {
      expect(screen.getAllByRole('link', { name: new RegExp(child.label, 'i') })).toHaveLength(1)
    }
  })
})

describe('audience tracks', () => {
  it.each([
    ['For families', FamiliesPage],
    ['For contributors', ContributorsPage],
    ['For organisations', OrganisationsPage],
  ] as const)('%s is a numbered walkthrough', (title, Page) => {
    const { container } = render(<Page />)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(container.querySelectorAll('ol li').length).toBeGreaterThanOrEqual(3)
  })

  it('sends a family to the Guides library', () => {
    render(<FamiliesPage />)
    expect(screen.getByRole('link', { name: /browse the guides/i })).toHaveAttribute('href', '/library')
  })

  it('sends a would-be contributor to sign up', () => {
    render(<ContributorsPage />)
    expect(screen.getByRole('link', { name: /create an account|sign up/i })).toHaveAttribute('href', '/signup')
  })

  /*
   * Was "sends an organisation to contact, because onboarding is manual". It is
   * still manual — an admin reviews every request and creates the organisation
   * — but 060 gave that review a queue, so the page's primary door is the
   * request rather than a contact form somebody has to triage by hand.
   */
  it('sends an organisation to the request an admin reviews', () => {
    render(<OrganisationsPage />)
    expect(screen.getByRole('link', { name: /request an organisation/i })).toHaveAttribute(
      'href',
      '/get-involved/organisations/request'
    )
    // Still reachable, for somebody who wants to ask before they commit.
    expect(screen.getByRole('link', { name: /ask a question first/i })).toHaveAttribute(
      'href',
      '/contact'
    )
  })
})
