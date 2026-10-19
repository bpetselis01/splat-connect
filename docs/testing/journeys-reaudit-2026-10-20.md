# Journey coverage re-audit, 2026-10-20

A fresh sample taken after the ratchets closed (694 journeys, 0 gaps, no file-level tags, no placeholder opt-outs). It reuses the method of `docs/testing/mobile-journeys-audit-2026-10-20.md` Part B2: for each required layer of a sampled row, open the test cases whose titles carry the id and classify the cell.

- OUTCOME: the test performs the row's action and asserts what that layer is meant to prove (the arguments sent, the screen the user sees, the stored row, the notification).
- INTERACTION: the test drives the control but asserts less than the outcome (a callback fired, a URL changed, a state flag).
- RENDER: the test only shows that something draws.
- WRONG: the tagged test does not touch the row at all (a loose tag).

## Sample

100 rows: 50 mobile and 50 web. Every mobile id letter (18 groups) and every web prefix (17 groups) has at least 2 rows; the remaining 30 rows go to the largest groups. Within a group, rows with `api`, `notifies` or `counts` come first. A seeded shuffle picked them, and the 50 rows of the earlier audit were left out so this is a different sample. The 100 rows hold 285 required-layer cells.

Method note: for each case I read the title and its assertion and action lines. For tests that carry many ids in one long e2e journey (WR26, WX01, WX10, WY21, K13, T09) I searched the journey for the row's own step before classifying. I did not run any suite.

## Totals

| Platform | Layer | Cells | OUTCOME | INTERACTION | RENDER | WRONG |
|---|---|---|---|---|---|---|
| mobile | mobile-unit | 50 | 48 | 1 | 1 | 0 |
| mobile | mobile-e2e | 50 | 48 | 2 | 0 | 0 |
| mobile | api | 45 | 44 | 1 | 0 | 0 |
| mobile | device | 3 | 3 | 0 | 0 | 0 |
| web | web-unit | 50 | 49 | 0 | 1 | 0 |
| web | web-e2e | 47 | 46 | 1 | 0 | 0 |
| web | api | 40 | 40 | 0 | 0 | 0 |

All layers together: 285 cells, 278 OUTCOME (97.5%), 5 INTERACTION, 2 RENDER, 0 WRONG. The earlier audit's two WRONG cells (a loose tag on G09 and G10) have no counterpart here.

## Cells below OUTCOME

| Row | Layer | Class | What the test proves | What would make it an OUTCOME |
|---|---|---|---|---|
| H03 | mobile-unit | INTERACTION | `onOpen` is called with the shortcut object | assert the `push` href, as the e2e does |
| R04 | mobile-unit | RENDER | one printer-card line, "4 jobs · ~6 days", from one of three GETs | assert the job, printer and cost sections |
| R04 | mobile-e2e | INTERACTION | the tag sits on the request and withdraw journey, not on the job screen's load | assert the job screen after the request |
| T13 | mobile-e2e | INTERACTION | an upload that drops mid-way shows the error and a retry works | add the photo, cover, caption and remove steps |
| C11 | api | INTERACTION | `save_count` on the public brief is a number with no saver in it | POST then DELETE `/api/saves`, read the count each time |
| WC02 | web-unit | RENDER | the five tabs exist and Guides links to `/library` | assert the tab for the current section is marked |
| WR26 | web-e2e | INTERACTION | the printer journey clicks Decline and the family gets an inbox line; the reason text is not asserted | assert the reason in the family's note |

One row-data note, not a test fault: K05 lists `toy_request` in `notifies`, while its API test asserts an open Makers wanted post tells nobody (the notification is asserted by other rows).

## Rows

| Platform | ID | Element | Unit | E2E | API | Device | Evidence |
|---|---|---|---|---|---|---|---|
| mobile | A14 | session gate on load | O | O | O | O | auth-context loading/profile/terms; e2e signed-out deep link lands on Welcome; api agreements/me returns only caller's acceptances |
| mobile | A08 | verify "Send a new code" / "Wrong email?" | O | O | O | - | resendSignupCode called with email + countdown restarts; e2e Wrong email returns with email filled; api mails a second code |
| mobile | A11 | terms "Accept and continue" → acceptContributorTerms (+ n... | O | O | O | - | acceptContributorTerms once, setProfileName; e2e gate then /home; api user_agreements row at current version + name saved |
| mobile | B01 | Start step 1 / Next / Previous | O | O | - | - | step ticks stored in guide-steps key and Step 1 of 2 text; e2e resume at step 3 after reload, progress 2/3 |
| mobile | C11 | Save heart | O | O | I | - | mockToggle('challenges','c1') and refetched tile; e2e tile moves and saves row asserted; api only reads save_count on public brief, not the POST/DELETE |
| mobile | C02 | detail load (tabs) | O | O | O | - | brief tabs render; e2e join then brief; api participants with role |
| mobile | G24 | note "Add a photo" | O | O | O | - | photo_path and caption in POST body; e2e row carries photo_path/caption; api stores under notes folder and reads back 200 |
| mobile | G26 | note menu Pin / Unpin | O | O | O | - | pin POST + flash; e2e fix card + pinned_by null after unpin; api 403 for parent, pinned_by set |
| mobile | G08 | detail Save (ItemActions) | O | O | O | - | POST /api/saves body then Undo DELETE; e2e saved rows asserted; api saved twice = one row, delete = 0 rows |
| mobile | H05 | "Add a shortcut" sheet: search, add/remove | O | O | - | - | add/remove called with ids and sheet filter; e2e tile appears and survives reload |
| mobile | H03 | shortcut tile → push href | I | O | - | - | unit asserts onOpen(feature) callback only; e2e URL /printing and heading |
| mobile | K07 | "Decline" | O | O | O | - | POST /reject asserted; e2e status rejected + toy_rejected row + family view; api notification body is the maker reason |
| mobile | K05 | "Post to Makers wanted" | O | O | O | - | post body with urgency/suburb; e2e transaction row type build/status requested; api row has tutorial_id, no toy, status requested |
| mobile | K13 | message Send | O | O | O | - | POST body trimmed and own bubble; e2e messages table row + toy_message notification; api toy_message with actor and body |
| mobile | L23 | profile "Save and publish" (fields, state, capabilities, ... | O | O | O | - | PATCH/PUT bodies with cents; e2e public page shows saved fields; api public read-back and 403 for non-leader |
| mobile | L41 | Rates: add / edit / remove lines (amount, covering or cla... | O | O | O | - | rate-lines PUT in cents with claiming flag; e2e org_rate_lines rows empty after remove; api stored lines and public page |
| mobile | L03 | "Open the tutorial PDF" | O | O | O | - | push to preview with signed pdfUrl; e2e pdfUrl contains sign path; api signed link serves %PDF |
| mobile | N05 | terms checkbox + "Accept and continue" | O | O | O | - | 403 reveals gate then retries same id; e2e one terms row and one made draft; api version stored |
| mobile | N03 | "Add a cover photo" (uploaded after create) | O | O | O | - | upload then PATCH photo_urls; e2e photo_urls[0] contains id; api two uploads give two files |
| mobile | P01 | profile load | O | O | O | - | failed load then Try again shows Northbank Makerspace; e2e heading and words, leader sees no Follow; api public projection omits org_leaders/email |
| mobile | P02 | Follow / Following | O | O | O | - | POST follow / DELETE follow asserted; e2e follows table row appears and clears; api me.following true then false |
| mobile | P09 | Report org | O | O | O | - | POST /api/reports body naming org + confirmation; e2e report row equal; api row stored as new |
| mobile | Q47 | Spot-check: list of guides an organisation leader approved | O | O | O | - | GET spot-check + push admin/review/t1; e2e row says Approved; api own guide excluded, count >= 1 |
| mobile | Q32 | Organisations: list with leaders, standing and Verified | O | O | O | - | leader names and No leader shown, push to org; e2e row has Active/Verified or Suspended; api verified_at and org_leaders |
| mobile | Q11 | map load / search / layer chips / filters | O | O | O | - | GET /api/public/map?near=2040 and pins; e2e org listed, drop-off filtered; api signed-in toy in suburb with km, signed-out none |
| mobile | R15 | "Get verified" | O | O | O | - | submitTestPrint result and upload args; e2e shield after admin pass; api shield false until pass |
| mobile | R04 | job load | R | I | O | - | unit asserts one printer-card line only; e2e carries R04 on the request/withdraw journey not the job-load screen; api print settings in job detail |
| mobile | R13 | "Accept" (machine, pickup) | O | O | O | - | POST accept with printer_id; e2e print_ready row and family sees Ready for pickup; api toy_accepted in printer name |
| mobile | S03 | Report person | O | O | O | - | POST /api/reports body naming member; e2e report row equal; api stored report row with reporter |
| mobile | S04 | org chip → org page | O | O | - | - | push /guides/organisation/o1; e2e URL and org heading |
| mobile | T09 | parts rows (qty, optional, buy links, price) | O | O | O | - | replaceItems('parts',…) args and qty floor; e2e adds part, hub shows 1 part; api price_cents 600 / null stored |
| mobile | T13 | photos: add / make cover / caption / remove | O | I | O | - | saveNow photo_urls/captions; e2e tagged test is the upload-drop error path only, cover/caption/remove not asserted; api captions stored, two uploads gallery |
| mobile | T10 | steps add/move/remove/edit; step PDF picked in place (upl... | O | O | O | - | PUT body and renumber; e2e order survives reload; api positions 1..n stored |
| mobile | V01 | My events load | O | O | O | - | empty, error+retry then Build day; e2e booked event listed then cancelled_at set; api only registrant sees it |
| mobile | V11 | "I'm going" with nothing to ask (no questions, no cost, n... | O | O | O | - | POST registration body then reload; e2e registration row answers {} and 1 going; api going_count 1 and in mine |
| mobile | V17 | "Send request" (guide from saved, parts, sets, note) → PO... | O | O | O | - | POST print-at-event body then /events; e2e tx row, files, toy_request note; api same |
| mobile | W06 | editor "Save details" | O | O | O | - | PATCH body age_min/age_max null or 0/7; e2e each step saves to the toy row; api patched name, owner_id and status not spoofable |
| mobile | W11 | picks mode / "Save picks" | O | O | O | - | PUT picks body in order, PATCH picks_mode; e2e toy_picks row position 1 and mode back to auto; api public picks in order and drop non-public |
| mobile | W05 | Retire | O | O | O | - | PATCH retired_at/note and Retired state; e2e row retired_note and retired_at; api retired toy 404 publicly and on request flow |
| mobile | X01 | list load / pull / filter | O | O | O | - | Active/History split and ?toy= filter; e2e rows listed and filter chip clears; api last_message preview, open build off maker list |
| mobile | X02 | thread load | O | O | O | - | GET by id and names toy/collector, offline retry; e2e donation journey reaches thread then handoff; api thread with messages oldest first, stranger 404 |
| mobile | X06 | "Withdraw" | O | O | O | - | POST /withdraw, Withdrawn, badge invalidated; e2e Withdrawn and button gone; api toy_withdrawn to owner and to family |
| mobile | Y01 | list load / filter / pull | O | O | O | - | nearest-first with km and ?near=2000; e2e card holder/condition/badge, condition buckets; api km not postcode, drafts excluded |
| mobile | Y09 | Organisations list | O | O | O | - | names from endpoint, suspended excluded; e2e suspended absent, row opens page; api only public fields |
| mobile | Y04 | detail load, carousel | O | O | O | O | toy rendered from public detail; e2e offer_type decides buttons; api suburb/state never street; device swipes through photos |
| mobile | B02 | "All steps" sheet jump / "Start over and clear ticks" | O | O | - | - | Start over writes [] to guide-steps key and shows Get ready; e2e progress back to 0/3 |
| mobile | C04 | "Leave" | O | O | O | - | confirm first, DELETE participant path, failure keeps joined; e2e participant row gone + author told in inbox; api challenge_left and challenge_removed rows |
| mobile | Z04 | "Sign Out" | O | O | O | O | signOut called once; e2e lands on Welcome; api session null after signOut; device Welcome after cold start |
| mobile | Z09 | wizard Continue / Skip / Finish | O | O | O | - | Continue posts only answered fields {age:6,helps_with}; Skip posts nothing; e2e no child profile created; api whitelisted columns on PATCH |
| mobile | Z03 | Postcode | O | O | O | - | PATCH pickup_postcode with leading zero kept, bad refused; e2e km on toy card changes with postcode; api 4-digit rule stored |
| web | WA19 | wizard "Continue" saves the step (POST /api/child-profile... | O | O | O | - | POST first then PATCH only the answered step, push /library; e2e child row {age:6,helps_with,everyday_needs}; api rows created in order, PATCH whitelisted |
| web | WA08 | unconfirmed email → the raw auth error and no resend cont... | O | O | O | - | alert text 'Email not confirmed' and no resend control; e2e same on /login; api error code email_not_confirmed, session null |
| web | WA01 | "Sign in" with a member's email and password → /dashboard... | O | O | O | - | signInWithPassword args and href /dashboard; e2e Welcome back + My SPLAT in header; api session user id and role contributor |
| web | WB23 | parts queue "We'll print these" / "Can't print these" (re... | O | O | O | - | POST accept {} / reject {reason trimmed}; e2e statuses accepted and rejected with decline_reason; api toy_accepted and toy_rejected notes |
| web | WB16 | Publish / Unpublish on an event or story row → PATCH status | O | O | O | - | PATCH status draft/published with refusal text; e2e public list and follower notification; api follower told once, nobody on unpublish |
| web | WB01 | acting-org switcher (a leader of two or more organisation... | O | O | - | - | setActingOrg called with oB; e2e other pages say Requests to <name> |
| web | WB12 | retired toy with no handover: Delete toy (type the phrase... | O | O | O | - | DELETE /api/toys/t1 then push, only retired no-history toy offered; e2e card gone and row empty; api toy row null |
| web | WC08 | "My SPLAT" link with initials and unread badge → /dashboard | O | O | O | - | href /dashboard, '3 unread' name, initials BP; e2e badge text 1 and click opens dashboard; api unread-counts total |
| web | WC02 | five section tabs (Guides, Toy Library, 3D Printing, Get ... | R | O | - | - | unit only shows five tabs exist and Guides href, never the marked current tab; e2e hrefs of five tabs and More popover |
| web | WD19 | "Delete my account" with the 6-digit code → verify, DELET... | O | O | O | - | DELETE /api/me {confirm,keepCredit}; wrong code deletes nothing; e2e user gone then /login; api content kept under ghost owner |
| web | WD30 | note "Hide" / "Show" → PATCH hidden | O | O | O | - | PATCH hidden true/false, failed PATCH shows alert; e2e hidden_at set then cleared; api hidden_at stamped and listed |
| web | WD09 | organisation invitation "Decline" → invitation removed, n... | O | O | O | - | DELETE invites/i1; e2e invite count 0 and no seat; api invite gone and leaders unchanged |
| web | WD15 | "Create profile" → POST, then the editor moves to /dashbo... | O | O | O | - | POST body keys exact and replace('/dashboard/child/new-id'); e2e adds two children; api rows in created_at order |
| web | WE09 | Safe handling: "Done — next" marks the lesson done and op... | O | O | - | - | stored().done[slug] true and next href; e2e walks every lesson to N of N |
| web | WE10 | Wire a connector: "Done — next" marks the lesson done and... | O | O | - | - | same it.each as WE09, done flag and next href; e2e walk |
| web | WE19 | final-checkpoint: every question answered marks the check... | O | O | - | - | done true, score, Clear resets answers {}; e2e answers and score kept after reload |
| web | WG04 | filter chips: Time, Needs printing, skill and the child /... | O | O | - | - | Needs printing gives ['Slow robot'] and '1 guide'; e2e filters by STL / minutes |
| web | WG01 | library load: approved guides only, the three hero totals... | O | O | O | - | titles, 2 guides, hero totals 2/5/3, empty state; e2e hides pending; api approved only, own saved ids and children |
| web | WH06 | hero copy, scenes and the three stat chips load from the ... | O | O | O | - | chips 12/3/7 from impact totals and zeros on API failure; e2e 3 chips non-zero and five scenes; api home sections and impact totals exclude opted-out |
| web | WH02 | doors: "I'm looking for a guide" → /library, "I'd like a ... | O | O | - | - | door hrefs in order, 'Browse 3 guides', 'See 2 toys available'; e2e door counts and click to /get-involved |
| web | WI32 | "You're going" → DELETE registration; the button reads "I... | O | O | O | - | DELETE registration then I'm going aria-pressed false; e2e cancelled_at set, 5 seats left; api going_count 0, left My events |
| web | WI08 | "Send for verification" (name, what it does, how to verif... | O | O | O | - | POST requests body, status text, refresh; e2e row pending with requester and Sent heading; api stored pending, second ask 409 |
| web | WI18 | asker "Mark as the answer" / "Unmark" on a question | O | O | O | - | POST answer {message_id}, 'marked by the asker'; e2e mark then Unmark; api answer_message_id set then null |
| web | WL02 | terms of use prose; links to the code of conduct, contact... | O | - | - | - | heading and exact list of body links (static row) |
| web | WL08 | a pending-registry item shows its title and blurb, an unk... | O | - | - | - | registry title 'Map and address', fallback copy, Home href / (static row) |
| web | WM23 | "Approve and create it" → organisation created with the r... | O | O | O | - | POST approve for r1, refusal sentence; e2e request approved, leaders = [requester], counts moved; api once only, second call already_reviewed |
| web | WM13 | "Reject" with a required note (pending) or "Unpublish" (l... | O | O | O | - | PATCH status rejected with trimmed review_note, blank sends nothing; e2e author inbox line; api idea_rejected note with reason and count down |
| web | WM09 | "Unpublish" with a required note → server action unpublis... | O | O | O | - | PATCH rejected with trimmed rejection_note, redirect spot-check, blank sends nothing; e2e writer inbox line and guide gone from list; api note stored, tutorial_rejected, spotCheck count down |
| web | WM16 | Filter chips (?cap=), search (?q=), Pager, leader capabil... | O | O | O | - | Leaders chip filters, chip counts and hrefs, search case-insensitive; e2e row fields, Leader tag, No accounts match; api non-admins newest first, total equals counts |
| web | WN07 | Follow / Following → POST or DELETE follow, (signed out →... | O | O | O | - | signed-out push /signup?...reason=follow, failure restores button; e2e follow row appears and clears; api follow and unfollow state plus follower notices |
| web | WN12 | send a message → POST conversation message; the leader ge... | O | O | O | - | POST body to conversation route, server sentence on refusal; e2e org_message row for leader + inbox line; api one conversation, notifies every leader |
| web | WN05 | review banner "Read and accept" → POST org_leader_terms a... | O | O | O | - | POST agreements {org_leader_terms}, banner hides, failure keeps banner; e2e user_agreements row; api version server-chosen |
| web | WP04 | "Say thanks to {first}" with an optional note; a repeat (... | O | O | O | - | POST thanks trimmed note, 409 says already thanked; e2e Thanked disabled, owner inbox and thanks list; api profile_thanked subject, note privacy |
| web | WP01 | profile load: badges, guides, featured guide, toys on the... | O | O | O | - | name, bio, stats 2/1, '5 builds logged', 404 without contribution; e2e profile stats and 404; api 200 eligible, 404 opted-out/zero |
| web | WR07 | part heart → POST/DELETE /api/saves | O | O | O | - | POST saves printable_part and DELETE saves/parts/stl-1; e2e heart stays pressed after reload; api idempotent save, delete removes row |
| web | WR26 | IncomingPrintCard "Decline" then a preset reason → POST /... | O | I | O | - | POST reject {reason} and refresh; e2e tagged 66-line printer journey only clicks Decline then a family inbox row, reason text not asserted; api reason stored and in family note body |
| web | WR10 | row "Thread" → /dashboard/print-requests/:id | O | O | - | - | Thread link href /dashboard/print-requests/job-1; e2e URL equals the job page then list and New request |
| web | WS01 | totals; contributor and organisation cards → their profiles | O | O | O | - | cards link to profiles, totals, chart name, zeros on API failure; e2e card opens profile with guide and toy; api opted-out excluded, totals match |
| web | WS11 | "Send message" (topic, name, email, message) → POST /api/... | O | O | O | - | POST contact body trimmed then 'Sent. Thank you.'; e2e contact_messages row; api stored row, each bad field refused and nothing stored |
| web | WS10 | story reading page: byline → organisation, linked guide, ... | O | - | O | - | byline, pull quote, linked guide href, more stories; api story with org and approved guide, linked guide dropped when unapproved |
| web | WT19 | Safety notes save (does not change status) | O | O | O | - | onSave and POST safety-notes, no PATCH; e2e notes saved and guide stays approved; api list in order in both reads |
| web | WT01 | detail load: the published guide with parts, tools, steps... | O | O | O | - | renders guide, notFound for unknown; e2e full page and 404 status; api two reads give view_count 2 and updated_at unchanged |
| web | WT23 | Files: add, reorder, caption and remove photos (on an app... | O | O | O | - | upload then onSavePhotos(urls,captions); e2e stored photo URLs contain /toy-photos/; api captions stored, gallery of 2 |
| web | WT29 | Picks ("Also worth a look"): add, mark required first, re... | O | O | O | - | onSave list with required flags; e2e recommendation row then removed; api parent sees approved targets in position order |
| web | WX09 | handover code + "Confirm handoff" → confirm action → POST... | O | O | O | - | onConfirm called with the other party's code; e2e Gift and Swap journeys to Closed and Given away; api donation completed, toy moves to requester |
| web | WX10 | CostPanel "Add cost" → POST /api/exchange-costs/:txId | O | O | O | - | POST exchange-costs body and cost-total $12.10; e2e Swap panel total $12.50; api payee is caller, payer other party, claiming true |
| web | WX01 | opening My exchanges marks the exchanges bucket read → PO... | O | O | O | - | POST read {bucket:exchanges} once; e2e unreadIs drops 1 to 0 in the Build journey; api exchanges bucket and its share of total cleared, other user untouched |
| web | WY24 | "Delete toy" (typed phrase) → DELETE /api/toys/:id → /das... | O | O | O | - | DELETE /api/toys/t1 then push /dashboard/toys; e2e toy gone from list; api toy absent after delete |
| web | WY21 | "List it in the library" → PATCH /api/toys/:id/publish | O | O | O | - | PATCH publish {} and 'Families can ask for this'; e2e card reads Live; api blocked until photo/offer type, then status published |
| web | WY23 | "Also worth a look" picks mode and Save picks → PATCH /ap... | O | O | O | - | PUT picks body in order, PATCH picks_mode auto; e2e guest sees sibling under Also worth a look; api public picks order and drop |
