-- WHY: The platform admin was the sole approver of every tutorial, making the
--      review queue a single-person bottleneck. A tutorial is a project; its
--      author asks organisations to back it, and a leader of any organisation
--      that accepted can approve or reject it.
-- HOW: Authority is expressed as RLS policies and one trigger rather than as
--      checks in route code, so a carelessly written future route cannot widen
--      a leader's reach. The organisation is a badge of trust, never an owner:
--      credit stays in tutorial_contributors regardless.
--      See docs/superpowers/specs/2026-07-28-project-org-collaboration-design.md

-- ============================================================
-- Tables
-- ============================================================

-- Only the admin creates organisations (decision 11), so creation IS approval
-- and there is no 'pending' state. created_by is always the admin: an audit
-- column, not an authority one. Nothing keys off it.
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The whole leader model. No status, no role, no initiated_by: only the admin
-- writes this table (decision 12), so there is no handshake to represent.
create table public.org_leaders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

-- Logs acceptance only — contains no legal text. The terms are versioned static
-- content referenced by the version string.
create table public.user_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  agreement_type text not null
    check (agreement_type in ('contributor_terms', 'org_leader_terms')),
  version text not null,
  accepted_at timestamptz not null default now()
);

-- One row per (project, organisation) request. The author creates it as
-- 'pending'; a leader of that organisation answers. Many organisations may back
-- one project (decision 19), and each answers only for itself — which is what
-- stops a contributor attaching an organisation's name without its consent.
create table public.tutorial_orgs (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid references public.tutorials on delete cascade not null,
  org_id uuid references public.organizations on delete cascade not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  responded_by uuid references public.profiles on delete set null,
  unique (tutorial_id, org_id)
);

-- reviewed_for_org_id is the organisation the approving leader acted for. It
-- earns its place twice: it makes "Approved by Sam, Riverside Therapy" exact
-- when someone leads two backing organisations, and the withdrawal freeze
-- (decision 22) keys on it.
alter table public.tutorials
  add column reviewed_by uuid references public.profiles on delete set null,
  add column reviewed_for_org_id uuid references public.organizations on delete set null;

-- ============================================================
-- Helper functions
-- ============================================================
-- All security definer for the same reason tutorial_is_approved()
-- (001_schema.sql:107) is: a policy cannot query the table it guards without
-- recursing, and a policy querying another table is silently subject to that
-- table's own policies — which would make the answer depend on visibility
-- rather than on fact.

create or replace function public.is_org_leader(p_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.org_leaders
    where org_id = p_org_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Deliberately version-agnostic: true if the user accepted ANY version of this
-- agreement type. Forcing re-acceptance on a new version is out of scope; the
-- version column keeps that option open without a migration.
create or replace function public.has_accepted(p_agreement_type text)
returns boolean as $$
  select exists (
    select 1 from public.user_agreements
    where user_id = auth.uid() and agreement_type = p_agreement_type
  );
$$ language sql security definer stable;

-- Used by the 008 tutorial_contributors INSERT policy as its retry-safety arm,
-- and by the tutorial_orgs INSERT policy to identify the author.
create or replace function public.is_tutorial_contributor(p_tutorial_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.tutorial_contributors
    where tutorial_id = p_tutorial_id and profile_id = auth.uid()
  );
$$ language sql security definer stable;

-- The leader READ grant. Includes 'pending', because reading the tutorial is
-- how a leader decides whether to accept it.
create or replace function public.tutorial_offered_to_my_org(p_tutorial_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.tutorial_orgs t_o
    join public.org_leaders l on l.org_id = t_o.org_id
    where t_o.tutorial_id = p_tutorial_id
      and t_o.status in ('pending', 'accepted')
      and l.user_id = auth.uid()
  );
$$ language sql security definer stable;

-- The leader WRITE grant, minus the terms conjunct which lives in the policy.
-- Narrower than the read grant on purpose: 'accepted' only, and the
-- organisation must be active. Suspending an organisation therefore revokes
-- every one of its leaders' review powers instantly, with no cleanup job.
create or replace function public.can_review_tutorial(p_tutorial_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.tutorial_orgs t_o
    join public.org_leaders l on l.org_id = t_o.org_id
    join public.organizations o on o.id = t_o.org_id
    where t_o.tutorial_id = p_tutorial_id
      and t_o.status = 'accepted'
      and l.user_id = auth.uid()
      and o.status = 'active'
  );
$$ language sql security definer stable;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.organizations   enable row level security;
alter table public.org_leaders     enable row level security;
alter table public.user_agreements enable row level security;
alter table public.tutorial_orgs   enable row level security;

-- ============================================================
-- tutorial_orgs — the backing handshake
-- ============================================================

-- The author asks. Always 'pending' — an author who could write 'accepted' would
-- hand an organisation's leaders authority it never agreed to, which is the
-- single thing this table exists to prevent. Draft or pending tutorials only: you
-- cannot bolt an organisation onto published work.
create policy "Authors can ask an org to back their project"
  on public.tutorial_orgs for insert
  with check (
    public.is_tutorial_contributor(tutorial_id)
    and status = 'pending'
    and exists (
      select 1 from public.tutorials t
      where t.id = tutorial_id and t.status in ('draft', 'pending')
    )
  );

-- A leader answers for their own organisation and no other. is_org_leader is
-- checked in BOTH clauses: USING sees the old row, WITH CHECK the new one, so
-- together they stop a leader moving a row to an organisation they do not lead.
-- There is deliberately no UPDATE policy for contributors — the author's only
-- powers over this row are creating it and deleting it.
create policy "Leaders can answer requests to their org"
  on public.tutorial_orgs for update
  using (public.is_org_leader(org_id))
  with check (
    public.is_org_leader(org_id)
    and status in ('accepted', 'declined')
  );

create policy "The author and the asked org can read a request"
  on public.tutorial_orgs for select
  using (
    public.is_tutorial_contributor(tutorial_id)
    or public.is_org_leader(org_id)
  );

-- The public badge query. Scoped to accepted rows on published tutorials, so a
-- pending or declined request never renders anywhere: an organisation's mark
-- appears only where one of its leaders put it.
create policy "Anyone can read accepted backing on a published project"
  on public.tutorial_orgs for select
  using (
    status = 'accepted'
    and exists (
      select 1 from public.tutorials t
      where t.id = tutorial_id and t.status = 'approved'
    )
  );

create policy "Admin full access to tutorial_orgs"
  on public.tutorial_orgs for all using (public.is_admin());

-- ============================================================
-- tutorials — the leader grants
-- ============================================================

-- tutorials — leader SELECT
-- Deliberately BROADER than the write policy: it includes 'pending' requests and
-- ignores both the organisation's status and the terms gate. A leader must be
-- able to read a project to decide whether to back it, and a suspended org's
-- leader keeps visibility into what they already took on.
-- CONSEQUENCE, stated plainly: offering a project to an organisation exposes the
-- draft to that organisation's leaders, including if they then decline. This
-- belongs in the contributor_terms text, and it is why the submit flow should
-- encourage asking one or two organisations rather than every one on the list.
create policy "Leaders can read projects offered to their org"
  on public.tutorials for select
  using (public.tutorial_offered_to_my_org(id));

-- tutorials — leader UPDATE, the review grant.
-- Both conditions live in one policy so that losing leadership, the organisation
-- being suspended, an organisation withdrawing its backing, and withdrawn consent
-- each independently revoke the capability instantly: no cache to invalidate, no
-- cleanup job to run.
-- There is NO self-review block (decision 14): a leader may approve a project they
-- authored, if an organisation they lead is backing it. The control is reactive —
-- remove the leader, suspend the organisation, or reject the tutorial, all of
-- which the admin can do at any time. That is what makes the spot-check surface
-- load-bearing rather than nice-to-have.
create policy "Backing org leaders can review the project"
  on public.tutorials for update
  using (
    public.can_review_tutorial(id)
    and public.has_accepted('org_leader_terms')
  )
  with check (
    public.can_review_tutorial(id)
    and public.has_accepted('org_leader_terms')
  );

-- ============================================================
-- Provenance trigger
-- ============================================================
-- WHY: An RLS `with check` clause sees only the NEW row, and a Postgres policy
--      cannot reference OLD. The UPDATE policy above therefore validates
--      is_org_leader(org_id) against a value the same statement is free to
--      rewrite — and says nothing at all about tutorial_id. A leader could take
--      a legitimate acceptance and repoint it at a different project, stamping
--      their organisation on work that never asked for it. Reproduced end to end
--      before this trigger existed.
-- HOW: OLD is visible in a trigger, so identity is frozen here instead. The
--      policy stays as written; this makes the columns it trusts immutable.
-- SECURITY INVOKER, the opposite of the helper functions above, and deliberately
-- so: here a row that is merely invisible must fail CLOSED. `set search_path = ''`
-- is what makes invoker safe — every name in the body is schema-qualified, so no
-- caller-controlled search_path can shadow it.
create or replace function public.tutorial_orgs_freeze_identity()
returns trigger as $$
begin
  if new.tutorial_id is distinct from old.tutorial_id
  or new.org_id is distinct from old.org_id then
    raise exception 'tutorial_id and org_id are immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql security invoker set search_path = '';

-- BEFORE UPDATE only. The INSERT path is fully governed by the author policy,
-- which pins status = 'pending' and checks authorship of the named tutorial.
create trigger tutorial_orgs_freeze_identity
  before update on public.tutorial_orgs
  for each row execute function public.tutorial_orgs_freeze_identity();
