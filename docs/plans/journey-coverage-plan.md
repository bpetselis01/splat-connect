# Journey coverage (web + mobile) — Implementation Plan

**Date:** 2026-10-20
**Status:** implemented 2026-10-20 on branch `journey-coverage`, PR #88 against `development`; every unit landed (U22 shards the web e2e job instead of measuring at the end). The map is `scripts/journeys/journeys.json`; `pnpm test:journeys` is the check.
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

A journey id is `[A-Z]\d{2}` (mobile, unchanged) or `W[A-Z]\d{2}` (web). A test case claims a journey by putting the id first in its title (Playwright `@tags` may come before it): `test('WD03 accept a build request', …)`, `it('G09 G10 thank and note')`, `it.each(rows)('G09 %s')`, Maestro `name: "A14 deep link cold start"`. A file-level `// journeys: (none — reason)` opts a file out. The checker reads titles with a TypeScript AST walk (`ts.createSourceFile`, `typescript` is already a root devDependency): every `CallExpression` whose callee is `test`/`it` or `test.each(...)`/`it.each(...)`/`test.only`, with a static string or no-substitution template as its first argument. `describe` titles do not count; `.skip`/`.fixme`/`.todo` contribute nothing; comments and strings inside fixtures are invisible to the walk; a dynamic id (`` `${id} …` ``) is an error. YAML flows: the top-level `name:` only. It never executes tests.

Layers: `web-unit` (`packages/web/tests/unit/**/*.test.{ts,tsx}`), `web-e2e` (`packages/web/tests/e2e/**/*.spec.ts`), `mobile-unit`, `mobile-e2e`, `api` (`packages/api/tests/integration/**/*.test.ts` only — unit tests mock Supabase and cannot prove a journey; no api tag sits on a unit test today, so this costs nothing), `device` (`packages/mobile/.maestro/flows/*.yaml`). A row's `platform` decides which unit/e2e layers its `required` may name.

Row fields added in U1: `platform`, `route`, `kind`, `device` (boolean). `kind` drives the R8 lint: `static` → unit; `nav` → unit + e2e; `write` → unit + e2e + api; `notifies`/`counts` non-empty → api required; `device: true` → device required. Rows are kept sorted by id, one per line, so two branches adding rows rarely conflict.

The rendered doc opens with a header line `Gaps: N · Waived: N · Legacy-tagged files: N · Routes without rows: N`, then a summary table (platform / screen group → rows, gaps, waived), then one table per group. A group with no gaps renders as one line; a platform with no rows fails the renderer.

Both ratchets start full (every tagged file is legacy; every route without a row is listed with a `TODO:` reason) so CI stays green from Unit 1, and each later unit shrinks them. The final unit deletes the ratchets and the legacy parser.

Seed helpers that touch no `Page` (admin client, users, orgs, leaders, events, notifications, guides) live in one Playwright-free module both e2e suites and the device provisioner import (U7b), the way both Playwright configs already share `supabase/local-dev-keys.ts`.

Seat vocabulary: anon, P (Member), L (org leader), A (admin). Content vocabulary per `CONTEXT.md` (Guide, Toy, Exchange: Gift/Swap/Build/Print, Idea/Challenge, Member/Family/Maker).

## Dependency graph

```
U1 → U2 → U3 → U4 ─┬→ U8 (mobile rebase) → U9a, U9b, U9c, U10 → U11 (device)
                   ├→ U12 … U19 (web groups, independent of each other)
                   ├→ U21 (verify-plan)
U5a → U5b; U6; U7; U7b (shared seed helpers) have no dependencies
U7b → U9a, U9b, U9c, U15, U16, U17, U18
U14 (first web group) → U22 (CI budget, measured early)
U12…U19 + U9* → U20 (notifications & counts matrix) → U23 (close ratchets)
```

Branch `journey-coverage` off `development`. One commit per fix (a row set, a spec, a ratchet shrink), never one per unit.

---

### Unit 1: One map for both platforms

**Goal:** Move the map out of the mobile package, give every row a `platform`, `route` and `kind`, and split the layers so a web row can be required at web layers.

**Requirements trace:** R1, R5, R18

**Dependencies:** none

**Files:**
- `scripts/journeys/journeys.json` — moved from `packages/mobile/tests/journeys.json`; every row gains `platform: "mobile"`, `route` (its `packages/mobile/app` path, e.g. `(my)/toys/[id]/index`), `kind` (`static` | `nav` | `write`), `device` (true for the 13 rows that require the device layer today)
- `scripts/journeys/lib.mjs` — `LAYERS` becomes the six above (`api` narrowed to `tests/integration`); `coverage()` checks `required` names only layers legal for the row's platform (plus `api`, `device`); `validateRows()` rejects a missing `platform`/`route`/`kind`, an unknown `kind`, an unknown layer, a duplicate id
- `scripts/journeys/check.mjs`, `scripts/journeys/render.mjs` — new paths; header line with the four counts, summary table, one table per platform/screen group, one-line groups when gap-free; a platform with no rows fails
- `scripts/journeys/check.test.mjs` — tests for the platform/layer rule and the new doc shape
- `docs/testing/journeys.md` — replaces `docs/testing/mobile-journeys.md` (deleted)
- `docs/testing/journey-coverage-rule.md` — the R6 rule: what "covered" means per layer, with one good and one bad example per layer
- `CLAUDE.md` — the testing paragraph points at the rule and `pnpm test:journeys`

**Approach:** Mechanical move; `required` values are rewritten `unit→mobile-unit`, `e2e→mobile-e2e` by a one-off node script run once and discarded. `route` for the 253 rows is filled from the inventory table in `docs/testing/mobile-journeys-inventory-2026-10-07.md` (section 1 maps screen → route). `kind` is set by rule: rows with `api` non-empty and a verb (post/patch/delete) → `write`; navigation-only → `nav`; prose/legal → `static`. The rule doc is short: three paragraphs and six examples.

**Patterns:** `check.test.mjs` already tests `parseTags`/`coverage` with inline fixtures; extend the same way. The pending registry (`packages/types/src/pending.ts` + `scripts/pending.mjs`) is the precedent for data + generated doc + drift test.

**Test scenarios:**
- [ ] Happy path: `pnpm test:journeys` passes with 253 rows, 0 gaps, 1 waiver, identical cells to before the move
- [ ] Nil/empty: a row missing `platform`, `route` or `kind` fails the checker with the row id and the field; a platform with no rows fails the renderer
- [ ] Error path: a mobile row requiring `web-e2e` (and a web row requiring `mobile-unit`) fails with "layer not legal for platform"; an unknown `kind`, an unknown layer and a duplicate id each fail by name
- [ ] Edge case: `render.mjs --write` output is byte-stable across two runs (sorted by platform, then id); a `|` or non-ASCII in element text renders escaped; a gap-free group renders as one line

**Verification:** CI `check` job green; `docs/testing/journeys.md` exists, `mobile-journeys.md` is gone; `git grep "packages/mobile/tests/journeys.json"` returns nothing.

**Planning-time unknowns:** none.

---

### Unit 2: Tags bind to test cases

**Goal:** A journey is covered at a layer only when a test case title carries its id; file-level tags survive only on a shrinking legacy list.

**Requirements trace:** R7

**Dependencies:** U1

**Files:**
- `scripts/journeys/titles.mjs` — `parseTitles(source, kind)`: TypeScript AST walk for `.ts`/`.tsx` (jest, vitest, Playwright), YAML top-level `name:` for Maestro; returns `{ ids, errors }`
- `scripts/journeys/lib.mjs` — `parseTags` keeps the file-level line but only for files in the legacy list or with a `(none — reason)` opt-out; a file with title ids AND a file-level tag is malformed ("remove the file-level line")
- `scripts/journeys/legacy-file-tags.json` — generated once: every file that carries a `journeys:` line today (395: 183 mobile-unit, 77 mobile-e2e, 122 api, 13 Maestro; web has none)
- `scripts/journeys/check.mjs` — a file-level tag on a file NOT in the legacy list is "malformed: file-level tag; put the id in the test title"; prints "legacy file-level tags: N" every run
- `scripts/journeys/check.test.mjs` — title parsing for each runner, legacy-list behaviour, id regex `^W?[A-Z]\d{2}$`

**Approach:** AST, not regex — 84 mobile unit files, 11 web and 15 api use `it.each(...)('title')`, and a regex would also count commented-out and `.skip` tests. Ids are the leading tokens of a static title (`'WD03 …'`, `'G09 G10 thank and note'`); Playwright `@tag` tokens may precede them. A title whose first word looks like an id but is not one (`'A11y labels'`) is not an id because the regex is anchored to a whole token. Describe blocks do not count (too coarse). Migration is all-or-nothing per file: the moment a file has a title id, its file-level line must go. The legacy list is written by a throwaway script and committed; from then on it only shrinks.

**Patterns:** `route-coverage.test.ts` UNTESTED ratchet: a list that predates the guard, "when one gains a test, delete it from the list (the second test insists)". Copy its two-test shape: one test that the list is honoured, one that every entry is still needed.

**Test scenarios:**
- [ ] Happy path: `test('WD03 accepts', …)`, `it.each(rows)('G09 %s')` (single-line and table form), `test.only('…')`, a `.tsx` file with JSX, and `'@responsive WD03 …'` each cover their id; `'G09 G10 thank and note'` covers both
- [ ] Nil/empty: a title with no id contributes nothing and is not an error; `'A11y labels'`, `'G091 …'` and a lower-case `'g09 …'` are not ids; `.skip`/`.fixme`/`.todo`, a commented-out test, a `describe` title and a title inside a string fixture all contribute nothing
- [ ] Error path: a new file with `// journeys: A01` and no legacy entry → malformed; a file with both title ids and a file-level line → malformed; a duplicate id in one title → error; a dynamic id (`` `${id} …` ``) → error; a mobile id in a `web-e2e` file → "wrong platform"; an opt-out with an empty reason → malformed; an invalid or duplicate entry in the legacy JSON → clear error
- [ ] Edge case: a legacy entry for a file whose file-level tag has been removed, or whose file no longer exists → "stale legacy entry, delete it"; a Maestro flow with `name:` inside a step body but none at top level → contributes nothing and is listed; a flow with two ids in `name:` covers both; the legacy count appears in the output

**Verification:** `pnpm test:journeys` still 0 gaps (legacy list keeps every cell green); the checker reports "legacy file-level tags: N files" on every run.

**Planning-time unknowns:** none.

---

### Unit 3: Route tripwire

**Goal:** A route on either platform without a journey row fails CI, unless it is in a reasoned opt-out list.

**Requirements trace:** R4

**Dependencies:** U1

**Files:**
- `scripts/journeys/lib.mjs` — `routeTripwire(rows, routes, optOuts)`; route discovery: `packages/web/app/**/page.tsx` → `/path/[param]` (strip `(group)` segments; root → `/`; `route.ts` handlers are not routes); `packages/mobile/app/**/*.tsx` → `(group)/path/[param]` (skip `_*.tsx` and `+*.tsx`; `[id].tsx` and `[id]/index.tsx` are distinct keys)
- `scripts/journeys/routes-without-journeys.json` — `{ "route": "reason" }`; generated once with every web route (134) and every mobile route with no `route` match, reason `"TODO: not yet inventoried"`; a `TODO:` prefix marks a placeholder so U23 can insist none remain
- `scripts/journeys/check.mjs` — prints the tripwire count; fails on a route with no row and no entry, on an entry whose route no longer exists, on an entry whose route now has a row (the "second test insists" half), and on a row whose `route` matches no real file (typo or rename)
- `scripts/journeys/check.test.mjs`

**Approach:** Same two-test ratchet shape as U2. Permanent opt-outs get a real reason (`/design-system`, `/design-system/states`: "internal gallery"; pure redirects such as `index.tsx → /home`). A row for platform A never satisfies a route on platform B.

**Patterns:** `scripts/parity` app-map drift test already enumerates mobile routes but is not importable; copy its glob and the skip rules.

**Test scenarios:**
- [ ] Happy path: every route either has a row or an entry → pass; root `page.tsx` → `/`; nested `[id]/request`; `(tabs)/home/index`
- [ ] Nil/empty: an `app/` with no page files → 0 routes, pass; a non-`.tsx` file under `app/` is ignored
- [ ] Error path: new `packages/web/app/foo/page.tsx` with no row → fails naming `/foo`; a mobile row does not satisfy a web route of the same name; a row whose `route` matches no file fails
- [ ] Edge case: route group `(course)` is stripped so `/learn/(course)/handover` matches a row for `/learn/handover`; an opt-out whose route now has a row → "stale opt-out, delete it"; an opt-out whose route is gone → fail; `+not-found.tsx` and `_layout.tsx` are skipped

**Verification:** adding an empty `page.tsx` locally makes `pnpm test:journeys` fail; removing it passes.

**Planning-time unknowns:** none.

---

### Unit 4: Required-layer lint

**Goal:** `required` can no longer be under-set by hand.

**Requirements trace:** R8, R13

**Dependencies:** U1

**Files:**
- `scripts/journeys/lib.mjs` — `lintRequired(row)` returns violations: `kind` vs minimum layers (extra layers allowed); `notifies` (entries that are notification types; `"OTP mail"` is not one) or `counts` non-empty ⇒ `api`; `device: true` ⇒ `device`; a waiver must name a required layer and carry `reason` and a valid past `date` (`YYYY-MM-DD`)
- `scripts/journeys/journeys.json` — every row the lint names gets `api` in `required` (the audit found Q18, Q19, C14 by hand; the `counts` rule finds about six more); the A03 waiver gains a date
- `scripts/journeys/check.mjs`, `check.test.mjs`

**Approach:** Lint runs before coverage and exits non-zero on its own; a violation is a failure with the row id and the rule. Waivers are listed on every run (already) and in the doc.

**Patterns:** existing `coverage()` returns `{gaps, unknown, waived}`; lint returns the same shape of list.

**Test scenarios:**
- [ ] Happy path: one passing case per `kind`; a `write` row with an extra layer passes; the six existing client-count rows pass once `api` is added
- [ ] Nil/empty: `notifies: []` and `counts: []` impose nothing; `notifies: ["OTP mail"]` imposes nothing
- [ ] Error path: `notifies: ["toy_rejected"]` with no `api` in `required` → violation; `device: true` without `device` → violation; lint failure exits 1 and says so before any gap list
- [ ] Edge case: a waiver without a date, with `2026-13-40`, with a future date, without a reason, or for a layer the row does not require → violation; a waiver renders in the doc

**Verification:** after the row edits, `pnpm test:journeys` shows new `api` gaps only on the rows the lint named — closed in U9b and U10.

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
- `packages/api/tests/unit/pending-features.test.ts` — "every open item is referenced somewhere in the code" (line 21) exempts `kind: 'decision'` entries that carry a `question`; a new case proves the exemption ends when the entry gains `shipped: true` or loses its `question`
- `scripts/pending.mjs` — renders unreferenced decisions under their own heading so they stay visible

**Approach:** The drift test has no exemption today (verified 2026-10-20), so the 16 entries would turn it red; the allowance is three lines and one test. No `PENDING(...)` code references are added for decisions that have no code site yet.

**Patterns:** existing `decision` entries in `pending.ts` (the 27 answered on 2026-09-30).

**Test scenarios:**
- [ ] Happy path: `node scripts/pending.mjs --check` passes
- [ ] Nil/empty: an entry without `question` for `kind: 'decision'` fails the drift test
- [ ] Error path: a duplicate key fails
- [ ] Edge case: `docs/PENDING.md` lists the 16 under Decisions

**Verification:** drift test green; `docs/PENDING.md` diff shows exactly 16 new rows.

**Planning-time unknowns:** none.

---

### Unit 7b: Shared e2e seed helpers

**Goal:** One Playwright-free module seeds users, orgs, leaders, events, notifications and guides for the web e2e suite, the mobile e2e suite and the device provisioner; the five helpers later units need exist once.

**Requirements trace:** R6, R9 (enables U9a–c, U15–U18)

**Dependencies:** none

**Files:**
- `supabase/e2e-seed.ts` — new, next to `local-dev-keys.ts`: `adminClient`, `uniqueTitle`, `createContributor`, `createAdmin`, `createTutorial`, `createPublishedToy`, `createOrg` + `addLeader`, `makeLeader` (leader row + `org_leader_terms` agreement, versions from `AGREEMENT_VERSIONS` in `@splat-connect/types`, never the `'v0-todo'` literal), `createEvent`, `createNotification`, `acceptTerms`
- `packages/web/tests/e2e/helpers.ts`, `packages/mobile/tests/e2e/helpers.ts` — re-export from the shared module; keep only the `Page`-touching helpers (`signIn`, `signInAsNewContributor`)
- `packages/mobile/scripts/provision-device-parent.mjs` (or wherever the provisioner lives — find it by its "keep in sync" comment) — imports the shared module; the comment goes
- `packages/web/tests/e2e/*.spec.ts`, `packages/mobile/tests/e2e/*.spec.ts` — import paths unchanged (re-exports), so no spec edits

**Approach:** Move, don't rewrite: today web has `createAdmin` and `createOrgWithLeader` (no agreement), mobile has `makeOrgLeader` (org + leader + agreement) and `createNotification`, neither has `createEvent` (specs insert `org_events` inline in three places). Pick the fuller of each pair, give it one name, and have the other package's old name alias it for one unit, then delete the alias.

**Patterns:** `supabase/local-dev-keys.ts` shared by both Playwright configs.

**Test scenarios:**
- [ ] Happy path: both e2e suites pass unchanged after the move
- [ ] Nil/empty: `createEvent` with no questions creates an event with `questions: []`
- [ ] Error path: `makeLeader` for a user who is already a leader is idempotent (no duplicate row)
- [ ] Edge case: the provisioner builds its fixture through the shared module and `device:fixture` still prints the same env lines

**Verification:** `git grep "v0-todo" packages/*/tests` returns nothing; the three inline `org_events` inserts are gone.

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

**Dependencies:** U7b, U8

**Files:**
- `packages/mobile/tests/e2e/events-detail.spec.ts`, `events-register.spec.ts`, `events-print.spec.ts` — new
- `packages/mobile/tests/e2e/organisation-events.spec.ts` — registrations list, part queue, edit event/story
- `packages/mobile/tests/e2e/me-acting-org.spec.ts` — switch org, leader screens follow
- `packages/mobile/tests/e2e/organisation-edit.spec.ts` — pictures, doors, rates, offers, capabilities, recycling sections
- `packages/mobile/tests/unit/components/events/*.test.tsx`, `organisation/*.test.tsx` — add outcome assertions where the existing tests only render
- `packages/api/tests/integration/events/registrations.test.ts` — extend: register → `org_event_*` notifications, capacity 409, organiser list

**Approach:** One spec per screen, each `test` titled with its ids. Seeds come from `supabase/e2e-seed.ts` (`createEvent`, `makeLeader`, `createNotification`; U7b). E2E asserts the visible result: the "You're going" state, the registrant appearing in the organiser list, the edited title on the org profile.

**Patterns:** `org-publish.spec.ts` for leader-seat e2e; `handoffs/events-mine.test.ts` for the API side.

**Test scenarios:**
- [ ] Happy path: register → appears in My events and the organiser's list
- [ ] Nil/empty: event with no questions shows no question step
- [ ] Error path: full event → 409 copy shown, no registration row
- [ ] Edge case: switching acting org changes which registrations list the leader sees

**Verification:** checker gaps for V*, L* and the new event/org ids are 0.

**Planning-time unknowns:** none (`createEvent` exists nowhere today; U7b adds it).

---

### Unit 9b: Mobile gaps — admin queues

**Goal:** Outcome tests for the six phone admin queues and the three under-required rows.

**Requirements trace:** R6, R9

**Dependencies:** U7b, U8

**Files:**
- `packages/mobile/tests/e2e/admin-guide-review.spec.ts`, `admin-accounts.spec.ts`, `admin-organisations.spec.ts`, `admin-ideas.spec.ts`, `admin-member-reports.spec.ts`, `admin-idea-reports.spec.ts`, `admin-spot-check.spec.ts` — all new: the mobile admin seat has never run under Playwright (the only `admin-guide-review` is a Maestro flow, which stays)
- `packages/mobile/tests/unit/components/admin/*.test.tsx` — ids in titles; outcome assertions (handler called with id + status)
- `packages/api/tests/integration/admin/*.test.ts` — the status PATCHes the U4 lint flagged (Q18, Q19, C14 and the count rows) asserted (row updated, notification to the author)

**Approach:** Admin seat via the shared `createAdmin` (U7b) and the existing `signIn` helper on the Expo web build; the first spec proves that path works before the other six are written. Each queue spec: seed one item, act, assert the item leaves the queue and the count card on `/admin` drops by one (the count assertion is R11's action-then-count form).

**Patterns:** `admin-guide-review` e2e; `admin/queues.test.ts` on the API.

**Test scenarios:**
- [ ] Happy path: approve an idea → leaves queue, author notified, count −1
- [ ] Nil/empty: empty queue shows the empty state
- [ ] Error path: non-admin opening `(my)/admin/*` is bounced (the inventory noted no screen guard; the test documents current behaviour and the plan registers a decision if it is wrong)
- [ ] Edge case: reinstate after remove restores the participant

**Verification:** checker gaps for Q18, Q19, C14 and the six new admin groups are 0.

**Planning-time unknowns:** Deferred — whether `(my)/admin` needs a screen guard (Q11-adjacent; register if missing). Resolved 2026-10-20: the admin seat needs no extra sign-in steps — `signIn` (`packages/mobile/tests/e2e/helpers.ts:273`) is a plain email/password form and the session carries no role (`lib/auth-context.tsx:80`); the Me tab reads `profile.role` after sign-in.

---

### Unit 9c: Mobile gaps — reports, thanks, collaborators, report-a-person

**Goal:** Outcome tests for My reports (+ `report_resolved`), thank-you notes Hide/Show, guide collaborators invite/remove/leave, report a challenge participant.

**Requirements trace:** R6, R9, R11

**Dependencies:** U7b, U8

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

**Goal:** The 13 device journeys run on an emulator in CI as a required check for every PR that matches the `mobile` path filter (`packages/mobile`, `packages/types`, `packages/api`, `supabase`). No nightly.

**Requirements trace:** R12

**Dependencies:** U8 (flow `name:` ids), U10

**Files:**
- `.github/workflows/ci.yml` — new job `maestro-android` after `mobile-e2e`, `needs: [changes]`, `if: needs.changes.outputs.mobile == 'true'` (job-level `if:`, never a workflow-level `paths:` filter — a skipped job satisfies a required check, a path-filtered workflow leaves it pending and blocks merge), no `continue-on-error`, `timeout-minutes: 90` for the first runs, tightened to 45 once the cache is warm; `maestro test --format=JUNIT --output` for the report artifact
- `.github/workflows/maestro-android.yml` — deleted. No separate warm-up workflow: an `actions/cache` entry is restorable only from the same branch or a PR's base branch, so a warm-up dispatched on a feature branch helps no PR. Instead the job's AVD-snapshot and Gradle `actions/cache` steps save on every push to `development` (which `ci.yml` already runs on), so each merge refreshes the cache that the next PR restores. The very first warm run is a manual `workflow_dispatch` of `ci.yml` on `development`.
- `packages/mobile/.maestro/flows/*.yaml` — top-level `name:` with ids; the four flows never run anywhere (`feedback-sheet-post`, `note-report`, `inbox-badge-live`, `deep-link-cold-start`) fixed until they pass on the emulator
- `packages/mobile/package.json` — `device:fixture` / `device:test` scripts confirmed to work headless
- `docs/testing/journey-coverage-rule.md` — device paragraph: a device cell counts only for flows in this job

**Approach:** Dispatch `ci.yml` on `development` by hand first so the cache exists, then open the PR. Fix in this order: KVM enabled (udev rule step, still required on `ubuntu-latest`) → emulator boots → Release build installs → `device:fixture` seeds → `every-tab-renders` passes → the other 12. Byron's memory notes iOS gotchas; Android is immune to the stale-prebuild issue. Budget (research 2026-10-20, estimates not benchmarks): prebuild + `assembleRelease` 15–30 min cold / 6–12 warm; emulator 3–6 min cold / under 90 s from snapshot; 13 flows 8–20 min; whole job ≈ 30–50 cold, 15–25 warm. The 10 GB repo cache cap and 7-day eviction mean a quiet fortnight makes the next run cold again; that is acceptable, not a reason for a schedule.

**Patterns:** `mobile-e2e` job for Supabase start/stop and artifact upload; `reactivecircus/android-emulator-runner` README snapshot recipe: a cache-miss step with `force-avd-creation: false` and no `-no-snapshot`, then the run step with `-no-snapshot-save`; `emulator-options` replaces the defaults entirely, so copy them.

**Test scenarios:**
- [ ] Happy path: a mobile-only PR runs the job and it passes
- [ ] Nil/empty: a docs-only PR skips the job and the required check reads as satisfied
- [ ] Error path: a broken flow fails the PR check (not `continue-on-error`)
- [ ] Edge case: Supabase is stopped in `always()` even when flows fail; a cold cache still finishes inside 90 min

**Verification:** job green on `journey-coverage` with the cache warm; branch protection on `development` lists it as required (Byron sets this in GitHub; the plan cannot).

**Planning-time unknowns:** Deferred — the real cold and warm runtimes on the free runner (if warm > 45 min, split the 13 flows across two matrix legs). Research notes with sources: `docs/testing/maestro-ci-research-2026-10-20.md`.

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

**Dependencies:** U1–U4, U7b

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

**Dependencies:** U1–U4, U7b

**Files:**
- `scripts/journeys/journeys.json` — ≈ 45 rows (`WD` prefix) from W-DASH minus the toys/exchanges/print rows taken by U14, plus NOTIF
- `scripts/journeys/routes-without-journeys.json`
- `packages/web/tests/e2e/dashboard/{shell,navigation}.spec.ts`, `auth/account-deletion.spec.ts`, `saves/saves.spec.ts` — ids; upgrades
- `packages/web/tests/e2e/dashboard/{profile,children,thanks,reports,events,challenges,messages,notifications}.spec.ts` — new; `notifications` asserts per-row mark-read and the badge total; `thanks` the Hide/Show list; `events` My events (one of the 14 untested routes)
- `packages/web/tests/unit/components/{profile,child,saved,notification}*/**` — ids + handler assertions

**Approach:** The notifications e2e seeds rows with the shared `createNotification` (U7b; web had none), opens `/notifications`, marks one read and asserts the header badge drops by one. It also records that org-bucket rows cannot be cleared from any dashboard page (Q6) without fixing it.

**Patterns:** mobile `inbox` specs.

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

**Dependencies:** U1–U4, U7b

**Files:**
- `scripts/journeys/journeys.json` — 36 rows (`WB` prefix) from W-ORG
- `scripts/journeys/routes-without-journeys.json`
- `packages/web/tests/e2e/contributor/org-backing.spec.ts` — ids
- `packages/web/tests/e2e/organisation/{review,toys,orders,recycling,requests,messages,publish,profile,events,stories}.spec.ts` — new; leader seat via the shared `makeLeader` (U7b; web's `createOrgWithLeader` never inserted the `org_leader_terms` agreement); `orders` and `org/events/[id]` are among the 14 untested routes
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

**Planning-time unknowns:** none (web has no `makeLeader`; U7b adds it).

---

### Unit 18: Web — admin

**Goal:** Rows and outcome tests for `/admin/**` (dashboard cards, review + detail, ideas + detail, contributors, organizations, organization-requests, build-requests, print-jobs, reports, spot-check, test-prints, content, inbox).

**Requirements trace:** R2, R4, R6, R9, R11

**Dependencies:** U1–U4, U7b

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
- `scripts/journeys/notifications.mjs` — new: reads the `NotificationType` union from the source text of `packages/types/src/index.ts` with the same TypeScript AST used in U2 (plain `node` cannot import that file), finds each type's creator in `packages/api/src/**` or `supabase/migrations/**` (SQL triggers), and checks an integration test exists whose title contains the type name; fails on a type with none. Same for a fixed `counts` list (inbox buckets, six admin queues, saves, challenge counts, printer jobs) keyed by the count's API route
- `packages/api/tests/integration/**` — the missing asserting tests (the grep found all 38 mentioned; expect ≈ 10–15 that are mentioned but not asserted) and the action-then-count tests
- `package.json` — `test:journeys` also runs `notifications.mjs`
- `docs/testing/journeys.md` — a second table: type | created by | asserted by | web e2e | mobile e2e

**Approach:** The group units add the client-side e2e for each notification; this unit closes the API side and makes the matrix a CI check so a new type cannot ship untested. `challenge_guide_published` comes from a SQL trigger (migration 109): its creator is found in `supabase/migrations`, and its test inserts through the API path that fires the trigger.

**Patterns:** `route-coverage.test.ts` for "enumerate from source, demand a test".

**Test scenarios:**
- [ ] Happy path: the parser returns exactly 38 types and all 38 have an asserting test; the trigger-created type passes
- [ ] Nil/empty: a type with no creator in `src` or `migrations` → "dead type" failure (candidate for deletion); a parser that finds 0 types fails loudly (source shape changed)
- [ ] Error path: adding a type to the union without a test fails CI; a type removed from the union but still named in a row's `notifies` fails as a stale reference
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

**Goal:** Web e2e stays under 15 minutes in CI with the new specs; if not, shard.

**Requirements trace:** R17

**Dependencies:** U14 (the first and largest web group; measure before the other seven are written)

**Files:**
- `.github/workflows/ci.yml` — `web-e2e` gains `timeout-minutes: 30` and, if needed, `strategy.matrix.shard: [1, 2, 3]` with `playwright test --shard=${{ matrix.shard }}/3`; each leg is its own runner with its own `supabase start`, so legs run in parallel
- `packages/web/playwright.config.ts` — `reuseExistingServer` stays `!CI`; no spec changes (`--shard` splits by file, no tags needed)

**Approach:** Measure after U14 lands (the config's "1.3 min" note predates 137 tests). Shard only if over budget. In CI each job already starts its own Supabase, so a matrix leg has no port contention with the others; the 1-worker limit is per leg. Locally nothing changes: `scripts/e2e.sh` still runs one package at a time against the one local Supabase.

**Patterns:** `mobile-e2e` job; Playwright's built-in `--shard`.

**Test scenarios:**
- [ ] Happy path: a web PR's `web-e2e` finishes under 15 min wall-clock across legs
- [ ] Nil/empty: a leg with no files passes (`--pass-with-no-tests`)
- [ ] Error path: a leg over 30 min is killed (not 6 h); one failing leg fails the job
- [ ] Edge case: `retries: 1` still masks only infra flakes (a real failure fails twice); the failure artifact names the leg

**Verification:** CI run duration visible in the Actions summary before U13 starts.

**Planning-time unknowns:** Deferred — the measured duration and the leg count. Resolved 2026-10-20: `fullyParallel: true, workers: 1` (`playwright.config.ts:31,52`) means `--shard` splits at test level with no spec changes, and each leg starts its own `webServer` pair, so legs are independent.

---

### Unit 23: Close the ratchets

**Goal:** Both ratchets are empty of placeholders, the legacy parser is gone, and the success criteria are checked by hand once.

**Requirements trace:** R4, R7, R9, R13, success criteria

**Dependencies:** everything above

**Files:**
- `scripts/journeys/legacy-file-tags.json` — deleted; `lib.mjs` loses file-level tag support except `(none — …)`
- `scripts/journeys/routes-without-journeys.json` — only permanent, reasoned entries remain; the checker now fails on any `TODO:` reason
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
- **File count:** U1–U7, U11, U20–U23 touch ≤ 8 files. U7b, U8–U10 and U12–U19 touch more, all test files, helpers and the map; they are *series* of one-commit-per-fix changes with no production code except U6. Scope challenge answered: splitting them further would produce units that cannot be verified on their own (a screen group's gaps are only 0 when its rows, tags and specs all land). Accepted as a known exception.
- New abstractions: U2 (AST title tags), U3 (tripwire), U4 (lint), U7b (shared seed module), U20 (notification matrix). One or two per unit, none elsewhere. ✓
- Engineering review 2026-10-20: three P0s fixed in place (AST parsing, the pending-drift exemption, R12 aligned with the PR-check decision); P1s folded into U2, U3, U4, U7b, U9b, U11, U20, U22.
- Planning-time unknowns: all classified; none blocks. ✓
- Handoff test: an engineer invents no product behaviour. Where current behaviour is in doubt, the test records what the app does and the question is in `pending.ts`. ✓

## Order of work

1. U1 → U2 → U3 → U4 (mechanism; CI green throughout because the ratchets start full).
2. U5a → U5b, U6, U7, U7b in any order (api, register, shared seeds; can run alongside 3).
3. U8 → U9a/b/c and U10 (mobile), then U11 (device) once U10 has moved the flow tags.
4. U14 (exchanges) first, then U22 (measure; shard if needed), then U13 (guides), U17 (leader), U18 (admin), U16, U15, U12, U19.
5. U20 → U21 → U23.

Before any "done": `scripts/verify-plan.sh --run --e2e`, the whole `npx jest` for mobile, `pnpm test:journeys`, and `graphify update .`.
