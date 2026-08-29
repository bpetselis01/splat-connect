-- supabase/migrations/047_invitee_profile_visibility.sql
-- WHY: the Collaborators panel could not show an invite until the invitee
--      answered it, because it only ever rendered tutorial_contributors and an
--      invite writes to tutorial_collaborator_invites alone. Embedding the
--      invites in GET /api/tutorials/:id fixes what is fetched, but the
--      profiles embed on those rows comes back null and crashes the panel on
--      i.profiles.name — the same failure 017_teammate_profile_visibility.sql
--      documents for tutorial_contributors, and for the same reason: 017's
--      policy admits a profile only when the reader and that profile SHARE a
--      tutorial_contributors row, and an invitee has no such row until they
--      accept. So the one person who needs to see the invite — the primary
--      contributor who sent it — is exactly the one who cannot read the name.
-- HOW: one SELECT policy, symmetric with 017 but keyed on the invite instead
--      of the seat. is_primary_contributor() (012) already scopes this to the
--      tutorial's primary and is security definer, so it does not recurse
--      through this policy.
-- NOTE on exposure: RLS is row-level, so this makes the whole invitee profile
--      row visible to the primary — but 028_pickup_column_grants.sql revoked
--      the table-level grant, leaving authenticated with only
--      id/name/email/role/created_at. The one field there that is not already
--      public is email, and the primary contributor typed that email to create
--      the invite in the first place. No new fact is disclosed.
create policy "Primary contributor can view an invitee's profile"
  on public.profiles for select
  using (
    exists (
      select 1 from public.tutorial_collaborator_invites i
      where i.invited_profile_id = profiles.id
        and public.is_primary_contributor(i.tutorial_id)
    )
  );
