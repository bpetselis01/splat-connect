-- supabase/migrations/057_build_requests.sql
--
-- WHY: brief feature 5 is `/dashboard/exchanges/build/[id]` — "the exchange
--      thread with one extra stage: the maker posts a working shot and the
--      family approves it before handover". A build request is a family asking
--      somebody to make them an adapted toy from a published guide.
--
--      Nothing models it. `toy_ideas` is the design-challenge pipeline, which
--      ends at a published brief; `/get-involved/requests` has been a
--      ComingSoon placeholder since the public site scaffold.
--
-- HOW:  a build IS a toy transaction. Two parties, a thread, an accept, two
--       handover codes, a cost panel and a completed state — every one of those
--       already exists on `toy_transactions` with its policies, its notification
--       plumbing, its message table and its RLS. A second table would fork all
--       of it to gain a different subject line.
--
--       So the subject becomes polymorphic rather than the record: a donation or
--       an exchange is about a `toy`, a build is about a `tutorial` plus the
--       brief the family wrote. The saves subsystem (044) set the precedent for
--       one table carrying more than one subject in this codebase.
--
--       The extra stage is two columns, not two statuses. `working_photo_url`
--       says the maker has posted a shot; `work_approved_at` says the family
--       accepted it. Deriving the rail from those keeps the existing status
--       vocabulary intact — the alternative, adding `built` and `approved` to
--       the status check, would mean every `status = 'accepted'` predicate in
--       the API silently stops matching a live build.
--
-- DOWN: alter table public.toy_transactions
--         drop constraint toy_transactions_subject,
--         drop constraint toy_transactions_approval_needs_shot,
--         drop column work_approved_at, drop column working_photo_url,
--         drop column build_brief, drop column tutorial_id;
--       (then restore the two-member type check and `toy_id set not null`,
--        which only succeeds once every build row is gone)
--       delete from storage.buckets where id = 'build-shots';

-- ------------------------------------------------------------- the subject --

-- A build has no toy: the maker makes one. The column stays for donations and
-- exchanges, where it is still required — see the shape constraint below.
alter table public.toy_transactions
  alter column toy_id drop not null;

alter table public.toy_transactions
  -- restrict, not cascade: a guide with live builds against it must not vanish
  -- and take the record of who built what with it.
  add column tutorial_id uuid references public.tutorials (id) on delete restrict,
  -- What the family asked for, in their words. The guide says what is being
  -- made; this says who it is for and what it has to do.
  add column build_brief text,
  -- A storage path in the private `build-shots` bucket, never a URL — same rule
  -- as 056's receipts.
  add column working_photo_url text,
  add column work_approved_at timestamptz;

comment on column public.toy_transactions.working_photo_url is
  'The maker''s photo of the finished build working. Set once the maker posts it; the family approves it before anyone travels.';

alter table public.toy_transactions
  drop constraint toy_transactions_type_check;

alter table public.toy_transactions
  add constraint toy_transactions_type_check
  check (type in ('donation', 'exchange', 'build'));

-- One shape per type, stated once. Without this a build could carry a toy_id
-- and a donation could carry a build_brief, and every read would have to guess
-- which of the two subjects it was looking at.
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
      else
        toy_id is not null
        and tutorial_id is null
        and build_brief is null
        and working_photo_url is null
        and work_approved_at is null
    end
  );

-- Approving a shot nobody posted is the state that makes the rail lie: it would
-- render "approved by the family" over a step that never happened.
alter table public.toy_transactions
  add constraint toy_transactions_approval_needs_shot
  check (work_approved_at is null or working_photo_url is not null);

create index toy_transactions_tutorial_idx
  on public.toy_transactions (tutorial_id)
  where tutorial_id is not null;

-- ----------------------------------------------------------- working shots --

-- Private, and gated exactly like 056's receipts: the path is
-- <transaction_id>/<file>, so the first folder segment is the exchange whose
-- parties may read it. A working shot is a photograph taken inside somebody's
-- home often enough that the public photo buckets are the wrong precedent.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'build-shots', 'build-shots', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "Parties read their own build shots"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'build-shots'
    and public.is_toy_transaction_party(((storage.foldername(name))[1])::uuid)
  );

create policy "Parties upload their own build shots"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'build-shots'
    and public.is_toy_transaction_party(((storage.foldername(name))[1])::uuid)
  );

create policy "Parties replace their own build shots"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'build-shots'
    and public.is_toy_transaction_party(((storage.foldername(name))[1])::uuid)
  );

create policy "Parties remove their own build shots"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'build-shots'
    and public.is_toy_transaction_party(((storage.foldername(name))[1])::uuid)
  );

-- --------------------------------------------------------- notifications --

-- 046's guard, for the same reason it gave: this constraint is replaced rather
-- than extended, so a value added to the live database between then and now
-- would be dropped silently and the insert that used it would start failing.
do $$
declare
  lost text;
begin
  -- Every literal the live constraint permits, pulled out by pattern rather
  -- than by trimming the ends off the expression. 046 trimmed, and its regex no
  -- longer matches the shape Postgres prints today — it left a stray ']))' on
  -- the last value and reported it as about to be lost. Matching the quoted
  -- literals cannot drift that way.
  select string_agg(v, ', ') into lost
  from (
    select (regexp_matches(pg_get_constraintdef(oid), '''([^'']+)''::text', 'g'))[1] as v
    from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and conname = 'notifications_type_check'
  ) t
  where v not in (
    'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
    'collaborator_removed', 'collaborator_left',
    'tutorial_approved', 'tutorial_rejected',
    'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message',
    'idea_approved', 'idea_rejected',
    'challenge_joined', 'challenge_left', 'challenge_removed',
    'idea_graduated',
    'backing_requested', 'tutorial_submitted'
  );

  if lost is not null then
    raise exception
      'live notifications_type_check permits values this migration would drop: %. '
      'Add them to the list in 057 before running it.', lost;
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
    'idea_graduated',
    'backing_requested', 'tutorial_submitted',
    -- new in 057: the two ends of the build's extra stage
    'build_shot_posted', 'build_approved'
  ));

-- ------------------------------------------------------------- accepting --

-- 033's accept locks the toy row and counts accepted handoffs against its
-- quantity. A build has no toy, so that lookup found nothing and the whole
-- accept returned `missing` — a maker taking one on would be told the request
-- does not exist.
--
-- Everything else in the function is unchanged, including the lock: the stock
-- check is skipped only where there is no stock to check. There is no capacity
-- to police on a build, because the maker is making the thing.
create or replace function public.accept_toy_transaction(
  p_transaction_id uuid,
  p_owner_code text,
  p_requester_code text,
  p_pickup_line1 text default null,
  p_pickup_suburb text default null,
  p_pickup_state text default null,
  p_pickup_postcode text default null
) returns jsonb as $$
declare
  v_tx public.toy_transactions;
  v_quantity integer;
  v_accepted integer;
  v_line1 text;
  v_suburb text;
  v_state text;
  v_postcode text;
  v_instructions text;
  v_updated public.toy_transactions;
begin
  select * into v_tx from public.toy_transactions where id = p_transaction_id;
  if not found then
    return jsonb_build_object('outcome', 'missing');
  end if;
  if v_tx.status <> 'requested' then
    return jsonb_build_object('outcome', 'closed');
  end if;

  if v_tx.toy_id is not null then
    -- The lock. Everything below reads a stock figure nobody else can move
    -- until this transaction commits.
    select t.quantity into v_quantity
    from public.toys t where t.id = v_tx.toy_id
    for update;
    if not found then
      return jsonb_build_object('outcome', 'missing');
    end if;

    select count(*) into v_accepted
    from public.toy_transactions t
    where t.toy_id = v_tx.toy_id and t.status = 'accepted';

    if v_accepted >= v_quantity then
      return jsonb_build_object('outcome', 'full');
    end if;
  end if;

  if v_tx.owner_org_id is not null then
    select o.pickup_line1, o.pickup_suburb, o.pickup_state, o.pickup_postcode, o.pickup_instructions
      into v_line1, v_suburb, v_state, v_postcode, v_instructions
    from public.organizations o where o.id = v_tx.owner_org_id;

    -- A half-filled address is not a place to meet, and an org that has not set
    -- one cannot hand anything over. Reported distinctly so the leader is told
    -- what to fix rather than shown a constraint violation.
    if v_line1 is null or v_suburb is null or v_state is null or v_postcode is null then
      return jsonb_build_object('outcome', 'no_org_pickup');
    end if;
  else
    v_line1 := p_pickup_line1;
    v_suburb := p_pickup_suburb;
    v_state := p_pickup_state;
    v_postcode := p_pickup_postcode;
  end if;

  update public.toy_transactions
  set status = 'accepted',
      owner_code = p_owner_code,
      requester_code = p_requester_code,
      pickup_line1 = v_line1,
      pickup_suburb = v_suburb,
      pickup_state = v_state,
      pickup_postcode = v_postcode,
      pickup_instructions = v_instructions,
      updated_at = now()
  where id = p_transaction_id and status = 'requested'
  returning * into v_updated;

  if not found then
    return jsonb_build_object('outcome', 'closed');
  end if;

  return jsonb_build_object('outcome', 'accepted', 'transaction', to_jsonb(v_updated));
end;
$$ language plpgsql security invoker set search_path = '';
