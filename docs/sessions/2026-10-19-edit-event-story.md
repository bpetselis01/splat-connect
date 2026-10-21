# Session Q&A Log: Editing a posted event or story

**Date:** 2026-10-19
**Mode:** New Feature
**Scope:** Standard
**Phases completed:** 0, 1, 2, 4, 5 (compressed), build
**Outcome:** Full plan produced and built on web, mobile and API; questions skipped at Byron's request ("continue the remaining work as independently as possible, skip anything requiring setup")

---

## Questions & Answers by Phase

### Phase 0: Intake & Route

**Q:** Which of the remaining pending items can be done without setup?
**User:** (instruction) skip anything requiring setup.
**AI position:** Six setup items skipped; eight content items wait on Byron (app copy only, never authored content); `generated-stl-sizes` needs OpenSCAD installed and sandboxed on the API host, which is setup. That leaves `edit-event-story`.
**Resolved:** Build `edit-event-story` only.

### Phase 2: Challenge & Explore

**Q:** Is editing the real problem?
**User:** (not asked; independence requested)
**AI position:** Yes, and bigger than recorded: drafts could not be reopened either, though EventForm's own comment promises "come back for the bench list later". Two latent bugs found: the story PATCH read a missing status as draft, and web EventForm's edit mode sliced the UTC string for times.
**Resolved:** Build edit for drafts and published items on both platforms.

---

## Key Decisions

| Decision | Chosen | Phase | Rationale |
|----------|--------|-------|-----------|
| Tell registrants about edits | Not now; follow-up | 2 | Cancelling doesn't notify them either; needs a new notification type |
| Story consent on edit | Unticked every time | 2 | An edit may name somebody new |
| Published item buttons | One "Save changes" | 2 | Unpublish stays on the list; an edit can't take it off the site |
| Published story date | Kept on edit | 2 | Only the draft → published edge stamps it |
| Load one row | Existing list routes, find by id | 4 | No new API route |

---

## Positions Where AI Pushed Back

| Topic | AI Position | User Response | Final Resolution |
|-------|------------|---------------|------------------|
| failure-state guard regex | It misses `apiClient\n.get`; widening it flags ~30 screens with no failure test | Not asked | Reverted; reported as a follow-up rather than expanding scope |
