'use client'
/**
 * "What you can take" — the board edits it in place, on the page a leader is
 * already on when a wrong box turns up.
 *
 * Every field the board draws has a column (059's polymers and note, 113's
 * machines, forms, per-drop limits, turnaround, what they get back, hours and
 * door). The polymers and note stay on the profile editor too; this PATCHes
 * only the recycling fields, and the route leaves every field it is not sent
 * alone.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowsSplit, Check, Coins, Package } from '@phosphor-icons/react/dist/ssr'
import type { Organization, RecyclingGives } from '@splat-connect/types'
import { PRINT_MATERIALS, RECYCLING_FORMS, RECYCLING_MACHINES } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

// PENDING(recycling-credit-rounding): nearest 0.1 kg, and the credit is computed from the rounded weight so display and credit agree. Which round...

const GIVES: Array<[RecyclingGives, string, typeof Coins]> = [
  ['credit', 'Print credit', Coins],
  ['spool', 'A spool back', Package],
  ['either', 'Either, their choice', ArrowsSplit],
]
const LABEL = 'mb-[7px] block text-sm font-extrabold text-ink'
const BAD_KG = 'Per drop is between 2 and 1000 kg, to one decimal place.'

/** '' is "not said"; anything else must read as kilos to one decimal. */
function kgValue(text: string): number | null | undefined {
  const t = text.trim()
  if (!t) return null
  return /^\d{1,4}(\.\d)?$/.test(t) ? Number(t) : undefined
}

function Chips({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: readonly string[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <fieldset>
      <legend className="mb-[9px] text-sm font-extrabold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((m) => {
          const on = value.includes(m)
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== m) : [...value, m])}
              className={`min-h-11 rounded-full border-2 px-4 text-sm font-extrabold text-ink ${
                on ? 'border-brand-dark bg-brand-tint' : 'border-line bg-surface'
              }`}
            >
              {m}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function WhatYouTake({ orgId, org }: { orgId: string; org: Organization }) {
  const router = useRouter()
  const [materials, setMaterials] = useState(org.recycling_materials ?? [])
  const [machines, setMachines] = useState(org.recycling_machines ?? [])
  const [forms, setForms] = useState(org.recycling_forms ?? [])
  const [min, setMin] = useState(org.recycling_min_kg != null ? String(org.recycling_min_kg) : '')
  const [max, setMax] = useState(org.recycling_max_kg != null ? String(org.recycling_max_kg) : '')
  const [turnaround, setTurnaround] = useState(org.recycling_turnaround ?? '')
  const [gives, setGives] = useState<RecyclingGives>(org.recycling_gives ?? 'credit')
  const [hours, setHours] = useState(org.recycling_hours ?? '')
  const [door, setDoor] = useState(org.recycling_door ?? '')
  const [note, setNote] = useState(org.recycling_note ?? '')
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  function save() {
    setStatus(null)
    const minKg = kgValue(min)
    const maxKg = kgValue(max)
    if (minKg === undefined || maxKg === undefined) {
      setStatus({ ok: false, text: BAD_KG })
      return
    }
    startTransition(async () => {
      try {
        await browserApiClient.patch(`/api/organizations/${orgId}/profile`, {
          recycling_materials: materials,
          recycling_note: note,
          recycling_machines: machines,
          recycling_forms: forms,
          recycling_min_kg: minKg,
          recycling_max_kg: maxKg,
          recycling_turnaround: turnaround,
          recycling_gives: gives,
          recycling_hours: hours,
          recycling_door: door,
        })
        setStatus({ ok: true, text: 'Saved — contributors see this now.' })
        router.refresh()
      } catch (err) {
        const detail = err instanceof Error ? /\{"error":"(.+?)"\}/.exec(err.message)?.[1] : null
        setStatus({ ok: false, text: detail ?? 'That did not save. Try once more.' })
      }
    })
  }

  return (
    <div className="card flex flex-col gap-[22px] p-[26px]">
      <Chips legend="Machines you run" options={RECYCLING_MACHINES} value={machines} onChange={setMachines} />
      <div>
        <Chips legend="Polymers accepted" options={PRINT_MATERIALS} value={materials} onChange={setMaterials} />
        <p className="mt-2 text-[13px] text-muted">
          Leave it empty if you do not take drop-offs — nobody can book one until something is on
          this list.
        </p>
      </div>
      <Chips legend="In what form" options={RECYCLING_FORMS} value={forms} onChange={setForms} />

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))] max-sm:grid-cols-2">
        <label>
          <span className={LABEL}>Minimum per drop</span>
          <span className="flex items-center gap-2">
            <input aria-label="Minimum per drop" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="2" className="field !w-[110px] bg-canvas font-mono" />
            <span className="font-extrabold text-muted">kg</span>
          </span>
          <span className="mt-1.5 block text-[13px] text-muted">The platform floor is 2 kg. You can ask for more, never less.</span>
        </label>
        <label>
          <span className={LABEL}>Maximum per drop</span>
          <span className="flex items-center gap-2">
            <input aria-label="Maximum per drop" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} className="field !w-[110px] bg-canvas font-mono" />
            <span className="font-extrabold text-muted">kg</span>
          </span>
        </label>
        <label className="max-sm:col-span-2">
          <span className={LABEL}>Turnaround</span>
          <input aria-label="Turnaround" value={turnaround} onChange={(e) => setTurnaround(e.target.value)} maxLength={60} placeholder="About 3 weeks" className="field w-full bg-canvas" />
        </label>
      </div>

      <fieldset>
        <legend className="mb-[9px] text-sm font-extrabold text-ink">What the contributor gets back</legend>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {GIVES.map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={gives === value}
              onClick={() => setGives(value)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-extrabold text-ink ${
                gives === value ? 'border-brand-dark bg-brand-tint' : 'border-line bg-surface'
              }`}
            >
              <Icon weight="bold" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        <label>
          <span className={LABEL}>Drop-off hours</span>
          <input aria-label="Drop-off hours" value={hours} onChange={(e) => setHours(e.target.value)} maxLength={80} placeholder="Tuesday and Thursday, 9am–4pm" className="field w-full bg-canvas" />
        </label>
        <label>
          <span className={LABEL}>Which door</span>
          <input aria-label="Which door" value={door} onChange={(e) => setDoor(e.target.value)} maxLength={120} placeholder="Loading door on the lane, ring the bell" className="field w-full bg-canvas" />
        </label>
      </div>

      <label>
        <span className={LABEL}>How you want it brought</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          className="field w-full bg-canvas py-3"
          placeholder="Clean, dry, sorted by colour."
        />
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t-(length:--border-width) border-line pt-2">
        <button type="button" onClick={save} disabled={pending} className="btn btn-primary mt-2">
          <Check weight="bold" aria-hidden="true" />
          Save what you take
        </button>
        {status && (
          <p
            role={status.ok ? 'status' : 'alert'}
            className={`mt-2 text-sm font-semibold ${status.ok ? 'text-muted' : 'text-danger'}`}
          >
            {status.text}
          </p>
        )}
      </div>
    </div>
  )
}
