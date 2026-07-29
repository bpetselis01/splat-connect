# Shared Account Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a parent and a contributor the same kind of account, so either can author tutorials and either can hold a child profile, and close a privilege-escalation hole on `profiles` found while tracing it.

**Architecture:** One migration (`009`) redefines `is_approved_contributor()` so the ~13 RLS policies referencing it stop requiring `role = 'contributor'`, and adds a BEFORE UPDATE trigger freezing `profiles.role` and `profiles.email`. The API drops a now-harmful role guard, and the web gains one `getCapabilities()` helper that derives capability from data instead of reading the role column.

**Tech Stack:** Postgres/Supabase RLS, Hono (API), Next.js 16 App Router + React 19 (web), Vitest, Playwright, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-07-29-shared-account-foundation-design.md`

## Global Constraints

- Migration filename is exactly `supabase/migrations/009_shared_account_capability.sql`. Do not renumber existing migrations.
- `is_approved_contributor()` MUST keep its name and signature. ~13 RLS policies reference it by name and are not to be edited.
- `profiles.role` keeps the values `'admin' | 'contributor' | 'parent'`. Do NOT alter `profiles_role_check`, do NOT add columns, do NOT add a `user_roles` table, do NOT backfill.
- The freeze trigger MUST return early when `auth.uid() is null`. Service-role writes bypass RLS but still fire triggers, and `is_admin()` reads `auth.uid()`, which service_role lacks — see the header of `supabase/migrations/007_organizations.sql`.
- Use `127.0.0.1`, not `localhost`, for Supabase URLs when running tests locally. An Android emulator can bind 54321/54322 on `::1` and shadow them.
- Do not run Playwright while an Android emulator is running.
- This sub-project ships NO visible UI change. Any task that alters a rendered surface is out of scope.
- Every commit message ends with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## Commands

| Purpose | Command |
|---|---|
| Apply migrations | `supabase db reset` |
| API integration tests | `cd packages/api && pnpm test:integration` |
| API unit tests | `cd packages/api && pnpm test:unit` |
| Web unit tests | `cd packages/web && pnpm test:unit` |
| Typecheck everything | `pnpm typecheck` |

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/009_shared_account_capability.sql` (create) | Both DB changes: capability widening + identity freeze |
| `packages/api/tests/integration/auth/shared-capability.test.ts` (create) | A parent can author; the freeze trigger holds |
| `packages/api/src/routes/child-profile.ts` (modify) | Remove the `role !== 'parent'` guard |
| `packages/api/tests/integration/child-profile/rls.test.ts` (modify) | Invert the two assertions that pin the guard |
| `packages/api/src/routes/admin.ts` (modify) | Contributor list becomes an account list |
| `packages/web/lib/auth.ts` (modify) | Stop returning `null` for a parent |
| `packages/web/lib/capabilities.ts` (create) | The single "what may this user do" helper |
| `packages/web/tests/unit/lib/capabilities.test.ts` (create) | Capability derivation |
| `packages/web/app/admin/contributors/page.tsx` (modify) | Relabel to accounts |

---

### Task 1: Widen the authoring capability

**Files:**
- Create: `supabase/migrations/009_shared_account_capability.sql`
- Test: `packages/api/tests/integration/auth/shared-capability.test.ts`

**Interfaces:**
- Consumes: `createTestUser(role)` from `packages/api/tests/helpers/auth.ts` — already accepts `'parent'`.
- Produces: `public.is_approved_contributor()` returning true for any signed-in profile. Tasks 2 and 3 append to the same migration file.

- [ ] **Step 1: Write the failing test**

Create `packages/api/tests/integration/auth/shared-capability.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let parent: TestUser

const userClient = (token: string) =>
  createClient(
    process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_ANON_KEY ?? '',
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    }
  )

beforeAll(async () => {
  parent = await createTestUser('parent')
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('tutorials').delete().eq('title', 'Parent authored tutorial')
  await deleteTestUser(parent.id)
})

describe('authoring is not tied to the contributor role', () => {
  // Tests: a parent-role account can insert a tutorial.
  // Chain: is_approved_contributor() gated ~13 policies on role='contributor',
  //        so every authoring path failed in Postgres for a parent no matter
  //        what the interface offered them.
  //
  // No .select() on the insert: INSERT ... RETURNING also requires a SELECT
  // policy to match the new row, and a fresh draft has no tutorial_contributors
  // link yet, so "Contributors can read own tutorials" (001_schema.sql) does not
  // match it. That gap is pre-existing and unrelated to this change — it is why
  // POST /api/tutorials uses the admin client (tutorials.ts:65). Existence is
  // asserted with the service-role client instead.
  it('lets a parent-role account insert a tutorial', async () => {
    const { error } = await userClient(parent.token)
      .from('tutorials')
      .insert({ title: 'Parent authored tutorial', difficulty: 'easy' })

    expect(error).toBeNull()

    const { data } = await adminClient()
      .from('tutorials')
      .select('title')
      .eq('title', 'Parent authored tutorial')
      .single()
    expect(data?.title).toBe('Parent authored tutorial')
  })

  // Tests: the same account can link itself as a contributor on that tutorial.
  // Chain: tutorial_contributors insert is a second policy behind the same
  //        function — widening only the tutorials policy would leave submit broken.
  it('lets a parent-role account link itself as a contributor', async () => {
    // Looked up with the service-role client for the same reason as above: the
    // author cannot SELECT their own draft until this link exists.
    const { data: tutorial } = await adminClient()
      .from('tutorials')
      .select('id')
      .eq('title', 'Parent authored tutorial')
      .single()

    const { error } = await userClient(parent.token)
      .from('tutorial_contributors')
      .insert({ tutorial_id: tutorial!.id, profile_id: parent.id, role: 'primary' })

    expect(error).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/api && pnpm test:integration -- shared-capability
```

Expected: FAIL. Both cases error with a row-level security violation (`new row violates row-level security policy for table "tutorials"`, code `42501`).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/009_shared_account_capability.sql`:

```sql
-- WHY: A parent and a contributor are the same kind of account now — either may
--      author, either may hold a child profile. is_approved_contributor()
--      required role = 'contributor', so a mobile-registered parent was refused
--      by Postgres on every authoring path regardless of what the UI offered.
-- HOW: The function keeps its name and signature, so the ~13 RLS policies
--      referencing it (tutorial insert, tutorial_contributors insert, storage
--      upload/update) inherit the new behaviour with no changes. This is the
--      same technique 005 used when it removed the approval gate, and it is why
--      that indirection was kept.
create or replace function public.is_approved_contributor()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid()
  );
$$ language sql security definer stable;
```

- [ ] **Step 4: Apply and re-run**

```bash
supabase db reset
cd packages/api && pnpm test:integration -- shared-capability
```

Expected: PASS, both cases.

- [ ] **Step 5: Verify nothing else regressed**

```bash
cd packages/api && pnpm test:integration
```

Expected: PASS. If a test asserting "a parent cannot create a tutorial" now fails, that test encoded the old rule — update it to the new rule rather than reverting the migration, and note it in the commit body.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/009_shared_account_capability.sql \
        packages/api/tests/integration/auth/shared-capability.test.ts
git commit -m "feat(db): let any account author, not only the contributor role

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Freeze role and email against self-service updates

**Files:**
- Modify: `supabase/migrations/009_shared_account_capability.sql` (append)
- Test: `packages/api/tests/integration/auth/shared-capability.test.ts` (append)

**Interfaces:**
- Consumes: `public.is_admin()` from `001_schema.sql:88`.
- Produces: trigger `profiles_freeze_identity` on `public.profiles`. Task 4 of the unified-dashboard plan depends on this being in place before a profile-editing UI exists.

**Context for the implementer:** `001_schema.sql:134` defines `"User can update own profile"` as `for update using (auth.uid() = id)` with no `WITH CHECK`. Postgres reuses the `USING` expression as the check when one is omitted, so the post-update row only has to satisfy `auth.uid() = id` — still true after setting `role = 'admin'`. `004_data_api_grants.sql:17` grants `all on all tables` to `authenticated`, so `profiles` is reachable over PostgREST with the browser's anon key. This is a live escalation path, not a theoretical one.

A `WITH CHECK` comparing against the stored role would need a subquery on `profiles` from inside a `profiles` policy. Use a BEFORE trigger instead — `OLD` is visible there. This repo already freezes columns this way twice: `tutorial_orgs_freeze_identity` (`007:335`) and `tutorials_freeze_review_provenance` (`008:56`).

- [ ] **Step 1: Write the failing test**

Append to `packages/api/tests/integration/auth/shared-capability.test.ts`:

```ts
describe('profile identity is frozen against its owner', () => {
  // Tests: a user cannot promote themselves to admin.
  // Chain: "User can update own profile" has no WITH CHECK, so USING doubles as
  //        the check and role='admin' satisfied it. is_admin() then opens every
  //        admin policy in the schema.
  it('rejects a user setting their own role to admin', async () => {
    const { error } = await userClient(parent.token)
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', parent.id)

    expect(error).not.toBeNull()

    const { data } = await adminClient()
      .from('profiles')
      .select('role')
      .eq('id', parent.id)
      .single()
    expect(data?.role).toBe('parent')
  })

  // Tests: email is not settable directly.
  // Chain: profiles.email mirrors auth.users; a divergent value would make the
  //        admin account list lie about who an account belongs to.
  it('rejects a user setting their own email', async () => {
    const { error } = await userClient(parent.token)
      .from('profiles')
      .update({ email: 'attacker@example.com' })
      .eq('id', parent.id)

    expect(error).not.toBeNull()
  })

  // Tests: the freeze does not block the fields the profile tab will edit.
  it('still allows a user to change their own name', async () => {
    const { error } = await userClient(parent.token)
      .from('profiles')
      .update({ name: 'Renamed Parent' })
      .eq('id', parent.id)

    expect(error).toBeNull()
  })

  // Tests: an admin retains authority over another account's role.
  it('allows an admin to change another profile role', async () => {
    const admin = await createTestUser('admin')
    const target = await createTestUser('contributor')

    const { error } = await userClient(admin.token)
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', target.id)

    expect(error).toBeNull()

    await deleteTestUser(admin.id)
    await deleteTestUser(target.id)
  })

  // Tests: a service-role write is not caught by the guard.
  // Chain: triggers fire for service_role even though RLS does not, and
  //        is_admin() reads auth.uid(), which service_role lacks. Without the
  //        early return this raises 42501 while the route reports success
  //        having changed nothing (see the 007 header).
  it('does not block a service-role write', async () => {
    const { error } = await adminClient()
      .from('profiles')
      .update({ role: 'contributor' })
      .eq('id', parent.id)

    expect(error).toBeNull()

    // Restore for the remaining tests in this file.
    await adminClient().from('profiles').update({ role: 'parent' }).eq('id', parent.id)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/api && pnpm test:integration -- shared-capability
```

Expected: FAIL on "rejects a user setting their own role to admin" — `error` is `null` and the stored role reads `'admin'`. That failure IS the vulnerability; confirm you see it before fixing.

- [ ] **Step 3: Append to the migration**

Append to `supabase/migrations/009_shared_account_capability.sql`:

```sql
-- WHY: "User can update own profile" (001_schema.sql:134) has no WITH CHECK, so
--      Postgres reuses USING as the check. auth.uid() = id stays true when role
--      changes, so any signed-in user could PATCH themselves to role='admin'
--      over PostgREST with the browser's anon key, and is_admin() gates every
--      admin policy in the schema.
-- HOW: A BEFORE trigger rather than a WITH CHECK: comparing against the stored
--      role from inside a profiles policy needs a subquery on profiles. OLD is
--      visible in a trigger, so identity is frozen here — the same shape as
--      tutorial_orgs_freeze_identity (007) and tutorials_freeze_review_provenance (008).
create or replace function public.freeze_profile_identity()
returns trigger as $$
begin
  -- service_role and other non-JWT contexts: RLS does not apply to them either,
  -- and is_admin() reads auth.uid(), which they lack. Without this early return
  -- such a write raises 42501 while the caller reports success having changed
  -- nothing — the trap recorded in the 007 header.
  if auth.uid() is null then
    return new;
  end if;

  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'role cannot be changed by its owner';
  end if;

  if new.email is distinct from old.email and not public.is_admin() then
    raise exception 'email is mirrored from auth.users and cannot be set directly';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger profiles_freeze_identity
  before update on public.profiles
  for each row execute function public.freeze_profile_identity();
```

- [ ] **Step 4: Apply and re-run**

```bash
supabase db reset
cd packages/api && pnpm test:integration -- shared-capability
```

Expected: PASS, all cases in both describe blocks.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/009_shared_account_capability.sql \
        packages/api/tests/integration/auth/shared-capability.test.ts
git commit -m "fix(db): stop an account promoting itself to admin

The profiles UPDATE policy has no WITH CHECK, so USING doubled as the check
and role='admin' satisfied it. Frozen in a BEFORE trigger, matching the two
existing column-freeze triggers.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Let any account hold a child profile

**Files:**
- Modify: `packages/api/src/routes/child-profile.ts:20-24`
- Modify: `packages/api/tests/integration/child-profile/rls.test.ts`
- Modify: `packages/api/tests/unit/routes/child-profile.test.ts` — two tests assert `403` for a non-parent role and will fail once the guard is gone

**`test:unit` and `test:integration` are separate scripts in `packages/api/package.json`.** Running only one and calling it "the full suite" is how the unit break above gets missed. Every verification step in this task runs BOTH.

**Interfaces:**
- Produces: `GET /api/child-profile` returns `200` with a `null` body for a caller with no child profile, instead of `403` for non-parents. `getCapabilities()` in Task 5 reads exactly this.

**Context for the implementer:** the guard being removed is:

```ts
childProfile.use('*', async (c, next) => {
  if (c.get('role') !== 'parent') return c.json({ error: 'Parent role required' }, 403)
  await next()
})
```

The file's own header already calls RLS the real boundary: *"Writes go through the user client so Postgres RLS (`parent_id = auth.uid()`) is the real authorization boundary."* The RLS policies at `003_ability_profile.sql:60-63` are unchanged and still scope every read and write to the caller's own row. Removing this guard removes a convenience 403, not a control.

- [ ] **Step 1: Invert the two assertions that pin the guard**

In `packages/api/tests/integration/child-profile/rls.test.ts`, the `describe('child-profile parent gating')` block currently asserts a contributor gets 403 on read and on write. Replace that whole block with:

```ts
describe('child-profile is open to any account', () => {
  // Tests: a contributor-role account reads its own (absent) child profile.
  // Chain: the role guard was the only thing stopping a web-registered account
  //        from becoming a parent, which is the point of the shared account.
  it('returns null rather than 403 for an account with no child profile', async () => {
    const res = await app.request('/api/child-profile', authed(contributor.token))
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  // Tests: a contributor-role account can create one.
  it('lets a contributor-role account create a child profile', async () => {
    const res = await app.request(
      '/api/child-profile',
      authed(contributor.token, { method: 'PUT', body: JSON.stringify({ age: 5 }) })
    )
    expect(res.status).toBe(200)
    const saved = (await res.json()) as Record<string, unknown>
    expect(saved.parent_id).toBe(contributor.id)
    expect(saved.age).toBe(5)
  })
})
```

Add `contributor.id` to the `afterAll` cleanup so the new row is removed:

```ts
await admin
  .from('child_profiles')
  .delete()
  .in('parent_id', [parentA.id, parentB.id, contributor.id])
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/api && pnpm test:integration -- child-profile
```

Expected: FAIL — both new cases get `403`.

- [ ] **Step 3: Remove the guard**

Delete the `childProfile.use('*', ...)` middleware block at `packages/api/src/routes/child-profile.ts:20-24`, including its two-line comment above it.

Update the file header: replace *"Both reject non-parent roles with 403."* with:

```
 * Any signed-in account may hold a child profile — parent and contributor are
 * not exclusive. Writes go through the user client so Postgres RLS
 * (parent_id = auth.uid()) is the authorization boundary, as it always was.
```

Also update the header's endpoint line for `GET` so it reads *"the caller's `child_profiles` row, or null if they have not created one"* — it no longer implies the caller is a parent.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd packages/api && pnpm test:integration -- child-profile
```

Expected: PASS, including the untouched RLS isolation case asserting one parent cannot read another's row.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/child-profile.ts \
        packages/api/tests/integration/child-profile/rls.test.ts
git commit -m "feat(api): let any account hold a child profile

RLS (parent_id = auth.uid()) was always the real boundary; the role check was
a fast 403 that now blocks the shared account it was written before.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Stop treating a parent as logged out on the web

**Files:**
- Modify: `packages/web/lib/auth.ts:39`
- Test: `packages/web/tests/unit/lib/auth.test.ts` (create if absent)

**Interfaces:**
- Produces: `getUserRole(): Promise<Role | null>` returning `'parent'` for a parent. `nav.tsx` and Task 5 both consume it.

**Context for the implementer:** the current line is

```ts
if (role === 'admin' || role === 'contributor') return role
return null
```

Its comment explains the intent — an unrecognised value must not look like a valid login. Preserve that: widen to the three legal roles, keep returning `null` for anything else.

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/unit/lib/auth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const single = vi.fn()

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  }),
}))

const { getUserRole } = await import('@/lib/auth')

beforeEach(() => single.mockReset())

describe('getUserRole', () => {
  // Chain: returning null for a parent made the nav render a signed-in parent
  //        as signed-out, so "everyone signs in the same way" failed at the nav.
  it('returns parent for a parent', async () => {
    single.mockResolvedValue({ data: { role: 'parent' }, error: null })
    expect(await getUserRole()).toBe('parent')
  })

  it('returns contributor for a contributor', async () => {
    single.mockResolvedValue({ data: { role: 'contributor' }, error: null })
    expect(await getUserRole()).toBe('contributor')
  })

  it('returns admin for an admin', async () => {
    single.mockResolvedValue({ data: { role: 'admin' }, error: null })
    expect(await getUserRole()).toBe('admin')
  })

  // Chain: the defensive intent of the original narrowing — an unexpected value
  //        must not look like a valid login — is preserved.
  it('returns null for an unrecognised role', async () => {
    single.mockResolvedValue({ data: { role: 'wizard' }, error: null })
    expect(await getUserRole()).toBeNull()
  })

  it('returns null when the profile lookup errors', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await getUserRole()).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/web && pnpm test:unit -- auth
```

Expected: FAIL on "returns parent for a parent" — receives `null`.

- [ ] **Step 3: Widen the narrowing**

In `packages/web/lib/auth.ts`, replace line 39 with:

```ts
    if (role === 'admin' || role === 'contributor' || role === 'parent') return role
```

Update the comment above it so it no longer implies parents are excluded — the rule is now "unrecognised value, not unprivileged role":

```ts
    // WHY: A failed database lookup or an unexpected value in the role column
    //      would slip through and look like a valid login.
    // HOW: Returns null for any error or unrecognised role. Every legal role is
    //      a valid login — a parent is a signed-in user like any other.
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd packages/web && pnpm test:unit -- auth
```

Expected: PASS, all five cases.

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/auth.ts packages/web/tests/unit/lib/auth.test.ts
git commit -m "fix(web): stop rendering a signed-in parent as signed-out

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: One helper for "what may this user do"

**Files:**
- Create: `packages/web/lib/capabilities.ts`
- Test: `packages/web/tests/unit/lib/capabilities.test.ts`

**Interfaces:**
- Consumes: `apiClient` from `@/lib/api-client`; `Profile`, `Organization`, `ChildProfile` from `@splat-connect/types`.
- Produces — every later task in sub-projects 2 and 3 imports this:

```ts
export type Capabilities = {
  profile: Profile
  isAdmin: boolean
  isParent: boolean
  ledOrgs: Organization[]
  canAuthor: boolean
}
export const getCapabilities: () => Promise<Capabilities | null>
```

**Context for the implementer:** today the same question is answered in four places, differently — `lib/auth.ts:39`, `nav.tsx:65-69`, `dashboard/page.tsx:54`, `lib/org-access.ts`. This replaces the scattered checks. `lib/org-access.ts` stays for now; sub-project 3 retires it.

Degradation rule: a failed `/api/contributors/me` means there is no user, so return `null`. A failed child-profile or led-orgs fetch degrades that one capability to `false`/`[]` rather than failing the page — the shape `org-access.ts` already uses.

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/unit/lib/capabilities.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const get = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (path: string) => get(path) } }))

const PROFILE = { id: 'u1', name: 'Ada', email: 'ada@example.com', role: 'contributor' }

function route(overrides: Record<string, unknown>) {
  get.mockImplementation((path: string) => {
    if (path in overrides) {
      const v = overrides[path]
      return v instanceof Error ? Promise.reject(v) : Promise.resolve(v)
    }
    throw new Error(`unexpected path ${path}`)
  })
}

beforeEach(() => {
  get.mockReset()
  vi.resetModules()
})

async function subject() {
  const { getCapabilities } = await import('@/lib/capabilities')
  return getCapabilities()
}

describe('getCapabilities', () => {
  // Chain: parent-ness is derived from data, not declared in the role column —
  //        that is what lets one account be both parent and contributor.
  it('reports isParent from a child profile row, not from the role', async () => {
    route({
      '/api/contributors/me': PROFILE,
      '/api/child-profile': { parent_id: 'u1', age: 7 },
      '/api/organizations/mine': [],
    })
    const caps = await subject()
    expect(caps?.isParent).toBe(true)
  })

  it('reports isParent false when there is no child profile row', async () => {
    route({
      '/api/contributors/me': PROFILE,
      '/api/child-profile': null,
      '/api/organizations/mine': [],
    })
    expect((await subject())?.isParent).toBe(false)
  })

  // Chain: leadership was already per-organisation data rather than a role
  //        (middleware.ts:18-20); this reads it the same way.
  it('reports led organisations', async () => {
    route({
      '/api/contributors/me': PROFILE,
      '/api/child-profile': null,
      '/api/organizations/mine': [{ id: 'o1', name: 'Splat', status: 'active' }],
    })
    expect((await subject())?.ledOrgs).toHaveLength(1)
  })

  it('reports canAuthor for every signed-in account', async () => {
    route({
      '/api/contributors/me': { ...PROFILE, role: 'parent' },
      '/api/child-profile': null,
      '/api/organizations/mine': [],
    })
    expect((await subject())?.canAuthor).toBe(true)
  })

  it('reports isAdmin from the role column', async () => {
    route({
      '/api/contributors/me': { ...PROFILE, role: 'admin' },
      '/api/child-profile': null,
      '/api/organizations/mine': [],
    })
    expect((await subject())?.isAdmin).toBe(true)
  })

  // Chain: one flaky sub-fetch must not blank the whole dashboard.
  it('degrades a failed led-orgs fetch to an empty list', async () => {
    route({
      '/api/contributors/me': PROFILE,
      '/api/child-profile': null,
      '/api/organizations/mine': new Error('boom'),
    })
    const caps = await subject()
    expect(caps?.ledOrgs).toEqual([])
  })

  it('degrades a failed child-profile fetch to not-a-parent', async () => {
    route({
      '/api/contributors/me': PROFILE,
      '/api/child-profile': new Error('boom'),
      '/api/organizations/mine': [],
    })
    expect((await subject())?.isParent).toBe(false)
  })

  // Chain: without a profile there is no user, so this one is not degradable.
  it('returns null when the profile fetch fails', async () => {
    route({
      '/api/contributors/me': new Error('401'),
      '/api/child-profile': null,
      '/api/organizations/mine': [],
    })
    expect(await subject()).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/web && pnpm test:unit -- capabilities
```

Expected: FAIL — `Cannot find module '@/lib/capabilities'`.

- [ ] **Step 3: Write the helper**

Create `packages/web/lib/capabilities.ts`:

```ts
/**
 * The single answer to "what may this user do".
 *
 * Capability is derived from data the schema already holds rather than read from
 * profiles.role, which is why one account can be both a parent and a contributor:
 * - admin      role = 'admin' (the only capability the column still carries)
 * - author     any signed-in account (009 widened is_approved_contributor)
 * - parent     has a child_profiles row
 * - leader     has an org_leaders row, via GET /api/organizations/mine
 *
 * Wrapped in React cache() so a layout and its page share one round of fetches.
 *
 * Related files:
 * - supabase/migrations/009_shared_account_capability.sql: the authoring widening
 * - lib/org-access.ts: the per-organisation check this generalises
 */
import { cache } from 'react'
import { apiClient } from '@/lib/api-client'
import type { Profile, Organization, ChildProfile } from '@splat-connect/types'

export type Capabilities = {
  profile: Profile
  isAdmin: boolean
  isParent: boolean
  ledOrgs: Organization[]
  canAuthor: boolean
}

export const getCapabilities = cache(async (): Promise<Capabilities | null> => {
  let profile: Profile
  try {
    profile = await apiClient.get<Profile>('/api/contributors/me')
  } catch {
    // No profile means no user. Not degradable.
    return null
  }

  // Each of these degrades to "capability absent" on failure so one flaky fetch
  // hides one tab rather than blanking the dashboard.
  const [childProfile, ledOrgs] = await Promise.all([
    apiClient.get<ChildProfile | null>('/api/child-profile').catch(() => null),
    apiClient.get<Organization[]>('/api/organizations/mine').catch(() => [] as Organization[]),
  ])

  return {
    profile,
    isAdmin: profile.role === 'admin',
    isParent: childProfile !== null,
    ledOrgs,
    canAuthor: true,
  }
})
```

**Note on `cache()` in unit tests:** React's `cache()` memoizes per request scope. Outside a server render there is no scope, so it calls through without memoizing — which is what the test wants, since each case needs a fresh result. That is why the test calls `vi.resetModules()` and re-imports per case. If `cache()` turns out to throw in this Vitest environment rather than calling through, wrap only the export:

```ts
const load = async (): Promise<Capabilities | null> => { /* body */ }
export const getCapabilities = cache(load)
```

and have the test import `load`. Do not drop `cache()` from the export — the layout and its page in sub-project 3 both call it, and without it that is two rounds of fetches per page view.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd packages/web && pnpm test:unit -- capabilities
pnpm typecheck
```

Expected: PASS, all eight cases; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/capabilities.ts packages/web/tests/unit/lib/capabilities.test.ts
git commit -m "feat(web): derive capabilities from data instead of the role column

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The admin contributor list becomes an account list

**Files:**
- Modify: `packages/api/src/routes/admin.ts:58-67`
- Modify: `packages/web/app/admin/contributors/page.tsx`
- Test: `packages/api/tests/integration/auth/shared-capability.test.ts` (append)

**Interfaces:**
- Produces: `GET /api/admin/contributors` returns every non-admin profile. Path and response shape (`Profile[]`) are unchanged, so `app/admin/page.tsx:48` and `app/admin/organizations/page.tsx:63` keep working untouched.

**Context for the implementer:** this task is a *consequence* of Task 1, not a requirement of its own. `.eq('role', 'contributor')` used to mean "everyone who can author"; after Task 1 it means "accounts created on web", so a mobile-registered parent who authors a tutorial would be invisible to the admin managing accounts. The endpoint path is deliberately NOT renamed — three call sites and an E2E spec reference it, and renaming buys nothing.

- [ ] **Step 1: Write the failing test**

Append to `packages/api/tests/integration/auth/shared-capability.test.ts`:

```ts
describe('the admin account list', () => {
  // Chain: the filter used to mean "everyone who can author". After 009 it means
  //        "signed up on web", so a mobile parent who authors would vanish from
  //        the screen an admin uses to manage accounts.
  it('includes a parent-role account', async () => {
    const admin = await createTestUser('admin')
    const res = await app.request('/api/admin/contributors', authed(admin.token))

    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ id: string }>
    expect(rows.some((r) => r.id === parent.id)).toBe(true)

    await deleteTestUser(admin.id)
  })

  it('excludes admins', async () => {
    const admin = await createTestUser('admin')
    const res = await app.request('/api/admin/contributors', authed(admin.token))
    const rows = (await res.json()) as Array<{ id: string }>

    expect(rows.some((r) => r.id === admin.id)).toBe(false)

    await deleteTestUser(admin.id)
  })
})
```

This file does not yet import `app` or define `authed`. Add at the top, matching `child-profile/rls.test.ts`:

```ts
import app from '../../../src/app.js'

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  },
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/api && pnpm test:integration -- shared-capability
```

Expected: FAIL on "includes a parent-role account" — the parent is filtered out.

- [ ] **Step 3: Widen the query**

In `packages/api/src/routes/admin.ts`, replace `.eq('role', 'contributor')` with `.neq('role', 'admin')` and add above the handler:

```ts
// Every non-admin account, not only role='contributor'. Since 009 the role
// column records where an account signed up rather than what it may do, so
// filtering on 'contributor' would hide mobile-registered accounts from the
// screen an admin uses to manage them. The path keeps its name: three call
// sites and an E2E spec reference it.
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd packages/api && pnpm test:integration -- shared-capability
```

Expected: PASS, both cases.

- [ ] **Step 5: Relabel the admin page**

In `packages/web/app/admin/contributors/page.tsx`, change the heading from contributor wording to "Accounts", and any body copy describing the list as contributors. Do not change the route path.

Check `app/admin/page.tsx:60` for a card labelled toward `/admin/contributors` and relabel it to match.

- [ ] **Step 6: Run the web tests**

```bash
cd packages/web && pnpm test:unit
pnpm typecheck
```

Expected: PASS. If `tests/unit/pages/admin-organizations.test.tsx` asserts on the old heading, update the assertion.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/routes/admin.ts \
        packages/api/tests/integration/auth/shared-capability.test.ts \
        packages/web/app/admin/contributors/page.tsx \
        packages/web/app/admin/page.tsx
git commit -m "fix(api,web): list every account, not only web-registered ones

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Full verification

**Files:** none modified.

- [ ] **Step 1: Reset the database and run every suite**

```bash
supabase db reset
cd packages/api && pnpm test:unit && pnpm test:integration
cd ../web && pnpm test:unit
cd ../.. && pnpm typecheck
```

Expected: all PASS. Report any failure with its output rather than working around it.

- [ ] **Step 2: Run the web E2E suite**

```bash
cd packages/web && pnpm test:e2e
```

Expected: PASS. No E2E behaviour should have changed in this sub-project — this suite is here to prove the claim that nothing visible moved. Confirm no Android emulator is running first.

- [ ] **Step 3: Update the knowledge graph**

```bash
graphify update .
```

- [ ] **Step 4: Commit any test updates**

```bash
git add -A
git commit -m "test: update assertions that encoded the exclusive role model

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Skip if the tree is clean.
