-- supabase/migrations/048_tutorial_kind.sql
-- WHY: every tutorial walked the same steps, STL included, with nothing in the
--      data saying whether it was a switch-adapted toy (which never needs an
--      STL) or an assistive-tech build (whose whole point is the printed
--      part). Contributors filled the wrong step, and print requests had no
--      way to find the printable ones. A second pipeline was proposed and
--      rejected: the two differ by exactly one step, so a discriminator says
--      it and everything else stays shared.
-- HOW: kind on tutorials, defaulted to toy_adaptation because every existing
--      row is one (their STL rows were purged 2026-08-29, so the default is
--      true rather than merely convenient). Recommendations are a positioned
--      join table: position 1..3 plus unique (tutorial, position) IS the
--      3-cap, the way toys_one_owner (033) is a rule rather than a trigger.
--      RLS mirrors parts (001) policy for policy. The public read admits a row
--      when the OWNING tutorial is approved; whether the TARGET is approved is
--      the API's concern, because the contributor has to be able to read
--      their own unapproved targets to see which are hidden.
alter table public.tutorials
  add column kind text not null default 'toy_adaptation'
    check (kind in ('toy_adaptation', 'assistive_tech'));

create table public.tutorial_recommendations (
  tutorial_id    uuid not null references public.tutorials on delete cascade,
  recommended_id uuid not null references public.tutorials on delete cascade,
  position       smallint not null check (position between 1 and 3),
  primary key (tutorial_id, recommended_id),
  unique (tutorial_id, position),
  check (tutorial_id <> recommended_id)
);

alter table public.tutorial_recommendations enable row level security;

create policy "Anyone can read recommendations of approved tutorials"
  on public.tutorial_recommendations for select using (
    exists (select 1 from public.tutorials t where t.id = tutorial_id and t.status = 'approved')
  );

create policy "Contributors can read own tutorial recommendations"
  on public.tutorial_recommendations for select using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_recommendations.tutorial_id and tc.profile_id = auth.uid()
    )
  );

create policy "Contributors can write own tutorial recommendations"
  on public.tutorial_recommendations for all
  using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_recommendations.tutorial_id and tc.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_recommendations.tutorial_id and tc.profile_id = auth.uid()
    )
  );

create policy "Admin full access to tutorial_recommendations"
  on public.tutorial_recommendations for all using (public.is_admin());
