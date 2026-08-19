# Public Site Scaffold

**Status:** Approved, ready to implement
**Date:** 2026-08-19

## Why

The public side of SPLAT Connect answers one question — *what tutorials exist* —
and, since `2026-08-18-public-contribution-showcase-design.md`, *who made them*.
Ten routes, four nav links.

It does not say who runs SPLAT, how to participate if you are not a parent, how
to adapt a toy in general terms, or where to get help in person. A contributor
or a therapy organisation arriving from a search result finds no page addressed
to them. There is no public privacy policy, despite the platform holding
children's ability data and families' home addresses.

Makers Making Change — the Canadian program with the closest model — carries 56
public pages against our 10. Their information architecture is worth learning
from even where their execution is not: audience-split on-ramps, a knowledge
layer separate from the catalogue, a public demand board, and numbers used as
the trust argument.

This spec settles the whole public information architecture in one pass and
builds it, using designed placeholders for the destinations whose features come
later. The point is that the shape of the site stops being an open question.

## Scope

- The full public IA: six top-level sections, their hub pages, and their
  children.
- A rebuilt homepage: a launcher grid for people who know where they're going,
  and the model explained for people who don't.
- A dropdown-free navigation model: flat top bar, hub pages, section subnav, and
  a fat footer carrying the whole sitemap on every page.
- Seven SVG illustrations and one `EditorialImage` component, so the editorial
  pages have something to look at before the team's photos exist.
- Twenty new pages with real written content.
- Nine scaffold pages using an extended `ComingSoon` with email capture.
- One new table and one new public endpoint, both for the email capture.
- A public organisations directory (the route exists but is signed-in only).

**Out of scope.** Every scaffolded feature itself — adaptation requests, design
challenges, 3D print jobs, news, events, the deliveries map, partners, support.
Each gets its own spec later. Also out of scope: any change to the signed-in
app shell, the mobile app, the dashboard, or admin.

## Decisions taken (from the design session)

| Question | Choice |
|----------|--------|
| Navigation pattern | **Flat top bar + hub pages + section subnav.** No dropdowns anywhere. |
| Homepage | **Explain it first** — hero with stats, three-step model, audience doors, then catalogue previews. |
| Two catalogues | **Split**, two top-level links, not merged under "Browse". |
| Name for `/library` | **Guides** (label only; the route is unchanged). |
| Placeholder treatment | **`ComingSoon` + email capture.** Not a bare "coming soon", not a ghosted fake UI. |
| Scaffold reachability | **Never linked from the top nav.** Hub page and subnav only, wearing a "soon" pill. |
| Learn content storage | **A TSX page per article.** No MDX, no CMS, no database. |
| Institutional framing | SPLAT is a real organisation, so `/about`, `/about/team`, and `/contact` carry real content. |
| Audiences served | All three — families, contributors, organisations — each with its own on-ramp. |
| Homepage launcher | **Yes** — a six-tile section grid above the fold, merged into the "explain it first" order rather than replacing it. |
| Deep links from anywhere | **Fat footer** listing every destination on every page. Not dropdowns. |
| Editorial imagery | **Seven flat SVG illustrations**, held in place by one `EditorialImage` component, to be replaced by the team's own workshop photos. |

### Rejected, and why

- **Dropdown menus.** A dropdown is a hub page rendered inside a menu. Keeping
  the page and deleting the menu costs nothing and removes hover behaviour,
  keyboard traps, and a mobile hamburger.
- **A public left rail** (reusing `components/rail.tsx`). Least new code, but it
  makes the site read as an app rather than a public site — wrong for a parent
  arriving from a search result — and collapses to a hamburger on mobile, which
  is the menu we set out to avoid.
- **Ghosted preview placeholders** showing the eventual UI with sample rows.
  Communicates the design well, but publishing fabricated adaptation requests
  from fabricated families on a disability platform is a credibility risk, and
  it means building each page twice.
- **MDX or a CMS for Learn.** Six developer-authored articles do not justify a
  content pipeline. Revisit when a non-developer needs to publish.
- **Stock photography for editorial pages.** Cannot ship without cleared
  rights, and a disability platform whose warmth comes from purchased images of
  children who are not its users is trading on something it has not earned.
  Illustrations hold the space until the team's own photos exist.
- **Emoji-and-tint bands as editorial placeholders.** This is what the site does
  now, and "no ability to tell a story" is the complaint that prompted the
  imagery work. Nine emoji bands read as absence, not design.

## Terminology

Renaming `/library` to "Guides" collides with the Learn section, whose contents
were also called guides during the design session. Resolved:

- **Guides** — the tutorial catalogue at `/library`. Instructions for adapting
  one specific toy.
- **Articles** — the Learn section's contents. General knowledge: switch types,
  tools, safety, printing.

Use these two words consistently in copy, component names, and tests.

## Information architecture

Six top-level sections. Every top-level link lands on real content.

| # | Nav label | Route | Subnav | State |
|---|-----------|-------|--------|-------|
| 1 | Guides | `/library` | none | rework (label only) |
| 2 | Toy Library | `/toy-library` | none | live |
| 3 | Learn | `/learn` | yes | new |
| 4 | Get Involved | `/get-involved` | yes | new |
| 5 | Impact | `/impact` | yes | rework (becomes a hub) |
| 6 | About | `/about` | yes | new |

Sections 1 and 2 are flat catalogues with no siblings, so **the subnav row does
not render for them**. The subnav appears only where a section has children.

### 1 · Guides — `/library`

Unchanged except the nav label. Existing detail route `/tutorials/[id]` stays.

### 2 · Toy Library — `/toy-library`

Unchanged. Existing detail route `/toy-library/[id]` stays.

### 3 · Learn — `/learn`

Hub page: a card grid of the articles, grouped as *Start here* / *Going deeper*.

| Page | Route | State |
|------|-------|-------|
| Overview | `/learn` | new |
| Toy adaptation 101 | `/learn/toy-adaptation-101` | new |
| Switch types explained | `/learn/switch-types` | new |
| Choosing a toy to adapt | `/learn/choosing-a-toy` | new |
| Tools & materials | `/learn/tools-and-materials` | new |
| Safety & cleaning | `/learn/safety-and-cleaning` | new |
| 3D printing basics | `/learn/3d-printing-basics` | new |
| Ask an expert | `/learn/ask-an-expert` | **scaffold** |

### 4 · Get Involved — `/get-involved`

Hub page: the three audience tracks as primary cards, the action pages below.
There is no separate `/how-it-works` route — this hub is that page. The
homepage's "How it works" button points here.

| Page | Route | State |
|------|-------|-------|
| Overview | `/get-involved` | new |
| For families | `/get-involved/families` | new |
| For contributors | `/get-involved/contributors` | new |
| For organisations | `/get-involved/organisations` | new |
| Submit an idea | `/get-involved/submit-an-idea` | new |
| Submit a tutorial | `/get-involved/submit-a-tutorial` | new |
| Adaptation requests | `/get-involved/requests` | **scaffold** |
| Design challenges | `/get-involved/design-challenges` | **scaffold** |
| 3D print requests | `/printing` | **scaffold** (route already exists) |

Each audience track is a numbered walkthrough, following the shape of MMC's
`/how-it-works/build-a-device`: five or fewer steps, each naming the concrete
action and where it happens in the app.

`submit-an-idea` and `submit-a-tutorial` are explainer pages, not forms. Each
ends in a single CTA — `/upload` for a signed-in contributor, `/login` for
everyone else.

### 5 · Impact — `/impact`

The existing page becomes the section hub. Its current content (totals band,
recently-active strip, contributor and organisation grid) becomes the Overview.

| Page | Route | State |
|------|-------|-------|
| Overview | `/impact` | rework |
| Organisations | `/organizations` | rework (unlock to public) |
| News & stories | `/impact/news` | **scaffold** |
| Events | `/impact/events` | **scaffold** |
| Deliveries map | `/impact/map` | **scaffold** |

The organisations directory lives here rather than under Browse: it is a
directory of who stands behind the work, which is a proof surface, and it gives
the route a home in the nav for the first time.

### 6 · About — `/about`

| Page | Route | State |
|------|-------|-------|
| About SPLAT | `/about` | new |
| Our team | `/about/team` | new |
| Contact | `/contact` | new |
| Partners & supporters | `/about/partners` | **scaffold** |
| Support SPLAT | `/about/support` | **scaffold** |

### Footer — the fat footer

Present on every public page, and it is a full sitemap rather than a legal
strip. Six columns, one per section, listing every child including the
scaffolded ones with their "soon" pill.

This exists to close the one real gap in the flat-nav model: the section subnav
only helps once you are already inside a section, so crossing from deep in Learn
to deep in Get Involved would otherwise take two clicks. The footer makes every
destination one click from every page — the same thing a dropdown would do, with
plain links instead of a hover-and-focus widget. On a platform serving people
with disabilities, that difference is the whole argument: no `aria-expanded`, no
focus trap, no arrow-key handling, no touch fallback, nothing to get wrong.

It renders from `PUBLIC_NAV`, so a page cannot exist without appearing here.

Below the columns, a legal row:

| Page | Route | State |
|------|-------|-------|
| Privacy policy | `/privacy` | new |
| Terms of use | `/terms` | new |
| Safety | `/safety` | new |
| Code of conduct | `/code-of-conduct` | new |
| Contributor terms | `/legal/contributor-terms` | live |
| Org leader terms | `/legal/org-leader-terms` | live |

`/privacy` is not optional. The platform already collects children's ability
data (`child_profiles`) and families' structured pickup addresses, snapshotted
onto toy transactions. Adding email capture in this same pass makes it a
prerequisite, not a follow-up — see Build order.

`/safety` matters more here than it would for a general maker platform: small
parts, lithium cells, soldering, and children with disabilities using the
output.

### Totals

| Category | Count |
|----------|-------|
| Live, unchanged | 10 routes |
| Rework | 4 (`/`, `/library` label, `/organizations`, `/impact`) |
| New with written content | 20 |
| Scaffold | 9 |

## Navigation model

### The single source of truth

One module, `packages/web/lib/public-nav.ts`, exports the entire structure:

```ts
export type NavState = 'live' | 'soon'

export interface NavItem {
  href: Route
  label: string
  state: NavState
  /** One line, used on hub cards and as the scaffold page's promise. */
  blurb?: string
}

export interface NavSection {
  href: Route
  label: string
  /** Empty for flat catalogues — the subnav row does not render. */
  children: NavItem[]
}

export const PUBLIC_NAV: NavSection[] = [ /* the six sections above */ ]

/** Footer-only links. Not sections, never in the top bar. */
export const FOOTER_LEGAL: NavItem[] = [ /* the six trust/legal pages */ ]
```

Everything reads from this: the top bar, the section subnav, the fat footer's six
columns, the homepage launcher grid, every hub page's card grid, and the scaffold
registry. This is the load-bearing decision of the whole spec —
this pass takes the public surface from 10 routes to 43, and if the sections,
their children, and their live/soon state are defined in more than one place
they will drift within a month.

It is deliberately a sibling of `lib/nav-model.ts` (the signed-in rail) rather
than an extension of it: the two navigations serve different people, share no
items, and merging them would mean one file branching on auth state.

### Top bar

`components/nav.tsx` renders the six section links for everyone. Its existing
role-conditional links (`Dashboard`, `Admin`) are unaffected, but in practice a
signed-in user never sees this bar at all: `app/layout.tsx` renders the
signed-in `AppShell` (and with it the rail, not `Nav`) on every route that
user can reach, so this component only ever renders for a signed-out visitor.

> **Known follow-up.** Because of the above, a signed-in contributor has no
> navigational path from the app shell to `/learn`, `/get-involved`, `/about`,
> `/contact`, or the trust pages (`/privacy`, `/terms`, `/safety`,
> `/code-of-conduct`) — those are reachable only by a signed-out visitor, or by
> typing the URL directly. Giving the rail a way into this content is a rail
> redesign and is out of scope for this pass.

Active state is by section prefix, which the component already computes
(`pathname === href || pathname.startsWith(href + '/')`). One correction is
needed: `/impact`'s children include `/organizations`, which is not a path
prefix of `/impact`. The active-section test therefore matches against the
section's `children` hrefs as well as its own.

The existing wrap behaviour — links dropping to their own row on narrow screens
— is kept. Six items wrap to two rows on a phone, which is acceptable and is
already how four items behave.

### Section subnav

New `components/section-nav.tsx`. Renders one row of sibling links below the top
bar when the active section has children, and nothing otherwise. Server
component, no state, no JavaScript. Horizontal scroll with
`overflow-x: auto` on narrow screens.

A child with `state: 'soon'` renders with a "soon" pill beside its label, so the
expectation is set before the click rather than after.

### Fat footer

New `components/public-footer.tsx`. Six columns generated from `PUBLIC_NAV`, plus
a legal row from `FOOTER_LEGAL`. Server component, plain `<Link>` elements, no
JavaScript. Columns collapse to two-up then one-up on narrow screens.

Rendered by the root layout on public routes only — the signed-in `AppShell` does
not get it, for the same reason the public top bar does not appear there.

### The rule, and its test

**No scaffold is ever reachable from the top bar.** All six top-level links land
on real content. Scaffolds appear only on their section's hub grid and in the
subnav, both marked.

This is enforced, not remembered: a Playwright spec visits all six top-level
links and asserts none of them renders the scaffold marker.

## Homepage

`app/page.tsx`, rebuilt. Section order, top to bottom:

1. **Hero.** The existing line — "Every child deserves to play." — with a
   subline that names the mechanism, not just the goal. Three inline stats
   (guides, toys delivered, contributors) sit inside the hero, so the proof
   arrives with the promise rather than in a band below it. One primary CTA:
   *Browse the Guides*. An `EditorialImage` (`adapted-toy`, `3/2`) sits beside
   the headline on wide screens and above it on narrow ones.
2. **Launcher grid.** Six tiles, one per section, each carrying a live count and
   a one-line description: Guides, Toy Library, Learn, Get Involved, Impact,
   About. Above the fold. This is the fast path — a returning visitor who knows
   where they are going never reads past the hero, and a stranger sees the whole
   site's shape and scale in one glance. Icons only, no images: the grid is for
   scanning, not looking.
3. **SPLAT in 30 seconds.** Three numbered steps covering the whole model, not
   just the parent's path: a guide gets written → an organisation stands behind
   it → a family builds it or receives one. This replaces the current
   Browse/Buy/Adapt strip, which is written for parents alone and sits below the
   featured tutorials.
4. **Where you fit.** Three audience doors linking to the `/get-involved`
   tracks, each with an `EditorialImage` (`3/2`).
5. **Two catalogue previews**, side by side: recent guides and recent toys.
6. **New from SPLAT.** A thin strip for news and events. Hidden entirely while
   both are scaffolded — an empty section is worse than no section.

Everything above the fold (hero plus launcher grid) must let a stranger learn
what SPLAT is, that it is real, and where everything lives — while letting a
returning visitor leave for their destination without scrolling at all.

The launcher counts come from the same `GET /api/public/impact` call the hero
stats use. Learn and About are static counts derived from `PUBLIC_NAV`, not
fetched.

## Visual assets

The site has no editorial imagery. `public/` holds five unmodified Next.js
starter SVGs, and `components/card-photo.tsx` is the only image component — a
`bg-brand-tint` band with a 🧸 when a toy or guide has no photo. Text-and-emoji
cards are why the public side cannot tell a story.

### The constraint

Guides and toys carry photos uploaded by the people who made them, with consent
inside the upload flow. Editorial pages — homepage, Learn, Get Involved, About,
Impact — have no such source. Two consequences:

- **No stock photography.** Rights aside, a disability platform whose emotional
  pull comes from purchased images of children who are not its users is trading
  on something it has not earned.
- **Placeholders must not read as photographs.** Nobody should mistake a
  placeholder for a real family.

### Illustrations

Seven flat SVGs in `public/illustrations/`, drawn in the brand palette:
`adapted-toy`, `switch`, `printer`, `family`, `maker`, `organisation`,
`bear-on-shelf`.

Register: flat, single-hue, no gradients, no photographic detail, and
**deliberately faceless**. Faceless avoids depicting a particular child, and it
means one illustration serves every family reading the page.

**These are placeholders with a known replacement.** The team will supply its own
workshop photographs. The component below is therefore built for the swap from
day one, and the credit-line handling is implemented now rather than retrofitted.

### The component

`components/editorial-image.tsx`, following `CardPhoto`'s shape — a real `src`
wins, the illustration holds the space until there is one:

```ts
export type IllustrationKey =
  | 'adapted-toy' | 'switch' | 'printer'
  | 'family' | 'maker' | 'organisation' | 'bear-on-shelf'

export function EditorialImage({ src, illustration, ratio, caption }: {
  /** A real, consented photograph once one exists. */
  src?: string | null
  illustration: IllustrationKey
  ratio: '3/2' | '2/1' | '1/1'
  /** Credit line. Rendered only when `src` is present. */
  caption?: string
}): React.ReactElement
```

Ratios are fixed per slot so a real photo landing later cannot reflow the page
around it. Like `CardPhoto`, the image is decorative: `alt=""`, because every
slot has a heading beside it and naming the subject twice is a duplicate
announcement to a screen reader. The illustration's own `<svg>` carries
`aria-hidden`.

### Slot inventory

| Page | Slot | Ratio | Illustration |
|------|------|-------|--------------|
| Homepage | Hero, beside the headline | `3/2` | `adapted-toy` |
| Homepage | Audience doors (×3) | `3/2` | `family`, `maker`, `organisation` |
| Homepage | Launcher tiles | — | none; icons only |
| Learn hub | Article cards (×6) | `3/2` | one per article |
| Learn article | Header banner | `2/1` | same as its card |
| Get Involved | Track headers (×3) | `2/1` | `family`, `maker`, `organisation` |
| About | Lead image | `3/2` | `organisation` |
| About / team | Portraits | `1/1` | initials block until real headshots |
| Impact | Story cards | `3/2` | `bear-on-shelf` (scaffolded) |
| Scaffold pages | — | — | none; the existing badge circle stays |

Scaffold pages deliberately get no artwork. Dressing up a page whose feature
does not exist sends the wrong signal.

`CardPhoto` is not touched. Guides and toys already have real photos.

## Scaffold pages

### The component

`components/coming-soon.tsx` is extended rather than replaced. It already ships,
is unit-tested, and its copy is shared verbatim with the mobile app's
`ComingSoon` for `/toy-library` and `/printing`. Two changes:

- The heading becomes the feature name, with "Not built yet — here's the plan."
  as the promise line. The existing sentence *"{label} is coming soon."* is
  pinned by a unit test and by the mobile copy, so this is a deliberate break:
  update the test, and leave the mobile component alone. The two surfaces
  diverge here because the web page now does something the mobile one does not.
- An optional `featureKey: string` prop. When present, the page renders the
  notify form; when absent, it renders exactly as today.

The existing "How it will work" numbered steps and the fallback CTA to the
Guides library are kept unchanged. A scaffold is never a dead end.

### Notify capture

The nine scaffolds each carry an email form. This is what makes a placeholder
earn its route: it turns build order from a guess into a ranked list, and
produces a launch list for whichever feature is built first.

**Schema.** Migration `035_notify_signups.sql`:

```sql
create table public.notify_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  feature_key text not null,
  created_at timestamptz not null default now(),
  unique (email, feature_key)
);

alter table public.notify_signups enable row level security;

-- Anon may insert and nothing else. There is no public read path.
create policy "anyone may register interest"
  on public.notify_signups for insert to anon, authenticated
  with check (true);
```

No select policy, for anyone. The list is read in the Supabase console. Building
an admin UI for a table checked twice a year would be the wrong instinct.

**Endpoint.** `POST /api/public/notify` in `packages/api/src/routes/public.ts`,
mounted before `authMiddleware`, using `createAnonClient()` — the pattern
established by `2026-08-14-toy-library-design.md`. Body: `{ email, featureKey }`.

- `featureKey` is validated against a hardcoded allowlist of the nine scaffold
  keys. An unknown key is a 400. This keeps the table from becoming an open
  write target for arbitrary strings.
- `email` is validated for shape only.
- A unique-violation returns 200, not 409. Signing up twice is not an error the
  visitor needs to hear about, and distinguishing the two responses would leak
  whether an address is already on a list.

**Client.** A small client component in the scaffold page. On failure it shows
an inline message and keeps the typed value. It never blocks the rest of the
page.

## Data and failure behaviour

Almost nothing here is new data.

| Surface | Source | Status |
|---------|--------|--------|
| Homepage stats | `GET /api/public/impact` (`totals`) | exists |
| Homepage recent guides | `GET /api/public/tutorials` | exists |
| Homepage recent toys | `GET /api/public/toys` | exists |
| Impact hub | `GET /api/public/impact` | exists |
| Organisations directory | `GET /api/public/organizations` | **new** |
| Notify | `POST /api/public/notify` | **new** |

`/organizations` currently calls `apiClient.get('/api/organizations')`, which
requires a session. The public variant follows `routes/public.ts`: anon client,
RLS as the backstop, a hand-written `select` of `id`, `name`, `description`,
`status` only. It must not return `org_leaders`, which carries user ids — the
field-drift hazard the showcase spec identified.

Suspended organisations stay listed and marked, as they are today. The reasoning
in `app/organizations/page.tsx` still holds: their name is on work they already
backed.

**Every fetch degrades, none throws.** The convention in `app/page.tsx` and
`app/impact/page.tsx` — `try/catch` around the fetch, falling back to the same
empty value the non-ok branch returns — is applied to every new server
component. An unreachable API means a homepage showing zeros and no recent
guides. It never means a 500.

## Content to be written

Twenty pages need actual prose. This is the real cost of the spec, and it is
writing, not engineering.

- **Six Learn articles.** Toy adaptation 101, switch types, choosing a toy,
  tools & materials, safety & cleaning, 3D printing basics.
- **Four Get Involved pages.** The hub plus three audience tracks, each a
  numbered walkthrough.
- **Two submit explainers.**
- **Three About pages.** About, team, contact.
- **Four trust pages.** Privacy, terms, safety, code of conduct.
- **One homepage** rewrite.

The trust pages need legal review before publication. The spec treats them as
pages with real copy, not placeholders — a scaffolded privacy policy would be
worse than none.

Plus **seven SVG illustrations**, which are design work rather than writing. They
are authored as hand-written SVG committed to the repo — no image pipeline, no
external asset host, no runtime dependency.

## Testing

Following the existing split: vitest unit tests in `packages/web/tests/unit`,
Playwright specs in `packages/web/tests/e2e`.

**Unit**

- `public-nav.ts`: every section has a unique href; every child href is unique
  across the whole tree; no section whose own href is also a child href.
- `section-nav.tsx`: renders nothing for a section with no children; marks the
  active child; renders the "soon" pill for `state: 'soon'` children only.
- `nav.tsx`: the `/organizations` → Impact active-section mapping, which is the
  one case prefix matching gets wrong.
- `coming-soon.tsx`: renders the notify form when `featureKey` is present and
  omits it when absent; the existing copy assertions, updated for the new
  heading.
- `public-footer.tsx`: every `PUBLIC_NAV` child appears exactly once; every
  `FOOTER_LEGAL` item appears; scaffolded children render the "soon" pill.
- `editorial-image.tsx`: renders the illustration when `src` is absent; renders
  the photo and its caption when `src` is present; the caption never renders
  without a photo; `alt` is empty in both cases.

**Integration** (`packages/api/tests/integration/public/`)

- `GET /api/public/organizations` returns no `org_leaders` field, and is
  reachable with no Authorization header.
- `POST /api/public/notify` accepts an allowlisted key, 400s an unknown key,
  400s a malformed email, and returns 200 on a duplicate insert.

**E2E** (`packages/web/tests/e2e/public/`)

- **The scaffold rule.** Visit all six top-level links; assert none renders the
  scaffold marker.
- Every subnav child href resolves to a page that renders, scaffold or not — no
  404s anywhere in the tree.
- **Every fat-footer link resolves**, walked from one page. This is the broadest
  guard in the suite: because the footer is generated from `PUBLIC_NAV`, a route
  added to the nav model but never built fails here.
- The footer renders on public routes and does not render inside the signed-in
  app shell.
- The homepage launcher grid links to all six sections.

`tests/e2e/impact.spec.ts` already covers the impact surface and will need
updating for the hub restructure.

## Build order

Six phases. Each ends with the site in a shippable state.

1. **Nav model and chrome.** `lib/public-nav.ts`, `components/section-nav.tsx`,
   `components/public-footer.tsx`, the `nav.tsx` rework. Ships with every section
   pointing at a stub so the structure is reviewable before any prose exists.
2. **Trust pages.** Privacy, terms, safety, code of conduct. First, because
   phase 4 collects email addresses and must not ship ahead of a privacy policy.
3. **Illustrations and the image component.** The seven SVGs and
   `components/editorial-image.tsx`. Ahead of phase 4 because every page built
   there consumes it.
4. **Real content.** Learn (hub + six articles), Get Involved (hub + three
   tracks + two explainers), About (three pages), the homepage rebuild including
   the launcher grid, the public organisations directory, the Impact hub
   restructure.
5. **Scaffolds.** Migration 035, the notify endpoint, the `ComingSoon`
   extension, the nine scaffold pages.
6. **Tests.** Written alongside each phase, not after; listed separately here
   only because the scaffold-rule E2E spec cannot be written until phase 5
   defines what the marker is.

## Open items

None blocking. Two to revisit after launch:

- **Learn authoring.** TSX pages are right for six developer-written articles.
  When someone outside the repo needs to publish, add `@next/mdx` then.
- **Notify volume.** If a single feature's list grows past a few hundred, the
  console-only read path stops being adequate and an admin view earns its place.
- **The photo swap.** When the team's workshop photographs arrive, each slot's
  `src` is filled in and its `caption` credits the photographer. No component
  change, no layout change — the ratios are already fixed. Worth deciding at that
  point whether the photos live in `public/` or in a Supabase bucket; `public/`
  is right for a fixed editorial set, a bucket only if non-developers upload
  them.
