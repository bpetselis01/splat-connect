> Snapshot of the scout's inventory; the living map is docs/testing/journeys.md, generated from scripts/journeys/journeys.json.

# Mobile coverage inventory (scout output, 2026-10-07)

Produced read-only by an Explore agent against the worktree at Task 10 of the guide-page plan (branch worktree-guide-page-changes). Grep-based (no graphify-out in the worktree). All API paths are prefixed `/api`.

**Counts:** 87 screen routes; ~215 journey rows; 243 mobile unit files, 39 e2e specs, 183 API test files, 6 Maestro flows + 2 parity helpers; 22 suspects.

**Three biggest gaps**
1. A leader's approve or request-changes (`POST /api/tutorials/:id/review`) creates no notification. Only the admin web path does (`admin.ts:60`).
2. Print jobs open the generic exchange thread, not `/printing/jobs/:id`. This hits inbox rows, `print_started`/`print_ready` notifications, My exchanges and the Me money panel (`lib/builds.ts:21`).
3. The mobile e2e suite has nothing for recycling, org publish/profile/messages, the printer-side print job, the build thread after claim, cost panel, toy editor, Map or the Admin screen.

Seats: **P** = any signed-in member (parent and contributor are the same account), **L** = org leader (`caps.ledOrgs.length>0`), **A** = admin (`profile.role==='admin'`). Every `(tabs)`, `(my)`, `(onboarding)` and `printing` route is gated by `useAuthGate` (session + accepted contributor terms), redirecting to `/welcome` or `/terms`.

# 1. Screens

Paths under `packages/mobile/app/`; every route is also a deep link (`splatconnect://`).

| Route | Renders | Seat | Reached by |
|---|---|---|---|
| (auth)/welcome | welcome.tsx | anyone | initial gate redirect |
| (auth)/sign-in, create-account, code-sign-in, verify, forgot-password, reset-password | same-named files | anyone | push from welcome/each other |
| terms | terms.tsx | P (gate) | forced redirect when `hasContributorTerms===false` |
| not-built | not-built.tsx | P | push from Apple/Google buttons (`auth/parts.tsx:117,129`) |
| index | Redirect /home | P | launch |
| (tabs)/home/index | HomeScreen | P | tab root |
| (tabs)/map | MapScreen | P | tab root |
| (tabs)/inbox | InboxScreen | P | tab root; Home Today card; shortcut |
| (tabs)/me | MeTab | P (org group needs L; Admin row needs A) | tab root |
| (tabs)/guides/index | LibraryScreen | P | Home shortcut; notification; Explore result |
| (tabs)/guides/[id]/index | DetailScreen | P | library card; notification (`tutorial_thanked`, `tutorial_noted`, `challenge_guide_published`); provenance; picks; toy-detail link |
| (tabs)/guides/[id]/preview | PreviewScreen | P | push from detail (View) |
| (tabs)/guides/[id]/build | BuildMode | P | push from detail "Start building" (fullScreenModal) |
| (tabs)/guides/[id]/model | ModelScreen (new, Task 10) | P | Files tab 3D pill |
| (tabs)/guides/new | NewGuideRoute | P | library "Add a guide"; My tutorials "+"; shortcut |
| (tabs)/guides/contributor/[id] | ShowcaseScreen | P | byline; `profile_thanked` notification |
| (tabs)/guides/organisation/[id] | OrgProfileScreen | P | provenance org chip; showcase |
| (tabs)/toy-library/index | ToyLibraryScreen | P | Home shortcut; hidden tab |
| (tabs)/toy-library/[id] | ToyDetailScreen | P | card; Explore; org page; picks |
| (tabs)/toy-library/organisations | OrganisationsScreen | P | Me Explore row; Explore door |
| (tabs)/toy-library/organisation/[id] | OrgProfileScreen | P | org list; `/news` redirect; toy detail |
| (tabs)/explore/index | ExploreScreen | P | **URL only** (no push to `/explore`; see S5) |
| (tabs)/explore/learn/index, learn/[slug] | LearnHub, ArticleScreen | P | Me Explore row; Explore door; guide-tools link |
| (tabs)/explore/challenges/index, [id], new | list, detail, SubmitIdeaScreen | P | Me; shortcut; `idea_*`/`challenge_*` notifications; "Submit an idea" |
| (tabs)/explore/makers-wanted/index, new | MakersWantedScreen, AskForBuildScreen | P | Me; shortcut; guide detail "Can't build it?" |
| (tabs)/explore/recycling | RecyclingScreen | P | Me Explore row; shortcut; org "Book a drop-off" |
| (tabs)/explore/about | AboutScreen | P | Me Explore row; Account link |
| (my)/account/index | ProfileScreen | P | Me "Account" row |
| (my)/account/child/[id] | ChildEditorHome | P | child list |
| (my)/account/delete | DeleteAccountScreen | P | Account "Delete account" |
| (onboarding)/child | ChildWizard | P | child-profile-home "Answer a few quick questions" |
| (my)/notifications | InboxScreen (no tab header) | P | Me Account row |
| (my)/admin | MyAdmin | A (**no screen guard**) | Me Account row (only if `isAdmin`) |
| (my)/tutorials/index | MyTutorialsListScreen | P | Me; shortcut |
| (my)/tutorials/[id]/index | TutorialHub | P (author) | list row; `tutorial_*` notifications; create redirect |
| (my)/tutorials/[id]/details, parts, tools, steps, safety, files, stl, picks, suits, backing | section screens | P (author) | hub rows |
| (my)/toys/index, new, [id]/index, [id]/edit | list, create, summary, Editor | P (L for org toys) | Me; shortcut; exchange "Add to toy library" |
| (my)/exchanges/index, [id] | list, ExchangeThreadScreen | P | Me; inbox; notifications |
| (my)/exchanges/build/[id], build/ask/[id] | BuildThreadScreen, AskFirstScreen | P | board; `build_*` notifications |
| (my)/challenges/index | MyChallengesScreen | P | Me row |
| (my)/saved/index, [slug] | SavedScreen, SavedListScreen | P | Me; shortcut |
| (my)/print-requests, print-for-others/index, print-for-others/add | requests, offer screen, add-printer | P | Me; shortcut |
| (my)/events | MyEventsScreen | P | Me; shortcut |
| (my)/messages/[cid], messages/org/[orgId] | OrgConversationScreen | L (leader side) / P (family side) | org messages list; `org_message`; org page "Message" |
| (my)/news/[kind]/[id] | OrgNewsScreen | P | `org_event_published`/`org_story_published` notification only (redirects to org profile) |
| (my)/organisation/index, [tutorialId] | ReviewQueue, ReviewDetail | L (non-leader sees dead-end copy) | Me Organisation group; `backing_requested`/`tutorial_submitted`/`org_thanked` notifications |
| (my)/organisation/toys, orders, recycling, requests, messages, publish, profile, events/new, stories/new | inventory, offer screen (org), IntakeScreen, requests, messages, publish, profile edit, forms | L (`ledOrgs[0]` only) | Me Organisation group |
| printing/index, basics, request, jobs/[id] | find, basics, request, PrintJobScreen | P (printer side = owner of the printer) | shortcut; guide "Ask someone to print"; requests list; offer screen |

# 2. Journeys

Column key: **ID**, element → handler, API, DB/storage, notification/email, badge/count that should change, who sets any state. A dash means none.

## Auth and gate
| ID | Element → handler | API | DB/storage | Notif/email | Badge | State setter |
|---|---|---|---|---|---|---|
| A01 | welcome "Get started" → push create-account | – | – | – | – | – |
| A02 | welcome "I already have an account" → sign-in | – | – | – | – | – |
| A03 | Apple/Google button → `/not-built?feature=` (PENDING `apple-sign-in`, `google-sign-in`) or `signInWithIdToken` | Supabase auth | auth.users | – | – | setup (env) |
| A04 | create-account submit → `signUp` (`auth-context:120`) | Supabase auth | auth.users, trigger `on_auth_user_created` → profiles | OTP mail via Supabase SMTP (PENDING `email-delivery`) | – | – |
| A05 | sign-in submit → `signInWithPassword` (unconfirmed → resend + verify) | Supabase auth | – | – | – | – |
| A06 | "Email me a sign-in code" → code-sign-in Send code → `signInWithOtp(shouldCreateUser:false)` | Supabase auth | – | OTP mail | – | – |
| A07 | verify: 6 digits → `verifyOtp` | Supabase auth | – | – | – | – |
| A08 | verify "Send a new code" / "Wrong email?" | Supabase auth | – | OTP mail | – | – |
| A09 | forgot-password Send code → `resetPasswordForEmail` | Supabase auth | – | recovery mail | – | – |
| A10 | reset-password Save and sign in → `verifyOtp(recovery)` + `updateUser` | Supabase auth | – | – | – | – |
| A11 | terms "Accept and continue" → `acceptContributorTerms` (+ name) | POST /agreements; PATCH /contributors/me | user_agreements, profiles | – | – | – |
| A12 | terms "Sign out" | Supabase signOut | – | – | – | – |
| A13 | not-built "Go back" | – | – | – | – | – |
| A14 | session gate on load | GET /contributors/me, GET /agreements/me | profiles, user_agreements | – | – | – |

## Home, tabs and device-local state
| ID | Element → handler | API | DB | Notif | Badge | Setter |
|---|---|---|---|---|---|---|
| H01 | Today card / inbox chip (`home-screen:31`) → push /inbox | caps: GET /contributors/me, /organizations/mine, /notifications/me/unread-counts, /toy-transactions/action-count | profiles, org_leaders, notifications, toy_transactions | – | inbox badge `unread.total`; Today counts | – |
| H02 | Edit/Done toggle | – (device) | – | – | – | – |
| H03 | shortcut tile → push href | – | – | – | – | – |
| H04 | shortcut menu: Open / Move to top / Remove | – (SecureStore `home-shortcuts.<uid>`) | – | – | – | – |
| H05 | "Add a shortcut" sheet: search, add/remove | – (device) | – | – | – | – |
| H06 | "Pick up where you left off" rows (`recent-rows`) | – (device `recents.<uid>`) | – | – | – | – |
| H07 | tab bar tap (Home/Map/Inbox/Me) | – | – | – | inbox=`unread.total`, Me=`exchangeActions` (`(tabs)/_layout:19`) | – |

## Guides (reader)
| ID | Element → handler | API | DB | Notif | Badge | Setter |
|---|---|---|---|---|---|---|
| G01 | library load + pull-to-refresh (`library-screen:81`) | GET /public/tutorials (+ GET /child-profiles, /saves/ids) | tutorials, child_profiles, saves | – | – | – |
| G02 | search field | client filter | – | – | – | – |
| G03 | Filters → filter-page (pill/radio, Show N, Reset, ✕) | client (`library-filters`) | – | – | "Show N" | – |
| G04 | "Clear filters" / "Try again" | refetch | – | – | – | – |
| G05 | card tap → /guides/[id] | – | – | – | – | – |
| G06 | card Save heart (`SaveButton`) | POST /saves {entity_type:'tutorial'} / DELETE /saves/tutorials/:id | saves | – | Saved hub counts | – |
| G07 | "Add a guide" → /guides/new | – | – | – | – | – |
| G08 | detail Save (ItemActions) | POST/DELETE /saves | saves | – | saves | – |
| G09 | detail Thank | POST /tutorials/:id/thanks (GET for state) | tutorial_thanks; `thanks_count()` computed | `tutorial_thanked` to credited contributors, actor "A family" | library-card thanks pill (`library-screen:251`, stale until refetch) | – |
| G10 | detail Report | POST /reports | member_reports | – (no notification) | admin Reports count | admin **web** `/admin/reports` (PATCH /admin/member-reports/:id); mobile: nowhere |
| G11 | hero photo → PhotoViewer | – | – | – | – | – |
| G12 | byline / org chip → showcase / org page | – | – | – | – | – |
| G13 | "What you'll need" rows → tabs | – | – | – | – | – |
| G14 | step row open | – | – | – | – | – |
| G15 | "Start building" / "Build it again" → /guides/[id]/build | – | – | – | – | – |
| G16 | PDF View → /preview (signed URL, 60 s) | Supabase storage createSignedUrl | bucket tutorial-pdfs | – | – | – |
| G17 | preview footer "Download on the web" → Linking (web guide page) | – | – | – | – | – |
| G18 | "Ask someone to print" → /printing?guide= | – | – | – | – | – |
| G19 | "Can't build it?" → /explore/makers-wanted/new?guide= | – | – | – | – | – |
| G20 | picks row → open guide/toy | – | – | – | – | author via editor |
| G21 | part "gathered" tick / buy link | – (device `guide-parts.<id>.<uid>`) | – | – | – | – |
| G22 | tool "I already have" tick | – (device) | – | – | – | – |
| G23 | Feedback: composer → FeedbackSheet Post | POST /tutorials/:id/notes | tutorial_notes (trigger `tutorial_note_stamp`) | `tutorial_noted` to contributors (`notifyContributors`) | notes list, Feedback badge | – |
| G24 | note "Add a photo" | POST /upload/note-photo | toy-photos bucket `<id>/notes/` | – | – | – |
| G25 | note filter chips (All/Fixes/Step N/Missing) | client | – | – | chip counts | – |
| G26 | note menu Pin / Unpin | POST /tutorials/:id/notes/:id/pin\|unpin | tutorial_notes; RPC `is_tutorial_contributor` | – | "Fixes N" chip | contributor, on mobile |
| G27 | note menu Report | POST /reports (kind note) | member_reports | – | – | admin web |
| G28 | note menu Delete (own) | DELETE /tutorials/:id/notes/:id | tutorial_notes | – | – | – |
| G29 | detail "Try again" | refetch | – | – | – | – |

## Build mode
| ID | Element → handler | API | DB | Notif | Badge | Setter |
|---|---|---|---|---|---|---|
| B01 | Start step 1 / Next / Previous | – (device `guide-steps.*`) | – | – | progress bar | – |
| B02 | "All steps" sheet jump / "Start over and clear ticks" | – (device) | – | – | – | – |
| B03 | last step "Add to My SPLAT" (`build-mode:306`) | POST /tutorials/:id/build | tutorial_builds (upsert) | – | `builds_count()` on guide; Me "N builds logged" (`/me/builds`, fetched once) | – |
| B04 | "Leave feedback" → FeedbackSheet | POST /tutorials/:id/notes | as G23 | `tutorial_noted` | – | – |
| B05 | ✕ / "Back to the guide" | – | – | – | – | – |
| B06 | Gather sheet ticks | – (device) | – | – | – | – |
| B07 | step photo → viewer | – | – | – | – | – |

## Showcase
| ID | Element → handler | API | DB | Notif | Badge | Setter |
|---|---|---|---|---|---|---|
| S01 | showcase load; guide card tap | GET /public/contributors/:id or /public/organizations/:id | profiles, tutorials, orgs | – | – | – |
| S02 | "Say thanks" (ThankButton) | POST /contributors/:id/thanks | profile_thanks; `profile_thanks_count()` | `profile_thanked` | – | **GET/PATCH /contributors/me/thanks has no caller** (hide notes: nowhere) |
| S03 | Report person | POST /reports | member_reports | – | – | admin web |
| S04 | org chip → org page | – | – | – | – | – |

## New guide
| ID | Element → handler | API | DB | Notif | Badge | Setter |
|---|---|---|---|---|---|---|
| N01 | "Start blank / from a PDF" chips | – | – | – | – | – |
| N02 | "Choose PDF" → `uploadFile('/api/tutorials/import-pdf')` | POST /tutorials/import-pdf | – (parse only) | – | – | – |
| N03 | "Add a cover photo" (uploaded after create) | POST /upload/photo | toy-photos bucket | – | – | – |
| N04 | kind / difficulty chips, ages | local | – | – | – | – |
| N05 | terms checkbox + "Accept and continue" | POST /agreements | user_agreements | – | – | – |
| N06 | "Create draft" (`new.tsx:132-141`) | POST /tutorials; POST /contributors/me/tutorials/:id; GET + PATCH /tutorials/:id; PDF path: POST /upload/pdf | tutorials, tutorial_contributors; bucket tutorial-pdfs | – | My tutorials list | – |

## My tutorials (author)
| ID | Element → handler | API | DB | Notif | Badge | Setter |
|---|---|---|---|---|---|---|
| T01 | list load / pull / stage filter | GET /tutorials/mine | tutorials, views | – | Me "My tutorials" count (`/me/counts.tutorials`) | – |
| T02 | "+ Add a tutorial" | – | – | – | – | – |
| T03 | row → hub | – | – | – | – | – |
| T04 | hub section row / Backing row | – | – | – | "Empty"/ready pills | – |
| T05 | **Submit** (`hub:handleSubmit` → `saveNow({status:'pending'})`) | PATCH /tutorials/:id | tutorials; needs accepted terms | `tutorial_submitted` to leaders of accepted backing orgs, else admins (`review-notifications.ts:114`) | leaders' Me "Review queue" (`me/counts.review`) + inbox | review: leader on mobile (L06/L07) or admin web `/admin/review/[id]` |
| T06 | "Delete draft" (More actions) | DELETE /tutorials/:id | tutorials (draft only) | – | list | – |
| T07 | "Preview" → /guides/[id] | – | – | – | – | – |
| T08 | details fields/chips (autosave, `use-tutorial-draft:136`) | PATCH /tutorials/:id (with `updated_at` token) | tutorials | – | – | – |
| T09 | parts/tools rows (qty, optional, buy links, price, note) | POST /tutorials/:id/parts, /tools | parts, tools | – | hub "N parts" | – |
| T10 | steps add/move/remove/edit | PUT /tutorials/:id/steps | tutorial_steps | – | hub step count; Submit gate | – |
| T11 | step photo | POST /upload/step-photo | toy-photos `steps/` | – | – | – |
| T12 | safety notes + "I declare" | POST /tutorials/:id/safety-notes; PATCH safety_declared | tutorial_safety_notes, tutorials | – | hub "Declared" | – |
| T13 | photos: add / make cover / caption / remove | POST /upload/photo; PATCH /tutorials/:id | toy-photos | – | – | – |
| T14 | "Choose PDF from Files" | POST /upload/pdf | tutorial-pdfs (private) | – | – | – |
| T15 | STL upload; "Save sizes" | POST /upload/stl; POST/PATCH /tutorials/:id/stl-files[/:fileId] | stl-files bucket, stl_files | – | – | – |
| T16 | picks Add / Required first / Remove | POST /tutorials/:id/recommendations | tutorial_recommendations | – | – | – |
| T17 | suits fields | PATCH /tutorials/:id | tutorials | – | – | – |
| T18 | backing "Ask <org>" | POST /tutorials/:id/orgs | tutorial_orgs | `backing_requested` to org leaders | leaders' Review count | leader accepts/declines on mobile (L04/L05) |
| T19 | backing "Withdraw" | DELETE /tutorials/:id/orgs/:orgId | tutorial_orgs | – | – | – |
| T20 | save chip "Try again" | repeat PATCH | – | – | – | – |
| T21 | section footer Next / Checklist | – | – | – | – | – |
| T22 | edit an approved or rejected guide (auto re-submit) | PATCH /tutorials/:id (status→pending) | tutorials | `tutorial_submitted` | – | – |

## Organisation leader
| ID | Element → handler | API | DB | Notif | Badge | Setter |
|---|---|---|---|---|---|---|
| L01 | review queue load | GET /tutorials (RLS) | tutorials, tutorial_orgs | – | Me "Review queue" | – |
| L02 | row → review detail | – | – | – | – | – |
| L03 | "Open the tutorial PDF" | storage signed URL | tutorial-pdfs | – | – | – |
| L04 | "Back this guide" | POST /tutorials/:id/orgs/:orgId/accept | tutorial_orgs | – (**none**) | queue pills | leader (mobile) |
| L05 | "Decline" | POST …/decline | tutorial_orgs | – (**none**) | – | leader |
| L06 | **Approve** | POST /tutorials/:id/review | tutorials (status, reviewed_by/at/for_org_id); trigger `notify_challenge_guide_published` (109) | **no `tutorial_approved`** (S1) | author's stage pill | leader (mobile) or admin web |
| L07 | **Request changes** (note required) | POST /tutorials/:id/review (rejected) | tutorials.rejection_note | **no `tutorial_rejected`** | author's returned reason | leader / admin web |
| L08 | inventory list | GET /toys/inventory | toys | – | – | – |
| L09 | "Remove" retired toy | DELETE /toys/:id | toys | – | – | retire: toy summary (W05) |
| L10 | inventory empty CTA → /toys/new?org= | – | – | – | – | – |
| L11 | Print orders (`PrintForOthersScreen orgId`) | GET /printers/mine; GET /toy-transactions | printers, toy_transactions | – | Me "Print orders" (`orgOrders`) | see R12–R16 |
| L12 | intake list | GET /organizations/:id; GET /organizations/:id/recycling | organizations, recycling_dropoffs | – (**no notice of a booking**) | Me "Recycling intake" (`intake`) | – |
| L13 | "Weigh and credit" | PATCH /organizations/:id/recycling/:dropoffId (received) | recycling_dropoffs; RPC `recycling_credit_balance` | – (**family not notified**) | family's credit | leader (mobile) |
| L14 | "Contaminated" | PATCH …/recycling/:id (declined) | recycling_dropoffs | – | – | leader |
| L15 | "Save what you take" | PATCH /organizations/:id/profile | organizations | – | – | – |
| L16 | requests tabs | GET /toy-transactions?role=owner | toy_transactions | – | Me "Requests to you" | – |
| L17 | request row → thread by type | – | – | – | – | – |
| L18 | publish tabs Events/Stories | GET /organizations/:id/events, /stories | org_events, org_stories | – | counts in chips | – |
| L19 | New event: Publish / Save draft | POST /organizations/:id/events; PUT …/events/:id/questions | org_events, org_event_questions | `org_event_published` to followers | – | – |
| L20 | New story: Publish / Save draft | POST /organizations/:id/stories | org_stories | `org_story_published` to followers | – | – |
| L21 | publish/unpublish toggle | PATCH /organizations/:orgId/events\|stories/:id | org_events/org_stories | followers notified on publish | – | – |
| L22 | "Remove" | DELETE …/events\|stories/:id | same | – | – | – |
| L23 | profile "Save and publish" | PATCH /organizations/:id/profile | organizations | – | – | pictures, doors, rates: **web only** (`org-profile-edit-screen:116`) |
| L24 | thanks "Hide / Show again" | PATCH /organizations/:id/thanks/:profileId | org_thanks (+ org_messages) | – | `thanks_count` | – |
| L25 | "Send invitation" | POST /organizations/:id/leaders | org_leader_invites | **email only** (off until `email-delivery`) | – | invitee accepts via L31 |
| L26 | "Cancel invitation" | DELETE /organizations/:id/leaders/invites/:id | org_leader_invites | – | – | – |
| L27 | "Step down as leader" | DELETE /organizations/:id/leaders/me | RPC `step_down_as_leader` | – | – | – |
| L28 | org messages list | GET /organizations/:id/conversations | org_conversations, org_messages | – | – | – |
| L29 | conversation Send (leader) | POST /organizations/conversations/:cid/messages | org_messages | `org_message` to family | exchanges bucket | – |
| L30 | news redirect | GET /public/events\|stories/:id | org_events/stories | – | – | – |
| L31 | Account → OrgInvites Accept / Decline | POST /organizations/invites/:id/accept; DELETE …/invites/:id | org_leaders, org_leader_invites | – | Organisation group appears | – |

## Org public page (P and L)
| ID | Element → handler | API | DB | Notif | Badge | Setter |
|---|---|---|---|---|---|---|
| P01 | profile load | GET /public/organizations/:id; GET /organizations/:id/me | orgs, org_follows, org_thanks | – | – | doors/rates/pictures: web only |
| P02 | Follow / Following | POST / DELETE /organizations/:id/follow | org_follows | – | – | – |
| P03 | "Message" → /messages/org/:id | – | – | – | – | – |
| P04 | "Send thanks" | POST /organizations/:id/thanks | org_thanks | `org_thanked` to leaders | `thanks_count` (client +1, `org-profile-screen:213`) | hide: L24 |
| P05 | "Ask them to print" → /printing?printWith= | – | – | – | – | – |
| P06 | "Book a drop-off" → /explore/recycling | – | – | – | – | – |
| P07 | door rows | – | – | – | – | – |
| P08 | guides / toys "See all", row taps | – | – | – | – | – |
| P09 | Report org | POST /reports | member_reports | – | – | admin web |
| P10 | family conversation Send | POST /organizations/:id/conversations/mine/messages | org_conversations, org_messages | `org_message` to leaders | Me "Messages" | – |

## Toy library and my toys
| ID | Element → handler | API | DB | Notif | Badge | Setter |
|---|---|---|---|---|---|---|
| Y01 | list load / filter / pull | GET /public/toys[?near] | toys | – | – | – |
| Y02 | card Save | POST/DELETE /saves (toys) | saves | – | – | – |
| Y03 | card → detail | – | – | – | – | – |
| Y04 | detail load, carousel | GET /public/toys/:id; GET /toys | toys | – | – | – |
| Y05 | "Ask to collect it" | POST /toy-transactions | toy_transactions (+ messages) | `toy_request` to owner or leaders | owner's "My exchanges" count | owner accepts (X04) |
| Y06 | "Arrange exchange" (offer own toy) | POST /toy-transactions | same | `toy_request` | same | owner |
| Y07 | Save / Thank owner / Report | POST /saves; /contributors/:id/thanks or /organizations/:id/thanks; /reports | saves, profile_thanks / org_thanks, member_reports | `profile_thanked` / `org_thanked` | – | admin web |
| Y08 | org / guide / picks links | – | – | – | – | – |
| Y09 | Organisations list | GET /public/organizations | orgs | – | – | – |
| W01 | my toys list / pull / filter | GET /toys; GET /toy-transactions | toys, toy_transactions | – | per-toy "N waiting" | – |
| W02 | "+ Add a toy" Create | POST /toys | toys | – | – | – |
| W03 | summary inline "Accept" | POST /toy-transactions/:id/accept | RPC `accept_toy_transaction` | `toy_accepted` | exchange count | – |
| W04 | pause toggle | PATCH /toys/:id (paused_at) | toys | – | toy "Unavailable" | – |
| W05 | Retire | PATCH /toys/:id (retired_at, reason) | toys | – | – | – |
| W06 | editor "Save details" | PATCH /toys/:id | toys | – | – | – |
| W07 | photos camera/library, cover, remove, switch tag | POST /upload/toy-photo; PATCH /toys/:id | bucket toy-photos-library | – | – | – |
| W08 | offer type | PATCH /toys/:id | toys | – | – | – |
| W09 | "Publish to the Toy Library" | PATCH /toys/:id/publish | toys | – | library | – |
| W10 | "Delete toy" | DELETE /toys/:id | toys | – | – | – |
| W11 | picks mode / "Save picks" | PATCH /toys/:id; PUT /toys/:id/picks | toys, toy_picks | – | – | – |
| W12 | "N offers on this toy" row | GET /toy-transactions (mount only) | – | – | stale after acting | – |

## Exchanges
| ID | Element → handler | API | DB | Notif | Badge | Setter |
|---|---|---|---|---|---|---|
| X01 | list load / pull / filter | GET /toy-transactions | toy_transactions | – | Me "My exchanges" | – |
| X02 | thread load | GET /toy-transactions/:id | toy_transactions, messages | – | – | – |
| X03 | "Send" message | POST /toy-transactions/:id/messages | toy_transaction_messages | `toy_message` | inbox | – |
| X04 | "Accept" → "Accept request" (+ pickup) | POST /toy-transactions/:id/accept | RPC `accept_toy_transaction`, printers | `toy_accepted` | owner-action count | owner (mobile) |
| X05 | "Decline" | POST …/reject | toy_transactions | `toy_rejected` | – | owner |
| X06 | "Withdraw" | POST …/withdraw | toy_transactions | `toy_withdrawn` | – | requester |
| X07 | "Confirm handoff" (code) | POST …/confirm | toy_transactions, toys, toy_picks | siblings get `toy_rejected` (`toy-transactions.ts:1289`) | counts | both parties |
| X08 | "New code" / "Copy" | POST …/new-code | toy_transactions | – | – | – |
| X09 | "Add to toy library" → /toys/:id/edit | – | – | – | – | – |
| X10 | cost "Add a line" | POST /exchange-costs/:txId | exchange_costs | – | Me money panel | maker |
| X11 | cost "Remove" | DELETE /exchange-costs/:id | exchange_costs | – | money panel | – |
| X12 | "Settled" toggle | PATCH /exchange-costs/:id/settle | exchange_costs | – | "To settle / Settled", Me total | payer (mobile); settlement/receipt endpoints web only |
| X13 | Thank | POST /contributors/:id/thanks {transaction_id} | profile_thanks | `profile_thanked` | – | – |
| X14 | Report | POST /reports | member_reports | – | – | admin web |

## Challenges
| ID | Element → handler | API | DB | Notif | Badge | Setter |
|---|---|---|---|---|---|---|
| C01 | list load (+ "You're in") | GET /public/challenges; GET /ideas/joined | toy_ideas | – | – | admin web promotes/graduates |
| C02 | detail load (tabs) | GET /public/challenges/:id; GET /ideas/mine/:id | toy_ideas | – | – | – |
| C03 | "Join" | POST /ideas/:id/join | toy_idea_participants | `challenge_joined` to author | Me challenges count | – |
| C04 | "Leave" | DELETE /ideas/:id/participants/:profileId | toy_idea_participants | `challenge_left` / `challenge_removed` | – | – |
| C05 | thread "Send" | POST /ideas/:id/messages | toy_idea_messages | – | – | – |
| C06 | "Mark as the answer" / "Unmark" | POST /ideas/:id/answer | toy_idea_messages | – | – | author |
| C07 | "Add a constraint" | POST /ideas/:id/constraints | constraints | – | – | author |
| C08 | "Withdraw the idea" | DELETE /ideas/:id | toy_ideas | – | – | author |
| C09 | "Submit a revised idea" | – (→ form `?from=`) | – | – | – | – |
| C10 | "Read the guide" / "Follow the write-up" | – | – | – | – | admin graduates (web) |
| C11 | Save heart | POST/DELETE /saves (challenges) | saves; `save_count()` | – | "N saves" tile | – |
| C12 | "Submit idea" | POST /ideas | toy_ideas (status pending) | none until admin: `idea_approved`/`idea_rejected` (`admin.ts:316`) | My challenges "Awaiting review" | **admin web `/admin/ideas`** |
| C13 | idea photo | POST /upload/idea-photo | toy-photos | – | – | – |
| C14 | "Post anonymously" | (in C12) | toy_ideas.anonymous | – | – | – |
| C15 | My challenges list / stage filter | GET /ideas/mine | toy_ideas | – | – | – |

## Makers wanted and builds
| ID | Element → handler | API | DB | Notif | Badge | Setter |
|---|---|---|---|---|---|---|
| K01 | board tabs / range / "Show more" | GET /toy-transactions/open-builds; /builds-board | toy_transactions | – | Me "Makers wanted" count | – |
| K02 | "I'll build this" (claim) | POST /toy-transactions/:id/claim | toy_transactions | `toy_accepted` to family | – | maker |
| K03 | Ask first "Send" | POST /toy-transactions/:id/questions | build_request_questions | `build_question` | – | – |
| K04 | Ask first "I'll build this" | POST …/claim | same as K02 | `toy_accepted` | – | – |
| K05 | "Post to Makers wanted" | POST /toy-transactions/build | toy_transactions (build), tutorials | `toy_request` to org/leaders | – | – |
| K06 | thread "Take it on" (+ pickup) | POST …/accept | RPC | `toy_accepted` | – | maker |
| K07 | "Decline" | POST …/reject | – | `toy_rejected` | – | – |
| K08 | "Post the working shot" | POST /toy-transactions/:id/working-shot | storage (057 policy) | `build_shot_posted` | – | maker |
| K09 | "Looks right — arrange pickup" | POST …/approve-work | toy_transactions | `build_approved` | – | family |
| K10 | "Ask for a change" | local draft text | – | – | – | – |
| K11 | "Confirm handover" | POST …/confirm | – | – | – | both |
| K12 | "Withdraw" | POST …/withdraw | – | `toy_withdrawn` | – | – |
| K13 | message Send | POST …/messages | – | `toy_message` | – | – |
| K14 | "Track" / "Thread" | – | – | – | – | – |

## Printing
| ID | Element → handler | API | DB | Notif | Badge | Setter |
|---|---|---|---|---|---|---|
| R01 | finder filters: Open now/material/10 km/Verified | GET /printers[?near=]; GET /public/tutorials/:id | printers | – | – | **Verified set by admin web `/admin/test-prints`** |
| R02 | Pick / Unpick (max 3) | local | – | – | – | – |
| R03 | "Send request" (parts, qty, colour, delivery, credit) | POST /toy-transactions/print | toy_transactions, print_job_files, stl_files; RPC `recycling_credit_balance` | `toy_request` to printer | printer's "Print for others" count | printer (R13) |
| R04 | job load | GET /toy-transactions/:id; /printers/:id; /exchange-costs/:id | toy_transactions, printers | – | – | – |
| R05 | job message | POST …/messages | – | `toy_message` | – | – |
| R06 | "Withdraw request" | POST …/withdraw | – | `toy_withdrawn` | – | – |
| R07 | "Started printing" | POST …/print-started | toy_transactions | `print_started` | stage rail | printer (mobile) |
| R08 | "Mark ready for pickup" (photo) | POST …/print-ready (multipart) | toy_transactions, storage | `print_ready` | stage rail | printer |
| R09 | printer "Confirm" code | POST …/confirm | – | – | – | – |
| R10 | "Fitted" / "Needs a reprint" | POST …/print-fit | toy_transactions | `toy_message` (fit note) | printer stats | requester |
| R11 | "Say thanks to the printer" | POST /contributors/:id/thanks | profile_thanks | `profile_thanked` | – | – |
| R12 | offer tabs | GET /printers/mine; /toy-transactions | – | – | tab counts | – |
| R13 | "Accept" (machine, pickup) | POST …/accept | RPC | `toy_accepted` | – | printer |
| R14 | "Decline…" (+ reason) | POST …/reject | – | `toy_rejected` | – | printer |
| R15 | "Get verified" | POST /printers/:id/test-prints | printer_test_prints, bucket printer-test-prints | – (**admin result not notified**) | "Verified" shield | **admin web** (PATCH /admin/test-prints/:id) |
| R16 | accepting toggle | PATCH /printers/:id | printers | – | finder availability | – |
| R17 | "Add a printer" | POST /printers | printers | – | – | – |
| R18 | My print requests list | GET /toy-transactions | – | – | Me count | – |
| R19 | basics → "Find a printer" | – | – | – | – | hero photo PENDING |

## Events, recycling, saved
| ID | Element → handler | API | DB | Notif | Badge | Setter |
|---|---|---|---|---|---|---|
| V01 | My events load | GET /events/mine | org_event_registrations, org_events | – | – | registering: web only |
| V02 | "Can't make it" | DELETE /events/:id/registrations | org_event_registrations | – | – | – |
| V03 | "Pick a printer" → /printing | – | – | – | – | – |
| V04 | recycling load | GET /public/organizations; /organizations/recycling/mine; /recycling/credit | recycling_dropoffs | – | credit | – |
| V05 | "Book the drop-off" (+ photo) | POST /organizations/:id/recycling; POST /upload/recycling-photo | recycling_dropoffs; bucket recycling-photos (private) | – (**leader not notified**) | leader intake count | leader (L13/L14) |
| V06 | "Cancel the drop-off" | POST /organizations/:id/recycling/:id/cancel | recycling_dropoffs | – | – | – |
| V07 | Saved hub tiles | GET /saves/ids | saves | – | counts | – |
| V08 | list heart unsave | DELETE /saves/:slug/:id | saves | – | list/hub count | – |
| V09 | list row open | GET /saves/:slug | – | – | – | – |

## Account
| ID | Element → handler | API | DB | Notif | Badge | Setter |
|---|---|---|---|---|---|---|
| Z01 | display name (blur save) | PATCH /contributors/me | profiles | – | Me greeting | – |
| Z02 | "What you do" | PATCH /contributors/me | profiles | – | – | – |
| Z03 | Postcode | PATCH /contributors/me (pickup_postcode) | profiles | – | distance in finder/map | – |
| Z04 | "Sign Out" | Supabase signOut | – | – | – | – |
| Z05 | Delete account: preview → code → DELETE | GET /me/deletion; Supabase OTP; DELETE /me | RPC `account_deletion_preview`, `delete_account`; toy_transactions, notifications | confirmation email (off until `email-delivery`); counterparts' notices | – | – |
| Z06 | "+ Add a child" | POST /child-profiles | child_profiles | – | child list | – |
| Z07 | child field edits (autosave) | PATCH /child-profiles/:id (`use-child-profile:84`) | child_profiles | – | "Recommended" order in library | – |
| Z08 | "Delete profile" | DELETE /child-profiles/:id | child_profiles | – | – | – |
| Z09 | wizard Continue / Skip / Finish | POST/PATCH /child-profiles | child_profiles | – | – | – |
| Z10 | "Open web dashboard", privacy links | Linking | – | – | – | – |

## Me, inbox, map, explore, admin
| ID | Element → handler | API | DB | Notif | Badge | Setter |
|---|---|---|---|---|---|---|
| Q01 | Me load | GET /exchange-costs/mine, /me/builds, /me/counts (mount only) | many | – | row counts, money panel | – |
| Q02 | Me row → `myRoute()` | – | – | – | – | – |
| Q03 | money line → thread | – | – | – | – | – |
| Q04 | "How badges are earned" | – | – | – | – | – |
| Q05 | inbox load / pull / segment | GET /notifications/me, /toy-transactions, /collaborators/me/invites | notifications | – | – | – |
| Q06 | notification row tap (`open`) | PATCH /notifications/:id {read} then `invalidateCapabilities` | notifications | – | inbox + Today count | – |
| Q07 | bucket "Mark read" | POST /notifications/me/read | notifications | – | bucket + tab badge | – |
| Q08 | invite "Accept" | POST /collaborators/invites/:id/accept | tutorial_contributors, tutorial_collaborator_invites | `collaborator_accepted` to inviter | – | – |
| Q09 | invite "Decline" | POST …/decline | same | `collaborator_declined` | – | – |
| Q10 | exchange thread card | PATCH read + push by `threadHref` | – | – | unread per thread | – |
| Q11 | map load / search / layer chips / filters | GET /public/map[?near=] | orgs, events, printers, drop-offs | – | – | – |
| Q12 | map row → route | – | – | – | – | – |
| Q13 | Explore search | GET /public/tutorials, /toys, /organizations | – | – | – | – |
| Q14 | Explore doors | – (+ GET /public/impact) | – | – | impact stats | – |
| Q15 | Learn hub / article "Next" (tick) | GET /public/learn-course; device progress | site_content | – | "Continue" card | content: admin web `/admin/content` |
| Q16 | About LinkRows → web | Linking | – | – | – | – |
| Q17 | Admin cards → web | GET /admin/counts | many | – | six counts | decisions: web only |

# 3. Existing tests

## 3a. Mobile unit (`packages/mobile/tests/unit`, 243 files)
Directory key: c/ = components/, l/ = lib/, a/ = app/.

| File | Covers |
|---|---|
| a/admin, admin-edges | Admin cards and counts, failed-count fallback |
| a/auth-layout, auth-screens, auth-screens-edge | Auth stack, welcome/sign-in/create/verify/forgot/reset, 44 edge inputs |
| a/guides-new, guides-new-edges | New-guide form: create, PDF import, cover, validation |
| a/hidden-tab-back, shortcut-back-routes | ✕/back on pushed screens |
| a/map-tab | Map load, search, filters, rows |
| a/me, me-edges | Me rows, money panel, counts, greeting |
| a/not-built-layout, root-layout, tabs-layout, tabs-layout-badges | Layouts, tab badges |
| a/terms-gate-and-guards | Terms gate, accept transaction, guards |
| a/toys-new, toys-new-edges | Create toy |
| a/tutorial-editor-back | Editor back |
| c/account/delete-account(+edges) | Delete flow, sole-leader, reauth |
| c/auth/parts(+behaviour) | SocialButtons, large-text |
| c/builds/ask-first, ask-for-build, build-thread, makers-wanted (+edges each) | Questions, post request, build thread actions, board tabs |
| c/challenges/challenge-status, challenge-edges | Pills, tiles |
| c/challenges/detail, list, my, submit-idea (+edges) | Challenge screens: join/leave/message/answer/constraint/withdraw/submit |
| c/date-time-field, event-form-date | Date field, event date |
| c/events/my-events-screen | Load, cancel registration |
| c/exchanges/cost-panel, list, thread (+edges) | Costs, list rows, thread actions and composer |
| c/explore/about, article(+edges), explore(+edges), learn-hub | Explore and Learn |
| c/guides/build-mode, community-notes(+edges, -report), feedback-sheet, guide-parts, guide-tools(+edges), model-screen, picks-row, provenance, showcase-screen | Reader features |
| c/header-add-button | Header add button |
| c/home/add-shortcut-sheet, detail-screen(+actions), home-screen, home-today-edges, library-screen, preview-screen, recent-rows(+cold-start), shortcut-grid | Home and guide detail |
| c/inbox/inbox-screen, inbox-edges | Inbox rows, mark-read, invites, failures |
| c/library/filter-page | Filter page |
| c/my-toys/editor(+edges, -suits), list(+edges), picks-editor/-edges, summary(+edges) | Toy editor, list, picks, summary |
| c/my-tutorials/* (backing, details, files, hub, hub-journey, items, list, picks, safety, save-chip, section-footer, steps, stl, suits) | Authoring sections |
| c/organisation/event-form, inventory, org-conversation, org-invites, org-leaders-section, org-profile-edit, org-profile-screen(+edges), org-publish-story, org-requests-messages, review-detail, review-queue | Org screens |
| c/people/thank-button(+edges) | Thank button |
| c/printing/actions, add-printer, basics, find, job, job-screen-message, offer, request, requests (+edges) | Printing |
| c/profile-screen(+edges), c/profile/child-editor-home, child-profile-edges, child-profile-home, child-wizard, fields | Account and child |
| c/recycling/intake, recycling (+edges) | Recycling |
| c/reports/report-problem(+edges, -note) | Report sheet |
| c/saved/saved-edges, saved-list-screen, saved-screen | Saved |
| c/tab-bar, tab-bar-badges | Tab bar |
| c/toys/organisations-screen, request-block(+edges), toy-detail(+edges), toy-library(+edges, -screen) | Toy library |
| c/ui/* (16 files) | UI primitives |
| l/api-client, auth-context(+flows), auth-errors(+edge) | Core client and auth |
| l/builds(+edges), capabilities(+edges), close-to-tabs, confirm, dark-mode | Pure rules |
| l/exchange-cost-money, exchange-rules, guide-draft-rules, guide-files, guide-focus | Pure rules |
| l/guide-notes(+journey), guide-progress(+accounts, +journey), home-shortcuts(+journeys) | Device-local state |
| l/layout, learn, library-filters, map-filters, my-routes, my-toy | Pure rules |
| l/notifications(+edges) | `linkFor`, COPY |
| l/printing(+edges), recents(+journeys), recycling, recycling-credit-rules, review-checklist, saves(+journey) | Pure rules and hooks |
| l/sentences, social-auth(+providers), stl-viewer-html, supabase-storage(+failures), theme, tutorial-sections, type-scale | Utilities |
| l/upload(+failures), use-auth-gate, use-child-profile(+edges), use-tutorial-draft(+journey) | Upload and drafts |

## 3b. Mobile e2e (`packages/mobile/tests/e2e`, 39 specs)
Drive the Expo web build against a real API on local Supabase.

| Spec | Journeys covered |
|---|---|
| auth | A01, A02, A04, A05, A06, A09/A10, A11, A13, Z04 |
| auth-edges | Code paste, resend countdown, terms-gated Create, short password, deep-link gate, sign-out gate, child wizard (`test.skip` at :126 for postcode) |
| auth-special-characters | Sign-up with special-character name, email and password |
| account-deletion | Z05 |
| child-profile, child-profile-home | Z06, Z07, Z09 |
| navigation | H07, Account page, shortcut back |
| my-splat | Q01, Q02 |
| home | H01 (badge drop), H03, H06 |
| home-shortcuts | H04, H05, corrupt storage |
| recents | H06 |
| inbox | Q05, Q06, Q07, empty state |
| explore | Q13, Q15, Q14 (reached by `goto('/explore')`) |
| guides-library, guides-library-edges | G01, G02, G03, G04, G06, hostile text, 300-char title, save races, Saved shelf retry |
| guides-filter-page | G03 |
| guides-detail | G05, G11, G12, G13, G16, G20, G29 |
| guides-hero-photos, guides-pdf, guides-showcase | G11, G17, S01, S04 |
| guides-save, saved | G06, G08, V07, V08, V09 |
| guides-thanks, guides-report, guides-feedback (was guides-notes) | G09, G10, G23–G28 |
| guides-reader-journeys, guides-build-mode, guides-close-trail | G14, G22, G23, G28, B01, B02, B03, B04 (Task 11), B05 |
| guides-files (Task 11) | Files tab, 3D route shell, web link |
| guides-handoff | G18, G19, R03 |
| guides-authoring, guides-authoring-edges | N06, T01, T05, T06, T08–T14, T22, N03 |
| organisation | T18, L01, L04, L06, L07 (note required), L08, non-leader screen |
| toy-library | Y01, Y02, Y05, offer-type gating |
| toy-exchange-edges, exchanges | W02, X02, X03, X04, X06, X07, Y06 |
| challenges, challenges-edges | C01, C02, C03, C05, C10, C12, C14, C15 |
| makers-wanted | K01, K02, K05, K14 (spec states Ask-first thread and working shot are not covered) |
| printing | R03, R06, R12 (empty), R17, R19, R02 |

## 3c. API integration (`packages/api/tests/integration`)
| Group | Files and routes |
|---|---|
| account-deletion | delete (GET/DELETE /me, /me/deletion), placeholder-readable |
| admin | counts (GET /admin/counts); queues (inbox, member-reports, content, contact, reports); report-kinds (POST /reports); reports (admin/reports, participant removal); site-content-writes (PUT /admin/content/:key) |
| auth | role-assignment, role-removal, shared-capability, signup-terms (POST /agreements) |
| child-profiles | crud, play-measurements |
| collaborators | collaborators-endpoints (invite/remove); invite-answers (accept/decline, GET /collaborators/me/invites); invite-handshake |
| contributors | patch-me, profile-escalation, profile-thanks (POST /contributors/:id/thanks, `me/thanks/:p`) |
| events | events (org events, questions, registrations, public events and .ics) |
| exchange-costs | editing, mine, outstanding (GET/POST/DELETE/PATCH settle) |
| guides | board-extras, builds (POST /tutorials/:id/build, /me/builds), mine, notes (notes, pin/unpin, upload/note-photo), part-prices, photo-captions, print-settings, safety-notes, search-parts, tool-notes, views, works-with |
| me | counts (GET /me/counts) |
| notifications | body, notifications-endpoints (GET /me, `unread-count` singular, PATCH /:id), review-notifications, rls |
| orgs | admin-accounts, admin-authority, admin-endpoints, agreements, backing-endpoints (orgs accept/decline), backing-handshake, collaboration, contributor-claim, leaders, org-profile-social (follow/thanks/conversations/doors/rate-lines), org-screens, organizations-route, public-backing, read-grant, recycling-details/-intake/-photo, review-endpoint (POST /review), review-grant, stories, withdrawal |
| parts-tools | cascade, recommendations, rls |
| postcodes | `postcodes.test.ts` |
| printers | answer-by, fit-notes, part-sizes, postcode-grant, print-fit, print-groups, print-quantity, printer-stats, printers (accept/reject/print-started/print-ready/confirm), recycling-credit, verified (test-prints, admin/test-prints) |
| public | contributor-*, geocode, home-content, impact(-map), learn-course, map, near, notify, org-*, organizations, printable-parts |
| saves | saves, saved-meta |
| schema-version | `/health` |
| storage | org-toy-photos, storage-gate, toy-photos, upload |
| toy-ideas | anonymous, constraints, graduation, idea-lifecycle, maker-meta, my-meta, optional-fields, photo, questions, save-count, withdraw, writeup |
| toy-transactions | accept, action-count, build-note, builds-board, builds (working-shot, approve-work), confirm, create, messages, new-code, open-builds (claim), org-handoff, print-settings-embed, questions, reject-withdraw, row-meta, toy-photo |
| toys | crud (incl. publish), holder-location, org-inventory, paused, picks, public, public-org-stock, retired |
| tutorials | delete-draft-only, import-pdf, patch-allowlist, patch-conflict, public, rls, status-flow, steps, thanks, updated-at, upsert-idempotency |
| user-text | special-characters |

## 3d. API unit (`packages/api/tests/unit`)
| File | Covers |
|---|---|
| routes/admin, child-profiles, contributors, notifications (mocked `me/read`, `unread-counts`), organizations-recycling-limits, parts, public-views, recommendations, stl-files, tools, toy-ideas (reports, challenge_*), toy-transactions, toys, tutorial-field-error, tutorial-orgs, tutorials, upload | Route handlers with a mocked DB |
| review-notifications | `backing_requested` / `tutorial_submitted` creation (unit only) |
| middleware/auth, apple-revoke, buy-links, chunk, distance, former-contributor, ics, last-authenticated-at, mailer, map, pdf-import/parse, pending-features, pending-registry, postcode-centroids, report-kinds-drift, single-row, suits | Helpers |

## 3e. Maestro (`packages/mobile/.maestro`)
| Flow | Proves on device |
|---|---|
| flows/every-tab-renders | Hermes smoke: sign in, each tab renders, Inbox shows a seeded notification row |
| flows/guide-page | Hero paging swipe, build mode Start step 1 → Next → ✕ "Pick up at step 2", header ✕ closes to library with tab bar |
| flows/home-shell | Home Edit/Done, shortcut tiles and back, "Inbox, 1 unread", Add-a-shortcut formSheet and search |
| flows/session-survives-cold-start | Session persists across `stopApp` and relaunch |
| flows/sign-out-clears-session | Sign-in then sign-out; **stale** (S15) |
| flows/toy-photos-carousel | Native paging and Reanimated dots on a toy |
| parity/sign-in, parity/confirm-open, subflows/launch | Picture-pass helpers, not assertions |

# 4. Coverage map
U = mobile unit, E = mobile e2e, A = API integration, D = Maestro. "n/a" = no API call. ◐ = partial.

| ID | U | E | A | D |
|---|---|---|---|---|
| A01 | ✅auth-screens | ✅auth | n/a | ❌ |
| A02 | ✅auth-screens | ✅auth | n/a | ✅every-tab |
| A03 | ✅auth/parts-behaviour | ✅auth:139 | n/a | ❌ |
| A04 | ✅auth-screens-edge | ✅auth, auth-edges, auth-special-characters | ❌ trigger only via auth/role-assignment | ❌ |
| A05 | ✅auth-context-flows | ✅auth | n/a | ✅every-tab, cold-start |
| A06 | ✅auth-screens | ✅auth | n/a | ❌ |
| A07 | ✅auth-screens-edge | ✅auth, auth-edges | n/a | ❌ |
| A08 | ✅auth-screens-edge | ✅auth-edges:49 | n/a | ❌ |
| A09, A10 | ✅auth-screens | ✅auth:94, auth-edges:82 | n/a | ❌ |
| A11 | ✅terms-gate-and-guards | ✅auth:114 | ✅auth/signup-terms | ❌ |
| A12 | ✅terms-gate-and-guards | ❌ | n/a | ❌ |
| A13 | ✅not-built-layout | ✅auth:139 | n/a | ❌ |
| A14 | ✅auth-context | ✅navigation, auth-edges | ✅orgs/agreements | ✅cold-start |
| H01 | ✅home-screen, home-today-edges | ✅home:66 | ❌ unread-counts unit-only | ✅home-shell |
| H02 | ✅home-screen | ✅home:54 | n/a | ✅home-shell |
| H03 | ✅shortcut-grid | ✅home:46, navigation | n/a | ✅home-shell |
| H04 | ✅shortcut-grid | ✅home-shortcuts:25 | n/a | ❌ |
| H05 | ✅add-shortcut-sheet | ✅home-shortcuts:60 | n/a | ✅home-shell |
| H06 | ✅recent-rows | ✅recents, home:17 | n/a | ❌ |
| H07 | ✅tab-bar-badges | ✅navigation | ✅toy-transactions/action-count (unread-counts ❌) | ✅every-tab |
| G01 | ✅library-screen | ✅guides-library | ✅tutorials/public | ✅every-tab |
| G02 | ✅library-screen | ✅guides-library | ✅guides/search-parts | ❌ |
| G03 | ✅filter-page | ✅guides-filter-page | n/a | ❌ |
| G04 | ✅library-screen | ✅guides-library-edges | n/a | ❌ |
| G05 | ✅library-screen | ✅guides-detail | n/a | ✅guide-page |
| G06 | ✅SaveButton, saves-journey | ✅guides-library:111 | ✅saves/saves | ❌ |
| G07 | ✅library-screen | ❌ | n/a | ❌ |
| G08 | ✅detail-screen-actions | ✅guides-save | ✅saves/saves | ❌ |
| G09 | ✅detail-screen-actions | ✅guides-thanks | ✅tutorials/thanks (notif row only via one file) | ❌ |
| G10 | ✅report-problem | ✅guides-report | ✅admin/queues | ❌ |
| G11 | ✅PhotoCarousel | ✅guides-hero-photos | n/a | ✅guide-page |
| G12 | ✅provenance | ✅guides-detail | ✅public/contributor-profile | ❌ |
| G13 | ✅detail-screen | ✅guides-detail:165 | n/a | ❌ |
| G14 | ✅detail-screen | ✅guides-reader-journeys:9 | n/a | ❌ |
| G15 | ✅detail-screen | ✅guides-build-mode | n/a | ✅guide-page |
| G16 | ✅preview-screen | ✅guides-detail:27 | ❌ signed URL is client-side | ❌ |
| G17 | ✅preview-screen | ✅guides-pdf | n/a | ❌ |
| G18 | ✅detail-screen | ✅guides-handoff:29 | n/a | ❌ |
| G19 | ✅detail-screen | ✅guides-handoff:74 | ✅toy-transactions/builds | ❌ |
| G20 | ✅picks-row | ✅guides-detail:139 | ✅parts-tools/recommendations | ❌ |
| G21 | ✅guide-parts | ❌ | n/a | ❌ |
| G22 | ✅guide-tools | ✅guides-reader-journeys:73 | n/a | ❌ |
| G23 | ✅feedback-sheet | ✅guides-reader-journeys:87,112 | ✅guides/notes | ❌ |
| G24 | ✅feedback-sheet | ✅guides-notes:123 (now guides-feedback) | ✅guides/notes | ❌ |
| G25 | ✅community-notes | ❌ (Task 11 adds) | n/a | ❌ |
| G26 | ✅community-notes | ✅guides-feedback | ✅guides/notes | ❌ |
| G27 | ✅community-notes-report | ✅guides-feedback | ✅admin/queues | ❌ |
| G28 | ✅community-notes | ✅guides-feedback | ✅guides/notes | ❌ |
| G29 | ✅detail-screen | ✅guides-detail:39,54 | n/a | ❌ |
| B01 | ✅build-mode | ✅guides-build-mode, reader-journeys | n/a | ✅guide-page |
| B02 | ✅build-mode | ✅guides-build-mode:41 | n/a | ❌ |
| B03 | ✅build-mode | ✅guides-build-mode:110,139 | ✅guides/builds | ❌ |
| B04 | ✅build-mode, feedback-sheet | ✅ (Task 11) | ✅guides/notes | ❌ |
| B05 | ✅hidden-tab-back | ✅guides-close-trail | n/a | ✅guide-page |
| B06 | ✅build-mode | ✅guides-build-mode:15 | n/a | ❌ |
| B07 | ✅build-mode | ❌ | n/a | ❌ |
| S01 | ✅showcase-screen | ✅guides-showcase | ✅public/contributor-profile | ❌ |
| S02 | ✅thank-button | ❌ | ✅contributors/profile-thanks | ❌ |
| S03 | ✅report-problem | ❌ | ✅admin/report-kinds | ❌ |
| S04 | ✅showcase-screen | ✅guides-showcase:26 | ✅public/org-profile | ❌ |
| N01 | ✅guides-new | ✅guides-authoring | n/a | ❌ |
| N02 | ✅guides-new-edges | ❌ | ✅tutorials/import-pdf | ❌ |
| N03 | ✅guides-new-edges | ✅guides-authoring-edges:211,220 | ✅storage/upload | ❌ |
| N04 | ✅guides-new | ✅guides-authoring | n/a | ❌ |
| N05 | ✅guides-new, terms-gate | ❌ (helper pre-accepts) | ✅orgs/agreements | ❌ |
| N06 | ✅guides-new | ✅guides-authoring, -edges | ✅tutorials/upsert-idempotency, rls | ❌ |
| T01 | ✅my-tutorials/list-screen | ✅guides-authoring-edges:151,178 | ✅guides/mine, views | ❌ |
| T02 | ✅list-screen | ❌ | n/a | ❌ |
| T03 | ✅list-screen | ✅guides-authoring-edges:178 | n/a | ❌ |
| T04 | ✅hub | ✅guides-authoring-edges:126 | n/a | ❌ |
| T05 | ✅hub-journey | ✅guides-authoring | ✅tutorials/status-flow; `tutorial_submitted` row ❌ (unit/review-notifications only) | ❌ |
| T06 | ✅hub-journey | ✅guides-authoring-edges:136–167 | ✅tutorials/delete-draft-only | ❌ |
| T07 | ✅hub | ❌ | n/a | ❌ |
| T08 | ✅details-section, use-tutorial-draft | ✅guides-authoring-edges:37,50,64 | ✅tutorials/patch-allowlist, patch-conflict | ❌ |
| T09 | ✅items-section | ✅guides-authoring | ✅parts-tools/rls, guides/part-prices, tool-notes | ❌ |
| T10 | ✅steps-section | ✅guides-authoring-edges:83,100,114 | ✅tutorials/steps | ❌ |
| T11 | ✅steps-section | ❌ | ✅tutorials/steps | ❌ |
| T12 | ✅safety-section | ✅guides-authoring | ✅guides/safety-notes | ❌ |
| T13 | ✅files-section | ✅guides-authoring-edges:211,220 (caption/cover ❌) | ✅guides/photo-captions, storage/upload | ❌ |
| T14 | ✅files-section | ✅guides-authoring, -edges:200 | ✅storage/upload | ❌ |
| T15 | ✅stl-section-edges | ◐ rejection only (-edges:235) | ✅printers/part-sizes, storage/upload | ❌ |
| T16 | ✅picks-section | ❌ | ✅parts-tools/recommendations | ❌ |
| T17 | ✅suits-section | ❌ | ◐ patch-allowlist | ❌ |
| T18 | ✅backing-section | ✅organisation:17 | ✅orgs/backing-endpoints; `backing_requested` row ❌ | ❌ |
| T19 | ✅backing-section | ❌ | ✅orgs/backing-endpoints | ❌ |
| T20 | ✅save-chip | ✅guides-authoring-edges:64 | n/a | ❌ |
| T21 | ✅section-footer | ❌ | n/a | ❌ |
| T22 | ✅use-tutorial-draft | ✅guides-authoring-edges:178,188 | ✅tutorials/status-flow | ❌ |
| L01 | ✅review-queue-screen | ✅organisation:17 | ✅orgs/read-grant | ❌ |
| L02 | ✅review-queue-screen | ✅organisation:17 | n/a | ❌ |
| L03 | ✅review-detail-screen | ❌ | n/a | ❌ |
| L04 | ✅review-detail-screen | ✅organisation:17 | ✅orgs/backing-endpoints | ❌ |
| L05 | ✅review-detail-screen | ❌ | ✅orgs/backing-endpoints | ❌ |
| L06 | ✅review-detail-screen | ✅organisation:17 | ✅orgs/review-endpoint (no notification asserted) | ❌ |
| L07 | ✅review-detail-screen | ✅organisation:48 | ✅orgs/review-endpoint | ❌ |
| L08 | ✅inventory-screen | ✅organisation:72 | ✅toys/org-inventory | ❌ |
| L09 | ✅inventory-screen | ❌ | ◐ toys/retired | ❌ |
| L10 | ✅inventory-screen | ❌ | ✅toys/org-inventory | ❌ |
| L11 | ✅offer-screen | ❌ | ✅toy-transactions/org-handoff | ❌ |
| L12 | ✅intake-screen | ❌ | ✅orgs/recycling-intake | ❌ |
| L13 | ✅intake-edges | ❌ | ✅orgs/recycling-intake, printers/recycling-credit | ❌ |
| L14 | ✅intake-edges | ❌ | ✅orgs/recycling-intake | ❌ |
| L15 | ✅intake-screen | ❌ | ✅orgs/recycling-details | ❌ |
| L16 | ✅org-requests-messages | ❌ | ◐ org-handoff | ❌ |
| L17 | ✅org-requests-messages | ❌ | n/a | ❌ |
| L18 | ✅org-publish-story | ❌ | ✅orgs/stories, events/events | ❌ |
| L19 | ✅event-form-screen | ❌ | ✅events/events | ❌ |
| L20 | ✅org-publish-story | ❌ | ✅orgs/stories | ❌ |
| L21 | ✅org-publish-story | ❌ | ✅events/events, orgs/stories | ❌ |
| L22 | ✅org-publish-story | ❌ | ✅events/events, orgs/stories | ❌ |
| L23 | ✅org-profile-edit-screen | ❌ | ✅orgs/org-profile-social | ❌ |
| L24 | ✅org-profile-edit-screen | ❌ | ✅orgs/org-profile-social | ❌ |
| L25 | ✅org-leaders-section | ❌ | ✅orgs/leaders (mail not asserted) | ❌ |
| L26 | ❌ | ❌ | ❌ | ❌ |
| L27 | ✅org-leaders-section | ❌ | ✅orgs/leaders | ❌ |
| L28 | ✅org-requests-messages | ❌ | ✅orgs/org-profile-social | ❌ |
| L29 | ✅org-conversation-screen | ❌ | ✅orgs/org-profile-social | ❌ |
| L30 | ✅org-publish-story | ❌ | ✅events/events, orgs/stories | ❌ |
| L31 | ✅org-invites (decline DELETE ✅) | ❌ | ◐ orgs/leaders (accept only) | ❌ |
| P01 | ✅org-profile-screen(+edges) | ✅guides-showcase:26 | ✅public/org-profile | ❌ |
| P02 | ◐ follow only (org-profile-screen:101) | ❌ | ✅orgs/org-profile-social | ❌ |
| P03 | ✅org-profile-screen | ❌ | ✅orgs/org-profile-social | ❌ |
| P04 | ✅org-profile-screen, thank-button | ❌ | ✅orgs/org-profile-social | ❌ |
| P05 | ✅org-profile-screen | ❌ | n/a | ❌ |
| P06 | ✅org-profile-screen | ❌ | n/a | ❌ |
| P07 | ✅org-profile-screen | ❌ | ✅orgs/org-profile-social | ❌ |
| P08 | ✅org-profile-screen | ✅guides-showcase:26 | n/a | ❌ |
| P09 | ✅report-problem | ❌ | ✅admin/queues | ❌ |
| P10 | ✅org-conversation-screen | ❌ | ✅orgs/org-profile-social | ❌ |
| Y01 | ✅toy-library-screen | ✅toy-library:22,44 | ✅toys/public, public/near | ❌ |
| Y02 | ✅SaveButton | ✅toy-library:75 | ✅saves/saves | ❌ |
| Y03 | ✅toy-library-screen | ✅toy-library | n/a | ✅toy-photos-carousel |
| Y04 | ✅toy-detail-screen | ✅toy-library:100 | ✅toys/public, paused, picks, holder-location | ✅toy-photos-carousel |
| Y05 | ✅request-block | ✅toy-library:100, exchanges:61 | ✅toy-transactions/create (`toy_request` row ❌) | ❌ |
| Y06 | ✅request-block-edges | ✅exchanges:185 | ✅toy-transactions/create | ❌ |
| Y07 | ✅toy-detail-screen, item-actions | ❌ | ✅saves/saves, contributors/profile-thanks | ❌ |
| Y08 | ✅toy-detail-screen | ❌ | n/a | ❌ |
| Y09 | ✅organisations-screen | ❌ | ✅public/organizations | ❌ |
| W01 | ✅my-toys/list-screen | ✅toy-exchange-edges:36 | ✅toys/crud | ❌ |
| W02 | ✅toys-new | ✅toy-exchange-edges:36,51 | ✅toys/crud, org-inventory | ❌ |
| W03 | ✅summary-screen | ❌ | ✅toy-transactions/accept (`toy_accepted` row ❌) | ❌ |
| W04 | ✅summary-edges | ❌ | ✅toys/paused | ❌ |
| W05 | ✅summary-screen | ❌ | ✅toys/retired | ❌ |
| W06 | ✅editor, editor-edges | ❌ | ✅toys/crud | ❌ |
| W07 | ✅editor | ❌ | ✅storage/toy-photos | ❌ |
| W08 | ✅editor | ❌ | ✅toys/crud | ❌ |
| W09 | ✅editor | ❌ | ✅toys/crud | ❌ |
| W10 | ✅editor | ❌ | ◐ toys/crud | ❌ |
| W11 | ✅picks-editor | ❌ | ✅toys/picks | ❌ |
| W12 | ✅editor | ❌ | ✅toy-transactions/action-count | ❌ |
| X01 | ✅exchanges/list-screen | ✅exchanges:61 | ✅toy-transactions/* | ❌ |
| X02 | ✅thread-screen | ✅exchanges:61,185 | ✅toy-transactions/create | ❌ |
| X03 | ✅thread-edges | ✅toy-exchange-edges:58 | ✅toy-transactions/messages | ❌ |
| X04 | ✅thread-screen | ✅exchanges:61, toy-exchange-edges:89 | ✅toy-transactions/accept | ❌ |
| X05 | ✅thread-screen | ❌ | ✅toy-transactions/reject-withdraw | ❌ |
| X06 | ✅thread-screen | ✅exchanges:140 | ✅toy-transactions/reject-withdraw | ❌ |
| X07 | ✅thread-screen | ✅exchanges:61, toy-exchange-edges:89 | ✅toy-transactions/confirm | ❌ |
| X08 | ✅thread-screen | ❌ | ✅toy-transactions/new-code | ❌ |
| X09 | ✅thread-screen | ❌ | n/a | ❌ |
| X10 | ✅cost-panel | ❌ | ✅exchange-costs/editing | ❌ |
| X11 | ✅cost-panel | ❌ | ✅exchange-costs/editing | ❌ |
| X12 | ✅cost-panel-edges | ❌ | ✅exchange-costs/outstanding | ❌ |
| X13 | ✅thank-button | ❌ | ✅contributors/profile-thanks | ❌ |
| X14 | ✅report-problem | ❌ | ✅admin/queues | ❌ |
| C01 | ✅challenges/list-screen | ✅challenges:26 | ✅toy-ideas/idea-lifecycle | ❌ |
| C02 | ✅detail-screen | ✅challenges:94, -edges | ✅toy-ideas/maker-meta | ❌ |
| C03 | ✅detail-screen | ✅challenges:40 | ✅toy-ideas/anonymous | ❌ |
| C04 | ✅detail-screen-edges | ❌ | ✅toy-ideas/anonymous | ❌ |
| C05 | ✅detail-screen | ✅challenges:40 | ✅toy-ideas/anonymous | ❌ |
| C06 | ✅detail-screen | ❌ | ✅toy-ideas/questions | ❌ |
| C07 | ✅detail-screen | ❌ | ✅toy-ideas/constraints | ❌ |
| C08 | ✅detail-screen | ❌ | ✅toy-ideas/withdraw | ❌ |
| C09 | ✅submit-idea-screen | ❌ | ◐ toy-ideas/withdraw | ❌ |
| C10 | ✅detail-screen | ✅challenges-edges:44 | ✅toy-ideas/writeup | ❌ |
| C11 | ✅detail-screen | ❌ | ✅toy-ideas/save-count, writeup | ❌ |
| C12 | ✅submit-idea-screen | ✅challenges:72, -edges:12,30 | ✅toy-ideas/optional-fields | ❌ |
| C13 | ✅submit-idea-screen | ❌ | ✅toy-ideas/photo | ❌ |
| C14 | ✅submit-idea-screen | ✅challenges-edges:12 | ✅toy-ideas/anonymous | ❌ |
| C15 | ✅my-screen | ✅challenges:72,94 | ✅toy-ideas/my-meta | ❌ |
| K01 | ✅makers-wanted-screen | ✅makers-wanted:54 | ✅toy-transactions/builds-board, open-builds | ❌ |
| K02 | ✅makers-wanted-screen-edges | ✅makers-wanted:54 | ✅toy-transactions/open-builds | ❌ |
| K03 | ✅ask-first-screen | ❌ (spec says so) | ✅toy-transactions/questions | ❌ |
| K04 | ✅ask-first-screen-edges | ❌ | ✅toy-transactions/questions | ❌ |
| K05 | ✅ask-for-build-screen | ✅makers-wanted:27,54, guides-handoff:74 | ✅toy-transactions/builds | ❌ |
| K06 | ✅build-thread-screen-edges | ❌ | ✅toy-transactions/builds | ❌ |
| K07 | ✅build-thread-screen-edges | ❌ | ◐ builds | ❌ |
| K08 | ✅build-thread-screen-edges | ❌ (spec says so) | ✅toy-transactions/builds (`build_shot_posted` row ❌) | ❌ |
| K09 | ✅build-thread-screen-edges | ❌ | ✅toy-transactions/builds (`build_approved` row ❌) | ❌ |
| K10 | ✅build-thread-screen-edges | ❌ | n/a | ❌ |
| K11 | ✅build-thread-screen-edges | ❌ | ✅toy-transactions/builds | ❌ |
| K12 | ✅build-thread-screen-edges | ❌ | ◐ | ❌ |
| K13 | ✅build-thread-screen-edges | ❌ | ✅toy-transactions/messages | ❌ |
| K14 | ✅makers-wanted-screen | ✅makers-wanted:96 | n/a | ❌ |
| R01 | ✅find-screen | ✅printing:149, guides-handoff | ✅printers/postcode-grant, public/near | ❌ |
| R02 | ✅find-screen | ✅printing:112,149 | n/a | ❌ |
| R03 | ✅request-screen | ✅printing:112, guides-handoff:29 | ✅printers/print-groups, print-quantity, answer-by, recycling-credit | ❌ |
| R04 | ✅job-screen | ✅printing:112 | ✅toy-transactions/print-settings-embed | ❌ |
| R05 | ✅job-screen-message | ❌ | ✅toy-transactions/messages | ❌ |
| R06 | ✅job-screen-edges, actions | ✅printing:112 | ✅printers/print-groups | ❌ |
| R07 | ✅actions, offer-screen | ❌ | ✅printers/printers (`print_started` row ❌) | ❌ |
| R08 | ✅actions | ❌ | ✅printers/printers (`print_ready` row ❌) | ❌ |
| R09 | ✅job-screen | ❌ | ✅printers/printers | ❌ |
| R10 | ✅job-screen | ❌ | ✅printers/print-fit | ❌ |
| R11 | ✅job-screen | ❌ | ✅contributors/profile-thanks | ❌ |
| R12 | ✅offer-screen | ✅printing:56 | ✅printers/printers | ❌ |
| R13 | ✅offer-screen | ❌ | ✅printers/printers, answer-by | ❌ |
| R14 | ✅offer-screen-edges | ❌ | ✅printers/printers | ❌ |
| R15 | ✅actions | ❌ | ✅printers/verified | ❌ |
| R16 | ✅offer-screen-edges | ❌ | ✅printers/printers | ❌ |
| R17 | ✅add-printer-screen | ✅printing:73,95 | ✅printers/printers, printer-stats | ❌ |
| R18 | ✅requests-screen | ✅printing:56,112 | ✅toy-transactions/print-groups | ❌ |
| R19 | ✅basics-screen | ✅printing:56 | n/a | ❌ |
| V01 | ✅my-events-screen | ❌ | ❌ (`/events/mine` untested) | ❌ |
| V02 | ✅my-events-screen | ❌ | ✅events/events | ❌ |
| V03 | ✅my-events-screen | ❌ | n/a | ❌ |
| V04 | ✅recycling-screen | ❌ | ✅orgs/org-screens, printers/recycling-credit | ❌ |
| V05 | ✅recycling-screen, upload | ❌ | ✅orgs/recycling-photo, org-screens | ❌ |
| V06 | ✅recycling-screen | ❌ | ✅orgs/org-screens | ❌ |
| V07 | ✅saved-screen | ✅saved:46, guides-library-edges:103 | ✅saves/saves | ❌ |
| V08 | ✅saved-list-screen | ✅saved:8 | ✅saves/saves | ❌ |
| V09 | ✅saved-list-screen | ✅saved:8 | n/a | ❌ |
| Z01, Z02 | ✅profile-screen(+edges) | ❌ | ✅contributors/patch-me | ❌ |
| Z03 | ✅profile-screen-edges | ❌ (`auth-edges:126` is `test.skip`) | ✅contributors/patch-me, printers/postcode-grant | ❌ |
| Z04 | ✅profile-screen | ✅auth:127, child-profile-home:28 | n/a | ❌ (flow stale) |
| Z05 | ✅delete-account-* | ✅account-deletion | ✅account-deletion/delete | ❌ |
| Z06 | ✅child-profile-home | ✅child-profile-home:15 | ✅child-profiles/crud | ❌ |
| Z07 | ✅use-child-profile, child-editor-home | ✅child-profile-home:4, child-profile:8,25 | ✅child-profiles/crud, play-measurements | ❌ |
| Z08 | ✅child-editor-home | ❌ | ✅child-profiles/crud | ❌ |
| Z09 | ✅child-wizard | ✅child-profile:38, auth-edges:136 | ✅child-profiles/crud | ❌ |
| Z10 | ❌ | ❌ | n/a | ❌ |
| Q01 | ✅me, me-edges | ✅my-splat:4 | ✅me/counts, exchange-costs/mine, guides/builds | ✅every-tab |
| Q02 | ✅my-routes, me | ✅my-splat:4 | n/a | ❌ |
| Q03 | ✅me | ❌ | n/a | ❌ |
| Q04 | ✅me | ❌ | n/a | ❌ |
| Q05 | ✅inbox-screen | ✅inbox:20, 85, 91 | ✅notifications-endpoints | ✅every-tab |
| Q06 | ✅inbox-screen | ✅inbox:37 | ✅notifications-endpoints | ❌ |
| Q07 | ✅inbox-screen | ✅inbox:62 | ❌ (`POST /me/read` unit-only) | ❌ |
| Q08 | ✅inbox-screen | ❌ | ✅collaborators/invite-answers | ❌ |
| Q09 | ✅inbox-screen | ❌ | ✅collaborators/invite-answers | ❌ |
| Q10 | ✅inbox-screen | ❌ | n/a | ❌ |
| Q11 | ✅map-tab, map-filters | ❌ | ✅public/map | ◐ every-tab (render only) |
| Q12 | ✅map-tab | ❌ | n/a | ❌ |
| Q13 | ✅explore-screen(+edges) | ✅explore:48,60 | ✅public/* | ❌ |
| Q14 | ✅explore-screen | ✅explore:12 | ✅public/impact | ❌ |
| Q15 | ✅learn-hub, article-screen | ✅explore:22 | ✅public/learn-course | ❌ |
| Q16 | ✅about-screen | ❌ | n/a | ❌ |
| Q17 | ✅admin(+edges) | ❌ | ✅admin/counts | ❌ |

# 5. Suspect list

| # | Finding | Evidence |
|---|---|---|
| S1 | A leader's Approve or Request changes writes no notification, so the author gets no `tutorial_approved` or `tutorial_rejected` row. Only the admin web status route notifies (and sends `body` = the rejection reason). Backing accept and decline create none either. The mobile Inbox renders `tutorial_approved`/`tutorial_rejected` tiles (`inbox-screen.tsx:~71`), but the mobile review path never produces them. No test asserts a notification on `/review`. | `packages/api/src/routes/tutorial-orgs.ts:141-196` and `:106-123` (no insert); `packages/api/src/routes/admin.ts:60-76`; `packages/api/tests/integration/orgs/review-endpoint.test.ts` |
| S2 | Print transactions open the wrong screen. `threadHref` returns `/exchanges/:id` for every non-build, but print jobs live at `/printing/jobs/:id`. `org-requests-screen` handles it correctly. Inbox rows, `print_started`/`print_ready` notifications (`linkFor`), the My exchanges list and the Me money line all land on the generic thread, which has only a build redirect. | `lib/builds.ts:20-22`; `lib/notifications.ts:21-24`; `components/exchanges/thread-screen.tsx:140`; `components/organisation/org-requests-screen.tsx:35`; `components/exchanges/list-screen.tsx:133` |
| S3 | `tutorial_submitted` goes to admins when no org backs the guide, and `linkFor` sends admins to `/organisation`. The review queue then shows "This screen belongs to organisation leaders" to a non-leader admin. Mobile has no admin review screen; the decision is web-only. | `lib/notifications.ts:37`; `components/organisation/review-queue-screen.tsx:79-83,121-129` |
| S4 | `org_thanked` links to `/organisation`, which is the Review queue, not the org profile. The code comment says mobile has no profile editor to hide notes in, but `org-profile-edit-screen.tsx:155` has Hide/Show. | `lib/notifications.ts:27`; `lib/my-routes.ts:15` |
| S5 | `(tabs)/explore/index.tsx` (ExploreScreen: search and doors) is URL-only. Nothing pushes `/explore`: it is absent from `FEATURES`, and Me's Explore rows jump to its children. | `app/(tabs)/explore/index.tsx`; `lib/home-shortcuts.ts:25-53`; `lib/my-routes.ts:8`; `tests/e2e/explore.spec.ts` uses `goto('/explore')` |
| S6 | Counts that go stale. `invalidateCapabilities` is called only from the Inbox, so the tab badges (inbox `unread.total`, Me `exchangeActions`) do not refresh after accept, decline, withdraw, confirm or send. Me fetches money, builds and `me/counts` once on mount, with no focus refetch. The toy editor derives "N offers waiting" from a list fetched at mount. The library card's `thanks_count` is not refetched after thanking in detail. The org thanks count is incremented client-side. | `lib/capabilities.ts:36`; `inbox-screen.tsx:241,267`; `app/(tabs)/me.tsx:185-209`; `components/my-toys/editor.tsx:84`; `components/home/library-screen.tsx:251`; `components/organisation/org-profile-screen.tsx:213` |
| S7 | Admin cards say "Anything with a number is waiting for a person", but `accounts` is all non-admins, `organisations` is all orgs, and `spotCheck` is a sample capped at 10; none is a backlog. The Admin screen has no seat guard, and a non-admin deep link shows cards after a swallowed 403. | `app/(my)/admin.tsx:25-37,41`; `packages/api/src/routes/admin.ts:470-480` |
| S8 | API routes with no web or mobile caller (only tests): `POST /api/ideas/:id/reports` (`toy-ideas.ts:453`); `GET`/`PATCH /api/admin/reports` (`admin.ts:517,540`; web `/admin/reports` reads `member-reports` instead); `DELETE /api/admin/ideas/:id/participants/:profileId/removal` (`admin.ts:576`); `GET`/`PATCH /api/contributors/me/thanks[/:thankerId]` (`contributors.ts:206,218`; profile_thanks notes cannot be hidden); `GET /api/reports` (`reports.ts:36`); `GET /api/notifications/me/unread-count` singular (`notifications.ts:32`, superseded); `POST /api/toy-transactions/print-at-event` (`toy-transactions.ts:2077`). Together these leave the participant-report pipeline with no UI input. | as listed |
| S9 | Mobile shows event registrations (My events, "Can't make it") but has no register control. Leaders cannot view registrations on mobile either. Both are web-only. | `components/events/my-events-screen.tsx:76`; `organizations.ts:1325`; `web/app/dashboard/organisation/publish/page.tsx:44` |
| S10 | Silent hand-offs: a leader invite is email only and the mailer is off (PENDING `email-delivery`), with no notification row or badge; the invitee only sees it under Account. A recycling booking, receipt or decline creates no notification either. Leaders see only the `me/counts.intake` badge and families see status inside the Recycling screen. | `organizations.ts:198-225`; `mailer.ts:7-12`; `components/profile-screen.tsx:139`; `organizations.ts:1603,1686` |
| S11 | Report status is invisible to the reporter. `member_reports` are resolved on web only. There is no resolution notification, and `GET /api/reports` (mine) has no caller. | `admin.ts:788`; `web/components/admin-reports.tsx:78`; `reports.ts:36` |
| S12 | "Verified" printer shield and `printer_test_prints` outcomes are set on web admin only (`PATCH /admin/test-prints/:id`). There is no notification to the printer who tapped "Get verified". | `admin.ts:968-995`; `components/printing/offer-screen.tsx:284,292-296` |
| S13 | Challenge idea state ("Awaiting review", published, graduated, rejected) can only be changed on web admin (`/admin/ideas`). The mobile My challenges and detail screens display it. Idea participant reinstatement has no UI. | `admin.ts:277,367,576`; `components/challenges/challenge-status.ts` |
| S14 | PENDING entries naming mobile that are still unshipped: `apple-sign-in`, `google-sign-in` (`auth/parts.tsx:117,129`; `lib/social-auth.tsx:25,31`), `apple-revoke` (`delete-account-screen.tsx:241`), `org-visit-map` (`org-profile-screen.tsx:361`), `team-page` (`about-screen.tsx:53`), `learn-article-hero` (`article-screen.tsx:44,69`), `printing-basics-hero` (`basics-screen.tsx:39-40`). `contributor-terms-legal` and `terms-version` list mobile but mobile code has no marker (it links to the web legal page, `auth/parts.tsx:253`). `email-delivery` and `site-url` (api) affect sign-up OTP, leader invites and the deletion email. | `packages/types/src/pending.ts` |
| S15 | The Maestro `sign-out-clears-session` flow is stale. It taps "MY SPLAT" and "Account & child profiles", which exist nowhere in `app/`, `components/` or `lib/`. The tab is "Me" and the row is "Account". Sign-out has no working device test. | `.maestro/flows/sign-out-clears-session.yaml:34-39`; `components/profile-screen.tsx:202` |
| S16 | Notification types with no API test asserting row creation: `toy_request`, `toy_accepted`, `print_started`, `print_ready`, `build_shot_posted`, `build_approved`, `challenge_left`, `challenge_removed`, `idea_rejected`. `backing_requested`/`tutorial_submitted` are unit-tested only. | `grep` over `packages/api/tests` |
| S17 | Leader screens use `ledOrgs[0]` only, so a multi-org leader cannot choose. | `app/(my)/organisation/orders.tsx:12`; `recycling/intake-screen.tsx:44`; `org-requests-screen.tsx:90`; `story-form-screen.tsx:33`; `event-form-screen.tsx:72`; `inventory-screen.tsx:162` |
| S18 | `collaborator_invited` falls through `linkFor` to `/tutorials/:id`, the editor of a guide the invitee is not yet a contributor on. Accept and Decline exist only on the Inbox invite card. | `lib/notifications.ts` (`n.tutorial_id` branch) |
| S19 | Me renders nothing when `GET /contributors/me` fails (`fetchCapabilities` returns null), with no retry. | `lib/capabilities.ts:14-16`; `app/(tabs)/me.tsx:221` |
| S20 | Org "doors", rate lines and pictures render on mobile but are editable on web only. Org pickup (`GET`/`PATCH /organizations/:id/pickup`), `exchange-costs/:id/settlement` and `/receipt` are also web only. | `org-profile-screen.tsx:149-150`; `org-profile-edit-screen.tsx:116`; `web/app/dashboard/organisation/toys/page.tsx:48` |
| S21 | e2e fixtures seed states that no mobile or tester path can set (`createNotification`, `createChallenge` via service role). This keeps the Inbox and challenge tests independent of the admin web, but means no mobile test exercises the admin to mobile hand-off for ideas or reviews. | `tests/e2e/inbox.spec.ts:1-18` |
| S22 | The mobile e2e suite never exercises printer-side print job actions (R07–R11, R13–R16), the build thread after claim (K06–K13), org publish, profile, messages and recycling, the toy editor, the cost panel, Map, or Admin. Their only coverage is mocked unit tests plus (for most routes) API integration. | Section 4 |

**Gaps in API integration coverage:** `GET /api/events/mine` no test; `POST /api/notifications/me/read` and `GET /api/notifications/me/unread-counts` mocked unit only; `DELETE /api/organizations/:id/leaders/invites/:id` no test; `POST /api/exchange-costs/:id/receipt` no test; `GET /api/admin/build-requests` and `GET /api/admin/print-jobs` no test.
