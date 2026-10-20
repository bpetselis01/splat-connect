> Snapshot of the web test and harness inventory, 2026-10-20, against HEAD cea425f2. Source for which web tests exist to tag and which routes have nothing.

# Web test inventory (packages/web) - scout, read-only, 2026-10-20

Method: file reads plus grep/regex scripts. Unit "assertion kind" and the route matrix are heuristic (derived from imports, `userEvent`/`render` use, and `vi.mock`), not a read of all 199 files; e2e rows were read from grep of every test/goto/expect line plus helpers.ts, not every line of every spec.
## 1. E2E inventory (packages/web/tests/e2e, 35 spec files, 137 `test(` blocks)

Sign-in mechanism for every authenticated spec (helpers.ts): account is created through the Supabase service role (`adminClient().auth.admin.createUser({email_confirm:true,password:'Test1234!'})` then `profiles.upsert({role})`), so there is no seeded user and no `generate_link`/cookie shortcut. Browser sign-in is `signIn(page,email,pw)` = fill `/login` form (`#email`, `#password`) and click; `submitLogin` is the failing-attempt variant. `acceptTerms(id[,'org_leader_terms'])` writes the agreement row via service role. Other fixtures via service role: `createTutorial`, `createPublishedToy`, `createOrgWithLeader`, `seedBackingRequest`, `seedLeaderApproval`; inline inserts in a few specs (printers, print jobs, events/stories). Nothing reads supabase/seed.sql; each test makes uniquely named rows (`@web-e2e.local` emails, `uniqueTitle`). Real UI sign-up exists only in auth/signup.spec.ts, and it stops at "Check your email". "Member" below = a `contributor`-role account (the only non-admin role); "leader" = a member who is in org_leaders.

Skips/only/fixme: none in any spec. Env-conditional: saves.spec.ts has a `SAVE_SHOTS` screenshot branch (helper, not an assertion). `@responsive` tests run only in the `mobile-chrome` (Pixel 7) project; all others in desktop `chromium`. No spec imports from app/ or components/ (only `lib/public-nav` in footer.spec.ts, `@splat-connect/types` PENDING in not-built.spec.ts; mentions of components/ are comments). Outcome key: UI = state visible on screen; DB = row/auth user read back via service role; NOTIF = notification count/list; RENDER = only that something renders / URL.

Seat tally (tests): anon 64, member 54, org-leader 3, admin 12, multi-seat journeys 4 (collaborators 1; org-backing 3, each uses leader+author+admin).

| spec | seat / sign-in | routes visited | test: action -> outcome |
|---|---|---|---|
| admin/contributors | admin (createAdmin+signIn) | /admin/contributors | (1) admin deletes a contributor -> UI row disappears. (2) list renders name/email/joined date -> RENDER |
| admin/dashboard | admin | /admin | links to Accounts and Review queue have right hrefs -> RENDER |
| admin/review-flow | admin, + contributor for 2 tests | /admin/review, /admin/review/[id], /library, /dashboard/tutorials | (1) approve pending -> appears in public /library (UI). (2) reject with note -> contributor sees note + "Needs you" (UI, cross-seat). (3) queue row shows wait time -> RENDER. (4) detail renders parts/tools/STL/PDF links -> RENDER. (5) approved tutorial opens read-only with Unpublish, no Approve/Reject -> UI. (6) reject without note -> contributor sees fallback text (UI) |
| auth/account-deletion | anon; member | /delete-account, /dashboard/profile | (1) public page explains deletion + sign-in link -> RENDER. (2) member deletes account with emailed code -> UI "Your account is deleted" + DB auth user null (code read from DB) |
| auth/entry-flow | anon | /, /login, /signup | (1) logged-out "/" offers sign in -> reaches /login. (2) login links to signup -> URL |
| auth/login | member; admin; anon | /login, /dashboard, /admin | (1) member signs in -> "Welcome back" (UI). (2) admin signs in -> lands on admin dashboard. (3) wrong password -> error text and stays on /login |
| auth/route-protection | anon x5; member; admin | /dashboard, /upload, /my-tutorials, /admin, /notifications | 5 anon redirects to /login (URL). Member bounced from /admin to / (URL). Admin reaches /dashboard (UI) |
| auth/session | member; anon | /dashboard/profile, /auth/confirmed | (1) sign out -> Sign in link returns (UI). (2) email-confirmed page renders -> RENDER |
| auth/signup | anon (real signup form); 1 uses createContributor for duplicate | /signup | (1) valid signup -> "Check your email" (UI; no email click-through). (2-4) terms dialog keeps typed fields / closes on backdrop / closes on Escape without accepting (UI). (5) duplicate email -> alert shown. (6) 5-char password rejected -> no success |
| collaborators | author, collaborator, admin (3 sessions) | /tutorials/[id]/edit, /notifications, /admin/review | invite -> accept -> edit -> submit -> admin approves -> both notified. Asserts NOTIF badge count and list for both users plus DB unread counts. Strongest cross-seat journey |
| contributor/contributor-terms | member WITHOUT acceptTerms (deliberate) | /dashboard, /library, /tutorials/[id], /onboarding/contributor-terms, /tutorials/[id]/edit | (1) unaccepted account redirected to catch-up screen (URL). (2) browsing stays open (URL). (3) accept on first login -> dashboard with real header (UI). (4) accept returns user to blocked edit page and editing works (UI) |
| contributor/dashboard-tutorials | member | /dashboard/tutorials | (1) status badges + rejection note per card (UI). (2) empty state with /upload link. (3) draft badge, card links to editor. (4) status filter counts match fixtures (UI) |
| contributor/edit-tutorial | member (+outsider) | /tutorials/[id]/edit(?step=) , /dashboard/tutorials | (1) edit approved -> back to pending (UI). (2) other user's tutorial blocked (URL). (3) save details updates title/desc/difficulty (UI). (4) difficulty select reflects saved value. (5) add photo + replace PDF (UI, uploads fixtures). (6) part add/edit/delete (UI). (7) tool add/edit/delete (UI). (8) STL record added (UI). (9) submit blocked when required fields missing + DB status still draft. (10) rejection callout shows reviewer note |
| contributor/org-backing | leader, author, admin | /organizations/[id], /organizations/[id]/projects/[tid], /tutorials/[tid], /admin/spot-check, /admin/review/[tid], /my-tutorials | (1) leader accepts leader terms, approves + publishes backed project -> public page shows "Backed by org", admin spot-check lists it (UI). (2) leader declines -> author sees "declined, now reviewed by SPLAT", picks other org (UI). (3) admin unpublishes leader-approved tutorial -> hidden publicly, author sees reason (UI) |
| contributor/upload-flow | member | /upload, edit steps | (1) create -> editor + DB row (status draft, difficulty, kind). (2) ?kind preselects radio. (3) no accepted terms never reaches /upload. (4) full build creation -> files saved -> details -> parts -> tools -> submit -> card shows "Waiting" (UI) |
| dashboard/edit-event-story | leader (seeded event+story) | /dashboard/organisation/publish, events/[id]/edit, stories/[id]/edit, public event + story | leader edits published event and story in place -> public pages show new titles (UI) |
| dashboard/navigation | member; admin | /dashboard, /get-involved, /submit-an-idea, /admin, /admin/review, /dashboard/challenges, /dashboard/saved/tutorials, /dashboard/toys, /printing | 6 chrome/navigation tests: reach idea form without signing out, all public sections reachable from every signed-in page, header everywhere/rail nowhere, breadcrumb walk, saved empty -> /library, footer link crosses to /printing (URL/UI) |
| dashboard/shell | member; leader | /dashboard, /dashboard/organisation, /organizations/[id]/projects/[tid], /dashboard/profile, /dashboard/child/new, /my-tutorials, /dashboard/print-requests, /dashboard/toys, onboarding gate | (1) member sees no Organisation group. (2) leader sees Organisation group; queue merges two orgs. (3) leader approves from tab -> public "Backed by" (UI). (4) add two children, edit, delete (UI). (5) rename on Account persists (UI). (6) /my-tutorials redirect. (7) hub has no "Soon" cards, print-requests opens. (8) content column capped at ultrawide. (9) skip link focus. (10) onboarding gate has no nav |
| dashboard/toys | member | /dashboard/toys | add toy, edit, upload cover, publish, delete -> UI at each step |
| impact | anon | /impact, /contributors/[id] | wall card -> profile lists guides + toys (UI, count >= 1) |
| not-found | anon; member | unknown url, /dashboard/child/[missing], /dashboard/exchanges/[missing] | 404 status + header/banner kept (UI) |
| printing/answer-by | member (family; printer + job seeded by inline insert) | /dashboard/print-requests/[id] | "answer by" date text shown (RENDER of one string) |
| public/design-challenges | anon | /get-involved/design-challenges, /submit-an-idea | listing is real; submit requires sign-in (RENDER/UI) |
| public/footer | anon | / , every FOOTER_COLUMNS href, /impact/news, /auth/confirmed, /login | footer destinations exist and resolve <400 with an h1; footer absent on gate pages (RENDER) |
| public/home | anon | /, /library | hero + five scenes, three doors, CTA reaches library, recent guides link through (RENDER/URL) |
| public/library | anon x5; member x1 | /library?q=, /tutorials/[id], /signup | approved listed / pending hidden; search chip; Time + Needs-printing filters; sort Quickest; member thanks a guide once -> count "1 thanks" (UI, state change); signed-out gets Share only, download CTA -> /signup |
| public/navigation | anon | 7 top-level sections, /learn/switch-types, /printing/basics, /organizations, /learn/3d-printing-basics | links resolve (no scaffold), 5 tabs + More, one nav bar, active section marked, org directory public, permanent redirect, animation fallback (RENDER/URL) |
| public/not-built | anon | /not-built/[id], /not-built/nope | registry item page + fallback (RENDER) |
| public/pixel | anon | /, /learn, /library, /privacy | layout geometry: shell widths, 1216 content, no horizontal scroll, art placeholders a11y (layout measurement) |
| public/printing-parts | anon | /printing/parts?q= | catalogue finds STL by guide title, links to guide (RENDER) |
| public/tutorial-detail | anon | /tutorials/[id], 404 id | full detail render, 404, no-photo placeholder, optional badges + buy links, no-STL omits section, parts total, rail info (RENDER, 7 tests) |
| public/tutorial-downloads | anon; member | /tutorials/[id], /signup, /files/tutorial-pdfs/... | signed-out download -> /signup?reason=download (URL); signed-in gets 200 application/pdf (HTTP) |
| responsive/reflow | anon x4, member x2 (@responsive, Pixel 7) | /, /library, /dashboard/tutorials, /upload, /tutorials/[id] | geometry: no overflow, one column, stacking, header fold (layout measurement) |
| saves/saves | anon x1; member x4 | /library, /signup, /dashboard/saved(/tutorials, /organisations, /bananas) | signed-out save -> sign-up w/ reason; member saves from library -> appears under Saved, unsave -> empty (UI, state change); destination button; non-live type 404; phone width |
| toy-exchange | owner + requester (2 members, 2 pages in last test) | /toy-library/[id], /toy-library/[id]/request, /dashboard/exchanges/[id], /dashboard/toys | (1) full donation handoff: request -> accept w/ address -> code -> complete -> Given away card (UI, multi-step state). (2) owner rejects -> "declined". (3) requester withdraws. (4) message + acceptance arrive live without reload (two browsers) |

## 3 (e2e half). Harness
- Started by Playwright `webServer` (playwright.config.ts): API via `tsx src/index.ts` on :3104, Web via `next build && next start` (production bundle) on :3105; spec mobile uses 3102/3103. Both have `reuseExistingServer: !process.env.CI`, so a local run silently reuses anything already on 3104/3105 (stale-server risk). `scripts/e2e.sh web <args>` refuses to run if any of 3102-3105 is listening, requires local Supabase on :54321, writes json report + traces to ~/verify-evidence/..., passes `--trace=on`.
- Supabase: always LOCAL (`supabase/local-dev-keys`, :54321). Config injects local URL/keys into both servers so they override .env.local; helpers hard-code the local service-role key. Never hits the hosted project.
- Config: timeout 90s/test, expect 20s, `fullyParallel: true` but `workers: 1` (GoTrue exhausts ephemeral ports at higher counts), `retries: 1` (documented as covering a GoTrue connection-limit infra flake, a different spec each run; real failures fail twice), trace on first retry, reporter `line`. Two projects: chromium (excludes @responsive) and mobile-chrome (Pixel 7, only @responsive).
- Duration: config comment says ~1.3 min for the suite at 1 worker "dominated by fixed server-start time" (that note predates growth to 137 tests; unverified). CI job `web-e2e` (.github/workflows/ci.yml) gated on web path changes, needs check+test, installs chromium, uploads packages/web/test-results on failure; no job timeout set (default 6h).
- Flaky/quarantined: no skip/fixme/slow in specs. Only the global retry above. Stale-build and keychain notes are in memory, not specs.

## 2. Unit inventory (packages/web/tests/unit, vitest + jsdom, setup.ts polyfills HTMLDialogElement)

200 files = 199 tests + `leaving.tsx` (not a test, 0 `it` blocks, imports panel-actions) + setup.ts excluded. No snapshot assertions anywhere (`toMatchSnapshot` count 0).

Counts by kind (heuristic):
| kind | files |
|---|---|
| pure function (lib/*, 42 files; a few mock supabase) | 42 |
| component: render + user interaction -> handler/API called (userEvent/fireEvent, mocked browser-api-client) | 71 |
| component: render-only text/attribute assertions | 29 |
| page/server component rendered with mocked api-client/supabase (app/ 13 + pages/ 29) | 42 |
| page render + interaction (app/ 4, pages/ 1) | 5 |
| static guards / route handler / other (app/ 6, components/ 4, leaving.tsx 1) | 11 |

Coverage config (vitest.config.ts): provider v8, include lib/**/*.ts(x) and components/**/*.tsx, exclude lib/supabase/**. NO thresholds set. app/ (pages, actions, route handlers) is outside the coverage `include`, so server actions and pages are never measured. `test:unit` = `vitest run tests/unit --coverage`.
Existing coverage/ is STALE (index.html dated 2026-10-08, no coverage-summary.json; read from index.html): all files 68.17% statements (13523/19837), 82.98% branches, 73.3% functions, 68.17% lines; components 66.98% stmts, components/ui 100%, lib 82.3% stmts / 90.36% branches.

Note: no unit test exercises a server action with mocked supabase; the only supabase-mocking tests are lib/api-client, lib/browser-api-client, app/files-route and a few component/page tests (wire-level). Server-side logic is covered by e2e and by the api package, not here.

### tests/unit/app (23 files)

| file | subject | #tests | assertion kind | web route |
|---|---|---|---|---|
| about.test.tsx | about | 9 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /about, /about/team, /contact |
| auth-confirmed.test.tsx | auth-confirmed | 6 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /auth/confirmed |
| design-challenges.test.tsx | design-challenges | 6 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /get-involved/design-challenges |
| files-route.test.ts | files-route | 8 | route handler /files/[bucket]/[...path] with mocked supabase (node env) | n/a |
| get-involved.test.tsx | get-involved | 7 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /get-involved, /get-involved/contributors, /get-involved/families, /get-involved/organisations |
| impact-hub.test.tsx | impact-hub | 3 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /impact (hub-grid component) |
| layout-chrome.test.tsx | layout-chrome | 7 | server page rendered with mocked api-client/supabase, asserts rendered text/links | root layout (all routes) |
| learn-articles.test.tsx | learn-articles | 7 | page render + interaction | /learn/choosing-a-toy, /learn/safety-and-cleaning, /learn/switch-types, /learn/tools-and-materials, /learn/toy-adaptation-101, /printing/basics |
| learn-gate.test.tsx | learn-gate | 6 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /learn/switch-types, /learn/ask-an-expert |
| learn-hub.test.tsx | learn-hub | 5 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /learn/ |
| login-intent.test.tsx | login-intent | 3 | page render + interaction | /login |
| no-playroom-references.test.ts | no-playroom-references | 3 | repo-grep guard (no Playroom refs) | n/a |
| not-built-page.test.tsx | not-built-page | 2 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /not-built/[id] |
| onboarding-contributor-terms.test.tsx | onboarding-contributor-terms | 8 | page render + interaction | /onboarding/contributor-terms |
| printing-parts.test.tsx | printing-parts | 3 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /printing/parts |
| recycling.test.tsx | recycling | 2 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /get-involved/recycling |
| scaffold-pages.test.tsx | scaffold-pages | 1 | static: SCAFFOLD_KEYS vs empty page list (vacuous now) | n/a |
| signup-page.test.tsx | signup-page | 9 | page render + interaction | /signup |
| soft-pop-font.test.ts | soft-pop-font | 3 | static guard: font config | n/a |
| soft-pop-tokens.test.ts | soft-pop-tokens | 9 | static guard: CSS tokens | n/a |
| soft-register.test.ts | soft-register | 9 | static guard: register/typography rules | n/a |
| submit-explainers.test.tsx | submit-explainers | 7 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /get-involved/submit-a-tutorial, /get-involved/submit-an-idea |
| trust-pages.test.tsx | trust-pages | 7 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /code-of-conduct, /privacy, /safety, /terms |

### tests/unit/pages (30 files)

| file | subject | #tests | assertion kind | web route |
|---|---|---|---|---|
| admin-dashboard.test.tsx | admin-dashboard | 1 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /admin |
| admin-ideas-detail.test.tsx | admin-ideas-detail | 9 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /admin/ideas/[id] |
| admin-ideas.test.tsx | admin-ideas | 3 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /admin/ideas |
| admin-organizations.test.tsx | admin-organizations | 4 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /admin/organizations |
| admin-project.test.tsx | admin-project | 7 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /admin/review/[id] |
| admin-review.test.tsx | admin-review | 7 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /admin/review |
| challenge-detail.test.tsx | challenge-detail | 5 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /get-involved/design-challenges/[id] |
| dashboard-challenges.test.tsx | dashboard-challenges | 14 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /dashboard/challenges |
| dashboard-child-edit.test.tsx | dashboard-child-edit | 3 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /dashboard/child/[id] |
| dashboard-exchanges.test.tsx | dashboard-exchanges | 12 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /dashboard/exchanges |
| dashboard-hub.test.tsx | dashboard-hub | 20 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /dashboard |
| dashboard-organisation-non-leader.test.tsx | dashboard-organisation-non-leader | 1 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /dashboard/organisation |
| dashboard-organisation.test.tsx | dashboard-organisation | 7 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /dashboard/organisation |
| dashboard-profile.test.tsx | dashboard-profile | 6 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /dashboard/profile |
| dashboard-toys-edit.test.tsx | dashboard-toys-edit | 2 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /dashboard/toys/[id] |
| dashboard-toys-list.test.tsx | dashboard-toys-list | 11 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /dashboard/toys |
| dashboard-toys-new.test.tsx | dashboard-toys-new | 3 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /dashboard/toys/new |
| dashboard-tutorials.test.tsx | dashboard-tutorials | 12 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /dashboard/tutorials |
| edit-tutorial.test.tsx | edit-tutorial | 13 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /tutorials/[id]/edit |
| impact-map.test.tsx | impact-map | 3 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /impact/map |
| leader-project.test.tsx | leader-project | 5 | page render + click -> handler | /organizations/[id]/projects/[tutorialId] |
| org-inventory.test.tsx | org-inventory | 8 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /dashboard/organisation/toys |
| organization-detail.test.tsx | organization-detail | 5 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /organizations/[id] |
| organizations.test.tsx | organizations | 3 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /organizations |
| print-request-detail.test.tsx | print-request-detail | 4 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /dashboard/print-requests/[id] |
| saved-hub.test.tsx | saved-hub | 4 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /dashboard/saved |
| saved-list.test.tsx | saved-list | 7 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /dashboard/saved/[type] |
| signup.test.tsx | signup | 3 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /signup |
| spot-check.test.tsx | spot-check | 5 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /admin/spot-check |
| upload.test.tsx | upload | 3 | server page rendered with mocked api-client/supabase, asserts rendered text/links | /upload |

### tests/unit/components (104 files)

| file | subject | #tests | assertion kind |
|---|---|---|---|
| acting-org-switcher.test.tsx | acting-org-switcher | 1 | render + user interaction -> handler/API call asserted |
| add-stl-form.test.tsx | add-stl-form | 2 | render + user interaction -> handler/API call asserted |
| admin-idea-reports.test.tsx | admin-idea-reports | 5 | render + user interaction -> handler/API call asserted |
| admin-review-pane.test.ts | admin-review-pane | 4 | pure fn / mocked module |
| admin-test-prints.test.tsx | admin-test-prints | 2 | render + user interaction -> handler/API call asserted |
| auth-shell.test.tsx | auth-shell | 4 | render-only (text/attribute assertions, no snapshots) |
| back-link.test.tsx | back-link | 4 | render-only (text/attribute assertions, no snapshots) |
| back-to-my-splat-dock.test.tsx | back-to-my-splat-dock | 7 | render-only (text/attribute assertions, no snapshots) |
| backing-state.test.tsx | backing-state | 8 | render-only (text/attribute assertions, no snapshots) |
| badge.test.tsx | badge | 2 | render-only (text/attribute assertions, no snapshots) |
| breadcrumb.test.tsx | breadcrumb | 6 | render-only (text/attribute assertions, no snapshots) |
| build-questions.test.tsx | build-questions | 1 | render + user interaction -> handler/API call asserted |
| buy-links-input.test.tsx | buy-links-input | 3 | render + user interaction -> handler/API call asserted |
| challenge-card.test.tsx | challenge-card | 4 | render-only (text/attribute assertions, no snapshots) |
| challenge-thread.test.tsx | challenge-thread | 11 | render + user interaction -> handler/API call asserted |
| child-editor.test.tsx | child-editor | 15 | render + user interaction -> handler/API call asserted |
| child-wizard.test.tsx | child-wizard | 4 | render + user interaction -> handler/API call asserted |
| coming-soon.test.tsx | coming-soon | 5 | render-only (text/attribute assertions, no snapshots) |
| contributor-terms-content.test.tsx | contributor-terms-content | 1 | render-only (text/attribute assertions, no snapshots) |
| contributor-terms-dialog.test.tsx | contributor-terms-dialog | 6 | render + user interaction -> handler/API call asserted |
| cost-panel.test.tsx | cost-panel | 15 | render + user interaction -> handler/API call asserted |
| created-toast.test.tsx | created-toast | 2 | render-only (text/attribute assertions, no snapshots) |
| customization-fields-form.test.tsx | customization-fields-form | 4 | render + user interaction -> handler/API call asserted |
| dashboard-tutorial-card.test.tsx | dashboard-tutorial-card | 11 | render-only (text/attribute assertions, no snapshots) |
| delete-account-form.test.tsx | delete-account-form | 3 | render + user interaction -> handler/API call asserted |
| delete-entity-button.test.tsx | delete-entity-button | 12 | render + user interaction -> handler/API call asserted |
| deliveries-map.test.tsx | deliveries-map | 1 | render-only (text/attribute assertions, no snapshots) |
| dropoff-form-photo.test.tsx | dropoff-form-photo | 2 | render + user interaction -> handler/API call asserted |
| dropoff-form.test.tsx | dropoff-form | 6 | other |
| edit-backing-section.test.tsx | edit-backing-section | 13 | render + user interaction -> handler/API call asserted |
| edit-collaborators-section.test.tsx | edit-collaborators-section | 10 | render + user interaction -> handler/API call asserted |
| edit-details-section.test.tsx | edit-details-section | 14 | render + user interaction -> handler/API call asserted |
| edit-event-story.test.tsx | edit-event-story | 3 | render + user interaction -> handler/API call asserted |
| edit-files-section.test.tsx | edit-files-section | 10 | render + user interaction -> handler/API call asserted |
| edit-items-section-parts.test.tsx | edit-items-section (parts) | 11 | render + user interaction -> handler/API call asserted |
| edit-items-section-tools.test.tsx | edit-items-section (tools) | 11 | render + user interaction -> handler/API call asserted |
| edit-items-section.test.tsx | edit-items-section | 10 | render + user interaction -> handler/API call asserted |
| edit-recommendations-section.test.tsx | edit-recommendations-section | 7 | render + user interaction -> handler/API call asserted |
| edit-safety-notes-section.test.tsx | edit-safety-notes-section | 1 | render + user interaction -> handler/API call asserted |
| edit-steps-section.test.tsx | edit-steps-section | 1 | render + user interaction -> handler/API call asserted |
| edit-suits-section.test.tsx | edit-suits-section | 6 | render + user interaction -> handler/API call asserted |
| editorial-image.test.tsx | editorial-image | 6 | render-only (text/attribute assertions, no snapshots) |
| event-card.test.tsx | event-card | 2 | render-only (text/attribute assertions, no snapshots) |
| event-register-form.test.tsx | event-register-form | 3 | render + user interaction -> handler/API call asserted |
| file-drop-zone.test.tsx | file-drop-zone | 3 | render + user interaction -> handler/API call asserted |
| follow-writeup.test.tsx | follow-writeup | 2 | render + user interaction -> handler/API call asserted |
| hub-grid.test.tsx | hub-grid | 15 | render-only (text/attribute assertions, no snapshots) |
| idea-author-actions.test.tsx | idea-author-actions | 4 | render + user interaction -> handler/API call asserted |
| idea-form.test.tsx | idea-form | 8 | render + user interaction -> handler/API call asserted |
| incoming-print-card.test.tsx | incoming-print-card | 9 | render + user interaction -> handler/API call asserted |
| learn-course-editor.test.tsx | learn-course-editor | 5 | render + user interaction -> handler/API call asserted |
| live-transaction.test.tsx | live-transaction | 5 | render-only (text/attribute assertions, no snapshots) |
| makers-wanted-board.test.tsx | makers-wanted-board | 4 | render + user interaction -> handler/API call asserted |
| mark-build-done-button.test.tsx | mark-build-done-button | 2 | render + user interaction -> handler/API call asserted |
| mark-notifications-read.test.tsx | mark-notifications-read | 4 | render-only (text/attribute assertions, no snapshots) |
| my-reports-list.test.tsx | my-reports-list | 2 | render-only (text/attribute assertions, no snapshots) |
| nav.test.tsx | nav | 20 | render + user interaction -> handler/API call asserted |
| new-toy-form.test.tsx | new-toy-form | 4 | render + user interaction -> handler/API call asserted |
| new-tutorial-form.test.tsx | new-tutorial-form | 7 | render + user interaction -> handler/API call asserted |
| notifications-list.test.tsx | notifications-list | 16 | render + user interaction -> handler/API call asserted |
| notify-form.test.tsx | notify-form | 3 | render + user interaction -> handler/API call asserted |
| org-actions.test.tsx | org-actions | 12 | render + user interaction -> handler/API call asserted |
| org-invites.test.tsx | org-invites | 1 | render + user interaction -> handler/API call asserted |
| org-leaders.test.tsx | org-leaders | 1 | render + user interaction -> handler/API call asserted |
| pdf-import-flow.test.tsx | pdf-import-flow | 7 | render + user interaction -> handler/API call asserted |
| person-thanks-button.test.tsx | person-thanks-button | 5 | render + user interaction -> handler/API call asserted |
| person-thanks-notes.test.tsx | person-thanks-notes | 3 | render + user interaction -> handler/API call asserted |
| photo-tiles.test.tsx | photo-tiles | 21 | render + user interaction -> handler/API call asserted |
| pixel.test.tsx | pixel | 13 | render-only (text/attribute assertions, no snapshots) |
| print-at-event-form.test.tsx | print-at-event-form | 4 | render + user interaction -> handler/API call asserted |
| printer-directory.test.tsx | printer-directory | 7 | render + user interaction -> handler/API call asserted |
| printer-form.test.tsx | printer-form | 1 | render + user interaction -> handler/API call asserted |
| profile-form.test.tsx | profile-form | 8 | render + user interaction -> handler/API call asserted |
| project-actions.test.tsx | project-actions | 8 | other |
| public-footer.test.tsx | public-footer | 6 | render-only (text/attribute assertions, no snapshots) |
| record-card.test.tsx | record-card | 6 | render-only (text/attribute assertions, no snapshots) |
| recycling-intake.test.tsx | recycling-intake | 2 | render + user interaction -> handler/API call asserted |
| request-print-form.test.tsx | request-print-form | 6 | render + user interaction -> handler/API call asserted |
| save-button.test.tsx | save-button | 7 | render + user interaction -> handler/API call asserted |
| save-status-line.test.tsx | save-status-line | 2 | render-only (text/attribute assertions, no snapshots) |
| saved-card-boundary.test.tsx | saved-card-boundary | 2 | render-only (text/attribute assertions, no snapshots) |
| scroll-world.test.ts | scroll-world | 4 | pure fn (scroll maths) |
| show-more.test.tsx | show-more | 2 | render + user interaction -> handler/API call asserted |
| stage-rail.test.tsx | stage-rail | 6 | render + user interaction -> handler/API call asserted |
| stepper.test.tsx | stepper | 31 | render + user interaction -> handler/API call asserted |
| stl-settings-form.test.tsx | stl-settings-form | 1 | render + user interaction -> handler/API call asserted |
| team-state.test.tsx | team-state | 9 | render-only (text/attribute assertions, no snapshots) |
| terms-gate.test.tsx | terms-gate | 8 | render + user interaction -> handler/API call asserted |
| thanks-button.test.tsx | thanks-button | 3 | render + user interaction -> handler/API call asserted |
| to-be-completed.test.tsx | to-be-completed | 2 | render-only (text/attribute assertions, no snapshots) |
| toast.test.tsx | toast | 3 | render + user interaction -> handler/API call asserted |
| toy-details-form.test.tsx | toy-details-form | 7 | render + user interaction -> handler/API call asserted |
| toy-editor.test.tsx | toy-editor | 12 | render + user interaction -> handler/API call asserted |
| toy-facts.test.tsx | toy-facts | 5 | render + user interaction -> handler/API call asserted |
| toy-library-card.test.tsx | toy-library-card | 3 | render-only (text/attribute assertions, no snapshots) |
| toy-library-client.test.tsx | toy-library-client | 4 | render + user interaction -> handler/API call asserted |
| toy-photos-section.test.tsx | toy-photos-section | 4 | render + user interaction -> handler/API call asserted |
| toy-picks-editor.test.tsx | toy-picks-editor | 4 | render + user interaction -> handler/API call asserted |
| toy-picks.test.tsx | toy-picks | 2 | render-only (text/attribute assertions, no snapshots) |
| toy-transaction-request.test.tsx | toy-transaction-request | 7 | render-only (text/attribute assertions, no snapshots) |
| toy-transaction-thread.test.tsx | toy-transaction-thread | 25 | render + user interaction -> handler/API call asserted |
| tutorial-card.test.tsx | tutorial-card | 14 | render-only (text/attribute assertions, no snapshots) |
| tutorial-view.test.tsx | tutorial-view | 24 | render + user interaction -> handler/API call asserted |
| what-you-take.test.tsx | what-you-take | 2 | render + user interaction -> handler/API call asserted |

### tests/unit/lib (42 files)

| file | subject | #tests | assertion kind |
|---|---|---|---|
| acting-org.test.ts | acting-org | 6 | pure function |
| api-client.test.ts | api-client | 7 | pure function (mocked supabase) |
| browser-api-client.test.ts | browser-api-client | 8 | pure function (mocked supabase) |
| build-options.test.ts | build-options | 2 | pure function |
| build-stages.test.ts | build-stages | 5 | pure function |
| capabilities.test.ts | capabilities | 7 | pure function |
| challenge-outcome.test.ts | challenge-outcome | 3 | pure function |
| contributor-badges.test.ts | contributor-badges | 8 | pure function |
| cost-summary.test.ts | cost-summary | 8 | pure function |
| dates.test.ts | dates | 10 | pure function |
| edit-steps.test.ts | edit-steps | 15 | pure function |
| exchange-stages.test.ts | exchange-stages | 9 | pure function |
| filament-rate.test.ts | filament-rate | 3 | pure function |
| given-away.test.ts | given-away | 9 | pure function |
| guide-meta.test.ts | guide-meta | 3 | pure function |
| guides.test.ts | guides | 11 | pure function |
| home-content.test.ts | home-content | 9 | pure function |
| initials.test.ts | initials | 2 | pure function |
| learn-course-merge.test.ts | learn-course-merge | 7 | pure function |
| learn-course.test.ts | learn-course | 10 | pure function |
| library-filter.test.ts | library-filter | 11 | pure function |
| nav-model.test.ts | nav-model | 19 | pure function |
| notification-bucket.test.ts | notification-bucket | 6 | pure function |
| notification-second-line.test.ts | notification-second-line | 6 | pure function |
| paginate.test.ts | paginate | 3 | pure function |
| photo-src.test.ts | photo-src | 8 | pure function |
| press-motion.test.ts | press-motion | 15 | pure function |
| print-groups.test.ts | print-groups | 7 | pure function |
| print-settings.test.ts | print-settings | 7 | pure function |
| print-stages.test.ts | print-stages | 2 | pure function |
| printing.test.ts | printing | 26 | pure function |
| public-nav.test.ts | public-nav | 30 | pure function |
| recycling.test.ts | recycling | 11 | pure function |
| relative-time.test.ts | relative-time | 6 | pure function |
| safe-next-path.test.ts | safe-next-path | 11 | pure function |
| tone.test.ts | tone | 9 | pure function |
| toy-grade.test.ts | toy-grade | 3 | pure function |
| toy-picks.test.ts | toy-picks | 8 | pure function |
| toy-steps.test.ts | toy-steps | 11 | pure function |
| toy-transaction-action.test.ts | toy-transaction-action | 15 | pure function |
| trail.test.ts | trail | 7 | pure function |
| validation.test.ts | validation | 14 | pure function |

### tests/unit/leaving.tsx (1 files)

| file | subject | #tests | assertion kind |
|---|---|---|---|
| leaving.tsx | leaving | 0 | not a test (stray helper file, 0 tests) |
## 4. Routes vs tests (134 page.tsx under packages/web/app; route groups like (course) stripped)

Status counts: e2e+unit(page) 49; e2e only 26 (incl. /impact/news, chrome only); unit-page only 8; no page-level test but a child component has a unit test 36; neither (at any layer) 14.

Neither: /about/partners, /about/support, /admin/build-requests, /admin/content, /admin/inbox, /admin/organization-requests, /admin/print-jobs, /dashboard/events, /dashboard/org/events/[id], /dashboard/organisation/orders, /get-involved/makers-wanted/new, /get-involved/organisations/request, /impact/events, /organizations/[id]/message.

Caveats: e2e visit detection = regex over `goto`/`toHaveURL` strings plus the public-nav/footer href lists plus click-through routes I identified by reading (toy-library request, exchanges, organisation publish, onboarding). Routes reached only by clicking in a spec may be mislabelled neither. "component-unit only" is the weakest signal: rows citing only badge/back-link/record-card are shared UI parts, so treat the route as effectively untested. Static learn pages (/learn/checkpoint-*, build-*, etc.) show learn-gate tests only. Several "neither" routes (/impact/events, /dashboard/org/events/[id]) may be redirects; not checked.

| route | e2e spec(s) that visit it | unit test rendering the page | unit tests of its child components (heuristic: page.tsx imports) | status |
|---|---|---|---|---|
| /about | footer.spec.ts, navigation.spec.ts | about.test.tsx | - | e2e+unit |
| /about/partners | - | - | - | neither |
| /about/stories/[id] | (click/redirect, various), edit-event-story.spec.ts | - | - | e2e only |
| /about/stories | footer.spec.ts | - | - | e2e only |
| /about/support | - | - | - | neither |
| /about/team | footer.spec.ts | about.test.tsx | to-be-completed<-to-be-completed.test.tsx | e2e+unit |
| /admin/build-requests | - | - | - | neither |
| /admin/content | - | - | - | neither |
| /admin/contributors | contributors.spec.ts | - | - | e2e only |
| /admin/ideas/[id] | - | admin-ideas-detail.test.tsx | - | unit only |
| /admin/ideas | - | admin-ideas.test.tsx | - | unit only |
| /admin/inbox | - | - | - | neither |
| /admin/organization-requests | - | - | - | neither |
| /admin/organizations | - | admin-organizations.test.tsx | - | unit only |
| /admin | (click/redirect, various), route-protection.spec.ts | admin-dashboard.test.tsx | - | e2e+unit |
| /admin/print-jobs | - | - | - | neither |
| /admin/reports | - | - | admin-idea-reports<-admin-idea-reports.test.tsx | component-unit only |
| /admin/review/[id] | org-backing.spec.ts, review-flow.spec.ts | admin-project.test.tsx | project-actions<-project-actions.test.tsx | e2e+unit |
| /admin/review | (click/redirect, various), collaborators.spec.ts, review-flow.spec.ts | admin-review.test.tsx | admin-review-pane<-admin-review-pane.test.ts | e2e+unit |
| /admin/spot-check | org-backing.spec.ts | spot-check.test.tsx | - | e2e+unit |
| /admin/test-prints | - | - | admin-test-prints<-admin-test-prints.test.tsx | component-unit only |
| /auth/confirmed | session.spec.ts | auth-confirmed.test.tsx | auth-shell<-auth-shell.test.tsx | e2e+unit |
| /code-of-conduct | footer.spec.ts | trust-pages.test.tsx | - | e2e+unit |
| /contact | footer.spec.ts | about.test.tsx | to-be-completed<-to-be-completed.test.tsx | e2e+unit |
| /contributors/[id] | (click/redirect, various) | - | person-thanks-button<-person-thanks-button.test.tsx | e2e only |
| /dashboard/challenges | (click/redirect, various) | dashboard-challenges.test.tsx | boundary-link<-dashboard-toys-list.test.tsx; mark-notifications-read<-dashboard-challenges.test.tsx,dashboard-exchanges.test.tsx,dashboard-tutorials.test.tsx,mark-notifications-read.test.tsx; idea-author-actions<-dashboard-challenges.test.tsx,idea-author-actions.test.tsx; toast<-add-stl-form.test.tsx,created-toast.test.tsx,customization-fields-form.test.tsx,edit-backing-section.test.tsx,edit-collaborators-section.test.tsx,edit-details-section.test.tsx,edit-files-section.test.tsx,edit-items-section.test.tsx,edit-recommendations-section.test.tsx,edit-steps-section.test.tsx,idea-author-actions.test.tsx,org-actions.test.tsx,photo-tiles.test.tsx,printing-parts.test.tsx,save-button.test.tsx,stl-settings-form.test.tsx,toast.test.tsx,toy-photos-section.test.tsx | e2e+unit |
| /dashboard/child/[id] | (click/redirect, various), shell.spec.ts | dashboard-child-edit.test.tsx | child-editor<-child-editor.test.tsx | e2e+unit |
| /dashboard/child/new | (click/redirect, various), shell.spec.ts | - | child-editor<-child-editor.test.tsx | e2e only |
| /dashboard/events | - | - | - | neither |
| /dashboard/exchanges/[id] | (click/redirect, various) | - | toy-transaction-thread<-print-request-detail.test.tsx,toy-transaction-thread.test.tsx; live-transaction<-live-transaction.test.tsx,print-request-detail.test.tsx; cost-panel<-cost-panel.test.tsx; badge<-badge.test.tsx | e2e only |
| /dashboard/exchanges/build/[id]/ask | - | - | build-questions<-build-questions.test.tsx | component-unit only |
| /dashboard/exchanges/build/[id] | - | - | toy-transaction-thread<-print-request-detail.test.tsx,toy-transaction-thread.test.tsx; disclosure<-record-card.test.tsx; live-transaction<-live-transaction.test.tsx,print-request-detail.test.tsx; cost-panel<-cost-panel.test.tsx; badge<-badge.test.tsx | component-unit only |
| /dashboard/exchanges | - | dashboard-exchanges.test.tsx | badge<-badge.test.tsx; record-card<-record-card.test.tsx; boundary-link<-dashboard-toys-list.test.tsx; mark-notifications-read<-dashboard-challenges.test.tsx,dashboard-exchanges.test.tsx,dashboard-tutorials.test.tsx,mark-notifications-read.test.tsx | unit only |
| /dashboard/messages/[cid] | - | - | back-link<-back-link.test.tsx | component-unit only |
| /dashboard/org/events/[id] | - | - | - | neither |
| /dashboard/organisation/events/[id]/edit | (click/redirect, various), edit-event-story.spec.ts | - | event-form<-edit-event-story.test.tsx | e2e only |
| /dashboard/organisation/events/new | - | - | event-form<-edit-event-story.test.tsx | component-unit only |
| /dashboard/organisation/messages | - | - | back-link<-back-link.test.tsx | component-unit only |
| /dashboard/organisation/orders | - | - | - | neither |
| /dashboard/organisation | (click/redirect, various), shell.spec.ts | dashboard-organisation-non-leader.test.tsx, dashboard-organisation.test.tsx | org-review-banner<-organization-detail.test.tsx; boundary-link<-dashboard-toys-list.test.tsx; acting-org-switcher<-acting-org-switcher.test.tsx | e2e+unit |
| /dashboard/organisation/profile | - | - | org-leaders<-org-leaders.test.tsx | component-unit only |
| /dashboard/organisation/publish | (click/redirect, various), edit-event-story.spec.ts | - | - | e2e only |
| /dashboard/organisation/recycling | - | - | recycling-intake<-recycling-intake.test.tsx; what-you-take<-what-you-take.test.tsx | component-unit only |
| /dashboard/organisation/requests | - | - | badge<-badge.test.tsx | component-unit only |
| /dashboard/organisation/stories/[id]/edit | (click/redirect, various), edit-event-story.spec.ts | - | story-form<-edit-event-story.test.tsx | e2e only |
| /dashboard/organisation/stories/new | - | - | story-form<-edit-event-story.test.tsx | component-unit only |
| /dashboard/organisation/toys | - | org-inventory.test.tsx | toy-library-card<-saved-card-boundary.test.tsx,toy-library-card.test.tsx; delete-entity-button<-delete-entity-button.test.tsx; org-pickup-form<-org-inventory.test.tsx | unit only |
| /dashboard | contributor-terms.spec.ts, route-protection.spec.ts, shell.spec.ts | dashboard-hub.test.tsx | hub-grid<-hub-grid.test.tsx,impact-hub.test.tsx | e2e+unit |
| /dashboard/print-requests/[id] | answer-by.spec.ts | print-request-detail.test.tsx | toy-transaction-thread<-print-request-detail.test.tsx,toy-transaction-thread.test.tsx; disclosure<-record-card.test.tsx; live-transaction<-live-transaction.test.tsx,print-request-detail.test.tsx; cost-panel<-cost-panel.test.tsx; badge<-badge.test.tsx | e2e+unit |
| /dashboard/print-requests | (click/redirect, various), shell.spec.ts | - | badge<-badge.test.tsx; record-card<-record-card.test.tsx; boundary-link<-dashboard-toys-list.test.tsx | e2e only |
| /dashboard/printers/new | - | - | printer-form<-printer-form.test.tsx | component-unit only |
| /dashboard/printers | - | - | record-card<-record-card.test.tsx; incoming-print-card<-incoming-print-card.test.tsx; badge<-badge.test.tsx | component-unit only |
| /dashboard/profile/delete | - | - | delete-account-form<-delete-account-form.test.tsx | component-unit only |
| /dashboard/profile | account-deletion.spec.ts, session.spec.ts, shell.spec.ts | dashboard-profile.test.tsx | org-invites<-org-invites.test.tsx; profile-form<-profile-form.test.tsx | e2e+unit |
| /dashboard/reports | - | - | my-reports-list<-my-reports-list.test.tsx | component-unit only |
| /dashboard/saved/[type] | (click/redirect, various), saves.spec.ts | saved-list.test.tsx | save-button<-challenge-detail.test.tsx,save-button.test.tsx; boundary-link<-dashboard-toys-list.test.tsx | e2e+unit |
| /dashboard/saved | (click/redirect, various), saves.spec.ts | saved-hub.test.tsx | boundary-link<-dashboard-toys-list.test.tsx | e2e+unit |
| /dashboard/thanks | - | - | person-thanks-notes<-person-thanks-notes.test.tsx | component-unit only |
| /dashboard/toys/[id] | (click/redirect, various) | dashboard-toys-edit.test.tsx | toy-editor<-toy-editor.test.tsx | e2e+unit |
| /dashboard/toys/new | - | dashboard-toys-new.test.tsx | new-toy-form<-new-toy-form.test.tsx | unit only |
| /dashboard/toys | shell.spec.ts, toy-exchange.spec.ts, toys.spec.ts | dashboard-toys-list.test.tsx | toy-library-card<-saved-card-boundary.test.tsx,toy-library-card.test.tsx; boundary-link<-dashboard-toys-list.test.tsx | e2e+unit |
| /dashboard/tutorials | dashboard-tutorials.spec.ts, edit-tutorial.spec.ts, reflow.spec.ts, review-flow.spec.ts, saves.spec.ts, shell.spec.ts, upload-flow.spec.ts | dashboard-tutorials.test.tsx | dashboard-tutorial-card<-dashboard-tutorial-card.test.tsx; boundary-link<-dashboard-toys-list.test.tsx; mark-notifications-read<-dashboard-challenges.test.tsx,dashboard-exchanges.test.tsx,dashboard-tutorials.test.tsx,mark-notifications-read.test.tsx | e2e+unit |
| /delete-account | account-deletion.spec.ts | - | - | e2e only |
| /design-system | - | - | badge<-badge.test.tsx | component-unit only |
| /design-system/states | - | - | badge<-badge.test.tsx | component-unit only |
| /get-involved/contributors | footer.spec.ts | get-involved.test.tsx | - | e2e+unit |
| /get-involved/design-challenges/[id] | - | challenge-detail.test.tsx | follow-writeup<-follow-writeup.test.tsx; save-button<-challenge-detail.test.tsx,save-button.test.tsx; challenge-thread<-challenge-detail.test.tsx,challenge-thread.test.tsx | unit only |
| /get-involved/design-challenges | design-challenges.spec.ts, footer.spec.ts | design-challenges.test.tsx | challenge-card<-challenge-card.test.tsx,saved-card-boundary.test.tsx | e2e+unit |
| /get-involved/events/[id] | (click/redirect, various), edit-event-story.spec.ts | - | print-at-event-form<-print-at-event-form.test.tsx; event-card<-event-card.test.tsx | e2e only |
| /get-involved/events/[id]/register | - | - | event-register-form<-event-register-form.test.tsx; event-card<-event-card.test.tsx | component-unit only |
| /get-involved/events | footer.spec.ts | - | event-card<-event-card.test.tsx | e2e only |
| /get-involved/families | footer.spec.ts | get-involved.test.tsx | - | e2e+unit |
| /get-involved/makers-wanted/new | - | - | - | neither |
| /get-involved/makers-wanted | footer.spec.ts | - | makers-wanted-board<-makers-wanted-board.test.tsx | e2e only |
| /get-involved/organisations | footer.spec.ts | get-involved.test.tsx | - | e2e+unit |
| /get-involved/organisations/request | - | - | - | neither |
| /get-involved | navigation.spec.ts | get-involved.test.tsx | - | e2e+unit |
| /get-involved/recycling/drop-off | - | - | dropoff-form<-dropoff-form-photo.test.tsx | component-unit only |
| /get-involved/recycling | - | recycling.test.tsx | - | unit only |
| /get-involved/requests/new | - | - | back-link<-back-link.test.tsx | component-unit only |
| /get-involved/requests | - | - | badge<-badge.test.tsx; record-card<-record-card.test.tsx | component-unit only |
| /get-involved/submit-a-tutorial | footer.spec.ts | submit-explainers.test.tsx | - | e2e+unit |
| /get-involved/submit-an-idea | design-challenges.spec.ts, footer.spec.ts | submit-explainers.test.tsx | idea-form<-idea-form.test.tsx | e2e+unit |
| /impact/events | - | - | - | neither |
| /impact/map | footer.spec.ts | impact-map.test.tsx | deliveries-map-loader<-impact-map.test.tsx | e2e+unit |
| /impact/news | footer.spec.ts (visited only to assert footer link) | - | - | e2e only (chrome) |
| /impact | footer.spec.ts, impact.spec.ts, navigation.spec.ts | - | - | e2e only |
| /learn/build-a-switch | - | - | learn-gate<-learn-articles.test.tsx,learn-gate.test.tsx,learn-hub.test.tsx | component-unit only |
| /learn/build-duck-bubbles | - | - | learn-gate<-learn-articles.test.tsx,learn-gate.test.tsx,learn-hub.test.tsx | component-unit only |
| /learn/build-hamster-mania | - | - | learn-gate<-learn-articles.test.tsx,learn-gate.test.tsx,learn-hub.test.tsx | component-unit only |
| /learn/build-ms-rachel | - | - | learn-gate<-learn-articles.test.tsx,learn-gate.test.tsx,learn-hub.test.tsx | component-unit only |
| /learn/checkpoint-1 | - | - | learn-gate<-learn-articles.test.tsx,learn-gate.test.tsx,learn-hub.test.tsx | component-unit only |
| /learn/checkpoint-2 | - | - | learn-gate<-learn-articles.test.tsx,learn-gate.test.tsx,learn-hub.test.tsx | component-unit only |
| /learn/checkpoint-3 | - | - | learn-gate<-learn-articles.test.tsx,learn-gate.test.tsx,learn-hub.test.tsx | component-unit only |
| /learn/choosing-a-toy | footer.spec.ts | learn-articles.test.tsx | learn-gate<-learn-articles.test.tsx,learn-gate.test.tsx,learn-hub.test.tsx | e2e+unit |
| /learn/final-checkpoint | - | - | learn-gate<-learn-articles.test.tsx,learn-gate.test.tsx,learn-hub.test.tsx | component-unit only |
| /learn/handover | - | - | learn-gate<-learn-articles.test.tsx,learn-gate.test.tsx,learn-hub.test.tsx | component-unit only |
| /learn/how-a-switch-works | - | - | learn-gate<-learn-articles.test.tsx,learn-gate.test.tsx,learn-hub.test.tsx | component-unit only |
| /learn | navigation.spec.ts, pixel.spec.ts | learn-hub.test.tsx | learn-gate<-learn-articles.test.tsx,learn-gate.test.tsx,learn-hub.test.tsx | e2e+unit |
| /learn/safety-and-cleaning | footer.spec.ts | learn-articles.test.tsx | learn-gate<-learn-articles.test.tsx,learn-gate.test.tsx,learn-hub.test.tsx | e2e+unit |
| /learn/switch-types | footer.spec.ts, navigation.spec.ts | learn-articles.test.tsx, learn-gate.test.tsx | learn-gate<-learn-articles.test.tsx,learn-gate.test.tsx,learn-hub.test.tsx | e2e+unit |
| /learn/tools-and-materials | footer.spec.ts | learn-articles.test.tsx | learn-gate<-learn-articles.test.tsx,learn-gate.test.tsx,learn-hub.test.tsx | e2e+unit |
| /learn/toy-adaptation-101 | footer.spec.ts | learn-articles.test.tsx | learn-gate<-learn-articles.test.tsx,learn-gate.test.tsx,learn-hub.test.tsx | e2e+unit |
| /learn/wire-a-connector | - | - | learn-gate<-learn-articles.test.tsx,learn-gate.test.tsx,learn-hub.test.tsx | component-unit only |
| /learn/ask-an-expert | footer.spec.ts | learn-gate.test.tsx | - | e2e+unit |
| /legal/contributor-terms | footer.spec.ts | - | contributor-terms-content<-contributor-terms-content.test.tsx | e2e only |
| /legal/intended-purpose | footer.spec.ts | - | to-be-completed<-to-be-completed.test.tsx | e2e only |
| /legal/org-leader-terms | footer.spec.ts | - | to-be-completed<-to-be-completed.test.tsx | e2e only |
| /library | contributor-terms.spec.ts, library.spec.ts, navigation.spec.ts, reflow.spec.ts, review-flow.spec.ts, saves.spec.ts | - | - | e2e only |
| /login | (click/redirect, various), entry-flow.spec.ts | login-intent.test.tsx | auth-shell<-auth-shell.test.tsx | e2e+unit |
| /not-built/[id] | not-built.spec.ts | not-built-page.test.tsx | coming-soon<-coming-soon.test.tsx | e2e+unit |
| /notifications | collaborators.spec.ts, route-protection.spec.ts | - | notifications-list<-notifications-list.test.tsx | e2e only |
| /onboarding/child | - | - | child-wizard<-child-wizard.test.tsx | component-unit only |
| /onboarding/contributor-terms | (click/redirect, various) | onboarding-contributor-terms.test.tsx | auth-shell<-auth-shell.test.tsx; terms-gate<-terms-gate.test.tsx; contributor-terms-content<-contributor-terms-content.test.tsx | e2e+unit |
| /organizations/[id]/message | - | - | - | neither |
| /organizations/[id] | org-backing.spec.ts | organization-detail.test.tsx | badge<-badge.test.tsx; org-review-banner<-organization-detail.test.tsx; backing-state<-backing-state.test.tsx; boundary-link<-dashboard-toys-list.test.tsx | e2e+unit |
| /organizations/[id]/projects/[tutorialId] | (click/redirect, various), org-backing.spec.ts, shell.spec.ts | leader-project.test.tsx | tutorial-view<-tutorial-view.test.tsx; backing-state<-backing-state.test.tsx; project-actions<-project-actions.test.tsx | e2e+unit |
| /organizations/[id]/public | - | - | to-be-completed<-to-be-completed.test.tsx; org-actions<-org-actions.test.tsx | component-unit only |
| /organizations | footer.spec.ts, navigation.spec.ts | organizations.test.tsx | - | e2e+unit |
| / | entry-flow.spec.ts, home.spec.ts, navigation.spec.ts, pixel.spec.ts, reflow.spec.ts | - | scroll-world<-scroll-world.test.ts; toy-library-card<-saved-card-boundary.test.tsx,toy-library-card.test.tsx; tutorial-card<-saved-card-boundary.test.tsx,tutorial-card.test.tsx | e2e only |
| /printing/basics | footer.spec.ts, navigation.spec.ts | learn-articles.test.tsx | - | e2e+unit |
| /printing | footer.spec.ts, navigation.spec.ts | - | printer-directory<-printer-directory.test.tsx | e2e only |
| /printing/parts | printing-parts.spec.ts | printing-parts.test.tsx | save-button<-challenge-detail.test.tsx,save-button.test.tsx | e2e+unit |
| /printing/requests | - | - | back-link<-back-link.test.tsx; request-print-form<-request-print-form.test.tsx | component-unit only |
| /privacy | footer.spec.ts, navigation.spec.ts | trust-pages.test.tsx | - | e2e+unit |
| /safety | footer.spec.ts | trust-pages.test.tsx | - | e2e+unit |
| /signup | (click/redirect, various), signup.spec.ts | signup-page.test.tsx, signup.test.tsx | auth-shell<-auth-shell.test.tsx; contributor-terms-dialog<-contributor-terms-dialog.test.tsx | e2e+unit |
| /terms | footer.spec.ts | trust-pages.test.tsx | - | e2e+unit |
| /toy-library/[id] | (click/redirect, various), toy-exchange.spec.ts | - | toy-picks<-toy-picks.test.tsx; save-button<-challenge-detail.test.tsx,save-button.test.tsx; toy-transaction-request<-toy-transaction-request.test.tsx; toy-facts<-toy-facts.test.tsx; report-link<-toy-facts.test.tsx | e2e only |
| /toy-library/[id]/request | toy-exchange.spec.ts | - | - | e2e only |
| /toy-library | navigation.spec.ts | - | toy-library-client<-toy-library-client.test.tsx | e2e only |
| /tutorials/[id]/edit | collaborators.spec.ts, contributor-terms.spec.ts, edit-tutorial.spec.ts, org-backing.spec.ts | edit-tutorial.test.tsx | pdf-import-banner<-edit-tutorial.test.tsx,pdf-import-flow.test.tsx; edit-items-section<-edit-items-section-parts.test.tsx,edit-items-section-tools.test.tsx,edit-items-section.test.tsx,edit-tutorial.test.tsx; delete-entity-button<-delete-entity-button.test.tsx; edit-suits-section<-edit-suits-section.test.tsx; dashboard-tutorial-card<-dashboard-tutorial-card.test.tsx; edit-safety-notes-section<-edit-safety-notes-section.test.tsx; stl-settings-form<-stl-settings-form.test.tsx; edit-recommendations-section<-edit-recommendations-section.test.tsx,edit-tutorial.test.tsx; edit-steps-section<-edit-steps-section.test.tsx; edit-collaborators-section<-edit-collaborators-section.test.tsx,edit-tutorial.test.tsx; customization-fields-form<-customization-fields-form.test.tsx; edit-backing-section<-edit-backing-section.test.tsx,edit-tutorial.test.tsx; stepper<-edit-tutorial.test.tsx,stepper.test.tsx; tutorial-view<-tutorial-view.test.tsx; toast<-add-stl-form.test.tsx,created-toast.test.tsx,customization-fields-form.test.tsx,edit-backing-section.test.tsx,edit-collaborators-section.test.tsx,edit-details-section.test.tsx,edit-files-section.test.tsx,edit-items-section.test.tsx,edit-recommendations-section.test.tsx,edit-steps-section.test.tsx,idea-author-actions.test.tsx,org-actions.test.tsx,photo-tiles.test.tsx,printing-parts.test.tsx,save-button.test.tsx,stl-settings-form.test.tsx,toast.test.tsx,toy-photos-section.test.tsx; edit-details-section<-edit-details-section.test.tsx,edit-tutorial.test.tsx; created-toast<-created-toast.test.tsx,edit-tutorial.test.tsx; add-stl-form<-add-stl-form.test.tsx,edit-tutorial.test.tsx; edit-files-section<-edit-files-section.test.tsx,edit-tutorial.test.tsx | e2e+unit |
| /tutorials/[id] | contributor-terms.spec.ts, library.spec.ts, org-backing.spec.ts, reflow.spec.ts, shell.spec.ts, tutorial-detail.spec.ts, tutorial-downloads.spec.ts | - | thanks-button<-thanks-button.test.tsx; tutorial-view<-tutorial-view.test.tsx; save-button<-challenge-detail.test.tsx,save-button.test.tsx; mark-build-done-button<-mark-build-done-button.test.tsx | e2e only |
| /upload | reflow.spec.ts, route-protection.spec.ts, upload-flow.spec.ts | upload.test.tsx | new-tutorial-form<-new-tutorial-form.test.tsx,pdf-import-flow.test.tsx,upload.test.tsx | e2e+unit |