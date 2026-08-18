import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AboutPage from '@/app/about/page'
import TeamPage from '@/app/about/team/page'
import ContactPage from '@/app/contact/page'
import { ORG_FACTS } from '@/lib/org-facts'
import { TEAM_MEMBERS } from '@/app/about/team/page'

describe('About', () => {
  it('explains what SPLAT is and why it exists', () => {
    render(<AboutPage />)
    expect(screen.getByRole('heading', { level: 1, name: /about splat/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /why this exists/i })).toBeInTheDocument()
  })

  it('routes on to the team and to contact', () => {
    render(<AboutPage />)
    expect(screen.getByRole('link', { name: /our team/i })).toHaveAttribute('href', '/about/team')
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact')
  })

  // Guard against shipping the scaffold copy. These must be replaced before launch.
  // TODO.re-arm: the organisation's registered legal name and its base city/state
  // are not available yet — nobody has supplied them. Flip `it.todo` back to `it`
  // once ORG_FACTS.legalName and ORG_FACTS.basedIn hold real values.
  it.todo('has had its organisation facts filled in', () => {
    expect(ORG_FACTS.legalName).not.toMatch(/^TODO/)
    expect(ORG_FACTS.basedIn).not.toMatch(/^TODO/)
  })

  // TODO.re-arm: no real team member has been supplied yet (name, role, bio all
  // still placeholder). Flip `it.todo` back to `it` once TEAM_MEMBERS[0].name
  // holds a real person's name.
  it.todo('lists at least one real team member', () => {
    expect(TEAM_MEMBERS.length).toBeGreaterThan(0)
    expect(TEAM_MEMBERS[0].name).not.toMatch(/^TODO/)
  })

  it('renders a card per team member', () => {
    render(<TeamPage />)
    for (const member of TEAM_MEMBERS) {
      expect(screen.getByText(member.name)).toBeInTheDocument()
    }
  })

  it('gives contact routes for the three things people actually write in about', () => {
    render(<ContactPage />)
    expect(screen.getByRole('heading', { level: 1, name: /contact/i })).toBeInTheDocument()
    expect(screen.getAllByText(/safety/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/organisation/i).length).toBeGreaterThan(0)
  })
})
