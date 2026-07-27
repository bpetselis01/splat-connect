# SPLAT Connect — Database Schema Reference

Single, consolidated reference for the Postgres/Supabase database, compiled from
`supabase/migrations/*.sql`. This document mirrors the **current** state of the
schema; where a later migration changed something from an earlier one, the
current definition is shown and the change is noted.

> Source of truth remains the migration files. `seed.sql` is **fixtures** (test
> data), not schema, and is intentionally excluded here.

## Migration index

| # | File | Adds / changes |
|---|------|----------------|
| 001 | `001_schema.sql` | Core tables (profiles, tutorials, tutorial_contributors, parts, tools, stl_files), the signup trigger, helper functions, all RLS, storage buckets + storage policies. |
| 002 | `002_storage_update_policies.sql` | Re-applies the three storage **UPDATE** (file-replacement) policies to already-running databases (idempotent, drop-if-exists). |
| 003 | `003_ability_profile.sql` | Adds the `parent` role, makes the signup trigger role-aware, and creates the `child_profiles` table with its RLS. |
| 004 | `004_data_api_grants.sql` | Grants the Data API roles (`anon`, `authenticated`, `service_role`) access to the `public` schema so PostgREST works; RLS remains the access-control layer. |
| 007 | `007_organizations.sql` | Adds `organizations`, `org_members`, and `user_agreements` so an approved org leader can review their own members' submissions instead of every tutorial going through the single platform admin queue. Adds `org_id`, `review_level`, `reviewed_by`, and `flagged_for_follow_up` to `tutorials`. Adds the org-scoped RLS policies and two provenance triggers that freeze what those policies trust. |
| 008 | `008_tutorial_contributor_scope.sql` | Narrows the `tutorial_contributors` INSERT policy so a contributor can only claim a tutorial that has no contributors yet (adds `tutorial_has_contributor()`), closing a path that let a stranger's private draft be repinned into an org and published. Adds `tutorials_freeze_review_provenance`, a third trigger that reserves `review_level`, `reviewed_by`, and `flagged_for_follow_up` to admins and org leaders. |

---

## 1. Tables

### `profiles`
One row per authenticated user (PK = `auth.users.id`). Role and approval gate everything else.

| Column | Type | Constraints / default |
|--------|------|-----------------------|
| `id` | uuid | PK, FK → `auth.users` on delete cascade |
| `name` | text | not null, default `''` |
| `email` | text | not null, default `''` |
| `role` | text | not null, default `'contributor'`, check in (`admin`, `contributor`, `parent`) |
| `approved` | boolean | not null, default `false` |
| `created_at` | timestamptz | not null, default `now()` |

> **Evolution:** 001 defined the role check as `('admin', 'contributor')`; **003** widened it to also allow `'parent'` (shown above).

```sql
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null default '',
  email text not null default '',
  role text not null default 'contributor'
    check (role in ('admin', 'contributor', 'parent')),   -- 'parent' added in 003
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
```

### `tutorials`
A published (or in-progress) build tutorial. Status drives visibility and the review workflow.

| Column | Type | Constraints / default |
|--------|------|-----------------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `title` | text | not null |
| `description` | text | nullable |
| `difficulty` | text | not null, check in (`easy`, `medium`, `hard`) |
| `status` | text | not null, default `'draft'`, check in (`draft`, `pending`, `approved`, `rejected`) |
| `tutorial_pdf_url` | text | nullable |
| `toy_photo_url` | text | nullable |
| `rejection_note` | text | nullable |
| `created_at` | timestamptz | not null, default `now()` |
| `reviewed_at` | timestamptz | nullable |
| `org_id` | uuid | nullable, FK → `organizations` on delete set null *(007)* |
| `review_level` | text | nullable, check in (`org`, `platform`) *(007)* |
| `reviewed_by` | uuid | nullable, FK → `profiles` on delete set null *(007)* |
| `flagged_for_follow_up` | boolean | not null, default `false` *(007)* |

> **Evolution (007):** `org_id`, `review_level`, `reviewed_by`, and `flagged_for_follow_up` were added to route a tutorial into an org's own review queue instead of the platform queue. `org_id` is a **snapshot taken at submit time**, not a live lookup — it does not track later membership changes, so a leader's review authority over a given tutorial can't be revoked retroactively by editing the roster. `org_id = null` means "platform queue" (the original, pre-007 behavior).

```sql
create table public.tutorials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  difficulty text not null
    check (difficulty in ('easy', 'medium', 'hard')),
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected')),
  tutorial_pdf_url text,
  toy_photo_url text,
  rejection_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  -- Added in 007:
  org_id uuid references public.organizations on delete set null,
  review_level text check (review_level in ('org', 'platform')),
  reviewed_by uuid references public.profiles on delete set null,
  flagged_for_follow_up boolean not null default false
);
```

### `tutorial_contributors`
Join table linking tutorials to the profiles who authored them. Composite PK.

| Column | Type | Constraints / default |
|--------|------|-----------------------|
| `tutorial_id` | uuid | FK → `tutorials` on delete cascade, part of PK |
| `profile_id` | uuid | FK → `profiles` on delete cascade, part of PK |
| `role` | text | not null, default `'primary'`, check in (`primary`, `collaborator`) |
| `added_at` | timestamptz | not null, default `now()` |
| | | PK = (`tutorial_id`, `profile_id`) |

```sql
create table public.tutorial_contributors (
  tutorial_id uuid references public.tutorials on delete cascade,
  profile_id uuid references public.profiles on delete cascade,
  role text not null default 'primary'
    check (role in ('primary', 'collaborator')),
  added_at timestamptz not null default now(),
  primary key (tutorial_id, profile_id)
);
```

### `parts`
Physical parts needed for a tutorial. `buy_links` is a JSON array of `{ label, url }`.

| Column | Type | Constraints / default |
|--------|------|-----------------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `tutorial_id` | uuid | FK → `tutorials` on delete cascade, not null |
| `name` | text | not null |
| `quantity` | integer | not null, default `1` |
| `is_optional` | boolean | not null, default `false` |
| `buy_links` | jsonb | not null, default `'[]'` |

```sql
create table public.parts (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid references public.tutorials on delete cascade not null,
  name text not null,
  quantity integer not null default 1,
  is_optional boolean not null default false,
  buy_links jsonb not null default '[]'
);
```

### `tools`
Tools required for a tutorial. Same shape as `parts` minus `quantity`.

| Column | Type | Constraints / default |
|--------|------|-----------------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `tutorial_id` | uuid | FK → `tutorials` on delete cascade, not null |
| `name` | text | not null |
| `is_optional` | boolean | not null, default `false` |
| `buy_links` | jsonb | not null, default `'[]'` |

```sql
create table public.tools (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid references public.tutorials on delete cascade not null,
  name text not null,
  is_optional boolean not null default false,
  buy_links jsonb not null default '[]'
);
```

### `stl_files`
3D-print files attached to a tutorial.

| Column | Type | Constraints / default |
|--------|------|-----------------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `tutorial_id` | uuid | FK → `tutorials` on delete cascade, not null |
| `filename` | text | not null |
| `file_url` | text | not null |

```sql
create table public.stl_files (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid references public.tutorials on delete cascade not null,
  filename text not null,
  file_url text not null
);
```

### `child_profiles`  *(added in 003)*
One row per parent account (unique `parent_id`) holding a child's ability, everyday-needs, and customization data. Backs the mobile parent experience.

| Column | Type | Constraints / default |
|--------|------|-----------------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `parent_id` | uuid | FK → `profiles` on delete cascade, not null, **unique** |
| `age` | integer | nullable |
| **Ability Profile** | | |
| `primary_diagnosis` | text | nullable |
| `macs_level` | text | nullable |
| `macs_source` | text | not null, default `'manual'`, check in (`manual`, `estimated`) |
| `hand_involvement` | text | check in (`bilateral`, `unilateral`) |
| `assist_hand` | text | check in (`left`, `right`) |
| `bfmf_score` | text | nullable |
| `bfmf_source` | text | not null, default `'manual'`, check in (`manual`, `estimated`) |
| **Everyday Needs** | | |
| `challenges` | text[] | not null, default `'{}'` |
| `challenge_other` | text | nullable |
| `grip_type` | text | nullable |
| `env_context` | text | nullable |
| **Customization Metrics** | | |
| `palm_width_mm` | numeric | nullable |
| `wrist_circ_mm` | numeric | nullable |
| `needs_arm_attachment` | boolean | not null, default `false` |
| `forearm_length_mm` | numeric | nullable |
| `hand_dominance` | text | nullable |
| `sensory_preferences` | text[] | not null, default `'{}'` |
| `updated_at` | timestamptz | not null, default `now()` |

> `parent_id` is **unique but not the PK** — deliberately, so multi-child support later is a single `drop constraint` away.

```sql
create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.profiles on delete cascade not null unique,
  age integer,
  -- Ability Profile
  primary_diagnosis text,
  macs_level text,
  macs_source text not null default 'manual' check (macs_source in ('manual','estimated')),
  hand_involvement text check (hand_involvement in ('bilateral','unilateral')),
  assist_hand text check (assist_hand in ('left','right')),
  bfmf_score text,
  bfmf_source text not null default 'manual' check (bfmf_source in ('manual','estimated')),
  -- Everyday Needs
  challenges text[] not null default '{}',
  challenge_other text,
  grip_type text,
  env_context text,
  -- Customization Metrics
  palm_width_mm numeric,
  wrist_circ_mm numeric,
  needs_arm_attachment boolean not null default false,
  forearm_length_mm numeric,
  hand_dominance text,
  sensory_preferences text[] not null default '{}',
  updated_at timestamptz not null default now()
);
```

### `organizations`  *(added in 007)*
A group whose approved leader can review its own members' tutorials. Starts `pending`/`probation` and must be promoted by an admin before it gains any authority.

| Column | Type | Constraints / default |
|--------|------|-----------------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `name` | text | not null |
| `description` | text | nullable |
| `status` | text | not null, default `'pending'`, check in (`pending`, `approved`, `suspended`) |
| `trust_level` | text | not null, default `'probation'`, check in (`probation`, `trusted`) |
| `created_by` | uuid | FK → `profiles` on delete set null, nullable |
| `created_at` | timestamptz | not null, default `now()` |
| `updated_at` | timestamptz | not null, default `now()` |

> `trust_level` defaults to `'probation'` independently of `status`, so a *pending* org can never read as trusted. Admin approval is what sets `status = 'approved'` **and** `trust_level = 'trusted'` together.

```sql
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'suspended')),
  trust_level text not null default 'probation'
    check (trust_level in ('probation', 'trusted')),
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### `org_members`  *(added in 007)*
Membership of a profile in an organization, with the provenance of how that membership started.

| Column | Type | Constraints / default |
|--------|------|-----------------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `org_id` | uuid | FK → `organizations` on delete cascade, not null |
| `user_id` | uuid | FK → `profiles` on delete cascade, not null |
| `org_role` | text | not null, default `'member'`, check in (`leader`, `member`) |
| `status` | text | not null, default `'pending'`, check in (`pending`, `approved`, `removed`, `declined`) |
| `initiated_by` | text | not null, check in (`contributor`, `org`) |
| `invited_by` | uuid | FK → `profiles` on delete set null, nullable |
| `created_at` | timestamptz | not null, default `now()` |
| `joined_at` | timestamptz | nullable |
| | | unique (`org_id`, `user_id`) |

> `org_role` and `status` are independent — `('leader', 'pending')` is a real, representable state: an invited leader who hasn't accepted yet. Every policy must therefore check `status = 'approved'`, never `org_role = 'leader'` alone.
>
> `initiated_by` records who created a pending row, so the handshake requires the *other* party to act on it: neither party can complete a membership alone (a contributor's join request needs a leader to approve it; a leader's invite needs the contributor to accept it).

```sql
create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  org_role text not null default 'member'
    check (org_role in ('leader', 'member')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'removed', 'declined')),
  initiated_by text not null
    check (initiated_by in ('contributor', 'org')),
  invited_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  unique (org_id, user_id)
);
```

### `user_agreements`  *(added in 007)*
Logs that a user accepted a versioned agreement. Contains no legal text — the terms themselves are versioned static content referenced by the `version` string.

| Column | Type | Constraints / default |
|--------|------|-----------------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `user_id` | uuid | FK → `profiles` on delete cascade, not null |
| `agreement_type` | text | not null, check in (`contributor_terms`, `org_leader_terms`) |
| `version` | text | not null |
| `accepted_at` | timestamptz | not null, default `now()` |

```sql
create table public.user_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  agreement_type text not null
    check (agreement_type in ('contributor_terms', 'org_leader_terms')),
  version text not null,
  accepted_at timestamptz not null default now()
);
```

---

## 2. Functions & triggers

### `handle_new_user()` + trigger `on_auth_user_created`
Auto-creates a `profiles` row whenever an `auth.users` row is inserted. The role
is whitelisted from signup metadata: only `role: 'parent'` is honored, everything
else (including omitted) defaults to `contributor` — this prevents a client from
self-granting `admin` at signup.

> **Evolution:** 001's version inserted `(id, name, email)` only (role defaulted to `contributor`). **003** replaced it with the role-aware version below.

```sql
-- Current (003) version
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, ''),
    case when new.raw_user_meta_data->>'role' = 'parent' then 'parent' else 'contributor' end
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Trigger (001)
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### Helper functions (001)
`security definer stable` functions used inside RLS policies.

- **`is_admin()`** — true if the caller's profile has `role = 'admin'`.
- **`is_approved_contributor()`** — true if the caller is a `contributor` with `approved = true`.
- **`tutorial_is_approved(t_id)`** — true if the given tutorial is `approved`. Exists to break an RLS recursion cycle: the `tutorial_contributors` policy can't query `tutorials` directly (infinite loop), so this definer function bypasses RLS to check safely.

```sql
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

create or replace function public.is_approved_contributor()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'contributor' and approved = true
  );
$$ language sql security definer stable;

create or replace function public.tutorial_is_approved(t_id uuid)
returns boolean as $$
  select exists (select 1 from public.tutorials where id = t_id and status = 'approved')
$$ language sql security definer stable;
```

### Helper functions (007)
`security definer stable` functions used inside the org RLS policies, for the same reason as above: a policy can't query the table it guards without recursing, and querying another table from inside a policy would make the answer depend on that table's own visibility rather than on fact.

- **`is_org_leader(p_org_id)`** — true if the caller is an **approved** `leader` of that org. Deliberately bakes in `status = 'approved'` so no policy can check leadership half-right (an invited-but-not-yet-accepted leader is not a leader for RLS purposes).
- **`has_accepted(p_agreement_type)`** — true if the caller accepted **any** version of that agreement type. Version-agnostic on purpose; forcing re-acceptance on a new version is out of scope, and the `version` column keeps that option open without a migration.
- **`org_has_approved_leader(p_org_id)`** — true if the org already has an approved leader. Used only by the founder-bootstrap `org_members` insert policy, which has to ask that question about the very table it's a policy on.
- **`is_tutorial_contributor(p_tutorial_id)`** — true if the caller is a contributor on that tutorial. Used to block self-review. Must be `security definer`: as a plain check running under the caller's own RLS, a tutorial row the caller merely can't *see* would make the check false and grant self-review by accident.

```sql
create or replace function public.is_org_leader(p_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id
      and user_id = auth.uid()
      and org_role = 'leader'
      and status = 'approved'
  );
$$ language sql security definer stable;

create or replace function public.has_accepted(p_agreement_type text)
returns boolean as $$
  select exists (
    select 1 from public.user_agreements
    where user_id = auth.uid() and agreement_type = p_agreement_type
  );
$$ language sql security definer stable;

create or replace function public.org_has_approved_leader(p_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id and org_role = 'leader' and status = 'approved'
  );
$$ language sql security definer stable;

create or replace function public.is_tutorial_contributor(p_tutorial_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.tutorial_contributors
    where tutorial_id = p_tutorial_id and profile_id = auth.uid()
  );
$$ language sql security definer stable;
```

### Helper functions (008)

- **`tutorial_has_contributor(p_tutorial_id)`** — true if the tutorial already has *any* contributor row. `security definer` for the same recursion reason as `tutorial_is_approved()`: it is called from inside a `tutorial_contributors` policy, on `tutorial_contributors`. It also carries `set search_path = ''`, so its body must stay fully schema-qualified.

```sql
create or replace function public.tutorial_has_contributor(p_tutorial_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.tutorial_contributors where tutorial_id = p_tutorial_id
  );
$$ language sql security definer stable set search_path = '';
```

### Provenance triggers (007, 008)
Three triggers that exist because RLS itself cannot protect the columns its policies rely on.

**Why they're needed:** an RLS `with check` clause only ever sees the *new* row — it cannot reference `OLD`. That means any policy that grants an update based on a mutable column can be defeated by rewriting that same column in the same statement. This was verified exploitable, not theoretical: three separate ways to defeat the org policies above were reproduced before these triggers existed, including a plain contributor filing a join request and self-promoting to approved leader in one `UPDATE`.

- **`org_members_freeze_provenance`** (on `org_members`, `before update`) — makes `org_id`, `user_id`, and `initiated_by` immutable on every update. Restricts changes to `org_role` to admins only, so a leader can't **promote** an existing member by editing `org_role` while approving their join request. Note the invariant is exactly that and no wider: a leader *can* mint a co-leader on the INSERT path, by inviting someone straight in as `('leader', 'pending')` — the invite policy doesn't constrain `org_role`, and acceptance leaves it untouched. That is deliberate and stays inside the org; what needs an admin is changing `org_role` on a row that already exists. And it allows a `removed` membership to be restored only by that org's own leader (or an admin) — otherwise the removed party could simply set their own row back to `approved`, since the contributor-side update policy already accepts that transition on an org-initiated row.
- **`tutorials_org_must_be_own`** (on `tutorials`, `before insert or update`) — permits setting or changing `tutorials.org_id` only when the caller is an approved member of the *target* org (or is the admin). It is gated on **change**, not on every write: it only re-checks membership on `INSERT` or when `org_id` is actually being modified, never on an unrelated field update. This is deliberate — `org_id` is a snapshot taken when a tutorial is routed, so re-validating membership on every later write would let a later roster change retroactively block an author from editing their own already-routed work (e.g. a leader removing a member would freeze that member's existing tutorials).
- **`tutorials_freeze_review_provenance`** *(008)* (on `tutorials`, `before insert or update`) — reserves `review_level`, `reviewed_by`, and `flagged_for_follow_up` to admins and org leaders. Without it an author could rewrite their own review provenance and clear their own follow-up flag straight through PostgREST: those three columns are named by no policy and were constrained by nothing. Not an escalation — `status = 'approved'` stays admin/leader-reserved either way — but it corrupts the audit trail the admin spot-check of delegated reviews depends on. Gated on **change**, like the trigger above, so ordinary edits are unaffected.

**Consequence for callers:** the service-role (admin) client has no `auth.uid()`, so `is_org_leader()`, `is_tutorial_contributor()`, and the membership check inside `tutorials_org_must_be_own` all evaluate as if no user were signed in. The admin client therefore **cannot** set or change `tutorials.org_id` — not because of a bug, but because there is no acting user for the trigger to check membership against. Any code path that needs to route a tutorial into an org must run under that acting user's own JWT, not the admin/service-role client.

```sql
create or replace function public.org_members_freeze_provenance()
returns trigger as $$
begin
  if new.org_id is distinct from old.org_id
  or new.user_id is distinct from old.user_id
  or new.initiated_by is distinct from old.initiated_by then
    raise exception 'org_id, user_id and initiated_by are immutable'
      using errcode = '42501';
  end if;
  if new.org_role is distinct from old.org_role and not public.is_admin() then
    raise exception 'org_role may only be changed by an admin'
      using errcode = '42501';
  end if;
  if old.status = 'removed' and new.status is distinct from 'removed'
     and not public.is_org_leader(old.org_id) and not public.is_admin() then
    raise exception 'a removed membership can only be restored by an org leader'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql security invoker set search_path = '';

create trigger org_members_freeze_provenance
  before update on public.org_members
  for each row execute function public.org_members_freeze_provenance();

create or replace function public.tutorials_org_must_be_own()
returns trigger as $$
begin
  if new.org_id is not null
     and (tg_op = 'INSERT' or new.org_id is distinct from old.org_id)
     and not public.is_admin()
     and not exists (
       select 1 from public.org_members m
       where m.org_id = new.org_id and m.user_id = auth.uid() and m.status = 'approved'
     ) then
    raise exception 'cannot route a tutorial to an organisation you are not an approved member of'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql security invoker set search_path = '';

create trigger tutorials_org_must_be_own
  before insert or update on public.tutorials
  for each row execute function public.tutorials_org_must_be_own();

-- 008
create or replace function public.tutorials_freeze_review_provenance()
returns trigger as $$
begin
  if (
       case tg_op
         when 'INSERT' then new.review_level is not null
                          or new.reviewed_by is not null
                          or new.flagged_for_follow_up
         else new.review_level is distinct from old.review_level
           or new.reviewed_by is distinct from old.reviewed_by
           or new.flagged_for_follow_up is distinct from old.flagged_for_follow_up
       end
     )
     and auth.uid() is not null
     and not public.is_admin()
     and not (new.org_id is not null and public.is_org_leader(new.org_id))
  then
    raise exception 'review_level, reviewed_by and flagged_for_follow_up may only be written by an admin or an org leader'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql security invoker set search_path = '';

create trigger tutorials_freeze_review_provenance
  before insert or update on public.tutorials
  for each row execute function public.tutorials_freeze_review_provenance();
```

> `tutorials_freeze_review_provenance` is the one place a null `auth.uid()` fails **open** rather than closed, via the `auth.uid() is not null` conjunct. That is the service-role escape, and it is not a hole: no RLS policy on `tutorials` admits a writer who has no `auth.uid()` (they'd fail `is_approved_contributor()`), so a caller that reaches this trigger with a null uid is necessarily a `BYPASSRLS` server context — the admin client `POST /api/tutorials` creates rows with, or a migration.

> All three triggers are `security invoker` (the **opposite** of the helper functions above), and deliberately so. Here, a row that is merely invisible to the caller must fail **closed** — the guard should still raise. In `is_tutorial_contributor()` the same "invisible" situation must fail **open**, or self-review would be silently granted. `set search_path = ''` is what makes running as invoker safe: every name in these trigger bodies is schema-qualified, so no caller-controlled `search_path` can shadow `public.is_admin()` or `public.is_org_leader()` with something else.

---

## 3. Row Level Security

RLS is enabled on every `public` table:

```sql
alter table public.profiles              enable row level security;
alter table public.tutorials             enable row level security;
alter table public.tutorial_contributors enable row level security;
alter table public.parts                 enable row level security;
alter table public.tools                 enable row level security;
alter table public.stl_files             enable row level security;
alter table public.child_profiles        enable row level security;   -- 003
alter table public.organizations         enable row level security;   -- 007
alter table public.org_members           enable row level security;   -- 007
alter table public.user_agreements       enable row level security;   -- 007
```

### Access model at a glance

| Actor | Tutorials & sub-resources | Own profile | Child profile |
|-------|---------------------------|-------------|---------------|
| **Public / anon** | Read only `approved` tutorials (+ their parts/tools/stl_files/contributors) | — | — |
| **Contributor** (approved) | Insert; read + edit **own** tutorials at any status (but cannot self-approve); delete own **draft** | Read + update own | — |
| **Parent** | (same public read) | Read + update own | CRUD **own** row only (`parent_id = auth.uid()`) |
| **Admin** | Full access to everything | Read + update all | Full access |

### `profiles`
```sql
create policy "Anyone can view their own profile" on public.profiles for select using (auth.uid() = id);
create policy "Admin can view all profiles"       on public.profiles for select using (public.is_admin());
create policy "Admin can update all profiles"     on public.profiles for update using (public.is_admin());
create policy "User can update own profile"       on public.profiles for update using (auth.uid() = id);
```

### `tutorials`
Contributors may **read and edit their own tutorials at any status** (to fix mistakes), but `WITH CHECK` forbids leaving a row in `approved` — only admins approve. Deletion by contributors is limited to their own `draft` rows.

```sql
create policy "Anyone can read approved tutorials"
  on public.tutorials for select using (status = 'approved');

create policy "Contributors can read own tutorials"
  on public.tutorials for select using (
    exists (select 1 from public.tutorial_contributors tc
            where tc.tutorial_id = id and tc.profile_id = auth.uid())
  );

create policy "Admin can read all tutorials"
  on public.tutorials for select using (public.is_admin());

create policy "Approved contributors can insert tutorials"
  on public.tutorials for insert with check (public.is_approved_contributor());

-- USING has no status gate (edit at any status); WITH CHECK blocks self-approval.
create policy "Contributors can update own tutorials"
  on public.tutorials for update
  using (
    exists (select 1 from public.tutorial_contributors tc
            where tc.tutorial_id = id and tc.profile_id = auth.uid())
  )
  with check (
    exists (select 1 from public.tutorial_contributors tc
            where tc.tutorial_id = id and tc.profile_id = auth.uid())
    and status in ('draft', 'pending', 'rejected')
  );

create policy "Admin can update all tutorials"
  on public.tutorials for update using (public.is_admin());

create policy "Contributors can delete own draft tutorials"
  on public.tutorials for delete
  using (
    exists (select 1 from public.tutorial_contributors tc
            where tc.tutorial_id = id and tc.profile_id = auth.uid())
    and status = 'draft'
  );

create policy "Admin can delete tutorials"
  on public.tutorials for delete using (public.is_admin());
```

**Org-leader review (007):** a leader's read reach and write reach over their org's tutorials are **deliberately different sizes**. The SELECT policy below is broader than the UPDATE policy: it ignores `trust_level` and the self-review block, because a probation org's leader still needs to see their own queue, and a suspended org's leader still needs visibility into their roster's history. Write authority (the ability to actually approve/reject) is gated separately, in the UPDATE policy, by trust and by not being a contributor on the row.

**Consequence, stated plainly:** because the SELECT policy is that broad, a leader can read their org members' unpublished drafts — not just pending submissions. This belongs in the `contributor_terms` agreement text, and is exactly why the join handshake requires a genuine two-sided opt-in (see `org_members` below) rather than a leader being able to add members unilaterally.

```sql
create policy "Leaders can read their org's tutorials"
  on public.tutorials for select using (
    org_id is not null and public.is_org_leader(org_id)
  );

create policy "Trusted org leaders can review their org's tutorials"
  on public.tutorials for update
  using (
    org_id is not null
    and public.is_org_leader(org_id)
    and exists (
      select 1 from public.organizations o
      where o.id = org_id
        and o.status = 'approved'
        and o.trust_level = 'trusted'
    )
    and not public.is_tutorial_contributor(id)
  )
  with check (
    org_id is not null
    and public.is_org_leader(org_id)
    and exists (
      select 1 from public.organizations o
      where o.id = org_id
        and o.status = 'approved'
        and o.trust_level = 'trusted'
    )
    and not public.is_tutorial_contributor(id)
  );
```

### `tutorial_contributors`
An approved contributor may link **themselves** (`profile_id = auth.uid()`) and only to a tutorial that **has no contributors yet** — the claim, not the join. Adding a second person to an existing tutorial is admin-only *(008; before that, any contributor could attach themselves to any tutorial)*.

```sql
create policy "Anyone can view contributors of approved tutorials"
  on public.tutorial_contributors for select using (public.tutorial_is_approved(tutorial_id));

create policy "Contributors can view own entries"
  on public.tutorial_contributors for select using (profile_id = auth.uid());

-- Replaced in 008. The original ("Approved contributors can insert") constrained
-- only profile_id, so any contributor could attach themselves to ANY tutorial —
-- including a stranger's private draft, which combined with the 007 leader UPDATE
-- grant became a way to get someone else's unsubmitted work published. A
-- contributor may now claim only a tutorial that has no contributors yet, which is
-- exactly the authoring path: POST /api/tutorials inserts the row with no link and
-- the next call adds the author. Once a tutorial has an owner, only an admin can
-- add further contributors. The second arm of the OR is retry safety and grants
-- nothing — it only ever admits a row duplicating one the caller already owns, so
-- a re-link still fails as 23505 (which routes/contributors.ts swallows) rather
-- than as 42501, since a WITH CHECK is evaluated before the index insert.
create policy "Approved contributors can claim an unclaimed tutorial"
  on public.tutorial_contributors for insert
  with check (
    profile_id = auth.uid()
    and public.is_approved_contributor()
    and (
      not public.tutorial_has_contributor(tutorial_id)
      or public.is_tutorial_contributor(tutorial_id)
    )
  );

create policy "Admin full access to tutorial_contributors"
  on public.tutorial_contributors for all using (public.is_admin());
```

### `parts`, `tools`, `stl_files`
All three share the identical policy shape: public reads for `approved` tutorials; owning contributors get read + full write (`for all`) at **any** status; admin full access.

```sql
-- shown for parts; tools and stl_files are identical with the table name swapped
create policy "Anyone can read parts of approved tutorials"
  on public.parts for select using (
    exists (select 1 from public.tutorials t where t.id = tutorial_id and t.status = 'approved')
  );

create policy "Contributors can read own tutorial parts"
  on public.parts for select using (
    exists (select 1 from public.tutorial_contributors tc
            where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid())
  );

create policy "Contributors can write own tutorial parts"
  on public.parts for all
  using (
    exists (select 1 from public.tutorial_contributors tc
            where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid())
  )
  with check (
    exists (select 1 from public.tutorial_contributors tc
            where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid())
  );

create policy "Admin full access to parts" on public.parts for all using (public.is_admin());
```

### `child_profiles`  *(003)*
Row isolation on `parent_id = auth.uid()` — a parent sees and edits only their own row; admins have full access.

```sql
create policy "Parent can view own child profile"
  on public.child_profiles for select using (parent_id = auth.uid());

create policy "Parent can insert own child profile"
  on public.child_profiles for insert with check (parent_id = auth.uid());

create policy "Parent can update own child profile"
  on public.child_profiles for update
  using (parent_id = auth.uid())
  with check (parent_id = auth.uid());

create policy "Admin full access to child_profiles"
  on public.child_profiles for all using (public.is_admin());
```

### `organizations`  *(007)*
Anyone can read an `approved` org (so a contributor can discover it before joining); a creator can always read their own org regardless of status, so they can see their own pending/suspended state; admins read all. Only admins may UPDATE — that's what keeps `status` and `trust_level` out of a leader's own reach, so a leader can never promote their own org out of probation or lift its own suspension.

```sql
create policy "Anyone can read approved organizations"
  on public.organizations for select using (status = 'approved');

create policy "Creator can read own organization at any status"
  on public.organizations for select using (created_by = auth.uid());

create policy "Admin can read all organizations"
  on public.organizations for select using (public.is_admin());

create policy "Contributors who accepted leader terms can create organizations"
  on public.organizations for insert
  with check (
    created_by = auth.uid()
    and public.is_approved_contributor()
    and public.has_accepted('org_leader_terms')
    and status = 'pending'
    and trust_level = 'probation'
  );

create policy "Admin can update organizations"
  on public.organizations for update using (public.is_admin());
```

### `user_agreements`  *(007)*
Users can read and record their own agreement acceptances; admins can read all. There is deliberately **no UPDATE and no DELETE policy** — an acceptance record that can be edited after the fact is not a record.

```sql
create policy "Users can read own agreements"
  on public.user_agreements for select using (user_id = auth.uid());

create policy "Users can record own agreements"
  on public.user_agreements for insert with check (user_id = auth.uid());

create policy "Admin can read all agreements"
  on public.user_agreements for select using (public.is_admin());
```

### `org_members`  *(007)*
A member reads their own memberships; a leader reads their whole org roster (`is_org_leader()` — which, as above, bakes in `status = 'approved'`, so an invited-but-unaccepted leader cannot read a roster); admins read all.

Insert has two independent policies. **Founder bootstrap** exists because the design would otherwise deadlock: the leader-invite policy requires `is_org_leader(org_id)`, which is false for every brand-new org, so no org could ever get its first leader. This policy is scoped tightly — only the org's own `created_by`, only while the org has no approved leader yet, only as `org_role = 'leader'`/`status = 'approved'`/`initiated_by = 'org'` — so it grants exactly one membership per org and nothing beyond that. **Contributor-initiated join requests** always land as `member`/`pending` — you cannot request to join *as* a leader. **Leader-initiated invites** always land `pending` too, never straight to `approved`, because a leader unilaterally granting someone `approved` status would let an org claim a member who never agreed to join.

Update is split by who initiated the row, which is the two-sided handshake: a **leader** may resolve a request the *contributor* initiated (approve/decline), revive a `removed` row back to `pending`, or remove an approved member — but may not touch a row the org itself initiated (an invitation). A **contributor** may resolve an invitation the *org* initiated (accept/decline) on their own row only — they cannot self-approve a request they filed themselves. (The `org_members_freeze_provenance` trigger above is what keeps this handshake honest against a single-statement rewrite of `initiated_by` or `status`.)

```sql
create policy "Members can read own memberships"
  on public.org_members for select using (user_id = auth.uid());

create policy "Leaders can read their org roster"
  on public.org_members for select using (public.is_org_leader(org_id));

create policy "Admin can read all memberships"
  on public.org_members for select using (public.is_admin());

create policy "Org creator can claim first leadership"
  on public.org_members for insert
  with check (
    user_id = auth.uid()
    and org_role = 'leader'
    and status = 'approved'
    and initiated_by = 'org'
    and not public.org_has_approved_leader(org_id)
    and exists (
      select 1 from public.organizations o
      where o.id = org_id and o.created_by = auth.uid()
    )
  );

create policy "Contributors can request to join an org"
  on public.org_members for insert
  with check (
    user_id = auth.uid()
    and initiated_by = 'contributor'
    and status = 'pending'
    and org_role = 'member'
    and public.is_approved_contributor()
  );

create policy "Leaders can invite contributors"
  on public.org_members for insert
  with check (
    public.is_org_leader(org_id)
    and initiated_by = 'org'
    and status = 'pending'
    and invited_by = auth.uid()
    and exists (
      select 1 from public.organizations o
      where o.id = org_id and o.status = 'approved'
    )
  );

create policy "Leaders can resolve contributor-initiated memberships"
  on public.org_members for update
  using (public.is_org_leader(org_id))
  with check (
    public.is_org_leader(org_id)
    and (
      (initiated_by = 'contributor' and status in ('approved', 'declined'))
      or status = 'removed'
      or status = 'pending'
    )
  );

create policy "Contributors can resolve org-initiated invitations"
  on public.org_members for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and initiated_by = 'org'
    and status in ('approved', 'declined')
  );

create policy "Admin full access to org_members"
  on public.org_members for all using (public.is_admin());
```

---

## 4. Storage

Three **public** buckets (open-source access — anyone can read):

```sql
insert into storage.buckets (id, name, public) values
  ('tutorial-pdfs', 'tutorial-pdfs', true),
  ('toy-photos',    'toy-photos',    true),
  ('stl-files',     'stl-files',     true);
```

Per bucket there are three policies — **public SELECT**, approved-contributor **INSERT**, and approved-contributor **UPDATE** (file replacement). The UPDATE policies matter because the upload routes use `upsert: true` (`INSERT ... ON CONFLICT DO UPDATE`), and Postgres evaluates **both** INSERT and UPDATE RLS during an upsert; without the UPDATE policy, replacing an existing file fails with *"new row violates row-level security policy."*

```sql
-- shown for tutorial-pdfs; toy-photos and stl-files are identical with the bucket id swapped
create policy "Public read tutorial-pdfs"
  on storage.objects for select using (bucket_id = 'tutorial-pdfs');

create policy "Authenticated upload tutorial-pdfs"
  on storage.objects for insert
  with check (bucket_id = 'tutorial-pdfs' and public.is_approved_contributor());

create policy "Authenticated update tutorial-pdfs"
  on storage.objects for update
  using      (bucket_id = 'tutorial-pdfs' and public.is_approved_contributor())
  with check (bucket_id = 'tutorial-pdfs' and public.is_approved_contributor());
```

> **002 note:** the three UPDATE policies are created in 001 (for fresh databases) and **re-applied idempotently** in `002_storage_update_policies.sql` (each `create` preceded by `drop policy if exists`) so an already-running database that predates the fix also gets them. On a fresh DB the drops are no-ops.

---

## 5. Data API grants  *(004)*

Current Supabase defaults no longer auto-expose `public` tables to the Data API
roles, so a freshly-generated local stack has **no** grants and every PostgREST
call fails with `permission denied (42501)`. These explicit grants let requests
reach the tables; **RLS remains the actual access-control layer**. On the cloud
DB (created under the old default) every statement is an idempotent no-op, and
the default-privileges lines cover tables added by future migrations.

```sql
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on tables    to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on routines  to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
```
