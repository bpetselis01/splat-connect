# Playroom: a visual direction for the public site

**Date:** 2026-08-20
**Status:** Design, awaiting review
**Scope:** The 42 public-facing pages. No change to authenticated product UI.

## Why

The public site works and reads as generated. Measured on the current code:

| Symptom | Evidence |
|---|---|
| One hue carries everything | Accent-token uses across all public pages: `brand` 24, `honey` 4, `mint` 2, `apricot` **0** |
| The same card, endlessly | `HubGrid` on 5 pages, `LauncherGrid` on the homepage — uniform white rounded boxes, bold title, muted blurb |
| No typographic range | **15 pages** share the byte-identical h1 class string `text-2xl font-bold text-ink sm:text-3xl`; largest type on the site is ~30px |
| Nothing moves | No animation library in `package.json` |

The third row is the root cause, and the first row is the surprise. `globals.css`
already defines `apricot` — commented *"Emphasis and delight, never decoration"* —
along with `mint` and `honey`. **The cheerful palette was designed and then never
spent.** This work spends it. It does not invent a new brand.

## Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Direction | **Playroom** | Chosen from three mocked options. Warmest for families, who are the primary audience |
| Ground | **`#eaf4fa`, the existing canvas** | `globals.css` documents the blue as deliberate, "so a parent who uses the app and then opens the site lands in the same product". Warm cream would break that, and is the most over-generated ground in current AI design |
| Coverage | **All 42 public pages** | Most of it lands through shared components |
| Information architecture | **Three pillars, four supporting sections** | 3D printing is a core functionality alongside guides and the toy library, not a Get Involved sub-item |
| Imagery | **Styled placeholders** | `EditorialImage` already does this; see Reuse below |
| Playful layer | **Marked, not faked** | Stickers, overlays and animation are part of the direction and none of the art exists. Each is a labelled slot carrying its own brief — see *The placeholder family* |

Playroom's known risk — that tilted pastel cards read as unserious to therapists,
partner organisations and funders, who also use this site — was raised and
accepted. It is handled inside the direction rather than by diluting it: see
*Register by page class* and *Tilt is decorative only*.

## Scope boundary

**In (42 pages):** the 31 hrefs declared in `lib/public-nav.ts`; the homepage;
the 4 trust pages (`/privacy`, `/terms`, `/safety`, `/code-of-conduct`); and the 6
public detail routes not already in the nav (`/toy-library/[id]`,
`/tutorials/[id]`, `/contributors/[id]`, `/organizations/[id]`,
`/organizations/[id]/public`, `/organizations/[id]/projects/[tutorialId]`).
`/organizations` itself is one of the 31. 31 + 1 + 4 + 6 = 42.

**Out, and not to be touched:** `/upload`, `/notifications`,
`/tutorials/[id]/edit`, `/legal/contributor-terms`, `/legal/org-leader-terms`, and
everything under `/dashboard`, `/admin`, `/login`, `/signup`, `/auth`,
`/onboarding`. These are authenticated product UI or gates. `AppShell`,
`ShellFrame` and `lib/nav-model.ts` are out of scope entirely.

The boundary is enforceable: the public branch of `app/layout.tsx` is exactly the
`shell ?? (...)` fallback. Anything rendering inside `AppShell` is out.

## Reuse before building

Three things already exist and must not be reinvented:

- **`EditorialImage`** locks an aspect ratio, falls back to one of seven brand
  SVGs in `public/illustrations/` (all present, all serving 200), and is written
  so that "filling in `src` is then the entire change". This *is* the styled
  placeholder system. Extend its ratio set if needed; do not replace it.
- **`globals.css` component classes** — `.card`, `.card-link`, `.btn-accent`,
  `.badge`, `.chip` and ~40 others are the single definition of each affordance.
  Playroom changes these in place; it does not add a parallel set.
- **`lib/public-nav.ts`** is the single source of truth for the public surface.
  Section colour is added there, not hardcoded per page.

## Information architecture

SPLAT provides three things. The site did not say so.

| Pillar | Route | State |
|---|---|---|
| **Guides** — adaptation tutorials | `/library` | Live catalogue |
| **Toy Library** — adapted toys to borrow | `/toy-library` | Live catalogue |
| **3D Printing** — printable parts and print requests | `/printing` | **Pillar, not yet built** |

Learn, Get Involved, Impact and About are supporting sections. They explain,
recruit and account for the three pillars; they are not peers of them.

### What changes

`/printing` is currently a `state: 'soon'` **child of Get Involved** rendering
`ComingSoon`. It is promoted to a top-level `NavSection` with three children:

| Route | Label | State | Source |
|---|---|---|---|
| `/printing/basics` | Printing basics | live | Moved from `/learn/3d-printing-basics` |
| `/printing/requests` | Request a print | soon | The current `/printing` ComingSoon content |
| `/printing/parts` | Printable parts | soon | New — the STL catalogue this pillar grows into |

`/learn/3d-printing-basics` is the only substantial 3D printing content that
exists, so it becomes the section's anchor. Its old URL gets a permanent redirect
in `next.config.ts`; no inbound link breaks. Learn loses one "Going deeper" item;
Get Involved loses its `/printing` child.

### The placeholder rule still holds

`tests/e2e/public/navigation.spec.ts` enforces that no top-level link is a
placeholder — a rule set deliberately, because "eleven placeholder pages linked
from a top nav teaches a visitor the site is mostly empty".

Promoting `/printing` does not weaken it. The rule exists to stop *minor* unbuilt
features being advertised as sections; naming a core capability is different. The
`/printing` hub must therefore be **a real page**: what SPLAT's printing offer is,
why printed parts matter for adaptation, how to get one today without a printer —
with its unbuilt features marked `soon` behind the existing notify flow. It ships
with a live child (Basics) from day one, so the section is never empty.

This is the one place the work requires genuinely new copy. It is called out in
Non-goals below.

## The design system

### Section colour

`NavSection` gains one field:

```ts
export type Tone = 'brand' | 'mint' | 'honey' | 'apricot' | 'deep' | 'rust'

export interface NavSection {
  href: string
  label: string
  blurb: string
  tone: Tone          // NEW — drives hub, cards, nav dot, backdrop
  children: NavItem[]
}
```

Colour reinforces the hierarchy: **the three pillars carry the three distinct
accent families; the four supporting sections stay in the blue family.** A visitor
can tell a pillar from a supporting section without reading a word.

| Section | Rank | Tone | Surface | Ink |
|---|---|---|---|---|
| Guides | Pillar | `brand` | `#d8ecf7` | `#0a4f70` |
| Toy Library | Pillar | `mint` | `#d4f2ea` | `#0f5c4d` |
| 3D Printing | Pillar | `apricot` | `#ffe3d5` | `#8c3312` |
| Learn | Supporting | `honey` | `#fdeecb` | `#7a4e05` |
| Get Involved | Supporting | `sky` | `#bfe4f5` | `#0a4f70` |
| Impact | Supporting | `sunken` | `#dcedf6` | `#12283a` |
| About | Supporting | `plain` | `#ffffff` | `#12283a` |

Every value is an existing token. No new brand colours.

Every pair above already clears 4.5:1; this must be re-verified in test, not
assumed. A `toneClass(tone)` helper in `lib/tone.ts` maps tone to Tailwind
classes so the mapping exists once.

### Shell width

The public shell was `max-w-6xl` (72rem / 1152px), repeated as three separate
literals in the top bar, the content column and the footer. On a 1900px display
that used **60% of the width and left 377px of dead canvas down each side** — a
reading measure applied to a whole site, which made the hero and the seven-tile
launcher read as a phone layout that had been stretched.

One class, `.public-shell`, now holds the measure for all three, because a top
bar that ends 30px short of the content beneath it reads as a misalignment
rather than as a design.

The measure is **proportional, not fixed**: `width: min(80%, 110rem)` — a 10%
margin down each side, so every display gets the same breathing room rather than
a fixed column that looks generous on a laptop and marooned on a 27-inch
monitor. Two deliberate departures from the proportion:

| Viewport | Gutter | Why |
|---|---|---|
| < 640px | **flat 1rem** | A percentage margin takes width from where there is least of it: 10% of a 360px screen is a 36px gutter, twice the inset it needs and 80px of card to pay for it |
| 640–2200px | **10%** | The proportional rule, across every real phone-landscape, tablet, laptop and 1080p display |
| > 2200px | **110rem cap** | Past this, 80% is 1760px of content, and a three-across card grid that wide stops being a grid and becomes three billboards |

Measured: 10.0% each side at 768, 1024, 1280, 1512 and 1920.


One width, on every page. An earlier pass narrowed the shell on articles and it
was wrong: the top bar and footer narrowed with it, so navigating from a hub to
the privacy policy shifted the entire chrome inward — up to 192px at 1920. Page
chrome must not move between pages. Reading measure is handled where it belongs,
by `max-w-prose` on the text itself, and the space beside an article is where
`PlayroomBackdrop`'s shapes already live.

| Register | Shell | Why |
|---|---|---|
| Every page | **80% of viewport**, capped at 110rem | One measure, so the bar and footer never jump |

### Shape and tilt

Playroom's signature is soft background shapes and cards laid slightly off-square.

**Tilt is decorative only.** Cards are laid out in an ordinary upright CSS grid.
Rotation is applied as a `transform` on the card, never on the grid, and never as
a layout offset. Remove every transform and the page is correct — that is the
property that makes this viable across 42 pages rather than 6, and it is what
keeps rotated cards safe under browser zoom and long translated strings.

Rotation values are drawn from a fixed set (`-1.6°, +0.9°, -0.7°, +1.4°`) cycled
by index, so the same card is always tilted the same way between renders. No
randomness — it would flicker on rehydration.

`PlayroomBackdrop` renders 2–3 absolutely-positioned soft circles tinted to the
section tone, `aria-hidden`, `pointer-events: none`, behind content.

### The placeholder family

Playroom is a direction with a visual layer on top of it — stickers pinned to
cards, a hand-drawn path over the how-it-works band, a switch that animates when
pressed. None of that art exists, and the site has to be honest about which.

`components/slot.tsx` holds two components, alongside the `EditorialImage` that
already existed:

| Component | Holds | Unfilled state |
|---|---|---|
| `EditorialImage` | Big rectangular photo slots | Dashed frame + brand illustration |
| `Sticker` | Small decorative discs | Dashed disc marked `ART` |
| `Slot` | Regions for an animation or overlay | Dashed box naming the kind |

Three rules make the family work:

- **Every slot carries its brief.** The `note` prop describes the art that
  belongs there, and rides in the `title` attribute. Whoever draws the sticker is
  briefed by the page rather than by a document that has drifted from it.
- **A slot reserves its box.** A `Sticker` is the same size filled or empty, so
  dropping in real art never reflows the page around it.
- **Placeholders look like placeholders.** Empty slots are brand-blue and dashed
  on every section, deliberately *not* tinted to the tone they sit in — a
  placeholder that camouflages into each section is a placeholder that ships.

They are decoration and are treated as such: `aria-hidden` and
`pointer-events-none`, verified by test and by a sweep asserting no link's
accessible name contains a slot's label.

**`NEXT_PUBLIC_SLOTS=off`** hides every unfilled `Sticker` and `Slot` without
touching a page. It does not reach a sticker that has real art in it — that is
the finished state — nor `EditorialImage`, which owns its own fallback.

Where they are placed today:

| Slot | Page | Brief |
|---|---|---|
| Animation | `/` hero | Switch press → toy lights up, replays on hover |
| Sticker | `/` hero | Spark or star burst, apricot |
| Overlay | `/` how-it-works | Hand-drawn dotted path between the three steps |
| Sticker | Launcher pillars | Section illustration, bleeding off the corner *(filled)* |
| Sticker | Every hub card | Lead card wears the section illustration *(filled)*; siblings hold an empty slot |

Prose pages get none, deliberately. The mockup's privacy-policy proof carries no
illustration at all — its personality comes from the breadcrumb, the tilted date
stamp and one pull-quote — and adding art there would break the Quiet Playroom
budget the register system exists to enforce.

### Typography

The 15-page identical-h1 problem is fixed by giving pages a register rather than
by scaling everything up.

| Register | Pages | h1 |
|---|---|---|
| Hero | `/` | `clamp(2.4rem, 6vw, 3.9rem)`, weight 900, `-0.03em` |
| Hub | 7 section hubs | `clamp(1.9rem, 4vw, 2.8rem)`, weight 900 |
| Article | Learn, trust pages | `1.55rem`, weight 900 |
| Detail | guide/toy/org detail | `1.5rem`, weight 800 |

Nunito throughout — no new typeface, so mobile parity holds. Letter-spacing floor
is `-0.03em`; nothing tighter. Body measure stays capped at `max-w-prose`.

### Register by page class

Not every page gets the full treatment. This is how Playroom stays credible to
professional audiences.

- **Full Playroom** — homepage and all 7 hubs, with the three pillar hubs given
  the most weight. Backdrop, tilt, section colour, photo slots.
- **Quiet Playroom** — Learn articles, trust pages, org and contributor
  profiles. One backdrop shape, one accent element (a tilted date stamp or a
  single tinted pull-quote), upright cards, no tilt on body content.
- **Plain** — `/organizations/[id]/projects/[tutorialId]` and other data-dense
  detail views. Section colour in the header only; otherwise unchanged.

The prose-page treatment is carried mostly by **editing, not decoration**: a
breadcrumb, a human-voiced heading, and one idea given a box. Verified against
the privacy policy in the design mockup.

### Motion

One library: **Motion for React**, imported as `m` under `LazyMotion` with
`domAnimation` — ~4.6 kB initial rather than 34 kB. Rejected: GSAP (second
library for the same job; Motion's `useScroll` covers the scroll work) and
Three.js (~600 kB, largely invisible to assistive tech, wrong for an audience on
older devices).

| Moment | Normal | Reduced motion |
|---|---|---|
| Button press | Squash 4px, spring `cubic-bezier(0.34,1.56,0.64,1)` | Colour change only |
| Cards on load | Settle into tilt, 60ms stagger | Appear upright, no tilt |
| Card hover | Straighten to 0°, lift 5px | Shadow deepens |
| Backdrop shapes | Slow parallax drift on scroll | Static |
| Page transition | Cross-fade 180ms | Cut |

**Tilt and depth are CSS, not JS.** They render correctly server-side with no
hydration. Motion is used only for entrance stagger, hover and scroll. A visitor
with JS disabled gets the full visual design, minus animation.

`prefers-reduced-motion` is honoured at two levels: a global CSS block that
neutralises transitions and transforms, and `useReducedMotion()` guarding
Motion's variants. The reduced path is a designed state, never a dead stop.

## Components

**New (4)**

| Component | Purpose |
|---|---|
| `lib/tone.ts` | `toneClass(tone)` — the one place tone maps to classes |
| `components/playroom-backdrop.tsx` | Decorative shapes, `aria-hidden`, tone-tinted |
| `components/tilt.tsx` | Client wrapper: deterministic rotation + entrance stagger |
| `components/pull-quote.tsx` | The single accent element for Quiet Playroom pages |
| `components/slot.tsx` | `Sticker` and `Slot` — the placeholder family above |

**Modified (12)**

`app/globals.css` (button depth, tone utilities, tilt utilities, reduced-motion
block, `.public-shell` width) · `lib/public-nav.ts` (add `tone`, add `art`) · `app/layout.tsx` (LazyMotion
provider) · `components/nav.tsx` (tone dots) · `components/public-footer.tsx` ·
`components/hub-grid.tsx` (varied sizes, tone, tilt) ·
`components/launcher-grid.tsx` (pillar tiles large, supporting tiles small — the
hardcoded `lg:grid-cols-6` goes) ·
`components/prose-page.tsx` (breadcrumb, stamp, backdrop) · `components/coming-soon.tsx` ·
`components/tutorial-card.tsx` · `components/toy-library-card.tsx` ·
`components/impact-card.tsx`

**Page files** change only where a page hardcodes its own h1 classes — the
register system replaces those. Most of the 42 pages inherit their new look
without being edited, which is why "all 40" is affordable.

**New pages (3)** — `/printing` hub, `/printing/requests`, `/printing/parts`;
plus `/printing/basics` moved from `/learn/3d-printing-basics`.

**Config:** `next.config.ts` gains a permanent redirect
`/learn/3d-printing-basics → /printing/basics`.

**Dependency added:** `motion` (one).

## Accessibility

Non-negotiable, and the reason several choices above look conservative. The
audience includes children with vestibular, photosensitive and cognitive
conditions.

- Every tone pair verified ≥4.5:1 for body text, ≥3:1 for large text, **by test**
- `prefers-reduced-motion` honoured on every animation, with a designed fallback
- No animation loops longer than 5s without a pause control (WCAG 2.2.2)
- No parallax on text — backdrop shapes only
- Tilt removable with zero layout consequence; verified by a test that disables
  transforms and asserts the grid still reads in order
- Focus rings preserved on every tilted or animated element
- Backdrop shapes `aria-hidden` and non-interactive
- Existing skip-link and `aria-current` behaviour preserved

## Testing

- **Unit (vitest):** `toneClass` mapping; `Tilt` renders upright, un-transformed
  markup; `PlayroomBackdrop` is `aria-hidden`; `ProsePage` breadcrumb resolves
  via `sectionFor`; every tone pair passes a contrast assertion computed in-test
- **E2E (Playwright):** one `<header>` per public page (the invariant established
  2026-08-19); `TOP_LEVEL` grows to **7** sections and each must still resolve to
  real content with no `Not built yet`; `/learn/3d-printing-basics` must redirect
  permanently to `/printing/basics`; all 42 public routes return <400 and render
  an h1; reduced-motion
  emulation produces no transforms; keyboard tab order matches visual order on a
  tilted grid
- **Visual:** screenshots of the homepage, one hub, one Learn article and the
  privacy policy at 375/768/1280, in both motion preferences

The existing 622-test unit suite must stay green throughout.

## Risks

| Risk | Mitigation |
|---|---|
| Tilt breaks under zoom or long translations | Decorative transform over an upright grid; test asserts layout without transforms |
| Playroom reads unserious to funders | Register by page class — Impact and About get restraint |
| Motion harms sensitive users | Designed reduced-motion state for every interaction, tested |
| 42 pages is a large diff | Component-driven; most pages inherit. Phase by register |
| A pillar hub that advertises unbuilt features | `/printing` ships with a live child and real explanatory copy; only its sub-features are marked `soon` |
| Seven sections crowd the top bar | The bar already uses `flex-wrap` and drops to its own row on narrow screens. No dropdown — the zero-`aria-expanded` rule stands |
| Moving a live article breaks links | Permanent redirect in `next.config.ts`, asserted in E2E |
| Tone colours fail contrast | Computed contrast assertions in unit tests, not eyeballing |

## Non-goals

- No new typeface, no new brand colours, no change to the mobile app
- No change to authenticated product UI or `AppShell`
- No 3D, no GSAP, no shadcn/Radix — none is needed for this
- No new copy beyond page headings and the prose-page edits named above, **with
  one exception**: the `/printing` hub and its two scaffold children need real
  copy written, because a pillar cannot be introduced by a placeholder
- Real photography is out of scope; slots are ready for it
