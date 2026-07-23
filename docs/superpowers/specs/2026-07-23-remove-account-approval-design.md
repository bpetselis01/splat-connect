# Remove Account-Approval Gate — Design Spec

## Purpose

Contributors currently cannot upload tutorials until an admin manually approves their account (`profiles.approved`). This gate is being removed entirely: any signed-up contributor can act immediately. This is separate from tutorial content moderation (`tutorials.status`: draft → pending → approved/rejected), which is unaffected and stays exactly as-is.

## Scope

- **In scope:** the `profiles.approved` account gate — DB function/RLS, API enforcement, web UI/redirects.
- **Out of scope:** `tutorials.status` review workflow, mobile app (confirmed unaffected — mobile signup always uses `role: 'parent'`, which `is_approved_contributor()` never grants regardless of `approved`), backfilling existing `approved: false` rows (the column stays in the schema but nothing reads it after this change, so stale values are harmless).

## Database

Redefine `public.is_approved_contributor()` (currently `role = 'contributor' AND approved = true`) to check only `role = 'contributor'`. Keeping the function's name and signature means the ~13 RLS policies that call it — tutorial insert, `tutorial_contributors` insert, and the 3 storage buckets' upload/update policies across `001_schema.sql` and `002_storage_update_policies.sql` — need no changes; they inherit the new behavior automatically.

The `approved` column is left in place, unused. Dropping it would require touching every `select('*')`/`select('role, approved')` call site for no functional benefit.

## API (`packages/api/src`)

- `routes/tutorials.ts:94-95` — remove the explicit `if (!c.get('approved')) return 403(...)` check. This is the only app-level enforcement point; everything else is DB RLS via `is_approved_contributor()`.
- `middleware/auth.ts` — no change. `approved` stays on `AuthVariables`/context as harmless passthrough (still returned by `contributors.ts` GET `/me`).
- `routes/admin.ts`:
  - Remove `PATCH /contributors/:id/approve` — nothing left to approve.
  - Keep `GET /contributors` — still used by the admin UI to list accounts.
  - Keep `DELETE /contributors/:id` — repurposed as a general "admin can delete a contributor account" moderation tool, not a rejection step.
- Stale doc comments describing the old approval workflow (`admin.ts`, `contributors.ts`, `upload.ts` headers) get corrected.

## Web (`packages/web`)

- Delete `app/pending/page.tsx`.
- `middleware.ts` — remove the `profiles.approved` lookup and the redirect-to-`/pending` branch for contributor routes (`/upload`, `/my-tutorials`, `/dashboard`); these routes now only need auth + being signed in.
- `app/login/page.tsx` — remove the `profile.approved ? '/dashboard' : '/pending'` branch; login always redirects to `/dashboard`.
- `app/signup/page.tsx` — update copy that says "...able to log in and upload tutorials once approved" to drop the approval mention.
- `app/admin/contributors/page.tsx` — remove the pending/approve section and approve button; becomes a flat contributor list retaining the existing delete action.
- `app/admin/page.tsx` — remove the `!approved` pending-count stat.
- `app/dashboard/page.tsx` — stale comment cleanup only, no logic change.

## Testing

- API integration tests currently asserting the approval gate — `role-assignment.test.ts`, `upload.test.ts`, the `tutorials`/`parts-tools` RLS suites, `status-flow.test.ts` — get their blocked-because-unapproved assertions removed or flipped to "unapproved contributors act normally now."
- Web unit tests touching `/pending`, the login redirect, and the admin/contributors approve button get updated or removed to match.
- Exact file/line changes are enumerated in the implementation plan.
