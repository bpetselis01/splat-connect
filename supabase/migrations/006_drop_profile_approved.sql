-- WHY: profiles.approved has been unused since 005_remove_account_approval.sql
--      (no RLS policy or app code reads it) and its lingering FALSE default was
--      confusing new signups into thinking they were unapproved. Drop it.
-- NOTE: Unrelated to tutorial approval (tutorials.status, tutorial_is_approved()),
--      which is untouched.
alter table public.profiles drop column approved;
