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
  const [editError, setEditError] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [addKey, setAddKey] = useState(0)

  useEffect(() => {
    setTools(initialTools)
  }, [initialTools])

  function openEdit(tool: Tool) {
    setEditingId(tool.id)
    setDraft({ name: tool.name, is_optional: tool.is_optional, buy_links: tool.buy_links })
    setEditError(null)
  }

  function closeEdit() {
    setEditingId(null)
    setDraft(null)
    setEditError(null)
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
      setEditError('Failed to save, please try again')
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
    const newTool: ToolInput = {
      name: (data.get('name') as string).trim(),
      is_optional: data.get('is_optional') === 'on',
      buy_links: rawLinks ? JSON.parse(rawLinks) : [],
    }
    setSaving(true)
    setAddError(null)
    try {
      await onSave([...tools.map(toInput), newTool])
      setTools((prev) => [...prev, { ...newTool, id: `temp-${Date.now()}`, tutorial_id: '' }])
      form.reset()
      setAddKey((k) => k + 1)
    } catch {
      setAddError('Failed to add tool, please try again')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'field'
  const btnCls = 'btn btn-primary btn-sm'

  return (
    <div className="px-5 pb-5">
      {tools.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {tools.map((t) => (
            <li key={t.id} className="card-flat text-sm">
              <button
                type="button"
                onClick={() => (editingId === t.id ? closeEdit() : openEdit(t))}
                className="flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-sunken"
              >
                <span className="font-bold text-ink">{t.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {t.is_optional && (
                    <span className="badge bg-sunken text-brand-deep">Optional</span>
                  )}
                  <span className="text-xs text-muted">{editingId === t.id ? '▲' : '▼'}</span>
                </div>
              </button>
              {editingId === t.id && draft && (
                <div className="flex flex-col gap-2 border-t border-line px-4 pt-3 pb-4">
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                    className={inputCls}
                    placeholder="Name"
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
                      onClick={() => handleDelete(t.id)}
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
        <p className="text-sm font-bold text-ink">Add tool</p>
        <input name="name" placeholder="Name" required className={inputCls} />
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
          Add tool
        </button>
      </form>
    </div>
  )
}

function toInput(t: Tool): ToolInput {
  return { name: t.name, is_optional: t.is_optional, buy_links: t.buy_links }
}
