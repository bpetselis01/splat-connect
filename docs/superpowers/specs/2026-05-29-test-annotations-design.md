# Test Annotation Design
**Date:** 2026-05-29  
**Scope:** Add inline comments to all 21 unit test files in `packages/api` and `packages/web`

---

## Goal

Add plain-English comments to every test file so that a reader can understand — without prior codebase knowledge — what each test is checking, how it works mechanically, and how the code being tested fits into the broader app when the test passes.

---

## Comment Format

### Mock setup block
A single labelled comment above the `vi.mock()` / mock variable declarations at the top of each file:

```ts
// --- Mock strategy ---
// [One or two sentences explaining why these fakes exist and what they stand in for]
```

### Individual `it()` tests
A 3-line structured comment directly above every `it()` call:

```ts
// Tests: [what behaviour is being checked — one plain-English phrase]
// How:   [what mock/action/assertion drives the test]
// Chain: [what the code does when it passes → one level further downstream]
it('...', async () => {
```

### Placement rules
- Comments go **above** the `it()` call, never inside the body
- `describe()` blocks get no comment — the name provides grouping context
- `beforeEach()` blocks get no comment
- Line wrap at ~100 chars; continuation lines align with the text after `//`
- No `describe()` or `beforeEach()` annotations

### Chain depth
Two sentences: the immediate neighbour + one level further. Example:

> Chain: the middleware sets `userId` and `role` on the request context → every protected route  
>        handler reads these values to decide what data to fetch or return

---

## File Inventory (21 files)

### API package — `packages/api/tests/unit/`

| File | Tests | Chain story |
|------|-------|-------------|
| `middleware/auth.test.ts` | ~7 | Sets auth context that every route handler reads |
| `routes/tutorials.test.ts` | 12 | Controls tutorial data returned to the web layer |
| `routes/parts.test.ts` | varies | Controls parts data returned to the web layer |
| `routes/tools.test.ts` | varies | Controls tools data returned to the web layer |
| `routes/stl-files.test.ts` | varies | Controls STL file data returned to the web layer |
| `routes/upload.test.ts` | varies | Controls file upload handling and storage URLs |
| `routes/admin.test.ts` | varies | Controls admin approval actions on tutorials |
| `routes/contributors.test.ts` | varies | Controls contributor profile data |

### Web package — `packages/web/tests/unit/`

| File | Tests | Chain story |
|------|-------|-------------|
| `lib/browser-api-client.test.ts` | 8 | Client-side fetch wrapper used by all upload/edit UI interactions |
| `lib/api-client.test.ts` | 7 | Server-side fetch wrapper used by Next.js server components |
| `lib/validation.test.ts` | varies | Validates user input before it reaches the API |
| `components/nav.test.tsx` | 9 | Controls what navigation links render based on user role |
| `components/upload-page.test.tsx` | 11 | Drives the 6-step upload wizard and draft saving flow |
| `components/buy-links-input.test.tsx` | varies | Manages buy-link entries on the tutorial edit form |
| `components/difficulty-badge.test.tsx` | varies | Renders the difficulty label on tutorial cards |
| `components/tutorial-card.test.tsx` | varies | Renders individual tutorial cards in the library |
| `components/file-drop-zone.test.tsx` | varies | Handles file selection for STL/image uploads |
| `components/edit-files-section.test.tsx` | varies | Manages file attachments on the tutorial edit form |
| `components/edit-parts-section.test.tsx` | varies | Manages parts list on the tutorial edit form |
| `components/edit-tools-section.test.tsx` | varies | Manages tools list on the tutorial edit form |

---

## Commit Strategy

- **One commit per file** — 21 commits total
- Commit message format: `docs(tests): annotate <filename>`
  - Example: `docs(tests): annotate auth.test.ts`
- Order: API files first (middleware → routes), then web lib files, then web component files
- No production code is touched — only test files receive changes

---

## Out of Scope

- No changes to `describe()` blocks
- No changes to `beforeEach()` blocks
- The mock-strategy comment is added above `vi.mock()` / mock variable declarations — not above `beforeEach()`
- No changes to production source files
- No new tests added
- No refactoring of existing test structure

---

## Success Criteria

A reader unfamiliar with the codebase can open any test file and, by reading only the comments, understand:
1. Why the mocks exist
2. What each individual test is verifying
3. How the tested code connects to adjacent parts of the app
