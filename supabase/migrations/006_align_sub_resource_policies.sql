-- Migration 006: Align parts/tools/stl_files write policies with migration 005,
-- and add missing DELETE policies for the tutorials table.
--
-- Problem 1: parts, tools, and stl_files write policies still require
-- t.status IN ('draft', 'rejected'), but migration 005 removed that restriction
-- from the tutorials UPDATE policy. Contributors can now edit tutorial metadata
-- for any status but were still blocked from modifying parts/tools/stl_files on
-- pending or approved tutorials. These policies are brought into alignment.
--
-- Problem 2: No DELETE policy existed on tutorials, making the DELETE API
-- endpoint non-functional. Contributors can delete their own draft tutorials;
-- admins can delete any tutorial.

-- ============================================================
-- Parts
-- ============================================================

drop policy if exists "Contributors can write own tutorial parts" on public.parts;

create policy "Contributors can write own tutorial parts"
  on public.parts for all
  using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid()
    )
  );

-- ============================================================
-- Tools
-- ============================================================

drop policy if exists "Contributors can write own tutorial tools" on public.tools;

create policy "Contributors can write own tutorial tools"
  on public.tools for all
  using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid()
    )
  );

-- ============================================================
-- STL files
-- ============================================================

drop policy if exists "Contributors can write own tutorial stl_files" on public.stl_files;

create policy "Contributors can write own tutorial stl_files"
  on public.stl_files for all
  using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_id and tc.profile_id = auth.uid()
    )
  );

-- ============================================================
-- Tutorial DELETE policies
-- ============================================================

create policy "Contributors can delete own draft tutorials"
  on public.tutorials for delete
  using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = id and tc.profile_id = auth.uid()
    ) and status = 'draft'
  );

create policy "Admin can delete tutorials"
  on public.tutorials for delete
  using (public.is_admin());
