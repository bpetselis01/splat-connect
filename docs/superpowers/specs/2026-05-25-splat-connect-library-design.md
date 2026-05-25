# SPLAT Connect — Toy Adaptation Library: Design Spec
**Date:** 2026-05-25  
**Author:** Byron Petselis  
**Status:** Approved for implementation

---

## Context

Supporting Play by Adapting Toys (SPLAT) is a non-profit that helps children with disabilities access play by switch-adapting commercial toys. Currently, tutorials on how to adapt toys are scattered (slide decks, documents) with no central place for parents to find them or for engineering contributors to publish them.

This spec covers the **Toy Adaptation Library** — a web platform that:
- Gives parents a searchable, browsable library of toy adaptation tutorials
- Gives approved engineering contributors a portal to upload tutorials
- Gives the SPLAT admin (Byron) tools to approve contributors and review tutorial submissions before they go public

This is one part of a larger SPLAT Connect website. It is designed to be cost-free to run on Supabase and Vercel free tiers.

---

## Architecture

**Stack:** Next.js (frontend + API routes) hosted on Vercel · Supabase (auth, PostgreSQL, file storage)

```
Parents / Contributors / Admin
          ↕
   Next.js App (Vercel — free tier)
   ├── Public library pages
   ├── Contributor upload portal
   └── Admin dashboard + review queue
          ↕
   Supabase (free tier)
   ├── Auth       — role-based (admin / contributor)
   ├── PostgreSQL — tutorial metadata, review queue, users
   └── Storage    — PDFs, photos, STL files (1GB free)
```

All infrastructure runs on free tiers. No cost while the library is small.

---

## Data Model

### `profiles`
Extends Supabase's built-in `auth.users`. Stores role and approval state.

| Column | Type | Notes |
|---|---|---|
| id | uuid | FK → auth.users |
| name | text | |
| email | text | |
| role | text | `'admin'` or `'contributor'` |
| approved | boolean | Admin sets to true to activate contributor account |
| created_at | timestamp | |

### `tutorials`
Core record for each toy adaptation.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| title | text | Toy name — required |
| description | text | Short description |
| difficulty | text | `'easy'` / `'medium'` / `'hard'` — required |
| status | text | `'draft'` → `'pending'` → `'approved'` / `'rejected'` |
| tutorial_pdf_url | text | Supabase Storage URL — required |
| toy_photo_url | text | Supabase Storage URL — required |
| created_at | timestamp | |
| reviewed_at | timestamp | Set when admin approves or rejects |

### `tutorial_contributors` (junction table)
Many-to-many: multiple profiles can be credited for one tutorial.

| Column | Type | Notes |
|---|---|---|
| tutorial_id | uuid | FK → tutorials |
| profile_id | uuid | FK → profiles |
| role | text | `'primary'` or `'collaborator'` |
| added_at | timestamp | |

### `parts`
Materials list for a tutorial. Each part can have an optional buy link (used by the stretch-goal link-vetting agent).

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tutorial_id | uuid | FK → tutorials |
| name | text | |
| quantity | integer | |
| buy_link | text | Optional — vettable by Claude agent |

### `tools`
Required tools for a tutorial. Also supports optional buy links.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tutorial_id | uuid | FK → tutorials |
| name | text | |
| buy_link | text | Optional |

### `stl_files`
3D print files attached to a tutorial. Optional — not all adaptations require 3D printing.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tutorial_id | uuid | FK → tutorials |
| filename | text | |
| file_url | text | Supabase Storage URL |

---

## Validation Rule

A tutorial can only move from `draft → pending` (submitted to review queue) when all of the following are present:
- Tutorial PDF uploaded
- Toy photo uploaded
- Difficulty set
- At least 1 part
- At least 1 tool

STL files are optional.

---

## Pages & Routes

### Public (no login required)
| Route | Purpose |
|---|---|
| `/` | Homepage — hero, mission statement, featured tutorials, search |
| `/library` | Browse grid of all approved tutorials — filter by difficulty, search by toy name |
| `/tutorials/[id]` | Individual tutorial — photo, PDF download, parts + buy links, tools, STL files, contributors |
| `/login` | Login for contributors and admin |
| `/signup` | Contributor access request — account created but locked until admin approves |

### Contributor (logged in + approved)
| Route | Purpose |
|---|---|
| `/upload` | Multi-step form to submit a tutorial |
| `/my-tutorials` | View own submissions with status badges; re-edit drafts |

### Admin only
| Route | Purpose |
|---|---|
| `/admin` | Dashboard — count of pending contributor requests and pending tutorial reviews |
| `/admin/contributors` | List of signup requests — approve or reject |
| `/admin/review/[id]` | Review a specific tutorial — preview all files, approve or reject with optional note |

---

## Key User Flows

### Parent finding a tutorial
1. Visits `/library`
2. Browses toy photo grid; optionally filters by difficulty or searches by toy name
3. Clicks a card → `/tutorials/[id]`
4. Downloads PDF tutorial
5. Clicks "Buy →" links next to each part/tool to purchase what they need
6. Downloads STL files if 3D printing is required

### Contributor submitting a tutorial
1. Visits `/signup` → fills in name + email + password
2. Account created with `approved = false` — sees "pending approval" screen
3. Admin approves → contributor receives email confirmation (via Supabase Auth built-in email triggers — no custom email setup needed)
4. Logs in → `/upload`
5. Completes multi-step form:
   - Step 1: Toy name, description, difficulty
   - Step 2: Upload PDF + toy photo
   - Step 3: Add parts (name, quantity, optional buy link)
   - Step 4: Add tools (name, optional buy link)
   - Step 5: Upload STL files (optional)
   - Step 6: Review summary → submit
6. Tutorial enters `pending` status
7. Contributor tracks progress on `/my-tutorials`

### Admin reviewing a submission
1. Visits `/admin` — sees count of pending items
2. Goes to `/admin/review/[id]`
3. Previews all uploaded files; reads parts and tools list
4. Approves → status becomes `approved`, tutorial appears publicly on `/library`
5. Or rejects → status becomes `rejected`, optional rejection note stored on the tutorial record and displayed to the contributor on `/my-tutorials` (no email needed for MVP)

### Admin approving a contributor
1. Visits `/admin/contributors`
2. Sees list of pending signup requests
3. Approves → `approved = true` on their profile, contributor gets email
4. Or rejects → account remains inactive

---

## Mobile Strategy

The Supabase backend (auth, database, storage) is fully compatible with mobile — it has native SDKs for React Native/Expo. The architecture requires no changes to support mobile.

Recommended progression:
1. **MVP:** Build the Next.js site mobile-responsive from day one — works in mobile browsers at no extra cost.
2. **Phase 2:** Add PWA support to Next.js — parents can install it to their home screen and use it offline.
3. **Phase 3 (if needed):** React Native + Expo app pointing at the same Supabase backend. No backend changes. App Store costs: $25 one-time (Google Play), $99/year (Apple).

---

## Stretch Goal (Post-MVP): Link Vetting Agent

A Claude agent runs on a weekly schedule. It reads all `buy_link` values from the `parts` and `tools` tables, checks each URL is still valid (HTTP 200, product page still active), and flags or replaces broken links. This is enabled by the data model: links are stored as structured fields, not buried in PDFs.

---

## Verification

To confirm the MVP is working end-to-end:

1. **Public library:** Visit `/library` — approved tutorials appear as toy cards. Filter by difficulty, search by name.
2. **Tutorial detail:** Click a card — PDF download works, parts list shows buy links where provided, STL download works.
3. **Contributor signup:** Sign up at `/signup` — account is locked until approved. Check `/my-tutorials` shows "pending approval."
4. **Admin approval:** Log in as admin, visit `/admin/contributors` — approve the test account. Confirm contributor receives access.
5. **Upload flow:** Log in as contributor, visit `/upload` — confirm each step gates on required fields. Submit.
6. **Review queue:** Log in as admin, visit `/admin` — pending tutorial appears. Go to `/admin/review/[id]` — approve it.
7. **Published:** Return to `/library` — tutorial now appears in the grid.
