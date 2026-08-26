# Pixel: the page-template walk

**Date:** 2026-08-27
**Status:** Design, awaiting review
**Follows:** `2026-08-26-pixel-redesign-design.md` (the system) and
`2026-08-26-pixel-redesign-foundation.md` (the shared layer, shipped)
**Corrects:** two decisions in the 2026-08-26 spec — see *Corrections* below

## Why this exists

The foundation plan shipped the shared layer and said so explicitly:

> A follow-on plan covers the page-template walk (nav pills, footer,
> hub-grid/launcher-grid card shape, prose-page register, `tutorial-card`/
> `toy-library-card`/`impact-card` treatment, `border-radius` sweep) once this
> lands and is checked against the board.

This is that follow-on. It is why the site does not yet look like the board:
the templates were deferred, not missed.

## Source of truth

`Home (Pixel Art).dc.html`, imported from Claude Design project
`2ab72ed1-f036-4478-8f43-f9c305f240aa` and committed alongside this spec.

This supersedes the bundled `2026-08-26-pixel-redesign-board.html` as the
working reference. Both render the same design, but the bundled file is a
compiled export whose values had to be reverse-engineered by grepping for hex
literals. The `.dc.html` artboard is literal HTML with inline styles — every
value is readable directly. **Re-read the artboard when implementing each
screen. Do not reconstruct from this document.**

Ruling from Byron, 2026-08-27: **where the artboard and the 2026-08-26 spec
disagree, the artboard wins.**

## Corrections to the 2026-08-26 spec

### 1. Jersey 10 is a numeral face, not a display face

The 2026-08-26 spec says *"Display type: 'Jersey 10' — Pixel/bitmap display
font, headings only"*, and *"Quiet drops Jersey 10 headings back to Nunito"*.
The foundation implemented that: `globals.css:311` puts it on `.title-hero`,
`:540` on `.step-pixel`.

The artboard disagrees. Across all twelve screens:

- **`Jersey 10`: 3 occurrences.** All three identical — the homepage hero stat
  chips (`2 guides` / `1 toys delivered` / `3 contributors`), at 22px/700.
- **`Nunito`: 123 occurrences.** Every `h1`, `h2` and `h3` on every screen,
  including the homepage hero and the step badges.

Jersey 10 is what a *number that is doing work* is set in. Nothing else. Both
current call sites are wrong, and the one correct use does not exist yet.

This is the single largest reason the site reads as a different design: the
headline typeface is wrong at `clamp(2.4rem, 6vw, 3.9rem)`.

### 2. Scope extends to the dashboard front door and the auth screens

The 2026-08-26 spec bounds the work at 42 public pages and lists
`/dashboard`, `/login`, `/signup` as *"out, and not to be touched"*.

The artboard draws them. Byron's ruling: implement everything the board draws.

The blast radius is smaller than the old boundary implies. The board's
"My SPLAT" is the **front-door grid only** — eight cards that already have
their own approved design (`2026-08-23-my-splat-front-door-design.md`) and
that inherit `.card-pixel` for free. `AppShell`, `ShellFrame`, the rail and
`lib/nav-model.ts` remain out of scope. The auth screens are bare centred
cards with no chrome at all.

Revised scope: **42 public pages + `/dashboard` + `/login` + `/signup` = 45.**

## The board's complete vocabulary

Extracted by counting every literal in the artboard. This is the whole
system — nothing outside this table appears anywhere in the design.

| Axis | Values drawn | Notes |
|---|---|---|
| Hard shadow | `6px` · `5px` · `4px` · `3px`, always `Npx Npx 0 #12283a` | **No 2px shadow exists.** 2px is a pressed state only, which is why nothing rests there |
| Radius | `10` · `8` · `6` · `20` · `4` · `2` | Six values, not two |
| Border | `3px solid` (structural) · `2px solid` (chip/input) · `2px dashed` + `3px dashed` (art slots) · `1px solid` (SOON badge) | |
| Display face | `Jersey 10`, 22px/700 | Numerals only, 3 uses |
| Heading face | `Nunito` 900 (h1, hero) / 800 (h2, h3) | Everything |
| Meta face | `IBM Plex Mono` | 12px nav · 11px backlinks and chips · 9–10px card labels |
| Secondary depth | `4px 4px 0 rgba(18,40,58,0.35)` | One use: the hero's secondary button |

Depth reads as a ladder: `6` hero pillars and the auth card · `5` ordinary
cards and stat tiles · `4` buttons · `3` chips.

### Palette

Unchanged, and confirmed complete. Every hex in the artboard already exists as
a named custom property, including the three that look unusual:
`#dcedf6` = `--color-sunken`, `#bfe4f5` = `--color-brand-soft`,
`#c6e0ed` = `--color-line`. The only untokenised value is `#8aa7b8`, the input
placeholder colour, used once.

### Tone map, read off the board

| Section | Card fill | Deep |
|---|---|---|
| Guides | `--color-brand-tint` | `--color-brand-deep` |
| Toy Library | `--color-mint-soft` | `--color-mint-deep` |
| 3D Printing | `--color-apricot-soft` | `--color-apricot-deep` |
| Learn | `--color-honey-soft` | `--color-honey-deep` |
| Get Involved | `--color-brand-soft` | `--color-brand-dark` |
| Impact | `--color-sunken` | `--color-brand-deep` |
| About | white | `--color-muted` |

## Grouped hub children — already done

`HubGrid` currently contradicts the board deliberately, and says so:

> "Giving every card the tone turned a hub into a wall of one hue — six honey
> rectangles on Learn — which is monotony rather than identity."
> "six dashed rectangles on a six-card hub reads as six broken images, where
> six small discs read as a set of stamps."

The board does the opposite on both counts: **every** child card takes the
section tint, and each carries a **rectangular** dashed art slot in the
section's deep colour.

The conflict dissolves on inspection. **The board never renders more than four
cards in one grid.** It splits a hub's children into labelled groups, so the
run the old code was avoiding never occurs. Both of its objections were
sound about a flat six-card grid, and neither applies to what was drawn.

The groups map onto the existing child order exactly, in source sequence — no
content is re-authored:

| Section | Children | Groups drawn |
|---|---|---|
| Learn | 6 | "Start here" [1–3] · "Going deeper" [4–6] |
| Get Involved | 7 | "Which one are you?" [1–3] · "Specific things you can do" [4–7] |
| 3D Printing | 3 | "In this section" [1–3] |
| Impact | 4 | "More in Impact" [1–4] |
| About | 4 | "More about SPLAT" [1–4] |

**Decision (revised 2026-08-27, after reading the hub pages): do nothing.**

The grouping already exists. Every hub page splits its own children and labels
the groups, and the headings already in the code match the board's copy word
for word:

| Page | Existing heading(s) | Board |
|---|---|---|
| `app/learn/page.tsx` | "Start here" / "Going deeper" | identical |
| `app/get-involved/page.tsx` | "Which one are you?" / "Specific things you can do" | identical |
| `app/printing/page.tsx` | "In this section" | identical |
| `app/impact/page.tsx` | "More in Impact" | identical |
| `app/about/page.tsx` | "More about SPLAT" | identical |

Each calls `HubGrid` once per group with a filtered slice, so **no grid on the
site renders more than four cards today**. The condition the board's
every-card-toned treatment depends on is already satisfied.

Adding a `groups` field to `NavSection` would move working, already-correct
grouping out of five pages and into the model to produce byte-identical
output. It is churn with a migration risk and no user-visible effect.
Rejected — as is the nested-items variant, for the same reason plus a derived
accessor.

The earlier draft of this spec called grouping "the only structural change in
the walk" and specified a `groups: {heading, blurb, count}[]` partition. That
was written before reading the hub pages and was wrong: the walk has **no
structural change at all**.

**Consequence for `HubGrid`:** the reversal is pure styling. Its `leadFirst`
prop and the `wide`/`spread` lead-card mechanic are deleted outright — the
board has no lead card, and the pages that pass `leadFirst={false}` today
(`learn`, `get-involved`) simply stop passing it.

## Templates

### Hub page

Shell `min(90%, 1400px)`, padding `36px 0 80px`.

Backlink (`← Home`, mono 11/700/.08em uppercase, muted, `margin-bottom:18px`)
· `h1` Nunito 900/32/−0.02em ink · intro Nunito 15/1.65 muted, `max-width:70ch`
· then per group: `h2` Nunito 800/19 ink (`margin:32px 0 4px`), blurb Nunito
13 muted (`margin:0 0 16px`), grid.

### Hub child card

`background: <tone fill>` · `border: 3px solid ink` · `radius: 10px` ·
`box-shadow: 5px 5px 0 ink` · `padding: 18px` (3-col) or `16px` (4-col) ·
`display:flex; flex-direction:column; gap:6px`.

Art slot: `height:120px` (3-col) / `100px` (4-col) · `2px dashed <tone deep>` ·
`radius: 6px` · `background: rgba(255,255,255,0.5)` · centred label,
mono 9/700/.06em uppercase in tone-deep.

`h3` Nunito 800, 15px (3-col) / 14px (4-col), **in tone-deep** · optional SOON
badge · blurb Nunito 13/12 always `--color-muted`.

**No lead card. No arrow.** Both are deleted — the board has neither.

### Filter chips

`padding: 8px 14px` · `2px solid ink` · **`radius: 20px`** — chips are the one
place the pill survives, and are explicitly *excluded* from the `9999px` sweep
· mono 11/700/.04em uppercase.
Active: ink fill, white text, **no shadow**. Inactive: white, `3px 3px 0 ink`.

### Empty state

`2px dashed --color-line` · `radius: 10px` · white · `padding: 56px 20px` ·
centred · 44px circle icon with a `3px --color-muted` border · title Nunito
800/15 ink · body Nunito 13 muted `max-width:32ch`.

### Narrative row (3D Printing, About)

Alternating `1.25fr 0.75fr` / `0.75fr 1.25fr`, `gap:40px`, `align-items:center`,
`margin-top:36px`. Prose side: `h2` Nunito 800/19, body Nunito 14/1.65 muted.
Art side: `3px dashed <tone deep>` · `radius:10px` · tone fill · 14px dot-grid
overlay · heights 150–240px.

### Home

Hero on `--color-brand-tint`, `border-bottom: 4px solid ink`, 16px radial
dot-grid at 16% alpha, two columns `1.05fr 0.95fr`. Eyebrow mono 12/600/.16em
brand-deep · `h1` **Nunito 900** `clamp(38px,5.5vw,58px)`, second line
mint-deep · body 17/1.6 muted `max-width:44ch` · primary button apricot with
`4px 4px 0 ink`, secondary white with `4px 4px 0` at 35% · three stat chips
(`2px solid`, `radius 8`, `3px 3px 0`) whose **numerals are the only Jersey 10
on the site**.

Then three launcher pillars (`min-height:360px`, `6px 6px 0`, 170px art slot,
46px Nunito 900 numeral bottom-left, glyph bottom-right), four secondary cards
(`5px 5px 0`, `min-height:118px`), and the "SPLAT in 30 seconds" strip — three
steps, 44px `radius-8` badges in **Nunito 900/18**, joined by a `2px dashed
--color-line` connector.

### My SPLAT

Front door only. `h1` Nunito 900/32 · intro 15/1.65 muted `max-width:60ch` ·
4-column grid of the eight non-admin `nav-model` items as `.card-pixel` in
brand-tint with 84px art slots. Inherits the shared card; almost no new CSS.

### Sign in / Sign up

No chrome — the header is suppressed. Centred logo lockup, then a segmented
`Sign in` / `Create account` toggle (`3px solid ink`, `radius 8`, `4px 4px 0`,
`overflow:hidden`, active segment ink-filled), then the form card: white,
`3px solid ink`, `radius 10`, `6px 6px 0`, `max-width:380px`, `padding:30px`.
Inputs `2px solid ink`, `radius 6px`. Submit is the apricot button.

**The segmented toggle is new behaviour**, not restyling — the live pages
navigate between `/login` and `/signup` rather than switching in place. Called
out because it is the one place this walk changes an interaction, on a
signed-out flow.

## Derived surfaces

Four surfaces have no board coverage. Byron's ruling, 2026-08-27: derive them
from the board's style rather than leave them or wait for new artboards. Each
derivation below uses **only** values from the vocabulary table — nothing is
invented.

**The footer** (board draws none). Mirror the header, which it does draw:
white on `--color-canvas`, `border-top: 3px solid ink`, same `min(90%,1400px)`
shell, section links in mono 12/700/.06em uppercase ink each preceded by its
7px tone dot, grouped by section. The header is the only chrome the board
defines; a footer that is its reflection is the one derivation that adds no
new vocabulary at all.

**The 4 trust pages** — `/privacy`, `/terms`, `/safety`, `/code-of-conduct`.
The board has no long-form page, but the narrative rows on 3D Printing and
About *are* its prose vocabulary. A trust page is a backlink, `h1` 900/32, an
intro at 15/1.65 muted, then `h2` 800/19 and body 14/1.65 muted — on the
canvas, no cards, no shadows. `.stamp` (the date pill) takes the SOON badge's
exact treatment: `2px 7px`, honey-soft, `1px solid honey-deep`, `radius 4`,
mono 9/700/.05em — which also removes its tilt. `.pullquote` becomes a
brand-tint `.card-pixel` (`3px solid ink`, `radius 10`, `5px 5px 0`), likewise
untilted.

**The 6 detail routes** — `/tutorials/[id]`, `/toy-library/[id]`,
`/contributors/[id]`, and the three `/organizations/[id]` views. Backlink,
`h1` 900/32, a meta row using the filter chip at rest (white, `2px solid ink`,
`radius 20`, `3px 3px 0`), body 14/1.65 muted, and `.card-pixel` for grouped
blocks. Section colour in the header only — the 2026-08-26 spec's "Plain"
register, unchanged.

**Interaction states** (the board is static — it shows no hover, press or
focus). The depth ladder supplies them: hover moves a surface up one rung
(`5px → 6px`), press collapses the shadow to `0` while translating by its own
offset, so the edge sinks into the surface. This is already what
`globals.css` does for buttons; the walk extends it to cards. Reduced motion
keeps the depth change and drops the translate.

## Rotation

The board contains **zero** `transform: rotate()`. The foundation plan
knowingly left four in place, naming them for this follow-on. All four go:
`.pixel .nav-pill:hover`, `.stamp`, `.pullquote`, and `.lean` on the homepage
headline (`app/page.tsx:124`).

## Testing

- **Unit:** the tone map above renders the right fill and deep per section;
  no `HubGrid` call site renders more than four cards, which is the condition
  the every-card-toned treatment depends on;
  `.title-hero` is **not** in the display face; the three hero stat numerals
  **are**; every tone pair passes an in-test contrast assertion (≥4.5:1 body,
  ≥3:1 large).
- **E2E:** all 45 routes return <400 and render an `h1`; no element carries a
  rotation; reduced-motion emulation produces no translate.
- **Visual:** homepage, one hub, one trust page, `/dashboard` and `/login` at
  375/768/1280, checked against the artboard.
- The existing suite stays green throughout.

## Non-goals

- No change to `AppShell`, `ShellFrame`, the rail or `lib/nav-model.ts` beyond
  reading the front door's items
- No new copy — the board uses the repo's existing strings
- No pixel-art asset pipeline; slots stay placeholder-ready and
  `NEXT_PUBLIC_SLOTS=off` keeps working
- No admin or onboarding surface

## Risks

| Risk | Mitigation |
|---|---|
| Reversing `HubGrid` deletes reasoned work | Its two objections are recorded above and answered by the grouping finding, not dismissed |
| Deleting `leadFirst` touches every hub page that passes it | Only two do (`learn`, `get-involved`), both passing `leadFirst={false}`; removing the prop removes the call sites with it |
| Derived surfaces are 10 of 45 pages Byron has not seen | Each derivation is restricted to the vocabulary table and named in this spec; review them first at implementation |
| Auth gains a segmented toggle | Flagged as the one interaction change; revertible to two routes without touching the styling |
