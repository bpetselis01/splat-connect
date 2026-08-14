# Toy library — public browse page (part 2 of the toy-exchange feature)

## Scope

Part 2 of the feature `2026-08-11-my-toys-design.md` deferred: the public,
unauthenticated `/toy-library` browse page, listing every account's
**published** toys. `/toy-library` currently renders `<ComingSoon>`; this
spec replaces it. Out of scope: offering/matching a toy for exchange and the
org `/dashboard/organisation/toys` inventory — still later parts of the same
feature.

Alongside the new routes, this pass also hardens `public.ts`'s data access:
see "Anon client for public routes" below.

## Anon client for public routes

`public.ts` currently uses `createAdminClient()` (bypasses RLS) for both
existing tutorial routes, filtering to `status = 'approved'` by hand in the
query. That filter is correct today, but it's the only thing standing
between the internet and every draft/pending row — nothing at the database
layer backs it up, so a future query added to this file that forgets the
filter leaks silently.

The `toys` RLS policy (`status = 'published' or owner_id = auth.uid()`)
already produces the identical result for an unauthenticated caller:
`auth.uid()` is `NULL` for a request with no JWT, so the policy collapses to
`status = 'published'`. Same is true of tutorials' RLS. So a plain anon-key
client, with RLS still enforced, returns the same rows as today's admin
client + manual filter — but with the database as a second, independent
backstop.

Add `createAnonClient()` to `packages/api/src/supabase/client.ts`, next to
`createAdminClient()`:

```ts
export function createAnonClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
```

Swap every `createAdminClient()` call in `public.ts` (both existing tutorial
routes, and the two new toy routes below) to `createAnonClient()`. No
behavior change for existing routes — this is defense-in-depth, not a fix to
a live bug — verified by the existing `public.ts` route tests continuing to
pass unmodified.

## Backend: public toy routes

Added to `public.ts`, same shape as the tutorial routes:

- `GET /api/public/toys` — `.eq('status', 'published')`, ordered
  `created_at` descending, embeds `profiles(name)` for owner attribution
  (many-to-one via `owner_id`, so PostgREST returns a single object, not an
  array — unlike `tutorial_orgs`).
- `GET /api/public/toys/:id` — same filter + `.single()`. 404 on both "no
  such row" and "row exists but is a draft" — an unpublished toy must not be
  distinguishable from a nonexistent one to an unauthenticated caller, same
  reasoning the tutorial detail route already documents.

`packages/types` gets `ToyWithOwner = Toy & { profiles: { name: string } | null }`
for the response shape (nullable to match `profiles(name)`'s embed
semantics, though in practice every toy has an owner).

## Frontend: list page

`app/toy-library/page.tsx` (server) + `toy-library-client.tsx` (client),
modeled on `app/library`'s `page.tsx` / `library-client.tsx` pair:

- Server component fetches `/api/public/toys` with the same
  connection-failure-degrades-to-empty guard `app/library/page.tsx` uses.
- Search box filters by `name`, substring, case-insensitive.
- A condition filter, as a row of pills matching the existing
  difficulty-pill pattern (`chip`, `aria-pressed`): **Any / Good (7–10) /
  Fair (4–6) / Well-loved (1–3)**.
- A second, independent toggle pill: **Switch-adapted**. Not mutually
  exclusive with the condition pills — a caller can filter by both at once.
- Empty state matches `library-client.tsx`'s ("No toys found" / adjust
  filters), reusing the same 🔍 `empty-badge` treatment.

New `components/toy-library-card.tsx` (sibling of `tutorial-card.tsx`):
`CardPhoto`, name, condition, a switch-adapted indicator, owner name via
`profiles.name` — links to `/toy-library/[id]`.

## Frontend: detail page

`app/toy-library/[id]/page.tsx` fetches `/api/public/toys/:id`, `notFound()`
on miss.

The fields to show are the same ones `ToyReviewPanel` (in
`components/toy-editor.tsx`) already renders for the owner's own review
step: `ToyPhotoGrid`, then a `dl` of Name / Condition / Description /
Switch-adapted. Rather than duplicate that markup, extract it into a new
presentational component, `components/toy-summary.tsx`:

```ts
export function ToySummary({ toy }: { toy: Toy }) { /* photo grid + dl, no owner name */ }
```

`ToyReviewPanel` renders `<ToySummary toy={toy} />` in place of its current
inline markup (behavior unchanged — still wrapped in the same `.panel` and
followed by the same publish/published sticky bar). The public detail page
renders `<ToySummary toy={toy} />` too, with "Held by {profiles.name}" added
above it and no publish affordance at all.

## Nav

Remove `soon: true` from the `/toy-library` row in `lib/nav-model.ts`.

## Testing

- `packages/api`: route tests for `GET /api/public/toys` (published-only,
  ordering) and `GET /api/public/toys/:id` (404 on draft, 404 on missing),
  matching `public.ts`'s existing tutorial route test file's structure.
  Existing `public.ts` tutorial tests re-run unmodified after the
  `createAnonClient()` swap, to confirm it's behavior-preserving.
- `packages/web`: unit tests for the search/condition-bucket/switch-adapted
  filter logic in `toy-library-client.tsx`, matching
  `library-client.tsx`'s existing test file's structure. A render test for
  `ToySummary` (shared by both call sites) covering the description's
  `—` fallback and the switch-adapted Yes/No text.
