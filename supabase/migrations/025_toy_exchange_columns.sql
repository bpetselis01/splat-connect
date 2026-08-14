-- supabase/migrations/025_toy_exchange_columns.sql
-- WHY: toys need an owner-chosen offer type (donation/exchange/both) and an
--      archived state so a completed handoff can leave both My Toys and the
--      public library without being deleted. profiles need a default pickup
--      address so an accepted request can hand it back automatically.
alter table public.toys
  add column offer_type text check (offer_type in ('donation', 'exchange', 'both')),
  add column archived_at timestamptz;

alter table public.profiles
  add column pickup_line1 text,
  add column pickup_suburb text,
  add column pickup_state text,
  add column pickup_postcode text;
