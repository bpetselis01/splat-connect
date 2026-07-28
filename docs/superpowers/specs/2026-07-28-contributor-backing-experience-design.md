# Contributor Backing Experience

**Date:** 2026-07-28
**Status:** Approved design, ready for implementation planning
**Builds on:** `2026-07-28-project-org-collaboration-design.md`, implemented and merged
as `4660e8c`

## Goal

A contributor who asks organisations to back their project can see what happened,
withdraw a request, ask someone else, and find out what an organisation is before
choosing it.

Today they can do none of that. This spec closes the gap and applies a design pass
to the surfaces it touches.

## The audit that prompted this

Every capability was traced from API endpoint to reachable UI:

**Reachable.** The admin side is complete — the `/admin` hub links to organisation
management (create, appoint and remove leaders, suspend) and to spot-check, and the
review queue shows backing state with a hide filter. The leader side works but is
buried: `/org/[orgId]` is reachable only from a section near the bottom of
`/dashboard`, with no navigation entry anywhere.

**Not reachable.** The contributor side barely exists. They can tick organisations
at step 6 of the upload wizard, and after that the feature disappears:

| Capability | Endpoint | UI |
|---|---|---|
| See who accepted, declined, or is deciding | `GET /api/tutorials/:id/orgs` | none |
| Withdraw a request | `DELETE /api/tutorials/:id/orgs/:orgId` | no caller anywhere |
| Ask an organisation after submitting | `POST /api/tutorials/:id/orgs` | wizard only |
| Read about an organisation | `GET /api/organizations/:id` | no caller |

`/dashboard`, `/my-tutorials` and the library card contain zero references to
`tutorial_orgs`. An author starts a two-sided handshake and never learns its
outcome.

There is also a dead route: `/organizations` was added to the middleware's
protected list and no page was ever built at it.

## Decomposition

The full request covers three sub-projects. **This spec is the first only.**

1. **Contributor backing experience** — this document. Depends on nothing.
2. **Review surfaces** — the leader dashboard, review screen, admin organisation
   page and spot-check, designed rather than merely correct. Shares components with
   this one, so it is cheaper second.
3. **Notifications** — email on accept, decline and review. There is currently *no*
   mail infrastructure: no dependency in the API, SMTP commented out in
   `supabase/config.toml`, no edge functions. Signup confirmation runs on Supabase's
   built-in auth mailer, which is auth-only and rate-limited, so this needs a
   provider, a verified sending domain, templates, failure handling, preferences and
   unsubscribe. It also needs a decision about what may appear in an email
   concerning assistive equipment for a named child. Its own spec.

Order matters: 3 links into surfaces 1 and 2 build, and an email pointing at a page
that does not exist is worse than no email.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **Backing is project state for contributors, a workspace for leaders** | The feature's own framing is "a tutorial is a project; its author asks organisations to back it". The unit a contributor thinks about is their project. Making them navigate to an organisation to learn what happened to their spoon holder inverts that. A leader's job *is* the organisation, so for them it is a real place. |
| 2 | **Backing controls live on `/tutorials/[id]/edit`** | Already the contributor's manage-this-project surface, already section-based (Files, Parts, Tools). No new route. |
| 3 | **`/org/[orgId]` is consolidated into `/organizations/[id]`** | Two routes for one entity — a public face and a leader workspace — will confuse everyone. One route: anyone sees the organisation, and if you lead it the same page carries your requests and review queue. Leadership becomes something the page reveals rather than a separate address. |
| 4 | **An organisation browse and detail page is built** | A contributor choosing between clinics needs more than a name, and a parent seeing "Riverside Therapy backed this" needs somewhere for that name to mean something. Uses two endpoints that currently have no caller. |
| 5 | **Awareness is out of scope, and named as unsolved** | Everything here is visible when a contributor looks. Someone who submits and does not return learns nothing. That is sub-project 3 and this spec does not pretend otherwise. |
| 6 | **No in-app notification counts or badges** | Rejected in favour of real notifications (decision 5). Building attention markers now would be work thrown away when email lands, and would make the gap *look* solved while leaving it open. |

## §1 Vocabulary

Every screen currently invents its own wording. One vocabulary, always from the
contributor's point of view, because they are the one waiting:

| State | Copy |
|---|---|
| `pending` | "Riverside Therapy is deciding" |
| `accepted` | "Backed by Riverside Therapy" |
| `declined` | "Riverside Therapy declined" |
| no rows | "Reviewed by SPLAT" |

The last is deliberately not "no organisation". It is a normal, complete path —
the one every contributor took before organisations existed — and phrasing it as an
absence makes the default feel like a failure.

Multiple organisations collapse naturally: "Backed by Riverside Therapy and
Northside Clinic", "2 organisations deciding".

## §2 Backing on `/tutorials/[id]/edit`

A fourth section beside Files, Parts and Tools. One row per organisation, carrying
its state and:

- **Withdraw**, on any row not yet acted on. Where the API would refuse, the control
  is disabled *with its reason* rather than hidden: "Riverside approved this.
  Withdrawing means asking SPLAT to unpublish it." A hidden control teaches nothing.
- **Ask another organisation** — a picker of organisations not already asked, each
  with its description inline, so the decision is made with the information rather
  than after going to find it.
- The draft-exposure disclosure, in full: *"Their leaders can read this while they
  decide, including if they say no."*

**Read-only once the tutorial is approved.** Every action is already forbidden by
policy — you cannot add backing to published work, and you cannot withdraw the
organisation that approved it — so the section renders as history with nothing to
click.

That read-only rule also resolves a hazard worth stating: editing an approved
tutorial resets it to `pending` (pinned by an existing E2E test). Putting backing
controls on the edit page would otherwise mean someone who came only to withdraw a
request is one stray keystroke from unpublishing their own work. The two dangerous
states never coexist.

## §3 `/my-tutorials` and `/dashboard`

Each row gains one line of backing state beneath the title, using §1's vocabulary.
Nothing interactive: a row's job is to tell you whether it is worth clicking.

The dashboard's "Recent tutorials" gets the same line. "Organisations you lead"
stays as it is — it is sub-project 2's to redesign.

## §4 `/organizations` and `/organizations/[id]`

**List** — name, description, leader count. Suspended organisations appear, marked,
rather than vanishing; an organisation disappearing from a directory is
unexplainable to someone who expected it.

**Detail** — description, who leads it, and the published tutorials it has backed.
That last is the honest measure of an organisation and needs no new endpoint.

**Consolidation (decision 3).** `/org/[orgId]` and `/org/[orgId]/review/[tutorialId]`
move under `/organizations/`. On the detail page, a leader of that organisation
additionally sees their incoming requests and review queue. `requireOrgLeader` stops
being a redirect guard on the whole page and becomes a check on which parts render —
a non-leader gets the public view rather than a bounce to `/`.

The middleware entry for `/organizations` becomes real instead of dead; `/org` is
removed from the protected list.

## §5 Library card

The card gains the backing badge — accepted organisations only, matching the public
tutorial page. It is the only place a parent browsing sees it before committing to a
click, and for them it is the whole point of the feature.

**This needs one API change**, and it is the only one in this spec.
`GET /api/public/tutorials` — which `/library` and the home page both read — selects
`*` and carries no backing. Only the *detail* endpoint was given the embed when the
feature was built. The list endpoint gets the same treatment:

```typescript
.select('*, tutorial_orgs(status, organizations(id, name))')
```

filtered to `accepted` in the handler for the same reason the detail endpoint is:
PostgREST cannot constrain an embedded relation from the parent query, and this
route uses the admin client, so the public RLS badge policy is not doing it for us.

The alternative — fetching backing per card — is a request per tutorial on the
busiest page on the site, and is not worth considering.

## §6 What the design pass is for

Three specific problems, not decoration:

1. **State legibility.** Three states across five surfaces render as plain text
   today. "Waiting on someone else" and "you need to act" look identical, and they
   are the two things a contributor most needs to tell apart at a glance.
2. **The edit page becomes four sections deep** with no hierarchy. Adding a fourth
   to a page that has none makes it a wall.
3. **The disclosure copy.** "Their leaders can read this while they decide" is the
   most consequential sentence in the feature — it is the contributor's only warning
   that offering a project exposes unpublished work. It currently appears once, in
   small grey text, in a wizard step.

## §7 Tests

Unit tests follow the existing `tests/unit/` pattern, one file per surface:

1. Each backing state renders its §1 copy, and a tutorial with no rows reads
   "Reviewed by SPLAT" rather than an absence.
2. Withdraw is offered on a pending row, and disabled *with its reason* on the
   organisation that approved a published tutorial.
3. The backing section is entirely read-only when the tutorial is `approved`.
4. The "ask another organisation" picker excludes organisations already asked.
5. `/organizations` lists suspended organisations, marked.
6. `/organizations/[id]` shows the requests and review queue to a leader of that
   organisation, and shows neither to anyone else — without redirecting them.
7. The library card renders accepted backing only; pending and declined never
   appear.
8. `GET /api/public/tutorials` returns accepted backing on each row and omits
   pending and declined — an integration test, since it is the one API change here
   and it is public-facing.

One E2E addition to the existing `org-backing` journey: after the leader declines,
the contributor sees "declined" on their own page and can ask a different
organisation. That is the loop this spec exists to close, and it is currently
untestable because the screens do not exist.

## Out of scope

- Sub-projects 2 and 3 above.
- In-app notification counts, unread markers or badges (decision 6).
- Any change to the org policies or schema.
- Any API change beyond the one named in §5. Every other endpoint this spec needs
  already exists and is tested; `/organizations/[id]`'s "tutorials this organisation
  backed" is derived by filtering `GET /api/tutorials`, whose response already
  embeds `tutorial_orgs`, rather than by adding a query.
- The leader dashboard's *content* — this spec moves it to a new address and leaves
  its design to sub-project 2.
