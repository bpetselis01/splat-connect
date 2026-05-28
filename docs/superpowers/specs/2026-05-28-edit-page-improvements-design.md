# Edit Page Improvements Design
**Date:** 2026-05-28
**Branch:** development

## Overview

Two improvements to the tutorial edit page (`/tutorials/[id]/edit`):

1. **Stale difficulty dropdown** — after clicking "Save Details", the difficulty select reverts to the pre-save value visually even though the data is saved correctly.
2. **Parts/tools read-only** — existing parts and tools are displayed but cannot be edited or deleted; only adding new items is possible.

---

## Issue 1: Stale Difficulty Dropdown

### Root Cause

The `<select>` uses `defaultValue` (uncontrolled pattern). React applies `defaultValue` only on initial mount. After a Server Action completes and `revalidatePath` triggers an RSC re-render, React reconciles the existing `<select>` in place — it does not remount it — so the new `defaultValue` from the server is silently ignored. The select visually resets to the old value as part of the form lifecycle, not the newly saved one.

### Fix

Add `key={tutorial!.difficulty}` to the `<select>` element in `packages/web/app/tutorials/[id]/edit/page.tsx`.

When the server re-renders with a new difficulty value, React sees a different `key` and unmounts/remounts the element, causing `defaultValue` to be applied fresh with the correct value.

**File:** `packages/web/app/tutorials/[id]/edit/page.tsx` — line 173

```tsx
// Before
<select name="difficulty" defaultValue={tutorial!.difficulty} className={inputCls}>

// After
<select key={tutorial!.difficulty} name="difficulty" defaultValue={tutorial!.difficulty} className={inputCls}>
```

No other changes needed for this issue.

---

## Issue 2: Parts/Tools Inline Editing

### Goal

Users can add, edit, and delete existing parts and tools from the tutorial edit page. Editing an existing item expands an inline form directly in the list row (with a visual expand indicator), pre-filled with the current values.

### Architecture

Extract the Parts and Tools sections from the Server Component page into two new `'use client'` components: `EditPartsSection` and `EditToolsSection`. This follows the existing pattern established by `EditFilesSection`.

The server actions `addPart` and `addTool` are replaced by `saveParts` and `saveTools` — general-purpose actions that accept and persist the full array. All mutations (add, edit, delete) reduce to posting the modified array.

No API changes are required. The existing `POST /api/tutorials/:id/parts` and `POST /api/tutorials/:id/tools` endpoints already implement full-array replacement (delete-all then insert).

### Files

| File | Change |
|---|---|
| `packages/web/app/tutorials/[id]/edit/page.tsx` | Remove `addPart`/`addTool` server actions; add `saveParts`/`saveTools`; replace Parts/Tools `<details>` panels with `<EditPartsSection>`/`<EditToolsSection>` |
| `packages/web/components/edit-parts-section.tsx` | New client component |
| `packages/web/components/edit-tools-section.tsx` | New client component |

### Server Actions (in edit page)

```ts
async function saveParts(parts: { name: string; quantity: number; is_optional: boolean; buy_links: BuyLink[] }[]) {
  'use server'
  await apiClient.post(`/api/tutorials/${id}/parts`, { parts })
  revalidatePath(`/tutorials/${id}/edit`)
}

async function saveTools(tools: { name: string; is_optional: boolean; buy_links: BuyLink[] }[]) {
  'use server'
  await apiClient.post(`/api/tutorials/${id}/tools`, { tools })
  revalidatePath(`/tutorials/${id}/edit`)
}
```

### Component Props

**EditPartsSection:**
```ts
interface EditPartsSectionProps {
  initialParts: Part[]
  onSave: (parts: { name: string; quantity: number; is_optional: boolean; buy_links: BuyLink[] }[]) => Promise<void>
}
```

**EditToolsSection:**
```ts
interface EditToolsSectionProps {
  initialTools: Tool[]
  onSave: (tools: { name: string; is_optional: boolean; buy_links: BuyLink[] }[]) => Promise<void>
}
```

### Component State

```ts
const [parts, setParts] = useState<Part[]>(initialParts)
const [editingId, setEditingId] = useState<string | null>(null)
const [draft, setDraft] = useState<{ name: string; quantity: number; is_optional: boolean; buy_links: BuyLink[] } | null>(null)
const [saving, setSaving] = useState(false)
const [error, setError] = useState<string | null>(null)
```

`useEffect` syncs `parts` to `initialParts` when the server re-renders with fresh data after a save:

```ts
useEffect(() => {
  setParts(initialParts)
}, [initialParts])
```

### Per-Row UX

Each existing item is rendered as a native `<details>` element whose `open` attribute is controlled by `editingId === item.id`. The browser's native `▶/▼` triangle serves as the expand indicator.

Clicking the `<summary>` row:
- Sets `editingId` to this item's id
- Populates `draft` with a copy of the item's current values (name, quantity, is_optional, buy_links)

Only one row is open at a time — opening a new row closes any previously open one.

**Collapsed state:**
```
▶ Solder Wire × 2                    [Optional]
```

**Expanded state:**
```
▼ Solder Wire × 2                    [Optional]
  Name:     [ Solder Wire             ]
  Quantity: [ 2    ]
  [✓] Optional
  Buy links:
    [Jaycar] [https://...] [Remove]
    + Add buy link

  [Save]  [Cancel]  [Delete]
```

The edit form is controlled by `draft` state. `BuyLinksInput` receives `initialLinks={draft.buy_links}` and `onChange` to keep `draft.buy_links` in sync. It is given `key={editingId}` to ensure it remounts (resetting its internal state) when switching between items.

After clicking **Save**: update the item in `parts` state, call `onSave`, set `editingId` to null.
After clicking **Cancel**: set `editingId` to null, discard draft.
After clicking **Delete**: filter the item out of `parts`, call `onSave`, set `editingId` to null. No confirmation dialog — matches the simplicity of the existing UI; items can be re-added if deleted by mistake.

### Add New (below the list)

An uncontrolled "Add part" / "Add tool" form sits below the list. On submit, it appends the new item to the current `parts`/`tools` state and calls `onSave` with the full updated array. The form is reset after a successful save.

### Error Handling

If `onSave` throws, an inline error message is displayed ("Failed to save, please try again") and the edit form stays open for retry. The optimistic local state update is not rolled back — the `useEffect` sync will correct any divergence when the server confirms the state on next re-render.

### Data Flow Summary

```
User edits item → draft state updated
User clicks Save
  → parts state updated (optimistic)
  → onSave(updatedArray) called (Server Action)
    → POST /api/tutorials/:id/parts
    → revalidatePath fires
    → RSC re-renders with fresh initialParts
  → useEffect syncs parts to confirmed server state
  → editingId = null (row collapses)
```
