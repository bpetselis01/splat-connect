# Projects, Organisations, and Delegated Review

**Date:** 2026-07-28
**Status:** Approved design, ready for implementation planning
**Supersedes:** `2026-07-28-org-delegated-review-design.md` (§1–§5). That document's
decisions 1, 5, 6, 8–14 carry forward unchanged; its membership model does not.

## Goal

A tutorial is a **project**. Its author asks one or more organisations to back it.
Each organisation answers for itself, and a leader of any organisation that said
yes can approve or reject the tutorial. The platform admin is no longer the only
person who can publish.

The organisation is a **badge of trust, never an owner**. Credit stays with the
contributor who wrote the tutorial, whatever happens afterwards.

## Why this replaces the membership model

The superseded design had two handshakes doing overlapping work: a contributor
and an organisation agreed the contributor *belonged* (four states,
`initiated_by`, seven endpoints, a trigger, a revive path), and then a member
could route any of their tutorials into that organisation's queue unilaterally.

Per-project association subsumes both. The author offers a specific tutorial, a
leader accepts or declines it, and that single exchange does everything
membership did and more:

- **It protects the organisation better.** Membership granted the right to submit
  freely thereafter. Association is granted one project at a time.
- **It protects the contributor better.** Under membership, joining exposed
  *every* draft to the organisation's leaders. Now nothing is exposed until that
  specific project is offered.
- **It is far smaller.** Membership status, `initiated_by`, `invited_by`, five
  policies, a provenance trigger, seven endpoints, a browse-and-join page and a
  roster UI all disappear.

## Decisions

Continuing the numbering from the superseded spec.

| # | Decision | Rationale |
|---|---|---|
| 15 | **Per-project association replaces membership entirely** | See above. The two mechanisms answer the same question; this one answers it better and costs less. Supersedes decisions 2, 3 and 7. |
| 16 | **Cut `trust_level`** | A `probation` org and a `suspended` org could do exactly the same thing: nothing. The distinction was tone, not capability. `status` covers it. If a middle state is ever needed that *behaves* differently, add it then. |
| 17 | **Cut `review_level`** | Derivable. `reviewed_by` records who approved, and with one admin "approved by someone other than me" is the same query. The admin queue no longer needs it either (decision 23). |
| 18 | **Cut `flagged_for_follow_up`** | "Suspicious, not acting yet" is not a workflow a single admin has. One boolean, trivially added back. |
| 19 | **Many organisations per project** | A join table, `tutorial_orgs`. Collaboration between clinics is a real thing the platform should be able to show. |
| 20 | **Any leader of any accepted org may approve — first to act wins** | Unanimity gives every collaborator a veto by inaction, which is how queues die. A "primary reviewer" would mean an organisation that backed the work cannot act on it. |
| 21 | **Only the author adds organisations** | Keeps one handshake with one initiator, which is what made this design collapse so far. It also follows from credit belonging to the author: if the byline is theirs, so is the guest list. A leader who thinks another organisation should be involved tells the author. |
| 22 | **An association freezes once that organisation approved the tutorial** | Until then either side may back out freely. After that the row *is* the audit trail — `reviewed_for_org_id` would otherwise point at an organisation no longer listed. An organisation that lent its name but did not review may still withdraw; the one that approved must reject the tutorial instead. You cannot disown work while leaving it published under your name. |
| 23 | **The admin queue shows every pending tutorial** | Including ones an organisation has accepted. Delegation removes the *obligation* to act, not the visibility. The row shows which organisation is handling it, with an optional filter to hide those. |

### Carried forward unchanged

Decision 1 (agreements in scope), 5 (admin creation sets the org live), 6 (reuse
`rejection_note`), 8 (leaders must be `role = 'contributor'`), 9 (enforcement in
the database, not route code), 10 (friction cuts), 11 (only the admin creates
organisations), 12 (only the admin grants leadership), 13 (`org_leader_terms`
gates the review grant, not an entry point), 14 (no self-review block).

## §1 Schema

Migration `007_organizations.sql` is unmerged and is rewritten in place. No `009`.

### `organizations`

`id`, `name`, `description`, `status` enum (`active`/`suspended`, default
`active`), `created_by` → `profiles`, `created_at`, `updated_at`.

`pending` is gone: the admin creates organisations, so creation *is* approval
(decision 5). `created_by` is always the admin — an audit column, not an
authority one.

### `org_leaders`

`id`, `org_id` → `organizations`, `user_id` → `profiles`, `created_at`,
`unique (org_id, user_id)`.

That is the whole table. Only the admin writes it (decision 12); everyone reads
it, because a leader is a public-facing trust figure.

Replaces `org_members`. Gone with it: `status`, `org_role`, `initiated_by`,
`invited_by`, and every state machine attached to them.

### `tutorial_orgs`

`id`, `tutorial_id` → `tutorials` on delete cascade, `org_id` → `organizations`
on delete cascade, `status` enum (`pending`/`accepted`/`declined`, default
`pending`), `requested_at`, `responded_at` nullable, `responded_by` → `profiles`
nullable, `unique (tutorial_id, org_id)`.

`responded_by` records which leader answered, so an organisation can see who
committed it to what.

### `user_agreements`

Unchanged: `id`, `user_id`, `agreement_type` (`contributor_terms`,
`org_leader_terms`), `version`, `accepted_at`.

### `tutorials` — column changes

**Dropped:** `org_id`, `review_level`, `flagged_for_follow_up`.

**Kept:** `reviewed_by`, plus the pre-existing `reviewed_at` and
`rejection_note`.

**Added:** `reviewed_for_org_id` → `organizations` nullable — the organisation
the approving leader acted for. It earns its place twice: it makes "Approved by
Sam, Riverside Therapy" exact when someone leads two backing organisations, and
it is what decision 22's freeze rule keys on.

### Helper functions

`SECURITY DEFINER`, matching the `is_admin()` style:

- `is_org_leader(p_org_id uuid) → boolean` — the caller has an `org_leaders` row
  for that organisation. Simpler than before: there is no membership status to
  bake in.
- `has_accepted(p_agreement_type text) → boolean` — version-agnostic, unchanged.
- `is_tutorial_contributor(p_tutorial_id uuid) → boolean` — retained for 008's
  retry-safety arm, and now also used by the `tutorial_orgs` INSERT policy.
- `tutorial_has_contributor(p_tutorial_id uuid) → boolean` — 008, unchanged.

## §2 RLS and triggers

### `organizations`

- **SELECT** — anyone, at any status. Deliberately not scoped to `active`: a
  suspended organisation's badge must keep rendering on tutorials it already
  backed, or history rewrites itself. Names and descriptions are public anyway.
- **INSERT / UPDATE / DELETE** — `is_admin()` only.

### `org_leaders`

- **SELECT** — anyone.
- **All writes** — `is_admin()` only.

No provenance trigger. The superseded design needed one because non-admins could
write `org_members`; here nobody can, so an admin-only policy is the whole rule.

### `user_agreements`

Unchanged: read own, insert own, admin reads all. No UPDATE, no DELETE.

### `tutorial_orgs`

- **INSERT** — `is_tutorial_contributor(tutorial_id)`, `status = 'pending'`,
  `requested_at` set, and the tutorial's status is `draft` or `pending`. You may
  not bolt an organisation onto published work.
- **UPDATE** — `is_org_leader(org_id)` in both `USING` and `WITH CHECK`, and the
  new `status` is `accepted` or `declined`. Checking both clauses is what stops a
  leader moving a row to an organisation they do not lead.
- **DELETE** — the tutorial's contributors, or a leader of that organisation,
  **unless** the tutorial is `approved` and its `reviewed_for_org_id` is this
  `org_id` (decision 22).
- **SELECT** — the tutorial's contributors; leaders of the organisation named in
  the row; the admin; and anyone at all for rows that are `accepted` on an
  `approved` tutorial, so public badges render.

### `tutorial_orgs` — the one trigger

`tutorial_orgs_freeze_tutorial` (`BEFORE UPDATE`) makes `tutorial_id` and
`org_id` immutable.

`org_id` is already covered by the UPDATE policy checking `is_org_leader` on both
the old and new row, but freezing it in the trigger costs one line and removes
the need to reason about that interaction.

`tutorial_id` genuinely needs the trigger. A policy cannot see the old row, so
without this a leader could take a legitimate acceptance of one tutorial and
repoint it at another — stamping their organisation on work that never asked for
it. That is an attack on the author, and it is the mirror of the
forge-`initiated_by` exploit the superseded design hit. **A policy validating a
column the same statement may rewrite is a lock whose key is on the door.**

### `tutorials` — leader SELECT

A leader may read any tutorial with a `tutorial_orgs` row for an organisation
they lead, where that row's status is `pending` or `accepted`.

`pending` is included because reading the tutorial is how a leader decides
whether to accept it.

**Consequence, stated plainly:** offering a project to an organisation exposes
the draft to that organisation's leaders, including if they then decline. Offer
to six organisations and six sets of leaders have read your unpublished work.
This is inherent to asking permission, it is far narrower than the superseded
model, and it belongs in the `contributor_terms` text. The submit flow should
frame the picker as "ask one or two", not a multi-select of everything.

### `tutorials` — leader UPDATE (the review grant)

```
EXISTS (tutorial_orgs row where status = 'accepted'
        AND is_org_leader(org_id)
        AND that organisation's status = 'active')
AND has_accepted('org_leader_terms')
```

Three conditions in one policy, so losing leadership, the organisation being
suspended, and withdrawn consent each independently revoke the capability
instantly — no cache, no cleanup job.

No self-review conjunct (decision 14). A leader may approve a tutorial they
authored, if an organisation they lead is backing it.

### `tutorials` — provenance trigger (008)

`tutorials_freeze_review_provenance` narrows to `reviewed_by` and
`reviewed_for_org_id`, reserving both to admins and to leaders of an accepted
organisation. `review_level` and `flagged_for_follow_up` leave the list with the
columns.

`tutorials_org_must_be_own` is **deleted** — there is no `tutorials.org_id`.

## §3 API

### Deleted before it was built

`routes/org-members.ts` and its seven endpoints. There is no membership.

### `routes/organizations.ts`

- `GET /api/organizations` — all organisations, for the request picker.
- `GET /api/organizations/:id` — one, with its leaders.

### `routes/admin.ts` — organisation authority

- `POST /api/admin/organizations` — `{ name, description?, leader_user_id }`.
  Creates the organisation `active` and writes its first leader. `leader_user_id`
  is required: a leaderless organisation cannot answer any request.
- `PATCH /api/admin/organizations/:id` — `{ status }`. Suspend or reactivate.
- `POST /api/admin/organizations/:orgId/leaders` — `{ user_id }`.
- `DELETE /api/admin/organizations/:orgId/leaders/:userId`.

Both leader endpoints validate the target's `profiles.role = 'contributor'`
(decision 8) in TypeScript.

**All four run under the admin's own JWT via `createUserClient`, not
`createAdminClient`**, so the admin policies in §2 are the enforcement layer in
production rather than being exercised only by tests. That is decision 9 applied
consistently.

It also avoids a trap that bit the superseded design and was only found by
asserting on the database rather than the status code: **triggers run for
`service_role` even though RLS does not**, and any guard calling `is_admin()`
reads `auth.uid()`, which `service_role` lacks. A service-role write that hits
such a guard raises `42501` while the route returns success having changed
nothing. No table in this design carries such a trigger today — but `org_leaders`
acquiring one later must not silently break these routes.

### `routes/tutorials.ts`

- `POST /:id/orgs` — `{ org_id }`. Author asks an organisation to back the
  project. Draft or pending tutorials only.
- `DELETE /:id/orgs/:orgId` — author withdraws, subject to decision 22.
- `POST /:id/orgs/:orgId/accept` and `POST /:id/orgs/:orgId/decline` — leader
  responds. Separate routes rather than one `PATCH { status }` so the URL names
  the action.
- `POST /:id/review` — `{ status, rejection_note? }`. Leader approves or rejects:
  sets `status`, `reviewed_by`, `reviewed_at`, `reviewed_for_org_id`, and
  `rejection_note` (required on reject). Uses `createUserClient`, so the database
  is the enforcement layer.
- `PATCH /:id` — field allowlist: `title`, `description`, `difficulty`,
  `tutorial_pdf_url`, `toy_photo_url`, `status`. `status` restricted to `draft`
  and `pending`; `approved`/`rejected` return 403. Publishing must go through
  `POST /:id/review` or the admin endpoint, or `reviewed_by` and
  `reviewed_for_org_id` stay null and the spot-check surface has a hole in it.

### `routes/agreements.ts`

Unchanged: `POST /api/agreements`, `GET /api/agreements/me`.

### `routes/admin.ts` — queue and audit

- `GET /api/admin/tutorials` returns **every** pending tutorial (decision 23),
  each with its `tutorial_orgs` rows embedded so the UI can show who is handling
  what.
- The status endpoint additionally sets `reviewed_by`, and leaves
  `reviewed_for_org_id` null — the admin acts for the platform, not an
  organisation.
- Spot-check: a random sample of approved tutorials where `reviewed_by` is not
  the calling admin.

### Terms gating

`contributor_terms` is checked in both `POST /api/tutorials` and the
`draft → pending` transition in `PATCH /:id`. Gating creation alone would block
contributors from touching drafts that predate the terms while those same drafts
sail through.

`org_leader_terms` gates no entry point. It is a conjunct of the review grant
(decision 13).

### Types

`packages/types/src/index.ts`: `Organization`, `OrgStatus`, `OrgLeader`,
`TutorialOrg`, `TutorialOrgStatus`, `UserAgreement`, `AgreementType`, plus the
`Tutorial` changes. Removed: `OrgMember`, `OrgRole`, `OrgMemberStatus`,
`InitiatedBy`, `OrgTrustLevel`, `ReviewLevel`.

## §4 Web

- **`/admin/organizations`** — create an organisation with its first leader,
  suspend and reactivate, add and remove leaders. The only surface that grants
  leadership.
- **`/admin/review`** — every pending tutorial, each row showing its backing
  state ("Riverside Therapy accepted, awaiting their review"), with a
  "hide ones an organisation is handling" toggle, defaulting to off.
- **`/admin/spot-check`** — sample of tutorials approved by someone other than
  the admin.
- **`/org/[orgId]`** — leader dashboard, two lists: incoming project requests to
  accept or decline, and accepted projects awaiting review. A leader who has not
  accepted `org_leader_terms` sees both lists with the action buttons disabled
  and an inline acceptance control, mirroring the §2 grant so the UI never offers
  a button the database will refuse.
- **`/org/[orgId]/review/[tutorialId]`** — approve or reject, note required on
  reject.
- **Submit flow** — a "who should back this?" step listing organisations, framed
  to encourage one or two rather than a multi-select of everything, plus the
  `contributor_terms` gate.
- **`/dashboard`** — the contributor's projects with each one's backing state,
  and a control to withdraw a request.
- **`/tutorials/[id]`** — badges for `accepted` organisations only, plus
  "Approved by Sam, Riverside Therapy". A pending or declined request never
  renders publicly.

### Routing protection

`middleware.ts` gates `/admin` by role. `/org/*` cannot work that way — leadership
is per-organisation data, not a role — so middleware enforces "logged in" only,
and each org page checks `org_leaders` server-side and redirects non-leaders.

## §5 Tests

Integration tests in `packages/api/tests/integration/orgs/`, asserting against the
database through a **user client** so they test policies rather than route logic.

1. Only the admin can create an organisation or write `org_leaders`.
2. A contributor can request an organisation back their draft; the row lands
   `pending`.
3. **A contributor cannot forge `accepted` on their own request.** The single most
   important test in this suite: it is what stops an author handing an
   organisation's leaders authority the organisation never agreed to.
4. A leader of the requested organisation can accept, and can then approve the
   tutorial.
5. A leader of a *different* organisation cannot accept or approve it.
6. A leader cannot repoint an accepted row at a different tutorial (the
   `tutorial_id` freeze trigger).
7. Two organisations both accept; a leader of either can approve; whoever acts
   first wins and `reviewed_for_org_id` names their organisation.
8. A declined organisation's row never appears in the public badge query.
9. A leader with no accepted `org_leader_terms` row can read their queue but
   cannot approve; the same update succeeds once accepted. **Write this early** —
   it asserts nothing unless the gate really lives in the policy.
10. Suspending an organisation immediately revokes its leaders' approve
    capability.
11. Removing a leader immediately revokes it. Assert against the database that
    the row is gone, not just that the endpoint returned 200 — the superseded
    design shipped a revocation endpoint that reported success and changed
    nothing, and only a database assertion caught it.
12. A leader can approve their own tutorial when an organisation they lead backs
    it (decision 14); a plain contributor cannot approve anything.
13. An association can be deleted before approval by either side, and cannot be
    deleted once that organisation is the tutorial's `reviewed_for_org_id`.
14. A leader can read a `pending` request's draft, and cannot read an unrelated
    contributor's draft.
15. `PATCH /api/tutorials/:id` refuses `status: 'approved'` even from a leader
    whose grant would allow the write, so no publish skips the audit trail.
16. An admin can reject a tutorial a leader already approved.
17. A tutorial cannot gain an organisation once it is `approved`.

## §6 Legal content — blocked, deliberately

`user_agreements` records acceptance of a `(agreement_type, version)` pair. The
terms are versioned static content under `packages/web/app/legal/`, and **those
files ship empty with a TODO. No placeholder legal language is to be generated.**
The copy needs a lawyer, covering jurisdiction-specific liability and TGA /
medical-device considerations for assistive equipment used by disabled children.

Any acceptance recorded before real text exists is void. Seed the version as
something obviously non-binding (`v0-todo`) and discard those rows when real terms
land.

Two disclosures belong in `contributor_terms`: that offering a project to an
organisation lets that organisation's leaders read the unpublished draft even if
they decline, and that a leader may approve their own work.

## §7 What gets deleted

All of this exists and passes on `feat/org-accounts-schema-rls` today. It is
unmerged, so it is removed rather than migrated.

- `org_members` and every policy on it
- `org_members_freeze_provenance`
- `org_has_approved_leader()` (already gone)
- `tutorials_org_must_be_own` and `tutorials.org_id`
- `tutorials.review_level`, `tutorials.flagged_for_follow_up`,
  `organizations.trust_level`
- `packages/api/tests/integration/orgs/membership-handshake.test.ts`,
  `suspension.test.ts` and `review-revocation.test.ts` are rewritten against the
  new model; `tutorial-read-grant.test.ts` and `tutorial-review-grant.test.ts`
  are adapted.
- The unexecuted API plan's Task 3 (`routes/org-members.ts`) and the web plan's
  browse-and-join page, dashboard invites section, and roster tab.

Carrying both models would be worse than deleting one. This is the cost of having
found the better model second.

## Out of scope

- `packages/mobile` — parent-facing, consumes published tutorials only.
- Notifications of any kind. The platform has none; adding them here is scope
  creep.
- An organisation blocking a contributor who spams it with requests. Declining is
  one click, and at this scale the problem is hypothetical. Add it if it happens.
- Any consensus mechanism across collaborating organisations (decision 20).
- Re-acceptance of agreements when a version is published (`has_accepted()` is
  version-agnostic; the `version` column keeps the option open).
