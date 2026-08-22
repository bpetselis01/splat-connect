import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicFooter } from '@/components/public-footer'
import { PUBLIC_NAV, FOOTER_LEGAL } from '@/lib/public-nav'

const pathname = vi.hoisted(() => ({ current: '/' }))

// Same mock strategy as tests/unit/components/nav.test.tsx: next/link becomes
// a plain <a> so links render in jsdom, wrapped in a vi.fn so the
// boundary-crossing test can assert whether a link went through next/link at
// all, not just what its resulting href is. usePathname is stubbed via a
// hoisted ref so individual tests can vary the current path.
const mockLink = vi.fn(
  ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
)
vi.mock('next/link', () => ({
  default: (props: { href: string; children: React.ReactNode; [key: string]: unknown }) => mockLink(props),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}))

describe('PublicFooter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pathname.current = '/'
  })

  it('gives every section a column heading', () => {
    render(<PublicFooter />)
    for (const section of PUBLIC_NAV) {
      expect(screen.getByRole('link', { name: section.label })).toHaveAttribute(
        'href',
        section.href
      )
    }
  })

  // The whole reason the footer exists: one click to anywhere, from anywhere.
  it('links every child of every section exactly once with correct href', () => {
    render(<PublicFooter />)
    for (const child of PUBLIC_NAV.flatMap((s) => s.children)) {
      const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const links = screen.getAllByRole('link', {
        name: new RegExp(`^${escapeRegex(child.label)}( SOON)?$`),
      })
      expect(links).toHaveLength(1)
      expect(links[0]).toHaveAttribute('href', child.href)
    }
  })

  it('links every legal page', () => {
    render(<PublicFooter />)
    for (const legal of FOOTER_LEGAL) {
      expect(screen.getByRole('link', { name: legal.label })).toHaveAttribute('href', legal.href)
    }
  })

  it('marks not-yet-built destinations so the footer is not a set of traps', () => {
    render(<PublicFooter />)
    expect(screen.getByRole('link', { name: /adaptation requests/i })).toHaveTextContent(/soon/i)
  })

  it('contains no button or expandable control — it is plain links only', () => {
    render(<PublicFooter />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(document.querySelector('[aria-expanded]')).toBeNull()
  })

  // Tests: the footer renders on every account page (app/layout.tsx renders
  //        it unconditionally, outside the account/public conditional), so a
  //        section link clicked from there must force a full page load, not
  //        a soft <Link> transition, or the rail and quiet header go stale.
  //        This was the biggest exposure in the final review — roughly 45
  //        links, none guarded.
  // How:   pathname is an account route; the Guides column heading still
  //        resolves to /library but must not have gone through next/link
  // Chain: same staleness class components/nav.tsx's NavLink already guards
  //        against for the header — components/boundary-link.tsx closes it
  //        here too
  it('renders a section link as a plain anchor from an account page', () => {
    pathname.current = '/dashboard'
    render(<PublicFooter />)
    const guides = screen.getByRole('link', { name: 'Guides' })
    expect(guides).toHaveAttribute('href', '/library')
    expect(mockLink.mock.calls.some((call) => call[0].href === '/library')).toBe(false)
  })

  // Tests: the reverse case does not exist for the footer (it never links to
  //        the account section), but a same-side link from a public page
  //        must still go through next/link — otherwise every footer link
  //        would silently become a full reload and the guard would be
  //        pointless
  // How:   pathname is a public route (the default); the Guides link's href
  //        is checked against next/link's mock calls
  it('renders a section link through next/link when not on an account page', () => {
    render(<PublicFooter />)
    const guides = screen.getByRole('link', { name: 'Guides' })
    expect(guides).toHaveAttribute('href', '/library')
    expect(mockLink.mock.calls.some((call) => call[0].href === '/library')).toBe(true)
  })
})
