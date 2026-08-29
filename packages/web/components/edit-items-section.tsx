'use client'
import { PanelActions, useSaveOnLeave } from '@/components/panel-actions'
// The parts and tools editors, which were line-for-line identical except for
// labels and the quantity field and had already drifted once. Callers pass
// noun="part" withQuantity or noun="tool"; `withQuantity` is the only
// structural difference between them.
import { useRef, useState } from 'react'
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
  // Whether the Add form has been typed into since it was last written. The
  // form is uncontrolled, so nothing else re-renders when it changes and there
  // is no other way to know during render — the same reason EditDetailsSection
  // keeps a `dirty` flag. Without it this panel would park a save on every
  // render and make every pill click wait for an answer of "nothing to do".
  const [addDirty, setAddDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  /** Whether the add row is expanded. One editor is open at a time. */
  const [addOpen, setAddOpen] = useState(false)

  const capitalizedNoun = noun.charAt(0).toUpperCase() + noun.slice(1)

  function markSaved(action: 'added' | 'updated' | 'removed') {
    setSavedAt(new Date().toISOString())
    showToast(`${capitalizedNoun} ${action}`)
  }

  // Resync when the server sends a new list (revalidatePath after a save).
  //
  // Adjusted during render rather than in an effect: an effect runs after paint,
  // so the stale list is visible for a frame and React has to render twice. This
  // is the documented pattern for deriving state from a changed prop
  // (react.dev/learn/you-might-not-need-an-effect). The comparison is by
  // identity, which is safe because initialItems only gets a new reference when
  // the server component re-renders, not on local state changes.
  //
  // Held back while a row is open or a save is in flight, though. handleAdd
  // seeds the new row with a `temp-` id and the revalidatePath that follows
  // swaps the whole list for the server's, real ids and all. Landing that on
  // top of an open edit leaves editingId naming a row that no longer exists:
  // the edit form unmounts mid-keystroke, losing what was typed, and the Save
  // and Delete buttons being reached for detach from the DOM. Deferring costs
  // a moment of staleness in a list only this user can edit, and the sync runs
  // on the next render after closeEdit() puts editingId back to null.
  const [syncedFrom, setSyncedFrom] = useState(initialItems)
  if (initialItems !== syncedFrom && editingId === null && !saving) {
    setSyncedFrom(initialItems)
    setItems(initialItems)
  }

  function toInput(item: EditableItem | ItemInput): ItemInput {
    return {
      name: item.name,
      is_optional: item.is_optional,
      buy_links: item.buy_links,
      ...(withQuantity ? { quantity: item.quantity ?? 1 } : {}),
    }
  }

  /* One editor open at a time, which is the point of the redesign: the add
     form and an open row used to be two identical stacks of fields on screen
     together. Closing the add row only collapses it — the form stays mounted,
     so a half-typed row is still there when it reopens, and still gets written
     by commit() on the way out of the step. Closing an open item, on the other
     hand, drops its draft, exactly as switching from one item to another
     always has. */
  function openEdit(item: EditableItem) {
    setAddOpen(false)
    setEditingId(item.id)
    setDraft(toInput(item))
    setEditError(null)
  }

  function openAdd(open: boolean) {
    if (open) closeEdit()
    setAddOpen(open)
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

  /**
   * What the Add form is currently holding, or null when it is holding nothing
   * worth writing. The form is uncontrolled — the inputs are the state — so
   * this is the only way to read it, and both submitting and leaving the step
   * go through here rather than each parsing the fields their own way.
   *
   * An empty name means null: it is the one field the API requires, and the
   * input is `required`, so there is no version of this row the server would
   * accept. Anything else typed alongside a blank name goes with it.
   */
  function readAddForm(form: HTMLFormElement): ItemInput | null {
    const data = new FormData(form)
    const name = ((data.get('name') as string) ?? '').trim()
    if (!name) return null
    const rawLinks = data.get('buy_links') as string
    return {
      name,
      is_optional: data.get('is_optional') === 'on',
      buy_links: rawLinks ? JSON.parse(rawLinks) : [],
      ...(withQuantity ? { quantity: Number(data.get('quantity') ?? 1) } : {}),
    }
  }

  const addFormRef = useRef<HTMLFormElement>(null)

  /**
   * Everything this panel is holding that the server has not got, written in
   * one call: the open row's edits, a filled-in Add form, or both at once.
   *
   * Both at once is the reason this is not simply handleSave() followed by
   * handleAdd(). Each of those builds its payload from `items`, and setItems is
   * not visible to the next statement — running them back to back would write
   * the second on top of a list that never learnt about the first, dropping it.
   * One merge, one write.
   */
  async function commit(): Promise<boolean> {
    const pendingAdd = addFormRef.current ? readAddForm(addFormRef.current) : null
    const openEdit = draft !== null && editingId !== null
    if (!pendingAdd && !openEdit) return true

    const kept = openEdit
      ? items.map((i) => (i.id === editingId ? { ...i, ...draft } : i))
      : items
    const payload = kept.map(toInput)
    if (pendingAdd) payload.push(pendingAdd)

    setSaving(true)
    setAddError(null)
    setEditError(null)
    try {
      await onSave(payload)
      setItems(
        pendingAdd ? [...kept, { ...pendingAdd, id: `temp-${Date.now()}` }] : kept
      )
      markSaved(pendingAdd ? 'added' : 'updated')
      closeEdit()
      addFormRef.current?.reset()
      setAddDirty(false)
      setAddKey((k) => k + 1)
      return true
    } catch {
      setAddError(`Failed to save, please try again`)
      return false
    } finally {
      setSaving(false)
    }
  }

  /* Walking on with Next writes the row you were part-way through typing, so
     the text survives the panel unmounting. What it does not do is make the
     step look finished: the status dot and the finish bar both read
     getMissingFields() on the server, so a step that still has nothing in it
     keeps its exclamation mark and its chip. */
  useSaveOnLeave(!saving && (addDirty || draft !== null) ? commit : null)

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const newItem = readAddForm(form)
    if (!newItem) return
    setSaving(true)
    setAddError(null)
    try {
      await onSave([...items.map(toInput), newItem])
      setItems((prev) => [...prev, { ...newItem, id: `temp-${Date.now()}` }])
      markSaved('added')
      form.reset()
      setAddDirty(false)
      setAddKey((k) => k + 1)
    } catch {
      setAddError(`Failed to add ${noun}, please try again`)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'field'
  const btnCls = 'btn btn-primary btn-sm'
  const rowCols = withQuantity ? 'bom-row bom-qty-cols' : 'bom-row'

  return (
    <div className="px-5 pb-5">
      <div className="bom">
        {items.length > 0 && (
          <div className={withQuantity ? 'bom-head bom-qty-cols' : 'bom-head'} aria-hidden="true">
            {withQuantity && <span>Qty</span>}
            <span>{capitalizedNoun}</span>
            <span />
          </div>
        )}
        {items.map((i) => (
          <div key={i.id}>
            <button
              type="button"
              aria-expanded={editingId === i.id}
              onClick={() => (editingId === i.id ? closeEdit() : openEdit(i))}
              className={rowCols}
            >
              {withQuantity && <span className="bom-qty numeral">{i.quantity}</span>}
              <span className="bom-name">
                <span className="truncate">{i.name}</span>
                {i.is_optional && (
                  <span className="badge bg-sunken text-brand-deep">Optional</span>
                )}
              </span>
              {/* The word the chevron never was. aria-expanded on the row
                  carries the open/closed state for a screen reader, so this
                  stays a plain label rather than changing to "Close". */}
              <span className="edit-pill">Edit</span>
            </button>
            {editingId === i.id && draft && (
                <div className="bom-editor flex flex-col gap-2">
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
          </div>
        ))}

        {/* The add row, and the form is scoped to it alone: readAddForm() reads
            this element with FormData, so an item editor's inputs must never be
            inside it. Keeping the form here rather than around the whole table
            makes that structural instead of a rule someone has to remember. */}
        <form
          ref={addFormRef}
          onSubmit={handleAdd}
          onChange={() => setAddDirty(true)}
          aria-label={`Add ${noun}`}
        >
          <button
            type="button"
            aria-expanded={addOpen}
            onClick={() => openAdd(!addOpen)}
            className={withQuantity ? 'bom-add bom-qty-cols' : 'bom-add'}
          >
            {withQuantity && (
              <span className="bom-add-mark" aria-hidden="true">
                +
              </span>
            )}
            <span>
              {!withQuantity && <span aria-hidden="true">+ </span>}
              Add a {noun}
            </span>
            <span />
          </button>
          {/* Hidden rather than unmounted. The fields are uncontrolled, so
              unmounting would throw away a half-typed row the moment someone
              opened an item to edit — and the whole point of useSaveOnLeave
              below is that a typed row survives. `hidden` also takes the
              collapsed fields out of the tab order and the a11y tree. */}
          <div hidden={!addOpen} className="bom-editor flex flex-col gap-2">
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
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={saving} className="btn btn-accent btn-sm">
                Add {noun}
              </button>
              <button
                type="button"
                onClick={() => openAdd(false)}
                className="btn btn-quiet btn-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>

      <SaveStatusLine savedAt={savedAt} />
      {/* Still rendered with nothing in it: this row is also what holds the
          stepper's Next against the right edge, and Add now lives in the row
          it belongs to rather than at the foot of the panel. */}
      <PanelActions />
    </div>
  )
}
