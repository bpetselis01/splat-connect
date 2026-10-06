-- 128 — who a guide, toy or child is for: four questions asked the same way
-- of all three (spec 2026-10-05-guide-tags-design).
--
-- 127's Movement/Hands/Fit and 079's working hand/aim/hold described arm and
-- hand ability only. They go; in their place, on tutorials, toys and
-- child_profiles alike (CHILD_QUESTIONS in @splat-connect/types):
--   helps_with   moving | seeing | hearing | communicating | learning | calm | daily
--   access       press | touch | grasp | head | foot | eyes | voice | watch
--   one_hand     "One hand is enough"
--   press_force  very_light | light | moderate | full  (child: one; item: every press it works with)
--   play/enjoys  127/120's six + build | pretend
-- Guides also say what they are: device_types (MMC's Device Type, widened).
-- 080's switch_target/force/hold are folded into press_force and access.
-- Recommended counts the answers an item shares with a child — no conversion.
--
-- No column grants on these tables: table defaults plus RLS, as before.
--
-- DOWN: not reversible without data loss (the dropped tags). Restore from
-- backup; re-running 080/120/127's column adds brings the shape back empty.

alter table public.tutorials
  drop column movement, drop column hands, drop column fit,
  drop column switch_target, drop column switch_force, drop column switch_hold,
  add column device_types text[] check (device_types <@ array['adapted_toy', 'switch', 'switch_interface', 'mounting', 'controller', 'communication', 'vision', 'hearing', 'sensory', 'learning', 'daily_living', 'tablet']),
  add column helps_with text[] check (helps_with <@ array['moving', 'seeing', 'hearing', 'communicating', 'learning', 'calm', 'daily']),
  add column access text[] check (access <@ array['press', 'touch', 'grasp', 'head', 'foot', 'eyes', 'voice', 'watch']),
  add column one_hand boolean,
  add column press_force text[] check (press_force <@ array['very_light', 'light', 'moderate', 'full']);

alter table public.toys
  drop column movement, drop column hands, drop column fit,
  add column helps_with text[] check (helps_with <@ array['moving', 'seeing', 'hearing', 'communicating', 'learning', 'calm', 'daily']),
  add column access text[] check (access <@ array['press', 'touch', 'grasp', 'head', 'foot', 'eyes', 'voice', 'watch']),
  add column one_hand boolean,
  add column press_force text[] check (press_force <@ array['very_light', 'light', 'moderate', 'full']);

drop function public.suits_fit_ok(jsonb);

-- play's 127 check is unnamed; find and replace it on both tables.
do $$
declare t text; c text;
begin
  foreach t in array array['tutorials', 'toys'] loop
    for c in select conname from pg_constraint
      where conrelid = ('public.' || t)::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%play%'
    loop
      execute format('alter table public.%I drop constraint %I', t, c);
    end loop;
    execute format($f$alter table public.%I add constraint %I check (play <@ array['light', 'sound', 'move', 'soft', 'calm', 'water', 'build', 'pretend'])$f$, t, t || '_play_values');
  end loop;
  for c in select conname from pg_constraint
    where conrelid = 'public.child_profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%enjoys%'
  loop
    execute format('alter table public.child_profiles drop constraint %I', c);
  end loop;
end $$;

alter table public.child_profiles
  drop column working_hand, drop column aim, drop column hold,
  add constraint child_profiles_enjoys_values check (enjoys <@ array['light', 'sound', 'move', 'soft', 'calm', 'water', 'build', 'pretend']::text[]),
  add column helps_with text[] not null default '{}'
    check (helps_with <@ array['moving', 'seeing', 'hearing', 'communicating', 'learning', 'calm', 'daily']::text[]),
  add column access text[] not null default '{}'
    check (access <@ array['press', 'touch', 'grasp', 'head', 'foot', 'eyes', 'voice', 'watch']::text[]),
  add column one_hand boolean not null default false;
