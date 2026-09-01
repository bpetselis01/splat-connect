# Mobile Account & Organisation (Phase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The last SectionStubs become real screens: Saved (hub + per-type lists), the organisation surfaces (Review queue, Review detail with back/decline/approve/reject, Toy inventory), the two Soon cards, and Admin's link-out rows. Account already exists (profile-screen + the three child steps) — Task 5 audits it against the spec and closes only real gaps.

**Architecture:** Zero API/schema changes. Every screen mirrors an existing web page; the web page's rules are the contract. The leader action matrix is ported from web's `components/project-actions.tsx` `leaderActions()` — lift it into `@splat-connect/types` rather than copying, the `isOwnerSide` precedent: two copies would let the clients offer a leader different actions on the same project.

**Tech Stack:** Expo SDK 57, expo-router 57. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-30-mobile-catch-up-design.md` — "Saved", "Organisation (leaders only)", "Soon", "Admin", "Account". The mockup stays the visual authority.

## Global Constraints

- Package `packages/mobile`; gates `pnpm typecheck`, `pnpm test:unit`, `pnpm test:e2e` (T6 only). Pixel tokens; established card/a11y conventions; tests self-contained; icons mocked. Commits per logical change (NOT per file — Byron lifted that rule 2026-09-01) with the two trailers; never push without asking.
- API contract, verbatim (mounted paths, not file names):
  - Saved: `GET /api/saves/ids` → `SavedIds` (counts come from lengths); `GET /api/saves/:slug` → the saved entities for one slug, already shaped for cards (read the route: each source declares its own `select`). Slugs are `Object.keys(SAVE_SLUGS)`: tutorials, toys, challenges.
  - Review queue: `GET /api/tutorials` (the caller's visibility already includes org-backed rows) + backing state per row from `tutorial_orgs` embedded — read web's `app/dashboard/organisation/page.tsx` for the exact split: "Waiting on you" = backing `pending`, oldest first; "Backed" = `accepted`. Counts must match `caps.exchangeActions`-style derivations already used by the hub tile.
  - Review detail actions, by (backing, tutorial) state via `leaderActions()`:
    - backing pending → **Back this guide** `POST /api/tutorials/:id/orgs/:orgId/accept {}` / **Decline** `POST …/decline {}`.
    - backing accepted + tutorial pending → **Approve** / **Request changes** `POST /api/tutorials/:id/review {status: 'approved'|'rejected', org_id, rejection_note?}` — rejection_note REQUIRED on reject (the API 400s without it; the note field's whole point).
  - Inventory: `GET /api/toys/inventory` → org-held toys with quantity; "＋ Add stock" → `/toys/new?for=org` (check what the existing add-toy screen accepts — if it has no org mode, the pill routes to it plain and the gap is ledgered, not invented).
  - Admin: five link-out rows opening web via `Linking.openURL(EXPO_PUBLIC_WEB_URL + path)` — the five hrefs in web's `app/admin/page.tsx` (contributors, review, organizations, spot-check, ideas). Mobile has no admin screens; link-out is the spec's own call.
- Soon cards: `print-requests` and `organisation/orders` swap SectionStub for one dimmed card with the promise line and a SOON `Badge`. One shared `SoonCard` component in `components/ui` ONLY if the two call sites cannot share SectionStub with a prop — prefer extending SectionStub.
- The Review queue/detail and Inventory screens are leader-only: `caps.ledOrgs.length === 0` renders the not-a-leader empty state, mirroring web's `notFound()` posture but with copy, since mobile navigation can land anyone there from the hub.

---

### Task 1: Saved — hub and per-type lists

**Files:** create `components/saved/saved-screen.tsx`, `components/saved/saved-list-screen.tsx`; replace stub `app/(my)/saved/index.tsx`, create `app/(my)/saved/[slug].tsx`; register `saved/[slug]` in `app/(my)/_layout.tsx`.
**Interfaces:** Hub = three count tiles (Guides / Toys / Challenges, counts from `GET /api/saves/ids` lengths) each → `/saved/:slug`; "Recently saved" from the most recent few across types IF `/api/saves/:slug` returns created_at (read the route; otherwise the hub is tiles only and the delta is ledgered). List = the slug's entities as the established cards (guides → `/guides/:id`, toys → `/toy-library/:id`, challenges → `/explore/challenges/:id`), each with its `SaveButton` so unsaving works in place; empty state points at the browse surface.
Steps: TDD → implement → gates → commit.

### Task 2: Review queue

**Files:** create `components/organisation/review-queue-screen.tsx`; replace stub `app/(my)/organisation/index.tsx`.
**Interfaces:** "Waiting on you" (backing pending, oldest first): title, author, kind · difficulty badges, requested-when; row → `/organisation/:tutorialId` (Task 3's screen). "Backed" group below (accepted). Focus refetch. Not-a-leader and nothing-waiting empty states. Mirror web's `dashboard/organisation/page.tsx` split exactly.
Steps: TDD → implement → gates → commit.

### Task 3: Review detail

**Files:** lift `leaderActions` into `@splat-connect/types` (web imports it from there; its web test moves/points there too); create `components/organisation/review-detail-screen.tsx`, route `app/(my)/organisation/[tutorialId].tsx`; register in the (my) layout.
**Interfaces:** photo, title, badges, description · "Check" rows (Preview the PDF via the existing signed-url flow — reuse the guides preview mechanism; parts/tools counts; STL row when assistive tech) · note field (required only for Request changes) · the action pair from `leaderActions(backing, tutorial.status)` · both actions confirm nothing but disable while busy, refetch on success, surface the API's own 4xx sentence (the `apiMessage` helper convention). Reads `GET /api/tutorials/:id` (the authed route — it serves drafts the public one 404s).
Steps: TDD (the action matrix drives the four visible-state cases; reject-without-note refused client-side AND the API's 400 surfaced) → implement → gates → commit.

### Task 4: Toy inventory + Soon cards + Admin

**Files:** create `components/organisation/inventory-screen.tsx`; replace stubs `app/(my)/organisation/toys.tsx`, `app/(my)/organisation/orders.tsx`, `app/(my)/print-requests.tsx`, `app/(my)/admin.tsx`.
**Interfaces:** Inventory = rows (name, quantity as Jersey-10 numeral, status badge) from `GET /api/toys/inventory`, grouped per org when the caller leads several; "＋ Add stock" pill; "Handed in" group IF the data distinguishes it (read the route — if not, omit and ledger). Soon = the dimmed-card treatment on both stubs. Admin = five link-out rows (web's five), each `Linking.openURL`.
Steps: TDD → implement → gates → commit ×2 (inventory; soon+admin).

### Task 5: Account audit

**Files:** whatever the audit finds, expected small: `components/profile-screen.tsx` and `components/profile/*`.
**Interfaces:** Diff the existing screens against the spec's Account entry: display-name field (PATCH profile), child rows with age + one-line ability summary or "Not set yet", step-pill row on the child editor with gap dots, Contributor terms row (accepted · version, date from `GET /api/agreements/me`), Sign out, Delete account. Close ONLY real gaps; restyling that already matches the Pixel tokens is done. Every gap closed gets its test.
Steps: audit (write the gap list to the ledger BEFORE coding) → TDD per gap → gates → commit per logical change.

### Task 6: E2E sweep and full verification

**Files:** new `tests/e2e/saved.spec.ts` (save a seeded guide from the library, see it in Saved, unsave in place), `tests/e2e/organisation.spec.ts` (seeded org + leader + pending backing → queue shows it → detail → Back this guide → moves to Backed; a pending tutorial on an accepted backing → Approve; reject requires the note). Extend helpers with `createOrgWithLeader` if none exists (read helpers first — createTutorial's `backedByOrg` may already cover most of it).
Steps: helpers → specs → kill any 3102 squatter → full gates `pnpm typecheck && pnpm test:unit && pnpm test:e2e` green → commit.

---

## Self-review notes (at write time)

- The known trap from Phase 4 repeated here on purpose: paths above are MOUNTED paths. `tutorial-orgs.ts` mounts at `/api/tutorials`; `saves.ts` at `/api/saves`; `toys.ts` at `/api/toys`.
- `leaderActions` lift touches web — same justification as `MessageBubble`: second consumer of an already-named seam. Web's import path changes in the same commit; its tests keep passing untouched otherwise.
- Deltas to surface to Byron once: (1) if `/api/saves/:slug` lacks created_at, "Recently saved" is dropped; (2) if add-toy has no org mode, Add stock routes plain; (3) if inventory data cannot distinguish "Handed in", the group is omitted.
