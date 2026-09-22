'use client'
/**
 * "What you can take" — the board edits it in place, on the page a leader is
 * already on when a wrong box turns up.
 *
 * Only two of the board's fields have a column behind them (059's
 * recycling_materials and recycling_note), so those are the two drawn; the
 * note carries what the board splits into hours, door and minimums. The same
 * two fields stay on the profile editor — this PATCHes only them, and the
 * route leaves every field it is not sent alone.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from '@phosphor-icons/react/dist/ssr'
import { PRINT_MATERIALS } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

export function WhatYouTake({
  orgId,
  materials: initial,
  note: initialNote,
}: {
  orgId: string
  materials: string[]
  note: string | null
}) {
  const router = useRouter()
  const [materials, setMaterials] = useState(initial)
  const [note, setNote] = useState(initialNote ?? '')
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  function save() {
    setStatus(null)
    startTransition(async () => {
      try {
        await browserApiClient.patch(`/api/organizations/${orgId}/profile`, {
          recycling_materials: materials,
          recycling_note: note,
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
      <fieldset>
        <legend className="mb-[9px] text-sm font-extrabold text-ink">Polymers accepted</legend>
        <div className="flex flex-wrap gap-2">
          {PRINT_MATERIALS.map((m) => {
            const on = materials.includes(m)
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setMaterials(on ? materials.filter((x) => x !== m) : [...materials, m])
                }
                className={`min-h-11 rounded-full border-2 px-4 text-sm font-extrabold text-ink ${
                  on ? 'border-brand-dark bg-brand-tint' : 'border-line bg-surface'
                }`}
              >
                {m}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[13px] text-muted">
          Leave it empty if you do not take drop-offs — nobody can book one until something is on
          this list.
        </p>
      </fieldset>

      <label>
        <span className="mb-[7px] block text-sm font-extrabold text-ink">
          How you want it brought
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          className="field w-full bg-canvas py-3"
          placeholder="Clean, dry, sorted by colour. Two-kilo minimum. Tuesday and Thursday, 9am–4pm, loading door on the lane."
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
