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
  const [editError, setEditError] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [addKey, setAddKey] = useState(0)

  useEffect(() => {
    setParts(initialParts)
  }, [initialParts])

  function openEdit(part: Part) {
    setEditingId(part.id)
    setDraft({ name: part.name, quantity: part.quantity, is_optional: part.is_optional, buy_links: part.buy_links })
    setEditError(null)
  }

  function closeEdit() {
    setEditingId(null)
    setDraft(null)
    setEditError(null)
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
      setEditError('Failed to save, please try again')
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
    const newPart: PartInput = {
      name: (data.get('name') as string).trim(),
      quantity: Number(data.get('quantity') ?? 1),
      is_optional: data.get('is_optional') === 'on',
      buy_links: rawLinks ? JSON.parse(rawLinks) : [],
    }
    setSaving(true)
    setAddError(null)
    try {
      await onSave([...parts.map(toInput), newPart])
      setParts((prev) => [...prev, { ...newPart, id: `temp-${Date.now()}`, tutorial_id: '' }])
      form.reset()
      setAddKey((k) => k + 1)
    } catch {
      setAddError('Failed to add part, please try again')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'field'
  const btnCls = 'btn btn-primary btn-sm'

  return (
    <div className="px-5 pb-5">
      {parts.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {parts.map((p) => (
            <li key={p.id} className="card-flat text-sm">
              <button
                type="button"
                onClick={() => (editingId === p.id ? closeEdit() : openEdit(p))}
                className="flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-sunken"
              >
                <span className="font-bold text-ink">
                  {p.name} &times; {p.quantity}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {p.is_optional && (
                    <span className="badge bg-sunken text-brand-deep">Optional</span>
                  )}
                  <span className="text-xs text-muted">{editingId === p.id ? '▲' : '▼'}</span>
                </div>
              </button>
              {editingId === p.id && draft && (
                <div className="flex flex-col gap-2 border-t border-line px-4 pt-3 pb-4">
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
                      onClick={() => handleDelete(p.id)}
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
      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <p className="text-sm font-bold text-ink">Add part</p>
        <input name="name" placeholder="Name" required className={inputCls} />
        <input
          name="quantity"
          type="number"
          min="1"
          defaultValue="1"
          placeholder="Quantity"
          className={inputCls}
        />
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
          Add part
        </button>
      </form>
    </div>
  )
}

function toInput(p: Part): PartInput {
  return { name: p.name, quantity: p.quantity, is_optional: p.is_optional, buy_links: p.buy_links }
}
