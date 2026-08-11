# Multiple Child Profiles Per Account — Design

**Date:** 2026-08-11
**Status:** Approved

## Goal

Let one account hold several child profiles on the web. The sidebar row becomes
"Child profiles" and opens a list; an "Add child" button opens the existing
form; saving returns to the list, where each child can be opened, edited, or
deleted.

This follows the shape tutorials already use — list, create, edit — without
collaborators, organisations, or an approval stream.

## Why this is a small change

`child_profiles` was built with this in mind. From
`supabase/migrations/003_ability_profile.sql:28`:

> One child profile per parent (unique parent_id, not PK — leaves the door open
> for multi-child later via a single drop constraint).

The RLS policies key on `parent_id = auth.uid()`, not on row count, so they
already permit multiple rows per parent once the unique constraint is gone.
Nothing in `lib/capabilities.ts` derives an `isParent` capability, and the nav
row is unconditional, so no access-control logic branches on how many child
profiles exist.

## Constraint discovered during design: mobile cannot be left alone

`packages/mobile/lib/use-child-profile.ts` calls the same two endpoints the web
page does, and both break the moment the unique constraint is dropped:

- `PUT /api/child-profile` uses `.upsert(row, { onConflict: 'parent_id' })`.
  `onConflict` requires a unique constraint on that column. Dropping the
  constraint makes this call error.
- `GET /api/child-profile` uses `.maybeSingle()`, which errors when more than
  one row matches. A parent who adds a second child on web would break their
  own mobile profile screen.

The chosen resolution is one honest API rather than two: the singleton
endpoints are replaced by a collection, and mobile's hook migrates to it.
Mobile's UI and behaviour do not change — it continues to show exactly one
child (the first) — only the URLs its hook calls.

The rejected alternative was keeping `/api/child-profile` alive with
server-side "oldest child" semantics alongside a new plural route. That avoids
touching mobile today at the cost of maintaining two read paths permanently,
and an endpoint whose meaning silently becomes "your first child".

## Data model

New migration: `supabase/migrations/020_multi_child_profiles.sql`

```sql
-- Multiple children per parent. 003 deliberately used a unique constraint
-- rather than a primary key so this would be a one-line change.
alter table public.child_profiles
  drop constraint child_profiles_parent_id_key;

-- Optional: a parent may add a child without naming them. The UI falls back
-- to "Child N" by position, so this is never required to identify a row.
alter table public.child_profiles
  add column name text;

-- Needed for a stable list order and for the "Child N" fallback label.
-- Existing rows take now(), which is wrong but harmless: an account with one
-- child has nothing to order.
alter table public.child_profiles
  add column created_at timestamptz not null default now();

-- 003 created select/insert/update policies but no delete policy, so deletes
-- were silently impossible. The list page needs one.
create policy "Parent can delete own child profile"
  on public.child_profiles for delete using (parent_id = auth.uid());
```

`name` is nullable by decision — naming a child is optional. Identity in the
list comes from `name` when present and "Child N" otherwise, where N is the
row's 1-based position among that parent's children ordered by `created_at`.
The position is computed at render time, not stored, so it stays correct after
a delete shifts the remaining children up.

## API

`packages/api/src/routes/child-profile.ts`, remounted at `/api/child-profiles`.

| Method | Path | Behaviour |
|---|---|---|
| GET | `/api/child-profiles` | Array of the caller's children, ordered `created_at` ascending. `[]` when none. |
| POST | `/api/child-profiles` | Insert. Body filtered through `EDITABLE`. Returns the new row. |
| GET | `/api/child-profiles/:id` | One child. 404 when the row does not exist or is not the caller's. |
| PATCH | `/api/child-profiles/:id` | Update. Body filtered through `EDITABLE`. Returns the updated row. |
| DELETE | `/api/child-profiles/:id` | Delete. Returns 204. |

The existing `EDITABLE` whitelist carries over unchanged, plus `name`.
`parent_id` and `updated_at` stay server-set; `id` and anything else in the
body is ignored, preserving the current trust-boundary filtering.

Every handler uses `createUserClient(c.get('token'))`, so Postgres RLS remains
the authorization boundary exactly as it is today. No handler performs its own
ownership check — a row belonging to another parent is invisible to the query,
which is why the `:id` routes return 404 rather than 403 for someone else's
child.

`packages/api/src/app.ts` updates its three `child-profile` lines to the plural
path (two `authMiddleware` registrations and one `app.route`).

## Web

Three routes, mirroring `/dashboard` → `/upload` → `/tutorials/[id]/edit`.

### `app/dashboard/child/page.tsx` — the list

Server component. Fetches `GET /api/child-profiles`. Renders one card per
child showing its label and a short summary (age, primary diagnosis), each
linking to its edit page, plus an "Add child" button.

No `.catch()` on the fetch, for the same reason the current page documents at
line 14: swallowing a failure into an empty result would misrepresent a broken
fetch as "you have no children". A failed fetch throws into `error.tsx`.

Empty state keeps the existing explanatory copy — "This helps us suggest
tutorials that suit your child. Everything is optional and only you can see
it." — above the "Add child" button, so a new account still learns why the page
exists.

### `app/dashboard/child/new/page.tsx` — create

Renders `ChildProfileForm` with no seed profile. Submitting POSTs to
`/api/child-profiles` and redirects to the list.

### `app/dashboard/child/[id]/page.tsx` — edit

Fetches that child and renders `ChildProfileForm` seeded with it. Submitting
PATCHes. Also holds the delete control.

**Delete is two-step.** The button reads "Delete child profile"; clicking it
swaps the label to "Confirm delete" and arms the real action, reverting after 3
seconds if not confirmed. This is local `useState` — no dialog component
and no new dependency. It deliberately departs from
`components/edit-items-section.tsx:92` and `app/admin/contributors/page.tsx:57`,
which both delete on first click, because a child profile is a page of
hand-entered data with no undo, unlike a parts row.

### `components/child-profile-form.tsx`

Keeps its entire body: the three cards mirroring the migration's column
groups, the `toggle` helper for the `text[]` columns, and `setNumber`'s
null-vs-zero handling ("an untouched number field means 'not measured', not
'measured as zero'").

Two changes:

1. A `name` input at the top of the Ability profile card, labelled optional.
2. The hardcoded `browserApiClient.put('/api/child-profile', form)` becomes an
   `onSave(form)` prop supplied by the page. The component no longer knows
   whether it is creating or editing.

Its error handling is unchanged and still matches `terms-gate.tsx` and
`profile-form.tsx`: a failed save shows a `role="alert"` message and does not
show a saved indicator.

The file header comment needs updating — it currently describes the component
as targeting "the same PUT /api/child-profile contract" and explains that
create and update are one call because the endpoint is an upsert. Both
statements stop being true.

### `lib/nav-model.ts`

Line 75: label `'Child profile'` → `'Child profiles'`. The `href` and the
comment above it ("Shown to non-parents too: filling it in is what makes them a
parent") are unchanged and still accurate.

## Mobile

Two files, no UI change.

- `packages/mobile/lib/use-child-profile.ts` — the load becomes
  `GET /api/child-profiles` taking `[0]`; `save` becomes
  `PATCH /api/child-profiles/:id` when a child exists and
  `POST /api/child-profiles` when it does not, since the old PUT collapsed both
  cases into one upsert. The hook's `{ profile, loading, save }` return shape
  is unchanged.
- `packages/mobile/tests/unit/lib/use-child-profile.test.tsx` — asserts those
  URLs, so it moves with the hook.

`profile-screen.tsx`, the three sub-screens, and `child-profile-home.tsx`
consume the hook's return and need no changes. The four other mobile test files
mock the hook wholesale.

`packages/mobile/tests/unit/lib/api-client.test.ts:64` also mentions
`/api/child-profile`, but only as an arbitrary URL for exercising the client
itself — not a dependency on this endpoint.

## Testing

**API integration** (`packages/api/tests/integration/`):

- GET returns `[]` for an account with no children, and returns children in
  `created_at` order once several exist.
- POST creates a child owned by the caller; `parent_id` in the body is ignored
  in favour of the authenticated user.
- PATCH updates only whitelisted columns.
- DELETE removes the row.
- RLS boundary: a second parent gets 404 on GET/PATCH/DELETE for the first
  parent's child, and that child still exists afterwards.

**Web unit** (`packages/web/tests/unit/`):

- The list renders one card per child, uses `name` when set, and falls back to
  "Child 1" / "Child 2" by position when not.
- The list's empty state renders the explanatory copy and the "Add child"
  button.
- The form calls its `onSave` prop rather than a hardcoded endpoint.
- Delete requires two clicks: one click does not call the API.

**Mobile unit** (`packages/mobile/tests/unit/`):

- The hook reads the first child from the collection endpoint.
- `save` POSTs when no child exists and PATCHes when one does.

Per the repo's verification rule, every touched package runs its typecheck and
its full test scripts, not just the suite covering the changed file.

## Out of scope

- Any mobile UI for managing more than one child. Mobile continues to show the
  first child only.
- Choosing an "active" child that filters tutorial recommendations. Nothing
  today consumes child-profile data for recommendations, so there is nothing to
  filter.
- Per-child avatars or photos.
- Backfilling a meaningful `created_at` for existing rows. An account with one
  child has nothing to order.
