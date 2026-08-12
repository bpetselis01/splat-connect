# Public web redesign — design

Date: 2026-08-13
Scope: `packages/web` public/marketing surfaces only.

## Goal

Raise the visual quality of the public web surfaces using a motion and component
toolkit, without changing what any page does. Layout and format may change;
routes, data flow, auth and functionality may not.

Out of scope: `/dashboard/*`, `/admin/*`, `/onboarding/*`, `/upload`. The mobile
package is untouched.

## Constraints

Stated by the user and binding on every decision below:

- Still professional looking.
- Layout and format may change.
- Functionality is maintained.

## The dual-render constraint

`app/layout.tsx:39` calls `AppShell({ children })`, and `AppShell` returns `null`
when `getCapabilities()` finds no session. Every route in scope therefore renders
two different chromes:

- Signed out: `components/nav.tsx` plus a `max-w-6xl` centred `<main>`.
- Signed in: the dark `brand-deep` rail from `components/shell-frame.tsx` wrapped
  around identical page content.

"Public marketing page" is consequently not a clean register split. A page cannot
be purely brand-register when half its traffic sees it inside product chrome.

**Decision.** Marketing surfaces take a `variant` derived from the session the
layout already fetches: a presentation treatment signed out, a compact treatment
signed in. Same components, same data, same routes, one branch on density and
motion intensity. No additional fetch and no new route.

**Full-bleed.** `main` is `mx-auto max-w-6xl px-4`, so nothing can currently break
out. A `.bleed` utility is added to `globals.css` using negative margins, opt-in
per section, and is a no-op inside the rail. The layout files are not
restructured — that would touch every authenticated page for no gain here.

## Design system position

`packages/web/app/globals.css` holds a deliberate, documented `@theme` block
ported from `packages/mobile/lib/theme.ts`, plus an extensive
`@layer components` set (`.btn`, `.card`, `.field`, `.chip`, `.badge`, `.panel`,
`.step-pill`, `.sticky-submit-bar`, `.dropzone`, `.shell`). All new work extends
these tokens and classes. None of it is replaced.

**No `shadcn init`.** KokonutUI and BKlit are shadcn-registry components, and
`init` writes a parallel token layer (`--background`, `--foreground`,
`--primary`, `components.json`, `cn()`, `tailwind-merge`, `clsx`, Radix peers).
Standing that up beside the existing `@theme` block would leave two competing
design systems, and every pulled component would style itself from the one that
does not match the brand. Those registries are treated as source material: pull
the component source, then port its classes onto the project's own tokens
(`bg-surface`, `text-ink`, `border-line`, `rounded-field`, `--ease-out-quart`).

## Dependencies

| Package | Scope | Loading |
| --- | --- | --- |
| `motion` | Site-wide | `LazyMotion` + `m` to keep the common-case payload near 6kb |
| `gsap` | `/` only | Dynamic import |
| `three` | `/printing` only | Dynamic import behind a static poster |

Not added: Lottie (no moment in scope justifies it), Radix, `tailwind-merge`,
`clsx`.

Five of the originally named items — `CloudAI-X/threejs-skills`,
`greensock/gsap-skills`, `zanwei/design-dna`, `lottiefiles/motion-design-skill`,
`AThevon/genjutsu` — are not installed as skills in this environment and were not
locatable. GSAP and Three.js are used as plain npm libraries instead. `design-dna`
and `genjutsu` are dropped; the existing token system already covers what a design
DNA layer would formalise.

## Motion system

Three tiers, deliberately unequal. Uniform motion is the tell of a
library-driven redesign.

- **Tier 1 — micro-interactions.** Hover, focus, press. Pure CSS, extending the
  existing `.btn` and `.card-link` behaviour. No JS. The majority of site motion
  by count.
- **Tier 2 — entrance and stagger.** `motion`'s `whileInView`, applied to section
  content and list grids selectively. The library grid staggers because it is a
  set arriving; tutorial detail does not, because the user navigated there to
  read one thing.
- **Tier 3 — signature moments.** Exactly two: the GSAP pinned sequence on the
  home hero, and the Three.js mesh on `/printing`.

### The blank-page hazard

Writing `initial={{ opacity: 0 }}` gates content visibility on JS. Transitions do
not fire on hidden tabs, and headless renderers can leave a section permanently
blank. With 90+ E2E tests asserting on visible content, a naive reveal breaks the
suite wholesale and presents as a test regression when it is a design defect.

**Decision.** A single `<Reveal>` component arms `initial` only after mount and
only when `useReducedMotion()` is false. Server output ships fully visible;
motion is strictly additive. Every reveal on the site routes through it, so the
hazard is solved once.

### Vocabulary

`lib/motion.ts` exports three things, not a catalogue:

- `riseIn` — 12px lift plus fade, ~320ms, on `--ease-out-quart`.
- `settleIn` — 0.98→1 scale plus fade, for media and cards.
- `stagger(index)` — child delay helper, **capped after ~8 items**. At 45ms per
  child an uncapped 40-item library grid cascades for 1.8s, so grid tails arrive
  together.

No bounce, no elastic. `prefers-reduced-motion: reduce` collapses tiers 2 and 3
to instant; the GSAP timeline never initialises and Three.js stays on its poster.

### Test interaction

Playwright's auto-waiting is asymmetric: **actions** (`click`, `fill`, `hover`)
wait for animation stability; **queries** (`boundingBox`, `evaluate`,
`textContent`) return immediately. `toBeVisible()` also ignores `opacity: 0`.

Consequently the only at-risk assertion in the whole suite is
`tests/e2e/responsive/reflow.spec.ts:63-66`, which reads two `boundingBox()`
values and asserts `Math.abs(first.y - second.y) < 4`. A staggered grid mid-flight
exceeds that tolerance.

**Decision (both, as defence in depth):**

1. List reveals are **fade-only** — no Y translate on grid children, so
   `boundingBox().y` is stable from first paint.
2. `reducedMotion: 'reduce'` is added to `use:` in `playwright.config.ts`, making
   the suite deterministic and exercising the reduced-motion path real users get.

GSAP `ScrollTrigger` pinning is scoped to desktop via `matchMedia`, which also
protects `reflow.spec.ts:42` at Pixel 7 width — and pinned scroll on a phone is a
poor experience independently of tests.

## Cross-cutting: emoji used as icons

`🔍 🛒 🎉` in the home steps, `🧸` as the tutorial-card and detail-page image
placeholder, `🔍` in the library empty state, `🏢` in the organisations empty
state. Emoji render differently per OS, do not inherit `currentColor`, and read
as unfinished. `components/icons.tsx` already holds a real SVG set powering the
rail; these are swapped to it.

All are `aria-hidden`, so no accessible name changes — but `getByText` matches DOM
text regardless of `aria-hidden`, so `tutorial-detail.spec.ts:44` needs its
locator updated.

## Page designs

### Home (`/`) — the one page that gets tier 3

The hero becomes the site's single drenched surface: full-bleed via `.bleed` when
signed out, brand as fill rather than the current `card-tint` box. The GSAP
pinned sequence attaches here, transitioning the hero into "How it works" so the
three steps assemble on scroll rather than sitting static. Desktop-only via
`matchMedia`, off under reduced motion, and the steps render complete and
readable with zero JS.

The existing "How it works" structure is kept — it is a genuine ordered sequence
with a connector line, which is when numbered markers are earned rather than
scaffolding.

**Constraint.** The three step headings keep accessible names ending `Browse`,
`Buy the parts`, `Adapt & play`; `home.spec.ts:13-15` matches with `$`-anchored
regexes.

### Library (`/library`) — restraint

A finding page; heavy motion hurts scanning. Fade-only stagger on the grid, a
denser card treatment, clearer visual grouping of the filter row.

**Constraint.** The `field`/`chip` controls, the `aria-live` count, the
`data-testid="tutorial-card"`, and the empty-state copy (`No tutorials found.` /
`Try a shorter search, or set the difficulty filter back to All.`) stay
byte-identical — five E2E tests depend on them.

### Tutorial detail (`/tutorials/[id]`) — full redesign

The page answers five real problems, not cosmetic ones:

1. The PDF is the product, and sits beneath photo, badges, title, description and
   contributors in the left rail.
2. Whether the build needs a 3D printer is invisible until the bottom section — a
   deal-breaker fact below the fold for a parent without a printer.
3. Parts, Tools and Files carry identical visual weight despite different
   consequence. Parts cost money and block the build; files are inert without a
   printer.
4. Buy links are `text-xs` inline text, well under the 44×44px touch minimum, on
   the page's most commercially important action.
5. Contributor credit is 12px grey text on a community-contributed project.

**Structure: Decide → Gather → Build.**

- **Zone A — Verdict.** Photo promoted from a 56-unit box in a narrow column to a
  wide banner, beside the verdict block on desktop and above it on mobile. Text
  stays on solid background rather than overlaid, so contrast is guaranteed
  regardless of the uploaded image. The block carries title, difficulty, org
  backing and description, plus a new **requirements strip** reading e.g.
  `6 parts · 3 tools · 3D printing required`. Every value derives from data the
  page already fetches (`parts.length`, `tools.length`, `stl_files.length > 0`) —
  no API change. The `Download Tutorial PDF` CTA sits here, satisfying the
  above-Parts ordering constraint by design.
- **Zone B — Gather.** Parts and Tools split into an asymmetric two-column layout
  on desktop, parts wider, stacking parts-first on mobile. Optional items dim and
  sort to the end of their list. Buy links become properly sized tappable targets,
  keeping their existing `aria-label` and `target`.
- **Zone C — Build.** `Files for 3D printing` retained, grouped with a restated
  CTA named `Download PDF` — not the exact string, so `reflow.spec.ts`'s
  `boundingBox()` call does not hit a strict-mode multiple-match error.
  Contributor attribution becomes a real credit block, preserving the `By <name>`
  text.

Motion here is tier 1 plus a single fade-only stagger on the parts list. No
sticky action bar.

**Constraints.** `Download Tutorial PDF` stays a unique accessible name and stays
above the `Parts needed` heading at phone width. The headings `Parts needed`,
`Tools needed`, `Files for 3D printing` keep those exact strings. Contributors
render as `By <name>`. `Optional` stays an exact-match badge. Buy links keep
`Buy <part> from <vendor>` and `target="_blank"`.

### Login / signup

These bypass the shell (`BARE_PREFIXES` in `app/layout.tsx:28`) and currently read
as unstyled by comparison. They get a split composition: form on one side, brand
surface on the other. No changes to form fields, validation or submit behaviour —
four E2E specs cover these flows.

### Legal (`/legal/contributor-terms`, `/legal/org-leader-terms`)

Typography only. Prose measure capped at 65–75ch, proper heading rhythm. Legal
text should be easy to read and boring to look at.

### `/toy-library`

Stays on `ComingSoon`. Not one of the three requested stubs, and its sentence is
pinned by `coming-soon.test.tsx` and `shell.spec.ts:351`.

## Stub pages

### `/printing` — designed stub with a Three.js moment

No test renders this page, so `ComingSoon` can be replaced here freely. The
component remains in the codebase for `/toy-library`.

The Three.js moment is a slowly rotating low-poly switch-mount — literal and
thematic, the actual object the service will print. It loads via dynamic import
behind a **static rendered poster image**, so the page is complete before any
WebGL initialises. It falls back to the poster permanently under reduced motion
or when WebGL is unavailable, and never blocks paint.

The page keeps `ComingSoon`'s honesty about not being live, with real layout
instead of a generic placeholder card, and keeps the existing three-step
explanation as designed content.

### `/challenges` — new route, mock data only

A board of design challenges: a parent posts what their child needs, a
contributor takes it up.

Cards carry the need, the context, and an open/claimed state. Two CTAs — **Post a
challenge** and **Take up this challenge**. Neither is wired: clicking opens a
native `<dialog>` (the existing `globals.css` pattern, no modal library) stating
the feature is not live and routing to the library. Buttons that silently do
nothing are worse than an honest dead end.

Mock challenges live in a local `const` in the route file. No table, no API, no
fetch — deliberately trivial to delete when the real spec lands. The data model,
claim-matching and persistence are explicitly deferred.

Knock-on changes: the `IconName` union in `lib/nav-model.ts` gains a member, with
a matching SVG in `icons.tsx`, and `tests/unit/lib/nav-model.test.ts` is updated
for the new Browse row.

### `/organizations` — public explainer, no live data

The route is not public today, and making it so is more than a visual change:

- `middleware.ts:90` lists `/organizations` in `signedInRoutes`; signed-out
  visitors are redirected to `/login`.
- `middleware.ts:117` also places it behind the contributor-terms gate.
- `packages/api/src/app.ts:46` mounts `/api/organizations` behind `authMiddleware`,
  and the handler uses `createUserClient(c.get('token'))` — a per-user client, so
  RLS resolves against the caller's identity. There is no anonymous path to this
  data. Auth here is structural, not a gate bolted on top.

**Decision.** `/organizations` gets a designed public page explaining what
organisations are and what backing means, with **no directory listing**. The real
directory stays signed-in and receives the same visual treatment. Zero middleware
change, zero API change, zero new data exposure — and it matches the user's
stated position that the public content is not yet decided.

A genuinely public directory would need a middleware change plus a new
`GET /api/public/organizations` with a reduced projection, and the "what is safe
to expose about an organisation" question deserves its own conversation.

## Error handling and degradation

- No JS, headless, or crawler: every page renders complete and visible;
  `<Reveal>` arms only after mount.
- `prefers-reduced-motion: reduce`: tiers 2 and 3 off; GSAP never initialises;
  Three.js stays on its poster.
- No WebGL: poster permanently.
- API unreachable: the existing `try/catch → []` fallbacks on `/` and `/library`
  are preserved verbatim; `/tutorials/[id]` keeps `notFound()` on a non-OK
  response.
- `/challenges` and public `/organizations` perform no fetch, so have no failure
  mode.

## Change ledger

No route changes, no API changes, no auth or middleware changes, no data-flow
changes.

Test-affecting changes, complete:

| File | Change | Why |
| --- | --- | --- |
| `tests/e2e/public/tutorial-detail.spec.ts:44` | `getByText('🧸')` → `getByTestId('toy-placeholder')` | Emoji-as-icon removal |
| `tests/unit/components/tutorial-card.test.tsx:84` | Same locator swap | Emoji-as-icon removal |
| `tests/unit/lib/nav-model.test.ts` | Add expected Challenges row | New nav destination |
| `playwright.config.ts` | `contextOptions: { reducedMotion: 'reduce' }` | Determinism for geometry assertions |

Every other spec passes unchanged.

Two corrections against the ledger as first drafted:

- `tutorial-card.test.tsx` also asserted on the emoji; the ledger listed only the
  e2e spec. Both are locator swaps, not behaviour changes.
- `reducedMotion` is not a top-level `use` key in Playwright 1.61 — it is a
  newContext option, so it sits under `contextOptions`.

Emoji still standing in as icons under `app/admin/` and `app/dashboard/toys/` are
left alone: those are product-register surfaces outside this scope. They should
be swapped, but as their own change.

## Verification

Per touched package, because vitest's transpile-only mode lets typecheck-only
bugs hide: `typecheck`, `lint`, `test:unit` and `test:e2e` on `packages/web`.
Only `packages/web` was touched; the workspace-wide `typecheck` passes for
`types`, `api`, `mobile` and `web`.

### Result

- `typecheck`: passes.
- `test:unit`: 398 passed, 66 files.
- `test:e2e`: 92 passed, 3 failed.
- `lint`: 21 errors, all pre-existing `no-explicit-any` in test files, none in
  any file touched here. Confirmed by stashing and re-running.

Two of the three e2e failures were reproduced on the base commit `af9d046` in a
throwaway worktree and are pre-existing, not regressions:

- `contributor/edit-tutorial.spec.ts:137` — the Parts step's `Name` field is
  never found, while the sibling Tools test at :165 passes through the same
  component. Sits squarely in the `EditItemsSection` refactor that landed in the
  five commits before this work.
- `dashboard/shell.spec.ts:126` — child profile add/edit/delete, times out.

The third, `contributor/upload-flow.spec.ts:8`, passed on re-run and is flake.

None of the three is on a surface this redesign touched.

### Environment notes

A first full run failed 40 of 95 with `Failed to create contributor: Database
error checking email`. That is GoTrue exhausting ephemeral sockets to Postgres
(`dial tcp 172.19.0.2:5432: connect: cannot assign requested address`), not an
application fault. Restarting `supabase_auth_splat-connect` and dropping to
`--workers=2` cleared it.

### One bug the type checker could not catch

`app/page.tsx` is a Server Component and initially passed icon component
functions as props to the client `HomeSteps`. `tsc` accepts that; the RSC
boundary rejects it at render, so every request to `/` threw and the e2e
webServer never started. The steps now live inside the client component. Worth
remembering: prop *types* crossing the server/client boundary are checked,
prop *serialisability* is not.
