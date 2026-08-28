-- 046_review_queue_notifications.sql
-- WHY: the two moments where work is handed to someone else for a decision
--      were both silent. An author asks an organisation to back a project
--      (tutorial_orgs row, status 'pending') and nothing tells that
--      organisation's leaders it is waiting; an author submits for review
--      (tutorials.status draft -> pending) and nothing tells the leaders who
--      accepted the backing, or an admin when nobody did. Both queues were
--      discoverable only by remembering to go and look at them.
--      backing_requested and tutorial_submitted close that.
--
-- HOW: recipients are resolved per event in the handler, exactly as every
--      other notification in this schema is (013's note: no trigger, no
--      queue). See packages/api/src/review-notifications.ts.
--
-- Subject: tutorial_id, so notifications_one_subject (039) is satisfied with
-- no new column. Neither type carries an org_id — the leader's link goes to
-- /dashboard/organisation, their own hub, which already lists what is waiting.
-- An exact /organizations/:id/projects/:tutorialId link would need that
-- column; deliberately not added until the extra click is felt.
--
-- The DO block below is the point of this file. 039 and 043 BOTH carry a note
-- warning that recreating notifications_type_check from a hand-copied list
-- silently deletes whatever it omits — 039 records a near-miss that would have
-- killed the five live toy_* types. Two warnings in a row is a process that
-- does not work, so this migration stops asking the author to be careful and
-- checks instead: it reads the live constraint and ABORTS if it carries any
-- value the recreation below would drop. Safe to run whatever has happened to
-- this constraint out of band, and safe to re-run.

do $$
declare
  def  text;
  lost text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint
   where conname = 'notifications_type_check'
     and conrelid = 'public.notifications'::regclass;

  if def is null then
    raise exception
      'notifications_type_check is absent — 013/027/039/043 have not all run here';
  end if;

  -- Every quoted lowercase literal in the live CHECK is one permitted type.
  -- Anything present there but absent from the recreation below would be
  -- destroyed by it.
  select string_agg(distinct m[1], ', ') into lost
    from regexp_matches(def, '''([a-z_]+)''', 'g') as m
   where m[1] not in (
     'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
     'collaborator_removed', 'collaborator_left',
     'tutorial_approved', 'tutorial_rejected',
     'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message',
     'idea_approved', 'idea_rejected',
     'challenge_joined', 'challenge_left', 'challenge_removed',
     'idea_graduated',
     'backing_requested', 'tutorial_submitted'
   );

  if lost is not null then
    raise exception
      'live notifications_type_check permits values this migration would drop: %. '
      'Add them to the list in 046 before running it.', lost;
  end if;
end $$;

alter table public.notifications drop constraint notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
    'collaborator_removed', 'collaborator_left',
    'tutorial_approved', 'tutorial_rejected',
    'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message',
    'idea_approved', 'idea_rejected',
    'challenge_joined', 'challenge_left', 'challenge_removed',
    'idea_graduated',
    -- new in 046
    'backing_requested', 'tutorial_submitted'
  ));
