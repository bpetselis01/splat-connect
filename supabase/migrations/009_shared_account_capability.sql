-- WHY: A parent and a contributor are the same kind of account now — either may
--      author, either may hold a child profile. is_approved_contributor()
--      required role = 'contributor', so a mobile-registered parent was refused
--      by Postgres on every authoring path regardless of what the UI offered.
-- HOW: The function keeps its name and signature, so the ~13 RLS policies
--      referencing it (tutorial insert, tutorial_contributors insert, storage
--      upload/update) inherit the new behaviour with no changes. This is the
--      same technique 005 used when it removed the approval gate, and it is why
--      that indirection was kept.
create or replace function public.is_approved_contributor()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid()
  );
$$ language sql security definer stable;
