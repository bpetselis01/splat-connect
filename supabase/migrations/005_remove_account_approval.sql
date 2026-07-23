-- WHY: Contributors previously needed admin approval (profiles.approved) before
--      they could create tutorials or upload files. That gate is removed —
--      any signed-up contributor can act immediately. Tutorial content
--      moderation (tutorials.status, tutorial_is_approved()) is unaffected.
-- HOW: is_approved_contributor() keeps its name/signature so the ~13 RLS
--      policies referencing it (tutorial insert, tutorial_contributors insert,
--      storage upload/update policies) inherit the new behavior with no
--      changes. The `approved` column is left in place, unused.
create or replace function public.is_approved_contributor()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'contributor'
  );
$$ language sql security definer stable;
