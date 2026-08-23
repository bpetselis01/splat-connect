import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Nav } from '@/components/nav'
import { DrawerProvider, useDrawer } from '@/components/drawer-context'
import type { Capabilities } from '@/lib/capabilities'

const mockSignOut = vi.fn()
const pathname = vi.hoisted(() => ({ current: '/' }))

// --- Mock strategy ---
// Four things are mocked: next/link is replaced with a plain <a> tag so links render in
// jsdom without Next.js routing infrastructure; usePathname is stubbed via a hoisted ref (so
// individual tests can vary the current path) because Nav reads it to mark the active section
// and there is no router mounted here; the Supabase client is replaced so mockSignOut can be
// inspected; and window.location is stubbed with a writable href so the post-sign-out redirect
// can be asserted without triggering real navigation.
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

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: mockSignOut } }),
}))

const signedIn = {
  profile: { id: 'u1', name: 'Byron Petselis', email: 'b@example.com', role: 'contributor', public_showcase: true, created_at: '' },
  isAdmin: false,
  ledOrgs: [],
  canAuthor: true,
  unreadNotifications: 3,
  exchangeActions: 0,
} as unknown as Capabilities

describe('Nav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue({})
    vi.stubGlobal('location', { href: '' })
    pathname.current = '/'
  })

  // Tests: all six public sections from PUBLIC_NAV are visible to a signed-out visitor
  // How:   renders <Nav caps={null} />; checks a link for each section label is present
  // Chain: the top bar now reads its sections from the nav model rather than a hand-maintained
  //        array, so a signed-out visitor sees exactly the model's six sections
  it('shows all six public sections to a signed-out visitor', () => {
    render(<Nav caps={null} />)
    for (const label of ['Guides', 'Toy Library', 'Learn', 'Get Involved', 'Impact', 'About']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  // Tests: the tutorial catalogue is labelled Guides (not the old Library) and still links to
  //        /library
  // How:   renders <Nav caps={null} />; checks the Guides link's href, and that no link named
  //        "Library" remains
  // Chain: the nav-model rename (Library -> Guides) must reach the top bar; the old label
  //        should not linger anywhere a screen reader or test would find it
  it('labels the tutorial catalogue Guides, not Library', () => {
    render(<Nav caps={null} />)
    expect(screen.getByRole('link', { name: 'Guides' })).toHaveAttribute('href', '/library')
    expect(screen.queryByRole('link', { name: 'Library' })).toBeNull()
  })

  // Tests: the public organisations directory is still reachable for any signed-in account,
  //        but no longer as its own top-bar link — /organizations is now an Impact child in
  //        PUBLIC_NAV, reachable via the Impact subnav and the footer
  // How:   renders <Nav caps={signedIn} />; checks the Impact link is present and that no
  //        top-bar link named "Organisations" exists
  // Chain: every signed-in account can still reach the org directory in one extra click via
  //        Impact → the behaviour survives, only its top-bar location moved
  it('keeps the organisations directory reachable via Impact, not as its own top-bar link', () => {
    render(<Nav caps={signedIn} />)
    expect(screen.getByRole('link', { name: 'Impact' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Organisations' })).toBeNull()
  })

  // Tests: the active section is detected from a nested path via sectionFor, not a hand-rolled
  //        prefix test
  // How:   sets pathname to /learn/switch-types; renders <Nav caps={null} />; checks the Learn
  //        link carries aria-current="page"
  // Chain: sub-sections must light up their parent section in the top bar so a visitor always
  //        knows where they are
  it('marks the section active from a nested path', () => {
    pathname.current = '/learn/switch-types'
    render(<Nav caps={null} />)
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute('aria-current', 'page')
  })

  // Tests: /organizations activates Impact even though it shares no prefix with /impact —
  //        plain prefix matching would miss this, which is exactly why Nav delegates to
  //        sectionFor instead of writing its own test
  // How:   sets pathname to /organizations; renders <Nav caps={null} />; checks the Impact
  //        link carries aria-current="page"
  // Chain: the organisations directory must read as "inside Impact" to stay legible even
  //        though its URL was never renamed to match
  it('marks Impact active on the organisations directory', () => {
    pathname.current = '/organizations'
    render(<Nav caps={null} />)
    expect(screen.getByRole('link', { name: 'Impact' })).toHaveAttribute('aria-current', 'page')
  })

  // Tests: the top bar never renders an expandable menu control — the whole point of the
  //        redesign is a flat, dropdown-free nav
  // How:   renders <Nav caps={null} />; checks no element in the document carries
  //        aria-expanded
  // Chain: hover/disclosure widgets are the accessibility failure mode this design exists to
  //        avoid on a platform serving people with disabilities
  it('never renders an expandable menu control', () => {
    render(<Nav caps={null} />)
    expect(document.querySelector('[aria-expanded]')).toBeNull()
  })

  // Tests: unauthenticated users see a Sign in link (to /login) and no Sign out button
  // How:   renders <Nav caps={null} />; checks the Sign in link exists and points at /login,
  //        and that Sign out is absent
  // Chain: one account type now serves parents and contributors alike, so the entry point
  //        can no longer name a single audience ("Contribute") or send a returning user to
  //        signup — it offers Sign in and lands on /login
  it('shows a Sign in link (to /login) and no Sign out for unauthenticated users', () => {
    render(<Nav caps={null} />)
    const link = screen.getByRole('link', { name: /sign in/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
  })

  // Tests: authenticated users see a Sign out button and no Sign in link
  // How:   renders <Nav caps={signedIn} />; checks Sign out button exists and Sign in link is absent
  // Chain: the nav hides the entry-point link once signed in → the UI reflects the user's
  //        current authentication state without redundant calls-to-action
  it('shows Sign out button and no Sign in link for authenticated users', () => {
    render(<Nav caps={signedIn} />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull()
  })

  // Tests: clicking Sign out calls Supabase signOut and redirects to / via window.location.href
  // How:   fireEvent.click on the Sign out button; waitFor checks mockSignOut was called and
  //        window.location.href === '/'
  // Chain: the user's Supabase session is ended → they are redirected to the public home page
  //        and the nav re-renders in the unauthenticated state on next load
  it('calls signOut and sets window.location.href to / on sign out click', async () => {
    render(<Nav caps={signedIn} />)
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(window.location.href).toBe('/')
    })
  })

  // Tests: a signed-in visitor still sees all seven public sections
  // How:   renders with caps and checks every section label is a link
  // Chain: this is the regression the whole change exists to prevent — the
  //        sections must not depend on auth state in any way
  it('shows every public section to a signed-in visitor', () => {
    render(<Nav caps={signedIn} />)
    for (const label of ['Guides', 'Toy Library', '3D Printing', 'Learn', 'Get Involved', 'Impact', 'About']) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  // Tests: the account area has exactly one door, labelled My SPLAT
  // How:   renders signed in and checks the link and its href
  // Chain: replaces the old Admin and Dashboard role links; the rail behind it
  //        carries admin, so a second top-level admin link would be redundant
  it('offers one account entry point', () => {
    render(<Nav caps={signedIn} />)
    const account = screen.getByRole('link', { name: /My SPLAT/ })
    expect(account).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
  })

  // Tests: the unread badge carries the count the rail used to surface
  // How:   renders with unreadNotifications: 3 and reads the accessible name
  // Chain: the rail is absent on public routes now, so if the badge did not move
  //        to the header an unread notification would be invisible site-wide
  it('badges the account pill with unread notifications', () => {
    render(<Nav caps={signedIn} />)
    expect(screen.getByRole('link', { name: /My SPLAT/ })).toHaveAccessibleName(/3 unread/)
  })

  // Tests: a zero count renders no badge
  // How:   renders with unreadNotifications: 0
  // Chain: a badge showing 0 is noise, and trains people to ignore the badge
  it('shows no badge at zero unread', () => {
    render(<Nav caps={{ ...signedIn, unreadNotifications: 0 }} />)
    expect(screen.getByRole('link', { name: /My SPLAT/ })).not.toHaveAccessibleName(/unread/)
  })

  // Tests: signed-out still gets a sign-in call to action and no account pill
  // How:   renders with caps={null}
  // Chain: the header is one component across both states, so the signed-out
  //        path has to be asserted from the same component
  it('offers sign in and no account pill when signed out', () => {
    render(<Nav caps={null} />)
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /My SPLAT/ })).not.toBeInTheDocument()
  })

  // Tests: the quiet variant keeps every section label readable
  // How:   renders with quiet and asserts all seven links are still present
  // Chain: the spec rejects icon-only and hover-revealed nav; "quieter" must
  //        never become "fewer" or "unlabelled"
  it('keeps every label in the quiet variant', () => {
    render(<Nav caps={signedIn} quiet />)
    for (const label of ['Guides', 'Toy Library', '3D Printing', 'Learn', 'Get Involved', 'Impact', 'About']) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  // Tests: quiet is a presentation change the bar carries, not a per-link one
  // How:   asserts the banner element takes the nav-quiet class
  // Chain: keeping it on one container is what stops the two variants drifting
  //        into two different sets of markup
  it('marks the bar quiet rather than restyling each link', () => {
    const { container } = render(<Nav caps={signedIn} quiet />)
    expect(container.querySelector('header')).toHaveClass('nav-quiet')
  })

  // Tests: public routes keep the loud bar
  // How:   renders without quiet
  // Chain: the treatment is scoped to the account section; applying it site-wide
  //        would flatten the tone system the public site is built on
  it('leaves the public bar at full weight', () => {
    const { container } = render(<Nav caps={signedIn} />)
    expect(container.querySelector('header')).not.toHaveClass('nav-quiet')
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

  // Tests: the My SPLAT pill also forces a full page load from a rail-only
  //        account page, not just from a public one — nestsRail makes this a
  //        crossing too, since /dashboard (unlike a rail page) has no shell.
  //        The old hand-rolled check (activeSection !== ACCOUNT_NAV) missed
  //        this: from a rail page the section is already ACCOUNT_NAV, so it
  //        never flagged the crossing, and a soft transition left the rail on
  //        screen with no header on /dashboard.
  // How:   pathname is a rail-only account page; the My SPLAT pill still
  //        resolves to /dashboard but must not have gone through next/link
  // Chain: same nestsRail split lib/public-nav.ts's crossesAccountBoundary
  //        already covers for BoundaryLink; Nav's own pill must agree with it
  it('renders My SPLAT as a plain anchor from a rail-only account page', () => {
    pathname.current = '/dashboard/toys'
    render(<Nav caps={signedIn} />)
    const account = screen.getByRole('link', { name: /My SPLAT/ })
    expect(account).toHaveAttribute('href', '/dashboard')
    expect(mockLink.mock.calls.some((call) => call[0].href === '/dashboard')).toBe(false)
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

  // Tests: the menu button is a real button, operated by click
  // How:   renders inside a provider, clicks, and asserts the drawer opened
  // Chain: hover-revealed navigation does not exist on touch and fails WCAG
  //        1.4.13; the control has to be pressable
  it('opens the section menu on click', () => {
    function Probe() {
      const { isOpen } = useDrawer()
      return <span data-testid="drawer">{isOpen ? 'open' : 'closed'}</span>
    }
    render(
      <DrawerProvider>
        <Nav caps={signedIn} showMenu />
        <Probe />
      </DrawerProvider>
    )
    expect(screen.getByTestId('drawer')).toHaveTextContent('closed')
    fireEvent.click(screen.getByRole('button', { name: /open navigation/i }))
    expect(screen.getByTestId('drawer')).toHaveTextContent('open')
  })

  // Tests: collapsing is a viewport decision, not an auth decision
  // How:   asserts the seven sections render with and without a session, and
  //        that the menu button's visibility is governed by a width class
  // Chain: a header that collapses when you sign in is the original defect in
  //        miniature — nav must not change by page type or by auth state
  it('collapses by viewport, identically signed in and out', () => {
    const out = render(<DrawerProvider><Nav caps={null} showMenu /></DrawerProvider>)
    expect(out.getByRole('button', { name: /open navigation/i })).toHaveClass('lg:hidden')
    out.unmount()
    render(<DrawerProvider><Nav caps={signedIn} showMenu /></DrawerProvider>)
    expect(screen.getByRole('button', { name: /open navigation/i })).toHaveClass('lg:hidden')
  })

  // Tests: public routes get no menu button, because there is no drawer there
  // How:   renders without showMenu
  // Chain: a trigger that opens nothing is worse than no trigger; the rail exists
  //        only inside the account section
  it('shows no menu button outside the account section', () => {
    render(<DrawerProvider><Nav caps={signedIn} /></DrawerProvider>)
    expect(screen.queryByRole('button', { name: /open navigation/i })).not.toBeInTheDocument()
  })
})
