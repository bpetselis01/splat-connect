-- ============================================================
-- splat-connect — consolidated schema
-- Single-shot deploy for a fresh Supabase project. Represents the
-- final state of migrations 001-004; run once against a new database.
--
-- Local dev / CI keep using supabase/migrations/*.sql via the
-- Supabase CLI (supabase start / db reset) — this file does not
-- replace or duplicate that migration history.
-- ============================================================

-- ============================================================
-- Tables
-- ============================================================

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null default '',
  email text not null default '',
  role text not null default 'contributor'
    check (role in ('admin', 'contributor', 'parent')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

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

create table public.tutorial_contributors (
  tutorial_id uuid references public.tutorials on delete cascade,
  profile_id uuid references public.profiles on delete cascade,
  role text not null default 'primary'
    check (role in ('primary', 'collaborator')),
  added_at timestamptz not null default now(),
  primary key (tutorial_id, profile_id)
);

create table public.parts (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid references public.tutorials on delete cascade not null,
  name text not null,
  quantity integer not null default 1,
  is_optional boolean not null default false,
  buy_links jsonb not null default '[]'
);

create table public.tools (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid references public.tutorials on delete cascade not null,
  name text not null,
  is_optional boolean not null default false,
  buy_links jsonb not null default '[]'
);

create table public.stl_files (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid references public.tutorials on delete cascade not null,
  filename text not null,
  file_url text not null
);

-- One child profile per parent (unique parent_id, not PK — leaves the
-- door open for multi-child later via a single drop constraint).
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

-- ============================================================
-- Auto-create profile on signup
-- ============================================================

-- Signup trigger honors role='parent' from metadata; anything else
-- (including omitted) defaults to 'contributor'. WHY: without this
-- whitelist a client could pass role='admin' at signup and self-grant admin.
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Helper functions
-- ============================================================

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

-- Breaks the RLS recursion cycle between tutorials and tutorial_contributors:
-- tutorial_contributors policy can't query tutorials directly (infinite loop),
-- so this security definer function bypasses RLS to do it safely.
create or replace function public.tutorial_is_approved(t_id uuid)
returns boolean as $$
  select exists (select 1 from public.tutorials where id = t_id and status = 'approved')
$$ language sql security definer stable;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.tutorials enable row level security;
alter table public.tutorial_contributors enable row level security;
alter table public.parts enable row level security;
alter table public.tools enable row level security;
alter table public.stl_files enable row level security;
alter table public.child_profiles enable row level security;

-- profiles
create policy "Anyone can view their own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Admin can view all profiles"
  on public.profiles for select using (public.is_admin());

create policy "Admin can update all profiles"
  on public.profiles for update using (public.is_admin());

create policy "User can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- tutorials
create policy "Anyone can read approved tutorials"
  on public.tutorials for select using (status = 'approved');

create policy "Contributors can read own tutorials"
  on public.tutorials for select using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = id and tc.profile_id = auth.uid()
    )
  );

create policy "Admin can read all tutorials"
  on public.tutorials for select using (public.is_admin());

create policy "Approved contributors can insert tutorials"
  on public.tutorials for insert with check (public.is_approved_contributor());

-- USING has no status gate so contributors can edit at any status.
-- WITH CHECK prevents leaving a row in 'approved' — only admins can approve.
create policy "Contributors can update own tutorials"
  on public.tutorials for update
  using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = id and tc.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = id and tc.profile_id = auth.uid()
    ) and status in ('draft', 'pending', 'rejected')
  );

create policy "Admin can update all tutorials"
  on public.tutorials for update using (public.is_admin());

create policy "Contributors can delete own draft tutorials"
  on public.tutorials for delete
  using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = id and tc.profile_id = auth.uid()
    ) and status = 'draft'
  );

create policy "Admin can delete tutorials"
  on public.tutorials for delete using (public.is_admin());

-- tutorial_contributors
create policy "Anyone can view contributors of approved tutorials"
  on public.tutorial_contributors for select using (
    public.tutorial_is_approved(tutorial_id)
  );

create policy "Contributors can view own entries"
  on public.tutorial_contributors for select using (profile_id = auth.uid());

create policy "Approved contributors can insert"
  on public.tutorial_contributors for insert
  with check (profile_id = auth.uid() and public.is_approved_contributor());

create policy "Admin full access to tutorial_contributors"
  on public.tutorial_contributors for all using (public.is_admin());

-- parts
create policy "Anyone can read parts of approved tutorials"
  on public.parts for select using (
    exists (select 1 from public.tutorials t where t.id = tutorial_id and t.status = 'approved')
  );

create policy "Contributors can read own tutorial parts"
  on public.parts for select using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid()
    )
  );

create policy "Contributors can write own tutorial parts"
  on public.parts for all
  using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid()
    )
  );

create policy "Admin full access to parts"
  on public.parts for all using (public.is_admin());

-- tools
create policy "Anyone can read tools of approved tutorials"
  on public.tools for select using (
    exists (select 1 from public.tutorials t where t.id = tutorial_id and t.status = 'approved')
  );

create policy "Contributors can read own tutorial tools"
  on public.tools for select using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid()
    )
  );

create policy "Contributors can write own tutorial tools"
  on public.tools for all
  using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid()
    )
  );

create policy "Admin full access to tools"
  on public.tools for all using (public.is_admin());

-- stl_files
create policy "Anyone can read stl_files of approved tutorials"
  on public.stl_files for select using (
    exists (select 1 from public.tutorials t where t.id = tutorial_id and t.status = 'approved')
  );

create policy "Contributors can read own tutorial stl_files"
  on public.stl_files for select using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid()
    )
  );

create policy "Contributors can write own tutorial stl_files"
  on public.stl_files for all
  using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid()
    )
  );

create policy "Admin full access to stl_files"
  on public.stl_files for all using (public.is_admin());

-- child_profiles
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

-- ============================================================
-- Storage buckets (public for open-source access)
-- ============================================================

insert into storage.buckets (id, name, public) values
  ('tutorial-pdfs', 'tutorial-pdfs', true),
  ('toy-photos', 'toy-photos', true),
  ('stl-files', 'stl-files', true);

create policy "Public read tutorial-pdfs"
  on storage.objects for select using (bucket_id = 'tutorial-pdfs');

create policy "Authenticated upload tutorial-pdfs"
  on storage.objects for insert
  with check (bucket_id = 'tutorial-pdfs' and public.is_approved_contributor());

create policy "Public read toy-photos"
  on storage.objects for select using (bucket_id = 'toy-photos');

create policy "Authenticated upload toy-photos"
  on storage.objects for insert
  with check (bucket_id = 'toy-photos' and public.is_approved_contributor());

create policy "Public read stl-files"
  on storage.objects for select using (bucket_id = 'stl-files');

create policy "Authenticated upload stl-files"
  on storage.objects for insert
  with check (bucket_id = 'stl-files' and public.is_approved_contributor());

-- upsert:true in the upload routes runs as INSERT ON CONFLICT DO UPDATE.
-- PostgreSQL evaluates both INSERT and UPDATE RLS policies during this
-- operation, so replacing an existing file needs its own UPDATE policy.
create policy "Authenticated update tutorial-pdfs"
  on storage.objects for update
  using  (bucket_id = 'tutorial-pdfs' and public.is_approved_contributor())
  with check (bucket_id = 'tutorial-pdfs' and public.is_approved_contributor());

create policy "Authenticated update toy-photos"
  on storage.objects for update
  using  (bucket_id = 'toy-photos' and public.is_approved_contributor())
  with check (bucket_id = 'toy-photos' and public.is_approved_contributor());

create policy "Authenticated update stl-files"
  on storage.objects for update
  using  (bucket_id = 'stl-files' and public.is_approved_contributor())
  with check (bucket_id = 'stl-files' and public.is_approved_contributor());

-- ============================================================
-- Data API grants
-- ============================================================

-- WHY: Newer Supabase defaults stop auto-exposing tables to the Data API roles
--      (anon / authenticated / service_role). Without these grants every
--      PostgREST call fails with "permission denied" (42501).
-- HOW: Grants let requests reach the tables; row-level security policies
--      above remain the actual access-control layer. Default privileges cover
--      tables added by future migrations so they are exposed automatically.

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
