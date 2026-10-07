# Mobile coverage audit — design

Date: 2026-10-07. Requested by Byron mid-run ("vet the entire codebase for the mobile side and ensure that everything is being tested using unit, integration and e2e tests… cover user journeys… admin and contributor sides… notifications… counts accurate and updated live… I will be away, work independently").

Inventory this spec argues from: `.superpowers/coverage-audit/inventory.md` (scout output, 2026-10-07: 87 screen routes, ~215 journeys, coverage map per layer, 22 suspects). It is git-ignored scratch; §3 below moves what matters into the repo.

## 1. What Byron asked for, and what I took it to mean

**Said**
- Every mobile journey ("if a user clicks this button, this chain of events should occur") is covered by unit, integration and e2e tests, including the components it updates and the backend it touches.
- The admin and contributor seats are suspected to be under-tested and possibly unimplemented: the mobile UI may show a state nobody can set.
- Events must produce the right notifications; counts must be accurate and live.

**Assumed (my rulings, written for him to correct later)**
1. "Work independently" authorises the full path: this spec, a plan per sub-project, and execution, without review stops. Every decision is recorded here or in the ledger as `Ruling:`.
2. A *journey* is one interaction and its chain: UI element → handler → API route → DB/storage/RPC → notification rows or email → the counts/badges that must change → who can act on the resulting state. The inventory's journey IDs (A01…Q17) are the unit of coverage.
3. "Tested" per layer means: **unit** renders the screen and drives the handler against mocked `apiClient`; **integration** hits the real API route against local Supabase and asserts rows (including notification rows); **e2e** drives the react-native-web build against the real API and asserts the visible result and, where the journey mutates, the DB row; **device** (Maestro) proves the native layer only where Playwright cannot (gestures, modals, WebView, cold start).
4. "Accurate and live" counts means: every badge/count on screen is refetched on screen focus and after any action in the same session that changes it; an e2e test performs the action and asserts the badge within the flow, never only on first paint.
5. Where mobile shows a state only an admin or contributor can set, the audit decides one of three: **(a)** the setter exists on mobile → test the full round trip; **(b)** the setter exists on web only → document it as web-only in the journey map and test the hand-off at the API/DB layer (seed the admin action through the API, assert what mobile shows); **(c)** nothing can set it → it is a product gap: fix it when the mobile UI already promises the behaviour (a notification type the inbox renders, a link, a count), otherwise record it as a decision for Byron and do not build a new feature unprompted.
6. Bugs the audit finds in the chains it tests are fixed in the same sub-project (one commit per fix, as he prefers), with a regression test. Unrelated refactors are not.
7. Web code changes only where the API/DB change needs a web counterpart to keep the web green (shared types, a web test that asserts the old copy). No new web features.

## 2. Findings that shape the work (from the inventory)

Product gaps the mobile UI already promises (fix, with tests):
- **S1** A leader's Approve / Request changes (`POST /tutorials/:id/review`) and backing accept/decline create no notification; the mobile inbox renders `tutorial_approved`/`tutorial_rejected` tiles that the mobile path never produces.
- **S2** `threadHref` sends print jobs to `/exchanges/:id` instead of `/printing/jobs/:id` (inbox rows, `print_started`/`print_ready` links, My exchanges, Me money line).
- **S4** `org_thanked` links to the review queue, not the org profile editor that has Hide/Show.
- **S18** `collaborator_invited` links to an editor the invitee is not yet on.
- **S6** Stale counts: `invalidateCapabilities` only from the Inbox; Me fetches once; toy editor "N offers" from a mount-time list; library thanks pill; org thanks count incremented client-side.
- **S7** `/admin` has no seat guard; a non-admin deep link shows cards after a swallowed 403.
- **S19** Me renders nothing when `GET /contributors/me` fails, no retry.
- **S15** Maestro `sign-out-clears-session` is stale (taps labels that no longer exist).

Web-only setters to document and test at the hand-off (ruling 5b): challenge idea review/graduation (S13), printer verification (S12), member-report resolution (S11), event registration (S9), org doors/rates/pictures (S20), admin guide review when no org backs the guide (S3).

Decisions left for Byron (ruling 5c, not built): a mobile admin review screen (S3); hiding profile-thanks notes (`/contributors/me/thanks` has no caller, S8); multi-org leader switching (S17); in-app event registration (S9); the dead API routes in S8 (delete or wire); the PENDING mobile features in S14.

Layer gaps: no API test asserts row creation for `toy_request`, `toy_accepted`, `print_started`, `print_ready`, `build_shot_posted`, `build_approved`, `challenge_left`, `challenge_removed`, `idea_rejected` (S16); no e2e for printer-side jobs, build thread after claim, org publish/profile/messages/recycling, toy editor, cost panel, Map, Admin (S22); untested routes `GET /events/mine`, `POST /notifications/me/read`, `GET /notifications/me/unread-counts`, `DELETE …/leaders/invites/:id`, `POST /exchange-costs/:id/receipt`, `GET /admin/build-requests`, `GET /admin/print-jobs`.

## 3. The structure that keeps this honest

A coverage audit that lives in a markdown table rots. The deliverable is a **journey map in the repo with a drift check**:

- `packages/mobile/tests/journeys.ts` — the journey list as data: `{ id, seat, screen, element, api, notifies, counts, setter: 'mobile' | 'web' | 'none', required: { unit, e2e, api, device } }` for every row in the inventory's §2 (the inventory's prose cells become these fields; `required` encodes ruling 3, e.g. a device-only journey needs no API test).
- Tests declare what they cover with a tag: a `// journeys: G23 B04` comment at the top of a unit/e2e/API test file (one line, many IDs). Maestro flows carry `# journeys: …`.
- `scripts/journeys/check.mjs` — reads `journeys.ts` and every test file's tag, and fails listing each journey whose required layers lack a tagged test, and each tag naming an unknown journey. Wired as `pnpm --filter mobile test:journeys` and into the root `test` script so CI runs it. A journey may be marked `waived: '<reason>'` per layer (e.g. "web-only setter; hand-off covered by API test X"), and the check prints waivers so they stay visible.
- `docs/testing/mobile-journeys.md` — generated from `journeys.ts` by `scripts/journeys/render.mjs` (the human-readable map with ✅/❌ per layer and the web-only/none notes). Regenerated in the same script run; a drift test fails if the committed file is stale (same pattern as the STL viewer module).

The audit then becomes: make the check pass, with every ❌ either closed by a test or waived with a reason Byron can read.

## 4. Sub-projects (each gets its own plan and runs to green before the next)

**SP1 — Journey map and drift check.** `journeys.ts` from the inventory (every row, honest `required` flags), the tag convention, `check.mjs`, `render.mjs`, the generated doc, the CI wiring. Tag every existing test file that already covers a journey (the inventory's §4 says which). Exit: the check runs and prints the true ❌ list; nothing is waived yet.

**SP2 — Notification chains.** For every notification type the mobile inbox renders (`lib/notifications.ts` COPY/linkFor), an API integration test that performs the triggering action and asserts the row (recipient, type, link target). Fix S1 (review + backing notifications), S2, S4, S18 while there. Mobile unit tests for `linkFor` on every type. An e2e per seat that performs an action and sees the notification arrive in the other seat's inbox (family→leader, leader→author, printer→requester). Exit: S16's list is empty; `linkFor` has a case per type.

**SP3 — Live counts.** A `useFocusEffect`-driven refetch for Me, the tab badges and the toy editor's offers; `invalidateCapabilities` after every mutating action that changes a badge (accept/decline/withdraw/confirm/send/post); server-derived thanks counts instead of client increments. Fix S7 (admin guard) and S19 (Me retry). E2E for each badge: act, then assert the number changes without a reload. Exit: every `counts` field in `journeys.ts` has an e2e that mutates and asserts it.

**SP4 — Journey e2e by seat.** Three plans: **4a leader** (org publish/unpublish/remove, profile edit, messages both sides, recycling booking → intake → credit, requests tabs, invites cancel/step down), **4b maker/printer** (printer-side accept → started → ready → confirm → fit, build thread claim → working shot → approve → handover, ask-first), **4c family** (toy editor incl. photos/picks/publish/retire, cost panel add/remove/settle, Map search/filters/row, events cancel, account fields, saved unsave, explore doors). Each test seeds through the API helpers, drives the UI, asserts the DB row and the counterpart's view. Exit: S22 is empty.

**SP5 — Web-only hand-offs and unit gaps.** For each 5b item: an API integration test that performs the web/admin action through the API and asserts what the mobile endpoints then return (idea approved → `/ideas/mine` status; printer verified → `/printers` shield; report resolved → … nothing today, so a waiver with the decision for Byron). Unit gaps L26, Z10, P02-unfollow. Document each `setter: 'web'` and `'none'` row with its waiver. Exit: every journey is ✅ or waived with a reason.

**SP6 — Device flows.** Fix `sign-out-clears-session`; add flows for the feedback sheet post (modal over modal), the note menu → report on iOS, the 3D viewer, an inbox badge update after a seeded notification, and a cold-start deep link into a pushed screen. Run on the iPhone (`iphone-qa start`). Exit: every `required.device` journey has a passing flow or a waiver.

Order: SP1 → SP2 → SP3 → SP4a → SP4b → SP4c → SP5 → SP6. SP6 needs the device and Java 17 for Maestro; if unavailable it ships the flows unrun and says so.

## 5. Non-goals
- New mobile features (admin review screen, event registration, multi-org switching, thanks hiding) — listed as decisions, not built.
- Web UI changes beyond keeping web tests green.
- Rewriting existing passing tests for style.
- Performance work (the slow guide loads noted on 2026-10-06 stay on their own list).

## 6. Testing the audit itself
`check.mjs` has unit tests (a journey with a missing required layer fails; a waived layer passes and prints; an unknown tag fails; a stale rendered doc fails). The scripts are run in CI on every push.

## 7. Constraints carried from memory
Agents on sonnet/haiku only; e2e specs import only from `tests/e2e/*` and `lib/`; never run web and mobile e2e concurrently; Playwright started via `node_modules/.bin`; one commit per fix; nothing pushed without Byron; author content never rewritten; theme tokens only.
