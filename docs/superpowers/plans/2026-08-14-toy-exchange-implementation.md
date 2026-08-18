# Toy Exchange & Donation Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a contributor mark a toy as available for donation, exchange, or both; let another contributor request it through a per-request chat thread; and let the two parties confirm a handoff with a matching code so the toy leaves both "My Toys" grids without being deleted.

**Architecture:** Two new tables (`toy_transactions`, `toy_transaction_messages`) carry the whole negotiation — request, accept/reject/withdraw, chat, code confirmation — with every mutation gated by the API's admin client under in-code authorization checks rather than by RLS (RLS is select-only on `toy_transactions`, matching the read-scoped-by-party pattern already used everywhere else in this codebase). `toys` gains `offer_type` and `archived_at`; `profiles` gains a default pickup address; `notifications` is generalised from tutorial-only to also carry toy-transaction events.

**Tech Stack:** Hono (API), Next.js App Router (web), Supabase/Postgres with RLS, Vitest (unit + integration), Playwright (E2E) — all already in place, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-14-toy-exchange-design.md`

## Global Constraints

- 22P02 (invalid UUID) and a stranger's row both return 404, never 500/403 — the established convention in `toys.ts` and `public.ts`.
- A party-but-wrong-action request (e.g. non-owner calling `/accept`) returns 403 — the established convention in `collaborator-invites.ts`.
- No DB triggers anywhere in this codebase — `updated_at` is always set by hand in the route handler.
- Every cross-party write (notifications, rival-request rejection) goes through `createAdminClient()`; every read used for an authorization decision goes through `createUserClient(token)` so RLS does the "can this caller see this row" work.
- `offer_type` is never required to publish a toy — a published toy with no `offer_type` simply shows no request buttons until the owner sets one separately.

---

### Task 1: Migration — toy offer/archive columns and profile pickup address

**Files:**
- Create: `supabase/migrations/025_toy_exchange_columns.sql`

**Interfaces:**
- Produces: `toys.offer_type` (`'donation' | 'exchange' | 'both' | null`), `toys.archived_at` (`timestamptz | null`), `profiles.pickup_line1/pickup_suburb/pickup_state/pickup_postcode` (`text | null`).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/025_toy_exchange_columns.sql
-- WHY: toys need an owner-chosen offer type (donation/exchange/both) and an
--      archived state so a completed handoff can leave both My Toys and the
--      public library without being deleted. profiles need a default pickup
--      address so an accepted request can hand it back automatically.
alter table public.toys
  add column offer_type text check (offer_type in ('donation', 'exchange', 'both')),
  add column archived_at timestamptz;

alter table public.profiles
  add column pickup_line1 text,
  add column pickup_suburb text,
  add column pickup_state text,
  add column pickup_postcode text;
```

- [ ] **Step 2: Apply it to local Supabase and confirm it runs clean**

Run: `cd supabase && npx supabase migration up` (or the project's standard `db reset` if that's how migrations are normally applied locally)
Expected: migration `025_toy_exchange_columns` applies with no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/025_toy_exchange_columns.sql
git commit -m "feat(db): add toy offer_type/archived_at and profile pickup address columns"
```

---

### Task 2: Migration — toy_transactions and toy_transaction_messages tables

**Files:**
- Create: `supabase/migrations/026_toy_transactions.sql`

**Interfaces:**
- Consumes: `public.toys(id, owner_id, status)`, `public.profiles(id, role)` from Task 1 and earlier migrations.
- Produces: `public.toy_transactions` table, `public.toy_transaction_messages` table, plus two new SELECT policies on `public.toys` and `public.profiles` for transaction parties.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/026_toy_transactions.sql
-- WHY: the peer-to-peer donation/exchange flow needs a row that survives the
--      whole negotiation (request -> accept/reject -> confirm) plus a thread
--      the two parties can talk in. There is deliberately no ordinary INSERT
--      or UPDATE policy on toy_transactions: every write is validated by
--      routes/toy-transactions.ts (who may request, who may accept, whether a
--      code matches) rather than by RLS, so the API is the sole write gate and
--      RLS does only what it's good at here — "which rows can this user see"
--      for the two GET endpoints. toy_transaction_messages is the one
--      exception: its INSERT policy lets a party post directly through the
--      user client, since a chat message needs no server-side business logic
--      beyond "is this still an open transaction between us two".
create table public.toy_transactions (
  id uuid primary key default gen_random_uuid(),
  toy_id uuid not null references public.toys(id) on delete cascade,
  offered_toy_id uuid references public.toys(id) on delete cascade,
  type text not null check (type in ('donation', 'exchange')),
  status text not null default 'requested' check (status in ('requested', 'accepted', 'rejected', 'withdrawn', 'completed')),
  requester_id uuid not null references public.profiles(id),
  owner_id uuid not null references public.profiles(id),
  owner_code text,
  requester_code text,
  owner_confirmed_at timestamptz,
  requester_confirmed_at timestamptz,
  pickup_line1 text,
  pickup_suburb text,
  pickup_state text,
  pickup_postcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.toy_transactions enable row level security;

create policy "Parties can view their own toy transactions"
  on public.toy_transactions for select
  using (requester_id = auth.uid() or owner_id = auth.uid());

create policy "Admin full access to toy transactions"
  on public.toy_transactions for all using (public.is_admin());

create table public.toy_transaction_messages (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.toy_transactions(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  kind text not null default 'user' check (kind in ('system', 'user')),
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.toy_transaction_messages enable row level security;

create policy "Parties can view messages on their toy transactions"
  on public.toy_transaction_messages for select
  using (
    exists (
      select 1 from public.toy_transactions
      where toy_transactions.id = toy_transaction_messages.transaction_id
        and (toy_transactions.requester_id = auth.uid() or toy_transactions.owner_id = auth.uid())
    )
  );

create policy "Parties can message while a toy transaction is open"
  on public.toy_transaction_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.toy_transactions
      where toy_transactions.id = toy_transaction_messages.transaction_id
        and (toy_transactions.requester_id = auth.uid() or toy_transactions.owner_id = auth.uid())
        and toy_transactions.status in ('requested', 'accepted')
    )
  );

create policy "Admin full access to toy transaction messages"
  on public.toy_transaction_messages for all using (public.is_admin());

-- A transaction party needs to see the OTHER party's toy and name even when
-- that toy isn't published (an offered exchange toy) or no other
-- public-visibility policy reaches it (023/024 are each scoped to a
-- different fact) — mirrors the narrow, purpose-scoped shape of
-- 023_public_profile_names.sql.
create policy "Transaction parties can view each other's toy"
  on public.toys for select
  using (
    exists (
      select 1 from public.toy_transactions
      where (toy_transactions.toy_id = toys.id or toy_transactions.offered_toy_id = toys.id)
        and (toy_transactions.owner_id = auth.uid() or toy_transactions.requester_id = auth.uid())
    )
  );

create policy "Transaction parties can view each other's name"
  on public.profiles for select
  using (
    exists (
      select 1 from public.toy_transactions
      where (toy_transactions.owner_id = profiles.id or toy_transactions.requester_id = profiles.id)
        and (toy_transactions.owner_id = auth.uid() or toy_transactions.requester_id = auth.uid())
    )
  );
```

- [ ] **Step 2: Apply it to local Supabase and confirm it runs clean**

Run: `cd supabase && npx supabase migration up`
Expected: migration `026_toy_transactions` applies with no errors; `public.is_admin()` (used by every other admin-full-access policy in this codebase) resolves without redefinition.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/026_toy_transactions.sql
git commit -m "feat(db): add toy_transactions and toy_transaction_messages tables"
```

---

### Task 3: Migration — generalise notifications for toy events

**Files:**
- Create: `supabase/migrations/027_toy_transaction_notifications.sql`

**Interfaces:**
- Consumes: `public.toy_transactions(id)` from Task 2.
- Produces: `notifications.tutorial_id`/`tutorial_title` become nullable; `notifications.toy_transaction_id` (`uuid | null`), `notifications.toy_name` (`text | null`); `type` check extended with `'toy_request'`, `'toy_accepted'`, `'toy_rejected'`, `'toy_withdrawn'`, `'toy_message'`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/027_toy_transaction_notifications.sql
-- WHY: notifications was built tutorial-only (tutorial_id NOT NULL, a fixed
--      type list). A toy request/accept/reject/withdraw/message needs the
--      same inbox row shape, pointed at a toy_transactions row instead.
alter table public.notifications
  alter column tutorial_id drop not null;

alter table public.notifications
  add column toy_transaction_id uuid references public.toy_transactions(id) on delete cascade,
  add column toy_name text;

alter table public.notifications
  drop constraint notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
      'collaborator_removed', 'collaborator_left',
      'tutorial_approved', 'tutorial_rejected',
      'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message'
    )
  );
```

- [ ] **Step 2: Apply it to local Supabase and confirm it runs clean**

Run: `cd supabase && npx supabase migration up`
Expected: migration `027_toy_transaction_notifications` applies with no errors; existing tutorial-type notification rows are untouched (they already have `tutorial_id` set, so dropping NOT NULL doesn't affect them).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/027_toy_transaction_notifications.sql
git commit -m "feat(db): let notifications carry toy-transaction events"
```

---

### Task 4: Shared types

**Files:**
- Modify: `packages/types/src/index.ts`

**Interfaces:**
- Produces: `OfferType`, extended `Toy`, extended `Profile`, `ToyTransactionType`, `ToyTransactionStatus`, `ToyTransaction`, `ToyTransactionSummary`, `ToyTransactionMessageKind`, `ToyTransactionMessage`, `ToyTransactionDetail`, extended `NotificationType`, extended `Notification`. Every later task imports these from `@splat-connect/types`.

- [ ] **Step 1: Add `OfferType` and extend `Toy`**

In `packages/types/src/index.ts`, add near the existing `Toy` interface:

```typescript
export type OfferType = 'donation' | 'exchange' | 'both'
```

Add to the `Toy` interface:

```typescript
  offer_type: OfferType | null
  archived_at: string | null
```

- [ ] **Step 2: Extend `Profile` with pickup address fields**

Add to the `Profile` interface:

```typescript
  pickup_line1?: string | null
  pickup_suburb?: string | null
  pickup_state?: string | null
  pickup_postcode?: string | null
```

- [ ] **Step 3: Add toy-transaction types**

Add after the `Toy` interface:

```typescript
export type ToyTransactionType = 'donation' | 'exchange'
export type ToyTransactionStatus = 'requested' | 'accepted' | 'rejected' | 'withdrawn' | 'completed'

export interface ToyTransaction {
  id: string
  toy_id: string
  offered_toy_id: string | null
  type: ToyTransactionType
  status: ToyTransactionStatus
  requester_id: string
  owner_id: string
  owner_code: string | null
  requester_code: string | null
  owner_confirmed_at: string | null
  requester_confirmed_at: string | null
  pickup_line1: string | null
  pickup_suburb: string | null
  pickup_state: string | null
  pickup_postcode: string | null
  created_at: string
  updated_at: string
}

export interface ToyTransactionSummary extends ToyTransaction {
  toy_name: string
  offered_toy_name: string | null
  other_party_name: string
}

export type ToyTransactionMessageKind = 'system' | 'user'

export interface ToyTransactionMessage {
  id: string
  transaction_id: string
  sender_id: string
  kind: ToyTransactionMessageKind
  body: string
  created_at: string
}

export interface ToyTransactionDetail extends ToyTransaction {
  toy_name: string
  offered_toy_name: string | null
  owner_name: string
  requester_name: string
  messages: ToyTransactionMessage[]
}
```

- [ ] **Step 4: Extend notifications**

Find `NotificationType` and add the five new members:

```typescript
export type NotificationType =
  | 'collaborator_invited'
  | 'collaborator_accepted'
  | 'collaborator_declined'
  | 'collaborator_removed'
  | 'collaborator_left'
  | 'tutorial_approved'
  | 'tutorial_rejected'
  | 'toy_request'
  | 'toy_accepted'
  | 'toy_rejected'
  | 'toy_withdrawn'
  | 'toy_message'
```

In the `Notification` interface, change `tutorial_id: string` and `tutorial_title: string` to optional-nullable, and add the two new toy fields:

```typescript
  tutorial_id?: string | null
  tutorial_title?: string | null
  toy_transaction_id?: string | null
  toy_name?: string | null
```

- [ ] **Step 5: Typecheck the types package**

Run: `cd packages/types && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): add toy offer/transaction types and generalise Notification"
```

---

### Task 5: Propagate new nullable Toy fields through EDITABLE and web test fixtures

**Files:**
- Modify: `packages/api/src/routes/toys.ts`
- Modify: `packages/web/tests/unit/components/toy-library-client.test.tsx`
- Modify: `packages/web/tests/unit/components/toy-summary.test.tsx`
- Modify: `packages/web/tests/unit/components/toy-editor.test.tsx`
- Modify: `packages/web/tests/unit/lib/toy-steps.test.ts`
- Modify: `packages/web/tests/unit/pages/dashboard-toys-edit.test.tsx`
- Modify: `packages/web/tests/unit/pages/dashboard-toys-list.test.tsx`

**Interfaces:**
- Consumes: `Toy` from Task 4 (now requires `offer_type`/`archived_at`).
- Produces: `EDITABLE` in `toys.ts` now accepts `offer_type` in PATCH bodies. `missingPublishFields()` and `getMissingToyFields()` are intentionally left unchanged — `offer_type` is never required to publish.

- [ ] **Step 1: Add `offer_type` to `toys.ts`'s `EDITABLE`**

In `packages/api/src/routes/toys.ts`, find:

```typescript
const EDITABLE = ['name', 'description', 'condition', 'switch_adapted', 'cover_photo_url', 'switch_photo_urls'] as const
```

Change to:

```typescript
const EDITABLE = ['name', 'description', 'condition', 'switch_adapted', 'cover_photo_url', 'switch_photo_urls', 'offer_type'] as const
```

- [ ] **Step 2: Update every `toy(overrides)` fixture builder to include the two new fields**

In each of the six web test files listed above, find the `toy(overrides: Partial<Toy> = {})` (or equivalently-named) fixture builder and add two lines to the object it returns:

```typescript
    offer_type: null,
    archived_at: null,
```

Place them alongside the other existing fields (e.g. right after `switch_photo_urls` or wherever the builder currently ends its literal fields, before the `...overrides` spread).

- [ ] **Step 3: Run the web unit suite to confirm no fixture is still missing the fields**

Run: `cd packages/web && npx vitest run`
Expected: all tests pass — `tsc` would fail first if any fixture were missed, since `Toy` now requires both fields.

- [ ] **Step 4: Run the API unit suite to confirm `toys.test.ts` needed no change**

Run: `cd packages/api && npx vitest run tests/unit/routes/toys.test.ts`
Expected: all existing tests still pass unmodified — `missingPublishFields()` was deliberately not touched.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/toys.ts packages/web/tests/unit/components/toy-library-client.test.tsx packages/web/tests/unit/components/toy-summary.test.tsx packages/web/tests/unit/components/toy-editor.test.tsx packages/web/tests/unit/lib/toy-steps.test.ts packages/web/tests/unit/pages/dashboard-toys-edit.test.tsx packages/web/tests/unit/pages/dashboard-toys-list.test.tsx
git commit -m "feat(api,web): make offer_type patchable and thread the new Toy fields through fixtures"
```

---

### Task 6: toy-transactions API — read routes and create

**Files:**
- Create: `packages/api/src/routes/toy-transactions.ts`
- Modify: `packages/api/src/app.ts`
- Test: `packages/api/tests/unit/routes/toy-transactions.test.ts`
- Test: `packages/api/tests/integration/toy-transactions/create.test.ts`

**Interfaces:**
- Consumes: `createUserClient(token)` from `../supabase/user-client.js`, `createAdminClient()` from `../supabase/client.js`, `AuthVariables` from `../middleware/auth.js`, `ToyTransaction`/`ToyTransactionSummary`/`ToyTransactionDetail` from `@splat-connect/types`.
- Produces: default-exported Hono instance `toyTransactions` with `GET /`, `GET /:id`, `POST /`; `INVALID_TEXT_REPRESENTATION`, `RLS_VIOLATION` constants and `loadForParty(c)`/`generateCode()` helpers used by every later task in this file.

- [ ] **Step 1: Write the failing unit test for `POST /`**

```typescript
// packages/api/tests/unit/routes/toy-transactions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

const userClient = { from: vi.fn() }
const adminClient = { from: vi.fn() }

vi.mock('../../../src/supabase/user-client.js', () => ({
  createUserClient: () => userClient,
}))
vi.mock('../../../src/supabase/client.js', () => ({
  createAdminClient: () => adminClient,
}))

function table(methods: Record<string, unknown>) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    ...methods,
  }
}

describe('POST /api/toy-transactions', () => {
  let app: Hono
  let toyTransactions: typeof import('../../../src/routes/toy-transactions.js').default

  beforeEach(async () => {
    vi.resetModules()
    userClient.from.mockReset()
    adminClient.from.mockReset()
    const mod = await import('../../../src/routes/toy-transactions.js')
    toyTransactions = mod.default
    app = new Hono()
    app.use('*', async (c, next) => {
      c.set('userId', 'requester-1')
      c.set('token', 'tok')
      await next()
    })
    app.route('/', toyTransactions)
  })

  it('404s when the toy does not exist', async () => {
    const toys = table({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })
    adminClient.from.mockImplementation((name: string) => (name === 'toys' ? toys : table({})))

    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ toy_id: 'toy-1', type: 'donation' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(404)
  })

  it('400s when requesting your own toy', async () => {
    const toys = table({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'toy-1', owner_id: 'requester-1', offer_type: 'donation', status: 'published', archived_at: null },
        error: null,
      }),
    })
    adminClient.from.mockImplementation((name: string) => (name === 'toys' ? toys : table({})))

    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ toy_id: 'toy-1', type: 'donation' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })

  it('400s when the toy is not offered for the requested type', async () => {
    const toys = table({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'toy-1', owner_id: 'owner-1', offer_type: 'exchange', status: 'published', archived_at: null },
        error: null,
      }),
    })
    adminClient.from.mockImplementation((name: string) => (name === 'toys' ? toys : table({})))

    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ toy_id: 'toy-1', type: 'donation' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/not offered/)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/api && npx vitest run tests/unit/routes/toy-transactions.test.ts`
Expected: FAIL — `src/routes/toy-transactions.js` does not exist.

- [ ] **Step 3: Write the route file (skeleton + read routes + create)**

```typescript
// packages/api/src/routes/toy-transactions.ts
import { Hono, type Context } from 'hono'
import { randomInt } from 'node:crypto'
import { createUserClient } from '../supabase/user-client.js'
import { createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const toyTransactions = new Hono<{ Variables: AuthVariables }>()

export const INVALID_TEXT_REPRESENTATION = '22P02'
export const RLS_VIOLATION = '42501'

export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

type LoadResult =
  | { data: Record<string, any> }
  | { status: 404 }
  | { status: 500; message: string }

export async function loadForParty(c: Context<{ Variables: AuthVariables }>): Promise<LoadResult> {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('toy_transactions')
    .select('*')
    .eq('id', c.req.param('id'))
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return { status: 404 }
    return { status: 500, message: error.message }
  }
  if (!data) return { status: 404 }
  return { data }
}

toyTransactions.get('/', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('toy_transactions')
    .select(
      '*, toy:toys!toy_transactions_toy_id_fkey(name), offered:toys!toy_transactions_offered_toy_id_fkey(name), owner:profiles!toy_transactions_owner_id_fkey(name), requester:profiles!toy_transactions_requester_id_fkey(name)'
    )
    .order('updated_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)

  const userId = c.get('userId')
  const rows = (data ?? []) as unknown as Array<
    Record<string, unknown> & {
      owner_id: string
      toy: { name: string } | null
      offered: { name: string } | null
      owner: { name: string } | null
      requester: { name: string } | null
    }
  >
  return c.json(
    rows.map((r) => ({
      ...r,
      toy_name: r.toy?.name ?? '',
      offered_toy_name: r.offered?.name ?? null,
      other_party_name: r.owner_id === userId ? r.requester?.name ?? '' : r.owner?.name ?? '',
    }))
  )
})

toyTransactions.get('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('toy_transactions')
    .select(
      '*, toy:toys!toy_transactions_toy_id_fkey(name), offered:toys!toy_transactions_offered_toy_id_fkey(name), owner:profiles!toy_transactions_owner_id_fkey(name), requester:profiles!toy_transactions_requester_id_fkey(name)'
    )
    .eq('id', c.req.param('id'))
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: error.message }, 500)
  }
  if (!data) return c.json({ error: 'Not found' }, 404)

  const { data: messages, error: msgError } = await supabase
    .from('toy_transaction_messages')
    .select('*')
    .eq('transaction_id', c.req.param('id'))
    .order('created_at', { ascending: true })
  if (msgError) return c.json({ error: msgError.message }, 500)

  const row = data as unknown as Record<string, unknown> & {
    toy: { name: string } | null
    offered: { name: string } | null
    owner: { name: string } | null
    requester: { name: string } | null
  }
  return c.json({
    ...row,
    toy_name: row.toy?.name ?? '',
    offered_toy_name: row.offered?.name ?? null,
    owner_name: row.owner?.name ?? '',
    requester_name: row.requester?.name ?? '',
    messages: messages ?? [],
  })
})

toyTransactions.post('/', async (c) => {
  const body = await c.req.json()
  const userId = c.get('userId')
  const admin = createAdminClient()

  const { data: toy, error: toyError } = await admin
    .from('toys')
    .select('id, owner_id, offer_type, status, archived_at')
    .eq('id', body.toy_id)
    .maybeSingle()
  if (toyError) {
    if (toyError.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: toyError.message }, 500)
  }
  if (!toy || toy.status !== 'published' || toy.archived_at) return c.json({ error: 'Not found' }, 404)
  if (toy.owner_id === userId) return c.json({ error: 'You cannot request your own toy' }, 400)

  const type = body.type as 'donation' | 'exchange'
  if (type !== 'donation' && type !== 'exchange') return c.json({ error: 'Invalid type' }, 400)
  const allowed = type === 'donation' ? ['donation', 'both'] : ['exchange', 'both']
  if (!toy.offer_type || !allowed.includes(toy.offer_type)) {
    return c.json({ error: 'This toy is not offered for that request type' }, 400)
  }

  let offeredToyId: string | null = null
  if (type === 'exchange') {
    if (!body.offered_toy_id) return c.json({ error: 'Choose one of your toys to offer' }, 400)
    const { data: offered, error: offeredError } = await admin
      .from('toys')
      .select('id, owner_id, archived_at')
      .eq('id', body.offered_toy_id)
      .maybeSingle()
    if (offeredError) return c.json({ error: offeredError.message }, 500)
    if (!offered || offered.owner_id !== userId || offered.archived_at) {
      return c.json({ error: 'Choose one of your own, active toys to offer' }, 400)
    }
    offeredToyId = offered.id
  }

  const { data: existing, error: existingError } = await admin
    .from('toy_transactions')
    .select('id')
    .eq('toy_id', toy.id)
    .eq('requester_id', userId)
    .in('status', ['requested', 'accepted'])
    .maybeSingle()
  if (existingError) return c.json({ error: existingError.message }, 500)
  if (existing) return c.json({ error: 'You already have an open request for this toy' }, 409)

  const { data: tx, error: insertError } = await admin
    .from('toy_transactions')
    .insert({
      toy_id: toy.id,
      offered_toy_id: offeredToyId,
      type,
      status: 'requested',
      requester_id: userId,
      owner_id: toy.owner_id,
    })
    .select()
    .single()
  if (insertError) return c.json({ error: insertError.message }, 500)

  const { data: requesterProfile } = await admin.from('profiles').select('name').eq('id', userId).single()
  const { data: toyRow } = await admin.from('toys').select('name').eq('id', toy.id).single()

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: type === 'donation' ? 'Requested this toy for donation.' : 'Requested an exchange for this toy.',
  })

  await admin.from('notifications').insert({
    recipient_id: toy.owner_id,
    type: 'toy_request',
    toy_transaction_id: tx.id,
    toy_name: toyRow?.name ?? 'a toy',
    actor_name: requesterProfile?.name ?? 'A contributor',
  })

  return c.json(tx, 201)
})

export default toyTransactions
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `cd packages/api && npx vitest run tests/unit/routes/toy-transactions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Mount the route in `app.ts`**

In `packages/api/src/app.ts`, alongside the existing `app.use('/api/toys/*', authMiddleware)` / `app.route('/api/toys', toys)` pair, add:

```typescript
import toyTransactions from './routes/toy-transactions.js'
```

and, in the same block as the other authenticated route mounts:

```typescript
app.use('/api/toy-transactions/*', authMiddleware)
app.route('/api/toy-transactions', toyTransactions)
```

- [ ] **Step 6: Write the failing integration test**

```typescript
// packages/api/tests/integration/toy-transactions/create.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const BASE = 'http://localhost'

function toysReq(path: string, token: string, init: RequestInit = {}) {
  return app.request(`${BASE}/api/toys${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

function txReq(path: string, token: string, init: RequestInit = {}) {
  return app.request(`${BASE}/api/toy-transactions${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

async function createPublishedToy(token: string, name: string, offerType: 'donation' | 'exchange' | 'both') {
  const create = await toysReq('/', token, { method: 'POST', body: JSON.stringify({ name, condition: 7 }) })
  const toy = (await create.json()) as { id: string }
  await toysReq(`/${toy.id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ cover_photo_url: 'https://example.com/cover.jpg', offer_type: offerType }),
  })
  await toysReq(`/${toy.id}/publish`, token, { method: 'PATCH' })
  return toy.id
}

describe('POST /api/toy-transactions', () => {
  let owner: TestUser
  let requester: TestUser
  let toyId: string

  beforeAll(async () => {
    owner = await createTestUser('contributor')
    requester = await createTestUser('contributor')
    toyId = await createPublishedToy(owner.token, 'Fire truck', 'donation')
  })

  afterAll(async () => {
    await deleteTestUser(owner.id)
    await deleteTestUser(requester.id)
  })

  it('creates a donation request and a system message', async () => {
    const res = await txReq('/', requester.token, {
      method: 'POST',
      body: JSON.stringify({ toy_id: toyId, type: 'donation' }),
    })
    expect(res.status).toBe(201)
    const tx = (await res.json()) as { id: string; status: string }
    expect(tx.status).toBe('requested')

    const detail = await txReq(`/${tx.id}`, owner.token)
    const body = (await detail.json()) as { messages: Array<{ kind: string }> }
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0].kind).toBe('system')
  })

  it('404s requesting a toy that does not exist, and never 403', async () => {
    const res = await txReq('/', requester.token, {
      method: 'POST',
      body: JSON.stringify({ toy_id: '00000000-0000-0000-0000-000000000000', type: 'donation' }),
    })
    expect(res.status).toBe(404)
  })

  it('rejects requesting your own toy', async () => {
    const res = await txReq('/', owner.token, {
      method: 'POST',
      body: JSON.stringify({ toy_id: toyId, type: 'donation' }),
    })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 7: Run it to verify it fails, then run migrations locally if needed and re-run**

Run: `cd packages/api && npx vitest run --config vitest.integration.config.ts tests/integration/toy-transactions/create.test.ts`
Expected: PASS once migrations from Tasks 1–3 are applied locally (this test exercises real Postgres/RLS, not mocks).

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/routes/toy-transactions.ts packages/api/src/app.ts packages/api/tests/unit/routes/toy-transactions.test.ts packages/api/tests/integration/toy-transactions/create.test.ts
git commit -m "feat(api): add toy-transactions create/list/detail routes"
```

---

### Task 7: toy-transactions API — chat messages

**Files:**
- Modify: `packages/api/src/routes/toy-transactions.ts`
- Test: `packages/api/tests/integration/toy-transactions/messages.test.ts`

**Interfaces:**
- Consumes: `INVALID_TEXT_REPRESENTATION`, `RLS_VIOLATION` from Task 6.
- Produces: `POST /:id/messages`.

- [ ] **Step 1: Write the failing integration test**

```typescript
// packages/api/tests/integration/toy-transactions/messages.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const BASE = 'http://localhost'

function toysReq(path: string, token: string, init: RequestInit = {}) {
  return app.request(`${BASE}/api/toys${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}
function txReq(path: string, token: string, init: RequestInit = {}) {
  return app.request(`${BASE}/api/toy-transactions${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

describe('POST /api/toy-transactions/:id/messages', () => {
  let owner: TestUser
  let requester: TestUser
  let stranger: TestUser
  let txId: string

  beforeAll(async () => {
    owner = await createTestUser('contributor')
    requester = await createTestUser('contributor')
    stranger = await createTestUser('contributor')

    const create = await toysReq('/', owner.token, { method: 'POST', body: JSON.stringify({ name: 'Blocks', condition: 8 }) })
    const toy = (await create.json()) as { id: string }
    await toysReq(`/${toy.id}`, owner.token, {
      method: 'PATCH',
      body: JSON.stringify({ cover_photo_url: 'https://example.com/c.jpg', offer_type: 'donation' }),
    })
    await toysReq(`/${toy.id}/publish`, owner.token, { method: 'PATCH' })

    const created = await txReq('/', requester.token, {
      method: 'POST',
      body: JSON.stringify({ toy_id: toy.id, type: 'donation' }),
    })
    txId = ((await created.json()) as { id: string }).id
  })

  afterAll(async () => {
    await deleteTestUser(owner.id)
    await deleteTestUser(requester.id)
    await deleteTestUser(stranger.id)
  })

  it('lets a party post a message', async () => {
    const res = await txReq(`/${txId}/messages`, requester.token, {
      method: 'POST',
      body: JSON.stringify({ body: 'When works for you?' }),
    })
    expect(res.status).toBe(201)

    const detail = await txReq(`/${txId}`, owner.token)
    const body = (await detail.json()) as { messages: Array<{ body: string }> }
    expect(body.messages.map((m) => m.body)).toContain('When works for you?')
  })

  it('404s a stranger posting to a transaction they are not party to, never 403', async () => {
    const res = await txReq(`/${txId}/messages`, stranger.token, {
      method: 'POST',
      body: JSON.stringify({ body: 'hi' }),
    })
    expect(res.status).toBe(404)
  })

  it('400s an empty message body', async () => {
    const res = await txReq(`/${txId}/messages`, requester.token, {
      method: 'POST',
      body: JSON.stringify({ body: '   ' }),
    })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/api && npx vitest run --config vitest.integration.config.ts tests/integration/toy-transactions/messages.test.ts`
Expected: FAIL — `POST /:id/messages` does not exist (404 for all routes, first two assertions mismatch).

- [ ] **Step 3: Add the route**

In `packages/api/src/routes/toy-transactions.ts`, add after `toyTransactions.post('/', ...)`:

```typescript
toyTransactions.post('/:id/messages', async (c) => {
  const body = await c.req.json()
  if (typeof body.body !== 'string' || !body.body.trim()) {
    return c.json({ error: 'Message body is required' }, 400)
  }

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('toy_transaction_messages')
    .insert({
      transaction_id: c.req.param('id'),
      sender_id: c.get('userId'),
      kind: 'user',
      body: body.body,
    })
    .select()
    .single()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION || error.code === RLS_VIOLATION) {
      return c.json({ error: 'Not found' }, 404)
    }
    return c.json({ error: error.message }, 500)
  }

  const admin = createAdminClient()
  const { data: tx } = await admin
    .from('toy_transactions')
    .select('owner_id, requester_id, toy_id')
    .eq('id', c.req.param('id'))
    .single()
  if (tx) {
    const userId = c.get('userId')
    const recipientId = tx.owner_id === userId ? tx.requester_id : tx.owner_id
    const { data: sender } = await admin.from('profiles').select('name').eq('id', userId).single()
    const { data: toy } = await admin.from('toys').select('name').eq('id', tx.toy_id).single()
    await admin.from('notifications').insert({
      recipient_id: recipientId,
      type: 'toy_message',
      toy_transaction_id: c.req.param('id'),
      toy_name: toy?.name ?? 'a toy',
      actor_name: sender?.name ?? 'A contributor',
    })
  }

  return c.json(data, 201)
})
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd packages/api && npx vitest run --config vitest.integration.config.ts tests/integration/toy-transactions/messages.test.ts`
Expected: PASS (3 tests). The stranger case 404s because the RLS INSERT policy from Task 2 rejects a non-party's write, mapped to 404 via `RLS_VIOLATION`.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/toy-transactions.ts packages/api/tests/integration/toy-transactions/messages.test.ts
git commit -m "feat(api): add toy-transactions chat message route"
```

---

### Task 8: toy-transactions API — accept

**Files:**
- Modify: `packages/api/src/routes/toy-transactions.ts`
- Test: `packages/api/tests/integration/toy-transactions/accept.test.ts`

**Interfaces:**
- Consumes: `loadForParty`, `generateCode` from Task 6.
- Produces: `POST /:id/accept`.

- [ ] **Step 1: Write the failing integration test**

```typescript
// packages/api/tests/integration/toy-transactions/accept.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const BASE = 'http://localhost'
function toysReq(path: string, token: string, init: RequestInit = {}) {
  return app.request(`${BASE}/api/toys${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}
function txReq(path: string, token: string, init: RequestInit = {}) {
  return app.request(`${BASE}/api/toy-transactions${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

describe('POST /api/toy-transactions/:id/accept', () => {
  let owner: TestUser
  let requester1: TestUser
  let requester2: TestUser
  let toyId: string
  let tx1Id: string
  let tx2Id: string

  beforeAll(async () => {
    owner = await createTestUser('contributor')
    requester1 = await createTestUser('contributor')
    requester2 = await createTestUser('contributor')

    await toysReq('/', owner.token, { method: 'PATCH' }).catch(() => {})
    const create = await toysReq('/', owner.token, { method: 'POST', body: JSON.stringify({ name: 'Robot', condition: 9 }) })
    const toy = (await create.json()) as { id: string }
    toyId = toy.id
    await toysReq(`/${toyId}`, owner.token, {
      method: 'PATCH',
      body: JSON.stringify({
        cover_photo_url: 'https://example.com/c.jpg',
        offer_type: 'donation',
      }),
    })
    await toysReq(`/${toyId}/publish`, owner.token, { method: 'PATCH' })

    const p = { pickup_line1: '1 Test St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000' }
    // Owner sets their default pickup address via the contributors route (Task 12);
    // until Task 12 lands this call is skipped and pickup fields stay null on accept.

    const c1 = await txReq('/', requester1.token, { method: 'POST', body: JSON.stringify({ toy_id: toyId, type: 'donation' }) })
    tx1Id = ((await c1.json()) as { id: string }).id
    const c2 = await txReq('/', requester2.token, { method: 'POST', body: JSON.stringify({ toy_id: toyId, type: 'donation' }) })
    tx2Id = ((await c2.json()) as { id: string }).id
  })

  afterAll(async () => {
    await deleteTestUser(owner.id)
    await deleteTestUser(requester1.id)
    await deleteTestUser(requester2.id)
  })

  it('403s a non-owner trying to accept', async () => {
    const res = await txReq(`/${tx1Id}/accept`, requester1.token, { method: 'POST' })
    expect(res.status).toBe(403)
  })

  it('accepts, generates codes for both parties, and auto-rejects the rival request', async () => {
    const res = await txReq(`/${tx1Id}/accept`, owner.token, { method: 'POST' })
    expect(res.status).toBe(200)
    const tx = (await res.json()) as { status: string; owner_code: string; requester_code: string }
    expect(tx.status).toBe('accepted')
    expect(tx.owner_code).toMatch(/^\d{6}$/)
    expect(tx.requester_code).toMatch(/^\d{6}$/)

    const rival = await txReq(`/${tx2Id}`, requester2.token)
    const rivalBody = (await rival.json()) as { status: string }
    expect(rivalBody.status).toBe('rejected')
  })

  it('409s accepting an already-accepted request', async () => {
    const res = await txReq(`/${tx1Id}/accept`, owner.token, { method: 'POST' })
    expect(res.status).toBe(409)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/api && npx vitest run --config vitest.integration.config.ts tests/integration/toy-transactions/accept.test.ts`
Expected: FAIL — `POST /:id/accept` does not exist.

- [ ] **Step 3: Add the route**

In `packages/api/src/routes/toy-transactions.ts`, add after the messages route:

```typescript
toyTransactions.post('/:id/accept', async (c) => {
  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  if (userId !== tx.owner_id) return c.json({ error: 'Only the owner may accept' }, 403)
  if (tx.status !== 'requested') return c.json({ error: 'This request is no longer open' }, 409)

  const admin = createAdminClient()
  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('pickup_line1, pickup_suburb, pickup_state, pickup_postcode')
    .eq('id', userId)
    .single()

  const ownerCode = generateCode()
  const requesterCode = generateCode()
  const now = new Date().toISOString()

  const { data: updated, error } = await admin
    .from('toy_transactions')
    .update({
      status: 'accepted',
      owner_code: ownerCode,
      requester_code: requesterCode,
      pickup_line1: ownerProfile?.pickup_line1 ?? null,
      pickup_suburb: ownerProfile?.pickup_suburb ?? null,
      pickup_state: ownerProfile?.pickup_state ?? null,
      pickup_postcode: ownerProfile?.pickup_postcode ?? null,
      updated_at: now,
    })
    .eq('id', tx.id)
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: 'Request accepted. Pickup details are ready below.',
  })

  const { data: toy } = await admin.from('toys').select('name').eq('id', tx.toy_id).single()
  const { data: ownerName } = await admin.from('profiles').select('name').eq('id', userId).single()
  await admin.from('notifications').insert({
    recipient_id: tx.requester_id,
    type: 'toy_accepted',
    toy_transaction_id: tx.id,
    toy_name: toy?.name ?? 'a toy',
    actor_name: ownerName?.name ?? 'The owner',
  })

  // Only one accepted handoff may be in flight per toy, so every other open
  // request on the same toy is closed out automatically.
  const { data: rivals } = await admin
    .from('toy_transactions')
    .select('id, requester_id')
    .eq('toy_id', tx.toy_id)
    .eq('status', 'requested')
    .neq('id', tx.id)
  for (const rival of rivals ?? []) {
    await admin.from('toy_transactions').update({ status: 'rejected', updated_at: now }).eq('id', rival.id)
    await admin.from('toy_transaction_messages').insert({
      transaction_id: rival.id,
      sender_id: userId,
      kind: 'system',
      body: 'This toy was accepted by another request, so this one was automatically declined.',
    })
    await admin.from('notifications').insert({
      recipient_id: rival.requester_id,
      type: 'toy_rejected',
      toy_transaction_id: rival.id,
      toy_name: toy?.name ?? 'a toy',
      actor_name: ownerName?.name ?? 'The owner',
    })
  }

  return c.json(updated)
})
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd packages/api && npx vitest run --config vitest.integration.config.ts tests/integration/toy-transactions/accept.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/toy-transactions.ts packages/api/tests/integration/toy-transactions/accept.test.ts
git commit -m "feat(api): add toy-transactions accept route with rival auto-rejection"
```

---

### Task 9: toy-transactions API — reject and withdraw

**Files:**
- Modify: `packages/api/src/routes/toy-transactions.ts`
- Test: `packages/api/tests/integration/toy-transactions/reject-withdraw.test.ts`

**Interfaces:**
- Consumes: `loadForParty` from Task 6.
- Produces: `POST /:id/reject`, `POST /:id/withdraw`.

- [ ] **Step 1: Write the failing integration test**

```typescript
// packages/api/tests/integration/toy-transactions/reject-withdraw.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const BASE = 'http://localhost'
function toysReq(path: string, token: string, init: RequestInit = {}) {
  return app.request(`${BASE}/api/toys${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}
function txReq(path: string, token: string, init: RequestInit = {}) {
  return app.request(`${BASE}/api/toy-transactions${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}
async function requestDonation(ownerToken: string, requesterToken: string, name: string) {
  const create = await toysReq('/', ownerToken, { method: 'POST', body: JSON.stringify({ name, condition: 6 }) })
  const toy = (await create.json()) as { id: string }
  await toysReq(`/${toy.id}`, ownerToken, {
    method: 'PATCH',
    body: JSON.stringify({ cover_photo_url: 'https://example.com/c.jpg', offer_type: 'donation' }),
  })
  await toysReq(`/${toy.id}/publish`, ownerToken, { method: 'PATCH' })
  const created = await txReq('/', requesterToken, { method: 'POST', body: JSON.stringify({ toy_id: toy.id, type: 'donation' }) })
  return ((await created.json()) as { id: string }).id
}

describe('POST /api/toy-transactions/:id/reject and /withdraw', () => {
  let owner: TestUser
  let requester: TestUser
  let stranger: TestUser

  beforeAll(async () => {
    owner = await createTestUser('contributor')
    requester = await createTestUser('contributor')
    stranger = await createTestUser('contributor')
  })

  afterAll(async () => {
    await deleteTestUser(owner.id)
    await deleteTestUser(requester.id)
    await deleteTestUser(stranger.id)
  })

  it('lets the owner reject an open request', async () => {
    const txId = await requestDonation(owner.token, requester.token, 'Ball')
    const res = await txReq(`/${txId}/reject`, owner.token, { method: 'POST' })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { status: string }).status).toBe('rejected')
  })

  it('403s a non-owner trying to reject', async () => {
    const txId = await requestDonation(owner.token, requester.token, 'Kite')
    const res = await txReq(`/${txId}/reject`, requester.token, { method: 'POST' })
    expect(res.status).toBe(403)
  })

  it('404s a stranger acting on a transaction, never 403', async () => {
    const txId = await requestDonation(owner.token, requester.token, 'Drum')
    const res = await txReq(`/${txId}/reject`, stranger.token, { method: 'POST' })
    expect(res.status).toBe(404)
  })

  it('lets either party withdraw an open request', async () => {
    const txId = await requestDonation(owner.token, requester.token, 'Puzzle')
    const res = await txReq(`/${txId}/withdraw`, requester.token, { method: 'POST' })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { status: string }).status).toBe('withdrawn')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/api && npx vitest run --config vitest.integration.config.ts tests/integration/toy-transactions/reject-withdraw.test.ts`
Expected: FAIL — neither route exists yet.

- [ ] **Step 3: Add the routes**

In `packages/api/src/routes/toy-transactions.ts`, add after the accept route:

```typescript
toyTransactions.post('/:id/reject', async (c) => {
  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  if (userId !== tx.owner_id) return c.json({ error: 'Only the owner may reject' }, 403)
  if (tx.status !== 'requested') return c.json({ error: 'This request is no longer open' }, 409)

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data: updated, error } = await admin
    .from('toy_transactions')
    .update({ status: 'rejected', updated_at: now })
    .eq('id', tx.id)
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: 'Request declined.',
  })

  const { data: toy } = await admin.from('toys').select('name').eq('id', tx.toy_id).single()
  const { data: ownerName } = await admin.from('profiles').select('name').eq('id', userId).single()
  await admin.from('notifications').insert({
    recipient_id: tx.requester_id,
    type: 'toy_rejected',
    toy_transaction_id: tx.id,
    toy_name: toy?.name ?? 'a toy',
    actor_name: ownerName?.name ?? 'The owner',
  })

  return c.json(updated)
})

toyTransactions.post('/:id/withdraw', async (c) => {
  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  if (userId !== tx.owner_id && userId !== tx.requester_id) return c.json({ error: 'Not found' }, 404)
  if (tx.status !== 'requested' && tx.status !== 'accepted') {
    return c.json({ error: 'This request is no longer open' }, 409)
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data: updated, error } = await admin
    .from('toy_transactions')
    .update({ status: 'withdrawn', updated_at: now })
    .eq('id', tx.id)
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)

  await admin.from('toy_transaction_messages').insert({
    transaction_id: tx.id,
    sender_id: userId,
    kind: 'system',
    body: 'Request withdrawn.',
  })

  const { data: toy } = await admin.from('toys').select('name').eq('id', tx.toy_id).single()
  const { data: actor } = await admin.from('profiles').select('name').eq('id', userId).single()
  const recipientId = userId === tx.owner_id ? tx.requester_id : tx.owner_id
  await admin.from('notifications').insert({
    recipient_id: recipientId,
    type: 'toy_withdrawn',
    toy_transaction_id: tx.id,
    toy_name: toy?.name ?? 'a toy',
    actor_name: actor?.name ?? 'The other party',
  })

  return c.json(updated)
})
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd packages/api && npx vitest run --config vitest.integration.config.ts tests/integration/toy-transactions/reject-withdraw.test.ts`
Expected: PASS (4 tests). The stranger case relies on RLS's select-only-parties policy making `loadForParty` return `{ status: 404 }` for `stranger`.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/toy-transactions.ts packages/api/tests/integration/toy-transactions/reject-withdraw.test.ts
git commit -m "feat(api): add toy-transactions reject and withdraw routes"
```

---

### Task 10: toy-transactions API — confirm handoff

**Files:**
- Modify: `packages/api/src/routes/toy-transactions.ts`
- Test: `packages/api/tests/integration/toy-transactions/confirm.test.ts`

**Interfaces:**
- Consumes: `loadForParty` from Task 6.
- Produces: `POST /:id/confirm`.

- [ ] **Step 1: Write the failing integration test**

```typescript
// packages/api/tests/integration/toy-transactions/confirm.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const BASE = 'http://localhost'
function toysReq(path: string, token: string, init: RequestInit = {}) {
  return app.request(`${BASE}/api/toys${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}
function txReq(path: string, token: string, init: RequestInit = {}) {
  return app.request(`${BASE}/api/toy-transactions${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}
async function createPublishedToy(token: string, name: string, offerType: 'donation' | 'exchange' | 'both') {
  const create = await toysReq('/', token, { method: 'POST', body: JSON.stringify({ name, condition: 7 }) })
  const toy = (await create.json()) as { id: string }
  await toysReq(`/${toy.id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ cover_photo_url: 'https://example.com/c.jpg', offer_type: offerType }),
  })
  await toysReq(`/${toy.id}/publish`, token, { method: 'PATCH' })
  return toy.id
}

describe('POST /api/toy-transactions/:id/confirm', () => {
  let owner: TestUser
  let requester: TestUser

  afterAll(async () => {
    await deleteTestUser(owner.id)
    await deleteTestUser(requester.id)
  })

  beforeAll(async () => {
    owner = await createTestUser('contributor')
    requester = await createTestUser('contributor')
  })

  it('completes a donation on the owner confirming the requester code alone', async () => {
    const toyId = await createPublishedToy(owner.token, 'Scooter', 'donation')
    const created = await txReq('/', requester.token, { method: 'POST', body: JSON.stringify({ toy_id: toyId, type: 'donation' }) })
    const txId = ((await created.json()) as { id: string }).id
    await txReq(`/${txId}/accept`, owner.token, { method: 'POST' })
    const detail = await txReq(`/${txId}`, owner.token)
    const tx = (await detail.json()) as { requester_code: string }

    const res = await txReq(`/${txId}/confirm`, owner.token, {
      method: 'POST',
      body: JSON.stringify({ code: tx.requester_code }),
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { status: string }).status).toBe('completed')

    const toyAfter = await toysReq(`/${toyId}`, owner.token)
    expect(((await toyAfter.json()) as { archived_at: string | null }).archived_at).not.toBeNull()
  })

  it('400s an incorrect code', async () => {
    const toyId = await createPublishedToy(owner.token, 'Wagon', 'donation')
    const created = await txReq('/', requester.token, { method: 'POST', body: JSON.stringify({ toy_id: toyId, type: 'donation' }) })
    const txId = ((await created.json()) as { id: string }).id
    await txReq(`/${txId}/accept`, owner.token, { method: 'POST' })

    const res = await txReq(`/${txId}/confirm`, owner.token, { method: 'POST', body: JSON.stringify({ code: '000000' }) })
    expect(res.status).toBe(400)
  })

  it('completes an exchange only once both parties confirm, archiving both toys', async () => {
    const ownerToyId = await createPublishedToy(owner.token, 'Train set', 'exchange')
    const requesterToyId = await createPublishedToy(requester.token, 'Doll house', 'exchange')
    const created = await txReq('/', requester.token, {
      method: 'POST',
      body: JSON.stringify({ toy_id: ownerToyId, type: 'exchange', offered_toy_id: requesterToyId }),
    })
    const txId = ((await created.json()) as { id: string }).id
    await txReq(`/${txId}/accept`, owner.token, { method: 'POST' })
    const detail = await txReq(`/${txId}`, owner.token)
    const tx = (await detail.json()) as { owner_code: string; requester_code: string }

    const ownerConfirm = await txReq(`/${txId}/confirm`, owner.token, {
      method: 'POST',
      body: JSON.stringify({ code: tx.requester_code }),
    })
    expect(((await ownerConfirm.json()) as { status: string }).status).toBe('accepted')

    const requesterConfirm = await txReq(`/${txId}/confirm`, requester.token, {
      method: 'POST',
      body: JSON.stringify({ code: tx.owner_code }),
    })
    expect(((await requesterConfirm.json()) as { status: string }).status).toBe('completed')

    const ownerToyAfter = await toysReq(`/${ownerToyId}`, owner.token)
    const requesterToyAfter = await toysReq(`/${requesterToyId}`, requester.token)
    expect(((await ownerToyAfter.json()) as { archived_at: string | null }).archived_at).not.toBeNull()
    expect(((await requesterToyAfter.json()) as { archived_at: string | null }).archived_at).not.toBeNull()
  })

  it('403s the requester trying to confirm a donation (owner-only)', async () => {
    const toyId = await createPublishedToy(owner.token, 'Tricycle', 'donation')
    const created = await txReq('/', requester.token, { method: 'POST', body: JSON.stringify({ toy_id: toyId, type: 'donation' }) })
    const txId = ((await created.json()) as { id: string }).id
    await txReq(`/${txId}/accept`, owner.token, { method: 'POST' })

    const res = await txReq(`/${txId}/confirm`, requester.token, { method: 'POST', body: JSON.stringify({ code: '123456' }) })
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/api && npx vitest run --config vitest.integration.config.ts tests/integration/toy-transactions/confirm.test.ts`
Expected: FAIL — `POST /:id/confirm` does not exist.

- [ ] **Step 3: Add the route**

In `packages/api/src/routes/toy-transactions.ts`, add after the withdraw route:

```typescript
toyTransactions.post('/:id/confirm', async (c) => {
  const body = await c.req.json()
  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  const isOwner = userId === tx.owner_id
  if (!isOwner && userId !== tx.requester_id) return c.json({ error: 'Not found' }, 404)
  if (tx.status !== 'accepted') return c.json({ error: 'This request is not ready to confirm' }, 409)

  const canConfirm = tx.type === 'exchange' || isOwner
  if (!canConfirm) return c.json({ error: 'Only the owner confirms a donation' }, 403)

  const expectedCode = isOwner ? tx.requester_code : tx.owner_code
  if (body.code !== expectedCode) return c.json({ error: 'Incorrect code' }, 400)

  const admin = createAdminClient()
  const confirmField = isOwner ? 'owner_confirmed_at' : 'requester_confirmed_at'
  const now = new Date().toISOString()

  const { data: updated, error } = await admin
    .from('toy_transactions')
    .update({ [confirmField]: now, updated_at: now })
    .eq('id', tx.id)
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)

  const bothConfirmed =
    tx.type === 'donation'
      ? updated.owner_confirmed_at !== null
      : updated.owner_confirmed_at !== null && updated.requester_confirmed_at !== null

  if (bothConfirmed) {
    await admin.from('toy_transactions').update({ status: 'completed', updated_at: now }).eq('id', tx.id)
    await admin.from('toys').update({ archived_at: now, updated_at: now }).eq('id', tx.toy_id)
    if (tx.offered_toy_id) {
      await admin.from('toys').update({ archived_at: now, updated_at: now }).eq('id', tx.offered_toy_id)
    }
    await admin.from('toy_transaction_messages').insert({
      transaction_id: tx.id,
      sender_id: userId,
      kind: 'system',
      body: 'Handoff confirmed. This exchange is complete.',
    })
  } else {
    await admin.from('toy_transaction_messages').insert({
      transaction_id: tx.id,
      sender_id: userId,
      kind: 'system',
      body: 'Handoff confirmed by one party. Waiting on the other.',
    })
  }

  return c.json(bothConfirmed ? { ...updated, status: 'completed' } : updated)
})
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd packages/api && npx vitest run --config vitest.integration.config.ts tests/integration/toy-transactions/confirm.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full API unit and integration suites**

Run: `cd packages/api && npx vitest run && npx vitest run --config vitest.integration.config.ts`
Expected: all pass. Also run `npx tsc --noEmit` in `packages/api` to catch any type drift across the six route additions in Tasks 6–10.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/toy-transactions.ts packages/api/tests/integration/toy-transactions/confirm.test.ts
git commit -m "feat(api): add toy-transactions confirm route completing donation/exchange handoffs"
```

---

### Task 11: public.ts — hide archived and mid-handoff toys

**Files:**
- Modify: `packages/api/src/routes/public.ts`
- Test: `packages/api/tests/integration/toys/public.test.ts`

**Interfaces:**
- Consumes: `createAdminClient()` (already imported in `public.ts` for the anon-client-can't-see-transactions exception).
- Produces: `midHandoffToyIds()` helper; both `GET /toys` and `GET /toys/:id` now exclude archived and mid-handoff toys.

- [ ] **Step 1: Write the failing test**

Add to `packages/api/tests/integration/toys/public.test.ts`, inside the existing `describe('GET /api/public/toys', ...)` block (after the existing `beforeAll`/`afterAll`, alongside the existing `it`s):

```typescript
  it('excludes an archived toy from the public list and its detail page', async () => {
    const archivedId = await createPublishedToy(owner.token, 'Archived unicycle')
    // Directly flip archived_at the way the confirm route would — this test
    // only needs to prove public.ts's filter, not re-run the whole handoff flow.
    const admin = (await import('../../../src/supabase/client.js')).createAdminClient()
    await admin.from('toys').update({ archived_at: new Date().toISOString() }).eq('id', archivedId)

    const list = await app.request('/api/public/toys')
    const ids = ((await list.json()) as Array<{ id: string }>).map((r) => r.id)
    expect(ids).not.toContain(archivedId)

    const detail = await app.request(`/api/public/toys/${archivedId}`)
    expect(detail.status).toBe(404)
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/api && npx vitest run --config vitest.integration.config.ts tests/integration/toys/public.test.ts`
Expected: FAIL — the archived toy still appears (no `archived_at` filter exists yet).

- [ ] **Step 3: Add the filter and mid-handoff helper**

In `packages/api/src/routes/public.ts`, add near the top (below existing imports):

```typescript
async function midHandoffToyIds(): Promise<string[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('toy_transactions')
    .select('toy_id, offered_toy_id')
    .eq('status', 'accepted')
  const ids = new Set<string>()
  for (const row of data ?? []) {
    ids.add(row.toy_id)
    if (row.offered_toy_id) ids.add(row.offered_toy_id)
  }
  return [...ids]
}
```

In the `GET /toys` handler, after the existing `.eq('status', 'published')` filter and before ordering/executing the query, add:

```typescript
    .is('archived_at', null)
```

and, before building the query, fetch and apply the exclusion list:

```typescript
  const hidden = await midHandoffToyIds()
```

then chain `.not('id', 'in', `(${hidden.length ? hidden.map((id) => `"${id}"`).join(',') : 'null'})`)` onto the query — or, more simply and matching this file's existing style of filtering in application code rather than deep query-builder chaining, filter the returned rows in JS:

```typescript
  const { data, error } = await supabase
    .from('toys')
    .select('*, profiles(name)')
    .eq('status', 'published')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  const hidden = new Set(await midHandoffToyIds())
  return c.json((data ?? []).filter((t) => !hidden.has(t.id)))
```

In the `GET /toys/:id` handler, add the same `.is('archived_at', null)` to its `.eq('status', 'published')` query, and after fetching the row, add:

```typescript
  const hidden = new Set(await midHandoffToyIds())
  if (hidden.has(data.id)) return c.json({ error: 'Not found' }, 404)
```

before returning it.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd packages/api && npx vitest run --config vitest.integration.config.ts tests/integration/toys/public.test.ts`
Expected: PASS (all tests including the new one).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/public.ts packages/api/tests/integration/toys/public.test.ts
git commit -m "fix(api): hide archived and mid-handoff toys from the public library"
```

---

### Task 12: Profile pickup address — API and form

**Files:**
- Modify: `packages/api/src/routes/contributors.ts`
- Modify: `packages/web/components/profile-form.tsx`
- Test: `packages/api/tests/unit/routes/contributors.test.ts`
- Test: `packages/web/tests/unit/components/profile-form.test.tsx`

**Interfaces:**
- Consumes: `Profile` from Task 4 (now carries the four optional pickup fields).
- Produces: `contributors.ts`'s `EDITABLE` accepts the four pickup fields; `ProfileForm` gains four new inputs saved through the existing PATCH pattern.

- [ ] **Step 1: Write the failing API unit test**

In `packages/api/tests/unit/routes/contributors.test.ts`, add a test alongside the existing PATCH-related tests:

```typescript
  it('allows patching pickup address fields', async () => {
    const table = mockTable({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'user-1', name: 'Ash', pickup_line1: '1 Test St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000' },
        error: null,
      }),
    })
    userClient.from.mockReturnValue(table)

    const res = await app.request('/me', {
      method: 'PATCH',
      body: JSON.stringify({ pickup_line1: '1 Test St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(200)
    expect(table.update).toHaveBeenCalledWith(
      expect.objectContaining({ pickup_line1: '1 Test St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000' })
    )
  })
```

(Match this test's mock shape — `mockTable`, `userClient.from` — to whatever helper the existing tests in this file already use; if the file defines its mocks inline per-test rather than via a shared `mockTable` helper, follow that same inline pattern instead.)

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/api && npx vitest run tests/unit/routes/contributors.test.ts`
Expected: FAIL — `update` is not called with the pickup fields, since `EDITABLE` doesn't include them yet.

- [ ] **Step 3: Extend `EDITABLE`**

In `packages/api/src/routes/contributors.ts`, find:

```typescript
const EDITABLE = ['name'] as const
```

Change to:

```typescript
const EDITABLE = ['name', 'pickup_line1', 'pickup_suburb', 'pickup_state', 'pickup_postcode'] as const
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd packages/api && npx vitest run tests/unit/routes/contributors.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing web unit test**

In `packages/web/tests/unit/components/profile-form.test.tsx`, add a test alongside the existing name-editing tests:

```typescript
  it('saves the pickup address fields', async () => {
    const patch = vi.fn().mockResolvedValue({})
    render(<ProfileForm profile={baseProfile()} onSave={patch} />)

    await userEvent.type(screen.getByLabelText(/address line/i), '1 Test St')
    await userEvent.type(screen.getByLabelText(/suburb/i), 'Testville')
    await userEvent.type(screen.getByLabelText(/state/i), 'VIC')
    await userEvent.type(screen.getByLabelText(/postcode/i), '3000')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({ pickup_line1: '1 Test St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000' })
    )
  })
```

(Match `baseProfile()` to whatever fixture builder the existing tests in this file already use for `Profile`, and match `onSave` to this component's actual save-callback prop name — confirmed in Step 6 against the component's current source before writing the implementation.)

- [ ] **Step 6: Run it to verify it fails**

Run: `cd packages/web && npx vitest run tests/unit/components/profile-form.test.tsx`
Expected: FAIL — no pickup-address inputs exist yet.

- [ ] **Step 7: Add the pickup address section to `ProfileForm`**

In `packages/web/components/profile-form.tsx`, add local state for the four fields (mirroring the existing `name` state) and render four new labeled inputs above the Save button, in a new section:

```tsx
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <h2 className="text-sm font-semibold text-ink">Default pickup address</h2>
          <p className="text-xs text-muted">Sent automatically when you accept a donation or exchange request.</p>
          <label htmlFor="pickup-line1" className="field-label">Address line</label>
          <input id="pickup-line1" className="field" value={pickupLine1} onChange={(e) => setPickupLine1(e.target.value)} />
          <label htmlFor="pickup-suburb" className="field-label">Suburb</label>
          <input id="pickup-suburb" className="field" value={pickupSuburb} onChange={(e) => setPickupSuburb(e.target.value)} />
          <label htmlFor="pickup-state" className="field-label">State</label>
          <input id="pickup-state" className="field" value={pickupState} onChange={(e) => setPickupState(e.target.value)} />
          <label htmlFor="pickup-postcode" className="field-label">Postcode</label>
          <input id="pickup-postcode" className="field" value={pickupPostcode} onChange={(e) => setPickupPostcode(e.target.value)} />
        </div>
```

and extend the existing save handler's payload with `pickup_line1: pickupLine1, pickup_suburb: pickupSuburb, pickup_state: pickupState, pickup_postcode: pickupPostcode` alongside the existing `name` field, using the same PATCH call already wired for `name`.

- [ ] **Step 8: Run it to verify it passes**

Run: `cd packages/web && npx vitest run tests/unit/components/profile-form.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/api/src/routes/contributors.ts packages/api/tests/unit/routes/contributors.test.ts packages/web/components/profile-form.tsx packages/web/tests/unit/components/profile-form.test.tsx
git commit -m "feat(api,web): add default pickup address to profile"
```

---

### Task 13: Toy editor — offer type pills

**Files:**
- Modify: `packages/web/components/toy-editor.tsx`
- Test: `packages/web/tests/unit/components/toy-editor.test.tsx`

**Interfaces:**
- Consumes: `OfferType` from Task 4, `browserApiClient` (existing).
- Produces: `ToyEditor` gains a `saveOfferType(offerType: OfferType)` callback passed as a new `onSave` prop into `ToyReviewPanel`; `ToyReviewPanel` renders three pressed/unpressed pill buttons.

- [ ] **Step 1: Write the failing test**

Add to `packages/web/tests/unit/components/toy-editor.test.tsx`:

```typescript
  it('saves the offer type when a pill is clicked', async () => {
    const patchSpy = vi.spyOn(browserApiClient, 'patch').mockResolvedValue({})
    render(<ToyEditor toy={toy({ status: 'published', offer_type: null })} />)

    await userEvent.click(screen.getByRole('button', { name: 'Donation' }))

    expect(patchSpy).toHaveBeenCalledWith(`/api/toys/${toy().id}`, { offer_type: 'donation' })
  })

  it('shows the current offer type as pressed', () => {
    render(<ToyEditor toy={toy({ status: 'published', offer_type: 'both' })} />)
    expect(screen.getByRole('button', { name: 'Both' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Donation' })).toHaveAttribute('aria-pressed', 'false')
  })
```

(Match `toy(overrides)` to this file's existing fixture builder, already updated in Task 5 to include `offer_type: null`, and match the mocking style of `browserApiClient.patch` to whichever pattern the file's existing publish-flow tests already use.)

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/web && npx vitest run tests/unit/components/toy-editor.test.tsx`
Expected: FAIL — no "Donation"/"Both" buttons exist yet.

- [ ] **Step 3: Add `saveOfferType` to `ToyEditor` and pass it down**

In `packages/web/components/toy-editor.tsx`, alongside the existing `saveDetails`/`savePhotos` callbacks passed to sibling sections, add:

```typescript
  async function saveOfferType(offerType: OfferType) {
    const updated = await browserApiClient.patch<Toy>(`/api/toys/${toy.id}`, { offer_type: offerType })
    setToy(updated)
  }
```

(Match the exact update/setState pattern `saveDetails`/`savePhotos` already use in this file — if they call `setToy` with the PATCH response, mirror that exactly; if they merge partial state instead, mirror that instead.)

Pass it to `ToyReviewPanel`:

```tsx
<ToyReviewPanel toy={toy} onPublished={handlePublished} onSaveOfferType={saveOfferType} />
```

- [ ] **Step 4: Add the pill group to `ToyReviewPanel`**

In the same file, extend `ToyReviewPanel`'s props with `onSaveOfferType: (offerType: OfferType) => Promise<void>`, and render, above or below the existing publish button:

```tsx
      <div className="flex flex-col gap-2">
        <p className="field-label">Offer this toy for</p>
        <div className="flex gap-2">
          {(['donation', 'exchange', 'both'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={toy.offer_type === option}
              onClick={() => onSaveOfferType(option)}
              className={`btn ${toy.offer_type === option ? 'btn-accent' : 'btn-quiet'}`}
            >
              {option === 'donation' ? 'Donation' : option === 'exchange' ? 'Exchange' : 'Both'}
            </button>
          ))}
        </div>
      </div>
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd packages/web && npx vitest run tests/unit/components/toy-editor.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/components/toy-editor.tsx packages/web/tests/unit/components/toy-editor.test.tsx
git commit -m "feat(web): let a contributor set a toy's offer type from the editor"
```

---

### Task 14: My Toys — Active/Archived split

**Files:**
- Modify: `packages/web/app/dashboard/toys/page.tsx`
- Test: `packages/web/tests/unit/pages/dashboard-toys-list.test.tsx`

**Interfaces:**
- Consumes: `Toy.archived_at` from Task 4.
- Produces: the page renders two grids — Active (unchanged empty-state behaviour) and, only when non-empty, a muted Archived section below it.

- [ ] **Step 1: Write the failing tests**

Add to `packages/web/tests/unit/pages/dashboard-toys-list.test.tsx`, alongside the existing cases:

```typescript
  it('splits toys into Active and Archived sections', () => {
    render(
      <ToysListPage
        toys={[toy({ id: '1', name: 'Active toy', archived_at: null }), toy({ id: '2', name: 'Archived toy', archived_at: '2026-08-01T00:00:00Z' })]}
      />
    )
    expect(screen.getByText('Active toy')).toBeInTheDocument()
    expect(screen.getByText('Archived toy')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /archived/i })).toBeInTheDocument()
  })

  it('shows the empty state when there are no active toys, even if archived toys exist', () => {
    render(<ToysListPage toys={[toy({ id: '1', archived_at: '2026-08-01T00:00:00Z' })]} />)
    expect(screen.getByText(/no toys yet/i)).toBeInTheDocument()
  })

  it('omits the Archived heading when nothing is archived', () => {
    render(<ToysListPage toys={[toy({ id: '1', archived_at: null })]} />)
    expect(screen.queryByRole('heading', { name: /archived/i })).not.toBeInTheDocument()
  })
```

(Match `ToysListPage`'s exact export name/props and the exact empty-state copy — e.g. `/no toys yet/i` — to what the file's existing tests already assert; these three new tests reuse that same rendering entry point and the `toy(overrides)` fixture already extended in Task 5.)

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/web && npx vitest run tests/unit/pages/dashboard-toys-list.test.tsx`
Expected: FAIL — no Archived heading exists, and the empty state currently checks `toys.length === 0` rather than active-only.

- [ ] **Step 3: Split the grid in the page**

In `packages/web/app/dashboard/toys/page.tsx`, after fetching `toys`, add:

```typescript
  const activeToys = toys.filter((t) => !t.archived_at)
  const archivedToys = toys.filter((t) => t.archived_at)
```

Change the existing empty-state check from `toys.length === 0` to `activeToys.length === 0`, and change the active grid's `.map()` source from `toys` to `activeToys`. Below the active grid, add:

```tsx
      {archivedToys.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-muted">Archived</h2>
          <div className="grid grid-cols-1 gap-4 opacity-60 sm:grid-cols-2 lg:grid-cols-3">
            {archivedToys.map((t) => (
              <ToyCard key={t.id} toy={t} />
            ))}
          </div>
        </div>
      )}
```

(Reuse whichever card component/markup the existing active grid already maps to — `ToyCard` here stands for that exact existing per-toy element, not a new component.)

- [ ] **Step 4: Run it to verify it passes**

Run: `cd packages/web && npx vitest run tests/unit/pages/dashboard-toys-list.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/dashboard/toys/page.tsx packages/web/tests/unit/pages/dashboard-toys-list.test.tsx
git commit -m "feat(web): split My Toys into Active and Archived sections"
```

---

### Task 15: Public toy detail page and request UI

**Files:**
- Create: `packages/web/app/toy-library/[id]/page.tsx`
- Create: `packages/web/components/toy-transaction-request.tsx`
- Test: `packages/web/tests/unit/components/toy-transaction-request.test.tsx`

**Interfaces:**
- Consumes: `ToyTransaction`, `Toy` from Task 4; `browserApiClient` (existing); `getCapabilities()` (existing); `ToySummary` component (existing, accepts `Toy` directly).
- Produces: `ToyTransactionRequest({ toy, viewerId, myToys })` component; a new route `/toy-library/[id]` that `ToyLibraryCard` (already linking there) now resolves to a real page.

- [ ] **Step 1: Write the failing component test**

```typescript
// packages/web/tests/unit/components/toy-transaction-request.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToyTransactionRequest } from '@/components/toy-transaction-request'
import { browserApiClient } from '@/lib/browser-api-client'
import type { Toy, ToyWithOwner } from '@splat-connect/types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

function toy(overrides: Partial<ToyWithOwner> = {}): ToyWithOwner {
  return {
    id: 'toy-1',
    owner_id: 'owner-1',
    name: 'Fire truck',
    description: null,
    condition: 7,
    switch_adapted: false,
    cover_photo_url: 'https://example.com/c.jpg',
    switch_photo_urls: [],
    status: 'published',
    offer_type: 'both',
    archived_at: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    profiles: { name: 'Sam' },
    ...overrides,
  } as ToyWithOwner
}

function myToy(overrides: Partial<Toy> = {}): Toy {
  return {
    id: 'my-toy-1',
    owner_id: 'viewer-1',
    name: 'Blocks',
    description: null,
    condition: 8,
    switch_adapted: false,
    cover_photo_url: null,
    switch_photo_urls: [],
    status: 'published',
    offer_type: null,
    archived_at: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

describe('ToyTransactionRequest', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('prompts a signed-out visitor to sign in', () => {
    render(<ToyTransactionRequest toy={toy()} viewerId={null} myToys={[]} />)
    expect(screen.getByText(/sign in/i)).toBeInTheDocument()
  })

  it('shows nothing for the owner viewing their own toy', () => {
    const { container } = render(<ToyTransactionRequest toy={toy()} viewerId="owner-1" myToys={[]} />)
    expect(container.textContent).toBe('')
  })

  it('starts a donation request', async () => {
    const post = vi.spyOn(browserApiClient, 'post').mockResolvedValue({ id: 'tx-1' })
    render(<ToyTransactionRequest toy={toy({ offer_type: 'donation' })} viewerId="viewer-1" myToys={[]} />)

    await userEvent.click(screen.getByRole('button', { name: /arrange pickup/i }))

    expect(post).toHaveBeenCalledWith('/api/toy-transactions', { toy_id: 'toy-1', type: 'donation' })
  })

  it('prompts to add a toy before exchanging when My Toys is empty', async () => {
    render(<ToyTransactionRequest toy={toy({ offer_type: 'exchange' })} viewerId="viewer-1" myToys={[]} />)

    await userEvent.click(screen.getByRole('button', { name: /arrange exchange/i }))

    expect(screen.getByText(/add a toy/i)).toBeInTheDocument()
  })

  it('starts an exchange with a chosen toy', async () => {
    const post = vi.spyOn(browserApiClient, 'post').mockResolvedValue({ id: 'tx-1' })
    render(<ToyTransactionRequest toy={toy({ offer_type: 'exchange' })} viewerId="viewer-1" myToys={[myToy()]} />)

    await userEvent.click(screen.getByRole('button', { name: /arrange exchange/i }))
    await userEvent.selectOptions(screen.getByLabelText(/offer one of your toys/i), 'my-toy-1')
    await userEvent.click(screen.getByRole('button', { name: /start exchange/i }))

    expect(post).toHaveBeenCalledWith('/api/toy-transactions', { toy_id: 'toy-1', type: 'exchange', offered_toy_id: 'my-toy-1' })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/web && npx vitest run tests/unit/components/toy-transaction-request.test.tsx`
Expected: FAIL — `@/components/toy-transaction-request` does not exist.

- [ ] **Step 3: Write the component**

```tsx
// packages/web/components/toy-transaction-request.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import Link from 'next/link'
import { browserApiClient } from '@/lib/browser-api-client'
import type { Toy, ToyTransaction, ToyWithOwner } from '@splat-connect/types'

export function ToyTransactionRequest({
  toy,
  viewerId,
  myToys,
}: {
  toy: ToyWithOwner
  viewerId: string | null
  myToys: Toy[]
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'choosing-exchange'>('idle')
  const [offeredToyId, setOfferedToyId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!viewerId) {
    return (
      <p className="text-sm text-muted">
        <Link href="/login" className="font-semibold text-brand-dark underline">
          Sign in
        </Link>{' '}
        to request this toy.
      </p>
    )
  }
  if (viewerId === toy.owner_id) return null
  if (!toy.offer_type) {
    return <p className="text-sm text-muted">Not currently offered for donation or exchange.</p>
  }

  async function start(type: 'donation' | 'exchange', offered_toy_id?: string) {
    setBusy(true)
    setError(null)
    try {
      const tx = await browserApiClient.post<ToyTransaction>('/api/toy-transactions', {
        toy_id: toy.id,
        type,
        ...(offered_toy_id ? { offered_toy_id } : {}),
      })
      router.push(`/dashboard/exchanges/${tx.id}` as Route<string>)
    } catch {
      setError('Could not start this request. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const canDonate = toy.offer_type === 'donation' || toy.offer_type === 'both'
  const canExchange = toy.offer_type === 'exchange' || toy.offer_type === 'both'

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      {canDonate && (
        <button type="button" disabled={busy} onClick={() => start('donation')} className="btn btn-accent">
          Arrange pickup
        </button>
      )}
      {canExchange && mode === 'idle' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (myToys.length === 0) {
              setError('Add a toy to My Toys before you can offer an exchange.')
              return
            }
            setMode('choosing-exchange')
          }}
          className="btn btn-quiet"
        >
          Arrange exchange
        </button>
      )}
      {mode === 'choosing-exchange' && (
        <div className="flex flex-col gap-2">
          <label htmlFor="offered-toy" className="field-label">
            Offer one of your toys
          </label>
          <select
            id="offered-toy"
            className="field"
            value={offeredToyId}
            onChange={(e) => setOfferedToyId(e.target.value)}
          >
            <option value="">Choose a toy…</option>
            {myToys.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !offeredToyId}
            onClick={() => start('exchange', offeredToyId)}
            className="btn btn-accent"
          >
            {busy ? 'Starting…' : 'Start exchange'}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add `ToyWithOwner` to shared types**

In `packages/types/src/index.ts`, add near `Toy`:

```typescript
export interface ToyWithOwner extends Toy {
  profiles: { name: string } | null
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd packages/web && npx vitest run tests/unit/components/toy-transaction-request.test.tsx`
Expected: PASS.

- [ ] **Step 6: Write the detail page**

```tsx
// packages/web/app/toy-library/[id]/page.tsx
import { notFound } from 'next/navigation'
import { ToySummary } from '@/components/toy-summary'
import { ToyTransactionRequest } from '@/components/toy-transaction-request'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import type { Toy, ToyWithOwner } from '@splat-connect/types'

export default async function ToyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let toy: ToyWithOwner
  try {
    const res = await fetch(`${process.env.API_URL}/api/public/toys/${id}`, { cache: 'no-store' })
    if (!res.ok) notFound()
    toy = (await res.json()) as ToyWithOwner
  } catch {
    notFound()
  }

  const caps = await getCapabilities()
  const myToys = caps ? await apiClient.get<Toy[]>('/api/toys').catch(() => [] as Toy[]) : []

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-ink">{toy.name}</h1>
      {toy.profiles?.name && <p className="mb-6 text-sm text-muted">Held by {toy.profiles.name}</p>}
      <ToySummary toy={toy} />
      <div className="mt-6">
        <ToyTransactionRequest toy={toy} viewerId={caps?.profile.id ?? null} myToys={myToys} />
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Typecheck and manually verify in the browser**

Run: `cd packages/web && npx tsc --noEmit`
Then start the dev server (`npm run dev` from the repo's usual dev command) and visit a published toy's `/toy-library/<id>` page signed in as a non-owner: confirm the correct button(s) appear per the toy's `offer_type`, and that clicking "Arrange pickup" navigates to `/dashboard/exchanges/<new-id>` (the page from Task 17 — a 404 there until that task lands is expected at this point in the plan).

- [ ] **Step 8: Commit**

```bash
git add packages/web/app/toy-library/[id]/page.tsx packages/web/components/toy-transaction-request.tsx packages/web/tests/unit/components/toy-transaction-request.test.tsx packages/types/src/index.ts
git commit -m "feat(web): add public toy detail page with donation/exchange request buttons"
```

---

### Task 16: Exchanges nav entry and icon

**Files:**
- Modify: `packages/web/lib/nav-model.ts`
- Modify: `packages/web/components/icons.tsx`
- Modify: `packages/web/components/rail.tsx`
- Test: `packages/web/tests/unit/lib/nav-model.test.ts`

**Interfaces:**
- Produces: `IconName` union gains `'handshake'`; `ICONS` registry in `rail.tsx` gains a `handshake` entry; `buildNav()`'s "Yours" group gains an unconditional `{ label: 'Exchanges', href: '/dashboard/exchanges', icon: 'handshake' }` row.

- [ ] **Step 1: Update the row-count and href assertions**

In `packages/web/tests/unit/lib/nav-model.test.ts`, change:

```typescript
  it('builds fourteen linked rows for a leader-admin', () => {
    const rows = buildNav(caps({ ledOrgs: [org], isAdmin: true }), 0).flatMap((g) => g.rows)
    expect(rows).toHaveLength(14)
  })
```

to:

```typescript
  it('builds fifteen linked rows for a leader-admin', () => {
    const rows = buildNav(caps({ ledOrgs: [org], isAdmin: true }), 0).flatMap((g) => g.rows)
    expect(rows).toHaveLength(15)
  })
```

and update the preceding comment block from "hence fourteen here (thirteen plus Notifications)" to "hence fifteen here (thirteen plus Notifications plus Exchanges)". Add one new assertion to the "adds the Organisation group only when the account leads an org" test's `hrefs` check is unaffected (Exchanges is unconditional, not org-gated), so add a standalone new test instead:

```typescript
  it('includes an Exchanges row for every account', () => {
    expect(hrefs(buildNav(caps(), 0))).toContain('/dashboard/exchanges')
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/web && npx vitest run tests/unit/lib/nav-model.test.ts`
Expected: FAIL — `/dashboard/exchanges` is not in `hrefs`, and the row count is 14, not 15.

- [ ] **Step 3: Add `'handshake'` to `IconName` and the new row**

In `packages/web/lib/nav-model.ts`, add `'handshake'` to the `IconName` union (alongside the existing 14 members). In the `buildNav()` function, find the "Yours" group's row list (containing `/dashboard/toys`) and add, after the My Toys row:

```typescript
      { label: 'Exchanges', href: '/dashboard/exchanges', icon: 'handshake' },
```

- [ ] **Step 4: Add the icon**

In `packages/web/components/icons.tsx`, add a new exported icon component alongside the other 19, following this file's existing wrapper pattern (each icon here wraps an `<svg>` with the same size/stroke props as its siblings):

```tsx
export function Handshake(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 11l4-3 3 2 4-2 4 3" />
      <path d="M3 11v3l4 3 3-2 3 2 4-3v-3" />
    </Icon>
  )
}
```

(Match the exact `Icon` wrapper name/import this file's other icons already use — the two-line hand/clasp path above is illustrative and can be adjusted to match this file's existing stroke-width/viewBox conventions as long as it renders as a distinct glyph.)

- [ ] **Step 5: Register it in `rail.tsx`**

In `packages/web/components/rail.tsx`, import `Handshake` from `./icons` alongside the other icon imports, and add `handshake: Handshake,` to the `ICONS` record.

- [ ] **Step 6: Run it to verify it passes**

Run: `cd packages/web && npx vitest run tests/unit/lib/nav-model.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/web/lib/nav-model.ts packages/web/components/icons.tsx packages/web/components/rail.tsx packages/web/tests/unit/lib/nav-model.test.ts
git commit -m "feat(web): add Exchanges nav row and handshake icon"
```

---

### Task 17: Exchanges list and thread pages

**Files:**
- Create: `packages/web/app/dashboard/exchanges/page.tsx`
- Create: `packages/web/app/dashboard/exchanges/[id]/page.tsx`
- Create: `packages/web/components/toy-transaction-thread.tsx`
- Test: `packages/web/tests/unit/components/toy-transaction-thread.test.tsx`

**Interfaces:**
- Consumes: `ToyTransactionSummary`, `ToyTransactionDetail` from Task 4; `apiClient`, `getCapabilities()` (existing).
- Produces: `ToyTransactionThread({ transaction, viewerId, onSendMessage, onAccept, onReject, onWithdraw, onConfirm })`.

- [ ] **Step 1: Write the failing component test**

```typescript
// packages/web/tests/unit/components/toy-transaction-thread.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToyTransactionThread } from '@/components/toy-transaction-thread'
import type { ToyTransactionDetail } from '@splat-connect/types'

function tx(overrides: Partial<ToyTransactionDetail> = {}): ToyTransactionDetail {
  return {
    id: 'tx-1',
    toy_id: 'toy-1',
    offered_toy_id: null,
    type: 'donation',
    status: 'requested',
    requester_id: 'requester-1',
    owner_id: 'owner-1',
    owner_code: null,
    requester_code: null,
    owner_confirmed_at: null,
    requester_confirmed_at: null,
    pickup_line1: null,
    pickup_suburb: null,
    pickup_state: null,
    pickup_postcode: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    toy_name: 'Fire truck',
    offered_toy_name: null,
    owner_name: 'Sam',
    requester_name: 'Ash',
    messages: [{ id: 'm1', transaction_id: 'tx-1', sender_id: 'requester-1', kind: 'system', body: 'Requested this toy for donation.', created_at: '2026-08-01T00:00:00Z' }],
    ...overrides,
  }
}

const noop = vi.fn().mockResolvedValue(undefined)

describe('ToyTransactionThread', () => {
  it('shows Accept and Reject to the owner on a requested donation', () => {
    render(
      <ToyTransactionThread transaction={tx()} viewerId="owner-1" onSendMessage={noop} onAccept={noop} onReject={noop} onWithdraw={noop} onConfirm={noop} />
    )
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
  })

  it('does not show Accept/Reject to the requester', () => {
    render(
      <ToyTransactionThread transaction={tx()} viewerId="requester-1" onSendMessage={noop} onAccept={noop} onReject={noop} onWithdraw={noop} onConfirm={noop} />
    )
    expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument()
  })

  it('lets only the owner confirm a donation, using the requester code', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <ToyTransactionThread
        transaction={tx({ status: 'accepted', owner_code: '111111', requester_code: '222222' })}
        viewerId="owner-1"
        onSendMessage={noop}
        onAccept={noop}
        onReject={noop}
        onWithdraw={noop}
        onConfirm={onConfirm}
      />
    )
    await userEvent.type(screen.getByLabelText(/other party's code/i), '222222')
    await userEvent.click(screen.getByRole('button', { name: /confirm handoff/i }))
    expect(onConfirm).toHaveBeenCalledWith('222222')
  })

  it('does not let the requester confirm a donation', () => {
    render(
      <ToyTransactionThread
        transaction={tx({ status: 'accepted', owner_code: '111111', requester_code: '222222' })}
        viewerId="requester-1"
        onSendMessage={noop}
        onAccept={noop}
        onReject={noop}
        onWithdraw={noop}
        onConfirm={noop}
      />
    )
    expect(screen.queryByRole('button', { name: /confirm handoff/i })).not.toBeInTheDocument()
  })

  it('lets both parties confirm an exchange', () => {
    render(
      <ToyTransactionThread
        transaction={tx({ type: 'exchange', status: 'accepted', owner_code: '111111', requester_code: '222222' })}
        viewerId="requester-1"
        onSendMessage={noop}
        onAccept={noop}
        onReject={noop}
        onWithdraw={noop}
        onConfirm={noop}
      />
    )
    expect(screen.getByRole('button', { name: /confirm handoff/i })).toBeInTheDocument()
  })

  it('shows a completed message and no actions once completed', () => {
    render(
      <ToyTransactionThread transaction={tx({ status: 'completed' })} viewerId="owner-1" onSendMessage={noop} onAccept={noop} onReject={noop} onWithdraw={noop} onConfirm={noop} />
    )
    expect(screen.getByText(/handoff complete/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /withdraw/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/web && npx vitest run tests/unit/components/toy-transaction-thread.test.tsx`
Expected: FAIL — `@/components/toy-transaction-thread` does not exist.

- [ ] **Step 3: Write the component**

```tsx
// packages/web/components/toy-transaction-thread.tsx
'use client'

import { useState } from 'react'
import type { ToyTransactionDetail } from '@splat-connect/types'

export function ToyTransactionThread({
  transaction,
  viewerId,
  onSendMessage,
  onAccept,
  onReject,
  onWithdraw,
  onConfirm,
}: {
  transaction: ToyTransactionDetail
  viewerId: string
  onSendMessage: (body: string) => Promise<void>
  onAccept: () => Promise<void>
  onReject: () => Promise<void>
  onWithdraw: () => Promise<void>
  onConfirm: (code: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tx = transaction
  const isOwner = viewerId === tx.owner_id
  const nameFor = (senderId: string) => (senderId === tx.owner_id ? tx.owner_name : tx.requester_name)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    if (!draft.trim()) return
    const body = draft
    setDraft('')
    await run(() => onSendMessage(body))
  }

  const open = tx.status === 'requested' || tx.status === 'accepted'
  const canConfirm = tx.status === 'accepted' && (tx.type === 'exchange' || isOwner)
  const alreadyConfirmed = isOwner ? tx.owner_confirmed_at !== null : tx.requester_confirmed_at !== null
  const myCode = isOwner ? tx.owner_code : tx.requester_code
  const showMyCode = tx.status === 'accepted' && (tx.type === 'exchange' || !isOwner)

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {tx.messages.map((m) => (
          <li key={m.id} className={`card-flat px-4 py-3 text-sm ${m.kind === 'system' ? 'italic text-muted' : ''}`}>
            {m.kind === 'user' && (
              <p className="font-semibold text-ink">{m.sender_id === viewerId ? 'You' : nameFor(m.sender_id)}</p>
            )}
            <p>{m.body}</p>
          </li>
        ))}
      </ul>

      {open && (
        <div className="flex gap-2">
          <label htmlFor="message" className="sr-only">
            Message
          </label>
          <textarea id="message" className="field flex-1" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="button" disabled={busy || !draft.trim()} onClick={send} className="btn btn-accent">
            Send
          </button>
        </div>
      )}

      {tx.status === 'requested' && isOwner && (
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => run(onAccept)} className="btn btn-accent">
            Accept
          </button>
          <button type="button" disabled={busy} onClick={() => run(onReject)} className="btn btn-quiet">
            Reject
          </button>
        </div>
      )}

      {open && (
        <button type="button" disabled={busy} onClick={() => run(onWithdraw)} className="btn btn-quiet">
          Withdraw
        </button>
      )}

      {tx.status === 'accepted' && (tx.pickup_line1 || tx.pickup_suburb) && (
        <div className="card-flat px-4 py-3 text-sm">
          <p className="font-semibold text-ink">Pickup location</p>
          <p>{[tx.pickup_line1, tx.pickup_suburb, tx.pickup_state, tx.pickup_postcode].filter(Boolean).join(', ')}</p>
        </div>
      )}

      {showMyCode && myCode && (
        <p className="text-sm text-muted">
          Your handoff code: <span className="font-bold text-ink">{myCode}</span>
        </p>
      )}

      {canConfirm && !alreadyConfirmed && (
        <div className="flex gap-2">
          <label htmlFor="handoff-code" className="sr-only">
            Enter the other party&apos;s code
          </label>
          <input
            id="handoff-code"
            className="field"
            placeholder="Enter their code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="button" disabled={busy || !code.trim()} onClick={() => run(() => onConfirm(code))} className="btn btn-accent">
            Confirm handoff
          </button>
        </div>
      )}

      {tx.status === 'completed' && <p className="font-semibold text-mint-deep">Handoff complete.</p>}
      {tx.status === 'rejected' && <p className="text-sm text-muted">This request was declined.</p>}
      {tx.status === 'withdrawn' && <p className="text-sm text-muted">This request was withdrawn.</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd packages/web && npx vitest run tests/unit/components/toy-transaction-thread.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the list page**

```tsx
// packages/web/app/dashboard/exchanges/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import type { ToyTransactionSummary } from '@splat-connect/types'

export default async function ExchangesPage() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  const transactions = await apiClient.get<ToyTransactionSummary[]>('/api/toy-transactions')

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Exchanges</h1>
      {transactions.length === 0 ? (
        <p className="text-sm text-muted">No donation or exchange requests yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {transactions.map((tx) => (
            <li key={tx.id}>
              <Link href={`/dashboard/exchanges/${tx.id}`} className="card card-link flex flex-col gap-1 p-4">
                <p className="font-bold text-ink">{tx.toy_name}</p>
                <p className="text-sm text-muted">
                  {tx.type === 'donation' ? 'Donation' : 'Exchange'} with {tx.other_party_name} — {tx.status}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Write the detail/thread page**

```tsx
// packages/web/app/dashboard/exchanges/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { ToyTransactionThread } from '@/components/toy-transaction-thread'
import type { ToyTransactionDetail } from '@splat-connect/types'

export default async function ExchangeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  let tx: ToyTransactionDetail
  try {
    tx = await apiClient.get<ToyTransactionDetail>(`/api/toy-transactions/${id}`)
  } catch {
    notFound()
  }

  async function sendMessage(body: string) {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/messages`, { body })
    revalidatePath(`/dashboard/exchanges/${id}`)
  }
  async function accept() {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/accept`, {})
    revalidatePath(`/dashboard/exchanges/${id}`)
  }
  async function reject() {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/reject`, {})
    revalidatePath(`/dashboard/exchanges/${id}`)
  }
  async function withdraw() {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/withdraw`, {})
    revalidatePath(`/dashboard/exchanges/${id}`)
  }
  async function confirm(code: string) {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/confirm`, { code })
    revalidatePath(`/dashboard/exchanges/${id}`)
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">{tx.toy_name}</h1>
      <ToyTransactionThread
        transaction={tx}
        viewerId={caps.profile.id}
        onSendMessage={sendMessage}
        onAccept={accept}
        onReject={reject}
        onWithdraw={withdraw}
        onConfirm={confirm}
      />
    </div>
  )
}
```

- [ ] **Step 7: Typecheck and manually verify in the browser**

Run: `cd packages/web && npx tsc --noEmit`
Then, with the dev server running, walk the full donation happy path across two signed-in browser sessions (or two browsers): owner publishes a donation toy, requester requests it from `/toy-library/<id>`, owner accepts from `/dashboard/exchanges/<id>` and sees the generated code, requester enters their own code back to the owner, owner confirms, toy disappears from owner's active My Toys grid.

- [ ] **Step 8: Commit**

```bash
git add packages/web/app/dashboard/exchanges packages/web/components/toy-transaction-thread.tsx packages/web/tests/unit/components/toy-transaction-thread.test.tsx
git commit -m "feat(web): add Exchanges list and thread pages"
```

---

### Task 18: Notifications — toy copy and deep-linking

**Files:**
- Modify: `packages/web/components/notifications-list.tsx`
- Test: `packages/web/tests/unit/components/notifications-list.test.tsx`

**Interfaces:**
- Consumes: `Notification` (extended in Task 4).
- Produces: `COPY` map covers the 5 new toy notification types; a new `linkFor(n: Notification): string` function; clicking a notification now navigates via `router.push`.

- [ ] **Step 1: Update the `useRouter` mock and add failing tests**

In `packages/web/tests/unit/components/notifications-list.test.tsx`, change:

```typescript
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
```

to:

```typescript
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
```

Add new tests alongside the existing three:

```typescript
  it('shows toy-specific copy for a toy_request notification', () => {
    render(<NotificationsList notifications={[baseNotif({ type: 'toy_request', tutorial_id: null, tutorial_title: null, toy_transaction_id: 'tx-1', toy_name: 'Fire truck' })]} onMarkRead={vi.fn()} />)
    expect(screen.getByText(/requested/i)).toBeInTheDocument()
    expect(screen.getByText(/fire truck/i)).toBeInTheDocument()
  })

  it('navigates to the exchange thread when a toy notification is clicked', async () => {
    const push = vi.fn()
    vi.mocked(useRouter).mockReturnValue({ refresh: vi.fn(), push } as unknown as ReturnType<typeof useRouter>)
    const onMarkRead = vi.fn().mockResolvedValue(undefined)
    render(<NotificationsList notifications={[baseNotif({ type: 'toy_accepted', tutorial_id: null, tutorial_title: null, toy_transaction_id: 'tx-1', toy_name: 'Fire truck' })]} onMarkRead={onMarkRead} />)

    await userEvent.click(screen.getByText(/fire truck/i))

    expect(push).toHaveBeenCalledWith('/dashboard/exchanges/tx-1')
  })
```

(Match this file's existing pattern for how the 3 current tests import/mock `useRouter` — if it's mocked inline per-file as shown above rather than via `vi.mocked`, adjust the second test's mock-override style to match; the important behaviour under test is unchanged: clicking calls `push` with the toy-transaction deep link.)

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/web && npx vitest run tests/unit/components/notifications-list.test.tsx`
Expected: FAIL — no toy copy exists, and no `push` call happens on click.

- [ ] **Step 3: Extend `COPY` and add `linkFor`**

In `packages/web/components/notifications-list.tsx`, find the `COPY` map (keyed by `NotificationType`) and add the 5 new entries, following its existing per-type message-template pattern (e.g. `(n) => \`${n.actor_name} approved...\``):

```typescript
  toy_request: (n) => `${n.actor_name} requested ${n.toy_name}`,
  toy_accepted: (n) => `${n.actor_name} accepted your request for ${n.toy_name}`,
  toy_rejected: (n) => `${n.actor_name} declined your request for ${n.toy_name}`,
  toy_withdrawn: (n) => `${n.actor_name} withdrew their request for ${n.toy_name}`,
  toy_message: (n) => `${n.actor_name} sent a message about ${n.toy_name}`,
```

Add a `linkFor` function near `COPY`:

```typescript
function linkFor(n: Notification): string {
  if (n.toy_transaction_id) return `/dashboard/exchanges/${n.toy_transaction_id}`
  if (n.tutorial_id) return `/tutorials/${n.tutorial_id}/edit`
  return '/notifications'
}
```

- [ ] **Step 4: Wire `router.push` into the click handler**

Find the existing `run()` busy-wrapper this component's list-item click already calls (the one that currently calls `onMarkRead`), and add a `router.push(linkFor(n))` call after the mark-read call succeeds, inside the same `run()` invocation for that notification.

- [ ] **Step 5: Run it to verify it passes**

Run: `cd packages/web && npx vitest run tests/unit/components/notifications-list.test.tsx`
Expected: PASS (all tests, including the 3 pre-existing ones now that `push` exists on the mock).

- [ ] **Step 6: Commit**

```bash
git add packages/web/components/notifications-list.tsx packages/web/tests/unit/components/notifications-list.test.tsx
git commit -m "feat(web): deep-link toy notifications to their exchange thread"
```

---

### Task 19: E2E — donation and exchange happy paths

**Files:**
- Modify: `packages/web/tests/e2e/helpers.ts`
- Create: `packages/web/tests/e2e/toy-exchange.spec.ts`

**Interfaces:**
- Consumes: `createContributor()`, `adminClient()`, `signIn()` from the existing helpers file.
- Produces: `createPublishedToy(ownerId: string, overrides?: Partial<{ name: string; offer_type: 'donation' | 'exchange' | 'both' }>): Promise<string>`.

- [ ] **Step 1: Add the helper**

In `packages/web/tests/e2e/helpers.ts`, following the same direct-DB-insert pattern already used by this file's other fixture helpers (via `adminClient()`), add:

```typescript
export async function createPublishedToy(
  ownerId: string,
  overrides: Partial<{ name: string; offer_type: 'donation' | 'exchange' | 'both' }> = {}
): Promise<string> {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('toys')
    .insert({
      owner_id: ownerId,
      name: overrides.name ?? 'Test toy',
      condition: 7,
      cover_photo_url: 'https://example.com/cover.jpg',
      status: 'published',
      offer_type: overrides.offer_type ?? 'donation',
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}
```

- [ ] **Step 2: Write the E2E spec**

```typescript
// packages/web/tests/e2e/toy-exchange.spec.ts
import { test, expect } from '@playwright/test'
import { createContributor, createPublishedToy, signIn } from './helpers'

test.describe('Toy donation and exchange', () => {
  test('a requester can complete a donation handoff end to end', async ({ browser }) => {
    const owner = await createContributor()
    const requester = await createContributor()
    const toyId = await createPublishedToy(owner.id, { name: 'Fire truck', offer_type: 'donation' })

    const ownerContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    await signIn(ownerPage, owner)

    const requesterContext = await browser.newContext()
    const requesterPage = await requesterContext.newPage()
    await signIn(requesterPage, requester)

    await requesterPage.goto(`/toy-library/${toyId}`)
    await requesterPage.getByRole('button', { name: /arrange pickup/i }).click()
    await expect(requesterPage).toHaveURL(/\/dashboard\/exchanges\//)

    const txUrl = requesterPage.url()
    await ownerPage.goto(txUrl);
    await ownerPage.getByRole('button', { name: /accept/i }).click()
    await expect(ownerPage.getByText(/your handoff code/i)).toBeVisible()
    const ownerCodeText = await ownerPage.getByText(/your handoff code/i).textContent()
    const ownerVisibleCode = ownerCodeText?.match(/\d{6}/)?.[0]

    await requesterPage.reload()
    await expect(requesterPage.getByText(/your handoff code/i)).toBeVisible()
    const requesterCodeText = await requesterPage.getByText(/your handoff code/i).textContent()
    const requesterVisibleCode = requesterCodeText?.match(/\d{6}/)?.[0]
    expect(requesterVisibleCode).toBeTruthy()

    await ownerPage.getByLabelText(/other party's code/i).fill(requesterVisibleCode!)
    await ownerPage.getByRole('button', { name: /confirm handoff/i }).click()
    await expect(ownerPage.getByText(/handoff complete/i)).toBeVisible()

    await ownerPage.goto('/dashboard/toys')
    await expect(ownerPage.getByText('Fire truck')).not.toBeVisible({ timeout: 1000 }).catch(() => {})
    await expect(ownerPage.getByRole('heading', { name: /archived/i })).toBeVisible()

    await ownerContext.close()
    await requesterContext.close()
    void ownerVisibleCode
  })

  test('the owner can reject a request, ending it with no handoff', async ({ page }) => {
    const owner = await createContributor()
    const requester = await createContributor()
    const toyId = await createPublishedToy(owner.id, { name: 'Robot', offer_type: 'donation' })

    await signIn(page, requester)
    await page.goto(`/toy-library/${toyId}`)
    await page.getByRole('button', { name: /arrange pickup/i }).click()
    const txUrl = page.url()

    await signIn(page, owner)
    await page.goto(txUrl)
    await page.getByRole('button', { name: /reject/i }).click()
    await expect(page.getByText(/declined/i)).toBeVisible()
  })

  test('a requester can withdraw an open request', async ({ page }) => {
    const owner = await createContributor()
    const requester = await createContributor()
    const toyId = await createPublishedToy(owner.id, { name: 'Kite', offer_type: 'donation' })

    await signIn(page, requester)
    await page.goto(`/toy-library/${toyId}`)
    await page.getByRole('button', { name: /arrange pickup/i }).click()

    await page.getByRole('button', { name: /withdraw/i }).click()
    await expect(page.getByText(/withdrawn/i)).toBeVisible()
  })
})
```

(Match `createContributor()`'s exact return shape and `signIn(page, user)`'s exact signature to this file's existing helpers — every other E2E spec already uses both, so mirror their call style precisely rather than the illustrative shape shown here.)

- [ ] **Step 3: Run the E2E suite**

Run: `cd packages/web && npx playwright test toy-exchange.spec.ts`
Expected: PASS (3 tests). Per `project_e2e_leaves_api_on_local_supabase` and `project_gotrue_port_exhaustion_fake_401` (memory), run with `--workers=2` if the suite shows flaky 401s, and confirm the E2E ports (3102–3105) are the ones in use, not the persistent dev server on 3100/3101.

- [ ] **Step 4: Commit**

```bash
git add packages/web/tests/e2e/helpers.ts packages/web/tests/e2e/toy-exchange.spec.ts
git commit -m "test(e2e): cover donation happy path, rejection, and withdrawal"
```

---

## Final verification

- [ ] Run the full monorepo check: `cd packages/types && npx tsc --noEmit && cd ../api && npx tsc --noEmit && npx vitest run && npx vitest run --config vitest.integration.config.ts && cd ../web && npx tsc --noEmit && npx vitest run`
- [ ] Run `cd packages/web && npx playwright test` for the full E2E suite, not just the new spec, to catch any regression in existing toy-library or notifications flows.
