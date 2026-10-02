# 3D printing build — sub-project 4, batch 2

Batch 2 of six (see `2026-10-01-guides-build-design.md` for the split). Byron
asked (2026-10-01) for all six batches built without review stops. The
**Rules every slice keeps** section of the guides spec applies here unchanged
(one migration per slice from the next free number, object-exists tests,
zod + CHECK limits, ship each registry item in its own commit, grep mobile on
every column change).

Board copy: `Splat Connect frontend overhaul/SPLAT Connect - Mobile.dc.html`
and `SPLAT Connect - Web.dc.html`. Quote it; never invent copy.

## Scope — 13 registry items

`print-part-quantity`, `message-printer`, `add-printer-rates`,
`print-cost-estimate`, `print-answer-by`, `print-fit-feedback`,
`printer-stats`, `printer-verified`, `bed-fit-filter`, `customization-metrics`,
`printing-parts`, `saved-parts`, `locations-and-distance`.

## Facts this design rests on

- A print job is a `toy_transactions` row, `type='print'`. Extra stages are
  timestamps, never new status members. "Collected" = `status='completed'`
  (both handover codes confirmed).
- `print_job_files.quantity` (1–20) already exists; POST `/print` ignores it.
- Every print job already has a thread (`toy_transaction_messages`), rendered
  on the mobile job screen.
- `printers` has `bed_x/y/z`, `suburb`, `state`, `filament_cents_per_g`,
  `rate_note`; no postcode, no verified column. `stl_files` has
  `filament_grams` but no dimensions.
- The web printer form already has "Your standard rates" as one per-gram
  figure plus a note. Mobile follows web, not the board's cost lines.
- No geo code or postcode data exists in the repo.

## Items

### print-part-quantity
POST `/print` accepts `files: [{ stl_file_id, quantity }]` (1–20, default 1;
the old `stl_file_ids` still accepted). Mobile request screen gets a stepper
per part, shown "×{qty}". Web request form likewise.

### message-printer
The job screen's printer card **Message** button scrolls to and focuses the
existing thread input. No new data.

### add-printer-rates
Mobile Add a printer gains the web panel: "Your standard rates — What a family
is asked to cover, shown on your card before they request. Your time and your
machine stay free." A cents-per-gram input and the rate note (placeholder
"e.g. filament at what the spool cost me, nothing for time."). Empty: "Nothing
listed — your card will say you cover everything yourself."

### print-cost-estimate
A pure function in `packages/types`: `printCostCents(files, centsPerGram)` =
Σ filament_grams × quantity × rate, null when the rate is null or any file lacks
grams. The agree line reads "I understand I cover the filament — about $X at
the printer's declared rate — and that I settle it with them, not through
SPLAT." With several printers picked, the range "$X–$Y". Falls back to today's
line when null.

### print-answer-by
Answer by = `created_at + 7 days` (one constant in `packages/types`). Accept
refuses an expired request (409, "This request expired on {date}; ask again.").
Web requested stage shows "Answer by — {date}" and "They have until {date} to
answer. You can add a printer or withdraw at any time."; mobile job screen the
same. An expired request reads "Expired" to both sides; no scheduled job.

### print-fit-feedback
Columns on `toy_transactions`: `print_fit text` ('fitted' | 'reprint'),
`print_fit_at`. Only the requester sets it, only once the job is completed
(`POST /:id/print-fit`). Mobile collected card: "Did it fit? One tap. It goes
back to the printer and to the guide author so the next print is better."
Fitted / Needs a reprint. "Needs a reprint" notifies the printer.

### printer-stats
`printer_stats(printers)` SECURITY DEFINER computed field returning
`{ jobs, median_days, fitted, fit_answers, colours }` over completed print jobs:
jobs = completed count; median_days = median of (later confirmed_at −
created_at) in whole days; fitted / fit_answers from `print_fit`; colours =
distinct `print_colour`, most used first, max 3. Shown as "{jobs} jobs · ~{median}
days" on the find card, the job printer card and the offer machine picker
("{n} completed · median {d} days", "{f} of {n} fitted first time",
"Colours: …"), and as Turnaround / Fit on org profiles (web + mobile). Hidden
below 1 completed job.

### printer-verified
Earned, not granted:
- `printer_test_prints` table: printer_id, photo_url, submitted_at,
  verdict ('pass' | 'fail' | null), reviewed_by, reviewed_at, note. Owner or
  org leader submits; admin sets the verdict (admin client route).
- `printers.verified` is a computed field (SECURITY DEFINER): latest test
  print passed AND completed jobs ≥ `VERIFIED_MIN_JOBS = 3` (one constant).
- Owner sees "Get verified" on their printer: upload a photo of the SPLAT test
  print; status Waiting / Passed / Failed with the admin's note.
- Admin queue: a "Test prints" list on web admin with pass/fail + note.
- Find screen's Verified chip filters; a seal-check icon titled "Verified" on
  cards.

### bed-fit-filter
`stl_files.size_x_mm/size_y_mm/size_z_mm int` (1–2000, optional), entered per
file in both editors. When a request's every chosen file has sizes, printers
whose bed can't hold the largest file in any orientation of x/y (z fixed) are
hidden from the pick list. No chip. The basics copy keeps "the printer checks
the parts fit before they accept."

### customization-metrics
Per job, on the print request (the 2026-09-30 decision, which overrides the
board's profile placement). `toy_transactions.print_fit_notes jsonb` with the
board's questions and options: Reach from seated (Under 20 / 20–40 / Over 40
cm), Preferred switch size (Small 50 mm / Large 100 mm / Extra large), Mount
needed (Tray clamp / Floor stand / None), Tray thickness (10 / 15 / 20 mm /
Not sure). All optional, under "Physical dimensions we use to size printed
mounts and brackets. Nothing here is required." Shown to the printer on the
offer and job screens. The profile-screen PendingRow is removed.

### printing-parts
Web `/printing/parts` replaces ComingSoon with a catalogue of STL files from
approved guides: search by filename and guide title, each row showing the
guide, material, filament grams and print time, linking to the guide. API
`GET /api/public/printable-parts?q=` (paged). The board's page steps stay as
the intro.

### saved-parts
Add `printable_part` to the saves `SOURCE` map (entity = `stl_files.id`, only
on approved guides). Save button on catalogue rows; web
`/dashboard/saved/parts` lists them; mobile Saved gains the Printable parts
row and list.

### locations-and-distance
- `postcode_centroids(postcode text pk, lat, lng)` loaded from ABS postal-area
  data (CC BY 4.0; attribution on `/about` credits). Seed via a migration that
  copies from a checked-in CSV.
- Postcode columns: `printers.postcode`, `toy_transactions.requester_postcode`
  (build requests). Toys and organisations use the existing
  `pickup_postcode` of their owner/org; viewers use their profile's
  `pickup_postcode`.
- `postcode_km(a text, b text) returns int` — haversine between centroids,
  rounded to whole km, null when either is unknown. No address or point is
  stored about anyone.
- The four list APIs (`GET /api/printers`, `/api/toy-transactions/open-builds`,
  `/api/public/toys`, `/api/public/organizations`) take `near=<postcode>` and
  `within=<km>`, return `km` per row and sort nearest first when `near` is set.
- UI: printers "Within 10 km" chip (mobile) and "Distance from you: Within 5 km
  / Within 25 km / Anywhere" (web); Makers wanted chips filter on real
  distance; "{km} km" on rows; toy library "Nearest first". With no postcode
  on the viewer's profile the chips prompt "Add your postcode" linking to
  account.

## Testing

As in the guides spec: test-first per slice; route tests for 400/403/409
paths; pure-function tests for cost, answer-by, bed fit, stats median;
object-exists assertions; parity + drift test after each slice; web e2e for
the catalogue and the answer-by line.

## Order

1. No schema: message-printer, add-printer-rates, print-part-quantity,
   print-cost-estimate.
2. print-answer-by, print-fit-feedback, printer-stats, customization-metrics.
3. bed-fit-filter, printing-parts, saved-parts.
4. printer-verified.
5. locations-and-distance (largest; touches toys and makers lists too).
