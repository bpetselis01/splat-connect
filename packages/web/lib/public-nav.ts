/**
 * The whole public site's shape, declared once.
 *
 * The top bar, the section subnav, the fat footer, the homepage launcher grid,
 * every hub page's card grid and the scaffold registry all read from here. This
 * pass took the public surface from 10 routes to 43; declaring any of that twice
 * guarantees drift.
 *
 * Deliberately a sibling of lib/nav-model.ts (the signed-in rail) rather than an
 * extension of it: the two navigations serve different people, share no items,
 * and merging them would mean one module branching on auth state.
 */

import type { IllustrationKey } from '@/components/editorial-image'
import type { Tone } from './tone'

export type NavState = 'live' | 'soon'

export interface NavItem {
  /**
   * Typed `string`, not next's `Route`: with `typedRoutes: true` (see
   * packages/web/next.config.ts), `Route` only admits hrefs that already exist,
   * and most of this module's 43 hrefs are pages later tasks still have to
   * build. Consumers cast at the `<Link href={...}>` call site instead — see
   * the pattern already in packages/web/app/impact/page.tsx. The real guard on
   * these hrefs is a Playwright spec (Task 20) that walks every one and asserts
   * it resolves.
   */
  href: string
  label: string
  state: NavState
  /**
   * One line, or a short list of what is behind the card.
   *
   * Used on hub cards, in the footer's title attribute, and as the scaffold
   * page's promise — all of which pass a string. The array form is My SPLAT's
   * alone (app/dashboard/page.tsx): its cards list what they lead to rather
   * than describing themselves. They stay text, never links — the card is one
   * link and a nested one would be invalid as well as a lie.
   */
  blurb: string | string[]
  /** Unread items behind this card. Omit or 0 for no badge. */
  count?: number
  /** Set on 'soon' items only — the allowlisted key POST /api/public/notify accepts. */
  featureKey?: string
}

export interface NavSection {
  href: string
  label: string
  blurb: string
  /** Drives the hub, its cards, the nav marker and the backdrop. See lib/tone.ts. */
  tone: Tone
  /**
   * The section's illustration, for the sticker on its cards and tiles.
   *
   * Declared here for the same reason `tone` is: the launcher, the hub grid and
   * the section header all want it, and a page that hardcodes its own would
   * drift the moment a section is renamed. Each of the seven maps to one of the
   * seven SVGs in public/illustrations, which is the whole set — a new section
   * needs a new drawing, and that is a real cost worth feeling here.
   */
  art: IllustrationKey
  /**
   * SPLAT provides three things — guides, the toy library, and 3D printed parts.
   * Everything else explains, recruits for or accounts for those three. The top
   * bar and the homepage launcher both read this to size and colour a section, so
   * a visitor learns what the organisation actually does without being told.
   */
  rank: 'pillar' | 'supporting'
  /** Empty for flat catalogues, whose pages ARE the listing. */
  children: NavItem[]
}

/**
 * The subset of a section that navigation chrome actually reads. Declared so
 * ACCOUNT_NAV can be a sectionFor() result without being a full NavSection.
 */
export type NavTarget = Pick<NavSection, 'href' | 'label' | 'tone'>

export const PUBLIC_NAV: NavSection[] = [
  {
    href: '/library',
    label: 'Guides',
    tone: 'brand',
    art: 'adapted-toy',
    rank: 'pillar',
    blurb: 'Step-by-step instructions for adapting a specific toy.',
    children: [],
  },
  {
    href: '/toy-library',
    label: 'Toy Library',
    tone: 'mint',
    art: 'bear-on-shelf',
    rank: 'pillar',
    blurb: 'Adapted toys that families and organisations are giving away.',
    children: [],
  },
  {
    href: '/printing',
    label: '3D Printing',
    tone: 'apricot',
    art: 'printer',
    rank: 'pillar',
    blurb: 'Printed switch mounts, cases and interrupters — and somewhere to ask for one.',
    children: [
      {
        href: '/printing/basics',
        label: 'Printing basics',
        state: 'live',
        blurb: 'Filament, settings and finishing for printed switch parts.',
      },
      {
        href: '/printing/requests',
        label: 'Request a print',
        state: 'soon',
        featureKey: 'printing',
        blurb: 'Ask an association with a free printer to make a part for you.',
      },
      {
        href: '/printing/parts',
        label: 'Printable parts',
        state: 'soon',
        featureKey: 'printing-parts',
        blurb: 'A catalogue of STL files, sized and tested for adaptation work.',
      },
    ],
  },
  {
    href: '/learn',
    label: 'Learn',
    tone: 'honey',
    art: 'switch',
    rank: 'supporting',
    blurb: 'How switch adaptation works, from first switch to safe finish.',
    children: [
      {
        href: '/learn/toy-adaptation-101',
        label: 'Toy adaptation 101',
        state: 'live',
        blurb: 'What a battery interrupter is, and why it is the whole trick.',
      },
      {
        href: '/learn/switch-types',
        label: 'Switch types explained',
        state: 'live',
        blurb: 'Buttons, levers, proximity and grasp — which suits which child.',
      },
      {
        href: '/learn/choosing-a-toy',
        label: 'Choosing a toy to adapt',
        state: 'live',
        blurb: 'What makes a toy easy to adapt, and what makes it impossible.',
      },
      {
        href: '/learn/tools-and-materials',
        label: 'Tools and materials',
        state: 'live',
        blurb: 'The shopping list, and what you can borrow instead of buying.',
      },
      {
        href: '/learn/safety-and-cleaning',
        label: 'Safety and cleaning',
        state: 'live',
        blurb: 'Batteries, small parts, and getting a toy ready to hand over.',
      },
      {
        href: '/learn/ask-an-expert',
        label: 'Ask an expert',
        state: 'soon',
        featureKey: 'ask-an-expert',
        blurb: 'Put a question to an occupational therapist or a maker.',
      },
    ],
  },
  {
    href: '/get-involved',
    label: 'Get Involved',
    tone: 'sky',
    art: 'maker',
    rank: 'supporting',
    blurb: 'Three ways in: make something, give something, or back someone.',
    children: [
      {
        href: '/get-involved/families',
        label: 'For families',
        state: 'live',
        blurb: 'Find a guide, gather the parts, adapt the toy you already own.',
      },
      {
        href: '/get-involved/contributors',
        label: 'For contributors',
        state: 'live',
        blurb: 'Adapt a toy, write it up, and get an organisation behind it.',
      },
      {
        href: '/get-involved/organisations',
        label: 'For organisations',
        state: 'live',
        blurb: 'Back contributors, hold toys for local families, host a build day.',
      },
      {
        href: '/get-involved/submit-an-idea',
        label: 'Submit an idea',
        state: 'live',
        blurb: 'Suggest a toy worth adapting, even if you cannot build it.',
      },
      {
        href: '/get-involved/submit-a-tutorial',
        label: 'Submit a guide',
        state: 'live',
        blurb: 'What writing up an adaptation involves, start to finish.',
      },
      {
        href: '/get-involved/requests',
        label: 'Adaptation requests',
        state: 'soon',
        featureKey: 'requests',
        blurb: 'Ask for a toy to be adapted, and let a maker nearby claim it.',
      },
      {
        href: '/get-involved/design-challenges',
        label: 'Design challenges',
        state: 'live',
        blurb: 'Problems nobody has solved yet, open to anyone.',
      },
    ],
  },
  {
    href: '/impact',
    label: 'Impact',
    tone: 'sunken',
    art: 'family',
    rank: 'supporting',
    blurb: 'What this community has made, given and delivered.',
    children: [
      {
        href: '/organizations',
        label: 'Organisations',
        state: 'live',
        blurb: 'The therapy centres, schools and services standing behind the work.',
      },
      {
        href: '/impact/news',
        label: 'News and stories',
        state: 'soon',
        featureKey: 'news',
        blurb: 'What families and makers have done with SPLAT.',
      },
      {
        href: '/impact/events',
        label: 'Events',
        state: 'soon',
        featureKey: 'events',
        blurb: 'Build days, workshops and where to find us in person.',
      },
      {
        href: '/impact/map',
        label: 'Deliveries map',
        state: 'soon',
        featureKey: 'map',
        blurb: 'Where adapted toys have actually landed.',
      },
    ],
  },
  {
    href: '/about',
    label: 'About',
    tone: 'plain',
    art: 'organisation',
    rank: 'supporting',
    blurb: 'Who runs SPLAT, and how to reach us.',
    children: [
      {
        href: '/about/team',
        label: 'Our team',
        state: 'live',
        blurb: 'The people behind the platform.',
      },
      {
        href: '/contact',
        label: 'Contact',
        state: 'live',
        blurb: 'Get in touch about a guide, a toy or a partnership.',
      },
      {
        href: '/about/partners',
        label: 'Partners and supporters',
        state: 'soon',
        featureKey: 'partners',
        blurb: 'The organisations and funders making this possible.',
      },
      {
        href: '/about/support',
        label: 'Support SPLAT',
        state: 'soon',
        featureKey: 'support',
        blurb: 'Ways to help beyond building a toy.',
      },
    ],
  },
]

/**
 * The signed-in account area, as a navigation target.
 *
 * Deliberately NOT a NavSection and NOT a member of PUBLIC_NAV. NavSection
 * requires `art` and `rank`, and the seven illustrations in public/illustrations
 * are the whole set; more to the point, components/public-footer.tsx and the
 * homepage launcher both map PUBLIC_NAV, so an eighth entry there would
 * advertise the account area to people who cannot reach it.
 *
 * It carries exactly the three fields every sectionFor() consumer reads, so the
 * breadcrumb, the backdrop and the top bar treat it as a section for free.
 */
export const ACCOUNT_NAV = {
  href: '/dashboard',
  label: 'My SPLAT',
  tone: 'brand',
} as const satisfies NavTarget

/** The account prefixes that belong to ACCOUNT_NAV. Admin is reached through a
    rail row under Account, so it is inside the account section, not beside it.
    /notifications is a top-level route rather than a /dashboard child, but it
    is a rail row too (see lib/nav-model.ts) — omitting it here silently drops
    the rail and the quiet header on that one page. */
const ACCOUNT_PREFIXES = ['/dashboard', '/admin', '/notifications']

/** Footer-only. Never in the top bar, never a section. */
export const FOOTER_LEGAL: NavItem[] = [
  { href: '/privacy', label: 'Privacy policy', state: 'live', blurb: 'What we collect and why.' },
  { href: '/terms', label: 'Terms of use', state: 'live', blurb: 'The rules for using the site.' },
  { href: '/safety', label: 'Safety', state: 'live', blurb: 'Batteries, small parts and supervision.' },
  { href: '/code-of-conduct', label: 'Code of conduct', state: 'live', blurb: 'How we expect people to treat each other.' },
  { href: '/legal/contributor-terms', label: 'Contributor terms', state: 'live', blurb: 'For anyone submitting a guide.' },
  { href: '/legal/org-leader-terms', label: 'Organisation leader terms', state: 'live', blurb: 'For anyone leading an organisation.' },
]

/** Every allowlisted notify key, derived so the list cannot drift from the nav. */
export const SCAFFOLD_KEYS: readonly string[] = PUBLIC_NAV.flatMap((s) =>
  s.children.filter((c) => c.state === 'soon').map((c) => c.featureKey!)
)

/**
 * Which section a path belongs to.
 *
 * Prefix matching alone is wrong for one child: /organizations sits under Impact
 * and shares no prefix with /impact. So children are matched explicitly before
 * falling back to the section's own prefix.
 */
export function sectionFor(pathname: string): NavTarget | undefined {
  const inside = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  if (ACCOUNT_PREFIXES.some(inside)) return ACCOUNT_NAV
  return (
    PUBLIC_NAV.find((s) => s.children.some((c) => inside(c.href))) ??
    PUBLIC_NAV.find((s) => inside(s.href))
  )
}

/**
 * Whether this path renders the rail (components/rail.tsx) rather than the
 * header (components/nav.tsx).
 *
 * True for every account page except the account root itself: `/dashboard`
 * ("My SPLAT") is the one page that keeps the header instead — see
 * docs/superpowers/specs/2026-08-23-my-splat-front-door-design.md. Exported
 * for crossesAccountBoundary below and for app/layout.tsx's shell decision,
 * so the two never drift apart.
 */
export function nestsRail(pathname: string): boolean {
  return sectionFor(pathname) === ACCOUNT_NAV && pathname !== ACCOUNT_NAV.href
}

/**
 * Whether navigating from `pathname` to `href` crosses a boundary the root
 * layout renders differently across, and therefore needs a full page load
 * rather than a soft <Link> transition (see components/boundary-link.tsx and
 * components/nav.tsx's NavLink for why).
 *
 * Two boundaries, not one: crossing between the public site and the account
 * section (as before), or crossing between `/dashboard` and every other
 * account page — since 2026-08-23 those render different chrome (header vs.
 * rail) despite both being "the account section". A link from the My SPLAT
 * hub grid to any of its own cards, or the floating back-to-My-SPLAT dock in
 * the other direction, would otherwise go stale exactly like the original
 * account/public bug.
 *
 * `sectionFor` returns undefined for a pathname/href it cannot resolve to any
 * known section (e.g. /upload, /tutorials/[id]/edit — real pages, just not
 * modelled in either nav). Those are treated as "not the account section"
 * here, the same as any other public/unclassified page.
 */
export function crossesAccountBoundary(pathname: string, href: string): boolean {
  const fromAccount = sectionFor(pathname) === ACCOUNT_NAV
  const toAccount = sectionFor(href) === ACCOUNT_NAV
  if (fromAccount !== toAccount) return true
  if (!fromAccount) return false
  return nestsRail(pathname) !== nestsRail(href)
}
