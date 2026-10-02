-- 097 — how big each printed part is, so the pick list can hide a printer
-- whose bed cannot hold it.
--
-- Decided 2026-09-30: authors enter part dimensions per file; printers whose
-- bed does not fit are hidden, with no chip. Millimetres, the bounding box as
-- the author sliced it. All optional — a request hides nothing unless every
-- part it asks for has all three, and the printer still checks the fit before
-- they accept. Same 1–2000 bound as the bed (058).
--
-- DOWN:
--   alter table public.stl_files
--     drop column if exists size_z_mm,
--     drop column if exists size_y_mm,
--     drop column if exists size_x_mm;

alter table public.stl_files
  add column size_x_mm int check (size_x_mm between 1 and 2000),
  add column size_y_mm int check (size_y_mm between 1 and 2000),
  add column size_z_mm int check (size_z_mm between 1 and 2000);
