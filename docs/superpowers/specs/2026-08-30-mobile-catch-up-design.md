# Mobile catch-up — five tabs, every current feature native

**Date:** 2026-08-30
**Status:** Approved from the mockup, 2026-08-30. Not committed.
**Mockup (the authority — where this text and the mockup disagree, the mockup wins):**
https://claude.ai/code/artifact/ae99f9d8-1452-49a0-aa6a-4515d37b24da
**Touches:** `packages/mobile` only. No API or schema change — every screen below
reads and writes routes the web already uses.

## Why

The web app has grown four audiences and ~80 routes since the mobile app was
last touched. Mobile still has five tabs of which three are `ComingSoon` stubs
(Toy Library, 3D Print, Scanner) and one real feature (the tutorial library and
a child profile). Byron's ask: every current web feature becomes native on
mobile, fitted intelligently into five tabs — not a page-for-page port.

## Decisions taken (all Byron's, 2026-08-30, from the mockup)

1. **Five tabs: Guides · Toy Library · MY SPLAT (centre, raised) · Explore · Inbox.**
   Scanner and 3D Print tabs are removed. 3D Printing is not a browse surface:
   its journey starts inside an assistive-tech guide, so it folds into Guides.
2. **MY SPLAT is a popover *and* a page.** The centre button opens a popover
   that grows out of the button (tail pointing at it); the tab bar stays live
   beneath. Dismiss by tapping the button, the dimmed content, or any other tab
   (which also navigates). Six tiles + one "All of My SPLAT" row to the hub page.
3. **The mobile app adopts the Pixel visual language** (2–3px ink borders, hard
   offset shadows, radii 6/8/10/20, Nunito, Jersey 10 for numerals only). The
   mockup rendered Pixel by default with a Soft toggle beside it; Byron accepted
   it as shown. `theme.ts` gains the Pixel tokens; the soft blurred shadow and
   14px radii go.
4. **The app requires sign-in.** Today the tutorial library is browsable signed-out
   and sign-in lives on the Profile tab; Phase 1 adds an `(auth)` group and a
   redirect from every tab. No "sign in to…" copy anywhere.
5. **Not on mobile, on purpose:** Scanner; Impact (events, map, news); the
   Get Involved explainers; the Requests board; Printing basics/parts/requests
   as pages (basics is a Learn article, parts are the STL on every assistive-tech
   guide, requests are the placeholder on the guide); legal pages (footer links
   open the web); editing collaborators and recommendations on a tutorial
   (web only for now); Admin (listed on the phone, each row opens the web).
6. **Accept / decline for a toy request is never on the toy page.** The owner's
   toy shows "N offers on this toy → Offers list → the offer's thread", and the
   thread carries Accept / Decline and, later, Confirm handoff. One screen per
   exchange, matching `/dashboard/exchanges/[id]` on web.
7. **Inbox is the notifications page.** Bucketed Exchanges / Tutorials /
   Challenges, unread dot, "Mark all read", every row taps through. With Inbox a
   tab, Notifications leaves the popover and **Design challenges** takes the
   tile; for an organisation leader that tile is **Review queue** with its count.
8. **Learn is a path, not a catalogue.** One numbered vertical path of the six
   articles with read ticks and a "Continue" card; Ask an expert is its own
   action at the end. No carousels.
9. **On a guide: provenance high, picks last, no second list.** One tappable
   byline ("By Sam T. + 2"), one tappable "Backed by" chip; contributor and
   organisation pages hold their lists. "Also worth a look · <creator>'s picks"
   is one horizontal row at the bottom.

## The shell

### Tabs (`app/(tabs)/_layout.tsx`)

| Slot | Route group | Icon | Badge |
|---|---|---|---|
| Guides | `(tabs)/guides` (rename of `home`) | book | — |
| Toy Library | `(tabs)/toy-library` | cube | — |
| MY SPLAT | not a route — opens the popover | splat mark, raised disc | exchange actions + unread, *only when no Inbox tab* |
| Explore | `(tabs)/explore` | compass | — |
| Inbox | `(tabs)/inbox` | inbox | `unread.total + exchangeActions` |

Counts come from `GET /api/notifications/me/unread-counts` and
`GET /api/toy-transactions/action-count`, the same two the web rail reads.

The centre button is a `Pressable` with `accessibilityRole="button"`,
`accessibilityLabel="Open My SPLAT"`, `accessibilityState={{expanded}}`. It is
rendered by a custom `tabBar` so it can sit 22px above the bar; the other four
stay react-navigation tab items.

### MY SPLAT popover (`components/my-splat-popover.tsx`)

- Anchored to the centre disc; scrim covers content only (not the bar). Scale-
  from-button entrance, disabled under reduced motion. Disc goes apricot and
  pressed while open.
- Six tiles, 2×3: My exchanges (count), Design challenges (count) — *Review queue
  (count) if `ledOrgs.length > 0`*, My toys, My tutorials, Saved, Account &
  child profiles. Then the dashed "All of My SPLAT" row.
- Every destination opens in a **modal stack** (`app/(my)/_layout.tsx`, Stack
  with `presentation: 'modal'`) with a Close, so the tab underneath keeps its
  own stack and highlight. Tab groups and `(my)` share one URL space, so tabs
  are `/guides`, `/toy-library`, `/explore`, `/inbox` and the modal stack owns
  `/my-splat`, `/toys`, `/tutorials`, `/exchanges`, `/account`, … This is the rule the mockup states and it is not
  optional: opening My toys from Guides must not push onto Guides.

### MY SPLAT hub page (`app/(my)/my-splat.tsx`)

Hero (name, child-profile count, "Leads N organisations"), then groups exactly
as `packages/web/lib/nav-model.ts` — reuse its `buildNav(caps)` output by
lifting it into `@splat-connect/types` if it is not already there: *Add a
tutorial* (My tutorials), *Exchange a toy* (My toys, My exchanges + count), *Give
us a challenge* (Design challenges, Submit an idea), *Print requests* (soon),
*Organisation* (Review queue, Toy inventory, Print orders soon — leaders only),
*Account* (Saved, Notifications, Account, Admin — admins only, link-out).

## Screens

Each entry: what it shows, in order; what it reads; what it writes. "card" means
the Pixel list card: 2px ink border, 4px hard shadow, 8px radius.

### Guides tab

**Guides list** (`guides/index`) — header + "＋ Add a guide" pill · compact
search (28px, "Search by toy name") · one chip row: All/Easy/Medium/Hard │ Toy
adaptation / Assistive tech · count line · cards: 64px photo, title (2 lines),
"Backed by <org>" or "Reviewed by SPLAT", difficulty + kind badges, save
bookmark top-right. Reads `GET /api/public/tutorials` (+ `?difficulty=`),
`GET /api/saves/ids`. Writes `POST/DELETE /api/saves/tutorials/:id`.

**Guide detail** (`guides/[id]`) — photo · title + save · badges · description ·
byline (`By A and B` / `By A + n`, names tap → contributor page) · backing chip
(tap → organisation page; "Reviewed by SPLAT" is grey and inert) · Parts (name ×
qty, "optional") · Tools · **Preview tutorial** (existing in-app PDF viewer,
`guides/[id]/preview`) · *assistive tech only:* "Request this 3D print" card,
dimmed, SOON badge, no action · "Also worth a look · <first name>'s picks": ≤3
small cards, horizontal, only the approved ones (the public route already
filters). Reads `GET /api/public/tutorials/:id` (includes parts, tools,
contributors, orgs, recommendations).

**Contributor page** (`guides/contributor/[id]`) — avatar initial, name, role
line, "Guides by <first name>" as list cards. Reads `GET /api/public/contributors/:id`.

**Organisation page** (`guides/organisation/[id]` and reachable from a toy) —
name, city · volunteers, one-line bio, "Guides they back", "Toys on their
shelf" (with "N available"), "Projects". Reads `GET /api/public/organizations/:id`,
`GET /api/public/toys?org=`. Back returns to whatever opened it.

**Add a guide** (`guides/new`, modal) — title, kind (Toy adaptation / Assistive
tech), difficulty → **Create draft** → opens the editor. If
`hasContributorTerms === false`, the existing terms acceptance runs first
(`POST /api/agreements`). Writes `POST /api/tutorials`.

### Toy Library tab

**Toy list** (`toys/index`) — header + "＋ Give a toy" pill (→ My toys › new) ·
compact search · chips: Any/Good/Fair/Worn │ Switch-adapted · count · cards:
photo, name, condition meter + "N/10 · Held by <holder>", badges only when
meaningful (Switch-adapted; "N available" for org stock), save · "Organisations"
dashed strip → organisations list. Reads `GET /api/public/toys`.

**Toy detail** (`toys/[id]`) — photo strip (cover, switch, more; horizontal) ·
name + save · "Held by <holder> · N available" (holder taps to the org page when
it is one) · two fact tiles: Condition meter, Switch-adapted (Yes · 3.5mm jack /
No) · description · **request block** (mint): one sentence saying what the
buttons do, then only the buttons the offer type allows — *Arrange pickup*
(donation) / *Arrange exchange* (exchange). Arrange exchange expands an inline
chooser of the viewer's **published** toys with a Start exchange button that
stays dimmed until one is chosen; no published toys → the web's "Add a toy to My
Toys first" message. Either button creates the transaction and opens its
thread. The owner viewing their own toy sees no request block. Reads
`GET /api/public/toys/:id`, `GET /api/toys` (mine). Writes
`POST /api/toy-transactions`.

**Organisations list** (`toys/organisations`) — cards → organisation page.
Reads `GET /api/public/organizations`.

### Explore tab

**Explore** (`explore/index`) — search (guides, toys, organisations; client-side
over the three public lists, no new endpoint) · three entries: **Learn** (with
`read/6`), **Get Involved** (→ Design challenges), **About SPLAT**.

**Learn hub** (`explore/learn`) — "Continue" card (next unread article, meter,
minutes left) · numbered vertical path of the six articles (Toy adaptation 101,
Switch types, Choosing a toy, Tools and materials, Safety and cleaning, Printing
basics): read ones get a mint tick, the current one an apricot node · **Ask an
expert** CTA. Article bodies are the web's MDX/JSX pages; mobile renders them
as static screens (`explore/learn/[slug]`) from a shared content module lifted
into `packages/types` or a new `packages/content` — decide in the plan; do not
duplicate prose. Read state is local (`expo-secure-store`/AsyncStorage keyed by
slug); there is no server-side read state and none is added.

**About SPLAT** (`explore/about`) — one card + link rows (Team · Partners ·
Support, Which one are you, Impact, Contact, Safety) that open the web.

**Design challenges** (`explore/challenges`) — header + "＋ Submit an idea" ·
"Open challenges" (title, makers joined, "you're in") · "Solved · became guides".
Detail (`explore/challenges/[id]`): title, save, `open challenge` badge, summary,
fact tiles (makers, attempts), "What's been tried", **Join this challenge** /
"✓ You joined · leave". Reads `GET /api/public/challenges[/:id]` (anonymous —
the same endpoints web's public pages use); writes `POST /api/ideas/:id/join`,
`DELETE /api/ideas/:id/participants/:profileId`, saves on `challenges`.

**Submit an idea** (`explore/challenges/new`, modal) — title, who it's for, the
problem, optional photo → **Send idea**. Writes `POST /api/ideas`.

### Inbox tab

**Inbox** (`inbox/index`) — title "Inbox", "Everything waiting on you, newest
first", "Mark all read" pill · groups Exchanges / Tutorials / Challenges with
"N unread" in the eyebrow · rows: bold when unread, apricot dot at the left
edge, relative time, chevron; tap → the thread / guide / challenge the
notification is about. Reads `GET /api/notifications/me`; writes
`POST /api/notifications/me/read`. When the arrangement has no Inbox tab this
same screen renders under the hub as "Notifications" with a Close — one
component, two addresses.

### MY SPLAT modal stack (`app/(my)/…`)

**My toys** — header + "＋ Add a toy" · cards: condition meter, offer type or
"not offered yet", status badge (draft/published), Switch-adapted, and an
apricot count when offers are waiting · "Archived · handed over" group.
Reads `GET /api/toys`, `GET /api/toy-transactions?toy=`.

**My toy** (`(my)/toys/[id]`) — photo · name + status · *if offers:* apricot row
"N offers on this toy · Waiting on you — accept or decline" → **Offers on this
toy** list → offer thread · step pills **Details · Photos · Review** (✓ done,
apricot dot = the step blocking publish; statuses from the web's `toy-steps`
logic, lifted to types if needed):
- Details: name, description, condition slider 1–10 ("needs repair" →
  "like new"), Switch-adapted toggle, Save. `PATCH /api/toys/:id`.
- Photos: cover + switch tiles, add tile, **Take a photo** (`expo-image-picker`,
  camera + library). `POST /api/upload/toy-cover`, `…/toy-switch-photo`.
- Review: offer type Donation / Exchange / Both, "what families will see" line,
  **Publish to the Toy Library** or ✓ Published. `PATCH /api/toys/:id/publish`.
- Footer: **Take off the shelf** (published only; archives) and **Delete toy** —
  quiet text buttons. `PATCH /api/toys/:id` (archive), `DELETE /api/toys/:id`.
- Archived: read-only record (handed to whom, when; offered as; condition at
  handover) and "View the exchange thread".

**Add a toy** (`(my)/toys/new`) — name + condition create the draft
(`POST /api/toys`), then the same page in Details.

**My exchanges** — "Active" then "History"; rows: toy, "Exchange/Donation with
<party>", status badge, and the waiting line (`actionLabel` from types:
"Waiting on you — accept or decline" / "— confirm the handoff", or "Waiting on
<party>"). Rows waiting on you are apricot. Reads `GET /api/toy-transactions`.

**Exchange thread** (`(my)/exchanges/[id]`) — swap card (their toy ⇄ yours, or →
"You collect") · status badge + "Waiting on …" · messages (system lines dashed
and centred; mine tinted right) · composer · footer by state and side:
requested-as-owner **Accept / Decline**; requested-as-requester **Withdraw
request**; accepted **Confirm handoff** ("tap once the toy has changed hands");
completed/withdrawn/rejected: no footer. Reads `GET /api/toy-transactions/:id`,
`…/:id/messages`; writes `…/:id/messages`, `/accept`, `/reject`, `/withdraw`,
`/confirm`. Polling every 10s while the screen is focused — the web thread's
live messaging was shipped thread-only and this mirrors it; no realtime
subscription on mobile in this pass.

**My tutorials** — header + "＋ Add a guide" · rows: photo, title, kind ·
difficulty, status badge (draft / pending / approved / rejected) · footnote
that collaborators and recommendations are edited on the web. Reads
`GET /api/tutorials/mine`.

**Tutorial editor** (`(my)/tutorials/[id]`) — title + status · *rejected:*
reviewer's note box · *pending:* "With <org> for review. Saving any change pulls
it back to draft." · step pills **Details · Parts · Tools · Files · STL
(assistive tech only) · Review**, gap dot on the blocking step:
- Details: title, kind, difficulty, description. `PATCH /api/tutorials/:id`.
- Parts / Tools: list + "＋ Add". `POST/PATCH/DELETE /api/tutorials/:id/parts|tools`.
- Files: toy photo, switch photo, PDF row; **Take a photo**, **Choose PDF from
  Files** (`expo-document-picker`). `POST /api/upload/photo`, `…/pdf`.
- STL: required for assistive tech; **Choose STL from Files**. `POST /api/upload/stl`.
- Review: Backed by (status), Collaborators (read-only, "edit on the web"),
  Recommendations (read-only, "edit on the web"), then **Submit for review** /
  "Submitted · waiting for review" / "✓ Approved · in Guides".
  `PATCH /api/tutorials/:id/status`.
- Footer: **Delete guide**.

**Design challenges (mine)** — "Joined" (→ detail) and "Your ideas" (status
pending / open / rejected / graduated with the review note). Reads
`GET /api/ideas/mine`, `…/joined`.

**Saved** — three count tiles (Guides, Toys, Challenges) → per-type lists ·
"Recently saved". Reads `GET /api/saves/:slug`.

**Account** — avatar, name, email ("can't be changed here") · display name
field · **Child profiles**: "＋ Add child", rows (name, age, one-line ability
summary or "Not set yet") → child editor with the existing three steps
**Ability · Customisation · Everyday needs** (the current mobile screens,
restyled, wrapped in the step-pill row; gap dot on an unset step; Delete
profile) · Contributor terms (accepted · version, date) · About SPLAT link rows
· **Sign out**, **Delete account**. Reads/writes the existing profile, child
profile and agreements routes.

**Organisation** (leaders only) — **Review queue**: "Waiting on you" rows
(title, author, kind · difficulty, requested when) → **Review detail**: photo,
title, badges, "Check" rows (open the PDF, parts/tools count, STL), note field
("required to request changes"), **Back this guide** / **Request changes**;
"Backed" group below. **Toy inventory**: rows with quantity (Jersey 10 numeral),
"＋ Add stock" (→ Add a toy with `for=org`), "Handed in" group. Reads
`GET /api/organizations/:id/…` review and inventory routes; writes
`POST /api/tutorials/:id/orgs/:orgId/accept|decline`.

**Soon** — Print requests, Print orders: one dimmed card with the promise and a
SOON badge. **Admin** — five link-out rows.

## Shared components (`components/ui`, additions)

`PixelCard`, `Badge` (status map identical to web's `badge.tsx`), `StepPills`
(the ✓ / gap-dot pill row used by toy, tutorial and child editors — one
component), `Meter` (condition + Learn progress), `AddPill`, `SearchBar`
(compact), `ChipRow`, `RequestBlock`, `SwapCard`, `MessageBubble`, `SaveButton`
(island beside a link, same as web), `EmptyState` and `Skeleton` restyled.
`theme.ts`: add `border: {thin: 2, thick: 3}`, `shadow(n)` returning the hard
offset, radii 6/8/10/20, `fonts.numeral: 'Jersey10_400Regular'`.

## Data and access rules that stay exactly as web

- Capability is derived from data, never a role column (`lib/capabilities`).
  Mobile computes the same `caps` from `/api/profiles/me`, `/api/organizations/mine`.
- Public routes already drop unapproved recommendations and non-accepted
  backings; mobile trusts them and adds no filtering.
- Saves use `SAVE_SLUGS` from types; nothing else is saveable.
- Every count badge reads the same two endpoints the web rail reads.

## Testing

- **Unit (jest-expo):** `StepPills` statuses; `Badge` map equals the web's;
  `RequestBlock` renders only the allowed buttons per offer type and dims Start
  exchange until a toy is chosen; Inbox grouping and unread counts; popover tile
  swap for leaders; `theme` contrast of every Pixel bg/fg pair (port
  `tone.test.ts`'s approach).
- **E2E (Playwright over `expo export -p web`):** the existing specs updated
  for the rename (`home` → `guides`); new: tab bar has five items and the
  centre button opens/closes the popover three ways; guide detail shows byline,
  backing chip, picks row; toy detail request block per offer type; exchange
  thread accept path as owner; My toy shows the offers row, not Accept/Decline.
- **Maestro:** the two existing flows keep passing; add one that opens the
  popover and reaches My toys.

## Phases (each its own plan, each shippable)

1. **Shell** — theme tokens, five tabs, custom tab bar with the raised centre
   button, popover, modal stack, hub page, count badges. Old stubs and Scanner
   removed. `home` → `guides` rename.
2. **Guides** — list upgrades (kind chips, backing line, save), detail upgrades
   (byline, chip, picks, 3D-print placeholder), contributor and organisation
   pages, Add a guide + editor.
3. **Toys and exchanges** — Toy Library list/detail with the request block, My
   toys, My toy editor with camera, offers list, My exchanges, thread.
4. **Explore and Inbox** — Explore, Learn hub and articles, About, challenges
   (public + mine + submit), Inbox.
5. **Account and organisation** — Account, child editor restyle, Saved,
   Review queue/detail, Toy inventory, Soon and Admin screens.

## Open items (decide during planning, not blocking)

- Where the Learn article bodies live so web and mobile share one source.
- Whether `buildNav` moves to `@splat-connect/types` or mobile keeps a copy
  (recommendation: move it; it is pure and already tested).
- `expo-image-picker` and `expo-document-picker` are new dependencies; both are
  Expo-managed and SDK 57 compatible.
