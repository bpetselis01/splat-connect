# Route audit — `/` (Phase 0)

Read on 2026-09-18 against `development` @ `4b0a29b1`. Everything below is copied
from the files, not remembered.

> **Read this first.** The brief that commissioned this audit describes a version of
> `packages/web` that no longer exists. `/` was rebuilt against the Soft Pop artboard
> on 2026-09-17 and does not render `LauncherGrid`, `HubGrid`, `Slot`,
> `SwitchAdaptedBear`, `.pixel-hero`, `.title-hero`, `.numeral`, `.stat-pixel`,
> `.step-pixel`, `.rise` or any `--radius-pixel-*`. Roughly half of Phase 0's reading
> list, and the whole premise of Phase 1's third bullet, are stale. §6 lists every
> divergence. §5 lists what is actually wrong with the page.

---

## 1. Component inventory

### 1.1 What `/` renders (`app/page.tsx`, 257 lines, async server component)

| Component | File | Props | Job |
| --- | --- | --- | --- |
| `StatChips` | `components/stat-chips.tsx` | `{ stats: Stat[]; className?: string }`, `Stat = { label, value, icon: ReactNode, tint }` | The three hero figures. Renders `.stat-chips` > `.stat-chip`. |
| `SplatMascot` | `components/splat-mascot.tsx` | `{ width?: number }` (default 300) | The waving bear SVG, lifted from the board. 17 lines. |
| `ScrollWorld` | `components/scroll-world.tsx` | none; `SCENES: Scene[]` is a module export | `'use client'`. Band 2 — the five-scene scroll-scrubbed flight. |
| `TutorialCard` | `components/tutorial-card.tsx` | `{ tutorial: Listed; save?: SaveProps }` where `Listed = Pick<Tutorial, 'id'\|'title'\|'difficulty'\|'kind'\|'toy_photo_url'> & …` | Two cards in the "Recent guides" row. `save` omitted here. |
| `ToyLibraryCard` | `components/toy-library-card.tsx` | `{ toy: ToyWithOwner; save?: SaveProps }` | Two cards in the "Recent toys" row. `save` omitted here. |

Everything else on `/` is inline markup: `.hero`, `.band--doors`, `.band--split`,
`.cost-card`, `.recent`. No `Slot`, no `HubGrid`, no nav-derived tiles.

The three doors are a **literal array inside `page.tsx`** (lines 74–108), not derived
from `PUBLIC_NAV`. They point at `/library`, `/toy-library`, `/get-involved` — the
two pillar catalogues plus the Get Involved hub — not at three Get Involved children.

### 1.2 What the shell renders around it (`app/layout.tsx`, 162 lines)

| Component | Props | Job |
| --- | --- | --- |
| `Nav` | `{ caps: Capabilities \| null; quiet?: boolean }` | `'use client'`. The one top bar. `quiet` = account-section register. |
| `PixelBackdrop` | `{ tone: Tone }` | Section-coloured shapes behind `<main>`. |
| `Breadcrumb` | none | `'use client'`. Suppressed on account routes with no session. |
| `PublicFooter` | none | Fat footer, maps `PUBLIC_NAV` + `FOOTER_LEGAL`. |
| `BackToMySplatDock` | `{ signedIn: boolean }` | `'use client'`. |

Two render branches, keyed on `isBare(pathname)` — `/login`, `/signup`, `/auth`,
`/onboarding` and their children. The bare branch keeps the `.pixel` ancestor, the
skip link and the `<main>` landmark; it drops `Nav`, `PixelBackdrop` and
`PublicFooter`. `isBare` and `isAccountRoute` are exported for tests because the
layout is async and reads `headers()`.

Both branches wrap in `<div className="pixel">` and put `.public-shell` on `<main>`.

**`nestsRail` does not exist in `lib/public-nav.ts`.** The rail was retired on
2026-09-17 ("replaces the old sidebar entirely" — the artboard's hub note). There is
now exactly one chrome arrangement for every non-bare route. `nestsRail` survives as
a name in `components/nav.tsx` and `tests/unit/app/layout-chrome.test.tsx` only.

### 1.3 Fonts (`app/layout.tsx`)

Three `next/font/google` families, **not** the three the brief names:

- `Nunito` 400/500/600/700/800, normal+italic → `--font-nunito` → `--font-sans`. Body and UI.
- `JetBrains_Mono` 400/500/700 → `--font-jetbrains` → `--font-mono`. Replaces IBM Plex Mono. Deliberately not named `--font-mono` at the variable, because that is the Tailwind theme key and a token resolving to itself resolves to nothing.
- `Baloo_2` 600/700/800 → `--font-baloo` → `--font-display`. Every heading. **Replaces Jersey 10**, which was numerals-only and opt-in per page.

### 1.4 `lib/capabilities.ts`

`getCapabilities()`, wrapped in React `cache()`. `GET /api/contributors/me` — a throw
means no user, returns `null` (not degradable). Then three parallel fetches, each
degrading to capability-absent: `/api/organizations/mine` → `[]`,
`/api/notifications/me/unread-counts` → zeros, `/api/toy-transactions/action-count` → 0.
Returns `{ profile, isAdmin, ledOrgs, unread, exchangeActions }`. There is no
`isParent`; the comment explains it was removed because nothing branched on it and it
cost every signed-in page a round trip.

`/` itself never calls it — only the layout does.

---

## 2. Class vocabulary

All values copied from `app/globals.css` (131,947 bytes — the brief says ~82 KB).

### 2.1 Radii — four, not six

```
--radius-field: 14px;   /* inputs, small controls; 8 consumers, guarded by pixel-tokens.test.ts */
--radius-inset: 18px;   /* icon tiles, stat chips, speech bubble */
--radius-card:  24px;   /* doors, cost cards */
--radius-pill:  999px;  /* every button, badges */
```

No `--radius-pixel-*` exists. The name survives on three comment lines (30, 425, 1315,
1812) as history. Stale build output under `.next-parity/` still contains the old CSS —
**do not grep that directory**; it is what makes `.stat-pixel` and `.step-pixel` appear
to still exist.

### 2.2 Elevation — four, plus two effects. No hard/offset shadows anywhere.

```
--shadow-e1:   0 1px 2px   rgba(28,37,48,.06);
--shadow-e2:   0 4px 12px  rgba(28,37,48,.08);
--shadow-e3:   0 12px 28px rgba(28,37,48,.10);
--shadow-e4:   0 24px 48px rgba(28,37,48,.14);
--shadow-glow: 0 8px 20px  rgba(25,152,213,.28);
--shadow-hi:   inset 0 1px 0 rgba(255,255,255,.7);
--border-width: 1px;
```

### 2.3 Colour

```
--color-canvas #faf9f7   --color-surface #ffffff   --color-sunken/-surface-quiet #f3f1ed
--color-brand #1998d5    --color-brand-dark #1179b0 --color-brand-deep #0f5f8c
--color-brand-soft/-tint #dcf0fb   --color-brand-50 #f0f9ff
--color-brand-200 #b9e1f7 -300 #87cdf0 -400 #4fb4e6 -800 #124f73 -900 #14425f -950 #0d2a3f
--color-ink #1c2530      --color-muted #5a6675    --color-line rgba(28,37,48,.09)
--color-apricot #ff8a5c / -soft #ffe9de
--color-mint    #12b3a6 / -soft #d9f4f1
--color-honey   #ffb020 / -soft #fff0cc
--color-violet  #8b6df0 / -soft #ece6fc
--color-success #2f9e6b / -soft #dff3ea / -deep #237e51 (5.03:1, for white text)
--color-warning #e8a317  --color-danger #e05252 / -soft #fde3e3
```

`brand` is 3.2:1 on white → borders, rings and tints only; `brand-dark` carries white
labels. Same split on `success`: the board's `#2f9e6b` under white measures 3.37:1, so
`success-deep` exists for that case.

### 2.4 Artboard aliases (`@layer base`, on `body`)

`--canvas --surface --surface2 --ink --muted --line --bw --brand --b600 --b700 --b100
--b50 --brand-50…-950 --onbrand --focus --coral --ok --tcoral --tmint --tink` etc.
Declared on `body`, not `:root`, so `body[data-mode='dark']` and `body[data-mode='hc']`
can re-point them. Markup lifted verbatim from the `.dc.html` works because of this.

### 2.5 Buttons

```
.btn            48px min-height, 0 20px, --radius-pill, 15px/800 Nunito,
                1px solid transparent, transition 180ms --ease-out-quart
.btn:active     transform: scale(.96)  (= mobile's motion.pressScale)
.btn:focus-visible  outline: 3px solid var(--color-ink); outline-offset: 2px
.btn-primary,
.btn-accent     52px, 16px, bg --color-brand-dark, --color-surface text,
                box-shadow: var(--shadow-glow), var(--shadow-hi)
.btn-quiet      44px, bg --color-surface, border --color-line, --color-ink,
                box-shadow: var(--shadow-e1)
.btn-hero       56px, padding-inline 28px, 17px, gap 10px
.btn-lg         52px, 16px
.btn-sm         36px, 0 14px, 13px
.btn-soft       bg --color-brand-tint, --color-ink
.btn-danger     surface + --color-line border + --color-danger text + --shadow-e1
```

Control heights actually in the file: **36 / 44 / 48 / 52 / 56** — five, not four.
`.btn-accent` is aliased onto `.btn-primary`: Pixel made apricot the primary and 58
call sites followed it there; both now point at blue. There is no apricot button on
the board's states sheet.

### 2.6 Shell

```
.public-shell   width: min(100% - 4rem, 1280px); margin-inline: auto
@media (max-width: 639px) .public-shell { width: calc(100% - 2rem) }
```

`.shell-rail` survives only in `tests/e2e/dashboard/navigation.spec.ts` (stale).
`.shell-main` does not exist anywhere.

### 2.7 Classes `/` actually uses

```
.hero            grid, 1col → (≥900px) 1.1fr/0.9fr, gap 40→48, padding 72px 0 56px,
                 (≥900px) min-height calc(100vh - 70px)
.hero__blobs     absolute, full-bleed via left:calc(50% - 50vw); width:100vw;
                 3 spans, border-radius 50%, @keyframes blob 18s/22s reverse/26s
.hero__copy      flex column, align-items flex-start, gap 20px           ← see §5.1
.hero__badge     pill, 8px 14px, 1px --color-line, --color-surface, --shadow-e1, 14px/700
.hero__title     --font-display, clamp(2.75rem, 5vw, 4.25rem), 800, 1.05, -0.02em, balance
.hero__accent    color: --color-brand-dark
.hero__lede      max-width 46ch, 19px/1.55, --color-muted
.hero__actions   flex wrap, gap 12px
.hero__mascot    flex column centre, gap 12px; ::before = 420px radial --b100 wash
.hero__bubble    max-width 26ch, 12px 16px, radius 18/18/18/4, --shadow-e3, 15px/700
.stat-chips      flex wrap, gap 12px, list-style none
.stat-chip       12px 18px 12px 12px, --radius-inset, 1px --color-line,
                 --color-surface, box-shadow --shadow-e2, --shadow-hi
.stat-chip__icon 40×40, --radius-field, color --tink
.stat-chip__value --font-display 24px/1 800, tabular-nums, --color-ink
.stat-chip__label 13px/600 --color-muted
.band            flex column, gap 20px, padding 64px 0 0; :last-of-type pb 64px
.band--doors     padding-top 40px
.band--split     grid 1col → (≥900px) 2col, gap 32→40
.title-band      --font-display 32px/1.1 800, -0.015em
.band__head      flex, align-items baseline, space-between, gap 16px
.band__body      max-width 36rem, margin 12px 0 20px, 17px/1.6 --color-muted
.door-grid       grid auto-fit minmax(240px,1fr), gap 20px → (≥900px) 1.2fr 1.2fr .9fr
.door            flex column, padding 28px, --radius-card, 1px --color-line,
                 --color-surface, box-shadow --shadow-e2, --shadow-hi
.door--quiet     background --color-sunken, box-shadow: none
.door__icon      56×56 grid place-items centre, --radius-inset, color --tink
.door__title     --font-display 26px/1.15 800, -0.015em  (.door--quiet → 22px)
.door__body      16px/1.5 --color-muted                  (.door--quiet → 15px)
.door__cta       inline-flex, gap 6px, margin-top auto, 15px/800, --color-brand-deep
.cost-card       padding 30px 32px, --radius-card, --shadow-e2 + --shadow-hi
.cost-card--mint background --color-mint-soft, color --tink
.cost-cta        52px, padding-inline 24px, --radius-pill, 15px/800
.cost-cta--light 1px --color-line on --color-surface, --color-ink
.cost-cta--ink   --color-ink fill, --color-surface text
.recent          flex column, gap 16px
.recent__row     grid 2 equal cols, gap 16px
```

### 2.8 The brief's classes that are still defined but unused by `/`

```
.title-hero, .title-hub, .title-article, .title-detail  → shared rule only:
                                                           color --color-ink; text-wrap balance
.eyebrow, .meta   → text-transform: uppercase
.numeral          → --font-display, 700, line-height 1
.lean             → inline-block; color --color-ink; transform rotate(-3deg)
.rise             → animation: pixel-rise .5s var(--ease-out-quart) both;
                    animation-delay: var(--rise-delay, 0ms)
.pixel-hero       → full-bleed canvas band with three radial washes
```

`.title-hub` and `.title-detail` are what `app/get-involved/page.tsx` uses. `.pixel` is
still on the body wrapper for rules further down the sheet; per-variant button rules no
longer need it, and the comment at ~line 570 explains why a `.pixel`-scoped border was
removed (specificity (0,2,0) was silently outranking the (0,1,0) variant rules).

`.stat-pixel`, `.step-pixel`, `Badge`, `StepPill`, `Dropzone`, `PixelPlaceholder` — none
exist in source.

---

## 3. Data flow

Three parallel calls in `HomePage`, all through one helper:

```ts
async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${process.env.API_URL}${path}`, { cache: 'no-store' })
    return res.ok ? ((await res.json()) as T) : fallback
  } catch { return fallback }
}
```

| Endpoint | Type | Fallback |
| --- | --- | --- |
| `/api/public/tutorials` | `Tutorial[]` | `[]` |
| `/api/public/toys` | `ToyWithOwner[]` | `[]` |
| `/api/public/impact` | `ImpactSummary` | `{ totals: EMPTY_TOTALS, recent: [], contributors: [], organisations: [] }` |

A non-ok response and a thrown fetch take the same path, so an unreachable API renders
zeros and empty rows rather than a 500.

**Where each value comes from:**

- **API** — the three stat figures (`totals.tutorials`, `totals.toysDelivered`, `totals.contributors`); the two door counts (`tutorials.length`, `toys.length`, with singular/plural agreement); the four recent cards (`.slice(0, 2)` of each list).
- **`PUBLIC_NAV`** — *nothing on `/`*. The page does not import `lib/public-nav`. The layout does, for `sectionFor(pathname)?.tone` and `ACCOUNT_NAV`.
- **Hardcoded in `page.tsx`** — all prose, the three door titles/bodies/hrefs/tints, both cost-card blocks, the two cost CTA hrefs (`/printing/basics`, `/get-involved/recycling`), the hero badge, title, lede, both hero CTA hrefs, the bubble line.
- **Hardcoded in `scroll-world.tsx`** — `SCENES`, the entire band 2 narrative.

Note the counts are honest by construction: the door CTA says "Browse N guides" from
the same array it links to, so the page cannot claim 142 when there are 7.

---

## 4. Relationship to Soft Pop

There are no Pixel/Soft Pop conflicts left on `/` or in its shell. The migration the
brief anticipates has already happened:

| Brief expects | Actual |
| --- | --- |
| Six `--radius-pixel-*` vs four Soft Pop radii | Four radii. `--radius-pixel-*` gone; name survives in four comments. |
| Jersey 10 vs Baloo 2 / Nunito / JetBrains Mono | Baloo 2 + Nunito + JetBrains Mono. Jersey 10 gone; `tests/unit/app/soft-pop-font.test.ts` guards it. |
| Hard/offset shadows on `.btn-accent`, `.stat-pixel`, `.step-pixel` | No offset shadow in the sheet. `.btn-accent` is an alias of `.btn-primary` (glow + inset hi). `.stat-pixel`/`.step-pixel` do not exist. |
| `Badge` / `StepPill` / `Dropzone` / `PixelPlaceholder` | None exist. (`components/badge.tsx` exists but is a different, Soft Pop component — not the Pixel `Badge` the brief means.) |
| IBM Plex Mono | Replaced by JetBrains Mono, at 400/500/700 because the system's stat figures and cost amounts are 700 and the browser was synthesising it. |

Guards already in the tree: `soft-pop-tokens.test.ts`, `soft-pop-font.test.ts`,
`soft-register.test.ts`, `no-playroom-references.test.ts`.

---

## 5. What is actually wrong with `/`

Measured against `Splat Connect frontend overhaul/SPLAT Connect - Web.dc.html`,
`data-screen-label="Home"` (board lines 143–173). Ranked.

### 5.1 The hero's vertical rhythm is flattened to a single 20px gap

`.hero__copy` is `flex-direction: column; gap: 20px`, so all four gaps are 20px. The
board sets them individually:

| Gap | Board | Live | Δ |
| --- | --- | --- | --- |
| badge → h1 | `margin:22px 0 0` | 20px | −2 |
| h1 → lede | `margin:20px 0 0` | 20px | ✓ |
| lede → actions | `margin-top:32px` | 20px | **−12** |
| actions → stats | `margin:40px 0 0` | 20px | **−20** |

The compounding 32px loss is why the hero reads as one dense block rather than
badge / headline / offer / proof. This is the single largest visual delta on the page.

### 5.2 Three entrance animations are missing

The board animates the hero in:

- copy column — `animation: rise .5s cubic-bezier(.2,.8,.2,1) both`
- mascot column — `animation: rise .6s .1s cubic-bezier(.2,.8,.2,1) both`
- speech bubble — `animation: pop .6s .5s cubic-bezier(.2,.8,.2,1) both`

`.hero__copy`, `.hero__mascot` and `.hero__bubble` carry none of these. The `.rise`
class and `@keyframes pixel-rise` already exist in `globals.css` with a `--rise-delay`
custom property, so the bubble's `pop` is the only new keyframe needed.

The two animations that *are* implemented — `blob` on the washes and `bob` on the bear
— match the board exactly.

### 5.3 The secondary hero button is one elevation step too low, and its icon is uncoloured

Board: `box-shadow: var(--e2), var(--hi)`, hover `--e3`, and the gift icon is
`color: var(--coral)`. Live: `.btn-quiet` is `--shadow-e1` with no `--hi`, and
`<Gift>` in `page.tsx` has no colour. Against a 52px glowing primary the secondary sits
visibly flatter than the board draws it.

Fixing this on `.btn-quiet` itself would change every secondary button in the app; the
board's e2+hi is specific to the hero pair, so it belongs on `.btn-hero` — which is
already hero-only.

### 5.4 Focus rings differ from the board on hero controls

Board hero buttons: `outline: 3px solid var(--focus); outline-offset: 3px`.
Live `.btn:focus-visible`: `outline: 3px solid var(--color-ink); outline-offset: 2px`.
`--focus` *is* `var(--color-ink)` in light mode, so only the 1px offset differs today —
but the offset is a real 1px and `--focus` diverges from ink under `data-mode` (see 5.5).

### 5.5 Latent: the stat-chip and door tints are mode-blind

`page.tsx` passes raw `@theme` values as inline `backgroundColor` —
`var(--color-brand-soft)`, `var(--color-mint-soft)`, `var(--color-apricot-soft)`,
`var(--color-violet-soft)`, `var(--color-honey-soft)`. The board uses the body aliases
`var(--b100)`, `var(--tmint)`, `var(--tcoral)`, which `body[data-mode='dark']`
re-points (`--tcoral: #4a2a1c`, `--tmint: #123d3a`) and `[data-mode='hc']` re-points
again. `.stat-chip__icon` and `.door__icon` set `color: var(--tink)` — which *is*
mode-aware. In dark mode that is `#e7edf2` over a fixed `#ffe9de` tint: near-invisible.

**This is not currently reachable.** Nothing in `app/`, `components/` or `lib/` sets
`data-mode`, and the selectors are attribute-only (no `prefers-color-scheme`), so both
alternate modes are dormant. It is a trap for whoever wires the toggle, not a live bug.
The fix is one-for-one: use the aliases the board uses.

### 5.6 `/` has no test

`tests/unit/app/` covers `about`, `get-involved`, `impact-hub`, `learn-hub`,
`learn-articles`, `design-challenges`, `scaffold-pages`, `trust-pages`,
`submit-explainers`, `signup-page`, `auth-confirmed`,
`onboarding-contributor-terms`, `layout-chrome`, and three token/font guards. The
densest page in the app has nothing — no unit test, no e2e spec. Nothing catches a
regression to the `getJson` fallback or to the door count agreement.

### 5.7 `components/launcher-grid.tsx` is dead

`LauncherGrid` (118 lines) and `LauncherTile` are imported by nothing except
`tests/unit/components/launcher-grid.test.tsx`. It was `/`'s tile grid before the
rebuild. It also holds one of two live imports of `components/slot.tsx`.

---

## 6. Where the brief and the repo disagree

Listed so the next pass doesn't re-derive it.

| Brief says | Repo |
| --- | --- |
| `/` derives tiles, tracks, blurbs and counts from `PUBLIC_NAV` | `/` does not import `lib/public-nav` at all. Doors are a literal array in `page.tsx`. |
| Read `packages/web/components/app-shell.tsx` | Does not exist. |
| Read `packages/web/components/rail.tsx` | Does not exist. The rail was retired 2026-09-17. |
| Read `packages/web/components/drawer-context.tsx` | Does not exist. |
| `lib/public-nav.ts` exports `nestsRail` | It does not. Exports are `PUBLIC_NAV`, `ACCOUNT_NAV`, `FOOTER_LEGAL`, `SCAFFOLD_KEYS`, `sectionFor`, `crossesAccountBoundary`, plus types. |
| Layout has `nestsRail` branch | Two branches, `bare` vs shell. One chrome arrangement for every non-bare route. |
| Three `next/font` families: Nunito, IBM Plex Mono, Jersey 10 | Nunito, JetBrains Mono, Baloo 2. |
| `globals.css` ~82 KB; `@layer components` at ~173, ~2013, ~2167 | 132 KB; many more `@layer components` blocks; the homepage's own are at ~2786 and ~3280. |
| Six `--radius-pixel-*` plus `--radius-field` | Four radii: field 14, inset 18, card 24, pill 999. |
| "Four Soft Pop radii and the four control heights" | Four radii ✓. **Five** control heights: 36, 44, 48, 52, 56. |
| `/` promotes the same three Get Involved tracks as the hub, filtering the same href list | `/` promotes `/library`, `/toy-library`, `/get-involved`. `TRACKS` exists only in `app/get-involved/page.tsx`. The consistency requirement in Phase 1 has no counterpart to stay consistent with. |
| Soft Pop migration is "a separate, explicitly-scoped pass" still to come | It landed on `/`, the layout and the token layer on 2026-09-17. |

One trap worth naming: `.next-parity/` contains a stale dev build whose CSS still has
`.stat-pixel`, `.step-pixel` and the Pixel radii. A repo-wide grep finds them there and
nowhere in source. Exclude that directory.

---

## 7. Open questions

1. **Is the Phase 1 brief still wanted as written?** Its rules are all satisfiable —
   `app/get-involved/page.tsx` already derives from `PUBLIC_NAV`, already matches by
   `href` rather than index, already renders `state` through `HubGrid`, and uses only
   tokens. Read literally, Feature 1 is a no-op. What is the actual complaint about
   `/get-involved`?

2. **§5.1–5.4 — in scope?** They are on `/`, not `/get-involved`, and the brief's
   standing rule says don't restyle what wasn't asked for. But "you're still not there"
   reads as being about `/`. Say which page you mean and I'll do that one.

3. **`data-mode`** — is a dark/high-contrast toggle planned? Two full palettes are
   defined and nothing reaches them. If it is planned, §5.5 should be fixed before the
   toggle ships; if it isn't, the ~50 lines of dormant palette are deletable.

4. **`launcher-grid.tsx`** — delete it, or is a caller coming back?

5. **Five control heights, not four.** Which four did the brief mean? 44 (`.btn-quiet`)
   and 56 (`.btn-hero`) are both in the sheet and both drawn on the board.

6. **`.rise` / `--rise-delay`** — still the sanctioned entrance mechanism, or superseded?
   The board uses bare `animation: rise …` inline; `globals.css` has the class. §5.2
   assumes the class.

---

**Stopping here per Phase 0.** No files changed. Nothing in Phase 1 opened.
