# Pixel: replacing Playroom as the public site's visual system

**Date:** 2026-08-26
**Status:** Shipped as far as the foundation layer. **Two decisions below were corrected on
2026-08-27** — see `2026-08-27-pixel-page-templates-design.md`. Corrected passages are marked
inline; do not implement from them.
**Scope:** ~~The same 42 public-facing pages Playroom covered. No change to authenticated product
UI.~~ **Corrected 2026-08-27:** 45 pages — the 42 public pages plus `/dashboard` (front door
only), `/login` and `/signup`, all three of which the board draws. `AppShell`, `ShellFrame` and
`lib/nav-model.ts` remain out of scope.
**Supersedes:** `2026-08-20-playroom-public-site-design.md`. Playroom is fully shipped (homepage,
all 7 hubs, all 4 prose pages, nav, footer, cards, backdrop, tilt) — this is a replacement of a
live system, not a greenfield build.

## Why

Byron produced a bundled visual board — `2026-08-26-pixel-redesign-board.html`, committed
alongside this spec — showing a harder-edged, pixel/retro-game treatment of the same site.
Reviewed and confirmed as the new direction, full replacement, not an evolution layered on top
of Playroom.

## Source of truth

The board is the exact spec, pixel values included — same convention as Playroom's own mockups.
It is a bundled export (compiled JS, not literal CSS), so exact per-section colour and spacing
values were reverse-engineered by grepping the compiled bundle for hex/token literals rather than
reading markup directly. That extraction is good enough for the decisions below, but **is not a
substitute for re-reading the board directly before implementing each page** — re-extract, don't
reconstruct from this prose, same practice as the Playroom boards.

## Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Relationship to Playroom | **Full replacement** | Confirmed by Byron; Playroom's spec is retired |
| Scope | **Same 42 public pages** | No change to `AppShell`/dashboard/admin/auth |
| Motion | **Carry Playroom's principles, not its concrete moments** | Tilt, squash-spring and backdrop parallax are Playroom-specific visual metaphors that don't exist in a flat, hard-shadow system |
| Tilt | **Removed entirely** | Confirmed by Byron — no tilt anywhere, including on load/hover |
| Internal naming | **Rename `playroom` → `pixel`** | Confirmed by Byron; 13 source files affected (below) |
| Imagery | **Unchanged — `EditorialImage`/`slot.tsx` placeholder system carries over** | The board still uses the `placeholder` convention; no bespoke pixel-art asset pipeline needed |

## Scope boundary

Unchanged from Playroom: the 31 hrefs in `lib/public-nav.ts`, the homepage, the 4 trust pages
(`/privacy`, `/terms`, `/safety`, `/code-of-conduct`), and the 6 public detail routes
(`/toy-library/[id]`, `/tutorials/[id]`, `/contributors/[id]`, `/organizations/[id]`,
`/organizations/[id]/public`, `/organizations/[id]/projects/[tutorialId]`). 31 + 1 + 4 + 6 = 42.

**Out, and not to be touched:** `/upload`, `/notifications`, `/tutorials/[id]/edit`,
`/legal/contributor-terms`, `/legal/org-leader-terms`, and everything under `/dashboard`,
`/admin`, `/login`, `/signup`, `/auth`, `/onboarding`. `AppShell`, `ShellFrame` and
`lib/nav-model.ts` are out of scope entirely.

## Reuse before building

Still true, unchanged from Playroom:

- **`EditorialImage`** and **`components/slot.tsx`** (`Sticker`, `Slot`) — the placeholder family.
  Not reinvented. `NEXT_PUBLIC_SLOTS=off` still hides unfilled art.
- **`globals.css` component classes** (`.card`, `.card-link`, `.btn-accent`, `.badge`, `.chip`,
  ~40 others) — Pixel changes what these produce, not their existence or call sites.
- **`lib/public-nav.ts`** — still the single source of truth for the public surface and its tone.
- **`lib/tone.ts`** — still the single place tone maps to classes; the classes it maps to change.
- **Register by page class** (Full / Quiet / Plain) — the credibility mechanism that kept Playroom
  serious for therapists and funders carries over. Its old differentiator (tilt on/off) is gone
  with tilt itself; the new one is shadow depth alone. ~~Quiet drops `Jersey 10` headings back to
  `Nunito` and shrinks the hard shadow from 4–6px to 2px.~~ **Corrected 2026-08-27:** no register
  ever carried `Jersey 10` headings, so there is nothing to drop; and the board draws no 2px
  shadow anywhere — its ladder is 6/5/4/3, with 2px reserved for the pressed state. This passage
  was flagged in the original as the one judgment call not confirmed against the board, and it
  was indeed the one that was wrong.

## The design system

### Tokens

**Correction after cross-checking the live codebase:** every hex value found in the board already
exists as a named custom property in `app/globals.css` — `--color-brand: #1998d5`,
`--color-brand-dark: #0f6f9c`, `--color-brand-deep: #0a4f70`, `--color-brand-tint: #d8ecf7`,
`--color-apricot: #ff8f5e`, `--color-apricot-deep: #8c3312`, `--color-apricot-soft: #ffe3d5`,
`--color-mint: #2fbf9f`, `--color-mint-deep: #0f5c4d`, `--color-mint-soft: #d4f2ea`,
`--color-honey-soft: #fdeecb`, `--color-honey-deep: #7a4e05`, `--color-muted: #4d6a7d`,
`--color-ink: #12283a`. **The palette is not changing.** What's new is the shadow/border/radius
model applied to it, and the addition of a display font. `globals.css` already has a `.playroom
.btn-accent`/`.btn-primary` hard offset box-shadow rule (`0 6px 0 var(--color-...-deep)`, no
blur) — the pixel system generalises that existing pattern from buttons to cards, badges, chips,
and every other component still on `border-radius: 9999px` pills or the soft `--shadow-rest`/
`--shadow-lift` blur pair.

| Token | Value | Notes |
|---|---|---|
| Canvas | `#eaf4fa` + tints | Unchanged — not touched by this work |
| Ink / accent hex | Unchanged — see correction above | No new colours anywhere in the system |
| Display type | `'Jersey 10'` | ~~New. Pixel/bitmap display font, headings only~~ **Corrected 2026-08-27:** numerals only. The board uses it 3 times, all of them the homepage hero stat chips at 22px. Every heading on every screen is `Nunito`. |
| Body/label type | `Nunito`, `IBM Plex Mono` | Unchanged |
| Corner radius | 2–10px typical, replacing `9999px` pills and `1rem` soft cards | New shape language |
| Depth | Hard offset shadow (`Npx Npx 0`, zero blur) against `--color-ink` or a tone's `-deep` shade | Generalises the existing button pattern; replaces `--shadow-rest`/`--shadow-lift` and tilt+lift as the system's one depth cue |
| Placeholder text | `#8aa7b8` | The one possibly-new value found (input `::placeholder` colour) — confirm at implementation time whether an existing token already covers it |

### Shape (no tilt)

Cards render in an ordinary upright CSS grid — same invariant Playroom had ("remove every
transform and the page is correct"), except now there is no transform to remove. Depth is carried
entirely by the border + hard shadow pair; hover/press states animate shadow offset, not rotation.

### Register by page class

Same three tiers as Playroom, re-skinned:

- **Full Pixel** — homepage and all 7 hubs. Full border/shadow depth, backdrop shapes, photo
  slots. (~~`Jersey 10` display headings~~ — corrected 2026-08-27; headings are `Nunito`.)
- **Quiet Pixel** — Learn articles, trust pages, org and contributor profiles. Shadow depth
  reduced, one accent element, no backdrop shapes. (`Nunito`-only headings is not a
  differentiator — corrected 2026-08-27, every register uses Nunito headings.)
- **Plain** — data-dense detail views (`/organizations/[id]/projects/[tutorialId]` etc.). Section
  colour in the header only; otherwise unchanged.

### Motion

Same library, same accessibility posture as Playroom — only the concrete moments change:

| Moment | Pixel | Reduced motion |
|---|---|---|
| Button press | Shadow collapses to 0 as the button "sinks" toward its border | Colour change only |
| Card hover | Shadow grows (lift) or shrinks (press) | Shadow depth change only, no motion |
| Cards on load | Stagger in (60ms), no tilt-to-settle | Appear immediately |
| Backdrop shapes | Drop in, static once landed | Static, no drop |
| Page transition | Cross-fade 180ms | Cut |

`prefers-reduced-motion` stays a designed state, not a dead stop — same principle, same two
enforcement points (global CSS block + `useReducedMotion()` guards).

## Components

**Removed**

| Component | What happens to it |
|---|---|
| `components/tilt.tsx` | Rotation logic deleted. Its entrance-stagger responsibility is kept, simplified into whatever remains of the file (or `hub-grid.tsx`/`launcher-grid.tsx` directly) rather than rebuilt as a new file |

**Modified**

`app/globals.css` (button depth → hard-shadow press, tone utilities → new palette, drop tilt
utilities, add `Jersey 10`) · `lib/tone.ts` · `app/layout.tsx` (font loading) · `nav.tsx` ·
`public-footer.tsx` · `hub-grid.tsx` · `launcher-grid.tsx` · `prose-page.tsx` · `coming-soon.tsx` ·
`tutorial-card.tsx` · `toy-library-card.tsx` · `impact-card.tsx` · `playroom-backdrop.tsx` → renamed
`pixel-backdrop.tsx`, parallax removed, drop-in animation added.

**Renamed** (13 files, `playroom` → `pixel`): `app/layout.tsx`, `app/globals.css`,
`components/playroom-backdrop.tsx` → `components/pixel-backdrop.tsx`,
`components/toy-library-card.tsx`, `components/launcher-grid.tsx`, `components/tutorial-card.tsx`,
`components/prose-page.tsx`, `components/hub-grid.tsx`, `components/impact-card.tsx`,
`components/public-footer.tsx`, `tests/unit/components/playroom.test.tsx` →
`tests/unit/components/pixel.test.tsx`, `tests/e2e/public/playroom.spec.ts` →
`tests/e2e/public/pixel.spec.ts`. (Not all 13 necessarily rename the *file*; several just have
`playroom`-named identifiers/classes inside — audit each at implementation time.)

**No new components.** This is a token/style swap on Playroom's existing component architecture,
not a re-architecture.

## Accessibility

Unchanged constraints from Playroom, still non-negotiable:

- Every tone pair verified ≥4.5:1 body text / ≥3:1 large text, by test
- `prefers-reduced-motion` honoured on every animation, with a designed fallback
- No animation loops longer than 5s without a pause control
- Backdrop shapes `aria-hidden`, non-interactive
- Focus rings preserved on every animated element
- Existing skip-link and `aria-current` behaviour preserved
- Tilt-removal test (`Tilt` renders upright, un-transformed markup) becomes moot since tilt no
  longer exists — delete rather than keep as dead weight

## Testing

- **Unit (vitest):** `toneClass` mapping against new tones; `PixelBackdrop` is `aria-hidden`;
  `ProsePage` breadcrumb resolution unchanged; every tone pair passes a contrast assertion computed
  in-test; rename `playroom.test.tsx` → `pixel.test.tsx` and drop tilt-specific assertions
- **E2E (Playwright):** all 42 public routes still return <400 and render an h1 (unchanged
  invariant); reduced-motion emulation produces no transforms; rename `playroom.spec.ts` →
  `pixel.spec.ts`
- **Visual:** screenshots of the homepage, one hub, one Learn article and the privacy policy at
  375/768/1280, in both motion preferences, checked against the board
- The existing unit suite must stay green throughout

## Risks

| Risk | Mitigation |
|---|---|
| Hard shadows/thick borders read noisy on data-dense pages | Register by page class — Quiet/Plain tiers reduce shadow depth and drop display type |
| 42 pages is a large diff | Component-driven; most pages inherit from the shared layer, same as Playroom's own rollout proved out |
| Per-section tone mapping wasn't nailed down in this spec | Re-extract from the board directly before implementing the shared tone layer, not reconstructed from this document |
| Removing `tilt.tsx` breaks the entrance-stagger behavior hub/launcher grids depend on | Keep the stagger logic, only delete the rotation portion; test coverage for stagger stays |
| Renaming 13 files is real churn for a style-only change | Scoped as its own step in the implementation plan, not folded silently into visual changes |

## Non-goals

- ~~No change to authenticated product UI or `AppShell`~~ **Corrected 2026-08-27:** `AppShell` is
  still out, but the `/dashboard` front door and the two auth screens are in — the board draws them.
- No 3D, no GSAP, no shadcn/Radix
- No new copy — this is a chrome/token swap on settled IA and content
- Real photography/pixel-art illustration is still out of scope; slots stay placeholder-ready
