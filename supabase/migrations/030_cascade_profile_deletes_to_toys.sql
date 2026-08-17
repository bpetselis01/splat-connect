-- supabase/migrations/030_cascade_profile_deletes_to_toys.sql
-- WHY: deleting an account 500s for anyone who has ever owned a toy or been a
--      party to a transaction. Every profile-referencing FK in the schema
--      declares a delete action — cascade (child_profiles, notifications,
--      org_leaders, tutorial_contributors, user_agreements, invites) or set
--      null (organizations.created_by, tutorials.reviewed_by) — except the
--      four added by 021_toys.sql and 026_toy_transactions.sql, which were
--      written with a bare `references public.profiles(id)` and so default to
--      NO ACTION. `auth.admin.deleteUser` then fails with
--      `toys_owner_id_fkey` / `toy_transactions_requester_id_fkey` violations,
--      leaving the auth user, its profile and its rows behind. The E2E suites
--      delete their fixtures this way, so their cleanup silently failed and
--      the leftovers accumulated until GoTrue's churn against the local DB
--      exhausted ephemeral ports and unrelated specs began failing on
--      "Database error checking email".
-- HOW: re-point the four FKs at `on delete cascade`, matching the convention
--      every other profile FK already follows. All four columns are NOT NULL,
--      so set null is not available. toy_transactions and its messages already
--      cascade from toys and from the transaction respectively, so removing an
--      owner tears down the whole subtree in one step.
alter table public.toys
  drop constraint toys_owner_id_fkey,
  add constraint toys_owner_id_fkey
    foreign key (owner_id) references public.profiles(id) on delete cascade;

alter table public.toy_transactions
  drop constraint toy_transactions_requester_id_fkey,
  add constraint toy_transactions_requester_id_fkey
    foreign key (requester_id) references public.profiles(id) on delete cascade,
  drop constraint toy_transactions_owner_id_fkey,
  add constraint toy_transactions_owner_id_fkey
    foreign key (owner_id) references public.profiles(id) on delete cascade;

alter table public.toy_transaction_messages
  drop constraint toy_transaction_messages_sender_id_fkey,
  add constraint toy_transaction_messages_sender_id_fkey
    foreign key (sender_id) references public.profiles(id) on delete cascade;
