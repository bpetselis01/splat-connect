/**
 * The saved hub — the same shape as /learn and My SPLAT itself: a landing page
 * that lists what is inside it, with a sentence per destination.
 *
 * Two labelled groups rather than one flat five. Five cards in one grid strands
 * a card at any width, and unlike My SPLAT's deliberately flat eight the split
 * here carries real information: it is the line between the three types that
 * work and the two that are drawn so the shape is visible.
 *
 * 3-up, not 4-up, which is HubGrid's default and what /learn uses. Ready now
 * holds exactly three, so at 4-up it left a dead column on every screen wide
 * enough to show one — caught on the built page, not in the spec.
 *
 * Related files:
 * - lib/nav-model.ts: the Saved row that reaches this page
 * - app/dashboard/saved/[type]/page.tsx: the lists these cards lead to
 * - packages/types/src/index.ts: SAVE_SLUGS, which decides what is live
 */
import { redirect } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { HubGrid } from '@/components/hub-grid'
import type { NavItem } from '@/lib/public-nav'

export const metadata = {
  title: 'Saved — SPLAT Connect',
}

const READY: NavItem[] = [
  {
    href: '/dashboard/saved/tutorials',
    label: 'Tutorials',
    state: 'live',
    blurb: 'Guides you kept to build later.',
  },
  {
    href: '/dashboard/saved/toys',
    label: 'Toys',
    state: 'live',
    blurb: 'Toys you are considering asking for.',
  },
  {
    href: '/dashboard/saved/challenges',
    label: 'Design challenges',
    state: 'live',
    blurb: 'Challenges you want to come back to.',
  },
]

/*
 * Each points at a real placeholder route, the way /dashboard/print-requests
 * already works — not at a list that does not exist, and not at this page. A
 * card that navigated back to where you already are reads as broken, and two
 * cards sharing an href would collide on HubGrid's key.
 *
 * These are static segments beside [type], so they win the route match and the
 * dynamic list never sees their slugs.
 */
const SOON: NavItem[] = [
  {
    href: '/dashboard/saved/organisations',
    label: 'Organisations',
    state: 'soon',
    blurb: 'Groups whose work you want to follow.',
  },
  {
    href: '/dashboard/saved/parts',
    label: 'Printable parts',
    state: 'soon',
    blurb: 'Parts to print, once the catalogue is open.',
  },
]

export default async function SavedHub() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  return (
    <div>
      <h1 className="title-hub">Saved</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        Everything you kept to come back to, grouped by the kind of thing it is.
      </p>

      <h2 className="title-detail mt-12">Ready now</h2>
      <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
        The three things you can save today, from anywhere they appear on the site.
      </p>
      <HubGrid items={READY} tone="brand" />

      <h2 className="title-detail mt-12">Coming soon</h2>
      <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
        Not savable yet, listed so you know they are planned.
      </p>
      <HubGrid items={SOON} tone="brand" />
    </div>
  )
}
