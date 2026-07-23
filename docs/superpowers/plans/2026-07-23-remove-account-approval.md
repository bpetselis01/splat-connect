# Remove Account-Approval Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `profiles.approved` account-approval gate so any signed-up contributor can act immediately, while leaving tutorial content moderation (`tutorials.status`) untouched.

**Architecture:** Redefine the DB function `is_approved_contributor()` to drop the `approved = true` check (keeping its name so ~13 dependent RLS policies need no changes). Remove the one API-level 403 check. Remove the web pending-page/redirect/approve-UI. Repurpose the existing admin delete-contributor endpoint as a general moderation tool instead of a "reject signup" step. The `approved` column and `AuthVariables.approved` field stay in place, unused — no data migration needed.

**Tech Stack:** Postgres/Supabase (RLS + SQL functions), Hono API (Node.js), Next.js 16 web app, Vitest (unit + integration), Playwright (e2e).

## Global Constraints

- Tutorial content moderation (`tutorials.status`, `tutorial_is_approved()`, the admin tutorial-review UI) must NOT be touched.
- Do not rename or change the signature of `is_approved_contributor()` — only its SQL body changes, so the ~13 RLS policies calling it need no edits.
- Do not backfill or change any existing `profiles.approved` row values.
- `DELETE /api/admin/contributors/:id` stays exactly as implemented today — it is being re-labeled/re-tested as a general delete tool, not re-implemented.
- Mobile package (`packages/mobile`) requires zero changes — confirmed unaffected.
- Use `pnpm --filter @splat-connect/api <script>` and `pnpm --filter @splat-connect/web <script>` to run scripts (this is a pnpm workspace).
- Integration tests (`test:integration`) and e2e tests (`test:e2e`) require a local Supabase stack: `supabase start` (or `supabase db reset` to re-apply migrations+seed on an already-running stack).

---

### Task 1: Database — remove the approval check from `is_approved_contributor()`

**Files:**
- Create: `supabase/migrations/005_remove_account_approval.sql`
- Modify: `packages/api/tests/helpers/auth.ts`
- Modify: `packages/api/tests/integration/auth/role-assignment.test.ts`

**Interfaces:**
- Produces: `createTestUser(role: 'contributor' | 'admin' | 'parent' = 'contributor'): Promise<TestUser>` — the `approved` parameter is removed; later tasks' tests only ever call this with a role argument.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/005_remove_account_approval.sql`:

```sql
-- WHY: Contributors previously needed admin approval (profiles.approved) before
--      they could create tutorials or upload files. That gate is removed —
--      any signed-up contributor can act immediately. Tutorial content
--      moderation (tutorials.status, tutorial_is_approved()) is unaffected.
-- HOW: is_approved_contributor() keeps its name/signature so the ~13 RLS
--      policies referencing it (tutorial insert, tutorial_contributors insert,
--      storage upload/update policies) inherit the new behavior with no
--      changes. The `approved` column is left in place, unused.
create or replace function public.is_approved_contributor()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'contributor'
  );
$$ language sql security definer stable;
```

- [ ] **Step 2: Apply the migration locally**

Run: `supabase db reset`
Expected: Migrations `001` through `005` and `seed.sql` all apply without error.

- [ ] **Step 3: Simplify the `createTestUser` helper**

In `packages/api/tests/helpers/auth.ts`, replace the `createTestUser` function (currently lines 17-52) with:

```typescript
export async function createTestUser(
  role: 'contributor' | 'admin' | 'parent' = 'contributor'
): Promise<TestUser> {
  const admin = adminClient()
  const email = `test-${crypto.randomUUID()}@splat-test.local`
  const password = 'Test1234!'

  const { data: signUpData, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (signUpError || !signUpData.user)
    throw new Error(`Failed to create test user: ${signUpError?.message}`)

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: signUpData.user.id, role })
  if (profileError)
    throw new Error(`Failed to set test user profile: ${profileError.message}`)

  const anonClient = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY ?? '')
  const { data: sessionData, error: sessionError } = await anonClient.auth.signInWithPassword({
    email,
    password,
  })
  if (sessionError || !sessionData.session)
    throw new Error(`Failed to sign in test user: ${sessionError?.message}`)

  return { id: signUpData.user.id, email, token: sessionData.session.access_token }
}
```

This drops the `approved` parameter and the upsert's `approved` field — every other caller in the test suite already calls `createTestUser(role)` with no second argument, so this is a pure simplification.

- [ ] **Step 4: Rewrite `role-assignment.test.ts` to assert the gate is gone**

Replace the full contents of `packages/api/tests/integration/auth/role-assignment.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

let contributor: TestUser
let adminUser: TestUser

beforeAll(async () => {
  contributor = await createTestUser('contributor')
  adminUser = await createTestUser('admin')
})

afterAll(async () => {
  await deleteTestUser(contributor.id)
  await deleteTestUser(adminUser.id)
})

describe('role assignment', () => {
  it('contributor profile has role=contributor', async () => {
    const res = await app.request('/api/contributors/me', {
      headers: { Authorization: `Bearer ${contributor.token}` },
    })
    expect(res.status).toBe(200)
    const profile = (await res.json()) as { role: string }
    expect(profile.role).toBe('contributor')
  })

  it('admin profile has role=admin', async () => {
    const res = await app.request('/api/contributors/me', {
      headers: { Authorization: `Bearer ${adminUser.token}` },
    })
    expect(res.status).toBe(200)
    const profile = (await res.json()) as { role: string }
    expect(profile.role).toBe('admin')
  })

  it('a newly signed-up contributor can create a tutorial through the API immediately', async () => {
    const res = await app.request('/api/tutorials', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${contributor.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: crypto.randomUUID(), title: 'Allowed', difficulty: 'easy' }),
    })
    expect(res.status).toBe(201)
  })

  it('a newly signed-up contributor is not blocked by RLS inserting a tutorial directly', async () => {
    const supabase = createUserClient(contributor.token)
    const { error } = await supabase
      .from('tutorials')
      .insert({ id: crypto.randomUUID(), title: 'RLS allowed', difficulty: 'easy' })
    expect(error).toBeNull()
  })
})
```

- [ ] **Step 5: Run the integration test**

Run: `pnpm --filter @splat-connect/api test:integration -- role-assignment`
Expected: All 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/005_remove_account_approval.sql packages/api/tests/helpers/auth.ts packages/api/tests/integration/auth/role-assignment.test.ts
git commit -m "feat(db): remove approval requirement from is_approved_contributor()"
```

---

### Task 2: API — remove the app-level 403 check in tutorial creation

**Files:**
- Modify: `packages/api/src/routes/tutorials.ts:91-96`
- Modify: `packages/api/tests/unit/routes/tutorials.test.ts`

**Interfaces:**
- Consumes: `is_approved_contributor()` from Task 1 (RLS now allows the insert this route performs via `createAdminClient()`, which bypasses RLS anyway — this task only removes the app-level check that duplicated the old gate).
- Produces: `makeApp(role: 'contributor' | 'admin' = 'contributor')` in the test file — the `approved` parameter is removed; no other test in this file passes a second argument.

- [ ] **Step 1: Remove the 403 check in `tutorials.ts`**

In `packages/api/src/routes/tutorials.ts`, replace lines 91-96:

```typescript
tutorials.post('/', async (c) => {
  // WHY: Any logged-in user could create tutorials before an admin had approved
  //      their account.
  if (!c.get('approved')) {
    return c.json({ error: 'Your account is not yet approved to create tutorials' }, 403)
  }
  const body = await c.req.json()
  // Auth/approval already verified above -- use admin client to bypass RLS JWT context issues
  const supabase = createAdminClient()
```

with:

```typescript
tutorials.post('/', async (c) => {
  const body = await c.req.json()
  // WHY: Uses the admin client (bypasses RLS) because RLS policies rely on
  //      auth.uid() from a JWT context that inserts through this route don't have.
  const supabase = createAdminClient()
```

Also update the file's header doc comment — replace line 24 (`*   - Validates: user must have approved=true`) with `*   - Auto-generates status='draft'` is already on the next line, so simply delete line 24 entirely.

- [ ] **Step 2: Remove the `approved` parameter from the test's `makeApp` helper**

In `packages/api/tests/unit/routes/tutorials.test.ts`, replace:

```typescript
function makeApp(role: 'contributor' | 'admin' = 'contributor', approved = true) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', role)
    c.set('approved', approved)
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', tutorials)
  return app
}
```

with:

```typescript
function makeApp(role: 'contributor' | 'admin' = 'contributor') {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', role)
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', tutorials)
  return app
}
```

- [ ] **Step 3: Remove the now-obsolete 403 test**

In the same file, delete this whole `it` block from the `describe('POST /')` section:

```typescript
  // Tests: POST / returns 403 when the contributor is not yet approved by an admin
  // How:   makeApp('contributor', false) sets approved=false in context; checks status 403 with no DB call
  // Chain: unapproved contributors cannot create tutorials → admins control who can submit
  //        content, preventing untrusted users from cluttering the pending review queue
  it('returns 403 when user is not approved', async () => {
    const res = await makeApp('contributor', false).request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'new-id', title: 'New Tutorial', difficulty: 'easy' }),
    })
    expect(res.status).toBe(403)
  })

```

- [ ] **Step 4: Run the unit test**

Run: `pnpm --filter @splat-connect/api test:unit -- tutorials`
Expected: All remaining tests in `tutorials.test.ts` pass (the 403 test is gone, not failing).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/tutorials.ts packages/api/tests/unit/routes/tutorials.test.ts
git commit -m "feat(api): remove account-approval check from tutorial creation"
```

---

### Task 3: API — remove the admin approve endpoint, clean up stale comments

**Files:**
- Modify: `packages/api/src/routes/admin.ts:94-104`
- Modify: `packages/api/src/routes/contributors.ts:24-30`
- Modify: `packages/api/src/routes/upload.ts:10,24`
- Modify: `packages/api/tests/unit/routes/admin.test.ts`

**Interfaces:**
- Produces: `admin.ts` no longer exports a `PATCH /contributors/:id/approve` route. `GET /contributors` and `DELETE /contributors/:id` are unchanged behaviorally.

- [ ] **Step 1: Remove the approve endpoint**

In `packages/api/src/routes/admin.ts`, delete this block (lines 94-104):

```typescript
admin.patch('/contributors/:id/approve', async (c) => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({ approved: true })
    .eq('id', c.req.param('id'))
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

```

- [ ] **Step 2: Update the stale doc comment in `contributors.ts`**

In `packages/api/src/routes/contributors.ts`, replace lines 24-30:

```typescript
 * Approval workflow:
 * 1. New user signs up
 * 2. Their profile is created with approved=false
 * 3. They see /pending page ("Awaiting approval")
 * 4. Admin approves them (updates approved=true)
 * 5. User redirected to /dashboard
 * 6. User can now create tutorials
```

with:

```typescript
 * Onboarding:
 * 1. New user signs up
 * 2. Their profile is created with role='contributor'
 * 3. They can log in and create tutorials immediately
```

Also update line 33-34's related-files note (`* - app/pending: Page shown while awaiting approval`) — delete that line entirely since `app/pending` is removed in Task 5.

- [ ] **Step 3: Update the stale doc comment in `upload.ts`**

In `packages/api/src/routes/upload.ts`, replace line 10:

```typescript
 * - Auth: Requires JWT with approved=true
```

with:

```typescript
 * - Auth: Requires a valid JWT
```

And replace line 24:

```typescript
 * - Validates JWT + user approval before accepting file
```

with:

```typescript
 * - Validates JWT before accepting file
```

- [ ] **Step 4: Remove the obsolete approve test**

In `packages/api/tests/unit/routes/admin.test.ts`, delete the entire `describe('PATCH /contributors/:id/approve', ...)` block (currently lines 149-171):

```typescript
describe('PATCH /contributors/:id/approve', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: PATCH /contributors/:id/approve sets approved=true and returns the updated profile
  // How:   mockAdminFrom returns an update/eq/select/single chain; checks status 200 and body.approved
  // Chain: the approval status is checked by authMiddleware on every request → once approved,
  //        the contributor's POST /tutorials requests are no longer blocked with a 403
  it('sets approved=true and returns updated profile', async () => {
    mockAdminFrom.mockReturnValue({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => ({ data: { id: 'c-1', approved: true }, error: null }),
          }),
        }),
      }),
    })
    const res = await makeApp('admin').request('/contributors/c-1/approve', { method: 'PATCH' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.approved).toBe(true)
  })
})

```

Also update the comment above `describe('DELETE /contributors/:id', ...)` (currently: "the user is removed from Supabase Auth entirely...") to drop any implication this was a "reject a pending signup" step — replace:

```typescript
  // Tests: DELETE /contributors/:id calls Supabase Auth's deleteUser and returns 204
  // How:   mockDeleteUser resolves with { error: null }; verifies it was called with the correct user ID
  // Chain: the user is removed from Supabase Auth entirely → they can no longer log in or make
  //        authenticated API requests, effectively revoking all access to the platform
```

with:

```typescript
  // Tests: DELETE /contributors/:id is a general admin moderation tool that removes any
  //        contributor account, calling Supabase Auth's deleteUser and returning 204
  // How:   mockDeleteUser resolves with { error: null }; verifies it was called with the correct user ID
  // Chain: the user is removed from Supabase Auth entirely → they can no longer log in or make
  //        authenticated API requests, effectively revoking all access to the platform
```

- [ ] **Step 5: Run the unit test**

Run: `pnpm --filter @splat-connect/api test:unit -- admin`
Expected: All remaining tests in `admin.test.ts` pass.

- [ ] **Step 6: Typecheck the API package**

Run: `pnpm --filter @splat-connect/api typecheck`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/routes/admin.ts packages/api/src/routes/contributors.ts packages/api/src/routes/upload.ts packages/api/tests/unit/routes/admin.test.ts
git commit -m "feat(api): remove admin contributor-approve endpoint, repurpose delete as general moderation tool"
```

---

### Task 4: Web — remove the pending page, middleware gate, and login redirect

**Files:**
- Delete: `packages/web/app/pending/page.tsx`
- Modify: `packages/web/middleware.ts:13-22,85-95`
- Modify: `packages/web/app/login/page.tsx`
- Modify: `packages/web/app/signup/page.tsx:40-56`
- Modify: `packages/web/tests/e2e/helpers.ts:25-46`
- Modify: `packages/web/tests/e2e/auth/signup.spec.ts`
- Modify: `packages/web/tests/e2e/auth/login.spec.ts`

**Interfaces:**
- Produces: `createContributor(): Promise<{ id: string; email: string; password: string }>` in `helpers.ts` — the `approved` parameter is removed.

- [ ] **Step 1: Delete the pending page**

```bash
rm packages/web/app/pending/page.tsx
```

- [ ] **Step 2: Remove the approval redirect from `middleware.ts`**

In `packages/web/middleware.ts`, delete this block (currently lines 85-95):

```typescript
  if (needsContributorAuth && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('approved')
      .eq('id', user.id)
      .single()

    if (!profile?.approved) {
      return NextResponse.redirect(new URL('/pending', request.url))
    }
  }

```

Also update the header doc comment. Replace lines 13-17:

```typescript
 * Protected routes:
 * - /upload: Contributors only (approved=true)
 * - /my-tutorials: Contributors only
 * - /dashboard: Contributors only
 * - /admin: Admins only (role='admin')
```

with:

```typescript
 * Protected routes:
 * - /upload: Contributors only (signed in)
 * - /my-tutorials: Contributors only
 * - /dashboard: Contributors only
 * - /admin: Admins only (role='admin')
```

- [ ] **Step 3: Simplify the login redirect**

In `packages/web/app/login/page.tsx`, replace lines 63-69:

```typescript
      if (profile?.role === 'contributor') {
        window.location.href = profile.approved ? '/dashboard' : '/pending'
      } else if (profile?.role === 'admin') {
        window.location.href = '/admin'
      } else {
        window.location.href = '/'
      }
```

with:

```typescript
      if (profile?.role === 'contributor') {
        window.location.href = '/dashboard'
      } else if (profile?.role === 'admin') {
        window.location.href = '/admin'
      } else {
        window.location.href = '/'
      }
```

Also simplify the `.select('role, approved')` call two lines above (line 54) to `.select('role')`, and update the header doc comment. Replace lines 7-19:

```typescript
/**
 * Login Page
 * 
 * Allows existing users to log in with email/password.
 * Authentication is handled by Supabase.
 * 
 * Process:
 * 1. User enters email and password
 * 2. Supabase verifies credentials
 * 3. If valid: Sets session JWT in secure cookie
 * 4. Checks user profile (role, approved status)
 * 5. Redirects based on account status:
 *    - If approved: → /dashboard (contributor hub)
 *    - If not approved: → /pending ("awaiting approval")
 * 6. If error: Shows error message
 * 
 * Related flows:
 * - Sign up: /signup (creates new account)
 * - After approval: Admin approves account → user redirected to /dashboard
 * - Sign out: Nav component handles logout
```

with:

```typescript
/**
 * Login Page
 * 
 * Allows existing users to log in with email/password.
 * Authentication is handled by Supabase.
 * 
 * Process:
 * 1. User enters email and password
 * 2. Supabase verifies credentials
 * 3. If valid: Sets session JWT in secure cookie
 * 4. Checks user profile role
 * 5. Redirects based on role: contributor → /dashboard, admin → /admin, else → /
 * 6. If error: Shows error message
 * 
 * Related flows:
 * - Sign up: /signup (creates new account)
 * - Sign out: Nav component handles logout
```

And remove the now-stale `app/pending: "Awaiting approval" page` line from the "Related files" list further down.

- [ ] **Step 4: Update signup page copy**

In `packages/web/app/signup/page.tsx`, replace lines 40-43:

```typescript
        <p className="text-gray-600 text-sm">
          Your account has been created and is pending admin approval. You&apos;ll be
          able to log in and upload tutorials once approved.
        </p>
```

with:

```typescript
        <p className="text-gray-600 text-sm">
          Your account has been created. You can log in and start uploading tutorials
          right away.
        </p>
```

And replace lines 54-56:

```typescript
      <p className="text-gray-500 text-sm mb-6">
        Submit your details — the SPLAT admin will approve your account so you
        can upload tutorials.
      </p>
```

with:

```typescript
      <p className="text-gray-500 text-sm mb-6">
        Create your contributor account to start uploading tutorials.
      </p>
```

- [ ] **Step 5: Simplify the e2e `createContributor` helper**

In `packages/web/tests/e2e/helpers.ts`, replace lines 25-46:

```typescript
/**
 * Provision a confirmed contributor directly via the service role. Returns
 * credentials for signing in through the UI. `approved` controls whether the
 * profile can pass the middleware's contributor gate.
 */
export async function createContributor(approved = true) {
  const admin = adminClient()
  const email = uniqueEmail('contrib')
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Failed to create contributor: ${error?.message}`)

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: data.user.id, role: 'contributor', approved })
  if (profileError) throw new Error(`Failed to set contributor profile: ${profileError.message}`)

  return { id: data.user.id, email, password: PASSWORD }
}
```

with:

```typescript
/** Provision a confirmed contributor directly via the service role. Returns credentials for signing in through the UI. */
export async function createContributor() {
  const admin = adminClient()
  const email = uniqueEmail('contrib')
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Failed to create contributor: ${error?.message}`)

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: data.user.id, role: 'contributor' })
  if (profileError) throw new Error(`Failed to set contributor profile: ${profileError.message}`)

  return { id: data.user.id, email, password: PASSWORD }
}
```

- [ ] **Step 6: Rewrite `signup.spec.ts`**

Replace the full contents of `packages/web/tests/e2e/auth/signup.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'
import { uniqueContributorEmail } from '../helpers'

test('a new contributor signs up and sees the confirmation screen', async ({ page }) => {
  const email = uniqueContributorEmail()
  await page.goto('/signup')
  await page.locator('#name').fill('E2E Contributor')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill('Test1234!')
  await page.getByRole('button', { name: 'Request access' }).click()

  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible()
})

test('a newly signed-up contributor can access a protected route immediately', async ({ page }) => {
  const email = uniqueContributorEmail()
  await page.goto('/signup')
  await page.locator('#name').fill('E2E Contributor')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill('Test1234!')
  await page.getByRole('button', { name: 'Request access' }).click()
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible()

  // Local Supabase has email confirmations disabled (supabase/config.toml
  // auth.email.enable_confirmations = false), so signUp() already left a
  // session cookie in this browser context — no separate sign-in needed.
  await page.goto('/upload')
  await expect(page).toHaveURL(/\/upload$/)
})
```

- [ ] **Step 7: Rewrite `login.spec.ts`**

Replace the full contents of `packages/web/tests/e2e/auth/login.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers'

test('a contributor signs in and lands on the dashboard', async ({ page }) => {
  await signIn(page, 'contributor@splat-test.local', 'Test1234!')
  await page.waitForURL('**/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('an admin signs in and lands on the admin dashboard', async ({ page }) => {
  await signIn(page, 'admin@splat-test.local', 'Test1234!')
  await page.waitForURL('**/admin')
})

test('an invalid password shows an error and stays on /login', async ({ page }) => {
  await signIn(page, 'contributor@splat-test.local', 'wrong-password')
  await expect(page.getByText('Invalid login credentials')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})
```

- [ ] **Step 8: Run the web unit tests and typecheck**

Run: `pnpm --filter @splat-connect/web test:unit && pnpm --filter @splat-connect/web typecheck`
Expected: All tests pass, no type errors (nothing in the unit suite imports `/pending` or asserts on the removed redirect).

- [ ] **Step 9: Run the affected e2e specs**

Run: `pnpm --filter @splat-connect/web test:e2e -- auth/signup auth/login`
Expected: All tests pass. (Requires local Supabase running: `supabase start`.)

- [ ] **Step 10: Commit**

```bash
git add -u packages/web/app/pending packages/web/middleware.ts packages/web/app/login/page.tsx packages/web/app/signup/page.tsx packages/web/tests/e2e/helpers.ts packages/web/tests/e2e/auth/signup.spec.ts packages/web/tests/e2e/auth/login.spec.ts
git commit -m "feat(web): remove pending page, approval redirect, and update signup copy"
```

---

### Task 5: Web — repurpose the admin contributors page as a delete tool, remove pending stat

**Files:**
- Modify: `packages/web/app/admin/contributors/page.tsx`
- Modify: `packages/web/app/admin/page.tsx:13-27,45-64`
- Modify: `packages/web/app/dashboard/page.tsx:5,20-24`
- Modify: `packages/web/tests/e2e/admin/contributors.spec.ts`

- [ ] **Step 1: Rewrite `admin/contributors/page.tsx` as a flat list with delete**

Replace the full contents of `packages/web/app/admin/contributors/page.tsx`:

```typescript
import { apiClient } from '@/lib/api-client'
import { revalidatePath } from 'next/cache'
import type { Profile } from '@splat-connect/types'

async function deleteContributor(id: string) {
  'use server'
  await apiClient.delete(`/api/admin/contributors/${id}`)
  revalidatePath('/admin/contributors')
  revalidatePath('/admin')
}

export default async function ContributorsPage() {
  const all = await apiClient.get<Profile[]>('/api/admin/contributors')

  if (all.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Contributors</h1>
        <p className="text-gray-400">No contributors yet.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Contributors</h1>
      <div className="flex flex-col gap-3">
        {all.map((p) => (
          <div
            key={p.id}
            className="bg-white border rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-semibold text-sm">{p.name}</p>
              <p className="text-xs text-gray-500">{p.email}</p>
              <p className="text-xs text-gray-400">
                Joined {new Date(p.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <form action={deleteContributor.bind(null, p.id)}>
                <button
                  type="submit"
                  className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-200"
                >
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Remove the pending-count stat from `admin/page.tsx`**

Replace lines 55-71:

```typescript
  const pendingTutorials = tutorials.length
  const pendingContributors = contributors.filter((c) => !c.approved).length

  const cards = [
    {
      label: 'Pending contributor requests',
      count: pendingContributors,
      href: '/admin/contributors' as const,
      color: 'border-orange-400',
    },
    {
      label: 'Tutorials awaiting review',
      count: pendingTutorials,
      href: '/admin/review' as const,
      color: 'border-blue-400',
    },
  ]
```

with:

```typescript
  const pendingTutorials = tutorials.length
  const totalContributors = contributors.length

  const cards = [
    {
      label: 'Contributors',
      count: totalContributors,
      href: '/admin/contributors' as const,
      color: 'border-orange-400',
    },
    {
      label: 'Tutorials awaiting review',
      count: pendingTutorials,
      href: '/admin/review' as const,
      color: 'border-blue-400',
    },
  ]
```

Also update the header doc comment. Replace lines 13-28:

```typescript
 * Stats displayed:
 * 1. Pending contributor requests
 *    - New users awaiting account approval
 *    - Click to go to contributor approval page
 * 2. Tutorials awaiting review
 *    - Submitted tutorials with status='pending'
 *    - Click to go to tutorial review page
 * 
 * Admin workflows:
 * 1. Approve contributor:
 *    - Click "Pending contributor requests"
 *    - See list of unapproved users
 *    - Click user to view profile
 *    - Click "Approve" button
 *    - User's approved status changed to true
 *    - User can now create tutorials
```

with:

```typescript
 * Stats displayed:
 * 1. Contributors
 *    - Total contributor accounts
 *    - Click to go to the contributors list (delete accounts if needed)
 * 2. Tutorials awaiting review
 *    - Submitted tutorials with status='pending'
 *    - Click to go to tutorial review page
 * 
 * Admin workflows:
 * 1. Remove a contributor:
 *    - Click "Contributors"
 *    - Click "Delete" on the account to remove
```

- [ ] **Step 3: Clean up stale comments in `dashboard/page.tsx`**

Replace line 5:

```typescript
 * Only accessible to approved contributors (approved=true, role='contributor').
```

with:

```typescript
 * Only accessible to signed-in contributors (role='contributor').
```

Replace lines 20-24:

```typescript
 * Middleware protection (middleware.ts):
 * - Requires authenticated user (role='contributor')
 * - If not authenticated → redirect to /login
 * - If not approved → redirect to /pending
 * - If admin → allowed but different UX
```

with:

```typescript
 * Middleware protection (middleware.ts):
 * - Requires authenticated user (role='contributor')
 * - If not authenticated → redirect to /login
```

- [ ] **Step 4: Rewrite `admin/contributors.spec.ts` as a delete-tool test**

Replace the full contents of `packages/web/tests/e2e/admin/contributors.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers'

test('an admin deletes a contributor account', async ({ page }) => {
  // WHY reusing the seeded pending@splat-test.local row instead of a
  // throwaway: this is the only spec that mutates it, and it runs first
  // (admin/ sorts before auth/, contributor/, public/ alphabetically).
  await signIn(page, 'admin@splat-test.local', 'Test1234!')
  await page.waitForURL('**/admin')

  await page.goto('/admin/contributors')
  await expect(page.getByText('pending@splat-test.local')).toBeVisible()

  const row = page.locator('div.bg-white', { hasText: 'pending@splat-test.local' })
  await row.getByRole('button', { name: 'Delete' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('pending@splat-test.local')).not.toBeVisible()
})
```

- [ ] **Step 5: Run the web unit tests and typecheck**

Run: `pnpm --filter @splat-connect/web test:unit && pnpm --filter @splat-connect/web typecheck`
Expected: All tests pass, no type errors.

- [ ] **Step 6: Run the affected e2e spec**

Run: `pnpm --filter @splat-connect/web test:e2e -- admin/contributors`
Expected: Test passes. (Requires local Supabase running.)

- [ ] **Step 7: Commit**

```bash
git add packages/web/app/admin/contributors/page.tsx packages/web/app/admin/page.tsx packages/web/app/dashboard/page.tsx packages/web/tests/e2e/admin/contributors.spec.ts
git commit -m "feat(web): repurpose admin contributors page as a delete tool, remove pending stat"
```

---

### Task 6: Full-suite verification

**Files:** None (verification only).

- [ ] **Step 1: Run the full API test suite**

Run: `pnpm --filter @splat-connect/api test`
Expected: All unit and integration tests pass (requires local Supabase running).

- [ ] **Step 2: Run the full web test suite**

Run: `pnpm --filter @splat-connect/web test:unit`
Expected: All tests pass.

- [ ] **Step 3: Run the full e2e suite**

Run: `pnpm --filter @splat-connect/web test:e2e`
Expected: All specs pass, including the untouched `admin/review-flow.spec.ts`, `contributor/dashboard.spec.ts`, and `contributor/edit-tutorial.spec.ts` (these call `createContributor()` with no arguments, unaffected by Task 4's signature change).

- [ ] **Step 4: Typecheck both packages**

Run: `pnpm --filter @splat-connect/api typecheck && pnpm --filter @splat-connect/web typecheck`
Expected: No errors.
