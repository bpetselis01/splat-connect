-- supabase/migrations/059_organisation_screens.sql
--
-- WHY: brief feature 10 — the organisation's own screens. Three of the six
--      exist (review queue, toy inventory, and print orders since 058). The
--      other three have nowhere to read or write:
--
--      - **The profile editor.** The artboard says "every field on the public
--        organisation page has an input here: identity, the About paragraph,
--        which capabilities show as chips, the declared rates families are
--        quoted, and how a family reaches you". `organizations` holds a name, a
--        description, a status and a private pickup address. None of the rest.
--      - **Events and stories.** "What the organisation has published, in two
--        tabs. Publish/unpublish is one click and takes effect on the public
--        page immediately." Nothing models either.
--      - **Recycling intake.** "Two halves: what your machines can take, and the
--        queue of booked drop-offs. Credit is minted here, by weighing — never
--        by the contributor." Nothing models either half.
--
-- HOW:  the profile is columns, because every one of them is a property of the
--       organisation and there is exactly one row per organisation to hold
--       them. The other three are tables, because each is a list.
--
--       Publishing is a status column rather than a separate published table.
--       The artboard's rule is that publish and unpublish are one click each
--       and take effect immediately; a second table makes unpublish a delete
--       and loses the draft somebody spent an evening on.
--
--       Credit is grams of filament, an integer. Not a float, for 055's
--       reason: a rounding error in a number two parties agreed between them is
--       an argument rather than a display bug. Weighed grams in, credit grams
--       out, and the yield is applied by the leader doing the weighing rather
--       than assumed here — about three quarters is typical and "typical" is
--       not a number to hardcode into a ledger.
--
-- DOWN: drop table public.recycling_dropoffs;
--       drop table public.org_stories;
--       drop table public.org_events;
--       alter table public.organizations
--         drop column recycling_note, drop column recycling_materials,
--         drop column rate_note, drop column website_url, drop column
--         contact_phone, drop column contact_email, drop column capabilities,
--         drop column state, drop column suburb, drop column about;

-- ------------------------------------------------------------ the profile --

alter table public.organizations
  -- The About paragraph. `description` is the one-liner that already renders as
  -- a trust badge on a tutorial; this is the page's own prose and they are not
  -- the same field, however tempting it is to reuse one.
  add column about text check (about is null or length(btrim(about)) <= 4000),

  -- Where they are, publicly. The pickup columns are the street address and
  -- stay private (033 revoked the table grant for exactly that reason); this is
  -- the suburb a family reads when deciding whether an organisation is near
  -- enough to be useful.
  add column suburb text,
  add column state text,

  -- What they do, as chips. Validated in the API rather than by a constraint,
  -- for the reason 037 gives about `contact_prefs`: the set is presentational
  -- and will change more often than the schema should.
  add column capabilities text[] not null default '{}',

  add column contact_email text,
  add column contact_phone text,
  add column website_url text,

  -- "The declared rates families are quoted." Free text and deliberately so:
  -- every organisation words this differently and a structured price list would
  -- be a claim the platform cannot stand behind.
  add column rate_note text check (rate_note is null or length(btrim(rate_note)) <= 500),

  -- The recycling half that is a property of the organisation rather than of a
  -- drop-off: what their machines can actually take.
  add column recycling_materials text[] not null default '{}',
  add column recycling_note text check (recycling_note is null or length(btrim(recycling_note)) <= 500);

-- 033 revoked the table-level grant and granted back only the columns that are
-- public by design, because "Anyone can read organizations" is `using (true)`
-- and RLS is row-level: once that policy admits a row, every GRANTed column on
-- it is readable by anyone. The new columns are all public by design — they are
-- what the public profile draws — so they are granted here explicitly rather
-- than inheriting anything.
grant select (
  id, name, description, status, created_at, updated_at,
  about, suburb, state, capabilities, contact_email, contact_phone, website_url,
  rate_note, recycling_materials, recycling_note
) on public.organizations to anon, authenticated;

-- ------------------------------------------------------------- the events --

create table public.org_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,

  title text not null check (length(btrim(title)) between 1 and 160),
  summary text check (summary is null or length(btrim(summary)) <= 300),
  starts_at timestamptz not null,
  ends_at timestamptz,
  constraint org_events_ends_after_start check (ends_at is null or ends_at > starts_at),

  -- An online event has a link and no place; an in-person one has a place and
  -- no link. Both are required, because "where" is one of the four things the
  -- artboard says a family decides on.
  format text not null check (format in ('in_person', 'online')),
  location text,
  online_url text,
  constraint org_events_where check (
    case
      when format = 'in_person' then location is not null and length(btrim(location)) > 0
      else online_url is not null and length(btrim(online_url)) > 0
    end
  ),

  -- Who it is for, in the organiser's words.
  audience text check (audience is null or length(btrim(audience)) <= 200),

  -- Draft or published, not a separate table: unpublishing must not delete the
  -- evening somebody spent writing it.
  status text not null default 'draft' check (status in ('draft', 'published')),

  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index org_events_org_idx on public.org_events (org_id, starts_at desc);

alter table public.org_events enable row level security;

create policy "Published events are public"
  on public.org_events for select to anon, authenticated
  using (status = 'published');

-- A leader sees their own drafts. Separate from the policy above rather than
-- one `or`: a draft is not public and the two audiences must not be able to
-- drift into one policy body that accidentally admits both.
create policy "Leaders see their organisation's drafts"
  on public.org_events for select to authenticated
  using (public.is_org_leader(org_id));

create policy "Leaders publish their organisation's events"
  on public.org_events for all to authenticated
  using (public.is_org_leader(org_id))
  with check (public.is_org_leader(org_id) and created_by = auth.uid());

comment on table public.org_events is
  'Events an organisation has published. Draft until a leader publishes; no review, so the leader terms carry the risk.';

-- ------------------------------------------------------------ the stories --

create table public.org_stories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,

  kind text not null check (kind in ('delivery', 'build_day', 'partnership', 'other')),
  title text not null check (length(btrim(title)) between 1 and 160),
  summary text not null check (length(btrim(summary)) between 1 and 300),
  body text not null check (length(btrim(body)) between 1 and 20000),
  -- "Every story is attributed to an organisation and a byline."
  byline text not null check (length(btrim(byline)) between 1 and 120),

  -- Publish is disabled until consent is confirmed for everyone named or
  -- pictured. Stored rather than left to a checkbox the browser forgets,
  -- because it is the record that the confirmation was made at all — and the
  -- constraint below is what makes it more than a decoration.
  consent_confirmed boolean not null default false,

  status text not null default 'draft' check (status in ('draft', 'published')),
  constraint org_stories_published_needs_consent
    check (status = 'draft' or consent_confirmed),

  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index org_stories_org_idx on public.org_stories (org_id, created_at desc);

alter table public.org_stories enable row level security;

create policy "Published stories are public"
  on public.org_stories for select to anon, authenticated
  using (status = 'published');

create policy "Leaders see their organisation's story drafts"
  on public.org_stories for select to authenticated
  using (public.is_org_leader(org_id));

create policy "Leaders publish their organisation's stories"
  on public.org_stories for all to authenticated
  using (public.is_org_leader(org_id))
  with check (public.is_org_leader(org_id) and created_by = auth.uid());

comment on table public.org_stories is
  'Stories an organisation has published. Cannot be published until consent is confirmed for everyone named or pictured — a check constraint, not a checkbox.';

-- ---------------------------------------------------------- the recycling --

create table public.recycling_dropoffs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  contributor_id uuid not null references public.profiles (id) on delete cascade,

  material text not null check (length(btrim(material)) between 1 and 40),
  -- What the contributor says they are bringing, in whole grams. Their
  -- estimate, and named as one: the figure that counts is weighed at the door.
  estimated_grams integer not null check (estimated_grams between 1 and 1000000),

  -- Every line of the condition declaration, ticked. A drop-off that has not
  -- been declared is one nobody can safely put through a grinder.
  condition_declared boolean not null default false,

  note text check (note is null or length(btrim(note)) <= 500),

  status text not null default 'booked'
    check (status in ('booked', 'received', 'declined', 'cancelled')),

  -- Minted here, by weighing, and never by the contributor. Both are the
  -- leader's: what came in, and what it is worth as filament. The yield is
  -- applied by whoever weighs it rather than assumed by a constant — about
  -- three quarters is typical, and "typical" is not a number to put in a
  -- ledger.
  weighed_grams integer check (weighed_grams is null or weighed_grams between 0 and 1000000),
  credit_grams integer check (credit_grams is null or credit_grams between 0 and 1000000),
  constraint recycling_dropoffs_received_is_weighed
    check (status <> 'received' or (weighed_grams is not null and credit_grams is not null)),
  -- Credit can never exceed what was actually weighed. There is no yield that
  -- turns two kilos of milk bottles into three kilos of filament.
  constraint recycling_dropoffs_credit_within_weight
    check (credit_grams is null or weighed_grams is null or credit_grams <= weighed_grams),

  decided_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recycling_dropoffs_org_idx on public.recycling_dropoffs (org_id, created_at desc);
create index recycling_dropoffs_contributor_idx
  on public.recycling_dropoffs (contributor_id, created_at desc);

alter table public.recycling_dropoffs enable row level security;

create policy "Read your own drop-offs"
  on public.recycling_dropoffs for select to authenticated
  using (contributor_id = auth.uid() or public.is_org_leader(org_id));

create policy "Book your own drop-off"
  on public.recycling_dropoffs for insert to authenticated
  with check (contributor_id = auth.uid());

-- Split deliberately. A contributor may cancel their own booking; only a leader
-- may weigh one in, because the whole point of the screen is that credit is
-- minted by the organisation at the door. One combined policy would let a
-- contributor write their own `credit_grams`.
create policy "Leaders weigh in their organisation's drop-offs"
  on public.recycling_dropoffs for update to authenticated
  using (public.is_org_leader(org_id))
  with check (public.is_org_leader(org_id));

create policy "Cancel your own booking"
  on public.recycling_dropoffs for delete to authenticated
  using (contributor_id = auth.uid() and status = 'booked');

comment on table public.recycling_dropoffs is
  'Waste plastic a contributor has booked in to an organisation. Credit is minted by the organisation weighing it, never by the contributor.';
