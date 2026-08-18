# Organisation Toy Inventory

**Date:** 2026-08-18
**Status:** Approved, ready to implement
**Supersedes:** the appendix of `2026-08-17-toy-transfer-on-completion-design.md`,
which recorded these decisions provisionally and flagged two hazards. Both are
designed for here.

## Why

An organisation like Cerebral Palsy Alliance holds five identical sensory bears
and gives them away from a fixed address. Nothing on the platform can express
that. `toys.owner_id` references `profiles`, so only a person can own a toy; one
row means one object, so five bears means five near-identical library cards; and
the pickup address is typed in by an owner as they accept, so an org's fixed
location would be re-entered by hand every time.

Organisations themselves already exist (`007_organizations.sql`) with leaders,
an active/suspended status, and an `is_org_leader()` predicate. They just don't
reach the toy world.

## Scope

An organisation **gives**. It offers toys for donation and exchange, and
facilitates the handoff.

An organisation **never requests**. Nothing here lets an org ask a family for a
toy. That is not an oversight; it is the boundary of this spec.

## The model

| Concept | Answer |
|---------|--------|
| Who owns an org's toy | The org. `toys.owner_org_id`, with exactly one of `owner_id` / `owner_org_id` set |
| Five identical bears | One row, `quantity = 5` — not five rows |
| Who acts for an org | Any leader. One role, no staff/leader split |
| Concurrent handoffs | Up to `quantity`. An individual is the `quantity = 1` case, which reproduces today's behaviour exactly |
| Stock at zero | The row survives, out of stock, hidden from the library. Outstanding requests are declined |
| Pickup | Fixed on the org, copied by the server, not variable per handoff |
| Toy received in exchange | Becomes an org-owned draft, `quantity = 1`, listed at a leader's discretion |

### Why quantity rather than a row per unit

A row per unit would have been cheaper — every invariant in
`routes/toy-transactions.ts` assumes one row is one object, and stock dropping
5 → 4 would have needed no code at all. It was rejected on the public library:
five cards for one bear is what a browsing parent sees, and the library is the
surface this whole feature exists to serve.

The cost is paid in `confirm`, which stops being an ownership transfer. See
**Confirm** below.

## Schema

One migration, `033_org_toy_inventory.sql`. Additive; nothing backfills.

```sql
alter table public.toys
  alter column owner_id drop not null,
  add column owner_org_id uuid references public.organizations on delete cascade,
  add column quantity integer not null default 1 check (quantity >= 0),
  add constraint toys_one_owner check (num_nonnulls(owner_id, owner_org_id) = 1),
  add constraint toys_person_single_unit
    check (owner_org_id is not null or quantity = 1);

alter table public.organizations
  add column pickup_line1 text,
  add column pickup_suburb text,
  add column pickup_state text,
  add column pickup_postcode text,
  add column pickup_instructions text;

alter table public.toy_transactions
  alter column owner_id drop not null,
  add column owner_org_id uuid references public.organizations on delete cascade,
  add constraint toy_transactions_one_owner
    check (num_nonnulls(owner_id, owner_org_id) = 1);
```

`toys_person_single_unit` is what makes the branch in `confirm` total. A person's
toy is structurally incapable of holding `quantity = 2`, so "individual →
transfer the row, org → decrement and clone" can never meet a case it was not
written for. `quantity` also stays off the `EDITABLE` whitelist
(`routes/toys.ts:34`) for the individual path, making that two independent locks
rather than one.

Every existing row already satisfies both constraints: `owner_id` is set,
`owner_org_id` is null, `quantity` defaults to 1. There is no window in which the
constraints fail and no data migration step.

Cascade on org delete matches `org_leaders` and `tutorial_orgs` in `007`, and
`toy_transactions` already cascades on toy delete. In practice an admin suspends
rather than deletes; suspension removes nothing.

## Authority

Every place the database asks *"is this your toy?"* now asks *"is this your toy,
**or** do you lead the org that owns it?"* — reusing `is_org_leader()` from
`007:83` unchanged.

**`toys`** — all four policies in `021_toys.sql` gain
`or public.is_org_leader(owner_org_id)`.

**Storage** — `022_fix_toy_photos_rls.sql` resolves a photo path's toy id against
`toys.owner_id`. An org toy has no `owner_id`, so as written a leader cannot
upload a cover photo, and a toy cannot be published without one. The same
widening applies to the four storage policies. Easy to miss because it lives in
a different migration from the toy policies it mirrors.

**And in the upload route, not just the policies.** `checkToyOwner`
(`routes/upload.ts`) repeats the ownership test in application code as defence in
depth, and it too reads `owner_id = auth.uid()`. Widening only the storage
policies leaves the route refusing every upload before Postgres is consulted —
the same total failure, one layer earlier.

**`toy_transactions` and `toy_transaction_messages`** — the "parties" predicate
gains the org arm: requester, owner, or a leader of `owner_org_id`.

Because leadership is evaluated live on every request, an admin removing a leader
or suspending an org revokes access instantly. No cleanup job, no cached
capability — the same property `007` relies on for tutorial review.

A leader still cannot change their org's status, appoint leaders, or touch
another org's stock. That authority stays with the admin.

### One role, not two

Every leader of an org can do everything with that org's inventory: add, edit,
publish, delete, accept, reject, run a handoff, set the pickup address.

A staff role that can run handoffs but not manage stock is plausibly where this
ends up, and is deliberately not built. `org_leaders` would take it as one
nullable `role` column defaulting to `'leader'` plus a narrowing of the write
policies — nothing built here has to be unbuilt. Designing a permission matrix
before knowing which powers get abused is the more expensive order.

## The per-person assumptions

Three places decide who you are by comparing `owner_id` to the caller. Each is
correct today and silently wrong for an org handoff, where `owner_id` is null and
the answer is "no" for a leader who is very much the owner side. All three change
to an **owner-side** test.

| Location | Today | Failure if missed |
|----------|-------|-------------------|
| `sanitizeCodes` (`toy-transactions.ts:21`) | `row.owner_id === userId` | A leader is shown the *wrong* handoff code. Fails silently — the code is simply rejected in person |
| `accept` / `reject` / `withdraw` / `confirm` guards | `userId !== tx.owner_id` | A leader cannot act on their own org's handoff at all |
| `needsAction` (`types/src/index.ts:140`) | `tx.owner_id === viewerId` | The Exchanges badge undercounts; org requests waiting on a leader never surface |

`needsAction` is shared by the API and the web, so it takes the caller's led-org
ids as a third argument. Both callers already have that list —
`GET /api/organizations/mine` and `lib/capabilities.ts`'s `ledOrgs`.

The code one is the most dangerous of the three, because its failure mode is two
people standing in a room reciting a number that does not match, with nothing on
screen suggesting the platform is at fault. It gets its own test.

## Capacity

Three checks currently ask "does this toy have an accepted handoff?" and block if
so:

- request creation (`toy-transactions.ts:256`)
- the accept guard (`:409`)
- the `blocked_by_rival_accept` badge (`:50`)

All three become "are all the units spoken for?" — count accepted handoffs,
compare to `quantity`. For `quantity = 1` the answer is identical to today, so
the peer-to-peer flow does not shift.

**The public library needs the same fix, in a different file.**
`routes/public.ts:9-22` hides any toy with an accepted handoff. Untouched, one
family requesting a bear would make all five vanish from the browse page. It
hides a toy only when it is at capacity — which covers out-of-stock for free,
since `quantity = 0` is at capacity by definition.

### Overselling, and why accept needs SQL

The capacity check is read-then-write. Two leaders pressing Accept at the same
moment both read "4 of 5 taken", both pass, and the org commits six bears. This
could not happen before: a single owner cannot race themselves, and one accepted
handoff was the hard ceiling.

Accept therefore moves into a `security definer` Postgres function that takes the
unit atomically:

```
select quantity from public.toys where id = <toy> for update;
-- count accepted handoffs on this toy
-- if count >= quantity: return null (caller answers 409)
-- else: update the transaction to 'accepted' with the codes and the
--       pickup address, and return it
```

The codes are generated by the caller and passed in — `generateCode()`
(`toy-transactions.ts:14`) uses `node:crypto` and stays where it is. The pickup
address is passed in on the individual path and read from `organizations` inside
the function on the org path, so the "a leader cannot vary it" rule is enforced
at the same place that takes the unit.

The row lock is the whole point. It cannot be expressed through the query builder
because the Supabase JS client cannot span statements in a transaction, and it
cannot be expressed as a constraint because no index encodes "count of related
rows must not exceed a column".

The individual path goes through the same function. A `quantity = 1` toy is the
degenerate case, and having one accept path rather than two is worth more than
the lock it takes on a row nobody is contending.

## Pickup

The owner currently supplies an address in the accept body and the server stores
what arrives (`toy-transactions.ts:35-45`).

For an org handoff the server **ignores the body** and copies `pickup_*` and
`pickup_instructions` from the org. A leader cannot vary the location per family,
enforced server-side rather than merely hidden in the UI.

An org with no address set cannot accept. The failure is explicit — "your
organisation needs a pickup address before you can accept requests" — rather than
a constraint violation. This is why the org settings form is not optional.

The address stays hidden from the requester until acceptance, exactly as it works
today. Showing an org's suburb publicly would help someone judge whether they can
travel to it; that is a later, separable addition.

### Keeping it hidden costs more than storing it

`organizations` is world-readable by policy — `using (true)`, matching anon —
because an organisation is a public trust badge. RLS is row-level only, so the
moment `pickup_instructions` becomes a column on that table, "side gate, code
4417" is readable by anyone with a PostgREST client. This is precisely the hazard
`028` fixed for `profiles.pickup_*`, arriving a second time by the same route.

The fix is the same one, and it has the same consequence: revoke the table-level
SELECT and grant back the columns that are genuinely public, which makes
`select('*')` on the user client fail outright. Every user-client read of
`organizations` therefore names its columns via an exported `ORG_COLUMNS`
constant.

Leaders reach the pickup columns through `GET`/`PATCH
/api/organizations/:id/pickup`, which use the service-role client — bypassing
grants entirely — and check leadership in the handler. That is a departure from
this codebase's habit of letting RLS be the boundary, and the reason is worth
stating: the grant, not the policy, is what closed the door, so no policy could
reopen it.

A cheaper design was available and rejected: treat an org's address as public,
since an association's location is on its own website anyway. It fails on the
instructions field alone, which is the one place a door code plausibly lands.

## Confirm

Branches on `owner_org_id`.

**Individual owner** — unchanged. The row transfers, as
`2026-08-17-toy-transfer-on-completion-design.md` specified.

**Org owner** — the org's `quantity` decrements by one, and a **new toy row is
created for the requester**: name, description, condition, `switch_adapted`,
photo urls copied; `owner_id = requester`; `quantity = 1`; `status = 'draft'`;
`archived_at = null`. The requester lands in the existing "you received this,
want to list it?" sidebar prompt with no new mechanism.

Uniform decrement-for-everyone was rejected: it would leave individuals holding
ghost zero-quantity rows and undo transfer-on-completion, shipped in `abf8760`.

Ordering is unchanged and still load-bearing — stock and clone are written
**before** the status flips to `completed`, so a failed write leaves the
transaction retriable at `accepted` rather than stranded at `completed` with a
toy that never moved.

### Photos are shared, not copied

The cloned row points at the org toy's existing photo urls. It does not copy the
storage objects.

The bucket is public, so the images display. If the receiver wants a different
photo they upload one, and it lands under their own toy's folder, which
`022`'s policies already permit. What they cannot do is delete the org's
originals — correct, since those are still the org's.

This rests on one fact worth stating because it is invisible: **deleting a toy
does not delete its photos.** `routes/toys.ts:139` deletes the row only. If
storage cleanup is ever added, cloned toys break, and the fix is to copy the
objects at confirm time. A comment at the clone site records this.

### Rivals

Outstanding requests are declined when stock reaches **zero**, not on the first
completion (`toy-transactions.ts:650`). With five bears, four completions leave
four other families still legitimately in the running.

The decline copy says the stock ran out, not that the toy went to someone else.

## The exchange coming back in

When a family exchanges their toy for an org's, on confirm that toy becomes
`owner_org_id = <org>`, `quantity = 1`, `status = 'draft'` — sitting in the org's
inventory unlisted. A leader publishes it after inspection, or deletes it.

It gets its **own row** rather than folding into a matching batch. `condition` is
per-object: a used bear handed in is not interchangeable with five the org holds,
and merging them would quietly overstate what the next requester is promised.

## Screens

`lib/capabilities.ts` already exposes `ledOrgs`, and `/dashboard/organisation`
already merges a leader's work across every org they lead, badging each row with
which one. These follow that pattern.

**Org inventory** — a tab beside the existing organisation queue, shaped like
`/dashboard/toys`, listing stock across every org the leader runs, each row
badged with its org and its count.

**Add / edit a toy** — the existing toy editor with two extra fields: which org
it belongs to, and how many. That is the entirety of batch add: `quantity` on
create, and `quantity` on PATCH to top up when more arrive. No bulk-add endpoint,
no separate screen — the "add 5" and "we got 10 more" cases are the same write.

**Org settings** — a small form for the fixed address and pickup instructions.
Small, but blocking: without it the org cannot accept.

**Exchanges** — no work. `/dashboard/exchanges` renders what the database lets
the caller see, so org handoffs appear once the policies widen. The one addition
is a badge distinguishing "Cerebral Palsy Alliance is giving this away" from "I
am giving this away"; otherwise a leader's personal and org handoffs sit
indistinguishably in one list.

**Public library** — an org-owned card shows the org's name where it shows a
person's, and how many are available. `routes/public.ts` embeds `profiles(name)`
via `owner_id`, which is null for org toys, so it also embeds the org name and
falls back to it.

## Notifications

No schema change. A request to an org writes one `notifications` row per leader,
reusing the existing inbox whole.

Two consequences, stated rather than discovered:

- An org with four leaders gets four rows per event. Acceptable at this scale.
- When one leader accepts, the other three keep an unread "new request" and open
  it to find it handled. Mildly annoying, not broken. Fixing it properly means
  org-addressed notifications with per-leader read state — real work for a small
  irritation, deferred deliberately.

## Consequences

- **A user may hold concurrent requests across an org's catalogue.** Requesting
  Toy A, Toy B and Toy C from one org is three transactions today already — the
  dedupe guard (`toy-transactions.ts:297`) is scoped per toy, not per owner. So
  it works with no change, and it means three threads, three code pairs, three
  confirms for one visit to one building. Known and accepted; a combined-pickup
  concept is not being invented for it.
- **An org's stock is invisible in My Toys**, by design. `routes/toys.ts:62`
  filters `owner_id = userId` and returns nothing for orgs. Org stock belongs on
  the inventory screen, not mixed into a leader's personal list.
- **No backfill anywhere.** Existing toys, transactions and completed handoffs
  are untouched.

## Testing

**Integration** (`tests/integration/toys/` and `tests/integration/toy-transactions/`):

- Five units, six requests: the sixth is refused; the first five may be accepted.
- **Two concurrent accepts on a one-unit toy: exactly one succeeds.** The
  overselling test, and the reason accept is a Postgres function.
- Accept copies the org's pickup address and **ignores** an address in the body.
- Accept fails cleanly when the org has no address set.
- Confirm decrements the org's quantity and creates a requester-owned draft with
  `quantity = 1`.
- Outstanding requests survive until stock reaches zero, then are declined.
- An exchanged-in toy lands as an org-owned draft.
- A leader receives the **owner-side** handoff code.
- A leader removed from an org loses access to its stock; a leader of one org
  cannot touch another's.
- A leader can upload a photo to an org toy (the `022` widening).

**Unit** (`packages/types`): `needsAction` counts an org handoff for a leader of
that org and for nobody else.

**E2E**: a family requests a bear from an org with stock 5, the leader accepts,
both confirm, stock reads 4 and the family holds a draft.
