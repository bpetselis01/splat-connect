# Journey coverage (web + mobile) — Implementation Plan

**Date:** 2026-10-20
**Requirements:** `docs/plans/journey-coverage-requirements.md` (R1–R18)
**Sources:** `docs/testing/web-journeys-inventory-public-2026-10-20.md`, `docs/testing/web-journeys-inventory-dashboard-admin-2026-10-20.md`, `docs/testing/web-test-inventory-2026-10-20.md`, `docs/testing/mobile-journeys-audit-2026-10-20.md`

## Architecture

One map, one checker, two ratchets.

```
scripts/journeys/journeys.json      rows: id, platform, route, kind, seat, screen, element,
                                    api, db, notifies, counts, setter, required, waived?
scripts/journeys/lib.mjs            LAYERS (6), parseTags (per-test titles + file opt-out),
                                    coverage(), lintRequired() (R8), routeTripwire() (R4), renderDoc()
scripts/journeys/check.mjs          CI entry: gaps, unknown ids, malformed, stale doc, lint, tripwire
scripts/journeys/render.mjs         writes docs/testing/journeys.md
scripts/journeys/legacy-file-tags.json   ratchet A: files still on file-level tags (shrinks to [])
scripts/journeys/routes-without-journeys.json  ratchet B: routes with no row, each with a reason (shrinks to the real opt-outs)
```

A journey id is `[A-Z]\d{2}` (mobile, unchanged) or `W[A-Z]\d{2}` (web). A test case claims a journey by putting the id first in its title: `test('WD03 accept a build request', …)`, `it('G09 …')`, Maestro `name: "A14 deep link cold start"`. A file-level `// journeys: (none — reason)` opts a file out. The checker reads titles with one regex per runner (`(test|it)\(\s*['"\`]`, `name:` for YAML); it never executes tests.

Layers: `web-unit` (`packages/web/tests/unit/**/*.test.{ts,tsx}`), `web-e2e` (`packages/web/tests/e2e/**/*.spec.ts`), `mobile-unit`, `mobile-e2e`, `api` (`packages/api/tests/**/*.test.ts`, shared by platform), `device` (`packages/mobile/.maestro/flows/*.yaml`). A row's `platform` decides which unit/e2e layers its `required` may name.

Row `kind` drives the R8 lint: `static` → unit; `nav` → unit + e2e; `write` → unit + e2e + api; `notifies`/`counts` non-empty → api required; `device: true` → device required.

Both ratchets start full (every tagged file is legacy; every route without a row is listed) so CI stays green from Unit 1, and each later unit shrinks them. The final unit deletes the ratchets and the legacy parser.

Seat vocabulary: anon, P (Member), L (org leader), A (admin). Content vocabulary per `CONTEXT.md` (Guide, Toy, Exchange: Gift/Swap/Build/Print, Idea/Challenge, Member/Family/Maker).

## Dependency graph

```
U1 → U2 → U3 → U4 ─┬→ U8 (mobile rebase) → U9a, U9b, U9c, U10, U11
                   ├→ U12 … U19 (web groups, independent of each other)
                   ├→ U21 (verify-plan)
U5a, U5b, U6, U7 (api + register) have no dependencies
U12…U19 + U9* → U20 (notifications & counts matrix) → U22 (CI budget) → U23 (close ratchets)
```

Branch `journey-coverage` off `development`. One commit per fix (a row set, a spec, a ratchet shrink), never one per unit.

---

### Unit 1: One map for both platforms

**Goal:** Move the map out of the mobile package, give every row a `platform`, `route` and `kind`, and split the layers so a web row can be required at web layers.

**Requirements trace:** R1, R5, R18

**Dependencies:** none

**Files:**
- `scripts/journeys/journeys.json` — moved from `packages/mobile/tests/journeys.json`; every row gains `platform: "mobile"`, `route` (its `packages/mobile/app` path, e.g. `(my)/toys/[id]/index`), `kind` (`static` | `nav` | `write`)
- `scripts/journeys/lib.mjs` — `LAYERS` becomes the six above; `coverage()` checks `required` names only layers legal for the row's platform (plus `api`, `device`)
- `scripts/journeys/check.mjs`, `scripts/journeys/render.mjs` — new paths; doc renders grouped by platform then screen
- `scripts/journeys/check.test.mjs` — tests for the platform/layer rule and the new doc shape
- `docs/testing/journeys.md` — replaces `docs/testing/mobile-journeys.md` (deleted)
- `docs/testing/journey-coverage-rule.md` — the R6 rule: what "covered" means per layer, with one good and one bad example per layer
- `CLAUDE.md` — the testing paragraph points at the rule and `pnpm test:journeys`

**Approach:** Mechanical move; `required` values are rewritten `unit→mobile-unit`, `e2e→mobile-e2e` by a one-off node script run once and discarded. `route` for the 253 rows is filled from the inventory table in `docs/testing/mobile-journeys-inventory-2026-10-07.md` (section 1 maps screen → route). `kind` is set by rule: rows with `api` non-empty and a verb (post/patch/delete) → `write`; navigation-only → `nav`; prose/legal → `static`. The rule doc is short: three paragraphs and six examples.

**Patterns:** `check.test.mjs` already tests `parseTags`/`coverage` with inline fixtures; extend the same way. The pending registry (`packages/types/src/pending.ts` + `scripts/pending.mjs`) is the precedent for data + generated doc + drift test.

**Test scenarios:**
- [ ] Happy path: `pnpm test:journeys` passes with 253 rows, 0 gaps, 1 waiver, identical cells to before the move
- [ ] Nil/empty: a row with no `platform` fails the checker with the row id
- [ ] Error path: a mobile row requiring `web-e2e` fails with "layer not legal for platform"
- [ ] Edge case: `render.mjs --write` output is byte-stable across two runs (sorted by platform, then id)

**Verification:** CI `check` job green; `docs/testing/journeys.md` exists, `mobile-journeys.md` is gone; `git grep "packages/mobile/tests/journeys.json"` returns nothing.

**Planning-time unknowns:** none.

---

### Unit 2: Tags bind to test cases

**Goal:** A journey is covered at a layer only when a test case title carries its id; file-level tags survive only on a shrinking legacy list.

**Requirements trace:** R7

**Dependencies:** U1

**Files:**
- `scripts/journeys/lib.mjs` — `parseTitles(text, runner)` for vitest/jest (`(test|it)\(`), Playwright (`test(`), Maestro (`name:`); `parseTags` keeps the file-level line but only for files in the legacy list or with a `(none — …)` opt-out
- `scripts/journeys/legacy-file-tags.json` — generated once: every file that carries a `journeys:` line today (≈ 480 across four layers)
- `scripts/journeys/check.mjs` — a file-level tag on a file NOT in the legacy list is "malformed: file-level tag; put the id in the test title"
- `scripts/journeys/check.test.mjs` — title parsing for each runner, legacy-list behaviour, id regex `^W?[A-Z]\d{2}$`

**Approach:** Title regex per runner, first token of the title must be the id (`'WD03 …'`); several ids allowed space-separated before the first lowercase word (`'G09 G10 thank and note'`). Describe blocks do not count (too coarse). The legacy list is written by a throwaway script and committed; from then on it only shrinks.

**Patterns:** `route-coverage.test.ts` UNTESTED ratchet: a list that predates the guard, "when one gains a test, delete it from the list (the second test insists)". Copy its two-test shape: one test that the list is honoured, one that every entry is still needed.

**Test scenarios:**
- [ ] Happy path: `test('WD03 accepts', …)` covers WD03 at `web-e2e`
- [ ] Nil/empty: a title with no id contributes nothing and is not an error
- [ ] Error path: a new file with `// journeys: A01` and no legacy entry → malformed
- [ ] Edge case: a legacy entry for a file whose file-level tag has been removed → "stale legacy entry, delete it"

**Verification:** `pnpm test:journeys` still 0 gaps (legacy list keeps every cell green); the checker reports "legacy file-level tags: N files" on every run.

**Planning-time unknowns:** none.

---

### Unit 3: Route tripwire

**Goal:** A route on either platform without a journey row fails CI, unless it is in a reasoned opt-out list.

**Requirements trace:** R4

**Dependencies:** U1

**Files:**
- `scripts/journeys/lib.mjs` — `routeTripwire(rows, routes, optOuts)`; route discovery: `packages/web/app/**/page.tsx` → `/path/[param]` (strip `(group)` segments); `packages/mobile/app/**/*.tsx` → `(group)/path/[param]` (skip `_layout.tsx`)
- `scripts/journeys/routes-without-journeys.json` — `{ "route": "reason" }`; generated once with every web route (134) and every mobile route with no `route` match, reason `"not yet inventoried (journey-coverage plan)"`
- `scripts/journeys/check.mjs` — prints the tripwire count; fails on a route with no row and no entry, and on an entry whose route no longer exists
- `scripts/journeys/check.test.mjs`

**Approach:** Same two-test ratchet shape as U2. Permanent opt-outs get a real reason (`/design-system`, `/design-system/states`: "internal gallery"; pure redirects such as `index.tsx → /home`).

**Patterns:** `scripts/parity` app-map drift test already enumerates mobile routes; reuse its route-listing function if it is importable, otherwise copy its glob.

**Test scenarios:**
- [ ] Happy path: every route either has a row or an entry → pass
- [ ] Nil/empty: an `app/` with no page files → 0 routes, pass
- [ ] Error path: new `packages/web/app/foo/page.tsx` with no row → fails naming `/foo`
- [ ] Edge case: route group `(course)` is stripped so `/learn/(course)/handover` matches a row for `/learn/handover`

**Verification:** adding an empty `page.tsx` locally makes `pnpm test:journeys` fail; removing it passes.

**Planning-time unknowns:** none.

---

### Unit 4: Required-layer lint

**Goal:** `required` can no longer be under-set by hand.

**Requirements trace:** R8, R13

**Dependencies:** U1

**Files:**
- `scripts/journeys/lib.mjs` — `lintRequired(row)` returns violations: `kind` vs minimum layers; `notifies`/`counts` ⇒ `api`; `device: true` ⇒ `device`; a `waived` entry must have `reason` and `date` (`YYYY-MM-DD`)
- `scripts/journeys/journeys.json` — Q18, Q19, C14 get `api` in `required` (the audit's under-required rows); the A03 waiver gains a date
- `scripts/journeys/check.mjs`, `check.test.mjs`

**Approach:** Lint runs before coverage; a violation is a failure with the row id and the rule. Waivers are listed on every run (already) and in the doc.

**Patterns:** existing `coverage()` returns `{gaps, unknown, waived}`; lint returns the same shape of list.

**Test scenarios:**
- [ ] Happy path: a `write` row with `mobile-unit, mobile-e2e, api` passes
- [ ] Nil/empty: `notifies: []` imposes nothing
- [ ] Error path: `notifies: ["toy_rejected"]` with no `api` in `required` → violation
- [ ] Edge case: a waiver without a date → violation

**Verification:** after the three row edits, `pnpm test:journeys` shows exactly 3 new gaps (Q18, Q19, C14 at `api`) — those are closed in U9b.

**Planning-time unknowns:** none.

---

### Unit 5a: API ratchet matches method + path; the four hidden routes

**Goal:** The ratchet stops hiding routes, and the four it hid get integration tests.

**Requirements trace:** R10

**Dependencies:** none

**Files:**
- `packages/api/tests/unit/route-coverage.test.ts` — `mentioned()` requires the method token within 2 lines before the path (`app.request(path, { method })` or a helper like `patch(path)`); `UNTESTED` gains the four hidden entries at the same time, so the test stays green, then each is removed as its test lands
- `packages/api/tests/integration/tutorials/stl-files.test.ts` — `POST` and `DELETE /api/tutorials/:id/stl-files`: owner uploads and removes, non-owner 403, approved guide flips to pending or not per the editor rule (asserts current behaviour; Q8 decides the rule)
- `packages/api/tests/integration/admin/organization-requests.test.ts` — `GET` lists pending requests, non-admin 403
- `packages/api/tests/integration/contributors/thanks-list.test.ts` — `GET /api/contributors/me/thanks` lists own notes with hidden flag

**Approach:** Read how existing integration tests call routes (`app.request`, helpers in `tests/helpers`) before touching `mentioned()`; the regex must match every form already used or the ratchet reports false negatives. Add a unit test for `mentioned()` itself with three call forms.

**Patterns:** `tests/integration/handoffs/*.test.ts` for through-the-API tests with service-role seeds and explicit cleanup.

**Test scenarios:**
- [ ] Happy path: each route's owner/admin call returns 2xx and the row or file exists afterwards
- [ ] Nil/empty: `GET …/thanks` with no notes → `[]`
- [ ] Error path: wrong seat → 403; unknown id → 404
- [ ] Edge case: `mentioned()` does not count `GET /x` as covering `DELETE /x`

**Verification:** `pnpm --filter @splat-connect/api test` green; `UNTESTED` has 9 entries (the original nine), none of the four.

**Planning-time unknowns:** none.

---

### Unit 5b: Empty the API ratchet

**Goal:** The nine routes listed since 2026-10-08 get integration tests; `UNTESTED` becomes empty and the second test insists it stays so.

**Requirements trace:** R10

**Dependencies:** U5a

**Files:**
- `packages/api/tests/integration/public/tutorial-stats.test.ts` — `GET /api/public/tutorials/stats`
- `packages/api/tests/integration/public/makers.test.ts` — `GET /api/public/makers/:id`
- `packages/api/tests/integration/admin/contributors-delete.test.ts` — `DELETE /api/admin/contributors/:id` (sole-leader 409 included)
- `packages/api/tests/integration/admin/queues-lists.test.ts` — `GET /api/admin/build-requests`, `GET /api/admin/print-jobs`
- `packages/api/tests/integration/toys/publish.test.ts` — `PATCH /api/toys/:id/publish`
- `packages/api/tests/integration/orgs/pickup.test.ts` — `GET`/`PATCH /api/organizations/:id/pickup`
- `packages/api/tests/integration/exchanges/receipt.test.ts` — `POST /api/exchange-costs/:transactionId/receipt`
- `packages/api/tests/unit/route-coverage.test.ts` — `UNTESTED = new Set()`

**Approach:** One commit per route. Each test goes through the real seat (admin token for admin routes) and asserts the DB effect, not just the status.

**Patterns:** as U5a.

**Test scenarios:**
- [ ] Happy path per route
- [ ] Nil/empty: stats with zero guides → zeros; makers/:id unknown → 404
- [ ] Error path: non-admin on admin routes → 403; publish a toy you don't own → 403
- [ ] Edge case: receipt upload rejects a non-image MIME (`PHOTO_MIME`)

**Verification:** `route-coverage.test.ts` passes with an empty set and fails if any route loses its test.

**Planning-time unknowns:** none.

---

### Unit 6: `website_url` scheme check

**Goal:** A leader cannot store a `javascript:` URL that the public page renders as a link.

**Requirements trace:** R15

**Dependencies:** none

**Files:**
- `packages/api/src/routes/organizations.ts` — in `PATCH /:id/profile`, reject `website_url` unless `/^https?:\/\//i` (400 with `fieldError('website_url', …)`)
- `packages/api/tests/integration/orgs/org-profile-social.test.ts` — two cases: `javascript:alert(1)` → 400; `https://example.org` → 200
- `packages/web/components/org-profile-form.tsx` — `type="url"` + placeholder `https://…` (client hint only)

**Approach:** API is the trust boundary; the web hint is cosmetic. Mobile's org-edit screen sends the same route, so one fix covers both.

**Patterns:** `fieldError` helper already used by the route file for per-field 400s.

**Test scenarios:**
- [ ] Happy path: https URL saved and rendered
- [ ] Nil/empty: empty string clears the field (allowed)
- [ ] Error path: `javascript:` → 400 with the field named
- [ ] Edge case: `HTTPS://` upper-case accepted

**Verification:** integration test green; manual: public org page link has an `https` href.

**Planning-time unknowns:** none.

---

### Unit 7: Bug register

**Goal:** Every product bug from the audit is a `pending.ts` decision with a question for Byron; none is silently forgotten.

**Requirements trace:** R16

**Dependencies:** none

**Files:**
- `packages/types/src/pending.ts` — 16 entries, `kind: 'decision'`, one per Outstanding Question Q1–Q16 in the requirements doc; `platforms` per item; `question` is the text from the doc
- `docs/PENDING.md` — regenerated (`node scripts/pending.mjs`)
- `packages/api/tests/unit/pending-features.test.ts` — unchanged, must stay green

**Approach:** No `PENDING(...)` code references for decisions that have no code site yet; the drift test allows entries without references for `kind: 'decision'` (check this before writing; if it does not, add the smallest allowance with a test).

**Patterns:** existing `decision` entries in `pending.ts` (the 27 answered on 2026-09-30).

**Test scenarios:**
- [ ] Happy path: `node scripts/pending.mjs --check` passes
- [ ] Nil/empty: an entry without `question` for `kind: 'decision'` fails the drift test
- [ ] Error path: a duplicate key fails
- [ ] Edge case: `docs/PENDING.md` lists the 16 under Decisions

**Verification:** drift test green; `docs/PENDING.md` diff shows exactly 16 new rows.

**Planning-time unknowns:** none.

---

### Unit 8: Mobile map re-based on HEAD

**Goal:** The mobile side of the map describes the app as it is today.

**Requirements trace:** R3, R4

**Dependencies:** U1, U3, U4

**Files:**
- `scripts/journeys/journeys.json` — new rows for the 17 items in the audit's Part A table (events detail/register/print, organiser's registrations list + part queue, event/story edit, acting-org switcher, admin accounts/organisations/ideas/member-reports/idea-reports/spot-check, My reports, thank-you notes, collaborators, report-participant, org edit sub-sections); Q17 and T20 rewritten; T12, L19, Q06 and the other partial rows rewritten; every mobile row's `route` filled so the tripwire matches
- `scripts/journeys/routes-without-journeys.json` — mobile entries removed as rows land
- `packages/mobile/tests/unit/**` — the existing untagged tests for admin/*, events/*, me/*, acting-org-switcher, event-registrations get ids in their test titles where they already assert the outcome (per the rule doc)

**Approach:** Work screen by screen from the audit table and the parity plan's unit list; read the screen component for each row (element → handler → API → notifies → counts) rather than copying the parity plan's intent. Expect ≈ 60–80 new rows (the admin queues alone have approve/reject/remove/dismiss/reinstate/unpublish). After tagging, run the checker: the printed gap list is U9's work list.

**Patterns:** rows A01–Z04 as written; the decisions doc's "setter" discipline.

**Test scenarios:**
- [ ] Happy path: checker lint passes for every new row
- [ ] Nil/empty: no mobile route remains in the opt-out list except reasoned permanent ones
- [ ] Error path: a new row naming an API path that does not exist in `packages/api/src` → caught by a new `apiPathsExist` check in `lib.mjs` (small; the audit's `stale.mjs` did this by hand)
- [ ] Edge case: Q17 now says "push `card.route`", with `kind: nav`

**Verification:** `pnpm test:journeys` reports N gaps (expected, non-zero) all on the new rows; the tripwire has 0 mobile entries left without a reason.

**Planning-time unknowns:** Deferred to Planning — exact row count; the checker tells us.

---

### Unit 9a: Mobile gaps — events and organisation

**Goal:** Outcome tests for event detail, register, print-at-event, the organiser's registrations list, event/story edit, the acting-org switcher and the org-edit sub-sections.

**Requirements trace:** R6, R9

**Dependencies:** U8

**Files:**
- `packages/mobile/tests/e2e/events-detail.spec.ts`, `events-register.spec.ts`, `events-print.spec.ts` — new
- `packages/mobile/tests/e2e/organisation-events.spec.ts` — registrations list, part queue, edit event/story
- `packages/mobile/tests/e2e/me-acting-org.spec.ts` — switch org, leader screens follow
- `packages/mobile/tests/e2e/organisation-edit.spec.ts` — pictures, doors, rates, offers, capabilities, recycling sections
- `packages/mobile/tests/unit/components/events/*.test.tsx`, `organisation/*.test.tsx` — add outcome assertions where the existing tests only render
- `packages/api/tests/integration/events/registrations.test.ts` — extend: register → `org_event_*` notifications, capacity 409, organiser list

**Approach:** One spec per screen, each `test` titled with its ids. Use `helpers.ts` (`createContributor`, `createTutorial`, `createChallenge`, `createNotification`) and add `createEvent`/`createOrg` helpers if missing (check first). E2E asserts the visible result: the "You're going" state, the registrant appearing in the organiser list, the edited title on the org profile.

**Patterns:** `org-publish.spec.ts` for leader-seat e2e; `handoffs/events-mine.test.ts` for the API side.

**Test scenarios:**
- [ ] Happy path: register → appears in My events and the organiser's list
- [ ] Nil/empty: event with no questions shows no question step
- [ ] Error path: full event → 409 copy shown, no registration row
- [ ] Edge case: switching acting org changes which registrations list the leader sees

**Verification:** checker gaps for V*, L* and the new event/org ids are 0.

**Planning-time unknowns:** Deferred — whether `createEvent` exists in `helpers.ts`.

---

### Unit 9b: Mobile gaps — admin queues

**Goal:** Outcome tests for the six phone admin queues and the three under-required rows.

**Requirements trace:** R6, R9

**Dependencies:** U8

**Files:**
- `packages/mobile/tests/e2e/admin-accounts.spec.ts`, `admin-organisations.spec.ts`, `admin-ideas.spec.ts`, `admin-member-reports.spec.ts`, `admin-idea-reports.spec.ts`, `admin-spot-check.spec.ts` — new; existing `admin-guide-review` stays
- `packages/mobile/tests/unit/components/admin/*.test.tsx` — ids in titles; outcome assertions (handler called with id + status)
- `packages/api/tests/integration/admin/*.test.ts` — Q18, Q19, C14 status PATCHes asserted (row updated, notification to the author)

**Approach:** Admin seat via `createAdmin` (add to `helpers.ts` if the mobile helper lacks it; the web one has it). Each queue spec: seed one item, act, assert the item leaves the queue and the count card on `/admin` drops by one (the count assertion is R11's action-then-count form).

**Patterns:** `admin-guide-review` e2e; `admin/queues.test.ts` on the API.

**Test scenarios:**
- [ ] Happy path: approve an idea → leaves queue, author notified, count −1
- [ ] Nil/empty: empty queue shows the empty state
- [ ] Error path: non-admin opening `(my)/admin/*` is bounced (the inventory noted no screen guard; the test documents current behaviour and the plan registers a decision if it is wrong)
- [ ] Edge case: reinstate after remove restores the participant

**Verification:** checker gaps for Q18, Q19, C14 and the six new admin groups are 0.

**Planning-time unknowns:** Deferred — whether `(my)/admin` needs a screen guard (Q11-adjacent; register if missing).

---

### Unit 9c: Mobile gaps — reports, thanks, collaborators, report-a-person

**Goal:** Outcome tests for My reports (+ `report_resolved`), thank-you notes Hide/Show, guide collaborators invite/remove/leave, report a challenge participant.

**Requirements trace:** R6, R9, R11

**Dependencies:** U8

**Files:**
- `packages/mobile/tests/e2e/me-reports.spec.ts`, `me-thanks.spec.ts`, `guides-collaborators.spec.ts`, `challenges-report-participant.spec.ts` — new
- `packages/mobile/tests/unit/components/{reports,thanks,my-tutorials,challenges}/*.test.tsx` — ids + outcome assertions
- `packages/api/tests/integration/{reports,contributors,tutorials,ideas}/*.test.ts` — `report_resolved`, thanks hide/show, collaborator invite notification, participant report row

**Approach:** As U9a. The `report_resolved` path needs an admin resolve in the seed step (service role insert of the notification is acceptable for the e2e; the API test proves the resolve route creates it).

**Patterns:** `handoffs/admin-actions.test.ts` (web action → phone endpoints).

**Test scenarios:**
- [ ] Happy path: resolve → reporter's My reports shows "resolved" and the inbox row
- [ ] Nil/empty: no thanks notes → empty state
- [ ] Error path: inviting a collaborator who is already one → 409 copy
- [ ] Edge case: hiding a note removes it from the public profile but not from the list

**Verification:** checker gaps for the four groups are 0.

**Planning-time unknowns:** none.

---

### Unit 10: Mobile tag migration and loose-tag fixes

**Goal:** Every mobile unit/e2e/api file moves from file-level to per-test tags; the 2 WRONG and ~9 loose tags are fixed; the legacy list loses its mobile and api entries.

**Requirements trace:** R7, R9

**Dependencies:** U2, U8

**Files:**
- `packages/mobile/tests/unit/**/*.test.tsx` (≈ 95 tagged files), `packages/mobile/tests/e2e/*.spec.ts` (85), `packages/api/tests/**/*.test.ts` (tagged subset), `packages/mobile/.maestro/flows/*.yaml` (13) — ids moved into test titles / `name:`
- `scripts/journeys/legacy-file-tags.json` — entries removed file by file
- `packages/mobile/tests/unit/components/guides/detail-screen.test.tsx` — gains G09, G10 (the real Thank tests live here); the two wrongly tagged files lose them

**Approach:** Start with the 26 fan-out files (`guides-authoring-edges` 13 ids, `auth` 12, `printing` 9, …): for each id, find the test case that asserts its outcome and put the id in that title; an id with no such case becomes a gap (then closed in place). Then the rest, one commit per file or per directory. Use the audit's B2 table as the first 50 answers.

**Patterns:** none new.

**Test scenarios:**
- [ ] Happy path: after a file migrates, its cells stay ✅ and it leaves the legacy list
- [ ] Nil/empty: a file whose tests cover none of its old ids is left untagged and its cells become gaps (expected)
- [ ] Error path: an id in a title that is not in the map → "unknown id" (catches typos)
- [ ] Edge case: a Maestro flow `name:` with two ids

**Verification:** `legacy-file-tags.json` contains only web files; a fresh 50-row sample (same method as the audit) scores ≥ 48 OUTCOME per layer.

**Planning-time unknowns:** none.

---

### Unit 11: Android Maestro as a PR check

**Goal:** The 13 device journeys run on an emulator in CI for every PR that touches `packages/mobile/**` or `packages/types/**`.

**Requirements trace:** R12

**Dependencies:** U8 (flow `name:` ids), U10

**Files:**
- `.github/workflows/ci.yml` — new job `maestro-android` after `mobile-e2e`, `needs: [changes]`, `if: needs.changes.outputs.mobile == 'true'`, no `continue-on-error`, `timeout-minutes: 45`
- `.github/workflows/maestro-android.yml` — deleted (content moves into `ci.yml`)
- `packages/mobile/.maestro/flows/*.yaml` — `name:` with ids; the four flows never run anywhere (`feedback-sheet-post`, `note-report`, `inbox-badge-live`, `deep-link-cold-start`) fixed until they pass on the emulator
- `packages/mobile/package.json` — `device:fixture` / `device:test` scripts confirmed to work headless
- `docs/testing/journey-coverage-rule.md` — device paragraph: a device cell counts only for flows in this job

**Approach:** Run the proposed workflow by hand first (it has never run). Fix in this order: emulator boots → Release build installs → `device:fixture` seeds → `every-tab-renders` passes → the other 12. Cache the Gradle and AVD layers (`reactivecircus/android-emulator-runner` AVD snapshot) so steady-state is under 25 min. Byron's memory notes iOS gotchas; Android is immune to the stale-prebuild issue.

**Patterns:** `mobile-e2e` job for Supabase start/stop and artifact upload.

**Test scenarios:**
- [ ] Happy path: a mobile-only PR runs the job and it passes
- [ ] Nil/empty: a web-only PR skips the job
- [ ] Error path: a broken flow fails the PR check (not `continue-on-error`)
- [ ] Edge case: Supabase is stopped in `always()` even when flows fail

**Verification:** job green on `journey-coverage`; branch protection on `development` lists it as required (Byron sets this in GitHub; the plan cannot).

**Planning-time unknowns:** Resolve Before Planning — none; Deferred — emulator runtime on the free runner (if > 45 min, drop to API 30 image and 2 flows per shard).

---

### Unit 12: Web — chrome, auth, gates, onboarding, legal

**Goal:** Rows and outcome tests for `middleware.ts`, header/footer/dock, `/login`, `/signup`, `/auth/confirmed`, `/onboarding/*`, `/delete-account`, `/legal/*`, `/terms`, `/privacy`, `/code-of-conduct`, `/safety`, `/not-built/[id]`.

**Requirements trace:** R2, R4, R6, R9

**Dependencies:** U1–U4

**Files:**
- `scripts/journeys/journeys.json` — ≈ 49 rows (`WC`, `WA`, `WO`, `WL` prefixes) from the public inventory sections CHR, MW, AUTH, ONB, LEGAL, MISC, each read against code
- `scripts/journeys/routes-without-journeys.json` — these routes removed
- `packages/web/tests/e2e/auth/*.spec.ts` (6 files) — ids in titles; render-only tests upgraded to assert the redirect target / the signed-in state / the terms gate
- `packages/web/tests/e2e/public/navigation.spec.ts`, `footer.spec.ts` — ids; nav rows are `nav` kind
- `packages/web/tests/unit/components/{nav,footer,dock}*.test.tsx` — ids + handler assertions
- `packages/web/tests/unit/app/middleware.test.ts` — new: terms list, return-path behaviour as it is (documents Q3/Q4; does not fix)

**Approach:** Transcribe section by section; a row is committed only after its element and handler are read in the component. Static legal pages are `kind: static`, unit only (one render test each, ids in titles).

**Patterns:** `tests/e2e/helpers.ts` (`createContributor`, `createAdmin`, `signIn`, `acceptTerms`).

**Test scenarios:**
- [ ] Happy path: signup → "Check your email"; login → `/dashboard`
- [ ] Nil/empty: anon on `/dashboard` → `/login`
- [ ] Error path: member without terms on `/upload` → onboarding terms
- [ ] Edge case: `/organizations` for a member without terms (current behaviour recorded, Q4 registered)

**Verification:** checker: 0 gaps for ids `WC*`, `WA*`, `WO*`, `WL*`; tripwire has no entries for these routes.

**Planning-time unknowns:** none.

---

### Unit 13: Web — guides

**Goal:** Rows and outcome tests for `/`, `/library`, `/tutorials/[id]`, `/tutorials/[id]/edit`, `/upload`, `/contributors/[id]`, `/get-involved/submit-a-tutorial`.

**Requirements trace:** R2, R4, R6, R9, R11

**Dependencies:** U1–U4

**Files:**
- `scripts/journeys/journeys.json` — ≈ 56 rows (`WH`, `WG`, `WT`, `WP` prefixes) from HOME, LIB, TUT, CON
- `scripts/journeys/routes-without-journeys.json`
- `packages/web/tests/e2e/public/{home,library,tutorial-detail,tutorial-downloads}.spec.ts`, `contributor/{upload-flow,edit-tutorial,org-backing,dashboard-tutorials}.spec.ts`, `collaborators.spec.ts`, `saves/saves.spec.ts` — ids; render-only tests upgraded
- `packages/web/tests/e2e/public/tutorial-actions.spec.ts` — new: thank (+ note), "I built this", pin a note, report, save; asserts the thanked contributor's inbox row (`tutorial_thanked`) and the save count
- `packages/web/tests/unit/components/{tutorial,editor,upload}*/**` — ids + handler assertions

**Approach:** Editor rows are many (parts, tools, steps, safety, files, STL, picks, suits, backing); each editor section gets one e2e test titled with its ids asserting the saved value reloads, and one api assertion of the re-review rule as it is today.

**Patterns:** `edit-tutorial.spec.ts` is already outcome-level; copy its shape.

**Test scenarios:**
- [ ] Happy path: thank with a note → inbox row for the author
- [ ] Nil/empty: library with no approved guides → empty state
- [ ] Error path: anon "Save" → signup with `reason`
- [ ] Edge case: editing details on an approved guide flips it to pending (current rule; Q8)

**Verification:** 0 gaps for the four prefixes.

**Planning-time unknowns:** none.

---

### Unit 14: Web — toys and exchanges

**Goal:** Rows and outcome tests for `/toy-library`, `/toy-library/[id]`, `/toy-library/[id]/request`, `/dashboard/toys/**`, `/dashboard/exchanges/**` (Gift, Swap, Build threads and ask), `/dashboard/print-requests/**`, `/dashboard/printers/**`, `/printing/**`.

**Requirements trace:** R2, R4, R6, R9, R11

**Dependencies:** U1–U4

**Files:**
- `scripts/journeys/journeys.json` — ≈ 60 rows (`WY` toys, `WX` exchanges, `WR` printing) from TOY, PRINT and the W-DASH toys/exchanges/print rows
- `scripts/journeys/routes-without-journeys.json`
- `packages/web/tests/e2e/toy-exchange.spec.ts`, `dashboard/toys.spec.ts`, `printing/answer-by.spec.ts`, `public/printing-parts.spec.ts` — ids; upgrades
- `packages/web/tests/e2e/exchanges/{gift,swap,build,print}.spec.ts` — new, one per Exchange kind: ask → accept → message → confirm → closed, two seats, asserting each Step's copy, the counterparty's inbox row and the `exchanges` unread bucket going up then down
- `packages/web/tests/unit/components/{toy,exchange,thread,print}*/**` — ids + handler assertions

**Approach:** The thread actions are duplicated across three pages (Q15); the e2e covers each page separately because they are separate code. Build and Print threads need a Guide seed (`createTutorial` in helpers).

**Patterns:** mobile `exchanges.spec.ts` and api `exchange-chain`, `build-chain`, `print-chain` tests define the Step sequence; mirror their titles.

**Test scenarios:**
- [ ] Happy path per kind: full chain to closed
- [ ] Nil/empty: My exchanges with none → empty state
- [ ] Error path: requesting your own toy → hidden button / 4xx (record current; Q16)
- [ ] Edge case: decline on the print page sends a reason; on the other two it does not (current; Q15)

**Verification:** 0 gaps for `WY*`, `WX*`, `WR*`.

**Planning-time unknowns:** none.

---

### Unit 15: Web — get involved and organisations (public)

**Goal:** Rows and outcome tests for `/get-involved/**` (challenges, ideas, makers-wanted, events + register, organisations + request, recycling + drop-off, requests, families, contributors) and `/organizations/**` (directory, public profile, message, projects).

**Requirements trace:** R2, R4, R6, R9, R11

**Dependencies:** U1–U4

**Files:**
- `scripts/journeys/journeys.json` — ≈ 46 rows (`WI` get-involved, `WN` organisations) from GI and ORG
- `scripts/journeys/routes-without-journeys.json`
- `packages/web/tests/e2e/public/design-challenges.spec.ts` — ids; upgrade
- `packages/web/tests/e2e/get-involved/{ideas,makers-wanted,events,organisations,recycling,requests}.spec.ts` — new; `events` covers register with questions, capacity 409, cancel; `organisations` covers request-to-lead and message-the-org (`org_message` inbox row for the leader)
- `packages/web/tests/unit/components/{challenge,event,org,recycling}*/**` — ids + handler assertions

**Approach:** Makers-wanted "new" and organisations "request" are two of the 14 routes with nothing; they get a unit and an e2e each. Event registration on web is the reference the phone was built to match; the e2e asserts the same copy the mobile spec does.

**Patterns:** mobile `makers-wanted.spec.ts`; api `handoffs/events-mine.test.ts`.

**Test scenarios:**
- [ ] Happy path: submit an idea → appears in My challenges as "awaiting review"
- [ ] Nil/empty: no open challenges → empty state
- [ ] Error path: register for a full event → 409 copy
- [ ] Edge case: message an org as anon → login (return path lost; Q3)

**Verification:** 0 gaps for `WI*`, `WN*`.

**Planning-time unknowns:** none.

---

### Unit 16: Web — member dashboard

**Goal:** Rows and outcome tests for `/dashboard`, `/dashboard/profile` (+ delete), `/dashboard/child/**`, `/dashboard/saved/**`, `/dashboard/thanks`, `/dashboard/reports`, `/dashboard/events`, `/dashboard/challenges`, `/dashboard/messages/[cid]`, `/notifications`.

**Requirements trace:** R2, R4, R6, R9, R11

**Dependencies:** U1–U4

**Files:**
- `scripts/journeys/journeys.json` — ≈ 45 rows (`WD` prefix) from W-DASH minus the toys/exchanges/print rows taken by U14, plus NOTIF
- `scripts/journeys/routes-without-journeys.json`
- `packages/web/tests/e2e/dashboard/{shell,navigation}.spec.ts`, `auth/account-deletion.spec.ts`, `saves/saves.spec.ts` — ids; upgrades
- `packages/web/tests/e2e/dashboard/{profile,children,thanks,reports,events,challenges,messages,notifications}.spec.ts` — new; `notifications` asserts per-row mark-read and the badge total; `thanks` the Hide/Show list; `events` My events (one of the 14 untested routes)
- `packages/web/tests/unit/components/{profile,child,saved,notification}*/**` — ids + handler assertions

**Approach:** The notifications e2e seeds rows with the service role (as mobile's `createNotification`), opens `/notifications`, marks one read and asserts the header badge drops by one. It also records that org-bucket rows cannot be cleared from any dashboard page (Q6) without fixing it.

**Patterns:** mobile `inbox` specs; `helpers.ts` needs a `createNotification` (add if missing).

**Test scenarios:**
- [ ] Happy path: edit profile name → shows on `/contributors/[id]`
- [ ] Nil/empty: no children → wizard CTA
- [ ] Error path: delete account with the wrong code → error, account intact
- [ ] Edge case: mark-all-read with one failing PATCH (current: ignored; Q14)

**Verification:** 0 gaps for `WD*`.

**Planning-time unknowns:** none.

---

### Unit 17: Web — organisation leader

**Goal:** Rows and outcome tests for `/dashboard/organisation/**` (review queue, toys, orders, recycling intake, requests, messages, publish, profile, events new/edit, stories new/edit) and `/dashboard/org/events/[id]`.

**Requirements trace:** R2, R4, R6, R9, R11

**Dependencies:** U1–U4

**Files:**
- `scripts/journeys/journeys.json` — 36 rows (`WB` prefix) from W-ORG
- `scripts/journeys/routes-without-journeys.json`
- `packages/web/tests/e2e/contributor/org-backing.spec.ts` — ids
- `packages/web/tests/e2e/organisation/{review,toys,orders,recycling,requests,messages,publish,profile,events,stories}.spec.ts` — new; leader seat via `createContributor` + a leader row (add `createOrg`/`makeLeader` helpers if absent); `orders` and `org/events/[id]` are among the 14 untested routes
- `packages/api/tests/integration/orgs/*.test.ts` — assert `backing_accepted`/`backing_declined`, `org_event_published`, `org_story_published`, `org_event_changed`/`cancelled` are created by their routes (the audit found no mobile e2e for four of these; the api test is the shared proof)
- `packages/web/tests/unit/components/org*/**` — ids + handler assertions

**Approach:** Only 3 of 137 web e2e tests run as a leader today; this unit builds the leader fixture once and every spec reuses it. Review: approve and request-changes both assert the author's inbox row.

**Patterns:** mobile `org-publish.spec.ts`, `organisation.spec.ts`; api `org-profile-social.test.ts`.

**Test scenarios:**
- [ ] Happy path: publish an event → appears on `/get-involved/events` and followers get `org_event_published`
- [ ] Nil/empty: review queue empty → empty state
- [ ] Error path: non-leader on `/dashboard/organisation` → redirected
- [ ] Edge case: delete an event with registrants (current: no notification; Q5)

**Verification:** 0 gaps for `WB*`.

**Planning-time unknowns:** Deferred — whether a `makeLeader` helper exists in web `helpers.ts`.

---

### Unit 18: Web — admin

**Goal:** Rows and outcome tests for `/admin/**` (dashboard cards, review + detail, ideas + detail, contributors, organizations, organization-requests, build-requests, print-jobs, reports, spot-check, test-prints, content, inbox).

**Requirements trace:** R2, R4, R6, R9, R11

**Dependencies:** U1–U4

**Files:**
- `scripts/journeys/journeys.json` — 36 rows (`WM` prefix) from W-ADMIN
- `scripts/journeys/routes-without-journeys.json`
- `packages/web/tests/e2e/admin/{dashboard,review-flow,contributors}.spec.ts` — ids; upgrades
- `packages/web/tests/e2e/admin/{ideas,organizations,organization-requests,build-requests,print-jobs,reports,spot-check,test-prints,content,inbox}.spec.ts` — new (five of these are among the 14 untested routes); each asserts the queue count card on `/admin` drops after the action
- `packages/web/tests/unit/components/admin*/**` — ids + handler assertions

**Approach:** Admin seat via `createAdmin`. Each queue spec seeds one item through the API as the right seat, acts, and asserts the target's inbox row (idea approved/rejected, guide approved/rejected, report resolved, challenge removed/reinstated).

**Patterns:** `admin/review-flow.spec.ts`; api `admin/queues.test.ts`, `admin/counts.test.ts`.

**Test scenarios:**
- [ ] Happy path: approve an org request → requester is a leader and the queue card drops
- [ ] Nil/empty: every queue's empty state
- [ ] Error path: member on `/admin` → bounced by middleware (unit on middleware in U12)
- [ ] Edge case: remove an account that is a sole leader → 409 copy shown

**Verification:** 0 gaps for `WM*`.

**Planning-time unknowns:** none.

---

### Unit 19: Web — learn, impact, about, printing (public prose and gated course)

**Goal:** Rows and tests for `/learn/**` (course gate, progress in localStorage, ask-an-expert), `/impact/**` (map, events, news), `/about/**` (partners, support, team, stories), `/contact`, `/printing/{basics,parts,requests}`.

**Requirements trace:** R2, R4, R6, R9

**Dependencies:** U1–U4

**Files:**
- `scripts/journeys/journeys.json` — ≈ 24 rows (`WE` learn, `WS` impact/about/printing) from LEARN, IMP, ABOUT, PRINT
- `scripts/journeys/routes-without-journeys.json`
- `packages/web/tests/e2e/impact.spec.ts`, `public/printing-parts.spec.ts` — ids
- `packages/web/tests/e2e/public/{learn,about}.spec.ts` — new; learn asserts the gate and that a lesson's completion persists across reload; about covers contact submit, partners/support (two of the 14 untested routes), `/impact/events`
- `packages/web/tests/unit/app/**` — one render test per static page with its id (`kind: static`)

**Approach:** Most rows are `static` (unit only). The learn course has real state (localStorage progress) and gets e2e.

**Patterns:** learn-gate unit tests already exist; extend.

**Test scenarios:**
- [ ] Happy path: complete a lesson → checkpoint unlocks after reload
- [ ] Nil/empty: contact form empty submit → validation copy
- [ ] Error path: anon on a gated lesson → login (return path lost; Q3)
- [ ] Edge case: `/impact/events` if it is a redirect → row says so, `kind: nav`

**Verification:** 0 gaps for `WE*`, `WS*`; tripwire has no web entries left except `/design-system*`.

**Planning-time unknowns:** Deferred — whether `/impact/events` and `/dashboard/org/events/[id]` are redirects (scout did not check).

---

### Unit 20: Notifications and counts matrix

**Goal:** Every notification type is proven at the API from its real trigger, and every count is proven by action-then-change.

**Requirements trace:** R11

**Dependencies:** U9a–c, U12–U19

**Files:**
- `scripts/journeys/notifications.mjs` — new: reads `NotificationType` from `packages/types/src`, finds each type's creator in `packages/api/src`, and checks a test exists whose title contains `notifies:<type>`; fails on a type with none. Same for a `counts:` list (inbox buckets, six admin queues, saves, challenge counts, printer jobs)
- `packages/api/tests/integration/**` — the missing `notifies:` tests (the grep found all 38 mentioned; expect ≈ 10–15 that are mentioned but not asserted) and the action-then-count tests
- `package.json` — `test:journeys` also runs `notifications.mjs`
- `docs/testing/journeys.md` — a second table: type | created by | asserted by | web e2e | mobile e2e

**Approach:** The group units add the client-side e2e for each notification; this unit closes the API side and makes the matrix a CI check so a new type cannot ship untested. `challenge_guide_published` comes from a SQL trigger: its test inserts through the API path that fires it.

**Patterns:** `route-coverage.test.ts` for "enumerate from source, demand a test".

**Test scenarios:**
- [ ] Happy path: all 38 types have an asserting test
- [ ] Nil/empty: a type with no creator in `src` → "dead type" failure (candidate for deletion)
- [ ] Error path: adding a type to the union without a test fails CI
- [ ] Edge case: inbox unread per bucket drops after mark-read, not just total

**Verification:** `pnpm test:journeys` prints "38 notification types, 0 unasserted; N counts, 0 unasserted".

**Planning-time unknowns:** none.

---

### Unit 21: `verify-plan.sh` reads the map

**Goal:** A changed route or screen prints its journey rows and the exact specs that carry them, instead of guessing specs by filename.

**Requirements trace:** R14

**Dependencies:** U1, U2

**Files:**
- `scripts/journeys/for-files.mjs` — new: given changed paths, maps route files → rows (via `route`) and rows → test files (via the title index); prints `platform spec` lines
- `scripts/verify-plan.sh` — the two e2e matching loops replaced by a call to `for-files.mjs`; also runs `pnpm test:journeys` when `scripts/journeys/**` or any test file changed
- `scripts/journeys/check.test.mjs` — `for-files` cases

**Approach:** Keep the filename heuristic as a fallback for files no row names (e.g. `lib/`).

**Patterns:** existing `E2ES+=` lines in `verify-plan.sh`.

**Test scenarios:**
- [ ] Happy path: change `packages/web/app/dashboard/toys/[id]/page.tsx` → prints `web tests/e2e/dashboard/toys.spec.ts`
- [ ] Nil/empty: a docs-only change → "nothing to run"
- [ ] Error path: a route with no row → prints the tripwire message
- [ ] Edge case: a shared component changed → every spec carrying a row whose unit test imports it (fallback to `vitest related`)

**Verification:** `scripts/verify-plan.sh` on a known change lists the right specs.

**Planning-time unknowns:** none.

---

### Unit 22: CI budget

**Goal:** Web e2e stays under 15 minutes in CI with the new specs; if not, shard by seat.

**Requirements trace:** R17

**Dependencies:** U12–U19

**Files:**
- `.github/workflows/ci.yml` — `web-e2e` gains `timeout-minutes: 30` and, if needed, a `matrix: shard: [anon, member, leader, admin]` with `--grep @seat`
- `packages/web/playwright.config.ts` — seat tags (`@anon`, `@member`, `@leader`, `@admin`) if sharding is needed; `reuseExistingServer` stays `!CI`
- `packages/web/tests/e2e/**/*.spec.ts` — seat tag on each `test.describe` if sharding

**Approach:** Measure first (the config's "1.3 min" note predates 137 tests). Shard only if over budget. Shards run in sequence, not parallel, because they share one Supabase and GoTrue port exhaustion forces 1 worker; sharding helps retries and readability more than wall-clock. If sequence is still over budget, the honest answer is a second Supabase port set per shard (out of scope here; register).

**Patterns:** `mobile-e2e` job.

**Test scenarios:**
- [ ] Happy path: a web PR's `web-e2e` finishes under 15 min
- [ ] Nil/empty: a shard with no matching tests passes (Playwright exits 0 with `--pass-with-no-tests`)
- [ ] Error path: a job over 30 min is killed (not 6 h)
- [ ] Edge case: `retries: 1` still masks only infra flakes (a real failure fails twice)

**Verification:** CI run duration visible in the Actions summary.

**Planning-time unknowns:** Deferred — the measured duration.

---

### Unit 23: Close the ratchets

**Goal:** Both ratchets are empty of placeholders, the legacy parser is gone, and the success criteria are checked by hand once.

**Requirements trace:** R4, R7, R9, R13, success criteria

**Dependencies:** everything above

**Files:**
- `scripts/journeys/legacy-file-tags.json` — deleted; `lib.mjs` loses file-level tag support except `(none — …)`
- `scripts/journeys/routes-without-journeys.json` — only permanent, reasoned entries remain
- `scripts/journeys/check.test.mjs` — legacy cases removed
- `docs/testing/journey-coverage-rule.md` — "how to add a journey" section (row → tests → `test:journeys:write`)
- `packages/mobile/tests/journeys.json` — confirm gone; `docs/testing/mobile-journeys-decisions.md` — header note pointing at the plan and `pending.ts`

**Approach:** Run the audit's 50-row sample method on a fresh sample per platform (100 rows) and record the score in the rule doc. Any cell below OUTCOME is fixed in place before closing.

**Patterns:** none new.

**Test scenarios:**
- [ ] Happy path: `pnpm test:journeys` → 0 gaps, 0 lint, tripwire 0, legacy none
- [ ] Nil/empty: a file-level `// journeys: A01` now fails outright
- [ ] Error path: a new `page.tsx` without a row fails CI (re-verify the U3 behaviour end to end)
- [ ] Edge case: a waiver older than the rule doc's date is re-justified or removed

**Verification:** Success criteria in the requirements doc all true; `git grep "journeys:" packages/web packages/mobile packages/api -- ':!*(none*'` returns only opt-outs.

**Planning-time unknowns:** none.

---

## Quality bar

- Every unit has a requirements trace. ✓
- Dependencies form a DAG (graph above). ✓
- Every unit has ≥ 3 test scenarios. ✓
- **File count:** U1–U7, U11, U20–U23 touch ≤ 8 files. U8–U10 and U12–U19 touch more, all test files and the map; they are *series* of one-commit-per-fix changes with no production code except U6. Scope challenge answered: splitting them further would produce units that cannot be verified on their own (a screen group's gaps are only 0 when its rows, tags and specs all land). Accepted as a known exception.
- New abstractions: U2 (title tags), U3 (tripwire), U4 (lint), U20 (notification matrix). One or two per unit, none elsewhere. ✓
- Planning-time unknowns: all classified; none blocks. ✓
- Handoff test: an engineer invents no product behaviour. Where current behaviour is in doubt, the test records what the app does and the question is in `pending.ts`. ✓

## Order of work

1. U1 → U2 → U3 → U4 (mechanism; CI green throughout because the ratchets start full).
2. U5a, U5b, U6, U7 in any order (api and register; can run alongside 3).
3. U8 → U9a/b/c and U10 (mobile), U11 (device) once U10 has moved the flow tags.
4. U12–U19 (web), one at a time, largest first: U14 (exchanges), U13 (guides), U17 (leader), U18 (admin), U16, U15, U12, U19.
5. U20 → U22 → U21 → U23.

Before any "done": `scripts/verify-plan.sh --run --e2e`, the whole `npx jest` for mobile, `pnpm test:journeys`, and `graphify update .`.
