# Organization Accounts + Delegated Tutorial Review

**Date:** 2026-07-28
**Status:** Approved design, ready for implementation planning

## Goal

An approved org leader can review and publish tutorials submitted by their own
org's members, so the platform admin is no longer the sole approver of every
tutorial. A leader account's blast radius stays narrow: it can act only on its
own org's members and content, never platform-wide.

A secondary goal, raised during design: reduce friction in the contribution
flow. The dominant source of delay today is queue latency (waiting for the sole
admin), not form length — so delegated review is itself the largest friction
reduction available. Three small cuts to the upload flow ride along (§7).

## Context: what already exists

Findings from tracing the current codebase, because several shape the design:

- **There is no `tutorials.author_id`.** Authorship lives in the
  `tutorial_contributors` join table (`role` = `'primary' | 'collaborator'`).
  Any "no self-review" rule must be expressed against that table.
- **`POST /api/contributors/me/tutorials/:tutorialId` passes no role**, so every
  link created through the API today takes the `'primary'` default. The
  `'collaborator'` path is latent.
- **The existing admin review endpoint bypasses RLS.**
  `admin.patch('/tutorials/:id/status')` uses `createAdminClient()`
  (service_role), so the only guard is the `role !== 'admin'` check in Hono
  middleware (`admin.ts:56`). The policy `"Admin can update all tutorials"`
  never runs on that path.
- **`tutorials.patch('/:id')` writes the entire unfiltered request body**
  (`tutorials.ts:139`). Today RLS `WITH CHECK` prevents contributors leaving a
  row in `'approved'`, but the endpoint is otherwise a pass-through.
- **Contributor approval was removed** in migrations 005/006.
  `is_approved_contributor()` now returns true for any `role = 'contributor'`
  profile, and `profiles.approved` is dropped.
- **Tutorial creation is two calls**: `POST /api/tutorials` inserts the row
  (admin client, no contributor link), then
  `POST /api/contributors/me/tutorials/:tutorialId` inserts the link. Both
  swallow `23505` for retry-safety.
- **Submission is a status transition, not creation.** Tutorials are created as
  `draft` and become reviewable via `PATCH /:id { status: 'pending' }` from the
  wizard (`upload/page.tsx:182`).
- **`getUserRole()` returns `null` for any role other than `admin`/
  `contributor`** (`lib/auth.ts`), a deliberate fail-closed guard.
- **RLS recursion precedent**: `tutorial_is_approved()` (`001_schema.sql:105`)
  is a `SECURITY DEFINER` function that exists specifically to break a policy
  that would otherwise query the table it guards. This design needs the same
  pattern.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Agreements/consent (`user_agreements`) stays **in scope** | User's call after being shown the option to defer. See §6 for the legal caveat. |
| 2 | `tutorials.org_id` is **nullable, snapshot at submit** | Org participation stays entirely optional; null routes to the platform queue. Snapshot rather than live-derived so review authority isn't retroactive or revocable by a membership change. |
| 3 | Org chosen **explicitly at submit time** | Preselected when the contributor has exactly one approved org; "No org — platform review" always available. Handles 0-, 1-, and multi-org cases with one control and no hidden tiebreaker. |
| 4 | Self-review blocked by **any** `tutorial_contributors` link | Not just `'primary'`. Same SQL cost, can't be gamed by self-adding as a collaborator. |
| 5 | **Trust on approval** — approving an org sets `status='approved'` *and* `trust_level='trusted'` | Vetting already happens at approval time; a separate probation gate would duplicate that judgment while guaranteeing the feature delivers nothing to new orgs. `probation` becomes a state you *demote* into. Column default stays `'probation'` so a *pending* org never reads as trusted. |
| 6 | **Reuse `rejection_note`; no `review_notes` column** | The column exists, is already surfaced to contributors, and "required on rejection" is its exact semantics. Loses notes-on-approve only. |
| 7 | Re-invites **revive the existing row** (`declined`/`removed` → `pending`) | `unique (org_id, user_id)` makes re-insert impossible; without revival one accidental decline locks a contributor out of an org permanently. |
| 8 | Leaders must be `role = 'contributor'` | A `parent`-role leader would be treated as logged-out by every org page via `getUserRole()`, with no error to debug. Enforced server-side. |
| 9 | **Enforcement lives in RLS**, not route code (Approach 1) | A leader is a semi-trusted account held by someone outside the organisation. RLS holds even if a future route is written carelessly; API-side checks are only as good as every route that remembers them. Also the only approach under which the suspension-revocation test asserts anything real. |
| 10 | Friction cuts included in this spec | ~10 lines, same goal, avoids touching `validation.ts` twice. |

## §1 Schema

One new migration: `supabase/migrations/007_organizations.sql`.

### `organizations`

`id`, `name`, `description`, `status` enum (`pending`/`approved`/`suspended`,
default `pending`), `trust_level` enum (`probation`/`trusted`, default
`probation`), `created_by` → `profiles`, `created_at`, `updated_at`.

### `org_members`

`id`, `org_id` → `organizations`, `user_id` → `profiles`, `org_role` enum
(`leader`/`member`), `status` enum (`pending`/`approved`/`removed`/`declined`),
`initiated_by` enum (`contributor`/`org`), `invited_by` → `profiles` nullable
(set when `initiated_by = 'org'`), `joined_at`, `unique (org_id, user_id)`.

`initiated_by` records who created a pending row, so the *other* party is the
one required to act on it. Two ways a pending row appears:

- **Contributor requests to join** — inserts their own row,
  `initiated_by = 'contributor'`. The leader must approve or decline.
- **Org invites a contributor** — leader inserts a row for the target user,
  `initiated_by = 'org'`. The contributor must accept or decline. A leader can
  never move this straight to `approved`, since that would let an org claim
  someone who never agreed.

`org_role` and `status` are independent, so `('leader', 'pending')` — an invited
leader who hasn't accepted — is representable and correct. Every policy must
therefore check `status = 'approved'`, never `org_role = 'leader'` alone.
`is_org_leader()` bakes in both conditions so no policy can get it half-right.

### `tutorials` — added columns

- `org_id` → `organizations` nullable (snapshot at submit; null = platform queue)
- `review_level` enum (`org`/`platform`) nullable
- `reviewed_by` → `profiles` nullable

Reuses the existing `rejection_note` and `reviewed_at`.

### `user_agreements`

`id`, `user_id` → `profiles`, `agreement_type` text (`'contributor_terms'`,
`'org_leader_terms'`), `version` text, `accepted_at` timestamptz.

Logs acceptance only — contains no legal text. Terms live as versioned static
content referenced by version string. See §6.

### Helper functions

`SECURITY DEFINER`, matching the existing `is_admin()` /
`tutorial_is_approved()` style:

- `is_org_leader(org_id uuid) → boolean` — true when `auth.uid()` has an
  `org_members` row for that org with `org_role = 'leader'` AND
  `status = 'approved'`. Required to break the recursion of an `org_members`
  policy that must query `org_members`.
- `has_accepted(agreement_type text) → boolean` — for the server-side terms
  gate inside policies. **Deliberately version-agnostic**: it returns true if
  the user has accepted *any* version of that agreement type. Forcing
  re-acceptance when a version is published is out of scope; the `version`
  column exists so that decision stays available without a migration.

## §2 RLS policies

### `organizations`

- **SELECT** — anyone reads `status = 'approved'`; `created_by` reads their own
  at any status; admin reads all.
- **INSERT** — any contributor with an accepted `org_leader_terms` row (via
  `has_accepted()`), `status` forced to `pending`.
- **UPDATE** — admin only. This is what keeps `status` and `trust_level` out of
  a leader's reach: a leader can never promote their own org or un-suspend it.

### `org_members`

- **INSERT (bootstrap)** — own row, `org_role = 'leader'`,
  `status = 'approved'`, permitted only when the target org's `created_by` is
  `auth.uid()` and the org has no approved leader yet. Without this the design
  deadlocks: the invite policy requires `is_org_leader(org_id)`, which is false
  for a brand-new org, so no first leader could ever exist. Keeping the
  bootstrap in RLS rather than doing it with the admin client means the founder
  path is enforced by the same layer as every other path.
- **INSERT (request)** — own row only, `initiated_by = 'contributor'`,
  `status = 'pending'`, `org_role = 'member'`. You cannot request to join *as a
  leader*.
- **INSERT (invite)** — `is_org_leader(org_id)` and the org is `approved`,
  `initiated_by = 'org'`, `status = 'pending'`.
- **UPDATE (leader side)** — `is_org_leader(org_id)`; may move
  `pending → approved/declined` **only where `initiated_by = 'contributor'`**;
  may set `approved → removed` at any time; may revive
  `declined/removed → pending`.
- **UPDATE (contributor side)** — own row only; may move
  `pending → approved/declined` **only where `initiated_by = 'org'`**.
- **SELECT** — own rows; `is_org_leader(org_id)` sees all rows for that org;
  admin sees all.

The `initiated_by` split is the security story: neither party can complete a
membership alone.

### `tutorials` — new leader UPDATE path

Alongside the existing admin path:

```
is_org_leader(tutorials.org_id)
AND EXISTS (org is status='approved' AND trust_level='trusted')
AND NOT EXISTS (tutorial_contributors row linking this tutorial to auth.uid())
```

All three conditions in one policy, so suspension, demotion, and self-review
each independently revoke the capability instantly — no cache, no cleanup job.

### `tutorials` — new leader SELECT path

**Not in the original brief, and load-bearing.** Without it a leader cannot
*read* a member's pending tutorial: `"Contributors can read own tutorials"` only
matches tutorials they are linked to, and `"Anyone can read approved tutorials"`
only matches published ones. The dashboard would show an empty queue and the
review screen would 404.

Leaders get SELECT on any tutorial carrying their `org_id`, **independent of
trust level and self-review**. Deliberately broader than the write policy: if
read tracked write, a probation org's leader would see nothing, and a suspended
org's leader would lose visibility into their own roster's history. Authority
stays gated separately.

Consequence to state plainly: **a leader can read their org members'
unpublished drafts.** That is a real privacy expansion for contributors —
joining an org means in-progress work becomes visible to that org's leader. It
is unavoidable if leaders are to review, it belongs in the `contributor_terms`
text, and it is a reason the join handshake must be a genuine two-sided opt-in.

### `user_agreements`

INSERT and SELECT own rows only. No UPDATE, no DELETE — an acceptance record
that can be edited is not a record.

## §3 API

### New: `routes/organizations.ts`

- `POST /api/organizations` — create, `status` forced `pending`. 403 unless the
  caller has an accepted `org_leader_terms` row. Creator gets an `org_members`
  row as `('leader', 'approved', initiated_by='org')` via the §2 bootstrap
  policy — the one legitimate self-approval, since you cannot invite yourself to
  an org you just created.
- `GET /api/organizations` — approved orgs, for the join picker.
- `GET /api/organizations/mine` — orgs the caller belongs to, with role and
  status. Drives the submit-flow org picker and dashboard links.
- `PATCH /api/admin/organizations/:id` — admin only; sets `status` and/or
  `trust_level`. Approving sets both (decision 5).

### New: `routes/org-members.ts`

Thin wrappers over RLS-gated writes via `createUserClient`:

`POST /request`, `POST /invite`, `POST /:id/approve`, `POST /:id/decline`,
`POST /:id/accept`, `POST /:id/reject`, `POST /:id/remove`.

approve/decline and accept/reject are deliberately separate rather than one
`PATCH /:id { status }`: the route name encodes which party is acting, instead
of pushing that distinction into the body where an RLS violation is the only
thing catching a mistake.

### New: `routes/agreements.ts`

- `POST /api/agreements` — record `(agreement_type, version)` for the caller.
- `GET /api/agreements/me` — list acceptances, so the UI can skip a gate
  already accepted.

### Changed: `routes/tutorials.ts`

- `POST /` — accepts optional `org_id`; validates the caller is an `approved`
  member of it (403 otherwise) and stores it as the snapshot. **This validation
  must be a TypeScript check**, because this route deliberately uses the admin
  client (`tutorials.ts:107`, commented: RLS policies rely on an `auth.uid()`
  context inserts through this route lack), so RLS is not running on this path.
  To be commented as such so it does not read as an oversight.
- `PATCH /:id` — **field allowlist**: `title`, `description`, `difficulty`,
  `tutorial_pdf_url`, `toy_photo_url`, `status`. Unknown keys dropped silently;
  403 for the protected ones (`org_id`, `review_level`, `reviewed_by`). Closes
  the pass-through before leaders gain any UPDATE grant.

  **`status` on this endpoint is restricted to `draft` and `pending`.** Allowing
  `status` at all while leaders hold an UPDATE grant would otherwise let a
  leader approve a tutorial through this generic endpoint — RLS would permit it,
  but `reviewed_by`, `reviewed_at`, and `review_level` would all stay null,
  producing a published tutorial with no audit trail and an invisible hole in the
  spot-check surface. Approve and reject must go through `POST /:id/review`
  (leaders) or the admin status endpoint. Requesting `approved`/`rejected` here
  returns 403.
- `POST /:id/review` — new. Leader review action: sets `status`,
  `reviewed_by = caller`, `reviewed_at`, `review_level = 'org'`, and
  `rejection_note` (required when rejecting). Uses `createUserClient`, so the
  database is the enforcement layer.

### Changed: `routes/admin.ts`

- Status endpoint additionally sets `review_level = 'platform'` and
  `reviewed_by`, so the audit trail is uniform regardless of reviewer.
- `GET /api/admin/tutorials` defaults to the platform's own queue —
  `review_level = 'platform'` OR `org_id IS NULL` — rather than all pending
  tutorials. Otherwise the admin queue keeps showing work a leader is about to
  handle and the feature will not feel like it removed anything.
- Spot-check endpoints: random sample of `review_level = 'org'` tutorials, and a
  flag-for-follow-up boolean toggle.

### Terms gating placement

The `contributor_terms` check goes in **both** `POST /api/tutorials` and the
`draft → pending` transition in `PATCH /:id`.

Gating creation alone is wrong: contributors who started drafts before the terms
existed would be blocked from touching their own work while the already-existing
drafts sail through. The `draft → pending` transition is the moment work is
actually offered to the platform, it catches pre-existing drafts, and it lets
someone explore the wizard before being asked to accept anything. Both is cheap
and means neither path is the one someone forgets.

`org_leader_terms` gates org creation and leader-role acceptance, server-side.

### Types

All new types added to `packages/types/src/index.ts`: `Organization`,
`OrgStatus`, `OrgTrustLevel`, `OrgMember`, `OrgRole`, `OrgMemberStatus`,
`InitiatedBy`, `UserAgreement`, `AgreementType`, `ReviewLevel`, plus the new
`Tutorial` fields.

## §4 Web

New pages follow the existing admin pattern (`/admin` card hub →
`/admin/review` list → `/admin/review/[id]` detail):

- **`/admin/organizations`** — approve pending orgs (sets approved + trusted),
  suspend, demote `trust_level`.
- **`/admin/spot-check`** — random sample of `review_level = 'org'` tutorials
  with a flag-for-follow-up boolean.
- **`/org/[orgId]`** — leader dashboard: pending join requests
  (approve/decline), pending tutorial reviews from members, roster management
  (invite, remove, pending invites awaiting the contributor).
- **`/org/[orgId]/review/[tutorialId]`** — approve/reject, `rejection_note`
  required on reject.
- **`/dashboard`** — gains an org section: memberships, pending invites to
  accept/decline, link to browse orgs to join.
- **Submit flow** — org picker (decision 3) and the `contributor_terms` gate:
  terms shown, explicit acceptance click required before submit is enabled.
- **Leader-role acceptance** — gated behind `org_leader_terms` acceptance.

### Routing protection

`middleware.ts` gates `/admin` by role. `/org/*` cannot work that way —
leadership is per-org data, not a role — so middleware enforces only "logged
in", and each org page checks membership server-side and redirects non-leaders.
`/org` and `/upload` added to the existing route lists.

The server-side membership check reads `org_members` directly rather than going
through role inference, so leader-ness has exactly one source of truth.

## §5 Tests

Integration tests in `tests/integration/orgs/`, following the existing
`createTestUser` + `app.request` pattern, asserting against the database so they
test the policies rather than route logic.

From the brief:

1. A leader cannot approve a tutorial from a non-member.
2. A leader cannot approve their own tutorial (self-review block, any
   `tutorial_contributors` link).
3. A leader cannot approve anything while their org is in `probation`.
4. Suspending an org immediately revokes the leader's approve capability
   (suspend mid-test, re-attempt the RLS-gated update).
5. A tutorial submission is rejected server-side with no accepted
   `contributor_terms` row.
6. A leader cannot approve their own `'org'`-initiated invite on the
   contributor's behalf.
7. A contributor cannot self-approve their own `'contributor'`-initiated join
   request.

Surfaced by this design:

8. A leader **can** read their org's pending tutorials; a non-member leader
   cannot (the §2 SELECT policy).
9. `PATCH /api/tutorials/:id` rejects attempts to set `org_id`,
   `review_level`, or `reviewed_by` (field allowlist).
10. A `declined` membership can be revived to `pending` (re-invite path).
11. A leader cannot approve a tutorial via `PATCH /api/tutorials/:id` — the
    generic endpoint refuses `status: 'approved'` even for someone whose RLS
    grant would allow the write, so no publish can skip the audit trail.
12. Creating an org makes the creator an approved leader of it, and does not
    make them a leader of any other org (the bootstrap policy is correctly
    scoped to `created_by`).

**Write test 4 first.** It is the one that only asserts anything under decision
9: it suspends the org mid-test and re-attempts an update that just succeeded.
Under a service_role client the second attempt would also succeed and the test
would prove nothing. It is a direct check that authority lives in the database.

## §6 Legal content — blocked, deliberately

`user_agreements` records acceptance of a `(agreement_type, version)` pair. The
actual terms are versioned static content under `packages/web/app/legal/`.

**Those content files ship empty with a TODO comment. No placeholder legal
language is to be generated.** The copy needs a lawyer, covering
jurisdiction-specific liability and TGA/medical-device considerations for
assistive equipment used by disabled children.

**Any acceptance recorded before real text exists is void** and should be
treated as such — the rows will reference a version string with no content
behind it. Either seed the version as something obviously non-binding (e.g.
`v0-todo`) and discard those rows when real terms land, or leave the gate
disabled until then. This was flagged, and the user chose to keep the plumbing
in scope regardless; that is a recorded decision, not an oversight.

Note also that the leader-visibility consequence from §2 (leaders can read
members' unpublished drafts) is a disclosure that belongs in
`contributor_terms`.

## §7 Contribution friction cuts

Own commit, ~10 lines. From reviewing the current contributor journey
(`/signup` → confirm email → `/login` → 6-step wizard → submit → wait):

1. **Fix the stale "request access" copy on `/signup`.** The page is headed
   "Request contributor access", the button says "Request access", the success
   screen says "Request received" — then contradicts itself with "You can log in
   and start uploading tutorials right away." Migrations 005/006 removed the
   approval gate entirely. Every new contributor is currently told they are in a
   queue that does not exist. Four strings, no logic.
2. **Drop the ≥1 part and ≥1 tool minimums** in `lib/validation.ts`
   (`canAdvanceFromStep` cases 3 and 4, and `getMissingFields`). Both are hard
   walls. A fully-printed toy has STL files and no purchased parts; a simple
   modification needs no tools. Keep the fields, drop the minimums.
3. **Stop requiring `difficulty` at step 1.** It is a reviewer's judgment, not
   the maker's, yet it blocks the very first "Next". Default to `medium` and let
   review adjust.

Explicitly **not** cut: email confirmation. It is a genuine hard stop between
signup and contributing, but spam control on a platform serving disabled
children is worth one click.

Not included, noted for later: making the wizard step indicator clickable for
completed steps. The wizard is strictly linear (`setStep(s + 1)`), so correcting
step 2 from step 6 costs four Back clicks.

## Out of scope

- `packages/mobile` — parent-facing; consumes published tutorials only and needs
  no change.
- Notifications of any kind (invite received, tutorial reviewed). The existing
  platform has none; adding them here would be scope creep.
- Multiple leaders per org is *supported* by the schema but needs no dedicated
  UI beyond the roster's existing role display.
- Endorsement / probation-graduation signalling. Superseded by decision 5, which
  removes probation from the default path. If probation is ever used as a real
  waiting period, endorsement is the intended way to generate promotion
  evidence.
