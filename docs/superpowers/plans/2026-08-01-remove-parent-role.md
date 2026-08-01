# Remove the `parent` account role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the account model to `admin` / `contributor` everywhere — DB, types, web, mobile — and merge mobile's role-branched Profile tab into one segmented screen, while also closing mobile's "asks for contributor terms twice" gap the same way web's was already closed.

**Architecture:** A new migration backfills existing `role='parent'` rows and tightens the check constraint; `handle_new_user()` already defaults every signup to `'contributor'` (a side effect of migration 010, verified below) so it needs no further change. `packages/types`' `Role` union narrows to two values, which fans out as compile errors through web and mobile — each is fixed in place. Mobile's `ProfileScreen` gains a segmented "Account" / "Child Profile" switcher in its existing signed-in branch instead of `app/(tabs)/profile/index.tsx` choosing between two entirely separate screens.

**Tech Stack:** Next.js/React (web), Expo/React Native (mobile), Hono (api), Postgres/Supabase, Vitest, Jest, Playwright.

## Global Constraints

- No new npm dependencies: mobile already has `expo-secure-store` wrapped by `lib/supabase-storage.ts`'s `resolveAuthStorage()` — reuse it for the segment-persistence read/write instead of adding `@react-native-async-storage/async-storage`.
- Every task that touches a file with an existing test suite must leave that suite green before moving on.
- `AGREEMENT_VERSIONS.contributor_terms` (from `@splat-connect/types`) is the single source for the terms version string — never hardcode `'v0-todo'` in new code.

---

## Important finding from investigation (context for every task below)

`supabase/migrations/010_signup_terms_acceptance.sql` (written earlier this session) replaced `handle_new_user()` and, as a side effect, **dropped the `role` column from its `insert into public.profiles`** — meaning it already relies on the column's `default 'contributor'` (set in migration 001) for every signup, web or mobile, regardless of what `raw_user_meta_data->>'role'` says. Migration 003's `case when ... = 'parent' then 'parent' else 'contributor' end` branch has been dead since migration 010 was applied (verified by reading the current function body — it has no `role` branch at all). So:

- New migration 011 only needs to **backfill existing rows** and **tighten the constraint** — `handle_new_user()` needs no change.
- Mobile's `role: 'parent'` in its `signUp()` metadata has already been a no-op since migration 010; removing it is a cleanup with zero behavioral risk.

## Task 1: Migration — backfill `parent` rows and tighten the role constraint

**Files:**
- Create: `supabase/migrations/011_remove_parent_role.sql`
- Modify: `supabase/seed.sql:38`
- Test: `packages/api/tests/integration/auth/role-removal.test.ts`

**Interfaces:**
- Produces: after this task, `profiles.role` only ever holds `'admin'` or `'contributor'`, enforced by the DB.

- [ ] **Step 1: Write the failing test**

Create `packages/api/tests/integration/auth/role-removal.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { adminClient } from '../../helpers/auth.js'

describe('the parent role has been removed', () => {
  it('rejects an insert with role=parent', async () => {
    const admin = adminClient()
    const email = `test-${crypto.randomUUID()}@splat-test.local`
    const { data, error: createError } = await admin.auth.admin.createUser({
      email,
      password: 'Test1234!',
      email_confirm: true,
    })
    expect(createError).toBeNull()
    const userId = data.user!.id

    const { error } = await admin.from('profiles').update({ role: 'parent' }).eq('id', userId)
    expect(error).not.toBeNull()
    expect(error?.message).toContain('profiles_role_check')

    await admin.auth.admin.deleteUser(userId)
  })

  it('has no remaining role=parent rows after the backfill', async () => {
    const admin = adminClient()
    const { data, error } = await admin.from('profiles').select('id').eq('role', 'parent')
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api && pnpm test:integration -- tests/integration/auth/role-removal.test.ts`
Expected: FAIL — the first test's update succeeds (constraint still allows `'parent'`), so `expect(error).not.toBeNull()` fails.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/011_remove_parent_role.sql`:

```sql
-- ============================================================
-- Remove the parent role
-- ============================================================
-- WHY: parent and contributor have been the same kind of account since
--      migration 009 widened is_approved_contributor() to any signed-in
--      account, and handle_new_user() has defaulted every signup to
--      'contributor' since migration 010 (it dropped the role column from
--      its insert entirely — see that migration's own header). The only
--      place role='parent' still meant anything was mobile's Profile tab,
--      which branched its UI on it; that branch is being removed alongside
--      this migration (packages/mobile/app/(tabs)/profile/index.tsx).
-- HOW: backfill first, so the constraint tightening below has nothing left
--      to reject; a check constraint always outlives whatever wrote the data
--      that once satisfied a wider version of it.
update public.profiles set role = 'contributor' where role = 'parent';

alter table public.profiles
  drop constraint profiles_role_check,
  add constraint profiles_role_check
    check (role in ('admin', 'contributor'));
```

- [ ] **Step 4: Apply the migration to the local Supabase instance**

Run: `supabase db reset`
Expected: all 11 migrations apply cleanly, seed data loads.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/api && pnpm test:integration -- tests/integration/auth/role-removal.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Update the seed data**

In `supabase/seed.sql:38`, change:

```sql
   '{"provider":"email","providers":["email"]}', '{"name":"Seed Parent","role":"parent"}', now(), now(),
```

to:

```sql
   '{"provider":"email","providers":["email"]}', '{"name":"Seed Contributor","role":"contributor"}', now(), now(),
```

(Rename `"Seed Parent"` too — `handle_new_user()` doesn't read this `role` key anymore per the finding above, but the literal value would be misleading left as `"parent"`, and "Seed Parent" as a display name no longer describes anything distinct.)

- [ ] **Step 7: Re-apply and re-run the full integration suite**

Run: `supabase db reset && cd packages/api && pnpm test:integration`
Expected: several pre-existing failures referencing `createTestUser('parent')` — these are fixed in Tasks 9-12. Confirm the two new tests from this task still pass and no *other* unrelated suite broke.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/011_remove_parent_role.sql supabase/seed.sql packages/api/tests/integration/auth/role-removal.test.ts
git commit -m "$(cat <<'EOF'
fix(db): backfill and drop the parent role

parent and contributor have been functionally identical since migration
009; handle_new_user() has defaulted every signup to contributor since
010. Backfill existing rows and tighten the check constraint so the DB
enforces what was already true in practice.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Narrow the `Role` type

**Files:**
- Modify: `packages/types/src/index.ts:1`

**Interfaces:**
- Produces: `Role = 'admin' | 'contributor'` — every consumer in web/mobile/api that used `'parent'` as a literal now fails `tsc --noEmit`, giving an exact checklist for the remaining tasks.

- [ ] **Step 1: Narrow the type**

In `packages/types/src/index.ts:1`, change:

```typescript
export type Role = 'admin' | 'contributor' | 'parent'
```

to:

```typescript
export type Role = 'admin' | 'contributor'
```

- [ ] **Step 2: Run typecheck to see the full fallout**

Run: `pnpm typecheck` (from repo root)
Expected: FAIL, with errors in `packages/web/lib/auth.ts`, `packages/web/tests/unit/components/nav.test.tsx`, `packages/api/tests/helpers/auth.ts`, `packages/api/tests/unit/routes/child-profile.test.ts`, `packages/mobile/lib/auth-context.tsx`, `packages/mobile/tests/unit/**`. Keep this output as your checklist — every file it names is fixed by name in a task below.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "$(cat <<'EOF'
fix(types): narrow Role to admin | contributor

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(This commit will not typecheck in isolation — that's expected and resolved by the remaining tasks. Do not run the full test suite as a gate on this one commit; move straight to Task 3.)

---

## Task 3: Web — `lib/auth.ts` role parsing

**Files:**
- Modify: `packages/web/lib/auth.ts:39`
- Modify: `packages/web/tests/unit/lib/auth.test.ts:80-88`

**Interfaces:**
- Consumes: `Role` from Task 2.

- [ ] **Step 1: Delete the now-impossible parity test**

In `packages/web/tests/unit/lib/auth.test.ts`, delete this test and its three-line comment block (lines 80-88):

```typescript
  // Tests: getUserRole returns 'parent' when the user's profile has role='parent'
  // How:   mockSingle returns { data: { role: 'parent' } }; checks result is 'parent'
  // Chain: parents and contributors are now the same kind of account → a signed-in parent
  //        must be recognised by the nav and page guards the same way a contributor is,
  //        instead of being narrowed away and rendered as signed-out
  it('returns parent for a parent user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: { role: 'parent' } })
    expect(await getUserRole()).toBe('parent')
  })

```

(Its parity claim is now enforced by the DB constraint from Task 1 — there's no second role left to prove parity with, and `'parent'` is no longer a valid `Role` literal to construct this test with at all.)

- [ ] **Step 2: Run the test file to verify it still passes (sanity check before the source change)**

Run: `cd packages/web && pnpm test:unit -- tests/unit/lib/auth.test.ts`
Expected: PASS (one fewer test than before)

- [ ] **Step 3: Narrow the role parser**

In `packages/web/lib/auth.ts:39`, change:

```typescript
    if (role === 'admin' || role === 'contributor' || role === 'parent') return role
```

to:

```typescript
    if (role === 'admin' || role === 'contributor') return role
```

- [ ] **Step 4: Run typecheck and the test file**

Run: `cd packages/web && pnpm typecheck && pnpm test:unit -- tests/unit/lib/auth.test.ts`
Expected: both PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/auth.ts packages/web/tests/unit/lib/auth.test.ts
git commit -m "$(cat <<'EOF'
fix(web): drop the parent branch from role parsing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Web — `nav.tsx` doc comment and its test

**Files:**
- Modify: `packages/web/components/nav.tsx:8`
- Modify: `packages/web/tests/unit/components/nav.test.tsx:83-90`

- [ ] **Step 1: Adapt the test fixture**

In `packages/web/tests/unit/components/nav.test.tsx`, change (lines 83-90):

```typescript
  // Tests: the public organisations directory is still reachable for any signed-in
  //        account (parent or contributor), not gated on a specific role
  // How:   renders <Nav role="parent" />; checks the Organisations link is present
  // Chain: every signed-in account may browse the org directory → gating it further
  //        would need a per-request lookup in the nav for no benefit
  it('keeps the public organisations directory for any signed-in account', () => {
    render(<Nav role="parent" />)
    expect(screen.getByRole('link', { name: 'Organisations' })).toBeInTheDocument()
  })
```

to:

```typescript
  // Tests: the public organisations directory is reachable for any signed-in
  //        account, not gated on a specific role
  // How:   renders <Nav role="contributor" />; checks the Organisations link is present
  // Chain: every signed-in account may browse the org directory → gating it further
  //        would need a per-request lookup in the nav for no benefit
  it('keeps the public organisations directory for any signed-in account', () => {
    render(<Nav role="contributor" />)
    expect(screen.getByRole('link', { name: 'Organisations' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Update the doc comment**

In `packages/web/components/nav.tsx:8`, change:

```typescript
 * - role: User role ('admin' | 'contributor' | 'parent' | null for logged-out)
```

to:

```typescript
 * - role: User role ('admin' | 'contributor' | null for logged-out)
```

- [ ] **Step 3: Run the test file**

Run: `cd packages/web && pnpm test:unit -- tests/unit/components/nav.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/web/components/nav.tsx packages/web/tests/unit/components/nav.test.tsx
git commit -m "$(cat <<'EOF'
docs(web): update nav.tsx's role comment for the removed parent role

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Web — `capabilities.ts` doc comment and its test

**Files:**
- Modify: `packages/web/lib/capabilities.ts:4-5`
- Modify: `packages/web/tests/unit/lib/capabilities.test.ts:66-76`

- [ ] **Step 1: Delete the now-impossible parity test**

In `packages/web/tests/unit/lib/capabilities.test.ts`, delete (lines 66-76):

```typescript
  // Tests: canAuthor is true for every signed-in account regardless of role
  // How:   profile has role 'parent'; checks canAuthor is true
  // Chain: migration 009 widened is_approved_contributor to every account, so authoring is
  //        no longer role-gated — canAuthor reflects that rather than checking role === 'contributor'
  it('reports canAuthor for every signed-in account', async () => {
    route({
      '/api/contributors/me': { ...PROFILE, role: 'parent' },
      '/api/organizations/mine': [],
    })
    expect((await subject())?.canAuthor).toBe(true)
  })

```

(`PROFILE`'s default `role: 'contributor'` already exercises `canAuthor` in the sibling tests in this file — this test only ever proved parity with a second role that no longer exists.)

- [ ] **Step 2: Update the doc comment**

In `packages/web/lib/capabilities.ts`, change (lines 4-5):

```typescript
 * Capability is derived from data the schema already holds rather than read from
 * profiles.role, which is why one account can be both a parent and a contributor:
```

to:

```typescript
 * Capability is derived from data the schema already holds rather than read from
 * profiles.role — every signed-in account is a contributor account:
```

- [ ] **Step 3: Run the test file and typecheck**

Run: `cd packages/web && pnpm test:unit -- tests/unit/lib/capabilities.test.ts && pnpm typecheck`
Expected: both PASS

- [ ] **Step 4: Commit**

```bash
git add packages/web/lib/capabilities.ts packages/web/tests/unit/lib/capabilities.test.ts
git commit -m "$(cat <<'EOF'
docs(web): update capabilities.ts's stale parent/contributor comment

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Web — `dashboard.test.tsx` parity test

**Files:**
- Modify: `packages/web/tests/unit/pages/dashboard.test.tsx:64-79`

- [ ] **Step 1: Delete the now-impossible parity test**

In `packages/web/tests/unit/pages/dashboard.test.tsx`, delete (lines 64-79):

```typescript
  // Tests: a non-contributor profile (parent) renders the dashboard instead of redirecting
  // How:   mocks apiClient.get to return a profile with role: 'parent'; asserts the
  //        page renders normally and redirect is never called
  // Chain: parent and contributor are the same kind of account now, so the dashboard
  //        is not contributor-only — there is nowhere left for a parent to bounce to
  it('renders the dashboard for a non-contributor profile', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ ...mockProfile, role: 'parent' })
      .mockResolvedValueOnce([])
    render(await DashboardPage())
    expect(redirect).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'My tutorials' })).toBeInTheDocument()
  })

```

(Every other test in this file already renders `DashboardPage()` with `mockProfile`'s default `role: 'contributor'` and asserts no redirect — this test only proved a second role behaves the same, which is no longer constructible.)

- [ ] **Step 2: Run the test file**

Run: `cd packages/web && pnpm test:unit -- tests/unit/pages/dashboard.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/unit/pages/dashboard.test.tsx
git commit -m "$(cat <<'EOF'
test(web): drop dashboard.test.tsx's parent-role parity test

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Web — remove the now-dead `eligibleLeaders` filter on the admin organizations page

**Files:**
- Modify: `packages/web/app/admin/organizations/page.tsx`
- Modify: `packages/web/tests/unit/pages/admin-organizations.test.tsx`

**Context:** Earlier this session, `eligibleLeaders = contributors.filter((c) => c.role === 'contributor')` was added specifically because `/api/admin/contributors` could return `role='parent'` rows, which the leader-assignment API rejects. `/api/admin/contributors` filters with `.neq('role', 'admin')`; with only `admin`/`contributor` left, that is now equivalent to `role === 'contributor'` for every row it returns — the filter is provably a no-op.

- [ ] **Step 1: Read the current picker code**

Run: `grep -n "eligibleLeaders\|contributors\." packages/web/app/admin/organizations/page.tsx`

Confirm both `<select>` leader pickers currently map over `eligibleLeaders`, and `nameFor()` still uses the unfiltered `contributors` for label lookups.

- [ ] **Step 2: Remove the filter and use `contributors` directly**

Replace every use of `eligibleLeaders` in the two `<select>` elements with `contributors`, and delete the `const eligibleLeaders = contributors.filter((c) => c.role === 'contributor')` line.

- [ ] **Step 3: Delete the test proving the now-removed filter**

In `packages/web/tests/unit/pages/admin-organizations.test.tsx`, delete the "excludes non-contributor accounts from both leader pickers" test (added earlier this session) and remove the `{ id: 'u2', name: 'Parent Pat', email: 'pat@example.com', role: 'parent', created_at: '' }` mock entry from the shared contributors fixture list if no other test in the file depends on it. If another test in the file counts total entries or asserts on `contributors.length`, update that count to match the removed entry.

- [ ] **Step 4: Run the test file and typecheck**

Run: `cd packages/web && pnpm test:unit -- tests/unit/pages/admin-organizations.test.tsx && pnpm typecheck`
Expected: both PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/admin/organizations/page.tsx packages/web/tests/unit/pages/admin-organizations.test.tsx
git commit -m "$(cat <<'EOF'
fix(web): drop the now-dead eligibleLeaders filter

Every account /api/admin/contributors returns is a contributor now that
parent no longer exists, so filtering on role === 'contributor' was a
no-op it took the DB constraint to prove.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Web e2e — remove `createParent()` and its two parity tests

**Files:**
- Modify: `packages/web/tests/e2e/helpers.ts`
- Modify: `packages/web/tests/e2e/auth/login.spec.ts`
- Modify: `packages/web/tests/e2e/dashboard/shell.spec.ts`

- [ ] **Step 1: Delete the "a parent-role account lands on the dashboard" test**

In `packages/web/tests/e2e/auth/login.spec.ts`, delete:

```typescript
test('a parent-role account lands on the dashboard', async ({ page }) => {
  const parent = await createParent()
  await acceptTerms(parent.id)
  await signIn(page, parent.email, parent.password)

  await page.waitForURL('**/dashboard')
  await expect(page.getByRole('heading', { name: 'My tutorials' })).toBeVisible()
})
```

Remove `createParent` from the `import { signIn, createContributor, createAdmin, createParent, acceptTerms } from '../helpers'` line at the top.

(The sibling "a contributor signs in and lands on the dashboard" test already proves this exact mechanism with a real, still-valid fixture.)

- [ ] **Step 2: Delete the "a mobile-registered parent signs in on web and uploads a tutorial" test**

In `packages/web/tests/e2e/dashboard/shell.spec.ts`, delete the entire test (starting `test('a mobile-registered parent signs in on web and uploads a tutorial', async ({ page }) => {` through its closing `})`), and remove `createParent` from that file's helpers import.

- [ ] **Step 3: Update the file's header comment**

In `packages/web/tests/e2e/dashboard/shell.spec.ts`, the file doc comment reads (around line 22):

```typescript
 * groups on the rail, a merged dashboard, and an account model where 'parent'
 * and 'contributor' are the same kind of thing underneath.
```

Change to:

```typescript
 * groups on the rail and a merged dashboard.
```

Also delete the comment at line ~224 (`// before this work: a role='parent' account, not merely a UI gate.`) along with the test it annotates, since that test was just deleted in Step 2.

- [ ] **Step 4: Delete `createParent()` from helpers.ts**

In `packages/web/tests/e2e/helpers.ts`, delete the `createParent` function (the `/** Provision a confirmed parent via the service role. */` block) now that nothing calls it.

- [ ] **Step 5: Run the affected e2e specs**

Run: `cd packages/web && npx playwright test tests/e2e/auth/login.spec.ts tests/e2e/dashboard/shell.spec.ts`
Expected: PASS

- [ ] **Step 6: Run typecheck**

Run: `cd packages/web && pnpm typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/web/tests/e2e/helpers.ts packages/web/tests/e2e/auth/login.spec.ts packages/web/tests/e2e/dashboard/shell.spec.ts
git commit -m "$(cat <<'EOF'
test(web e2e): drop the parent-role fixture and its parity tests

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: API — narrow `createTestUser`'s role parameter

**Files:**
- Modify: `packages/api/tests/helpers/auth.ts:18`

- [ ] **Step 1: Narrow the type**

In `packages/api/tests/helpers/auth.ts:18`, change:

```typescript
  role: 'contributor' | 'admin' | 'parent' = 'contributor'
```

to:

```typescript
  role: 'contributor' | 'admin' = 'contributor'
```

- [ ] **Step 2: Run typecheck to enumerate every remaining call site**

Run: `cd packages/api && pnpm typecheck`
Expected: FAIL, listing every `createTestUser('parent')` call site — these are fixed by name in Tasks 10-12.

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/helpers/auth.ts
git commit -m "$(cat <<'EOF'
fix(api): narrow createTestUser's role parameter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(This commit will not typecheck in isolation — resolved by Tasks 10-12.)

---

## Task 10: API — `admin-endpoints.test.ts`'s "not a contributor" fixture

**Files:**
- Modify: `packages/api/tests/integration/orgs/admin-endpoints.test.ts`

**Context:** `parent = await createTestUser('parent')` existed solely to prove `isContributor()` (in `packages/api/src/routes/admin.ts`) refuses a non-contributor leader appointment. With only `admin`/`contributor` left, the only account that can still demonstrate "not a contributor" is an admin — reuse the `admin` fixture already created in this file's `beforeAll`.

- [ ] **Step 1: Remove the `parent` fixture**

Delete `let parent: TestUser` (line 9), `parent = await createTestUser('parent')` (line 23), and `await deleteTestUser(parent.id)` (line 35).

- [ ] **Step 2: Repoint the test at the admin fixture**

Change:

```typescript
  it('refuses a leader who is not a contributor', async () => {
    const res = await app.request('/api/admin/organizations', authed(admin.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Parent Led', leader_user_id: parent.id }),
    }))
    expect(res.status).toBe(400)
  })
```

to:

```typescript
  it('refuses a leader who is not a contributor', async () => {
    const res = await app.request('/api/admin/organizations', authed(admin.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Admin Led', leader_user_id: admin.id }),
    }))
    expect(res.status).toBe(400)
  })
```

- [ ] **Step 3: Run the test file**

Run: `cd packages/api && pnpm test:integration -- tests/integration/orgs/admin-endpoints.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/api/tests/integration/orgs/admin-endpoints.test.ts
git commit -m "$(cat <<'EOF'
test(api): repoint the not-a-contributor leader test at an admin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: API — narrow `shared-capability.test.ts` to what it still proves

**Files:**
- Modify: `packages/api/tests/integration/auth/shared-capability.test.ts`

**Context:** This file's entire premise was "authoring is not tied to the contributor role," proven with a `role='parent'` fixture. That premise is now enforced by the DB constraint itself — there is no other role to compare against. Its two authoring-parity tests (insert a tutorial, link as contributor) are now exact duplicates of `role-assignment.test.ts`'s "a newly signed-up contributor can create a tutorial" tests, so they're deleted. The remaining tests (profile-identity freeze, storage-upload gating, admin-list inclusion) test properties unrelated to the role value itself — they're kept, with the fixture renamed and typed as a real role.

- [ ] **Step 1: Rename the fixture and its type**

Change `let parent: TestUser` to `let subject: TestUser`, and `parent = await createTestUser('parent')` to `subject = await createTestUser('contributor')`. Update every remaining reference to `parent` in this file to `subject` (the two authoring tests referencing it are deleted in Step 2, so this only touches the identity-freeze, storage, and admin-list describe blocks).

- [ ] **Step 2: Delete the two authoring-parity tests**

Delete the `describe('authoring is not tied to the contributor role', ...)` block in full (both `it('lets a parent-role account insert a tutorial', ...)` and `it('lets a parent-role account link itself as a contributor', ...)`), and its `afterAll` cleanup line `await admin.from('tutorials').delete().eq('title', 'Parent authored tutorial')`.

- [ ] **Step 3: Update the storage-upload test's wording**

Change:

```typescript
  it('lets a parent-role account upload to storage', async () => {
```

to:

```typescript
  it('lets a contributor upload to storage', async () => {
```

(the body is unchanged apart from `parent.token` → `subject.token`, already covered by Step 1's rename)

- [ ] **Step 4: Fix the "does not block a service-role write" test's restore step**

Change:

```typescript
  it('does not block a service-role write', async () => {
    const { error } = await adminClient()
      .from('profiles')
      .update({ role: 'contributor' })
      .eq('id', parent.id)

    expect(error).toBeNull()

    // Restore for the remaining tests in this file.
    await adminClient().from('profiles').update({ role: 'parent' }).eq('id', parent.id)
  })
```

to:

```typescript
  it('does not block a service-role write', async () => {
    const { error } = await adminClient()
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', subject.id)

    expect(error).toBeNull()

    // Restore for the remaining tests in this file.
    await adminClient().from('profiles').update({ role: 'contributor' }).eq('id', subject.id)
  })
```

(Proves the same thing — a service-role write bypasses `freeze_profile_identity` — using two real role values instead of one that's about to stop existing.)

- [ ] **Step 5: Update the "rejects a user setting their own role to admin" assertion**

Change:

```typescript
    const { data } = await adminClient()
      .from('profiles')
      .select('role')
      .eq('id', parent.id)
      .single()
    expect(data?.role).toBe('parent')
```

to:

```typescript
    const { data } = await adminClient()
      .from('profiles')
      .select('role')
      .eq('id', subject.id)
      .single()
    expect(data?.role).toBe('contributor')
```

- [ ] **Step 6: Update the "includes a parent-role account" test's name and wording**

Change:

```typescript
  // Chain: the filter used to mean "everyone who can author". After 009 it means
  //        "signed up on web", so a mobile parent who authors would vanish from
  //        the screen an admin uses to manage accounts.
  it('includes a parent-role account', async () => {
```

to:

```typescript
  // Chain: the filter means "every non-admin account" — any account that can
  //        author must still show up on the screen an admin uses to manage them.
  it('includes a contributor account', async () => {
```

- [ ] **Step 7: Run the full file and typecheck**

Run: `cd packages/api && pnpm test:integration -- tests/integration/auth/shared-capability.test.ts && pnpm typecheck`
Expected: both PASS

- [ ] **Step 8: Commit**

```bash
git add packages/api/tests/integration/auth/shared-capability.test.ts
git commit -m "$(cat <<'EOF'
test(api): narrow shared-capability.test.ts to what it still proves

Its role-parity claim is now enforced by the DB constraint itself.
Keeps the identity-freeze, storage-gating, and admin-list coverage
that were incidental to the parent fixture, not about it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: API — `child-profile/rls.test.ts` fixture swap

**Files:**
- Modify: `packages/api/tests/integration/child-profile/rls.test.ts`

**Context:** `parentA`/`parentB` here name "the guardian who owns this child profile" (matching `child_profiles.parent_id`), unrelated to `profiles.role`. Only the `createTestUser('parent')` calls need to change — variable names stay, since they correctly describe the `parent_id` relationship, not an account role.

- [ ] **Step 1: Swap the fixture role**

Change:

```typescript
  parentA = await createTestUser('parent')
  parentB = await createTestUser('parent')
```

to:

```typescript
  parentA = await createTestUser('contributor')
  parentB = await createTestUser('contributor')
```

- [ ] **Step 2: Update the stale doc comment**

Change:

```typescript
// Direct user-scoped client for the RLS-denial case that has no API route
// (the GET route always filters by the caller's own id, so cross-parent reads
// can only be attempted below the API).
```

Leave as-is — "cross-parent reads" here means "reads across two different `child_profiles.parent_id` owners," which remains accurate.

- [ ] **Step 3: Run the test file**

Run: `cd packages/api && pnpm test:integration -- tests/integration/child-profile/rls.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/api/tests/integration/child-profile/rls.test.ts
git commit -m "$(cat <<'EOF'
test(api): use contributor-role fixtures in child-profile rls.test.ts

parentA/parentB name the child_profiles.parent_id relationship, not a
profiles.role — only the createTestUser() role literal needed to change.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: API — `admin.test.ts` unit mock

**Files:**
- Modify: `packages/api/tests/unit/routes/admin.test.ts`

- [ ] **Step 1: Update the mock and assertion**

Change:

```typescript
  // Tests: GET /contributors returns { accounts, total } with every non-admin account,
  //        not only role='contributor'
  // How:   mockAdminFrom returns a select/neq/order/limit chain with a parent-role row and an
  //        exact count; checks status 200 and body shape
  // Chain: since 009 role records where an account signed up rather than what it may do, so a
  //        mobile-registered parent who authors must still show up on the admin's account list
  it('returns non-admin accounts for admin', async () => {
    mockAdminFrom.mockReturnValue({
      select: () => ({
        neq: () => ({ order: () => ({ limit: () => ({ data: [{ id: 'p-1', role: 'parent' }], count: 1, error: null }) }) }),
      }),
    })
    const res = await makeApp('admin').request('/contributors')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.accounts).toHaveLength(1)
    expect(body.accounts[0].role).toBe('parent')
    expect(body.total).toBe(1)
  })
```

to:

```typescript
  // Tests: GET /contributors returns { accounts, total } with every non-admin account
  // How:   mockAdminFrom returns a select/neq/order/limit chain with a contributor row and
  //        an exact count; checks status 200 and body shape
  // Chain: the endpoint excludes only admins, so every other account must show up on the
  //        screen an admin uses to manage accounts
  it('returns non-admin accounts for admin', async () => {
    mockAdminFrom.mockReturnValue({
      select: () => ({
        neq: () => ({ order: () => ({ limit: () => ({ data: [{ id: 'c-1', role: 'contributor' }], count: 1, error: null }) }) }),
      }),
    })
    const res = await makeApp('admin').request('/contributors')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.accounts).toHaveLength(1)
    expect(body.accounts[0].role).toBe('contributor')
    expect(body.total).toBe(1)
  })
```

- [ ] **Step 2: Run the test file**

Run: `cd packages/api && pnpm test:unit -- tests/unit/routes/admin.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/unit/routes/admin.test.ts
git commit -m "$(cat <<'EOF'
test(api): use a contributor mock row in admin.test.ts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: API — `child-profile.test.ts`'s default role

**Files:**
- Modify: `packages/api/tests/unit/routes/child-profile.test.ts:13`

- [ ] **Step 1: Change the default**

In `packages/api/tests/unit/routes/child-profile.test.ts:13`, change:

```typescript
function makeApp(role: Role = 'parent') {
```

to:

```typescript
function makeApp(role: Role = 'contributor') {
```

(child-profile routes are open to any signed-in account regardless of role — see this file's own `makeApp('contributor')` and `makeApp('admin')` call sites, which prove the route doesn't branch on the value. The default just needs to be *a* valid role.)

- [ ] **Step 2: Run the test file and typecheck**

Run: `cd packages/api && pnpm test:unit -- tests/unit/routes/child-profile.test.ts && pnpm typecheck`
Expected: both PASS. Typecheck should now be fully clean for `packages/api`.

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/unit/routes/child-profile.test.ts
git commit -m "$(cat <<'EOF'
test(api): default child-profile.test.ts's makeApp to contributor

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Mobile — signup metadata: drop `role`, add `contributor_terms_version`

**Files:**
- Modify: `packages/mobile/lib/auth-context.tsx:72-89`
- Modify: `packages/mobile/components/profile-screen.tsx` (remove the doomed post-signup acceptance call)
- Modify: `packages/mobile/tests/unit/lib/auth-context.test.tsx`
- Modify: `packages/mobile/tests/unit/components/profile-screen.test.tsx`

**Context:** Mobile has the exact bug web had before this session's earlier fix: `signUp()` sends no `contributor_terms_version`, and `ProfileScreen.handleSubmit()` calls `acceptContributorTerms()` right after signup — which fails every time under `enable_confirmations = true` (no session yet), by that call site's own comment. Fix it the same way web was fixed: carry the version through `signUp()`'s metadata, which `handle_new_user()` (migration 010) already records with no session required.

- [ ] **Step 1: Write the failing test for the new metadata shape**

In `packages/mobile/tests/unit/lib/auth-context.test.tsx`, change:

```typescript
  // Tests: signUp forwards name + parent role in user metadata
  it('signUp passes name + parent role in metadata', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { identities: [{ id: 'i1' }] } }, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const { error } = await act(() => result.current.signUp('p@b.com', 'pw', 'Pat'))

    expect(error).toBeNull()
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'p@b.com',
      password: 'pw',
      options: {
        data: { name: 'Pat', role: 'parent' },
        emailRedirectTo: `${process.env.EXPO_PUBLIC_WEB_URL}/auth/confirmed`,
      },
    })
  })
```

to:

```typescript
  // Tests: signUp forwards name + the accepted contributor terms version in user
  //        metadata, and no role — enable_confirmations leaves no session to
  //        POST /api/agreements with, so handle_new_user() records it instead.
  it('signUp passes name and contributor_terms_version in metadata', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { identities: [{ id: 'i1' }] } }, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const { error } = await act(() => result.current.signUp('p@b.com', 'pw', 'Pat'))

    expect(error).toBeNull()
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'p@b.com',
      password: 'pw',
      options: {
        data: { name: 'Pat', contributor_terms_version: AGREEMENT_VERSIONS.contributor_terms },
        emailRedirectTo: `${process.env.EXPO_PUBLIC_WEB_URL}/auth/confirmed`,
      },
    })
  })
```

Add `import { AGREEMENT_VERSIONS } from '@splat-connect/types'` to this test file's imports if not already present.

Also update the "loads profile (with role) session exists" test's mocked profile from `role: 'parent'` to `role: 'contributor'`, and its assertion from `expect(result.current.profile?.role).toBe('parent')` to `expect(result.current.profile?.role).toBe('contributor')`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/mobile && pnpm test -- tests/unit/lib/auth-context.test.tsx`
Expected: FAIL — `mockSignUp` was called with `{ data: { name: 'Pat', role: 'parent' }, ... }`, not the new expected shape.

- [ ] **Step 3: Update `signUp()`**

In `packages/mobile/lib/auth-context.tsx`, add the import:

```typescript
import { AGREEMENT_VERSIONS, type Profile, type UserAgreement } from '@splat-connect/types'
```

(replacing the existing `import type { Profile, UserAgreement } from '@splat-connect/types'`)

Change:

```typescript
  async function signUp(email: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: 'parent' },
        emailRedirectTo: `${process.env.EXPO_PUBLIC_WEB_URL}/auth/confirmed`,
      },
    })
```

to:

```typescript
  async function signUp(email: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, contributor_terms_version: AGREEMENT_VERSIONS.contributor_terms },
        emailRedirectTo: `${process.env.EXPO_PUBLIC_WEB_URL}/auth/confirmed`,
      },
    })
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/mobile && pnpm test -- tests/unit/lib/auth-context.test.tsx`
Expected: PASS

- [ ] **Step 5: Remove the doomed post-signup acceptance call**

In `packages/mobile/components/profile-screen.tsx`, change:

```typescript
      // Only records when signUp left a live session. Where email confirmation is
      // enabled there is none, and the profile-tab guard asks again after sign-in.
      await acceptContributorTerms()
      setMode('check-email')
```

to:

```typescript
      setMode('check-email')
```

(`signUp()` now carries the accepted version through metadata itself — see `lib/auth-context.tsx`.)

- [ ] **Step 6: Update `profile-screen.test.tsx`'s signup tests**

In `packages/mobile/tests/unit/components/profile-screen.test.tsx`, three tests currently pass `acceptContributorTerms` in their `useAuth` mock and rely on it being called or resolved during signup: "switches to the sign-up form and submits name/email/password as a parent" (line 51), "shows a check-your-email screen after a successful sign-up..." (line 100), "returns to the sign-in form from the check-your-email screen" (line 124), and "blocks signup until the terms box is ticked" (line 161, which explicitly asserts `expect(acceptContributorTerms).toHaveBeenCalled()`).

Remove the `expect(acceptContributorTerms).toHaveBeenCalled()` assertion from "blocks signup until the terms box is ticked" (line 190) — signup no longer calls it. The other three tests can keep `acceptContributorTerms: jest.fn().mockResolvedValue({ error: null })` in their mocks harmlessly (unused), or it can be dropped from their mock objects; drop it from all four for clarity, since none of them exercise it anymore.

Rename the test at line 51 from `'switches to the sign-up form and submits name/email/password as a parent'` to `'switches to the sign-up form and submits name/email/password'` — "as a parent" no longer means anything distinct.

- [ ] **Step 7: Run the full profile-screen test file**

Run: `cd packages/mobile && pnpm test -- tests/unit/components/profile-screen.test.tsx`
Expected: PASS

- [ ] **Step 8: Run mobile typecheck**

Run: `cd packages/mobile && pnpm typecheck`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/mobile/lib/auth-context.tsx packages/mobile/components/profile-screen.tsx packages/mobile/tests/unit/lib/auth-context.test.tsx packages/mobile/tests/unit/components/profile-screen.test.tsx
git commit -m "$(cat <<'EOF'
fix(mobile): record contributor_terms at signup instead of asking twice

Mirrors the same fix already applied to web this session: signUp()
carries the accepted version through user_metadata, which
handle_new_user() records with no session required, instead of an
awaited-but-doomed acceptContributorTerms() call right after signup.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Mobile — strip `ChildProfileHome` to embeddable content

**Files:**
- Modify: `packages/mobile/components/profile/child-profile-home.tsx`
- Modify: `packages/mobile/tests/unit/components/profile/child-profile-home.test.tsx`

**Context:** `ChildProfileHome` currently renders its own `Screen` + `ScreenHeader` + account-identity card + Sign Out button. Once it becomes one segment of `ProfileScreen`'s merged view (Task 17), that chrome duplicates what `ProfileScreen` already provides. Strip it down to just: the age field, save-status text, section title, and the three sub-screen tiles.

- [ ] **Step 1: Update the test to match the stripped-down output**

In `packages/mobile/tests/unit/components/profile/child-profile-home.test.tsx`, remove the account-identity assertions from "shows account info and links to three sub-screens" and rename it:

Change:

```typescript
  it('shows account info and links to three sub-screens', () => {
    render(<ChildProfileHome />)
    expect(screen.getByText('Pat')).toBeTruthy()
    expect(screen.getByText('p@b.com')).toBeTruthy()
    expect(screen.getByText('Ability Profile')).toBeTruthy()
    expect(screen.getByText('Everyday Needs')).toBeTruthy()
    expect(screen.getByText('Customization Metrics')).toBeTruthy()
    fireEvent.press(screen.getByText('Ability Profile'))
    expect(mockPush).toHaveBeenCalledWith('/profile/ability')
  })
```

to:

```typescript
  it('links to three sub-screens', () => {
    render(<ChildProfileHome />)
    expect(screen.getByText('Ability Profile')).toBeTruthy()
    expect(screen.getByText('Everyday Needs')).toBeTruthy()
    expect(screen.getByText('Customization Metrics')).toBeTruthy()
    fireEvent.press(screen.getByText('Ability Profile'))
    expect(mockPush).toHaveBeenCalledWith('/profile/ability')
  })
```

The `jest.mock('../../../../lib/auth-context', ...)` mock providing `profile: { name: 'Pat', email: 'p@b.com', role: 'parent' }` can be simplified — `ChildProfileHome` no longer reads `profile` at all after Step 2, so this mock (and its `signOut` field) can be deleted along with the `useAuth` import/mock entirely, since `useChildProfile` is the only hook it still calls.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/mobile && pnpm test -- tests/unit/components/profile/child-profile-home.test.tsx`
Expected: FAIL — the component still renders 'Pat'/'p@b.com', and removing the `useAuth` mock will throw since the component still calls it.

- [ ] **Step 3: Strip the component**

In `packages/mobile/components/profile/child-profile-home.tsx`, change:

```typescript
// packages/mobile/components/profile/child-profile-home.tsx
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/auth-context'
import { useChildProfile } from '../../lib/use-child-profile'
import { theme } from '../../lib/theme'
import { Card } from '../ui/Card'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { ScreenHeader } from '../ui/ScreenHeader'
```

to:

```typescript
// packages/mobile/components/profile/child-profile-home.tsx
//
// Embedded as the "Child Profile" segment of the merged Profile tab
// (components/profile-screen.tsx) — it owns none of the screen chrome
// (header, account identity, sign out) since that segment shares a screen
// with the "Account" segment, which already provides all of it.
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useChildProfile } from '../../lib/use-child-profile'
import { theme } from '../../lib/theme'
import { Card } from '../ui/Card'
import { TextField } from '../ui/TextField'
import { AnimatedPressable } from '../ui/AnimatedPressable'
```

Change:

```typescript
export function ChildProfileHome() {
  const router = useRouter()
  const { profile: account, signOut } = useAuth()
  const { profile, loading, save, saveState } = useChildProfile()

  function onChangeAge(v: string) {
    if (v.trim() !== '' && !Number.isNaN(Number(v))) save({ age: Number(v) })
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ScreenHeader title="Profile" showLogo />

        <Card style={styles.account}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(account?.name)}</Text>
          </View>
          <View style={styles.accountBody}>
            <Text style={styles.name} numberOfLines={1}>{account?.name}</Text>
            <Text style={styles.email} numberOfLines={1}>{account?.email}</Text>
          </View>
        </Card>

        <TextField
```

to:

```typescript
export function ChildProfileHome() {
  const router = useRouter()
  const { profile, loading, save, saveState } = useChildProfile()

  function onChangeAge(v: string) {
    if (v.trim() !== '' && !Number.isNaN(Number(v))) save({ age: Number(v) })
  }

  return (
    <View>
        <TextField
```

Change the closing of the component (removing the outer `Screen`/`ScrollView` and the Sign Out button):

```typescript
        <Button label="Sign Out" onPress={() => signOut()} variant="ghost" style={styles.signOut} />
      </ScrollView>
    </Screen>
  )
}
```

to:

```typescript
    </View>
  )
}
```

Delete the now-unused `initials()` helper function entirely, and delete the now-unused style keys from the `StyleSheet.create({...})` object: `content`, `account`, `avatar`, `avatarText`, `accountBody`, `name`, `email`, `signOut`. Keep `saveStatus`, `saveStatusDone`, `sectionTitle`, `tilePress`, `tile`, `tileIcon`, `tileBody`, `tileLabel`, `tileHint`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/mobile && pnpm test -- tests/unit/components/profile/child-profile-home.test.tsx`
Expected: PASS

- [ ] **Step 5: Run mobile typecheck**

Run: `cd packages/mobile && pnpm typecheck`
Expected: PASS (`profile/index.tsx` will still fail until Task 18 — that's expected)

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/components/profile/child-profile-home.tsx packages/mobile/tests/unit/components/profile/child-profile-home.test.tsx
git commit -m "$(cat <<'EOF'
refactor(mobile): strip ChildProfileHome to embeddable content

Drops its own screen chrome (header, account card, sign out) — it
becomes one segment of ProfileScreen's merged view in the next commit,
which already provides all of that.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Mobile — embed the segmented switcher in `ProfileScreen`

**Files:**
- Modify: `packages/mobile/components/profile-screen.tsx`
- Modify: `packages/mobile/tests/unit/components/profile-screen.test.tsx`

**Context:** This is the core of the merge. `ProfileScreen`'s signed-in branch (today: email, role label, dashboard link, sign out) gains a segmented "Account" / "Child Profile" switcher. The role label is dropped (per your call — nothing distinguishes roles on mobile today). The switcher's selection persists via `resolveAuthStorage()` (already used for the auth session — see `lib/supabase-storage.ts`), defaulting to Account on first-ever visit and remembering the last choice after that. The catch-up terms gate and sign-in/sign-up form above it are untouched — the switcher only replaces what was previously the plain signed-in account view.

- [ ] **Step 1: Write the failing tests**

In `packages/mobile/tests/unit/components/profile-screen.test.tsx`, replace the existing "shows role and a dashboard link for a contributor" test:

```typescript
  it('shows role and a dashboard link for a contributor', () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      session: { user: { email: 'contributor@example.com' } },
      profile: { id: '2', name: 'Cory', email: 'contributor@example.com', role: 'contributor', created_at: '' },
      signIn: jest.fn(),
      signOut: jest.fn(),
      hasContributorTerms: true,
    })
    render(<ProfileScreen />)
    expect(screen.getByText('Contributor')).toBeTruthy()
    expect(screen.getByText('Open Web Dashboard')).toBeTruthy()
  })
```

with:

```typescript
  it('shows the account segment by default, with no role label', () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      session: { user: { email: 'contributor@example.com' } },
      profile: { id: '2', name: 'Cory', email: 'contributor@example.com', role: 'contributor', created_at: '' },
      signIn: jest.fn(),
      signOut: jest.fn(),
      hasContributorTerms: true,
    })
    render(<ProfileScreen />)
    expect(screen.getByText('Open Web Dashboard')).toBeTruthy()
    expect(screen.queryByText('Contributor')).toBeNull()
  })

  it('switches to the child profile segment on tap', () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      session: { user: { email: 'contributor@example.com' } },
      profile: { id: '2', name: 'Cory', email: 'contributor@example.com', role: 'contributor', created_at: '' },
      signIn: jest.fn(),
      signOut: jest.fn(),
      hasContributorTerms: true,
    })
    render(<ProfileScreen />)
    expect(screen.getByText('Open Web Dashboard')).toBeTruthy()

    fireEvent.press(screen.getByText('Child Profile'))

    expect(screen.getByText('Ability Profile')).toBeTruthy()
    expect(screen.queryByText('Open Web Dashboard')).toBeNull()
  })

  it('reaches the child profile segment even when contributor terms are unaccepted', () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      session: { user: { email: 'contributor@example.com' } },
      profile: { id: '2', name: 'Cory', email: 'contributor@example.com', role: 'contributor', created_at: '' },
      signIn: jest.fn(),
      signOut: jest.fn(),
      hasContributorTerms: false,
      acceptContributorTerms: jest.fn(),
    })
    render(<ProfileScreen />)

    fireEvent.press(screen.getByText('Child Profile'))

    expect(screen.getByText('Ability Profile')).toBeTruthy()
    expect(screen.queryByText('Before you continue')).toBeNull()
  })
```

Add `import { ChildProfileHome } from '../../../components/profile/child-profile-home'` is not needed in the test file (it's rendered inside `ProfileScreen`, not mocked here — real render). Confirm `useChildProfile` is mocked somewhere accessible; if `profile-screen.test.tsx` has no existing mock for `lib/use-child-profile`, add one near the top of the file:

```typescript
jest.mock('../../../lib/use-child-profile', () => ({
  useChildProfile: () => ({ profile: null, loading: false, save: jest.fn(), saveState: 'idle' }),
}))
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/mobile && pnpm test -- tests/unit/components/profile-screen.test.tsx`
Expected: FAIL — no "Child Profile" text exists yet, `roleLabel`/`roleText` still render "Contributor".

- [ ] **Step 3: Add the switcher**

In `packages/mobile/components/profile-screen.tsx`, add imports:

```typescript
import { useState } from 'react'
import { ChildProfileHome } from './profile/child-profile-home'
import { resolveAuthStorage } from '../lib/supabase-storage'
```

Delete the now-unused `roleLabel()` helper function.

Add a small local segment-persistence helper near the top of the file (below the existing `openContributorTerms` function):

```typescript
const PROFILE_SEGMENT_KEY = 'profile-tab-segment'
type ProfileSegment = 'account' | 'child-profile'

function useProfileSegment() {
  const [segment, setSegment] = useState<ProfileSegment>('account')
  const storage = resolveAuthStorage()

  useEffect(() => {
    storage.getItem(PROFILE_SEGMENT_KEY).then((saved) => {
      if (saved === 'child-profile') setSegment('child-profile')
    })
  }, [])

  function select(next: ProfileSegment) {
    setSegment(next)
    storage.setItem(PROFILE_SEGMENT_KEY, next)
  }

  return { segment, select }
}
```

Add `useEffect` to the `react` import at the top: `import { useState, useEffect } from 'react'`.

Change the signed-in branch:

```typescript
  if (session) {
    return (
      <Screen>
        <ScreenHeader title="Profile" showLogo />
        <Card style={styles.panel}>
          <Text style={styles.signedInText}>Signed in as {session.user.email}</Text>
          {profile ? (
            <>
              <Text style={styles.roleText}>{roleLabel(profile.role)}</Text>
              <Button
                label="Open Web Dashboard"
                onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_WEB_URL}/dashboard`)}
                variant="secondary"
                style={styles.stackedButton}
              />
            </>
          ) : null}
          <Button label="Sign Out" onPress={() => signOut()} variant="ghost" />
        </Card>
      </Screen>
    )
  }
```

to:

```typescript
  if (session) {
    return (
      <Screen>
        <ScreenHeader title="Profile" showLogo />
        <View style={styles.segmented}>
          <Pressable
            onPress={() => selectSegment('account')}
            style={[styles.segment, segment === 'account' && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, segment === 'account' && styles.segmentTextActive]}>
              Account
            </Text>
          </Pressable>
          <Pressable
            onPress={() => selectSegment('child-profile')}
            style={[styles.segment, segment === 'child-profile' && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, segment === 'child-profile' && styles.segmentTextActive]}>
              Child Profile
            </Text>
          </Pressable>
        </View>
        {segment === 'child-profile' ? (
          <ChildProfileHome />
        ) : (
          <Card style={styles.panel}>
            <Text style={styles.signedInText}>Signed in as {session.user.email}</Text>
            {profile ? (
              <Button
                label="Open Web Dashboard"
                onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_WEB_URL}/dashboard`)}
                variant="secondary"
                style={styles.stackedButton}
              />
            ) : null}
            <Button label="Sign Out" onPress={() => signOut()} variant="ghost" />
          </Card>
        )}
      </Screen>
    )
  }
```

Add `const { segment, select: selectSegment } = useProfileSegment()` near the top of the `ProfileScreen` component body, alongside its other hook calls (`useAuth()`, `useState` calls).

Add `Pressable` and `View` to the `react-native` import if not already present (they are — `Pressable` and `View` are both already imported per the earlier full-file read).

Add these style entries to the `StyleSheet.create({...})` object at the bottom of the file (matching the visual language of existing entries like `styles.panel`):

```typescript
  segmented: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radii.md,
    padding: 3,
    marginBottom: theme.spacing(4),
  },
  segment: {
    flex: 1,
    paddingVertical: theme.spacing(2),
    alignItems: 'center',
    borderRadius: theme.radii.sm,
  },
  segmentActive: {
    backgroundColor: theme.colors.surface,
  },
  segmentText: {
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
  },
  segmentTextActive: {
    color: theme.colors.primary,
  },
```

Confirmed against `packages/mobile/lib/theme.ts`: `colors.surfaceSunken` (`#dcedf6`, the tinted track behind the pill), `colors.surface` (`#ffffff`, the active pill), and `radii.sm` / `radii.md` (`10` / `14`) all already exist — no new tokens needed.

Delete the now-unused `roleText` entry from `StyleSheet.create({...})` (it was only used by the deleted `roleLabel()` call).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/mobile && pnpm test -- tests/unit/components/profile-screen.test.tsx`
Expected: PASS (all tests, including the pre-existing ones for sign-in/sign-up/catch-up-gate, which are unaffected)

- [ ] **Step 5: Run mobile typecheck**

Run: `cd packages/mobile && pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/components/profile-screen.tsx packages/mobile/tests/unit/components/profile-screen.test.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): merge Account and Child Profile into one segmented tab

The role label is dropped — nothing distinguishes roles on mobile
today. Child Profile stays reachable even when contributor terms are
unaccepted, matching ChildProfileHome's historical behavior (it never
went through this gate) and web's own precedent (capabilities.ts keeps
child-profile access unconditional). Selection persists via the same
resolveAuthStorage() adapter already used for the auth session.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Mobile — simplify the Profile route to a direct re-export

**Files:**
- Modify: `packages/mobile/app/(tabs)/profile/index.tsx`
- Delete: `packages/mobile/tests/unit/app/profile-index.test.tsx`

**Interfaces:**
- Consumes: `ProfileScreen` from Task 17 (now handles every state — signed-out, catch-up gate, and the merged segmented view).

- [ ] **Step 1: Simplify the route file**

Replace the full contents of `packages/mobile/app/(tabs)/profile/index.tsx`:

```typescript
export { ProfileScreen as default } from '../../../components/profile-screen'
```

- [ ] **Step 2: Delete the now-redundant route test**

Delete `packages/mobile/tests/unit/app/profile-index.test.tsx` — it tested the `role === 'parent'` branch this route file no longer has. `profile-screen.test.tsx` (Task 17) is the coverage for every state this route can be in.

- [ ] **Step 3: Run mobile typecheck and the full mobile unit suite**

Run: `cd packages/mobile && pnpm typecheck && pnpm test`
Expected: both PASS, with one fewer test file than before.

- [ ] **Step 4: Commit**

```bash
git add packages/mobile/app/'(tabs)'/profile/index.tsx
git rm packages/mobile/tests/unit/app/profile-index.test.tsx
git commit -m "$(cat <<'EOF'
refactor(mobile): re-export ProfileScreen directly from the route file

app/(tabs)/profile/index.tsx had no logic left once ProfileScreen
started handling every state (signed-out, catch-up gate, merged
segmented view) itself.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: Mobile e2e — remove the parent-role fixture and fix every downstream spec

**Files:**
- Modify: `packages/mobile/tests/e2e/helpers.ts`
- Modify: `packages/mobile/tests/e2e/auth.spec.ts`
- Modify: `packages/mobile/tests/e2e/navigation.spec.ts`
- Modify: `packages/mobile/tests/e2e/child-profile-home.spec.ts`
- Modify: `packages/mobile/tests/e2e/customization.spec.ts`
- Modify: `packages/mobile/tests/e2e/everyday-needs.spec.ts`
- Modify: `packages/mobile/tests/e2e/ability-profile.spec.ts`
- Delete: `packages/mobile/tests/e2e/parent-signup.spec.ts` → replaced by a new test inside `auth.spec.ts` (Step 4)

**Context:** `signUpParent()` (the UI-driven signup helper) is used by 15+ tests across 6 spec files, every one of which currently relies on it landing directly on `ChildProfileHome` content when it returns. Fixing the helper itself once — so it explicitly selects the Child Profile segment as its last step before returning — means every one of those 15+ tests keeps working unchanged. Only the tests whose entire premise *was* the role branch (2 in `auth.spec.ts`, 1 in `child-profile-home.spec.ts`, 1 in `navigation.spec.ts`) need real rewrites. `createParent()` (the direct-provisioning variant) has zero call sites in any spec file — delete it as dead code.

- [ ] **Step 1: Rename and fix the signup helper**

In `packages/mobile/tests/e2e/helpers.ts`:

Delete `uniqueParentEmail()` (lines 15-18) and replace it with:

```typescript
/** Unique signup email per invocation so runs don't collide (CI does `supabase db reset`). */
export function uniqueSignupEmail() {
  return uniqueEmail('signup')
}
```

Delete `createParent()` in full (lines 61-79) — it has no remaining call sites.

Replace `signUpParent()` (lines 137-168):

```typescript
/**
 * Sign up a fresh parent through the Profile-tab UI. Local Supabase requires
 * email confirmation (supabase/config.toml enable_confirmations=true), so
 * signUp leaves no session — confirm out of band via the admin API, the same
 * as a real confirmation-link click would, then sign in through the UI.
 */
export async function signUpParent(page: Page, email: string) {
  await page.goto('/profile')
  await page.getByText('Create an account').click()
  await page.getByPlaceholder('Name').fill('E2E Parent')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password', { exact: true }).fill(PASSWORD)
  await page.getByPlaceholder('Confirm Password').fill(PASSWORD)
  await page.getByTestId('accept-contributor-terms').click()

  const [signupResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/auth/v1/signup') && res.request().method() === 'POST'
    ),
    page.getByText('Sign Up').click(),
  ])
  const body = await signupResponse.json()
  const userId = body.user?.id ?? body.id
  await adminClient().auth.admin.updateUserById(userId, { email_confirm: true })

  await page.getByText('Back to sign in').click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(PASSWORD)
  await page.getByText('Sign In', { exact: true }).click()
  // Role resolves via GET /api/contributors/me → parent → child-profile home.
  await expect(page.getByText('Customization Metrics')).toBeVisible()
}
```

with:

```typescript
/**
 * Sign up a fresh account through the Profile-tab UI. Local Supabase requires
 * email confirmation (supabase/config.toml enable_confirmations=true), so
 * signUp leaves no session — confirm out of band via the admin API, the same
 * as a real confirmation-link click would, then sign in through the UI.
 *
 * Leaves the Child Profile segment selected before returning: every caller
 * of this helper wants to land on child-profile content, so selecting it
 * here once means none of them have to.
 */
export async function signUpNewAccount(page: Page, email: string) {
  await page.goto('/profile')
  await page.getByText('Create an account').click()
  await page.getByPlaceholder('Name').fill('E2E Contributor')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password', { exact: true }).fill(PASSWORD)
  await page.getByPlaceholder('Confirm Password').fill(PASSWORD)
  await page.getByTestId('accept-contributor-terms').click()

  const [signupResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/auth/v1/signup') && res.request().method() === 'POST'
    ),
    page.getByText('Sign Up').click(),
  ])
  const body = await signupResponse.json()
  const userId = body.user?.id ?? body.id
  await adminClient().auth.admin.updateUserById(userId, { email_confirm: true })

  await page.getByText('Back to sign in').click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(PASSWORD)
  await page.getByText('Sign In', { exact: true }).click()
  // Account is the default segment on first visit.
  await page.getByText('Child Profile').click()
  await expect(page.getByText('Customization Metrics')).toBeVisible()
}
```

- [ ] **Step 2: Mechanical rename in the three sub-screen spec files**

In `packages/mobile/tests/e2e/customization.spec.ts`, `packages/mobile/tests/e2e/everyday-needs.spec.ts`, and `packages/mobile/tests/e2e/ability-profile.spec.ts`: replace every `signUpParent` with `signUpNewAccount` and every `uniqueParentEmail` with `uniqueSignupEmail`, in both the `import` line and each call site. No other changes — these files only use the helper to reach a sub-screen via `openSubScreen()`, which is unaffected by the Profile-tab merge.

- [ ] **Step 3: Fix `child-profile-home.spec.ts`**

Change:

```typescript
import { test, expect } from '@playwright/test'
import { signUpParent, uniqueParentEmail } from './helpers'

test('the age field autosaves and survives a reload', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())
  await page.getByPlaceholder('Age').fill('6')
  await page.waitForTimeout(1000) // debounced autosave → PUT
  await page.reload()
  await expect(page.getByPlaceholder('Age')).toHaveValue('6')
})

test('signing out returns to the login form', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())
  await page.getByText('Sign Out').click()
  await expect(page.getByText('Welcome Back')).toBeVisible()
  await expect(page.getByText('Create an account')).toBeVisible()
})
```

to:

```typescript
import { test, expect } from '@playwright/test'
import { signUpNewAccount, uniqueSignupEmail } from './helpers'

test('the age field autosaves and survives a reload', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await page.getByPlaceholder('Age').fill('6')
  await page.waitForTimeout(1000) // debounced autosave → PUT
  await page.reload()
  // The selected segment persists across the reload (resolveAuthStorage()),
  // so the age field is still the one visible after it.
  await expect(page.getByPlaceholder('Age')).toHaveValue('6')
})

test('signing out returns to the login form', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  // Sign Out lives on the Account segment now, not Child Profile.
  await page.getByText('Account').click()
  await page.getByText('Sign Out').click()
  await expect(page.getByText('Welcome Back')).toBeVisible()
  await expect(page.getByText('Create an account')).toBeVisible()
})
```

- [ ] **Step 4: Fix `navigation.spec.ts`**

Change:

```typescript
test('a signed-in parent reaches the child-profile home', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())

  await page.goto('/profile')

  await expect(page.getByText('Customization Metrics')).toBeVisible()
  await expect(page.getByText('Ability Profile')).toBeVisible()
})
```

to:

```typescript
test('the selected profile segment persists across a re-visit', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  // signUpNewAccount leaves Child Profile selected — re-navigating to the
  // tab should not silently reset it back to Account.

  await page.goto('/profile')

  await expect(page.getByText('Customization Metrics')).toBeVisible()
  await expect(page.getByText('Ability Profile')).toBeVisible()
})
```

Update the file's `import` line the same way as Step 2 (`signUpParent` → `signUpNewAccount`, `uniqueParentEmail` → `uniqueSignupEmail`).

- [ ] **Step 5: Fix `auth.spec.ts`**

Change the import line:

```typescript
import { createContributor, signIn, signUpParent, uniqueParentEmail } from './helpers'
```

to:

```typescript
import { createContributor, signIn, signUpNewAccount, uniqueSignupEmail } from './helpers'
```

Change the first test — the assertion is still correct (Child Profile is not the default segment), only its framing needs to drop the role-branch language:

```typescript
test('a contributor signs in to the account view, not the child profile', async ({ page }) => {
  const { email, password } = await createContributor()
  await signIn(page, email, password)

  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible()
  // The role-branch must NOT show the parent child-profile home.
  await expect(page.getByText('Customization Metrics')).toHaveCount(0)
})
```

to:

```typescript
test('a contributor signs in to the account segment by default', async ({ page }) => {
  const { email, password } = await createContributor()
  await signIn(page, email, password)

  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible()
  // Account is the default segment; Child Profile only renders once selected.
  await expect(page.getByText('Customization Metrics')).toHaveCount(0)
})
```

Change the inline `uniqueParentEmail()` call in the mismatched-passwords test to `uniqueSignupEmail()`.

Delete the final test in the file in full — it's superseded by the replacement below:

```typescript
test('a parent sees the child-profile entry points rather than the account view', async ({ page }) => {
  const email = uniqueParentEmail()
  await signUpParent(page, email)

  await expect(page.getByText('Customization Metrics')).toBeVisible()
  await expect(page.getByText('Ability Profile')).toBeVisible()
  await expect(page.getByText('Open Web Dashboard')).toHaveCount(0)
})
```

Replace it with a test proving the full segmented switcher, covering what `parent-signup.spec.ts` used to cover plus the switch itself. This is the one caller in the suite that needs the *true* first-visit default rather than `signUpNewAccount`'s post-selected Child Profile state, so it inlines the signup flow itself instead of calling that helper:

```typescript
test('a new signup lands on Account by default and can switch to Child Profile', async ({ page }) => {
  const email = uniqueSignupEmail()
  await page.goto('/profile')
  await page.getByText('Create an account').click()
  await page.getByPlaceholder('Name').fill('E2E Contributor')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password', { exact: true }).fill('Test1234!')
  await page.getByPlaceholder('Confirm Password').fill('Test1234!')
  await page.getByTestId('accept-contributor-terms').click()

  const [signupResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/auth/v1/signup') && res.request().method() === 'POST'
    ),
    page.getByText('Sign Up').click(),
  ])
  const body = await signupResponse.json()
  await adminClient().auth.admin.updateUserById(body.user?.id ?? body.id, { email_confirm: true })

  await page.getByText('Back to sign in').click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill('Test1234!')
  await page.getByText('Sign In', { exact: true }).click()

  // Account is the true first-visit default — this is the one caller in the
  // suite that signs up without using signUpNewAccount's own final Child
  // Profile selection, specifically to observe it.
  await expect(page.getByText('Open Web Dashboard')).toBeVisible()
  await expect(page.getByText('Customization Metrics')).toHaveCount(0)

  await page.getByText('Child Profile').click()

  await expect(page.getByText('Ability Profile')).toBeVisible()
  await expect(page.getByText('Everyday Needs')).toBeVisible()
  await expect(page.getByText('Customization Metrics')).toBeVisible()
  await expect(page.getByText('Open Web Dashboard')).toHaveCount(0)
})
```

This needs `adminClient` importable from the spec file — add `import { createContributor, signIn, signUpNewAccount, uniqueSignupEmail, adminClient } from './helpers'` and export `adminClient` from `helpers.ts` (currently module-private — change `function adminClient()` to `export function adminClient()` at its definition).

- [ ] **Step 6: Delete `parent-signup.spec.ts`**

Its one test is now fully superseded by `auth.spec.ts`'s new test from Step 5.

- [ ] **Step 7: Run every touched spec file**

Run: `cd packages/mobile && npx playwright test tests/e2e/auth.spec.ts tests/e2e/navigation.spec.ts tests/e2e/child-profile-home.spec.ts tests/e2e/customization.spec.ts tests/e2e/everyday-needs.spec.ts tests/e2e/ability-profile.spec.ts`
Expected: PASS

- [ ] **Step 8: Run the full mobile e2e suite for regressions**

Run: `cd packages/mobile && npx playwright test`
Expected: PASS. Run `grep -rln "parent" packages/mobile/tests/e2e/` afterward — it should return nothing except references to `child_profiles.parent_id`-style naming, if any remain.

- [ ] **Step 9: Commit**

```bash
git add packages/mobile/tests/e2e/helpers.ts packages/mobile/tests/e2e/auth.spec.ts packages/mobile/tests/e2e/navigation.spec.ts packages/mobile/tests/e2e/child-profile-home.spec.ts packages/mobile/tests/e2e/customization.spec.ts packages/mobile/tests/e2e/everyday-needs.spec.ts packages/mobile/tests/e2e/ability-profile.spec.ts
git rm packages/mobile/tests/e2e/parent-signup.spec.ts
git commit -m "$(cat <<'EOF'
test(mobile e2e): fix every spec depending on the parent-role fixture

signUpParent() (renamed signUpNewAccount()) now selects the Child
Profile segment as its last step instead of landing there automatically
by role, which is what its 15+ callers across 6 spec files actually
need. The tests whose whole premise was the role branch itself are
rewritten to prove the segmented switcher instead.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: Final full-repo verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck` (repo root)
Expected: PASS across all four packages.

- [ ] **Step 2: Full unit test suites**

Run: `cd packages/api && pnpm test:unit && pnpm test:integration`
Run: `cd packages/web && pnpm test:unit`
Run: `cd packages/mobile && pnpm test`
Expected: all PASS.

- [ ] **Step 3: Full e2e suites**

Run: `cd packages/web && npx playwright test`
Run: `cd packages/mobile && npx playwright test`
Expected: all PASS. If the web run shows the "Database error checking email" infra flake noted earlier this session under full parallel load, re-run just the failed spec files individually to confirm it's flake, not regression, before treating anything as a real failure.

- [ ] **Step 4: Confirm no remaining references**

Run: `grep -rn "'parent'\|\"parent\"" --include="*.ts" --include="*.tsx" --include="*.sql" . | grep -v node_modules | grep -v .superpowers`
Expected: zero matches, or only matches where "parent" refers to `child_profiles.parent_id` / DOM parent-child relationships unrelated to `profiles.role` (e.g. `parentA`/`parentB` variable names from Task 12, any `parent.tsx`-unrelated UI hierarchy comments). Read each match to confirm.

- [ ] **Step 5: Report**

No commit for this task — it's a verification checkpoint. Summarize the final state to the user: what was removed, what tests were added/removed/adapted, and the outcome of each verification step above.
