-- 075 — the facts a toy listing shows, and the guide it was built from.
--
-- The board's toy page draws four facts under the holder's notes — "Ages it
-- suits 2–6", "Batteries 2 × AA, included", "Switch fitting 3.5 mm mono
-- socket", "Volume Loud, half-taped" — and a "Built from Guide C" card. None of
-- them had a column. They are the holder's own words, so short free text rather
-- than vocabularies: a battery line is whatever is in the box.
--
--   toys.age_min / age_max   0–18, either end open, as 071 does for guides
--   toys.batteries           ≤60
--   toys.switch_fitting      ≤60
--   toys.volume              ≤40
--   toys.tutorial_id         the guide it was adapted with. SET NULL, not
--                            RESTRICT: a guide being taken down must not be
--                            blocked by somebody's listing that mentions it.
--
-- DOWN:
--   alter table public.toys drop constraint if exists toys_age_range;
--   alter table public.toys drop column if exists tutorial_id, drop column if exists volume,
--     drop column if exists switch_fitting, drop column if exists batteries,
--     drop column if exists age_max, drop column if exists age_min;

alter table public.toys
  add column age_min smallint check (age_min is null or age_min between 0 and 18),
  add column age_max smallint check (age_max is null or age_max between 0 and 18),
  add column batteries text check (batteries is null or length(btrim(batteries)) between 1 and 60),
  add column switch_fitting text check (switch_fitting is null or length(btrim(switch_fitting)) between 1 and 60),
  add column volume text check (volume is null or length(btrim(volume)) between 1 and 40),
  add column tutorial_id uuid references public.tutorials (id) on delete set null;

alter table public.toys
  add constraint toys_age_range check (age_min is null or age_max is null or age_max >= age_min);
