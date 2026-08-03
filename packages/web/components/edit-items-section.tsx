'use client'
// Shared implementation behind EditPartsSection and EditToolsSection — the two
// were line-for-line identical except for labels and the quantity field, and
// had already drifted once. `withQuantity` is the only structural difference.
import { useState, useEffect } from 'react'
import type { BuyLink } from '@splat-connect/types'
import { BuyLinksInput } from '@/components/buy-links-input'
import { useToast } from '@/components/toast'
import { SaveStatusLine } from '@/components/save-status-line'

export type EditableItem = {
  id: string
  name: string
  is_optional: boolean
  buy_links: BuyLink[]
  quantity?: number
}

export type ItemInput = {
  name: string
  is_optional: boolean
  buy_links: BuyLink[]
  quantity?: number
}

interface EditItemsSectionProps {
  noun: string // 'part' | 'tool' — drives every label and error message
  withQuantity?: boolean
  initialItems: EditableItem[]
  onSave: (items: ItemInput[]) => Promise<void>
}

export function EditItemsSection({ noun, withQuantity, initialItems, onSave }: EditItemsSectionProps) {
  const showToast = useToast()
  const [items, setItems] = useState<EditableItem[]>(initialItems)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ItemInput | null>(null)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [addKey, setAddKey] = useState(0)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const capitalizedNoun = noun.charAt(0).toUpperCase() + noun.slice(1)

  function markSaved(action: 'added' | 'updated' | 'removed') {
    setSavedAt(new Date().toISOString())
    showToast(`${capitalizedNoun} ${action}`)
  }

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  function toInput(item: EditableItem | ItemInput): ItemInput {
    return {
      name: item.name,
      is_optional: item.is_optional,
      buy_links: item.buy_links,
      ...(withQuantity ? { quantity: item.quantity ?? 1 } : {}),
    }
  }

  function openEdit(item: EditableItem) {
    setEditingId(item.id)
    setDraft(toInput(item))
    setEditError(null)
  }

  function closeEdit() {
    setEditingId(null)
    setDraft(null)
    setEditError(null)
  }

  async function handleSave() {
    if (!draft || !editingId) return
    const updated = items.map((i) => (i.id === editingId ? { ...i, ...draft } : i))
    setSaving(true)
    try {
      await onSave(updated.map(toInput))
      setItems(updated)
      markSaved('updated')
      closeEdit()
    } catch {
      setEditError('Failed to save, please try again')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const filtered = items.filter((i) => i.id !== id)
    setSaving(true)
    try {
      await onSave(filtered.map(toInput))
      setItems(filtered)
      markSaved('removed')
      closeEdit()
    } catch {
      setEditError('Failed to delete, please try again')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const rawLinks = data.get('buy_links') as string
    const newItem: ItemInput = {
      name: (data.get('name') as string).trim(),
      is_optional: data.get('is_optional') === 'on',
      buy_links: rawLinks ? JSON.parse(rawLinks) : [],
      ...(withQuantity ? { quantity: Number(data.get('quantity') ?? 1) } : {}),
    }
    setSaving(true)
    setAddError(null)
    try {
      await onSave([...items.map(toInput), newItem])
      setItems((prev) => [...prev, { ...newItem, id: `temp-${Date.now()}` }])
      markSaved('added')
      form.reset()
      setAddKey((k) => k + 1)
    } catch {
      setAddError(`Failed to add ${noun}, please try again`)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'field'
  const btnCls = 'btn btn-primary btn-sm'

  return (
    <div className="px-5 pb-5">
      {items.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {items.map((i) => (
            <li key={i.id} className="card-flat text-sm">
              <button
                type="button"
                onClick={() => (editingId === i.id ? closeEdit() : openEdit(i))}
                className="flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-sunken"
              >
                <span className="font-bold text-ink">
                  {withQuantity ? (
                    <>
                      {i.name} &times; {i.quantity}
                    </>
                  ) : (
                    i.name
                  )}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {i.is_optional && (
                    <span className="badge bg-sunken text-brand-deep">Optional</span>
                  )}
                  <span className="text-xs text-muted">{editingId === i.id ? '▲' : '▼'}</span>
                </div>
              </button>
              {editingId === i.id && draft && (
                <div className="flex flex-col gap-2 border-t border-line px-4 pt-3 pb-4">
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                    className={inputCls}
                    placeholder="Name"
                  />
                  {withQuantity && (
                    <input
                      type="number"
                      min="1"
                      value={draft.quantity ?? 1}
                      onChange={(e) =>
                        setDraft((d) => (d ? { ...d, quantity: Number(e.target.value) } : d))
                      }
                      className={inputCls}
                      placeholder="Quantity"
                    />
                  )}
                  <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.is_optional}
                      onChange={(e) =>
                        setDraft((d) => (d ? { ...d, is_optional: e.target.checked } : d))
                      }
                      className="field-check"
                    />
                    Optional (not required)
                  </label>
                  <div>
                    <p className="mb-1 text-xs font-bold text-muted">Buy links</p>
                    <BuyLinksInput
                      key={editingId}
                      initialLinks={draft.buy_links}
                      onChange={(links) => setDraft((d) => (d ? { ...d, buy_links: links } : d))}
                    />
                  </div>
                  {editError && (
                    <p role="alert" className="text-sm font-semibold text-danger">
                      {editError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleSave} disabled={saving} className={btnCls}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={closeEdit} className="btn btn-quiet btn-sm">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(i.id)}
                      disabled={saving}
                      className="btn btn-danger btn-sm"
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
      <SaveStatusLine savedAt={savedAt} />
      <form onSubmit={handleAdd} className="mt-2 flex flex-col gap-2">
        <p className="text-sm font-bold text-ink">Add {noun}</p>
        <input name="name" placeholder="Name" required className={inputCls} />
        {withQuantity && (
          <input
            name="quantity"
            type="number"
            min="1"
            defaultValue="1"
            placeholder="Quantity"
            className={inputCls}
          />
        )}
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
          <input type="checkbox" name="is_optional" className="field-check" />
          Optional (not required)
        </label>
        <div>
          <p className="mb-1 text-xs font-bold text-muted">Buy links</p>
          <BuyLinksInput key={addKey} />
        </div>
        {addError && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {addError}
          </p>
        )}
        <button type="submit" disabled={saving} className={btnCls}>
          Add {noun}
        </button>
      </form>
    </div>
  )
}
