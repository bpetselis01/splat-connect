# People, orgs, Me + admin build — sub-project 4, batch 6

Batch 6 of six (split in `2026-10-01-guides-build-design.md`). The guides
spec's **Rules every slice keeps** apply unchanged. Board copy: MB =
`Splat Connect frontend overhaul/SPLAT Connect - Mobile.dc.html`, WB =
`SPLAT Connect - Web.dc.html`; quote it, never invent it.

## Scope — 20 registry items

People: `contributor-profile-details`, `thank-people`, `report-problem-mobile`.
Orgs: `org-profile-rows`, `organisations-list-meta`.
Explore + Learn: `explore-community-stats`, `learn-ask-an-expert-mobile`.
Me: `me-rows-structure`, `me-count-badges`, `saved-list-meta`,
`my-challenges-meta`, `notification-second-line`.
Child profile: `child-switch-sound`, `wizard-steps`, `wizard-mascot-done`.
Admin + site: `admin-counts`, `web-admin-review-list`,
`site-content-learn-legal-editing`, `impact-map`.
Sign-in: `android-one-tap`.

## Items

### contributor-profile-details
The public contributor read already returns bio, `created_at`,
`toysDelivered`, thanks and badges. Mobile showcase: "{role} · Joined {Month
YYYY}", chips "{n} guides", "{n} toys delivered", backing org, "Thanked {n}
times", the bio, then "Published guides" rows "{difficulty} · {time} ·
{views} views" (views from batch 1's `view_count`).

### thank-people
Decided: `profile_thanks` mirroring 077's `org_thanks`: (profile_id
thanked, thanker_id) primary key, `note` 1–200, `byline` 1–60, `show_note`
default false, `hidden_at`, optional `transaction_id`; own read/insert/update,
thanked person reads; `profile_thanks_count(profiles)` SECURITY DEFINER, only
the count public. Notification type `profile_thanked` with a `profile_id`
subject (recreate `one_subject` with the 046/077 guard). Routes mirror
`organizations.ts` thanks. Buttons: toy detail "Thank {person}", exchange
"Say thanks to {other}" (completed only), print job "Say thanks to the
printer", showcase "Say thanks", build thread. Toasts "Thanks sent — they will
see it in their notifications" / "You already thanked them". The showcase's
"Thanked {n} times" adds this count to guide thanks.

### report-problem-mobile
Widen `member_reports.subject_kind` with 'exchange' and 'build' (guard and
recreate the check; `SUBJECT_KINDS` in `routes/reports.ts`). The mobile
`ReportProblem` component takes every kind. Wire it on the exchange thread
("this exchange"), print job, build thread, contributor showcase (person) and
org profile ("Something wrong here? Report a problem. Goes to SPLAT only.").
Sheet copy from MB:1441.

### org-profile-rows
Public org read: backed guides add the primary contributor's name,
`build_minutes` and the parts total (batch 1); shelf toys add offer type and
condition grade (batch 3's `gradeOf`); leaders add `role`. Mobile rows: guide
"{difficulty} · {time} · {$total}" with author, toy "{offer} · {grade}",
leader initials "{role} · {n} guides backed"; headers "Guides they back {n} —
All {n} →", "Toys on their shelf {n} — See all →" linking to filtered lists.

### organisations-list-meta
`GET /api/public/organizations` adds `logo_url`, `verified_at`,
`backed_count`, `toy_count`, `has_printer` (counts via SECURITY DEFINER
functions). Mobile rows: logo or initial, "{suburb}, {state} · {n} backed ·
{n} toys" or "· has a printer", "Verified" / "Printer" badges; lead "{n}
organisations standing behind the work."

### explore-community-stats
Mobile Explore shows "This community so far": Guides, Toys delivered,
Contributors, Organisations from `GET /api/public/impact` totals.

### learn-ask-an-expert-mobile
Decided: remove the mobile row (`learn-hub.tsx`). Web keeps its page.

### me-rows-structure
Decided: in `packages/types/src/nav-model.ts`, "Give us a challenge" holds
Design challenges, Submit an idea, Makers wanted (live); Recycling moves to the
Explore group. Mobile Me drops its stray PendingRow and local list in favour
of the shared model; web nav follows the same model.

### me-count-badges
`GET /api/me/counts` (one call, parallel counts with the caller's client):
my tutorials needing action, my challenges, makers wanted open near nothing
(count of open builds), print requests waiting on me, review queue, recycling
intake booked, org print orders. `buildNav()` takes the counts; rows show them
on web and mobile.

### saved-list-meta
`GET /api/saves/:slug` for guides adds the primary contributor's name and
`build_minutes`; thumbnails from `cover/toy_photo_url`. Rows: "{difficulty} ·
{time} · {author}"; lead "Guides you kept to build later." Toys likewise with
grade and holder.

### my-challenges-meta
`/api/ideas/mine` and `/joined` add `maker_count`, `post_count` (shared
helper with the public challenges list). Rows: "Joined {date} · {n} makers ·
{n} posts", "Your idea · submitted {date} · {n} makers joined", "Your idea ·
declined {date} — a reason is attached", "Joined {date} · being written up".
Lead "Challenges you have joined as a maker, and ideas you have submitted at
every stage of review."

### notification-second-line
`notifications.body text` (≤ 300). Writers that have a reason fill it: guide
returned (`review_note`), idea declined, print declined (`decline_reason`),
build/exchange messages where the board shows one. Inbox cards and web
notifications show it as the second line, else "{subject} · {date}".

### child-switch-sound
Decided: drop "Switch they already use" and "Sound tolerance"; delete the
references.

### wizard-steps
Decided: add Play ("What does your child enjoy?" — Lights, Music and sound,
Things that move, Soft and cuddly, Calm and sensory, Bubbles and water; "We
will put those toys first.") as `child_profiles.enjoys text[]`, display only.
Add Measurements, optional ("Any measurements? (optional)" / "Only for printed
grips and mounts."): Hand width (mm) → existing `palm_width_mm`; new
`reach_cm`, `tray_mm`. Steps: About, Hands, Movement, Play, Measurements.

### wizard-mascot-done
A mascot per step (the web set: wave, think, hold, party, added to mobile
assets). Finish opens a done screen: "{name}'s profile is ready" / "We found
{g} guides and {t} toys that suit {summary}." / **See the matches**. Matching
is one pure function in `packages/types`, `matchesForChild(child, guides,
toys)`: a guide matches when its `switch_target/force/hold` (080) are
compatible with the child's `aim/press_force/hold` (079); a toy matches when
it is switch-adapted, published and not paused. See the matches opens Guides
filtered to those ids.

### admin-counts
`GET /api/admin/counts` (admin only) returns the board's six: Tutorials
awaiting review, Reports from members, Ideas awaiting review, Spot-check,
Accounts, Organisations, using count queries. Mobile Admin shows count cards
and a Reports card; web `/admin` switches from its ten-call fan-out to this.

### web-admin-review-list
A search input above the review list filtering by guide title or contributor
name (client-side over the page already loaded).

### site-content-learn-legal-editing
Decided: Learn only; Legal stays code-only. The course outline becomes a
`site_content` key `learn_course` whose default is today's
`web/lib/learn-course.ts`. Editable: course title, "Shown as" (Free / Free,
sign-in needed / Hidden), "What a reader can do by the end", unit names and
order, and each lesson's title, length and kind (read / build / checkpoint).
Lessons themselves stay pages in code, so units and lessons cannot be added
from the admin. Web Learn and mobile Learn read the merged outline from
`GET /api/public/learn-course`, falling back to the code default.

### impact-map
`GET /api/public/impact/map` returns completed handovers grouped by pickup
suburb + state, with a centroid from batch 2's `postcode_centroids`, and
**drops any suburb with fewer than three** — "never at address level, and
never for fewer than three deliveries in a suburb." Web `/impact/map` draws
them with Leaflet (new dependency) on OpenStreetMap tiles with attribution,
one circle per suburb sized by count, and the board's story text.

### android-one-tap
On Android, arriving at Sign in calls `GoogleSignin.signInSilently()` when
`googleAvailable()` and `hasPreviousSignIn()`; a saved account signs straight
in via the existing `signInWithIdToken`; `noSavedCredentialFound` does
nothing. Unit-tested with the module mocked. It cannot run for real until the
`google-sign-in` setup item is done; the registry item ships with a note
saying so.

## Testing

Test-first per slice. Route tests: only the count of profile thanks is public;
a third party can't read a note; new report kinds accepted; admin counts 403
for non-admins; impact map never returns a suburb under three. Pure tests:
`matchesForChild`, nav-model counts and groups. Object-exists assertions,
drift test, parity after each slice.

## Order

1. learn-ask-an-expert-mobile, child-switch-sound, explore-community-stats,
   web-admin-review-list.
2. contributor-profile-details, saved-list-meta, my-challenges-meta,
   organisations-list-meta, org-profile-rows.
3. thank-people, report-problem-mobile, notification-second-line.
4. me-rows-structure, me-count-badges, admin-counts.
5. wizard-steps, wizard-mascot-done.
6. site-content-learn-legal-editing, impact-map, android-one-tap.
