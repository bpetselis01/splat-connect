> Snapshot of the scout's inventory, 2026-10-20, read-only against HEAD cea425f2. Transcription source for the web rows of the journey map; the living map is scripts/journeys/journeys.json once the journey-coverage plan lands. Rows marked inferred must be read against code before they are committed.

# Web journeys: public and member-facing routes (non-dashboard, non-admin)

Scout read, 2026-10-20, HEAD cea425f2 on development. Nothing in the repo was modified. Format mirrors scripts/journeys/journeys.json.

## Legend

- Seat: anon (signed out), P (signed-in member), L (org leader), A (admin).
- Setter: who can put the data into the state the screen shows (n/a, P, L, A, web, none; "mobile" = only the mobile app can).
- AC = server `apiClient` (lib/api-client.ts, bearer from cookies, no-store). BAC = `browserApiClient` (client, token from browser session). SA = Next server action (`'use server'`). RAW = bare `fetch(API_URL + ...)` in a server component (no token, so anon view). SB = direct Supabase call from the browser.
- "Gate" and "Data path" are written on the first row of each route; later rows of the same route carry `"`.
- All `/api/*` calls go to the Hono API (packages/api); mounts in packages/api/src/app.ts. Notification type names are from packages/types NotificationType. Header badge = `caps.unread.total` (GET /api/notifications/me/unread-counts, read in the root layout on every non-bare render via getCapabilities).
- Notifications created by DB triggers are noted where known (only 109 challenge_guide_published).
- "Terms-gated" = middleware.ts sends a signed-in user with no `contributor_terms` row at the CURRENT version to /onboarding/contributor-terms?next=<pathname> (prefixes /dashboard, /upload, /organizations, and /tutorials/:id/edit). It fails open on a read error.

## Middleware route protection (middleware.ts, matcher = every path except static assets)

| Rule | Behaviour |
|---|---|
| Session refresh | Every request calls `supabase.auth.getUser()` and re-sets cookies; sets request header `x-pathname` for the root layout. |
| Signed-in routes | `/upload`, `/dashboard*`, `/notifications` with no user -> redirect `/login` (bare, NO `next`). |
| Admin routes | `/admin*` no user -> `/login`; user whose `profiles.role != 'admin'` -> `/`. |
| Contributor terms | prefixes `/dashboard`, `/upload`, `/organizations` and pattern `/tutorials/:id/edit` -> `/onboarding/contributor-terms?next=<pathname>` (query string dropped). `/notifications`, `/toy-library/*/request`, `/get-involved/*`, `/onboarding/*` are NOT terms-gated. |
| NOT gated by middleware (page guards itself) | `/onboarding/child`, `/onboarding/contributor-terms`, `/tutorials/:id/edit` (login), `/organizations/:id/message`, `/toy-library/:id/request`, `/get-involved/requests/new`, `/makers-wanted/new`, `/get-involved/recycling/drop-off`, `/get-involved/events/:id/register`, `/get-involved/organisations/request`. |

---

## CHR: Chrome (root layout, header, footer, dock) and MW

Layout: `app/layout.tsx` (async, reads `x-pathname`, cookies `splat-mode`/`splat-motion`, `getCapabilities()`). Bare shell (no Nav, backdrop, footer, dock) for `/auth/*` and `/onboarding/*`. Everything else gets Nav + Breadcrumb + PublicFooter + BackToMySplatDock. No cookie or consent banner exists anywhere (only cookies: Supabase session, splat-mode, splat-motion).

| ID | Seat | Route | Element -> handler | API | DB/storage | Notif/email | Badge/count | Setter | Gate | Data path |
|---|---|---|---|---|---|---|---|---|---|---|
| W-CHR-01 | anon,P | * | "Skip to main content" -> #main (anchor) | - | - | - | - | n/a | none | static |
| W-CHR-02 | anon,P | * | Brand link -> `/` (BoundaryLink) | - | - | - | - | n/a | none | static |
| W-CHR-03 | anon,P | * | Five tabs Guides / Toy Library / 3D Printing / Get Involved / About -> links (`aria-current` from sectionFor) | - | - | - | - | n/a | none | static |
| W-CHR-04 | anon,P | * | "More" popover (native `popover=auto`): Learn, Impact, Design challenges, Organisations, Events, Stories, Design system, Contact -> links; click closes popover | - | - | - | - | n/a | none | static |
| W-CHR-05 | anon,P | * (phone) | Menu toggle -> client state `open`, Escape closes, path change closes | - | - | - | - | n/a | none | client state |
| W-CHR-06 | anon,P | * | Header search `<form action=/library>` GET `?q=` -> library page reads `q` into its client filter | - | - | - | - | n/a | none | GET form, no server hit beyond the library page load |
| W-CHR-07 | anon,P | * | Display toggles: colour mode light/dark/hc, reduce motion -> `document.cookie` (splat-mode, splat-motion, 1 year) + `data-mode` attr | - | cookie only | - | - | n/a | none | cookie read in layout (first paint correct) |
| W-CHR-08 | anon | * | "Sign in" link -> `/login` (no `next`) | - | - | - | - | n/a | caps===null | getCapabilities (AC GET /api/contributors/me fails -> null) |
| W-CHR-09 | P | * | "My SPLAT" link -> `/dashboard` (BoundaryLink, full load across the account boundary) with unread badge + sr-only "N unread" + initials avatar | GET /api/contributors/me, /api/organizations/mine, /api/notifications/me/unread-counts, /api/toy-transactions/action-count (layout, cached per render) | profiles, org_leaders, notifications, toy_transactions | - | header badge = unread.total (all 38 types). `exchangeActions` is fetched but never rendered by Nav | n/a | P | AC x4 in root layout; each degrades to empty |
| W-CHR-10 | anon,P | * | Footer columns (Learn x6, 3D Printing x2, Get Involved x8, Impact and About x7, Legal x7) + legal line -> links (listed once) | - | - | - | - | n/a | none | lib/public-nav.ts FOOTER_COLUMNS (static) |
| W-CHR-11 | P | * except /dashboard,/admin,/notifications,/upload | Floating "Back to My SPLAT" dock -> `/dashboard` | - | - | - | - | n/a | signedIn | client (usePathname) |
| W-CHR-12 | P | /library, /toy-library | Dock becomes CornerMenu: Back to My SPLAT, Upload a tutorial (/library) or Give a toy (/toy-library), My tutorials / My toys, My exchanges, Saved -> links | - | - | - | - | n/a | signedIn | static map |
| W-CHR-13 | anon,P | * | Breadcrumb trail -> links (trailFor); withheld from anon on account routes | - | - | - | - | n/a | none | static |
| W-CHR-14 | P | /dashboard/profile (referenced) | Sign out -> `supabase.auth.signOut()` then hard load `/` (component `sign-out-button.tsx`; only mount is dashboard/profile) | Supabase auth | auth session | - | header badge disappears | n/a | P | SB |
| W-CHR-15 | anon,P | not-found | 404 page "We couldn't find that page" -> `/` | - | - | - | - | n/a | none | static |
| W-MW-01 | anon | /upload, /notifications, /dashboard* | redirect to `/login` WITHOUT `next` | - | - | - | - | n/a | middleware | - |
| W-MW-02 | P | /dashboard*, /upload, /organizations*, /tutorials/:id/edit | no current-version contributor terms -> redirect `/onboarding/contributor-terms?next=<pathname>` | (supabase) | user_agreements (select) | - | - | n/a | middleware, fails open | SB in middleware |
| W-MW-03 | P non-admin | /admin* | redirect `/` | (supabase) | profiles.role | - | - | n/a | middleware | SB in middleware |

---

## HOME: `/`

Gate: anon ok. Data path: server component, 4 RAW fetches (`/api/public/tutorials`, `/toys`, `/impact`, `/content/home`), `no-store`; any failure silently becomes empty lists and zero stats.

| ID | Seat | Route | Element -> handler | API | DB/storage | Notif/email | Badge/count | Setter | Gate | Data path |
|---|---|---|---|---|---|---|---|---|---|---|
| W-HOME-01 | anon,P | / | Hero primary CTA (label from site_content `home-hero`) -> `/library` | GET /api/public/content/home | site_content | - | - | A (label via site-content-editor); href is fixed | anon ok | RAW |
| W-HOME-02 | anon,P | / | Hero secondary CTA -> `/toy-library` | same | same | - | - | A (label) | " | " |
| W-HOME-03 | anon,P | / | Stat chips (guides, organisations, toys delivered) CountUp | GET /api/public/impact, /content/home | tutorials, organizations, toy_transactions; site_content `home-numbers` | - | the three totals; admin can override each | A (override) else derived | " | " |
| W-HOME-04 | anon,P | / | ScrollWorld scenes (copy from `home-scenes`) | /content/home | site_content | - | - | A | " | " |
| W-HOME-05 | anon,P | / | Door "I'm looking for a guide" -> `/library` (cta shows live guide count) | /api/public/tutorials | tutorials | - | guide count | P(author)+A/L(approve) | " | " |
| W-HOME-06 | anon,P | / | Door "I'd like a ready-made toy" -> `/toy-library` (cta shows live toy count) | /api/public/toys | toys | - | toy count | P,L | " | " |
| W-HOME-07 | anon,P | / | Door "I make things" -> `/get-involved` | - | - | - | - | n/a | " | static |
| W-HOME-08 | anon,P | / | Cost card -> `/printing/basics`; recycling card -> `/get-involved/recycling` | - | - | - | - | n/a | " | static |
| W-HOME-09 | anon,P | / | Recent guides "View all" -> `/library`; 2 compact TutorialCards -> `/tutorials/:id` (no save on compact card) | /api/public/tutorials | tutorials | - | - | P+A | " | RAW |
| W-HOME-10 | anon,P | / | Recent toys "View all" -> `/toy-library`; 2 compact ToyLibraryCards -> `/toy-library/:id` | /api/public/toys | toys | - | - | P,L | " | RAW |

---

## AUTH: login, signup, confirmed, terms gate, delete-account entry

Web has NO forgot-password, NO email-code sign-in, NO resend-confirmation, NO Apple/Google (all present on mobile A03-A10). Neither /login nor /signup redirects an already-signed-in visitor.

| ID | Seat | Route | Element -> handler | API | DB/storage | Notif/email | Badge/count | Setter | Gate | Data path |
|---|---|---|---|---|---|---|---|---|---|---|
| W-AUTH-01 | anon | /login | Sign in submit -> SB `auth.signInWithPassword`, then SB `profiles.select(role)`, then (if pending signup intent) SB `auth.updateUser({intent_landed})`, then `location = sanitiseNextPath(next) ?? intent landing (/onboarding/child or /dashboard/tutorials) ?? /admin|/dashboard` | Supabase auth (no Hono) | auth.users, profiles | - | header switches to My SPLAT + badge | n/a | anon ok (bare shell) | client component, SB |
| W-AUTH-02 | anon | /login | Show/hide password toggle | - | - | - | - | n/a | " | client state |
| W-AUTH-03 | anon | /login | "Create one" -> `/signup` (query kept) | - | - | - | - | n/a | " | static |
| W-AUTH-04 | anon | /login | Unconfirmed-email failure shows raw Supabase message; no resend control | Supabase auth | - | - | - | none | " | SB |
| W-AUTH-05 | anon | /signup | Intent radios "Find toys for my child" / "Make and share guides" -> stored in `user_metadata.intent` | - | - | - | - | n/a | anon ok (bare shell) | client state |
| W-AUTH-06 | anon | /signup | Terms row -> opens ContributorTermsDialog (TermsGate mode=local; "Accept" ticks, "Reject" closes; nothing recorded yet) | - | - | - | - | n/a | " | static content |
| W-AUTH-07 | anon | /signup | Create my account (disabled until terms ticked; password >= 6, confirm must match) -> SB `auth.signUp` with metadata {name, contributor_terms_version, intent}, `emailRedirectTo=/auth/confirmed?next=` | Supabase auth | auth.users; trigger on_auth_user_created -> profiles; migration 010 -> user_agreements(contributor_terms, version) | confirmation mail (Supabase Auth) | - | n/a | " | SB |
| W-AUTH-08 | anon | /signup | "Check your email" state -> "Back to sign in" `/login` | - | - | - | - | n/a | " | client state |
| W-AUTH-09 | anon | /signup | `?reason=` banners: only save, thanks, child, download have copy. `follow` and `message` (org-actions.tsx:60,87) show none | - | - | - | - | n/a | " | static |
| W-AUTH-10 | anon | /signup | AuthTabs "Sign in" / "Create account" links; show/hide password | - | - | - | - | n/a | " | static |
| W-AUTH-11 | anon | /auth/confirmed | 3 s countdown -> `router.replace(/login?next=)`; "Continue" link same | - | - | - | - | n/a | anon ok, bare shell | client; confirmation does NOT sign the user in |
| W-AUTH-12 | P | /onboarding/contributor-terms | "Accept and continue" (checkbox required) -> BAC POST /api/agreements {agreement_type:'contributor_terms'}; then hard load `safeNext(next)` (default /dashboard) | POST /api/agreements | user_agreements (insert, version = AGREEMENT_VERSIONS) | - | - | P | page not gated by middleware; anon can render it, accept fails with "Could not record" | client; static terms content (ContributorTermsContent) |
| W-AUTH-13 | P | /onboarding/contributor-terms | "Sign out" -> SB `auth.signOut()`, hard load `/` | Supabase auth | session | - | - | n/a | " | SB |
| W-AUTH-14 | anon,P | /delete-account | Info page (Google Play deletion policy). "Contact us" -> `/contact` | - | - | - | - | n/a | none | static (own `<main>` nested inside layout `<main id=main>`) |
| W-AUTH-15 | anon,P | /delete-account | "Sign in to delete" -> `/login?next=/dashboard/profile/delete` (shown even when already signed in) | - | - | - | - | n/a | none | static |
| W-AUTH-16 | P | /dashboard/profile/delete (referenced, out of scope) | DeleteAccountForm: type DELETE -> SB `signInWithOtp(shouldCreateUser:false)` -> 6-digit SB `verifyOtp` -> BAC DELETE /api/me {confirm:'DELETE', keepCredit} -> SB signOut | GET /api/me/deletion (preview), DELETE /api/me | profiles + cascade (account-deletion.ts), rpc account_deletion_preview | confirmation email via Resend if configured (`sendEmail`, returns false when RESEND_API_KEY unset) | counterparties see "Deleted member" | P | P, sole leader of an org is blocked | AC + SB |

## ONB: onboarding/child

| ID | Seat | Route | Element -> handler | API | DB/storage | Notif/email | Badge/count | Setter | Gate | Data path |
|---|---|---|---|---|---|---|---|---|---|---|
| W-ONB-01 | P | /onboarding/child | Wizard "Continue" (6 steps: age, four capability questions, last) -> BAC POST /api/child-profiles on first save, PATCH /api/child-profiles/:id afterwards | POST/PATCH /api/child-profiles | child_profiles | - | none (feeds library "recommended" sort and guide fit line, first child only) | P | page: `!caps` -> `/login?next=/onboarding/child`. Not terms-gated. Bare shell (no nav) | AC GET /api/child-profiles (children[0]) |
| W-ONB-02 | P | /onboarding/child | "Skip" (does NOT save the step) -> next step; on last step -> `/library` | - | - | - | - | n/a | " | client |
| W-ONB-03 | P | /onboarding/child | "Back" (disabled on step 0) | - | - | - | - | n/a | " | client |
| W-ONB-04 | P | /onboarding/child | Finish -> `router.push('/library')`; an exit link `/library` (line 187) | - | - | - | - | n/a | " | client |

---

## LIB: guides library

| ID | Seat | Route | Element -> handler | API | DB/storage | Notif/email | Badge/count | Setter | Gate | Data path |
|---|---|---|---|---|---|---|---|---|---|---|
| W-LIB-01 | anon,P | /library | Search box (BrowseHero; seeded from `?q=`) -> client `filterGuides` over the full list | - | - | - | result count | n/a | anon ok | RAW GET /api/public/tutorials + /tutorials/stats; AC GET /api/saves/ids (null for anon) and AC GET /api/child-profiles (first child). All filtering is client-side |
| W-LIB-02 | anon,P | /library | Sort pills (recommended, etc.) -> client `sortGuides`; "recommended" uses first child's tags | - | - | - | - | n/a | " | client |
| W-LIB-03 | anon,P | /library | Filter option buttons (kind, difficulty, device...) and tag groups "About your child" / toy tags -> client toggle | - | - | - | - | n/a | " | client |
| W-LIB-04 | anon,P | /library | Filters "Clear", "Show/Hide" (phone), active-chip remove, empty-state "Clear" | - | - | - | - | n/a | " | client |
| W-LIB-05 | anon,P | /library | "Show more" (useShowMore) | - | - | - | - | n/a | " | client |
| W-LIB-06 | anon,P | /library | TutorialCard -> `/tutorials/:id` | - | - | - | - | n/a | " | - |
| W-LIB-07 | anon->signup, P | /library | TutorialCard heart: anon -> `/signup?next&reason=save`; P -> BAC POST /api/saves {entity_type:'tutorial'} or DELETE /api/saves/tutorials/:id, optimistic, `router.refresh` | POST/DELETE /api/saves | saves | - | My SPLAT "Saved" count | P | " | BAC |
| W-LIB-08 | anon,P | /library | Hero "Pick for my child": P -> `/onboarding/child`, anon -> `/signup?next=%2Fonboarding%2Fchild&reason=child`; "Browse" -> `#guide-grid` | - | - | - | - | n/a | " | static |
| W-LIB-09 | anon,P | /library | Hero aside "Submit a guide" -> `/get-involved/submit-a-tutorial`; callouts "Pick for my child ->" and "Submit an idea" -> `/get-involved/submit-an-idea`; empty state -> `/toy-library`, `/get-involved/submit-an-idea` | - | - | - | - | n/a | " | static |

## TOY: toy library

| ID | Seat | Route | Element -> handler | API | DB/storage | Notif/email | Badge/count | Setter | Gate | Data path |
|---|---|---|---|---|---|---|---|---|---|---|
| W-TOY-01 | anon,P | /toy-library | Facet buttons (How it is offered: Gift / Swap only / Swap or gift; Who is holding it: A family / An organisation), SortControl (recently listed / condition + flip), chips, Clear, Show more | - | - | - | "available now", "held by a service" counts | n/a | anon ok | RAW GET /api/public/toys, /api/public/impact; AC GET /api/saves/ids. All filtering client-side |
| W-TOY-02 | anon,P | /toy-library | ToyLibraryCard -> `/toy-library/:id` | - | - | - | - | n/a | " | - |
| W-TOY-03 | anon->signup, P | /toy-library | Card heart (slug toys): same as W-LIB-07 | POST/DELETE /api/saves | saves | - | Saved count | P | " | BAC |
| W-TOY-04 | anon,P | /toy-library | Hero "Browse the toys" -> `#toy-grid`; "Pick for my child" -> `/learn/choosing-a-toy` (library's same button goes to the child wizard) | - | - | - | - | n/a | " | static |
| W-TOY-05 | anon,P | /toy-library | Hero aside "Give a toy" -> `/dashboard/toys/new` (anon: middleware sends to bare /login, no `next`); aside link -> `/library`; empty state -> `/library`, `/get-involved/makers-wanted` | - | - | - | - | n/a | " | static |
| W-TOY-06 | anon,P | /toy-library/:id | PhotoCarousel (client state; optional switch photo) | - | storage toy-photos-library (public URLs) | - | - | P,L (owner/holder) | anon ok; 404 unless published | RAW GET /api/public/toys/:id (+ list for "listed" count); AC GET /api/toys (P only) |
| W-TOY-07 | P non-owner | /toy-library/:id | "Ask to collect it" (donation / both) and "Offer a swap" (exchange / both) -> link `/toy-library/:id/request?mode=` | - | - | - | - | P,L (holder sets offer_type, un-pauses) | hidden for personal owner (`viewerId === owner_id`), when `paused_at` ("Not taking requests right now") or no offer. A leader of the holding org is NOT hidden | page |
| W-TOY-08 | anon | /toy-library/:id | Same two buttons in lock form "Sign in to ask for it" -> `/login?next=<request url>`; ToySignInGate Sign in / Create account links | - | - | - | - | n/a | anon | page |
| W-TOY-09 | P | /toy-library/:id | Save (labelled, rail). Anon sees NO save control on the detail page (list cards route anon to signup) | POST/DELETE /api/saves | saves | - | Saved count | P | `saved !== null` | BAC |
| W-TOY-10 | anon->login, P | /toy-library/:id | ReportLink: anon -> `/login?next=`; P opens dialog (reason, text, ok-to-contact) -> BAC POST /api/reports {subject_kind:'toy', subject_id, category, body, ok_to_contact} | POST /api/reports | member_reports | none on submit (A sees it in admin queue); on A resolve -> `report_resolved` to reporter | reporter's unread +1 on resolve | P (any non-holder) | hidden for the holder | BAC |
| W-TOY-11 | anon,P | /toy-library/:id | ToyFacts guide link -> `/tutorials/:id`; ToyPicks (recommended guides) display; holder card (name, "N toys given", not a link) | - | - | - | holder_given count | P,L | - | RAW |
| W-TOY-12 | P | /toy-library/:id/request | Mode radios Swap / Gift (swap disabled when you have no published toys) | - | - | - | - | n/a | page: `!caps` -> `/login?next=/toy-library/:id/request` (mode lost). 404 if toy missing. Not terms-gated | RAW GET /api/public/toys/:id; AC GET /api/toys, GET /api/toy-transactions (to disable toys already offered) |
| W-TOY-13 | P | /toy-library/:id/request | Offered-toy picker (swap; toys offered in another open request are disabled) | - | - | - | - | P (own published toys) | " | " |
| W-TOY-14 | P | /toy-library/:id/request | Note (required) + chips (e.g. "Happy to cover postage") | - | - | - | - | n/a | " | client |
| W-TOY-15 | P | /toy-library/:id/request | Submit -> BAC POST /api/toy-transactions {toy_id, type, offered_toy_id?, note...}; then `router.push(/dashboard/exchanges/:id)` | POST /api/toy-transactions | toy_transactions, toy_transaction_messages (first message), toys (read) | `toy_request` to the holder side (notifyOwnerSide: owner or all org leaders) | holder's unread +1 (bucket exchanges); holder `exchangeActions` +1 | P requester; holder P/L | " | BAC |
| W-TOY-16 | P | /toy-library/:id/request | Cancel -> `/toy-library/:id`; "list a toy" links -> `/dashboard/toys/new` | - | - | - | - | n/a | " | static |

## TUT: guide detail, new guide, editor

| ID | Seat | Route | Element -> handler | API | DB/storage | Notif/email | Badge/count | Setter | Gate | Data path |
|---|---|---|---|---|---|---|---|---|---|---|
| W-TUT-01 | anon,P | /tutorials/:id | Page load increments the view counter | GET /api/public/tutorials/:id (rpc bump_tutorial_view) | tutorials (view count) | - | views (every SSR load, incl. crawlers) | P | anon ok; 404 unless approved | RAW GET /api/public/tutorials/:id and /notes; AC GET /api/tutorials/:id/thanks, /api/saves/ids, /api/child-profiles (P only) |
| W-TUT-02 | anon,P | /tutorials/:id | Breadcrumb "Guides" -> `/library`; SectionTabs Steps / Parts & tools / Files & print settings / Safety (client state) | - | - | - | - | n/a | " | client |
| W-TUT-03 | anon,P | /tutorials/:id | Buy links on parts/tools -> external vendor (`target=_blank`) | - | - | - | - | P (author) | " | validated by buyLinksError |
| W-TUT-04 | anon->signup, P | /tutorials/:id | STL download button -> `/files/stl-files/<path>` (route handler: no user -> 302 `/signup?next=/tutorials/:id&reason=download`; user -> `storage.createSignedUrl(60 s, download name)` -> 302) | - (Next route handler) | storage stl-files | - | - | P (author uploads) | anon redirected | app/files/[bucket]/[...path]/route.ts, SB (user session) |
| W-TUT-05 | anon->signup, P | /tutorials/:id | "Download guide (PDF)" / "Sign in to download" -> `/files/tutorial-pdfs/<path>` (inline) | - | storage tutorial-pdfs | - | - | P | " | same route |
| W-TUT-06 | anon,P | /tutorials/:id | "Request a print" -> `/printing/requests?guide=:id`; "Ask for a build" (Lifebuoy) -> `/get-involved/requests/new?guide=:id`; "toy library" link; recommendation cards -> `/tutorials/:id` | - | - | - | - | n/a | " | static |
| W-TUT-07 | anon,P | /tutorials/:id | Share -> `navigator.share` or clipboard + toast "Link copied" | - | - | - | - | n/a | " | client |
| W-TUT-08 | P | /tutorials/:id | Save (labelled). Anon sees NO save button (only Share + text "Downloads and your saved list come with an account") | POST/DELETE /api/saves | saves | - | Saved count | P | P | BAC |
| W-TUT-09 | P (non-author) | /tutorials/:id | "Say thanks" -> BAC POST /api/tutorials/:id/thanks; 409 treated as already thanked; own guide shows a read-only count instead | POST /api/tutorials/:id/thanks | tutorial_thanks | `tutorial_thanked` to the guide's contributors | author's unread +1 (bucket tutorials); thanks_count | P | P | BAC |
| W-TUT-10 | P | /tutorials/:id | "I built this" (MarkBuildDoneButton) -> BAC POST /api/tutorials/:id/build. Starts un-done on every load (no read of prior state) | POST /api/tutorials/:id/build | tutorial_builds | none | My SPLAT builds (GET /api/me/builds) | P | P | BAC |
| W-TUT-11 | P author or A | /tutorials/:id | Pin / unpin a community note -> BAC POST /api/tutorials/:id/notes/:noteId/pin or unpin; `router.refresh` | POST .../pin, .../unpin | tutorial_notes | - | pinned banner count | P(author)/A | `canPin` = thanks.own or admin | BAC |
| W-TUT-12 | anon,P | /tutorials/:id | Community notes display. Web can only pin them; creating a note (POST /api/tutorials/:id/notes + /api/upload/note-photo) exists only on mobile (feedback-sheet.tsx) | GET /api/public/tutorials/:id/notes | tutorial_notes, profiles | `tutorial_noted` (on mobile create) | - | **mobile only** | " | RAW |
| W-TUT-13 | P | /tutorials/:id | Fit line ("how this fits your child") from first child profile | GET /api/child-profiles | child_profiles | - | - | P (wizard) | signedIn | AC |
| W-TUT-14 | P | /upload | Start radios "Start blank" / "Start from a PDF" | - | - | - | - | n/a | middleware: anon -> bare /login; terms-gated. Page static (`?kind=` pre-selects) | client |
| W-TUT-15 | P | /upload | Kind radios (Toy adaptation / Assistive tech) + title + difficulty + optional cover photo | - | - | - | - | n/a | " | client |
| W-TUT-16 | P | /upload | "Create" -> BAC POST /api/tutorials {id, title, kind, difficulty} (retry-safe; API re-checks terms) -> BAC POST /api/contributors/me/tutorials/:id -> (cover) BAC postFormData /api/upload/photo -> GET + PATCH /api/tutorials/:id {photo_urls} -> push `/tutorials/:id/edit?step=files&created=1`. Cover upload failure is swallowed, user lands in the editor with no cover | POST /api/tutorials, POST /api/contributors/me/tutorials/:id, POST /api/upload/photo, PATCH /api/tutorials/:id | tutorials (draft), tutorial_contributors, user_agreements (read), storage toy-photos | - | My SPLAT draft count | P | " | BAC |
| W-TUT-17 | P | /upload | PDF import: drop/choose PDF (max size client-checked) -> BAC postFormData /api/tutorials/import-pdf (text heuristics) -> edit title/kind -> "Create" -> POST /api/tutorials + contributor link + postFormData /api/upload/pdf -> push editor | POST /api/tutorials/import-pdf, /api/tutorials, /api/upload/pdf | tutorials, tutorial_contributors, tutorial_steps, storage tutorial-pdfs | - | draft count | P | " | BAC |
| W-EDIT-01 | P (contributor) | /tutorials/:id/edit | Details save (title, description, difficulty, build time, ages...) -> SA saveDetails -> PATCH /api/tutorials/:id; on an approved or rejected guide the action adds `status:'pending'` (pulls a live guide back into review without a prompt) | PATCH /api/tutorials/:id | tutorials | `tutorial_submitted` when it enters pending | reviewer/A queue +1 | P | middleware: terms-gated; page: `requireCapabilities` (anon -> bare /login, no next); non-contributor -> `/dashboard`; 404-ish -> `/dashboard` | AC GET /api/tutorials/:id (+ /orgs, GET /api/organizations, GET /api/public/tutorials as candidates) |
| W-EDIT-02 | P | /tutorials/:id/edit | Safety notes save -> SA saveSafetyNotes -> POST /api/tutorials/:id/safety-notes. (Does not reset status) | POST .../safety-notes | safety notes table (safety-notes.ts) | - | - | P | " | AC |
| W-EDIT-03 | P | /tutorials/:id/edit | Suits / device-type tags (EditSuitsSection, `lock`) -> BAC GET then PATCH /api/tutorials/:id with updated_at (direct from client, not an SA) | GET + PATCH /api/tutorials/:id | tutorials | - | - | P | " | BAC |
| W-EDIT-04 | P | /tutorials/:id/edit | Steps editor: add/reorder/delete step, step photo upload (BAC postFormData /api/upload/step-photo, bucket toy-photos steps/) -> SA saveSteps -> PUT /api/tutorials/:id/steps | PUT .../steps, POST /api/upload/step-photo | tutorial_steps, storage toy-photos | - | - | P | " | AC |
| W-EDIT-05 | P | /tutorials/:id/edit | Files: upload photos / reorder / captions / delete -> BAC postFormData /api/upload/photo -> SA patchPhotoUrls -> PATCH photo_urls (+captions; approved->pending) | POST /api/upload/photo, PATCH | tutorials.photo_urls, storage toy-photos | `tutorial_submitted` if status flipped | queue +1 | P | " | AC/BAC |
| W-EDIT-06 | P | /tutorials/:id/edit | Files: guide PDF upload/remove -> BAC postFormData /api/upload/pdf -> SA patchFileUrls -> PATCH tutorial_pdf_url (approved->pending) | POST /api/upload/pdf, PATCH | tutorials, storage tutorial-pdfs | as above | " | P | " | " |
| W-EDIT-07 | P | /tutorials/:id/edit | Parts: items with quantity, optional, buy links, price -> SA saveParts -> POST .../parts. Prices-checked date -> SA savePricesChecked -> PATCH (approved->pending) | POST .../parts, PATCH | parts, tutorials | - | - | P | " | AC |
| W-EDIT-08 | P | /tutorials/:id/edit | Tools -> SA saveTools -> POST .../tools | POST .../tools | tools | - | - | P | " | AC |
| W-EDIT-09 | P | /tutorials/:id/edit | STL: AddStlForm -> BAC postFormData /api/upload/stl -> SA addStlFileRecord (GET whole guide, then POST /stl-files with the full list `[...current, new]`) | POST /api/upload/stl, POST .../stl-files | stl_files, storage stl-files | - | printable-parts catalogue (/printing/parts) | P | " | AC |
| W-EDIT-10 | P | /tutorials/:id/edit | STL print settings -> SA saveStlSettings -> PATCH .../stl-files/:fileId; customisation fields -> SA saveCustomizationFields -> PATCH (approved->pending) | PATCH | stl_files, tutorials | - | - | P | " | AC |
| W-EDIT-11 | P | /tutorials/:id/edit | "Worth a look" recommendations -> SA saveRecommendations -> POST .../recommendations | POST .../recommendations | recommendations | - | - | P | " | AC |
| W-EDIT-12 | P | /tutorials/:id/edit | Team: invite by email -> SA inviteCollaborator -> POST .../collaborators/invite; remove or leave -> SA removeCollaborator -> DELETE .../collaborators/:profileId | POST/DELETE | tutorial_collaborator_invites, tutorial_contributors, notifications | `collaborator_invited` to invitee; `collaborator_removed` / `collaborator_left` | invitee's unread +1 | P | " | AC |
| W-EDIT-13 | P | /tutorials/:id/edit | Backing: ask an organisation -> SA askOrg -> POST .../orgs {org_id}; withdraw -> SA withdrawOrg -> DELETE .../orgs/:orgId | POST/DELETE .../orgs | tutorial_orgs | `backing_requested` to the org's leaders (notifyBackingRequested) | leaders' unread +1 (organisations) | P | " | AC |
| W-EDIT-14 | P | /tutorials/:id/edit | "Submit for review" (draft only) -> SA submitForReview -> PATCH status:'pending' (API checks current terms + steps/PDF present) | PATCH /api/tutorials/:id | tutorials | `tutorial_submitted` to reviewer / A (notifyTutorialSubmitted) | reviewer queue +1 | P | " | AC |
| W-EDIT-15 | P | /tutorials/:id/edit | "Preview" -> `?preview=1` (or `/tutorials/:id` when approved); missing-field "jump" buttons; stepper navigation; PdfImportBanner; CreatedToast (`?created=1`) | - | - | - | - | n/a | " | client |
| W-EDIT-16 | P | /tutorials/:id/edit | Delete draft (typed confirm) -> BAC DELETE /api/tutorials/:id -> push `/dashboard`. Draft only | DELETE /api/tutorials/:id | tutorials | - | draft count | P | " | BAC |

## CON: contributor profile

| ID | Seat | Route | Element -> handler | API | DB/storage | Notif/email | Badge/count | Setter | Gate | Data path |
|---|---|---|---|---|---|---|---|---|---|---|
| W-CON-01 | anon,P | /contributors/:id | Profile render: badges, guides, featured guide, toys on shelf, activity, jump anchors (About/Featured/Guides/Thanks/Toys/Activity) | GET /api/public/contributors/:id | profiles, tutorials, toys, tutorial_contributors, toy_transactions, org_leaders | - | thanks, builds, guide counts, badges; "next badge" line only on your own page | P | anon ok; 404 if the person has no public contribution | RAW |
| W-CON-02 | anon,P | /contributors/:id | Guide / toy / activity links -> `/tutorials/:id`, `/toy-library/:id`; back link -> `/impact` | - | - | - | - | n/a | " | static |
| W-CON-03 | anon->signup, P | /contributors/:id | "Ask {first} to build a guide" -> P `/get-involved/requests/new?maker=:id`, anon `/signup?next=...` (shown on your OWN profile too, where the target page bounces it to `/get-involved/requests`) | - | - | - | - | n/a | " | static |
| W-CON-04 | anon->signup, P non-self | /contributors/:id | PersonThanksButton: anon -> `/signup?next&reason=thanks`; P expands optional note -> BAC POST /api/contributors/:id/thanks {note?}; 409 = already thanked | POST /api/contributors/:id/thanks | profile_thanks | `profile_thanked` to the person | recipient unread +1; thanks count | P | " | BAC |

## ORG: organisations (public directory, public profile, leader view)

Note: `/organizations` (whole prefix, including the PUBLIC list and PUBLIC profile) is terms-gated for signed-in users by middleware, so a member who has not accepted contributor terms is bounced from the public directory; signed-out visitors are not.

| ID | Seat | Route | Element -> handler | API | DB/storage | Notif/email | Badge/count | Setter | Gate | Data path |
|---|---|---|---|---|---|---|---|---|---|---|
| W-ORG-01 | anon,P | /organizations | Search `<form action=/organizations>` (q, f hidden) -> server re-render; filter chips All / Takes plastic (`filterHref`) | GET /api/public/organizations | organizations | - | match count | L,A (org active, recycling_materials) | anon ok; P must have current contributor terms (middleware) | RAW, filter done in the page |
| W-ORG-02 | anon,P | /organizations | Org card -> `/organizations/:id/public`; Pager | - | - | - | - | n/a | " | - |
| W-ORG-03 | L | /organizations/:id | Leader view: queue of guides asking for backing; backed guides; links to `/organizations/:id/projects/:tutorialId` and `/tutorials/:id`. Non-leader -> redirect `/organizations/:id/public` | GET /api/organizations/:id, GET /api/tutorials, GET /api/agreements/me | organizations, tutorials, tutorial_orgs, user_agreements | - | queue length | P asks (W-EDIT-13) | L of that org; terms-gated | AC |
| W-ORG-04 | L | /organizations/:id | OrgReviewBanner: "Read and accept" -> TermsGate org_leader_terms -> BAC POST /api/agreements {agreement_type:'org_leader_terms'} -> router.refresh. The terms page it links is a "to be completed" stub (version v0-todo) | POST /api/agreements | user_agreements | - | - | L | " | BAC |
| W-ORG-05 | L (with leader terms) | /organizations/:id/projects/:tutorialId | "Back this project" -> SA backProject -> POST /api/tutorials/:id/review (or /orgs/:orgId/accept); "Decline" -> SA declineProject -> POST /orgs/:orgId/decline | POST .../orgs/:orgId/accept, .../decline | tutorial_orgs | `backing_accepted` / `backing_declined` to the author (review-notifications.ts) | author unread +1 | L | `isOrgLeader` else 404; terms-gated | AC GET org + tutorial |
| W-ORG-06 | L (with leader terms) | same | "Approve and publish" -> SA approve -> POST /api/tutorials/:id/review {status:'approved', org_id}; revalidate /library, /tutorials/:id; redirect `/organizations/:id` | POST .../review | tutorials, tutorial_orgs, organizations | `tutorial_approved` to authors (notifyTutorialReviewed) | /library count +1; author unread +1 | L reviewer | " | AC |
| W-ORG-07 | L (with leader terms) | same | "Reject" (note required, silently returns if empty) -> SA reject -> POST .../review {status:'rejected', rejection_note} | POST .../review | tutorials | `tutorial_rejected` to authors | author unread +1 | L | " | AC |
| W-ORG-08 | anon,P | /organizations/:id/public | Profile render: about, doors (target links via doorLink), rate lines, recycling card, events, stories, shelf toys, guides, printers, thanks quotes, recent activity, contact (mailto, website `<a href=org.website_url>` raw) | GET /api/public/organizations/:id | organizations, org_doors, org_events, org_rate_lines, org_stories, org_thanks, org_leaders, tutorial_orgs, tutorials, toys, printers, profiles, toy_transactions; rpc print_job_stats | - | counts of guides/toys/prints | L (edits in dashboard) | anon ok; P terms-gated | RAW + AC GET /api/organizations/:id/me (P) |
| W-ORG-09 | anon->signup, P | /organizations/:id/public | Follow / Following toggle -> BAC POST or DELETE /api/organizations/:id/follow; toast "You will hear when ... publishes an event or a story" | POST/DELETE .../follow | org_follows | none on follow; later `org_event_published` / `org_story_published` / event-change notifications to followers | follower's future unread | P | `me` (signed in) else `/signup?next&reason=follow` (no banner copy for `follow`) | BAC |
| W-ORG-10 | anon->signup, P | /organizations/:id/public | "Message" -> link `/organizations/:id/message` (anon -> `/signup?...&reason=message`) | - | - | - | - | n/a | " | static |
| W-ORG-11 | anon->signup, P | /organizations/:id/public | "Say thanks" -> ThanksDialog (note optional, byline, show-on-page) -> BAC POST /api/organizations/:id/thanks; 409 = sent; button disabled once thanked | POST .../thanks | org_thanks | `org_thanked` to leaders | leaders unread +1 | P | " | BAC |
| W-ORG-12 | L | /organizations/:id/public | "Edit your page" -> `/dashboard/organisation/profile` | - | - | - | - | n/a | `me.leads` | - |
| W-ORG-13 | anon,P | /organizations/:id/public | Recycling card: P -> `/get-involved/recycling/drop-off?org=:id` ("Book a drop-off"); anon -> `/get-involved/recycling`; doors/printing/contact/events/stories/guides/toys links | - | - | - | - | n/a | " | static |
| W-ORG-14 | P | /organizations/:id/message | OrgThreadView: send message -> BAC POST `sendPath` = /api/organizations/:id/conversations/mine/messages; `router.refresh` (no live polling) | POST .../conversations/mine/messages | org_conversations, org_messages | `org_message` to the org's leaders | leaders' unread +1 | P | page: `!caps` -> `/login?next=`; leader -> redirect `/dashboard/organisation/messages`; terms-gated | AC GET /api/organizations/:id/me and /conversations/mine; RAW public org |

## GI: get-involved

| ID | Seat | Route | Element -> handler | API | DB/storage | Notif/email | Badge/count | Setter | Gate | Data path |
|---|---|---|---|---|---|---|---|---|---|---|
| W-GI-01 | anon,P | /get-involved | Three tracks: "Start with a child profile" -> `/onboarding/child` (anon bounces through /login); "Write your first guide" P -> `/upload`, anon `/signup`; "Request your organisation" P -> `/get-involved/organisations/request`, anon `/signup` | - | - | - | - | n/a | anon ok | getCapabilities only |
| W-GI-02 | anon,P | /get-involved | Card grids: Submit an idea, Makers wanted, "Ask for a print" (-> `/printing`), Submit a guide, Build for a family (-> makers-wanted), Give a toy (-> `/dashboard/toys/new`), Design challenges; recycling links | - | - | - | - | n/a | " | static |
| W-GI-03 | anon,P | /get-involved/families | TrackCta -> `/library` | - | - | - | - | n/a | anon ok | static |
| W-GI-04 | anon,P | /get-involved/contributors | TrackCta: P `/upload`, anon `/signup` | - | - | - | - | n/a | " | getCapabilities |
| W-GI-05 | anon,P | /get-involved/organisations | TrackCta: P `/get-involved/organisations/request`, anon `/login?next=` (differs from W-GI-01 which sends anon to /signup) | - | - | - | - | n/a | " | getCapabilities |
| W-GI-06 | P | /get-involved/organisations/request | OrgRequestForm (name, about, why) submit -> BAC POST /api/organizations/requests; success state -> `/dashboard` and `/get-involved/organisations` | POST /api/organizations/requests | organization_requests | none (A finds it in admin queue) | A queue +1 | P | page: anon -> lock card with `/login?next=` | getCapabilities; AC GET /api/organizations/requests (existing) |
| W-GI-07 | anon,P | /get-involved/submit-a-tutorial | Explainer; CTAs -> `/get-involved/contributors`, `/upload` | - | - | - | - | n/a | anon ok | static |
| W-GI-08 | anon,P | /get-involved/submit-an-idea | Anon: "Sign in" link `/login?next=/get-involved/submit-an-idea` (flat, always `/login`). P: IdeaForm | - | - | - | - | n/a | anon sees explainer only | getCapabilities |
| W-GI-09 | P | /get-involved/submit-an-idea | IdeaForm submit (title + summary required, constraints, optional photo) -> BAC POST /api/ideas; photo -> BAC postFormData /api/upload/idea-photo; then `router.push('/dashboard/challenges')`. `?from=:id` prefills an own idea | POST /api/ideas, POST /api/upload/idea-photo | toy_ideas, storage (idea photo) | none (A moderates in admin) | A queue +1 | P | P | AC GET /api/ideas/mine/:id (prefill) |
| W-GI-10 | anon,P | /get-involved/requests | P: "Ask for a build" -> `/get-involved/requests/new`; anon: "Create an account to ask" -> `/signup`; "The open board" -> makers-wanted; "Browse the guides" -> `/library`; list of your own build requests (RecordCard -> `/dashboard/exchanges/build/:id`, Badge stage) | GET /api/toy-transactions (P) | toy_transactions | - | request stage badges | P | anon ok | AC filtered to type build |
| W-GI-11 | P | /get-involved/requests/new | AskForBuildForm (guide, maker or organisation, details) -> BAC POST /api/toy-transactions/build -> push `/dashboard/exchanges/build/:id`. `?guide=` / `?maker=` prefill (maker name resolved server-side via /api/public/makers/:id; own id or unknown -> redirect `/get-involved/requests`) | POST /api/toy-transactions/build | toy_transactions, toy_transaction_messages, tutorials, organizations, profiles | `toy_request` + `build` types to the asked maker/org side | maker unread +1 | P | `requireCapabilities` (anon -> bare /login, `next` lost) | AC GET /api/public/tutorials, /organizations, /makers/:id |
| W-GI-12 | anon,P | /get-involved/makers-wanted | Anon: explainer + `/login?next=` CTA. P: board. Links to `/get-involved/makers-wanted/new`, `/get-involved/submit-an-idea`, `/library` | GET /api/toy-transactions/open-builds | toy_transactions | - | tab counts | P | anon explainer only | AC (P) |
| W-GI-13 | P | /get-involved/makers-wanted | Tabs "Needs a maker / Live / Handed over / Your requests"; Live and Handed over fetch on tab pick (BAC GET /api/toy-transactions/builds-board?tab=&page=) with "load more"; travel-range filter (client) | GET /builds-board | toy_transactions, toy_transaction_messages, toys, tutorials | - | per-tab count | P | " | BAC |
| W-GI-14 | P maker | /get-involved/makers-wanted | "Claim" -> BAC POST /api/toy-transactions/:id/claim; push `/dashboard/exchanges/build/:id` | POST .../claim | toy_transactions (status), toy_transaction_messages, build_request_questions, notifications | `toy_accepted` to the family | family unread +1; maker `exchangeActions` | P | " | BAC |
| W-GI-15 | P | /get-involved/makers-wanted/new | AskOpenlyForm (guide, suburb, travel range required, parts cover) -> BAC POST /api/toy-transactions/build (no maker) -> push + refresh; links submit-an-idea (no guide), makers-wanted | POST /api/toy-transactions/build | toy_transactions, toy_transaction_messages | `build` / `toy_request` to makers in range | makers unread +1 | P | `requireCapabilities` (anon -> /login, no next) | AC GET /api/public/tutorials |
| W-GI-16 | anon,P | /get-involved/events | Filters: format tabs (in person / online) and state chips (links with `?format=&state=`); "Add to calendar" -> `webcal:` feed and plain `API/api/public/events.ics`; "Host an event" -> leader `/dashboard/organisation/events/new`, non-leader `/get-involved/organisations/request` | GET /api/public/events | org_events, organizations, org_event_questions | - | upcoming and past counts | L (publish), P (RSVP) | anon ok | AC (caps) + AC GET /api/public/events?format&state |
| W-GI-17 | anon,P | /get-involved/events | EventCard -> `/get-involved/events/:id`; org link `/organizations/:id/public`; card RSVP button (see W-GI-19) | - | - | - | - | n/a | " | - |
| W-GI-18 | anon,P | /get-involved/events/:id | Detail: date, venue, "who is going" initials, seats left, cost panel, audience, bring list, host link `/organizations/:id/public`; "Add to calendar" -> `/events/:id/calendar.ics` (route handler: AC GET /api/public/events/:id -> .ics text) ; Share | GET /api/public/events/:id (viewer id passed for viewer_going) | org_events, org_event_questions, org_event_registrations (via admin client for counts) | - | going count, seats_left | L (event), P (registrations) | anon ok; 404 unless published | AC |
| W-GI-19 | anon->login, P | /get-involved/events/:id | RSVP: anon `/login?next=`; P with no questions -> BAC POST /api/events/:id/registrations; P with questions -> link `/get-involved/events/:id/register`; "going" state -> BAC DELETE .../registrations | POST/DELETE /api/events/:id/registrations | org_event_registrations | none to the host. Online events: page promises "The joining link is sent to you once you say you are coming" but nothing sends it (see Suspects) | going count, seats_left | P | " | BAC |
| W-GI-20 | P | /get-involved/events/:id/register | EventRegisterForm (name, email, per-question answers, cost acknowledgement) -> BAC POST /api/events/:id/registrations; push event page | POST .../registrations | org_event_registrations, org_event_questions | none | going count | P | page: anon -> `/login?next=`; event missing -> 404; closed/cancelled -> redirect event page | AC GET /api/public/events/:id |
| W-GI-21 | P | /get-involved/events/:id | PrintAtEventForm (events with `prints_parts`; signed-in, not past/cancelled): pick guide + parts + sets -> BAC GET /api/public/tutorials/:id then POST /api/toy-transactions/print-at-event | POST /api/toy-transactions/print-at-event | toy_transactions, print_job_files, stl_files, org_events, toy_transaction_messages | `print` / `toy_request` to the host org leaders | leaders unread +1 | P | caps && prints_parts | BAC |
| W-GI-22 | anon,P | /get-involved/design-challenges | Anon: explainer + `/login?next=`, "Submit an idea" only (the list is NOT shown). P: filter links (`?filter=`), ChallengeCard grid (save heart), Pager, "Submit an idea" | GET /api/public/challenges | toy_ideas, tutorial_contributors, tutorials | - | challenge counts per filter | P authors; A approves (idea_approved) | anon explainer only | RAW + AC GET /api/saves/ids |
| W-GI-23 | anon->signup, P | /get-involved/design-challenges | ChallengeCard heart (slug challenges) -> POST/DELETE /api/saves | POST/DELETE /api/saves | saves | - | Saved count | P | P | BAC |
| W-GI-24 | anon,P | /get-involved/design-challenges/:id | Detail (public by URL even for anon): tabs Status / Outcome / etc. as links `?tab=`; FollowWriteup; Save heart | GET /api/public/challenges/:id | toy_ideas, toy_idea_participants, toy_idea_constraints | - | maker count | P | anon ok; 404 if not public | RAW + AC GET /api/ideas/mine/:id (own idea) |
| W-GI-25 | anon->signup, P | /get-involved/design-challenges/:id | FollowWriteup "Tell me when there is a guide" -> BAC POST /api/saves {entity_type:'challenge'} | POST /api/saves | saves | `challenge_guide_published` by DB trigger 109 when a linked guide is approved | saver unread +1 | P | " | BAC |
| W-GI-26 | anon, P | /get-involved/design-challenges/:id | ChallengeThread: anon "sign in" -> flat `/login`. P non-member: "Join" -> BAC POST /api/ideas/:id/join | POST /api/ideas/:id/join | toy_idea_participants | `challenge_joined` to the author | author unread +1 | P | " | BAC |
| W-GI-27 | P member | /get-involved/design-challenges/:id | Thread: post message -> BAC POST /api/ideas/:id/messages (read list GET /api/ideas/:id/messages) | POST/GET .../messages | toy_idea_messages | none (no notification on a new message) | - | P | members/author only | BAC |
| W-GI-28 | P author | /get-involved/design-challenges/:id | Mark a message as the answer / clear it -> BAC POST /api/ideas/:id/answer {message_id|null} | POST .../answer | toy_idea_messages, toy_ideas | none | - | P author | " | BAC |
| W-GI-29 | P member | /get-involved/design-challenges/:id | Report a participant -> BAC POST /api/ideas/:id/reports; Leave -> BAC DELETE /api/ideas/:id/participants/:self; author removes a participant -> same DELETE | POST .../reports, DELETE .../participants/:id | toy_idea_reports, toy_idea_participants | `challenge_left` / `challenge_removed` | recipient unread +1 | P | " | BAC |
| W-GI-30 | P author | /get-involved/design-challenges/:id | IdeaAuthorActions delete idea -> BAC DELETE /api/ideas/:id | DELETE /api/ideas/:id | toy_ideas | none | - | P | own idea | BAC |
| W-GI-31 | anon,P | /get-involved/recycling | Info + org panel (orgs that take plastic) -> `/organizations`, `/printing`; P credit totals; P CTA "Book a drop-off" -> `/get-involved/recycling/drop-off`; anon CTA `/signup` | GET /api/public/organizations; GET /api/organizations/recycling/credit (P) | organizations, recycling_dropoffs; rpc recycling_credit_balance | - | grams of credit | L (accepts), P | anon ok | AC |
| W-GI-32 | P | /get-involved/recycling/drop-off | DropoffForm: choose org, grams, 7-point declaration (all required), photo (BAC postFormData /api/upload/recycling-photo), note -> BAC POST /api/organizations/:id/recycling; push `/dashboard` | POST /api/organizations/:id/recycling, POST /api/upload/recycling-photo | recycling_dropoffs, storage | none to the org (leaders see it in their dashboard) | org's drop-off queue +1 | P | page: anon -> `/login?next=/get-involved/recycling/drop-off` (the `?org=` choice from W-ORG-13 is lost) | AC GET /api/public/organizations |

## PRINT: printing

| ID | Seat | Route | Element -> handler | API | DB/storage | Notif/email | Badge/count | Setter | Gate | Data path |
|---|---|---|---|---|---|---|---|---|---|---|
| W-PRINT-01 | anon,P | /printing | Hero "Find a printer" -> `#printer-grid`; "Recycle plastic for credit" -> `/get-involved/recycling`; P "Add a printer" -> `/dashboard/printers/new` | - | - | - | "printers open now" (P only) | n/a | anon ok | getCapabilities |
| W-PRINT-02 | P | /printing | PrinterDirectory: facet filter buttons, clear, chips; ordering by distance from your pickup postcode ("Set your postcode" chip -> `/dashboard/profile`); printers owned by you or by an org you lead are removed from the list | GET /api/printers | printers (+ owner join) | - | open-now count | P,L (printer owners) | anon sees a locked directory ("Sign in" `/login?next=`, `/signup`) | AC |
| W-PRINT-03 | anon,P | /printing/basics | Static explainer | - | - | - | - | n/a | anon ok | static |
| W-PRINT-04 | anon,P | /printing/parts | Catalogue search `<form action=/printing/parts>` (`q`, Pager) -> server re-render; part -> `/tutorials/:id` | GET /api/public/printable-parts | stl_files, tutorials | - | result count | P (guide authors add STLs) | anon ok | AC |
| W-PRINT-05 | anon->signup, P | /printing/parts | Save heart (slug parts) -> POST/DELETE /api/saves | POST/DELETE /api/saves | saves | - | Saved count | P | `saved !== null` | BAC |
| W-PRINT-06 | anon,P | /printing/requests | Anon: explainer with `/signup`, `/library`. P without `?guide=`: "pick a guide" -> `/library`. Back link `/printing` | - | - | - | - | n/a | anon ok | AC |
| W-PRINT-07 | P | /printing/requests?guide= | RequestPrintForm: tick parts + quantity (1-20), colour, fit questions, note, choose printer(s) (only those whose bed fits the ticked parts, max per request), agree checkbox -> BAC POST /api/toy-transactions/print -> push `/dashboard/print-requests/:id` | POST /api/toy-transactions/print | toy_transactions, print_job_files, printers, stl_files, tutorials, toy_transaction_messages; rpc recycling_credit_balance | `print` / `toy_request` to the printer owners | owners unread +1; owner `exchangeActions` +1 | P | caps && tutorial found | AC GET /api/printers, /api/public/tutorials/:id |

## IMP: impact

| ID | Seat | Route | Element -> handler | API | DB/storage | Notif/email | Badge/count | Setter | Gate | Data path |
|---|---|---|---|---|---|---|---|---|---|---|
| W-IMP-01 | anon,P | /impact | Totals (guides, toys shared/delivered, contributors, organisations), delivery-by-month chart, recent activity, contributors and organisations lists, stories list + Pager, "more" cards -> `/organizations`, `/impact/map`, `/about/stories`; story -> `/about/stories/:id`; guide cards | GET /api/public/impact, /tutorials, /stories | organizations, profiles, toy_transactions, toys, tutorial_contributors, tutorial_orgs, tutorials, org_stories | - | all totals | derived (P,L,A) | anon ok | RAW + AC |
| W-IMP-02 | anon,P | /impact/map | Suburb pins (only suburbs with >= 3 deliveries) + list; error and empty states | GET /api/public/impact/map | rpc impact_map | - | deliveries per suburb | derived | anon ok | AC (anon call) |
| W-IMP-03 | anon,P | /impact/events | `permanentRedirect('/get-involved/events')` | - | - | - | - | n/a | - | - |
| W-IMP-04 | anon,P | /impact/news | `permanentRedirect('/about/stories')` | - | - | - | - | n/a | - | - |

## ABOUT: about, stories, contact

| ID | Seat | Route | Element -> handler | API | DB/storage | Notif/email | Badge/count | Setter | Gate | Data path |
|---|---|---|---|---|---|---|---|---|---|---|
| W-ABOUT-01 | anon,P | /about | Hub cards (team, contact, partners, support, ...) -> links; CC BY 4.0 external link | - | - | - | - | n/a | anon ok | static |
| W-ABOUT-02 | anon,P | /about/team | Team page; contributors CTA -> `/get-involved/contributors`; ToBeCompleted placeholder blocks | - | - | - | - | n/a | " | static |
| W-ABOUT-03 | anon,P | /about/partners | Partner list -> `/organizations/:id/public`; CTAs `/contact`, `/get-involved/organisations`, `/get-involved/organisations/request` | - | - | - | - | n/a | " | static list `Org` |
| W-ABOUT-04 | anon,P | /about/support | Ways to help cards -> `/get-involved/contributors`, `/organizations`, `/get-involved/organisations`, `/get-involved/submit-an-idea`, `/get-involved/events`, `/contact` | - | - | - | - | n/a | " | static |
| W-ABOUT-05 | anon,P | /about/stories | Kind filter links (`href(f.value)`), featured story, story list; leader CTA `/dashboard/organisation/publish`, others `/get-involved/organisations` | GET /api/public/stories | org_stories, organizations | - | story count | L (publish) | anon ok | AC |
| W-ABOUT-06 | anon,P | /about/stories/:id | Story detail: org link, linked guide link, other stories, Share | GET /api/public/stories/:id | org_stories, organizations, tutorials | - | - | L | anon ok; 404 | AC |
| W-ABOUT-07 | anon,P | /contact | ContactForm (topic, name, email, message, no account needed; prefilled for P) -> BAC POST /api/public/contact; mailto link | POST /api/public/contact | contact_messages | none (no email to staff; A reads it in admin inbox) | admin inbox count | anon,P | anon ok | BAC |

## LEARN: course (localStorage progress)

| ID | Seat | Route | Element -> handler | API | DB/storage | Notif/email | Badge/count | Setter | Gate | Data path |
|---|---|---|---|---|---|---|---|---|---|---|
| W-LEARN-01 | anon,P | /learn (and 14 lesson routes) | LearnGate reads `shown_as` from `site_content.learn-course`: `free` = open to all; `sign_in` = anon -> `/login?next=/learn` (lesson path lost); otherwise admin-only with "Hidden from members" banner, others see "Course hidden" | GET /api/public/learn-course (and GET /api/admin/content for A preview) | site_content | - | - | A (shown_as, content via learn-course-editor) | per `shown_as` | AC |
| W-LEARN-02 | anon,P | /learn | LearnHome: "Continue" -> next unfinished lesson, outline links, `/library` link | - | localStorage `splat_learn` | - | progress ring (done count) | web (own browser) | gate above | client |
| W-LEARN-03 | anon,P | /learn/:slug (toy-adaptation-101, how-a-switch-works, switch-types, tools-and-materials, choosing-a-toy, safety-and-cleaning, wire-a-connector, build-a-switch, build-duck-bubbles, build-hamster-mania, build-ms-rachel, handover) | LearnShell: outline toggle, Previous / Next (Next marks the lesson done via `markDone`) | - | localStorage | - | done set | web | gate above | client + static JSON `lib/learn-content.json` |
| W-LEARN-04 | anon,P | /learn/checkpoint-1..3, /learn/final-checkpoint | Quiz option buttons -> `recordAnswer`; completing all questions `markDone` regardless of score; "Try again" `resetQuiz` | - | localStorage | - | score "N of M right" | web | gate above | client |
| W-LEARN-05 | anon,P | /learn/handover | Links `/legal/intended-purpose`, `/toy-library` | - | - | - | - | n/a | gate above | static |
| W-LEARN-06 | anon,P | /learn/ask-an-expert | Expert directory cards (d.href) and `/contact`; not behind LearnGate | - | - | - | - | n/a | anon ok | static |

## LEGAL and static prose

| ID | Seat | Route | Element -> handler | API | DB/storage | Notif/email | Badge/count | Setter | Gate | Data path |
|---|---|---|---|---|---|---|---|---|---|---|
| W-LEGAL-01 | anon,P | /privacy | Prose; links `/contact`, `/delete-account`, `/legal/intended-purpose` | - | - | - | - | n/a | anon ok | static |
| W-LEGAL-02 | anon,P | /terms | Prose; links `/code-of-conduct`, `/contact`, `/legal/contributor-terms`, `/legal/intended-purpose`, `/safety` | - | - | - | - | n/a | " | static |
| W-LEGAL-03 | anon,P | /safety, /code-of-conduct | Prose; `/contact` link | - | - | - | - | n/a | " | static |
| W-LEGAL-04 | anon,P | /legal/contributor-terms | Terms text (ContributorTermsContent, same component as signup dialog and gate) | - | - | - | - | n/a | " | static |
| W-LEGAL-05 | anon,P | /legal/intended-purpose | Prose; ToBeCompleted block; `/contact` | - | - | - | - | n/a | " | static |
| W-LEGAL-06 | anon,P | /legal/org-leader-terms | Only a "These terms have not been written yet" stub (ToBeCompleted), yet W-ORG-04 records an acceptance of it | - | - | - | - | none | " | static |

## NOTIF: notifications

| ID | Seat | Route | Element -> handler | API | DB/storage | Notif/email | Badge/count | Setter | Gate | Data path |
|---|---|---|---|---|---|---|---|---|---|---|
| W-NOTIF-01 | P | /notifications | List of every notification, newest first; each row's text from `copyFor(n)`; icon/tint per type | GET /api/notifications/me, GET /api/collaborators/me/invites | notifications, tutorial_collaborator_invites | - | header badge counts unread (read_at null) | system (all types listed under W-TOY/W-TUT/W-ORG/W-GI) | middleware: anon -> bare /login. Not terms-gated | AC (server component) |
| W-NOTIF-02 | P | /notifications | Click a row -> SA markRead(id) -> PATCH /api/notifications/:id {read:true}, revalidate, then `router.push(linkFor(n))` (linkFor routes to /dashboard/exchanges, /dashboard/messages, /get-involved/events, /about/stories, /tutorials/:id[/edit], /admin/review/:id for A, /get-involved/design-challenges, /contributors/:id, /dashboard/reports ...) | PATCH /api/notifications/:id | notifications.read_at | - | unread.total -1 (and the My SPLAT card bucket) | P | P | SA |
| W-NOTIF-03 | P | /notifications | "Mark all read" (only when something is unread) -> SA markAllRead: GET /me, then one PATCH per unread row in parallel (N requests) | GET /api/notifications/me + N x PATCH /api/notifications/:id | notifications | - | unread.total -> 0 | P | P | SA |
| W-NOTIF-04 | P | /notifications | `collaborator_invited` rows: Accept / Decline -> SA acceptInvite / declineInvite -> POST /api/collaborators/invites/:id/accept or /decline | POST .../accept, .../decline | tutorial_collaborator_invites, tutorial_contributors, notifications | `collaborator_accepted` / `collaborator_declined` to the inviter | inviter unread +1; invitee list refresh | P | P | SA |
| W-NOTIF-05 | P | /notifications | (Not on this page) Bucket mark-read happens only on dashboard/exchanges, /challenges, /tutorials via MarkNotificationsRead -> POST /api/notifications/me/read {bucket} | POST /api/notifications/me/read | notifications | - | bucket count -> 0 | P | P | BAC |

## MISC

| ID | Seat | Route | Element -> handler | API | DB/storage | Notif/email | Badge/count | Setter | Gate | Data path |
|---|---|---|---|---|---|---|---|---|---|---|
| W-MISC-01 | anon,P | /not-built/:id | ComingSoon: title/blurb from PENDING registry (or "Not built yet" for unknown id), "Home" link. No inbound link on web (grep finds none in app/components/lib); mobile owns the `/not-built?feature=` flow | - | - | - | - | none | anon ok | static |
| W-MISC-02 | anon,P | ComingSoon (component) | NotifyForm "tell me when it is ready" -> POST /api/public/notify. Never rendered: no page passes `featureKey` | POST /api/public/notify | notify_signups | none | - | none | - | raw fetch to NEXT_PUBLIC_API_URL |
| W-MISC-03 | anon,P | /design-system, /design-system/states | Component and interaction-state gallery (Badge, Alert, Field, Control...) | - | - | - | - | n/a | anon ok (listed in More menu) | static |
| W-MISC-04 | anon,P | /files/:bucket/*path | Route handler: allowlist tutorial-pdfs, stl-files, exchange-receipts, build-shots, print-shots. No user -> 302 `/signup?next=...&reason=download`; user -> signed URL 60 s via the USER session (storage RLS decides) -> 302 | - | storage buckets above | - | - | n/a | signed-in | route handler, SB |
| W-MISC-05 | anon,P | /events/:id/calendar.ics | Route handler: AC GET /api/public/events/:id -> text/calendar | GET /api/public/events/:id | org_events | - | - | n/a | anon ok | AC |

---

## Suspects

1. Online events never deliver their joining link. Event page says "The joining link is sent to you once you say you are coming" (get-involved/events/[id]/page.tsx); API `GET /api/public/events/:id` hard-sets `online_url: null` with the comment "a registrant is given it after they confirm, through the authenticated route". No such route exists: `events.ts` never selects `online_url`, POST /registrations sends no email or notification, `sendEmail` is only wired to org leader invites and account deletion. A registrant of an online event cannot get the link.
2. Web has no forgot-password, no email-code sign-in, no resend-confirmation, no Apple/Google (mobile has A03-A10). An unconfirmed user on /login sees a raw Supabase error with no way forward; a user who forgets a password has no web recovery. Also `/auth/confirmed` does not sign the user in, so they type the password again.
3. Return paths are dropped in several places: middleware redirects `/upload` and `/notifications` to bare `/login`; `requireCapabilities()` redirects to bare `/login` (used by requests/new, makers-wanted/new, tutorials/:id/edit); toy request loses `?mode=`; drop-off loses `?org=`; LearnGate loses the lesson path; ChallengeThread sign-in is flat `/login`; terms gate drops the query string. After login the user lands on /dashboard instead.
4. `/organizations` prefix is in the middleware terms list, so the PUBLIC directory, PUBLIC org profile and org message page bounce a signed-in member who has not accepted contributor terms, while the identical pages are open to anon visitors. Inconsistent with "public browsing stays reachable".
5. Dead or orphaned: `/not-built/[id]` has no inbound link; NotifyForm + `POST /api/public/notify` + `notify_signups` are unreachable (ComingSoon never receives `featureKey`, and the API allowlist holds only keys for sections that are now all live); `DELETE /api/tutorials/:id/build` has no web caller (the "I built this" button cannot be undone and always starts un-done); `GET /api/public/map` has no web consumer; `exchangeActions` is fetched on every page but Nav never renders it.
6. Guide notes: web can pin/unpin but cannot create or delete a community note or upload a note photo (mobile only). On a web-only account the "revisions" section can never get content.
7. Stored-href risk: `organizations.website_url` is only length-checked in `PATCH /api/organizations/:id/profile` (300 chars, no scheme check) and rendered as `<a href={org.website_url}>` on the public org page. A leader can store a `javascript:` URL.
8. Re-review is inconsistent in the guide editor: details, photos, PDF, prices-checked and customisation fields flip an approved/rejected guide to `pending` (pulling a live guide off the site), but parts, tools, steps, safety notes, STL settings and recommendations do not.
9. `legal/org-leader-terms` is a "not written yet" stub (version v0-todo) but the org review banner records an acceptance of it, and approvals are gated on that acceptance.
10. Duplicated or inconsistent behaviour across routes: "Pick for my child" goes to the child wizard on /library but to `/learn/choosing-a-toy` on /toy-library; anon on the toy detail page sees no Save while list cards route anon to signup; anon on the guide page sees no Save either; the "Build it yourself" and "Give a toy" tracks send anon through the bare middleware redirect, "Write your first guide" sends anon to /signup, organisations CTA sends anon to /login; `/signup` has no banner copy for `reason=follow` or `reason=message`.
11. A leader of the holding org still sees "Ask to collect it" on their own org's toy (only `viewerId === owner_id` hides it); the profile page shows "Ask {first} to build a guide" on your own profile; signed-in users who open /login or /signup get the form again.
12. Silent failures: new-guide cover upload errors are swallowed (guide is created with no cover); notification "Mark all read" fires N parallel PATCHes and ignores per-row failures; home page replaces an API outage with zeros and empty lists; terms middleware fails open.
13. No notification or email is produced for: event RSVP (host), contact form (staff), challenge messages and answers, idea submit, org-request submit, report submit, recycling drop-off booking. Staff and leaders must poll their dashboards/admin queues.
14. `/delete-account` renders its own `<main>` inside the layout's `<main id=main>` (nested landmark). `tutorial_view` page-view counter increments on every server render, including crawlers and prefetches.
15. `MarkNotificationsRead` only runs on three dashboard pages; opening `/notifications` never clears a bucket, so a member can clear My SPLAT cards without ever touching the badge total path, and vice versa (two sources of truth for unread).

## Counts

Routes covered: 82 page.tsx files under packages/web/app excluding dashboard/** and admin/** (including 3 redirect-only/static prose pages), plus 2 route handlers (`/files/[bucket]/*`, `/events/[id]/calendar.ics`), root layout, bare layout branch, middleware.ts, header, footer, dock, not-found. Dashboard-owned components referenced only as pointers (DeleteAccountForm, SignOutButton).
Rows: CHR+MW 18, HOME 10, AUTH 16, ONB 4, LIB 9, TOY 16, TUT+EDIT 33, CON 4, ORG 14, GI 32, PRINT 7, IMP 4, ABOUT 7, LEARN 6, LEGAL 6, NOTIF 5, MISC 5 = 196 rows.
