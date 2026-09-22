-- 069 — what an event costs a family to come.
--
-- The board's event detail and registration screens draw "What it costs you
-- to come": an amount, a breakdown, and the line that SPLAT never takes the
-- payment. The host sets both; a family reads them before confirming.
--
--   org_events.cost_cents  what the host asks a family to cover, in cents.
--                          Null or 0 is free, and the public pages draw nothing.
--                          Integer cents, never a numeric dollar column, for the
--                          same reason 055's exchange_costs is: a cent lost to
--                          floating point in a number two parties agreed is an
--                          argument rather than a display bug.
--   org_events.cost_note   the breakdown, in the host's own words. ≤500 chars,
--                          the same cap as accessibility_note.
--
-- No settlement state and no payment record. SPLAT never handles the money:
-- the register form's acknowledgement says so, and the amount is a fact about
-- the event, not a ledger.
--
-- DOWN:
--   alter table public.org_events drop column if exists cost_note;
--   alter table public.org_events drop column if exists cost_cents;

alter table public.org_events
  add column cost_cents int check (cost_cents >= 0),
  add column cost_note text check (cost_note is null or length(btrim(cost_note)) <= 500);
