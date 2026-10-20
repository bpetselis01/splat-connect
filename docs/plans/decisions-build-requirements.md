# Decisions build (the five larger pieces) Requirements

**Version:** 1.0
**Status:** Draft
**Date:** 2026-10-20

## Problem Frame

On 2026-10-20 Byron answered the 32 decisions the journey-coverage audit and run had registered in `packages/types/src/pending.ts`. Twenty-seven are one-file fixes that follow this plan as their own commits. Five are larger, cut across packages, and each leaves a member at a dead end today: a web member who mistypes a password or never confirmed their email sees a raw Supabase error and has no way out; a member sent to sign in loses where they were going; fifteen hand-offs (a drop-off received, a leader removed, an event deleted, a report filed) tell nobody; a declined gift or build carries no reason to the person who asked; and four pieces of code nobody can reach still carry tests. The terms gate on web also fails open when its lookup errors, so an outage silently waives the one legal gate the product has.

The five pieces are the decisions `web-auth-recovery` (+ `confirmed-page-bare-layout`), `silent-handoffs` (+ `org-notifications-never-clear`), `login-return-path` (+ `org-directory-terms-gate`, `terms-gate-fails-open`), `duplicated-thread-actions` (+ `admin-in-member-threads`) and `dead-routes-and-handlers`. Each carries a `PENDING(id)` marker at its code site and a `Decided 2026-10-20:` line; this document turns those lines into testable requirements. Phase 1 research corrected one: of the seven "dead" routes, three are called by mobile and one field is rendered on both clients, so only four are deleted.

## Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| R1 | Web gets the four recovery flows mobile has, by 6-digit code: forgot password (email → code → new password), code sign-in (email → code), resend confirmation, and a friendly unconfirmed-email message that offers resend. Apple and Google stay pending. | Must Have | Byron 2026-10-20: same codes as mobile. Screens mirror mobile A06–A10 under `/login/*`. |
| R2 | Web and mobile classify Supabase auth errors with one shared classifier (`AuthProblem` kinds and copy) in `packages/types`; the raw message never reaches a screen on either client. | Must Have | Today `packages/mobile/lib/auth-errors.ts` is mobile-only; web prints `error.message`. |
| R3 | The three Supabase email templates work for both clients: code shown first, copy says "in the app or on the website", confirmation and magic-link keep their link; recovery stays code-only. | Must Have | `supabase/templates/*.html`; hosted templates are set by hand (PENDING hosted SMTP). |
| R4 | After an email confirmation the sign-in page renders in the normal auth layout and keeps `?next=`. | Must Have | `confirmed-page-bare-layout`. |
| R5 | Every server-side redirect to `/login` or `/signup` carries `?next=` with the full current path and query, and sign-in and sign-up honour it only for a same-origin path. One sanitiser (`lib/safe-next-path.ts`) is the only one; the terms page's local copy is deleted. | Must Have | Senders today without it: middleware (bare `/login`), `requireCapabilities`, LearnGate (hard-coded `/learn`); toy `?mode=` and drop-off `?org=` keep the path but drop the query. |
| R6 | `/organizations` and its public pages never require terms; only writes and member-only pages do. | Must Have | Remove the prefix from `termsGatedPrefixes`; WN03 and WA28 flip. |
| R7 | The web terms gate fails closed: a lookup error blocks like a missing acceptance and shows a retry message naming the error; it never logs-and-passes. | Must Have | `terms-gate-fails-open`. WA27 flips. |
| R8 | The API re-checks the current contributor-terms acceptance on the writes the gate protects and answers `403 { error: 'terms_required', version }` when missing or when the lookup errors: `PUT /tutorials/:id/steps`, the eight toy-transaction writes (`POST /`, `/build`, `/print`, `/print-at-event`, `/:id/messages`, `/:id/accept`, `/:id/claim`, `/:id/questions`) and every organisation write except Follow and Say thanks (the list lives in `packages/api/src/terms.ts`). Admins are not exempt. Reads are untouched. Guide create and submit already check. | Must Have | Byron 2026-10-20: 403 with a named error both clients handle; admins accept terms too; Follow and Say thanks stay open; all leader writes gated. |
| R9 | Both clients catch `terms_required` on any write, route to their terms screen with `next=` back to the action, and retry or re-render after acceptance. | Must Have | Mobile members without a current acceptance accept once. |
| R10 | New notification types for the exchange-outcome group: `recycling_received`, `recycling_declined`, `org_request_approved`, `org_request_declined`, `test_print_passed`, `test_print_failed`, `handover_confirmed` (first party confirms; the other is told). | Must Have | API-side inserts at the routes named in the plan; CHECK constraint migration; bucket `exchanges` except org-request (`organisations`). |
| R11 | New notification types for the leader/event group: `leader_added`, `leader_removed` (to the person), `org_event_deleted` (to every registrant). | Must Have | Event deletion must read title and registrants before the row goes; the notification carries `org_id` and the title in `body`, not `org_event_id`. |
| R12 | New notification types for the acknowledged-submission group: `event_rsvp_received`, `idea_received`, `report_received`, `drop_off_booked`, `contact_received` (signed-in sender only; anonymous contact has no inbox). | Must Have | Byron 2026-10-20 chose all three groups. |
| R13 | Every new type has: a bucket entry, copy, a web icon, a web and a mobile link, a migration entry, an api integration test whose title names the type, a journeys row with `notifies`, and a client e2e tagged with that row; `pnpm test:journeys` reports 0 unasserted. The union lands one group per commit so the `satisfies Record` tables never half-exist. | Must Have | `scripts/journeys/notifications.mjs` enforces the api test; the rest is the `satisfies` compile error. |
| R14 | Organisation-bucket notifications clear when a leader opens the organisation dashboard hub, and `org_message` moves to the `organisations` bucket so the leader's message thread clears it. Web and mobile unread counts agree. | Must Have | Mount `MarkNotificationsRead bucket="organisations"` on `dashboard/organisation/page.tsx`; `counts:unread-counts.organisations` test covers the clear. |
| R15 | The five thread actions (`sendMessage`, `accept`, `reject`, `withdraw`, `confirm`) live once, in `app/dashboard/exchanges/actions.ts` as exported server functions taking `(id, kind, args)`, and the three pages (`exchanges/[id]`, `exchanges/build/[id]`, `print-requests/[id]`) call them. Behaviour is unchanged. | Must Have | Hoisted plain functions, per the inline-server-action memory: no closures. |
| R16 | Every decline carries a reason the other party sees: the thread component shows the reason form for all three kinds, the API requires a reason (1–500 chars) for every type, and the rejected state renders `decline_reason` on web and mobile. | Must Have | Today only print requires it and only `job-screen.tsx` renders it. |
| R17 | An admin can open any thread and post a message rendered with a "SPLAT admin" label on both clients; the API stores it as message `kind: 'admin'` with `actor_name` "SPLAT admin", notifies both parties, and refuses admin `accept`, `reject`, `withdraw` and `confirm` with 403 `admin_cannot_act`. Members cannot insert any kind but `user` (the RLS insert policy pins it), so neither `admin` nor `system` can be forged. | Must Have | New CHECK value plus the policy fix in the same migration; admin links from `/admin/build-requests` and `/admin/print-jobs` already exist. An admin may post in a thread of any status. |
| R18 | Delete the four unreachable pieces with their tests, journey rows and database objects: web `/not-built/[id]` (+ `lib/pending-icons.ts`, `ComingSoon`'s web-only use, rows WC15 and WL08), `NotifyForm` + `POST /api/public/notify` + table `notify_signups` + `NOTIFY_FEATURE_KEYS`, and `DELETE /tutorials/:id/build`. Keep `GET /api/public/map`, `POST /ideas/:id/constraints`, `GET /exchange-costs/mine` and `exchangeActions`: mobile calls them. | Must Have | Corrected from the audit's seven. `routes-without-journeys.json` needs no entry. |
| R19 | Every new or changed journey has rows in `scripts/journeys/journeys.json` and ids in test titles at each required layer; `pnpm test:journeys` exits 0 with 0 gaps on every commit. | Must Have | The coverage rule from the previous plan. |

## Success Criteria

- A web member who mistypes a password, never confirmed, or forgot the password reaches Home without leaving the browser, using the same emails mobile sends; WA08's assertion flips from "raw error, no control" to "friendly message with resend".
- Signed out on any protected page, a member signs in and lands on that page with its query intact (WA23 flips; WE02 keeps the lesson path).
- With the terms lookup failing, a member is blocked with a retry message on web and gets `terms_required` from the API on a gated write; mobile and web both route to terms and complete the write after accepting.
- Each of the 15 silent hand-offs produces a notification the right person sees and can open on both clients; `pnpm test:journeys` reports 53 types, 0 unasserted; the organisations bucket clears on the org hub.
- The three thread pages share one actions module, every decline shows its reason to the other party on web and mobile, and an admin's post is labelled while admin lifecycle actions are refused.
- The four dead pieces are gone, with `UNTESTED` still empty and the route tripwire green.
- CI green on development after each group lands.

## Scope Boundaries

**In scope:**
- R1–R19 on web, mobile, api, types and migrations 140+.
- Shared auth error classifier and template copy.
- Journey rows and tests at every required layer for everything above.

**Out of scope:**
- The 27 one-file decisions (they follow as their own commits, outside this plan).
- Apple/Google sign-in on web (pending their setup).
- Email delivery of notifications (in-app only; hosted SMTP is pending).
- A waitlist for full events (Byron chose full-event copy only).
- Rewriting the `ComingSoon` scaffold pages beyond removing the dead web-only path.

## Key Decisions

| Decision | Chosen | Rationale | Alternatives Considered |
|----------|--------|-----------|------------------------|
| Web recovery mechanism | 6-digit codes, same as mobile | One mechanism to test and explain; templates already code-first; users learn it once | Magic links on web with a new `/auth/callback`; both templates and callback would be new |
| Terms on the API | `403 terms_required` on gated writes, both clients handle it | The only honest fail-closed; reaches mobile members who never accepted, who accept once | Re-check only guide submit and leader actions; log-only |
| Notification landing | One group per commit, union + tables + migration + tests together | `satisfies Record` makes a half-added type a compile error; migration must precede API | One commit per type (13 migrations); all at once (unreviewable) |
| Org event deletion notification | Carry `org_id` + title in body | The event row is gone; `org_event_id` FK would cascade or fail | Soft-delete events (bigger change, out of scope) |
| Admin label in threads | New message `kind: 'admin'` | Rendering keys on `kind` already on both clients; a column would need every reader to change | A `sender_role` column; prefixing the body text |
| Dead-route scope | Four items, not seven | Three are called by mobile and one is rendered on both clients | Delete all seven (breaks the Map tab, challenge constraints and the Me costs line) |
| Contact-form acknowledgement | Signed-in senders only | Anonymous senders have no inbox and there is no email delivery | Email receipt (no SMTP); skip the type |

## Outstanding Questions

| # | Question | Impact if Wrong | Owner |
|---|----------|-----------------|-------|
| Q1 | How many hosted members lack a current contributor-terms acceptance? They will be bounced once on their next gated write. | A large number means a visible wave of terms prompts on release day | Byron (hosted query; local cannot answer) |
| Q2 | Hosted email templates are set by hand; who updates them with the "app or website" copy, and when relative to the web release? | Web users read "type this code into the app" until updated | Byron |
| Q3 | `test_print_passed/failed` recipient when the printer is owned by an organisation: every leader, or the leader who submitted the test print? | Wrong leaders notified, or nobody | Byron; default in plan: every current leader |
