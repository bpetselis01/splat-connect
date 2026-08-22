/**
 * The account section's hub — the same shape as app/get-involved/page.tsx and
 * app/learn/page.tsx, for the same reason: a section's landing page lists what
 * is inside it, with a sentence per destination that a menu never had room for.
 *
 * It is not a duplicate of the rail. The rail says where you can go; this says
 * what is waiting for you there, which is why every blurb is computed rather
 * than written.
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

  const counts: Record<string, string> = {
    '/dashboard/exchanges': caps.exchangeActions
      ? `${caps.exchangeActions} waiting on you`
      : 'Toys you have lent, borrowed and handed over.',
    '/notifications': caps.unreadNotifications
      ? `${caps.unreadNotifications} unread`
      : 'Everything SPLAT has told you.',
  }

  const blurbs: Record<string, string> = {
    '/dashboard/tutorials': 'Your adaptation guides, and where each one is in review.',
    '/dashboard/toys': 'Toys you have listed for other families.',
    '/dashboard/challenges': 'Ideas you have submitted, and challenges you have joined.',
    '/dashboard/child': 'What each child can reach, hold and hear.',
    '/dashboard/print-requests': 'Parts you have asked someone to print.',
    '/dashboard/organisation': 'Projects waiting for your organisation to review.',
    '/dashboard/organisation/toys': 'What your organisation has on its shelves.',
    '/dashboard/organisation/orders': 'Print jobs your organisation has taken on.',
    '/dashboard/profile': 'Your name, email and the terms you have accepted.',
    '/admin': 'The review queues and the report inbox.',
  }

  // Built from the same model the rail reads, so a destination cannot exist in
  // one and not the other.
  const items: NavItem[] = buildNav(caps, caps.unreadNotifications)
    .flatMap((g) => g.rows)
    .map((row) => ({
      href: row.href,
      label: row.label,
      state: row.soon ? 'soon' : 'live',
      blurb: counts[row.href] ?? blurbs[row.href] ?? '',
    }))

  // Appended rather than modelled: submitting an idea is a public page, so it is
  // not a rail row, but it is the action a signed-in author most often arrives
  // here to take.
  items.push({
    href: '/get-involved/submit-an-idea',
    label: 'Submit an idea',
    state: 'live',
    blurb: 'Suggest a toy worth adapting, even if you cannot build it yourself.',
  })

  return (
    <div>
      <h1 className="title-hub">{ACCOUNT_NAV.label}</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        Everything that belongs to you — what you have written, what you have lent, and what
        you have asked for.
      </p>
      <div className="mt-10">
        <HubGrid items={items} tone={ACCOUNT_NAV.tone} leadFirst={false} />
      </div>
    </div>
  )
}
