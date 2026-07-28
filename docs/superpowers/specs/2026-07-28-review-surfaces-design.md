# Review Surfaces

**Date:** 2026-07-28
**Status:** Approved design, ready for implementation planning
**Sub-project 2 of 3** from `2026-07-28-contributor-backing-experience-design.md`.
Sub-project 1 is implemented and merged.

## Goal

A leader and an admin can each read a project and act on it from one place, with
the action following the project's state rather than the page they happened to
open.

## Two functional holes, found while preparing a polish pass

This was scoped as a design pass. Auditing the surfaces first turned up two
defects of the same shape — a screen that shows you something and will not let you
act on it — and they are now the spine of the work.

### A leader cannot read a project they are asked to back

`app/organizations/[id]/page.tsx` links each pending request to `/tutorials/[id]`,
which fetches `/api/public/tutorials/:id`, which filters `.eq('status',
'approved')`. A pending project is not approved, so the fetch fails and the page
calls `notFound()`.

The leader gets a **404** on the one thing they must see before deciding. The
premise of accepting — *I read this and I will stand behind it* — is unreachable.

Nothing below the UI is at fault. The leader SELECT grant deliberately covers
`pending` requests, there is a passing test asserting a leader can read an offered
draft, and `GET /api/tutorials/:id` returns 200 for them. The page simply links to
the public view.

**This was seen and hidden.** When the E2E journey's click landed on the 404, the
test was changed to navigate directly to the review URL instead of asking why a
link 404'd. Recorded here because the same reflex would hide the next one.

### An admin cannot act on a bad approval

`/admin/spot-check` links rows to the public tutorial page. `/admin/review` lists
only `?status=pending`. `/admin/review/[id]` refuses anything else outright:
`if (tutorial.status !== 'pending') notFound()`.

So an admin who finds a bad leader approval has **no route in the UI to reject
it**, though the API supports it and an integration test named "an admin can reject
a tutorial a leader already published" passes.

This is the more serious of the two. Decision 14 of the collaboration spec removed
the self-review block on the argument that the controls are reactive and
spot-check is how a bad approval surfaces. Detection was built; the response was
left unreachable. The safety argument fails at its last step.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **One project surface per role, actions follow state** | Fixes both holes by deleting the situation that caused them: there stops being a "read" link that goes somewhere else. It also matches the act — a leader or admin opens a project, reads it, and does the one thing available. |
| 2 | **The leader's page is renamed `/organizations/[id]/projects/[tutorialId]`** | It was `/review/`, and reviewing is now one of three things it does. |
| 3 | **The admin's page is the same shape** | `/admin/review/[id]` gains state-dependent actions rather than a new route. Two roles doing one job should not need two mental models. |
| 4 | **The leader's queue is one ordered list, not two sections** | At this scale a section holding one item is more chrome than content, and the two acts are already distinguished where it matters — on the project page, which offers only the applicable action. |
| 5 | **Unpublishing lands in `rejected`, with a required note** | Uses the existing endpoint unchanged. The contributor sees the note exactly as for any rejection and can edit and resubmit. |
| 6 | **The control is labelled "Unpublish", not "Reject"** | The tutorial was live and a parent may have used it. That is a different act from turning down a submission, even though the resulting state is the same, and the label is the only place that difference can live. |

### A consequence of decision 5, stated rather than discovered

The backing freeze keys on `tutorials.status = 'approved'` and
`reviewed_for_org_id`. Unpublishing moves the status to `rejected`, so the freeze
lifts and the organisation that approved it may withdraw its backing. That is
correct — their name is no longer on published work — and it needs no code.

## §1 The leader's surfaces

### `/organizations/[id]` — the queue

The leader half becomes **one list**, oldest first, each row carrying its state
badge and linking to the project page. The public half (description, leaders,
tutorials backed) is unchanged from sub-project 1.

Empty state, which is the common case for a small clinic and should read as being
up to date rather than as a broken page:

> Nothing waiting. Contributors ask by choosing your organisation when they submit.

The `org_leader_terms` banner stays, and now renders with the `.alert-warning`
treatment that exists as of sub-project 1.

### `/organizations/[id]/projects/[tutorialId]` — the project

Renders the tutorial: title, description, difficulty, photo, and a link to the
PDF. Below it, whichever action applies:

| Backing state | Tutorial state | Actions |
|---|---|---|
| `pending` | any | **Back this project** / **Decline** |
| `accepted` | `pending` | **Approve and publish** / **Reject** (note required) |
| `accepted` | `approved` | None — read-only, showing who approved it and when |
| `declined` | any | None — read-only |

Anyone who does not lead this organisation gets `notFound()`. This is a workspace,
not a public face, and there is nothing here to show them.

## §2 The admin's surfaces

### `/admin/review/[id]` — the project

Drops `if (status !== 'pending') notFound()`. Actions follow state:

| Tutorial state | Actions |
|---|---|
| `pending` | **Approve** / **Reject** (note required) |
| `approved` | **Unpublish** (note required) |
| `rejected` | None — read-only, showing the note |

Where a tutorial was approved by a leader, the page names them and the
organisation, because that is the context an admin needs before overriding it.

**This needs the one API change in this spec.** `GET /api/tutorials/:id` selects
`tutorial_contributors(*, profiles(*))` but nothing for `reviewed_by` or
`reviewed_for_org_id`, so the page has ids and no names. The fix is the embed the
public detail route already uses:

```typescript
'..., reviewer:reviewed_by(name), reviewed_for:reviewed_for_org_id(name)'
```

One line, the same shape as an existing route, and it serves the leader's page
too — which shows who approved a project once it is published. The alternative,
fetching every contributor on the admin page and mapping ids by hand, is worse
work for a worse result.

### `/admin/spot-check`

Rows link to `/admin/review/[id]` instead of the public page, so finding a bad
approval and acting on it are one motion rather than a dead end.

### `/admin/organizations`

- The create form moves behind a disclosure, so the list is what you land on.
- **The N+1 goes.** The page currently issues one request per organisation to
  fetch its leaders (`orgs.map((o) => apiClient.get(...))`). Leaders load for the
  row you open instead.
- Leader pickers become type-to-filter rather than a `<select>` of every
  contributor on the platform.

## §3 What the design pass is for

Three specific problems, not decoration:

1. **Two roles, one job.** A leader and an admin both open a project, read it, and
   act. Those pages should feel like the same page with different authority,
   because that is exactly what they are.
2. **Actions are not equal.** *Decline* sits beside *Back*, and *Unpublish* beside
   nothing at all. Publishing to parents of disabled children, and taking
   something down that they may already be using, deserve weight that a row of
   identical buttons does not give.
3. **The empty queue is the common case.** A small clinic's queue is empty most
   days. It should say so in a way that reads as up to date.

## §4 Tests

Unit tests per surface, following `tests/unit/`:

1. The leader's project page renders **Back / Decline** for a pending request and
   **Approve / Reject** for an accepted one.
2. It is read-only once the tutorial is approved, and names who approved it.
3. A non-leader gets `notFound()`.
4. The leader's queue lists both kinds of waiting work in one list, oldest first.
5. The admin's project page renders **Unpublish** for an approved tutorial —
   the case that previously 404'd.
6. Unpublish requires a note; an empty one does not submit.
7. Spot-check rows link to `/admin/review/[id]`, not to the public page.
8. `/admin/organizations` issues one request for the list, not one per
   organisation.
9. `GET /api/tutorials/:id` returns the reviewer's and the backing organisation's
   name once a tutorial is approved — an integration test, since it is the only
   API change here.

E2E, extending the existing journeys:

10. A leader opens a pending request **from the queue**, reads the tutorial, and
   backs it — the click that used to 404.
11. An admin opens a leader-approved tutorial from spot-check and unpublishes it;
    the contributor then sees the note on their own page.

## Out of scope

- Sub-project 3, notifications. It needs an email provider, a verified sending
  domain and an API key — procurement with a DNS wait that nothing here shortens.
- Any change to the org policies or schema.
- Any API change beyond the reviewer embed named in §2. Both holes are UI-only:
  every *action* this spec exposes already exists and is covered by an integration
  test, including "an admin can reject a tutorial a leader already published". The
  embed adds no capability, only two names the pages already imply.
- The contributor surfaces from sub-project 1, which are done.
