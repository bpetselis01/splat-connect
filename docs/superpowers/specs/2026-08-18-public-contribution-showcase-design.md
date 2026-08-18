# Public Contribution Showcase

**Status:** Approved, ready to implement
**Date:** 2026-08-18

## Why

The platform runs on three kinds of unpaid work: contributors design printable
toys (tutorials), people and organisations give physical toys, and organisations
vouch for and approve projects. None of it is visible to a logged-out visitor as
a body of work. A contributor's name appears on the tutorials they are credited
on (migration `023`) and an organisation has a directory entry, but nothing
gathers "here is everything this person/org has done" or says, in one place,
"this is what the community has made and given."

This adds a public **impact wall** — the hub — with named cards that lead into
per-entity **profile pages** — the destination.

## Scope

- A public wall at `/impact`: headline totals across all three contribution
  types, a "recently active" strip, and an unranked grid of contributor and
  organisation cards.
- A public contributor profile at `/contributors/[id]`.
- A public organisation profile (a genuinely public view — the existing
  `/organizations/[id]` route is the leader dashboard and is left untouched).
- An opt-out control for individuals.

Out of scope: ranking/leaderboards, per-entity vanity metrics beyond the counts
below, editing a public bio, and any change to how per-tutorial credit already
renders.

## Decisions taken (from the design session)

| Question | Choice |
|----------|--------|
| Form | Global wall (hub) that links into per-entity profiles |
| What counts | All three: tutorials made, toys given, org backing/review |
| Individual consent | **Opt-out** — shown by default, a dashboard toggle hides |
| Tone / ordering | Hybrid: headline stats + **unranked** grid; no leaderboard |
| Toys metric | **Both** figures — toys *shared* (listed) and toys *delivered* (completed) |
| Contributor eligibility for a tutorial | Any tutorial they are a `tutorial_contributor` of, any role |
| Wall layout | **C** — stats band → recently-active strip → unified grid |
| Profile layout | **Tabbed** — server-fetched data, thin client tab switcher |

## Security posture

This is the load-bearing decision. Everything the wall and profiles read is
served by **dedicated `/api/public/*` endpoints, mounted before `authMiddleware`,
using the anon Supabase client** — the exact pattern `routes/public.ts` already
establishes for tutorials and toys, where RLS enforces the public filter as a
database-level backstop behind each query's own explicit filter.

We do **not** extend the authenticated endpoints to also serve logged-out users,
because:

- **No field drift.** Each public endpoint hand-writes its `select`. It cannot
  inherit a sensitive column later added to a shared select. `profiles` holds
  `email`; `GET /api/organizations/:id` returns `org_leaders` (user ids);
  transactions carry pickup addresses — none of that may reach the public.
- **RLS stays a backstop.** Authenticated endpoints frequently use the admin
  (service-role) client, which bypasses RLS entirely. The anon client keeps the
  database as a second gate, so a wrong query alone cannot leak a private row.
- **No auth-state branching.** One handler emitting both public and privileged
  output (as `/organizations/[id]` does via `isOrgLeader`) is where
  object-level-authorization bugs hide. Separate endpoints, separate code paths.

**Defence in depth for the opt-out:** the `public_showcase` flag and the
"≥1 public contribution" eligibility are enforced at **both** the query filter
**and** an anon-role RLS policy. A coding slip alone must not expose an
opted-out person.

## Schema

One migration (`034_public_showcase.sql`).

```sql
alter table public.profiles
  add column public_showcase boolean not null default true;
```

- **Default `true`** — opt-out, matching the decision.
- **RLS.** Migration `023` already exposes a profile's `name` publicly *when it
  is a contributor on an approved tutorial*. This widens public read of
  `name` (and `public_showcase`) to any profile that is publicly eligible —
  i.e. a contributor on an approved tutorial **or** an owner of a published /
  delivered toy — **and** has `public_showcase = true`. The policy is the
  database half of eligibility; the endpoint query is the application half.
- **No new columns for counts.** Every total is computed at read time.

No backfill: existing profiles get `true`, which is the intended default.

## API — all in `routes/public.ts` (anon client)

### `GET /api/public/impact`
Returns the wall payload:
```
{
  totals: { tutorials, toysShared, toysDelivered, contributors, organisations },
  recent: Array<{ kind: 'person' | 'org', id, name, at }>,   // distinct, ≤8, recency-ordered
  contributors: Array<{ id, name, tutorials, toysShared, toysDelivered }>,
  organisations: Array<{ id, name, tutorials, toysShared, toysDelivered, projectsBacked }>
}
```
Counting rules:
- **tutorials** — `status = 'approved'`. A person counts for any tutorial they
  are a `tutorial_contributor` of (any role); an org for any it `accepted`-backed
  or approved (`reviewed_for_org_id`).
- **toysShared** — `toys.status = 'published'`, `archived_at is null`, grouped by
  `owner_id` / `owner_org_id`.
- **toysDelivered** — `toy_transactions.status = 'completed'`, grouped by the
  giving side (`owner_id` / `owner_org_id`).
- **eligibility** — an entity appears only with ≥1 of the above; a person also
  requires `public_showcase = true`.

### `GET /api/public/contributors/:id`
```
{ id, name, tutorials: Tutorial[], toysShared: Toy[], toysDelivered: Toy[] }
```
Returns **404** for an unknown id, an opted-out person, or a person with zero
public contributions — indistinguishable from nonexistent, the same treatment
`GET /api/public/toys/:id` already gives an unpublished toy.

### `GET /api/public/organizations/:id`
```
{ id, name, status, tutorialsBacked: Tutorial[], tutorialsApproved: Tutorial[],
  toysShared: Toy[], toysDelivered: Toy[] }
```
A dedicated public projection — it never returns `org_leaders`, agreements, or
any leader-only field. 404 for unknown or zero-contribution orgs (a suspended
org that has contributed still shows, marked, consistent with the directory).

## Screens

### `/impact` — the wall (layout C)
1. **Stats band** — the five `totals` as large numbers.
2. **Recently active strip** — horizontal, the `recent` entities as small cards,
   recency-ordered, explicitly not a ranking.
3. **Unified grid** — one grid of all eligible contributor and org cards, each
   badged person/org, each showing its counts. Cards link to the profile.

Server component. On API failure it renders an empty state rather than crashing
(the `/toy-library` page's swallow-to-`[]` pattern).

### `/contributors/[id]` and the org profile — tabbed
Identity header (avatar, name, headline counts) + tabs. Contributor tabs:
**Tutorials**, **Toys given**. Org profile: square avatar and an extra
**Projects** tab (backed / approved). Data is fetched in the server component and
passed to a thin client component that only toggles the visible tab — no data
crosses the client boundary that the server did not already choose to expose.
Reuses the existing `tutorial-card` and toy card components.

### Consent toggle
A "Show my contributions publicly" switch in the contributor's dashboard profile
settings, bound to `public_showcase`. Off → removed from the wall, `/contributors/[id]`
404s, impact totals stop counting them. Existing per-tutorial credit is
unchanged. Orgs have no toggle.

## Navigation

A top-level public "Impact" link enters the wall. Names that are already public
(tutorial credits, org directory) link into the corresponding profile where the
entity is eligible.

## Consequences

- **A person's name is already public on approved tutorials** (`023`). The
  opt-out governs the *showcase aggregation* — the wall, the profile page, the
  totals — not the existing per-tutorial credit line, which is unchanged.
- **Counts are computed per request.** At current scale this is cheaper than
  maintaining denormalised counters; if `/impact` becomes hot, the upgrade path
  is a cached materialised view, not stored columns on `profiles`.
- **No backfill, no change to existing rows or endpoints.** The authenticated
  org and profile endpoints are untouched.

## Testing

- **API integration** (`packages/api`, against local Supabase):
  - `/api/public/impact` — totals correct across the three types; an opted-out
    person is absent from totals, `contributors`, and `recent`.
  - `/api/public/contributors/:id` — 200 for an eligible person; 404 for
    unknown, opted-out, and zero-contribution.
  - `/api/public/organizations/:id` — 200 with only public fields; asserts
    `org_leaders`/email never appear in the body.
  - **RLS**: a hand-crafted anon query for an opted-out profile's `name` returns
    nothing — proving the database backstop, not just the app filter.
- **Web e2e** (`packages/web`): wall → click a card → profile → switch tabs.
