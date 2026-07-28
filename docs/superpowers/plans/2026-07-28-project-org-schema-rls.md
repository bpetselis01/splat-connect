# Project–Organisation Schema & RLS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans` to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Spec:** `docs/superpowers/specs/2026-07-28-project-org-collaboration-design.md`

**Goal:** Replace the membership model with per-project organisation backing, so
an author offers a tutorial to one or more organisations and a leader of any that
accepted can approve or reject it — enforced entirely by PostgreSQL.

**Architecture:** `007_organizations.sql` is unmerged and is rewritten in place:
four tables, five `SECURITY DEFINER` helpers, policies, one trigger. `008` has its
provenance trigger narrowed to the surviving columns. Tests talk to the database
through an RLS-respecting client, so they assert on policies rather than route
logic; no API routes exist at the end of this plan.

**Tech Stack:** PostgreSQL 15 (Supabase local), RLS policies, `plpgsql` triggers,
Vitest 2, `@supabase/supabase-js` v2, TypeScript 5.

## Global Constraints

- Work on `feat/org-accounts-schema-rls` in `.worktrees/org-accounts-schema-rls`,
  **not** the main checkout — another agent may hold it on a different branch.
- `007` is unmerged, so it is **rewritten in place**. Do not add a `009`.
- Every migration edit needs `npx supabase db reset` before tests run. Editing the
  file changes nothing in the running database.
- Reach local Supabase at `127.0.0.1`, never `localhost` — an Android emulator can
  bind `::1:54321` and shadow it.
- Tests assert through a **user client** (`createUserClient(token)`). Service role
  bypasses RLS entirely, so a test written that way asserts nothing about a
  policy. Service role is for fixture setup and ground-truth reads only.
- An RLS `USING` block matches **zero rows and returns no error**. A `WITH CHECK`
  block returns **`42501`**. A trigger raises `42501` too. Assert on whichever the
  rule under test actually produces, and assert on both `error` and the row count
  — PostgREST nulls `data` whenever `error` is set.
- Helpers that a policy calls are `security definer stable`, so they answer a
  question of fact rather than one about the caller's visibility. Triggers are
  `security invoker set search_path = ''`, so an invisible row fails **closed**.
- Integration tests run serially against one shared database. Hoist anything a
  test creates to a module variable so `afterAll` cleans it up when an assertion
  throws.
- Commit messages end with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- One concern per commit. Where a task changes the migration and a test together,
  they commit together so every commit is green.

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/007_organizations.sql` | **Rewrite.** All four tables, helpers, policies, one trigger. Single file because policies are meaningless without their tables. |
| `supabase/migrations/008_tutorial_contributor_scope.sql` | **Modify.** Narrow `tutorials_freeze_review_provenance` to the surviving columns. |
| `packages/types/src/index.ts` | **Modify.** New org/backing types; delete the membership ones. |
| `packages/api/tests/helpers/orgs.ts` | **Rewrite.** Fixture builders for the new model. |
| `packages/api/tests/integration/orgs/backing-handshake.test.ts` | **Create.** Who may request, accept, decline. The forge test lives here. |
| `packages/api/tests/integration/orgs/review-grant.test.ts` | **Create.** Who may approve: accepted backing, active org, terms. |
| `packages/api/tests/integration/orgs/collaboration.test.ts` | **Create.** Two orgs, first-to-act wins, badge visibility. |
| `packages/api/tests/integration/orgs/withdrawal.test.ts` | **Create.** Deletion and the freeze rule. |
| `packages/api/tests/integration/orgs/admin-authority.test.ts` | **Create.** Only the admin writes orgs and leaders. |
| `packages/api/tests/integration/orgs/read-grant.test.ts` | **Create.** Leader draft visibility. |
| `packages/web/tests/unit/**` (5 files) | **Modify.** Tutorial fixture fields. |
| `supabase/SCHEMA.md` | **Modify.** Living reference. |

**Deleted:** `membership-handshake.test.ts`, `suspension.test.ts`,
`review-revocation.test.ts`, `tutorial-read-grant.test.ts`,
`tutorial-review-grant.test.ts`. Their coverage is redistributed above.
`contributor-claim.test.ts` survives — it covers 008, which is unchanged in
substance.

Test files are split by *what they prove*, so a failure name says which
guarantee broke.

**Spec §5 tests 15 and 16 are deliberately not in this plan.** Both assert route
behaviour — that `PATCH /api/tutorials/:id` refuses `status: 'approved'`, and that
an admin can reject a tutorial a leader published. No routes exist at the end of
this plan, so they belong to the API plan that follows it. Every other numbered
test in §5 maps to a task above.

---

## Task 1: Tables, helpers, and types

No behaviour yet, so no policy test. Verified by the migration applying and the
type layer compiling.

**Files:**
- Modify: `supabase/migrations/007_organizations.sql` (rewrite lines 1–123, the
  table and helper sections)
- Modify: `packages/types/src/index.ts`

**Interfaces:**
- Produces: tables `organizations`, `org_leaders`, `user_agreements`,
  `tutorial_orgs`; columns `tutorials.reviewed_by`,
  `tutorials.reviewed_for_org_id`; functions `is_org_leader(uuid) → boolean`,
  `has_accepted(text) → boolean`, `is_tutorial_contributor(uuid) → boolean`,
  `tutorial_offered_to_my_org(uuid) → boolean`,
  `can_review_tutorial(uuid) → boolean`. Every later task consumes these.

- [ ] **Step 1: Replace the header and table section of `007`**

  Replace everything from the top of the file through the end of the helper
  functions (currently line 123, ending at the `is_tutorial_contributor` body)
  with:

  ```sql
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
  ```

- [ ] **Step 2: Delete the old policy, trigger, and RLS sections**

  Everything below the helpers in `007` — every `create policy`, both
  `create or replace function ..._freeze_provenance` / `tutorials_org_must_be_own`
  bodies, and both `create trigger` statements — is deleted. Keep only the three
  `alter table ... enable row level security` lines, and extend them:

  ```sql
  -- ============================================================
  -- Row Level Security
  -- ============================================================

  alter table public.organizations   enable row level security;
  alter table public.org_leaders     enable row level security;
  alter table public.user_agreements enable row level security;
  alter table public.tutorial_orgs   enable row level security;
  ```

  Policies are added in Tasks 3–7, each alongside the test that proves it.

- [ ] **Step 3: Narrow the 008 provenance trigger**

  In `supabase/migrations/008_tutorial_contributor_scope.sql`, replace the body of
  `tutorials_freeze_review_provenance`. It currently guards `review_level`,
  `reviewed_by` and `flagged_for_follow_up`, two of which no longer exist, and
  identifies a leader via `tutorials.org_id`, which no longer exists either:

  ```sql
  create or replace function public.tutorials_freeze_review_provenance()
  returns trigger as $$
  begin
    if (case tg_op
          when 'INSERT' then new.reviewed_by is not null
                            or new.reviewed_for_org_id is not null
          else new.reviewed_by is distinct from old.reviewed_by
            or new.reviewed_for_org_id is distinct from old.reviewed_for_org_id
        end)
       and not public.is_admin()
       and not public.can_review_tutorial(new.id)
    then
      raise exception 'reviewed_by and reviewed_for_org_id may only be written by an admin or a backing org leader'
        using errcode = '42501';
    end if;
    return new;
  end;
  $$ language plpgsql security invoker set search_path = '';
  ```

  Also update the `WHY` comment above it to name the two surviving columns, and
  the header comment at lines 1–13, whose exploit narrative refers to
  `tutorials.org_id` and the removed self-review guard:

  ```sql
  -- WHY: The tutorial_contributors INSERT policy (001_schema.sql:204) constrained
  --      only profile_id, so any approved contributor could attach themselves to
  --      any tutorial — including a stranger's private draft. Harmless-looking
  --      until delegated review existed; combined with the leader review grant it
  --      became a path to PUBLISHING someone else's unsubmitted work: self-attach,
  --      ask an organisation you lead to back it, accept your own request, approve.
  --      Reproduced end to end. With no self-review block (decision 14) a single
  --      leader can do the whole chain alone, so this policy is the only thing
  --      standing there.
  ```

- [ ] **Step 4: Replace the org types**

  In `packages/types/src/index.ts`, delete `OrgTrustLevel`, `OrgRole`,
  `OrgMemberStatus`, `InitiatedBy`, `ReviewLevel` and the `OrgMember` interface.
  Replace with:

  ```typescript
  export type OrgStatus = 'active' | 'suspended'
  export type TutorialOrgStatus = 'pending' | 'accepted' | 'declined'
  export type AgreementType = 'contributor_terms' | 'org_leader_terms'

  export interface Organization {
    id: string
    name: string
    description: string | null
    status: OrgStatus
    created_by: string | null
    created_at: string
    updated_at: string
  }

  export interface OrgLeader {
    id: string
    org_id: string
    user_id: string
    created_at: string
    organizations?: Organization
  }

  /** One organisation's answer to one project. */
  export interface TutorialOrg {
    id: string
    tutorial_id: string
    org_id: string
    status: TutorialOrgStatus
    requested_at: string
    responded_at: string | null
    responded_by: string | null
    organizations?: Organization
  }
  ```

  In the `Tutorial` interface, replace the four 007 fields with two:

  ```typescript
    reviewed_by: string | null
    reviewed_for_org_id: string | null
    tutorial_orgs?: TutorialOrg[]
  ```

  Leave `AGREEMENT_VERSIONS` and `UserAgreement` as they are.

- [ ] **Step 5: Apply and verify**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  npx supabase db reset
  psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
    -c "\d public.tutorial_orgs" \
    -c "select proname from pg_proc where proname in ('is_org_leader','has_accepted','is_tutorial_contributor','tutorial_offered_to_my_org','can_review_tutorial') order by proname;"
  ```

  Expected: all migrations apply; the `tutorial_orgs` column list; exactly five
  function rows.

  ```bash
  npx pnpm --filter @splat-connect/types build
  cd packages/api && npx tsc --noEmit
  ```

  Expected: no type errors. If `tsc` complains about the web package's fixtures,
  that is Task 8 — the API package should be clean.

- [ ] **Step 6: Commit**

  ```bash
  git add supabase/migrations/007_organizations.sql
  git commit -m "feat(db): replace org membership with per-project backing tables"

  git add supabase/migrations/008_tutorial_contributor_scope.sql
  git commit -m "fix(db): narrow the review provenance trigger to surviving columns"

  git add packages/types/src/index.ts
  git commit -m "feat(types): replace membership types with project backing types"
  ```

---

## Task 2: Fixture builders

Every later task consumes these. No policy test of their own; `tsc` is the gate.

**Files:**
- Rewrite: `packages/api/tests/helpers/orgs.ts`

**Interfaces:**
- Produces: `createOrg`, `addLeader`, `acceptTerms`, `createProject`,
  `requestBacking`, `cleanupOrg` — signatures below. Tasks 3–7 use all six.

- [ ] **Step 1: Rewrite the helper file**

  ```typescript
  import { adminClient } from './auth.js'

  /** Service-role fixture builders. Tests exercise policies through a user client;
   *  setup deliberately bypasses RLS so a broken policy fails the assertion, not
   *  the arrangement. */
  export async function createOrg(opts: {
    createdBy: string
    status?: 'active' | 'suspended'
    name?: string
  }): Promise<string> {
    const { data, error } = await adminClient()
      .from('organizations')
      .insert({
        name: opts.name ?? `Test Org ${crypto.randomUUID().slice(0, 8)}`,
        created_by: opts.createdBy,
        status: opts.status ?? 'active',
      })
      .select('id')
      .single()
    if (error) throw new Error(`createOrg failed: ${error.message}`)
    return data.id as string
  }

  export async function addLeader(orgId: string, userId: string): Promise<string> {
    const { data, error } = await adminClient()
      .from('org_leaders')
      .insert({ org_id: orgId, user_id: userId })
      .select('id')
      .single()
    if (error) throw new Error(`addLeader failed: ${error.message}`)
    return data.id as string
  }

  export async function acceptTerms(userId: string, type: 'contributor_terms' | 'org_leader_terms') {
    const { error } = await adminClient()
      .from('user_agreements')
      .insert({ user_id: userId, agreement_type: type, version: 'v0-todo' })
    if (error) throw new Error(`acceptTerms failed: ${error.message}`)
  }

  /** A tutorial with its author linked. Unlike the superseded helper this needs no
   *  author token: there is no tutorials.org_id to pin under the author's JWT —
   *  backing lives in its own table now. */
  export async function createProject(opts: {
    authorId: string
    status?: 'draft' | 'pending' | 'approved' | 'rejected'
    title?: string
  }): Promise<string> {
    const admin = adminClient()
    const id = crypto.randomUUID()
    const { error } = await admin.from('tutorials').insert({
      id,
      title: opts.title ?? 'Backing Fixture',
      difficulty: 'easy',
      status: opts.status ?? 'pending',
    })
    if (error) throw new Error(`createProject failed: ${error.message}`)

    const { error: linkError } = await admin
      .from('tutorial_contributors')
      .insert({ tutorial_id: id, profile_id: opts.authorId })
    if (linkError) throw new Error(`createProject link failed: ${linkError.message}`)
    return id
  }

  /** A backing request in whatever state the test needs, bypassing the handshake. */
  export async function requestBacking(opts: {
    tutorialId: string
    orgId: string
    status?: 'pending' | 'accepted' | 'declined'
    respondedBy?: string
  }): Promise<string> {
    const { data, error } = await adminClient()
      .from('tutorial_orgs')
      .insert({
        tutorial_id: opts.tutorialId,
        org_id: opts.orgId,
        status: opts.status ?? 'pending',
        responded_by: opts.respondedBy ?? null,
        responded_at: opts.status && opts.status !== 'pending' ? new Date().toISOString() : null,
      })
      .select('id')
      .single()
    if (error) throw new Error(`requestBacking failed: ${error.message}`)
    return data.id as string
  }

  export async function cleanupOrg(orgId: string, tutorialIds: string[] = []) {
    const admin = adminClient()
    if (tutorialIds.length) await admin.from('tutorials').delete().in('id', tutorialIds)
    await admin.from('org_leaders').delete().eq('org_id', orgId)
    await admin.from('organizations').delete().eq('id', orgId)
  }
  ```

  `tutorial_orgs` rows are removed by the cascade from either parent, so
  `cleanupOrg` needs no explicit delete for them.

- [ ] **Step 2: Delete the superseded test files**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  git rm packages/api/tests/integration/orgs/membership-handshake.test.ts \
         packages/api/tests/integration/orgs/suspension.test.ts \
         packages/api/tests/integration/orgs/review-revocation.test.ts \
         packages/api/tests/integration/orgs/tutorial-read-grant.test.ts \
         packages/api/tests/integration/orgs/tutorial-review-grant.test.ts
  ```

  Their coverage is redistributed across Tasks 3–7. `contributor-claim.test.ts`
  stays — it covers 008, unchanged in substance.

- [ ] **Step 3: Verify the remaining suite compiles and passes**

  ```bash
  cd packages/api
  npx tsc --noEmit
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/
  ```

  Expected: no type errors; `contributor-claim.test.ts` passes on its own.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/api/tests/helpers/orgs.ts
  git commit -m "test(api): rebuild the org fixture builders for project backing"

  git add -A packages/api/tests/integration/orgs/
  git commit -m "test(api): drop the membership suites the new model supersedes"
  ```

---

## Task 3: The backing handshake

The most important task in the plan. Step 1's test is what stops an author
handing an organisation's leaders authority the organisation never agreed to.

**Files:**
- Modify: `supabase/migrations/007_organizations.sql` (policy section)
- Create: `packages/api/tests/integration/orgs/backing-handshake.test.ts`

**Interfaces:**
- Consumes: `createOrg`, `addLeader`, `createProject`, `requestBacking`,
  `cleanupOrg` from Task 2; `is_tutorial_contributor`, `is_org_leader` from Task 1.
- Produces: the `tutorial_orgs` INSERT, UPDATE and SELECT policies. Tasks 4–7
  depend on all three.

- [ ] **Step 1: Write the failing test**

  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest'
  import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
  import { createUserClient } from '../../../src/supabase/user-client.js'
  import { createOrg, addLeader, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

  let author: TestUser
  let leader: TestUser
  let otherLeader: TestUser
  let orgId: string
  let otherOrgId: string
  let draftId: string
  let publishedId: string

  beforeAll(async () => {
    author = await createTestUser('contributor')
    leader = await createTestUser('contributor')
    otherLeader = await createTestUser('contributor')

    orgId = await createOrg({ createdBy: leader.id })
    await addLeader(orgId, leader.id)
    otherOrgId = await createOrg({ createdBy: otherLeader.id })
    await addLeader(otherOrgId, otherLeader.id)

    draftId = await createProject({ authorId: author.id, status: 'draft' })
    publishedId = await createProject({ authorId: author.id, status: 'approved' })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [draftId, publishedId])
    await cleanupOrg(otherOrgId)
    await deleteTestUser(author.id)
    await deleteTestUser(leader.id)
    await deleteTestUser(otherLeader.id)
  })

  describe('requesting backing', () => {
    it('an author can ask an org to back their draft', async () => {
      const { data, error } = await createUserClient(author.token)
        .from('tutorial_orgs')
        .insert({ tutorial_id: draftId, org_id: orgId })
        .select('id, status')
        .single()
      expect(error).toBeNull()
      expect(data?.status).toBe('pending')
      await adminClient().from('tutorial_orgs').delete().eq('id', data!.id)
    })

    it('a stranger cannot ask on behalf of someone else\'s project', async () => {
      const { error } = await createUserClient(otherLeader.token)
        .from('tutorial_orgs')
        .insert({ tutorial_id: draftId, org_id: otherOrgId })
      expect(error?.code).toBe('42501')
    })

    it('an author cannot add backing to a published tutorial', async () => {
      const { error } = await createUserClient(author.token)
        .from('tutorial_orgs')
        .insert({ tutorial_id: publishedId, org_id: orgId })
      expect(error?.code).toBe('42501')
    })

    it('an author cannot insert a request already accepted', async () => {
      // THE test. If this passes, an author can hand any organisation's leaders
      // authority over work those leaders never agreed to take — which is the one
      // thing the whole handshake exists to prevent.
      const { error } = await createUserClient(author.token)
        .from('tutorial_orgs')
        .insert({ tutorial_id: draftId, org_id: orgId, status: 'accepted' })
      expect(error?.code).toBe('42501')
    })
  })

  describe('answering a request', () => {
    it('a leader of the asked org can accept it', async () => {
      const rowId = await requestBacking({ tutorialId: draftId, orgId })
      const { data, error } = await createUserClient(leader.token)
        .from('tutorial_orgs')
        .update({ status: 'accepted', responded_by: leader.id, responded_at: new Date().toISOString() })
        .eq('id', rowId)
        .select('status')
      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data![0].status).toBe('accepted')
      await adminClient().from('tutorial_orgs').delete().eq('id', rowId)
    })

    it('a leader of a different org cannot answer it', async () => {
      const rowId = await requestBacking({ tutorialId: draftId, orgId })
      const { data, error } = await createUserClient(otherLeader.token)
        .from('tutorial_orgs')
        .update({ status: 'accepted' })
        .eq('id', rowId)
        .select('id')
      // USING excludes the row entirely, so this is a silent zero-row match.
      expect(error).toBeNull()
      expect(data ?? []).toHaveLength(0)
      await adminClient().from('tutorial_orgs').delete().eq('id', rowId)
    })

    it('the author cannot answer their own request', async () => {
      // No UPDATE policy admits a contributor at all — the author's only powers
      // over this row are creating it and deleting it.
      const rowId = await requestBacking({ tutorialId: draftId, orgId })
      const { data, error } = await createUserClient(author.token)
        .from('tutorial_orgs')
        .update({ status: 'accepted' })
        .eq('id', rowId)
        .select('id')
      expect(error).toBeNull()
      expect(data ?? []).toHaveLength(0)

      const { data: check } = await adminClient()
        .from('tutorial_orgs').select('status').eq('id', rowId).single()
      expect(check?.status).toBe('pending')
      await adminClient().from('tutorial_orgs').delete().eq('id', rowId)
    })

    it('a leader cannot set a status outside accepted or declined', async () => {
      const rowId = await requestBacking({ tutorialId: draftId, orgId, status: 'accepted' })
      const { error } = await createUserClient(leader.token)
        .from('tutorial_orgs')
        .update({ status: 'pending' })
        .eq('id', rowId)
        .select('id')
      expect(error?.code).toBe('42501')
      await adminClient().from('tutorial_orgs').delete().eq('id', rowId)
    })
  })
  ```

- [ ] **Step 2: Run and verify it fails**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/backing-handshake.test.ts
  ```

  Expected: FAIL. With RLS enabled and no policies on `tutorial_orgs`, every write
  is refused — so the two "can" tests fail while the refusal tests pass
  vacuously. That is the correct red state; the policies must make the
  permissive cases work *without* making the refusals pass.

- [ ] **Step 3: Add the `tutorial_orgs` policies**

  Append to the RLS section of `007`:

  ```sql
  -- tutorial_orgs
  -- The author asks. Always 'pending' — an author who could write 'accepted'
  -- would hand an organisation's leaders authority it never agreed to, which is
  -- the single thing this table exists to prevent. Draft or pending tutorials
  -- only: you cannot bolt an organisation onto published work.
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

  create policy "Admin full access to tutorial_orgs"
    on public.tutorial_orgs for all using (public.is_admin());
  ```

- [ ] **Step 4: Reset and verify it passes**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  npx supabase db reset
  cd packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/backing-handshake.test.ts
  ```

  Expected: 8 passed.

- [ ] **Step 5: Commit**

  ```bash
  git add supabase/migrations/007_organizations.sql \
          packages/api/tests/integration/orgs/backing-handshake.test.ts
  git commit -m "feat(db): add the project backing handshake"
  ```

---

## Task 4: The review grant

**Files:**
- Modify: `supabase/migrations/007_organizations.sql`
- Create: `packages/api/tests/integration/orgs/review-grant.test.ts`

**Interfaces:**
- Consumes: `can_review_tutorial`, `has_accepted` from Task 1; the `tutorial_orgs`
  policies from Task 3.
- Produces: the `tutorials` leader UPDATE policy.

- [ ] **Step 1: Write the failing test**

  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest'
  import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
  import { createUserClient } from '../../../src/supabase/user-client.js'
  import { createOrg, addLeader, acceptTerms, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

  let author: TestUser
  let leader: TestUser
  let untermed: TestUser
  let orgId: string
  let suspendedOrgId: string
  let untermedOrgId: string
  let accepted: string
  let pendingOnly: string
  let unbacked: string
  let suspendedBacked: string
  let untermedBacked: string

  /** An RLS-blocked UPDATE matches zero rows rather than erroring. The error
   *  assertion keeps a trigger-raised 42501 from masquerading as an RLS block —
   *  PostgREST nulls `data` whenever `error` is set. */
  async function tryApprove(token: string, tutorialId: string): Promise<number> {
    const { data, error } = await createUserClient(token)
      .from('tutorials')
      .update({ status: 'approved' })
      .eq('id', tutorialId)
      .select('id')
    expect(error).toBeNull()
    return (data ?? []).length
  }

  beforeAll(async () => {
    author = await createTestUser('contributor')
    leader = await createTestUser('contributor')
    untermed = await createTestUser('contributor')
    await acceptTerms(leader.id, 'org_leader_terms')

    orgId = await createOrg({ createdBy: leader.id })
    await addLeader(orgId, leader.id)
    suspendedOrgId = await createOrg({ createdBy: leader.id, status: 'suspended' })
    await addLeader(suspendedOrgId, leader.id)
    untermedOrgId = await createOrg({ createdBy: untermed.id })
    await addLeader(untermedOrgId, untermed.id)

    accepted = await createProject({ authorId: author.id })
    await requestBacking({ tutorialId: accepted, orgId, status: 'accepted', respondedBy: leader.id })

    pendingOnly = await createProject({ authorId: author.id })
    await requestBacking({ tutorialId: pendingOnly, orgId })

    unbacked = await createProject({ authorId: author.id })

    suspendedBacked = await createProject({ authorId: author.id })
    await requestBacking({ tutorialId: suspendedBacked, orgId: suspendedOrgId, status: 'accepted' })

    untermedBacked = await createProject({ authorId: author.id })
    await requestBacking({ tutorialId: untermedBacked, orgId: untermedOrgId, status: 'accepted' })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [accepted, pendingOnly, unbacked])
    await cleanupOrg(suspendedOrgId, [suspendedBacked])
    await cleanupOrg(untermedOrgId, [untermedBacked])
    await deleteTestUser(author.id)
    await deleteTestUser(leader.id)
    await deleteTestUser(untermed.id)
  })

  describe('the leader review grant', () => {
    it('approves a project their org accepted', async () => {
      expect(await tryApprove(leader.token, accepted)).toBe(1)
      await adminClient().from('tutorials').update({ status: 'pending' }).eq('id', accepted)
    })

    it('cannot approve a project their org has only been asked about', async () => {
      // Accepting is what confers authority — being asked is not.
      expect(await tryApprove(leader.token, pendingOnly)).toBe(0)
    })

    it('cannot approve a project with no backing at all', async () => {
      expect(await tryApprove(leader.token, unbacked)).toBe(0)
    })

    it('cannot approve while their org is suspended', async () => {
      expect(await tryApprove(leader.token, suspendedBacked)).toBe(0)
    })

    it('cannot approve without accepted leader terms', async () => {
      // has_accepted sits in the policy's USING clause, so the block is a silent
      // zero-row match. Accepting is the only thing that changes between the two
      // attempts, so the first is attributable to has_accepted and nothing else —
      // and it only asserts anything because the gate lives in the policy.
      expect(await tryApprove(untermed.token, untermedBacked)).toBe(0)
      await acceptTerms(untermed.id, 'org_leader_terms')
      expect(await tryApprove(untermed.token, untermedBacked)).toBe(1)
      await adminClient().from('tutorials').update({ status: 'pending' }).eq('id', untermedBacked)
    })

    it('a leader of an unrelated org cannot approve it', async () => {
      expect(await tryApprove(untermed.token, accepted)).toBe(0)
    })

    it('a plain contributor cannot approve their own project', async () => {
      // Different failure shape: "Contributors can update own tutorials" matches
      // this row and its WITH CHECK forbids 'approved', so this is a real 42501
      // rather than a silent exclusion.
      const { error } = await createUserClient(author.token)
        .from('tutorials')
        .update({ status: 'approved' })
        .eq('id', accepted)
        .select('id')
      expect(error?.code).toBe('42501')
    })

    it('a leader can approve their own project when their org backs it', async () => {
      // Decision 14: no self-review block. Leadership is granted by the admin to
      // someone already trusted, and a single-leader org could otherwise never
      // publish its leader's own work.
      const own = await createProject({ authorId: leader.id })
      await requestBacking({ tutorialId: own, orgId, status: 'accepted', respondedBy: leader.id })
      expect(await tryApprove(leader.token, own)).toBe(1)
      await adminClient().from('tutorials').delete().eq('id', own)
    })
  })
  ```

- [ ] **Step 2: Run and verify it fails**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/review-grant.test.ts
  ```

  Expected: FAIL on the first test — no leader UPDATE policy exists, so the
  approve matches zero rows.

- [ ] **Step 3: Add the leader read and write policies**

  Append to the RLS section of `007`:

  ```sql
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
  ```

- [ ] **Step 4: Reset and verify**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  npx supabase db reset
  cd packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/
  ```

  Expected: all files pass — 8 in `backing-handshake`, 8 in `review-grant`, 3 in
  `contributor-claim`.

- [ ] **Step 5: Commit**

  ```bash
  git add supabase/migrations/007_organizations.sql \
          packages/api/tests/integration/orgs/review-grant.test.ts
  git commit -m "feat(db): grant review to leaders of a backing organisation"
  ```

---

## Task 5: The identity freeze trigger

A policy cannot see the old row, so `tutorial_id` is forgeable: a leader could
take a legitimate acceptance of one project and repoint it at another, stamping
their organisation on work that never asked. Same class of bug as the
`initiated_by` forge the superseded design hit.

**Files:**
- Modify: `supabase/migrations/007_organizations.sql`
- Modify: `packages/api/tests/integration/orgs/backing-handshake.test.ts`

**Interfaces:**
- Consumes: the `tutorial_orgs` UPDATE policy from Task 3.
- Produces: `tutorial_orgs_freeze_identity` trigger.

- [ ] **Step 1: Write the failing test**

  Add to `backing-handshake.test.ts`, inside `describe('answering a request')`:

  ```typescript
  it('a leader cannot repoint an acceptance at a different project', async () => {
    // The UPDATE policy passes on both rows — the leader leads this org either way
    // — so only a trigger can refuse this. Without it a leader stamps their
    // organisation on work that never asked for it, which is an attack on the
    // author rather than on the org.
    const secondProject = await createProject({ authorId: author.id, status: 'draft' })
    const rowId = await requestBacking({ tutorialId: draftId, orgId, status: 'accepted' })

    const { error } = await createUserClient(leader.token)
      .from('tutorial_orgs')
      .update({ tutorial_id: secondProject })
      .eq('id', rowId)
      .select('id')
    expect(error?.code).toBe('42501')

    // Ground truth: a 42501 alone does not prove the row survived intact.
    const { data } = await adminClient()
      .from('tutorial_orgs').select('tutorial_id').eq('id', rowId).single()
    expect(data?.tutorial_id).toBe(draftId)

    await adminClient().from('tutorial_orgs').delete().eq('id', rowId)
    await adminClient().from('tutorials').delete().eq('id', secondProject)
  })

  it('a leader cannot move an acceptance to another org', async () => {
    const rowId = await requestBacking({ tutorialId: draftId, orgId, status: 'accepted' })
    const { error } = await createUserClient(leader.token)
      .from('tutorial_orgs')
      .update({ org_id: otherOrgId })
      .eq('id', rowId)
      .select('id')
    expect(error?.code).toBe('42501')
    await adminClient().from('tutorial_orgs').delete().eq('id', rowId)
  })
  ```

- [ ] **Step 2: Run and verify it fails**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts \
    tests/integration/orgs/backing-handshake.test.ts -t 'repoint'
  ```

  Expected: FAIL — `error?.code` is `undefined`, the repoint succeeded.

- [ ] **Step 3: Add the trigger**

  Append to `007`:

  ```sql
  -- ============================================================
  -- Provenance trigger
  -- ============================================================
  -- WHY: An RLS `with check` clause sees only the NEW row, and a Postgres policy
  --      cannot reference OLD. The UPDATE policy above therefore validates
  --      is_org_leader(org_id) against a value the same statement is free to
  --      rewrite — and says nothing at all about tutorial_id. A leader could take
  --      a legitimate acceptance and repoint it at a different project, stamping
  --      their organisation on work that never asked for it.
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
  ```

- [ ] **Step 4: Reset and verify**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  npx supabase db reset
  cd packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/backing-handshake.test.ts
  ```

  Expected: 10 passed.

- [ ] **Step 5: Commit**

  ```bash
  git add supabase/migrations/007_organizations.sql \
          packages/api/tests/integration/orgs/backing-handshake.test.ts
  git commit -m "fix(db): freeze the identity of a backing row against repointing"
  ```

---

## Task 6: Collaboration and public badges

**Files:**
- Modify: `supabase/migrations/007_organizations.sql`
- Create: `packages/api/tests/integration/orgs/collaboration.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 3–5.
- Produces: the public `tutorial_orgs` SELECT policy.

- [ ] **Step 1: Write the failing test**

  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest'
  import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
  import { createUserClient } from '../../../src/supabase/user-client.js'
  import { createOrg, addLeader, acceptTerms, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

  let author: TestUser
  let leaderA: TestUser
  let leaderB: TestUser
  let stranger: TestUser
  let orgA: string
  let orgB: string
  let orgC: string
  let project: string

  beforeAll(async () => {
    author = await createTestUser('contributor')
    leaderA = await createTestUser('contributor')
    leaderB = await createTestUser('contributor')
    stranger = await createTestUser('contributor')
    await acceptTerms(leaderA.id, 'org_leader_terms')
    await acceptTerms(leaderB.id, 'org_leader_terms')

    orgA = await createOrg({ createdBy: leaderA.id, name: 'Riverside Therapy' })
    await addLeader(orgA, leaderA.id)
    orgB = await createOrg({ createdBy: leaderB.id, name: 'Northside Clinic' })
    await addLeader(orgB, leaderB.id)
    orgC = await createOrg({ createdBy: leaderA.id, name: 'Declining Clinic' })

    project = await createProject({ authorId: author.id })
    await requestBacking({ tutorialId: project, orgId: orgA, status: 'accepted', respondedBy: leaderA.id })
    await requestBacking({ tutorialId: project, orgId: orgB, status: 'accepted', respondedBy: leaderB.id })
    await requestBacking({ tutorialId: project, orgId: orgC, status: 'declined' })
  })

  afterAll(async () => {
    await cleanupOrg(orgA, [project])
    await cleanupOrg(orgB)
    await cleanupOrg(orgC)
    await deleteTestUser(author.id)
    await deleteTestUser(leaderA.id)
    await deleteTestUser(leaderB.id)
    await deleteTestUser(stranger.id)
  })

  describe('two organisations backing one project', () => {
    it('either leader can approve it, and first to act wins', async () => {
      const { data, error } = await createUserClient(leaderB.token)
        .from('tutorials')
        .update({
          status: 'approved',
          reviewed_by: leaderB.id,
          reviewed_for_org_id: orgB,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', project)
        .select('id')
      expect(error).toBeNull()
      expect(data).toHaveLength(1)

      const { data: row } = await adminClient()
        .from('tutorials').select('status, reviewed_by, reviewed_for_org_id').eq('id', project).single()
      expect(row).toMatchObject({
        status: 'approved', reviewed_by: leaderB.id, reviewed_for_org_id: orgB,
      })
    })

    it('shows only accepted orgs as public badges on a published project', async () => {
      // `stranger` has no relationship to the project or any of the three orgs.
      const { data, error } = await createUserClient(stranger.token)
        .from('tutorial_orgs')
        .select('org_id, status')
        .eq('tutorial_id', project)
      expect(error).toBeNull()
      const ids = (data ?? []).map((r) => r.org_id)
      expect(ids).toContain(orgA)
      expect(ids).toContain(orgB)
      expect(ids).not.toContain(orgC)
    })

    it('hides backing rows on a project that is not published', async () => {
      const draft = await createProject({ authorId: author.id, status: 'draft' })
      await requestBacking({ tutorialId: draft, orgId: orgA, status: 'accepted' })

      const { data } = await createUserClient(stranger.token)
        .from('tutorial_orgs')
        .select('id')
        .eq('tutorial_id', draft)
      expect(data ?? []).toHaveLength(0)

      await adminClient().from('tutorials').delete().eq('id', draft)
    })

    it('a leader whose org withdrew loses the review grant, the other keeps it', async () => {
      await adminClient().from('tutorials').update({
        status: 'pending', reviewed_by: null, reviewed_for_org_id: null,
      }).eq('id', project)
      await adminClient().from('tutorial_orgs')
        .update({ status: 'declined' }).eq('tutorial_id', project).eq('org_id', orgB)

      const gone = await createUserClient(leaderB.token)
        .from('tutorials').update({ status: 'approved' }).eq('id', project).select('id')
      expect(gone.error).toBeNull()
      expect(gone.data ?? []).toHaveLength(0)

      const still = await createUserClient(leaderA.token)
        .from('tutorials').update({ status: 'approved' }).eq('id', project).select('id')
      expect(still.error).toBeNull()
      expect(still.data).toHaveLength(1)
    })
  })
  ```

- [ ] **Step 2: Run and verify it fails**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/collaboration.test.ts
  ```

  Expected: FAIL on the badge test — no public SELECT policy, so `stranger` sees
  nothing.

- [ ] **Step 3: Add the public badge policy**

  Append to the `tutorial_orgs` policy block in `007`:

  ```sql
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
  ```

- [ ] **Step 4: Reset and verify**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  npx supabase db reset
  cd packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/collaboration.test.ts
  ```

  Expected: 4 passed.

- [ ] **Step 5: Commit**

  ```bash
  git add supabase/migrations/007_organizations.sql \
          packages/api/tests/integration/orgs/collaboration.test.ts
  git commit -m "feat(db): publish accepted backing as public badges"
  ```

---

## Task 7: Withdrawal and the freeze rule

**Files:**
- Modify: `supabase/migrations/007_organizations.sql`
- Create: `packages/api/tests/integration/orgs/withdrawal.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 3–6.
- Produces: the `tutorial_orgs` DELETE policy.

- [ ] **Step 1: Write the failing test**

  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest'
  import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
  import { createUserClient } from '../../../src/supabase/user-client.js'
  import { createOrg, addLeader, acceptTerms, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

  let author: TestUser
  let leader: TestUser
  let stranger: TestUser
  let orgId: string
  let otherOrgId: string

  beforeAll(async () => {
    author = await createTestUser('contributor')
    leader = await createTestUser('contributor')
    stranger = await createTestUser('contributor')
    await acceptTerms(leader.id, 'org_leader_terms')
    orgId = await createOrg({ createdBy: leader.id })
    await addLeader(orgId, leader.id)
    otherOrgId = await createOrg({ createdBy: leader.id })
  })

  afterAll(async () => {
    await cleanupOrg(orgId)
    await cleanupOrg(otherOrgId)
    await deleteTestUser(author.id)
    await deleteTestUser(leader.id)
    await deleteTestUser(stranger.id)
  })

  /** Fresh project per test: withdrawal is destructive and the freeze depends on
   *  the tutorial's own status, so sharing a fixture would couple the tests. */
  async function project(status: 'draft' | 'pending' | 'approved' = 'pending') {
    return createProject({ authorId: author.id, status })
  }

  describe('withdrawing backing', () => {
    it('the author can withdraw a pending request', async () => {
      const t = await project('draft')
      const rowId = await requestBacking({ tutorialId: t, orgId })
      const { error, data } = await createUserClient(author.token)
        .from('tutorial_orgs').delete().eq('id', rowId).select('id')
      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      await adminClient().from('tutorials').delete().eq('id', t)
    })

    it('a leader can withdraw their own org after accepting', async () => {
      const t = await project()
      const rowId = await requestBacking({ tutorialId: t, orgId, status: 'accepted' })
      const { error, data } = await createUserClient(leader.token)
        .from('tutorial_orgs').delete().eq('id', rowId).select('id')
      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      await adminClient().from('tutorials').delete().eq('id', t)
    })

    it('a stranger can withdraw nothing', async () => {
      const t = await project()
      const rowId = await requestBacking({ tutorialId: t, orgId, status: 'accepted' })
      const { error, data } = await createUserClient(stranger.token)
        .from('tutorial_orgs').delete().eq('id', rowId).select('id')
      expect(error).toBeNull()
      expect(data ?? []).toHaveLength(0)
      await adminClient().from('tutorials').delete().eq('id', t)
    })

    it('nobody can withdraw the org that approved the published project', async () => {
      // The freeze (decision 22). Without it reviewed_for_org_id would point at an
      // organisation no longer listed, so a published tutorial would show an
      // approver whose organisation appears nowhere.
      const t = await project()
      const rowId = await requestBacking({ tutorialId: t, orgId, status: 'accepted' })
      await adminClient().from('tutorials').update({
        status: 'approved', reviewed_by: leader.id, reviewed_for_org_id: orgId,
      }).eq('id', t)

      for (const who of [author, leader]) {
        const { error, data } = await createUserClient(who.token)
          .from('tutorial_orgs').delete().eq('id', rowId).select('id')
        expect(error).toBeNull()
        expect(data ?? []).toHaveLength(0)
      }

      const { data: survives } = await adminClient()
        .from('tutorial_orgs').select('id').eq('id', rowId).single()
      expect(survives?.id).toBe(rowId)
      await adminClient().from('tutorials').delete().eq('id', t)
    })

    it('a collaborator that did not approve can still withdraw after publication', async () => {
      // Only the organisation that actually reviewed is bound. One that lent its
      // name may take it back — that is what decision 22 says.
      const t = await project()
      const approverRow = await requestBacking({ tutorialId: t, orgId, status: 'accepted' })
      const collaboratorRow = await requestBacking({ tutorialId: t, orgId: otherOrgId, status: 'accepted' })
      await addLeader(otherOrgId, leader.id)
      await adminClient().from('tutorials').update({
        status: 'approved', reviewed_by: leader.id, reviewed_for_org_id: orgId,
      }).eq('id', t)

      const { error, data } = await createUserClient(leader.token)
        .from('tutorial_orgs').delete().eq('id', collaboratorRow).select('id')
      expect(error).toBeNull()
      expect(data).toHaveLength(1)

      const { data: bound } = await adminClient()
        .from('tutorial_orgs').select('id').eq('id', approverRow).single()
      expect(bound?.id).toBe(approverRow)
      await adminClient().from('tutorials').delete().eq('id', t)
    })
  })
  ```

- [ ] **Step 2: Run and verify it fails**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/withdrawal.test.ts
  ```

  Expected: FAIL on the first two — no DELETE policy, so every delete matches zero
  rows. The refusal tests pass vacuously.

- [ ] **Step 3: Add the DELETE policy**

  Append to the `tutorial_orgs` policy block in `007`:

  ```sql
  -- Either side may back out, until the organisation in this row is the one that
  -- approved the tutorial (decision 22). After that the row IS the audit trail:
  -- reviewed_for_org_id would otherwise point at an organisation listed nowhere.
  -- An organisation that lent its name but did not review may still withdraw; the
  -- one that approved must reject the tutorial instead. You cannot disown work
  -- while leaving it published under your name.
  create policy "Either side can withdraw backing before it was acted on"
    on public.tutorial_orgs for delete
    using (
      (public.is_tutorial_contributor(tutorial_id) or public.is_org_leader(org_id))
      and not exists (
        select 1 from public.tutorials t
        where t.id = tutorial_id
          and t.status = 'approved'
          and t.reviewed_for_org_id = org_id
      )
    );
  ```

- [ ] **Step 4: Reset and verify**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  npx supabase db reset
  cd packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/withdrawal.test.ts
  ```

  Expected: 5 passed.

- [ ] **Step 5: Commit**

  ```bash
  git add supabase/migrations/007_organizations.sql \
          packages/api/tests/integration/orgs/withdrawal.test.ts
  git commit -m "feat(db): allow withdrawing backing until the org acted on it"
  ```

---

## Task 8: Admin authority and the read grant

**Files:**
- Modify: `supabase/migrations/007_organizations.sql`
- Create: `packages/api/tests/integration/orgs/admin-authority.test.ts`
- Create: `packages/api/tests/integration/orgs/read-grant.test.ts`

**Interfaces:**
- Consumes: `tutorial_offered_to_my_org` from Task 1.
- Produces: the `organizations`, `org_leaders` and `user_agreements` policies.

- [ ] **Step 1: Write the failing admin test**

  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest'
  import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
  import { createUserClient } from '../../../src/supabase/user-client.js'
  import { createOrg, addLeader, acceptTerms, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

  let admin: TestUser
  let leader: TestUser
  let author: TestUser
  let orgId: string
  let createdByAdmin: string | undefined
  let project: string

  beforeAll(async () => {
    admin = await createTestUser('admin')
    leader = await createTestUser('contributor')
    author = await createTestUser('contributor')
    await acceptTerms(leader.id, 'org_leader_terms')
    orgId = await createOrg({ createdBy: admin.id })
    await addLeader(orgId, leader.id)
    project = await createProject({ authorId: author.id })
    await requestBacking({ tutorialId: project, orgId, status: 'accepted', respondedBy: leader.id })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [project])
    if (createdByAdmin) await cleanupOrg(createdByAdmin)
    await deleteTestUser(admin.id)
    await deleteTestUser(leader.id)
    await deleteTestUser(author.id)
  })

  describe('organisation authority', () => {
    it('only an admin can create an organisation', async () => {
      const attempt = (u: TestUser) =>
        createUserClient(u.token)
          .from('organizations')
          .insert({ name: `Gate ${crypto.randomUUID().slice(0, 8)}`, created_by: u.id })
          .select('id')
          .single()

      const refused = await attempt(leader)
      expect(refused.error?.code).toBe('42501')

      const allowed = await attempt(admin)
      expect(allowed.error).toBeNull()
      createdByAdmin = allowed.data!.id as string
    })

    it('only an admin can appoint a leader', async () => {
      const { error } = await createUserClient(leader.token)
        .from('org_leaders')
        .insert({ org_id: orgId, user_id: author.id })
      expect(error?.code).toBe('42501')
    })

    it('a leader cannot un-suspend or rename their own org', async () => {
      const { data, error } = await createUserClient(leader.token)
        .from('organizations')
        .update({ status: 'suspended', name: 'Renamed' })
        .eq('id', orgId)
        .select('id')
      expect(error).toBeNull()
      expect(data ?? []).toHaveLength(0)
    })

    it('removing a leader revokes review instantly, and the removal persists', async () => {
      // Assert against the database, not the row count alone: the superseded design
      // shipped a revocation path that reported success and changed nothing, and
      // only a database assertion caught it.
      const before = await createUserClient(leader.token)
        .from('tutorials').update({ status: 'approved' }).eq('id', project).select('id')
      expect(before.data).toHaveLength(1)
      await adminClient().from('tutorials').update({ status: 'pending' }).eq('id', project)

      const removal = await createUserClient(admin.token)
        .from('org_leaders').delete().eq('org_id', orgId).eq('user_id', leader.id).select('id')
      expect(removal.error).toBeNull()
      expect(removal.data).toHaveLength(1)

      const { data: gone } = await adminClient()
        .from('org_leaders').select('id').eq('org_id', orgId).eq('user_id', leader.id)
      expect(gone ?? []).toHaveLength(0)

      const after = await createUserClient(leader.token)
        .from('tutorials').update({ status: 'approved' }).eq('id', project).select('id')
      expect(after.error).toBeNull()
      expect(after.data ?? []).toHaveLength(0)
    })
  })
  ```

- [ ] **Step 2: Write the failing read-grant test**

  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest'
  import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'
  import { createUserClient } from '../../../src/supabase/user-client.js'
  import { createOrg, addLeader, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

  let author: TestUser
  let leader: TestUser
  let otherLeader: TestUser
  let orgId: string
  let otherOrgId: string
  let offered: string
  let unoffered: string

  beforeAll(async () => {
    author = await createTestUser('contributor')
    leader = await createTestUser('contributor')
    otherLeader = await createTestUser('contributor')
    orgId = await createOrg({ createdBy: leader.id })
    await addLeader(orgId, leader.id)
    otherOrgId = await createOrg({ createdBy: otherLeader.id })
    await addLeader(otherOrgId, otherLeader.id)

    // A DRAFT, not pending: reading it is how a leader decides whether to back it.
    offered = await createProject({ authorId: author.id, status: 'draft' })
    await requestBacking({ tutorialId: offered, orgId })
    unoffered = await createProject({ authorId: author.id, status: 'draft' })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [offered, unoffered])
    await cleanupOrg(otherOrgId)
    await deleteTestUser(author.id)
    await deleteTestUser(leader.id)
    await deleteTestUser(otherLeader.id)
  })

  describe('the leader read grant', () => {
    it('reads a draft their org was asked to back', async () => {
      const { data } = await createUserClient(leader.token)
        .from('tutorials').select('id').eq('id', offered)
      expect((data ?? []).map((t) => t.id)).toContain(offered)
    })

    it('cannot read a draft nobody offered them', async () => {
      const { data } = await createUserClient(leader.token)
        .from('tutorials').select('id').eq('id', unoffered)
      expect(data ?? []).toHaveLength(0)
    })

    it('a leader of another org cannot read it either', async () => {
      const { data } = await createUserClient(otherLeader.token)
        .from('tutorials').select('id').eq('id', offered)
      expect(data ?? []).toHaveLength(0)
    })
  })
  ```

- [ ] **Step 3: Run both and verify they fail**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts \
    tests/integration/orgs/admin-authority.test.ts \
    tests/integration/orgs/read-grant.test.ts
  ```

  Expected: FAIL. No `organizations` or `org_leaders` policies exist, so the
  admin's create is refused and every fixture read returns nothing.

- [ ] **Step 4: Add the remaining policies**

  Insert into the RLS section of `007`, before the `tutorial_orgs` block:

  ```sql
  -- organizations
  -- Readable by anyone at any status, deliberately: a suspended organisation's
  -- badge must keep rendering on tutorials it already backed, or history rewrites
  -- itself. Names and descriptions are public anyway.
  create policy "Anyone can read organizations"
    on public.organizations for select using (true);

  -- Only the admin creates, suspends, renames or deletes an organisation
  -- (decision 11). This is what keeps `status` out of a leader's reach: a leader
  -- can never un-suspend their own organisation.
  create policy "Admin can write organizations"
    on public.organizations for all
    using (public.is_admin())
    with check (public.is_admin());

  -- org_leaders
  -- Public, because a leader is a public-facing trust figure — the badge on a
  -- published tutorial should be traceable to a person.
  create policy "Anyone can read org leaders"
    on public.org_leaders for select using (true);

  -- Only the admin grants or removes leadership (decision 12). There is no
  -- provenance trigger on this table and none is needed: the superseded design
  -- needed one because non-admins could write org_members, and here nobody can.
  create policy "Admin can write org leaders"
    on public.org_leaders for all
    using (public.is_admin())
    with check (public.is_admin());

  -- user_agreements
  -- No UPDATE and no DELETE policy: an acceptance record that can be edited is not
  -- a record.
  create policy "Users can read own agreements"
    on public.user_agreements for select using (user_id = auth.uid());

  create policy "Users can record own agreements"
    on public.user_agreements for insert with check (user_id = auth.uid());

  create policy "Admin can read all agreements"
    on public.user_agreements for select using (public.is_admin());
  ```

- [ ] **Step 5: Reset and verify the whole suite**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  npx supabase db reset
  cd packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/
  ```

  Expected: all six files pass — 10 + 8 + 4 + 5 + 4 + 3 in `backing-handshake`,
  `review-grant`, `collaboration`, `withdrawal`, `admin-authority`, `read-grant`,
  plus 3 in `contributor-claim`.

- [ ] **Step 6: Commit**

  ```bash
  git add supabase/migrations/007_organizations.sql \
          packages/api/tests/integration/orgs/admin-authority.test.ts \
          packages/api/tests/integration/orgs/read-grant.test.ts
  git commit -m "feat(db): reserve organisation and leadership writes to the admin"
  ```

---

## Task 9: Web fixtures and the schema reference

**Files:**
- Modify: `packages/web/tests/unit/components/tutorial-card.test.tsx`,
  `packages/web/tests/unit/pages/dashboard.test.tsx`,
  `packages/web/tests/unit/pages/edit-tutorial.test.tsx`,
  `packages/web/tests/unit/pages/my-tutorials.test.tsx`,
  `packages/web/tests/unit/lib/validation.test.ts`
- Modify: `supabase/SCHEMA.md`

- [ ] **Step 1: Swap the tutorial fixture fields**

  Each of the five files carries the same four lines in its `Tutorial` fixture.
  Replace, in all five:

  ```typescript
    org_id: null,
    review_level: null,
    reviewed_by: null,
    flagged_for_follow_up: false,
  ```

  with:

  ```typescript
    reviewed_by: null,
    reviewed_for_org_id: null,
  ```

- [ ] **Step 2: Run the web unit suite**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/web
  npm run test:unit
  ```

  Expected: PASS. A failure here means a fixture was missed.

- [ ] **Step 3: Rewrite the org sections of `SCHEMA.md`**

  The document mirrors the current schema and is what a reader consults instead of
  the migration. Update in place:

  - **Migration index** — the `007` row now reads: adds `organizations`,
    `org_leaders`, `user_agreements`, `tutorial_orgs`; adds `reviewed_by` and
    `reviewed_for_org_id` to `tutorials`; adds the org RLS and one provenance
    trigger. The `008` row drops its mention of `review_level` and
    `flagged_for_follow_up`.
  - **`tutorials` table** — remove the `org_id`, `review_level` and
    `flagged_for_follow_up` rows from the column table and the `create table`
    block; add `reviewed_for_org_id`. Rewrite the *Evolution (007)* note: backing
    lives in `tutorial_orgs`, and `reviewed_for_org_id` names the organisation the
    approving leader acted for.
  - **Replace the `org_members` section** with `org_leaders` and add a
    `tutorial_orgs` section, both matching Task 1's DDL.
  - **`organizations`** — `status` is now `active`/`suspended`; `trust_level` is
    gone.
  - **Helper functions (007)** — five entries, matching Task 1.
  - **RLS sections** — replace the `organizations`, `org_members` and org-leader
    `tutorials` policy blocks with the policies from Tasks 3, 4, 6, 7 and 8.
  - **Provenance triggers** — `org_members_freeze_provenance` and
    `tutorials_org_must_be_own` are gone; `tutorial_orgs_freeze_identity` replaces
    them; `tutorials_freeze_review_provenance` guards two columns.

- [ ] **Step 4: Verify no stale references remain**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  grep -n "org_members\|trust_level\|review_level\|flagged_for_follow_up\|tutorials_org_must_be_own\|initiated_by" supabase/SCHEMA.md
  ```

  Expected: no output.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/web/tests/unit
  git commit -m "test(web): swap the tutorial review fields in the unit fixtures"

  git add supabase/SCHEMA.md
  git commit -m "docs(schema): document project backing, replacing org membership"
  ```

---

## Task 10: Supersede the stale plans

Three plan documents describe the membership model. Two are unexecuted and would
build the wrong thing; one is a record of executed work that this plan undoes.

**Files:**
- Modify: `docs/superpowers/plans/2026-07-28-org-review-schema-rls.md`,
  `2026-07-28-admin-only-org-authority.md`
- Delete: `docs/superpowers/plans/2026-07-28-org-review-api.md`,
  `2026-07-28-org-review-web.md`

- [ ] **Step 1: Mark the two executed plans superseded**

  Add directly under the goal of each, replacing any existing amendment note:

  ```markdown
  > **Superseded 2026-07-28** by
  > `docs/superpowers/plans/2026-07-28-project-org-schema-rls.md`. The membership
  > model this plan built — `org_members`, the two-sided handshake, `trust_level`,
  > `review_level` — was replaced by per-project organisation backing. Kept as the
  > record of what was tried; do not execute it.
  ```

- [ ] **Step 2: Delete the two unexecuted plans**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  git rm docs/superpowers/plans/2026-07-28-org-review-api.md \
         docs/superpowers/plans/2026-07-28-org-review-web.md
  ```

  Both are rewritten from scratch against the new spec once this plan lands.
  Marking them superseded rather than deleting would leave two long documents whose
  every task builds against tables that no longer exist.

  `2026-07-28-contribution-friction-cuts.md` is untouched — it is independent of
  the org model.

- [ ] **Step 3: Commit**

  ```bash
  git add docs/superpowers/plans/
  git commit -m "docs(plans): supersede the membership plans"
  ```

---

## Task 11: Full verification

- [ ] **Step 1: Reset from the migrations**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  npx supabase db reset
  ```

  Expected: `001`–`008` apply with no error. A syntax error in `007` surfaces here
  and nowhere else.

- [ ] **Step 2: Full API integration suite**

  ```bash
  cd packages/api
  npx vitest run -c vitest.integration.config.ts
  ```

  Expected: PASS. Wider than `tests/integration/orgs/` on purpose — the tutorials
  and admin suites write to `tutorials`, whose policy set changed.

- [ ] **Step 3: API unit suite and typecheck**

  ```bash
  npx vitest run tests/unit
  npx tsc --noEmit
  ```

- [ ] **Step 4: Web unit suite and typecheck**

  ```bash
  cd ../web
  npm run test:unit
  npx tsc --noEmit
  ```

- [ ] **Step 5: Refresh the graph and confirm a clean tree**

  ```bash
  cd ../..
  graphify update .
  git status --short
  git log --oneline development..HEAD | head -20
  ```

  Expected: clean tree; the commits from Tasks 1–10 at the top.

## Done when

- `org_members`, `trust_level`, `review_level`, `flagged_for_follow_up` and
  `tutorials.org_id` exist nowhere in the migrations, types, tests or `SCHEMA.md`.
- An author cannot write `accepted` on a backing row, and cannot add backing to a
  published tutorial.
- A leader can only answer for organisations they lead, cannot repoint an
  acceptance at another project, and cannot approve without an accepted backing
  row, an active organisation and accepted leader terms.
- Two organisations can back one project; either leader may approve; only accepted
  rows are publicly visible, and only on published tutorials.
- Backing can be withdrawn by either side until that organisation approved the
  tutorial.
- Only the admin writes `organizations` and `org_leaders`, and removing a leader
  revokes review immediately.
- Full API integration, both unit suites and both typechecks pass.
