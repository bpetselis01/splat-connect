# Editing a posted event or story

Pending id `edit-event-story`. Planned and built 2026-10-19 without review stops (Byron: "continue the remaining work as independently as possible").

## Problem

Once an event or story is saved, a leader cannot open it again — on web or the phone. A typo or a moved start time means removing it (losing its registrations) and posting it again. Drafts are worse off: EventForm promises "come back for the bench list later", and there is nowhere to come back to.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| R1 | A leader can open any of their events (draft or published) in the same form it was written in, with every field filled, and save it | Must |
| R2 | Same for stories | Must |
| R3 | Saving a published item keeps it published (one "Save changes" button); a draft keeps "Save as draft" / "Publish" | Must |
| R4 | Times reopen as the host's own clock, not UTC | Must |
| R5 | Editing an event keeps its registrations and the answers to questions that survive the edit | Must |
| R6 | A story's consent box starts unticked on every edit; publishing (or saving a published story) needs a fresh tick | Must |
| R7 | Editing a published story does not re-date it; the draft → published edge still notifies followers once | Must |
| R8 | Both platforms, same behaviour (web + mobile parity) | Must |

## Decisions

| Decision | Chosen | Why | Rejected |
|----------|--------|-----|----------|
| Tell registrants about a changed time/place | Not now | Cancelling doesn't notify them either; needs a new notification type. Follow-up below | Notify on every save |
| Consent on edit | Unticked every time | Edits can add a named person; a carried-over tick is a stale promise | Keep the saved tick |
| Unpublish from the edit form | No — the list's Unpublish button | An edit can't take something off the site by accident | "Save as draft" on a published item |
| Story PATCH shape | Full edit when the body carries `title` (the event PATCH's rule); `status` only when sent | A content-only save must not draft the story, which the current status-only handler does | Separate PUT route |
| Loading one event/story to edit | Existing list routes (`GET /:id/events`, `/:id/stories`) + find by id | No new route; lists are one org's rows | New GET-by-id route |

## Units

### Unit 1: Story PATCH edits content (API)
- `packages/api/src/routes/organizations.ts` — PATCH `/:orgId/stories/:id`: when `title` is a string, validate and write the content fields with the POST's rules (shared `storyShape`); set `status` only when the body has it; stamp `published_at` only on the draft → published edge, clear it on unpublish, leave it alone otherwise.
- `packages/api/tests/integration/orgs/stories.test.ts` — a content edit of a published story keeps status and published_at; a body without status does not draft it; an unattributed pull quote is refused; another leader's story is a 404.

### Unit 2: Web edit pages
- `components/event-form.tsx` — initial date/time read in local time (R4); edit mode button set (R3); push to the list or the public page as now.
- `components/story-form.tsx` — takes `story?`; PATCH when present; consent starts false (R6).
- `app/dashboard/organisation/events/[id]/edit/page.tsx`, `stories/[id]/edit/page.tsx` — leader check, load the row (+ questions), 404 when not theirs.
- `components/org-publishing.tsx` — an Edit link on every row.

### Unit 3: Mobile edit screens
- `components/organisation/event-form-screen.tsx`, `story-form-screen.tsx` — optional `eventId`/`storyId`; load, fill, PATCH.
- `app/(my)/organisation/events/[id]/edit.tsx`, `stories/[id]/edit.tsx` — routes.
- `components/organisation/org-publish-screen.tsx` — Edit button per row.

### Unit 4: Bookkeeping
- `packages/types/src/pending.ts` — `shipped: true`; remove the two `PENDING(edit-event-story)` markers; regenerate.
- Nav route parity: the new web routes get their mobile screen in the same change.

## Tests
- API integration (Unit 1) against local Supabase.
- Web unit/e2e as the repo has them for the forms; mobile jest for the two screens in edit mode (fills from the loaded row, PATCHes, consent unticked).
- Full `npx jest` in packages/mobile; `scripts/verify-plan.sh --run`.

## Follow-ups
- Done 2026-10-19 (623e6326): registered families are told when a published event's time or place changes, or it is cancelled — migration 138, which hosted still needs (`supabase db push`).
- Done 2026-10-19 (02079800 and the eight fix commits before it): the failure-state guard sees a chained `apiClient\n  .get`; the 29 screens it then found each have a failure test or a reasoned exemption, and eight gained a Try again they lacked.
- Done 2026-10-19 (e89b86ac): web e2e for both edit pages.
