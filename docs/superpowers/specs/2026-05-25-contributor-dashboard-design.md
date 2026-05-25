# Contributor Dashboard Design

**Date:** 2026-05-25
**Project:** SPLAT Connect
**Status:** Approved

---

## Problem

After a contributor signs up and is approved, there is no usable contributor experience:

- Login always redirects to `/` with no role-aware routing
- No middleware gate for unapproved contributors — they can navigate directly to `/upload`
- No `/pending` page for contributors awaiting approval
- No dashboard home for contributors
- No way to edit a submitted tutorial (parts, tools, STL files, PDF, cover photo)

---

## Goals

1. Fix the auth/routing gaps so contributors land in the right place
2. Give approved contributors a dashboard home at `/dashboard`
3. Give contributors the ability to edit every section of a submitted tutorial
4. Ensure all edits are reflected in Supabase immediately
5. Re-submit tutorials for admin review when an already-approved tutorial is edited

---

## Architecture

**Pattern:** Server Components + Server Actions throughout — consistent with the existing admin pages. No new API routes. No client-side fetch state. Collapsible edit panels use native `<details>/<summary>` HTML (no JS needed).

**No new Supabase tables.** All data already exists across: `tutorials`, `tutorial_contributors`, `parts`, `tools`, `stl_files`.

---

## Section 1: Auth & Routing Fixes

### Post-login redirect (`app/login/page.tsx`)

After `signInWithPassword` succeeds, read the user's profile:
- `role === 'contributor'` → redirect to `/dashboard`
- `role === 'admin'` → redirect to `/admin`
- Otherwise → redirect to `/`

The login page does not check `approved` — that is the middleware's responsibility.

### Middleware (`middleware.ts`)

Add an `approved` gate for all contributor routes (`/dashboard`, `/upload`, `/my-tutorials`):

1. If no user → redirect to `/login` (existing behaviour)
2. If user exists on a contributor route → fetch profile
3. If `approved !== true` → redirect to `/pending`
4. If `role !== 'contributor'` on a contributor-only route → redirect to `/`

Update the matcher to include `/dashboard/:path*` and `/pending`.

**Flow for unapproved contributor after login:**
`/login` → redirects to `/dashboard` → middleware intercepts → redirects to `/pending`.

### New `/pending` page (`app/pending/page.tsx`)

Static server component. Message: account is pending admin approval. Link back to sign out. No auth check needed (publicly accessible).

---

## Section 2: Contributor Dashboard (`/dashboard`)

**File:** `app/dashboard/page.tsx` — server component.

**Access:** Middleware ensures only approved contributors reach this page.

### Layout

1. **Header row** — "Your Dashboard" heading + "Upload new tutorial" button (orange, links to `/upload`)
2. **Stat cards** (3 cards in a row):
   - Pending (yellow)
   - Approved (green)
   - Rejected (red)
   - Each shows a count from `tutorials` scoped to the current user via `tutorial_contributors`
3. **Recent Contributions list** — 5 most recent tutorials, ordered by `created_at desc`, each showing:
   - Title
   - Difficulty badge
   - Status badge
   - Submission date
   - **Edit** button → `/tutorials/[id]/edit`
   - **View** button → `/tutorials/[id]`
4. **"See all"** link → `/my-tutorials`

### Data Fetching

Two parallel queries via `Promise.all`:
- Three count queries (one per status: pending, approved, rejected) — uses `{ count: 'exact', head: true }`, no row data transferred
- One query for the 5 most recent tutorials with title, status, difficulty, created_at — joined through `tutorial_contributors` to scope to the current user

### Nav update (`components/nav.tsx`)

Add a "Dashboard" link for `role === 'contributor'`, positioned before "Upload" and "My Tutorials".

---

## Section 3: Edit Tutorial Page (`/tutorials/[id]/edit`)

**File:** `app/tutorials/[id]/edit/page.tsx` — server component with inline server actions.

**Access:** On load, verify the tutorial belongs to the logged-in user via `tutorial_contributors`. If not, redirect to `/dashboard`.

### Layout

- Page heading: tutorial title + current status badge
- Five collapsible `<details>/<summary>` panels:

| Panel | Fields | Supabase target |
|-------|--------|-----------------|
| Details | title, description, difficulty | `tutorials` row |
| Files | PDF re-upload, cover photo re-upload | Supabase Storage + `tutorials.pdf_url` / `tutorials.cover_image_url` |
| Parts | list with Remove buttons + Add part form (name, qty, buy_link) | `parts` table |
| Tools | same pattern as Parts | `tools` table |
| STL Files | list with Remove buttons + upload additional files | Supabase Storage + `stl_files` table |

Each panel has its own **Save** button. Saves are surgical — only that section's data is written.

### Server Actions (per panel)

Each server action:
1. Validates input
2. Writes to Supabase
3. Applies status reset logic (see below)
4. Calls `revalidatePath('/tutorials/[id]/edit')` to refresh the page

### Status Reset Logic

| Current status | Action | Result |
|----------------|--------|--------|
| `pending` | any edit | status stays `pending` |
| `approved` | any edit | status reset to `pending` |
| `rejected` | any edit | status reset to `pending` |

When status is reset, a notice is shown on the refreshed page: "Your tutorial has been re-submitted for review."

### File Replacement (Files panel)

New file uploaded to the same Storage path prefix (tutorial UUID). The corresponding URL field on the `tutorials` row is updated. Old file is not explicitly deleted (Storage cleanup is out of scope for this feature).

---

## Section 4: Existing Page Updates

### `app/my-tutorials/page.tsx`

Add an **Edit** button to each tutorial row, linking to `/tutorials/[id]/edit`.

---

## Files Summary

| File | Action |
|------|--------|
| `app/dashboard/page.tsx` | Create |
| `app/tutorials/[id]/edit/page.tsx` | Create |
| `app/pending/page.tsx` | Create |
| `middleware.ts` | Modify — add approved gate, update matcher |
| `app/login/page.tsx` | Modify — role-based redirect after sign-in |
| `app/my-tutorials/page.tsx` | Modify — add Edit button |
| `components/nav.tsx` | Modify — add Dashboard link for contributors |

---

## Out of Scope

- Delete tutorial functionality
- Old Storage file cleanup on file replacement
- Real-time status notifications (e.g. email on approval)
- Contributor-to-admin messaging
