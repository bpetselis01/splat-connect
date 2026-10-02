-- 092 — how many times a guide has been opened (my-tutorials-views, decided
-- 2026-09-30). Its own table: a column on tutorials would be stamped onto
-- updated_at by 014's trigger and 409 the author mid-edit.
--
--   tutorial_view_counts       one row per guide. No client policies: only the
--                              two functions below touch it.
--   bump_tutorial_view(uuid)   +1, called by the public guide read with the
--                              service role. Never by a client.
--   view_count(tutorials)      the number, as a computed field.
--
-- ponytail: raw reads, no bot or repeat filtering. Filter by user agent in
-- public.ts if the numbers ever start deciding something.
--
-- DOWN:
--   drop function if exists public.view_count(public.tutorials);
--   drop function if exists public.bump_tutorial_view(uuid);
--   drop table if exists public.tutorial_view_counts;

create table public.tutorial_view_counts (
  tutorial_id uuid primary key references public.tutorials (id) on delete cascade,
  views bigint not null default 0
);
alter table public.tutorial_view_counts enable row level security;

create or replace function public.bump_tutorial_view(p_tutorial_id uuid)
returns void
language sql volatile security definer set search_path = ''
as $$
  insert into public.tutorial_view_counts (tutorial_id, views) values (p_tutorial_id, 1)
  on conflict (tutorial_id) do update set views = public.tutorial_view_counts.views + 1
$$;
revoke all on function public.bump_tutorial_view(uuid) from public, anon, authenticated;
grant execute on function public.bump_tutorial_view(uuid) to service_role;

create or replace function public.view_count(t public.tutorials)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select coalesce((select views from public.tutorial_view_counts where tutorial_id = t.id), 0)
$$;
