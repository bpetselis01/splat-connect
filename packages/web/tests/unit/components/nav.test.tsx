import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Nav } from '@/components/nav'

const mockSignOut = vi.fn()
const pathname = vi.hoisted(() => ({ current: '/' }))

// --- Mock strategy ---
// Four things are mocked: next/link is replaced with a plain <a> tag so links render in
// jsdom without Next.js routing infrastructure; usePathname is stubbed via a hoisted ref (so
// individual tests can vary the current path) because Nav reads it to mark the active section
// and there is no router mounted here; the Supabase client is replaced so mockSignOut can be
// inspected; and window.location is stubbed with a writable href so the post-sign-out redirect
// can be asserted without triggering real navigation.
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: mockSignOut } }),
}))

describe('Nav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue({})
    vi.stubGlobal('location', { href: '' })
    pathname.current = '/'
  })

  // Tests: all six public sections from PUBLIC_NAV are visible to a signed-out visitor
  // How:   renders <Nav role={null} />; checks a link for each section label is present
  // Chain: the top bar now reads its sections from the nav model rather than a hand-maintained
  //        array, so a signed-out visitor sees exactly the model's six sections
  it('shows all six public sections to a signed-out visitor', () => {
    render(<Nav role={null} />)
    for (const label of ['Guides', 'Toy Library', 'Learn', 'Get Involved', 'Impact', 'About']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  // Tests: the tutorial catalogue is labelled Guides (not the old Library) and still links to
  //        /library
  // How:   renders <Nav role={null} />; checks the Guides link's href, and that no link named
  //        "Library" remains
  // Chain: the nav-model rename (Library -> Guides) must reach the top bar; the old label
  //        should not linger anywhere a screen reader or test would find it
  it('labels the tutorial catalogue Guides, not Library', () => {
    render(<Nav role={null} />)
    expect(screen.getByRole('link', { name: 'Guides' })).toHaveAttribute('href', '/library')
    expect(screen.queryByRole('link', { name: 'Library' })).toBeNull()
  })

  // Tests: the Dashboard link is visible to contributors
  // How:   renders <Nav role="contributor" />; checks a link with text "dashboard"
  // Chain: contributors reach their submissions and the upload wizard via the dashboard's
  //        own tabs, not separate nav links
  it('renders dashboard link for contributors', () => {
    render(<Nav role="contributor" />)
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
  })

  // Tests: the Admin link is visible to admin users
  // How:   renders <Nav role="admin" />; checks a link with text "admin"
  // Chain: admins can navigate to the admin panel → they can review pending tutorials and
  //        manage contributors from a dedicated admin interface
  it('renders admin link for admin users', () => {
    render(<Nav role="admin" />)
    expect(screen.getByRole('link', { name: /admin/i })).toBeInTheDocument()
  })

  // Tests: admins, being signed in, also see the Dashboard link alongside Admin
  // How:   renders <Nav role="admin" />; checks a link with text "dashboard" is present
  // Chain: the Dashboard gating is on "signed in", not on a specific role, so it does not
  //        exclude admins
  it('renders dashboard link for admin users too', () => {
    render(<Nav role="admin" />)
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
  })

  // Tests: the dashboard's own Tutorials tab covers upload and my-tutorials now, so the
  //        nav no longer duplicates those destinations as separate links
  // How:   renders <Nav role="contributor" />; checks Dashboard is present and Upload /
  //        My Tutorials are absent
  // Chain: sub-project 3 moved authoring links into dashboard tabs → this supersedes the
  //        interim widening that added Upload/My Tutorials for every signed-in account
  it('does not duplicate the dashboard tabs in the nav', () => {
    render(<Nav role="contributor" />)
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Upload' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'My Tutorials' })).not.toBeInTheDocument()
  })

  // Tests: the public organisations directory is still reachable for any signed-in account,
  //        but no longer as its own top-bar link — /organizations is now an Impact child in
  //        PUBLIC_NAV, reachable via the Impact subnav and the footer
  // How:   renders <Nav role="contributor" />; checks the Impact link is present and that no
  //        top-bar link named "Organisations" exists
  // Chain: every signed-in account can still reach the org directory in one extra click via
  //        Impact → the behaviour survives, only its top-bar location moved
  it('keeps the organisations directory reachable via Impact, not as its own top-bar link', () => {
    render(<Nav role="contributor" />)
    expect(screen.getByRole('link', { name: 'Impact' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Organisations' })).toBeNull()
  })

  // Tests: the active section is detected from a nested path via sectionFor, not a hand-rolled
  //        prefix test
  // How:   sets pathname to /learn/switch-types; renders <Nav role={null} />; checks the Learn
  //        link carries aria-current="page"
  // Chain: sub-sections must light up their parent section in the top bar so a visitor always
  //        knows where they are
  it('marks the section active from a nested path', () => {
    pathname.current = '/learn/switch-types'
    render(<Nav role={null} />)
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute('aria-current', 'page')
  })

  // Tests: /organizations activates Impact even though it shares no prefix with /impact —
  //        plain prefix matching would miss this, which is exactly why Nav delegates to
  //        sectionFor instead of writing its own test
  // How:   sets pathname to /organizations; renders <Nav role={null} />; checks the Impact
  //        link carries aria-current="page"
  // Chain: the organisations directory must read as "inside Impact" to stay legible even
  //        though its URL was never renamed to match
  it('marks Impact active on the organisations directory', () => {
    pathname.current = '/organizations'
    render(<Nav role={null} />)
    expect(screen.getByRole('link', { name: 'Impact' })).toHaveAttribute('aria-current', 'page')
  })

  // Tests: the top bar never renders an expandable menu control — the whole point of the
  //        redesign is a flat, dropdown-free nav
  // How:   renders <Nav role={null} />; checks no element in the document carries
  //        aria-expanded
  // Chain: hover/disclosure widgets are the accessibility failure mode this design exists to
  //        avoid on a platform serving people with disabilities
  it('never renders an expandable menu control', () => {
    render(<Nav role={null} />)
    expect(document.querySelector('[aria-expanded]')).toBeNull()
  })

  // Tests: contributors do not see the Admin link
  // How:   renders <Nav role="contributor" />; checks no link with text "admin" is present
  // Chain: the admin panel is hidden from contributors at the UI level → combined with the
  //        server-side role guard, contributors cannot access admin pages at all
  it('does not render admin link for contributors', () => {
    render(<Nav role="contributor" />)
    expect(screen.queryByRole('link', { name: /admin/i })).toBeNull()
  })

  // Tests: unauthenticated users see a Sign in link (to /login) and no Sign out button
  // How:   renders <Nav role={null} />; checks the Sign in link exists and points at /login,
  //        and that Sign out is absent
  // Chain: one account type now serves parents and contributors alike, so the entry point
  //        can no longer name a single audience ("Contribute") or send a returning user to
  //        signup — it offers Sign in and lands on /login
  it('shows a Sign in link (to /login) and no Sign out for unauthenticated users', () => {
    render(<Nav role={null} />)
    const link = screen.getByRole('link', { name: /sign in/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
  })

  // Tests: authenticated users (any role) see a Sign out button and no Sign in link
  // How:   renders <Nav role="contributor" />; checks Sign out button exists and Sign in link is absent
  // Chain: the nav hides the entry-point link once signed in → the UI reflects the user's
  //        current authentication state without redundant calls-to-action
  it('shows Sign out button and no Sign in link for authenticated users', () => {
    render(<Nav role="contributor" />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull()
  })

  // Tests: clicking Sign out calls Supabase signOut and redirects to / via window.location.href
  // How:   fireEvent.click on the Sign out button; waitFor checks mockSignOut was called and
  //        window.location.href === '/'
  // Chain: the user's Supabase session is ended → they are redirected to the public home page
  //        and the nav re-renders in the unauthenticated state on next load
  it('calls signOut and sets window.location.href to / on sign out click', async () => {
    render(<Nav role="contributor" />)
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(window.location.href).toBe('/')
    })
  })

  // Tests: admin users also see a Sign out button
  // How:   renders <Nav role="admin" />; checks Sign out button is in the document
  // Chain: admins can sign out using the same button as contributors → the sign-out flow
  //        works identically regardless of role
  it('shows Sign out button for admin users', () => {
    render(<Nav role="admin" />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })
})
