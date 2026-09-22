/**
 * The breadcrumb trail for a page inside the account section.
 *
 * This is what replaced the navigation rail on 2026-09-17. The artboard's own
 * note on the My SPLAT hub is "One hub, twelve doors, badge counts on anything
 * waiting. Replaces the old sidebar entirely." — so every account page now
 * carries the public header plus a trail back up through its parents, exactly
 * as the prototype draws it:
 *
 *     My SPLAT / My tutorials / Tutorial editor
 *
 * Every crumb but the last is a link; the last is the page you are on and gets
 * no href, per WAI-ARIA's breadcrumb pattern.
 *
 * Why a table rather than splitting the pathname: the trail is not the URL.
 * `/upload` sits under My tutorials, `/tutorials/[id]/edit` sits under My
 * tutorials rather than under the public guide it edits, and `/notifications`
 * hangs straight off the hub despite sharing no prefix with it. A pathname
 * split gets all three wrong. The labels here are the prototype's own screen
 * names (docs/superpowers/specs/2026-09-17-artboard-screen-table.json), so the
 * trail and the picker cannot drift.
 *
 * Public pages are modelled only where the board draws a trail: five child
 * pages (an organisation request, an event, its registration, a recycling
 * drop-off, a story). Every other public page has none — the header already
 * says where you are.
 */
import { ACCOUNT_NAV } from '@/lib/public-nav'

/** `icon` names the board's duotone glyph for a crumb; components/breadcrumb.tsx draws it. */
export type Crumb = { label: string; href?: string; icon?: string }

/** A screen with no `parent` is a root: its own trail is empty. */
type Screen = { label: string; parent?: string; icon?: string }

/**
 * Keys are route patterns: a `[x]` segment matches any single segment. Order
 * does not matter — matching prefers a literal segment over `[x]` at every
 * position, so `/dashboard/toys/new` beats `/dashboard/toys/[x]`.
 *
 * `parent` is omitted only on the hub itself, which is where every trail ends.
 */
const SCREENS: Record<string, Screen> = {
  [ACCOUNT_NAV.href]: { label: ACCOUNT_NAV.label, icon: 'squares-four' },

  // Guides
  '/dashboard/tutorials': { label: 'My tutorials', parent: '/dashboard', icon: 'file-text' },
  '/upload': { label: 'Add a tutorial', parent: '/dashboard/tutorials' },
  '/tutorials/[x]/edit': { label: 'Tutorial editor', parent: '/dashboard/tutorials' },

  // Toys
  '/dashboard/toys': { label: 'My toys', parent: '/dashboard', icon: 'package' },
  '/dashboard/toys/new': { label: 'Add a toy', parent: '/dashboard/toys' },
  '/dashboard/toys/[x]': { label: 'Toy detail', parent: '/dashboard/toys' },

  // Exchanges
  '/dashboard/exchanges': { label: 'My exchanges', parent: '/dashboard', icon: 'handshake' },
  '/dashboard/exchanges/[x]': { label: 'Exchange thread', parent: '/dashboard/exchanges' },
  '/dashboard/exchanges/build/[x]': { label: 'Build thread', parent: '/dashboard' },

  // Challenges, saves, notifications
  '/dashboard/challenges': { label: 'My design challenges', parent: '/dashboard' },
  '/dashboard/saved': { label: 'Saved', parent: '/dashboard', icon: 'bookmark-simple' },
  '/dashboard/saved/[x]': { label: 'Saved', parent: '/dashboard/saved' },
  '/dashboard/saved/tutorials': { label: 'Saved tutorials', parent: '/dashboard/saved' },
  '/dashboard/saved/toys': { label: 'Saved toys', parent: '/dashboard/saved' },
  '/dashboard/saved/challenges': { label: 'Saved challenges', parent: '/dashboard/saved' },
  '/dashboard/saved/organisations': { label: 'Saved organisations', parent: '/dashboard/saved' },
  '/dashboard/saved/parts': { label: 'Saved parts', parent: '/dashboard/saved' },
  '/notifications': { label: 'Notifications', parent: '/dashboard' },

  // Printing
  '/dashboard/print-requests': { label: 'My print requests', parent: '/dashboard', icon: 'printer' },
  '/dashboard/print-requests/[x]': { label: 'Print job', parent: '/dashboard/print-requests' },
  '/dashboard/printers': { label: 'Print for others', parent: '/dashboard', icon: 'printer' },
  '/dashboard/printers/new': { label: 'Add a printer', parent: '/dashboard/printers' },

  // Events
  '/dashboard/events': { label: 'My events', parent: '/dashboard' },
  '/dashboard/org/events/[x]': { label: 'Manage event', parent: '/dashboard' },

  // Account and children
  '/dashboard/profile': { label: 'Account', parent: '/dashboard' },
  '/dashboard/child/new': { label: 'Add child', parent: '/dashboard' },
  '/dashboard/child/[x]': { label: 'Child profile', parent: '/dashboard' },

  // Organisation. The leader review screens live under /organizations in the
  // URL but belong to the org queue in the trail — sectionFor already resolves
  // them to the account section for the same reason.
  '/dashboard/organisation': { label: 'Org review queue', parent: '/dashboard', icon: 'tray' },
  '/dashboard/organisation/profile': { label: 'Organisation profile', parent: '/dashboard/organisation' },
  '/dashboard/organisation/toys': { label: 'Toy inventory', parent: '/dashboard/organisation' },
  '/dashboard/organisation/publish': {
    label: 'Events and stories',
    parent: '/dashboard/organisation',
    icon: 'megaphone',
  },
  '/dashboard/organisation/events/new': { label: 'Publish an event', parent: '/dashboard/organisation/publish' },
  '/dashboard/organisation/stories/new': { label: 'Publish a story', parent: '/dashboard/organisation/publish' },
  '/dashboard/organisation/orders': { label: 'Print orders', parent: '/dashboard/organisation' },
  '/dashboard/organisation/recycling': { label: 'Recycling intake', parent: '/dashboard/organisation' },
  '/dashboard/organisation/requests': { label: 'Requests to your organisation', parent: '/dashboard/organisation' },
  '/organizations/[x]': { label: 'Organisation', parent: '/dashboard/organisation' },
  '/organizations/[x]/projects/[x]': { label: 'Guide review', parent: '/dashboard/organisation' },

  // Admin is its own root on the board: no "My SPLAT /" above it.
  '/admin': { label: 'Admin dashboard', icon: 'shield-check' },
  '/admin/inbox': { label: 'Inbox', parent: '/admin' },
  '/admin/review': { label: 'Review queue', parent: '/admin', icon: 'clipboard-text' },
  '/admin/review/[x]': { label: 'Review a tutorial', parent: '/admin/review' },
  '/admin/ideas': { label: 'Ideas queue', parent: '/admin', icon: 'lightbulb' },
  '/admin/ideas/[x]': { label: 'Review an idea', parent: '/admin/ideas' },
  '/admin/build-requests': { label: 'Build requests', parent: '/admin' },
  '/admin/print-jobs': { label: 'Print jobs', parent: '/admin' },
  '/admin/reports': { label: 'Reports', parent: '/admin' },
  '/admin/content': { label: 'Site content', parent: '/admin' },
  '/admin/spot-check': { label: 'Spot-check', parent: '/admin' },
  '/admin/organizations': { label: 'Organisations', parent: '/admin' },
  '/admin/organization-requests': { label: 'Organisation requests', parent: '/admin' },
  '/admin/contributors': { label: 'Accounts', parent: '/admin' },

  // Public — only the five child pages the board draws a trail over.
  '/get-involved/organisations': { label: 'For organisations', icon: 'buildings' },
  '/get-involved/organisations/request': {
    label: 'Request an organisation',
    parent: '/get-involved/organisations',
  },
  '/get-involved/events': { label: 'Events', icon: 'calendar-dots' },
  '/get-involved/events/[x]': {
    label: 'Event detail',
    parent: '/get-involved/events',
    icon: 'calendar-check',
  },
  '/get-involved/events/[x]/register': {
    label: 'Register for an event',
    parent: '/get-involved/events/[x]',
  },
  '/get-involved/recycling': { label: 'Recycling', icon: 'recycle' },
  '/get-involved/recycling/drop-off': { label: 'Book a drop-off', parent: '/get-involved/recycling' },
  '/about/stories': { label: 'Stories', icon: 'newspaper' },
  '/about/stories/[x]': { label: 'Story', parent: '/about/stories' },
}

const PATTERNS = Object.keys(SCREENS).map((pattern) => ({
  pattern,
  segments: pattern.split('/').filter(Boolean),
}))

/** The matching pattern for a concrete pathname, or undefined. */
function match(pathname: string): string | undefined {
  const parts = pathname.split('/').filter(Boolean)
  let best: { pattern: string; literals: number } | undefined
  for (const { pattern, segments } of PATTERNS) {
    if (segments.length !== parts.length) continue
    let literals = 0
    let ok = true
    for (let i = 0; i < segments.length; i++) {
      if (segments[i] === parts[i]) literals++
      else if (segments[i] !== '[x]') {
        ok = false
        break
      }
    }
    // More literal segments wins, so /dashboard/toys/new is never served by
    // /dashboard/toys/[x].
    if (ok && (!best || literals > best.literals)) best = { pattern, literals }
  }
  return best?.pattern
}

/**
 * The trail for `pathname`, root first, or an empty array for a pathname this
 * does not model — and for a root (the hub, /admin, a public parent), which
 * has nothing above it to point at.
 */
export function trailFor(pathname: string): Crumb[] {
  const start = match(pathname)
  if (!start || !SCREENS[start].parent) return []
  const parts = pathname.split('/').filter(Boolean)

  const crumbs: Crumb[] = []
  // The page itself carries no href: it is where you already are.
  crumbs.push({ label: SCREENS[start].label })

  const seen = new Set<string>([start])
  let parent: string | undefined = SCREENS[start].parent
  while (parent && SCREENS[parent] && !seen.has(parent)) {
    seen.add(parent)
    // A parametrised ancestor takes its id from the same position in the
    // pathname — /get-involved/events/abc/register links up to
    // /get-involved/events/abc. Where the positions do not line up (a review
    // screen under /organizations whose parent is the org queue) there is no
    // [x] to fill, so this only ever fills ids the URL actually carries.
    const segs = parent
      .split('/')
      .filter(Boolean)
      .map((seg, i) => (seg === '[x]' ? parts[i] : seg))
    crumbs.unshift({
      label: SCREENS[parent].label,
      href: segs.every(Boolean) ? '/' + segs.join('/') : undefined,
      icon: SCREENS[parent].icon,
    })
    parent = SCREENS[parent].parent
  }
  return crumbs
}
