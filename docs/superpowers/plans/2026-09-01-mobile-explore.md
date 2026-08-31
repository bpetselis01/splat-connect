# Mobile Explore & Inbox (Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The last two stub tabs become real: Explore (search, the Learn path with read progress, Get Involved, About) and Inbox (bucketed notifications with web's exact copy, tap-through links, collaborator invite actions, mark-read). Plus the challenges surfaces: public list/detail with join/leave and the participant thread, Submit an idea, and My challenges behind MY SPLAT.

**Architecture:** Zero API/schema changes. Notifications port web's `COPY` map and `linkFor` router (retargeted at mobile routes). The challenge thread mirrors the exchange thread's polling posture (web uses realtime; mobile polls at 10s — same ruling as Phase 3). Learn articles are transcribed once into a structured content module with provenance comments (the spec wished for a shared source; web's articles are JSX pages and lifting them means refactoring web — out of a mobile branch's scope; the delta is named for Byron). Read-state is device-local.

**Tech Stack:** Expo SDK 57, expo-router 57. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-30-mobile-catch-up-design.md` — "Explore tab", "Inbox tab", the challenges entries, decision 7/8. The mockup stays the visual authority (the Learn path, the Continue card, the Inbox layout).

## Global Constraints

- Package `packages/mobile`; gates `pnpm typecheck`, `pnpm test:unit`, `pnpm test:e2e` (T7 only). Pixel tokens; the established card/a11y conventions; tests self-contained; icons mocked; pristine output. Commits per logical change with the two Phase-1 trailers; never push; the controller re-splits per file before landing.
- API contract, verbatim:
  - Notifications: `GET /api/notifications/me` → `Notification[]` (type, `tutorial_id/tutorial_title`, `toy_transaction_id/toy_name`, `idea_id`, `actor_name`, `read_at`, `created_at`); buckets tutorials/exchanges/challenges via `NotificationBucket` and the API's `typesInBucket` semantics (port the type→bucket mapping from `packages/api/src/routes/notifications.ts`); per-row read = `PATCH /api/notifications/:id {read: true}`; per-bucket = `POST /api/notifications/me/read {bucket}`. Invites: `GET /api/collaborators/me/invites` → `TutorialCollaboratorInvite[]`; `POST /api/collaborators/invites/:inviteId/accept|decline {}`.
  - Copy: port web's `COPY` map from `packages/web/components/notifications-list.tsx` VERBATIM (all 21 types). Links: port `linkFor` with mobile targets — `toy_transaction_id` → `/exchanges/{id}`; `backing_requested`/`tutorial_submitted` → `/organisation` (admin variant collapses to the same — mobile has no admin review); other `tutorial_id` → `/tutorials/{id}` (the editor); `idea_id` → `idea_rejected` ? `/challenges` : the public challenge detail route; fallback stays put.
  - Challenges: `GET /api/public/challenges` → rows `{id, title, summary, contact_prefs, status, created_at}` (status challenge|graduated); `GET /api/public/challenges/:id` (the brief + participants — read the route for the exact shape); join `POST /api/toy-ideas/:id/join {}` (only status 'challenge'); leave `DELETE /api/toy-ideas/:id/participants/:profileId`; thread (participants only): `GET/POST /api/toy-ideas/:id/messages` (the GET 403s/filters for non-participants — read the route and mirror web's join-gated presentation: "Join this challenge to read and take part in the conversation."); mine `GET /api/toy-ideas/mine`; joined `GET /api/toy-ideas/joined`; submit `POST /api/toy-ideas {title, summary, description, intended_use, primary_user, contact_prefs}` (mirror web's form at `app/get-involved/submit-an-idea/page.tsx` — its fields, labels and required-ness are the contract).
  - `IDEA_LABEL` from web's `badge.tsx` for idea statuses; saves slug `challenges` on the public detail.
- Learn: six articles transcribed from `packages/web/app/learn/*/page.tsx` into `lib/learn-content.ts` as `{slug, title, intro, minutes, sections: {heading, paragraphs}[]}[]` — prose faithful, links flattened to plain text, each entry commented with its source file (drift risk named). Order: toy-adaptation-101, switch-types, choosing-a-toy, tools-and-materials, safety-and-cleaning, printing-basics — **check**: web has no printing-basics page under /learn (it lives at `/printing/basics`); transcribe that page as the sixth. Ask an expert: read `web/app/learn/ask-an-expert/page.tsx` and mirror its mechanism (form or link-out) — state which.
- Read-state: `lib/learn.ts` `useLearnProgress()` — device-local via the same storage the profile segment uses (`resolveAuthStorage`), key per slug; exposes `{read: Set<string>, markRead(slug), next}`.

---

### Task 1: Learn content + progress

**Files:** create `lib/learn-content.ts`, `lib/learn.ts`; tests `tests/unit/lib/learn.test.ts` (+ a content sanity test: six entries, unique slugs, every section non-empty).
**Interfaces:** as the Global Constraints define. `useLearnProgress` loads persisted slugs on mount, `markRead` persists and updates state, `next` = first unread in order (or null when all read).
Steps: TDD → implement (transcription is the bulk — faithful prose, no invention) → `pnpm typecheck && pnpm test:unit` → commit `feat(mobile): the six learn articles as data, and their read state`.

### Task 2: The Explore tab and About

**Files:** `app/(tabs)/explore.tsx` → group `app/(tabs)/explore/{_layout,index}.tsx` (the toy-library restructure pattern; tab registration unchanged); create `components/explore/explore-screen.tsx`, `components/explore/about-screen.tsx`, route `app/(tabs)/explore/about.tsx`.
**Interfaces:** Explore = compact search (client-side across `GET /api/public/tutorials|toys|organizations`, debounced fetch-once-then-filter; results grouped by kind, tapping routes to the right detail; empty query hides results) + three entry cards: **Learn** (progress `x/6` from `useLearnProgress`, honey tint) → `/explore/learn`; **Get Involved** (mint) → `/explore/challenges`; **About SPLAT** (sunken) → `/explore/about`. About = the pcard + link rows (Team·Partners·Support, Which one are you, Impact, Contact, Safety) each opening the web page via `Linking.openURL(EXPO_PUBLIC_WEB_URL + path)` — the spec's decision 5 list.
Steps: TDD (cards render with progress; search filters and routes; about rows call Linking) → implement → gates → commit `feat(mobile): explore — search, and the three doors`.

### Task 3: The Learn hub and articles

**Files:** create `components/explore/learn-hub.tsx`, `components/explore/article-screen.tsx`, routes `app/(tabs)/explore/learn/{index,[slug]}.tsx`, ask-an-expert per its mechanism (route or link row).
**Interfaces:** Hub = the mockup: "Continue" card (next unread: number, title, `Meter` progress `read/6`, minutes) → the article; the numbered vertical path (mint tick for read via the hidden-status a11y conventions, apricot "now" node, connector line) → articles; **Ask an expert** CTA at the end. Article = title, intro, sections (heading + paragraphs), "Mark as read" primary at the end (calls `markRead`, `router.back()`); auto-mark alternatives rejected — explicit beats scroll-detection.
Steps: TDD (hub order/ticks/continue; article renders sections and marks read) → implement → gates → commit `feat(mobile): the learn path — continue card, numbered hub and articles`.

### Task 4: Challenges — public list and detail

**Files:** create `components/challenges/list-screen.tsx`, `components/challenges/detail-screen.tsx`, routes `app/(tabs)/explore/challenges/{index,[id]}.tsx`.
**Interfaces:** List = header + `+ Submit an idea` pill (→ `/explore/challenges/new`, Task 5); "Open challenges" rows (title, summary 2-line, participants count if the list shape carries it — otherwise omit; "you're in" marker from `GET /api/toy-ideas/joined` when signed-in) and "Solved · became guides" group (graduated; row links to its `tutorial_id` guide when set). Detail = brief (title + save `challenges` + summary + the longer fields the public route returns), participants list, **Join this challenge** (status 'challenge' only) / "✓ You joined · Leave" (leave confirms via Alert), and the thread section (Task 5 wires messages; this task renders the join-gated placeholder copy verbatim: "Join this challenge to read and take part in the conversation.").
Steps: TDD → implement → gates → commit `feat(mobile): design challenges — the open board and the brief`.

### Task 5: The challenge thread, Submit an idea, My challenges

**Files:** extend `components/challenges/detail-screen.tsx` (thread), create `components/challenges/submit-idea-screen.tsx` + route `app/(tabs)/explore/challenges/new.tsx`, replace stub `app/(my)/challenges/index.tsx` with `components/challenges/my-screen.tsx`.
**Interfaces:** Thread (participants only): `GET /api/toy-ideas/:id/messages`, 10s focused polling with the generation-ref guard (the Phase-3 thread pattern — reuse its shape, don't invent), bubbles + composer `POST /:id/messages {body}`; non-participants keep the join-gated copy. Submit = web's form fields mirrored (title, summary, description, intended_use, primary_user, contact_prefs as checkboxes) → POST → success state → `/challenges` (mine). My challenges = "Challenges you joined" (rows → public detail) + "Your ideas" (every status, `Badge` + `IDEA_LABEL`, `review_note` in the apricot note box, graduated rows link to the guide) — mirror web's `dashboard/challenges` rules (only challenge/graduated link out).
Steps: TDD (thread gating both sides; poll teardown; submit posts the exact fields; my-screen statuses and linking rules) → implement → gates → commit ×2 (`feat(mobile): the challenge thread and submit an idea`, `feat(mobile): my challenges behind MY SPLAT`).

### Task 6: Inbox

**Files:** create `components/inbox/inbox-screen.tsx`, `lib/notifications.ts` (the ported COPY map + `linkFor` + `bucketOf`); `app/(tabs)/inbox.tsx` renders it as the tab; replace stub `app/(my)/notifications.tsx` with the same component (title "Notifications" — one component, two addresses per spec decision 7).
**Interfaces:** Reads `GET /api/notifications/me` + `GET /api/collaborators/me/invites`. Groups by bucket (Exchanges / Tutorials / Challenges eyebrows with "N unread"); rows: the COPY line (bold when unread + the apricot dot), relative time, chevron; tap = fire-and-forget `PATCH /:id {read:true}` (when unread) + `router.push(linkFor(n))`. `collaborator_invited` rows with a pending invite render **Accept** / **Decline** inline (POST, then refetch; busy state per row). Per-bucket "Mark read" pill on each eyebrow row (`POST /me/read {bucket}`, optimistic). Focus refetch. Empty state "Nothing yet." like web.
Steps: TDD (copy map spot-checks across all three buckets; linkFor's mobile targets incl. the idea_rejected branch; invite accept flow; per-bucket mark-read; unread styling) → implement → gates → commit `feat(mobile): the inbox — every notification, its link and its actions`.

### Task 7: E2E sweep and full verification

**Files:** new `tests/e2e/explore.spec.ts` (Explore cards; Learn path: read an article, tick appears, Continue advances — localStorage-backed on web export; search routes to a seeded guide), `tests/e2e/challenges.spec.ts` (list from a seeded challenge fixture — add `createChallenge(authorId, overrides)` to helpers via admin insert into toy_ideas with status 'challenge'; join; thread message round-trip; submit an idea lands in My challenges), `tests/e2e/inbox.spec.ts` (a seeded notification renders web's copy, tap marks read and routes; bucket mark-read clears the count).
Steps: helpers → specs → kill any 3102 squatter (say so; controller restarts) → full gates `pnpm typecheck && pnpm test:unit && pnpm test:e2e` green → commit ×2 (helpers; specs).

---

## Self-review notes (at write time)

- Decision 7 (Inbox = the notifications page, one component two addresses) and decision 8 (Learn as a numbered path) land in T6/T3. The four supporting sections' link-outs (About) match decision 5's not-on-mobile list.
- Deltas to surface to Byron once: (1) Learn prose is transcribed, not shared — a future content package could unify it; (2) the challenge thread polls at 10s like exchanges (web is realtime); (3) collaborator-invite accept/decline is included in the Inbox (web parity) even though the mockup didn't draw it.
- Cross-task: `useLearnProgress` T1→T2/T3; explore group restructure T2 precedes T3/T4 routes; `Meter` reused in T3; the P3 thread pattern reused in T5; `linkFor` targets exist (exchanges/tutorials routes from P2/P3; `/organisation` is the P1 stub — acceptable landing until Phase 5).
- Discovery points named in-task: the public challenge detail's exact shape (T4), the messages route's non-participant behaviour (T5), ask-an-expert's mechanism (T3), the submit form's exact fields/labels (T5).
