# Tutorial Collaborators & In-App Notifications

**Date:** 2026-08-02
**Status:** Approved design, ready for implementation planning

## Goal

A contributor can invite other contributors to co-author a tutorial as equal
collaborators, everyone on a project learns about the events that affect it
without checking back manually, and two people editing the same tutorial at
once can no longer silently erase each other's work.

## Context

`tutorial_contributors` already has a `role` column (`primary`/`collaborator`),
but nothing has ever inserted `'collaborator'` — no feature exists behind it,
and a tutorial today can never have more than one contributor. Migration
`008_tutorial_contributor_scope.sql` deliberately locked this down: the INSERT
policy only admits a row when the tutorial has no contributor yet. It closed a
reproduced exploit chain — self-attach to a stranger's private draft, pin it to
an organisation you lead, back your own request, approve it yourself, publish
someone else's unsubmitted work. Any collaborator feature has to add a second
contributor without reopening that path.

Organisation membership (leaders enrolling contributors the way a lecturer
enrolls students, with submissions landing automatically in the leader's
queue) was explored separately and parked — it's a different, larger piece of
work than getting collaboration on a single project right. This spec does not
touch organisation policy, schema, or the admin/leader review split; admin
stays the sole publish authority exactly as it is today.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **Invite/accept, not unilateral add** | A collaborator gets full edit rights over someone else's work; they should consent to that, not be silently opted in. |
| 2 | **Collaborators have full parity with the primary contributor** | Editing content, submitting for review, and asking/withdrawing organisation backing are all available to any accepted collaborator. An edit by anyone on the team resets an already-approved tutorial to `pending`, same as it does today for the sole author. |
| 3 | **Only the primary contributor manages the team; a collaborator may remove themself** | Adding or removing *other people* is a different kind of decision than editing the work, and splitting it across the whole team invites one collaborator quietly removing another. Leaving is a one-sided decision no one else needs to authorise. |
| 4 | **A new `tutorial_collaborator_invites` table, not a status column on `tutorial_contributors`** | `tutorial_contributors` is guarded by the 008 fix; adding state to it means adding conditions to a security-critical policy. Keeping the pending handshake in its own table — the same shape `tutorial_orgs` already uses for the backing handshake — means `tutorial_contributors` gets exactly one new, narrow INSERT arm and nothing else changes. |
| 5 | **Notifications are in-app only** | Sub-project 3 of the org-backing arc (email notifications) was fully designed and then declined outright on 2026-07-29: the platform stays pull-based because every state change is already visible in the UI. The decision that had blocked in-app badges — "don't build them, real notifications are coming" — no longer holds once email was cancelled, so an in-app inbox is the first real notification surface, not a placeholder. |
| 6 | **Conflict protection is optimistic concurrency on `tutorials` only** | `parts` and `tools` are POST-one/DELETE-one endpoints — concurrent edits there are commutative and never overwrite each other. The only shared, replace-in-place resource is the `tutorials` row itself (title, description, difficulty, photo, PDF), updated via `PATCH /api/tutorials/:id`. That's the only place a silent overwrite can happen, so that's the only place that needs protecting. |
| 7 | **Conflicts are detected and surfaced, not merged** | A `409` with "updated by someone else, reload to see their changes" is standard, costs one column and one `WHERE` clause, and never silently loses work. Real-time merge (CRDT/websockets) would solve the same problem but needs a sync server for a form a couple of trusted collaborators touch occasionally — disproportionate at this scale. |

## §1 Schema

### `tutorial_collaborator_invites`

Same shape as `tutorial_orgs`'s backing handshake, for a person instead of an
organisation:

```sql
create table public.tutorial_collaborator_invites (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid references public.tutorials on delete cascade not null,
  invited_profile_id uuid references public.profiles on delete cascade not null,
  invited_by uuid references public.profiles on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (tutorial_id, invited_profile_id)
);
```

- **INSERT/UPSERT**: only the tutorial's primary contributor. The invite
  endpoint upserts on the `(tutorial_id, invited_profile_id)` unique pair,
  resetting a `declined` row back to `pending` rather than failing on the
  constraint — so a decline isn't permanent, the primary contributor can just
  ask again.
- **UPDATE**: only the invited profile, moving `pending` → `accepted` or
  `declined`. No one else may answer someone else's invite.
- **SELECT**: the invited profile, the tutorial's primary contributor, and
  admins.

### `tutorial_contributors` — one new INSERT arm

The existing 008 policy stays exactly as restrictive as it is today for the
self-claim case. It gains one alternative:

```sql
-- existing arm: claim a tutorial with no contributor yet (the authoring path)
-- new arm: claim a seat you were invited to
or exists (
  select 1 from public.tutorial_collaborator_invites i
  where i.tutorial_id = tutorial_contributors.tutorial_id
    and i.invited_profile_id = auth.uid()
    and i.status = 'pending'
)
```

This doesn't reopen 008's hole: a row only exists here because the *primary*
contributor created it (enforced by the invite table's own INSERT policy), so
a stranger still has no path to attach themselves.

### `notifications`

```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles on delete cascade not null,
  type text not null check (type in (
    'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
    'collaborator_removed', 'collaborator_left',
    'tutorial_approved', 'tutorial_rejected'
  )),
  tutorial_id uuid references public.tutorials on delete cascade not null,
  actor_name text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
```

`actor_name` is denormalised at insert time (the name of who triggered the
event) so a row still renders sensibly if the actor's profile changes later —
the same reasoning `tutorial_orgs` uses `responded_by` rather than joining live.
RLS: a user may only `SELECT`/`UPDATE` (to set `read_at`) their own rows.
Rows are written by the API using the admin client at the point each event
happens — no trigger, no queue, matching how every other cross-table effect in
this codebase is done in the route handler rather than in the database.

### `tutorials.updated_at`

```sql
alter table public.tutorials add column updated_at timestamptz not null default now();

create trigger tutorials_bump_updated_at
  before update on public.tutorials
  for each row execute function public.set_updated_at();
```

(`set_updated_at()` is a one-line `new.updated_at = now(); return new;`
trigger function shared by any table that needs this — first use here.)

## §2 API

**Collaborators** (`packages/api/src/routes/collaborators.ts`, new):

| Route | Who | Effect |
|---|---|---|
| `POST /api/tutorials/:id/collaborators/invite` | primary contributor | body `{ email }` or `{ username }`; creates or resets a `pending` invite row; notifies invitee |
| `GET /api/collaborators/me/invites` | any user | invites addressed to them, pending only |
| `POST /api/collaborators/invites/:inviteId/accept` | invitee | invite → `accepted`; inserts `tutorial_contributors` row; notifies inviter |
| `POST /api/collaborators/invites/:inviteId/decline` | invitee | invite → `declined`; notifies inviter |
| `DELETE /api/tutorials/:id/collaborators/:profileId` | primary contributor, or the collaborator removing themself | deletes the `tutorial_contributors` row; notifies the other side (`collaborator_removed` or `collaborator_left`) |

**Notifications** (`packages/api/src/routes/notifications.ts`, new):

| Route | Effect |
|---|---|
| `GET /api/notifications/me` | list, newest first |
| `GET /api/notifications/me/unread-count` | badge count |
| `PATCH /api/notifications/:id` | body `{ read: true }`; sets `read_at` |

**`PATCH /api/tutorials/:id`** (existing, one change): body must include
`updated_at` matching the row's current value. The update clause gains
`.eq('updated_at', body.updated_at)`; a `0`-row result means someone else
saved first — return `409`. Who changed it isn't knowable from this check
alone, but *that* it changed is enough for the message in §3.

**Admin review** (`packages/api/src/routes/admin.ts`, existing endpoints,
one addition): on approve and on reject, insert a `tutorial_approved` or
`tutorial_rejected` notification for every row in that tutorial's
`tutorial_contributors`.

## §3 UI

- **Tutorial edit page** gains a **Collaborators** section, same shape as the
  existing Backing section: current collaborators listed with a Remove
  control (primary's view) or a Leave control (a collaborator's own view),
  an invite field (email/username, type-to-find like the org leader picker),
  and pending invites shown as "waiting on Jane."
- **Sidebar** gains a **Notifications** entry with a live unread-count badge.
  Opens a list; opening a row sets it read and links to the tutorial.
- **Save conflict**: the tutorial fields form catches `409` from `PATCH
  /api/tutorials/:id` and shows *"This was updated while you were editing —
  reload to see the latest version before saving your changes."* No auto-merge
  attempted; the user reloads and reapplies.

## §4 Tests

Unit and integration tests follow `tests/integration/orgs/*` as the closest
existing precedent (a pending/accepted/declined handshake feeding a downstream
table):

1. Invite/accept round-trip inserts a `tutorial_contributors` row with
   `role='collaborator'`.
2. Invite/decline never inserts one.
3. A stranger with no invite still cannot self-claim a tutorial that already
   has a contributor — the 008 regression case, re-asserted with the new
   policy arm in place.
4. Only the primary contributor can create an invite; a collaborator cannot.
5. A collaborator can remove themself; cannot remove another collaborator.
6. The primary contributor can remove any collaborator.
7. A collaborator can edit parts/tools/files, submit for review, and ask/
   withdraw organisation backing — full parity, exercised once each.
8. Editing an approved tutorial as a collaborator (not just the primary)
   resets it to `pending`.
9. Each of the 7 notification types is created for the right recipient(s) at
   the right trigger point.
10. `PATCH /api/tutorials/:id` with a stale `updated_at` returns `409` and
    makes no change; with the current value it succeeds and bumps
    `updated_at`.
11. Marking a notification read is scoped to its own recipient — one user
    cannot mark another's notification read.

E2E: one journey — author creates a draft, invites a collaborator, the
collaborator accepts from their notification, edits a field, submits; the
author sees the submission and, after admin approval, both author and
collaborator see the approval notification.

## Out of scope

- Organisation membership / leader-enrolled contributors and automatic
  leader-queue submission — a separate, parked piece of work.
- Email notifications (declined 2026-07-29).
- Real-time collaborative text merge (CRDT/websockets).
- Conflict detection on `parts`/`tools` — not needed; those endpoints are
  additive and don't overwrite.
- Transferring "primary" status to a different collaborator.
