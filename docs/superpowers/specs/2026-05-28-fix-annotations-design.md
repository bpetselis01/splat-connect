# Fix Annotations Design

## Goal

Add plain-English inline comments to every successful bug fix in the repository. Each comment explains why the fix was needed and, where relevant, how it connects to the rest of the system. No logic is changed — only comments are added.

---

## Comment Format

**TypeScript / TSX / test files:**
```ts
// WHY: [why the fix was needed — what broke without it]
// HOW: [how it connects to the rest of the system]  ← only when not obvious
<the changed line>
```

**SQL migration files:**
```sql
-- WHY: [reason]
-- HOW: [system interaction]  ← only when not obvious
<the changed statement>
```

**tsconfig.json** (supports `//` comments as JSONC):
```jsonc
// WHY: [reason]
"the changed field"
```

**Placement:** The comment goes immediately above the specific changed line or the first line of a changed block. Never at end-of-line.

---

## Language Guidelines

- Plain English — one sentence per line
- Write for someone who can read code but doesn't know the framework internals
- Avoid jargon: "re-render", "DOM node", "RLS policy", "idempotent", "middleware matcher", "hydration"
- Prefer plain words: "rebuild", "page element", "database permission", "safe to run twice", "runs on every page load"

---

## Scope — Files to Annotate

### Web (TypeScript / TSX)

| File | Fix commit(s) | What changed |
|------|--------------|-------------|
| `packages/web/app/tutorials/[id]/edit/page.tsx` | `6604887`, `aecb94a` | Stale difficulty dropdown fix; incorrect difficulty option values |
| `packages/web/components/edit-files-section.tsx` | `42fc1e5` | File uploads deferred until Save is clicked |
| `packages/web/middleware.ts` | `79f752b` | Auth token refresh now runs on all routes, not just 4 |
| `packages/web/lib/auth.ts` | `197ca75` | Role type guard and profile error check added |
| `packages/web/lib/browser-api-client.ts` | `af1273e` | Empty API responses handled safely; error detail included |
| `packages/web/app/upload/page.tsx` | `54def54` | Guard prevents double-submit creating duplicate tutorials |
| `packages/web/app/login/page.tsx` | `384838a` | Router state refreshed before redirect after login |

### API (TypeScript)

| File | Fix commit(s) | What changed |
|------|--------------|-------------|
| `packages/api/src/routes/upload.ts` | `ef3ef82` | Old photo deleted before new upload to avoid duplicate files |
| `packages/api/src/routes/tutorials.ts` | `129f645`, `d9035b6` | Unapproved contributors blocked from creating tutorials; PATCH reverted to user client after DB permission fix |
| `packages/api/src/routes/contributors.ts` | `1c484ad` | Duplicate contributor insert handled gracefully |

### SQL Migrations

| File | Fix commit | What changed |
|------|-----------|-------------|
| `supabase/migrations/001_schema.sql` | `07c2ae2` | Storage UPDATE policies added so file re-uploads work |
| `supabase/migrations/002_storage_update_policies.sql` | `6d828a1` | Same policies applied to the live database without re-running migration 001 |
| `supabase/migrations/005_allow_contributor_edits_on_any_status.sql` | `1b10dfa` | Database permission corrected so contributors can edit tutorials at any stage |
| `supabase/migrations/006_align_sub_resource_policies.sql` | `05e3850` | Write permissions for parts, tools, and STL files aligned with the tutorial permission model |

### Test Files

| File | Fix commit | What changed |
|------|-----------|-------------|
| `packages/api/tests/unit/routes/parts.test.ts` | `496122b` | Mock typed loosely so it can return different shapes in different tests |
| `packages/api/tests/unit/routes/tools.test.ts` | `496122b` | Same as above |
| `packages/api/tests/unit/routes/stl-files.test.ts` | `496122b` | Same as above |

### Config

| File | Fix commit | What changed |
|------|-----------|-------------|
| `packages/api/tsconfig.json` | `4a5a752` | Node.js types added so `process.env` is recognised |
| `packages/web/tsconfig.json` | `4a5a752` | Same |

---

## What Is Not Annotated

- Commits marked `feat`, `refactor`, `test`, `docs`, `chore`, `ci` — not bug fixes
- The `d9035b6` workaround (admin client for PATCH) no longer exists in the codebase — the comment for this fix goes on the *current* user-client call, explaining that the DB permission was fixed and no workaround is needed
- SQL migration files `003` and `004` (not part of a fix commit)

---

## Commit Strategy

Each file gets its own commit. Commit message format:

```
docs(annotations): add fix comments to <short file name>
```

Example: `docs(annotations): add fix comments to middleware.ts`

---

## Out of Scope

- No logic, formatting, or structure changes to any file
- No new files created
- No existing comments removed or reworded
