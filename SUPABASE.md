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

_(F5, F6, F7, F10 and F12 build routes that do not exist and are likely to add
further entries here.)_

## Applied

_(none yet in this project. Migrations 001-054 predate it; 054 was the last,
applied to the hosted `development` project on 2026-09-03.)_

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
