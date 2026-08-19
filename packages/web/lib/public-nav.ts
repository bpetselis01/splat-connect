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
  /** One line. Used on hub cards, in the footer's title attribute, and as the
      scaffold page's promise. */
  blurb: string
  /** Set on 'soon' items only — the allowlisted key POST /api/public/notify accepts. */
  featureKey?: string
}

export interface NavSection {
  href: string
  label: string
  blurb: string
  /** Empty for flat catalogues. SectionNav renders nothing for these. */
  children: NavItem[]
}

export const PUBLIC_NAV: NavSection[] = [
  {
    href: '/library',
    label: 'Guides',
    blurb: 'Step-by-step instructions for adapting a specific toy.',
    children: [],
  },
  {
    href: '/toy-library',
    label: 'Toy Library',
    blurb: 'Adapted toys that families and organisations are giving away.',
    children: [],
  },
  {
    href: '/learn',
    label: 'Learn',
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
        href: '/learn/3d-printing-basics',
        label: '3D printing basics',
        state: 'live',
        blurb: 'Filament, settings and finishing for printed switch parts.',
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
        state: 'soon',
        featureKey: 'design-challenges',
        blurb: 'Problems nobody has solved yet, open to anyone.',
      },
      {
        href: '/printing',
        label: '3D print requests',
        state: 'soon',
        featureKey: 'printing',
        blurb: 'Volunteer your printer, or ask for a part to be printed.',
      },
    ],
  },
  {
    href: '/impact',
    label: 'Impact',
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
export function sectionFor(pathname: string): NavSection | undefined {
  const inside = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  return (
    PUBLIC_NAV.find((s) => s.children.some((c) => inside(c.href))) ??
    PUBLIC_NAV.find((s) => inside(s.href))
  )
}
