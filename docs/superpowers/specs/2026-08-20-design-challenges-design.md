# Design challenges: ideas, collaboration, and graduation to a guide

**Date:** 2026-08-20
**Status:** Design, awaiting review
**Scope:** `/get-involved/submit-an-idea`, `/get-involved/design-challenges`,
a new `/dashboard/challenges`, a new `/admin/ideas` queue, and the API and
schema behind them.

## Why

`/get-involved/submit-an-idea` is marked `state: 'live'` in
`lib/public-nav.ts` but captures nothing. It is prose describing a four-step
process that ends at a `/contact` link, and it already links onward to
`/get-involved/design-challenges`, which is a `ComingSoon` placeholder. A page
with "submit" in its name has no storage behind it, and points at an empty room.

The placeholder's own copy already describes the system this spec builds:

> A family or therapist posts a problem with no known solution → Anyone can work
> on it, alone or together, and share attempts → A working answer becomes a
> guide in the library.

## Prior art: Makers Making Change

Makers Making Change (a Neil Squire Society program) runs this exact pipeline
and has for ten years. Measured from their public sitemap on 2026-08-20: 65
public ideas, 40 device requests, 1,204 events, 251 library devices. Their
documented flow, from `/how-it-works/submit-an-idea` and
`/how-it-works/design-challenges`:

1. Check the library — does it already exist?
2. Confirm the idea fits published scope guidelines.
3. **Create an account.**
4. Submit the idea with a defined field set.
5. **The MMC team reviews it** — accepted as a Design Challenge (published
   publicly) or rejected.
6. Volunteers browse challenges and **"Join Design Challenge"**. The creator is
   notified. *A single challenge may have multiple volunteers.* Collaboration
   happens in **a chat at the bottom of the challenge page**, self-directed,
   with no guaranteed outcome.

Two departures from MMC, both deliberate, both recorded in Decisions below:
joining is self-serve here as it is there, but the author may remove a
participant; and there are no per-message notifications.

## Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Who reviews an idea | **Admins only** | `is_admin()` already gates the tutorial review path. Org-leader review needs a scoping rule ideas do not carry at submission; not worth inventing now. |
| Who graduates a challenge | **Admins only** | One gate on what enters the library, consistent with review. |
| Joining a challenge | **Self-serve**, author or admin may remove | Matches MMC. Low friction is what gets challenges moving. `collaborator_removed` precedent already exists. |
| Notifications | join / leave / remove / approve / reject — **not per-message** | Exchanges shipped thread-only, with inbox badges cut on purpose. A per-message notification on a self-serve-join thread is the fastest route to people muting SPLAT. Easy to add later; hard to walk back. |
| Idea intake fields | **Follow MMC's form** | Their field set does real work, especially the contact-preference field. |
| Challenge as a record | **New `toy_ideas` table**, graduating into a `tutorial` | Intake fields (primary user, intended use, contact preference) genuinely differ from a tutorial's. Collaboration and review reuse existing patterns. |

## Reuse before building

- **`exchange-chat.tsx`** already owns only messages and the composer — it was
  split out of `toy-transaction-thread.tsx` for exactly this kind of reuse. Its
  one coupling is the `ToyTransactionMessage` type. Widen that parameter to the
  structural minimum (`id`, `sender_id`, `kind`, `body`, `created_at`); do not
  write a second chat component and do not introduce a generic abstraction.
- **`toy_transaction_messages` (026, realtime in 031)** is the thread shape being
  copied, including `kind: 'system' | 'user'`.
- **`GET /admin/tutorials` + `PATCH /admin/tutorials/:id/status`** is the review
  queue pattern; `/admin/review` + `/admin/review/[id]` is its UI.
- **`/dashboard/exchanges`** is the list-then-thread shape `/dashboard/challenges`
  copies.
- **`tutorial_contributors`** already stores `primary` / `collaborator` — the
  shape graduation writes into.
- **`lib/public-nav.ts`** is the single source of truth for public routes.

## Schema

### New: `toy_ideas`

```sql
create table public.toy_ideas (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles on delete cascade,
  title text not null,
  summary text not null,
  description text not null,
  intended_use text not null,
  primary_user text not null,
  -- How involved the author wants to be, declared upfront so a maker knows
  -- before joining whether there is a person to collaborate with or just a brief.
  contact_prefs text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending','challenge','rejected','graduated')),
  review_note text,
  tutorial_id uuid references public.tutorials on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`contact_prefs` values are `clarification`, `co_design`, `user_testing`,
validated in the API rather than by a DB constraint — the set is presentational
and will change more often than the schema should.

### New: `toy_idea_participants`

```sql
create table public.toy_idea_participants (
  idea_id uuid references public.toy_ideas on delete cascade,
  profile_id uuid references public.profiles on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (idea_id, profile_id)
);
```

Not derived from message senders: joining is an explicit act that fires a
notification and must be revocable independently of what someone has written.

### New: `toy_idea_messages`

```sql
create table public.toy_idea_messages (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.toy_ideas on delete cascade,
  sender_id uuid not null references public.profiles,
  kind text not null default 'user' check (kind in ('system','user')),
  body text not null,
  created_at timestamptz not null default now()
);

alter publication supabase_realtime add table public.toy_idea_messages;
```

Realtime carries no new policy, for the reason 031 records: `postgres_changes`
runs each subscriber's stream through the table's existing RLS.

### Altered: `notifications`

**Corrected 2026-08-20 during implementation.** This section originally claimed
`notifications.tutorial_id` was `not null`, so nothing but a tutorial could raise
a notification. That was wrong. Migration `027_toy_transaction_notifications.sql`
already dropped that NOT NULL and added a second subject column,
`toy_transaction_id` — multi-subject notifications were already a solved problem
here, and the five `toy_*` types it added are live and actively written by
`routes/toy-transactions.ts`.

What this migration actually needs to do is narrower: add `idea_id`, and grow the
type list from 12 values to 17.

```sql
alter table public.notifications
  add column idea_id uuid references public.toy_ideas on delete cascade;

-- All three subject columns, not two: toy_transaction_id came with 027.
alter table public.notifications add constraint notifications_one_subject
  check (num_nonnulls(tutorial_id, idea_id, toy_transaction_id) = 1);
```

The `type` check is dropped and recreated with all 12 existing values plus
`idea_approved`, `idea_rejected`, `challenge_joined`, `challenge_left`,
`challenge_removed`. **Recreating it from an incomplete list would silently drop
027's `toy_*` types and break every toy-transaction notification.**

**`notifications_one_subject` is the one change in this feature that can fail on a
production push.** `ADD CONSTRAINT` validates every existing row, and nothing has
ever enforced this rule. Run this first:

```sql
select count(*) from public.notifications
where num_nonnulls(tutorial_id, idea_id, toy_transaction_id) <> 1;
```

A non-zero count must be resolved before pushing. The failure mode is safe — the
push aborts with a check violation and changes nothing — but it will abort.

## RLS

The governing rule: **a `pending` idea must never be publicly readable.** It
contains a description of a specific disabled child's functional needs, written
before anyone reviewed it for identifying detail.

| Table | Policy |
|---|---|
| `toy_ideas` | `anon`/`authenticated` select where `status in ('challenge','graduated')`. Author selects their own at any status. Author inserts (`author_id = auth.uid()`). Author updates only while `status = 'pending'`. Admin full access. |
| `toy_idea_participants` | Select where the parent idea is publicly readable, or by the author. Insert by the joining user for themselves, only where the idea is `status = 'challenge'`. Delete by self (leave), the idea's author, or admin. |
| `toy_idea_messages` | Select and insert by the idea's author and its participants only. Never anon — the thread is not public even when the challenge is. Admin full access. |

The thread being private on a public challenge is deliberate: the brief recruits,
the conversation does not need an audience.

## System messages

A join, leave or removal writes a `kind='system'` row into the thread
("Priya joined this challenge"). This answers "how does the author know someone
is on their case" with the mechanism that already exists rather than a new one,
and leaves a readable in-order history of who came and went alongside the
conversation. The matching `notifications` row is written in the same handler.

## API

Following existing route-file conventions.

```
POST   /ideas                              submit (auth)
GET    /ideas/mine                          author's own, any status
GET    /public/challenges                   published listing (anon)
GET    /public/challenges/:id               published detail (anon)
POST   /ideas/:id/join                      self-serve (auth)
DELETE /ideas/:id/participants/:profileId   author or admin
GET    /ideas/:id/messages                  author + participants
POST   /ideas/:id/messages
GET    /admin/ideas                         queue
PATCH  /admin/ideas/:id/status              approve / reject
POST   /admin/ideas/:id/graduate            creates the draft tutorial
```

### Review

`PATCH /admin/ideas/:id/status` takes `{ status: 'challenge' | 'rejected', review_note?: string }`.
`review_note` is stored on the idea and shown to the author on
`/dashboard/challenges` — a rejection with no reason is the thing that stops
people submitting again. It is never shown publicly.

### Graduation

`POST /admin/ideas/:id/graduate` runs one transaction:

1. Insert a `tutorials` row with `status='draft'`, seeded from the idea's title
   and summary.
2. Insert `tutorial_contributors`: the idea's author as `primary`, every
   participant as `collaborator`.
3. Set `toy_ideas.tutorial_id` and `status='graduated'`.
4. Write a system message and notify author and participants.

The draft still cannot reach the public library without passing the existing
tutorial `pending` → `approved` review, so graduation adds no new publication gate.

## Web surfaces

| Route | Change |
|---|---|
| `/get-involved/submit-an-idea` | Keep the existing prose as the how-it-works content; add the form below it. Signed out shows a sign-in CTA, not the form. |
| `/get-involved/design-challenges` | `ComingSoon` → listing of `status='challenge'` ideas. `state: 'soon'` → `'live'` in `public-nav.ts`; `design-challenges` leaves `SCAFFOLD_KEYS`. |
| `/get-involved/design-challenges/[id]` | New. Brief, participants, Join button, thread (thread visible to author and participants only). |
| `/dashboard/challenges` | New. Mirrors `/dashboard/exchanges`: your submitted ideas at any status, plus challenges you joined. |
| `/admin/ideas`, `/admin/ideas/[id]` | New. Mirrors `/admin/review` and `/admin/review/[id]`. |

### Scope boundary

This spec deliberately crosses the boundary drawn by
`2026-08-19-public-site-scaffold-design.md` and `2026-08-20-playroom-public-site-design.md`,
which put everything inside `AppShell` out of scope. A submit flow with no
author-side view is useless, so the dashboard and admin surfaces are in scope
here. This is not a public-site task and must not be planned as one.

## Scope exclusions — DRAFT, requires sign-off

Published above the form on `/get-involved/submit-an-idea`, in the manner MMC
publishes theirs. **These are a safety judgement and need the project owner's
correction before implementation.** Starting list:

- Nothing load-bearing, and nothing that supports a child's body weight or position.
- Nothing that modifies a mains-powered toy or appliance. Battery-powered only.
- No part small enough to be swallowed by the intended user.
- Nothing medical, and nothing a child depends on for communication, alerting or
  safety.
- Nothing beyond what a volunteer can reasonably build with the tools listed on
  `/learn/tools-and-materials`.

## Follow-up: the notify allowlist is duplicated across packages

`packages/web/lib/public-nav.ts` *derives* `SCAFFOLD_KEYS` from the nav data, so
flipping an item to `live` updates it automatically. `packages/api/src/routes/public.ts`
hardcodes the same list as a `NOTIFY_FEATURE_KEYS` Set. The two cannot import from
one another — neither package depends on the other, both depend only on
`@splat-connect/types`.

So every future scaffold flip (`requests`, `ask-an-expert`, `news`, `events`,
`map`, `partners`, `support`, the two `printing` routes) has to remember to edit
the API's Set by hand, and nothing fails if it is forgotten — the endpoint simply
keeps accepting interest registrations for a feature that already shipped.

**The fix, when someone touches this next:** move the key list into
`@splat-connect/types` and have both sides read it, so the allowlist and the nav
cannot disagree. Not done here because it widens a task about one page into a
cross-package refactor.

## Follow-up: `/login` does not honour `?next=`

`app/login/page.tsx` ends with a hard
`window.location.href = profile?.role === 'admin' ? '/admin' : '/dashboard'`,
deliberately — its comment records that `router.refresh()` was not awaitable and
left the nav showing a logged-out state. It never reads `?next=`.

`app/onboarding/contributor-terms/page.tsx` documents the convention ("passes the
path the user was blocked from as `?next=`"), so the idea exists in this codebase
but the login page does not implement it.

The signed-out CTA on `/get-involved/submit-an-idea` therefore links to plain
`/login`: a parameter that silently does nothing is worse than no parameter,
because it reads as implemented.

**If you add `next` handling to login, it needs an open-redirect guard.** Accepting
an arbitrary `next` and assigning it to `window.location.href` would let
`/login?next=https://evil.example` send a freshly-authenticated user off-site.
Restrict it to same-origin relative paths — reject anything starting with `//`, a
scheme, or a backslash — and prefer an allowlist of known routes. That is a
security-sensitive change to shared auth used by every signed-in flow, which is
why it is not bundled into this feature.

## Testing

| Layer | Coverage |
|---|---|
| Migration | `toy_ideas` RLS: anon cannot select a `pending` row; can select a `challenge` row. `notifications_one_subject` rejects both-null and both-set. |
| API unit | Submit validates required fields and `contact_prefs` values. Join is rejected when the idea is not `status='challenge'`. Remove is rejected for a non-author non-admin. Messages are rejected for a non-participant. |
| API integration | Graduation writes the tutorial, both contributor rows, the status change and the notifications in one transaction, and is idempotent-safe (a second call on a `graduated` idea 409s). |
| Web unit | The listing renders only published challenges. The detail page hides the thread from a non-participant. Signed-out submit shows the CTA, not the form. |
| E2E | `tests/e2e/public/navigation.spec.ts` already asserts no top-level nav link is a placeholder — flipping `design-challenges` to `'live'` must keep that spec green. |

## Non-goals

- No per-message notifications (see Decisions).
- No idea editing after review. A rejected idea is resubmitted, not amended.

  **If you ever add a resubmit-in-place or reopen-for-review flow, read this
  first.** `PATCH /admin/ideas/:id/status` writes `review_note` unconditionally,
  nulling it whenever the request body omits one. That is safe today only because
  nothing can move a row back to `pending`: the handler is scoped to
  `.eq('status','pending')`, 037's author UPDATE policy requires `status =
  'pending'` in both `using` and `with check`, and no other route writes
  `toy_ideas.status`. A `rejected` → `pending` transition would make approving an
  idea silently destroy the reviewer's note. Fix the handler in the same change.
- No public thread. No participant cap. No challenge search or filtering beyond
  the listing's own ordering.
- No org-leader review path.
- `/get-involved/requests` (adaptation requests) is a separate, larger system and
  is untouched here, as are all `/printing/*` routes.
