# Org Accounts — Schema & RLS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-28-org-delegated-review-design.md` (§1, §2, §5)

**Goal:** Add the `organizations`, `org_members`, and `user_agreements` tables plus
every RLS policy that governs them, so that an approved org leader's authority to
review their own org's tutorials is enforced by PostgreSQL — not by route code.

**Architecture:** One migration (`007_organizations.sql`) following the shape of
`001_schema.sql`: tables, then `SECURITY DEFINER` helper functions, then policies.
Helpers exist to break RLS recursion (a policy on `org_members` cannot query
`org_members`) — the same trick `tutorial_is_approved()` already uses. Tests talk to
the database through an RLS-respecting client, so they assert on policies rather than
on route logic; no API routes exist yet at the end of this plan.

**Tech Stack:** PostgreSQL 15 (Supabase), `supabase` CLI, Vitest 2, `@supabase/supabase-js` v2.

**This plan is a prerequisite for:** `2026-07-28-org-review-api.md`.

## Global Constraints

- Migration file is `supabase/migrations/007_organizations.sql`. Do not edit
  `001_schema.sql` — 005/006 set the precedent that changes ship as new numbered files.
- Helper functions are `language sql security definer stable`, matching
  `is_admin()` (`001_schema.sql:88`). Parameters are prefixed `p_` so they never
  collide with a column name inside the function body.
- No `grant` statements needed: `004_data_api_grants.sql:20-25` sets
  `alter default privileges for role postgres in schema public`, which covers tables
  created by later migrations automatically.
- Every `org_members` policy checks `status = 'approved'`, never `org_role = 'leader'`
  alone — `('leader','pending')` is a representable and legitimate state (spec §1).
- Integration tests live in `packages/api/tests/integration/orgs/` and run with
  `pnpm --filter @splat-connect/api test:integration`.
- Test DB is local only; `tests/integration/setup.ts` throws if `SUPABASE_URL` is not
  localhost. Never point these at cloud.
- **One file per commit.** Every commit step below stages exactly one path. Where a task
  produces two files, it produces two commits, ordered so each stands alone. Conventional
  commits, matching recent history (`feat(db):`, `test(api):`, `docs(schema):`), and the
  message says what that specific file does — not what the task was.

## Spec deviations (deliberate, both resolve gaps in the spec)

1. **`tutorials.flagged_for_follow_up boolean not null default false` is added.**
   Spec §3 requires a spot-check "flag-for-follow-up boolean toggle" but §1 never
   lists the column. The endpoint cannot exist without it.
2. **`org_members.created_at` is added alongside the spec's `joined_at`.**
   `joined_at` is set when a membership reaches `approved`, so it is null for exactly
   the rows the leader's pending-requests queue must order by. One column, one line.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/007_organizations.sql` | **Create.** All tables, helpers, policies for this feature. Single file because the policies are meaningless without the tables and vice versa — they must apply atomically. |
| `packages/types/src/index.ts` | **Modify.** Add org/agreement types and the new `Tutorial` fields. Consumed by both API and web plans. |
| `packages/api/tests/integration/orgs/suspension.test.ts` | **Create.** Task 3 — the canary for decision 9. |
| `packages/api/tests/integration/orgs/membership-handshake.test.ts` | **Create.** Two-sided join/invite policies. |
| `packages/api/tests/integration/orgs/tutorial-review-grant.test.ts` | **Create.** Leader UPDATE grant: trust level, self-review, cross-org. |
| `packages/api/tests/integration/orgs/tutorial-read-grant.test.ts` | **Create.** Leader SELECT grant (spec §2, "load-bearing"). |
| `packages/api/tests/helpers/orgs.ts` | **Create.** Fixture builders (`createOrg`, `addMember`) shared by all four test files. Split out because four files need the same 30 lines. |
| `supabase/SCHEMA.md` | **Modify.** Living schema reference; stale docs here mislead every future task. |

Test files are split by *what they prove* rather than by table, so a failure name
tells you which spec guarantee broke.

---

## Task 1: Migration — tables and helper functions

**Files:**
- Create: `supabase/migrations/007_organizations.sql`

**Interfaces:**
- Produces: tables `public.organizations`, `public.org_members`,
  `public.user_agreements`; columns `tutorials.org_id`, `tutorials.review_level`,
  `tutorials.reviewed_by`, `tutorials.flagged_for_follow_up`; functions
  `is_org_leader(p_org_id uuid) → boolean`,
  `has_accepted(p_agreement_type text) → boolean`,
  `org_has_approved_leader(p_org_id uuid) → boolean`,
  `is_tutorial_contributor(p_tutorial_id uuid) → boolean`.

- [ ] **Step 1: Create the migration file with tables**

```sql
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
```

- [ ] **Step 2: Append the helper functions to the same file**

```sql
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
```

- [ ] **Step 3: Apply the migration and verify it runs clean**

```bash
supabase db reset
```

Expected: output ends with `Finished supabase db reset.` and no error mentioning
`007_organizations.sql`.

- [ ] **Step 4: Verify the objects exist**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d public.org_members" \
  -c "select proname from pg_proc where proname in ('is_org_leader','has_accepted','org_has_approved_leader','is_tutorial_contributor') order by proname;"
```

Expected: the `org_members` column list including `initiated_by`, and exactly four
rows: `has_accepted`, `is_org_leader`, `is_tutorial_contributor`,
`org_has_approved_leader`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/007_organizations.sql
git commit -m "feat(db): add organizations, org_members, and user_agreements tables"
```

---

## Task 2: Migration — RLS policies

**Files:**
- Modify: `supabase/migrations/007_organizations.sql` (append)

**Interfaces:**
- Consumes: all four helper functions from Task 1.
- Produces: the complete policy set. After this task the database enforces every
  authority rule in spec §2 with no application code involved.

- [ ] **Step 1: Append organizations and user_agreements policies**

```sql
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
```

- [ ] **Step 2: Append org_members policies**

```sql
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
```

- [ ] **Step 3: Append the tutorials leader policies**

```sql
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
```

- [ ] **Step 4: Apply and verify the policies loaded**

```bash
supabase db reset && psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "select tablename, policyname from pg_policies where tablename in ('organizations','org_members','user_agreements') order by tablename, policyname;"
```

Expected: **9** policies on `org_members` (3 SELECT, 3 INSERT, 2 UPDATE, 1 admin
`FOR ALL`), 5 on `organizations`, 3 on `user_agreements`. No errors.

- [ ] **Step 5: Verify the existing suite still passes**

```bash
pnpm --filter @splat-connect/api test:integration
```

Expected: PASS. The new columns are nullable or defaulted, so no existing test
should change behaviour. If `tutorials` tests fail, the added columns broke an
insert — fix before continuing.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/007_organizations.sql
git commit -m "feat(db): add RLS policies for org membership and delegated review"
```

---

## Task 3: The suspension test (write this one first)

**Files:**
- Create: `packages/api/tests/helpers/orgs.ts`
- Create: `packages/api/tests/integration/orgs/suspension.test.ts`

**Interfaces:**
- Consumes: `createTestUser`, `deleteTestUser`, `adminClient`, `TestUser` from
  `tests/helpers/auth.js`; `createUserClient` from `src/supabase/user-client.js`.
- Produces: `createOrg(opts) → Promise<string>` (returns org id) and
  `addMember(opts) → Promise<string>` (returns member row id) in
  `tests/helpers/orgs.ts`, used by Tasks 4–6.

**Why first:** this is the only test that asserts anything under decision 9. It
suspends the org mid-test and re-attempts an update that just succeeded. Under a
service-role client the second attempt would also succeed and the test would prove
nothing. It is a direct check that authority lives in the database.

- [ ] **Step 1: Write the fixture helper**

```typescript
// packages/api/tests/helpers/orgs.ts
import { adminClient } from './auth.js'

/** Service-role fixture builders. Tests exercise policies through a user client;
 *  setup deliberately bypasses RLS so a broken policy fails the assertion, not
 *  the arrangement. */
export async function createOrg(opts: {
  createdBy: string
  status?: 'pending' | 'approved' | 'suspended'
  trustLevel?: 'probation' | 'trusted'
  name?: string
}): Promise<string> {
  const { data, error } = await adminClient()
    .from('organizations')
    .insert({
      name: opts.name ?? `Test Org ${crypto.randomUUID().slice(0, 8)}`,
      created_by: opts.createdBy,
      status: opts.status ?? 'approved',
      trust_level: opts.trustLevel ?? 'trusted',
    })
    .select('id')
    .single()
  if (error) throw new Error(`createOrg failed: ${error.message}`)
  return data.id as string
}

export async function addMember(opts: {
  orgId: string
  userId: string
  orgRole?: 'leader' | 'member'
  status?: 'pending' | 'approved' | 'removed' | 'declined'
  initiatedBy?: 'contributor' | 'org'
}): Promise<string> {
  const { data, error } = await adminClient()
    .from('org_members')
    .insert({
      org_id: opts.orgId,
      user_id: opts.userId,
      org_role: opts.orgRole ?? 'member',
      status: opts.status ?? 'approved',
      initiated_by: opts.initiatedBy ?? 'org',
    })
    .select('id')
    .single()
  if (error) throw new Error(`addMember failed: ${error.message}`)
  return data.id as string
}

export async function acceptTerms(userId: string, type: 'contributor_terms' | 'org_leader_terms') {
  const { error } = await adminClient()
    .from('user_agreements')
    .insert({ user_id: userId, agreement_type: type, version: 'v0-todo' })
  if (error) throw new Error(`acceptTerms failed: ${error.message}`)
}

/** Creates a tutorial owned by `authorId` and stamped with `orgId`. */
export async function createOrgTutorial(opts: {
  orgId: string | null
  authorId: string
  status?: 'draft' | 'pending' | 'approved' | 'rejected'
}): Promise<string> {
  const admin = adminClient()
  const id = crypto.randomUUID()
  const { error } = await admin.from('tutorials').insert({
    id,
    title: 'Org Review Fixture',
    difficulty: 'easy',
    status: opts.status ?? 'pending',
    org_id: opts.orgId,
    review_level: opts.orgId ? 'org' : 'platform',
  })
  if (error) throw new Error(`createOrgTutorial failed: ${error.message}`)
  const { error: linkError } = await admin
    .from('tutorial_contributors')
    .insert({ tutorial_id: id, profile_id: opts.authorId })
  if (linkError) throw new Error(`createOrgTutorial link failed: ${linkError.message}`)
  return id
}

export async function cleanupOrg(orgId: string, tutorialIds: string[] = []) {
  const admin = adminClient()
  if (tutorialIds.length) await admin.from('tutorials').delete().in('id', tutorialIds)
  await admin.from('org_members').delete().eq('org_id', orgId)
  await admin.from('organizations').delete().eq('id', orgId)
}
```

- [ ] **Step 2: Write the failing suspension test**

```typescript
// packages/api/tests/integration/orgs/suspension.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createOrg, addMember, createOrgTutorial, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let member: TestUser
let orgId: string
let tutorialId: string

beforeAll(async () => {
  leader = await createTestUser('contributor')
  member = await createTestUser('contributor')
  orgId = await createOrg({ createdBy: leader.id, status: 'approved', trustLevel: 'trusted' })
  await addMember({ orgId, userId: leader.id, orgRole: 'leader', status: 'approved' })
  await addMember({ orgId, userId: member.id, orgRole: 'member', status: 'approved' })
  tutorialId = await createOrgTutorial({ orgId, authorId: member.id, status: 'pending' })
})

afterAll(async () => {
  await cleanupOrg(orgId, [tutorialId])
  await deleteTestUser(leader.id)
  await deleteTestUser(member.id)
})

describe('suspending an org revokes leader review authority', () => {
  it('revokes the approve capability the moment the org is suspended', async () => {
    const leaderDb = createUserClient(leader.token)

    // 1. Baseline: the grant works while the org is approved + trusted.
    const before = await leaderDb
      .from('tutorials')
      .update({ status: 'approved', reviewed_by: leader.id, review_level: 'org' })
      .eq('id', tutorialId)
      .select('id')
    expect(before.error).toBeNull()
    expect(before.data).toHaveLength(1)

    // Reset so the second attempt is identical to the first.
    await adminClient().from('tutorials').update({ status: 'pending' }).eq('id', tutorialId)

    // 2. Suspend the org out from under the leader.
    await adminClient().from('organizations').update({ status: 'suspended' }).eq('id', orgId)

    // 3. The identical update must now affect zero rows. An RLS USING clause that
    //    excludes the row is not an error — it silently matches nothing. Asserting
    //    on the row count is what makes this test real.
    const after = await leaderDb
      .from('tutorials')
      .update({ status: 'approved' })
      .eq('id', tutorialId)
      .select('id')
    expect(after.data ?? []).toHaveLength(0)

    const { data: check } = await adminClient()
      .from('tutorials')
      .select('status')
      .eq('id', tutorialId)
      .single()
    expect(check?.status).toBe('pending')
  })
})
```

- [ ] **Step 3: Run it and verify it passes**

```bash
pnpm --filter @splat-connect/api test:integration -- tests/integration/orgs/suspension.test.ts
```

Expected: PASS. If step 1's baseline update returns zero rows, the leader UPDATE
policy from Task 2 Step 3 is wrong — debug that before proceeding, because every
later test depends on the grant working.

- [ ] **Step 4: Prove the test can fail (guard against a vacuous assertion)**

Temporarily change the suspend line to `.update({ status: 'approved' })` (a no-op)
and re-run. Expected: FAIL at `expect(after.data).toHaveLength(0)`, because the
grant is still live. Revert the line and re-run to confirm PASS.

This step exists because a test that asserts "zero rows changed" passes trivially if
the update was never going to work. Proving it fails when authority *should* persist
is the only way to know it is measuring the suspension.

- [ ] **Step 5: Commit the fixture helper**

```bash
git add packages/api/tests/helpers/orgs.ts
git commit -m "test(api): add org fixture builders for membership and review tests"
```

- [ ] **Step 6: Commit the suspension test**

```bash
git add packages/api/tests/integration/orgs/suspension.test.ts
git commit -m "test(api): assert org suspension instantly revokes leader review grant"
```

---

## Task 4: Leader review grant — trust level, self-review, cross-org

**Files:**
- Create: `packages/api/tests/integration/orgs/tutorial-review-grant.test.ts`

**Interfaces:**
- Consumes: `createOrg`, `addMember`, `createOrgTutorial`, `cleanupOrg` from
  `tests/helpers/orgs.js`; `createUserClient`.

Covers spec §5 tests 1, 2, and 3.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createOrg, addMember, createOrgTutorial, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let member: TestUser
let outsider: TestUser
let trustedOrg: string
let probationOrg: string
let memberTutorial: string
let leaderOwnTutorial: string
let outsiderTutorial: string
let probationTutorial: string

beforeAll(async () => {
  leader = await createTestUser('contributor')
  member = await createTestUser('contributor')
  outsider = await createTestUser('contributor')

  trustedOrg = await createOrg({ createdBy: leader.id, status: 'approved', trustLevel: 'trusted' })
  await addMember({ orgId: trustedOrg, userId: leader.id, orgRole: 'leader', status: 'approved' })
  await addMember({ orgId: trustedOrg, userId: member.id, orgRole: 'member', status: 'approved' })

  probationOrg = await createOrg({ createdBy: leader.id, status: 'approved', trustLevel: 'probation' })
  await addMember({ orgId: probationOrg, userId: leader.id, orgRole: 'leader', status: 'approved' })

  memberTutorial = await createOrgTutorial({ orgId: trustedOrg, authorId: member.id })
  // The leader is a tutorial_contributor on this one — the self-review case.
  leaderOwnTutorial = await createOrgTutorial({ orgId: trustedOrg, authorId: leader.id })
  // Carries no org_id: the platform queue, nobody's org to review.
  outsiderTutorial = await createOrgTutorial({ orgId: null, authorId: outsider.id })
  probationTutorial = await createOrgTutorial({ orgId: probationOrg, authorId: member.id })
})

afterAll(async () => {
  await cleanupOrg(trustedOrg, [memberTutorial, leaderOwnTutorial, outsiderTutorial])
  await cleanupOrg(probationOrg, [probationTutorial])
  await deleteTestUser(leader.id)
  await deleteTestUser(member.id)
  await deleteTestUser(outsider.id)
})

/** An RLS-blocked UPDATE matches zero rows rather than erroring, so every
 *  assertion here is on the affected row count. */
async function tryApprove(token: string, tutorialId: string): Promise<number> {
  const { data } = await createUserClient(token)
    .from('tutorials')
    .update({ status: 'approved' })
    .eq('id', tutorialId)
    .select('id')
  return (data ?? []).length
}

describe('leader review grant', () => {
  it("approves a member's tutorial in a trusted, approved org", async () => {
    expect(await tryApprove(leader.token, memberTutorial)).toBe(1)
  })

  it('cannot approve a tutorial from outside the org', async () => {
    expect(await tryApprove(leader.token, outsiderTutorial)).toBe(0)
  })

  it('cannot approve its own tutorial, even as a linked collaborator', async () => {
    expect(await tryApprove(leader.token, leaderOwnTutorial)).toBe(0)
  })

  it('cannot approve anything while the org is on probation', async () => {
    expect(await tryApprove(leader.token, probationTutorial)).toBe(0)
  })

  it('a plain member has no review grant over their own org', async () => {
    expect(await tryApprove(member.token, memberTutorial)).toBe(0)
  })
})
```

- [ ] **Step 2: Run and verify all five pass**

```bash
pnpm --filter @splat-connect/api test:integration -- tests/integration/orgs/tutorial-review-grant.test.ts
```

Expected: 5 passed.

Note the fifth test is subtle: `member` is a `tutorial_contributor` on
`memberTutorial`, so the *existing* `"Contributors can update own tutorials"` policy
matches — but its `WITH CHECK` forbids leaving the row in `'approved'`, so the update
is rejected. If this returns 1, that existing guard has regressed.

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/integration/orgs/tutorial-review-grant.test.ts
git commit -m "test(api): cover leader review grant boundaries (trust, self-review, cross-org)"
```

---

## Task 5: Leader read grant

**Files:**
- Create: `packages/api/tests/integration/orgs/tutorial-read-grant.test.ts`

Covers spec §5 test 8. Without the SELECT policy the leader dashboard shows an empty
queue and the review screen 404s, so this is a functional test, not just a security one.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createOrg, addMember, createOrgTutorial, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let otherLeader: TestUser
let member: TestUser
let orgId: string
let otherOrgId: string
let draftId: string

beforeAll(async () => {
  leader = await createTestUser('contributor')
  otherLeader = await createTestUser('contributor')
  member = await createTestUser('contributor')

  orgId = await createOrg({ createdBy: leader.id })
  await addMember({ orgId, userId: leader.id, orgRole: 'leader', status: 'approved' })
  await addMember({ orgId, userId: member.id, orgRole: 'member', status: 'approved' })

  otherOrgId = await createOrg({ createdBy: otherLeader.id })
  await addMember({ orgId: otherOrgId, userId: otherLeader.id, orgRole: 'leader', status: 'approved' })

  // A DRAFT, not pending: proves the read grant is not scoped to submitted work.
  draftId = await createOrgTutorial({ orgId, authorId: member.id, status: 'draft' })
})

afterAll(async () => {
  await cleanupOrg(orgId, [draftId])
  await cleanupOrg(otherOrgId)
  await deleteTestUser(leader.id)
  await deleteTestUser(otherLeader.id)
  await deleteTestUser(member.id)
})

describe('leader read grant', () => {
  it("reads an unpublished tutorial belonging to their own org", async () => {
    const { data } = await createUserClient(leader.token)
      .from('tutorials')
      .select('id, status')
      .eq('id', draftId)
    expect(data).toHaveLength(1)
    expect(data?.[0].status).toBe('draft')
  })

  it("a leader of a different org cannot read it", async () => {
    const { data } = await createUserClient(otherLeader.token)
      .from('tutorials')
      .select('id')
      .eq('id', draftId)
    expect(data ?? []).toHaveLength(0)
  })

  it('the read grant survives probation, unlike the write grant', async () => {
    const probation = await createOrg({ createdBy: leader.id, trustLevel: 'probation' })
    await addMember({ orgId: probation, userId: leader.id, orgRole: 'leader', status: 'approved' })
    const t = await createOrgTutorial({ orgId: probation, authorId: member.id })

    const { data } = await createUserClient(leader.token).from('tutorials').select('id').eq('id', t)
    expect(data).toHaveLength(1)

    await cleanupOrg(probation, [t])
  })
})
```

- [ ] **Step 2: Run and verify**

```bash
pnpm --filter @splat-connect/api test:integration -- tests/integration/orgs/tutorial-read-grant.test.ts
```

Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/integration/orgs/tutorial-read-grant.test.ts
git commit -m "test(api): assert leaders can read their org's unpublished tutorials"
```

---

## Task 6: Membership handshake

**Files:**
- Create: `packages/api/tests/integration/orgs/membership-handshake.test.ts`

Covers spec §5 tests 6, 7, 10, and 12 — the `initiated_by` split, which is the
security story for membership.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createOrg, addMember, acceptTerms, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let joiner: TestUser
let orgId: string
let otherOrgId: string

beforeAll(async () => {
  leader = await createTestUser('contributor')
  joiner = await createTestUser('contributor')
  await acceptTerms(leader.id, 'org_leader_terms')

  orgId = await createOrg({ createdBy: leader.id, status: 'approved' })
  await addMember({ orgId, userId: leader.id, orgRole: 'leader', status: 'approved' })
  otherOrgId = await createOrg({ createdBy: leader.id, status: 'approved' })
})

afterAll(async () => {
  await cleanupOrg(orgId)
  await cleanupOrg(otherOrgId)
  await deleteTestUser(leader.id)
  await deleteTestUser(joiner.id)
})

describe('membership handshake', () => {
  it('a contributor cannot approve their own join request', async () => {
    const joinerDb = createUserClient(joiner.token)
    const { data: inserted, error } = await joinerDb
      .from('org_members')
      .insert({ org_id: orgId, user_id: joiner.id, initiated_by: 'contributor', status: 'pending', org_role: 'member' })
      .select('id')
      .single()
    expect(error).toBeNull()

    // Their own UPDATE policy requires initiated_by = 'org'; this row is
    // 'contributor', so the WITH CHECK excludes it.
    const { data: escalated } = await joinerDb
      .from('org_members')
      .update({ status: 'approved' })
      .eq('id', inserted!.id)
      .select('id')
    expect(escalated ?? []).toHaveLength(0)

    // The leader can resolve it, because the contributor initiated it.
    const { data: approved } = await createUserClient(leader.token)
      .from('org_members')
      .update({ status: 'approved' })
      .eq('id', inserted!.id)
      .select('id')
    expect(approved).toHaveLength(1)

    await adminClient().from('org_members').delete().eq('id', inserted!.id)
  })

  it('a contributor cannot request to join as a leader', async () => {
    const { error } = await createUserClient(joiner.token)
      .from('org_members')
      .insert({ org_id: otherOrgId, user_id: joiner.id, initiated_by: 'contributor', status: 'pending', org_role: 'leader' })
    // No INSERT policy matches org_role = 'leader' from this path.
    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501')
  })

  it("a leader cannot accept an invitation on the contributor's behalf", async () => {
    const memberRowId = await addMember({
      orgId, userId: joiner.id, orgRole: 'member', status: 'pending', initiatedBy: 'org',
    })

    const { data: forced } = await createUserClient(leader.token)
      .from('org_members')
      .update({ status: 'approved' })
      .eq('id', memberRowId)
      .select('id')
    expect(forced ?? []).toHaveLength(0)

    // The invited contributor themselves can accept it.
    const { data: accepted } = await createUserClient(joiner.token)
      .from('org_members')
      .update({ status: 'approved' })
      .eq('id', memberRowId)
      .select('id')
    expect(accepted).toHaveLength(1)

    await adminClient().from('org_members').delete().eq('id', memberRowId)
  })

  it('a declined membership can be revived to pending by the leader', async () => {
    const rowId = await addMember({
      orgId, userId: joiner.id, status: 'declined', initiatedBy: 'org',
    })
    const { data } = await createUserClient(leader.token)
      .from('org_members')
      .update({ status: 'pending' })
      .eq('id', rowId)
      .select('id')
    expect(data).toHaveLength(1)
    await adminClient().from('org_members').delete().eq('id', rowId)
  })

  it('the org creator can claim first leadership, but only of their own org', async () => {
    const freshOrg = await createOrg({ createdBy: leader.id, status: 'pending' })
    const leaderDb = createUserClient(leader.token)

    const { error: ok } = await leaderDb.from('org_members').insert({
      org_id: freshOrg, user_id: leader.id, org_role: 'leader', status: 'approved', initiated_by: 'org',
    })
    expect(ok).toBeNull()

    // A second claim on the same org is refused: it already has a leader.
    const { error: second } = await createUserClient(joiner.token).from('org_members').insert({
      org_id: freshOrg, user_id: joiner.id, org_role: 'leader', status: 'approved', initiated_by: 'org',
    })
    expect(second).not.toBeNull()

    await cleanupOrg(freshOrg)
  })
})
```

- [ ] **Step 2: Run and verify**

```bash
pnpm --filter @splat-connect/api test:integration -- tests/integration/orgs/membership-handshake.test.ts
```

Expected: 5 passed. A blocked INSERT raises PostgREST error `42501`
(`new row violates row-level security policy`); a blocked UPDATE silently matches
zero rows. The assertions differ accordingly — do not "fix" one to look like the other.

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/integration/orgs/membership-handshake.test.ts
git commit -m "test(api): assert neither party can complete an org membership alone"
```

---

## Task 7: Shared types

**Files:**
- Modify: `packages/types/src/index.ts`

**Interfaces:**
- Produces: `OrgStatus`, `OrgTrustLevel`, `OrgRole`, `OrgMemberStatus`, `InitiatedBy`,
  `ReviewLevel`, `AgreementType`, `Organization`, `OrgMember`, `UserAgreement`,
  `AGREEMENT_VERSIONS`, and four new `Tutorial` fields. Every one of these is
  consumed by `2026-07-28-org-review-api.md` and `-web.md`.

- [ ] **Step 1: Append the new types after `ContributorRole` (line 31)**

```typescript
export type OrgStatus = 'pending' | 'approved' | 'suspended'
export type OrgTrustLevel = 'probation' | 'trusted'
export type OrgRole = 'leader' | 'member'
export type OrgMemberStatus = 'pending' | 'approved' | 'removed' | 'declined'
export type InitiatedBy = 'contributor' | 'org'
export type ReviewLevel = 'org' | 'platform'
export type AgreementType = 'contributor_terms' | 'org_leader_terms'

// The version string recorded against an acceptance. 'v0-todo' is deliberately
// non-binding: the real terms have not been written (they need a lawyer — see
// the spec's §6). Any acceptance recorded at this version is void and its rows
// should be discarded when real terms land.
export const AGREEMENT_VERSIONS: Record<AgreementType, string> = {
  contributor_terms: 'v0-todo',
  org_leader_terms: 'v0-todo',
}

export interface Organization {
  id: string
  name: string
  description: string | null
  status: OrgStatus
  trust_level: OrgTrustLevel
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  org_role: OrgRole
  status: OrgMemberStatus
  initiated_by: InitiatedBy
  invited_by: string | null
  created_at: string
  joined_at: string | null
  // Populated when the query joins profiles (roster and queue views).
  profiles?: Profile
  organizations?: Organization
}

export interface UserAgreement {
  id: string
  user_id: string
  agreement_type: AgreementType
  version: string
  accepted_at: string
}
```

- [ ] **Step 2: Add the four new fields to the `Tutorial` interface**

Modify `packages/types/src/index.ts:41-52`, adding after `reviewed_at`:

```typescript
  // Snapshot of the org at submit time; null routes to the platform queue.
  org_id: string | null
  review_level: ReviewLevel | null
  reviewed_by: string | null
  flagged_for_follow_up: boolean
```

- [ ] **Step 3: Typecheck the workspace**

```bash
pnpm typecheck
```

Expected: PASS. `Tutorial` gained required fields, so any object literal typed as a
full `Tutorial` will now error. If web code fails, it is constructing a partial
`Tutorial` — widen that call site to `Partial<Tutorial>` rather than making the new
fields optional; the database guarantees they are present on a real row.

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): add organization, membership, and agreement types"
```

---

## Task 8: Update the schema reference

**Files:**
- Modify: `supabase/SCHEMA.md`

- [ ] **Step 1: Read the existing structure**

```bash
grep -n "^#\|^##" supabase/SCHEMA.md
```

Match the existing heading levels and table-documentation format exactly.

- [ ] **Step 2: Document the three new tables in the "Tables" section**

Add `organizations`, `org_members`, and `user_agreements` with the same
column/type/notes layout the file already uses for `tutorials`. Add the four new
`tutorials` columns to that table's entry.

- [ ] **Step 3: Document the new policies in the "Row Level Security" section**

One line per policy, using the existing phrasing style. Include the three sentences
that a reader cannot reconstruct from the SQL:
- `is_org_leader()` bakes in `status = 'approved'` so no policy checks leadership half-right.
- The tutorials leader SELECT policy is deliberately broader than the UPDATE policy.
- A leader can read their org members' unpublished drafts.

- [ ] **Step 4: Commit**

```bash
git add supabase/SCHEMA.md
git commit -m "docs(schema): document organization tables and delegated review policies"
```

---

## Task 9: Full-suite verification

- [ ] **Step 1: Reset the database and run every integration test**

```bash
supabase db reset && pnpm --filter @splat-connect/api test:integration
```

Expected: all suites pass, including the four new files in `tests/integration/orgs/`.

- [ ] **Step 2: Run unit tests and typecheck**

```bash
pnpm --filter @splat-connect/api test:unit && pnpm typecheck
```

Expected: PASS both.

- [ ] **Step 3: Refresh the knowledge graph**

```bash
graphify update .
```

- [ ] **Step 4: Commit any graph changes**

```bash
git add graphify-out
git commit -m "chore(graph): update after org schema migration"
```

---

## Done when

- `supabase db reset` applies 007 cleanly from scratch.
- All four `tests/integration/orgs/` suites pass.
- The suspension test has been demonstrated to fail when the suspension is removed
  (Task 3 Step 4) — the plan's single most important verification.
- `pnpm typecheck` passes across the workspace.

**Next plan:** `docs/superpowers/plans/2026-07-28-org-review-api.md`.
