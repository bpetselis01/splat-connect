> Snapshot of the mobile map audit, 2026-10-20, against HEAD cea425f2 vs a518a327. Source for the mobile re-base (drift table, stale rows, wrong and loose tags, fan-out files). The living map is docs/testing/journeys.md, generated from scripts/journeys/journeys.json.

# Mobile journey map audit ("0 gaps"), HEAD vs a518a327

Method: throwaway scripts in the scratchpad (idx.mjs builds the tag index with scripts/journeys/lib.mjs parseTags; sel.json is the 50-row sample; stale.mjs checks API paths). `node scripts/journeys/check.mjs` reproduces "253 journeys, 0 gaps" and 1 waiver (A03 api). Nothing in the repo was modified. Classifications come from test titles plus assertions I grepped; a few are judgement calls.

## PART A: DRIFT

journeys.json changed twice after a518a327: 2026-10-07 (A03 waiver, Y07) and 2026-10-16 (f4988fae, which added only Q18 and Q19). The 20-unit parity plan (2026-10-16) and the 2026-10-19 work added no other rows. `git diff --stat a518a327 HEAD` on app + components: 154 files, +6474/-1152; 25 new route files; 242 mobile commits.

### A2. New or changed screens and elements vs rows

| Route / element | Added in | Journey row? |
|---|---|---|
| /events/[id] event detail (I'm going, capacity, cancelled states) | 06c3df93 | MISSING (V01-V03 are "My events" only) |
| /events/[id]/register (organiser questions, 409 full) | 381a01ff | MISSING |
| /events/[id]/print (print parts at an event) | 381a01ff / 5ce2188a | MISSING |
| (my)/organisation/events/[id] registrations list + part queue | 6781277e | MISSING |
| (my)/organisation/events/[id]/edit, stories/[id]/edit (edit saved event/story) | 87fa36be | MISSING (L19/L20 are "New" only) |
| acting-org switcher (Me tab; every leader screen now acts for the chosen org) | 76cf593c, 187add38 | MISSING |
| admin/accounts | 653845e8 | MISSING |
| admin/organisations index, [id], new | 71afafe3 | MISSING |
| admin/ideas index + [id] (approve/reject/challenge) | 2f218f82 | MISSING |
| admin/reports index + [id] (member reports) | 2f218f82 | MISSING |
| admin/reports/idea/[id] (Remove, Dismiss, Reinstate) | 9d0011ba | MISSING |
| admin/spot-check + Unpublish | cd56040f | MISSING |
| admin/review queue + detail | f4988fae | Q18, Q19 (present) |
| Q17 "Admin cards -> web" | ff0480e5 | STALE: all six cards now push phone routes (app/(my)/admin.tsx:64 router.push(card.route)); row still says web |
| (my)/reports My reports (+ report_resolved notice) | 74623fb0, 964a63be | MISSING |
| (my)/thanks Thank-you notes with Hide/Show | 1546ec8a | MISSING (L24 is the org-leader side) |
| ThankButton optional note | 74ac01f1 | S02/P04/Y07 exist but name no note field |
| (my)/tutorials/[id]/collaborators (invite, remove, leave) | d867d41f, fd1733e7 | MISSING (Q08/Q09 are the invitee side only) |
| (my)/tutorials/[id]/photos (own route; photos split from Files) | ce50eabb | T13 still describes it correctly |
| Hub Collaborators / Recommendations rows | d867d41f | T04 generic "hub section row", no specific row |
| Declare-safe confirm (can't be undone) | 3e20997f | T12 exists; the new confirm step is not in the row |
| Build-time slider, InfoHint, customization fields, step PDF pick in place | 7e6080d3, 11f77cb6 | T08/T10 do not mention them |
| T20 save chip "Try again" | eb1338a6 | STALE: save-chip.tsx is now an animated icon with no press target and no "Try again" text; the retry lives in the section's ErrorRow |
| challenges/report-participant (report a person in a challenge) | 372e0295 | MISSING |
| org edit sections: pictures, doors, rates, offers, capabilities, recycling | a01d5e30 | L23 "Save and publish" only; sub-sections MISSING |
| linkFor(n, isAdmin), 3 new notification types (backing_accepted, backing_declined, report_resolved), event moved/cancelled notices | a65f6f32, 0887fe0a, 623e6326 | Q06 and notifies lists omit them |
| Inbox changes (inbox-screen +61 lines) | 2026-10-16 | Q05-Q10 not updated |

Count: 17 screens/features with NO row (events x5, acting org, admin x6 groups, My reports, Thanks notes, Collaborators, report-participant, org edit sections), 2 stale rows (Q17, T20), about 6 changed elements the rows don't describe. Q18/Q19 are the only drift fixes. Many new screens do have unit tests (admin/*.test.tsx, events/*, me/*, acting-org-switcher, event-registrations) but none carries a `journeys:` tag, so the check cannot see them. 158 unit test files carry no tag at all (1 uses the "(none" opt-out).

### A1. Reachability sweep
All 121 route files under app/ are reachable. Apart from the table above, every route maps to a row by screen name (terms.tsx = A11/A12, onboarding/child.tsx = Z09, news/[kind]/[id] = L30).

### A3. Reverse check
Every `/api/...` path named in all 253 rows still appears in packages/mobile/{app,components,lib} (prefix match; stale.mjs reported 0 missing). All 27 notification type names still exist in api/types/mobile source. I opened the components for Q17, T20, T12, T13, L19, Q06, H01, G15, X08, K10, Q08 and the other 40-odd sampled rows (via their tests). Wrong or stale: Q17, T20. Partial: T12, L19 (now also an edit mode), Q06.

## PART B: TAG QUALITY

### B1. Index and fan-out
638 test files across the four layers (unit, e2e, api, flows). Files tagging more than 6 ids (26): e2e guides-authoring-edges 13, auth 12, printing 9; api auth-codes 9, build-chain 9, org-profile-social 9; unit build-thread-screen-edges 8, build-thread-screen-failure 8, challenges/detail-screen 8, org-profile-screen 8; api exchange-chain 8, printers 8, toy-transactions/builds 8; then 7 each: unit exchanges/thread-screen, home/detail-screen; e2e auth-edges, exchanges, guides-authoring-sections, guides-authoring, me-and-explore, org-public-actions, organisation, print-job-printer; api print-chain, saves; device guide-page.
106 (journey, layer) pairs get ALL their unit or e2e coverage from such a file: 72 e2e, 34 unit. Examples: A01-A13 e2e only via auth/auth-edges; every T01-T22 e2e only via the guides-authoring files; R01-R19 e2e only via printing/print-job-printer; G13 G14 G15 G18 G19 G30 unit only via home/detail-screen.test.tsx (56 tests); C05-C11 and K06-K13 unit only via 8-id screen files. A file-level tag cannot say which test covers which journey.

### B2. Sample of 50 (at least 2 per screen group; biased to rows with api/notifies/counts, plus 8 fan-out-file rows)
O = OUTCOME, I = INTERACTION, R = RENDER, W = WRONG, "-" = layer not required. One row per journey; letters are Unit / E2E / API.

| ID | Element | U | E | A | Evidence / comment |
|---|---|---|---|---|---|
| A04 | create-account submit | O | O | O | auth-screens.test:101 signUp called with (email,pw,name); auth.spec new account confirmed by code lands on Guides; auth-codes.test:44 |
| A06 | email me a sign-in code | O | O | O | sendSignInCode toHaveBeenCalledWith(email) (:283); e2e emailed code signs in |
| H01 | Today card/inbox chip | O | O | O | mockPush('/inbox') (:126); e2e badge+card drop by rows read |
| H07 | tab bar tap | O | I | O | unit: label carries true count, navigate called; e2e navigation.spec only "tab bar reaches every tab", no badge assert |
| G09 | detail Thank | W | O | O | tagged detail-screen-actions.test.tsx only mocks the /thanks GET; the Thank tests are in detail-screen.test.tsx (:436, untagged). e2e POST 201 + "Thanked" |
| G23 | feedback composer Post | O | O | O | feedback-sheet "needs step+body before Post, then posts"; notes.test notifies authors |
| G10 | detail Report | W | O | I | unit tagged report-problem.test posts for exchange/toy subjects, never a guide; e2e report lands in queue; api queues.test reads the queue, not the POST |
| G30 | 3D pill -> model route | O | O | O | "a 3D pill opens the model route for that file" |
| G31 | back; Ask someone to print | O | I | - | unit "goes back; Ask someone to print opens finder"; e2e only checks X returns to Files |
| B04 | Leave feedback | O | O | O | done screen offers Leave feedback, opens sheet; e2e posts a note |
| B03 | Add to My SPLAT | O | O | O | apiClient.post('/api/tutorials/g/build') (:101); e2e logs build |
| S02 | Say thanks | O | O | O | thank-button.test thanks a person tied to exchange / org route. Tagged thanks-notes-screen.test is a different feature (loose tag) |
| S01 | showcase load; card tap | R | O | I | unit only renders a profile and presses the org chip, not a guide card; e2e opens a guide; api 404 rules |
| N06 | Create draft | O | O | I | api rls/upsert-idempotency are not the create-draft consequence |
| N02 | Choose PDF -> import-pdf | O | O | O | guides-new "Start from a PDF" asserts the import-pdf call; guides-new-failure (tagged) is an offline-extras test |
| T05 | Submit | O | O | O | review-queue-chain tells leader/admins once |
| T18 | backing Ask org | O | O | O | "asks another organisation"; chain notifies backing leader |
| T22 | edit approved guide re-submits | O | O | I | use-tutorial-draft "re-queues approved/rejected to pending"; e2e asserts PATCH body status=pending; api tags don't test approved->pending on edit |
| T01 | list load / stage filter | O | I | I | e2e is a 21-test edge file, list load incidental; api mine/views tangential |
| L29 | org conversation Send (leader) | O | O | O | "signs a leader's reply with the organisation"; api leader reply tells the family |
| L19 | New event Publish/Draft | O | O | O | form tests + e2e "publishing an event tells a follower, a draft tells nobody" |
| L20 | New story Publish/Draft | O | O | O | consent gating unit; e2e follower told |
| L25 | Send invitation | O | O | O | leaders-section invites by email; e2e writes invite; api invites rather than adds |
| P04 | Send thanks | O | O | O | "follows, and signs a thanks"; counts-thanks moves "Thanked N times"; api tells leaders |
| P10 | family conversation Send | O | O | O | e2e "P10 and L29: each message adds one to the other side" |
| W03 | summary inline Accept | O | O | O | "accepts an organisation's request on the spot"; e2e takes it out of count |
| Y07 | Save/Thank/Report | O | O | O | toggle(slug,id); e2e thanks once, report names the toy |
| X04 | Accept (+pickup) | O | O | O | "posts the four pickup fields"; tagged toy-exchange-edges e2e is mostly unrelated, exchanges.spec carries it |
| C03 | Join | O | O | O | "joins, then reloads the brief"; chain tells author |
| C12 | Submit idea | O | O | O | sends title+summary only; lands in My challenges awaiting review |
| K02 | I'll build this (claim) | O | O | O | "claims and goes to the thread"; one of two simultaneous claims |
| K03 | Ask first Send | O | O | O | ask-first-screen "lets the maker ask"; questions.test |
| R03 | Send request | O | O | O | quantity/customization/credit asserted; print-chain tells printer |
| R07 | Started printing | O | O | O | "startPrint posts an empty body to print-started" |
| V04 | recycling load | O | O | I | api org-screens tests are org public-field tests, tangential |
| V05 | Book the drop-off | O | O | O | "uploads photo and books with its path"; tagged lib/upload.test is toy-switch-photo |
| Z05 | Delete account | O | O | O | wrong code deletes nothing; deletes after sixth digit |
| Z01 | display name blur save | O | O | O | "saves a display-name change when editing ends"; greeting changes |
| Q08 | invite Accept | O | O | O | posts through same route; seat given and author told |
| Q09 | invite Decline | O | O | O | api "declines without creating a seat" |
| Q01 | Me load | O | I | O | e2e my-splat: headings visible + two nav clicks, no count assert |
| Q18 | admin review queue open | O | - | - | unit asserts GET pending + push('/admin/review/t1'). Row has empty `api` though it reads /api/admin/tutorials |
| G15 | Start/Build it again | O | O | - | "Start building opens the build route" |
| G18 | Ask someone to print | O | O | - | "opens Find a printer for this guide" |
| G19 | Can't build it? | O | O | O | "asks a maker nearby with this guide picked"; api creates tx with guide |
| K10 | Ask for a change | O | O | - | starts the change request in the message box |
| K12 | Withdraw | O | O | O | "withdraws once on Proceed"; chain tells maker |
| C07 | Add a constraint | O | O | O | thread adds constraint; api takes one from author and joined maker |
| C10 | Read the guide / Follow write-up | O | O | O | offers Follow the write-up, names writer; api points phone at write-up |
| X08 | New code / Copy | I | O | O | unit asserts Copy -> clipboard('123456') only; no unit test presses New code |

### Totals

| Layer | n | OUTCOME | INTERACTION | RENDER | WRONG |
|---|---|---|---|---|---|
| Unit | 50 | 46 | 1 | 1 | 2 |
| E2E | 49 | 45 | 4 | 0 | 0 |
| API | 45 | 39 | 6 | 0 | 0 |

Reading: the sampled rows are better covered than the fan-out numbers suggest. Weak spots: (1) loose file-level tags naming journeys a file does not exercise (about 9 seen in 50 rows: G09 unit, G10 unit, S02 thanks-notes-screen, X04 toy-exchange-edges, V05 upload.test, N02 guides-new-failure, T01 e2e/api, N06 api, V04 api); (2) wide e2e files carrying many ids (T01-T22, A01-A13). My sample is biased toward rows with api/notifies, so the true weak rate is probably higher on the 60 'unit+e2e' rows, which I sampled lightly.

### B3. Maestro (device)
13 flows and tags: admin-guide-review Q18; deep-link-cold-start A14; event-register V01; every-tab-renders A02 A05 G01 H07 Q01 Q05; feedback-sheet-post B04; feedback-sheet-step-picker B04 G23; guide-page B01 B05 G05 G11 G15 G30 G31; home-shell H01 H02 H03 H05; inbox-badge-live H07; note-report G27; session-survives-cold-start A05 A14; sign-out-clears-session Z04; toy-photos-carousel Y03 Y04.
.github/workflows/maestro-android.yml says "PROPOSED, NEVER RUN ... manual-only (workflow_dispatch), never a required check, and continue-on-error". It is not in ci.yml. Only maestro-flows.test.ts (static YAML validation) runs in CI. So the 13 journeys whose `required` includes 'device' (A05 A14 H07 G11 G15 G27 G30 G31 B04 B05 Y03 Y04 Z04) show a check mark for a layer that has never executed in CI, and the file's comments say several flows (feedback-sheet-post, note-report, inbox-badge-live, deep-link-cold-start) were never run anywhere. Branch protection is unreadable (gh API 403 on this plan), but with only a manual trigger it cannot be a required check. Unit, mobile e2e, api integration and the journey check do run in ci.yml.

## PART C: required combos

| required | count |
|---|---|
| unit+e2e+api | 176 |
| unit+e2e | 60 |
| unit+e2e+api+device | 7 |
| unit+e2e+device | 6 |
| unit only | 4 (G21 B06 Q18 Q19) |

Total 253. Rows with non-empty `api` whose required lacks 'api': 0, so the literal rule is satisfied. But the `api` field is under-filled: Q18 and Q19 (admin approve / request changes, PATCH /api/admin/tutorials/:id/status) call a real endpoint yet have empty `api` and are required unit only, with no e2e or api layer. Other unit+e2e rows with a count/db consequence and no api requirement: H07, G03, G25, B01, T04, C14 (db toy_ideas.anonymous), Q14 (the first five are client-side counts; C14 writes a column and probably deserves api). Under-required by behaviour: Q18, Q19 (and C14 arguably).

## Verdict on "0 gaps"
Literally true and reproducible: every row of the 253 has a tag in each required layer. It is not evidence that the mobile app is covered. (1) The inventory is frozen at a518a327: 17 shipped screens/features have no row, so they cannot show as gaps; 2 rows are stale (Q17, T20). (2) The device layer has never run in CI, so 13 required device cells are unverified. (3) Tags are file-level: 106 unit/e2e cells rest on files tagging more than 6 ids, and about 9 loose tags turned up in 50 sampled rows (2 unit cells WRONG), although OUTCOME-level proof was found for 46/50 unit, 45/49 e2e and 39/45 api sampled cells. (4) Q18/Q19 are under-required. The map is a good tripwire for the inventory it knows about; "0 gaps" overstates coverage of the current app. Re-inventorying against HEAD would add rows for the 17 missing items (many sub-actions each), and the untagged unit tests already present for the admin, events and reports screens would close part of that cheaply.
