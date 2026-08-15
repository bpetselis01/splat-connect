-- supabase/migrations/026_toy_transactions.sql
-- WHY: the peer-to-peer donation/exchange flow needs a row that survives the
--      whole negotiation (request -> accept/reject -> confirm) plus a thread
--      the two parties can talk in. There is deliberately no ordinary INSERT
--      or UPDATE policy on toy_transactions: every write is validated by
--      routes/toy-transactions.ts (who may request, who may accept, whether a
--      code matches) rather than by RLS, so the API is the sole write gate and
--      RLS does only what it's good at here — "which rows can this user see"
--      for the two GET endpoints. toy_transaction_messages is the one
--      exception: its INSERT policy lets a party post directly through the
--      user client, since a chat message needs no server-side business logic
--      beyond "is this still an open transaction between us two".
create table public.toy_transactions (
  id uuid primary key default gen_random_uuid(),
  toy_id uuid not null references public.toys(id) on delete cascade,
  offered_toy_id uuid references public.toys(id) on delete cascade,
  type text not null check (type in ('donation', 'exchange')),
  status text not null default 'requested' check (status in ('requested', 'accepted', 'rejected', 'withdrawn', 'completed')),
  requester_id uuid not null references public.profiles(id),
  owner_id uuid not null references public.profiles(id),
  owner_code text,
  requester_code text,
  owner_confirmed_at timestamptz,
  requester_confirmed_at timestamptz,
  pickup_line1 text,
  pickup_suburb text,
  pickup_state text,
  pickup_postcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.toy_transactions enable row level security;

create policy "Parties can view their own toy transactions"
  on public.toy_transactions for select
  using (requester_id = auth.uid() or owner_id = auth.uid());

create policy "Admin full access to toy transactions"
  on public.toy_transactions for all using (public.is_admin());

create table public.toy_transaction_messages (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.toy_transactions(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  kind text not null default 'user' check (kind in ('system', 'user')),
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.toy_transaction_messages enable row level security;

create policy "Parties can view messages on their toy transactions"
  on public.toy_transaction_messages for select
  using (
    exists (
      select 1 from public.toy_transactions
      where toy_transactions.id = toy_transaction_messages.transaction_id
        and (toy_transactions.requester_id = auth.uid() or toy_transactions.owner_id = auth.uid())
    )
  );

create policy "Parties can message while a toy transaction is open"
  on public.toy_transaction_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.toy_transactions
      where toy_transactions.id = toy_transaction_messages.transaction_id
        and (toy_transactions.requester_id = auth.uid() or toy_transactions.owner_id = auth.uid())
        and toy_transactions.status in ('requested', 'accepted')
    )
  );

create policy "Admin full access to toy transaction messages"
  on public.toy_transaction_messages for all using (public.is_admin());

-- A transaction party needs to see the OTHER party's toy and name even when
-- that toy isn't published (an offered exchange toy) or no other
-- public-visibility policy reaches it (023/024 are each scoped to a
-- different fact) — mirrors the narrow, purpose-scoped shape of
-- 023_public_profile_names.sql.
create policy "Transaction parties can view each other's toy"
  on public.toys for select
  using (
    exists (
      select 1 from public.toy_transactions
      where (toy_transactions.toy_id = toys.id or toy_transactions.offered_toy_id = toys.id)
        and (toy_transactions.owner_id = auth.uid() or toy_transactions.requester_id = auth.uid())
    )
  );

create policy "Transaction parties can view each other's name"
  on public.profiles for select
  using (
    exists (
      select 1 from public.toy_transactions
      where (toy_transactions.owner_id = profiles.id or toy_transactions.requester_id = profiles.id)
        and (toy_transactions.owner_id = auth.uid() or toy_transactions.requester_id = auth.uid())
    )
  );
