-- supabase/migrations/023_public_profile_names.sql
-- WHY: public.ts's GET /api/public/tutorials/:id and GET /api/public/toys(/:id)
--      moved from the RLS-bypassing admin client to the anon client for
--      defense-in-depth (2026-08-14 toy-library-design spec). "Anyone can
--      view their own profile" (001_schema.sql) is the only SELECT policy an
--      anonymous caller (auth.uid() IS NULL) ever matches, so every
--      profiles(name) / tutorial_contributors(role, profiles(name)) embed on
--      those routes now comes back null: a logged-out visitor could no
--      longer see who made a tutorial or who holds a toy.
-- HOW: two SELECT policies scoped to exactly the public-facing fact each
--      route needs — the owner of a published toy, and a contributor of an
--      approved tutorial — mirroring the status filter each route already
--      applies in code, so a draft/pending row's owner stays hidden. Each
--      route's own select() already narrows the embed to the `name` column,
--      so no other profile field is exposed by widening row visibility here.
create policy "Anyone can view the owner name of a published toy"
  on public.profiles for select
  using (
    exists (
      select 1 from public.toys
      where toys.owner_id = profiles.id and toys.status = 'published'
    )
  );

create policy "Anyone can view a contributor's name on an approved tutorial"
  on public.profiles for select
  using (
    exists (
      select 1 from public.tutorial_contributors
      join public.tutorials on tutorials.id = tutorial_contributors.tutorial_id
      where tutorial_contributors.profile_id = profiles.id
        and tutorials.status = 'approved'
    )
  );
