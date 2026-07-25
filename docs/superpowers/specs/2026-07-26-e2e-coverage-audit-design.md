# E2E Coverage Audit — Web, Mobile & CI — Design Spec

**Date:** 2026-07-26
**Status:** Approved, not yet implemented

Bring E2E coverage to every user-reachable flow across `packages/web` and
`packages/mobile`, add a small Android device suite for the native-only paths
the Expo-web harness structurally cannot exercise, and cut CI minutes enough
that the extra tests cost nothing.

## Context

Today:

| Package | Harness | Spec files | Tests |
| --- | --- | ---: | ---: |
| web | Playwright → Next production build, local Supabase, ports 3104/3105 | 9 | 18 |
| mobile | Playwright → `expo export -p web`, local Supabase, ports 3102/3103 | 8 | 17 |

Both suites already share a shape: real local Supabase, service-role fixtures,
sign in through the UI. This is an extension of that harness, not a new one.

Three problems are already latent and get worse with more tests.

**Destructive seed consumption.** `packages/web/tests/e2e/admin/contributors.spec.ts`
deletes the seeded `pending@splat-test.local` row, so it passes exactly once per
`supabase db reset`. This failed on a clean checkout on 2026-07-25 purely because
an earlier local run had eaten the row.

**Shared-account pollution.** `contributor/upload-flow.spec.ts` signs in as the
shared seeded contributor and creates tutorials under it. `public/library.spec.ts`
asserts on total list contents. One spec's fixtures therefore land inside another
spec's assertions.

**Serial execution.** `fullyParallel: false, workers: 1` is currently
load-bearing *because* of the shared state. Wall-clock grows linearly with
coverage, which is what makes coverage expensive on a private repo's metered
runner minutes.

### Recorded decisions

| Question | Decision |
| --- | --- |
| Coverage bar | Happy path **plus every user-reachable error and edge state** — validation failures, permission denials, empty states, 404s, and API failures the UI handles |
| Native-only paths | Add a device runner rather than documenting them as gaps |
| Device runner | **Maestro** on **Android**, `ubuntu-latest`; iOS excluded (macOS bills at 10× on a private repo) |
| Device trigger | `push: branches: [main]` + `workflow_dispatch`; does **not** gate PRs |
| Fixture model | Normalise every spec onto self-provisioning; unlock `fullyParallel` |
| Coverage inventory doc | None — descriptive test names are the inventory; only the negative space is written down (below) |
| Sequencing | Fixtures → coverage → device |
| `fetch` failure on public pages | Fix the production code, then test it |
| Responsive viewport | Add a tagged mobile-viewport Playwright project |

### Scale

75 new Playwright tests (54 web, 21 mobile) on top of 35 existing, for **110
total**, plus **4 Maestro flows**. Roughly a tripling. This is what the agreed
coverage bar costs on a codebase with this many reachable states.

That is too much for one implementation plan. Each phase gets its own plan and
its own review cycle, executed in order — Phase A's parallelism gate must be met
before Phase B begins, because the 54 new web tests are written against a
parallel suite. Phase B may be split further into web and mobile plans, which
are independent of each other once Phase A lands.

## Phase A — Fixture normalisation

Prerequisite for everything else. Ends with `fullyParallel: true, workers: 4` in
both Playwright configs.

**The rule every spec follows: a spec may only assert on rows it created.**

Assertions about total list contents are rewritten as assertions about the
spec's own uniquely-titled fixtures. `public/library.spec.ts`'s "hides the
seeded pending one" becomes: create one approved and one pending tutorial with
generated titles, assert the approved title is visible and the pending title is
not. Same behaviour asserted, now immune to neighbouring specs.

**Helpers.** `tests/e2e/helpers.ts` in both packages already exposes
`createContributor()` and `createTutorial()`, and seven specs already use them
correctly — they are the reference implementation. Add:

- `createAdmin()` (web) — service-role user with `role: 'admin'`
- `createParent()` (mobile) — service-role user with `role: 'parent'`
- `deleteUser(id)` (both) — teardown

Teardown is **best-effort, not required**. CI boots a fresh Supabase per job, so
leaked fixtures cost nothing there; `deleteUser` exists so that repeated local
runs do not accumulate hundreds of accounts. No assertion may depend on teardown
having run — that would reintroduce exactly the inter-spec coupling this phase
removes.

**Specs converted** (8): web `admin/contributors`, `admin/review-flow`,
`auth/login`, `contributor/upload-flow`, `public/library`,
`public/tutorial-detail`; mobile `home-library`, `home-detail`.

**`seed.sql` retains nothing that any spec depends on.** Once all eight specs
self-provision, no test reads a seeded account or tutorial. The file may keep
rows for convenience when exploring the app locally, but the rule is explicit:
**no spec may reference a seeded row**, and `pending@splat-test.local` is deleted
outright — `admin/contributors.spec.ts` provisions and deletes its own throwaway
contributor. This is what makes `supabase db reset` stop being a precondition
for a green run.

**Definition of done for Phase A:** from a fresh `supabase db reset`, both suites
pass **twice consecutively** with `workers: 4`. Passing once proves nothing; a
spec that consumes global state passes its first run.

**Risk.** This is rework on eight currently-green specs with no user-visible
change. Mitigated by the two-consecutive-runs gate and by the seven clean specs
serving as the pattern to copy.

## Phase B — Coverage

### Production code changes in scope

`app/page.tsx` and `app/library/page.tsx` both do:

```ts
const res = await fetch(`${process.env.API_URL}/api/public/tutorials`, { cache: 'no-store' })
const all: Tutorial[] = res.ok ? await res.json() : []
```

This handles an HTTP error but not a connection failure — `fetch` rejects, the
rejection is unhandled, and the page returns 500. Observed on 2026-07-25 with the
API stopped: `⨯ [TypeError: fetch failed] … GET / 500`.

Wrap both in `try`/`catch` falling back to `[]`, matching the intent the existing
`: []` already states. This is the only production change in this spec.

### Web — 54 new tests (18 → 72)

**`public/home.spec.ts`** *(new)* — 3
- renders the hero, the featured cards and the three how-it-works steps
- "Browse the library" and "View all" both navigate to `/library`
- an unreachable API degrades to an empty featured list rather than a 500

**`public/library.spec.ts`** — +2
- search combined with a difficulty filter narrows to the intersection
- a search with no matches shows the empty state

**`public/tutorial-detail.spec.ts`** — +3
- a tutorial with no photo shows the 🧸 fallback
- optional parts and tools show the Optional badge; buy links carry their aria-labels
- a tutorial with no STL files omits the 3D-print section

**`auth/signup.spec.ts`** — +2
- an already-registered email shows the error
- a password under six characters is rejected

**`auth/login.spec.ts`** — +1
- a parent-role account lands on `/`

**`auth/session.spec.ts`** *(new)* — 2
- signing out from the nav returns to `/` and restores the Contribute link
- `/auth/confirmed` renders the confirmation card

**`auth/route-protection.spec.ts`** *(new)* — 5

Derived from `middleware.ts`: `contributorRoutes = ['/upload', '/my-tutorials', '/dashboard']`, `adminRoutes = ['/admin']`.
- unauthenticated `/dashboard` redirects to `/login`
- unauthenticated `/admin` redirects to `/login`
- a contributor opening `/admin` is redirected to `/`
- an admin opening `/dashboard` is redirected to `/`
- a parent opening `/dashboard` is redirected to `/login`

**`contributor/dashboard.spec.ts`** — +2
- the pending/approved/rejected counts match the fixture set
- "View all N tutorials" appears past five and links to `/my-tutorials`

**`contributor/my-tutorials.spec.ts`** *(new)* — 3

This route has no E2E coverage today.
- lists every status with its badge and edit link
- the empty state offers "Upload your first tutorial"
- a rejected tutorial shows its rejection note

**`contributor/upload-flow.spec.ts`** — +9
- Next stays disabled until step 1's required fields are filled
- Back preserves data already entered
- re-advancing from step 1 PATCHes the existing draft instead of creating a second
- a part can be added and removed
- a part's optional flag and quantity persist to the saved tutorial
- buy links can be added and removed on a part
- a tool can be added and removed
- an STL file can be uploaded and removed
- skipping step 5 saves no `stl_files`, and the review step reflects every entered value

**`contributor/edit-tutorial.spec.ts`** — +8
- saving details updates title, description and difficulty
- the difficulty select shows the newly saved value after a save
- the toy photo and the PDF can be replaced
- a part can be added, edited and deleted
- a tool can be added, edited and deleted
- an STL file record can be added
- submit-for-review with missing fields shows the blocking alert and does not submit
- a rejected tutorial shows the rejection callout

**`admin/dashboard.spec.ts`** *(new)* — 1
- the counts match the fixture set and both cards link to their pages

**`admin/review-flow.spec.ts`** — +5
- the queue lists pending tutorials with their submitted dates
- the queue empty state
- the detail page renders parts, tools, STL files and the PDF link
- rejecting without a note shows the contributor the "No feedback was provided." fallback
- a non-pending tutorial id 404s on the review detail page

**`admin/contributors.spec.ts`** — +2
- the list renders name, email and joined date
- the empty state

**`responsive/reflow.spec.ts`** *(new, tagged `@responsive`)* — 6
- the nav drops its links to a second row under `sm` with no link clipped
- the library grid renders two columns at phone width
- a dashboard row wraps its Edit control and status badge without overflow
- the upload wizard's step indicator and controls fit the viewport
- the tutorial detail page stacks to a single column
- the hero heading does not overflow at 320px

### Mobile — 21 new tests (17 → 38)

**`navigation.spec.ts`** *(new)* — 4
- signed-out entry lands on the profile auth screen
- signed-in parent entry lands on the child-profile home
- the tab bar reaches all five tabs and marks the active one
- scanner, toy-library and print render their `ComingSoon` content

**`home-library.spec.ts`** — +3
- an aborted tutorials request shows "Couldn't load tutorials. Pull to retry."
- a search with no matches shows the empty state
- the skeleton renders while the request is in flight

**`home-detail.spec.ts`** — +4
- an aborted request shows "Couldn't load tutorial. Please try again."
- an unknown id shows "Tutorial not found."
- parts, tools and optional badges render
- the preview screen renders and backs out to the detail screen

**`auth.spec.ts`** — +6
- mismatched passwords show "Passwords do not match."
- an unconfirmed email shows the confirm-your-email message
- invalid credentials show an error
- an already-registered email shows the error
- the contributor view offers Open Web Dashboard and Sign Out
- the parent view offers the child-profile entry points

**`ability-profile.spec.ts`** — +1
- clearing a manual selection persists the cleared state

**`everyday-needs.spec.ts`** — +1
- dropping back under the three-challenge cap re-enables the disabled chips

**`customization.spec.ts`** — +1
- turning the arm-attachment toggle off hides the forearm-length field

**`intro-video.spec.ts`** *(new)* — 1
- the intro video element mounts

### Techniques

**Error states are reached by request interception**, not by stopping a server:
`page.route('**/api/public/tutorials', r => r.abort())`. This is what makes the
`EmptyState` fallbacks in `library-screen.tsx` and `detail-screen.tsx`
deterministically reachable.

**The mobile skeleton test needs a deliberate `page.route` delay** rather than
racing the render. Disposition decided in advance: **if it proves flaky, delete
it rather than retry it.** A skeleton regression is cosmetic; a flaky test in a
suite gating `main` costs more than the bug it catches.

**Responsive project.** `packages/web/playwright.config.ts` gains a second
project at `devices['Pixel 7']` running only `@responsive`-tagged tests; the
desktop project excludes that tag. Roughly 10s of extra runtime.

## Phase C — Maestro device suite

Four flows, each both native-only and robustly assertable:

1. **Session survives a cold start** — sign in, kill the app, relaunch, still
   signed in. The reason the suite exists: the only test that exercises
   `expo-secure-store` as the auth storage adapter selected by
   `resolveAuthStorage(Platform.OS)`.
2. **Sign out clears the stored session** — sign out, kill, relaunch, back at the
   auth screen. Without this, #1 passes against a Keychain entry that is never cleared.
3. **Deep-link cold start** from the email-confirmation return URL.
4. **Intro video** renders and plays on a real device (`expo-video`, not the web shim).

`Linking.openURL` was considered and **dropped**: asserting it requires
cross-app assertions against the emulator's browser UI, which break on image
changes. Covered at unit level instead — see negative space.

**Networking.** The Android emulator cannot reach `localhost`; the host is
`10.0.2.2`. `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SUPABASE_URL` are rewritten
for this build. These are baked at transform time, so the `--clear` discipline
already documented in `packages/mobile/playwright.config.ts` applies: a cached
module would silently freeze in a `localhost` value and point the device app at
nothing.

**Fixtures.** Maestro flows are YAML and cannot call the service role. A Node
setup step runs first, provisions a parent account with a known password using
the Phase A helpers, and writes credentials to a file the flow reads.

**Build cost.** `expo prebuild` + `assembleRelease` is 8–12 minutes and dominates
the job. The APK is cached on a hash of the files that can affect it (`app.json`,
`package.json`, `pnpm-lock.yaml`, any `android/` config). Most merges to `main`
touch only JS, hit the cache, and drop to roughly 4–5 minutes.

Runner: `ubuntu-latest` with `reactivecircus/android-emulator-runner`.

## CI

### Already landed

Items 1–4 of the cost audit were implemented on 2026-07-26, ahead of this spec:

1. `push: branches: [main]` — previously `on: push` and `on: pull_request` both
   fired unfiltered, running the whole suite **twice** per push to a PR branch.
2. `concurrency` with `cancel-in-progress`, exempting `main` so every landed
   commit gets a complete run.
3. A `changes` job using `dorny/paths-filter@v3`, gating `integration`,
   `web-e2e` and `mobile-e2e` on the packages actually touched. Shared paths
   (`packages/api`, `packages/types`, `supabase`, the lockfile, the workflow
   itself) deliberately trigger everything.
4. `needs: [changes, check, test]` on the three heavy jobs, so a type error no
   longer burns three Supabase boots.

**Open items to verify:** whether the three heavy jobs are required status checks
under branch protection (GitHub treats `if:`-skipped jobs as passing, but the
configuration predates this change), and whether the `dorny/paths-filter`
dependency is acceptable versus splitting `ci.yml` into three workflow files.

### Job matrix after all phases

| Trigger | Jobs |
| --- | --- |
| PR touching only `packages/web` | `changes`, `check`, `test`, `web-e2e` |
| PR touching only `packages/mobile` | `changes`, `check`, `test`, `mobile-e2e` |
| PR touching `packages/api` / `types` / `supabase` | all except `device-e2e` |
| Merge to `main` | all, plus `device-e2e` |
| `workflow_dispatch` | `device-e2e` on demand |

The new tests land inside jobs that already exist and already boot Supabase, so
the marginal cost is execution time — roughly 60s web and 45s mobile at
`workers: 4` — not new infrastructure. `device-e2e` is the only new spend and is
confined to `main` behind an APK cache.

## Out of scope — the negative space

Written down because it is the only part of coverage that cannot be recovered by
grepping test names.

- **iOS, entirely.** macOS runners bill at 10× on a private repo. The JS-level
  storage-adapter branch is shared across platforms, so Android exercises the
  decision; Keychain-specific behaviour is untested.
- **`Linking.openURL`.** Unit-level assertion that it is called with the correct
  URL; the OS handoff itself is untested. Applies to the tutorial PDF and the
  Open Web Dashboard link.
- **Status-transition matrix and RLS.** Already covered by
  `packages/api/tests/integration/`. E2E asserts the UI *reaches* those
  transitions, not that they are correct. Deliberately not duplicated.
- **Scanner, toy-library and 3D-print features.** `ComingSoon` placeholders;
  only the placeholder is tested.
- **Real email delivery.** The confirmation link is covered by the deep-link
  cold start. Nothing parses an inbox.
- **Browser matrix.** Chromium only, both suites. No Firefox or WebKit.
- **Visual regression, accessibility audits, performance and load, offline mode,
  multi-user concurrency.** None in scope.

## Verification

| Phase | Gate |
| --- | --- |
| A | Both suites pass **twice consecutively** from a fresh `supabase db reset` at `workers: 4` |
| B | `pnpm -r typecheck`, `pnpm -r test:unit`, both E2E suites green; every new test observed failing before it passes |
| C | `device-e2e` green on a `workflow_dispatch` run before it is wired to `main` |

Every new test must be seen to fail against the unmodified code before it counts
as passing, so that no test asserts a condition it would satisfy either way.
