-- ============================================================
-- 084 · Leaders invite co-leaders; stepping down is atomic
-- ============================================================
-- A leader can hand over leadership themselves (before this only an admin
-- could, which left a sole leader unable to delete their account — Spec B).
--
-- Invites, not direct adds: leaders are public on the organisation's page, so
-- nobody becomes one without saying yes. Service role only — the API checks
-- that the inviter leads the organisation and that the invitee is the caller.
create table public.org_leader_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  invited_profile_id uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, invited_profile_id)
);
alter table public.org_leader_invites enable row level security;
-- No policies: only the service role reads or writes invites.

-- Stepping down, never leaving the organisation leaderless. The row lock on
-- the organisation serialises this against a co-leader stepping down, or
-- deleting their account (083's delete_account takes the same lock), at the
-- same moment — both would otherwise see "someone else leads" and both go.
create or replace function public.step_down_as_leader(org uuid, uid uuid)
returns text
language plpgsql security definer set search_path = public
as $$
begin
  perform 1 from organizations where id = org for update;
  if not exists (select 1 from org_leaders where org_id = org and user_id = uid) then
    return 'not_leader';
  end if;
  if not exists (select 1 from org_leaders where org_id = org and user_id <> uid) then
    return 'last_leader';
  end if;
  delete from org_leaders where org_id = org and user_id = uid;
  return 'ok';
end;
$$;

revoke all on function public.step_down_as_leader(uuid, uuid) from public, anon, authenticated;
grant execute on function public.step_down_as_leader(uuid, uuid) to service_role;
