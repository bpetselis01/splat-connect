# Demo seed for the hosted database

**Date:** 2026-09-23 · **Status:** approved design, awaiting spec review

## Goal

Nothing is live yet, so fill the hosted `development` project (`napjjvnriegcszcvkysj`)
with realistic data. That data should put real content on every web and mobile
screen, and cover each state where the UI looks different, using as few rows as
possible. The seed also acts as one end-to-end run of every workflow.

Two prerequisites come first: bring the remote up to date on migrations, and fix
the notifications crash.

## Decisions already made

| Question | Answer |
|---|---|
| The 7 existing accounts and their data | **Keep them.** The seed goes in alongside and can be removed on its own. The seeder never writes to an existing row. |
| How real the content is | **Real open-licensed designs, invented people.** Guides use actual Makers Making Change files (STL, PDF, photos) with the credit and licence each one requires. Every person, family, child and org is fictional. |
| Email addresses | `+` aliases on `petselisbyron@`, `fettmoose@` and `splat.general@gmail.com`. **Never `bpetselis01`.** The admin screens use the existing `byronpetselisap@gmail.com` admin account, which the seeder only references. |
| Coverage | Every screen has content, plus one row for each state where the UI looks different. |
| Approach | **Hybrid.** Content rows are written directly with the service role. Transaction lifecycles go through the real API, so the messages, notifications, codes and transfers they produce are genuine. |
| Inbox crash | Fix it first, in its own commit. |

## 0. Prerequisites

1. **Backup.** Dump the schema and data to `~/splat-connect-db-backups/2026-09-23/`.
   This is local only and never committed, because it contains children's data.
2. **Migrations.** The remote ledger stops at 067. Run `supabase db push` to apply
   068–073 (STL print settings, event cost, printer rates, guide age range, profile
   showcase, toy counts). To verify:
   - `supabase migration list --linked` shows 73/73;
   - `SUPABASE_PROJECT_REF=$(cat supabase/.temp/project-ref) pnpm db:guards` passes.

   Take the token from `zsh -ic`. The agent shell can hold a stale one.
3. **Inbox crash.** The database allows `build_shot_posted`, `build_approved`,
   `print_started` and `print_ready`, and the API writes them
   (`toy-transactions.ts`). But `NotificationType` (`packages/types`), the `COPY`
   map in `packages/web/components/notifications-list.tsx` and the one in
   `packages/mobile/lib/notifications.ts` have no entries for them.
   `COPY[n.type](n)` has no fallback, so web `/notifications` and the mobile inbox
   throw. The fix:
   - add copy and a link target for all four types on both platforms;
   - add a fallback, so an unknown type renders a generic line instead of throwing;
   - add a unit test on each side.

## 1. Cast

All six accounts share one generated password. It is saved in the manifest.

| Name | Email | Role in the data |
|---|---|---|
| Priya Nair | petselisbyron+priya@gmail.com | Parent. Children: Arlo, 6 (full manual profile) and Zara, 3 (estimated, sparse). Main requester. Has one save of each kind, an event registration, a challenge author role, a report, a contact message and a **pending** org request. |
| Tom Walsh | petselisbyron+tom@gmail.com | Parent with one child. Owns the person-held toys. Competes with Priya for one of them. His org request was **declined**. |
| Mei Chen | fettmoose+mei@gmail.com | Designer and maker. Primary author of the guides. Owns a Prusa MK4 that is accepting jobs, with rates set. Claims builds. `public_showcase` is on, with a bio and a featured guide. |
| Dan Kowalski | fettmoose+dan@gmail.com | Maker. Accepted collaborator on one guide, with a second invite still pending. Owns an Ender 3 S1 that is **not accepting**. Removed from a challenge. `public_showcase` is off. |
| Sarah O'Connell | splat.general+northbank@gmail.com | Leader of **Northbank Uni Makerspace**. It has an org printer farm, events, stories, recycling (PLA and PETG), shelf toys and guide backing. |
| Hamish Reid | splat.general+mensshed@gmail.com | Leader of **Coorparoo Community Men's Shed**, which exists because of his **approved** org request. |

A third org, **Little Steps Therapy Collective**, is suspended and has no leader. It
only exists for the admin organisation screens.

Every account gets `user_agreements(contributor_terms,'v0-todo')`. The two leaders
also get `org_leader_terms`. Without these, middleware redirects every
dashboard route to the terms page.

## 2. Content sources

Files are downloaded at run time from `raw.githubusercontent.com/makersmakingchange/<repo>/main/…`
and never committed. They are listed in `scripts/seed-demo/sources.json`. All URLs
were checked with a 200 response on 2026-09-23.

| Guide | Repo | Files | Licence and credit |
|---|---|---|---|
| Light Touch Switch | Light-Touch-Switch | `LTS_Base_v1.0.stl`, `LTS_Cap_v1.0.stl`, Maker Guide PDF, photo | CERN-OHL-W v2 (hardware) and CC BY-SA 4.0 (docs). "© 2024 Neil Squire / Makers Making Change, based on Kevin Cross (Thingiverse 3211154)" |
| Low Profile Switch | Low-Profile-Switch | Top and Bottom STLs, Assembly Guide PDF, 2 photos | CERN-OHL-P v2 and CC BY-SA 4.0. "Kerilyn Kennedy – MMC; docs Neil Squire / MMC" |
| Switch Adapted Bubble Blower | Switch-Adapted-Bubble-Blower | Assembly Guide PDF, 2 photos, **no STL** | CC BY-SA 4.0. "Kerilyn Kennedy – MMC" |
| One Handed Book Holder | one-handed-book-holder | 1 STL (3.4 MB), User Guide PDF, 2 photos | CERN-OHL-P and CC BY-SA 4.0. "Mathis (MyMiniFactory 41414); docs © 2023 Neil Squire" |
| Rumble Plate Dice Roller | Rumble-Plate-Dice-Roller | Base and Lid STLs, Assembly Guide PDF, no photo | CERN-OHL-P. "Neil Squire / MMC" |
| Simple Switch Tester | Simple-Switch-Tester | Top and Bottom STLs, Assembly Guide PDF, photo | CERN-OHL-P and CC BY-SA 4.0 |
| Penguin Switch Adapted Toy | Penguin-Switch-Adapted-Toy | Assembly Guide PDF, 2 photos | CERN-OHL-P and CC BY-SA 4.0. "Docs Neil Squire / MMC, after 'Santa' Jerry Galland" |

The credit line and licence go at the end of each guide's description, with a link
to the source repo. Parts, tools and print settings come from the PDFs. Where the
source doesn't give print time or grams, the fields stay null. The Universal Cuff
(Printables) is left out because its STLs need a login to download.

Toy photos reuse the MMC photos: the penguin, the bubble blower steps, the switch
tester and the Light Touch Switch.

## 3. States covered

"(bd)" means the timestamp is backdated after the flow completes.

**Guides.** Mei is primary author on all seven.
- Light Touch Switch: approved and complete. Two STLs with print settings.
  Backed by Northbank (accepted), `reviewed_by` Sarah. Thanked by Priya and Tom.
  Recommends two others.
- Low Profile Switch: approved. Dan is an accepted collaborator. Backing
  declined by the Men's Shed and pending with Northbank.
- Bubble Blower: approved toy adaptation. `has_stl` is false.
- Book Holder: approved at `maturity='prototype'`, so it is off the library but
  reachable by link and from Mei's page.
- Rumble Plate: pending, backed by Northbank (accepted), so it shows in
  Northbank's review queue.
- Switch Tester: rejected with a `rejection_note`. Dan's invite to it is pending.
- Penguin: draft. It is the graduated challenge's tutorial.

**Toys.** Six in total.
- Tom's switch-adapted Penguin: published, donation, has a switch photo.
- Tom's Bubble Blower: published, exchange.
- Tom's star projector: published.
- Northbank's light-up spinner: org stock, quantity 3, offered as both.
- Priya's Musical Mat: published, offered as both. It appears in the swap picker.
- Mei's draft toy.

Capacity rule: no toy that should stay visible gets as many accepted
transactions as its quantity.

**Exchanges** (API):
- Priya asks for the Penguin: requested.
- Priya asks for the Northbank spinner: accepted, both codes issued, one side
  confirmed, messages on the thread.
- Priya asks for the Bubble Blower: completed. The toy moves to Priya as a draft,
  so it lands in Tom's "given away". A settled cost with method, note and a
  receipt PDF.
- Tom swaps for the Musical Mat: accepted, with one outstanding cost line and one
  $0 line that is not a claim.
- Priya asks for the star projector: rejected.
- One more: withdrawn after it was accepted.

**Builds** (API):
- Open on Makers Wanted (bd 15 days), which gives `unclaimed_too_long`.
- Claimed by Mei, working shot posted, one cost.
- Completed by Mei for Priya.
- Claimed by Dan, then idle (bd 11 days), which gives `claimed_and_silent`.
- Asked of Northbank by name.

**Print jobs** (API):
- Requested on Mei's printer (Light Touch STLs).
- Accepted and started, then idle (bd 11 days), which makes it stalled.
- Ready with a photo, on a Northbank printer.
- Completed.
- Rejected with a `decline_reason`.
- Event parts request with `part_sets` at Northbank's build day.

**Impact.** `completed_at` on the completed rows is spread across 8 months (bd).

**Events.**
- Northbank build day: upcoming, in person, `cost_cents` set, `prints_parts`.
  Five questions, one per answer type, some required. Priya and Tom have
  registered with answers.
- Online workshop: registrations closed.
- Past build day that Priya attended.
- Men's Shed open day: full (capacity 1, taken by Tom).
- One draft event.
- One cancelled event.

**Stories.**
- Family story: featured, with a pull quote and a link to the Light Touch Switch.
- Maker story about Mei.
- Men's Shed org update.
- Announcement with no org.
- One draft.

Published stories have `consent_confirmed` and `published_at` set. Photos use
public URLs in `toy-photos`.

**Recycling.** Drop-offs in four states: booked, received (weighed and
credited), declined, cancelled.

**Challenges.**
- Pending (Priya).
- Active challenge. Mei, Tom and Dan joined through the API, and Dan was then
  removed. The thread has messages.
- Rejected.
- Graduated, which points at the Penguin guide.

**Org requests.** Priya's is pending. Tom's is declined. Hamish's is approved and
linked to the Men's Shed. These are direct inserts, because
`approve_organization_request()` refuses the service role.

**Admin queues.**
- Contact messages: safety (open), organisation (replied), other (closed).
- Member reports: safety (new), no-show (looking), resolved.

**Notifications.** Whatever the API generates, plus a direct mix of read and
unread so both styles render. Includes a collaborator invite that is still
pending, so the accept/decline buttons show.

**Saves.** Priya has one each of tutorial, toy, challenge and organisation.

**Not seeded.** `toy_idea_reports` and `notify_signups` have no reader in the
app. `site_content` already has rows.

## 4. The seeder

`scripts/seed-demo/` contains `seed.js`, `sources.json`, and a gitignored
`manifest.json` and `.cache/`. It reuses the shapes from
`scripts/parity/{seed,auth}.js`: `makeUser`, `acceptAllTerms`, the leader
setup and the row recipes that already pass the constraints.

- **Phase A, direct writes with the service role.** Accounts are created with
  `auth.admin.createUser({email_confirm:true, user_metadata:{name}})`, followed by
  a profile update. After that: terms, orgs, leaders, guides, parts, tools, STL
  rows, recommendations, backing requests, invites, and the storage uploads
  (`tutorial-pdfs`, `stl-files`, `toy-photos`, `toy-photos-library`,
  `exchange-receipts`, `build-shots`, `print-shots`). Then toys, printers,
  events, questions, stories, drop-offs, challenges, org requests, contact
  messages, reports and saves.
- **Phase B, through the API.** It signs in as each account with
  `signInWithPassword` and calls the API on `:3101` (whose `.env.local` points
  at the remote) using the bearer token. It creates, accepts, confirms and
  rejects the transactions. It also claims builds, posts working shots, approves
  work, starts prints and marks them ready. Invite responses and challenge
  joins and removals happen here too.
- **Phase C.** Backdates the timestamps from §3 and sets `completed_at` spread.

Rules:
- `photo_urls` only. The generated columns `cover_photo_url` and `toy_photo_url`
  are never written.
- `switch_photo_url` must be one of the toy's `photo_urls`.
- STL and PDF columns hold storage paths. Photo columns hold full public URLs.
- Only the four seed-owned notification types are inserted directly. Everything
  else comes from the API.

**Idempotency and removal.** Every created ID is appended to `manifest.json` as
soon as it is created. The seeder refuses to start if any of the six seed emails
already exists.

`node scripts/seed-demo/seed.js --remove` deletes in this order, to get past the
RESTRICT constraints:
1. `print_job_files`
2. transactions
3. printers, events and tutorials
4. storage objects
5. the auth users

If the manifest is lost, removal falls back to the six emails and everything
they own. Removal is scoped to the seed; it never touches the seven original
accounts.

## 5. Verification

1. A Playwright pass over every route in `scripts/parity/screen-map.json`,
   signed in as the account whose data the screen shows, using the parity
   `auth.js` sign-in. The checks: no error boundary, no 404, and no empty-state
   copy on screens that should have content. The output is a pass/fail table.
2. `/notifications` rendered for all six accounts, which exercises the fix in §0.3.
3. Downloading a seeded PDF and STL while signed in through the `/files/…`
   route returns 200.
4. You check the mobile app by hand on the phone. It points at the same remote.

## 6. Commits

1. `fix(notifications): the four build and print types render, and an unknown one falls back`
2. `feat(seed): a demo cast that touches every screen`
3. A memory note on the seed cast and how to remove it.

Migrations 068–073 are already committed. Pushing them to the remote produces no
commit.

## Risks

- **Phase B stops partway.** Removal still cleans up, because the manifest is
  written as each row is created.
- **Storage.** The uploads add about 15 MB to the project.
- **Mobile display bugs.** Some bugs only show on the phone
  (see `mobile-web-layout-blindspot`). Playwright doesn't cover them.
