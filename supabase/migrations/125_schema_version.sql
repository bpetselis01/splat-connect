-- 125 — schema_version(): the newest migration this database has applied.
--
-- The dev API hot-reloads a route the second its file is saved, but a
-- migration reaches a database only when someone runs `supabase db push`
-- (hosted) or `supabase migration up --local`. Between the two, every route
-- that selects a new column is a 500 with "column X does not exist", one route
-- at a time, with nothing saying why. 088's print settings sat in that gap for
-- 28 hours and the phone's inbox was dark the whole time.
--
-- PostgREST does not expose supabase_migrations, so this is the one way the
-- API can read the ledger. GET /health reports it next to the version the
-- code was written against, and boot logs the two when they differ.
--
-- SECURITY DEFINER, service role only: the ledger is not a user's business,
-- and the API reads it through the admin client.
--
-- DOWN:
--   drop function if exists public.schema_version();

create function public.schema_version()
returns text
language sql stable security definer set search_path = ''
as $$
  select max(version) from supabase_migrations.schema_migrations
$$;

revoke execute on function public.schema_version() from public, anon, authenticated;
grant execute on function public.schema_version() to service_role;
