-- supabase/migrations/060_organisation_requests.sql
--
-- WHY: brief feature 12 — "request an organisation → admin approve/decline".
--      The artboard is explicit about why this exists at all: *"Leadership is
--      granted by an admin, never self-started. That is the trust model."*
--      Today an admin creates an organisation and appoints its leaders from
--      /admin/organizations, and there is no way for the people who actually
--      run one to ask. The gap is not a screen — it is that nobody can start
--      the conversation.
--
-- HOW:  one row per ask, reviewed by an admin, and approving it is what creates
--       the organisation and appoints the requester. That last part is the
--       whole design: an approval that only flips a status leaves an admin to
--       remember to do two more things by hand, and the failure mode is an
--       approved request with no organisation behind it.
--
--       So approval is a function, running as definer, doing all three writes
--       in one transaction. It is idempotent on the request's status, so a
--       double-click cannot mint two organisations.
--
--       What is asked for is deliberately narrow: who they are, what the
--       organisation does, and how an admin can check they actually work there.
--       Nothing about capabilities or printers — those are the profile editor's
--       (059), and asking for them before anybody has been verified would be
--       collecting detail about an organisation that may never exist.
--
-- DOWN: drop function public.approve_organization_request(uuid, text);
--       drop table public.organization_requests;

create table public.organization_requests (
  id uuid primary key default gen_random_uuid(),

  -- Signed-in only, "since we need to know who to verify". The requester
  -- becomes the first leader on approval, so this column is not just a byline.
  requester_id uuid not null references public.profiles (id) on delete cascade,

  org_name text not null check (length(btrim(org_name)) between 1 and 120),
  -- What the organisation does, in their words. Becomes the organisation's
  -- `description` on approval rather than being re-typed by an admin.
  what_they_do text not null check (length(btrim(what_they_do)) between 1 and 2000),

  -- How an admin checks the requester actually works there: a work email on the
  -- organisation's domain, a staff page, a phone number on a switchboard. Free
  -- text because the answer differs per organisation and a dropdown would
  -- pretend otherwise.
  verification text not null check (length(btrim(verification)) between 1 and 1000),

  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),

  -- Shown to the requester on a decline. A refusal with no reason is the thing
  -- that stops somebody asking again when they should — 037 says the same about
  -- a rejected idea.
  review_note text check (review_note is null or length(btrim(review_note)) <= 1000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  constraint organization_requests_reviewed_together check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status <> 'pending' and reviewed_at is not null)
  ),

  -- What approving it created. Null while pending or declined, and the link is
  -- what lets the requester's own screen say "here it is" rather than "approved".
  organization_id uuid references public.organizations (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One open ask per person per name. Without it a refresh on the form files the
-- same request twice and an admin reviews it twice.
create unique index organization_requests_one_open
  on public.organization_requests (requester_id, lower(btrim(org_name)))
  where status = 'pending';

create index organization_requests_queue_idx
  on public.organization_requests (created_at)
  where status = 'pending';

alter table public.organization_requests enable row level security;

create policy "Read your own organisation requests"
  on public.organization_requests for select to authenticated
  using (requester_id = auth.uid() or public.is_admin());

create policy "Ask for an organisation"
  on public.organization_requests for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');

-- Only an admin decides. Deliberately not "or requester_id = auth.uid()" with a
-- status guard: a requester who could update their own row could set it to
-- approved, and the trust model is the one thing on this table worth protecting.
create policy "Admins review organisation requests"
  on public.organization_requests for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.organization_requests is
  'Somebody asking for an organisation to exist. An admin reviews every one; approving it creates the organisation and appoints them.';

-- --------------------------------------------------------------- approval --

-- Three writes that must not come apart: the organisation, its first leader,
-- and the request's own outcome. An admin doing them by hand leaves the failure
-- mode this function exists to prevent — an approved request with nothing
-- behind it, and a person who has been told they lead something that does not
-- exist.
--
-- SECURITY DEFINER because it writes `organizations` and `org_leaders`, both of
-- which are admin-only by policy; the `is_admin()` check inside is what keeps
-- that from being a hole, and `set search_path = ''` is what makes every name
-- below unambiguous.
create or replace function public.approve_organization_request(
  p_request_id uuid,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.organization_requests;
  v_org_id uuid;
begin
  if not public.is_admin() then
    return jsonb_build_object('outcome', 'forbidden');
  end if;

  select * into v_req
  from public.organization_requests
  where id = p_request_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'missing');
  end if;
  -- Idempotent on status rather than on a lock alone: a double-click must not
  -- mint two organisations, and returning the first outcome is more useful than
  -- an error.
  if v_req.status <> 'pending' then
    return jsonb_build_object('outcome', 'already_reviewed', 'status', v_req.status,
                              'organization_id', v_req.organization_id);
  end if;

  insert into public.organizations (name, description, status, created_by)
  values (btrim(v_req.org_name), btrim(v_req.what_they_do), 'active', v_req.requester_id)
  returning id into v_org_id;

  insert into public.org_leaders (org_id, user_id)
  values (v_org_id, v_req.requester_id)
  on conflict do nothing;

  update public.organization_requests
  set status = 'approved',
      organization_id = v_org_id,
      review_note = p_note,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_request_id;

  return jsonb_build_object('outcome', 'approved', 'organization_id', v_org_id);
end;
$$;

revoke all on function public.approve_organization_request(uuid, text) from public;
grant execute on function public.approve_organization_request(uuid, text) to authenticated;
