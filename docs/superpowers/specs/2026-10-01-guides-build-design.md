# Guides build — sub-project 4, batch 1

Sub-project 4 builds the items registered in `packages/types/src/pending.ts`.
The 83 build items are split into six batches, each with its own spec → plan →
build: **1 Guides** (this spec), 2 3D printing, 3 Toys + exchanges,
4 Challenges + makers, 5 Recycling, 6 People, orgs, Me, admin. Setup and content
items wait on Byron's accounts and a lawyer.

All decision items are answered (the last two on 2026-10-01: iOS keeps centred
header titles; the app keeps its four extras).

## Scope — 20 registry items

UI only: `guides-loading-caption`, `clear-filters-empty`, `guides-search-parts`,
`new-guide-fields`, `editor-part-buy-links`, `editor-backing`,
`my-tutorials-meta`, `guide-ask-a-maker`, `guide-step-tracking`,
`guide-tools-checklist`, `review-checklist`.
Columns: `tool-notes`, `part-prices`, `guide-photo-captions`, `print-settings`,
`guide-works-with`.
Tables: `editor-safety-notes`, `guide-build-done`, `my-tutorials-views`,
`guide-community-notes`.

Board copy lives in `Splat Connect frontend overhaul/SPLAT Connect - Mobile.dc.html`
and `SPLAT Connect - Web.dc.html`; quote it, don't invent copy.

## Rules every slice keeps

- **No counter columns on `tutorials`.** The BEFORE UPDATE trigger (014) bumps
  `updated_at`, and PATCH 409s on a stale token, so a counter column would 409
  an author mid-edit. Counts are SECURITY DEFINER computed fields
  (`stable`, `search_path = ''`, like `thanks_count`, 066) or separate tables.
- One migration per slice, numbered from 085. Tests assert the objects exist
  (see memory: repaired-not-run migrations are invisible to ledger drift).
- Limits are checked twice: zod in the API (400 with a plain sentence) and a
  CHECK in the database.
- Each slice deletes its `PENDING(id)` / `pending="id"` references, sets
  `shipped: true`, regenerates `docs/PENDING.md`, and removes any parity
  `explained` rule naming the id. One commit per item.
- Mobile is a second consumer of every column: grep `packages/mobile` on each
  column change.

## Data model

### Columns

| Item | Column | Constraint |
|---|---|---|
| part-prices | `parts.price_cents int` | ≥ 0, null = unpriced. The cost of the line at its quantity. |
| part-prices | `tutorials.prices_checked_on date` | optional |
| tool-notes | `tools.note text` | ≤ 200 |
| tool-notes | `tools.get_by text` | in ('buy','borrow','substitute'), nullable |
| guide-photo-captions | `tutorials.photo_captions text[]` | cardinality ≤ 5; each ≤ 60; parallel to `photo_urls` |
| print-settings | `tutorials.layer_height_mm numeric(3,2)` | 0.05–1.00 |
| print-settings | `tutorials.infill_percent int` | 0–100 |
| print-settings | `tutorials.material text` | ≤ 40 |
| print-settings | `tutorials.print_minutes int` | 1–6000 |
| guide-works-with | `tutorials.toy_name`, `toy_brand` | ≤ 80 each |
| guide-works-with | `tutorials.works_with`, `no_build_note` | ≤ 300 each |

All optional. New `tutorials` columns join `EDITABLE` in `routes/tutorials.ts`.
`parts`/`tools` columns pass through each route's `mapRow` (the whole list is
replaced on save, so they are not under the 409 check).

The parts total shows only when every non-optional part has a `price_cents`.
That rule lives in one pure function in `packages/types` used by web and mobile.

### Tables

**`tutorial_safety_notes`** — id, tutorial_id (cascade), position 1–20,
title ≤ 80, detail ≤ 500. RLS in the steps form (080): read when the guide is
approved; contributors via `is_tutorial_contributor`; admins. Saved with
`subResourceRoutes` at `/:id/safety-notes`; embedded in the editor and public
reads as `safety_notes`.

**`tutorial_builds`** — (tutorial_id, profile_id) primary key, built_at. RLS:
a member reads, inserts and deletes only their own rows. `builds_count(tutorials)`
SECURITY DEFINER returns the number. Routes: `POST`/`DELETE /api/tutorials/:id/build`.

**`tutorial_view_counts`** — tutorial_id primary key, views bigint. No client
policies. `bump_tutorial_view(uuid)` SECURITY DEFINER, called by the public
guide read; failures are logged and swallowed, never failing the read.
`view_count(tutorials)` SECURITY DEFINER returns the number. Raw views, no bot
filtering (`ponytail:` note in the migration).

**`tutorial_notes`** — community notes.
- Columns: id, tutorial_id (cascade), step_id → tutorial_steps
  (`on delete set null`; null = "Missing step"), author_id → profiles, body
  1–1000, photo_url, photo_caption ≤ 60, pinned_at, pinned_by, created_at.
- RLS: anyone reads notes on approved guides; an authenticated member inserts
  as themselves on an approved guide and deletes their own; admins all.
  Pinning is an API route using the admin client after an
  `is_tutorial_contributor` check (403 otherwise).
- Routes: `GET/POST /api/tutorials/:id/notes`, `DELETE /api/tutorials/:id/notes/:noteId`,
  `POST /api/tutorials/:id/notes/:noteId/pin` and `/unpin`.
- A new note notifies the guide's contributors (existing notifications table).
- Account deletion moves a deleted member's notes to the 'Deleted member'
  placeholder profile, like other authored content.
- Reports use the existing Report a problem flow.
- Pinned revisions do **not** appear in the guide PDF: the PDF is a file the
  author uploads. They appear on the guide and in its banner.

## Screens

### Mobile guide detail (`components/home/detail-screen.tsx`)

Top to bottom:
1. **Photos** — chip "{n}/{N} · {caption}" and a thumbnail strip of up to 5.
2. **Revisions banner** — "{N} pinned revision(s) since this was written —
   read before you build." Scrolls to Community notes.
3. **Steps** — tap a step to tick it. Header: "{pct}%", "{done} of {total}
   steps done", **Reset** (toast "Step progress cleared"), and
   "Pick up at step {N} — {title}". Ticks are kept on the device, per guide,
   through `resolveAuthStorage()` (as `lib/learn.ts` does); a storage error
   falls back to in-memory ticks; ticks for deleted steps are ignored. Pinned
   "Missing step" notes follow as extra steps, labelled "Added by the
   community … Pinned by X · suggested by Y".
4. **Completion card** when every step is ticked — "Log it and this build shows
   up in My SPLAT." with **Mark this build done** (toast "Build logged — nice
   work") and **Say thanks to {author}**.
5. **Community notes** — the board's lead; "Revisions · {n} pinned",
   "Discussion · {n}"; per-step label "1 pinned revision · 2 notes";
   **Add a note** (pick a step or "Missing step", optional photo + caption).
   Pin/Unpin for contributors, Delete for the note's author, Report for others.
6. **Parts** — "{name} ×{qty} {cost}", then Total and "Prices checked {date}"
   when the total rule holds.
7. **Tools** — "Tools you'll need · {X} of {Y} already yours"; each row shows
   the note and a Buy once / Borrow / Substitute tag; tick "I already have X"
   (device storage); "Not counted in the total above — tools are a one-off.";
   "Tools and materials on Learn →".
8. **Safety notes** — title + detail list.
9. **Files & print settings** — Layer height, Infill, Material, Print time,
   when any is set.
10. **Ask a maker nearby** — "Can't build it? Ask a maker nearby / A maker
    nearby gives the time and the skill; you cover the parts." Opens
    `/explore/makers-wanted/new?guide={id}`.

### Web guide detail (`components/tutorial-view.tsx`)

- Rail: "The toy you start with — {toy_name} by {toy_brand}" and
  "Works with — {works_with}"; the no-build note beside "Get help with this
  build"; Mark this build done.
- Parts & tools tab: prices, total, prices-checked date, tool notes and tags.
- Safety tab: author's notes below the checklist.
- Files tab: print settings.
- Revisions banner and pinned revisions, read only (posting is mobile, per the
  registry).

### Editors

- Parts: price input and prices-checked date (web `edit-items-section.tsx`,
  mobile `sections/items-section.tsx`); mobile gains buy-link editing.
- Tools: note and get-by choice, both platforms.
- Photos: a caption per photo; captions travel with their photo on reorder and
  removal in the same PATCH; the API refuses more captions than photos.
- Safety: add/remove list (mobile `sections/safety-section.tsx`, web details).
- Print settings: four inputs, both platforms.
- Web About: Works with, toy name/brand, "If someone would rather not build it
  (optional)".
- Mobile hub: a Backing row using the existing `/:id/orgs` routes.
- Mobile New guide: Cover photo, Switch type, Age range (PATCH already accepts
  them).

### Lists and review

- My tutorials rows: "{views} views · {backing org}"; a draft shows
  "Draft · {ready} of {n} sections done" (the hub's own count, extracted to a
  shared function); "With {org} since {date}" while backing is pending.
- Guides list: search matches part names server-side; "Loading guides…"
  caption on the skeleton; **Clear filters** on the Guides and Toy library
  empty states.
- Org review (`review-detail-screen.tsx`): Summary, Steps ("{n} steps, all
  photographed"), Parts ("{n} parts with prices"), Tools, Safety notes, Files,
  each OK or Flag; lead "{n} sections, {k} complete."
- Counts: `contributorBadges` takes `builds`; "100 builds" replaces the thanks
  stand-in described in its header. My SPLAT shows your builds logged.

## Testing

Test-first per slice:
- API route tests per new route and column (validation 400s, 403 on pin by a
  non-contributor, the counters never changing `tutorials.updated_at`), plus
  object-exists assertions per migration.
- Pure-function unit tests: tick storage, step %, the total rule, caption
  realignment, section count.
- Mobile unit tests for each new section's rendering.
- Web e2e for rail cards, the prices total and Mark done (specs import from
  `lib/` only).
- Web and mobile parity re-run after each slice; the drift test passes.
- One iOS simulator check at the end for device tick storage under Hermes.

## Order

1. UI only: loading caption, clear filters, search by part, New guide fields,
   mobile buy links, mobile backing, My tutorials meta, ask a maker, step
   tracking, tools checklist, review checklist.
2. Columns: tool notes, part prices, photo captions, print settings, works with.
3. Tables: safety notes; builds (+ badge, My SPLAT); view counts.
4. Community notes.

## Out of scope

The other five batches. Notes posted from web. Bot filtering for views.
Regenerating the uploaded PDF.
