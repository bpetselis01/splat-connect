-- 076 — what the board's organisation profile shows that 059 did not store.
--
-- The editor (/dashboard/organisation/profile) and the public page
-- (/organizations/[id]/public) on the board carry:
--
--   organizations.kind            "What you are" — Paediatric OT service,
--                                 makerspace… Free text ≤60; the form offers a
--                                 list, and anything else is allowed.
--   organizations.logo_url        public URLs in the toy-photos bucket under
--   organizations.cover_url       orgs/<id>/, written by the API. The cover's own
--                                 rule is on the board: no children's faces
--                                 without written consent.
--   organizations.verified_at     "Verified by SPLAT". Set by an admin only —
--                                 the API never lets a leader write it.
--   organizations.visit_hours     "Switch clinic Thursdays 1–5 pm" on the Visit
--   organizations.service_area    card, and "Hunter region and Central Coast".
--   organizations.payment_methods how the org likes to be paid back: the same
--                                 four the cost panel offers.
--
--   org_doors       "How to work with them": up to six numbered cards, each a
--                   title, a line, and where it takes a family.
--   org_rate_lines  "What you ask families to cover": the breakdown under the
--                   rate note, each line claiming back or covered by the org.
--
-- Both tables are public to read (the public page renders them) and written by
-- the org's leaders only.
--
-- DOWN:
--   drop table if exists public.org_rate_lines;
--   drop table if exists public.org_doors;
--   alter table public.organizations drop column if exists payment_methods,
--     drop column if exists service_area, drop column if exists visit_hours,
--     drop column if exists verified_at, drop column if exists cover_url,
--     drop column if exists logo_url, drop column if exists kind;

alter table public.organizations
  add column kind text check (kind is null or length(btrim(kind)) between 1 and 60),
  add column logo_url text,
  add column cover_url text,
  add column verified_at timestamptz,
  add column visit_hours text check (visit_hours is null or length(btrim(visit_hours)) <= 120),
  add column service_area text check (service_area is null or length(btrim(service_area)) <= 120),
  add column payment_methods text[] not null default '{}'
    check (payment_methods <@ array['cash', 'bank_transfer', 'payid', 'any']::text[]);

create table public.org_doors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  position smallint not null check (position between 1 and 6),
  title text not null check (length(btrim(title)) between 1 and 60),
  body text check (body is null or length(btrim(body)) <= 200),
  target text not null check (target in ('toy_library', 'events', 'dropoff', 'print', 'build', 'message')),
  created_at timestamptz not null default now()
);
create index org_doors_org_idx on public.org_doors (org_id, position);

create table public.org_rate_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  description text not null check (length(btrim(description)) between 1 and 80),
  amount_cents integer not null check (amount_cents >= 0),
  -- The cost panel's split (055): a line the family pays back, or one the org
  -- names and covers itself.
  claiming boolean not null default true,
  created_at timestamptz not null default now()
);
create index org_rate_lines_org_idx on public.org_rate_lines (org_id, position);

alter table public.org_doors enable row level security;
alter table public.org_rate_lines enable row level security;

create policy org_doors_read on public.org_doors for select using (true);
create policy org_doors_leaders_write on public.org_doors for all to authenticated
  using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));

create policy org_rate_lines_read on public.org_rate_lines for select using (true);
create policy org_rate_lines_leaders_write on public.org_rate_lines for all to authenticated
  using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));
