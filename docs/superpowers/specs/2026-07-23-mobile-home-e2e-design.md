# Mobile Home-Tab E2E Tests — Design Spec

**Date:** 2026-07-23
**Status:** Approved for implementation
**Scope:** Sub-project 2 of the E2E test-layer work started in `2026-07-21-integration-e2e-test-layers-design.md` — the mobile app's home tab (tutorial library → detail → PDF preview), which that spec's Phase 2 did not cover (Phase 2 only covered the web package).

---

## Context

`2026-07-21-integration-e2e-test-layers-design.md` shipped Phase 0 (local Supabase foundation) and Phase 2 (web Playwright E2E). The mobile package already has its own E2E harness — `packages/mobile/playwright.config.ts` and a `mobile-e2e` CI job (`.github/workflows/ci.yml`) running `pnpm --filter @splat-connect/mobile test:e2e` against a web export of the Expo app — and existing specs in `packages/mobile/tests/e2e/` cover the Profile tab (auth, ability profile, customization, everyday needs, child-profile home, parent signup). The home tab (tutorial browsing) has no coverage yet.

This spec covers only the home tab. No config or CI changes are needed — both already exist and will pick up new spec files automatically.

### Home tab structure

Three screens, drilling down in a stack (no auth gate — confirmed no `useAuth`/redirect in `app/(tabs)/home/` or `app/_layout.tsx`):

- `library-screen.tsx` (`/home`) — search box, difficulty filter chips, `FlatList` of tutorials.
- `detail-screen.tsx` (`/home/[id]`) — title, description, difficulty badge, parts list, tools list, "Preview Tutorial" button.
- `preview-screen.tsx` (`/home/[id]/preview`) — `react-native-webview` rendering the tutorial PDF, plus an "Open in Browser" fallback button.

### `react-native-webview` has no web-export implementation

`react-native-webview`'s package (`packages/mobile/node_modules/react-native-webview/src/WebView.tsx`) ships no `.web.tsx` variant. Metro/Expo's platform-extension resolution falls back to the shared `WebView.tsx`, whose entire body is a hardcoded placeholder: `<Text>React Native WebView does not support this platform.</Text>`. Since the mobile Playwright harness drives `expo export -p web`, the preview screen's `<WebView>` never renders real PDF content in this suite — only the "Open in Browser" fallback button and the surrounding navigation are real, testable behavior.

**Accepted limitation:** the preview test asserts navigation + fallback button only, not PDF rendering. This mirrors the existing web-E2E spec's accepted limitation around placeholder file URLs.

### Seed fixture reuse

Both spec files use the single approved tutorial already in `supabase/seed.sql` (shared with the web E2E suite, no new fixtures needed):

- Title: "Seeded Switch-Adapted Bubble Machine", difficulty `easy`.
- One part: "Micro switch" (qty 2).
- One tool: "Soldering iron".

---

## Specs

**Location:** `packages/mobile/tests/e2e/` (existing directory)
**Runner:** existing `pnpm --filter @splat-connect/mobile test:e2e` (Playwright)

Both files are independently runnable — each starts fresh from `page.goto('/home')`, matching the existing suite's spec-independence convention. No new test helpers are needed; `helpers.ts` currently holds auth/profile helpers that don't apply to the home tab, and both files are short enough to stay self-contained.

### `home-library.spec.ts`

| Test | Asserts |
|---|---|
| Library lists the seeded tutorial | Visiting `/home` shows the seeded tutorial's title and difficulty badge. |
| Search narrows and clears | Typing non-matching text hides the tutorial (empty list); clearing the search field brings it back. |
| Difficulty filter narrows results | Selecting "Medium" hides the (easy) tutorial; selecting "Easy" shows it again. |

### `home-detail.spec.ts`

| Test | Asserts |
|---|---|
| Tapping a tutorial navigates to its detail screen | From `/home`, tapping the seeded tutorial's card navigates to the detail screen, which renders the title, description, difficulty badge, "Micro switch" part, and "Soldering iron" tool. |
| Preview navigation | Tapping "Preview Tutorial" navigates to the preview screen and shows the "Open in Browser" fallback button. No assertion on WebView/PDF content (see accepted limitation above). |

---

## Out of scope

- Any change to `packages/mobile/playwright.config.ts` or CI — both already exist and cover the home tab automatically.
- New seed fixtures — the single existing approved tutorial is sufficient for all planned assertions.
- Asserting real PDF content in the preview screen — not renderable under `expo export -p web` (see accepted limitation above).
- Other home-tab-adjacent tabs (Scanner, Toy Library, 3D Print) — out of scope for this sub-project.
