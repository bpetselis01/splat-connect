# Toy Transfer on Completion

**Date:** 2026-08-17
**Status:** Approved, ready to implement
**Scope:** Person-to-person only. Organisation inventory is a later spec; see the appendix.

## Why

A completed handoff currently archives **both** toys and gives the toy to nobody.
`routes/toy-transactions.ts` sets `archived_at` on `tx.toy_id` and, for an
exchange, on `tx.offered_toy_id` as well. Two people meet, swap toys, and the
platform's record of both objects goes dark.

No toy has ever changed owner on this platform. That reads less like a decision
than an unfinished edge: the physical toy has a new holder, and the row that
represents it should say so.

## What changes

Archive-on-completion is **replaced by** transfer-on-completion.

| Type | Moves | To |
|------|-------|-----|
| Donation | `tx.toy_id` | the requester |
| Exchange | `tx.toy_id` | the requester |
| Exchange | `tx.offered_toy_id` | the owner |

A transferred toy lands as `owner_id = <receiver>`, `archived_at = null`,
`status = 'draft'`.

Nothing is archived at completion any more. The giver's list clears itself
because My Toys filters on `owner_id` (`app/dashboard/toys/page.tsx:19`), and
`archived_at` keeps its existing meaning for every other path that sets it.

`published -> draft` is the load-bearing half. It pulls the toy from the public
library the moment it changes hands, because the new owner has not agreed to
list it. Leaving it published would re-offer a toy its new owner just took home.

## Listing is opt-in

The receiver is asked whether they want to list it. They are not opted in.

The reasoning is about people rather than data: someone who has just acquired a
toy overwhelmingly wants their child to play with it, not to put it straight back
into circulation. A default of "published" would be wrong nearly every time, and
wrong in the direction that costs a family the toy they just collected.

### Where the prompt lives

**Not** in the thread's system message. Both parties read that thread, and on a
donation only one of them received anything — a message asking "do you want to
list this?" would be read by the person it does not apply to. The completion
message therefore stays neutral and factual.

The prompt goes in the **sidebar** of the completed thread, which is already
viewer-specific and already switches on `status === 'completed'` to render
"Handoff complete." That card gains the offer, shown only to a receiver whose
received toy is still an unlisted draft.

The button leads to the toy's existing edit screen (`/dashboard/toys/[id]`)
rather than publishing in one click, because publishing requires an `offer_type`
(donation / exchange / both). A yes/no control cannot answer that question, and
choosing a default would re-list someone's new toy on terms they did not pick.

Declining is not clicking. The toy stays a draft they own, listable at any time
from My Toys. There is no state to record and no reminder to dismiss.

## Schema

**No migration.** `owner_id`, `status` and `archived_at` all exist and all keep
their current meanings.

Storage needs no work either, and this is worth stating because it is not
obvious: `022_fix_toy_photos_rls.sql` scopes the toy-photo policies through the
**path's toy id** resolved against `toys.owner_id`, not against the uploader. On
transfer the new owner gains upload, update and delete on that toy's photos and
the previous owner loses them, with no re-upload and no policy change.

## API

The confirm handler's archive block becomes a transfer block **in the same
position** — after both parties have confirmed, before the status flips to
`completed`. That ordering is already deliberate and the reason is unchanged: a
failed write leaves the transaction retriable at `accepted` rather than stranded
at `completed` with a toy that never moved.

`ToyTransactionDetail` gains the current status of the toy the viewer received,
so the sidebar can distinguish "still a draft, offer the prompt" from "already
listed, say nothing."

## Consequences

- **An existing E2E assertion breaks, and should.** `toy-exchange.spec.ts` signs
  in as the donor after the handoff and asserts the toy appears under
  **Archived** in their My Toys. The donor no longer owns it at all. The
  assertion moves: absent from the donor's list, present as a draft in the
  requester's.
- **No backfill.** Transactions already completed keep their archived toys.
  Behaviour changes going forward only. Rewriting history here would resurrect
  toys into libraries their owners have not looked at in weeks.
- **Unchanged by design:** the "you cannot request your own toy" guard and the
  rival auto-decline sweep both key on the *current* owner, so both stay correct
  with no edit.

## Testing

- **Integration** (`tests/integration/toy-transactions/confirm.test.ts`): a
  donation transfers to the requester; an exchange transfers both ways; each
  transferred toy is `draft` and unarchived; the giver no longer owns it.
- **Unit** (web): the sidebar prompt appears for a receiver holding an unlisted
  draft, and for nobody else — not the giver, not once the toy is published.
- **E2E**: the existing donation spec continues past the handoff into the
  requester's My Toys.

## Appendix: decisions taken for later phases

Settled during this design session, recorded so they are not re-litigated. **None
of it is in scope here.**

| Decision | Choice |
|----------|--------|
| Org toy ownership | `owner_org_id` on `toys`, nullable, exactly one of `owner_id` / `owner_org_id` set |
| Multiple of one toy | A `quantity` column, not one row per unit — chosen to keep the public library from filling with duplicates |
| Concurrent handoffs | Up to `available = quantity - open accepted handoffs`. An individual is the `quantity = 1` case, which reproduces today's behaviour exactly |
| Stock reaching zero | Auto-decline outstanding requests, for organisations and individuals alike, with copy that says the stock ran out |
| Org pickup | Fixed `pickup_*` plus instructions on `organizations`; the accept flow skips the address dialog and copies them |

Two hazards the organisation phases inherit and must design for explicitly:

1. **Overselling.** Two leaders accepting simultaneously can commit the same
   unit. Needs an atomic reservation — a conditional update guarded on the stock
   count, which either affects a row or does not — and a test that runs two
   accepts concurrently.
2. **Per-person assumptions.** The handoff code, the pickup address and the
   "waiting on you" count are all per-person today. Every one of them needs an
   answer for "which leader" before organisations can transact.
