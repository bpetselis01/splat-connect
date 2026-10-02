-- 074 — a print request can go to up to three printers at once.
--
-- The board's rule, web and mobile alike: "Pick up to three; the first to
-- accept prints it. The others are withdrawn for you, so nobody prints it
-- twice." Each printer still gets an ordinary print job — its own row, its own
-- queue, its own thread — so every screen that shows one job keeps working.
-- What ties them together is a shared print_group_id.
--
--   toy_transactions.print_group_id   the request the row was sent as part of.
--                                     Every print job made by POST /print has
--                                     one, a single-printer request included.
--   toy_transactions.print_colour     what the family asked for. Free text
--                                     capped at 30 characters: the board offers
--                                     "Any colour", Black, White and Blue, but
--                                     which colours exist is whatever filament
--                                     the printers own.
--   toy_transactions.print_delivery   'collect' or 'post' — the mobile board's
--                                     "I will collect" / "Post it to me".
--
-- One winner per group is the database's job, not the API's. Two printers
-- pressing Accept in the same second both pass any read-then-write check; the
-- partial unique index lets exactly one of them commit, and the loser gets a
-- 23505 the API turns into "Another printer has already taken this job".
--
-- DOWN:
--   drop index if exists public.toy_transactions_print_group_idx;
--   drop index if exists public.toy_transactions_one_taker_per_print_group;
--   alter table public.toy_transactions drop constraint if exists toy_transactions_print_request_fields;
--   alter table public.toy_transactions drop column if exists print_delivery;
--   alter table public.toy_transactions drop column if exists print_colour;
--   alter table public.toy_transactions drop column if exists print_group_id;

alter table public.toy_transactions
  add column print_group_id uuid,
  add column print_colour text check (print_colour is null or length(btrim(print_colour)) between 1 and 30),
  add column print_delivery text check (print_delivery is null or print_delivery in ('collect', 'post'));

alter table public.toy_transactions
  add constraint toy_transactions_print_request_fields check (
    type = 'print' or (print_group_id is null and print_colour is null and print_delivery is null)
  );

create unique index toy_transactions_one_taker_per_print_group
  on public.toy_transactions (print_group_id)
  where print_group_id is not null and status in ('accepted', 'completed');

create index toy_transactions_print_group_idx
  on public.toy_transactions (print_group_id)
  where print_group_id is not null;
