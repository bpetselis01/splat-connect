-- 142 — Tell people when a hand-off they were waiting on has happened, and
-- acknowledge what they sent.
--
-- Fifteen types, in three groups (one migration so the hosted push happens once):
--   exchange outcomes: recycling_received, recycling_declined,
--     org_request_approved, org_request_declined, test_print_passed,
--     test_print_failed, handover_confirmed
--   leaders and events: leader_added, leader_removed, org_event_deleted
--   acknowledged submissions: event_rsvp_received, idea_received,
--     report_received, drop_off_booked, contact_received
--
-- Subjects. Most rows carry the subject they are about (org_id, org_event_id,
-- idea_id, member_report_id, toy_transaction_id). Two kinds have none: a
-- test-print verdict on a personal printer and a signed-in contact message.
-- notifications_one_subject demanded exactly one, so it is relaxed to at most
-- one; a row with no subject links to the inbox.
--
-- Deploy order: this must be on hosted before the API that writes these types,
-- or every insert fails the CHECK and is only logged.
--
-- DOWN:
--   (restore 138's notifications_type_check and set notifications_one_subject
--    back to = 1, after deleting the subject-less rows)

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
    raise exception 'live notifications_type_check permits values 142 would drop: %', lost;
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
    'org_event_changed', 'org_event_cancelled',
    -- new in 142
    'recycling_received', 'recycling_declined', 'org_request_approved',
    'org_request_declined', 'test_print_passed', 'test_print_failed',
    'handover_confirmed', 'leader_added', 'leader_removed',
    'org_event_deleted', 'event_rsvp_received', 'idea_received',
    'report_received', 'drop_off_booked', 'contact_received'
  ));

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
    raise exception 'live notifications_one_subject counts subjects 142 would drop: %', lost;
  end if;
end $$;

alter table public.notifications drop constraint notifications_one_subject;
alter table public.notifications add constraint notifications_one_subject
  check (num_nonnulls(tutorial_id, idea_id, toy_transaction_id, org_id, org_event_id, org_story_id,
                      org_conversation_id, profile_id, member_report_id) <= 1);
