# Ability Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the `parent` role and a single-child `child_profiles` record, plus the parent-gated API to read/write it — the backend foundation for the mockup's Ability Profile / Everyday Needs / Customization Metrics screens.

**Architecture:** A new SQL migration widens `profiles.role` to include `'parent'`, whitelists `role='parent'` in the signup trigger (blocking self-serve admin escalation), and adds a `child_profiles` table with RLS scoped to `parent_id = auth.uid()`. A new Hono route `child-profile.ts` exposes `GET`/`PUT /api/child-profile`, gated to `role === 'parent'`, writing through `createUserClient(token)` so Postgres RLS is the real enforcement.

**Tech Stack:** Postgres (Supabase), TypeScript ESM, Hono, Vitest (mocked Supabase — no live DB in unit tests).

## Scope

This plan covers **only the scaffold-independent backend** — the entire slice that does not depend on `packages/mobile` (which the mobile-scaffold spec creates and which is not yet merged). It produces working, independently testable software on its own: a migration, a type change, and a fully unit-tested API route.

The mobile UI (parent signup form, the three profile screens, and the `estimateAbility()` MACS/BFMF function) lives in `packages/mobile` and is **deferred to its own follow-up plan**, written after the mobile scaffold merges. Writing concrete React Native task code now against scaffold interfaces (`useAuth`, the API client, `theme.ts`) that do not yet exist would fabricate against unknowns and drift. See "Phase 2 — Mobile (separate plan)" at the end for the deferred outline and its rationale.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-21-ability-profile-design.md` — all decisions there apply.
- **ESM imports in `packages/api` use explicit `.js` extensions** (e.g. `from '../supabase/user-client.js'`).
- **RLS is the real authorization.** User-scoped writes go through `createUserClient(token)`; `createAdminClient()` is only for elevated reads. Route-level role checks are a fast-fail, not the security boundary.
- **`Role` type in `@splat-connect/types` must stay in sync with the DB `profiles.role` check constraint** — both list `'admin' | 'contributor' | 'parent'`.
- **Migrations are plain SQL files** in `supabase/migrations/`, sequential numeric prefix (`003_...`), applied manually via the Supabase SQL editor (no Supabase CLI in this repo).
- **Signup trigger honors only `role='parent'` from metadata**; everything else (including omitted) defaults to `'contributor'`.
- **One child per parent** enforced by `unique` on `child_profiles.parent_id` (not by making it the PK), leaving multi-child support a future non-breaking `drop constraint`.
- **Commit trailer:** end each commit message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Parent role + `child_profiles` schema

**Files:**
- Create: `supabase/migrations/003_ability_profile.sql`
- Modify: `packages/types/src/index.ts:1` (widen `Role`) and append a `ChildProfile` interface

**Interfaces:**
- Produces: `Role` now includes `'parent'`; DB has `public.child_profiles`, `public.is_parent()`, and an updated `handle_new_user()`. Task 2 consumes `child_profiles` (columns) and the `parent` role value.

This task has no unit-test harness (SQL migrations and the types package are typecheck-only in this repo). Its verification is a clean typecheck plus applying the migration and running a schema-inspection query.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/003_ability_profile.sql`:

```sql
-- ============================================================
-- Parent role + child profiles
-- ============================================================

-- 1. Allow 'parent' as a profile role
alter table public.profiles
  drop constraint profiles_role_check,
  add constraint profiles_role_check
    check (role in ('admin', 'contributor', 'parent'));

-- 2. Signup trigger honors role='parent' from metadata; anything else
--    (including omitted) still defaults to 'contributor'. WHY: without this
--    whitelist a client could pass role='admin' at signup and self-grant admin.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, ''),
    case when new.raw_user_meta_data->>'role' = 'parent' then 'parent' else 'contributor' end
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 3. Helper mirroring is_admin()/is_approved_contributor()
create or replace function public.is_parent()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'parent'
  );
$$ language sql security definer stable;

-- 4. One child profile per parent (unique parent_id, not PK — leaves the
--    door open for multi-child later via a single drop constraint).
create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.profiles on delete cascade not null unique,
  age integer,
  -- Ability Profile
  primary_diagnosis text,
  macs_level text,
  macs_source text not null default 'manual' check (macs_source in ('manual','estimated')),
  hand_involvement text check (hand_involvement in ('bilateral','unilateral')),
  assist_hand text check (assist_hand in ('left','right')),
  bfmf_score text,
  bfmf_source text not null default 'manual' check (bfmf_source in ('manual','estimated')),
  -- Everyday Needs
  challenges text[] not null default '{}',
  challenge_other text,
  grip_type text,
  env_context text,
  -- Customization Metrics
  palm_width_mm numeric,
  wrist_circ_mm numeric,
  needs_arm_attachment boolean not null default false,
  forearm_length_mm numeric,
  hand_dominance text,
  sensory_preferences text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.child_profiles enable row level security;

create policy "Parent can view own child profile"
  on public.child_profiles for select using (parent_id = auth.uid());

create policy "Parent can insert own child profile"
  on public.child_profiles for insert with check (parent_id = auth.uid());

create policy "Parent can update own child profile"
  on public.child_profiles for update
  using (parent_id = auth.uid())
  with check (parent_id = auth.uid());

create policy "Admin full access to child_profiles"
  on public.child_profiles for all using (public.is_admin());
```

- [ ] **Step 2: Widen the `Role` type and add the `ChildProfile` interface**

In `packages/types/src/index.ts`, change line 1:

```typescript
export type Role = 'admin' | 'contributor' | 'parent'
```

Append at the end of the file:

```typescript
export interface ChildProfile {
  id: string
  parent_id: string
  age: number | null
  // Ability Profile
  primary_diagnosis: string | null
  macs_level: string | null
  macs_source: 'manual' | 'estimated'
  hand_involvement: 'bilateral' | 'unilateral' | null
  assist_hand: 'left' | 'right' | null
  bfmf_score: string | null
  bfmf_source: 'manual' | 'estimated'
  // Everyday Needs
  challenges: string[]
  challenge_other: string | null
  grip_type: string | null
  env_context: string | null
  // Customization Metrics
  palm_width_mm: number | null
  wrist_circ_mm: number | null
  needs_arm_attachment: boolean
  forearm_length_mm: number | null
  hand_dominance: string | null
  sensory_preferences: string[]
  updated_at: string
}
```

- [ ] **Step 3: Verify the whole workspace still typechecks**

Run: `pnpm -r typecheck`
Expected: PASS. (All existing `role === '...'` comparisons are equality checks, not exhaustive switches, so widening the union is non-breaking.)

- [ ] **Step 4: Apply the migration and verify the schema**

Apply `supabase/migrations/003_ability_profile.sql` in the Supabase SQL editor, then run:

```sql
select pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.profiles'::regclass and conname = 'profiles_role_check';

select count(*) from information_schema.tables
where table_schema = 'public' and table_name = 'child_profiles';
```
Expected: first query's def contains `'parent'`; second query returns `1`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/003_ability_profile.sql packages/types/src/index.ts
git commit -m "feat(db): add parent role and child_profiles table

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `child-profile` API route (parent-gated GET/PUT)

**Files:**
- Create: `packages/api/src/routes/child-profile.ts`
- Modify: `packages/api/src/index.ts:36` (import), `:56`/`:64` (auth + mount)
- Test: `packages/api/tests/unit/routes/child-profile.test.ts`

**Interfaces:**
- Consumes: `createUserClient(token)` from `../supabase/user-client.js`; `AuthVariables` (`userId`, `role`, `token`) from `../middleware/auth.js`; the `child_profiles` table and `parent` role from Task 1.
- Produces: `GET /api/child-profile` → the caller's `ChildProfile` row or `null`; `PUT /api/child-profile` → the upserted row. Both `403` for non-parent roles.

- [ ] **Step 1: Write the failing test**

Create `packages/api/tests/unit/routes/child-profile.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'
import type { Role } from '@splat-connect/types'

const mockUserFrom = vi.fn()

// child-profile writes go through the user client so RLS enforces parent_id scoping.
vi.mock('../../../src/supabase/user-client.js', () => ({ createUserClient: () => ({ from: mockUserFrom }) }))

const { default: childProfile } = await import('../../../src/routes/child-profile.js')

function makeApp(role: Role = 'parent') {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', role)
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', childProfile)
  return app
}

describe('GET /', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the parent\'s child profile', async () => {
    mockUserFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => ({ data: { id: 'cp-1', parent_id: 'user-1', age: 5 }, error: null }) }) }),
    })
    const res = await makeApp().request('/')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.parent_id).toBe('user-1')
  })

  it('returns null when no profile exists yet', async () => {
    mockUserFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => ({ data: null, error: null }) }) }),
    })
    const res = await makeApp().request('/')
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('returns 500 on DB error', async () => {
    mockUserFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => ({ data: null, error: { message: 'boom' } }) }) }),
    })
    const res = await makeApp().request('/')
    expect(res.status).toBe(500)
  })

  it('returns 403 for a non-parent role', async () => {
    const res = await makeApp('contributor').request('/')
    expect(res.status).toBe(403)
  })
})

describe('PUT /', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts editable fields and returns the row', async () => {
    let captured: any
    mockUserFrom.mockReturnValue({
      upsert: (row: any) => { captured = row; return { select: () => ({ single: () => ({ data: { id: 'cp-1', ...row }, error: null }) }) } },
    })
    const res = await makeApp().request('/', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ age: 5, macs_level: 'II' }),
    })
    expect(res.status).toBe(200)
    expect(captured.parent_id).toBe('user-1')
    expect(captured.age).toBe(5)
    expect(captured.macs_level).toBe('II')
  })

  it('ignores non-whitelisted / injected fields', async () => {
    let captured: any
    mockUserFrom.mockReturnValue({
      upsert: (row: any) => { captured = row; return { select: () => ({ single: () => ({ data: row, error: null }) }) } },
    })
    await makeApp().request('/', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ age: 5, id: 'evil', parent_id: 'other-user', role: 'admin' }),
    })
    expect(captured.parent_id).toBe('user-1') // forced, not client-controlled
    expect(captured.id).toBeUndefined()
    expect(captured.role).toBeUndefined()
  })

  it('returns 403 for a non-parent role', async () => {
    const res = await makeApp('admin').request('/', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ age: 5 }),
    })
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @splat-connect/api exec vitest run tests/unit/routes/child-profile.test.ts`
Expected: FAIL — cannot resolve `../../../src/routes/child-profile.js` (module not created yet).

- [ ] **Step 3: Write the route**

Create `packages/api/src/routes/child-profile.ts`:

```typescript
/**
 * Child Profile Routes (Protected, parent-only)
 *
 * One child profile per parent account (enforced by a unique parent_id in the DB).
 *
 * Endpoints:
 * - GET /api/child-profile   → the caller's child_profiles row, or null if not created yet
 * - PUT /api/child-profile   → upsert the caller's editable fields (autosave target)
 *
 * Both reject non-parent roles with 403. Writes go through the user client so
 * Postgres RLS (parent_id = auth.uid()) is the real authorization boundary.
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'

const childProfile = new Hono<{ Variables: AuthVariables }>()

// Only parents own a child profile. Admin/contributor get a fast 403 (RLS would
// deny them anyway, but this avoids a pointless round-trip and a confusing empty result).
childProfile.use('*', async (c, next) => {
  if (c.get('role') !== 'parent') return c.json({ error: 'Parent role required' }, 403)
  await next()
})

// Whitelist of client-editable columns. parent_id and updated_at are set by the
// server; id/role/etc. from the body are ignored — trust-boundary input filtering.
const EDITABLE = [
  'age',
  'primary_diagnosis', 'macs_level', 'macs_source', 'hand_involvement', 'assist_hand', 'bfmf_score', 'bfmf_source',
  'challenges', 'challenge_other', 'grip_type', 'env_context',
  'palm_width_mm', 'wrist_circ_mm', 'needs_arm_attachment', 'forearm_length_mm', 'hand_dominance', 'sensory_preferences',
] as const

childProfile.get('/', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('child_profiles')
    .select('*')
    .eq('parent_id', c.get('userId'))
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data) // null when the parent hasn't created a profile yet
})

childProfile.put('/', async (c) => {
  const body = await c.req.json()
  const row: Record<string, unknown> = {
    parent_id: c.get('userId'),
    updated_at: new Date().toISOString(),
  }
  for (const key of EDITABLE) {
    if (key in body) row[key] = body[key]
  }
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('child_profiles')
    .upsert(row, { onConflict: 'parent_id' })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

export default childProfile
```

- [ ] **Step 4: Register the route in `index.ts`**

In `packages/api/src/index.ts`, add the import after line 36 (`import contributors ...`):

```typescript
import childProfile from './routes/child-profile.js'
```

Add auth middleware alongside the others (after line 56, matching the `/api/tutorials` two-line exact+wildcard pattern — the route serves the mount root `/api/child-profile` with no sub-segment, so the bare path must be guarded too):

```typescript
app.use('/api/child-profile', authMiddleware)
app.use('/api/child-profile/*', authMiddleware)
```

Add the mount alongside the others (after line 64, `app.route('/api/contributors', contributors)`):

```typescript
app.route('/api/child-profile', childProfile)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @splat-connect/api exec vitest run tests/unit/routes/child-profile.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 6: Verify the whole API suite and typecheck still pass**

Run: `pnpm --filter @splat-connect/api test:unit && pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/routes/child-profile.ts packages/api/src/index.ts packages/api/tests/unit/routes/child-profile.test.ts
git commit -m "feat(api): add parent-gated child-profile GET/PUT route

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 — Mobile (separate plan, after the scaffold merges)

Deferred, not dropped. These deliverables live in `packages/mobile`, created by `docs/superpowers/specs/2026-07-21-mobile-app-scaffold-design.md`, which is not yet merged. They consume scaffold interfaces (the Supabase auth context, `lib/api-client.ts`, `theme.ts`, and the Profile tab structure) whose exact export names don't exist yet — pinning concrete React Native task code against them now would fabricate against unknowns and drift, the exact risk this phasing is meant to contain. A follow-up plan will be written once the scaffold lands and those interfaces are real:

1. **`estimateAbility(answers) → { macs, bfmf }`** — pure function, hardcoded 4-question lookup table, with a jest-expo unit test. **Placeholder, not a validated clinical instrument** — flagged inline, pending review by someone with MACS/BFMF domain expertise.
2. **Parent signup form** — name/email/password → `supabase.auth.signUp({ options: { data: { name, role: 'parent' } } })`, with a render test.
3. **Child-profile home + Ability Profile screen** — reads `profiles` name/email, the age field, and the three summary rows; the Ability Profile sub-screen with the collapsible questionnaire wired to `estimateAbility()`.
4. **Everyday Needs + Customization Metrics screens** — chip multi-selects, dropdowns, the arm-attachment conditional, and measurement guidance; all autosaving via debounced `PUT /api/child-profile`.

The backend in Phase 1 is fully functional and testable without any of this.
