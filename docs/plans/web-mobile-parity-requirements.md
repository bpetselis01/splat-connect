# Web ↔ Mobile Parity Requirements

**Version:** 1.0
**Status:** Draft
**Date:** 2026-10-16

## Problem Frame

Both board-parity harnesses are at zero findings (web 118/118 clean, mobile
60/61), so the visual match with the Soft Pop board is done. What's left is
the feature gap between the two apps. A member, leader or admin on the phone
regularly hits "do this on the web": registering for an event, writing an
event or story, editing an organisation's pictures, doors and rates, editing a
guide's collaborators and recommendations, and every admin review queue.
Several flows are incomplete on both platforms. Thank-you notes can't be
hidden. A family isn't told when an organisation accepts or declines backing
their guide. A reporter never hears the outcome of a report. A person who
leads two organisations silently acts for the first one.

Six of these are open `decision` items in `packages/types/src/pending.ts`.
Byron answered them all on 2026-10-16 (see Key Decisions). The rest are
unregistered "edited on the web" notes in mobile screens.

## Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| R1 | A member can register for an event on the phone, answering the organiser's questions and seeing the capacity and full messages web shows | Must Have | `event-registration-mobile` |
| R2 | A leader can see the list of who registered for their event on the phone | Must Have | `event-registration-mobile` |
| R3 | An admin can approve a guide or request changes to it on the phone, reached from the "guide submitted" notification | Must Have | `admin-guide-review-screen` |
| R4 | A contributor can list the thank-you notes sent to them and hide or show each one, on phone and web | Must Have | `profile-thanks-hide`; uses GET/PATCH /contributors/me/thanks |
| R5 | A person who leads more than one organisation can choose which one they are acting for, and every leader screen acts for the chosen one, on both platforms | Must Have | `multi-org-leader-switch`; full picker (Byron's call over the name-only alternative) |
| R6 | A family is notified when an organisation accepts or declines backing their guide, with copy on web and mobile | Must Have | `backing-notifications`; new notification type (migration) |
| R7 | Six of the seven unused API routes each get a calling screen: report an idea participant, list and resolve admin reports, reinstate a removed idea participant, profile thanks (via R4), a reporter's own reports, print-at-event | Must Have | `unused-api-routes` |
| R8 | The singular unread-count route is deleted, along with its tests | Must Have | `unused-api-routes`; the plural count replaced it |
| R9 | A reporter is notified when their report is resolved, sent from the admin resolve action on both platforms | Must Have | new notification type (migration) |
| R10 | A leader can write and edit an event on the phone | Must Have | unregistered gap |
| R11 | A member can write and edit a story on the phone | Must Have | unregistered gap |
| R12 | A leader can edit the organisation's pictures, doors and rates on the phone | Must Have | `org-profile-edit-screen.tsx` says "edited on the web" |
| R13 | A guide author can edit collaborators and recommendations on the phone | Must Have | `my-tutorials/list-screen.tsx` says "edited on the web for now" |
| R14 | Each of the six admin queues behind the phone's admin count cards opens a phone queue where the admin can act, not a web page | Must Have | `app/(my)/admin.tsx` |
| R15 | Every shipped item's `PENDING(...)` references are removed, `shipped: true` is set, `docs/PENDING.md` is regenerated, and the drift test passes | Must Have | registry rule |
| R16 | Every new phone screen gets a line in `my-routes.ts` where a web hub row maps to it, and Me-tab rows show no SOON | Must Have | `mobile-nav-route-parity` rule |
| R17 | New phone screens are built from the real Soft Pop components (Button, FilterControls, RowCard, list-kit) and pass the colour, type-scale and dark-mode guard tests | Must Have | no board drawing for most of these screens |

## Success Criteria

- The six decision items are `shipped: true` and `docs/PENDING.md` lists none of them.
- `grep -rn "on the web" packages/mobile/{app,components}` turns up only downloads and the email-link line in `verify.tsx`, which are intended. No "edited on the web" text and no admin "Opens on the web" hint remain.
- Each new route or screen has unit tests, and a web e2e or Maestro flow covers registration, admin guide review and report resolution.
- The full `npx jest` in `packages/mobile` passes, as does `scripts/verify-plan.sh --run --e2e`, and the app harness stays at 0 findings (new screens are added to `mobile-extra.json` where no board screen exists).
- Hosted migrations are applied for the two new notification types.

## Scope Boundaries

**In scope:**
- All six registry decisions, built out as decided below
- The phone's "edited on the web" gaps: events, stories, org pictures, doors and rates, collaborators, recommendations
- The six admin queues on the phone
- Web counterparts where a requirement names both platforms (R4, R5, R6, R9)

**Out of scope:**
- `apple-sign-in`, `google-sign-in`, `apple-revoke`: Apple/Google setup, excluded by Byron
- `email-delivery`, `site-url`, `org-visit-map`: these need Byron's accounts or a maps provider
- Content and legal items (`contributor-terms-legal`, `org-leader-terms-legal`, `intended-purpose-review`, `terms-version`, `team-page`, `org-facts`, `learn-article-hero`, `printing-basics-hero`): these need Byron's or a lawyer's content
- `generated-stl-sizes`: a new feature, not a parity gap
- File downloads on the phone: guides send people to the web on purpose (`lib/guide-files.ts`)
- Ask an expert on mobile: removed on 2026-09-30

## Key Decisions

| Decision | Chosen | Rationale | Alternatives Considered |
|----------|--------|-----------|------------------------|
| Parity scope | Decisions + phone gaps + admin queues | Byron: "Everything, admin too" | Leave the admin queues on the web; registry decisions only |
| Unused routes | Wire 6, delete singular unread count, add report-resolved notification | Each kept route gains its intended screen; silent moderation discourages reporting | Wire 6 with no notification; wire all 7 |
| Multi-org leaders | Full organisation picker | Byron's call, pushed back once: nobody leads two orgs today, and every future leader screen carries the choice | Show the acting org's name on leader screens only |
| Event registration | Built on the phone | Covered by "everything" | Point the phone at the web |
| Admin guide review | Built on the phone | Covered by "everything" | Change the notification copy to "review on the website" |
| Thanks hiding | Build the list on both platforms | Routes exist; hiding is the point | Delete the routes |
| Backing notifications | Add accepted and declined types | Covered by "everything" | Families check the guide page |

## Outstanding Questions

| # | Question | Impact if Wrong | Owner |
|---|----------|-----------------|-------|
| Q1 | Visual design of the board-less phone screens (admin queues, register, picker) | Rework after review | Byron, from mockups built before the screens (rule: design decisions need visuals) |
| Q2 | Where the org picker lives (Me tab header vs. each leader screen) | Six screens change twice | Resolved in Phase 4 |
| Q3 | Whether any web flow (admin queues, event/story writing, picture uploads) bypasses `packages/api`, so the phone needs new routes | Units grow by an API route each | Codebase map, Phase 4 |
