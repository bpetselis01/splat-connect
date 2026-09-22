-- 071 — the age range a guide is written for.
--
-- The artboard's review page reads "Sam Mitchell · Easy · Age 3–7 · 20 minutes
-- · Northside Therapy Collective"; the live meta line had every fact but the
-- age. It is the author's word on which children the adaptation suits — a
-- switch-adapted rattle and a switch-adapted games console are both "easy",
-- and this is what tells them apart.
--
--   tutorials.age_min  youngest, in whole years
--   tutorials.age_max  oldest, in whole years
--
-- Both nullable: it is a description, not a gate, and a draft starts with
-- neither. Bounded 0–18 because the program builds for children, and the
-- constraint carries the ordering so a save that swaps them is refused here
-- rather than trusted to every client that writes the row.
--
-- DOWN:
--   alter table public.tutorials drop column if exists age_min, drop column if exists age_max;

alter table public.tutorials
  add column age_min smallint check (age_min between 0 and 18),
  add column age_max smallint check (age_max between 0 and 18),
  add constraint tutorials_age_range check (age_max >= age_min);
