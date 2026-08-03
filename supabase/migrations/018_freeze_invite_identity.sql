-- supabase/migrations/018_freeze_invite_identity.sql
-- WHY: "Invitee can answer their invite" (012_tutorial_collaborators.sql)
--      only constrains invited_profile_id and status — nothing pins
--      tutorial_id. RLS's WITH CHECK can only see the NEW row, never OLD, so
--      it cannot express "this column must not change." A legitimate
--      invitee could therefore repoint their own invite's tutorial_id at
--      ANY tutorial in the system, flip status to 'accepted' in the same
--      UPDATE, then self-claim a tutorial_contributors seat there via the
--      matching invite-exists arm on that table's INSERT policy (012) —
--      reopening exactly the self-attach exploit 008 closed, through the
--      invite table instead of tutorial_contributors directly. Reproduced
--      end to end during the Task 19 whole-branch review.
-- HOW: Same pattern as tutorials_freeze_review_provenance (008) — a BEFORE
--      UPDATE trigger, SECURITY INVOKER with an empty search_path, that
--      rejects any change to the four identity columns nobody legitimate
--      ever needs to touch after the invite is created. The invitee's own
--      policy only ever changes status/responded_at; the primary's
--      reset-a-decline policy only ever changes status/responded_at too —
--      neither needs tutorial_id, invited_profile_id, invited_by, or
--      requested_at to move. The auth.uid() is null / is_admin() escape
--      matches 008's rationale: a null uid is necessarily a BYPASSRLS
--      server context (the admin client, or a migration), and an admin
--      legitimately may need to fix a bad row by hand.
create or replace function public.tutorial_collaborator_invites_freeze_identity()
returns trigger as $$
begin
  if (
       new.tutorial_id is distinct from old.tutorial_id
       or new.invited_profile_id is distinct from old.invited_profile_id
       or new.invited_by is distinct from old.invited_by
       or new.requested_at is distinct from old.requested_at
     )
     and auth.uid() is not null
     and not public.is_admin()
  then
    raise exception 'tutorial_id, invited_profile_id, invited_by, and requested_at cannot be changed after an invite is created'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql security invoker set search_path = '';

create trigger tutorial_collaborator_invites_freeze_identity
  before update on public.tutorial_collaborator_invites
  for each row execute function public.tutorial_collaborator_invites_freeze_identity();
