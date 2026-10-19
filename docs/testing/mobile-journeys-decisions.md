# Mobile journeys: web-only setters and open decisions

> Update 2026-10-20: the journey run that followed this audit is finished. Its plan is `docs/plans/journey-coverage-plan.md`; the product decisions and bugs it surfaced are entries in `packages/types/src/pending.ts` (rendered in `docs/PENDING.md`).

Written 2026-10-07 by the coverage audit (SP5). Source rows: `packages/mobile/tests/journeys.json`, rows whose `setter` is `web` or `none`.

A "setter" is whoever can put the data into the state the phone shows. The phone often shows something only an admin, a leader on the website, or nobody can set. This file says which, and what is tested.

## Web-only setters (tested at the hand-off)

For these the phone only reads. The action that creates the state happens on the website (or the admin pages). Where a hand-off test exists, it performs the website action through the same API route the website calls, then checks what the phone's endpoints return.

| Journey | What the phone shows | Who sets it | Hand-off test |
|---|---|---|---|
| C12 Submit idea, C01 challenge list | Idea status (awaiting review, published, rejected) and the "idea approved/rejected" notification | Admin on the web (`/admin/ideas`) | `integration/handoffs/admin-actions.test.ts`: approve and reject, then `/ideas/mine`, the public challenge list and the author's inbox |
| C10 "Follow the write-up" | A graduated challenge pointing at its guide | Admin graduates on the web | same file: graduate, then the list, `/ideas/mine` and the `idea_graduated` notification |
| R15 Get verified, R01 finder "Verified" | The Verified shield and the owner's test-print verdict | Admin passes the test print on the web | same file: owner submits, admin passes, owner's card shows the verdict, finder shows the shield only after enough finished jobs |
| V01 My events | Events a family is registered for | The family, on the web register page (the phone has no register button) | `integration/handoffs/events-mine.test.ts`: register, appears with its organisation, cancel, disappears |
| L23 Save and publish, P01 profile load | Organisation doors, rate lines and pictures | Leader on the web; the phone edits the other profile fields | covered by `orgs/org-profile-social.test.ts` and `public/org-profile.test.ts` (already tagged) |
| G10, G27, S03, P09, X14, Y07 Report | Nothing: a report goes in and the reporter never sees an outcome | Admin resolves on the web | the report going in is tested in `admin/queues.test.ts` and `admin/report-kinds.test.ts`; there is no phone-visible result to test (see decision 5) |
| Q15 Learn hub | Learn course content | Admin edits on the web (`/admin/content`) | `public/learn-course.test.ts` |
| Q17 Admin cards | Counts, each card opens the web admin page | Admin decisions are made on the web | `admin/counts.test.ts` |

## Nobody can set it (`setter: none`)

| Journey | Why nothing sets it | What is tested |
|---|---|---|
| A03 Apple / Google button | Both sign-ins are switched off until the Apple and Google accounts are set up (PENDING `apple-sign-in`, `google-sign-in`), so the button opens a "not built yet" page. | Unit and e2e cover the button. The API layer of A03 is waived in `journeys.json`: there is no provider token to test against local Supabase. |
| S02 Say thanks | Thanking a person works, but the person cannot hide a note: `GET/PATCH /contributors/me/thanks` exist and nothing calls them. | Thank itself is tested at all three layers. Hiding is decision 2 below. |
| R19 basics "Find a printer" | The Printing basics screen shows "To be completed" in place of its photo (PENDING `printing-basics-hero`); there is no content to supply. | Unit and e2e of the button. |

## Supabase-only calls (tested against local Supabase)

Sign-up, sign-in, sign-in codes, recovery, resend and sign-out (A04 to A10, A12, Z04) never touch our API; the app calls Supabase directly. `integration/handoffs/auth-codes.test.ts` makes the same calls against local Supabase and reads the code out of the local mail catcher. Signing the PDF and model files (G16, G30, L03) is tested in `integration/handoffs/guide-files.test.ts` against local storage. Nothing in these needed a waiver.

## Decisions for Byron (not built)

Each of these is a missing feature, not a bug. The audit did not build any of them.

1. **A phone screen for admins to review guides (S3).** What exists: when a guide has no organisation backing it, admins get a "guide submitted" notification. Tapping it opens the organisation review screen, which tells a non-leader admin "this belongs to organisation leaders". The actual approve or request-changes decision can only be made on the website. Missing: an admin review screen on the phone. Cost: a new screen plus its tests (about the size of the organisation review screen, which it could reuse); the API route already exists. Alternative: change the notification to say "review on the website" and link there, which is a small copy change.

2. **Letting a person hide a thank-you note on their profile (S8, S02).** What exists: people can thank a contributor and add a note; the notes show on the profile. The API can list and hide notes, but no screen on the phone or the website uses it. Missing: a "Notes people sent you" list with Hide and Show. Cost: one small screen on the phone (and optionally the web), using routes that are already built. If you do not want hiding, the two routes can be deleted instead.

3. **Leaders who run more than one organisation (S17).** What exists: every leader screen on the phone uses the first organisation the person leads, silently. Missing: a way to choose which organisation you are acting for. Cost: a picker plus passing the chosen organisation through about six screens. Today it only matters for someone who leads two or more organisations; the audit's test data has none.

4. **Registering for events on the phone, and leaders seeing registrations on the phone (S9).** What exists: "My events" and "Can't make it" work on the phone, but the "I'm going" button, the registration questions, and the leader's list of who registered exist only on the website. Missing: a register form on the phone (including the organiser's custom questions and capacity messages) and a registrations list for leaders. Cost: the largest of these. The register form is a whole screen with dynamic questions; the leader list is another.

5. **Seven API routes nothing uses (S8).** These have tests but no screen calls them: report an idea participant (`POST /ideas/:id/reports`); list and resolve reports (`GET`/`PATCH /admin/reports`, the web admin page reads a different table); reinstate a removed idea participant; read and hide profile thanks (decision 2); `GET /reports` (a reporter's own reports); the old singular unread count; print-at-event. Together they leave "report a participant" with no screen to start it and mean a person who reports something never hears what happened. Choice per route: wire it to a screen (cost: a screen each) or delete it and its tests (cost: small, but it removes the only hint of the intended feature). Related: telling a reporter their report was resolved needs a new notification type plus the web admin screen to send it.

6. **Unshipped mobile features listed as PENDING (S14).** Each already shows "not switched on yet" or "To be completed" in the app, so none is hidden from the user:
   - Sign in with Apple and Continue with Google (`apple-sign-in`, `google-sign-in`), and removing Apple access on account deletion (`apple-revoke`). Need the Apple and Google developer accounts set up; the setup wizard is the next step.
   - Organisation map and address (`org-visit-map`). Needs a maps provider and street addresses.
   - Our team page (`team-page`). Needs names, roles and bios.
   - Learn article pictures and the Printing basics picture (`learn-article-hero`, `printing-basics-hero`). Need photos.
   - Contributor terms and the terms version (`contributor-terms-legal`, `terms-version`). Need the lawyer-reviewed text; acceptances are being recorded against a placeholder version in the meantime.
   - Two API items (`email-delivery`, `site-url`) mean sign-up codes and links in emails only reach the team until custom email and the site address are set on the hosted project. This affects every real sign-up code and recovery mail, so it matters before launch.
