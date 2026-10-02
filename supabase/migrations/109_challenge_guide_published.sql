-- 109 — tell the people following a challenge when its guide is published
-- (challenge-writeup-stage).
--
-- "Follow the write-up" saves the challenge (044). When the guide a challenge
-- graduated into is approved, every account that saved the challenge gets
-- challenge_guide_published — except the guide's own contributors, who get
-- tutorial_approved already, and anyone told before (a guide can go back to
-- review after an edit and be approved again).
--
-- A trigger, not route code: a guide is approved by an admin (admin.ts) or by
-- a backing organisation's leader under their own JWT (tutorial-orgs.ts), and
-- this is the one place both pass through. SECURITY DEFINER because the
-- leader's session can read neither other people's saves (044) nor write
-- their notifications.
--
-- Subject: tutorial_id, title in tutorial_title — 077's one-subject check
-- already admits it, so only the type check is recreated.
--
-- DOWN:
--   drop trigger if exists tutorials_challenge_guide_published on public.tutorials;
--   drop function if exists public.notify_challenge_guide_published();
--   (restore 093's notifications_type_check)

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
     'tutorial_thanked',
     'org_event_published', 'org_story_published', 'org_message', 'org_thanked',
     'tutorial_noted',
     'challenge_guide_published'
   );
  if lost is not null then
    raise exception 'live notifications_type_check permits values 109 would drop: %', lost;
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
    -- new in 109
    'challenge_guide_published'
  ));

create or replace function public.notify_challenge_guide_published()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, type, tutorial_id, tutorial_title, actor_name)
  select distinct s.profile_id, 'challenge_guide_published', new.id, new.title, 'SPLAT'
    from public.toy_ideas i
    join public.saves s on s.entity_type = 'challenge' and s.entity_id = i.id
   where i.tutorial_id = new.id
     and not exists (
       select 1 from public.tutorial_contributors c
        where c.tutorial_id = new.id and c.profile_id = s.profile_id)
     and not exists (
       select 1 from public.notifications n
        where n.recipient_id = s.profile_id and n.type = 'challenge_guide_published' and n.tutorial_id = new.id);
  return new;
end
$$;

revoke execute on function public.notify_challenge_guide_published() from public, anon, authenticated;

create trigger tutorials_challenge_guide_published
  after update of status on public.tutorials
  for each row
  when (new.status = 'approved' and old.status is distinct from 'approved')
  execute function public.notify_challenge_guide_published();
