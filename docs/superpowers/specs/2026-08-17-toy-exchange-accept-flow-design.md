# Toy exchange: pickup-address prompt and deferred rival rejection

Follow-up to `2026-08-14-toy-exchange-design.md`. That spec deliberately
snapshotted the owner's profile address at accept time with no prompt, and
rejected every rival request the moment one was accepted. Both decisions are
reversed here based on real usage feedback.

## Goals

1. When an owner accepts a request, they choose the pickup address in the
   moment — their saved default, or a fresh one — rather than having it
   silently copied from their profile.
2. When a toy has multiple open requests and the owner accepts one, the
   other requesters are not rejected until the accepted handoff actually
   completes. While one is in flight, the owner cannot accept a second.

## Non-goals

- No changes to the confirm/handoff-code flow itself.
- No changes to how a toy is hidden from new requests while mid-handoff
  (`POST /` already 404s on toys with an `accepted` transaction — unchanged).
- No new database columns. `pickup_*` already exists on `toy_transactions`;
  the rival-lock state is computed at read time, not stored.

## Item 3: pickup-address prompt on accept

### API — `POST /api/toy-transactions/:id/accept`

Requires a JSON body:

```json
{
  "pickup_line1": "string",
  "pickup_suburb": "string",
  "pickup_state": "string",
  "pickup_postcode": "string"
}
```

All four fields must be non-blank strings, or the request fails with `400`
("Pickup address is required to accept"). The handler no longer reads the
owner's `profiles` row for address data — it writes the body's values
directly onto the `accepted` transaction. Everything else about the handler
(code generation, system message, notification) is unchanged here; the
rival-rejection block moves to item 4 below.

### Web — `app/dashboard/exchanges/[id]/page.tsx`

Already calls `getCapabilities()`, which returns the viewer's own `Profile`
including `pickup_*`. This is passed to `ToyTransactionThread` as:

```ts
viewerDefaultAddress: PickupAddress | null // null if any of the 4 fields is unset
```

The `accept` server action changes from `accept()` to `accept(address:
PickupAddress)`, forwarding `address` as the POST body instead of `{}`.

### Web — `ToyTransactionThread`

Clicking Accept opens a native `<dialog>` modal (the same pattern
`DeleteEntityButton` already uses for its confirm dialog):

- **Has a default address**: radio choice between "Use my saved address"
  (read-only preview of the four fields) and "Enter a different address"
  (reveals the four text inputs, empty).
- **No default address**: the four text inputs show directly, no radio.
- Submit is disabled until the resolved address (default or manual) has all
  four fields non-empty. Cancel closes the dialog with no action taken.
- On submit, calls `onAccept(address)` through the component's existing
  `run()` busy/error wrapper.

`onAccept`'s type changes from `() => Promise<void>` to `(address:
PickupAddress) => Promise<void>`.

## Item 4: deferred rival rejection + accept-locking

### API — `POST /api/toy-transactions/:id/accept`

Two changes:

1. New guard, right after the existing `status !== 'requested'` check: if a
   sibling `toy_transactions` row with `toy_id = tx.toy_id AND status =
   'accepted'` exists, return `409` — "Another request for this toy is
   already accepted. Complete or withdraw from it first."
2. The rival-auto-reject loop (query `requested` siblings, flip each to
   `rejected`, message + notify) is deleted from this handler. Rivals stay
   `requested`.

### API — `POST /api/toy-transactions/:id/confirm`

Once the transaction reaches the existing `completedTx` branch (both
required confirmations are in and the toy(s) are archived), run the
rejection loop there instead — same system message ("This toy was accepted
by another request, so this one was automatically declined.") and
`toy_rejected` notification as before, just fired at completion instead of
at accept.

If the transaction is withdrawn, or only one side of an exchange has
confirmed, nothing happens to rivals: they were never touched, so they're
simply unblocked again once no `accepted` row exists for the toy.

### API — `GET /api/toy-transactions` and `GET /api/toy-transactions/:id`

Add a computed `blocked_by_rival_accept: boolean` to every returned row:
`true` when `status === 'requested'` and a sibling `accepted` transaction
exists for the same `toy_id`.

- List route: one extra query for all `toy_id`s currently `status =
  'accepted'`, built into a `Set`, then mapped over the rows. Same shape as
  the existing `midHandoffToyIds()` helper in `public.ts`, but not shared
  with it — different route, different scope, not worth the cross-file
  coupling for a five-line query.
- Detail route: same check scoped to the single row's `toy_id`.

### Types (`packages/types/src/index.ts`)

Add `blocked_by_rival_accept: boolean` to `ToyTransactionSummary` and
`ToyTransactionDetail`.

### Web — `ToyTransactionThread`

Accept button: `disabled={busy || tx.blocked_by_rival_accept}`, plus
`title="You need to either complete the current transaction or withdraw
from it."` when blocked. Reject stays enabled regardless — declining an
unwanted rival is harmless even mid-handoff on another request.

### Web — `app/dashboard/exchanges/page.tsx`

Cards where `status === 'requested' && blocked_by_rival_accept` get a small
"Locked — another request accepted" badge next to the existing status text.

## Testing

- **API unit**: `accept()` 409s when a sibling `accepted` row exists;
  `accept()` no longer touches rival `requested` rows; `accept()` 400s when
  any address field is missing; `confirm()` rejects `requested` siblings
  only on the `completedTx` branch, not on partial confirm or withdraw.
- **API integration**: two requesters on one toy — owner accepts the first,
  the second stays `requested` with `blocked_by_rival_accept: true`, a
  second accept attempt 409s, confirming the first flips the second to
  `rejected` with a notification.
- **Web unit**: `ToyTransactionThread` modal's three paths (default chosen,
  new address entered, no default forces manual entry); disabled+`title`
  Accept button when blocked; Reject remaining clickable; exchanges list
  page renders the locked badge.
