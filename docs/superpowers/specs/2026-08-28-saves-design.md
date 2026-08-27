# Saves: keeping a thing to come back to

**Date:** 2026-08-28
**Status:** Design, awaiting review
**Unblocks:** `2026-08-27-my-splat-signposts-design.md` task 5, the half held back
**Touches:** `lib/nav-model.ts` (one row), the three public card components, `/signup`

## Why

`2026-08-27-my-splat-signposts-design.md` shipped My SPLAT cards that name what
is behind them, and three of those names — "saved tutorials", "saved toys",
"saved challenges" — describe a feature that **does not exist anywhere in this
repo**. There is no table (migrations end at `043_idea_graduated_notification`),
no route, no save control on any card, and no page. Every `saved` match in the
codebase is a form's "Saved" toast or a profile's saved address.

The hub could promise it because the tags are text. The destination pages
cannot: `/dashboard/tutorials` was blocked from shipping its "Saved tutorials"
button because the button had nowhere to lead. That is what this closes.

The behaviour it buys is browse-and-triage. A parent lands on `/library`, gets
twelve results, and wants four of them tonight. Today the only way to keep one
is a browser bookmark, which SPLAT never sees and which cannot be a list.

## Decisions taken

All eight are Byron's, 2026-08-28, chosen against drawn mockups where the
question was visual. The mockups are in
`.superpowers/brainstorm/*/content/save-control.html` and `my-splat-eighth.html`
— that directory is gitignored, so the values that mattered are reproduced
inline below rather than referenced.

1. **Five entity types in the enum, three of them live.** Tutorials, toys and
   design challenges get a save control and a list page. Organisations and
   printable parts are **placeholders**: they appear as `SOON` cards on the
   saved hub so the shape is visible, and they carry their enum value so
   switching them on later is a code change rather than a migration. Neither
   gets a control or a list.

   This is the 27 Aug spec's own carve-out generalised. It said "printable parts
   get the enum value and no save control, because `/printing/parts` is still
   soon"; organisations turn out to be in the same position for a different
   reason — `/organizations` renders inline rows with no shared card component,
   so a control there means inventing one for a surface nothing asked to save
   from.

2. **The saved hub is a hub, not a filtered page.** `/dashboard/saved` lists the
   five types as cards, exactly the way `/learn` and My SPLAT list their
   children. Each card leads to `/dashboard/saved/<type>`.

   Rejected: one page filtered by query param, and one page with anchored
   sections. Both were mine and both were wrong — this site already has a
   pattern for "a section's landing page lists what is inside it", and a saved
   list per type is that shape. The hub also gives organisations and printable
   parts somewhere to sit as placeholders, which a filtered page does not.

3. **The per-type buttons skip the hub.** `/dashboard/tutorials` → "Saved
   tutorials" → `/dashboard/saved/tutorials` directly. The label names the
   destination, so it lands on the destination. Only the rail row opens the menu.

4. **The save control is an island on top of the card** — a button positioned
   over the photo's top-right corner, a *sibling* of the card's anchor rather
   than a child of it.

   All three cards wrap their entire body in a `<Link>`, and a `<button>` inside
   an `<a>` is invalid HTML with an ambiguous click target. This is the same
   family as the signposts spec's decision 1, arriving from the other direction:
   there it was text that looked like a control, here it is a real control with
   nowhere legal to sit.

   Rejected: unwrapping the card so the title is the only link, which costs the
   whole-card click target on every browse grid and changes every card on the
   site including the six pages that will never save anything. Also rejected:
   detail pages only, which makes you open a thing before you can keep it — the
   exact friction the feature exists to remove.

   **Detail pages get one as well**, as an ordinary `.btn` in the header row.
   You land on `/tutorials/[id]` from a search result or a shared link with no
   card in sight.

5. **Signed-out visitors see the control, and clicking it sends them to sign
   up** — `/signup?next=<current>&reason=save`, with a notice above the form
   saying an account is needed. Not `/login`: `/signup` carries the segmented
   switch, so someone who already has an account crosses over in one click,
   while the reverse assumes an account that most of `/library`'s traffic does
   not have.

   Rejected: hiding it when signed out, which makes saves invisible to exactly
   the audience that would use them. Also rejected: saving to `localStorage` and
   merging on sign-in — a second storage path, a merge step and a conflict rule,
   for the pre-account case.

6. **The signup round trip carries the destination but not the intent.**
   `emailRedirectTo` becomes `/auth/confirmed?next=<page>`, so confirming the
   email lands them back on the page they were browsing with the card in front
   of them. The item is **not** saved for them; they click again, and this time
   it works.

   This is a real gap in the code today, not a new requirement: `/login` carries
   `?next=` and `/signup` does not — it sets a bare `/auth/confirmed`. Without
   this change the flow ends nowhere near where it started.

   Rejected as over-reach for a first build: carrying the pending save itself
   (`&save=tutorial:abc123`) and performing it on arrival.

7. **A saved thing that stops being visible disappears silently.** A donated
   toy, an unpublished tutorial, a rejected challenge — the card is simply not
   in the list any more. No tombstone, no "no longer available" state.

   This is free rather than cheap: the read path joins to the entity through the
   user client, so RLS drops what you cannot see with no code at all. It is also
   why an orphaned `saves` row after a hard delete is dead storage rather than a
   bug.

   Rejected: a greyed tombstone card with a remove button, which tells you what
   happened to a toy you were watching but costs a state and copy per type.

8. **My SPLAT goes back to eight cards, flat.** The rail row and the hub card
   are one decision — the hub is built from `buildNav` — and Byron chose the
   flat grid over splitting it into two labelled groups.

   The 27 Aug page-template spec argues against a wall of one hue, and the
   signposts spec's decision 3 shipped seven brand-tint cards against that
   objection with the ruling "judge the tint on the built page rather than on
   the argument". Eight is more tint and also a *better* grid: seven was a row
   of four and a stranded row of three, eight is two complete rows. The ragged
   edge that made the wall legible goes away. Still unjudged on a built page.

## What changes

### 1. `supabase/migrations/044_saves.sql`

```sql
create type public.save_entity_type as enum
  ('tutorial', 'toy', 'challenge', 'organisation', 'printable_part');

create table public.saves (
  profile_id  uuid not null references public.profiles on delete cascade,
  entity_type public.save_entity_type not null,
  entity_id   uuid not null,
  created_at  timestamptz not null default now(),
  primary key (profile_id, entity_type, entity_id)
);

alter table public.saves enable row level security;

create policy "Read your own saves" on public.saves
  for select to authenticated using (profile_id = auth.uid());
create policy "Save as yourself" on public.saves
  for insert to authenticated with check (profile_id = auth.uid());
create policy "Unsave your own" on public.saves
  for delete to authenticated using (profile_id = auth.uid());

create index saves_recent_idx on public.saves (profile_id, entity_type, created_at desc);
```

The composite primary key does three jobs: uniqueness, an idempotent
`insert … on conflict do nothing`, and a direct index hit for "is this one
saved". No surrogate `id` — nothing ever references a save row.

**`entity_id` carries no foreign key, and cannot.** That is the price of one
polymorphic table. Deleting a tutorial leaves an orphan row, which decision 7
makes harmless: the read path never sees it. Cleanup is a future cron or
nothing.

The alternative, five tables with real foreign keys and cascade delete, buys
referential integrity for five tables, five RLS policy pairs, five route
handlers and a union query — five copies of a table whose only columns are who,
what and when.

**No admin policy, deliberately.** `041_toy_idea_reports` granted admins full
access because a report is something an admin acts on; a bookmark is not. With
no policy defined for a role, every select by that role returns zero rows
regardless of what `004`'s default privileges grant — the same mechanism 041
documents, used for the opposite purpose.

### 2. `packages/api/src/routes/saves.ts`

| Route | Returns |
|---|---|
| `GET /api/saves/ids` | `{ tutorials: string[], toys: string[], challenges: string[] }` |
| `GET /api/saves/:slug` | Saved entities of one type, newest-saved first |
| `POST /api/saves` | `{ entity_type, entity_id }` → 201, idempotent |
| `DELETE /api/saves/:slug/:id` | 204, idempotent |

**The list is two queries, not a join.** `entity_id` has no foreign key, so
PostgREST cannot embed it. Fetch the save rows for that type, then fetch those
entities by id through the user client; RLS drops what the caller cannot see,
which is where decision 7 comes from. Re-sort by the save's `created_at`
afterwards, because the second query returns entity order.

**One object decides which types are live**, keyed by the URL slug:

```ts
const SOURCE = {
  tutorials:  { type: 'tutorial',  table: 'tutorials',
                select: '*, tutorial_orgs(status, organizations(id, name))',
                filter: (q) => q.eq('status', 'approved') },
  toys:       { type: 'toy',       table: 'toys',
                select: '*, profiles(name), organizations(name)',
                filter: (q) => q.eq('status', 'published').is('archived_at', null) },
  challenges: { type: 'challenge', table: 'toy_ideas',
                select: '*',
                filter: (q) => q.eq('status', 'challenge') },
}
```

The select strings are copied from `routes/public.ts` on purpose: a saved list
returns the same shape the public list does, so `TutorialCard` and
`ToyLibraryCard` render it unchanged. `organisation` and `printable_part` are in
the enum and absent here, so their routes 404 until someone adds a line —
placeholder-ness lives in one object rather than five conditionals. The web
route reads the same map, so one missing key produces both the API 404 and the
page's `notFound()`.

**`POST` does not verify the entity exists or is visible to the caller.** Saving
a uuid you cannot see succeeds and then never appears in your list. It is not an
oracle — success and failure are indistinguishable to the caller either way —
and the alternative is an extra select on every save to prevent a row that costs
nothing.

`GET /api/saves/ids` is what browse pages call: one request per page load, and
`/library` renders a hundred cards off a single array lookup.

### 3. `components/save-button.tsx`

```tsx
<SaveButton type="tutorial" id={t.id} saved={saved} signedIn={signedIn} />
```

Signed in: optimistic toggle, `POST`/`DELETE`, revert and toast on failure
(`components/toast.tsx`). Signed out: `router.push` to
`/signup?next=<encoded pathname>&reason=save`.

`signedIn` is not fetched by the button. Every page that opts a card in already
calls `getCapabilities()`, so it passes `caps !== null` down and fetches
`/api/saves/ids` only when that is true. A signed-out browse page makes no extra
request.

Drawn values, recorded here because the mockup lives in a gitignored directory:
34x34px, white fill, `3px solid` ink border, `8px` radius, `3px 3px 0` ink
shadow, apricot fill when saved, and a 12x15px bookmark glyph stroked at 2px,
filled when active. Every one is from the board's measured vocabulary — the
board itself draws no save control anywhere.

### 4. The three cards — opt in, never opt out

```tsx
export function TutorialCard({ tutorial, save }: { tutorial: Listed; save?: SaveProps })
```

Omit `save` and the card is byte-identical to today: no wrapper, no button. That
default is load-bearing. `TutorialCard` renders on `/dashboard/profile` and
`ChallengeCard` on `/dashboard/challenges` — both of which show your own work,
where a save button reads as a bug. Default-off keeps them correct by doing
nothing, rather than by remembering to switch something off.

**On:** `/library`, `/toy-library`, `/get-involved/design-challenges`,
`/contributors/[id]`, `/organizations/[id]/public`.
**Off:** the three dashboard pages, and `app/page.tsx` — the homepage is a shop
window, not a browse tool.

When on:

```tsx
<div className="save-host group relative">
  <Link className="card-pixel card-link …">…</Link>
  <SaveButton className="absolute right-2.5 top-2.5" … />
</div>
```

**The trap, stated so the implementer cannot walk into it.** `globals.css`'s
shared press-motion block lifts `.card-pixel` 2px on hover and drops it
`--pop-rest` on press. The button is a sibling, so it does not move — the card
slides out from under its own control. It needs the same travel under
`.save-host:hover`, **in its own rule**. Do not append `.save-host` to the
existing comma-grouped family selector: Tailwind compiles a comma group into a
single `:is()`, `:is()` takes the specificity of its most specific argument, and
that is the bug that once made every press on the site travel zero distance
while nothing errored. The rule also goes behind `@media (hover: hover)`, or a
tapped card stays stuck lifted on a phone.

### 5. Detail pages

`/tutorials/[id]`, `/toy-library/[id]` and
`/get-involved/design-challenges/[id]` gain a plain `.btn` in the header row
beside the existing actions. No overlay, no positioning.

### 6. `/signup` and the confirm round trip

- Renders "You need an account to save things" above the form when
  `reason=save`.
- `emailRedirectTo` becomes `${window.location.origin}/auth/confirmed?next=${next}`
  (currently a bare `/auth/confirmed`).
- `/auth/confirmed` honours `next` in its redirect.

### 7. `lib/nav-model.ts` — one row

`Saved`, first in the Account group, ahead of Notifications and Account. That
single line produces the rail row **and** the eighth My SPLAT card, because the
hub is built from `buildNav`.

### 8. `app/dashboard/saved/page.tsx` — the hub

`HubGrid` twice, with headings: **Ready now** (Tutorials, Toys, Design
challenges) and **Coming soon** (Organisations, Printable parts). Five cards at
4-up would be four plus a stranded one; the split is not tidying, it is the line
between the working three and the placeholders.

**No count badge.** It would cost another round trip in the root layout, and
unlike unread notifications a saved count is not something you act on.

### 9. `app/dashboard/saved/[type]/page.tsx` — the lists

One dynamic route, not three pages. The slug keys `SOURCE`; an unknown slug is
`notFound()`. Renders that type's existing card component **with** the save
control, filled — that is the unsave affordance, and clicking it removes the
card optimistically. No separate delete UI.

Empty state per type: one line and a link to that type's public library.

### 10. Destination page buttons

The half of the signposts spec's task 5 that was blocked:

- `/dashboard/tutorials` → "Saved tutorials" → `/dashboard/saved/tutorials`
- `/dashboard/toys` → "Saved toys" → `/dashboard/saved/toys`
- `/dashboard/challenges` → "Saved challenges" → `/dashboard/saved/challenges`

Secondary `.btn` beside the existing primary action, as that spec specified.

## Testing impact

**Unit** (`packages/web/tests/unit/`):

- `components/save-button.test.tsx` — toggle, optimistic revert on a failed
  request, and the signed-out click landing on `/signup?next=…&reason=save`.
- `components/tutorial-card.test.tsx` and siblings — **no wrapper and no button
  when `save` is omitted.** This is the assertion that pins section 4's default
  and keeps the three dashboard pages correct.
- `pages/saved-hub.test.tsx` — five cards, two groups, two marked `SOON`.
- `pages/saved-list.test.tsx` — an unknown slug calls `notFound()`.
- `lib/nav-model.test.ts` — the `Saved` row, in the Account group, first.
- `lib/press-motion.test.ts` — the save button's hover rule is its own selector,
  not a member of the comma group. Mutation-check it by adding `.save-host` to
  the group and confirming the test fails.

**Integration** (`packages/api/tests/integration/saves/`): the existing
per-route directory pattern. Idempotent insert, delete of a row you do not own
affecting nothing, and the list dropping an entity RLS hides — that last one is
decision 7's only real guard.

**The known gap, unchanged from the last three sessions.** Integration and E2E
both need a local Supabase and there has never been one available. RLS behaviour
is asserted here but unverified by a run. Establish a green baseline on
`development` first, or a red run will look like this branch's fault when it is
not.

## Out of scope

- **Public save counts** ("12 people saved this"). Nothing asked for it, and it
  turns a private bookmark into a social signal, which is a different feature.
- **Saving from the mobile app.** `packages/mobile` is untouched.
- **Controls and lists for organisations and printable parts** — decision 1.
  They exist as enum values and `SOON` cards only.
- **Replaying the pending save after signup** — decision 6.
- **Cleaning up orphaned rows** after a hard delete. Dead storage, invisible to
  every reader.

## Risks

**The tint wall, louder.** Decision 8 takes My SPLAT to eight brand-tint cards
in one flat grid, which is the thing the 27 Aug spec argues against and the
signposts spec already overrode once. The remedy is unchanged and cheap — two
`HubGrid` calls, which five other hub pages already do — but it stays unjudged
until the page is built and looked at.

**The press-motion rule.** Section 4 names the trap because this file has set it
three times. The failure mode is silent: nothing errors, no test goes red
without the one specified above, and the page just feels dead.

**A control on a card that was not designed to carry one.** The overlay covers
the top-right corner of every photo on five pages, saved or not. It is drawn at
34px over a 112px photo, which is small, but no artboard covers it — the board
draws no save control anywhere. This is a derivation from the board's vocabulary
(3px ink border, 8px radius, 3px hard shadow, apricot fill when active), not
something it sanctions.

**`saves` is the first polymorphic table in this schema.** Every other join
table in the repo carries real foreign keys. The reasoning is in section 1 and
holds, but it is a new pattern and the next person to add an entity type must
know to add it to the enum *and* to `SOURCE`, or it will half-exist.
