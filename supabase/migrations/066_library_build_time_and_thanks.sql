-- 066 — what the guides library needs to draw the board's card and rail.
--
-- Spec: docs/superpowers/specs/2026-09-18-library-backend-design.md
--
--   tutorials.build_minutes  hands-on time, printing EXCLUDED. Nullable because a
--                            new draft has none yet; PATCH /api/tutorials/:id
--                            refuses the draft -> pending step without it, beside
--                            the safety-declaration gate.
--   tutorial_thanks          one row per person per guide. Private: who thanked
--                            what says which accounts have a disabled child.
--   thanks_count(tutorials)  the public number, as a PostgREST computed field.
--   has_stl(tutorials)       "Needs printing" — the guide has STL files.
--
-- Why thanks_count is a function and not a counter column on tutorials: 014's
-- set_updated_at trigger would stamp every thank onto the guide's updated_at,
-- and the editor's optimistic-concurrency check (.eq('updated_at', …)) would
-- then tell an author mid-edit that "someone else" had changed their guide.
-- A function also needs no guard against an author writing their own count.
--
-- DOWN:
--   drop function if exists public.has_stl(public.tutorials);
--   drop function if exists public.thanks_count(public.tutorials);
--   drop table if exists public.tutorial_thanks;
--   alter table public.tutorials drop column if exists build_minutes;
--   (and restore 058's notifications_type_check)

-- ------------------------------------------------------------ build time --

alter table public.tutorials
  add column build_minutes int check (build_minutes between 1 and 600);

-- Development data only: nothing is public yet, and Byron asked for invented
-- times so every existing guide can be filtered and sorted. Drawn from the
-- editor's own choices (BUILD_TIME_OPTIONS, 15 min to 2 h) so every value
-- formats the way the editor would have written it.
update public.tutorials
  set build_minutes = (array[15, 20, 30, 45, 60, 90, 120])[1 + floor(random() * 7)::int]
  where build_minutes is null;

-- ---------------------------------------------------------------- thanks --

create table public.tutorial_thanks (
  tutorial_id uuid not null references public.tutorials on delete cascade,
  profile_id  uuid not null references public.profiles on delete cascade,
  created_at  timestamptz not null default now(),
  -- Once per person per guide. The primary key is also the index
  -- thanks_count() reads by, tutorial_id first.
  primary key (tutorial_id, profile_id)
);

alter table public.tutorial_thanks enable row level security;

create policy "Read your own thanks"
  on public.tutorial_thanks for select
  using (profile_id = auth.uid());

create policy "Thank as yourself"
  on public.tutorial_thanks for insert
  with check (profile_id = auth.uid());

-- No update or delete policy: a thank cannot be taken back. No admin policy
-- either, for the reason 044 gives for saves — nobody acts on a thank.

-- The count, and only the count. SECURITY DEFINER because the rows are
-- invisible to everyone but their author; the function hands out a number,
-- never a name. Stable + sql so PostgREST can inline it per row.
create or replace function public.thanks_count(t public.tutorials)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.tutorial_thanks where tutorial_id = t.id
$$;

-- Invoker, not definer: 001 already lets anyone read the STL rows of an
-- approved guide, and an author their own drafts', which is exactly who should
-- see the flag.
create or replace function public.has_stl(t public.tutorials)
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select exists (select 1 from public.stl_files where tutorial_id = t.id)
$$;

-- --------------------------------------------------------- notifications --

alter table public.notifications drop constraint notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
    'collaborator_removed', 'collaborator_left',
    'tutorial_approved', 'tutorial_rejected',
    'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message',
    'idea_approved', 'idea_rejected',
    'challenge_joined', 'challenge_left', 'challenge_removed',
    'idea_graduated',
    'backing_requested', 'tutorial_submitted',
    'build_shot_posted', 'build_approved',
    'print_started', 'print_ready',
    -- new in 066
    'tutorial_thanked'
  ));
