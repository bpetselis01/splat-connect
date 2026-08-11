# Multiple Child Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one account hold several child profiles on the web, with a list page, an add-child page, an edit page, and a two-step delete.

**Architecture:** `child_profiles` already anticipated this — migration 003 used a unique constraint on `parent_id` rather than a primary key so multi-child would be one dropped constraint, and its RLS policies key on `parent_id = auth.uid()` rather than row count. The singleton `/api/child-profile` endpoints become a collection at `/api/child-profiles`, the web page splits into list / new / `[id]` routes mirroring `/dashboard` → `/upload` → `/tutorials/[id]/edit`, and mobile's hook migrates to the collection API without any mobile UI change.

**Tech Stack:** Hono + Supabase (API), Next.js 16 App Router + React 19 (web), Expo 57 + React Native (mobile), Vitest (api/web), Jest + `@testing-library/react-native` (mobile), Playwright (e2e), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-08-11-multi-child-profiles-design.md`

## Deviations from the approved spec

Two, both discovered while reading the code the plan touches. Implement the plan as written here.

1. **`GET /api/child-profiles/:id` is dropped.** The edit page needs the child's *position* to render the "Child N" fallback label, which a single-row fetch cannot supply. It fetches the collection and finds its child by id instead — that yields the index for free and removes an endpoint. `PATCH /:id` and `DELETE /:id` are unaffected.
2. **Mobile's hook needs write serialisation, not just new URLs.** The old `PUT` was an upsert, so create and update were one idempotent call. Split into POST-then-PATCH, two saves racing before the first POST returns would create two children. Task 7 queues writes behind a promise chain that starts with the mount load. The spec described this task as a URL swap; it is not.

## Global Constraints

- Postgres RLS is the authorization boundary. Every API handler uses `createUserClient(c.get('token'))` and performs no manual ownership check — another parent's row is invisible to the query, so `:id` routes answer 404, never 403.
- `parent_id` and `updated_at` are server-set. Request bodies are filtered through the `EDITABLE` whitelist; every other key is dropped silently.
- `name` is nullable by product decision. Never make it required in the UI or the schema.
- A child with no name is labelled `Child N` by 1-based position in `created_at` order, computed at render time and never stored, so numbering stays contiguous after a delete.
- Mobile's UI does not change. `useChildProfile` keeps returning `{ profile, loading, save, saveState }` and continues to show the first child only.
- Web tests run under Vitest from `packages/web`; API tests under Vitest from `packages/api`; mobile tests under Jest from `packages/mobile`.
- `packages/mobile/AGENTS.md` requires reading https://docs.expo.dev/versions/v57.0.0/ before writing mobile code. Task 7 touches no Expo API — only `fetch` wrappers and React hooks — but the constraint stands if an implementer reaches for anything Expo-specific.
- Per-file commits with descriptive messages, not one commit per task.
- End every commit message with: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## File Structure

**Create:**
- `supabase/migrations/020_multi_child_profiles.sql` — drop the unique constraint, add `name` and `created_at`, add the missing delete policy
- `packages/api/src/routes/child-profiles.ts` — collection CRUD (replaces `child-profile.ts`)
- `packages/api/tests/integration/child-profiles/crud.test.ts` — endpoint + RLS boundary tests
- `packages/web/lib/child-label.ts` — the `Child N` fallback, shared by list and edit pages
- `packages/web/components/new-child-form.tsx` — client wrapper: POST then navigate
- `packages/web/components/edit-child-form.tsx` — client wrapper: PATCH in place
- `packages/web/components/delete-child-button.tsx` — two-step confirm
- `packages/web/app/dashboard/child/new/page.tsx` — add-child route
- `packages/web/app/dashboard/child/[id]/page.tsx` — edit route
- `packages/web/tests/unit/lib/child-label.test.ts`
- `packages/web/tests/unit/pages/dashboard-child-list.test.tsx`
- `packages/web/tests/unit/pages/dashboard-child-edit.test.tsx`
- `packages/web/tests/unit/components/delete-child-button.test.tsx`

**Modify:**
- `packages/types/src/index.ts:3-28` — add `name` and `created_at` to `ChildProfile`
- `packages/api/src/app.ts:16,39,40,59` — import and mount the plural route
- `packages/web/components/child-profile-form.tsx` — `name` field, `onSave` prop
- `packages/web/app/dashboard/child/page.tsx` — becomes the list
- `packages/web/lib/nav-model.ts:75` — label rename
- `packages/mobile/lib/use-child-profile.ts` — collection API + serialised writes
- `packages/web/tests/unit/components/child-profile-form.test.tsx` — follows the prop change
- `packages/mobile/tests/unit/lib/use-child-profile.test.tsx` — follows the hook change
- `packages/web/tests/e2e/dashboard/shell.spec.ts:37,126-151,241` — label and flow

**Delete:**
- `packages/api/src/routes/child-profile.ts` — replaced by the plural file

---

### Task 1: Migration and shared type

**Files:**
- Create: `supabase/migrations/020_multi_child_profiles.sql`
- Modify: `packages/types/src/index.ts:3-28`

**Interfaces:**
- Consumes: nothing.
- Produces: `ChildProfile` gains `name: string | null` and `created_at: string`. Every later task depends on both fields existing.

Background: `supabase/migrations/003_ability_profile.sql:32` declares `parent_id uuid references public.profiles on delete cascade not null unique`. An inline `unique` in a `create table` is auto-named `<table>_<column>_key` by Postgres, so the constraint to drop is `child_profiles_parent_id_key`. 003 created select, insert, and update policies but no delete policy, which means deletes are currently impossible for a parent regardless of the API.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/020_multi_child_profiles.sql`:

```sql
-- ============================================================
-- Multiple child profiles per parent
-- ============================================================

-- 1. 003 used a unique constraint rather than a primary key precisely so this
--    would be a one-line change. The RLS policies key on parent_id = auth.uid(),
--    not on row count, so they already permit several rows per parent.
alter table public.child_profiles
  drop constraint child_profiles_parent_id_key;

-- 2. Optional by product decision: a parent may add a child without naming one.
--    The UI falls back to "Child N" by position, so this never identifies a row
--    on its own and must not be made not-null.
alter table public.child_profiles
  add column name text;

-- 3. Needed for a stable list order and for the "Child N" fallback label.
--    Existing rows take now(): wrong in principle, harmless in practice, since
--    an account with one child has nothing to order.
alter table public.child_profiles
  add column created_at timestamptz not null default now();

-- 4. 003 created select/insert/update policies but no delete policy, so a parent
--    could never remove a child profile. The list page needs this.
create policy "Parent can delete own child profile"
  on public.child_profiles for delete using (parent_id = auth.uid());
```

- [ ] **Step 2: Apply the migration and verify it landed**

Run:

```bash
cd /Users/byronpetselis/Documents/splat-connect && supabase migration up --local
```

Expected: `020_multi_child_profiles.sql` applies without error.

**Do NOT run `supabase db reset` for this.** It wipes the shared local database that other work on this machine may be using, and it is known to leave the Kong gateway returning 502s on this project even when the auth container is healthy. Only a pending migration needs applying, and `migration up` does that without dropping data.

If `migration up` is unavailable or refuses, apply the file directly instead:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/migrations/020_multi_child_profiles.sql
```

If you later hit unexplained 502s from the API, restart Kong (`docker restart supabase_kong_splat-connect`) before concluding anything is broken.

Then verify the schema changed:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d public.child_profiles" | grep -E "name|created_at|parent_id"
```

Expected: `name` and `created_at` columns present; no `"child_profiles_parent_id_key" UNIQUE CONSTRAINT` line.

Use `127.0.0.1`, not `localhost` — an Android emulator can bind `::1:54322` and shadow the Supabase port, producing failures that look like broken Docker.

- [ ] **Step 3: Add the fields to the shared type**

In `packages/types/src/index.ts`, change the `ChildProfile` interface so its first fields and last fields read:

```ts
export interface ChildProfile {
  id: string
  parent_id: string
  // Optional: a parent may add a child without naming one. The UI falls back to
  // "Child N" by position — see packages/web/lib/child-label.ts.
  name: string | null
  age: number | null
```

and, at the end of the same interface, replace `updated_at: string` with:

```ts
  created_at: string
  updated_at: string
}
```

Leave every field between `age` and `updated_at` exactly as it is.

- [ ] **Step 4: Verify the type compiles across the workspace**

Run: `cd /Users/byronpetselis/Documents/splat-connect && pnpm typecheck`

Expected: PASS. `ChildProfile` is constructed from API responses rather than object literals in the existing code, so adding two fields should not break existing call sites. If a literal does fail, add the two fields to it rather than making them optional.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/020_multi_child_profiles.sql
git commit -m "feat(db): allow multiple child profiles per parent

Drops the unique parent_id constraint 003 deliberately used instead of a
primary key, adds an optional name and a created_at for list ordering, and
adds the delete policy 003 never created.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"

git add packages/types/src/index.ts
git commit -m "feat(types): add name and created_at to ChildProfile

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Collection API

**Files:**
- Create: `packages/api/src/routes/child-profiles.ts`
- Delete: `packages/api/src/routes/child-profile.ts`
- Modify: `packages/api/src/app.ts:16,39,40,59`
- Test: `packages/api/tests/integration/child-profiles/crud.test.ts`

**Interfaces:**
- Consumes: `ChildProfile` with `name` and `created_at` (Task 1).
- Produces: `GET /api/child-profiles` → `ChildProfile[]` ordered by `created_at` ascending; `POST /api/child-profiles` → `ChildProfile`, 201; `PATCH /api/child-profiles/:id` → `ChildProfile`, 200, or 404; `DELETE /api/child-profiles/:id` → 204, or 404. Tasks 4-7 call these.

- [ ] **Step 1: Write the failing integration test**

Create `packages/api/tests/integration/child-profiles/crud.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

let parent: TestUser
let stranger: TestUser

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => {
  parent = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
})

afterAll(async () => {
  await deleteTestUser(parent.id)
  await deleteTestUser(stranger.id)
})

describe('child profiles collection', () => {
  it('returns an empty array for an account with no children', async () => {
    const res = await app.request('/api/child-profiles', authed(parent.token))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('creates children and returns them in created_at order', async () => {
    const first = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Emma', age: 7 }),
    }))
    expect(first.status).toBe(201)
    const emma = (await first.json()) as { id: string; name: string; parent_id: string }
    expect(emma.name).toBe('Emma')
    // parent_id is server-set from the token, never read from the body.
    expect(emma.parent_id).toBe(parent.id)

    const second = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({ age: 4 }),
    }))
    expect(second.status).toBe(201)

    const list = await app.request('/api/child-profiles', authed(parent.token))
    const rows = (await list.json()) as { id: string; name: string | null }[]
    expect(rows).toHaveLength(2)
    expect(rows[0].name).toBe('Emma')
    // A child may be created with no name at all — the UI labels it by position.
    expect(rows[1].name).toBeNull()
  })

  it('ignores a parent_id in the body instead of trusting it', async () => {
    const res = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Spoofed', parent_id: stranger.id }),
    }))
    expect(res.status).toBe(201)
    expect(((await res.json()) as { parent_id: string }).parent_id).toBe(parent.id)
  })

  it('patches only whitelisted columns', async () => {
    const created = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Patch me' }),
    }))
    const { id } = (await created.json()) as { id: string }

    const res = await app.request(`/api/child-profiles/${id}`, authed(parent.token, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Patched', age: 9, nonsense: true }),
    }))
    expect(res.status).toBe(200)
    const row = (await res.json()) as { name: string; age: number }
    expect(row.name).toBe('Patched')
    expect(row.age).toBe(9)
    expect(row).not.toHaveProperty('nonsense')
  })

  it('deletes a child', async () => {
    const created = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Delete me' }),
    }))
    const { id } = (await created.json()) as { id: string }

    const res = await app.request(`/api/child-profiles/${id}`, authed(parent.token, { method: 'DELETE' }))
    expect(res.status).toBe(204)

    const list = await app.request('/api/child-profiles', authed(parent.token))
    const rows = (await list.json()) as { id: string }[]
    expect(rows.map((r) => r.id)).not.toContain(id)
  })

  it('hides one parent\'s children from another parent', async () => {
    const created = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Private' }),
    }))
    const { id } = (await created.json()) as { id: string }

    // RLS makes the row invisible rather than forbidden, so the honest answer
    // is 404 — a 403 would confirm the row exists.
    const patch = await app.request(`/api/child-profiles/${id}`, authed(stranger.token, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Hijacked' }),
    }))
    expect(patch.status).toBe(404)

    const del = await app.request(`/api/child-profiles/${id}`, authed(stranger.token, { method: 'DELETE' }))
    expect(del.status).toBe(404)

    const strangerList = await app.request('/api/child-profiles', authed(stranger.token))
    expect((await strangerList.json()) as unknown[]).toEqual([])

    // And the row survived both attempts.
    const ownerList = await app.request('/api/child-profiles', authed(parent.token))
    const rows = (await ownerList.json()) as { id: string; name: string }[]
    expect(rows.find((r) => r.id === id)?.name).toBe('Private')
  })

  it('404s on a malformed id rather than leaking a database error', async () => {
    const res = await app.request('/api/child-profiles/not-a-uuid', authed(parent.token, { method: 'DELETE' }))
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/byronpetselis/Documents/splat-connect/packages/api && pnpm test:integration`

Expected: FAIL — every request 404s because `/api/child-profiles` is not mounted yet.

Note: `-- <name>` filtering is a no-op on this repo's test scripts; the whole suite runs regardless. Read the output for this file's results.

- [ ] **Step 3: Write the route**

Create `packages/api/src/routes/child-profiles.ts`:

```ts
/**
 * Child Profile Routes (Protected)
 *
 * A parent may hold any number of child profiles. 003 used a unique parent_id
 * rather than a primary key so this would be one dropped constraint; 020 dropped
 * it.
 *
 * Endpoints:
 * - GET    /api/child-profiles      → the caller's children, oldest first
 * - POST   /api/child-profiles      → create one
 * - PATCH  /api/child-profiles/:id  → update one
 * - DELETE /api/child-profiles/:id  → remove one
 *
 * There is deliberately no GET /:id. The edit page needs a child's position to
 * render its "Child N" fallback label, which a single-row fetch cannot supply,
 * so it reads the collection and finds its child there.
 *
 * Any signed-in account may hold child profiles — parent and contributor are not
 * exclusive. Writes go through the user client so Postgres RLS
 * (parent_id = auth.uid()) is the authorization boundary, as it always was. No
 * handler checks ownership itself: another parent's row is invisible to the
 * query, which is why :id routes answer 404 and never 403 — a 403 would confirm
 * the row exists.
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'

const childProfiles = new Hono<{ Variables: AuthVariables }>()

// Whitelist of client-editable columns. parent_id, created_at and updated_at are
// set by the server; id/role/etc. from the body are ignored — trust-boundary
// input filtering.
const EDITABLE = [
  'name', 'age',
  'primary_diagnosis', 'macs_level', 'macs_source', 'hand_involvement', 'assist_hand', 'bfmf_score', 'bfmf_source',
  'challenges', 'challenge_other', 'grip_type', 'env_context',
  'palm_width_mm', 'wrist_circ_mm', 'needs_arm_attachment', 'forearm_length_mm', 'hand_dominance', 'sensory_preferences',
] as const

/** Returns the whitelisted subset of a request body, or null if it isn't an object. */
function editableFrom(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const source = body as Record<string, unknown>
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of EDITABLE) {
    if (key in source) row[key] = source[key]
  }
  return row
}

// Postgres rejects a malformed uuid with 22P02. "Not found" is the truthful
// answer for an id that could never name a row, and it keeps a garbage path
// from surfacing as a 500.
const INVALID_TEXT_REPRESENTATION = '22P02'

childProfiles.get('/', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('child_profiles')
    .select('*')
    .eq('parent_id', c.get('userId'))
    .order('created_at', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})

childProfiles.post('/', async (c) => {
  const row = editableFrom(await c.req.json())
  if (!row) return c.json({ error: 'Invalid body' }, 400)
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('child_profiles')
    .insert({ ...row, parent_id: c.get('userId') })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

childProfiles.patch('/:id', async (c) => {
  const row = editableFrom(await c.req.json())
  if (!row) return c.json({ error: 'Invalid body' }, 400)
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('child_profiles')
    .update(row)
    .eq('id', c.req.param('id'))
    .select()
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: error.message }, 500)
  }
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

childProfiles.delete('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('child_profiles')
    .delete()
    .eq('id', c.req.param('id'))
    .select()
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: error.message }, 500)
  }
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.body(null, 204)
})

export default childProfiles
```

- [ ] **Step 4: Mount it and remove the old route**

In `packages/api/src/app.ts`:
- Line 16: change `import childProfile from './routes/child-profile.js'` to `import childProfiles from './routes/child-profiles.js'`
- Line 39: change `app.use('/api/child-profile', authMiddleware)` to `app.use('/api/child-profiles', authMiddleware)`
- Line 40: change `app.use('/api/child-profile/*', authMiddleware)` to `app.use('/api/child-profiles/*', authMiddleware)`
- Line 59: change `app.route('/api/child-profile', childProfile)` to `app.route('/api/child-profiles', childProfiles)`

Then delete the old file:

```bash
git rm packages/api/src/routes/child-profile.ts
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:

```bash
cd /Users/byronpetselis/Documents/splat-connect/packages/api && pnpm typecheck && pnpm test:unit && pnpm test:integration
```

Expected: all PASS.

If integration tests fail en masse with "Invalid or expired token", that is local socket exhaustion in GoTrue, not a real auth regression — re-run before investigating.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/child-profiles.ts packages/api/src/routes/child-profile.ts
git commit -m "feat(api): replace the singleton child profile route with a collection

Four endpoints under /api/child-profiles. No GET /:id: the edit page needs a
child's position for its fallback label, so it reads the collection.

RLS stays the authorization boundary, so :id routes answer 404 rather than
403 — another parent's row is invisible, and a 403 would confirm it exists.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"

git add packages/api/src/app.ts
git commit -m "feat(api): mount child profiles at the plural path

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"

git add packages/api/tests/integration/child-profiles/crud.test.ts
git commit -m "test(api): cover child profile CRUD and the RLS boundary

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Form takes a name and an onSave prop

**Files:**
- Modify: `packages/web/components/child-profile-form.tsx`
- Test: `packages/web/tests/unit/components/child-profile-form.test.tsx`

**Interfaces:**
- Consumes: `ChildProfile.name` (Task 1).
- Produces: `ChildProfileForm({ profile, onSave })` where `profile: Partial<ChildProfile> | null` and `onSave: (form: Partial<ChildProfile>) => Promise<void>`. Tasks 4 and 5 supply `onSave`.

The component currently hardcodes `browserApiClient.put('/api/child-profile', form)` at line 96 and so can only ever serve one endpoint. Lifting the call to a prop lets the same form create and edit without knowing which it is doing.

- [ ] **Step 1: Write the failing test**

Replace the first two tests in `packages/web/tests/unit/components/child-profile-form.test.tsx` — the `vi.mock` block at the top and the `'lets an account with no child profile create one'` case — with the following. Keep every other test in the file as it is.

Remove this block entirely:

```ts
const put = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { put: (...args: unknown[]) => put(...args) },
}))
```

Replace the first test with these two:

```tsx
  // Chain: gating the tab on isParent would mean the only way to create a child
  //        profile is to already have one. This is the create path.
  it('hands the edited fields to onSave instead of calling an endpoint itself', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildProfileForm profile={null} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    // Wait for the save to fully settle (not just for `onSave` to have been called) so
    // no in-flight promise from this test resolves mid-way through the next one.
    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ age: 7 }))
  })

  // Chain: name is optional, so it must round-trip as a normal field rather than
  //        being required to identify the child.
  it('edits the optional name', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildProfileForm profile={null} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: 'Emma' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Emma' }))
  })

  it('shows an error and no saved indicator when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'))
    render(<ChildProfileForm profile={null} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    // Telling the user a change was recorded when the server never recorded it
    // leaves them confused later, so a failure must never show "Saved".
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your changes')
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })
```

Then add `onSave={vi.fn()}` to the `<ChildProfileForm profile={...} />` call in every remaining test in the file — the prop is required, so TypeScript fails without it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/byronpetselis/Documents/splat-connect/packages/web && pnpm test:unit`

Expected: FAIL — `ChildProfileForm` does not accept `onSave`, and there is no "Name (optional)" field.

- [ ] **Step 3: Change the component signature and save handler**

In `packages/web/components/child-profile-form.tsx`:

Replace the signature and the `name`/`age` seed lines:

```tsx
export function ChildProfileForm({
  profile,
  onSave,
}: {
  profile: Partial<ChildProfile> | null
  onSave: (form: Partial<ChildProfile>) => Promise<void>
}) {
  const [form, setForm] = useState<Partial<ChildProfile>>(() => ({
    name: profile?.name ?? null,
    age: profile?.age ?? null,
```

Leave every other seeded field exactly as it is — the comment at line 51 ("Every field rendered below must be seeded here, or it silently ignores whatever the database holds and renders blank instead") is the reason that list must stay complete.

Replace the body of `save`:

```tsx
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await onSave(form)
      setSaved(true)
    } catch {
      setError('Could not save your changes. Please try again.')
    } finally {
      setBusy(false)
    }
  }
```

Delete the now-unused `import { browserApiClient } from '@/lib/browser-api-client'` line.

- [ ] **Step 4: Add the name field**

Inside the "Ability profile" card, immediately above the existing `<div>` that holds the Age label and input, add:

```tsx
          <div>
            <label htmlFor="name" className="field-label">Name (optional)</label>
            <input
              id="name"
              type="text"
              value={form.name ?? ''}
              onChange={(e) => set('name', e.target.value === '' ? null : e.target.value)}
              className="field-input"
            />
          </div>
```

Match the `className` on the input to whatever the sibling Age input already uses in this file — if Age uses something other than `field-input`, use that instead so the field does not look foreign.

- [ ] **Step 5: Update the component's header comment**

The header comment currently describes the component as targeting "the same PUT /api/child-profile contract" and explains that create and update are one call because the endpoint is an upsert. Both are now false. Replace those two claims:

- In the opening paragraph, change `re-implementation against the same PUT /api/child-profile contract and the same ChildProfile type` to `re-implementation against the same ChildProfile type`.
- In the "Deliberately does NOT port" list, change the autosave bullet's final sentence from `PUT /api/child-profile is already an upsert, so create and update are the same call.` to `The page supplies onSave, so this component is the same for create and edit.`
- In "Related files", change `packages/api routes backing PUT /api/child-profile` to `packages/api/src/routes/child-profiles.ts: the endpoints the pages call`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd /Users/byronpetselis/Documents/splat-connect/packages/web && pnpm typecheck && pnpm test:unit`

Expected: PASS. Typecheck will fail until every `<ChildProfileForm>` usage supplies `onSave`; the only usage outside tests is `app/dashboard/child/page.tsx`, which Task 4 rewrites. Until then, temporarily pass `onSave={async () => {}}` there so the tree compiles, and note it for Task 4.

- [ ] **Step 7: Commit**

```bash
git add packages/web/components/child-profile-form.tsx
git commit -m "refactor(web): lift the child profile save call into an onSave prop

The form hardcoded PUT /api/child-profile, so it could only ever serve one
endpoint. The page now supplies the call, letting the same form create and
edit. Adds the optional name field alongside it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"

git add packages/web/tests/unit/components/child-profile-form.test.tsx
git commit -m "test(web): follow the child profile form's onSave prop

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: List page and add-child page

**Files:**
- Create: `packages/web/lib/child-label.ts`
- Create: `packages/web/components/new-child-form.tsx`
- Create: `packages/web/app/dashboard/child/new/page.tsx`
- Modify: `packages/web/app/dashboard/child/page.tsx`
- Test: `packages/web/tests/unit/lib/child-label.test.ts`
- Test: `packages/web/tests/unit/pages/dashboard-child-list.test.tsx`

**Interfaces:**
- Consumes: `GET /api/child-profiles`, `POST /api/child-profiles` (Task 2); `ChildProfileForm({ profile, onSave })` (Task 3).
- Produces: `childLabel(child: { name: string | null }, index: number): string`. Task 5 imports it.

- [ ] **Step 1: Write the failing label test**

Create `packages/web/tests/unit/lib/child-label.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { childLabel } from '@/lib/child-label'

describe('childLabel', () => {
  it('uses the name when there is one', () => {
    expect(childLabel({ name: 'Emma' }, 0)).toBe('Emma')
  })

  // Chain: name is optional by design, so an unnamed child still needs to be
  //        distinguishable from its siblings in the list.
  it('falls back to a 1-based position when there is no name', () => {
    expect(childLabel({ name: null }, 0)).toBe('Child 1')
    expect(childLabel({ name: null }, 1)).toBe('Child 2')
  })

  // A name of spaces would otherwise render as an invisible label.
  it('treats a whitespace-only name as no name', () => {
    expect(childLabel({ name: '   ' }, 2)).toBe('Child 3')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/byronpetselis/Documents/splat-connect/packages/web && pnpm test:unit`

Expected: FAIL — `@/lib/child-label` does not exist.

- [ ] **Step 3: Write the label helper**

Create `packages/web/lib/child-label.ts`:

```ts
/**
 * How a child is identified in the UI.
 *
 * `name` is optional by product decision, so a child without one is identified
 * by position instead. The position is computed from the rendered list rather
 * than stored, which keeps the numbering contiguous after a delete removes a
 * child from the middle — a stored "Child 2" would leave a gap.
 *
 * Related files:
 * - app/dashboard/child/page.tsx: the list
 * - app/dashboard/child/[id]/page.tsx: the edit page heading
 */
export function childLabel(child: { name: string | null }, index: number): string {
  return child.name?.trim() || `Child ${index + 1}`
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd /Users/byronpetselis/Documents/splat-connect/packages/web && pnpm test:unit`

Expected: the three `childLabel` tests PASS.

- [ ] **Step 5: Write the failing list-page test**

Create `packages/web/tests/unit/pages/dashboard-child-list.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ChildListPage from '@/app/dashboard/child/page'
import type { ChildProfile } from '@splat-connect/types'

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [],
    canAuthor: true,
    unreadNotifications: 0,
  }),
}))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

import { apiClient } from '@/lib/api-client'

const child = (over: Partial<ChildProfile>): ChildProfile => ({
  id: 'c1',
  parent_id: 'u1',
  name: null,
  age: null,
  primary_diagnosis: null,
  macs_level: null,
  macs_source: 'manual',
  hand_involvement: null,
  assist_hand: null,
  bfmf_score: null,
  bfmf_source: 'manual',
  challenges: [],
  challenge_other: null,
  grip_type: null,
  env_context: null,
  palm_width_mm: null,
  wrist_circ_mm: null,
  needs_arm_attachment: false,
  forearm_length_mm: null,
  hand_dominance: null,
  sensory_preferences: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
})

describe('ChildListPage', () => {
  beforeEach(() => vi.resetAllMocks())

  // Chain: a brand-new account has to learn why this page exists before it has
  //        anything to show.
  it('explains the page and offers Add child when there are none', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    render(await ChildListPage())
    expect(screen.getByText(/helps us suggest tutorials/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add child/i })).toHaveAttribute('href', '/dashboard/child/new')
  })

  it('renders one row per child, each linking to its edit page', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      child({ id: 'c1', name: 'Emma' }),
      child({ id: 'c2', name: null }),
    ])
    render(await ChildListPage())
    expect(screen.getByRole('link', { name: /Emma/ })).toHaveAttribute('href', '/dashboard/child/c1')
    expect(screen.getByRole('link', { name: /Child 2/ })).toHaveAttribute('href', '/dashboard/child/c2')
  })

  // Chain: swallowing a failed fetch into an empty list would tell a parent
  //        their children are gone. The page must fail loudly instead.
  it('throws rather than rendering an empty list when the fetch fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('network'))
    await expect(ChildListPage()).rejects.toThrow('network')
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd /Users/byronpetselis/Documents/splat-connect/packages/web && pnpm test:unit`

Expected: FAIL — the page still renders a single form.

- [ ] **Step 7: Write the list page**

Replace the whole of `packages/web/app/dashboard/child/page.tsx`:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { childLabel } from '@/lib/child-label'
import type { ChildProfile } from '@splat-connect/types'

export default async function ChildListPage() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  // No .catch() here: an empty array is already the legitimate "no children yet"
  // value, so swallowing a fetch failure into the same empty array would tell a
  // parent their children are gone. Let a failed fetch throw into error.tsx.
  const children = await apiClient.get<ChildProfile[]>('/api/child-profiles')

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-ink">Child profiles</h1>
      <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
        This helps us suggest tutorials that suit your child. Everything is optional
        and only you can see it.
      </p>

      <ul className="mb-6 flex max-w-5xl flex-col gap-3">
        {children.map((child, i) => (
          <li key={child.id}>
            <Link href={`/dashboard/child/${child.id}`} className="card flex items-center justify-between p-4">
              <span className="font-bold text-ink">{childLabel(child, i)}</span>
              <span className="text-sm text-muted">
                {[child.age !== null ? `Age ${child.age}` : null, child.primary_diagnosis]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Link href="/dashboard/child/new" className="btn btn-primary btn-sm">
        Add child
      </Link>
    </div>
  )
}
```

- [ ] **Step 8: Write the add-child page and its client wrapper**

Create `packages/web/components/new-child-form.tsx`:

```tsx
'use client'
/**
 * Create half of the child profile form. Exists because ChildProfileForm needs
 * an onSave from a client component, and the route that renders it is a server
 * component.
 */
import { useRouter } from 'next/navigation'
import { ChildProfileForm } from '@/components/child-profile-form'
import { browserApiClient } from '@/lib/browser-api-client'
import type { ChildProfile } from '@splat-connect/types'

export function NewChildForm() {
  const router = useRouter()

  return (
    <ChildProfileForm
      profile={null}
      onSave={async (form) => {
        await browserApiClient.post<ChildProfile>('/api/child-profiles', form)
        // refresh() so the list re-fetches on the server rather than showing a
        // cached page without the child that was just created.
        router.push('/dashboard/child')
        router.refresh()
      }}
    />
  )
}
```

Create `packages/web/app/dashboard/child/new/page.tsx`:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { NewChildForm } from '@/components/new-child-form'

export default async function NewChildPage() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  return (
    <div>
      <Link href="/dashboard/child" className="mb-4 inline-block text-sm text-muted">
        ← Child profiles
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-ink">Add child</h1>
      <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
        Everything is optional and only you can see it.
      </p>
      <NewChildForm />
    </div>
  )
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `cd /Users/byronpetselis/Documents/splat-connect/packages/web && pnpm typecheck && pnpm test:unit`

Expected: PASS. This also removes the temporary `onSave={async () => {}}` left in the page by Task 3.

- [ ] **Step 10: Commit**

```bash
git add packages/web/lib/child-label.ts packages/web/tests/unit/lib/child-label.test.ts
git commit -m "feat(web): add the Child N fallback label

Computed from list position rather than stored, so numbering stays
contiguous after a delete removes a child from the middle.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"

git add packages/web/app/dashboard/child/page.tsx packages/web/tests/unit/pages/dashboard-child-list.test.tsx
git commit -m "feat(web): turn the child profile tab into a list

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"

git add packages/web/app/dashboard/child/new/page.tsx packages/web/components/new-child-form.tsx
git commit -m "feat(web): add the add-child route

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Edit page and two-step delete

**Files:**
- Create: `packages/web/components/edit-child-form.tsx`
- Create: `packages/web/components/delete-child-button.tsx`
- Create: `packages/web/app/dashboard/child/[id]/page.tsx`
- Test: `packages/web/tests/unit/components/delete-child-button.test.tsx`
- Test: `packages/web/tests/unit/pages/dashboard-child-edit.test.tsx`

**Interfaces:**
- Consumes: `PATCH`/`DELETE /api/child-profiles/:id` (Task 2); `ChildProfileForm({ profile, onSave })` (Task 3); `childLabel` (Task 4).
- Produces: nothing later tasks depend on.

The delete deliberately departs from `components/edit-items-section.tsx:92` and `app/admin/contributors/page.tsx:57`, which both delete on first click. A child profile is a page of hand-entered data with no undo, unlike a parts row.

- [ ] **Step 1: Write the failing delete-button test**

Create `packages/web/tests/unit/components/delete-child-button.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DeleteChildButton } from '@/components/delete-child-button'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { delete: vi.fn() },
}))

import { browserApiClient } from '@/lib/browser-api-client'

describe('DeleteChildButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => vi.useRealTimers())

  // Chain: a child profile is a page of hand-entered data with no undo, so one
  //        misclick must not destroy it.
  it('does not delete on the first click', () => {
    render(<DeleteChildButton id="c1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete child profile' }))
    expect(browserApiClient.delete).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument()
  })

  it('deletes and returns to the list on the second click', async () => {
    vi.mocked(browserApiClient.delete).mockResolvedValue(null)
    render(<DeleteChildButton id="c1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete child profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
    await waitFor(() => expect(browserApiClient.delete).toHaveBeenCalledWith('/api/child-profiles/c1'))
    expect(push).toHaveBeenCalledWith('/dashboard/child')
  })

  // Chain: an armed button left armed is a trap for the next click on the page.
  it('disarms itself after 3 seconds', () => {
    render(<DeleteChildButton id="c1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete child profile' }))
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByRole('button', { name: 'Delete child profile' })).toBeInTheDocument()
  })

  it('reports a failed delete instead of pretending it worked', async () => {
    vi.mocked(browserApiClient.delete).mockRejectedValue(new Error('network'))
    render(<DeleteChildButton id="c1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete child profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete')
    expect(push).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/byronpetselis/Documents/splat-connect/packages/web && pnpm test:unit`

Expected: FAIL — `@/components/delete-child-button` does not exist.

- [ ] **Step 3: Write the delete button**

Create `packages/web/components/delete-child-button.tsx`:

```tsx
'use client'
/**
 * Two-step delete for a child profile.
 *
 * Deliberately unlike edit-items-section.tsx and admin/contributors, which both
 * delete on first click: a child profile is a page of hand-entered data with no
 * undo, and a parts row is not. Two clicks rather than a dialog component keeps
 * this to local state with nothing new to maintain.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { browserApiClient } from '@/lib/browser-api-client'

export function DeleteChildButton({ id }: { id: string }) {
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // An armed button left armed is a trap for whatever the user clicks next.
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  async function handleClick() {
    if (!armed) {
      setArmed(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await browserApiClient.delete(`/api/child-profiles/${id}`)
      router.push('/dashboard/child')
      router.refresh()
    } catch {
      setError('Could not delete this child profile. Please try again.')
      setBusy(false)
      setArmed(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={handleClick} disabled={busy} className="btn btn-danger btn-sm self-start">
        {busy ? 'Deleting…' : armed ? 'Confirm delete' : 'Delete child profile'}
      </button>
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
    </div>
  )
}
```

If `btn-danger` does not exist in `packages/web/app/globals.css`, use the same classes `app/admin/contributors/page.tsx:57` uses for its Delete button rather than inventing a token.

- [ ] **Step 4: Write the failing edit-page test**

Create `packages/web/tests/unit/pages/dashboard-child-edit.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EditChildPage from '@/app/dashboard/child/[id]/page'
import type { ChildProfile } from '@splat-connect/types'

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [],
    canAuthor: true,
    unreadNotifications: 0,
  }),
}))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

import { apiClient } from '@/lib/api-client'

const child = (over: Partial<ChildProfile>): ChildProfile => ({
  id: 'c1',
  parent_id: 'u1',
  name: null,
  age: null,
  primary_diagnosis: null,
  macs_level: null,
  macs_source: 'manual',
  hand_involvement: null,
  assist_hand: null,
  bfmf_score: null,
  bfmf_source: 'manual',
  challenges: [],
  challenge_other: null,
  grip_type: null,
  env_context: null,
  palm_width_mm: null,
  wrist_circ_mm: null,
  needs_arm_attachment: false,
  forearm_length_mm: null,
  hand_dominance: null,
  sensory_preferences: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
})

describe('EditChildPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('seeds the form from the requested child', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([child({ id: 'c1', name: 'Emma', age: 7 })])
    render(await EditChildPage({ params: Promise.resolve({ id: 'c1' }) }))
    expect(screen.getByLabelText('Name (optional)')).toHaveValue('Emma')
    expect(screen.getByLabelText('Age')).toHaveValue(7)
  })

  // Chain: the heading has to agree with the list, and the list numbers unnamed
  //        children by position.
  it('heads an unnamed child with its position, matching the list', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([child({ id: 'c1' }), child({ id: 'c2' })])
    render(await EditChildPage({ params: Promise.resolve({ id: 'c2' }) }))
    expect(screen.getByRole('heading', { name: 'Child 2' })).toBeInTheDocument()
  })

  it('404s on a child that is not the caller\'s', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([child({ id: 'c1' })])
    await expect(EditChildPage({ params: Promise.resolve({ id: 'someone-elses' }) })).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
```

- [ ] **Step 5: Run it to verify it fails**

Run: `cd /Users/byronpetselis/Documents/splat-connect/packages/web && pnpm test:unit`

Expected: FAIL — `@/app/dashboard/child/[id]/page` does not exist.

- [ ] **Step 6: Write the edit form wrapper and the page**

Create `packages/web/components/edit-child-form.tsx`:

```tsx
'use client'
/**
 * Edit half of the child profile form. Stays on the page after a save — unlike
 * the create path, there is nowhere better to go — and calls refresh() so the
 * heading picks up a newly entered name.
 */
import { useRouter } from 'next/navigation'
import { ChildProfileForm } from '@/components/child-profile-form'
import { browserApiClient } from '@/lib/browser-api-client'
import type { ChildProfile } from '@splat-connect/types'

export function EditChildForm({ child }: { child: ChildProfile }) {
  const router = useRouter()

  return (
    <ChildProfileForm
      profile={child}
      onSave={async (form) => {
        await browserApiClient.patch<ChildProfile>(`/api/child-profiles/${child.id}`, form)
        router.refresh()
      }}
    />
  )
}
```

Create `packages/web/app/dashboard/child/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { childLabel } from '@/lib/child-label'
import { EditChildForm } from '@/components/edit-child-form'
import { DeleteChildButton } from '@/components/delete-child-button'
import type { ChildProfile } from '@splat-connect/types'

export default async function EditChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  // Reads the collection rather than one row: the heading labels an unnamed
  // child by its position among its siblings, which a single-row fetch cannot
  // tell us. RLS scopes the list to the caller, so a child missing from it is
  // either gone or someone else's — 404 either way.
  const children = await apiClient.get<ChildProfile[]>('/api/child-profiles')
  const index = children.findIndex((c) => c.id === id)
  if (index === -1) notFound()
  const child = children[index]

  return (
    <div>
      <Link href="/dashboard/child" className="mb-4 inline-block text-sm text-muted">
        ← Child profiles
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-ink">{childLabel(child, index)}</h1>
      <EditChildForm child={child} />
      <div className="mt-8">
        <DeleteChildButton id={child.id} />
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd /Users/byronpetselis/Documents/splat-connect/packages/web && pnpm typecheck && pnpm test:unit`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/web/components/delete-child-button.tsx packages/web/tests/unit/components/delete-child-button.test.tsx
git commit -m "feat(web): add a two-step delete for child profiles

Unlike the codebase's other deletes, which fire on first click: a child
profile is hand-entered data with no undo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"

git add packages/web/components/edit-child-form.tsx packages/web/app/dashboard/child/\[id\]/page.tsx packages/web/tests/unit/pages/dashboard-child-edit.test.tsx
git commit -m "feat(web): add the per-child edit route

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Rename the nav row

**Files:**
- Modify: `packages/web/lib/nav-model.ts:75`
- Test: `packages/web/tests/unit/lib/nav-model.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the nav label `'Child profiles'`. Task 8's e2e selectors depend on it.

- [ ] **Step 1: Write the failing test**

In `packages/web/tests/unit/lib/nav-model.test.ts`, replace the existing `'shows Child profile to accounts that are not yet parents'` test with:

```ts
  // Chain: gating Child profiles on parenthood would mean the only way to create
  //        a child profile is to already have one. Capabilities no longer even
  //        carries an isParent flag, precisely because nothing may branch on it.
  it('shows Child profiles to accounts that are not yet parents', () => {
    expect(hrefs(buildNav(caps(), 0))).toContain('/dashboard/child')
  })

  it('labels the row for more than one child', () => {
    const labels = buildNav(caps(), 0).flatMap((g) => g.rows).map((r) => r.label)
    expect(labels).toContain('Child profiles')
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/byronpetselis/Documents/splat-connect/packages/web && pnpm test:unit`

Expected: FAIL — the label is still `'Child profile'`.

- [ ] **Step 3: Rename the label**

In `packages/web/lib/nav-model.ts` line 75, change:

```ts
        { href: '/dashboard/child', label: 'Child profile', icon: 'child' },
```

to:

```ts
        { href: '/dashboard/child', label: 'Child profiles', icon: 'child' },
```

Leave the `href` and the comment above it unchanged — "Shown to non-parents too: filling it in is what makes them a parent" is still accurate.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd /Users/byronpetselis/Documents/splat-connect/packages/web && pnpm test:unit`

Expected: PASS.

`packages/web/tests/unit/components/rail.test.tsx:24` also contains the string `'Child profile'`, but as its own local fixture rather than a read of `nav-model.ts`. It does not need to change and must not be "fixed" in passing.

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/nav-model.ts packages/web/tests/unit/lib/nav-model.test.ts
git commit -m "feat(web): rename the nav row to Child profiles

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Migrate the mobile hook

**Files:**
- Modify: `packages/mobile/lib/use-child-profile.ts`
- Test: `packages/mobile/tests/unit/lib/use-child-profile.test.tsx`

**Interfaces:**
- Consumes: `GET`/`POST /api/child-profiles`, `PATCH /api/child-profiles/:id` (Task 2).
- Produces: `useChildProfile()` returning `{ profile, loading, save, saveState }` — unchanged, so no mobile screen needs editing.

This is not a URL swap. The old `PUT` was an upsert, so create and update were one idempotent call and concurrency did not matter. Split into POST-then-PATCH, two hazards appear:

1. A save fired before the mount GET resolves would POST — creating a second child while the first exists.
2. Two saves racing before the first POST returns would each POST.

Both are fixed by queueing every write on one promise chain that starts as the mount load.

`packages/mobile/AGENTS.md` requires reading https://docs.expo.dev/versions/v57.0.0/ before writing mobile code. This task touches only React hooks and `fetch` wrappers, no Expo API.

- [ ] **Step 1: Write the failing tests**

In `packages/mobile/tests/unit/lib/use-child-profile.test.tsx`, replace the mock block at the top:

```tsx
const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
  },
}))
```

Then replace the whole `describe` body with:

```tsx
describe('useChildProfile', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers() })
  afterEach(() => jest.useRealTimers())

  // Mobile shows one child. The collection is ordered oldest-first by the API,
  // so the first entry is that child.
  it('loads the first child on mount', async () => {
    mockGet.mockResolvedValue([{ id: 'cp1', age: 5 }, { id: 'cp2', age: 9 }])
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.profile?.age).toBe(5))
    expect(mockGet).toHaveBeenCalledWith('/api/child-profiles')
  })

  it('save merges optimistically and debounces one PATCH', async () => {
    mockGet.mockResolvedValue([{ id: 'cp1', age: 1 }])
    mockPatch.mockResolvedValue({})
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.save({ age: 7 }); result.current.save({ macs_level: 'II' }) })
    expect(result.current.profile).toMatchObject({ age: 7, macs_level: 'II' }) // optimistic
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPatch).toHaveBeenCalledTimes(1) // debounced
    expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', expect.objectContaining({ age: 7, macs_level: 'II' }))
    expect(mockPost).not.toHaveBeenCalled()
    expect(result.current.saveState).toBe('saved') // confirmed to the user
  })

  it('POSTs the first save when the account has no child yet', async () => {
    mockGet.mockResolvedValue([])
    mockPost.mockResolvedValue({ id: 'new1', age: 7 })
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.save({ age: 7 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPost).toHaveBeenCalledWith('/api/child-profiles', expect.objectContaining({ age: 7 }))
    expect(result.current.saveState).toBe('saved')
  })

  // Chain: the old PUT was an upsert, so a repeat save was harmless. POST is not
  //        idempotent — without the id from the first response, the second save
  //        would create a second child.
  it('PATCHes the child the first save created rather than POSTing again', async () => {
    mockGet.mockResolvedValue([])
    mockPost.mockResolvedValue({ id: 'new1', age: 7 })
    mockPatch.mockResolvedValue({})
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.save({ age: 7 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    act(() => { result.current.save({ age: 8 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/new1', expect.objectContaining({ age: 8 }))
  })

  it('falls back to a null profile when the initial load fails', async () => {
    mockGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.profile).toBeNull()
  })

  it('keeps the optimistic value when the write fails', async () => {
    mockGet.mockResolvedValue([{ id: 'cp1' }])
    mockPatch.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.save({ age: 9 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPatch).toHaveBeenCalledTimes(1)
    expect(result.current.profile).toMatchObject({ age: 9 }) // optimistic value survives a failed save
    expect(result.current.saveState).toBe('idle') // never a false "saved" on failure
  })

  it('does not let a slow initial load clobber an edit made before it resolves', async () => {
    let resolveGet: (v: unknown) => void = () => {}
    mockGet.mockReturnValue(new Promise((r) => { resolveGet = r }))
    const { result } = renderHook(() => useChildProfile())
    // User edits before the mount GET has resolved.
    act(() => { result.current.save({ age: 5 }) })
    expect(result.current.profile).toMatchObject({ age: 5 })
    // The (now stale) initial load resolves with server data.
    await act(async () => { resolveGet([{ id: 'cp1', age: 99 }]) })
    // The in-progress edit must win — the load must not overwrite it.
    expect(result.current.profile).toMatchObject({ age: 5 })
  })

  // Chain: without queueing writes behind the load, a save fired mid-load has no
  //        id yet and would POST a second child alongside the one being loaded.
  it('waits for the load before writing, so an early save patches rather than duplicates', async () => {
    let resolveGet: (v: unknown) => void = () => {}
    mockGet.mockReturnValue(new Promise((r) => { resolveGet = r }))
    mockPatch.mockResolvedValue({})
    const { result } = renderHook(() => useChildProfile())
    act(() => { result.current.save({ age: 5 }) })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPost).not.toHaveBeenCalled()
    await act(async () => { resolveGet([{ id: 'cp1', age: 99 }]) })
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', expect.objectContaining({ age: 5 })))
    expect(mockPost).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/byronpetselis/Documents/splat-connect/packages/mobile && pnpm test:unit`

Expected: FAIL — the hook still calls `/api/child-profile` and `apiClient.put`.

- [ ] **Step 3: Rewrite the hook**

Replace the body of `packages/mobile/lib/use-child-profile.ts` below the imports:

```ts
export type SaveState = 'idle' | 'saving' | 'saved'

export function useChildProfile() {
  const [profile, setProfile] = useState<ChildProfile | null>(null)
  const [loading, setLoading] = useState(true)
  // Surfaced so the screen can confirm the silent autosave actually persisted —
  // on a field holding a child's data, "did that save?" should not be a guess.
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const pending = useRef<Partial<ChildProfile>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Once the user edits, the in-flight mount load must not clobber their work
  // (a slow GET resolving after the first keystroke would otherwise win).
  const dirty = useRef(false)
  // Which child this screen is editing. Mobile shows one child; the API orders
  // the collection oldest-first, so that is the first entry.
  const id = useRef<string | null>(null)
  // Every write queues here. The old endpoint was an upsert, so repeats were
  // harmless; POST is not idempotent, so two saves racing before the first
  // response lands would create two children. Serialising them means the second
  // always sees the id the first established. Initialised to the mount load for
  // the same reason: a save fired mid-load must not POST alongside it.
  const writes = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    let ignore = false
    const load = apiClient
      .get<ChildProfile[]>('/api/child-profiles')
      .then((list) => {
        if (ignore) return
        const first = list?.[0] ?? null
        // Set even when the user has already started editing: without the id a
        // queued save would POST a duplicate instead of patching this child.
        id.current = first?.id ?? null
        if (!dirty.current) setProfile(first)
      })
      .catch(() => { if (!ignore && !dirty.current) setProfile(null) })
      .finally(() => { if (!ignore) setLoading(false) })
    writes.current = load
    return () => { ignore = true }
  }, [])

  function save(patch: Partial<ChildProfile>) {
    dirty.current = true
    setProfile((prev) => ({ ...(prev ?? {}), ...patch } as ChildProfile)) // optimistic
    pending.current = { ...pending.current, ...patch }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const body = pending.current
      pending.current = {}
      setSaveState('saving')
      writes.current = writes.current
        .then(async () => {
          if (id.current) {
            await apiClient.patch<ChildProfile>(`/api/child-profiles/${id.current}`, body)
          } else {
            const created = await apiClient.post<ChildProfile>('/api/child-profiles', body)
            id.current = created.id
          }
          setSaveState('saved')
        })
        // Back to idle rather than a false "saved" — never claim a write landed
        // when it didn't. The value stays on screen (optimistic) to retype/retry.
        // Swallowing here also keeps the chain resolved so later writes still run.
        .catch(() => setSaveState('idle'))
    }, 250)
  }

  return { profile, loading, save, saveState }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/byronpetselis/Documents/splat-connect/packages/mobile && pnpm typecheck && pnpm test:unit`

Expected: PASS — including the four other mobile test files that mock the hook wholesale and should be unaffected.

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/lib/use-child-profile.ts
git commit -m "refactor(mobile): read the child profile from the collection API

The singleton endpoints could not survive dropping the unique parent_id
constraint: the PUT upserted on that conflict target and the GET used
maybeSingle. Mobile still shows one child, now through the collection.

Serialises writes because POST is not the upsert it replaced — two saves
racing before the first response would otherwise create two children.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"

git add packages/mobile/tests/unit/lib/use-child-profile.test.tsx
git commit -m "test(mobile): cover the collection API and write serialisation

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: E2E flow and full verification

**Files:**
- Modify: `packages/web/tests/e2e/dashboard/shell.spec.ts:37,126-151,241`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

The existing test at line 126 walks the old single-form flow, which no longer exists. It becomes the list → add → edit → delete journey.

- [ ] **Step 1: Update the nav label selectors**

In `packages/web/tests/e2e/dashboard/shell.spec.ts`, change the three `'Child profile'` selectors to `'Child profiles'`:
- line 37: `await expect(page.getByRole('link', { name: 'Child profile', exact: true })).toBeVisible()`
- line 136: `await page.getByRole('link', { name: 'Child profile', exact: true }).click()`
- line 241: `await drawer.getByRole('link', { name: 'Child profile', exact: true }).click()`

- [ ] **Step 2: Rewrite the child-profile journey**

Replace the whole test starting at line 126 (`test('a contributor with no child profile creates one from the Child profile tab...`) through its closing `})` with:

```ts
test('a contributor adds two children, edits one, and deletes one', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    await page.getByRole('link', { name: 'Child profiles', exact: true }).click()
    await expect(page).toHaveURL('/dashboard/child')

    // First child, named.
    await page.getByRole('link', { name: 'Add child' }).click()
    await expect(page).toHaveURL('/dashboard/child/new')
    await page.locator('#name').fill('Emma')
    await page.locator('#age').fill('7')
    await page.locator('#primary_diagnosis').fill('Cerebral palsy')
    await page.locator('#macs_level').selectOption('II')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/dashboard/child')
    await expect(page.getByRole('link', { name: /Emma/ })).toBeVisible()

    // Second child, left unnamed — the list must still tell them apart.
    await page.getByRole('link', { name: 'Add child' }).click()
    await page.locator('#age').fill('4')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/dashboard/child')
    await expect(page.getByRole('link', { name: /Child 2/ })).toBeVisible()

    // Edit the first child and confirm it persists across a reload.
    await page.getByRole('link', { name: /Emma/ }).click()
    await expect(page.locator('#age')).toHaveValue('7')
    await expect(page.locator('#macs_level')).toHaveValue('II')
    await page.locator('#age').fill('8')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved')).toBeVisible()
    await page.reload()
    await expect(page.locator('#age')).toHaveValue('8')

    // Delete takes two clicks.
    await page.getByRole('button', { name: 'Delete child profile' }).click()
    await page.getByRole('button', { name: 'Confirm delete' }).click()
    await expect(page).toHaveURL('/dashboard/child')
    await expect(page.getByRole('link', { name: /Emma/ })).toHaveCount(0)
    // The survivor renumbers, because position is computed and not stored.
    await expect(page.getByRole('link', { name: /Child 1/ })).toBeVisible()
  } finally {
    await deleteUser(contributor.id)
  }
})
```

- [ ] **Step 3: Run the e2e suite**

Run: `cd /Users/byronpetselis/Documents/splat-connect/packages/web && pnpm test:e2e`

Expected: PASS.

Before running: shut down any Android emulator. It can bind Supabase's ports on `::1` and make Playwright fail in ways that look like application bugs. E2E owns ports 3102-3105 and will not disturb the dev servers on 3100/3101.

If a large number of tests fail with profile-listing or auth errors, check whether leaked fixture profiles have pushed the table past PostgREST's 1000-row `max_rows` — that is a known way for this suite to fail for reasons unrelated to the change under test.

- [ ] **Step 4: Verify every touched package**

Run each of these and confirm all pass:

```bash
cd /Users/byronpetselis/Documents/splat-connect && pnpm typecheck
cd /Users/byronpetselis/Documents/splat-connect/packages/api && pnpm test:unit && pnpm test:integration
cd /Users/byronpetselis/Documents/splat-connect/packages/web && pnpm test:unit
cd /Users/byronpetselis/Documents/splat-connect/packages/mobile && pnpm test:unit
```

Run all of them even if only one package looks affected. Vitest transpiles without typechecking, so a type error can hide from the unit suites entirely and only `pnpm typecheck` will catch it.

- [ ] **Step 5: Commit**

```bash
git add packages/web/tests/e2e/dashboard/shell.spec.ts
git commit -m "test(web): walk the multi-child journey end to end

Adds two children, edits one, deletes it, and asserts the survivor
renumbers — the behaviour that distinguishes a computed position label
from a stored one.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Refresh the knowledge graph**

Run: `cd /Users/byronpetselis/Documents/splat-connect && graphify update .`

This is AST-only and costs nothing. `CLAUDE.md` requires it after modifying code.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Drop unique constraint, add `name`, `created_at`, delete policy | 1 |
| `ChildProfile` gains the two fields | 1 |
| Collection endpoints + `EDITABLE` whitelist + RLS boundary | 2 |
| `name` input, `onSave` prop, stale header comment | 3 |
| List page, empty state, no `.catch()`, "Child N" label | 4 |
| Add-child route | 4 |
| Edit route | 5 |
| Two-step delete, 3-second disarm | 5 |
| Nav label rename | 6 |
| Mobile hook migration, unchanged return shape | 7 |
| API integration tests incl. RLS boundary | 2 |
| Web unit tests for list, label, form, delete | 3, 4, 5 |
| Mobile unit tests | 7 |
| Every touched package typechecked and tested | 8 |

Spec's `GET /api/child-profiles/:id` is intentionally absent — see "Deviations" above.

**Placeholder scan:** none. Every step carries its own code or command. Two steps carry a conditional ("if `btn-danger` does not exist, use what admin/contributors uses"; "match the Age input's className"), each naming the exact file to copy from rather than leaving the choice open.

**Type consistency:** `childLabel(child, index)` is defined in Task 4 and consumed in Task 5 with the same signature. `ChildProfileForm({ profile, onSave })` is defined in Task 3 and consumed in Tasks 4 and 5. `useChildProfile()` returns `{ profile, loading, save, saveState }` before and after Task 7. The route file is `child-profiles.ts` (plural) in every reference after Task 2.
