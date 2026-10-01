-- 107 — an author withdraws their own idea while it is pending
-- (challenge-author-states).
--
-- 037 gave authenticated no delete at all ("a rejected idea is resubmitted,
-- not amended"). Withdrawing is narrower than amending: only the author, only
-- before review — nothing was ever public, and participants and messages
-- cannot exist on a pending idea (038's join policy). The API conditions the
-- delete on the same two things, so an idea approved between the screen
-- loading and the tap is not withdrawn.
--
-- With the grant, 037's admin "for all" policy also lets an admin delete an
-- idea through PostgREST directly; the API still offers no admin delete.
--
-- DOWN:
--   drop policy if exists "Authors withdraw a pending idea" on public.toy_ideas;
--   revoke delete on public.toy_ideas from authenticated;

grant delete on public.toy_ideas to authenticated;

create policy "Authors withdraw a pending idea"
  on public.toy_ideas for delete to authenticated
  using (author_id = auth.uid() and status = 'pending');
