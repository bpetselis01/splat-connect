# Decisions build (the five larger pieces) — Implementation Plan

**Date:** 2026-10-20
**Status:** planned
**Requirements:** `docs/plans/decisions-build-requirements.md` (R1–R19)
**Decisions:** the `Decided 2026-10-20:` lines in `packages/types/src/pending.ts` for `web-auth-recovery`, `confirmed-page-bare-layout`, `silent-handoffs`, `org-notifications-never-clear`, `login-return-path`, `org-directory-terms-gate`, `terms-gate-fails-open`, `duplicated-thread-actions`, `admin-in-member-threads`, `dead-routes-and-handlers`; each has a `PENDING(id)` marker at its code site, deleted by the unit that ships it.

## Architecture

Five pieces, six PRs off `development`, landed in this order: dead routes (U1–U3), thread actions (U4–U6), return path and client-side terms handling (U7, U8, U8b, U10), notifications (U11–U14), web auth (U15–U20), and last the API terms gate (U9) on its own, after the mobile release that carries U10 is live, so no shipped app build ever sees a raw `terms_required`. Each PR is green on CI before merge; the two migrations (140 message kind + policy, 141 notification types) go to hosted by Byron before the API deploy that writes them (`docs/plans/decisions-build-requirements.md` Q1–Q2).

What stays fixed:
- **One actions module.** `packages/web/app/dashboard/exchanges/actions.ts` (`'use server'` at file level, exported plain functions taking args) is the only place the five thread actions call the API; the three pages become thin. Same shape as `app/dashboard/organisation/acting-org-actions.ts`.
- **One sanitiser.** `packages/web/lib/safe-next-path.ts` is the only same-origin check; every redirect to `/login` or `/signup` is built by one helper, `loginUrl(pathWithQuery)`, in that file.
- **One terms check on the API.** `packages/api/src/terms.ts` (API helpers are flat in `src/`, like `chunk.ts` and `review-notifications.ts`) exports `requireContributorTerms`, middleware in the shape of `middleware/auth.ts`, returning `403 { error: 'terms_required', version }`. The existing `hasAcceptedContributorTerms` in `tutorials.ts` already returns false on any error, so it is already fail-closed; it moves there unchanged except for logging the error case. The gated-route list is a constant in the same file.
- **One auth error classifier.** `packages/types/src/auth-errors.ts` (moved from mobile) is imported by both clients; copy lives with the kinds.
- **One terms detection.** Every client goes through `makeApiClient` in `packages/types/src/api-core.ts`; `isTermsRequired(err)` lives beside `isApiError` there, and each environment adds one navigation hook (browser `window.location.assign`, server `redirect()`, mobile `router.push`). No new error class.
- **Notification types land one group per commit**: union + `NOTIFICATION_BUCKET` + `COPY` + web `ICON`/`linkFor` + mobile `linkFor` + the three type-list tests + schema guard + migration entry + API writers + api integration test + journeys rows, together, so `satisfies Record` compiles and `scripts/journeys/notifications.mjs` finds a creator and an asserting test at every commit.
- **Journeys.** New rows use the next free ids, all verified free: web auth WA30–WA38, exchanges WX26, admin WM37–WM38, mobile exchanges X15–X16, mobile auth A15. Existing write rows gain `notifies` entries for new types rather than new rows. `pnpm test:journeys` exits 0 at every commit.

## Piece 5: dead routes (R18, R19)

### Unit 1: Delete the web not-built page

**Goal:** Remove `/not-built/[id]` and the helper only it uses, with its tests and journey rows.

**Requirements trace:** R18, R19

**Dependencies:** none

**Files:**
- `packages/web/app/not-built/[id]/page.tsx` — delete
- `packages/web/lib/pending-icons.ts` — delete (only user was the page)
- `packages/web/components/coming-soon.tsx` — drop the `/not-built` path; keep the scaffold-page use
- `packages/web/tests/unit/app/not-built-page.test.tsx` — delete
- `packages/web/tests/e2e/public/not-built.spec.ts` — delete
- `scripts/journeys/journeys.json` — remove WC15 and WL08
- `docs/testing/journeys.md` — regenerate (`pnpm test:journeys:write`)
- `packages/types/src/pending.ts` — nothing here; the `PENDING(dead-routes-and-handlers)` marker is removed in U3

**Approach:** Delete the page and the helper, grep `pending-icons` and `/not-built` across `packages/web` (mobile's `app/not-built.tsx` is a different route and stays), regenerate the rendered map. The route tripwire reports `route "/not-built/[id]" matches no file` until the rows go, which is the proof the rows were the only reference.

**Patterns:** commit c17f9461 (four unused components deleted the same way).

**Test scenarios:**
- [ ] Happy path: `pnpm test:journeys` exits 0 with 692 rows and 0 gaps after the rows are removed
- [ ] Nil/empty input: `coming-soon.tsx` renders for a scaffold page with no `featureKey` (existing `coming-soon.test.tsx` stays green)
- [ ] Error path: visiting `/not-built/anything` on the web e2e stack returns Next's 404 page (one assertion added to `tests/e2e/public/scaffold.spec.ts` or nearest)
- [ ] Edge case: mobile `A03`/`A13` rows still match `app/not-built.tsx` (tripwire green on mobile)

**Verification:** `scripts/verify-plan.sh --run` green; `pnpm test:journeys` exit 0.

**Planning-time unknowns:** none.

### Unit 2: Delete NotifyForm, POST /api/public/notify and notify_signups

**Goal:** Remove the unreachable "tell me when it ships" form, its API route and its table.

**Requirements trace:** R18, R19

**Dependencies:** U1 (the only importer of NotifyForm was reachable only through the not-built page)

**Files:**
- `packages/web/components/notify-form.tsx` — delete
- `packages/web/components/coming-soon.tsx` — remove the NotifyForm import and the `featureKey` branch
- `packages/web/lib/public-nav.ts` — drop `featureKey` from 'soon' items and `SCAFFOLD_KEYS`' notify use (keep the nav model otherwise)
- `packages/api/src/routes/public.ts` — delete `publicRoutes.post('/notify')`, `NOTIFY_FEATURE_KEYS`, `EMAIL_RE` if unused elsewhere
- `supabase/migrations/140_drop_notify_signups.sql` — NOT in this unit. The table may hold real addresses people gave on hosted; dropping it is a one-way door. It stays until Byron confirms hosted `notify_signups` is empty or exported, then a separate migration drops it (see Planning-time unknowns)
- `packages/web/tests/unit/components/notify-form.test.tsx` — delete; `coming-soon.test.tsx` and `scaffold-pages.test.tsx` — drop the NotifyForm cases
- `packages/api/tests/integration/public/notify.test.ts` — delete
- `scripts/check-schema-guards.sh` — remove any `notify_signups` probe (grep first)

**Approach:** Delete from the client inward; run `pnpm --filter @splat-connect/api test:unit` to confirm the route-coverage ratchet has nothing to say (a deleted route drops out). The table stays in this unit; nothing reads or writes it once the route is gone, and `db:guards` keeps probing it until the follow-up migration drops it.

**Patterns:** migrations 050 (`archived_at` drop) for a column/table removal with the guard script updated in the same change.

**Test scenarios:**
- [ ] Happy path: `POST /api/public/notify` answers 404 (one line in `tests/integration/public/public-404.test.ts` or the nearest existing 404 test)
- [ ] Nil/empty input: a 'soon' nav item without `featureKey` renders the same (nav tests green)
- [ ] Error path: an insert into `notify_signups` by the anon role now has no route to reach it; `db:guards` still green with the table present
- [ ] Edge case: `scripts/check-schema-guards.sh` keeps its `notify_signups` probe until the follow-up migration

**Verification:** api unit + integration green; `pnpm db:check` and `pnpm db:guards` green; web unit green.

**Planning-time unknowns:** Resolve Before Planning — Byron confirms whether hosted `notify_signups` holds rows (export them if so); only then a separate migration drops the table and the guard probe. Deferred — whether `EMAIL_RE` has another user in `public.ts` (grep decides; keep if so).

### Unit 3: Delete DELETE /tutorials/:id/build

**Goal:** Remove the un-called "take a build back" route and its test; remove the dead-routes marker.

**Requirements trace:** R18, R19

**Dependencies:** none (independent of U1–U2; same PR)

**Files:**
- `packages/api/src/routes/tutorials.ts` — delete `tutorials.delete('/:id/build')`
- `packages/api/tests/integration/guides/builds.test.ts` — delete the "takes a build back" case
- `packages/api/src/routes/exchange-costs.ts` — remove the `// PENDING(dead-routes-and-handlers)` line
- `packages/types/src/pending.ts` — `dead-routes-and-handlers`: `shipped: true`, and record in `needs` that the map, constraints and costs routes were kept because mobile calls them
- `docs/PENDING.md` — regenerate (`node scripts/pending.mjs`)

**Approach:** Delete the handler; the `tutorial_builds` table stays (POST `/build` and `me.ts` read it). Regenerate the checklist; the drift test passes because the item is shipped.

**Patterns:** the `shipped: true` flow in `pending-work-registry` memory.

**Test scenarios:**
- [ ] Happy path: `DELETE /api/tutorials/:id/build` answers 404 with the standard body (add to the builds test)
- [ ] Nil/empty input: `POST /:id/build` unchanged (existing case green)
- [ ] Error path: `pending-features.test.ts` passes with the item shipped and unreferenced
- [ ] Edge case: `route-coverage.test.ts` still has an empty `UNTESTED`

**Verification:** api tests green; `node scripts/pending.mjs --check` green.

**Planning-time unknowns:** none.

## Piece 4: thread actions (R15, R16, R17, R19)

### Unit 4: One actions module for the three thread pages

**Goal:** The five thread actions exist once and the pages call them; behaviour unchanged.

**Requirements trace:** R15, R19

**Dependencies:** none

**Files:**
- `packages/web/app/dashboard/exchanges/actions.ts` — new: `'use server'`; `sendMessage(id, kind, body)`, `accept(id, kind, address?)`, `reject(id, kind, reason?)`, `withdraw(id, kind)`, `confirm(id, kind, code)`; `kind: 'exchange' | 'build' | 'print'` picks the `revalidatePath` target
- `packages/web/app/dashboard/exchanges/[id]/page.tsx` — delete the inline actions; bind `kind: 'exchange'`
- `packages/web/app/dashboard/exchanges/build/[id]/page.tsx` — same with `'build'`; remove the `PENDING(duplicated-thread-actions)` line
- `packages/web/app/dashboard/print-requests/[id]/page.tsx` — same with `'print'`
- `packages/web/tests/unit/pages/exchange-thread-pages.test.tsx` — mock the module instead of the inline functions; WX05–WX09, WX15–WX19, WR12–WR16 titles unchanged
- `packages/web/tests/unit/actions/exchange-actions.test.ts` — new: each function posts the right path and body, revalidates the right path
- `packages/types/src/pending.ts` — not yet shipped (U5 finishes the decision)

**Approach:** Lift the print page's versions (they are the superset: `reject(reason?)`), parametrise the path and the revalidate target, then make each page pass `kind`. The thread component's props keep their shape; the page binds `id` and `kind` with `.bind(null, id, kind)` or wrapper arrow functions in the server component, which is allowed because the wrapped target is a plain exported action, not a closure over page state (the inline-server-action memory).

**Patterns:** `app/dashboard/organisation/acting-org-actions.ts`; `app/admin/review/actions.ts`.

**Test scenarios:**
- [ ] Happy path: `accept('t1','exchange',{line1:…})` posts `/api/toy-transactions/t1/accept` with the address and revalidates `/dashboard/exchanges/t1`
- [ ] Nil/empty input: `reject('t1','build')` posts `{}`-free body `{ reason: undefined }` → serialised as `{}` (assert the body has no `reason` key)
- [ ] Error path: an API 409 from `accept` surfaces as the same thrown error the pages threw before (page test for WX06 still asserts the message)
- [ ] Edge case: `withdraw('p1','print')` revalidates `/dashboard/print-requests/p1`, not the exchanges path

**Verification:** `exchange-thread-pages.test.tsx` green with no inline actions left (grep `'use server'` under the three pages returns nothing); web e2e `exchanges/*.spec.ts` green on the shared stack.

**Planning-time unknowns:** none.

### Unit 5: A reason on every decline, shown to the other party

**Goal:** Every decline carries a reason on all three kinds and both clients render it.

**Requirements trace:** R16, R19

**Dependencies:** U4

**Files:**
- `packages/api/src/routes/toy-transactions.ts` — `POST /:id/reject`: require `reason` (1–500) for every type, not only print; the 400 bodies are `{ error: 'reason_required' }` and `{ error: 'reason_too_long', max: 500 }`
- `packages/web/components/toy-transaction-thread.tsx` — the Decline button opens the reason form for all kinds; the rejected state renders `tx.decline_reason` under "This request was declined."
- `packages/mobile/components/exchanges/thread-screen.tsx` and `packages/mobile/components/builds/build-thread-screen.tsx` — a reason sheet before `reject`; render `decline_reason` in the declined state (print's `job-screen.tsx` already does)
- `packages/api/tests/integration/toy-transactions/reject-withdraw.test.ts` — reject without a reason → 400 for gift/swap/build; with a reason → stored and shown in the system message and notification body
- `packages/web/tests/unit/components/toy-transaction-thread-actions.test.tsx` and `tests/e2e/exchanges/{gift,build}.spec.ts` — WX07 and WX17 now send a reason and the requester sees it
- `packages/mobile/tests/unit/components/exchanges/thread-screen*.test.tsx`, `tests/e2e/exchanges*.spec.ts` — X05 sends a reason; the requester screen shows it
- `scripts/journeys/journeys.json` — WX07, WX17, X05 elements updated ("Decline with a reason"); new WX26 (requester reads the reason) and X15 (mobile requester reads it); `packages/types/src/pending.ts` — `duplicated-thread-actions` shipped; marker gone

**Approach:** API first (the e2e for the old no-reason decline must start failing before the client change, the pass/fail loop). The reason form already exists for print in the thread component; make it unconditional. Mobile gets a two-line sheet reusing the existing `Sheet` pattern in `components/ui`.

**Patterns:** print's existing reason path (`job-screen.tsx:525`, `offer-screen.tsx:195`).

**Test scenarios:**
- [ ] Happy path: owner declines a gift with "Already given away" → requester's thread shows the reason on web and mobile; notification body carries it
- [ ] Nil/empty input: empty or whitespace reason → 400 `reason required`, form shows the field error
- [ ] Error path: 501-character reason → 400, the field shows the limit
- [ ] Edge case: a declined thread created before this change (no `decline_reason`) renders the plain "declined" line without an empty quote block
- [ ] Edge case: Decline submitted twice (double-click or two tabs) → the second call gets the API's existing 409 "This request is no longer open", which the form shows verbatim instead of a stuck spinner

**Verification:** api integration green; web e2e exchanges green; whole mobile `npx jest` green; mobile e2e exchanges green; `pnpm test:journeys` 0 gaps.

**Planning-time unknowns:** Deferred — the exact sheet component on mobile (reuse whichever `components/ui` sheet the build screen already imports).

### Unit 6: Admins read and post in member threads, labelled, without lifecycle

**Goal:** An admin's message is stored and rendered as an admin message; admin lifecycle actions are refused.

**Requirements trace:** R17, R19

**Dependencies:** U4 (the pages call the module; the component renders kinds)

**Files:**
- `supabase/migrations/140_admin_thread_messages.sql` — `toy_transaction_messages.kind` CHECK gains `'admin'`, and the member insert policy (`033:205`, today `sender_id = auth.uid()` + party) gains `and kind = 'user'`, so neither `admin` nor `system` can be inserted through PostgREST by a party; the admin `for all` policy and the service-role client keep their writes
- `packages/types/src/index.ts` — `ToyTransactionMessageKind = 'system' | 'user' | 'admin'`
- `packages/api/src/routes/toy-transactions.ts` — `POST /:id/messages`: load the transaction and the caller's role before the insert (today it inserts first and loads after); an admin who is not a party inserts through the admin client with `kind: 'admin'`, `actor_name` "SPLAT admin", and notifies both parties (today the owner-side branch would miss the requester); `accept`, `reject`, `withdraw`, `confirm`: the existing 403/404 for a non-party admin becomes `403 { error: 'admin_cannot_act' }` (a rename of the refusal `isOwnerSide` already produces)
- `packages/web/components/exchange-chat.tsx` — render `kind === 'admin'` with a "SPLAT admin" label and its own bubble style
- `packages/mobile/components/exchanges/exchange-chat.tsx` (or the bubble component the three screens share) — same label
- `packages/api/tests/integration/toy-transactions/admin-thread.test.ts` — new: admin reads a stranger's thread (200), posts (kind admin, both parties notified), accept/reject/withdraw/confirm → 403
- `packages/web/tests/e2e/admin/thread.spec.ts` — new WM37 (admin opens a build thread from `/admin/build-requests`, posts, sees the label; the member sees it too); `scripts/journeys/journeys.json` — WM37, WM38 (refused actions), X16 (member sees the admin label on mobile)
- `packages/types/src/pending.ts` — `admin-in-member-threads` shipped; `scripts/check-schema-guards.sh` — probe the new kind

**Approach:** Migration first, then API, then both clients. The system/user grouping in `exchange-chat.tsx` keys on `kind`, so the admin label is a third branch, not a sender lookup.

**Patterns:** `138_event_change_notifications.sql` for a CHECK-constraint widening with the guard; `review-notifications.ts` for notifying both parties.

**Test scenarios:**
- [ ] Happy path: admin posts "Checking in on this one" → both parties get `toy_message` with the admin's name; bubble shows "SPLAT admin"
- [ ] Nil/empty input: admin posts an empty body → 400 (same rule as members)
- [ ] Error path: admin calls `/accept` on a thread they are not party to → 403 `admin_cannot_act`; an admin who IS a party (their own toy) can still accept
- [ ] Edge case: a thread with messages of all three kinds groups consecutive admin messages like user messages, never like system lines
- [ ] Security: a party inserting `{ kind: 'admin' }` or `{ kind: 'system' }` directly through PostgREST with their own JWT is refused by the policy (integration test with the user client)
- [ ] Edge case: an admin who IS a party (their own toy) posts as a user message and can accept

**Verification:** `db:guards` green with the new kind; api integration green; web e2e admin spec green; mobile jest green.

**Planning-time unknowns:** none. Resolved by research: one shared `packages/mobile/components/ui/MessageBubble.tsx` renders every bubble and branches on `kind` at line 24 (`system`); the admin label is a third branch there, and the three screens' `mine={… && m.kind === 'user'}` stays correct (an admin message is never `mine` for a party). The challenges and ask-first screens use the same bubble and inherit the label for free.

## Piece 3: return path and terms (R5–R9, R19)

### Unit 7: Every redirect to /login carries the path; the gate fails closed; /organizations is public

**Goal:** The middleware and the two server helpers never drop the destination; a failed terms lookup blocks.

**Requirements trace:** R5, R6, R7, R19

**Dependencies:** none

**Files:**
- `packages/web/lib/safe-next-path.ts` — add `authUrl('login' | 'signup', pathWithQuery, extraParams?)` which sanitises its input with `sanitiseNextPath` before encoding (never trusts a caller); `sanitiseNextPath` unchanged. Deleting the terms page's local `safeNext` is a security fix: it normalised backslashes instead of rejecting them and accepted schemes
- `packages/web/middleware.ts` — signed-out redirect uses `authUrl('login', pathname + search)`; `nextWithPathname` sets a second request header `x-pathname-search` = `pathname + search` (today `x-pathname` is the pathname only, so the query would be lost); remove `/organizations` from `termsGatedPrefixes`; the terms redirect's `next` carries `pathname + search`; the terms lookup `error` branch redirects to `/onboarding/contributor-terms?next=…&retry=1`; remove the three `PENDING` lines
- `packages/web/lib/require-capabilities.ts` — read `headers().get('x-pathname-search')` and redirect to `authUrl('login', that)`; fall back to bare `/login` when the header is absent (tests)
- `packages/web/components/learn-gate.tsx` — `redirect(authUrl('login', currentPath))` where `currentPath` is passed in by the course page (it knows the lesson slug)
- `packages/web/app/onboarding/contributor-terms/page.tsx` — show "We could not check your acceptance, try again" when `retry=1`; delete the local `safeNext()` in favour of `sanitiseNextPath`
- `packages/web/tests/unit/app/middleware.test.ts`, `middleware-journeys.test.ts`, `organizations-terms-gate.test.ts`, `tests/unit/lib/safe-next-path.test.ts` — WA23 now asserts `?next=`, WA27 asserts the block and the retry param, WA28/WN03 assert `/organizations` is open signed-in without terms
- `scripts/journeys/journeys.json` — WA23, WA27, WA28, WN03, WE02 elements updated

**Approach:** One helper, three call sites. The middleware already sets `x-pathname` for every request that reaches a page but without the query, so the one new line of plumbing is the sibling header inside `nextWithPathname` (its comment explains why every construction site must set it). The fail-closed branch keeps the `console.error` and adds the redirect.

**Patterns:** the existing `?next=` sites in `toy-library/[id]/request/page.tsx` and `get-involved/events/[id]/register/page.tsx`.

**Test scenarios:**
- [ ] Happy path: signed out on `/dashboard/exchanges/abc?tab=open` → `/login?next=%2Fdashboard%2Fexchanges%2Fabc%3Ftab%3Dopen`; after sign-in the member lands there
- [ ] Nil/empty input: `x-pathname-search` missing → `requireCapabilities` redirects to bare `/login`
- [ ] Happy path (the one the audit missed): a page behind `requireCapabilities` opened signed-out at `/dashboard/printing?tab=jobs` → `next` keeps `?tab=jobs` (unit test on the helper with the header set)
- [ ] Error path: terms lookup throws → redirect to the terms page with `retry=1`; the page shows the retry message; a second load with a healthy lookup passes
- [ ] Edge case: `/organizations/o1/public` signed in without terms → page renders (no redirect); `/dashboard` still gated

**Verification:** web unit green; web e2e `auth/route-protection.spec.ts` and `contributor/contributor-terms.spec.ts` green (their expectations flipped in the same commit); `pnpm test:journeys` 0 gaps.

**Planning-time unknowns:** none. Resolved by research: Next is 16.2.6 and `headers()` returns `Promise<ReadonlyHeaders>`, so `requireCapabilities` awaits it; `nextWithPathname` is at `middleware.ts:27` (header set at line 29, called at 34 and 48) and the only reader of `x-pathname` is `app/layout.tsx:88`, so adding the sibling `x-pathname-search` header changes no existing consumer.

### Unit 8: The pages that keep the path but drop the query

**Goal:** `?mode=` on a toy request and `?org=` on a drop-off survive sign-in; the signup links carry the query too.

**Requirements trace:** R5, R19

**Dependencies:** U7 (uses `loginUrl`)

**Files:**
- `packages/web/app/toy-library/[id]/request/page.tsx` — `authUrl('login', \`/toy-library/${id}/request?mode=${mode}\`)` when `mode` is valid
- `packages/web/app/get-involved/recycling/drop-off/page.tsx` — same with `?org=`
- `packages/web/tests/unit/pages/toy-request-gate.test.tsx` (or the nearest existing page test) and `drop-off-page.test.tsx` — the redirect keeps the query
- `packages/web/tests/e2e/toys/toy-library.spec.ts` — WY07 asserts the return lands on the request form with the mode preselected
- `scripts/journeys/journeys.json` — WY07, WI09 elements updated; `packages/types/src/pending.ts` — `login-return-path` and `org-directory-terms-gate` shipped

**Approach:** Mechanical: replace each hand-built URL with the helper. `useSearchParams` gives the query in client components.

**Patterns:** U7's helper.

**Test scenarios:**
- [ ] Happy path: anon opens `/toy-library/t1/request?mode=exchange` → sign in → lands with `mode=exchange` selected
- [ ] Nil/empty input: `?mode=` absent → redirect carries the bare path
- [ ] Error path: `?mode=evil` (not donation/exchange) → redirect carries the bare path (invalid mode dropped, as today)
- [ ] Edge case: a toy request started at `/toy-library/t1/request?mode=donation` survives signup as well as sign-in

**Verification:** web unit + e2e toys and recycling specs green.

**Planning-time unknowns:** none.

### Unit 8b: Client links that carry the query

**Goal:** Every client-side link to `/login` or `/signup` carries the current path with its query.

**Requirements trace:** R5, R19

**Dependencies:** U7

**Files:**
- `packages/web/components/{save-button,thanks-button,person-thanks-button,org-actions}.tsx` — `authUrl('signup', pathname + search, { reason })`
- `packages/web/components/nav.tsx`, `challenge-thread.tsx` — the bare `/login` links carry `next` for the current page
- `packages/web/tests/unit/components/save-button.test.tsx` (and the nearest existing tests for the others) — the href keeps the query

**Approach:** Mechanical; `useSearchParams` gives the query in client components.

**Patterns:** U7's helper.

**Test scenarios:**
- [ ] Happy path: a save-button click on `/toy-library?offer=gift` sends `next=/toy-library?offer=gift`
- [ ] Nil/empty input: no query → the bare path
- [ ] Error path: the helper, not a hand-built string, is what every site calls (a test greps the components for `/signup?next=`)
- [ ] Edge case: the nav sign-in link on `/login` itself does not nest `next` inside `next`

**Verification:** web unit green; e2e saves spec green.

**Planning-time unknowns:** none.

### Unit 9: The API refuses gated writes without current terms

**Goal:** `requireContributorTerms` guards the listed writes with `403 terms_required`, fail closed.

**Requirements trace:** R8, R19

**Dependencies:** none (lands with U10 in the same PR; U10 must merge with it or clients see raw 403s)

**Files:**
- `packages/api/src/terms.ts` — new: `hasAcceptedContributorTerms` moved from `tutorials.ts` (already false on any error; now it also logs `[terms] lookup failed route= user=`), the middleware `requireContributorTerms` (403 `{ error: 'terms_required', version: AGREEMENT_VERSIONS.contributor_terms }`; admins are NOT exempt, Byron 2026-10-20), and `TERMS_GATED` listing every gated route
- `packages/api/src/routes/tutorials.ts` — use the helper at the two existing checks; add it to `PUT /:id/steps`
- `packages/api/src/routes/toy-transactions.ts` — apply to `POST /`, `/build`, `/print`, `/print-at-event`, `/:id/messages`, `/:id/accept`, `/:id/claim`, `/:id/questions`
- `packages/api/src/routes/organizations.ts` — apply to every organisation write except `POST /:id/follow` and `/:id/thanks` (Byron 2026-10-20): `/:id/conversations/mine/messages`, `/conversations/:cid/messages`, `/:id/leaders`, `PATCH /:id/pickup`, `/:id/profile`, `PUT /:id/doors`, `/:id/rate-lines`, `POST /:id/events`, `PATCH`/`DELETE /:id/events/:eid`, `POST /:id/stories`, `/:id/recycling` (booking), `PATCH /:id/recycling/:rid` (decision), `/requests`
- `packages/api/tests/integration/terms/gated-writes.test.ts` — new, table-driven over `TERMS_GATED`: without acceptance → 403 `terms_required`; with → not 403; an admin without acceptance → 403 (not exempt); `POST /:id/follow`, every `GET`, and `POST /api/agreements` → never 403 for terms
- `packages/api/tests/unit/terms.test.ts` — accepted, missing, and a stubbed `createUserClient` that errors → false and the log line
- `scripts/journeys/journeys.json` — existing api-layer rows for these writes get `"terms gate"` in `element` where room; new row WA30 (web: a gated write without terms → 403 → terms page → retry)

**Approach:** Middleware per route (`route.post('/path', requireAuth, requireContributorTerms, handler)`), never router-wide, so reads and the agreements route itself stay open. The e2e seed's `acceptTerms` already stamps the current version for test users; tests that want the 403 create a user without it. Blast radius, accepted by the fail-closed decision: an outage of `user_agreements` blocks every gated write for everyone on both clients; each refusal logs `[terms] lookup failed route= user=` so the outage is visible in API logs. Deploy order: this unit is its own PR, merged and deployed only after the mobile release that carries U10 is live; the clients' handling is a no-op until the API sends the code, so shipping them first is safe. No env flag: the PR order is the gate.

**Patterns:** the two existing checks in `tutorials.ts`; `requireAuth` middleware shape in `packages/api/src/middleware`.

**Test scenarios:**
- [ ] Happy path: a member with the current version posts a message → 201
- [ ] Nil/empty input: a member with an older version row → 403 `terms_required` naming the current version
- [ ] Error path: the agreements lookup errors → 403 (fail closed), logged with the route
- [ ] Edge case: `POST /api/agreements` itself is never gated; `GET` reads on the same routers are never gated (assert two)

**Verification:** api unit + integration green; `route-coverage` still empty.

**Planning-time unknowns:** none (the error path is a unit test with a stubbed client; the integration suite covers accepted/missing).

### Unit 10: Both clients route to terms on `terms_required` and retry

**Goal:** A `terms_required` 403 on any write sends the member to their terms screen with a way back, on web and mobile.

**Requirements trace:** R9, R19

**Dependencies:** U9

**Files:**
- `packages/types/src/api-core.ts` — `isTermsRequired(err)` beside `isApiError`, reading the error code from the response body (the status line already carries it); `apiMessage` maps it to "Accept the contributor terms to continue" so a missed call site never shows the raw code
- `packages/web/lib/browser-api-client.ts` and the server `apiClient` — one navigation hook each: the browser does `window.location.assign(authTermsUrl(current))`, the server `redirect()`s; both compute `next` from the current path and query
- `packages/web/app/onboarding/contributor-terms/page.tsx` — after accept, return to `next` (already does)
- `packages/mobile/lib/api-client.ts` — the mobile hook: `router.push` to the terms screen (`app/terms.tsx`) with `returnTo`, using the existing `takeReturnTo()` mechanism from `(auth)/_layout.tsx`
- `packages/types/tests/api-core.test.ts` — `isTermsRequired` on the JSON body, on a non-JSON 403 body (false), on a plain 403 (false); `packages/web/tests/unit/lib/browser-api-client.test.ts` (assign called with the right URL), a server `apiClient` test (redirect called), `packages/mobile/tests/unit/lib/api-client.test.ts` (push called with returnTo)
- `packages/web/tests/e2e/contributor/contributor-terms.spec.ts` — WA30: a member without terms sends an exchange message → lands on terms → accepts → the message is sent
- `packages/mobile/tests/e2e/auth.spec.ts` — A15: same on mobile
- `scripts/journeys/journeys.json` — WA30, A15; `packages/types/src/pending.ts` — `terms-gate-fails-open` shipped

**Approach:** One detection point per client, where the API error is already turned into a thrown error. Retrying the original write after acceptance is not automatic: the member returns to the page and resubmits. On web the composer (`exchange-chat.tsx`) is a client component calling the server action; it catches the terms error on the client, saves its draft to `sessionStorage` under `draft:<threadId>` in a try/catch (storage can be unavailable), then navigates to the terms URL, and restores the draft on return; a server action cannot run client code before it redirects, so the save happens in the client catch, never inside the action. Mobile screens keep their state across the terms screen.

**Patterns:** `(auth)/_layout.tsx` `takeReturnTo()`; the web terms page's `next` handling.

**Test scenarios:**
- [ ] Happy path: member without terms clicks Send on a thread → terms page → Accept → back on the thread, message still typed, Send works
- [ ] Nil/empty input: a 403 without `error: 'terms_required'` (a plain forbidden, or a non-JSON body) is not intercepted
- [ ] Error path: accepting terms fails (API down) → the terms page shows its error and keeps `next`
- [ ] Edge case: mobile member on an exchange screen gets the 403 → terms screen → Accept → returns to the same screen, not Home

**Verification:** web and mobile unit green; the two e2e specs green; mobile jest whole-suite green.

**Planning-time unknowns:** none.

## Piece 2: notifications (R10–R14, R19)

Migration note: U11–U13 share `supabase/migrations/141_handoff_notifications.sql`, written once in U11 with all 15 types (the CHECK list is re-stated whole), so the hosted push happens once; U12 and U13 only add code. `notifications.mjs` treats a type with no creator as an error unless it is in `DEAD_ALLOWED`, and it reads creators from migrations that insert, not from CHECK lists, so a type listed in the CHECK but absent from the TypeScript union is invisible to it: the migration can list all 15 while the union gains a group per commit. The migration lands in the same commit as the first group. Hosted order: migration 141 before the API deploy of U11.

### Unit 11: Exchange-outcome notifications

**Goal:** `recycling_received`, `recycling_declined`, `org_request_approved`, `org_request_declined`, `test_print_passed`, `test_print_failed`, `handover_confirmed` exist end to end.

**Requirements trace:** R10, R13, R19

**Dependencies:** none (first notification unit; carries the migration)

**Files:**
- `supabase/migrations/141_handoff_notifications.sql` — CHECK gains all 15 new types
- `packages/types/src/index.ts` — the 7 union members, `NOTIFICATION_BUCKET` (`exchanges` except the two `org_request_*` → `organisations`), `COPY`; remove the `PENDING(silent-handoffs)` line only in U13
- `packages/web/components/notifications-list.tsx` — `ICON` and `linkFor` (recycling → `/dashboard/recycling` member page; org request → `/dashboard/organisation` or `/get-involved/organisations/request`; test print → `/dashboard/printing`; handover → the thread)
- `packages/mobile/lib/notifications.ts` — `linkFor` for the same
- `packages/api/src/routes/organizations.ts` (`PATCH /:orgId/recycling/:id` → contributor; `POST /:id/confirm` lives in `toy-transactions.ts` → the other party on first confirm), `packages/api/src/routes/admin.ts` (org-request approve: look up `requester_id` on the request row before the RPC; decline: `requester_id`; test-print verdict: owner, or every current leader of `owner_org_id`)
- `packages/api/tests/integration/notifications/handoffs-exchange.test.ts` — one `it` per type, title containing the type name
- `packages/web/tests/unit/lib/notification-bucket.test.ts`, `packages/mobile/tests/unit/lib/notifications-types.test.ts`, `packages/web/tests/unit/components/notifications-list.test.tsx`, `scripts/check-schema-guards.sh` — the lists
- `scripts/journeys/journeys.json` — `notifies` added to the existing write rows (leader recycling decision WB-row, admin org-request WM-rows, admin test-print WM-row, confirm rows WX09/WX19/WR16/X-rows) and one e2e per client tagged with one of them that asserts the inbox line (web `tests/e2e/organisation/recycling.spec.ts` + admin specs; mobile `recycling`/`admin` specs)

**Approach:** Types and migration first (compile error guides the tables), then the writers with the `notify(rows, label)` wrapper from `organizations.ts` moved to `packages/api/src/notify.ts` so `admin.ts` and `toy-transactions.ts` share it (its log line changes; grep the tests for the old `[organizations] … notify failed` text), inserting in chunks of 500 rows and logging the row count above that, then tests, then journeys. The wrapper never throws (a notification must not fail the write), so its one failure line is stable and greppable: `[notify] insert failed type=<type> code=<pg code> label=<label>`; U14 greps for it after the hosted deploy. Subject columns: recycling and org-request rows use `org_id` + `body` (Byron 2026-10-20), test print uses `org_id` or none with `body`, handover uses `toy_transaction_id`.

**Patterns:** `138_event_change_notifications.sql` + `event-change-notifications.test.ts` + rows WB20/L35 (the exact shape, including the deploy-order comment).

**Test scenarios:**
- [ ] Happy path: leader marks a drop-off received → contributor's inbox shows "{org} received your drop-off" (exchanges bucket), link opens their recycling page, on web and mobile
- [ ] Nil/empty input: admin approves an org request whose requester account was deleted → no notification, no error (the `notify` wrapper logs)
- [ ] Error path: the insert fails the CHECK (migration not applied) → logged, the write still succeeds; a unit test on `notify` with a stubbed admin client proves it never throws; the schema guard catches the missing migration locally
- [ ] Edge case: test print on an org-owned printer with three leaders → three rows; the second confirm on a handover sends nothing (only the first party's confirm tells the other)

**Verification:** `pnpm test:journeys` 45 types, 0 unasserted; api integration green; web + mobile unit green; `db:guards` green.

**Planning-time unknowns:** none. Resolved by research: the member's drop-offs live at `packages/mobile/app/(tabs)/explore/recycling.tsx` (rows V04–V06), so the mobile link for `recycling_received` and `recycling_declined` pushes `/explore/recycling`; the leader intake view under `(my)/organisation/recycling` is not the target.

### Unit 12: Leader and event-change notifications

**Goal:** `leader_added`, `leader_removed`, `org_event_deleted` exist end to end.

**Requirements trace:** R11, R13, R19

**Dependencies:** U11 (migration, shared `notify`)

**Files:**
- `packages/types/src/index.ts` — 3 members, buckets (`organisations`), copy
- `packages/web/components/notifications-list.tsx`, `packages/mobile/lib/notifications.ts` — icon and links (leader → the org dashboard / public page; event deleted → the org's public page)
- `packages/api/src/routes/admin.ts` — add/remove leader → the person; `packages/api/src/routes/organizations.ts` — `DELETE /:orgId/events/:id`: read the title and registrants first, delete, and only after the delete succeeds call `notifyRegistrants` (it already de-duplicates with a `Set` and excludes the actor) extended with a `deleted` variant that carries `org_id` and the title in `body`; the registrant select is capped and logged above 1000
- `packages/api/tests/integration/notifications/handoffs-leaders.test.ts` — 3 `it`s
- the three type-list tests + schema guard
- `scripts/journeys/journeys.json` — `notifies` on the admin leader rows (WM-series) and the leader event-delete rows (WB-row + L-row); web e2e `admin/organisations.spec.ts` and mobile `admin`/`org-leader` specs assert the inbox line

**Approach:** As U11. Read before delete, notify after a successful delete, so nobody hears about an event that still exists; the FK cascade on `org_event_id` is why the notification carries `org_id`.

**Patterns:** U11.

**Test scenarios:**
- [ ] Happy path: admin adds a leader → that person sees "You now lead {org}"; removal → "You no longer lead {org}"
- [ ] Nil/empty input: deleting an event with zero registrants sends nothing
- [ ] Error path: deleting an event whose title lookup fails → the delete still happens, notification skipped and logged
- [ ] Edge case: a registrant registered twice (two rows, same user) gets one notification

**Verification:** `pnpm test:journeys` 48 types, 0 unasserted; suites green.

**Planning-time unknowns:** none.

### Unit 13: Acknowledged-submission notifications and org bucket clear

**Goal:** `event_rsvp_received`, `idea_received`, `report_received`, `drop_off_booked`, `contact_received` exist end to end; the organisations bucket clears on the org hub; `org_message` moves bucket. Two commits in one PR: the five types first, the bucket move (R14: the hub mount, the map entry, the counts test, mobile's inbox assertion) second, so each is reviewable on its own.

**Requirements trace:** R12, R13, R14, R19

**Dependencies:** U11

**Files:**
- `packages/types/src/index.ts` — 5 members, buckets, copy; `org_message` → `organisations`; remove the `PENDING(silent-handoffs)` line
- `packages/web/components/notifications-list.tsx`, `packages/mobile/lib/notifications.ts` — icons and links (RSVP → the event; idea → the idea; report → the inbox itself (no link); drop-off → recycling page; contact → inbox)
- `packages/api/src/routes/events.ts` (RSVP), `toy-ideas.ts` (idea), `reports.ts` (report), `organizations.ts` (drop-off booking), `public.ts` (contact: only when a bearer token resolves to a user)
- `packages/web/app/dashboard/organisation/page.tsx` — mount `<MarkNotificationsRead bucket="organisations" />`; remove the `PENDING(org-notifications-never-clear)` line
- `packages/api/tests/integration/notifications/handoffs-acknowledged.test.ts` — 5 `it`s; `packages/api/tests/integration/counts/unread-counts.test.ts` — the `counts:unread-counts.organisations` case now opens the org hub (web) and asserts the clear, and `org_message` counts in that bucket
- the three type-list tests + schema guard; `packages/web/tests/unit/pages/organisation-hub.test.tsx` — mounts the clear
- `scripts/journeys/journeys.json` — `notifies` on WI-rows (RSVP), the idea submit row, the report row, the drop-off row, WS-row (contact); web/mobile e2e tagged; `packages/types/src/pending.ts` — `silent-handoffs` and `org-notifications-never-clear` shipped

**Approach:** As U11. The bucket move is one map entry plus the counts test. Mobile's inbox clears per bucket already.

**Patterns:** U11; the `MarkNotificationsRead` mounts on the three dashboard pages.

**Test scenarios:**
- [ ] Happy path: member RSVPs → "You're registered for {event}" appears in their inbox; opening the org hub as a leader clears the organisations count on web and the same count on mobile reads 0
- [ ] Nil/empty input: anonymous contact form → no notification, 201 as today
- [ ] Error path: report submit with the notification insert failing → the report is still stored (wrapper)
- [ ] Edge case: a leader's `org_message` now clears when they open the organisation messages page, and the exchanges count no longer includes it

**Verification:** `pnpm test:journeys` 53 types, 0 unasserted, 23 counts asserted; all suites green.

**Planning-time unknowns:** none. Resolved by research: the web contact form posts through `browserApiClient`, which attaches `Authorization: Bearer` whenever a session exists; `public.ts` already has a local `signedIn(c)` (lines 185–190) that verifies the bearer with `admin.auth.getUser` but returns only a boolean, so this unit widens it to return the user id, sets `sender_id` on the insert (the handler's comment at line 1667 promises this and the code never did it) and notifies that id. Mobile has no caller of `/api/public/contact`, so no mobile change.

### Unit 14: Notification deploy and hosted checklist

**Goal:** The migration reaches hosted before the API writes new types, and the hosted template/count questions are answered.

**Requirements trace:** R13 (deploy order), requirements Q1–Q2

**Dependencies:** U11–U13 merged

**Files:**
- `docs/plans/decisions-build-plan.md` — this section's checklist ticked
- memory `hosted-migrations-pending` — updated by the session that pushes

**Approach:** Two hosted pushes, each by Byron with the recipe in the `hosted-migrations-pending` memory: 140 before PR 2's API deploy (the admin message kind and the policy fix), 141 before PR 4's (the notification types). `pnpm db:check` against hosted green after each; after each API deploy, grep the API logs for `[notify] insert failed` and `[terms] lookup failed` (zero expected). PR 6 (U9) ships only after the mobile release carrying U10 is live. No code.

**Patterns:** the hosted push recipe.

**Test scenarios:**
- [ ] Happy path: hosted `db:check` reports level 141
- [ ] Nil/empty input: no notifications of the new types exist before the push (the CHECK would have refused them)
- [ ] Error path: push fails on a guard → stop, nothing deployed
- [ ] Edge case: an API deploy before the push → inserts logged as CHECK failures, writes still succeed (the wrapper) — visible in API logs

**Verification:** hosted level 142; a smoke notification of one new type visible in a hosted inbox.

**Planning-time unknowns:** Resolve Before Planning — Byron's say-so for the hosted push (memory rule).

## Piece 1: web auth recovery (R1–R4, R19)

### Unit 15: One auth error classifier in packages/types

**Goal:** `AuthProblem`, `toProblem` and the copy live in `packages/types`; mobile imports them; nothing changes on screen.

**Requirements trace:** R2

**Dependencies:** none

**Files:**
- `packages/types/src/auth-errors.ts` — moved from `packages/mobile/lib/auth-errors.ts`, exported from `packages/types/src/index.ts`
- `packages/mobile/lib/auth-errors.ts` — deleted in this unit; mobile is not published per file, so the importers migrate in the same commit (no shim)
- `packages/mobile/lib/auth-context.tsx`, `components/auth/parts.tsx`, every `(auth)/*.tsx` importer — import from `@splat-connect/types`
- `packages/types/tests/auth-errors.test.ts` — moved mobile tests (if any) plus one case per kind
- `packages/mobile/tests/unit/**` — paths updated

**Approach:** Move, migrate every importer, delete, in one commit. The classifier has no React or Expo import, which is why it can move.

**Patterns:** `nav-model.ts` and `pending.ts` as types-package modules both clients import.

**Test scenarios:**
- [ ] Happy path: `toProblem({ code: 'email_not_confirmed' })` → `unconfirmed` with the existing copy
- [ ] Nil/empty input: `toProblem(undefined)` → `other`
- [ ] Error path: a message-only error ("Invalid login credentials") → `credentials`
- [ ] Edge case: `toProblem` on a network `TypeError` → `offline`

**Verification:** types + mobile typecheck; whole mobile jest green; `grep -r "lib/auth-errors" packages/mobile` empty.

**Planning-time unknowns:** none.

### Unit 16: Friendly auth errors and resend on the web sign-in page; template copy

**Goal:** Web never shows a raw auth error; an unconfirmed member can resend the code; templates read right on both clients.

**Requirements trace:** R1 (unconfirmed + resend), R2, R3, R19

**Dependencies:** U15

**Files:**
- `packages/web/app/login/page.tsx` — classify with `toProblem`; on `unconfirmed` call `auth.resend({type:'signup'})` and link to `/login/verify?email=&type=signup`; on `credentials` clear the password; remove the `PENDING(web-auth-recovery)` line in U18
- `packages/web/components/auth-shell.tsx` — an `AuthError` part mirroring mobile's (`components/auth/parts.tsx`)
- `supabase/templates/confirmation.html`, `magic_link.html`, `recovery.html` — "in the SPLAT Connect app or on the website"
- `packages/web/tests/unit/app/login-page.test.tsx` — WA08 flips: friendly copy, a resend happened, a "Enter the code" link; WA03 asserts the credentials copy
- `packages/web/tests/e2e/auth/login.spec.ts` — WA08 flips the same way
- `scripts/journeys/journeys.json` — WA08 element updated
- `docs/plans/decisions-build-requirements.md` Q2 — note that hosted templates need the same copy

**Approach:** The web page keeps its browser-side Supabase call; only the error path and the resend change. Template copy is a wording change in three files.

**Patterns:** mobile `sign-in.tsx` unconfirmed branch.

**Test scenarios:**
- [ ] Happy path: unconfirmed member signs in → "That email is not confirmed yet. We sent you a new code." and a link to enter it
- [ ] Nil/empty input: wrong password → "That email and password don't match." (the classifier's credentials copy), password cleared, email kept
- [ ] Edge case: too many attempts → the classifier's rate-limited copy (Supabase caps verify and sign-in attempts); the page never shows a raw lockout error
- [ ] Error path: resend rate-limited → the rate-limited copy, no crash
- [ ] Edge case: Mailpit shows the new confirmation email with the "app or on the website" line (e2e reads it)

**Verification:** web unit + e2e auth green; mobile e2e `auth.spec.ts` still green against the edited templates (A05 reads the code, not the sentence).

**Planning-time unknowns:** none.

### Unit 17: Forgot password and reset on web

**Goal:** `/login/forgot` sends the code; `/login/reset` takes code + new password; the member is signed in.

**Requirements trace:** R1, R19

**Dependencies:** U16

**Files:**
- `packages/web/app/login/forgot/page.tsx` — email → `resetPasswordForEmail`; always continues to `/login/reset?email=` except offline/rate-limited (mobile's no-enumeration rule)
- `packages/web/app/login/reset/page.tsx` — 6-digit `CodeInput` + password (min 6 checked before the code is spent) → `verifyOtp({type:'recovery'})` then `updateUser({password})` → `?next=` or the role landing (reuse the login page's landing logic, lifted into `lib/auth-landing.ts`)
- `packages/web/components/auth-shell.tsx` — `CodeInput` part (mirrors mobile's): `inputmode="numeric"`, `autocomplete="one-time-code"`, a visible label, the error in an `aria-live="polite"` region; disabled while a verify is pending so auto-submit cannot fire twice
- `packages/web/app/login/page.tsx` — "Forgot password?" link carrying the typed email
- `packages/web/tests/unit/app/login-forgot.test.tsx`, `login-reset.test.tsx` — WA31–WA34
- `packages/web/tests/e2e/auth/recovery.spec.ts` — WA31–WA34 with the Mailpit `latestCode` helper lifted from `account-deletion.spec.ts` into `tests/e2e/helpers.ts` (or `supabase/e2e-seed.ts` so mobile shares it)
- `scripts/journeys/journeys.json` — WA31 (forgot sends), WA32 (no-enumeration), WA33 (reset with code), WA34 (short password refused before the code is spent); middleware: `/login/*` stays public

**Approach:** Mirror `forgot-password.tsx` and `reset-password.tsx` screen for screen; the landing logic is shared with the login page.

**Patterns:** mobile A09/A10 and their unit tests.

**Test scenarios:**
- [ ] Happy path: forgot → code from Mailpit → new password → signed in at `/dashboard`
- [ ] Nil/empty input: unknown email → still "We sent a code" (no enumeration)
- [ ] Error path: wrong code → bad-code copy, the password field keeps its value
- [ ] Edge case: a 5-character password is refused before `verifyOtp` is called (spy asserts no call)
- [ ] Error path: `verifyOtp` succeeds and `updateUser` fails → the code is spent but the session exists; the page keeps the session, shows "Your code worked but the password did not save. Try the password again." and retries `updateUser` only (no new code asked)

**Verification:** web unit + e2e recovery green; `pnpm test:journeys` 0 gaps with the four new rows.

**Planning-time unknowns:** Deferred — the `resetting` guard mobile uses to stop `_layout` redirecting mid-reset has no web equivalent needed (web has no layout redirect); confirm during implementation.

### Unit 18: Code sign-in and verify on web

**Goal:** `/login/code` sends a sign-in code; `/login/verify` takes a code for `signup` or `email` with resend and "wrong email?".

**Requirements trace:** R1, R19

**Dependencies:** U16

**Files:**
- `packages/web/app/login/code/page.tsx` — email → `signInWithOtp({shouldCreateUser:false})` → `/login/verify?email=&type=email`; "Use a password instead"
- `packages/web/app/login/verify/page.tsx` — `CodeInput` auto-submits at 6 digits via `verifyOtp({type})`; resend gated 60 s (`resend({type:'signup'})` or `signInWithOtp`); "Wrong email? Change it"; on success the shared landing
- `packages/web/app/login/page.tsx` — "Email me a sign-in code" link; remove the `PENDING(web-auth-recovery)` line
- `packages/web/tests/unit/app/login-code.test.tsx`, `login-verify.test.tsx` — WA35–WA38
- `packages/web/tests/e2e/auth/code-sign-in.spec.ts` — WA35–WA38 via Mailpit
- `scripts/journeys/journeys.json` — WA35 (code sent), WA36 (no account → the no-account copy), WA37 (verify signs in), WA38 (resend after 60 s / wrong email); `packages/types/src/pending.ts` — `web-auth-recovery` shipped

**Approach:** Mirror `code-sign-in.tsx` and `verify.tsx`.

**Patterns:** mobile A06–A08.

**Test scenarios:**
- [ ] Happy path: code sent → typed → signed in, `?next=` honoured
- [ ] Nil/empty input: email with no account → no-account copy (`shouldCreateUser:false` error)
- [ ] Error path: expired/wrong code → bad-code copy; a second wrong code does not lock the field
- [ ] Edge case: resend before 60 s is disabled with the countdown; after, it sends and restarts the countdown
- [ ] Edge case: the sixth digit on a slow link fires one `verifyOtp`; the input is disabled until it resolves (spy asserts a single call)

**Verification:** web unit + e2e green; journeys 0 gaps.

**Planning-time unknowns:** none.

### Unit 19: Normal layout after email confirmation

**Goal:** `/auth/confirmed` and the sign-in page it lands on use the normal auth layout and keep `?next=`.

**Requirements trace:** R4, R19

**Dependencies:** none

**Files:**
- `packages/web/app/auth/confirmed/page.tsx` — render inside the same shell the login page uses (`AuthStage`); confirm `next` is forwarded
- `packages/web/app/login/page.tsx` — remove the `PENDING(confirmed-page-bare-layout)` line
- `packages/web/tests/unit/app/auth-confirmed.test.tsx` — WA16 asserts the shell and the `next`
- `packages/web/tests/e2e/auth/session.spec.ts` — WA16 asserts the header is present after the redirect
- `packages/types/src/pending.ts` — `confirmed-page-bare-layout` shipped

**Approach:** One wrapper change.

**Patterns:** `AuthStage` use on the login page.

**Test scenarios:**
- [ ] Happy path: confirmation link → confirmed page in the shell → `/login?next=…` in the shell
- [ ] Nil/empty input: no `next` → `/login`
- [ ] Error path: an invalid `next` is dropped by the sanitiser on the login page
- [ ] Edge case: a mobile signup's confirmation (same URL) renders the same page

**Verification:** web unit + e2e auth green.

**Planning-time unknowns:** none.

### Unit 20: Web auth journeys and the shared mail helper

**Goal:** Every new web auth row has its three layers, and one Mailpit helper serves web, mobile and api tests.

**Requirements trace:** R19

**Dependencies:** U17, U18

**Files:**
- `supabase/e2e-seed.ts` — `latestCode(email, after)` (moved from the mobile helper and the web account-deletion spec)
- `packages/web/tests/e2e/helpers.ts`, `packages/mobile/tests/e2e/helpers.ts` — re-export; delete the local copies
- `packages/web/tests/e2e/account-deletion.spec.ts` — use the shared helper
- `docs/testing/journeys.md` — regenerated
- `docs/testing/journey-coverage-rule.md` — one line: web auth rows WA30–WA38 and how their e2e reads codes

**Approach:** Deduplicate after the specs exist, so the move is proven by three green suites.

**Patterns:** U7b of the previous plan (shared seed helpers).

**Test scenarios:**
- [ ] Happy path: all three e2e suites that read codes pass with the shared helper
- [ ] Nil/empty input: `latestCode` with no matching mail within the window → throws a named error, not undefined
- [ ] Error path: Mailpit down → the error names the port
- [ ] Edge case: two codes for the same address → the one after `after` wins

**Verification:** `pnpm test:journeys` 0 gaps, 694 − 2 (U1) + new rows; web e2e auth green; mobile e2e auth green.

**Planning-time unknowns:** none.

## Quality bar

- Every unit traces to R-ids. Dependencies: U1→U2; U4→U5,U6; U7→U8,U8b,U10; U10→U9 (clients ship first); U6,U11→U14; U11→U12,U13; U15→U16→U17,U18→U20. No cycles.
- Every unit has four test scenarios.
- Files per unit: U11 and U13 list 9–10 paths because a notification type touches a fixed set of tables; the scope-reduction challenge was run and the answer is that fewer files means a type that does not compile, so the split is per group (and U13 by commit). U8 was over the bar for a mechanical reason and is split into U8 and U8b.
- New abstractions: `actions.ts` (U4), `authUrl` (U7), `requireContributorTerms` + `TERMS_GATED` (U9), `isTermsRequired` (U10, a function beside `isApiError`, not a class), `src/notify.ts` (U11, a move), `auth-landing.ts` (U17, three consumers); never more than two in one unit.
- Planning-time unknowns are each marked Resolve Before Planning (U14: hosted push say-so) or Deferred.
- Handoff test: an engineer invents nothing behavioural; the copy strings come from the mobile screens, the link targets are named, the error bodies are named.
