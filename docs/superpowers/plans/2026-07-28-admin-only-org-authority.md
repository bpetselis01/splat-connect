# Admin-Only Organisation Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans` to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

> **Superseded 2026-07-28** by
> `docs/superpowers/plans/2026-07-28-project-org-schema-rls.md`. The membership
> model this plan built — `org_members`, the two-sided handshake, `trust_level`,
> `review_level` — was replaced by per-project organisation backing. Kept as the
> record of what was tried; do not execute it.


**Goal:** Make the platform admin the only account that can create an
organisation or grant `org_role = 'leader'`, and move the `org_leader_terms`
gate from org creation to the leader review grant.

**Architecture:** Three RLS changes to the already-written
`supabase/migrations/007_organizations.sql`, each landed with the integration
test that proves it, plus revisions to the two plans (API, Web) that have not
been executed yet so they build the admin-only version rather than the
contributor-initiated one.

**Tech Stack:** PostgreSQL 15 (Supabase local), Row Level Security policies and
`plpgsql` triggers, Vitest integration tests running against the live local
database via `@supabase/supabase-js`.

## Global Constraints

- Work happens on the `feat/org-accounts-schema-rls` worktree at
  `.worktrees/org-accounts-schema-rls`, **not** the main checkout. Another agent
  may hold the main checkout on a different branch.
- `007_organizations.sql` is unmerged, so it is edited **in place**. Do not add a
  `009` migration for these changes.
- Every migration edit requires `npx supabase db reset` before tests are run.
  Editing the SQL file alone changes nothing in the running database.
- Local Supabase is reached at `127.0.0.1`, never `localhost` — an Android
  emulator can bind `::1:54321` and shadow it.
- Integration tests run serially against one shared database. Any fixture
  created inside a test body must be hoisted to a module-level variable so
  `afterAll` can clean it up when an assertion throws.
- Tests assert against the database through a **user client**
  (`createUserClient(token)`), never the service role. A service-role client
  bypasses RLS entirely, so a test written that way asserts nothing about a
  policy. Service role is for fixture setup and ground-truth reads only.
- An RLS `USING` block matches zero rows and returns **no error**. An RLS
  `WITH CHECK` block returns error code **`42501`**. Assert on whichever one the
  policy under test actually produces, and assert on both `error` and the row
  count — PostgREST nulls `data` whenever `error` is set, so a row-count-only
  assertion also passes when the write failed for an unrelated reason.
- Each task commits once, containing both the migration hunk and its test
  changes, so every commit on the branch is green. Splitting them would leave a
  red commit either way: the existing tests encode the superseded behaviour.
- Commit messages end with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## Scope

**In scope:** the RLS layer that exists on this branch, its tests, the schema
reference, and the three plan documents.

**Not in scope:** implementing `routes/organizations.ts`, the admin org
endpoints, or any web page. None of that code exists yet — the API and Web plans
have not been executed. Tasks 6 and 7 revise those plans so that when they *are*
executed they produce the admin-only design; they do not write the routes.

## File Structure

| File | Task | Responsibility |
|---|---|---|
| `supabase/migrations/007_organizations.sql` | 1, 2, 3 | All authority rules. Three separate hunks. |
| `packages/api/tests/integration/orgs/membership-handshake.test.ts` | 1, 2 | Who may create an org; who may become a leader. |
| `packages/api/tests/integration/orgs/tutorial-review-grant.test.ts` | 3 | The four conditions on the leader review grant. |
| `packages/api/tests/integration/orgs/suspension.test.ts` | 3 | Fixture repair only — its leader now needs terms. |
| `supabase/SCHEMA.md` | 4 | Schema reference, kept in step with the migration. |
| `docs/superpowers/plans/2026-07-28-org-review-schema-rls.md` | 5 | Retro-fit the executed plan to what the migration now says. |
| `docs/superpowers/plans/2026-07-28-org-review-api.md` | 6 | Unexecuted. Must build admin endpoints, not a contributor one. |
| `docs/superpowers/plans/2026-07-28-org-review-web.md` | 7 | Unexecuted. Create/promote UI moves to `/admin`. |

---

## Task 1: Admin-only organisation creation

Deletes the contributor INSERT policy, the founder bootstrap that let the
creator self-claim leadership, the `created_by`-scoped read policy, and the
`org_has_approved_leader()` helper that only the bootstrap used.

**Files:**
- Modify: `supabase/migrations/007_organizations.sql:106-114, 139-140, 145-153, 183-199`
- Test: `packages/api/tests/integration/orgs/membership-handshake.test.ts:18-36, 38-65, 177-208`

**Interfaces:**
- Consumes: `public.is_admin()` (defined in `001_schema.sql`),
  `createTestUser('admin')` from `tests/helpers/auth.ts`.
- Produces: no policy on `organizations` INSERT other than
  `"Admin can create organizations"`. Task 4 documents it; Tasks 6 and 7 build
  endpoints and UI against it.

- [ ] **Step 1: Add an admin test user to the suite fixture**

  In `membership-handshake.test.ts`, add `admin` to the module-level
  declarations beside `leader` and `joiner`, and rename the hoisted `termsOrg`
  to `adminOrg`:

  ```typescript
  let leader: TestUser
  let joiner: TestUser
  let admin: TestUser
  let orgId: string
  let otherOrgId: string
  // Created inline inside individual tests. Hoisted so afterAll can clean them up
  // even if an assertion throws before the test body reaches its own cleanup —
  // the suite runs serially against one shared database, so a leaked org can
  // corrupt later tests.
  let adminOrg: string | undefined
  ```

  Replace `beforeAll` and `afterAll` in full:

  ```typescript
  beforeAll(async () => {
    leader = await createTestUser('contributor')
    joiner = await createTestUser('contributor')
    admin = await createTestUser('admin')
    // Kept deliberately: it is what makes the refusal in the first test
    // attributable to is_admin() rather than to a missing agreement.
    await acceptTerms(leader.id, 'org_leader_terms')

    orgId = await createOrg({ createdBy: leader.id, status: 'approved' })
    await addMember({ orgId, userId: leader.id, orgRole: 'leader', status: 'approved' })
    otherOrgId = await createOrg({ createdBy: leader.id, status: 'approved' })
  })

  afterAll(async () => {
    await cleanupOrg(orgId)
    await cleanupOrg(otherOrgId)
    if (adminOrg) await cleanupOrg(adminOrg)
    await deleteTestUser(leader.id)
    await deleteTestUser(joiner.id)
    await deleteTestUser(admin.id)
  })
  ```

- [ ] **Step 2: Replace the terms-gate test with the admin-gate test**

  Replace the whole first `it(...)` block (currently
  `'creating an org requires an accepted org_leader_terms row'`, lines 38–65
  including its leading comment) with:

  ```typescript
  describe('membership handshake', () => {
    // Every other org in this suite is built with the service role, which bypasses
    // RLS outright — so this is the only place the organizations INSERT policy runs
    // at all. Without this test, decision 11 would be enforced by nothing any test
    // can see.
    it('only an admin can create an organization', async () => {
      const attempt = (u: TestUser) =>
        createUserClient(u.token)
          .from('organizations')
          .insert({
            name: `Admin Gate ${crypto.randomUUID().slice(0, 8)}`,
            created_by: u.id,
            status: 'approved',
            trust_level: 'trusted',
          })
          .select('id')
          .single()

      // A contributor who HAS accepted org_leader_terms — precisely the account the
      // superseded policy would have admitted. The agreement is no longer a key.
      const { error: refused } = await attempt(leader)
      expect(refused?.code).toBe('42501')

      // Same statement, admin JWT, opposite outcome — so the block above is
      // attributable to is_admin() and not to some other conjunct.
      const { data, error: allowed } = await attempt(admin)
      expect(allowed).toBeNull()
      adminOrg = data!.id as string
    })
  ```

- [ ] **Step 3: Delete the two founder-bootstrap tests**

  Delete both `it(...)` blocks at the end of the file:
  `'the org creator can claim first leadership, but only of their own org'` and
  `'the founder-bootstrap policy also refuses a non-creator, independent of
  leader state'` (lines 177–208), together with the now-unused `freshOrg` and
  `foreignOrg` module variables and their `afterAll` cleanup lines. The policy
  they cover no longer exists.

- [ ] **Step 4: Run the suite and verify it fails**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/membership-handshake.test.ts
  ```

  Expected: FAIL on `only an admin can create an organization` — `refused?.code`
  is `undefined` rather than `'42501'`, because the contributor INSERT policy is
  still in place and `leader` still satisfies it.

- [ ] **Step 5: Delete `org_has_approved_leader()` from the migration**

  Remove lines 106–114 of `007_organizations.sql` entirely — the two comment
  lines and the function:

  ```sql
  -- Used only by the founder-bootstrap policy, which must ask "does this org
  -- already have a leader?" from inside an org_members policy.
  create or replace function public.org_has_approved_leader(p_org_id uuid)
  returns boolean as $$
    select exists (
      select 1 from public.org_members
      where org_id = p_org_id and org_role = 'leader' and status = 'approved'
    );
  $$ language sql security definer stable;
  ```

- [ ] **Step 6: Replace the organizations INSERT and SELECT policies**

  Delete the `created_by`-scoped read policy:

  ```sql
  create policy "Creator can read own organization at any status"
    on public.organizations for select using (created_by = auth.uid());
  ```

  It is dead weight now: `created_by` is always the admin and
  `"Admin can read all organizations"` already covers them.

  Then replace the contributor INSERT policy:

  ```sql
  create policy "Contributors who accepted leader terms can create organizations"
    on public.organizations for insert
    with check (
      created_by = auth.uid()
      and public.is_approved_contributor()
      and public.has_accepted('org_leader_terms')
      and status = 'pending'
      and trust_level = 'probation'
    );
  ```

  with:

  ```sql
  -- Decision 11: an organisation is the unit that carries review authority, so the
  -- admin decides which ones exist. There is no contributor create path and no
  -- pending-proposal queue — with a single admin there is no second party to wait
  -- for, so creation and approval are one action. No status/trust_level conjunct
  -- here: the admin is the party being trusted. The create endpoint sets both
  -- explicitly rather than leaning on the column defaults, which stay
  -- pending/probation so a row written by a path that forgets is inert.
  create policy "Admin can create organizations"
    on public.organizations for insert
    with check (public.is_admin());
  ```

- [ ] **Step 7: Delete the founder-bootstrap policy**

  Remove the comment block and policy at lines 183–199:

  ```sql
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
  ```

  Replace it with a comment recording why nothing sits here, so the deadlock
  argument is not rediscovered and the policy reinstated:

  ```sql
  -- No first-leader INSERT policy. The org's first leader is written by
  -- POST /api/admin/organizations under "Admin full access to org_members" below
  -- (a FOR ALL policy with only a USING clause, which Postgres also applies as the
  -- WITH CHECK on INSERT). A founder-bootstrap policy stood here, scoped to
  -- created_by, purely so a self-creating contributor could claim leadership
  -- without deadlocking against the invite policy's is_org_leader(org_id).
  -- Decision 11 removes the self-creating contributor, so it removes the deadlock
  -- and the policy with it.
  ```

- [ ] **Step 8: Reset the database and verify the suite passes**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  npx supabase db reset
  cd packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/membership-handshake.test.ts
  ```

  Expected: PASS, all remaining tests in the file.

- [ ] **Step 9: Commit**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  git add supabase/migrations/007_organizations.sql \
          packages/api/tests/integration/orgs/membership-handshake.test.ts
  git commit -m "$(cat <<'EOF'
  feat(db): make organisation creation admin-only

  Any contributor holding accepted org_leader_terms could create an org and then
  claim its first leadership through the founder-bootstrap policy, which made the
  platform's trust boundary something a form could draw. Decision 11 moves both to
  the admin.

  Drops the contributor INSERT policy, the bootstrap policy, the created_by read
  policy that only the founder needed, and org_has_approved_leader(), which had no
  other caller. The two tests covering the bootstrap's created_by scope go with it.

  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Task 2: A leader cannot mint a co-leader

The invite policy constrains `initiated_by` and `status` but not `org_role`, so
a leader can invite someone straight in as `('leader', 'pending')`. The
`org_role` trigger cannot catch it: it is `BEFORE UPDATE`, and this is an
INSERT.

**Files:**
- Modify: `supabase/migrations/007_organizations.sql:216-227` (invite policy) and
  `:326-333` (the trigger comment that documents the gap as deliberate)
- Test: `packages/api/tests/integration/orgs/membership-handshake.test.ts`

**Interfaces:**
- Consumes: `is_org_leader(org_id)` and the `org_members` table from Task 1's
  file state.
- Produces: the invariant that `org_role = 'leader'` is reachable on INSERT only
  through `"Admin full access to org_members"`. Task 4 documents it.

- [ ] **Step 1: Write the failing test**

  Add to `membership-handshake.test.ts`, directly after the
  `'a contributor cannot request to join as a leader'` test:

  ```typescript
  it('a leader cannot invite someone straight in as a leader', async () => {
    // The org_role trigger is BEFORE UPDATE, so it cannot see this INSERT. The only
    // thing standing here is the invite policy's org_role = 'member' conjunct —
    // drop it and a leader grows their org's review authority without the admin
    // ever seeing it.
    const { error } = await createUserClient(leader.token)
      .from('org_members')
      .insert({
        org_id: orgId,
        user_id: joiner.id,
        initiated_by: 'org',
        status: 'pending',
        org_role: 'leader',
        invited_by: leader.id,
      })
    expect(error?.code).toBe('42501')

    // The identical statement as a member succeeds, so the refusal above is
    // attributable to org_role and not to some other conjunct of the invite policy.
    const { data, error: ok } = await createUserClient(leader.token)
      .from('org_members')
      .insert({
        org_id: orgId,
        user_id: joiner.id,
        initiated_by: 'org',
        status: 'pending',
        org_role: 'member',
        invited_by: leader.id,
      })
      .select('id')
      .single()
    expect(ok).toBeNull()

    await adminClient().from('org_members').delete().eq('id', data!.id)
  })
  ```

- [ ] **Step 2: Run the test and verify it fails**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts \
    tests/integration/orgs/membership-handshake.test.ts \
    -t 'straight in as a leader'
  ```

  Expected: FAIL — `error?.code` is `undefined`, the leader invite succeeded.

- [ ] **Step 3: Pin `org_role` on the invite policy**

  In `007_organizations.sql`, replace the invite policy's comment and body:

  ```sql
  -- A leader invites someone. Always lands pending — a leader can never move an
  -- 'org'-initiated row straight to approved, because that would let an org claim
  -- someone who never agreed. Always as a MEMBER (decision 12): org_role = 'leader'
  -- is admin-only, and this is the INSERT half of that rule — the org_role trigger
  -- below is BEFORE UPDATE and cannot see this statement.
  create policy "Leaders can invite contributors"
    on public.org_members for insert
    with check (
      public.is_org_leader(org_id)
      and initiated_by = 'org'
      and status = 'pending'
      and org_role = 'member'
      and invited_by = auth.uid()
      and exists (
        select 1 from public.organizations o
        where o.id = org_id and o.status = 'approved'
      )
    );
  ```

- [ ] **Step 4: Correct the trigger comment that documents the old gap**

  Inside `org_members_freeze_provenance()`, replace the comment block above the
  `org_role` check — it currently states the co-leader path is deliberate, which
  is now false:

  ```sql
    -- Without this a leader could promote an existing member by setting org_role
    -- while approving a join request. State the invariant precisely, because it is
    -- narrower than it looks: a leader CAN mint a co-leader, by inviting someone
    -- straight in as ('leader', 'pending') — the invite policy above does not
    -- constrain org_role, and the invitee's acceptance leaves it untouched. That is
    -- deliberate (see the table comment: ('leader', 'pending') is a valid state) and
    -- stays inside the org. What is blocked is PROMOTION: changing org_role on a row
    -- that already exists. That requires an admin.
  ```

  with:

  ```sql
    -- org_role = 'leader' is admin-only on both write paths, and they are guarded
    -- in two different places because no single mechanism can cover both: an RLS
    -- policy cannot see OLD, and a BEFORE UPDATE trigger cannot see an INSERT.
    -- INSERT is held by the invite policy's org_role = 'member' conjunct; UPDATE
    -- (promotion of a row that already exists) is held right here. Changing either
    -- one alone reopens decision 12.
  ```

- [ ] **Step 5: Reset the database and verify the suite passes**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  npx supabase db reset
  cd packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/membership-handshake.test.ts
  ```

  Expected: PASS, all tests in the file.

- [ ] **Step 6: Commit**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  git add supabase/migrations/007_organizations.sql \
          packages/api/tests/integration/orgs/membership-handshake.test.ts
  git commit -m "$(cat <<'EOF'
  fix(db): stop a leader minting a co-leader through an invite

  The invite policy constrained initiated_by and status but left org_role open, so
  a leader could invite someone straight in as ('leader', 'pending') and the
  invitee's ordinary acceptance would leave the role untouched. The org_role
  trigger never fired: it is BEFORE UPDATE, and this is an INSERT.

  Pins org_role = 'member' on the invite policy, and corrects the trigger comment,
  which documented the gap as deliberate.

  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Task 3: `org_leader_terms` gates the review grant

Under decision 11 nobody opts into leadership before holding it, so the
creation-time gate has nothing to attach to. It becomes the fourth condition on
the tutorials leader UPDATE policy, alongside org status, trust level and
self-review.

Split into two commits: the fixture repair is green on its own and should not be
buried inside the behavioural change.

**Files:**
- Modify: `supabase/migrations/007_organizations.sql` (the tutorials leader
  UPDATE policy, both its `using` and `with check` clauses)
- Test: `packages/api/tests/integration/orgs/tutorial-review-grant.test.ts`,
  `packages/api/tests/integration/orgs/suspension.test.ts`

**Interfaces:**
- Consumes: `public.has_accepted(text)`, already defined in the migration and
  unchanged; `acceptTerms()` from `tests/helpers/orgs.ts`, unchanged.
- Produces: the four-condition review grant that §2 of the spec describes. Task
  7's leader-dashboard banner mirrors it.

- [ ] **Step 1: Give every existing review-grant leader an accepted agreement**

  This is pure fixture repair and must land before the policy changes, so the
  policy commit's test failures are only the ones it is meant to cause.

  In `tutorial-review-grant.test.ts`, add `acceptTerms` to the import from
  `../../helpers/orgs.js` and call it in `beforeAll` immediately after the users
  are created:

  ```typescript
  import { createOrg, addMember, acceptTerms, createOrgTutorial, cleanupOrg } from '../../helpers/orgs.js'
  ```

  ```typescript
    leader = await createTestUser('contributor')
    member = await createTestUser('contributor')
    outsider = await createTestUser('contributor')
    await acceptTerms(leader.id, 'org_leader_terms')
  ```

  In the same file's last test, give `otherLeader` the agreement too:

  ```typescript
    const otherLeader = await createTestUser('contributor')
    await acceptTerms(otherLeader.id, 'org_leader_terms')
    const otherOrg = await createOrg({ createdBy: otherLeader.id, status: 'approved', trustLevel: 'trusted' })
  ```

  Without this the cross-org test would still expect `0` but for the wrong
  reason — a missing agreement rather than the org scoping it exists to prove.

  In `suspension.test.ts`, add `acceptTerms` to the same import and call it in
  `beforeAll` after `leader` is created. Its baseline assertion expects the
  approve to succeed, so it breaks in Step 4 otherwise.

- [ ] **Step 2: Run both suites and confirm they still pass**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/
  ```

  Expected: PASS. Nothing has changed behaviourally yet — this only proves the
  new fixture calls are inert against the current policy.

- [ ] **Step 3: Commit the fixture repair**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  git add packages/api/tests/integration/orgs/tutorial-review-grant.test.ts \
          packages/api/tests/integration/orgs/suspension.test.ts
  git commit -m "$(cat <<'EOF'
  test(api): accept leader terms in the review-grant fixtures

  Prepares for org_leader_terms becoming a condition of the leader review grant.
  otherLeader in the cross-org test needs it too, or that test would keep
  expecting zero rows for a reason other than the org scoping it exists to prove.

  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

- [ ] **Step 4: Write the failing terms-gate test**

  Add a leader with no agreement to `tutorial-review-grant.test.ts`. Module-level
  declarations:

  ```typescript
  let untermedLeader: TestUser
  let untermedOrg: string
  let untermedTutorial: string
  ```

  At the end of `beforeAll`:

  ```typescript
    // A leader of a fully trusted, approved org who has accepted nothing. Every
    // other conjunct of the review grant is satisfied for them, so this fixture
    // isolates has_accepted().
    untermedLeader = await createTestUser('contributor')
    untermedOrg = await createOrg({ createdBy: untermedLeader.id, status: 'approved', trustLevel: 'trusted' })
    await addMember({ orgId: untermedOrg, userId: untermedLeader.id, orgRole: 'leader', status: 'approved' })
    await addMember({ orgId: untermedOrg, userId: member.id, orgRole: 'member', status: 'approved' })
    untermedTutorial = await createOrgTutorial({
      orgId: untermedOrg, authorId: member.id, authorToken: member.token,
    })
  ```

  In `afterAll`, before the user deletions:

  ```typescript
    await cleanupOrg(untermedOrg, [untermedTutorial])
  ```

  and add `await deleteTestUser(untermedLeader.id)` alongside the others.

  Then the test itself, added last in the `describe` block:

  ```typescript
  it('cannot approve without an accepted org_leader_terms row', async () => {
    // has_accepted() sits in the policy's USING clause, so a leader who has not
    // accepted is excluded from the row silently — zero rows, no error. Same shape
    // as suspension and demotion, and the reason tryApprove asserts error is null.
    expect(await tryApprove(untermedLeader.token, untermedTutorial)).toBe(0)

    // Accepting is the only thing that changes between the two attempts, so the
    // block above is attributable to has_accepted() and nothing else. This is also
    // the assertion that only means something because the gate is in RLS: with the
    // check in route code, or under a service-role client, the first attempt would
    // have succeeded.
    await acceptTerms(untermedLeader.id, 'org_leader_terms')
    expect(await tryApprove(untermedLeader.token, untermedTutorial)).toBe(1)

    await adminClient()
      .from('tutorials')
      .update({ status: 'pending' })
      .eq('id', untermedTutorial)
  })
  ```

- [ ] **Step 5: Run the test and verify it fails**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts \
    tests/integration/orgs/tutorial-review-grant.test.ts \
    -t 'without an accepted org_leader_terms'
  ```

  Expected: FAIL on the first assertion — the approve returns `1`, because
  nothing yet checks the agreement.

- [ ] **Step 6: Add the fourth condition to the review grant**

  In `007_organizations.sql`, add `and public.has_accepted('org_leader_terms')`
  to **both** the `using` and the `with check` clause of the tutorials leader
  UPDATE policy. Both clauses, or an untermed leader is excluded from selecting
  the row but a different path could still write it:

  ```sql
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
      and public.has_accepted('org_leader_terms')
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
      and public.has_accepted('org_leader_terms')
    );
  ```

  Also replace the comment directly above that policy, which currently counts
  three conditions:

  ```sql
  -- tutorials — leader UPDATE
  -- All four conditions live in one policy so that suspension, demotion to
  -- probation, self-review, and withdrawn consent each independently revoke the
  -- capability instantly: no cache to invalidate, no cleanup job to run. The
  -- fourth is the only consent a promoted leader is ever asked for — under
  -- decision 12 leadership is granted to them, not requested by them — so it has
  -- to bite where the authority is spent rather than at some entry point.
  ```

  Leave `"Leaders can read their org's tutorials"` (the SELECT policy) alone. A
  leader with no agreement must still see their queue, or the banner in Task 7
  would have nothing to render behind it.

- [ ] **Step 7: Reset the database and run the whole orgs suite**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  npx supabase db reset
  cd packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/
  ```

  Expected: PASS, every file. If `suspension.test.ts` fails at its baseline, Step
  1's `acceptTerms` call was not added there.

- [ ] **Step 8: Commit**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  git add supabase/migrations/007_organizations.sql \
          packages/api/tests/integration/orgs/tutorial-review-grant.test.ts
  git commit -m "$(cat <<'EOF'
  feat(db): gate the leader review grant on accepted leader terms

  Decision 11 leaves nobody opting into leadership before holding it, so the
  creation-time org_leader_terms gate had nothing left to attach to. It becomes
  the fourth condition on the review grant instead, which is a stronger place for
  it: consent is checked at every approve rather than once at signup, and
  withdrawing it revokes authority instantly, alongside suspension, demotion and
  self-review.

  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Task 4: Update the schema reference

`supabase/SCHEMA.md` documents policies verbatim and is the file a reader
consults instead of the migration. It currently describes three policies that no
longer exist.

**Files:**
- Modify: `supabase/SCHEMA.md:397-441` (helper functions 007), `:752-778`
  (`organizations` policies), `:793-873` (`org_members` policies), `:584-666`
  (`tutorials` policies), `:455-549` (provenance triggers)

- [ ] **Step 1: Remove `org_has_approved_leader` from the helper section**

  Delete its bullet at line 402 and its full SQL body around line 425. Leave
  `is_org_leader`, `has_accepted` and `is_tutorial_contributor` untouched.

- [ ] **Step 2: Rewrite the `organizations` policy section**

  Replace the `"Contributors who accepted leader terms can create
  organizations"` block at line 765 with the `"Admin can create organizations"`
  policy exactly as it now reads in the migration, and delete the
  `"Creator can read own organization at any status"` entry. Add one line to the
  section's prose noting that `created_by` is an audit column, not an authority
  one.

- [ ] **Step 3: Rewrite the `org_members` policy section**

  Delete the `"Org creator can claim first leadership"` block at line 810 and
  replace it with the "No first-leader INSERT policy" comment from Task 1 Step 7,
  so the reference explains the absence. Update `"Leaders can invite
  contributors"` at line 834 to include `org_role = 'member'`.

- [ ] **Step 4: Update the `tutorials` leader UPDATE policy**

  In the `tutorials` section, add `and public.has_accepted('org_leader_terms')`
  to both clauses of the leader review policy so the reference matches the
  migration, and update any surrounding prose that counts the conditions.

- [ ] **Step 5: Correct the provenance-trigger narrative**

  In the triggers section, replace the passage stating that a leader may mint a
  co-leader with the two-mechanism explanation from Task 2 Step 4.

- [ ] **Step 6: Verify no stale references remain**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  grep -n "org_has_approved_leader\|first leadership\|Contributors who accepted leader terms\|Creator can read own organization" supabase/SCHEMA.md
  ```

  Expected: no output.

- [ ] **Step 7: Commit**

  ```bash
  git add supabase/SCHEMA.md
  git commit -m "$(cat <<'EOF'
  docs(schema): document admin-only org creation and leader promotion

  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Task 5: Retro-fit the executed schema/RLS plan

`2026-07-28-org-review-schema-rls.md` has been executed, so its value now is as a
record of what the migration says. Three of its tasks describe policies that
have been deleted.

**Files:**
- Modify: `docs/superpowers/plans/2026-07-28-org-review-schema-rls.md:85, 200-240,
  276-290, 324-340, 995, 1084`

- [ ] **Step 1: Remove `org_has_approved_leader` from Task 1**

  Delete its mention in the helper-function list at line 85, its full body at
  lines 200–210, its entry in the `pg_proc` verification query at line 235, and
  the assertion naming it at line 240. The verification query becomes:

  ```sql
  select proname from pg_proc where proname in ('is_org_leader','has_accepted','is_tutorial_contributor') order by proname;
  ```

- [ ] **Step 2: Rewrite Task 2's policy blocks**

  Replace the `"Creator can read own organization at any status"` (line 276),
  `"Contributors who accepted leader terms can create organizations"` (line 282)
  and `"Org creator can claim first leadership"` (line 324) blocks with the
  admin-only policy and the absence comment from Task 1 of this plan. Add
  `org_role = 'member'` to the invite policy, and the fourth conjunct to the
  tutorials review policy.

- [ ] **Step 3: Update Task 6's test content**

  The plan embeds the membership-handshake test source. Replace the
  `'creating an org requires an accepted org_leader_terms row'` snippet near line
  995 and the `'the org creator can claim first leadership'` snippet near line
  1084 with the tests as they now stand in the file after Tasks 1 and 2 here.

- [ ] **Step 4: Add a header note**

  At the top of the plan, under the goal, add:

  ```markdown
  > **Amended 2026-07-28** by
  > `docs/superpowers/plans/2026-07-28-admin-only-org-authority.md`, which made
  > organisation creation and leader promotion admin-only (spec decisions 11–13).
  > Tasks 1, 2 and 6 below reflect the amended policies, not the ones originally
  > executed.
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add docs/superpowers/plans/2026-07-28-org-review-schema-rls.md
  git commit -m "$(cat <<'EOF'
  docs(plans): fold admin-only org authority into the schema plan

  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Task 6: Revise the API plan

Not executed. Its Task 2 builds a contributor-facing `POST /api/organizations`
that RLS now refuses, so leaving it would produce a route whose tests cannot
pass.

**Files:**
- Modify: `docs/superpowers/plans/2026-07-28-org-review-api.md:105, 246-490`

**Interfaces:**
- Produces: the endpoint contracts Task 7's web plan consumes —
  `POST /api/admin/organizations` and
  `PATCH /api/admin/organizations/:orgId/members/:userId`.

- [ ] **Step 1: Strip org creation out of Task 2**

  In the `routes/organizations.ts` task, delete the `POST /api/organizations`
  handler, its JSDoc, its `403 unless the caller has accepted org_leader_terms`
  contract at line 269, and the whole `describe('POST /api/organizations', ...)`
  block at line 417. `GET /` and `GET /mine` stay exactly as written. Update the
  task's `Interfaces → Consumes` line at 253, which currently reads
  `has_accepted('org_leader_terms')` enforced by the INSERT policy — that policy
  is gone.

- [ ] **Step 2: Add a new task for the admin organisation endpoints**

  Insert a task after the revised Task 2, following the plan's existing TDD step
  structure, specifying:

  - `POST /api/admin/organizations` — body `{ name, description?, leader_user_id }`.
    Creates the org with `status: 'approved'`, `trust_level: 'trusted'`,
    `created_by` = the authenticated admin, then inserts the leader's
    `org_members` row as
    `{ org_role: 'leader', status: 'approved', initiated_by: 'org', invited_by: <admin id> }`.
    `leader_user_id` is required; 400 when absent. 400 when the target profile's
    `role` is not `'contributor'` (spec decision 8 — a `parent`-role leader is
    treated as logged-out by `getUserRole()` with no error to debug). Returns 201
    with the `Organization`.
  - `PATCH /api/admin/organizations/:orgId/members/:userId` — body
    `{ org_role: 'leader' | 'member' }`. 404 when no membership exists, 400 when
    that membership is not `status: 'approved'`, 400 on promoting a
    non-contributor. Returns the updated `OrgMember`.
  - Both mounted behind the existing admin middleware in `routes/admin.ts`
    (`admin.ts:56`), and both using the admin client, which is what makes the
    two-statement create atomic enough to be worth doing in one handler.
  - Tests: a contributor receives 403 from both; the created org's leader can
    immediately read their org roster; promoting a `pending` member is refused;
    promoting a `parent`-role profile is refused.

  Note in the task that the `profiles.role` checks are TypeScript, not RLS, and
  why: spec decision 9 puts enforcement in the database because a *leader* is a
  semi-trusted account, whereas these routes sit behind admin middleware and the
  admin holds `service_role` regardless, so a database guard would constrain
  nobody.

- [ ] **Step 3: Update the agreements task's cross-reference**

  Line 105 states `routes/organizations.ts` is gated on `org_leader_terms`.
  Replace with: the agreement now gates the tutorials leader UPDATE policy in the
  database, so no route enforces it; `POST /api/agreements` exists so a leader
  can satisfy that policy.

- [ ] **Step 4: Verify no stale references remain**

  ```bash
  grep -n "POST /api/organizations" docs/superpowers/plans/2026-07-28-org-review-api.md
  ```

  Expected: no output, or only occurrences prefixed `/api/admin/`.

- [ ] **Step 5: Commit**

  ```bash
  git add docs/superpowers/plans/2026-07-28-org-review-api.md
  git commit -m "$(cat <<'EOF'
  docs(plans): move org creation and leader promotion to admin endpoints

  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Task 7: Revise the web plan

Not executed. Its Task 5 builds a contributor-facing org creation form behind a
leader-terms gate; both the form and that use of the gate are gone.

**Files:**
- Modify: `docs/superpowers/plans/2026-07-28-org-review-web.md:55, 400-476,
  477-586`

- [ ] **Step 1: Rewrite Task 5**

  Retitle it from "Terms gate and org creation" to "Contributor terms gate".
  Delete the org creation section: the name-and-description form posting to
  `POST /api/organizations` (line 551), the `/legal/org-leader-terms` gate
  wrapping it (line 503), the `GET /api/agreements/me` check that decides whether
  to render `<TermsGate type="org_leader_terms" />` (line 550), and the commit
  step at line 579. Keep `components/terms-gate.tsx` (line 55) and the
  `contributor_terms` path — the submit flow in Task 6 still needs both.

- [ ] **Step 2: Extend Task 4 with creation and promotion**

  `/admin/organizations` gains, in the plan's existing step structure:

  - A create form — name, description, and a contributor picker for
    `leader_user_id` — posting to `POST /api/admin/organizations`.
  - A per-org roster listing `org_members` with a promote/demote control per row,
    calling `PATCH /api/admin/organizations/:orgId/members/:userId`. Disabled for
    memberships that are not `status: 'approved'`, matching the endpoint's 400.
  - Retain suspend and `trust_level` demotion. Drop any "approve pending org"
    affordance: creation already sets `approved` + `trusted`.

- [ ] **Step 3: Add the leader terms banner to the leader dashboard task**

  In the `/org/[orgId]` task, add: when
  `GET /api/agreements/me` shows no `org_leader_terms` acceptance, render the
  review queue with approve and reject disabled plus an inline acceptance action
  posting to `POST /api/agreements`. State in the task that this mirrors the RLS
  grant rather than enforcing anything — the database refuses the write either
  way, and the banner exists so the UI does not offer a button that silently
  does nothing.

- [ ] **Step 4: Verify no stale references remain**

  ```bash
  grep -n "org creation\|POST /api/organizations\|org_leader_terms" docs/superpowers/plans/2026-07-28-org-review-web.md
  ```

  Expected: only the leader-dashboard banner and `/admin/organizations`
  occurrences.

- [ ] **Step 5: Commit**

  ```bash
  git add docs/superpowers/plans/2026-07-28-org-review-web.md
  git commit -m "$(cat <<'EOF'
  docs(plans): move org creation and promotion into the admin pages

  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Task 8: Full-suite verification

- [ ] **Step 1: Reset the database from the migrations**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  npx supabase db reset
  ```

  Expected: all migrations `001`–`008` apply with no error. A syntax error in
  `007` surfaces here and nowhere else.

- [ ] **Step 2: Run the full API integration suite**

  ```bash
  cd packages/api
  npx vitest run -c vitest.integration.config.ts
  ```

  Expected: PASS. This is wider than `tests/integration/orgs/` on purpose — the
  tutorials and admin suites also write to `tutorials`, and the review policy
  changed.

- [ ] **Step 3: Run the API unit suite and typecheck**

  ```bash
  npx vitest run tests/unit
  npx tsc --noEmit
  ```

  Expected: PASS and no type errors.

- [ ] **Step 4: Run the web unit suite**

  ```bash
  cd ../web
  npm run test:unit
  ```

  Expected: PASS. No web source changed, so a failure here means a fixture in
  `packages/web/tests/unit` drifted.

- [ ] **Step 5: Confirm the branch is clean and review the diff**

  ```bash
  cd ../..
  git status --short
  git log --oneline development..HEAD | head -12
  ```

  Expected: clean tree, and the commits from Tasks 1–7 at the top.

## Done when

- No RLS policy permits a non-admin to insert into `organizations`.
- No write path produces `org_role = 'leader'` except one authenticated as
  admin: INSERT is held by the invite policy's `org_role = 'member'`, UPDATE by
  `org_members_freeze_provenance`.
- A leader with no accepted `org_leader_terms` row can read their org's review
  queue and cannot approve from it.
- `supabase/SCHEMA.md` and all three org plans describe the policies that exist.
- The full API integration suite, both unit suites and `tsc --noEmit` pass.
