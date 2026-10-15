# Web ↔ Mobile Parity — Implementation Plan

**Date:** 2026-10-16 · **Requirements:** `web-mobile-parity-requirements.md` (R1–R17)

## Architecture (one page)

No new architecture is needed. Every web flow in scope already goes through `packages/api`. The web uses `apiClient` and `browserApiClient`, and the phone uses `lib/api-client.ts`. So each phone screen is a thin route file in `packages/mobile/app/`, a `components/<area>/*-screen.tsx`, and calls to routes that already exist. There are three exceptions:

1. **Notifications (Units 10–12).** Migration `137_parity_notifications.sql` adds three types: `backing_accepted`, `backing_declined` and `report_resolved`. It also adds a `member_report_id` subject column. A type is defined in four places that must change together: the database CHECK constraint (with the guard pattern from 117), `NotificationType`, `NOTIFICATION_BUCKET` and `COPY` in `packages/types/src/index.ts`, and the web `ICON` map and `linkFor` plus the phone `linkFor` and `TYPE_TILE`.
2. **The acting organisation (Units 15–17).** A hook replaces every `caps.ledOrgs[0]`. On the phone it is `useActingOrg()`, stored in SecureStore with a key of letters, digits, `.`, `-` and `_` only. On the web it is a cookie, `splat_acting_org`, because the leader pages are server components and can't read localStorage. Both fall back to the first led org when the stored id is no longer one the person leads. The switcher renders only for people who lead two or more organisations.
3. **Org image upload (Unit 14).** `lib/upload.ts` gains the `/api/upload/org-image` path and extra multipart fields.

Data flow is unchanged. API routes write with the admin client where notifications are involved, as `review-notifications.ts` already does.

## Units

Order: Unit 0 (mockups) gates Units 4, 8 and 15. Units 10–12 are sequential. Unit 18 runs last. Everything else is independent and can run in parallel.

### Unit 0: Mockups for the three new layouts
**Goal:** Byron signs off the event detail and register screens, an admin queue, and the org switcher before they're built.
**Requirements trace:** R17, R1, R14, R5. **Dependencies:** none.
**Files:** design boards only, made with the real Button, list-kit and RowCard radii, fonts and elevation.
**Approach:** Read the memories `soft-pop-source-of-truth` and `render-canvas-boards-locally` first. Render each board locally and compare it against the app before showing it.
**Test scenarios:** [ ] each board uses the real components' radii and fonts · [ ] dark-mode variant drawn · [ ] empty and full states drawn (a sold-out event, an empty queue).
**Verification:** Byron approves all three. **Unknowns:** none.

### Unit 1: Stale copy, new registry item, delete the singular unread count
**Goal:** Remove copy that is out of date, register `edit-event-story`, and delete `GET /api/notifications/me/unread-count`.
**Requirements trace:** R8, R10, R11. **Dependencies:** none.
**Files:** `packages/mobile/components/my-tutorials/list-screen.tsx` (drop the line 187 footnote), `packages/types/src/pending.ts` (add `edit-event-story` with `kind: build` on web and mobile), `packages/api/src/routes/notifications.ts` (delete the route at about line 33), `packages/api/tests/integration/notifications/notifications-endpoints.test.ts` (delete its case), `docs/PENDING.md` (regenerate).
**Approach:** Confirm the route has no callers with `grep -rn "unread-count\b" packages`. `me/unread-counts` stays.
**Test scenarios:** [ ] `pending-features.test.ts` passes · [ ] the notifications suite passes without the case · [ ] the route-coverage ratchet test still passes after the removal.
**Verification:** grep finds no callers, and the test suites are green. **Unknowns:** none.

### Unit 2: Event detail screen on the phone
**Goal:** A public event page on the phone, where registration starts.
**Requirements trace:** R1, R13. **Dependencies:** Unit 0.
**Files:** `packages/mobile/app/events/[id].tsx` (new), `components/events/event-detail-screen.tsx` (new), `components/organisation/org-profile-screen.tsx` (make the event rows at about line 165 pressable), the Map tab's event pin (link to the detail screen), `lib/notifications.ts` (event types link to the detail screen, not the org profile), `components/organisation/org-news-screen.tsx`, `tests/unit/components/events/event-detail-screen{,-failure}.test.tsx`.
**Approach:** The route sits outside `(my)`, so guests can read it. A signed-out "I'm going" goes to sign-in and comes back to the event. `GET /api/public/events/:id?viewer=`. Show the same capacity copy as web's `get-involved/events/[id]/page.tsx`: "This one is full", "N seats left", "Everyone is welcome", plus the closed and cancelled states. Show cost and `cost_note`. The "I'm going" button posts directly when the event has no questions, as `event-rsvp-button.tsx` does. Otherwise it pushes the register screen. When `viewer_going` is set, show "Can't make it" (DELETE).
**Patterns:** layout follows the approved mockup. Data loading follows `my-events-screen.tsx`.
**Test scenarios:** [ ] open event with seats shows the seat count and "I'm going" · [ ] full or closed or cancelled event shows its message and no button · [ ] 404 shows "No such event." · [ ] the viewer already going sees "Can't make it".
**Verification:** an event can be reached from all three entry points in the simulator. **Unknowns:** whether the Map pin component already accepts an href (deferred to implementation).

### Unit 3: Register screen with the organiser's questions
**Goal:** A member registers on the phone, answering the organiser's questions.
**Requirements trace:** R1. **Dependencies:** Unit 2.
**Files:** `packages/mobile/app/events/[id]/register.tsx`, `components/events/event-register-screen.tsx`, `components/events/my-events-screen.tsx` (delete the `PENDING(event-registration-mobile)` comment at line 51), `tests/unit/components/events/event-register-screen{,-failure}.test.tsx`.
**Approach:** Port `web/components/event-register-form.tsx`. Name and email are prefilled from the profile. Each question type gets its control: choice uses Chip, boolean a switch, paragraph and short a TextField, number a numeric TextField. Required questions block confirm, and when `cost_cents > 0` there is a cost tick box. `POST /api/events/:id/registrations`. Show the server's 400 and 409 sentences word for word, and on success go to My events.
**Patterns:** `event-form-screen.tsx`'s question editor, used in reverse.
**Test scenarios:** [ ] all question types render and submit the right `answers` shape · [ ] a blank required question blocks confirm · [ ] the 409 "This one is full…" shows inline · [ ] the cost box is required only when there is a cost.
**Verification:** register on the simulator and the registration appears in web's leader list. **Unknowns:** none.

### Unit 4: Leader registrations list and part queue on the phone
**Goal:** A leader sees who registered, with their answers, and accepts or declines print-at-event part requests.
**Requirements trace:** R2. **Dependencies:** Unit 0 (uses the queue layout), Unit 15.
**Files:** `packages/mobile/app/(my)/organisation/events/[id].tsx`, `components/organisation/event-registrations-screen.tsx`, `components/organisation/org-publish-screen.tsx` (event rows link to the new screen), `app/(my)/_layout.tsx` (declare the screen), `tests/unit/components/organisation/event-registrations-screen{,-failure}.test.tsx`.
**Approach:** `GET /api/organizations/:orgId/events/:id/registrations` and `/questions`. The org is the acting org. Show going and seat stats, one row per registrant with their answers expandable, and part requests with accept and reject (`POST /api/toy-transactions/:id/accept|reject`). Web's CSV export stays web-only: a file download on a phone has no destination. The screen says so in one line.
**Test scenarios:** [ ] the list renders answers by question label · [ ] no registrations shows an EmptyState · [ ] a failed accept rolls back and shows the error · [ ] a 403 for a non-leader shows the "leaders only" state.
**Verification:** a registration made in Unit 3 appears here. **Unknowns:** none.

### Unit 5: Print-at-event on both platforms
**Goal:** A family asks to have a guide's parts printed at an event, which wires `POST /api/toy-transactions/print-at-event`.
**Requirements trace:** R7. **Dependencies:** Unit 2.
**Files:** `packages/mobile/components/events/event-detail-screen.tsx` (a "Print parts here" action when the event prints parts), `components/events/print-at-event-screen.tsx` and its route, `packages/web/app/get-involved/events/[id]/page.tsx` plus a new `components/print-at-event-form.tsx`, `packages/api/tests/integration/toy-transactions/print-at-event.test.ts` (new; take the route off the UNTESTED ratchet in `route-coverage.test.ts`), plus mobile and web unit tests.
**Approach:** Pick a guide (from the person's saves or a search), its STL files, part sets and a note, then POST. The leader side already exists on web (`event-part-queue.tsx`) and comes to the phone in Unit 4.
**Test scenarios:** [ ] happy path creates a transaction that shows in My events · [ ] an event that doesn't print parts hides the action · [ ] a validation error (no STL selected) is shown · [ ] the integration test covers 201, 400 and 403.
**Verification:** the transaction appears in the leader's part queue on both platforms. **Unknowns:** where the guide picker sources its list from (deferred; use saves first).

### Unit 6: Admin guide review on the phone
**Goal:** An admin approves a guide or requests changes on the phone.
**Requirements trace:** R3, R14. **Dependencies:** none.
**Files:** `packages/mobile/app/(my)/admin/review/index.tsx` and `[id].tsx`, `components/organisation/review-detail-screen.tsx` (an `admin` mode using `adminActions` that calls `PATCH /api/admin/tutorials/:id/status`), `components/organisation/review-queue-screen.tsx` (drop the `PENDING(admin-guide-review-screen)` empty state and send admins to the admin queue), `lib/notifications.ts` (`linkFor(n, isAdmin)`, matching web), `app/(my)/_layout.tsx`, `tests/unit/lib/notifications-types.test.ts`, and review-detail tests.
**Approach:** The queue is `GET /api/admin/tutorials?status=pending`, built from list-kit rows. The detail screen reuses review-detail-screen. Requesting changes requires a note, as the leader path does (the API doesn't require one, but the phone does). Unpublish on an approved guide goes in Unit 8 (spot-check).
**Test scenarios:** [ ] approve calls PATCH with `approved` · [ ] request changes with an empty note is blocked · [ ] an admin's `tutorial_submitted` notification opens `/admin/review/:id` · [ ] a non-admin leader still gets the leader flow.
**Verification:** a guide submitted on web is approved on the phone. **Unknowns:** none.

### Unit 7: Member reports and ideas queues on the phone
**Goal:** Two admin cards open phone queues.
**Requirements trace:** R14. **Dependencies:** Unit 0.
**Files:** `packages/mobile/app/(my)/admin/reports.tsx`, `admin/ideas/index.tsx` and `[id].tsx`, `components/admin/member-reports-screen.tsx`, `components/admin/ideas-review-screen.tsx`, `app/(my)/admin.tsx` (these two cards push phone routes), `app/(my)/_layout.tsx`, plus unit tests.
**Approach:** Reports: `GET /api/admin/member-reports`, with a status pill (new, looking, resolved), and `PATCH /api/admin/member-reports/:id` with `note_to_reporter`, as `web/components/admin-reports.tsx:78` does. Ideas: `GET /api/admin/ideas` and `PATCH /api/admin/ideas/:id/status` (`challenge` or `rejected` plus `review_note`). Graduate is `POST /api/admin/ideas/:id/graduate`, and a 409 shows as "Already graduated".
**Test scenarios:** [ ] resolving a report sends the status and the note · [ ] an empty queue shows an EmptyState · [ ] rejecting an idea without a note is blocked · [ ] a graduate 409 shows its message.
**Verification:** both cards open phone screens, and `admin.test.tsx` is updated. **Unknowns:** none.

### Unit 8: Spot-check, accounts and organisations queues on the phone
**Goal:** The remaining three admin cards open phone queues.
**Requirements trace:** R14. **Dependencies:** Units 0 and 6.
**Files:** `packages/mobile/app/(my)/admin/spot-check.tsx`, `admin/accounts.tsx`, `admin/organisations.tsx`, the matching `components/admin/*-screen.tsx` files, `app/(my)/admin.tsx` (all six cards go native; drop the "Opens on the web." hint and the `Linking` import), plus unit tests.
**Approach:**
- Every admin screen relies on the API's `is_admin` guard. The tests mock a 403 and the screen shows "Admins only"; no client-side check stands in for the server one.
- Spot-check: `GET /api/admin/spot-check`, with unpublish requiring a note (via the tutorial status PATCH).
- Accounts: `GET /api/admin/contributors`, searchable, with delete behind a confirm. A 409 `sole_leader` shows "Make someone else a leader first."
- Organisations: list, create, edit, and add or remove a leader, through the admin organisations routes.
**Test scenarios:** [ ] unpublishing without a note is blocked · [ ] an account delete 409 shows the sole-leader copy · [ ] a leader added shows in the list · [ ] the 1000-account cap shows "Showing first 1000".
**Verification:** `grep "Opens on the web" packages/mobile` finds nothing. **Unknowns:** none.

### Unit 9a: A participant report hides the person until an admin decides
**Goal:** Reporting someone on a challenge hides them from the reporter only. Removal happens when an admin decides (Byron, 2026-10-16: "Hide until reviewed").
**Requirements trace:** R7. **Dependencies:** none.
**Files:** `packages/api/src/routes/toy-ideas.ts` (`POST /:id/reports` stops calling the participant update, the system message and the `challenge_removed` insert), the idea thread and participant reads in the same file (filter out messages and profiles the viewer has an unresolved report against), `packages/api/src/routes/admin.ts` (`PATCH /reports/:id` takes `{resolution_note, action: 'remove'|'dismiss'}`; `remove` runs the removal, system message and notification moved here; keep the `.is('resolved_at', null)` once-only guard), `packages/api/tests/unit/routes/toy-ideas.test.ts`, `packages/api/tests/integration/admin/reports.test.ts`, `packages/api/tests/integration/toy-ideas/report-participant.test.ts` (new; take the route off UNTESTED).
**Approach:** Reporting the author no longer removes the reporter. The report is filed, the author is hidden from the reporter, and the reply offers "Leave this challenge" as a separate action. The notification actor stays "SPLAT", and the reporter is never named.
**Test scenarios:** [ ] after a report, the reporter's thread read excludes the reported person and everyone else's doesn't · [ ] `action: remove` removes them, posts the system message and notifies once · [ ] `action: dismiss` un-hides them for the reporter · [ ] a double resolve acts once (404 on the second).
**Verification:** API integration suite green. **Unknowns:** none.

### Unit 9b: Report, idea reports queue, reinstate and "My reports" screens
**Goal:** Wire the report-participant, idea-reports and reinstate routes on both platforms, plus "my reports".
**Requirements trace:** R7. **Dependencies:** Units 7 and 9a.
**Files:** the mobile challenge thread and `packages/web/components/challenge-thread.tsx` (a "Report" action on a participant; the confirm reads "You won't see them here any more. SPLAT will look at it, and they won't see your name."), `components/admin/member-reports-screen.tsx` and `web/app/admin/reports/page.tsx` (an "Idea reports" tab with Remove, Dismiss and, for already-removed people, Reinstate via `DELETE /api/admin/ideas/:id/participants/:profileId/removal`), new mobile `components/me/my-reports-screen.tsx` and web `app/dashboard/reports/page.tsx` (`GET /api/reports`, status and `note_to_reporter`), plus `my-routes.ts`.
**Test scenarios:** [ ] the report sheet requires a reason · [ ] Remove, Dismiss and Reinstate each call the right route and update the row · [ ] My reports shows the resolved status and the note · [ ] no reports shows an EmptyState.
**Verification:** on web, report a participant, they vanish for the reporter only, and an admin removes or dismisses them. **Unknowns:** none.

### Unit 10: Migration 137, three notification types
**Goal:** The database and the types package learn `backing_accepted`, `backing_declined` and `report_resolved`.
**Requirements trace:** R6, R9. **Dependencies:** none.
**Files:** `supabase/migrations/137_parity_notifications.sql`, `packages/types/src/index.ts` (`NotificationType`, `NOTIFICATION_BUCKET`, `COPY`), `scripts/check-schema-guards.sh`, `packages/web/tests/unit/lib/notification-bucket.test.ts` (33 → 36).
**Approach:** Copy 117's guard: check the live constraint, abort if a value would be dropped, then re-add the full list. Add `member_report_id uuid references member_reports(id) on delete cascade` and put it in `notifications_one_subject`. Backing notices use `tutorial_id`. Copy: "{Org} agreed to back {guide}", "{Org} can't back {guide} right now", "Your report was looked at".
**Test scenarios:** [ ] the migration applies on a fresh `supabase db reset` · [ ] the schema guard finds the three values and the column · [ ] an insert with two subjects fails the check.
**Verification:** applied locally, then `supabase db push` to hosted, then assert the objects exist (never trust the ledger). **Deploy order:** 137 must be on hosted *before* the API from Units 11 and 12 deploys, or every insert fails the CHECK and is only logged. CI deploy secrets are unset, so this push is a manual step. **Unknowns:** none.

### Unit 11: Send backing notifications
**Goal:** Accepting or declining a backing notifies the guide's author.
**Requirements trace:** R6. **Dependencies:** Unit 10.
**Files:** `packages/api/src/routes/tutorial-orgs.ts` (`answer()` at about line 123; drop the `PENDING(backing-notifications)` comment), `packages/api/src/review-notifications.ts` (`notifyBacking()`), `packages/api/tests/unit/review-notifications.test.ts`, and an integration test for accept and decline.
**Test scenarios:** [ ] accept inserts `backing_accepted` for the author · [ ] decline inserts `backing_declined` · [ ] answering a backing that was already answered sends nothing · [ ] a failed insert is logged and doesn't fail the answer (the answer is the thing the leader did).
**Verification:** the notification appears in the author's inbox on both platforms. **Unknowns:** none.

### Unit 12: Send report_resolved, and copy and links on both platforms
**Goal:** Resolving a member report tells the reporter, and all three new types render on web and the phone.
**Requirements trace:** R9, R6. **Dependencies:** Units 9b and 10.
**Files:** `packages/api/src/routes/admin.ts` (the member-reports PATCH at about line 775 sends on the transition to `resolved`), `packages/api/tests/integration/admin/reports.test.ts`, `packages/web/components/notifications-list.tsx` (`ICON` and `linkFor`: report goes to `/dashboard/reports`, backing to the guide), `packages/mobile/lib/notifications.ts`, `packages/mobile/components/inbox/inbox-screen.tsx` (`TYPE_TILE`), `packages/mobile/tests/unit/lib/notifications-types.test.ts`.
**Test scenarios:** [ ] resolved → one notification to the reporter · [ ] "looking" or a re-save while already resolved sends nothing · [ ] a report with no reporter (a deleted account) sends nothing and doesn't error · [ ] each new type links to the right place on both platforms.
**Verification:** resolve on the phone (Unit 7), and the reporter sees it on web. **Unknowns:** none.

### Unit 13: Thank-you notes, written, listed and hidden
**Goal:** A note can be written when thanking a person, and the contributor can hide or show it.
**Requirements trace:** R4. **Dependencies:** none.
**Files:** `packages/mobile/components/people/thank-button.tsx` (an optional note sheet that posts `{note}`), `packages/web/app/contributors/[id]/page.tsx` plus a new `components/person-thanks-button.tsx`, `packages/mobile/components/me/thanks-notes-screen.tsx` and its route, `packages/web/app/dashboard/thanks/page.tsx`, the `my-routes.ts` line, plus unit tests.
**Approach:**
- The list copies the org thanks block in `org-profile-edit-screen.tsx` and web's `org-thanks-notes.tsx`, using `GET /api/contributors/me/thanks` and `PATCH …/:thankerId {hidden}`.
- Drop the `PENDING(profile-thanks-hide)` comment in `contributors.ts`.
- Fix the registry blurb, which wrongly says notes show on the profile.
- Notes are private to the thanked person (migration 117). The sheet says so: "Only they will see this."
**Test scenarios:** [ ] posting with and without a note · [ ] hiding toggles and survives a reload · [ ] no notes shows an EmptyState · [ ] a PATCH 404 shows an error and doesn't flip the row.
**Verification:** thank a person with a note on web and hide it on the phone. **Unknowns:** whether the hub gets its own row or the list sits inside the profile edit screen (deferred to implementation; default to a hub row).

### Unit 14: Org pictures, doors, rates and the remaining fields on the phone
**Goal:** The phone's organisation edit screen covers everything the web form does.
**Requirements trace:** R12. **Dependencies:** Unit 15 (acting org).
**Files:** `packages/mobile/lib/upload.ts` (an `org-image` path, `uploadFile` takes an extra-fields record), `components/organisation/org-profile-edit-screen.tsx` (logo and cover pickers, doors up to 6, rate lines up to 20, payment methods, capabilities, recycling materials and note; drop the line 134 copy), `tests/unit/lib/upload.test.ts`, and the org-profile-edit tests.
**Approach:** Pictures use `pickPreviewedPhoto` then `POST /api/upload/org-image`, and the API writes `{slot}_url` itself. Clearing a picture sends `logo_url: null` on the profile PATCH. Doors and rates are full-replace PUTs, so the screen keeps local arrays and saves them once. If the screen is longer than about 300 lines, move each section to `organisation/sections/*.tsx`, as `my-tutorials/sections` does.
**Test scenarios:** [ ] the upload sends `orgId`, `slot` and `file` · [ ] a seventh door or 21st rate line is blocked · [ ] a failed PUT keeps local edits and shows the error · [ ] cents round-trip when the person types "$4.50".
**Verification:** edit everything on the phone, and web shows the same values. **Unknowns:** none.

### Unit 15: The acting organisation, hook and switcher on the phone
**Goal:** A person who leads two or more organisations picks which one they're acting for, and the phone remembers it.
**Requirements trace:** R5. **Dependencies:** Unit 0.
**Files:** `packages/mobile/lib/acting-org.tsx` (a provider and `useActingOrg()`, SecureStore key `acting_org_id`, copying `lib/home-shortcuts.ts`'s storage handling so the Expo web export used by the parity harness and e2e still works), `app/_layout.tsx` (mount the provider), the Organisation hub screen (the switcher, only when `ledOrgs.length > 1`), `tests/unit/lib/acting-org.test.tsx`.
**Test scenarios:** [ ] one org gives no switcher and returns it · [ ] a stored id still in `ledOrgs` is returned · [ ] a stored id the person no longer leads falls back to `[0]` and clears the store · [ ] no orgs returns null.
**Verification:** with a second org seeded for the parity leader, switching changes the hub heading. **Unknowns:** none.

### Unit 16: Phone leader screens read the acting org
**Goal:** No phone screen uses `ledOrgs[0]` any more.
**Requirements trace:** R5. **Dependencies:** Unit 15.
**Files:** `org-publish-screen.tsx`, `event-form-screen.tsx`, `story-form-screen.tsx`, `org-profile-edit-screen.tsx`, `recycling/intake-screen.tsx`, `app/(my)/organisation/orders.tsx`, `inventory-screen.tsx` (toy-add CTA), `org-requests-screen.tsx`, `review-queue-screen.tsx` (heading). That's nine files, so split it into 16a (forms) and 16b (lists) to stay under the eight-file limit.
**Approach:** Swap the expression only. Screens that are already multi-org aware stay as they are. Drop the `PENDING(multi-org-leader-switch)` references. Add a guard test that greps `packages/mobile/{app,components}` for `ledOrgs[0]` and fails on any hit outside `acting-org.tsx`.
**Test scenarios:** [ ] each screen's existing tests pass with the hook mocked · [ ] the guard test fails on a planted `ledOrgs[0]` · [ ] switching the org re-fetches the list screens.
**Verification:** the guard test is green and grep finds no hits. **Unknowns:** none.

### Unit 17: The acting organisation on web
**Goal:** The same choice on web, held in a cookie the server pages read.
**Requirements trace:** R5. **Dependencies:** Unit 15 (to share the behaviour).
**Files:** `packages/web/lib/acting-org.ts` (`actingOrg(caps)`, which reads the `splat_acting_org` cookie with the same fallback), a switcher server action plus the component on `dashboard/organisation/page.tsx`, and the about eight `[0]` pages (`events/new`, `stories/new`, `orders`, `profile`, `publish`, `recycling`, `org/events/[id]`, `requests`). Split it into 17a (lib and switcher) and 17b (pages).
**Test scenarios:** [ ] a cookie for an org the person doesn't lead is ignored · [ ] no cookie gives `[0]` · [ ] the guard test bans `ledOrgs[0]` in `packages/web/app`.
**Verification:** the web e2e for a two-org leader passes. **Unknowns:** none.

### Unit 18: Close-out
**Goal:** The registry, routes, harness and docs agree, and everything is verified.
**Requirements trace:** R15, R16, R17. **Dependencies:** all of the above.
**Files:** `packages/types/src/pending.ts` (mark the six `shipped: true`), `docs/PENDING.md`, `packages/mobile/lib/my-routes.ts`, `scripts/parity/mobile-extra.json` and `app-screen-map.json` (the new screens), `.maestro/flows/` (register and admin-review flows), `scripts/parity/seed.js` (a second led org and an event with questions).
**Test scenarios:** [ ] `pending-features.test.ts` passes · [ ] the my-routes and me tests show no SOON · [ ] the app harness stays at 0 findings, and the web harness is re-run after any shared fingerprint change.
**Verification:** run the full `npx jest` in `packages/mobile`, then `scripts/verify-plan.sh --run --e2e`. Web and mobile e2e never run at the same time, and the parity stack is stopped before e2e. Then run `graphify update .`.

## Review findings (Phase 5, Hold Scope)

| # | Sev | Finding | Resolution |
|---|-----|---------|------------|
| 1 | P1 | Reporting a participant removed them immediately and anonymously, and wiring it exposes that | Byron chose hide-until-reviewed, so Unit 9 split into 9a (API) and 9b (screens) |
| 2 | P1 | API that writes new notification types deploying before migration 137 is on hosted fails silently | Deploy order written into Unit 10 |
| 3 | P1 | SecureStore isn't available in the Expo web export the harness and e2e use | Unit 15 copies `home-shortcuts.ts`'s storage handling |
| 4 | P1 | A guest on the public event page had no defined path to register | Unit 2: sign-in, then return |
| 5 | P2 | Older installed phone builds show the generic copy and an `/inbox` link for the three new types | Accepted: `copyFor` and `linkFor` fall back safely |
| 6 | P2 | Print-at-event doesn't check the requester is registered for the event | Accepted: it matches web's flow, so no change is in scope |
| 7 | P2 | Admin screens could appear to rely on hiding the cards | Unit 8: a 403 test on each screen, and the server guard is the only check |

**Design review (0–10):** Clarity 8 · Hierarchy 7 · Consistency 8 · Feedback 8 · Error recovery 8 (server sentences shown word for word) · Empty states 9 (every list unit tests one) · Accessibility 6. To raise accessibility to 10, every new pressable gets `accessibilityRole` and `accessibilityLabel`, the switcher announces the acting org's name, and the register form's required questions say "required" to screen readers. These are added to each unit's tests in review. Hierarchy reaches 10 through Unit 0's sign-off.

**Engineering review:** No route is new except the 9a and 12 changes. The guard tests in Units 16 and 17 make `ledOrgs[0]` impossible to bring back. Coverage gaps closed: print-at-event and report-participant come off the UNTESTED ratchet (Units 5 and 9a). The CSV export stays web-only, said so on screen. Not covered by automation: real-device SecureStore (one on-phone check in Unit 18), and the hosted migration (asserted by query).

## Quality bar

- Every unit traces to a requirement, and the dependencies form a DAG (0 → 2 → 3, 5; 0/15 → 4; 10 → 11; 9a → 9b; 7 → 9b → 12; 10 → 12; 15 → 14, 16, 17; all → 18).
- Every unit has at least 3 test scenarios. Units 16 and 17 are pre-split to stay at 8 files or fewer.
- New abstractions number two in all: the acting-org hook (once per platform) and the upload extra fields. Everything else is a screen.
- Handoff test: an engineer still has to make the visual choices for the three mockup screens (Unit 0 gates them), choose the guide picker's source in Unit 5, and decide where the thanks list sits in Unit 13. All three are recorded above.
