import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AboutPage from '@/app/about/page'
import TeamPage from '@/app/about/team/page'
import ContactPage from '@/app/contact/page'
import { ORG_FACTS } from '@/lib/org-facts'
import { TEAM_MEMBERS } from '@/app/about/team/page'

// The contact page reads capabilities to prefill the form, and lib/capabilities
// pulls in api-client, which imports `server-only` — that throws on import
// under vitest. Mocked rather than stubbed for the same reason as every other
// async page test here. Signed out, because that is the case the assertions
// below are about: the form does not require an account.
vi.mock('@/lib/capabilities', () => ({ getCapabilities: async () => null }))

describe('About', () => {
  it('explains what SPLAT is and why it exists', () => {
    render(<AboutPage />)
    expect(screen.getByRole('heading', { level: 1, name: /^about$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /why this exists/i })).toBeInTheDocument()
  })

  it('routes on to the team and to contact', () => {
    // The CTA in "Who runs it" and the card in the About hub grid both point
    // here now, so check every link with this name rather than assuming one.
    render(<AboutPage />)
    for (const link of screen.getAllByRole('link', { name: /our team/i })) {
      expect(link).toHaveAttribute('href', '/about/team')
    }
    for (const link of screen.getAllByRole('link', { name: /contact/i })) {
      expect(link).toHaveAttribute('href', '/contact')
    }
  })

  it('grids the rest of the About hub', () => {
    render(<AboutPage />)
    expect(screen.getByRole('link', { name: /partners.*supporters/i })).toHaveAttribute(
      'href',
      '/about/partners'
    )
    expect(screen.getByRole('link', { name: /support splat/i })).toHaveAttribute(
      'href',
      '/about/support'
    )
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

  it('gives contact routes for the three things people actually write in about', async () => {
    render(await ContactPage())
    expect(screen.getByRole('heading', { level: 1, name: /contact/i })).toBeInTheDocument()
    expect(screen.getAllByText(/safety/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/organisation/i).length).toBeGreaterThan(0)
  })

  // Tests: the form is on the page and asks nothing an anonymous sender cannot
  //        give
  // Chain: it was a mailto: link, which meant a safety report reached whichever
  //        inbox somebody happened to be watching. 065 gave it a queue where
  //        safety jumps ahead — but only if there is a form to fill in
  it('offers a form as well as the email address', async () => {
    render(await ContactPage())
    expect(screen.getByRole('button', { name: /send it/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/what is it about/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/your email/i)).toBeInTheDocument()
  })
})
