import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthStage, AuthTabs } from '@/components/auth-shell'

// next/link → plain <a>, same strategy as nav.test.tsx: the auth screens render
// outside a router in jsdom.
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('auth stage', () => {
  // Chain: the board's Sign in and Check your email carry the brand lockup and a
  //        way home even though the site header sits above them
  it('carries a wordmark that links home', () => {
    render(<AuthStage>card</AuthStage>)
    const home = screen.getByRole('link', { name: /SPLAT Connect/ })
    expect(home).toHaveAttribute('href', '/')
  })

  // Chain: the footnote is the board's, and the only place these screens say
  //        the two things a parent most needs to hear before signing in
  it('ends on the board footnote', () => {
    render(<AuthStage>card</AuthStage>)
    expect(screen.getByText('No paid tier. Not a medical device.')).toBeInTheDocument()
  })
})

describe('auth tabs', () => {
  // Chain: /login and /signup are real routes carrying ?next= and their own
  //        tests, so the board's tabs are links, marked by aria-current
  it.each([
    ['signup', 'Create account', 'Sign in', '/login'],
    ['login', 'Sign in', 'Create account', '/signup'],
  ] as const)('marks %s as the current screen', (current, here, there, thereHref) => {
    render(<AuthTabs current={current} />)
    expect(screen.getByRole('link', { name: here })).toHaveAttribute('aria-current', 'page')
    const other = screen.getByRole('link', { name: there })
    expect(other).not.toHaveAttribute('aria-current')
    expect(other).toHaveAttribute('href', thereHref)
  })

  // Chain: a visitor sent to signup to save something who already has an
  //        account switches tabs — ?next= must survive, or login forgets it
  it('carries the query across to the other tab', () => {
    render(<AuthTabs current="signup" search="next=%2Ftutorials%2Ft1&reason=save" />)
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?next=%2Ftutorials%2Ft1&reason=save'
    )
  })
})
