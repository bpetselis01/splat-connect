# Mobile Toys & Exchanges (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Toy Library tab becomes real (browse, toy detail, request block), and the owner side lands behind MY SPLAT: My toys, the toy editor with camera, offers on a toy, My exchanges, and the full exchange thread — accept with pickup address, handoff codes, confirm, messages.

**Architecture:** Reads and writes only routes web already uses; zero API/schema changes. Reuses Phase 2's primitives (`Badge`, `SaveButton`, `useSaves`, `StepPills`, `uploadFile`, `ErrorRow`) and `ShowcaseScreen` for organisation pages. The exchange thread follows the API's real protocol — richer than the approved mockup, which drew "Confirm handoff" as one tap: **accepting a person-owned toy requires a pickup address; accept mints two handoff codes; confirm requires entering the OTHER side's code; donations are confirmed by the owner only, exchanges by both.** The API is the authority (`toy-transactions.ts`), so the screens follow it; the mockup's simpler flow is superseded and Byron should hear that once.

**Tech Stack:** Expo SDK 57, expo-router 57, reanimated 4, expo-image-picker (already installed). No new dependencies — the mockup's condition *slider* is built as a 1–10 chip row instead of adding a slider library (delta noted for Byron).

**Spec:** `docs/superpowers/specs/2026-08-30-mobile-catch-up-design.md` — "Toy Library tab", "MY SPLAT modal stack" (My toys, My toy, Add a toy, My exchanges, Exchange thread), decision 6. Mockup remains the visual authority EXCEPT where this plan names an API-protocol delta.

## Global Constraints

- Package `packages/mobile`; gates `pnpm typecheck`, `pnpm test:unit`, `pnpm test:e2e` (e2e only where a task says so). Read https://docs.expo.dev/versions/v57.0.0/ before Expo-specific code. Pixel tokens only (`theme.border/shadow/radii/colors.tone/fonts.numeral`). Tests self-contained, icons mocked, output pristine.
- API contract, verbatim:
  - Public: `GET /api/public/toys` (rows `ToyWithOwner`: embeds `profiles(name)`, `organizations(name)`; `owner_org_id` set for org stock), `GET /api/public/toys/:id`, `GET /api/public/organizations` (list).
  - Mine: `GET /api/toys` (caller's own, draft+published+archived). Create: `POST /api/toys {name, condition}` → draft (`owner_org_id` only for org stock — out of scope this phase). Edit: `PATCH /api/toys/:id` allowlist `name, description, condition, switch_adapted, cover_photo_url, switch_photo_urls, offer_type` (+`quantity` org-only). Publish: `PATCH /api/toys/:id/publish`. Delete: `DELETE /api/toys/:id`. There is NO unpublish/archive route — archiving happens via completed transactions; the mockup's "Take off the shelf" button is therefore OUT until such a route exists (delta noted for Byron; do not invent API).
  - Uploads: `POST /api/upload/toy-cover` and `/api/upload/toy-switch-photo`, multipart `file` + the id field the route reads — check `readUpload(c, '<idField>')` in `upload.ts` for the exact field name (`toyId`) and the response key, and use them; `lib/upload.ts` may need a second path union or a generalised id-field parameter (smallest change wins; state it).
  - Transactions: `GET /api/toy-transactions` (mine, both sides, embeds toy/offered/owner/requester/org names, `last_message`, `blocked_by_rival_accept`; check the exact list select at `toy-transactions.ts:141-198` while implementing). `GET /api/toy-transactions/:id` → `{...tx, toy:{name,status}, offered:{name,status}|null, owner:{name}|null, requester:{name}, org:{name}|null, messages: ToyTransactionMessage[]}` with codes sanitized to the caller's own. `POST /api/toy-transactions {toy_id, type: 'donation'|'exchange', offered_toy_id?}`. `POST /:id/messages {body}`. `POST /:id/accept` — person-owner MUST send `{pickup_line1, pickup_suburb, pickup_state, pickup_postcode}` (400 without); org-owner sends `{}` (address copied from the org). `POST /:id/reject`, `/:id/withdraw` — `{}`. `POST /:id/confirm {code}` — 400 `Incorrect code`; only `accepted` status; donation = owner only (403 otherwise); each side enters the OTHER side's code.
  - `needsAction(tx, viewerId, ledOrgIds)` and `actionLabel(tx)` from `@splat-connect/types` drive every "waiting on you" marker; pass `caps.ledOrgs.map(o => o.id)` so org leaders see their queue.
- Thread code display mirrors web (`toy-transaction-thread.tsx`): `myCode = isOwner ? owner_code : requester_code`; show it when `status === 'accepted' && (type === 'exchange' || !isOwner)`; the confirm input is labelled "Enter their code". `canConfirm = accepted && (exchange || isOwner)`; after your own confirm show "Waiting on the other side".
- Copy: condition buckets exactly web's `CONDITION_LABELS`/`matchesCondition` from `packages/web/app/toy-library/toy-library-client.tsx` (good ≥7, fair 4–6, worn ≤3 — copy the labels verbatim from that file). "N available" only for org stock. Request-block copy verbatim from web's `toy-transaction-request.tsx` sentences.
- Commit per logical change with the same two trailers as Phases 1–2; never push. The controller handles landing.

---

## File map

**Create:** `components/ui/Meter.tsx`, `components/toys/toy-library-screen.tsx`, `components/toys/toy-detail-screen.tsx`, `components/toys/request-block.tsx`, `app/(tabs)/toy-library/_layout.tsx` + `index.tsx` + `[id].tsx` + `organisations.tsx` + `organisation/[id].tsx` (ShowcaseScreen reuse), `components/my-toys/list-screen.tsx`, `components/my-toys/editor.tsx`, `app/(my)/toys/[id].tsx`, `app/(my)/toys/new.tsx`, `app/(my)/toys/[id]/offers.tsx` (or a screen file — expo-router shape decided in-task), `components/exchanges/list-screen.tsx`, `components/exchanges/thread-screen.tsx`, `app/(my)/exchanges/[id].tsx`, tests per task.
**Modify:** `app/(tabs)/toy-library.tsx` → becomes the group (file deleted, directory created), `app/(my)/toys/index.tsx` (stub → list), `app/(my)/exchanges/index.tsx` (stub → list), `app/(my)/_layout.tsx` (titles for the new screens), `lib/upload.ts` (toy upload paths), e2e helpers + new specs.

---

### Task 1: Meter + the Toy Library list

**Files:** create `components/ui/Meter.tsx`, `components/toys/toy-library-screen.tsx`, `app/(tabs)/toy-library/_layout.tsx`, `app/(tabs)/toy-library/index.tsx`; delete `app/(tabs)/toy-library.tsx` (the SectionStub file — the group replaces it); tests `tests/unit/components/ui/Meter.test.tsx`, `tests/unit/components/toys/toy-library-screen.test.tsx`.

**Interfaces:**
- `Meter({ value, max = 10, width = 50 })` — the hard-edged fill bar (thin ink border, radius 2, mint fill proportional; also reused by Learn in Phase 4). Accessible: `accessibilityLabel={`${value} of ${max}`}`.
- The list mirrors `library-screen.tsx`'s skeleton: header ("Toy Library" / spec blurb) + `+ Give a toy` accent pill → `/toys/new`; compact search "Search by toy name"; chips: condition buckets │ divider │ Switch-adapted toggle; muted count "{n} toy{s}"; cards: 104px photo/placeholder, name, `Meter` + "{condition}/10 · Held by {holder}" (holder from `toyHolderName` in types), badges only when meaningful (mint "Switch-adapted"; brand "{quantity} available" for org rows), `SaveButton slug="toys"`; card a11y = label name + hint "Condition {c} of 10. Held by {holder}. Opens the toy." with badges hidden (the P2 pattern); tap → `/toy-library/[id]`. Ends with a dashed "Organisations" row → `/toy-library/organisations`. Reads `GET /api/public/toys`; filters client-side (search + `matchesCondition` + switch toggle).
- Steps: TDD (backing of P2's list tests as the template: holder line renders for person and org rows; buckets filter; save flips; org quantity badge only on org rows) → implement → `pnpm typecheck && pnpm test:unit` → commit `feat(mobile): the toy library browses for real`.

### Task 2: Organisations list + org page route under the toys tab

**Files:** create `app/(tabs)/toy-library/organisations.tsx` (list: `GET /api/public/organizations`, rows name + status-filtered to active, tap → org page) and `app/(tabs)/toy-library/organisation/[id].tsx` rendering the existing `ShowcaseScreen kind="org"`; layout entries (titles "Organisations", "Organisation").
**Interfaces:** nothing new — `ShowcaseScreen` from Phase 2 takes `kind`/`id`. The toy detail (Task 3) links holders here.
- Steps: TDD a small list test (renders org rows, taps through) → implement → gates → commit `feat(mobile): organisations behind the toy library`.

### Task 3: Toy detail + request block

**Files:** create `components/toys/toy-detail-screen.tsx`, `components/toys/request-block.tsx`, `app/(tabs)/toy-library/[id].tsx`; tests for both components.
**Interfaces:**
- Detail: horizontal photo strip (cover + switch photos, shadow-safe padding), name + `SaveButton`, holder line ("Held by {name} · {q} available" — org holders link to the org page; person holders plain text this phase), two fact tiles (Condition `Meter` + score; "Switch-adapted — Yes · 3.5mm jack / No"), description. Reads `GET /api/public/toys/:id`.
- `RequestBlock({ toy, myToys, onStarted })` — mirrors web's `toy-transaction-request.tsx` verbatim in behaviour and copy: nothing when `!toy.offer_type` ("Not currently offered…" line); the explainer sentence per offer_type; **Arrange pickup** (donation) / **Arrange exchange** buttons; exchange expands the inline chooser of the caller's PUBLISHED toys (radio rows: emoji-less photo, name, condition; from `GET /api/toys` filtered `status==='published' && !archived_at`); no published toys → web's "Add a toy to My Toys before you can offer an exchange." error; Start exchange disabled until one chosen; either button `POST /api/toy-transactions` then `router.push('/exchanges/' + tx.id)`. The owner viewing their own toy gets no request block (compare `caps.profile.id`/led orgs against the owner columns).
- Steps: TDD (offer-type gating of buttons; chooser lists only published; POST body `{toy_id, type, offered_toy_id?}`; owner sees no block) → implement → gates → commit `feat(mobile): toy detail with the request block`.

### Task 4: My toys list + Add a toy

**Files:** `app/(my)/toys/index.tsx` (stub → `components/my-toys/list-screen.tsx`), `app/(my)/toys/new.tsx`, layout titles; tests.
**Interfaces:**
- List: `GET /api/toys` + `GET /api/toy-transactions` (owner-side `requested` count per toy_id → the apricot "waiting" count in `theme.fonts.numeral` on the card); active rows (Meter + offer line "Offered as {donation/exchange/both}" or "Not offered yet", status `Badge`), then an "Archived · handed over" group (dimmed; tap → editor route which renders the read-only record). Tap → `/toys/[id]`. `+ Add a toy` pill → `/toys/new`. Refetch on focus (P2 pattern).
- Add a toy: name field + condition chip row (1–10; the mockup drew a slider — chips avoid a dependency, delta noted) → `POST /api/toys {name, condition}` → `router.replace('/toys/' + id)`.
- Steps: TDD → implement → gates → commit ×2 (`feat(mobile): my toys list with waiting counts`, `feat(mobile): add a toy in two fields`).

### Task 5: The toy editor (and the archived record)

**Files:** `components/my-toys/editor.tsx`, `app/(my)/toys/[id].tsx`; extend `lib/upload.ts` for the two toy upload routes (check `upload.ts`'s `readUpload` id-field name and response key; smallest change that keeps the P2 photo/pdf/stl paths working); tests.
**Interfaces:**
- Port `getMissingToyFields` + `computeToyStepStatuses` from `web/lib/toy-steps.ts` verbatim (same porting rule as P2's `getMissingFields`).
- `StepPills` Details · Photos · Review. Details: name, description, condition chips 1–10 with the "needs repair / like new" end labels, Switch-adapted toggle (RN `Switch` is fine — native control, Pixel-tinted via `trackColor`/`thumbColor` tokens) → Save → `PATCH /api/toys/:id` (those four keys; toys carry no updated_at concurrency token — confirm by reading the PATCH route and state it). Photos: cover tile + (when switch_adapted) switch tile(s); Take a photo / Choose from library → upload → `PATCH {cover_photo_url}` / `PATCH {switch_photo_urls: [...existing, url]}`. Review: offer chips Donation/Exchange/Both → `PATCH {offer_type}`; the gap list; **Publish to the Toy Library** (`PATCH /:id/publish`, disabled while gaps) or "✓ Published · in the Toy Library"; an offers row when any owner-side `requested` transactions exist ("N offers on this toy · Waiting on you" → `/exchanges?toy=` — Task 6's list accepts an optional toy filter param); footer **Delete toy** (Alert confirm → DELETE → back). **No "Take off the shelf"** — no API for it; render nothing (delta for Byron).
- Archived toys (`archived_at` set): read-only record instead of the editor — name, "Handed to {counterparty} on {date}" derived from the completed transaction if the list embeds it (else just the archive date), offered-as and condition rows, "View the exchange thread" link when the completed tx id is known (from `GET /api/toy-transactions` filtered by toy). Degrade gracefully when not found.
- Steps: TDD (gap statuses; publish gating; PATCH bodies; switch-photo append) → implement → gates → commit `feat(mobile): the toy editor — details, photos, review and publish`.

### Task 6: My exchanges list

**Files:** `app/(my)/exchanges/index.tsx` (stub → `components/exchanges/list-screen.tsx`); tests.
**Interfaces:** `GET /api/toy-transactions`; split `['requested','accepted']` = Active, rest = History (web's exact rule); rows: toy name (+ "⇄ {offered}" for exchanges), "with {counterparty name}", status `Badge`, and when `needsAction(tx, viewerId, ledOrgIds)` the apricot treatment + `actionLabel(tx)` line; `blocked_by_rival_accept` rows render web's equivalent note (read web's list row for the exact copy and mirror). Optional `?toy=` filter (from Task 5's offers row) narrows to that toy with a small header chip "Offers on {toy} ✕". Tap → `/exchanges/[id]`. Refetch on focus. Counterparty naming: owner side sees requester name; requester side sees owner/org name (the embeds carry all three).
- Steps: TDD (split, needsAction marking with led orgs, toy filter) → implement → gates → commit `feat(mobile): my exchanges, waiting-on-you first`.

### Task 7: The exchange thread

**Files:** `components/exchanges/thread-screen.tsx`, `app/(my)/exchanges/[id].tsx`, layout title; tests.
**Interfaces (the API protocol, not the mockup's shorthand):**
- Header swap card: toy ⇄ offered (or → "You collect" / "{requester} collects"), status `Badge`, "Waiting on …" line from `needsAction`/`actionLabel` + counterpart names.
- When `accepted`: pickup address block (the four fields joined, only when present), and **Your handoff code: {myCode}** per the `showMyCode` rule, styled `theme.fonts.numeral`.
- Messages: system messages centred/dashed, own messages tinted right, others left; composer (`POST /:id/messages`); poll `GET /:id` every 10s while focused (`useFocusEffect` + interval; clear on blur).
- Footer by state and side: requested+owner → **Accept** / **Decline**; person-owner Accept first opens the pickup-address form (four fields, all required — web's `AcceptPickupDialog` equivalent as an inline expanding section, not a Modal); org-owner Accept posts `{}` directly with web's explainer copy. requested+requester → **Withdraw request**. accepted+canConfirm(!alreadyConfirmed) → code input ("Enter their code") + **Confirm handoff**; wrong code shows the API's "Incorrect code" via ErrorRow; after own confirm → "Waiting on the other side to confirm". completed → system record only. Donation+requester in accepted: no confirm control (owner-only), but their code IS shown for reading out.
- Every action updates local state from the response; failures via ErrorRow.
- Steps: TDD the state matrix (owner-requested, requester-requested, accepted person-owner pre/post confirm, donation asymmetry, wrong code) — this is the task's heart; then implement → gates → commit `feat(mobile): the exchange thread — accept, codes, confirm and messages`.

### Task 8: E2E sweep and full verification

**Files:** extend `tests/e2e/helpers.ts` (a `createPublishedToy(ownerId, overrides)` admin fixture; defaults off), new `tests/e2e/toy-library.spec.ts`, `tests/e2e/exchanges.spec.ts`; full gates.
- Library spec: browse renders holder lines/badges; buckets filter; save flips (POST-awaited, the P2 lesson); detail's request block gates by offer_type.
- Exchanges spec: the full happy path person-to-person — user A publishes a toy (fixture), user B requests pickup, A accepts with an address, both codes flow (read A's code via the API admin client — the UI hides the other side's), B's side confirms nothing for donation, A confirms with B's code, status completes, the toy archives (assert it leaves `/toy-library` and shows archived in A's My toys). Plus: withdraw path; exchange-type offer via the chooser.
- Maestro untouched. Kill any 3102 squatter first (controller restarts).
- Full gates at the end: `pnpm typecheck && pnpm test:unit && pnpm test:e2e` all green.
- Commit `test(mobile): e2e walks the toy library and a full exchange`.

---

## Self-review notes (at write time)

- Spec decision 6 honoured: accept/decline never on the toy page — the editor's Review shows a count row that routes to the filtered exchanges list; actions live only in the thread.
- Protocol deltas from the approved mockup, to surface to Byron once: (1) confirm requires entering the other side's handoff code (API contract; mockup drew one tap); (2) accepting a person-owned toy collects a pickup address; (3) no "Take off the shelf" (no API); (4) condition is a 1–10 chip row, not a slider (no new dependency).
- Cross-task: `Meter` (T1) reused in T3/T4/T5; `RequestBlock` consumes `GET /api/toys` same as T4's list; T5's offers row → T6's `?toy=` param; `needsAction`/`actionLabel` used in T6+T7 with `ledOrgs` ids.
- Known discovery points named in-task: the toy upload id-field/response key (T5), the toys PATCH concurrency posture (T5), the exchanges list embed shape + rival-accept copy (T6), archive linkage for the record (T5).
