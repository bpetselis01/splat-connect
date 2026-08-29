# Tutorial kinds and recommendations

**Date:** 2026-08-29
**Status:** Design, awaiting review. Not committed.
**Touches:** `tutorials` (one column), one new table, `lib/edit-steps.ts`,
`lib/validation.ts`, `/upload`, the edit page, `tutorial-view.tsx`,
`tutorial-card.tsx`, three API routes, `seed.sql`.

## Why

SPLAT has one tutorial pipeline and it is the right shape for a toy adaptation.
It also carries an optional STL step, because some tutorials are not toy
adaptations at all — they are assistive-tech builds whose whole point is the
printed part. Nothing in the data says which is which. A contributor writing a
toy tutorial sees an STL pill and wonders whether they should fill it; a
contributor writing an assistive-tech tutorial is asked for a "toy photo".
Print requests (`/printing/requests`, still `ComingSoon`) will one day need to
find the printable tutorials, and today they cannot.

The ask was a second pipeline. The critique, accepted 2026-08-29: the two
pipelines differ by exactly one step, and this repo already deleted a parallel
implementation of this walk once (`new-tutorial-form.tsx` explains why).
A discriminator column expresses the difference; a second pipeline would
duplicate the stepper, the review path, the public renderer and every future
feature for one boolean's worth of divergence. Picking the wrong pipeline is
also *less* recoverable than picking the wrong value in a select.

The second ask — creators pointing readers at up to three other tutorials — is
the genuinely new feature, and it is kind-agnostic.

## Decisions taken

All Byron's, 2026-08-29.

1. **One `tutorials` table, a `kind` column.** `toy_adaptation` |
   `assistive_tech`. Not two tables, not two pipelines.
2. **STL is a step only for assistive tech, and there it is required.** A toy
   adaptation never shows the pill. Today STL is optional for everyone, which
   is half of what made it ambiguous.
3. **Recommendations can point at either kind.** Toy → tech, tech → toy,
   toy → toy. No cross-kind constraint.
4. **Unapproved recommendations are filtered out at read time, not shown as a
   locked door.** The original ask was a "not yet approved, please wait" page.
   Rejected: "please wait" is untrue for a rejected tutorial; it leaks titles
   of unapproved drafts; and this editor flips `approved → pending` on any
   details or file save, so the door would lock and unlock as a matter of
   routine. Instead the public API drops them, the same way it already drops
   `tutorial_orgs` that are not `accepted`. The creator sees all three in the
   editor with a badge saying which are hidden.
5. **`stl_files` and the `stl-files` bucket stay.** Their data was purged from
   the live project on 2026-08-29 (5 rows, 5 objects, all on toy tutorials —
   the same two Jimmy switch files uploaded three times). The assistive-tech
   kind reuses both as they are.
6. **`kind` is editable after creation.** It sits in Details as a select.
   This is the recovery path decision 1 buys; hiding it would throw that away.
7. **The 3-cap lives in the schema, not in code.** `position smallint check
   (position between 1 and 3)` plus `unique (tutorial_id, position)`. Matches
   how `toys_one_owner` and `toys_person_single_unit` do it (033). No trigger.

## Data

### `048_tutorial_kind.sql`

```sql
alter table public.tutorials
  add column kind text not null default 'toy_adaptation'
    check (kind in ('toy_adaptation', 'assistive_tech'));
```

No backfill. Every existing row is a toy adaptation and the default says so.
The STL purge above is what makes that statement true.

```sql
create table public.tutorial_recommendations (
  tutorial_id    uuid not null references public.tutorials on delete cascade,
  recommended_id uuid not null references public.tutorials on delete cascade,
  position       smallint not null check (position between 1 and 3),
  primary key (tutorial_id, recommended_id),
  unique (tutorial_id, position),
  check (tutorial_id <> recommended_id)
);
```

RLS mirrors `parts` (001) policy for policy:

- "Anyone can read recommendations of approved tutorials" — select where the
  *owning* tutorial is approved. Whether the *target* is approved is the API's
  concern (below), not RLS's: the contributor needs to read their own
  unapproved targets to see the badge.
- "Contributors can read own tutorial recommendations" — select where the
  reader has a `tutorial_contributors` row on `tutorial_id`.
- "Contributors can write own tutorial recommendations" — `for all`, same
  predicate, using and with check.
- "Admin full access to tutorial_recommendations".

Applied twice, per `supabase-project-topology`: `supabase db push` for the
linked project and `supabase migration up --local` for the E2E stack.
`SCHEMA.md` gains both.

### Types (`packages/types`)

```ts
export type TutorialKind = 'toy_adaptation' | 'assistive_tech'
export const KIND_LABEL: Record<TutorialKind, string> = {
  toy_adaptation: 'Toy adaptation',
  assistive_tech: 'Assistive tech',
}
// Tutorial gains: kind: TutorialKind

/** One row of tutorial_recommendations with its target embedded. status is
 *  present on the contributor-facing payload so the editor can badge a target
 *  that is not yet public; the public route strips unapproved rows entirely. */
export interface Recommendation {
  position: 1 | 2 | 3
  tutorials: Pick<Tutorial, 'id' | 'title' | 'kind' | 'difficulty' | 'toy_photo_url' | 'status'>
}
// TutorialWithDetails gains: tutorial_recommendations: Recommendation[]
```

`KIND_LABEL` is the one place the display names live. `toy_photo_url` keeps
its column and property name — renaming it is a migration, a storage bucket
rename and thirty call sites for no behaviour — but the UI says "Photo".

## API

### `POST /api/tutorials`

Inserts `kind: body.kind ?? 'toy_adaptation'`. Anything not in the check
constraint is a 500 from Postgres today; that is consistent with how
`difficulty` is treated and is not being changed here.

### `PATCH /api/tutorials/:id`

`kind` joins `EDITABLE`. No special handling: a tutorial switched from tech to
toy keeps any `stl_files` rows, which are simply never rendered or required for
that kind. Switching back finds them where they were.

### `POST` / `DELETE /api/tutorials/:id/recommendations`

`packages/api/src/routes/recommendations.ts` — one `subResourceRoutes()` call,
the shape of `stl-files.ts`:

```ts
subResourceRoutes<{ recommended_id: string }>({
  path: 'recommendations',
  table: 'tutorial_recommendations',
  bodyKey: 'recommendations',
  mapRow: (r, tutorialId, index) => ({
    tutorial_id: tutorialId,
    recommended_id: r.recommended_id,
    position: index + 1,
  }),
})
```

`mapRow` gains a third `index` argument; the existing three callers ignore it.
Replace-all semantics come free. A fourth row, a duplicate or a self-reference
is rejected by the constraints and surfaces as the route's existing 500 with
the Postgres message — the editor never offers a fourth slot, so this is a
backstop, not a UX path.

### Embeds

`GET /api/tutorials/:id` and `GET /api/public/tutorials/:id` both add

```
tutorial_recommendations(position, tutorials!recommended_id(id, title, kind, difficulty, toy_photo_url, status))
```

ordered by `position`. The public route then filters
`tutorial_recommendations` to `tutorials.status === 'approved'` on the same
lines that filter `tutorial_orgs` to `accepted`. The contributor route does
not filter.

`GET /api/public/tutorials` already returns `*`, so `kind` rides along with no
change. No `?kind=` filter in this spec.

The picker's source is `GET /api/public/tutorials` — approved tutorials only,
already exists. The current tutorial is excluded client-side.

## Create — `/upload`

Above the Details form, two cards:

| | |
|---|---|
| **Toy adaptation** | Switch-adapt a toy that already exists. Guide, photo, parts and tools. |
| **Assistive tech** | A build whose heart is a printed part. Everything a toy adaptation has, plus the STL files to print it. |

Each is `<Link href="/upload?kind=…">`. The page stays a server component and
reads `searchParams.kind`; nothing selected renders the cards alone with the
pill row locked and no form. `NewTutorialForm` gets `kind` as a prop and posts
it. `LOCKED` becomes a function of kind: the STL pill is present only for
`assistive_tech`. The heading copy names the kind ("New toy adaptation").

This is where "which pipeline am I in" is settled — by a choice with a
sentence under it, not by a table.

## Edit

### `lib/edit-steps.ts`

- `stepsFor(kind)` returns the ordered `EditStepId[]`; `stl` is in it only for
  `assistive_tech`. The edit page and `/upload` both consume it so the two
  pill rows cannot drift.
- `REQUIRED` gains `{ step: 'stl', fields: { 'At least one STL file': 'A 3D-print file' } }`.
  `missingByStep` and `computeStepStatuses` work unchanged because
  `getMissingFields` only emits that label for the right kind.
- `computeStepStatuses` computes `stl` through `fieldStatus` like the other
  required steps instead of its own `length > 0` rule, so a tech tutorial with
  no files gets an attention dot. For a toy the value is `done` (nothing
  missing) and never read, because the pill is not in `stepsFor`.

### `lib/validation.ts`

```ts
if (tutorial.kind === 'assistive_tech' && tutorial.stl_files.length === 0)
  missing.push('At least one STL file')
```

The "Toy photo" label becomes "Photo" for both kinds (the `REQUIRED` display
name changes with it).

### Details step

A `kind` select beside difficulty, using `KIND_LABEL`. Saves through the
existing `saveDetails` patch. Changing it re-renders the pill row on
revalidate.

### "Recommended" — a second trailing pill

Placed beside Team, off the walk, for the reason Team is: nothing here is
required, and a submit button beside a picker only asks what it would submit.
`EditStepId` gains `'recommended'`; `computeStepStatuses` returns `done` when
any row exists, else `neutral`.

`components/edit-recommendations-section.tsx`:

- Three slots. A filled slot shows the target as a `TutorialCard` (kind badge
  included) with a remove control. When the target's `status !== 'approved'`,
  the slot carries a tag: **Not yet approved — hidden from the public page.**
- An empty slot (while fewer than three) is a search-select over
  `/api/public/tutorials` minus the current tutorial and minus already-chosen
  ids. Approved tutorials only, by construction of that endpoint.
- Save posts the full list to `/recommendations` through a server action on
  the edit page, the way `saveParts` does. Uses `useSaveOnLeave` like the
  other panels.

## Public

### `tutorial-view.tsx`

- "Files for 3D printing" renders only when `tutorial.kind === 'assistive_tech'`
  and there are files. The kind guard is belt-and-braces today (toys have no
  rows) and load-bearing the day someone switches a tech tutorial to toy.
- New section after the reference column, **"Also worth a look"**: up to three
  `TutorialCard`s from `tutorial_recommendations`, in position order. Rendered
  only when the list is non-empty. On the public page the list is already
  filtered, so this component never has an unapproved target to hide. On the
  two review pages (leader, admin) it may, and there the card gets the same
  "Not yet approved" tag the editor uses — a reviewer should know the
  recommendation exists even though a parent cannot follow it yet.
- A kind badge in the header next to `DifficultyBadge`.

### `tutorial-card.tsx`

A kind badge, so `/library` tells the two apart at a glance. Filtering the
library by kind is a follow-up.

### Mobile

`TutorialDetail` type gains `kind`. No rendering change: the STL list is empty
for toys now, and recommendations on mobile are out of scope.

## Tests

Unit (web):
- `edit-steps.test.ts`: `stepsFor('toy_adaptation')` omits `stl`;
  `stepsFor('assistive_tech')` includes it between tools and review.
- `validation.test.ts`: tech with no STL reports "At least one STL file"; toy
  with no STL reports nothing for it; "Photo" replaces "Toy photo".
- `upload` page: renders two kind cards; with `?kind=assistive_tech` renders
  the form and an STL pill; with `?kind=toy_adaptation` renders no STL pill.
- `tutorial-view.test.tsx`: STL section absent for a toy with STL rows; "Also
  worth a look" renders three cards in position order; unapproved target is
  tagged on the review render.
- `edit-recommendations-section.test.tsx`: fourth slot never offered; current
  tutorial not in the picker; remove clears a slot; unapproved target tagged.

Unit (api):
- `public.test.ts`: `/tutorials/:id` drops recommendations whose target is not
  approved and keeps the rest in position order.
- `tutorials.test.ts`: POST inserts `kind`; POST defaults to `toy_adaptation`;
  PATCH accepts `kind`.
- `recommendations.test.ts`: rows carry `position = index + 1`.

Integration (api, local stack):
- Fourth recommendation, duplicate target and self-reference each fail on the
  constraint. Cascade on tutorial delete removes both directions.
- Public read of recommendations on a draft tutorial returns nothing (RLS).

E2E:
- `upload-flow.spec.ts`: picks Assistive tech, sees the STL pill, cannot submit
  without an STL. Picks Toy adaptation, never sees the pill.

Seed: `seed.sql` line 84 attaches `mount.stl` to tutorial `aaaa…`. That
tutorial becomes `kind = 'assistive_tech'` so the seed stays valid under the
new required-STL rule. One additional toy tutorial recommending it gives the
public page something to render.

## Out of scope, on purpose

- A trigger for the 3-cap — `position` does it.
- `assistive_tech_details` or any kind-specific columns. Nothing to put there
  yet. When print requests need sizing or material, that is a side table
  keyed on `tutorial_id`, not a change to this design. The real fit data
  already lives on `child_profiles` (`palm_width_mm`, `wrist_circ_mm`,
  `needs_arm_attachment`).
- `/library?kind=` filtering.
- Recommendations on mobile.
- Renaming `toy_photo_url`.
- A "not approved" interstitial page. Decision 4.
