-- 127 — who a guide or toy suits: the board's child questions, on the items.
--
-- The library filter page (spec 2026-10-05-library-redesign) filters by the
-- same four questions the child profile asks (/onboarding/child):
--   movement  press | lever | grasp | proximity   (the switch it takes)
--   hands     both | one | left | right
--   play      light | sound | move | soft | calm | water   (ENJOYS, 120)
--   fit       { palm_width_mm?: [min,max], reach_cm?: [min,max], tray_mm?: [min,max] }
--             in CHILD_MEASURES' ranges (120)
-- All optional: an untagged item simply matches no filter on that question.
-- The value lists live in @splat-connect/types; these checks are the backstop.
--
-- DOWN:
--   alter table public.tutorials drop column if exists movement, drop column if exists hands, drop column if exists play, drop column if exists fit;
--   alter table public.toys drop column if exists movement, drop column if exists hands, drop column if exists play, drop column if exists fit;
--   drop function if exists public.suits_fit_ok(jsonb);

create function public.suits_fit_ok(f jsonb) returns boolean
language sql immutable set search_path = ''
as $$
  select f is null or (
    jsonb_typeof(f) = 'object'
    and not exists (select 1 from jsonb_object_keys(f) k where k not in ('palm_width_mm', 'reach_cm', 'tray_mm'))
    and not exists (
      select 1 from jsonb_each(f) e
      where jsonb_typeof(e.value) <> 'array' or jsonb_array_length(e.value) <> 2
        or jsonb_typeof(e.value -> 0) <> 'number' or jsonb_typeof(e.value -> 1) <> 'number'
        or (e.value ->> 0)::numeric > (e.value ->> 1)::numeric
    )
  )
$$;

alter table public.tutorials
  add column movement text[] check (movement <@ array['press', 'lever', 'grasp', 'proximity']),
  add column hands text[] check (hands <@ array['both', 'one', 'left', 'right']),
  add column play text[] check (play <@ array['light', 'sound', 'move', 'soft', 'calm', 'water']),
  add column fit jsonb check (public.suits_fit_ok(fit));

alter table public.toys
  add column movement text[] check (movement <@ array['press', 'lever', 'grasp', 'proximity']),
  add column hands text[] check (hands <@ array['both', 'one', 'left', 'right']),
  add column play text[] check (play <@ array['light', 'sound', 'move', 'soft', 'calm', 'water']),
  add column fit jsonb check (public.suits_fit_ok(fit));
