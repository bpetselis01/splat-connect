-- ============================================================
-- Remove the parent role
-- ============================================================
-- WHY: parent and contributor have been the same kind of account since
--      migration 009 widened is_approved_contributor() to any signed-in
--      account, and handle_new_user() has defaulted every signup to
--      'contributor' since migration 010 (it dropped the role column from
--      its insert entirely — see that migration's own header). The only
--      place role='parent' still meant anything was mobile's Profile tab,
--      which branched its UI on it; that branch is being removed alongside
--      this migration (packages/mobile/app/(tabs)/profile/index.tsx).
-- HOW: backfill first, so the constraint tightening below has nothing left
--      to reject; a check constraint always outlives whatever wrote the data
--      that once satisfied a wider version of it.
update public.profiles set role = 'contributor' where role = 'parent';

alter table public.profiles
  drop constraint profiles_role_check,
  add constraint profiles_role_check
    check (role in ('admin', 'contributor'));
