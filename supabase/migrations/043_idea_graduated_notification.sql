-- 043_idea_graduated_notification.sql
-- WHY: graduating a design challenge creates a draft tutorial and silently
--      makes the idea's author its primary contributor. Nobody is told --
--      the author's only way to discover it is noticing a new draft appear
--      under their tutorials. Adding idea_graduated lets the API tell them.
--
-- NOTE: the value list below was read straight off the live constraint
--       (pg_get_constraintdef on notifications_type_check), not copied from
--       any migration file, after 039's own note about a near-miss here:
--       an earlier recreation of this same constraint used an incomplete
--       list and would have deleted the five toy_* types that
--       packages/api/src/routes/toy-transactions.ts writes every day.
--       All seventeen existing values are carried forward unchanged.

alter table public.notifications drop constraint notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
    'collaborator_removed', 'collaborator_left',
    'tutorial_approved', 'tutorial_rejected',
    'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message',
    'idea_approved', 'idea_rejected',
    'challenge_joined', 'challenge_left', 'challenge_removed',
    'idea_graduated'
  ));
