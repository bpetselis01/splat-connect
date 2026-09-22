-- 073 — what the owner's toy page needs to draw "How it is doing".
--
-- Board: toy_detail, parent role — stat tiles under the Status card.
--
--   request_count(toys)  every ask a family has made for this toy, whatever
--                        became of it. offered_toy_id is NOT counted: that is
--                        a toy put up in exchange, not a request for it.
--   save_count(toys)     how many accounts have saved it (044's saves table).
--
-- Both are PostgREST computed fields for the reason 066 gives for
-- thanks_count: a counter column would be stamped onto updated_at by 014's
-- set_updated_at trigger and the editor's optimistic-concurrency check would
-- then refuse the owner's own edit. SECURITY DEFINER because a saver's rows
-- are visible only to the saver, and a request only to its two parties; the
-- function hands out a number, never a who. Stable + sql so PostgREST can
-- inline it per row.
--
-- The board also draws views and nearest asker. Neither is tracked and both
-- are product decisions, not derivations, so neither is here.
--
-- DOWN:
--   drop function if exists public.request_count(public.toys);
--   drop function if exists public.save_count(public.toys);
--   drop index if exists public.saves_by_entity_idx;

-- 044's two indexes both lead with profile_id; a count by entity had nothing
-- to read by.
create index saves_by_entity_idx on public.saves (entity_type, entity_id);

create or replace function public.save_count(t public.toys)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.saves
   where entity_type = 'toy' and entity_id = t.id
$$;

create or replace function public.request_count(t public.toys)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.toy_transactions where toy_id = t.id
$$;
