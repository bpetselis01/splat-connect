-- 115 — a drop-off is booked by its contributor and decided by a leader, never
-- both by the same write (recycling-build final review).
--
-- 059's insert policy checked only contributor_id = auth.uid(). With 004's
-- table grants a member could POST straight to PostgREST a row already
-- 'received' with credit_grams of their choosing, and since 114 that row counts
-- in recycling_credit_balance(). The insert now has to be a booking: status
-- 'booked' and every column the leader sets at the door still null.
--
-- 059's leader update policy let a leader change a drop-off after it was
-- decided — re-weigh a received one after its credit was spent, and the
-- balance goes negative. The using clause now admits only rows still 'booked';
-- the with check is unchanged, so the one transition it allows is booked ->
-- received/declined. The contributor's cancel goes through the API's admin
-- client, so it is unaffected.
--
-- DOWN:
--   drop policy if exists "Book your own drop-off" on public.recycling_dropoffs;
--   create policy "Book your own drop-off"
--     on public.recycling_dropoffs for insert to authenticated
--     with check (contributor_id = auth.uid());
--   drop policy if exists "Leaders weigh in their organisation's drop-offs" on public.recycling_dropoffs;
--   create policy "Leaders weigh in their organisation's drop-offs"
--     on public.recycling_dropoffs for update to authenticated
--     using (public.is_org_leader(org_id))
--     with check (public.is_org_leader(org_id));

drop policy "Book your own drop-off" on public.recycling_dropoffs;
create policy "Book your own drop-off"
  on public.recycling_dropoffs for insert to authenticated
  with check (
    contributor_id = auth.uid()
    and status = 'booked'
    and weighed_grams is null
    and credit_grams is null
    and decided_by is null
  );

drop policy "Leaders weigh in their organisation's drop-offs" on public.recycling_dropoffs;
create policy "Leaders weigh in their organisation's drop-offs"
  on public.recycling_dropoffs for update to authenticated
  using (public.is_org_leader(org_id) and status = 'booked')
  with check (public.is_org_leader(org_id));
