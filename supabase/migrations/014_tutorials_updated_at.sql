-- supabase/migrations/014_tutorials_updated_at.sql
-- WHY: parts and tools are POST-one/DELETE-one endpoints — concurrent edits
--      there are commutative and never overwrite each other. The tutorials
--      row itself (title, description, difficulty, photo, PDF) is the only
--      shared, replace-in-place resource two collaborators could silently
--      clobber. This column is what a save can check against to detect that.
-- HOW: A BEFORE UPDATE trigger, so every write path (this table's own PATCH,
--      the admin status endpoint, the leader review endpoint) bumps it
--      uniformly — the API layer never has to remember to set it.
alter table public.tutorials add column updated_at timestamptz not null default now();

-- security invoker (the default) plus a pinned search_path, matching every
-- other plpgsql trigger function in this codebase (007, 008) — this one
-- touches no other table and grants nothing, but there's no reason for it
-- to be the one function that resolves `now()` against a caller-controlled
-- search_path.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security invoker set search_path = '';

create trigger tutorials_bump_updated_at
  before update on public.tutorials
  for each row execute function public.set_updated_at();
