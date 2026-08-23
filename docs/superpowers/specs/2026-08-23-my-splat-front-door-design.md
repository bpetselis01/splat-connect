# My SPLAT as the account front door: one header, on one page

**Date:** 2026-08-23
**Status:** Design, awaiting review
**Scope:** `app/layout.tsx`, `components/nav.tsx`, `components/app-shell.tsx`
(no longer wraps `/dashboard`), a new `components/back-to-my-splat-dock.tsx`,
`app/dashboard/page.tsx` (unwrapped from the rail shell), and the tests in
`tests/unit/app/layout-chrome.test.tsx`, `tests/unit/components/nav.test.tsx`.
**Supersedes in part:** `2026-08-21-signed-in-navigation-design.md`, which put
the quiet header on every account route. This doc narrows that to one route
and explains why below.
**Mockup:** `2026-08-23-my-splat-front-door-board.html`, beside this file —
the floating-dock option chosen out of three sketched during brainstorming.

## Why

Two problems, reported together:

1. On every account route, the rail (`components/rail.tsx`, fixed, starts
   below the header) visually collides with the quiet header
   (`components/nav.tsx`) above it. A z-index patch would fix the symptom on
   every route; it would not fix the cause, which is that both navs are
   trying to occupy the same page.
2. A signed-in user who wanders onto a public page has no reliable way back
   into the account section beyond a small "My SPLAT" pill inside a header
   that otherwise looks identical to the signed-out one — no visual signal
   they've left their account, no prominent way back.

Underneath both: `app/dashboard/page.tsx` ("My SPLAT") is already the hub
that lists every account destination with a blurb per item, built from the
same `lib/nav-model.ts` data the rail reads. It is functionally a duplicate
of the rail, on the one route where both render. Removing the rail from that
one page removes the duplication and the overlap bug at the source, rather
than patching around it.

## Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Header presence | Only on `/dashboard` (My SPLAT) | The one route it doesn't compete with the rail on — the front door |
| Rail presence | Every account route except `/dashboard` | Unchanged component, now the sole nav on those pages |
| Header + rail together | Never, on any page | Retires the overlap bug at the source instead of a z-index patch |
| Return path when there's no header | Floating "Back to My SPLAT" dock, bottom-right | One component, two contexts: public pages (signed in) and rail-only account pages |
| Dock visibility | `caps` present AND `pathname !== '/dashboard'` | Never for signed-out visitors; never on the page that already has the header |
| My SPLAT layout | Reuses the existing "no shell" branch of `app/layout.tsx` (today's signed-out rendering: header + backdrop + main + footer) | No new layout branch — `/dashboard` while signed in takes the same path the layout already has for a route with no shell |
| Header styling on My SPLAT | Unchanged — same quiet variant, My SPLAT pill, avatar, sign out | Explicit: rescope it, don't restyle it |
| Mobile drawer trigger | Left broken this pass | Header and rail are now mutually exclusive, so the hamburger's trigger has no page left to render on; revisit when mobile nav is addressed |

## Mechanism

`app/layout.tsx` today (lines 73-77, 123, 145):

```ts
const account = isAccountRoute(pathname)
const shell = account ? await AppShell({ children, footer: <PublicFooter /> }) : null
<Nav caps={await getCapabilities()} quiet={shell !== null} showMenu={shell !== null} />
```

New:

```ts
const account = isAccountRoute(pathname)
const dashboardHome = pathname === ACCOUNT_NAV.href // '/dashboard'
const shell = account && !dashboardHome ? await AppShell({ children, footer: <PublicFooter /> }) : null
<Nav caps={await getCapabilities()} quiet={account} showMenu={shell !== null} />
```

`quiet` decouples from `shell !== null`: on `/dashboard` there is no shell,
but the header still renders in its quiet, account-section styling.
`showMenu` (the mobile hamburger) stays tied to `shell !== null` — there is
never a drawer to open on a page with no rail.

**Breadcrumb:** the existing condition in `app/layout.tsx` —
`!(account && shell === null)` — already hides the breadcrumb whenever an
account route has no shell. Today that's only true for a signed-out visitor;
after this change it's also true for a signed-in visitor on `/dashboard`. No
code change needed — the existing rule is already correct for the new case,
since a "← My SPLAT" breadcrumb on the My SPLAT page itself says nothing.

## New component: `components/back-to-my-splat-dock.tsx`

A fixed-position pill, bottom-right, rendered once at the layout level
(sibling to `shell`/`main`, inside `DrawerProvider`) so its visibility rule
is independent of which branch renders. Visible when `caps` is present and
`pathname !== ACCOUNT_NAV.href`. Styling matches the approved mockup:
brand-deep fill, white text, a small tone dot, "Back to My SPLAT" label,
links to `ACCOUNT_NAV.href`.

## Why this narrows, not contradicts, the 2026-08-21 decision

That doc's rule — header on every route, same position — solved a real
problem: public sections were unreachable while signed in. That reachability
guarantee is preserved here, just relocated: instead of the header carrying
it on every page, the floating dock (plus the My SPLAT header, one hop away)
does. What changes is `navigation-consistency` — placement now varies by
page — traded for retiring the header/rail duplication and its overlap bug,
and for making My SPLAT the same kind of hub the public `/learn` and
`/get-involved` pages already are, which is the direction requested for this
pass.

## Out of scope

- The mobile drawer trigger (explicitly left broken).
- Restyling the header or the rail.
- Turning other account pages (`/dashboard/toys`, `/dashboard/exchanges`,
  etc.) into their own hub-grid sub-pages. This pass makes My SPLAT the sole
  hub-styled entry point; deeper pages keep their current rail-only content.

## Testing impact

- `tests/unit/app/layout-chrome.test.tsx` — update the assumption that every
  account route renders a shell; add a case for `/dashboard` taking the
  no-shell branch while signed in.
- `tests/unit/components/nav.test.tsx` — `quiet`/`showMenu` prop wiring
  changes.
- `tests/e2e/auth/route-protection.spec.ts`, `tests/e2e/auth/login.spec.ts` —
  check neither asserts header presence on a rail-only route post-login.
- New: a small test for the dock's visibility rule (signed in + not
  `/dashboard` → visible; signed out → absent; on `/dashboard` → absent).
