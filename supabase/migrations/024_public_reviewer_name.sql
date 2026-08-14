-- supabase/migrations/024_public_reviewer_name.sql
-- WHY: same bug as 023_public_profile_names.sql, one more embed on the same
--      route: GET /api/public/tutorials/:id also joins reviewer:reviewed_by(name),
--      and that FK points at profiles too, so it silently comes back null for
--      an anonymous caller for the identical reason.
-- HOW: mirrors 023's shape — visible only once the tutorial is approved, so a
--      pending review never leaks who's looking at it.
create policy "Anyone can view the reviewer's name on an approved tutorial"
  on public.profiles for select
  using (
    exists (
      select 1 from public.tutorials
      where tutorials.reviewed_by = profiles.id and tutorials.status = 'approved'
    )
  );
