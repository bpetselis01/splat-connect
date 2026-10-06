'use client'
/**
 * "Who it's for" (128), on the guide editor and the toy editor: the four child
 * questions — the same answers a child's profile gives — plus Device type on a
 * guide. Chip groups only; none is required, and an untagged item never
 * matches those filters or comes up as recommended.
 *
 * Saves itself through the browser client rather than a server action, so a
 * refused value arrives with the API's own sentence (a server action's error
 * text is redacted in production). A guide's PATCH wants updated_at as its
 * optimistic lock, so `lock` reads it first, the way the server pages do.
 */
import { useState } from 'react'
import { CHILD_QUESTIONS, DEVICE_TYPES, ONE_HAND_LABEL, apiMessage, type Suits } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

type Option = { readonly value: string; readonly label: string }
const ITEM_LEGEND = { helps_with: 'Helps with', access: 'How a child uses it', press_force: 'Press force it works with', play: 'Play' } as const
const groupsFor = (guide: boolean): { key: string; legend: string; options: readonly Option[] }[] => [
  ...(guide ? [{ key: 'device_types', legend: 'What is it?', options: DEVICE_TYPES }] : []),
  ...CHILD_QUESTIONS.map((q) => ({
    key: q.item,
    legend: ITEM_LEGEND[q.item],
    options: q.item === 'access' ? [...q.options, { value: 'one_hand', label: ONE_HAND_LABEL }] : (q.options as readonly Option[]),
  })),
]

export function EditSuitsSection({
  endpoint,
  suits,
  guide = false,
  lock = false,
  onSaved,
}: {
  /** e.g. /api/toys/:id or /api/tutorials/:id */
  endpoint: string
  suits: Suits
  /** A guide also says what it is (device_types); a toy does not. */
  guide?: boolean
  /** Read updated_at from the endpoint first and send it with the save. */
  lock?: boolean
  onSaved?: (updated: Suits) => void
}) {
  const groups = groupsFor(guide)
  // one_hand rides in the access group as its own chip, as on the filter page.
  const [lists, setLists] = useState<Record<string, string[]>>({
    device_types: suits.device_types ?? [],
    helps_with: suits.helps_with ?? [],
    access: [...(suits.access ?? []), ...(suits.one_hand ? ['one_hand'] : [])],
    press_force: suits.press_force ?? [],
    play: suits.play ?? [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const toggle = (key: string, value: string) => {
    setSaved(false)
    setLists((l) => ({ ...l, [key]: l[key].includes(value) ? l[key].filter((v) => v !== value) : [...l[key], value] }))
  }

  async function save() {
    setError(null)
    const list = (v: string[]) => (v.length ? v : null)
    const access = lists.access.filter((a) => a !== 'one_hand')
    const body = {
      ...(guide ? { device_types: list(lists.device_types) } : {}),
      helps_with: list(lists.helps_with),
      access: list(access),
      one_hand: lists.access.includes('one_hand'),
      press_force: list(lists.press_force),
      play: list(lists.play),
    }
    setSaving(true)
    try {
      const updated_at = lock ? (await browserApiClient.get<{ updated_at: string }>(endpoint)).updated_at : undefined
      const result = await browserApiClient.patch<Suits>(endpoint, lock ? { ...body, updated_at } : body)
      setSaved(true)
      onSaved?.(result)
    } catch (e) {
      setError(apiMessage(e, 'Could not save that. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-4 px-5 pb-5" aria-labelledby="suits-h">
      <div>
        <h3 id="suits-h" className="field-label">Who it&apos;s for</h3>
        <p className="m-0 max-w-prose text-xs leading-relaxed text-muted">
          None of these are required, but untagged {guide ? 'guides' : 'toys'} never show up in filters or as recommended.
        </p>
      </div>

      {groups.map((g) => (
        <fieldset key={g.key} className="m-0 border-0 p-0">
          <legend className="field-label">{g.legend}</legend>
          <div className="flex flex-wrap gap-2">
            {g.options.map((o) => (
              <button
                key={o.value}
                type="button"
                className="chip"
                aria-pressed={lists[g.key].includes(o.value)}
                onClick={() => toggle(g.key, o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      {error && <p role="alert" className="alert alert-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="button" disabled={saving} onClick={save} className="btn btn-primary btn-sm">
          {saving ? 'Saving…' : "Save who it's for"}
        </button>
        {saved && <span role="status" className="text-sm font-semibold text-brand-dark">Saved</span>}
      </div>
    </section>
  )
}
