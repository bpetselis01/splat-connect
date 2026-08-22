# Design Challenges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user submit a toy-adaptation idea, have an admin publish it as a public Design Challenge, let other users join it self-serve and collaborate in a private thread, and graduate a successful challenge into a draft tutorial.

**Architecture:** Three new tables (`toy_ideas`, `toy_idea_participants`, `toy_idea_messages`) plus one altered table (`notifications`). A new Hono route file `packages/api/src/routes/toy-ideas.ts` mounted at `/api/ideas`, two new endpoints on the existing `public.ts`, and three new admin endpoints on `admin.ts`. The web side reuses `exchange-chat.tsx` (widened from `ToyTransactionMessage` to a structural message type) and mirrors `/dashboard/exchanges` and `/admin/review`.

**Tech Stack:** Supabase/Postgres with RLS, Hono (Node) API, Next.js 16 + React 19 web, `@splat-connect/types` shared package, Vitest (unit + integration), Playwright (e2e), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-08-20-design-challenges-design.md` — read it before starting. It carries the "why" behind every decision below.

## Global Constraints

- Migrations are numbered sequentially; the next free numbers are **037, 038, 039**. Never renumber an existing migration.
- After committing a migration you must apply it: `supabase db push`. `pnpm db:check` fails the build if a committed migration is unapplied — this guard exists because 032/033 were committed but not pushed and production 500'd.
- A `pending` idea is **never** publicly readable. It describes a specific disabled child's functional needs before anyone has reviewed it for identifying detail.
- The message thread is **never** anon-readable, even on a published challenge.
- No per-message notifications. Notify only on join / leave / remove / approve / reject.
- Admins only for review and graduation. `is_admin()` already exists.
- API unit tests carry the existing three-line annotation (`Tests:` / `How:` / `Chain:`).
- British spellings in user-facing copy (`organisation`), matching existing public pages.
- Every RLS policy gets a comment explaining *why*, matching the style of 026 and 034.

---

## File Structure

**Create:**
- `supabase/migrations/037_toy_ideas.sql`
- `supabase/migrations/038_toy_idea_collaboration.sql`
- `supabase/migrations/039_notifications_idea_subject.sql`
- `packages/api/src/routes/toy-ideas.ts`
- `packages/api/tests/unit/routes/toy-ideas.test.ts`
- `packages/api/tests/integration/toy-ideas/idea-lifecycle.test.ts`
- `packages/api/tests/integration/toy-ideas/graduation.test.ts`
- `packages/web/app/get-involved/design-challenges/[id]/page.tsx`
- `packages/web/app/dashboard/challenges/page.tsx`
- `packages/web/app/admin/ideas/page.tsx`
- `packages/web/app/admin/ideas/[id]/page.tsx`
- `packages/web/components/idea-form.tsx`
- `packages/web/components/challenge-thread.tsx`
- `packages/web/components/challenge-card.tsx`
- `packages/web/tests/unit/components/idea-form.test.tsx`
- `packages/web/tests/unit/app/design-challenges.test.tsx`
- `packages/web/tests/e2e/public/design-challenges.spec.ts`

**Modify:**
- `packages/types/src/index.ts` — add idea types
- `packages/api/src/app.ts:71` — mount `/api/ideas`
- `packages/api/src/routes/public.ts` — add two challenge endpoints
- `packages/api/src/routes/admin.ts` — add three idea endpoints
- `packages/web/components/exchange-chat.tsx` — widen the message type
- `packages/web/lib/public-nav.ts` — flip `design-challenges` to `'live'`
- `packages/web/lib/nav-model.ts` — add `/dashboard/challenges`
- `packages/web/app/get-involved/submit-an-idea/page.tsx` — add the form
- `packages/web/app/get-involved/design-challenges/page.tsx` — replace `ComingSoon`

---

## Task 1: `toy_ideas` table and RLS

**Files:**
- Create: `supabase/migrations/037_toy_ideas.sql`

**Interfaces:**
- Produces: table `public.toy_ideas` with columns `id, author_id, title, summary, description, intended_use, primary_user, contact_prefs, status, review_note, tutorial_id, created_at, updated_at`. Status values: `pending | challenge | rejected | graduated`.

- [ ] **Step 1: Write the migration**

```sql
-- 037_toy_ideas.sql
-- WHY: /get-involved/submit-an-idea was marked live but captured nothing. This
--      is the storage behind it, and the record a public Design Challenge is.
-- Field set follows Makers Making Change's published idea form; see the spec.

create table public.toy_ideas (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles on delete cascade,
  title text not null,
  summary text not null,
  description text not null,
  intended_use text not null,
  primary_user text not null,
  -- How involved the author wants to be, declared upfront so a maker knows
  -- before joining whether there is a person to collaborate with or just a brief.
  -- Values validated in the API, not by a constraint: the set is presentational
  -- and will change more often than the schema should.
  contact_prefs text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'challenge', 'rejected', 'graduated')),
  -- Shown to the author on rejection. A rejection with no reason is the thing
  -- that stops people submitting again. Never shown publicly.
  review_note text,
  tutorial_id uuid references public.tutorials on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.toy_ideas enable row level security;

-- Only reviewed ideas are public. A pending idea describes a specific disabled
-- child's functional needs before anyone has checked it for identifying detail,
-- so it must not be readable by anon under any circumstance.
create policy "Published challenges are public"
  on public.toy_ideas for select to anon, authenticated
  using (status in ('challenge', 'graduated'));

create policy "Authors see their own ideas at any status"
  on public.toy_ideas for select to authenticated
  using (author_id = auth.uid());

create policy "Authors submit their own ideas"
  on public.toy_ideas for insert to authenticated
  with check (author_id = auth.uid());

-- Editing stops at review. A rejected idea is resubmitted, not amended, so the
-- thing an admin read is the thing that was judged.
create policy "Authors edit only before review"
  on public.toy_ideas for update to authenticated
  using (author_id = auth.uid() and status = 'pending')
  with check (author_id = auth.uid() and status = 'pending');

create policy "Admin full access to toy ideas"
  on public.toy_ideas for all using (public.is_admin());

grant select on public.toy_ideas to anon, authenticated;
grant insert, update on public.toy_ideas to authenticated;

create index toy_ideas_status_created_idx on public.toy_ideas (status, created_at desc);
create index toy_ideas_author_idx on public.toy_ideas (author_id);
```

- [ ] **Step 2: Apply and verify anon cannot read a pending idea**

```bash
supabase db push
```

Then in `supabase/snippets/` or psql, as the anon role:

```sql
insert into public.toy_ideas (author_id, title, summary, description, intended_use, primary_user)
  values ('<any-profile-id>', 't', 's', 'd', 'i', 'p');
-- as anon:
select count(*) from public.toy_ideas;  -- expect 0
update public.toy_ideas set status = 'challenge';
-- as anon:
select count(*) from public.toy_ideas;  -- expect 1
```

Expected: 0 then 1.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/037_toy_ideas.sql
git commit -m "feat(db): add toy_ideas with review-gated public visibility"
```

---

## Task 2: Participants and messages

**Files:**
- Create: `supabase/migrations/038_toy_idea_collaboration.sql`

**Interfaces:**
- Consumes: `public.toy_ideas` from Task 1.
- Produces: tables `public.toy_idea_participants` (`idea_id, profile_id, joined_at`) and `public.toy_idea_messages` (`id, idea_id, sender_id, kind, body, created_at`).

- [ ] **Step 1: Write the migration**

```sql
-- 038_toy_idea_collaboration.sql
-- WHY: joining a challenge is self-serve (matching Makers Making Change), and
--      collaboration happens in one thread per challenge.
-- Participants are a table rather than derived from message senders because
-- joining is an explicit act that fires a notification and must be revocable
-- independently of what someone has already written.

create table public.toy_idea_participants (
  idea_id uuid references public.toy_ideas on delete cascade,
  profile_id uuid references public.profiles on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (idea_id, profile_id)
);

alter table public.toy_idea_participants enable row level security;

create policy "Participants of public challenges are visible"
  on public.toy_idea_participants for select to anon, authenticated
  using (exists (
    select 1 from public.toy_ideas i
    where i.id = idea_id and i.status in ('challenge', 'graduated')
  ));

-- Self-serve join, but only onto a published challenge. You may not join your
-- own idea (you are already its author) and you may not join something pending.
create policy "Anyone may join a published challenge"
  on public.toy_idea_participants for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.toy_ideas i
      where i.id = idea_id and i.status = 'challenge' and i.author_id <> auth.uid()
    )
  );

-- Leaving is your own call; removing someone is the author's.
create policy "Leave, or be removed by the author"
  on public.toy_idea_participants for delete to authenticated
  using (
    profile_id = auth.uid()
    or exists (select 1 from public.toy_ideas i where i.id = idea_id and i.author_id = auth.uid())
  );

create policy "Admin full access to idea participants"
  on public.toy_idea_participants for all using (public.is_admin());


-- The thread. Shape copied from toy_transaction_messages (026).
create table public.toy_idea_messages (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.toy_ideas on delete cascade,
  sender_id uuid not null references public.profiles,
  kind text not null default 'user' check (kind in ('system', 'user')),
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.toy_idea_messages enable row level security;

-- The brief recruits; the conversation does not need an audience. Never anon,
-- even when the challenge itself is public.
create policy "Author and participants read the thread"
  on public.toy_idea_messages for select to authenticated
  using (
    exists (select 1 from public.toy_ideas i where i.id = idea_id and i.author_id = auth.uid())
    or exists (
      select 1 from public.toy_idea_participants p
      where p.idea_id = toy_idea_messages.idea_id and p.profile_id = auth.uid()
    )
  );

create policy "Author and participants post to the thread"
  on public.toy_idea_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      exists (select 1 from public.toy_ideas i where i.id = idea_id and i.author_id = auth.uid())
      or exists (
        select 1 from public.toy_idea_participants p
        where p.idea_id = toy_idea_messages.idea_id and p.profile_id = auth.uid()
      )
    )
  );

create policy "Admin full access to idea messages"
  on public.toy_idea_messages for all using (public.is_admin());


create index toy_idea_messages_idea_created_idx
  on public.toy_idea_messages (idea_id, created_at);

-- No new policy comes with this. Realtime's postgres_changes runs each
-- subscriber's stream through the table's existing RLS — see 031.
alter publication supabase_realtime add table public.toy_idea_messages;
```


> **Grants deliberately omitted.** `004_data_api_grants.sql` sets default
> privileges granting all on future tables to anon/authenticated, and no
> table-creating migration since (026, 033) repeats table-level grants. RLS is
> what restricts access here, not the grant. Adding a redundant grant is
> misleading: a reader could think DELETE is withheld by the grant when it is
> withheld by RLS alone.

- [ ] **Step 2: Apply and verify a stranger cannot read the thread**

```bash
supabase db push
```

As a signed-in user who is neither author nor participant:

```sql
select count(*) from public.toy_idea_messages;  -- expect 0
```

Expected: 0.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/038_toy_idea_collaboration.sql
git commit -m "feat(db): add idea participants and the private challenge thread"
```

---

## Task 3: Teach `notifications` about ideas

**Files:**
- Create: `supabase/migrations/039_notifications_idea_subject.sql`

**Interfaces:**
- Produces: `notifications.tutorial_id` nullable, new `notifications.idea_id`, constraint `notifications_one_subject`, five new `type` values.

- [ ] **Step 1: Write the migration**

```sql
-- 039_notifications_idea_subject.sql
-- WHY: notifications.tutorial_id was `not null`, so nothing that is not a
--      tutorial could raise a notification. Design challenges need to.
-- The check keeps the row honest: exactly one subject, never both, never neither.
-- Every existing writer keeps working unchanged.

alter table public.notifications alter column tutorial_id drop not null;

alter table public.notifications
  add column idea_id uuid references public.toy_ideas on delete cascade;

alter table public.notifications
  add constraint notifications_one_subject
  check (num_nonnulls(tutorial_id, idea_id) = 1);

alter table public.notifications drop constraint notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
    'collaborator_removed', 'collaborator_left',
    'tutorial_approved', 'tutorial_rejected',
    'idea_approved', 'idea_rejected',
    'challenge_joined', 'challenge_left', 'challenge_removed'
  ));

```

- [ ] **Step 2: Verify the constraint name before applying**

The `drop constraint notifications_type_check` line assumes Postgres's default
generated name. Confirm it:

```bash
psql "$DATABASE_URL" -c "\d public.notifications" | grep -i check
```

If the name differs, correct the migration to match before pushing. Do not guess.

- [ ] **Step 3: Apply and verify**

```bash
supabase db push
```

```sql
-- both null: must fail
insert into public.notifications (recipient_id, type, actor_name)
  values ('<id>', 'idea_approved', 'SPLAT');
-- both set: must fail
insert into public.notifications (recipient_id, type, actor_name, tutorial_id, idea_id)
  values ('<id>', 'idea_approved', 'SPLAT', '<t>', '<i>');
```

Expected: both raise `new row ... violates check constraint "notifications_one_subject"`.

- [ ] **Step 4: Verify existing notification writers still pass**

```bash
pnpm --filter @splat-connect/api test:integration -- notifications
```

Expected: PASS — the alter is additive for tutorials.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/039_notifications_idea_subject.sql
git commit -m "feat(db): let notifications carry an idea subject"
```

---

## Task 4: Shared types

**Files:**
- Modify: `packages/types/src/index.ts`
- Modify: `packages/web/components/notifications-list.tsx`

**Interfaces:**
- Produces: `ToyIdeaStatus`, `ContactPref`, `CONTACT_PREFS`, `ToyIdea`, `ToyIdeaParticipant`, `ToyIdeaMessage`, `ToyIdeaDetail`, `ThreadMessage`. Every later task imports from here.

- [ ] **Step 1: Add the types**

Append near the existing `ToyTransactionMessage` block (around line 216) so the
thread types sit together:

```ts
export type ToyIdeaStatus = 'pending' | 'challenge' | 'rejected' | 'graduated'

/** How involved the author wants to be if their idea becomes a challenge. */
export const CONTACT_PREFS = ['clarification', 'co_design', 'user_testing'] as const
export type ContactPref = (typeof CONTACT_PREFS)[number]

export interface ToyIdea {
  id: string
  author_id: string
  title: string
  summary: string
  description: string
  intended_use: string
  primary_user: string
  contact_prefs: ContactPref[]
  status: ToyIdeaStatus
  review_note: string | null
  tutorial_id: string | null
  created_at: string
  updated_at: string
}

export interface ToyIdeaParticipant {
  idea_id: string
  profile_id: string
  joined_at: string
  /** Joined from profiles at read time for display. */
  name?: string | null
}

export interface ToyIdeaMessage {
  id: string
  idea_id: string
  sender_id: string
  kind: 'system' | 'user'
  body: string
  created_at: string
}

export interface ToyIdeaDetail extends ToyIdea {
  author_name: string | null
  participants: ToyIdeaParticipant[]
  /** Absent for viewers who may not read the thread. */
  messages?: ToyIdeaMessage[]
}

/**
 * The structural minimum ExchangeChat needs to render a thread. Both
 * ToyTransactionMessage and ToyIdeaMessage satisfy it, which is why the
 * component takes this instead of either concrete type.
 */
export interface ThreadMessage {
  id: string
  sender_id: string
  kind: 'system' | 'user'
  body: string
  created_at: string
}
```

- [ ] **Step 2: Extend the notification types — the typecheck WILL fail without this**

Migration 039 added five notification types and an `idea_id` column. Extend the
existing union and interface in the same file:

```ts
export type NotificationType =
  // ...the 12 existing values, unchanged...
  | 'idea_approved'
  | 'idea_rejected'
  | 'challenge_joined'
  | 'challenge_left'
  | 'challenge_removed'

export interface Notification {
  // ...existing fields, unchanged...
  idea_id?: string | null
}
```

`packages/web/components/notifications-list.tsx:12` declares
`const COPY: Record<NotificationType, (n: Notification) => string>`. That mapping
is **exhaustive**, so adding union values breaks its typecheck until it gains five
entries. Add them:

```ts
  idea_approved: () => 'Your idea was published as a design challenge',
  idea_rejected: () => 'Your idea was reviewed and not taken forward',
  challenge_joined: (n) => `${n.actor_name} joined your design challenge`,
  challenge_left: (n) => `${n.actor_name} left your design challenge`,
  challenge_removed: (n) => `${n.actor_name} removed you from a design challenge`,
```

No idea title appears in this copy, deliberately: the table has no `idea_title`
column and adding one would mean a fourth migration for an inbox line. The link
carries the context instead.

Extend `linkFor` in the same file, which currently branches on
`toy_transaction_id` then `tutorial_id`:

```ts
  // A rejected idea has no public page — 037's select policy hides anything
  // that is not 'challenge' or 'graduated' — so send the author to their own list.
  if (n.idea_id) {
    return n.type === 'idea_rejected'
      ? '/dashboard/challenges'
      : `/get-involved/design-challenges/${n.idea_id}`
  }
```

- [ ] **Step 3: Typecheck**

```bash
pnpm -r typecheck
```

Expected: PASS. If `notifications-list.tsx` errors on a missing `COPY` key, Step 2
is incomplete — that error is the exhaustiveness check doing its job.

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/index.ts packages/web/components/notifications-list.tsx
git commit -m "feat(types): add design challenge types and a structural thread message"
```

---

## Task 5: Submit and list own ideas

**Files:**
- Create: `packages/api/src/routes/toy-ideas.ts`
- Create: `packages/api/tests/unit/routes/toy-ideas.test.ts`
- Modify: `packages/api/src/app.ts` (add the mount after line 71)

**Interfaces:**
- Consumes: types from Task 4; `createUserClient` from `../supabase/user-client.js`; `AuthVariables` from `../middleware/auth.js`.
- Produces: `POST /api/ideas`, `GET /api/ideas/mine`. Exports `default toyIdeas` (Hono app) and `readIdeaBody(body: unknown): Record<string, unknown> | null`.

- [ ] **Step 1: Write failing tests**

```ts
// packages/api/tests/unit/routes/toy-ideas.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockFrom = vi.fn()

// --- Mock strategy ---
// Replaces the per-user Supabase client with one controlled fake so these tests
// exercise validation and status codes only. RLS itself is covered by the
// integration tests in tests/integration/toy-ideas/.
vi.mock('../../../src/supabase/user-client.js', () => ({
  createUserClient: () => ({ from: mockFrom }),
}))

const { default: toyIdeas } = await import('../../../src/routes/toy-ideas.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', 'contributor')
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', toyIdeas)
  return app
}

const VALID = {
  title: 'Weighted spoon holder',
  summary: 'A holder that stops a spoon tipping',
  description: 'Long description of the problem',
  intended_use: 'Mealtimes at home, daily',
  primary_user: 'Six-year-old with limited grip',
  contact_prefs: ['co_design'],
}

function post(body: unknown) {
  return makeApp().request('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockFrom.mockReset()
})

describe('POST /ideas', () => {
  // Tests: every required narrative field must be present and non-blank
  // How:   posts VALID minus one field at a time; checks 400
  // Chain: a half-filled idea reaches an admin with nothing to judge → reviewers
  //        reject blindly and authors never learn why
  it.each(['title', 'summary', 'description', 'intended_use', 'primary_user'])(
    'rejects a missing %s',
    async (field) => {
      const body: Record<string, unknown> = { ...VALID }
      delete body[field]
      expect((await post(body)).status).toBe(400)
    }
  )

  // Tests: blank-but-present strings are rejected the same as missing ones
  // How:   posts a whitespace-only title
  // Chain: '   ' would otherwise pass a truthiness check and store an untitled idea
  it('rejects a whitespace-only field', async () => {
    expect((await post({ ...VALID, title: '   ' })).status).toBe(400)
  })

  // Tests: contact_prefs accepts only the three known values
  // How:   posts an unknown pref
  // Chain: an unvalidated array reaches the UI, which renders nothing for the
  //        unknown value and silently drops the author's stated involvement
  it('rejects an unknown contact pref', async () => {
    expect((await post({ ...VALID, contact_prefs: ['sabotage'] })).status).toBe(400)
  })

  // Tests: a valid submission is stored as the caller's own pending idea
  // How:   asserts the insert payload carries author_id from context, not the body
  // Chain: trusting a body-supplied author_id would let anyone submit as someone else
  it('stores the idea as pending, owned by the caller', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'idea-1' }, error: null })
    const insert = vi.fn().mockReturnValue({ select: () => ({ single }) })
    mockFrom.mockReturnValue({ insert })

    const res = await post({ ...VALID, author_id: 'somebody-else' })

    expect(res.status).toBe(201)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ author_id: 'user-1', status: 'pending' })
    )
  })
})
```

- [ ] **Step 2: Run and verify failure**

```bash
pnpm --filter @splat-connect/api test:unit -- toy-ideas
```

Expected: FAIL — `Cannot find module '../../../src/routes/toy-ideas.js'`.

- [ ] **Step 3: Implement**

```ts
// packages/api/src/routes/toy-ideas.ts
import { Hono } from 'hono'
import { CONTACT_PREFS, type ContactPref } from '@splat-connect/types'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'

const toyIdeas = new Hono<{ Variables: AuthVariables }>()

const NARRATIVE_FIELDS = [
  'title', 'summary', 'description', 'intended_use', 'primary_user',
] as const

/**
 * Every narrative field is required and must survive trimming. A half-filled
 * idea reaches a reviewer with nothing to judge, so this rejects rather than
 * storing blanks — the same reasoning as readPickupAddress in toy-transactions.
 */
export function readIdeaBody(body: unknown): Record<string, unknown> | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  const source = body as Record<string, unknown>
  const out: Record<string, unknown> = {}

  for (const field of NARRATIVE_FIELDS) {
    const value = source[field]
    if (typeof value !== 'string' || !value.trim()) return null
    out[field] = value.trim()
  }

  const prefs = source.contact_prefs ?? []
  if (!Array.isArray(prefs)) return null
  if (!prefs.every((p) => CONTACT_PREFS.includes(p as ContactPref))) return null
  out.contact_prefs = prefs

  return out
}

toyIdeas.post('/', async (c) => {
  const fields = readIdeaBody(await c.req.json().catch(() => null))
  if (!fields) return c.json({ error: 'All fields are required' }, 400)

  // author_id comes from the verified token, never the body.
  const { data, error } = await createUserClient(c.get('token'))
    .from('toy_ideas')
    .insert({ ...fields, author_id: c.get('userId'), status: 'pending' })
    .select('*')
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

toyIdeas.get('/mine', async (c) => {
  const { data, error } = await createUserClient(c.get('token'))
    .from('toy_ideas')
    .select('*')
    .eq('author_id', c.get('userId'))
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})

export default toyIdeas
```

Then mount it in `packages/api/src/app.ts`, after the `/api/notifications` line:

```ts
import toyIdeas from './routes/toy-ideas.js'
// ...
app.route('/api/ideas', toyIdeas)
```

- [ ] **Step 4: Run and verify pass**

```bash
pnpm --filter @splat-connect/api test:unit -- toy-ideas
```

Expected: PASS, all 8 cases.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/toy-ideas.ts packages/api/tests/unit/routes/toy-ideas.test.ts packages/api/src/app.ts
git commit -m "feat(api): accept idea submissions and list an author's own"
```

---


> **DB errors return 500, not 400.** A failed Supabase call is a server-side
> problem, not a client mistake. The repo is near-unanimous: 76 call sites return
> 500 for `error.message`, 2 return 400. The explicit `42501` → 403 mappings are
> different and stay — an RLS refusal *is* about the caller.

## Task 6: Join, leave, remove

**Files:**
- Modify: `packages/api/src/routes/toy-ideas.ts`
- Modify: `packages/api/tests/unit/routes/toy-ideas.test.ts`

**Interfaces:**
- Consumes: Task 5's route file.
- Produces: `POST /api/ideas/:id/join`, `DELETE /api/ideas/:id/participants/:profileId`. Exports `systemMessage(client, ideaId, actorId, body)`, used by the join and remove handlers in this task. Task 10 writes its own system message directly, because it runs in `admin.ts` with the admin client and does not import this module.

- [ ] **Step 1: Write failing tests**

Append to `toy-ideas.test.ts`:

```ts
describe('POST /ideas/:id/join', () => {
  // Tests: a join writes both the participant row and a system message
  // How:   asserts inserts against both tables in one request
  // Chain: without the system message the author has no in-thread record that
  //        someone arrived — the notification is the only trace, and it is dismissible
  it('records the participant and announces it in the thread', async () => {
    const inserts: Record<string, unknown[]> = { toy_idea_participants: [], toy_idea_messages: [] }
    mockFrom.mockImplementation((table: string) => ({
      insert: (payload: unknown) => {
        inserts[table]?.push(payload)
        return { select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }
      },
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { author_id: 'author-9', title: 'T', status: 'challenge' }, error: null }) }),
      }),
    }))

    const res = await makeApp().request('/idea-1/join', { method: 'POST' })

    expect(res.status).toBe(201)
    expect(inserts.toy_idea_participants).toHaveLength(1)
    expect(inserts.toy_idea_messages).toHaveLength(1)
  })

  // Tests: RLS rejection surfaces as 403, not 500
  // How:   makes the participant insert fail with Postgres' RLS violation code
  // Chain: joining a pending idea is blocked by policy; a 500 would read as a
  //        site fault rather than "you cannot join this"
  it('returns 403 when the policy refuses the join', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { author_id: 'a', title: 'T', status: 'pending' }, error: null }) }),
      }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { code: '42501', message: 'rls' } }) }) }),
    }))

    expect((await makeApp().request('/idea-1/join', { method: 'POST' })).status).toBe(403)
  })
})

describe('DELETE /ideas/:id/participants/:profileId', () => {
  // Tests: removing someone else is refused unless you authored the idea
  // How:   the idea's author is a different user; caller targets a third party
  // Chain: any participant could otherwise evict the others from a thread they joined
  it('refuses to remove a third party when the caller is not the author', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { author_id: 'someone-else', title: 'T', status: 'challenge' }, error: null }) }),
      }),
    }))

    const res = await makeApp().request('/idea-1/participants/user-2', { method: 'DELETE' })
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run and verify failure**

```bash
pnpm --filter @splat-connect/api test:unit -- toy-ideas
```

Expected: FAIL — 404s, because the routes do not exist.

- [ ] **Step 3: Implement**

Add to `toy-ideas.ts`:

```ts
import { createAdminClient } from '../supabase/client.js'

const RLS_VIOLATION = '42501'

type Client = ReturnType<typeof createUserClient>

/**
 * Join, leave and removal each write one of these. It is what makes the
 * participant history readable in order alongside the conversation, instead of
 * living only in dismissible notifications.
 */
export async function systemMessage(ideaId: string, actorId: string, body: string) {
  // Written with the ADMIN client, not the caller's. A kind='system' row is
  // platform-authored — a record that an event happened — not user speech.
  //
  // This is also load-bearing for self-leave: 038's insert policy requires the
  // sender to be the author or a current participant, so once someone's
  // participant row is deleted they can no longer write "X left this challenge".
  // Writing it as the user silently produced no message — the error was never
  // checked — and the author lost exactly the record they need. Using the admin
  // client makes the ordering of delete-vs-message irrelevant.
  const { error } = await createAdminClient()
    .from('toy_idea_messages')
    .insert({ idea_id: ideaId, sender_id: actorId, kind: 'system', body })
  if (error) console.error('system message failed', { ideaId, error: error.message })
}

async function loadIdea(client: Client, id: string) {
  return client.from('toy_ideas').select('author_id, title, status').eq('id', id).single()
}

async function actorName(userId: string): Promise<string> {
  const { data } = await createAdminClient()
    .from('profiles').select('name').eq('id', userId).single()
  return (data?.name as string) ?? 'Someone'
}

toyIdeas.post('/:id/join', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')
  const client = createUserClient(c.get('token'))

  const { data: idea, error: loadError } = await loadIdea(client, id)
  if (loadError || !idea) return c.json({ error: 'Challenge not found' }, 404)

  const { error } = await client
    .from('toy_idea_participants')
    .insert({ idea_id: id, profile_id: userId })
    .select('idea_id')
    .single()

  // The policy allows a join only onto a published challenge you did not author.
  if (error?.code === RLS_VIOLATION) return c.json({ error: 'You cannot join this challenge' }, 403)
  if (error) return c.json({ error: error.message }, 500)

  const name = await actorName(userId)
  await systemMessage(id, userId, `${name} joined this challenge`)
  await createAdminClient().from('notifications').insert({
    recipient_id: idea.author_id, type: 'challenge_joined', idea_id: id, actor_name: name,
  })

  return c.json({ joined: true }, 201)
})

toyIdeas.delete('/:id/participants/:profileId', async (c) => {
  const id = c.req.param('id')
  const target = c.req.param('profileId')
  const userId = c.get('userId')
  const client = createUserClient(c.get('token'))

  const { data: idea, error: loadError } = await loadIdea(client, id)
  if (loadError || !idea) return c.json({ error: 'Challenge not found' }, 404)

  const leaving = target === userId
  if (!leaving && idea.author_id !== userId && c.get('role') !== 'admin') {
    return c.json({ error: 'Only the author may remove a participant' }, 403)
  }

  // .select() so we learn whether a row actually went. A DELETE matching nothing
  // is a successful no-op in Postgres, and 038's delete policy has no row to
  // evaluate — so without this check any signed-in user could "leave" a challenge
  // they never joined, and an author could "remove" someone who was never a
  // participant. Both fabricate a departure: a system message in the thread and a
  // notification to a real person who did nothing.
  const { data: removed, error } = await client
    .from('toy_idea_participants')
    .delete()
    .eq('idea_id', id)
    .eq('profile_id', target)
    .select('profile_id')
  if (error) return c.json({ error: error.message }, 500)
  if (!removed || removed.length === 0) {
    return c.json({ error: 'That person is not part of this challenge' }, 404)
  }

  const name = leaving ? await actorName(userId) : await actorName(target)
  await systemMessage(id, userId, leaving ? `${name} left this challenge` : `${name} was removed from this challenge`)
  await createAdminClient().from('notifications').insert({
    recipient_id: leaving ? idea.author_id : target,
    type: leaving ? 'challenge_left' : 'challenge_removed',
    idea_id: id,
    // On a self-leave the actor and the subject are the same person, so reuse
    // the name already fetched rather than a second round-trip.
    actor_name: leaving ? name : await actorName(userId),
  })

  return c.json({ removed: true })
})
```

- [ ] **Step 4: Run and verify pass**

```bash
pnpm --filter @splat-connect/api test:unit -- toy-ideas
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/toy-ideas.ts packages/api/tests/unit/routes/toy-ideas.test.ts
git commit -m "feat(api): self-serve challenge joining with author-side removal"
```

---

## Task 7: The thread endpoints

**Files:**
- Modify: `packages/api/src/routes/toy-ideas.ts`
- Modify: `packages/api/tests/unit/routes/toy-ideas.test.ts`

**Interfaces:**
- Produces: `GET /api/ideas/:id/messages`, `POST /api/ideas/:id/messages`.

- [ ] **Step 1: Write failing tests**

```ts
describe('POST /ideas/:id/messages', () => {
  // Tests: an empty message body is refused before it reaches the database
  // How:   posts a whitespace-only body
  // Chain: blank rows would break the message grouping in ExchangeChat, which
  //        assumes every rendered message has text
  it('rejects a blank message', async () => {
    const res = await makeApp().request('/idea-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: '  ' }),
    })
    expect(res.status).toBe(400)
  })

  // Tests: a non-participant's post is refused as 403
  // How:   the insert returns Postgres' RLS violation code
  // Chain: the thread is private even on a public challenge; a 500 here would
  //        leak that the challenge exists while looking like a fault
  it('returns 403 when the policy refuses the post', async () => {
    mockFrom.mockImplementation(() => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { code: '42501', message: 'rls' } }) }) }),
    }))
    const res = await makeApp().request('/idea-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'hello' }),
    })
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run and verify failure**

```bash
pnpm --filter @splat-connect/api test:unit -- toy-ideas
```

Expected: FAIL — 404.

- [ ] **Step 3: Implement**

```ts
toyIdeas.get('/:id/messages', async (c) => {
  const { data, error } = await createUserClient(c.get('token'))
    .from('toy_idea_messages')
    .select('*')
    .eq('idea_id', c.req.param('id'))
    .order('created_at', { ascending: true })

  if (error) return c.json({ error: error.message }, 500)
  // RLS returns an empty set rather than an error to a non-participant, which
  // is the correct answer: they see a challenge with no readable thread.
  return c.json(data ?? [])
})

toyIdeas.post('/:id/messages', async (c) => {
  const parsed = await c.req.json().catch(() => null)
  const body = typeof parsed?.body === 'string' ? parsed.body.trim() : ''
  if (!body) return c.json({ error: 'A message cannot be empty' }, 400)

  const { data, error } = await createUserClient(c.get('token'))
    .from('toy_idea_messages')
    .insert({ idea_id: c.req.param('id'), sender_id: c.get('userId'), kind: 'user', body })
    .select('*')
    .single()

  if (error?.code === RLS_VIOLATION) return c.json({ error: 'You are not part of this challenge' }, 403)
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})
```

- [ ] **Step 4: Run and verify pass**

```bash
pnpm --filter @splat-connect/api test:unit -- toy-ideas
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/toy-ideas.ts packages/api/tests/unit/routes/toy-ideas.test.ts
git commit -m "feat(api): read and post messages on a challenge thread"
```

---

## Task 8: Public challenge listing and detail

**Files:**
- Modify: `packages/api/src/routes/public.ts`

**Interfaces:**
- Produces: `GET /api/public/challenges`, `GET /api/public/challenges/:id`. Returns `ToyIdeaDetail` without `messages` — the thread is never anon-readable.

- [ ] **Step 1: Write failing integration test**

```ts
// packages/api/tests/integration/toy-ideas/idea-lifecycle.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import app from '../../../src/app.js'

let author: TestUser
let pendingId: string
let publishedId: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  const base = {
    author_id: author.id, title: 'T', summary: 'S', description: 'D',
    intended_use: 'U', primary_user: 'P',
  }
  const { data } = await adminClient().from('toy_ideas')
    .insert([{ ...base, status: 'pending' }, { ...base, status: 'challenge' }])
    .select('id, status')
  pendingId = data!.find((r) => r.status === 'pending')!.id
  publishedId = data!.find((r) => r.status === 'challenge')!.id
})

afterAll(async () => {
  await adminClient().from('toy_ideas').delete().in('id', [pendingId, publishedId])
  await deleteTestUser(author.id)
})

describe('GET /api/public/challenges', () => {
  it('lists published challenges and never pending ones', async () => {
    const res = await app.request('/api/public/challenges')
    const body = (await res.json()) as { id: string }[]
    expect(body.some((i) => i.id === publishedId)).toBe(true)
    expect(body.some((i) => i.id === pendingId)).toBe(false)
  })

  it('404s a pending idea by direct id', async () => {
    const res = await app.request(`/api/public/challenges/${pendingId}`)
    expect(res.status).toBe(404)
  })

  it('never returns the thread to an anonymous caller', async () => {
    const res = await app.request(`/api/public/challenges/${publishedId}`)
    expect(await res.json()).not.toHaveProperty('messages')
  })
})
```

- [ ] **Step 2: Run and verify failure**

```bash
pnpm --filter @splat-connect/api test:integration -- toy-ideas
```

Expected: FAIL — 404 on the listing route.

- [ ] **Step 3: Implement**

Add to `packages/api/src/routes/public.ts`, following the existing
`publicRoutes.get('/organizations', ...)` shape:

```ts
publicRoutes.get('/challenges', async (c) => {
  const { data, error } = await createAdminClient()
    .from('toy_ideas')
    .select('id, author_id, title, summary, contact_prefs, status, created_at')
    .in('status', ['challenge', 'graduated'])
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})

publicRoutes.get('/challenges/:id', async (c) => {
  const admin = createAdminClient()
  const { data: idea } = await admin
    .from('toy_ideas')
    // Explicit columns, never select('*'). review_note holds an admin's private
    // rejection reasoning — 037 says of it "Never shown publicly" — and a '*'
    // select plus `...rest` spread puts it straight on the wire for anonymous
    // callers. An explicit list is fail-closed: a future private column has to be
    // deliberately added here to be exposed, rather than leaking the day it lands.
    .select('id, author_id, title, summary, description, intended_use, primary_user, contact_prefs, status, tutorial_id, created_at, updated_at, profiles!toy_ideas_author_id_fkey(name)')
    .eq('id', c.req.param('id'))
    .in('status', ['challenge', 'graduated'])
    .maybeSingle()

  // A pending or rejected idea is indistinguishable from one that never existed.
  if (!idea) return c.json({ error: 'Not found' }, 404)

  const { data: participants } = await admin
    .from('toy_idea_participants')
    .select('idea_id, profile_id, joined_at, profiles(name)')
    .eq('idea_id', idea.id)

  const { profiles, ...rest } = idea as Record<string, any>
  // Messages are deliberately absent: the brief recruits, the conversation is private.
  return c.json({
    ...rest,
    author_name: profiles?.name ?? null,
    participants: (participants ?? []).map((p: any) => ({
      idea_id: p.idea_id, profile_id: p.profile_id, joined_at: p.joined_at,
      name: p.profiles?.name ?? null,
    })),
  })
})
```

- [ ] **Step 4: Run and verify pass**

```bash
pnpm --filter @splat-connect/api test:integration -- toy-ideas
```

Expected: PASS, 3 cases.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/public.ts packages/api/tests/integration/toy-ideas/idea-lifecycle.test.ts
git commit -m "feat(api): publish challenges without exposing their threads"
```

---

## Task 9: Admin review queue

**Files:**
- Modify: `packages/api/src/routes/admin.ts`

**Interfaces:**
- Produces: `GET /api/admin/ideas`, `PATCH /api/admin/ideas/:id/status` taking `{ status: 'challenge' | 'rejected', review_note?: string }`.

- [ ] **Step 1: Write failing test**

Append to `packages/api/tests/integration/toy-ideas/idea-lifecycle.test.ts`:

```ts
describe('PATCH /api/admin/ideas/:id/status', () => {
  it('publishes a pending idea and notifies its author', async () => {
    const admin = await createTestUser('admin')
    const res = await app.request(`/api/admin/ideas/${pendingId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'challenge' }),
    })
    expect(res.status).toBe(200)

    const { data } = await adminClient()
      .from('notifications').select('type').eq('idea_id', pendingId)
    expect(data!.map((n) => n.type)).toContain('idea_approved')
    await deleteTestUser(admin.id)
  })

  it('rejects a status the review flow does not allow', async () => {
    const admin = await createTestUser('admin')
    const res = await app.request(`/api/admin/ideas/${publishedId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'graduated' }),
    })
    expect(res.status).toBe(400)
    await deleteTestUser(admin.id)
  })
})
```

- [ ] **Step 2: Run and verify failure**

```bash
pnpm --filter @splat-connect/api test:integration -- toy-ideas
```

Expected: FAIL — 404.

- [ ] **Step 3: Implement**

Add to `admin.ts`, beside the existing `/tutorials` handlers:

```ts
admin.get('/ideas', async (c) => {
  const { data, error } = await createAdminClient()
    .from('toy_ideas')
    // Explicit columns, never select('*'). review_note holds an admin's private
    // rejection reasoning — 037 says of it "Never shown publicly" — and a '*'
    // select plus `...rest` spread puts it straight on the wire for anonymous
    // callers. An explicit list is fail-closed: a future private column has to be
    // deliberately added here to be exposed, rather than leaking the day it lands.
    .select('id, author_id, title, summary, description, intended_use, primary_user, contact_prefs, status, tutorial_id, created_at, updated_at, profiles!toy_ideas_author_id_fkey(name)')
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})

// Only the review transition lives here. Graduation is its own endpoint because
// it writes a tutorial and contributor rows, not just a status.
const REVIEW_OUTCOMES = ['challenge', 'rejected'] as const

admin.patch('/ideas/:id/status', async (c) => {
  const body = await c.req.json().catch(() => null)
  const status = body?.status
  if (!REVIEW_OUTCOMES.includes(status)) {
    return c.json({ error: 'Status must be challenge or rejected' }, 400)
  }
  const reviewNote = typeof body?.review_note === 'string' ? body.review_note.trim() : null

  const client = createAdminClient()
  const { data, error } = await client
    .from('toy_ideas')
    .update({ status, review_note: reviewNote, updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .eq('status', 'pending')
    .select('id, author_id')
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'No pending idea with that id' }, 404)

  await client.from('notifications').insert({
    recipient_id: data.author_id,
    type: status === 'challenge' ? 'idea_approved' : 'idea_rejected',
    idea_id: data.id,
    actor_name: 'SPLAT',
  })

  return c.json({ id: data.id, status })
})
```

- [ ] **Step 4: Run and verify pass**

```bash
pnpm --filter @splat-connect/api test:integration -- toy-ideas
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/admin.ts packages/api/tests/integration/toy-ideas/idea-lifecycle.test.ts
git commit -m "feat(api): admin review queue for submitted ideas"
```

---

## Task 10: Graduation

**Files:**
- Modify: `packages/api/src/routes/admin.ts`
- Create: `packages/api/tests/integration/toy-ideas/graduation.test.ts`

**Interfaces:**
- Produces: `POST /api/admin/ideas/:id/graduate` → `{ tutorial_id }`.

- [ ] **Step 1: Write failing test**

```ts
// packages/api/tests/integration/toy-ideas/graduation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import app from '../../../src/app.js'

let author: TestUser
let joiner: TestUser
let admin: TestUser
let ideaId: string
let tutorialId: string | null = null

beforeAll(async () => {
  author = await createTestUser('contributor')
  joiner = await createTestUser('contributor')
  admin = await createTestUser('admin')
  const { data } = await adminClient().from('toy_ideas').insert({
    author_id: author.id, title: 'Weighted spoon', summary: 'S', description: 'D',
    intended_use: 'U', primary_user: 'P', status: 'challenge',
  }).select('id').single()
  ideaId = data!.id
  await adminClient().from('toy_idea_participants').insert({ idea_id: ideaId, profile_id: joiner.id })
})

afterAll(async () => {
  if (tutorialId) await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await adminClient().from('toy_ideas').delete().eq('id', ideaId)
  await Promise.all([author, joiner, admin].map((u) => deleteTestUser(u.id)))
})

function asAdmin() {
  return { method: 'POST', headers: { Authorization: `Bearer ${admin.token}` } }
}

describe('POST /api/admin/ideas/:id/graduate', () => {
  it('creates a draft tutorial with the author primary and joiners as collaborators', async () => {
    const res = await app.request(`/api/admin/ideas/${ideaId}/graduate`, asAdmin())
    expect(res.status).toBe(201)
    tutorialId = ((await res.json()) as { tutorial_id: string }).tutorial_id

    const { data: tutorial } = await adminClient()
      .from('tutorials').select('status, difficulty').eq('id', tutorialId).single()
    expect(tutorial!.status).toBe('draft')
    expect(tutorial!.difficulty).toBe('medium')

    const { data: contributors } = await adminClient()
      .from('tutorial_contributors').select('profile_id, role').eq('tutorial_id', tutorialId)
    expect(contributors).toEqual(
      expect.arrayContaining([
        { profile_id: author.id, role: 'primary' },
        { profile_id: joiner.id, role: 'collaborator' },
      ])
    )

    const { data: idea } = await adminClient()
      .from('toy_ideas').select('status, tutorial_id').eq('id', ideaId).single()
    expect(idea).toMatchObject({ status: 'graduated', tutorial_id: tutorialId })
  })

  it('refuses to graduate the same challenge twice', async () => {
    const res = await app.request(`/api/admin/ideas/${ideaId}/graduate`, asAdmin())
    expect(res.status).toBe(409)
  })
})
```

- [ ] **Step 2: Run and verify failure**

```bash
pnpm --filter @splat-connect/api test:integration -- graduation
```

Expected: FAIL — 404.

- [ ] **Step 3: Implement**

```ts
admin.post('/ideas/:id/graduate', async (c) => {
  const client = createAdminClient()
  const id = c.req.param('id')

  const { data: idea } = await client
    .from('toy_ideas').select('id, author_id, title, summary, status').eq('id', id).maybeSingle()
  if (!idea) return c.json({ error: 'Not found' }, 404)
  // A challenge graduates once. A second call is a mistake, not an update.
  if (idea.status !== 'challenge') return c.json({ error: 'Already graduated' }, 409)

  const { data: tutorial, error: tutorialError } = await client
    .from('tutorials')
    // difficulty is NOT NULL on tutorials with a check constraint; an idea carries
    // no difficulty, so a draft starts at 'medium' and its contributor corrects it
    // before submitting. Do not relax the column to serve this one caller.
    .insert({ title: idea.title, description: idea.summary, status: 'draft', difficulty: 'medium' })
    .select('id')
    .single()
  if (tutorialError) return c.json({ error: tutorialError.message }, 500)

  const { data: participants } = await client
    .from('toy_idea_participants').select('profile_id').eq('idea_id', id)

  // The shape tutorial_contributors already stores, so this copy is free.
  await client.from('tutorial_contributors').insert([
    { tutorial_id: tutorial.id, profile_id: idea.author_id, role: 'primary' },
    ...(participants ?? []).map((p: { profile_id: string }) => ({
      tutorial_id: tutorial.id, profile_id: p.profile_id, role: 'collaborator',
    })),
  ])

  await client.from('toy_ideas')
    .update({ status: 'graduated', tutorial_id: tutorial.id, updated_at: new Date().toISOString() })
    .eq('id', id)

  await client.from('toy_idea_messages').insert({
    idea_id: id, sender_id: idea.author_id, kind: 'system',
    body: 'This challenge became a draft guide.',
  })

  return c.json({ tutorial_id: tutorial.id }, 201)
})
```

- [ ] **Step 4: Run and verify pass**

```bash
pnpm --filter @splat-connect/api test:integration -- graduation
```

Expected: PASS, 2 cases.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/admin.ts packages/api/tests/integration/toy-ideas/graduation.test.ts
git commit -m "feat(api): graduate a challenge into a draft guide"
```

---

## Task 11: Widen `ExchangeChat` to any thread

**Files:**
- Modify: `packages/web/components/exchange-chat.tsx`

**Interfaces:**
- Consumes: `ThreadMessage` from Task 4.
- Produces: `ExchangeChat` accepting `ThreadMessage[]`. Existing `ToyTransactionMessage` callers are unaffected — that type structurally satisfies `ThreadMessage`.
- Already present, do NOT change: `ExchangeChat` takes a `nameFor: (senderId: string) => string` prop (`exchange-chat.tsx:80,89`). The component never looks up names itself; the caller resolves them. This is why no profiles RLS policy is needed for the thread — see Task 14.

- [ ] **Step 1: Change the type only**

Replace the `ToyTransactionMessage` import and the `Group` type's message field:

```ts
import type { ThreadMessage } from '@splat-connect/types'

type Group = {
  senderId: string
  kind: ThreadMessage['kind']
  messages: ThreadMessage[]
  /** First group of its calendar day, so it carries the date separator. */
  opensDay: boolean
}
```

Update the component's props to take `messages: ThreadMessage[]`. Change nothing
else — no new props, no generics, no second component.

- [ ] **Step 2: Verify existing consumers still typecheck and pass**

```bash
pnpm --filter @splat-connect/web typecheck && pnpm --filter @splat-connect/web test:unit
```

Expected: PASS. `toy-transaction-thread.tsx` compiles unchanged.

- [ ] **Step 3: Commit**

```bash
git add packages/web/components/exchange-chat.tsx
git commit -m "refactor(web): let the chat render any thread, not just exchanges"
```

---

## Task 12: The submission form

**Files:**
- Create: `packages/web/components/idea-form.tsx`
- Create: `packages/web/tests/unit/components/idea-form.test.tsx`
- Modify: `packages/web/app/get-involved/submit-an-idea/page.tsx`

**Interfaces:**
- Produces: `<IdeaForm />` — a client component posting to `/api/ideas`.

- [ ] **Step 1: Write failing test**

```tsx
// packages/web/tests/unit/components/idea-form.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IdeaForm } from '@/components/idea-form'

describe('IdeaForm', () => {
  it('asks for every field the reviewer needs', () => {
    render(<IdeaForm />)
    for (const label of [/idea name/i, /one sentence/i, /full description/i, /intended use/i, /primary user/i]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  it('offers the three ways to stay involved', () => {
    render(<IdeaForm />)
    expect(screen.getByLabelText(/clarification/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/co-design/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/user testing/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run and verify failure**

```bash
pnpm --filter @splat-connect/web test:unit -- idea-form
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Build `idea-form.tsx` as a `'use client'` component using the existing form
classes from `app/globals.css` (`.card`, `.btn-accent`) and the same
fetch-and-error pattern as `components/notify-form.tsx`. Fields, in order:

| Label | Name | Control |
|---|---|---|
| Idea name | `title` | text |
| Summarise it in one sentence | `summary` | text |
| Full description | `description` | textarea |
| Intended use | `intended_use` | textarea |
| Primary user | `primary_user` | textarea |
| I'm happy to be contacted for… | `contact_prefs` | three checkboxes: Clarification, Co-design, User testing |

On success, redirect to `/dashboard/challenges`. On failure, render the API's
error message inline above the submit button.

In `app/get-involved/submit-an-idea/page.tsx`, keep all existing prose and
`StepList` content, and render `<IdeaForm />` beneath it for signed-in users. For
signed-out visitors render a sign-in CTA linking to `/login?next=/get-involved/submit-an-idea`.
Use the auth check already used by other gated pages (`lib/auth.ts`).

- [ ] **Step 4: Run and verify pass**

```bash
pnpm --filter @splat-connect/web test:unit -- idea-form
```

Expected: PASS, 2 cases.

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/idea-form.tsx packages/web/tests/unit/components/idea-form.test.tsx packages/web/app/get-involved/submit-an-idea/page.tsx
git commit -m "feat(web): give submit-an-idea a form that actually stores an idea"
```

---

## Task 13: The public challenge listing

**Files:**
- Create: `packages/web/components/challenge-card.tsx`
- Modify: `packages/web/app/get-involved/design-challenges/page.tsx`
- Modify: `packages/web/lib/public-nav.ts`
- Create: `packages/web/tests/unit/app/design-challenges.test.tsx`

**Interfaces:**
- Consumes: `GET /api/public/challenges` from Task 8.
- Produces: `<ChallengeCard idea={...} />`.

- [ ] **Step 1: Write failing test**

```tsx
// packages/web/tests/unit/app/design-challenges.test.tsx
import { describe, it, expect } from 'vitest'
import { PUBLIC_NAV, SCAFFOLD_KEYS } from '@/lib/public-nav'

describe('design challenges nav state', () => {
  it('is live, so the section no longer advertises a placeholder', () => {
    const getInvolved = PUBLIC_NAV.find((s) => s.href === '/get-involved')!
    const challenges = getInvolved.children.find((c) => c.href === '/get-involved/design-challenges')!
    expect(challenges.state).toBe('live')
    expect(challenges.featureKey).toBeUndefined()
  })

  it('drops design-challenges from the notify allowlist', () => {
    expect(SCAFFOLD_KEYS).not.toContain('design-challenges')
  })
})
```

- [ ] **Step 2: Run and verify failure**

```bash
pnpm --filter @splat-connect/web test:unit -- design-challenges
```

Expected: FAIL — state is still `'soon'`.

- [ ] **Step 3: Implement**

In `lib/public-nav.ts`, change the `design-challenges` child to
`state: 'live'` and delete its `featureKey`. `SCAFFOLD_KEYS` is derived, so it
updates itself.

Replace `app/get-involved/design-challenges/page.tsx` with a server component
that fetches `/api/public/challenges` and renders a grid of `ChallengeCard`.
Each card shows the title, the one-sentence summary, the participant count, and
a "Looking for makers" chip when the count is zero. Empty state: explain that no
challenges are open yet and link to `/get-involved/submit-an-idea`.

- [ ] **Step 4: Run and verify pass**

```bash
pnpm --filter @splat-connect/web test:unit -- design-challenges
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/public-nav.ts packages/web/app/get-involved/design-challenges/page.tsx packages/web/components/challenge-card.tsx packages/web/tests/unit/app/design-challenges.test.tsx
git commit -m "feat(web): publish the design challenges listing"
```

---

## Task 14: The challenge detail page

**Files:**
- Create: `packages/web/app/get-involved/design-challenges/[id]/page.tsx`
- Create: `packages/web/components/challenge-thread.tsx`

**Interfaces:**
- Consumes: `GET /api/public/challenges/:id`, `POST /api/ideas/:id/join`, the message endpoints from Task 7, and `ExchangeChat` from Task 11.

- [ ] **Step 1: Build the page**

Server component fetching `/api/public/challenges/:id`; `notFound()` on 404 so a
pending idea is indistinguishable from one that never existed. Renders the
brief (title, summary, description, intended use, primary user), the author's
contact preferences as chips, and the participant list.

- [ ] **Step 2: Build the thread wrapper**

**Correct two things inherited from Task 4 while you are here.**

1. `notifications-list.tsx`'s `linkFor` carries a comment claiming a rejected idea
   has no public page because "037's select policy hides anything that is not
   'challenge' or 'graduated'". That reasoning is wrong: 037 also grants
   `"Authors see their own ideas at any status"`, so an author *does* pass RLS on
   their own rejected idea. The routing is still correct, but for a different
   reason — `GET /api/public/challenges/:id` (Task 8) filters
   `.in('status', ['challenge','graduated'])` with the admin client and 404s
   otherwise, so the public page is unreachable regardless of RLS. Fix the comment
   to say that. A wrong justification in a security-adjacent comment is worse than
   no comment.
2. Add a unit test for `linkFor` to
   `packages/web/tests/unit/components/notifications-list.test.tsx`. TypeScript's
   exhaustiveness check protects the `COPY` map but not the `idea_rejected`
   ternary — an inverted condition or a typo'd route string ships silently today.
   Assert all three branches: a `toy_transaction_id` row, a `tutorial_id` row, an
   `idea_id` row with `type: 'challenge_joined'`, and an `idea_id` row with
   `type: 'idea_rejected'`.

**Resolving sender names — do not add a profiles RLS policy for this.** `ExchangeChat`
requires a `nameFor(senderId)` resolver, supplied by the caller. Build it from the author
and participants returned by `GET /api/public/challenges/:id`, both of which are already
name-enriched server-side via the admin client (Task 8), so no profile visibility has to be
widened. Migration 026 solved the equivalent problem with a `profiles` select policy
("Transaction parties can view each other's name"); that is unnecessary here because the
detail endpoint does the join with the service role after its own authorisation check.
A participant who has since left resolves to "Someone" — acceptable, because their departure
is recorded by name in a `kind='system'` message in the thread itself.

`challenge-thread.tsx` is `'use client'`. It fetches `/api/ideas/:id/messages`,
renders `<ExchangeChat>`, subscribes to the `toy_idea_messages` realtime channel
filtered by `idea_id` (copy the subscription from `toy-transaction-thread.tsx`),
and renders the composer. When the viewer is neither author nor participant the
fetch returns `[]` and the component renders the Join button in place of the
thread.

- [ ] **Step 3: Verify manually**

```bash
pnpm dev:web
```

As two different signed-in users: publish a challenge via the admin queue, join
as the second user, confirm the system message appears in both browsers without
a reload, and confirm a third signed-in user sees the Join button and no messages.

- [ ] **Step 4: Commit**

```bash
git add packages/web/app/get-involved/design-challenges/\[id\]/page.tsx packages/web/components/challenge-thread.tsx
git commit -m "feat(web): challenge detail with joining and a live thread"
```

---

## Task 15: `/dashboard/challenges`

**Files:**
- Create: `packages/web/app/dashboard/challenges/page.tsx`
- Modify: `packages/web/lib/nav-model.ts`

**Interfaces:**
- Consumes: `GET /api/ideas/mine`.

- [ ] **Step 1: Build the page**

Mirror `app/dashboard/exchanges/page.tsx`. Two sections: **Your ideas** (all
statuses, with a status badge and the `review_note` shown on rejection) and
**Challenges you joined**. Each row links to
`/get-involved/design-challenges/[id]`, except pending and rejected ideas, which
have no public page and link nowhere.

- [ ] **Step 2: Add the nav entry**

In `lib/nav-model.ts`, add `{ href: '/dashboard/challenges', label: 'Design challenges' }`
beside `/dashboard/exchanges`.

- [ ] **Step 3: Verify**

```bash
pnpm --filter @splat-connect/web typecheck && pnpm --filter @splat-connect/web test:unit
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/web/app/dashboard/challenges/page.tsx packages/web/lib/nav-model.ts
git commit -m "feat(web): author-side view of ideas and joined challenges"
```

---

## Task 16: The admin queue

**Files:**
- Create: `packages/web/app/admin/ideas/page.tsx`
- Create: `packages/web/app/admin/ideas/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/ideas`, `PATCH /api/admin/ideas/:id/status`, `POST /api/admin/ideas/:id/graduate`.

- [ ] **Step 1: Build the queue**

Mirror `app/admin/review/page.tsx`: pending first, then the rest, each row
linking to the detail page.

- [ ] **Step 2: Build the detail page**

Mirror `app/admin/review/[id]/page.tsx`: the full brief, then **Publish as
challenge** and **Reject** (with a required note on reject — that is the whole
point of the field). A `challenge`-status idea additionally shows **Graduate to
draft guide**, which links to the created tutorial on success.

- [ ] **Step 3: Verify**

```bash
pnpm --filter @splat-connect/web typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/web/app/admin/ideas/
git commit -m "feat(web): admin review and graduation for design challenges"
```

---

## Task 17: End-to-end and the placeholder guard

**Files:**
- Create: `packages/web/tests/e2e/public/design-challenges.spec.ts`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the spec**

```ts
// packages/web/tests/e2e/public/design-challenges.spec.ts
import { test, expect } from '@playwright/test'

test('the listing is a real page, not a placeholder', async ({ page }) => {
  await page.goto('/get-involved/design-challenges')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('Not built yet')).toHaveCount(0)
})

test('submitting requires signing in', async ({ page }) => {
  await page.goto('/get-involved/submit-an-idea')
  await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible()
  await expect(page.getByLabel(/idea name/i)).toHaveCount(0)
})
```

- [ ] **Step 2: Run the new spec and the existing navigation guard**

```bash
pnpm --filter @splat-connect/web test:e2e -- design-challenges navigation
```

Expected: PASS. `tests/e2e/public/navigation.spec.ts` asserts no top-level nav
link is a placeholder; flipping `design-challenges` to `'live'` must keep it green.

- [ ] **Step 2b: Close two coverage gaps carried over from Task 6**

Both were found in review and deliberately deferred here rather than spending a
third fix round on Task 6. Add to
`packages/api/tests/unit/routes/toy-ideas.test.ts`, keeping the three-line
`Tests:` / `How:` / `Chain:` annotation:

1. **The author-removal success path is untested.** Only the 403 refusal and the
   404 no-such-participant cases are covered; the headline capability — an author
   successfully removing a real participant — is verified by inspection alone.
   Assert it writes the system message naming the *removed* person and sends a
   `challenge_removed` notification to that person whose `actor_name` is the
   *remover*. Those are two different people and the test should prove they were
   not collapsed.
2. **The never-was-a-participant removal test asserts only the notification
   absence**, not the system-message absence. Add the missing
   `toy_idea_messages` length-0 assertion so both zero-row paths assert both
   absences.

- [ ] **Step 3: Full verification**

```bash
pnpm -r typecheck && pnpm --filter @splat-connect/api test && pnpm --filter @splat-connect/web test:unit && pnpm db:check
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/web/tests/e2e/public/design-challenges.spec.ts
git commit -m "test(web): cover the design challenges surface end to end"
```

---

## Open item requiring the project owner

The spec's **Scope exclusions** section is a draft and marked as needing
sign-off. It is the safety copy shown above the form on
`/get-involved/submit-an-idea`. Task 12 ships the form; the exclusions list must
be corrected by the project owner before that page goes live publicly. Do not
invent a final list.
