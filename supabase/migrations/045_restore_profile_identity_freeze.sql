-- supabase/migrations/045_restore_profile_identity_freeze.sql
--
-- WHY: A 2026-08-28 white-box pentest escalated a self-registered account to
--      role='admin' with a single PostgREST PATCH using the public anon key,
--      against the linked cloud project. The control that should have stopped
--      it — the profiles_freeze_identity trigger from 009 — did not exist on
--      that database, even though 009 is recorded as applied.
--
--      Root cause is NOT an unpushed migration. The ledger row for 009 carries
--      all three of its statements verbatim, so `supabase migration list` sees
--      no drift; but none of them ever ran. The signature is unambiguous:
--      is_approved_contributor() on the remote still had 009's *pre*-migration
--      body (`and role = 'contributor'`), the body 009 exists to remove. That
--      is what `supabase migration repair --status applied 009` does — it
--      writes the ledger row without executing the SQL. Ledger-based drift
--      detection is structurally blind to it, which is why CI stayed green.
--      scripts/check-schema-guards.sh now asserts the objects themselves.
--
--      Consequences carried by the remote until this migration, all three from
--      009 never having run:
--        1. no profiles_freeze_identity trigger  -> the escalation above;
--        2. no freeze_profile_identity() function;
--        3. is_approved_contributor() still requiring role='contributor', so a
--           parent or shared account is refused by Postgres on every authoring
--           path — the functional bug 009 was written to fix, still live.
--
-- HOW: Re-state 009's three objects idempotently (this migration is the repair,
--      so it must be safe on a database where 009 *did* run), then close the
--      escalation a second way that does not depend on any trigger existing.
--
-- The sibling freeze triggers were checked on the remote at the same time and
-- are all present, so they need no repair here: tutorial_orgs_freeze_identity
-- (007), tutorials_freeze_review_provenance (008), and
-- tutorial_collaborator_invites_freeze_identity (018).

-- 009 statement 1. Restated verbatim from 009; see that file for the rationale.
create or replace function public.is_approved_contributor()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid()
  );
$$ language sql security definer stable;

-- 009 statement 2. Restated verbatim from 009; see that file for the rationale.
create or replace function public.freeze_profile_identity()
returns trigger as $$
begin
  -- service_role and other non-JWT contexts: RLS does not apply to them either,
  -- and is_admin() reads auth.uid(), which they lack. Without this early return
  -- such a write raises 42501 while the caller reports success having changed
  -- nothing — the trap recorded at packages/api/src/routes/admin.ts:92-97.
  if auth.uid() is null then
    return new;
  end if;

  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'role cannot be changed by its owner';
  end if;

  if new.email is distinct from old.email and not public.is_admin() then
    raise exception 'email is mirrored from auth.users and cannot be set directly';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 009 statement 3. `drop if exists` first: CREATE TRIGGER has no OR REPLACE, and
-- this migration has to be a no-op on a database where 009 genuinely ran.
drop trigger if exists profiles_freeze_identity on public.profiles;
create trigger profiles_freeze_identity
  before update on public.profiles
  for each row execute function public.freeze_profile_identity();

-- Defence in depth: the escalation must stay closed even if the trigger above
-- is ever dropped again — which is exactly the failure this migration repairs.
--
-- The pentest report recommended `revoke update (role, email) ... from
-- authenticated`. That form is a no-op here, for the reason 028 documents
-- against SELECT: 004_data_api_grants.sql grants ALL at the TABLE level, and a
-- column-level REVOKE cannot subtract from a table-level GRANT. The whole
-- privilege has to come off the table.
--
-- The columns granted back are exactly PATCH /api/contributors/me's EDITABLE
-- allowlist (contributors.ts:31). role and email are absent from it and stay
-- absent here, so the escalation is now closed by the grant as well as by the
-- trigger — two independent controls, which is the point. id and created_at are
-- dropped on the way through: 004's table-level grant had them writable, and
-- nothing has ever legitimately set either from a client.
--
-- This is narrower than the app strictly needs — every profile UPDATE in the
-- app goes through the service-role client, which bypasses grants entirely
-- (contributors.ts:49-51 uses the admin client because 028 revoked the pickup_*
-- columns; the admin handlers at admin.ts:99-111 likewise). The grants below
-- exist for the direct-PostgREST surface that the browser's anon key can reach,
-- which is where the escalation happened.
--
-- Deliberate loss of capability: `authenticated` can no longer write `role` AT
-- ALL, and grants cannot distinguish an admin from anyone else — both are the
-- same Postgres role, which is why only the trigger could make that distinction
-- before. An admin changing another account's role therefore now requires the
-- service-role key. No application feature does this today (no route in
-- packages/api writes profiles.role), so nothing regresses; the trade is
-- deliberate, because a guard that a dropped trigger can reopen is the exact
-- failure this migration exists to repair.
--
-- As with 028's note about SELECT: profiles now uses column-level UPDATE grants,
-- so a future migration adding a client-editable profiles column must extend
-- the grant below or the column will be read-only from PostgREST.
revoke update on public.profiles from anon, authenticated;
grant update (name, pickup_line1, pickup_suburb, pickup_state, pickup_postcode, public_showcase)
  on public.profiles to authenticated;

-- The originating defect, still unfixed in 001: "User can update own profile" is
-- FOR UPDATE USING (auth.uid() = id) with no WITH CHECK, so Postgres reuses
-- USING as the check and it stays satisfied while role changes. USING screens
-- the row as it was; WITH CHECK screens the row as it will be. Without the
-- latter nothing stops an UPDATE from also repointing id to another account.
-- Postgres has no CREATE OR REPLACE POLICY, so drop and recreate.
drop policy if exists "User can update own profile" on public.profiles;
create policy "User can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
