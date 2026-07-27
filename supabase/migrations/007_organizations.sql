-- WHY: The platform admin is the sole approver of every tutorial, so the review
--      queue is a single-person bottleneck. Organisations let an approved leader
--      review their own members' submissions.
-- HOW: Authority is expressed entirely as RLS policies (below) rather than as
--      checks in route code, so a carelessly written future route cannot widen a
--      leader's reach. See docs/superpowers/specs/2026-07-28-org-delegated-review-design.md

-- ============================================================
-- Tables
-- ============================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'suspended')),
  -- Default stays 'probation' so a *pending* org never reads as trusted.
  -- Admin approval sets both status='approved' and trust_level='trusted'.
  trust_level text not null default 'probation'
    check (trust_level in ('probation', 'trusted')),
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- org_role and status are independent: ('leader', 'pending') is an invited leader
-- who has not accepted yet, and is both representable and correct. Every policy
-- must therefore check status = 'approved', never org_role = 'leader' alone.
create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  org_role text not null default 'member'
    check (org_role in ('leader', 'member')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'removed', 'declined')),
  -- Records who created a pending row, so the *other* party is the one required
  -- to act on it. Neither party can complete a membership alone.
  initiated_by text not null
    check (initiated_by in ('contributor', 'org')),
  invited_by uuid references public.profiles on delete set null,
  -- created_at orders the leader's pending-request queue; joined_at is null until
  -- the membership is actually approved, so it cannot serve that purpose.
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  unique (org_id, user_id)
);

-- Logs acceptance only — contains no legal text. The terms themselves are
-- versioned static content referenced by the version string.
create table public.user_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  agreement_type text not null
    check (agreement_type in ('contributor_terms', 'org_leader_terms')),
  version text not null,
  accepted_at timestamptz not null default now()
);

-- org_id is a snapshot taken at submit time, not a live lookup: review authority
-- must not become retroactive or be revocable by a later membership change.
-- null org_id routes the tutorial to the platform queue.
alter table public.tutorials
  add column org_id uuid references public.organizations on delete set null,
  add column review_level text check (review_level in ('org', 'platform')),
  add column reviewed_by uuid references public.profiles on delete set null,
  add column flagged_for_follow_up boolean not null default false;

create index on public.org_members (org_id, status);
create index on public.org_members (user_id);
create index on public.tutorials (org_id) where org_id is not null;

-- ============================================================
-- Helper functions
-- ============================================================
-- All four are SECURITY DEFINER for the same reason tutorial_is_approved()
-- (001_schema.sql:107) is: a policy cannot query the table it guards without
-- recursing, and a policy that queries another table is silently subject to that
-- table's own policies — which would make the answer depend on visibility rather
-- than on fact.

-- Bakes in status = 'approved' so no policy can check leadership half-right.
create or replace function public.is_org_leader(p_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id
      and user_id = auth.uid()
      and org_role = 'leader'
      and status = 'approved'
  );
$$ language sql security definer stable;

-- Deliberately version-agnostic: true if the user accepted ANY version of this
-- agreement type. Forcing re-acceptance on a new version is out of scope; the
-- version column exists so that decision stays available without a migration.
create or replace function public.has_accepted(p_agreement_type text)
returns boolean as $$
  select exists (
    select 1 from public.user_agreements
    where user_id = auth.uid() and agreement_type = p_agreement_type
  );
$$ language sql security definer stable;

-- Used only by the founder-bootstrap policy, which must ask "does this org
-- already have a leader?" from inside an org_members policy.
create or replace function public.org_has_approved_leader(p_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id and org_role = 'leader' and status = 'approved'
  );
$$ language sql security definer stable;

-- The self-review block. MUST be security definer: as a plain EXISTS inside the
-- tutorials policy this would run under tutorial_contributors' own RLS, so a row
-- that was merely *invisible* would make NOT EXISTS true and GRANT self-review.
create or replace function public.is_tutorial_contributor(p_tutorial_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.tutorial_contributors
    where tutorial_id = p_tutorial_id and profile_id = auth.uid()
  );
$$ language sql security definer stable;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.organizations   enable row level security;
alter table public.org_members     enable row level security;
alter table public.user_agreements enable row level security;

-- organizations
create policy "Anyone can read approved organizations"
  on public.organizations for select using (status = 'approved');

create policy "Creator can read own organization at any status"
  on public.organizations for select using (created_by = auth.uid());

create policy "Admin can read all organizations"
  on public.organizations for select using (public.is_admin());

create policy "Contributors who accepted leader terms can create organizations"
  on public.organizations for insert
  with check (
    created_by = auth.uid()
    and public.is_approved_contributor()
    and public.has_accepted('org_leader_terms')
    and status = 'pending'
    and trust_level = 'probation'
  );

-- UPDATE is admin-only, and that is the whole point: it keeps status and
-- trust_level out of a leader's reach. A leader can never promote their own org
-- out of probation or un-suspend it.
create policy "Admin can update organizations"
  on public.organizations for update using (public.is_admin());

-- user_agreements
-- No UPDATE and no DELETE policy: an acceptance record that can be edited is not
-- a record.
create policy "Users can read own agreements"
  on public.user_agreements for select using (user_id = auth.uid());

create policy "Users can record own agreements"
  on public.user_agreements for insert with check (user_id = auth.uid());

create policy "Admin can read all agreements"
  on public.user_agreements for select using (public.is_admin());

-- org_members
create policy "Members can read own memberships"
  on public.org_members for select using (user_id = auth.uid());

create policy "Leaders can read their org roster"
  on public.org_members for select using (public.is_org_leader(org_id));

create policy "Admin can read all memberships"
  on public.org_members for select using (public.is_admin());

-- Founder bootstrap. Without this the design deadlocks: the invite policy needs
-- is_org_leader(org_id), which is false for a brand-new org, so no first leader
-- could ever exist. Scoped to the creator of an org that has no approved leader
-- yet, so it grants exactly one membership per org and nothing else.
create policy "Org creator can claim first leadership"
  on public.org_members for insert
  with check (
    user_id = auth.uid()
    and org_role = 'leader'
    and status = 'approved'
    and initiated_by = 'org'
    and not public.org_has_approved_leader(org_id)
    and exists (
      select 1 from public.organizations o
      where o.id = org_id and o.created_by = auth.uid()
    )
  );

-- A contributor asks to join. They may only ever create their own row, as a
-- member, pending. You cannot request to join *as a leader*.
create policy "Contributors can request to join an org"
  on public.org_members for insert
  with check (
    user_id = auth.uid()
    and initiated_by = 'contributor'
    and status = 'pending'
    and org_role = 'member'
    and public.is_approved_contributor()
  );

-- A leader invites someone. Always lands pending — a leader can never move an
-- 'org'-initiated row straight to approved, because that would let an org claim
-- someone who never agreed.
create policy "Leaders can invite contributors"
  on public.org_members for insert
  with check (
    public.is_org_leader(org_id)
    and initiated_by = 'org'
    and status = 'pending'
    and invited_by = auth.uid()
    and exists (
      select 1 from public.organizations o
      where o.id = org_id and o.status = 'approved'
    )
  );

-- Leader side of the handshake: may resolve requests the CONTRIBUTOR initiated,
-- may remove an approved member, may revive a dead row so one accidental decline
-- does not lock someone out of an org permanently.
create policy "Leaders can resolve contributor-initiated memberships"
  on public.org_members for update
  using (public.is_org_leader(org_id))
  with check (
    public.is_org_leader(org_id)
    and (
      (initiated_by = 'contributor' and status in ('approved', 'declined'))
      or status = 'removed'
      or status = 'pending'
    )
  );

-- Contributor side: may resolve only invitations the ORG initiated, only on
-- their own row.
create policy "Contributors can resolve org-initiated invitations"
  on public.org_members for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and initiated_by = 'org'
    and status in ('approved', 'declined')
  );

create policy "Admin full access to org_members"
  on public.org_members for all using (public.is_admin());

-- tutorials — leader SELECT
-- Load-bearing and deliberately BROADER than the write policy below: it ignores
-- trust_level and the self-review block. If read tracked write, a probation org's
-- leader would see an empty queue and a suspended org's leader would lose all
-- visibility into their own roster's history. Authority is gated separately.
-- CONSEQUENCE, stated plainly: a leader can read their org members' unpublished
-- drafts. This belongs in the contributor_terms text and is why the join
-- handshake must be a genuine two-sided opt-in.
create policy "Leaders can read their org's tutorials"
  on public.tutorials for select using (
    org_id is not null and public.is_org_leader(org_id)
  );

-- tutorials — leader UPDATE
-- All three conditions live in one policy so that suspension, demotion to
-- probation, and self-review each independently revoke the capability instantly:
-- no cache to invalidate, no cleanup job to run.
create policy "Trusted org leaders can review their org's tutorials"
  on public.tutorials for update
  using (
    org_id is not null
    and public.is_org_leader(org_id)
    and exists (
      select 1 from public.organizations o
      where o.id = org_id
        and o.status = 'approved'
        and o.trust_level = 'trusted'
    )
    and not public.is_tutorial_contributor(id)
  )
  with check (
    org_id is not null
    and public.is_org_leader(org_id)
    and exists (
      select 1 from public.organizations o
      where o.id = org_id
        and o.status = 'approved'
        and o.trust_level = 'trusted'
    )
    and not public.is_tutorial_contributor(id)
  );

-- ============================================================
-- Provenance triggers
-- ============================================================
-- WHY: An RLS `with check` clause sees only the NEW row, and a Postgres policy
--      cannot reference OLD. Every policy above that gates on `initiated_by` is
--      therefore forgeable: a caller permitted to update the row at all can
--      rewrite the very column the check tests, in the same statement. Verified
--      exploitable — a plain contributor could file a join request, self-promote
--      to approved leader in one UPDATE, and publish another member's tutorial.
-- HOW: OLD is visible in a trigger, so provenance is frozen here instead. The
--      policies stay as written; this makes the columns they trust immutable.
-- Both triggers below are SECURITY INVOKER, the opposite of the helper functions
-- above, and deliberately so: here a row that is merely *invisible* fails CLOSED
-- (the `not exists` stays true and the guard raises), whereas in
-- is_tutorial_contributor() an invisible row fails OPEN and would grant
-- self-review. `set search_path = ''` is what makes invoker safe — every name in
-- these bodies is schema-qualified, so no caller-controlled search_path can
-- shadow them.
create or replace function public.org_members_freeze_provenance()
returns trigger as $$
begin
  if new.org_id is distinct from old.org_id
  or new.user_id is distinct from old.user_id
  or new.initiated_by is distinct from old.initiated_by then
    raise exception 'org_id, user_id and initiated_by are immutable'
      using errcode = '42501';
  end if;
  -- Without this a leader could mint co-leaders by setting org_role while
  -- approving a join request. Multiple leaders are supported by the schema, but
  -- promotion is an admin decision.
  if new.org_role is distinct from old.org_role and not public.is_admin() then
    raise exception 'org_role may only be changed by an admin'
      using errcode = '42501';
  end if;
  -- Removal is the only membership control a leader has, and the contributor
  -- UPDATE policy accepts any transition to 'approved' on an 'org'-initiated
  -- row — so without this the removed party could simply undo their own
  -- removal. The leader's revive path (removed -> pending, contributor then
  -- accepts) is unaffected.
  if old.status = 'removed' and new.status is distinct from 'removed'
     and not public.is_org_leader(old.org_id) and not public.is_admin() then
    raise exception 'a removed membership can only be restored by an org leader'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql security invoker set search_path = '';

-- BEFORE UPDATE only. The founder-bootstrap INSERT policy legitimately writes
-- org_role='leader', so an INSERT trigger here would deadlock org creation.
create trigger org_members_freeze_provenance
  before update on public.org_members
  for each row execute function public.org_members_freeze_provenance();

-- WHY: tutorials.org_id decides which org's leaders hold review authority over a
--      row, but no policy constrains it — a contributor could route their own
--      draft into any trusted org's queue, or two cooperating leaders could
--      cross-approve each other's work and skip platform review entirely.
-- HOW: An org may only be set if the caller is an approved member of it, and
--      only at the moment it is set. The membership is re-checked on INSERT and
--      on an UPDATE that actually changes org_id, never on unrelated writes:
--      org_id is a snapshot taken when the tutorial is routed (see line 61), so
--      re-validating it on every later write would make a membership change
--      retroactively revoke the author's ability to edit their own work — a
--      leader could set a member to 'removed' and thereby freeze that member's
--      existing tutorials. Change-gating is also why no service-role escape is
--      needed: what tripped the admin client was
--      PATCH /api/admin/tutorials/:id/status updating an already-pinned row,
--      which no longer re-runs the membership test. Enforcement therefore stays
--      in the database, per the header comment at the top of this file.
--      This does not obstruct review: a leader is by definition an approved member.
create or replace function public.tutorials_org_must_be_own()
returns trigger as $$
begin
  if new.org_id is not null
     and (tg_op = 'INSERT' or new.org_id is distinct from old.org_id)
     and not public.is_admin()
     and not exists (
       select 1 from public.org_members m
       where m.org_id = new.org_id and m.user_id = auth.uid() and m.status = 'approved'
     ) then
    raise exception 'cannot route a tutorial to an organisation you are not an approved member of'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql security invoker set search_path = '';

create trigger tutorials_org_must_be_own
  before insert or update on public.tutorials
  for each row execute function public.tutorials_org_must_be_own();
