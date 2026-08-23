import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BackToMySplatDock } from '@/components/back-to-my-splat-dock'

const pathname = vi.hoisted(() => ({ current: '/library' }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

describe('BackToMySplatDock', () => {
  beforeEach(() => {
    pathname.current = '/library'
  })

  // Tests: the dock is the way back to My SPLAT from a page with no header
  //        pointing there
  // How:   renders signed in on a public page
  // Chain: docs/superpowers/specs/2026-08-23-my-splat-front-door-design.md
  it('renders a link to /dashboard for a signed-in visitor on a public page', () => {
    render(<BackToMySplatDock signedIn />)
    const link = screen.getByRole('link', { name: /Back to My SPLAT/ })
    expect(link).toHaveAttribute('href', '/dashboard')
  })

  // Tests: the dock also covers rail-only account pages, not just public ones
  // How:   renders signed in on a deep account page
  it('renders on a rail-only account page', () => {
    pathname.current = '/dashboard/toys'
    render(<BackToMySplatDock signedIn />)
    expect(screen.getByRole('link', { name: /Back to My SPLAT/ })).toBeInTheDocument()
  })

  // Tests: My SPLAT itself already has the header, so the dock would be
  //        redundant there
  // How:   renders signed in on /dashboard
  it('renders nothing on /dashboard itself', () => {
    pathname.current = '/dashboard'
    render(<BackToMySplatDock signedIn />)
    expect(screen.queryByRole('link', { name: /Back to My SPLAT/ })).not.toBeInTheDocument()
  })

  // Tests: a signed-out visitor never sees a way "back" to an account they
  //        don't have
  // How:   renders with signedIn={false}
  it('renders nothing for a signed-out visitor', () => {
    render(<BackToMySplatDock signedIn={false} />)
    expect(screen.queryByRole('link', { name: /Back to My SPLAT/ })).not.toBeInTheDocument()
  })
})
