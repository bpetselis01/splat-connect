# Shared Account Foundation

**Date:** 2026-07-29
**Status:** Approved design, ready for implementation planning
**Sub-project 1 of 3.** Sub-project 2 is `2026-07-29-auth-entry-flow-design.md`,
sub-project 3 is `2026-07-29-unified-dashboard-design.md`. Both depend on this one.

## Goal

One account type. A parent can also be a contributor, a contributor can also be a
parent, and what a user can do is derived from data the schema already holds
rather than declared once in an exclusive `role` column.

## Why this cannot be done in the UI

`profiles.role` is a single exclusive value — `003_ability_profile.sql:9` checks
`role in ('admin', 'contributor', 'parent')`. Mobile writes `'parent'`
(`packages/mobile/lib/auth-context.tsx:59`); web passes only `{ name }`
(`packages/web/app/signup/page.tsx:23`) and falls to the trigger's `else` branch,
so it writes `'contributor'`. There is no way to express both.

That much was expected. Two things found while tracing it were not.

### A parent is refused at the database layer, not the UI

`is_approved_contributor()` (`005_remove_account_approval.sql:10`) reads:

```sql
select exists (
  select 1 from public.profiles
  where id = auth.uid() and role = 'contributor'
);
```

Per 005's own header, that function gates **~13 RLS policies** — tutorial insert,
`tutorial_contributors` insert, and the storage upload/update policies. A
mobile-registered parent holds `role = 'parent'`, so every authoring path fails in
Postgres regardless of what the interface offers them.

This is the whole feature in one function. It is also why no amount of dashboard
work delivers it: the UI would render the controls and the writes would 403.

### Any signed-in user can make themselves an admin

Found while checking what a profile-editing screen would be built on.
`001_schema.sql:134`:

```sql
create policy "User can update own profile"
  on public.profiles for update using (auth.uid() = id);
```

There is no `WITH CHECK`. Postgres uses the `USING` expression as the check when
one is omitted, so the post-update row only has to satisfy `auth.uid() = id` —
which stays true when `role` changes to `'admin'`.

`004_data_api_grants.sql:17` grants `all on all tables` to `authenticated`, so
`profiles` is reachable over PostgREST with the anon key already shipped to the
browser. No trigger guards the column: the only triggers in the schema are
`on_auth_user_created`, `tutorials_freeze_review_provenance` (008) and
`tutorial_orgs_freeze_identity` (007).

So a signed-in user can PATCH their own row to `role = 'admin'`, after which
`is_admin()` opens every admin policy in the schema.

**This is pre-existing and not introduced by this work.** It is fixed here because
sub-project 3 adds a profile-editing screen directly on top of this policy, and
shipping that without the fix turns a latent hole into a signposted one.

## Decisions

**1. `role` means admin-or-not.** `'contributor'` and `'parent'` stay as legal
values and keep being written at signup, but they record *where the account was
created*, not what it may do. `is_admin()` is untouched. No constraint change, no
backfill, no `user_roles` table, no role array, no capability columns.

**2. `is_approved_contributor()` drops the role condition.** The name and
signature are preserved so the ~13 policies referencing it inherit the change
untouched — the same technique 005 used deliberately for exactly this reason.

**3. Capabilities are derived from existing data.**

| Capability | Derived from |
|---|---|
| Admin | `profiles.role = 'admin'` — unchanged |
| Can author | any signed-in user |
| Is a parent | has a `child_profiles` row (`003_ability_profile.sql:30`, unique on `parent_id`) |
| Is a leader | has an `org_leaders` row — already true today, via `GET /api/organizations/mine` |

Leadership was already modelled this way. `middleware.ts:18-20` says so:
*"leadership is per-organisation data, not a role, so there is nothing here for
middleware to read."* This decision finishes a pattern the codebase started rather
than introducing one.

**4. `role` and `email` are frozen by a BEFORE trigger, not by `WITH CHECK`.**
A `WITH CHECK` that compares against the stored role needs a subquery on
`profiles` from inside a `profiles` policy — recursion risk. The repo already
solves "freeze a column" twice with BEFORE triggers, because `OLD` is visible
there: `tutorial_orgs_freeze_identity` (`007:335`) and
`tutorials_freeze_review_provenance` (`008:56`). This follows that convention.

The trigger returns early when `auth.uid()` is null. That is the trap
`packages/api/src/routes/admin.ts:92-97` records: *"triggers run for service_role even though RLS does not, and any guard
calling `is_admin()` reads `auth.uid()`, which service_role lacks. Such a write
raises 42501 while the route reports success having changed nothing."* Service-role
writes are server-side only and already bypass RLS; the threat being closed is the
browser JWT.

**5. The `child-profile` role guard is deleted.** `child-profile.ts:22` returns 403
unless `role === 'parent'`. Its own header already calls RLS the real boundary:
*"Both reject non-parent roles with 403. Writes go through the user client so
Postgres RLS (`parent_id = auth.uid()`) is the real authorization boundary."* With
roles non-exclusive, that fast-403 is the only thing stopping a web contributor
from having a child profile. The RLS policy is unchanged and still enforces
ownership.

Consequence: `GET /api/child-profile` returns `null` for a user with no child
profile instead of 403. Decision 3 depends on this — it is how parent-ness is read.

**6. `getCapabilities()` is the single answer to "what may this user do".** Today
the question is answered in four places, each slightly differently:
`lib/auth.ts:39`, `nav.tsx:65-69`, `dashboard/page.tsx:54`, `lib/org-access.ts`.
One helper replaces the scattered checks.

**7. `lib/auth.ts` stops treating a parent as logged out.** Line 39 —
`if (role === 'admin' || role === 'contributor') return role` — returns `null` for
a parent, so the nav renders a signed-in parent as signed-out. It widens to accept
any recognised role. The defensive intent of the surrounding comment (an
unrecognised value must not look like a valid login) is preserved: unknown values
still return `null`.

**8. The admin contributor list becomes an account list.** `admin.ts:63` filters
`.eq('role', 'contributor')`, which after decision 1 means "accounts created on
web" — so a mobile-registered parent who authors a tutorial would be invisible to
the admin managing accounts. It changes to list every non-admin profile, and
`app/admin/contributors/page.tsx` is relabelled accordingly.

This is the one item here that is a consequence rather than a requirement. It is
included because leaving it silently under-reporting is a defect this change
introduces. It can be cut from the plan without affecting anything else.

## Architecture

### `supabase/migrations/009_shared_account_capability.sql`

```sql
-- 1. Authoring is no longer tied to the 'contributor' role. Name and signature
--    preserved so the ~13 policies referencing this inherit the change, exactly
--    as 005 intended when it kept them.
create or replace function public.is_approved_contributor()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid()
  );
$$ language sql security definer stable;

-- 2. "User can update own profile" has no WITH CHECK, so USING doubles as the
--    check and a user may set their own role to 'admin'. Frozen in a trigger
--    rather than a policy: a WITH CHECK comparing against the stored role needs a
--    subquery on profiles from inside a profiles policy.
create or replace function public.freeze_profile_identity()
returns trigger as $$
begin
  -- service_role and other non-JWT contexts: RLS does not apply to them either,
  -- and is_admin() reads auth.uid(), which they lack (see 007 header).
  if auth.uid() is null then
    return new;
  end if;
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'role cannot be changed by its owner';
  end if;
  if new.email is distinct from old.email and not public.is_admin() then
    raise exception 'email is mirrored from auth.users and cannot be set directly';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger profiles_freeze_identity
  before update on public.profiles
  for each row execute function public.freeze_profile_identity();
```

### `packages/web/lib/capabilities.ts` (new)

```ts
export type Capabilities = {
  profile: Profile
  isAdmin: boolean
  isParent: boolean          // has a child_profiles row
  ledOrgs: Organization[]    // non-empty ⇒ leader
  canAuthor: boolean         // every signed-in user
}

export const getCapabilities = cache(async (): Promise<Capabilities | null> => …)
```

Three existing endpoints in one `Promise.all` — `GET /api/contributors/me`,
`GET /api/child-profile`, `GET /api/organizations/mine`. No new API surface.
Wrapped in React `cache()` so a render pass that reads it from both a layout and a
page issues one round of fetches.

An unauthenticated caller gets `null`. A failure of the child-profile or led-orgs
fetch degrades that capability to false/empty rather than failing the page — the
same shape `org-access.ts` already uses. A failure of `/api/contributors/me` is not
degradable and returns `null`, because without a profile there is no user.

### Code changes

| File | Line | Change |
|---|---|---|
| `packages/api/src/routes/child-profile.ts` | 22 | delete the `role !== 'parent'` guard and its middleware |
| `packages/web/lib/auth.ts` | 39 | accept any recognised role |
| `packages/api/src/routes/admin.ts` | 63 | drop `.eq('role', 'contributor')`, exclude admins |
| `packages/web/app/admin/contributors/page.tsx` | — | relabel to accounts |

`middleware.ts` needs no change: it gates only `/admin` on role (line 83), and the
contributor routes require nothing but a signed-in user.

## Error handling

The trigger raises rather than silently ignoring a frozen-column write, so a
client attempting a role change gets a failed request instead of a success that
changed nothing — the failure mode 007's header warns about.

`getCapabilities()` degrades per-capability as described above; a user whose
led-orgs fetch fails sees no organisation tab rather than an error page.

## Testing

**Database (integration, `packages/api/tests/integration/`):**
- A `role = 'parent'` profile can insert a tutorial — the assertion that would have
  caught this entire class of bug, and which no current test makes.
- A parent can upload to storage (the same function gates those policies).
- A user updating their own row to `role = 'admin'` is rejected.
- A user updating their own `email` is rejected.
- An admin updating another profile's role still succeeds.
- A service-role write still succeeds (guards the 007 trap).

**API:**
- `GET /api/child-profile` returns `null`, not 403, for a user with no child profile.
- `PUT /api/child-profile` succeeds for a `role = 'contributor'` caller.
- `GET /api/admin/contributors` includes a mobile-registered account.

**Web (unit):**
- `getCapabilities()` reports `isParent` from child-profile presence, not role.
- `getCapabilities()` reports a leader from a non-empty led-orgs list.
- A degraded led-orgs fetch yields an empty list rather than throwing.
- `lib/auth.ts` returns `'parent'` for a parent and `null` for an unknown value.

## Out of scope

- Changing the `profiles_role_check` constraint or removing the legacy values.
- Multi-child support — `child_profiles.parent_id` stays unique (`003:32`).
- Email change flow. `email` is frozen here; changing it is a Supabase auth
  concern (`auth.updateUser`) and is not part of this work.
- Any UI. This sub-project ships no visible change on its own; it is the
  precondition for sub-projects 2 and 3.
