-- supabase/migrations/035_notify_signups.sql
--
-- Interest registrations from the nine scaffold pages.
--
-- Insert-only by design: there is no select policy for anon or authenticated, so
-- the list is readable through the service role alone (i.e. the Supabase console).
-- An admin UI for a table checked a handful of times would be the wrong instinct;
-- if a single feature's list passes a few hundred, revisit.

create table public.notify_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  feature_key text not null,
  created_at timestamptz not null default now(),
  -- Registering twice for the same feature is not an error worth surfacing, so the
  -- endpoint swallows the violation this constraint raises.
  unique (email, feature_key)
);

alter table public.notify_signups enable row level security;

create policy "anyone may register interest"
  on public.notify_signups for insert to anon, authenticated
  with check (true);

grant insert on public.notify_signups to anon, authenticated;
