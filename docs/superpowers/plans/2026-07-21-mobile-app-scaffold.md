# Mobile App Scaffold (Expo) — Home Tab + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `packages/mobile`, a new Expo/React Native app in the existing pnpm monorepo, with email/password auth against existing Supabase accounts and a fully working Home tab (tutorial library → detail → PDF preview) backed by the existing public API. Scanner, Toy Library, and 3D Print are static placeholders.

**Architecture:** Expo Router (file-based navigation) with a 5-tab bottom bar. Screens are split into thin route files (`app/`) that read router params and pull hooks, and plain, prop-driven screen components (`components/`) that hold the actual logic and are unit-tested directly. `lib/api-client.ts` and `lib/supabase.ts` mirror the equivalent files in `packages/web`, swapped to Expo's env-var convention and `expo-secure-store` session persistence.

**Tech Stack:** Expo SDK (latest, via `create-expo-app`) + Expo Router + TypeScript, `@supabase/supabase-js` + `expo-secure-store`, `react-native-webview`, `@expo-google-fonts/nunito`, `jest-expo` + `@testing-library/react-native`.

## Global Constraints

- New package `@splat-connect/mobile` under `packages/*` — no `pnpm-workspace.yaml` change needed (glob already covers it).
- No changes to `packages/api` or the database. This plan only adds files under `packages/mobile`.
- Env vars use the `EXPO_PUBLIC_` prefix: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`. Loaded via `dotenv -e ../../.env.local -e .env.local` in the `dev` script, matching `packages/web`'s convention.
- TypeScript `strict: true` (matches `packages/web/tsconfig.json`).
- Auth is sign-in only against existing `admin`/`contributor` accounts — no new role, no signup flow.
- Only the Home tab is functional. Scanner, Toy Library, and 3D Print render a static "coming soon" message.
- "Preview Tutorial" opens the real `tutorial_pdf_url` (WebView + browser fallback) — no fabricated step-by-step viewer.
- Public API calls: `GET /api/public/tutorials` (optional `?difficulty=` query) and `GET /api/public/tutorials/:id` (returns `parts`, `tools`, `stl_files` — no `tutorial_contributors`).
- Testing: `jest-expo` + `@testing-library/react-native`, tests under `packages/mobile/tests/unit/`.

---

## File Structure

```
packages/mobile/
  package.json
  app.json
  tsconfig.json
  metro.config.js
  app/
    _layout.tsx                    # root layout: fonts + AuthProvider
    (tabs)/
      _layout.tsx                  # Tabs: Profile, Scanner, Home, Toy Library, 3D Print
      profile.tsx
      scanner.tsx
      toy-library.tsx
      print.tsx
      home/
        _layout.tsx                # Stack: index -> [id]/index -> [id]/preview
        index.tsx
        [id]/
          index.tsx
          preview.tsx
  components/
    coming-soon.tsx
    difficulty-badge.tsx
    profile-screen.tsx
    home/
      library-screen.tsx
      detail-screen.tsx
      preview-screen.tsx
  lib/
    theme.ts
    supabase.ts
    auth-context.tsx
    api-client.ts
  tests/
    unit/
      lib/
        api-client.test.ts
        auth-context.test.tsx
      components/
        coming-soon.test.tsx
        profile-screen.test.tsx
        home/
          library-screen.test.tsx
          detail-screen.test.tsx
          preview-screen.test.tsx
```

---

### Task 1: Scaffold `packages/mobile` and wire it into the monorepo

**Files:**
- Create: `packages/mobile/` (via `create-expo-app`), `package.json`, `app.json`, `tsconfig.json`, `metro.config.js`, `app/_layout.tsx`
- Modify: `package.json` (root) — add `dev:mobile` script

**Interfaces:**
- Produces: a bootable Expo Router app (`main: "expo-router/entry"`) with `@splat-connect/types` available as `workspace:*`, TypeScript strict mode, and a Metro config that resolves the pnpm workspace root.

- [ ] **Step 1: Scaffold the app**

```bash
cd packages
npx create-expo-app@latest mobile --template blank-typescript
cd ..
```

- [ ] **Step 2: Rename the package and add scripts**

Edit `packages/mobile/package.json`: set `"name": "@splat-connect/mobile"`, `"private": true`, `"main": "expo-router/entry"`, and scripts:

```json
"scripts": {
  "dev": "dotenv -e ../../.env.local -e .env.local -- expo start",
  "typecheck": "tsc --noEmit",
  "test:unit": "jest"
}
```

- [ ] **Step 3: Install Expo Router and its peer packages**

```bash
cd packages/mobile
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
cd ../..
```

- [ ] **Step 4: Install auth, data, and UI packages**

```bash
cd packages/mobile
npx expo install expo-secure-store react-native-url-polyfill react-native-webview @expo-google-fonts/nunito expo-font
pnpm add @supabase/supabase-js --filter @splat-connect/mobile
cd ../..
```

- [ ] **Step 5: Add the workspace dependency on `@splat-connect/types`**

```bash
pnpm add @splat-connect/types@workspace:* --filter @splat-connect/mobile
```

- [ ] **Step 6: Install the test stack**

```bash
cd packages/mobile
npx expo install --save-dev jest-expo
cd ../..
pnpm add -D jest @testing-library/react-native @types/jest --filter @splat-connect/mobile
```

Add to `packages/mobile/package.json`:

```json
"jest": {
  "preset": "jest-expo",
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|expo-router|expo-linking|expo-constants|expo-status-bar|expo-secure-store|expo-font|react-native-webview|react-native-url-polyfill|react-native-css-interop|@testing-library/react-native))"
  ]
}
```

- [ ] **Step 7: Add `metro.config.js` for the pnpm workspace**

```js
// packages/mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = true

module.exports = config
```

- [ ] **Step 8: Set `tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 9: Replace the default entry with a minimal Expo Router root layout**

Delete `packages/mobile/App.tsx`. Create `packages/mobile/app/_layout.tsx`:

```tsx
import { Slot } from 'expo-router'

export default function RootLayout() {
  return <Slot />
}
```

(This is replaced with the real font-loading + `AuthProvider` version in Task 4.)

- [ ] **Step 10: Add the root `dev:mobile` script**

Edit root `package.json`, add to `scripts`:

```json
"dev:mobile": "pnpm --filter @splat-connect/mobile dev"
```

- [ ] **Step 11: Verify the scaffold**

```bash
pnpm install
pnpm --filter @splat-connect/mobile typecheck
```

Expected: no errors.

Manual check (not automatable — document the result when running this task): set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL` in `packages/mobile/.env.local`, then run `pnpm dev:mobile` and confirm the Metro bundler starts and the Expo Go QR code appears with no config errors.

- [ ] **Step 12: Commit**

```bash
git add packages/mobile package.json pnpm-lock.yaml
git commit -m "feat(mobile): scaffold Expo Router app in packages/mobile"
```

---

### Task 2: Supabase client and auth context

**Files:**
- Create: `packages/mobile/lib/supabase.ts`
- Create: `packages/mobile/lib/auth-context.tsx`
- Test: `packages/mobile/tests/unit/lib/auth-context.test.tsx`

**Interfaces:**
- Consumes: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Task 1 env setup).
- Produces: `supabase` (Supabase client) from `lib/supabase.ts`. `AuthProvider` and `useAuth()` from `lib/auth-context.tsx`, where `useAuth()` returns `{ session: Session | null, loading: boolean, signIn(email: string, password: string): Promise<{ error: string | null }>, signOut(): Promise<void> }`.

- [ ] **Step 1: Write `lib/supabase.ts`**

```ts
// packages/mobile/lib/supabase.ts
import 'react-native-url-polyfill/auto'
import { AppState } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { createClient } from '@supabase/supabase-js'

// ponytail: SecureStore caps individual values at ~2048 bytes. Fine for the
// simple email/password sessions this app issues today; if a future OAuth
// provider inflates the session payload past that, swap this adapter for a
// hybrid SecureStore (key) + AsyncStorage (encrypted blob) implementation.
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)

// React Native has no browser visibility API — Supabase relies on this to
// pause/resume its auto-refresh timer while the app is backgrounded.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh()
  } else {
    supabase.auth.stopAutoRefresh()
  }
})
```

- [ ] **Step 2: Write `lib/auth-context.tsx`**

```tsx
// packages/mobile/lib/auth-context.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

type AuthContextValue = {
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
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

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut }}>
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

- [ ] **Step 3: Write the failing test**

```tsx
// packages/mobile/tests/unit/lib/auth-context.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from '../../../lib/auth-context'

const mockGetSession = jest.fn()
const mockOnAuthStateChange = jest.fn()
const mockSignInWithPassword = jest.fn()
const mockSignOut = jest.fn()

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } })
  })

  // Tests: loading starts true and flips to false once the initial session check resolves
  it('resolves loading to false after the initial session check', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
  })

  // Tests: signIn surfaces the Supabase error message on failure
  it('signIn returns the error message on failed sign-in', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { error } = await act(() => result.current.signIn('a@b.com', 'wrong'))
    expect(error).toBe('Invalid login credentials')
  })

  // Tests: signIn returns a null error on success
  it('signIn returns null error on success', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const { error } = await act(() => result.current.signIn('a@b.com', 'correct'))
    expect(error).toBeNull()
  })

  // Tests: signOut delegates to Supabase
  it('signOut calls supabase.auth.signOut', async () => {
    mockSignOut.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.signOut())
    expect(mockSignOut).toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter @splat-connect/mobile test:unit tests/unit/lib/auth-context.test.tsx
```

Expected: all 4 tests PASS (source and test were written together above — this confirms the wiring, storage adapter, and mocks are correct).

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/lib/supabase.ts packages/mobile/lib/auth-context.tsx packages/mobile/tests/unit/lib/auth-context.test.tsx
git commit -m "feat(mobile): add Supabase client and auth context"
```

---

### Task 3: API client

**Files:**
- Create: `packages/mobile/lib/api-client.ts`
- Test: `packages/mobile/tests/unit/lib/api-client.test.ts`

**Interfaces:**
- Consumes: `supabase` from `lib/supabase.ts` (Task 2), `EXPO_PUBLIC_API_URL` env var.
- Produces: `apiClient` from `lib/api-client.ts` with `get<T>(path)`, `post<T>(path, body)`, `patch<T>(path, body)`, `delete<T>(path)`, `postFormData<T>(path, formData)` — same shape as `packages/web/lib/browser-api-client.ts`'s `browserApiClient`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/mobile/tests/unit/lib/api-client.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals'

const mockGetSession = jest.fn()

jest.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getSession: mockGetSession } },
}))

const fetchMock = jest.fn()
global.fetch = fetchMock as unknown as typeof fetch

const { apiClient } = await import('../../../lib/api-client')

function okResponse(body: unknown) {
  const text = body === null ? '' : JSON.stringify(body)
  return { ok: true, text: () => Promise.resolve(text), clone: () => ({ json: () => Promise.resolve({}) }) }
}
function errorResponse(status: number, errorBody: Record<string, string> = {}) {
  return { ok: false, status, clone: () => ({ json: () => Promise.resolve(errorBody) }) }
}

describe('apiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3101'
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } } })
  })

  it('get — attaches Authorization header and returns parsed JSON', async () => {
    fetchMock.mockResolvedValue(okResponse([{ id: '1' }]))
    const result = await apiClient.get('/api/public/tutorials')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3101/api/public/tutorials',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
    expect(result).toEqual([{ id: '1' }])
  })

  it('post — sends JSON body with Content-Type header', async () => {
    fetchMock.mockResolvedValue(okResponse({ id: 'new' }))
    await apiClient.post('/api/tutorials', { title: 'Test' })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ title: 'Test' }),
      })
    )
  })

  it('patch — sends PATCH method with JSON body', async () => {
    fetchMock.mockResolvedValue(okResponse({ status: 'pending' }))
    await apiClient.patch('/api/tutorials/1', { status: 'pending' })
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:3101/api/tutorials/1')
    expect(opts.method).toBe('PATCH')
    expect(opts.body).toBe(JSON.stringify({ status: 'pending' }))
  })

  it('delete — sends DELETE method with no body', async () => {
    fetchMock.mockResolvedValue(okResponse(null))
    await apiClient.delete('/api/tutorials/1')
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.method).toBe('DELETE')
    expect(opts.body).toBeUndefined()
  })

  it('postFormData — omits Content-Type, sends FormData body', async () => {
    fetchMock.mockResolvedValue(okResponse({ url: 'https://example.com/file.pdf' }))
    const form = new FormData()
    form.append('file', 'contents')
    await apiClient.postFormData('/api/upload/pdf', form)
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.body).toBe(form)
    expect((opts.headers as Record<string, string>)?.['Content-Type']).toBeUndefined()
    expect((opts.headers as Record<string, string>)?.Authorization).toBe('Bearer test-token')
  })

  it('throws with API error detail on non-ok response', async () => {
    fetchMock.mockResolvedValue(errorResponse(400, { error: 'Title is required' }))
    await expect(apiClient.post('/api/tutorials', {})).rejects.toThrow('Title is required')
  })

  it('returns null for empty-body (204) response', async () => {
    fetchMock.mockResolvedValue(okResponse(null))
    const result = await apiClient.delete('/api/tutorials/1')
    expect(result).toBeNull()
  })

  it('omits Authorization header when session token is null', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    fetchMock.mockResolvedValue(okResponse([]))
    await apiClient.get('/api/public/tutorials')
    const [, opts] = fetchMock.mock.calls[0]
    expect((opts.headers as Record<string, string>)?.Authorization).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm --filter @splat-connect/mobile test:unit tests/unit/lib/api-client.test.ts
```

Expected: FAIL — `Cannot find module '../../../lib/api-client'`.

- [ ] **Step 3: Write `lib/api-client.ts`**

```ts
// packages/mobile/lib/api-client.ts
import { supabase } from './supabase'

async function getToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    let detail = ''
    try {
      const j = (await res.clone().json()) as { error?: string }
      if (j.error) detail = `: ${j.error}`
    } catch {}
    throw new Error(`API ${method} ${path} failed with status ${res.status}${detail}`)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

async function requestFormData<T>(method: string, path: string, formData: FormData): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  })
  if (!res.ok) {
    let detail = ''
    try {
      const j = (await res.clone().json()) as { error?: string }
      if (j.error) detail = `: ${j.error}`
    } catch {}
    throw new Error(`API ${method} ${path} failed with status ${res.status}${detail}`)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  postFormData: <T>(path: string, formData: FormData) => requestFormData<T>('POST', path, formData),
}
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
pnpm --filter @splat-connect/mobile test:unit tests/unit/lib/api-client.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/lib/api-client.ts packages/mobile/tests/unit/lib/api-client.test.ts
git commit -m "feat(mobile): add api-client mirroring browser-api-client"
```

---

### Task 4: Navigation shell, theme, and Profile tab

**Files:**
- Create: `packages/mobile/lib/theme.ts`
- Modify: `packages/mobile/app/_layout.tsx` (replaces Task 1's minimal version)
- Create: `packages/mobile/app/(tabs)/_layout.tsx`
- Create: `packages/mobile/components/coming-soon.tsx`
- Create: `packages/mobile/app/(tabs)/scanner.tsx`, `packages/mobile/app/(tabs)/toy-library.tsx`, `packages/mobile/app/(tabs)/print.tsx`
- Create: `packages/mobile/components/profile-screen.tsx`
- Create: `packages/mobile/app/(tabs)/profile.tsx`
- Test: `packages/mobile/tests/unit/components/coming-soon.test.tsx`
- Test: `packages/mobile/tests/unit/components/profile-screen.test.tsx`

**Interfaces:**
- Consumes: `AuthProvider`, `useAuth()` from `lib/auth-context.tsx` (Task 2).
- Produces: `theme` object from `lib/theme.ts` (`theme.colors`, `theme.fonts`, `theme.spacing(n)`), consumed by Tasks 5 and 6. `ComingSoon` component consumed by three placeholder routes.

- [ ] **Step 1: Write `lib/theme.ts`**

```ts
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
} as const
```

- [ ] **Step 2: Replace `app/_layout.tsx` with font loading and `AuthProvider`**

```tsx
// packages/mobile/app/_layout.tsx
import { Slot } from 'expo-router'
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito'
import { AuthProvider } from '../lib/auth-context'

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold })

  if (!fontsLoaded) return null

  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  )
}
```

- [ ] **Step 3: Write `app/(tabs)/_layout.tsx`**

```tsx
// packages/mobile/app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: theme.colors.primary, headerShown: false }}>
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="scanner"
        options={{ title: 'Scanner', tabBarIcon: ({ color, size }) => <Ionicons name="scan" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="toy-library"
        options={{ title: 'Toy Library', tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="print"
        options={{ title: '3D Print', tabBarIcon: ({ color, size }) => <Ionicons name="print" size={size} color={color} /> }}
      />
    </Tabs>
  )
}
```

- [ ] **Step 4: Write the failing test for `ComingSoon`**

```tsx
// packages/mobile/tests/unit/components/coming-soon.test.tsx
import { render, screen } from '@testing-library/react-native'
import { ComingSoon } from '../../../components/coming-soon'

describe('ComingSoon', () => {
  it('renders the given label', () => {
    render(<ComingSoon label="Toy Scanner" />)
    expect(screen.getByText('Toy Scanner is coming soon.')).toBeTruthy()
  })
})
```

- [ ] **Step 5: Run it, verify it fails**

```bash
pnpm --filter @splat-connect/mobile test:unit tests/unit/components/coming-soon.test.tsx
```

Expected: FAIL — `Cannot find module '../../../components/coming-soon'`.

- [ ] **Step 6: Write `components/coming-soon.tsx` and the three placeholder routes**

```tsx
// packages/mobile/components/coming-soon.tsx
import { View, Text, StyleSheet } from 'react-native'
import { theme } from '../lib/theme'

export function ComingSoon({ label }: { label: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{label} is coming soon.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background, padding: theme.spacing(4) },
  text: { fontFamily: theme.fonts.semiBold, fontSize: 16, color: theme.colors.text, textAlign: 'center' },
})
```

```tsx
// packages/mobile/app/(tabs)/scanner.tsx
import { ComingSoon } from '../../components/coming-soon'

export default function ScannerRoute() {
  return <ComingSoon label="Toy Scanner" />
}
```

```tsx
// packages/mobile/app/(tabs)/toy-library.tsx
import { ComingSoon } from '../../components/coming-soon'

export default function ToyLibraryRoute() {
  return <ComingSoon label="Toy Library" />
}
```

```tsx
// packages/mobile/app/(tabs)/print.tsx
import { ComingSoon } from '../../components/coming-soon'

export default function PrintRoute() {
  return <ComingSoon label="3D Print Requests" />
}
```

- [ ] **Step 7: Run the test, verify it passes**

```bash
pnpm --filter @splat-connect/mobile test:unit tests/unit/components/coming-soon.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Write the failing test for `ProfileScreen`**

```tsx
// packages/mobile/tests/unit/components/profile-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ProfileScreen } from '../../../components/profile-screen'
import { useAuth } from '../../../lib/auth-context'

jest.mock('../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

describe('ProfileScreen', () => {
  it('shows a sign-in form when signed out', () => {
    ;(useAuth as jest.Mock).mockReturnValue({ session: null, signIn: jest.fn(), signOut: jest.fn() })
    render(<ProfileScreen />)
    expect(screen.getByText('Sign In')).toBeTruthy()
    expect(screen.getByPlaceholderText('Email')).toBeTruthy()
  })

  it('shows signed-in state with the user email', () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      session: { user: { email: 'parent@example.com' } },
      signIn: jest.fn(),
      signOut: jest.fn(),
    })
    render(<ProfileScreen />)
    expect(screen.getByText('Signed in as parent@example.com')).toBeTruthy()
  })

  it('shows an error message when sign-in fails', async () => {
    const signIn = jest.fn().mockResolvedValue({ error: 'Invalid login credentials' })
    ;(useAuth as jest.Mock).mockReturnValue({ session: null, signIn, signOut: jest.fn() })
    render(<ProfileScreen />)
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'a@b.com')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'wrong')
    fireEvent.press(screen.getByText('Sign In'))
    await waitFor(() => expect(screen.getByText('Invalid login credentials')).toBeTruthy())
    expect(signIn).toHaveBeenCalledWith('a@b.com', 'wrong')
  })
})
```

- [ ] **Step 9: Run it, verify it fails**

```bash
pnpm --filter @splat-connect/mobile test:unit tests/unit/components/profile-screen.test.tsx
```

Expected: FAIL — `Cannot find module '../../../components/profile-screen'`.

- [ ] **Step 10: Write `components/profile-screen.tsx` and `app/(tabs)/profile.tsx`**

```tsx
// packages/mobile/components/profile-screen.tsx
import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useAuth } from '../lib/auth-context'
import { theme } from '../lib/theme'

export function ProfileScreen() {
  const { session, signIn, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn() {
    setError(null)
    const { error: signInError } = await signIn(email, password)
    if (signInError) setError(signInError)
  }

  if (session) {
    return (
      <View style={styles.container}>
        <Text style={styles.signedInText}>Signed in as {session.user.email}</Text>
        <Pressable style={styles.button} onPress={() => signOut()}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Sign In</Text>
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
      <Pressable style={styles.button} onPress={handleSignIn}>
        <Text style={styles.buttonText}>Sign In</Text>
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
    borderRadius: 8,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(2),
    fontFamily: theme.fonts.regular,
  },
  error: { color: '#991b1b', fontFamily: theme.fonts.regular, marginBottom: theme.spacing(2) },
  button: { backgroundColor: theme.colors.primary, borderRadius: 8, padding: theme.spacing(3), alignItems: 'center' },
  buttonText: { color: '#ffffff', fontFamily: theme.fonts.semiBold },
  signedInText: { fontFamily: theme.fonts.semiBold, fontSize: 16, color: theme.colors.text, marginBottom: theme.spacing(3), textAlign: 'center' },
})
```

```tsx
// packages/mobile/app/(tabs)/profile.tsx
import { ProfileScreen } from '../../components/profile-screen'

export default function ProfileRoute() {
  return <ProfileScreen />
}
```

- [ ] **Step 11: Run the test, verify it passes**

```bash
pnpm --filter @splat-connect/mobile test:unit tests/unit/components/profile-screen.test.tsx
```

Expected: all 3 tests PASS.

- [ ] **Step 12: Typecheck**

```bash
pnpm --filter @splat-connect/mobile typecheck
```

Expected: no errors. (`app/(tabs)/home/` doesn't exist yet — Task 5 adds it — so the `home` tab has no matching route file until then; this is fine, Expo Router only requires the file to exist when the app runs, not at typecheck time.)

- [ ] **Step 13: Commit**

```bash
git add packages/mobile/lib/theme.ts packages/mobile/app/_layout.tsx packages/mobile/app/\(tabs\) packages/mobile/components/coming-soon.tsx packages/mobile/components/profile-screen.tsx packages/mobile/tests/unit/components
git commit -m "feat(mobile): add navigation shell, theme, and Profile sign-in"
```

---

### Task 5: Home tab — tutorial library screen

**Files:**
- Create: `packages/mobile/components/difficulty-badge.tsx`
- Create: `packages/mobile/components/home/library-screen.tsx`
- Create: `packages/mobile/app/(tabs)/home/_layout.tsx`
- Create: `packages/mobile/app/(tabs)/home/index.tsx`
- Test: `packages/mobile/tests/unit/components/home/library-screen.test.tsx`

**Interfaces:**
- Consumes: `apiClient` (Task 3), `theme` (Task 4), `Tutorial`/`Difficulty` types from `@splat-connect/types`.
- Produces: `DifficultyBadge` from `components/difficulty-badge.tsx` (consumed by Task 6). `LibraryScreen` wired into the Home tab's index route.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/mobile/tests/unit/components/home/library-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { LibraryScreen } from '../../../../components/home/library-screen'
import { apiClient } from '../../../../lib/api-client'

jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: jest.fn() } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const TUTORIALS = [
  { id: '1', title: 'Build a Robot Arm', description: null, difficulty: 'easy', status: 'approved', tutorial_pdf_url: null, toy_photo_url: null, rejection_note: null, created_at: '', reviewed_at: null },
  { id: '2', title: 'Advanced Gearbox', description: null, difficulty: 'hard', status: 'approved', tutorial_pdf_url: null, toy_photo_url: null, rejection_note: null, created_at: '', reviewed_at: null },
]

describe('LibraryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(apiClient.get as jest.Mock).mockResolvedValue(TUTORIALS)
  })

  it('renders tutorial titles from the public tutorials endpoint', async () => {
    render(<LibraryScreen />)
    expect(await screen.findByText('Build a Robot Arm')).toBeTruthy()
    expect(screen.getByText('Advanced Gearbox')).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/api/public/tutorials')
  })

  it('filters the list by search text', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Build a Robot Arm')
    fireEvent.changeText(screen.getByPlaceholderText('Search tutorials'), 'gearbox')
    expect(screen.queryByText('Build a Robot Arm')).toBeNull()
    expect(screen.getByText('Advanced Gearbox')).toBeTruthy()
  })

  it('refetches with a difficulty filter when a chip is pressed', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Build a Robot Arm')
    fireEvent.press(screen.getByText('Hard'))
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith('/api/public/tutorials?difficulty=hard')
    )
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

```bash
pnpm --filter @splat-connect/mobile test:unit tests/unit/components/home/library-screen.test.tsx
```

Expected: FAIL — `Cannot find module '../../../../components/home/library-screen'`.

- [ ] **Step 3: Write `components/difficulty-badge.tsx`**

```tsx
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
  badge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4 },
  text: { fontSize: 11, fontFamily: theme.fonts.bold },
})
```

- [ ] **Step 4: Write `components/home/library-screen.tsx`**

```tsx
// packages/mobile/components/home/library-screen.tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import type { Tutorial, Difficulty } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { DifficultyBadge } from '../difficulty-badge'

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
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)

  useEffect(() => {
    setLoading(true)
    const path = difficulty ? `/api/public/tutorials?difficulty=${difficulty}` : '/api/public/tutorials'
    apiClient
      .get<Tutorial[]>(path)
      .then(setTutorials)
      .finally(() => setLoading(false))
  }, [difficulty])

  const visible = tutorials.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search tutorials"
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.label}
            onPress={() => setDifficulty(f.value)}
            style={[styles.chip, difficulty === f.value && styles.chipActive]}
          >
            <Text style={[styles.chipText, difficulty === f.value && styles.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: '/home/[id]', params: { id: item.id } })}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <DifficultyBadge difficulty={item.difficulty} />
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
    borderRadius: 8,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    fontFamily: theme.fonts.regular,
  },
  filterRow: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(3) },
  chip: {
    paddingVertical: theme.spacing(1),
    paddingHorizontal: theme.spacing(3),
    borderRadius: 16,
    backgroundColor: theme.colors.accentLight,
  },
  chipActive: { backgroundColor: theme.colors.primary },
  chipText: { color: theme.colors.text, fontFamily: theme.fonts.semiBold },
  chipTextActive: { color: '#ffffff' },
  card: {
    backgroundColor: theme.colors.accentLighter,
    borderRadius: 12,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(2),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { fontFamily: theme.fonts.bold, color: theme.colors.text, fontSize: 16 },
})
```

- [ ] **Step 5: Wire the route files**

```tsx
// packages/mobile/app/(tabs)/home/_layout.tsx
import { Stack } from 'expo-router'

export default function HomeStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Tutorials' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Tutorial' }} />
      <Stack.Screen name="[id]/preview" options={{ title: 'Preview' }} />
    </Stack>
  )
}
```

```tsx
// packages/mobile/app/(tabs)/home/index.tsx
import { LibraryScreen } from '../../../components/home/library-screen'

export default function HomeTabRoute() {
  return <LibraryScreen />
}
```

- [ ] **Step 6: Run the test, verify it passes**

```bash
pnpm --filter @splat-connect/mobile test:unit tests/unit/components/home/library-screen.test.tsx
```

Expected: all 3 tests PASS.

- [ ] **Step 7: Typecheck**

```bash
pnpm --filter @splat-connect/mobile typecheck
```

Expected: no errors. (`[id]/index.tsx` and `[id]/preview.tsx` referenced by the Stack layout don't exist yet — Task 6 adds them; Expo Router only needs them present at runtime, not typecheck time.)

- [ ] **Step 8: Commit**

```bash
git add packages/mobile/components/difficulty-badge.tsx packages/mobile/components/home/library-screen.tsx "packages/mobile/app/(tabs)/home" packages/mobile/tests/unit/components/home/library-screen.test.tsx
git commit -m "feat(mobile): add Home tab tutorial library screen"
```

---

### Task 6: Home tab — tutorial detail and PDF preview

**Files:**
- Create: `packages/mobile/components/home/detail-screen.tsx`
- Create: `packages/mobile/components/home/preview-screen.tsx`
- Create: `packages/mobile/app/(tabs)/home/[id]/index.tsx`
- Create: `packages/mobile/app/(tabs)/home/[id]/preview.tsx`
- Test: `packages/mobile/tests/unit/components/home/detail-screen.test.tsx`
- Test: `packages/mobile/tests/unit/components/home/preview-screen.test.tsx`

**Interfaces:**
- Consumes: `apiClient` (Task 3), `theme` (Task 4), `DifficultyBadge` (Task 5).
- Produces: `DetailScreen({ id })` and `PreviewScreen({ pdfUrl })`, wired into the Home stack's `[id]` routes.

- [ ] **Step 1: Write the failing test for `DetailScreen`**

```tsx
// packages/mobile/tests/unit/components/home/detail-screen.test.tsx
import { render, screen } from '@testing-library/react-native'
import { DetailScreen } from '../../../../components/home/detail-screen'
import { apiClient } from '../../../../lib/api-client'

jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: jest.fn() } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const DETAIL = {
  id: '1',
  title: 'Build a Robot Arm',
  description: 'A fun beginner build.',
  difficulty: 'easy',
  status: 'approved',
  tutorial_pdf_url: 'https://example.com/robot-arm.pdf',
  toy_photo_url: null,
  rejection_note: null,
  created_at: '',
  reviewed_at: null,
  parts: [{ id: 'p1', tutorial_id: '1', name: 'Servo Motor', quantity: 2, is_optional: false, buy_links: [] }],
  tools: [{ id: 't1', tutorial_id: '1', name: 'Screwdriver', is_optional: false, buy_links: [] }],
  stl_files: [],
}

describe('DetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(apiClient.get as jest.Mock).mockResolvedValue(DETAIL)
  })

  it('renders tutorial detail with parts and tools', async () => {
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('Build a Robot Arm')).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/api/public/tutorials/1')
    expect(screen.getByText('Servo Motor × 2')).toBeTruthy()
    expect(screen.getByText('Screwdriver')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

```bash
pnpm --filter @splat-connect/mobile test:unit tests/unit/components/home/detail-screen.test.tsx
```

Expected: FAIL — `Cannot find module '../../../../components/home/detail-screen'`.

- [ ] **Step 3: Write `components/home/detail-screen.tsx`**

```tsx
// packages/mobile/components/home/detail-screen.tsx
import { useEffect, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import type { Tutorial, Part, Tool, StlFile } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { DifficultyBadge } from '../difficulty-badge'

type TutorialDetail = Tutorial & { parts: Part[]; tools: Tool[]; stl_files: StlFile[] }

export function DetailScreen({ id }: { id: string }) {
  const router = useRouter()
  const [tutorial, setTutorial] = useState<TutorialDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient
      .get<TutorialDetail>(`/api/public/tutorials/${id}`)
      .then(setTutorial)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <ActivityIndicator color={theme.colors.primary} style={styles.loader} />
  if (!tutorial) return <Text style={styles.error}>Tutorial not found.</Text>

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{tutorial.title}</Text>
      <DifficultyBadge difficulty={tutorial.difficulty} />
      {tutorial.description ? <Text style={styles.description}>{tutorial.description}</Text> : null}

      <Text style={styles.sectionHeading}>Parts</Text>
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

      <Text style={styles.sectionHeading}>Tools</Text>
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

      <Pressable
        style={styles.previewButton}
        onPress={() =>
          router.push({
            pathname: '/home/[id]/preview',
            params: { id: tutorial.id, pdfUrl: tutorial.tutorial_pdf_url ?? '' },
          })
        }
      >
        <Text style={styles.previewButtonText}>Preview Tutorial</Text>
      </Pressable>
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
  listItem: { fontFamily: theme.fonts.regular, color: theme.colors.text, paddingVertical: theme.spacing(1) },
  previewButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    padding: theme.spacing(3),
    alignItems: 'center',
    marginTop: theme.spacing(4),
  },
  previewButtonText: { color: '#ffffff', fontFamily: theme.fonts.semiBold },
})
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
pnpm --filter @splat-connect/mobile test:unit tests/unit/components/home/detail-screen.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Write the failing test for `PreviewScreen`**

```tsx
// packages/mobile/tests/unit/components/home/preview-screen.test.tsx
import { render, screen } from '@testing-library/react-native'
import { PreviewScreen } from '../../../../components/home/preview-screen'

jest.mock('react-native-webview', () => {
  const { View } = require('react-native')
  return { WebView: (props: { source: { uri: string } }) => <View testID="webview" {...props} /> }
})

describe('PreviewScreen', () => {
  it('renders a WebView with the given pdf url', () => {
    render(<PreviewScreen pdfUrl="https://example.com/robot-arm.pdf" />)
    const webview = screen.getByTestId('webview')
    expect(webview.props.source).toEqual({ uri: 'https://example.com/robot-arm.pdf' })
  })

  it('shows a fallback message when pdfUrl is null', () => {
    render(<PreviewScreen pdfUrl={null} />)
    expect(screen.getByText('No PDF is available for this tutorial yet.')).toBeTruthy()
  })
})
```

- [ ] **Step 6: Run it, verify it fails**

```bash
pnpm --filter @splat-connect/mobile test:unit tests/unit/components/home/preview-screen.test.tsx
```

Expected: FAIL — `Cannot find module '../../../../components/home/preview-screen'`.

- [ ] **Step 7: Write `components/home/preview-screen.tsx`**

```tsx
// packages/mobile/components/home/preview-screen.tsx
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native'
import { WebView } from 'react-native-webview'
import { theme } from '../../lib/theme'

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
      <Pressable style={styles.fallbackButton} onPress={() => Linking.openURL(pdfUrl)}>
        <Text style={styles.fallbackButtonText}>Open in Browser</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing(4) },
  message: { fontFamily: theme.fonts.regular, color: theme.colors.text, textAlign: 'center' },
  fallbackButton: { padding: theme.spacing(3), alignItems: 'center', backgroundColor: theme.colors.accentLight },
  fallbackButtonText: { color: theme.colors.primaryDark, fontFamily: theme.fonts.semiBold },
})
```

- [ ] **Step 8: Wire the route files**

```tsx
// packages/mobile/app/(tabs)/home/[id]/index.tsx
import { useLocalSearchParams } from 'expo-router'
import { DetailScreen } from '../../../../components/home/detail-screen'

export default function TutorialDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <DetailScreen id={id} />
}
```

```tsx
// packages/mobile/app/(tabs)/home/[id]/preview.tsx
import { useLocalSearchParams } from 'expo-router'
import { PreviewScreen } from '../../../../components/home/preview-screen'

export default function TutorialPreviewRoute() {
  const { pdfUrl } = useLocalSearchParams<{ pdfUrl?: string }>()
  return <PreviewScreen pdfUrl={pdfUrl || null} />
}
```

- [ ] **Step 9: Run the test, verify it passes**

```bash
pnpm --filter @splat-connect/mobile test:unit tests/unit/components/home/preview-screen.test.tsx
```

Expected: both tests PASS.

- [ ] **Step 10: Run the full suite and typecheck**

```bash
pnpm --filter @splat-connect/mobile test:unit
pnpm --filter @splat-connect/mobile typecheck
```

Expected: all tests PASS, no type errors.

- [ ] **Step 11: Manual smoke test**

Run `pnpm dev:mobile`, open in Expo Go, and walk the golden path: Home tab loads the tutorial list → tap a tutorial → detail screen shows parts/tools → tap "Preview Tutorial" → PDF renders in the WebView (or the "no PDF" message shows if `tutorial_pdf_url` is null). Also check Profile (sign in/out with a real account) and that Scanner/Toy Library/3D Print show their placeholder text.

- [ ] **Step 12: Commit**

```bash
git add packages/mobile/components/home packages/mobile/tests/unit/components/home "packages/mobile/app/(tabs)/home/[id]"
git commit -m "feat(mobile): add Home tab tutorial detail and PDF preview screens"
```

---

## Self-Review

**1. Spec coverage:**
- Monorepo placement/env vars → Task 1. ✅
- Auth (sign-in, SecureStore, existing accounts) → Task 2. ✅
- Home tab API integration (library, detail, preview via PDF) → Tasks 5–6. ✅
- Styling/theme → Task 4 (`theme.ts`), used throughout Tasks 4–6. ✅
- Testing stack (`jest-expo` + `@testing-library/react-native`) → Task 1 setup, exercised in every task. ✅
- Navigation shell (5 tabs, 3 placeholders, Profile hosting login) → Task 4. ✅
- Compatibility (Expo Go-only, no custom dev client) → all chosen packages (`expo-secure-store`, `expo-router`, `react-native-webview`, `@expo-google-fonts/nunito`) are Expo Go-compatible; nothing here requires a config plugin or native rebuild. ✅

**2. Placeholder scan:** No "TBD"/"TODO" strings; every step has complete, runnable code.

**3. Type consistency:** `apiClient.get<T>` / `.post<T>` signatures match between Task 3's definition and every consumer (Tasks 5–6). `useAuth()`'s returned shape (`session`, `loading`, `signIn`, `signOut`) matches between Task 2's definition and Task 4's `ProfileScreen` usage. `theme.colors`, `theme.fonts`, `theme.spacing` are used consistently with the exact keys defined in Task 4. `DifficultyBadge` prop (`difficulty: Difficulty`) matches its Task 5 definition and Task 6 usage in `DetailScreen`.

---

Plan complete and saved to `docs/superpowers/plans/2026-07-21-mobile-app-scaffold.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
