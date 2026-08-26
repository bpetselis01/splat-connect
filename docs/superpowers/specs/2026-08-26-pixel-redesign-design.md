# Pixel: replacing Playroom as the public site's visual system

**Date:** 2026-08-26
**Status:** Design, awaiting review
**Scope:** The same 42 public-facing pages Playroom covered. No change to authenticated product UI.
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
  with tilt itself; the new one is shadow depth and display type: Quiet drops `Jersey 10` headings
  back to `Nunito` and shrinks the hard shadow from 4–6px to 2px. Flag this for explicit review —
  it's the one judgment call in this spec not directly confirmed against the board.

## The design system

### Tokens

| Token | Value | Notes |
|---|---|---|
| Canvas | `#eaf4fa` + tints `#d8ecf7`/`#dcedf6`/`#c6e0ed`/`#bfe4f5` | Unchanged ground from Playroom |
| Ink | `#12283a` | Text, 2–3px solid borders, hard offset shadows — used ~180× in the board, almost entirely as text/border/shadow, not background |
| Display type | `'Jersey 10'` | New. Pixel/bitmap display font, headings only |
| Body/label type | `Nunito`, `IBM Plex Mono` | Unchanged from Playroom |
| Corner radius | 2–10px typical (up to 20px on a few elements) | No large rounding; consistent with a crisp pixel read |
| Depth | Hard offset shadow, 4–6px, zero blur | Replaces tilt+lift entirely as the system's depth cue |
| Accent tones | Rust `#8c3312`, amber `#7a4e05`/`#fdeecb`, green/mint `#0f5c4d`/`#2fbf9f`, orange/coral `#ff8f5e`/`#ff8a80`, blues `#0a4f70`/`#0f6f9c`/`#1998d5` | Replaces Playroom's tone set. Exact per-section (Guides/Toy Library/Printing/Impact/etc.) mapping to be confirmed against the board at implementation time, not guessed here |

### Shape (no tilt)

Cards render in an ordinary upright CSS grid — same invariant Playroom had ("remove every
transform and the page is correct"), except now there is no transform to remove. Depth is carried
entirely by the border + hard shadow pair; hover/press states animate shadow offset, not rotation.

### Register by page class

Same three tiers as Playroom, re-skinned:

- **Full Pixel** — homepage and all 7 hubs. Full border/shadow depth, `Jersey 10` display
  headings, backdrop shapes, photo slots.
- **Quiet Pixel** — Learn articles, trust pages, org and contributor profiles. Shadow depth
  reduced to 2px, `Nunito`-only headings (no `Jersey 10`), one accent element, no backdrop shapes.
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

- No change to authenticated product UI or `AppShell`
- No 3D, no GSAP, no shadcn/Radix
- No new copy — this is a chrome/token swap on settled IA and content
- Real photography/pixel-art illustration is still out of scope; slots stay placeholder-ready
