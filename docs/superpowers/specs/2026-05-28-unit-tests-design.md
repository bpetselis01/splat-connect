# Unit Test Coverage — Design Spec
**Date:** 2026-05-28
**Scope:** Fill all unit test gaps across `packages/api` and `packages/web`; wire tests into CI on every branch.

---

## Context

Two bugs were recently fixed in the file-upload flow:

1. **Deferred upload** — `EditFilesSection` was uploading files to Supabase Storage immediately on file selection, before the user clicked Save. Files now stay as `File` objects in state until Save is clicked.
2. **Delete-before-upload** — the photo upload route used a dynamic extension in the storage path (`photo.jpg`, `photo.png`, etc.), so replacing a photo with a different format left the old file in the bucket. The route now deletes all existing files under the tutorial's photo folder before uploading the new one.

Neither behaviour is protected by tests today. This spec covers both, plus all other unit test gaps found across the codebase.

**Important limitation:** unit tests mock Supabase entirely. They protect application-level logic but cannot catch missing RLS policies or storage bucket misconfigurations — those require integration tests (out of scope here).

---

## Approach

Option A: extend existing Vitest mock patterns exactly as used today. No new test infrastructure, no shared mock factories, no MSW. All tests use `vi.mock` at module level and `@testing-library/react` + `userEvent` for component tests.

---

## Files Changed

### New file
- `packages/web/tests/unit/components/edit-files-section.test.tsx`

### Updated test files
- `packages/api/tests/unit/routes/upload.test.ts`
- `packages/api/tests/unit/routes/tutorials.test.ts`
- `packages/api/tests/unit/routes/admin.test.ts`
- `packages/api/tests/unit/routes/contributors.test.ts`
- `packages/api/tests/unit/routes/parts.test.ts`
- `packages/api/tests/unit/routes/tools.test.ts`
- `packages/api/tests/unit/routes/stl-files.test.ts`
- `packages/web/tests/unit/lib/validation.test.ts`

### Updated CI
- `.github/workflows/ci.yml`

---

## Section 1 — `upload.test.ts` (photo + STL routes)

The existing file mocks only `createUserClient`. The photo route now also calls `createAdminClient` (for list/delete), so both must be mocked.

### Mock structure

```
mockAdminStorage  → { list: vi.fn(), remove: vi.fn() }
mockAdminClient   → { storage: { from: () => mockAdminStorage } }

mockUserStorage   → { upload: vi.fn(), getPublicUrl: vi.fn() }
mockUserClient    → { storage: { from: () => mockUserStorage } }
```

Both mocked at module level via `vi.mock`. `beforeEach` clears all mocks and resets to happy-path defaults.

### `describe('POST /photo')` — 6 cases

| # | Input | Expected |
|---|---|---|
| 1 | No `file` field | 400 |
| 2 | No `tutorialId` field | 400 |
| 3 | `list()` returns existing files | `remove()` called with correct paths, then `upload()` called |
| 4 | `list()` returns empty array | `remove()` is **not** called, `upload()` still called |
| 5 | `upload()` returns error | 500 |
| 6 | Happy path | 200, response body contains `{ url }` |

### `describe('POST /stl')` — 4 cases

| # | Input | Expected |
|---|---|---|
| 1 | No `file` field | 400 |
| 2 | No `tutorialId` field | 400 |
| 3 | `upload()` returns error | 500 |
| 4 | Happy path | 200, response body contains `{ url, filename }` |

The existing `describe('POST /pdf')` tests (3 cases) remain unchanged as a regression guard.

---

## Section 2 — `edit-files-section.test.tsx` (new file)

Mocks `@/lib/browser-api-client` so `postFormData` is a spy. The `onSave` prop is a `vi.fn()` that resolves immediately. Uses RTL `render` + `fireEvent` (already in `@testing-library/react` — no new dependency needed).

**Key pattern for file selection:**
```ts
const input = container.querySelector('input[name="toy_photo"]') as HTMLInputElement
fireEvent.change(input, {
  target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
})

### Test cases — 9 cases

| # | Action | Expected |
|---|---|---|
| 1 | Render with no file selected | Save button is disabled |
| 2 | Select photo only | Save button is enabled |
| 3 | Select PDF only | Save button is enabled |
| 4 | Select photo | `postFormData` is **not** called |
| 5 | Select PDF | `postFormData` is **not** called |
| 6 | Select photo, click Save | `postFormData` called with `/api/upload/photo` |
| 7 | Select PDF, click Save | `postFormData` called with `/api/upload/pdf` |
| 8 | Select both, click Save | `onSave` called with correct URLs from upload responses |
| 9 | Save succeeds | Save button disabled again (files cleared) |

---

## Section 3 — Gaps in existing test files

### `tutorials.test.ts` — 3 new cases

- `GET /mine` happy path — returns tutorial list filtered to current user
- `POST /` unapproved user (`approved = false`) — returns 403
- `POST /` idempotent retry (Supabase error code `23505`) — returns 200 with `{ id }`

### `admin.test.ts` — 5 new cases

- `GET /contributors` happy path — returns contributor list
- `GET /contributors` DB error — returns 500
- `PATCH /contributors/:id/approve` happy path — returns updated profile
- `DELETE /contributors/:id` happy path — returns 204
- `PATCH /tutorials/:id/status` with `rejection_note` — asserts note is included in update payload

### `contributors.test.ts` — 3 new cases

- `POST /me/tutorials/:tutorialId` success — returns 201
- `POST /me/tutorials/:tutorialId` idempotent retry (`23505`) — returns 200
- `POST /me/tutorials/:tutorialId` DB error — returns 500

### `validation.test.ts` — 6 new cases (for `getMissingFields`)

- All fields present — returns `[]`
- Missing title — includes `'Title'`
- Missing `tutorial_pdf_url` — includes `'Tutorial PDF'`
- Missing `toy_photo_url` — includes `'Toy photo'`
- Empty `parts` — includes `'At least one part'`
- Empty `tools` — includes `'At least one tool'`

### `parts.test.ts`, `tools.test.ts`, `stl-files.test.ts` — 2 new cases each

- POST DB error — returns 500
- DELETE DB error — returns 500

---

## Section 4 — CI pipeline

Two changes to `.github/workflows/ci.yml`:

### 1. Run on all branches

Change:
```yaml
on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]
```

To:
```yaml
on:
  push:
  pull_request:
```

### 2. Add `test` job

Runs in parallel with the existing `check` (type-check) job. Same setup steps (checkout, pnpm, Node 22, install). Then:

```yaml
- name: Test API
  run: pnpm --filter @splat-connect/api test:unit

- name: Test Web
  run: pnpm --filter @splat-connect/web test:unit
```

---

## Summary of test counts

| File | New cases |
|---|---|
| `upload.test.ts` | +10 (6 photo, 4 STL) |
| `edit-files-section.test.tsx` | +9 (new file) |
| `tutorials.test.ts` | +3 |
| `admin.test.ts` | +5 |
| `contributors.test.ts` | +3 |
| `validation.test.ts` | +6 |
| `parts.test.ts` | +2 |
| `tools.test.ts` | +2 |
| `stl-files.test.ts` | +2 |
| **Total** | **+42** |
