# Org Accounts — API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-28-org-delegated-review-design.md` (§3, §5)
**Requires:** `2026-07-28-org-review-schema-rls.md` must be complete and merged.

**Goal:** Expose the org lifecycle over HTTP — create an org, join it, invite into it,
review its tutorials — and close the two pre-existing holes that become dangerous once
leaders hold an UPDATE grant: the unfiltered `PATCH /api/tutorials/:id` body, and the
admin queue that would otherwise show work leaders are about to handle.

**Architecture:** Three new Hono route files mounted in `app.ts`, plus surgical changes
to `tutorials.ts` and `admin.ts`. Membership and review writes go through
`createUserClient` so PostgreSQL remains the enforcement layer — routes are thin
wrappers whose job is to name the action, not to decide who may take it. `POST
/api/tutorials` keeps its admin client and therefore cannot set `org_id` at all — the
migration's `tutorials_org_must_be_own` trigger refuses a service-role write carrying
one. Org assignment is its own user-client endpoint, so every path that decides review
authority runs under the author's own JWT.

**Tech Stack:** Hono 4, `@supabase/supabase-js` v2, Vitest 2, TypeScript 5.

## Global Constraints

- Membership and review writes use `createUserClient(c.get('token'))`. Never
  `createAdminClient()` — the spec's decision 9 puts enforcement in RLS, and a
  service-role client silently bypasses every policy the previous plan just proved.
- Route files follow the existing convention: a leading block comment documenting
  endpoints and related files (see `routes/contributors.ts:1-32`), then
  `const x = new Hono<{ Variables: AuthVariables }>()`, then `export default x`.
- An RLS-blocked UPDATE returns **zero rows, not an error**. Handlers that must report
  a refusal check `data.length === 0` and return 403; they cannot rely on `error`.
- New types come from `@splat-connect/types` (added in the schema plan). Do not
  redeclare them locally.
- Agreement versions come from `AGREEMENT_VERSIONS`, never a string literal at a call site.
- **One file per commit.** Every commit step below stages exactly one path, ordered so
  each commit stands alone — the route file lands before the `app.ts` mount that imports
  it. Conventional commits (`feat(api):`, `fix(api):`, `test(api):`), and the message
  says what that specific file does, not what the task was.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/api/src/routes/organizations.ts` | **Create.** Org lifecycle: create, browse, list mine. |
| `packages/api/src/routes/org-members.ts` | **Create.** Membership handshake, one route per action so the URL names the acting party. |
| `packages/api/src/routes/agreements.ts` | **Create.** Record and list terms acceptances. ~30 lines, but separate because it is a different resource with a different lifetime — folding it into `contributors.ts` would make that file two things. |
| `packages/api/src/routes/tutorials.ts` | **Modify.** Field allowlist on PATCH, new `POST /:id/org` (draft-only) and `POST /:id/review`. |
| `packages/api/src/routes/admin.ts` | **Modify.** Audit fields on status change, platform-only queue, spot-check endpoints. |
| `packages/api/src/app.ts` | **Modify.** Mount three route groups behind `authMiddleware`. |
| `packages/api/tests/unit/routes/organizations.test.ts` | **Create.** Route-shape tests. |
| `packages/api/tests/unit/routes/tutorials.test.ts` | **Modify.** Allowlist cases. |
| `packages/api/tests/integration/orgs/review-endpoint.test.ts` | **Create.** Audit-trail and terms-gate behaviour end to end. |

`org-members.ts` is deliberately separate from `organizations.ts`: they change for
different reasons (membership rules vs. org lifecycle) and the membership file is where
the `initiated_by` logic concentrates.

---

## Task 1: Agreements route

**Files:**
- Create: `packages/api/src/routes/agreements.ts`
- Modify: `packages/api/src/app.ts`

**Interfaces:**
- Produces: `POST /api/agreements` body `{ agreement_type: AgreementType }` → 201
  `UserAgreement`; `GET /api/agreements/me` → `UserAgreement[]`. Every later task's
  terms gate depends on rows this route writes.

Built first because both the org-creation gate and the tutorial-submission gate are
unreachable until a user can record an acceptance.

- [ ] **Step 1: Write the route**

```typescript
/**
 * Terms Acceptance Routes (Protected)
 *
 * Records that a user accepted a version of an agreement. Contains no legal text:
 * the terms themselves are versioned static content under app/legal/, referenced
 * by the version string.
 *
 * Endpoints:
 * - POST /api/agreements
 *   - Body: { agreement_type: 'contributor_terms' | 'org_leader_terms' }
 *   - The version is server-chosen from AGREEMENT_VERSIONS so a client cannot
 *     claim acceptance of a version that was never shown to it.
 *   - Returns: UserAgreement
 *
 * - GET /api/agreements/me
 *   - Returns: UserAgreement[] so the UI can skip a gate already accepted
 *
 * Note: there is no update or delete path, by design — an acceptance record that
 * can be edited is not a record.
 *
 * Related files:
 * - supabase/migrations/007_organizations.sql: user_agreements table, has_accepted(),
 *   and the tutorials leader UPDATE policy that has_accepted() now gates. No route
 *   enforces the agreement — this endpoint exists so a promoted leader can satisfy
 *   that policy.
 * - routes/tutorials.ts: gated on contributor_terms
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
  if (!(type in AGREEMENT_VERSIONS)) {
    return c.json({ error: 'Unknown agreement_type' }, 400)
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

- [ ] **Step 2: Mount it in `app.ts`**

Add the import alongside the others (after line 33) and the mount lines:

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

Both `use` lines are required: Hono's `/api/agreements/*` pattern does not match the
bare `/api/agreements` path. `app.ts:45-46` already does this for `/api/tutorials` for
exactly this reason — omitting the bare line makes `POST /api/agreements` unauthenticated.

- [ ] **Step 3: Write a failing integration test**

Create `packages/api/tests/integration/orgs/agreements.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let user: TestUser

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => { user = await createTestUser('contributor') })
afterAll(async () => {
  await adminClient().from('user_agreements').delete().eq('user_id', user.id)
  await deleteTestUser(user.id)
})

describe('agreements', () => {
  it('records an acceptance with a server-chosen version', async () => {
    const res = await app.request('/api/agreements', authed(user.token, {
      method: 'POST',
      body: JSON.stringify({ agreement_type: 'contributor_terms', version: 'v999-forged' }),
    }))
    expect(res.status).toBe(201)
    const row = (await res.json()) as { version: string; agreement_type: string }
    expect(row.agreement_type).toBe('contributor_terms')
    // The forged version in the request body is ignored.
    expect(row.version).toBe('v0-todo')
  })

  it('rejects an unknown agreement type', async () => {
    const res = await app.request('/api/agreements', authed(user.token, {
      method: 'POST',
      body: JSON.stringify({ agreement_type: 'something_else' }),
    }))
    expect(res.status).toBe(400)
  })

  it('lists only the caller’s own acceptances', async () => {
    const other = await createTestUser('contributor')
    const res = await app.request('/api/agreements/me', authed(other.token))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
    await deleteTestUser(other.id)
  })
})
```

- [ ] **Step 4: Run and verify**

```bash
pnpm --filter @splat-connect/api test:integration -- tests/integration/orgs/agreements.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit, one file at a time**

```bash
git add packages/api/src/routes/agreements.ts
git commit -m "feat(api): add terms acceptance route with server-chosen versions"

git add packages/api/src/app.ts
git commit -m "feat(api): mount the agreements routes behind auth"

git add packages/api/tests/integration/orgs/agreements.test.ts
git commit -m "test(api): assert acceptance version cannot be forged by the client"
```

---

## Task 2: Organizations route (read-only)

There is no contributor-facing create endpoint. Under spec decision 11 only the
admin creates organisations, and the `organizations` INSERT policy is
`is_admin()` — a `POST /api/organizations` written here would be refused by the
database on every call. Creation lives in Task 2b.

**Files:**
- Create: `packages/api/src/routes/organizations.ts`
- Modify: `packages/api/src/app.ts`

**Interfaces:**
- Consumes: the `organizations` and `org_members` SELECT policies from
  `007_organizations.sql`.
- Produces:
  - `GET /api/organizations` → `Organization[]` (approved only)
  - `GET /api/organizations/mine` → `(OrgMember & { organizations: Organization })[]`

- [ ] **Step 1: Write the route**

```typescript
/**
 * Organization Routes (Protected, read-only)
 *
 * Endpoints:
 *  - GET /api/organizations
 *      - Approved orgs only — the browse/join picker.
 *
 *  - GET /api/organizations/mine
 *      - The caller's memberships with the org embedded. Drives the submit-flow
 *        org picker and the dashboard's org section.
 *
 * Security notes:
 *  - Reads go through createUserClient, so the SELECT policies in
 *    007_organizations.sql decide what comes back. `/mine` filters on user_id as
 *    well, but only as an index hint — the policy is what makes it safe.
 *  - There is deliberately no POST here. Only an admin may create an
 *    organisation (see routes/admin.ts), and the RLS INSERT policy is is_admin(),
 *    so a create handler on this router could never succeed.
 *
 * Related files:
 *  - supabase/migrations/007_organizations.sql: the policies enforcing all of the above
 *  - routes/org-members.ts: joining, inviting, roster
 *  - routes/admin.ts: creation, suspension, trust level, leader promotion
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
    .eq('status', 'approved')
    .order('name', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

organizations.get('/mine', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('org_members')
    .select('*, organizations(*)')
    .eq('user_id', c.get('userId'))
    .neq('status', 'removed')
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

export default organizations
```

- [ ] **Step 2: Mount it in `app.ts`**

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

- [ ] **Step 3: Write the failing integration test**

Create `packages/api/tests/integration/orgs/organizations.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addMember, cleanupOrg } from '../../helpers/orgs.js'

let member: TestUser
let outsider: TestUser
let approvedOrg: string
let pendingOrg: string

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => {
  member = await createTestUser('contributor')
  outsider = await createTestUser('contributor')
  const admin = await createTestUser('admin')
  approvedOrg = await createOrg({ createdBy: admin.id, status: 'approved' })
  pendingOrg = await createOrg({ createdBy: admin.id, status: 'pending' })
  await addMember({ orgId: approvedOrg, userId: member.id, orgRole: 'member', status: 'approved' })
  await deleteTestUser(admin.id)
})

afterAll(async () => {
  await cleanupOrg(approvedOrg)
  await cleanupOrg(pendingOrg)
  await deleteTestUser(member.id)
  await deleteTestUser(outsider.id)
})

describe('GET /api/organizations', () => {
  it('lists approved orgs and hides pending ones', async () => {
    const res = await app.request('/api/organizations', authed(outsider.token))
    expect(res.status).toBe(200)
    const list = (await res.json()) as Array<{ id: string }>
    const ids = list.map((o) => o.id)
    expect(ids).toContain(approvedOrg)
    expect(ids).not.toContain(pendingOrg)
  })
})

describe('GET /api/organizations/mine', () => {
  it("returns the caller's memberships with the org embedded", async () => {
    const res = await app.request('/api/organizations/mine', authed(member.token))
    expect(res.status).toBe(200)
    const list = (await res.json()) as Array<{ org_id: string; organizations: { id: string } }>
    expect(list).toHaveLength(1)
    expect(list[0].org_id).toBe(approvedOrg)
    expect(list[0].organizations.id).toBe(approvedOrg)
  })

  it('returns nothing for someone with no memberships', async () => {
    const res = await app.request('/api/organizations/mine', authed(outsider.token))
    const list = (await res.json()) as unknown[]
    expect(list).toHaveLength(0)
  })
})
```

- [ ] **Step 4: Run and verify**

```bash
pnpm --filter @splat-connect/api test:integration -- tests/integration/orgs/organizations.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit, one file at a time**

```bash
git add packages/api/src/routes/organizations.ts
git commit -m "feat(api): add organization browse and membership listing routes"

git add packages/api/src/app.ts
git commit -m "feat(api): mount the organizations routes behind auth"

git add packages/api/tests/integration/orgs/organizations.test.ts
git commit -m "test(api): assert the browse list hides orgs that are not approved"
```

---

## Task 2b: Admin organisation and leadership endpoints

Creation and leader promotion, the two things spec decisions 11 and 12 reserve to
the admin. Both live in `routes/admin.ts`, behind the existing role check at
`admin.ts:56`, and both use the admin client.

**Files:**
- Modify: `packages/api/src/routes/admin.ts`
- Test: `packages/api/tests/integration/orgs/admin-organizations.test.ts`

**Interfaces:**
- Consumes: `"Admin can create organizations"` and
  `"Admin full access to org_members"` from `007_organizations.sql`.
- Produces:
  - `POST /api/admin/organizations` body `{ name, description?, leader_user_id }` → 201 `Organization`
  - `PATCH /api/admin/organizations/:orgId/members/:userId` body `{ org_role }` → 200 `OrgMember`

- [ ] **Step 1: Write the create handler**

```typescript
/**
 * POST /api/admin/organizations
 *
 * Creates an organisation and its first leader in one call.
 *
 * WHY leader_user_id is required rather than optional: an org with no leader
 * cannot approve its own join requests, so a leaderless org is inert and the
 * admin would have to come back to fix it. An earlier design had the founder
 * self-claim leadership through an RLS bootstrap policy; that policy is gone with
 * the founder (spec decision 11), and this is what replaces it.
 *
 * WHY status/trust_level are set explicitly rather than left to the column
 * defaults: the defaults are pending/probation on purpose, so that a row written
 * by some future path that forgets is inert rather than live. Creation by the
 * admin *is* the approval (decision 5), so this route opts in deliberately.
 *
 * WHY createUserClient and not createAdminClient, unlike every other handler in
 * this file: org_members_freeze_provenance permits an org_role change only when
 * is_admin(), and is_admin() reads auth.uid() — which the service role does not
 * have. A service-role promote or demote raises 42501 and silently changes
 * nothing. Triggers run for service_role even though RLS does not; this is the
 * same trap §2 of the spec documents for tutorials.org_id. Using the admin's own
 * JWT throughout also keeps "Admin can create organizations" and "Admin full
 * access to org_members" live in production rather than exercised only by tests,
 * and "Admin can view all profiles" (001_schema.sql:127) covers the role lookup.
 *
 * WHY the profiles.role check is TypeScript and not RLS: spec decision 9 puts
 * enforcement in the database because a *leader* is a semi-trusted account held
 * by someone outside the platform. This route is behind admin middleware and the
 * admin client holds service_role regardless, so a database guard here would
 * constrain nobody. Decision 8's real failure mode is a parent-role leader being
 * treated as logged-out by getUserRole() with no error to debug — a 400 at the
 * point of the mistake is the fix that helps.
 */
admin.post('/organizations', async (c) => {
  const body = await c.req.json<{ name?: string; description?: string; leader_user_id?: string }>()
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)
  if (!body.leader_user_id) return c.json({ error: 'leader_user_id is required' }, 400)

  const supabase = createUserClient(c.get('token'))

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', body.leader_user_id)
    .single()
  if (!profile) return c.json({ error: 'leader_user_id does not exist' }, 400)
  if (profile.role !== 'contributor') {
    return c.json({ error: 'an org leader must have the contributor role' }, 400)
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .insert({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      created_by: c.get('userId'),
      status: 'approved',
      trust_level: 'trusted',
    })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)

  const { error: memberError } = await supabase.from('org_members').insert({
    org_id: org.id,
    user_id: body.leader_user_id,
    org_role: 'leader',
    status: 'approved',
    initiated_by: 'org',
    invited_by: c.get('userId'),
    joined_at: new Date().toISOString(),
  })
  if (memberError) {
    // Roll the org back rather than leaving a leaderless one behind: it would be
    // browsable and joinable, and nobody could act on the join requests.
    await supabase.from('organizations').delete().eq('id', org.id)
    return c.json({ error: memberError.message }, 500)
  }

  return c.json(org, 201)
})
```

- [ ] **Step 2: Write the promote/demote handler**

```typescript
/**
 * PATCH /api/admin/organizations/:orgId/members/:userId
 *
 * The only path in the product that grants org leadership (spec decision 12).
 * Every other write path is closed against it: the invite policy pins
 * org_role = 'member', and org_members_freeze_provenance refuses an org_role
 * change from anyone but an admin.
 *
 * Requires the membership to already be approved. Promoting a pending row would
 * produce ('leader', 'pending') — a state the schema allows, but one that reads
 * as an invited leader who has not accepted, which is not what happened.
 */
admin.patch('/organizations/:orgId/members/:userId', async (c) => {
  const { orgId, userId } = c.req.param()
  const body = await c.req.json<{ org_role?: string }>()
  if (body.org_role !== 'leader' && body.org_role !== 'member') {
    return c.json({ error: "org_role must be 'leader' or 'member'" }, 400)
  }

  const supabase = createUserClient(c.get('token'))
  const { data: membership } = await supabase
    .from('org_members')
    .select('id, status')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .single()
  if (!membership) return c.json({ error: 'membership not found' }, 404)
  if (membership.status !== 'approved') {
    return c.json({ error: 'only an approved member can be promoted or demoted' }, 400)
  }

  if (body.org_role === 'leader') {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
    if (profile?.role !== 'contributor') {
      return c.json({ error: 'an org leader must have the contributor role' }, 400)
    }
  }

  const { data, error } = await supabase
    .from('org_members')
    .update({ org_role: body.org_role })
    .eq('id', membership.id)
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})
```

- [ ] **Step 3: Write the failing integration test**

Create `packages/api/tests/integration/orgs/admin-organizations.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { addMember, cleanupOrg } from '../../helpers/orgs.js'

let admin: TestUser
let leader: TestUser
let parent: TestUser
let joiner: TestUser
const createdOrgIds: string[] = []

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => {
  admin = await createTestUser('admin')
  leader = await createTestUser('contributor')
  parent = await createTestUser('parent')
  joiner = await createTestUser('contributor')
})

afterAll(async () => {
  for (const id of createdOrgIds) await cleanupOrg(id)
  await deleteTestUser(admin.id)
  await deleteTestUser(leader.id)
  await deleteTestUser(parent.id)
  await deleteTestUser(joiner.id)
})

describe('POST /api/admin/organizations', () => {
  it('creates an approved, trusted org and its first leader', async () => {
    const res = await app.request('/api/admin/organizations', authed(admin.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Riverside Therapy', leader_user_id: leader.id }),
    }))
    expect(res.status).toBe(201)
    const org = (await res.json()) as { id: string; status: string; trust_level: string }
    createdOrgIds.push(org.id)
    expect(org.status).toBe('approved')
    expect(org.trust_level).toBe('trusted')

    const { data: member } = await adminClient()
      .from('org_members')
      .select('org_role, status')
      .eq('org_id', org.id)
      .eq('user_id', leader.id)
      .single()
    expect(member).toEqual({ org_role: 'leader', status: 'approved' })
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

describe('PATCH /api/admin/organizations/:orgId/members/:userId', () => {
  it('promotes an approved member to leader', async () => {
    const orgId = createdOrgIds[0]
    await addMember({ orgId, userId: joiner.id, orgRole: 'member', status: 'approved' })
    const res = await app.request(
      `/api/admin/organizations/${orgId}/members/${joiner.id}`,
      authed(admin.token, { method: 'PATCH', body: JSON.stringify({ org_role: 'leader' }) }),
    )
    expect(res.status).toBe(200)
    const { data } = await adminClient()
      .from('org_members').select('org_role').eq('org_id', orgId).eq('user_id', joiner.id).single()
    expect(data?.org_role).toBe('leader')
  })

  it('refuses to promote a membership that is not approved', async () => {
    const orgId = createdOrgIds[0]
    const pending = await createTestUser('contributor')
    await addMember({ orgId, userId: pending.id, orgRole: 'member', status: 'pending' })
    const res = await app.request(
      `/api/admin/organizations/${orgId}/members/${pending.id}`,
      authed(admin.token, { method: 'PATCH', body: JSON.stringify({ org_role: 'leader' }) }),
    )
    expect(res.status).toBe(400)
    await deleteTestUser(pending.id)
  })

  it('actually persists the demotion rather than failing silently', async () => {
    // Regression guard for a real bug found while writing these controls: with
    // createAdminClient() this endpoint returns 200 and changes nothing, because
    // org_members_freeze_provenance raises under service_role. Asserting the
    // status code alone would not have caught it.
    const orgId = createdOrgIds[0]
    await app.request(
      `/api/admin/organizations/${orgId}/members/${joiner.id}`,
      authed(admin.token, { method: 'PATCH', body: JSON.stringify({ org_role: 'member' }) }),
    )
    const { data } = await adminClient()
      .from('org_members').select('org_role').eq('org_id', orgId).eq('user_id', joiner.id).single()
    expect(data?.org_role).toBe('member')
  })

  it('refuses a leader acting on their own org', async () => {
    const orgId = createdOrgIds[0]
    const res = await app.request(
      `/api/admin/organizations/${orgId}/members/${joiner.id}`,
      authed(leader.token, { method: 'PATCH', body: JSON.stringify({ org_role: 'member' }) }),
    )
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 4: Run and verify**

```bash
pnpm --filter @splat-connect/api test:integration -- tests/integration/orgs/admin-organizations.test.ts
```

Expected: 8 passed. The two 403s come from the admin middleware, not from RLS —
these routes use the admin client, so RLS is not the layer refusing them. That is
the one place in this feature where a route-level check is the whole guard, and
it is why both are asserted.

- [ ] **Step 5: Commit, one file at a time**

```bash
git add packages/api/src/routes/admin.ts
git commit -m "feat(api): add admin organisation creation and leader promotion"

git add packages/api/tests/integration/orgs/admin-organizations.test.ts
git commit -m "test(api): assert only an admin can create an org or grant leadership"
```

---

## Task 3: Org members route

**Files:**
- Create: `packages/api/src/routes/org-members.ts`
- Modify: `packages/api/src/app.ts`

**Interfaces:**
- Produces:
  - `POST /api/org-members/request` body `{ org_id }` → 201
  - `POST /api/org-members/invite` body `{ org_id, user_id }` → 201
  - `POST /api/org-members/:id/approve` → 200 (leader resolves a request)
  - `POST /api/org-members/:id/decline` → 200 (leader refuses a request)
  - `POST /api/org-members/:id/accept` → 200 (contributor accepts an invite)
  - `POST /api/org-members/:id/reject` → 200 (contributor refuses an invite)
  - `POST /api/org-members/:id/remove` → 200 (leader removes a member)
  - `GET /api/org-members/:orgId/roster` → `OrgMember[]` with profiles embedded

- [ ] **Step 1: Write the route**

```typescript
/**
 * Organization Membership Routes (Protected)
 *
 * Every membership is a two-sided handshake. org_members.initiated_by records
 * which party created the pending row, and RLS requires the OTHER party to
 * resolve it — a leader cannot accept an invitation on a contributor's behalf,
 * and a contributor cannot approve their own join request.
 *
 * approve/decline and accept/reject are separate routes rather than one
 * PATCH /:id { status } on purpose: the URL encodes which party is acting,
 * instead of pushing that distinction into a request body where an RLS
 * violation would be the only thing catching a mistake.
 *
 * Endpoints:
 * - POST /request           { org_id }            contributor asks to join
 * - POST /invite            { org_id, user_id }   leader invites a contributor
 * - POST /:id/approve                             leader accepts a request
 * - POST /:id/decline                             leader refuses a request
 * - POST /:id/accept                              contributor accepts an invite
 * - POST /:id/reject                              contributor refuses an invite
 * - POST /:id/remove                              leader removes a member
 * - GET  /:orgId/roster                           leader-visible member list
 *
 * Related files:
 * - supabase/migrations/007_organizations.sql: the policies doing the enforcing
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'
import type { OrgMemberStatus } from '@splat-connect/types'

const orgMembers = new Hono<{ Variables: AuthVariables }>()

/**
 * Applies a status transition and reports an RLS refusal as 403.
 *
 * WHY: A blocked UPDATE is not a Postgres error — the USING clause simply
 *      excludes the row, so the call succeeds against zero rows. Returning 200
 *      here would tell the caller the transition happened when it did not.
 */
async function transition(
  token: string,
  memberId: string,
  status: OrgMemberStatus,
  extra: Record<string, unknown> = {}
) {
  const supabase = createUserClient(token)
  const { data, error } = await supabase
    .from('org_members')
    .update({ status, ...extra })
    .eq('id', memberId)
    .select()
  if (error) return { status: 500 as const, body: { error: error.message } }
  if (!data || data.length === 0) {
    return { status: 403 as const, body: { error: 'Not permitted to change this membership' } }
  }
  return { status: 200 as const, body: data[0] }
}

orgMembers.get('/:orgId/roster', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('org_members')
    .select('*, profiles(*)')
    .eq('org_id', c.req.param('orgId'))
    .order('created_at', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

orgMembers.post('/request', async (c) => {
  const body = await c.req.json<{ org_id?: string }>()
  if (!body.org_id) return c.json({ error: 'org_id is required' }, 400)

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('org_members')
    .insert({
      org_id: body.org_id,
      user_id: c.get('userId'),
      org_role: 'member',
      status: 'pending',
      initiated_by: 'contributor',
    })
    .select()
    .single()

  if (error) {
    // 23505 = unique_violation: a row already exists for this (org, user).
    // Reviving a declined or removed row is the leader's call, not a re-request.
    if (error.code === '23505') {
      return c.json({ error: 'You already have a membership record with this organisation' }, 409)
    }
    if (error.code === '42501') return c.json({ error: 'Not permitted' }, 403)
    return c.json({ error: error.message }, 500)
  }
  return c.json(data, 201)
})

orgMembers.post('/invite', async (c) => {
  const body = await c.req.json<{ org_id?: string; user_id?: string }>()
  if (!body.org_id || !body.user_id) {
    return c.json({ error: 'org_id and user_id are required' }, 400)
  }

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('org_members')
    .insert({
      org_id: body.org_id,
      user_id: body.user_id,
      org_role: 'member',
      status: 'pending',
      initiated_by: 'org',
      invited_by: c.get('userId'),
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return c.json({ error: 'That contributor already has a membership record' }, 409)
    }
    if (error.code === '42501') return c.json({ error: 'Not permitted' }, 403)
    return c.json({ error: error.message }, 500)
  }
  return c.json(data, 201)
})

// Leader side — resolves rows the contributor initiated.
orgMembers.post('/:id/approve', async (c) => {
  const r = await transition(c.get('token'), c.req.param('id'), 'approved', {
    joined_at: new Date().toISOString(),
  })
  return c.json(r.body, r.status)
})

orgMembers.post('/:id/decline', async (c) => {
  const r = await transition(c.get('token'), c.req.param('id'), 'declined')
  return c.json(r.body, r.status)
})

orgMembers.post('/:id/remove', async (c) => {
  const r = await transition(c.get('token'), c.req.param('id'), 'removed')
  return c.json(r.body, r.status)
})

// Contributor side — resolves rows the org initiated.
orgMembers.post('/:id/accept', async (c) => {
  const r = await transition(c.get('token'), c.req.param('id'), 'approved', {
    joined_at: new Date().toISOString(),
  })
  return c.json(r.body, r.status)
})

orgMembers.post('/:id/reject', async (c) => {
  const r = await transition(c.get('token'), c.req.param('id'), 'declined')
  return c.json(r.body, r.status)
})

export default orgMembers
```

- [ ] **Step 2: Mount it in `app.ts`**

```typescript
import orgMembers from './routes/org-members.js'
```

```typescript
app.use('/api/org-members/*', authMiddleware)
```

```typescript
app.route('/api/org-members', orgMembers)
```

Only the wildcard line is needed here — every route in this group has a path segment.

- [ ] **Step 3: Write the failing integration test**

Create `packages/api/tests/integration/orgs/membership-routes.test.ts`. Assert
through HTTP what the schema plan asserted through SQL, because the routes add a
failure mode the policies do not have: reporting a zero-row refusal as success.

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addMember, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let joiner: TestUser
let orgId: string

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => {
  leader = await createTestUser('contributor')
  joiner = await createTestUser('contributor')
  orgId = await createOrg({ createdBy: leader.id, status: 'approved' })
  await addMember({ orgId, userId: leader.id, orgRole: 'leader', status: 'approved' })
})

afterAll(async () => {
  await cleanupOrg(orgId)
  await deleteTestUser(leader.id)
  await deleteTestUser(joiner.id)
})

describe('membership routes', () => {
  it('a contributor requests to join and the leader approves', async () => {
    const req = await app.request('/api/org-members/request', authed(joiner.token, {
      method: 'POST',
      body: JSON.stringify({ org_id: orgId }),
    }))
    expect(req.status).toBe(201)
    const row = (await req.json()) as { id: string; status: string; initiated_by: string }
    expect(row.status).toBe('pending')
    expect(row.initiated_by).toBe('contributor')

    // The requester cannot approve themselves — and the route must say so with a
    // 403 rather than reporting a zero-row update as success.
    const selfApprove = await app.request(`/api/org-members/${row.id}/approve`,
      authed(joiner.token, { method: 'POST' }))
    expect(selfApprove.status).toBe(403)

    const approve = await app.request(`/api/org-members/${row.id}/approve`,
      authed(leader.token, { method: 'POST' }))
    expect(approve.status).toBe(200)

    const { data } = await adminClient()
      .from('org_members').select('status, joined_at').eq('id', row.id).single()
    expect(data?.status).toBe('approved')
    expect(data?.joined_at).not.toBeNull()

    await adminClient().from('org_members').delete().eq('id', row.id)
  })

  it('a leader invites, and only the invitee can accept', async () => {
    const invite = await app.request('/api/org-members/invite', authed(leader.token, {
      method: 'POST',
      body: JSON.stringify({ org_id: orgId, user_id: joiner.id }),
    }))
    expect(invite.status).toBe(201)
    const row = (await invite.json()) as { id: string; initiated_by: string }
    expect(row.initiated_by).toBe('org')

    const leaderAccepts = await app.request(`/api/org-members/${row.id}/accept`,
      authed(leader.token, { method: 'POST' }))
    expect(leaderAccepts.status).toBe(403)

    const inviteeAccepts = await app.request(`/api/org-members/${row.id}/accept`,
      authed(joiner.token, { method: 'POST' }))
    expect(inviteeAccepts.status).toBe(200)

    await adminClient().from('org_members').delete().eq('id', row.id)
  })

  it('a non-leader cannot invite into the org', async () => {
    const res = await app.request('/api/org-members/invite', authed(joiner.token, {
      method: 'POST',
      body: JSON.stringify({ org_id: orgId, user_id: joiner.id }),
    }))
    expect(res.status).toBe(403)
  })

  it('a duplicate join request is reported as a conflict, not a crash', async () => {
    const first = await app.request('/api/org-members/request', authed(joiner.token, {
      method: 'POST', body: JSON.stringify({ org_id: orgId }),
    }))
    expect(first.status).toBe(201)
    const second = await app.request('/api/org-members/request', authed(joiner.token, {
      method: 'POST', body: JSON.stringify({ org_id: orgId }),
    }))
    expect(second.status).toBe(409)
    await adminClient().from('org_members').delete().eq('org_id', orgId).eq('user_id', joiner.id)
  })
})
```

- [ ] **Step 4: Run and verify**

```bash
pnpm --filter @splat-connect/api test:integration -- tests/integration/orgs/membership-routes.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit, one file at a time**

```bash
git add packages/api/src/routes/org-members.ts
git commit -m "feat(api): add org membership handshake routes with per-party actions"

git add packages/api/src/app.ts
git commit -m "feat(api): mount the org-members routes behind auth"

git add packages/api/tests/integration/orgs/membership-routes.test.ts
git commit -m "test(api): assert an RLS-refused membership change returns 403, not 200"
```

---

## Task 4: Lock down `PATCH /api/tutorials/:id`

**Files:**
- Modify: `packages/api/src/routes/tutorials.ts:121-137`
- Modify: `packages/api/tests/unit/routes/tutorials.test.ts`

**Interfaces:**
- Produces: a `PATCH` that accepts only `title`, `description`, `difficulty`,
  `tutorial_pdf_url`, `toy_photo_url`, and `status` ∈ {`draft`, `pending`}.

**Do this before Task 5.** Today `PATCH` writes the entire unfiltered request body
(`tutorials.ts:131`). RLS is the only thing stopping abuse, and Task 5 hands leaders an
UPDATE grant — at which point a leader could publish through this generic endpoint with
`reviewed_by`, `reviewed_at`, and `review_level` all left null, producing a published
tutorial with no audit trail and an invisible hole in the spot-check surface.

- [ ] **Step 1: Write the failing tests**

Add to `packages/api/tests/unit/routes/tutorials.test.ts`, matching the mocking style
already used in that file:

```typescript
describe('PATCH /api/tutorials/:id field allowlist', () => {
  it('drops unknown keys instead of writing them', async () => {
    // Assert the object handed to .update() contains only allowlisted keys.
  })

  it('rejects an attempt to set org_id, review_level, or reviewed_by', async () => {
    // Expect 403 for each protected field.
  })

  it('rejects status: approved even from a caller whose RLS grant would allow it', async () => {
    // Expect 403 — approving must go through POST /:id/review or the admin endpoint.
  })

  it('still allows the draft → pending submission transition', async () => {
    // Expect 200.
  })
})
```

- [ ] **Step 2: Run and verify they fail**

```bash
pnpm --filter @splat-connect/api test:unit -- tests/unit/routes/tutorials.test.ts
```

Expected: FAIL — the current handler passes `body` through untouched.

- [ ] **Step 3: Replace the handler**

```typescript
// WHY: This endpoint previously wrote the entire request body to the row. RLS
//      was the only guard, and once org leaders hold an UPDATE grant that is not
//      enough: a leader could publish a tutorial straight through here, leaving
//      reviewed_by, reviewed_at and review_level null — a published tutorial with
//      no audit trail, invisible to the admin spot-check.
// HOW: An explicit allowlist. Unknown keys are dropped silently (a stale client
//      sending an extra field should not fail); the protected review columns are
//      refused loudly, because sending one is a mistake worth surfacing.
//      Approve and reject go through POST /:id/review or the admin endpoint.
const EDITABLE_FIELDS = [
  'title',
  'description',
  'difficulty',
  'tutorial_pdf_url',
  'toy_photo_url',
  'status',
] as const

const PROTECTED_FIELDS = ['org_id', 'review_level', 'reviewed_by', 'reviewed_at', 'flagged_for_follow_up'] as const

// The only transitions a contributor drives. 'rejected' is absent deliberately:
// nothing but a review produces it.
const SELF_SERVICE_STATUSES = ['draft', 'pending'] as const

tutorials.patch('/:id', async (c) => {
  const body = await c.req.json<Record<string, unknown>>()

  const attempted = PROTECTED_FIELDS.filter((f) => f in body)
  if (attempted.length > 0) {
    return c.json({ error: `Cannot set: ${attempted.join(', ')}` }, 403)
  }

  if ('status' in body && !SELF_SERVICE_STATUSES.includes(body.status as 'draft' | 'pending')) {
    return c.json(
      { error: 'Use POST /api/tutorials/:id/review or the admin endpoint to approve or reject' },
      403
    )
  }

  const update: Record<string, unknown> = {}
  for (const field of EDITABLE_FIELDS) {
    if (field in body) update[field] = body[field]
  }
  if (Object.keys(update).length === 0) {
    return c.json({ error: 'No editable fields in request' }, 400)
  }

  // Submitting for review is the moment work is actually offered to the platform,
  // so the terms gate lives here as well as on creation. Gating creation alone
  // would let drafts that predate the terms sail through while blocking their
  // authors from touching their own work.
  if (update.status === 'pending') {
    const gate = await requireContributorTerms(c.get('token'))
    if (gate) return c.json({ error: gate }, 403)
  }

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

- [ ] **Step 4: Add the terms gate helper above the route definitions**

```typescript
/**
 * Returns an error message when the caller has not accepted the contributor
 * terms, or null when they have. Reads through the user client so the
 * user_agreements SELECT policy ("own rows only") is what scopes the lookup.
 */
async function requireContributorTerms(token: string): Promise<string | null> {
  const supabase = createUserClient(token)
  const { data, error } = await supabase
    .from('user_agreements')
    .select('id')
    .eq('agreement_type', 'contributor_terms')
    .limit(1)
  if (error) return 'Could not verify terms acceptance'
  if (!data || data.length === 0) return 'You must accept the contributor terms first'
  return null
}
```

- [ ] **Step 5: Run the unit tests and verify they pass**

```bash
pnpm --filter @splat-connect/api test:unit -- tests/unit/routes/tutorials.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run the integration suite to catch the fallout**

```bash
pnpm --filter @splat-connect/api test:integration
```

Expected: `tutorials/status-flow.test.ts` now FAILS on the `draft → pending`
transition, because its test users have no `contributor_terms` row. This is the gate
working. Fix by calling `acceptTerms(user.id, 'contributor_terms')` in that file's
`beforeAll` — do not weaken the gate.

- [ ] **Step 7: Commit, one file at a time**

Test first, then the implementation that makes it pass. That leaves one red commit in
history, which is the accepted trade for the granularity.

```bash
git add packages/api/tests/unit/routes/tutorials.test.ts
git commit -m "test(api): cover the PATCH /tutorials/:id field allowlist"

git add packages/api/src/routes/tutorials.ts
git commit -m "fix(api): restrict PATCH /tutorials/:id to an explicit field allowlist

The handler wrote the entire request body to the row, with RLS as the only
guard. Once org leaders hold an UPDATE grant that is not enough: a leader
could publish through this endpoint leaving reviewed_by, reviewed_at, and
review_level null — a published tutorial with no audit trail."

git add packages/api/tests/integration/tutorials/status-flow.test.ts
git commit -m "test(api): accept contributor terms in the status-flow fixture

The draft to pending transition is now gated on contributor_terms, so the
existing fixture users need an acceptance row."
```

---

## Task 5: Org snapshot on create, and the leader review endpoint

**Files:**
- Modify: `packages/api/src/routes/tutorials.ts:90-119` (POST) and append `POST /:id/review`

**Interfaces:**
- Produces: `POST /api/tutorials` accepts optional `org_id`;
  `POST /api/tutorials/:id/org` body `{ org_id: string | null }` → 200 `Tutorial`
  (draft-only, consumed by the web plan's submit flow);
  `POST /api/tutorials/:id/review` body `{ status: 'approved' | 'rejected', rejection_note? }`.

- [ ] **Step 1: Add the terms gate to `POST /` — but NOT `org_id`**

`POST /api/tutorials` uses `createAdminClient()` (`tutorials.ts:94`), and the
`tutorials_org_must_be_own` trigger in migration 007 permits a write that sets
`org_id` only from a caller who is an approved member of that org. The service role
has no `auth.uid()`, so **a service-role insert carrying `org_id` is refused with
42501.** That is deliberate: it means no server-side code path can pin a tutorial to
an org on a user's behalf, so the rule cannot be bypassed by a carelessly written
route. Verified against the live database.

Therefore this route does **not** accept `org_id`. All org assignment goes through
`POST /:id/org` (Step 3), which uses `createUserClient` and so runs under the
author's own JWT.

Insert before the insert call:

```typescript
  const termsError = await requireContributorTerms(c.get('token'))
  if (termsError) return c.json({ error: termsError }, 403)
```

And add to the `.insert({...})` object:

```typescript
      // A tutorial starts unpinned, on the platform queue. POST /:id/org moves it
      // to an org's queue under the author's own JWT — the only path the database
      // permits, by design.
      review_level: 'platform',
```

If a request body carries `org_id`, ignore it silently: the field allowlist in
Task 4 already refuses it on `PATCH`, and accepting it here only to drop it would
invite the belief that it works.

- [ ] **Step 2: Append the review endpoint**

```typescript
/**
 * Leader review action. Uses createUserClient, so the database is the
 * enforcement layer: the "Trusted org leaders can review their org's tutorials"
 * policy independently requires an approved+trusted org, an approved leadership
 * row, and no tutorial_contributors link between the reviewer and the tutorial.
 */
tutorials.post('/:id/review', async (c) => {
  const body = await c.req.json<{ status?: string; rejection_note?: string }>()

  if (body.status !== 'approved' && body.status !== 'rejected') {
    return c.json({ error: "status must be 'approved' or 'rejected'" }, 400)
  }
  // Required on rejection: a rejection with no explanation is the single most
  // common cause of a contributor re-submitting the same problem.
  if (body.status === 'rejected' && !body.rejection_note?.trim()) {
    return c.json({ error: 'rejection_note is required when rejecting' }, 400)
  }

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    .update({
      status: body.status,
      reviewed_by: c.get('userId'),
      reviewed_at: new Date().toISOString(),
      review_level: 'org',
      rejection_note: body.status === 'rejected' ? body.rejection_note!.trim() : null,
    })
    .eq('id', c.req.param('id'))
    .select()
    .single()

  if (error) {
    // PGRST116 = "JSON object requested, multiple (or no) rows returned": the
    // RLS USING clause excluded the row, so the update matched nothing. Not an
    // error condition in Postgres terms — it is the refusal.
    if (error.code === 'PGRST116') {
      return c.json({ error: 'Not permitted to review this tutorial' }, 403)
    }
    return c.json({ error: error.message }, 500)
  }
  return c.json(data)
})
```

- [ ] **Step 3: Add the draft-only org assignment endpoint**

The wizard creates the tutorial at step 1 but shows the org picker at step 6 (spec
decision 3: chosen explicitly at submit time), so the picker has no way to reach the
`POST` above. A dedicated endpoint resolves this without widening the `PATCH` allowlist
— which exists precisely to stop `org_id` being writable from a generic update.

```typescript
/**
 * Sets the reviewing org on a tutorial that is still a draft.
 *
 * WHY: The upload wizard creates the tutorial at step 1 and asks which org should
 *      review it at step 6, so the org cannot be supplied at creation. PATCH
 *      /:id deliberately refuses org_id — it is the field that decides who holds
 *      review authority over the row — so this narrow endpoint exists instead of
 *      reopening that allowlist.
 * HOW: Draft-only. Once a tutorial is pending, its org is the snapshot that routed
 *      it to a queue, and changing it would move work between reviewers mid-review.
 */
tutorials.post('/:id/org', async (c) => {
  const body = await c.req.json<{ org_id?: string | null }>()
  const supabase = createUserClient(c.get('token'))

  if (body.org_id) {
    const membership = await supabase
      .from('org_members')
      .select('id')
      .eq('org_id', body.org_id)
      .eq('user_id', c.get('userId'))
      .eq('status', 'approved')
      .limit(1)
    if (!membership.data || membership.data.length === 0) {
      return c.json({ error: 'You are not an approved member of that organisation' }, 403)
    }
  }

  const { data, error } = await supabase
    .from('tutorials')
    .update({
      org_id: body.org_id ?? null,
      review_level: body.org_id ? 'org' : 'platform',
    })
    .eq('id', c.req.param('id'))
    .eq('status', 'draft')
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return c.json({ error: 'Tutorial not found, or no longer a draft' }, 403)
    }
    return c.json({ error: error.message }, 500)
  }
  return c.json(data)
})
```

- [ ] **Step 4: Write the failing integration test**

Create `packages/api/tests/integration/orgs/review-endpoint.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addMember, createOrgTutorial, acceptTerms, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let member: TestUser
let orgId: string
let tutorialId: string
let ownTutorialId: string

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => {
  leader = await createTestUser('contributor')
  member = await createTestUser('contributor')
  await acceptTerms(member.id, 'contributor_terms')
  orgId = await createOrg({ createdBy: leader.id, status: 'approved', trustLevel: 'trusted' })
  await addMember({ orgId, userId: leader.id, orgRole: 'leader', status: 'approved' })
  await addMember({ orgId, userId: member.id, orgRole: 'member', status: 'approved' })
  tutorialId = await createOrgTutorial({ orgId, authorId: member.id, authorToken: member.token, status: 'pending' })
  ownTutorialId = await createOrgTutorial({ orgId, authorId: leader.id, authorToken: leader.token, status: 'pending' })
})

afterAll(async () => {
  await cleanupOrg(orgId, [tutorialId, ownTutorialId])
  await deleteTestUser(leader.id)
  await deleteTestUser(member.id)
})

describe('POST /api/tutorials/:id/review', () => {
  it('approves and writes the full audit trail', async () => {
    const res = await app.request(`/api/tutorials/${tutorialId}/review`, authed(leader.token, {
      method: 'POST',
      body: JSON.stringify({ status: 'approved' }),
    }))
    expect(res.status).toBe(200)

    const { data } = await adminClient()
      .from('tutorials')
      .select('status, reviewed_by, reviewed_at, review_level')
      .eq('id', tutorialId)
      .single()
    expect(data?.status).toBe('approved')
    expect(data?.reviewed_by).toBe(leader.id)
    expect(data?.review_level).toBe('org')
    expect(data?.reviewed_at).not.toBeNull()
  })

  it('refuses a rejection with no note', async () => {
    const res = await app.request(`/api/tutorials/${ownTutorialId}/review`, authed(leader.token, {
      method: 'POST',
      body: JSON.stringify({ status: 'rejected', rejection_note: '   ' }),
    }))
    expect(res.status).toBe(400)
  })

  it('permits self-review — decision 14 removed the block', async () => {
    // A leader may approve their own tutorial. The endpoint must not reintroduce
    // in route code the guard the policy deliberately dropped, or the two layers
    // disagree and the database stops being the source of truth (decision 9).
    const res = await app.request(`/api/tutorials/${ownTutorialId}/review`, authed(leader.token, {
      method: 'POST',
      body: JSON.stringify({ status: 'approved' }),
    }))
    expect(res.status).toBe(200)

    const { data } = await adminClient()
      .from('tutorials').select('status, reviewed_by, review_level').eq('id', ownTutorialId).single()
    expect(data).toMatchObject({ status: 'approved', reviewed_by: leader.id, review_level: 'org' })
  })

  it('a leader cannot publish through the generic PATCH endpoint', async () => {
    const t = await createOrgTutorial({ orgId, authorId: member.id, authorToken: member.token, status: 'pending' })
    const res = await app.request(`/api/tutorials/${t}`, authed(leader.token, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    }))
    expect(res.status).toBe(403)

    const { data } = await adminClient().from('tutorials').select('status').eq('id', t).single()
    expect(data?.status).toBe('pending')
    await adminClient().from('tutorials').delete().eq('id', t)
  })

  it('ignores org_id on create — it is not settable through this route', async () => {
    const id = crypto.randomUUID()
    const res = await app.request('/api/tutorials', authed(member.token, {
      method: 'POST',
      body: JSON.stringify({ id, title: 'Sneaky', difficulty: 'easy', org_id: orgId }),
    }))
    expect(res.status).toBe(201)
    // Silently dropped, not honoured: the admin client cannot legally pin an org.
    const { data } = await adminClient().from('tutorials').select('org_id').eq('id', id).single()
    expect(data?.org_id).toBeNull()
    await adminClient().from('tutorials').delete().eq('id', id)
  })

  it('refuses submission from a contributor who has not accepted the terms', async () => {
    const noTerms = await createTestUser('contributor')
    const res = await app.request('/api/tutorials', authed(noTerms.token, {
      method: 'POST',
      body: JSON.stringify({ id: crypto.randomUUID(), title: 'No Terms', difficulty: 'easy' }),
    }))
    expect(res.status).toBe(403)
    await deleteTestUser(noTerms.id)
  })
})

describe('POST /api/tutorials/:id/org', () => {
  it('sets the reviewing org on a draft', async () => {
    const draft = await createOrgTutorial({ orgId: null, authorId: member.id, authorToken: member.token, status: 'draft' })
    const res = await app.request(`/api/tutorials/${draft}/org`, authed(member.token, {
      method: 'POST', body: JSON.stringify({ org_id: orgId }),
    }))
    expect(res.status).toBe(200)
    const row = (await res.json()) as { org_id: string; review_level: string }
    expect(row).toMatchObject({ org_id: orgId, review_level: 'org' })
    await adminClient().from('tutorials').delete().eq('id', draft)
  })

  it('refuses once the tutorial has left draft', async () => {
    const pending = await createOrgTutorial({ orgId: null, authorId: member.id, authorToken: member.token, status: 'pending' })
    const res = await app.request(`/api/tutorials/${pending}/org`, authed(member.token, {
      method: 'POST', body: JSON.stringify({ org_id: orgId }),
    }))
    expect(res.status).toBe(403)
    await adminClient().from('tutorials').delete().eq('id', pending)
  })

  it('refuses an org the author does not belong to', async () => {
    const outsider = await createTestUser('contributor')
    const draft = await createOrgTutorial({ orgId: null, authorId: outsider.id, authorToken: outsider.token, status: 'draft' })
    const res = await app.request(`/api/tutorials/${draft}/org`, authed(outsider.token, {
      method: 'POST', body: JSON.stringify({ org_id: orgId }),
    }))
    expect(res.status).toBe(403)
    await adminClient().from('tutorials').delete().eq('id', draft)
    await deleteTestUser(outsider.id)
  })
})
```

- [ ] **Step 5: Run and verify**

```bash
pnpm --filter @splat-connect/api test:integration -- tests/integration/orgs/review-endpoint.test.ts
```

Expected: 9 passed.

- [ ] **Step 6: Commit, one file at a time**

```bash
git add packages/api/src/routes/tutorials.ts
git commit -m "feat(api): add org snapshot on create and the leader review endpoint

org_id is snapshotted at submit rather than derived live, so review authority
cannot become retroactive or be revoked by a later membership change. The
review endpoint uses the user client so RLS remains the enforcement layer."

git add packages/api/tests/integration/orgs/review-endpoint.test.ts
git commit -m "test(api): assert the review endpoint writes a complete audit trail"
```

---

## Task 6: Admin queue, audit uniformity, and spot-check

**Files:**
- Modify: `packages/api/src/routes/admin.ts:54-81`

**Interfaces:**
- Produces: `GET /api/admin/tutorials` (platform queue by default),
  `GET /api/admin/spot-check`, `PATCH /api/admin/tutorials/:id/flag`,
  `PATCH /api/admin/organizations/:id`.

- [ ] **Step 1: Add the audit fields to the status endpoint**

In `admin.patch('/tutorials/:id/status')`, extend the `.update({...})` object:

```typescript
      // Written on every path so the audit trail is uniform regardless of who
      // reviewed: the spot-check surface depends on review_level being populated.
      review_level: 'platform',
      reviewed_by: c.get('userId'),
```

- [ ] **Step 2: Scope the admin queue to the platform's own work**

Replace the `.eq('status', status)` query in `admin.get('/tutorials')`:

```typescript
  // WHY: Showing every pending tutorial would keep work a leader is about to
  //      handle sitting in the admin queue, and the feature would not feel like
  //      it removed anything.
  // HOW: The default queue is the platform's own — tutorials with no org, or
  //      explicitly escalated to platform review. ?scope=all restores the
  //      firehose for when an admin genuinely wants everything.
  const scope = c.req.query('scope')
  let query = supabase
    .from('tutorials')
    .select('*, tutorial_contributors(profile_id), organizations(id, name)')
    .eq('status', status)
    .order('created_at', { ascending: true })
  if (scope !== 'all') {
    query = query.or('review_level.eq.platform,org_id.is.null')
  }
  const { data, error } = await query
```

- [ ] **Step 3: Add the spot-check and flag endpoints**

```typescript
/**
 * A random sample of tutorials that an org leader reviewed. This is the
 * platform's oversight of delegated review: not every org-reviewed tutorial is
 * re-checked, but any of them might be.
 */
admin.get('/spot-check', async (c) => {
  const supabase = createAdminClient()
  const limit = Number(c.req.query('limit') ?? 10)
  const { data, error } = await supabase
    .from('tutorials')
    .select('*, organizations(id, name), tutorial_contributors(profile_id)')
    .eq('review_level', 'org')
    .in('status', ['approved', 'rejected'])
    .order('reviewed_at', { ascending: false })
    .limit(200)
  if (error) return c.json({ error: error.message }, 500)

  // ponytail: shuffle in JS over the 200 most recent rather than ORDER BY
  // random() over the whole table — cheap, and the recent window is the part
  // worth auditing. Move to a SQL sample if the table grows past ~100k rows.
  const sample = [...(data ?? [])].sort(() => Math.random() - 0.5).slice(0, limit)
  return c.json(sample)
})

admin.patch('/tutorials/:id/flag', async (c) => {
  const body = await c.req.json<{ flagged: boolean }>()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tutorials')
    .update({ flagged_for_follow_up: !!body.flagged })
    .eq('id', c.req.param('id'))
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

admin.patch('/organizations/:id', async (c) => {
  const body = await c.req.json<{ status?: string; trust_level?: string }>()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  // Approving an org sets both fields. Vetting already happens at approval time;
  // a separate probation gate would duplicate that judgment while guaranteeing
  // the feature delivers nothing to a newly approved org. probation is a state
  // you DEMOTE into, not one you graduate from.
  if (body.status === 'approved') {
    update.status = 'approved'
    update.trust_level = body.trust_level ?? 'trusted'
  } else {
    if (body.status) update.status = body.status
    if (body.trust_level) update.trust_level = body.trust_level
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('organizations')
    .update(update)
    .eq('id', c.req.param('id'))
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

admin.get('/organizations', async (c) => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('*, org_members(count)')
    .order('created_at', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})
```

- [ ] **Step 4: Write the failing integration test**

Create `packages/api/tests/integration/orgs/admin-queue.test.ts` asserting:
- an org-reviewed pending tutorial does **not** appear in `GET /api/admin/tutorials`
- a tutorial with `org_id = null` **does** appear
- `?scope=all` returns both
- `PATCH /api/admin/organizations/:id { status: 'approved' }` sets `trust_level` to `trusted`
- `PATCH /api/admin/organizations/:id { status: 'suspended' }` leaves `trust_level` untouched
- a non-admin gets 403 from every one of these

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addMember, createOrgTutorial, cleanupOrg } from '../../helpers/orgs.js'

let admin: TestUser
let leader: TestUser
let member: TestUser
let orgId: string
let orgTutorial: string
let platformTutorial: string

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => {
  admin = await createTestUser('admin')
  leader = await createTestUser('contributor')
  member = await createTestUser('contributor')
  orgId = await createOrg({ createdBy: leader.id, status: 'approved', trustLevel: 'trusted' })
  await addMember({ orgId, userId: leader.id, orgRole: 'leader', status: 'approved' })
  orgTutorial = await createOrgTutorial({ orgId, authorId: member.id, authorToken: member.token, status: 'pending' })
  platformTutorial = await createOrgTutorial({ orgId: null, authorId: member.id, authorToken: member.token, status: 'pending' })
})

afterAll(async () => {
  await cleanupOrg(orgId, [orgTutorial, platformTutorial])
  await deleteTestUser(admin.id)
  await deleteTestUser(leader.id)
  await deleteTestUser(member.id)
})

describe('admin queue scoping', () => {
  it('excludes org-reviewed work from the default queue', async () => {
    const res = await app.request('/api/admin/tutorials?status=pending', authed(admin.token))
    const ids = ((await res.json()) as Array<{ id: string }>).map((t) => t.id)
    expect(ids).toContain(platformTutorial)
    expect(ids).not.toContain(orgTutorial)
  })

  it('?scope=all restores the full queue', async () => {
    const res = await app.request('/api/admin/tutorials?status=pending&scope=all', authed(admin.token))
    const ids = ((await res.json()) as Array<{ id: string }>).map((t) => t.id)
    expect(ids).toContain(orgTutorial)
  })

  it('approving an org makes it trusted in one action', async () => {
    const pending = await createOrg({ createdBy: leader.id, status: 'pending', trustLevel: 'probation' })
    const res = await app.request(`/api/admin/organizations/${pending}`, authed(admin.token, {
      method: 'PATCH', body: JSON.stringify({ status: 'approved' }),
    }))
    expect(res.status).toBe(200)
    const org = (await res.json()) as { status: string; trust_level: string }
    expect(org).toMatchObject({ status: 'approved', trust_level: 'trusted' })
    await cleanupOrg(pending)
  })

  it('refuses a contributor', async () => {
    const res = await app.request(`/api/admin/organizations/${orgId}`, authed(leader.token, {
      method: 'PATCH', body: JSON.stringify({ status: 'approved' }),
    }))
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 5: Run and verify**

```bash
pnpm --filter @splat-connect/api test:integration -- tests/integration/orgs/admin-queue.test.ts
```

Expected: 4 passed.

- [ ] **Step 6: Update the `admin.ts` header comment**

The block comment at `admin.ts:1-39` documents only two endpoints. Add the four new
ones and note the default queue scoping — a stale header on a security-relevant file
is worse than none.

- [ ] **Step 7: Commit, one file at a time**

```bash
git add packages/api/src/routes/admin.ts
git commit -m "feat(api): scope the admin queue to platform review and add org spot-check

The default queue was every pending tutorial, which would keep showing work a
leader is about to handle. It now defaults to the platform's own — no org, or
explicitly escalated — with ?scope=all restoring the firehose."

git add packages/api/tests/integration/orgs/admin-queue.test.ts
git commit -m "test(api): assert org-bound work is excluded from the admin queue"
```

---

## Task 7: Full-suite verification

- [ ] **Step 1: Reset and run everything**

```bash
supabase db reset && pnpm --filter @splat-connect/api test:integration
```

Expected: all suites pass.

- [ ] **Step 2: Unit tests, coverage, and typecheck**

```bash
pnpm --filter @splat-connect/api test:unit && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Refresh the knowledge graph and commit**

```bash
graphify update .
git add graphify-out && git commit -m "chore(graph): update after org API routes"
```

---

## Done when

- All `tests/integration/orgs/` suites pass.
- `PATCH /api/tutorials/:id` refuses `status: 'approved'` even from a leader whose RLS
  grant would permit the write — no publish can skip the audit trail.
- The admin queue no longer shows tutorials bound for an org's queue.
- `pnpm typecheck` passes.

**Next plan:** `docs/superpowers/plans/2026-07-28-org-review-web.md`.
