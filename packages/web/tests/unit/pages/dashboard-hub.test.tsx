import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardHub from '@/app/dashboard/page'
import type { Capabilities } from '@/lib/capabilities'

const baseCaps: Capabilities = {
  profile: {
    id: 'author-1',
    name: 'Sam',
    email: 'sam@example.com',
    role: 'contributor',
    public_showcase: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  isAdmin: false,
  ledOrgs: [],
  canAuthor: true,
  unreadNotifications: 0,
  exchangeActions: 0,
}

// A mutable ref rather than a fixed literal: individual tests reassign
// caps.current to exercise the count-driven blurbs and the signed-out
// redirect, which a single fixed mock object cannot do.
const caps: { current: Capabilities | null } = { current: baseCaps }

// The hub is always an account page, so pathname defaults to /dashboard —
// the boundary-crossing test below relies on that default to exercise
// components/boundary-link.tsx (rendered by HubGrid) the way it actually
// renders in the app.
const pathname = vi.hoisted(() => ({ current: '/dashboard' }))

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => caps.current,
}))
// Real redirect() throws a special digest error rather than returning; the
// hub's own redirect branch relies on that to stop rendering, so the mock
// must throw too, not just record the call.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
  usePathname: () => pathname.current,
}))
// Wrapped in a vi.fn, same as tests/unit/components/nav.test.tsx, so the
// boundary-crossing test can assert whether the idea-form tile went through
// next/link at all, not just what its resulting href is.
const mockLink = vi.fn(
  ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
)
vi.mock('next/link', () => ({
  default: (props: { href: string; children: React.ReactNode; className?: string }) => mockLink(props),
}))

describe('DashboardHub', () => {
  beforeEach(() => {
    caps.current = baseCaps
    pathname.current = '/dashboard'
    vi.clearAllMocks()
  })

  // Tests: the hub offers a tile for every rail destination
  // How:   renders the page with a plain account and checks each label appears
  // Chain: the hub is the account section's landing page the way /get-involved is
  //        its section's; a destination missing here is reachable only from the
  //        rail, which is absent on public routes
  it('renders a tile per account destination', async () => {
    const ui = await DashboardHub()
    render(ui)
    for (const label of ['My tutorials', 'My toys', 'Exchanges', 'Design challenges', 'Notifications', 'Account']) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  // Tests: submitting an idea is reachable from inside the account area
  // How:   asserts a link to the public form is on the hub
  // Chain: this is the reported defect in its narrowest form — the idea form was
  //        unreachable without signing out, and the hub is where a signed-in
  //        author looks first
  it('links to the idea form', async () => {
    const ui = await DashboardHub()
    render(ui)
    expect(screen.getByRole('link', { name: /Submit an idea/ })).toHaveAttribute(
      'href',
      '/get-involved/submit-an-idea'
    )
  })

  // Tests: the idea-form tile crosses from the account section to a public
  //        destination, so it needs a full page load, not a soft <Link>
  //        transition — this is the branch's headline feature (the original
  //        bug report was "can't reach the idea form without signing out")
  //        and it was still soft-navigating into stale chrome until this fix
  // How:   pathname is /dashboard (the default); the tile still resolves to
  //        /get-involved/submit-an-idea but must not have gone through
  //        next/link
  // Chain: same staleness class components/nav.tsx's NavLink already guards
  //        against for the header — components/boundary-link.tsx (used by
  //        components/hub-grid.tsx, which renders every hub tile) closes it
  //        here too
  it('renders the idea-form tile as a plain anchor from the account section', async () => {
    const ui = await DashboardHub()
    render(ui)
    const idea = screen.getByRole('link', { name: /Submit an idea/ })
    expect(idea).toHaveAttribute('href', '/get-involved/submit-an-idea')
    expect(
      mockLink.mock.calls.some((call) => call[0].href === '/get-involved/submit-an-idea')
    ).toBe(false)
  })

  // Tests: a tile from /dashboard to another rail-only account page also
  //        crosses, since /dashboard itself no longer nests the rail —
  //        nestsRail (lib/public-nav.ts) makes every one of the hub's own
  //        tiles a boundary crossing, not just the idea-form tile
  // How:   pathname is /dashboard (the default); the "My tutorials" tile's
  //        href is checked against next/link's mock calls
  // Chain: crossesAccountBoundary('/dashboard', '/dashboard/tutorials') is
  //        now true (tests/unit/lib/public-nav.test.ts), so hub-grid.tsx
  //        must route this tile through BoundaryLink, not next/link
  it('renders an account-internal tile as a plain anchor, since /dashboard does not nest the rail', async () => {
    const ui = await DashboardHub()
    render(ui)
    const tutorials = screen.getByRole('link', { name: /My tutorials/ })
    expect(tutorials).toHaveAttribute('href', '/dashboard/tutorials')
    expect(mockLink.mock.calls.some((call) => call[0].href === '/dashboard/tutorials')).toBe(false)
  })

  // Tests: tiles carry live counts, not static prose
  // How:   stubs capabilities with two exchange actions and reads the blurb
  // Chain: a hub of seven identical "go here" cards is a worse table of contents
  //        than the rail it duplicates; the counts are what make it worth a page
  it('summarises what is waiting on you', async () => {
    caps.current = { ...baseCaps, exchangeActions: 2 }
    const ui = await DashboardHub()
    render(ui)
    expect(screen.getByText(/2 waiting on you/)).toBeInTheDocument()
  })

  // Tests: a signed-out visitor is sent to login rather than shown an empty hub
  // How:   stubs getCapabilities to null and asserts redirect was called
  // Chain: every page re-checks its own access; the nav is an affordance, not a
  //        control
  it('redirects a signed-out visitor', async () => {
    caps.current = null
    await expect(DashboardHub()).rejects.toThrow('NEXT_REDIRECT')
  })
})
