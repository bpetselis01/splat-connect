# Unit Test Gaps — Design Spec
**Date:** 2026-05-29  
**Scope:** Fill all untested and partially-tested code in the splat-connect monorepo

---

## Context

Two recent features left coverage gaps:

1. **Nav/login auth fix** — `nav.tsx` sign-out now uses `window.location.href`; the existing test still mocks the removed `useRouter` dependency and never tests the sign-out interaction.
2. **Upload wizard rewrite** — `upload/page.tsx` now saves each step incrementally to Supabase. The page has zero test coverage. Its supporting client, `browser-api-client.ts`, is also completely untested.

Minor API test gaps (missing 500 paths) and missing `api-client.ts` method coverage were also found.

---

## Files Changed

| File | Action | New tests |
|---|---|---|
| `web/tests/unit/lib/browser-api-client.test.ts` | **create** | 8 |
| `web/tests/unit/components/nav.test.tsx` | **modify** | +4 |
| `web/tests/unit/components/upload-page.test.tsx` | **create** | 11 |
| `web/tests/unit/lib/api-client.test.ts` | **modify** | +4 |
| `api/tests/unit/routes/tutorials.test.ts` | **modify** | +2 |

**Total: ~29 new tests**

---

## Design

### 1. `browser-api-client.test.ts` (new)

**Mocks:** `fetch` via `vi.fn()` on `global.fetch`; `createClient` from `@/lib/supabase/client` returning a mock Supabase session; `process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001'` set in `beforeEach`.

**Tests:**
1. `get` — attaches `Authorization: Bearer <token>` header, returns parsed JSON
2. `post` — sends JSON body with `Content-Type: application/json`
3. `patch` — sends JSON body with correct method
4. `delete` — sends DELETE with no body
5. `postFormData` — omits `Content-Type` header (browser sets it with multipart boundary), sends FormData
6. Error with detail — non-ok response body `{"error":"some message"}` → thrown error message includes that detail
7. 204 / empty body — returns `null` without throwing
8. Missing token — no `Authorization` header when Supabase session is null

---

### 2. `nav.test.tsx` (modify)

**Cleanup:** Remove stale `useRouter` mock — `nav.tsx` no longer imports `useRouter` after the sign-out fix.

**Add to existing `describe('Nav')`:**
- `role=null` renders "Contribute" link, no "Sign out" button
- `role='contributor'` renders "Sign out" button, no "Contribute" link
- Clicking "Sign out" calls `supabase.auth.signOut()`
- Clicking "Sign out" sets `window.location.href = '/'` (tested via `vi.stubGlobal`)

---

### 3. `web/tests/unit/components/upload-page.test.tsx` (new)

**Mocks:**
- `browserApiClient` — all methods as `vi.fn()` returning resolved promises via `vi.mock('@/lib/browser-api-client', ...)`
- `crypto.randomUUID` — stubbed to return `'test-id'` so assertions have a known tutorial ID
- `window.location` — `vi.stubGlobal('location', { href: '' })` so `href` assignments are inspectable

**Helper:** `advanceToStep(n, overrides?)` — drives the wizard to step `n` by filling minimum required fields (title + difficulty for step 1; mock PDF/photo URLs for step 2; one part for step 3; one tool for step 4) and clicking Next for each step. Keeps individual tests concise.

**Tests:**

| # | Description |
|---|---|
| 1 | Step 1 Next (first time) → calls `POST /api/tutorials` + `POST .../contributors/me/tutorials/test-id`, renders step 2 |
| 2 | Step 1 Next (after going back) → calls `PATCH /api/tutorials/test-id` instead of `POST` |
| 3 | Step 2 Next → calls `PATCH /api/tutorials/test-id` with `tutorial_pdf_url` + `toy_photo_url` |
| 4 | Step 3 Next → calls `POST /api/tutorials/test-id/parts` with parts array |
| 5 | Step 4 Next → calls `POST /api/tutorials/test-id/tools` with tools array |
| 6 | Step 5 Next (with STL files in draft) → calls `POST /api/tutorials/test-id/stl-files` |
| 7 | Step 5 Next (no STL files) → does NOT call the stl-files endpoint |
| 8 | Step 6 Submit → calls only `PATCH /api/tutorials/test-id {status:'pending'}`, sets `window.location.href = '/my-tutorials'` |
| 9 | Error handling → when API call rejects, error message is rendered on screen |
| 10 | Saving state → Next button shows "Saving…" and `disabled` during the API call |
| 11 | canAdvance gate → Next button is disabled when step 1 title is empty |

**Note on test 2 (draftSaved branching):** Drive to step 2 (triggering the first POST), click Back, then click Next again — assert PATCH was called rather than a second POST.

**Note on test 10 (saving state):** Mock the API call with a deferred promise; assert the button label and disabled state before resolving.

---

### 4. `api-client.test.ts` (modify)

Add to the existing `describe('apiClient')`:
- `patch` — sends correct method + JSON body
- `delete` — sends DELETE, no body
- 204 empty-body response — returns `null` without throwing
- Error detail extraction — `fetch` returns `{ok: false, status: 403, json: () => ({error: 'Forbidden'})}` → thrown message contains `"Forbidden"`

---

### 5. `tutorials.test.ts` (modify)

Add to existing `describe` blocks:
- `GET /mine` returns 500 on DB error
- `PATCH /:id` returns 500 on DB error

---

## Test Style Conventions (from existing codebase)

- Vitest (`describe`, `it`, `expect`, `vi`, `beforeEach`)
- `@testing-library/react` for component tests (`render`, `screen`, `fireEvent`)
- `vi.clearAllMocks()` in `beforeEach` for all API route tests
- Mock Supabase clients at module level, set return values per-test or in `beforeEach`
- No snapshot tests — assert on specific rendered text and API calls
