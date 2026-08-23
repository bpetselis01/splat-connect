# Signed-in navigation: one header that never moves

**Date:** 2026-08-21
**Status:** Design, awaiting review
**Scope:** `app/layout.tsx`, `components/nav.tsx`, `components/app-shell.tsx`,
`components/shell-frame.tsx`, `components/rail.tsx`, `lib/nav-model.ts`,
`lib/public-nav.ts`, and a new `/dashboard` hub page.
**Mockup:** `2026-08-21-signed-in-navigation-board.html`, beside this file —
open it in a browser. Six panels, built with the tokens from `globals.css` and
`lib/tone.ts`. Every layout claim below is drawn there.

## Why

Signing in deletes three quarters of the site.

`app/layout.tsx:70` computes `shell = bare ? null : await AppShell({ children })`.
When `AppShell` returns a shell — which it does for every signed-in account —
the branch below it never renders, taking `components/nav.tsx` (the seven public
sections) and `components/public-footer.tsx` (every section *and* every child)
with it. What replaces them is `components/rail.tsx`, whose `Browse` group in
`lib/nav-model.ts` carries four destinations: `/library`, `/toy-library`,
`/printing`, `/organizations`.

Everything under `/learn`, `/get-involved`, `/impact` and `/about` still renders
correctly while signed in. There is simply no link to any of it anywhere in the
signed-in UI.

The reported symptom was that submitting a toy idea requires signing out,
navigating to `/get-involved/submit-an-idea`, and signing back in to reach the
form. That is not a missing button on one page. `/get-involved/submit-an-idea`
is one of roughly twenty-five pages that are unreachable by navigation for
exactly as long as you are logged in.

**The proportions matter.** Counted 2026-08-21: **48 public `page.tsx`, 15 under
`app/dashboard`.** SPLAT Connect is a public content site with an account area
attached, not a SaaS product with a marketing site bolted on. The current
architecture is upside down.

## What the guidelines say

From the UX guideline set in `.claude/skills/ui-ux-pro-max` (§9 Navigation,
priority HIGH). Four rules bear on this directly:

| Rule | Statement | Today |
|---|---|---|
| `navigation-consistency` | Navigation placement must stay the same across all pages; don't change by page type | **Violated** — top bar becomes left rail at login |
| `persistent-nav` | Core navigation must remain reachable from deep pages; don't hide it entirely in sub-flows | **Violated** — the public tree is hidden outright |
| `nav-hierarchy` | Primary nav vs secondary nav must be clearly separated (MD) | **Violated** — no separation exists; both claim top level |
| `avoid-mixed-patterns` | Don't mix Tab + Sidebar + Bottom Nav at the same hierarchy level | Holds today, and **rules out two tempting fixes** |

That last rule is why the two obvious repairs are both wrong. Stacking the
public bar on top of the rail puts two primary navs at one level. Pouring the
seven sections into the rail does the same thing in one control, and takes it to
19 rows.

The insight the rules point at: **the seven sections and the account rows were
never competing for one slot.** The sections are primary navigation. "My
tutorials / My toys / Exchanges / Design challenges" are the contents of a
single section. They belong at different levels, and the fix is to say so.

## Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Header presence | **On every non-bare route, signed in or out, in the same position** | The only thing that removes the discontinuity outright. `navigation-consistency` read literally. |
| Second tier | **The existing rail, below the header, scoped to the account section** | A tab strip caps at 7–9 items (`overflow-menu`); the account area is 8 rows, 11 for an org leader. The rail already has group headings and scrolls. |
| Account entry point | **A "My SPLAT" pill, eighth in the bar, plus an avatar** | One door. Replaces the current `Admin` and `Dashboard` role links in `nav.tsx`. |
| Is My SPLAT a `NavSection`? | **No — a separate `ACCOUNT_NAV` constant** | `NavSection` requires `art: IllustrationKey` and `rank`, and its docstring reserves the seven illustrations as the whole set. Worse, `public-footer.tsx` and the homepage launcher both map `PUBLIC_NAV`, so an eighth entry would advertise the account area to signed-out visitors. |
| Header inside the account section | **Quiet, not collapsed** | Same labels, less weight: 44 → 36px, no pill shadow, neutral dots, `muted` labels. |
| Icon-only / hover-expand header | **Rejected** | `nav-label-icon` forbids icon-only rows; hover-only is a priority-2 anti-pattern on touch; WCAG 1.4.13. And four sections — Learn, Get Involved, Impact, About — have no honest glyph. |
| Narrow viewports | **Collapse to a click-driven menu, by viewport width only** | Collapsing by auth state is the original bug in miniature. |
| Admin | **Unchanged — a rail row under Account when `caps.isAdmin`** | Already how `nav-model.ts` works. Admin is therefore inside the account section, so the quiet header covers it with no special case. |
| Browse group in the rail | **Deleted** | Those four rows are the header's job now. Rail drops 12 → 8 rows (9 for an admin, 11 for an org leader). |

## The header contract

One component, three states, one position. The bar renders on every route where
`isBare(pathname)` is false.

| State | Right-hand side |
|---|---|
| Signed out | `Sign in` (accent button) |
| Signed in, public section | `My SPLAT` pill with unread badge, avatar |
| Signed in, account section | Same, with `My SPLAT` marked `aria-current="page"` |

The seven section pills are identical in all three. Nothing that a signed-out
visitor learned is ever taken away.

**Interface change:** `components/nav.tsx` currently takes `role: Role | null`
from `getUserRole()`. It takes `caps: Capabilities | null` instead — it needs
`unreadNotifications` for the badge, and null/non-null already answers "signed
in?". `getCapabilities()` is wrapped in React `cache()`, so the layout and the
shell calling it costs one round of fetches, not two. `getUserRole()` keeps its
other callers and is not removed.

`My SPLAT`'s badge carries `caps.unreadNotifications`, the same count the rail's
Notifications row shows, so collapsing the rail on public routes surfaces
nothing less than today.

## The section model

`lib/public-nav.ts` gains one export beside `PUBLIC_NAV`:

```ts
/** The account area. Deliberately not a NavSection — see the design doc. */
export const ACCOUNT_NAV = {
  href: '/dashboard',
  label: 'My SPLAT',
  tone: 'brand',
} as const
```

`sectionFor()` is extended to match `/dashboard` and `/admin` onto it before
falling through to `PUBLIC_NAV`. Three things fall out for free:

- **`Breadcrumb`** already renders "← *section*" for any page inside a section
  that is not its own hub. Dashboard sub-pages get "← My SPLAT" with no change
  to the component.
- **`PlayroomBackdrop`** already tones itself from `sectionFor`, so the account
  area picks up the brand tone rather than rendering untoned.
- **`toneClass`** supplies the pill's active surface from the existing map.

`PUBLIC_NAV` is untouched, so `SCAFFOLD_KEYS`, the footer and the launcher keep
their current output exactly.

## `/dashboard` becomes a hub

Today `/dashboard` is "My tutorials" wearing the section's URL. It becomes the
account section's hub, built with the same `components/hub-grid.tsx` that renders
`/get-involved` and `/learn` — one tile per rail row, each carrying a live
summary line ("2 waiting on you", "1 idea in review"), plus an accent tile for
**Submit an idea** pointing at `/get-involved/submit-an-idea`.

"My tutorials" moves to `/dashboard/tutorials`. This is the one URL change in the
spec, and it is not free: `/dashboard` is the post-login landing that redirects
and Playwright `waitForURL` calls depend on. Those still land somewhere valid —
the hub — so no redirect breaks; but `tests/unit/pages/dashboard.test.tsx` and
any e2e asserting tutorial content at `/dashboard` need moving with it.

## The rail, demoted

`components/rail.tsx` keeps its markup, its icons, its collapse control and
`RAIL_COOKIE`. Three changes:

1. `buildNav()` loses the `Browse` group entirely. Groups become `Yours`,
   `Organisation` (when `caps.ledOrgs.length > 0`), `Account`.
2. The rail's own brand lockup goes — the header above it already carries the
   wordmark, and two lockups on one screen is the "double header" failure mode
   properly understood.
3. It renders only where `sectionFor(pathname) === ACCOUNT_NAV`. On public
   routes there is no rail at all.

`components/app-shell.tsx` stops being the whole-page switch and becomes the
account section's wrapper. `app/layout.tsx` renders the header and footer
unconditionally for non-bare routes, and the shell only inside the account
section — collapsing today's either/or into a nesting.

## The quiet treatment

Inside the account section the header keeps every label and drops its weight:

| Property | Public | Account |
|---|---|---|
| Height | 44px | 36px |
| Pill shadow | `0 2px 0 rgb(10 79 112 / .16)` | none |
| Pill label | `text-brand-deep` | `text-muted` |
| Tone dot | section colour | neutral `--color-line` |
| Bar background | `--color-surface` (`#ffffff`) | `--color-surface-quiet`, a new token at `#f6fbfd` |

`--color-surface-quiet` is the one token this spec adds: it sits between
`--color-surface` and `--color-canvas` so the quiet bar separates from both the
page below it and the white cards on it.

Hover still lifts the pill to `brand-deep` on `--color-sunken`, so the control
never reads as disabled. The rail below is `--color-brand-deep` at full
saturation and wins the contrast comparison without the header having to
disappear.

The `.nav-pill:hover` rotate stays on public routes and is dropped in the quiet
variant: a bar that is deliberately receding should not also be the most playful
thing on the page.

## Responsive

Unchanged in kind from today, restated because the header is now everywhere:

- **≥ lg** — header, then rail beside content.
- **< lg** — header with the section pills behind a menu button (click, not
  hover). The rail becomes the existing `<dialog>` drawer in
  `shell-frame.tsx`, opened from the same button row.
- The header's skip link (`#main`) survives; the shell's duplicate is removed,
  since there is now exactly one path to `<main>`.

## Testing

- `lib/public-nav.ts` — `sectionFor` resolves `/dashboard`, `/dashboard/toys`
  and `/admin/review` to `ACCOUNT_NAV`, and still resolves `/organizations` to
  Impact (the existing explicit-child case).
- `lib/nav-model.ts` — `buildNav` returns no `Browse` group; returns
  `Organisation` only with a led org; `Account` includes `/admin` only for an
  admin.
- `components/nav.tsx` — renders seven section pills in all three states;
  renders `Sign in` signed out and `My SPLAT` + avatar signed in; badge shows
  `unreadNotifications` and is absent at zero.
- `app/layout.tsx` — `isBare` unchanged; header renders for a signed-in account
  (the regression this spec exists to prevent).
- `components/shell-frame.tsx` — rail renders inside the account section, absent
  outside it.
- e2e — sign in, land on `/dashboard`, reach `/get-involved/submit-an-idea`
  through the header without signing out. This is the acceptance test for the
  whole spec.

## What gets deleted

- The `Browse` group in `lib/nav-model.ts` (4 rows).
- The `roleLinks` array in `components/nav.tsx` (`Admin`, `Dashboard`).
- The rail's brand lockup and its skip link.
- The either/or branch in `app/layout.tsx`.

Nothing is added that duplicates something existing: no second nav model, no new
illustration, no icons for concepts that do not have one.

## Open items

- **The label "My SPLAT"** is the author's coinage, approved in conversation on
  2026-08-21. "My account" and "Dashboard" were the alternatives. Renaming it
  after implementation touches `ACCOUNT_NAV`, breadcrumbs and page titles.
- **`/dashboard` → `/dashboard/tutorials`** is the only breaking URL change.
  Worth a redirect if any external link points at `/dashboard` expecting the
  tutorial list; none is known.
