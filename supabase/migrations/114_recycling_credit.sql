-- 114 — spending recycling credit on a print job (recycling-credit-spending).
--
-- Decided 2026-09-30: credit is grams, never money; it is spent only at the
-- organisation that issued it, and only when that organisation's printer
-- accepts the job. A balance is never stored: it is what that organisation
-- credited (059's credit_grams on received drop-offs) minus what was spent
-- there, computed by recycling_credit_balance().
--
-- The spend is written inside accept_toy_transaction(), in the same call that
-- takes the job, after re-reading the balance under a lock on (requester,
-- organisation). Two leaders accepting two jobs at the same moment therefore
-- cannot both spend the last 50 g. Short means the job is accepted without
-- credit; the API says so in the thread. transaction_id is unique, so a
-- double accept writes one spend.
--
-- print_credit_grams is set at request time only on the rows (one per printer,
-- 074) whose printer belongs to the issuing organisation. Any other printer
-- accepting finds null and spends nothing. After the accept it is the grams
-- actually spent; a short balance clears it.
--
-- accept_toy_transaction() below is 057's body (the latest definition when
-- 114 was written), unchanged, with the three pieces marked 114.
--
-- DOWN:
--   -- re-run 057's accept_toy_transaction definition
--   alter table public.toy_transactions drop constraint if exists toy_transactions_print_credit;
--   alter table public.toy_transactions drop column if exists print_credit_grams;
--   drop function if exists public.recycling_credit_balance(uuid, uuid);
--   drop table if exists public.recycling_credit_spends;

create table public.recycling_credit_spends (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  transaction_id uuid not null unique references public.toy_transactions (id) on delete cascade,
  grams integer not null check (grams > 0 and grams <= 1000000),
  created_at timestamptz not null default now()
);

create index recycling_credit_spends_owner_idx on public.recycling_credit_spends (profile_id, org_id);

alter table public.recycling_credit_spends enable row level security;

-- Own read, no client writes: only accept_toy_transaction() inserts.
create policy "Read your own credit spends"
  on public.recycling_credit_spends for select to authenticated
  using (profile_id = auth.uid());

revoke all on public.recycling_credit_spends from anon, authenticated;
grant select on public.recycling_credit_spends to authenticated;

create function public.recycling_credit_balance(p_profile uuid, p_org uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((
      select sum(d.credit_grams) from public.recycling_dropoffs d
      where d.contributor_id = p_profile and d.org_id = p_org and d.status = 'received'
    ), 0)
    - coalesce((
      select sum(s.grams) from public.recycling_credit_spends s
      where s.profile_id = p_profile and s.org_id = p_org
    ), 0)
  )::integer
$$;

-- Any profile id is a parameter, so a client calling it could read anyone's balance.
revoke all on function public.recycling_credit_balance(uuid, uuid) from public, anon, authenticated;
grant execute on function public.recycling_credit_balance(uuid, uuid) to service_role;

alter table public.toy_transactions add column print_credit_grams integer;

alter table public.toy_transactions
  add constraint toy_transactions_print_credit check (
    print_credit_grams is null
    or (print_credit_grams between 1 and 1000000 and type = 'print' and owner_org_id is not null)
  );

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
  v_credit text; -- 114
begin
  select * into v_tx from public.toy_transactions where id = p_transaction_id;
  if not found then
    return jsonb_build_object('outcome', 'missing');
  end if;
  if v_tx.status <> 'requested' then
    return jsonb_build_object('outcome', 'closed');
  end if;

  if v_tx.toy_id is not null then
    -- The lock. Everything below reads a stock figure nobody else can move
    -- until this transaction commits.
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

  -- 114: the credit, spent in this same call. The lock serialises every spend
  -- by this requester at this organisation, so the balance read below cannot
  -- be spent twice by two accepts racing.
  if v_updated.print_credit_grams is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(v_updated.requester_id::text || ':' || v_updated.owner_org_id::text, 114)
    );
    if public.recycling_credit_balance(v_updated.requester_id, v_updated.owner_org_id) >= v_updated.print_credit_grams then
      insert into public.recycling_credit_spends (profile_id, org_id, transaction_id, grams)
      values (v_updated.requester_id, v_updated.owner_org_id, v_updated.id, v_updated.print_credit_grams)
      on conflict (transaction_id) do nothing;
      v_credit := 'spent';
    else
      update public.toy_transactions set print_credit_grams = null
      where id = v_updated.id
      returning * into v_updated;
      v_credit := 'short';
    end if;
  end if;

  return jsonb_build_object('outcome', 'accepted', 'transaction', to_jsonb(v_updated), 'credit', v_credit); -- 114: credit
end;
$$ language plpgsql security invoker set search_path = '';
