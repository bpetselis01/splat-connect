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
| 4 | ~~Self-review blocked by any `tutorial_contributors` link~~ — **superseded by decision 14** | Kept as a struck row rather than deleted, so the reversal is visible instead of looking like an omission. |
| 5 | **Trust on creation** — the admin creating an org sets `status='approved'` *and* `trust_level='trusted'` | Vetting happens when the admin decides the org should exist at all; a separate probation gate would duplicate that judgment while guaranteeing the feature delivers nothing to new orgs. `probation` becomes a state you *demote* into. Column defaults stay `'pending'`/`'probation'` so a row written by any path that forgets to set them is inert rather than live. |
| 6 | **Reuse `rejection_note`; no `review_notes` column** | The column exists, is already surfaced to contributors, and "required on rejection" is its exact semantics. Loses notes-on-approve only. |
| 7 | Re-invites **revive the existing row** (`declined`/`removed` → `pending`) | `unique (org_id, user_id)` makes re-insert impossible; without revival one accidental decline locks a contributor out of an org permanently. |
| 8 | Leaders must be `role = 'contributor'` | A `parent`-role leader would be treated as logged-out by every org page via `getUserRole()`, with no error to debug. Enforced server-side. |
| 9 | **Enforcement lives in RLS**, not route code (Approach 1) | A leader is a semi-trusted account held by someone outside the organisation. RLS holds even if a future route is written carelessly; API-side checks are only as good as every route that remembers them. Also the only approach under which the suspension-revocation test asserts anything real. |
| 10 | Friction cuts included in this spec | ~10 lines, same goal, avoids touching `validation.ts` twice. |
| 11 | **Only the admin creates organisations** | An organisation is the unit that carries review authority. Letting contributors self-create one — even into a `pending` state — draws the platform's trust boundary with a form anyone can submit, and reduces the admin to reviewing *proposals* rather than deciding who exists. With a single admin there is no second party to wait for, so creation and approval collapse into one action and `pending` becomes a staging state rather than a queue. Supersedes the original contributor-INSERT policy and the founder bootstrap. |
| 12 | **Only the admin grants `org_role = 'leader'`** | Leadership is the entire capability this feature delegates. A leader who can mint another leader grows their org's review authority without the admin ever seeing it. Promotion is unilateral and immediate — the promoted contributor is not asked to accept — because consent is collected at the point authority is *used* instead (decision 13). |
| 13 | **`org_leader_terms` gates the review grant, not any entry point** | Under decision 11 nobody opts into leadership before holding it, so the old creation-time gate has nothing to attach to. Moving `has_accepted('org_leader_terms')` into the tutorials leader UPDATE policy means a promoted leader sees their queue but cannot publish until they accept, and deleting the acceptance row revokes authority instantly — a third independent revocation alongside suspension and demotion. |
| 14 | **No self-review block — a leader may approve their own tutorial** | Leadership is granted by the admin to someone already trusted, so a preventive block buys little. It also costs a lot: a single-leader org — the common case — could never publish its leader's own work at all, which for a small org is most of what it has. The control becomes reactive and threefold: demote the leader, demote or suspend the org, or reject the tutorial. Reverses decision 4, and makes the spot-check surface load-bearing rather than nice-to-have. |

## §1 Schema

One new migration: `supabase/migrations/007_organizations.sql`.

### `organizations`

`id`, `name`, `description`, `status` enum (`pending`/`approved`/`suspended`,
default `pending`), `trust_level` enum (`probation`/`trusted`, default
`probation`), `created_by` → `profiles`, `created_at`, `updated_at`.

Under decision 11 `created_by` is always the admin, so it is an audit column
rather than an authority one. Nothing keys off it.

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

- **SELECT** — anyone reads `status = 'approved'`; admin reads all. There is no
  `created_by`-scoped read policy, because `created_by` is now always the admin
  and the admin already reads everything.
- **INSERT** — `is_admin()` only (decision 11). The policy puts no constraint on
  `status` or `trust_level`, since the admin is the party being trusted; the
  create endpoint sets both explicitly rather than leaning on the defaults.
- **UPDATE** — admin only. This is what keeps `status` and `trust_level` out of
  a leader's reach: a leader can never promote their own org or un-suspend it.

### `org_members`

- **INSERT (first leader)** — no policy. The org's first leader is written by the
  admin create endpoint under `"Admin full access to org_members"`. An earlier
  draft used an RLS bootstrap policy scoped to `created_by`, which existed only
  so a self-creating founder could claim leadership without deadlocking against
  the invite policy's `is_org_leader(org_id)`. Decision 11 removes the founder,
  and with them that policy and its `org_has_approved_leader()` helper.
- **INSERT (request)** — own row only, `initiated_by = 'contributor'`,
  `status = 'pending'`, `org_role = 'member'`. You cannot request to join *as a
  leader*.
- **INSERT (invite)** — `is_org_leader(org_id)` and the org is `approved`,
  `initiated_by = 'org'`, `status = 'pending'`, **`org_role = 'member'`**. That
  last condition is decision 12 on the INSERT side. Without it a leader mints a
  co-leader by inviting someone straight in as `('leader', 'pending')` — a path
  the `org_role` trigger below cannot see, because it fires only on UPDATE.
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
AND has_accepted('org_leader_terms')
```

All three conditions in one policy, so suspension, demotion and withdrawn consent
each independently revoke the capability instantly — no cache, no cleanup job.
The third is decision 13: it is the only consent a promoted leader is ever asked
for, so it has to bite where the authority is spent.

There is **no self-review conjunct** (decision 14). A leader may approve a
tutorial they authored. `is_tutorial_contributor()` survives because 008 uses it
as the retry-safety arm of the `tutorial_contributors` INSERT policy; it is no
longer part of any authority decision.

**Revocation is therefore the whole control, and one part of it has a trap.**
Demoting a leader (`org_role → 'member'`) must run under the **admin's own JWT**,
not the service role: `org_members_freeze_provenance` permits an `org_role`
change only when `is_admin()`, which reads `auth.uid()`, and the service role has
none. A service-role demote raises `42501` and silently changes nothing — the
same trap recorded above for `tutorials.org_id`. Rejecting an already-approved
tutorial has no such problem: the admin status endpoint places no constraint on
the transition.

### `tutorials` — new leader SELECT path

**Not in the original brief, and load-bearing.** Without it a leader cannot
*read* a member's pending tutorial: `"Contributors can read own tutorials"` only
matches tutorials they are linked to, and `"Anyone can read approved tutorials"`
only matches published ones. The dashboard would show an empty queue and the
review screen would 404.

Leaders get SELECT on any tutorial carrying their `org_id`, **independent of
trust level and the terms gate**. Deliberately broader than the write policy: if
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

### Provenance triggers — policies alone are not sufficient

**Added 2026-07-28 during implementation, after the policies above were found
exploitable as originally specified.**

An RLS `WITH CHECK` clause sees only the *new* row, and a PostgreSQL policy
cannot reference `OLD`. Every policy above that gates on `initiated_by`
therefore validates a value the same `UPDATE` statement is free to write. The
`initiated_by` split described above is a lock whose key is stored on the door.

Three exploits were reproduced end-to-end against the database, each through
PostgREST with an ordinary contributor's JWT — not via any API route:

1. **Self-promotion.** File a legitimate join request
   (`initiated_by='contributor'`), then `UPDATE ... SET initiated_by='org',
   status='approved', org_role='leader'`. The contributor-side policy's `USING`
   is only `user_id = auth.uid()`, and its `WITH CHECK` reads the freshly
   forged `initiated_by`. The attacker becomes an approved leader of an
   arbitrary org and can publish other members' tutorials.
2. **Conscription.** A leader sets `initiated_by='contributor'` on an
   org-initiated row and approves it, claiming a contributor who never accepted.
3. **Reviewer shopping.** `tutorials.org_id` was constrained by nothing, so a
   contributor belonging to no org could route their own draft into any trusted
   org's queue — or two leaders could cross-approve and skip platform review.

The fix is two `BEFORE` triggers, because `OLD` is visible only in a trigger:

- **`org_members_freeze_provenance`** (`BEFORE UPDATE`) makes `org_id`,
  `user_id`, and `initiated_by` immutable, restricts `org_role` changes to
  admins, and prevents a `removed` membership being restored by anyone but that
  org's leader or an admin. `BEFORE UPDATE` only, which is exactly why decision
  12 also needs `org_role = 'member'` on the invite policy: this trigger governs
  *promotion* of an existing row and says nothing about a row inserted as a
  leader outright.
- **`tutorials_org_must_be_own`** (`BEFORE INSERT OR UPDATE`) permits a write
  that *sets or changes* `org_id` only from a caller who is an approved member
  of the target org. It is gated on change, so a later membership change cannot
  retroactively revoke an author's ability to edit their own pinned work.

**Consequence that changes §3:** the service role has no `auth.uid()`, so it
cannot pin a tutorial to an org either. `POST /api/tutorials` uses the admin
client and therefore **cannot accept `org_id`**; assignment moves to
`POST /api/tutorials/:id/org`, which runs under the author's own JWT. This is
deliberate — it means no server-side code path can route a tutorial to an org
on a user's behalf, which is decision 9 applied more strictly than originally
written, not a retreat from it.

Decision 9 stands, with its mechanism corrected: enforcement lives in the
database, but for any rule that depends on what a row *was*, the database
mechanism is a trigger, not a policy.

## §3 API

### New: `routes/organizations.ts`

- `GET /api/organizations` — approved orgs, for the join picker.
- `GET /api/organizations/mine` — orgs the caller belongs to, with role and
  status. Drives the submit-flow org picker and dashboard links.

There is no contributor-facing create endpoint (decision 11).

### Changed: `routes/admin.ts` — organisation authority

- `POST /api/admin/organizations` — `{ name, description, leader_user_id }`.
  Creates the org with `status = 'approved'`, `trust_level = 'trusted'`,
  `created_by` = the admin, then writes the first leader's `org_members` row as
  `('leader', 'approved', initiated_by = 'org', invited_by = admin)` under
  `"Admin full access to org_members"`. `leader_user_id` is **required**: an org
  with no leader cannot approve its own join requests, so making it optional
  would re-create the very deadlock the deleted bootstrap policy existed to
  solve.
- `PATCH /api/admin/organizations/:id` — sets `status` and/or `trust_level`.
  Suspension and demotion; creation already grants both (decision 5).
- `PATCH /api/admin/organizations/:orgId/members/:userId` — sets `org_role` to
  `leader` or `member`. Requires the target membership to already be
  `status = 'approved'`, so a promotion cannot leave the confusing
  `('leader', 'pending')` state behind.

Both write endpoints check that a prospective leader's `profiles.role` is
`'contributor'` (decision 8) in TypeScript. Decision 9 puts enforcement in RLS
because a *leader* is a semi-trusted account; these routes sit behind the
existing admin middleware and the admin holds `service_role` regardless, so a
database guard here would constrain nobody.

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

- `POST /` — **cannot accept `org_id`**, per the §2 amendment above. This route
  deliberately uses the admin client (`tutorials.ts:107`, commented: RLS policies
  rely on an `auth.uid()` context inserts through this route lack), and
  `tutorials_org_must_be_own` refuses a write that sets `org_id` from a caller with
  no `auth.uid()` — so there is no server-side path that can route a tutorial into
  an org on a user's behalf. Assignment is a separate call,
  `POST /api/tutorials/:id/org`, which runs under the author's own JWT and is
  therefore checked by the trigger against a real membership rather than by a
  TypeScript check that RLS is not backing.
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

### Changed: `routes/admin.ts` — review queue and audit

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

`org_leader_terms` gates no entry point at all — it gates the leader review
grant itself, inside RLS (decision 13). `POST /api/agreements` still records the
acceptance; what changed is what that record unlocks and when it is checked.

### Types

All new types added to `packages/types/src/index.ts`: `Organization`,
`OrgStatus`, `OrgTrustLevel`, `OrgMember`, `OrgRole`, `OrgMemberStatus`,
`InitiatedBy`, `UserAgreement`, `AgreementType`, `ReviewLevel`, plus the new
`Tutorial` fields.

## §4 Web

New pages follow the existing admin pattern (`/admin` card hub →
`/admin/review` list → `/admin/review/[id]` detail):

- **`/admin/organizations`** — create an org (name, description, and a
  contributor picker for its first leader), suspend, demote `trust_level`, and a
  per-org roster with promote/demote. This is the only surface in the product
  that grants leadership (decisions 11 and 12).
- **`/admin/spot-check`** — random sample of `review_level = 'org'` tutorials
  with a flag-for-follow-up boolean.
- **`/org/[orgId]`** — leader dashboard: pending join requests
  (approve/decline), pending tutorial reviews from members, roster management
  (invite, remove, pending invites awaiting the contributor). A leader who has
  not accepted `org_leader_terms` sees the queue with approve and reject
  disabled and an inline acceptance action, mirroring the §2 grant so the UI
  never offers a button the database will refuse.
- **`/org/[orgId]/review/[tutorialId]`** — approve/reject, `rejection_note`
  required on reject.
- **`/dashboard`** — gains an org section: memberships, pending invites to
  accept/decline, link to browse orgs to join.
- **Submit flow** — org picker (decision 3) and the `contributor_terms` gate:
  terms shown, explicit acceptance click required before submit is enabled.

No page anywhere lets a contributor create an org or grant leadership.

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
2. A leader **can** approve their own tutorial (decision 14), and once demoted
   cannot — two halves of one fixture, with different failure shapes: zero rows
   for a member's tutorial, `42501` for their own, because the contributor policy
   still matches the latter.
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
12. Admin org creation makes `leader_user_id` an approved leader of that org and
    of no other; a non-admin cannot create an organisation at all.
13. A leader cannot invite someone as `org_role = 'leader'` (blocked by the
    invite policy's `org_role = 'member'`), and cannot promote an existing
    member (blocked by the `org_role` trigger). Both halves of decision 12, and
    they fail through different mechanisms, so both need asserting.
14. A promoted leader who has not accepted `org_leader_terms` can read their
    org's queue but cannot approve; the same update succeeds once accepted.
15. Demoting a leader to `member` revokes the review grant instantly, and the
    demotion **persists** — asserted against the database, because a service-role
    demote returns success and changes nothing.
16. An admin can reject a tutorial its own author approved as leader, through
    `PATCH /api/admin/tutorials/:id/status`.

**Write test 14 alongside test 4.** It has the same property test 4 has: it
asserts nothing unless the gate really lives in the policy. Under a
service_role client, or with the check written in route code, the
pre-acceptance attempt would succeed and the test would prove only that the UI
disabled a button.

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
- Multiple leaders per org is *supported* by the schema, and under decision 12
  the only way to get one is the admin roster's promote action — which §4
  already specifies. No further UI.
- Endorsement / probation-graduation signalling. Superseded by decision 5, which
  removes probation from the default path. If probation is ever used as a real
  waiting period, endorsement is the intended way to generate promotion
  evidence.
