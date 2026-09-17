/**
 * The account section's hub — the same shape as app/get-involved/page.tsx and
 * app/learn/page.tsx, for the same reason: a section's landing page lists what
 * is inside it, with a sentence per destination that a menu never had room for.
 *
 * It is not a duplicate of the rail. The rail says where you can go; this says
 * what you can do when you get there, which is why the busiest blurbs are a
 * comma list rather than a description. They are prose: the card is a single
 * link, and anything inside it that looked like a control would navigate
 * somewhere other than what it names.
 *
 * Related files:
 * - lib/nav-model.ts: the destination list, shared with the rail
 * - components/hub-grid.tsx: the grid, shared with every public hub
 */
import { requireCapabilities } from '@/lib/require-capabilities'
import { buildNav } from '@/lib/nav-model'
import { HubGrid } from '@/components/hub-grid'
import { ACCOUNT_NAV } from '@/lib/public-nav'
import type { NavItem } from '@/lib/public-nav'
import { apiClient } from '@/lib/api-client'
import { MoneyPanel, type OutstandingLine } from '@/components/money-panel'

export const metadata = {
  title: 'My SPLAT — SPLAT Connect',
}

export default async function DashboardHub() {
  const caps = await requireCapabilities()

  /*
   * What is behind each card, rather than a sentence about the card.
   *
   * The four busy cards name their destinations as a comma list; the rest
   * describe themselves, because a one-item list is a sentence wearing a
   * costume. Both are one paragraph — see the spec's decision 2.
   */
  const blurbs: Record<string, string> = {
    '/dashboard/tutorials': 'Add a tutorial, saved tutorials, browse library.',
    '/dashboard/toys': 'Add a toy to donate, saved toys, browse toy library.',
    '/dashboard/exchanges': 'Active exchanges, exchange history.',
    '/dashboard/challenges': 'Submit an idea, saved challenges.',
    '/dashboard/print-requests': 'Parts you have asked someone to print.',
    '/dashboard/printers': 'Your printers, requests waiting on you, what is on the bed.',
    '/dashboard/events': 'Build days you are going to, and whether the host is printing your parts.',
    '/get-involved/recycling':
      'Drop clean waste plastic at an organisation that can extrude it, and earn print credit.',
    '/dashboard/organisation': 'Projects waiting for your organisation to review.',
    '/dashboard/organisation/toys': 'What your organisation has on its shelves.',
    '/dashboard/organisation/orders': 'Print jobs your organisation has taken on.',
    '/dashboard/organisation/publish': 'Events and stories on your public page.',
    '/dashboard/organisation/recycling': 'What you take, and the drop-offs booked in.',
    '/dashboard/organisation/profile': 'Everything a family reads about you.',
    '/dashboard/profile': 'Your name, email, children and terms.',
    '/dashboard/saved': 'Tutorials, toys and challenges you have kept.',
    '/notifications': 'Everything SPLAT has told you.',
    '/admin': 'The review queues and the report inbox.',
  }

  /*
   * Unread, per card. Deliberately NOT caps.exchangeActions: that is a
   * needs-action count, it clears when you act rather than when you read, and
   * it already has a home in the rail. Two numbers meaning different things on
   * one card is worse than one.
   */
  const counts: Record<string, number> = {
    '/dashboard/tutorials': caps.unread.tutorials,
    '/dashboard/exchanges': caps.unread.exchanges,
    '/dashboard/challenges': caps.unread.challenges,
    '/notifications': caps.unread.total,
  }

  // Built from the same model the rail reads, so a destination cannot exist in
  // one and not the other — with one subtraction. "Submit an idea" is the only
  // row here that points at a public route, and Design challenges already leads
  // to the same section, so it is a line on that card instead of a card.
  const items: NavItem[] = buildNav(caps)
    .flatMap((g) => g.rows)
    .filter((row) => row.href !== '/get-involved/submit-an-idea')
    .map((row) => ({
      href: row.href,
      label: row.label,
      state: row.soon ? 'soon' : 'live',
      blurb: blurbs[row.href] ?? '',
      count: counts[row.href],
      // Carried through for the tile variant. The rail already draws these.
      icon: row.icon,
    }))

  /*
   * Three groups, decided here rather than in the shared nav model.
   *
   * buildNav's own groupings are the rail's — task-shaped, "Add a tutorial",
   * "Exchange a toy" — and they are right there. The hub wants a different cut,
   * and the last redesign already learned that adding a `groups` field to the
   * shared model is the wrong move: the hub pages do their own grouping, and a
   * model change would have forced the rail to carry a shape only this page
   * reads.
   */
  const ORG_PREFIX = '/dashboard/organisation'
  const ACCOUNT_HREFS = new Set(['/dashboard/saved', '/dashboard/profile', '/notifications', '/admin'])

  const yours = items.filter((i) => !i.href.startsWith(ORG_PREFIX) && !ACCOUNT_HREFS.has(i.href))
  const organisation = items.filter((i) => i.href.startsWith(ORG_PREFIX))
  const account = items.filter((i) => ACCOUNT_HREFS.has(i.href))

  /*
   * The money panel's data. Degrades to absent rather than taking the page down
   * with it: an outstanding-costs fetch failing should not stop somebody
   * reaching their guides, and the panel renders nothing when there is nothing
   * outstanding anyway.
   */
  let money: { lines: OutstandingLine[]; total_cents: number; exchange_count: number } | null = null
  try {
    money = await apiClient.get('/api/exchange-costs/outstanding')
  } catch {
    money = null
  }

  const firstName = caps.profile.name.trim().split(/\s+/)[0]

  return (
    <div>
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-e2 sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-widest text-muted">
          {ACCOUNT_NAV.label}
        </p>
        <h1 className="font-display text-4xl font-extrabold text-ink">Welcome back, {firstName}.</h1>
        <p className="mt-2 max-w-prose text-base leading-relaxed text-muted">
          Everything that belongs to you — what you have written, what you have lent, and what you
          have asked for.
        </p>
      </section>

      <div className="mt-10">
        <HubGrid items={yours} tone={ACCOUNT_NAV.tone} columns={4} variant="tile" />
      </div>

      {organisation.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold text-ink">Your organisation</h2>
          <div className="mt-4">
            <HubGrid items={organisation} tone={ACCOUNT_NAV.tone} columns={4} variant="tile" />
          </div>
        </section>
      )}

      {account.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold text-ink">Account</h2>
          <div className="mt-4">
            <HubGrid items={account} tone={ACCOUNT_NAV.tone} columns={4} variant="tile" />
          </div>
        </section>
      )}

      {money && (
        <MoneyPanel
          lines={money.lines}
          totalCents={money.total_cents}
          exchangeCount={money.exchange_count}
        />
      )}
    </div>
  )
}
