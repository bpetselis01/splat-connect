-- 088 — a guide's print settings (print-settings): what the author sliced at,
-- shown on the guide, the print request and the printer's incoming job.
-- Per-file time and grams stay on stl_files (068); these are the guide's own.
--
-- DOWN:
--   alter table public.tutorials drop column if exists print_minutes,
--     drop column if exists material, drop column if exists infill_percent,
--     drop column if exists layer_height_mm;

alter table public.tutorials
  add column layer_height_mm numeric(3,2) check (layer_height_mm between 0.05 and 1.00),
  add column infill_percent int check (infill_percent between 0 and 100),
  add column material text check (material is null or length(material) <= 40),
  add column print_minutes int check (print_minutes between 1 and 6000);
