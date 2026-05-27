# Auth Token Refresh Fix + Code Quality + Test Expansion

**Date:** 2026-05-27
**Status:** Approved
**Scope:** packages/web

## Problem

Two gaps exist in the current auth implementation:

1. **Middleware matcher is too narrow.** The middleware only runs on protected routes (`/upload`, `/my-tutorials`, `/admin`, `/dashboard`). For public routes like `/` and `/library`, middleware never runs — so Supabase's token refresh never fires via the correct path.

2. **`setAll` is a silent no-op in layout.tsx.** When `supabase.auth.getUser()` is called in layout.tsx and Supabase internally refreshes an expired token, the `setAll: () => {}` on line 56 silently discards the refreshed cookie. The browser never receives the new token, so the next request uses the expired one. The user appears logged out on public pages even though Supabase successfully refreshed the session.

## Architecture

### Fix 1: Expand Middleware Matcher

**File:** `packages/web/middleware.ts` (line 124)

Expand the matcher from a list of specific protected route patterns to a wildcard that covers all routes except Next.js internals and static assets:

```typescript
matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
```

The existing middleware logic already handles the pass-through for non-protected routes — if the pathname doesn't match contributor or admin routes, execution falls through to `return supabaseResponse`. The important side effect is that `supabase.auth.getUser()` runs on every request, triggering token refresh in the `setAll` callback, which middleware CAN write to both request and response cookies.

### Fix 2: Explicit setAll in layout.tsx

**File:** `packages/web/app/layout.tsx` (lines 54–57)

Replace the silent no-op with the Supabase SSR-recommended try/catch pattern:

```typescript
setAll(cookiesToSet) {
  try {
    cookiesToSet.forEach(({ name, value, options }) =>
      cookieStore.set(name, value, options)
    )
  } catch {
    // Server Component cannot set cookies — middleware handles refresh
  }
},
```

The `try/catch` is necessary because Server Components cannot set response cookies. The attempt will throw in a Server Component render but succeed in a Server Action context. The comment makes the intent explicit rather than hiding it behind a bare `() => {}`.

### Refactor: Extract getUserRole() Helper

**New file:** `packages/web/lib/auth.ts`

Extract the 9-line inline auth+role-fetch block from layout.tsx into a standalone async function:

```typescript
export async function getUserRole(): Promise<Role | null>
```

This helper:
- Creates a Supabase server client using the fixed setAll pattern above
- Calls `supabase.auth.getUser()`
- Queries the `profiles` table for `role`
- Returns the `Role` or `null`
- Wraps everything in try/catch (unauthenticated or unavailable → null)

layout.tsx is reduced to a single `const role = await getUserRole()` call — from ~30 lines of inline logic to ~10.

## Test Expansion

### New file: `packages/web/tests/unit/lib/auth.test.ts`

Unit tests for `getUserRole()`:

| Test | Mock setup | Expected |
|------|-----------|----------|
| Not authenticated | `getUser()` returns `{ user: null }` | `null` |
| Authenticated, no profile row | profile query returns `{ data: null }` | `null` |
| Authenticated, contributor | profile returns `{ role: 'contributor' }` | `'contributor'` |
| Authenticated, admin | profile returns `{ role: 'admin' }` | `'admin'` |
| Supabase throws | `getUser()` throws | `null` |

Mocking strategy follows the existing suite pattern: `vi.mock('@supabase/ssr')` with a mock `createServerClient`, and `vi.mock('next/headers')` returning a stub `cookies()` with `getAll` and `set`.

### Deferred: Middleware unit tests

Testing the redirect branches requires mocking `NextRequest`/`NextResponse`. This is higher-complexity and out of scope for this phase — middleware is covered by the integration/E2E test plan.

## Files Changed

| File | Change |
|------|--------|
| `packages/web/middleware.ts` | Expand matcher to all routes |
| `packages/web/app/layout.tsx` | Fix setAll, replace inline logic with `getUserRole()` call |
| `packages/web/lib/auth.ts` | New: `getUserRole()` helper |
| `packages/web/tests/unit/lib/auth.test.ts` | New: 5 unit tests for `getUserRole()` |

## Out of Scope

- API package test expansion (separate spec)
- E2E tests for the auth flow
- Middleware unit tests (deferred to later phase)
