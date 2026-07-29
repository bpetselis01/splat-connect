import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Nav } from '@/components/nav'

const mockSignOut = vi.fn()

// --- Mock strategy ---
// Four things are mocked: next/link is replaced with a plain <a> tag so links render in
// jsdom without Next.js routing infrastructure; usePathname is stubbed because Nav reads it
// to mark the current page and there is no router mounted here; the Supabase client is
// replaced so mockSignOut can be inspected; and window.location is stubbed with a writable
// href so the post-sign-out redirect can be asserted without triggering real navigation.
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: mockSignOut } }),
}))

describe('Nav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue({})
    vi.stubGlobal('location', { href: '' })
  })

  // Tests: the Library link is visible to users who are not signed in (role is null)
  // How:   renders <Nav role={null} />; checks a link with text "library" is in the document
  // Chain: unauthenticated visitors can browse the tutorial library → the landing experience
  //        works without requiring login for public content
  it('renders library link for unauthenticated users', () => {
    render(<Nav role={null} />)
    expect(screen.getByRole('link', { name: /library/i })).toBeInTheDocument()
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

  // Tests: the public organisations directory is still reachable for any signed-in
  //        account (parent or contributor), not gated on a specific role
  // How:   renders <Nav role="parent" />; checks the Organisations link is present
  // Chain: every signed-in account may browse the org directory → gating it further
  //        would need a per-request lookup in the nav for no benefit
  it('keeps the public organisations directory for any signed-in account', () => {
    render(<Nav role="parent" />)
    expect(screen.getByRole('link', { name: 'Organisations' })).toBeInTheDocument()
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
