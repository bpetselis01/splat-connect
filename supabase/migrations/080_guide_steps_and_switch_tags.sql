-- 080 — a guide's steps, and what its switch asks of a child.
--
-- Steps. Both boards treat a guide as numbered steps — the mobile editor has a
-- Steps section, and the admin review pane checks "every step has at least one
-- photo". Until now the instructions lived only in the PDF. Byron chose steps
-- alongside the PDF (2026-09-23): the PDF stays the printable download, and a
-- guide with no steps keeps working exactly as before.
--
--   tutorial_steps   position 1–60, a short title, the body, an optional photo
--                    (public URL in toy-photos, like the guide's own photos).
--                    Same access as parts (001): anyone reads an approved
--                    guide's, contributors read and write their own, admins all.
--
-- Switch tags. The board's "Suits Ollie — big button, light press, short hold"
-- needs the guide to say what its switch asks for, in the child profile's own
-- words (079), so the two can be compared without translation:
--
--   tutorials.switch_target   large | small            ("big button")
--   tutorials.switch_force    very_light | light | moderate | full
--   tutorials.switch_hold     moment | second | as_long
--
-- All optional. A guide suits a child when every tag it has is within what the
-- child's profile says they can do; untagged says nothing either way. That is
-- a suggestion about a toy, never an assessment of the child.
--
-- DOWN:
--   alter table public.tutorials drop column if exists switch_hold,
--     drop column if exists switch_force, drop column if exists switch_target;
--   drop table if exists public.tutorial_steps;

create table public.tutorial_steps (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null references public.tutorials (id) on delete cascade,
  position smallint not null check (position between 1 and 60),
  title text check (title is null or length(btrim(title)) between 1 and 120),
  body text not null check (length(btrim(body)) between 1 and 2000),
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tutorial_steps_tutorial_idx on public.tutorial_steps (tutorial_id, position);

alter table public.tutorial_steps enable row level security;

create policy tutorial_steps_read_approved on public.tutorial_steps for select
  using (exists (select 1 from public.tutorials t where t.id = tutorial_id and t.status = 'approved'));
create policy tutorial_steps_contributors on public.tutorial_steps for all to authenticated
  using (public.is_tutorial_contributor(tutorial_id))
  with check (public.is_tutorial_contributor(tutorial_id));
create policy tutorial_steps_admin on public.tutorial_steps for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.tutorials
  add column switch_target text check (switch_target in ('large', 'small')),
  add column switch_force text check (switch_force in ('very_light', 'light', 'moderate', 'full')),
  add column switch_hold text check (switch_hold in ('moment', 'second', 'as_long'));
