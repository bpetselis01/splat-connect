# Session Q&A Log: Decisions build (the five larger pieces)

**Date:** 2026-10-20
**Mode:** New Feature
**Scope:** Deep
**Phases completed:** 0, 1, 2, 3, 4, 5, 6, 7
**Outcome:** Full plan produced (`docs/plans/decisions-build-requirements.md`, `docs/plans/decisions-build-plan.md`); implementation begins at Unit 1.

---

## Questions & Answers by Phase

### Phase 0: Intake & Route

No questions. Mode New Feature (existing monorepo, five named changes to existing flows); scope Deep (live product, five cross-cutting pieces). Prior artifacts: the journey-coverage requirements and plan, whose answered questions Q1–Q16 are this plan's input.

### Phase 1: Ground

No user questions. Five read-only codebase agents (sonnet) mapped web auth recovery, the notification system, login redirects and the terms gate, the exchange thread actions, and the dead-route list. Finding that changed the plan: only four of the seven "dead" items are unreachable; the map route, the constraints route and the costs route are called by mobile, and `exchangeActions` renders on both clients.

### Phase 2: Challenge & Explore

**Q:** Mobile recovery is all 6-digit codes and the shared email templates say "type this code into the app". How should web do forgot-password, code sign-in and resend?
**User:** Same codes as mobile.
**AI position:** Recommended codes: one mechanism users already learn on mobile; a link-based web path doubles the template and support surface and needs a callback route that does not exist. Would change on measured desktop drop-off typing codes, which nobody has.
**Resolved:** Codes on web, templates reworded "in the app or on the website", classifier moves to `packages/types`.

**Q:** The API terms re-check on gated writes reaches mobile too; a member who never accepted the current version would start getting 403s. How should the API behave?
**User:** 403 with a named error both clients handle.
**AI position:** Recommended it as the only honest fail-closed; flagged that the count of hosted members without acceptance is the evidence that would change it, and that it cannot be queried locally.
**Resolved:** `403 { error: 'terms_required', version }`; both clients route to their terms screen with a return path.

**Q (checkpoint):** Ready to proceed to Phase 3?
**User:** Proceed.
**Resolved:** Requirements doc written.

### Phase 4: Structure (Step 4.0, batched)

**Q:** Where do the web recovery screens live?
**User:** Separate routes under /login.
**AI position:** Recommended separate routes: journey rows map to routes, links are shareable, mirrors mobile's one screen per step.
**Resolved:** `/login/forgot`, `/login/reset`, `/login/code`, `/login/verify`.

**Q:** Three new notification types have no subject column. How are they linked?
**User:** `org_id` plus body, no new columns.
**AI position:** Recommended it: the link targets are the org or the member's page, and the one-subject constraint stays untouched.
**Resolved:** As chosen.

**Q:** How should the five pieces land?
**User:** One PR per piece, in dependency order.
**AI position:** Recommended it; the migrations need hosted pushes between PRs.
**Resolved:** Six PRs (the API terms gate split out to ship last, after the engineering review).

### Phase 5: Validate

**Q:** Scope mode for the CEO review?
**User:** HOLD SCOPE.
**AI position:** Recommended it: every unit traces to a decision already made.
**Resolved:** CEO review found a one-way door (dropping `notify_signups`, possible PII) and a deploy-order failure (API gate before the mobile release); both fixed in the plan.

**Q:** Should admins be exempt from the API terms gate, as they are from the web gate?
**User:** Admins accept terms too.
**AI position:** Recommended exemption (admins act for SPLAT, matches the web gate). User chose otherwise; recorded as a durable call.
**Resolved:** No exemption; an admin without acceptance gets `terms_required` like anyone.

**Q:** R6 makes /organizations public to read while the API list gated Follow and Say thanks. Gate those two?
**User:** Do not gate Follow and Say thanks.
**AI position:** Recommended not gating them: low-weight social actions; the gate covers writes that create obligations.
**Resolved:** Both stay open.

**Q:** The research found leader writes the list missed (event PATCH/DELETE, recycling decision, drop-off booking). Include them?
**User:** Include all leader writes.
**AI position:** Recommended inclusion; one list in `src/terms.ts` documents it.
**Resolved:** Every organisation write except Follow and Say thanks is gated.

### Phase 7: Hand Off

**Q:** What next?
**User:** Begin implementation at Unit 1.
**AI position:** Recommended it: the dead-routes PR is the smallest, has no migration, and proves the cadence before the PRs that touch hosted.
**Resolved:** Implementation starts.

---

## Key Decisions

| Decision | Chosen | Phase | Rationale |
|----------|--------|-------|-----------|
| Web recovery mechanism | 6-digit codes, shared templates and classifier | 2 | One mechanism; templates already code-first |
| Terms on the API | `403 terms_required`, both clients handle it | 2 | The only honest fail-closed |
| Admins and the API terms gate | Not exempt | 5 | Byron's call against the recommendation |
| Follow / Say thanks | Not gated | 5 | Social actions carry no obligation |
| Leader writes | All gated | 5 | One documented list |
| Recovery screens | Separate routes under /login | 4 | Journey rows per route; shareable |
| Subject-less notifications | `org_id` + body | 4 | No constraint change |
| Delivery | One PR per piece; API gate last | 4, 5 | Hosted migrations between PRs; no raw 403 on old app builds |
| Dead routes | Four, not seven | 1, 2 | Three are called by mobile |
| `notify_signups` | Kept until hosted is checked | 5 | Possible PII; one-way door |
| Admin label | Message `kind: 'admin'`; members pinned to `user` by policy | 4, 5 | Rendering keys on `kind`; forgery closed |

---

## Positions Where AI Pushed Back

| Topic | AI Position | User Response | Final Resolution |
|-------|------------|---------------|------------------|
| Dead-route list | The audit's seven were wrong; three are mobile-called | Accepted (correction, not a question) | Four deleted |
| Admin exemption from API terms | Exempt admins, matching the web gate | Admins accept terms too | No exemption, recorded as durable |
| Dropping `notify_signups` | A one-way door on possible PII; do not drop in the deletion PR | Accepted via HOLD SCOPE review | Separate migration after a hosted check |
| Terms detection per client | Engineering review: one point in `api-core`, not a new error class | Accepted | `isTermsRequired` beside `isApiError` |
