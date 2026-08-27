# My SPLAT: cards that say what is behind them

**Date:** 2026-08-27
**Status:** Design, awaiting review
**Depends on:** a `saves` subsystem that does not exist yet — see *Prerequisite*
**Touches:** `2026-08-27-pixel-page-templates-design.md` (one premise of it, knowingly)

## Why

`app/dashboard/page.tsx` calls itself the account section's hub and says, in its
own header comment, that it "is not a duplicate of the rail… this says what is
waiting for you there, which is why every blurb is computed rather than
written."

Only two of its eight blurbs are computed. The other six are hardcoded prose in
a literal keyed by href (`:38`). Every card is a single link to a list page, so
the page is a directory of eight equal destinations — which is what the rail in
the sidebar already is, with sentences added.

The thing a signed-in user most often arrives to do — add a tutorial, add a toy,
find the library — is two clicks away behind a card whose only job is to
announce that a page exists.

This design keeps the card a single link and changes what it *says*: a short
list of what is behind it, instead of one sentence about it. The buttons that do
the work move to the destination page, where the rail already is.

## Decisions taken

All five are Byron's, 2026-08-27, chosen against drawn mockups. The three
options he chose between for the final layout are committed alongside this
document as `2026-08-27-my-splat-signposts-mockup.html` — open it in a browser;
it is drawn in the board's real values.

1. **The card is a signpost, not a menu.** The whole card stays one
   `BoundaryLink`. The lines inside it are descriptive text, never separate
   links. This is the decision the rest follow from, and it is why this work is
   small: no nested-anchor problem, no structural change to `HubGrid`.

2. **The lines render as flat tinted tags** — rounded, `rgba(255,255,255,.75)`
   fill, no border and no shadow. Button-*shaped*, deliberately without the
   board's two button signals (`3px solid ink`, hard shadow), so they read as
   labels rather than controls. The outlined-chip variant was rejected: it is
   pixel-identical to the real, pressable filter chips on `/library` and
   `/toy-library`, and here it would be inert decoration that navigates
   somewhere other than what it names.

3. **The grid stays flat.** All cards in one `HubGrid`, no group headings.

   This is the one decision taken against a stated objection, and it is recorded
   here so the next reader knows it was chosen rather than missed. The 27 Aug
   page-template spec justifies giving *every* hub card the section tint with the
   observation that "no grid on the site renders more than four cards today" —
   the flat wall of one hue it feared cannot occur because every hub groups its
   children. After this change My SPLAT is the exception: seven brand-tint cards
   in one grid. Byron's ruling: ship it flat, and judge the tint on the built
   page rather than on the argument. If it reads as a wall, the cheap remedy is
   two labelled `HubGrid` calls, which is what five other hub pages already do.

4. **Badges count unread notifications, bucketed by type**, and clear when the
   destination is opened. Not the "needs action" count — `caps.exchangeActions`
   stays exactly where it is, feeding the rail, and is not shown on the hub.

5. **Saves are a real feature covering all five savable entity types** —
   tutorials, toys, design challenges, printable parts and organisations. See
   *Prerequisite*: it is not specced here.

## Prerequisite: the `saves` subsystem

"View saved tutorials" and "View saved toys" name a feature that **does not
exist anywhere in this repo**. There is no table (migrations end at
`043_idea_graduated_notification`), no route, no save control on any card, and
no page. Every `saved` match in the codebase is a form's "Saved" toast or a
profile's saved address.

It is larger than the hub change that surfaced it — table, RLS, `/api/saves`, a
save affordance on the public library cards, and a list page per type — and it
belongs in its own design session, its own spec and its own plan.

**Consequence for sequencing.** Almost none of the hub work blocks on it. The
card tags are text, so "View saved tutorials" costs nothing until it is true.
What blocks is the *destination page button*: `/dashboard/tutorials` cannot ship
a "Saved tutorials" button that leads nowhere.

So: tasks 1, 2, 3, 4 and 6 ship now, and task 5 ships in two halves — the
exchanges split and the two "Browse the library" buttons now, the three "Saved"
buttons after `saves` lands.

Printable parts get the enum value and no save control, because
`/printing/parts` is still `soon`.

## What changes

### 1. `lib/public-nav.ts` — `NavItem.blurb` widens

```ts
blurb: string | string[]
```

`NavItem` is referenced by exactly three files — `lib/public-nav.ts`,
`components/hub-grid.tsx` and `app/dashboard/page.tsx` — so the blast radius is
one component and one page. All 43 public entries keep passing a string.
`NavSection.blurb` is untouched: the footer, `launcher-grid` and `app/page.tsx`
read that one, and none of them wants a list.

### 2. `components/hub-grid.tsx` — render a list when given one

One branch at `:89`. An array renders a `<ul>` of chevron-led tags; a string
renders today's `<p>` unchanged, so every public hub is byte-identical.

Tag: Nunito 11/700 in `--color-brand-deep`, `rgba(255,255,255,.75)` fill,
`radius: 20px`, `padding: 4px 10px`, wrapping freely. No new token — `radius 20`
is already in the board's vocabulary and explicitly exempt from the `9999px`
pill sweep.

The badge is a new element in the card's title row: `--color-apricot` fill,
`2px solid ink`, `radius 4`, IBM Plex Mono 10/700. Rendered only when the count
is non-zero. Every value is from the board's table.

### 3. `app/dashboard/page.tsx` — the copy, and the two literals it lives in

The `counts` and `blurbs` maps merge into one `Record<string, string | string[]>`.
`counts` stops overwriting the description — today three pending actions replace
the Exchanges blurb entirely with `"3 waiting on you"`, so the card loses its
description exactly when it matters most. Counts move to the badge.

| Card | Renders |
|---|---|
| My tutorials | Add a tutorial to SPLAT Connect · View saved tutorials · Browse tutorial library |
| My toys | Add a toy you want to donate or exchange · View saved toys · Browse toy library |
| My exchanges | View active exchanges or donations · Exchange history |
| Design challenges | Submit an idea · View saved challenges |
| My print requests | *(prose, unchanged)* |
| Notifications | *(prose, unchanged)* |
| Account | *(prose, unchanged)* |

**`Submit an idea` stops being its own card.** It becomes the first tag on
Design challenges. It was the one row in the account hub pointing at a public
route (`/get-involved/submit-an-idea`), and Design challenges already links to
the same section. Eight cards become seven.

### 4. `lib/nav-model.ts` — one label

`Exchanges` → `My exchanges`, matching its two siblings. The rail reads the same
model, so it renames there too; that is intended, not a side effect.

### 5. Destination pages gain the buttons

The actions the tags describe have to exist where the tag says they lead.

- **`app/dashboard/tutorials/page.tsx`** — has `+ New tutorial` only. Gains
  `Saved tutorials` and `Browse the library`, as secondary `.btn` beside it.
  *(Blocked on `saves`.)*
- **`app/dashboard/toys/page.tsx`** — has `+ Add a toy` only. Gains `Saved toys`
  and `Browse toy library`. *(Blocked on `saves`.)*
- **`app/dashboard/challenges/page.tsx`** — gains `Saved challenges`.
  *(Blocked on `saves`.)*
- **`app/dashboard/exchanges/page.tsx`** — has no header buttons and, more
  importantly, **no history**. It renders one flat list of every transaction at
  every status. "Exchange history" is therefore new work, not a link: split the
  list on `ToyTransactionStatus`, with `requested` and `accepted` as active and
  `completed`, `rejected` and `withdrawn` as history. No API change —
  `ToyTransactionSummary.status` already carries it.

### 6. Bucketed unread counts

**`packages/types`** — a `notificationBucket(type: NotificationType)` function
beside the existing `NotificationType` union, so the API and both clients cannot
disagree about which card a notification belongs to:

| Bucket | Types |
|---|---|
| `tutorials` | `tutorial_approved`, `tutorial_rejected`, `collaborator_*` (all five) |
| `exchanges` | `toy_request`, `toy_accepted`, `toy_rejected`, `toy_withdrawn`, `toy_message` |
| `challenges` | `idea_approved`, `idea_rejected`, `idea_graduated`, `challenge_joined`, `challenge_left`, `challenge_removed` |

That is all eighteen types. **My toys gets no badge** — every `toy_*` type is a
transaction event, so it belongs to My exchanges. A toy sitting on a shelf
generates no notification. Do not invent one to fill the card.

**`packages/api/src/routes/notifications.ts`** — `GET /me/unread-counts`
returning `{ tutorials, exchanges, challenges, total }`. One grouped query,
alongside the existing `/me/unread-count`, which stays for the rail.

**`lib/capabilities.ts`** — replaces the `unreadNotifications` fetch with the
bucketed one and derives `unreadNotifications` from `total`, so the number of
round trips in the root layout does not change. Keeps its `.catch(() => …)`
degradation.

**Clearing.** `POST /api/notifications/me/read` with `{ bucket }` marks that
bucket read, called when the destination page loads. The consequence, accepted:
opening `/dashboard/tutorials` also marks those rows read in `/notifications`.

## Testing impact

- `tests/unit/components/hub-grid.test.tsx` — the string branch stays green
  unchanged; add the array branch, the badge's zero/non-zero cases, and that a
  tag is not an anchor. That last one is the assertion that pins decision 1.
- `tests/unit/components/rail.test.tsx`, `nav.test.tsx` — `My exchanges`.
- New: `tests/unit/app/my-splat-hub.test.tsx` — seven cards, no `Submit an idea`
  card, and the tag copy per card.
- New: `notificationBucket` unit test asserting **every** member of
  `NotificationType` maps somewhere. A `satisfies Record<NotificationType, …>`
  makes a nineteenth type a compile error rather than a silently missing badge.
- `tests/e2e/dashboard/navigation.spec.ts` and `shell.spec.ts` reference the old
  label; check both.

## Out of scope

- The `saves` subsystem (own spec).
- Organisation and admin cards: they keep prose blurbs. Nothing about a review
  queue is a three-action list.
- `/dashboard/print-requests` stays `soon`.
- The rail. It lists destinations and should keep doing exactly that.

## Risks

**The tint wall.** Seven brand-tint cards in one grid is the thing the 27 Aug
spec argues against. Taken knowingly (decision 3); remedy is two `HubGrid`
calls if it reads badly built.

**A tag that looks pressable but is not.** Mitigated by dropping the border and
shadow, and pinned by a test. If it still reads as a control in the browser, the
fallback is chevron-led plain text — same one-line change.

**Copy length at 4-up.** "Add a toy you want to donate or exchange" is 38
characters in a ~300px card. It will wrap to two lines. That is fine, but it
sets the height of the whole row, so check the built page before shortening
anything.
