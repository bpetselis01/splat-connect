-- ============================================================
-- Parent role + child profiles
-- ============================================================

-- 1. Allow 'parent' as a profile role
alter table public.profiles
  drop constraint profiles_role_check,
  add constraint profiles_role_check
    check (role in ('admin', 'contributor', 'parent'));

-- 2. Signup trigger honors role='parent' from metadata; anything else
--    (including omitted) still defaults to 'contributor'. WHY: without this
--    whitelist a client could pass role='admin' at signup and self-grant admin.
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

-- 3. Helper mirroring is_admin()/is_approved_contributor()
create or replace function public.is_parent()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'parent'
  );
$$ language sql security definer stable;

-- 4. One child profile per parent (unique parent_id, not PK — leaves the
--    door open for multi-child later via a single drop constraint).
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

alter table public.child_profiles enable row level security;

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
