-- 111 — Ask first: a maker's private questions before claiming a build
-- (makers-ask-first).
--
-- One thread per (request, maker). The family reads every thread on their
-- request; a maker reads their own, before and after the claim. Writing stops
-- at the claim: a maker into their own thread, the family into any thread on
-- their request (the API also requires that maker to have asked). On claim the
-- API copies the claimer's thread into toy_transaction_messages, so the build
-- thread starts with what was asked.
--
-- toy_transactions is read inside the policies as the caller: a maker who is
-- not a party sees an unclaimed build through 064's open-builds policy, which
-- is exactly the window asking is allowed in.
--
-- build_question rides on toy_transaction_id — 077's one-subject check already
-- admits it, so only the type check is recreated.
--
-- DOWN:
--   drop table if exists public.build_request_questions;
--   (restore 109's notifications_type_check)

create table public.build_request_questions (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.toy_transactions (id) on delete cascade,
  maker_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index build_request_questions_thread_idx
  on public.build_request_questions (transaction_id, maker_id, created_at);

alter table public.build_request_questions enable row level security;

create policy build_request_questions_read on public.build_request_questions for select to authenticated
  using (
    maker_id = auth.uid()
    or exists (select 1 from public.toy_transactions t where t.id = transaction_id and t.requester_id = auth.uid())
  );

create policy build_request_questions_insert on public.build_request_questions for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.toy_transactions t
       where t.id = transaction_id
         and t.type = 'build' and t.status = 'requested'
         and t.owner_id is null and t.owner_org_id is null
         and (
           (maker_id = auth.uid() and t.requester_id <> auth.uid())
           or t.requester_id = auth.uid()
         )
    )
  );

-- Supabase's default privileges hand anon and authenticated every privilege
-- on a new table (110's lesson): revoke first, so anon gets nothing and
-- authenticated only what the two policies govern.
revoke all on public.build_request_questions from anon, authenticated;
grant select, insert on public.build_request_questions to authenticated;

-- 046's guard, again.
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
     'tutorial_noted', 'challenge_guide_published',
     'build_question'
   );
  if lost is not null then
    raise exception 'live notifications_type_check permits values 111 would drop: %', lost;
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
    'tutorial_noted', 'challenge_guide_published',
    -- new in 111
    'build_question'
  ));
