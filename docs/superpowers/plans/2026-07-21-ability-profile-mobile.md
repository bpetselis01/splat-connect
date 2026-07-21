# Ability Profile — Mobile UI (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the parent-facing mobile child-profile experience — signup, a role-branched Profile tab, and the three data-capture sub-screens (Ability Profile, Everyday Needs, Customization Metrics) — on top of the merged Expo scaffold, wired to the `child-profile` API.

**Architecture:** Extends the existing scaffold rather than replacing it. The auth context gains `signUp` and a role-carrying `profile`; the Profile tab becomes a nested Expo Router `<Stack>` that branches on role (parent → child-profile home; admin/contributor → the current signed-in view). The three sub-screens compose a small set of shared form primitives and autosave through one `useChildProfile` hook that calls `PUT /api/child-profile`. A naive `estimateAbility()` backs the optional MACS/BFMF questionnaire.

**Tech Stack:** Expo ~57 (Expo Router, expo-router file routing), React Native 0.86, React 19, `@supabase/supabase-js`, jest-expo + `@testing-library/react-native`, `@splat-connect/types`.

## Dependency & base

This branch (`ability-profile-mobile`) is cut from `development`, which already contains the mobile scaffold. It does **not** yet contain the Phase 1 backend (parent role, `child_profiles` migration, `/api/child-profile` route) — that lives on `ability-profile-backend`. **Before implementing any task that calls `/api/child-profile` or relies on the `parent` role (Tasks 4–8), rebase this branch onto a `development` that has `ability-profile-backend` merged.** Tasks 1–3 have no backend dependency and can proceed immediately. The Phase 1 migration `003_ability_profile.sql` must also be applied in Supabase (per that plan) for the endpoints to work against real data.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-21-ability-profile-design.md` — all decisions there apply. This plan resolves the three open scaffold-integration points below.
- **Expo v57:** `packages/mobile/AGENTS.md` requires reading the versioned docs at `https://docs.expo.dev/versions/v57.0.0/` before writing mobile code. Do not assume APIs from other Expo versions.
- **File layout convention (established by the scaffold):** route files under `app/` are thin (delegate to a component); real UI lives in `components/`; shared logic in `lib/`. Follow it.
- **Styling:** use `theme` tokens from `lib/theme.ts` (`theme.colors.*`, `theme.fonts.*`, `theme.spacing(n)`) — no hardcoded colors/spacing except the few literal hexes the scaffold itself uses (e.g. `#ffffff`, error `#991b1b`).
- **Tests:** jest-expo, run via `pnpm --filter @splat-connect/mobile test:unit`. Component tests mock `lib/auth-context`; `lib` tests mock `lib/supabase` and/or `globalThis.fetch`, mirroring the existing `tests/unit/` files exactly.
- **Update verb decision:** the mobile client gains a `put` method (Task 1) and the child-profile update uses **`PUT /api/child-profile`** (create-or-replace upsert semantics for the single row). Rationale: the Phase 1 backend is already built, tested, and reviewed as `PUT`; adding `put` to the client is one line, versus reworking a merged route and its tests. (Alternative considered: switch the backend to `PATCH` to match the `contributors` update convention — not chosen.)
- **Role source:** the Supabase session carries no role. Read it from `GET /api/contributors/me` (returns the caller's `Profile` incl. `role`), exposed via the auth context (Task 2). This route is not parent-gated and works for any authenticated user.
- **Parent signup:** `supabase.auth.signUp({ email, password, options: { data: { name, role: 'parent' } } })`. The Phase 1 trigger whitelists `role: 'parent'` from that metadata.

---

### Task 1: `apiClient.put`

**Files:**
- Modify: `packages/mobile/lib/api-client.ts:53-59` (add `put` to the exported object)
- Test: `packages/mobile/tests/unit/lib/api-client.test.ts` (add one case)

**Interfaces:**
- Produces: `apiClient.put<T>(path, body) => Promise<T>` — used by `useChildProfile` (Task 5) for `PUT /api/child-profile`.

- [ ] **Step 1: Write the failing test** — add to the `describe('apiClient', ...)` block in `tests/unit/lib/api-client.test.ts`:

```typescript
it('put — sends PUT method with JSON body', async () => {
  fetchMock.mockResolvedValue(okResponse({ id: 'cp-1' }))
  await apiClient.put('/api/child-profile', { age: 5 })
  const [url, opts] = fetchMock.mock.calls[0]
  expect(url).toBe('http://localhost:3101/api/child-profile')
  expect(opts.method).toBe('PUT')
  expect(opts.body).toBe(JSON.stringify({ age: 5 }))
  expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json')
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/lib/api-client.test.ts -t "put"`
Expected: FAIL — `apiClient.put is not a function`.

- [ ] **Step 3: Add `put` to the client** — in `lib/api-client.ts`, add one line to the exported object (it reuses the existing generic `request` helper, exactly like `post`/`patch`):

```typescript
export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  postFormData: <T>(path: string, formData: FormData) => requestFormData<T>('POST', path, formData),
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/lib/api-client.test.ts`
Expected: PASS (all api-client tests).

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/lib/api-client.ts packages/mobile/tests/unit/lib/api-client.test.ts
git commit -m "feat(mobile): add put method to api-client

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Auth context — `signUp` + role-carrying `profile`

**Files:**
- Modify: `packages/mobile/lib/auth-context.tsx` (extend `AuthContextValue`, add `signUp`, fetch/expose `profile`)
- Test: `packages/mobile/tests/unit/lib/auth-context.test.tsx` (add cases; extend the supabase mock)

**Interfaces:**
- Consumes: `apiClient.get` (Task 1 module), `Profile` from `@splat-connect/types`.
- Produces: `useAuth()` now returns `{ session, profile, loading, signIn, signUp, signOut }` where `profile: Profile | null` carries `role`. Consumed by the signup UI (Task 4) and the role branch (Task 5).

- [ ] **Step 1: Write the failing tests** — add to `tests/unit/lib/auth-context.test.tsx`. First extend the supabase mock (add `signUp`) and mock `api-client`:

```typescript
const mockSignUp = jest.fn()
// add to the jest.mock('../../../lib/supabase', ...) auth object:
//   signUp: (...args: unknown[]) => mockSignUp(...args),
jest.mock('../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockApiGet(...a) } }))
const mockApiGet = jest.fn()
```

Then the new cases:

```typescript
it('signUp passes name and parent role in metadata', async () => {
  mockSignUp.mockResolvedValue({ error: null })
  const { result } = renderHook(() => useAuth(), { wrapper })
  await waitFor(() => expect(result.current.loading).toBe(false))
  const { error } = await act(() => result.current.signUp('p@b.com', 'pw', 'Pat'))
  expect(error).toBeNull()
  expect(mockSignUp).toHaveBeenCalledWith({
    email: 'p@b.com',
    password: 'pw',
    options: { data: { name: 'Pat', role: 'parent' } },
  })
})

it('loads the profile (with role) when a session exists', async () => {
  mockGetSession.mockResolvedValue({ data: { session: { access_token: 't', user: { id: 'u1' } } } })
  mockApiGet.mockResolvedValue({ id: 'u1', name: 'Pat', email: 'p@b.com', role: 'parent', approved: false })
  const { result } = renderHook(() => useAuth(), { wrapper })
  await waitFor(() => expect(result.current.profile?.role).toBe('parent'))
})

it('clears the profile when there is no session', async () => {
  const { result } = renderHook(() => useAuth(), { wrapper })
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.profile).toBeNull()
  expect(mockApiGet).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/lib/auth-context.test.tsx`
Expected: FAIL — `signUp`/`profile` undefined.

- [ ] **Step 3: Extend the auth context** — update `lib/auth-context.tsx`:

```typescript
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '@splat-connect/types'
import { supabase } from './supabase'
import { apiClient } from './api-client'

type AuthContextValue = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Session carries no role; the profile (with role) comes from the API. Refetch
  // whenever the session identity changes; clear it when signed out.
  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    let ignore = false
    apiClient
      .get<Profile>('/api/contributors/me')
      .then((p) => { if (!ignore) setProfile(p) })
      .catch(() => { if (!ignore) setProfile(null) })
    return () => { ignore = true }
  }, [session?.user?.id])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signUp(email: string, password: string, name: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role: 'parent' } },
    })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/lib/auth-context.test.tsx`
Expected: PASS (existing 4 + new 3).

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/lib/auth-context.tsx packages/mobile/tests/unit/lib/auth-context.test.tsx
git commit -m "feat(mobile): add signUp and role-carrying profile to auth context

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `estimateAbility()` — questionnaire estimator (known limitation)

**Files:**
- Create: `packages/mobile/lib/estimate-ability.ts`
- Test: `packages/mobile/tests/unit/lib/estimate-ability.test.ts`

**Interfaces:**
- Produces: `QUESTIONS: AbilityQuestion[]` (4 fixed questions, each 4 options) and `estimateAbility(answers: number[]) => { macs: MacsLevel; bfmf: BfmfLevel }`. Consumed by the Ability Profile sub-screen (Task 6).

**KNOWN LIMITATION — carry this comment verbatim at the top of the file:**
```
// ponytail: PLACEHOLDER clinical mapping, NOT a validated instrument. The
// question set and the answer→MACS/BFMF lookup are a naive linear bucketing
// stand-in and MUST be revised by someone with real MACS/BFMF domain
// expertise before this is trusted for assistive-device decisions.
```

- [ ] **Step 1: Write the failing test** — `tests/unit/lib/estimate-ability.test.ts`:

```typescript
import { estimateAbility, QUESTIONS } from '../../../lib/estimate-ability'

describe('estimateAbility (placeholder mapping)', () => {
  it('has exactly 4 questions, each with 4 options', () => {
    expect(QUESTIONS).toHaveLength(4)
    for (const q of QUESTIONS) expect(q.options).toHaveLength(4)
  })

  it.each([
    [[0, 0, 0, 0], 'I', '1'],
    [[1, 1, 1, 0], 'II', '2'],
    [[2, 2, 1, 1], 'III', '3'],
    [[3, 3, 2, 2], 'IV', '4'],
    [[3, 3, 3, 3], 'V', '5'],
  ])('answers %j -> MACS %s / BFMF %s', (answers, macs, bfmf) => {
    expect(estimateAbility(answers as number[])).toEqual({ macs, bfmf })
  })

  it('throws on the wrong number of answers', () => {
    expect(() => estimateAbility([0, 0, 0])).toThrow()
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/lib/estimate-ability.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `lib/estimate-ability.ts`:

```typescript
// ponytail: PLACEHOLDER clinical mapping, NOT a validated instrument. The
// question set and the answer→MACS/BFMF lookup are a naive linear bucketing
// stand-in and MUST be revised by someone with real MACS/BFMF domain
// expertise before this is trusted for assistive-device decisions.

export type MacsLevel = 'I' | 'II' | 'III' | 'IV' | 'V'
export type BfmfLevel = '1' | '2' | '3' | '4' | '5'

export type AbilityQuestion = { prompt: string; options: string[] }

// Each option index (0..3) contributes its own value to a 0..12 total.
export const QUESTIONS: AbilityQuestion[] = [
  {
    prompt: 'How does your child usually pick up small objects (a coin or bead)?',
    options: ['Easily, with either hand', 'With effort or only one hand', 'With difficulty, needs positioning help', 'Cannot pick up small objects'],
  },
  {
    prompt: 'How does your child handle larger objects (a cup or toy)?',
    options: ['Independently with both hands', 'Manages most, some are hard', 'Needs help with many objects', 'Needs help with most objects'],
  },
  {
    prompt: 'During two-handed play, how much does your child use their weaker hand?',
    options: ['Uses it well as a helper', 'Uses it a little to stabilise', 'Rarely uses it', 'Does not use it'],
  },
  {
    prompt: 'How much assistance does your child need for daily hand tasks (eating, dressing)?',
    options: ['None', 'A little', 'Moderate', 'A lot'],
  },
]

const MACS_BY_TOTAL: MacsLevel[] = ['I', 'I', 'II', 'II', 'II', 'III', 'III', 'III', 'IV', 'IV', 'IV', 'V', 'V']
const BFMF_BY_TOTAL: BfmfLevel[] = ['1', '1', '2', '2', '2', '3', '3', '3', '4', '4', '4', '5', '5']

export function estimateAbility(answers: number[]): { macs: MacsLevel; bfmf: BfmfLevel } {
  if (answers.length !== QUESTIONS.length) {
    throw new Error(`estimateAbility expects ${QUESTIONS.length} answers, got ${answers.length}`)
  }
  const total = answers.reduce((sum, a) => sum + a, 0) // 0..12
  return { macs: MACS_BY_TOTAL[total], bfmf: BFMF_BY_TOTAL[total] }
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/lib/estimate-ability.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/lib/estimate-ability.ts packages/mobile/tests/unit/lib/estimate-ability.test.ts
git commit -m "feat(mobile): add placeholder MACS/BFMF questionnaire estimator

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Parent signup UI

**Files:**
- Modify: `packages/mobile/components/profile-screen.tsx` (signed-out view: toggle between Sign In and Sign Up)
- Test: `packages/mobile/tests/unit/components/profile-screen.test.tsx` (add sign-up cases; existing cases must still pass)

**Interfaces:**
- Consumes: `useAuth().signUp` (Task 2).

- [ ] **Step 1: Write the failing tests** — add to `tests/unit/components/profile-screen.test.tsx` (the existing mock returns `signUp`-less objects; add `signUp: jest.fn()` to each `mockReturnValue` you touch, and add):

```typescript
it('switches to the sign-up form and submits name/email/password as a parent', async () => {
  const signUp = jest.fn().mockResolvedValue({ error: null })
  ;(useAuth as jest.Mock).mockReturnValue({ session: null, signIn: jest.fn(), signUp, signOut: jest.fn() })
  render(<ProfileScreen />)
  fireEvent.press(screen.getByText('Create an account'))
  fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Pat')
  fireEvent.changeText(screen.getByPlaceholderText('Email'), 'p@b.com')
  fireEvent.changeText(screen.getByPlaceholderText('Password'), 'pw123456')
  fireEvent.press(screen.getByText('Sign Up'))
  await waitFor(() => expect(signUp).toHaveBeenCalledWith('p@b.com', 'pw123456', 'Pat'))
})

it('shows a sign-up error message on failure', async () => {
  const signUp = jest.fn().mockResolvedValue({ error: 'Email already registered' })
  ;(useAuth as jest.Mock).mockReturnValue({ session: null, signIn: jest.fn(), signUp, signOut: jest.fn() })
  render(<ProfileScreen />)
  fireEvent.press(screen.getByText('Create an account'))
  fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Pat')
  fireEvent.changeText(screen.getByPlaceholderText('Email'), 'p@b.com')
  fireEvent.changeText(screen.getByPlaceholderText('Password'), 'pw123456')
  fireEvent.press(screen.getByText('Sign Up'))
  await waitFor(() => expect(screen.getByText('Email already registered')).toBeTruthy())
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/profile-screen.test.tsx`
Expected: FAIL — no "Create an account"/"Sign Up" affordance.

- [ ] **Step 3: Implement** — in `components/profile-screen.tsx`, keep the signed-in branch unchanged. Replace the signed-out `return` with a `mode` toggle (`'signin' | 'signup'`) that adds a Name field and a Sign Up button in signup mode, and a link to switch modes. Pull `signUp` from `useAuth()`. Reuse the existing `styles` (add a `link` style). Concretely:

```typescript
const { session, signIn, signUp, signOut } = useAuth()
const [mode, setMode] = useState<'signin' | 'signup'>('signin')
const [name, setName] = useState('')
// ... existing email/password/error state ...

async function handleSubmit() {
  setError(null)
  const res = mode === 'signin' ? await signIn(email, password) : await signUp(email, password, name)
  if (res.error) setError(res.error)
}
```

In the signed-out JSX: heading (`mode === 'signin' ? 'Welcome Back' : 'Create Account'`); when `mode === 'signup'` render a `Name` `TextInput` above Email; the primary button label + `onPress={handleSubmit}` is `mode === 'signin' ? 'Sign In' : 'Sign Up'`; below it a `Pressable` link toggling mode with text `mode === 'signin' ? 'Create an account' : 'Have an account? Sign in'`. Add `link: { color: theme.colors.primary, fontFamily: theme.fonts.semiBold, textAlign: 'center', marginTop: theme.spacing(3) }` to `styles`.

- [ ] **Step 4: Run tests to confirm pass**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/profile-screen.test.tsx`
Expected: PASS (existing 3 + new 2).

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/components/profile-screen.tsx packages/mobile/tests/unit/components/profile-screen.test.tsx
git commit -m "feat(mobile): add parent sign-up to the profile screen

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Profile tab → role-branched nested stack + `useChildProfile`

**Files:**
- Delete: `packages/mobile/app/(tabs)/profile.tsx`
- Create: `packages/mobile/app/(tabs)/profile/_layout.tsx`, `profile/index.tsx`, `profile/ability.tsx`, `profile/everyday-needs.tsx`, `profile/customization.tsx` (the last three are thin route files delegating to components created in Tasks 6–8; for this task stub them with a `Text` placeholder so routing compiles)
- Create: `packages/mobile/components/profile/child-profile-home.tsx`, `packages/mobile/lib/use-child-profile.ts`
- Test: `packages/mobile/tests/unit/lib/use-child-profile.test.tsx`, `packages/mobile/tests/unit/components/profile/child-profile-home.test.tsx`

**Interfaces:**
- Consumes: `useAuth().profile` (Task 2), `apiClient.get`/`put` (Task 1), `ChildProfile` from `@splat-connect/types`.
- Produces:
  - `useChildProfile()` → `{ profile: ChildProfile | null, loading: boolean, save: (patch: Partial<ChildProfile>) => void }`. `save` optimistically merges the patch into local state and debounces a `PUT /api/child-profile` (250ms). The upsert on the backend updates only the columns present in the patch, so partial patches are safe. Consumed by Tasks 6–8.
  - `ProfileScreen` (unchanged component) still handles signed-out; the nested `index.tsx` route decides parent vs non-parent.

- [ ] **Step 1: Convert the Profile route to a nested stack.** Delete `app/(tabs)/profile.tsx`. Create `app/(tabs)/profile/_layout.tsx` mirroring `home/_layout.tsx`:

```typescript
import { Stack } from 'expo-router'

export default function ProfileStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Profile' }} />
      <Stack.Screen name="ability" options={{ title: 'Ability Profile' }} />
      <Stack.Screen name="everyday-needs" options={{ title: 'Everyday Needs' }} />
      <Stack.Screen name="customization" options={{ title: 'Customization Metrics' }} />
    </Stack>
  )
}
```

`profile/index.tsx` branches on role — signed-out or admin/contributor keep the existing `ProfileScreen`; parents get the child-profile home:

```typescript
import { useAuth } from '../../../lib/auth-context'
import { ProfileScreen } from '../../../components/profile-screen'
import { ChildProfileHome } from '../../../components/profile/child-profile-home'

export default function ProfileIndex() {
  const { session, profile } = useAuth()
  if (session && profile?.role === 'parent') return <ChildProfileHome />
  return <ProfileScreen />
}
```

Stub `profile/ability.tsx`, `profile/everyday-needs.tsx`, `profile/customization.tsx` for now, e.g.:
```typescript
import { Text } from 'react-native'
export default function AbilityRoute() { return <Text>Ability Profile</Text> }
```
(Tasks 6–8 replace each stub body with the real component delegation.)

- [ ] **Step 2: Write failing tests for `useChildProfile`** — `tests/unit/lib/use-child-profile.test.tsx` (mock `api-client`; use fake timers for the debounce):

```typescript
import { renderHook, act, waitFor } from '@testing-library/react-native'
import { useChildProfile } from '../../../lib/use-child-profile'

const mockGet = jest.fn()
const mockPut = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), put: (...a: unknown[]) => mockPut(...a) } }))

describe('useChildProfile', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers() })
  afterEach(() => jest.useRealTimers())

  it('loads the child profile on mount', async () => {
    mockGet.mockResolvedValue({ id: 'cp1', age: 5 })
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.profile?.age).toBe(5))
    expect(mockGet).toHaveBeenCalledWith('/api/child-profile')
  })

  it('save merges optimistically and debounces one PUT', async () => {
    mockGet.mockResolvedValue(null)
    mockPut.mockResolvedValue({})
    const { result } = renderHook(() => useChildProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.save({ age: 7 }); result.current.save({ macs_level: 'II' }) })
    expect(result.current.profile).toMatchObject({ age: 7, macs_level: 'II' }) // optimistic
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(mockPut).toHaveBeenCalledTimes(1) // debounced
    expect(mockPut).toHaveBeenCalledWith('/api/child-profile', expect.objectContaining({ age: 7, macs_level: 'II' }))
  })
})
```

- [ ] **Step 3: Run and confirm failure**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/lib/use-child-profile.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `lib/use-child-profile.ts`:**

```typescript
import { useEffect, useRef, useState } from 'react'
import type { ChildProfile } from '@splat-connect/types'
import { apiClient } from './api-client'

export function useChildProfile() {
  const [profile, setProfile] = useState<ChildProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const pending = useRef<Partial<ChildProfile>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let ignore = false
    apiClient
      .get<ChildProfile | null>('/api/child-profile')
      .then((p) => { if (!ignore) setProfile(p) })
      .catch(() => { if (!ignore) setProfile(null) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [])

  function save(patch: Partial<ChildProfile>) {
    setProfile((prev) => ({ ...(prev ?? {}), ...patch } as ChildProfile)) // optimistic
    pending.current = { ...pending.current, ...patch }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const body = pending.current
      pending.current = {}
      apiClient.put<ChildProfile>('/api/child-profile', body).catch(() => {})
    }, 250)
  }

  return { profile, loading, save }
}
```

- [ ] **Step 5: Write failing test for `ChildProfileHome`** — `tests/unit/components/profile/child-profile-home.test.tsx` (mock `use-child-profile` and `expo-router`'s `useRouter`; assert it renders name/email from auth profile, the age field, and three navigation rows):

```typescript
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ChildProfileHome } from '../../../../components/profile/child-profile-home'

const push = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push }) }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ profile: { name: 'Pat', email: 'p@b.com', role: 'parent' } }) }))
const save = jest.fn()
jest.mock('../../../../lib/use-child-profile', () => ({ useChildProfile: () => ({ profile: { age: 6 }, loading: false, save }) }))

describe('ChildProfileHome', () => {
  beforeEach(() => jest.clearAllMocks())
  it('shows account info and links to the three sub-screens', () => {
    render(<ChildProfileHome />)
    expect(screen.getByText('Pat')).toBeTruthy()
    expect(screen.getByText('p@b.com')).toBeTruthy()
    expect(screen.getByText('Ability Profile')).toBeTruthy()
    expect(screen.getByText('Everyday Needs')).toBeTruthy()
    expect(screen.getByText('Customization Metrics')).toBeTruthy()
    fireEvent.press(screen.getByText('Ability Profile'))
    expect(push).toHaveBeenCalledWith('/profile/ability')
  })
  it('saves the age field on change', () => {
    render(<ChildProfileHome />)
    fireEvent.changeText(screen.getByPlaceholderText('Age'), '8')
    expect(save).toHaveBeenCalledWith({ age: 8 })
  })
})
```

- [ ] **Step 6: Implement `components/profile/child-profile-home.tsx`** — read `name`/`email` from `useAuth().profile`, `age` from `useChildProfile()`, render a numeric Age `TextInput` (calls `save({ age: Number(v) })`, guarding non-numeric → skip), and three `Pressable` rows that `router.push('/profile/ability' | '/profile/everyday-needs' | '/profile/customization')`. Also a Sign Out button (reuse `useAuth().signOut`). Style with `theme` tokens, matching the card/row look of `library-screen.tsx`.

- [ ] **Step 7: Run the whole mobile suite**

Run: `pnpm --filter @splat-connect/mobile test:unit && pnpm --filter @splat-connect/mobile typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/mobile/app packages/mobile/components/profile packages/mobile/lib/use-child-profile.ts packages/mobile/tests
git rm packages/mobile/app/(tabs)/profile.tsx 2>/dev/null || true
git commit -m "feat(mobile): role-branched profile stack and child-profile home

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Shared form primitives (used by Tasks 6–8)

To keep the three data screens DRY, Task 6 creates three tiny presentational components in `packages/mobile/components/profile/fields.tsx` (with a render test `tests/unit/components/profile/fields.test.tsx`), reused by Tasks 7–8:

- `Dropdown({ label, value, options, onChange })` — label + a row of selectable pills (single-select), `options: { label: string; value: string }[]`.
- `ChipGroup({ label, values, options, max?, onChange })` — multi-select chips; enforces `max` when set; `values: string[]`.
- `NumberField({ label, value, unit, guidance?, onChange })` — labelled numeric `TextInput` (keyboardType `numeric`), optional `unit` suffix and `guidance` helper text; calls `onChange(number | null)`.

Each screen binds these to `useChildProfile().save`. Every control's `value` reads from `useChildProfile().profile`, and its `onChange` calls `save({ <field>: <newValue> })`. The field→control mapping for each screen is the spec's mockup, enumerated below.

---

### Task 6: Ability Profile sub-screen (+ shared field primitives)

**Files:**
- Create: `packages/mobile/components/profile/fields.tsx` (the three primitives above), `packages/mobile/components/profile/ability-screen.tsx`
- Modify: `packages/mobile/app/(tabs)/profile/ability.tsx` (delegate to `<AbilityScreen />`)
- Test: `tests/unit/components/profile/fields.test.tsx`, `tests/unit/components/profile/ability-screen.test.tsx`

**Fields (bind each to `save({...})`):**

| Control | ChildProfile field | Options / notes |
|---|---|---|
| Dropdown "Primary diagnosis" | `primary_diagnosis` | e.g. `Cerebral palsy`, `Limb difference`, `Brachial plexus injury`, `Other` |
| Dropdown "MACS level" | `macs_level` (+ set `macs_source: 'manual'` on manual change) | `I`–`V` |
| Segmented "Hand involvement" | `hand_involvement` | `bilateral` \| `unilateral` |
| Segmented "Assisting hand" (only when `hand_involvement === 'unilateral'`) | `assist_hand` | `left` \| `right` |
| Dropdown "BFMF score" | `bfmf_score` (+ `bfmf_source: 'manual'`) | `1`–`5` |
| Collapsible "Not sure of the clinical terms?" | drives `macs_level`/`bfmf_score` | renders `QUESTIONS` (Task 3); on completion calls `save({ macs_level, bfmf_score, macs_source: 'estimated', bfmf_source: 'estimated' })` from `estimateAbility(answers)` |

**Test (`ability-screen.test.tsx`)** — mock `use-child-profile`; assert: (1) selecting a MACS pill calls `save({ macs_level: 'II', macs_source: 'manual' })`; (2) the assisting-hand control appears only after choosing `unilateral`; (3) completing the questionnaire (answer all 4, tap "Estimate") calls `save` with `macs_source: 'estimated'` and a MACS/BFMF from `estimateAbility`.

- [ ] Steps: write `fields.test.tsx` (render + interaction per primitive) → run/fail → implement `fields.tsx` → pass. Then write `ability-screen.test.tsx` → run/fail → implement `ability-screen.tsx` + wire `ability.tsx` route → pass → `typecheck` → commit (`feat(mobile): ability profile sub-screen`).

---

### Task 7: Everyday Needs sub-screen

**Files:** Create `components/profile/everyday-needs-screen.tsx`; Modify `app/(tabs)/profile/everyday-needs.tsx`; Test `tests/unit/components/profile/everyday-needs-screen.test.tsx`.

**Fields:**

| Control | ChildProfile field | Options / notes |
|---|---|---|
| ChipGroup "Top challenges" (max 3) | `challenges` | e.g. `Grasping`, `Holding`, `Fine motor`, `Strength`, `Coordination`, `Fatigue`, `Other` |
| NumberField/Text "Other challenge" (only when `challenges` includes `Other`) | `challenge_other` | free text |
| Dropdown "Grip type" | `grip_type` | e.g. `Palmar`, `Pincer`, `Cylindrical`, `Hook`, `Spherical` |
| Dropdown "Usage environment" | `env_context` | e.g. `Home`, `School`, `Therapy`, `Outdoors`, `Mixed` |

**Test:** selecting a 4th challenge chip is prevented (max 3); choosing `Other` reveals the free-text field; each change calls `save` with the right field.

- [ ] Steps: write test → run/fail → implement screen (composing `ChipGroup`/`Dropdown` from Task 6) + wire route → pass → typecheck → commit (`feat(mobile): everyday needs sub-screen`).

---

### Task 8: Customization Metrics sub-screen

**Files:** Create `components/profile/customization-screen.tsx`; Modify `app/(tabs)/profile/customization.tsx`; Test `tests/unit/components/profile/customization-screen.test.tsx`.

**Fields:**

| Control | ChildProfile field | Options / notes |
|---|---|---|
| NumberField "Palm width" (mm) | `palm_width_mm` | with measurement guidance text |
| NumberField "Wrist circumference" (mm) | `wrist_circ_mm` | with guidance |
| Toggle "Needs arm attachment?" | `needs_arm_attachment` | boolean; gates the next field |
| NumberField "Forearm length" (mm) (only when `needs_arm_attachment`) | `forearm_length_mm` | with guidance |
| Dropdown "Hand dominance" | `hand_dominance` | `Left`, `Right`, `Ambidextrous`, `Not yet established` |
| ChipGroup "Sensory preferences" | `sensory_preferences` | e.g. `Soft`, `Firm`, `Smooth`, `Textured`, `Lightweight`, `No preference` |

**Test:** the forearm-length field appears only when the arm-attachment toggle is on; a numeric entry calls `save({ palm_width_mm: 62 })`; a non-numeric entry does not call `save`.

- [ ] Steps: write test → run/fail → implement screen + wire route → pass → typecheck → commit (`feat(mobile): customization metrics sub-screen`).

---

## Final verification (after Task 8)

- [ ] `pnpm --filter @splat-connect/mobile test:unit` — full mobile suite green, output pristine.
- [ ] `pnpm -r typecheck` — clean across all packages.
- [ ] Manual smoke (requires backend merged + migration applied): sign up as a parent → Profile tab shows child-profile home → each sub-screen loads, edits autosave, reload reflects saved values.
