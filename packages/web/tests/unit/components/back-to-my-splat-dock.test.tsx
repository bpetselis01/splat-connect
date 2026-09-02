import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BackToMySplatDock } from '@/components/back-to-my-splat-dock'

const pathname = vi.hoisted(() => ({ current: '/learn' }))

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
    pathname.current = '/learn'
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

  // Tests: the dock yields on a rail page, because the rail has carried its own
  //        "Back to My SPLAT" pill since 2026-08-24 (components/rail.tsx)
  // How:   renders signed in on a deep account page
  // Note:  this asserted the opposite until that pill landed, and the two
  //        together put a second link to /dashboard on every rail page — a
  //        strict-mode violation in dashboard/navigation.spec.ts
  it('renders nothing on a rail-only account page', () => {
    pathname.current = '/dashboard/toys'
    render(<BackToMySplatDock signedIn />)
    expect(screen.queryByRole('link', { name: /Back to My SPLAT/ })).not.toBeInTheDocument()
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

  // Tests: on the two library list pages the dock grows into the corner menu —
  //        a trigger plus that page's actions, with Back to My SPLAT kept as
  //        the anchor item so the way back never disappears
  // How:   renders signed in on /library and /toy-library
  it('renders the corner menu on /library, anchor link included', () => {
    pathname.current = '/library'
    render(<BackToMySplatDock signedIn />)
    expect(screen.getByRole('button', { name: 'Library actions' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('link', { name: /Back to My SPLAT/, hidden: true })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'Upload a tutorial', hidden: true })).toHaveAttribute('href', '/upload')
  })

  it('renders the corner menu on /toy-library with toy actions', () => {
    pathname.current = '/toy-library'
    render(<BackToMySplatDock signedIn />)
    expect(screen.getByRole('button', { name: 'Toy library actions' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Give a toy', hidden: true })).toHaveAttribute('href', '/dashboard/toys/new')
  })

  // Tests: only the list pages get the menu — a toy's detail page keeps the
  //        plain pill
  // How:   renders signed in on a /toy-library/[id] path
  it('keeps the plain pill on a library detail page', () => {
    pathname.current = '/toy-library/abc123'
    render(<BackToMySplatDock signedIn />)
    expect(screen.getByRole('link', { name: /Back to My SPLAT/ })).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByRole('button', { name: 'Toy library actions' })).not.toBeInTheDocument()
  })
})
