-- 086 — what the parts cost (part-prices, decided 2026-09-30).
--
--   parts.price_cents           the line at its quantity, in cents. Null = no
--                               price yet; 0 = free (salvaged, already owned).
--   tutorials.prices_checked_on when the author last checked them. A date the
--                               author sets, so it is a PATCH field like any
--                               other and goes through the updated_at check.
--
-- The total is derived on read (partsTotalCents in @splat-connect/types) and
-- shows only when every required part has a price — never stored.
--
-- DOWN:
--   alter table public.tutorials drop column if exists prices_checked_on;
--   alter table public.parts drop column if exists price_cents;

alter table public.parts add column price_cents int check (price_cents >= 0);
alter table public.tutorials add column prices_checked_on date;
