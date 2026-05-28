# Edit Page Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix stale difficulty dropdown after save, and add inline editing/deletion of existing parts and tools on the tutorial edit page.

**Architecture:** Issue 1 is a one-line `key` prop fix on the `<select>`. Issue 2 extracts the Parts and Tools sections from the Server Component page into two new `'use client'` components (`EditPartsSection`, `EditToolsSection`) that manage local state for expand/edit/delete/add, calling a server action with the full updated array on each mutation — the same array-replace pattern already used by the API.

**Tech Stack:** Next.js 14 App Router (Server Components + Server Actions), React `useState`/`useEffect`, Vitest + React Testing Library (`@testing-library/react`), Tailwind CSS, `@splat-connect/types` (`Part`, `Tool`, `BuyLink`).

---

## File Map

| File | Action |
|---|---|
| `packages/web/app/tutorials/[id]/edit/page.tsx` | Modify — add `key` to `<select>`, replace `addPart`/`addTool` with `saveParts`/`saveTools`, swap in new components |
| `packages/web/components/edit-parts-section.tsx` | Create — client component for parts list with inline editing |
| `packages/web/components/edit-tools-section.tsx` | Create — client component for tools list with inline editing |
| `packages/web/tests/unit/components/edit-parts-section.test.tsx` | Create — unit tests for EditPartsSection |
| `packages/web/tests/unit/components/edit-tools-section.test.tsx` | Create — unit tests for EditToolsSection |

---

## Task 1: Fix stale difficulty dropdown

**Files:**
- Modify: `packages/web/app/tutorials/[id]/edit/page.tsx:173`

This is a visual bug in a Server Component — it cannot be unit tested (Server Components can't render in jsdom). Verification is manual: run the app, edit difficulty, save, confirm the dropdown shows the new value without a page refresh.

- [ ] **Step 1: Add `key` prop to the `<select>`**

In `packages/web/app/tutorials/[id]/edit/page.tsx`, find line 173 and make this change:

```tsx
// Before
<select name="difficulty" defaultValue={tutorial!.difficulty} className={inputCls}>

// After
<select key={tutorial!.difficulty} name="difficulty" defaultValue={tutorial!.difficulty} className={inputCls}>
```

- [ ] **Step 2: Run the test suite to confirm no regressions**

```bash
cd packages/web && npx vitest run
```

Expected: all 64 tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/web/app/tutorials/[id]/edit/page.tsx
git commit -m "fix(web): force select remount on difficulty change to fix stale dropdown"
```

---

## Task 2: EditPartsSection — tests and implementation

**Files:**
- Create: `packages/web/tests/unit/components/edit-parts-section.test.tsx`
- Create: `packages/web/components/edit-parts-section.tsx`

### Background

`EditPartsSection` is a `'use client'` component. It receives the current parts list from the server (`initialParts: Part[]`) and a server action (`onSave`) to persist changes. It manages:
- Which row is expanded (`editingId`)
- The current edit draft (`draft`)
- Optimistic local state (`parts`) synced from `initialParts` via `useEffect`

Every mutation (edit save, delete, add) calls `onSave` with the full updated array. The API replaces all parts in one shot.

Rows have a clickable header (expand/collapse) with a `▼/▲` chevron. The edit form appears inline when a row is expanded.

- [ ] **Step 1: Write the failing tests**

Create `packages/web/tests/unit/components/edit-parts-section.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditPartsSection } from '@/components/edit-parts-section'
import type { Part } from '@splat-connect/types'

const mockParts: Part[] = [
  {
    id: 'part-1',
    tutorial_id: 'tut-1',
    name: 'Solder Wire',
    quantity: 2,
    is_optional: false,
    buy_links: [],
  },
  {
    id: 'part-2',
    tutorial_id: 'tut-1',
    name: 'Heat Shrink',
    quantity: 10,
    is_optional: true,
    buy_links: [{ label: 'Jaycar', url: 'https://jaycar.com' }],
  },
]

function setup(onSave = vi.fn().mockResolvedValue(undefined), parts = mockParts) {
  return render(<EditPartsSection initialParts={parts} onSave={onSave} />)
}

describe('EditPartsSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders existing part names', () => {
    setup()
    expect(screen.getByText(/Solder Wire/)).toBeInTheDocument()
    expect(screen.getByText(/Heat Shrink/)).toBeInTheDocument()
  })

  it('renders a chevron indicator on each part row', () => {
    setup()
    const chevrons = screen.getAllByText('▼')
    expect(chevrons).toHaveLength(2)
  })

  it('edit form is not visible before a row is expanded', () => {
    setup()
    expect(screen.queryByDisplayValue('Solder Wire')).not.toBeInTheDocument()
  })

  it('clicking a part row shows its edit form pre-filled with current values', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Solder Wire/ }))
    expect(screen.getByDisplayValue('Solder Wire')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2')).toBeInTheDocument()
  })

  it('clicking Cancel hides the edit form', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Solder Wire/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByDisplayValue('Solder Wire')).not.toBeInTheDocument()
  })

  it('clicking Save calls onSave with the updated part', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Solder Wire/ }))
    fireEvent.change(screen.getByDisplayValue('Solder Wire'), {
      target: { value: 'Solder Wire Thick' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedParts] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedParts[0].name).toBe('Solder Wire Thick')
  })

  it('clicking Delete calls onSave without the deleted part', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Solder Wire/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedParts] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedParts).toHaveLength(1)
    expect(savedParts[0].name).toBe('Heat Shrink')
  })

  it('submitting the Add part form calls onSave with the new part appended', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.change(screen.getByPlaceholderText('Name'), {
      target: { value: 'New Part' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add part' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedParts] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedParts).toHaveLength(3)
    expect(savedParts[2].name).toBe('New Part')
  })

  it('shows an error message when onSave throws during edit save', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'))
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Solder Wire/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(screen.getByText('Failed to save, please try again')).toBeInTheDocument()
    )
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
cd packages/web && npx vitest run tests/unit/components/edit-parts-section.test.tsx
```

Expected: all 9 tests fail with `Cannot find module '@/components/edit-parts-section'`.

- [ ] **Step 3: Implement EditPartsSection**

Create `packages/web/components/edit-parts-section.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import type { Part, BuyLink } from '@splat-connect/types'
import { BuyLinksInput } from '@/components/buy-links-input'

type PartInput = { name: string; quantity: number; is_optional: boolean; buy_links: BuyLink[] }

interface EditPartsSectionProps {
  initialParts: Part[]
  onSave: (parts: PartInput[]) => Promise<void>
}

export function EditPartsSection({ initialParts, onSave }: EditPartsSectionProps) {
  const [parts, setParts] = useState<Part[]>(initialParts)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<PartInput | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addKey, setAddKey] = useState(0)

  useEffect(() => {
    setParts(initialParts)
  }, [initialParts])

  function openEdit(part: Part) {
    setEditingId(part.id)
    setDraft({ name: part.name, quantity: part.quantity, is_optional: part.is_optional, buy_links: part.buy_links })
    setError(null)
  }

  function closeEdit() {
    setEditingId(null)
    setDraft(null)
    setError(null)
  }

  async function handleSave() {
    if (!draft || !editingId) return
    const updated = parts.map((p) => (p.id === editingId ? { ...p, ...draft } : p))
    setSaving(true)
    try {
      await onSave(updated.map(toInput))
      setParts(updated)
      closeEdit()
    } catch {
      setError('Failed to save, please try again')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const filtered = parts.filter((p) => p.id !== id)
    setSaving(true)
    try {
      await onSave(filtered.map(toInput))
      setParts(filtered)
      closeEdit()
    } catch {
      setError('Failed to delete, please try again')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const rawLinks = data.get('buy_links') as string
    const newPart: PartInput = {
      name: (data.get('name') as string).trim(),
      quantity: Number(data.get('quantity') ?? 1),
      is_optional: data.get('is_optional') === 'on',
      buy_links: rawLinks ? JSON.parse(rawLinks) : [],
    }
    setSaving(true)
    setError(null)
    try {
      await onSave([...parts.map(toInput), newPart])
      setParts((prev) => [...prev, { ...newPart, id: `temp-${Date.now()}`, tutorial_id: '' }])
      form.reset()
      setAddKey((k) => k + 1)
    } catch {
      setError('Failed to add part, please try again')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm'
  const btnCls =
    'bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#16304f] disabled:opacity-50'

  return (
    <div className="px-5 pb-5">
      {parts.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {parts.map((p) => (
            <li key={p.id} className="border rounded-lg text-sm">
              <button
                type="button"
                onClick={() => (editingId === p.id ? closeEdit() : openEdit(p))}
                className="w-full px-3 py-2 flex items-center justify-between text-left"
              >
                <span className="font-medium">
                  {p.name} &times; {p.quantity}
                </span>
                <div className="flex items-center gap-2">
                  {p.is_optional && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      Optional
                    </span>
                  )}
                  <span className="text-gray-400 text-xs">{editingId === p.id ? '▲' : '▼'}</span>
                </div>
              </button>
              {editingId === p.id && draft && (
                <div className="px-3 pb-3 pt-2 flex flex-col gap-2 border-t">
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                    className={inputCls}
                    placeholder="Name"
                  />
                  <input
                    type="number"
                    min="1"
                    value={draft.quantity}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, quantity: Number(e.target.value) } : d))
                    }
                    className={inputCls}
                    placeholder="Quantity"
                  />
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={draft.is_optional}
                      onChange={(e) =>
                        setDraft((d) => (d ? { ...d, is_optional: e.target.checked } : d))
                      }
                      className="rounded"
                    />
                    Optional (not required)
                  </label>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Buy links</p>
                    <BuyLinksInput
                      key={editingId}
                      initialLinks={draft.buy_links}
                      onChange={(links) => setDraft((d) => (d ? { ...d, buy_links: links } : d))}
                    />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <div className="flex gap-2 flex-wrap">
                    <button type="button" onClick={handleSave} disabled={saving} className={btnCls}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={closeEdit}
                      className="px-4 py-2 rounded-lg text-sm border"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg text-sm text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <p className="text-sm font-medium">Add part</p>
        <input name="name" placeholder="Name" required className={inputCls} />
        <input
          name="quantity"
          type="number"
          min="1"
          defaultValue="1"
          placeholder="Quantity"
          className={inputCls}
        />
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" name="is_optional" className="rounded" />
          Optional (not required)
        </label>
        <div>
          <p className="text-xs text-gray-500 mb-1">Buy links</p>
          <BuyLinksInput key={addKey} />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={saving} className={btnCls}>
          Add part
        </button>
      </form>
    </div>
  )
}

function toInput(p: Part): PartInput {
  return { name: p.name, quantity: p.quantity, is_optional: p.is_optional, buy_links: p.buy_links }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
cd packages/web && npx vitest run tests/unit/components/edit-parts-section.test.tsx
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/edit-parts-section.tsx \
        packages/web/tests/unit/components/edit-parts-section.test.tsx
git commit -m "feat(web): add EditPartsSection client component with inline edit/delete"
```

---

## Task 3: EditToolsSection — tests and implementation

**Files:**
- Create: `packages/web/tests/unit/components/edit-tools-section.test.tsx`
- Create: `packages/web/components/edit-tools-section.tsx`

`EditToolsSection` is structurally identical to `EditPartsSection` but operates on `Tool[]`. Tools have no `quantity` field.

- [ ] **Step 1: Write the failing tests**

Create `packages/web/tests/unit/components/edit-tools-section.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditToolsSection } from '@/components/edit-tools-section'
import type { Tool } from '@splat-connect/types'

const mockTools: Tool[] = [
  {
    id: 'tool-1',
    tutorial_id: 'tut-1',
    name: 'Soldering Iron',
    is_optional: false,
    buy_links: [],
  },
  {
    id: 'tool-2',
    tutorial_id: 'tut-1',
    name: 'Heat Gun',
    is_optional: true,
    buy_links: [{ label: 'Jaycar', url: 'https://jaycar.com' }],
  },
]

function setup(onSave = vi.fn().mockResolvedValue(undefined), tools = mockTools) {
  return render(<EditToolsSection initialTools={tools} onSave={onSave} />)
}

describe('EditToolsSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders existing tool names', () => {
    setup()
    expect(screen.getByText(/Soldering Iron/)).toBeInTheDocument()
    expect(screen.getByText(/Heat Gun/)).toBeInTheDocument()
  })

  it('renders a chevron indicator on each tool row', () => {
    setup()
    const chevrons = screen.getAllByText('▼')
    expect(chevrons).toHaveLength(2)
  })

  it('edit form is not visible before a row is expanded', () => {
    setup()
    expect(screen.queryByDisplayValue('Soldering Iron')).not.toBeInTheDocument()
  })

  it('clicking a tool row shows its edit form pre-filled with current values', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Soldering Iron/ }))
    expect(screen.getByDisplayValue('Soldering Iron')).toBeInTheDocument()
  })

  it('clicking Cancel hides the edit form', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Soldering Iron/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByDisplayValue('Soldering Iron')).not.toBeInTheDocument()
  })

  it('clicking Save calls onSave with the updated tool', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Soldering Iron/ }))
    fireEvent.change(screen.getByDisplayValue('Soldering Iron'), {
      target: { value: 'Soldering Station' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedTools] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedTools[0].name).toBe('Soldering Station')
  })

  it('clicking Delete calls onSave without the deleted tool', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Soldering Iron/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedTools] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedTools).toHaveLength(1)
    expect(savedTools[0].name).toBe('Heat Gun')
  })

  it('submitting the Add tool form calls onSave with the new tool appended', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.change(screen.getByPlaceholderText('Name'), {
      target: { value: 'New Tool' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add tool' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedTools] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedTools).toHaveLength(3)
    expect(savedTools[2].name).toBe('New Tool')
  })

  it('shows an error message when onSave throws during edit save', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'))
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Soldering Iron/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(screen.getByText('Failed to save, please try again')).toBeInTheDocument()
    )
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
cd packages/web && npx vitest run tests/unit/components/edit-tools-section.test.tsx
```

Expected: all 9 tests fail with `Cannot find module '@/components/edit-tools-section'`.

- [ ] **Step 3: Implement EditToolsSection**

Create `packages/web/components/edit-tools-section.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import type { Tool, BuyLink } from '@splat-connect/types'
import { BuyLinksInput } from '@/components/buy-links-input'

type ToolInput = { name: string; is_optional: boolean; buy_links: BuyLink[] }

interface EditToolsSectionProps {
  initialTools: Tool[]
  onSave: (tools: ToolInput[]) => Promise<void>
}

export function EditToolsSection({ initialTools, onSave }: EditToolsSectionProps) {
  const [tools, setTools] = useState<Tool[]>(initialTools)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ToolInput | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addKey, setAddKey] = useState(0)

  useEffect(() => {
    setTools(initialTools)
  }, [initialTools])

  function openEdit(tool: Tool) {
    setEditingId(tool.id)
    setDraft({ name: tool.name, is_optional: tool.is_optional, buy_links: tool.buy_links })
    setError(null)
  }

  function closeEdit() {
    setEditingId(null)
    setDraft(null)
    setError(null)
  }

  async function handleSave() {
    if (!draft || !editingId) return
    const updated = tools.map((t) => (t.id === editingId ? { ...t, ...draft } : t))
    setSaving(true)
    try {
      await onSave(updated.map(toInput))
      setTools(updated)
      closeEdit()
    } catch {
      setError('Failed to save, please try again')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const filtered = tools.filter((t) => t.id !== id)
    setSaving(true)
    try {
      await onSave(filtered.map(toInput))
      setTools(filtered)
      closeEdit()
    } catch {
      setError('Failed to delete, please try again')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const rawLinks = data.get('buy_links') as string
    const newTool: ToolInput = {
      name: (data.get('name') as string).trim(),
      is_optional: data.get('is_optional') === 'on',
      buy_links: rawLinks ? JSON.parse(rawLinks) : [],
    }
    setSaving(true)
    setError(null)
    try {
      await onSave([...tools.map(toInput), newTool])
      setTools((prev) => [...prev, { ...newTool, id: `temp-${Date.now()}`, tutorial_id: '' }])
      form.reset()
      setAddKey((k) => k + 1)
    } catch {
      setError('Failed to add tool, please try again')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm'
  const btnCls =
    'bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#16304f] disabled:opacity-50'

  return (
    <div className="px-5 pb-5">
      {tools.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {tools.map((t) => (
            <li key={t.id} className="border rounded-lg text-sm">
              <button
                type="button"
                onClick={() => (editingId === t.id ? closeEdit() : openEdit(t))}
                className="w-full px-3 py-2 flex items-center justify-between text-left"
              >
                <span className="font-medium">{t.name}</span>
                <div className="flex items-center gap-2">
                  {t.is_optional && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      Optional
                    </span>
                  )}
                  <span className="text-gray-400 text-xs">{editingId === t.id ? '▲' : '▼'}</span>
                </div>
              </button>
              {editingId === t.id && draft && (
                <div className="px-3 pb-3 pt-2 flex flex-col gap-2 border-t">
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                    className={inputCls}
                    placeholder="Name"
                  />
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={draft.is_optional}
                      onChange={(e) =>
                        setDraft((d) => (d ? { ...d, is_optional: e.target.checked } : d))
                      }
                      className="rounded"
                    />
                    Optional (not required)
                  </label>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Buy links</p>
                    <BuyLinksInput
                      key={editingId}
                      initialLinks={draft.buy_links}
                      onChange={(links) => setDraft((d) => (d ? { ...d, buy_links: links } : d))}
                    />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <div className="flex gap-2 flex-wrap">
                    <button type="button" onClick={handleSave} disabled={saving} className={btnCls}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={closeEdit}
                      className="px-4 py-2 rounded-lg text-sm border"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg text-sm text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <p className="text-sm font-medium">Add tool</p>
        <input name="name" placeholder="Name" required className={inputCls} />
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" name="is_optional" className="rounded" />
          Optional (not required)
        </label>
        <div>
          <p className="text-xs text-gray-500 mb-1">Buy links</p>
          <BuyLinksInput key={addKey} />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={saving} className={btnCls}>
          Add tool
        </button>
      </form>
    </div>
  )
}

function toInput(t: Tool): ToolInput {
  return { name: t.name, is_optional: t.is_optional, buy_links: t.buy_links }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
cd packages/web && npx vitest run tests/unit/components/edit-tools-section.test.tsx
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/edit-tools-section.tsx \
        packages/web/tests/unit/components/edit-tools-section.test.tsx
git commit -m "feat(web): add EditToolsSection client component with inline edit/delete"
```

---

## Task 4: Wire components into the edit page

**Files:**
- Modify: `packages/web/app/tutorials/[id]/edit/page.tsx`

This task replaces the old `addPart`/`addTool` server actions and the static parts/tools render sections with the new components and `saveParts`/`saveTools` server actions.

- [ ] **Step 1: Add imports**

In `packages/web/app/tutorials/[id]/edit/page.tsx`, add two imports after the existing component imports (around line 8):

```tsx
import { EditPartsSection } from '@/components/edit-parts-section'
import { EditToolsSection } from '@/components/edit-tools-section'
```

- [ ] **Step 2: Replace `addPart` and `addTool` with `saveParts` and `saveTools`**

Remove `addPart` (lines 72–91) and `addTool` (lines 93–111) entirely. In their place, add:

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

- [ ] **Step 3: Replace the Parts `<details>` panel**

Replace the entire Parts `<details>` block (currently lines 198–260 — from `{/* Parts */}` through the closing `</details>`) with:

```tsx
{/* Parts */}
<details className={panelCls}>
  <summary className={summaryCls}>Parts ({parts.length})</summary>
  <EditPartsSection initialParts={parts} onSave={saveParts} />
</details>
```

- [ ] **Step 4: Replace the Tools `<details>` panel**

Replace the entire Tools `<details>` block (currently lines 262–314 — from `{/* Tools */}` through the closing `</details>`) with:

```tsx
{/* Tools */}
<details className={panelCls}>
  <summary className={summaryCls}>Tools ({tools.length})</summary>
  <EditToolsSection initialTools={tools} onSave={saveTools} />
</details>
```

- [ ] **Step 5: Run the full test suite**

```bash
cd packages/web && npx vitest run
```

Expected: all 82 tests pass (64 existing + 9 EditPartsSection + 9 EditToolsSection).

- [ ] **Step 6: Commit**

```bash
git add packages/web/app/tutorials/[id]/edit/page.tsx
git commit -m "feat(web): wire EditPartsSection and EditToolsSection into tutorial edit page"
```
