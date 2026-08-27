import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthShell, AuthCard } from '@/components/auth-shell'

// next/link → plain <a>, same strategy as nav.test.tsx: the auth screens render
// outside a router in jsdom.
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('auth shell', () => {
  // Tests: the auth screens carry a wordmark that links home
  // How:   renders the shell and asserts a link to / containing the brand name
  // Chain: /login and /signup are in layout.tsx's BARE_PREFIXES, so they render no
  //        Nav at all. Before this the string "SPLAT Connect" appeared nowhere in the
  //        rendered page — a visitor landing on the sign-in screen got no branding
  //        and no way back to the site
  it('gives the bare auth screens a wordmark that links home', () => {
    render(
      <AuthShell current="login">
        <p>form</p>
      </AuthShell>,
    )
    const home = screen.getByRole('link', { name: /SPLAT Connect/ })
    expect(home).toHaveAttribute('href', '/')
  })

  // Tests: the switch marks the current screen and offers the other one
  // How:   renders each variant and checks which tab carries aria-current="page"
  // Chain: the filled tab is styled from [aria-current='page'] in globals.css, so the
  //        attribute is not decoration — it is what draws the state. If it stops being
  //        set, both tabs render identically white and the switch stops saying
  //        anything about where you are
  it.each([
    ['login', 'Sign in', 'Create account', '/signup'],
    ['signup', 'Create account', 'Sign in', '/login'],
  ] as const)('marks %s as the current tab', (current, here, there, thereHref) => {
    render(
      <AuthShell current={current}>
        <p>form</p>
      </AuthShell>,
    )
    expect(screen.getByRole('link', { name: here })).toHaveAttribute('aria-current', 'page')
    const other = screen.getByRole('link', { name: there })
    expect(other).not.toHaveAttribute('aria-current')
    expect(other).toHaveAttribute('href', thereHref)
  })

  // Tests: both tabs stay real routes rather than collapsing into one screen
  // How:   asserts the two hrefs are the live routes
  // Chain: the board models the switch as local view state because an artboard has no
  //        router. Here they are real routes carrying ?next= and their own tests —
  //        turning them into one screen would cost that for nothing a visitor sees
  it('keeps both auth screens as their own routes', () => {
    render(
      <AuthShell current="login">
        <p>form</p>
      </AuthShell>,
    )
    const hrefs = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
      .filter((h) => h !== '/')
    expect(hrefs).toEqual(['/login', '/signup'])
  })

  // Tests: the card is the bordered pixel card, not the soft one
  // How:   asserts card-pixel and the deeper 6px shadow the board draws here
  // Chain: it shipped as .card — borderless, 16px radius, blurred shadow — which is
  //        the pre-pixel surface. The 6px is a rung deeper than an ordinary
  //        .card-pixel because it is the only object on the screen
  it('sits the form in the bordered card at the depth the board draws', () => {
    const { container } = render(<AuthCard>form</AuthCard>)
    const card = container.firstElementChild!
    expect(card).toHaveClass('card-pixel')
    expect(card.className).toContain('shadow-[6px_6px_0_var(--color-ink)]')
  })
})
