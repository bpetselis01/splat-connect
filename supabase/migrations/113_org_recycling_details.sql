-- 113 — what each recycler takes (org-recycling-details).
--
-- 059 stored only polymers and a free-text note; the board draws machines,
-- forms, a per-drop minimum and maximum, turnaround, what the contributor gets
-- back, hours and the door. All public by design — they are what a
-- contributor reads before packing a box — so they join 059's anon grant.
-- The chip lists are presentational and live in packages/types (037's rule
-- about contact_prefs); the database bounds only their size.
--
-- The minimum may only raise the platform floor (MIN_DROPOFF_GRAMS, 2 kg):
-- "You can ask for more, never less."
--
-- DOWN:
--   alter table public.organizations
--     drop constraint if exists organizations_recycling_max_over_min,
--     drop column if exists recycling_door, drop column if exists recycling_hours,
--     drop column if exists recycling_gives, drop column if exists recycling_turnaround,
--     drop column if exists recycling_max_kg, drop column if exists recycling_min_kg,
--     drop column if exists recycling_forms, drop column if exists recycling_machines;

alter table public.organizations
  add column recycling_machines text[] not null default '{}'
    check (cardinality(recycling_machines) <= 10),
  add column recycling_forms text[] not null default '{}'
    check (cardinality(recycling_forms) <= 10),
  add column recycling_min_kg numeric(5,1)
    check (recycling_min_kg is null or recycling_min_kg between 2 and 1000),
  add column recycling_max_kg numeric(5,1)
    check (recycling_max_kg is null or recycling_max_kg between 2 and 1000),
  add column recycling_turnaround text
    check (recycling_turnaround is null or length(btrim(recycling_turnaround)) <= 60),
  add column recycling_gives text not null default 'credit'
    check (recycling_gives in ('credit', 'spool', 'either')),
  add column recycling_hours text
    check (recycling_hours is null or length(btrim(recycling_hours)) <= 80),
  add column recycling_door text
    check (recycling_door is null or length(btrim(recycling_door)) <= 120),
  add constraint organizations_recycling_max_over_min
    check (recycling_max_kg is null or recycling_max_kg >= coalesce(recycling_min_kg, 2));

grant select (
  recycling_machines, recycling_forms, recycling_min_kg, recycling_max_kg,
  recycling_turnaround, recycling_gives, recycling_hours, recycling_door
) on public.organizations to anon, authenticated;
