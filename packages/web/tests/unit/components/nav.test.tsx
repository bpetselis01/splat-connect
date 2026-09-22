import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Nav } from '@/components/nav'
import type { Capabilities } from '@/lib/capabilities'

const pathname = vi.hoisted(() => ({ current: '/' }))

// --- Mock strategy ---
// next/link is replaced with a plain <a> tag so links render in jsdom without Next.js routing
// infrastructure, and usePathname is stubbed via a hoisted ref (so individual tests can vary
// the current path) because Nav reads it to mark the active section.
// Wrapped in a vi.fn so the boundary-crossing tests can assert whether a given
// pill went through next/link at all, not just what its resulting href is.
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

const signedIn = {
  profile: { id: 'u1', name: 'Byron Petselis', email: 'b@example.com', role: 'contributor', public_showcase: true, created_at: '' },
  isAdmin: false,
  ledOrgs: [],
  unread: { tutorials: 1, exchanges: 1, challenges: 1, total: 3 },
  exchangeActions: 0,
} as unknown as Capabilities

describe('Nav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pathname.current = '/'
  })

  const openMore = () => fireEvent.click(screen.getByRole('button', { name: /More/ }))

  // Tests: the bar carries the board's five tabs and nothing else at rest
  // How:   renders signed out; checks each tab link, and that Learn is not on the bar
  // Chain: NAV5 on the artboard — five primary items, everything else behind More
  it('shows the five primary tabs, with the rest behind More', () => {
    render(<Nav caps={null} />)
    for (const label of ['Guides', 'Toy Library', '3D Printing', 'Get Involved', 'About']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(screen.queryByRole('link', { name: /Learn/ })).toBeNull()
  })

  // Tests: the tutorial catalogue is labelled Guides and links to /library
  it('labels the tutorial catalogue Guides, not Library', () => {
    render(<Nav caps={null} />)
    expect(screen.getByRole('link', { name: 'Guides' })).toHaveAttribute('href', '/library')
    expect(screen.queryByRole('link', { name: 'Library' })).toBeNull()
  })

  // Tests: More opens the board's eight items, each with its blurb
  // How:   clicks More; checks aria-expanded flips and every item is a link to its route
  // Chain: live's More was a bare two-item list; the board draws a two-column grid of eight
  it('opens all eight More items as links', () => {
    render(<Nav caps={null} />)
    const more = screen.getByRole('button', { name: /More/ })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    openMore()
    expect(more).toHaveAttribute('aria-expanded', 'true')
    const expected: [string, string][] = [
      ['Learn', '/learn'],
      ['Impact', '/impact'],
      ['Design challenges', '/get-involved/design-challenges'],
      ['Organisations', '/organizations'],
      ['Events', '/get-involved/events'],
      ['Stories', '/about/stories'],
      ['Design system', '/design-system'],
      ['Contact', '/contact'],
    ]
    for (const [label, href] of expected) {
      expect(screen.getByRole('link', { name: new RegExp(`^${label}`) })).toHaveAttribute('href', href)
    }
    expect(screen.getByText('Problems nobody has solved yet, open to anyone.')).toBeInTheDocument()
  })

  // Tests: Escape closes More and hands focus back to its button
  // Chain: a disclosure that traps a keyboard user inside it, or drops focus on the page body
  //        when it closes, is the failure mode this header must not have
  it('closes More on Escape and returns focus to the button', () => {
    render(<Nav caps={null} />)
    openMore()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('link', { name: /^Learn/ })).toBeNull()
    expect(screen.getByRole('button', { name: /More/ })).toHaveFocus()
  })

  // Tests: a press outside the menu closes it
  it('closes More on a press outside it', () => {
    render(<Nav caps={null} />)
    openMore()
    fireEvent.pointerDown(document.body)
    expect(screen.getByRole('button', { name: /More/ })).toHaveAttribute('aria-expanded', 'false')
  })

  // Tests: a tab section is marked current from a nested path via sectionFor
  it('marks the tab current from a nested path', () => {
    pathname.current = '/printing/requests'
    render(<Nav caps={null} />)
    expect(screen.getByRole('link', { name: '3D Printing' })).toHaveAttribute('aria-current', 'page')
  })

  // Tests: a page that lives behind More marks both More and its item
  // Chain: otherwise a visitor on /learn sees no tab lit and cannot tell where they are
  it('marks More and the item current for a page behind More', () => {
    pathname.current = '/learn/switch-types'
    render(<Nav caps={null} />)
    expect(screen.getByRole('button', { name: /More/ })).toHaveAttribute('data-current', 'true')
    openMore()
    expect(screen.getByRole('link', { name: /^Learn/ })).toHaveAttribute('aria-current', 'page')
  })

  // Tests: the search box submits to the guides library as ?q=
  // Chain: a plain GET form works before hydration; library/page.tsx reads q
  it('submits search to /library as q', () => {
    render(<Nav caps={null} />)
    const input = screen.getByRole('searchbox', { name: 'Search' })
    expect(input).toHaveAttribute('name', 'q')
    expect(input.closest('form')).toHaveAttribute('action', '/library')
  })

  // Tests: the three colour modes and reduce-motion are real toggles
  // How:   clicks Dark, checks the body attribute, the pressed state and the cookie
  it('switches colour mode on the body and remembers it', () => {
    render(<Nav caps={null} />)
    expect(screen.getByRole('button', { name: 'Light mode' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Dark mode' }))
    expect(document.body.dataset.mode).toBe('dark')
    expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.cookie).toMatch(/splat-mode=dark/)
    fireEvent.click(screen.getByRole('button', { name: 'Light mode' }))
    expect(document.body.dataset.mode).toBeUndefined()
  })

  it('toggles reduced motion on the body', () => {
    render(<Nav caps={null} />)
    const motion = screen.getByRole('button', { name: 'Reduce motion' })
    fireEvent.click(motion)
    expect(document.body.dataset.motion).toBe('reduced')
    expect(motion).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(motion)
    expect(document.body.dataset.motion).toBeUndefined()
  })

  // Tests: the server-rendered mode seeds the toggles
  it('starts from the mode the server rendered', () => {
    render(<Nav caps={null} mode="hc" />)
    expect(screen.getByRole('button', { name: 'High contrast mode' })).toHaveAttribute('aria-pressed', 'true')
  })

  // Tests: signed out gets Sign in (to /login) and no account pill
  it('offers sign in and no account pill when signed out', () => {
    render(<Nav caps={null} />)
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('link', { name: /My SPLAT/ })).not.toBeInTheDocument()
  })

  // Tests: signed in, the bar ends on My SPLAT — no Sign in, and no Sign out
  // Chain: the board's header has no sign-out; it lives on the Account page now
  it('ends on My SPLAT when signed in, with no sign in or sign out', () => {
    render(<Nav caps={signedIn} />)
    expect(screen.getByRole('link', { name: /My SPLAT/ })).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })

  // Tests: the unread badge and the initials both ride inside the My SPLAT pill
  // Chain: the board draws one pill — label, coral count, mint avatar — not three loose parts
  it('carries the unread count and initials inside My SPLAT', () => {
    render(<Nav caps={signedIn} />)
    const account = screen.getByRole('link', { name: /My SPLAT/ })
    expect(account).toHaveAccessibleName(/3 unread/)
    expect(account).toContainElement(screen.getByTitle(signedIn.profile.name))
    expect(screen.getByTitle(signedIn.profile.name)).toHaveTextContent('BP')
  })

  it('shows no badge at zero unread', () => {
    render(<Nav caps={{ ...signedIn, unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 0 } }} />)
    expect(screen.getByRole('link', { name: /My SPLAT/ })).not.toHaveAccessibleName(/unread/)
  })

  // Tests: entering the account section via the header forces a full page load,
  //        not a soft <Link> transition, so the rail (a root-layout decision)
  //        actually appears instead of requiring a second hard refresh
  // How:   pathname is a public route (the default); the My SPLAT pill still
  //        resolves to /dashboard but must not have gone through next/link
  // Chain: same staleness class signOut()'s hard reload already guards against
  it('renders My SPLAT as a plain anchor from a public page', () => {
    render(<Nav caps={signedIn} />)
    const account = screen.getByRole('link', { name: /My SPLAT/ })
    expect(account).toHaveAttribute('href', '/dashboard')
    expect(mockLink.mock.calls.some((call) => call[0].href === '/dashboard')).toBe(false)
  })

  // Tests: entering the account section from a public page via a section pill
  //        also forces a full page load, for the same reason in reverse
  // How:   pathname is a public route (the default); the Guides pill still
  //        resolves to /library but must not have gone through next/link
  // Chain: same staleness class signOut()'s hard reload already guards against
  it('renders a section pill as a plain anchor when already inside the account section', () => {
    pathname.current = '/dashboard'
    render(<Nav caps={signedIn} />)
    const guides = screen.getByRole('link', { name: /Guides/ })
    expect(guides).toHaveAttribute('href', '/library')
    expect(mockLink.mock.calls.some((call) => call[0].href === '/library')).toBe(false)
  })

  // Tests: the wordmark is not exempt from the boundary-crossing fix — from an
  //        account page it always resolves to the public homepage, so clicking
  //        it must also force a full page load rather than a soft <Link>
  //        transition (same staleness risk f38ad52 closed for the other pills)
  // How:   pathname is an account route; the wordmark still resolves to '/' but
  //        must not have gone through next/link
  // Chain: f38ad52 wired NavLink for the section pills and the My SPLAT pill but
  //        left the wordmark on a plain <Link>, reopening the exact bug it fixed
  it('renders the wordmark as a plain anchor when inside the account section', () => {
    pathname.current = '/dashboard'
    render(<Nav caps={signedIn} />)
    const wordmark = screen.getByRole('link', { name: /SPLAT Connect/ })
    expect(wordmark).toHaveAttribute('href', '/')
    expect(mockLink.mock.calls.some((call) => call[0].href === '/')).toBe(false)
  })

  // Tests: the My SPLAT pill is a soft transition from any account page
  // How:   pathname is an account page; the pill resolves to /dashboard and
  //        must have gone through next/link
  // Chain: this used to be a plain anchor because /dashboard rendered the
  //        header while its children rendered the rail. The rail is gone, so
  //        both ends render the same chrome and a full load buys nothing
  it('renders My SPLAT as a soft link from another account page', () => {
    pathname.current = '/dashboard/toys'
    render(<Nav caps={signedIn} />)
    const account = screen.getByRole('link', { name: /My SPLAT/ })
    expect(account).toHaveAttribute('href', '/dashboard')
    expect(mockLink.mock.calls.some((call) => call[0].href === '/dashboard')).toBe(true)
  })

  // Tests: clicking My SPLAT while already on /dashboard is a same-page
  //        no-op, not a crossing — it must still go through next/link
  // How:   pathname is /dashboard itself; the My SPLAT pill's href is checked
  //        against next/link's mock calls
  it('renders My SPLAT through next/link when already on /dashboard', () => {
    pathname.current = '/dashboard'
    render(<Nav caps={signedIn} />)
    const account = screen.getByRole('link', { name: /My SPLAT/ })
    expect(account).toHaveAttribute('href', '/dashboard')
    expect(mockLink.mock.calls.some((call) => call[0].href === '/dashboard')).toBe(true)
  })

  // Tests: a same-side pill (already public, linking to another public section)
  //        still goes through next/link — nothing else would catch `crossing`
  //        becoming accidentally too broad and downgrading a non-crossing pill
  // How:   pathname is a public route (the default); the Guides pill's href is
  //        checked against next/link's mock calls
  it('renders a section pill through next/link when it does not cross the boundary', () => {
    render(<Nav caps={signedIn} />)
    const guides = screen.getByRole('link', { name: /Guides/ })
    expect(guides).toHaveAttribute('href', '/library')
    expect(mockLink.mock.calls.some((call) => call[0].href === '/library')).toBe(true)
  })
})
