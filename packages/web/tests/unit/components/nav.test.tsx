import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Nav } from '@/components/nav'

const mockSignOut = vi.fn()

// --- Mock strategy ---
// Three things are mocked: next/link is replaced with a plain <a> tag so links render in
// jsdom without Next.js routing infrastructure; the Supabase client is replaced so mockSignOut
// can be inspected; and window.location is stubbed with a writable href so the post-sign-out
// redirect can be asserted without triggering real navigation.
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
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
  // Chain: contributors can navigate to their "My Tutorials" dashboard → they can track their
  //        submissions and access the upload wizard from the nav bar
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

  // Tests: admin users do not see the Dashboard link (they have the Admin link instead)
  // How:   renders <Nav role="admin" />; checks no link with text "dashboard" is present
  // Chain: the nav is role-exclusive — admins only get admin navigation → keeps the UI
  //        uncluttered and prevents admins from accessing contributor-only pages
  it('does not render dashboard link for admin users', () => {
    render(<Nav role="admin" />)
    expect(screen.queryByRole('link', { name: /dashboard/i })).toBeNull()
  })

  // Tests: contributors do not see the Admin link
  // How:   renders <Nav role="contributor" />; checks no link with text "admin" is present
  // Chain: the admin panel is hidden from contributors at the UI level → combined with the
  //        server-side role guard, contributors cannot access admin pages at all
  it('does not render admin link for contributors', () => {
    render(<Nav role="contributor" />)
    expect(screen.queryByRole('link', { name: /admin/i })).toBeNull()
  })

  // Tests: unauthenticated users see a Contribute link and no Sign out button
  // How:   renders <Nav role={null} />; checks Contribute link exists and Sign out button is absent
  // Chain: visitors can navigate to the contributor sign-up/login flow → signed-in users
  //        see Sign out instead, keeping the nav contextually relevant
  it('shows Contribute link and no Sign out for unauthenticated users', () => {
    render(<Nav role={null} />)
    expect(screen.getByRole('link', { name: /contribute/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
  })

  // Tests: authenticated users (any role) see a Sign out button and no Contribute link
  // How:   renders <Nav role="contributor" />; checks Sign out button exists and Contribute link is absent
  // Chain: the nav hides the join-up link once signed in → the UI reflects the user's current
  //        authentication state without redundant calls-to-action
  it('shows Sign out button and no Contribute link for authenticated users', () => {
    render(<Nav role="contributor" />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /contribute/i })).toBeNull()
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
