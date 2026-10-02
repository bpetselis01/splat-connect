# Toys + exchanges build — sub-project 4, batch 3

Batch 3 of six (split in `2026-10-01-guides-build-design.md`). The guides
spec's **Rules every slice keeps** apply unchanged. Board copy:
`Splat Connect frontend overhaul/SPLAT Connect - Mobile.dc.html` (MB) and
`SPLAT Connect - Web.dc.html` (WB); quote it, never invent it.

## Scope — 11 registry items

`toy-condition-words`, `toy-holder-location`, `exchange-toy-photo`,
`handover-code-actions`, `toy-pause-unavailable`, `my-toy-summary`,
`my-toy-inline-requests`, `inventory-states`, `toy-holder-picks`,
`money-panel-detail`, `build-thread-cost-panel`.

Related items owned by other batches: `thank-people`, `report-problem-mobile`,
`notification-second-line`, `org-profile-rows` (batch 6);
`locations-and-distance` (batch 2); `clear-filters-empty` (batch 1).

## Facts this design rests on

- `toys`: `owner_id` XOR `owner_org_id`, `condition` 1–10, `status
  draft|published`, `quantity`; counts are computed functions (073), never
  columns, because the editor's `updated_at` check would 409.
- A transaction's extra stages are timestamps; the API is the only writer of
  `toy_transactions` (026 has no client INSERT/UPDATE policies).
- Handover codes are 6 random digits from `generateCode()`, issued at accept;
  each side sees only its own (`sanitizeCodes`). The board's 4-character
  code is not adopted; the existing format stays.
- `exchange_costs` lines settle per line (`settled_at`), with routes for add,
  settle, delete and settlement already in `routes/exchange-costs.ts`.
- The mobile owner route `(my)/toys/[id]` opens the editor directly.
- Grade words exist twice: `packages/web/lib/toy-grade.ts` (Like new ≥9,
  Good ≥7, Well-loved ≥5, Needs a fix) and a mobile copy with different
  buckets.

## Items

### toy-condition-words
Move `gradeOf` to `packages/types` (one source); web imports it from there;
mobile toy detail shows the pill "{grade} condition" and inventory rows the
word, not "N / 10". The mobile library's filter buckets switch to the same
four grades.

### toy-holder-location
The public toy read adds `holder_suburb`, `holder_state`: an org's public
`suburb/state`, or a person's `pickup_suburb/state` read with the admin
client. Never the street or postcode. Mobile subtitle: "{holder} · {suburb},
{state}". The board's promise "They never see your address, only your suburb."
is the rule.

### exchange-toy-photo
`GET /api/toy-transactions/:id` embeds `toy:toys(name, status,
cover_photo_url)`. The mobile exchange header shows the photo in the "Toy"
slot, falling back to today's cube tile.

### handover-code-actions
`POST /api/toy-transactions/:id/new-code` regenerates the caller's own code
(only while accepted and unconfirmed). Mobile code card gets **Copy**
(`expo-clipboard`, added as a dependency; toast "Code {code} copied") and
**New code** (toast "New code — the old one no longer works").

### toy-pause-unavailable
`toys.paused_at timestamptz` (owner-editable, both whitelists). Paused: still
listed and readable; request button hidden with the line "Not taking requests
right now"; `POST /api/toy-transactions` refuses with 409. Mobile and web
owner controls: **Mark unavailable** / **Take requests again**.

### my-toy-summary
New mobile screen at `(my)/toys/[id]` in front of the editor (editor moves to
`(my)/toys/[id]/edit`). Lead: "{name} — listed {date}, {grade} condition
[, switch-adapted]. {n} families have asked for it." Rows: requests (next
item), "Edit listing · Photos, condition, notes", "Mark unavailable · Keeps it
listed but hides the request button" (or "Take requests again").

### my-toy-inline-requests
On the summary, each open request: "{requester} · {their first message}" with
**Accept**. Personal toys open the existing accept sheet (pickup address,
pre-filled from the profile); org toys accept directly. Data from
`GET /api/toy-transactions` (already returns requester name and last message).

### inventory-states
`toys.retired_at` for org toys (org whitelist only). Retired toys leave the
public library and the request flow; the inventory shows a "Retired" pill with
the reason note (`retired_note` ≤ 80, e.g. "Broken 12 Aug") and **Remove**
(toast "{n} removed from the shelf"), which deletes the toy. Drop the Out /
Needs clean wording from the marker; no lending states.

### toy-holder-picks
`toys.picks_mode text` ('auto' | 'picked', default 'auto') and
`toy_picks(toy_id, position 1–3, entity_type 'toy'|'tutorial', entity_id)`,
unique (toy_id, position), RLS like 048's recommendations (read when the toy
is published, owner/org leader writes). Auto = up to 3 of the holder's other
published toys, newest first (web's current behaviour). Mobile toy detail and
web toy page both show "Also worth a look — Picked by {holder} — what else
they have listed, and the guides behind it." Editors: a mode switch and a
picker of the holder's own toys and approved guides.

### money-panel-detail
`GET /api/exchange-costs/outstanding` becomes `GET /api/exchange-costs/mine`
(old path kept as an alias): lines where the caller pays **or** is paid,
settled or not, grouped by transaction, with the other party's name and
whether the thread is an exchange or a build. Mobile Me panel rows per
exchange: what (description) and who ("{name}" or "{name} — build thread"),
"Settled" / "To settle"; sub "Still to settle across {n} exchanges. SPLAT never
handles the money — you pay each person directly."; empty "All settled —
nothing outstanding."

### build-thread-cost-panel
Mobile gets the cost panel both threads share, on the existing routes:
- Maker: "Parts you bought for this build — The family covers parts, never
  your time. Itemise what you bought and mark each line." Add a line (amount,
  description, Claiming back / Covering it), delete own lines.
- Family: "What this build costs you — {maker} gives the time and the tools
  free. These are the parts he bought for your toy, in his words." "You pay
  back {total}" or "Nothing to pay"; **Mark as settled** with "Tap only once
  the money has actually changed hands."
- The exchange thread's read-only card uses the same component.
The board's "Paid forward" option is not in the schema and is left out.

## Testing

Test-first per slice. Route tests: paused 409, retired hidden, new-code only
for the caller's own code and only while accepted, money list includes both
directions. Pure tests: `gradeOf`, auto picks. Object-exists assertions,
drift test, parity after each slice.

## Order

1. toy-condition-words, toy-holder-location, exchange-toy-photo,
   handover-code-actions.
2. toy-pause-unavailable, my-toy-summary, my-toy-inline-requests.
3. inventory-states, toy-holder-picks.
4. money-panel-detail, build-thread-cost-panel.
