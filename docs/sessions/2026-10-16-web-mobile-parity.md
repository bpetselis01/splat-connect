# Session Q&A Log: Web ↔ Mobile Parity

**Date:** 2026-10-16
**Mode:** New Feature
**Scope:** Deep
**Phases completed:** 0, 1, 2, 3, 4, 5, 6, 7
**Outcome:** Requirements (R1–R17) and a 20-unit plan produced and committed

---

## Questions & Answers by Phase

### Phase 2: Challenge & Explore

**Q:** What does "all the parity work" cover?
**User:** Everything, admin too.
**AI position:** Recommended leaving the six admin queues on the web, because review tables don't fit a phone.
**Resolved:** All six registry decisions, the phone's web-only gaps, and phone admin queues.

**Q:** What happens to the seven unused API routes?
**User:** Wire 6, delete 1, notify.
**AI position:** Recommended this option. Silent moderation discourages reporting.
**Resolved:** Six routes wired, the singular unread count deleted, a new report_resolved notification.

**Q:** Full organisation picker, or show the acting org's name?
**User:** Build the full picker.
**AI position:** Pushed back. Nobody leads two organisations, and every future leader screen has to carry the choice.
**Resolved:** Full picker, accepted as a known cost.

### Phase 4: Structure

**Q:** Thank-you notes can't be written today. Should notes be added?
**User:** Add a note box, plus the hide list.
**AI position:** Recommended this option.
**Resolved:** Optional note on both platforms, plus the Hide/Show list.

**Q:** Editing an event or story after posting?
**User:** Leave it out.
**AI position:** Recommended leaving it out. It isn't a parity gap; it's missing on both.
**Resolved:** Registered as `edit-event-story`.

**Q:** Where does the picker live?
**User:** One switcher, remembered per device.
**AI position:** Recommended this option.
**Resolved:** `useActingOrg` on the phone and a cookie on web.

**Q:** How are the board-less screens designed?
**User:** Mockups for three, copy the rest.
**AI position:** Recommended this option.
**Resolved:** Unit 0 gates the event detail and register screens, an admin queue and the switcher.

### Phase 5: Validate

**Q:** Which CEO review scope mode?
**User:** Hold scope.
**AI position:** Recommended Hold Scope.
**Resolved:** Hold Scope.

**Q:** Should a participant report keep removing the person immediately?
**User:** Hide until reviewed.
**AI position:** Recommended keeping immediate removal, for families' safety.
**Resolved:** A report hides the person from the reporter only. An admin decides Remove or Dismiss (Unit 9a).

---

## Key Decisions

| Decision | Chosen | Phase | Rationale |
|----------|--------|-------|-----------|
| Scope | Decisions, phone gaps and admin queues | 2 | Byron |
| Unused routes | Wire 6, delete 1, notify | 2 | Each route gets its intended screen |
| Org picker | Full picker | 2 | Byron, over the AI's pushback |
| Thanks | Note box plus hide list | 4 | Without notes, the list would always be empty |
| Event and story editing | Out, registered as an item | 4 | Not a parity gap |
| Report semantics | Hide until reviewed | 5 | Byron, over the AI's recommendation |

---

## Positions Where AI Pushed Back

| Topic | AI Position | User Response | Final Resolution |
|-------|------------|---------------|------------------|
| Admin queues | Keep them on the web | Everything, admin too | Built on the phone |
| Org picker | Show the org's name only | Full picker | Full picker |
| Participant reports | Keep immediate removal | Hide until reviewed | Hide until reviewed |
