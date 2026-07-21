# Mobile App Scaffold (Expo) — Home Tab + Auth Design

**Date:** 2026-07-21
**Branch:** development

---

## Problem

`SPLAT_mobile_claude_design/` contains a static HTML/CSS mockup (built with a Claude prototyping tool, not real code) of a parent-facing mobile app with 5 tabs: Home (tutorial library), Scanner (camera-based toy detection), Profile (account + child ability profile + toy collection), Toy Library (associations, donate/exchange), and 3D Print (print requests).

None of this exists as a real app. The current codebase (`packages/web` + `packages/api`) only serves a contributor/admin web tool for publishing tutorials — there's no mobile client, and the data model only has `admin`/`contributor` roles with no concept of a parent user or child profile.

The full mockup is too large for one implementation: 4 of its 5 tabs require new data models (ability profiles, toy collections, toy library locations, print requests) that don't exist yet. This spec scopes down to the first buildable slice: **stand up the Expo app itself, wire up auth, and build the one tab (Home) that's fully backed by data and API routes that already exist.** Everything else becomes its own future spec once this shell is proven.

---

## Decisions

- **Platform:** Expo + React Navigation via Expo Router. Runs on iOS and Android from one codebase, testable immediately through the Expo Go app — no custom dev client needed for anything in this slice.
- **Home tab is public.** `GET /api/public/tutorials` already serves approved tutorials without auth, so the library/detail/preview screens don't require a signed-in user.
- **Auth reuses existing accounts.** Sign in only, against the existing `admin`/`contributor` Supabase accounts — no new signup flow, no new role. This proves the token/session integration pattern without inventing a `parent` role that nothing in this slice would use yet.
- **PDF over fake step viewer.** The mockup's "Preview Tutorial" screen shows fabricated paginated step data (`step.instruction`, `step.material`, `step.tool`) that has no backing column — the real schema only has `tutorial_pdf_url`. This slice opens that PDF directly (in-app WebView, falling back to the system browser) instead of building a step paginator against data that doesn't exist. A real paginated viewer can be a future spec if/when structured step data is added.
- **Tab shell built now, 4 tabs stubbed.** The bottom tab bar shows all 5 tabs matching the mockup's IA (avoids restructuring navigation per follow-up spec), but only Home is functional. Profile hosts the login screen (see below). Scanner, Toy Library, and 3D Print are static "Coming soon" placeholders with no logic.
- **No new backend work.** This slice only touches `packages/mobile`; `packages/api` and the database are untouched.

---

## Out of scope (future specs)

Ability Profile, Everyday Needs, Customization Metrics, Toy Collection CRUD, Toy Library (associations, donate/exchange with approval), 3D Print requests, Toy Scanner (computer vision), and the `parent` role/child-profile data model those features depend on.

---

## Architecture

### Monorepo placement

New package `packages/mobile` (`@splat-connect/mobile`), picked up automatically by the existing `packages/*` pnpm workspace glob — no workspace config change needed. Depends on `@splat-connect/types` via `workspace:*`, same pattern as `packages/web`.

Root `package.json` gains a `dev:mobile` script (`pnpm --filter @splat-connect/mobile dev`) alongside the existing `dev:api`/`dev:web`.

### Env vars

Follows the existing "root `.env.local` as single source of truth" convention. The mobile package's `dev` script loads env vars the same way `packages/web` does — via `dotenv-cli` reading `../../.env.local` then its own `.env.local` — before starting Expo. Exposed vars use the `EXPO_PUBLIC_` prefix (Expo's equivalent of Next's `NEXT_PUBLIC_`, auto-inlined into the client bundle):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_URL`

### Navigation (Expo Router)

```
app/
  _layout.tsx              # root layout, loads fonts, wraps app in auth context
  (tabs)/
    _layout.tsx             # bottom tab bar: Home, Scanner, Profile, Toy Library, 3D Print
    index.tsx                # Home — tutorial library list
    home/
      [id].tsx                # tutorial detail
      [id]/preview.tsx         # PDF preview (WebView)
    profile.tsx               # login form / signed-in state
    scanner.tsx                # "Coming soon" placeholder
    toy-library.tsx            # "Coming soon" placeholder
    print.tsx                  # "Coming soon" placeholder
```

### Auth

`@supabase/supabase-js` client configured with an `expo-secure-store`-backed storage adapter (the standard documented Supabase+Expo pattern — SecureStore encrypts on-device storage, unlike AsyncStorage).

Profile tab shows an email/password sign-in form against existing accounts. Once signed in: "Signed in as `{email}`" + Sign Out. Nothing else lives there yet.

`lib/api-client.ts` mirrors `packages/web/lib/browser-api-client.ts`: reads the access token off the current Supabase session and attaches it as `Authorization: Bearer <token>`. Home's public endpoints don't need it, but it's in place and exercised by future specs that add authenticated routes.

### Home tab

Three screens, all backed by existing public API routes — no backend changes:

| Screen | Route | Data |
|---|---|---|
| Library | `GET /api/public/tutorials` | search + difficulty filter chips over the returned list |
| Detail | `GET /api/public/tutorials/:id` | title, difficulty, description, parts, tools |
| Preview | — | opens `tutorial_pdf_url` in an in-app WebView (system browser fallback) |

Visual layout (cards, filter chips, colors) matches the mockup.

### Styling

Plain React Native `StyleSheet` plus a small shared `theme.ts` holding the color/spacing constants lifted from the mockup: `#1998d5` primary blue, `#1c242b` text, `#eaf6fb` accent background, Nunito font (via `expo-google-fonts`). No styling/UI library — nothing in this slice needs one.

### Testing

`jest-expo` + `@testing-library/react-native` (the standard RN test stack; `packages/web`'s Vitest setup doesn't run RN components). Minimum coverage for this slice:
- Unit test for `api-client.ts`'s request/auth-header logic, mirroring `browser-api-client.test.ts`
- Render test for the library list screen (renders tutorial cards from mock data)

---

## Compatibility notes

- Everything selected (`expo-secure-store`, `expo-google-fonts`, `react-native-webview`) runs inside the standard Expo Go client — `npx expo start` and scanning the QR code works with no custom dev client or native build.
- Native Swift/Kotlin modules (e.g. a future Apple Watch companion) remain possible later via Expo's Modules API + config plugins, but would require moving that feature off Expo Go to a custom EAS dev build. Not needed for anything in this slice.
