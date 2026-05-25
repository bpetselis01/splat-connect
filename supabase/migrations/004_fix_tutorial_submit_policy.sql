-- Migration 004: Fix contributors being unable to submit tutorials for review.
--
-- The update policy had no WITH CHECK clause, so Postgres reused the USING
-- expression for both the old and new row. Changing status to 'pending' on
-- submit set the new row's status to 'pending', which failed the implicit
-- WITH CHECK of status in ('draft', 'rejected').
--
-- Fix: add an explicit WITH CHECK that permits the 'pending' transition.

drop policy if exists "Contributors can update own draft or rejected tutorials" on public.tutorials;

create policy "Contributors can update own draft or rejected tutorials"
  on public.tutorials for update
  using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = id and tc.profile_id = auth.uid()
    ) and status in ('draft', 'rejected')
  )
  with check (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = id and tc.profile_id = auth.uid()
    ) and status in ('draft', 'rejected', 'pending')
  );
