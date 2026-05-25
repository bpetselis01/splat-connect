-- Migration 003: Fix infinite RLS recursion between tutorials and tutorial_contributors.
--
-- The cycle:
--   tutorials SELECT policy → queries tutorial_contributors
--   tutorial_contributors SELECT policy → queries tutorials → infinite loop
--
-- Fix: replace the tutorial_contributors policy that queries tutorials with a
-- security definer helper, which bypasses RLS and breaks the cycle.

create or replace function public.tutorial_is_approved(t_id uuid)
returns boolean as $$
  select exists (select 1 from public.tutorials where id = t_id and status = 'approved')
$$ language sql security definer stable;

drop policy if exists "Anyone can view contributors of approved tutorials" on public.tutorial_contributors;

create policy "Anyone can view contributors of approved tutorials"
  on public.tutorial_contributors for select using (
    public.tutorial_is_approved(tutorial_id)
  );
