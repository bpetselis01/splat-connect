# Mobile journeys — gap backlog (2026-10-07)

Printed by `pnpm test:journeys` at the end of SP1, after every existing test was tagged: 142 required layers with no covering test across 132 journeys. Nothing is waived. Each group names the sub-project that owns it (docs/superpowers/specs/2026-10-07-mobile-coverage-audit-design.md §4). The living map is docs/testing/mobile-journeys.md.

A tag says a file exercises the journey, not that it asserts every link in the chain: the nine ◐ partial cells from the inventory count as covered here, and an API test tagged for a notifying action may not assert the notification row (the spec's S16 list). SP2 and SP3 re-check those chains; this list is only what has no test at all.

| Layer | Gaps |
|---|---|
| unit | 2 |
| e2e | 117 |
| api | 20 |
| device | 3 |

## SP2 (1)

Notification chains — an API test per notifying action that asserts the row (spec §4 SP2).

| ID | Layer | Seat | Screen | Element | Notifies | Counts | Setter |
|---|---|---|---|---|---|---|---|
| K12 | api | P | Makers wanted and builds | "Withdraw" | toy_withdrawn | – | n/a |

## SP3 (30)

Live counts — an e2e per badge/count that acts, then asserts the number changes (spec §4 SP3).

| ID | Layer | Seat | Screen | Element | Notifies | Counts | Setter |
|---|---|---|---|---|---|---|---|
| C11 | e2e | P | Challenges | Save heart | – | "N saves" tile | n/a |
| G25 | e2e | P | Guides (reader) | note filter chips (All/Fixes/Step N/Missing) | – | chip counts | n/a |
| L11 | e2e | L | Organisation leader | Print orders (PrintForOthersScreen orgId) | – | Me "Print orders" | mobile |
| L12 | e2e | L | Organisation leader | intake list | – | Me "Recycling intake" | n/a |
| L13 | e2e | L | Organisation leader | "Weigh and credit" | – | family's credit | mobile |
| L16 | e2e | L | Organisation leader | requests tabs | – | Me "Requests to you" | n/a |
| L18 | e2e | L | Organisation leader | publish tabs Events/Stories | – | counts in chips | n/a |
| L24 | e2e | L | Organisation leader | thanks "Hide / Show again" | – | thanks_count | n/a |
| L29 | e2e | L | Organisation leader | conversation Send (leader) | org_message | exchanges bucket | n/a |
| L31 | e2e | L | Organisation leader | Account → OrgInvites Accept / Decline | – | Organisation group appears | n/a |
| P04 | e2e | P | Org public page (P and L) | "Send thanks" | org_thanked | thanks_count | mobile |
| P10 | e2e | P | Org public page (P and L) | family conversation Send | org_message | Me "Messages" | n/a |
| Q10 | e2e | P | Me, inbox, map, explore, admin | exchange thread card | – | unread per thread | n/a |
| Q17 | e2e | A | Me, inbox, map, explore, admin | Admin cards → web | – | six counts | web |
| R07 | e2e | P | Printing | "Started printing" | print_started | stage rail | mobile |
| R08 | e2e | P | Printing | "Mark ready for pickup" (photo) | print_ready | stage rail | mobile |
| R10 | e2e | P | Printing | "Fitted" / "Needs a reprint" | toy_message | printer stats | mobile |
| R15 | e2e | P | Printing | "Get verified" | – | "Verified" shield | web |
| R16 | e2e | P | Printing | accepting toggle | – | finder availability | n/a |
| V04 | e2e | P | Events, recycling, saved | recycling load | – | credit | n/a |
| V05 | e2e | P | Events, recycling, saved | "Book the drop-off" (+ photo) | – | leader intake count | mobile |
| W03 | e2e | P | Toy library and my toys | summary inline "Accept" | toy_accepted | exchange count | n/a |
| W04 | e2e | P | Toy library and my toys | pause toggle | – | toy "Unavailable" | n/a |
| W09 | e2e | P | Toy library and my toys | "Publish to the Toy Library" | – | library | n/a |
| W12 | e2e | P | Toy library and my toys | "N offers on this toy" row | – | stale after acting | n/a |
| X10 | e2e | P | Exchanges | cost "Add a line" | – | Me money panel | mobile |
| X11 | e2e | P | Exchanges | cost "Remove" | – | money panel | n/a |
| X12 | e2e | P | Exchanges | "Settled" toggle | – | "To settle / Settled", Me total | mobile |
| Z01 | e2e | P | Account | display name (blur save) | – | Me greeting | n/a |
| Z03 | e2e | P | Account | Postcode | – | distance in finder/map | n/a |

## SP4a (17)

Leader journeys e2e (spec §4 SP4a).

| ID | Layer | Seat | Screen | Element | Notifies | Counts | Setter |
|---|---|---|---|---|---|---|---|
| L03 | e2e | L | Organisation leader | "Open the tutorial PDF" | – | – | n/a |
| L05 | e2e | L | Organisation leader | "Decline" | – | – | mobile |
| L09 | e2e | L | Organisation leader | "Remove" retired toy | – | – | mobile |
| L10 | e2e | L | Organisation leader | inventory empty CTA → /toys/new?org= | – | – | n/a |
| L14 | e2e | L | Organisation leader | "Contaminated" | – | – | mobile |
| L15 | e2e | L | Organisation leader | "Save what you take" | – | – | n/a |
| L17 | e2e | L | Organisation leader | request row → thread by type | – | – | n/a |
| L19 | e2e | L | Organisation leader | New event: Publish / Save draft | org_event_published | – | n/a |
| L20 | e2e | L | Organisation leader | New story: Publish / Save draft | org_story_published | – | n/a |
| L21 | e2e | L | Organisation leader | publish/unpublish toggle | org_event_published, org_story_published | – | n/a |
| L22 | e2e | L | Organisation leader | "Remove" | – | – | n/a |
| L23 | e2e | L | Organisation leader | profile "Save and publish" | – | – | web |
| L25 | e2e | L | Organisation leader | "Send invitation" | email | – | mobile |
| L26 | e2e | L | Organisation leader | "Cancel invitation" | – | – | n/a |
| L27 | e2e | L | Organisation leader | "Step down as leader" | – | – | n/a |
| L28 | e2e | L | Organisation leader | org messages list | – | – | n/a |
| L30 | e2e | L | Organisation leader | news redirect | – | – | n/a |

## SP4b (15)

Maker / printer journeys e2e (spec §4 SP4b).

| ID | Layer | Seat | Screen | Element | Notifies | Counts | Setter |
|---|---|---|---|---|---|---|---|
| K03 | e2e | P | Makers wanted and builds | Ask first "Send" | build_question | – | n/a |
| K04 | e2e | P | Makers wanted and builds | Ask first "I'll build this" | toy_accepted | – | n/a |
| K06 | e2e | P | Makers wanted and builds | thread "Take it on" (+ pickup) | toy_accepted | – | mobile |
| K07 | e2e | P | Makers wanted and builds | "Decline" | toy_rejected | – | n/a |
| K08 | e2e | P | Makers wanted and builds | "Post the working shot" | build_shot_posted | – | mobile |
| K09 | e2e | P | Makers wanted and builds | "Looks right — arrange pickup" | build_approved | – | mobile |
| K10 | e2e | P | Makers wanted and builds | "Ask for a change" | – | – | n/a |
| K11 | e2e | P | Makers wanted and builds | "Confirm handover" | – | – | mobile |
| K12 | e2e | P | Makers wanted and builds | "Withdraw" | toy_withdrawn | – | n/a |
| K13 | e2e | P | Makers wanted and builds | message Send | toy_message | – | n/a |
| R05 | e2e | P | Printing | job message | toy_message | – | n/a |
| R09 | e2e | P | Printing | printer "Confirm" code | – | – | n/a |
| R11 | e2e | P | Printing | "Say thanks to the printer" | profile_thanked | – | n/a |
| R13 | e2e | P | Printing | "Accept" (machine, pickup) | toy_accepted | – | mobile |
| R14 | e2e | P | Printing | "Decline…" (+ reason) | toy_rejected | – | mobile |

## SP4c (55)

Family journeys e2e (spec §4 SP4c).

| ID | Layer | Seat | Screen | Element | Notifies | Counts | Setter |
|---|---|---|---|---|---|---|---|
| A12 | e2e | P | Auth and gate | terms "Sign out" | – | – | n/a |
| B04 | e2e | P | Build mode | "Leave feedback" → FeedbackSheet | tutorial_noted | – | n/a |
| B07 | e2e | P | Build mode | step photo → viewer | – | – | n/a |
| C04 | e2e | P | Challenges | "Leave" | challenge_left, challenge_removed | – | n/a |
| C06 | e2e | P | Challenges | "Mark as the answer" / "Unmark" | – | – | mobile |
| C07 | e2e | P | Challenges | "Add a constraint" | – | – | mobile |
| C08 | e2e | P | Challenges | "Withdraw the idea" | – | – | mobile |
| C09 | e2e | P | Challenges | "Submit a revised idea" | – | – | n/a |
| C13 | e2e | P | Challenges | idea photo | – | – | n/a |
| G07 | e2e | P | Guides (reader) | "Add a guide" → /guides/new | – | – | n/a |
| N02 | e2e | P | New guide | "Choose PDF" → uploadFile('/api/tutorials/import-pdf') | – | – | n/a |
| N05 | e2e | P | New guide | terms checkbox + "Accept and continue" | – | – | n/a |
| P02 | e2e | P | Org public page (P and L) | Follow / Following | – | – | n/a |
| P03 | e2e | P | Org public page (P and L) | "Message" → /messages/org/:id | – | – | n/a |
| P05 | e2e | P | Org public page (P and L) | "Ask them to print" → /printing?printWith= | – | – | n/a |
| P06 | e2e | P | Org public page (P and L) | "Book a drop-off" → /explore/recycling | – | – | n/a |
| P07 | e2e | P | Org public page (P and L) | door rows | – | – | n/a |
| P09 | e2e | P | Org public page (P and L) | Report org | – | – | web |
| Q03 | e2e | P | Me, inbox, map, explore, admin | money line → thread | – | – | n/a |
| Q04 | e2e | P | Me, inbox, map, explore, admin | "How badges are earned" | – | – | n/a |
| Q08 | e2e | P | Me, inbox, map, explore, admin | invite "Accept" | collaborator_accepted | – | n/a |
| Q09 | e2e | P | Me, inbox, map, explore, admin | invite "Decline" | collaborator_declined | – | n/a |
| Q11 | e2e | P | Me, inbox, map, explore, admin | map load / search / layer chips / filters | – | – | n/a |
| Q12 | e2e | P | Me, inbox, map, explore, admin | map row → route | – | – | n/a |
| Q16 | e2e | P | Me, inbox, map, explore, admin | About LinkRows → web | – | – | n/a |
| S02 | e2e | P | Showcase | "Say thanks" (ThankButton) | profile_thanked | – | none |
| S03 | e2e | P | Showcase | Report person | – | – | web |
| T02 | e2e | P | My tutorials (author) | "+ Add a tutorial" | – | – | n/a |
| T07 | e2e | P | My tutorials (author) | "Preview" → /guides/[id] | – | – | n/a |
| T11 | e2e | P | My tutorials (author) | step photo | – | – | n/a |
| T16 | e2e | P | My tutorials (author) | picks Add / Required first / Remove | – | – | n/a |
| T17 | e2e | P | My tutorials (author) | suits fields | – | – | n/a |
| T19 | e2e | P | My tutorials (author) | backing "Withdraw" | – | – | n/a |
| T21 | e2e | P | My tutorials (author) | section footer Next / Checklist | – | – | n/a |
| V01 | e2e | P | Events, recycling, saved | My events load | – | – | web |
| V02 | e2e | P | Events, recycling, saved | "Can't make it" | – | – | n/a |
| V03 | e2e | P | Events, recycling, saved | "Pick a printer" → /printing | – | – | n/a |
| V06 | e2e | P | Events, recycling, saved | "Cancel the drop-off" | – | – | n/a |
| W05 | e2e | P | Toy library and my toys | Retire | – | – | n/a |
| W06 | e2e | P | Toy library and my toys | editor "Save details" | – | – | n/a |
| W07 | e2e | P | Toy library and my toys | photos camera/library, cover, remove, switch tag | – | – | n/a |
| W08 | e2e | P | Toy library and my toys | offer type | – | – | n/a |
| W10 | e2e | P | Toy library and my toys | "Delete toy" | – | – | n/a |
| W11 | e2e | P | Toy library and my toys | picks mode / "Save picks" | – | – | n/a |
| X05 | e2e | P | Exchanges | "Decline" | toy_rejected | – | mobile |
| X08 | e2e | P | Exchanges | "New code" / "Copy" | – | – | n/a |
| X09 | e2e | P | Exchanges | "Add to toy library" → /toys/:id/edit | – | – | n/a |
| X13 | e2e | P | Exchanges | Thank | profile_thanked | – | n/a |
| X14 | e2e | P | Exchanges | Report | – | – | web |
| Y07 | e2e | P | Toy library and my toys | Save / Thank owner / Report | profile_thanked, org_thanked | – | web |
| Y08 | e2e | P | Toy library and my toys | org / guide / picks links | – | – | n/a |
| Y09 | e2e | P | Toy library and my toys | Organisations list | – | – | n/a |
| Z02 | e2e | P | Account | "What you do" | – | – | n/a |
| Z08 | e2e | P | Account | "Delete profile" | – | – | n/a |
| Z10 | e2e | P | Account | "Open web dashboard", privacy links | – | – | n/a |

## SP5 (21)

Web-only hand-offs and unit gaps — API tests at the hand-off, unit tests for L26 / Z10, waivers with a reason where nothing can be tested (spec §4 SP5). Includes api gaps whose journey notifies nobody.

| ID | Layer | Seat | Screen | Element | Notifies | Counts | Setter |
|---|---|---|---|---|---|---|---|
| A03 | api | P | Auth and gate | Apple/Google button → /not-built?feature= (PENDING apple-sign-in, google-sign-in) or signInWithIdToken | – | – | none |
| A04 | api | P | Auth and gate | create-account submit → signUp (auth-context:120) | OTP mail | – | n/a |
| A05 | api | P | Auth and gate | sign-in submit → signInWithPassword (unconfirmed → resend + verify) | – | – | n/a |
| A06 | api | P | Auth and gate | "Email me a sign-in code" → code-sign-in Send code → signInWithOtp(shouldCreateUser:false) | OTP mail | – | n/a |
| A07 | api | P | Auth and gate | verify: 6 digits → verifyOtp | – | – | n/a |
| A08 | api | P | Auth and gate | verify "Send a new code" / "Wrong email?" | OTP mail | – | n/a |
| A09 | api | P | Auth and gate | forgot-password Send code → resetPasswordForEmail | recovery mail | – | n/a |
| A10 | api | P | Auth and gate | reset-password Save and sign in → verifyOtp(recovery) + updateUser | – | – | n/a |
| A12 | api | P | Auth and gate | terms "Sign out" | – | – | n/a |
| G16 | api | P | Guides (reader) | PDF View → /preview (signed URL, 60 s) | – | – | n/a |
| G30 | api | P | guides/[id] Files tab | 3D pill → /guides/[id]/model | – | – | n/a |
| H01 | api | P | Home, tabs and device-local state | Today card / inbox chip (home-screen:31) → push /inbox | – | inbox badge unread.total, Today counts | n/a |
| L03 | api | L | Organisation leader | "Open the tutorial PDF" | – | – | n/a |
| L26 | unit | L | Organisation leader | "Cancel invitation" | – | – | n/a |
| L26 | api | L | Organisation leader | "Cancel invitation" | – | – | n/a |
| Q07 | api | P | Me, inbox, map, explore, admin | bucket "Mark read" | – | bucket + tab badge | n/a |
| Q10 | api | P | Me, inbox, map, explore, admin | exchange thread card | – | unread per thread | n/a |
| V01 | api | P | Events, recycling, saved | My events load | – | – | web |
| V09 | api | P | Events, recycling, saved | list row open | – | – | n/a |
| Z04 | api | P | Account | "Sign Out" | – | – | n/a |
| Z10 | unit | P | Account | "Open web dashboard", privacy links | – | – | n/a |

## SP6 (3)

Device flows (spec §4 SP6).

| ID | Layer | Seat | Screen | Element | Notifies | Counts | Setter |
|---|---|---|---|---|---|---|---|
| B04 | device | P | Build mode | "Leave feedback" → FeedbackSheet | tutorial_noted | – | n/a |
| G27 | device | P | Guides (reader) | note menu Report | – | – | web |
| Z04 | device | P | Account | "Sign Out" | – | – | n/a |
