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

  it('sends an organisation to contact, because onboarding is manual', () => {
    render(<OrganisationsPage />)
    expect(screen.getByRole('link', { name: /get in touch|contact/i })).toHaveAttribute('href', '/contact')
  })
})
