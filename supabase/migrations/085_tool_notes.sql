-- 085 — why each tool is on the list, and how to get one (tool-notes,
-- decided 2026-09-30: a note, and buy once / borrow / substitute; no tool cost).
--
-- Both on tools, not tutorials: the list is replaced whole on every save
-- (sub-resource.ts), so neither is under PATCH's updated_at check.
--
-- DOWN:
--   alter table public.tools drop column if exists get_by, drop column if exists note;

alter table public.tools
  add column note text check (note is null or length(note) <= 200),
  add column get_by text check (get_by in ('buy', 'borrow', 'substitute'));
