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
  unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 0 },
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
    for (const label of ['My tutorials', 'My toys', 'My exchanges', 'Design challenges', 'Notifications', 'Account']) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  // Tests: a tile from /dashboard to another rail-only account page also
  //        crosses, since /dashboard itself no longer nests the rail —
  //        nestsRail (lib/public-nav.ts) makes every one of the hub's own
  //        tiles a boundary crossing
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

  // Submit an idea was the one row here pointing at a public route, and
  // Design challenges already leads to the same section. Reachability moved
  // with it — see the persistent button on /dashboard/challenges.
  it('folds Submit an idea into Design challenges rather than giving it a card', async () => {
    render(await DashboardHub())
    expect(screen.queryByRole('link', { name: /^Submit an idea$/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Design challenges/ })).toHaveTextContent(
      'Submit an idea'
    )
  })

  it('lists what is behind My tutorials', async () => {
    render(await DashboardHub())
    const card = screen.getByRole('link', { name: /My tutorials/ })
    expect(card).toHaveTextContent('Add a tutorial, saved tutorials, browse library.')
  })

  it('lists what is behind My toys', async () => {
    render(await DashboardHub())
    const card = screen.getByRole('link', { name: /My toys/ })
    expect(card).toHaveTextContent('Add a toy to donate, saved toys, browse toy library.')
  })

  it('lists what is behind My exchanges', async () => {
    render(await DashboardHub())
    const card = screen.getByRole('link', { name: /My exchanges/ })
    expect(card).toHaveTextContent('Active exchanges, exchange history.')
  })

  /*
   * Replaces "summarises what is waiting on you". The bug that test encoded:
   * `counts` used to overwrite the blurb, so a card with pending actions read
   * only "3 waiting on you" and lost its description exactly when it mattered
   * most. The count moved to a badge so both survive.
   */
  it('badges the unread count without eating the description', async () => {
    caps.current = {
      ...baseCaps,
      unread: { tutorials: 2, exchanges: 3, challenges: 0, total: 5 },
    }
    render(await DashboardHub())
    const card = screen.getByRole('link', { name: /My exchanges/ })
    expect(card).toHaveTextContent('3')
    expect(card).toHaveTextContent('Active exchanges, exchange history.')
  })

  // exchangeActions is the rail's signal — a different number that clears on a
  // different event. Four actions must not surface here as a badge.
  it('badges unread, not the needs-action count', async () => {
    caps.current = { ...baseCaps, exchangeActions: 4 }
    render(await DashboardHub())
    expect(screen.getByRole('link', { name: /My exchanges/ })).not.toHaveTextContent('4')
  })

  // Every toy_* type is a transaction event, so My toys has no bucket at all.
  it('gives My toys no badge', async () => {
    caps.current = {
      ...baseCaps,
      unread: { tutorials: 2, exchanges: 3, challenges: 0, total: 5 },
    }
    render(await DashboardHub())
    expect(
      screen.getByRole('link', { name: /My toys/ }).querySelector('.badge')
    ).toBeNull()
  })

  // Eight before: Submit an idea folded into Design challenges.
  it('renders eight cards for a plain account', async () => {
    const { container } = render(await DashboardHub())
    // Eight, not seven: the Saved rail row produces a card here too, because
    // this hub is built from the same nav model. Deliberate — two complete rows
    // of four rather than a row of four and a stranded three.
    expect(container.querySelectorAll('a.card')).toHaveLength(8)
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
