# Database queue

**Nothing is deleted from this file.** Items move from `Pending` to `Applied`
with the migration filename and the date it was applied.

Anything that adds a column, table, enum member, index, policy, view, or changes
a constraint belongs here before any code is written against it. The brief's §3
list of the ones that are easy to miss is worth rereading each round: a stepper
needing a stage vocabulary the database does not store, per-row identity on a
detail route, cost breakdown line items, handover codes and who may read them,
org role gating, and badge counts that must be accurate.

## Pending

### [F5] A build request cannot be posted to nobody

**Why:** the artboard's "makers wanted" board lists open build requests that any
maker within range can claim. 057 makes a build an ordinary toy transaction, and
`toy_transactions_one_owner` (033) insists exactly one of `owner_id` and
`owner_org_id` is set — so a request with no maker on it is a row the table will
not accept. A family therefore asks a named maker: an organisation, or a person
whose profile is public.

**Blocks:** the open board and its claim button. Nothing else — the thread, the
stages, the costs and the handover all work on a named ask, which is what
shipped.

**Proposed migration:** not written. Two shapes: relax the owner XOR to "at most
one" and let `status = 'requested'` with no owner mean open, which touches a
constraint every exchange depends on; or a small `build_claims` table where
makers register interest and accepting one stamps the owner. The second leaves
033 alone and gives the board a natural read, and is the better answer unless
print jobs (F6/F7) want the same open-pool shape, in which case it is worth
designing once.

**RLS impact:** an open request is readable by makers who are not yet parties to
it, which `is_toy_transaction_party()` does not cover. That is the substantive
piece of work, not the column.

**Workaround in place:** none that fakes data. `/get-involved/requests` says what
it does — ask a named maker — and does not draw a board that is not there.

### [F8] An organisation-held exchange cannot carry a cost line

**Why:** `exchange_costs` names a `payer_id` and a `payee_id`, both profiles,
and 055's trigger insists both are parties to the transaction. Since 033 an
organisation-held exchange has `owner_id` null and `owner_org_id` set, so there
is no profile to put on the giving side of a line. The cost panel's edit mode is
therefore withheld on those exchanges rather than offered and refused.

**Blocks:** recording costs on an org handover (F8 edit mode, F10's print
orders when they land). Reading costs is unaffected —
`is_toy_transaction_party()` already counts the owning organisation's leaders,
so a leader can see and settle a line somebody else entered.

**Proposed migration:** not written; the shape is a real choice. Either the
columns become nullable in pairs with an `payer_org_id`/`payee_org_id` beside
them and the trigger widened, or the leader who acts is stamped as the person
— which is honest about who agreed it but wrong about who owes it. Worth
deciding once, alongside whether a print job's costs hang off the same table.

**RLS impact:** none beyond the existing `is_toy_transaction_party()` gate.

**Workaround in place:** none that fakes data. `canEditCosts` on the exchange
detail page is false when `owner_id` is null, and the panel renders read-only.

### [F3/F4] An exchange does not record where it stopped

**Why:** the stage rail must show a record that ended early stopping at the step
it died at. `toy_transactions.status` is overwritten on withdrawal, so
"requested then withdrawn" and "accepted then withdrawn" are the same row, and
the rail cannot tell them apart.

`rejected` is exact — it can only happen at the one step where somebody answers.
`withdrawn` is not. A handover confirmation (`owner_confirmed_at` /
`requester_confirmed_at`) proves it got that far, which narrows it; between
Requested and Accepted the row genuinely cannot say, and
`packages/web/lib/exchange-stages.ts` places the stop at Accepted and documents
the limit.

**Blocks:** nothing. The rail is honest about what is stored and the list ships.

**Proposed migration:** not written. Two shapes are plausible — a
`stopped_at_stage text` column, or a `toy_transaction_events` table recording
every transition, which would also give the thread a history. The second is the
better answer if F5's build stages need a vocabulary of their own, so this is
worth deciding once rather than twice.

**RLS impact:** an events table would need the same `is_toy_transaction_party()`
gate as the messages and costs on the same exchange.

**Workaround in place:** none that fakes data. The rail shows what the row
supports.

_(F5, F6, F7, F10 and F12 build routes that do not exist and are likely to add
further entries here.)_

## Applied

### [F6/F7] `058_printers_and_print_jobs.sql` — applied 2026-09-17

Two halves, and only one of them new.

**`printers` is new.** Bed size, materials loaded, an availability toggle and a
capacity, owned by a person or an organisation on 033's XOR. Reads are public —
somebody has to find a machine to send a job to it — and the columns that are
NOT public are the pickup ones, which is why they are not on this table at all:
the address lives on the owner's profile or the org's record and is copied onto
a job at accept, exactly as 028 does for a toy handover.

**The job is not new.** A print job is a requester, a giving side, a status
machine, a pickup, two handover codes, a thread and a cost panel — that is
`toy_transactions`, as a build was in 057. The subject becomes a printer plus
the files wanted.

As in 057 the extra steps are timestamps, not status members: `printing` and
`ready` as statuses would mean every `status = 'accepted'` predicate in the API
stops matching a job that is on the bed.

Three things the schema insists on rather than the UI:

- **Ready needs a photo.** `ready_at is null or ready_photo_url is not null`.
  Ready without one is the state that lets somebody drive across town for
  nothing.
- **Ready cannot precede printing.** Without it a job jumps the middle of its
  own rail and the stepper has to guess what happened.
- **The files are rows.** `print_job_files`, not a JSON blob of filenames: a set
  that is a blob cannot be joined to the files it names, and a renamed or
  deleted STL would leave the job pointing at a string nobody can resolve.

The decline reason is stored. The artboard requires one, and a reason that
exists only as a chat message cannot be rendered on the list row that needs it.

Storage: `print-shots`, private, with the same four party-gated policies as
056's receipts and 057's working shots.

Verified past the ledger on the remote by `check-schema-guards.sh`, which gained
four assertions: the private bucket, its four policies, RLS plus the org-leader
arm of the printers write policy, and RLS on `print_job_files`. The printers one
matters because that table's SELECT is `using (true)` on purpose — an owner
check that went missing would let anybody close somebody else's machine.

### [F5] `057_build_requests.sql` — applied 2026-09-17

A build is a toy transaction with a guide for a subject rather than a toy. The
alternative — a `build_requests` table with its own messages, codes, costs, RLS
and notification plumbing — would have forked every one of those to gain a
different subject line.

Three things it had to change underneath, each of which was a real break rather
than a tidy-up:

- **`accept_toy_transaction` (033) locked the toy row and counted it against
  quantity.** With no toy the lookup found nothing and the whole accept returned
  `missing`, so a maker taking one on would have been told the request does not
  exist. The stock check is now skipped where there is no stock, and the lock is
  otherwise untouched.
- **`confirm` transfers a toy, decrements org stock and sweeps rival requests.**
  A build hands over an object that exists nowhere in `toys`, so all of it is
  skipped and the record simply closes.
- **Five notification sites did `.eq('id', tx.toy_id).single()`.** One helper
  now answers "what is this record about", and it reads the guide on a build.

The extra stage is two timestamps, not two status members. `built` and
`approved` as statuses would mean every `status = 'accepted'` predicate in the
API silently stops matching a live build.

Storage: `build-shots`, private, with 056's four policies gated on
`is_toy_transaction_party()` of the path's first folder segment. A working shot
is a photograph taken inside somebody's home often enough that the public photo
buckets are the wrong precedent.

Verified past the ledger on local: both constraints, the type check, the index,
the private bucket, its four policies, and the two new notification types.

### [F2/F8] `055_exchange_costs.sql` — applied 2026-09-16

Applied to the hosted `development` project (which is the live one — there is no
separate prod). Verified beyond the ledger, because a ledger row is written
whether or not the SQL ran: the table exists, RLS is on, all four policies are
present, the party trigger is there and both indexes were created.

`scripts/check-schema-guards.sh` gained three assertions for it, per that file's
own rule about guards whose absence is a vulnerability rather than a bug. RLS off
on this table would not break a feature — it would publish every family's private
financial arrangements to every signed-in account.

The original entry, with the reasoning and the design decisions, follows.

### [F2/F8] Agreed costs on an exchange have nowhere to live

**Why:** the Soft Pop dashboard draws a "Money you have agreed to" panel — a
total, the number of exchanges it spans, and a line per cost with a description,
a counterparty, an amount and a settled flag. Feature 8, the cost panel, is the
same data at full size.

Nothing backs any of it. Every column in all 23 public tables was searched for
`cost|price|amount|money|settle|paid|reimburs` and there are none. This is the
case the brief's own list of easy-to-miss schema changes names: "cost breakdown
lines, receipts, settled flags — line items are rows, not JSON blobs, unless the
existing schema already says otherwise". It does not say otherwise.

**Blocks:** the money summary on `/dashboard` (F2), the cost panel (F8), and the
cost rows on every exchange and build detail screen (F4, F5).

**Proposed migration:** `supabase/migrations/055_exchange_costs.sql` — written,
not applied to the remote. Validated against the local database, including the
three guards: a valid line is accepted, a payer who is not a party to the
exchange is rejected by the trigger, and a `settled_at` with no `settled_by` is
rejected by the check constraint.

**Types to regenerate:** `packages/types/src/index.ts` — `ExchangeCost` and
`formatCents` are added there already.

**RLS impact:** the table is created with RLS on and four policies, all gated on
`is_toy_transaction_party()`, which already exists and already counts the owning
organisation's leaders. Either party may update, because either may be the one
who was paid and so the one who knows it is settled. Only the author may delete:
settling is the other party's lever, and deleting somebody else's record of what
they are owed is not.

**Workaround in place:** none. The panel is parked rather than faked — no
hardcoded total, no React state standing in for a row. Per the brief's rule 3 it
renders an honest empty state saying the data is not live yet.

**Still open, and deliberately out of this migration:** the artboard's panel also
lists costs against a *print job* and a *build day*. Neither has a table — print
jobs are F6/F7 and events are F10 — so a cost line has no parent to hang off for
those yet. `exchange_costs` is scoped to what exists rather than inventing two
parent tables to satisfy one panel. When those land, the choice is a polymorphic
parent or a second table; the saves subsystem already set a precedent for the
former in this repo.

### [F4/F8] `056_exchange_settlements.sql` — applied 2026-09-16

Byron chose the settlements row over money columns on `toy_transactions`.

The per-line `claiming` flag went on `exchange_costs` where it belongs, and the
`amount_cents > 0` check relaxed to `>= 0` for covered lines only — somebody
recording that they absorbed the postage need not price it, while a line being
claimed still has to be worth something.

The receipt bucket is **private, and its policies are tighter than 049's**. That
migration lets any signed-in account read a tutorial PDF, which is right for
shared work. A receipt is frequently a photograph of somebody's bank statement,
so all four verbs are gated on being a party to the exchange named by the path's
first folder segment. A file uploaded outside that shape matches no exchange and
is readable by nobody, which is the correct failure direction.

`check-schema-guards.sh` gained four assertions, including that the bucket is
not public — the worst failure mode in that file, since it would publish
receipts to anyone who could guess a transaction id with nothing in the product
looking different. Mutation-checked against a public bucket and a missing one.

Verified past the ledger on the remote: table, RLS, three policies, four storage
policies, private bucket, and the `claiming` column.

The original entry, with the reasoning behind the shape, follows.

### [F4/F8] The cost panel needs more than 055 models

**Why:** 055 was written from the dashboard's money *summary*, which is a list of
descriptions and amounts. The full cost panel on the exchange detail screen —
captured at `.playwright-mcp/artboard-thread-detail.png` — carries four things
it does not model:

- **Per line, who is absorbing it.** Each line is tagged "Claiming back" or
  "Covering it". A line someone is covering shows $0.00 to the other party but
  is still listed, because the point is that they are not being asked for it.
  Without this the panel cannot distinguish "you owe nothing" from "nobody has
  said what this costs".
- **A note, attributed.** One free-text note under the lines with a byline
  ("Northside Therapy Collective's note"), rendered as a quote. Per exchange,
  not per line.
- **A receipt.** An image slot captioned "Their receipt, if they added one".
  Per exchange.
- **A settlement method.** "Bank transfer", shown once at the foot of the panel.

`settled_at` / `settled_by` already cover "Mark as settled", which is the only
part 055 got ahead of.

**Blocks:** the cost panel (F8) and the top third of the exchange detail (F4).
Neither the dashboard summary nor F3's list is affected — those ship on 055 as
it stands.

**Proposed migration:** not written, because the shape is a real choice. The
per-line flag is clearly a column on `exchange_costs`. The note, receipt and
method are per exchange, so they are either three columns on
`toy_transactions` — which makes that table carry money concerns it otherwise
does not — or a small `exchange_settlements` row per transaction. The second
keeps money in one place and gives the receipt somewhere to hang; it is also one
more table to gate. Worth one decision rather than drifting into the first.

**RLS impact:** whichever shape, the same `is_toy_transaction_party()` gate as
the costs and messages on that exchange. A receipt is an image of somebody's
bank statement often enough that the storage bucket needs the same care 049 gave
tutorial PDFs — private, with a signed-in-only policy, not the public photo
buckets.

**Workaround in place:** none. F4 has not been started.

_(Migrations 001-054 predate this project; 054 was applied 2026-09-03.)_

## Filed, not blocking

### `/api/admin/spot-check` does not sample

`packages/api/src/routes/admin.ts:438-448` is documented as *"A random sample of
tutorials someone other than the admin approved"* and performs an unordered
`.limit(10)`. There is no randomisation, so in production it returns the same ten
rows every time. The control it implements — catching a bad self-approval by
sampling, which is the detection half of a control whose other half is reactive —
does not actually sample.

Surfaced 2026-09-16 because `tests/integration/orgs/admin-endpoints.test.ts`
fails against a local database holding 1,729 tutorials: a tutorial the test has
just created cannot appear in the first ten of an unordered page. It passes on
CI's fresh database, which is why it has never been caught there.

This is a query bug, not a schema one, so it needs no migration. The test is
deliberately left untouched — repairing it locally would hide the defect it is
accidentally reporting.
