# Reports, exclusion, and closing the design-challenges gaps

**Date:** 2026-08-21
**Status:** Design — authored under owner delegation while they were away
**Follows:** `2026-08-20-design-challenges-design.md`

## Why

The design-challenges feature shipped with removal that does not stick: an author
can remove a participant, and that person can rejoin one click later and read the
whole thread. Removal exists, works, and means nothing — which is worse than not
having it, because it tells an author they have a control they do not.

The owner chose a better shape than the plain block I proposed: **replace the
remove button with a report**. The author describes what happened, the person is
removed, and they cannot return unless an admin puts them back.

That reframing does real work. The author never has to confront anyone — they
tell SPLAT, and removal follows. And the reason gets stored, so a volunteer
reported on three separate challenges is visible as a pattern rather than three
unconnected incidents each handled alone.

## Owner decisions

| Question | Decision |
|---|---|
| Does the reported person see the report text? | **No.** They are told they were removed and that SPLAT has the details. |
| Is the report text mandatory? | **Yes.** (Overrides this author's suggestion of an optional reason picker.) |
| Where do reports go? | **An admin surface**, not a console-only table. |
| Can a volunteer report the author? | **Yes.** |

## Decisions taken under delegation

Every ruling below was made without the owner present. Each names what it costs
if wrong so they can be reversed on sight.

| Decision | Choice | Why / cost if wrong |
|---|---|---|
| Removal mechanism | **Keep the participant row, mark it `removed_at`** rather than deleting it | A deleted row cannot bar a return. Cost: `toy_idea_participants` keeps rows for people no longer in a challenge; every read must filter on `removed_at is null`. |
| Reporting a **participant** | Removes them immediately | Matches the owner's stated flow. |
| Reporting the **author** | Files the report and **removes the reporter**, not the author | An author cannot be evicted from their own idea, and someone uncomfortable enough to report should not be left sitting in the thread. An admin decides what happens to the challenge. Cost: a volunteer who wanted only to flag something also loses access; the report text is where they say so. |
| Reinstatement | **Admin clears `removed_at`** | Matches "not allowed back unless an admin adds them back in". |
| Thread history for new joiners | **A participant sees only messages from `joined_at` onward** | Previously anyone joining read everything said before they arrived. A parent's early detail about their child should not be readable by someone who joins months later. Cost: a maker joining a long-running challenge lacks context and must ask — which puts the parent back in control of what gets re-shared. |
| Report visibility | Author-side reports and volunteer-side reports share one table and one admin queue | Cost: none identified; the admin view groups by reported person so repeat patterns surface. |
| Admin notification | **A dashboard card counting unresolved reports**, no per-report notification | Matches the feature's existing no-noise stance. Cost: a report waits until an admin next opens the dashboard. |

## Schema

### New: `toy_idea_reports`

```sql
create table public.toy_idea_reports (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.toy_ideas on delete cascade,
  reported_profile_id uuid not null references public.profiles on delete cascade,
  reported_by uuid not null references public.profiles on delete cascade,
  -- Mandatory. The owner's call: a report with no account of what happened gives
  -- an admin nothing to act on and no pattern to compare against.
  reason text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles on delete set null,
  resolution_note text
);
```

RLS: insert by the reporter for themselves (`reported_by = auth.uid()`) where they
are the author or a current participant of the idea. **No select policy for
`anon` or `authenticated` at all** — reports are readable through the service role
only, which is what keeps the text away from the person reported. Admin full access.

### Altered: `toy_idea_participants`

```sql
alter table public.toy_idea_participants
  add column removed_at timestamptz,
  add column removed_by uuid references public.profiles on delete set null;
```

Policy changes:
- Join: refuse when a row already exists for that person, removed or not. A removed
  person carries a row, so the primary key alone bars the return — but the policy
  states it explicitly rather than relying on a constraint error.
- Thread read/post: require `removed_at is null`, **and** `toy_idea_messages.created_at >= joined_at`
  for participants. The idea's author is exempt from the time bound.
- Admin clears `removed_at` and `removed_by` to reinstate.

## API

```
POST   /api/ideas/:id/reports        file a report (auth; author or participant)
GET    /api/admin/reports            unresolved first, grouped-friendly
PATCH  /api/admin/reports/:id        resolve, with a resolution note
DELETE /api/admin/ideas/:id/participants/:profileId/removal   reinstate
```

`POST /reports` runs one sequence: insert the report; if the target is a
participant, mark them `removed_at`; if the target is the author, mark the
*reporter* removed instead. Then write a `kind='system'` message and notify the
removed person with the existing `challenge_removed` type. The report text is
never included in the notification or the system message.

## Gap closure

Everything below was raised during the design-challenges run and deferred. All of
it is in scope here.

1. **`idea_graduated` notification.** Graduation currently notifies nobody, so an
   author is silently made primary contributor on a draft they never created.
   Needs a new notification type and a migration.
2. **`PATCH /admin/ideas/:id/status` accepts a `review_note` alongside
   `status: 'challenge'`.** Migration 040's reasoning for leaving `authenticated`
   ungranted-but-unrestricted leans on the UI never doing this. Force
   `review_note` to null when publishing.
3. **The notify allowlist is duplicated** — web derives `SCAFFOLD_KEYS`, the API
   hardcodes `NOTIFY_FEATURE_KEYS`, neither package can import the other. Move the
   list into `@splat-connect/types`.
4. **`/login` ignores `?next=`.** Implement it with a same-origin guard rejecting
   anything with a scheme, a protocol-relative `//` prefix, or a backslash.
   Restore the CTA on `/get-involved/submit-an-idea`.
5. **`dashboard/exchanges/[id]/page.tsx:30`** matches `/status 404/` against an
   error message. `isApiError` now exists; use it.
6. **`PATCH /admin/ideas/:id/status` is read-then-act.** Make it a conditional
   update, matching the compare-and-swap already used by graduate.
7. **Scope-exclusion copy** on `/get-involved/submit-an-idea` — drafted below,
   still flagged for owner sign-off before public launch.
8. Minors: `graduated` rows sitting under an "Open challenges" heading; notification
   insert errors checked in one place and discarded in two others; `contact_prefs`
   and `created_at` selected but never rendered; the two admin pages handling fetch
   failure differently; no length bound on the five narrative fields.

## Scope exclusions — drafted, still requires owner sign-off

Rendered above the form. Written to be read by a worried parent, not a lawyer.

> **What we cannot take on**
>
> SPLAT volunteers adapt battery-powered toys so a child can work them with a
> switch. Some things are outside what we can safely ask a volunteer to build:
>
> - Anything that holds a child's weight or position — seating, standing frames,
>   harnesses, straps.
> - Anything that plugs into the mains. Battery-powered toys only.
> - Anything a child could get into their mouth, or that comes apart into pieces
>   that size.
> - Anything medical, or that a child relies on to communicate, call for help, or
>   stay safe. If it has to work every time, it is not a job for a volunteer.
> - Anything needing tools or skills beyond the ones on our
>   [tools and materials](/learn/tools-and-materials) page.
>
> Not sure which side of the line your idea falls on? Send it anyway and we will
> tell you.

## Testing

| Layer | Coverage |
|---|---|
| Migration | A removed participant cannot rejoin. A participant cannot read messages predating `joined_at`; the author can. `toy_idea_reports` is unreadable by `anon` and by a non-admin `authenticated` user, including the person reported. |
| API unit | Report text is required. Reporting the author removes the reporter, not the author. A non-participant cannot report. |
| API integration | The full report flow: file, remove, notify, and the reported person's subsequent join attempt fails. Admin reinstatement restores access. |
| Web unit | The report dialog requires text. The reported person never sees report text anywhere. Admin queue shows unresolved first. |
| E2E | The navigation placeholder guard stays green. |

## Non-goals

- No platform-wide ban. A report is scoped to one challenge; repeated reports are
  a signal an admin acts on manually.
- No appeal flow. Reinstatement is an admin action, not a request queue.
- No editing or deleting a filed report. Resolution carries a note instead.
- No notification to admins per report — the dashboard card is the surface.
