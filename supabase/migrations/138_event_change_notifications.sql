-- 138 — Tell the people registered for an event when it moves or is cancelled.
--
-- org_event_changed: a published event's date, time or place changed after
-- people registered. org_event_cancelled: it was cancelled. Both go to every
-- active registration with an account (subject: org_event_id, actor_name is the
-- organisation, the event title rides in tutorial_title as for
-- org_event_published).
--
-- Deploy order: this must be on hosted before the API that writes these types,
-- or every insert fails the CHECK and is only logged.
--
-- DOWN:
--   (restore 137's notifications_type_check)

-- ------------------------------------------------------- notifications --

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
     'backing_accepted', 'backing_declined', 'report_resolved',
     'org_event_changed', 'org_event_cancelled'
   );
  if lost is not null then
    raise exception 'live notifications_type_check permits values 138 would drop: %', lost;
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
    'backing_accepted', 'backing_declined', 'report_resolved',
    -- new in 138
    'org_event_changed', 'org_event_cancelled'
  ));
