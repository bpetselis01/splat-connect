-- 110 — named constraints on a challenge (challenge-constraints).
--
-- "What makes this harder than it looks", as rows: a label and an optional
-- note. They replace intended use / primary user on the Constraints tab; an
-- idea without any falls back to those two (103 left them nullable).
--
--   read    wherever the idea is readable — the subquery runs under the
--           reader's own toy_ideas RLS, so a pending idea's stay private.
--   insert  the idea's author, or a maker on it who has not been removed.
--   delete  whoever added it, or the author (no route uses it yet).
--
-- Author checks go through is_idea_author (108): authenticated cannot read
-- toy_ideas.author_id, so a policy sub-selecting it fails with 42501.
--
-- Anon reads every column but added_by: on an anonymous challenge the
-- author's id is the author's name one call away (108).
--
-- DOWN:
--   drop table if exists public.toy_idea_constraints;

create table public.toy_idea_constraints (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.toy_ideas (id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 80),
  note text check (note is null or length(note) <= 300),
  added_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index toy_idea_constraints_idea_idx on public.toy_idea_constraints (idea_id, created_at);

alter table public.toy_idea_constraints enable row level security;

create policy toy_idea_constraints_read on public.toy_idea_constraints for select to anon, authenticated
  using (exists (select 1 from public.toy_ideas i where i.id = idea_id));

create policy toy_idea_constraints_insert on public.toy_idea_constraints for insert to authenticated
  with check (
    added_by = auth.uid()
    and (
      public.is_idea_author(idea_id)
      or exists (
        select 1 from public.toy_idea_participants p
         where p.idea_id = toy_idea_constraints.idea_id and p.profile_id = auth.uid() and p.removed_at is null)
    )
  );

create policy toy_idea_constraints_delete on public.toy_idea_constraints for delete to authenticated
  using (added_by = auth.uid() or public.is_idea_author(idea_id));

create policy toy_idea_constraints_admin on public.toy_idea_constraints for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Supabase's default privileges hand anon and authenticated every privilege
-- on a new table, which would make the column grant below a no-op.
revoke all on public.toy_idea_constraints from anon, authenticated;
grant select (id, idea_id, label, note, created_at) on public.toy_idea_constraints to anon;
grant select, insert, delete on public.toy_idea_constraints to authenticated;
