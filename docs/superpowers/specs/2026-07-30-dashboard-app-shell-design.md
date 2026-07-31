# Dashboard App Shell

**Date:** 2026-07-30
**Status:** Approved design, ready for implementation planning
**Supersedes the tab strip introduced by** `2026-07-29-unified-dashboard-design.md`.
Every decision in that spec about *who may do what* stands; only its presentation
layer changes.

## Goal

Replace the web app's two-level navigation — a top bar plus a dashboard tab strip —
with one collapsible rail that holds every destination a signed-in account has. The
rail has vertical room the top bar never had, which is what lets it carry the
placeholder rows for Toy Library and 3D Printing without pushing anything else out.

## Why the tab strip goes

Four tabs across the top plus four links in the bar is two mental models for a
six-destination map. Two symptoms are already recorded in the code:

**The top bar ran out of room.** `app/dashboard/page.tsx:144-146` reads:

> `// WHY: since the nav dropped its /my-tutorials link, this is the only click`
> `//      path left to that page — gate on >0, not >5, or a small account has no`
> `//      way to get there at all.`

`/upload` and `/my-tutorials` are real destinations with zero nav entries, surviving
on a button and a conditional footer link, because a horizontal bar holds about four
items before it wraps.

**"Dashboard" names both a container and one of its contents.** The bar links
*Dashboard* → `/dashboard` and the strip's *Tutorials* tab points at the same route.
Harmless while the strip is a strip; incoherent once the dashboard is the whole shell.

Rotating the strip 90° without removing the bar would fix neither — it would put
navigation on two axes instead of one, which is more structure than this product has.

## Decisions

**1. The shell replaces both levels, for signed-in accounts only.** `app/layout.tsx`
branches on `getCapabilities()`: `null` renders today's `Nav` unchanged, non-null
renders `AppShell`. Signed-out visitors keep the top bar, because a rail holding
"Library" and "Sign in" is chrome without cargo.

**2. Four routes are excluded from the shell:** `/login`, `/signup`, `/auth/*`,
`/onboarding/*`. The contributor-terms gate is the reason. Rendering a full rail on a
gate page offers an escape hatch that middleware immediately bounces the user back
through — a nav full of links that do not work.

**3. Groups are Browse / Yours / Organisation / Account, and the third is conditional.**
Because `Organisation` is hidden from non-leaders, the majority of accounts see exactly
three groups. Group headings are labelled rather than divided by hairlines: at
fourteen rows a bare divider does not carry enough.

**4. Rows are named for what they hold, not for who holds them.** No group is called
"Contributor". `lib/capabilities.ts` opens with the reason:

> *"Capability is derived from data the schema already holds rather than read from
> `profiles.role`, which is why one account can be both a parent and a contributor."*

A parent listing a toy for exchange is not contributing in the authoring sense, and
`canAuthor` is `true` for every account (`capabilities.ts:50`). The unifying idea of
the second group is ownership, so it is *Yours*.

**5. The organisation row is "Review queue", not "Manage team".** A leader cannot
manage a team. `2026-07-28-org-delegated-review-design.md:74`, decision 12: *"Only the
admin grants `org_role = 'leader'`"*, and line 428: *"No page anywhere lets a
contributor create an org or grant leadership."* The surface that exists is a vetting
queue of backing and review requests; the label says so.

**6. `/dashboard` and `/my-tutorials` merge.** `/my-tutorials` is a strict subset:
same `GET /api/tutorials/mine`, same `Backed` type, and row markup and empty state
identical to the dashboard's. `/dashboard` adds only the stat strip and a
`.slice(0, 5)`. The merge deletes the `slice`, deletes the "View all N tutorials →"
link, and deletes the route — about 60 lines of hand-copied markup, the drift
`globals.css` warns about in its `@layer components` header.

The route stays `/dashboard`; the label becomes *My tutorials*. `/dashboard` is the
post-login landing that middleware and every e2e `waitForURL('**/dashboard')` depend
on, and renaming it buys nothing a user sees. Label and URL diverge slightly — a
knowing trade for zero migration risk.

**7. Child profile stays its own row rather than nesting under Profile.** Decision 4
of the unified-dashboard spec put it in front of everyone because *"filling it in is
what makes them a parent"*, and cites avoiding *"the defect where a capability existed
with no reachable route to it"*. Nesting a three-section form (Ability, Everyday Needs,
Customization) inside a single-field one also inverts their weight.

**8. `+ New tutorial` stays on the page, not in the rail.** Upload is an action, not a
location, and `canAuthor` is true for parents who will never use it — a permanent rail
CTA would follow them onto Child profile. The page header button and the empty state's
own button are already two affordances; a third is one too many. Zero diff on that line.

**9. Every row exists now; unbuilt ones are marked and dimmed.** Six placeholder
routes rather than two, so the rail never restructures as features land — each future
row drops into a group that already exists. Unbuilt rows are dimmed, and each carries a
low-contrast `Soon` chip — quiet enough that six of them read as a state rather than as
six pieces of decoration.

**10. The rail is `brand-deep` (`#0a4f70`) with `brand-soft` labels.** 6.5:1 — clears AA
at any size, short of AAA for body text, which nav labels are not.
At fourteen rows a white rail reads as a very long card sitting beside the page's other
cards; the deep surface makes navigation chrome instead, and gives the group headings
somewhere quiet to sit. It is the one unused surface in a palette whose canvas is
blue-tinted and whose cards are white — the model `globals.css` records arriving at
after *"the inverse … left the old web cards at ~1.02:1 against their background."*

**11. Collapsed state lives in a cookie, not `localStorage`.** Read server-side in
`AppShell` so the first paint is already correct. A `useEffect` read renders expanded
then snaps — the class of bug commit `11d1bb1` fixed on mobile ("stop the
contributor-terms gate flashing").

**12. The mobile drawer is a native `<dialog>`.** `showModal()` supplies the focus
trap, Escape-to-close and inert background that would otherwise be hand-built.

## Architecture

```
app/layout.tsx
  caps = await getCapabilities()
  ├─ null  → <Nav role /> + <main class="mx-auto max-w-6xl">    (unchanged)
  └─ caps  → <AppShell caps>{children}</AppShell>

lib/nav-model.ts            buildNav(caps) → NavGroup[]     pure, no React
components/app-shell.tsx    server: reads the cookie, renders rail + main
components/rail.tsx         client: collapse toggle, drawer, active state
components/coming-soon.tsx  web port of the mobile placeholder
components/icons.tsx        the rail's icons, on the existing <Icon> primitive
```

`buildNav` is the direct descendant of the tab array at `dashboard/layout.tsx:30-42`:
the same "which destinations does this capability set permit" question, one level
richer, and now a pure function testable with no rendering. `rail.tsx` keeps its
predecessor's injectable-`pathname` prop (`dashboard-tabs.tsx:11-14`) so its unit test
needs no Next runtime mocking.

### Route map

| Group | Row | Route | Status |
|---|---|---|---|
| Browse | Tutorial library | `/library` | exists — label only |
| Browse | Toy library | `/toy-library` | **new placeholder** |
| Browse | 3D printing | `/printing` | **new placeholder** |
| Browse | Organisations | `/organizations` | exists |
| Yours | My tutorials | `/dashboard` | exists, absorbs `/my-tutorials` |
| Yours | My toys | `/dashboard/toys` | **new placeholder** |
| Yours | My print requests | `/dashboard/print-requests` | **new placeholder** |
| Yours | Child profile | `/dashboard/child` | exists |
| Organisation | Review queue | `/dashboard/organisation` | exists — leaders |
| Organisation | Toy inventory | `/dashboard/organisation/toys` | **new placeholder** — leaders |
| Organisation | Print orders | `/dashboard/organisation/orders` | **new placeholder** — leaders |
| Account | Profile | `/dashboard/profile` | exists |
| Account | Admin | `/admin` | exists — admins |
| Account | Sign out | action | pinned to the footer |

"Library" becomes "Tutorial library": the bare word stops being unambiguous the moment
a toy library exists.

### Deletions

| File | Why |
|---|---|
| `app/my-tutorials/page.tsx` | merged into `/dashboard` (decision 6) |
| `components/dashboard-tabs.tsx` | replaced by `rail.tsx` |
| `components/dashboard-nav.tsx` | its only job was supplying `usePathname()` |
| `app/dashboard/layout.tsx` | built the tab array and re-did a `/login` redirect that middleware and each page already perform |

### Active state

Exact pathname match, not `startsWith`. `dashboard-tabs.tsx:30-31` records why —
`/dashboard` prefixes every sibling — and nesting `/dashboard/organisation/toys` under
`/dashboard/organisation` deepens the trap rather than relieving it.

### Layout mechanics

The rail width is a CSS custom property on the shell wrapper, not a swapped Tailwind
class, so collapsing animates one value and `<main>` responds via
`margin-inline-start: var(--rail-w)` without either element knowing the other's state.

The rail is header / scrolling nav / pinned footer, with `overflow-y: auto` on the
middle band only. Sign-out cannot use `margin-top: auto` inside a single flex column:
that works at eight rows and fails silently at fourteen, because once the list exceeds
the viewport there is no slack to distribute and the footer lands below the fold.

`<main class="mx-auto w-full max-w-6xl">` in the root layout changes for the shell
branch. Centring a fixed max-width inside the space left after the rail pushes content
visibly off-centre; the shell's main is fluid with padding, and width caps move to the
surfaces that benefit from them (forms, prose).

### Collapsed rail

Icons only, label as `aria-label` plus a tooltip, group headings reduced to a hairline.
Icons are added to `components/icons.tsx` rather than pulled from a package — that
file's header states the no-dependency intent, and its `<Icon>` primitive already
normalises the 24px grid, `currentColor` stroke, `strokeWidth={2}` and round caps.
`BookOpen` covers Tutorial library; the rest are new paths on an existing primitive,
which beats a dependency.

### Typed routes

`next.config.ts` sets `typedRoutes: true`, so `href` is checked against the routes that
actually exist. Two consequences. Each placeholder needs a real `page.tsx` before the
rail can link to it — they cannot be stubbed as strings. And `buildNav` returns plain
strings, so the rail casts at the `<Link>` boundary exactly as the tab strip does today
(`dashboard-tabs.tsx:36`, `href={tab.href as never}`). Keeping the nav model free of
`Route<string>` is what lets it stay a pure, framework-free function.

### Placeholders

Web `ComingSoon` mirrors `packages/mobile/components/coming-soon.tsx`: label,
description, numbered "how it will work" steps, and a route onward. That component's
header states the standard it has to meet — *"a bare 'coming soon' sentence was most of
what a new parent saw. It now explains what the feature will do and routes to the part
of the app that already works, rather than dead-ending."*

`/toy-library` and `/printing` reuse the descriptions and steps already written in
`packages/mobile/app/(tabs)/toy-library.tsx` and `print.tsx` verbatim, so a parent
reads the same sentence on both surfaces. The four audience-specific pages — My toys,
My print requests, Toy inventory, Print orders — need their own copy: the same feature
makes a different promise to a parent than to a leader.

### Middleware

`/my-tutorials` drops out of both `signedInRoutes` and `termsGatedPrefixes`; a
permanent redirect in `next.config` resolves it before middleware runs. The six new
routes need no entries — `/dashboard` already prefixes four of them, and
`/toy-library` and `/printing` are public browse surfaces like `/library`.

## Data flow

`getCapabilities()` moves into the root layout. React `cache()` dedupes it against the
pages that call it again, so a dashboard render costs one round of fetches, as today.

**Known cost:** every signed-in page now pays for `/api/child-profile` and
`/api/organizations/mine`, including pages that need neither. The rail does not use
`isParent` at all — Child profile is unconditional (decision 7) — so that fetch is pure
waste on `/library`. Shipped as-is with a `ponytail:` comment naming the upgrade path:
a narrower `getNavCapabilities()` if it ever measures.

## Error handling

`getCapabilities()` keeps its per-capability degradation — one flaky fetch hides one
capability rather than blanking the shell. The blast radius grows: a failed
`/api/organizations/mine` used to hide one tab and now hides a leader's whole three-row
group. Acceptable, because the alternative is failing the shell, and every page remains
its own control regardless of what the rail shows.

Each page keeps re-checking its own access. The rail is an affordance, not a control —
the rule `lib/org-access.ts` already states about organisations, and the reason
`/dashboard/organisation` calls `notFound()` for a non-leader independently.

## Testing

**Unit**
- `buildNav` returns the right groups and rows for: plain contributor, leader,
  admin, leader-and-admin. Pure function, no rendering.
- The rail marks exactly one row current, by exact path — including on
  `/dashboard/organisation/toys`, which must not also light `Review queue`.
- The collapsed rail exposes an accessible name for every row.
- `tests/unit/components/dashboard-tabs.test.tsx` is rewritten against `buildNav` and
  `rail.tsx`.

`tests/unit/pages/dashboard-organisation.test.tsx` and its non-leader counterpart need
no changes — checked, they render the page and never mount the layout or the tab strip.

**E2E** — rewrite of `tests/e2e/dashboard/tabs.spec.ts`
- A contributor sees no Organisation group; a leader does.
- The leader's queue still merges across *two* organisations with no picker. Carried
  over unchanged: it is the assertion that pins decision 6 of the unified-dashboard
  spec, and a single-organisation test would pass either way.
- The collapsed state survives navigation, and the first paint after reload is
  already collapsed — the assertion that pins decision 11.
- At a mobile viewport the drawer opens and closes.
- `/my-tutorials` redirects to `/dashboard`.
- A placeholder route renders its "coming soon" body rather than 404ing.
- `/onboarding/contributor-terms` renders without the rail (decision 2).

## Out of scope

- **Building Toy Library or 3D Printing.** Placeholders only.
- **Leaders managing organisation metadata or membership.** Decisions 11 and 12 of the
  org spec stand; decision 5 above renames the row to match what exists, and adds
  nothing.
- **`/admin`'s internal navigation.** Admin pages gain the shell around them; what is
  inside them does not change.
- **The mobile app.** `packages/mobile` is untouched. Web borrows its placeholder copy;
  nothing flows the other way.
- **Search, notifications, or anything else the rail's spare room might suggest.**
  Notifications were designed and declined on 2026-07-29; the platform stays pull-based.
