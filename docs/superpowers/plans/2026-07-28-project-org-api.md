# Project–Organisation API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans` to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Spec:** `docs/superpowers/specs/2026-07-28-project-org-collaboration-design.md` (§3)

**Prerequisite:** `2026-07-28-project-org-schema-rls.md`, executed. Every table,
policy and helper this plan calls already exists.

**Goal:** Expose the project-backing handshake, the leader review action, and the
admin's organisation controls as HTTP endpoints, with the database remaining the
enforcement layer.

**Architecture:** Three new route files plus surgical changes to `tutorials.ts`
and `admin.ts`. Every user-facing write goes through `createUserClient`, so the
policies proved in the schema plan are what decide — routes name the action, they
do not decide who may take it. One migration touch-up (Task 1) closes a
misattribution hole the review endpoint would otherwise open.

**Tech Stack:** Hono 4, `@supabase/supabase-js` v2, Vitest 2, TypeScript 5.

## Global Constraints

- Work on `feat/org-accounts-schema-rls` in `.worktrees/org-accounts-schema-rls`.
- **User-facing writes use `createUserClient(c.get('token'))`, never
  `createAdminClient()`.** Decision 9 puts enforcement in RLS, and a service-role
  client silently bypasses every policy the schema plan just proved.
- Two exceptions, both pre-existing and both commented as such in code:
  `POST /api/tutorials` (creates a row with no `auth.uid()` context) and the admin
  review endpoints (behind `admin.ts`'s role check, which is the whole guard).
- **An RLS-blocked UPDATE or DELETE returns zero rows, not an error.** Handlers
  that must report a refusal check `data.length === 0` and return 403; they cannot
  rely on `error`. A blocked INSERT *does* error, with `42501`.
- Route files follow the existing convention: a leading block comment documenting
  endpoints and related files (see `routes/contributors.ts:1-32`), then
  `const x = new Hono<{ Variables: AuthVariables }>()`, then `export default x`.
- Types come from `@splat-connect/types`. Do not redeclare them locally.
- Agreement versions come from `AGREEMENT_VERSIONS`, never a string literal.
- **One file per commit**, ordered so each commit stands alone — a route file
  lands before the `app.ts` mount that imports it.
- Commit messages end with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/007_organizations.sql` | **Modify.** Task 1 only: pin `reviewed_for_org_id` to an org the caller actually leads. |
| `packages/api/src/routes/agreements.ts` | **Create.** Record and list terms acceptances. ~40 lines, separate because it is a different resource with a different lifetime. |
| `packages/api/src/routes/organizations.ts` | **Create.** Read-only org lookup. No create endpoint — that is admin-only. |
| `packages/api/src/routes/tutorial-orgs.ts` | **Create.** The backing handshake and the leader review action. Mounted at `/api/tutorials`, following `parts.ts` / `tools.ts` / `stl-files.ts`. |
| `packages/api/src/routes/tutorials.ts` | **Modify.** Field allowlist on PATCH; `contributor_terms` gate on create and on `draft → pending`. |
| `packages/api/src/routes/admin.ts` | **Modify.** Organisation and leader endpoints; queue with backing embedded; audit field on status change; spot-check. |
| `packages/api/src/app.ts` | **Modify.** Mount three route groups behind `authMiddleware`. |
| `packages/api/tests/integration/orgs/review-endpoint.test.ts` | **Create.** The review action end to end, including the audit trail. |
| `packages/api/tests/integration/orgs/backing-endpoints.test.ts` | **Create.** Ask / withdraw / accept / decline through HTTP. |
| `packages/api/tests/integration/orgs/admin-endpoints.test.ts` | **Create.** Org creation, leader appointment, queue, spot-check. |
| `packages/api/tests/integration/tutorials/patch-allowlist.test.ts` | **Create.** The allowlist and the terms gate. |

`tutorial-orgs.ts` is deliberately separate from `tutorials.ts`: they change for
different reasons (the organisation relationship vs. tutorial CRUD), and
`tutorials.ts` is already the file every other feature reaches into.

**Web is out of scope.** No pages are built here. `2026-07-28-project-org-web.md`
follows this plan.

---

## Task 1: Pin `reviewed_for_org_id` to an org the caller leads

Found while designing the review endpoint. `tutorials_freeze_review_provenance`
asks `can_review_tutorial(new.id)`, which is true if the caller leads *any*
accepted backing org. On a project backed by two organisations, a leader of the
first could write `reviewed_for_org_id` naming the second — putting a false name
on the "Approved by Sam, Northside Clinic" line the public badge renders. The
route could check it, but decision 9 says the database decides.

**Files:**
- Modify: `supabase/migrations/007_organizations.sql` — no, `008_tutorial_contributor_scope.sql`, where `tutorials_freeze_review_provenance` lives
- Test: `packages/api/tests/integration/orgs/collaboration.test.ts`

**Interfaces:**
- Consumes: `can_review_tutorial`, `tutorial_orgs`, `org_leaders` from the schema
  plan.
- Produces: the guarantee `POST /:id/review` in Task 6 relies on.

- [ ] **Step 1: Write the failing test**

  Add to `collaboration.test.ts`, inside the existing describe block:

  ```typescript
  it('a leader cannot credit the approval to an org they do not lead', async () => {
    // Both orgs back this project, and leaderA leads only orgA. can_review_tutorial
    // is true for them either way, so nothing in the policy layer distinguishes
    // these two writes — without the trigger check, leaderA can put Northside's
    // name on their own approval.
    await adminClient().from('tutorials').update({
      status: 'pending', reviewed_by: null, reviewed_for_org_id: null,
    }).eq('id', project)
    await adminClient().from('tutorial_orgs')
      .update({ status: 'accepted' }).eq('tutorial_id', project).eq('org_id', orgB)

    const { error } = await createUserClient(leaderA.token)
      .from('tutorials')
      .update({ status: 'approved', reviewed_by: leaderA.id, reviewed_for_org_id: orgB })
      .eq('id', project)
      .select('id')
    expect(error?.code).toBe('42501')

    const { data: honest } = await createUserClient(leaderA.token)
      .from('tutorials')
      .update({ status: 'approved', reviewed_by: leaderA.id, reviewed_for_org_id: orgA })
      .eq('id', project)
      .select('id')
    expect(honest).toHaveLength(1)
  })
  ```

- [ ] **Step 2: Run and verify it fails**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts \
    tests/integration/orgs/collaboration.test.ts -t 'do not lead'
  ```

  Expected: FAIL — `error?.code` is `undefined`, the misattributed write succeeded.

- [ ] **Step 3: Add the check to the trigger**

  Replace the body of `tutorials_freeze_review_provenance` in
  `supabase/migrations/008_tutorial_contributor_scope.sql`:

  ```sql
  create or replace function public.tutorials_freeze_review_provenance()
  returns trigger as $$
  begin
    if (
         case tg_op
           when 'INSERT' then new.reviewed_by is not null
                            or new.reviewed_for_org_id is not null
           else new.reviewed_by is distinct from old.reviewed_by
             or new.reviewed_for_org_id is distinct from old.reviewed_for_org_id
         end
       )
       and auth.uid() is not null
       and not public.is_admin()
    then
      if not public.can_review_tutorial(new.id) then
        raise exception 'reviewed_by and reviewed_for_org_id may only be written by an admin or a backing org leader'
          using errcode = '42501';
      end if;

      -- A leader may only credit an organisation they themselves lead and that
      -- actually backs this project. can_review_tutorial() above is true if they
      -- lead ANY backing organisation, so on a collaboration it would let a leader
      -- of one attribute their approval to another — a false name on the
      -- "approved by X of Y" line the public badge renders.
      if new.reviewed_for_org_id is not null
         and not exists (
           select 1
           from public.tutorial_orgs t_o
           join public.org_leaders l on l.org_id = t_o.org_id
           where t_o.tutorial_id = new.id
             and t_o.org_id = new.reviewed_for_org_id
             and t_o.status = 'accepted'
             and l.user_id = auth.uid()
         )
      then
        raise exception 'reviewed_for_org_id must be an organisation you lead that backs this project'
          using errcode = '42501';
      end if;
    end if;
    return new;
  end;
  $$ language plpgsql security invoker set search_path = '';
  ```

- [ ] **Step 4: Reset and verify**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  npx supabase db reset
  cd packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/
  ```

  Expected: all seven files pass, `collaboration.test.ts` now with 5.

- [ ] **Step 5: Commit**

  ```bash
  git add supabase/migrations/008_tutorial_contributor_scope.sql \
          packages/api/tests/integration/orgs/collaboration.test.ts
  git commit -m "fix(db): pin reviewed_for_org_id to an org the reviewer leads"
  ```

---

## Task 2: Agreements route

Built first because both terms gates are unreachable until a user can record an
acceptance.

**Files:**
- Create: `packages/api/src/routes/agreements.ts`
- Modify: `packages/api/src/app.ts`

**Interfaces:**
- Produces: `POST /api/agreements` body `{ agreement_type: AgreementType }` → 201
  `UserAgreement`; `GET /api/agreements/me` → `UserAgreement[]`. Tasks 5 and 6
  depend on rows this route writes.

- [ ] **Step 1: Write the route**

  ```typescript
  /**
   * Terms Acceptance Routes (Protected)
   *
   * Records that a user accepted a version of an agreement. Contains no legal
   * text: the terms themselves are versioned static content under app/legal/,
   * referenced by the version string.
   *
   * Endpoints:
   * - POST /api/agreements
   *   - Body: { agreement_type: 'contributor_terms' | 'org_leader_terms' }
   *   - The version is server-chosen from AGREEMENT_VERSIONS, so a client cannot
   *     claim acceptance of a version that was never published.
   *   - Returns: UserAgreement
   *
   * - GET /api/agreements/me
   *   - The caller's acceptances, so the UI can skip a gate already passed.
   *
   * Security notes:
   * - Writes go through createUserClient. The insert policy pins user_id to
   *   auth.uid(), so one user cannot record an acceptance for another.
   * - There is no update or delete path, by design — an acceptance record that
   *   can be edited is not a record.
   *
   * Related files:
   * - supabase/migrations/007_organizations.sql: user_agreements + has_accepted()
   * - routes/tutorial-orgs.ts: the review grant is gated on org_leader_terms
   * - routes/tutorials.ts: submission is gated on contributor_terms
   */
  import { Hono } from 'hono'
  import { createUserClient } from '../supabase/user-client.js'
  import type { AuthVariables } from '../middleware/auth.js'
  import { AGREEMENT_VERSIONS, type AgreementType } from '@splat-connect/types'

  const agreements = new Hono<{ Variables: AuthVariables }>()

  agreements.get('/me', async (c) => {
    const supabase = createUserClient(c.get('token'))
    const { data, error } = await supabase
      .from('user_agreements')
      .select('*')
      .order('accepted_at', { ascending: false })
    if (error) return c.json({ error: error.message }, 500)
    return c.json(data)
  })

  agreements.post('/', async (c) => {
    const body = await c.req.json<{ agreement_type?: string }>()
    const type = body.agreement_type as AgreementType
    if (type !== 'contributor_terms' && type !== 'org_leader_terms') {
      return c.json({ error: 'agreement_type must be contributor_terms or org_leader_terms' }, 400)
    }

    const supabase = createUserClient(c.get('token'))
    const { data, error } = await supabase
      .from('user_agreements')
      .insert({
        user_id: c.get('userId'),
        agreement_type: type,
        version: AGREEMENT_VERSIONS[type],
      })
      .select()
      .single()
    if (error) return c.json({ error: error.message }, 500)
    return c.json(data, 201)
  })

  export default agreements
  ```

- [ ] **Step 2: Mount it**

  In `packages/api/src/app.ts`, alongside the existing imports and routes:

  ```typescript
  import agreements from './routes/agreements.js'
  ```

  ```typescript
  app.use('/api/agreements', authMiddleware)
  app.use('/api/agreements/*', authMiddleware)
  ```

  ```typescript
  app.route('/api/agreements', agreements)
  ```

- [ ] **Step 3: Write the failing test**

  Create `packages/api/tests/integration/orgs/agreements.test.ts`:

  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest'
  import app from '../../../src/app.js'
  import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

  let user: TestUser
  let other: TestUser

  const authed = (token: string, init: RequestInit = {}) => ({
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })

  beforeAll(async () => {
    user = await createTestUser('contributor')
    other = await createTestUser('contributor')
  })

  afterAll(async () => {
    await adminClient().from('user_agreements').delete().eq('user_id', user.id)
    await deleteTestUser(user.id)
    await deleteTestUser(other.id)
  })

  describe('POST /api/agreements', () => {
    it('records an acceptance at the server-chosen version', async () => {
      const res = await app.request('/api/agreements', authed(user.token, {
        method: 'POST',
        body: JSON.stringify({ agreement_type: 'contributor_terms', version: 'v99-forged' }),
      }))
      expect(res.status).toBe(201)
      const row = (await res.json()) as { user_id: string; version: string }
      // The forged version in the body is ignored — the server picks it, so a
      // client cannot claim acceptance of terms that were never published.
      expect(row.version).toBe('v0-todo')
      expect(row.user_id).toBe(user.id)
    })

    it('refuses an unknown agreement type', async () => {
      const res = await app.request('/api/agreements', authed(user.token, {
        method: 'POST',
        body: JSON.stringify({ agreement_type: 'something_else' }),
      }))
      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/agreements/me', () => {
    it('returns only the caller\'s acceptances', async () => {
      const mine = await app.request('/api/agreements/me', authed(user.token))
      expect((await mine.json() as unknown[]).length).toBe(1)

      const theirs = await app.request('/api/agreements/me', authed(other.token))
      expect((await theirs.json() as unknown[]).length).toBe(0)
    })
  })
  ```

- [ ] **Step 4: Run and verify**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/agreements.test.ts
  ```

  Expected: 3 passed.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/api/src/routes/agreements.ts
  git commit -m "feat(api): add terms acceptance routes"

  git add packages/api/src/app.ts
  git commit -m "feat(api): mount the agreements routes behind auth"

  git add packages/api/tests/integration/orgs/agreements.test.ts
  git commit -m "test(api): assert the acceptance version is server-chosen"
  ```

---

## Task 3: Organizations route (read-only)

There is no create endpoint here. Only the admin creates organisations, the
`organizations` INSERT policy is `is_admin()`, and a create handler on this
router could never succeed.

**Files:**
- Create: `packages/api/src/routes/organizations.ts`
- Modify: `packages/api/src/app.ts`

**Interfaces:**
- Produces: `GET /api/organizations` → `Organization[]`;
  `GET /api/organizations/mine` → `Organization[]` (the ones the caller leads);
  `GET /api/organizations/:id` → `Organization & { org_leaders: OrgLeader[] }`.
  Task 5's request picker and the web plan's org pages consume all three.

- [ ] **Step 1: Write the route**

  ```typescript
  /**
   * Organization Routes (Protected, read-only)
   *
   * Endpoints:
   * - GET /api/organizations
   *   - Every organisation, for the "who should back this?" picker. Suspended
   *     ones are included and flagged, rather than hidden: a contributor should
   *     see why an organisation they expected is not selectable.
   *
   * - GET /api/organizations/mine
   *   - The organisations the caller leads. Drives the dashboard's link into
   *     /org/[orgId] — leadership is per-organisation data, not a role, so there
   *     is nothing on the profile to read it from.
   *
   * - GET /api/organizations/:id
   *   - One organisation with its leaders.
   *
   * Security notes:
   * - Reads go through createUserClient, but both org tables are world-readable
   *   by policy — an organisation is a public trust badge and its leaders are
   *   public trust figures.
   * - There is deliberately no POST here. Only an admin may create an
   *   organisation (routes/admin.ts), and the RLS insert policy is is_admin(),
   *   so a create handler on this router could never succeed.
   *
   * Related files:
   * - supabase/migrations/007_organizations.sql: the policies behind all of this
   * - routes/tutorial-orgs.ts: asking an organisation to back a project
   * - routes/admin.ts: creation, suspension, leader appointment
   */
  import { Hono } from 'hono'
  import { createUserClient } from '../supabase/user-client.js'
  import type { AuthVariables } from '../middleware/auth.js'

  const organizations = new Hono<{ Variables: AuthVariables }>()

  organizations.get('/', async (c) => {
    const supabase = createUserClient(c.get('token'))
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('name', { ascending: true })
    if (error) return c.json({ error: error.message }, 500)
    return c.json(data)
  })

  // Declared before '/:id' so 'mine' is not swallowed as an id.
  organizations.get('/mine', async (c) => {
    const supabase = createUserClient(c.get('token'))
    const { data, error } = await supabase
      .from('org_leaders')
      .select('organizations(*)')
      .eq('user_id', c.get('userId'))
    if (error) return c.json({ error: error.message }, 500)
    return c.json((data ?? []).map((r) => r.organizations))
  })

  organizations.get('/:id', async (c) => {
    const supabase = createUserClient(c.get('token'))
    const { data, error } = await supabase
      .from('organizations')
      .select('*, org_leaders(user_id, created_at)')
      .eq('id', c.req.param('id'))
      .single()
    if (error) return c.json({ error: error.message }, 404)
    return c.json(data)
  })

  export default organizations
  ```

- [ ] **Step 2: Mount it**

  ```typescript
  import organizations from './routes/organizations.js'
  ```

  ```typescript
  app.use('/api/organizations', authMiddleware)
  app.use('/api/organizations/*', authMiddleware)
  ```

  ```typescript
  app.route('/api/organizations', organizations)
  ```

- [ ] **Step 3: Write the failing test**

  Create `packages/api/tests/integration/orgs/organizations-route.test.ts`:

  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest'
  import app from '../../../src/app.js'
  import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'
  import { createOrg, addLeader, cleanupOrg } from '../../helpers/orgs.js'

  let user: TestUser
  let leader: TestUser
  let activeOrg: string
  let suspendedOrg: string

  const authed = (token: string, init: RequestInit = {}) => ({
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })

  beforeAll(async () => {
    user = await createTestUser('contributor')
    leader = await createTestUser('contributor')
    activeOrg = await createOrg({ createdBy: user.id, name: 'Riverside Therapy' })
    await addLeader(activeOrg, leader.id)
    suspendedOrg = await createOrg({ createdBy: user.id, status: 'suspended' })
  })

  afterAll(async () => {
    await cleanupOrg(activeOrg)
    await cleanupOrg(suspendedOrg)
    await deleteTestUser(user.id)
    await deleteTestUser(leader.id)
  })

  describe('GET /api/organizations', () => {
    it('lists organisations including suspended ones', async () => {
      const res = await app.request('/api/organizations', authed(user.token))
      expect(res.status).toBe(200)
      const list = (await res.json()) as Array<{ id: string; status: string }>
      const ids = list.map((o) => o.id)
      expect(ids).toContain(activeOrg)
      // Suspended organisations stay visible: their badge must keep rendering on
      // work they already backed, and hiding them makes an absence unexplainable.
      expect(ids).toContain(suspendedOrg)
      expect(list.find((o) => o.id === suspendedOrg)?.status).toBe('suspended')
    })
  })

  describe('GET /api/organizations/:id', () => {
    it('returns one organisation with its leaders', async () => {
      const res = await app.request(`/api/organizations/${activeOrg}`, authed(user.token))
      expect(res.status).toBe(200)
      const org = (await res.json()) as { name: string; org_leaders: Array<{ user_id: string }> }
      expect(org.name).toBe('Riverside Therapy')
      expect(org.org_leaders.map((l) => l.user_id)).toEqual([leader.id])
    })

    it('returns only the orgs the caller leads from /mine', async () => {
      const mine = await app.request('/api/organizations/mine', authed(leader.token))
      expect(((await mine.json()) as Array<{ id: string }>).map((o) => o.id)).toEqual([activeOrg])

      const none = await app.request('/api/organizations/mine', authed(user.token))
      expect((await none.json()) as unknown[]).toHaveLength(0)
    })

    it('404s for an organisation that does not exist', async () => {
      const res = await app.request(`/api/organizations/${crypto.randomUUID()}`, authed(user.token))
      expect(res.status).toBe(404)
    })
  })
  ```

- [ ] **Step 4: Run and verify**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/organizations-route.test.ts
  ```

  Expected: 4 passed.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/api/src/routes/organizations.ts
  git commit -m "feat(api): add read-only organisation lookup routes"

  git add packages/api/src/app.ts
  git commit -m "feat(api): mount the organizations routes behind auth"

  git add packages/api/tests/integration/orgs/organizations-route.test.ts
  git commit -m "test(api): assert suspended orgs stay visible in the picker"
  ```

---

## Task 4: Admin organisation and leader endpoints

**Files:**
- Modify: `packages/api/src/routes/admin.ts`
- Create: `packages/api/tests/integration/orgs/admin-endpoints.test.ts`

**Interfaces:**
- Consumes: `"Admin can write organizations"` and `"Admin can write org leaders"`.
- Produces: `POST /api/admin/organizations` body
  `{ name, description?, leader_user_id }` → 201 `Organization`;
  `PATCH /api/admin/organizations/:id` body `{ status }` → 200;
  `POST /api/admin/organizations/:orgId/leaders` body `{ user_id }` → 201;
  `DELETE /api/admin/organizations/:orgId/leaders/:userId` → 204.

- [ ] **Step 1: Add the handlers**

  Append to `packages/api/src/routes/admin.ts`, before `export default admin`:

  ```typescript
  /**
   * Organisation authority. All four run under the ADMIN'S OWN JWT via
   * createUserClient, not createAdminClient like the tutorial review handlers
   * above.
   *
   * WHY: so the "Admin can write organizations" and "Admin can write org leaders"
   * policies are the enforcement layer in production, not just in tests. That is
   * decision 9 applied consistently, and it costs nothing here — "Anyone can read
   * organizations" and "Admin can view all profiles" (001_schema.sql:127) cover
   * every read these handlers make.
   *
   * It also avoids a trap that bit the superseded design and was caught only by
   * asserting on the database rather than the status code: triggers run for
   * service_role even though RLS does not, and any guard calling is_admin() reads
   * auth.uid(), which service_role lacks. Such a write raises 42501 while the
   * route reports success having changed nothing. No table here carries such a
   * trigger today — but one added later must not silently break these routes.
   */
  async function assertContributor(supabase: ReturnType<typeof createUserClient>, userId: string) {
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
    return data?.role === 'contributor'
  }

  admin.post('/organizations', async (c) => {
    const body = await c.req.json<{ name?: string; description?: string; leader_user_id?: string }>()
    if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)
    // Required, not optional: an organisation with no leader can answer no
    // request, so a leaderless one is inert and the admin has to come back to fix
    // it. One call creates a working organisation.
    if (!body.leader_user_id) return c.json({ error: 'leader_user_id is required' }, 400)

    const supabase = createUserClient(c.get('token'))
    if (!(await assertContributor(supabase, body.leader_user_id))) {
      // Decision 8. A parent-role leader is treated as logged out by every org
      // page via getUserRole(), with no error to debug — a 400 at the point of the
      // mistake is the fix that helps.
      return c.json({ error: 'an org leader must have the contributor role' }, 400)
    }

    const { data: org, error } = await supabase
      .from('organizations')
      .insert({
        name: body.name.trim(),
        description: body.description?.trim() || null,
        created_by: c.get('userId'),
      })
      .select()
      .single()
    if (error) return c.json({ error: error.message }, 500)

    const { error: leaderError } = await supabase
      .from('org_leaders')
      .insert({ org_id: org.id, user_id: body.leader_user_id })
    if (leaderError) {
      // Roll back rather than leave a leaderless organisation behind: it would be
      // listed in the picker and able to answer nothing.
      await supabase.from('organizations').delete().eq('id', org.id)
      return c.json({ error: leaderError.message }, 500)
    }

    return c.json(org, 201)
  })

  admin.patch('/organizations/:id', async (c) => {
    const body = await c.req.json<{ status?: string; name?: string; description?: string }>()
    if (body.status !== undefined && body.status !== 'active' && body.status !== 'suspended') {
      return c.json({ error: "status must be 'active' or 'suspended'" }, 400)
    }

    const supabase = createUserClient(c.get('token'))
    const { data, error } = await supabase
      .from('organizations')
      .update({
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', c.req.param('id'))
      .select()
    if (error) return c.json({ error: error.message }, 500)
    if (!data.length) return c.json({ error: 'organisation not found' }, 404)
    return c.json(data[0])
  })

  admin.post('/organizations/:orgId/leaders', async (c) => {
    const body = await c.req.json<{ user_id?: string }>()
    if (!body.user_id) return c.json({ error: 'user_id is required' }, 400)

    const supabase = createUserClient(c.get('token'))
    if (!(await assertContributor(supabase, body.user_id))) {
      return c.json({ error: 'an org leader must have the contributor role' }, 400)
    }

    const { data, error } = await supabase
      .from('org_leaders')
      .insert({ org_id: c.req.param('orgId'), user_id: body.user_id })
      .select()
      .single()
    if (error) {
      // 23505 = already a leader. Idempotent rather than an error: the admin's
      // intent is satisfied either way.
      if (error.code === '23505') return c.json({ ok: true }, 200)
      return c.json({ error: error.message }, 500)
    }
    return c.json(data, 201)
  })

  admin.delete('/organizations/:orgId/leaders/:userId', async (c) => {
    const supabase = createUserClient(c.get('token'))
    const { data, error } = await supabase
      .from('org_leaders')
      .delete()
      .eq('org_id', c.req.param('orgId'))
      .eq('user_id', c.req.param('userId'))
      .select('id')
    if (error) return c.json({ error: error.message }, 500)
    if (!data.length) return c.json({ error: 'not a leader of that organisation' }, 404)
    return c.body(null, 204)
  })
  ```

  Add `createUserClient` to the imports at the top of the file:

  ```typescript
  import { createUserClient } from '../supabase/user-client.js'
  ```

- [ ] **Step 2: Write the failing test**

  Create `packages/api/tests/integration/orgs/admin-endpoints.test.ts`:

  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest'
  import app from '../../../src/app.js'
  import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
  import { acceptTerms, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

  let admin: TestUser
  let leader: TestUser
  let second: TestUser
  let parent: TestUser
  let author: TestUser
  const createdOrgIds: string[] = []
  let project: string

  const authed = (token: string, init: RequestInit = {}) => ({
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })

  beforeAll(async () => {
    admin = await createTestUser('admin')
    leader = await createTestUser('contributor')
    second = await createTestUser('contributor')
    parent = await createTestUser('parent')
    author = await createTestUser('contributor')
    await acceptTerms(leader.id, 'org_leader_terms')
    project = await createProject({ authorId: author.id })
  })

  afterAll(async () => {
    for (const id of createdOrgIds) await cleanupOrg(id)
    await adminClient().from('tutorials').delete().eq('id', project)
    await deleteTestUser(admin.id)
    await deleteTestUser(leader.id)
    await deleteTestUser(second.id)
    await deleteTestUser(parent.id)
    await deleteTestUser(author.id)
  })

  describe('POST /api/admin/organizations', () => {
    it('creates an active org and its first leader in one call', async () => {
      const res = await app.request('/api/admin/organizations', authed(admin.token, {
        method: 'POST',
        body: JSON.stringify({ name: 'Riverside Therapy', leader_user_id: leader.id }),
      }))
      expect(res.status).toBe(201)
      const org = (await res.json()) as { id: string; status: string }
      createdOrgIds.push(org.id)
      expect(org.status).toBe('active')

      const { data } = await adminClient()
        .from('org_leaders').select('user_id').eq('org_id', org.id)
      expect(data?.map((l) => l.user_id)).toEqual([leader.id])
    })

    it('refuses a contributor', async () => {
      const res = await app.request('/api/admin/organizations', authed(leader.token, {
        method: 'POST',
        body: JSON.stringify({ name: 'Self Serve', leader_user_id: leader.id }),
      }))
      expect(res.status).toBe(403)
    })

    it('refuses a leader who is not a contributor', async () => {
      const res = await app.request('/api/admin/organizations', authed(admin.token, {
        method: 'POST',
        body: JSON.stringify({ name: 'Parent Led', leader_user_id: parent.id }),
      }))
      expect(res.status).toBe(400)
    })

    it('refuses a request with no leader_user_id', async () => {
      const res = await app.request('/api/admin/organizations', authed(admin.token, {
        method: 'POST',
        body: JSON.stringify({ name: 'Leaderless' }),
      }))
      expect(res.status).toBe(400)
    })
  })

  describe('leader appointment', () => {
    it('appoints a second leader, and the appointment persists', async () => {
      // Assert against the database, not the status code: the superseded design
      // shipped a leadership endpoint that reported success and changed nothing.
      const orgId = createdOrgIds[0]
      const res = await app.request(`/api/admin/organizations/${orgId}/leaders`, authed(admin.token, {
        method: 'POST',
        body: JSON.stringify({ user_id: second.id }),
      }))
      expect(res.status).toBe(201)

      const { data } = await adminClient()
        .from('org_leaders').select('user_id').eq('org_id', orgId).eq('user_id', second.id)
      expect(data).toHaveLength(1)
    })

    it('removing a leader persists and revokes review immediately', async () => {
      const orgId = createdOrgIds[0]
      await requestBacking({ tutorialId: project, orgId, status: 'accepted', respondedBy: leader.id })

      const res = await app.request(
        `/api/admin/organizations/${orgId}/leaders/${second.id}`,
        authed(admin.token, { method: 'DELETE' }),
      )
      expect(res.status).toBe(204)

      const { data } = await adminClient()
        .from('org_leaders').select('id').eq('org_id', orgId).eq('user_id', second.id)
      expect(data ?? []).toHaveLength(0)
    })

    it('a leader cannot appoint anyone', async () => {
      const res = await app.request(`/api/admin/organizations/${createdOrgIds[0]}/leaders`, authed(leader.token, {
        method: 'POST',
        body: JSON.stringify({ user_id: second.id }),
      }))
      expect(res.status).toBe(403)
    })
  })

  describe('PATCH /api/admin/organizations/:id', () => {
    it('suspends and reactivates', async () => {
      const orgId = createdOrgIds[0]
      const off = await app.request(`/api/admin/organizations/${orgId}`, authed(admin.token, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'suspended' }),
      }))
      expect(off.status).toBe(200)
      expect(((await off.json()) as { status: string }).status).toBe('suspended')

      const on = await app.request(`/api/admin/organizations/${orgId}`, authed(admin.token, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' }),
      }))
      expect(((await on.json()) as { status: string }).status).toBe('active')
    })

    it('refuses an unknown status', async () => {
      const res = await app.request(`/api/admin/organizations/${createdOrgIds[0]}`, authed(admin.token, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'probation' }),
      }))
      expect(res.status).toBe(400)
    })
  })
  ```

- [ ] **Step 3: Run and verify**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/admin-endpoints.test.ts
  ```

  Expected: 9 passed. The two 403s come from the admin middleware at `admin.ts:47`,
  not from RLS — these routes are role-gated before any query runs, and that is
  worth asserting because it is the only guard on the path.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/api/src/routes/admin.ts
  git commit -m "feat(api): add admin organisation and leader endpoints"

  git add packages/api/tests/integration/orgs/admin-endpoints.test.ts
  git commit -m "test(api): assert leadership changes persist, not just return 200"
  ```

---

## Task 5: The backing endpoints

**Files:**
- Create: `packages/api/src/routes/tutorial-orgs.ts`
- Modify: `packages/api/src/app.ts`
- Create: `packages/api/tests/integration/orgs/backing-endpoints.test.ts`

**Interfaces:**
- Consumes: the `tutorial_orgs` policies and `tutorial_orgs_freeze_identity`.
- Produces: `GET /api/tutorials/:id/orgs`, `POST /api/tutorials/:id/orgs`,
  `DELETE /api/tutorials/:id/orgs/:orgId`,
  `POST /api/tutorials/:id/orgs/:orgId/accept`, `.../decline`. Task 6 adds
  `POST /api/tutorials/:id/review` to the same file.

- [ ] **Step 1: Write the route**

  ```typescript
  /**
   * Project Backing Routes (Protected)
   *
   * A tutorial is a project. Its author asks organisations to back it; a leader of
   * each asked organisation answers for that organisation alone. Neither party can
   * complete the association by themselves, which is what stops a contributor
   * attaching an organisation's name to work its leaders never agreed to back.
   *
   * Mounted at /api/tutorials, following parts.ts / tools.ts / stl-files.ts.
   *
   * Endpoints:
   * - GET    /api/tutorials/:id/orgs                  — backing rows for a project
   * - POST   /api/tutorials/:id/orgs                  — author asks { org_id }
   * - DELETE /api/tutorials/:id/orgs/:orgId           — either side withdraws
   * - POST   /api/tutorials/:id/orgs/:orgId/accept    — a leader of that org
   * - POST   /api/tutorials/:id/orgs/:orgId/decline   — a leader of that org
   *
   * accept and decline are separate routes rather than one PATCH { status },
   * because the URL then names the action instead of pushing that distinction into
   * a body where an RLS violation is the only thing catching a mistake.
   *
   * Security notes:
   * - Every write uses createUserClient. The insert policy pins status='pending'
   *   and checks authorship; the update policy checks is_org_leader on both the
   *   old and the new row; the delete policy refuses once the named organisation
   *   is the one that approved the tutorial.
   * - A blocked UPDATE or DELETE matches ZERO ROWS rather than erroring, so these
   *   handlers check the returned row count and return 403. A blocked INSERT does
   *   error, with 42501.
   *
   * Related files:
   * - supabase/migrations/007_organizations.sql: every policy behind this file
   * - routes/organizations.ts: the picker this feeds
   * - routes/admin.ts: who may lead an organisation at all
   */
  import { Hono, type Context } from 'hono'
  import { createUserClient } from '../supabase/user-client.js'
  import type { AuthVariables } from '../middleware/auth.js'

  const tutorialOrgs = new Hono<{ Variables: AuthVariables }>()

  tutorialOrgs.get('/:id/orgs', async (c) => {
    const supabase = createUserClient(c.get('token'))
    const { data, error } = await supabase
      .from('tutorial_orgs')
      .select('*, organizations(id, name, status)')
      .eq('tutorial_id', c.req.param('id'))
      .order('requested_at', { ascending: true })
    if (error) return c.json({ error: error.message }, 500)
    return c.json(data)
  })

  tutorialOrgs.post('/:id/orgs', async (c) => {
    const body = await c.req.json<{ org_id?: string }>()
    if (!body.org_id) return c.json({ error: 'org_id is required' }, 400)

    const supabase = createUserClient(c.get('token'))
    const { data, error } = await supabase
      .from('tutorial_orgs')
      // status is not sent: the column defaults to 'pending' and the policy pins
      // it there anyway. Sending it would only invite someone to try 'accepted'.
      .insert({ tutorial_id: c.req.param('id'), org_id: body.org_id })
      .select()
      .single()
    if (error) {
      // 23505 = this organisation was already asked. Idempotent: the author's
      // intent is satisfied, and a duplicate request is not an error worth
      // surfacing.
      if (error.code === '23505') return c.json({ ok: true }, 200)
      // 42501 = the insert policy refused: not the author, or the tutorial is
      // already published.
      if (error.code === '42501') {
        return c.json({ error: 'only the author can ask, and only before publication' }, 403)
      }
      return c.json({ error: error.message }, 500)
    }
    return c.json(data, 201)
  })

  tutorialOrgs.delete('/:id/orgs/:orgId', async (c) => {
    const supabase = createUserClient(c.get('token'))
    const { data, error } = await supabase
      .from('tutorial_orgs')
      .delete()
      .eq('tutorial_id', c.req.param('id'))
      .eq('org_id', c.req.param('orgId'))
      .select('id')
    if (error) return c.json({ error: error.message }, 500)
    if (!data.length) {
      // Zero rows is the RLS refusal, not a 404: either the caller is neither the
      // author nor a leader of that organisation, or this organisation is the one
      // that approved the published tutorial and the row is now the audit trail.
      return c.json({ error: 'cannot withdraw this backing' }, 403)
    }
    return c.body(null, 204)
  })

  async function answer(c: Context<{ Variables: AuthVariables }>, status: 'accepted' | 'declined') {
    const supabase = createUserClient(c.get('token'))
    const { data, error } = await supabase
      .from('tutorial_orgs')
      .update({
        status,
        responded_by: c.get('userId'),
        responded_at: new Date().toISOString(),
      })
      .eq('tutorial_id', c.req.param('id'))
      .eq('org_id', c.req.param('orgId'))
      .select()
    if (error) return c.json({ error: error.message }, 500)
    if (!data.length) return c.json({ error: 'not a leader of that organisation' }, 403)
    return c.json(data[0])
  }

  tutorialOrgs.post('/:id/orgs/:orgId/accept', (c) => answer(c, 'accepted'))
  tutorialOrgs.post('/:id/orgs/:orgId/decline', (c) => answer(c, 'declined'))

  export default tutorialOrgs
  ```

- [ ] **Step 2: Mount it**

  In `app.ts`, alongside the other `/api/tutorials` routers. `/api/tutorials/*` is
  already behind `authMiddleware`, so only the import and route line are needed:

  ```typescript
  import tutorialOrgs from './routes/tutorial-orgs.js'
  ```

  ```typescript
  app.route('/api/tutorials', tutorialOrgs)
  ```

- [ ] **Step 3: Write the failing test**

  Create `packages/api/tests/integration/orgs/backing-endpoints.test.ts`:

  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest'
  import app from '../../../src/app.js'
  import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
  import { createOrg, addLeader, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

  let author: TestUser
  let leader: TestUser
  let stranger: TestUser
  let orgId: string
  let otherOrgId: string
  let draft: string
  let published: string

  const authed = (token: string, init: RequestInit = {}) => ({
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })

  beforeAll(async () => {
    author = await createTestUser('contributor')
    leader = await createTestUser('contributor')
    stranger = await createTestUser('contributor')
    orgId = await createOrg({ createdBy: leader.id })
    await addLeader(orgId, leader.id)
    otherOrgId = await createOrg({ createdBy: leader.id })
    draft = await createProject({ authorId: author.id, status: 'draft' })
    published = await createProject({ authorId: author.id, status: 'approved' })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [draft, published])
    await cleanupOrg(otherOrgId)
    await deleteTestUser(author.id)
    await deleteTestUser(leader.id)
    await deleteTestUser(stranger.id)
  })

  describe('POST /api/tutorials/:id/orgs', () => {
    it('records the request as pending', async () => {
      const res = await app.request(`/api/tutorials/${draft}/orgs`, authed(author.token, {
        method: 'POST',
        body: JSON.stringify({ org_id: orgId }),
      }))
      expect(res.status).toBe(201)
      expect(((await res.json()) as { status: string }).status).toBe('pending')
    })

    it('is idempotent on a repeat request', async () => {
      const res = await app.request(`/api/tutorials/${draft}/orgs`, authed(author.token, {
        method: 'POST',
        body: JSON.stringify({ org_id: orgId }),
      }))
      expect(res.status).toBe(200)
    })

    it('403s for someone who is not the author', async () => {
      const res = await app.request(`/api/tutorials/${draft}/orgs`, authed(stranger.token, {
        method: 'POST',
        body: JSON.stringify({ org_id: otherOrgId }),
      }))
      expect(res.status).toBe(403)
    })

    it('403s once the tutorial is published', async () => {
      const res = await app.request(`/api/tutorials/${published}/orgs`, authed(author.token, {
        method: 'POST',
        body: JSON.stringify({ org_id: orgId }),
      }))
      expect(res.status).toBe(403)
    })
  })

  describe('answering', () => {
    it('a leader of the asked org can accept', async () => {
      const res = await app.request(`/api/tutorials/${draft}/orgs/${orgId}/accept`, authed(leader.token, {
        method: 'POST',
      }))
      expect(res.status).toBe(200)
      const row = (await res.json()) as { status: string; responded_by: string }
      expect(row.status).toBe('accepted')
      expect(row.responded_by).toBe(leader.id)
    })

    it('403s for the author trying to answer their own request', async () => {
      const res = await app.request(`/api/tutorials/${draft}/orgs/${orgId}/accept`, authed(author.token, {
        method: 'POST',
      }))
      expect(res.status).toBe(403)
    })

    it('403s for a leader of an organisation that was not asked', async () => {
      await requestBacking({ tutorialId: published, orgId: otherOrgId })
      const res = await app.request(`/api/tutorials/${published}/orgs/${otherOrgId}/decline`, authed(stranger.token, {
        method: 'POST',
      }))
      expect(res.status).toBe(403)
    })
  })

  describe('DELETE /api/tutorials/:id/orgs/:orgId', () => {
    it('the author can withdraw before publication', async () => {
      const res = await app.request(`/api/tutorials/${draft}/orgs/${orgId}`, authed(author.token, {
        method: 'DELETE',
      }))
      expect(res.status).toBe(204)
    })

    it('403s once that organisation approved the published tutorial', async () => {
      await requestBacking({ tutorialId: published, orgId, status: 'accepted' })
      await adminClient().from('tutorials').update({
        reviewed_by: leader.id, reviewed_for_org_id: orgId,
      }).eq('id', published)

      const res = await app.request(`/api/tutorials/${published}/orgs/${orgId}`, authed(author.token, {
        method: 'DELETE',
      }))
      expect(res.status).toBe(403)
    })
  })

  describe('GET /api/tutorials/:id/orgs', () => {
    it('returns the backing rows with the organisation embedded', async () => {
      const res = await app.request(`/api/tutorials/${published}/orgs`, authed(author.token))
      const rows = (await res.json()) as Array<{ org_id: string; organizations: { name: string } }>
      expect(rows.map((r) => r.org_id)).toContain(orgId)
      expect(rows.find((r) => r.org_id === orgId)?.organizations.name).toBeTruthy()
    })
  })
  ```

- [ ] **Step 4: Run and verify**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/backing-endpoints.test.ts
  ```

  Expected: 10 passed.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/api/src/routes/tutorial-orgs.ts
  git commit -m "feat(api): add the project backing handshake endpoints"

  git add packages/api/src/app.ts
  git commit -m "feat(api): mount the project backing routes"

  git add packages/api/tests/integration/orgs/backing-endpoints.test.ts
  git commit -m "test(api): cover asking, answering, and withdrawing backing"
  ```

---

## Task 6: The leader review endpoint

**Files:**
- Modify: `packages/api/src/routes/tutorial-orgs.ts`
- Create: `packages/api/tests/integration/orgs/review-endpoint.test.ts`

**Interfaces:**
- Consumes: the `tutorials` leader UPDATE policy and Task 1's trigger check.
- Produces: `POST /api/tutorials/:id/review` body
  `{ status: 'approved' | 'rejected', org_id?, rejection_note? }` → 200 `Tutorial`.

- [ ] **Step 1: Add the handler**

  Append to `tutorial-orgs.ts`, before `export default`:

  ```typescript
  /**
   * POST /api/tutorials/:id/review
   *
   * The leader review action. Sets status, reviewed_by, reviewed_at and
   * reviewed_for_org_id together, so a published tutorial always carries who
   * approved it and whose authority they used.
   *
   * WHY org_id is derived rather than trusted from the body: the caller may lead
   * several organisations backing the same project, and the badge line
   * "Approved by Sam, Riverside Therapy" has to name the right one. The route
   * resolves the accepted backing organisations the caller actually leads; with
   * exactly one there is nothing to ask, and with more the body must say which.
   * The database refuses a mismatch regardless (008's provenance trigger), so this
   * is about a clear 400 rather than about safety.
   */
  tutorialOrgs.post('/:id/review', async (c) => {
    const tutorialId = c.req.param('id')
    const body = await c.req.json<{ status?: string; org_id?: string; rejection_note?: string }>()
    if (body.status !== 'approved' && body.status !== 'rejected') {
      return c.json({ error: "status must be 'approved' or 'rejected'" }, 400)
    }
    if (body.status === 'rejected' && !body.rejection_note?.trim()) {
      // A rejection with no reason gives the contributor nothing to act on, which
      // is the whole point of the field.
      return c.json({ error: 'rejection_note is required when rejecting' }, 400)
    }

    const supabase = createUserClient(c.get('token'))

    const { data: mine, error: mineError } = await supabase
      .from('tutorial_orgs')
      .select('org_id')
      .eq('tutorial_id', tutorialId)
      .eq('status', 'accepted')
    if (mineError) return c.json({ error: mineError.message }, 500)

    // The SELECT policy already limits these rows to organisations the caller
    // leads (or authored the project for), so intersecting with org_leaders here
    // would be redundant — but an author who is not a leader would also see rows,
    // so the write below is what actually decides. RLS refuses them with zero rows.
    const candidates = (mine ?? []).map((r) => r.org_id as string)
    let orgId: string | undefined
    if (body.org_id) {
      if (!candidates.includes(body.org_id)) {
        return c.json({ error: 'that organisation is not backing this project' }, 400)
      }
      orgId = body.org_id
    } else if (candidates.length === 1) {
      orgId = candidates[0]
    } else if (candidates.length > 1) {
      return c.json({ error: 'org_id is required when several of your organisations back this project' }, 400)
    } else {
      return c.json({ error: 'no organisation of yours is backing this project' }, 403)
    }

    const { data, error } = await supabase
      .from('tutorials')
      .update({
        status: body.status,
        reviewed_by: c.get('userId'),
        reviewed_for_org_id: orgId,
        reviewed_at: new Date().toISOString(),
        rejection_note: body.status === 'rejected' ? body.rejection_note!.trim() : null,
      })
      .eq('id', tutorialId)
      .select()
    if (error) return c.json({ error: error.message }, 500)
    // Zero rows is the RLS refusal: no accepted backing for an org the caller
    // leads, the organisation is suspended, or org_leader_terms is unaccepted.
    if (!data.length) return c.json({ error: 'you cannot review this project' }, 403)
    return c.json(data[0])
  })
  ```

- [ ] **Step 2: Write the failing test**

  Create `packages/api/tests/integration/orgs/review-endpoint.test.ts`:

  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest'
  import app from '../../../src/app.js'
  import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
  import { createOrg, addLeader, acceptTerms, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

  let author: TestUser
  let leader: TestUser
  let untermed: TestUser
  let orgA: string
  let orgB: string
  let untermedOrg: string
  let single: string
  let collaborative: string
  let untermedProject: string

  const authed = (token: string, init: RequestInit = {}) => ({
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })

  beforeAll(async () => {
    author = await createTestUser('contributor')
    leader = await createTestUser('contributor')
    untermed = await createTestUser('contributor')
    await acceptTerms(leader.id, 'org_leader_terms')

    orgA = await createOrg({ createdBy: leader.id, name: 'Riverside Therapy' })
    await addLeader(orgA, leader.id)
    orgB = await createOrg({ createdBy: leader.id, name: 'Northside Clinic' })
    await addLeader(orgB, leader.id)
    untermedOrg = await createOrg({ createdBy: untermed.id })
    await addLeader(untermedOrg, untermed.id)

    single = await createProject({ authorId: author.id })
    await requestBacking({ tutorialId: single, orgId: orgA, status: 'accepted' })

    collaborative = await createProject({ authorId: author.id })
    await requestBacking({ tutorialId: collaborative, orgId: orgA, status: 'accepted' })
    await requestBacking({ tutorialId: collaborative, orgId: orgB, status: 'accepted' })

    untermedProject = await createProject({ authorId: author.id })
    await requestBacking({ tutorialId: untermedProject, orgId: untermedOrg, status: 'accepted' })
  })

  afterAll(async () => {
    await cleanupOrg(orgA, [single, collaborative])
    await cleanupOrg(orgB)
    await cleanupOrg(untermedOrg, [untermedProject])
    await deleteTestUser(author.id)
    await deleteTestUser(leader.id)
    await deleteTestUser(untermed.id)
  })

  describe('POST /api/tutorials/:id/review', () => {
    it('approves and writes the whole audit trail', async () => {
      const res = await app.request(`/api/tutorials/${single}/review`, authed(leader.token, {
        method: 'POST',
        body: JSON.stringify({ status: 'approved' }),
      }))
      expect(res.status).toBe(200)

      const { data } = await adminClient()
        .from('tutorials')
        .select('status, reviewed_by, reviewed_for_org_id, reviewed_at')
        .eq('id', single)
        .single()
      expect(data).toMatchObject({
        status: 'approved', reviewed_by: leader.id, reviewed_for_org_id: orgA,
      })
      expect(data?.reviewed_at).not.toBeNull()

      await adminClient().from('tutorials').update({
        status: 'pending', reviewed_by: null, reviewed_for_org_id: null,
      }).eq('id', single)
    })

    it('requires org_id when several of the caller\'s orgs back the project', async () => {
      const res = await app.request(`/api/tutorials/${collaborative}/review`, authed(leader.token, {
        method: 'POST',
        body: JSON.stringify({ status: 'approved' }),
      }))
      expect(res.status).toBe(400)
    })

    it('credits the named organisation when given one', async () => {
      const res = await app.request(`/api/tutorials/${collaborative}/review`, authed(leader.token, {
        method: 'POST',
        body: JSON.stringify({ status: 'approved', org_id: orgB }),
      }))
      expect(res.status).toBe(200)

      const { data } = await adminClient()
        .from('tutorials').select('reviewed_for_org_id').eq('id', collaborative).single()
      expect(data?.reviewed_for_org_id).toBe(orgB)
    })

    it('refuses an org that is not backing the project', async () => {
      const res = await app.request(`/api/tutorials/${single}/review`, authed(leader.token, {
        method: 'POST',
        body: JSON.stringify({ status: 'approved', org_id: orgB }),
      }))
      expect(res.status).toBe(400)
    })

    it('requires a note when rejecting', async () => {
      const res = await app.request(`/api/tutorials/${single}/review`, authed(leader.token, {
        method: 'POST',
        body: JSON.stringify({ status: 'rejected', rejection_note: '   ' }),
      }))
      expect(res.status).toBe(400)
    })

    it('rejects with a note', async () => {
      const res = await app.request(`/api/tutorials/${single}/review`, authed(leader.token, {
        method: 'POST',
        body: JSON.stringify({ status: 'rejected', rejection_note: 'Step 4 is unsafe as written' }),
      }))
      expect(res.status).toBe(200)

      const { data } = await adminClient()
        .from('tutorials').select('status, rejection_note').eq('id', single).single()
      expect(data).toMatchObject({
        status: 'rejected', rejection_note: 'Step 4 is unsafe as written',
      })
    })

    it('403s for a leader who has not accepted the leader terms', async () => {
      // The grant's terms conjunct sits in the policy's USING clause, so the write
      // matches zero rows. This is the assertion that only means something because
      // the gate lives in RLS rather than in this route.
      const res = await app.request(`/api/tutorials/${untermedProject}/review`, authed(untermed.token, {
        method: 'POST',
        body: JSON.stringify({ status: 'approved' }),
      }))
      expect(res.status).toBe(403)

      await acceptTerms(untermed.id, 'org_leader_terms')
      const after = await app.request(`/api/tutorials/${untermedProject}/review`, authed(untermed.token, {
        method: 'POST',
        body: JSON.stringify({ status: 'approved' }),
      }))
      expect(after.status).toBe(200)
    })

    it('403s for the author, who backs nothing', async () => {
      const res = await app.request(`/api/tutorials/${single}/review`, authed(author.token, {
        method: 'POST',
        body: JSON.stringify({ status: 'approved' }),
      }))
      expect(res.status).toBe(403)
    })

    it('refuses a status other than approved or rejected', async () => {
      const res = await app.request(`/api/tutorials/${single}/review`, authed(leader.token, {
        method: 'POST',
        body: JSON.stringify({ status: 'pending' }),
      }))
      expect(res.status).toBe(400)
    })
  })
  ```

- [ ] **Step 3: Run and verify**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/review-endpoint.test.ts
  ```

  Expected: 9 passed.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/api/src/routes/tutorial-orgs.ts
  git commit -m "feat(api): add the leader review endpoint"

  git add packages/api/tests/integration/orgs/review-endpoint.test.ts
  git commit -m "test(api): assert the review endpoint writes a complete audit trail"
  ```

---

## Task 7: Lock down `PATCH /:id` and gate submission

`tutorials.patch('/:id')` currently writes the entire unfiltered request body
(`tutorials.ts:131`). Today RLS stops a contributor leaving a row in `approved`,
but a leader now holds an UPDATE grant — so without an allowlist a leader could
publish through this generic endpoint, leaving `reviewed_by` and
`reviewed_for_org_id` null and putting an invisible hole in the spot-check
surface.

**Files:**
- Modify: `packages/api/src/routes/tutorials.ts`
- Create: `packages/api/tests/integration/tutorials/patch-allowlist.test.ts`

**Interfaces:**
- Consumes: `has_accepted('contributor_terms')` via a read of `user_agreements`.
- Produces: the guarantee Task 8's spot-check relies on — every published tutorial
  went through `POST /:id/review` or the admin status endpoint.

- [ ] **Step 1: Add the allowlist and the terms gate**

  Replace the `tutorials.patch('/:id')` handler:

  ```typescript
  /** Only these may be set through the generic edit endpoint. Unknown keys are
   *  dropped silently; the protected ones return 403 so a caller learns rather
   *  than wonders. */
  const EDITABLE = ['title', 'description', 'difficulty', 'tutorial_pdf_url', 'toy_photo_url', 'status'] as const
  const PROTECTED = ['reviewed_by', 'reviewed_for_org_id', 'reviewed_at', 'rejection_note']

  async function hasAcceptedContributorTerms(token: string, userId: string) {
    const { data } = await createUserClient(token)
      .from('user_agreements')
      .select('id')
      .eq('user_id', userId)
      .eq('agreement_type', 'contributor_terms')
      .limit(1)
    return (data ?? []).length > 0
  }

  tutorials.patch('/:id', async (c) => {
    const body = await c.req.json<Record<string, unknown>>()

    const attempted = PROTECTED.filter((k) => k in body)
    if (attempted.length) {
      return c.json({ error: `${attempted.join(', ')} cannot be set here` }, 403)
    }

    // WHY status is restricted to draft and pending: a leader holds an UPDATE
    // grant on tutorials, so without this they could publish through this generic
    // endpoint. RLS would permit it, but reviewed_by and reviewed_for_org_id would
    // stay null — a published tutorial with no audit trail, invisible to the
    // admin spot-check. Approving and rejecting must go through
    // POST /:id/review or the admin status endpoint.
    if ('status' in body && body.status !== 'draft' && body.status !== 'pending') {
      return c.json({ error: 'use POST /:id/review to approve or reject' }, 403)
    }

    // The contributor_terms gate. Checked here as well as on create, because
    // gating creation alone would let drafts that predate the terms sail through
    // while blocking their authors from touching them. draft -> pending is the
    // moment work is actually offered to the platform.
    if (body.status === 'pending' && !(await hasAcceptedContributorTerms(c.get('token'), c.get('userId')))) {
      return c.json({ error: 'You must accept the contributor terms before submitting' }, 403)
    }

    const update: Record<string, unknown> = {}
    for (const key of EDITABLE) if (key in body) update[key] = body[key]
    if (!Object.keys(update).length) return c.json({ error: 'nothing to update' }, 400)

    const supabase = createUserClient(c.get('token'))
    const { data, error } = await supabase
      .from('tutorials')
      .update(update)
      .eq('id', c.req.param('id'))
      .select()
      .single()
    if (error) return c.json({ error: error.message }, 500)
    return c.json(data)
  })
  ```

  In `tutorials.post('/')`, add the same gate before the insert:

  ```typescript
    if (!(await hasAcceptedContributorTerms(c.get('token'), c.get('userId')))) {
      return c.json({ error: 'You must accept the contributor terms before contributing' }, 403)
    }
  ```

- [ ] **Step 2: Write the failing test**

  Create `packages/api/tests/integration/tutorials/patch-allowlist.test.ts`:

  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest'
  import app from '../../../src/app.js'
  import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
  import { createOrg, addLeader, acceptTerms, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

  let author: TestUser
  let untermedAuthor: TestUser
  let leader: TestUser
  let orgId: string
  let draft: string
  let backed: string

  const authed = (token: string, init: RequestInit = {}) => ({
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })

  beforeAll(async () => {
    author = await createTestUser('contributor')
    untermedAuthor = await createTestUser('contributor')
    leader = await createTestUser('contributor')
    await acceptTerms(author.id, 'contributor_terms')
    await acceptTerms(leader.id, 'org_leader_terms')

    orgId = await createOrg({ createdBy: leader.id })
    await addLeader(orgId, leader.id)

    draft = await createProject({ authorId: author.id, status: 'draft' })
    backed = await createProject({ authorId: untermedAuthor.id, status: 'draft' })
    await requestBacking({ tutorialId: backed, orgId, status: 'accepted' })
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [draft, backed])
    await deleteTestUser(author.id)
    await deleteTestUser(untermedAuthor.id)
    await deleteTestUser(leader.id)
  })

  describe('PATCH /api/tutorials/:id', () => {
    it('applies the editable fields', async () => {
      const res = await app.request(`/api/tutorials/${draft}`, authed(author.token, {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Renamed', difficulty: 'hard' }),
      }))
      expect(res.status).toBe(200)
      expect(((await res.json()) as { title: string }).title).toBe('Renamed')
    })

    it('drops unknown keys instead of writing them', async () => {
      const res = await app.request(`/api/tutorials/${draft}`, authed(author.token, {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Renamed again', nonsense: true }),
      }))
      expect(res.status).toBe(200)
    })

    it('403s on the protected audit fields', async () => {
      for (const field of ['reviewed_by', 'reviewed_for_org_id', 'reviewed_at', 'rejection_note']) {
        const res = await app.request(`/api/tutorials/${draft}`, authed(author.token, {
          method: 'PATCH',
          body: JSON.stringify({ [field]: author.id }),
        }))
        expect(res.status).toBe(403)
      }
    })

    it('403s when a leader tries to publish through this endpoint', async () => {
      // The leader's RLS grant WOULD permit this write. The refusal is the route's,
      // and it exists so no publish can skip reviewed_by and reviewed_for_org_id.
      const res = await app.request(`/api/tutorials/${backed}`, authed(leader.token, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
      }))
      expect(res.status).toBe(403)

      const { data } = await adminClient()
        .from('tutorials').select('status').eq('id', backed).single()
      expect(data?.status).toBe('draft')
    })

    it('403s on draft to pending with no accepted contributor terms', async () => {
      const res = await app.request(`/api/tutorials/${backed}`, authed(untermedAuthor.token, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'pending' }),
      }))
      expect(res.status).toBe(403)

      await acceptTerms(untermedAuthor.id, 'contributor_terms')
      const after = await app.request(`/api/tutorials/${backed}`, authed(untermedAuthor.token, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'pending' }),
      }))
      expect(after.status).toBe(200)
    })
  })

  describe('POST /api/tutorials', () => {
    it('403s with no accepted contributor terms', async () => {
      const fresh = await createTestUser('contributor')
      const res = await app.request('/api/tutorials', authed(fresh.token, {
        method: 'POST',
        body: JSON.stringify({ id: crypto.randomUUID(), title: 'Gated', difficulty: 'easy' }),
      }))
      expect(res.status).toBe(403)
      await deleteTestUser(fresh.id)
    })
  })
  ```

- [ ] **Step 3: Run and verify**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/tutorials/
  ```

  Expected: the new file's 6 pass, and the pre-existing `tutorials/` suites still
  pass. If `status-flow.test.ts` or `upsert-idempotency.test.ts` fail, they create
  tutorials without accepting `contributor_terms` — add `acceptTerms(user.id,
  'contributor_terms')` to their `beforeAll` rather than weakening the gate.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/api/src/routes/tutorials.ts
  git commit -m "feat(api): allowlist the tutorial edit endpoint and gate submission"

  git add packages/api/tests/integration/tutorials/patch-allowlist.test.ts
  git commit -m "test(api): assert a leader cannot publish without an audit trail"
  ```

---

## Task 8: Admin queue, audit uniformity, and spot-check

**Files:**
- Modify: `packages/api/src/routes/admin.ts`
- Modify: `packages/api/tests/integration/orgs/admin-endpoints.test.ts`

**Interfaces:**
- Produces: `GET /api/admin/tutorials?status=` with `tutorial_orgs` embedded;
  `GET /api/admin/spot-check` → approved tutorials reviewed by someone else.

- [ ] **Step 1: Embed backing state in the queue**

  In `admin.get('/tutorials')`, extend the select so each row carries who is
  handling it (decision 23 — the admin sees everything, and the row says whether
  an organisation has it):

  ```typescript
      .select('*, tutorial_contributors(profile_id), tutorial_orgs(status, organizations(id, name))')
  ```

- [ ] **Step 2: Record the reviewer on the admin status endpoint**

  In `admin.patch('/tutorials/:id/status')`, add `reviewed_by` so the audit trail
  is uniform regardless of who reviewed:

  ```typescript
        reviewed_by: c.get('userId'),
  ```

  `reviewed_for_org_id` is deliberately left untouched: the admin acts for the
  platform, not for an organisation, and a null there is what distinguishes the
  two in the spot-check query below.

- [ ] **Step 3: Add the spot-check endpoint**

  ```typescript
  /**
   * GET /api/admin/spot-check
   *
   * A random sample of tutorials someone other than the admin approved. With no
   * self-review block (decision 14) a leader may publish their own work, so
   * sampling is how a bad approval gets noticed at all — this endpoint is the
   * detection half of a control whose other half is reactive.
   *
   * Ordered by random() rather than by date so repeated visits surface different
   * rows; an admin who only ever sees the newest ten checks the same work twice.
   */
  admin.get('/spot-check', async (c) => {
    const limit = Number(c.req.query('limit') ?? 10)
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('tutorials')
      .select('*, tutorial_contributors(profile_id), tutorial_orgs(status, organizations(id, name))')
      .eq('status', 'approved')
      .not('reviewed_by', 'is', null)
      .neq('reviewed_by', c.get('userId'))
      .limit(limit)
    if (error) return c.json({ error: error.message }, 500)
    // PostgREST has no random ordering, and the sample is small enough that
    // shuffling here costs nothing. A database-side sample would matter at a
    // scale this platform is nowhere near.
    // ponytail: in-memory shuffle of at most `limit` rows; move to a
    // tablesample query if the approved set ever gets large.
    const shuffled = (data ?? []).sort(() => Math.random() - 0.5)
    return c.json(shuffled)
  })
  ```

- [ ] **Step 4: Write the failing test**

  Append to `admin-endpoints.test.ts`:

  ```typescript
  describe('the admin queue and spot-check', () => {
    it('shows every pending tutorial, with backing state on the row', async () => {
      const orgId = createdOrgIds[0]
      const res = await app.request('/api/admin/tutorials?status=pending', authed(admin.token))
      expect(res.status).toBe(200)
      const rows = (await res.json()) as Array<{
        id: string
        tutorial_orgs: Array<{ status: string; organizations: { name: string } }>
      }>
      const row = rows.find((r) => r.id === project)
      // Decision 23: an accepted backing does not remove it from the admin's view.
      expect(row).toBeTruthy()
      expect(row!.tutorial_orgs.some((b) => b.status === 'accepted')).toBe(true)
      expect(row!.tutorial_orgs[0].organizations.name).toBeTruthy()
      expect(orgId).toBeTruthy()
    })

    it('samples tutorials the admin did not approve, and excludes their own', async () => {
      const mine = await createProject({ authorId: author.id, status: 'approved' })
      const theirs = await createProject({ authorId: author.id, status: 'approved' })
      await adminClient().from('tutorials').update({ reviewed_by: admin.id }).eq('id', mine)
      await adminClient().from('tutorials').update({ reviewed_by: leader.id }).eq('id', theirs)

      const res = await app.request('/api/admin/spot-check', authed(admin.token))
      const ids = ((await res.json()) as Array<{ id: string }>).map((t) => t.id)
      expect(ids).toContain(theirs)
      expect(ids).not.toContain(mine)

      await adminClient().from('tutorials').delete().in('id', [mine, theirs])
    })

    it('403s for a contributor', async () => {
      const res = await app.request('/api/admin/spot-check', authed(leader.token))
      expect(res.status).toBe(403)
    })

    it('an admin can reject a tutorial a leader already published', async () => {
      // Spec §5 test 16, and the last of the three reactive controls that replace
      // the self-review block. The status endpoint places no constraint on the
      // transition, so approved -> rejected pulls a bad approval back down.
      const published = await createProject({ authorId: author.id, status: 'approved' })
      await adminClient().from('tutorials').update({
        reviewed_by: leader.id, reviewed_for_org_id: createdOrgIds[0],
      }).eq('id', published)

      const res = await app.request(`/api/admin/tutorials/${published}/status`, authed(admin.token, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'rejected', rejection_note: 'Step 4 is unsafe as written' }),
      }))
      expect(res.status).toBe(200)

      const { data } = await adminClient()
        .from('tutorials').select('status, rejection_note, reviewed_by').eq('id', published).single()
      expect(data).toMatchObject({ status: 'rejected', rejection_note: 'Step 4 is unsafe as written' })
      // The admin's own id replaces the leader's: whoever last decided is who the
      // audit trail names.
      expect(data?.reviewed_by).toBe(admin.id)

      await adminClient().from('tutorials').delete().eq('id', published)
    })
  })
  ```

- [ ] **Step 5: Run and verify**

  ```bash
  cd .worktrees/org-accounts-schema-rls/packages/api
  npx vitest run -c vitest.integration.config.ts tests/integration/orgs/admin-endpoints.test.ts
  ```

  Expected: 13 passed.

- [ ] **Step 6: Commit**

  ```bash
  git add packages/api/src/routes/admin.ts
  git commit -m "feat(api): show backing state in the admin queue and add spot-check"

  git add packages/api/tests/integration/orgs/admin-endpoints.test.ts
  git commit -m "test(api): assert the queue keeps org-handled work visible"
  ```

---

## Task 9: Full verification

- [ ] **Step 1: Reset and run everything**

  ```bash
  cd .worktrees/org-accounts-schema-rls
  npx supabase db reset
  cd packages/api
  npx vitest run -c vitest.integration.config.ts
  npx vitest run tests/unit
  npx tsc --noEmit
  ```

  Expected: all pass, no type errors.

- [ ] **Step 2: Web suite and typecheck**

  ```bash
  cd ../web
  npm run test:unit
  npx tsc --noEmit
  ```

  Expected: pass. No web source changed, so a failure means a shared type drifted.

- [ ] **Step 3: Refresh the graph and confirm a clean tree**

  ```bash
  cd ../..
  graphify update .
  git status --short
  git log --oneline development..HEAD | head -25
  ```

## Done when

- A contributor can ask organisations to back a project, withdraw a request, and
  cannot answer one.
- A leader can accept, decline, and review, and cannot answer for an organisation
  they do not lead or credit an approval to one they do not lead.
- Approving through `POST /:id/review` writes `status`, `reviewed_by`,
  `reviewed_at` and `reviewed_for_org_id` together; `PATCH /:id` refuses to
  publish at all.
- Submission is gated on `contributor_terms` at both creation and
  `draft → pending`; review is gated on `org_leader_terms` by the policy.
- Only the admin creates organisations and appoints leaders, and both changes are
  asserted against the database rather than the status code.
- The admin queue shows every pending tutorial with its backing state, and
  spot-check samples what someone else approved.
- Full API integration, both unit suites and both typechecks pass.
