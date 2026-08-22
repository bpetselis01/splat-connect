-- 039_notifications_idea_subject.sql
-- WHY: notifications.tutorial_id was `not null`, so nothing that is not a
--      tutorial could raise a notification. Design challenges need to.
-- The check keeps the row honest: exactly one subject, never both, never neither.
-- Every existing writer keeps working unchanged.
--
-- NOTE: tutorial_id was already made nullable by 027_toy_transaction_notifications.sql
--       (this line is a harmless no-op, kept for clarity/idempotency).
-- NOTE: the type check dropped/recreated here must preserve every value 027 added
--       (toy_request/toy_accepted/toy_rejected/toy_withdrawn/toy_message are live —
--       packages/api/src/routes/toy-transactions.ts still writes them) in addition
--       to the original tutorial/collaborator values, or that writer breaks.
-- NOTE: 027 also gave notifications a third subject column, toy_transaction_id,
--       for exactly that writer (tutorial_id and idea_id both null on those rows).
--       "One subject, never none" has to count all three or every toy_request/
--       toy_accepted/toy_rejected/toy_withdrawn/toy_message insert (which sets
--       only toy_transaction_id) starts failing this constraint immediately.

alter table public.notifications alter column tutorial_id drop not null;

alter table public.notifications
  add column idea_id uuid references public.toy_ideas on delete cascade;

alter table public.notifications
  add constraint notifications_one_subject
  check (num_nonnulls(tutorial_id, idea_id, toy_transaction_id) = 1);

alter table public.notifications drop constraint notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
    'collaborator_removed', 'collaborator_left',
    'tutorial_approved', 'tutorial_rejected',
    'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message',
    'idea_approved', 'idea_rejected',
    'challenge_joined', 'challenge_left', 'challenge_removed'
  ));
