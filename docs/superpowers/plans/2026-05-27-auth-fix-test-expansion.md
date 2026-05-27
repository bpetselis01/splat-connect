# Auth Token Refresh Fix + Code Quality + Test Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a silent auth token refresh bug on public routes, extract auth logic into a testable helper, and add unit tests.

**Architecture:** Expand the middleware matcher to cover all routes so token refresh always runs in middleware. Extract `getUserRole()` from `layout.tsx` into `lib/auth.ts` with the correct `setAll` try/catch pattern. Unit-test the helper with mocked Supabase.

**Tech Stack:** Next.js 15 App Router, @supabase/ssr, Vitest, @splat-connect/types

---

### Task 1: Write failing tests for getUserRole()

**Files:**
- Create: `packages/web/tests/unit/lib/auth.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getUserRole } from '@/lib/auth'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}))

describe('getUserRole', () => {
  const mockGetUser = vi.fn()
  const mockSingle = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(cookies).mockResolvedValue({
      getAll: () => [],
      set: vi.fn(),
    } as any)

    vi.mocked(createServerClient).mockReturnValue({
      auth: { getUser: mockGetUser },
      from: () => ({
        select: () => ({
          eq: () => ({ single: mockSingle }),
        }),
      }),
    } as any)
  })

  it('returns null when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    expect(await getUserRole()).toBeNull()
  })

  it('returns null when profile row is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: null })
    expect(await getUserRole()).toBeNull()
  })

  it('returns contributor for a contributor user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: { role: 'contributor' } })
    expect(await getUserRole()).toBe('contributor')
  })

  it('returns admin for an admin user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: { role: 'admin' } })
    expect(await getUserRole()).toBe('admin')
  })

  it('returns null when Supabase throws', async () => {
    mockGetUser.mockRejectedValue(new Error('Supabase unavailable'))
    expect(await getUserRole()).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd packages/web && npx vitest run tests/unit/lib/auth.test.ts
```
Expected: 5 failures with `Cannot find module '@/lib/auth'`

---

### Task 2: Implement getUserRole() and make tests pass

**Files:**
- Create: `packages/web/lib/auth.ts`

- [ ] **Step 1: Create the implementation**

```typescript
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Role } from '@splat-connect/types'

export async function getUserRole(): Promise<Role | null> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Server Component cannot set cookies — middleware handles refresh
            }
          },
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    return (profile?.role as Role) ?? null
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Run the tests**

```bash
cd packages/web && npx vitest run tests/unit/lib/auth.test.ts
```
Expected: 5 passed

- [ ] **Step 3: Commit**

```bash
git add packages/web/lib/auth.ts packages/web/tests/unit/lib/auth.test.ts
git commit -m "feat(web): add getUserRole helper with unit tests"
```

---

### Task 3: Update layout.tsx to use getUserRole()

**Files:**
- Modify: `packages/web/app/layout.tsx`

- [ ] **Step 1: Replace layout.tsx with this content**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import { getUserRole } from '@/lib/auth'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SPLAT Connect — Toy Adaptation Library',
  description:
    'Open-source tutorials for switch-adapting toys for children with disabilities',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const role = await getUserRole()

  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-gray-50`}>
        <Nav role={role} />
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Run the full test suite**

```bash
cd packages/web && npx vitest run
```
Expected: all existing tests pass, no regressions

- [ ] **Step 3: Commit**

```bash
git add packages/web/app/layout.tsx
git commit -m "refactor(web): use getUserRole in layout, remove inline Supabase setup"
```

---

### Task 4: Expand middleware matcher to all routes

**Files:**
- Modify: `packages/web/middleware.ts` (last block)

- [ ] **Step 1: Update the config export at the bottom of middleware.ts**

Change:

```typescript
export const config = {
  matcher: ['/upload/:path*', '/my-tutorials/:path*', '/admin/:path*', '/dashboard/:path*'],
}
```

To:

```typescript
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

This regex matches every request except Next.js build assets (`_next/static`, `_next/image`) and static file extensions. Middleware now runs on every page request, so `supabase.auth.getUser()` fires on every route — including public ones like `/` and `/library` — keeping sessions refreshed consistently.

- [ ] **Step 2: Run the full test suite**

```bash
cd packages/web && npx vitest run
```
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/web/middleware.ts
git commit -m "fix(web): expand middleware matcher to refresh auth tokens on all routes"
```
