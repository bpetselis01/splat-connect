# Mobile Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the mobile app (`packages/mobile`) a shared, animated UI kit and restyle every screen with it, per `docs/superpowers/specs/2026-07-23-mobile-frontend-redesign-design.md`, without changing any behavior, copy, route, or accessible name that existing tests depend on.

**Architecture:** Additive theme tokens (`radii`/`shadow`/`motion`) in `packages/mobile/lib/theme.ts`, six new primitives under `packages/mobile/components/ui/` (`AnimatedPressable`, `Button`, `Chip`, `Card`, `ScreenHeader`, `StaggeredList`), two existing shared components restyled in place (`difficulty-badge.tsx`, `profile/fields.tsx`), then every screen restyled to consume the kit. `react-native-reanimated` is added for press-scale and list-entrance motion.

**Tech Stack:** Expo SDK ~57.0.7, React Native 0.86.0, `react-native-reanimated`, `@testing-library/react-native` + `jest-expo` (unit), Playwright (E2E, unchanged).

## Global Constraints

- Visual/UX only — no screen, route, prop, or data-flow behavior changes. Every placeholder, button text, and accessible name below must keep resolving exactly as-is in the existing 17 unit test files and 9 E2E spec files:
  - Placeholders: `Search tutorials`, `Age`, `Forearm length`, `Palm width`, `Wrist circumference`, `Describe the other challenge`
  - Text: `Preview Tutorial`, `Open in Browser`, `Sign Out`, `Welcome Back`, `Create an account`, `Ability Profile`, `Customization Metrics`, `Everyday Needs`, `Estimate`, `Not sure of the clinical terms?`, difficulty labels (`Easy`/`EASY`/`Medium`/etc.)
  - Roles: `getByRole('button', { name })` for every ability-screen selector, `getByRole('switch')`
- `Button` and `Chip` must render as real `<Pressable accessibilityRole="button">` (via `AnimatedPressable`, which forwards `accessibilityRole`/`accessibilityLabel` through to `Pressable`) so `getByRole('button', { name })` queries keep resolving.
- Colors and fonts in `theme.ts` do not change — only additive `radii`/`shadow`/`motion` tokens are added.
- No new tests beyond `AnimatedPressable.test.tsx` (Task 1) — every UI kit primitive is otherwise exercised transitively through the existing screen unit tests and E2E specs that already cover the screens consuming them. Per screen task, the gate is: that screen's existing unit test file(s) and E2E spec(s) still pass.
- `packages/mobile/AGENTS.md` requires reading versioned Expo v57.0.0 docs before Expo/RN code changes. For the one open question this plan has — which babel plugin `react-native-reanimated` needs — Task 1 resolves it from the actually-installed `babel-preset-expo@57.0.3` source (`node_modules/.pnpm/babel-preset-expo@57.0.3.../build/configs/expo.js:109-119`), which auto-detects and injects `react-native-worklets/plugin` (Reanimated 4.x) or `react-native-reanimated/plugin` (Reanimated 3.x) whenever the package is resolvable — no manual `babel.config.js` edit is required. `pnpm-lock.yaml` already resolves `react-native-reanimated@4.5.2` paired with `react-native-worklets@0.11.1` as an optional peer of an existing devDependency, confirming which pairing this repo's dependency graph will select.
- Local Supabase must be running (`npx supabase start` from the repo root) before running any `test:e2e` command; run `npx supabase db reset` first for a clean seed baseline if it isn't already running from a prior task in this plan.
- Every screen task's file already imports `theme` from `../../lib/theme` (or `../lib/theme`) — keep that import path unchanged.
- `coming-soon.tsx` needs no code change: it already uses only `theme.colors`/`theme.spacing`/`theme.fonts` and has no hardcoded radius or shadow to migrate onto the new tokens. Not a task in this plan.

---

### Task 1: `react-native-reanimated` dependency spike + `AnimatedPressable`

**Files:**
- Modify: `packages/mobile/package.json`
- Create: `packages/mobile/components/ui/AnimatedPressable.tsx`
- Create: `packages/mobile/tests/unit/components/ui/AnimatedPressable.test.tsx`

**Interfaces:**
- Produces: `AnimatedPressable(props: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> })` — a drop-in `Pressable` replacement that scales to `theme.motion.pressScale` on press-in and back to `1` on press-out, animated over `theme.motion.duration` ms. Consumed by `Button` (Task 4) and `Chip` (Task 5).

- [ ] **Step 1: Write the failing test**

```typescript
// packages/mobile/tests/unit/components/ui/AnimatedPressable.test.tsx
import { Text } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { AnimatedPressable } from '../../../../components/ui/AnimatedPressable'

describe('AnimatedPressable', () => {
  it('renders its children and fires onPress', () => {
    const onPress = jest.fn()
    render(
      <AnimatedPressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Tap me">
        <Text>Tap me</Text>
      </AnimatedPressable>
    )
    fireEvent.press(screen.getByText('Tap me'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run from `packages/mobile`: `pnpm exec jest tests/unit/components/ui/AnimatedPressable.test.tsx`
Expected: FAIL — `Cannot find module '../../../../components/ui/AnimatedPressable'`.

- [ ] **Step 3: Install the dependency**

Run from `packages/mobile`: `npx expo install react-native-reanimated`
Expected: `package.json` gains a `react-native-reanimated` entry under `dependencies` (Expo SDK 57–compatible version, expected `~4.x` per the lockfile evidence in Global Constraints); `node_modules/react-native-reanimated` exists afterward.

- [ ] **Step 4: Whitelist the package for Jest's transform**

Edit `packages/mobile/package.json` — add `react-native-reanimated` and `react-native-worklets` to the existing `transformIgnorePatterns` regex (every other native RN dependency in this project is already whitelisted the same way):

```json
    "transformIgnorePatterns": [
      "node_modules/(?!(\\.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|expo-router|expo-linking|expo-constants|expo-status-bar|expo-secure-store|expo-font|react-native-webview|react-native-url-polyfill|react-native-css-interop|react-native-reanimated|react-native-worklets|@testing-library/react-native))"
    ]
```

- [ ] **Step 5: Write `AnimatedPressable.tsx`**

```typescript
// packages/mobile/components/ui/AnimatedPressable.tsx
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { theme } from '../../lib/theme'

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable)

type AnimatedPressableProps = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }

export function AnimatedPressable({ style, onPressIn, onPressOut, children, ...rest }: AnimatedPressableProps) {
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <ReanimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withTiming(theme.motion.pressScale, { duration: theme.motion.duration })
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: theme.motion.duration })
        onPressOut?.(e)
      }}
      style={[animatedStyle, style]}
    >
      {children}
    </ReanimatedPressable>
  )
}
```

Note: this references `theme.motion`, added in Task 2. Do Task 2 first if working outside dependency order, or add the `motion` token to `theme.ts` now — either order is safe since Task 2 is purely additive.

- [ ] **Step 6: Run the test to verify it passes**

Run from `packages/mobile`: `pnpm exec jest tests/unit/components/ui/AnimatedPressable.test.tsx`
Expected: PASS. If it instead fails citing a missing native/worklet runtime in the Jest environment, add `"setupFiles": ["react-native-reanimated/jestSetup.js"]` to the `jest` block in `package.json` (this file ships inside the installed package — confirm with `ls node_modules/react-native-reanimated/jestSetup.js` — this is Reanimated's own documented Jest setup, not a guess) and rerun.

- [ ] **Step 7: Verify the web export gate**

Run from `packages/mobile`: `npx expo export -p web`
Expected: exits `0` with no babel/bundling error. This is the same build the `mobile-e2e` CI job and local Playwright `webServer` depend on, so this confirms `babel-preset-expo`'s auto-detected reanimated/worklets plugin (see Global Constraints) works end-to-end before any screen starts consuming `AnimatedPressable`.

- [ ] **Step 8: Commit**

```bash
git add packages/mobile/package.json packages/mobile/components/ui/AnimatedPressable.tsx packages/mobile/tests/unit/components/ui/AnimatedPressable.test.tsx
git commit -m "feat(mobile): add react-native-reanimated and AnimatedPressable"
```

---

### Task 2: Extend `theme.ts` with `radii`, `shadow`, `motion`

**Files:**
- Modify: `packages/mobile/lib/theme.ts`

**Interfaces:**
- Produces: `theme.radii.{sm,md,lg,pill}` (`8`, `12`, `16`, `999`), `theme.shadow` (`{shadowColor, shadowOpacity, shadowRadius, shadowOffset}`), `theme.motion.{pressScale,duration}` (`0.96`, `180`). Consumed by every task below.

- [ ] **Step 1: Add the tokens**

```typescript
// packages/mobile/lib/theme.ts
export const theme = {
  colors: {
    primary: '#1998d5',
    primaryDark: '#0f6f9c',
    text: '#1c242b',
    background: '#ffffff',
    accentLight: '#eaf6fb',
    accentLighter: '#f5fbfd',
    border: '#d9e8ee',
    muted: '#6b7a82',
    difficulty: {
      easy: { bg: '#dcfce7', text: '#166534' },
      medium: { bg: '#fef9c3', text: '#854d0e' },
      hard: { bg: '#fee2e2', text: '#991b1b' },
    },
  },
  fonts: {
    regular: 'Nunito_400Regular',
    semiBold: 'Nunito_600SemiBold',
    bold: 'Nunito_700Bold',
  },
  spacing: (n: number) => n * 4,
  radii: { sm: 8, md: 12, lg: 16, pill: 999 },
  shadow: { shadowColor: '#1c242b', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
  motion: { pressScale: 0.96, duration: 180 },
} as const
```

- [ ] **Step 2: Typecheck and run the full unit suite**

Run from `packages/mobile`: `pnpm typecheck && pnpm test:unit`
Expected: both succeed unchanged — this is a purely additive export, nothing consumes it yet.

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/lib/theme.ts
git commit -m "feat(mobile): add radii, shadow, and motion tokens to theme"
```

---

### Task 3: `StaggeredList.tsx`

**Files:**
- Create: `packages/mobile/components/ui/StaggeredList.tsx`

**Interfaces:**
- Consumes: `theme.motion.duration` (Task 2).
- Produces: `StaggeredList<T>(props: FlatListProps<T>)` — identical props to `FlatList`; wraps each rendered item in an index-delayed fade/translate-in. Consumed by `library-screen.tsx` (Task 9).

- [ ] **Step 1: Write `StaggeredList.tsx`**

```typescript
// packages/mobile/components/ui/StaggeredList.tsx
import { useEffect } from 'react'
import { FlatList, type FlatListProps } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { theme } from '../../lib/theme'

function StaggeredItem({ index, children }: { index: number; children: React.ReactNode }) {
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.value = withDelay(index * 40, withTiming(1, { duration: theme.motion.duration }))
  }, [index, progress])
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
  }))
  return <Animated.View style={style}>{children}</Animated.View>
}

export function StaggeredList<T>({ renderItem, ...rest }: FlatListProps<T>) {
  return (
    <FlatList
      {...rest}
      renderItem={(info) => (renderItem ? <StaggeredItem index={info.index}>{renderItem(info)}</StaggeredItem> : null)}
    />
  )
}
```

- [ ] **Step 2: Typecheck**

Run from `packages/mobile`: `pnpm typecheck`
Expected: succeeds. No dedicated test — `StaggeredList` is exercised through `library-screen.test.tsx` once Task 9 wires it in.

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/components/ui/StaggeredList.tsx
git commit -m "feat(mobile): add StaggeredList UI primitive"
```

---

### Task 4: `Button.tsx`

**Files:**
- Create: `packages/mobile/components/ui/Button.tsx`

**Interfaces:**
- Consumes: `AnimatedPressable` (Task 1), `theme.radii.pill`/`theme.spacing`/`theme.fonts`/`theme.colors` (Task 2).
- Produces: `Button(props: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost'; style?: StyleProp<ViewStyle> })`. Renders `<Pressable accessibilityRole="button" accessibilityLabel={label}>` wrapping a `<Text>{label}</Text>`. Consumed by `detail-screen.tsx`, `preview-screen.tsx`, `profile-screen.tsx`, `ability-screen.tsx` (Tasks 10–13).

- [ ] **Step 1: Write `Button.tsx`**

```typescript
// packages/mobile/components/ui/Button.tsx
import { Text, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native'
import { theme } from '../../lib/theme'
import { AnimatedPressable } from './AnimatedPressable'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const VARIANTS: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  primary: { container: { backgroundColor: theme.colors.primary }, text: { color: '#ffffff' } },
  secondary: { container: { backgroundColor: theme.colors.accentLight }, text: { color: theme.colors.primaryDark } },
  ghost: { container: { backgroundColor: 'transparent' }, text: { color: theme.colors.primary } },
}

export function Button({ label, onPress, variant = 'primary', style }: {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  style?: StyleProp<ViewStyle>
}) {
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.base, VARIANTS[variant].container, style]}
    >
      <Text style={[styles.text, VARIANTS[variant].text]}>{label}</Text>
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radii.pill,
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontFamily: theme.fonts.semiBold, fontSize: 16 },
})
```

- [ ] **Step 2: Typecheck**

Run from `packages/mobile`: `pnpm typecheck`
Expected: succeeds. No dedicated test — exercised through the screen tests in Tasks 10–13.

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/components/ui/Button.tsx
git commit -m "feat(mobile): add Button UI primitive"
```

---

### Task 5: `Chip.tsx`

**Files:**
- Create: `packages/mobile/components/ui/Chip.tsx`

**Interfaces:**
- Consumes: `AnimatedPressable` (Task 1), theme tokens (Task 2).
- Produces: `Chip(props: { label: string; active: boolean; onPress: () => void })`. Same accessible-button semantics as `AnimatedPressable`/`fields.tsx`'s existing pill pattern (`accessibilityRole="button"`, `accessibilityLabel`, `aria-selected`). Consumed by `library-screen.tsx` (Task 9) and `ability-screen.tsx` (Task 13).

- [ ] **Step 1: Write `Chip.tsx`**

```typescript
// packages/mobile/components/ui/Chip.tsx
import { Text, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'
import { AnimatedPressable } from './AnimatedPressable'

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-selected={active}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: theme.radii.pill,
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
    backgroundColor: theme.colors.accentLight,
  },
  chipActive: { backgroundColor: theme.colors.primary },
  text: { fontFamily: theme.fonts.semiBold, color: theme.colors.text },
  textActive: { color: '#ffffff' },
})
```

- [ ] **Step 2: Typecheck**

Run from `packages/mobile`: `pnpm typecheck`
Expected: succeeds. No dedicated test — exercised through `library-screen.test.tsx` and `ability-screen.test.tsx` in Tasks 9 and 13.

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/components/ui/Chip.tsx
git commit -m "feat(mobile): add Chip UI primitive"
```

---

### Task 6: `Card.tsx`

**Files:**
- Create: `packages/mobile/components/ui/Card.tsx`

**Interfaces:**
- Consumes: `theme.radii.md`/`theme.shadow`/`theme.spacing`/`theme.colors.accentLighter` (Task 2).
- Produces: `Card(props: ViewProps)` — a `View` with the rounded/shadowed container style; accepts `style` and `children` like any `View`. Consumed by `library-screen.tsx`, `detail-screen.tsx`, `child-profile-home.tsx` (Tasks 9, 10, 16).

- [ ] **Step 1: Write `Card.tsx`**

```typescript
// packages/mobile/components/ui/Card.tsx
import { View, StyleSheet, type ViewProps } from 'react-native'
import { theme } from '../../lib/theme'

export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.accentLighter,
    borderRadius: theme.radii.md,
    padding: theme.spacing(3),
    ...theme.shadow,
  },
})
```

- [ ] **Step 2: Typecheck**

Run from `packages/mobile`: `pnpm typecheck`
Expected: succeeds. No dedicated test — exercised through the screen tests in Tasks 9, 10, 16.

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/components/ui/Card.tsx
git commit -m "feat(mobile): add Card UI primitive"
```

---

### Task 7: Logo asset + `ScreenHeader.tsx`

**Files:**
- Create: `packages/mobile/assets/splat-logo.png` (copied from `SPLAT_mobile_claude_design/splat-logo.png`)
- Create: `packages/mobile/components/ui/ScreenHeader.tsx`

**Interfaces:**
- Consumes: theme tokens (Task 2), `assets/splat-logo.png`.
- Produces: `ScreenHeader(props: { title: string; showLogo?: boolean })`. Consumed by `library-screen.tsx` and `profile-screen.tsx` (Tasks 9, 12) — the two root tab screens, per spec.

- [ ] **Step 1: Copy the logo asset**

Run from the repo root: `cp SPLAT_mobile_claude_design/splat-logo.png packages/mobile/assets/splat-logo.png`
Expected: `packages/mobile/assets/splat-logo.png` exists.

- [ ] **Step 2: Write `ScreenHeader.tsx`**

```typescript
// packages/mobile/components/ui/ScreenHeader.tsx
import { View, Text, Image, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'

export function ScreenHeader({ title, showLogo }: { title: string; showLogo?: boolean }) {
  return (
    <View style={styles.row}>
      {showLogo ? (
        <Image source={require('../../assets/splat-logo.png')} style={styles.logo} resizeMode="contain" />
      ) : null}
      <Text style={styles.title}>{title}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), marginBottom: theme.spacing(4) },
  logo: { width: 28, height: 28 },
  title: { fontFamily: theme.fonts.bold, fontSize: 22, color: theme.colors.text },
})
```

- [ ] **Step 3: Typecheck**

Run from `packages/mobile`: `pnpm typecheck`
Expected: succeeds. No dedicated test — exercised through `library-screen.test.tsx` and `profile-screen.test.tsx` in Tasks 9 and 12.

- [ ] **Step 4: Commit**

```bash
git add packages/mobile/assets/splat-logo.png packages/mobile/components/ui/ScreenHeader.tsx
git commit -m "feat(mobile): add splat logo asset and ScreenHeader UI primitive"
```

---

### Task 8: Restyle `fields.tsx` and `difficulty-badge.tsx` in place

**Files:**
- Modify: `packages/mobile/components/profile/fields.tsx`
- Modify: `packages/mobile/components/difficulty-badge.tsx`

**Interfaces:**
- No signature changes — `Dropdown`, `ChipGroup`, `NumberField`, `DifficultyBadge` keep their existing props and accessible-button structure. Styles only pull from `theme.radii` instead of hardcoded numbers.

- [ ] **Step 1: Update `fields.tsx` styles**

Only the `styles` block changes (pill `borderRadius: 16` → `theme.radii.pill`, input `borderRadius: 8` → `theme.radii.sm`); all component logic above it is untouched:

```typescript
// packages/mobile/components/profile/fields.tsx (styles block only — rest of file unchanged)
const styles = StyleSheet.create({
  field: { marginBottom: theme.spacing(4) },
  label: { fontFamily: theme.fonts.semiBold, color: theme.colors.text, marginBottom: theme.spacing(2) },
  guidance: { fontFamily: theme.fonts.regular, color: theme.colors.muted, fontSize: 13, marginBottom: theme.spacing(2) },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  pill: {
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.accentLight,
  },
  pillActive: { backgroundColor: theme.colors.primary },
  pillText: { color: theme.colors.text, fontFamily: theme.fonts.semiBold },
  pillTextActive: { color: '#ffffff' },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    padding: theme.spacing(3),
    fontFamily: theme.fonts.regular,
  },
})
```

- [ ] **Step 2: Update `difficulty-badge.tsx`**

```typescript
// packages/mobile/components/difficulty-badge.tsx
import { View, Text, StyleSheet } from 'react-native'
import type { Difficulty } from '@splat-connect/types'
import { theme } from '../lib/theme'

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const colors = theme.colors.difficulty[difficulty]
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{difficulty.toUpperCase()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: theme.radii.sm },
  text: { fontSize: 11, fontFamily: theme.fonts.bold },
})
```

- [ ] **Step 3: Run both components' unit tests**

Run from `packages/mobile`:
```bash
pnpm exec jest tests/unit/components/profile/fields.test.tsx tests/unit/components/difficulty-badge.test.tsx
```
Expected: all tests PASS unchanged (they assert on text/role, not on radius values).

- [ ] **Step 4: Commit**

```bash
git add packages/mobile/components/profile/fields.tsx packages/mobile/components/difficulty-badge.tsx
git commit -m "style(mobile): pull fields.tsx and difficulty-badge.tsx radii from theme tokens"
```

---

### Task 9: Restyle `library-screen.tsx`

**Files:**
- Modify: `packages/mobile/components/home/library-screen.tsx`

**Interfaces:**
- Consumes: `ScreenHeader` (Task 7), `Chip` (Task 5), `Card` (Task 6), `StaggeredList` (Task 3).

- [ ] **Step 1: Rewrite the screen**

```typescript
// packages/mobile/components/home/library-screen.tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import type { Tutorial, Difficulty } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { DifficultyBadge } from '../difficulty-badge'
import { ScreenHeader } from '../ui/ScreenHeader'
import { Chip } from '../ui/Chip'
import { Card } from '../ui/Card'
import { StaggeredList } from '../ui/StaggeredList'

const FILTERS: { label: string; value: Difficulty | null }[] = [
  { label: 'All', value: null },
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
]

export function LibraryScreen() {
  const router = useRouter()
  const [tutorials, setTutorials] = useState<Tutorial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    const path = difficulty ? `/api/public/tutorials?difficulty=${difficulty}` : '/api/public/tutorials'
    apiClient
      .get<Tutorial[]>(path)
      .then((data) => {
        if (!ignore) setTutorials(data)
      })
      .catch(() => {
        if (!ignore) setError("Couldn't load tutorials. Pull to retry.")
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [difficulty])

  const visible = tutorials.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <View style={styles.container}>
      <ScreenHeader title="Tutorial Library" showLogo />
      <TextInput
        style={styles.search}
        placeholder="Search tutorials"
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip key={f.label} label={f.label} active={difficulty === f.value} onPress={() => setDifficulty(f.value)} />
        ))}
      </View>
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <StaggeredList
          data={visible}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: '/home/[id]', params: { id: item.id } })}>
              <Card style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <DifficultyBadge difficulty={item.difficulty} />
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4) },
  search: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    fontFamily: theme.fonts.regular,
  },
  filterRow: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(3) },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  cardTitle: { fontFamily: theme.fonts.bold, color: theme.colors.text, fontSize: 16 },
  error: { color: theme.colors.text, padding: theme.spacing(4) },
})
```

- [ ] **Step 2: Run the unit test**

Run from `packages/mobile`: `pnpm exec jest tests/unit/components/home/library-screen.test.tsx`
Expected: PASS.

- [ ] **Step 3: Run the E2E spec**

Ensure local Supabase is running (`npx supabase db reset` from the repo root if not already seeded this session). Run from `packages/mobile`: `pnpm exec playwright test home-library.spec.ts`
Expected: `3 passed`.

- [ ] **Step 4: Commit**

```bash
git add packages/mobile/components/home/library-screen.tsx
git commit -m "style(mobile): restyle library-screen with ScreenHeader, Chip, Card, StaggeredList"
```

---

### Task 10: Restyle `detail-screen.tsx`

**Files:**
- Modify: `packages/mobile/components/home/detail-screen.tsx`

**Interfaces:**
- Consumes: `Card` (Task 6), `Button` (Task 4).

- [ ] **Step 1: Rewrite the screen**

```typescript
// packages/mobile/components/home/detail-screen.tsx
import { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import type { Tutorial, Part, Tool, StlFile } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { DifficultyBadge } from '../difficulty-badge'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'

type TutorialDetail = Tutorial & { parts: Part[]; tools: Tool[]; stl_files: StlFile[] }

export function DetailScreen({ id }: { id: string }) {
  const router = useRouter()
  const [tutorial, setTutorial] = useState<TutorialDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    apiClient
      .get<TutorialDetail>(`/api/public/tutorials/${id}`)
      .then(setTutorial)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <ActivityIndicator color={theme.colors.primary} style={styles.loader} />
  if (error) return <Text style={styles.error}>Couldn't load tutorial. Please try again.</Text>
  if (!tutorial) return <Text style={styles.error}>Tutorial not found.</Text>

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{tutorial.title}</Text>
      <DifficultyBadge difficulty={tutorial.difficulty} />
      {tutorial.description ? <Text style={styles.description}>{tutorial.description}</Text> : null}

      <Text style={styles.sectionHeading}>Parts</Text>
      <Card style={styles.section}>
        <FlatList
          data={tutorial.parts}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <Text style={styles.listItem}>
              {item.name} × {item.quantity}
              {item.is_optional ? ' (optional)' : ''}
            </Text>
          )}
          ListEmptyComponent={<Text style={styles.listItem}>No parts listed.</Text>}
        />
      </Card>

      <Text style={styles.sectionHeading}>Tools</Text>
      <Card style={styles.section}>
        <FlatList
          data={tutorial.tools}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <Text style={styles.listItem}>
              {item.name}
              {item.is_optional ? ' (optional)' : ''}
            </Text>
          )}
          ListEmptyComponent={<Text style={styles.listItem}>No tools listed.</Text>}
        />
      </Card>

      <Button
        label="Preview Tutorial"
        onPress={() =>
          router.push({
            pathname: '/home/[id]/preview',
            params: { id: tutorial.id, pdfUrl: tutorial.tutorial_pdf_url ?? '' },
          })
        }
        style={styles.previewButton}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4) },
  loader: { flex: 1, justifyContent: 'center' },
  error: { padding: theme.spacing(4), color: theme.colors.text },
  title: { fontFamily: theme.fonts.bold, fontSize: 22, color: theme.colors.text, marginBottom: theme.spacing(2) },
  description: { fontFamily: theme.fonts.regular, color: theme.colors.text, marginVertical: theme.spacing(2) },
  sectionHeading: { fontFamily: theme.fonts.semiBold, fontSize: 16, color: theme.colors.text, marginTop: theme.spacing(3) },
  section: { marginTop: theme.spacing(2) },
  listItem: { fontFamily: theme.fonts.regular, color: theme.colors.text, paddingVertical: theme.spacing(1) },
  previewButton: { marginTop: theme.spacing(4) },
})
```

- [ ] **Step 2: Run the unit test**

Run from `packages/mobile`: `pnpm exec jest tests/unit/components/home/detail-screen.test.tsx`
Expected: PASS.

- [ ] **Step 3: Run the E2E spec**

Run from `packages/mobile`: `pnpm exec playwright test home-detail.spec.ts`
Expected: `2 passed`.

- [ ] **Step 4: Commit**

```bash
git add packages/mobile/components/home/detail-screen.tsx
git commit -m "style(mobile): restyle detail-screen with Card and Button"
```

---

### Task 11: Restyle `preview-screen.tsx`

**Files:**
- Modify: `packages/mobile/components/home/preview-screen.tsx`

**Interfaces:**
- Consumes: `Button` (Task 4).

- [ ] **Step 1: Rewrite the screen**

```typescript
// packages/mobile/components/home/preview-screen.tsx
import { View, Text, StyleSheet, Linking } from 'react-native'
import { WebView } from 'react-native-webview'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'

export function PreviewScreen({ pdfUrl }: { pdfUrl: string | null }) {
  if (!pdfUrl) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>No PDF is available for this tutorial yet.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <WebView source={{ uri: pdfUrl }} style={styles.webview} />
      <Button label="Open in Browser" onPress={() => Linking.openURL(pdfUrl)} variant="secondary" style={styles.fallbackButton} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing(4) },
  message: { fontFamily: theme.fonts.regular, color: theme.colors.text, textAlign: 'center' },
  fallbackButton: { margin: theme.spacing(3) },
})
```

- [ ] **Step 2: Run the unit test**

Run from `packages/mobile`: `pnpm exec jest tests/unit/components/home/preview-screen.test.tsx`
Expected: PASS.

- [ ] **Step 3: Run the E2E coverage**

`preview-screen.tsx` is exercised by the second test in `home-detail.spec.ts` (navigates detail → preview → asserts `Open in Browser`), already run in Task 10 Step 3. No separate spec file exists for this screen — re-run to confirm: `pnpm exec playwright test home-detail.spec.ts`
Expected: `2 passed`.

- [ ] **Step 4: Commit**

```bash
git add packages/mobile/components/home/preview-screen.tsx
git commit -m "style(mobile): restyle preview-screen with Button"
```

---

### Task 12: Restyle `profile-screen.tsx`

**Files:**
- Modify: `packages/mobile/components/profile-screen.tsx`

**Interfaces:**
- Consumes: `ScreenHeader` (Task 7), `Button` (Task 4).

- [ ] **Step 1: Rewrite the screen**

```typescript
// packages/mobile/components/profile-screen.tsx
import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useAuth } from '../lib/auth-context'
import { theme } from '../lib/theme'
import { ScreenHeader } from './ui/ScreenHeader'
import { Button } from './ui/Button'

export function ProfileScreen() {
  const { session, signIn, signUp, signOut } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    const res = mode === 'signin' ? await signIn(email, password) : await signUp(email, password, name)
    if (res.error) setError(res.error)
  }

  if (session) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Profile" showLogo />
        <Text style={styles.signedInText}>Signed in as {session.user.email}</Text>
        <Button label="Sign Out" onPress={() => signOut()} variant="secondary" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Profile" showLogo />
      <Text style={styles.heading}>{mode === 'signin' ? 'Welcome Back' : 'Create Account'}</Text>
      {mode === 'signup' ? (
        <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
      ) : null}
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={mode === 'signin' ? 'Sign In' : 'Sign Up'} onPress={handleSubmit} />
      <Pressable onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}>
        <Text style={styles.link}>{mode === 'signin' ? 'Create an account' : 'Have an account? Sign in'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4), justifyContent: 'center' },
  heading: { fontFamily: theme.fonts.bold, fontSize: 22, color: theme.colors.text, marginBottom: theme.spacing(4) },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(2),
    fontFamily: theme.fonts.regular,
  },
  error: { color: '#991b1b', fontFamily: theme.fonts.regular, marginBottom: theme.spacing(2) },
  signedInText: { fontFamily: theme.fonts.semiBold, fontSize: 16, color: theme.colors.text, marginBottom: theme.spacing(3), textAlign: 'center' },
  link: { color: theme.colors.primary, fontFamily: theme.fonts.semiBold, textAlign: 'center', marginTop: theme.spacing(3) },
})
```

- [ ] **Step 2: Run the unit tests**

Run from `packages/mobile`:
```bash
pnpm exec jest tests/unit/components/profile-screen.test.tsx tests/unit/app/profile-index.test.tsx
```
Expected: all PASS.

- [ ] **Step 3: Run the E2E specs**

Run from `packages/mobile`: `pnpm exec playwright test auth.spec.ts parent-signup.spec.ts`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/mobile/components/profile-screen.tsx
git commit -m "style(mobile): restyle profile-screen with ScreenHeader and Button"
```

---

### Task 13: Restyle `ability-screen.tsx`

**Files:**
- Modify: `packages/mobile/components/profile/ability-screen.tsx`

**Interfaces:**
- Consumes: `Chip` (Task 5), `Button` (Task 4); `Dropdown` from `./fields` unchanged (restyled in place in Task 8, kept as-is here since it already has accessible-button semantics).

- [ ] **Step 1: Rewrite the screen**

The `Dropdown`-based selectors (diagnosis, MACS level, hand involvement, assisting hand, BFMF score) are untouched — they already render as accessible pills via `fields.tsx`. Only the local quiz-option `Pressable`s and the `Estimate` button move onto the new `Chip`/`Button` primitives:

```typescript
// packages/mobile/components/profile/ability-screen.tsx
import { useState } from 'react'
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import type { ChildProfile } from '@splat-connect/types'
import { useChildProfile } from '../../lib/use-child-profile'
import { estimateAbility, QUESTIONS } from '../../lib/estimate-ability'
import { theme } from '../../lib/theme'
import { Dropdown } from './fields'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'

const DIAGNOSES = ['Cerebral palsy', 'Limb difference', 'Brachial plexus injury', 'Other'].map((d) => ({ label: d, value: d }))
const MACS_LEVELS = ['I', 'II', 'III', 'IV', 'V'].map((l) => ({ label: l, value: l }))
const BFMF_SCORES = ['1', '2', '3', '4', '5'].map((s) => ({ label: s, value: s }))
const HAND_INVOLVEMENT = [
  { label: 'Bilateral', value: 'bilateral' },
  { label: 'Unilateral', value: 'unilateral' },
]
const ASSIST_HAND = [
  { label: 'Left', value: 'left' },
  { label: 'Right', value: 'right' },
]

export function AbilityScreen() {
  const { profile, save } = useChildProfile()
  const [showQuiz, setShowQuiz] = useState(false)
  const [answers, setAnswers] = useState<(number | null)[]>(() => QUESTIONS.map(() => null))

  const isUnilateral = profile?.hand_involvement === 'unilateral'

  function setAnswer(qi: number, oi: number) {
    setAnswers((prev) => {
      const next = [...prev]
      next[qi] = oi
      return next
    })
  }

  function runEstimate() {
    if (answers.some((a) => a == null)) return // require all questions answered
    const { macs, bfmf } = estimateAbility(answers as number[])
    save({ macs_level: macs, bfmf_score: bfmf, macs_source: 'estimated', bfmf_source: 'estimated' })
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Dropdown
        label="Primary diagnosis"
        value={profile?.primary_diagnosis ?? null}
        options={DIAGNOSES}
        onChange={(v) => save({ primary_diagnosis: v })}
      />
      <Dropdown
        label="MACS level"
        value={profile?.macs_level ?? null}
        options={MACS_LEVELS}
        onChange={(v) => save({ macs_level: v, macs_source: 'manual' })}
      />
      <Dropdown
        label="Hand involvement"
        value={profile?.hand_involvement ?? null}
        options={HAND_INVOLVEMENT}
        onChange={(v) => save({ hand_involvement: v as ChildProfile['hand_involvement'] })}
      />
      {isUnilateral ? (
        <Dropdown
          label="Assisting hand"
          value={profile?.assist_hand ?? null}
          options={ASSIST_HAND}
          onChange={(v) => save({ assist_hand: v as ChildProfile['assist_hand'] })}
        />
      ) : null}
      <Dropdown
        label="BFMF score"
        value={profile?.bfmf_score ?? null}
        options={BFMF_SCORES}
        onChange={(v) => save({ bfmf_score: v, bfmf_source: 'manual' })}
      />

      <Pressable onPress={() => setShowQuiz((s) => !s)} style={styles.quizToggle}>
        <Text style={styles.quizToggleText}>Not sure of the clinical terms?</Text>
      </Pressable>

      {showQuiz ? (
        <View>
          {QUESTIONS.map((q, qi) => (
            <View key={qi} style={styles.question}>
              <Text style={styles.prompt}>{q.prompt}</Text>
              <View style={styles.optionRow}>
                {q.options.map((opt, oi) => (
                  <Chip key={oi} label={opt} active={answers[qi] === oi} onPress={() => setAnswer(qi, oi)} />
                ))}
              </View>
            </View>
          ))}
          <Button label="Estimate" onPress={runEstimate} />
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(4) },
  quizToggle: {
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.radii.sm,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
  },
  quizToggleText: { fontFamily: theme.fonts.semiBold, color: theme.colors.primary },
  question: { marginBottom: theme.spacing(4) },
  prompt: { fontFamily: theme.fonts.semiBold, color: theme.colors.text, marginBottom: theme.spacing(2) },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
})
```

- [ ] **Step 2: Run the unit test**

Run from `packages/mobile`: `pnpm exec jest tests/unit/components/profile/ability-screen.test.tsx`
Expected: PASS. (The test queries the quiz options and `Estimate` by `getByText`, which still resolves — `Chip`/`Button` render their `label` inside a `Text` child.)

- [ ] **Step 3: Run the E2E spec**

Run from `packages/mobile`: `pnpm exec playwright test ability-profile.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/mobile/components/profile/ability-screen.tsx
git commit -m "style(mobile): restyle ability-screen quiz options and Estimate with Chip/Button"
```

---

### Task 14: Restyle `customization-screen.tsx`

**Files:**
- Modify: `packages/mobile/components/profile/customization-screen.tsx`

**Interfaces:**
- No new UI kit consumption — pulls `theme.radii.sm` for the existing `Switch`'s themed `trackColor`/`thumbColor`. `Dropdown`/`ChipGroup`/`NumberField` from `./fields` unchanged.

- [ ] **Step 1: Rewrite the screen**

```typescript
// packages/mobile/components/profile/customization-screen.tsx
import { ScrollView, View, Text, Switch, StyleSheet } from 'react-native'
import { useChildProfile } from '../../lib/use-child-profile'
import { theme } from '../../lib/theme'
import { ChipGroup, Dropdown, NumberField } from './fields'

const HAND_DOMINANCE = ['Left', 'Right', 'Ambidextrous', 'Not yet established'].map((d) => ({ label: d, value: d }))
const SENSORY = ['Soft', 'Firm', 'Smooth', 'Textured', 'Lightweight', 'No preference'].map((s) => ({ label: s, value: s }))

export function CustomizationScreen() {
  const { profile, save } = useChildProfile()

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <NumberField
        label="Palm width"
        unit="mm"
        guidance="Measure across the knuckles of the dominant hand."
        value={profile?.palm_width_mm ?? null}
        onChange={(v) => save({ palm_width_mm: v })}
      />
      <NumberField
        label="Wrist circumference"
        unit="mm"
        guidance="Wrap a tape around the wrist just below the hand."
        value={profile?.wrist_circ_mm ?? null}
        onChange={(v) => save({ wrist_circ_mm: v })}
      />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Needs arm attachment?</Text>
        <Switch
          testID="arm-attachment-switch"
          value={profile?.needs_arm_attachment ?? false}
          onValueChange={(b) => save({ needs_arm_attachment: b })}
          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          thumbColor="#ffffff"
        />
      </View>
      {profile?.needs_arm_attachment ? (
        <NumberField
          label="Forearm length"
          unit="mm"
          guidance="Measure from the elbow crease to the wrist."
          value={profile?.forearm_length_mm ?? null}
          onChange={(v) => save({ forearm_length_mm: v })}
        />
      ) : null}

      <Dropdown
        label="Hand dominance"
        value={profile?.hand_dominance ?? null}
        options={HAND_DOMINANCE}
        onChange={(v) => save({ hand_dominance: v })}
      />
      <ChipGroup
        label="Sensory preferences"
        values={profile?.sensory_preferences ?? []}
        options={SENSORY}
        onChange={(v) => save({ sensory_preferences: v })}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(4) },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(4),
  },
  toggleLabel: { fontFamily: theme.fonts.semiBold, color: theme.colors.text },
})
```

- [ ] **Step 2: Run the unit test**

Run from `packages/mobile`: `pnpm exec jest tests/unit/components/profile/customization-screen.test.tsx`
Expected: PASS. (`testID="arm-attachment-switch"` and `getByRole('switch')` queries are unaffected — only `trackColor`/`thumbColor` were added.)

- [ ] **Step 3: Run the E2E spec**

Run from `packages/mobile`: `pnpm exec playwright test customization.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/mobile/components/profile/customization-screen.tsx
git commit -m "style(mobile): retheme customization-screen switch colors"
```

---

### Task 15: Restyle `everyday-needs-screen.tsx`

**Files:**
- Modify: `packages/mobile/components/profile/everyday-needs-screen.tsx`

**Interfaces:**
- No new UI kit consumption — pulls `theme.radii.sm` for the "Other challenge" text input. `ChipGroup`/`Dropdown` from `./fields` unchanged.

- [ ] **Step 1: Rewrite the screen**

```typescript
// packages/mobile/components/profile/everyday-needs-screen.tsx
import { ScrollView, View, Text, TextInput, StyleSheet } from 'react-native'
import { useChildProfile } from '../../lib/use-child-profile'
import { theme } from '../../lib/theme'
import { ChipGroup, Dropdown } from './fields'

const CHALLENGES = ['Grasping', 'Holding', 'Fine motor', 'Strength', 'Coordination', 'Fatigue', 'Other'].map((c) => ({ label: c, value: c }))
const GRIP_TYPES = ['Palmar', 'Pincer', 'Cylindrical', 'Hook', 'Spherical'].map((g) => ({ label: g, value: g }))
const ENVIRONMENTS = ['Home', 'School', 'Therapy', 'Outdoors', 'Mixed'].map((e) => ({ label: e, value: e }))

export function EverydayNeedsScreen() {
  const { profile, save } = useChildProfile()
  const challenges = profile?.challenges ?? []

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ChipGroup
        label="Top challenges"
        values={challenges}
        options={CHALLENGES}
        max={3}
        onChange={(v) => save({ challenges: v })}
      />
      {challenges.includes('Other') ? (
        <View style={styles.field}>
          <Text style={styles.label}>Other challenge</Text>
          <TextInput
            style={styles.input}
            placeholder="Describe the other challenge"
            defaultValue={profile?.challenge_other ?? ''}
            onChangeText={(v) => save({ challenge_other: v })}
          />
        </View>
      ) : null}
      <Dropdown
        label="Grip type"
        value={profile?.grip_type ?? null}
        options={GRIP_TYPES}
        onChange={(v) => save({ grip_type: v })}
      />
      <Dropdown
        label="Usage environment"
        value={profile?.env_context ?? null}
        options={ENVIRONMENTS}
        onChange={(v) => save({ env_context: v })}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(4) },
  field: { marginBottom: theme.spacing(4) },
  label: { fontFamily: theme.fonts.semiBold, color: theme.colors.text, marginBottom: theme.spacing(2) },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    padding: theme.spacing(3),
    fontFamily: theme.fonts.regular,
  },
})
```

- [ ] **Step 2: Run the unit test**

Run from `packages/mobile`: `pnpm exec jest tests/unit/components/profile/everyday-needs-screen.test.tsx`
Expected: PASS.

- [ ] **Step 3: Run the E2E spec**

Run from `packages/mobile`: `pnpm exec playwright test everyday-needs.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/mobile/components/profile/everyday-needs-screen.tsx
git commit -m "style(mobile): pull everyday-needs-screen input radius from theme token"
```

---

### Task 16: Restyle `child-profile-home.tsx` + full regression pass

**Files:**
- Modify: `packages/mobile/components/profile/child-profile-home.tsx`

**Interfaces:**
- Consumes: `Card` (Task 6) for the three nav tiles.

- [ ] **Step 1: Rewrite the screen**

```typescript
// packages/mobile/components/profile/child-profile-home.tsx
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/auth-context'
import { useChildProfile } from '../../lib/use-child-profile'
import { theme } from '../../lib/theme'
import { Card } from '../ui/Card'

const SUB_SCREENS: { label: string; path: string }[] = [
  { label: 'Ability Profile', path: '/profile/ability' },
  { label: 'Everyday Needs', path: '/profile/everyday-needs' },
  { label: 'Customization Metrics', path: '/profile/customization' },
]

export function ChildProfileHome() {
  const router = useRouter()
  const { profile: account, signOut } = useAuth()
  const { profile, loading, save } = useChildProfile()

  function onChangeAge(v: string) {
    if (v.trim() !== '' && !Number.isNaN(Number(v))) save({ age: Number(v) })
  }

  return (
    <View style={styles.container}>
      <View style={styles.account}>
        <Text style={styles.name}>{account?.name}</Text>
        <Text style={styles.email}>{account?.email}</Text>
      </View>

      <Text style={styles.label}>Child's age</Text>
      <TextInput
        style={styles.input}
        placeholder="Age"
        keyboardType="numeric"
        defaultValue={profile?.age != null ? String(profile.age) : ''}
        onChangeText={onChangeAge}
      />

      {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}

      {SUB_SCREENS.map((s) => (
        <Pressable key={s.path} onPress={() => router.push(s.path)}>
          <Card style={styles.row}>
            <Text style={styles.rowLabel}>{s.label}</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
          </Card>
        </Pressable>
      ))}

      <Pressable style={styles.signOut} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4) },
  account: { marginBottom: theme.spacing(4) },
  name: { fontFamily: theme.fonts.bold, fontSize: 20, color: theme.colors.text },
  email: { fontFamily: theme.fonts.regular, color: theme.colors.muted, marginTop: theme.spacing(1) },
  label: { fontFamily: theme.fonts.semiBold, color: theme.colors.text, marginBottom: theme.spacing(1) },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(4),
    fontFamily: theme.fonts.regular,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  rowLabel: { fontFamily: theme.fonts.semiBold, color: theme.colors.text, fontSize: 16 },
  signOut: { marginTop: theme.spacing(4), padding: theme.spacing(3), alignItems: 'center' },
  signOutText: { color: theme.colors.primary, fontFamily: theme.fonts.semiBold },
})
```

- [ ] **Step 2: Run the unit test**

Run from `packages/mobile`: `pnpm exec jest tests/unit/components/profile/child-profile-home.test.tsx`
Expected: PASS.

- [ ] **Step 3: Run the E2E spec**

Run from `packages/mobile`: `pnpm exec playwright test child-profile-home.spec.ts`
Expected: PASS.

- [ ] **Step 4: Run the full unit and E2E suites as a final regression gate**

Run from `packages/mobile`:
```bash
pnpm typecheck
pnpm test:unit
pnpm test:e2e
```
Expected: all pass — every screen restyled across Tasks 8–16 plus every untouched screen (`app/(tabs)/print.tsx`, `scanner.tsx`, `toy-library.tsx`, which only render `ComingSoon` and needed no change) still behaves identically.

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/components/profile/child-profile-home.tsx
git commit -m "style(mobile): restyle child-profile-home nav tiles with Card"
```
