-- 120 — the child wizard's Play and Measurements steps (wizard-steps).
--
-- Decided 2026-09-30: add the board's "What does your child enjoy?" as a
-- display-only answer (it does not feed matching), and Measurements as an
-- optional step kept on the child profile. Byron 2026-10-02: data capture only,
-- for a future recommendation system — nothing sorts or matches on these yet.
--
--   enjoys        light · sound · move · soft · calm · water (MB's six)
--   palm_width_mm existing since 003; 079 stopped accepting it (APP 3). The
--                 registry decision makes it writable again, so it gains the
--                 range the API checks. NOT VALID: rows written before 079
--                 are not re-checked here — new writes are.
--   reach_cm      "Reach from seated (cm)", new
--   tray_mm       "Tray thickness (mm)", new
--
-- Grants: child_profiles has never carried column grants — it holds the
-- table-level defaults and RLS is the boundary (parent_id = auth.uid(), or
-- is_admin()). There is no anon policy, so anon reads no row, and the only
-- reader is the owner's GET /api/child-profiles. New columns fall under the
-- same rule; play-measurements.test.ts pins that anon and another parent see
-- none of them.
--
-- DOWN:
--   alter table public.child_profiles drop constraint if exists child_profiles_palm_width_range;
--   alter table public.child_profiles drop column if exists tray_mm,
--     drop column if exists reach_cm, drop column if exists enjoys;

alter table public.child_profiles
  add column enjoys text[] not null default '{}'
    check (enjoys <@ array['light', 'sound', 'move', 'soft', 'calm', 'water']::text[]),
  add column reach_cm numeric check (reach_cm between 5 and 150),
  add column tray_mm numeric check (tray_mm between 1 and 100);

alter table public.child_profiles
  add constraint child_profiles_palm_width_range check (palm_width_mm between 20 and 250) not valid;
