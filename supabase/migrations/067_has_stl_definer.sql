-- 067 — has_stl() as 066 wrote it timed out the public guide list.
--
-- 066 made has_stl SECURITY INVOKER, reasoning that 001's stl_files policies
-- already admit exactly who should see the flag. True, and ruinous: every
-- guide's EXISTS ran stl_files' RLS — a subquery on tutorials per STL row — and
-- stl_files had no index on tutorial_id at all. On the local E2E stack (437
-- listed guides, 754 STL rows) GET /api/public/tutorials hit the anon role's
-- 3s statement_timeout on every call.
--
-- DEFINER, like thanks_count: the function is only ever handed a tutorials row
-- the caller could already read, and it answers one boolean about it — never a
-- filename, never a path. The files themselves stay behind 049's bucket gate.
--
-- DOWN:
--   drop index if exists public.stl_files_tutorial_id_idx;
--   (and recreate 066's has_stl with security invoker)

create index if not exists stl_files_tutorial_id_idx on public.stl_files (tutorial_id);

create or replace function public.has_stl(t public.tutorials)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.stl_files where tutorial_id = t.id)
$$;
