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
import type { IconName } from '@splat-connect/types'

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
   * One line about the card, or a comma list of what is behind it.
   *
   * Used on hub cards, in the footer's title attribute, and as the scaffold
   * page's promise. My SPLAT's cards (app/dashboard/page.tsx) list what they
   * lead to rather than describing themselves, but that is a sentence like any
   * other — it was briefly a string[] rendered as tags, and the tags read as
   * controls that were not controls. Prose cannot make that mistake.
   */
  blurb: string
  /** Unread items behind this card. Omit or 0 for no badge. */
  count?: number
  /**
   * The nav model's own icon name, carried through for HubGrid's `tile`
   * variant. Optional because the public hubs draw artwork instead and have no
   * icon to give.
   */
  icon?: IconName
  /** The tile variant's icon-square colour, when a card has its own (My SPLAT). */
  tint?: string
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
        label: 'Printing basics',        icon: 'printer',
        state: 'live',
        blurb: 'Filament, settings and finishing for printed switch parts.',
      },
      {
        href: '/printing/requests',
        label: 'Request a print',        icon: 'orders',
        // Live since 058: a print job is a toy transaction with a printer and a
        // set of the guide's own STL files for a subject.
        state: 'live',
        blurb: 'Ask somebody with a free printer for the parts of a guide.',
      },
      {
        href: '/printing/parts',
        label: 'Printable parts',        icon: 'box',
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
        label: 'Toy adaptation 101',        icon: 'book',
        state: 'live',
        blurb: 'What a battery interrupter is, and why it is the whole trick.',
      },
      {
        href: '/learn/switch-types',
        label: 'Switch types explained',        icon: 'switch',
        state: 'live',
        blurb: 'Buttons, levers, proximity and grasp — which suits which child.',
      },
      {
        href: '/learn/choosing-a-toy',
        label: 'Choosing a toy to adapt',        icon: 'toy',
        state: 'live',
        blurb: 'What makes a toy easy to adapt, and what makes it impossible.',
      },
      {
        href: '/learn/tools-and-materials',
        label: 'Tools and materials',        icon: 'wrench',
        state: 'live',
        blurb: 'The shopping list, and what you can borrow instead of buying.',
      },
      {
        href: '/learn/safety-and-cleaning',
        label: 'Safety and cleaning',        icon: 'shield',
        state: 'live',
        blurb: 'Batteries, small parts, and getting a toy ready to hand over.',
      },
      {
        href: '/learn/ask-an-expert',
        label: 'Ask an expert',        icon: 'chat',
        // Live since 2026-09-17. It is a routing page rather than a queue:
        // there is no private expert queue on SPLAT on purpose, because an
        // answer in the open helps the next family too.
        state: 'live',
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
        label: 'For families',        icon: 'heart',
        state: 'live',
        blurb: 'Find a guide, gather the parts, adapt the toy you already own.',
      },
      {
        href: '/get-involved/contributors',
        label: 'For contributors',        icon: 'wrench',
        state: 'live',
        blurb: 'Adapt a toy, write it up, and get an organisation behind it.',
      },
      {
        href: '/get-involved/organisations',
        label: 'For organisations',        icon: 'building',
        state: 'live',
        blurb: 'Back contributors, hold toys for local families, host a build day.',
      },
      {
        href: '/get-involved/organisations/request',
        label: 'Request an organisation',        icon: 'building',
        // Live since 060. Leadership is granted by an admin and never
        // self-started; this is where the conversation starts.
        state: 'live',
        blurb: 'Ask for your organisation to be set up, and an admin verifies it.',
      },
      {
        href: '/get-involved/submit-an-idea',
        label: 'Submit an idea',        icon: 'lightbulb',
        state: 'live',
        blurb: 'Suggest a toy worth adapting, even if you cannot build it.',
      },
      {
        href: '/get-involved/submit-a-tutorial',
        label: 'Submit a guide',        icon: 'file',
        state: 'live',
        blurb: 'What writing up an adaptation involves, start to finish.',
      },
      {
        href: '/get-involved/requests',
        label: 'Adaptation requests',        icon: 'inbox',
        // Live since 057: a build request is an ordinary toy transaction with
        // a guide for a subject, so the whole thread came with it.
        state: 'live',
        blurb: 'Ask a maker to build one of our guides for your child.',
      },
      {
        href: '/get-involved/design-challenges',
        label: 'Design challenges',        icon: 'clipboard',
        state: 'live',
        blurb: 'Problems nobody has solved yet, open to anyone.',
      },
      {
        href: '/get-involved/makers-wanted',
        label: 'Makers wanted',        icon: 'lifebuoy',
        // Live since 064 made a build request with no maker on it legal — the
        // shape SUPABASE.md filed when 057 could not express it.
        state: 'live',
        blurb: 'Open build requests, waiting for a maker nearby to claim one.',
      },
      {
        href: '/get-involved/recycling',
        label: 'Recycling',        icon: 'recycle',
        // Live since 059 built the table and 063 versioned the declaration.
        state: 'live',
        blurb: 'Drop clean waste plastic at an organisation, and earn print credit.',
      },
      {
        href: '/get-involved/events',
        label: 'Events',        icon: 'calendar',
        // Live since 061. Under Get Involved rather than Impact because an
        // event is something you turn up to, not something already achieved —
        // the artboard puts it here for the same reason.
        state: 'live',
        blurb: 'Build days, workshops and open afternoons, run by organisations.',
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
        label: 'Organisations',        icon: 'building',
        state: 'live',
        blurb: 'The therapy centres, schools and services standing behind the work.',
      },
      // Stories and Events moved out of Impact on 2026-09-17, to About and Get
      // Involved. The artboard puts them there, and the reason holds: Impact is
      // what the community has MADE — counts, organisations, a map — and a
      // story is an account of it, while an event is something you can turn up
      // to. /impact/news and /impact/events redirect (app/impact/*/page.tsx).
      {
        href: '/impact/map',
        label: 'Deliveries map',        icon: 'map',
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
        href: '/about/stories',
        label: 'Stories',        icon: 'book',
        state: 'live',
        blurb: 'What families, makers and organisations have actually done with SPLAT.',
      },
      {
        href: '/about/team',
        label: 'Our team',        icon: 'users',
        state: 'live',
        blurb: 'The people behind the platform.',
      },
      {
        href: '/contact',
        label: 'Contact',        icon: 'chat',
        state: 'live',
        blurb: 'Get in touch about a guide, a toy or a partnership.',
      },
      {
        href: '/about/partners',
        label: 'Partners and supporters',        icon: 'handshake',
        // Live: the delivery-partner half always was — it reads the
        // organisations directory. The funder half is honestly empty.
        state: 'live',
        blurb: 'The organisations and funders making this possible.',
      },
      {
        href: '/about/support',
        label: 'Support SPLAT',        icon: 'heart',
        // Live. There was never anything here to wait for.
        state: 'live',
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
    the rail and the quiet header on that one page. /upload is the same story:
    it is the first screen of the authoring journey that continues in the
    tutorial editor, and it was rendering the header while the editor it hands
    over to did the same. */
const ACCOUNT_PREFIXES = ['/dashboard', '/admin', '/notifications', '/upload']

/**
 * Account routes nested UNDER a public one, which a prefix cannot express.
 *
 * /tutorials/[id] is the public detail page and keeps the header; only its
 * /edit child is the contributor's own editor and takes the rail. A prefix of
 * '/tutorials' above would drag the public page across with it, so the editor
 * is matched by shape instead — the same distinction, written the same way, as
 * the contributor-terms gate in middleware.ts.
 *
 * /organizations nests the two sides alternately, so neither direction can be
 * a prefix: the list is public, /organizations/[id] is the leader dashboard
 * (a non-leader is redirected off it by lib/org-access.ts) and its
 * /projects/[tutorialId] child is the review screen, while
 * /organizations/[id]/public is the public profile one segment deeper. Both
 * leader pages are reached from /dashboard/organisation, which carries the
 * rail — without these the chrome flipped halfway through a review.
 */
const ACCOUNT_PATTERNS = [
  /^\/tutorials\/[^/]+\/edit(\/|$)/,
  /^\/organizations\/[^/]+$/,
  /^\/organizations\/[^/]+\/projects(\/|$)/,
]

/** Footer-only. Never in the top bar, never a section. */
export const FOOTER_LEGAL: NavItem[] = [
  { href: '/privacy', label: 'Privacy policy', icon: 'shield', state: 'live', blurb: 'What we collect and why.' },
  { href: '/terms', label: 'Terms of use', icon: 'scales', state: 'live', blurb: 'The rules for using the site.' },
  { href: '/safety', label: 'Safety', icon: 'shield', state: 'live', blurb: 'Batteries, small parts and supervision.' },
  { href: '/code-of-conduct', label: 'Code of conduct', icon: 'scales', state: 'live', blurb: 'How we expect people to treat each other.' },
  { href: '/legal/intended-purpose', label: 'What Connect is (and isn\u2019t)', icon: 'scales', state: 'live', blurb: 'Not a medical device, and why that matters.' },
  { href: '/legal/contributor-terms', label: 'Contributor terms', icon: 'scales', state: 'live', blurb: 'For anyone submitting a guide.' },
  { href: '/legal/org-leader-terms', label: 'Organisation leader terms', icon: 'scales', state: 'live', blurb: 'For anyone leading an organisation.' },
]

/** The footer's five columns, as plain data so a Node test can import them. */
export type FooterRow = { label: string; href: string }

export const FOOTER_COLUMNS: { heading: string; rows: FooterRow[] }[] = [
  {
    heading: 'Learn',
    rows: [
      { label: 'Toy adaptation 101', href: '/learn/toy-adaptation-101' },
      { label: 'Switch types explained', href: '/learn/switch-types' },
      { label: 'Choosing a toy', href: '/learn/choosing-a-toy' },
      { label: 'Tools and materials', href: '/learn/tools-and-materials' },
      { label: 'Safe handling', href: '/learn/safety-and-cleaning' },
      { label: 'Ask an expert', href: '/learn/ask-an-expert' },
    ],
  },
  {
    heading: '3D Printing',
    rows: [
      { label: 'Find a printer', href: '/printing' },
      { label: 'Printing basics', href: '/printing/basics' },
    ],
  },
  {
    heading: 'Get Involved',
    rows: [
      { label: 'For families', href: '/get-involved/families' },
      { label: 'For contributors', href: '/get-involved/contributors' },
      { label: 'For organisations', href: '/get-involved/organisations' },
      { label: 'Submit an idea', href: '/get-involved/submit-an-idea' },
      { label: 'Events', href: '/get-involved/events' },
      { label: 'Makers wanted', href: '/get-involved/makers-wanted' },
      { label: 'Submit a guide', href: '/get-involved/submit-a-tutorial' },
      { label: 'Design challenges', href: '/get-involved/design-challenges' },
    ],
  },
  {
    heading: 'Impact and About',
    rows: [
      { label: 'Community impact', href: '/impact' },
      { label: 'Organisations', href: '/organizations' },
      { label: 'Deliveries map', href: '/impact/map' },
      { label: 'Stories', href: '/about/stories' },
      { label: 'About SPLAT', href: '/about' },
      { label: 'Our team', href: '/about/team' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  { heading: 'Legal', rows: FOOTER_LEGAL.map(({ label, href }) => ({ label, href })) },
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
  if (ACCOUNT_PREFIXES.some(inside) || ACCOUNT_PATTERNS.some((p) => p.test(pathname)))
    return ACCOUNT_NAV
  return (
    PUBLIC_NAV.find((s) => s.children.some((c) => inside(c.href))) ??
    PUBLIC_NAV.find((s) => inside(s.href))
  )
}

/**
 * Whether navigating from `pathname` to `href` crosses the public/account
 * boundary, which the root layout renders differently across, and therefore
 * needs a full page load rather than a soft <Link> transition (see
 * components/boundary-link.tsx and components/nav.tsx's NavLink for why).
 *
 * One boundary, not two. Until 2026-09-17 `/dashboard` and the rest of the
 * account section rendered different chrome (header vs. rail), so a move
 * between them counted as a crossing too. The rail is gone — the artboard's
 * own note on the hub is "replaces the old sidebar entirely" — so every
 * account page now renders the same header as the public site and only the
 * public/account crossing is left.
 *
 * `sectionFor` returns undefined for a pathname/href it cannot resolve to any
 * known section (e.g. /contributors/[id], /tutorials/[id] — real public pages,
 * just not modelled in PUBLIC_NAV). Those are treated as "not the account
 * section" here, the same as any other public/unclassified page.
 */
export function crossesAccountBoundary(pathname: string, href: string): boolean {
  return (sectionFor(pathname) === ACCOUNT_NAV) !== (sectionFor(href) === ACCOUNT_NAV)
}
