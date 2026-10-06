-- 129 — three things the guide boards draw that had nowhere to live
-- (board gap audit, 2026-10-06):
--
--   tutorial_steps.tip       a short tip or caution under one step ("Wear
--                            safety glasses when cutting leads"); build mode
--                            shows it on that step's screen
--   tutorial_steps.minutes   roughly how long the step takes, 1–600
--   tutorial_recommendations.required
--                            "Required first": make that guide before this one
--   tutorials.done_note      the author's closing line, shown when every step
--                            is done ("Plug it into the bubble machine and…")
--
-- All optional; existing rows read as no tip, no minutes, not required, no line.
-- Same RLS as their tables; no column grants (table defaults).
--
-- DOWN:
--   alter table public.tutorials drop column if exists done_note;
--   alter table public.tutorial_recommendations drop column if exists required;
--   alter table public.tutorial_steps drop column if exists minutes, drop column if exists tip;

alter table public.tutorial_steps
  add column tip text check (tip is null or length(btrim(tip)) between 1 and 300),
  add column minutes smallint check (minutes between 1 and 600);

alter table public.tutorial_recommendations
  add column required boolean not null default false;

alter table public.tutorials
  add column done_note text check (done_note is null or length(btrim(done_note)) between 1 and 300);
