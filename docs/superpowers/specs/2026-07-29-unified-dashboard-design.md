# Unified Dashboard

**Date:** 2026-07-29
**Status:** Approved design, ready for implementation planning
**Sub-project 3 of 3.** Depends on `2026-07-29-shared-account-foundation-design.md`
and `2026-07-29-auth-entry-flow-design.md`, both of which ship first.

## Goal

One dashboard for every non-admin account, with tabs that appear according to what
the user can actually do. A contributor uploads tutorials, a parent edits their
child's profile, a leader vets tutorials offered to their organisation, and
everyone can edit their own profile — all from the same place, with no role
declared anywhere.

## What already exists

Three of the four tabs are largely built. Establishing that changed the size of
this work substantially, so it is recorded here rather than rediscovered.

**The leader vetting interface is complete.** `app/organizations/[id]/page.tsx` —
its own header calls it *"Organisation Leader Dashboard"* — renders one queue of
everything waiting on the organisation, backing requests and review requests
together, oldest first. Accept/reject runs through `POST /api/tutorials/:id/review`
(`tutorials.ts:122`), the terms gate is `components/org-review-banner.tsx`, the
review screen is `organizations/[id]/projects/[tutorialId]/page.tsx`, and the RLS
leader UPDATE grant is in 007. The dashboard already links to it
(`dashboard/page.tsx:161-177`).

Nothing about a leader's authority changes here. Decisions 11 and 12 of the
organisations design — only an admin renames, suspends or deletes an organisation,
and only an admin grants leadership — are untouched. This is a vetting queue moving
from a link to a tab.

**The child profile API is complete.** `GET` and `PUT /api/child-profile` exist and
back the mobile app. Only a web interface is missing.

**The contributor dashboard is the current `/dashboard`.**

The genuinely new code is: the tab shell, a web child-profile form, and one
profile-update endpoint.

## Decisions

**1. Tabs are routes, not client state.** `/dashboard`, `/dashboard/organisation`,
`/dashboard/child`, `/dashboard/profile`, sharing a `layout.tsx` that renders the
tab strip. Server components keep working, each tab is linkable and back-button
correct, and each page re-derives its own access rather than trusting the shell.

**2. The tab strip is an affordance; each page is its own control.** The layout
hides tabs the user cannot use, and each page independently checks and 404s. This
is the pattern `lib/org-access.ts` already states: *"An affordance, not a control:
the database refuses a non-leader's writes whatever this returns."*

**3. Tutorials is the index tab, shown to everyone.** After sub-project 1 every
signed-in user can author, so there is no one to hide it from. A user who has never
uploaded gets the existing empty state, which already explains what a tutorial is
and offers the upload button.

**4. Child profile is shown to everyone, not only to existing parents.** Gating it
on `isParent` would mean the only way to create a child profile is to already have
one. Someone who has not made one sees an empty state offering to start; filling it
in is what makes them a parent. This is the derived-capability model made visible —
and it avoids repeating the defect `2026-07-28-review-surfaces-design.md` was
written to fix, where a capability existed with no reachable route to it.

**5. Organisation is shown only to leaders.** Unlike the child profile, leadership
cannot be self-started — an admin grants it (decision 12). An empty state would
offer something the visitor cannot obtain, so the tab is hidden when `ledOrgs` is
empty.

**6. The organisation tab is one merged queue across every organisation the user
leads — no organisation picker.** `GET /api/tutorials` is already scoped by the
leader read grant. `organizations/[id]/page.tsx` says so: *"Both come from
`GET /api/tutorials` with no filter for safety: the leader read grant in 007 already
limits that list to projects offered to an organisation the caller leads. The
filtering here only splits the two lists."* The per-organisation page narrows that
list back down client-side, which is the only reason it needs an id in the URL.
The tab drops the narrowing and adds an organisation badge per row. It is less code
than the page it generalises, and it behaves identically for one organisation or
four.

`/organizations/[id]` survives unchanged as the per-organisation deep link and as
the public directory's destination.

**7. The profile tab edits `name` only.** `email` is displayed read-only — it
mirrors `auth.users` and is frozen by the 009 trigger; changing it is a Supabase
auth flow that does not exist here. `role` is not editable by anyone but an admin,
also enforced by that trigger.

**8. The child-profile web form saves explicitly; it does not autosave.** Mobile
autosaves with a saved indicator (commit `f15f6b7`) because a phone can be
backgrounded mid-edit. A browser form has no such problem, and an explicit save is
less machinery. The endpoint is the same `PUT`, which is already an upsert.

**9. The nav collapses.** With Upload and My Tutorials reachable as dashboard
tabs, keeping them as nav links duplicates the same destinations. Signed-in nav
becomes Library, Dashboard, Organisations (the public directory), and Admin for
admins. This supersedes the interim widening made in sub-project 2.

## Architecture

```
app/dashboard/
  layout.tsx              tab strip, from getCapabilities()
  page.tsx                Tutorials  — the existing dashboard body
  organisation/page.tsx   Organisation — merged leader queue
  child/page.tsx          Child profile — new web form
  profile/page.tsx        Profile — name + read-only email
```

| Tab | Shown when | Data source | New? |
|---|---|---|---|
| Tutorials | always | `GET /api/tutorials/mine` | no — moved |
| Organisation | `ledOrgs.length > 0` | `GET /api/tutorials`, unfiltered | mostly no — generalised |
| Child profile | always | `GET`/`PUT /api/child-profile` | web UI only |
| Profile | always | `GET`/`PATCH /api/contributors/me` | endpoint + UI |

### New API: `PATCH /api/contributors/me`

Follows the whitelist idiom `child-profile.ts:27` already establishes:

```ts
const EDITABLE = ['name'] as const
```

Everything else in the body is ignored. Writes go through `createUserClient` so the
`"User can update own profile"` policy and the 009 freeze trigger are the real
boundary, matching how every other write route in this codebase is built.

### The child-profile web form

The mobile form is three screens plus a hub —
`packages/mobile/components/profile/{ability,everyday-needs,customization}-screen.tsx`
and `child-profile-home.tsx`. React Native components cannot be reused, so this is a
genuine re-implementation against the same `PUT` contract and the same
`ChildProfile` type in `packages/types`.

It is the largest single piece of this sub-project. The three groupings —
Ability Profile, Everyday Needs, Customization Metrics — are already the column
groupings in `003_ability_profile.sql:30-55` and should be the sections on web,
so the two clients stay legible against one schema.

The MACS/BFMF estimator that mobile offers behind *"Answer a few simple questions
instead"* (`ability-screen.tsx:117`) is **not** ported. Web enters the values
directly; `macs_source`/`bfmf_source` stay `'manual'`. Adding the estimator later
is additive and needs no schema change.

### Changes to existing files

| File | Change |
|---|---|
| `app/dashboard/page.tsx` | body becomes the Tutorials tab; the "Organisations you lead" block (161-177) is removed, superseded by the tab |
| `app/organizations/[id]/page.tsx` | unchanged — still the per-org deep link |
| `components/nav.tsx` | link list collapses (decision 9) |
| `app/upload`, `app/my-tutorials` | unchanged as routes; reached from the Tutorials tab |

## Data flow

`layout.tsx` calls `getCapabilities()` (sub-project 1) once per render pass and
renders the permitted tabs. Each page calls it again — deduplicated by React
`cache()`, so no extra fetches — and 404s if the capability it needs is absent.

## Error handling

A tab whose data fetch fails renders that tab's error state; it does not fail the
shell, so the other tabs stay reachable. This follows the retry pattern established
on mobile in `6bb6a7b` rather than inventing a second one.

An organisation queue that is empty is a success state, not an error: a leader with
nothing waiting sees "Nothing waiting on you right now."

A suspended organisation keeps the wording already used at
`dashboard/page.tsx:169-171` — *"Suspended — you can look, but not approve"* — and
its rows render without action buttons. The database refuses those writes
regardless.

## Testing

**E2E:**
- A contributor sees Tutorials, Child profile, Profile — and no Organisation tab.
- A leader sees all four, and the Organisation tab lists work across *two*
  organisations they lead without a picker. This is the assertion that pins
  decision 6; a single-organisation test would pass either way.
- A leader accepts a backing request and approves a tutorial from the tab, reaching
  the existing review screen.
- A contributor with no child profile creates one from the Child profile tab and it
  persists — the path decision 4 exists to keep open.
- A user renames themselves on the Profile tab and the nav reflects it.
- A parent registered on mobile signs in on web and uploads a tutorial. This is the
  end-to-end proof of the whole three-part redesign; it fails today at the RLS
  layer, not the UI.

**Integration:**
- `PATCH /api/contributors/me` updates `name`.
- `PATCH /api/contributors/me` ignores `role` and `email` in the body.
- A caller cannot PATCH another user's profile.

**Unit:**
- The tab strip renders exactly the tabs a given capability set permits.
- `/dashboard/organisation` 404s for a non-leader.
- The merged queue groups rows under the right organisation badge.
- The child-profile form maps every column group in `ChildProfile` to a field.

## Out of scope

- **Leaders editing organisation metadata.** Decisions 11 and 12 stand. This tab
  vets tutorials; it does not rename, suspend, or change leadership.
- **The admin experience.** Admins keep `/admin`. Nothing here changes it.
- **The MACS/BFMF estimator on web** (see above).
- **Multi-child support.** `child_profiles.parent_id` remains unique.
- **Mobile.** No change. It keeps its own screens and its autosave.
- **A parent-specific tutorial browsing experience.** The library is already public
  and serves this.
