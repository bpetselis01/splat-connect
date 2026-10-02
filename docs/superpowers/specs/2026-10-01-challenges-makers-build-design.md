# Challenges + makers build — sub-project 4, batch 4

Batch 4 of six (split in `2026-10-01-guides-build-design.md`). The guides
spec's **Rules every slice keeps** apply unchanged. Board copy:
`Splat Connect frontend overhaul/SPLAT Connect - Mobile.dc.html` (MB) and
`SPLAT Connect - Web.dc.html` (WB); quote it, never invent it.

## Scope — 15 registry items

`challenge-outcome-tab`, `challenge-thread-tab`, `challenge-maker-meta`,
`challenge-saves-stat`, `challenge-writeup-stage`, `challenge-brief-photo`,
`idea-photo`, `idea-anonymous`, `idea-required-fields`,
`challenge-author-states`, `challenge-constraints`, `build-request-options`,
`makers-live-done-tabs`, `makers-row-meta`, `makers-ask-first`.

Owned elsewhere: `my-challenges-meta`, `me-count-badges`, `me-rows-structure`,
`thank-people` (batch 6); `locations-and-distance` (batch 2);
`guide-ask-a-maker`, `part-prices` (batch 1); `build-thread-cost-panel`
(batch 3).

## Facts this design rests on

- Ideas and challenges are one table, `toy_ideas`; status `pending |
  challenge | rejected | graduated`; "Live", "Waiting", "Solved" are UI
  words. `kind` is challenge | question (078).
- Anon reads a fixed column list (040 grant): **every new public column is
  added to that grant**.
- No withdraw path exists; a rejected idea is resubmitted, not amended.
- Participants: `toy_idea_participants (idea_id, profile_id, joined_at,
  removed_at)`; no role column. `profiles.role` is public.
- Saves are polymorphic (044); `save_count(toys)` (073) is the pattern; saved
  challenges are filtered to `status='challenge'` today.
- Build requests are `toy_transactions` type 'build'; 057's subject check
  requires a non-empty `build_brief`; `urgency` is free text ≤ 60.
- Web challenge detail already has Thread and Outcome tabs, maker "Joined
  {date}" and a "You" chip — mobile catches up to web and the board.

## Items

### challenge-outcome-tab
Mobile challenge detail gets the Outcome tab with the board's four steps:
"Idea approved — An admin reads it and opens it as a challenge." / "Makers
working — People join and the thread records what has been tried." /
"Written up as a guide — A maker turns the solution into a draft guide. It
reads Waiting until approved." / "Guide published — The draft goes through the
same review as any other guide." Position: pending 0, challenge 1, graduated
2; rejected shows all to-do. The steps live once in `packages/types`, used by
web too. Hidden for questions.

### challenge-thread-tab
The thread moves out of Makers into its own Thread tab ("Where the work
happens. Makers can post."). Tabs carry count badges: Constraints (count),
Makers (maker count), Thread (post count). Makers and Thread only while open.

### challenge-maker-meta
`GET /api/public/challenges/:id` participants add `role` (from profiles) and
`writing_up` (the graduated guide's primary contributor). Mobile rows:
"{name} — {role} · joined {date}[ · writing it up]", and "You" for the viewer.

### challenge-saves-stat
`save_count(toy_ideas)` SECURITY DEFINER, number only. Stat tiles become
makers / posts / saves / days open, web and mobile.

### challenge-writeup-stage
Graduated copy, both platforms: head "Somebody solved it", body "A maker is
turning the solution into a guide. The brief stays up, with the guide linked
once it is approved.", card "{maker} is writing this up / Started {date}. The
draft still goes through review before a family sees it." **Follow the
write-up** saves the challenge (toast "You will be told when the guide is
published"). Saved challenges include graduated ones. When the graduated guide
is approved, savers get a notification `challenge_guide_published`.

### challenge-brief-photo + idea-photo
`toy_ideas.photo_url` (upload to the existing ideas/photos bucket pattern;
granted to anon). Submit an idea: "Photo — Tap to add a photo" (optional).
Brief tab: the hero photo, then the problem, then "What a solution has to do"
(the `summary`). Web brief likewise.

### idea-anonymous
`toy_ideas.anonymous boolean default false`. Form: "Post anonymously" (web:
"Post this anonymously. Your name will not appear on the challenge."). The
public read returns no `author_name` when set; meta reads "Published {date} ·
anonymous". Admins and the author still see the name.

### idea-required-fields
Only Title and Summary are required. `description` ("Why it matters — Who
would use it, and what they cannot do today.") becomes optional;
`intended_use` and `primary_user` drop NOT NULL and leave the form (they stay
as a fallback on old ideas). API `readIdeaBody` and both forms follow.

### challenge-author-states
`GET /api/ideas/mine/:id` returns the author's own idea at any status. The
mobile detail falls back to it when the public read 404s. Pending: "Submitted
{date} · only you can see this" / "An admin is reading it" / "Nothing is
public yet. Most ideas are answered inside a week — approved, it opens as a
challenge; if not, you get a reason." with **Withdraw the idea** (deletes the
pending row; new author DELETE policy while pending; toast "Withdrawn —
nothing was published"). Rejected: "Not taken forward" / "An admin read it and
decided it is not one for SPLAT. Nothing was published. The reason is below —
a revised idea is welcome." / "Why it was not taken forward: {review_note}"
with **Submit a revised idea** (opens the form pre-filled). Web dashboard gets
Withdraw and Submit a revised idea too.

### challenge-constraints
`toy_idea_constraints(id, idea_id, label 1–80, note ≤ 300, added_by,
created_at)`. Read where the idea is readable; insert by the idea's author or
a current participant; delete by whoever added it, or the author. Constraints
tab lists "{label} — {note}" and **Add a constraint**; ideas without any fall
back to Intended use / Who it's for.

### build-request-options
The note is optional: relax the 057 subject check to allow a null
`build_brief` (guard-and-recreate the constraint), and the API. "A note to the
maker (optional)", placeholder "Why this toy, the switch you have, what makes
handover easy". How soon? is No rush / This month / Before holidays (one list
in `packages/types`, web and mobile); old free-text values still display.

### makers-live-done-tabs
`GET /api/toy-transactions/builds-board?tab=live|done` (signed in): claimed
builds still open (Live, footer "{maker} is building it") and completed ones
(Done, "Handed over · Built by {maker}"), newest first, paged, no family
identity beyond today's open-builds row. Tabs: Needs a maker / Live / Done /
Yours; counts on Needs a maker and Yours only.

### makers-row-meta
Rows show "{build time} · ~{cost}" — `build_minutes` and the guide's parts
total from batch 1 (`partsTotalCents`), each omitted when unknown. Open-builds
embeds the guide's `build_minutes` and parts for that total.

### makers-ask-first
`build_request_questions(id, transaction_id, maker_id, sender_id, body 1–1000,
created_at)`: one private thread per (request, maker), readable by the family
and that maker; only while the request is unclaimed. Notification
`build_question` with the transaction as subject (widen 077's one-subject
check with the 046 guard-and-recreate pattern). UI on both platforms: **Ask
first** opens the thread, stage "Asking first / Not claimed yet / Ask about
the parts or the switch. Claiming is one tap when you are ready." The family
sees one thread per maker who asked. Claiming keeps the questions visible in
the build thread's history.

## Testing

Test-first per slice. Route tests: anon never sees an anonymous author; anon
grant covers the new columns; only pending ideas can be withdrawn and only by
the author; a non-participant can't add constraints; a third maker can't read
another maker's questions; null build note accepted. Pure tests: outcome step
position, urgency list. Object-exists assertions, drift test, parity after
each slice.

## Order

1. idea-required-fields, build-request-options (constraint relaxations).
2. challenge-outcome-tab, challenge-thread-tab, challenge-maker-meta,
   challenge-saves-stat.
3. idea-photo + challenge-brief-photo, idea-anonymous, challenge-writeup-stage.
4. challenge-author-states, challenge-constraints.
5. makers-row-meta (after batch 1's part prices), makers-live-done-tabs,
   makers-ask-first.
