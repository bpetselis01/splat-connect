/**
 * The account section's hub — the same shape as app/get-involved/page.tsx and
 * app/learn/page.tsx, for the same reason: a section's landing page lists what
 * is inside it, with a sentence per destination that a menu never had room for.
 *
 * It is not a duplicate of the rail. The rail says where you can go; this says
 * what you can do when you get there, which is why most blurbs are a list
 * rather than a sentence. The lists are text: the card is a single link, and a
 * line that behaved like a control would navigate somewhere other than what it
 * names.
 *
 * Related files:
 * - lib/nav-model.ts: the destination list, shared with the rail
 * - components/hub-grid.tsx: the grid, shared with every public hub
 */
import { redirect } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { buildNav } from '@/lib/nav-model'
import { HubGrid } from '@/components/hub-grid'
import { ACCOUNT_NAV } from '@/lib/public-nav'
import type { NavItem } from '@/lib/public-nav'

export const metadata = {
  title: 'My SPLAT — SPLAT Connect',
}

export default async function DashboardHub() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  /*
   * What is behind each card, rather than a sentence about the card.
   *
   * An array renders as tags (components/hub-grid.tsx); a string renders as
   * today's paragraph. The three cards with nothing to do keep prose, because a
   * one-item list is a sentence wearing a costume.
   *
   * These are text, not links. The card is one link — see the spec's decision 1.
   */
  const blurbs: Record<string, string | string[]> = {
    '/dashboard/tutorials': [
      'Add a tutorial to SPLAT Connect',
      'View saved tutorials',
      'Browse tutorial library',
    ],
    '/dashboard/toys': [
      'Add a toy you want to donate or exchange',
      'View saved toys',
      'Browse toy library',
    ],
    '/dashboard/exchanges': ['View active exchanges or donations', 'Exchange history'],
    '/dashboard/challenges': ['Submit an idea', 'View saved challenges'],
    '/dashboard/print-requests': 'Parts you have asked someone to print.',
    '/dashboard/organisation': 'Projects waiting for your organisation to review.',
    '/dashboard/organisation/toys': 'What your organisation has on its shelves.',
    '/dashboard/organisation/orders': 'Print jobs your organisation has taken on.',
    '/dashboard/profile': 'Your name, email, and the children and terms you have on file.',
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
  const items: NavItem[] = buildNav(caps, caps.unreadNotifications)
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
