-- 068 — per-file print settings, so a print request can say what it costs.
--
-- The board's request form sums "3 h 10 min printing" and "41 g PETG filament"
-- over the ticked parts, and the printer's queue card repeats them as chips:
-- "Every part carries its own settings, exactly as the author tested them, and
-- they travel with the request." Until now an STL row was a filename and a
-- storage path, so the tiles had nothing to add up.
--
--   stl_files.print_minutes   time on the bed for one copy, as the author sliced it.
--   stl_files.filament_grams  filament for one copy.
--   stl_files.material        what the author printed it in. The four the
--                             printers directory already lists (058).
--
-- All three nullable: every existing row predates them, and a guide is not
-- refused for leaving them blank — a printer reads "—" and asks in the thread.
-- The ranges are sanity bounds, not slicer limits: a day on the bed and five
-- kilograms are past anything a toy part needs, and a typo past them is what
-- the check is for.
--
-- DOWN:
--   alter table public.stl_files
--     drop column if exists material,
--     drop column if exists filament_grams,
--     drop column if exists print_minutes;

alter table public.stl_files
  add column print_minutes  int  check (print_minutes between 1 and 1440),
  add column filament_grams int  check (filament_grams between 1 and 5000),
  add column material       text check (material in ('PLA', 'PETG', 'TPU', 'ABS'));
