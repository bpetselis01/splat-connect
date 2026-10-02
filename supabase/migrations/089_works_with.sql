-- 089 — the guide detail rail's two cards and the help card's note
-- (guide-works-with): the toy you start with, what it works with, and a note
-- for someone who would rather not build it. All optional.
--
-- DOWN:
--   alter table public.tutorials drop column if exists no_build_note,
--     drop column if exists works_with, drop column if exists toy_brand,
--     drop column if exists toy_name;

alter table public.tutorials
  add column toy_name text check (toy_name is null or length(toy_name) <= 80),
  add column toy_brand text check (toy_brand is null or length(toy_brand) <= 80),
  add column works_with text check (works_with is null or length(works_with) <= 300),
  add column no_build_note text check (no_build_note is null or length(no_build_note) <= 300);
