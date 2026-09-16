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

_(none yet. F5, F6, F7, F10 and F12 build routes that do not exist and are the
likeliest to add entries here.)_

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
