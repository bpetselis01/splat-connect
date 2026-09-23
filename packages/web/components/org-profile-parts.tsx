'use client'

/**
 * The profile editor's three list-shaped parts (076): the two pictures, the
 * "How to work with them" doors, and the rate breakdown. Controlled — the form
 * owns the lists and sends them with everything else on save; only a picture
 * uploads the moment it is chosen, because the upload route writes the row.
 */
import { useState } from 'react'
import Image from 'next/image'
import { HandCoins, ImageSquare, Plus, Trash } from '@phosphor-icons/react/dist/ssr'
import { ORG_DOOR_TARGETS, formatCents, type OrgDoorTarget } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'
import { apiErrorDetail } from '@/lib/api-core'
import { safePhotoSrc } from '@/lib/photo-src'
import { dollarsToCents } from '@/components/cost-panel'
import { askingBackCents } from '@/lib/org-profile'

export type DoorDraft = { key: string; title: string; body: string; target: OrgDoorTarget }
export type RateDraft = { key: string; description: string; amount: string; claiming: boolean }

export const MAX_DOORS = 6

/** A picture for the org, uploaded on pick. `slot` names the column it fills. */
export function OrgImagePicker({
  orgId,
  slot,
  url,
  onChange,
}: {
  orgId: string
  slot: 'logo' | 'cover'
  url: string | null
  onChange: (url: string | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const src = safePhotoSrc(url)
  const label = slot === 'logo' ? 'Square logo' : 'Cover photo'

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('orgId', orgId)
      fd.append('slot', slot)
      const res = await browserApiClient.postFormData<{ url: string }>('/api/upload/org-image', fd)
      onChange(res.url)
    } catch (err) {
      setError(apiErrorDetail(err) ?? 'That did not upload. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className={`relative grid cursor-pointer place-items-center overflow-hidden rounded-[18px] border-2 border-dashed border-line bg-sunken text-center text-[13px] font-bold text-muted hover:border-brand focus-within:outline focus-within:outline-[3px] focus-within:outline-[var(--focus)] ${
          slot === 'logo' ? 'aspect-square w-[116px]' : 'h-[116px] w-full'
        }`}
      >
        {src ? (
          <Image src={src} alt={`Current ${label.toLowerCase()}`} fill className="object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 px-3">
            <ImageSquare size={22} aria-hidden="true" />
            {slot === 'logo' ? label : 'Your workshop, bench or team — no children’s faces without written consent'}
          </span>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
          className="sr-only"
          aria-label={src ? `Replace the ${label.toLowerCase()}` : `Add a ${label.toLowerCase()}`}
          disabled={busy}
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </label>
      {src && (
        <button type="button" className="self-start text-[13px] font-bold text-muted underline" onClick={() => onChange(null)}>
          Remove
        </button>
      )}
      {busy && <span className="text-[13px] text-muted">Uploading…</span>}
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export function DoorsEditor({ doors, onChange }: { doors: DoorDraft[]; onChange: (next: DoorDraft[]) => void }) {
  const set = (i: number, patch: Partial<DoorDraft>) => onChange(doors.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  return (
    <div className="flex flex-col gap-3">
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {doors.map((d, i) => (
          <li key={d.key} className="flex gap-3 rounded-[18px] border border-line bg-[var(--canvas)] p-3.5">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[var(--b100)] text-sm font-extrabold text-[var(--tink)]"
            >
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <input
                aria-label={`Door ${i + 1} title`}
                className="field font-bold"
                maxLength={60}
                value={d.title}
                placeholder="Ask for a toy"
                onChange={(e) => set(i, { title: e.target.value })}
              />
              <input
                aria-label={`Door ${i + 1} line`}
                className="field"
                maxLength={200}
                value={d.body}
                placeholder="One line a parent would understand on the phone."
                onChange={(e) => set(i, { body: e.target.value })}
              />
              <label>
                <span className="form-label">Where it takes them</span>
                <select
                  className="field"
                  value={d.target}
                  onChange={(e) => set(i, { target: e.target.value as OrgDoorTarget })}
                >
                  {ORG_DOOR_TARGETS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              aria-label={`Remove door ${i + 1}`}
              className="self-start p-1 text-muted hover:text-ink"
              onClick={() => onChange(doors.filter((_, j) => j !== i))}
            >
              <Trash size={18} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      {doors.length < MAX_DOORS && (
        <button
          type="button"
          className="btn btn-quiet btn-sm self-center"
          onClick={() => onChange([...doors, { key: crypto.randomUUID(), title: '', body: '', target: 'message' }])}
        >
          <Plus weight="bold" aria-hidden="true" />
          Add a door
        </button>
      )}
    </div>
  )
}

export function RateLinesEditor({ lines, onChange }: { lines: RateDraft[]; onChange: (next: RateDraft[]) => void }) {
  const set = (i: number, patch: Partial<RateDraft>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const total = askingBackCents(
    lines.map((l) => ({ amount_cents: dollarsToCents(l.amount) ?? 0, claiming: l.claiming }))
  )
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="form-label m-0">Breakdown</span>
        <span className="rounded-[14px] bg-[var(--tamber)] px-3.5 py-1.5 text-right text-[var(--tink)]">
          <span className="block text-[11px] font-extrabold uppercase tracking-wide">Asking back</span>
          <span className="block font-display text-lg font-extrabold tabular-nums">{formatCents(total)}</span>
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {lines.map((l, i) => (
          <li key={l.key} className="flex flex-wrap items-center gap-2">
            <input
              aria-label={`Line ${i + 1} description`}
              className="field min-w-[180px] flex-1"
              maxLength={80}
              value={l.description}
              placeholder="PLA filament, per small part"
              onChange={(e) => set(i, { description: e.target.value })}
            />
            <input
              aria-label={`Line ${i + 1} amount in dollars`}
              className="field w-[96px] font-mono"
              inputMode="decimal"
              value={l.amount}
              placeholder="$0"
              onChange={(e) => set(i, { amount: e.target.value })}
            />
            <button
              type="button"
              aria-pressed={l.claiming}
              className={`badge px-3 py-2 ${l.claiming ? 'bg-[var(--tamber)] text-[var(--tink)]' : 'bg-[var(--tmint)] text-[var(--tink)]'}`}
              onClick={() => set(i, { claiming: !l.claiming })}
            >
              <HandCoins weight="fill" aria-hidden="true" />
              {l.claiming ? 'Claiming back' : 'Covering it'}
            </button>
            <button
              type="button"
              aria-label={`Remove line ${i + 1}`}
              className="p-1 text-muted hover:text-ink"
              onClick={() => onChange(lines.filter((_, j) => j !== i))}
            >
              <Trash size={18} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-quiet btn-sm self-start"
        onClick={() => onChange([...lines, { key: crypto.randomUUID(), description: '', amount: '', claiming: true }])}
      >
        <Plus weight="bold" aria-hidden="true" />
        Add a line
      </button>
    </div>
  )
}

/**
 * The doors and lines as the API takes them, or the sentence to show. Pure,
 * so the rules are testable without rendering the form.
 */
export function readLists(
  doors: DoorDraft[],
  lines: RateDraft[],
  rateNote: string
):
  | { error: string }
  | {
      doors: Array<{ title: string; body: string; target: OrgDoorTarget }>
      lines: Array<{ description: string; amount_cents: number; claiming: boolean }>
    } {
  const keptDoors = doors.filter((d) => d.title.trim() || d.body.trim())
  if (keptDoors.some((d) => !d.title.trim())) return { error: 'Every door needs a title.' }
  if (keptDoors.length > MAX_DOORS) return { error: `${MAX_DOORS} doors is the most a page shows.` }

  const keptLines = lines.filter((l) => l.description.trim() || l.amount.trim())
  const out: Array<{ description: string; amount_cents: number; claiming: boolean }> = []
  for (const l of keptLines) {
    const cents = dollarsToCents(l.amount || '0')
    if (!l.description.trim()) return { error: 'Every cost line needs a description.' }
    if (cents === null) return { error: `"${l.description.trim()}" needs an amount in dollars.` }
    out.push({ description: l.description.trim(), amount_cents: cents, claiming: l.claiming })
  }
  // The board marks "Why these costs" required: a number with no reason is the
  // thing a family argues about.
  if (out.length > 0 && !rateNote.trim()) return { error: 'Say why these costs, in a sentence or two.' }

  return {
    doors: keptDoors.map((d) => ({ title: d.title.trim(), body: d.body.trim(), target: d.target })),
    lines: out,
  }
}
