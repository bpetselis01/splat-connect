-- 034_public_showcase.sql
-- WHY: individuals are shown on the public impact wall by default, but must be
--      able to remove themselves. Orgs are public entities and have no toggle.
-- HOW: an opt-out flag. Opt-out is enforced in routes/public.ts (the showcase
--      endpoints filter public_showcase and 404 opted-out profiles). It is NOT a
--      profiles RLS policy: profiles.name anon-read is already granted by 023
--      (contributor credit) and 026 (reviewer name), and the spec requires those
--      to keep showing for opted-out people, so an RLS gate here would be both
--      ineffective (policies OR together) and wrong (it would hide credits).
-- The column grant follows the 029 pattern so the API/tests may select the flag.
alter table public.profiles
  add column public_showcase boolean not null default true;

grant select (public_showcase) on public.profiles to anon, authenticated;
