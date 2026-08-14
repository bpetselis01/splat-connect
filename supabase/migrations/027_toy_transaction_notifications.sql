-- supabase/migrations/027_toy_transaction_notifications.sql
-- WHY: notifications was built tutorial-only (tutorial_id NOT NULL, a fixed
--      type list). A toy request/accept/reject/withdraw/message needs the
--      same inbox row shape, pointed at a toy_transactions row instead.
alter table public.notifications
  alter column tutorial_id drop not null;

alter table public.notifications
  add column toy_transaction_id uuid references public.toy_transactions(id) on delete cascade,
  add column toy_name text;

alter table public.notifications
  drop constraint notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
      'collaborator_removed', 'collaborator_left',
      'tutorial_approved', 'tutorial_rejected',
      'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message'
    )
  );
