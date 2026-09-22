-- supabase/migrations/055_exchange_costs.sql
--
-- WHY: the Soft Pop dashboard draws a "Money you have agreed to" panel — a
--      total, a count of exchanges it spans, and a line per agreed cost with a
--      description, a counterparty, an amount and a settled flag. The whole
--      cost panel (brief feature 8) is the same data. Nothing backs any of it:
--      searched every column in all 23 public tables for cost/price/amount/
--      money/settle/paid/reimburse and there are none.
--
--      The brief's own list of easy-to-miss schema changes names this exactly —
--      "cost breakdown lines, receipts, settled flags — line items are rows,
--      not JSON blobs, unless the existing schema already says otherwise". It
--      does not say otherwise.
--
-- HOW:  one row per agreed cost, hung off the exchange it belongs to.
--
--      Money is integer cents. Never a float: 0.1 + 0.2 is not 0.3, and a
--      rounding error in a number two families have agreed between them is a
--      argument, not a display bug.
--
--      SPLAT never handles the money — the product says so on this very panel —
--      so there is no payment state machine here. `settled_at` records that
--      somebody said it was paid, and `settled_by` records which of them, which
--      is the most the platform can honestly claim to know.
--
--      Either party may settle a line, because either may be the one who was
--      paid. That is a product rule from the artboard's own copy: "you pay each
--      person directly, and either of you can mark it settled."
--
-- DOWN: drop table public.exchange_costs cascade;  -- takes its policies with it

create table public.exchange_costs (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.toy_transactions (id) on delete cascade,

  -- What the money is for, in the words the two of them used. Shown verbatim.
  description text not null check (length(btrim(description)) between 1 and 200),

  -- Integer cents, always positive. A refund is not a negative cost; it is the
  -- line being settled or deleted, and keeping it positive means the total can
  -- never be read as a credit the platform is offering.
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000),

  -- Who owes whom. Both must be parties to the transaction; the trigger below
  -- enforces that, because a foreign key cannot express it.
  payer_id uuid not null references public.profiles (id) on delete cascade,
  payee_id uuid not null references public.profiles (id) on delete cascade,
  constraint exchange_costs_distinct_parties check (payer_id <> payee_id),

  settled_at timestamptz,
  settled_by uuid references public.profiles (id) on delete set null,
  -- Both or neither: a settled line that cannot say who settled it is the state
  -- that makes a disagreement unresolvable.
  constraint exchange_costs_settled_together check (
    (settled_at is null and settled_by is null) or (settled_at is not null and settled_by is not null)
  ),

  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The panel's only read shape: every unsettled line for one person, newest
-- first, across all their exchanges. Partial, because settled lines are history
-- and the panel never asks for them.
create index exchange_costs_outstanding_idx
  on public.exchange_costs (payer_id, created_at desc)
  where settled_at is null;

create index exchange_costs_transaction_idx
  on public.exchange_costs (transaction_id);

-- A foreign key can say payer_id is a real profile. It cannot say payer_id is a
-- party to THIS exchange, which is the rule that actually matters: without it a
-- leader could write a cost line naming two strangers.
create or replace function public.exchange_costs_parties_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.toy_transactions t
    where t.id = new.transaction_id
      and new.payer_id in (t.requester_id, t.owner_id)
      and new.payee_id in (t.requester_id, t.owner_id)
  ) then
    raise exception 'payer and payee must both be parties to the exchange';
  end if;
  return new;
end;
$$;

create trigger exchange_costs_parties_match
  before insert or update on public.exchange_costs
  for each row execute function public.exchange_costs_parties_match();

alter table public.exchange_costs enable row level security;

-- Reads and writes are both gated on being a party to the exchange, which is
-- what is_toy_transaction_party already answers (and it counts the owning
-- organisation's leaders, which is right: a leader settles on the org's behalf).
create policy "Read costs on your own exchanges"
  on public.exchange_costs for select to authenticated
  using (public.is_toy_transaction_party(transaction_id));

create policy "Add a cost to your own exchange"
  on public.exchange_costs for insert to authenticated
  with check (
    public.is_toy_transaction_party(transaction_id)
    and created_by = auth.uid()
  );

-- Either party may update, because either may be the one who was paid and so
-- the one who knows it is settled.
create policy "Settle a cost on your own exchange"
  on public.exchange_costs for update to authenticated
  using (public.is_toy_transaction_party(transaction_id))
  with check (public.is_toy_transaction_party(transaction_id));

-- Only whoever added the line may remove it. Settling is the other party's
-- lever; deleting somebody else's record of what they are owed is not.
create policy "Remove a cost you added"
  on public.exchange_costs for delete to authenticated
  using (created_by = auth.uid());

comment on table public.exchange_costs is
  'Costs two parties agreed between themselves on an exchange. SPLAT records them and never handles the money.';
