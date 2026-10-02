-- 091 — Mark this build done (guide-build-done, decided 2026-09-30).
--
--   tutorial_builds          one row per member per guide. Private: who built
--                            what says which accounts have a disabled child,
--                            the same reason 066 gives for tutorial_thanks.
--   builds_count(tutorials)  the public number, as a computed field — never a
--                            column on tutorials (014's trigger + PATCH 409).
--
-- DOWN:
--   drop function if exists public.builds_count(public.tutorials);
--   drop table if exists public.tutorial_builds;

create table public.tutorial_builds (
  tutorial_id uuid not null references public.tutorials (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  built_at    timestamptz not null default now(),
  primary key (tutorial_id, profile_id)
);
create index tutorial_builds_profile_idx on public.tutorial_builds (profile_id);

alter table public.tutorial_builds enable row level security;

create policy "Read your own builds" on public.tutorial_builds for select
  using (profile_id = auth.uid());
-- Only a published guide can be built from.
create policy "Log a build as yourself" on public.tutorial_builds for insert
  with check (
    profile_id = auth.uid()
    and exists (select 1 from public.tutorials t where t.id = tutorial_id and t.status = 'approved')
  );
create policy "Take back your own build" on public.tutorial_builds for delete
  using (profile_id = auth.uid());

create or replace function public.builds_count(t public.tutorials)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.tutorial_builds where tutorial_id = t.id
$$;
