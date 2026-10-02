-- 090 — the author's own safety notes (editor-safety-notes, decided
-- 2026-09-30): a title and a detail each, alongside SAFETY_CHECKLIST.
-- Replaced whole on save, like parts and tools (sub-resource.ts), and read
-- the way 080's steps are: anyone on an approved guide, contributors their
-- own, admins all.
--
-- DOWN:
--   drop table if exists public.tutorial_safety_notes;

create table public.tutorial_safety_notes (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null references public.tutorials (id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  title text not null check (length(btrim(title)) between 1 and 80),
  detail text check (detail is null or length(detail) <= 500),
  created_at timestamptz not null default now()
);
create index tutorial_safety_notes_tutorial_idx on public.tutorial_safety_notes (tutorial_id, position);

alter table public.tutorial_safety_notes enable row level security;

create policy tutorial_safety_notes_read_approved on public.tutorial_safety_notes for select
  using (exists (select 1 from public.tutorials t where t.id = tutorial_id and t.status = 'approved'));
create policy tutorial_safety_notes_contributors on public.tutorial_safety_notes for all to authenticated
  using (public.is_tutorial_contributor(tutorial_id))
  with check (public.is_tutorial_contributor(tutorial_id));
create policy tutorial_safety_notes_admin on public.tutorial_safety_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
