# UNSW Makerspace badges: how they work, and what SPLAT could take from them

Researched 2026-10-02. Sources are the public pages of **UNSW Making** (making.unsw.edu.au), which runs the UNSW Makerspace Network, plus one UNSW Founders page. Pages were read with WebFetch. WebFetch returns a model's summary of each page, not the raw HTML, so short quoted phrases are as reliable as that summary. Anything that is not stated on a public page is marked **unverified** or **not public**. The staff and admin side (the badge database and the screens for issuing badges) sits behind UNSW single sign-on and could not be seen.

## 1. What a badge is

- "Access to all of our spaces and equipment relies on badges." "Badges are how we ensure UNSW Making users have the skills to safely and efficiently use our network." ([Access](https://www.making.unsw.edu.au/access/))
- A badge is a **competency record that controls access**. It is not a reward for taking part. "Access is only granted to users who are deemed competent to work safely." ([Safety](https://www.making.unsw.edu.au/access/safety/))
- The [Badges Hub](https://www.making.unsw.edu.au/access/badges/) is a single list of every badge in the network. Each badge has its own page at `/access/badges/b/<slug>/`, and each page lists its prerequisites, its online parts, its practical part, a booking link and the machines it unlocks.
- UNSW Founders' makerspace uses the same system. It sends people to the UNSW Making Workshop Safety badge page to "get started" ([UNSW Founders Makerspace](https://unswfounders.com/makerspace)).

## 2. Badge categories, tiers and prerequisites

The UNSW Canberra page states the categories most clearly ([UNSW Canberra Badges](https://www.making.unsw.edu.au/access/spacebadges/unsw-cbr-badges/)). The Sydney hub uses the same shape ([Badges Hub](https://www.making.unsw.edu.au/access/badges/)).

| Category | Rule (quoted or close paraphrase) |
|---|---|
| Entry level | "Required before any access to a Makerspace facility is granted"; "include an online component and a practical in-person induction". No prerequisites. Each space has its own entry badge covering its safety, emergency and conduct rules. |
| Additional entry | "Require the relevant entry level badge as a prerequisite"; covers a group of tools. |
| Individual space | Needed to enter a particular room ("space-specific safety and operational training"). The hub describes a space badge as one for "individual spaces which have 2 or more equipments". |
| Individual machine | "Issued based on operational need"; needs the entry badge; has an online part and a demonstration of safe operation. |
| Advanced / Level 2 / Supervisor | "Require prerequisite badges and a minimum number of hours of verified project work", "awarded only after TSG staff confirm the required competency level has been achieved". |

**Prerequisites form a chain, not a single ladder.** Examples:
- Tormach (CNC mill): Makerspace Safety Induction (MS), then Metal Basics (MB), then CNC Basics (CNC-B), then Tormach ([Tormach Badge](https://www.making.unsw.edu.au/access/badges/b/tormach/)).
- Metal Lathe Supervisor: MS, then Metal Lathe Level 1 (ML1), then Supervisor. The Supervisor badge means the holder "can use the Metal Lathe unsupervised" ([Metal Lathe Supervisor Badge](https://www.making.unsw.edu.au/access/badges/b/metal-lathe-supervisor-badge/)). The page does not say whether a Supervisor can supervise or sign off other people (**unverified**).

So "Supervisor" means **unsupervised use**, not authority over others. Level 1 lets you work under supervision. Level 2 or Supervisor lets you work alone.

## 3. How a badge is earned

There are four kinds of step, and each badge combines some of them.

1. **Read the Safe Work Procedure (SWP) and sign a declaration.** This is an online module that needs a zID login. On some badges it sits in UNSW's "Salus" portal ([Tormach](https://www.making.unsw.edu.au/access/badges/b/tormach/)).
2. **Online quiz.** The Workshop Safety quiz is "multiple choice" and you "must get 100% on the test to pass" ([Workshop Safety Badge](https://www.making.unsw.edu.au/access/badges/b/workshop-safety-badge/)). The Resource Centre badge is online only (an induction plus a quiz) ([Resource Centre Badge](https://www.making.unsw.edu.au/access/badges/b/resource-centre-badge/)).
3. **In-person practical.** "You will need to complete pre-requisite online learning components before you are able to book into a Badge Training session." "Badge Training is subject to competency based assessment - simply attending does not guarantee that you will pass" ([Badge Training](https://www.making.unsw.edu.au/access/badge-training/)). Workshop Safety is a two-hour group session with a minimum of six people. Digital Fabrication is 1.5 hours with 6 to 12 people ([Digital Fabrication Badge](https://www.making.unsw.edu.au/access/badges/b/digital-fabrication-badge/)). Sessions run "intensively at the start of each academic semester" ([DFL Get Access](https://www.making.unsw.edu.au/dfl/get-access/)).
4. **Work submitted before training, and logged hours.** For Tormach, you create toolpaths for a set part to a stated spec (±0.05 mm, no plunges, your name engraved) and send them to a supervisor: "Until you have decent CAM, you will not get an induction". Then comes a four-hour supervised induction, and afterwards you log hours on a "Training Log Hours Form". The award is decided by the "Advanced Manufacturing Lab Coordinator or Makerspace Technical Officer" ([Tormach](https://www.making.unsw.edu.au/access/badges/b/tormach/)). The Metal Lathe Supervisor badge works the same way: a training log kept under supervision, then a practical assessment ([Supervisor](https://www.making.unsw.edu.au/access/badges/b/metal-lathe-supervisor-badge/)).

The online parts are a **gate on booking**. You cannot book the practical until they are done. Each badge page has its own booking links (for example `/training/modules/96/` and `/practicals/make-booking/<id>/`), and those pages need UNSW single sign-on ([training module page](https://www.making.unsw.edu.au/training/modules/64/), which redirected to the sign-on screen).

## 4. What a badge unlocks

- **Machines.** Every machine page names the badges that let you use it. For example, the CNC Lathe page says "To gain access to this machine you must complete one of the below badges" and links the Doosan CNC Lathe badge or the Doosan Supervisor badge ([CNC Lathe](https://www.making.unsw.edu.au/our-machines/cnc-lathe/)). Every badge page lists its machines. Workshop Safety unlocks nine, including the disc sander, drill press, xTool laser cutter and bandsaw ([Workshop Safety](https://www.making.unsw.edu.au/access/badges/b/workshop-safety-badge/)).
- **Spaces.** "You can go to all the Workshops in the Making Network during their opening hours" once you hold Workshop Safety ([About](https://www.making.unsw.edu.au/makerspaces/about/)). One fetch summary said Canberra entry badges "grant card access upon completion", but the quoted text above does not say so. **Treat card access as unverified.**
- **Borrowing.** The Resource Centre badge is "the first badge that you must complete before being granted access to borrow equipment and keys" ([Resource Centre](https://www.making.unsw.edu.au/access/badges/b/resource-centre-badge/)).
- **Booking.** Machine booking is linked from badge pages (Tormach links "/training/modules/802/"). That a badge is checked at booking time is likely but **unverified**, because the booking screens need a login.

## 5. How long a badge lasts, and revocation

- **No expiry or refresher rule is published** on any page fetched (hub, Workshop Safety, Tormach, Digital Fabrication, Resource Centre, Safety, Canberra). A search for expiry or refresher wording on making.unsw.edu.au found nothing. **Unknown, not "never expires".**
- Revocation is discretionary: "the UNSW Makerspace Network reserves the right to revoke access if safety becomes a concern" ([Safety](https://www.making.unsw.edu.au/access/safety/)).
- Workshop Safety is recommended "regardless of whether you have used this type of equipment before", because it is about UNSW's own spaces. Experience gained elsewhere does not count toward it ([About](https://www.making.unsw.edu.au/makerspaces/about/)).

## 6. How badges are shown and recorded

- Badges are recorded in UNSW Making's own site and database, logged in with a zID. Badge pages note that you must log in to see your own progress ([Resource Centre](https://www.making.unsw.edu.au/access/badges/b/resource-centre-badge/)). A "my badges" profile page probably exists behind the login but is **not public and unverified**.
- **No Open Badges or Credly issuing was found for makerspace badges.** UNSW uses Credly for AGSM short courses ([AGSM digital badges](https://www.unsw.edu.au/business/our-schools/agsm/learn-with-us/short-courses/digital-badges)) and for a Founders volunteer badge ([Credly](https://www.credly.com/org/unsw/badge/unsw-founders-foundations-volunteer-program-2022)). The makerspace badges look like internal access records, not credentials you carry elsewhere. This is **an inference from absence**.
- A badge has a short code (WS, MB, CNC-B, ML1, J-RM), and the codes are used in prerequisite lists.

## 7. Who issues badges, and how staff change them

- Practical sign-off is done by named staff roles: the Technical Officer, the Lab Coordinator, and the TSG (technical services group) staff at Canberra. The person who runs the training decides whether someone is "deemed competent".
- Badge requirements differ by space: "Each of our workshops cater to different faculties and schools across UNSW meaning the entry requirements and training process look a little different" ([Space badges](https://www.making.unsw.edu.au/access/spacebadges/)). Some badges are limited to particular faculties. Digital Fabrication is for Arts, Design and Architecture students.
- **How staff create or edit a badge is not public.** The URLs (`/training/modules/<id>/`, `/practicals/make-booking/<id>/`, `/access/badges/b/<slug>/`) suggest one custom app in which each badge is a set of modules (SWP, quiz, practical, booking), and the badge's machines and prerequisites are relations. This is **inference from URLs only**.

## 8. How learners find their next badge

- By space: "Choose the space you wish to use to find out what badges you will need" ([Space badges](https://www.making.unsw.edu.au/access/spacebadges/)).
- By machine: the page for each machine lists the badges it needs (see the CNC Lathe example above). This is the main way people find a badge. You want a machine, so you find out which badge you need.
- By prerequisites: each badge page lists the badges it needs. No pathway map or "recommended next" feature was found.

---

## (a) Summary of how the UNSW system works

A badge is a **competency record that unlocks something**: a space, a group of machines, a single machine, unsupervised use, or borrowing rights. Each badge is a fixed recipe: read the SWP and sign, pass a quiz at 100%, then book a group practical that staff assess. Advanced badges add work submitted before training and logged supervised hours. Prerequisites form a chain (entry, then group, then machine, then Level 2 or Supervisor). Staff in named roles award each badge after an assessment, so a badge never comes from completion alone. Badges are kept in UNSW Making's own system behind the zID login. People find badges by working back from the machine or space they want. No expiry rule is published, revocation is at staff discretion, and no Open Badges are issued.

## (b) What maps to SPLAT and what does not

What SPLAT already has (checked in code):
- **Contributor badges** derived from counts, with nothing stored: First guide, 10 and 25 guides, Org backed, 100 builds, and years on SPLAT (`packages/types/src/contributor-badges.ts`). The design principle is "Earned by doing, not by asking". Only earned badges are returned. They show on the public contributor profile.
- **Verified printer**: a computed `verified(printers)` that is true when the latest reviewed test-print photo passed and the printer has 3 completed jobs (`supabase/migrations/098_printer_test_prints.sql`). The owner submits, and an admin marks pass or fail. **This already follows the UNSW recipe** (submitted work, staff assessment, then logged hours).
- **Verified organisation**: `organizations.verified_at`, which only an admin can set (`076`).
- **Builds logged**: `tutorial_builds` (091) with a SECURITY DEFINER count.
- **Learn**: one course of 6 units and 16 lessons (`packages/web/lib/learn-course.ts`). Checkpoint quizzes "lock nothing". Progress is stored **only in localStorage** (`lib/learn-progress.ts`), so the server cannot know who finished a lesson. The planned `site_content.learn_course` adds "Shown as: Free / Free, sign-in needed / Hidden" (spec `2026-10-01-people-orgs-me-build-design.md`, `site-content-learn-legal-editing`).

| UNSW idea | Fits SPLAT? | Why |
|---|---|---|
| Staff-assessed submitted work as the gate | **Yes, already built** | The printer test print is this. It could be generalised to "show your first adapted toy". |
| Logged hours or jobs after the assessment | **Yes, already built** | VERIFIED_MIN_JOBS = 3. |
| Badge as an access gate (machines, spaces) | **Mostly no** | SPLAT has no shared physical equipment. Families must never be gated from guides. The only real "access" is trust: being listed as a printer, or taking build requests. |
| 100% quiz gate before practical | **No, for now** | Checkpoints are designed to lock nothing, and progress is guest-friendly localStorage. A gate would push guests to sign up and contradict the Learn design. |
| Prerequisite chains | **Weak** | One 16-lesson course has no chain worth modelling. At most it is a single step: Learn, then a first build. |
| Badge pages that list what they unlock, and unlock pages that list the badge | **Yes, cheap** | This is the strongest discovery idea. A printer's "Get verified" screen already explains its steps, and Learn's final checkpoint could point to "log your first build". |
| Revocation at staff discretion | **Partly** | Derived badges disappear when their basis does. Verified printers and orgs have admin control. Nothing new is needed. |
| Expiry | **No** | UNSW publishes none, and SPLAT's derived badges cannot go stale. |
| Per-space badge sets and faculty limits | **No** | SPLAT is one community. Roles (family, maker, printer, recycler, org) already do this job. |
| Open Badges / Credly | **No** | UNSW does not use it for makerspace badges either. It adds signing keys, hosted assertions and a privacy surface on a children's-disability app for no user need. |

## (c) Options for SPLAT

### Option 1: "Course complete" as a derived badge, after progress moves to the server
- **Earned by:** marking every lesson of the Learn course done while signed in. A checkpoint counts as done when the reader submits it, not when they score 100%, which keeps "locks nothing".
- **Unlocks:** nothing. It is recognition only. It may be displayed as a prompt toward a first build.
- **Shown:** one more entry from `contributorBadges()` on the public contributor profile and in My SPLAT.
- **Cost:** a `learn_progress (profile_id, lesson_slug, done_at)` table with own-row RLS, a sync step in `learn-progress.ts` and on mobile (guests keep localStorage and merge on sign-in), one `count` input to `contributorBadges`, and no new screens. This is a medium cost, mainly the sync and the mobile copy.
- **Learn restructuring:** with **one course and several editors**, the badge is simply "Learn course complete". With **several courses**, each course needs a badge, or a rule decides which courses award one, and editing an outline can quietly change who holds it. The badge must be computed from the current outline, so adding a lesson removes it from everyone. A **Hidden** course should award nothing new and should either keep or hide existing badges. The recommended rule: the badge stays, but it is not shown while the course is hidden.

### Option 2: "First build" as a maker step, the UNSW pattern of submitted work assessed by staff
- **Earned by:** logging a build (091) **with a photo**, and an admin marks it pass, exactly as test prints work. Without a photo it is just a "builds logged" count, which already exists.
- **Unlocks:** being shown as an available maker for build requests, or a "Verified maker" label beside Verified printer. This is the one place where SPLAT has real access to grant.
- **Shown:** on the maker's profile and on build-request offers.
- **Cost:** reuse the 098 shape. Either a `build_checks` table plus a private bucket plus an admin review list (`/api/admin/test-prints` is the template), or `tutorial_builds` gains `photo_path` and `verdict`. It also needs a computed `verified_maker(profile)`. Roughly one migration, one admin list on web and mobile, and one upload step in "Mark this build done".
- **Learn restructuring:** does not depend on it. It ties to Guides, not Learn, so one course versus several courses does not matter, and **Hidden** has no effect. Optionally the Learn "Build a switch" lesson could link to it as the next step, which is the UNSW "the badge page tells you what it unlocks" idea.

### Option 3: Do nothing new. Make what exists discoverable
- **Earned by:** the existing rules (contributor counts, Verified printer, Verified org).
- **Unlocks:** unchanged.
- **Shown:** add a "How badges are earned" row on My SPLAT and a short "Next: ..." line on the user's own profile only. For example, "1 more guide for 10 guides" or "Your printer needs its test print". This is UNSW's "machine page lists its badge" idea applied to SPLAT's own badges. Strangers would still never see a list of unearned badges, which keeps the current principle.
- **Cost:** copy plus one small helper beside `contributorBadges` that returns the next threshold. No tables, and one row on web and mobile (the parity harness needs the board, or an `explained` rule).
- **Learn restructuring:** none, and **Hidden** has no effect.

## (d) Recommendation

**Take Option 3 now. Keep Option 2 for when build requests need a trust signal. Do not do Option 1 until Learn progress is on the server for some other reason.**

SPLAT's verification already matches the strongest part of the UNSW model: work submitted before assessment, a staff verdict, then logged practice. That is the Verified printer. What SPLAT lacks is UNSW's *discovery* side: each badge says what it is for, and the thing it unlocks names the badge. That is cheap to add.

The UNSW parts that do not fit are the quiz gate, prerequisite chains, per-space sets and Open Badges. They exist to control access to dangerous shared machines, and SPLAT has none. Gating Learn would also undo its guest-first design.

On the Learn restructure: a Learn badge is the only option that makes the "one course versus several courses" choice matter. That is one more reason to keep Learn badge-free while the restructure question is open.

Things that need a primary-source check, if they matter: UNSW expiry or refresher rules, card-access wiring, the staff admin tooling, and whether a Supervisor can sign others off. All are behind zID or not published.
