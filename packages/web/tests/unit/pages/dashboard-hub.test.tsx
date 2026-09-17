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
// The hub now fetches its outstanding costs. api-client imports `server-only`,
// which throws on import under vitest, so the module has to be mocked rather
// than the call stubbed. Same category of test-environment plumbing as the
// next/navigation mock below — no change to the page itself.
//
// Defaults to nothing outstanding, which is both the common case and the one
// where MoneyPanel renders nothing at all; the money tests reassign it.
const money = vi.hoisted(() => ({
  current: { lines: [] as unknown[], total_cents: 0, exchange_count: 0 },
}))
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: async () => money.current },
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

  // Tests: a hub tile pointing into the account section is a soft transition
  // How:   pathname is /dashboard (the default); the "My tutorials" tile's
  //        href is checked against next/link's mock calls
  // Chain: crossesAccountBoundary('/dashboard', '/dashboard/tutorials') went
  //        false when the rail was retired, so BoundaryLink resolves these
  //        tiles to next/link again
  it('renders an account-internal tile as a soft link', async () => {
    const ui = await DashboardHub()
    render(ui)
    const tutorials = screen.getByRole('link', { name: /My tutorials/ })
    expect(tutorials).toHaveAttribute('href', '/dashboard/tutorials')
    expect(mockLink.mock.calls.some((call) => call[0].href === '/dashboard/tutorials')).toBe(true)
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
  it('renders eleven cards for a plain account', async () => {
    const { container } = render(await DashboardHub())
    // Saved produces a card here too, because this hub is built from the same
    // nav model. Nine since 058 added Print for others, eleven since 061 and
    // 063 added My events and Recycle plastic.
    expect(container.querySelectorAll('a.card')).toHaveLength(11)
  })

  // Tests: a signed-out visitor is sent to login rather than shown an empty hub
  // How:   stubs getCapabilities to null and asserts redirect was called
  // Chain: every page re-checks its own access; the nav is an affordance, not a
  //        control
  it('redirects a signed-out visitor', async () => {
    caps.current = null
    await expect(DashboardHub()).rejects.toThrow('NEXT_REDIRECT')
  })

  it('greets the person by their first name only', async () => {
    caps.current = { ...baseCaps, profile: { ...baseCaps.profile, name: 'Sam Okonkwo' } }
    render(await DashboardHub())
    expect(screen.getByRole('heading', { name: 'Welcome back, Sam.' })).toBeInTheDocument()
  })

  /*
   * Why: the three groups are cut here rather than in the shared nav model, so
   * nothing but this page enforces where a row lands. A new /dashboard/
   * organisation route silently joining "your content" is the failure.
   */
  it('files organisation rows under their own heading, not with your content', async () => {
    caps.current = {
      ...baseCaps,
      ledOrgs: [
        {
          id: 'org-1',
          name: 'Northside Therapy',
          description: null,
          status: 'active',
          created_by: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    } as Capabilities
    render(await DashboardHub())

    const orgHeading = screen.getByRole('heading', { name: 'Your organisation', level: 2 })
    const orgSection = orgHeading.closest('section')!
    expect(orgSection).toBeTruthy()
    // Every link under that heading is an organisation route.
    for (const a of orgSection.querySelectorAll('a')) {
      expect(a.getAttribute('href')).toMatch(/^\/dashboard\/organisation/)
    }
  })

  it('puts Saved, Notifications and Account under Account', async () => {
    caps.current = baseCaps
    render(await DashboardHub())
    // level 2 deliberately: the section is "Account" and so is one of the cards
    // inside it, which is how the artboard draws it too.
    const section = screen.getByRole('heading', { name: 'Account', level: 2 }).closest('section')!
    const hrefs = [...section.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(expect.arrayContaining(['/dashboard/saved', '/notifications', '/dashboard/profile']))
  })

  /*
   * Why: an empty money summary is a worry with no object. The common case is
   * owing nothing, and the panel must not appear to say so.
   */
  it('draws no money panel when nothing is outstanding', async () => {
    caps.current = baseCaps
    money.current = { lines: [], total_cents: 0, exchange_count: 0 }
    render(await DashboardHub())
    expect(screen.queryByText(/Money you have agreed to/i)).not.toBeInTheDocument()
  })

  it('totals what is outstanding and counts exchanges, not lines', async () => {
    caps.current = baseCaps
    money.current = {
      lines: [
        {
          id: 'c1',
          transaction_id: 'tx-1',
          description: 'Filament for your switch mount',
          amount_cents: 500,
          toy_transactions: { id: 'tx-1', type: 'donation', toys: { name: 'Bubble machine' } },
        },
        {
          id: 'c2',
          transaction_id: 'tx-1',
          description: 'Postage on the handover',
          amount_cents: 1060,
          toy_transactions: { id: 'tx-1', type: 'donation', toys: { name: 'Bubble machine' } },
        },
      ],
      total_cents: 1560,
      exchange_count: 1,
    }
    render(await DashboardHub())
    expect(screen.getByText('$15.60')).toBeInTheDocument()
    // Singular, because two lines on one exchange is one exchange.
    expect(screen.getByText(/across 1 exchange\./)).toBeInTheDocument()
    expect(screen.getByText('Filament for your switch mount')).toBeInTheDocument()
  })

  /*
   * Why: the panel is a summary, not a destination, and a dollar figure above
   * the guides says the wrong thing about what SPLAT is.
   */
  it('puts the money panel below the cards', async () => {
    caps.current = baseCaps
    money.current = {
      lines: [
        {
          id: 'c1',
          transaction_id: 'tx-1',
          description: 'Postage',
          amount_cents: 500,
          toy_transactions: null,
        },
      ],
      total_cents: 500,
      exchange_count: 1,
    }
    const { container } = render(await DashboardHub())
    const firstCard = container.querySelector('a.card')!
    const panel = screen.getByText(/Money you have agreed to/i)
    expect(firstCard.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  /*
   * Why: a failing costs fetch must not take the hub down with it — somebody
   * reaching their guides does not care that a summary is unavailable.
   */
  it('still renders the hub when the costs fetch fails', async () => {
    caps.current = baseCaps
    money.current = null as never
    render(await DashboardHub())
    expect(screen.getByRole('heading', { name: /Welcome back/ })).toBeInTheDocument()
  })
})
