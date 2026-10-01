-- 105 — how many accounts saved a challenge (challenge-saves-stat).
--
-- 073's save_count(toys), for toy_ideas: a PostgREST computed field, SECURITY
-- DEFINER because a saver's rows are visible only to the saver (044), stable
-- sql so it inlines per row. A number, never a who. Overloads 073's by its
-- argument type; 073's saves_by_entity_idx serves both.
--
-- DOWN:
--   drop function if exists public.save_count(public.toy_ideas);

create or replace function public.save_count(i public.toy_ideas)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.saves
   where entity_type = 'challenge' and entity_id = i.id
$$;
