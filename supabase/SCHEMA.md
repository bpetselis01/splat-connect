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
| 007 | `007_organizations.sql` | Adds `organizations`, `org_leaders`, `user_agreements` and `tutorial_orgs`, so an author can ask organisations to back a project and a leader of any that accepted can approve or reject it — instead of every tutorial going through the single platform admin queue. Adds `reviewed_by` and `reviewed_for_org_id` to `tutorials`. Adds the org RLS and `tutorial_orgs_freeze_identity`. |
| 048 | `048_tutorial_kind.sql` | Adds `tutorials.kind` (`toy_adaptation` \| `assistive_tech`) and `tutorial_recommendations`, a positioned join table capped at three rows per tutorial by constraint. |
| 049 | `049_gate_tutorial_files.sql` | Makes `tutorial-pdfs` and `stl-files` private with a signed-in-only SELECT policy; rewrites `tutorials.tutorial_pdf_url` and `stl_files.file_url` from public URLs to object paths. |
| 008 | `008_tutorial_contributor_scope.sql` | Narrows the `tutorial_contributors` INSERT policy so a contributor can only claim a tutorial that has no contributors yet (adds `tutorial_has_contributor()`), closing a path that let a stranger's private draft be published under an organisation. Adds `tutorials_freeze_review_provenance`, which reserves `reviewed_by` and `reviewed_for_org_id` to admins and backing org leaders. |

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
| `tutorial_pdf_url` | text | nullable — since 049 a storage object path in `tutorial-pdfs` (`<tutorial id>/tutorial.pdf`), not a URL; served via `GET /files/tutorial-pdfs/<path>` |
| `toy_photo_url` | text | nullable |
| `kind` | text | not null, default `'toy_adaptation'`, check in (`toy_adaptation`, `assistive_tech`) *(048)* |
| `rejection_note` | text | nullable |
| `maturity` | text | not null, default `'complete'`, check in (`concept`, `prototype`, `in_progress`, `complete`) *(052)* |
| `safety_declared_at` | timestamptz | nullable *(052)* |
| `created_at` | timestamptz | not null, default `now()` |
| `reviewed_at` | timestamptz | nullable |
| `reviewed_by` | uuid | nullable, FK → `profiles` on delete set null *(007)* |
| `reviewed_for_org_id` | uuid | nullable, FK → `organizations` on delete set null *(007)* |

> **Evolution (007):** `reviewed_by` and `reviewed_for_org_id` were added so a published tutorial records who approved it and which organisation's authority they used. Which organisations back a project lives in `tutorial_orgs`, not on the tutorial: many may back one project, and each answers for itself. `reviewed_for_org_id` also anchors the withdrawal freeze — the organisation that approved a published tutorial cannot take its badge back off it.

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
  -- Added in 052:
  maturity text not null default 'complete' check (maturity in ('concept','prototype','in_progress','complete')),
  safety_declared_at timestamptz,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  -- Added in 007:
  reviewed_by uuid references public.profiles on delete set null,
  reviewed_for_org_id uuid references public.organizations on delete set null
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
| `file_url` | text | not null — since 049 a storage object path in `stl-files` (`<tutorial id>/<filename>`), not a URL; served via `GET /files/stl-files/<path>` |

```sql
create table public.stl_files (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid references public.tutorials on delete cascade not null,
  filename text not null,
  file_url text not null
);
```

### `tutorial_recommendations`  *(added in 048)*
Up to three tutorials a creator points readers at. `position` is the order shown and, with the unique constraint, the 3-cap — there is no trigger. The public API additionally drops rows whose *target* is not approved.

| Column | Type | Constraints / default |
|--------|------|-----------------------|
| `tutorial_id` | uuid | FK → `tutorials` on delete cascade, not null, part of PK |
| `recommended_id` | uuid | FK → `tutorials` on delete cascade, not null, part of PK |
| `position` | smallint | not null, check between 1 and 3, unique with `tutorial_id` |
| | | check `tutorial_id <> recommended_id` |

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

RLS mirrors `parts`: anyone reads rows of an approved tutorial, a contributor reads and writes their own, admin has full access.

### `child_profiles`  *(added in 003)*
One row per parent account (unique `parent_id`) holding a child's ability, everyday-needs, and customization data. Backs the mobile parent experience.

| Column | Type | Constraints / default |
|--------|------|-----------------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `parent_id` | uuid | FK → `profiles` on delete cascade, not null, **unique** |
| `age` | integer | nullable |
| **Ability Profile** | | |
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
An organisation is a **badge of trust, never an owner**. Only the admin creates one, so creation *is* approval and there is no pending state.

| Column | Type | Constraints / default |
|--------|------|-----------------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `name` | text | not null |
| `description` | text | nullable |
| `status` | text | not null, default `'active'`, check in (`active`, `suspended`) |
| `created_by` | uuid | nullable, FK → `profiles` on delete set null |
| `created_at` | timestamptz | not null, default `now()` |
| `updated_at` | timestamptz | not null, default `now()` |

`created_by` is always the admin, so it is an audit column rather than an authority one — no policy or function keys off it.

```sql
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### `org_leaders`  *(added in 007)*
Who leads which organisation. That is the whole table: no status, no role, no `initiated_by`, because **only the admin writes it**, so there is no handshake to represent.

| Column | Type | Constraints / default |
|--------|------|-----------------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `org_id` | uuid | FK → `organizations` on delete cascade, not null |
| `user_id` | uuid | FK → `profiles` on delete cascade, not null |
| `created_at` | timestamptz | not null, default `now()` |
| | | unique (`org_id`, `user_id`) |

```sql
create table public.org_leaders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
```

### `tutorial_orgs`  *(added in 007)*
One row per (project, organisation) request. The author creates it as `pending`; a leader of that organisation answers. **Many organisations may back one project**, and each answers only for itself — which is what stops a contributor attaching an organisation's name without its consent.

| Column | Type | Constraints / default |
|--------|------|-----------------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `tutorial_id` | uuid | FK → `tutorials` on delete cascade, not null |
| `org_id` | uuid | FK → `organizations` on delete cascade, not null |
| `status` | text | not null, default `'pending'`, check in (`pending`, `accepted`, `declined`) |
| `requested_at` | timestamptz | not null, default `now()` |
| `responded_at` | timestamptz | nullable |
| `responded_by` | uuid | nullable, FK → `profiles` on delete set null |
| | | unique (`tutorial_id`, `org_id`) |

`responded_by` records which leader answered, so an organisation can see who committed it to what.

```sql
create table public.tutorial_orgs (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid references public.tutorials on delete cascade not null,
  org_id uuid references public.organizations on delete cascade not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  responded_by uuid references public.profiles on delete set null,
  unique (tutorial_id, org_id)
);
```

### `user_agreements`  *(added in 007)*
Logs acceptance only — **contains no legal text**. The terms themselves are versioned static content referenced by the version string. `contributor_terms` gates tutorial submission; `org_leader_terms` is a conjunct of the leader review grant rather than gating any entry point.

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

- **`is_org_leader(p_org_id)`** — true if the caller leads that organisation. One table lookup; there is no membership status to bake in, because `org_leaders` has no states.
- **`has_accepted(p_agreement_type)`** — true if the caller accepted **any** version of that agreement type. Version-agnostic on purpose; forcing re-acceptance on a new version is out of scope, and the `version` column keeps that option open without a migration.
- **`is_tutorial_contributor(p_tutorial_id)`** — true if the caller is a contributor on that tutorial. Used by the 008 claim policy as its retry-safety arm, and by the `tutorial_orgs` policies to identify the author.
- **`tutorial_offered_to_my_org(p_tutorial_id)`** — the leader **read** grant. Includes `pending`, because reading the project is how a leader decides whether to back it.
- **`can_review_tutorial(p_tutorial_id)`** — the leader **write** grant, minus the terms conjunct which lives in the policy. Narrower than the read grant on purpose: `accepted` only, and the organisation must be `active`. Suspending an organisation therefore revokes every one of its leaders' review powers instantly, with no cleanup job.

```sql
create or replace function public.is_org_leader(p_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.org_leaders
    where org_id = p_org_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function public.has_accepted(p_agreement_type text)
returns boolean as $$
  select exists (
    select 1 from public.user_agreements
    where user_id = auth.uid() and agreement_type = p_agreement_type
  );
$$ language sql security definer stable;

create or replace function public.is_tutorial_contributor(p_tutorial_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.tutorial_contributors
    where tutorial_id = p_tutorial_id and profile_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function public.tutorial_offered_to_my_org(p_tutorial_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.tutorial_orgs t_o
    join public.org_leaders l on l.org_id = t_o.org_id
    where t_o.tutorial_id = p_tutorial_id
      and t_o.status in ('pending', 'accepted')
      and l.user_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function public.can_review_tutorial(p_tutorial_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.tutorial_orgs t_o
    join public.org_leaders l on l.org_id = t_o.org_id
    join public.organizations o on o.id = t_o.org_id
    where t_o.tutorial_id = p_tutorial_id
      and t_o.status = 'accepted'
      and l.user_id = auth.uid()
      and o.status = 'active'
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

An RLS `with check` clause sees only the **new** row, and a Postgres policy cannot reference `OLD`. Any rule that depends on what a row *was* is therefore unexpressible as a policy, and any policy gating on a column the same statement can rewrite is a lock whose key is stored on the door. Both triggers below exist for that reason.

- **`tutorial_orgs_freeze_identity`** (`before update`) — makes `tutorial_id` and `org_id` immutable. `org_id` is already covered by the UPDATE policy checking `is_org_leader` on both the old and new row; `tutorial_id` is not covered by anything else. Without this a leader could take a legitimate acceptance of one project and repoint it at another, stamping their organisation on work that never asked for it — an attack on the author rather than on the org. Reproduced end to end before the trigger existed.
- **`tutorials_freeze_review_provenance`** (`before insert or update`) — reserves `reviewed_by` and `reviewed_for_org_id` to admins and to leaders of a backing organisation, so an author cannot forge their own review provenance. Gated on *change* (`is distinct from`), so ordinary edits to title or parts are unaffected.

> Both are `security invoker` (the **opposite** of the helper functions above), and deliberately so. Here, a row that is merely invisible to the caller must fail **closed** — the guard should still raise. The definer helpers are the opposite case: they are asked for facts that must not depend on the caller's visibility at all. `set search_path = ''` is what makes running as invoker safe: every name in these bodies is schema-qualified, so no caller-controlled `search_path` can shadow `public.is_admin()` or `public.can_review_tutorial()` with something else.

> The `auth.uid() is null` arm in `tutorials_freeze_review_provenance` is the service-role escape, and it is not a hole: no RLS policy on `tutorials` admits a writer without an `auth.uid()`, so a caller reaching this trigger with a null uid is necessarily a BYPASSRLS server context — the admin client, which is how `POST /api/tutorials` creates a row, or a migration.

```sql
create or replace function public.tutorial_orgs_freeze_identity()
returns trigger as $$
begin
  if new.tutorial_id is distinct from old.tutorial_id
  or new.org_id is distinct from old.org_id then
    raise exception 'tutorial_id and org_id are immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql security invoker set search_path = '';

create trigger tutorial_orgs_freeze_identity
  before update on public.tutorial_orgs
  for each row execute function public.tutorial_orgs_freeze_identity();

create or replace function public.tutorials_freeze_review_provenance()
returns trigger as $$
begin
  if (
       case tg_op
         when 'INSERT' then new.reviewed_by is not null
                          or new.reviewed_for_org_id is not null
         else new.reviewed_by is distinct from old.reviewed_by
           or new.reviewed_for_org_id is distinct from old.reviewed_for_org_id
       end
     )
     and auth.uid() is not null
     and not public.is_admin()
     and not public.can_review_tutorial(new.id)
  then
    raise exception 'reviewed_by and reviewed_for_org_id may only be written by an admin or a backing org leader'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql security invoker set search_path = '';

create trigger tutorials_freeze_review_provenance
  before insert or update on public.tutorials
  for each row execute function public.tutorials_freeze_review_provenance();
```


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
alter table public.org_leaders             enable row level security;   -- 007
alter table public.user_agreements       enable row level security;   -- 007
alter table public.tutorial_orgs   enable row level security;
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

**Org-leader review (007):** a leader's read reach and write reach over the projects offered to their organisation are **deliberately different sizes**. The SELECT policy includes `pending` requests and ignores both the organisation's status and the terms gate, because reading a project is how a leader decides whether to back it, and a suspended organisation's leader keeps visibility into what they already took on. The UPDATE policy carries two conditions — `can_review_tutorial()`, which itself requires an *accepted* backing row for an organisation you lead **and** that organisation being `active`, plus an accepted `org_leader_terms` agreement. Losing leadership, suspension, the organisation withdrawing its backing, and withdrawn consent therefore each independently revoke the capability instantly, with no cache to invalidate and no cleanup job to run.

**There is no self-review block**: a leader may approve a project they authored, if an organisation they lead is backing it. Leadership is granted by the admin to someone already trusted, and a single-leader organisation could otherwise never publish its leader's own work. The control is reactive — remove the leader, suspend the organisation, or reject the tutorial — which is what makes the admin spot-check surface load-bearing rather than nice-to-have.

**Consequence, stated plainly:** because the SELECT policy includes `pending`, offering a project to an organisation exposes the draft to that organisation's leaders, *including if they then decline*. That belongs in the `contributor_terms` text, and it is why the submit flow should encourage asking one or two organisations rather than every one on the list. It is far narrower than the superseded membership model, where joining an organisation exposed every draft the contributor had.

```sql
create policy "Leaders can read projects offered to their org"
  on public.tutorials for select
  using (public.tutorial_offered_to_my_org(id));

create policy "Backing org leaders can review the project"
  on public.tutorials for update
  using (
    public.can_review_tutorial(id)
    and public.has_accepted('org_leader_terms')
  )
  with check (
    public.can_review_tutorial(id)
    and public.has_accepted('org_leader_terms')
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
Readable by anyone at any status, deliberately: a suspended organisation's badge must keep rendering on tutorials it already backed, or history rewrites itself. Names and descriptions are public anyway. Every write is admin-only — that is what keeps `status` out of a leader's reach, so a leader can never un-suspend their own organisation. `created_by` is always the admin: an audit column, not an authority one.

```sql
create policy "Anyone can read organizations"
  on public.organizations for select using (true);

create policy "Admin can write organizations"
  on public.organizations for all
  using (public.is_admin())
  with check (public.is_admin());
```

### `org_leaders`  *(007)*
Public to read — a leader is a public-facing trust figure, and the badge on a published tutorial should be traceable to a person. Every write is admin-only: **only the admin grants or removes leadership.** There is no provenance trigger on this table and none is needed; a trigger would exist to constrain non-admin writes, and there are none.

```sql
create policy "Anyone can read org leaders"
  on public.org_leaders for select using (true);

create policy "Admin can write org leaders"
  on public.org_leaders for all
  using (public.is_admin())
  with check (public.is_admin());
```

### `user_agreements`  *(007)*
Users read and record their own acceptances; admins read all. There is deliberately **no UPDATE and no DELETE policy** — an acceptance record that can be edited after the fact is not a record.

```sql
create policy "Users can read own agreements"
  on public.user_agreements for select using (user_id = auth.uid());

create policy "Users can record own agreements"
  on public.user_agreements for insert with check (user_id = auth.uid());

create policy "Admin can read all agreements"
  on public.user_agreements for select using (public.is_admin());
```

### `tutorial_orgs`  *(007)*
The backing handshake, and the security centre of the org feature. The author asks; a leader of the asked organisation answers. Neither can complete it alone, which is what stops a contributor attaching an organisation's name to work its leaders never agreed to back.

**INSERT** is the author's, and pins `status = 'pending'`. An author who could write `'accepted'` would hand that organisation's leaders authority over their work unilaterally — the one thing this table exists to prevent. Draft or pending tutorials only: you cannot bolt an organisation onto published work.

**UPDATE** is the leader's, and checks `is_org_leader` in *both* clauses — `using` sees the old row, `with check` the new one — so a leader cannot move a row to an organisation they do not lead. There is deliberately **no UPDATE policy for contributors at all**, so the forge has no path rather than a check to get past.

**DELETE** lets either side back out, until the organisation in the row is the one that approved the tutorial. After that the row *is* the audit trail: `reviewed_for_org_id` would otherwise point at an organisation listed nowhere. An organisation that lent its name but did not review may still withdraw; the one that approved must reject the tutorial instead.

**SELECT** has two policies: the participants (author, that org's leaders, admin), and a public one scoped to accepted rows on published tutorials, so a pending or declined request never renders anywhere.

```sql
create policy "Authors can ask an org to back their project"
  on public.tutorial_orgs for insert
  with check (
    public.is_tutorial_contributor(tutorial_id)
    and status = 'pending'
    and exists (
      select 1 from public.tutorials t
      where t.id = tutorial_id and t.status in ('draft', 'pending')
    )
  );

create policy "Leaders can answer requests to their org"
  on public.tutorial_orgs for update
  using (public.is_org_leader(org_id))
  with check (
    public.is_org_leader(org_id)
    and status in ('accepted', 'declined')
  );

create policy "The author and the asked org can read a request"
  on public.tutorial_orgs for select
  using (
    public.is_tutorial_contributor(tutorial_id)
    or public.is_org_leader(org_id)
  );

create policy "Anyone can read accepted backing on a published project"
  on public.tutorial_orgs for select
  using (
    status = 'accepted'
    and exists (
      select 1 from public.tutorials t
      where t.id = tutorial_id and t.status = 'approved'
    )
  );

create policy "Either side can withdraw backing before it was acted on"
  on public.tutorial_orgs for delete
  using (
    (public.is_tutorial_contributor(tutorial_id) or public.is_org_leader(org_id))
    and not exists (
      select 1 from public.tutorials t
      where t.id = tutorial_id
        and t.status = 'approved'
        and t.reviewed_for_org_id = org_id
    )
  );

create policy "Admin full access to tutorial_orgs"
  on public.tutorial_orgs for all using (public.is_admin());
```


## 4. Storage

Three buckets were created public in 001. Since 049, `tutorial-pdfs` and `stl-files` are **private** — a tutorial's files need an account, the way Makers Making Change gates design files — and of the three buckets 001 created, only `toy-photos` is still public (cover photos are on every browse card).

```sql
insert into storage.buckets (id, name, public) values
  ('tutorial-pdfs', 'tutorial-pdfs', true),   -- flipped to false in 049
  ('toy-photos',    'toy-photos',    true),
  ('stl-files',     'stl-files',     true);   -- flipped to false in 049
```

Per bucket there are three policies — **SELECT** (public for `toy-photos`; `auth.uid() is not null` for the other two since 049), contributor **INSERT**, and contributor **UPDATE** (file replacement). The UPDATE policies matter because the upload routes use `upsert: true` (`INSERT ... ON CONFLICT DO UPDATE`), and Postgres evaluates **both** INSERT and UPDATE RLS during an upsert; without the UPDATE policy, replacing an existing file fails with *"new row violates row-level security policy."*

```sql
-- shown for tutorial-pdfs; stl-files is identical with the bucket id swapped.
-- toy-photos keeps the original "Public read" policy with no auth.uid() test.
create policy "Signed-in read tutorial-pdfs"
  on storage.objects for select
  using (bucket_id = 'tutorial-pdfs' and auth.uid() is not null);

create policy "Authenticated upload tutorial-pdfs"
  on storage.objects for insert
  with check (bucket_id = 'tutorial-pdfs' and public.is_approved_contributor());

create policy "Authenticated update tutorial-pdfs"
  on storage.objects for update
  using      (bucket_id = 'tutorial-pdfs' and public.is_approved_contributor())
  with check (bucket_id = 'tutorial-pdfs' and public.is_approved_contributor());
```

> **002 note:** the three UPDATE policies are created in 001 (for fresh databases) and **re-applied idempotently** in `002_storage_update_policies.sql` (each `create` preceded by `drop policy if exists`) so an already-running database that predates the fix also gets them. On a fresh DB the drops are no-ops.

> **049 note:** signed-in users never fetch these two buckets directly. The web route handler `packages/web/app/files/[bucket]/[...path]/route.ts` checks the session cookie, creates a 60-second signed URL with the user's own JWT (which is why the SELECT policy exists — Storage checks it before signing), and redirects. A signed-out visitor is redirected to `/signup?next=/tutorials/<id>&reason=download` instead. The SELECT policy is "any signed-in user," not ownership-scoped — a signed-in user who knows a tutorial id can sign that tutorial's files whatever its status; that is the account gate the spec asked for, not an authorship gate.

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
