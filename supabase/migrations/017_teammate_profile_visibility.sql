-- supabase/migrations/017_teammate_profile_visibility.sql
-- WHY: a tutorial could only ever have one contributor before this feature,
--      so no other contributor could ever need to read your profile row and
--      "Anyone can view their own profile" (001_schema.sql) was the only
--      SELECT policy that ever mattered here. Now that a tutorial can have
--      collaborators, GET /api/tutorials/:id embeds
--      tutorial_contributors(*, profiles(*)) for the Collaborators section —
--      and for any viewer who isn't the row's own profile (every teammate
--      but yourself), that embed comes back null, which crashes
--      EditCollaboratorsSection reading c.profiles.name. Caught by the
--      Task 19 E2E journey as the collaborator's edit-page load 500ing.
-- HOW: one SELECT policy, symmetric with "Contributors can view their team"
--      (012_tutorial_collaborators.sql) but for profiles instead of
--      tutorial_contributors — a user can read another profile if the two
--      share a row in tutorial_contributors on any tutorial.
create policy "Contributors can view their teammates' profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.tutorial_contributors mine
      join public.tutorial_contributors theirs on theirs.tutorial_id = mine.tutorial_id
      where mine.profile_id = auth.uid() and theirs.profile_id = profiles.id
    )
  );
