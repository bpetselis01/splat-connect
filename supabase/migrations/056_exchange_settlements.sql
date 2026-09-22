-- supabase/migrations/056_exchange_settlements.sql
--
-- WHY: 055 was written from the dashboard's money summary — descriptions and
--      amounts. The full cost panel on the exchange detail screen carries four
--      things it does not model: a per-line "claiming back" vs "covering it"
--      flag, an attributed note, a receipt, and how the money changed hands.
--
--      The flag is the one that changes meaning rather than decoration. A line
--      somebody is covering still appears, at $0.00 to the other party, because
--      the whole point is that they are NOT asking for it. Without it the panel
--      cannot tell "you owe nothing" from "nobody has said what this costs".
--
-- HOW:  the flag is a column on exchange_costs, because it is a property of the
--       line. The other three are per exchange, so they are a settlements row
--       rather than three money columns on toy_transactions — that table
--       otherwise knows nothing about money, and a receipt needs somewhere of
--       its own to hang.
--
-- DOWN: drop table public.exchange_settlements cascade;
--       alter table public.exchange_costs drop column claiming;
--       (and restore the amount_cents > 0 check below)

-- ---------------------------------------------------------------- per line --

-- Whether the person who paid is asking for it back. Default true: every line
-- 055 already holds was entered as something owed, and that is also the common
-- case — somebody who is covering a cost is doing something deliberate.
alter table public.exchange_costs
  add column claiming boolean not null default true;

comment on column public.exchange_costs.claiming is
  'True: the payer owes this. False: the payee is absorbing it, and it shows as $0.00 to the payer while still being listed.';

-- A covered line may legitimately be zero — somebody recording that they
-- absorbed the postage need not price it — so the positive check becomes
-- non-negative. Claimed lines still have to be worth something.
alter table public.exchange_costs
  drop constraint exchange_costs_amount_cents_check;

alter table public.exchange_costs
  add constraint exchange_costs_amount_cents_check
  check (
    amount_cents >= 0
    and amount_cents <= 100000000
    and (not claiming or amount_cents > 0)
  );

-- ------------------------------------------------------------ per exchange --

create table public.exchange_settlements (
  -- One row per exchange, so the transaction id IS the key. There is no second
  -- settlement on the same exchange to disambiguate.
  transaction_id uuid primary key references public.toy_transactions (id) on delete cascade,

  -- Shown as a quote with a byline, which is why the author is stored: the
  -- panel reads "<org>'s note", and an unattributed note in a conversation
  -- between two parties is worse than none.
  note text check (note is null or length(btrim(note)) between 1 and 1000),
  note_by uuid references public.profiles (id) on delete set null,
  constraint exchange_settlements_note_attributed check (
    (note is null and note_by is null) or (note is not null and note_by is not null)
  ),

  -- A storage path, not a URL. 049 established that for tutorial files and the
  -- bucket below is private, so a URL would be a signed one that expires and
  -- has no business being persisted.
  receipt_path text,

  -- Free text rather than an enum. The artboard shows exactly one value, "Bank
  -- transfer", and inventing the other members of a vocabulary from one example
  -- is the kind of guess the brief asks not to make. Narrow it to a check
  -- constraint once the real list is known.
  method text check (method is null or length(btrim(method)) between 1 and 60),

  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles (id) on delete cascade
);

alter table public.exchange_settlements enable row level security;

create policy "Read the settlement on your own exchange"
  on public.exchange_settlements for select to authenticated
  using (public.is_toy_transaction_party(transaction_id));

create policy "Record a settlement on your own exchange"
  on public.exchange_settlements for insert to authenticated
  with check (public.is_toy_transaction_party(transaction_id) and updated_by = auth.uid());

create policy "Update the settlement on your own exchange"
  on public.exchange_settlements for update to authenticated
  using (public.is_toy_transaction_party(transaction_id))
  with check (public.is_toy_transaction_party(transaction_id) and updated_by = auth.uid());

-- ---------------------------------------------------------------- receipts --

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exchange-receipts', 'exchange-receipts', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do nothing;

-- Deliberately tighter than 049's file policies, which let ANY signed-in
-- account read a tutorial PDF. That is right for a tutorial: it is shared work.
-- A receipt is frequently a photograph of somebody's bank statement, and the
-- only people who have any business reading it are the two on the exchange.
--
-- The path is <transaction_id>/<file>, so the first folder segment is the id to
-- check. A file uploaded outside that shape matches no exchange and is
-- therefore readable by nobody, which is the correct failure direction.
create policy "Parties read their own exchange receipts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'exchange-receipts'
    and public.is_toy_transaction_party(((storage.foldername(name))[1])::uuid)
  );

create policy "Parties upload their own exchange receipts"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'exchange-receipts'
    and public.is_toy_transaction_party(((storage.foldername(name))[1])::uuid)
  );

create policy "Parties replace their own exchange receipts"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'exchange-receipts'
    and public.is_toy_transaction_party(((storage.foldername(name))[1])::uuid)
  );

create policy "Parties remove their own exchange receipts"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'exchange-receipts'
    and public.is_toy_transaction_party(((storage.foldername(name))[1])::uuid)
  );

comment on table public.exchange_settlements is
  'How one exchange was settled: a note, a receipt and the method. SPLAT records this and never handles the money.';
