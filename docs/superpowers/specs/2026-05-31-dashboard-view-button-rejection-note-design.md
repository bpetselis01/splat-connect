# Dashboard View Button & Rejection Note Design

**Date:** 2026-05-31
**Branch:** development

---

## Problem

Two UX gaps on contributor-facing pages:

1. The dashboard shows a "View" link for every tutorial regardless of status. Draft, pending, and rejected tutorials have no public page — the link leads to a 404.
2. Rejected tutorials do not show the rejection reason on the edit page. The dashboard and my-tutorials pages have display code for `rejection_note` but it is guarded by `{t.rejection_note && ...}`, so if the admin rejected without leaving a note the contributor sees nothing — no indicator that the tutorial was rejected at all.
3. No unit tests exist for `dashboard`, `my-tutorials`, or `edit-tutorial` pages.

---

## Changes

### Feature 1 — Remove View button from dashboard

**File:** `packages/web/app/dashboard/page.tsx`

Remove the `<Link href={/tutorials/${t.id}}>View</Link>` block entirely. The only page with a View link is the dashboard — `my-tutorials` does not have one.

### Feature 2 — Rejection callout on all contributor pages

**Dashboard and my-tutorials (in-row callout)**

Replace the silent `{t.rejection_note && ...}` guard in both pages with a status-driven conditional:

```tsx
{t.status === 'rejected' && (
  <p className="text-xs text-red-600 mt-0.5">
    {t.rejection_note ?? 'No feedback was provided.'}
  </p>
)}
```

Always renders for rejected tutorials. Uses `??` to fall back to "No feedback was provided." when `rejection_note` is null.

**Edit page (prominent banner)**

Add a full-width red callout panel between the back-link header and the first `<details>` panel:

```tsx
{tutorial!.status === 'rejected' && (
  <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-3">
    <p className="text-sm font-semibold text-red-700 mb-1">This tutorial was rejected</p>
    <p className="text-sm text-red-600">
      {tutorial!.rejection_note ?? 'No feedback was provided.'}
    </p>
  </div>
)}
```

Only shown when `status === 'rejected'`. Hidden for draft, pending, and approved.

---

## Files Modified

| File | Change |
|---|---|
| `packages/web/app/dashboard/page.tsx` | Remove View link; replace rejection note guard |
| `packages/web/app/my-tutorials/page.tsx` | Replace rejection note guard |
| `packages/web/app/tutorials/[id]/edit/page.tsx` | Add rejection banner |

No new components. All changes are inline JSX.

---

## Tests

Three new test files. All three mock `@/lib/api-client` and `next/navigation`, render async server components via `render(await PageFn())`.

### `tests/unit/pages/dashboard.test.tsx`

| Test | Description |
|---|---|
| Redirects to `/login` when profile API throws | Mocks `apiClient.get` to throw on first call |
| Redirects to `/` when role is not contributor | Mocks profile with `role: 'admin'` |
| Renders pending / approved / rejected counts | Verifies stat numbers from tutorial fixtures |
| Renders tutorial titles and status badges | Checks title text and status label |
| No View link for any status | Verifies no link with text "View" in the document |
| Edit link present for each tutorial | Checks href `/tutorials/:id/edit` |
| "View all" link shown when list exceeds 5 | Passes 6+ tutorials, checks "View all" link |
| Empty state shown when no tutorials | Checks empty-state copy |
| Rejection callout shows note when rejected with note | Passes `rejection_note: 'Too short'`, checks text |
| Rejection callout shows fallback when rejected without note | Passes `rejection_note: null`, checks "No feedback was provided." |
| No rejection callout for draft / pending / approved | Verifies fallback text absent for other statuses |

### `tests/unit/pages/my-tutorials.test.tsx`

| Test | Description |
|---|---|
| Renders tutorials with title, status badge, and Edit link | Basic render check |
| Empty state shown when no tutorials | Checks empty-state copy |
| Rejection callout shows note when rejected with note | Passes `rejection_note: 'Too short'` |
| Rejection callout shows fallback when rejected without note | Passes `rejection_note: null` |
| No rejection callout for draft / pending / approved | Verifies fallback text absent for other statuses |

### `tests/unit/pages/edit-tutorial.test.tsx`

| Test | Description |
|---|---|
| Redirects to `/login` when profile fetch throws | Mocks first `apiClient.get` to throw |
| Redirects to `/dashboard` when tutorial fetch throws | Mocks second `apiClient.get` to throw |
| Redirects to `/dashboard` when user is not a contributor | Profile id not in `tutorial_contributors` |
| Renders tutorial title and details form | Basic render check |
| Submit for review button shown only for draft | Checks presence/absence by status |
| Rejection banner shown when status is rejected | Checks banner heading text |
| Banner shows note text when `rejection_note` is set | Checks note text |
| Banner shows fallback when `rejection_note` is null | Checks "No feedback was provided." |
| No rejection banner for draft status | Verifies banner absent |
| No rejection banner for pending status | Verifies banner absent |

---

## Out of Scope

- Admin review page: the rejection note textarea is already marked optional; no change needed.
- `tutorial-card.tsx`: used in the public library for approved tutorials only; no status-conditional logic needed.
