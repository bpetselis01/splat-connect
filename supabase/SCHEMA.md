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
  reviewed_at timestamptz
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

### `tutorial_contributors`
```sql
create policy "Anyone can view contributors of approved tutorials"
  on public.tutorial_contributors for select using (public.tutorial_is_approved(tutorial_id));

create policy "Contributors can view own entries"
  on public.tutorial_contributors for select using (profile_id = auth.uid());

create policy "Approved contributors can insert"
  on public.tutorial_contributors for insert
  with check (profile_id = auth.uid() and public.is_approved_contributor());

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
