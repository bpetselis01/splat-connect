-- Migration 005: Allow contributors to edit their own tutorials regardless of current status.
--
-- The previous USING clause restricted edits to rows where status IN ('draft', 'rejected'),
-- blocking contributors from editing pending or approved tutorials. The fix removes the
-- status restriction from USING (so any row the contributor owns can be touched) while
-- keeping it in WITH CHECK (so contributors can never leave a row in 'approved' status —
-- only admins can approve). The frontend handles the approved→pending transition by always
-- including status:'pending' in the PATCH body when editing an approved tutorial.

drop policy if exists "Contributors can update own draft or rejected tutorials" on public.tutorials;

create policy "Contributors can update own tutorials"
  on public.tutorials for update
  using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = id and tc.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = id and tc.profile_id = auth.uid()
    ) and status in ('draft', 'pending', 'rejected')
  );
