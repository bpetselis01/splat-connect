# E2E Phase C — Maestro Android Device Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Android Maestro suite that exercises the one thing neither web E2E suite structurally can — `expo-secure-store` as the Supabase auth storage adapter surviving a real process death.

**Architecture:** A release APK built by `expo prebuild` + `gradlew assembleRelease`, run on `reactivecircus/android-emulator-runner` against local Supabase reached at the emulator's host alias `10.0.2.2`. Maestro flows are YAML and cannot call the service role, so a Node script provisions the parent account first and hands credentials to Maestro via `--env`. The job runs on `main` and `workflow_dispatch` only, behind an APK cache keyed on the files that can affect the build.

**Tech Stack:** Maestro, `expo prebuild` (SDK 57), Gradle, `expo-build-properties`, `reactivecircus/android-emulator-runner`, `@supabase/supabase-js` service-role fixtures.

**Source spec:** `docs/superpowers/specs/2026-07-26-e2e-coverage-audit-design.md`
**Depends on:** `docs/superpowers/plans/2026-07-26-e2e-phase-b-coverage.md` (complete; 71 web / 37 mobile green)

---

## Scope revision — 4 flows becomes 2

The spec names four flows. Reading the code before planning showed that two of them cannot be
written as specified. Both deltas are recorded here rather than left as apparent gaps.

**Flow 3, deep-link cold start — dropped. The feature does not exist.**

The spec assumes the email-confirmation return URL deep-links into the app. It does not:

- `lib/auth-context.tsx:60` sets `emailRedirectTo: ${EXPO_PUBLIC_WEB_URL}/auth/confirmed` — the
  **web** app's route, not an app URL.
- `app.json` has no `scheme`, so the app has no custom-scheme URL to be linked to.
- Nothing anywhere calls `Linking.getInitialURL`, `Linking.createURL`, or subscribes to a `url`
  event. The only `Linking` calls are two outbound `openURL`s (`profile-screen.tsx:89`,
  `home/preview-screen.tsx:29`).

Testing this flow means first *building* deep-link handling — a scheme, a redirect pointing at the
app, and a route that exchanges the token. That is a feature, and it is outside the spec's recorded
decision, which was only to "add a device runner rather than documenting them as gaps". Building it
under a test plan would smuggle a product change in as test coverage.

**Recommendation: a separate spec if app-side email confirmation is wanted.** Until then this
belongs in the spec's negative space, and the "Real email delivery" bullet there should stop
claiming the confirmation link is covered by the deep-link cold start.

**Flow 4, intro video on device — folded into the launch helper, not a standalone flow.**

The intro video test was already excluded from Phase B at the user's request. On device it also
cannot be avoided: `app/_layout.tsx:25` renders `IntroVideo` over the whole app on every cold start,
and `IntroVideo.tsx:38-51` is a full-screen `Pressable` that swallows touches until `playToEnd`, a
decode error, or the 8s `MAX_INTRO_MS` ceiling. Every flow must therefore get past it, which means
**flows 1 and 2 cannot pass unless the intro mounted and cleared on a real device with real
`expo-video`**. That is the assertion flow 4 wanted, obtained for free. A separate flow would add a
second emulator boot to re-assert it.

**Net: 2 flows, both native-only and both robustly assertable.** The suite's stated reason for
existing — `resolveAuthStorage()` returning `secureStoreAdapter` for non-web — is fully covered.

---

## Global Constraints

- **`resolveAuthStorage()` (`lib/supabase-storage.ts:29-31`) is what this suite exists to cover.** A flow that would pass against `webAdapter` asserts nothing.
- **Every flow kills the app between sign-in and assertion.** A relaunch without `stopApp` proves only that React state survived, not that SecureStore did.
- **The emulator cannot reach `localhost`.** Host services are `10.0.2.2`. Every `EXPO_PUBLIC_*` URL in the device build uses it.
- **`EXPO_PUBLIC_*` are inlined at Metro transform time and Metro's cache key does not include their values** (see the `--clear` note in `packages/mobile/playwright.config.ts:60-65`). The device build must clear the Metro cache or a stale `localhost` freezes into an unchanged module and the device app silently talks to nothing.
- **The device suite owns API port 3106.** Dev holds 3100/3101/8081, mobile E2E 3102/3103, web E2E 3104/3105. Supabase (54321) is shared, since it is one Docker stack per job.
- **No new production `testID`s are needed.** `TextField` spreads `TextInputProps`, so each auth field's `accessibilityLabel` reaches the `TextInput`; `Button` sets `accessibilityLabel={label}` (`ui/Button.tsx:45`). Android exposes both as `content-desc`, which Maestro matches.
- **`packages/mobile/AGENTS.md`: read `https://docs.expo.dev/versions/v57.0.0/` before writing code.** This plan was written without web access, so every Expo/Gradle behaviour it asserts is marked as a verify-step rather than an assumption to build on.
- `/android` and `/ios` are gitignored (`packages/mobile/.gitignore`), so prebuild output is never committed and CI always prebuilds fresh.

## File Structure

| File | Action | Purpose |
| --- | --- | --- |
| `packages/mobile/app.json` | Modify | `android.package` for a deterministic Maestro `appId`; `expo-build-properties` plugin for cleartext traffic |
| `packages/mobile/package.json` | Modify | `expo-build-properties` dep; `device:*` scripts |
| `packages/mobile/scripts/provision-device-parent.mjs` | Create | Service-role parent fixture, emits `KEY=value` for Maestro `--env` |
| `packages/mobile/.maestro/subflows/launch.yaml` | Create | Reusable subflow: cold launch + dismiss the intro |
| `packages/mobile/.maestro/flows/session-survives-cold-start.yaml` | Create | Flow 1 |
| `packages/mobile/.maestro/flows/sign-out-clears-session.yaml` | Create | Flow 2 |

Flows and subflows are kept in **separate directories on purpose**. `maestro test <dir>` runs every
flow it finds, and `launch.yaml` is not a test — it has no meaningful standalone assertion. Splitting
them means `maestro test .maestro/flows/` reports exactly two flows, so "2 passed" stays a meaningful
number instead of drifting as subflows are added.

**Deviation from the spec:** it specifies the fixture step "writes credentials to a file the flow
reads". Maestro takes `--env` natively, so there is no file — one less artifact and one less path to
get wrong. Same effect, and `$GITHUB_ENV` already carries the values in CI.
| `.github/workflows/ci.yml` | Modify | `device-e2e` job, APK cache, `main` + `workflow_dispatch` |
| `docs/superpowers/specs/2026-07-26-e2e-coverage-audit-design.md` | Modify | Record the two dropped flows in the negative space |

---

### Task 1: Make the Android build addressable and able to talk to the emulator host

Two blockers before any APK is useful.

**`android.package` is unset.** `app.json:19-27` sets `ios.bundleIdentifier` but no Android package.
Expo derives one (`com.anonymous.mobile`) when absent, and Maestro's `appId` must match it exactly.
Setting it explicitly makes the flows' `appId` deterministic instead of dependent on Expo's fallback.

**Release APKs block cleartext HTTP.** Expo's template sets `usesCleartextTraffic` in the *debug*
manifest only; on `targetSdk` 28+ a release build refuses plaintext HTTP. Every host URL here is
`http://10.0.2.2:…`, so without this the app cannot reach Supabase or the API. Editing the generated
manifest is not an option — `/android` is gitignored and regenerated by every prebuild — so this has
to be a config plugin.

**Files:**
- Modify: `packages/mobile/app.json`
- Modify: `packages/mobile/package.json` (dependency only)

**Interfaces:**
- Produces: `appId: com.splatconnect.mobile`, used by every flow in Tasks 4–5 and by the CI job in Task 7.

- [ ] **Step 1: Install the config plugin at the SDK-correct version**

`expo install` resolves the version matching SDK 57 rather than picking `latest`:

```bash
pnpm --filter @splat-connect/mobile exec expo install expo-build-properties
```

- [ ] **Step 2: Set the package and register the plugin**

In `packages/mobile/app.json`, add `package` to the `android` block:

```json
    "android": {
      "package": "com.splatconnect.mobile",
      "adaptiveIcon": {
```

and replace the `plugins` array:

```json
    "plugins": [
      "expo-video",
      "expo-splash-screen",
      [
        "expo-build-properties",
        {
          "android": {
            "usesCleartextTraffic": true
          }
        }
      ]
    ]
```

`usesCleartextTraffic` is needed because the Android emulator reaches host services over plaintext
HTTP at `10.0.2.2`, and a release APK blocks cleartext by default. It applies to debug and release
builds of this app only; nothing ships from this repo.

- [ ] **Step 3: Verify prebuild accepts the config**

```bash
cd packages/mobile && pnpm exec expo prebuild -p android --clean
```

Expected: succeeds, and `android/app/src/main/AndroidManifest.xml` contains
`android:usesCleartextTraffic="true"`. Confirm the package with:

```bash
grep -n "applicationId" packages/mobile/android/app/build.gradle
```

Expected: `applicationId 'com.splatconnect.mobile'`.

If `usesCleartextTraffic` is absent from the release manifest, check the installed plugin's options
against `https://docs.expo.dev/versions/v57.0.0/sdk/build-properties/` before improvising.

- [ ] **Step 4: Confirm typecheck and unit tests are unaffected**

```bash
pnpm --filter @splat-connect/mobile typecheck && pnpm --filter @splat-connect/mobile test:unit
```

Expected: clean; 86 unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/app.json packages/mobile/package.json pnpm-lock.yaml
git commit -m "build(mobile): set the Android package and allow cleartext to the emulator host"
```

---

### Task 2: Provision the device fixture from Node

Maestro flows are YAML and cannot call the service role, so the parent account is created before
Maestro starts and passed in as `--env` variables.

This duplicates ~15 lines of `tests/e2e/helpers.ts:53-70` rather than importing it, because that file
imports `@playwright/test` for `Page` and `expect` — a value import that would pull Playwright into a
plain Node script, and would need a TS loader this repo does not have. A comment cross-references the
original so the two stay in sync.

**Files:**
- Create: `packages/mobile/scripts/provision-device-parent.mjs`
- Modify: `packages/mobile/package.json` (scripts)

**Interfaces:**
- Produces: stdout of exactly two lines, `DEVICE_EMAIL=…` and `DEVICE_PASSWORD=…`, consumed by Tasks 4–5 via `maestro test --env` and by Task 7's CI job.

- [ ] **Step 1: Write the script**

```js
// Provisions the parent account the Maestro flows sign in as. Maestro flows are
// YAML and cannot reach the service role, so this runs first and emits the
// credentials as KEY=value lines for `maestro test --env`.
//
// Deliberately duplicates createParent() from tests/e2e/helpers.ts rather than
// importing it: that module imports `expect` from @playwright/test (a value, not
// just a type), which a plain Node script has no reason to load. Keep the two in
// sync — the profiles upsert is the part that matters.
import { createClient } from '@supabase/supabase-js'

// Local Supabase — well-known non-secret dev keys, same values as
// playwright.config.ts and tests/e2e/helpers.ts.
const SUPABASE_URL = process.env.DEVICE_SUPABASE_URL ?? 'http://localhost:54321'
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const PASSWORD = 'Test1234!'
const email = `device-parent-${Date.now()}-${Math.floor(Math.random() * 1e6)}@mobile-e2e.local`

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const { data, error } = await admin.auth.admin.createUser({
  email,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { name: 'Device E2E Parent', role: 'parent' },
})
if (error || !data.user) throw new Error(`Failed to create parent: ${error?.message}`)

// The role on `profiles` is what GET /api/contributors/me returns, and it is
// what makes the Profile tab render ChildProfileHome instead of the sign-in card.
const { error: profileError } = await admin
  .from('profiles')
  .upsert({ id: data.user.id, role: 'parent', name: 'Device E2E Parent' })
if (profileError) throw new Error(`Failed to set parent profile: ${profileError.message}`)

// Two lines only, so callers can `eval $(node …)` or append to $GITHUB_ENV.
console.log(`DEVICE_EMAIL=${email}`)
console.log(`DEVICE_PASSWORD=${PASSWORD}`)
```

- [ ] **Step 2: Add the script entry**

In `packages/mobile/package.json`, add to `scripts`:

```json
    "device:fixture": "node scripts/provision-device-parent.mjs",
```

- [ ] **Step 3: Run it against local Supabase**

```bash
supabase start
pnpm --filter @splat-connect/mobile device:fixture
```

Expected: exactly two lines, `DEVICE_EMAIL=device-parent-…@mobile-e2e.local` and
`DEVICE_PASSWORD=Test1234!`.

- [ ] **Step 4: Verify the row is a parent, not a contributor**

The signup trigger defaults new accounts to `contributor`; if the upsert silently failed, the flows
would land on the wrong screen and fail confusingly. Confirm directly:

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -c "select role, name from profiles order by created_at desc limit 1;"
```

Expected: `parent | Device E2E Parent`.

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/scripts/provision-device-parent.mjs packages/mobile/package.json
git commit -m "test(mobile): provision the device-suite parent fixture from Node"
```

---

### Task 3: The launch subflow that gets past the intro video

Every flow needs this, so it is written and verified once.

`app/_layout.tsx:25` renders `IntroVideo` above the router `Slot` on every cold start, and the
component is a full-screen `Pressable` that swallows touches. It clears on `playToEnd`, on a decode
error, or when the 8s `MAX_INTRO_MS` timer fires. Tapping its "Skip intro" `accessibilityLabel` is
faster and deterministic; `optional: true` covers the case where the video already finished before
Maestro looked.

**Files:**
- Create: `packages/mobile/.maestro/subflows/launch.yaml`

**Interfaces:**
- Produces: a subflow invoked as `- runFlow: ../subflows/launch.yaml` by Tasks 4 and 5. On exit the app is cold-launched, the intro is gone, and the Home tab is showing.

- [ ] **Step 1: Write the subflow**

```yaml
appId: com.splatconnect.mobile
---
# clearState is deliberately NOT set: these flows are about what persists in the
# Keychain/KeyStore across a process kill, and clearing app state would wipe the
# SecureStore entry that is the entire subject of the suite.
- launchApp

# app/_layout.tsx renders IntroVideo over the whole app on every cold start, and
# IntroVideo.tsx is a full-screen Pressable that swallows touches until playToEnd,
# a decode error, or the 8s MAX_INTRO_MS ceiling. Tapping "Skip intro" — its
# accessibilityLabel, which Android exposes as content-desc — is deterministic.
# optional: true because a fast decode may have dismissed it already.
- tapOn:
    text: "Skip intro"
    optional: true

# The tab bar only mounts once the intro is gone, so this doubles as the gate
# that the intro actually cleared.
- assertVisible:
    text: "Home"
```

- [ ] **Step 2: Confirm Maestro matches `accessibilityLabel` by `text`**

Maestro matches text and accessibility text, but which one wins for a `Pressable` whose only label
is `accessibilityLabel` is worth confirming rather than assuming. With the app installed and the
intro on screen:

```bash
maestro hierarchy | grep -i "skip intro"
```

Expected: a node whose `accessibilityText` (or `content-desc`) is `Skip intro`. If Maestro exposes it
only as an id, change the selector to `id: "Skip intro"`. Record whichever landed in a comment.

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/.maestro/subflows/launch.yaml
git commit -m "test(mobile): add the Maestro cold-launch subflow"
```

---

### Task 4: Flow 1 — the session survives a cold start

The reason the suite exists. This is the only test in the repo that exercises
`resolveAuthStorage()`'s `secureStoreAdapter` branch.

**Files:**
- Create: `packages/mobile/.maestro/flows/session-survives-cold-start.yaml`

**Interfaces:**
- Consumes: `launch.yaml` (Task 3); `DEVICE_EMAIL` / `DEVICE_PASSWORD` (Task 2).

- [ ] **Step 1: Write the flow**

```yaml
appId: com.splatconnect.mobile
env:
  DEVICE_EMAIL: set-by-maestro-test---env
  DEVICE_PASSWORD: set-by-maestro-test---env
---
- runFlow: ../subflows/launch.yaml

# Sign in on the Profile tab. Every field is addressable by its
# accessibilityLabel: TextField spreads TextInputProps straight to the TextInput,
# and Button sets accessibilityLabel={label}.
- tapOn:
    text: "Profile"
- assertVisible:
    text: "Welcome Back"
- tapOn:
    text: "Email"
- inputText: ${DEVICE_EMAIL}
- tapOn:
    text: "Password"
- inputText: ${DEVICE_PASSWORD}
- hideKeyboard
- tapOn:
    text: "Sign In"

# A parent with role resolved from GET /api/contributors/me lands on
# ChildProfileHome (app/(tabs)/profile/index.tsx), not the "Signed in as" card.
- assertVisible:
    text: "Child profile"
- assertVisible:
    text: "Customization Metrics"

# The actual test: kill the process, then cold-start again. Anything held only in
# React state or memory is gone; only what secureStoreAdapter wrote survives.
- stopApp
- runFlow: ../subflows/launch.yaml
- tapOn:
    text: "Profile"

# Still signed in — no sign-in form. Asserting the form is absent matters as much
# as asserting the home is present: a half-restored session could render both.
- assertVisible:
    text: "Child profile"
- assertNotVisible:
    text: "Welcome Back"
```

- [ ] **Step 2: See it fail before it passes**

The flow must be seen to fail when the session is *not* persisted, or it proves nothing about
SecureStore. Force the web adapter, which has no `localStorage` on native and so cannot persist:

In `lib/supabase-storage.ts:30`, temporarily invert the branch:

```ts
  return os === 'web' ? webAdapter : webAdapter
```

Rebuild the APK and run the flow.

Expected: the post-`stopApp` `assertVisible: "Child profile"` fails and `"Welcome Back"` is on screen
— the session did not survive. **Revert the change** before continuing.

This is the single most important step in the plan. Without it, the flow passes on any build where
the app merely re-renders quickly, and the suite's whole justification is unverified.

- [ ] **Step 3: Run against the real adapter**

```bash
cd packages/mobile && eval $(pnpm --silent device:fixture) && \
  maestro test .maestro/flows/session-survives-cold-start.yaml \
    --env DEVICE_EMAIL=$DEVICE_EMAIL --env DEVICE_PASSWORD=$DEVICE_PASSWORD
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add packages/mobile/.maestro/flows/session-survives-cold-start.yaml
git commit -m "test(mobile): assert the session survives a cold start on device"
```

---

### Task 5: Flow 2 — signing out clears the stored session

Without this, Flow 1 passes against a Keychain entry that is written once and never cleared — a
`removeItem` that silently does nothing would go unnoticed.

**Files:**
- Create: `packages/mobile/.maestro/flows/sign-out-clears-session.yaml`

**Interfaces:**
- Consumes: `launch.yaml` (Task 3); `DEVICE_EMAIL` / `DEVICE_PASSWORD` (Task 2).

- [ ] **Step 1: Write the flow**

```yaml
appId: com.splatconnect.mobile
env:
  DEVICE_EMAIL: set-by-maestro-test---env
  DEVICE_PASSWORD: set-by-maestro-test---env
---
- runFlow: ../subflows/launch.yaml
- tapOn:
    text: "Profile"
- tapOn:
    text: "Email"
- inputText: ${DEVICE_EMAIL}
- tapOn:
    text: "Password"
- inputText: ${DEVICE_PASSWORD}
- hideKeyboard
- tapOn:
    text: "Sign In"
- assertVisible:
    text: "Child profile"

# ChildProfileHome carries its own Sign Out (child-profile-home.tsx:109), so the
# parent view does not need to be left first.
- tapOn:
    text: "Sign Out"
- assertVisible:
    text: "Welcome Back"

# The point of the flow: the cleared state must be what persisted, not just what
# is on screen. secureStoreAdapter.removeItem has to have actually deleted the key.
- stopApp
- runFlow: ../subflows/launch.yaml
- tapOn:
    text: "Profile"
- assertVisible:
    text: "Welcome Back"
- assertNotVisible:
    text: "Child profile"
```

- [ ] **Step 2: See it fail before it passes**

In `lib/supabase-storage.ts`, temporarily make the native `removeItem` a no-op:

```ts
  removeItem: async () => {},
```

Rebuild and run.

Expected: the post-`stopApp` assertions fail — the app comes back signed in because the key was never
deleted. **Revert** before continuing.

- [ ] **Step 3: Run against the real adapter**

```bash
cd packages/mobile && eval $(pnpm --silent device:fixture) && \
  maestro test .maestro/flows/sign-out-clears-session.yaml \
    --env DEVICE_EMAIL=$DEVICE_EMAIL --env DEVICE_PASSWORD=$DEVICE_PASSWORD
```

Expected: pass.

- [ ] **Step 4: Run both flows together**

```bash
cd packages/mobile && eval $(pnpm --silent device:fixture) && \
  maestro test .maestro/flows/ \
    --env DEVICE_EMAIL=$DEVICE_EMAIL --env DEVICE_PASSWORD=$DEVICE_PASSWORD
```

Expected: **2 flows** reported, both passing. If Maestro reports three, it recursed into `subflows/`
— point it at the two files explicitly instead.

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/.maestro/flows/sign-out-clears-session.yaml
git commit -m "test(mobile): assert sign-out clears the stored session"
```

---

### Task 6: The local build script and the phase gate

Wraps the build into one reproducible command before CI has to reproduce it.

**Files:**
- Modify: `packages/mobile/package.json` (scripts)

**Interfaces:**
- Produces: `packages/mobile/android/app/build/outputs/apk/release/app-release.apk`, the artifact Task 7 caches and installs.

- [ ] **Step 1: Add the build and test scripts**

The `EXPO_PUBLIC_*` values must be present for the **Gradle** step, not just prebuild — Gradle
invokes Metro to bundle, and that is when the values are inlined. Clearing the Metro cache first is
the `--clear` discipline from `playwright.config.ts:60-65`: the cache key does not include these
values, so an unchanged module would be served with a stale `localhost` frozen in and the device app
would silently call nothing.

In `packages/mobile/package.json`:

```json
    "device:build": "rm -rf $TMPDIR/metro-cache /tmp/metro-cache && expo prebuild -p android --clean && cd android && ./gradlew assembleRelease",
    "device:test": "maestro test .maestro/flows/",
```

Run it with the emulator-host URLs:

```bash
cd packages/mobile
EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321 \
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0 \
EXPO_PUBLIC_API_URL=http://10.0.2.2:3106 \
EXPO_PUBLIC_WEB_URL=http://10.0.2.2:3104 \
pnpm device:build
```

- [ ] **Step 2: Confirm the baked URLs, not just that the build succeeded**

A build that silently baked `localhost` produces flows that fail for reasons that look like emulator
networking. Check the bundle directly:

```bash
grep -c "10.0.2.2" packages/mobile/android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle
grep -c "localhost:54321" packages/mobile/android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle
```

Expected: a non-zero count for `10.0.2.2` and **zero** for `localhost:54321`. If the bundle path
differs, find it with
`find packages/mobile/android -name "index.android.bundle"`.

- [ ] **Step 3: Verify the API binds all interfaces**

The emulator reaches the host API over `10.0.2.2`, which only works if the server is not bound to
loopback. Start it on the device port and check from the host's LAN address:

```bash
SUPABASE_URL=http://localhost:54321 PORT=3106 API_PORT=3106 \
  pnpm --filter @splat-connect/api dev &
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3106/api/public/tutorials
curl -s -o /dev/null -w "%{http_code}\n" "http://$(ipconfig getifaddr en0):3106/api/public/tutorials"
```

Expected: `200` from both. If the second fails, the server is loopback-bound and needs
`hostname: '0.0.0.0'` in `packages/api/src/index.ts`'s `serve()` call — note it and fix it in that
package.

- [ ] **Step 4: The phase gate — both flows twice consecutively**

Matching Phase A and B's gate: passing once does not distinguish a real pass from a lucky one.

```bash
supabase db reset
cd packages/mobile && eval $(pnpm --silent device:fixture) && \
  pnpm device:test --env DEVICE_EMAIL=$DEVICE_EMAIL --env DEVICE_PASSWORD=$DEVICE_PASSWORD && \
  pnpm device:test --env DEVICE_EMAIL=$DEVICE_EMAIL --env DEVICE_PASSWORD=$DEVICE_PASSWORD
```

Expected: 2 flows pass, twice.

- [ ] **Step 5: Record the wall-clock of the build and of the flows separately**

Task 7's cache design depends on knowing which dominates. Note both numbers in this task before
moving on.

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/package.json
git commit -m "test(mobile): add the device build and Maestro run scripts"
```

---

### Task 7: The `device-e2e` CI job

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `device:build` / `device:test` (Task 6), `device:fixture` (Task 2).

- [ ] **Step 1: Add `workflow_dispatch` to the triggers**

The spec's trigger is `push: branches: [main]` plus `workflow_dispatch`. The former already exists;
add the latter alongside it:

```yaml
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
```

- [ ] **Step 2: Add the job**

```yaml
  # Native-only coverage: the one suite that exercises expo-secure-store as the
  # Supabase auth storage adapter (lib/supabase-storage.ts). The Expo-web harness
  # runs webAdapter, so no Playwright test can reach that branch.
  #
  # main and workflow_dispatch only — it does not gate PRs. An emulator plus an
  # APK build is the most expensive job here and the most prone to environmental
  # flake; blocking merges on it would trade more time than it saves.
  device-e2e:
    name: Device E2E Tests (Android)
    needs: [check, test]
    if: github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 11

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17

      # expo prebuild + assembleRelease dominates this job. The key covers every
      # file that can change the APK: the Expo config, the dependency set, and
      # this workflow. A JS-only merge hits the cache and skips the build.
      - name: Cache the release APK
        id: apk-cache
        uses: actions/cache@v4
        with:
          path: packages/mobile/android/app/build/outputs/apk/release/app-release.apk
          key: apk-${{ hashFiles('packages/mobile/app.json', 'packages/mobile/package.json', 'pnpm-lock.yaml', '.github/workflows/ci.yml') }}

      - name: Build the release APK
        if: steps.apk-cache.outputs.cache-hit != 'true'
        working-directory: packages/mobile
        env:
          EXPO_PUBLIC_SUPABASE_URL: http://10.0.2.2:54321
          EXPO_PUBLIC_SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
          EXPO_PUBLIC_API_URL: http://10.0.2.2:3106
          EXPO_PUBLIC_WEB_URL: http://10.0.2.2:3104
        run: pnpm device:build

      - uses: supabase/setup-cli@v1
        with:
          version: 2.109.1

      # 54320-54329 sit inside the runner's ephemeral port range, so the kernel
      # can hand 54322 to an outbound socket and Docker then fails to publish it.
      - name: Reserve Supabase ports from the ephemeral range
        run: sudo sysctl -w net.ipv4.ip_local_reserved_ports=54320-54329

      - name: Start local Supabase
        run: supabase start

      # Unlike the Playwright suites, nothing here starts the API for us: Maestro
      # has no webServer equivalent. The app resolves a parent's role through
      # GET /api/contributors/me, and without it the Profile tab renders the
      # signed-in card instead of ChildProfileHome and both flows fail.
      - name: Start the API on the device port
        env:
          SUPABASE_URL: http://localhost:54321
          SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
          SUPABASE_SERVICE_ROLE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
          PORT: 3106
          API_PORT: 3106
        run: |
          pnpm --filter @splat-connect/api dev &
          npx wait-on http://localhost:3106/api/public/tutorials --timeout 120000

      - name: Provision the parent fixture
        run: pnpm --filter @splat-connect/mobile device:fixture >> "$GITHUB_ENV"

      - name: Install Maestro
        run: |
          curl -fsSL "https://get.maestro.mobile.dev" | bash
          echo "$HOME/.maestro/bin" >> "$GITHUB_PATH"

      - name: Run the Maestro flows
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 34
          arch: x86_64
          profile: pixel_6
          # AVD boot is minutes of the job; the snapshot makes reruns cheaper.
          emulator-boot-timeout: 900
          working-directory: packages/mobile
          script: |
            adb install -r android/app/build/outputs/apk/release/app-release.apk
            maestro test .maestro/flows/ --env DEVICE_EMAIL=$DEVICE_EMAIL --env DEVICE_PASSWORD=$DEVICE_PASSWORD

      # Maestro writes a screenshot and a hierarchy dump per failed step. Without
      # these, a device failure is unreproducible on a machine you cannot see.
      - name: Upload Maestro artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: maestro-debug
          path: ~/.maestro/tests/**

      - name: Stop local Supabase
        if: always()
        run: supabase stop --no-backup
```

- [ ] **Step 3: Note why `device-e2e` is not in the `changes` filter**

`needs: [check, test]` deliberately omits `changes`. The job is already gated to `main` and
`workflow_dispatch` by its `if:`, so a paths filter would add a second condition for no saving —
and every merge to `main` should get the complete run, which is the same reasoning the `concurrency`
block already uses for `main`.

- [ ] **Step 4: Validate the workflow parses**

```bash
gh workflow view ci.yml 2>&1 | head -20
```

If `gh` is unauthenticated (see the parallel-agents note in this repo), fall back to
`python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"` — that catches
indentation errors, which is the realistic failure mode here.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add the Android device E2E job"
```

---

### Task 8: Prove the job green on `workflow_dispatch`, then record the outcome

The spec's Phase C gate: `device-e2e` green on a `workflow_dispatch` run **before** it is trusted on
`main`.

**Files:**
- Modify: `docs/superpowers/specs/2026-07-26-e2e-coverage-audit-design.md`
- Modify: this plan

- [ ] **Step 1: Push the branch and dispatch the job**

```bash
git push -u origin HEAD
gh workflow run ci.yml --ref "$(git branch --show-current)"
gh run watch
```

The `if:` accepts `workflow_dispatch` on any ref, so this runs without merging to `main` first.

- [ ] **Step 2: Confirm from the logs, not just the green tick**

Three things a passing tick would not distinguish from a broken suite:

1. The APK build ran (first run) or the cache hit (later runs) — whichever, it should match expectation.
2. `Provision the parent fixture` wrote two variables, and the Maestro step did not receive empty strings. An empty `DEVICE_EMAIL` makes `inputText` type nothing and the flow fails at sign-in.
3. Both flows are reported, not one. `maestro test` silently matching zero flows and exiting 0 is the failure mode to rule out.

- [ ] **Step 3: Record the measured cost**

Note cold (cache miss) and warm (cache hit) wall-clock in this plan's header, against the spec's
estimate of 8–12 minutes cold and 4–5 warm.

- [ ] **Step 4: Update the spec's negative space**

Add to the out-of-scope section of
`docs/superpowers/specs/2026-07-26-e2e-coverage-audit-design.md`:

- **Deep-link cold start (spec Phase C flow 3).** Dropped: the app has no deep-link handling to test. `emailRedirectTo` points at the web app's `/auth/confirmed`, `app.json` has no `scheme`, and nothing reads an incoming URL. Covering it means building app-side email confirmation first — a product change, not test coverage. The "Real email delivery" bullet's claim that the confirmation link is covered by the deep-link cold start no longer holds and should be corrected.
- **Intro video as a standalone flow (spec Phase C flow 4).** Not needed: `IntroVideo` covers the whole app on every cold start and swallows touches, so both device flows must dismiss it to reach anything. Its render on real `expo-video` is asserted implicitly by their passing.

- [ ] **Step 5: Mark the plan complete and commit**

```bash
git add docs/superpowers/specs/2026-07-26-e2e-coverage-audit-design.md docs/superpowers/plans/2026-07-26-e2e-phase-c-maestro-device-suite.md
git commit -m "docs: record Phase C completion and the two dropped device flows"
```

---

## Verification

| Gate | Command | Expected |
| --- | --- | --- |
| Config | `pnpm --filter @splat-connect/mobile exec expo prebuild -p android --clean` | `usesCleartextTraffic="true"` and `applicationId 'com.splatconnect.mobile'` in the generated project |
| Baked URLs | `grep -c "localhost:54321" …/index.android.bundle` | `0` |
| Each flow fails first | Adapter sabotaged per Tasks 4–5 Step 2 | the post-`stopApp` assertion fails |
| Phase gate | `pnpm device:test` twice from a fresh `supabase db reset` | 2 flows pass, twice |
| CI | `gh workflow run ci.yml` | `device-e2e` green, both flows reported |
| No regressions | `pnpm -r typecheck && pnpm -r test:unit && both E2E suites` | clean; 71 web / 37 mobile |

Both flows must be seen to fail against a sabotaged storage adapter before they count as passing.
A cold-start assertion that passes either way is worse than no test: it reports coverage of
`secureStoreAdapter` while asserting only that the app renders.
