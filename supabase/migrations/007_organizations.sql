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
