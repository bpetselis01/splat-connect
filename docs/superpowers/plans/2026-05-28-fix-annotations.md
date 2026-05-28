# Fix Annotations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add plain-English WHY/HOW inline comments to every successful bug fix in the repository, one commit per file.

**Architecture:** No code changes — comments only. Each task targets one file, adds one or more WHY/HOW comment blocks above the fixed lines, then commits. Where a WHY/HOW comment already exists in developer-speak, the new plain-English comment is inserted above it (the existing comment is left untouched).

**Tech Stack:** TypeScript, TSX, SQL (PostgreSQL/Supabase), JSONC (tsconfig). Comment syntax: `//` for TS/TSX/JSONC, `--` for SQL.

---

## Comment format

```ts
// WHY: [why the fix was needed — what broke without it]
// HOW: [how it connects to the rest of the system]  ← only when not obvious
```

SQL equivalent uses `--`. HOW line is optional if the interaction is obvious from context.

---

### Task 1: edit/page.tsx — difficulty dropdown + option values

**Files:**
- Modify: `packages/web/app/tutorials/[id]/edit/page.tsx`

- [ ] **Step 1: Add comment above the `<select>` element (line ~145)**

Add the following immediately above `<select key={tutorial!.difficulty}`:

```tsx
{/* WHY: After saving details, the difficulty dropdown shows the old selection
         instead of the newly saved one.
    HOW: The key prop forces the dropdown to rebuild from scratch whenever
         the saved difficulty changes, picking up the fresh value. */}
```

- [ ] **Step 2: Add comment above the first `<option>` (line ~146)**

Add the following immediately above `<option value="easy">`:

```tsx
{/* WHY: The old values ("beginner", "intermediate", "advanced") didn't match
         the database — saves were silently ignored by the check constraint.
    HOW: The database only accepts "easy", "medium", or "hard" for difficulty. */}
```

- [ ] **Step 3: Verify**

Run: `git diff packages/web/app/tutorials/\\[id\\]/edit/page.tsx`
Expected: two comment blocks added, no other changes.

- [ ] **Step 4: Commit**

```bash
git add "packages/web/app/tutorials/[id]/edit/page.tsx"
git commit -m "docs(annotations): add fix comments to edit/page.tsx"
```

---

### Task 2: edit-files-section.tsx — defer uploads until Save

**Files:**
- Modify: `packages/web/components/edit-files-section.tsx`

- [ ] **Step 1: Add comment above the file state declarations (line ~17)**

Add the following immediately above `const [photoFile, setPhotoFile] = useState<File | null>(null)`:

```tsx
// WHY: Previously, picking a file immediately uploaded it to cloud storage —
//      files were being saved even if the user cancelled or changed their mind.
// HOW: Files are held in memory as File objects and only uploaded when the
//      Save button is clicked.
```

- [ ] **Step 2: Verify**

Run: `git diff packages/web/components/edit-files-section.tsx`
Expected: one comment block added, no other changes.

- [ ] **Step 3: Commit**

```bash
git add packages/web/components/edit-files-section.tsx
git commit -m "docs(annotations): add fix comments to edit-files-section.tsx"
```

---

### Task 3: middleware.ts — expand matcher to all routes

**Files:**
- Modify: `packages/web/middleware.ts`

- [ ] **Step 1: Add comment above the `matcher` config line (line ~101)**

Add the following immediately above `matcher: ['/((?!_next/static|...`:

```ts
// WHY: With only 4 routes listed, the auth session cookie wasn't refreshed on
//      other pages (e.g. the home page), so users could be silently logged out.
// HOW: This pattern runs the middleware on every page except static assets,
//      keeping the session cookie fresh across the whole app.
```

- [ ] **Step 2: Verify**

Run: `git diff packages/web/middleware.ts`
Expected: one comment block added, no other changes.

- [ ] **Step 3: Commit**

```bash
git add packages/web/middleware.ts
git commit -m "docs(annotations): add fix comments to middleware.ts"
```

---

### Task 4: auth.ts — role type guard and profile error check

**Files:**
- Modify: `packages/web/lib/auth.ts`

- [ ] **Step 1: Add comment above the `profileError` check (line ~33)**

Add the following immediately above `if (profileError) return null`:

```ts
// WHY: A failed database lookup or an unexpected value in the role column
//      would slip through and look like a valid login.
// HOW: Returns null for any error or unrecognised role so callers treat the
//      user as "not logged in" rather than granting access.
```

- [ ] **Step 2: Verify**

Run: `git diff packages/web/lib/auth.ts`
Expected: one comment block added, no other changes.

- [ ] **Step 3: Commit**

```bash
git add packages/web/lib/auth.ts
git commit -m "docs(annotations): add fix comments to auth.ts"
```

---

### Task 5: browser-api-client.ts — empty responses + error detail

**Files:**
- Modify: `packages/web/lib/browser-api-client.ts`

The fix was applied in two identical places: the `request` function (lines ~54–60) and the `requestFormData` function (lines ~72–78). Add the same two comment blocks in both places.

- [ ] **Step 1: Add error-detail comment in `request` function (line ~55)**

Add the following immediately above `let detail = ''` inside `if (!res.ok)` in the `request` function:

```ts
// WHY: Error messages from the API were being lost — you'd see "failed with
//      status 400" but not the reason why.
// HOW: Reads the response body for an error field and appends it to the
//      thrown error so the cause is visible in logs and error messages.
```

- [ ] **Step 2: Add empty-body comment in `request` function (line ~59)**

Add the following immediately above `const text = await res.text()` in the `request` function:

```ts
// WHY: Some API responses have no body (e.g. 204 No Content), which caused
//      JSON.parse to fail on an empty string and throw an unrelated error.
```

- [ ] **Step 3: Repeat both comments in `requestFormData` function**

Add the same two comments at the same relative positions inside `requestFormData` (above `let detail = ''` and above `const text = await res.text()`).

- [ ] **Step 4: Verify**

Run: `git diff packages/web/lib/browser-api-client.ts`
Expected: four comment blocks added (two per function), no other changes.

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/browser-api-client.ts
git commit -m "docs(annotations): add fix comments to browser-api-client.ts"
```

---

### Task 6: upload/page.tsx — idempotent submit guard

**Files:**
- Modify: `packages/web/app/upload/page.tsx`

- [ ] **Step 1: Add comment above the `tutorialCreated` state (line ~78)**

Add the following immediately above `const [tutorialCreated, setTutorialCreated] = useState(false)`:

```ts
// WHY: If the submit fails halfway through, hitting Submit again would try to
//      create the tutorial a second time, causing a duplicate error.
// HOW: Flags track which steps have already completed so a retry picks up
//      where it left off instead of starting from the beginning.
```

- [ ] **Step 2: Verify**

Run: `git diff packages/web/app/upload/page.tsx`
Expected: one comment block added, no other changes.

- [ ] **Step 3: Commit**

```bash
git add packages/web/app/upload/page.tsx
git commit -m "docs(annotations): add fix comments to upload/page.tsx"
```

---

### Task 7: login/page.tsx — router.refresh() before redirect

**Files:**
- Modify: `packages/web/app/login/page.tsx`

- [ ] **Step 1: Add comment above `router.refresh()` (line ~60)**

Add the following immediately above `router.refresh()`:

```ts
// WHY: Without this, the page's cached server data (including the login session)
//      was stale, so the redirect sometimes landed on a page that still showed
//      the logged-out state.
// HOW: Forces the page data to reload before navigating, so the destination
//      page sees the fresh login session immediately.
```

- [ ] **Step 2: Verify**

Run: `git diff packages/web/app/login/page.tsx`
Expected: one comment block added, no other changes.

- [ ] **Step 3: Commit**

```bash
git add packages/web/app/login/page.tsx
git commit -m "docs(annotations): add fix comments to login/page.tsx"
```

---

### Task 8: upload.ts (API) — delete photo before re-upload

**Files:**
- Modify: `packages/api/src/routes/upload.ts`

There is already a developer-facing comment at line ~84. Add the plain-English WHY/HOW immediately above it (do not remove the existing comment).

- [ ] **Step 1: Add comment above the existing comment block (line ~83, before the existing `// Delete every...` comment)**

Add the following immediately above the existing `// Delete every existing file...` comment:

```ts
// WHY: Uploading a new photo in a different format (e.g. switching from .jpg
//      to .png) left the old file sitting in storage because the filename
//      changed with the extension, creating two photos for the same tutorial.
// HOW: All files in the tutorial's photo folder are deleted before uploading
//      the new one, so there is always exactly one photo per tutorial.
```

- [ ] **Step 2: Verify**

Run: `git diff packages/api/src/routes/upload.ts`
Expected: one comment block added above the existing comment, no other changes.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routes/upload.ts
git commit -m "docs(annotations): add fix comments to upload.ts"
```

---

### Task 9: tutorials.ts (API) — approval gate + PATCH client + idempotent insert

**Files:**
- Modify: `packages/api/src/routes/tutorials.ts`

Three fixes land in this file. Add comments at three locations.

- [ ] **Step 1: Add comment above the approval check (line ~92)**

Add the following immediately above `if (!c.get('approved')) {`:

```ts
// WHY: Any logged-in user could create tutorials before an admin had approved
//      their account.
```

- [ ] **Step 2: Add comment above the duplicate-key handler (line ~112)**

There is already a `// 23505 = unique_violation` comment on this line. Add the WHY/HOW immediately above `if (error) {`:

```ts
// WHY: If the submit fails and the user retries, the same tutorial ID is sent
//      again, hitting a duplicate key error on the second insert.
// HOW: A duplicate key error means the tutorial was already created — return
//      success so the caller can continue with the remaining submit steps.
```

- [ ] **Step 3: Add comment above the PATCH user-client line (line ~122)**

Add the following immediately above `const supabase = createUserClient(c.get('token'))` inside `tutorials.patch`:

```ts
// WHY: A database permission bug previously blocked contributors from updating
//      tutorials, so a temporary admin connection was used as a workaround.
// HOW: The permission is now fixed in the database (migration 005 in
//      001_schema.sql), so the regular user connection works and correctly
//      enforces who can edit which tutorial.
```

- [ ] **Step 4: Verify**

Run: `git diff packages/api/src/routes/tutorials.ts`
Expected: three comment blocks added, no other changes.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/tutorials.ts
git commit -m "docs(annotations): add fix comments to tutorials.ts"
```

---

### Task 10: contributors.ts (API) — idempotent contributor link

**Files:**
- Modify: `packages/api/src/routes/contributors.ts`

There is already a `// 23505 = unique_violation: already linked (retry-safe)` comment inside the error block. Add the WHY/HOW above the `if (error)` block (do not remove the existing comment).

- [ ] **Step 1: Add comment above `if (error) {` (line ~61)**

Add the following immediately above `if (error) {`:

```ts
// WHY: If the tutorial submit fails midway, the user retries and this endpoint
//      is called again with the same tutorial, causing a duplicate link error.
// HOW: A duplicate key error means the link already exists — return success so
//      the rest of the submit can continue.
```

- [ ] **Step 2: Verify**

Run: `git diff packages/api/src/routes/contributors.ts`
Expected: one comment block added, no other changes.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routes/contributors.ts
git commit -m "docs(annotations): add fix comments to contributors.ts"
```

---

### Task 11: 001_schema.sql — storage UPDATE policies + tutorial update policy + sub-resource policies

**Files:**
- Modify: `supabase/migrations/001_schema.sql`

Three separate fixes were squashed into this file. Three comment blocks to add.

- [ ] **Step 1: Add comment above tutorial update policy (line ~154)**

There is already a developer comment at line 154–155. Add the plain-English WHY/HOW immediately above it (before the existing `-- USING has no status gate...` comment):

```sql
-- WHY: Contributors were blocked from editing their own tutorials once the
--      status changed away from "draft" or "rejected" — even to fix mistakes
--      in a pending or approved tutorial.
-- HOW: The permission check no longer restricts which status a tutorial can be
--      in for an edit to be allowed. It only prevents contributors from
--      setting the status to "approved" — that is reserved for admins.
```

- [ ] **Step 2: Add comment above tutorial delete policies (line ~174)**

Add the following immediately above `create policy "Contributors can delete own draft tutorials"`:

```sql
-- WHY: There was no permission to delete tutorials, so the delete API endpoint
--      always failed silently.
-- HOW: Contributors can delete their own draft tutorials; admins can delete any.
```

- [ ] **Step 3: Add comment above parts write policy (line ~216)**

Add the following immediately above `create policy "Contributors can write own tutorial parts"`:

```sql
-- WHY: Contributors could edit tutorial details at any status, but were still
--      blocked from changing parts, tools, or STL files on pending or approved
--      tutorials — the sub-resource permissions hadn't been updated to match.
-- HOW: The write permission for parts, tools, and STL files now follows the same
--      rule as the tutorial permission: any contributor who owns the tutorial
--      can modify its contents regardless of status.
```

- [ ] **Step 4: Add same comment above tools write policy (line ~248)**

Add the same comment block immediately above `create policy "Contributors can write own tutorial tools"`.

- [ ] **Step 5: Add same comment above stl_files write policy (line ~280)**

Add the same comment block immediately above `create policy "Contributors can write own tutorial stl_files"`.

- [ ] **Step 6: Add comment above storage UPDATE policies (line ~328)**

Add the following immediately above `create policy "Authenticated update tutorial-pdfs"`:

```sql
-- WHY: Re-uploading a file failed with a permission error because the database
--      had permission to create new files but not to replace existing ones.
--      When a file already exists at a path, the upload is treated as an update.
-- HOW: These three policies give approved contributors permission to replace
--      existing files in each storage bucket.
```

- [ ] **Step 7: Verify**

Run: `git diff supabase/migrations/001_schema.sql`
Expected: six comment blocks added, no other changes.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/001_schema.sql
git commit -m "docs(annotations): add fix comments to 001_schema.sql"
```

---

### Task 12: 002_storage_update_policies.sql — live-database companion migration

**Files:**
- Modify: `supabase/migrations/002_storage_update_policies.sql`

There are already developer-facing comments at the top (lines 1–9). Add the plain-English WHY/HOW immediately above them (as the very first lines of the file).

- [ ] **Step 1: Add comment at the top of the file (before the existing comments)**

Insert the following as the first two lines of the file:

```sql
-- WHY: The fix in 001_schema.sql only affects new databases. This migration
--      applies the same "replace file" permissions to an already-running database.
-- HOW: Run this once against the live Supabase instance. Do not run it twice —
--      it will fail with "policy already exists" if run again.
```

- [ ] **Step 2: Verify**

Run: `git diff supabase/migrations/002_storage_update_policies.sql`
Expected: four comment lines added at the top, no other changes.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_storage_update_policies.sql
git commit -m "docs(annotations): add fix comments to 002_storage_update_policies.sql"
```

---

### Task 13: parts.test.ts — untyped vi.fn() mocks

**Files:**
- Modify: `packages/api/tests/unit/routes/parts.test.ts`

- [ ] **Step 1: Add comment above the mock declarations (line ~5)**

Add the following immediately above `const mockDeleteParts = vi.fn()`:

```ts
// WHY: Declaring mocks with a fixed return shape at the top prevented individual
//      tests from overriding what the mock returns for error-path scenarios —
//      the fixed shape always won.
// HOW: Mocks are declared without a return shape here. Each test group sets
//      its own default in beforeEach so individual tests can override freely.
```

- [ ] **Step 2: Verify**

Run: `git diff packages/api/tests/unit/routes/parts.test.ts`
Expected: one comment block added, no other changes.

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/unit/routes/parts.test.ts
git commit -m "docs(annotations): add fix comments to parts.test.ts"
```

---

### Task 14: tools.test.ts — untyped vi.fn() mocks

**Files:**
- Modify: `packages/api/tests/unit/routes/tools.test.ts`

Same fix as Task 13 — same comment, same location.

- [ ] **Step 1: Add comment above the mock declarations**

Add the following immediately above the `const mockDeleteTools = vi.fn()` declaration (or equivalent mock at the top of the file):

```ts
// WHY: Declaring mocks with a fixed return shape at the top prevented individual
//      tests from overriding what the mock returns for error-path scenarios —
//      the fixed shape always won.
// HOW: Mocks are declared without a return shape here. Each test group sets
//      its own default in beforeEach so individual tests can override freely.
```

- [ ] **Step 2: Verify**

Run: `git diff packages/api/tests/unit/routes/tools.test.ts`
Expected: one comment block added, no other changes.

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/unit/routes/tools.test.ts
git commit -m "docs(annotations): add fix comments to tools.test.ts"
```

---

### Task 15: stl-files.test.ts — untyped vi.fn() mocks

**Files:**
- Modify: `packages/api/tests/unit/routes/stl-files.test.ts`

Same fix as Tasks 13 and 14.

- [ ] **Step 1: Add comment above the mock declarations**

Add the following immediately above the `const mockDeleteStlFiles = vi.fn()` declaration (or equivalent mock at the top of the file):

```ts
// WHY: Declaring mocks with a fixed return shape at the top prevented individual
//      tests from overriding what the mock returns for error-path scenarios —
//      the fixed shape always won.
// HOW: Mocks are declared without a return shape here. Each test group sets
//      its own default in beforeEach so individual tests can override freely.
```

- [ ] **Step 2: Verify**

Run: `git diff packages/api/tests/unit/routes/stl-files.test.ts`
Expected: one comment block added, no other changes.

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/unit/routes/stl-files.test.ts
git commit -m "docs(annotations): add fix comments to stl-files.test.ts"
```

---

### Task 16: packages/api/tsconfig.json — add Node.js types

**Files:**
- Modify: `packages/api/tsconfig.json`

- [ ] **Step 1: Add comment above the `"types": ["node"]` line (line ~13)**

Add the following immediately above `"types": ["node"]`:

```jsonc
// WHY: Without this, TypeScript didn't know about Node.js built-ins like
//      process.env, causing type errors in test files and server scripts.
```

- [ ] **Step 2: Verify**

Run: `git diff packages/api/tsconfig.json`
Expected: one comment line added, no other changes.

- [ ] **Step 3: Commit**

```bash
git add packages/api/tsconfig.json
git commit -m "docs(annotations): add fix comments to api/tsconfig.json"
```

---

### Task 17: packages/web/tsconfig.json — add Node.js types

**Files:**
- Modify: `packages/web/tsconfig.json`

Same fix as Task 16.

- [ ] **Step 1: Add comment above the `"types": ["node"]` line (line ~24)**

Add the following immediately above `"types": ["node"]`:

```jsonc
// WHY: Without this, TypeScript didn't know about Node.js built-ins like
//      process.env, causing type errors in web test files.
```

- [ ] **Step 2: Verify**

Run: `git diff packages/web/tsconfig.json`
Expected: one comment line added, no other changes.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tsconfig.json
git commit -m "docs(annotations): add fix comments to web/tsconfig.json"
```
