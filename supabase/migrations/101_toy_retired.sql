-- 101 — Retired: an organisation's toy that is broken or worn out.
--
-- Decided 2026-09-30 (registry: inventory-states): no lending — toys are given,
-- exchanged, built or printed — so there is no Out or Needs clean. Retired is
-- the one state left: the toy leaves the public library and the request flow,
-- and stays on the leader's shelf with the reason until they remove it.
--
--   toys.retired_at    when it was retired. Org toys only.
--   toys.retired_note  why, in the leader's words: "Broken 12 Aug". ≤ 80.
--
-- The public read is the select policy, so every public surface (library,
-- detail, org profile, impact counts, auto picks) drops a retired toy at once.
-- The holder's own arms (owner_id, is_org_leader) still see it.
--
-- Remove (DELETE /api/toys/:id) refuses a toy any toy_transactions row names:
-- 026's on delete cascade would take its handovers with it. That is an API
-- rule, not a schema one — no object here.
--
-- DOWN:
--   drop policy "Anyone can read published toys, or their own draft" on public.toys;
--   create policy "Anyone can read published toys, or their own draft"
--     on public.toys for select
--     using (status = 'published' or owner_id = auth.uid() or public.is_org_leader(owner_org_id));
--   alter table public.toys drop constraint if exists toys_retired_org_only;
--   alter table public.toys drop column if exists retired_note;
--   alter table public.toys drop column if exists retired_at;

alter table public.toys
  add column retired_at timestamptz,
  add column retired_note text
    check (retired_note is null or length(btrim(retired_note)) between 1 and 80),
  add constraint toys_retired_org_only check (retired_at is null or owner_org_id is not null);

drop policy "Anyone can read published toys, or their own draft" on public.toys;
create policy "Anyone can read published toys, or their own draft"
  on public.toys for select
  using (
    (status = 'published' and retired_at is null)
    or owner_id = auth.uid()
    or public.is_org_leader(owner_org_id)
  );
