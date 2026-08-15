# Toy exchange & donation (part 3 of the toy-exchange feature)

## Scope

Part 3 of the feature `2026-08-11-my-toys-design.md` deferred, building on
the public browse page from `2026-08-14-toy-library-design.md`: letting one
account request a **donation** or **exchange** of a toy another account has
published, and carrying that request through negotiation, handoff, and
completion. Out of scope: the org `/dashboard/organisation/toys` inventory —
still a later part of the same feature.

## Decisions carried in from brainstorming

- **Pickup location is structured data**, not free text: line1, suburb,
  state, postcode fields on the profile, snapshotted onto the transaction at
  accept time. A future pass wires a Google Maps/Places API to autocomplete
  and geocode these fields — out of scope here, but the structured shape is
  chosen so that hook has something to attach to later.
- **Either party can withdraw** a transaction at any point before it
  completes. Withdrawal is not blame-assigning — both toys stay exactly as
  they were, still published and offered.
- **Handoff is confirmed by code, not by clicking "done"** — a party proves
  they were physically present at the handoff by being told the other
  party's code, and the other party proves the same by entering it. Donation
  is one-way (only the owner confirms, since only one toy moves); exchange
  is two-way (both confirm, independently, since two toys move).
- **A completed toy soft-removes**, not deletes: it disappears from My Toys'
  active list and from the public Toy Library, and reappears in a new
  Archive section — a record, not editable, not re-offerable.
- **The exchange/donation thread carries the structured address**, not a
  freeform "where do we meet" negotiation — free text stays available for
  everything else in the thread.
- **Notifications gain deep-linking.** Today `NotificationsList` only marks
  a notification read on click (`components/notifications-list.tsx:58-64`);
  neither tutorial nor (new) transaction notifications navigate anywhere.
  This spec adds a link for both families in the same pass, since the new
  transaction notifications would be useless without it and doing tutorials
  at the same time is one map, not two.

## Data model

### `toys` — offer type

```sql
alter table public.toys add column offer_type text
  check (offer_type in ('donation', 'exchange', 'both'));
alter table public.toys add constraint toys_offer_type_when_published
  check (status = 'draft' or offer_type is not null);
alter table public.toys add column archived_at timestamptz;
```

`offer_type` is set alongside publishing, in the same review step
`ToyReviewPanel` already renders — a 3-way pill group (Donation / Exchange /
Both) next to the existing Publish button. `archived_at` is set once a
transaction involving this toy completes (see below); non-null means "not
mine to act on any more."

`GET /api/toys` (My Toys) and `GET /api/public/toys` (Toy Library) both
add `.is('archived_at', null)`. The public route additionally excludes any
toy with an `accepted` transaction against it (see below) — mid-handoff
items shouldn't be requestable by a third party.

### `profiles` — default pickup address

```sql
alter table public.profiles add column pickup_line1 text;
alter table public.profiles add column pickup_suburb text;
alter table public.profiles add column pickup_state text;
alter table public.profiles add column pickup_postcode text;
```

Four flat nullable columns, not jsonb — every other structured field in
this schema (e.g. `toys.condition`) is a plain typed column, and there's no
need for jsonb's schemaless flexibility here. All four are optional; a
transaction whose owner hasn't set one still proceeds, just without an
auto-shared address (the thread says so; the parties coordinate via a free
text message instead).

Editable from the existing `dashboard/profile` tab, in `ProfileForm`
(`components/profile-form.tsx`), via the existing
`PATCH /api/contributors/me` route — same pattern as the display-name field
already there, just three more inputs.

### `toy_transactions` — new table

```sql
create table public.toy_transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('donation', 'exchange')),
  toy_id uuid not null references public.toys(id),
  offered_toy_id uuid references public.toys(id),
  owner_id uuid not null references public.profiles(id),
  requester_id uuid not null references public.profiles(id),
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'rejected', 'withdrawn', 'completed')),
  pickup_line1 text,
  pickup_suburb text,
  pickup_state text,
  pickup_postcode text,
  owner_code text,
  requester_code text,
  owner_confirmed_at timestamptz,
  requester_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint offered_toy_only_for_exchange
    check (type = 'exchange' or offered_toy_id is null)
);
```

`owner_id` and `requester_id` are denormalized from `toys.owner_id` and the
requesting caller at insert time — every RLS policy on this table and its
messages filters on these two columns directly, rather than joining through
`toys` twice per row.

`owner_code` / `requester_code` are generated (6-char base32, matching the
existing collaborator-invite token style) when a request moves to
`accepted`. For a donation, only `requester_code` is ever set — the
requester's code is what the owner asks for at handoff. For an exchange,
both are set — the requester's code is what the owner asks for, and vice
versa.

RLS: select/update restricted to `owner_id = auth.uid() or requester_id =
auth.uid()`. No direct insert policy — created via the admin client in the
route handler, same reasoning `notifications` already documents (a party
shouldn't be able to forge the other side's ID into these columns).

### `toy_transaction_messages` — the thread

```sql
create table public.toy_transaction_messages (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.toy_transactions(id) on delete cascade,
  sender_id uuid references public.profiles(id),
  kind text not null check (kind in ('system', 'user')),
  body text not null,
  created_at timestamptz not null default now()
);
```

`sender_id` is null for `system` rows (request created, address shared,
accepted, rejected, withdrawn, code confirmed, completed — all templated
server-side, same `COPY`-map pattern `notifications-list.tsx` already
uses). `user` rows are free text either party posts while status is
`requested` or `accepted`; posting is rejected once the transaction reaches
a terminal status.

### `notifications` — extended, not duplicated

```sql
alter table public.notifications alter column tutorial_id drop not null;
alter table public.notifications add column toy_transaction_id
  uuid references public.toy_transactions(id) on delete cascade;
alter table public.notifications add column toy_name text not null default '';
alter table public.notifications add constraint notifications_one_subject check (
  (tutorial_id is not null and toy_transaction_id is null) or
  (tutorial_id is null and toy_transaction_id is not null)
);
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
  'collaborator_removed', 'collaborator_left',
  'tutorial_approved', 'tutorial_rejected',
  'toy_requested', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_completed'
));
```

Reusing this table (rather than a parallel one) is what makes deep-linking
one piece of work instead of two: one list component, one read/unread
model, one place to compute a link.

## Backend

### `packages/api/src/routes/toy-transactions.ts` (new), mounted at `/api/toy-transactions`, behind `authMiddleware` like every other dashboard route

- `POST /` — body `{ toyId, type, offeredToyId? }`. Loads the target toy,
  404s if archived or not published. For `exchange`, `offeredToyId` is
  required and must be one of the caller's own toys (any status — an
  unpublished toy can still be offered) — otherwise 400 with a message the
  frontend surfaces as "add a toy first." Inserts the transaction as
  `requested`, inserts a system message, inserts a `toy_requested`
  notification for the owner.
- `GET /` — the caller's transactions, `owner_id = me or requester_id = me`,
  newest first. Backs a new "Exchanges" list (see Frontend).
- `GET /:id` — transaction + its messages, RLS-scoped to the two parties.
- `POST /:id/messages` — body `{ body }`. Owner or requester only, only
  while `status in ('requested', 'accepted')`.
- `POST /:id/accept` — owner only, only from `requested`. Generates the
  code(s) per type, snapshots the owner's `pickup_*` profile columns onto
  the transaction, sets `status = 'accepted'`, inserts a system message
  (including the address, or a note that none is set), notifies the
  requester (`toy_accepted`). Every other `requested` transaction still open
  against the same `toy_id` flips to `rejected` with its own system message
  ("this toy is no longer available") and a `toy_rejected` notification —
  the toy can only honor one acceptance.
- `POST /:id/reject` — owner only, only from `requested`. → `rejected`,
  notifies requester.
- `POST /:id/withdraw` — owner or requester, from `requested` or
  `accepted`. → `withdrawn`, notifies the other party (`toy_withdrawn`).
- `POST /:id/confirm` — owner or requester, body `{ code }`, only from
  `accepted`. The owner submits the requester's code (checked against
  `requester_code`) and vice versa; a mismatch is a 400, not a silent
  no-op. On match, stamps that side's `*_confirmed_at` and archives the
  toy that just changed hands: the owner confirming archives `toy_id`
  (donation and exchange both — this is "the requester now has the
  owner's toy"), the requester confirming archives `offered_toy_id`
  (exchange only). Once every required confirmation for the type is in —
  one for donation, both for exchange — `status = 'completed'`,
  `completed_at = now()`, and both parties get a `toy_completed`
  notification.

### `notifications.ts` — extend, don't fork

The existing route already builds `Notification` rows; extend its insert
helper to accept either a tutorial or a transaction subject, and its list
query to embed `toy_transactions(toy_id)` alongside the existing
`tutorials(title)` embed so the frontend has what it needs to link.

### `packages/types`

`Toy.offer_type` and `Toy.archived_at` added to the existing interface.
New `ToyTransaction`, `ToyTransactionStatus`, `ToyTransactionType`,
`ToyTransactionMessage` interfaces. `NotificationType` extended with the
five new values; `Notification` gets `toy_transaction_id: string | null`
and `toy_name: string`.

## Frontend

### Requesting, from the Toy Library detail page

`app/toy-library/[id]/page.tsx` is currently unauthenticated-friendly and
owner-blind. It gains, only when the viewer is signed in and isn't the
owner:

- `offer_type` includes `donation` → an "Arrange pickup" button that
  `POST`s `{ toyId, type: 'donation' }` and routes to the new transaction
  page.
- `offer_type` includes `exchange` → an "Arrange exchange" button. If the
  viewer's own My Toys list is empty, this opens a small notice ("add a toy
  to exchange") instead of proceeding — checked client-side against
  `GET /api/toys`, mirroring the guard `toy-editor.tsx`'s publish button
  already uses for missing fields. Otherwise it opens a picker (reusing the
  card-grid pattern from `app/dashboard/toys/page.tsx`) to choose which of
  the viewer's own toys to offer, then `POST`s `{ toyId, type: 'exchange',
  offeredToyId }`.

### The transaction thread

New `app/dashboard/exchanges/[id]/page.tsx`: both toys (via `ToySummary`,
already extracted for the public detail page — reused here for exactly the
"show a toy's photo/condition/description" job it already does), status,
the shared address once present, the message thread, and the actions valid
for the caller's role and the current status (accept/reject while
`requested` and owner; withdraw while `requested`/`accepted`; a code-entry
form while `accepted` and the caller still has a confirmation pending).

### Listing transactions

New `app/dashboard/exchanges/page.tsx`, backed by `GET /api/toy-transactions`
— same card-list pattern as My Toys, split into "Active" (requested/
accepted) and "Past" (completed/rejected/withdrawn) instead of tabs, since
the list is expected to stay short.

### Archive

My Toys (`app/dashboard/toys/page.tsx`) adds an "Archived" section below the
active grid — read-only cards (no link to the editor) for toys with
`archived_at` set, using the existing `GET /api/toys` response (now
including archived rows; the client splits by `archived_at` rather than the
route filtering them out for their own owner).

### Notification deep-linking

`NotificationsList`'s `onClick` changes from mark-read-only to mark-read
**and** `router.push(link)`. `link` is computed from a small per-type map
next to the existing `COPY` map: tutorial types → `/dashboard/tutorials/
${tutorial_id}`, toy types → `/dashboard/exchanges/${toy_transaction_id}`.

## Testing

- `packages/api`: route tests for every `toy-transactions` endpoint,
  covering the ownership/RLS boundary (a third party can't see or act on
  someone else's transaction), the auto-reject-other-requests behavior on
  accept, the code-mismatch 400, and the one-vs-two confirmation
  archive/complete difference between donation and exchange. Extended
  `notifications.ts` tests for the new subject type and the nullable-
  `tutorial_id` constraint.
- `packages/web`: unit tests for the request/accept/withdraw/confirm
  button visibility per role and status, the exchange no-toys guard, the
  archived-section split in My Toys, and `NotificationsList`'s new
  navigation behavior.
- E2E: one donation happy path and one exchange happy path (request →
  accept → confirm → both toys reflect their new state), plus a withdrawal
  path — matching the existing `upload-flow`/`org-backing` spec's depth
  rather than exhaustively covering every branch.
