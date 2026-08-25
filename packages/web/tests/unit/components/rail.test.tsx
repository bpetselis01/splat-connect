import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Rail } from '@/components/rail'
import type { NavGroup } from '@/lib/nav-model'

// Rows now render through BoundaryLink, which reads usePathname() itself (separate
// from the `pathname` prop Rail takes for marking the active row) to decide whether
// a row crosses the account boundary. next/link is mocked as a plain <a>, tracked
// via mockLink, so a crossing test can assert a row bypassed it entirely — the same
// strategy tests/unit/components/nav.test.tsx already uses for its own boundary tests.
const pathname = vi.hoisted(() => ({ current: '/dashboard' }))
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
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}))

const GROUPS: NavGroup[] = [
  {
    heading: 'Browse',
    rows: [
      { href: '/library', label: 'Guides', icon: 'book' },
      { href: '/toy-library', label: 'Toy library', icon: 'toy', soon: true },
    ],
  },
  {
    heading: 'Yours',
    rows: [
      { href: '/dashboard', label: 'My tutorials', icon: 'file' },
      { href: '/dashboard/toys', label: 'My toys', icon: 'box' },
    ],
  },
]

describe('Rail', () => {
  it('renders every group heading and row', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard" />)
    expect(screen.getByText('Browse')).toBeInTheDocument()
    expect(screen.getByText('Yours')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Guides' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My toys' })).toBeInTheDocument()
  })

  it('marks the current row', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard/toys" />)
    expect(screen.getByRole('link', { name: 'My toys' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  // Chain: /dashboard prefixes every other dashboard route, so a startsWith
  //        match would light My tutorials on every page in the group.
  it('does not mark My tutorials current on a sibling route', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard/toys" />)
    expect(screen.getByRole('link', { name: 'My tutorials' })).not.toHaveAttribute('aria-current')
  })

  it('marks unbuilt rows so they are not mistaken for working ones', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard" />)
    const soon = screen.getByRole('link', { name: /Toy library/ })
    expect(soon).toHaveTextContent('Soon')
  })

  it('offers a sign out control', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard" />)
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('renders a badge when a row carries a count', () => {
    const groups = [
      {
        heading: 'Account',
        rows: [{ href: '/notifications', label: 'Notifications', icon: 'bell' as const, count: 5 }],
      },
    ]
    render(<Rail groups={groups} pathname="/dashboard" />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders no badge when count is absent', () => {
    const groups = [
      {
        heading: 'Account',
        rows: [{ href: '/notifications', label: 'Notifications', icon: 'bell' as const }],
      },
    ]
    render(<Rail groups={groups} pathname="/dashboard" />)
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument()
  })

  // Tests: the rail has its own way back to My SPLAT
  // How:   renders the rail and checks a link named "Back to My SPLAT" points
  //        at /dashboard
  // Chain: the rail renders on every account page except /dashboard, which
  //        keeps the header instead — a page with no header needs its own
  //        way home rather than relying on one that isn't there
  it('offers a Back to My SPLAT link at the top, pointing at /dashboard', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard/toys" />)
    expect(screen.getByRole('link', { name: /Back to My SPLAT/ })).toHaveAttribute(
      'href',
      '/dashboard'
    )
  })

  // Tests: a row pointing outside the account section (e.g. Submit an idea)
  //        gets a full navigation, not a soft next/link transition
  // How:   renders from an account pathname with a row href that resolves to a
  //        public section, and asserts next/link was never asked to render it
  // Chain: the root layout doesn't re-run its rail/header decision on a client
  //        transition, so a soft <Link> here would leave stale chrome on screen
  //        — see components/boundary-link.tsx.
  it('crosses to a full page load for a row outside the account section', () => {
    pathname.current = '/dashboard/toys'
    const groups: NavGroup[] = [
      {
        heading: 'Give us a challenge',
        rows: [{ href: '/get-involved/submit-an-idea', label: 'Submit an idea', icon: 'clipboard' }],
      },
    ]
    render(<Rail groups={groups} pathname="/dashboard/toys" />)
    const link = screen.getByRole('link', { name: 'Submit an idea' })
    expect(link).toHaveAttribute('href', '/get-involved/submit-an-idea')
    expect(mockLink).not.toHaveBeenCalledWith(
      expect.objectContaining({ href: '/get-involved/submit-an-idea' })
    )
  })
})
