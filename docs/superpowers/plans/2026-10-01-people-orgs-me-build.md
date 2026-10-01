# People, Orgs, Me + Admin Build (Sub-project 4, Batch 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 20 people, organisation, Me, child-profile, admin and sign-in items in `packages/types/src/pending.ts` (`learn-ask-an-expert-mobile`, `child-switch-sound`, `explore-community-stats`, `web-admin-review-list`, `contributor-profile-details`, `saved-list-meta`, `my-challenges-meta`, `organisations-list-meta`, `org-profile-rows`, `thank-people`, `report-problem-mobile`, `notification-second-line`, `me-rows-structure`, `me-count-badges`, `admin-counts`, `wizard-steps`, `wizard-mascot-done`, `site-content-learn-legal-editing`, `impact-map`, `android-one-tap`) and ship each one out of the registry.

**Architecture:** One task per registry item, in the spec's six slices. Six of them add a migration, 116–121. Counts are never columns: they are SECURITY DEFINER computed fields (`stable`, `search_path = ''`) or head-count queries in a route. Shared pure rules go in `packages/types` (`guideMeta`, `notificationSecondLine`, `matchesForChild`, `mergeLearnCourse`, the Learn course default) so web, mobile and the API say the same thing. Names in every new read come from the admin client, never a PostgREST `profiles(...)` embed. The impact map's "three or more" rule lives in one SQL function so no caller can forget it.

**Tech Stack:** Hono + supabase-js + vitest (api), Next.js 16 App Router + React 19 + vitest (web), Expo SDK 57 / Expo Router / React Native + jest + RNTL (mobile), Postgres migrations via the Supabase CLI, Leaflet 1.9 + react-leaflet 5 (new, web only).

**Spec:** `docs/superpowers/specs/2026-10-01-people-orgs-me-build-design.md` (inherits "Rules every slice keeps" from `docs/superpowers/specs/2026-10-01-guides-build-design.md`).

**Batches this one stands on** (they land first; use their names exactly):
- Batch 1 guides (`docs/superpowers/plans/2026-10-01-guides-build.md`, already built): `partsTotalCents` in `packages/types/src/guides.ts`, `view_count(tutorials)` (092), `builds_count(tutorials)` (091), `tutorials.build_minutes` (066).
- Batch 2 printing (`2026-10-01-printing-build.md`, Task 13, migration `099_postcodes_and_distance.sql`): table `postcode_centroids(postcode text pk, lat double precision, lng double precision)`, `postcode_km(a text, b text) returns int`.
- Batch 3 toys/exchanges (`2026-10-01-toys-exchanges-build.md`): `gradeOf(condition: number): Grade` and `GRADES` in `packages/types/src/toy-grade.ts`, re-exported from `@splat-connect/types`; `toys.paused_at timestamptz` (`100_toy_paused.sql`), `Toy.paused_at?: string | null`.
- Batch 4 challenges/makers (`2026-10-01-challenges-makers-build.md`): adds notification types `challenge_guide_published` (109) and `build_question` (111); adds `GET /api/ideas/mine/:id` and rewrites `IdeaRow` in `packages/mobile/components/challenges/my-screen.tsx` so every own idea opens (Task 9). It adds no maker/post helper: makers and posts stay in `challengeCounts` (public.ts), whose fields are `maker_count` and `answer_count`.
- Batch 5 recycling owns 112–115 and may add notification types.

**Where this plan follows the code, not the spec** (each is repeated in the task that meets it):

1. `site_content.key` must match `^[a-z][a-z0-9-]{1,60}$` (065 and the admin PUT). The spec's key `learn_course` cannot be stored; Task 18 uses `learn-course`.
2. `lib/learn-course.ts` lessons have `minutes` and `kind: 'read' | 'build' | 'quiz'`; the course has no title, "Shown as" or outcome today. Task 18 keeps `quiz` as the stored value and labels it "Checkpoint", and adds the three course fields to the saved value only.
3. Mobile Learn does not read `learn-course.ts` at all: it is six flat articles (`packages/mobile/lib/learn-content.ts`) with no units or lessons. Task 18's mobile half reads the course title, outcome and "Shown as"; units and lessons have nothing to land on in the app.
4. A returned guide's reason is `tutorials.rejection_note`, not `review_note` (`review_note` is the idea's). An organisation leader's return (`tutorial-orgs.ts` `POST /:id/review`) writes `rejection_note` and sends no notification at all — a pre-existing gap Task 12 does not widen into.
5. `org_thanks` (077) has no `transaction_id`; `profile_thanks` gets one as the spec says. 077 recreated `notifications_one_subject` with no guard; Task 10 guards its recreation.
6. 077's `org_thanks_own_update` lets a thanker clear a leader's `hidden_at` through PostgREST. `profile_thanks` does not copy that hole: column-level `update (note, byline, show_note)` only.
7. The mobile `ReportProblem` hardcodes `ok_to_contact: true` and types `subjectKind` as `'guide' | 'toy'`. Task 11 adds the board's "OK to contact me about this" toggle and every kind, and closes `member_reports_own_insert` letting a member insert `status`/`note_to_reporter`/`handled_by` directly.
8. Organisation leaders have no role column (`org_leaders` is `org_id, user_id`); the contributor's "{role}" and backing-org chip belong to the open `contributor-role-line` item. Rows show what exists; the role is left out.
9. No list screen filters by organisation, so "All {n} →" / "See all →" expand the section in place (Task 9).
10. The wizard today is six screens (name and age, the four 079 switch questions, the room), not About/Hands/Movement. The board's Hands (both/one/left/right) and Movement (press/lever/grasp/near) options have no columns, and the 079 answers are what `suitsChild` matches on. Task 16 keeps the six screens and adds Play and Measurements.
11. `palm_width_mm` exists (003) but the API refuses it on purpose (APP 3 minimisation) and `crud.test.ts` pins the refusal. The registry's 2026-09-30 decision ("Add Measurements as an optional step, kept on the child profile") authorises Task 16 to make it writable.
12. Toys carry no switch tags, so "{t} toys that suit" counts switch-adapted, published, not-paused toys whatever the child (the spec's rule, Task 17).
13. Guides takes no route params. "See the matches" opens Guides with `suits=1`, which presets the existing "Suits {child}" chip (`fitLine` over every child) instead of carrying an id list (Task 17).
14. `/api/ideas/joined` drops the participant's `joined_at`; Task 7 adds it. `challengeCounts` is module-private in `public.ts`; Task 7 moves it to its own module. "posts" is `answer_count`.
15. `view_count` is exposed only on `/api/tutorials/mine` today. Showing "{n} views" on a public showcase makes view counts public (Task 5) — a product change the spec asks for.
16. Web `/admin`'s Recent activity feed is built from the same lists as the counts, so it cannot drop to one call. Task 15 removes only the two calls that fed counts and nothing else (spot-check, organisations).
17. WB draws no search box on the review queue, and no deliveries map screen (only story s4's words). Tasks 4 and 19 flag their few strings.
18. `signInWithIdToken` is called in `lib/auth-context.tsx` (`withIdToken`), not in `social-auth.tsx`. Task 20 adds the silent token getter to social-auth and the sign-in to auth-context.
19. `GET /api/public/impact`'s `toysDelivered` counts every completed transaction including builds and print jobs; `contributors` counts only public showcases and `organisations` only orgs with a contribution. Task 3 shows the numbers as served and does not change their meaning.
20. MB and WB disagree about Makers wanted and Recycling: MB puts Makers wanted under "Give us a challenge" and Recycling under Explore; WB keeps "Build for a family" and "Recycle plastic" on the web hub. The registry decision ("follow the board in the shared nav model") is followed (Task 13): the web hub loses its Recycle plastic card and gets Build for a family from the model.

## Controller rulings (override the tasks below where they differ)

1. **Files are paths, never URLs.** No task here accepts a member-supplied file. The only file columns read are `organizations.logo_url` (written by `POST /api/upload/org-image`, the server) and the generated `toy_photo_url` / `cover_photo_url` (053). No task writes any of them.
2. **Names come from the admin client.** Every new name lookup (a saved guide's author, an org guide's author, a thanks notification's actor) reads `profiles.name` by id through `createAdminClient()`. No new `profiles(...)` or `organizations(...)` embed under a user or anon client.
3. **Public pages show results inline.** Public web pages have no `ToastProvider` (`useToast` silently no-ops without one — `components/toast.tsx` line 13). Any result on a public page renders as `role="status"` (success) or `role="alert"` (failure) beside the control. Task 10 fixes `ThanksButton` this way; `components/org-actions.tsx` has the same silent no-op and is flagged, not fixed.
4. **The impact map never returns a suburb under three deliveries and never an address.** The threshold lives in `public.impact_map()` (121), the only reader; the route returns its rows untouched.
5. **`android-one-tap` ships unit-tested only.** It cannot run until `google-sign-in` is set up; the registry entry ships with a `needs` line saying so.

## Global Constraints

- **One migration per slice that needs schema, numbered from 116** (batches 1–5 own 085–115): `116_organisation_list_counts.sql`, `117_profile_thanks.sql`, `118_member_report_kinds.sql`, `119_notification_body.sql`, `120_child_profile_play_measurements.sql`, `121_impact_map.sql`. Each has a `-- DOWN:` block like 068/074. Each migration's integration test selects or exercises its new objects through the admin client, so a repaired-not-run migration fails loudly. RLS tables, grants and the definer functions also get rows in `scripts/check-schema-guards.sh`.
- **Notification types:** only Task 10 adds one (`profile_thanked`). Before writing 117, re-read the LATEST migration that redefines the check: `grep -ln "notifications_type_check" supabase/migrations/*.sql | sort | tail -1`. At the time of writing that is `093_tutorial_notes.sql`, and batch 4 plans `109` (`challenge_guide_published`) and `111` (`build_question`) on top; batch 5 may add more. Copy THAT file's list, then use the 046/077/093 guard-and-recreate pattern on top of it. The same re-read applies to `notifications_one_subject`: `grep -ln "notifications_one_subject" supabase/migrations/*.sql | sort | tail -1` (077 today).
- **No counter columns.** Counts are SECURITY DEFINER computed fields like 073's `save_count(toys)` or 077's `org_thanks_count`, or head-count queries (`{ count: 'exact', head: true }`).
- **Limits are checked twice:** the API returns 400 with a plain sentence (the API has no zod — hand-written checks, as in every route here); a CHECK in the database backs it. Thanks `note` 1–200, `byline` 1–60; notification `body` ≤ 300; `child_profiles.enjoys` ⊆ six values; `palm_width_mm` 20–250, `reach_cm` 5–150, `tray_mm` 1–100; Learn course title 1–80, outcome ≤ 400, unit title 1–80, unit blurb ≤ 300, lesson title 1–80, lesson minutes 1–240.
- **Copy is quoted from the boards** (`Splat Connect frontend overhaul/SPLAT Connect - Mobile.dc.html` = MB, `SPLAT Connect - Web.dc.html` = WB). Where the two boards differ, each platform takes its own board's words. Every string a task introduces is listed in that task with its source. Strings with no board source, flagged for Byron: "Search by guide or contributor name", "No guide or contributor matches that search.", "{actor} said thanks to you", "Your child's profile is ready", "that suit your child", "Could not send that. Try again." (reused from `ThanksButton`), the Learn editor's "Lesson", "Minutes", "Kind" and "Read" / "Build" / "Checkpoint" labels, "Course hidden", the wizard's out-of-range hint "Between {min} and {max}.", and the deliveries map's "No suburb has three deliveries yet.", "{suburb}, {state} · {n} deliveries" and "The map could not load. Try again soon." lines (its rule line is WB:9958's, put in the present tense).
- **Mobile dates** use `toLocaleDateString('en-AU', …)`, never types' `shortDate` (Hermes; memory: mobile Hermes runtime parity). Pure helpers in types that need a date take a formatter argument.
- **Shipping an item:** delete every `PENDING(<id>)` / `pending="<id>"` reference, set `shipped: true` on the entry (never delete it — `not-built-page.test.tsx` and `not-built.spec.ts` use `impact-map` as their fixture), run `node scripts/pending.mjs`, delete any `explained` rule in `scripts/parity/app-screen-map.json` / `screen-map.json` whose `pending` is the id (`organisations-list-meta` on `org_list`, `admin-counts` ×2 on `admin`, `wizard-mascot-done` on `wizard`), and run the drift test. `pending-icons.ts` entries stay (they are keyed lookups, not references). The commit that flips `shipped` contains that item only. Never delete another item's marker early: `contributor-role-line`, `money-panel-detail`, `build-thread-cost-panel`, `print-fit-feedback`, `toy-holder-picks`, `printer-stats` sit in files below — leave them.
- **Mobile is a second consumer of every column.** On each column change run `grep -rn "<column>" packages/mobile`.
- **Web e2e specs import only from `tests/e2e/helpers.ts` / `lib/`,** never a component. Never run web and mobile e2e at the same time.
- **Batches 1–5 may still be landing.** Before editing any file, re-read it; anchor every edit on the code quoted in the step, never on a line number. Files this batch shares with earlier batches: `packages/types/src/index.ts`, `packages/types/src/pending.ts`, `docs/PENDING.md`, `packages/api/src/routes/public.ts`, `packages/api/src/routes/toy-ideas.ts`, `packages/mobile/components/challenges/my-screen.tsx`, `packages/mobile/components/organisation/org-profile-screen.tsx`, `packages/mobile/components/exchanges/thread-screen.tsx`, `packages/mobile/components/printing/job-screen.tsx`, `packages/mobile/components/builds/build-thread-screen.tsx`, `packages/web/components/notifications-list.tsx`, `packages/mobile/components/inbox/inbox-screen.tsx`, `scripts/check-schema-guards.sh`, `scripts/parity/app-screen-map.json`.
- **Stage only this task's files.** The tree holds unrelated changes (`CLAUDE.md`, `packages/web/zz3_57656.mjs`, `selfIdentity.plist`, parity reports): list files by name in every `git add`, run `git status --short` first, and `git restore --staged` anything that is not the task's.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV
  ```

## Review Focus

1. **A thanks note read by the wrong person, or a hidden note un-hidden.** A third party selecting `profile_thanks` directly, a thanker clearing `hidden_at` or flipping it through PostgREST, anon reading anything but the count, a member thanking themselves, a `transaction_id` the two were never party to. Expected: empty / error / count only / 403 / 400. Pinned by Task 10's integration test.
2. **The deliveries map exposing a family.** A suburb with two deliveries, a print job counted as a delivery, a row with a street address, a postcode with no centroid, a misspelt suburb ("  newcastle ") splitting one place into two under-three groups. Expected: absent / not counted / never in the JSON / dropped / merged. Pinned by Task 19's integration test (JSON never contains `pickup_line1` text or a group under three).
3. **A private reason in the wrong inbox.** An idea's `review_note` reaching a participant, a print `decline_reason` reaching anyone but the requester, a message body reaching someone outside the exchange, a body over 300 characters failing the insert and silently dropping the notification. Expected: body only on the one recipient's row; a long reason truncated, never rejected. Pinned by Task 12's integration and pure tests.
4. **A count that 500s or leaks.** A non-admin calling `/api/admin/counts`; `/api/me/counts` for an account with no orgs and no printers; one failing count query taking the whole Me tab down. Expected: 403; all zeros; the tab still renders its rows uncounted. Pinned by Tasks 14 and 15.
5. **A saved Learn outline that breaks the course.** A saved value naming a lesson slug that no longer exists, a unit dropped from the saved order, a lesson moved between units, a minutes of 0, a kind of "video". Expected: unknown slugs ignored, missing units appended in default order, lessons stay in their own unit, the API refuses the bad value with a sentence. Pinned by Task 18's pure and integration tests.

## Files

New:
- `supabase/migrations/116_organisation_list_counts.sql` … `121_impact_map.sql`.
- `packages/types/src/learn-course.ts` (the course default, moved from web, plus `mergeLearnCourse`, `readLearnCourse`).
- `packages/types/src/child-matches.ts` (`matchesForChild`, `childNeedsLine`).
- `packages/api/src/challenge-counts.ts` (moved out of `public.ts`).
- `packages/api/tests/integration/public/{contributor-details,org-list-counts,org-rows,impact-map,learn-course}.test.ts`, `packages/api/tests/integration/saves/saved-meta.test.ts`, `packages/api/tests/integration/toy-ideas/my-meta.test.ts`, `packages/api/tests/integration/contributors/profile-thanks.test.ts`, `packages/api/tests/integration/admin/{report-kinds,counts}.test.ts`, `packages/api/tests/integration/notifications/body.test.ts`, `packages/api/tests/integration/me/counts.test.ts`, `packages/api/tests/integration/child-profiles/play-measurements.test.ts`.
- `packages/web/components/{learn-course-editor,learn-course-context,deliveries-map,deliveries-map-loader}.tsx`, `packages/web/app/learn/layout.tsx`.
- `packages/web/tests/unit/lib/{guide-meta,notification-second-line,learn-course-merge,child-matches}.test.ts`, `packages/web/tests/unit/components/{thanks-button,learn-course-editor}.test.tsx`, `packages/web/tests/unit/pages/impact-map.test.tsx`.
- `packages/mobile/components/people/thank-button.tsx`, `packages/mobile/components/profile/child-done.tsx`, `packages/mobile/assets/mascot-think.png`, `packages/mobile/assets/mascot-party.png`.
- `packages/mobile/tests/unit/components/people/thank-button.test.tsx`, `packages/mobile/tests/unit/components/reports/report-problem.test.tsx`, `packages/mobile/tests/unit/lib/social-auth.test.ts`.

## Commands used throughout

- Apply new migrations locally (needs `supabase start`): `supabase migration up`
- API integration: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts <file>`
- API unit: `pnpm --filter @splat-connect/api exec vitest run <file>`
- Drift test: `pnpm --filter @splat-connect/api exec vitest run tests/unit/pending-features.test.ts tests/unit/pending-registry.test.ts` → `Tests  11 passed (11)`
- Regenerate the registry doc: `node scripts/pending.mjs` → `wrote docs/PENDING.md (N items)`
- Web unit: `pnpm --filter @splat-connect/web exec vitest run <file>`
- Mobile unit: `pnpm --filter @splat-connect/mobile exec jest <file>`
- Typecheck: `pnpm typecheck`

Every task's last code step is "Ship the item": the registry routine in Global Constraints, then the drift test.

---

## Slice 1

### Task 1: Remove Ask an expert from mobile Learn (`learn-ask-an-expert-mobile`)

Decided 2026-09-30: remove the row on mobile; web keeps its page.

**Files:**
- Modify: `packages/mobile/components/explore/learn-hub.tsx`
- Modify: `packages/mobile/tests/unit/components/explore/learn-hub.test.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks use.

- [ ] **Step 1: Write the failing test**

In `learn-hub.test.tsx`, replace the test `'opens the web Ask an expert page'` with:

```tsx
  // Decided 2026-09-30 (learn-ask-an-expert-mobile): the app reaches guides,
  // Learn, Submit an idea and organisations directly; the row only sent people
  // to a web page.
  it('has no Ask an expert row', () => {
    mockUseLearnProgress.mockReturnValue({
      read: new Set(),
      markRead: jest.fn(),
      next: LEARN_ARTICLES[0],
      count: 0,
    })
    render(<LearnHub />)
    expect(screen.queryByText('Ask an expert')).toBeNull()
  })
```

If `Linking` is no longer used anywhere else in the test file, delete `import { Linking } from 'react-native'`.

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/explore/learn-hub.test.tsx`
Expected: FAIL — `expect(received).toBeNull()` received the "Ask an expert" text element.

- [ ] **Step 3: Remove the row**

In `packages/mobile/components/explore/learn-hub.tsx`:
- Delete the whole block from `{/* PENDING(learn-ask-an-expert-mobile): … */}` through the closing `</AnimatedPressable>` of the Ask an expert row (the `deeper.map(...)` above it stays).
- Delete the now-unused helper:

```tsx
function openWebPage(path: string) {
  Linking.openURL(`${process.env.EXPO_PUBLIC_WEB_URL}${path}`)
}
```

- Change the import `import { View, Text, Linking, ScrollView, StyleSheet } from 'react-native'` to `import { View, Text, ScrollView, StyleSheet } from 'react-native'`.
- Replace the comment `// No "SOON" rows: every article and Ask an expert are built. A row for an` / `// unbuilt page would be the one place to add it.` with:

```tsx
// No "SOON" rows: every article is built. Ask an expert stays on the web only
// (decided 2026-09-30).
```

Run: `grep -n "Linking\|AnimatedPressable\|chatbubbles" packages/mobile/components/explore/learn-hub.tsx` — if `AnimatedPressable` has no remaining use, delete its import too.

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/explore/learn-hub.test.tsx`
Expected: PASS. Then `pnpm --filter @splat-connect/mobile exec tsc --noEmit` → exit 0.

- [ ] **Step 5: Ship the item**

Set `shipped: true` on `'learn-ask-an-expert-mobile'` in `packages/types/src/pending.ts`. Run `node scripts/pending.mjs` and the drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git status --short
git add packages/mobile/components/explore/learn-hub.tsx packages/mobile/tests/unit/components/explore/learn-hub.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(learn): Ask an expert leaves mobile Learn; web keeps its page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 2: Drop the switch and sound questions (`child-switch-sound`)

Decided 2026-09-30: drop both. Sound is `everyday_needs` 'quiet'; the switch follows from the four 079 questions. The only reference is a marker; nothing renders the questions.

**Files:**
- Modify: `packages/mobile/components/profile/child-editor-home.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:** none.

- [ ] **Step 1: Confirm the only reference**

Run: `git grep -n "child-switch-sound\|Switch they already use\|Sound tolerance" -- packages scripts`
Expected: one line, `packages/mobile/components/profile/child-editor-home.tsx: {/* PENDING(child-switch-sound): … */}` (the board and docs are outside this grep).

- [ ] **Step 2: Delete the marker**

In `child-editor-home.tsx`, delete the line:

```tsx
      {/* PENDING(child-switch-sound): "Switch they already use" and "Sound tolerance" questions — no column for the switch. */}
```

- [ ] **Step 3: Ship the item**

Set `shipped: true` on `'child-switch-sound'`. Run `node scripts/pending.mjs`, the drift test → `Tests  11 passed (11)`, and `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/profile/child-editor-home.test.tsx` → PASS (unchanged).

- [ ] **Step 4: Commit**

```bash
git status --short
git add packages/mobile/components/profile/child-editor-home.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "chore(child-profile): drop the switch and sound questions, as decided

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 3: "This community so far" on Explore (`explore-community-stats`)

**Files:**
- Modify: `packages/mobile/components/explore/explore-screen.tsx`
- Modify: `packages/mobile/tests/unit/components/explore/explore-screen.test.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: `GET /api/public/impact` → `ImpactSummary` (`totals.tutorials`, `totals.toysDelivered`, `totals.contributors`, `totals.organisations`), already served.
- Produces: nothing other tasks use.

Copy (MB:375, MB:2462): "This community so far" · "Guides" · "Toys delivered" · "Contributors" · "Organisations". The block sits after the doors, as on MB (374–378). The numbers are shown as the endpoint serves them (see "follows the code" 19).

- [ ] **Step 1: Write the failing tests**

In `explore-screen.test.tsx`:
- In the `beforeEach` mock, add before `return Promise.resolve([])`:

```tsx
    if (path === '/api/public/impact')
      return Promise.resolve({
        totals: { tutorials: 142, toysShared: 20, toysDelivered: 318, contributors: 57, organisations: 14 },
        recent: [],
        contributors: [],
        organisations: [],
        deliveriesByMonth: [],
      })
```

- Change every `toHaveBeenCalledTimes(3)` to `toHaveBeenCalledTimes(4)` (four places), and in 'fetches every source once on mount' add `expect(mockGet).toHaveBeenCalledWith('/api/public/impact')`.
- Append inside `describe('ExploreScreen')`:

```tsx
  it("shows the community's four totals", async () => {
    render(<ExploreScreen />)
    expect(await screen.findByText('This community so far')).toBeTruthy()
    for (const [value, label] of [
      ['142', 'Guides'],
      ['318', 'Toys delivered'],
      ['57', 'Contributors'],
    ]) {
      expect(screen.getByText(value)).toBeTruthy()
      expect(screen.getByText(label)).toBeTruthy()
    }
    // "Organisations" is also a door title above, so it appears twice.
    expect(screen.getByText('14')).toBeTruthy()
    expect(screen.getAllByText('Organisations')).toHaveLength(2)
  })

  it('leaves the totals out, and says nothing, when the impact read fails', async () => {
    mockGet.mockImplementation((path: string) =>
      path === '/api/public/impact' ? Promise.reject(new Error('500')) : Promise.resolve([])
    )
    render(<ExploreScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4))
    expect(screen.queryByText('This community so far')).toBeNull()
    // The search sources succeeded, so the error row stays away too.
    expect(screen.queryByText(/Couldn.t load everything/)).toBeNull()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/explore/explore-screen.test.tsx`
Expected: FAIL — called 3 times, expected 4; 'This community so far' not found.

- [ ] **Step 3: Implement**

In `explore-screen.tsx`:
- Change the type import to `import type { Tutorial, ToyWithOwner, Organization, ImpactSummary } from '@splat-connect/types'`.
- Delete the comment `// PENDING(explore-community-stats): … already returns them.` (three lines above `export function ExploreScreen`).
- Inside `ExploreScreen`, after `const [reloadKey, setReloadKey] = useState(0)`, add:

```tsx
  // The board's "This community so far". Its own fetch, apart from the three
  // search sources: a failed count hides the block and nothing else — it is
  // not something to retry for, so it never raises the error row.
  const [totals, setTotals] = useState<ImpactSummary['totals'] | null>(null)
  useEffect(() => {
    let ignore = false
    apiClient
      .get<ImpactSummary>('/api/public/impact')
      .then((s) => {
        if (!ignore) setTotals(s.totals)
      })
      .catch((err) => console.error('[ExploreScreen] impact fetch failed:', err))
    return () => {
      ignore = true
    }
  }, [reloadKey])
```

- After the last `<DoorCard … title="About SPLAT" … />`, before `</ScrollView>`, add:

```tsx
        {totals ? (
          <View style={styles.stats}>
            <Text style={styles.eyebrow}>This community so far</Text>
            <View style={styles.statGrid}>
              {[
                { k: 'Guides', v: totals.tutorials },
                { k: 'Toys delivered', v: totals.toysDelivered },
                { k: 'Contributors', v: totals.contributors },
                { k: 'Organisations', v: totals.organisations },
              ].map((s) => (
                <View key={s.k} style={styles.stat}>
                  <Text style={styles.statValue}>{String(s.v)}</Text>
                  <Text style={styles.statLabel}>{s.k}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
```

- Add to `StyleSheet.create`:

```tsx
  stats: {
    marginTop: theme.spacing(5),
    padding: theme.spacing(5),
    borderRadius: theme.radii.card,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.accentFaint,
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, marginTop: theme.spacing(3) },
  stat: { width: '50%' },
  statValue: { fontFamily: theme.fonts.display, fontSize: 26, lineHeight: 30, color: theme.colors.primaryDeep, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.muted, marginTop: 3 },
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/explore/explore-screen.test.tsx` → PASS. `pnpm --filter @splat-connect/mobile exec tsc --noEmit` → exit 0.

- [ ] **Step 5: Ship the item**

Set `shipped: true` on `'explore-community-stats'`. `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git status --short
git add packages/mobile/components/explore/explore-screen.tsx packages/mobile/tests/unit/components/explore/explore-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(explore): this community so far — guides, toys delivered, contributors, organisations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 4: Search the review queue (`web-admin-review-list`)

A plain GET form (`?q=`) over the list the page already fetched — no new API, no client island. WB draws no search on this screen; the two strings are flagged.

**Files:**
- Modify: `packages/web/app/admin/review/page.tsx`
- Modify: `packages/web/tests/unit/pages/admin-review.test.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:** none.

Copy: placeholder and label "Search by guide or contributor name" (no board — flagged); no-match line "No guide or contributor matches that search." (no board — flagged); "Show everything" (existing).

- [ ] **Step 1: Write the failing tests**

Append inside `describe('admin review queue')` in `admin-review.test.tsx`:

```tsx
  it('filters the queue by guide title, ignoring case', async () => {
    get.mockResolvedValue([handled, unhandled, askedOnly])
    const { default: Page } = await import('@/app/admin/review/page')
    render(await Page({ searchParams: Promise.resolve({ q: 'PLATFORM' }) }))
    expect(screen.getByText('Platform project')).toBeInTheDocument()
    expect(screen.queryByText('Backed project')).toBeNull()
    expect(screen.queryByText('Asked but unanswered')).toBeNull()
    expect(screen.getByRole('searchbox', { name: 'Search by guide or contributor name' })).toHaveValue('PLATFORM')
  })

  it('filters by contributor name', async () => {
    get.mockImplementation(async (path: string) =>
      path === '/api/admin/contributors'
        ? { accounts: [{ id: 'p1', name: 'Rachel Kaur', email: 'r@x' }], total: 1 }
        : path === '/api/admin/ideas'
          ? []
          : [
              { ...handled, tutorial_contributors: [{ profile_id: 'p1' }] },
              { ...unhandled, tutorial_contributors: [] },
            ]
    )
    const { default: Page } = await import('@/app/admin/review/page')
    render(await Page({ searchParams: Promise.resolve({ q: 'rachel' }) }))
    expect(screen.getByText('Backed project')).toBeInTheDocument()
    expect(screen.queryByText('Platform project')).toBeNull()
  })

  it('says so when nothing matches, and keeps the search box', async () => {
    get.mockResolvedValue([handled, unhandled])
    const { default: Page } = await import('@/app/admin/review/page')
    render(await Page({ searchParams: Promise.resolve({ q: 'zzz' }) }))
    expect(screen.getByText('No guide or contributor matches that search.')).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/pages/admin-review.test.tsx`
Expected: FAIL — `Backed project` is still in the document; no searchbox.

- [ ] **Step 3: Implement**

In `packages/web/app/admin/review/page.tsx`:
- Delete `// PENDING(web-admin-review-list): the board's search input above the list.`
- Change the `searchParams` type to `Promise<{ mine?: string; selected?: string; page?: string; q?: string }>` and the destructure to `const { mine, selected, page: pageParam, q: rawQ } = await searchParams`.
- Move the `namesOf` definition up to directly after `const pendingIdeas = …`:

```tsx
  const namesOf = (t: Queued) =>
    (t.tutorial_contributors ?? []).map((c) => nameOf.get(c.profile_id)).filter(Boolean) as string[]

  // Search runs over the queue this page already loaded — a title or any
  // credited contributor's name, case-insensitive. A GET form, so it needs no
  // client code and survives a refresh.
  const q = (rawQ ?? '').trim().toLowerCase()
  const searched = q
    ? all.filter((t) => t.title.toLowerCase().includes(q) || namesOf(t).some((n) => n.toLowerCase().includes(q)))
    : all
```

  and delete the old `const namesOf = …` lower down.
- Change `const unhandled = all.filter(…)` to `const unhandled = searched.filter((t) => acceptedFor(t).length === 0)` and `const tutorials = hidingHandled ? unhandled : all` to `const tutorials = hidingHandled ? unhandled : searched`. Leave `handledCount = all.length - …` computed from `all` (the hide link speaks about the whole queue): change it to `const handledCount = all.filter((t) => acceptedFor(t).length > 0).length`.
- After `if (page > 1) baseQuery.set('page', String(page))` add `if (q) baseQuery.set('q', rawQ!.trim())`.
- Add the form to `header`, below the `<ReviewTabs … />` wrapper's closing `</div>` — replace `const header = (` … `)` with:

```tsx
  const header = (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">Admin</span>
          <h1 className="mt-1 font-display text-4xl font-extrabold leading-[1.1] text-ink">Review queue</h1>
        </div>
        <ReviewTabs current="guides" guides={all.length} ideas={pendingIdeas} />
      </div>
      <form role="search" action="/admin/review" className="mb-4 max-w-[420px]">
        {hidingHandled && <input type="hidden" name="mine" value="1" />}
        <input
          type="search"
          name="q"
          defaultValue={rawQ ?? ''}
          aria-label="Search by guide or contributor name"
          placeholder="Search by guide or contributor name"
          className="field h-[46px] bg-surface"
        />
      </form>
    </>
  )
```

- In the empty branch (`if (tutorials.length === 0)`), make the first `<p>` read:

```tsx
          <p className="mt-4 font-bold text-ink">
            {q
              ? 'No guide or contributor matches that search.'
              : hidingHandled && handledCount > 0
                ? 'Nothing left for you.'
                : 'No tutorials pending review.'}
          </p>
```

  and guard the second `<p>` with `{!q && ( … )}`, adding after it `{q && <Link href="/admin/review">Show everything</Link>}`.
- Pass `q` through the pager: `<Pager page={page} pages={pages} params={{ mine: hidingHandled ? '1' : undefined, q: q ? rawQ!.trim() : undefined }} />`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/pages/admin-review.test.tsx` → PASS (old and new). `pnpm --filter @splat-connect/web exec tsc --noEmit` → exit 0.

- [ ] **Step 5: Ship the item**

Set `shipped: true` on `'web-admin-review-list'`. `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git status --short
git add packages/web/app/admin/review/page.tsx packages/web/tests/unit/pages/admin-review.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(admin): search the review queue by guide or contributor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---
## Slice 2

### Task 5: A contributor's showcase details (`contributor-profile-details`)

The public contributor read already returns `bio`, `created_at`, `toysDelivered`, `thanks` and `badges`. It does not return `view_count` (092 exposes it only on `/api/tutorials/mine`), so "{n} views" on a public page makes view counts public — the spec asks for it ("follows the code" 15). The "{role}" half of "{role} · Joined" and the backing-org chip are the open `contributor-role-line` item: its marker stays.

**Files:**
- Modify: `packages/types/src/index.ts` (add `DIFFICULTY_LABEL`, `guideMeta`; `Tutorial.view_count` doc)
- Modify: `packages/api/src/routes/public.ts` (`GET /contributors/:id` select)
- Modify: `packages/mobile/components/guides/showcase-screen.tsx`
- Test: `packages/web/tests/unit/lib/guide-meta.test.ts` (new), `packages/api/tests/integration/public/contributor-details.test.ts` (new), `packages/mobile/tests/unit/components/guides/showcase-screen.test.tsx` (updated)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: `formatBuildTime(minutes: number): string` (types), `formatViews(n: number): string` (`packages/mobile/components/my-tutorials/list-screen.tsx`), `plural(n, word)` (types).
- Produces: `DIFFICULTY_LABEL: Record<Difficulty, string>`; `guideMeta(t: { difficulty: Difficulty; build_minutes: number | null }, ...tail: (string | null | undefined)[]): string` — "Easy · 20 min · {tail…}", absent parts dropped. Tasks 6 and 9 use it. Each guide in `ContributorProfile.tutorials` now carries `view_count: number`.

Copy (MB:1149–1154, 1684, 2760–2765): "Joined {Month YYYY}" · "{n} guides" · "{n} toys delivered" · "Thanked {n} times" · "Published guides" · row meta "Easy · 20 min · 2.1k views".

- [ ] **Step 1: Write the failing tests**

`packages/web/tests/unit/lib/guide-meta.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { guideMeta } from '@splat-connect/types'

describe('guideMeta', () => {
  it('reads difficulty, time, then whatever the row adds, in the board order', () => {
    expect(guideMeta({ difficulty: 'easy', build_minutes: 20 }, '2.1k views')).toBe('Easy · 20 min · 2.1k views')
  })
  it('drops a missing time and an empty tail rather than printing a gap', () => {
    expect(guideMeta({ difficulty: 'hard', build_minutes: null }, null, undefined, 'Rachel Kaur')).toBe('Hard · Rachel Kaur')
  })
  it('uses the shared build-time format past the hour', () => {
    expect(guideMeta({ difficulty: 'medium', build_minutes: 90 })).toBe('Medium · 1.5 h')
  })
})
```

`packages/api/tests/integration/public/contributor-details.test.ts`:

```ts
/**
 * contributor-profile-details: the showcase's guide rows carry their view
 * count (092's definer function, made readable on the public read here).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let maker: TestUser
let tutorialId: string

beforeAll(async () => {
  const admin = adminClient()
  maker = await createTestUser()
  const { data } = await admin
    .from('tutorials')
    .insert({ title: 'Light-up drum', difficulty: 'easy', status: 'approved', build_minutes: 20 })
    .select('id')
    .single()
  tutorialId = data!.id
  await admin.from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: maker.id, role: 'primary' })
  await admin.from('tutorial_view_counts').insert({ tutorial_id: tutorialId, views: 2100 })
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(maker.id)
})

describe('GET /api/public/contributors/:id — guide rows', () => {
  it('returns each guide with its view count and build time', async () => {
    const res = await app.request(`/api/public/contributors/${maker.id}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { tutorials: Array<{ id: string; view_count: number; build_minutes: number }>; created_at: string }
    expect(body.tutorials.find((t) => t.id === tutorialId)).toMatchObject({ view_count: 2100, build_minutes: 20 })
    expect(body.created_at).toBeTruthy()
  })
})
```

In `packages/mobile/tests/unit/components/guides/showcase-screen.test.tsx`:
- Change `PERSON` to:

```tsx
const PERSON = {
  id: 'c1',
  name: 'Sam Taylor',
  tutorials: [tutorial({ id: 't1', title: 'Build a Robot Arm', build_minutes: 20, view_count: 2100 })],
  toysShared: [],
  toysDelivered: [toy({ id: 'd1' }), toy({ id: 'd2' })],
  bio: 'I run a switch clinic on Thursdays.',
  thanks: 41,
  created_at: '2025-03-10T00:00:00Z',
}
```

- In 'renders a contributor profile with their guides and no toys section', replace `expect(screen.getByText('1 guides · 0 toys shared')).toBeTruthy()` with:

```tsx
    expect(screen.getByText('Joined March 2025')).toBeTruthy()
    expect(screen.getByText('1 guide')).toBeTruthy()
    expect(screen.getByText('2 toys delivered')).toBeTruthy()
    expect(screen.getByText('Thanked 41 times')).toBeTruthy()
    expect(screen.getByText('I run a switch clinic on Thursdays.')).toBeTruthy()
    expect(screen.getByText('Easy · 20 min · 2.1k views')).toBeTruthy()
```

- Append:

```tsx
  it('says nothing about a bio or a join date the profile does not have', async () => {
    mockGet.mockResolvedValue({ ...PERSON, bio: null, created_at: undefined, thanks: 1 })
    render(<ShowcaseScreen kind="person" id="c1" />)
    expect(await screen.findByText('Thanked 1 time')).toBeTruthy()
    expect(screen.queryByText(/^Joined/)).toBeNull()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/guide-meta.test.ts` → FAIL (`guideMeta` is not exported).
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/public/contributor-details.test.ts` → FAIL (`view_count` undefined).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/guides/showcase-screen.test.tsx` → FAIL ('Joined March 2025' not found).

- [ ] **Step 3: The shared meta line**

In `packages/types/src/index.ts`, directly after `formatBuildTime`:

```ts
/** The board's difficulty words. */
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

/**
 * A guide row's meta line, the board's order: "Easy · 20 min · 2.1k views",
 * "Easy · 20 min · Rachel Kaur". Whatever the row adds goes on the end; a
 * missing time or tail drops out rather than leaving a gap.
 */
export function guideMeta(
  t: { difficulty: Difficulty; build_minutes: number | null },
  ...tail: (string | null | undefined)[]
): string {
  return [DIFFICULTY_LABEL[t.difficulty], t.build_minutes != null ? formatBuildTime(t.build_minutes) : null, ...tail]
    .filter(Boolean)
    .join(' · ')
}
```

In `interface Tutorial`, change the `view_count` comment to `/** 092. On /api/tutorials/mine and the public contributor read. */`.

- [ ] **Step 4: The API**

In `packages/api/src/routes/public.ts`, `GET /contributors/:id`, change the tutorials select:

```ts
      .select('tutorials!inner(*, thanks_count, builds_count, view_count)')
```

(092's `view_count` has no revoke, so the anon client may call it.)

- [ ] **Step 5: The mobile showcase**

In `showcase-screen.tsx`:
- Imports: `import { KIND_LABEL, guideMeta, plural } from '@splat-connect/types'` and `import { formatViews } from '../my-tutorials/list-screen'`.
- `GuideCard` takes an optional meta line, shown in place of the badges:

```tsx
function GuideCard({ tutorial, meta, onPress }: { tutorial: Tutorial; meta?: string; onPress: () => void }) {
```

  and replace the badge `<View accessibilityElementsHidden … style={styles.badgeRow}>…</View>` with:

```tsx
          {meta ? (
            <Text style={styles.cardMeta}>{meta}</Text>
          ) : (
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.badgeRow}>
              <Badge status={tutorial.difficulty} />
              <Badge status={tutorial.kind} label={KIND_LABEL[tutorial.kind]} />
            </View>
          )}
```

- In `ShowcaseScreen`, after `const firstName = …`:

```tsx
  const person = kind === 'person' ? (profile as ContributorProfile) : null
  const thanked = person?.thanks ?? 0
```

- Replace the header's meta `<Text style={styles.meta}>{guides.length} guides · {profile.toysShared.length} toys shared</Text>` and the `PENDING(contributor-profile-details)` comment with:

```tsx
          {person ? (
            person.created_at ? (
              <Text style={styles.meta}>{`Joined ${new Date(person.created_at).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}`}</Text>
            ) : null
          ) : (
            <Text style={styles.meta}>
              {guides.length} guides · {profile.toysShared.length} toys shared
            </Text>
          )}
```

  (the `PENDING(contributor-role-line)` comment above it stays).
- After the header `</Card>`, before the actions block:

```tsx
      {person ? (
        <View style={styles.section}>
          <View style={styles.chips}>
            <Text style={styles.chip}>{plural(guides.length, 'guide')}</Text>
            <Text style={styles.chip}>{`${person.toysDelivered.length} toys delivered`}</Text>
            <Text style={styles.chip}>{`Thanked ${thanked} ${thanked === 1 ? 'time' : 'times'}`}</Text>
          </View>
          {person.bio ? <Text style={styles.bio}>{person.bio}</Text> : null}
        </View>
      ) : null}
```

- In the guides map, pass the meta for a person:

```tsx
            <GuideCard
              key={t.id}
              tutorial={t}
              meta={person ? guideMeta(t, t.view_count != null ? `${formatViews(t.view_count)} views` : null) : undefined}
              onPress={() => router.push({ pathname: '/guides/[id]', params: { id: t.id } })}
            />
```

- Styles:

```tsx
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  chip: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.caption,
    color: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  bio: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, lineHeight: 21, color: theme.colors.text, marginTop: theme.spacing(3) },
  cardMeta: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted, marginTop: 2 },
```

Run: `grep -rn "view_count" packages/mobile` → only the showcase and `my-tutorials/list-screen.tsx`.

- [ ] **Step 6: Run the tests to see them pass**

Run the three commands from Step 2 → PASS. `pnpm typecheck` → exit 0.

- [ ] **Step 7: Ship the item**

The `PENDING(contributor-profile-details)` comment went in Step 5. Set `shipped: true` on `'contributor-profile-details'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 8: Commit**

```bash
git status --short
git add packages/types/src/index.ts packages/api/src/routes/public.ts packages/mobile/components/guides/showcase-screen.tsx packages/web/tests/unit/lib/guide-meta.test.ts packages/api/tests/integration/public/contributor-details.test.ts packages/mobile/tests/unit/components/guides/showcase-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(people): a contributor's join date, totals, bio and guide meta on their showcase

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 6: Difficulty, time, author and a thumbnail on saved rows (`saved-list-meta`)

`GET /api/saves/tutorials` already returns `build_minutes`, `difficulty` and `toy_photo_url` (`select: '*, …'`); only the author's name is missing. Saved toys already carry `condition`, `cover_photo_url` and the holder (`profiles(name), organizations(name)`).

**Files:**
- Modify: `packages/api/src/profile-name.ts` (add `primaryAuthorNames`)
- Modify: `packages/api/src/routes/saves.ts` (`GET /:slug`)
- Modify: `packages/types/src/index.ts` (`Tutorial.author_name`)
- Modify: `packages/mobile/components/saved/saved-list-screen.tsx`
- Test: `packages/api/tests/integration/saves/saved-meta.test.ts` (new), `packages/mobile/tests/unit/components/saved/saved-list-screen.test.tsx` (updated)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: `guideMeta` (Task 5); `gradeOf(condition: number): Grade` from batch 3 (`@splat-connect/types`).
- Produces: `primaryAuthorNames(tutorialIds: string[]): Promise<Map<string, string> | null>` in `packages/api/src/profile-name.ts` — tutorial id → its primary contributor's name, via the admin client; `null` on a read error. Task 9 uses it. Saved guides carry `author_name: string | null`. `Tutorial.author_name?: string | null`.

Copy (MB:1828–1834): lead "Guides you kept to build later." (already there) · guide row "{difficulty} · {time} · {author}". The board draws no saved-toy rows; the spec's "grade and holder" reads "{grade} · {holder}".

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/saves/saved-meta.test.ts`:

```ts
/** saved-list-meta: a saved guide names its primary contributor, read by id. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let helper: TestUser
let saver: TestUser
let tutorialId: string

beforeAll(async () => {
  const admin = adminClient()
  ;[author, helper, saver] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
  await admin.from('profiles').update({ name: 'Rachel Kaur' }).eq('id', author.id)
  await admin.from('profiles').update({ name: 'Tom Beattie' }).eq('id', helper.id)
  const { data } = await admin
    .from('tutorials')
    .insert({ title: 'Light-up drum', difficulty: 'easy', status: 'approved', build_minutes: 20 })
    .select('id')
    .single()
  tutorialId = data!.id
  await admin.from('tutorial_contributors').insert([
    { tutorial_id: tutorialId, profile_id: author.id, role: 'primary' },
    { tutorial_id: tutorialId, profile_id: helper.id, role: 'collaborator' },
  ])
  await admin.from('saves').insert({ profile_id: saver.id, entity_type: 'tutorial', entity_id: tutorialId })
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([author, helper, saver].map((u) => deleteTestUser(u.id)))
})

describe('GET /api/saves/tutorials', () => {
  it('names the primary contributor, never a collaborator, beside the build time', async () => {
    const res = await app.request('/api/saves/tutorials', { headers: { Authorization: `Bearer ${saver.token}` } })
    expect(res.status).toBe(200)
    const [row] = (await res.json()) as Array<{ id: string; author_name: string | null; build_minutes: number; difficulty: string }>
    expect(row).toMatchObject({ id: tutorialId, author_name: 'Rachel Kaur', build_minutes: 20, difficulty: 'easy' })
  })
})
```

In `saved-list-screen.test.tsx`, append inside `describe('SavedListScreen')`:

```tsx
  it("shows a saved guide's difficulty, time and author", async () => {
    mockGet.mockResolvedValue([
      { id: 't1', title: 'Light-up drum', difficulty: 'easy', build_minutes: 20, author_name: 'Rachel Kaur', toy_photo_url: null },
    ])
    render(<SavedListScreen slug="tutorials" />)
    expect(await screen.findByText('Easy · 20 min · Rachel Kaur')).toBeTruthy()
  })

  it("shows a saved toy's grade and holder", async () => {
    mockGet.mockResolvedValue([
      { id: 'y1', name: 'Bubble machine', condition: 9, cover_photo_url: null, organizations: { name: 'Northside Therapy' }, profiles: null },
    ])
    render(<SavedListScreen slug="toys" />)
    expect(await screen.findByText('Like new · Northside Therapy')).toBeTruthy()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/saves/saved-meta.test.ts` → FAIL (`author_name` undefined).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/saved/saved-list-screen.test.tsx` → FAIL.

- [ ] **Step 3: The name lookup**

Append to `packages/api/src/profile-name.ts`:

```ts
import { chunk } from './chunk.js'
import { createAdminClient as adminClientFor } from './supabase/client.js'

/**
 * Each guide's primary contributor's name, by id through the admin client —
 * never a profiles(...) embed, which fails silently under the 033/045 grants.
 * Null when a read fails, so the caller can 500 rather than show a list with
 * every author missing.
 */
export async function primaryAuthorNames(tutorialIds: string[]): Promise<Map<string, string> | null> {
  const out = new Map<string, string>()
  if (tutorialIds.length === 0) return out
  const admin = adminClientFor()
  const links = await Promise.all(
    chunk(tutorialIds).map((ids) =>
      admin.from('tutorial_contributors').select('tutorial_id, profile_id').eq('role', 'primary').in('tutorial_id', ids)
    )
  )
  if (links.some((r) => r.error)) return null
  const rows = links.flatMap((r) => r.data ?? [])
  const people = await Promise.all(
    chunk([...new Set(rows.map((r) => r.profile_id as string))]).map((ids) =>
      admin.from('profiles').select('id, name').in('id', ids)
    )
  )
  if (people.some((r) => r.error)) return null
  const name = new Map(people.flatMap((r) => r.data ?? []).map((p) => [p.id as string, p.name as string]))
  for (const r of rows) {
    const n = name.get(r.profile_id as string)
    if (n) out.set(r.tutorial_id as string, n)
  }
  return out
}
```

(The file's existing `import type { createAdminClient }` stays; the new value import is aliased so the two do not clash.)

- [ ] **Step 4: The route**

In `packages/api/src/routes/saves.ts`, add `import { primaryAuthorNames } from '../profile-name.js'` and replace the last line of `GET /:slug`, `return c.json(ids.map((id) => byId.get(id)).filter(Boolean))`, with:

```ts
  const entities = ids.map((id) => byId.get(id)).filter(Boolean) as Array<{ id: string }>
  // saved-list-meta: a guide row names its author. Resolved by id, not
  // embedded — see primaryAuthorNames.
  if (slug === 'tutorials') {
    const names = await primaryAuthorNames(entities.map((e) => e.id))
    if (!names) return c.json({ error: 'Failed to load saved guides' }, 500)
    return c.json(entities.map((e) => ({ ...e, author_name: names.get(e.id) ?? null })))
  }
  return c.json(entities)
```

In `packages/types/src/index.ts`, `interface Tutorial`, after `view_count?`:

```ts
  /** Present on saved guides and an organisation's guide rows: the primary
   *  contributor's name, resolved by id on the server. */
  author_name?: string | null
```

- [ ] **Step 5: The rows**

In `saved-list-screen.tsx`:
- Imports: `import { gradeOf, guideMeta, type Difficulty, type SaveSlug } from '@splat-connect/types'` (replacing the `SaveSlug` type import).
- Replace `type SavedEntity` with:

```tsx
/** The wire shape is per-slug; these are the fields the rows read. */
type SavedEntity = {
  id: string
  title?: string
  name?: string
  summary?: string | null
  description?: string | null
  condition?: number
  difficulty?: Difficulty
  build_minutes?: number | null
  author_name?: string | null
  toy_photo_url?: string | null
  cover_photo_url?: string | null
  profiles?: { name: string } | null
  organizations?: { name: string } | null
}

/** The row's second line and picture, per kind of thing saved. */
function rowFacts(slug: SaveSlug, item: SavedEntity): { meta: string | null; photo: string | null } {
  if (slug === 'tutorials' && item.difficulty) {
    return { meta: guideMeta({ difficulty: item.difficulty, build_minutes: item.build_minutes ?? null }, item.author_name), photo: item.toy_photo_url ?? null }
  }
  if (slug === 'toys' && item.condition != null) {
    const holder = item.organizations?.name ?? item.profiles?.name ?? null
    return { meta: [gradeOf(item.condition).label, holder].filter(Boolean).join(' · '), photo: item.cover_photo_url ?? null }
  }
  return { meta: item.summary ?? item.description ?? null, photo: null }
}
```

- In the map, replace the `PENDING(saved-list-meta)` comment and `const line = …` with `const { meta, photo } = rowFacts(slug, item)`, and on `<ListRow>` use `thumb={<RowThumb photo={photo} glyph={kind.icon} />}` and `meta={meta}`.

Run: `grep -rn "author_name" packages/mobile packages/web` → the saved list only (web's saved page reads `tutorial_orgs`, unchanged).

- [ ] **Step 6: Run the tests to see them pass**

Run the two commands from Step 2 → PASS. Also `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/saves/saves.test.ts` → PASS (unchanged shape for the other slugs). `pnpm typecheck` → exit 0.

- [ ] **Step 7: Ship the item**

Set `shipped: true` on `'saved-list-meta'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 8: Commit**

```bash
git status --short
git add packages/api/src/profile-name.ts packages/api/src/routes/saves.ts packages/types/src/index.ts packages/mobile/components/saved/saved-list-screen.tsx packages/api/tests/integration/saves/saved-meta.test.ts packages/mobile/tests/unit/components/saved/saved-list-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(saves): difficulty, time, author and a photo on saved guides; grade and holder on saved toys

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 7: Dates and counts on My challenges (`my-challenges-meta`)

`challengeCounts` (public.ts) is module-private and computes `maker_count` and `answer_count` — "posts" on the board is `answer_count` ("follows the code" 14). It moves to its own module so `/api/ideas/mine` and `/joined` share it with the public list. `/joined` also gains the participant's `joined_at`. Batch 4 Task 9 has already rewritten `IdeaRow` so every own idea opens; this task changes only its meta line.

**Files:**
- Create: `packages/api/src/challenge-counts.ts`
- Modify: `packages/api/src/routes/public.ts` (delete `challengeCounts`, import it)
- Modify: `packages/api/src/routes/toy-ideas.ts` (`GET /mine`, `GET /joined`)
- Modify: `packages/types/src/index.ts` (`MyIdea`)
- Modify: `packages/mobile/components/challenges/my-screen.tsx`
- Test: `packages/api/tests/integration/toy-ideas/my-meta.test.ts` (new), `packages/mobile/tests/unit/components/challenges/my-screen.test.tsx` (updated)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: `ChallengeCounts { maker_count: number; answer_count: number }` (types), `plural` (types).
- Produces: `challengeCounts(ideas: { id: string; author_id: string }[]): Promise<Map<string, ChallengeCounts>>` exported from `packages/api/src/challenge-counts.ts`. `MyIdea = ToyIdea & Partial<ChallengeCounts> & { joined_at?: string }`. `ideaMeta(idea: MyIdea, joined: boolean): string` exported from `my-screen.tsx`.

Copy (MB:1814–1819): "Joined {date} · {n} makers · {n} posts" · "Joined {date} · being written up" · "Your idea · submitted {date} · {n} makers joined" · "Your idea · submitted {date} · with an admin" · "Your idea · declined {date} — a reason is attached" · lead "Challenges you have joined as a maker, and ideas you have submitted at every stage of review." (already there). An own idea that has graduated has no board row; it reads "Your idea · submitted {date} · being written up" (board fragments — flagged).

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/toy-ideas/my-meta.test.ts`:

```ts
/** my-challenges-meta: your ideas and joined challenges carry maker and post counts, and when you joined. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let maker: TestUser
let ideaId: string

beforeAll(async () => {
  const admin = adminClient()
  ;[author, maker] = await Promise.all([createTestUser(), createTestUser()])
  const { data } = await admin
    .from('toy_ideas')
    .insert({ author_id: author.id, title: 'Bubble machine', summary: 'One switch.', status: 'challenge' })
    .select('id')
    .single()
  ideaId = data!.id
  await admin.from('toy_idea_participants').insert({ idea_id: ideaId, profile_id: maker.id, joined_at: '2026-07-12T02:00:00Z' })
  await admin.from('toy_idea_messages').insert([
    { idea_id: ideaId, sender_id: maker.id, kind: 'user', body: 'A lever?' },
    { idea_id: ideaId, sender_id: author.id, kind: 'user', body: 'Yes.' },
  ])
})

afterAll(async () => {
  await adminClient().from('toy_ideas').delete().eq('id', ideaId)
  await Promise.all([author, maker].map((u) => deleteTestUser(u.id)))
})

const get = (path: string, token: string) => app.request(path, { headers: { Authorization: `Bearer ${token}` } })

describe('my challenges meta', () => {
  it("counts makers and the makers' posts on your own idea", async () => {
    const rows = (await (await get('/api/ideas/mine', author.token)).json()) as Array<{ id: string; maker_count: number; answer_count: number }>
    expect(rows.find((r) => r.id === ideaId)).toMatchObject({ maker_count: 1, answer_count: 1 })
  })

  it('says when you joined, with the same counts', async () => {
    const rows = (await (await get('/api/ideas/joined', maker.token)).json()) as Array<{ id: string; joined_at: string; maker_count: number }>
    const row = rows.find((r) => r.id === ideaId)!
    expect(new Date(row.joined_at).toISOString()).toBe('2026-07-12T02:00:00.000Z')
    expect(row.maker_count).toBe(1)
    // Still no review_note on a joined challenge (037).
    expect(row).not.toHaveProperty('review_note')
  })
})
```

In `my-screen.test.tsx`, append inside the describe:

```tsx
  it('reads each row the way the board does', async () => {
    respond(
      [
        idea({ id: 'm1', title: 'Bubbles', status: 'challenge', created_at: '2026-08-02T00:00:00Z', maker_count: 3, answer_count: 0 }),
        idea({ id: 'm2', title: 'Light box', status: 'pending', created_at: '2026-08-28T00:00:00Z' }),
        idea({ id: 'm3', title: 'Spoon', status: 'rejected', review_note: 'Too close to an existing guide.', updated_at: '2026-04-11T00:00:00Z' }),
      ],
      [
        idea({ id: 'j1', title: 'Tray mount', author_id: 'other', status: 'challenge', joined_at: '2026-07-12T00:00:00Z', maker_count: 5, answer_count: 9 }),
        idea({ id: 'j2', title: 'Quiet fan', author_id: 'other', status: 'graduated', joined_at: '2026-05-03T00:00:00Z' }),
      ]
    )
    render(<MyChallengesScreen />)
    expect(await screen.findByText('Your idea · submitted 2 Aug · 3 makers joined')).toBeTruthy()
    expect(screen.getByText('Your idea · submitted 28 Aug · with an admin')).toBeTruthy()
    expect(screen.getByText('Your idea · declined 11 Apr — a reason is attached')).toBeTruthy()
    expect(screen.getByText('Joined 12 Jul · 5 makers · 9 posts')).toBeTruthy()
    expect(screen.getByText('Joined 3 May · being written up')).toBeTruthy()
  })
```

Delete (or update to the new line) any existing assertion that a rejected row shows its `review_note` text — the board shows "a reason is attached" and the reason is read on the idea itself (batch 4's `GET /api/ideas/mine/:id`).

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toy-ideas/my-meta.test.ts` → FAIL (`maker_count` undefined).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/challenges/my-screen.test.tsx` → FAIL.

- [ ] **Step 3: Move the counts**

Create `packages/api/src/challenge-counts.ts` with the body of `challengeCounts` cut verbatim from `public.ts`:

```ts
import type { ChallengeCounts } from '@splat-connect/types'
import { createAdminClient } from './supabase/client.js'

/**
 * The two numbers a challenge card carries: makers who joined (current
 * participants), and answers — replies from anyone but the asker. Counts, not
 * rows: the thread itself stays private (the brief recruits; the conversation
 * does not), and a number discloses nothing a reader could not see by joining.
 * Shared by the public list and detail and by an account's own lists.
 */
export async function challengeCounts(ideas: { id: string; author_id: string }[]): Promise<Map<string, ChallengeCounts>> {
  const out = new Map(ideas.map((i) => [i.id, { maker_count: 0, answer_count: 0 }]))
  const ids = ideas.map((i) => i.id)
  if (ids.length === 0) return out
  const author = new Map(ideas.map((i) => [i.id, i.author_id]))
  const admin = createAdminClient()
  const [{ data: joins }, { data: replies }] = await Promise.all([
    admin.from('toy_idea_participants').select('idea_id').in('idea_id', ids).is('removed_at', null),
    admin.from('toy_idea_messages').select('idea_id, sender_id').in('idea_id', ids).eq('kind', 'user'),
  ])
  for (const j of joins ?? []) out.get(j.idea_id as string)!.maker_count++
  for (const r of replies ?? []) {
    if (r.sender_id !== author.get(r.idea_id as string)) out.get(r.idea_id as string)!.answer_count++
  }
  return out
}
```

In `public.ts`, delete the `challengeCounts` function and its doc comment, and add `import { challengeCounts } from '../challenge-counts.js'`. (If batch 4 changed the function's body — e.g. added a field — move ITS body, not the one quoted here.)

- [ ] **Step 4: The two routes**

In `toy-ideas.ts`, add `import { challengeCounts } from '../challenge-counts.js'`. Replace the end of `GET /mine` (`if (error) …; return c.json(data ?? [])`) with:

```ts
  if (error) return c.json({ error: error.message }, 500)
  const ideas = data ?? []
  const counts = await challengeCounts(ideas)
  return c.json(ideas.map((i) => ({ ...i, ...counts.get(i.id)! })))
```

In `GET /joined`, change the select to put the participant's join date beside the idea:

```ts
    .select(
      'joined_at, toy_ideas!inner(id, author_id, title, summary, description, intended_use, primary_user, contact_prefs, status, tutorial_id, kind, answer_message_id, answered_at, created_at, updated_at)'
    )
```

(keep the column list batch 1–4 left there; add only `joined_at, ` before `toy_ideas!inner(`) and replace its last two lines with:

```ts
  if (error) return c.json({ error: error.message }, 500)
  const rows = (data ?? []) as unknown as Array<{ joined_at: string; toy_ideas: { id: string; author_id: string } }>
  const counts = await challengeCounts(rows.map((r) => r.toy_ideas))
  return c.json(rows.map((r) => ({ ...r.toy_ideas, joined_at: r.joined_at, ...counts.get(r.toy_ideas.id)! })))
```

In `packages/types/src/index.ts`, after `interface ChallengeCounts`:

```ts
/** An idea on an account's own lists (/api/ideas/mine and /joined): its
 *  counts, and on a joined one, when the account joined. */
export type MyIdea = ToyIdea & Partial<ChallengeCounts> & { joined_at?: string }
```

- [ ] **Step 5: The rows**

In `my-screen.tsx`:
- Imports: `import { plural, type MyIdea, type ToyIdeaStatus } from '@splat-connect/types'` (dropping the `ToyIdea` type import); change `Loaded` to `type Loaded = { items: MyIdea[]; failed: boolean }` and the fetch to `apiClient.get<MyIdea[]>(path)`.
- Add above `IdeaRow`:

```tsx
/** "12 Jul" — the board's short date, Hermes-safe. */
const day = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

/** The board's second line for each row (MB my_challenges). */
export function ideaMeta(idea: MyIdea, joined: boolean): string {
  const makers = idea.maker_count ?? 0
  if (joined) {
    const when = `Joined ${day(idea.joined_at ?? idea.created_at)}`
    return idea.status === 'graduated'
      ? `${when} · being written up`
      : `${when} · ${plural(makers, 'maker')} · ${plural(idea.answer_count ?? 0, 'post')}`
  }
  const submitted = `Your idea · submitted ${day(idea.created_at)}`
  switch (idea.status) {
    case 'pending':
      return `${submitted} · with an admin`
    case 'challenge':
      return `${submitted} · ${plural(makers, 'maker')} joined`
    case 'graduated':
      return `${submitted} · being written up`
    case 'rejected':
      return `Your idea · declined ${day(idea.updated_at)}${idea.review_note ? ' — a reason is attached' : ''}`
  }
}
```

- In `IdeaRow`, take `joined: boolean` and replace the `PENDING(my-challenges-meta)` comment and the `const meta = …` line with `const meta = ideaMeta(idea, joined)`; change the props type to `{ idea: MyIdea; joined: boolean; onOpen: () => void }`. Everything else in the row (batch 4's `onPress` and hint) stays.
- `Group` takes `joined: boolean` and passes it: `<IdeaRow key={idea.id} idea={idea} joined={joined} onOpen={() => onOpen(idea.id)} />`. The "Your ideas" group passes `joined={false}`, "Challenges you joined" passes `joined`.

- [ ] **Step 6: Run the tests to see them pass**

Run the two commands from Step 2 → PASS, plus `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toy-ideas` → PASS (the public challenge tests still see their counts). `pnpm typecheck` → exit 0.

- [ ] **Step 7: Ship the item**

Set `shipped: true` on `'my-challenges-meta'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 8: Commit**

```bash
git status --short
git add packages/api/src/challenge-counts.ts packages/api/src/routes/public.ts packages/api/src/routes/toy-ideas.ts packages/types/src/index.ts packages/mobile/components/challenges/my-screen.tsx packages/api/tests/integration/toy-ideas/my-meta.test.ts packages/mobile/tests/unit/components/challenges/my-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(challenges): when you joined or submitted, and maker and post counts, on My challenges

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 8: Place, counts and badges on the organisations list (`organisations-list-meta`, migration 116)

`logo_url` and `verified_at` are already anon-readable (081). The three counts are SECURITY DEFINER computed fields on `organizations`, selected by the same anon read.

**Files:**
- Create: `supabase/migrations/116_organisation_list_counts.sql`
- Modify: `packages/api/src/routes/public.ts` (`GET /organizations`)
- Modify: `packages/types/src/index.ts` (`OrgListing`)
- Modify: `packages/mobile/components/toys/organisations-screen.tsx`
- Modify: `scripts/parity/app-screen-map.json` (delete the `org_list` rule), `scripts/check-schema-guards.sh`
- Test: `packages/api/tests/integration/public/org-list-counts.test.ts` (new), `packages/mobile/tests/unit/components/toys/organisations-screen.test.tsx` (updated)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: `org_backed_count(organizations) → int` (accepted backings on approved guides), `org_toy_count(organizations) → int` (published shelf toys), `org_has_printer(organizations) → boolean` (an accepting printer). `GET /api/public/organizations` rows: `OrgListing { id; name; description; status; suburb: string | null; state: string | null; logo_url: string | null; verified_at: string | null; backed_count: number; toy_count: number; has_printer: boolean; recycling_materials; recycling_note }`. Exported `orgListMeta(o: OrgListing): string` from `organisations-screen.tsx`.

Copy (MB:1843–1848): row "{suburb}, {state} · {n} backed · {n} toys" or "{suburb}, {state} · has a printer" · badges "Verified" / "Printer" · lead "{n} organisations standing behind the work."

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/public/org-list-counts.test.ts`:

```ts
/**
 * 116: the organisations list carries what each one stands behind — backed
 * guides, shelf toys, a printer — as counts, never rows.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, createProject, requestBacking, createOrgToy, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let orgId: string
let printerOrgId: string
const tutorialIds: string[] = []

beforeAll(async () => {
  const admin = adminClient()
  leader = await createTestUser()
  orgId = await createOrg({ createdBy: leader.id, name: `Northside ${Date.now()}` })
  printerOrgId = await createOrg({ createdBy: leader.id, name: `Riverina ${Date.now()}` })
  await admin.from('organizations').update({ suburb: 'Newcastle', state: 'NSW', verified_at: new Date().toISOString() }).eq('id', orgId)
  for (const status of ['approved', 'approved', 'pending'] as const) {
    const id = await createProject({ authorId: leader.id, status })
    tutorialIds.push(id)
    await requestBacking({ tutorialId: id, orgId, status: 'accepted' })
  }
  await createOrgToy({ orgId })
  await createOrgToy({ orgId, status: 'draft' })
  await admin.from('printers').insert({ owner_org_id: printerOrgId, name: 'Prusa', bed_x: 250, bed_y: 210, bed_z: 210, accepting: true })
})

afterAll(async () => {
  await cleanupOrg(orgId, tutorialIds)
  await cleanupOrg(printerOrgId)
  await deleteTestUser(leader.id)
})

describe('GET /api/public/organizations — 116 counts', () => {
  it('the three definer functions exist', async () => {
    const { data, error } = await adminClient()
      .from('organizations')
      .select('org_backed_count, org_toy_count, org_has_printer')
      .eq('id', orgId)
      .single()
    expect(error).toBeNull()
    expect(data).toMatchObject({ org_backed_count: 2, org_toy_count: 1, org_has_printer: false })
  })

  it('serves place, badges and counts to a signed-out reader', async () => {
    const rows = (await (await app.request('/api/public/organizations')).json()) as Array<Record<string, unknown>>
    expect(rows.find((r) => r.id === orgId)).toMatchObject({
      suburb: 'Newcastle', state: 'NSW', backed_count: 2, toy_count: 1, has_printer: false,
    })
    expect(rows.find((r) => r.id === orgId)!.verified_at).toBeTruthy()
    expect(rows.find((r) => r.id === printerOrgId)).toMatchObject({ backed_count: 0, toy_count: 0, has_printer: true })
  })
})
```

In `organisations-screen.test.tsx`, change the `org` fixture to carry `suburb: null, state: null, logo_url: null, verified_at: null, backed_count: 0, toy_count: 0, has_printer: false,` and append:

```tsx
  it('reads place, counts and badges the way the board does', async () => {
    mockGet.mockResolvedValue([
      org({ id: 'o1', name: 'Northside', suburb: 'Newcastle', state: 'NSW', backed_count: 18, toy_count: 7, verified_at: '2026-09-01' }),
      org({ id: 'o2', name: 'Riverina Makerspace', suburb: 'Wagga Wagga', state: 'NSW', has_printer: true }),
    ])
    render(<OrganisationsScreen />)
    expect(await screen.findByText('Newcastle, NSW · 18 backed · 7 toys')).toBeTruthy()
    expect(screen.getByText('Wagga Wagga, NSW · has a printer')).toBeTruthy()
    expect(screen.getByText('Verified')).toBeTruthy()
    expect(screen.getByText('Printer')).toBeTruthy()
    expect(screen.getByText('2 organisations standing behind the work.')).toBeTruthy()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/public/org-list-counts.test.ts` → FAIL (`column organizations.org_backed_count does not exist`).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/toys/organisations-screen.test.tsx` → FAIL.

- [ ] **Step 3: The migration**

`supabase/migrations/116_organisation_list_counts.sql`:

```sql
-- 116 — what an organisation stands behind, as counts on the directory
-- (organisations-list-meta).
--
-- The board's row reads "Newcastle, NSW · 18 backed · 7 toys", or "· has a
-- printer". Three numbers per row, so three SECURITY DEFINER computed fields
-- rather than three fetches per organisation, and never counter columns:
--
--   org_backed_count  accepted backings on approved guides (what the profile's
--                     "Guides they back" lists)
--   org_toy_count     published toys on its shelf
--   org_has_printer   an accepting printer it owns
--
-- Each discloses a number anyone could count off the public profile.
--
-- DOWN:
--   drop function if exists public.org_has_printer(public.organizations);
--   drop function if exists public.org_toy_count(public.organizations);
--   drop function if exists public.org_backed_count(public.organizations);

create function public.org_backed_count(o public.organizations)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int
    from public.tutorial_orgs b
    join public.tutorials t on t.id = b.tutorial_id
   where b.org_id = o.id and b.status = 'accepted' and t.status = 'approved'
$$;

create function public.org_toy_count(o public.organizations)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.toys where owner_org_id = o.id and status = 'published'
$$;

create function public.org_has_printer(o public.organizations)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.printers where owner_org_id = o.id and accepting)
$$;

grant execute on function public.org_backed_count(public.organizations) to anon, authenticated;
grant execute on function public.org_toy_count(public.organizations) to anon, authenticated;
grant execute on function public.org_has_printer(public.organizations) to anon, authenticated;
```

Run: `supabase migration up` → `Applying migration 116_organisation_list_counts.sql...`

- [ ] **Step 4: The route and the type**

In `public.ts`, `GET /organizations`, change the select:

```ts
    .select(
      'id, name, description, status, suburb, state, recycling_materials, recycling_note, logo_url, verified_at, backed_count:org_backed_count, toy_count:org_toy_count, has_printer:org_has_printer'
    )
```

and add above it: `// 116: logo and verified are 081's anon grants; the three counts are definer functions.`

In `packages/types/src/index.ts`, after `interface Organization`:

```ts
/** A row of GET /api/public/organizations (116). */
export interface OrgListing {
  id: string
  name: string
  description: string | null
  status: Organization['status']
  suburb: string | null
  state: string | null
  logo_url: string | null
  verified_at: string | null
  backed_count: number
  toy_count: number
  has_printer: boolean
}
```

- [ ] **Step 5: The rows**

In `organisations-screen.tsx`:
- Imports: `import { View, Text, Image, FlatList, RefreshControl, StyleSheet } from 'react-native'` and `import type { OrgListing } from '@splat-connect/types'` (dropping `Organization`). Change `type OrgRow = Pick<Organization, 'id' | 'name' | 'status'>` to `type OrgRow = OrgListing`.
- Add above `function OrgRow`:

```tsx
/** "Newcastle, NSW · 18 backed · 7 toys", or "· has a printer" (MB org_list). */
export function orgListMeta(o: OrgListing): string {
  const place = [o.suburb, o.state].filter(Boolean).join(', ')
  const counts =
    o.backed_count || o.toy_count ? `${o.backed_count} backed · ${o.toy_count} toys` : o.has_printer ? 'has a printer' : null
  return [place || null, counts].filter(Boolean).join(' · ')
}
```

- Replace the avatar `<View style={styles.avatar}>…</View>`, the `PENDING(organisations-list-meta)` comment and the name `<Text>` with:

```tsx
        {item.logo_url ? (
          <Image source={{ uri: item.logo_url }} style={styles.avatar} accessibilityIgnoresInvertColors />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          {orgListMeta(item) ? <Text style={styles.meta}>{orgListMeta(item)}</Text> : null}
        </View>
        {item.verified_at ? (
          <Text style={[styles.badge, styles.verified]}>Verified</Text>
        ) : item.has_printer ? (
          <Text style={[styles.badge, styles.printer]}>Printer</Text>
        ) : null}
```

- On the `FlatList`, add `ListHeaderComponent={<Text style={styles.lead}>{`${visible.length} organisations standing behind the work.`}</Text>}`.
- Styles (keep `name`'s existing font, drop its `flex: 1` if present, since `body` now takes the space):

```tsx
  body: { flex: 1, minWidth: 0, gap: 2 },
  meta: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted },
  badge: {
    fontFamily: theme.fonts.black,
    fontSize: 11,
    color: theme.colors.ink,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  verified: { backgroundColor: theme.colors.successSoft },
  printer: { backgroundColor: theme.colors.apricotSoft },
  lead: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, marginBottom: theme.spacing(3) },
```

Run: `grep -rn "org_backed_count\|backed_count" packages/mobile packages/web` → the screen and its test only.

- [ ] **Step 6: Parity and guards**

In `scripts/parity/app-screen-map.json`, delete the whole `explained` array (and its key) from the `org_list` entry — its only rule is the `organisations-list-meta` one.

In `scripts/check-schema-guards.sh`, add a row before the closing `) as t(...)` of the values list (match the surrounding rows' shape):

```sql
  -- 116. Not a guard but the same silent failure: without these the directory
  -- 500s for every visitor the moment the select names them.
  ('116 organisation list count functions exist',
   (select count(*) = 3 from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname in ('org_backed_count', 'org_toy_count', 'org_has_printer'))),
```

- [ ] **Step 7: Run the tests to see them pass**

Run the two commands from Step 2 → PASS; `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/public/organizations.test.ts` → PASS. `pnpm typecheck` → exit 0.

- [ ] **Step 8: Ship the item**

The marker went in Step 5. Set `shipped: true` on `'organisations-list-meta'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)` (the parity-exemption test now passes only because Step 6 removed the rule).

- [ ] **Step 9: Commit**

```bash
git status --short
git add supabase/migrations/116_organisation_list_counts.sql packages/api/src/routes/public.ts packages/types/src/index.ts packages/mobile/components/toys/organisations-screen.tsx scripts/parity/app-screen-map.json scripts/check-schema-guards.sh packages/api/tests/integration/public/org-list-counts.test.ts packages/mobile/tests/unit/components/toys/organisations-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(orgs): place, backed and toy counts, printer and verified badges on the organisations list (116)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 9: Rows on an organisation's profile (`org-profile-rows`)

Backed guides gain their author (admin-client lookup) and parts total (`partsTotalCents` over an embedded `parts(is_optional, price_cents)`); `build_minutes` already rides in `tutorials(*)`. Shelf toys already carry `offer_type` and `condition`. Leaders have no role column ("follows the code" 8). No list filters by organisation, so "All {n} →" / "See all →" expand the section in place ("follows the code" 9).

**Files:**
- Modify: `packages/api/src/routes/public.ts` (`GET /organizations/:id`)
- Modify: `packages/types/src/index.ts` (`Tutorial.parts_total_cents`, `OFFER_SHORT_LABEL`)
- Modify: `packages/mobile/components/organisation/org-profile-screen.tsx`
- Test: `packages/api/tests/integration/public/org-rows.test.ts` (new), `packages/mobile/tests/unit/components/organisation/org-profile-screen.test.tsx` (updated)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: `primaryAuthorNames` (Task 6), `guideMeta` (Task 5), `partsTotalCents` (batch 1), `formatCents`, `initials` (types), `gradeOf` (batch 3).
- Produces: `Tutorial.parts_total_cents?: number | null`. `OFFER_SHORT_LABEL: Record<OfferType, string>` in types (web's `toy-library-card.tsx` words).

Copy (MB:1197–1206, 2754–2767): "Guides they back {n}" · "All {n} →" · guide row "{difficulty} · {time} · {$total}" with the author · "Toys on their shelf {n}" · "See all →" · toy row "{offer} · {grade}" · leader "{n} guides backed" with initials. The board's offer words "Lend" / "Give away" match no `OfferType`; the row uses web's existing "Gift" / "Swap only" / "Swap or gift" (flagged).

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/public/org-rows.test.ts`:

```ts
/** org-profile-rows: a backed guide names its author and its parts total. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

let author: TestUser
let orgId: string
let priced: string
let unpriced: string

beforeAll(async () => {
  const admin = adminClient()
  author = await createTestUser()
  await admin.from('profiles').update({ name: 'Rachel Kaur' }).eq('id', author.id)
  orgId = await createOrg({ createdBy: author.id })
  priced = await createProject({ authorId: author.id, status: 'approved', title: 'Drum' })
  unpriced = await createProject({ authorId: author.id, status: 'approved', title: 'Fan' })
  for (const id of [priced, unpriced]) await requestBacking({ tutorialId: id, orgId, status: 'accepted' })
  await admin.from('parts').insert([
    { tutorial_id: priced, name: 'Switch', is_optional: false, price_cents: 1200 },
    { tutorial_id: priced, name: 'Jack', is_optional: false, price_cents: 1200 },
    { tutorial_id: priced, name: 'Glitter', is_optional: true, price_cents: null },
    { tutorial_id: unpriced, name: 'Fan', is_optional: false, price_cents: null },
  ])
})

afterAll(async () => {
  await cleanupOrg(orgId, [priced, unpriced])
  await deleteTestUser(author.id)
})

describe('GET /api/public/organizations/:id — guide rows', () => {
  it('names the author and totals the required parts, and hides a total with an unpriced part', async () => {
    const body = (await (await app.request(`/api/public/organizations/${orgId}`)).json()) as {
      tutorialsBacked: Array<{ id: string; author_name: string | null; parts_total_cents: number | null }>
    }
    expect(body.tutorialsBacked.find((t) => t.id === priced)).toMatchObject({ author_name: 'Rachel Kaur', parts_total_cents: 2400 })
    expect(body.tutorialsBacked.find((t) => t.id === unpriced)).toMatchObject({ parts_total_cents: null })
  })
})
```

In `org-profile-screen.test.tsx`, append inside the main describe:

```tsx
  it('reads guide, toy and leader rows the way the board does, and expands past four', async () => {
    const guide = (i: number) => ({
      id: `g${i}`, title: `Guide ${i}`, difficulty: 'easy', build_minutes: 20, parts_total_cents: 2400,
      author_name: 'Rachel Kaur', toy_photo_url: null, status: 'approved',
    })
    load(null)
    mockGet.mockImplementation((path: string) =>
      Promise.resolve(
        path.startsWith('/api/public')
          ? {
              ...ORG,
              tutorialsBacked: [1, 2, 3, 4, 5].map(guide),
              toysShared: [{ id: 'y1', name: 'Light-up drum', condition: 9, offer_type: 'donation', quantity: 1, cover_photo_url: null }],
            }
          : null
      )
    )
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('Guide 1')).toBeTruthy()
    expect(screen.getAllByText('Easy · 20 min · $24.00')).toHaveLength(4)
    expect(screen.queryByText('Guide 5')).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'All 5 →' }))
    expect(screen.getByText('Guide 5')).toBeTruthy()
    expect(screen.getByText('Gift · Like new')).toBeTruthy()
    expect(screen.getByText('3 guides backed')).toBeTruthy()
    expect(screen.getByText('RK')).toBeTruthy()
  })
```

(Match the screen's real props: if `OrgProfileScreen` takes `orgId` rather than `id`, use what its existing tests use.)

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/public/org-rows.test.ts` → FAIL (`author_name` undefined).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/organisation/org-profile-screen.test.tsx` → FAIL.

- [ ] **Step 3: The API**

In `public.ts`:
- Imports: add `partsTotalCents` to the `@splat-connect/types` import, and `import { primaryAuthorNames } from '../profile-name.js'`.
- In `GET /organizations/:id`, change the two guide selects:

```ts
    sb
      .from('tutorial_orgs')
      .select('tutorials!inner(*, parts(is_optional, price_cents))')
```

```ts
    sb.from('tutorials').select('*, parts(is_optional, price_cents)').eq('reviewed_for_org_id', id).eq('status', 'approved'),
```

- After `const extras = await orgProfileExtras(…)` / its 500 guard, add:

```ts
  // org-profile-rows: each guide row's author (by id, admin client) and parts
  // total (null unless every required part is priced — partsTotalCents).
  type Row = { id: string; parts?: { is_optional: boolean; price_cents: number | null }[] }
  const allGuides = [...(tutorialsBacked as Row[]), ...((tutorialsApproved ?? []) as Row[])]
  const authors = await primaryAuthorNames([...new Set(allGuides.map((t) => t.id))])
  if (!authors) return c.json({ error: 'Failed to load organisation profile' }, 500)
  const withRowFacts = (rows: Row[]) =>
    rows.map(({ parts, ...t }) => ({
      ...t,
      author_name: authors.get(t.id) ?? null,
      parts_total_cents: partsTotalCents(parts ?? []),
    }))
```

- In `result`, use `tutorialsBacked: withRowFacts(tutorialsBacked as Row[]) as OrgPublicProfile['tutorialsBacked']` and `tutorialsApproved: withRowFacts((tutorialsApproved ?? []) as Row[]) as OrgPublicProfile['tutorialsApproved']`.

In `packages/types/src/index.ts`:
- In `interface Tutorial`, after `author_name?`:

```ts
  /** On an organisation's guide rows: partsTotalCents over the guide's parts. */
  parts_total_cents?: number | null
```

- After `export type OfferType = …`:

```ts
/** Short offer words for a row, as web's toy card writes them. */
export const OFFER_SHORT_LABEL: Record<OfferType, string> = { donation: 'Gift', exchange: 'Swap only', both: 'Swap or gift' }
```

- [ ] **Step 4: The rows**

In `org-profile-screen.tsx`:
- Imports: add `guideMeta, gradeOf, initials, OFFER_SHORT_LABEL` to the `@splat-connect/types` value import; `Pressable` to the `react-native` import; `import { ListRow, RowThumb } from '../list/list-kit'`.
- Add state at the top of the screen component: `const [allGuides, setAllGuides] = useState(false)` and `const [allToys, setAllToys] = useState(false)`.
- Give `Section` an optional action:

```tsx
function Section({ title, hint, action, children }: { title: React.ReactNode; hint?: string; action?: { label: string; onPress: () => void }; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.label} hitSlop={8}>
            <Text style={styles.sectionAction}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}
```

- Replace the `PENDING(org-profile-rows)` comment and the "Guides they back" section with:

```tsx
      {guides.length > 0 ? (
        <Section
          title={<>Guides they back <Text style={styles.count}>{guides.length}</Text></>}
          hint="Backing means a leader read it, checked the safety list and built it once. Their name is on it."
          action={guides.length > 4 && !allGuides ? { label: `All ${guides.length} →`, onPress: () => setAllGuides(true) } : undefined}
        >
          {(allGuides ? guides : guides.slice(0, 4)).map((g) => (
            <ListRow
              key={g.id}
              title={g.title}
              meta={[guideMeta(g, g.parts_total_cents != null ? formatCents(g.parts_total_cents) : null), g.author_name].filter(Boolean).join('\n')}
              thumb={<RowThumb photo={g.toy_photo_url} glyph="color-wand-outline" />}
              onPress={() => router.push({ pathname: '/guides/[id]', params: { id: g.id } })}
              accessibilityLabel={g.title}
            />
          ))}
        </Section>
      ) : null}
```

  (the author sits on the meta's second line, as MB:1199 puts `g.by` under `g.meta`).
- Replace the "Toys on their shelf" section's rows the same way:

```tsx
      {org.toysShared.length > 0 ? (
        <Section
          title={<>Toys on their shelf <Text style={styles.count}>{org.toysShared.length}</Text></>}
          action={org.toysShared.length > 4 && !allToys ? { label: 'See all →', onPress: () => setAllToys(true) } : undefined}
        >
          {(allToys ? org.toysShared : org.toysShared.slice(0, 4)).map((t) => (
            <ListRow
              key={t.id}
              title={t.name}
              meta={[t.offer_type ? OFFER_SHORT_LABEL[t.offer_type] : null, gradeOf(t.condition).label].filter(Boolean).join(' · ')}
              thumb={<RowThumb photo={t.cover_photo_url} glyph="cube-outline" />}
              onPress={() => router.push({ pathname: '/toy-library/[id]', params: { id: t.id } })}
              accessibilityLabel={t.name}
            />
          ))}
        </Section>
      ) : null}
```

- In the Leaders section, put the initials beside each name:

```tsx
            <Card key={`${l.name}-${i}`} style={[styles.row, styles.leaderRow]}>
              <View style={styles.leaderAvatar}>
                <Text style={styles.leaderInitials}>{initials(l.name)}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{l.name}</Text>
                <Text style={styles.rowMeta}>
                  {l.guides_backed} {l.guides_backed === 1 ? 'guide' : 'guides'} backed
                </Text>
              </View>
            </Card>
```

- Styles (add; reuse `flex` if the file has one, else add it):

```tsx
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.spacing(2) },
  sectionAction: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.primaryDeep },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) },
  leaderAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentLight },
  leaderInitials: { fontFamily: theme.fonts.black, fontSize: 14, color: theme.colors.ink },
  flex: { flex: 1, minWidth: 0 },
```

If the test's `'Easy · 20 min · $24.00'` lookup misses because the meta and author share one `Text`, assert with a regex: `getAllByText(/Easy · 20 min · \$24\.00/)`.

- [ ] **Step 5: Run the tests to see them pass**

Run the two commands from Step 2 → PASS; `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/public/org-profile.test.ts tests/integration/orgs/org-profile-social.test.ts` → PASS. `pnpm typecheck` → exit 0.

- [ ] **Step 6: Ship the item**

Set `shipped: true` on `'org-profile-rows'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 7: Commit**

```bash
git status --short
git add packages/api/src/routes/public.ts packages/types/src/index.ts packages/mobile/components/organisation/org-profile-screen.tsx packages/api/tests/integration/public/org-rows.test.ts packages/mobile/tests/unit/components/organisation/org-profile-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(orgs): author, time and parts total on backed guides; offer and grade on shelf toys; leader initials

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---
## Slice 3

### Task 10: Say thanks to a person (`thank-people`, migration 117)

Decided 2026-09-30: one `profile_thanks` table mirroring 077's `org_thanks` — note, show_note, optional transaction, a notification, only the count public. Two holes in 077 are not copied ("follows the code" 5, 6): the `one_subject` recreation is guarded, and the thanker gets column-level `update (note, byline, show_note)` only, so they can never clear a `hidden_at`. A thanks tied to an exchange, print or build rides the existing `toy_transaction_id` subject; only a showcase thanks needs the new `profile_id` subject. Where the other side of a thread is an organisation, the button thanks the organisation through 077's existing route. Also fixes the web `ThanksButton`, whose toast never shows on the public guide page (Controller ruling 3).

**Files:**
- Create: `supabase/migrations/117_profile_thanks.sql`
- Modify: `packages/api/src/routes/contributors.ts` (`POST /:id/thanks`, `GET /me/thanks`, `PATCH /me/thanks/:thankerId`)
- Modify: `packages/api/src/routes/public.ts` (`GET /contributors/:id` adds the person's own thanks)
- Modify: `packages/types/src/index.ts` (`NotificationType`, `NOTIFICATION_BUCKET`, `COPY`, `Notification.profile_id`)
- Create: `packages/mobile/components/people/thank-button.tsx`
- Modify: `packages/mobile/components/toys/toy-detail-screen.tsx`, `packages/mobile/components/exchanges/thread-screen.tsx`, `packages/mobile/components/printing/job-screen.tsx`, `packages/mobile/components/guides/showcase-screen.tsx`, `packages/mobile/components/builds/build-thread-screen.tsx`
- Modify: `packages/mobile/lib/notifications.ts`, `packages/mobile/components/inbox/inbox-screen.tsx`, `packages/web/components/notifications-list.tsx` (the new type's link and icon)
- Modify: `packages/web/components/thanks-button.tsx`
- Modify: `scripts/check-schema-guards.sh`
- Test: `packages/api/tests/integration/contributors/profile-thanks.test.ts` (new), `packages/mobile/tests/unit/components/people/thank-button.test.tsx` (new), `packages/web/tests/unit/components/thanks-button.test.tsx` (new), `packages/mobile/tests/unit/components/toys/toy-detail-screen.test.tsx` (updated)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: `useFlash`/`FlashLine` (`packages/mobile/components/ui/Flash.tsx`), `useAuth` (`lib/auth-context`), `isApiError` (types).
- Produces: table `profile_thanks(profile_id, thanker_id, note, byline, show_note, hidden_at, transaction_id, created_at)`; `profile_thanks_count(profiles) → int`; column `notifications.profile_id`; type `'profile_thanked'` (bucket `exchanges`). `POST /api/contributors/:id/thanks` body `{ note?, byline?, show_note?, transaction_id? }` → `201 { thanks_count }` / 403 self / 409 `'You already thanked them'` / 400 / 404. `ThankButton({ label, to, transactionId?, variant?, style? })` where `to: { profileId: string } | { orgId: string }`.

Copy (MB:1683, 1684, 346, 746, 1024, 1151): toasts "Thanks sent — they will see it in their notifications" / "You already thanked them" · "Thank {person}" (toy detail) · "Say thanks to {other}" (exchange, build) · "Say thanks to the printer" (print job, kept) · "Say thanks" (showcase, MB:1151) · "Thanked {n} times". The notification line "{actor} said thanks to you" mirrors 077's `org_thanked` (no board — flagged). The failure line "Could not send that. Try again." is `ThanksButton`'s existing one.

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/contributors/profile-thanks.test.ts`:

```ts
/**
 * 117 — thanking a person. Only the count is public; the note is the thanker's
 * and the thanked person's; a hide is the thanked person's and the thanker can
 * never undo it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

const userClient = (token: string) =>
  createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '', {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
const anon = () => createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '')

let maker: TestUser
let family: TestUser
let stranger: TestUser
let tutorialId: string
let txId: string

const post = (token: string, id: string, body: unknown = {}) =>
  app.request(`/api/contributors/${id}/thanks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeAll(async () => {
  const admin = adminClient()
  ;[maker, family, stranger] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
  // The maker needs something public, or their showcase 404s.
  const { data: t } = await admin.from('tutorials').insert({ title: 'Drum', difficulty: 'easy', status: 'approved' }).select('id').single()
  tutorialId = t!.id
  await admin.from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: maker.id, role: 'primary' })
  const { data: tx } = await admin
    .from('toy_transactions')
    .insert({ type: 'build', status: 'completed', tutorial_id: tutorialId, build_brief: 'For Leo.', requester_id: family.id, owner_id: maker.id })
    .select('id')
    .single()
  txId = tx!.id
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('notifications').delete().in('recipient_id', [maker.id, family.id, stranger.id])
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([maker, family, stranger].map((u) => deleteTestUser(u.id)))
})

describe('117 profile thanks', () => {
  it('the table and the count function exist', async () => {
    const { error } = await adminClient().from('profile_thanks').select('profile_id, thanker_id, note, byline, show_note, hidden_at, transaction_id').limit(1)
    expect(error).toBeNull()
    const { error: countError } = await adminClient().from('profiles').select('profile_thanks_count').eq('id', maker.id).single()
    expect(countError).toBeNull()
  })

  it('refuses a transaction the two were never party to, and thanking yourself', async () => {
    expect((await post(stranger.token, maker.id, { transaction_id: txId })).status).toBe(400)
    expect((await post(maker.token, maker.id)).status).toBe(403)
  })

  it('takes one thanks per person, tied to the build, and tells the maker on the build', async () => {
    const res = await post(family.token, maker.id, { note: 'Leo loves it.', byline: 'Sam', transaction_id: txId })
    expect(res.status).toBe(201)
    expect(((await res.json()) as { thanks_count: number }).thanks_count).toBe(1)
    expect((await post(family.token, maker.id)).status).toBe(409)

    const { data: n } = await adminClient().from('notifications').select('*').eq('recipient_id', maker.id).eq('type', 'profile_thanked')
    expect(n).toHaveLength(1)
    expect(n![0]).toMatchObject({ toy_transaction_id: txId, profile_id: null, actor_name: 'Sam' })
  })

  it('a showcase thanks carries the person as its subject', async () => {
    expect((await post(stranger.token, maker.id)).status).toBe(201)
    const { data: n } = await adminClient()
      .from('notifications')
      .select('profile_id, toy_transaction_id, actor_name')
      .eq('recipient_id', maker.id)
      .eq('type', 'profile_thanked')
      .is('toy_transaction_id', null)
    expect(n![0]).toMatchObject({ profile_id: maker.id, actor_name: 'A family' })
  })

  it('lets nobody but the two read the note; anon reads the count only', async () => {
    const third = await userClient(stranger.token).from('profile_thanks').select('note').eq('thanker_id', family.id)
    expect(third.data ?? []).toEqual([])
    const own = await userClient(family.token).from('profile_thanks').select('note').eq('thanker_id', family.id)
    expect(own.data).toEqual([{ note: 'Leo loves it.' }])
    const thanked = await userClient(maker.token).from('profile_thanks').select('note').eq('profile_id', maker.id)
    expect(thanked.data?.length).toBe(2)
    const viaAnon = await anon().from('profile_thanks').select('note')
    expect(viaAnon.error ?? viaAnon.data?.length === 0).toBeTruthy()

    const raw = await (await app.request(`/api/public/contributors/${maker.id}`)).text()
    expect(raw).not.toContain('Leo loves it.')
    expect((JSON.parse(raw) as { thanks: number }).thanks).toBe(2)
  })

  it('lets the thanked person hide a note, and the thanker can never un-hide it', async () => {
    const hide = await app.request(`/api/contributors/me/thanks/${family.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${maker.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: true }),
    })
    expect(hide.status).toBe(200)
    const undo = await userClient(family.token).from('profile_thanks').update({ hidden_at: null }).eq('thanker_id', family.id).eq('profile_id', maker.id)
    expect(undo.error).not.toBeNull()
    const { data } = await adminClient().from('profile_thanks').select('hidden_at').eq('thanker_id', family.id).single()
    expect(data!.hidden_at).not.toBeNull()
  })
})
```

`packages/mobile/tests/unit/components/people/thank-button.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ThankButton } from '../../../../components/people/thank-button'

const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
let mockSession: object | null = { user: { id: 'me' } }
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: mockSession }) }))

beforeEach(() => {
  jest.clearAllMocks()
  mockSession = { user: { id: 'me' } }
})

describe('ThankButton', () => {
  it('thanks a person, tied to the exchange, and says so', async () => {
    mockPost.mockResolvedValue({ thanks_count: 1 })
    render(<ThankButton label="Say thanks to Sam" to={{ profileId: 'p1' }} transactionId="tx1" />)
    fireEvent.press(screen.getByRole('button', { name: 'Say thanks to Sam' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/contributors/p1/thanks', { transaction_id: 'tx1' }))
    expect(await screen.findByText('Thanks sent — they will see it in their notifications')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Say thanks to Sam' })).toBeDisabled()
  })

  it('thanks an organisation through its own route, with no transaction', async () => {
    mockPost.mockResolvedValue({ thanks_count: 3 })
    render(<ThankButton label="Say thanks to Northside" to={{ orgId: 'o1' }} transactionId="tx1" />)
    fireEvent.press(screen.getByRole('button', { name: 'Say thanks to Northside' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/organizations/o1/thanks', {}))
  })

  it('says you already did on a 409', async () => {
    mockPost.mockRejectedValue(new Error('Request failed with status 409: You already thanked them'))
    render(<ThankButton label="Say thanks" to={{ profileId: 'p1' }} />)
    fireEvent.press(screen.getByRole('button', { name: 'Say thanks' }))
    expect(await screen.findByText('You already thanked them')).toBeTruthy()
  })

  it('sends a signed-out person to sign in instead', () => {
    mockSession = null
    render(<ThankButton label="Say thanks" to={{ profileId: 'p1' }} />)
    fireEvent.press(screen.getByRole('button', { name: 'Say thanks' }))
    expect(mockPush).toHaveBeenCalledWith('/sign-in')
    expect(mockPost).not.toHaveBeenCalled()
  })
})
```

`packages/web/tests/unit/components/thanks-button.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThanksButton } from '@/components/thanks-button'

const post = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: (...a: unknown[]) => post(...a) } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/tutorials/t1' }))

beforeEach(() => vi.clearAllMocks())

// The public guide page has no ToastProvider, so a toast here was silent.
describe('ThanksButton', () => {
  it('says the thanks went, inline, with no toast provider on the page', async () => {
    post.mockResolvedValue({ thanks_count: 4 })
    render(<ThanksButton tutorialId="t1" count={3} thanked={false} own={false} signedIn />)
    fireEvent.click(screen.getByRole('button', { name: /Say thanks/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Thanks sent — they will see it in their notifications')
    expect(screen.getByRole('button')).toHaveTextContent('Thanked')
  })

  it('says you already thanked them on a 409', async () => {
    post.mockRejectedValue(Object.assign(new Error('409'), { status: 409 }))
    render(<ThanksButton tutorialId="t1" count={3} thanked={false} own={false} signedIn />)
    fireEvent.click(screen.getByRole('button', { name: /Say thanks/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('You already thanked them')
  })

  it('raises an alert when it could not send', async () => {
    post.mockRejectedValue(Object.assign(new Error('500'), { status: 500 }))
    render(<ThanksButton tutorialId="t1" count={3} thanked={false} own={false} signedIn />)
    fireEvent.click(screen.getByRole('button', { name: /Say thanks/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not send that. Try again.')
  })
})
```

In `packages/mobile/tests/unit/components/toys/toy-detail-screen.test.tsx`, replace the two lines that press `/^Thank/` and expect the `/not-built` push with:

```tsx
    fireEvent.press(screen.getByRole('button', { name: /^Thank/ }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/contributors\/.+\/thanks$/), {}))
```

and update the comment above it (`// board draws the button, so it opens Not built yet (thank-people).`) to `// thank-people: a person holder is thanked directly.` (If that test file has no `mockPost`, add `post` to its `api-client` mock the same way the other mobile tests do, and mock `../../../../lib/auth-context` with a session.)

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/contributors/profile-thanks.test.ts` → FAIL (`relation "public.profile_thanks" does not exist`).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/people/thank-button.test.tsx` → FAIL (module not found).
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/thanks-button.test.tsx` → FAIL (no `status` role).

- [ ] **Step 3: The migration**

Re-read the latest definitions first:

```bash
grep -ln "notifications_type_check" supabase/migrations/*.sql | sort | tail -1
grep -ln "notifications_one_subject" supabase/migrations/*.sql | sort | tail -1
```

The type list below is 093's plus batch 4's two (109, 111). If the first command names a later file (batch 5's), copy ITS list into both the guard and the recreate before adding `'profile_thanked'`. If the second names anything after 077, copy its column list into the `one_subject` guard and recreate before adding `profile_id`.

`supabase/migrations/117_profile_thanks.sql`:

```sql
-- 117 — Say thanks to a person (thank-people).
--
-- Decided 2026-09-30: one table mirroring 077's org_thanks. One thanks per
-- person per person; an optional note that shows nowhere public (the board's
-- buttons are one tap, and only the COUNT is public, through a definer
-- function); an optional transaction it was for (an exchange, a print, a
-- build). The thanked person may hide a note; the count keeps it.
--
-- Two of 077's holes are not copied:
--   * org_thanks' update policy lets the thanker write hidden_at through
--     PostgREST. Here the thanker may update note, byline and show_note only
--     (column grants); hidden_at is written by the API with the service role.
--   * 077 recreated notifications_one_subject unguarded. Here it is guarded
--     like the type check.
--
-- notifications gains profile_id: the subject of a thanks sent from someone's
-- showcase. A thanks tied to a transaction uses toy_transaction_id instead.
--
-- DOWN:
--   (restore the previous notifications_type_check and notifications_one_subject)
--   alter table public.notifications drop column if exists profile_id;
--   drop function if exists public.profile_thanks_count(public.profiles);
--   drop table if exists public.profile_thanks;

create table public.profile_thanks (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  thanker_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  note text check (note is null or length(btrim(note)) between 1 and 200),
  byline text check (byline is null or length(btrim(byline)) between 1 and 60),
  show_note boolean not null default false,
  hidden_at timestamptz,
  transaction_id uuid references public.toy_transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (profile_id, thanker_id),
  constraint profile_thanks_not_self check (profile_id <> thanker_id)
);

alter table public.profile_thanks enable row level security;
create policy profile_thanks_own_read on public.profile_thanks for select to authenticated
  using (thanker_id = auth.uid());
create policy profile_thanks_thanked_read on public.profile_thanks for select to authenticated
  using (profile_id = auth.uid());
create policy profile_thanks_own_insert on public.profile_thanks for insert to authenticated
  with check (thanker_id = auth.uid());
create policy profile_thanks_own_update on public.profile_thanks for update to authenticated
  using (thanker_id = auth.uid()) with check (thanker_id = auth.uid());

-- Column grants are the second wall. anon gets nothing; a member may insert
-- only what a thanks says and edit only its words. transaction_id and hidden_at
-- are the API's, after it has checked them.
revoke all on public.profile_thanks from anon, authenticated;
grant select on public.profile_thanks to authenticated;
grant insert (profile_id, thanker_id, note, byline, show_note) on public.profile_thanks to authenticated;
grant update (note, byline, show_note) on public.profile_thanks to authenticated;

create or replace function public.profile_thanks_count(p public.profiles)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.profile_thanks where profile_id = p.id
$$;
grant execute on function public.profile_thanks_count(public.profiles) to anon, authenticated;

-- ------------------------------------------------------- notifications --

alter table public.notifications
  add column profile_id uuid references public.profiles (id) on delete cascade;

-- 046's guard, applied to one_subject for the first time: abort rather than
-- drop a subject the live constraint counts.
do $$
declare
  def  text;
  lost text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint
   where conname = 'notifications_one_subject' and conrelid = 'public.notifications'::regclass;
  if def is null then raise exception 'notifications_one_subject is absent'; end if;
  select string_agg(distinct m[1], ', ') into lost
    from regexp_matches(substring(def from 'num_nonnulls\(([^)]*)\)'), '([a-z_]+)', 'g') as m
   where m[1] not in (
     'tutorial_id', 'idea_id', 'toy_transaction_id', 'org_id', 'org_event_id', 'org_story_id',
     'org_conversation_id', 'profile_id'
   );
  if lost is not null then
    raise exception 'live notifications_one_subject counts subjects 117 would drop: %', lost;
  end if;
end $$;

alter table public.notifications drop constraint notifications_one_subject;
alter table public.notifications add constraint notifications_one_subject
  check (num_nonnulls(tutorial_id, idea_id, toy_transaction_id, org_id, org_event_id, org_story_id,
                      org_conversation_id, profile_id) = 1);

do $$
declare
  def  text;
  lost text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint
   where conname = 'notifications_type_check' and conrelid = 'public.notifications'::regclass;
  if def is null then raise exception 'notifications_type_check is absent'; end if;
  select string_agg(distinct m[1], ', ') into lost
    from regexp_matches(def, '''([a-z_]+)''', 'g') as m
   where m[1] not in (
     'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
     'collaborator_removed', 'collaborator_left',
     'tutorial_approved', 'tutorial_rejected',
     'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message',
     'idea_approved', 'idea_rejected',
     'challenge_joined', 'challenge_left', 'challenge_removed',
     'idea_graduated', 'backing_requested', 'tutorial_submitted',
     'build_shot_posted', 'build_approved', 'print_started', 'print_ready',
     'tutorial_thanked',
     'org_event_published', 'org_story_published', 'org_message', 'org_thanked',
     'tutorial_noted',
     'challenge_guide_published', 'build_question',
     'profile_thanked'
   );
  if lost is not null then
    raise exception 'live notifications_type_check permits values 117 would drop: %', lost;
  end if;
end $$;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
    'collaborator_removed', 'collaborator_left',
    'tutorial_approved', 'tutorial_rejected',
    'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message',
    'idea_approved', 'idea_rejected',
    'challenge_joined', 'challenge_left', 'challenge_removed',
    'idea_graduated', 'backing_requested', 'tutorial_submitted',
    'build_shot_posted', 'build_approved', 'print_started', 'print_ready',
    'tutorial_thanked',
    'org_event_published', 'org_story_published', 'org_message', 'org_thanked',
    'tutorial_noted',
    'challenge_guide_published', 'build_question',
    -- new in 117
    'profile_thanked'
  ));
```

Run: `supabase migration up` → `Applying migration 117_profile_thanks.sql...`

- [ ] **Step 4: The routes**

In `packages/api/src/routes/contributors.ts`, add `import { INVALID_TEXT_REPRESENTATION } from '../supabase/pg-errors.js'` and append before `export default`:

```ts
/* ------------------------------------------------------------ thanks --
 *
 * 117. Thanking a person: once per person per person. The note is optional and
 * public nowhere; the byline is what they typed, never a name off a profile.
 * Mirrors organizations.ts's thanks routes.
 */
const PERSON_THANKS_COLUMNS = 'profile_id, thanker_id, note, byline, show_note, hidden_at, transaction_id, created_at'

contributors.post('/:id/thanks', async (c) => {
  const profileId = c.req.param('id')
  const userId = c.get('userId')
  if (profileId === userId) return c.json({ error: "You can't thank yourself" }, 403)
  const body = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  const byline = typeof body.byline === 'string' ? body.byline.trim() : ''
  if (note.length > 200) return c.json({ error: 'Keep the note to 200 characters.' }, 400)
  if (byline.length > 60) return c.json({ error: 'Keep the name to 60 characters.' }, 400)
  const txId = typeof body.transaction_id === 'string' ? body.transaction_id : null

  const admin = createAdminClient()
  // A thanks may name the exchange it was for, but only one the two of them
  // were the two sides of.
  if (txId) {
    const { data: tx, error } = await admin
      .from('toy_transactions')
      .select('requester_id, owner_id')
      .eq('id', txId)
      .maybeSingle()
    if (error && error.code !== INVALID_TEXT_REPRESENTATION) return c.json({ error: error.message }, 500)
    const sides = tx ? [tx.requester_id, tx.owner_id] : []
    if (!sides.includes(userId) || !sides.includes(profileId)) {
      return c.json({ error: 'That exchange is not between the two of you.' }, 400)
    }
  }

  const { error } = await createUserClient(c.get('token')).from('profile_thanks').insert({
    profile_id: profileId,
    thanker_id: userId,
    note: note || null,
    byline: byline || null,
    show_note: !!note && body.show_note === true,
  })
  if (error?.code === '23505') return c.json({ error: 'You already thanked them' }, 409)
  if (error?.code === '23503' || error?.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
  if (error) return c.json({ error: error.message }, 500)

  if (txId) {
    await admin.from('profile_thanks').update({ transaction_id: txId }).eq('profile_id', profileId).eq('thanker_id', userId)
  }
  // Logged, never thrown: the thanks has committed. The byline if they gave
  // one, else nobody — 066's and 077's reticence.
  const { error: notifyError } = await admin.from('notifications').insert({
    recipient_id: profileId,
    type: 'profile_thanked',
    ...(txId ? { toy_transaction_id: txId } : { profile_id: profileId }),
    actor_name: byline || 'A family',
  })
  if (notifyError) console.error('[contributors] thanks notify failed:', notifyError.message)

  const { data } = await admin.from('profiles').select('profile_thanks_count').eq('id', profileId).single()
  return c.json({ thanks_count: (data as { profile_thanks_count: number } | null)?.profile_thanks_count ?? 0 }, 201)
})

/** The thanks you have been given, to read and hide. */
contributors.get('/me/thanks', async (c) => {
  const { data, error } = await createUserClient(c.get('token'))
    .from('profile_thanks')
    .select(PERSON_THANKS_COLUMNS)
    .eq('profile_id', c.get('userId'))
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})

/** Hide or unhide a note you were given. hidden_at has no member grant — the
 *  service role writes it, scoped to the caller's own thanks. */
contributors.patch('/me/thanks/:thankerId', async (c) => {
  const body = ((await c.req.json().catch(() => null)) ?? {}) as { hidden?: unknown }
  if (typeof body.hidden !== 'boolean') return c.json({ error: 'hidden must be true or false' }, 400)
  const { data, error } = await createAdminClient()
    .from('profile_thanks')
    .update({ hidden_at: body.hidden ? new Date().toISOString() : null })
    .eq('profile_id', c.get('userId'))
    .eq('thanker_id', c.req.param('thankerId'))
    .select(PERSON_THANKS_COLUMNS)
    .maybeSingle()
  if (error && error.code !== INVALID_TEXT_REPRESENTATION) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})
```

In `public.ts`, `GET /contributors/:id`: add `profile_thanks_count` to the admin profile select (`'id, name, public_showcase, bio, featured_tutorial_id, created_at, profile_thanks_count'`) and change `const thanks = guides.reduce(...)` to:

```ts
  // Guide thanks (066) and thanks to the person (117): "Thanked {n} times".
  const thanks =
    guides.reduce((n, t) => n + (t.thanks_count ?? 0), 0) +
    ((profile as { profile_thanks_count?: number }).profile_thanks_count ?? 0)
```

In `packages/types/src/index.ts`: add `| 'profile_thanked'` to `NotificationType`; `profile_thanked: 'exchanges',` to `NOTIFICATION_BUCKET`; to `COPY`:

```ts
  // 117. Signed with the byline they typed, or "A family".
  profile_thanked: (n) => `${n.actor_name} said thanks to you`,
```

and to `interface Notification`, after `org_conversation_id?`:

```ts
  /** 117: a thanks sent from someone's showcase. A thanks for an exchange,
   *  print or build carries toy_transaction_id instead. */
  profile_id?: string | null
```

Links: in `packages/web/components/notifications-list.tsx` add to `ICON` `profile_thanked: [Handshake, 'var(--tamber)'],` and in `linkFor`, before `return '/notifications'`: `if (n.type === 'profile_thanked' && n.profile_id) return `/contributors/${n.profile_id}`` (a transaction-tied thanks already left through the `toy_transaction_id` branches above). In `packages/mobile/lib/notifications.ts`, before `return '/inbox'`: `if (n.type === 'profile_thanked' && n.profile_id) return `/guides/contributor/${n.profile_id}``. In `inbox-screen.tsx` `TYPE_TILE`, add `profile_thanked: { icon: 'heart-outline', tint: theme.colors.apricotSoft },`.

- [ ] **Step 5: The mobile button and its five places**

`packages/mobile/components/people/thank-button.tsx`:

```tsx
// packages/mobile/components/people/thank-button.tsx
/**
 * One-tap thanks, as the board draws it (MB sayThanks): a person through 117,
 * an organisation through 077. A thanks for an exchange, print or build names
 * the transaction so the person's notification opens it. The result is a
 * flash line beside the button — the app has no toast host.
 */
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { apiClient } from '../../lib/api-client'
import { useAuth } from '../../lib/auth-context'
import { Button } from '../ui/Button'
import { FlashLine, useFlash } from '../ui/Flash'

export type ThankTarget = { profileId: string } | { orgId: string }

export function ThankButton({
  label,
  to,
  transactionId,
  variant = 'secondary',
  style,
}: {
  label: string
  to: ThankTarget
  transactionId?: string
  variant?: 'secondary' | 'ghost'
  style?: StyleProp<ViewStyle>
}) {
  const router = useRouter()
  const { session } = useAuth()
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [message, flash] = useFlash()

  async function thank() {
    if (!session) return router.push('/sign-in')
    setBusy(true)
    try {
      if ('orgId' in to) await apiClient.post(`/api/organizations/${to.orgId}/thanks`, {})
      else await apiClient.post(`/api/contributors/${to.profileId}/thanks`, transactionId ? { transaction_id: transactionId } : {})
      setSent(true)
      flash('Thanks sent — they will see it in their notifications')
    } catch (err) {
      if (err instanceof Error && /status 409/.test(err.message)) {
        setSent(true)
        flash('You already thanked them')
      } else flash('Could not send that. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={style}>
      <Button label={label} variant={variant} loading={busy} disabled={sent || busy} onPress={() => void thank()} />
      <FlashLine message={message} />
    </View>
  )
}
```

Replace each `PendingButton pending="thank-people"` (and add the build thread's), importing `import { ThankButton } from '../people/thank-button'`:

- `toys/toy-detail-screen.tsx` — `toy.owner_id` is the person holder here:

```tsx
        {canAsk && !toy.owner_org_id && personName && toy.owner_id ? (
          <ThankButton label={`Thank ${personName}`} to={{ profileId: toy.owner_id }} style={styles.thank} />
```

  and update the comment above it to `{/* A person holder is thanked through 117, an organisation through 077. */}`.
- `exchanges/thread-screen.tsx`:

```tsx
          {tx.status === 'completed' ? (
            <ThankButton
              label={`Say thanks to ${otherPartyName}`}
              to={isOwner ? { profileId: tx.requester_id } : tx.owner_org_id ? { orgId: tx.owner_org_id } : { profileId: tx.owner_id! }}
              transactionId={tx.id}
            />
          ) : null}
```

- `printing/job-screen.tsx`, in the `collected` card — only the requester thanks the printer. `StateCard` needs `isPrinter` and the ids: pass `isPrinter={isPrinter}` from the screen and add `isPrinter: boolean` to `StateCard`'s props, then:

```tsx
        {!isPrinter ? (
          <ThankButton
            label="Say thanks to the printer"
            variant="ghost"
            to={tx.owner_org_id ? { orgId: tx.owner_org_id } : { profileId: tx.owner_id! }}
            transactionId={tx.id}
          />
        ) : null}
```

- `guides/showcase-screen.tsx` (MB:1151's label):

```tsx
          <ThankButton label="Say thanks" to={{ profileId: id }} />
```

  `firstName` is no longer used there — delete it if nothing else reads it.
- `builds/build-thread-screen.tsx`, after the messages list (`</View>` of `styles.log`), before the `build-thread-cost-panel` comment:

```tsx
          {tx.status === 'completed' && (tx.owner_id || tx.owner_org_id) ? (
            <ThankButton
              label={`Say thanks to ${otherName}`}
              to={c.isMaker ? { profileId: tx.requester_id } : tx.owner_org_id ? { orgId: tx.owner_org_id } : { profileId: tx.owner_id! }}
              transactionId={tx.id}
            />
          ) : null}
```

Delete any `PendingButton` import left unused (`grep -n "PendingButton" <file>`; the report buttons keep it until Task 11).

- [ ] **Step 6: The web ThanksButton, inline**

In `packages/web/components/thanks-button.tsx`, delete `import { useToast } from '@/components/toast'` and `const showToast = useToast()`, add `const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null)`, and replace the `try`/`catch` body and the returned button:

```tsx
    try {
      const res = await browserApiClient.post<{ thanks_count: number }>(`/api/tutorials/${tutorialId}/thanks`, {})
      setCount(res.thanks_count)
      setThanked(true)
      setSaid({ ok: true, text: 'Thanks sent — they will see it in their notifications' })
    } catch (err) {
      // 409: thanked already, from another tab. Say so rather than invite a
      // retry that can never succeed.
      if (isApiError(err) && err.status === 409) {
        setThanked(true)
        setSaid({ ok: true, text: 'You already thanked them' })
      } else setSaid({ ok: false, text: 'Could not send that. Try again.' })
    } finally {
      setPending(false)
    }
  }

  // Inline, not a toast: the public guide page mounts no ToastProvider, and
  // useToast without one is a silent no-op.
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={thank}
        disabled={thanked || pending}
        aria-label={thanked ? `Thanked. ${count} thanks` : `Say thanks. ${count} thanks so far`}
        className="btn btn-quiet btn-sm gap-2"
      >
        {heart}
        {thanked ? 'Thanked' : 'Say thanks'}
        <span className="tabular-nums text-muted">{count}</span>
      </button>
      {said && (
        <span role={said.ok ? 'status' : 'alert'} className={`text-sm font-semibold ${said.ok ? 'text-muted' : 'text-[var(--bad)]'}`}>
          {said.text}
        </span>
      )}
    </span>
  )
}
```

Update the file's header comment to say results show inline because the page has no toast provider.

- [ ] **Step 7: Guards**

In `scripts/check-schema-guards.sh`, add:

```sql
  -- 117. A thanks note is private to two people; RLS off would publish every
  -- one, and a thanker's update grant on hidden_at would let them undo a hide.
  ('117 profile_thanks has RLS enabled',
   (select coalesce(bool_and(relrowsecurity), false) from pg_class
      where relname = 'profile_thanks' and relnamespace = 'public'::regnamespace)),

  ('117 profile_thanks.hidden_at is not updatable by members',
   (select count(*) = 0 from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'profile_thanks'
        and column_name in ('hidden_at', 'transaction_id')
        and grantee in ('anon', 'authenticated')
        and privilege_type in ('UPDATE', 'INSERT'))),

  ('117 notifications_type_check permits profile_thanked',
   (select pg_get_constraintdef(oid) like '%profile_thanked%'
      from pg_constraint
     where conname = 'notifications_type_check'
       and conrelid = 'public.notifications'::regclass)),
```

- [ ] **Step 8: Run the tests to see them pass**

Run the three commands from Step 2 → PASS, then `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/toys tests/unit/components/exchanges tests/unit/components/printing tests/unit/components/builds tests/unit/components/guides` → PASS, `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/orgs/org-profile-social.test.ts tests/integration/public/contributor-profile.test.ts` → PASS (077's thanks and the old type list still work). `pnpm typecheck` → exit 0 (the web `ICON` record is exhaustive and fails without the new key).

- [ ] **Step 9: Ship the item**

All five `pending="thank-people"` are gone (`git grep -n 'thank-people' -- packages ':!**/pending-icons.ts'` → only tests). Set `shipped: true` on `'thank-people'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 10: Commit**

```bash
git status --short
git add supabase/migrations/117_profile_thanks.sql packages/api/src/routes/contributors.ts packages/api/src/routes/public.ts packages/types/src/index.ts packages/mobile/components/people/thank-button.tsx packages/mobile/components/toys/toy-detail-screen.tsx packages/mobile/components/exchanges/thread-screen.tsx packages/mobile/components/printing/job-screen.tsx packages/mobile/components/guides/showcase-screen.tsx packages/mobile/components/builds/build-thread-screen.tsx packages/mobile/lib/notifications.ts packages/mobile/components/inbox/inbox-screen.tsx packages/web/components/notifications-list.tsx packages/web/components/thanks-button.tsx scripts/check-schema-guards.sh packages/api/tests/integration/contributors/profile-thanks.test.ts packages/mobile/tests/unit/components/people/thank-button.test.tsx packages/web/tests/unit/components/thanks-button.test.tsx packages/mobile/tests/unit/components/toys/toy-detail-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(people): say thanks to a person — one tap, a notification, only the count public (117)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 11: Report a problem from five more mobile screens (`report-problem-mobile`, migration 118)

`member_reports.subject_kind` gains `'exchange'` and `'build'`. The mobile `ReportProblem` takes every kind, shows the board's "with {who}" and asks "OK to contact me about this" instead of sending `true` unasked. 065's insert policy checks only `reporter_id`, so a member could insert `status = 'resolved'` or a `note_to_reporter` straight through PostgREST; 118 narrows the insert to the reporter's own columns.

**Files:**
- Create: `supabase/migrations/118_member_report_kinds.sql`
- Modify: `packages/types/src/index.ts` (`REPORT_SUBJECT_KINDS`, `ReportSubjectKind`)
- Modify: `packages/api/src/routes/reports.ts`
- Modify: `packages/mobile/components/reports/report-problem.tsx`
- Modify: `packages/mobile/components/exchanges/thread-screen.tsx`, `packages/mobile/components/builds/build-thread-screen.tsx`, `packages/mobile/components/printing/job-screen.tsx`, `packages/mobile/components/guides/showcase-screen.tsx`, `packages/mobile/components/organisation/org-profile-screen.tsx`
- Modify: `scripts/check-schema-guards.sh`
- Test: `packages/api/tests/integration/admin/report-kinds.test.ts` (new), `packages/mobile/tests/unit/components/reports/report-problem.test.tsx` (new)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: `REPORT_SUBJECT_KINDS = ['guide', 'toy', 'person', 'organisation', 'print_job', 'exchange', 'build', 'other'] as const`, `type ReportSubjectKind`. `ReportProblem({ subjectKind: ReportSubjectKind; subjectId: string | null; subjectLabel: string; item?: string; who?: string })` — `subjectLabel` is what the admin queue shows, `item` the board's words in the sheet ("this exchange"), `who` the other party.

Copy (MB:1441–1451, 1675, 1226): "Tell SPLAT what happened" · "About {item} · with {who}. Goes to the SPLAT team only." · "OK to contact me about this" · items "this exchange", "this build", "this print job", "this profile", "{org} profile" · org line "Something wrong here? Report a problem. Goes to SPLAT only." The sheet's other strings are unchanged.

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/admin/report-kinds.test.ts`:

```ts
/** 118: exchanges and builds can be reported; a reporter writes only their own columns. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let member: TestUser

beforeAll(async () => {
  member = await createTestUser()
})

afterAll(async () => {
  await adminClient().from('member_reports').delete().eq('reporter_id', member.id)
  await deleteTestUser(member.id)
})

const file = (kind: string) =>
  app.request('/api/reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${member.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject_kind: kind, subject_label: 'Drum — exchange with Sam', category: 'no_show', body: 'Nobody came.', ok_to_contact: false }),
  })

describe('118 member report kinds', () => {
  it.each(['exchange', 'build', 'print_job', 'person', 'organisation'])('files a report about a %s', async (kind) => {
    expect((await file(kind)).status).toBe(201)
  })

  it('still refuses a kind nobody can report', async () => {
    expect((await file('thread')).status).toBe(400)
  })

  it('stores what the reporter said about being contacted', async () => {
    const res = await file('exchange')
    expect(((await res.json()) as { ok_to_contact: boolean }).ok_to_contact).toBe(false)
  })

  it('will not let a member file a report already marked resolved, below the API', async () => {
    const sb = createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '', {
      global: { headers: { Authorization: `Bearer ${member.token}` } },
      auth: { persistSession: false },
    })
    const { error } = await sb.from('member_reports').insert({
      reporter_id: member.id, subject_kind: 'toy', subject_label: 'x', category: 'other', body: 'x',
      status: 'resolved', note_to_reporter: 'Handled.',
    })
    expect(error).not.toBeNull()
  })
})
```

`packages/mobile/tests/unit/components/reports/report-problem.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ReportProblem } from '../../../../components/reports/report-problem'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))

beforeEach(() => {
  jest.clearAllMocks()
  mockPost.mockResolvedValue({})
})

describe('ReportProblem', () => {
  it('reports an exchange, says who with, and asks before it says OK to contact', async () => {
    render(<ReportProblem subjectKind="exchange" subjectId="tx1" subjectLabel="Drum — exchange with Northside" item="this exchange" who="Northside" />)
    fireEvent.press(screen.getByRole('button', { name: 'Report a problem' }))
    expect(screen.getByText('About this exchange · with Northside. Goes to the SPLAT team only.')).toBeTruthy()
    fireEvent.press(screen.getByRole('radio', { name: 'Didn’t show up' }))
    fireEvent.changeText(screen.getByLabelText('What happened?'), 'Nobody came.')
    // On by default, as the board draws it; the reporter can say no.
    fireEvent.press(screen.getByRole('button', { name: 'OK to contact me about this' }))
    fireEvent.press(screen.getByRole('button', { name: 'Send report' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/reports', {
        subject_kind: 'exchange',
        subject_id: 'tx1',
        subject_label: 'Drum — exchange with Northside',
        category: 'no_show',
        body: 'Nobody came.',
        ok_to_contact: false,
      })
    )
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/admin/report-kinds.test.ts` → FAIL (400 on `exchange`; the resolved insert succeeds).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/reports/report-problem.test.tsx` → FAIL.

- [ ] **Step 3: The migration**

`supabase/migrations/118_member_report_kinds.sql`:

```sql
-- 118 — report an exchange or a build (report-problem-mobile), and a reporter
-- writes only their own columns.
--
-- The mobile sheet now opens from an exchange thread and a build thread, so
-- subject_kind gains 'exchange' and 'build'. Guarded like 046: abort rather
-- than drop a kind the live check permits.
--
-- 065's insert policy checks reporter_id only, so a member could file a report
-- already 'resolved', with a note_to_reporter and a handled_by of their
-- choosing, straight through PostgREST. The insert grant narrows to what a
-- reporter says; status and the handling columns are an admin's (065's
-- update policy, unchanged).
--
-- DOWN:
--   grant insert on public.member_reports to authenticated;
--   alter table public.member_reports drop constraint member_reports_subject_kind_check;
--   alter table public.member_reports add constraint member_reports_subject_kind_check
--     check (subject_kind in ('guide', 'toy', 'person', 'organisation', 'print_job', 'other'));

do $$
declare
  def  text;
  lost text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint
   where conname = 'member_reports_subject_kind_check' and conrelid = 'public.member_reports'::regclass;
  if def is null then raise exception 'member_reports_subject_kind_check is absent'; end if;
  select string_agg(distinct m[1], ', ') into lost
    from regexp_matches(def, '''([a-z_]+)''', 'g') as m
   where m[1] not in ('guide', 'toy', 'person', 'organisation', 'print_job', 'exchange', 'build', 'other');
  if lost is not null then
    raise exception 'live member_reports_subject_kind_check permits values 118 would drop: %', lost;
  end if;
end $$;

alter table public.member_reports drop constraint member_reports_subject_kind_check;
alter table public.member_reports add constraint member_reports_subject_kind_check
  check (subject_kind in ('guide', 'toy', 'person', 'organisation', 'print_job', 'exchange', 'build', 'other'));

revoke insert on public.member_reports from anon, authenticated;
grant insert (reporter_id, subject_kind, subject_label, subject_id, category, body, ok_to_contact)
  on public.member_reports to authenticated;
```

Run: `supabase migration up` → `Applying migration 118_member_report_kinds.sql...`

- [ ] **Step 4: The kinds, once**

In `packages/types/src/index.ts`, near the member-report types:

```ts
/** What a member report can be about (065, widened in 118). */
export const REPORT_SUBJECT_KINDS = ['guide', 'toy', 'person', 'organisation', 'print_job', 'exchange', 'build', 'other'] as const
export type ReportSubjectKind = (typeof REPORT_SUBJECT_KINDS)[number]
```

In `packages/api/src/routes/reports.ts`, import it and replace `const SUBJECT_KINDS = new Set([...])` with `const SUBJECT_KINDS = new Set<string>(REPORT_SUBJECT_KINDS)`.

- [ ] **Step 5: The sheet**

In `report-problem.tsx`:
- Import `type ReportSubjectKind` from `@splat-connect/types`.
- Props:

```tsx
export function ReportProblem({
  subjectKind,
  subjectId,
  subjectLabel,
  item,
  who,
}: {
  subjectKind: ReportSubjectKind
  subjectId: string | null
  /** What the admin queue shows. */
  subjectLabel: string
  /** The board's words in the sheet ("this exchange"); the label when absent. */
  item?: string
  /** The other party, when there is one (MB repWho). */
  who?: string
}) {
```

- State: `const [contact, setContact] = useState(true)` (the board's default, MB:1675 `contact:true`); reset it in `start()` with `setContact(true)`.
- In the post, `ok_to_contact: contact`.
- The sub line: ``{`About ${item ?? subjectLabel}${who ? ` · with ${who}` : ''}. Goes to the SPLAT team only.`}``.
- After the `TextField`, before the error:

```tsx
                  <Chip
                    label="OK to contact me about this"
                    active={contact}
                    onPress={() => setContact(!contact)}
                  />
```

- [ ] **Step 6: The five screens**

Import `import { ReportProblem } from '../reports/report-problem'` in each and replace its `PendingButton pending="report-problem-mobile"`:

- `exchanges/thread-screen.tsx`:
  `<ReportProblem subjectKind="exchange" subjectId={tx.id} subjectLabel={`${tx.toy_name} — exchange with ${otherPartyName}`} item="this exchange" who={otherPartyName} />`
- `builds/build-thread-screen.tsx`:
  `<ReportProblem subjectKind="build" subjectId={tx.id} subjectLabel={`${tx.toy_name ?? 'A build'} — build with ${otherName}`} item="this build" who={otherName} />`
- `printing/job-screen.tsx` (in `StateCard`'s collected card; it already has `tx`, and `other` is computed in the screen — pass `other` into `StateCard` alongside `isPrinter`):
  `<ReportProblem subjectKind="print_job" subjectId={tx.id} subjectLabel={`Print job with ${other}`} item="this print job" who={other} />`
- `guides/showcase-screen.tsx` (person only, where the button was):
  `<ReportProblem subjectKind="person" subjectId={id} subjectLabel={profile.name} item="this profile" who={profile.name} />`
- `organisation/org-profile-screen.tsx` — the board's sentence (MB:1226):

```tsx
      <View style={styles.reportLine}>
        <Text style={styles.reportText}>Something wrong here? </Text>
        <ReportProblem subjectKind="organisation" subjectId={org.id} subjectLabel={org.name} item={`${org.name} profile`} />
        <Text style={styles.reportText}>. Goes to SPLAT only.</Text>
      </View>
```

  with styles `reportLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: theme.spacing(4) }` and `reportText: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted }`.

Remove each now-unused `PendingButton` import (`grep -n "PendingButton" <file>` — `job-screen.tsx` keeps it for `print-fit-feedback`).

- [ ] **Step 7: Guards**

In `scripts/check-schema-guards.sh`:

```sql
  -- 118. A member writing status or note_to_reporter on their own report would
  -- forge the admin's answer; nothing in the product would look different.
  ('118 member_reports.status/note_to_reporter are not insertable by members',
   (select count(*) = 0 from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'member_reports'
        and column_name in ('status', 'note_to_reporter', 'handled_by', 'handled_at')
        and grantee in ('anon', 'authenticated')
        and privilege_type = 'INSERT')),
```

- [ ] **Step 8: Run the tests to see them pass**

Run the two commands from Step 2 → PASS, plus `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/admin/queues.test.ts` → PASS (the route's own insert still works under the narrowed grant), and `pnpm --filter @splat-connect/mobile exec jest tests/unit/components` → PASS. `pnpm typecheck` → exit 0.

- [ ] **Step 9: Ship the item**

`git grep -n 'report-problem-mobile' -- packages ':!**/pending-icons.ts'` → none. Set `shipped: true` on `'report-problem-mobile'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 10: Commit**

```bash
git status --short
git add supabase/migrations/118_member_report_kinds.sql packages/types/src/index.ts packages/api/src/routes/reports.ts packages/mobile/components/reports/report-problem.tsx packages/mobile/components/exchanges/thread-screen.tsx packages/mobile/components/builds/build-thread-screen.tsx packages/mobile/components/printing/job-screen.tsx packages/mobile/components/guides/showcase-screen.tsx packages/mobile/components/organisation/org-profile-screen.tsx scripts/check-schema-guards.sh packages/api/tests/integration/admin/report-kinds.test.ts packages/mobile/tests/unit/components/reports/report-problem.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(reports): report an exchange, build, print job, person or organisation from the app (118)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 12: A second line on each notification (`notification-second-line`, migration 119)

`notifications.body text` (≤ 300). Writers with a reason fill it: a guide returned by an admin (`tutorials.rejection_note` — "follows the code" 4), an idea declined (`review_note`), an exchange or print declined (`decline_reason`), and an exchange/build/print message (the message itself, as MB's exchange rows show). Every body goes on exactly one recipient's row. A longer reason is cut to 300 with an ellipsis, never refused — a refused insert silently drops the notification (the writers log and move on).

**Files:**
- Create: `supabase/migrations/119_notification_body.sql`
- Modify: `packages/types/src/index.ts` (`Notification.body`, `notificationBody`, `notificationSecondLine`)
- Modify: `packages/api/src/routes/admin.ts` (tutorial status, idea status), `packages/api/src/routes/toy-transactions.ts` (decline, messages)
- Modify: `packages/mobile/components/inbox/inbox-screen.tsx`, `packages/web/components/notifications-list.tsx`
- Test: `packages/web/tests/unit/lib/notification-second-line.test.ts` (new), `packages/api/tests/integration/notifications/body.test.ts` (new)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: `notificationBody(text: string | null | undefined): string | null` (trimmed, blank → null, over 300 → 299 chars + "…"); `notificationSecondLine(n: Notification, date: (iso: string) => string): string | null` — `n.body`, else "{subject} · {date}" where subject is `tutorial_title || toy_name`, else just the date.

Copy (MB:1836–1841, MB:2570–2572): second lines are the reason or message itself, else "{subject} · {date}" ("Fan with a proximity switch · 19 Aug").

- [ ] **Step 1: Write the failing tests**

`packages/web/tests/unit/lib/notification-second-line.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { notificationBody, notificationSecondLine, type Notification } from '@splat-connect/types'

const n = (over: Partial<Notification>): Notification => ({
  id: 'n1', recipient_id: 'r', type: 'tutorial_rejected', actor_name: 'SPLAT', read_at: null,
  created_at: '2026-08-19T03:00:00Z', ...over,
})
const day = () => '19 Aug'

describe('notificationBody', () => {
  it('trims, and stores a blank reason as nothing', () => {
    expect(notificationBody('  step 4 needs the wire named.  ')).toBe('step 4 needs the wire named.')
    expect(notificationBody('   ')).toBeNull()
    expect(notificationBody(null)).toBeNull()
  })
  it('cuts a long reason to 300 with an ellipsis rather than refusing it', () => {
    const out = notificationBody('x'.repeat(500))!
    expect(out).toHaveLength(300)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('notificationSecondLine', () => {
  it('shows the reason when there is one', () => {
    expect(notificationSecondLine(n({ body: 'Step 4 needs the wire named.', tutorial_title: 'Fan' }), day)).toBe('Step 4 needs the wire named.')
  })
  it('falls back to "{subject} · {date}"', () => {
    expect(notificationSecondLine(n({ tutorial_title: 'Fan with a proximity switch' }), day)).toBe('Fan with a proximity switch · 19 Aug')
    expect(notificationSecondLine(n({ type: 'toy_accepted', toy_name: 'Bubble machine' }), day)).toBe('Bubble machine · 19 Aug')
  })
  it('is just the date when the row names nothing', () => {
    expect(notificationSecondLine(n({ type: 'idea_approved', tutorial_title: '' }), day)).toBe('19 Aug')
  })
})
```

`packages/api/tests/integration/notifications/body.test.ts`:

```ts
/** 119: a returned guide and a declined idea carry their reason to the one person they are about. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let admin: TestUser
let author: TestUser
let maker: TestUser
let tutorialId: string
let ideaId: string

const as = (token: string, method: string, body: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

beforeAll(async () => {
  const sb = adminClient()
  ;[admin, author, maker] = await Promise.all([createTestUser('admin'), createTestUser(), createTestUser()])
  const { data: t } = await sb.from('tutorials').insert({ title: 'Fan', difficulty: 'easy', status: 'pending' }).select('id').single()
  tutorialId = t!.id
  await sb.from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: author.id, role: 'primary' })
  const { data: i } = await sb.from('toy_ideas').insert({ author_id: author.id, title: 'Spoon', summary: 'Grip.', status: 'pending' }).select('id').single()
  ideaId = i!.id
})

afterAll(async () => {
  const sb = adminClient()
  await sb.from('notifications').delete().in('recipient_id', [author.id, maker.id])
  await sb.from('tutorials').delete().eq('id', tutorialId)
  await sb.from('toy_ideas').delete().eq('id', ideaId)
  await Promise.all([admin, author, maker].map((u) => deleteTestUser(u.id)))
})

describe('119 notification body', () => {
  it('the column exists', async () => {
    const { error } = await adminClient().from('notifications').select('body').limit(1)
    expect(error).toBeNull()
  })

  it("carries a returned guide's reason, cut to 300", async () => {
    const reason = 'Step 4 does not say which wire goes to the tip. '.repeat(10)
    const res = await app.request(`/api/admin/tutorials/${tutorialId}/status`, as(admin.token, 'PATCH', { status: 'rejected', rejection_note: reason }))
    expect(res.status).toBe(200)
    const { data } = await adminClient().from('notifications').select('body').eq('recipient_id', author.id).eq('type', 'tutorial_rejected').single()
    expect(data!.body).toHaveLength(300)
    expect(data!.body!.startsWith('Step 4 does not say which wire')).toBe(true)
  })

  it("puts a declined idea's private reason on the author's row and nobody else's", async () => {
    const res = await app.request(`/api/admin/ideas/${ideaId}/status`, as(admin.token, 'PATCH', { status: 'rejected', review_note: 'Too close to an existing guide.' }))
    expect(res.status).toBe(200)
    const { data } = await adminClient().from('notifications').select('recipient_id, body').eq('idea_id', ideaId)
    expect(data).toEqual([{ recipient_id: author.id, body: 'Too close to an existing guide.' }])
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/notification-second-line.test.ts` → FAIL (not exported).
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/notifications/body.test.ts` → FAIL (`column notifications.body does not exist`).

- [ ] **Step 3: The migration**

`supabase/migrations/119_notification_body.sql`:

```sql
-- 119 — a second line on a notification (notification-second-line).
--
-- The reason, when the writer has one: a returned guide's rejection_note, a
-- declined idea's review_note, a declined exchange or print's decline_reason,
-- or the message an exchange notice is about. It goes on the one recipient's
-- row and nowhere else. Writers cut it to 300 (notificationBody) rather than
-- let the CHECK refuse the insert, because every writer logs and moves on —
-- a refused row is a notification nobody ever sees.
--
-- DOWN:
--   alter table public.notifications drop column if exists body;

alter table public.notifications
  add column body text check (body is null or length(body) between 1 and 300);
```

Run: `supabase migration up` → `Applying migration 119_notification_body.sql...`

- [ ] **Step 4: The helpers**

In `packages/types/src/index.ts`, add `body?: string | null` to `interface Notification` (after `actor_name`, with `/** 119: the reason or message, ≤ 300. */`), and after `copyFor`:

```ts
/** A reason or message cut to fit 119's 300-character body: trimmed, blank →
 *  null, too long → 299 characters and an ellipsis. Never refused. */
export function notificationBody(text: string | null | undefined): string | null {
  const t = (text ?? '').trim()
  if (!t) return null
  return t.length > 300 ? `${t.slice(0, 299)}…` : t
}

/** A card's second line: the body, else "{subject} · {date}" (MB notifications).
 *  The date formatter is the caller's — mobile formats its own (Hermes). */
export function notificationSecondLine(n: Notification, date: (iso: string) => string): string | null {
  if (n.body) return n.body
  const subject = n.tutorial_title || n.toy_name || null
  return [subject, date(n.created_at)].filter(Boolean).join(' · ') || null
}
```

- [ ] **Step 5: The writers**

Import `notificationBody` from `@splat-connect/types` in both files.

`admin.ts`, `PATCH /tutorials/:id/status` — in the insert map, add after `actor_name: 'SPLAT',`:

```ts
          // 119: the reason a guide came back, to its contributors only.
          body: body.status === 'approved' ? null : notificationBody(body.rejection_note),
```

`admin.ts`, `PATCH /ideas/:id/status` — in the notification insert, add `body: status === 'challenge' ? null : notificationBody(reviewNote),` (the recipient is `data.author_id` alone).

`toy-transactions.ts`, the decline handler — in its `notifications.insert({ … type: 'toy_rejected' … })`, add `body: notificationBody(reason),`.

`toy-transactions.ts`, `POST /:id/messages` — in `const payload = { … }`, add `body: notificationBody(body.body),`. Each recipient is a party to this transaction (the requester, or the owner side through `notifyOwnerSide`), so the message reaches nobody outside it.

Run: `grep -n "type: 'toy_rejected'\|type: 'tutorial_rejected'\|type: status === 'challenge'" packages/api/src/routes/*.ts` and confirm each insert above was the one edited. Leave the auto-declined rivals (no reason) and account deletion alone.

- [ ] **Step 6: The two readers**

`packages/mobile/components/inbox/inbox-screen.tsx`: import `notificationSecondLine` from `@splat-connect/types`; delete the `PENDING(notification-second-line)` comment; in `noteCard`, add to `<InboxCard>`:

```tsx
        body={notificationSecondLine(n, (iso) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }))}
```

`packages/web/components/notifications-list.tsx`: import `notificationSecondLine, shortDate`; after the title `</button>` inside `<div className="min-w-0 flex-1">`, add:

```tsx
              {notificationSecondLine(n, shortDate) && (
                <p className="mt-0.5 text-sm leading-normal text-muted">{notificationSecondLine(n, shortDate)}</p>
              )}
```

Run: `grep -rn "\.body" packages/mobile/components/inbox` → the exchange preview (`last.body`) and this line only.

- [ ] **Step 7: Run the tests to see them pass**

Run the two commands from Step 2 → PASS; `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/inbox` → PASS; `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/notifications-list.test.tsx` → PASS (add `body: null` to its fixtures only if a type error says so). `pnpm typecheck` → exit 0.

- [ ] **Step 8: Ship the item**

Set `shipped: true` on `'notification-second-line'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 9: Commit**

```bash
git status --short
git add supabase/migrations/119_notification_body.sql packages/types/src/index.ts packages/api/src/routes/admin.ts packages/api/src/routes/toy-transactions.ts packages/mobile/components/inbox/inbox-screen.tsx packages/web/components/notifications-list.tsx packages/web/tests/unit/lib/notification-second-line.test.ts packages/api/tests/integration/notifications/body.test.ts packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(notifications): the reason or message as a second line, to its one recipient (119)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---
## Slice 4

### Task 13: Makers wanted under "Give us a challenge", Recycling under Explore (`me-rows-structure`)

Decided 2026-09-30: follow the board in the shared nav model. MB (2774, 2778) puts "Makers wanted" in "Give us a challenge" and "Recycling" first under Explore. Because `buildNav` is shared, the web hub follows: its hand-spliced "Build for a family" card now comes from the model (relabelled by the hub's `LABELS`, as WB names it), and "Recycle plastic" leaves My SPLAT (it stays in the public header's Get involved). WB keeps the Recycle card — "follows the code" 20, flagged.

**Files:**
- Modify: `packages/types/src/nav-model.ts`
- Modify: `packages/mobile/lib/my-routes.ts`, `packages/mobile/app/(tabs)/me.tsx`
- Modify: `packages/web/app/dashboard/page.tsx`
- Test: `packages/web/tests/unit/lib/nav-model.test.ts`, `packages/mobile/tests/unit/lib/my-routes.test.ts`, `packages/mobile/tests/unit/app/me.test.tsx`, `packages/web/tests/unit/pages/dashboard-hub.test.tsx` (all updated)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: `buildNav` emits `{ href: '/get-involved/makers-wanted', label: 'Makers wanted', icon: 'wrench' }` as the third row of "Give us a challenge", and no `/get-involved/recycling` row. Task 14 adds counts to these rows.

Copy (MB:2774, 2778): "Makers wanted" · Explore row "Recycling". Web keeps WB's "Build for a family" (WB:8808, 8863).

- [ ] **Step 1: Write the failing tests**

`packages/web/tests/unit/lib/nav-model.test.ts`:
- In 'keeps only account destinations, aside from two named public ones', change `const outward = ['/get-involved/submit-an-idea', '/get-involved/recycling']` to `const outward = ['/get-involved/submit-an-idea', '/get-involved/makers-wanted']` and the Chain comment's Recycle sentence to: "Makers wanted has one too — the open requests board is public (me-rows-structure, 2026-09-30)."
- Append:

```ts
  // Decided 2026-09-30 (me-rows-structure): the board's Me puts Makers wanted
  // under Give us a challenge, and Recycling under Explore — not in the model.
  it('lists Makers wanted under Give us a challenge, and no recycling row', () => {
    const challenge = buildNav(caps()).find((g) => g.heading === 'Give us a challenge')!
    expect(challenge.rows.map((r) => r.label)).toEqual(['Design challenges', 'Submit an idea', 'Makers wanted'])
    expect(challenge.rows[2].href).toBe('/get-involved/makers-wanted')
    expect(hrefs(buildNav(caps()))).not.toContain('/get-involved/recycling')
  })
```

  ('builds twenty-one linked rows for a leader-admin' still holds: one row in, one out. Add to its comment: "Still twenty-one after me-rows-structure: Makers wanted in, Recycle plastic out.")

`packages/mobile/tests/unit/lib/my-routes.test.ts`, second test — replace `expect(myRoute('/get-involved/recycling')).toBe('/explore/recycling')` with `expect(myRoute('/get-involved/makers-wanted')).toBe('/explore/makers-wanted')`.

`packages/mobile/tests/unit/app/me.test.tsx`, append:

```tsx
it('opens Makers wanted from Give us a challenge, and Recycling from Explore', () => {
  render(<MeTab />)
  mockPush.mockClear()
  fireEvent.press(screen.getByLabelText('Makers wanted'))
  expect(mockPush).toHaveBeenCalledWith('/explore/makers-wanted')
  fireEvent.press(screen.getByLabelText('Recycling'))
  expect(mockPush).toHaveBeenCalledWith('/explore/recycling')
  expect(screen.queryByLabelText('Recycle plastic')).toBeNull()
})
```

`packages/web/tests/unit/pages/dashboard-hub.test.tsx`:
- 'renders twelve cards for a plain account' → rename to 'renders eleven cards for a plain account', expect `toHaveLength(11)`, and add to its comment "eleven since me-rows-structure moved Recycle plastic to the public header".
- Append:

```tsx
  it('draws Build for a family from the shared model, and no Recycle plastic card', async () => {
    render(await DashboardHub())
    expect(screen.getByRole('link', { name: /Build for a family/ })).toHaveAttribute('href', '/get-involved/makers-wanted')
    expect(screen.queryByRole('link', { name: /Recycle plastic/ })).toBeNull()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/nav-model.test.ts tests/unit/pages/dashboard-hub.test.tsx` → FAIL.
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/lib/my-routes.test.ts tests/unit/app/me.test.tsx` → FAIL.

- [ ] **Step 3: The model**

In `packages/types/src/nav-model.ts`:
- In the "Give us a challenge" group, after the Submit an idea row:

```ts
        // me-rows-structure (decided 2026-09-30): the board's Me lists the open
        // build requests here. A public page, like Submit an idea.
        { href: '/get-involved/makers-wanted', label: 'Makers wanted', icon: 'wrench' },
```

- In "Out in the world", delete the Recycle plastic row and its comment (the group keeps My events).
- In the header comment, replace `- components/rail.tsx: the only consumer` with `- app/dashboard/page.tsx (web My SPLAT) and app/(tabs)/me.tsx (mobile Me): the two consumers`, and the sentence about `components/rail.tsx renders every row through BoundaryLink` with `the hub renders every row through BoundaryLink`.

- [ ] **Step 4: Mobile**

`packages/mobile/lib/my-routes.ts`: replace the two `/get-involved/recycling` lines (comment and entry) with:

```ts
  // The open build requests: a public page on web, an Explore screen here.
  '/get-involved/makers-wanted': '/explore/makers-wanted',
```

`packages/mobile/app/(tabs)/me.tsx`:
- Delete the two lines `{/* PENDING(me-rows-structure): … */}` and `<PendingRow pending="me-rows-structure" label="Makers wanted" icon="hammer-outline" />`, and the `PendingRow` import.
- `EXPLORE` gets Recycling first, in the board's order (MB:2778):

```tsx
const EXPLORE: { label: string; href: string; icon: Glyph }[] = [
  { label: 'Recycling', href: '/explore/recycling', icon: 'leaf-outline' },
  { label: 'Learn', href: '/explore/learn', icon: 'school-outline' },
```

(the rest unchanged).

- [ ] **Step 5: Web**

In `packages/web/app/dashboard/page.tsx`:
- Delete the splice and its comment's last two sentences:

```tsx
  const exchangesAt = rows.findIndex((row) => row.href === '/dashboard/exchanges')
  rows.splice(exchangesAt + 1, 0, { href: BUILD_HREF, label: 'Build for a family', icon: 'wrench' })
```

  and rewrite the comment above `const rows = buildNav(caps)` to: "Built from the same model as mobile's Me, so a destination cannot exist in one and not the other. "Submit an idea" is a public route Design challenges already leads to, so it is a line on that card instead."
- `LABELS` gains WB's name for the maker's card: `[BUILD_HREF]: 'Build for a family',`.
- Remove `'/get-involved/recycling'` from `ORDER`, `TINTS` and `blurbs`.

- [ ] **Step 6: Run the tests to see them pass**

Run the two commands from Step 2 → PASS. Also `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/capabilities.test.ts` → PASS. `pnpm typecheck` → exit 0.

- [ ] **Step 7: Ship the item**

Set `shipped: true` on `'me-rows-structure'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 8: Commit**

```bash
git status --short
git add packages/types/src/nav-model.ts packages/mobile/lib/my-routes.ts "packages/mobile/app/(tabs)/me.tsx" packages/web/app/dashboard/page.tsx packages/web/tests/unit/lib/nav-model.test.ts packages/mobile/tests/unit/lib/my-routes.test.ts packages/mobile/tests/unit/app/me.test.tsx packages/web/tests/unit/pages/dashboard-hub.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(me): Makers wanted under Give us a challenge, Recycling under Explore, in the shared nav model

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 14: Counts on My SPLAT (`me-count-badges`)

One call, `GET /api/me/counts`, parallel head counts with the caller's own client. `buildNav(caps, counts)` puts them on the rows. Definitions (the spec names the rows; these are the rules, flagged where the spec is silent):

| Row | Count |
|---|---|
| My tutorials | your guides sent back (`status = 'rejected'`) — the ones waiting on you |
| Design challenges | your ideas pending or live, plus live challenges you joined |
| Makers wanted | open build requests (`type = 'build'`, `requested`, no maker) from anyone else |
| My print requests | your print jobs `requested` or `accepted` |
| Print for others | jobs `requested` on printers you own |
| Review queue | backings of your organisations that are `pending`, or `accepted` on a still-pending guide (web's rule) |
| Recycling intake | drop-offs `booked` at your organisations |
| Print orders | jobs `requested` on your organisations' printers |

A count whose query fails is logged and reads 0 — one bad table does not take the Me tab down. Web keeps its unread-based badges on My tutorials, My exchanges, Design challenges and Notifications (they clear on read, by design — `dashboard/page.tsx`), and takes the other five from the model, deleting the four fetches it computed them from.

**Files:**
- Modify: `packages/api/src/routes/me.ts` (`GET /counts`)
- Modify: `packages/types/src/nav-model.ts` (`MeCounts`, `buildNav(caps, counts?)`)
- Modify: `packages/mobile/app/(tabs)/me.tsx`, `packages/web/app/dashboard/page.tsx`
- Test: `packages/api/tests/integration/me/counts.test.ts` (new), `packages/web/tests/unit/lib/nav-model.test.ts`, `packages/mobile/tests/unit/app/me.test.tsx`, `packages/web/tests/unit/pages/dashboard-hub.test.tsx` (updated)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: Task 13's Makers wanted row.
- Produces: `type MeCounts = { tutorials: number; challenges: number; makers: number; printRequests: number; printJobs: number; review: number; intake: number; orgOrders: number }` exported from `@splat-connect/types`; `buildNav(caps: Capabilities, counts?: MeCounts): NavGroup[]`; `GET /api/me/counts → MeCounts`.

Copy: badges are numbers only (MB:2772–2777).

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/me/counts.test.ts`:

```ts
/** me-count-badges: one call, every count scoped to the caller. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let me: TestUser
let family: TestUser
let fresh: TestUser
const tutorialIds: string[] = []
let ideaId: string

const counts = async (token: string) =>
  (await (await app.request('/api/me/counts', { headers: { Authorization: `Bearer ${token}` } })).json()) as Record<string, number>

beforeAll(async () => {
  const sb = adminClient()
  ;[me, family, fresh] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
  for (const status of ['rejected', 'draft'] as const) {
    const { data } = await sb.from('tutorials').insert({ title: `Mine ${status}`, difficulty: 'easy', status }).select('id').single()
    tutorialIds.push(data!.id)
    await sb.from('tutorial_contributors').insert({ tutorial_id: data!.id, profile_id: me.id, role: 'primary' })
  }
  const { data: idea } = await sb.from('toy_ideas').insert({ author_id: me.id, title: 'Idea', summary: 'S', status: 'pending' }).select('id').single()
  ideaId = idea!.id
  // An open build from someone else, and one of my own (not counted for me).
  await sb.from('toy_transactions').insert([
    { type: 'build', status: 'requested', tutorial_id: tutorialIds[0], build_brief: 'For Leo.', requester_id: family.id, travel_km: 10 },
    { type: 'build', status: 'requested', tutorial_id: tutorialIds[0], build_brief: 'Mine.', requester_id: me.id, travel_km: 10 },
  ])
})

afterAll(async () => {
  const sb = adminClient()
  await sb.from('toy_transactions').delete().in('requester_id', [me.id, family.id])
  await sb.from('tutorials').delete().in('id', tutorialIds)
  await sb.from('toy_ideas').delete().eq('id', ideaId)
  await Promise.all([me, family, fresh].map((u) => deleteTestUser(u.id)))
})

describe('GET /api/me/counts', () => {
  it("counts what is waiting on this account and nobody else's", async () => {
    expect(await counts(me.token)).toMatchObject({ tutorials: 1, challenges: 1, makers: 1, printRequests: 0, printJobs: 0, review: 0, intake: 0, orgOrders: 0 })
  })

  it('is all zeros for an account with nothing, and makers counts every open request', async () => {
    expect(await counts(fresh.token)).toMatchObject({ tutorials: 0, challenges: 0, makers: 2, review: 0, intake: 0, orgOrders: 0 })
  })

  it('needs a session', async () => {
    expect((await app.request('/api/me/counts')).status).toBe(401)
  })
})
```

(If 064's checks need more columns on an open build than `travel_km`, copy them from `tests/integration/toy-transactions` fixtures for `type: 'build'`.)

`packages/web/tests/unit/lib/nav-model.test.ts`, append:

```ts
  it('puts each count on its row, and none where the count is zero', () => {
    const rows = buildNav(caps({ ledOrgs: [org] }), {
      tutorials: 2, challenges: 1, makers: 3, printRequests: 1, printJobs: 0, review: 5, intake: 2, orgOrders: 1,
    }).flatMap((g) => g.rows)
    const at = (href: string) => rows.find((r) => r.href === href)?.count
    expect(at('/dashboard/tutorials')).toBe(2)
    expect(at('/dashboard/challenges')).toBe(1)
    expect(at('/get-involved/makers-wanted')).toBe(3)
    expect(at('/dashboard/print-requests')).toBe(1)
    expect(at('/dashboard/printers')).toBeUndefined()
    expect(at('/dashboard/organisation')).toBe(5)
    expect(at('/dashboard/organisation/recycling')).toBe(2)
    expect(at('/dashboard/organisation/orders')).toBe(1)
  })

  it('leaves every row uncounted when no counts are given', () => {
    expect(buildNav(caps()).flatMap((g) => g.rows).filter((r) => r.count !== undefined).map((r) => r.href)).toEqual([])
  })
```

`packages/mobile/tests/unit/app/me.test.tsx`: in `beforeEach`, make `/api/me/counts` answer:

```tsx
  mockGet.mockImplementation((p: string) =>
    Promise.resolve(
      p === '/api/me/builds'
        ? { builds: 3 }
        : p === '/api/me/counts'
          ? { tutorials: 0, challenges: 0, makers: 7, printRequests: 0, printJobs: 0, review: 6, intake: 0, orgOrders: 0 }
          : { lines: [], total_cents: 0, exchange_count: 0 }
    )
  )
```

and append:

```tsx
it('badges the rows from one counts call, and still renders without it', async () => {
  render(<MeTab />)
  expect(await screen.findByText('7')).toBeTruthy()
  expect(screen.getByText('6')).toBeTruthy()
  expect(mockGet).toHaveBeenCalledWith('/api/me/counts')
})

it('renders every row uncounted when the counts call fails', async () => {
  mockGet.mockImplementation((p: string) =>
    p === '/api/me/counts' ? Promise.reject(new Error('500')) : Promise.resolve({ lines: [], total_cents: 0, exchange_count: 0 })
  )
  render(<MeTab />)
  expect(await screen.findByLabelText('Makers wanted')).toBeTruthy()
  expect(screen.queryByText('7')).toBeNull()
})
```

`packages/web/tests/unit/pages/dashboard-hub.test.tsx`: in the `apiClient` mock, answer `/api/me/counts`:

```tsx
    get: async (path: string) =>
      path === '/api/exchange-costs/outstanding'
        ? money.current
        : path === '/api/me/counts'
          ? meCounts.current
          : [],
```

with `const meCounts = vi.hoisted(() => ({ current: { tutorials: 0, challenges: 0, makers: 4, printRequests: 0, printJobs: 0, review: 0, intake: 0, orgOrders: 0 } }))`, and append:

```tsx
  it('badges Build for a family from the counts call', async () => {
    render(await DashboardHub())
    expect(screen.getByRole('link', { name: /Build for a family/ })).toHaveTextContent('4')
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/me/counts.test.ts` → FAIL (404).
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/nav-model.test.ts tests/unit/pages/dashboard-hub.test.tsx` → FAIL.
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/app/me.test.tsx` → FAIL.

- [ ] **Step 3: The route**

In `packages/api/src/routes/me.ts`, after `GET /builds`:

```ts
/**
 * me-count-badges: every number on My SPLAT in one call. Each is a head count
 * through the caller's own client, so RLS scopes it exactly as the list it
 * badges. A count whose query fails is logged and reads 0: one bad table must
 * not take the whole tab down.
 */
me.get('/counts', async (c) => {
  const sb = createUserClient(c.get('token'))
  const uid = c.get('userId')
  const head = { count: 'exact', head: true } as const
  const n = async (label: string, q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count, error } = await q
    if (error) {
      console.error(`[me/counts] ${label} failed:`, error.message)
      return 0
    }
    return count ?? 0
  }

  const { data: led } = await sb.from('org_leaders').select('org_id').eq('user_id', uid)
  const orgIds = (led ?? []).map((r) => r.org_id as string)
  const { data: printers } = await sb
    .from('printers')
    .select('id, owner_id')
    .or(orgIds.length ? `owner_id.eq.${uid},owner_org_id.in.(${orgIds.join(',')})` : `owner_id.eq.${uid}`)
  const minePrinters = (printers ?? []).filter((p) => p.owner_id === uid).map((p) => p.id as string)
  const orgPrinters = (printers ?? []).filter((p) => p.owner_id !== uid).map((p) => p.id as string)
  const jobsOn = (ids: string[], label: string) =>
    ids.length
      ? n(label, sb.from('toy_transactions').select('id', head).eq('type', 'print').eq('status', 'requested').in('printer_id', ids))
      : Promise.resolve(0)

  const review = async () => {
    if (!orgIds.length) return 0
    const { data, error } = await sb
      .from('tutorial_orgs')
      .select('status, tutorials!inner(status)')
      .in('org_id', orgIds)
      .in('status', ['pending', 'accepted'])
    if (error) {
      console.error('[me/counts] review failed:', error.message)
      return 0
    }
    // Web's rule: a request to answer, or one accepted on a guide still in review.
    return (data ?? []).filter(
      (r) => r.status === 'pending' || (r.tutorials as unknown as { status: string }).status === 'pending'
    ).length
  }

  const [tutorials, ideasMine, ideasJoined, makers, printRequests, printJobs, reviewCount, intake, orgOrders] = await Promise.all([
    n('tutorials', sb.from('tutorials').select('id, tutorial_contributors!inner(profile_id)', head).eq('tutorial_contributors.profile_id', uid).eq('status', 'rejected')),
    n('ideas', sb.from('toy_ideas').select('id', head).eq('author_id', uid).in('status', ['pending', 'challenge'])),
    n('joined', sb.from('toy_idea_participants').select('idea_id, toy_ideas!inner(status)', head).eq('profile_id', uid).is('removed_at', null).eq('toy_ideas.status', 'challenge')),
    n('makers', sb.from('toy_transactions').select('id', head).eq('type', 'build').eq('status', 'requested').is('owner_id', null).is('owner_org_id', null).neq('requester_id', uid)),
    n('print requests', sb.from('toy_transactions').select('id', head).eq('type', 'print').eq('requester_id', uid).in('status', ['requested', 'accepted'])),
    jobsOn(minePrinters, 'print jobs'),
    review(),
    orgIds.length ? n('intake', sb.from('recycling_dropoffs').select('id', head).in('org_id', orgIds).eq('status', 'booked')) : Promise.resolve(0),
    jobsOn(orgPrinters, 'org orders'),
  ])

  const counts: MeCounts = {
    tutorials,
    challenges: ideasMine + ideasJoined,
    makers,
    printRequests,
    printJobs,
    review: reviewCount,
    intake,
    orgOrders,
  }
  return c.json(counts)
})
```

with `import type { MeCounts } from '@splat-connect/types'` at the top.

- [ ] **Step 4: The model**

In `nav-model.ts`, after `type Capabilities`:

```ts
/** GET /api/me/counts (me-count-badges): what is waiting behind each row. */
export type MeCounts = {
  tutorials: number
  challenges: number
  makers: number
  printRequests: number
  printJobs: number
  review: number
  intake: number
  orgOrders: number
}
```

Change the signature to `export function buildNav(caps: Capabilities, counts?: MeCounts): NavGroup[]` and add `count:` to eight rows (a zero is `undefined`, as `exchangeActions` already does):

```ts
        { href: '/dashboard/tutorials', label: 'My tutorials', icon: 'file', count: counts?.tutorials || undefined },
```

```ts
        { href: '/dashboard/challenges', label: 'Design challenges', icon: 'clipboard', count: counts?.challenges || undefined },
```

```ts
        { href: '/get-involved/makers-wanted', label: 'Makers wanted', icon: 'wrench', count: counts?.makers || undefined },
```

```ts
        { href: '/dashboard/print-requests', label: 'My print requests', icon: 'clipboard', count: counts?.printRequests || undefined },
        { href: '/dashboard/printers', label: 'Print for others', icon: 'orders', count: counts?.printJobs || undefined },
```

```ts
        { href: '/dashboard/organisation', label: 'Review queue', icon: 'inbox', count: counts?.review || undefined },
```

```ts
        { href: '/dashboard/organisation/orders', label: 'Print orders', icon: 'orders', count: counts?.orgOrders || undefined },
```

```ts
        { href: '/dashboard/organisation/recycling', label: 'Recycling intake', icon: 'box', count: counts?.intake || undefined },
```

Confirm `MeCounts` is reachable from `@splat-connect/types` (`grep -n "nav-model" packages/types/src/index.ts` — if index re-exports named types from it, add `MeCounts` to that list).

- [ ] **Step 5: Mobile**

In `me.tsx`:
- `import { buildNav, formatCents, type IconName as NavIcon, type MeCounts } from '@splat-connect/types'`.
- `const [counts, setCounts] = useState<MeCounts | undefined>(undefined)`, and in the effect beside the builds fetch:

```tsx
    apiClient
      .get<MeCounts>('/api/me/counts')
      .then((n) => {
        if (!ignore) setCounts(n)
      })
      .catch(() => {})
```

- `{buildNav(caps, counts).map((group) => (`; delete the `PENDING(me-count-badges)` comment.

- [ ] **Step 6: Web**

In `packages/web/app/dashboard/page.tsx`:
- Replace the `Promise.all` of six fetches with:

```tsx
  const [meCounts, events, logged] = await Promise.all([
    apiClient.get<MeCounts>('/api/me/counts').catch(() => undefined),
    apiClient
      .get<Array<{ event: { starts_at: string; ends_at: string | null } }>>('/api/events/mine')
      .catch(() => []),
    apiClient.get<{ builds: number }>('/api/me/builds').catch(() => ({ builds: 0 })),
  ])
```

  and delete `myPrinterIds`, `ledOrgIds`, `toReview`'s reduce, and the now-unused imports (`OpenBuild`, `PrinterWithOwner`, `Tutorial`, `TutorialOrg`, `ToyTransactionSummary`); add `type MeCounts` to the `@splat-connect/types` import. Set `const toReview = meCounts?.review ?? 0` (the "{n} guides to review" button keeps working).
- In `counts`, delete the entries for `BUILD_HREF`, `'/dashboard/print-requests'`, `'/dashboard/printers'` and `'/dashboard/organisation'` (they now come from the model) and keep the unread ones and My events. Update the comment above `counts` to: "Unread for the cards that clear on read; everything else is the model's count from /api/me/counts."
- `const rows = buildNav(caps, meCounts)` and in `items`, `count: counts[row.href] ?? row.count`.

Run: `grep -n "logged\|builds" packages/web/app/dashboard/page.tsx` — keep every existing use of `logged`.

- [ ] **Step 7: Run the tests to see them pass**

Run the three commands from Step 2 → PASS. `pnpm typecheck` → exit 0.

- [ ] **Step 8: Ship the item**

Set `shipped: true` on `'me-count-badges'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 9: Commit**

```bash
git status --short
git add packages/api/src/routes/me.ts packages/types/src/nav-model.ts packages/types/src/index.ts "packages/mobile/app/(tabs)/me.tsx" packages/web/app/dashboard/page.tsx packages/api/tests/integration/me/counts.test.ts packages/web/tests/unit/lib/nav-model.test.ts packages/mobile/tests/unit/app/me.test.tsx packages/web/tests/unit/pages/dashboard-hub.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(me): one counts call badges every row on My SPLAT, web and mobile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 15: Admin counts (`admin-counts`)

`GET /api/admin/counts` returns the board's six with head counts through the admin client. Mobile Admin becomes six count cards (MB's), each still opening the web. Web `/admin` takes its six card numbers from it and drops the two calls that fed only counts (spot-check, organisations); the other eight stay, because the Recent activity feed lists their rows ("follows the code" 16). "Reports from members" is `member_reports` (065), not 041's `toy_idea_reports` behind `/api/admin/reports`. Spot-check stays what the web card already shows — the size of the sample (capped at 10), not a backlog.

**Files:**
- Modify: `packages/api/src/routes/admin.ts` (`GET /counts`, `SPOT_CHECK_SAMPLE`)
- Modify: `packages/types/src/index.ts` (`AdminCounts`)
- Modify: `packages/web/app/admin/page.tsx`
- Modify: `packages/mobile/app/(my)/admin.tsx`
- Modify: `scripts/parity/app-screen-map.json` (delete the two `admin-counts` rules on `admin`)
- Test: `packages/api/tests/unit/routes/admin.test.ts`, `packages/api/tests/integration/admin/counts.test.ts` (new), `packages/mobile/tests/unit/app/admin.test.tsx` (updated)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: `interface AdminCounts { tutorials: number; reports: number; ideas: number; spotCheck: number; accounts: number; organisations: number }`; `GET /api/admin/counts → AdminCounts` (403 for non-admins).

Copy (MB:1322, 2953–2959): "The review queues and the report inbox. Anything with a number is waiting for a person." · "Tutorials awaiting review" · "Reports from members" · "Ideas awaiting review" · "Spot-check" · "Accounts" · "Organisations". Web keeps its own card labels.

- [ ] **Step 1: Write the failing tests**

In `packages/api/tests/unit/routes/admin.test.ts`, inside `describe('admin role guard')`:

```ts
  it('refuses the counts to a contributor', async () => {
    expect((await makeApp('contributor').request('/counts')).status).toBe(403)
  })
```

`packages/api/tests/integration/admin/counts.test.ts`:

```ts
/** admin-counts: the board's six numbers in one admin-only call. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let admin: TestUser
let member: TestUser

const counts = async (token: string) => app.request('/api/admin/counts', { headers: { Authorization: `Bearer ${token}` } })

beforeAll(async () => {
  ;[admin, member] = await Promise.all([createTestUser('admin'), createTestUser()])
})

afterAll(async () => {
  await adminClient().from('member_reports').delete().eq('reporter_id', member.id)
  await Promise.all([admin, member].map((u) => deleteTestUser(u.id)))
})

describe('GET /api/admin/counts', () => {
  it('is admin only', async () => {
    expect((await counts(member.token)).status).toBe(403)
  })

  it('counts an open member report under reports, and returns all six', async () => {
    const before = (await (await counts(admin.token)).json()) as Record<string, number>
    expect(Object.keys(before).sort()).toEqual(['accounts', 'ideas', 'organisations', 'reports', 'spotCheck', 'tutorials'])
    await adminClient().from('member_reports').insert({
      reporter_id: member.id, subject_kind: 'toy', subject_label: 'Drum', category: 'other', body: 'x',
    })
    const after = (await (await counts(admin.token)).json()) as Record<string, number>
    expect(after.reports).toBe(before.reports + 1)
    expect(after.spotCheck).toBeLessThanOrEqual(10)
  })
})
```

Replace `packages/mobile/tests/unit/app/admin.test.tsx` with:

```tsx
// packages/mobile/tests/unit/app/admin.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'
import MyAdmin from '../../../app/(my)/admin'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue({ tutorials: 7, reports: 2, ideas: 3, spotCheck: 5, accounts: 57, organisations: 14 })
})

describe('MyAdmin', () => {
  it("shows the board's six counts, each opening its web queue", async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    render(<MyAdmin />)
    expect(await screen.findByText('57')).toBeTruthy()
    for (const [label, count, path] of [
      ['Tutorials awaiting review', '7', '/admin/review'],
      ['Reports from members', '2', '/admin/member-reports'],
      ['Ideas awaiting review', '3', '/admin/ideas'],
      ['Spot-check', '5', '/admin/spot-check'],
      ['Accounts', '57', '/admin/contributors'],
      ['Organisations', '14', '/admin/organizations'],
    ] as const) {
      expect(screen.getByText(count)).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: `${label}, ${count}` }))
      expect(open).toHaveBeenCalledWith(`${process.env.EXPO_PUBLIC_WEB_URL}${path}`)
    }
    open.mockRestore()
  })

  it('still lists the six queues, uncounted, when the counts fail', async () => {
    mockGet.mockRejectedValue(new Error('500'))
    render(<MyAdmin />)
    expect(await screen.findByRole('button', { name: 'Reports from members' })).toBeTruthy()
  })
})
```

(Check the web path of the member reports queue: `ls packages/web/app/admin` — it is the page whose source fetches `/api/admin/member-reports`, linked from web `/admin` as `href: '/admin/reports'`. Use the href web `/admin`'s "Reports from members" card uses, in both the test and the screen.)

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run tests/unit/routes/admin.test.ts` → the new case passes already (guard) — that is fine; it pins the guard for the new path.
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/admin/counts.test.ts` → FAIL (404).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/app/admin.test.tsx` → FAIL.

- [ ] **Step 3: The route**

In `admin.ts`, above `admin.get('/spot-check', …)`:

```ts
/** How many approved guides one spot-check draws (decision 14). */
const SPOT_CHECK_SAMPLE = 10
```

and change the spot-check's `const limit = Number(c.req.query('limit') ?? 10)` to `?? SPOT_CHECK_SAMPLE`. Then add:

```ts
/**
 * admin-counts: the board's six in one call, as head counts. Spot-check is the
 * sample's size (what web's card always showed), not a backlog — it never
 * drains by an admin working through it.
 */
admin.get('/counts', async (c) => {
  const sb = createAdminClient()
  const head = { count: 'exact', head: true } as const
  const [tutorials, reports, ideas, spot, accounts, organisations] = await Promise.all([
    sb.from('tutorials').select('id', head).eq('status', 'pending'),
    sb.from('member_reports').select('id', head).neq('status', 'resolved'),
    sb.from('toy_ideas').select('id', head).eq('status', 'pending'),
    sb.from('tutorials').select('id', head).eq('status', 'approved').not('reviewed_by', 'is', null).neq('reviewed_by', c.get('userId')),
    sb.from('profiles').select('id', head).neq('role', 'admin'),
    sb.from('organizations').select('id', head),
  ])
  const failed = [tutorials, reports, ideas, spot, accounts, organisations].find((r) => r.error)
  if (failed) return c.json({ error: failed.error!.message }, 500)
  const counts: AdminCounts = {
    tutorials: tutorials.count ?? 0,
    reports: reports.count ?? 0,
    ideas: ideas.count ?? 0,
    spotCheck: Math.min(spot.count ?? 0, SPOT_CHECK_SAMPLE),
    accounts: accounts.count ?? 0,
    organisations: organisations.count ?? 0,
  }
  return c.json(counts)
})
```

with `import type { AdminCounts } from '@splat-connect/types'`. In `packages/types/src/index.ts`:

```ts
/** GET /api/admin/counts (admin-counts): the board's six. */
export interface AdminCounts {
  tutorials: number
  reports: number
  ideas: number
  spotCheck: number
  accounts: number
  organisations: number
}
```

- [ ] **Step 4: Web /admin**

In `packages/web/app/admin/page.tsx`:
- In the first `Promise.all`, replace `apiClient.get<Organization[]>('/api/organizations'),` and `apiClient.get<Tutorial[]>('/api/admin/spot-check'),` with one `apiClient.get<AdminCounts>('/api/admin/counts'),`, destructuring `[tutorials, accounts, counts, ideas, orgRequests]`. Drop `Organization` from the type import; add `AdminCounts`.
- Cards: `count: counts.tutorials` (Tutorials awaiting review), `counts.reports` (Reports from members, and its `numColor` test), `counts.ideas` (Design challenges awaiting review), `counts.spotCheck` (Spot-check), `counts.accounts` (Accounts), `counts.organisations` (Organisations). Delete `pendingTutorials`, `totalContributors`, `pendingIdeas` and `pendingReports` if nothing else reads them (`pendingReports` feeds `numColor` — replace with `counts.reports`).
- Leave the feed and its lists as they are.

- [ ] **Step 5: Mobile Admin**

Replace `packages/mobile/app/(my)/admin.tsx` with:

```tsx
// packages/mobile/app/(my)/admin.tsx
// The board's Admin (MB is_admin): six count cards from one call. Review
// tables don't fit a phone, so each card opens its queue on the web, where
// the admin is signed in as themselves.
import { useEffect, useState } from 'react'
import { View, Text, Linking, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AdminCounts } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { AnimatedPressable } from '../../components/ui/AnimatedPressable'

type Icon = React.ComponentProps<typeof Ionicons>['name']

// MB:2953–2959, in its order and words; the paths are web's /admin cards.
const CARDS: { key: keyof AdminCounts; label: string; path: string; icon: Icon; tint: string }[] = [
  { key: 'tutorials', label: 'Tutorials awaiting review', path: '/admin/review', icon: 'clipboard-outline', tint: theme.colors.honeySoft },
  { key: 'reports', label: 'Reports from members', path: '/admin/reports', icon: 'flag-outline', tint: theme.colors.apricotSoft },
  { key: 'ideas', label: 'Ideas awaiting review', path: '/admin/ideas', icon: 'bulb-outline', tint: theme.colors.violetSoft },
  { key: 'spotCheck', label: 'Spot-check', path: '/admin/spot-check', icon: 'search-outline', tint: theme.colors.accentLight },
  { key: 'accounts', label: 'Accounts', path: '/admin/contributors', icon: 'people-outline', tint: theme.colors.mintSoft },
  { key: 'organisations', label: 'Organisations', path: '/admin/organizations', icon: 'business-outline', tint: theme.colors.apricotSoft },
]

export default function MyAdmin() {
  const [counts, setCounts] = useState<AdminCounts | null>(null)
  useEffect(() => {
    let ignore = false
    apiClient
      .get<AdminCounts>('/api/admin/counts')
      .then((c) => {
        if (!ignore) setCounts(c)
      })
      .catch((err) => console.error('[MyAdmin] counts failed:', err))
    return () => {
      ignore = true
    }
  }, [])

  return (
    <View style={styles.screen}>
      <Text style={styles.blurb}>
        The review queues and the report inbox. Anything with a number is waiting for a person.
      </Text>
      <View style={styles.grid}>
        {CARDS.map((card) => {
          const n = counts ? counts[card.key] : null
          return (
            <AnimatedPressable
              key={card.key}
              onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_WEB_URL}${card.path}`)}
              accessibilityRole="button"
              accessibilityLabel={n === null ? card.label : `${card.label}, ${n}`}
              accessibilityHint="Opens on the web."
              pressScale={0.98}
              style={styles.card}
            >
              <View style={[styles.tile, { backgroundColor: card.tint }]}>
                <Ionicons name={card.icon} size={22} color={theme.colors.ink} />
              </View>
              {n !== null ? <Text style={styles.count}>{String(n)}</Text> : null}
              <Text style={styles.label}>{card.label}</Text>
            </AnimatedPressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4) },
  blurb: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21, marginBottom: theme.spacing(4) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%',
    padding: 16,
    borderRadius: theme.radii.card,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(2),
  },
  tile: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: theme.fonts.display, fontSize: 28, lineHeight: 32, marginTop: 10, color: theme.colors.ink, fontVariant: ['tabular-nums'] },
  label: { fontFamily: theme.fonts.black, fontSize: 13.5, lineHeight: 18, marginTop: 4, color: theme.colors.ink },
})
```

(`violetSoft`, `honeySoft`, `mintSoft`, `apricotSoft`, `accentLight` are tokens `explore-screen.tsx` already uses.)

- [ ] **Step 6: Parity**

In `scripts/parity/app-screen-map.json`, `admin` entry: delete the two rules with `"pending": "admin-counts"`. Keep the `"why": "intended"` copy rule.

- [ ] **Step 7: Run the tests to see them pass**

Run the commands from Step 2 → PASS; `pnpm --filter @splat-connect/web exec vitest run tests/unit/pages` → PASS (fix any admin-page test fixture to answer `/api/admin/counts`). `pnpm typecheck` → exit 0.

- [ ] **Step 8: Ship the item**

The `PENDING(admin-counts)` comment went with the old file. Set `shipped: true` on `'admin-counts'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 9: Commit**

```bash
git status --short
git add packages/api/src/routes/admin.ts packages/types/src/index.ts packages/web/app/admin/page.tsx "packages/mobile/app/(my)/admin.tsx" scripts/parity/app-screen-map.json packages/api/tests/unit/routes/admin.test.ts packages/api/tests/integration/admin/counts.test.ts packages/mobile/tests/unit/app/admin.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(admin): the board's six counts in one call, as cards on mobile Admin and the web dashboard's numbers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

## Slice 5

### Task 16: Play and Measurements in the child wizard (`wizard-steps`, migration 120)

The wizard keeps its six screens — name and age, the four 079 switch questions, the room — because those are what `suitsChild` matches on; the board's Hands (both/one/left/right) and Movement (press/lever/grasp/near) have no columns ("follows the code" 10). It gains the board's last two steps: Play, stored as `child_profiles.enjoys` and shown only (decided 2026-09-30: "display only, not used for matching"), and Measurements, optional. Hand width is the existing `palm_width_mm`, which the API has refused on purpose since 079 (APP 3 minimisation) and `crud.test.ts` pins; the registry's decision ("Add Measurements as an optional step, kept on the child profile") makes it writable again ("follows the code" 11). Reach and tray thickness are new columns. Nothing reads a measurement yet; the registry's "Future: contributors publish parametric CAD models" is the reader.

**Files:**
- Create: `supabase/migrations/120_child_profile_play_measurements.sql`
- Modify: `packages/types/src/index.ts` (`ChildProfile`, `ENJOYS`, `Enjoy`, `CHILD_MEASURES`)
- Modify: `packages/api/src/routes/child-profiles.ts`
- Modify: `packages/mobile/components/profile/child-wizard.tsx`, `packages/mobile/components/profile/fields.tsx`
- Modify: `scripts/check-schema-guards.sh`
- Test: `packages/api/tests/integration/child-profiles/play-measurements.test.ts` (new), `packages/api/tests/integration/child-profiles/crud.test.ts`, `packages/mobile/tests/unit/components/profile/child-wizard.test.tsx`; fixture lines in `packages/mobile/tests/unit/components/profile/{child-editor-home,child-profile-home}.test.tsx`, `packages/web/tests/unit/components/child-editor.test.tsx`, `packages/web/tests/unit/pages/{dashboard-child-edit,dashboard-profile}.test.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: columns `child_profiles.enjoys text[]` (⊆ six values), `reach_cm numeric` (5–150), `tray_mm numeric` (1–100), and a CHECK on `palm_width_mm` (20–250). `ChildProfile.enjoys: Enjoy[]`, `.reach_cm: number | null`, `.tray_mm: number | null`. `ENJOYS` (value/label list), `type Enjoy`, `CHILD_MEASURES` (field, label, placeholder, min, max) in `@splat-connect/types`. `POST`/`PATCH /api/child-profiles` accept `enjoys`, `palm_width_mm`, `reach_cm`, `tray_mm`. Task 17 adds a pose to the `STEPS` this task extends.

Copy (MB:2051): "What does your child enjoy?" · "We will put those toys first." · "Lights and sound are the classic reward. Some children prefer calm." · "Lights" · "Music and sound" · "Things that move" · "Soft and cuddly" · "Calm and sensory" · "Bubbles and water". (MB:2052): "Any measurements? (optional)" · "Only for printed grips and mounts." · "Almost done. This one is fine to skip." (MB:2067): "Hand width (mm)" / "e.g. 62" · "Reach from seated (cm)" / "e.g. 30" · "Tray thickness (mm)" / "e.g. 15". The room step's line becomes "Rather than in the hand. Pick any that apply." — web's wizard already says it (`packages/web/components/child-wizard.tsx`, the `needs` step's help), because Measurements now owns "Almost done…". Flagged, no board source: the out-of-range hint "Between {min} and {max}.".

"We will put those toys first." is the board's line, and it overstates a display-only answer: nothing sorts by `enjoys`. It is kept because the board says it and Byron decided display-only knowing the board; flagged in the report.

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/child-profiles/play-measurements.test.ts`:

```ts
/**
 * 120 (wizard-steps): what a child enjoys, and three optional measurements,
 * kept on the child profile. Limits are checked twice — a 400 sentence from
 * the API, a CHECK in the table.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let parent: TestUser

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => {
  parent = await createTestUser('contributor')
})

afterAll(async () => {
  await adminClient().from('child_profiles').delete().eq('parent_id', parent.id)
  await deleteTestUser(parent.id)
})

describe('120 child profile play and measurements', () => {
  it('the three new columns exist', async () => {
    const { error } = await adminClient().from('child_profiles').select('enjoys, reach_cm, tray_mm').limit(1)
    expect(error).toBeNull()
  })

  it('saves what the child enjoys, once each, and the three measurements', async () => {
    const res = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({ enjoys: ['light', 'calm', 'light'], palm_width_mm: 62, reach_cm: 30, tray_mm: 15 }),
    }))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ enjoys: ['light', 'calm'], palm_width_mm: 62, reach_cm: 30, tray_mm: 15 })
  })

  it('400s with a sentence on a value outside its vocabulary or range', async () => {
    for (const body of [
      { enjoys: ['loud'] },
      { enjoys: 'light' },
      { palm_width_mm: 10 },
      { palm_width_mm: '62' },
      { reach_cm: 200 },
      { tray_mm: 0 },
    ]) {
      const res = await app.request('/api/child-profiles', authed(parent.token, { method: 'POST', body: JSON.stringify(body) }))
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect(((await res.json()) as { error: string }).error).toMatch(/must be/)
    }
  })

  it('the table refuses an out-of-range measurement written past the API', async () => {
    const { error } = await adminClient()
      .from('child_profiles')
      .insert({ parent_id: parent.id, tray_mm: 500 })
    expect(error?.code).toBe('23514') // check_violation
  })
})
```

In `packages/api/tests/integration/child-profiles/crud.test.ts`, test `'no longer accepts the retired ability and needs fields'`: `palm_width_mm` is writable again, so drop it from the body and from the assertions. The body becomes `{ name: 'Minimal', macs_level: 'II', challenges: ['Grasping'] }`, the cast `{ macs_level: string | null; challenges: string[] }`, and delete `expect(row.palm_width_mm).toBeNull()`. Add above the `it`:

```ts
  // palm_width_mm left this list in 120: the registry's 2026-09-30 decision
  // made Measurements an optional wizard step (play-measurements.test.ts).
```

In `packages/mobile/tests/unit/components/profile/child-wizard.test.tsx`:
- Append `'What does your child enjoy?'` and `'Any measurements? (optional)'` to `HEADINGS`.
- In `'walks every step on Skip…'`, change `expect(screen.queryByText(/MACS|BFMF|measure/i)).toBeNull()` to `expect(screen.queryByText(/MACS|BFMF/)).toBeNull()` — the wizard now asks for measurements on purpose; the retired scores must still never appear.
- Append inside `describe('ChildWizard')`:

```tsx
  it('saves what the child enjoys from the Play step', async () => {
    jest.useFakeTimers()
    try {
      render(<ChildWizard />)
      await screen.findByText(HEADINGS[0])
      for (let i = 0; i < 6; i++) fireEvent.press(screen.getByRole('button', { name: 'Skip' }))
      expect(screen.getByText('What does your child enjoy?')).toBeTruthy()
      expect(screen.getByText('We will put those toys first.')).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'Lights' }))
      fireEvent.press(screen.getByRole('button', { name: 'Bubbles and water' }))
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
      expect(screen.getByText('Any measurements? (optional)')).toBeTruthy()
      await act(async () => { jest.advanceTimersByTime(500) })
      await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/child-profiles', { enjoys: ['light', 'water'] }))
    } finally {
      jest.useRealTimers()
    }
  })

  it('saves the measurements in range and says the range of one that is not', async () => {
    jest.useFakeTimers()
    try {
      render(<ChildWizard />)
      await screen.findByText(HEADINGS[0])
      for (let i = 0; i < 7; i++) fireEvent.press(screen.getByRole('button', { name: 'Skip' }))
      expect(screen.getByText('Only for printed grips and mounts.')).toBeTruthy()
      fireEvent.changeText(screen.getByPlaceholderText('e.g. 62'), '62')
      fireEvent.changeText(screen.getByPlaceholderText('e.g. 30'), '400')
      expect(screen.getByText('Between 5 and 150.')).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'Finish' }))
      await act(async () => { jest.advanceTimersByTime(500) })
      // The reach is out of range, so it is not an answer — only the hand width saves.
      await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/child-profiles', { palm_width_mm: 62 }))
    } finally {
      jest.useRealTimers()
    }
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/child-profiles/play-measurements.test.ts` → FAIL (`column child_profiles.enjoys does not exist`).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/profile/child-wizard.test.tsx` → FAIL (`Unable to find an element with text: What does your child enjoy?`).

- [ ] **Step 3: The migration**

`supabase/migrations/120_child_profile_play_measurements.sql`:

```sql
-- 120 — the child wizard's Play and Measurements steps (wizard-steps).
--
-- Decided 2026-09-30: add the board's "What does your child enjoy?" as a
-- display-only answer (it does not feed matching), and Measurements as an
-- optional step kept on the child profile.
--
--   enjoys        light · sound · move · soft · calm · water (MB's six)
--   palm_width_mm existing since 003; 079 stopped accepting it (APP 3). The
--                 registry decision makes it writable again, so it gains the
--                 range the API checks. NOT VALID: rows written before 079
--                 are not re-checked here — new writes are.
--   reach_cm      "Reach from seated (cm)", new
--   tray_mm       "Tray thickness (mm)", new
--
-- No reader yet: the registry's future parametric CAD models are.
--
-- DOWN:
--   alter table public.child_profiles drop constraint if exists child_profiles_palm_width_range;
--   alter table public.child_profiles drop column if exists tray_mm,
--     drop column if exists reach_cm, drop column if exists enjoys;

alter table public.child_profiles
  add column enjoys text[] not null default '{}'
    check (enjoys <@ array['light', 'sound', 'move', 'soft', 'calm', 'water']::text[]),
  add column reach_cm numeric check (reach_cm between 5 and 150),
  add column tray_mm numeric check (tray_mm between 1 and 100);

alter table public.child_profiles
  add constraint child_profiles_palm_width_range check (palm_width_mm between 20 and 250) not valid;
```

Run: `supabase migration up` → `Applying migration 120_child_profile_play_measurements.sql...`

- [ ] **Step 4: The types**

In `packages/types/src/index.ts`, `interface ChildProfile`, after `everyday_needs: EverydayNeed[]`:

```ts
  /** 120. "What does your child enjoy?" — shown, never matched on. */
  enjoys: Enjoy[]
  /** 120. Optional, for printed grips and mounts. palm_width_mm (above) is the third. */
  reach_cm: number | null
  tray_mm: number | null
```

After `export const EVERYDAY_NEEDS = [ … ] as const`:

```ts
// 120 — the board's Play step (MB wizard), in its order and words.
export const ENJOYS = [
  { value: 'light', label: 'Lights' },
  { value: 'sound', label: 'Music and sound' },
  { value: 'move', label: 'Things that move' },
  { value: 'soft', label: 'Soft and cuddly' },
  { value: 'calm', label: 'Calm and sensory' },
  { value: 'water', label: 'Bubbles and water' },
] as const
export type Enjoy = (typeof ENJOYS)[number]['value']

/** 120 — the board's three optional measurements, with the range the API and
 *  the table both enforce. One list for the wizard and the route. */
export const CHILD_MEASURES = [
  { field: 'palm_width_mm', label: 'Hand width (mm)', placeholder: 'e.g. 62', min: 20, max: 250 },
  { field: 'reach_cm', label: 'Reach from seated (cm)', placeholder: 'e.g. 30', min: 5, max: 150 },
  { field: 'tray_mm', label: 'Tray thickness (mm)', placeholder: 'e.g. 15', min: 1, max: 100 },
] as const
export type ChildMeasureField = (typeof CHILD_MEASURES)[number]['field']
```

`ChildAnswers` stays as it is: web's form and wizard build a whole `ChildAnswers`, and neither asks these.

Run `pnpm typecheck`. Every test fixture typed as a `ChildProfile` now fails for the three missing fields; the five files are the ones holding `palm_width_mm: null` (`git grep -ln "palm_width_mm: null" -- packages`). In each, add after that line:

```ts
  enjoys: [],
  reach_cm: null,
  tray_mm: null,
```

Run: `grep -rn "enjoys\|reach_cm\|tray_mm" packages/mobile packages/web --include=*.ts --include=*.tsx | grep -v node_modules` → the wizard, its test, and the five fixtures.

- [ ] **Step 5: The route**

In `packages/api/src/routes/child-profiles.ts`:
- Import: `import { AIM, CHILD_MEASURES, ENJOYS, EVERYDAY_NEEDS, HOLD, PRESS_FORCE, WORKING_HAND } from '@splat-connect/types'`.
- Replace the comment above `EDITABLE` and the constant with:

```ts
// Only the board's questions are writable: the four switch questions and the
// room (079), and the Play and Measurements steps (120). The older ability/
// needs columns (MACS, BFMF, grip, sensory…) are no longer asked, so they are
// no longer accepted either — APP 3 minimisation. palm_width_mm came back in
// 120 by decision (2026-09-30: "Measurements as an optional step"). The rest
// stay in the table and still come back on GET until a decision drops them.
const EDITABLE = [
  'name', 'age', 'working_hand', 'press_force', 'aim', 'hold', 'everyday_needs',
  'enjoys', 'palm_width_mm', 'reach_cm', 'tray_mm',
] as const
```

- After `const NEEDS = valuesOf(EVERYDAY_NEEDS)` add `const ENJOY_VALUES = valuesOf(ENJOYS)`.
- In `editableFrom`, after the `everyday_needs` block and before `return { ...row, … }`:

```ts
  const enjoys = row.enjoys
  if (enjoys !== undefined) {
    if (!Array.isArray(enjoys) || enjoys.some((e) => !ENJOY_VALUES.includes(e as string))) {
      return `enjoys must be a list drawn from ${ENJOY_VALUES.join(', ')}`
    }
    row.enjoys = [...new Set(enjoys)]
  }
  // 120's CHECKs hold the same ranges; answering here keeps a typo from
  // surfacing as a 500 naming a constraint.
  for (const m of CHILD_MEASURES) {
    const v = row[m.field]
    if (v === undefined || v === null) continue
    if (typeof v !== 'number' || !Number.isFinite(v) || v < m.min || v > m.max) {
      return `${m.field} must be a number from ${m.min} to ${m.max}`
    }
  }
```

- [ ] **Step 6: A multi-choice chip row for any list**

In `packages/mobile/components/profile/fields.tsx`, replace `export function NeedsChips(…) { … }` with:

```tsx
/** Any number of a list's options — the room's needs, what a child enjoys. */
export function ManyChips<T extends string>({ options, value, onChange }: {
  options: readonly { value: T; label: string }[]
  value: T[]
  onChange: (v: T[]) => void
}) {
  return (
    <View style={[styles.field, styles.pillRow]}>
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <Chip
            key={o.value}
            label={o.label}
            active={on}
            onPress={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
          />
        )
      })}
    </View>
  )
}

/** The everyday needs, any number of them. */
export function NeedsChips({ value, onChange }: { value: EverydayNeed[]; onChange: (v: EverydayNeed[]) => void }) {
  return <ManyChips options={EVERYDAY_NEEDS} value={value} onChange={onChange} />
}
```

- [ ] **Step 7: The wizard's two new steps**

In `packages/mobile/components/profile/child-wizard.tsx`:
- Imports: `import { CHILD_MEASURES, CHILD_QUESTIONS, ENJOYS, type ChildAnswers, type ChildMeasureField, type ChildProfile } from '@splat-connect/types'` and `import { ChoiceChips, ManyChips, NeedsChips } from './fields'`.
- Header comment: change "name and age, the four switch questions, then the room." to "name and age, the four switch questions, the room, then the board's Play and Measurements (120)."
- Delete `// PENDING(wizard-steps): the board asks About, Hands, Movement, "What does your child enjoy?" and Measurements.` and replace `STEPS` and `EMPTY` with:

```tsx
/** What the wizard writes: the board's questions (079) plus Play and Measurements (120). */
type Answers = ChildAnswers & Pick<ChildProfile, 'enjoys' | ChildMeasureField>

type Kind = 'about' | 'question' | 'room' | 'play' | 'measure'

// Six screens from 079 (not the board's About/Hands/Movement — those answers
// have no columns, and the four questions are what suitsChild matches on),
// then the board's last two. `line` is what web's mascot says on the step;
// `help` is the board's sentence under the heading, where it has one.
const STEPS: { kind: Kind; heading: string; line: string; help?: string; fields: (keyof Answers)[] }[] = [
  { kind: 'about', heading: 'Who are we finding toys for?', line: 'Hi! A few quick questions. Skip any you like.', fields: ['name', 'age'] },
  ...CHILD_QUESTIONS.map((q, i) => ({
    kind: 'question' as const,
    heading: q.prompt,
    line: [
      'Whichever hand they reach with first is the right answer.',
      'This decides how easy a switch needs to be to press.',
      'Big targets are easier. Either answer helps.',
      'Some switches want a tap, some a hold.',
    ][i],
    fields: [q.field] as (keyof Answers)[],
  })),
  { kind: 'room', heading: 'What matters in the room?', line: 'Rather than in the hand. Pick any that apply.', fields: ['everyday_needs'] },
  {
    kind: 'play',
    heading: 'What does your child enjoy?',
    help: 'We will put those toys first.',
    line: 'Lights and sound are the classic reward. Some children prefer calm.',
    fields: ['enjoys'],
  },
  {
    kind: 'measure',
    heading: 'Any measurements? (optional)',
    help: 'Only for printed grips and mounts.',
    line: 'Almost done. This one is fine to skip.',
    fields: CHILD_MEASURES.map((m) => m.field),
  },
]

const EMPTY: Answers = {
  name: null, age: null, working_hand: null, press_force: null, aim: null, hold: null, everyday_needs: [],
  enjoys: [], palm_width_mm: null, reach_cm: null, tray_mm: null,
}

const inRange = (m: (typeof CHILD_MEASURES)[number], n: number) => Number.isFinite(n) && n >= m.min && n <= m.max
```

- In `ChildWizard`: change `useState<ChildAnswers>(EMPTY)` to `useState<Answers>(EMPTY)`, `set`'s parameter to `Partial<Answers>`, and add after `set`:

```tsx
  // What the parent typed, so "400" stays on screen with its range under it
  // while the answer itself stays empty — an out-of-range number is not an answer.
  const [measureText, setMeasureText] = useState<Partial<Record<ChildMeasureField, string>>>({})
```

- In `saveAndNext`, generalise the array rule (it named `everyday_needs`):

```tsx
    const answered = STEPS[step].fields.filter((f) => {
      const v = draft[f]
      if (!Array.isArray(v)) return v !== null
      const before = profile?.[f as 'everyday_needs' | 'enjoys']
      return v.length > 0 || (before?.length ?? 0) > 0
    })
    const fields: Partial<Answers> = Object.fromEntries(answered.map((f) => [f, draft[f]]))
```

  (`save` takes `Partial<ChildProfile>`, which `Partial<Answers>` satisfies.)
- Delete `const q = step >= 1 && …` and replace the whole `{loading ? null : step === 0 ? ( … ) : q ? ( … ) : ( … )}` expression with:

```tsx
      {current.help ? <Text style={styles.help}>{current.help}</Text> : null}

      {loading ? null : current.kind === 'about' ? (
        <>
          <TextField
            label="First name (optional)"
            placeholder="e.g. Sam"
            value={draft.name ?? ''}
            onChangeText={(v) => set({ name: v || null })}
          />
          <TextField
            label="Age"
            accessibilityLabel="Age in years"
            keyboardType="numeric"
            value={draft.age != null ? String(draft.age) : ''}
            onChangeText={(v) => set({ age: v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v) })}
          />
        </>
      ) : current.kind === 'question' ? (
        (() => {
          const q = CHILD_QUESTIONS[step - 1]
          return <ChoiceChips options={q.options} value={draft[q.field]} onChange={(v) => set({ [q.field]: v })} />
        })()
      ) : current.kind === 'room' ? (
        <NeedsChips value={draft.everyday_needs} onChange={(v) => set({ everyday_needs: v })} />
      ) : current.kind === 'play' ? (
        <ManyChips options={ENJOYS} value={draft.enjoys} onChange={(v) => set({ enjoys: v })} />
      ) : (
        CHILD_MEASURES.map((m) => {
          const text = measureText[m.field] ?? (draft[m.field] != null ? String(draft[m.field]) : '')
          const bad = text.trim() !== '' && !inRange(m, Number(text))
          return (
            <TextField
              key={m.field}
              label={m.label}
              placeholder={m.placeholder}
              keyboardType="numeric"
              value={text}
              hint={bad ? `Between ${m.min} and ${m.max}.` : undefined}
              onChangeText={(v) => {
                setMeasureText((t) => ({ ...t, [m.field]: v }))
                set({ [m.field]: v.trim() !== '' && inRange(m, Number(v)) ? Number(v) : null })
              }}
            />
          )
        })
      )}
```

- `pick` takes and returns `Answers`, adding `enjoys: p.enjoys ?? [], palm_width_mm: p.palm_width_mm, reach_cm: p.reach_cm, tray_mm: p.tray_mm`, and the seeding effect calls `pick(profile)` unchanged (a `ChildProfile` is an `Answers`).
- Styles: `help: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.text, lineHeight: 21, marginTop: -theme.spacing(3), marginBottom: theme.spacing(4) },`.

`current.line` still renders as it does today; Task 17 puts it beside the mascot.

- [ ] **Step 8: Guards**

In `scripts/check-schema-guards.sh`, add before the closing `) as t(...)`:

```sql
  -- 120. Not a guard but the same silent failure: without the columns every
  -- wizard save on the Play or Measurements step 500s.
  ('120 child_profiles enjoys, reach_cm and tray_mm exist',
   (select count(*) = 3 from information_schema.columns
      where table_schema = 'public' and table_name = 'child_profiles'
        and column_name in ('enjoys', 'reach_cm', 'tray_mm'))),
```

- [ ] **Step 9: Run the tests to see them pass**

Run the commands from Step 2 → PASS. Then `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/child-profiles/crud.test.ts tests/integration/account-deletion/delete.test.ts` → PASS; `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/profile` → PASS; `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/child-editor.test.tsx tests/unit/pages/dashboard-child-edit.test.tsx tests/unit/pages/dashboard-profile.test.tsx` → PASS. `pnpm typecheck` → exit 0.

- [ ] **Step 10: Ship the item**

The marker went in Step 7. Set `shipped: true` on `'wizard-steps'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 11: Commit**

```bash
git status --short
git add supabase/migrations/120_child_profile_play_measurements.sql packages/types/src/index.ts packages/api/src/routes/child-profiles.ts packages/mobile/components/profile/child-wizard.tsx packages/mobile/components/profile/fields.tsx scripts/check-schema-guards.sh packages/api/tests/integration/child-profiles/play-measurements.test.ts packages/api/tests/integration/child-profiles/crud.test.ts packages/mobile/tests/unit/components/profile/child-wizard.test.tsx packages/mobile/tests/unit/components/profile/child-editor-home.test.tsx packages/mobile/tests/unit/components/profile/child-profile-home.test.tsx packages/web/tests/unit/components/child-editor.test.tsx packages/web/tests/unit/pages/dashboard-child-edit.test.tsx packages/web/tests/unit/pages/dashboard-profile.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(child-profile): Play and Measurements steps in the wizard; hand width writable again (120)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 17: A mascot on every step and a "profile is ready" screen (`wizard-mascot-done`)

The mobile mascot is a PNG rendered from the board's bear (`components/ui/TabHero.tsx`, which has `wave` and `hold`). This task renders `think` and `party` the same way, puts the pose beside each step's line as the board does (MB:1346–1349), and replaces "Finish → Guides" with the board's done screen (MB:1381–1386). Matching is one pure function in `packages/types/src/child-matches.ts`. Toys carry no switch tags, so "{t} toys" counts switch-adapted, published, not-paused toys whatever the child ("follows the code" 12). Guides takes no route params, so "See the matches" opens Guides with `suits=1`, which turns on the existing "Suits {child}" chip ("follows the code" 13).

**Files:**
- Create: `packages/types/src/child-matches.ts`
- Create: `packages/mobile/components/profile/child-done.tsx`
- Create: `packages/mobile/assets/mascot-think.png`, `packages/mobile/assets/mascot-party.png`
- Modify: `packages/types/src/index.ts` (re-exports)
- Modify: `packages/mobile/components/ui/TabHero.tsx` (`MASCOT`)
- Modify: `packages/mobile/components/profile/child-wizard.tsx`
- Modify: `packages/mobile/components/home/library-screen.tsx` (`suits=1`)
- Modify: `scripts/parity/app-screen-map.json` (delete the `wizard-mascot-done` rule on `wizard`)
- Test: `packages/web/tests/unit/lib/child-matches.test.ts` (new), `packages/mobile/tests/unit/components/profile/child-wizard.test.tsx`, `packages/mobile/tests/unit/components/home/library-screen.test.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: `suitsChild`, `SWITCH_FORCE_LABEL`, `SWITCH_TARGET_LABEL` (080, types); `Toy.paused_at` (batch 3); Task 16's `STEPS`.
- Produces: `matchesForChild(child, guides, toys): { guideIds: string[]; toyIds: string[] }`, `childNeedsLine(child): string | null` from `@splat-connect/types`; `ChildDone` from `components/profile/child-done.tsx`; `MascotPose` gains `'think' | 'party'`; `/guides?suits=1`.

Copy (MB:1383–1385): "{name}'s profile is ready" · "We found {g} guides and {t} toys that suit {summary}." · "See the matches". `{summary}` follows MB's "a palm press with a big button" shape from the child's own answers: "a light press with a big button" (`childNeedsLine`). Singulars "1 guide" / "1 toy" follow from the board's plurals. Flagged, no board source: "Your child's profile is ready" (no name given) and "that suit your child" (no press or aim answer) — both already in the header's list.

Poses (MB:2048–2052 and web's `POSE` in `components/child-wizard.tsx`): name `wave`, the four questions `think`, `hold`, `think`, `hold`, the room `party` (web's), Play `party`, Measurements `think`; the done screen `party` at 132 (MB: `this.mascot(wDone ? 'party' : W.pose, wDone ? 132 : 74)`).

- [ ] **Step 1: Write the failing tests**

`packages/web/tests/unit/lib/child-matches.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { matchesForChild, childNeedsLine } from '@splat-connect/types'

const guide = (id: string, over: object = {}) => ({ id, switch_target: null, switch_force: null, switch_hold: null, ...over })
const toy = (id: string, over: object = {}) => ({ id, switch_adapted: true, status: 'published' as const, paused_at: null, ...over })

describe('matchesForChild (wizard-mascot-done)', () => {
  const child = { press_force: 'light' as const, aim: 'large' as const, hold: 'second' as const }

  it("matches a guide whose switch is within the child's answers, and no other", () => {
    const { guideIds } = matchesForChild(
      child,
      [
        guide('fits', { switch_force: 'very_light', switch_target: 'large', switch_hold: 'moment' }),
        guide('too-firm', { switch_force: 'full' }),
        guide('too-small', { switch_target: 'small' }),
        guide('untagged'),
      ],
      []
    )
    // An untagged guide is "nothing to compare" (suitsChild null), never a match.
    expect(guideIds).toEqual(['fits'])
  })

  it('counts switch-adapted, published, not-paused toys, whatever the child', () => {
    const { toyIds } = matchesForChild(
      { press_force: null, aim: null, hold: null },
      [],
      [toy('yes'), toy('plain', { switch_adapted: false }), toy('draft', { status: 'draft' }), toy('paused', { paused_at: '2026-09-01' })]
    )
    expect(toyIds).toEqual(['yes'])
  })
})

describe('childNeedsLine', () => {
  it("says what the child's switch needs in the board's shape", () => {
    expect(childNeedsLine({ press_force: 'light', aim: 'large' })).toBe('a light press with a big button')
    expect(childNeedsLine({ press_force: 'full', aim: 'small' })).toBe('a firm press with a small target')
    expect(childNeedsLine({ press_force: null, aim: 'large' })).toBe('a big button')
    expect(childNeedsLine({ press_force: 'moderate', aim: 'not_reliably' })).toBe('a moderate press')
  })

  it('is null with nothing to say — the screen then says "your child"', () => {
    expect(childNeedsLine({ press_force: null, aim: null })).toBeNull()
  })
})
```

In `child-wizard.test.tsx`:
- In `'walks every step on Skip…'`, replace `expect(mockReplace).toHaveBeenCalledWith('/guides')` with:

```tsx
      // Finish (or Skip on the last step) opens the done screen, not Guides.
      expect(mockReplace).not.toHaveBeenCalled()
      expect(await screen.findByText("Your child's profile is ready")).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'See the matches' }))
      // Nothing matched (every list is empty), so Guides opens unfiltered.
      expect(mockReplace).toHaveBeenCalledWith('/guides')
```

- Append inside `describe('ChildWizard')`:

```tsx
  it('ends on the board\'s done screen with the matches, and opens Guides filtered to them', async () => {
    mockGet.mockImplementation((path: string) =>
      path === '/api/public/tutorials'
        ? Promise.resolve([
            { id: 'g1', switch_force: 'light', switch_target: 'large', switch_hold: null },
            { id: 'g2', switch_force: 'full', switch_target: null, switch_hold: null },
          ])
        : path === '/api/public/toys'
          ? Promise.resolve([
              { id: 'y1', switch_adapted: true, status: 'published', paused_at: null },
              { id: 'y2', switch_adapted: false, status: 'published', paused_at: null },
            ])
          : Promise.resolve([])
    )
    jest.useFakeTimers()
    try {
      render(<ChildWizard />)
      fireEvent.changeText(await screen.findByPlaceholderText('e.g. Sam'), 'Ollie')
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
      fireEvent.press(screen.getByRole('button', { name: 'Skip' })) // hand
      fireEvent.press(screen.getByRole('button', { name: 'Light' }))
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
      fireEvent.press(screen.getByRole('button', { name: 'Yes, large' }))
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
      for (let i = 0; i < 4; i++) fireEvent.press(screen.getByRole('button', { name: 'Skip' })) // hold, room, play, measurements
      expect(await screen.findByText("Ollie's profile is ready")).toBeTruthy()
      expect(await screen.findByText('We found 1 guide and 1 toy that suit a light press with a big button.')).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'See the matches' }))
      expect(mockReplace).toHaveBeenCalledWith('/guides?suits=1')
      await act(async () => { jest.advanceTimersByTime(500) })
    } finally {
      jest.useRealTimers()
    }
  })
```

In `packages/mobile/tests/unit/components/home/library-screen.test.tsx`:
- Replace `jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))` with:

```tsx
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useLocalSearchParams: () => mockParams }))
```

  and add `mockParams = {}` at the top of the file's `beforeEach`.
- Append inside `describe('Suits <child>')`:

```tsx
  // wizard-mascot-done: the done screen's "See the matches" lands here with suits=1.
  it('arrives already filtered when opened with suits=1', async () => {
    mockParams = { suits: '1' }
    mockEndpoints({
      tutorials: Promise.resolve([tagged, firm]),
      children: Promise.resolve([{ name: 'Ollie', press_force: 'light', hold: 'second', aim: null }]),
    })
    render(<LibraryScreen />)
    expect(await screen.findByText('Light touch switch')).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('Firm lever')).toBeNull())
    expect(screen.getByText('Suits Ollie')).toBeTruthy()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/child-matches.test.ts` → FAIL (`matchesForChild is not a function`).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/profile/child-wizard.test.tsx tests/unit/components/home/library-screen.test.tsx` → FAIL (`mockReplace` called with `/guides`; "Firm lever" still shown).

- [ ] **Step 3: The pure rule**

`packages/types/src/child-matches.ts`:

```ts
/**
 * wizard-mascot-done: what the done screen counts. One rule, so the count the
 * parent is promised is the list Guides then shows.
 *
 * - A guide matches when suitsChild says true: every switch tag it has (080)
 *   is within what the child's answers (079) say they can do. "Nothing to
 *   compare" is not a match.
 * - Toys carry no switch tags, so a toy matches when it is switch-adapted,
 *   published and not paused — whatever the child (the spec's rule).
 *
 * suitsChild and the labels are values from ./index, which imports this file
 * back. Both are read only when a function here runs, after both modules have
 * loaded, so the cycle is safe.
 */
import { suitsChild, SWITCH_FORCE_LABEL, SWITCH_TARGET_LABEL } from './index'
import type { ChildProfile, Toy, Tutorial } from './index'

export function matchesForChild(
  child: Pick<ChildProfile, 'press_force' | 'aim' | 'hold'>,
  guides: Pick<Tutorial, 'id' | 'switch_target' | 'switch_force' | 'switch_hold'>[],
  toys: (Pick<Toy, 'id' | 'switch_adapted' | 'status'> & { paused_at?: string | null })[]
): { guideIds: string[]; toyIds: string[] } {
  return {
    guideIds: guides.filter((g) => suitsChild(g, child) === true).map((g) => g.id),
    toyIds: toys.filter((t) => t.switch_adapted && t.status === 'published' && !t.paused_at).map((t) => t.id),
  }
}

/**
 * "a light press with a big button" — MB's "that suit a palm press with a big
 * button", said from the answers the profile has. Null when there is neither a
 * press nor an aim answer; the screen then says "your child".
 */
export function childNeedsLine(child: Pick<ChildProfile, 'press_force' | 'aim'>): string | null {
  const press = child.press_force ? `a ${SWITCH_FORCE_LABEL[child.press_force]}` : null
  const target = child.aim === 'small' || child.aim === 'large' ? `a ${SWITCH_TARGET_LABEL[child.aim]}` : null
  return press && target ? `${press} with ${target}` : (press ?? target)
}
```

In `packages/types/src/index.ts`, beside the other named re-exports at the top (named, not `export *` — see the comment there):

```ts
export { matchesForChild, childNeedsLine } from './child-matches'
```

Run: `git grep -n "Toy\b.*paused_at\|paused_at?:" -- packages/types/src/index.ts` → batch 3's `paused_at?: string | null` on `Toy`. If it is there, simplify the `toys` parameter to `Pick<Toy, 'id' | 'switch_adapted' | 'status' | 'paused_at'>[]`.

- [ ] **Step 4: Two more poses**

Render `think` and `party` from web's `SplatMascot` (the board's bear, verbatim) to PNGs the size of the existing ones' source, with motion stopped. In a scratch file outside the repo (`$TMPDIR/mascots.mjs`), run from `packages/web` with `node`:

```js
import { chromium } from '@playwright/test'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { SplatMascot } from './components/splat-mascot.tsx'

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 3 })
await page.emulateMedia({ reducedMotion: 'reduce' })
for (const pose of ['think', 'party']) {
  await page.setContent(`<body style="margin:0;background:transparent">${renderToStaticMarkup(createElement(SplatMascot, { width: 132, pose }))}</body>`)
  await page.locator('svg').first().screenshot({ path: `../mobile/assets/mascot-${pose}.png`, omitBackground: true })
}
await browser.close()
```

(If `node` cannot load the `.tsx` import directly, run it with `pnpm exec tsx $TMPDIR/mascots.mjs` from `packages/web`, which the web package already uses for its scripts — `grep -n tsx packages/web/package.json`.) Then: `file packages/mobile/assets/mascot-think.png packages/mobile/assets/mascot-party.png` → `PNG image data, 396 x …, 8-bit/color RGBA`. Open both and check the bear matches `mascot-wave.png`'s colours (#A7BDE8 body). The scratch script is not committed.

In `packages/mobile/components/ui/TabHero.tsx`, `MASCOT` becomes:

```tsx
const MASCOT = {
  wave: require('../../assets/mascot-wave.png'),
  hold: require('../../assets/mascot-hold.png'),
  // wizard-mascot-done: the wizard's other two poses, rendered the same way.
  think: require('../../assets/mascot-think.png'),
  party: require('../../assets/mascot-party.png'),
}
```

- [ ] **Step 5: The done screen**

`packages/mobile/components/profile/child-done.tsx`:

```tsx
// packages/mobile/components/profile/child-done.tsx
// The wizard's last screen (MB is_wizard, wDone): the party bear, "{name}'s
// profile is ready", what the answers found, and See the matches. Counts come
// from the two public lists through matchesForChild, so the number promised is
// the list Guides shows. A failed read drops the sentence, never the screen.
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { childNeedsLine, matchesForChild, type ChildProfile, type Toy, type Tutorial } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { Mascot } from '../ui/TabHero'

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

export function ChildDone({ child }: { child: Pick<ChildProfile, 'name' | 'press_force' | 'aim' | 'hold'> }) {
  const router = useRouter()
  const [found, setFound] = useState<{ guides: number; toys: number } | null>(null)

  useEffect(() => {
    let ignore = false
    Promise.all([apiClient.get<Tutorial[]>('/api/public/tutorials'), apiClient.get<Toy[]>('/api/public/toys')])
      .then(([guides, toys]) => {
        const m = matchesForChild(child, guides, toys)
        if (!ignore) setFound({ guides: m.guideIds.length, toys: m.toyIds.length })
      })
      .catch((err) => console.error('[ChildDone] match fetch failed:', err))
    return () => {
      ignore = true
    }
    // The answers are final by now; one read on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const name = child.name?.trim()
  return (
    <View style={styles.done}>
      <Mascot pose="party" size={132} />
      <Text accessibilityRole="header" style={styles.heading}>
        {name ? `${name}'s profile is ready` : "Your child's profile is ready"}
      </Text>
      {found ? (
        <Text style={styles.line}>
          We found <Text style={styles.strong}>{plural(found.guides, 'guide')}</Text> and{' '}
          <Text style={styles.strong}>{plural(found.toys, 'toy')}</Text> that suit {childNeedsLine(child) ?? 'your child'}.
        </Text>
      ) : null}
      <Button
        label="See the matches"
        onPress={() => router.replace(found?.guides ? '/guides?suits=1' : '/guides')}
        style={styles.cta}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  done: { alignItems: 'center', paddingVertical: theme.spacing(6) },
  heading: { fontFamily: theme.fonts.display, fontSize: 25, color: theme.colors.text, marginTop: theme.spacing(4), textAlign: 'center' },
  line: {
    fontFamily: theme.fonts.regular,
    fontSize: 14.5,
    lineHeight: 22,
    color: theme.colors.muted,
    textAlign: 'center',
    maxWidth: 280,
    marginTop: theme.spacing(2.5),
  },
  strong: { fontFamily: theme.fonts.black, color: theme.colors.ink },
  cta: { marginTop: theme.spacing(5) },
})
```

(Check `Button` takes `style`: `grep -n "style" packages/mobile/components/ui/Button.tsx`; if not, wrap it in `<View style={styles.cta}>`.)

- [ ] **Step 6: The wizard**

In `packages/mobile/components/profile/child-wizard.tsx`:
- Imports: `import { Mascot, type MascotPose } from '../ui/TabHero'` and `import { ChildDone } from './child-done'`.
- Delete the header line `// ponytail: no mascot art on mobile yet; its lines are carried as plain text.`
- Add `pose: MascotPose` to the `STEPS` element type and a `pose` to each entry: about `'wave'`; the four questions from `(['think', 'hold', 'think', 'hold'] as const)[i]`; room `'party'`; play `'party'`; measure `'think'`.
- Add `const [done, setDone] = useState(false)` after `const [step, setStep] = useState(0)`.
- `next` becomes:

```tsx
  function next() {
    if (step < STEPS.length - 1) setStep(step + 1)
    else setDone(true)
  }
```

  (the `PENDING(wizard-mascot-done)` comment goes with the old line.)
- Replace `<Text style={styles.line}>{current.line}</Text>` with the board's bubble (MB:1346–1349):

```tsx
      <View style={styles.says}>
        <Mascot pose={current.pose} size={74} />
        <Text style={styles.saysText}>{current.line}</Text>
      </View>
```

- Return the done screen in place of the steps once finished — directly after `const current = STEPS[step]`:

```tsx
  if (done) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <ChildDone child={draft} />
      </ScrollView>
    )
  }
```

- Styles: delete `line`, add:

```tsx
  says: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 13,
    borderRadius: 18,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.accentFaint,
    marginBottom: theme.spacing(5),
  },
  saysText: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: 13.5, lineHeight: 20, color: theme.colors.ink },
```

- [ ] **Step 7: Guides opens filtered**

In `packages/mobile/components/home/library-screen.tsx`:
- `import { useLocalSearchParams, useRouter } from 'expo-router'`.
- After `const [suitsOnly, setSuitsOnly] = useState(false)` add:

```tsx
  // wizard-mascot-done: the done screen's "See the matches" opens this tab with
  // suits=1. An effect, not the initial state: the tab may already be mounted.
  const { suits: suitsParam } = useLocalSearchParams<{ suits?: string }>()
  useEffect(() => {
    if (suitsParam === '1') setSuitsOnly(true)
  }, [suitsParam])
```

- [ ] **Step 8: Parity**

In `scripts/parity/app-screen-map.json`, `wizard` entry: delete the rule `{ "type": "copy", "match": "board paragraphs absent", "why": "pending", "pending": "wizard-mascot-done" }`. Keep the `extra Skip` rule.

- [ ] **Step 9: Run the tests to see them pass**

Run the commands from Step 2 → PASS. `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/ui tests/unit/components/profile` → PASS. `pnpm typecheck` → exit 0.

- [ ] **Step 10: Ship the item**

Set `shipped: true` on `'wizard-mascot-done'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)` (the parity-exemption test passes only because Step 8 removed the rule). Then, from `packages/web`, `node ../../scripts/parity/app.js --id wizard` with the stack up (`./scripts/parity/stack.sh up`): if "board paragraphs absent" still reports, it is the six-screen order ("follows the code" 10) — add `{ "type": "copy", "match": "board paragraphs absent", "why": "intended", "reason": "The wizard keeps 079's six questions before the board's Play and Measurements; the board's Hands and Movement have no columns." }`.

- [ ] **Step 11: Commit**

```bash
git status --short
git add packages/types/src/child-matches.ts packages/types/src/index.ts packages/mobile/components/profile/child-done.tsx packages/mobile/assets/mascot-think.png packages/mobile/assets/mascot-party.png packages/mobile/components/ui/TabHero.tsx packages/mobile/components/profile/child-wizard.tsx packages/mobile/components/home/library-screen.tsx scripts/parity/app-screen-map.json packages/web/tests/unit/lib/child-matches.test.ts packages/mobile/tests/unit/components/profile/child-wizard.test.tsx packages/mobile/tests/unit/components/home/library-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(child-profile): the bear on every wizard step and a profile-ready screen with the matches

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---
## Slice 6

### Task 18: Edit the Learn course outline in Site content (`site-content-learn-legal-editing`)

Decided 2026-09-30: Learn only; Legal stays code-only, never editable from an admin account. The outline moves from `packages/web/lib/learn-course.ts` to `packages/types/src/learn-course.ts` (the API merges against it and mobile reads it) and becomes the default under one `site_content` row. The key is `learn-course`, not the spec's `learn_course`: 065's CHECK and the admin PUT both require `^[a-z][a-z0-9-]{1,60}$` ("follows the code" 1). Lessons keep `kind: 'read' | 'build' | 'quiz'` and the editor labels `quiz` "Checkpoint", as `learn-home.tsx` already does; the course title, "Shown as" and the outcome exist only in the saved value — the code default has none, and each page keeps its own words until one is saved ("follows the code" 2). Lessons stay pages in code, so the editor renames, re-times and re-kinds them and reorders units, but adds nothing. A saved value can only rearrange what the code has: unknown slugs are ignored, units missing from the saved order are appended in default order, and a lesson never moves to another unit (Review Focus 5).

Mobile Learn is six flat articles (`packages/mobile/lib/learn-content.ts`) with no units or lessons, so the app reads only the course title, the outcome and "Shown as" ("follows the code" 3).

No migration: `site_content.value` is free jsonb (065) and this slice's numbers are 120–121. The admin PUT is the only writer outside an admin's own PostgREST session, so the limits live in `readLearnCourse` (one check, not two — flagged against Global Constraints' "checked twice"), and `mergeLearnCourse` falls back to the default for any value it cannot read, so a hand-edited row can never take the course down.

"Shown as": **Free** changes nothing. **Free, sign-in needed** sends a signed-out web reader of any `/learn` page to `/login?next=/learn`. **Hidden** replaces every `/learn` page with "Course hidden" on web, and the Learn screen with the same line on mobile. Mobile treats sign-in-needed as Free: its articles ship inside the app. (Product questions for Byron, in the report: whether Hidden should hide `/learn/ask-an-expert` too, whether an admin should still see a hidden course, and whether mobile should honour sign-in-needed.)

**Files:**
- Create: `packages/types/src/learn-course.ts`
- Delete: `packages/web/lib/learn-course.ts`
- Create: `packages/web/components/learn-course-context.tsx`, `packages/web/components/learn-course-editor.tsx`, `packages/web/app/learn/layout.tsx`
- Modify: `packages/types/src/index.ts` (re-exports)
- Modify: `packages/api/src/routes/public.ts` (`GET /learn-course`), `packages/api/src/routes/admin.ts` (`PUT /content/:key`)
- Modify: `packages/web/components/learn-home.tsx`, `packages/web/components/learn-shell.tsx`, `packages/web/components/site-content-editor.tsx`, `packages/web/app/admin/content/page.tsx`
- Modify: `packages/mobile/components/explore/learn-hub.tsx`
- Test: `packages/web/tests/unit/lib/learn-course-merge.test.ts` (new), `packages/web/tests/unit/components/learn-course-editor.test.tsx` (new), `packages/api/tests/integration/public/learn-course.test.ts` (new), `packages/web/tests/unit/lib/learn-course.test.ts`, `packages/web/tests/unit/app/learn-hub.test.tsx`, `packages/mobile/tests/unit/components/explore/learn-hub.test.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: 065's `site_content` (anon read, admin write), the admin `PUT /api/admin/content/:key`.
- Produces: from `@splat-connect/types` — `LEARN_COURSE: LearnCourse` (the default), `LEARN_SHOWN_AS`, `LESSON_KIND_LABEL`, types `LearnCourse { title: string | null; outcome: string | null; shown_as: LearnShownAs; units: LearnUnit[] }`, `LearnUnit { id; n; title; blurb; tint; lessons: LearnLesson[] }`, `LearnLesson { slug; title; minutes; kind; blurb }`, `LessonKind`, `LearnShownAs`, `LearnCourseSaved`; functions `readLearnCourse(v: unknown): { value: LearnCourseSaved } | { error: string }`, `mergeLearnCourse(saved: unknown): LearnCourse`, `learnLessons(c)`, `lessonBySlug(c, slug)`, `unitOf(c, slug)`, `nextAfter(c, slug)`, `courseHours(c)`. `GET /api/public/learn-course → LearnCourse` (merged; `n` is the unit's position). Web `useLearnCourse()` / `LearnCourseProvider` (`components/learn-course-context.tsx`).

Copy (WB:5501–5509): "The course" · "Course title" · "Shown as" · "Free" / "Free, sign-in needed" / "Hidden" · "What a reader can do by the end" · "Units" · "Reorder or rename here; open a unit to edit its lessons, their length and whether each one is a read, a build or a checkpoint." · aria "Unit {n} title" · "Unit {n} blurb" · "Edit lessons in unit {n}" (button text "Lessons") · "Move unit {n} up" · the unit's meta "{k} lessons · {m} min" (WB:9806). WB's "Add a unit" is left out: the spec says units cannot be added. "Save changes", "Saving…" and "Saved." are the Home tab's (existing). Flagged, no board source (already in the header's list): "Lesson", "Minutes", "Kind", the kind options "Read" / "Build" / "Checkpoint" (learn-home's existing `KIND_LABEL`), and "Course hidden".

- [ ] **Step 1: Write the failing tests**

`packages/web/tests/unit/lib/learn-course-merge.test.ts`:

```ts
/**
 * site-content-learn-legal-editing: a saved outline can rename, re-time,
 * re-kind and reorder what the code has — never add to it, never move a
 * lesson between units, never break the course (Review Focus 5).
 */
import { describe, it, expect } from 'vitest'
import { LEARN_COURSE, learnLessons, mergeLearnCourse, readLearnCourse } from '@splat-connect/types'

const lesson = (slug: string, over: object = {}) => ({ slug, title: slug, minutes: 5, kind: 'read', ...over })

describe('mergeLearnCourse', () => {
  it('is the code default when nothing is saved', () => {
    const c = mergeLearnCourse(null)
    expect(c).toEqual(LEARN_COURSE)
    expect(c.units).toHaveLength(6)
    expect(learnLessons(c)).toHaveLength(16)
    expect(c).toMatchObject({ title: null, outcome: null, shown_as: 'free' })
  })

  it('takes the course fields and the saved unit order, appending missing units in default order', () => {
    const c = mergeLearnCourse({
      title: 'Toy adaptation, start to finish',
      shown_as: 'sign_in',
      outcome: 'Adapt a battery toy for a switch.',
      units: [{ id: 'handover', title: 'Hand it over', blurb: '', lessons: [] }],
    })
    expect(c).toMatchObject({ title: 'Toy adaptation, start to finish', shown_as: 'sign_in', outcome: 'Adapt a battery toy for a switch.' })
    expect(c.units.map((u) => u.id)).toEqual(['handover', 'start-here', 'bench', 'connector', 'first-toys', 'own-switch'])
    // n is the position, so "Unit 1" is whichever unit comes first now.
    expect(c.units.map((u) => u.n)).toEqual([1, 2, 3, 4, 5, 6])
    // A blank blurb keeps the code's.
    expect(c.units[0].blurb).toBe(LEARN_COURSE.units.find((u) => u.id === 'handover')!.blurb)
  })

  it('ignores unknown slugs and keeps every lesson in its own unit', () => {
    const c = mergeLearnCourse({
      units: [
        {
          id: 'start-here',
          title: 'Start here',
          blurb: 'b',
          lessons: [
            lesson('handover'), // Unit 6's — not movable here
            lesson('nope'), // no such lesson
            lesson('switch-types', { title: 'Switches', minutes: 7, kind: 'build' }),
          ],
        },
      ],
    })
    const start = c.units.find((u) => u.id === 'start-here')!
    expect(start.lessons.map((l) => l.slug)).toEqual([
      'switch-types', 'toy-adaptation-101', 'how-a-switch-works', 'choosing-a-toy', 'checkpoint-1',
    ])
    expect(start.lessons[0]).toMatchObject({ title: 'Switches', minutes: 7, kind: 'build' })
    expect(c.units.find((u) => u.id === 'handover')!.lessons.map((l) => l.slug)).toContain('handover')
    expect(learnLessons(c)).toHaveLength(16)
  })

  it('falls back to the default for a value it cannot read', () => {
    expect(mergeLearnCourse({ units: 'everything' })).toEqual(LEARN_COURSE)
    expect(mergeLearnCourse([1, 2])).toEqual(LEARN_COURSE)
  })
})

describe('readLearnCourse', () => {
  const unit = (lessons: object[]) => ({ units: [{ id: 'start-here', title: 'Start here', blurb: '', lessons }] })

  it('refuses each limit with a sentence', () => {
    for (const [value, error] of [
      [unit([lesson('switch-types', { minutes: 0 })]), 'A lesson length must be a whole number of minutes from 1 to 240.'],
      [unit([lesson('switch-types', { minutes: 2.5 })]), 'A lesson length must be a whole number of minutes from 1 to 240.'],
      [unit([lesson('switch-types', { kind: 'video' })]), 'A lesson is a read, a build or a checkpoint.'],
      [unit([lesson('switch-types', { title: '' })]), 'A lesson title must be 1 to 80 characters.'],
      [{ title: 'x'.repeat(81) }, 'The course title must be 1 to 80 characters.'],
      [{ outcome: 'x'.repeat(401) }, 'What a reader can do by the end must be 400 characters or fewer.'],
      [{ shown_as: 'members' }, 'Shown as must be free, sign_in or hidden.'],
      [{ units: [{ id: 'start-here', title: 'x'.repeat(81), blurb: '', lessons: [] }] }, 'A unit title must be 1 to 80 characters.'],
      [{ units: [{ id: 'start-here', title: 'Start', blurb: 'x'.repeat(301), lessons: [] }] }, 'A unit blurb must be 300 characters or fewer.'],
    ] as const) {
      expect(readLearnCourse(value), JSON.stringify(value).slice(0, 60)).toEqual({ error })
    }
  })

  it('returns the value trimmed', () => {
    expect(readLearnCourse({ title: '  Toy adaptation  ', units: [] })).toEqual({ value: { title: 'Toy adaptation', units: [] } })
  })
})
```

`packages/web/tests/unit/components/learn-course-editor.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { LEARN_COURSE } from '@splat-connect/types'

const put = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { put: (...a: unknown[]) => put(...a) } }))
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

beforeEach(() => {
  vi.clearAllMocks()
  put.mockResolvedValue({})
})

describe('LearnCourseEditor', () => {
  it('saves the course fields, a renamed unit, the new order and a lesson change as one value', async () => {
    const { LearnCourseEditor } = await import('@/components/learn-course-editor')
    render(<LearnCourseEditor course={LEARN_COURSE} />)

    fireEvent.change(screen.getByLabelText('Course title'), { target: { value: 'Toy adaptation, start to finish' } })
    fireEvent.change(screen.getByLabelText('Shown as'), { target: { value: 'sign_in' } })
    fireEvent.change(screen.getByLabelText('Unit 1 title'), { target: { value: 'Begin here' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move unit 2 up' }))
    // Unit 2 is now "Start here" (renamed "Begin here"); open its lessons.
    fireEvent.click(screen.getByRole('button', { name: 'Edit lessons in unit 2' }))
    const first = screen.getAllByRole('group', { name: /^Lesson / })[0]
    fireEvent.change(within(first).getByLabelText('Minutes'), { target: { value: '9' } })
    fireEvent.change(within(first).getByLabelText('Kind'), { target: { value: 'build' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByText('Saved.')
    const [path, body] = put.mock.calls[0] as [string, { value: Record<string, unknown> & { units: any[] } }]
    expect(path).toBe('/api/admin/content/learn-course')
    expect(body.value).toMatchObject({ title: 'Toy adaptation, start to finish', shown_as: 'sign_in' })
    expect(body.value.units.map((u) => u.id)).toEqual(['bench', 'start-here', 'connector', 'first-toys', 'own-switch', 'handover'])
    expect(body.value.units[1].title).toBe('Begin here')
    expect(body.value.units[1].lessons[0]).toEqual({ slug: 'toy-adaptation-101', title: 'Toy adaptation 101', minutes: 9, kind: 'build' })
    expect(refresh).toHaveBeenCalled()
  })

  it('offers no way to add a unit or a lesson', async () => {
    const { LearnCourseEditor } = await import('@/components/learn-course-editor')
    render(<LearnCourseEditor course={LEARN_COURSE} />)
    expect(screen.queryByRole('button', { name: /Add a unit|Add a lesson/ })).toBeNull()
  })

  it("shows the API's sentence when the save is refused", async () => {
    put.mockRejectedValue(new Error('A lesson length must be a whole number of minutes from 1 to 240.'))
    const { LearnCourseEditor } = await import('@/components/learn-course-editor')
    render(<LearnCourseEditor course={LEARN_COURSE} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('A lesson length must be a whole number of minutes from 1 to 240.')
  })
})
```

`packages/api/tests/integration/public/learn-course.test.ts`:

```ts
/**
 * site-content-learn-legal-editing: the course outline is one site_content
 * row ('learn-course'), checked on the way in and merged over the code
 * default on the way out. Writes the real key, so it restores what was there.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let admin: TestUser
let before: { value: unknown } | null = null

const put = (value: unknown) =>
  app.request('/api/admin/content/learn-course', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
const read = async () => (await (await app.request('/api/public/learn-course')).json()) as Record<string, any>

beforeAll(async () => {
  admin = await createTestUser('admin')
  const { data } = await adminClient().from('site_content').select('value').eq('key', 'learn-course').maybeSingle()
  before = data
  await adminClient().from('site_content').delete().eq('key', 'learn-course')
})

afterAll(async () => {
  if (before) await adminClient().from('site_content').upsert({ key: 'learn-course', value: before.value })
  else await adminClient().from('site_content').delete().eq('key', 'learn-course')
  await deleteTestUser(admin.id)
})

describe('GET /api/public/learn-course', () => {
  it("serves the code's course when nothing is saved", async () => {
    const c = await read()
    expect(c.units).toHaveLength(6)
    expect(c).toMatchObject({ title: null, outcome: null, shown_as: 'free' })
  })

  it('serves a saved outline merged over the default', async () => {
    const res = await put({
      title: 'Toy adaptation, start to finish',
      shown_as: 'sign_in',
      units: [{ id: 'handover', title: 'Hand it over', blurb: '', lessons: [{ slug: 'handover', title: 'Checks', minutes: 6, kind: 'read' }] }],
    })
    expect(res.status).toBe(200)
    const c = await read()
    expect(c).toMatchObject({ title: 'Toy adaptation, start to finish', shown_as: 'sign_in' })
    expect(c.units[0]).toMatchObject({ id: 'handover', n: 1 })
    expect(c.units[0].lessons[0]).toMatchObject({ slug: 'handover', title: 'Checks' })
    expect(c.units).toHaveLength(6)
    // The row holds what was checked, not what was sent.
    const { data } = await adminClient().from('site_content').select('value').eq('key', 'learn-course').single()
    expect((data!.value as { title: string }).title).toBe('Toy adaptation, start to finish')
  })

  it('refuses a minutes of 0 or a kind of "video" with a sentence, and keeps the saved value', async () => {
    for (const [lesson, error] of [
      [{ slug: 'handover', title: 'Checks', minutes: 0, kind: 'read' }, 'A lesson length must be a whole number of minutes from 1 to 240.'],
      [{ slug: 'handover', title: 'Checks', minutes: 6, kind: 'video' }, 'A lesson is a read, a build or a checkpoint.'],
    ] as const) {
      const res = await put({ units: [{ id: 'handover', title: 'Hand it over', blurb: '', lessons: [lesson] }] })
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error })
    }
    expect((await read()).title).toBe('Toy adaptation, start to finish')
  })
})
```

In `packages/web/tests/unit/lib/learn-course.test.ts`, replace `import { UNITS, LESSONS, lessonBySlug, unitOf, nextAfter, COURSE_HOURS } from '@/lib/learn-course'` with:

```ts
import { LEARN_COURSE, learnLessons, courseHours, lessonBySlug as bySlug, unitOf as unitIn, nextAfter as after } from '@splat-connect/types'

// The code default — what every page shows until an admin saves an outline.
const UNITS = LEARN_COURSE.units
const LESSONS = learnLessons(LEARN_COURSE)
const COURSE_HOURS = courseHours(LEARN_COURSE)
const lessonBySlug = (slug: string) => bySlug(LEARN_COURSE, slug)
const unitOf = (slug: string) => unitIn(LEARN_COURSE, slug)
const nextAfter = (slug: string) => after(LEARN_COURSE, slug)
```

In `packages/web/tests/unit/app/learn-hub.test.tsx`, replace `import { UNITS, LESSONS, COURSE_HOURS } from '@/lib/learn-course'` with:

```ts
import { LEARN_COURSE, learnLessons, courseHours } from '@splat-connect/types'

// Rendered with no provider: the context's default is the code's course.
const UNITS = LEARN_COURSE.units
const LESSONS = learnLessons(LEARN_COURSE)
const COURSE_HOURS = courseHours(LEARN_COURSE)
```

In `packages/mobile/tests/unit/components/explore/learn-hub.test.tsx` (as Task 1 left it):
- After the `expo-router` mock add:

```tsx
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
```

- In `beforeEach`, after `jest.clearAllMocks()`: `mockGet.mockRejectedValue(new Error('offline'))` — every existing test then runs on the app's own words, as before.
- Append inside `describe('LearnHub')`:

```tsx
  // site-content-learn-legal-editing: the app reads the course's title, outcome and "Shown as".
  it("shows a saved course title and outcome in place of the app's intro", async () => {
    mockUseLearnProgress.mockReturnValue({ read: new Set(), markRead: jest.fn(), next: LEARN_ARTICLES[0], count: 0 })
    mockGet.mockResolvedValue({ title: 'Toy adaptation, start to finish', outcome: 'Adapt a battery toy for a switch.', shown_as: 'free', units: [] })
    render(<LearnHub />)
    expect(await screen.findByText('Toy adaptation, start to finish')).toBeTruthy()
    expect(screen.getByText('Adapt a battery toy for a switch.')).toBeTruthy()
    expect(screen.queryByText(/How switch adaptation works/)).toBeNull()
  })

  it('says "Course hidden" and lists nothing when an admin hid the course', async () => {
    mockUseLearnProgress.mockReturnValue({ read: new Set(), markRead: jest.fn(), next: LEARN_ARTICLES[0], count: 0 })
    mockGet.mockResolvedValue({ title: null, outcome: null, shown_as: 'hidden', units: [] })
    render(<LearnHub />)
    expect(await screen.findByText('Course hidden')).toBeTruthy()
    expect(screen.queryByText('Start here')).toBeNull()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/learn-course-merge.test.ts tests/unit/components/learn-course-editor.test.tsx` → FAIL (`mergeLearnCourse is not a function`; cannot resolve `@/components/learn-course-editor`).
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/public/learn-course.test.ts` → FAIL (404).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/explore/learn-hub.test.tsx` → FAIL ('Toy adaptation, start to finish' not found).

- [ ] **Step 3: Move the course to types, with the merge**

Run first: `git grep -nE "\b(unitOf|nextAfter|lessonBySlug|learnLessons|courseHours|LEARN_COURSE)\b" -- packages/types/src` → no output (the names are free).

Create `packages/types/src/learn-course.ts`. Its body is `packages/web/lib/learn-course.ts` moved, with these changes, followed by the merge:
- Keep the file's header comment, changing "Related files" to name `packages/web/components/learn-course-context.tsx` (the merged course every Learn page reads) instead of web's own paths, and adding: "An admin can rename, re-time, re-kind and reorder it in Site content (`site_content` key `learn-course`); `mergeLearnCourse` lays that over this default."
- `export type Lesson` → `export type LearnLesson`; `export type Unit` → `export type LearnUnit`, with `id: string` as its first field (`/** Stable across reorders and renames: what a saved outline names. */`).
- `export const UNITS: Unit[]` → `const UNITS: LearnUnit[]` (not exported), each unit gaining its `id` first: `'start-here'` (n 1), `'bench'` (2), `'connector'` (3), `'first-toys'` (4), `'own-switch'` (5), `'handover'` (6). Lessons, blurbs, tints and comments are moved unchanged.
- Delete `LESSONS`, `lessonBySlug`, `unitOf`, `nextAfter` and `COURSE_HOURS` (replaced below by functions over a course).

Then append:

```ts
/** "Shown as" in Site content (WB admin_content), in the board's words. */
export const LEARN_SHOWN_AS = [
  { value: 'free', label: 'Free' },
  { value: 'sign_in', label: 'Free, sign-in needed' },
  { value: 'hidden', label: 'Hidden' },
] as const
export type LearnShownAs = (typeof LEARN_SHOWN_AS)[number]['value']

/** A quiz is shown as a checkpoint everywhere; the stored value stays `quiz`. */
export const LESSON_KIND_LABEL: Record<LessonKind, string> = { read: 'Read', build: 'Build', quiz: 'Checkpoint' }

/**
 * The course as every page reads it. The title, outcome and "Shown as" exist
 * only once an admin saves them: null title or outcome means "the page's own
 * words". `n` is the unit's position, so "Unit 1" is whichever comes first.
 */
export type LearnCourse = {
  title: string | null
  outcome: string | null
  shown_as: LearnShownAs
  units: LearnUnit[]
}

export const LEARN_COURSE: LearnCourse = { title: null, outcome: null, shown_as: 'free', units: UNITS }

/** What Site content saves under `learn-course`, after readLearnCourse. */
export type LearnCourseSaved = {
  title?: string
  outcome?: string
  shown_as?: LearnShownAs
  units?: {
    id: string
    title: string
    blurb: string
    lessons: { slug: string; title: string; minutes: number; kind: LessonKind }[]
  }[]
}

/** Every lesson, in teaching order. */
export const learnLessons = (c: LearnCourse): LearnLesson[] => c.units.flatMap((u) => u.lessons)

export const lessonBySlug = (c: LearnCourse, slug: string): LearnLesson | undefined =>
  learnLessons(c).find((l) => l.slug === slug)

export const unitOf = (c: LearnCourse, slug: string): LearnUnit | undefined =>
  c.units.find((u) => u.lessons.some((l) => l.slug === slug))

/** The lesson after this one, or undefined at the end of the course. */
export function nextAfter(c: LearnCourse, slug: string): LearnLesson | undefined {
  const all = learnLessons(c)
  const i = all.findIndex((l) => l.slug === slug)
  return i === -1 ? undefined : all[i + 1]
}

/** Hours, to the nearest half. What the course home advertises. */
export const courseHours = (c: LearnCourse): number =>
  Math.round(learnLessons(c).reduce((n, l) => n + l.minutes, 0) / 30) / 2

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const trimmed = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const KINDS: readonly string[] = ['read', 'build', 'quiz']
const SHOWN: readonly string[] = LEARN_SHOWN_AS.map((o) => o.value)

/**
 * The admin PUT's check for `learn-course` (Global Constraints' limits). The
 * first problem, as a sentence an admin can act on, or the value trimmed.
 * Slugs and unit ids are not checked against the course: mergeLearnCourse
 * ignores what the code does not have, so a lesson renamed in code never
 * makes an old saved value unsaveable.
 */
export function readLearnCourse(v: unknown): { value: LearnCourseSaved } | { error: string } {
  if (!isObj(v)) return { error: 'Send the course as an object.' }
  const out: LearnCourseSaved = {}
  if (v.title !== undefined) {
    const t = trimmed(v.title)
    if (t.length < 1 || t.length > 80) return { error: 'The course title must be 1 to 80 characters.' }
    out.title = t
  }
  if (v.outcome !== undefined) {
    if (typeof v.outcome !== 'string' || v.outcome.trim().length > 400) {
      return { error: 'What a reader can do by the end must be 400 characters or fewer.' }
    }
    out.outcome = v.outcome.trim()
  }
  if (v.shown_as !== undefined) {
    if (!SHOWN.includes(v.shown_as as string)) return { error: 'Shown as must be free, sign_in or hidden.' }
    out.shown_as = v.shown_as as LearnShownAs
  }
  if (v.units !== undefined) {
    if (!Array.isArray(v.units)) return { error: 'Units must be a list.' }
    out.units = []
    for (const u of v.units) {
      if (!isObj(u) || typeof u.id !== 'string') return { error: 'Each unit needs its id.' }
      const title = trimmed(u.title)
      if (title.length < 1 || title.length > 80) return { error: 'A unit title must be 1 to 80 characters.' }
      const blurb = trimmed(u.blurb)
      if (blurb.length > 300) return { error: 'A unit blurb must be 300 characters or fewer.' }
      if (!Array.isArray(u.lessons)) return { error: 'Each unit needs its lessons as a list.' }
      const lessons: NonNullable<LearnCourseSaved['units']>[number]['lessons'] = []
      for (const l of u.lessons) {
        if (!isObj(l) || typeof l.slug !== 'string') return { error: 'Each lesson needs its slug.' }
        const lt = trimmed(l.title)
        if (lt.length < 1 || lt.length > 80) return { error: 'A lesson title must be 1 to 80 characters.' }
        const m = l.minutes
        if (typeof m !== 'number' || !Number.isInteger(m) || m < 1 || m > 240) {
          return { error: 'A lesson length must be a whole number of minutes from 1 to 240.' }
        }
        if (!KINDS.includes(l.kind as string)) return { error: 'A lesson is a read, a build or a checkpoint.' }
        lessons.push({ slug: l.slug, title: lt, minutes: m, kind: l.kind as LessonKind })
      }
      out.units.push({ id: u.id, title, blurb, lessons })
    }
  }
  return { value: out }
}

/**
 * A saved outline laid over the code's (Review Focus 5). Units come in the
 * saved order; units it leaves out follow in default order. Within a unit,
 * lessons come in the saved order with their saved title, minutes and kind;
 * a slug the unit does not have — unknown, or another unit's — is ignored, so
 * a lesson never changes unit; lessons left out follow in default order.
 * Anything readLearnCourse refuses is the default, whole.
 */
export function mergeLearnCourse(saved: unknown): LearnCourse {
  const read = readLearnCourse(saved)
  if ('error' in read) return LEARN_COURSE
  const s = read.value
  const byId = new Map(UNITS.map((u) => [u.id, u]))
  const seen = new Set<string>()
  const ordered: LearnUnit[] = []
  for (const su of s.units ?? []) {
    const base = byId.get(su.id)
    if (!base || seen.has(su.id)) continue
    seen.add(su.id)
    const own = new Map(base.lessons.map((l) => [l.slug, l]))
    const used = new Set<string>()
    const lessons: LearnLesson[] = []
    for (const sl of su.lessons) {
      const b = own.get(sl.slug)
      if (!b || used.has(sl.slug)) continue
      used.add(sl.slug)
      lessons.push({ ...b, title: sl.title, minutes: sl.minutes, kind: sl.kind })
    }
    lessons.push(...base.lessons.filter((l) => !used.has(l.slug)))
    ordered.push({ ...base, title: su.title, blurb: su.blurb || base.blurb, lessons })
  }
  ordered.push(...UNITS.filter((u) => !seen.has(u.id)))
  return {
    title: s.title ?? null,
    outcome: s.outcome || null,
    shown_as: s.shown_as ?? 'free',
    units: ordered.map((u, i) => ({ ...u, n: i + 1 })),
  }
}
```

In `packages/types/src/index.ts`, with the other named re-exports at the top:

```ts
export {
  LEARN_COURSE, LEARN_SHOWN_AS, LESSON_KIND_LABEL,
  learnLessons, lessonBySlug, unitOf, nextAfter, courseHours, readLearnCourse, mergeLearnCourse,
} from './learn-course'
export type { LearnCourse, LearnCourseSaved, LearnUnit, LearnLesson, LessonKind, LearnShownAs } from './learn-course'
```

`git rm packages/web/lib/learn-course.ts`.

- [ ] **Step 4: The API**

In `packages/api/src/routes/public.ts`, add `mergeLearnCourse` to the `@splat-connect/types` value import, and after `GET /content/home`:

```ts
/**
 * site-content-learn-legal-editing: the Learn course outline, merged over the
 * code's default. Web Learn and mobile Learn both read this; with nothing
 * saved it is the code's course exactly.
 */
publicRoutes.get('/learn-course', async (c) => {
  const { data, error } = await createAnonClient()
    .from('site_content')
    .select('value')
    .eq('key', 'learn-course')
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(mergeLearnCourse(data?.value ?? null))
})
```

In `packages/api/src/routes/admin.ts`, add `import { readLearnCourse } from '@splat-connect/types'`, and in `admin.put('/content/:key', …)` replace the `.upsert({ key, value: body.value, …` argument's `value: body.value` with `value` after adding, directly after the "Send the section as an object." check:

```ts
  // site-content-learn-legal-editing: the course outline is checked, not just
  // stored — every Learn page reads it. The trimmed value is what is saved.
  let value: unknown = body.value
  if (key === 'learn-course') {
    const read = readLearnCourse(body.value)
    if ('error' in read) return c.json({ error: read.error }, 400)
    value = read.value
  }
```

- [ ] **Step 5: Web reads the merged course**

`packages/web/components/learn-course-context.tsx`:

```tsx
'use client'
/**
 * The Learn course as an admin last saved it (site-content-learn-legal-editing).
 * app/learn/layout.tsx fetches it once and provides it; the course home and
 * every lesson's shell read it here. With no provider — a unit test, or the
 * fetch failing — it is the code's own course.
 */
import { createContext, useContext } from 'react'
import { LEARN_COURSE, type LearnCourse } from '@splat-connect/types'

const LearnCourseContext = createContext<LearnCourse>(LEARN_COURSE)

export function LearnCourseProvider({ course, children }: { course: LearnCourse; children: React.ReactNode }) {
  return <LearnCourseContext.Provider value={course}>{children}</LearnCourseContext.Provider>
}

export const useLearnCourse = () => useContext(LearnCourseContext)
```

`packages/web/app/learn/layout.tsx`:

```tsx
/**
 * Every /learn page: the course outline an admin saved (site_content
 * 'learn-course'), merged over the code's, and its "Shown as".
 *
 * - Free: as it always was.
 * - Free, sign-in needed: a signed-out reader goes to sign in, then back to
 *   the course home.
 * - Hidden: "Course hidden" in place of every page.
 *
 * A failed read is the code's course, shown as Free — Learn never goes down
 * because Site content could not be reached.
 */
import { redirect } from 'next/navigation'
import { mergeLearnCourse, type LearnCourse } from '@splat-connect/types'
import { apiClient } from '@/lib/api-client'
import { createServerSupabase } from '@/lib/supabase/server'
import { LearnCourseProvider } from '@/components/learn-course-context'

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const course = await apiClient
    .get<LearnCourse>('/api/public/learn-course')
    .catch(() => mergeLearnCourse(null))

  if (course.shown_as === 'hidden') {
    return (
      <section className="py-16 text-center">
        <h1 className="title-hub">Course hidden</h1>
      </section>
    )
  }
  if (course.shown_as === 'sign_in') {
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/login?next=/learn')
  }
  return <LearnCourseProvider course={course}>{children}</LearnCourseProvider>
}
```

In `packages/web/components/learn-home.tsx`:
- Replace `import { UNITS, LESSONS, COURSE_HOURS, type LessonKind } from '@/lib/learn-course'` with:

```tsx
import { learnLessons, courseHours, LESSON_KIND_LABEL, type LessonKind } from '@splat-connect/types'
import { useLearnCourse } from '@/components/learn-course-context'
```

- Delete the local `const KIND_LABEL: Record<LessonKind, string> = { … }` and rename its uses to `LESSON_KIND_LABEL` (`grep -n "KIND_LABEL" packages/web/components/learn-home.tsx`).
- First lines of `LearnHome`, before `const { ready, done } = useLearnProgress()`:

```tsx
  // The outline an admin saved over the code's (site-content-learn-legal-editing).
  // Same names as the module constants these replaced, so the body is unchanged.
  const course = useLearnCourse()
  const UNITS = course.units
  const LESSONS = learnLessons(course)
  const COURSE_HOURS = courseHours(course)
```

- The `<h1 className="learn-hero__title">` body becomes `{course.title ?? 'Switch adapting toys, from first switch to handover.'}`, and the `<p className="mt-4 max-w-[54ch] …">` that follows becomes:

```tsx
            <p className="mt-4 max-w-[54ch] text-lg leading-[1.6] text-muted [text-wrap:pretty]">
              {course.outcome ?? (
                <>
                  Six short units. You will learn what a switch does, set up a bench without wasting
                  money, master the one soldering job every adaptation needs, then adapt three real toys
                  and build a switch of your own. For instructions on one particular toy, head to the{' '}
                  <Link href="/library" className="text-brand-deep hover:underline">
                    Guides
                  </Link>
                  .
                </>
              )}
            </p>
```

In `packages/web/components/learn-shell.tsx`:
- Replace `import { UNITS, LESSONS, lessonBySlug, unitOf, nextAfter, type LessonKind } from '@/lib/learn-course'` with:

```tsx
import { learnLessons, lessonBySlug, unitOf, nextAfter, type LessonKind } from '@splat-connect/types'
import { useLearnCourse } from '@/components/learn-course-context'
```

- In `LearnShell`, replace the five lines from `const lesson = lessonBySlug(slug)` through `const prev = …` with:

```tsx
  const course = useLearnCourse()
  const UNITS = course.units
  const LESSONS = learnLessons(course)
  const lesson = lessonBySlug(course, slug)
  const unit = unitOf(course, slug)
  const next = nextAfter(course, slug)
  const idx = LESSONS.findIndex((l) => l.slug === slug)
  const prev = idx > 0 ? LESSONS[idx - 1] : undefined
```

  and in the two comments that name `lib/learn-course.ts`, name `@splat-connect/types` learn-course instead.

Run: `git grep -n "lib/learn-course" -- packages` → no output.

- [ ] **Step 6: The editor**

`packages/web/components/learn-course-editor.tsx`:

```tsx
'use client'
/**
 * Site content → Learn course (site-content-learn-legal-editing).
 *
 * The board's two sections: the course (title, "Shown as", what a reader can
 * do by the end) and its units (rename, reorder, open a unit to edit its
 * lessons' titles, lengths and kinds). Lessons are pages in code, so nothing
 * here adds a unit or a lesson — the board's "Add a unit" is left out.
 * One Save writes the whole outline; the API checks it (readLearnCourse) and
 * answers a refusal with the sentence shown here.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CaretUp, Check, ListNumbers } from '@phosphor-icons/react/dist/ssr'
import { LEARN_SHOWN_AS, LESSON_KIND_LABEL, type LearnCourse, type LearnShownAs, type LessonKind } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

const SECTION = 'flex flex-col gap-3.5 rounded-card border-[length:var(--bw)] border-line bg-surface p-[22px] shadow-[var(--shadow-e2),var(--shadow-hi)]'
const SECTION_H = 'm-0 font-display text-[22px] font-extrabold text-ink'
const LABEL = 'mb-[7px] block text-sm font-extrabold text-ink'
const INPUT = 'field h-[50px] bg-canvas'

type EditLesson = { slug: string; title: string; minutes: number; kind: LessonKind }
type EditUnit = { id: string; title: string; blurb: string; lessons: EditLesson[] }

export function LearnCourseEditor({ course }: { course: LearnCourse }) {
  const router = useRouter()
  const [title, setTitle] = useState(course.title ?? '')
  const [shownAs, setShownAs] = useState<LearnShownAs>(course.shown_as)
  const [outcome, setOutcome] = useState(course.outcome ?? '')
  const [units, setUnits] = useState<EditUnit[]>(() =>
    course.units.map((u) => ({
      id: u.id,
      title: u.title,
      blurb: u.blurb,
      lessons: u.lessons.map(({ slug, title, minutes, kind }) => ({ slug, title, minutes, kind })),
    }))
  )
  const [open, setOpen] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const setUnit = (i: number, patch: Partial<EditUnit>) =>
    setUnits(units.map((u, j) => (j === i ? { ...u, ...patch } : u)))
  const setLesson = (i: number, k: number, patch: Partial<EditLesson>) =>
    setUnit(i, { lessons: units[i].lessons.map((l, j) => (j === k ? { ...l, ...patch } : l)) })
  const moveUp = (i: number) =>
    setUnits([...units.slice(0, i - 1), units[i], units[i - 1], ...units.slice(i + 1)])

  async function save() {
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      // A blank title or outcome is left out, so the page keeps its own words.
      await browserApiClient.put('/api/admin/content/learn-course', {
        value: {
          ...(title.trim() ? { title } : {}),
          ...(outcome.trim() ? { outcome } : {}),
          shown_as: shownAs,
          units,
        },
      })
      setSaved(true)
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Try once more.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <section className={SECTION}>
        <h2 className={SECTION_H}>The course</h2>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
          <label className="block">
            <span className={LABEL}>Course title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={INPUT} />
          </label>
          <label className="block">
            <span className={LABEL}>Shown as</span>
            <select value={shownAs} onChange={(e) => setShownAs(e.target.value as LearnShownAs)} className={INPUT}>
              {LEARN_SHOWN_AS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className={LABEL}>What a reader can do by the end</span>
          <textarea
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            rows={3}
            maxLength={400}
            className="field bg-canvas leading-[1.55]"
          />
        </label>
      </section>

      <section className={SECTION}>
        <div>
          <h2 className={SECTION_H}>Units</h2>
          <p className="mt-1.5 max-w-[62ch] text-sm leading-normal text-muted">
            Reorder or rename here; open a unit to edit its lessons, their length and whether each one is a read, a
            build or a checkpoint.
          </p>
        </div>
        <ul className="flex list-none flex-col gap-2.5">
          {units.map((u, i) => {
            const n = i + 1
            const mins = u.lessons.reduce((m, l) => m + l.minutes, 0)
            return (
              <li key={u.id} className="rounded-[18px] border-[length:var(--bw)] border-line bg-canvas p-3.5">
                <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-3 max-sm:grid-cols-[32px_minmax(0,1fr)]">
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 place-items-center rounded-[14px] bg-[var(--b100)] font-display text-sm font-extrabold text-[var(--b700)]"
                  >
                    {n}
                  </span>
                  <span className="flex min-w-0 flex-col gap-2">
                    <input
                      aria-label={`Unit ${n} title`}
                      value={u.title}
                      onChange={(e) => setUnit(i, { title: e.target.value })}
                      maxLength={80}
                      className="field h-[42px] bg-surface text-sm font-extrabold"
                    />
                    <input
                      aria-label={`Unit ${n} blurb`}
                      value={u.blurb}
                      onChange={(e) => setUnit(i, { blurb: e.target.value })}
                      maxLength={300}
                      className="field h-10 bg-surface text-sm font-semibold"
                    />
                  </span>
                  <span className="flex flex-col items-end gap-1.5 max-sm:col-span-2 max-sm:flex-row max-sm:justify-between">
                    <span className="whitespace-nowrap text-xs font-extrabold text-muted">
                      {u.lessons.length} lessons · {mins} min
                    </span>
                    <span className="flex gap-1.5">
                      <button
                        type="button"
                        aria-label={`Edit lessons in unit ${n}`}
                        aria-expanded={open === u.id}
                        onClick={() => setOpen(open === u.id ? null : u.id)}
                        className="btn btn-quiet btn-md text-[13px] shadow-none"
                      >
                        <ListNumbers size={16} weight="bold" aria-hidden="true" /> Lessons
                      </button>
                      <button
                        type="button"
                        aria-label={`Move unit ${n} up`}
                        disabled={i === 0}
                        onClick={() => moveUp(i)}
                        className="btn btn-quiet btn-md w-9 px-0 shadow-none"
                      >
                        <CaretUp size={16} aria-hidden="true" />
                      </button>
                    </span>
                  </span>
                </div>
                {open === u.id && (
                  <ul className="mt-3 flex list-none flex-col gap-2 border-t border-line pt-3">
                    {u.lessons.map((l, k) => (
                      <li key={l.slug}>
                        <fieldset
                          aria-label={`Lesson ${k + 1}`}
                          className="grid grid-cols-[minmax(0,1fr)_96px_140px] gap-2 max-sm:grid-cols-2"
                        >
                          <label className="block max-sm:col-span-2">
                            <span className={LABEL}>Lesson</span>
                            <input
                              value={l.title}
                              onChange={(e) => setLesson(i, k, { title: e.target.value })}
                              maxLength={80}
                              className="field h-10 bg-surface text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className={LABEL}>Minutes</span>
                            <input
                              type="number"
                              min={1}
                              max={240}
                              value={l.minutes}
                              onChange={(e) => setLesson(i, k, { minutes: Number(e.target.value) })}
                              className="field h-10 bg-surface text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className={LABEL}>Kind</span>
                            <select
                              value={l.kind}
                              onChange={(e) => setLesson(i, k, { kind: e.target.value as LessonKind })}
                              className="field h-10 bg-surface text-sm"
                            >
                              {(Object.keys(LESSON_KIND_LABEL) as LessonKind[]).map((kind) => (
                                <option key={kind} value={kind}>
                                  {LESSON_KIND_LABEL[kind]}
                                </option>
                              ))}
                            </select>
                          </label>
                        </fieldset>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-[18px] border-[length:var(--bw)] border-line bg-[var(--b50)] px-5 py-[18px]">
        <button type="button" onClick={save} disabled={saving} className="btn btn-primary px-[26px]">
          <Check size={18} weight="bold" aria-hidden="true" />
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <strong className="text-ink">Saved.</strong>}
      </div>
    </div>
  )
}
```

(A `<fieldset aria-label>` is a `group` role, which the test's `getAllByRole('group', { name: /^Lesson / })` finds. If the test's `getByText('Saved.')` collides with nothing else on the page, keep it as written.)

- [ ] **Step 7: Site content wires the editor in**

In `packages/web/app/admin/content/page.tsx`:
- Replace the two-line `// PENDING(site-content-learn-legal-editing): …` comment with:

```tsx
// Legal stays code-only, never editable from an admin account (decided
// 2026-09-30): a legal edit can force every contributor to accept again.
```

- Import `import { mergeLearnCourse } from '@splat-connect/types'`, and render `<SiteContentEditor rows={rows} learnCourse={mergeLearnCourse(rows.find((r) => r.key === 'learn-course')?.value ?? null)} />`.

In `packages/web/components/site-content-editor.tsx`:
- Import `import { LearnCourseEditor } from '@/components/learn-course-editor'` and `import type { LearnCourse } from '@splat-connect/types'`.
- Signature: `export function SiteContentEditor({ rows, learnCourse }: { rows: ContentRow[]; learnCourse: LearnCourse })`.
- The `learn` tab's `content` becomes `<LearnCourseEditor course={learnCourse} />`.
- In the header comment, replace the **Learn course** bullet with:

```tsx
 * - **Learn course** is the outline — course title, "Shown as", the outcome,
 *   unit names and order, each lesson's title, length and kind
 *   (components/learn-course-editor.tsx). The lesson bodies stay pages in
 *   code, so units and lessons cannot be added here.
```

- [ ] **Step 8: Mobile Learn reads the title, outcome and "Shown as"**

In `packages/mobile/components/explore/learn-hub.tsx` (as Task 1 left it):
- Imports: `import { useEffect, useState } from 'react'`, `import type { LearnCourse } from '@splat-connect/types'`, `import { apiClient } from '../../lib/api-client'`.
- In `LearnHub`, after `const { start, deeper } = learnSections(LEARN_ARTICLES)`:

```tsx
  // site-content-learn-legal-editing: Site content's course title, outcome and
  // "Shown as". The app's articles are flat (no units or lessons), so that is
  // all of the outline it can use; sign-in-needed reads as Free here, because
  // the articles ship inside the app. A failed read keeps the app's own words.
  const [course, setCourse] = useState<LearnCourse | null>(null)
  useEffect(() => {
    let ignore = false
    apiClient
      .get<LearnCourse>('/api/public/learn-course')
      .then((c) => {
        if (!ignore) setCourse(c)
      })
      .catch((err) => console.error('[LearnHub] course fetch failed:', err))
    return () => {
      ignore = true
    }
  }, [])

  if (course?.shown_as === 'hidden') {
    return (
      <Screen>
        <Text style={styles.allRead}>Course hidden</Text>
      </Screen>
    )
  }
```

- Replace the intro `<Text style={styles.intro}>How switch adaptation works, … use Guides.</Text>` with:

```tsx
        {course?.title ? (
          <Text accessibilityRole="header" style={styles.courseTitle}>
            {course.title}
          </Text>
        ) : null}
        <Text style={styles.intro}>
          {course?.outcome ??
            'How switch adaptation works, from first switch to safe finish. For instructions on one toy, use Guides.'}
        </Text>
```

- Style: `courseTitle: { fontFamily: theme.fonts.display, fontSize: 24, lineHeight: 29, color: theme.colors.text, marginBottom: theme.spacing(2) },`.

- [ ] **Step 9: Run the tests to see them pass**

Run the commands from Step 2 → PASS. `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/learn-course.test.ts tests/unit/app/learn-hub.test.tsx tests/unit/app` → PASS. `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/admin/queues.test.ts` → PASS (the generic content PUT is unchanged for other keys). `pnpm typecheck` → exit 0.

- [ ] **Step 10: Ship the item**

The marker went in Step 7. Set `shipped: true` on `'site-content-learn-legal-editing'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 11: Commit**

```bash
git status --short
git add packages/types/src/learn-course.ts packages/web/lib/learn-course.ts packages/types/src/index.ts packages/api/src/routes/public.ts packages/api/src/routes/admin.ts packages/web/components/learn-course-context.tsx packages/web/components/learn-course-editor.tsx packages/web/app/learn/layout.tsx packages/web/components/learn-home.tsx packages/web/components/learn-shell.tsx packages/web/components/site-content-editor.tsx packages/web/app/admin/content/page.tsx packages/mobile/components/explore/learn-hub.tsx packages/web/tests/unit/lib/learn-course-merge.test.ts packages/web/tests/unit/components/learn-course-editor.test.tsx packages/api/tests/integration/public/learn-course.test.ts packages/web/tests/unit/lib/learn-course.test.ts packages/web/tests/unit/app/learn-hub.test.tsx packages/mobile/tests/unit/components/explore/learn-hub.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(learn): edit the course outline in Site content; web and mobile Learn read it (Legal stays code-only)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

(`git add` of the deleted `packages/web/lib/learn-course.ts` stages the deletion, which `git rm` already did.)

---
### Task 19: The deliveries map (`impact-map`, migration 121)

**Depends on batch 2's migration 099** (`postcode_centroids`; printing plan Task 13). Before starting: `ls supabase/migrations/099_postcodes_and_distance.sql && psql "$(supabase status -o json | jq -r .DB_URL)" -c "select count(*) from public.postcode_centroids"` → the file exists and the count is in the thousands. If either fails, stop: this task cannot land before 099.

A completed handover is a `toy_transactions` row with `status = 'completed'`, `type in ('donation', 'exchange')` and a toy — builds and print jobs share the table ("toy_transactions is polymorphic") and are not deliveries. Its `pickup_suburb` / `pickup_state` / `pickup_postcode` were copied from the giver's pickup address when it was accepted (025/033). `public.impact_map()` groups those by suburb and state, trimmed and case-folded so "  newcastle " and "Newcastle" are one place, places each group at the mean of its postcodes' ABS centroids (never an address; a postcode with no centroid drops out), and **returns no group under three** — the threshold lives in the function, the only reader, and the route returns its rows untouched (Controller ruling 4, Review Focus 2). `pickup_line1` is never selected.

Web `/impact/map` draws one circle per suburb on OpenStreetMap tiles with Leaflet 1.9 + react-leaflet 5 (new dependencies, web only). Leaflet needs `window`, so the map is a client component loaded with `ssr: false` through a small loader. A plain list of the same suburbs sits under the map: the map is not readable by a screen reader, the list is.

WB draws no deliveries map screen — only the Not built yet scaffold (WB:6244, 7663) and story s4's words (WB:9958) — so most of the page's strings are flagged ("follows the code" 17).

**Files:**
- Create: `supabase/migrations/121_impact_map.sql`
- Modify: `packages/api/src/routes/public.ts` (`GET /impact/map`)
- Modify: `packages/types/src/index.ts` (`ImpactMapSuburb`)
- Create: `packages/web/components/deliveries-map.tsx`, `packages/web/components/deliveries-map-loader.tsx`
- Modify: `packages/web/app/impact/map/page.tsx`
- Modify: `packages/web/package.json`, `pnpm-lock.yaml` (leaflet, react-leaflet, @types/leaflet)
- Modify: `scripts/check-schema-guards.sh`
- Test: `packages/api/tests/integration/public/impact-map.test.ts` (new), `packages/web/tests/unit/pages/impact-map.test.tsx` (new)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: `postcode_centroids(postcode, lat, lng)` (099).
- Produces: `public.impact_map() returns table (suburb text, state text, deliveries int, lat double precision, lng double precision)`, SECURITY DEFINER, executable by anon. `GET /api/public/impact/map → ImpactMapSuburb[]`, `interface ImpactMapSuburb { suburb: string; state: string; deliveries: number; lat: number; lng: number }`. Default export `DeliveriesMap` (`components/deliveries-map.tsx`); `DeliveriesMapLoader` (`components/deliveries-map-loader.tsx`).

Copy: title "Deliveries map" and lead "Where adapted toys have actually landed." (WB:7663, and the registry's blurb). The rule line is WB:9958's, put in the present tense now the map exists: "The map shows completed handoffs at suburb level, never at address level, and never for fewer than three deliveries in a suburb. It does not show individual families." (tense change flagged). Flagged, no board source: "No suburb has three deliveries yet." (already in the header's list), each list row "{suburb}, {state} · {n} deliveries", and the failure line "The map could not load. Try again soon.". The map's attribution is OpenStreetMap's required "© OpenStreetMap contributors" link.

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/public/impact-map.test.ts`:

```ts
/**
 * 121 (impact-map): completed handovers by suburb, never at address level and
 * never for fewer than three deliveries in a suburb (Review Focus 2).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, createOrgToy, createProject, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let family: TestUser
let orgId: string
let tutorialId: string
const buildIds: string[] = []
// Made-up suburbs, so other tests' handovers never land in these groups.
const tag = crypto.randomUUID().replace(/[^a-f]/g, '').slice(0, 6)
const THREE = `zedthree${tag}` // three handovers, spelt three ways
const TWO = `zedtwo${tag}` // two handovers, a requested one and a build
const NOWHERE = `zednowhere${tag}` // three handovers on a postcode with no centroid
const SECRET = `12 Secret Street ${tag}`

async function handover(suburb: string, opts: { postcode?: string; state?: string; status?: string } = {}) {
  const toyId = await createOrgToy({ orgId })
  const { error } = await adminClient().from('toy_transactions').insert({
    toy_id: toyId,
    type: 'donation',
    status: opts.status ?? 'completed',
    requester_id: family.id,
    owner_id: null,
    owner_org_id: orgId,
    pickup_line1: SECRET,
    pickup_suburb: suburb,
    pickup_state: opts.state ?? 'NSW',
    pickup_postcode: opts.postcode ?? '2300',
  })
  if (error) throw new Error(`handover insert failed: ${error.message}`)
}

beforeAll(async () => {
  ;[leader, family] = await Promise.all([createTestUser(), createTestUser()])
  orgId = await createOrg({ createdBy: leader.id, name: `Map test ${tag}` })
  await handover(THREE)
  await handover(`  ${THREE.toUpperCase()} `)
  await handover(THREE, { state: 'nsw' })
  await handover(TWO)
  await handover(TWO)
  await handover(TWO, { status: 'requested' })
  for (let i = 0; i < 3; i++) await handover(NOWHERE, { postcode: '0000' })
  // A completed build in TWO stands in for every non-handover subject: builds
  // and print jobs are both outside `type in ('donation', 'exchange')`. If a
  // later constraint wants a completed build's stages set, set what it names.
  tutorialId = await createProject({ authorId: leader.id, status: 'approved' })
  const { data, error } = await adminClient()
    .from('toy_transactions')
    .insert({
      type: 'build',
      status: 'completed',
      tutorial_id: tutorialId,
      build_brief: 'A big button for Ollie',
      requester_id: family.id,
      owner_id: leader.id,
      pickup_suburb: TWO,
      pickup_state: 'NSW',
      pickup_postcode: '2300',
    })
    .select('id')
    .single()
  if (error) throw new Error(`build insert failed: ${error.message}`)
  buildIds.push(data.id)
})

afterAll(async () => {
  await adminClient().from('toy_transactions').delete().in('id', buildIds)
  await cleanupOrg(orgId, [tutorialId])
  await Promise.all([leader, family].map((u) => deleteTestUser(u.id)))
})

const map = async () => (await (await app.request('/api/public/impact/map')).json()) as Array<Record<string, unknown>>

describe('GET /api/public/impact/map — 121', () => {
  it('impact_map() exists and never returns a group under three', async () => {
    const { data, error } = await adminClient().rpc('impact_map')
    expect(error).toBeNull()
    for (const row of data as Array<{ deliveries: number }>) expect(row.deliveries).toBeGreaterThanOrEqual(3)
  })

  it('merges one suburb spelt three ways into one group of three, placed at its postcode centre', async () => {
    const rows = await map()
    const three = rows.filter((r) => String(r.suburb).toLowerCase() === THREE)
    expect(three).toHaveLength(1)
    expect(three[0]).toMatchObject({ state: 'NSW', deliveries: 3 })
    expect(typeof three[0].lat).toBe('number')
    expect(typeof three[0].lng).toBe('number')
  })

  it('leaves out a suburb with two handovers, a request and a build', async () => {
    expect((await map()).some((r) => String(r.suburb).toLowerCase() === TWO)).toBe(false)
  })

  it('drops a postcode with no centre', async () => {
    expect((await map()).some((r) => String(r.suburb).toLowerCase() === NOWHERE)).toBe(false)
  })

  it('never carries an address or any column but the five', async () => {
    const rows = await map()
    expect(JSON.stringify(rows)).not.toContain('Secret Street')
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(['deliveries', 'lat', 'lng', 'state', 'suburb'])
  })
})
```

`packages/web/tests/unit/pages/impact-map.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const get = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }))
// Leaflet needs a real browser; the loader is the seam. It only has to receive the rows.
vi.mock('@/components/deliveries-map-loader', () => ({
  DeliveriesMapLoader: ({ suburbs }: { suburbs: unknown[] }) => <div data-testid="map">{suburbs.length}</div>,
}))

beforeEach(() => vi.clearAllMocks())

describe('/impact/map', () => {
  it('draws the suburbs on the map and lists them, with the rule it keeps', async () => {
    get.mockResolvedValue([
      { suburb: 'Newcastle', state: 'NSW', deliveries: 12, lat: -32.93, lng: 151.75 },
      { suburb: 'Wagga Wagga', state: 'NSW', deliveries: 3, lat: -35.11, lng: 147.37 },
    ])
    const { default: Page } = await import('@/app/impact/map/page')
    render(await Page())
    expect(get).toHaveBeenCalledWith('/api/public/impact/map')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Deliveries map')
    expect(screen.getByText('Where adapted toys have actually landed.')).toBeInTheDocument()
    expect(screen.getByText(/never at address level, and never for fewer than three deliveries in a suburb/)).toBeInTheDocument()
    expect(screen.getByTestId('map')).toHaveTextContent('2')
    expect(screen.getByText('Newcastle, NSW · 12 deliveries')).toBeInTheDocument()
    expect(screen.getByText('Wagga Wagga, NSW · 3 deliveries')).toBeInTheDocument()
  })

  it('says so, and draws no map, when no suburb has three yet', async () => {
    get.mockResolvedValue([])
    const { default: Page } = await import('@/app/impact/map/page')
    render(await Page())
    expect(screen.getByText('No suburb has three deliveries yet.')).toBeInTheDocument()
    expect(screen.queryByTestId('map')).toBeNull()
  })

  it('says it could not load, rather than claiming there is nothing', async () => {
    get.mockRejectedValue(new Error('500'))
    const { default: Page } = await import('@/app/impact/map/page')
    render(await Page())
    expect(screen.getByRole('alert')).toHaveTextContent('The map could not load. Try again soon.')
    expect(screen.queryByText('No suburb has three deliveries yet.')).toBeNull()
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/public/impact-map.test.ts` → FAIL (`Could not find the function public.impact_map`).
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/pages/impact-map.test.tsx` → FAIL (heading is the Coming soon page's; `get` never called).

- [ ] **Step 3: The migration**

`supabase/migrations/121_impact_map.sql`:

```sql
-- 121 — the deliveries map (impact-map).
--
-- Story s4's promise, kept here rather than in a caller: completed handoffs
-- "at suburb level, never at address level, and never for fewer than three
-- deliveries in a suburb. It will not show individual families."
--
--   a delivery   a completed donation or exchange of a toy. Builds and print
--                jobs share toy_transactions and are not deliveries.
--   the place    the pickup suburb and state copied onto the row when it was
--                accepted (025/033), trimmed and case-folded so one suburb
--                spelt two ways is one group, not two groups under three.
--   the point    the mean of the group's postcode centres (099, ABS). Never an
--                address: pickup_line1 is not read. A postcode with no centre
--                drops out rather than landing at 0,0.
--   the floor    HAVING count(*) >= 3. This function is the map's only reader
--                and GET /api/public/impact/map returns its rows untouched,
--                so no caller can forget it.
--
-- SECURITY DEFINER: toy_transactions has no anon read (026), and this returns
-- only counts per suburb, which is what the page publishes anyway.
--
-- DOWN:
--   drop function if exists public.impact_map();

create function public.impact_map()
returns table (suburb text, state text, deliveries int, lat double precision, lng double precision)
language sql stable security definer set search_path = ''
as $$
  select initcap(lower(btrim(t.pickup_suburb))),
         upper(btrim(t.pickup_state)),
         count(*)::int,
         round(avg(c.lat)::numeric, 3)::double precision,
         round(avg(c.lng)::numeric, 3)::double precision
    from public.toy_transactions t
    join public.postcode_centroids c on c.postcode = btrim(t.pickup_postcode)
   where t.status = 'completed'
     and t.type in ('donation', 'exchange')
     and t.toy_id is not null
     and nullif(btrim(t.pickup_suburb), '') is not null
     and nullif(btrim(t.pickup_state), '') is not null
   group by lower(btrim(t.pickup_suburb)), upper(btrim(t.pickup_state))
  having count(*) >= 3
   order by 3 desc, 1
$$;

revoke execute on function public.impact_map() from public;
grant execute on function public.impact_map() to anon, authenticated;
```

Run: `supabase migration up` → `Applying migration 121_impact_map.sql...`

- [ ] **Step 4: The route and the type**

In `packages/types/src/index.ts`, after `interface ImpactSummary { … }`:

```ts
/** A row of GET /api/public/impact/map (121): one suburb with three or more deliveries. */
export interface ImpactMapSuburb {
  suburb: string
  state: string
  deliveries: number
  lat: number
  lng: number
}
```

In `packages/api/src/routes/public.ts`, after `publicRoutes.get('/impact', …)`'s closing `})`:

```ts
/**
 * impact-map: completed handovers by suburb. impact_map() (121) holds every
 * rule — suburb level only, three or more, postcode centres not addresses —
 * so the rows go out exactly as it returns them (Controller ruling 4).
 */
publicRoutes.get('/impact/map', async (c) => {
  const { data, error } = await createAnonClient().rpc('impact_map')
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data ?? [])
})
```

- [ ] **Step 5: The dependencies**

Run: `pnpm --filter @splat-connect/web add leaflet@^1.9.4 react-leaflet@^5.0.0 && pnpm --filter @splat-connect/web add -D @types/leaflet@^1.9.0`
Expected: `packages/web/package.json` gains the three; `pnpm-lock.yaml` changes. `pnpm --filter @splat-connect/web ls react-leaflet` → `react-leaflet 5.x` (its peer is React 19, which web has).

- [ ] **Step 6: The map**

`packages/web/components/deliveries-map.tsx`:

```tsx
'use client'
/**
 * The deliveries map (impact-map): one circle per suburb on OpenStreetMap,
 * sized by its deliveries. Leaflet touches `window` on import, so this is only
 * ever loaded through deliveries-map-loader.tsx with ssr: false.
 *
 * The rows are impact_map()'s (121) — suburbs with three or more, at postcode
 * centres. Nothing here can make a point finer than that.
 */
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import type { ImpactMapSuburb } from '@splat-connect/types'

// SVG presentation attributes cannot read a CSS variable, so the brand colour
// is resolved once, here, from the theme.
const brand = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--color-brand-dark').trim() || '#3b5bdb'

export default function DeliveriesMap({ suburbs }: { suburbs: ImpactMapSuburb[] }) {
  const color = brand()
  return (
    <MapContainer
      center={[-27, 134]}
      zoom={4}
      scrollWheelZoom={false}
      className="h-[480px] w-full overflow-hidden rounded-card border border-line max-sm:h-[360px]"
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {suburbs.map((s) => (
        <CircleMarker
          key={`${s.suburb}|${s.state}`}
          center={[s.lat, s.lng]}
          radius={6 + 3 * Math.sqrt(s.deliveries)}
          pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 2 }}
        >
          <Tooltip>{`${s.suburb}, ${s.state} · ${s.deliveries} deliveries`}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
```

`packages/web/components/deliveries-map-loader.tsx`:

```tsx
'use client'
// next/dynamic with ssr: false is only allowed in a client component; the
// /impact/map page is a server component, so this is the seam (and the one
// the page test mocks, since jsdom cannot run Leaflet).
import dynamic from 'next/dynamic'
import type { ImpactMapSuburb } from '@splat-connect/types'

const DeliveriesMap = dynamic(() => import('@/components/deliveries-map'), {
  ssr: false,
  loading: () => <div className="h-[480px] w-full rounded-card border border-line bg-sunken max-sm:h-[360px]" />,
})

export function DeliveriesMapLoader({ suburbs }: { suburbs: ImpactMapSuburb[] }) {
  return <DeliveriesMap suburbs={suburbs} />
}
```

Replace `packages/web/app/impact/map/page.tsx` with:

```tsx
/**
 * The deliveries map (impact-map) — story s4 made real: completed handoffs by
 * suburb, never at address level, never for fewer than three in a suburb.
 * The rule lives in impact_map() (121); this page shows what it returns, a
 * circle per suburb and the same suburbs as a list a screen reader can read.
 */
import type { ImpactMapSuburb } from '@splat-connect/types'
import { apiClient } from '@/lib/api-client'
import { DeliveriesMapLoader } from '@/components/deliveries-map-loader'

export const metadata = { title: 'Deliveries map — SPLAT Connect' }

export default async function MapPage() {
  const suburbs = await apiClient.get<ImpactMapSuburb[]>('/api/public/impact/map').catch(() => null)

  return (
    <div className="max-w-[1000px]">
      <h1 className="title-hub">Deliveries map</h1>
      <p className="mt-2.5 max-w-[62ch] text-[17px] leading-[1.55] text-muted">Where adapted toys have actually landed.</p>
      <p className="mt-2 max-w-[62ch] text-sm leading-normal text-muted">
        The map shows completed handoffs at suburb level, never at address level, and never for fewer than three
        deliveries in a suburb. It does not show individual families.
      </p>

      <div className="mt-6">
        {suburbs === null ? (
          <p role="alert" className="alert alert-danger">
            The map could not load. Try again soon.
          </p>
        ) : suburbs.length === 0 ? (
          <p className="font-bold text-ink">No suburb has three deliveries yet.</p>
        ) : (
          <>
            <DeliveriesMapLoader suburbs={suburbs} />
            <ul className="mt-5 grid list-none gap-2 p-0 sm:grid-cols-2">
              {suburbs.map((s) => (
                <li key={`${s.suburb}|${s.state}`} className="text-[15px] font-semibold text-ink">
                  {`${s.suburb}, ${s.state} · ${s.deliveries} deliveries`}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
```

(The page's `pending="impact-map"` reference goes with the old file. `lib/pending-icons.ts`' `'impact-map'` entry stays, and so do `not-built-page.test.tsx` and `not-built.spec.ts`, which keep using `impact-map` as their fixture — `/not-built/[id]` reads the registry whether or not an item is shipped.)

- [ ] **Step 7: Guards**

In `scripts/check-schema-guards.sh`, add before the closing `) as t(...)`:

```sql
  -- 121. The deliveries map's privacy floor lives in this one function. A
  -- body without the HAVING would publish suburbs with one or two families.
  ('121 impact_map() keeps its three-delivery floor',
   (select count(*) = 1 from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname = 'impact_map'
        and prosecdef
        and prosrc like '%having count(*) >= 3%')),
```

- [ ] **Step 8: Run the tests to see them pass**

Run the commands from Step 2 → PASS. `pnpm --filter @splat-connect/web exec vitest run tests/unit/app/not-built-page.test.tsx` → PASS (fixture unchanged). `pnpm typecheck` → exit 0. Then `pnpm --filter @splat-connect/web build` → completes (Leaflet's CSS import and the `ssr: false` loader compile under Turbopack).

Look at it: with the stack up (`./scripts/parity/stack.sh up`) and the demo cast seeded, open `/impact/map` at 1280 and 390 wide. Tiles load, circles sit on suburbs, the attribution shows bottom-right, and nothing scrolls sideways at 390. If the local data has no suburb with three, the empty line shows — that is correct, not a bug.

- [ ] **Step 9: Ship the item**

Set `shipped: true` on `'impact-map'` (never delete the entry — the two not-built tests use it); `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`. Then from `packages/web`, `node ../../scripts/parity/run.js --id impact_map`: the board's screen is its own Not built yet scaffold (WB:6244 "Scaffold."), so every finding there is the built page differing from a placeholder. Add to the `impact_map` entry in `scripts/parity/screen-map.json` one `"why": "intended"` rule per finding the run prints, each with `"reason": "The board draws its own Not built yet scaffold here; the map is built from story s4 (WB:9958)."`, and include `scripts/parity/screen-map.json` in the commit.

- [ ] **Step 10: Commit**

```bash
git status --short
git add supabase/migrations/121_impact_map.sql packages/api/src/routes/public.ts packages/types/src/index.ts packages/web/components/deliveries-map.tsx packages/web/components/deliveries-map-loader.tsx packages/web/app/impact/map/page.tsx packages/web/package.json pnpm-lock.yaml scripts/check-schema-guards.sh scripts/parity/screen-map.json packages/api/tests/integration/public/impact-map.test.ts packages/web/tests/unit/pages/impact-map.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(impact): the deliveries map — suburbs with three or more handovers, on OpenStreetMap (121)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 20: One-tap sign-in on Android (`android-one-tap`)

On Android, arriving at Sign in asks Google, silently, for an account this app signed in with before; a saved one signs straight in through the existing `signInWithIdToken`, and "no saved credential" (or any failure) does nothing at all — nobody asked for this, so nothing is shown. The silent token getter goes in `lib/social-auth.tsx` (the only file that touches the Google SDK), the sign-in in `lib/auth-context.tsx` beside `withIdToken`, which is where `signInWithIdToken` is called — not `social-auth.tsx` ("follows the code" 18). The (auth) layout's existing `session && !resetting → <Redirect href="/guides" />` takes over after, as for every other sign-in.

**Ships unit-tested only** (Controller ruling 5): `googleAvailable()` is false until the `google-sign-in` setup item puts the client ids in `.env.local` and a prebuild adds the native module, so this cannot run on a phone yet. The registry entry ships with a `needs` line saying so.

**Files:**
- Modify: `packages/mobile/lib/social-auth.tsx`, `packages/mobile/lib/social-auth.web.tsx`
- Modify: `packages/mobile/lib/auth-context.tsx`
- Modify: `packages/mobile/app/(auth)/sign-in.tsx`
- Test: `packages/mobile/tests/unit/lib/social-auth.test.ts` (new), `packages/mobile/tests/unit/lib/auth-context.test.tsx`, `packages/mobile/tests/unit/app/auth-screens.test.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: `googleAvailable()`, `withIdToken` (existing).
- Produces: `googleSavedIdToken(): Promise<string | null>` (social-auth, and a `null` stub in social-auth.web); `useAuth().signInWithSavedGoogle(): Promise<AuthResult | null>` (null when there was nothing to offer).

Copy: none. The screen says nothing either way.

- [ ] **Step 1: Write the failing tests**

`packages/mobile/tests/unit/lib/social-auth.test.ts`:

```ts
// android-one-tap: the silent saved-account getter. The Google module is
// mocked; the real one cannot load until the google-sign-in setup's prebuild.
const mockConfigure = jest.fn()
const mockHasPrevious = jest.fn()
const mockSilently = jest.fn()
jest.mock(
  '@react-native-google-signin/google-signin',
  () => ({
    GoogleSignin: {
      configure: (...a: unknown[]) => mockConfigure(...a),
      hasPreviousSignIn: () => mockHasPrevious(),
      signInSilently: () => mockSilently(),
    },
  }),
  { virtual: true }
)

let mockOS = 'android'
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockOS
    },
  },
}))

// The module reads the client ids when it loads, so each test loads it fresh.
function load(): typeof import('../../../lib/social-auth') {
  let mod!: typeof import('../../../lib/social-auth')
  jest.isolateModules(() => {
    mod = require('../../../lib/social-auth')
  })
  return mod
}

beforeEach(() => {
  jest.clearAllMocks()
  mockOS = 'android'
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client'
  mockHasPrevious.mockReturnValue(true)
  mockSilently.mockResolvedValue({ type: 'success', data: { idToken: 'saved-jwt' } })
})

afterAll(() => {
  delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
})

describe('googleSavedIdToken', () => {
  it('returns the saved account\'s token on Android, without a sheet', async () => {
    expect(await load().googleSavedIdToken()).toBe('saved-jwt')
    expect(mockConfigure).toHaveBeenCalledWith({ webClientId: 'web-client', iosClientId: undefined })
  })

  it('asks nothing when this app never signed in with Google here', async () => {
    mockHasPrevious.mockReturnValue(false)
    expect(await load().googleSavedIdToken()).toBeNull()
    expect(mockSilently).not.toHaveBeenCalled()
  })

  it('is null when Google finds no saved credential', async () => {
    mockSilently.mockResolvedValue({ type: 'noSavedCredentialFound', data: null })
    expect(await load().googleSavedIdToken()).toBeNull()
  })

  it('is null, and never throws, when Google fails', async () => {
    mockSilently.mockRejectedValue(new Error('DEVELOPER_ERROR'))
    expect(await load().googleSavedIdToken()).toBeNull()
  })

  it('does nothing off Android, or before Google sign-in is set up', async () => {
    mockOS = 'ios'
    expect(await load().googleSavedIdToken()).toBeNull()
    mockOS = 'android'
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
    expect(await load().googleSavedIdToken()).toBeNull()
    expect(mockHasPrevious).not.toHaveBeenCalled()
  })
})
```

(`{ virtual: true }` keeps the mock working even where the package is absent; it is installed today — `grep google-signin packages/mobile/package.json` — and the flag is harmless then.)

In `packages/mobile/tests/unit/lib/auth-context.test.tsx`:
- Add `const mockGoogleSaved = jest.fn()` beside `mockGoogleIdToken`, and `googleSavedIdToken: () => mockGoogleSaved(),` to the `social-auth` mock.
- Append after `'a failed Google sign-in says so in words'`:

```tsx
  it('signs a saved Google account straight in (android-one-tap)', async () => {
    mockGoogleSaved.mockResolvedValue('saved-jwt')
    mockSignInWithIdToken.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const res = await act(() => result.current.signInWithSavedGoogle())
    expect(res).toEqual({ problem: null })
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'saved-jwt' })
  })

  it('does nothing when there is no saved Google account', async () => {
    mockGoogleSaved.mockResolvedValue(null)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(await act(() => result.current.signInWithSavedGoogle())).toBeNull()
    expect(mockSignInWithIdToken).not.toHaveBeenCalled()
  })
```

In `packages/mobile/tests/unit/app/auth-screens.test.tsx`:
- Add to `mockAuth`, after `signInWithGoogle: jest.fn(),`: `signInWithSavedGoogle: jest.fn(() => Promise.resolve(null)),`. (`jest.clearAllMocks` keeps the implementation.)
- Append beside the other `SignIn` tests:

```tsx
  // android-one-tap: one silent try on arrival; nothing on screen either way.
  it('tries the saved Google account once on arrival and says nothing', async () => {
    render(<SignIn />)
    await waitFor(() => expect(mockAuth.signInWithSavedGoogle).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()
  })
```

  (import `waitFor` from `@testing-library/react-native` if the file does not already.)

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/lib/social-auth.test.ts tests/unit/lib/auth-context.test.tsx tests/unit/app/auth-screens.test.tsx`
Expected: FAIL — `googleSavedIdToken is not a function`, `signInWithSavedGoogle is not a function`, and `signInWithSavedGoogle` called 0 times.

- [ ] **Step 3: The silent getter**

In `packages/mobile/lib/social-auth.tsx`:
- Replace `let configured = false` and the configure block inside `googleIdToken` with one helper, used by both:

```tsx
let configured = false

function configureGoogle(G: typeof GoogleModule) {
  if (configured) return
  G.GoogleSignin.configure({ webClientId, iosClientId })
  configured = true
}
```

  so `googleIdToken`'s `try` opens with `configureGoogle(G)` in place of the `if (!configured) { … }` block.
- Replace the four-line `// PENDING(android-one-tap): add a silent sign-in here — …` comment with:

```tsx
/**
 * android-one-tap: on Android, the Google account this app signed in with
 * before, without a sheet (the artifact's "Credential Manager offers a saved
 * account in one tap"). Null whenever there is nothing to offer — not
 * Android, Google not set up, no previous sign-in, no saved credential, or any
 * error — because arriving at Sign in must never show a failure nobody asked for.
 */
export async function googleSavedIdToken(): Promise<string | null> {
  if (Platform.OS !== 'android' || !googleAvailable()) return null
  try {
    const G = google()
    configureGoogle(G)
    if (!G.GoogleSignin.hasPreviousSignIn()) return null
    const res = await G.GoogleSignin.signInSilently()
    return res.type === 'success' ? (res.data.idToken ?? null) : null
  } catch {
    return null
  }
}
```

- `googleAvailable` reads `webClientId` at module load as before; the test's `load()` re-requires the module for that reason.

In `packages/mobile/lib/social-auth.web.tsx`, after `googleIdToken`:

```tsx
export async function googleSavedIdToken(): Promise<string | null> {
  return null
}
```

- [ ] **Step 4: The sign-in**

In `packages/mobile/lib/auth-context.tsx`:
- Import: `import { appleCredential, googleIdToken, googleSavedIdToken, googleSignOut, type SocialResult } from './social-auth'`.
- In `type AuthContextValue`, after `signInWithGoogle: () => Promise<AuthResult>`:

```tsx
  /** android-one-tap: a saved Google account, silently. Null when there was none to offer. */
  signInWithSavedGoogle: () => Promise<AuthResult | null>
```

- After `async function signInWithGoogle() { … }`:

```tsx
  async function signInWithSavedGoogle(): Promise<AuthResult | null> {
    const token = await googleSavedIdToken()
    return token ? withIdToken('google', { ok: token }) : null
  }
```

- Add `signInWithSavedGoogle` to the provider's value object, after `signInWithGoogle`.

- [ ] **Step 5: Sign in asks on arrival**

In `packages/mobile/app/(auth)/sign-in.tsx`:
- `import { useEffect, useState } from 'react'`.
- Delete the two-line `// PENDING(android-one-tap): on Android, try the saved-account sign-in from …` comment.
- Destructure `signInWithSavedGoogle` from `useAuth()` alongside the others, and after the `useState` lines add:

```tsx
  // android-one-tap: one silent try with a saved Google account (Android only;
  // social-auth decides). A session sends the (auth) layout on to Guides; no
  // saved account, or a failure, shows nothing — nobody asked for this.
  useEffect(() => {
    void signInWithSavedGoogle()
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

- [ ] **Step 6: Run the tests to see them pass**

Run the command from Step 2 → PASS. `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/account tests/unit/app` → PASS (the other `social-auth` mocks never reach the new export). `pnpm --filter @splat-connect/mobile exec tsc --noEmit` → exit 0.

- [ ] **Step 7: Ship the item**

In `packages/types/src/pending.ts`, `'android-one-tap'`: add `shipped: true` and change `needs` to:

```ts
    needs: "Built 2026-10-01 and unit-tested only (Controller ruling 5): Sign in tries a saved Google account on arrival on Android. It runs for real once google-sign-in is set up — the Google client ids in .env.local and a prebuild with the native module.",
```

`packages/mobile/lib/pending-icons.ts` keeps its `'android-one-tap'` entry. `PENDING(google-sign-in)` in `social-auth.tsx` stays — it is that item's marker, not this one's. `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 8: Commit**

```bash
git status --short
git add packages/mobile/lib/social-auth.tsx packages/mobile/lib/social-auth.web.tsx packages/mobile/lib/auth-context.tsx "packages/mobile/app/(auth)/sign-in.tsx" packages/mobile/tests/unit/lib/social-auth.test.ts packages/mobile/tests/unit/lib/auth-context.test.tsx packages/mobile/tests/unit/app/auth-screens.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(sign-in): a saved Google account signs in on arrival on Android (unit-tested; runs once Google sign-in is set up)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 21: Full verification and graph update

No new code. Every check the spec names ("Testing": route tests, pure tests, object-exists assertions, drift test, parity after each slice), in an order where a failure points at one thing.

**Files:**
- Modify (generated only): `graphify-out/*`, `scripts/parity/parity-report.json`, `scripts/parity/app-parity-report.json`, `scripts/parity/mobile-report.json`

- [ ] **Step 1: Registry and drift**

Run: `node scripts/pending.mjs --check`
Expected: `docs/PENDING.md is up to date`
Run:

```bash
IDS='learn-ask-an-expert-mobile|child-switch-sound|explore-community-stats|web-admin-review-list|contributor-profile-details|saved-list-meta|my-challenges-meta|organisations-list-meta|org-profile-rows|thank-people|report-problem-mobile|notification-second-line|me-rows-structure|me-count-badges|admin-counts|wizard-steps|wizard-mascot-done|site-content-learn-legal-editing|impact-map|android-one-tap'
git grep -nE "PENDING\(($IDS)\)|pending=\"($IDS)\"" -- . ':!docs/**' ':!packages/types/src/pending.ts'
```

Expected: the `git grep` prints nothing. Then confirm each of the twenty is shipped: `for id in $(echo $IDS | tr '|' ' '); do grep -A2 "'$id': {" packages/types/src/pending.ts | grep -q "shipped: true" || echo "OPEN: $id"; done` → no output (`shipped: true` may sit on the line after the id or at the end of the entry; if a line prints, open the entry and check by eye). Run `grep -n '"pending": "\(organisations-list-meta\|admin-counts\|wizard-mascot-done\)"' scripts/parity/*-map.json` → no output.
Run the drift test. Expected: `Tests  11 passed (11)`.

- [ ] **Step 2: Types and unit suites**

Run: `pnpm typecheck` → exit 0.
Run: `pnpm --filter @splat-connect/api test:unit` → all pass.
Run: `pnpm --filter @splat-connect/web test:unit` → all pass (includes `tests/unit/lib/{guide-meta,notification-second-line,learn-course-merge,child-matches}.test.ts`, `tests/unit/components/{thanks-button,learn-course-editor}.test.tsx`, `tests/unit/pages/impact-map.test.tsx`).
Run: `pnpm --filter @splat-connect/mobile test:unit` → all pass (includes `tests/unit/components/people/thank-button.test.tsx`, `tests/unit/components/reports/report-problem.test.tsx`, `tests/unit/lib/social-auth.test.ts`).

- [ ] **Step 3: API integration against a clean local database**

Run: `supabase db reset` (applies every migration through 121 from scratch — proves 116's functions, 117's guarded `notifications_type_check` / `notifications_one_subject` recreation on top of whatever batches 4–5 left, 118's report kinds, 119's body column, 120's `NOT VALID` palm check and new CHECKs on an empty table, and 121 against 099's centroids), then `pnpm --filter @splat-connect/api test:integration`.
Expected: all pass, including `tests/integration/public/{contributor-details,org-list-counts,org-rows,impact-map,learn-course}.test.ts`, `tests/integration/saves/saved-meta.test.ts`, `tests/integration/toy-ideas/my-meta.test.ts`, `tests/integration/contributors/profile-thanks.test.ts`, `tests/integration/admin/{report-kinds,counts}.test.ts`, `tests/integration/notifications/body.test.ts`, `tests/integration/me/counts.test.ts`, `tests/integration/child-profiles/{play-measurements,crud}.test.ts`, and the existing `account-deletion` suite (117's `profile_thanks` and 120's columns sit on rows `delete_account` removes).

- [ ] **Step 4: E2E** (web and mobile never at the same time)

Run: `lsof -i :3104 -i :3105 -sTCP:LISTEN` (web e2e's API and web ports, `packages/web/playwright.config.ts`) → nothing, so the run builds fresh rather than reusing a stale server.
Run: `pnpm --filter @splat-connect/web test:e2e` → PASS (`not-built.spec.ts` still finds "Deliveries map" at `/not-built/impact-map`; a spec that needs a fix imports only from `tests/e2e/helpers.ts` / `lib/`).
Then: `pnpm --filter @splat-connect/mobile test:e2e` → PASS.

- [ ] **Step 5: Parity re-run**

Run: `./scripts/parity/stack.sh up`, then from `packages/web`: `node ../../scripts/parity/run.js` and `node ../../scripts/parity/app.js --id org_list,guide_org,lib_org,admin,wizard,sign_in,explore,learn_list,notifications,inbox,saved,my_challenges,contributor`.
Expected: web keeps its prior count with no new findings on `/admin`, `/admin/review`, `/admin/content`, `/learn`, `/impact/map`, `/contributors/[id]`, `/organizations`; the app screens report no `pending` exemption errors (`org_list`, `admin` and `wizard` lost theirs in Tasks 8, 15, 17). A new finding is a real divergence to fix or explain with `why: "intended"` and a reason — never `why: "pending"` naming a shipped id. Then `node scripts/parity/mobile.js --id admin_content,impact_map,learn,admin_review` for the 390px width check (the Learn editor's lesson row and the map's list must fit; fix with `max-sm:` only, per memory).

- [ ] **Step 6: Graph update**

Run: `graphify update .`
Expected: completes without error; `graphify-out/` updated.

- [ ] **Step 7: Commit the generated reports**

```bash
git status --short
git add graphify-out scripts/parity/parity-report.json scripts/parity/app-parity-report.json scripts/parity/mobile-report.json
git commit -m "chore(people-orgs-me): parity reports and graph after the people, orgs, Me and admin batch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

Hosted database: migrations 116–121 are **not** pushed by this plan. Pushing to the live "development" project is a separate step Byron approves (`supabase db push`, then `pnpm db:guards`, which now checks the 116–118, 120 and 121 rows). Before pushing: 121 needs batch 2's 099 (and its centroid data) already on the hosted project — `select count(*) from public.postcode_centroids` there; and before 117, re-run the `notifications_type_check` grep from Global Constraints against what is actually on the hosted project, since batches 4–5 may have pushed theirs in a different order. 120's palm-width CHECK is `NOT VALID`, so hosted rows written before 079 are not re-checked — `select count(*) from public.child_profiles where palm_width_mm not between 20 and 250` tells Byron whether any exist.
