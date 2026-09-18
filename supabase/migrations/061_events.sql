-- 061 — events: what a family decides on, who is coming, and the parts a host
-- prints before the day.
--
-- 059 created org_events as a title, a time and a place, which was enough for a
-- leader's own list. The artboard's five event screens ask for considerably
-- more, and every column below is on one of them:
--
--   /get-involved/events            kind, suburb + state (the state filter),
--                                   capacity ("5 seats left"), photo_urls
--   /get-involved/events/[id]       description, what_to_bring, tools,
--                                   accessibility_note, prints_parts
--   /get-involved/events/[id]/register  org_event_questions + registrations
--   /dashboard/org/events/[id]      registrations_closed_at, cancelled_at, and
--                                   the part-print queue
--   /dashboard/events               the family's side of that same queue
--
-- `location` keeps its meaning — venue and street, as the publish form labels
-- it — and suburb/state join it as their own columns because the public list
-- filters on state and cannot parse it back out of a free-text line. That is
-- the same split printers already use (058).
--
-- DOWN:
--   drop table if exists public.org_event_registrations;
--   drop table if exists public.org_event_questions;
--   alter table public.toy_transactions drop constraint toy_transactions_subject;
--   alter table public.toy_transactions drop column event_id, drop column part_sets;
--   (restore 058's toy_transactions_subject, then)
--   alter table public.org_events
--     drop column kind, drop column suburb, drop column state, drop column capacity,
--     drop column description, drop column what_to_bring, drop column tools,
--     drop column prints_parts, drop column part_sets_max, drop column accessibility_note,
--     drop column photo_urls, drop column registrations_closed_at, drop column cancelled_at;

alter table public.org_events
  -- The four the publish form offers as radios. Defaulted rather than made
  -- NOT NULL without one: 059's rows predate the column and every one of them
  -- is a build day.
  add column kind text not null default 'build_day'
    check (kind in ('build_day', 'workshop', 'open_day', 'print_day')),
  add column suburb text check (suburb is null or length(btrim(suburb)) <= 80),
  add column state text
    check (state is null or state in ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT')),
  -- Null means no limit, which is what the form's "Seats (blank = no limit)"
  -- says. 0 would mean a full event, which is a different thing.
  add column capacity integer check (capacity is null or capacity between 1 and 1000),
  add column description text check (description is null or length(btrim(description)) <= 4000),
  add column what_to_bring text check (what_to_bring is null or length(btrim(what_to_bring)) <= 500),
  add column tools text[] not null default '{}',
  add column prints_parts boolean not null default false,
  add column part_sets_max integer check (part_sets_max is null or part_sets_max between 1 and 100),
  add column accessibility_note text
    check (accessibility_note is null or length(btrim(accessibility_note)) <= 500),
  add column photo_urls text[] not null default '{}',
  -- Two separate withdrawals, and the manage screen offers them as two
  -- buttons. Closing registrations leaves the event on the public list with its
  -- date intact; cancelling takes it off. Collapsing them into one status would
  -- lose the distinction a family needs most.
  add column registrations_closed_at timestamptz,
  add column cancelled_at timestamptz;

-- A PUBLISHED in-person event needs a suburb and state, or it cannot appear
-- under any filter on /get-involved/events — which is indistinguishable, to a
-- family, from not being published at all. Online events have neither by
-- definition, and a draft is allowed to be incomplete: the publish form saves
-- one at any point.
--
-- NOT VALID, and deliberately. Rows written under 059 predate both columns, so
-- there is no value to backfill them with — a suburb cannot be recovered from a
-- free-text venue line, and inventing one would put a wrong address in front of
-- a family driving to it. The constraint is enforced on every insert and update
-- from here, which is the strongest thing that is also true. Run
-- `alter table public.org_events validate constraint org_events_in_person_has_a_place;`
-- once the legacy rows have been given a place by hand.
alter table public.org_events
  add constraint org_events_in_person_has_a_place
  check (
    status <> 'published'
    or format <> 'in_person'
    or (suburb is not null and length(btrim(suburb)) > 0 and state is not null)
  )
  not valid;

-- Offering to print parts without saying how many is an open-ended promise.
alter table public.org_events
  add constraint org_events_part_offer_has_a_cap
  check (prints_parts = false or part_sets_max is not null);

-- ---------------------------------------------------------------------------
-- The registration form
-- ---------------------------------------------------------------------------

-- Questions the organiser adds. Name and email are always asked and are NOT
-- rows here — they are columns on the registration, because every event has
-- them and a question that cannot be removed is not a question.
create table public.org_event_questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.org_events (id) on delete cascade,
  -- Explicit, because the form reorders with Move up / Move down and array
  -- order in a jsonb column cannot be updated one row at a time.
  position integer not null check (position between 1 and 20),
  prompt text not null check (length(btrim(prompt)) between 1 and 200),
  answer_type text not null
    check (answer_type in ('short', 'paragraph', 'number', 'choice', 'boolean')),
  required boolean not null default false,
  -- Only 'choice' uses these; the constraint below is what stops a silent
  -- half-configured dropdown reaching a family.
  options text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (event_id, position),
  constraint org_event_questions_choice_has_options
    check ((answer_type = 'choice') = (cardinality(options) > 0))
);

create index org_event_questions_event_idx on public.org_event_questions (event_id, position);

alter table public.org_event_questions enable row level security;

-- Readable by anyone, because the register form is a public page: a guest has
-- to see the questions before deciding whether to make an account.
create policy org_event_questions_public_read
  on public.org_event_questions for select to anon, authenticated
  using (
    exists (
      select 1 from public.org_events e
      where e.id = event_id and e.status = 'published' and e.cancelled_at is null
    )
  );

create policy org_event_questions_leader_read
  on public.org_event_questions for select to authenticated
  using (
    exists (select 1 from public.org_events e where e.id = event_id and public.is_org_leader(e.org_id))
  );

create policy org_event_questions_leader_write
  on public.org_event_questions for all to authenticated
  using (
    exists (select 1 from public.org_events e where e.id = event_id and public.is_org_leader(e.org_id))
  )
  with check (
    exists (select 1 from public.org_events e where e.id = event_id and public.is_org_leader(e.org_id))
  );

-- ---------------------------------------------------------------------------
-- Who is coming
-- ---------------------------------------------------------------------------

create table public.org_event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.org_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Copied onto the row rather than read off the profile. A family books under
  -- whichever name the host should call out on the day, which is not always the
  -- account name, and the host needs the booking to stay legible after the
  -- account is renamed or deleted.
  name text not null check (length(btrim(name)) between 1 and 120),
  email text not null check (length(btrim(email)) between 3 and 320),
  -- Keyed by question id. jsonb rather than a row per answer: answers are only
  -- ever read as a whole registration, never queried across, and the form's
  -- five answer types would otherwise need five nullable columns.
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- "Change or cancel any time from My events."
  cancelled_at timestamptz,
  -- One registration per person per event. A family bringing four people says
  -- so in the head-count question, which is why that is the artboard's first
  -- suggested "common ask" rather than a seats field here.
  unique (event_id, user_id)
);

create index org_event_registrations_event_idx on public.org_event_registrations (event_id);
create index org_event_registrations_user_idx on public.org_event_registrations (user_id);

alter table public.org_event_registrations enable row level security;

-- A registrant reads and writes their own row, and nobody else's. The artboard
-- is explicit that the avatars on the public page are the only thing another
-- attendee sees: "Answers are shown to leaders only."
create policy org_event_registrations_own
  on public.org_event_registrations for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy org_event_registrations_leader_read
  on public.org_event_registrations for select to authenticated
  using (
    exists (select 1 from public.org_events e where e.id = event_id and public.is_org_leader(e.org_id))
  );

-- ---------------------------------------------------------------------------
-- Parts printed before the day
-- ---------------------------------------------------------------------------

-- A print request can now name an EVENT instead of a printer. Same type, same
-- status flow, same thread — the artboard's manage screen accepts and declines
-- these with the same two words a printer uses, and a declined one "is told
-- straight away and asked to pick a printer nearby instead", which only works
-- if it is the same record moving rather than a new one being made.
alter table public.toy_transactions
  add column event_id uuid references public.org_events (id) on delete restrict,
  -- How many sets, against the event's part_sets_max. The manage screen counts
  -- accepted sets, not accepted requests: "You said up to 6 sets".
  add column part_sets integer check (part_sets is null or part_sets between 1 and 20);

create index toy_transactions_event_idx on public.toy_transactions (event_id)
  where event_id is not null;

-- 058's constraint required printer_id on every print. It now requires exactly
-- one of printer_id and event_id: a print job is done by a printer OR at an
-- event, and a row naming both has no single party to accept it.
alter table public.toy_transactions drop constraint toy_transactions_subject;
alter table public.toy_transactions
  add constraint toy_transactions_subject
  check (
    case
      when type = 'build' then
        toy_id is null
        and offered_toy_id is null
        and tutorial_id is not null
        and build_brief is not null
        and length(btrim(build_brief)) between 1 and 2000
        and printer_id is null
        and event_id is null
        and part_sets is null
      when type = 'print' then
        toy_id is null
        and offered_toy_id is null
        -- The guide the parts come from. "Parts come from the guide, never
        -- uploaded" is the artboard's rule and the reason there is no upload
        -- path anywhere near this.
        and tutorial_id is not null
        and build_brief is null
        and num_nonnulls(printer_id, event_id) = 1
        -- Sets are an event's unit of work. A printer takes the job whole.
        and (event_id is null) = (part_sets is null)
        and working_photo_url is null
        and work_approved_at is null
      else
        toy_id is not null
        and tutorial_id is null
        and build_brief is null
        and printer_id is null
        and event_id is null
        and part_sets is null
        and working_photo_url is null
        and work_approved_at is null
        and print_note is null
        and printing_started_at is null
        and ready_at is null
        and ready_photo_url is null
    end
  );
