-- 064 — a build request with nobody on the other end of it yet.
--
-- This is the shape SUPABASE.md filed and F5 parked. 057 built build requests
-- as an ordinary transaction with a guide for a subject, which meant they
-- inherited `toy_transactions_one_owner`: exactly one of owner_id and
-- owner_org_id, always. That is right for a donation — somebody holds the toy
-- before anyone asks for it — and wrong for the artboard's Makers wanted board,
-- whose entire premise is a request nobody has claimed: "A family picks a guide
-- they cannot build. A maker nearby claims it."
--
-- So the XOR becomes "at most one, and none only while an unclaimed build is
-- still open". A claim is an ordinary accept that fills owner_id in, and every
-- stage after it is unchanged — which is the point. The board is a different
-- way IN to the same record, not a second kind of record.
--
-- The rest is what the board's cards show and 057 had no column for. All of it
-- is deliberately coarse: a suburb rather than an address, a first name and an
-- age rather than a child profile, a travel radius rather than a location.
-- These are on a PUBLIC board, and the least a maker needs to decide whether
-- they can help is the most a family should have to publish.
--
-- DOWN:
--   alter table public.toy_transactions drop constraint toy_transactions_one_owner;
--   delete from public.toy_transactions where num_nonnulls(owner_id, owner_org_id) = 0;
--   alter table public.toy_transactions add constraint toy_transactions_one_owner
--     check (num_nonnulls(owner_id, owner_org_id) = 1);
--   alter table public.toy_transactions
--     drop column travel_km, drop column urgency, drop column child_label,
--     drop column requester_suburb, drop column family_has_toy;

alter table public.toy_transactions
  -- How far the family can travel to meet a maker. The board filters on it,
  -- and it is the family's OWN limit — a maker's range is their own business
  -- and is never stored.
  add column travel_km integer check (travel_km is null or travel_km between 1 and 500),
  add column urgency text check (urgency is null or length(btrim(urgency)) <= 60),
  -- "Leo, 3" — a first name and an age, as free text rather than a
  -- child_profiles reference. A child profile carries clinical scores and
  -- measurements, and none of that belongs on a public board; copying the one
  -- line that does is what keeps the two apart.
  add column child_label text check (child_label is null or length(btrim(child_label)) <= 60),
  -- Suburb only. "Family in Newtown" is what the card says, and it is the most
  -- a family should have to publish to be found by somebody who can help.
  add column requester_suburb text
    check (requester_suburb is null or length(btrim(requester_suburb)) <= 80),
  -- Whether the family already owns the toy, which changes what a maker is
  -- agreeing to: buy one, or adapt theirs.
  add column family_has_toy boolean not null default false;

alter table public.toy_transactions drop constraint toy_transactions_one_owner;
alter table public.toy_transactions
  add constraint toy_transactions_one_owner
  check (
    -- An unclaimed build, and only while it is still open. The moment it is
    -- accepted, rejected, withdrawn or completed it has an owner — because all
    -- four of those are things an owner does.
    (num_nonnulls(owner_id, owner_org_id) = 0 and type = 'build' and status = 'requested')
    or num_nonnulls(owner_id, owner_org_id) = 1
  );

-- The board's own index: open builds, newest first.
create index toy_transactions_open_builds_idx
  on public.toy_transactions (created_at desc)
  where type = 'build' and status = 'requested' and owner_id is null and owner_org_id is null;

-- ---------------------------------------------------------------------------
-- Who can see an unclaimed request
-- ---------------------------------------------------------------------------

-- Every existing select policy on this table is written in terms of the two
-- parties. An unclaimed build has one party, so none of them match it and the
-- board would be empty for everyone but the family who posted it.
--
-- This admits exactly that row and no other: type build, status requested, no
-- owner. It is deliberately NOT granted to anon — the artboard's signed-out
-- Makers wanted screen is an explainer with "Sign in to see requests" on it,
-- and a public board of children's first names and suburbs is not a thing to
-- put behind no account at all.
create policy toy_transactions_open_builds_readable
  on public.toy_transactions for select to authenticated
  using (
    type = 'build'
    and status = 'requested'
    and owner_id is null
    and owner_org_id is null
  );
