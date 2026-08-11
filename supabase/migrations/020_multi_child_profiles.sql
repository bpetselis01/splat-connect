-- ============================================================
-- Multiple child profiles per parent
-- ============================================================

-- 1. 003 used a unique constraint rather than a primary key precisely so this
--    would be a one-line change. The RLS policies key on parent_id = auth.uid(),
--    not on row count, so they already permit several rows per parent.
alter table public.child_profiles
  drop constraint child_profiles_parent_id_key;

-- 2. Optional by product decision: a parent may add a child without naming one.
--    The UI falls back to "Child N" by position, so this never identifies a row
--    on its own and must not be made not-null.
alter table public.child_profiles
  add column name text;

-- 3. Needed for a stable list order and for the "Child N" fallback label.
--    Existing rows take now(): wrong in principle, harmless in practice, since
--    an account with one child has nothing to order.
alter table public.child_profiles
  add column created_at timestamptz not null default now();

-- 4. 003 created select/insert/update policies but no delete policy, so a parent
--    could never remove a child profile. The list page needs this.
create policy "Parent can delete own child profile"
  on public.child_profiles for delete using (parent_id = auth.uid());
