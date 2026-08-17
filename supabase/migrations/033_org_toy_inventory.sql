-- supabase/migrations/033_org_toy_inventory.sql
-- WHY: an organisation holds stock — five identical bears — and gives it away
--      from a fixed address. Nothing on the platform could say that: toys.owner_id
--      references profiles, so only a person can own a toy; one row meant one
--      object, so five bears meant five near-identical library cards; and the
--      pickup address was typed in by the owner at accept time, so an org's fixed
--      location would be re-entered by hand on every handoff.
-- HOW: ownership becomes an XOR — exactly one of owner_id / owner_org_id — and
--      authority follows whichever is set, reusing is_org_leader() from 007
--      unchanged. Stock is a quantity column rather than a row per unit, chosen
--      to keep the public library from filling with duplicates; the cost is paid
--      in the confirm handler, which stops being an ownership transfer for orgs.
--      See docs/superpowers/specs/2026-08-18-org-toy-inventory-design.md
--
--      An organisation only ever GIVES. There is no path here for an org to
--      request a toy from a family, and that is the boundary of this migration.

-- ============================================================
-- Tables
-- ============================================================

-- toys_person_single_unit is what makes the branch in the confirm handler total.
-- A person's toy is structurally incapable of holding quantity 2, so
-- "individual -> transfer the row, org -> decrement and clone" can never meet a
-- case it was not written for. quantity also stays off the EDITABLE whitelist in
-- routes/toys.ts for the individual path, making that two independent locks.
--
-- Every existing row already satisfies both constraints (owner_id set,
-- owner_org_id null, quantity defaulting to 1), so nothing backfills and there is
-- no window in which the constraints fail.
alter table public.toys
  alter column owner_id drop not null,
  add column owner_org_id uuid references public.organizations on delete cascade,
  add column quantity integer not null default 1 check (quantity >= 0),
  add constraint toys_one_owner check (num_nonnulls(owner_id, owner_org_id) = 1),
  add constraint toys_person_single_unit
    check (owner_org_id is not null or quantity = 1);

-- Partial index: every capacity check counts accepted handoffs for one toy, and
-- the accept path does it while holding a row lock, so it is the one query worth
-- not making a sequential scan.
create index toy_transactions_accepted_by_toy
  on public.toy_transactions (toy_id) where status = 'accepted';

-- The fixed pickup point. An org's location does not vary per family, which is
-- the whole difference from the peer-to-peer flow: profiles.pickup_* is a default
-- the owner may override at accept time, and these are not overridable at all.
alter table public.organizations
  add column pickup_line1 text,
  add column pickup_suburb text,
  add column pickup_state text,
  add column pickup_postcode text,
  add column pickup_instructions text;

-- Carried onto the transaction at accept alongside the address, for the reason
-- 028 gives for the address itself: the counterparty reads their copy on the
-- transaction row, which has its own correctly scoped policy, rather than
-- reading it off the source table.
alter table public.toy_transactions
  add column pickup_instructions text;

alter table public.toy_transactions
  alter column owner_id drop not null,
  add column owner_org_id uuid references public.organizations on delete cascade,
  add constraint toy_transactions_one_owner
    check (num_nonnulls(owner_id, owner_org_id) = 1);

-- ============================================================
-- Grants — the same hazard 028 fixed for profiles
-- ============================================================
-- WHY: "Anyone can read organizations" (007) is `using (true)` and matches anon.
--      RLS is row-level only, so once that policy admits a row every column on it
--      is readable by anyone via a direct PostgREST call — including
--      pickup_instructions, which is exactly where a leader would write "side gate,
--      code 4417". 004 grants at the TABLE level and a column-level REVOKE cannot
--      subtract from a table grant, so the only fix is to revoke and grant back
--      the columns that are genuinely public.
-- HOW: an organisation's name, description and status are public by design — they
--      render as a trust badge on tutorials. The pickup columns are not. Leaders
--      read them through GET /api/organizations/:id/pickup, which uses the
--      service-role client and so bypasses grants entirely, and a requester reads
--      the copy on their own transaction row after acceptance.
-- NOTE: organizations now uses column-level grants, not the table-level default
-- from 004. A future migration adding an organizations column will NOT expose it
-- to anon/authenticated automatically — extend the list below.
revoke select on public.organizations from anon, authenticated;
grant select (id, name, description, status, created_by, created_at, updated_at)
  on public.organizations to anon, authenticated;

-- ============================================================
-- toys — authority
-- ============================================================
-- Every policy that asked "is this your toy?" now asks "is this your toy, OR do
-- you lead the org that owns it?". is_org_leader(null) is false rather than null
-- (it is an EXISTS), so the org arm is inert on a person's toy and these stay
-- exactly as strict as before for the peer-to-peer case.
--
-- Because leadership is evaluated live on every request, removing a leader or
-- suspending an org revokes access instantly — no cleanup job, no cached
-- capability. Same property 007 relies on for tutorial review.

drop policy "Anyone can read published toys, or their own draft" on public.toys;
create policy "Anyone can read published toys, or their own draft"
  on public.toys for select
  using (
    status = 'published'
    or owner_id = auth.uid()
    or public.is_org_leader(owner_org_id)
  );

drop policy "Owner can insert own toy" on public.toys;
create policy "Owner can insert own toy"
  on public.toys for insert
  with check (owner_id = auth.uid() or public.is_org_leader(owner_org_id));

drop policy "Owner can update own toy" on public.toys;
create policy "Owner can update own toy"
  on public.toys for update
  using (owner_id = auth.uid() or public.is_org_leader(owner_org_id));

drop policy "Owner can delete own toy" on public.toys;
create policy "Owner can delete own toy"
  on public.toys for delete
  using (owner_id = auth.uid() or public.is_org_leader(owner_org_id));

-- ============================================================
-- Storage — the same widening, in a different migration's policies
-- ============================================================
-- 022 resolves a photo path's toy id against toys.owner_id. An org toy has no
-- owner_id, so as written a leader cannot upload a cover photo — and a toy
-- cannot be published without one. Easy to miss precisely because it lives
-- nowhere near the toy policies it mirrors.

drop policy if exists "Owner can upload own toy photos" on storage.objects;
create policy "Owner can upload own toy photos"
  on storage.objects for insert
  with check (
    bucket_id = 'toy-photos-library'
    and exists (
      select 1 from public.toys
      where (toys.id)::text = (string_to_array(storage.objects.name, '/'))[1]
        and (toys.owner_id = auth.uid() or public.is_org_leader(toys.owner_org_id))
    )
  );

drop policy if exists "Owner can update own toy photos" on storage.objects;
create policy "Owner can update own toy photos"
  on storage.objects for update
  using (
    bucket_id = 'toy-photos-library'
    and exists (
      select 1 from public.toys
      where (toys.id)::text = (string_to_array(storage.objects.name, '/'))[1]
        and (toys.owner_id = auth.uid() or public.is_org_leader(toys.owner_org_id))
    )
  );

drop policy if exists "Owner can delete own toy photos" on storage.objects;
create policy "Owner can delete own toy photos"
  on storage.objects for delete
  using (
    bucket_id = 'toy-photos-library'
    and exists (
      select 1 from public.toys
      where (toys.id)::text = (string_to_array(storage.objects.name, '/'))[1]
        and (toys.owner_id = auth.uid() or public.is_org_leader(toys.owner_org_id))
    )
  );

-- ============================================================
-- toy_transactions — visibility
-- ============================================================
-- Security definer for the reason every helper in 007 is: a policy querying
-- another table is silently subject to that table's own policies, which would
-- make "are you a party to this" depend on visibility rather than on fact.
create or replace function public.is_toy_transaction_party(p_transaction_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.toy_transactions t
    where t.id = p_transaction_id
      and (
        t.requester_id = auth.uid()
        or t.owner_id = auth.uid()
        or public.is_org_leader(t.owner_org_id)
      )
  );
$$ language sql security definer stable;

drop policy "Parties can view their own toy transactions" on public.toy_transactions;
create policy "Parties can view their own toy transactions"
  on public.toy_transactions for select
  using (
    requester_id = auth.uid()
    or owner_id = auth.uid()
    or public.is_org_leader(owner_org_id)
  );

drop policy "Parties can view messages on their toy transactions" on public.toy_transaction_messages;
create policy "Parties can view messages on their toy transactions"
  on public.toy_transaction_messages for select
  using (public.is_toy_transaction_party(transaction_id));

drop policy "Parties can message while a toy transaction is open" on public.toy_transaction_messages;
create policy "Parties can message while a toy transaction is open"
  on public.toy_transaction_messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_toy_transaction_party(transaction_id)
    and exists (
      select 1 from public.toy_transactions t
      where t.id = transaction_id and t.status in ('requested', 'accepted')
    )
  );

-- The cross-visibility policies from 026: a leader running a handoff needs the
-- requester's toy and name for the same reason the owner does.
drop policy "Transaction parties can view each other's toy" on public.toys;
create policy "Transaction parties can view each other's toy"
  on public.toys for select
  using (
    exists (
      select 1 from public.toy_transactions t
      where (t.toy_id = toys.id or t.offered_toy_id = toys.id)
        and (
          t.owner_id = auth.uid()
          or t.requester_id = auth.uid()
          or public.is_org_leader(t.owner_org_id)
        )
    )
  );

drop policy "Transaction parties can view each other's name" on public.profiles;
create policy "Transaction parties can view each other's name"
  on public.profiles for select
  using (
    exists (
      select 1 from public.toy_transactions t
      where (t.owner_id = profiles.id or t.requester_id = profiles.id)
        and (
          t.owner_id = auth.uid()
          or t.requester_id = auth.uid()
          or public.is_org_leader(t.owner_org_id)
        )
    )
  );

-- ============================================================
-- accept — the atomic take
-- ============================================================
-- WHY: the capacity check is read-then-write. Two leaders pressing Accept in the
--      same moment both read "4 of 5 taken", both pass, and the org commits six
--      bears it does not have. This could not happen before organisations: a
--      single owner cannot race themselves, and one accepted handoff was the
--      hard ceiling.
-- HOW: `for update` on the toy row serialises the count. It cannot be done
--      through the query builder — the Supabase JS client cannot span statements
--      in a transaction — and it cannot be a constraint, because no index encodes
--      "the count of related rows must not exceed a column".
--
-- The individual path goes through here too. A quantity=1 toy is the degenerate
-- case, and one accept path is worth more than the lock it takes on a row nobody
-- is contending.
--
-- The org's pickup details are read HERE rather than passed in, so "a leader
-- cannot vary the address" is enforced at the same place that takes the unit:
-- neither can be bypassed without the other.
--
-- SECURITY INVOKER: the only caller is the accept handler on the service-role
-- client, which bypasses RLS anyway, so definer would widen this for no gain.
-- `set search_path = ''` is what makes invoker safe here — every name below is
-- schema-qualified, so no caller-controlled search_path can shadow one.
create or replace function public.accept_toy_transaction(
  p_transaction_id uuid,
  p_owner_code text,
  p_requester_code text,
  p_pickup_line1 text default null,
  p_pickup_suburb text default null,
  p_pickup_state text default null,
  p_pickup_postcode text default null
) returns jsonb as $$
declare
  v_tx public.toy_transactions;
  v_quantity integer;
  v_accepted integer;
  v_line1 text;
  v_suburb text;
  v_state text;
  v_postcode text;
  v_instructions text;
  v_updated public.toy_transactions;
begin
  select * into v_tx from public.toy_transactions where id = p_transaction_id;
  if not found then
    return jsonb_build_object('outcome', 'missing');
  end if;
  if v_tx.status <> 'requested' then
    return jsonb_build_object('outcome', 'closed');
  end if;

  -- The lock. Everything below reads a stock figure nobody else can move until
  -- this transaction commits.
  select t.quantity into v_quantity
  from public.toys t where t.id = v_tx.toy_id
  for update;
  if not found then
    return jsonb_build_object('outcome', 'missing');
  end if;

  select count(*) into v_accepted
  from public.toy_transactions t
  where t.toy_id = v_tx.toy_id and t.status = 'accepted';

  if v_accepted >= v_quantity then
    return jsonb_build_object('outcome', 'full');
  end if;

  if v_tx.owner_org_id is not null then
    select o.pickup_line1, o.pickup_suburb, o.pickup_state, o.pickup_postcode, o.pickup_instructions
      into v_line1, v_suburb, v_state, v_postcode, v_instructions
    from public.organizations o where o.id = v_tx.owner_org_id;

    -- A half-filled address is not a place to meet, and an org that has not set
    -- one cannot hand anything over. Reported distinctly so the leader is told
    -- what to fix rather than shown a constraint violation.
    if v_line1 is null or v_suburb is null or v_state is null or v_postcode is null then
      return jsonb_build_object('outcome', 'no_org_pickup');
    end if;
  else
    v_line1 := p_pickup_line1;
    v_suburb := p_pickup_suburb;
    v_state := p_pickup_state;
    v_postcode := p_pickup_postcode;
  end if;

  update public.toy_transactions
  set status = 'accepted',
      owner_code = p_owner_code,
      requester_code = p_requester_code,
      pickup_line1 = v_line1,
      pickup_suburb = v_suburb,
      pickup_state = v_state,
      pickup_postcode = v_postcode,
      pickup_instructions = v_instructions,
      updated_at = now()
  where id = p_transaction_id and status = 'requested'
  returning * into v_updated;

  if not found then
    return jsonb_build_object('outcome', 'closed');
  end if;

  return jsonb_build_object('outcome', 'accepted', 'transaction', to_jsonb(v_updated));
end;
$$ language plpgsql security invoker set search_path = '';
