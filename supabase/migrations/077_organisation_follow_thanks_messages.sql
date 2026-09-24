-- 077 — Follow, Message and Say thanks on an organisation's page.
--
-- The board's public organisation profile carries three buttons beside the
-- name, and Byron chose all three (2026-09-23):
--
--   org_follows        Following means hearing when the org publishes an event
--                      or a story. Private: who follows whom is nobody's
--                      business; the count is public through a definer function.
--   org_thanks         One thanks per person per organisation, as 066 does for
--                      guides. It may carry a short note, and the note shows on
--                      the page under "From families" only if its author ticked
--                      show_note — signed with the byline they typed, never a
--                      name read off their profile — and a leader can hide it.
--   org_conversations  Message: one conversation per person per organisation,
--   org_messages       readable by that person and every leader of the org.
--                      Organisation-addressed on purpose — a family is writing to
--                      the collective, not to whichever leader is on shift.
--
-- notifications gains four subjects, so one_subject is recreated over all
-- seven: org_id (a thanks), org_event_id and org_story_id (a followed org
-- published), org_conversation_id (a message). For the two publish types the
-- event or story title rides in tutorial_title, the column every client already
-- renders as the notification's title.
--
-- DOWN:
--   (restore 066's notifications_type_check and 039's notifications_one_subject)
--   alter table public.notifications drop column if exists org_conversation_id,
--     drop column if exists org_story_id, drop column if exists org_event_id, drop column if exists org_id;
--   drop function if exists public.org_thanks_count(public.organizations);
--   drop function if exists public.org_follower_count(public.organizations);
--   drop table if exists public.org_messages;
--   drop table if exists public.org_conversations;
--   drop table if exists public.org_thanks;
--   drop table if exists public.org_follows;

-- ------------------------------------------------------------- follows --

create table public.org_follows (
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (org_id, profile_id)
);
alter table public.org_follows enable row level security;
create policy org_follows_own_read on public.org_follows for select to authenticated using (profile_id = auth.uid());
create policy org_follows_own_insert on public.org_follows for insert to authenticated with check (profile_id = auth.uid());
create policy org_follows_own_delete on public.org_follows for delete to authenticated using (profile_id = auth.uid());

create or replace function public.org_follower_count(o public.organizations)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.org_follows where org_id = o.id
$$;

-- -------------------------------------------------------------- thanks --

create table public.org_thanks (
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  note text check (note is null or length(btrim(note)) between 1 and 200),
  byline text check (byline is null or length(btrim(byline)) between 1 and 60),
  show_note boolean not null default false,
  -- A leader hiding a note does not delete the thanks; the count keeps it.
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (org_id, profile_id)
);
alter table public.org_thanks enable row level security;
create policy org_thanks_own_read on public.org_thanks for select to authenticated using (profile_id = auth.uid());
create policy org_thanks_leaders_read on public.org_thanks for select to authenticated using (public.is_org_leader(org_id));
create policy org_thanks_own_insert on public.org_thanks for insert to authenticated with check (profile_id = auth.uid() and hidden_at is null);
-- Editing the note is the author's; hiding it is a leader's, and the API is the
-- only writer of hidden_at (it uses the service role for that one column).
create policy org_thanks_own_update on public.org_thanks for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create or replace function public.org_thanks_count(o public.organizations)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.org_thanks where org_id = o.id
$$;

-- ------------------------------------------------------------ messages --

create table public.org_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, profile_id)
);
create table public.org_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.org_conversations (id) on delete cascade,
  -- Cascade, unlike toy_idea_messages: a deleted account takes its side of the
  -- conversation with it rather than blocking the delete.
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index org_messages_conversation_idx on public.org_messages (conversation_id, created_at);

alter table public.org_conversations enable row level security;
alter table public.org_messages enable row level security;

create policy org_conversations_party_read on public.org_conversations for select to authenticated
  using (profile_id = auth.uid() or public.is_org_leader(org_id));
create policy org_conversations_own_insert on public.org_conversations for insert to authenticated
  with check (profile_id = auth.uid());

create policy org_messages_party_read on public.org_messages for select to authenticated
  using (exists (
    select 1 from public.org_conversations c
    where c.id = conversation_id and (c.profile_id = auth.uid() or public.is_org_leader(c.org_id))
  ));
create policy org_messages_party_insert on public.org_messages for insert to authenticated
  with check (sender_id = auth.uid() and exists (
    select 1 from public.org_conversations c
    where c.id = conversation_id and (c.profile_id = auth.uid() or public.is_org_leader(c.org_id))
  ));

-- ------------------------------------------------------- notifications --

alter table public.notifications
  add column org_id uuid references public.organizations (id) on delete cascade,
  add column org_event_id uuid references public.org_events (id) on delete cascade,
  add column org_story_id uuid references public.org_stories (id) on delete cascade,
  add column org_conversation_id uuid references public.org_conversations (id) on delete cascade;

alter table public.notifications drop constraint notifications_one_subject;
alter table public.notifications add constraint notifications_one_subject
  check (num_nonnulls(tutorial_id, idea_id, toy_transaction_id, org_id, org_event_id, org_story_id, org_conversation_id) = 1);

-- 046's guard, again: abort rather than drop a type the live constraint allows.
do $$
declare
  def  text;
  lost text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint
   where conname = 'notifications_type_check' and conrelid = 'public.notifications'::regclass;
  if def is null then raise exception 'notifications_type_check is absent'; end if;
  select string_agg(distinct m[1], ', ') into lost
    from regexp_matches(def, '''([a-z_]+)''', 'g') as m
   where m[1] not in (
     'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
     'collaborator_removed', 'collaborator_left',
     'tutorial_approved', 'tutorial_rejected',
     'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message',
     'idea_approved', 'idea_rejected',
     'challenge_joined', 'challenge_left', 'challenge_removed',
     'idea_graduated', 'backing_requested', 'tutorial_submitted',
     'build_shot_posted', 'build_approved', 'print_started', 'print_ready',
     'tutorial_thanked'
   );
  if lost is not null then
    raise exception 'live notifications_type_check permits values 077 would drop: %', lost;
  end if;
end $$;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
    'collaborator_removed', 'collaborator_left',
    'tutorial_approved', 'tutorial_rejected',
    'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message',
    'idea_approved', 'idea_rejected',
    'challenge_joined', 'challenge_left', 'challenge_removed',
    'idea_graduated', 'backing_requested', 'tutorial_submitted',
    'build_shot_posted', 'build_approved', 'print_started', 'print_ready',
    'tutorial_thanked',
    -- new in 077
    'org_event_published', 'org_story_published', 'org_message', 'org_thanked'
  ));
