# Public Tutorial View Redesign — Design Spec

**Date:** 2026-08-05
**Status:** Approved for implementation
**Scope:** `packages/web/app/tutorials/[id]/page.tsx` and its `globals.css` primitives. No API, type, or `packages/mobile` changes.

---

## Context

The public tutorial detail page (`/tutorials/[id]`) is the page a logged-out parent or contributor lands on. Today it's a flat `md:grid-cols-2` split: left column stacks photo, org badges, title, description, contributors, PDF download, and STL files; right column stacks Parts and Tools, each item rendered as an individual `.card` (white, shadowed) sitting on the page's own white-on-canvas context — cards nested inside a page that's already mostly white, so nothing stands out. Section headers use emoji (🔩 🔧) and there's no single element that answers "can I do this, and where's the file" without reading the whole page.

The page needs to serve two things at once: a fast glance ("is this within reach?") and a working reference while assembling. This spec keeps the current two-column breakpoint and API shape, and restructures what lives in each column and how it's styled.

---

## Desktop layout (`md:` and above)

Left column becomes a **sticky rail**: `position: sticky` with a `top` offset clearing the nav bar. It naturally pins while the taller right column scrolls, and un-sticks once the user scrolls past the bottom of its own grid row — no manual scroll-tracking needed.

Rail contents, top to bottom (all existing markup/components, just consolidated into one sticky block instead of a plain top-of-column stack):
1. Photo (`Image` with existing `rounded-2xl` treatment, or the 🧸 placeholder — unchanged)
2. Title + `DifficultyBadge`
3. `OrgBadges` (backing + approved-by line — unchanged component)
4. Contributor line ("By X, Y" — unchanged)
5. Description (unchanged; no line-clamp — a long description just makes the rail taller before sticking, which is fine)
6. **Download Tutorial PDF** button (`.btn.btn-primary.btn-block`, unchanged)

Right column becomes the **reference column**: three sections rendered in this order — **Parts needed**, **Tools needed**, **Files for 3D printing**. `tutorial.stl_files` moves out of the rail and becomes a third reference-column section, styled identically to Parts/Tools.

## List styling (all three reference-column sections)

Replace the current per-item `.card` (nested card-on-canvas) with a plain divided list: one `.card-flat`-style container per section, rows separated by a hairline `border-bottom` (reusing `--color-line`), no individual box/shadow per item. Section headers become plain bold text at the existing `h2` scale — drop the 🔩/🔧 emoji prefixes; "Files for 3D printing" already has no emoji and is unchanged in wording.

Within each row, keep existing per-row content unchanged:
- Parts: name × quantity, `Optional` badge, buy links
- Tools: name, `Optional` badge, buy links
- Files: filename with a download icon/link (currently `.btn.btn-soft.btn-block.btn-sm` — restyle to match the plain row treatment, same click behavior)

## Narrow viewport (below `md:`)

No sticky behavior — plain single-column stack in this order: photo → title/badges/backing/contributors → description → Download button → Parts → Tools → Files. Same content as the desktop rail + reference column, just concatenated in DOM order with no `position: sticky`. This is a straightforward continuation of today's `grid-cols-1` behavior; the only visible change here is Files moving from beside the Download button to after Tools, and the same list-styling/emoji removal as desktop.

## Out of scope

- `packages/mobile` (native app) — a separate codebase (`detail-screen.tsx`), untouched regardless. It has no STL/Files section at all today.
- API/data shape — same `TutorialWithDetails` fetch from `/api/public/tutorials/:id`, no new fields.
- Any sticky/collapsible affordance on narrow viewports — explicitly rejected in favor of a plain stack.

---

## Test impact

- `packages/web/tests/e2e/public/tutorial-detail.spec.ts` asserts headings `'🔩 Parts needed'` and `'🔧 Tools needed'` (lines 21, 25) — these must be updated to the emoji-free text once headers change.
- Same spec's STL/PDF/buy-link assertions (filename link, PDF download link, buy-link `target="_blank"`) query by role/text/label, not by column or DOM position — they should keep passing against the restructured markup, but re-run to confirm order-independence.
- No unit test currently exists for this page (`tests/unit/components/tutorial-card.test.tsx` covers the library card component, not this route) — none required to add per existing test conventions for this page, since the e2e spec is the coverage for it.
