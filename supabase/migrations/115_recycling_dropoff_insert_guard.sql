-- 115 — a drop-off is booked by its contributor and decided by a leader, never
-- both by the same write (recycling-build final review).
--
-- 059's insert policy checked only contributor_id = auth.uid(). With 004's
-- table grants a member could POST straight to PostgREST a row already
-- 'received' with credit_grams of their choosing, and since 114 that row counts
-- in recycling_credit_balance(). The insert now has to be a booking: status
-- 'booked' and every column the leader sets at the door still null.
--
-- DOWN:
--   drop policy if exists "Book your own drop-off" on public.recycling_dropoffs;
--   create policy "Book your own drop-off"
--     on public.recycling_dropoffs for insert to authenticated
--     with check (contributor_id = auth.uid());

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
