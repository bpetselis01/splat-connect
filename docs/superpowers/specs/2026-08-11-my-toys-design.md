# My Toys — parent/contributor toy library (part 1: add/view/edit/delete)

## Scope

First slice of the toy-exchange feature. Any signed-in account (parent or
contributor — not exclusive, same as child profiles) can add toys to their
own library: create, view, edit, delete. **Out of scope for this pass**:
offering a toy for exchange, matching/swapping with an association, the
public `/toy-library` browse page, and the org `/dashboard/organisation/toys`
inventory. Those are later parts of the same feature and are not blocked by
anything built here.

The three placeholder routes already exist with copy committed
(`app/dashboard/toys`, `app/dashboard/organisation/toys`, `app/toy-library`,
all currently `<ComingSoon>`). This spec replaces only the first.

## Data model

New table `toys` (migration `021_toys.sql`), owner-scoped like
`child_profiles` — no unique constraint on `owner_id`, so one account may
hold any number of toys.

```sql
create table public.toys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  name text not null,
  description text,
  condition smallint not null check (condition between 1 and 10), -- 1 = needs repair, 10 = like new
  switch_adapted boolean not null default false,
  cover_photo_url text,                    -- nullable: set in step 2, required to publish
  switch_photo_urls text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create policy "Anyone can read published toys, or their own draft"
  on public.toys for select using (status = 'published' or owner_id = auth.uid());
create policy "Owner can insert own toy"
  on public.toys for insert with check (owner_id = auth.uid());
create policy "Owner can update own toy"
  on public.toys for update using (owner_id = auth.uid());
create policy "Owner can delete own toy"
  on public.toys for delete using (owner_id = auth.uid());
-- + admin bypass policy, matching every other owned table.
```

`name` and `condition` are `not null` because the wizard requires them
before a draft row is even created (see UI section) — same relationship
`title`/`difficulty` have to `tutorials`. `cover_photo_url` stays nullable
because it's set after the row exists, in step 2, but is required before a
toy can move from `draft` to `published`.

`packages/types` gets a matching `Toy` interface alongside `ChildProfile`.

### Storage

New bucket `toy-photos-library` (not the existing `toy-photos` bucket, whose
RLS is keyed to `is_approved_contributor()` for the tutorial review flow —
not applicable here). Folder-per-toy: `{toyId}/cover.{ext}`,
`{toyId}/switch-{n}.{ext}`. Public read (consistent with `toy-photos`, and
needed by the future public toy-library page anyway); insert/update/delete
gated by `owner_id = auth.uid()` on the owning `toys` row, mirroring
`002_storage_update_policies.sql`.

## API — `packages/api/src/routes/toys.ts`

Mirrors `child-profiles.ts`'s ownership pattern (RLS-respecting user client,
no admin-client bypass needed — a toy has a single owner, unlike tutorials'
multi-author `tutorial_contributors`):

- `GET /api/toys` — caller's own toys (draft + published), newest first.
- `POST /api/toys` — creates a draft row from `name`, `condition`,
  `description`; `owner_id` from the token; `status: 'draft'`.
- `PATCH /api/toys/:id` — updates any editable field, scoped by
  `owner_id = auth.uid()` (404, never 403, on someone else's row — same
  reasoning as `child-profiles.ts`).
- `PATCH /api/toys/:id/publish` — separate endpoint because it has a real
  precondition: `cover_photo_url` set, and `switch_photo_urls` non-empty if
  `switch_adapted`. 400 with the list of missing fields if not met (same
  shape as tutorial's `getMissingFields()`).
- `DELETE /api/toys/:id` — remove one.

Photo uploads: new endpoints in `upload.ts`, `/api/upload/toy-cover` and
`/api/upload/toy-switch-photo`, following the existing `{entityId}/...`
storage-path convention.

## Web UI

**List page** `/dashboard/toys` (replaces the `MyToysPage` placeholder) —
server component, same shape as `ChildListPage`: fetch `GET /api/toys`,
render cards (cover photo thumbnail, name, condition, a "Draft" badge if
`status = 'draft'`), link to `/dashboard/toys/[id]`, "Add a toy" link to
`/dashboard/toys/new`.

**Create** `/dashboard/toys/new` — a minimal single-screen form: name,
condition, description. The only step that must happen before a row exists.
"Create" → `POST /api/toys` → redirect to `/dashboard/toys/[id]`.

**Edit** `/dashboard/toys/[id]` — pill-jump stepper (`ToyEditStepper`,
mirroring `edit-stepper.tsx` + `edit-steps.ts`), pills: **Details | Photos |
Review**. Status dots computed the same way tutorial's `computeStepStatuses`
works (`attention` if cover photo missing, etc.). This one component serves
both "finish the draft you just started" and "edit a published toy later" —
Photos and Review are implemented once, not duplicated into a separate
linear create-wizard.

- Details: name, condition, description — editable any time.
- Photos: cover photo (required to publish), switch-adapted toggle,
  switch-photo gallery (shown + required to publish only when the toggle is
  on). Each upload calls the relevant `/api/upload/toy-*` endpoint, then
  `PATCH /api/toys/:id` with the returned URL.
- Review: read-only summary + "Publish" button → `PATCH
  /api/toys/:id/publish`. A 400 shows the missing-fields message inline
  (sticky-bar pattern, like tutorials) — non-blocking, the draft stays saved.

**Delete**: generalize `delete-child-button.tsx` into
`DeleteEntityButton({ endpoint, redirectTo, label })`, reused by child
profiles and toys, instead of a second near-identical typed-confirmation
dialog.

`packages/web/lib/nav-model.ts`'s `/dashboard/toys` row drops `soon: true`.

## Error handling

- Photo upload failure → inline error on the Photos pill, draft row
  untouched, retry in place.
- Publish precondition failure → missing-fields note in the Review pill's
  sticky bar, non-blocking.
- `/dashboard/toys/[id]` for another owner's id, or a malformed uuid → 404
  (same `INVALID_TEXT_REPRESENTATION` handling as `child-profiles.ts`).

## Testing

- API: route tests for `toys.ts` (CRUD + publish precondition), following
  `child-profiles.ts`'s test conventions.
- Web: component tests for the create form, `ToyEditStepper`, and the list
  page, following `child-profile-form`/`coming-soon` conventions. Extend
  `DeleteEntityButton`'s existing child-profile tests to cover the toy case
  rather than duplicating a new test file.
