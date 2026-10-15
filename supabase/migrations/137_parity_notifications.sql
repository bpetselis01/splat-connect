-- 137 — Three notification types for the web/mobile parity work.
--
-- backing_accepted / backing_declined: an organisation answered a request to
-- back a guide; the family that asked is told (subject: tutorial_id, actor_name
-- is the organisation). report_resolved: a member report was looked at; the
-- reporter is told (subject: the new member_report_id, actor_name 'SPLAT').
--
-- Deploy order: this must be on hosted before the API that writes these types,
-- or every insert fails the CHECK and is only logged.
--
-- DOWN:
--   (restore 117's notifications_type_check and notifications_one_subject)
--   alter table public.notifications drop column if exists member_report_id;

-- ------------------------------------------------------- notifications --

alter table public.notifications
  add column member_report_id uuid references public.member_reports (id) on delete cascade;

-- 117's guard: abort rather than
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
     'org_conversation_id', 'profile_id', 'member_report_id'
   );
  if lost is not null then
    raise exception 'live notifications_one_subject counts subjects 137 would drop: %', lost;
  end if;
end $$;

alter table public.notifications drop constraint notifications_one_subject;
alter table public.notifications add constraint notifications_one_subject
  check (num_nonnulls(tutorial_id, idea_id, toy_transaction_id, org_id, org_event_id, org_story_id,
                      org_conversation_id, profile_id, member_report_id) = 1);

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
     'profile_thanked',
     'backing_accepted', 'backing_declined', 'report_resolved'
   );
  if lost is not null then
    raise exception 'live notifications_type_check permits values 137 would drop: %', lost;
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
    'profile_thanked',
    -- new in 137
    'backing_accepted', 'backing_declined', 'report_resolved'
  ));
