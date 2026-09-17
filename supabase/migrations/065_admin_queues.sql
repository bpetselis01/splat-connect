-- 065 — the three things an admin works through that had nowhere to live.
--
-- /admin/inbox, /admin/reports and /admin/content are the last of the
-- artboard's admin screens without a table behind them. The other two —
-- build requests and print jobs — are query surfaces over toy_transactions and
-- need no schema at all.
--
--   contact_messages  what the contact form sends. Today it is a mailto: link,
--                     which means a safety report reaches whichever inbox
--                     somebody happens to be watching.
--   member_reports    "Private problem reports from members. Safety sits at the
--                     top whatever its age. The person reported is never told
--                     who filed it."
--   site_content      "The pages with no other owner."
--
-- DOWN:
--   drop table if exists public.site_content;
--   drop table if exists public.member_reports;
--   drop table if exists public.contact_messages;

-- ---------------------------------------------------------------------------
-- The contact form
-- ---------------------------------------------------------------------------

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  -- The four the form offers. `safety` is first because it is the one that
  -- jumps the queue, and the inbox sorts on it.
  topic text not null check (topic in ('safety', 'organisation', 'guide', 'other')),
  name text not null check (length(btrim(name)) between 1 and 120),
  email text not null check (length(btrim(email)) between 3 and 320),
  body text not null check (length(btrim(body)) between 1 and 4000),
  -- Set when the sender happened to be signed in. Null for a visitor, which is
  -- most of them — the form does not require an account, because somebody
  -- reporting a hazard should not have to make one first.
  sender_id uuid references public.profiles (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'replied', 'closed')),
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index contact_messages_queue_idx on public.contact_messages (status, created_at);

alter table public.contact_messages enable row level security;

-- Anyone may send one, including a visitor with no account: a person reporting
-- that a battery pack gets warm should not have to sign up first.
create policy contact_messages_anyone_writes
  on public.contact_messages for insert to anon, authenticated
  with check (true);

-- Only an admin reads one. There is no "my messages" screen and deliberately
-- so — the reply comes by email, from a person.
create policy contact_messages_admin_reads
  on public.contact_messages for select to authenticated
  using (public.is_admin());

create policy contact_messages_admin_writes
  on public.contact_messages for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Reports about a person, a guide, a toy or a job
-- ---------------------------------------------------------------------------

create table public.member_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  -- What the report is about, as a kind plus a free-text label rather than four
  -- nullable foreign keys. The label is what the queue renders — "Guide C —
  -- Plush dog that barks" — and it is captured at report time on purpose: a
  -- guide that is renamed or withdrawn afterwards must not change what somebody
  -- said they were reporting.
  subject_kind text not null
    check (subject_kind in ('guide', 'toy', 'person', 'organisation', 'print_job', 'other')),
  subject_label text not null check (length(btrim(subject_label)) between 1 and 200),
  -- Optional pointer, for the admin who wants to open the thing. Nullable, and
  -- deliberately not a foreign key: it can name any of six tables.
  subject_id uuid,
  category text not null
    check (category in ('safety', 'no_show', 'arrived_broken', 'wrong_info', 'conduct', 'other')),
  body text not null check (length(btrim(body)) between 1 and 4000),
  -- Whether the reporter is willing to be contacted about it. The queue shows
  -- "OK to contact" only when this is true, and an admin should not have to
  -- guess.
  ok_to_contact boolean not null default false,
  status text not null default 'new' check (status in ('new', 'looking', 'resolved')),
  -- The reply that goes back to the reporter, and nowhere else. The person
  -- reported is never told who filed it, which is why there is no column here
  -- that would let a note reach them.
  note_to_reporter text check (note_to_reporter is null or length(btrim(note_to_reporter)) <= 2000),
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

-- Safety first, then oldest first. A partial index rather than an ordering
-- expression, because "safety regardless of age" is the whole sort and it is
-- worth being able to read that off the schema.
create index member_reports_open_idx
  on public.member_reports (created_at)
  where status <> 'resolved';

alter table public.member_reports enable row level security;

-- A member files their own and reads their own, so they can see the note that
-- came back. They cannot edit one after the fact: a report that can be rewritten
-- is not evidence of anything.
create policy member_reports_own_insert
  on public.member_reports for insert to authenticated
  with check (reporter_id = auth.uid());

create policy member_reports_own_read
  on public.member_reports for select to authenticated
  using (reporter_id = auth.uid());

create policy member_reports_admin_read
  on public.member_reports for select to authenticated
  using (public.is_admin());

create policy member_reports_admin_write
  on public.member_reports for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- The pages with no other owner
-- ---------------------------------------------------------------------------

create table public.site_content (
  -- A slug, not a uuid: this table is read BY key on every page load, and a
  -- generated id would mean a lookup table to find the row you already knew
  -- the name of.
  key text primary key check (key ~ '^[a-z][a-z0-9-]{1,60}$'),
  -- The shape differs per key — the home hero has four strings, the three
  -- numbers have a live/pinned flag each, the scroll story is five scenes — and
  -- one table with one column per union of those would be forty nullable
  -- columns. Every reader checks the shape it expects.
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

-- Public by design: this is the copy on the public pages.
create policy site_content_public_read
  on public.site_content for select to anon, authenticated
  using (true);

create policy site_content_admin_write
  on public.site_content for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- The home hero and its three numbers, seeded with what app/page.tsx renders
-- today so the editor opens on the live copy rather than on blanks.
--
-- `live: true` means the number is counted rather than stated. Pinning one is a
-- deliberate act: the artboard's own note is that "a pinned number is a claim
-- someone has to stand behind", which is why `source` exists beside it.
insert into public.site_content (key, value) values
  (
    'home-hero',
    jsonb_build_object(
      'eyebrow', 'Free, reviewed, Australian',
      'headline', 'Every toy in the house was something he watched his sister play with.',
      'subhead', 'Guides for adapting shop toys so a child can play with one press of a switch. Written by parents, makers and therapists, reviewed before anyone reads them.',
      'primary_label', 'Browse the guides',
      'secondary_label', 'How it works'
    )
  ),
  (
    'home-numbers',
    jsonb_build_object(
      'guides', jsonb_build_object('label', 'Guides published', 'live', true, 'pinned', null, 'source', 'Counted from published guides'),
      'organisations', jsonb_build_object('label', 'Organisations backing', 'live', true, 'pinned', null, 'source', 'Counted from verified organisations'),
      'toys', jsonb_build_object('label', 'Toys passed on', 'live', true, 'pinned', null, 'source', 'Counted from closed exchanges')
    )
  )
on conflict (key) do nothing;
