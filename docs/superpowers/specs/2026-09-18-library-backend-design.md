# Guides library: build time, thanks, sort, stats

**Date:** 2026-09-18 · **Board:** `SPLAT Connect - Web.dc.html`, screen "Guides library" (`#library`) · **Live:** `/library`

The board's guides library draws five things the live page cannot, because the
data behind them does not exist: a build time per guide, a Time facet with
"Needs printing", a sort menu, a thanks count per card, and hero stats about
people rather than guides. This spec adds the backend for each and brings the
page to the board.

"Pick for my child" (child → guide matching) is **out of scope**: it is its own
round, designed with the Child profile wizard screen, because Byron is weighing
a simple recommendation system. Until then the button reaches the existing
wizard.

## 1. Build time

- `tutorials.build_minutes int` — nullable, `check (build_minutes between 1 and 600)`.
  Nullable because a new draft has no time yet; compulsory at submission.
- Migration backfills every existing tutorial with a random pick from the
  editor's options between 15 min and 2 h (dev data; nothing is public yet —
  Byron's instruction).
- **Editor, Details step**, beside Difficulty: a select, "About how long does
  it take?", options 10, 15, 20, 30, 45 min, 1, 1.5, 2, 3, 4 h (stored in
  minutes). Help text: *"Hands-on time only — printing time isn't included."*
  The board's editor implies printing is included; Byron overrode that.
- Mobile tutorial editor (`details-section.tsx`) gets the same field.
- **Gate:** `PATCH /api/tutorials/:id` refuses `status: 'pending'` when
  `build_minutes` is null, beside the safety-declaration gate. Web
  `getMissingFields()` reports it against the `details` step so the stepper
  shows the hazard dot.
- Display: `formatBuildTime(min)` in `packages/types` — `< 60` → `"20 min"`,
  otherwise hours with at most one decimal → `"1 h"`, `"1.5 h"`.

## 2. Needs printing

A guide needs printing iff it has at least one `stl_files` row. Only assistive
tech guides have the STL step (`stepsFor()`), so a toy guide never matches.
The public list returns `has_stl: boolean`, another computed field. 066 made
it `security invoker`; that ran `stl_files`' RLS per row with no index on
`tutorial_id` and timed the list out at 437 guides, so 067 makes it
`security definer` and adds the index (3 s → 50 ms).

Card: a violet "Needs printing" chip (cube glyph) after the kind chip — option
C of the mockup (https://claude.ai/artifact/GDpKZdLAyt4EbwJLfsgeHH). It wraps
the chip row onto two lines on printable guides; Byron accepted that.

## 3. Thanks

One tap, one count. A parent thanks a guide; its public number goes up by one.
No note (the contributor-profile thanks wall is a later round).

- `tutorial_thanks (tutorial_id → tutorials on delete cascade, profile_id →
  profiles on delete cascade, created_at, primary key (tutorial_id, profile_id))`.
- RLS: a user can select and insert **only their own rows**. Who thanked what is
  private — it reveals which accounts have a disabled child.
- `thanks_count(tutorials)`, a `security definer` PostgREST computed field:
  any select can name it (`*, thanks_count`) and gets a number, never the rows.
  *Changed from a counter column during implementation:* 014's `set_updated_at`
  trigger would have stamped every thank onto `tutorials.updated_at`, and the
  editor's optimistic-concurrency check would then tell an author mid-edit that
  someone else had changed their guide.
- Guides only, with a real foreign key — not a polymorphic table like `saves`.
  Other thank targets (holders, printers, organisations) will need a migration
  regardless, and the FK gives cascade deletes for free.
- `POST /api/tutorials/:id/thanks` (signed in):
  - 404 unless the guide is approved;
  - 403 if the caller is a credited contributor ("You can't thank your own guide");
  - 409 on a repeat ("You already thanked them");
  - 201 `{ thanks_count }`, and a `tutorial_thanked` notification to every
    credited contributor.
- `GET /api/tutorials/:id/thanks` → `{ thanked, own }` for the caller; the detail page asks only when signed in.
- `tutorial_thanked` joins `NotificationType`, bucket `tutorials`, and the
  notifications `type` check constraint.
- **Guide detail:** "Say thanks" button (hand-heart, coral) beside the existing
  actions. Signed out → `/signup?next=/tutorials/<id>&reason=thanks`. After
  thanking, it reads "Thanked" and is disabled. Hidden on your own guide.

## 4. The library page

- **Rail:** the search box goes (the header search submits `?q=`, which stays as
  a removable chip). Three facets, **one choice per group** (tapping the chosen
  option clears it), as the board draws them:
  - *Guide type* — Toy adaptation guide · Assistive tech guide
  - *Your skill level* — Easy · Medium · Hard
  - *Time* — Under 30 min (≤ 30) · Under 1 hour (≤ 60, so it includes the
    under-30s) · Needs printing (`has_stl`). Time buckets read hands-on time only.
- **Sort:** a menu (Date added · Difficulty · Build time, each with its hint
  line) plus a direction button. Defaults: Date added newest first; Difficulty
  easiest first; Build time quickest first. Date added = `reviewed_at`
  (falling back to `created_at`). A guide without a time sorts last in either
  direction.
- **Card footer:** clock + time · hand-heart + thanks count · Backed pill.
- **Hero:** the board's lede, ending "About $30 of parts and a screwdriver."
  Stats: reviewed guides · contributors · organisations backing, from
  `GET /api/public/tutorials/stats` → `{ guides, contributors, organisations }`
  over the public listing (approved + complete). Contributors = distinct
  credited people; organisations = distinct orgs with an accepted backing.
- **"Pick for my child"** (hero button and rail note) → `/onboarding/child`;
  the rail note copy is the board's ("Answer five quick questions…").
  Signed-out visitors go to `/signup?next=/onboarding/child&reason=child`,
  which says why an account is needed (the wizard's own guard sends to /login).

## Out of scope

Child matching / recommendations · thanks for other targets · thanks notes ·
time and thanks on the phone's library screen (mobile gets the editor field only).

## Testing

- API unit: submit gate on `build_minutes`; thanks — happy path, repeat (409),
  own guide (403), unapproved (404), notification fan-out. Stats verified
  against the running API (no unit test — three counts over one select).
- Web unit: facet filtering (single-select, u60 ⊇ u30, needs printing), sort
  (direction, nulls last), card chip + footer, `formatBuildTime`.
- Migration applied to the hosted development project and the local stack;
  verified by querying the column, computed fields, RLS and backfill directly.
- E2E `tests/e2e/public/library.spec.ts` (rewritten — it asserted a heading and
  search box that no longer existed): listing, ?q= chip, Time + Needs printing,
  sort + flip, thank once, signed-out thank → signup.
