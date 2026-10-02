# Recycling build — sub-project 4, batch 5

Batch 5 of six (split in `2026-10-01-guides-build-design.md`). The guides
spec's **Rules every slice keeps** apply unchanged. Board copy: MB =
`Splat Connect frontend overhaul/SPLAT Connect - Mobile.dc.html`, WB =
`SPLAT Connect - Web.dc.html`; quote it, never invent it.

## Scope — 4 registry items

`recycling-photo-upload`, `recycling-intake-credit-rule`,
`org-recycling-details`, `recycling-credit-spending`.

## Facts this design rests on

- `recycling_dropoffs` (059, 063): contributor books; only an org leader
  updates (`weighed_grams`, `credit_grams ≤ weighed_grams`); `photo_url`
  exists but no bucket, policy or writer does.
- Org settings are only `recycling_materials` and `recycling_note`.
- No credit ledger: issued credit = Σ `credit_grams` of received drop-offs.
- `MIN_DROPOFF_GRAMS = 2000`, `estimatedCreditGrams = floor(g × 0.75)` in
  `packages/types`.
- Print-job accept runs through `accept_toy_transaction` RPC
  (`toy-transactions.ts:670`).

## Items

### recycling-photo-upload
Migration creates the private `recycling-photos` bucket with policies like
`print-shots` (058): the contributor writes under their own folder; the
contributor and the org's leaders read. `POST /:id/recycling` accepts
`photo_url` (a path). Booking form on mobile and web: image slot "Photo of the
sorted plastic" (optional), with 063's line "Sorted, in the bag or box you will
carry it in. It saves an argument at the door." The intake screen shows it to
the leader.

### recycling-intake-credit-rule
One weight box ("Actual kg"); credit prefilled at `estimatedCreditGrams` and
editable; the stored credit is what the leader entered (no yield column). The
line under the box: "{g} g credit" or "Weigh it to see the credit". Buttons
"Contaminated" / "Weigh and credit"; toast "Weighed at {kg} kg — {g} g credit
issued to {who}"; below the minimum, "Under the 2 kg minimum — log it as a
donation or hand it back". Web `recycling-intake.tsx` adopts the same rule
(its second box becomes the prefilled credit).

### org-recycling-details
Columns on `organizations` (granted to anon like 059's): `recycling_machines
text[]`, `recycling_forms text[]`, `recycling_min_kg numeric` (≥ 2, the
platform floor), `recycling_max_kg numeric` (≥ min), `recycling_turnaround`
≤ 60, `recycling_gives` ('credit' | 'spool' | 'either'), `recycling_hours`
≤ 80, `recycling_door` ≤ 120. Chip lists from the board in `packages/types`:
machines Shredder, Extruder, Filament dryer, Injection moulder, Sheet press;
forms Failed prints, Offcuts, Sprues and rafts, Bottle caps, Clean packaging.

- Editor (web "What you take", mobile org recycling): the board's labels and
  lead "Contributors see this before they pack a box. Be specific — every
  unlisted item is one somebody has to pick out by hand."; minimum note "The
  platform floor is 2 kg. You can ask for more, never less."
- Booking refuses estimates over the max (400) and under the org's min; hint
  "{org} takes at most {max} kg at once."
- Contributor cards and org profiles: "Takes {polymers} · {forms}",
  "Machines", "Per drop {min–max kg} · {turnaround}", "You get" (Print credit
  on their machines / A spool to take home / Credit, or a spool), "When
  {hours} · {door}". `recycling_note` stays as free text below.

### recycling-credit-spending
Grams, never money; spent only at the issuing organisation.
- `recycling_credit_spends(id, profile_id, org_id, transaction_id unique,
  grams > 0, created_at)`; own read, no client writes.
- `recycling_credit_balance(profile uuid, org uuid) returns int` SECURITY
  DEFINER = issued − spent at that org; `GET /api/recycling/credit` lists the
  caller's balance per org.
- Print request: when a picked printer belongs to an org where the requester
  has a balance, the checkbox "Use {n} g of your credit at {org}" / "You have
  {n} g from {kg} kg you dropped off. Only deducted if they are the one who
  takes it." sets `toy_transactions.print_credit_grams` (≤ balance and ≤ the
  job's filament grams). Agree line becomes "I understand my recycling credit
  covers the filament on this job, and that any balance is settled with the
  printer, not through SPLAT."
- Accept: if that org's printer accepts, the spend row is written in the same
  database call as the accept (inside `accept_toy_transaction`), re-checking
  the balance; insufficient balance accepts the job without credit and says so
  in the thread. Any other printer accepting spends nothing.
- Recycling hero: "{n} g of print credit unspent"; web "Print credit, unspent"
  per org with "Spendable on filament at that organisation only. It comes off
  the cost panel when they take your print job." Cost panel line "Your
  recycling credit ({n} g)".

## Testing

Test-first. Route tests: photo path in another user's folder refused; max and
min checks; credit never exceeds balance; a different org's printer accepting
writes no spend; double accept writes one spend (unique transaction_id).
Pure tests: credit prefill, balance arithmetic. Object-exists assertions
(bucket, policies, function), drift test, parity after each slice.

## Order

recycling-photo-upload, recycling-intake-credit-rule, org-recycling-details,
recycling-credit-spending.
