# Mobile Shell (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile app's five-tab shell with the approved one — Guides · Toy Library · MY SPLAT (raised centre button → popover → modal stack) · Explore · Inbox — in the Pixel visual language, gated behind sign-in, with every hub row navigable.

**Architecture:** `expo-router` file routes. `(auth)` group holds sign-in; `(tabs)` group holds the four browse tabs behind a custom `tabBar` that draws the raised centre button; `(my)` group is a modal `Stack` holding the hub page and every account destination, so opening My toys from Guides never pushes onto the Guides stack. Navigation rows come from `buildNav(caps)`, moved from web into `@splat-connect/types` so both apps read one model; a small mobile table maps its web hrefs to mobile routes.

**Tech Stack:** Expo SDK 57, expo-router 57, react-native 0.86, react-native-reanimated 4, `@expo-google-fonts/nunito` + `@expo-google-fonts/jersey-10`, jest-expo + @testing-library/react-native (unit), Playwright over `expo export -p web` (e2e), Maestro (device).

**Spec:** `docs/superpowers/specs/2026-08-30-mobile-catch-up-design.md` — the mockup linked there is the visual authority.

## Global Constraints

- Package is `packages/mobile`; run every command from there unless stated. `pnpm typecheck`, `pnpm test:unit`, `pnpm test:e2e` are the three gates. Never run bare `jest` from the repo root.
- Read https://docs.expo.dev/versions/v57.0.0/ before touching anything Expo (the package's own AGENTS.md rule).
- Pixel tokens, verbatim from the spec: borders 2px (thin) / 3px (thick) in ink `#12283a`; shadows are hard offsets `{width: n, height: n}` with zero radius, depths 3/4/5/6; radii 6/8/10/20; Nunito for all text, **Jersey 10 for numerals only** (counts, badges with numbers). No blurred shadows, no 14px/18px radii, no pill buttons.
- Copy: no "sign in to…" anywhere (the app requires sign-in). Tab labels exactly `Guides`, `Toy Library`, `MY SPLAT`, `Explore`, `Inbox`.
- Every count badge reads `GET /api/notifications/me/unread-counts` and `GET /api/toy-transactions/action-count` — the same two the web rail reads. No new endpoints in this phase.
- Web must stay green: `pnpm --filter @splat-connect/web test:unit` after Task 3.
- Commit only when Byron asks. Each task ends with a "ready to commit" step listing the files; do not run `git commit` unless told to.
- Existing tests that name old routes (`/home`, `/profile`, `Scanner`, `3D Print`) are updated in the task that renames them, never deleted wholesale.

---

## File map

**Create**
- `packages/types/src/nav-model.ts` — `Capabilities`, `NavRow`, `NavGroup`, `buildNav` (moved from web, unchanged)
- `packages/mobile/lib/capabilities.ts` — `useCapabilities()` hook
- `packages/mobile/lib/my-routes.ts` — web href → mobile route table
- `packages/mobile/lib/my-splat-tiles.ts` — `popoverTiles(caps)` pure function
- `packages/mobile/components/ui/SectionStub.tsx` — title + blurb screen for not-yet-built destinations
- `packages/mobile/components/pixel-tab-bar.tsx` — custom tab bar with raised centre button
- `packages/mobile/components/my-splat-popover.tsx` — the popover
- `packages/mobile/components/auth-screen.tsx` — sign in / sign up (extracted from profile-screen)
- `packages/mobile/app/(auth)/_layout.tsx`, `app/(auth)/sign-in.tsx`
- `packages/mobile/app/(tabs)/toy-library.tsx`, `app/(tabs)/explore.tsx`, `app/(tabs)/inbox.tsx`
- `packages/mobile/app/(my)/_layout.tsx`, `app/(my)/my-splat.tsx`, `app/(my)/account/{index,ability,customization,everyday-needs}.tsx`, `app/(my)/{tutorials/index,toys/index,exchanges/index,challenges/index,saved/index,notifications,print-requests,admin}.tsx`, `app/(my)/organisation/{index,toys,orders}.tsx`
- tests named per task

**Modify**
- `packages/mobile/lib/theme.ts` — Pixel tokens
- `packages/mobile/app/_layout.tsx` — Stack root, Jersey 10 font
- `packages/mobile/app/index.tsx` — redirect to `/guides`
- `packages/mobile/app/(tabs)/_layout.tsx` — four tabs, custom bar, popover host, auth redirect
- `packages/mobile/components/ui/{Card,Button,Chip,ScreenHeader}.tsx` — Pixel restyle
- `packages/mobile/components/profile-screen.tsx` — becomes the signed-in Account screen only
- `packages/mobile/components/profile/child-profile-home.tsx` — paths `/profile/*` → `/account/*`
- `packages/mobile/components/home/{library-screen,detail-screen}.tsx` — paths `/home` → `/guides`
- `packages/web/lib/nav-model.ts`, `packages/web/lib/capabilities.ts` — re-export from types
- `packages/mobile/tests/e2e/*.spec.ts`, `.maestro/flows/*.yaml` — routes and flow

**Move (git mv)**
- `app/(tabs)/home/**` → `app/(tabs)/guides/**`
- `app/(tabs)/profile/{index,ability,customization,everyday-needs}.tsx` → `app/(my)/account/`

**Delete**
- `app/(tabs)/scanner.tsx`, `app/(tabs)/print.tsx`, `app/(tabs)/toy-library.tsx` (the stub — recreated as a real tab file), `app/(tabs)/profile/_layout.tsx`, `components/coming-soon.tsx`, `tests/unit/components/coming-soon.test.tsx`

---

### Task 1: Pixel theme tokens and the numeral font

**Files:**
- Modify: `packages/mobile/lib/theme.ts`
- Modify: `packages/mobile/app/_layout.tsx:1-8`
- Modify: `packages/mobile/package.json` (dependency)
- Test: `packages/mobile/tests/unit/lib/theme.test.ts`

**Interfaces:**
- Produces: `theme.border = { thin: 2, thick: 3 }`, `theme.radii = { sm: 6, md: 8, lg: 10, pill: 20 }`, `theme.shadow(depth: 3|4|5|6): ViewStyle`, `theme.fonts.numeral = 'Jersey10_400Regular'`, `theme.colors.ink` (alias of `text`), `theme.colors.tone: Record<'sunken'|'honey'|'mint'|'apricot'|'brand', {bg: string; fg: string}>`.

- [ ] **Step 1: Add the dependency**

Run: `cd packages/mobile && pnpm exec expo install @expo-google-fonts/jersey-10`
Expected: `package.json` gains `"@expo-google-fonts/jersey-10": "^0.4.1"` (or the SDK-57 pinned version expo picks).

- [ ] **Step 2: Write the failing test**

```ts
// packages/mobile/tests/unit/lib/theme.test.ts
import { theme } from '../../../lib/theme'

// WCAG relative luminance — small enough to inline; the web's tone.test.ts does the same.
function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

describe('Pixel theme', () => {
  it('carries hard-edged tokens', () => {
    expect(theme.border).toEqual({ thin: 2, thick: 3 })
    expect(theme.radii).toEqual({ sm: 6, md: 8, lg: 10, pill: 20 })
    expect(theme.fonts.numeral).toBe('Jersey10_400Regular')
  })

  it('shadow(n) is a zero-blur offset of n in ink', () => {
    expect(theme.shadow(4)).toEqual({
      shadowColor: theme.colors.ink,
      shadowOpacity: 1,
      shadowRadius: 0,
      shadowOffset: { width: 4, height: 4 },
      elevation: 4,
    })
  })

  it('every badge tone clears 4.5:1', () => {
    for (const [name, { bg, fg }] of Object.entries(theme.colors.tone)) {
      expect({ name, ratio: contrast(bg, fg) }).toEqual(
        expect.objectContaining({ ratio: expect.any(Number) })
      )
      expect(contrast(bg, fg)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm exec jest tests/unit/lib/theme.test.ts`
Expected: FAIL — `theme.border` undefined.

- [ ] **Step 4: Add the tokens**

Replace the `radii` and `elevation` blocks in `packages/mobile/lib/theme.ts` and add the new keys. Keep every existing key that other files read (`background`, `surface`, `muted`, `border` colour, `difficulty`, `fonts.regular/semiBold/bold`, `type`, `spacing`, `motion`):

```ts
// packages/mobile/lib/theme.ts — the Pixel language: ink borders, hard offset
// shadows, small radii. The blurred shadow and 14–18px radii of the soft pass
// are gone; nothing reads them once Task 2 lands.
export const theme = {
  colors: {
    primary: '#1998d5',
    primaryDark: '#0f6f9c',
    primaryDeep: '#0a4f70',
    background: '#eaf4fa',
    surface: '#ffffff',
    surfaceSunken: '#dcedf6',
    accentLight: '#d8ecf7',
    text: '#12283a',
    ink: '#12283a',
    muted: '#476376',
    border: '#c6e0ed',
    apricot: '#ff8f5e',
    apricotSoft: '#ffe3d5',
    apricotDeep: '#8c3312',
    mint: '#2fbf9f',
    mintSoft: '#d4f2ea',
    mintDeep: '#0f5c4d',
    honeySoft: '#fdeecb',
    honeyDeep: '#7a4e05',
    danger: '#a3301a',
    // Badge tones — the same bg/fg pairs as web's badge.tsx. tone.test guards contrast.
    tone: {
      sunken: { bg: '#dcedf6', fg: '#0a4f70' },
      honey: { bg: '#fdeecb', fg: '#7a4e05' },
      mint: { bg: '#d4f2ea', fg: '#0f5c4d' },
      apricot: { bg: '#ffe3d5', fg: '#8c3312' },
      brand: { bg: '#d8ecf7', fg: '#0a4f70' },
    },
    difficulty: {
      easy: { bg: '#d4f2ea', text: '#0f5c4d' },
      medium: { bg: '#fdeecb', text: '#7a4e05' },
      hard: { bg: '#ffe0d6', text: '#8c3312' },
    },
  },
  fonts: {
    regular: 'Nunito_400Regular',
    semiBold: 'Nunito_600SemiBold',
    bold: 'Nunito_700Bold',
    black: 'Nunito_900Black',
    // Numerals only — the board draws Jersey 10 on counts and nothing else.
    numeral: 'Jersey10_400Regular',
  },
  type: { title: 24, heading: 19, body: 16, label: 14, caption: 13 },
  spacing: (n: number) => n * 4,
  border: { thin: 2, thick: 3 },
  radii: { sm: 6, md: 8, lg: 10, pill: 20 },
  // A hard shadow is an offset copy of the box in ink. `elevation` mirrors the
  // depth so Android draws something; it will be soft there, which is accepted.
  shadow: (depth: 3 | 4 | 5 | 6) => ({
    shadowColor: '#12283a',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: depth, height: depth },
    elevation: depth,
  }),
  motion: {
    pressScale: 0.96,
    fast: 140,
    base: 240,
    stagger: 55,
    press: { damping: 20, stiffness: 320, mass: 0.85 },
    settle: { damping: 16, stiffness: 170, mass: 0.9 },
  },
} as const
```

- [ ] **Step 5: Load the fonts**

In `packages/mobile/app/_layout.tsx` replace the font import and `useFonts` call:

```tsx
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_900Black } from '@expo-google-fonts/nunito'
import { Jersey10_400Regular } from '@expo-google-fonts/jersey-10'
// …
const [fontsLoaded] = useFonts({
  Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_900Black, Jersey10_400Regular,
})
```

- [ ] **Step 6: Run the test and typecheck**

Run: `pnpm exec jest tests/unit/lib/theme.test.ts && pnpm typecheck`
Expected: PASS; typecheck reports errors only in files that read `theme.elevation` or `theme.radii.pill` as 999 — those are fixed in Task 2. If typecheck lists any *other* file, fix it here.

- [ ] **Step 7: Ready to commit**

Files: `packages/mobile/lib/theme.ts`, `packages/mobile/app/_layout.tsx`, `packages/mobile/package.json`, `pnpm-lock.yaml`, `packages/mobile/tests/unit/lib/theme.test.ts`. Message: `feat(mobile): pixel theme tokens and the Jersey 10 numeral font`.

---

### Task 2: Restyle the four primitives to Pixel

**Files:**
- Modify: `packages/mobile/components/ui/Card.tsx`, `Button.tsx`, `Chip.tsx`, `ScreenHeader.tsx`
- Test: `packages/mobile/tests/unit/components/ui/Card.test.tsx` (new); existing `AnimatedPressable.test.tsx`, `Screen.test.tsx` keep passing

**Interfaces:**
- Consumes: `theme.border`, `theme.shadow`, `theme.radii` from Task 1.
- Produces: `Card` variants `'raised' | 'feature'` unchanged in name; `Button` variants `'primary' | 'accent' | 'secondary' | 'ghost'` (adds `accent`, apricot); `Chip` unchanged API.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/mobile/tests/unit/components/ui/Card.test.tsx
import { render, screen } from '@testing-library/react-native'
import { Text, StyleSheet } from 'react-native'
import { Card } from '../../../../components/ui/Card'
import { theme } from '../../../../lib/theme'

it('a raised card is an ink-bordered box with a hard 4px shadow', () => {
  render(<Card testID="card"><Text>hi</Text></Card>)
  const style = StyleSheet.flatten(screen.getByTestId('card').props.style)
  expect(style.borderWidth).toBe(theme.border.thin)
  expect(style.borderColor).toBe(theme.colors.ink)
  expect(style.borderRadius).toBe(theme.radii.md)
  expect(style.shadowRadius).toBe(0)
  expect(style.shadowOffset).toEqual({ width: 4, height: 4 })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec jest tests/unit/components/ui/Card.test.tsx`
Expected: FAIL — `borderWidth` undefined.

- [ ] **Step 3: Restyle Card**

```tsx
// packages/mobile/components/ui/Card.tsx
import { View, StyleSheet, type ViewProps } from 'react-native'
import { theme } from '../../lib/theme'

type CardVariant = 'raised' | 'feature'

export function Card({ variant = 'raised', style, children, ...rest }: ViewProps & { variant?: CardVariant }) {
  return (
    <View style={[styles.base, styles[variant], style]} {...rest}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radii.md,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    padding: theme.spacing(4),
    backgroundColor: theme.colors.surface,
  },
  raised: { ...theme.shadow(4) },
  // Feature cards sit one rung deeper and on the brand tint — the hero box on a screen.
  feature: { backgroundColor: theme.colors.accentLight, borderWidth: theme.border.thick, ...theme.shadow(5) },
})
```

- [ ] **Step 4: Restyle Button**

Replace `VARIANTS` and `styles` in `packages/mobile/components/ui/Button.tsx`; the component body and props stay, plus the new variant name in the union:

```tsx
type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost'

const VARIANTS: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  primary: { container: { backgroundColor: theme.colors.primary, ...theme.shadow(4) }, text: { color: '#ffffff' } },
  accent: { container: { backgroundColor: theme.colors.apricot, ...theme.shadow(4) }, text: { color: theme.colors.ink } },
  secondary: { container: { backgroundColor: theme.colors.surface, ...theme.shadow(3) }, text: { color: theme.colors.ink } },
  // Ghost is the one flat button: no border, no shadow — a quiet text action.
  ghost: { container: { backgroundColor: 'transparent', borderWidth: 0 }, text: { color: theme.colors.primaryDeep } },
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radii.sm,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(5),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  disabled: { opacity: 0.5 },
  text: { fontFamily: theme.fonts.black, fontSize: theme.type.body },
})
```

- [ ] **Step 5: Restyle Chip**

In `Chip.tsx`: `styles.fill.borderWidth` → `theme.border.thin`; inactive border colour in `interpolateColor` → `theme.colors.ink` (both ends, the border no longer changes); active fill → `theme.colors.ink` and active text `theme.colors.background`; inactive text `theme.colors.ink`. `styles.chip.minHeight` → 40 and `paddingVertical` → `theme.spacing(2)` — chips are filters, not buttons, and the mockup draws them at 28px.

- [ ] **Step 6: Restyle ScreenHeader**

In `ScreenHeader.tsx`: `title.fontFamily` → `theme.fonts.black`, `subtitle.marginTop` → `theme.spacing(2)` (the 8px gap Byron asked for), `subtitle.lineHeight: 18`. Logo stays.

- [ ] **Step 7: Run the unit suite and typecheck**

Run: `pnpm test:unit && pnpm typecheck`
Expected: all green. If `profile-screen.test.tsx` or `coming-soon.test.tsx` assert a colour that changed, update the expectation to the token (`theme.colors.ink`) — never hardcode a hex in a test.

- [ ] **Step 8: Ready to commit**

Files: the four primitives + `Card.test.tsx` (+ any test expectation touched). Message: `feat(mobile): card, button, chip and header in the pixel language`.

---

### Task 3: `buildNav` and `Capabilities` move to types; mobile gets `useCapabilities`

**Files:**
- Create: `packages/types/src/nav-model.ts`
- Modify: `packages/types/src/index.ts` (one line: `export * from './nav-model'`)
- Modify: `packages/web/lib/nav-model.ts` → re-export; `packages/web/lib/capabilities.ts` → import the type
- Create: `packages/mobile/lib/capabilities.ts`
- Test: `packages/mobile/tests/unit/lib/capabilities.test.tsx`; web's `tests/unit/lib/nav-model.test.ts` unchanged and green

**Interfaces:**
- Produces (types): `export type Capabilities = { profile: Profile; isAdmin: boolean; ledOrgs: Organization[]; unread: UnreadCounts; exchangeActions: number }`, `export type IconName`, `NavRow`, `NavGroup`, `export function buildNav(caps: Capabilities): NavGroup[]` — bodies byte-identical to today's `packages/web/lib/nav-model.ts`.
- Produces (mobile): `export function useCapabilities(): { caps: Capabilities | null; loading: boolean; refresh: () => Promise<void> }`.

- [ ] **Step 1: Move the model**

Run: `git mv packages/web/lib/nav-model.ts packages/types/src/nav-model.ts`. In the moved file, replace `import type { Capabilities } from '@/lib/capabilities'` with:

```ts
import type { Profile, Organization, UnreadCounts } from './index'

export type Capabilities = {
  profile: Profile
  isAdmin: boolean
  ledOrgs: Organization[]
  unread: UnreadCounts
  exchangeActions: number
}
```

Leave the docblock and `buildNav` untouched. Append `export * from './nav-model'` to `packages/types/src/index.ts`. (`index.ts` importing from `./nav-model` while `nav-model` imports from `./index` is a type-only cycle; TypeScript resolves it.)

- [ ] **Step 2: Re-export from web**

```ts
// packages/web/lib/nav-model.ts
// Moved to @splat-connect/types on 2026-08-30 so mobile's hub reads the same
// model. Every consumer still imports from here.
export { buildNav } from '@splat-connect/types'
export type { IconName, NavRow, NavGroup } from '@splat-connect/types'
```

In `packages/web/lib/capabilities.ts` delete the local `export type Capabilities = {…}` block and add `export type { Capabilities } from '@splat-connect/types'` plus `import type { Capabilities } from '@splat-connect/types'` for the function's return type.

- [ ] **Step 3: Verify web is green**

Run: `pnpm --filter @splat-connect/types typecheck && pnpm --filter @splat-connect/web typecheck && pnpm --filter @splat-connect/web exec vitest run tests/unit`
Expected: all pass (the web suite is ~900 tests; `nav-model.test.ts`, `rail.test.tsx`, `capabilities.test.ts` are the ones that would break).

- [ ] **Step 4: Write the failing mobile test**

```tsx
// packages/mobile/tests/unit/lib/capabilities.test.tsx
import { renderHook, waitFor } from '@testing-library/react-native'
import { useCapabilities } from '../../../lib/capabilities'

const mockGet = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('../../../lib/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

const profile = { id: 'u1', name: 'B', email: 'b@x', role: 'contributor', public_showcase: true, created_at: '' }

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((path: string) => {
    if (path === '/api/contributors/me') return Promise.resolve(profile)
    if (path === '/api/organizations/mine') return Promise.resolve([{ id: 'o1', name: 'Alpha' }])
    if (path === '/api/notifications/me/unread-counts') return Promise.resolve({ tutorials: 1, exchanges: 2, challenges: 0, total: 3 })
    if (path === '/api/toy-transactions/action-count') return Promise.resolve({ count: 4 })
    return Promise.reject(new Error(path))
  })
})

it('assembles capabilities from the four rail endpoints', async () => {
  const { result } = renderHook(() => useCapabilities())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.caps).toEqual({
    profile, isAdmin: false, ledOrgs: [{ id: 'o1', name: 'Alpha' }],
    unread: { tutorials: 1, exchanges: 2, challenges: 0, total: 3 }, exchangeActions: 4,
  })
})

it('degrades each optional endpoint to its empty value, not to null caps', async () => {
  mockGet.mockImplementation((path: string) =>
    path === '/api/contributors/me' ? Promise.resolve(profile) : Promise.reject(new Error('down')))
  const { result } = renderHook(() => useCapabilities())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.caps?.ledOrgs).toEqual([])
  expect(result.current.caps?.unread.total).toBe(0)
  expect(result.current.caps?.exchangeActions).toBe(0)
})
```

- [ ] **Step 5: Run it to verify it fails**

Run: `pnpm exec jest tests/unit/lib/capabilities.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 6: Write the hook**

```ts
// packages/mobile/lib/capabilities.ts
// Mirrors packages/web/lib/capabilities.ts: same four endpoints, same
// degradation. Web caches per request; mobile refetches on demand (refresh)
// and whenever the session changes.
import { useCallback, useEffect, useState } from 'react'
import type { Capabilities, Organization, Profile, UnreadCounts } from '@splat-connect/types'
import { apiClient } from './api-client'
import { useAuth } from './auth-context'

const NO_UNREAD: UnreadCounts = { tutorials: 0, exchanges: 0, challenges: 0, total: 0 }

export async function fetchCapabilities(): Promise<Capabilities | null> {
  let profile: Profile
  try {
    profile = await apiClient.get<Profile>('/api/contributors/me')
  } catch {
    return null
  }
  const [ledOrgs, unread, exchangeActions] = await Promise.all([
    apiClient.get<Organization[]>('/api/organizations/mine').catch(() => [] as Organization[]),
    apiClient.get<UnreadCounts>('/api/notifications/me/unread-counts').catch(() => NO_UNREAD),
    apiClient.get<{ count: number }>('/api/toy-transactions/action-count').then((r) => r.count).catch(() => 0),
  ])
  return { profile, isAdmin: profile.role === 'admin', ledOrgs, unread, exchangeActions }
}

export function useCapabilities() {
  const { session } = useAuth()
  const [caps, setCaps] = useState<Capabilities | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!session) { setCaps(null); setLoading(false); return }
    setCaps(await fetchCapabilities())
    setLoading(false)
  }, [session])

  useEffect(() => { refresh() }, [refresh])

  return { caps, loading, refresh }
}
```

- [ ] **Step 7: Run the test**

Run: `pnpm exec jest tests/unit/lib/capabilities.test.tsx && pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Ready to commit**

Files: `packages/types/src/nav-model.ts`, `packages/types/src/index.ts`, `packages/web/lib/nav-model.ts`, `packages/web/lib/capabilities.ts`, `packages/mobile/lib/capabilities.ts`, its test. Message: `refactor(types): buildNav and Capabilities live in types so mobile reads the same model`.

---

### Task 4: Sign-in gate — `(auth)` group, root Stack, redirects

**Files:**
- Create: `packages/mobile/components/auth-screen.tsx`, `app/(auth)/_layout.tsx`, `app/(auth)/sign-in.tsx`
- Modify: `packages/mobile/components/profile-screen.tsx` (delete the signed-out branch and `mode` state; keep `check-email`? — no: it moves with the auth screen), `app/_layout.tsx`, `app/(tabs)/_layout.tsx`
- Modify tests: `tests/unit/components/profile-screen.test.tsx`, `tests/e2e/auth.spec.ts`, `tests/e2e/navigation.spec.ts` (first test only), `.maestro/flows/*.yaml`

**Interfaces:**
- Produces: `AuthScreen` (default export of `sign-in.tsx`) — the sign in / sign up / check-email UI, verbatim from today's `ProfileScreen` signed-out branch with `ScreenHeader` title `"SPLAT Connect"` and no subtitle. `ProfileScreen` renders only the signed-in branch (segments, terms gate, sign out).

- [ ] **Step 1: Extract the auth screen**

Create `packages/mobile/components/auth-screen.tsx` by moving out of `profile-screen.tsx`: `TermsCheckbox`, `ErrorRow`, `openContributorTerms`, the `mode/name/email/password/confirmPassword/acceptedTerms/error/submitting` state, `handleSubmit`, the `check-email` branch and the signed-out `return (…)` branch, and every style those use. Export `export function AuthScreen()`. Change the header to `<ScreenHeader title="SPLAT Connect" showLogo />` and delete the subtitle (no "sign in to…" copy). Keep all `testID`s (`email-input`, `password-input`, `accept-contributor-terms`) — Maestro and Playwright address them.

In `profile-screen.tsx` delete what moved; `ProfileScreen` now begins at the `if (session)` branch (drop the condition — Task 4 Step 4 guarantees a session) and keeps the terms-gate card and the signed-in card. `TermsCheckbox`/`ErrorRow` are imported from `./auth-screen` (export them).

- [ ] **Step 2: Routes**

```tsx
// packages/mobile/app/(auth)/_layout.tsx
import { Redirect, Stack } from 'expo-router'
import { useAuth } from '../../lib/auth-context'

export default function AuthLayout() {
  const { session, loading } = useAuth()
  if (loading) return null
  if (session) return <Redirect href="/guides" />
  return <Stack screenOptions={{ headerShown: false }} />
}
```

```tsx
// packages/mobile/app/(auth)/sign-in.tsx
import { AuthScreen } from '../../components/auth-screen'
export default function SignInRoute() { return <AuthScreen /> }
```

```tsx
// packages/mobile/app/_layout.tsx — Slot becomes a Stack so (my) can present modally in Task 8
import { Stack } from 'expo-router'
// … fonts and providers unchanged …
<SafeAreaProvider>
  <AuthProvider>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
    {showIntro ? <IntroVideo onFinish={() => setShowIntro(false)} /> : null}
  </AuthProvider>
</SafeAreaProvider>
```

- [ ] **Step 3: Gate the tabs**

At the top of `TabsLayout` in `app/(tabs)/_layout.tsx`:

```tsx
const { session, loading } = useAuth()
if (loading) return null
if (!session) return <Redirect href="/sign-in" />
```

(`import { Redirect } from 'expo-router'`, `import { useAuth } from '../../lib/auth-context'`.)

- [ ] **Step 4: Update the unit test**

In `tests/unit/components/profile-screen.test.tsx`, delete the signed-out cases (they move) and create `tests/unit/components/auth-screen.test.tsx` holding them, rendering `<AuthScreen />` instead of `<ProfileScreen />`. Assertions on copy stay except the deleted subtitle. Add one case:

```tsx
it('never asks the visitor to sign in to do something — the app is behind sign-in', () => {
  render(<AuthScreen />)
  expect(screen.queryByText(/sign in to/i)).toBeNull()
})
```

- [ ] **Step 5: Update e2e**

`tests/e2e/navigation.spec.ts` first test becomes:

```ts
test('a signed-out visitor is sent to sign-in from any tab', async ({ page }) => {
  await page.goto('/guides')
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByText('Welcome Back')).toBeVisible()
})
```

In `tests/e2e/auth.spec.ts` every `page.goto('/profile')` → `page.goto('/sign-in')`, and each post-sign-in assertion that looked for the profile segment now asserts `await expect(page).toHaveURL(/\/guides$/)`. In `tests/e2e/helpers.ts`, `signUpNewAccount` navigates to `/sign-in` instead of `/profile`.

`.maestro/flows/session-survives-cold-start.yaml`: delete both `tapOn: text: "Profile"` steps; after launch assert `"Welcome Back"` directly; after sign-in assert `text: "Guides"`; after the cold-start relaunch assert `text: "Guides"` and `assertNotVisible: "Welcome Back"`. Same edit shape in `sign-out-clears-session.yaml` — sign-out is reached in Task 8 via MY SPLAT → Account, so that flow's middle section is rewritten there; here only the sign-in steps change.

- [ ] **Step 6: Run**

Run: `pnpm typecheck && pnpm test:unit`
Expected: green. (e2e runs at the end of Task 8 once routes settle.)

- [ ] **Step 7: Ready to commit**

Message: `feat(mobile): sign-in gate — the app lives behind (auth)`.

---

### Task 5: Four tabs — rename `home` → `guides`, add `toy-library`, `explore`, `inbox`, delete the stubs

**Files:**
- Move: `app/(tabs)/home/` → `app/(tabs)/guides/` (git mv the directory)
- Create: `app/(tabs)/toy-library.tsx`, `app/(tabs)/explore.tsx`, `app/(tabs)/inbox.tsx`, `components/ui/SectionStub.tsx`
- Delete: `app/(tabs)/scanner.tsx`, `app/(tabs)/print.tsx`, old `app/(tabs)/toy-library.tsx` stub, `components/coming-soon.tsx`, `tests/unit/components/coming-soon.test.tsx`
- Modify: `app/index.tsx`, `app/(tabs)/_layout.tsx`, `components/home/library-screen.tsx:198`, `components/home/detail-screen.tsx:80,85`, `tests/e2e/{navigation,home-library,home-detail}.spec.ts`
- Test: `tests/unit/components/ui/SectionStub.test.tsx`

**Interfaces:**
- Produces: `SectionStub({ title, blurb })` — `ScreenHeader` with logo + one muted paragraph, nothing else. Routes `/guides`, `/guides/[id]`, `/guides/[id]/preview`, `/toy-library`, `/explore`, `/inbox`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/mobile/tests/unit/components/ui/SectionStub.test.tsx
import { render, screen } from '@testing-library/react-native'
import { SectionStub } from '../../../../components/ui/SectionStub'

it('is a titled screen with its blurb and no promise of a date', () => {
  render(<SectionStub title="Toy Library" blurb="Adapted toys that families and organisations are giving away." />)
  expect(screen.getByText('Toy Library')).toBeTruthy()
  expect(screen.getByText(/giving away/)).toBeTruthy()
  expect(screen.queryByText(/coming soon/i)).toBeNull()
})
```

- [ ] **Step 2: Run to verify it fails** — `pnpm exec jest tests/unit/components/ui/SectionStub.test.tsx` → module not found.

- [ ] **Step 3: SectionStub**

```tsx
// packages/mobile/components/ui/SectionStub.tsx
// A destination that exists in the shell before its screen is built. Title
// and blurb only — no "coming soon", no fake steps; the next phase replaces
// the file, not this component.
import { Screen } from './Screen'
import { ScreenHeader } from './ScreenHeader'

export function SectionStub({ title, blurb }: { title: string; blurb: string }) {
  return (
    <Screen>
      <ScreenHeader title={title} subtitle={blurb} showLogo />
    </Screen>
  )
}
```

- [ ] **Step 4: Rename and rewire**

Run: `git mv "app/(tabs)/home" "app/(tabs)/guides"`, `git rm app/(tabs)/scanner.tsx app/(tabs)/print.tsx app/(tabs)/toy-library.tsx components/coming-soon.tsx tests/unit/components/coming-soon.test.tsx`.

Rename the layout component in `app/(tabs)/guides/_layout.tsx` to `GuidesStackLayout`; screen titles `'Tutorial'` → `'Guide'`. In `library-screen.tsx` `'/home/[id]'` → `'/guides/[id]'`; in `detail-screen.tsx` both `'/home/[id]/preview'` → `'/guides/[id]/preview'`. `ScreenHeader` title in `library-screen.tsx` `"Tutorial Library"` → `"Guides"`, subtitle → `"Step-by-step guides for switch-adapting toys and building assistive tech."`. `app/index.tsx` redirect → `/guides`.

New tab files:

```tsx
// app/(tabs)/toy-library.tsx
import { SectionStub } from '../../components/ui/SectionStub'
export default function ToyLibraryTab() {
  return <SectionStub title="Toy Library" blurb="Adapted toys that families and organisations are giving away." />
}
// app/(tabs)/explore.tsx
export default function ExploreTab() {
  return <SectionStub title="Explore" blurb="Search everything, plus Learn, Get Involved and About." />
}
// app/(tabs)/inbox.tsx
export default function InboxTab() {
  return <SectionStub title="Inbox" blurb="Everything waiting on you, newest first." />
}
```

`app/(tabs)/_layout.tsx` — the `Tabs.Screen` list becomes, in this order: `guides` (title `Guides`, icon book/book-outline), `toy-library` (`Toy Library`, cube), `explore` (`Explore`, compass), `inbox` (`Inbox`, mail/mail-outline). Remove `profile`, `scanner`, `print` from `ICONS`. The centre button arrives in Task 6.

- [ ] **Step 5: e2e updates**

`navigation.spec.ts`: delete the "three placeholder tabs" test; the tab-bar test iterates `[['Guides','/guides'],['Toy Library','/toy-library'],['Explore','/explore'],['Inbox','/inbox']]` after signing in with `signUpNewAccount`. `home-library.spec.ts` / `home-detail.spec.ts`: `/home` → `/guides`, `"Tutorial Library"` → `"Guides"`; rename the files to `guides-library.spec.ts` / `guides-detail.spec.ts` (git mv).

- [ ] **Step 6: Run** — `pnpm typecheck && pnpm test:unit` → green.

- [ ] **Step 7: Ready to commit** — message: `feat(mobile): guides, toy library, explore and inbox tabs; scanner and print stubs removed`.

---

### Task 6: Pixel tab bar with the raised centre button and badges

**Files:**
- Create: `packages/mobile/components/pixel-tab-bar.tsx`
- Modify: `app/(tabs)/_layout.tsx`
- Test: `tests/unit/components/pixel-tab-bar.test.tsx`

**Interfaces:**
- Produces: `PixelTabBar(props: BottomTabBarProps & { badge: number; centreOpen: boolean; onCentrePress: () => void })`. Exports `TAB_BAR_HEIGHT = 64` (content height; safe-area inset is added inside). Tab items render `Text` labels and `Ionicons`; the centre button is a `Pressable` with `accessibilityRole="button"`, `accessibilityLabel="Open My SPLAT"`, `accessibilityState={{ expanded: centreOpen }}`, `testID="my-splat-button"`. The badge renders `String(badge)` in `theme.fonts.numeral` on the Inbox item when `badge > 0`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/mobile/tests/unit/components/pixel-tab-bar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { PixelTabBar } from '../../../components/pixel-tab-bar'

const routes = ['guides', 'toy-library', 'explore', 'inbox'].map((name, i) => ({ key: `${name}-${i}`, name }))
const props: any = {
  state: { index: 0, routes, routeNames: routes.map((r) => r.name) },
  descriptors: Object.fromEntries(routes.map((r) => [r.key, { options: { title: r.name === 'toy-library' ? 'Toy Library' : r.name[0].toUpperCase() + r.name.slice(1) } }])),
  navigation: { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}

it('draws four tabs around a centre button and badges the inbox', () => {
  const onCentrePress = jest.fn()
  render(<PixelTabBar {...props} badge={8} centreOpen={false} onCentrePress={onCentrePress} />)
  for (const label of ['Guides', 'Toy Library', 'Explore', 'Inbox']) expect(screen.getByText(label)).toBeTruthy()
  expect(screen.getByText('8')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Open My SPLAT'))
  expect(onCentrePress).toHaveBeenCalled()
})

it('sits the centre button between the second and third tab', () => {
  render(<PixelTabBar {...props} badge={0} centreOpen={false} onCentrePress={() => {}} />)
  const labels = screen.getAllByText(/Guides|Toy Library|MY SPLAT|Explore|Inbox/).map((t) => t.props.children)
  expect(labels).toEqual(['Guides', 'Toy Library', 'MY SPLAT', 'Explore', 'Inbox'])
})
```

- [ ] **Step 2: Run to verify it fails** — module not found.

- [ ] **Step 3: The bar**

```tsx
// packages/mobile/components/pixel-tab-bar.tsx
// react-navigation's bar can't raise one item above the shelf, so the bar is
// ours: four ordinary items, and in the middle a disc that is a button, not a
// tab — it opens the MY SPLAT popover (Task 7) and never navigates.
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../lib/theme'

export const TAB_BAR_HEIGHT = 64

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  guides: { on: 'book', off: 'book-outline' },
  'toy-library': { on: 'cube', off: 'cube-outline' },
  explore: { on: 'compass', off: 'compass-outline' },
  inbox: { on: 'mail', off: 'mail-outline' },
}

type Props = BottomTabBarProps & { badge: number; centreOpen: boolean; onCentrePress: () => void }

export function PixelTabBar({ state, descriptors, navigation, insets, badge, centreOpen, onCentrePress }: Props) {
  const items = state.routes.map((route, index) => {
    const focused = state.index === index
    const label = descriptors[route.key].options.title ?? route.name
    const icon = ICONS[route.name] ?? ICONS.guides
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name)
    }
    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        style={styles.item}
      >
        <View>
          <Ionicons name={focused ? icon.on : icon.off} size={22} color={focused ? theme.colors.ink : theme.colors.muted} />
          {route.name === 'inbox' && badge > 0 ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{String(badge)}</Text></View>
          ) : null}
        </View>
        <Text style={[styles.label, focused && styles.labelOn]}>{label}</Text>
      </Pressable>
    )
  })

  const centre = (
    <Pressable
      key="my-splat"
      testID="my-splat-button"
      onPress={onCentrePress}
      accessibilityRole="button"
      accessibilityLabel="Open My SPLAT"
      accessibilityState={{ expanded: centreOpen }}
      style={styles.centre}
    >
      <View style={[styles.disc, centreOpen && styles.discOpen]}>
        <Ionicons name="sparkles" size={26} color={centreOpen ? theme.colors.ink : '#ffffff'} />
      </View>
      <Text style={[styles.label, styles.centreLabel]}>MY SPLAT</Text>
    </Pressable>
  )

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: TAB_BAR_HEIGHT + insets.bottom }]}>
      {items[0]}{items[1]}{centre}{items[2]}{items[3]}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderTopWidth: theme.border.thick,
    borderTopColor: theme.colors.ink,
    paddingTop: theme.spacing(2),
  },
  item: { flex: 1, alignItems: 'center', gap: 2, paddingTop: 2 },
  label: { fontFamily: theme.fonts.bold, fontSize: 10, color: theme.colors.muted },
  labelOn: { color: theme.colors.ink },
  centre: { flex: 1.25, alignItems: 'center', marginTop: -22 },
  centreLabel: { color: theme.colors.ink, letterSpacing: 0.6, marginTop: 4 },
  disc: {
    width: 54, height: 54, borderRadius: 27,
    borderWidth: theme.border.thick, borderColor: theme.colors.ink,
    backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center',
    ...theme.shadow(4),
  },
  // Open = pressed: apricot, shifted onto its own shadow.
  discOpen: { backgroundColor: theme.colors.apricot, transform: [{ translateX: 4 }, { translateY: 4 }], shadowOpacity: 0, elevation: 0 },
  badge: {
    position: 'absolute', top: -7, right: -10, minWidth: 20, height: 20, paddingHorizontal: 4,
    borderRadius: 10, borderWidth: theme.border.thin, borderColor: theme.colors.ink,
    backgroundColor: theme.colors.apricot, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontFamily: theme.fonts.numeral, fontSize: 15, lineHeight: 16, color: theme.colors.ink },
})
```

- [ ] **Step 4: Wire it**

In `app/(tabs)/_layout.tsx`:

```tsx
const { caps, refresh } = useCapabilities()
const [open, setOpen] = useState(false)
const badge = (caps?.unread.total ?? 0) + (caps?.exchangeActions ?? 0)
// …
<Tabs
  tabBar={(props) => (
    <PixelTabBar {...props} badge={badge} centreOpen={open} onCentrePress={() => setOpen((v) => !v)} />
  )}
  screenOptions={{ headerShown: false }}
  screenListeners={{ tabPress: () => setOpen(false) }}
>
```

Delete the old `tabBarStyle`/`tabBarLabelStyle`/`tabBarIcon` options — the bar owns them now.

- [ ] **Step 5: Run** — `pnpm exec jest tests/unit/components/pixel-tab-bar.test.tsx && pnpm typecheck` → green.

- [ ] **Step 6: Ready to commit** — message: `feat(mobile): pixel tab bar with the raised MY SPLAT button and inbox badge`.

---

### Task 7: The MY SPLAT popover

**Files:**
- Create: `packages/mobile/lib/my-splat-tiles.ts`, `components/my-splat-popover.tsx`
- Modify: `app/(tabs)/_layout.tsx`
- Test: `tests/unit/lib/my-splat-tiles.test.ts`, `tests/unit/components/my-splat-popover.test.tsx`

**Interfaces:**
- Produces: `type Tile = { label: string; icon: keyof typeof Ionicons.glyphMap; href: string; count?: number }`; `popoverTiles(caps: Capabilities): Tile[]` — always six, web hrefs (mapped to mobile routes in Task 8 via `myRoute`). `MySplatPopover({ caps, tabBarHeight, onClose })` renders scrim + panel; the panel's "All of My SPLAT" row navigates to `/my-splat`.

- [ ] **Step 1: Write the failing tile test**

```ts
// packages/mobile/tests/unit/lib/my-splat-tiles.test.ts
import { popoverTiles } from '../../../lib/my-splat-tiles'
import type { Capabilities } from '@splat-connect/types'

const base: Capabilities = {
  profile: { id: 'u', name: 'B', email: 'b@x', role: 'contributor', public_showcase: true, created_at: '' },
  isAdmin: false, ledOrgs: [], unread: { tutorials: 0, exchanges: 2, challenges: 1, total: 3 }, exchangeActions: 3,
}

it('is six tiles: exchanges with its count, design challenges with the challenge unread count', () => {
  const t = popoverTiles(base)
  expect(t.map((x) => x.label)).toEqual([
    'My exchanges', 'Design challenges', 'My toys', 'My tutorials', 'Saved', 'Account & child profiles',
  ])
  expect(t[0].count).toBe(3)
  expect(t[1].count).toBe(1)
  expect(t[2].count).toBeUndefined()
})

it('swaps Design challenges for Review queue when the account leads an organisation', () => {
  const t = popoverTiles({ ...base, ledOrgs: [{ id: 'o', name: 'A' } as any] })
  expect(t[1]).toMatchObject({ label: 'Review queue', href: '/dashboard/organisation' })
  expect(t).toHaveLength(6)
})
```

- [ ] **Step 2: Run to verify it fails** — module not found.

- [ ] **Step 3: The pure function**

```ts
// packages/mobile/lib/my-splat-tiles.ts
// The six things a person comes back for. Web hrefs, deliberately: the hub
// and the popover share lib/my-routes.ts to turn them into screens.
import type { Ionicons } from '@expo/vector-icons'
import type { Capabilities } from '@splat-connect/types'

export type Tile = { label: string; icon: keyof typeof Ionicons.glyphMap; href: string; count?: number }

const count = (n: number) => (n > 0 ? n : undefined)

export function popoverTiles(caps: Capabilities): Tile[] {
  const second: Tile = caps.ledOrgs.length
    ? { label: 'Review queue', icon: 'file-tray-full-outline', href: '/dashboard/organisation' }
    : { label: 'Design challenges', icon: 'bulb-outline', href: '/dashboard/challenges', count: count(caps.unread.challenges) }
  return [
    { label: 'My exchanges', icon: 'swap-horizontal-outline', href: '/dashboard/exchanges', count: count(caps.exchangeActions) },
    second,
    { label: 'My toys', icon: 'cube-outline', href: '/dashboard/toys' },
    { label: 'My tutorials', icon: 'book-outline', href: '/dashboard/tutorials' },
    { label: 'Saved', icon: 'bookmark-outline', href: '/dashboard/saved' },
    { label: 'Account & child profiles', icon: 'person-outline', href: '/dashboard/profile' },
  ]
}
```

- [ ] **Step 4: Write the failing popover test**

```tsx
// packages/mobile/tests/unit/components/my-splat-popover.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { MySplatPopover } from '../../../components/my-splat-popover'

const push = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push }) }))
jest.mock('../../../lib/my-routes', () => ({ myRoute: (href: string) => `/mapped${href}` }))

const caps: any = {
  profile: { name: 'Byron' }, isAdmin: false, ledOrgs: [],
  unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 0 }, exchangeActions: 3,
}

it('closes on the scrim and navigates through the route map from a tile', () => {
  const onClose = jest.fn()
  render(<MySplatPopover caps={caps} tabBarHeight={64} onClose={onClose} />)
  fireEvent.press(screen.getByTestId('my-splat-scrim'))
  expect(onClose).toHaveBeenCalledTimes(1)
  fireEvent.press(screen.getByText('My exchanges'))
  expect(push).toHaveBeenCalledWith('/mapped/dashboard/exchanges')
  expect(onClose).toHaveBeenCalledTimes(2)
  fireEvent.press(screen.getByText('All of My SPLAT'))
  expect(push).toHaveBeenCalledWith('/my-splat')
})
```

- [ ] **Step 5: The popover**

```tsx
// packages/mobile/components/my-splat-popover.tsx
// Grows out of the centre button and leaves the tab bar live: the scrim stops
// at the bar's top edge, so a tap on any tab closes this (the layout listens
// for tabPress) and navigates in one gesture.
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated'
import type { Capabilities } from '@splat-connect/types'
import { theme } from '../lib/theme'
import { popoverTiles } from '../lib/my-splat-tiles'
import { myRoute } from '../lib/my-routes'

export function MySplatPopover({ caps, tabBarHeight, onClose }: { caps: Capabilities; tabBarHeight: number; onClose: () => void }) {
  const router = useRouter()
  const go = (href: string) => { onClose(); router.push(href as never) }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(theme.motion.fast)} style={[styles.scrim, { bottom: tabBarHeight }]}>
        <Pressable testID="my-splat-scrim" onPress={onClose} accessibilityLabel="Close My SPLAT" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        entering={ZoomIn.duration(theme.motion.base)}
        accessibilityViewIsModal
        style={[styles.panel, { bottom: tabBarHeight + 30 }]}
      >
        <View style={styles.head}>
          <Text style={styles.title}>MY SPLAT</Text>
          <Text style={styles.hint}>Hi, {caps.profile.name.split(' ')[0]}</Text>
        </View>
        <View style={styles.grid}>
          {popoverTiles(caps).map((t) => (
            <Pressable key={t.label} onPress={() => go(myRoute(t.href))} accessibilityRole="button" accessibilityLabel={t.label} style={styles.tile}>
              <Ionicons name={t.icon} size={20} color={theme.colors.ink} />
              <Text style={styles.tileLabel}>{t.label}</Text>
              {t.count ? <View style={styles.badge}><Text style={styles.badgeText}>{String(t.count)}</Text></View> : null}
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => go('/my-splat')} accessibilityRole="button" style={styles.all}>
          <View>
            <Text style={styles.allLabel}>All of My SPLAT</Text>
            <Text style={styles.allHint}>Challenges · Organisation · Print requests · Settings</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.ink} />
        </Pressable>
        <View style={styles.tail} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: 'rgba(10,53,80,0.45)' },
  panel: {
    position: 'absolute', left: 12, right: 12,
    backgroundColor: theme.colors.background,
    borderWidth: theme.border.thick, borderColor: theme.colors.ink, borderRadius: theme.radii.lg + 2,
    padding: 12, gap: 10, ...theme.shadow(6),
  },
  tail: {
    position: 'absolute', alignSelf: 'center', bottom: -12, width: 18, height: 18,
    backgroundColor: theme.colors.background,
    borderRightWidth: theme.border.thick, borderBottomWidth: theme.border.thick, borderColor: theme.colors.ink,
    transform: [{ rotate: '45deg' }],
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontFamily: theme.fonts.black, fontSize: 15, letterSpacing: 0.6, color: theme.colors.ink },
  hint: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '48%', minHeight: 60, gap: 4, padding: 9,
    backgroundColor: theme.colors.surface, borderWidth: theme.border.thin, borderColor: theme.colors.ink,
    borderRadius: theme.radii.md, ...theme.shadow(3),
  },
  tileLabel: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.ink },
  badge: {
    position: 'absolute', top: 6, right: 6, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10,
    borderWidth: theme.border.thin, borderColor: theme.colors.ink, backgroundColor: theme.colors.apricot,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontFamily: theme.fonts.numeral, fontSize: 15, lineHeight: 16, color: theme.colors.ink },
  all: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10,
    borderWidth: theme.border.thin, borderStyle: 'dashed', borderColor: theme.colors.ink,
    borderRadius: theme.radii.md, backgroundColor: theme.colors.accentLight,
  },
  allLabel: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.ink },
  allHint: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.muted },
})
```

Grid tiles use `width: '48%'` with `gap: 8` — three rows of two, matching the mockup.

- [ ] **Step 6: Host it**

In `app/(tabs)/_layout.tsx` wrap the `Tabs` in a `View style={{ flex: 1 }}` and after it render:

```tsx
{open && caps ? (
  <MySplatPopover caps={caps} tabBarHeight={TAB_BAR_HEIGHT + insets.bottom} onClose={() => setOpen(false)} />
) : null}
```

with `const insets = useSafeAreaInsets()`. `myRoute` is created in Task 8; until then create `lib/my-routes.ts` with `export const myRoute = (href: string) => href` so this task typechecks — Task 8 replaces it.

- [ ] **Step 7: Run** — `pnpm test:unit && pnpm typecheck` → green.

- [ ] **Step 8: Ready to commit** — message: `feat(mobile): MY SPLAT popover with six shortcuts and the leader swap`.

---

### Task 8: `(my)` modal stack — hub page, route map, Account moved, stubs for every row

**Files:**
- Create: `lib/my-routes.ts` (replace the Task 7 placeholder), `app/(my)/_layout.tsx`, `app/(my)/my-splat.tsx`, `app/(my)/account/{index,ability,customization,everyday-needs}.tsx` (git mv from `(tabs)/profile/`), `app/(my)/tutorials/index.tsx`, `app/(my)/toys/index.tsx`, `app/(my)/exchanges/index.tsx`, `app/(my)/challenges/index.tsx`, `app/(my)/saved/index.tsx`, `app/(my)/notifications.tsx`, `app/(my)/print-requests.tsx`, `app/(my)/organisation/{index,toys,orders}.tsx`, `app/(my)/admin.tsx`
- Delete: `app/(tabs)/profile/_layout.tsx`
- Modify: `app/_layout.tsx` (add the `(my)` screen), `components/profile/child-profile-home.tsx:22,28,34`, `.maestro/flows/sign-out-clears-session.yaml`, `tests/e2e/{child-profile-home,ability-profile,customization,everyday-needs}.spec.ts`
- Test: `tests/unit/lib/my-routes.test.ts`, `tests/unit/app/my-splat-hub.test.tsx`, `tests/e2e/my-splat.spec.ts`

**Interfaces:**
- Produces: `myRoute(href: string): string` — total over every href `buildNav` and `popoverTiles` can emit; unknown hrefs return `/my-splat`. Routes: `/my-splat`, `/account`, `/account/ability`, `/account/customization`, `/account/everyday-needs`, `/tutorials`, `/toys`, `/exchanges`, `/challenges`, `/saved`, `/notifications`, `/print-requests`, `/organisation`, `/organisation/toys`, `/organisation/orders`, `/admin`.

- [ ] **Step 1: Write the failing route-map test**

```ts
// packages/mobile/tests/unit/lib/my-routes.test.ts
import { buildNav } from '@splat-connect/types'
import { myRoute } from '../../../lib/my-routes'
import { popoverTiles } from '../../../lib/my-splat-tiles'

const caps: any = {
  profile: { name: 'B', role: 'admin' }, isAdmin: true, ledOrgs: [{ id: 'o', name: 'A' }],
  unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 0 }, exchangeActions: 0,
}

it('maps every href the hub and popover can emit to a mobile route, and nothing to the web', () => {
  const hrefs = [...buildNav(caps).flatMap((g) => g.rows.map((r) => r.href)), ...popoverTiles(caps).map((t) => t.href)]
  for (const href of hrefs) {
    const route = myRoute(href)
    expect(route.startsWith('/')).toBe(true)
    expect(route).not.toContain('/dashboard')
    expect(route).not.toBe('/my-splat')
  }
})

it('sends the one public row to Explore and unknown hrefs to the hub', () => {
  expect(myRoute('/get-involved/submit-an-idea')).toBe('/explore')
  expect(myRoute('/nowhere')).toBe('/my-splat')
})
```

- [ ] **Step 2: Run to verify it fails** — the placeholder from Task 7 returns hrefs unchanged, so `not.toContain('/dashboard')` fails.

- [ ] **Step 3: The route map**

```ts
// packages/mobile/lib/my-routes.ts
// buildNav speaks in web hrefs (it is shared); this is the whole translation.
// Adding a hub row on web without a line here sends it to the hub, not a 404.
const ROUTES: Record<string, string> = {
  '/dashboard/tutorials': '/tutorials',
  '/dashboard/toys': '/toys',
  '/dashboard/exchanges': '/exchanges',
  '/dashboard/challenges': '/challenges',
  '/get-involved/submit-an-idea': '/explore',
  '/dashboard/print-requests': '/print-requests',
  '/dashboard/organisation': '/organisation',
  '/dashboard/organisation/toys': '/organisation/toys',
  '/dashboard/organisation/orders': '/organisation/orders',
  '/dashboard/saved': '/saved',
  '/notifications': '/notifications',
  '/dashboard/profile': '/account',
  '/admin': '/admin',
}

export const myRoute = (href: string) => ROUTES[href] ?? '/my-splat'
```

- [ ] **Step 4: The modal stack and hub**

```tsx
// packages/mobile/app/(my)/_layout.tsx
// Everything behind MY SPLAT presents modally over the tabs. The tab beneath
// keeps its own stack and its highlight; Close returns to exactly where you were.
import { Stack } from 'expo-router'
import { stackScreenOptions } from '../../lib/nav-options'

export default function MyLayout() {
  return (
    <Stack screenOptions={{ ...stackScreenOptions, presentation: 'modal', headerBackTitle: 'Back' }}>
      <Stack.Screen name="my-splat" options={{ title: 'My SPLAT' }} />
      <Stack.Screen name="account/index" options={{ title: 'Account' }} />
      <Stack.Screen name="account/ability" options={{ title: 'Ability Profile' }} />
      <Stack.Screen name="account/everyday-needs" options={{ title: 'Everyday Needs' }} />
      <Stack.Screen name="account/customization" options={{ title: 'Customization Metrics' }} />
    </Stack>
  )
}
```

Add `<Stack.Screen name="(my)" options={{ presentation: 'modal' }} />` to the root `Stack` in `app/_layout.tsx`.

```tsx
// packages/mobile/app/(my)/my-splat.tsx
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { buildNav } from '@splat-connect/types'
import { useCapabilities } from '../../lib/capabilities'
import { myRoute } from '../../lib/my-routes'
import { theme } from '../../lib/theme'
import { Card } from '../../components/ui/Card'
import { Screen } from '../../components/ui/Screen'

export default function MySplatHub() {
  const { caps } = useCapabilities()
  const router = useRouter()
  if (!caps) return <Screen />
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card variant="feature">
          <Text style={styles.eyebrow}>MY SPLAT</Text>
          <Text style={styles.name}>Hi, {caps.profile.name.split(' ')[0]}</Text>
          {caps.ledOrgs.length ? <Text style={styles.meta}>Leads {caps.ledOrgs.map((o) => o.name).join(', ')}</Text> : null}
        </Card>
        {buildNav(caps).map((group) => (
          <View key={group.heading} style={styles.group}>
            <Text style={styles.eyebrow}>{group.heading}</Text>
            {group.rows.map((row) => (
              <Pressable
                key={row.href}
                onPress={() => router.push(myRoute(row.href) as never)}
                accessibilityRole="button"
                accessibilityLabel={row.label}
                style={[styles.row, row.soon && styles.soon]}
              >
                <Text style={styles.rowLabel}>{row.label}</Text>
                {row.count ? <Text style={styles.count}>{String(row.count)}</Text> : null}
                {row.soon ? <Text style={styles.soonTag}>SOON</Text> : null}
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing(4), paddingBottom: theme.spacing(8) },
  eyebrow: { fontFamily: theme.fonts.bold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: theme.colors.muted },
  name: { fontFamily: theme.fonts.black, fontSize: 18, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.muted, marginTop: 4 },
  group: { gap: theme.spacing(2) },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    backgroundColor: theme.colors.surface, borderWidth: theme.border.thin, borderColor: theme.colors.ink,
    borderRadius: theme.radii.md, ...theme.shadow(4),
  },
  soon: { opacity: 0.62 },
  rowLabel: { flex: 1, fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.ink },
  count: {
    fontFamily: theme.fonts.numeral, fontSize: 20, lineHeight: 20, color: theme.colors.primaryDeep,
    backgroundColor: theme.colors.accentLight, borderWidth: theme.border.thin, borderColor: theme.colors.ink,
    borderRadius: 4, paddingHorizontal: 6,
  },
  soonTag: { fontFamily: theme.fonts.bold, fontSize: 9, letterSpacing: 1, color: theme.colors.muted },
})
```

- [ ] **Step 5: Move Account, stub the rest**

Run: `git mv "app/(tabs)/profile/index.tsx" "app/(my)/account/index.tsx"` and the same for `ability`, `customization`, `everyday-needs`; `git rm "app/(tabs)/profile/_layout.tsx"`. Fix the relative imports inside the four moved files (`../../../components/…` stays the same depth: `(my)/account/` is as deep as `(tabs)/profile/`). In `child-profile-home.tsx` the three `path` values become `/account/ability`, `/account/everyday-needs`, `/account/customization`. In `profile-screen.tsx` the `ScreenHeader` title `"Profile"` → `"Account"`.

Each stub is three lines, e.g.:

```tsx
// packages/mobile/app/(my)/toys/index.tsx
import { SectionStub } from '../../../components/ui/SectionStub'
export default function MyToys() { return <SectionStub title="My toys" blurb="The adapted toys you hold, ready to offer for exchange with an association." /> }
```

Titles/blurbs: `tutorials` — "My tutorials" / "Guides you wrote or collaborate on, and where each one is in review."; `exchanges` — "My exchanges" / "Requests you sent and received, until the handoff is confirmed by both sides."; `challenges` — "Design challenges" / "Ideas you submitted, and challenges you joined."; `saved` — "Saved" / "What you kept, by type."; `notifications` — "Notifications" / "Everything waiting on you, newest first."; `print-requests` — "My print requests" / "Requests you send from an assistive-tech guide will list here once printing goes live."; `organisation/index` — "Review queue" / "Guides that asked your organisation to back them."; `organisation/toys` — "Toy inventory" / "What's on the shelf. Five of the same bear is one listing."; `organisation/orders` — "Print orders" / "Requests families send your organisation will queue here once printing goes live."; `admin` — "Admin" / "Review tables don't fit a phone. These open on the web, signed in."

- [ ] **Step 6: Hub unit test**

```tsx
// packages/mobile/tests/unit/app/my-splat-hub.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import MySplatHub from '../../../app/(my)/my-splat'

const push = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push }) }))
jest.mock('../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: {
    profile: { name: 'Byron P', role: 'contributor' }, isAdmin: false, ledOrgs: [{ id: 'o', name: 'Alpha' }],
    unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 5 }, exchangeActions: 3,
  }, loading: false, refresh: jest.fn() }),
}))

it('renders every buildNav group as rows and routes them through the map', () => {
  render(<MySplatHub />)
  // getAllByText: "Account" is both a group heading and a row label.
  for (const h of ['Add a tutorial', 'Exchange a toy', 'Give us a challenge', 'Organisation', 'Account']) expect(screen.getAllByText(h).length).toBeGreaterThan(0)
  expect(screen.getByText('Leads Alpha')).toBeTruthy()
  expect(screen.getByText('3')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('My toys'))
  expect(push).toHaveBeenCalledWith('/toys')
})
```

- [ ] **Step 7: e2e**

```ts
// packages/mobile/tests/e2e/my-splat.spec.ts
import { test, expect } from '@playwright/test'
import { signUpNewAccount, uniqueSignupEmail } from './helpers'

test('the centre button opens the popover, and every escape closes it', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await page.goto('/guides')
  const button = page.getByRole('button', { name: 'Open My SPLAT' })

  await button.click()
  await expect(page.getByText('All of My SPLAT')).toBeVisible()
  await button.click()
  await expect(page.getByText('All of My SPLAT')).toBeHidden()

  await button.click()
  await page.getByLabel('Close My SPLAT').click({ position: { x: 10, y: 10 } })
  await expect(page.getByText('All of My SPLAT')).toBeHidden()

  await button.click()
  await page.getByRole('tab', { name: 'Explore' }).click()
  await expect(page.getByText('All of My SPLAT')).toBeHidden()
  await expect(page).toHaveURL(/\/explore$/)
})

test('a tile opens its screen over the current tab, and the hub lists every group', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await page.goto('/guides')
  await page.getByRole('button', { name: 'Open My SPLAT' }).click()
  await page.getByRole('button', { name: 'My toys' }).click()
  await expect(page).toHaveURL(/\/toys$/)
  await expect(page.getByText('My toys')).toBeVisible()

  await page.goto('/my-splat')
  for (const h of ['Add a tutorial', 'Exchange a toy', 'Give us a challenge', 'Account']) await expect(page.getByText(h).first()).toBeVisible()
  await page.getByRole('button', { name: 'Account' }).click()
  await expect(page).toHaveURL(/\/account$/)
})
```

Update `child-profile-home.spec.ts`, `ability-profile.spec.ts`, `customization.spec.ts`, `everyday-needs.spec.ts`: every `/profile` → `/account` (paths and `toHaveURL` patterns); where a test reached the child segment by tapping the Profile tab, replace with `await page.goto('/account')`.

`.maestro/flows/sign-out-clears-session.yaml`: after sign-in, `tapOn: text: "MY SPLAT"` → `tapOn: text: "Account & child profiles"` → `tapOn: text: "Sign Out"` → `assertVisible: "Welcome Back"`. In `session-survives-cold-start.yaml` the two `Child profile` assertions are reached the same way (`MY SPLAT` → `Account & child profiles`) after each launch.

- [ ] **Step 8: Run everything**

Run (from `packages/mobile`, with local Supabase up — `supabase start` from the repo root if it isn't): `pnpm typecheck && pnpm test:unit && pnpm test:e2e`
Expected: all green. The e2e web export takes ~3 minutes on first run.

- [ ] **Step 9: Ready to commit**

Message: `feat(mobile): MY SPLAT modal stack — hub page, account moved behind it, every row navigable`.

---

### Task 9: Device check and the graph

- [ ] **Step 1: Build for the iPhone** — `pnpm ios` (needs the device on Tailscale as the script expects). Open the app: sign in, confirm the bar shows Guides · Toy Library · MY SPLAT · Explore · Inbox, the disc sits proud of the shelf, the popover grows from it with a tail, the scrim stops at the bar, and Account opens as a modal with a Close/back that returns to Guides. Note anything the simulator-free e2e can't see (safe-area bottom, Android soft shadow) in the plan's execution notes below.
- [ ] **Step 2: Maestro** — `pnpm device:test` → both flows pass.
- [ ] **Step 3: Graph** — from the repo root: `graphify update .`
- [ ] **Step 4: Ready to commit** — nothing new to commit unless Step 1 forced a fix; list it if so.

## Execution notes

(Filled in as tasks complete.)
