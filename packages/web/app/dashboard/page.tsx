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
    '/dashboard/organisation': 'Projects waiting for your organisation to review.',
    '/dashboard/organisation/toys': 'What your organisation has on its shelves.',
    '/dashboard/organisation/orders': 'Print jobs your organisation has taken on.',
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
    }))

  return (
    <div>
      <h1 className="title-hub">{ACCOUNT_NAV.label}</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        Everything that belongs to you — what you have written, what you have lent, and what
        you have asked for.
      </p>
      <div className="mt-10">
        <HubGrid items={items} tone={ACCOUNT_NAV.tone} columns={4} />
      </div>
    </div>
  )
}
