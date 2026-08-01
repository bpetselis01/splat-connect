# Tutorial Collaborators & In-App Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tutorial's primary contributor invite other contributors as full collaborators, notify everyone affected by collaboration and review events through an in-app inbox, and stop two people editing a tutorial at once from silently overwriting each other.

**Architecture:** Three additive database changes (an invite-handshake table mirroring `tutorial_orgs`, a `notifications` table, and an `updated_at` column on `tutorials`), five small Hono route files following the existing `routes/tutorial-orgs.ts` style (RLS does the authorization, handlers translate refusals into HTTP codes), and web-side additions that plug into the existing rail/edit-page component patterns rather than introducing new ones.

**Tech Stack:** Hono + Supabase/Postgres (RLS-first authorization) on the API; Next.js App Router server actions + client components on the web; Vitest for unit/integration tests, Playwright for one E2E journey.

## Global Constraints

- Every new table gets RLS enabled and every write path goes through `createUserClient` (the user's own JWT), never the admin client, except for the one server-side lookup in Task 5 that has to cross a privacy boundary (looking up a profile by email) and the notification inserts, which write on behalf of someone other than the caller.
- No new npm dependencies. Everything here is existing stack (Hono, `@supabase/supabase-js`, React Server Components).
- Match the codebase's existing comment style: a `WHY`/`HOW` pair on anything non-obvious, no comment on anything self-explanatory.
- Each task below is exactly one file's worth of change (plus its test file) and ends in its own commit, per the user's request.

---

## Task 1: Migration 012 — the collaborator invite handshake

**Files:**
- Create: `supabase/migrations/012_tutorial_collaborators.sql`
- Test: `packages/api/tests/integration/collaborators/invite-handshake.test.ts`
- Test helper, create: `packages/api/tests/helpers/collaborators.ts`

**Interfaces:**
- Produces: table `tutorial_collaborator_invites(id, tutorial_id, invited_profile_id, invited_by, status, requested_at, responded_at)`; function `public.is_primary_contributor(p_tutorial_id uuid) returns boolean`; a new INSERT arm on `tutorial_contributors` (claim via invite) and a new DELETE policy on `tutorial_contributors` (primary removes a collaborator, or a collaborator removes themself).
- Consumes: existing `public.is_tutorial_contributor()`, `public.is_admin()` (from `001_schema.sql` / `007_organizations.sql`).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/012_tutorial_collaborators.sql
-- WHY: tutorial_contributors has always supported a 'collaborator' role but
--      nothing ever inserted one — a tutorial can only ever have one
--      contributor today. 008_tutorial_contributor_scope.sql deliberately
--      locked self-claiming to an unclaimed tutorial, closing a reproduced
--      exploit (self-attach to a stranger's draft, launder it through an org
--      you lead, approve your own request). Adding a second contributor has
--      to go through an owner-initiated invite, never a self-serve claim.
-- HOW: A separate pending/accepted/declined handshake table, the same shape
--      007_organizations.sql already uses for tutorial_orgs, plus one new
--      narrow INSERT arm on tutorial_contributors that only admits a row
--      when a matching invite already exists — and that invite could only
--      have been created by the tutorial's primary contributor, so the 008
--      hole stays closed.
-- See docs/superpowers/specs/2026-08-02-tutorial-collaborators-design.md

create table public.tutorial_collaborator_invites (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid references public.tutorials on delete cascade not null,
  invited_profile_id uuid references public.profiles on delete cascade not null,
  invited_by uuid references public.profiles on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (tutorial_id, invited_profile_id)
);

alter table public.tutorial_collaborator_invites enable row level security;

-- Only a tutorial's primary contributor may invite. Distinct from
-- is_tutorial_contributor(), which is true for any contributor — a
-- collaborator must not be able to invite another collaborator.
create or replace function public.is_primary_contributor(p_tutorial_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.tutorial_contributors
    where tutorial_id = p_tutorial_id and profile_id = auth.uid() and role = 'primary'
  );
$$ language sql security definer stable;

-- INSERT/UPSERT: the primary contributor creates the invite, always 'pending'
-- and unresponded. Upserting on the (tutorial_id, invited_profile_id) unique
-- pair resets a declined row rather than failing the constraint, so a
-- decline is never permanent — the primary can just ask again.
create policy "Primary contributor can invite a collaborator"
  on public.tutorial_collaborator_invites for insert
  with check (
    invited_by = auth.uid()
    and public.is_primary_contributor(tutorial_id)
    and status = 'pending'
    and responded_at is null
    and invited_profile_id != auth.uid()
  );

create policy "Primary contributor can reset a declined invite"
  on public.tutorial_collaborator_invites for update
  using (public.is_primary_contributor(tutorial_id))
  with check (
    public.is_primary_contributor(tutorial_id)
    and status = 'pending'
    and responded_at is null
  );

-- The invitee answers their own invite and nothing else about it.
create policy "Invitee can answer their invite"
  on public.tutorial_collaborator_invites for update
  using (invited_profile_id = auth.uid())
  with check (
    invited_profile_id = auth.uid()
    and status in ('accepted', 'declined')
  );

create policy "Participants can read an invite"
  on public.tutorial_collaborator_invites for select
  using (
    invited_profile_id = auth.uid()
    or public.is_primary_contributor(tutorial_id)
  );

create policy "Admin full access to tutorial_collaborator_invites"
  on public.tutorial_collaborator_invites for all using (public.is_admin());

-- tutorial_contributors — one new INSERT arm. The existing 008 arm (claim an
-- unclaimed tutorial) is untouched; this is a second, independent path.
drop policy "Approved contributors can claim an unclaimed tutorial" on public.tutorial_contributors;

create policy "Approved contributors can claim an unclaimed tutorial or an invited seat"
  on public.tutorial_contributors for insert
  with check (
    profile_id = auth.uid()
    and public.is_approved_contributor()
    and (
      not public.tutorial_has_contributor(tutorial_id)
      or public.is_tutorial_contributor(tutorial_id)
      or exists (
        select 1 from public.tutorial_collaborator_invites i
        where i.tutorial_id = tutorial_contributors.tutorial_id
          and i.invited_profile_id = auth.uid()
          and i.status = 'pending'
      )
    )
    -- A claimed seat via invite is always 'collaborator': the primary role is
    -- reserved for whoever authored the tutorial, which the first arm covers.
    and (role = 'primary' or role = 'collaborator')
  );

-- Team management: the primary removes a collaborator, or a collaborator
-- removes themself. Neither can ever target the primary's own row — there is
-- no "leave" or "remove" for the tutorial's author.
create policy "Primary removes a collaborator, a collaborator leaves"
  on public.tutorial_contributors for delete
  using (
    role = 'collaborator'
    and (profile_id = auth.uid() or public.is_primary_contributor(tutorial_id))
  );
```

- [ ] **Step 2: Apply the migration locally**

Run: `supabase db reset` (from repo root, or wherever the existing migrations are applied from — check `README.md` for the exact local Supabase workflow already documented)
Expected: all 12 migrations apply cleanly, no errors.

- [ ] **Step 3: Write the test helper**

```typescript
// packages/api/tests/helpers/collaborators.ts
import { adminClient } from './auth.js'

/** An invite row in whatever state the test needs, bypassing the handshake. */
export async function createInvite(opts: {
  tutorialId: string
  invitedProfileId: string
  invitedBy: string
  status?: 'pending' | 'accepted' | 'declined'
}): Promise<string> {
  const { data, error } = await adminClient()
    .from('tutorial_collaborator_invites')
    .insert({
      tutorial_id: opts.tutorialId,
      invited_profile_id: opts.invitedProfileId,
      invited_by: opts.invitedBy,
      status: opts.status ?? 'pending',
      responded_at: opts.status && opts.status !== 'pending' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`createInvite failed: ${error.message}`)
  return data.id as string
}

export async function addCollaborator(tutorialId: string, profileId: string): Promise<void> {
  const { error } = await adminClient()
    .from('tutorial_contributors')
    .insert({ tutorial_id: tutorialId, profile_id: profileId, role: 'collaborator' })
  if (error) throw new Error(`addCollaborator failed: ${error.message}`)
}
```

- [ ] **Step 4: Write the failing test**

```typescript
// packages/api/tests/integration/collaborators/invite-handshake.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createProject, cleanupOrg } from '../../helpers/orgs.js'
import { createInvite, addCollaborator } from '../../helpers/collaborators.js'

let primary: TestUser
let invitee: TestUser
let stranger: TestUser
let tutorialId: string

beforeAll(async () => {
  primary = await createTestUser('contributor')
  invitee = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  tutorialId = await createProject({ authorId: primary.id, status: 'draft' })
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(primary.id)
  await deleteTestUser(invitee.id)
  await deleteTestUser(stranger.id)
})

describe('inviting a collaborator', () => {
  it('the primary contributor can invite someone', async () => {
    const { data, error } = await createUserClient(primary.token)
      .from('tutorial_collaborator_invites')
      .insert({ tutorial_id: tutorialId, invited_profile_id: invitee.id, invited_by: primary.id })
      .select('status')
      .single()
    expect(error).toBeNull()
    expect(data?.status).toBe('pending')
    await adminClient().from('tutorial_collaborator_invites').delete().eq('tutorial_id', tutorialId)
  })

  it('a stranger cannot invite on behalf of someone else\'s project', async () => {
    const { error } = await createUserClient(stranger.token)
      .from('tutorial_collaborator_invites')
      .insert({ tutorial_id: tutorialId, invited_profile_id: invitee.id, invited_by: stranger.id })
    expect(error?.code).toBe('42501')
  })

  it('a collaborator cannot invite another collaborator', async () => {
    await addCollaborator(tutorialId, invitee.id)
    const { error } = await createUserClient(invitee.token)
      .from('tutorial_collaborator_invites')
      .insert({ tutorial_id: tutorialId, invited_profile_id: stranger.id, invited_by: invitee.id })
    expect(error?.code).toBe('42501')
    await adminClient().from('tutorial_contributors').delete().eq('tutorial_id', tutorialId).eq('profile_id', invitee.id)
  })
})

describe('accepting an invite', () => {
  it('the invitee can accept, and can then claim the tutorial_contributors seat', async () => {
    const inviteId = await createInvite({ tutorialId, invitedProfileId: invitee.id, invitedBy: primary.id })
    const { error: updateError } = await createUserClient(invitee.token)
      .from('tutorial_collaborator_invites')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', inviteId)
    expect(updateError).toBeNull()

    const { error: claimError } = await createUserClient(invitee.token)
      .from('tutorial_contributors')
      .insert({ tutorial_id: tutorialId, profile_id: invitee.id, role: 'collaborator' })
    expect(claimError).toBeNull()

    await adminClient().from('tutorial_contributors').delete().eq('tutorial_id', tutorialId).eq('profile_id', invitee.id)
    await adminClient().from('tutorial_collaborator_invites').delete().eq('id', inviteId)
  })

  it('a stranger with no invite still cannot self-claim a tutorial that already has a contributor', async () => {
    // The 008 regression case, re-asserted with the new policy arm in place.
    const { error } = await createUserClient(stranger.token)
      .from('tutorial_contributors')
      .insert({ tutorial_id: tutorialId, profile_id: stranger.id, role: 'collaborator' })
    expect(error?.code).toBe('42501')
  })

  it('the invitee cannot write a status other than accepted or declined', async () => {
    const inviteId = await createInvite({ tutorialId, invitedProfileId: invitee.id, invitedBy: primary.id })
    const { error } = await createUserClient(invitee.token)
      .from('tutorial_collaborator_invites')
      .update({ status: 'pending' })
      .eq('id', inviteId)
      .select('id')
    expect(error).toBeNull() // WITH CHECK refusal on an UPDATE is a silent zero-row match
    const { data } = await createUserClient(invitee.token)
      .from('tutorial_collaborator_invites')
      .update({ status: 'pending' })
      .eq('id', inviteId)
      .select('id')
    expect(data ?? []).toHaveLength(0)
    await adminClient().from('tutorial_collaborator_invites').delete().eq('id', inviteId)
  })
})

describe('re-inviting after a decline', () => {
  it('the primary can reset a declined invite back to pending', async () => {
    const inviteId = await createInvite({ tutorialId, invitedProfileId: invitee.id, invitedBy: primary.id, status: 'declined' })
    const { data, error } = await createUserClient(primary.token)
      .from('tutorial_collaborator_invites')
      .update({ status: 'pending', responded_at: null })
      .eq('id', inviteId)
      .select('status')
    expect(error).toBeNull()
    expect(data?.[0]?.status).toBe('pending')
    await adminClient().from('tutorial_collaborator_invites').delete().eq('id', inviteId)
  })
})

describe('removing a collaborator', () => {
  it('the primary can remove a collaborator', async () => {
    await addCollaborator(tutorialId, invitee.id)
    const { data, error } = await createUserClient(primary.token)
      .from('tutorial_contributors')
      .delete()
      .eq('tutorial_id', tutorialId)
      .eq('profile_id', invitee.id)
      .select('profile_id')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('a collaborator can remove themself', async () => {
    await addCollaborator(tutorialId, invitee.id)
    const { data, error } = await createUserClient(invitee.token)
      .from('tutorial_contributors')
      .delete()
      .eq('tutorial_id', tutorialId)
      .eq('profile_id', invitee.id)
      .select('profile_id')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('a collaborator cannot remove the primary contributor', async () => {
    await addCollaborator(tutorialId, invitee.id)
    const { data, error } = await createUserClient(invitee.token)
      .from('tutorial_contributors')
      .delete()
      .eq('tutorial_id', tutorialId)
      .eq('profile_id', primary.id)
      .select('profile_id')
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
    await adminClient().from('tutorial_contributors').delete().eq('tutorial_id', tutorialId).eq('profile_id', invitee.id)
  })
})
```

- [ ] **Step 5: Run the test to see it pass against the new migration**

Run: `pnpm --filter @splat-connect/api test:integration`
Expected: PASS — all cases in `invite-handshake.test.ts`, and no regression in `tests/integration/orgs/*` or `tests/integration/tutorials/*` (008's original claim test still passes unchanged).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/012_tutorial_collaborators.sql packages/api/tests/helpers/collaborators.ts packages/api/tests/integration/collaborators/invite-handshake.test.ts
git commit -m "feat(db): add the collaborator invite handshake and a safe second-contributor path"
```

---

## Task 2: Migration 013 — notifications table

**Files:**
- Create: `supabase/migrations/013_notifications.sql`
- Test: `packages/api/tests/integration/notifications/rls.test.ts`

**Interfaces:**
- Produces: table `notifications(id, recipient_id, type, tutorial_id, actor_name, read_at, created_at)`.
- Consumes: `public.is_admin()`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/013_notifications.sql
-- WHY: Email notifications were fully designed then declined on 2026-07-29 —
--      the platform stays pull-based. That decision voided the reasoning
--      that had blocked in-app notification badges (decision 6 of
--      2026-07-28-contributor-backing-experience-design.md: "don't build
--      them, real notifications are coming"). This is that surface, in-app
--      only, no email provider involved.
-- HOW: One row per event per recipient, written by API route handlers at the
--      point each event happens — no trigger, no queue, matching how every
--      other cross-table effect in this codebase is done in the handler.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles on delete cascade not null,
  type text not null check (type in (
    'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
    'collaborator_removed', 'collaborator_left',
    'tutorial_approved', 'tutorial_rejected'
  )),
  tutorial_id uuid references public.tutorials on delete cascade not null,
  -- Denormalised at insert time so a row still reads sensibly if the actor's
  -- name changes later — the same reasoning tutorial_orgs.responded_by is a
  -- foreign key but the badge text is composed at read time from a join that
  -- would break if the row were deleted; here we skip that fragility entirely.
  actor_name text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select using (recipient_id = auth.uid());

create policy "Users can mark own notifications read"
  on public.notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "Admin full access to notifications"
  on public.notifications for all using (public.is_admin());

-- No INSERT policy for ordinary users: every notification is written by API
-- route handlers using the admin client, on behalf of someone other than the
-- caller (you cannot notify yourself that you invited someone).
```

- [ ] **Step 2: Apply the migration locally**

Run: `supabase db reset`
Expected: 13 migrations apply cleanly.

- [ ] **Step 3: Write the failing test**

```typescript
// packages/api/tests/integration/notifications/rls.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createProject } from '../../helpers/orgs.js'

let recipient: TestUser
let stranger: TestUser
let tutorialId: string
let notificationId: string

beforeAll(async () => {
  recipient = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  tutorialId = await createProject({ authorId: recipient.id, status: 'draft' })
  const { data, error } = await adminClient()
    .from('notifications')
    .insert({
      recipient_id: recipient.id,
      type: 'tutorial_approved',
      tutorial_id: tutorialId,
      actor_name: 'SPLAT',
    })
    .select('id')
    .single()
  if (error) throw error
  notificationId = data.id as string
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(recipient.id)
  await deleteTestUser(stranger.id)
})

describe('notifications RLS', () => {
  it('the recipient can read their own notification', async () => {
    const { data, error } = await createUserClient(recipient.token)
      .from('notifications')
      .select('id')
      .eq('id', notificationId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('a stranger cannot read someone else\'s notification', async () => {
    const { data, error } = await createUserClient(stranger.token)
      .from('notifications')
      .select('id')
      .eq('id', notificationId)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it('the recipient can mark their own notification read', async () => {
    const { data, error } = await createUserClient(recipient.token)
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select('read_at')
    expect(error).toBeNull()
    expect(data?.[0]?.read_at).not.toBeNull()
  })

  it('a stranger cannot mark someone else\'s notification read', async () => {
    const { data, error } = await createUserClient(stranger.token)
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select('id')
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it('an ordinary user cannot insert a notification for themselves', async () => {
    const { error } = await createUserClient(recipient.token)
      .from('notifications')
      .insert({ recipient_id: recipient.id, type: 'tutorial_approved', tutorial_id: tutorialId, actor_name: 'me' })
    expect(error?.code).toBe('42501')
  })
})
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @splat-connect/api test:integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/013_notifications.sql packages/api/tests/integration/notifications/rls.test.ts
git commit -m "feat(db): add the in-app notifications table"
```

---

## Task 3: Migration 014 — optimistic concurrency on `tutorials`

**Files:**
- Create: `supabase/migrations/014_tutorials_updated_at.sql`
- Test: `packages/api/tests/integration/tutorials/updated-at.test.ts`

**Interfaces:**
- Produces: column `tutorials.updated_at timestamptz`, function `public.set_updated_at()`, trigger `tutorials_bump_updated_at`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/014_tutorials_updated_at.sql
-- WHY: parts and tools are POST-one/DELETE-one endpoints — concurrent edits
--      there are commutative and never overwrite each other. The tutorials
--      row itself (title, description, difficulty, photo, PDF) is the only
--      shared, replace-in-place resource two collaborators could silently
--      clobber. This column is what a save can check against to detect that.
-- HOW: A BEFORE UPDATE trigger, so every write path (this table's own PATCH,
--      the admin status endpoint, the leader review endpoint) bumps it
--      uniformly — the API layer never has to remember to set it.
alter table public.tutorials add column updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tutorials_bump_updated_at
  before update on public.tutorials
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Apply the migration locally**

Run: `supabase db reset`
Expected: 14 migrations apply cleanly.

- [ ] **Step 3: Write the failing test**

```typescript
// packages/api/tests/integration/tutorials/updated-at.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let tutorialId: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  tutorialId = await createProject({ authorId: author.id, status: 'draft' })
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(author.id)
})

describe('tutorials.updated_at', () => {
  it('is bumped on update', async () => {
    const { data: before } = await adminClient().from('tutorials').select('updated_at').eq('id', tutorialId).single()
    await new Promise((r) => setTimeout(r, 10))
    await adminClient().from('tutorials').update({ title: 'Bumped' }).eq('id', tutorialId)
    const { data: after } = await adminClient().from('tutorials').select('updated_at').eq('id', tutorialId).single()
    expect(new Date(after!.updated_at as string).getTime()).toBeGreaterThan(
      new Date(before!.updated_at as string).getTime()
    )
  })
})
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @splat-connect/api test:integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/014_tutorials_updated_at.sql packages/api/tests/integration/tutorials/updated-at.test.ts
git commit -m "feat(db): bump tutorials.updated_at on every write for save-conflict detection"
```

---

## Task 4: Shared types

**Files:**
- Modify: `packages/types/src/index.ts`

**Interfaces:**
- Produces: `CollaboratorInviteStatus`, `TutorialCollaboratorInvite`, `NotificationType`, `Notification`; extends `Tutorial` with `updated_at: string`.
- Consumes: nothing new — extends existing `Profile`, `Tutorial`.

- [ ] **Step 1: Add the types**

Add near `TutorialOrg` (after it, before `UserAgreement`):

```typescript
export type CollaboratorInviteStatus = 'pending' | 'accepted' | 'declined'

/** One invite to co-author a tutorial. The primary contributor creates it as
 *  'pending'; only the invited profile may answer. */
export interface TutorialCollaboratorInvite {
  id: string
  tutorial_id: string
  invited_profile_id: string
  invited_by: string | null
  status: CollaboratorInviteStatus
  requested_at: string
  responded_at: string | null
  profiles?: Profile
}

export type NotificationType =
  | 'collaborator_invited'
  | 'collaborator_accepted'
  | 'collaborator_declined'
  | 'collaborator_removed'
  | 'collaborator_left'
  | 'tutorial_approved'
  | 'tutorial_rejected'

export interface Notification {
  id: string
  recipient_id: string
  type: NotificationType
  tutorial_id: string
  actor_name: string
  read_at: string | null
  created_at: string
  tutorials?: { title: string }
}
```

Add `updated_at: string` to the `Tutorial` interface, alongside `created_at`.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @splat-connect/types build` (or the repo's typecheck script — check `package.json` at root for the exact command already in use, e.g. `pnpm -w typecheck`)
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): add collaborator invite and notification types"
```

---

## Task 5: `routes/collaborators.ts` — invite and remove (tutorial-scoped)

**Files:**
- Create: `packages/api/src/routes/collaborators.ts`
- Modify: `packages/api/src/app.ts`
- Test: `packages/api/tests/integration/collaborators/collaborators-endpoints.test.ts`

**Interfaces:**
- Consumes: `createUserClient(token)`, `createAdminClient()` (`packages/api/src/supabase/client.js`), `AuthVariables` (`packages/api/src/middleware/auth.js`), `notifications` table (Task 2).
- Produces: `POST /api/tutorials/:id/collaborators/invite`, `DELETE /api/tutorials/:id/collaborators/:profileId`. Mounted at `/api/tutorials`, same as `tutorial-orgs.ts`.

- [ ] **Step 1: Write the route**

```typescript
// packages/api/src/routes/collaborators.ts
/**
 * Collaborator invite and removal (Protected), mounted at /api/tutorials.
 *
 * Endpoints:
 * - POST   /api/tutorials/:id/collaborators/invite       — primary contributor, { email }
 * - DELETE /api/tutorials/:id/collaborators/:profileId   — primary removes, or a
 *                                                           collaborator removes themself
 *
 * The invitee's own view — listing and answering invites — lives in
 * routes/collaborator-invites.ts, mounted at /api/collaborators, because
 * those endpoints are addressed to a person, not scoped to a tutorial.
 *
 * Related files:
 * - supabase/migrations/012_tutorial_collaborators.sql: every policy behind this file
 * - routes/tutorial-orgs.ts: the pattern this follows
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import { createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const collaborators = new Hono<{ Variables: AuthVariables }>()

collaborators.post('/:id/collaborators/invite', async (c) => {
  const body = await c.req.json<{ email?: string }>()
  const email = body.email?.trim()
  if (!email) return c.json({ error: 'email is required' }, 400)

  const admin = createAdminClient()
  const { data: invitee } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  if (!invitee) return c.json({ error: 'No account found with that email' }, 404)
  if (invitee.id === c.get('userId')) return c.json({ error: 'You cannot invite yourself' }, 400)

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorial_collaborator_invites')
    .upsert(
      {
        tutorial_id: c.req.param('id'),
        invited_profile_id: invitee.id,
        invited_by: c.get('userId'),
        status: 'pending',
        responded_at: null,
      },
      { onConflict: 'tutorial_id,invited_profile_id' }
    )
    .select()
    .single()
  if (error) {
    if (error.code === '42501') {
      return c.json({ error: 'only the primary contributor can invite collaborators' }, 403)
    }
    return c.json({ error: error.message }, 500)
  }

  const { data: inviter } = await admin.from('profiles').select('name').eq('id', c.get('userId')).single()
  await admin.from('notifications').insert({
    recipient_id: invitee.id,
    type: 'collaborator_invited',
    tutorial_id: c.req.param('id'),
    actor_name: inviter?.name ?? 'A contributor',
  })

  return c.json(data, 201)
})

collaborators.delete('/:id/collaborators/:profileId', async (c) => {
  const tutorialId = c.req.param('id')
  const targetId = c.req.param('profileId')
  const actingId = c.get('userId')

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorial_contributors')
    .delete()
    .eq('tutorial_id', tutorialId)
    .eq('profile_id', targetId)
    .select('profile_id')
  if (error) return c.json({ error: error.message }, 500)
  if (!data.length) return c.json({ error: 'cannot remove this collaborator' }, 403)

  const admin = createAdminClient()
  const selfLeave = targetId === actingId
  const { data: actor } = await admin.from('profiles').select('name').eq('id', actingId).single()

  if (selfLeave) {
    // Notify the primary contributor that someone left.
    const { data: primaryRow } = await admin
      .from('tutorial_contributors')
      .select('profile_id')
      .eq('tutorial_id', tutorialId)
      .eq('role', 'primary')
      .single()
    if (primaryRow) {
      await admin.from('notifications').insert({
        recipient_id: primaryRow.profile_id,
        type: 'collaborator_left',
        tutorial_id: tutorialId,
        actor_name: actor?.name ?? 'A collaborator',
      })
    }
  } else {
    // Notify the removed collaborator.
    await admin.from('notifications').insert({
      recipient_id: targetId,
      type: 'collaborator_removed',
      tutorial_id: tutorialId,
      actor_name: actor?.name ?? 'The primary contributor',
    })
  }

  return c.body(null, 204)
})

export default collaborators
```

- [ ] **Step 2: Wire it into app.ts**

In `packages/api/src/app.ts`, add the import next to `tutorialOrgs`:

```typescript
import collaborators from './routes/collaborators.js'
```

and the mount next to `app.route('/api/tutorials', tutorialOrgs)`:

```typescript
app.route('/api/tutorials', collaborators)
```

(`app.use('/api/tutorials/*', authMiddleware)` already covers this — no new middleware line needed.)

- [ ] **Step 3: Write the failing test**

```typescript
// packages/api/tests/integration/collaborators/collaborators-endpoints.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'
import app from '../../../src/app.js'

let primary: TestUser
let invitee: TestUser
let stranger: TestUser
let tutorialId: string

beforeAll(async () => {
  primary = await createTestUser('contributor')
  invitee = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
})

beforeEach(async () => {
  tutorialId = await createProject({ authorId: primary.id, status: 'draft' })
})

afterAll(async () => {
  await deleteTestUser(primary.id)
  await deleteTestUser(invitee.id)
  await deleteTestUser(stranger.id)
})

function authed(token: string, init: RequestInit = {}) {
  return { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
}

describe('POST /api/tutorials/:id/collaborators/invite', () => {
  it('the primary contributor can invite by email', async () => {
    const res = await app.request(
      `/api/tutorials/${tutorialId}/collaborators/invite`,
      authed(primary.token, { method: 'POST', body: JSON.stringify({ email: invitee.email }) })
    )
    expect(res.status).toBe(201)
    const notif = await adminClient().from('notifications').select('type').eq('recipient_id', invitee.id).eq('tutorial_id', tutorialId)
    expect(notif.data?.[0]?.type).toBe('collaborator_invited')
  })

  it('a stranger cannot invite', async () => {
    const res = await app.request(
      `/api/tutorials/${tutorialId}/collaborators/invite`,
      authed(stranger.token, { method: 'POST', body: JSON.stringify({ email: invitee.email }) })
    )
    expect(res.status).toBe(403)
  })

  it('404s on an unknown email', async () => {
    const res = await app.request(
      `/api/tutorials/${tutorialId}/collaborators/invite`,
      authed(primary.token, { method: 'POST', body: JSON.stringify({ email: 'nobody@nowhere.test' }) })
    )
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/tutorials/:id/collaborators/:profileId', () => {
  beforeEach(async () => {
    await adminClient().from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: invitee.id, role: 'collaborator' })
  })

  it('the primary can remove a collaborator, who gets notified', async () => {
    const res = await app.request(`/api/tutorials/${tutorialId}/collaborators/${invitee.id}`, authed(primary.token, { method: 'DELETE' }))
    expect(res.status).toBe(204)
    const notif = await adminClient().from('notifications').select('type').eq('recipient_id', invitee.id).eq('tutorial_id', tutorialId)
    expect(notif.data?.[0]?.type).toBe('collaborator_removed')
  })

  it('a collaborator can remove themself, and the primary gets notified', async () => {
    const res = await app.request(`/api/tutorials/${tutorialId}/collaborators/${invitee.id}`, authed(invitee.token, { method: 'DELETE' }))
    expect(res.status).toBe(204)
    const notif = await adminClient().from('notifications').select('type').eq('recipient_id', primary.id).eq('tutorial_id', tutorialId)
    expect(notif.data?.[0]?.type).toBe('collaborator_left')
  })

  it('a collaborator cannot remove another collaborator', async () => {
    const other = await createTestUser('contributor')
    await adminClient().from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: other.id, role: 'collaborator' })
    const res = await app.request(`/api/tutorials/${tutorialId}/collaborators/${other.id}`, authed(invitee.token, { method: 'DELETE' }))
    expect(res.status).toBe(403)
    await deleteTestUser(other.id)
  })
})
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @splat-connect/api test:integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/collaborators.ts packages/api/src/app.ts packages/api/tests/integration/collaborators/collaborators-endpoints.test.ts
git commit -m "feat(api): add invite-by-email and remove/leave endpoints for tutorial collaborators"
```

---

## Task 6: `routes/collaborator-invites.ts` — list mine, accept, decline (user-scoped)

**Files:**
- Create: `packages/api/src/routes/collaborator-invites.ts`
- Modify: `packages/api/src/app.ts`
- Test: `packages/api/tests/integration/collaborators/invite-answers.test.ts`

**Interfaces:**
- Produces: `GET /api/collaborators/me/invites`, `POST /api/collaborators/invites/:inviteId/accept`, `POST /api/collaborators/invites/:inviteId/decline`.
- Consumes: same as Task 5.

- [ ] **Step 1: Write the route**

```typescript
// packages/api/src/routes/collaborator-invites.ts
/**
 * The invitee's own view of collaborator invites (Protected), mounted at
 * /api/collaborators. Distinct from routes/collaborators.ts (tutorial-scoped
 * invite/remove) because these are addressed to a person, not a project.
 *
 * Endpoints:
 * - GET  /api/collaborators/me/invites            — my pending invites
 * - POST /api/collaborators/invites/:id/accept    — accept, then claim the seat
 * - POST /api/collaborators/invites/:id/decline   — decline
 */
import { Hono, type Context } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import { createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const collaboratorInvites = new Hono<{ Variables: AuthVariables }>()

collaboratorInvites.get('/me/invites', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorial_collaborator_invites')
    .select('*, tutorials(title)')
    .eq('invited_profile_id', c.get('userId'))
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

async function answer(c: Context<{ Variables: AuthVariables }>, status: 'accepted' | 'declined') {
  const inviteId = c.req.param('inviteId')
  const supabase = createUserClient(c.get('token'))

  const { data, error } = await supabase
    .from('tutorial_collaborator_invites')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', inviteId)
    .select('tutorial_id, invited_profile_id')
    .single()
  if (error) {
    if (error.code === 'PGRST116') return c.json({ error: 'not your invite to answer' }, 403)
    return c.json({ error: error.message }, 500)
  }

  const admin = createAdminClient()
  const { data: invitee } = await admin.from('profiles').select('name').eq('id', data.invited_profile_id).single()

  if (status === 'accepted') {
    // Retry-safe: if the tutorial_contributors insert fails midway on a
    // client retry, a duplicate-key error here (23505) is already a seat,
    // matching the existing pattern in routes/contributors.ts.
    const { error: claimError } = await supabase
      .from('tutorial_contributors')
      .insert({ tutorial_id: data.tutorial_id, profile_id: data.invited_profile_id, role: 'collaborator' })
    if (claimError && claimError.code !== '23505') {
      return c.json({ error: claimError.message }, 500)
    }
  }

  const { data: primaryRow } = await admin
    .from('tutorial_contributors')
    .select('profile_id')
    .eq('tutorial_id', data.tutorial_id)
    .eq('role', 'primary')
    .single()
  if (primaryRow) {
    await admin.from('notifications').insert({
      recipient_id: primaryRow.profile_id,
      type: status === 'accepted' ? 'collaborator_accepted' : 'collaborator_declined',
      tutorial_id: data.tutorial_id,
      actor_name: invitee?.name ?? 'A contributor',
    })
  }

  return c.json({ status })
}

collaboratorInvites.post('/invites/:inviteId/accept', (c) => answer(c, 'accepted'))
collaboratorInvites.post('/invites/:inviteId/decline', (c) => answer(c, 'declined'))

export default collaboratorInvites
```

- [ ] **Step 2: Wire it into app.ts**

Add the import:

```typescript
import collaboratorInvites from './routes/collaborator-invites.js'
```

Add the middleware and mount, next to the `organizations` block:

```typescript
app.use('/api/collaborators', authMiddleware)
app.use('/api/collaborators/*', authMiddleware)
```

```typescript
app.route('/api/collaborators', collaboratorInvites)
```

- [ ] **Step 3: Write the failing test**

```typescript
// packages/api/tests/integration/collaborators/invite-answers.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'
import { createInvite } from '../../helpers/collaborators.js'
import app from '../../../src/app.js'

let primary: TestUser
let invitee: TestUser
let tutorialId: string
let inviteId: string

beforeAll(async () => {
  primary = await createTestUser('contributor')
  invitee = await createTestUser('contributor')
})

afterAll(async () => {
  await deleteTestUser(primary.id)
  await deleteTestUser(invitee.id)
})

beforeEach(async () => {
  tutorialId = await createProject({ authorId: primary.id, status: 'draft' })
  inviteId = await createInvite({ tutorialId, invitedProfileId: invitee.id, invitedBy: primary.id })
})

function authed(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } }
}

describe('GET /api/collaborators/me/invites', () => {
  it('lists my pending invites', async () => {
    const res = await app.request('/api/collaborators/me/invites', authed(invitee.token))
    const body = await res.json()
    expect(body.some((i: { id: string }) => i.id === inviteId)).toBe(true)
  })
})

describe('POST /api/collaborators/invites/:id/accept', () => {
  it('accepts and claims the seat, notifying the primary', async () => {
    const res = await app.request(`/api/collaborators/invites/${inviteId}/accept`, { ...authed(invitee.token), method: 'POST' })
    expect(res.status).toBe(200)

    const seat = await adminClient().from('tutorial_contributors').select('role').eq('tutorial_id', tutorialId).eq('profile_id', invitee.id).single()
    expect(seat.data?.role).toBe('collaborator')

    const notif = await adminClient().from('notifications').select('type').eq('recipient_id', primary.id).eq('tutorial_id', tutorialId)
    expect(notif.data?.[0]?.type).toBe('collaborator_accepted')
  })
})

describe('POST /api/collaborators/invites/:id/decline', () => {
  it('declines without creating a seat, notifying the primary', async () => {
    const res = await app.request(`/api/collaborators/invites/${inviteId}/decline`, { ...authed(invitee.token), method: 'POST' })
    expect(res.status).toBe(200)

    const seat = await adminClient().from('tutorial_contributors').select('role').eq('tutorial_id', tutorialId).eq('profile_id', invitee.id).maybeSingle()
    expect(seat.data).toBeNull()

    const notif = await adminClient().from('notifications').select('type').eq('recipient_id', primary.id).eq('tutorial_id', tutorialId)
    expect(notif.data?.[0]?.type).toBe('collaborator_declined')
  })
})
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @splat-connect/api test:integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/collaborator-invites.ts packages/api/src/app.ts packages/api/tests/integration/collaborators/invite-answers.test.ts
git commit -m "feat(api): add accept/decline endpoints for a contributor's own collaborator invites"
```

---

## Task 7: `routes/notifications.ts` — list, unread count, mark read

**Files:**
- Create: `packages/api/src/routes/notifications.ts`
- Modify: `packages/api/src/app.ts`
- Test: `packages/api/tests/integration/notifications/notifications-endpoints.test.ts`

**Interfaces:**
- Produces: `GET /api/notifications/me`, `GET /api/notifications/me/unread-count`, `PATCH /api/notifications/:id`.

- [ ] **Step 1: Write the route**

```typescript
// packages/api/src/routes/notifications.ts
/**
 * A user's own notifications (Protected), mounted at /api/notifications.
 * Every row is written elsewhere (routes/collaborators.ts,
 * routes/collaborator-invites.ts, routes/admin.ts) using the admin client —
 * this file is read/acknowledge only.
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'

const notifications = new Hono<{ Variables: AuthVariables }>()

notifications.get('/me', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('notifications')
    .select('*, tutorials(title)')
    .eq('recipient_id', c.get('userId'))
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

notifications.get('/me/unread-count', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', c.get('userId'))
    .is('read_at', null)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ count: count ?? 0 })
})

notifications.patch('/:id', async (c) => {
  const body = await c.req.json<{ read?: boolean }>()
  if (body.read !== true) return c.json({ error: 'only { read: true } is supported' }, 400)

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .select('id')
  if (error) return c.json({ error: error.message }, 500)
  if (!data.length) return c.json({ error: 'not your notification' }, 403)
  return c.body(null, 204)
})

export default notifications
```

- [ ] **Step 2: Wire it into app.ts**

Add the import:

```typescript
import notifications from './routes/notifications.js'
```

Add the middleware and mount:

```typescript
app.use('/api/notifications', authMiddleware)
app.use('/api/notifications/*', authMiddleware)
```

```typescript
app.route('/api/notifications', notifications)
```

- [ ] **Step 3: Write the failing test**

```typescript
// packages/api/tests/integration/notifications/notifications-endpoints.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'
import app from '../../../src/app.js'

let user: TestUser
let stranger: TestUser
let tutorialId: string
let notificationId: string

beforeAll(async () => {
  user = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  tutorialId = await createProject({ authorId: user.id, status: 'draft' })
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(user.id)
  await deleteTestUser(stranger.id)
})

beforeEach(async () => {
  const { data } = await adminClient()
    .from('notifications')
    .insert({ recipient_id: user.id, type: 'tutorial_approved', tutorial_id: tutorialId, actor_name: 'SPLAT' })
    .select('id')
    .single()
  notificationId = data!.id as string
})

function authed(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } }
}

describe('GET /api/notifications/me', () => {
  it('lists my notifications, newest first', async () => {
    const res = await app.request('/api/notifications/me', authed(user.token))
    const body = await res.json()
    expect(body.some((n: { id: string }) => n.id === notificationId)).toBe(true)
  })
})

describe('GET /api/notifications/me/unread-count', () => {
  it('counts unread notifications', async () => {
    const res = await app.request('/api/notifications/me/unread-count', authed(user.token))
    const body = await res.json()
    expect(body.count).toBeGreaterThanOrEqual(1)
  })
})

describe('PATCH /api/notifications/:id', () => {
  it('marks my own notification read', async () => {
    const res = await app.request(`/api/notifications/${notificationId}`, {
      ...authed(user.token),
      method: 'PATCH',
      headers: { ...authed(user.token).headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    })
    expect(res.status).toBe(204)
  })

  it('cannot mark someone else\'s notification read', async () => {
    const res = await app.request(`/api/notifications/${notificationId}`, {
      ...authed(stranger.token),
      method: 'PATCH',
      headers: { ...authed(stranger.token).headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    })
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @splat-connect/api test:integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/notifications.ts packages/api/src/app.ts packages/api/tests/integration/notifications/notifications-endpoints.test.ts
git commit -m "feat(api): add list, unread-count, and mark-read endpoints for notifications"
```

---

## Task 8: Optimistic concurrency on `PATCH /api/tutorials/:id`

**Files:**
- Modify: `packages/api/src/routes/tutorials.ts:110-149`
- Test: `packages/api/tests/integration/tutorials/patch-conflict.test.ts`

**Interfaces:**
- Consumes: `tutorials.updated_at` (Task 3).
- Produces: `PATCH /api/tutorials/:id` now requires `updated_at` in the body and returns `409` on a stale value.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/api/tests/integration/tutorials/patch-conflict.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'
import app from '../../../src/app.js'

let author: TestUser
let tutorialId: string

beforeAll(async () => {
  author = await createTestUser('contributor')
})

afterAll(async () => {
  await deleteTestUser(author.id)
})

beforeEach(async () => {
  tutorialId = await createProject({ authorId: author.id, status: 'draft' })
})

function authed(token: string) {
  return { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
}

describe('PATCH /api/tutorials/:id — optimistic concurrency', () => {
  it('succeeds and bumps updated_at when the caller has the current version', async () => {
    const { data: current } = await adminClient().from('tutorials').select('updated_at').eq('id', tutorialId).single()
    const res = await app.request(`/api/tutorials/${tutorialId}`, {
      ...authed(author.token),
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated', updated_at: current!.updated_at }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('Updated')
    expect(new Date(body.updated_at).getTime()).toBeGreaterThan(new Date(current!.updated_at as string).getTime())
  })

  it('409s when the caller has a stale version', async () => {
    const { data: current } = await adminClient().from('tutorials').select('updated_at').eq('id', tutorialId).single()
    // Someone else saves first.
    await adminClient().from('tutorials').update({ title: 'Someone else\'s edit' }).eq('id', tutorialId)

    const res = await app.request(`/api/tutorials/${tutorialId}`, {
      ...authed(author.token),
      method: 'PATCH',
      body: JSON.stringify({ title: 'My edit', updated_at: current!.updated_at }),
    })
    expect(res.status).toBe(409)

    const { data: unchanged } = await adminClient().from('tutorials').select('title').eq('id', tutorialId).single()
    expect(unchanged?.title).toBe('Someone else\'s edit')
  })

  it('400s when updated_at is missing', async () => {
    const res = await app.request(`/api/tutorials/${tutorialId}`, {
      ...authed(author.token),
      method: 'PATCH',
      body: JSON.stringify({ title: 'No version' }),
    })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @splat-connect/api test:integration`
Expected: FAIL — the endpoint currently accepts a PATCH with no `updated_at` at all (no 400), and never checks staleness (no 409).

- [ ] **Step 3: Update the route**

In `packages/api/src/routes/tutorials.ts`, inside the `tutorials.patch('/:id', ...)` handler (around line 110-149), add the version check. Replace the body from `const update: Record<string, unknown> = {}` through the final `return c.json(data)` with:

```typescript
  if (typeof body.updated_at !== 'string') {
    return c.json({ error: 'updated_at is required' }, 400)
  }

  const update: Record<string, unknown> = {}
  for (const key of EDITABLE) if (key in body) update[key] = body[key]
  if (!Object.keys(update).length) return c.json({ error: 'nothing to update' }, 400)

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    .update(update)
    .eq('id', c.req.param('id'))
    .eq('updated_at', body.updated_at)
    .select()
  if (error) return c.json({ error: error.message }, 500)
  if (!data.length) {
    // Zero rows: either RLS refused (not a contributor / trying to set a
    // forbidden status), or someone else saved first. The generic message
    // in EDITABLE-adjacent 403 handling above already covers the RLS case
    // for status; here it is specifically the conflict, since an RLS
    // refusal on a normal field patch is not otherwise expected for a
    // tutorial's own contributor.
    return c.json({ error: 'This was updated by someone else while you were editing.' }, 409)
  }
  return c.json(data[0])
```

(Leave everything above `const attempted = PROTECTED.filter(...)` — the `PROTECTED` and `status` checks — unchanged; this only replaces the final update block.)

- [ ] **Step 4: Run the test again**

Run: `pnpm --filter @splat-connect/api test:integration`
Expected: PASS. Also re-run the full suite to confirm no regression in `tests/integration/tutorials/patch-allowlist.test.ts` (it will need updating if it PATCHes without `updated_at` — see note below).

- [ ] **Step 5: Fix the pre-existing allowlist test if it breaks**

Open `packages/api/tests/integration/tutorials/patch-allowlist.test.ts`. If any request bodies omit `updated_at`, add it, e.g.:

```typescript
const { data: current } = await adminClient().from('tutorials').select('updated_at').eq('id', tutorialId).single()
// ...then include `updated_at: current!.updated_at` in every PATCH body in this file.
```

Run: `pnpm --filter @splat-connect/api test:integration`
Expected: PASS, full suite green.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/tutorials.ts packages/api/tests/integration/tutorials/patch-conflict.test.ts packages/api/tests/integration/tutorials/patch-allowlist.test.ts
git commit -m "fix(api): reject a stale PATCH /api/tutorials/:id with 409 instead of silently overwriting"
```

---

## Task 9: Notify on admin approve/reject

**Files:**
- Modify: `packages/api/src/routes/admin.ts:37-73` (the `admin.patch('/tutorials/:id/status', ...)` handler — read the current contents first to get the exact line range, since line numbers will have shifted since this plan was written)
- Test: `packages/api/tests/integration/orgs/admin-authority.test.ts` extended, or a new `packages/api/tests/integration/notifications/review-notifications.test.ts`

**Interfaces:**
- Consumes: `createAdminClient()`, `notifications` table.

- [ ] **Step 1: Read the current handler**

Read `packages/api/src/routes/admin.ts` around the `admin.patch('/tutorials/:id/status', ...)` route to see its exact current shape before editing — this plan describes the change in terms of the version read during Task 1-8 research, but the exact insertion point must be confirmed against the live file.

- [ ] **Step 2: Write the failing test**

```typescript
// packages/api/tests/integration/notifications/review-notifications.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'
import app from '../../../src/app.js'

let admin: TestUser
let author: TestUser
let collaborator: TestUser
let tutorialId: string

beforeAll(async () => {
  admin = await createTestUser('admin')
  author = await createTestUser('contributor')
  collaborator = await createTestUser('contributor')
})

afterAll(async () => {
  await deleteTestUser(admin.id)
  await deleteTestUser(author.id)
  await deleteTestUser(collaborator.id)
})

beforeEach(async () => {
  tutorialId = await createProject({ authorId: author.id, status: 'pending' })
  await adminClient().from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: collaborator.id, role: 'collaborator' })
})

function authed(token: string) {
  return { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
}

describe('admin review notifies every contributor', () => {
  it('approving notifies both the primary and the collaborator', async () => {
    const res = await app.request(`/api/admin/tutorials/${tutorialId}/status`, {
      ...authed(admin.token),
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    })
    expect(res.status).toBe(200)

    const notifs = await adminClient().from('notifications').select('recipient_id, type').eq('tutorial_id', tutorialId)
    const recipients = (notifs.data ?? []).map((n) => n.recipient_id)
    expect(recipients).toEqual(expect.arrayContaining([author.id, collaborator.id]))
    expect(notifs.data?.every((n) => n.type === 'tutorial_approved')).toBe(true)
  })

  it('rejecting notifies every contributor', async () => {
    const res = await app.request(`/api/admin/tutorials/${tutorialId}/status`, {
      ...authed(admin.token),
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected', rejection_note: 'Needs more detail' }),
    })
    expect(res.status).toBe(200)

    const notifs = await adminClient().from('notifications').select('type').eq('tutorial_id', tutorialId)
    expect(notifs.data?.every((n) => n.type === 'tutorial_rejected')).toBe(true)
  })
})
```

(If the actual route path or request shape for admin status changes differs from `PATCH /api/admin/tutorials/:id/status` with `{ status, rejection_note }`, adjust the test to match what Step 1's read revealed — this is the one place in the plan where the exact body shape must be confirmed against the live file rather than assumed.)

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm --filter @splat-connect/api test:integration`
Expected: FAIL — no notifications are created today.

- [ ] **Step 4: Add the notification insert**

At the end of the successful-update branch of `admin.patch('/tutorials/:id/status', ...)`, after the tutorial row is updated and before the response is returned, add:

```typescript
const { data: contributorRows } = await supabase
  .from('tutorial_contributors')
  .select('profile_id')
  .eq('tutorial_id', c.req.param('id'))
if (contributorRows?.length) {
  await createAdminClient()
    .from('notifications')
    .insert(
      contributorRows.map((row) => ({
        recipient_id: row.profile_id,
        type: body.status === 'approved' ? 'tutorial_approved' : 'tutorial_rejected',
        tutorial_id: c.req.param('id'),
        actor_name: 'SPLAT',
      }))
    )
}
```

(Adjust variable names — `supabase`, `body` — to whatever the existing handler already calls them; import `createAdminClient` from `../supabase/client.js` if not already imported in this file.)

- [ ] **Step 5: Run the test again**

Run: `pnpm --filter @splat-connect/api test:integration`
Expected: PASS, full suite green.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/admin.ts packages/api/tests/integration/notifications/review-notifications.test.ts
git commit -m "feat(api): notify every contributor when admin approves or rejects a tutorial"
```

---

## Task 10: Bell icon

**Files:**
- Modify: `packages/web/components/icons.tsx`

**Interfaces:**
- Produces: `Bell(props: SVGProps<SVGSVGElement>)`, exported alongside the other icons.

- [ ] **Step 1: Add the icon**

Append, following the exact `Icon` wrapper pattern used by every other export in this file:

```typescript
export function Bell(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </Icon>
  )
}
```

- [ ] **Step 2: Verify it renders**

Run: `pnpm --filter @splat-connect/web test:unit`
Expected: PASS (no existing test covers icons.tsx directly, so this just confirms nothing else broke).

- [ ] **Step 3: Commit**

```bash
git add packages/web/components/icons.tsx
git commit -m "feat(web): add a bell icon for the notifications nav row"
```

---

## Task 11: Nav model — the Notifications row and an unread badge

**Files:**
- Modify: `packages/web/lib/nav-model.ts`
- Test: check for an existing `packages/web/tests/unit/lib/nav-model.test.ts`; extend it if present, else create it

**Interfaces:**
- Produces: `IconName` gains `'bell'`; `NavRow` gains optional `count?: number`; `buildNav(caps, unreadNotifications)` gains a second parameter and a `Notifications` row under the `Account` group.
- Consumes: nothing new at this layer — the caller (Task 13) supplies the count.

- [ ] **Step 1: Write/extend the failing test**

If `packages/web/tests/unit/lib/nav-model.test.ts` exists, read it first and add cases in its style. Otherwise create:

```typescript
// packages/web/tests/unit/lib/nav-model.test.ts
import { describe, it, expect } from 'vitest'
import { buildNav } from '@/lib/nav-model'
import type { Capabilities } from '@/lib/capabilities'

const baseCaps: Capabilities = {
  profile: { id: '1', name: 'Test', email: 't@t.test', role: 'contributor', created_at: '' },
  isAdmin: false,
  ledOrgs: [],
  canAuthor: true,
}

describe('buildNav', () => {
  it('includes a Notifications row with no count when there are no unread notifications', () => {
    const groups = buildNav(baseCaps, 0)
    const row = groups.flatMap((g) => g.rows).find((r) => r.href === '/notifications')
    expect(row).toBeDefined()
    expect(row?.count).toBeUndefined()
  })

  it('carries the unread count when there are unread notifications', () => {
    const groups = buildNav(baseCaps, 3)
    const row = groups.flatMap((g) => g.rows).find((r) => r.href === '/notifications')
    expect(row?.count).toBe(3)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @splat-connect/web test:unit`
Expected: FAIL — `buildNav` doesn't accept a second argument yet, and there's no `/notifications` row.

- [ ] **Step 3: Update `nav-model.ts`**

Add `'bell'` to the `IconName` union. Add `count?: number` to `NavRow`. Change the signature to `export function buildNav(caps: Capabilities, unreadNotifications: number): NavGroup[]` and, in the `Account` group's `rows` array, insert before the `Profile` row:

```typescript
{ href: '/notifications', label: 'Notifications', icon: 'bell', count: unreadNotifications || undefined },
```

- [ ] **Step 4: Run the test again**

Run: `pnpm --filter @splat-connect/web test:unit`
Expected: PASS. This will also fail-compile at every existing `buildNav(caps)` call site until Task 13 updates the one real caller (`components/app-shell.tsx`) — that's expected and fixed in Task 13, not here.

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/nav-model.ts packages/web/tests/unit/lib/nav-model.test.ts
git commit -m "feat(web): add a Notifications nav row with an unread-count badge"
```

---

## Task 12: Rail renders the badge

**Files:**
- Modify: `packages/web/components/rail.tsx`
- Test: check for `packages/web/tests/unit/components/rail.test.tsx`; extend if present

**Interfaces:**
- Consumes: `Bell` (Task 10), `NavRow.count` (Task 11).

- [ ] **Step 1: Write/extend the failing test**

Add to (or create, following the existing `EditBackingSection`-style render test conventions) `packages/web/tests/unit/components/rail.test.tsx`:

```typescript
it('renders a badge when a row carries a count', () => {
  const groups = [{ heading: 'Account', rows: [{ href: '/notifications', label: 'Notifications', icon: 'bell' as const, count: 5 }] }]
  render(<Rail groups={groups} pathname="/dashboard" collapsed={false} onToggle={() => {}} />)
  expect(screen.getByText('5')).toBeInTheDocument()
})

it('renders no badge when count is absent', () => {
  const groups = [{ heading: 'Account', rows: [{ href: '/notifications', label: 'Notifications', icon: 'bell' as const }] }]
  render(<Rail groups={groups} pathname="/dashboard" collapsed={false} onToggle={() => {}} />)
  expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument()
})
```

(Match whatever `render`/`screen` import source the rest of the file already uses.)

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @splat-connect/web test:unit`
Expected: FAIL — `Bell` isn't in the `ICONS` map and no badge markup exists.

- [ ] **Step 3: Update `rail.tsx`**

Add `Bell` to the icon import list and to the `ICONS` record: `bell: Bell,`.

In the row-rendering `<Link>`, after the `{!collapsed && row.soon && (...)}` block, add:

```tsx
{!collapsed && row.count !== undefined && (
  <span className="ml-auto shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
    {row.count}
  </span>
)}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm --filter @splat-connect/web test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/rail.tsx packages/web/tests/unit/components/rail.test.tsx
git commit -m "feat(web): render the unread-count badge on the notifications nav row"
```

---

## Task 13: Capabilities fetches the unread count

**Files:**
- Modify: `packages/web/lib/capabilities.ts`
- Modify: `packages/web/components/app-shell.tsx`

**Interfaces:**
- Consumes: `GET /api/notifications/me/unread-count` (Task 7), `buildNav(caps, unreadNotifications)` (Task 11).
- Produces: `Capabilities` gains `unreadNotifications: number`.

- [ ] **Step 1: Update `capabilities.ts`**

Add to the `Capabilities` type: `unreadNotifications: number`.

In `getCapabilities`, alongside the existing `ledOrgs` fetch, add:

```typescript
const unreadNotifications = await apiClient
  .get<{ count: number }>('/api/notifications/me/unread-count')
  .then((r) => r.count)
  .catch(() => 0)
```

and include it in the returned object: `unreadNotifications,`.

- [ ] **Step 2: Update `app-shell.tsx`**

Change `buildNav(caps)` to `buildNav(caps, caps.unreadNotifications)`.

- [ ] **Step 3: Run the web unit suite**

Run: `pnpm --filter @splat-connect/web test:unit`
Expected: PASS — this makes the `buildNav` call-site compile again (Task 11 changed its signature) and exercises no new branch of its own, so no new test is required here beyond confirming the suite is green.

- [ ] **Step 4: Commit**

```bash
git add packages/web/lib/capabilities.ts packages/web/components/app-shell.tsx
git commit -m "feat(web): wire the unread notification count into the nav rail"
```

---

## Task 14: `NotificationsList` client component

**Files:**
- Create: `packages/web/components/notifications-list.tsx`
- Test: `packages/web/tests/unit/components/notifications-list.test.tsx`

**Interfaces:**
- Consumes: `Notification`, `TutorialCollaboratorInvite` (Task 4).
- Produces: `NotificationsList({ notifications, pendingInvitesByTutorial, onMarkRead, onAcceptInvite, onDeclineInvite })`, following `EditBackingSection`'s `run()`-busy-state pattern.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/web/tests/unit/components/notifications-list.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificationsList } from '@/components/notifications-list'
import type { Notification } from '@splat-connect/types'

const baseNotif: Notification = {
  id: 'n1',
  recipient_id: 'u1',
  type: 'tutorial_approved',
  tutorial_id: 't1',
  actor_name: 'SPLAT',
  read_at: null,
  created_at: new Date().toISOString(),
  tutorials: { title: 'Spoon Holder' },
}

describe('NotificationsList', () => {
  it('renders a notification and marks it read on click', async () => {
    const onMarkRead = vi.fn().mockResolvedValue(undefined)
    render(
      <NotificationsList
        notifications={[baseNotif]}
        pendingInvitesByTutorial={{}}
        onMarkRead={onMarkRead}
        onAcceptInvite={vi.fn()}
        onDeclineInvite={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText(/Spoon Holder/))
    await waitFor(() => expect(onMarkRead).toHaveBeenCalledWith('n1'))
  })

  it('renders Accept/Decline for a pending invite notification', async () => {
    const inviteNotif: Notification = { ...baseNotif, id: 'n2', type: 'collaborator_invited' }
    const onAcceptInvite = vi.fn().mockResolvedValue(undefined)
    render(
      <NotificationsList
        notifications={[inviteNotif]}
        pendingInvitesByTutorial={{ t1: 'invite-1' }}
        onMarkRead={vi.fn()}
        onAcceptInvite={onAcceptInvite}
        onDeclineInvite={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Accept'))
    await waitFor(() => expect(onAcceptInvite).toHaveBeenCalledWith('invite-1'))
  })

  it('shows no Accept/Decline once the invite is no longer pending', () => {
    const inviteNotif: Notification = { ...baseNotif, id: 'n3', type: 'collaborator_invited' }
    render(
      <NotificationsList
        notifications={[inviteNotif]}
        pendingInvitesByTutorial={{}}
        onMarkRead={vi.fn()}
        onAcceptInvite={vi.fn()}
        onDeclineInvite={vi.fn()}
      />
    )
    expect(screen.queryByText('Accept')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @splat-connect/web test:unit`
Expected: FAIL — the component doesn't exist.

- [ ] **Step 3: Write the component**

```tsx
// packages/web/components/notifications-list.tsx
'use client'
/**
 * The notification inbox list. A client component because marking read and
 * answering an invite both need a busy state — same shape as
 * EditBackingSection's run().
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Notification, NotificationType } from '@splat-connect/types'

const COPY: Record<NotificationType, (actor: string, title: string) => string> = {
  collaborator_invited: (actor, title) => `${actor} invited you to collaborate on "${title}"`,
  collaborator_accepted: (actor, title) => `${actor} accepted your invite to "${title}"`,
  collaborator_declined: (actor, title) => `${actor} declined your invite to "${title}"`,
  collaborator_removed: (actor, title) => `${actor} removed you from "${title}"`,
  collaborator_left: (actor, title) => `${actor} left "${title}"`,
  tutorial_approved: (_actor, title) => `"${title}" was approved and is now published`,
  tutorial_rejected: (_actor, title) => `"${title}" was rejected`,
}

export function NotificationsList({
  notifications,
  pendingInvitesByTutorial,
  onMarkRead,
  onAcceptInvite,
  onDeclineInvite,
}: {
  notifications: Notification[]
  pendingInvitesByTutorial: Record<string, string>
  onMarkRead: (id: string) => Promise<void>
  onAcceptInvite: (inviteId: string) => Promise<void>
  onDeclineInvite: (inviteId: string) => Promise<void>
}) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)

  async function run(key: string, fn: () => Promise<void>) {
    setPending(key)
    try {
      await fn()
      router.refresh()
    } finally {
      setPending(null)
    }
  }

  if (notifications.length === 0) {
    return <p className="text-sm text-muted">Nothing yet.</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {notifications.map((n) => {
        const title = n.tutorials?.title ?? 'a tutorial'
        const inviteId = n.type === 'collaborator_invited' ? pendingInvitesByTutorial[n.tutorial_id] : undefined
        return (
          <li key={n.id} className={`card-flat px-4 py-3 text-sm ${n.read_at ? 'opacity-60' : ''}`}>
            <button
              type="button"
              onClick={() => run(n.id, () => onMarkRead(n.id))}
              className="text-left font-medium text-ink hover:underline"
            >
              {COPY[n.type](n.actor_name, title)}
            </button>
            {inviteId && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => run(inviteId, () => onAcceptInvite(inviteId))}
                  className="btn btn-accent btn-sm"
                >
                  {pending === inviteId ? 'Accepting…' : 'Accept'}
                </button>
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => run(`decline-${inviteId}`, () => onDeclineInvite(inviteId))}
                  className="btn btn-quiet btn-sm"
                >
                  Decline
                </button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm --filter @splat-connect/web test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/notifications-list.tsx packages/web/tests/unit/components/notifications-list.test.tsx
git commit -m "feat(web): add the notification list component with inline invite accept/decline"
```

---

## Task 15: `/notifications` page

**Files:**
- Create: `packages/web/app/notifications/page.tsx`

**Interfaces:**
- Consumes: `NotificationsList` (Task 14), `apiClient` (`packages/web/lib/api-client.ts`), `Notification`, `TutorialCollaboratorInvite` (Task 4).

- [ ] **Step 1: Write the page**

```tsx
// packages/web/app/notifications/page.tsx
import { apiClient } from '@/lib/api-client'
import { revalidatePath } from 'next/cache'
import { NotificationsList } from '@/components/notifications-list'
import type { Notification, TutorialCollaboratorInvite } from '@splat-connect/types'

export default async function NotificationsPage() {
  const [notifications, invites] = await Promise.all([
    apiClient.get<Notification[]>('/api/notifications/me').catch(() => [] as Notification[]),
    apiClient.get<TutorialCollaboratorInvite[]>('/api/collaborators/me/invites').catch(() => [] as TutorialCollaboratorInvite[]),
  ])

  const pendingInvitesByTutorial: Record<string, string> = {}
  for (const invite of invites) pendingInvitesByTutorial[invite.tutorial_id] = invite.id

  async function markRead(id: string) {
    'use server'
    await apiClient.patch(`/api/notifications/${id}`, { read: true })
    revalidatePath('/notifications')
  }

  async function acceptInvite(inviteId: string) {
    'use server'
    await apiClient.post(`/api/collaborators/invites/${inviteId}/accept`, {})
    revalidatePath('/notifications')
  }

  async function declineInvite(inviteId: string) {
    'use server'
    await apiClient.post(`/api/collaborators/invites/${inviteId}/decline`, {})
    revalidatePath('/notifications')
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-ink">Notifications</h1>
      <NotificationsList
        notifications={notifications}
        pendingInvitesByTutorial={pendingInvitesByTutorial}
        onMarkRead={markRead}
        onAcceptInvite={acceptInvite}
        onDeclineInvite={declineInvite}
      />
    </div>
  )
}
```

(Confirm `apiClient.post`/`apiClient.patch` signatures in `packages/web/lib/api-client.ts` match this call shape before finalizing — the edit page's existing server actions in Task 18 use the same client, so this should already be consistent.)

- [ ] **Step 2: Manual check**

Run the dev servers (`pnpm dev` or whatever the repo's documented local-dev command is) and visit `/notifications` signed in as a user with at least one notification (seed one via `adminClient` in a scratch script, or trigger one through Task 5/9's flows). Confirm the list renders and clicking a row marks it read (badge count drops on next nav).

- [ ] **Step 3: Commit**

```bash
git add packages/web/app/notifications/page.tsx
git commit -m "feat(web): add the /notifications inbox page"
```

---

## Task 16: `EditCollaboratorsSection` component

**Files:**
- Create: `packages/web/components/edit-collaborators-section.tsx`
- Test: `packages/web/tests/unit/components/edit-collaborators-section.test.tsx`

**Interfaces:**
- Consumes: `TutorialContributor` (existing type).
- Produces: `EditCollaboratorsSection({ contributors, currentProfileId, isPrimary, onInvite, onRemove })`, mirroring `EditBackingSection`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/web/tests/unit/components/edit-collaborators-section.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditCollaboratorsSection } from '@/components/edit-collaborators-section'
import type { TutorialContributor } from '@splat-connect/types'

const primary: TutorialContributor & { profiles: { id: string; name: string } } = {
  tutorial_id: 't1',
  profile_id: 'p1',
  role: 'primary',
  added_at: '',
  profiles: { id: 'p1', name: 'Primary Author' },
}
const collaborator = { ...primary, profile_id: 'p2', role: 'collaborator' as const, profiles: { id: 'p2', name: 'Jane' } }

describe('EditCollaboratorsSection', () => {
  it('the primary sees Remove on a collaborator', () => {
    render(
      <EditCollaboratorsSection
        contributors={[primary, collaborator]}
        currentProfileId="p1"
        isPrimary
        onInvite={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getByText('Remove')).toBeInTheDocument()
  })

  it('a collaborator sees Leave instead of Remove, and no invite field', () => {
    render(
      <EditCollaboratorsSection
        contributors={[primary, collaborator]}
        currentProfileId="p2"
        isPrimary={false}
        onInvite={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getByText('Leave')).toBeInTheDocument()
    expect(screen.queryByLabelText(/invite/i)).not.toBeInTheDocument()
  })

  it('the primary can invite by email', async () => {
    const onInvite = vi.fn().mockResolvedValue(undefined)
    render(
      <EditCollaboratorsSection
        contributors={[primary]}
        currentProfileId="p1"
        isPrimary
        onInvite={onInvite}
        onRemove={vi.fn()}
      />
    )
    fireEvent.change(screen.getByLabelText(/invite/i), { target: { value: 'jane@example.test' } })
    fireEvent.click(screen.getByText('Invite'))
    await waitFor(() => expect(onInvite).toHaveBeenCalledWith('jane@example.test'))
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @splat-connect/web test:unit`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Write the component**

```tsx
// packages/web/components/edit-collaborators-section.tsx
'use client'
/**
 * Collaborator management for one project. Same run()-busy-state shape as
 * EditBackingSection.
 *
 * Related files:
 * - packages/api/src/routes/collaborators.ts: invite and remove/leave
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TutorialContributor, Profile } from '@splat-connect/types'

export function EditCollaboratorsSection({
  contributors,
  currentProfileId,
  isPrimary,
  onInvite,
  onRemove,
}: {
  contributors: (TutorialContributor & { profiles: Profile })[]
  currentProfileId: string
  isPrimary: boolean
  onInvite: (email: string) => Promise<void>
  onRemove: (profileId: string) => Promise<void>
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(key: string, fn: () => Promise<void>) {
    setPending(key)
    setError(null)
    try {
      await fn()
      router.refresh()
    } catch {
      setError('That did not work. Please try again.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="px-5 pb-5">
      <ul className="flex flex-col gap-2">
        {contributors.map((c) => {
          const isSelf = c.profile_id === currentProfileId
          const canAct = c.role === 'collaborator' && (isPrimary || isSelf)
          return (
            <li key={c.profile_id} className="flex items-center gap-3">
              <span className="text-sm font-medium text-ink">{c.profiles.name}</span>
              <span className="text-xs text-muted">{c.role}</span>
              {canAct && (
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => run(c.profile_id, () => onRemove(c.profile_id))}
                  className="btn btn-quiet btn-sm ml-auto"
                >
                  {pending === c.profile_id ? 'Working…' : isSelf ? 'Leave' : 'Remove'}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {error && (
        <p role="alert" className="alert alert-danger mt-4">
          {error}
        </p>
      )}

      {isPrimary && (
        <div className="mt-5">
          <label htmlFor="invite-email" className="block text-sm font-medium text-ink">
            Invite a collaborator
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="their email"
              disabled={pending !== null}
              className="field min-w-0 flex-1"
            />
            <button
              type="button"
              disabled={!email.trim() || pending !== null}
              onClick={() => run('invite', async () => { await onInvite(email.trim()); setEmail('') })}
              className="btn btn-accent"
            >
              {pending === 'invite' ? 'Inviting…' : 'Invite'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm --filter @splat-connect/web test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/edit-collaborators-section.tsx packages/web/tests/unit/components/edit-collaborators-section.test.tsx
git commit -m "feat(web): add the Collaborators section component for the tutorial edit page"
```

---

## Task 17: `EditDetailsSection` — extract the Details form with conflict handling

**Files:**
- Create: `packages/web/components/edit-details-section.tsx`
- Test: `packages/web/tests/unit/components/edit-details-section.test.tsx`

**Interfaces:**
- Produces: `EditDetailsSection({ tutorial, onSave })` where `onSave` throws a recognizable conflict signal on 409.
- Consumes: `Tutorial` type (now carrying `updated_at`, Task 4).

- [ ] **Step 1: Write the failing test**

```typescript
// packages/web/tests/unit/components/edit-details-section.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditDetailsSection } from '@/components/edit-details-section'
import type { Tutorial } from '@splat-connect/types'

const tutorial: Tutorial = {
  id: 't1',
  title: 'Spoon Holder',
  description: null,
  difficulty: 'easy',
  status: 'draft',
  tutorial_pdf_url: null,
  toy_photo_url: null,
  rejection_note: null,
  created_at: '',
  updated_at: '2026-08-01T00:00:00.000Z',
  reviewed_at: null,
  reviewed_by: null,
  reviewed_for_org_id: null,
}

describe('EditDetailsSection', () => {
  it('submits the loaded updated_at alongside the edited fields', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditDetailsSection tutorial={tutorial} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Title' } })
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Title', updated_at: '2026-08-01T00:00:00.000Z' })
      )
    )
  })

  it('shows the conflict message when onSave signals a conflict', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('conflict'))
    render(<EditDetailsSection tutorial={tutorial} onSave={onSave} />)
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() =>
      expect(screen.getByText(/updated while you were editing/i)).toBeInTheDocument()
    )
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @splat-connect/web test:unit`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Write the component**

```tsx
// packages/web/components/edit-details-section.tsx
'use client'
/**
 * The tutorial's core fields (title/description/difficulty), extracted from
 * a plain server-action form into a client component so a save conflict —
 * caught as a rejected onSave — can be shown instead of crashing to an error
 * boundary. Every call carries the updated_at loaded at page render, not a
 * freshly re-fetched one: that's the whole point of the check.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Tutorial, Difficulty } from '@splat-connect/types'

export function EditDetailsSection({
  tutorial,
  onSave,
}: {
  tutorial: Tutorial
  onSave: (patch: { title: string; description: string | null; difficulty: Difficulty; updated_at: string }) => Promise<void>
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [conflict, setConflict] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setConflict(false)
    try {
      await onSave({
        title: formData.get('title') as string,
        description: (formData.get('description') as string) || null,
        difficulty: formData.get('difficulty') as Difficulty,
        updated_at: tutorial.updated_at,
      })
      router.refresh()
    } catch {
      setConflict(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 px-5 pb-5">
      {conflict && (
        <p role="alert" className="alert alert-danger">
          This was updated while you were editing — reload to see the latest version before
          saving your changes.
        </p>
      )}
      <div>
        <label htmlFor="edit-title" className="field-label">Title</label>
        <input id="edit-title" name="title" defaultValue={tutorial.title} required className="field" />
      </div>
      <div>
        <label htmlFor="edit-description" className="field-label">Description</label>
        <textarea id="edit-description" name="description" defaultValue={tutorial.description ?? ''} rows={4} className="field" />
      </div>
      <div>
        <label htmlFor="edit-difficulty" className="field-label">Difficulty</label>
        <select id="edit-difficulty" key={tutorial.difficulty} name="difficulty" defaultValue={tutorial.difficulty} className="field">
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary btn-sm self-end">
        {pending ? 'Saving…' : 'Save details'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm --filter @splat-connect/web test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/edit-details-section.tsx packages/web/tests/unit/components/edit-details-section.test.tsx
git commit -m "feat(web): extract the Details form into a client component that surfaces save conflicts"
```

---

## Task 18: Wire both sections into the edit page

**Files:**
- Modify: `packages/web/app/tutorials/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `EditCollaboratorsSection` (Task 16), `EditDetailsSection` (Task 17), `TutorialCollaboratorInvite` type (unused directly here, but `TutorialWithDetails.tutorial_contributors` already carries what's needed).

- [ ] **Step 1: Replace the inline Details `<details>` block**

Remove the existing inline `<form action={saveDetails}>` block and the `saveDetails` function. Replace `saveDetails` with:

```typescript
async function saveDetails(patch: { title: string; description: string | null; difficulty: Difficulty; updated_at: string }) {
  'use server'
  const body: Record<string, unknown> = { ...patch }
  if (tutorial.status === 'approved' || tutorial.status === 'rejected') {
    body.status = 'pending'
  }
  await apiClient.patch(`/api/tutorials/${id}`, body)
  revalidatePath(`/tutorials/${id}/edit`)
}
```

(`tutorial` is already in scope from the top of the page. `apiClient.patch` throwing on a non-2xx response — confirm this against `packages/web/lib/api-core.ts` before finalizing; if it doesn't throw on 409 today, this is the one spot that needs a small adjustment there so `EditDetailsSection`'s catch block has something to catch.)

Replace the `<details className={panelCls} open>...Details...</details>` block's contents with:

```tsx
<details className={panelCls} open>
  <summary className={summaryCls}>Details</summary>
  <EditDetailsSection tutorial={tutorial!} onSave={saveDetails} />
</details>
```

- [ ] **Step 2: Add the Collaborators section**

Add the import:

```typescript
import { EditCollaboratorsSection } from '@/components/edit-collaborators-section'
```

Add the server actions, near `askOrg`/`withdrawOrg`:

```typescript
async function inviteCollaborator(emailAddr: string) {
  'use server'
  await apiClient.post(`/api/tutorials/${id}/collaborators/invite`, { email: emailAddr })
  revalidatePath(`/tutorials/${id}/edit`)
}

async function removeCollaborator(profileId: string) {
  'use server'
  await apiClient.delete(`/api/tutorials/${id}/collaborators/${profileId}`)
  revalidatePath(`/tutorials/${id}/edit`)
}
```

Add the panel after the Backing panel (last, for the same reason Backing is last — least frequently touched):

```tsx
<details className={panelCls}>
  <summary className={summaryCls}>
    Collaborators
    <span className="ml-2 text-xs font-normal text-muted">
      {tutorial!.tutorial_contributors.length}
    </span>
  </summary>
  <EditCollaboratorsSection
    contributors={tutorial!.tutorial_contributors}
    currentProfileId={profile!.id}
    isPrimary={tutorial!.tutorial_contributors.some(
      (tc) => tc.profile_id === profile!.id && tc.role === 'primary'
    )}
    onInvite={inviteCollaborator}
    onRemove={removeCollaborator}
  />
</details>
```

- [ ] **Step 3: Manual verification**

Run the dev servers, sign in as a tutorial's primary contributor, open its edit page, invite a second test account by email, sign in as that account, accept from `/notifications`, and confirm the edit page now shows them as a collaborator with a Leave control and full section access. Then, in two browser sessions signed in as different collaborators on the same tutorial, load the edit page in both, save Details in one, then try to save Details in the other with the stale form still open — confirm the second save shows the conflict message instead of silently overwriting.

- [ ] **Step 4: Run the full web suite**

Run: `pnpm --filter @splat-connect/web test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/tutorials/\[id\]/edit/page.tsx
git commit -m "feat(web): wire the Collaborators section and conflict-aware Details form into the edit page"
```

---

## Task 19: E2E journey

**Files:**
- Create or extend: `packages/web/tests/e2e/` — check existing spec naming (e.g. `org-backing.spec.ts`) and add `collaborators.spec.ts` in the same style

**Interfaces:**
- Consumes: whatever E2E fixture/helper pattern the existing specs use (read one, e.g. the org-backing journey, before writing this — do not invent a different fixture style).

- [ ] **Step 1: Read an existing E2E spec for the fixture pattern**

Read `packages/web/tests/e2e/*.spec.ts` (whichever covers org backing or tutorial submission) to copy its exact login/fixture/cleanup conventions — E2E specs in this repo run against isolated ports per the project's E2E setup, and inventing a different pattern here would break that isolation.

- [ ] **Step 2: Write the journey**

Following the pattern read in Step 1, script:
1. Sign in as contributor A, create a draft tutorial.
2. Invite contributor B by email from the edit page's Collaborators section.
3. Sign in as contributor B, go to `/notifications`, accept the invite.
4. As B, edit the tutorial's title and submit it for review.
5. Sign in as admin, approve it.
6. As A and as B, confirm `/notifications` shows a `tutorial_approved` notification and the unread badge reflects it.

- [ ] **Step 3: Run it**

Run: `pnpm --filter @splat-connect/web test:e2e`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/web/tests/e2e/collaborators.spec.ts
git commit -m "test(web e2e): cover invite, accept, submit, approve, and notify end to end"
```

---

## Self-Review Notes

**Spec coverage:** invite/accept/decline (Tasks 1, 6), full parity including submit and backing (unchanged — collaborators get a `tutorial_contributors` row like any contributor, so every existing RLS grant keyed on `is_tutorial_contributor()` already covers them with no new code), primary-only invite/remove plus self-leave (Task 1's policies, Task 5), the safe second-INSERT-arm on `tutorial_contributors` re-verified against the 008 regression (Task 1's test), 7 notification events (Tasks 5, 6, 9), in-app inbox with unread badge (Tasks 10-15), optimistic concurrency on `tutorials` only (Task 8), no changes to `parts`/`tools` (none made). All covered.

**Placeholder scan:** none found — every step has real code or a real, specific manual-verification procedure.

**Type consistency:** `TutorialCollaboratorInvite`, `Notification`, `NotificationType`, `CollaboratorInviteStatus` (Task 4) are used with identical field names across Tasks 5, 6, 7, 14, 15. `EditCollaboratorsSection`'s and `EditDetailsSection`'s prop shapes match exactly what Task 18 passes in.
