-- 079 — the child profile the board draws: four questions about a switch, and
-- the room it is used in.
--
-- Byron chose the board's form over the regulatory pass's longer one
-- (2026-09-23). The board asks only what decides which switch a child can use:
--
--   working_hand     Which hand does most of the work?   left | right | either | not_sure
--   press_force      How much force can they apply?      very_light | light | moderate | full
--   aim              Can they aim at a target?           small | large | not_reliably
--   hold             How long can they hold a press?     moment | second | as_long
--   everyday_needs   "What matters in the room, rather than in the hand":
--                    quiet · no_flashing · wipeable · wheelchair_tray ·
--                    shared_siblings · travels_bag
--
-- Less is collected than before, which is the APP 3 direction as well as the
-- board's. The older columns (MACS, BFMF, grip, measurements…) are left in
-- place and simply no longer asked; dropping them is a separate decision with
-- its own backup.
--
-- DOWN:
--   alter table public.child_profiles drop column if exists everyday_needs,
--     drop column if exists hold, drop column if exists aim,
--     drop column if exists press_force, drop column if exists working_hand;

alter table public.child_profiles
  add column working_hand text check (working_hand in ('left', 'right', 'either', 'not_sure')),
  add column press_force text check (press_force in ('very_light', 'light', 'moderate', 'full')),
  add column aim text check (aim in ('small', 'large', 'not_reliably')),
  add column hold text check (hold in ('moment', 'second', 'as_long')),
  add column everyday_needs text[] not null default '{}'
    check (everyday_needs <@ array['quiet', 'no_flashing', 'wipeable', 'wheelchair_tray', 'shared_siblings', 'travels_bag']::text[]);
