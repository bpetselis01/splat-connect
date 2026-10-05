-- 126 — geocodes: the Map tab's address → point cache.
--
-- GET /api/public/map turns each address it pins into a query string
-- (geocode.ts) and reads the answer from here; only a miss calls Nominatim.
-- Keyed by the query text itself, so an address edited anywhere is new text
-- and is looked up again with no write-path hook. A not-found answer is kept
-- (found = false) so a bad address is not retried on every load.
--
-- RLS on with no policies: service role only. The API reads and writes it
-- through the admin client.
--
-- DOWN:
--   drop table if exists public.geocodes;

create table public.geocodes (
  query text primary key check (length(query) between 1 and 500),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  found boolean not null,
  geocoded_at timestamptz not null default now(),
  check (found = (lat is not null and lng is not null))
);

alter table public.geocodes enable row level security;
revoke all on public.geocodes from anon, authenticated;
