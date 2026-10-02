-- 117 — Say thanks to a person (thank-people).
--
-- Decided 2026-09-30: one table mirroring 077's org_thanks. One thanks per
-- person per person; an optional note that shows nowhere public (the board's
-- buttons are one tap, and only the COUNT is public, through a definer
-- function); an optional transaction it was for (an exchange, a print, a
-- build). The thanked person may hide a note; the count keeps it.
--
-- Two of 077's holes are not copied:
--   * org_thanks' update policy lets the thanker write hidden_at through
--     PostgREST. Here the thanker may update note, byline and show_note only
--     (column grants); hidden_at is written by the API with the service role.
--   * 077 recreated notifications_one_subject unguarded. Here it is guarded
--     like the type check.
--
-- notifications gains profile_id: the subject of a thanks sent from someone's
-- showcase. A thanks tied to a transaction uses toy_transaction_id instead.
--
-- DOWN:
--   (restore 111's notifications_type_check and 077's notifications_one_subject)
--   alter table public.notifications drop column if exists profile_id;
--   drop function if exists public.profile_thanks_count(public.profiles);
--   drop table if exists public.profile_thanks;

create table public.profile_thanks (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  thanker_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  note text check (note is null or length(btrim(note)) between 1 and 200),
  byline text check (byline is null or length(btrim(byline)) between 1 and 60),
  show_note boolean not null default false,
  hidden_at timestamptz,
  transaction_id uuid references public.toy_transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (profile_id, thanker_id),
  constraint profile_thanks_not_self check (profile_id <> thanker_id)
);

alter table public.profile_thanks enable row level security;
create policy profile_thanks_own_read on public.profile_thanks for select to authenticated
  using (thanker_id = auth.uid());
create policy profile_thanks_thanked_read on public.profile_thanks for select to authenticated
  using (profile_id = auth.uid());
create policy profile_thanks_own_insert on public.profile_thanks for insert to authenticated
  with check (thanker_id = auth.uid());
create policy profile_thanks_own_update on public.profile_thanks for update to authenticated
  using (thanker_id = auth.uid()) with check (thanker_id = auth.uid());

-- Column grants are the second wall. anon gets nothing; a member may insert
-- only what a thanks says and edit only its words. transaction_id and hidden_at
-- are the API's, after it has checked them.
revoke all on public.profile_thanks from anon, authenticated;
grant select on public.profile_thanks to authenticated;
grant insert (profile_id, thanker_id, note, byline, show_note) on public.profile_thanks to authenticated;
grant update (note, byline, show_note) on public.profile_thanks to authenticated;

create or replace function public.profile_thanks_count(p public.profiles)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.profile_thanks where profile_id = p.id
$$;
grant execute on function public.profile_thanks_count(public.profiles) to anon, authenticated;

-- ------------------------------------------------------- notifications --

alter table public.notifications
  add column profile_id uuid references public.profiles (id) on delete cascade;

-- 046's guard, applied to one_subject for the first time: abort rather than
-- drop a subject the live constraint counts.
do $$
declare
  def  text;
  lost text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint
   where conname = 'notifications_one_subject' and conrelid = 'public.notifications'::regclass;
  if def is null then raise exception 'notifications_one_subject is absent'; end if;
  select string_agg(distinct m[1], ', ') into lost
    from regexp_matches(substring(def from 'num_nonnulls\(([^)]*)\)'), '([a-z_]+)', 'g') as m
   where m[1] not in (
     'tutorial_id', 'idea_id', 'toy_transaction_id', 'org_id', 'org_event_id', 'org_story_id',
     'org_conversation_id', 'profile_id'
   );
  if lost is not null then
    raise exception 'live notifications_one_subject counts subjects 117 would drop: %', lost;
  end if;
end $$;

alter table public.notifications drop constraint notifications_one_subject;
alter table public.notifications add constraint notifications_one_subject
  check (num_nonnulls(tutorial_id, idea_id, toy_transaction_id, org_id, org_event_id, org_story_id,
                      org_conversation_id, profile_id) = 1);

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
     'tutorial_thanked',
     'org_event_published', 'org_story_published', 'org_message', 'org_thanked',
     'tutorial_noted',
     'challenge_guide_published', 'build_question',
     'profile_thanked'
   );
  if lost is not null then
    raise exception 'live notifications_type_check permits values 117 would drop: %', lost;
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
    'org_event_published', 'org_story_published', 'org_message', 'org_thanked',
    'tutorial_noted',
    'challenge_guide_published', 'build_question',
    -- new in 117
    'profile_thanked'
  ));
