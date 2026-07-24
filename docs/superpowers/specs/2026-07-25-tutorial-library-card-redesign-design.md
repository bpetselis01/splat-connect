# Tutorial Library Card Redesign — Design Spec

**Date:** 2026-07-25
**Status:** Approved for implementation
**Scope:** `packages/mobile` — `LibraryScreen` and the shared primitives it consumes (`Chip`, `Card`, `DifficultyBadge`). No other screens, no API/type changes.

---

## Context

The user supplied a target mockup for the mobile Tutorial Library screen. The current implementation (`packages/mobile/components/home/library-screen.tsx`) already has the right data flow (search, difficulty filter, `StaggeredList`, loading/error states) and the right color/font tokens in `theme.ts` — this is a visual restyle of the search bar, filter chips, and tutorial card, not a functional change.

Reference mockup: big bold "Tutorial Library" title, a rounded search pill with a leading icon, a row of filter chips where the active one is a solid dark pill, and tutorial rows as large cards — image bleeding to the card's left/top/bottom edges, title + difficulty badge on one line, a two-line description below.

---

## Search bar

- Rounded pill (`theme.radii.pill`), `theme.colors.accentLight` background, no border.
- Leading `Ionicons name="search"` icon (from the already-installed `@expo/vector-icons` — no new dependency).
- Placeholder text stays exactly `"Search tutorials"` (no ellipsis) — `library-screen.test.tsx` queries `getByPlaceholderText('Search tutorials')`.

## Filter chips (`ui/Chip.tsx`)

- Active state changes from the current `primary` blue fill to a dark fill (`theme.colors.text`) with white text. Applies uniformly to whichever chip is active — All, Easy, Medium, or Hard.
- Inactive chips keep today's `accentLight` background.
- Chip labels (`All`/`Easy`/`Medium`/`Hard`) are unchanged — `library-screen.test.tsx` presses `screen.getByText('Hard')` to trigger the difficulty filter.

## Tutorial card (`ui/Card.tsx` usage in `LibraryScreen`)

Restructured so the image bleeds to the card's edges instead of sitting inside uniform padding:

- Card container: `flexDirection: 'row'`, `alignItems: 'stretch'`, `padding: 0`, `overflow: 'hidden'` (clips the image to the card's existing rounded corners/shadow — those tokens are unchanged).
- Image frame: fixed width (~130), `height: '100%'`. A real `toy_photo_url` fills the frame as today. Missing photo keeps the existing 🧸 emoji placeholder, just centered in the larger frame — no new placeholder art (per explicit decision: don't add the mockup's striped pattern).
- Body: `flex: 1`, padded (`theme.spacing(4)`), containing:
  - A row with the title (bold, ~18px, `flex: 1`) and `DifficultyBadge` right-aligned on the same line.
  - Below that, `tutorial.description` rendered with `numberOfLines={2}` and tail ellipsis, muted color (`theme.colors.muted`). Renders nothing when `description` is `null`.

## `DifficultyBadge`

- Keeps per-difficulty colors (green/easy, yellow/medium, red/hard) — the mockup's uniform blue badge is **not** adopted, since color-coding is a meaningful signal for parents scanning the list.
- Pill grows slightly (more padding, ~13px font) to match the larger card.
- Text casing changes from `.toUpperCase()` ("EASY") to title case ("Easy"), matching the mockup.

## Unchanged

Page layout, `ScreenHeader`, `StaggeredList` entrance animation, search/filter logic, API calls (`/api/public/tutorials`), loading and error states, all placeholder/error copy.

---

## Test impact

- `packages/mobile/tests/unit/components/difficulty-badge.test.tsx` currently asserts uppercase (`difficulty.toUpperCase()`); it must be updated to assert title case as part of this change.
- `packages/mobile/tests/unit/components/home/library-screen.test.tsx` has no assertions on card layout or badge casing — it queries by title text, placeholder text, and chip label text, all of which are preserved. It should keep passing unmodified, but re-run it to confirm.

---

## Out of scope

- The mockup's diagonal-stripe photo placeholder (explicitly deferred — keep the emoji).
- Uniform-color difficulty badges (explicitly rejected — keep color-coding).
- Any change to `detail-screen.tsx`, `preview-screen.tsx`, or other tabs.
