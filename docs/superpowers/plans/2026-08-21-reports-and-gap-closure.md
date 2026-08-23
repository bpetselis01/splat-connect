# Reports and Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Replace unenforceable removal with a report-and-exclude flow, bound thread history to when someone joined, and close every gap deferred during the design-challenges run.

**Architecture:** Three migrations (041 reports, 042 participant removal + history bound, 043 graduated notification), types, four API surfaces, three web surfaces, then a cross-cutting batch.

**Tech Stack:** Supabase/Postgres RLS, Hono API, Next.js 16 + React 19, Vitest, Playwright, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-08-21-reports-and-gap-closure-design.md` — read it first; it carries the owner's four decisions and every ruling made under delegation.

## Global Constraints

- **Never run `supabase db push` or anything `--linked`.** Local only: `supabase migration up --local`. The production push is the owner's.
- **Verify every schema claim in this plan against the real migration files before transcribing it.** In the previous run, most defects came from plan code asserting a schema the author had not read. If this plan contradicts `supabase/migrations/`, the migrations win — report the discrepancy.
- Next free migration numbers: **041, 042, 043**.
- Status codes: generic Supabase `if (error)` → **500**; `42501` → **403**; validation → **400**; not found → **404**; conflict → **409**.
- **Check every destructured `error`.** The previous run produced four swallowed-error defects.
- **Never `select('*')`** on anything reachable by a non-admin. Explicit column lists, fail-closed.
- `kind='system'` messages are written with the **admin client** (platform-authored). User messages use the **user client** so RLS decides.
- API unit tests carry the three-line `Tests:` / `How:` / `Chain:` annotation.
- British spellings in user-facing copy.
- **The report text never reaches the person reported** — not in a notification, not in a system message, not in any API response they can read.

---

## Task 1: `toy_idea_reports`

**Files:** Create `supabase/migrations/041_toy_idea_reports.sql`

Create the table per the spec's Schema section. Read `037_toy_ideas.sql` and `038_toy_idea_collaboration.sql` first and match their comment style — a `-- WHY:` header and a reason on every non-obvious policy.

RLS, and this is the security core of the task:
- **No select policy for `anon` or `authenticated` at all.** Reports are service-role readable only. That is what keeps the text away from the person reported.
- Insert by the reporter for themselves (`reported_by = auth.uid()`), only where they are the idea's author or a current participant.
- Admin full access via `public.is_admin()`.
- **No grant statements** — `004_data_api_grants.sql` sets default privileges; no table-creating migration since repeats them. But note 040 narrowed `toy_ideas` for anon; check whether the same narrowing is needed here or whether the absence of a select policy is sufficient, and say which in your report.

**Verify locally** with psql inside a rolled-back transaction: as `authenticated` with a `request.jwt.claims` sub of a user who is *the reported person*, `select count(*) from toy_idea_reports` must be 0. Paste real output.

Commit: `feat(db): add toy_idea_reports, readable only by the service role`

---

## Task 2: participant removal and history bound

**Files:** Create `supabase/migrations/042_participant_removal.sql`

Two changes, both to `public.toy_idea_participants` and `public.toy_idea_messages`.

**Removal that sticks.** Add `removed_at timestamptz` and `removed_by uuid references public.profiles on delete set null`. Rewrite the join insert policy so a person carrying any row — removed or not — cannot insert another. Rewrite the thread read and post policies to require `removed_at is null`.

**History bound.** A participant may read only `toy_idea_messages` whose `created_at >= their joined_at`. The idea's **author is exempt** and sees the whole thread. Read 038's existing policies before rewriting them; preserve everything else they enforce.

Every existing read path now needs `removed_at is null` — grep for `toy_idea_participants` across `packages/api/src` and report any query this change makes wrong.

**Verify locally**, all inside rolled-back transactions, pasting real output:
1. A participant with `removed_at` set reads 0 messages and cannot re-insert a participant row.
2. A participant reads messages created after their `joined_at` but **not** ones created before it.
3. The author reads all messages regardless of timestamps.

Commit: `feat(db): make removal stick and bound thread history to when you joined`

---

## Task 3: `idea_graduated` notification type

**Files:** Create `supabase/migrations/043_idea_graduated_notification.sql`

Graduation currently notifies nobody, so an author is silently made primary contributor on a draft they never created.

Drop and recreate `notifications_type_check` adding `idea_graduated`. **Read `039_notifications_idea_subject.sql` and confirm the current full value list before writing the new one** — the previous run's near-miss was recreating this constraint from an incomplete list, which would have deleted five live `toy_*` types. Enumerate every existing value.

**Verify** the recreated constraint accepts every pre-existing type plus the new one, and run `pnpm --filter @splat-connect/api test:integration -- notifications` to prove existing writers still work.

Commit: `feat(db): let graduation notify the people it credits`

---

## Task 4: types

**Files:** Modify `packages/types/src/index.ts`, `packages/web/components/notifications-list.tsx`

Add `ToyIdeaReport`. Extend `ToyIdeaParticipant` with `removed_at`/`removed_by`. Add `idea_graduated` to `NotificationType`.

`notifications-list.tsx:12` declares `COPY` as an exhaustive `Record<NotificationType, …>` — adding a union value breaks its typecheck until it gains an entry. Add copy for `idea_graduated` that is honest: graduation produces a **draft** guide that has not passed review. Do not imply a published guide exists.

Verify with `pnpm -r typecheck` and the full web unit suite.

Commit: `feat(types): add report types and the graduated notification`

---

## Task 5: filing a report

**Files:** Modify `packages/api/src/routes/toy-ideas.ts` and its unit test

TDD. `POST /:id/reports` taking `{ reported_profile_id, reason }`.

- `reason` is **mandatory** and must survive trimming — blank is 400. This is the owner's explicit decision.
- The reporter must be the idea's author or a current participant, else 403.
- **If the target is a participant:** mark them `removed_at`/`removed_by`.
- **If the target is the author:** file the report and mark the **reporter** removed instead. An author cannot be evicted from their own idea, and someone uncomfortable enough to report should not be left in the thread.
- Write a `kind='system'` message (admin client) and notify the removed person with the existing `challenge_removed` type. **Neither may contain the report text.**
- Follow the existing `systemMessage` helper and `actorName` in this file.

Tests must pin: blank reason rejected; a non-participant cannot report; reporting the author removes the reporter and not the author; the report text appears in neither the system message nor the notification.

Commit: `feat(api): file a report and exclude the person reported`

---

## Task 6: admin report queue and reinstatement

**Files:** Modify `packages/api/src/routes/admin.ts`, integration tests

TDD. Three endpoints, all under the existing `admin.use('*')` guard — do not add a second check.

- `GET /reports` — unresolved first, then resolved. Include the reported person's and reporter's names and the idea title. Explicit column lists.
- `PATCH /reports/:id` — resolve with `resolution_note`. Use a **conditional update** scoped to unresolved rows so a double-click cannot resolve twice, matching the compare-and-swap in `POST /ideas/:id/graduate`.
- `DELETE /ideas/:id/participants/:profileId/removal` — reinstate by clearing `removed_at`/`removed_by`. 404 if that person carries no removal.

Commit: `feat(api): admin report queue with resolution and reinstatement`

---

## Task 7: graduation notifications and two review-path fixes

**Files:** Modify `packages/api/src/routes/admin.ts`, tests

Three changes to the admin idea routes.

1. **Notify on graduate.** After the existing writes, notify the author and every participant with `idea_graduated`. Follow the error-checking convention — do not add a swallowed-error path.
2. **Force `review_note` to null when publishing.** `PATCH /ideas/:id/status` currently accepts a note alongside `status: 'challenge'`. Migration 040's reasoning for leaving `authenticated` unrestricted leans on that never happening; make it structurally true.
3. **Make the review PATCH a compare-and-swap.** It is read-then-act, so two concurrent calls both pass. Scope the update conditionally the way graduate does, and 404/409 when it claims no row.

Commit one change per concern.

---

## Task 8: the report dialog

**Files:** Modify `packages/web/components/challenge-thread.tsx` and its test

Replace the Remove and Leave controls added in the previous run with a **Report** action.

- Available to the author against any participant, and to a participant against the author or another participant.
- Opens a dialog requiring free text. Mandatory — no submit without it.
- Copy must set expectations honestly: the person is removed from this challenge, cannot return unless SPLAT reinstates them, and **will not see what was written**. Say that plainly; it is what makes the form safe to use.
- Keep a plain "Leave this challenge" for someone who simply wants out without reporting anyone. Leaving is not reporting and must not require text.
- Follow the accessibility standard in `packages/web/components/notify-form.tsx` — `role="alert"` for errors, and a focus move if content unmounts on success.

Commit: `feat(web): report a person instead of silently removing them`

---

## Task 9: admin reports surface

**Files:** Create `packages/web/app/admin/reports/page.tsx`, modify `packages/web/app/admin/page.tsx`, tests

A queue mirroring `app/admin/ideas/page.tsx`. Unresolved first. **Group by reported person** so someone reported on three challenges is visible as a pattern rather than three unrelated rows — this is the whole reason the text is stored.

Each row: who, which challenge, the reason, when, and actions to resolve with a note or reinstate.

Add a sixth dashboard card counting unresolved reports, matching the five existing cards' shape.

Commit: `feat(web): an admin queue for reports, grouped by person`

---

## Task 10: `?next=` with an open-redirect guard

**Files:** Modify `packages/web/app/login/page.tsx`, `packages/web/app/get-involved/submit-an-idea/page.tsx`, tests

`/login` ends in a hard `window.location.href` to `/admin` or `/dashboard` and ignores `?next=`. Its comment records why the hard redirect exists — `router.refresh()` was not awaitable and left the nav stale. **Preserve that behaviour**; only choose a different destination.

Accept `next` only when it is a same-origin relative path. Reject anything containing a scheme, starting with `//`, or containing a backslash. An unguarded `next` assigned to `window.location.href` is an open redirect — `/login?next=https://evil.example` would send a freshly authenticated user off-site.

Extract the validation as a pure exported function and unit test it directly with the hostile cases. Then restore the `?next=` CTA on `/get-involved/submit-an-idea`.

Commit: `feat(web): honour ?next= on login, guarded against open redirects`

---

## Task 11: one source for the notify allowlist

**Files:** Modify `packages/types/src/index.ts`, `packages/web/lib/public-nav.ts`, `packages/api/src/routes/public.ts`, tests

Web derives `SCAFFOLD_KEYS` from nav data; the API hardcodes `NOTIFY_FEATURE_KEYS`. Neither package can import the other, so every future launch must remember the API by hand and nothing fails when someone forgets.

Move the key list into `@splat-connect/types` and have both read it. Web's derivation must still be checked against it — add a test asserting the derived set matches the shared list, so a nav flip that forgets the shared list fails loudly.

Commit: `refactor: one source of truth for the notify allowlist`

---

## Task 12: the minors batch

**Files:** several; one commit per fix

All deferred during the previous run. Each is small; batch them.

1. `design-challenges/page.tsx` — `graduated` rows sit under an "Open challenges" heading. Reword or split.
2. `toy-ideas.ts` — two notification inserts discard their `error` while `admin.ts` checks and logs its own. Make all three consistent.
3. `public.ts` — the challenges listing selects `contact_prefs` and `created_at`; `ChallengeCard` renders neither. Drop them or render them.
4. `app/admin/ideas/page.tsx` throws on API failure while `[id]/page.tsx` catches and `notFound()`s. Make them consistent.
5. Add a length bound to the five narrative fields on `POST /ideas` — currently trim-only against `text` columns.
6. `dashboard/exchanges/[id]/page.tsx:30` matches `/status 404/` against an error message. `isApiError` exists now; use it.

---

## Final verification

```bash
pnpm -r typecheck
pnpm --filter @splat-connect/api test:unit
pnpm --filter @splat-connect/api test:integration
pnpm --filter @splat-connect/web test:unit
pnpm --filter @splat-connect/web test:e2e
```
Do **not** run `pnpm db:check` — it queries the linked production project.
