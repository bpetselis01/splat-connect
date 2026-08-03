-- supabase/migrations/019_decline_invite_on_removal.sql
-- WHY: the tutorial_contributors INSERT policy's invite-exists arm (012)
--      admits a claim whenever a matching invite's status != 'declined' —
--      which includes 'accepted', permanently. Nothing ever revoked an
--      accepted invite, so a removed (or self-left) collaborator could
--      simply re-insert themselves as a fresh tutorial_contributors row at
--      any time afterward, using the exact same still-accepted invite —
--      undoing the primary's removal decision unilaterally. Spec decision
--      #3 ("only the primary manages the team") didn't hold. Found during
--      the Task 19 whole-branch review.
-- HOW: whenever a collaborator's tutorial_contributors row is deleted (by
--      the primary removing them, or by the collaborator leaving — both are
--      just a DELETE on this table, per 012's single DELETE policy), decline
--      their invite too. This reuses the existing decline state rather than
--      inventing a new one: the invite-exists INSERT arm already treats
--      'declined' as non-claimable, and the primary's existing "reset a
--      declined invite" UPDATE policy already lets them re-invite the same
--      person later if they choose to. SECURITY DEFINER because the acting
--      user (the primary, removing someone else) has no RLS grant to answer
--      a stranger's invite under their own JWT — this is a system-maintained
--      consequence of an already-authorized delete, not a new user-facing
--      write path.
create or replace function public.tutorial_collaborator_invites_decline_on_removal()
returns trigger as $$
begin
  update public.tutorial_collaborator_invites
  set status = 'declined', responded_at = now()
  where tutorial_id = old.tutorial_id
    and invited_profile_id = old.profile_id
    and status = 'accepted';
  return old;
end;
$$ language plpgsql security definer set search_path = '';

create trigger tutorial_contributors_decline_invite_on_removal
  after delete on public.tutorial_contributors
  for each row execute function public.tutorial_collaborator_invites_decline_on_removal();
